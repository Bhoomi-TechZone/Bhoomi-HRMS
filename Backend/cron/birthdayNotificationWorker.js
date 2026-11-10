const { checkAndSendBirthdayNotifications } = require('../services/birthdayNotificationService');

let birthdayTimer = null;

function startBirthdayNotificationWorker(io = null) {
  if (birthdayTimer) {
    clearInterval(birthdayTimer);
  }

  // Check hourly so birthdays are caught on day rollover
  birthdayTimer = setInterval(async () => {
    try {
      await checkAndSendBirthdayNotifications(io);
    } catch (err) {
      console.error('[BirthdayNotificationWorker] Error in hourly check:', err);
    }
  }, 60 * 60 * 1000);

  console.log('[BirthdayNotificationWorker] Birthday notification worker started (evaluating every hour)');

  // Run initial check on server startup after 5 seconds
  setTimeout(() => {
    checkAndSendBirthdayNotifications(io).catch(err => {
      console.error('[BirthdayNotificationWorker] Initial check error:', err);
    });
  }, 5000);
}

module.exports = startBirthdayNotificationWorker;

