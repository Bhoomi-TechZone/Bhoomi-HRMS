const cron     = require('node-cron');
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');

// Helper to parse time string
const parseTimeString = (timeStr) => {
  try {
    const [time, period] = timeStr.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    
    let adjustedHours = hours;
    if (period === 'PM' && hours !== 12) {
      adjustedHours += 12;
    } else if (period === 'AM' && hours === 12) {
      adjustedHours = 0;
    }
    
    return { hours: adjustedHours, minutes: minutes || 0 };
  } catch (error) {
    return { hours: 9, minutes: 0 };
  }
};

// Calculate shift end datetime based on shift start date and employee shift timings
const getShiftEndDateTime = (shiftDate, shiftStartTimeStr, shiftEndTimeStr) => {
  const startParts = parseTimeString(shiftStartTimeStr || '09:00 AM');
  const endParts = parseTimeString(shiftEndTimeStr || '06:00 PM');
  
  const end = new Date(shiftDate);
  const isOvernight = startParts.hours > endParts.hours || 
                      (startParts.hours === endParts.hours && startParts.minutes > endParts.minutes);
  
  if (isOvernight) {
    end.setDate(end.getDate() + 1);
  }
  end.setHours(endParts.hours, endParts.minutes, 0, 0);
  return end;
};

/**
 * ATTENDANCE MARKING RULES:
 *  - On check-in        : status = 'checked-in'
 *  - On check-out       : workingHours < 4  → absent
 *                         4 ≤ hours < 9     → half-day
 *                         hours ≥ 9         → present
 *  - Forgot to checkout : status = 'absent', logoutMethod = 'not-checkout'
 *
 * HOW DATES ARE STORED IN MongoDB:
 *   The check-in route does: today.setHours(0,0,0,0) in LOCAL time.
 *   We query a full 24-hour window that covers both UTC-midnight and
 *   IST-midnight (18:30 UTC previous day) so the query works regardless
 *   of what timezone the server OS is set to.
 *
 * RELIABILITY GUARANTEES:
 *   1. Started INSIDE mongoose .then() — DB is always ready before first run.
 *   2. Every sweep checks mongoose.connection.readyState before querying.
 *      If the DB is temporarily disconnected the sweep is retried after 30s.
 *   3. A global `isRunning` flag prevents overlapping sweeps.
 *   4. Every schedule uses { timezone: 'Asia/Kolkata' } — no UTC confusion.
 *   5. Each individual findByIdAndUpdate failure is caught per-record so one
 *      bad record cannot abort the entire sweep.
 *
 * SCHEDULE (Asia/Kolkata / IST):
 *   - Every hour at :05  → catches sessions open ≥ 15 h (night shifts, etc.)
 *   - 23:30 daily        → final nightly sweep (day still open)
 *   - 00:30 daily        → cleanup of the just-rolled-over day
 */

// ─── State ────────────────────────────────────────────────────────────────────

let isRunning = false;  // concurrency guard

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Wait for mongoose to (re)connect. Retries every 5 s up to `maxWaitMs`.
 * Returns true if connected, false if we gave up.
 */
async function waitForDB(maxWaitMs = 60_000) {
  const start = Date.now();
  while (mongoose.connection.readyState !== 1) {
    if (Date.now() - start >= maxWaitMs) return false;
    console.log('[AttendanceCron] DB not ready (state=' + mongoose.connection.readyState + '), waiting 5s...');
    await new Promise(r => setTimeout(r, 5_000));
  }
  return true;
}

/**
 * For a given JS Date, build the MongoDB query range that will match the
 * attendance `date` field for that IST calendar day — regardless of whether
 * the server stored it as UTC midnight or IST midnight.
 *
 *   IST 2026-06-06 00:00  =  UTC 2026-06-05 18:30  ← rangeStart
 *   IST 2026-06-06 23:59  =  UTC 2026-06-06 18:29  ← rangeEnd (= utcMidnight + 24h - 1ms)
 *
 * This 24-hour window covers both storage conventions.
 */
function getDayQueryRange(jsDate) {
  const IST_MS = 5.5 * 60 * 60 * 1000;

  // Compute the IST calendar date components
  const ist  = new Date(jsDate.getTime() + IST_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate();

  // UTC midnight of that IST date
  const utcMidnight = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));

  const rangeStart = new Date(utcMidnight.getTime() - IST_MS);           // IST midnight → UTC
  const rangeEnd   = new Date(utcMidnight.getTime() + 24 * 3_600_000 - 1); // +24h - 1ms

  return { rangeStart, rangeEnd };
}

/** YYYY-MM-DD string in IST timezone, used only for readable log output. */
function istDateStr(jsDate) {
  const IST_MS = 5.5 * 60 * 60 * 1000;
  return new Date(jsDate.getTime() + IST_MS).toISOString().slice(0, 10);
}

/** First UTC moment of the current IST calendar month. */
function currentMonthStartUTC() {
  const IST_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(Date.now() + IST_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1));
}

// ─── Core: mark one calendar day ─────────────────────────────────────────────

/**
 * Find every attendance record for `targetDate` (IST) that has a loginTime
 * but no logoutTime, and mark it absent (missed checkout).
 *
 * @param {Date}   targetDate
 * @param {string} label        - logged prefix, e.g. 'NightlySweep/today'
 * @returns {Promise<number>}   - records updated
 */
const markMissedCheckouts = async (targetDate, label = 'manual') => {
  const dateStr = istDateStr(targetDate);

  try {
    const now = new Date();
    const { rangeStart, rangeEnd } = getDayQueryRange(targetDate);
    const monthStart = currentMonthStartUTC();

    // Never touch records before the current IST month
    if (rangeEnd < monthStart) {
      console.log(`  [${label}] Skipped ${dateStr} — before current month`);
      return 0;
    }

    // Find records with loginTime but no logoutTime that haven't been properly processed
    const openRecords = await Attendance.find({
      date:         { $gte: rangeStart, $lte: rangeEnd },
      loginTime:    { $exists: true, $ne: null },
      $or: [
        { logoutTime: { $exists: false } },
        { logoutTime: null }
      ],
      // Remove restrictive filters - process any record that hasn't checked out properly
      $and: [
        {
          $or: [
            { status: { $in: ['checked-in', 'late-checkin', 'early-checkin', null, 'present'] } }, // Include 'present' status
            { status: { $exists: false } }
          ]
        },
        {
          $or: [
            { logoutMethod: { $ne: 'not-checkout' } }, // Not already marked as missed checkout
            { logoutMethod: { $exists: false } },
            { logoutMethod: null }
          ]
        }
      ]
    }).populate('employee', 'firstName lastName shiftStartTime shiftEndTime').lean();

    console.log(`  [${label}] Query range: ${rangeStart.toISOString()} to ${rangeEnd.toISOString()}`);
    console.log(`  [${label}] Found ${openRecords.length} potential records to process on ${dateStr}`);

    if (openRecords.length === 0) {
      console.log(`  [${label}] No open check-ins on ${dateStr}`);
      return 0;
    }

    console.log(`  [${label}] ${openRecords.length} open check-in(s) on ${dateStr}`);

    let count = 0;

    for (const rec of openRecords) {
      try {
        const empName = rec.employee ? `${rec.employee.firstName} ${rec.employee.lastName}` : 'Unknown';
        const loginTime      = new Date(rec.loginTime);
        const hoursOpen      = (now - loginTime) / 3_600_000;
        const tooLong        = hoursOpen >= 12;         // session > 12 h
        
        // Calculate shift end datetime based on employee's shift config
        const shiftEnd = getShiftEndDateTime(rec.date, rec.employee?.shiftStartTime, rec.employee?.shiftEndTime);
        const bufferMs = 3 * 60 * 60 * 1000; // 3 hours buffer
        const shiftOverWithBuffer = now >= new Date(shiftEnd.getTime() + bufferMs);

        console.log(`  [${label}]   ${empName}: ${hoursOpen.toFixed(1)}h open, shiftEnd: ${shiftEnd.toISOString()}, shiftOverWithBuffer:${shiftOverWithBuffer}, tooLong:${tooLong}, status:${rec.status}, logoutMethod:${rec.logoutMethod}`);

        // Mark absent if: shift is over with buffer OR session is too long
        if (!shiftOverWithBuffer && !tooLong) {
          console.log(`  [${label}]     → Skipped (still within shift/working window)`);
          continue;
        }

        const reason = tooLong ? `${hoursOpen.toFixed(1)}h session` : 'shift ended';

        // Auto-close any unended breaks so they don't remain open indefinitely
        let updatedBreaks = rec.breaks;
        if (Array.isArray(updatedBreaks) && updatedBreaks.length > 0) {
          updatedBreaks = updatedBreaks.map(b => {
            if (!b.endTime) {
              const start = new Date(b.startTime);
              const allowedMins = b.allowedDuration || (b.breakType === 'Lunch Break' ? 30 : 15);
              const end = new Date(start.getTime() + allowedMins * 60 * 1000);
              return {
                ...(b.toObject ? b.toObject() : b),
                endTime: end,
                duration: allowedMins
              };
            }
            return b;
          });
        }

        await Attendance.findByIdAndUpdate(rec._id, {
          $set: {
            logoutTime:     null,
            workingHours:   0,
            status:         'absent',
            logoutMethod:   'not-checkout',
            markedAbsentAt: now,
            breaks:         updatedBreaks
          }
        });

        count++;
        console.log(`  [${label}]     → MARKED ABSENT (${reason}): ${empName}`);

      } catch (recErr) {
        // One bad record must not stop the rest
        console.error(`  [${label}]   ✗ Failed for record ${rec._id}:`, recErr.message);
      }
    }

    console.log(`  [${label}] ✓ Marked ${count}/${openRecords.length} on ${dateStr}`);
    return count;

  } catch (err) {
    console.error(`  [${label}] ✗ Error on ${dateStr}:`, err.message);
    return 0;
  }
};

// ─── Sweep runner (with DB-ready guard + retry) ───────────────────────────────

const runSweep = async (label) => {
  if (isRunning) {
    console.log(`[AttendanceCron] ⚠ ${label} — previous sweep still running, skipped`);
    return;
  }

  // DB health check — wait up to 60 s; if still down, retry the whole sweep in 30 s
  const dbReady = await waitForDB(60_000);
  if (!dbReady) {
    console.error(`[AttendanceCron] ✗ ${label} — DB unreachable after 60s, will retry in 30s`);
    setTimeout(() => runSweep(label + '/retry'), 30_000);
    return;
  }

  isRunning = true;
  const t0     = Date.now();
  const nowIST = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  console.log(`\n[AttendanceCron] ▶ ${label} at ${nowIST}`);

  try {
    const today     = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const n1 = await markMissedCheckouts(today,     `${label}/today`);
    const n2 = await markMissedCheckouts(yesterday, `${label}/yesterday`);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
    console.log(`[AttendanceCron] ■ ${label} done in ${elapsed}s  today:${n1}  yesterday:${n2}\n`);
  } catch (err) {
    console.error(`[AttendanceCron] ✗ ${label} unhandled error:`, err.message);
  } finally {
    isRunning = false;
  }
};

// ─── Registration ─────────────────────────────────────────────────────────────

const startAttendanceCron = () => {
  const opts = { timezone: 'Asia/Kolkata' };

  // ① Every hour at :05 — catches 12+ hour sessions
  cron.schedule('5 * * * *',   () => runSweep('HourlyCheck'),    opts);

  // ② Every 2 hours during work hours (9 AM to 7 PM) at :30 — more frequent checks
  cron.schedule('30 9-19/2 * * 1-6', () => runSweep('WorkHoursCheck'), opts);

  // ③ 6:30 PM IST — end of work day sweep
  cron.schedule('30 18 * * 1-6', () => runSweep('EndOfWorkDay'), opts);

  // ④ 11:30 PM IST — final sweep while the day is still today
  cron.schedule('30 23 * * *', () => runSweep('NightlySweep'),   opts);

  // ⑤ 12:30 AM IST — the day just rolled over; sweep yesterday's open records
  cron.schedule('30 0 * * *',  () => runSweep('MidnightCleanup'), opts);

  console.log('[AttendanceCron] Registered 5 automated schedule guards (Asia/Kolkata)');
};

// Export both the starter and the core function (for the manual API trigger)
module.exports = startAttendanceCron;
module.exports.markMissedCheckoutsManual = markMissedCheckouts;
