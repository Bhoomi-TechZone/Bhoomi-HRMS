const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Goal = require('../models/Goal');
const xlsx = require('xlsx');
const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType } = require('docx');

// Helper function to determine attendance status based on working hours (legacy)
const calculateAttendanceStatus = (workingHours) => {
  if (workingHours < 4) {
    return 'absent';
  } else if (workingHours >= 4 && workingHours < 9) {
    return 'half-day';
  } else {
    return 'present';
  }
};

// Timezone-robust date matching helper for UTC and IST midnights
const getCandidateDates = (startDateStr, endDateStr) => {
  const dates = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    // UTC Midnight
    dates.push(new Date(`${year}-${month}-${day}T00:00:00.000Z`));

    // IST Midnight (recorded as 18:30:00.000Z of the previous calendar day)
    const prevDay = new Date(d);
    prevDay.setDate(prevDay.getDate() - 1);
    const pYear = prevDay.getFullYear();
    const pMonth = String(prevDay.getMonth() + 1).padStart(2, '0');
    const pDay = String(prevDay.getDate()).padStart(2, '0');
    dates.push(new Date(`${pYear}-${pMonth}-${pDay}T18:30:00.000Z`));
  }
  return dates;
};

// New helper function to determine attendance status based on check-in time vs shift configuration
const calculateAttendanceStatusByTime = async (checkInTime, employee) => {
  try {
    // Get attendance configuration
    const AttendanceConfig = require('../models/AttendanceConfig');
    const attendanceConfig = await AttendanceConfig.findOne({ isActive: true });

    if (!attendanceConfig) {
      // Fallback to default values if no config found
      console.warn('No attendance configuration found, using defaults');
      return calculateAttendanceStatusByTimeWithConfig(checkInTime, employee, {
        markLateAfter: 0.25 // 15 minutes
      });
    }

    return calculateAttendanceStatusByTimeWithConfig(checkInTime, employee, attendanceConfig);
  } catch (error) {
    console.error('Error calculating attendance status by time:', error);
    // Fallback to working hours method
    return 'present';
  }
};

// Helper function to calculate status with provided config
const calculateAttendanceStatusByTimeWithConfig = (checkInTime, employee, config) => {
  try {
    // Parse employee's shift start time
    const shiftStartTime = parseTimeString(employee.shiftStartTime || '09:00 AM');
    const checkIn = new Date(checkInTime);

    // Create shift start time for the same date as check-in
    const shiftStart = new Date(checkIn);
    shiftStart.setHours(shiftStartTime.hours, shiftStartTime.minutes, 0, 0);

    // Calculate time difference in hours
    const timeDiffMs = checkIn.getTime() - shiftStart.getTime();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    console.log(`[Attendance Status] Employee: ${employee.firstName} ${employee.lastName}`);
    console.log(`[Attendance Status] Shift Start: ${shiftStart.toLocaleTimeString()}`);
    console.log(`[Attendance Status] Check-in: ${checkIn.toLocaleTimeString()}`);
    console.log(`[Attendance Status] Time Diff: ${timeDiffHours.toFixed(2)} hours`);
    console.log(`[Attendance Status] Config - Late: ${config.markLateAfter}h`);

    // Determine status based on configuration thresholds (strictly after markLateAfter is late)
    if (timeDiffHours > config.markLateAfter) {
      console.log(`[Attendance Status] Result: present (late) (${timeDiffHours.toFixed(2)}h > ${config.markLateAfter}h)`);
      return 'present'; // Still present but late
    } else {
      console.log(`[Attendance Status] Result: present (on time) (${timeDiffHours.toFixed(2)}h <= ${config.markLateAfter}h)`);
      return 'present';
    }
  } catch (error) {
    console.error('Error in calculateAttendanceStatusByTimeWithConfig:', error);
    return 'present'; // Default fallback
  }
};

// Helper function to parse time string (e.g., "09:00 AM" -> {hours: 9, minutes: 0})
const parseTimeString = (timeStr) => {
  try {
    const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return { hours: 9, minutes: 0 };

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3] ? match[3].toUpperCase() : null;

    let adjustedHours = hours;
    if (period === 'PM' && hours !== 12) {
      adjustedHours += 12;
    } else if (period === 'AM' && hours === 12) {
      adjustedHours = 0;
    }

    return { hours: adjustedHours, minutes: minutes || 0 };
  } catch (error) {
    console.error('Error parsing time string:', timeStr, error);
    return { hours: 9, minutes: 0 }; // Default to 9:00 AM
  }
};

// Reusable helper to get the active shift date window for an employee at a given time
const getCurrentShiftInfo = (employee, now = new Date()) => {
  // Use IST timezone for correct shift boundaries
  const options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  const getPart = (type) => parseInt(parts.find(p => p.type === type).value, 10);

  const istYear = getPart('year');
  const istMonth = getPart('month') - 1; // 0-indexed
  const istDay = getPart('day');

  const shiftStartParts = parseTimeString(employee.shiftStartTime || '09:00 AM');
  const shiftEndParts = parseTimeString(employee.shiftEndTime || '06:00 PM');

  const createIstDate = (year, month, day, hours, minutes) => {
    const pad = (n) => String(n).padStart(2, '0');
    return new Date(`${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00.000+05:30`);
  };

  const isOvernight = shiftStartParts.hours > shiftEndParts.hours ||
    (shiftStartParts.hours === shiftEndParts.hours && shiftStartParts.minutes > shiftEndParts.minutes);

  const yesterday = new Date(Date.UTC(istYear, istMonth, istDay));
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const yesterdayStart = createIstDate(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate(), shiftStartParts.hours, shiftStartParts.minutes);

  const yesterdayEndDay = new Date(yesterday);
  if (isOvernight) yesterdayEndDay.setUTCDate(yesterdayEndDay.getUTCDate() + 1);
  const yesterdayEnd = createIstDate(yesterdayEndDay.getUTCFullYear(), yesterdayEndDay.getUTCMonth(), yesterdayEndDay.getUTCDate(), shiftEndParts.hours, shiftEndParts.minutes);

  const bufferMs = 3 * 60 * 60 * 1000;
  const yesterdayEndWithBuffer = new Date(yesterdayEnd.getTime() + bufferMs);

  // shiftDate is represented as a Date at UTC midnight for consistency with the rest of the database
  if (now >= yesterdayStart && now < yesterdayEndWithBuffer) {
    const sDate = new Date(Date.UTC(yesterday.getUTCFullYear(), yesterday.getUTCMonth(), yesterday.getUTCDate()));
    // Adjust logic to prevent creating a date that doesn't match legacy `today.setHours(0,0,0,0)` timezone.
    // Actually, `new Date().setHours(0,0,0,0)` creates midnight in server local time. 
    // To be perfectly backwards compatible with `date` stored in DB, we should keep the same behavior:
    const legacyShiftDate = new Date(now);
    legacyShiftDate.setDate(legacyShiftDate.getDate() - 1);
    legacyShiftDate.setHours(0, 0, 0, 0);

    return {
      shiftDate: legacyShiftDate,
      isOvernight,
      shiftStart: yesterdayStart,
      shiftEnd: yesterdayEnd
    };
  }

  const todayStart = createIstDate(istYear, istMonth, istDay, shiftStartParts.hours, shiftStartParts.minutes);

  const todayEndDay = new Date(Date.UTC(istYear, istMonth, istDay));
  if (isOvernight) todayEndDay.setUTCDate(todayEndDay.getUTCDate() + 1);
  const todayEnd = createIstDate(todayEndDay.getUTCFullYear(), todayEndDay.getUTCMonth(), todayEndDay.getUTCDate(), shiftEndParts.hours, shiftEndParts.minutes);

  const legacyShiftDateToday = new Date(now);
  legacyShiftDateToday.setHours(0, 0, 0, 0);

  return {
    shiftDate: legacyShiftDateToday,
    isOvernight,
    shiftStart: todayStart,
    shiftEnd: todayEnd
  };
};

// NEW ATTENDANCE STATUS LOGIC
// - On check-in:  status = 'checked-in'
// - On check-out: workingHours < 4 → absent
//                 4 ≤ workingHours < 8 → half-day
//                 workingHours ≥ 8 AND checked out → present
// - Forgot to checkout (no logoutTime by end of day) → absent
// - Only Lunch Break and Tea Break time is considered (Other breaks are fully ignored).
// - Only the EXCEEDED portion of Lunch/Tea break is subtracted from working hours.

/**
 * Calculate effective working hours:
 * - Starts counting from shiftStartTime (employee's shift start time) instead of loginTime.
 * - Only the actual break time taken is deducted (Lunch + Tea only; Other breaks are fully ignored).
 * - If user takes more than allotted break time, full actual break is deducted.
 * - The break limit (totalBreakLimit) is used only for enforcement/warning, not as a flat deduction.
 * @param {Date} loginTime
 * @param {Date} logoutTime
 * @param {Array} breaks - array of break objects from attendance
 * @param {Object} config - { totalBreakLimit: number (mins) }
 * @param {Date|string} shiftEndTime
 * @param {Date|string} shiftStartTime
 * @returns {number} working hours
 */
const calculateWorkingHours = (loginTime, logoutTime, breaks = [], config = {}, shiftEndTime = null, shiftStartTime = null, status = null) => {
  const login = new Date(loginTime);
  let logout = new Date(logoutTime);

  const markLateAfterHrs = config && config.markLateAfter !== undefined ? config.markLateAfter : 0.25;
  const markLateAfterMs = markLateAfterHrs * 60 * 60 * 1000;

  // Determine calculationStart:
  // - If employee checkin is on or before markPresentTill (shiftStartTime + markLateAfter grace) and not late-checkin: starts from shiftStartTime.
  // - If employee checkin is after markPresentTill (late) or status is 'late-checkin': starts immediately from loginTime.
  let calculationStart = login;
  if (shiftStartTime) {
    let parsedStart = null;
    if (shiftStartTime instanceof Date) {
      parsedStart = new Date(shiftStartTime);
    } else if (typeof shiftStartTime === 'string') {
      const startParts = parseTimeString(shiftStartTime);
      const parsed = new Date(login);
      parsed.setHours(startParts.hours, startParts.minutes, 0, 0);
      parsedStart = parsed;
    }

    if (parsedStart) {
      const markPresentTill = new Date(parsedStart.getTime() + markLateAfterMs);
      if (status === 'late-checkin' || login > markPresentTill) {
        calculationStart = login;
      } else {
        calculationStart = parsedStart;
      }
    }
  }

  // If shiftEndTime is provided, cap logout time at shiftEndTime (or align if within 2 minutes of shiftEnd)
  if (shiftEndTime) {
    const shiftEnd = new Date(shiftEndTime);
    if (logout > shiftEnd || logout >= new Date(shiftEnd.getTime() - 2 * 60000)) {
      logout = shiftEnd;
    }
  }

  const totalElapsedSecs = Math.max(0, Math.round((logout - calculationStart) / 1000));
  let totalBreakMins = 0;

  if (Array.isArray(breaks) && breaks.length > 0) {
    breaks.forEach(b => {
      if (b.breakType === 'Other' || b.breakType === 'Briefing/Meeting' || b.breakType === 'Breifing/Meeting') return; // ignore Other / Briefing/Meeting breaks entirely

      let breakDur = 0;
      if (b.endTime) {
        breakDur = b.duration !== undefined ? b.duration
          : Math.round((new Date(b.endTime) - new Date(b.startTime)) / 60000);
      } else {
        breakDur = Math.round((Date.now() - new Date(b.startTime)) / 60000);
      }
      totalBreakMins += Math.max(0, breakDur);
    });
  }

  // Only deduct actual break time taken — break limit is for enforcement/warning only
  const totalDeductMins = totalBreakMins;

  const totalElapsedMins = totalElapsedSecs / 60;
  const netWorkingMins = totalElapsedMins - totalDeductMins;
  const workingHours = Math.max(0, netWorkingMins / 60);

  return workingHours;
};

/**
 * Async version: fetches AttendanceConfig for limits, then calls calculateWorkingHours.
 * Returns: 'absent' | 'half-day' | 'present'
 */
const calculateFinalAttendanceStatus = async (loginTime, logoutTime, breaks = [], shiftEndTime = null, shiftStartTime = null) => {
  // No checkout → absent
  if (!logoutTime) return 'absent';

  const breaksArr = Array.isArray(breaks) ? breaks : [];

  let config = { totalBreakLimit: 60 };
  try {
    const AttendanceConfig = require('../models/AttendanceConfig');
    const dbConfig = await AttendanceConfig.findOne({ isActive: true });
    if (dbConfig && dbConfig.totalBreakLimit !== undefined) {
      config.totalBreakLimit = dbConfig.totalBreakLimit;
    }
  } catch (e) {
    console.warn('[calculateFinalAttendanceStatus] Could not fetch AttendanceConfig, using defaults:', e.message);
  }

  const workingHours = calculateWorkingHours(loginTime, logoutTime, breaksArr, config, shiftEndTime, shiftStartTime);

  if (workingHours < 4) return 'absent';

  // Requirement: If employee has not taken any break for the day, mark half-day
  const hasTakenBreak = breaksArr.length > 0;
  if (!hasTakenBreak) {
    return 'half-day';
  }

  if (workingHours < 8.0) return 'half-day';
  return 'present';
};

// Get break limits — available to all authenticated users (employees included)
router.get('/break-limits', auth, async (req, res) => {
  try {
    const AttendanceConfig = require('../models/AttendanceConfig');
    let config = await AttendanceConfig.findOne({ isActive: true });
    if (!config) {
      config = { totalBreakLimit: 60 };
    }
    res.json({
      totalBreakLimit: config.totalBreakLimit,
      checkinWindowBefore: config.checkinWindowBefore !== undefined ? config.checkinWindowBefore : 15,
      markLateAfter: config.markLateAfter !== undefined ? config.markLateAfter : 0.25
    });
  } catch (error) {
    console.error('Error fetching break limits:', error);
    res.status(500).json({ message: 'Error fetching break limits' });
  }
});

// Get current check-in status (for tracking agents recovery)
router.get('/current-status', auth, async (req, res) => {
  try {
    const shiftInfo = getCurrentShiftInfo(req.user);
    const today = shiftInfo.shiftDate;
    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today
    });

    if (attendance && !attendance.logoutTime) {
      return res.json({
        checkedIn: true,
        loginTime: attendance.loginTime
      });
    }

    res.json({ checkedIn: false });
  } catch (error) {
    console.error('Error getting current status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lock to prevent concurrent break starts for the same user
const breakLocks = new Set();

// Start a break
router.post('/break/start', auth, async (req, res) => {
  const lockKey = req.user._id.toString();
  if (breakLocks.has(lockKey)) {
    return res.status(429).json({ message: 'Please wait, processing your previous request.' });
  }
  breakLocks.add(lockKey);

  try {
    const { breakType, reason } = req.body;
    if (!breakType) {
      return res.status(400).json({ message: 'Break type is required' });
    }
    if ((breakType === 'Briefing/Meeting' || breakType === 'Breifing/Meeting' || breakType === 'Other') && (!reason || !reason.trim())) {
      return res.status(400).json({ message: 'Reason is required for "Briefing/Meeting"' });
    }

    const shiftInfo = getCurrentShiftInfo(req.user);
    const today = shiftInfo.shiftDate;

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No active attendance record found for today' });
    }
    if (attendance.logoutTime) {
      return res.status(400).json({ message: 'Cannot take a break after checkout' });
    }

    // Check if there's already an active break
    const activeBreak = attendance.breaks.find(b => !b.endTime);
    if (activeBreak) {
      return res.status(400).json({ message: 'You are already on a break' });
    }

    const ShiftConfig = require('../models/ShiftConfig');
    let shiftConfig = null;
    if (req.user.shiftType) {
      shiftConfig = await ShiftConfig.findOne({ type: req.user.shiftType });
      if (!shiftConfig) {
        shiftConfig = await ShiftConfig.findOne({
          $or: [
            { type: new RegExp(`^${req.user.shiftType}$`, 'i') },
            { name: new RegExp(`^${req.user.shiftType}$`, 'i') }
          ]
        });
      }
    }
    if (!shiftConfig && req.user.shiftStartTime && req.user.shiftEndTime) {
      shiftConfig = await ShiftConfig.findOne({
        startTime: req.user.shiftStartTime,
        endTime: req.user.shiftEndTime
      });
    }
    if (!shiftConfig) {
      shiftConfig = await ShiftConfig.findOne({ type: 'morning' }) || await ShiftConfig.findOne({});
    }

    // Helper to extract current time in IST
    const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(new Date());
    let currentHour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    let currentMinute = parseInt(parts.find(p => p.type === 'minute').value, 10);
    if (currentHour === 24) currentHour = 0;
    const currentTotalMins = currentHour * 60 + currentMinute;

    const isLunchBreak = breakType === 'Lunch Break';
    const isTeaBreak = breakType === 'Tea Break' || breakType === 'Refreshment Break';
    const isFirstRefBreak = breakType === '1st Refreshment Break';
    const isSecondRefBreak = breakType === '2nd Refreshment Break';

    // Disallow re-taking already completed or taken specific breaks
    if (isLunchBreak && attendance.breaks.some(b => b.breakType === 'Lunch Break')) {
      return res.status(400).json({ message: 'You have already taken your Lunch break for today' });
    }
    if (isFirstRefBreak && attendance.breaks.some(b => b.breakType === '1st Refreshment Break')) {
      return res.status(400).json({ message: 'You have already taken your 1st Refreshment break for today' });
    }
    if (isSecondRefBreak && attendance.breaks.some(b => b.breakType === '2nd Refreshment Break')) {
      return res.status(400).json({ message: 'You have already taken your 2nd Refreshment break for today' });
    }

    const teaBreaksCount = attendance.breaks.filter(b =>
      b.breakType === 'Tea Break' ||
      b.breakType === 'Refreshment Break' ||
      b.breakType === '1st Refreshment Break' ||
      b.breakType === '2nd Refreshment Break'
    ).length;

    if ((isTeaBreak || isFirstRefBreak || isSecondRefBreak) && teaBreaksCount >= 2) {
      return res.status(400).json({ message: 'You have already taken the maximum 2 Refreshment breaks allowed for today' });
    }

    if (shiftConfig) {
      const shiftStartP = parseTimeString(shiftConfig.startTime || '09:00 AM');
      const shiftEndP = parseTimeString(shiftConfig.endTime || '06:00 PM');
      const shiftStartMins = shiftStartP.hours * 60 + shiftStartP.minutes;
      const shiftEndMins = shiftEndP.hours * 60 + shiftEndP.minutes;
      const isOvernight = shiftStartMins > shiftEndMins;

      const normalizeMins = (mins) => {
        if (isOvernight && mins < shiftStartMins && mins <= 12 * 60) {
          return mins + 1440;
        }
        return mins;
      };

      const normCurrent = normalizeMins(currentTotalMins);

      const getWindowMins = (startStr, endStr) => {
        if (!startStr || !endStr) return null;
        const sP = parseTimeString(startStr);
        const eP = parseTimeString(endStr);
        let sMins = normalizeMins(sP.hours * 60 + sP.minutes);
        let eMins = normalizeMins(eP.hours * 60 + eP.minutes);
        if (eMins <= sMins && eP.hours < sP.hours) {
          eMins += 1440;
        }
        return { startMins: sMins, endMins: eMins };
      };

      if (isLunchBreak && !shiftConfig.allowLunchAnytime) {
        const lunchStartStr = shiftConfig.lunchStartTime || shiftConfig.lunchTime;
        const lunchEndStr = shiftConfig.lunchEndTime;

        if (lunchStartStr && lunchEndStr) {
          const win = getWindowMins(lunchStartStr, lunchEndStr);
          if (win) {
            if (normCurrent < win.startMins) {
              return res.status(400).json({
                message: `You cannot take Lunch break before ${lunchStartStr}. It is only permitted between ${lunchStartStr} and ${lunchEndStr} as per your shift.`
              });
            }
            if (normCurrent > win.endMins) {
              return res.status(400).json({
                message: `Lunch break time has ended for your shift (ended at ${lunchEndStr}). You can no longer take Lunch break today.`
              });
            }
          }
        }
      } else if (isFirstRefBreak && !shiftConfig.allowRefreshment1Anytime) {
        const ref1StartStr = shiftConfig.refreshment1StartTime;
        const ref1EndStr = shiftConfig.refreshment1EndTime;

        if (ref1StartStr && ref1EndStr) {
          const win = getWindowMins(ref1StartStr, ref1EndStr);
          if (win) {
            if (normCurrent < win.startMins) {
              return res.status(400).json({
                message: `You cannot take 1st Refreshment break before ${ref1StartStr}. It is only permitted between ${ref1StartStr} and ${ref1EndStr} as per your shift.`
              });
            }
            if (normCurrent > win.endMins) {
              return res.status(400).json({
                message: `1st Refreshment break time has ended for your shift (ended at ${ref1EndStr}). You can no longer take 1st Refreshment break today.`
              });
            }
          }
        }
      } else if (isSecondRefBreak && !shiftConfig.allowRefreshment2Anytime) {
        const ref2StartStr = shiftConfig.refreshment2StartTime;
        const ref2EndStr = shiftConfig.refreshment2EndTime;

        if (ref2StartStr && ref2EndStr) {
          const win = getWindowMins(ref2StartStr, ref2EndStr);
          if (win) {
            if (normCurrent < win.startMins) {
              return res.status(400).json({
                message: `You cannot take 2nd Refreshment break before ${ref2StartStr}. It is only permitted between ${ref2StartStr} and ${ref2EndStr} as per your shift.`
              });
            }
            if (normCurrent > win.endMins) {
              return res.status(400).json({
                message: `2nd Refreshment break time has ended for your shift (ended at ${ref2EndStr}). You can no longer take 2nd Refreshment break today.`
              });
            }
          }
        }
      } else if (isTeaBreak && (!shiftConfig.allowRefreshment1Anytime || !shiftConfig.allowRefreshment2Anytime)) {
        const ref1StartStr = shiftConfig.refreshment1StartTime;
        const ref1EndStr = shiftConfig.refreshment1EndTime;
        const ref2StartStr = shiftConfig.refreshment2StartTime;
        const ref2EndStr = shiftConfig.refreshment2EndTime;

        const win1 = !shiftConfig.allowRefreshment1Anytime ? getWindowMins(ref1StartStr, ref1EndStr) : null;
        const win2 = !shiftConfig.allowRefreshment2Anytime ? getWindowMins(ref2StartStr, ref2EndStr) : null;

        const inRef1 = shiftConfig.allowRefreshment1Anytime || (win1 ? (normCurrent >= win1.startMins && normCurrent <= win1.endMins) : false);
        const inRef2 = shiftConfig.allowRefreshment2Anytime || (win2 ? (normCurrent >= win2.startMins && normCurrent <= win2.endMins) : false);

        if (!inRef1 && !inRef2) {
          if (win1 && win2) {
            if (normCurrent < win1.startMins) {
              return res.status(400).json({
                message: `You cannot take Refreshment break before ${ref1StartStr} as per your shift schedule.`
              });
            } else if (normCurrent > win1.endMins && normCurrent < win2.startMins) {
              return res.status(400).json({
                message: `1st Refreshment break ended at ${ref1EndStr}. Next Refreshment break is only available from ${ref2StartStr} to ${ref2EndStr}.`
              });
            } else {
              return res.status(400).json({
                message: `Refreshment break time windows have ended for your shift today (ended at ${ref2EndStr}). You can no longer take any Refreshment break today.`
              });
            }
          } else if (win1 && !win2) {
            if (normCurrent < win1.startMins) {
              return res.status(400).json({
                message: `You cannot take Refreshment break before ${ref1StartStr} as per your shift schedule.`
              });
            } else {
              return res.status(400).json({
                message: `Refreshment break time has ended for your shift (ended at ${ref1EndStr}). You can no longer take Refreshment break today.`
              });
            }
          } else if (!win1 && win2) {
            if (normCurrent < win2.startMins) {
              return res.status(400).json({
                message: `You cannot take Refreshment break before ${ref2StartStr} as per your shift schedule.`
              });
            } else {
              return res.status(400).json({
                message: `Refreshment break time has ended for your shift (ended at ${ref2EndStr}). You can no longer take Refreshment break today.`
              });
            }
          }
        }
      }
    }

    attendance.breaks.push({
      breakType,
      reason: breakType === 'Other' ? reason : undefined,
      startTime: new Date()
    });

    await attendance.save();
    res.json({ message: 'Break started', break: attendance.breaks[attendance.breaks.length - 1] });
  } catch (error) {
    console.error('Error starting break:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  } finally {
    breakLocks.delete(lockKey);
  }
});

// End a break
router.post('/break/end', auth, async (req, res) => {
  try {
    const shiftInfo = getCurrentShiftInfo(req.user);
    const today = shiftInfo.shiftDate;

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No active attendance record found for today' });
    }

    const activeBreakIndex = attendance.breaks.findIndex(b => !b.endTime);
    if (activeBreakIndex === -1) {
      return res.status(400).json({ message: 'No active break found' });
    }

    const activeBreak = attendance.breaks[activeBreakIndex];
    activeBreak.endTime = new Date();
    activeBreak.duration = Math.round((activeBreak.endTime - activeBreak.startTime) / 60000); // duration in minutes

    await attendance.save();
    res.json({ message: 'Break ended', break: activeBreak });
  } catch (error) {
    console.error('Error ending break:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get active employees for attendance (requires create permission)
router.get('/employees/active', auth, async (req, res) => {
  try {
    // Check if user has permission to create attendance records
    const hasCreatePermission = req.user.role.permissions.find(
      p => p.module === 'attendance' && p.actions.includes('create')
    );

    if (!hasCreatePermission && req.user.role.name !== 'Admin' && req.user.role.name !== 'Director') {
      return res.status(403).json({ message: 'Not authorized to access employee list' });
    }

    const User = require('../models/User');
    const Role = require('../models/Role');

    // Get Admin role ID
    const adminRole = await Role.findOne({ name: 'Admin' });

    // Get all active employees excluding Admin role
    const employees = await User.find({
      isActive: true,
      role: { $ne: adminRole?._id }
    })
      .select('firstName lastName employeeId')
      .sort({ firstName: 1 });

    res.json(employees);
  } catch (error) {
    console.error('Error fetching active employees:', error);
    res.status(500).json({ message: 'Error fetching employees' });
  }
});

// Get attendance records (employees see their own, admin/HR sees all)
router.get('/', auth, async (req, res) => {
  try {
    // Define roles that can see all employee attendance
    const fullAccessRoles = ['Admin', 'HR', 'HR Manager', 'Director'];
    const hasFullAccessRole = fullAccessRoles.includes(req.user.role.name);

    // Check for attendance read permission
    const hasAttendanceReadPermission = req.user.role.permissions && req.user.role.permissions.find(
      p => p.module === 'attendance' && p.actions.includes('read')
    );

    // Full access only for specific roles OR users with attendance read permission who are in management
    const hasFullAccess = hasFullAccessRole && hasAttendanceReadPermission;

    let query = {};

    // If employeeId is provided in query params and user has full access, filter by that employee
    if (req.query.employeeId && hasFullAccess) {
      query.employee = req.query.employeeId;
    } else if (!hasFullAccess) {
      // Regular users (including Team Leader) can only see their own attendance
      query.employee = req.user._id;
    }

    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      query.date = { $in: getCandidateDates(startDate, endDate) };
    }

    const attendance = await Attendance.find(query)
      .populate({
        path: 'employee',
        select: 'firstName lastName employeeId shiftStartTime shiftEndTime',
        populate: {
          path: 'role',
          select: 'name'
        }
      })
      .populate('updatedBy', 'firstName lastName')
      .sort({ date: -1, loginTime: -1 });

    // Filter out Admin users from the results
    const filteredAttendance = attendance.filter(record => {
      return record.employee && record.employee.role && record.employee.role.name !== 'Admin';
    });

    // Fetch shift configs to infer historical shifts correctly
    const ShiftConfig = require('../models/ShiftConfig');
    const allShiftConfigs = await ShiftConfig.find({});

    const getInferredShift = (att) => {
      if (att.shiftStartTime && att.shiftEndTime) {
        return allShiftConfigs.find(s => s.startTime === att.shiftStartTime && s.endTime === att.shiftEndTime);
      }
      if (!att.loginTime) return null;

      const loginD = new Date(att.loginTime);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istD = new Date(loginD.getTime() + istOffset);
      const hours = istD.getUTCHours();
      const minutes = istD.getUTCMinutes();
      const loginMins = hours * 60 + minutes;

      let bestShift = null;
      let minDiff = Infinity;
      for (const s of allShiftConfigs) {
        if (!s.startTime) continue;
        const timeParts = s.startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeParts) {
          let sHours = parseInt(timeParts[1]);
          if (timeParts[3].toUpperCase() === 'PM' && sHours !== 12) sHours += 12;
          if (timeParts[3].toUpperCase() === 'AM' && sHours === 12) sHours = 0;
          const sMins = sHours * 60 + parseInt(timeParts[2]);

          let diff = Math.abs(loginMins - sMins);
          if (diff > 12 * 60) diff = 24 * 60 - diff;

          if (diff < minDiff) {
            minDiff = diff;
            bestShift = s;
          }
        }
      }
      return minDiff <= 240 ? bestShift : null;
    };

    const enhancedAttendance = filteredAttendance.map(record => {
      const recordObj = record.toObject ? record.toObject() : record;
      if (!recordObj.shiftStartTime || !recordObj.shiftEndTime) {
        const inferred = getInferredShift(recordObj);
        if (inferred) {
          recordObj.shiftStartTime = inferred.startTime;
          recordObj.shiftEndTime = inferred.endTime;
        } else if (recordObj.employee) {
          recordObj.shiftStartTime = recordObj.employee.shiftStartTime;
          recordObj.shiftEndTime = recordObj.employee.shiftEndTime;
        }
      }
      return recordObj;
    });

    res.json(enhancedAttendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ message: 'Error fetching attendance' });
  }
});

// Export Attendance to Excel
router.get('/export/excel', auth, async (req, res) => {
  try {
    // Define roles that can export all employee attendance
    const fullAccessRoles = ['Admin', 'HR', 'HR Manager', 'Director'];
    const hasFullAccessRole = fullAccessRoles.includes(req.user.role.name);

    // Check for attendance read permission
    const hasAttendanceReadPermission = req.user.role.permissions && req.user.role.permissions.find(
      p => p.module === 'attendance' && p.actions.includes('read')
    );

    // Can export all employees only if they have both role and permission
    const canExportAllEmployees = hasFullAccessRole && hasAttendanceReadPermission;

    const { startDate, endDate, month, year } = req.query;

    // Determine date range
    let dateStart, dateEnd, exportFilename, sheetTitle;

    if (month && year) {
      // Export by month/year - if allowed, export all employees; otherwise export only logged-in user's attendance
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[parseInt(month) - 1];
      exportFilename = canExportAllEmployees ? `All_Employees_Attendance_${monthName}_${year}.xlsx` : `${req.user.firstName || 'Employee'}_${req.user.lastName || 'Attendance'}_Attendance_${monthName}_${year}.xlsx`;
      sheetTitle = `${monthName} ${year}`;

      // Get all active employees or just the current user
      const User = require('../models/User');
      const Role = require('../models/Role');

      // Get Admin role ID
      const adminRole = await Role.findOne({ name: 'Admin' });

      const allEmployees = canExportAllEmployees
        ? await User.find({
          isActive: true,
          role: { $ne: adminRole?._id }
        })
          .select('firstName lastName employeeId department designation shiftType')
          .sort({ firstName: 1, lastName: 1 })
        : [await User.findById(req.user._id).select('firstName lastName employeeId department designation shiftType')];

      if (allEmployees.length === 0 || !allEmployees[0]) {
        return res.status(404).json({ message: 'No employee attendance found' });
      }

      if (allEmployees.length === 0) {
        return res.status(404).json({ message: 'No active employees found' });
      }

      const targetYear = parseInt(year);
      const targetMonth = parseInt(month);

      // Helper to extract the day-of-month (1..31) in IST / UTC
      const getRecordDay = (recordDate) => {
        if (!recordDate) return null;
        const d = new Date(recordDate);
        if (isNaN(d.getTime())) return null;

        // Check in Asia/Kolkata (IST) timezone
        const istStr = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
        const [istY, istM, istD] = istStr.split('-').map(Number);
        if (istY === targetYear && istM === targetMonth) {
          return istD;
        }

        // Check UTC date parts
        const utcY = d.getUTCFullYear();
        const utcM = d.getUTCMonth() + 1;
        const utcD = d.getUTCDate();
        if (utcY === targetYear && utcM === targetMonth) {
          return utcD;
        }

        // Check local date parts
        const locY = d.getFullYear();
        const locM = d.getMonth() + 1;
        const locD = d.getDate();
        if (locY === targetYear && locM === targetMonth) {
          return locD;
        }

        return null;
      };

      // Query with a 2-day buffer on both ends to cover any timezone difference (UTC vs IST)
      const queryDateStart = new Date(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0) - 2 * 24 * 60 * 60 * 1000);
      const queryDateEnd = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999) + 2 * 24 * 60 * 60 * 1000);

      // Get all attendance records for the month
      const attendance = await Attendance.find({
        date: { $gte: queryDateStart, $lte: queryDateEnd }
      }).populate('employee', 'firstName lastName employeeId department designation shiftType');

      // Sort by updatedAt/createdAt asc so most recent updates overwrite older duplicates
      attendance.sort((a, b) => new Date(a.updatedAt || a.createdAt || 0) - new Date(b.updatedAt || b.createdAt || 0));

      // Get all approved leaves for the month
      const Leave = require('../models/Leave');
      const approvedLeaves = await Leave.find({
        status: 'approved',
        $or: [
          { startDate: { $gte: queryDateStart, $lte: queryDateEnd } },
          { endDate: { $gte: queryDateStart, $lte: queryDateEnd } },
          { startDate: { $lte: queryDateStart }, endDate: { $gte: queryDateEnd } }
        ]
      }).populate('employee', 'firstName lastName employeeId');

      // Get all holidays for the month
      const Holiday = require('../models/Holiday');
      const holidays = await Holiday.find({
        date: { $gte: queryDateStart, $lte: queryDateEnd }
      });

      // Total days in target month
      const totalDays = new Date(targetYear, targetMonth, 0).getDate();

      // Create holiday map for quick lookup
      const holidayMap = new Map();
      holidays.forEach(holiday => {
        const day = getRecordDay(holiday.date);
        if (day !== null && day >= 1 && day <= totalDays) {
          holidayMap.set(day, holiday);
        }
      });

      // Create leave map for quick lookup
      const leaveMap = new Map();
      approvedLeaves.forEach(leave => {
        if (!leave.employee) return;
        const empId = leave.employee._id.toString();

        if (!leaveMap.has(empId)) {
          leaveMap.set(empId, []);
        }

        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate || leave.startDate);

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const day = getRecordDay(d);
          if (day !== null && day >= 1 && day <= totalDays) {
            leaveMap.get(empId).push({
              day: day,
              leaveCategory: leave.leaveCategory || 'Casual Leave',
              leaveType: leave.leaveType || leave.reason,
              durationType: leave.durationType || 'Full Day',
              description: leave.description || leave.reason || ''
            });
          }
        }
      });

      // Create a map of attendance by employee and date
      const attendanceMap = new Map();
      attendance.forEach(record => {
        if (!record.employee) return;
        const empId = record.employee._id.toString();
        const dateKey = getRecordDay(record.date);

        if (dateKey !== null && dateKey >= 1 && dateKey <= totalDays) {
          if (!attendanceMap.has(empId)) {
            attendanceMap.set(empId, new Map());
          }
          attendanceMap.get(empId).set(dateKey, record);
        }
      });

      // Prepare data for Excel - Employee-wise format with daily columns
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(sheetTitle);

      // Pre-fetch shift configs for all shift types
      const ShiftConfig = require('../models/ShiftConfig');
      const shiftConfigs = await ShiftConfig.find({});
      const shiftConfigMap = {};
      shiftConfigs.forEach(sc => { shiftConfigMap[sc.type] = sc; });

      // Today for future date detection
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const getInferredShift = (att) => {
        if (att.shiftStartTime && att.shiftEndTime) {
          return shiftConfigs.find(s => s.startTime === att.shiftStartTime && s.endTime === att.shiftEndTime);
        }
        if (!att.loginTime) return null;

        const loginD = new Date(att.loginTime);
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istD = new Date(loginD.getTime() + istOffset);
        const hours = istD.getUTCHours();
        const minutes = istD.getUTCMinutes();
        const loginMins = hours * 60 + minutes;

        let bestShift = null;
        let minDiff = Infinity;
        for (const s of shiftConfigs) {
          if (!s.startTime) continue;
          const timeParts = s.startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
          if (timeParts) {
            let sHours = parseInt(timeParts[1]);
            if (timeParts[3].toUpperCase() === 'PM' && sHours !== 12) sHours += 12;
            if (timeParts[3].toUpperCase() === 'AM' && sHours === 12) sHours = 0;
            const sMins = sHours * 60 + parseInt(timeParts[2]);

            let diff = Math.abs(loginMins - sMins);
            if (diff > 12 * 60) diff = 24 * 60 - diff;

            if (diff < minDiff) {
              minDiff = diff;
              bestShift = s;
            }
          }
        }
        return minDiff <= 240 ? bestShift : null;
      };

      // Process each employee
      for (let empIndex = 0; empIndex < allEmployees.length; empIndex++) {
        const emp = allEmployees[empIndex];
        const empId = emp._id.toString();
        const empAttendance = attendanceMap.get(empId) || new Map();

        // Get shift weekoff days for this employee
        const shiftConfig = shiftConfigMap[emp.shiftType || 'morning'];
        const weekoffDays = shiftConfig?.weekoff || 1;

        let presentCount = 0;
        let halfDayCount = 0;
        let weekOffCount = 0;
        let absentCount = 0;
        let leaveCount = 0;

        // Calculate statistics
        for (let day = 1; day <= totalDays; day++) {
          const date = new Date(targetYear, targetMonth - 1, day);
          const dayOfWeek = date.getDay();
          const record = empAttendance.get(day);
          const empLeaves = leaveMap.get(empId) || [];
          const isOnLeave = empLeaves.some(leave => leave.day === day);
          const isHoliday = holidayMap.has(day);
          const isFuture = date > todayDate;

          let applicableWeekoffDays = weekoffDays;
          let closestRecord = null;
          for (let i = day; i >= 1; i--) {
            if (empAttendance.has(i)) {
              closestRecord = empAttendance.get(i);
              break;
            }
          }
          if (closestRecord) {
            const matchingShift = getInferredShift(closestRecord);
            if (matchingShift) applicableWeekoffDays = matchingShift.weekoff || 1;
          } else {
            for (let i = day + 1; i <= totalDays; i++) {
              if (empAttendance.has(i)) {
                const futureRecord = empAttendance.get(i);
                const matchingShift = getInferredShift(futureRecord);
                if (matchingShift) {
                  applicableWeekoffDays = matchingShift.weekoff || 1;
                  break;
                }
              }
            }
          }

          const isWeekOff = (
            (applicableWeekoffDays >= 1 && dayOfWeek === 0) ||
            (applicableWeekoffDays >= 2 && dayOfWeek === 6) ||
            (applicableWeekoffDays >= 3 && dayOfWeek === 5)
          );

          if (record) {
            const st = (record.status || '').toLowerCase().trim();
            if (st === 'present' || st === 'checked-in' || st === 'early-checkin' || st === 'late-checkin') {
              presentCount++;
            } else if (st === 'half-day') {
              halfDayCount++;
            } else if (st === 'week off' || st === 'week-off') {
              weekOffCount++;
            } else if (st === 'absent' || st === 'not-checkout') {
              absentCount++;
            } else {
              if (record.workingHours >= 8) {
                presentCount++;
              } else if (record.workingHours >= 4) {
                halfDayCount++;
              } else {
                absentCount++;
              }
            }
          } else if (isOnLeave) {
            leaveCount++;
          } else if (isHoliday) {
            weekOffCount++;
          } else if (isFuture) {
            // Future dates don't count as absent
          } else if (isWeekOff) {
            weekOffCount++;
          } else {
            absentCount++;
          }
        }

        const paidDays = presentCount + halfDayCount;

        // Add employee header row
        const startRow = worksheet.lastRow ? worksheet.lastRow.number + 2 : 1;

        // Row 1: EmpCode, Name, and Summary
        const headerRow = worksheet.getRow(startRow);
        headerRow.getCell(1).value = 'EmpCode';
        headerRow.getCell(2).value = 'Name';
        headerRow.getCell(3).value = 'Present';
        headerRow.getCell(4).value = 'HL';
        headerRow.getCell(5).value = 'WO';
        headerRow.getCell(6).value = 'Absent';
        headerRow.getCell(7).value = 'Leave';
        headerRow.getCell(8).value = 'Paid';

        // Style header row
        headerRow.font = { bold: true, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 20;

        // Row 2: Employee data and summary values
        const dataRow = worksheet.getRow(startRow + 1);
        dataRow.getCell(1).value = emp.employeeId;
        dataRow.getCell(2).value = `${emp.firstName} ${emp.lastName}`;
        dataRow.getCell(3).value = presentCount;
        dataRow.getCell(4).value = halfDayCount;
        dataRow.getCell(5).value = weekOffCount;
        dataRow.getCell(6).value = absentCount;
        dataRow.getCell(7).value = leaveCount;
        dataRow.getCell(8).value = paidDays;

        dataRow.font = { size: 10 };
        dataRow.alignment = { vertical: 'middle', horizontal: 'center' };
        dataRow.height = 20;

        // Row 3: Day numbers header
        const dayHeaderRow = worksheet.getRow(startRow + 2);
        for (let day = 1; day <= totalDays; day++) {
          dayHeaderRow.getCell(day + 8).value = String(day).padStart(2, '0');
        }
        dayHeaderRow.font = { bold: true, size: 9 };
        dayHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
        dayHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
        dayHeaderRow.height = 18;

        // Row 4: Arrived Time
        const arrivedRow = worksheet.getRow(startRow + 3);
        arrivedRow.getCell(1).value = 'Arrived Time';
        arrivedRow.getCell(1).font = { bold: true, size: 9 };
        for (let day = 1; day <= totalDays; day++) {
          const record = empAttendance.get(day);
          let value = '—';
          if (record && record.loginTime) {
            const time = new Date(record.loginTime);
            value = time.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
          }
          arrivedRow.getCell(day + 8).value = value;
        }
        arrivedRow.font = { size: 9 };
        arrivedRow.alignment = { vertical: 'middle', horizontal: 'center' };
        arrivedRow.height = 18;

        // Row 5: Dept.Time (Departure Time)
        const deptRow = worksheet.getRow(startRow + 4);
        deptRow.getCell(1).value = 'Dept.Time';
        deptRow.getCell(1).font = { bold: true, size: 9 };
        for (let day = 1; day <= totalDays; day++) {
          const record = empAttendance.get(day);
          let value = '—';
          if (record && record.logoutTime && record.logoutMethod !== 'not-checkout') {
            const time = new Date(record.logoutTime);
            value = time.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
          }
          deptRow.getCell(day + 8).value = value;
        }
        deptRow.font = { size: 9 };
        deptRow.alignment = { vertical: 'middle', horizontal: 'center' };
        deptRow.height = 18;

        // Row 6: Working Hrs.
        const workingRow = worksheet.getRow(startRow + 5);
        workingRow.getCell(1).value = 'Working Hrs.';
        workingRow.getCell(1).font = { bold: true, size: 9 };
        for (let day = 1; day <= totalDays; day++) {
          const record = empAttendance.get(day);
          let value = '00:00';

          // Show N/A for not-checkout cases with 0 working hours
          if (record && record.logoutMethod === 'not-checkout' && (record.workingHours === 0 || !record.workingHours)) {
            value = 'N/A';
          } else if (record && record.workingHours > 0) {
            const hours = Math.floor(record.workingHours);
            const mins = Math.floor((record.workingHours % 1) * 60);
            value = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
          }
          workingRow.getCell(day + 8).value = value;
        }
        workingRow.font = { size: 9 };
        workingRow.alignment = { vertical: 'middle', horizontal: 'center' };
        workingRow.height = 18;

        // Row 7: O.Times Hrs. (Overtime = early login + late logout vs shift times)
        const overtimeRow = worksheet.getRow(startRow + 6);
        overtimeRow.getCell(1).value = 'O.Times Hrs.';
        overtimeRow.getCell(1).font = { bold: true, size: 9 };

        // Parse shift start/end time strings like "07:30 PM" or "09:00 AM" into minutes-from-midnight
        const parseShiftTimeToMinutes = (timeStr) => {
          if (!timeStr) return null;
          // Expected format: "HH:MM AM/PM"
          const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
          if (!match) return null;
          let hours = parseInt(match[1], 10);
          const mins = parseInt(match[2], 10);
          const period = match[3].toUpperCase();
          if (period === 'PM' && hours !== 12) hours += 12;
          if (period === 'AM' && hours === 12) hours = 0;
          return hours * 60 + mins;
        };

        const shiftStartMins = parseShiftTimeToMinutes(shiftConfig?.startTime);
        const shiftEndMins = parseShiftTimeToMinutes(shiftConfig?.endTime);

        for (let day = 1; day <= totalDays; day++) {
          const record = empAttendance.get(day);
          let value = '—';

          if (record && record.loginTime && shiftStartMins !== null) {
            let overtimeMins = 0;

            // Early login overtime: employee arrived before shift start
            const loginDate = new Date(record.loginTime);
            const loginMins = loginDate.getHours() * 60 + loginDate.getMinutes();

            // Handle overnight shifts (e.g. shift starts 7:30 PM = 1170 mins)
            // We need to compare loginMins vs shiftStartMins correctly
            // For night shifts (startTime > endTime in minutes), shift wraps midnight
            const isOvernightShift = shiftStartMins > (shiftEndMins ?? 0);

            if (!isOvernightShift) {
              // Day shift: early arrival = loginMins < shiftStartMins
              if (loginMins < shiftStartMins) {
                overtimeMins += shiftStartMins - loginMins;
              }
            } else {
              // Night/overnight shift: shift starts in evening
              // Early = employee came before shiftStart (same evening)
              // e.g. shift=19:30, login=19:00 → 30 mins early
              if (loginMins < shiftStartMins && loginMins > (shiftEndMins ?? 0)) {
                overtimeMins += shiftStartMins - loginMins;
              }
            }

            // Late logout overtime: employee stayed after shift end
            if (record.logoutTime && record.logoutMethod !== 'not-checkout' && shiftEndMins !== null) {
              const logoutDate = new Date(record.logoutTime);
              const logoutMins = logoutDate.getHours() * 60 + logoutDate.getMinutes();

              if (!isOvernightShift) {
                // Day shift: late logout = logoutMins > shiftEndMins
                if (logoutMins > shiftEndMins) {
                  overtimeMins += logoutMins - shiftEndMins;
                }
              } else {
                // Night shift: shift ends in early morning (e.g. 04:30 AM = 270 mins)
                // Late logout = logoutMins > shiftEndMins (next morning)
                if (logoutMins > shiftEndMins && logoutMins < shiftStartMins) {
                  overtimeMins += logoutMins - shiftEndMins;
                }
              }
            }

            if (overtimeMins > 0) {
              const otHours = Math.floor(overtimeMins / 60);
              const otMins = overtimeMins % 60;
              value = `${String(otHours).padStart(2, '0')}:${String(otMins).padStart(2, '0')}`;
            } else {
              value = '00:00';
            }
          }
          overtimeRow.getCell(day + 8).value = value;
        }
        overtimeRow.font = { size: 9 };
        overtimeRow.alignment = { vertical: 'middle', horizontal: 'center' };
        overtimeRow.height = 18;

        // Row 8: Status
        const statusRow = worksheet.getRow(startRow + 7);
        statusRow.getCell(1).value = 'Status';
        statusRow.getCell(1).font = { bold: true, size: 9 };
        for (let day = 1; day <= totalDays; day++) {
          const date = new Date(targetYear, targetMonth - 1, day);
          const dayOfWeek = date.getDay();
          const record = empAttendance.get(day);
          const empLeaves = leaveMap.get(empId) || [];
          const leaveInfo = empLeaves.find(leave => leave.day === day);
          const isOnLeave = !!leaveInfo;
          const isHoliday = holidayMap.has(day);
          const isFuture = date > todayDate;

          let status = 'A'; // Default absent

          // Priority: Attendance record -> Leave -> Holiday -> Future -> Week Off -> Absent
          // If attendance was explicitly marked/exists, it always wins
          if (record) {
            const st = (record.status || '').toLowerCase().trim();
            if (st === 'absent') {
              status = 'A';
            } else if (st === 'half-day') {
              status = 'P/2';
            } else if (st === 'week off' || st === 'week-off') {
              status = 'WO';
            } else if (st === 'not-checkout') {
              status = 'A';
            } else if (st === 'present' || st === 'checked-in' || st === 'early-checkin' || st === 'late-checkin') {
              // If manually updated / edited or explicit present status
              if (record.editReason || record.method === 'hr-checkin' || record.logoutMethod === 'updated' || st === 'present') {
                status = 'P';
              } else if (record.workingHours >= 8) {
                status = 'P';
              } else if (record.workingHours >= 4) {
                status = 'P/2';
              } else if (record.workingHours > 0) {
                status = 'POW';
              } else {
                status = 'P';
              }
            } else {
              status = 'A';
            }
          } else if (isOnLeave) {
            // Show different leave status based on duration type and category
            if (leaveInfo.durationType === 'Half Day') {
              status = 'L/2';
            } else if (leaveInfo.leaveCategory === 'Unpaid Leave') {
              status = 'UL';
            } else {
              status = 'L';
            }
          } else if (isHoliday) {
            status = 'H';
          } else if (isFuture) {
            status = '—';
          } else if ((weekoffDays >= 1 && dayOfWeek === 0) || (weekoffDays >= 2 && dayOfWeek === 6) || (weekoffDays >= 3 && dayOfWeek === 5)) {
            status = 'WO';
          } else {
            status = 'A';
          }
          statusRow.getCell(day + 8).value = status;
        }
        statusRow.font = { bold: true, size: 9 };
        statusRow.alignment = { vertical: 'middle', horizontal: 'center' };
        statusRow.height = 18;

        // Add borders to all cells in this employee section
        for (let row = startRow; row <= startRow + 7; row++) {
          const currentRow = worksheet.getRow(row);
          for (let col = 1; col <= totalDays + 8; col++) {
            currentRow.getCell(col).border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
          }
        }
      }

      // Set column widths
      worksheet.getColumn(1).width = 12; // EmpCode/Labels
      worksheet.getColumn(2).width = 20; // Name
      worksheet.getColumn(3).width = 8;  // Present
      worksheet.getColumn(4).width = 6;  // HL
      worksheet.getColumn(5).width = 6;  // WO
      worksheet.getColumn(6).width = 8;  // Absent
      worksheet.getColumn(7).width = 8;  // Leave
      worksheet.getColumn(8).width = 8;  // Paid

      // Set width for day columns
      for (let i = 9; i <= totalDays + 8; i++) {
        worksheet.getColumn(i).width = 7;
      }

      const buffer = await workbook.xlsx.writeBuffer();

      res.setHeader('Content-Disposition', `attachment; filename="${exportFilename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);

    } else if (startDate && endDate) {
      // Export by date range - use old format
      let query = {};

      query.date = { $in: getCandidateDates(startDate, endDate) };
      exportFilename = `Attendance_${startDate}_to_${endDate}.xlsx`;
      sheetTitle = 'Attendance';

      // If employeeId is provided and user has full access, filter by that employee
      if (req.query.employeeId && canExportAllEmployees) {
        query.employee = req.query.employeeId;
      } else if (!canExportAllEmployees) {
        query.employee = req.user._id;
      }

      const attendance = await Attendance.find(query)
        .populate('employee', 'firstName lastName employeeId department designation')
        .sort({ date: -1 });

      const data = attendance.map(record => {
        const workingHours = record.workingHours || 0;
        let workingHoursFormatted;

        // Show "N/A" for not-checkout cases with 0 working hours
        if (record.logoutMethod === 'not-checkout' && workingHours === 0) {
          workingHoursFormatted = 'N/A';
        } else if (workingHours > 0) {
          workingHoursFormatted = `${Math.floor(workingHours)}hr ${Math.floor((workingHours % 1) * 60)}mins`;
        } else {
          workingHoursFormatted = '0hr';
        }

        let logoutTime = 'N/A';
        if (record.logoutMethod === 'not-checkout') {
          logoutTime = 'Not Checkout';
        } else if (record.logoutTime) {
          logoutTime = new Date(record.logoutTime).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
          });
        }

        const st = (record.status || '').toLowerCase().trim();
        let displayStatus = 'Absent';
        if (st === 'present' || st === 'checked-in' || st === 'early-checkin' || st === 'late-checkin') {
          displayStatus = 'Present';
        } else if (st === 'half-day') {
          displayStatus = 'Half-day';
        } else if (st === 'week off' || st === 'week-off') {
          displayStatus = 'Week Off';
        } else if (st === 'not-checkout') {
          displayStatus = 'Not Checkout';
        } else if (st === 'absent') {
          displayStatus = 'Absent';
        } else if (workingHours >= 8) {
          displayStatus = 'Present';
        } else if (workingHours >= 4) {
          displayStatus = 'Half-day';
        }

        return {
          'Date': new Date(record.date).toLocaleDateString('en-US', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          }),
          'Employee': record.employee ? `${record.employee.firstName} ${record.employee.lastName}` : 'N/A',
          'Employee ID': record.employee?.employeeId || 'N/A',
          'Department': record.employee?.department || 'N/A',
          'Login Time': record.loginTime
            ? new Date(record.loginTime).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            })
            : 'N/A',
          'Logout Time': logoutTime,
          'Working Hours': workingHoursFormatted,
          'Status': displayStatus,
          'Location': record.location?.address || (record.location?.latitude ? `${record.location.latitude}, ${record.location.longitude}` : 'N/A')
        };
      });

      const wb = xlsx.utils.book_new();
      const ws = xlsx.utils.json_to_sheet(data);

      ws['!cols'] = [
        { wch: 15 }, // Date
        { wch: 25 }, // Employee
        { wch: 15 }, // Employee ID
        { wch: 20 }, // Department
        { wch: 15 }, // Login Time
        { wch: 15 }, // Logout Time
        { wch: 18 }, // Working Hours
        { wch: 12 }, // Status
        { wch: 30 }  // Location
      ];

      xlsx.utils.book_append_sheet(wb, ws, sheetTitle);

      const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Disposition', `attachment; filename="${exportFilename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } else {
      return res.status(400).json({ message: 'Please provide either month/year or start/end date' });
    }

  } catch (error) {
    console.error('Error exporting attendance:', error);
    res.status(500).json({ message: 'Error exporting attendance' });
  }
});

// Export Attendance to Word
router.get('/export/word', auth, async (req, res) => {
  try {
    const restrictedRolesWord = ['Developer', 'Sales', 'Marketing'];
    const hasFullAccess = !restrictedRolesWord.includes(req.user.role.name) && req.user.role.permissions.find(
      p => p.module === 'employees' && p.actions.includes('read')
    );

    let query = {};

    if (req.query.employeeId && hasFullAccess) {
      query.employee = req.query.employeeId;
    } else if (!hasFullAccess) {
      query.employee = req.user._id;
    }

    const { startDate, endDate } = req.query;
    if (startDate && endDate) {
      query.date = { $in: getCandidateDates(startDate, endDate) };
    }

    const attendance = await Attendance.find(query)
      .populate('employee', 'firstName lastName employeeId')
      .sort({ date: -1 });

    // Create table rows
    const tableRows = [
      // Header row
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Date', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Employee', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Login Time', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Logout Time', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Working Hours', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Status', bold: true })] }),
        ],
      }),
      // Data rows
      ...attendance.map(record => {
        let workingHours;

        // Show N/A for not-checkout cases with 0 working hours
        if (record.logoutMethod === 'not-checkout' && (record.workingHours === 0 || !record.workingHours)) {
          workingHours = 'N/A';
        } else {
          workingHours = record.workingHours || (record.loginTime && !record.logoutTime ? Math.round((new Date() - new Date(record.loginTime)) / (1000 * 60 * 60) * 100) / 100 : 0);
        }

        const logoutDisplay = record.logoutMethod === 'not-checkout' ? 'Not Checkout' : (record.logoutTime ? new Date(record.logoutTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }) : 'N/A');
        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(new Date(record.date).toLocaleDateString())] }),
            new TableCell({ children: [new Paragraph(record.employee ? `${record.employee.firstName} ${record.employee.lastName} (${record.employee.employeeId})` : 'N/A')] }),
            new TableCell({
              children: [new Paragraph(record.loginTime ? new Date(record.loginTime).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              }) : 'N/A')]
            }),
            new TableCell({ children: [new Paragraph(logoutDisplay)] }),
            new TableCell({ children: [new Paragraph(workingHours.toString())] }),
            new TableCell({ children: [new Paragraph(record.status || 'N/A')] }),
          ],
        });
      }),
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'Attendance Report',
            heading: 'Heading1',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            spacing: { after: 200 },
          }),
          ...(startDate && endDate ? [new Paragraph({
            text: `Period: ${startDate} to ${endDate}`,
            spacing: { after: 200 },
          })] : []),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Disposition', 'attachment; filename="attendance.docx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting Word:', error);
    res.status(500).json({ message: 'Error exporting Word document' });
  }
});

// Get today's attendance for current user
router.get('/today', auth, async (req, res) => {
  try {
    const shiftInfo = getCurrentShiftInfo(req.user);
    const today = shiftInfo.shiftDate;

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today
    }).populate('updatedBy', 'firstName lastName');

    res.json(attendance || null);
  } catch (error) {
    console.error('Error fetching today attendance:', error);
    res.status(500).json({ message: 'Error fetching attendance' });
  }
});

// Get personal attendance statistics for current month
router.get('/my-stats', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user._id);

    // Fetch ShiftConfig to get weekoff dynamically
    const ShiftConfig = require('../models/ShiftConfig');
    let weekoffCount = 1;
    try {
      const shiftConfig = await ShiftConfig.findOne({ type: user?.shiftType });
      if (shiftConfig && shiftConfig.weekoff) {
        weekoffCount = shiftConfig.weekoff;
      }
    } catch (err) {
      console.error('Error fetching shift config:', err);
    }

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    firstDayOfMonth.setHours(0, 0, 0, 0);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    lastDayOfMonth.setHours(23, 59, 59, 999);

    const attendance = await Attendance.find({
      employee: req.user._id,
      date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
    });

    const stats = {
      presentDays: 0,
      absentDays: 0,
      halfDays: 0,
      lateMarks: 0
    };

    // Count working days in the current month up to today
    let workingDaysCount = 0;
    const currentDate = new Date(firstDayOfMonth);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    while (currentDate <= today && currentDate <= lastDayOfMonth) {
      const dayOfWeek = currentDate.getDay();

      let isOffDay = false;
      if (weekoffCount === 1) {
        isOffDay = (dayOfWeek === 0);
      } else if (weekoffCount === 2) {
        isOffDay = (dayOfWeek === 0 || dayOfWeek === 6);
      } else if (weekoffCount >= 3) {
        isOffDay = (dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 5);
      }

      if (!isOffDay) {
        workingDaysCount++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process attendance records
    attendance.forEach(record => {
      if (record.status === 'present') {
        stats.presentDays++;
        // Check if late (after 10:00 AM)
        if (record.loginTime) {
          const loginHour = new Date(record.loginTime).getHours();
          const loginMinute = new Date(record.loginTime).getMinutes();
          if (loginHour > 10 || (loginHour === 10 && loginMinute > 0)) {
            stats.lateMarks++;
          }
        }
      } else if (record.status === 'half-day') {
        stats.halfDays++;
      } else {
        stats.absentDays++;
      }
    });

    // Calculate absent days as: total working days - (present + half days)
    // This accounts for days with no attendance record
    const recordedDays = stats.presentDays + stats.halfDays + stats.absentDays;
    if (workingDaysCount > recordedDays) {
      stats.absentDays += (workingDaysCount - recordedDays);
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching personal attendance stats:', error);
    res.status(500).json({ message: 'Error fetching attendance stats' });
  }
});

// Get today's attendance stats (present/absent counts)
router.get('/today-stats', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const Role = require('../models/Role');
    const user = await User.findById(req.user.id).populate('role');

    // Check if user is Admin, HR, or Manager
    const isAdminHRManager =
      user.role.name === 'Admin' ||
      user.role.name === 'HR' ||
      user.role.name === 'Manager' ||
      user.role.name === 'HR Manager';

    if (isAdminHRManager) {
      // Admin/HR/Manager: Return today's total employee stats (excluding Admin users)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      // Get Admin role ID
      const adminRole = await Role.findOne({ name: 'Admin' });

      // Get all active employees excluding Admin role
      const activeEmployees = await User.countDocuments({
        isActive: true,
        role: { $ne: adminRole?._id }
      });

      // Get attendance records for today
      const todayAttendance = await Attendance.find({
        date: { $gte: today, $lte: todayEnd },
        loginTime: { $exists: true, $ne: null }
      }).populate('employee');

      // Filter out Admin users from present count
      const presentCount = todayAttendance.filter(record => {
        return record.employee && record.employee.role &&
          record.employee.role.toString() !== adminRole?._id.toString();
      }).length;

      // Absent = all active employees (excluding Admin) who have NOT checked in today
      const absentCount = Math.max(0, activeEmployees - presentCount);

      res.json({
        presentToday: presentCount,
        absentToday: absentCount,
        totalActive: activeEmployees,
        type: 'today' // Indicates this is today's stats
      });
    } else {
      // Regular Employee: Return their monthly present/absent stats
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      firstDayOfMonth.setHours(0, 0, 0, 0);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      lastDayOfMonth.setHours(23, 59, 59, 999);

      const attendance = await Attendance.find({
        employee: req.user._id,
        date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
      });

      const stats = {
        presentDays: 0,
        absentDays: 0,
        halfDays: 0
      };

      // Count working days in the current month up to today
      let workingDaysCount = 0;
      const currentDate = new Date(firstDayOfMonth);
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      // Fetch ShiftConfig to get weekoff dynamically
      const ShiftConfig = require('../models/ShiftConfig');
      let weekoffCount = 1;
      try {
        const shiftConfig = await ShiftConfig.findOne({ type: user?.shiftType });
        if (shiftConfig && shiftConfig.weekoff) {
          weekoffCount = shiftConfig.weekoff;
        }
      } catch (err) {
        console.error('Error fetching shift config:', err);
      }

      // Fetch Holidays
      const Holiday = require('../models/Holiday');
      let holidayDates = [];
      try {
        const holidays = await Holiday.find({
          date: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
        });
        holidayDates = holidays.map(h => {
          const d = new Date(h.date);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        });
      } catch (err) {
        console.error('Error fetching holidays:', err);
      }

      // Fetch Approved Leaves
      const Leave = require('../models/Leave');
      const leaveDates = new Set();
      try {
        const leaves = await Leave.find({
          employee: req.user._id,
          status: 'approved',
          durationType: 'Full Day', // Only exclude full day leaves from expected working days
          $or: [
            { startDate: { $lte: lastDayOfMonth }, endDate: { $gte: firstDayOfMonth } }
          ]
        });
        leaves.forEach(leave => {
          let d = new Date(leave.startDate);
          const endD = new Date(leave.endDate);
          while (d <= endD) {
            leaveDates.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
            d.setDate(d.getDate() + 1);
          }
        });
      } catch (err) {
        console.error('Error fetching leaves:', err);
      }

      while (currentDate <= today && currentDate <= lastDayOfMonth) {
        const dayOfWeek = currentDate.getDay();
        const dateStr = `${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDate()}`;

        let isOffDay = false;
        if (weekoffCount === 1) {
          isOffDay = (dayOfWeek === 0);
        } else if (weekoffCount === 2) {
          isOffDay = (dayOfWeek === 0 || dayOfWeek === 6);
        } else if (weekoffCount >= 3) {
          isOffDay = (dayOfWeek === 0 || dayOfWeek === 6 || dayOfWeek === 5);
        }

        if (holidayDates.includes(dateStr) || leaveDates.has(dateStr)) {
          isOffDay = true;
        }

        if (!isOffDay) {
          workingDaysCount++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Process attendance records
      attendance.forEach(record => {
        if (record.status === 'present') {
          stats.presentDays++;
        } else if (record.status === 'half-day') {
          stats.halfDays++;
        } else {
          stats.absentDays++;
        }
      });

      // Calculate absent days as: total working days - (present + half days)
      const recordedDays = stats.presentDays + stats.halfDays + stats.absentDays;
      if (workingDaysCount > recordedDays) {
        stats.absentDays += (workingDaysCount - recordedDays);
      }

      res.json({
        presentToday: stats.presentDays, // Monthly present count
        absentToday: stats.absentDays,   // Monthly absent count
        totalActive: workingDaysCount,   // Total working days in month
        type: 'monthly' // Indicates this is monthly stats
      });
    }
  } catch (error) {
    console.error('Error fetching today attendance stats:', error);
    res.status(500).json({ message: 'Error fetching attendance stats' });
  }
});

// Get list of present or absent employees today
router.get('/today-list', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const Role = require('../models/Role');
    const { type } = req.query; // 'present' or 'absent'

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // Get Admin role ID
    const adminRole = await Role.findOne({ name: 'Admin' });

    if (type === 'present') {
      const records = await Attendance.find({
        date: { $gte: today, $lte: todayEnd },
        loginTime: { $exists: true, $ne: null }
      }).populate({
        path: 'employee',
        select: 'firstName lastName employeeId designation department role',
        populate: {
          path: 'role',
          select: 'name'
        }
      });

      // Filter out Admin users
      const employees = records
        .filter(r => r.employee && r.employee.role && r.employee.role.name !== 'Admin')
        .map(r => ({
          _id: r.employee?._id,
          firstName: r.employee?.firstName,
          lastName: r.employee?.lastName,
          employeeId: r.employee?.employeeId,
          designation: r.employee?.designation,
          department: r.employee?.department,
          loginTime: r.loginTime,
          logoutTime: r.logoutTime,
          workingHours: r.workingHours,
        }));
      return res.json(employees);
    }

    if (type === 'absent') {
      const presentRecords = await Attendance.find({
        date: { $gte: today, $lte: todayEnd },
        loginTime: { $exists: true, $ne: null }
      }).select('employee');
      const presentIds = presentRecords.map(r => r.employee?.toString()).filter(Boolean);

      // Get absent employees excluding Admin role
      const absentEmployees = await User.find({
        isActive: true,
        _id: { $nin: presentIds },
        role: { $ne: adminRole?._id }
      }).select('firstName lastName employeeId designation department');

      return res.json(absentEmployees);
    }

    res.status(400).json({ message: 'type must be present or absent' });
  } catch (error) {
    console.error('Error fetching today employee list:', error);
    res.status(500).json({ message: 'Error fetching today employee list' });
  }
});

// Get monthly stats with trends for employee dashboard
router.get('/monthly-stats', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Current month
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Get current month attendance
    const currentMonthAttendance = await Attendance.find({
      employee: userId,
      date: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });

    // Get last month attendance
    const lastMonthAttendance = await Attendance.find({
      employee: userId,
      date: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    // Calculate current month stats
    const currentPresent = currentMonthAttendance.filter(a => a.status === 'present').length;
    const currentAbsent = currentMonthAttendance.filter(a => a.status === 'absent').length;
    const currentHalfDay = currentMonthAttendance.filter(a => a.status === 'half-day').length;

    // Calculate last month stats
    const lastPresent = lastMonthAttendance.filter(a => a.status === 'present').length;
    const lastAbsent = lastMonthAttendance.filter(a => a.status === 'absent').length;
    const lastHalfDay = lastMonthAttendance.filter(a => a.status === 'half-day').length;

    // Calculate trends (percentage change)
    const calculateTrend = (current, last) => {
      if (last === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - last) / last) * 100);
    };

    // Get projects data
    const Project = require('../models/Project');

    // Assigned projects (active)
    const assignedProjects = await Project.countDocuments({
      $or: [
        { assignedEmployees: userId },
        { createdBy: userId }
      ],
      status: { $in: ['active', 'on-hold'] }
    });

    const lastMonthAssignedProjects = await Project.countDocuments({
      $or: [
        { assignedEmployees: userId },
        { createdBy: userId }
      ],
      status: { $in: ['active', 'on-hold'] },
      createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    // Completed projects this month
    const completedProjects = await Project.countDocuments({
      $or: [
        { assignedEmployees: userId },
        { createdBy: userId }
      ],
      status: 'completed',
      updatedAt: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });

    const lastMonthCompletedProjects = await Project.countDocuments({
      $or: [
        { assignedEmployees: userId },
        { createdBy: userId }
      ],
      status: 'completed',
      updatedAt: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    // Get leaves data
    const Leave = require('../models/Leave');

    const totalLeaves = await Leave.countDocuments({
      employee: userId,
      status: { $in: ['approved', 'pending'] },
      startDate: { $gte: currentMonthStart, $lte: currentMonthEnd }
    });

    const lastMonthLeaves = await Leave.countDocuments({
      employee: userId,
      status: { $in: ['approved', 'pending'] },
      startDate: { $gte: lastMonthStart, $lte: lastMonthEnd }
    });

    res.json({
      currentMonth: {
        present: currentPresent,
        absent: currentAbsent,
        halfDay: currentHalfDay,
        assignedProjects,
        completedProjects,
        totalLeaves
      },
      lastMonth: {
        present: lastPresent,
        absent: lastAbsent,
        halfDay: lastHalfDay,
        assignedProjects: lastMonthAssignedProjects,
        completedProjects: lastMonthCompletedProjects,
        totalLeaves: lastMonthLeaves
      },
      trends: {
        present: calculateTrend(currentPresent, lastPresent),
        absent: calculateTrend(currentAbsent, lastAbsent),
        assignedProjects: calculateTrend(assignedProjects, lastMonthAssignedProjects),
        completedProjects: calculateTrend(completedProjects, lastMonthCompletedProjects),
        totalLeaves: calculateTrend(totalLeaves, lastMonthLeaves)
      }
    });
  } catch (error) {
    console.error('Error fetching monthly stats:', error);
    res.status(500).json({ message: 'Error fetching monthly stats' });
  }
});

// Mark attendance (automatically called when first goal is created)
// Office location & geofencing
const OFFICE_LAT = 28.62886;
const OFFICE_LNG = 77.38141;
const CHECKIN_RADIUS_METERS = 40; // allow within 40m of office
const CHECKOUT_RADIUS_METERS = 40; // allow checkout within 40m of office

function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in metres
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.post('/mark', auth, async (req, res) => {
  try {
    const { method = 'self-checkin', location, selfieImage, lateReason } = req.body;
    const checkInTime = new Date();
    const shiftInfo = getCurrentShiftInfo(req.user, checkInTime);
    const today = shiftInfo.shiftDate;

    // Fetch AttendanceConfig for check-in window open and close times
    const AttendanceConfig = require('../models/AttendanceConfig');
    const dbConfig = await AttendanceConfig.findOne({ isActive: true });
    const markLateAfter = dbConfig && dbConfig.markLateAfter !== undefined ? dbConfig.markLateAfter : 0.25;
    const checkinWindowBefore = dbConfig && dbConfig.checkinWindowBefore !== undefined ? dbConfig.checkinWindowBefore : 15;

    // Check-in window: opens at admin-configured minutes before shift start.
    const windowStart = new Date(shiftInfo.shiftStart.getTime() - (checkinWindowBefore * 60000));
    // Mark Present Till threshold
    const markPresentTill = new Date(shiftInfo.shiftStart.getTime() + (markLateAfter * 60 * 60000));

    if (checkInTime < windowStart) {
      const formattedWindowStart = windowStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const shiftStartStr = shiftInfo.shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return res.status(403).json({
        message: `Check-in Unavailable: Your assigned shift starts at ${shiftStartStr}. The check-in window opens at ${formattedWindowStart}. Please perform check-in once the window opens.`
      });
    }

    // Geofence: require location and check distance from office
    if (!location || !location.latitude || !location.longitude) {
      return res.status(403).json({ message: 'Location is required to check in. Please enable location access.' });
    }

    const distance = getDistanceMeters(
      parseFloat(location.latitude),
      parseFloat(location.longitude),
      OFFICE_LAT,
      OFFICE_LNG
    );

    if (distance > CHECKIN_RADIUS_METERS) {
      return res.status(403).json({
        message: `Check-in is only allowed from the office. You are ${Math.round(distance)} m away (allowed: ${CHECKIN_RADIUS_METERS} m).`
      });
    }

    let attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today
    });

    if (attendance) {
      return res.status(400).json({
        message: 'You have already checked in for this shift',
        attendance: attendance
      });
    }

    // Determine status: if checkin is after markPresentTill, mark as late-checkin
    let status = 'checked-in';
    if (checkInTime > markPresentTill) {
      status = 'late-checkin';
      if (!lateReason || !lateReason.trim()) {
        return res.status(400).json({
          message: 'Late check-in reason is required. Please provide a reason for checking in late.'
        });
      }
    } else if (checkInTime < shiftInfo.shiftStart) {
      status = 'early-checkin';
    }

    const ShiftConfig = require('../models/ShiftConfig');
    let resolvedShiftStart = req.user.shiftStartTime;
    let resolvedShiftEnd = req.user.shiftEndTime;
    if (!resolvedShiftStart || !resolvedShiftEnd) {
      const shiftConfig = await ShiftConfig.findOne({ type: req.user.shiftType || 'morning' });
      if (shiftConfig) {
        resolvedShiftStart = resolvedShiftStart || shiftConfig.startTime;
        resolvedShiftEnd = resolvedShiftEnd || shiftConfig.endTime;
      }
    }

    // On check-in, status = 'checked-in'/'late-checkin' — final status calculated at checkout
    const attendanceData = {
      employee: req.user._id,
      date: today,
      loginTime: checkInTime,
      shiftStartTime: resolvedShiftStart || '09:00 AM',
      shiftEndTime: resolvedShiftEnd || '06:00 PM',
      status: status,
      method: method,
      lateReason: lateReason ? lateReason.trim() : null
    };

    if (location && location.latitude && location.longitude) {
      attendanceData.location = {
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || 'Unknown'
      };
    }

    attendance = await Attendance.create(attendanceData);
    await attendance.populate('employee', 'firstName lastName employeeId');

    try {
      const Selfie = require('../models/Selfie');
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      let existingSelfie = await Selfie.findOne({
        employee: req.user._id,
        attendance: { $exists: false },
        createdAt: { $gte: startOfDay }
      });

      if (existingSelfie) {
        existingSelfie.attendance = attendance._id;
        await existingSelfie.save();
        console.log(`[Check-in] Linked existing selfie for employee: ${req.user.employeeId}`);
      } else if (selfieImage) {
        await Selfie.create({
          attendance: attendance._id,
          employee: req.user._id,
          image: selfieImage
        });
        console.log(`[Check-in] Selfie saved for employee: ${req.user.employeeId}`);
      }
    } catch (err) {
      console.error('[Check-in] Error handling selfie:', err);
    }

    // Clean up previous records for activities (Active Time, Idle Time, etc) when starting a new shift
    try {
      const Activity = require('../models/Activity');
      await Activity.deleteMany({ employeeId: req.user.employeeId });
      console.log(`[Check-in] Cleared past activities for employee: ${req.user.employeeId}`);
    } catch (err) {
      console.error('[Check-in] Error clearing past activities:', err);
    }

    // Emit socket.io event to the employee's tracking client
    const io = req.app.get('socketio');
    if (io) {
      console.log(`[Socket.IO] Tracking Started for employee: ${req.user.employeeId}`);
      io.to(`user:${req.user._id.toString()}`).emit('attendance-status-changed', {
        action: 'start-tracking',
        status: status,
        loginTime: attendance.loginTime,
        employeeId: req.user.employeeId
      });
    }

    res.json(attendance);
  } catch (error) {
    console.error('Error marking attendance:', error);
    res.status(500).json({ message: 'Error marking attendance' });
  }
});

// HR marks attendance for employee
router.post('/mark-employee', auth, async (req, res) => {
  try {
    const hasPermission = req.user.role.permissions.find(
      p => p.module === 'employees' && p.actions.includes('update')
    );

    if (!hasPermission) {
      return res.status(403).json({ message: 'Not authorized to mark attendance for employees' });
    }

    const { employeeId, date, location } = req.body;

    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }

    const User = require('../models/User');
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const checkInTime = new Date();
    const shiftInfo = getCurrentShiftInfo(employee, date ? new Date(date) : checkInTime);
    const attendanceDate = shiftInfo.shiftDate;

    let attendance = await Attendance.findOne({
      employee: employeeId,
      date: attendanceDate
    });

    if (!attendance) {
      // Determine status (checked-in vs late-checkin vs early-checkin)
      const AttendanceConfig = require('../models/AttendanceConfig');
      const dbConfig = await AttendanceConfig.findOne({ isActive: true });
      const markLateAfter = dbConfig && dbConfig.markLateAfter !== undefined ? dbConfig.markLateAfter : 0.25;

      const timeDiffMs = checkInTime.getTime() - shiftInfo.shiftStart.getTime();
      const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

      let status = 'checked-in';
      if (timeDiffHours > markLateAfter) {
        status = 'late-checkin';
      } else if (timeDiffMs < 0) {
        status = 'early-checkin';
      }

      // On check-in, status = 'checked-in'/'late-checkin' — final status calculated at checkout
      const attendanceData = {
        employee: employeeId,
        date: attendanceDate,
        loginTime: checkInTime,
        shiftStartTime: employee.shiftStartTime || '09:00 AM',
        shiftEndTime: employee.shiftEndTime || '06:00 PM',
        status: status,
        method: 'hr-checkin'
      };

      if (location && location.latitude && location.longitude) {
        attendanceData.location = {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address || 'Unknown'
        };
      }

      attendance = await Attendance.create(attendanceData);
    } else {
      return res.status(400).json({ message: 'Attendance already marked for this employee today' });
    }

    await attendance.populate('employee', 'firstName lastName employeeId');

    // Clean up previous records for activities (Active Time, Idle Time, etc) when starting a new shift
    try {
      const Activity = require('../models/Activity');
      await Activity.deleteMany({ employeeId: attendance.employee?.employeeId });
      console.log(`[HR Check-in] Cleared past activities for employee: ${attendance.employee?.employeeId}`);
    } catch (err) {
      console.error('[HR Check-in] Error clearing past activities:', err);
    }

    // Emit socket.io event to the employee's tracking client
    const io = req.app.get('socketio');
    if (io) {
      console.log(`[Socket.IO] Tracking Started for employee: ${attendance.employee?.employeeId}`);
      io.to(`user:${employeeId}`).emit('attendance-status-changed', {
        action: 'start-tracking',
        status: attendance.status || 'checked-in',
        loginTime: attendance.loginTime,
        employeeId: attendance.employee?.employeeId
      });
    }

    res.json(attendance);
  } catch (error) {
    console.error('Error marking employee attendance:', error);
    res.status(500).json({ message: 'Error marking employee attendance' });
  }
});

// Check out (mark logout time and auto-calculate status)
router.post('/checkout', auth, async (req, res) => {
  try {
    const { location } = req.body;

    // Geofence: require location and check distance from office
    if (!location || !location.latitude || !location.longitude) {
      return res.status(403).json({ message: 'Location is required to check out. Please enable location access.' });
    }

    const distance = getDistanceMeters(
      parseFloat(location.latitude),
      parseFloat(location.longitude),
      OFFICE_LAT,
      OFFICE_LNG
    );

    if (distance > CHECKOUT_RADIUS_METERS) {
      return res.status(403).json({
        message: `Check-out is only allowed from the office. You are ${Math.round(distance)} m away (allowed: ${CHECKOUT_RADIUS_METERS} m).`
      });
    }
    const shiftInfo = getCurrentShiftInfo(req.user);
    const today = shiftInfo.shiftDate;

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today
    }).populate('employee');

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for active shift' });
    }

    if (attendance.logoutTime) {
      return res.status(400).json({ message: 'Already checked out for today' });
    }

    // Verify checkout selfie
    const Selfie = require('../models/Selfie');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const existingSelfie = await Selfie.findOne({
      employee: req.user._id,
      createdAt: { $gte: startOfDay }
    }).sort({ createdAt: -1 });

    if (!existingSelfie || !existingSelfie.checkOutImage) {
      return res.status(403).json({ message: 'Please upload a checkout selfie before checking out.' });
    }

    const logoutTime = new Date();

    // Auto-close any active breaks when checking out
    if (attendance.breaks && attendance.breaks.length > 0) {
      attendance.breaks.forEach(b => {
        if (!b.endTime) {
          b.endTime = logoutTime;
          b.duration = Math.round((logoutTime - b.startTime) / 60000);
        }
      });
    }

    let config = { lunchBreakLimit: 30, teaBreakLimit: 15, checkoutGracePeriod: 20, markLateAfter: 0.25 };
    try {
      const AttendanceConfigModel = require('../models/AttendanceConfig');
      const dbConfig = await AttendanceConfigModel.findOne({ isActive: true });
      if (dbConfig) {
        config.lunchBreakLimit = dbConfig.lunchBreakLimit;
        config.teaBreakLimit = dbConfig.teaBreakLimit;
        config.checkoutGracePeriod = dbConfig.checkoutGracePeriod !== undefined ? dbConfig.checkoutGracePeriod : 20;
        config.markLateAfter = dbConfig.markLateAfter !== undefined ? dbConfig.markLateAfter : 0.25;
      }
    } catch (e) { console.warn('[checkout] Could not fetch AttendanceConfig:', e.message); }

    // Use the shift configuration locked into the attendance record, NOT the user's current profile
    const historicalShiftUser = {
      shiftStartTime: attendance.shiftStartTime,
      shiftEndTime: attendance.shiftEndTime
    };

    // Calculate the shift end time based on the locked-in attendance record
    const historicalShiftInfo = getCurrentShiftInfo(historicalShiftUser, logoutTime);

    const maxCheckoutTime = new Date(historicalShiftInfo.shiftEnd.getTime() + (config.checkoutGracePeriod * 60000));
    const effectiveLogoutTime = logoutTime > maxCheckoutTime ? maxCheckoutTime : logoutTime;

    const workingHours = calculateWorkingHours(attendance.loginTime, logoutTime, attendance.breaks, config, historicalShiftInfo.shiftEnd, historicalShiftInfo.shiftStart, attendance.status);

    // Calculate final status: needs checkout + working hours rule
    const status = await calculateFinalAttendanceStatus(attendance.loginTime, logoutTime, attendance.breaks, historicalShiftInfo.shiftEnd, historicalShiftInfo.shiftStart);

    attendance.logoutTime = logoutTime;
    attendance.workingHours = Math.round(Math.max(0, workingHours) * 100) / 100;
    attendance.status = status;
    attendance.logoutMethod = 'self-logout';

    await attendance.save();
    await attendance.populate('employee', 'firstName lastName employeeId');

    // Emit socket.io event to the employee's tracking client
    const io = req.app.get('socketio');
    if (io) {
      console.log(`[Socket.IO] Tracking Stopped for employee: ${req.user.employeeId}`);
      io.to(`user:${req.user._id.toString()}`).emit('attendance-status-changed', {
        action: 'stop-tracking',
        status: 'checked-out',
        logoutTime: attendance.logoutTime,
        employeeId: req.user.employeeId
      });
    }

    res.json(attendance);
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({ message: 'Error checking out' });
  }
});

// Update attendance status (for HR/Manager/Admin to update any employee's attendance)
// NOTE: This route MUST come before /:id route to avoid routing conflicts
router.put('/update-status', auth, async (req, res) => {
  try {
    const { employeeId, date, status, loginTime, logoutTime, workingHours, isNewRecord, editReason } = req.body;

    // Validate required fields
    if (!employeeId || !date) {
      return res.status(400).json({ message: 'Employee ID and date are required' });
    }

    // Validate status if provided
    if (status && !['present', 'absent', 'half-day', 'checked-in', 'late-checkin', 'early-checkin', 'week off'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    // Parse date and create date range for the entire day
    // This handles timezone issues by matching any record on the same calendar day
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const attendanceDateEnd = new Date(date);
    attendanceDateEnd.setHours(23, 59, 59, 999);

    console.log(`[Update Attendance] Request received`);
    console.log(`[Update Attendance] Employee ID: ${employeeId}`);
    console.log(`[Update Attendance] Date received: ${date}`);
    console.log(`[Update Attendance] Date range: ${attendanceDate.toISOString()} to ${attendanceDateEnd.toISOString()}`);
    console.log(`[Update Attendance] Status: ${status || 'not provided'}`);
    console.log(`[Update Attendance] Login time: ${loginTime || 'not provided'}`);
    console.log(`[Update Attendance] Logout time: ${logoutTime || 'not provided'}`);
    console.log(`[Update Attendance] Is new record: ${isNewRecord || 'not specified'}`);

    // Find existing attendance record using date range to handle timezone issues
    let attendance = await Attendance.findOne({
      employee: employeeId,
      date: { $gte: attendanceDate, $lte: attendanceDateEnd }
    });

    console.log(`[Update Attendance] Existing record found: ${attendance ? 'YES (ID: ' + attendance._id + ', Date: ' + attendance.date.toISOString() + ')' : 'NO - will create new'}`);

    if (status === 'week off') {
      if (attendance) {
        await Attendance.findByIdAndDelete(attendance._id);
        return res.json({ message: 'Attendance reverted to Week Off', attendance: { _id: attendance._id, date: attendance.date, status: 'Week Off' } });
      }
      return res.json({ message: 'Already a Week Off', attendance: { date: attendanceDate, status: 'Week Off' } });
    }

    if (!attendance) {
      // Creating new record - check for CREATE permission
      const hasCreatePermission = req.user.role.permissions.find(
        p => p.module === 'attendance' && p.actions.includes('create')
      );

      if (!hasCreatePermission && req.user.role.name !== 'Admin' && req.user.role.name !== 'Director') {
        return res.status(403).json({ message: 'Not authorized to create attendance records' });
      }

      // Create new attendance record if it doesn't exist
      console.log(`[Update Attendance] No existing record found, creating new one`);

      const User = require('../models/User');
      const emp = await User.findById(employeeId);

      const attendanceData = {
        employee: employeeId,
        date: attendanceDate,
        method: 'hr-checkin',
        shiftStartTime: emp?.shiftStartTime || '09:00 AM',
        shiftEndTime: emp?.shiftEndTime || '06:00 PM',
        status: status || 'present',
        editReason: editReason || null,
        location: {
          latitude: OFFICE_LAT,
          longitude: OFFICE_LNG,
          address: 'Office'
        }
      };

      if (loginTime) {
        attendanceData.loginTime = new Date(loginTime);

        // If no manual status provided and logout time is also provided, calculate based on working hours
        if (!status && logoutTime) {
          attendanceData.status = await calculateFinalAttendanceStatus(new Date(loginTime), new Date(logoutTime), []);
        }
      }

      if (logoutTime) {
        attendanceData.logoutTime = new Date(logoutTime);
        attendanceData.logoutMethod = 'updated';
      }
      attendanceData.updatedBy = req.user._id;

      // Only use provided working hours if both times are not available
      if (workingHours !== undefined && workingHours !== null && workingHours !== '') {
        if (!loginTime || !logoutTime) {
          attendanceData.workingHours = parseFloat(workingHours);
        }
      }

      // Auto-calculate working hours if both times are provided
      if (loginTime && logoutTime) {
        let loginDate = new Date(loginTime);
        let logoutDate = new Date(logoutTime);
        if (logoutDate < loginDate) {
          logoutDate.setDate(logoutDate.getDate() + 1);
          attendanceData.logoutTime = logoutDate;
        }
        const hours = (logoutDate - loginDate) / (1000 * 60 * 60);
        attendanceData.workingHours = Math.round(hours * 100) / 100;
      }

      // Add initial history entry for new records
      attendanceData.editHistory = [{
        updatedBy: req.user._id,
        updatedAt: new Date(),
        oldStatus: null,
        newStatus: status || 'present',
        reason: editReason,
        changeType: 'created'
      }];

      console.log(`[Update Attendance] Creating with data:`, attendanceData);
      attendance = await Attendance.create(attendanceData);
      console.log(`[Update Attendance] Record created with ID: ${attendance._id}`);
    } else {
      // Updating existing record - check for UPDATE permission
      const hasUpdatePermission = req.user.role.permissions.find(
        p => p.module === 'attendance' && p.actions.includes('update')
      );

      if (!hasUpdatePermission && req.user.role.name !== 'Admin' && req.user.role.name !== 'Director') {
        return res.status(403).json({ message: 'Not authorized to update attendance records' });
      }

      // If this was intended to be a new record creation, return error
      if (isNewRecord === true) {
        return res.status(409).json({
          message: 'Attendance record already exists for this employee on this date. Please edit the existing record instead.',
          existingRecord: true
        });
      }

      // Update existing attendance record
      console.log(`[Update Attendance] Updating existing record ID: ${attendance._id}`);

      const updateData = {};

      // Only update oldStatus if we're actually changing the status
      // This preserves the original status transition
      if (status && status !== attendance.status) {
        updateData.oldStatus = attendance.status;
        updateData.status = status;
      } else if (status) {
        // If status is provided but unchanged, just update status (keep oldStatus as is)
        updateData.status = status;
      }

      if (editReason) {
        updateData.editReason = editReason;
      }

      if (loginTime) {
        updateData.loginTime = new Date(loginTime);
      }

      if (logoutTime) {
        updateData.logoutTime = new Date(logoutTime);
        updateData.logoutMethod = 'updated';
      } else if (attendance.logoutTime) {
        updateData.logoutMethod = 'updated';
      }
      updateData.updatedBy = req.user._id;

      // Auto-populate location with office location if missing or not set
      if (!attendance.location || (!attendance.location.latitude && !attendance.location.longitude)) {
        updateData.location = {
          latitude: OFFICE_LAT,
          longitude: OFFICE_LNG,
          address: 'Office'
        };
      }

      // Determine final login and logout for calculation
      const finalLogin = loginTime ? new Date(loginTime) : (attendance.loginTime ? new Date(attendance.loginTime) : null);
      const finalLogout = logoutTime ? new Date(logoutTime) : (attendance.logoutTime ? new Date(attendance.logoutTime) : null);

      // Auto-calculate working hours if both times exist
      if (finalLogin && finalLogout) {
        let loginDate = new Date(finalLogin);
        let logoutDate = new Date(finalLogout);

        // Handle overnight shifts: if logout is before login, add 24 hours (1 day) to logout
        if (logoutDate < loginDate) {
          logoutDate.setDate(logoutDate.getDate() + 1);
          updateData.logoutTime = logoutDate;
        }

        let wcConfig = { lunchBreakLimit: 30, teaBreakLimit: 15, markLateAfter: 0.25 };
        try {
          const AttendanceConfigModel = require('../models/AttendanceConfig');
          const dbConf = await AttendanceConfigModel.findOne({ isActive: true });
          if (dbConf) { 
            wcConfig.lunchBreakLimit = dbConf.lunchBreakLimit; 
            wcConfig.teaBreakLimit = dbConf.teaBreakLimit; 
            wcConfig.markLateAfter = dbConf.markLateAfter !== undefined ? dbConf.markLateAfter : 0.25;
          }
        } catch (e) { console.warn('[update-status edit] Could not fetch AttendanceConfig:', e.message); }

        const historicalShiftUser = {
          shiftStartTime: attendance ? attendance.shiftStartTime : null,
          shiftEndTime: attendance ? attendance.shiftEndTime : null
        };
        const historicalShiftInfo = getCurrentShiftInfo(historicalShiftUser, logoutDate);

        const hours = calculateWorkingHours(loginDate, logoutDate, attendance ? attendance.breaks : [], wcConfig, historicalShiftInfo?.shiftEnd, historicalShiftInfo?.shiftStart);
        updateData.workingHours = Math.round(hours * 100) / 100;

        // Auto-calculate status based on working hours and late arrival if status is not manually provided
        if (!status) {
          updateData.status = await calculateFinalAttendanceStatus(loginDate, logoutDate, attendance ? attendance.breaks : [], historicalShiftInfo?.shiftEnd, historicalShiftInfo?.shiftStart);
        }
      } else if (workingHours !== undefined && workingHours !== null && workingHours !== '') {
        // Only use manual working hours if times are not both available
        updateData.workingHours = parseFloat(workingHours);
      }

      console.log(`[Update Attendance] Update data:`, updateData);

      // Determine what actually changed to create appropriate history entries
      const historyEntries = [];

      console.log(`[Update Attendance] Checking changes - Status from frontend: ${status}, Current status: ${attendance.status}, EditReason: ${editReason}`);

      // Priority 1: Check if there's only a reason update (no actual status change)
      if (editReason && status === attendance.status) {
        console.log(`[Update Attendance] Only reason/comment added, no status change`);
        historyEntries.push({
          updatedBy: req.user._id,
          updatedAt: new Date(),
          oldStatus: null, // No status change
          newStatus: null, // No status change
          reason: editReason,
          changeType: 'comment'
        });
      }
      // Priority 2: Check if status actually changed
      else if (status && status !== attendance.status) {
        console.log(`[Update Attendance] Status changed from ${attendance.status} to ${status}`);
        historyEntries.push({
          updatedBy: req.user._id,
          updatedAt: new Date(),
          oldStatus: attendance.status,
          newStatus: status,
          reason: editReason,
          changeType: 'status'
        });
      }
      // Priority 3: Check if times were updated (without status or reason change)
      else if ((loginTime || logoutTime) && !editReason) {
        console.log(`[Update Attendance] Times updated without reason`);
        historyEntries.push({
          updatedBy: req.user._id,
          updatedAt: new Date(),
          oldStatus: null, // No status change for time updates
          newStatus: null, // No status change for time updates
          reason: editReason,
          changeType: 'time'
        });
      }

      // Only add history if there are entries to add
      if (historyEntries.length > 0) {
        attendance = await Attendance.findByIdAndUpdate(
          attendance._id,
          {
            $set: updateData,
            $push: { editHistory: { $each: historyEntries } }
          },
          { new: true, runValidators: true }
        );
      } else {
        attendance = await Attendance.findByIdAndUpdate(
          attendance._id,
          { $set: updateData },
          { new: true, runValidators: true }
        );
      }

      console.log(`[Update Attendance] Record updated successfully`);
    }

    await attendance.populate([
      { path: 'employee', select: 'firstName lastName employeeId' },
      { path: 'updatedBy', select: 'firstName lastName' },
      { path: 'editHistory.updatedBy', select: 'firstName lastName' }
    ]);
    res.json({
      message: 'Attendance updated successfully',
      attendance
    });
  } catch (error) {
    console.error('Error updating attendance status:', error);
    res.status(500).json({ message: 'Error updating attendance status' });
  }
});

// Update attendance (for logout or manual updates)
router.put('/:id', auth, async (req, res) => {
  try {
    const { logoutTime, status } = req.body;
    const updateData = {};

    if (logoutTime) {
      updateData.logoutTime = logoutTime;
      const attendance = await Attendance.findById(req.params.id).populate('employee');
      if (attendance && attendance.loginTime) {
        let putConfig = { lunchBreakLimit: 30, teaBreakLimit: 15, markLateAfter: 0.25 };
        try {
          const AttendanceConfigModel = require('../models/AttendanceConfig');
          const dbConf = await AttendanceConfigModel.findOne({ isActive: true });
          if (dbConf) { 
            putConfig.lunchBreakLimit = dbConf.lunchBreakLimit; 
            putConfig.teaBreakLimit = dbConf.teaBreakLimit; 
            putConfig.markLateAfter = dbConf.markLateAfter !== undefined ? dbConf.markLateAfter : 0.25;
          }
        } catch (e) { console.warn('[PUT /:id] Could not fetch AttendanceConfig:', e.message); }

        const historicalShiftUser = {
          shiftStartTime: attendance.shiftStartTime,
          shiftEndTime: attendance.shiftEndTime
        };
        const historicalShiftInfo = getCurrentShiftInfo(historicalShiftUser, new Date(logoutTime));

        const hours = calculateWorkingHours(attendance.loginTime, logoutTime, attendance.breaks, putConfig, historicalShiftInfo?.shiftEnd, historicalShiftInfo?.shiftStart);
        updateData.workingHours = Math.round(Math.max(0, hours) * 100) / 100;

        // Auto-calculate status based on working hours
        if (!status) {
          updateData.status = await calculateFinalAttendanceStatus(attendance.loginTime, logoutTime, attendance.breaks, historicalShiftInfo?.shiftEnd, historicalShiftInfo?.shiftStart);
        }
      }
    }

    if (status) {
      updateData.status = status;
    }

    const attendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('employee', 'firstName lastName employeeId');

    res.json(attendance);
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ message: 'Error updating attendance' });
  }
});

// Delete attendance record
router.delete('/:id', auth, async (req, res) => {
  try {
    // Check if user has permission to delete attendance
    const hasDeletePermission = req.user.role.permissions.find(
      p => p.module === 'attendance' && p.actions.includes('delete')
    );

    if (!hasDeletePermission && req.user.role.name !== 'Admin' && req.user.role.name !== 'Director') {
      return res.status(403).json({ message: 'Not authorized to delete attendance records' });
    }

    const attendance = await Attendance.findById(req.params.id);

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    await Attendance.findByIdAndDelete(req.params.id);

    res.json({ message: 'Attendance record deleted successfully' });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    res.status(500).json({ message: 'Error deleting attendance record' });
  }
});

// Get detailed employee attendance for a specific month
router.get('/employee-details/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    // Check if user has permission to view attendance
    const hasReadPermission = req.user.role.permissions.find(
      p => p.module === 'attendance' && p.actions.includes('read')
    );

    const isOwnData = req.user._id.toString() === employeeId;

    if (!isOwnData && !hasReadPermission && req.user.role.name !== 'Admin' && req.user.role.name !== 'Director') {
      return res.status(403).json({ message: 'Access denied. You can only view your own attendance details.' });
    }

    // Get employee details
    const User = require('../models/User');
    const employee = await User.findById(employeeId).select('firstName lastName employeeId department designation shiftType shiftHistory');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Get shift config for this employee
    const ShiftConfig = require('../models/ShiftConfig');
    const shiftConfig = await ShiftConfig.findOne({ type: employee.shiftType || 'morning' });
    const weekoffDays = shiftConfig?.weekoff || 1;
    const shiftName = shiftConfig?.name || 'Morning Shift';
    const shiftStartTime = shiftConfig?.startTime || '09:00 AM';
    const shiftEndTime = shiftConfig?.endTime || '06:00 PM';
    const allShiftConfigs = await ShiftConfig.find({});

    // Get attendance records for the month
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);
    const totalDaysInMonth = endDate.getDate();

    const attendances = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    })
      .populate('updatedBy', 'firstName lastName')
      .sort({ date: 1 });

    // Get approved leaves for this employee in the month
    const Leave = require('../models/Leave');
    const approvedLeaves = await Leave.find({
      employee: employeeId,
      status: 'approved',
      $or: [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    });

    // Get holidays for the month
    const Holiday = require('../models/Holiday');
    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate }
    });

    // Create leave map for quick lookup
    const leaveMap = new Map();
    approvedLeaves.forEach(leave => {
      const start = new Date(Math.max(leave.startDate, startDate));
      const end = new Date(Math.min(leave.endDate, endDate));

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDate();
        leaveMap.set(day, {
          type: leave.leaveType || leave.reason,
          reason: leave.reason || leave.description || '',
          category: leave.leaveCategory || 'Casual Leave',
          durationType: leave.durationType || 'Full Day',
          description: leave.description || ''
        });
      }
    });

    // Create holiday map for quick lookup
    const holidayMap = new Map();
    holidays.forEach(holiday => {
      const day = new Date(holiday.date).getDate();
      holidayMap.set(day, {
        name: holiday.name,
        description: holiday.description
      });
    });

    const getInferredShift = (att) => {
      if (att.shiftStartTime && att.shiftEndTime) {
        return allShiftConfigs.find(s => s.startTime === att.shiftStartTime && s.endTime === att.shiftEndTime);
      }
      if (!att.loginTime) return null;

      const loginD = new Date(att.loginTime);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istD = new Date(loginD.getTime() + istOffset);
      const hours = istD.getUTCHours();
      const minutes = istD.getUTCMinutes();
      const loginMins = hours * 60 + minutes;

      let bestShift = null;
      let minDiff = Infinity;
      for (const s of allShiftConfigs) {
        if (!s.startTime) continue;
        const timeParts = s.startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeParts) {
          let sHours = parseInt(timeParts[1]);
          if (timeParts[3].toUpperCase() === 'PM' && sHours !== 12) sHours += 12;
          if (timeParts[3].toUpperCase() === 'AM' && sHours === 12) sHours = 0;
          const sMins = sHours * 60 + parseInt(timeParts[2]);

          let diff = Math.abs(loginMins - sMins);
          if (diff > 12 * 60) diff = 24 * 60 - diff;

          if (diff < minDiff) {
            minDiff = diff;
            bestShift = s;
          }
        }
      }
      return minDiff <= 240 ? bestShift : null;
    };

    // Create daily breakdown
    const dailyBreakdown = [];
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    let previousDayShiftStart = null;
    let previousDayShiftEnd = null;

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      // Use local date comparison to avoid UTC timezone shift
      const attendance = attendances.find(att => {
        const attDate = new Date(att.date);
        return attDate.getFullYear() === currentDate.getFullYear() &&
          attDate.getMonth() === currentDate.getMonth() &&
          attDate.getDate() === day;
      });
      const leaveInfo = leaveMap.get(day);
      const holidayInfo = holidayMap.get(day);

      let currentDayShiftStart = shiftStartTime; // default to current shift config
      let currentDayShiftEnd = shiftEndTime;

      // Check if this date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFutureDate = currentDate > today;

      const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat, 5=Fri

      let applicableWeekoffDays = weekoffDays; // default to current shift's weekoffDays

      // Find the historical shift using shiftHistory
      let matchingShiftConfig = null;
      if (employee.shiftHistory && employee.shiftHistory.length > 0) {
        const historyEntry = employee.shiftHistory.find(h => {
          const s = new Date(h.startDate);
          s.setHours(0, 0, 0, 0);
          const e = h.endDate ? new Date(h.endDate) : new Date('2099-12-31');
          if (h.endDate) e.setHours(23, 59, 59, 999);
          return currentDate >= s && currentDate <= e;
        });
        if (historyEntry) {
          matchingShiftConfig = allShiftConfigs.find(s => s.type === historyEntry.shiftType);
        }
      }

      if (!matchingShiftConfig) {
        // Find the closest attendance record on or before this day to infer the historical shift
        let closestRecord = null;
        let matchingShift = null;
        for (let i = attendances.length - 1; i >= 0; i--) {
          const attDate = new Date(attendances[i].date);
          if (attDate <= currentDate) {
            const shift = getInferredShift(attendances[i]);
            if (shift) {
              closestRecord = attendances[i];
              matchingShift = shift;
              break;
            }
          }
        }

        if (closestRecord && matchingShift) {
          matchingShiftConfig = matchingShift;
        } else {
          // If no past record in this month has a valid shift, check the first future record
          const futureRecord = attendances.find(att => {
            if (new Date(att.date) > currentDate) {
              const shift = getInferredShift(att);
              if (shift) {
                matchingShift = shift;
                return true;
              }
            }
            return false;
          });
          if (futureRecord && matchingShift) {
            matchingShiftConfig = matchingShift;
          }
        }
      }

      if (matchingShiftConfig) {
        applicableWeekoffDays = matchingShiftConfig.weekoff || 1;
        currentDayShiftStart = matchingShiftConfig.startTime;
        currentDayShiftEnd = matchingShiftConfig.endTime;
      }

      const isWeekOff = (
        (applicableWeekoffDays >= 1 && dayOfWeek === 0) ||
        (applicableWeekoffDays >= 2 && dayOfWeek === 6) ||
        (applicableWeekoffDays >= 3 && dayOfWeek === 5)
      );


      let dayData = {
        day: day,
        // Use local date string to avoid UTC timezone shift
        date: `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`,
        status: 'Absent',
        loginTime: null,
        logoutTime: null,
        logoutMethod: null,
        workingHours: 0,
        leaveType: null,
        leaveReason: null,
        holidayName: null,
        holidayDescription: null,
        isHistoricalShift: false
      };

      // PRIORITY ORDER:
      // 1. Attendance record (if HR/Admin explicitly marked attendance, it overrides everything)
      // 2. Leave (only if no attendance record exists for that day)
      // 3. Holiday (only if no attendance and no leave)
      // 4. Future date → '—'
      // 5. Week Off
      // 6. Default Absent

      if (attendance) {
        // Attendance record exists — always show it, even if employee had a leave that day
        dayData.status = attendance.status === 'present' ? 'Present'
          : attendance.status === 'half-day' ? 'Half-day'
            : 'Absent';
        dayData.loginTime = attendance.loginTime;
        dayData.logoutTime = attendance.logoutTime;
        dayData.logoutMethod = attendance.logoutMethod;
        dayData.workingHours = attendance.workingHours || 0;
        dayData.updatedBy = attendance.updatedBy;
        dayData.editReason = attendance.editReason;
        dayData.oldStatus = attendance.oldStatus;
        dayData.updatedAt = attendance.updatedAt;

        const inferred = getInferredShift(attendance);
        currentDayShiftStart = inferred ? inferred.startTime : shiftStartTime;
        currentDayShiftEnd = inferred ? inferred.endTime : shiftEndTime;

        // Still surface the leave info so the UI can show a subtle note if desired
        if (leaveInfo) {
          dayData.leaveType = leaveInfo.type;
          dayData.leaveReason = leaveInfo.reason;
          dayData.hasLeaveOverride = true; // flag: attendance overrode a leave
        }

        if (attendance.status === 'present') presentCount++;
        else if (attendance.status === 'half-day') halfDayCount++;
        else absentCount++;
      }
      // No attendance record — check leave
      else if (leaveInfo) {
        dayData.status = 'Leave';
        dayData.leaveType = leaveInfo.type;
        dayData.leaveReason = leaveInfo.reason;
        leaveCount++;
      }
      // No attendance, no leave — check holiday
      else if (holidayInfo) {
        dayData.status = 'Holiday';
        dayData.holidayName = holidayInfo.name;
        dayData.holidayDescription = holidayInfo.description;
      }
      // Check if it's a future date
      else if (isFutureDate) {
        dayData.status = '—';
      }
      // Check week off based on shift config
      // weekoffDays=1 → Sunday only, 2 → Sat+Sun, 3 → Fri+Sat+Sun
      else {
        const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat, 5=Fri

        let applicableWeekoffDays = weekoffDays; // default to current shift's weekoffDays

        // Find the historical shift using shiftHistory
        let matchingShiftConfig = null;
        if (employee.shiftHistory && employee.shiftHistory.length > 0) {
          const historyEntry = employee.shiftHistory.find(h => {
            const s = new Date(h.startDate);
            s.setHours(0, 0, 0, 0);
            const e = h.endDate ? new Date(h.endDate) : new Date('2099-12-31');
            if (h.endDate) e.setHours(23, 59, 59, 999);
            return currentDate >= s && currentDate <= e;
          });
          if (historyEntry) {
            matchingShiftConfig = allShiftConfigs.find(s => s.type === historyEntry.shiftType);
          }
        }

        if (!matchingShiftConfig) {
          // Find the closest attendance record on or before this day to infer the historical shift
          let closestRecord = null;
          let matchingShift = null;
          for (let i = attendances.length - 1; i >= 0; i--) {
            const attDate = new Date(attendances[i].date);
            if (attDate <= currentDate) {
              const shift = getInferredShift(attendances[i]);
              if (shift) {
                closestRecord = attendances[i];
                matchingShift = shift;
                break;
              }
            }
          }

          if (closestRecord && matchingShift) {
            matchingShiftConfig = matchingShift;
          } else {
            // If no past record in this month has a valid shift, check the first future record
            const futureRecord = attendances.find(att => {
              if (new Date(att.date) > currentDate) {
                const shift = getInferredShift(att);
                if (shift) {
                  matchingShift = shift;
                  return true;
                }
              }
              return false;
            });
            if (futureRecord && matchingShift) {
              matchingShiftConfig = matchingShift;
            }
          }
        }

        if (matchingShiftConfig) {
          applicableWeekoffDays = matchingShiftConfig.weekoff || 1;
          currentDayShiftStart = matchingShiftConfig.startTime;
          currentDayShiftEnd = matchingShiftConfig.endTime;
        }

        const isWeekOff = (
          (applicableWeekoffDays >= 1 && dayOfWeek === 0) ||
          (applicableWeekoffDays >= 2 && dayOfWeek === 6) ||
          (applicableWeekoffDays >= 3 && dayOfWeek === 5)
        );

        if (isWeekOff) {
          dayData.status = 'Week Off';
        } else {
          // Past date with no record = Absent
          absentCount++;
        }
      }

      // Determine if shift changed relative to previous day
      if (day > 1 && previousDayShiftStart !== null) {
        if (currentDayShiftStart !== previousDayShiftStart || currentDayShiftEnd !== previousDayShiftEnd) {
          dayData.isHistoricalShift = true;

          // Format the date nicely for the tooltip (e.g. 20 July 2026)
          const formattedDate = currentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          dayData.historicalShiftInfo = `Shift changed on ${formattedDate} from (${previousDayShiftStart} - ${previousDayShiftEnd}) to (${currentDayShiftStart} - ${currentDayShiftEnd}).\n*Note: The exact time and person who made the change is not logged in the database.`;
        }
      }

      previousDayShiftStart = currentDayShiftStart;
      previousDayShiftEnd = currentDayShiftEnd;

      dailyBreakdown.push(dayData);
    }

    res.json({
      employee: {
        _id: employee._id,
        name: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
        department: employee.department,
        designation: employee.designation
      },
      shiftInfo: {
        name: shiftName,
        startTime: shiftStartTime,
        endTime: shiftEndTime,
        weekoff: weekoffDays,
        type: employee.shiftType || 'morning'
      },
      month: parseInt(month),
      year: parseInt(year),
      summary: {
        totalDays: totalDaysInMonth,
        presentDays: presentCount,
        halfDays: halfDayCount,
        absentDays: absentCount,
        leaveDays: leaveCount
      },
      dailyBreakdown: dailyBreakdown
    });

  } catch (error) {
    console.error('Error fetching employee attendance details:', error);
    res.status(500).json({ message: 'Error fetching attendance details' });
  }
});

// Export employee attendance to Excel for a specific month
router.get('/employee-details/:employeeId/export', auth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    // Check if user has permission to view attendance
    const hasReadPermission = req.user.role.permissions.find(
      p => p.module === 'attendance' && p.actions.includes('read')
    );

    const isOwnData = req.user._id.toString() === employeeId;

    if (!isOwnData && !hasReadPermission && req.user.role.name !== 'Admin' && req.user.role.name !== 'Director') {
      return res.status(403).json({ message: 'Access denied. You can only export your own attendance details.' });
    }

    // Get employee details
    const User = require('../models/User');
    const employee = await User.findById(employeeId).select('firstName lastName employeeId department designation shiftType shiftHistory');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Get shift config to determine week-offs (same logic as modal endpoint)
    const ShiftConfig = require('../models/ShiftConfig');
    const shiftConfig = await ShiftConfig.findOne({ type: employee.shiftType || 'morning' });
    const weekoffDays = shiftConfig?.weekoff || 1;
    const allShiftConfigs = await ShiftConfig.find({});

    // Helper: format time to 12-hour AM/PM format (IST Timezone)
    const formatTime12hr = (timeVal) => {
      if (!timeVal) return '—';
      const d = new Date(timeVal);
      return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    };

    // Get attendance records for the month
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    const attendances = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Fetch approved leaves for this employee in the month
    const Leave = require('../models/Leave');
    const approvedLeaves = await Leave.find({
      employee: employeeId,
      status: 'approved',
      $or: [
        { startDate: { $gte: startDate, $lte: endDate } },
        { endDate: { $gte: startDate, $lte: endDate } },
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    });

    // Build leave map: day-of-month → leave type
    const leaveMap = new Map();
    approvedLeaves.forEach(leave => {
      const rangeStart = new Date(Math.max(new Date(leave.startDate), startDate));
      const rangeEnd = new Date(Math.min(new Date(leave.endDate), endDate));
      for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
        leaveMap.set(d.getDate(), leave.leaveType || 'Leave');
      }
    });

    // Create a map of attendance records by date string (YYYY-MM-DD) using LOCAL date
    const attendanceMap = {};
    attendances.forEach(att => {
      const d = new Date(att.date);
      // Use local date parts to avoid UTC timezone shift
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      attendanceMap[dateKey] = att;
    });

    // Get month name
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month) - 1];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Generate all dates for the month
    const daysInMonth = new Date(year, month, 0).getDate();
    const excelData = [];

    const getInferredShift = (att) => {
      if (att.shiftStartTime && att.shiftEndTime) {
        return allShiftConfigs.find(s => s.startTime === att.shiftStartTime && s.endTime === att.shiftEndTime);
      }
      if (!att.loginTime) return null;

      const loginD = new Date(att.loginTime);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istD = new Date(loginD.getTime() + istOffset);
      const hours = istD.getUTCHours();
      const minutes = istD.getUTCMinutes();
      const loginMins = hours * 60 + minutes;

      let bestShift = null;
      let minDiff = Infinity;
      for (const s of allShiftConfigs) {
        if (!s.startTime) continue;
        const timeParts = s.startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (timeParts) {
          let sHours = parseInt(timeParts[1]);
          if (timeParts[3].toUpperCase() === 'PM' && sHours !== 12) sHours += 12;
          if (timeParts[3].toUpperCase() === 'AM' && sHours === 12) sHours = 0;
          const sMins = sHours * 60 + parseInt(timeParts[2]);

          let diff = Math.abs(loginMins - sMins);
          if (diff > 12 * 60) diff = 24 * 60 - diff;

          if (diff < minDiff) {
            minDiff = diff;
            bestShift = s;
          }
        }
      }
      return minDiff <= 240 ? bestShift : null;
    };

    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let weekOffCount = 0;
    let leaveCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      // Use local date parts to avoid UTC timezone shift
      const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
      const dayName = dayNames[dayOfWeek];

      // Check if this date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFutureDate = currentDate > today;

      // Check if this day is a week-off using shift config
      let applicableWeekoffDays = weekoffDays; // default to current shift config

      let closestRecord = null;
      for (let i = attendances.length - 1; i >= 0; i--) {
        const attDate = new Date(attendances[i].date);
        if (attDate <= currentDate) {
          closestRecord = attendances[i];
          break;
        }
      }

      if (closestRecord) {
        const matchingShift = getInferredShift(closestRecord);
        if (matchingShift) applicableWeekoffDays = matchingShift.weekoff || 1;
      } else {
        const futureRecord = attendances.find(att => new Date(att.date) > currentDate);
        if (futureRecord) {
          const matchingShift = getInferredShift(futureRecord);
          if (matchingShift) applicableWeekoffDays = matchingShift.weekoff || 1;
        }
      }

      const isWeekOff = (
        (applicableWeekoffDays >= 1 && dayOfWeek === 0) ||
        (applicableWeekoffDays >= 2 && dayOfWeek === 6) ||
        (applicableWeekoffDays >= 3 && dayOfWeek === 5)
      );

      const leaveType = leaveMap.get(day);
      const att = attendanceMap[dateKey];

      let loginTime = '—';
      let logoutTime = '—';
      let workingHours = '—';
      let status = 'Absent';

      if (att) {
        // Attendance record exists — always wins over leave, holiday, week-off
        loginTime = att.loginTime ? formatTime12hr(att.loginTime) : '—';

        if (att.logoutMethod === 'not-checkout') {
          logoutTime = 'Not Checkout';
        } else if (att.logoutTime) {
          logoutTime = formatTime12hr(att.logoutTime);
        }

        workingHours = att.workingHours > 0 ? `${Math.floor(att.workingHours)}hr ${Math.floor((att.workingHours % 1) * 60)}mins` : '—';
        const st = (att.status || '').toLowerCase().trim();
        let attStatus = 'Absent';
        if (st === 'present' || st === 'checked-in' || st === 'early-checkin' || st === 'late-checkin') {
          attStatus = 'Present';
          presentCount++;
        } else if (st === 'half-day') {
          attStatus = 'Half-day';
          halfDayCount++;
        } else if (st === 'week off' || st === 'week-off') {
          attStatus = 'Week Off';
          weekOffCount++;
        } else if (st === 'absent' || st === 'not-checkout') {
          attStatus = st === 'not-checkout' ? 'Not Checkout' : 'Absent';
          absentCount++;
        } else {
          if (att.workingHours >= 8) {
            attStatus = 'Present';
            presentCount++;
          } else if (att.workingHours >= 4) {
            attStatus = 'Half-day';
            halfDayCount++;
          } else {
            attStatus = 'Absent';
            absentCount++;
          }
        }
        status = leaveType ? `${attStatus} (Leave overridden)` : attStatus;
      } else if (leaveType) {
        // No attendance record — show leave
        status = `Leave (${leaveType})`;
        leaveCount++;
      } else if (isFutureDate) {
        status = '—';
      } else if (isWeekOff) {
        status = 'Week Off';
        weekOffCount++;
      } else {
        // No attendance record, not future, not week-off = Absent
        absentCount++;
      }

      excelData.push({
        'Date': currentDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
        'Day': dayName,
        'Check-in Time': loginTime,
        'Checkout Time': logoutTime,
        'Working Hours': workingHours,
        'Status': status
      });
    }

    // Create workbook
    const wb = xlsx.utils.book_new();

    // Add employee info sheet
    const infoData = [
      ['Employee Attendance Report'],
      [],
      ['Employee Name:', `${employee.firstName} ${employee.lastName}`],
      ['Employee ID:', employee.employeeId],
      ['Department:', employee.department || 'N/A'],
      ['Designation:', employee.designation || 'N/A'],
      ['Month:', `${monthName} ${year}`],
      [],
      ['Summary:'],
      ['Present Days:', presentCount],
      ['Half Days:', halfDayCount],
      ['Absent Days:', absentCount],
      ['Leave Days:', leaveCount],
      ['Week Offs:', weekOffCount],
      ['Total Days:', daysInMonth],
      []
    ];

    const ws = xlsx.utils.aoa_to_sheet(infoData);

    // Add attendance data below info
    xlsx.utils.sheet_add_json(ws, excelData, { origin: -1, skipHeader: false });

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Date
      { wch: 12 }, // Day
      { wch: 18 }, // Check-in Time
      { wch: 18 }, // Checkout Time
      { wch: 18 }, // Working Hours
      { wch: 15 }  // Status
    ];

    xlsx.utils.book_append_sheet(wb, ws, 'Attendance');

    // Generate buffer
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers and send file
    const filename = `${employee.firstName}_${employee.lastName}_Attendance_${monthName}_${year}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error('Error exporting employee attendance:', error);
    res.status(500).json({ message: 'Error exporting attendance data' });
  }
});

// ── Manual Cron Trigger (Admin only) ───────────────────────────────────────
// POST /api/attendance/run-missed-checkout-cron
// Use this endpoint to manually trigger the missed-checkout cron for testing
// or to immediately process the entire current month.
router.post('/run-missed-checkout-cron', auth, async (req, res) => {
  try {
    // Only Admin / HR / Director can trigger manually
    const allowedRoles = ['Admin', 'HR', 'Director'];
    if (!allowedRoles.includes(req.user.role.name)) {
      return res.status(403).json({ message: 'Access denied. Admin/HR/Director only.' });
    }

    const { markMissedCheckoutsManual } = require('../utils/attendanceCron');

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Get first day of current month
    const monthStart = new Date(currentYear, currentMonth, 1);
    // Get last day of current month
    const monthEnd = new Date(currentYear, currentMonth + 1, 0);

    console.log('\n=== MANUAL ATTENDANCE CRON TRIGGER (FULL MONTH) ===');
    console.log('Triggered by:', req.user.firstName, req.user.lastName);
    console.log('Processing month:', monthStart.toDateString(), 'to', monthEnd.toDateString());

    // Get some stats before running for the entire month
    const monthRecords = await Attendance.find({
      date: {
        $gte: monthStart,
        $lte: monthEnd
      },
      loginTime: { $exists: true, $ne: null }
    }).countDocuments();

    const monthWithoutCheckout = await Attendance.find({
      date: {
        $gte: monthStart,
        $lte: monthEnd
      },
      loginTime: { $exists: true, $ne: null },
      $or: [
        { logoutTime: { $exists: false } },
        { logoutTime: null }
      ]
    }).countDocuments();

    console.log(`Month stats: ${monthRecords} total attendance records, ${monthWithoutCheckout} without checkout`);

    let totalMarked = 0;
    const results = [];

    // Process each day of the current month
    const currentDate = new Date(monthStart);

    while (currentDate <= monthEnd && currentDate <= now) {
      const dayCount = await markMissedCheckoutsManual(
        new Date(currentDate),
        `ManualTrigger/${currentDate.toISOString().split('T')[0]}`
      );

      if (dayCount > 0) {
        results.push({
          date: currentDate.toDateString(),
          marked: dayCount
        });
      }

      totalMarked += dayCount;

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log('=== CRON TRIGGER COMPLETE ===\n');
    console.log(`Total marked absent across month: ${totalMarked}`);

    res.json({
      message: 'Missed checkout cron ran successfully for entire current month',
      totalMarked: totalMarked,
      monthStats: {
        totalRecords: monthRecords,
        withoutCheckout: monthWithoutCheckout,
        daysProcessed: results.length
      },
      dayResults: results,
      monthRange: {
        start: monthStart.toDateString(),
        end: monthEnd.toDateString()
      },
      ranAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

  } catch (error) {
    console.error('Error running manual cron trigger:', error);
    res.status(500).json({ message: 'Error running cron: ' + error.message });
  }
});

// @route   POST /api/attendance/upload-selfie
// @desc    Upload selfie before checkin
// @access  Private
router.post('/upload-selfie', auth, async (req, res) => {
  try {
    const { image, type, location } = req.body;
    if (!image) {
      return res.status(400).json({ message: 'No selfie image provided' });
    }

    if (!location || !location.latitude || !location.longitude) {
      return res.status(403).json({ message: 'Location is required to upload a selfie. Please enable location access.' });
    }

    const distance = getDistanceMeters(
      parseFloat(location.latitude),
      parseFloat(location.longitude),
      OFFICE_LAT,
      OFFICE_LNG
    );

    const allowedRadius = type === 'checkout' ? CHECKOUT_RADIUS_METERS : CHECKIN_RADIUS_METERS;
    if (distance > allowedRadius) {
      return res.status(403).json({
        message: `Selfie upload is only allowed near the office. You are ${Math.round(distance)} m away (allowed: ${allowedRadius} m).`
      });
    }

    if (type !== 'checkout') {
      const now = new Date();
      const shiftInfo = getCurrentShiftInfo(req.user, now);

      const AttendanceConfig = require('../models/AttendanceConfig');
      const dbConfig = await AttendanceConfig.findOne({ isActive: true });
      const markLateAfter = dbConfig && dbConfig.markLateAfter !== undefined ? dbConfig.markLateAfter : 0.25;
      const checkinWindowBefore = dbConfig && dbConfig.checkinWindowBefore !== undefined ? dbConfig.checkinWindowBefore : 15;

      const windowStart = new Date(shiftInfo.shiftStart.getTime() - (checkinWindowBefore * 60000));

      if (now < windowStart) {
        const formattedWindowStart = windowStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const shiftStartStr = shiftInfo.shiftStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        return res.status(403).json({
          message: `Check-in Selfie Unavailable: Your assigned shift begins at ${shiftStartStr}. The check-in window opens at ${formattedWindowStart}. Please try uploading your selfie once the check-in window opens.`
        });
      }
    }

    const Selfie = require('../models/Selfie');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    let existingSelfie = await Selfie.findOne({
      employee: req.user._id,
      createdAt: { $gte: startOfDay }
    }).sort({ createdAt: -1 });

    if (existingSelfie) {
      if (type === 'checkout') {
        existingSelfie.checkOutImage = image;
        existingSelfie.checkOutTime = new Date();
      } else {
        existingSelfie.image = image;
      }
      await existingSelfie.save();
    } else {
      if (type === 'checkout') {
        await Selfie.create({
          employee: req.user._id,
          image: '', // Can be empty if checkout selfie is taken without checkin
          checkOutImage: image,
          checkOutTime: new Date()
        });
      } else {
        await Selfie.create({
          employee: req.user._id,
          image: image
        });
      }
    }

    res.json({ message: 'Selfie uploaded successfully' });
  } catch (error) {
    console.error('Error uploading selfie:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/my-selfie
// @desc    Check if selfie is uploaded for today
// @access  Private
router.get('/my-selfie', auth, async (req, res) => {
  try {
    const Selfie = require('../models/Selfie');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existingSelfie = await Selfie.findOne({
      employee: req.user._id,
      createdAt: { $gte: startOfDay }
    }).sort({ createdAt: -1 });

    if (existingSelfie) {
      return res.json({
        uploaded: !!existingSelfie.image,
        image: existingSelfie.image,
        checkOutUploaded: !!existingSelfie.checkOutImage,
        checkOutImage: existingSelfie.checkOutImage,
        checkInTime: existingSelfie.createdAt,
        checkOutTime: existingSelfie.checkOutTime
      });
    }

    res.json({ uploaded: false, checkOutUploaded: false });
  } catch (error) {
    console.error('Error checking selfie:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/attendance/employee-selfie/:employeeId/:date
// @desc    Get selfie for a specific employee on a specific date
// @access  Private (Admin)
router.get('/employee-selfie/:employeeId/:date', auth, async (req, res) => {
  try {
    const Selfie = require('../models/Selfie');

    const targetDate = new Date(req.params.date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingSelfie = await Selfie.findOne({
      employee: req.params.employeeId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: -1 });

    if (existingSelfie) {
      return res.json({
        uploaded: !!existingSelfie.image,
        image: existingSelfie.image,
        checkOutUploaded: !!existingSelfie.checkOutImage,
        checkOutImage: existingSelfie.checkOutImage,
        checkInTime: existingSelfie.createdAt,
        checkOutTime: existingSelfie.checkOutTime
      });
    }

    res.json({ uploaded: false, checkOutUploaded: false });
  } catch (error) {
    console.error('Error fetching employee selfie:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get attendance history for a specific record
router.get('/history/:id', auth, async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('editHistory.updatedBy', 'firstName lastName')
      .select('editHistory');

    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found' });
    }

    res.json({ history: attendance.editHistory || [] });
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ message: 'Error fetching attendance history' });
  }
});

module.exports = router;
