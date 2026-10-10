const { BiometricRawLog } = require("../models");
const { fetchAttendanceLogs } = require("./vendorAdapter");

async function syncBiometric(deviceId, from, to) {

  const logs = await fetchAttendanceLogs(deviceId, from, to);

  for (const log of logs) {
    await BiometricRawLog.create({
      ...log,
      rawPayload: log
    });
  }

  return logs.length;
}

module.exports = { syncBiometric };
