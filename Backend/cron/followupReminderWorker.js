const { checkAndSendFollowUpReminders } = require('../services/followupNotificationService');

let intervalTimer = null;

function startFollowUpReminderWorker(io = null) {
  if (intervalTimer) {
    clearInterval(intervalTimer);
  }

  // Evaluate due follow-ups every 20 seconds so reminders trigger precisely on time
  intervalTimer = setInterval(async () => {
    try {
      await checkAndSendFollowUpReminders(io);
    } catch (err) {
      console.error('[FollowUpReminderWorker] Error in reminder tick:', err);
    }
  }, 20000);

  console.log('[FollowUpReminderWorker] Follow-up reminder worker started (evaluating due touchpoints every 20s)');

  // Run an immediate check on startup so overdue/pending follow-ups fire immediately
  setTimeout(() => {
    checkAndSendFollowUpReminders(io).catch(err => {
      console.error('[FollowUpReminderWorker] Initial startup check error:', err);
    });
  }, 2000);
}

module.exports = startFollowUpReminderWorker;
