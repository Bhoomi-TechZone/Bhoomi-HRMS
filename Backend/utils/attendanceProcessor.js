const {
  BiometricRawLog,
  Attendance,
  EmployeeBiometricMapping
} = require("../models");

async function processAttendance() {

  const logs = await BiometricRawLog.find();

  for (const log of logs) {

    const mapping = await EmployeeBiometricMapping.findOne({
      biometricUserId: log.biometricUserId
    });

    if (!mapping) continue;

    const dateOnly = new Date(log.punchTime);
    dateOnly.setHours(0,0,0,0);

    let attendance = await Attendance.findOne({
      employeeId: mapping.employeeId,
      date: dateOnly
    });

    if (!attendance) {
      attendance = await Attendance.create({
        employeeId: mapping.employeeId,
        date: dateOnly,
        status: "Present"
      });
    }

    if (log.punchType === "IN") {
      attendance.punchIn = log.punchTime;
    }

    if (log.punchType === "OUT") {
      attendance.punchOut = log.punchTime;
    }

    await attendance.save();
  }
}

module.exports = { processAttendance };
