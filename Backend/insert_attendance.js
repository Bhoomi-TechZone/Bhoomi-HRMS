require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || 'mongodb://hrms:BtplSoft@ac-pzvrfrk-shard-00-00.ywqmd4i.mongodb.net:27017,ac-pzvrfrk-shard-00-01.ywqmd4i.mongodb.net:27017,ac-pzvrfrk-shard-00-02.ywqmd4i.mongodb.net:27017/TechHRMS?ssl=true&replicaSet=atlas-c12xyg-shard-0&authSource=admin&retryWrites=true&w=majority';

/**
 * Helper to construct a Date object for a given date string (YYYY-MM-DD)
 * and time string (HH:MM AM/PM or HH:MM) in Indian Standard Time (IST, UTC+5:30).
 */
function createISTDate(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-').map(Number);

  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (timeStr) {
    const parts = timeStr.trim().split(/\s+/);
    const timeParts = parts[0].split(':').map(Number);
    hours = timeParts[0] || 0;
    minutes = timeParts[1] || 0;
    seconds = timeParts[2] || 0;

    const modifier = parts[1] ? parts[1].toUpperCase() : null;
    if (modifier === 'PM' && hours < 12) {
      hours += 12;
    } else if (modifier === 'AM' && hours === 12) {
      hours = 0;
    }
  }

  // IST offset is +05:30 -> UTC is Date.UTC(year, month - 1, day, hours - 5, minutes - 30, seconds)
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes, seconds) - (5.5 * 60 * 60 * 1000);
  return new Date(utcMillis);
}

/**
 * Helper to calculate working hours and attendance status based on login, logout, and breaks.
 */
function calculateWorkingDetails(loginTime, logoutTime, breaks = []) {
  const totalElapsedMins = Math.max(0, (logoutTime - loginTime) / (1000 * 60));

  let totalBreakMins = 0;
  breaks.forEach(b => {
    if (b.breakType === 'Other') return; // 'Other' breaks do not deduct working hours
    const duration = b.duration !== undefined
      ? b.duration
      : Math.max(0, Math.round((new Date(b.endTime) - new Date(b.startTime)) / (1000 * 60)));
    totalBreakMins += duration;
  });

  const netWorkingMins = Math.max(0, totalElapsedMins - totalBreakMins);
  const workingHours = Math.round((netWorkingMins / 60) * 100) / 100;

  let status = 'present';
  if (workingHours < 4) {
    status = 'absent';
  } else if (workingHours < 8) {
    status = 'half-day';
  } else {
    status = 'present';
  }

  return { totalElapsedMins, totalBreakMins, netWorkingMins, workingHours, status };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION: Set parameters for attendance insertion/update
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {
  employeeId: "693916c989597b2407dcba45",
  dateStr: "2026-09-24",          // YYYY-MM-DD
  loginTimeStr: "12:02 PM",       // 12:05 PM IST
  logoutTimeStr: null,            // Pass string like "09:15 PM" OR null/undefined if not logged out
  isNotLogout: true,              // If true or logout is missing, automatically set logout at 09:05 PM IST
  defaultNotLogoutTime: "10:05 PM",

  // Breaks configuration
  breaksConfig: [
    {
      breakType: "Lunch Break",
      reason: "Lunch Break",
      startTimeStr: "03:30 PM",
      endTimeStr: "04:00 PM"
    },
    {
      breakType: "Tea Break",     // Stored as 'Tea Break' in DB (displayed as 'Refreshment Break' in UI)
      reason: "Refreshment Break",
      startTimeStr: "07:00 PM",
      endTimeStr: "07:25 PM"
    }
  ],

  location: {
    latitude: 28.628728522537543,
    longitude: 77.38141898307067,
    address: "28.628729, 77.381419"
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXECUTION SCRIPT
// ─────────────────────────────────────────────────────────────────────────────
mongoose.connect(uri)
  .then(async () => {
    console.log("Connected to MongoDB successfully.");
    const db = mongoose.connection.db;

    const date = new Date(`${CONFIG.dateStr}T00:00:00.000Z`);
    const loginTime = createISTDate(CONFIG.dateStr, CONFIG.loginTimeStr);

    // Resolve logout time: If not logged out or isNotLogout is true, set to 09:05 PM
    let effectiveLogoutStr = CONFIG.logoutTimeStr;
    if (CONFIG.isNotLogout || !effectiveLogoutStr) {
      effectiveLogoutStr = CONFIG.defaultNotLogoutTime;
    }
    const logoutTime = createISTDate(CONFIG.dateStr, effectiveLogoutStr);

    // Build Breaks array with durations
    const breaks = CONFIG.breaksConfig.map(b => {
      const startTime = createISTDate(CONFIG.dateStr, b.startTimeStr);
      const endTime = createISTDate(CONFIG.dateStr, b.endTimeStr);
      const duration = Math.round((endTime - startTime) / (1000 * 60)); // in minutes

      return {
        breakType: b.breakType,
        reason: b.reason,
        startTime: startTime,
        endTime: endTime,
        duration: duration
      };
    });

    // Calculate Working Hours & Status
    const { totalElapsedMins, totalBreakMins, netWorkingMins, workingHours, status } =
      calculateWorkingDetails(loginTime, logoutTime, breaks);

    const record = {
      employee: new mongoose.Types.ObjectId(CONFIG.employeeId),
      date: date,
      loginTime: loginTime,
      logoutTime: logoutTime,
      workingHours: workingHours,
      status: status,
      method: "self-checkin",
      logoutMethod: "self-logout",
      location: CONFIG.location,
      updatedBy: null,
      breaks: breaks,
      createdAt: new Date(),
      updatedAt: new Date(),
      __v: 0
    };

    console.log("\n================ ATTENDANCE SUMMARY ================");
    console.log(`Employee ID       : ${CONFIG.employeeId}`);
    console.log(`Date              : ${CONFIG.dateStr}`);
    console.log(`Login Time (IST)  : ${CONFIG.loginTimeStr} (${loginTime.toISOString()})`);
    console.log(`Logout Time (IST) : ${effectiveLogoutStr} (${logoutTime.toISOString()})`);
    console.log(`Breaks Inserted   : ${breaks.length}`);
    breaks.forEach((b, idx) => {
      console.log(`  [${idx + 1}] ${b.reason || b.breakType} (${b.breakType}): ${b.duration} mins [${b.startTime.toISOString()} to ${b.endTime.toISOString()}]`);
    });
    console.log(`Total Break Time  : ${totalBreakMins} mins`);
    console.log(`Total Elapsed     : ${totalElapsedMins} mins (${(totalElapsedMins / 60).toFixed(2)} hrs)`);
    console.log(`Net Working Time  : ${netWorkingMins} mins (${workingHours} hrs)`);
    console.log(`Attendance Status : ${status}`);
    console.log("====================================================\n");

    // Upsert record (insert or replace if record for employee & date already exists)
    const filter = {
      employee: record.employee,
      date: record.date
    };

    const result = await db.collection('attendances').updateOne(
      filter,
      { $set: record },
      { upsert: true }
    );

    if (result.upsertedId) {
      console.log(`Successfully inserted new attendance record with ID: ${result.upsertedId._id}`);
    } else {
      console.log(`Successfully updated existing attendance record for date ${CONFIG.dateStr} (Matched: ${result.matchedCount}, Modified: ${result.modifiedCount})`);
    }

    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error executing script:", err);
    mongoose.connection.close().then(() => process.exit(1));
  });
