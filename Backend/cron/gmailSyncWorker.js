const cron = require('node-cron');
const gmailService = require('../services/gmailService');

/**
 * Gmail Sync Cron Worker
 * Auto-syncs website inquiry emails every 15 minutes
 */
function startGmailSyncCron() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      const authenticated = await gmailService.isAuthenticated();
      if (!authenticated) {
        return; // silently skip if not yet authenticated
      }

      const result = await gmailService.syncLeadsFromGmail(30);
      if (result.newCount > 0) {
        console.log(`[Gmail Sync] ${result.newCount} new website leads synced`);
      }
    } catch (err) {
      console.error('[Gmail Sync] Cron error:', err.message);
    }
  });

  console.log('[Gmail Sync] Cron scheduled — every 15 minutes');
}

module.exports = startGmailSyncCron;
