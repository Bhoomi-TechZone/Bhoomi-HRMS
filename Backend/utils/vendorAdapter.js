/**
 * Vendor adapter
 * Later replace with:
 * - ZKTeco
 * - eSSL
 * - Matrix
 */

async function fetchAttendanceLogs(deviceId, from, to) {

  // dummy logs
  return [
    {
      biometricUserId: "25",
      punchTime: new Date(),
      punchType: "IN",
      deviceId
    },
    {
      biometricUserId: "25",
      punchTime: new Date(),
      punchType: "OUT",
      deviceId
    }
  ];
}

module.exports = { fetchAttendanceLogs };
