const cron = require('node-cron');
const MetaConfig = require('../models/MetaConfig');
const metaService = require('../services/metaService');

let currentTask = null;

function startMetaSyncCron() {
  // Run every 30 minutes by default; respects config.syncIntervalHours
  currentTask = cron.schedule('*/30 * * * *', async () => {
    try {
      const config = await MetaConfig.findOne();
      if (!config || !config.autoSync) return;

      // Check if enough time has passed since last full sync
      if (config.lastFullSyncAt) {
        const hoursSinceLastSync =
          (Date.now() - new Date(config.lastFullSyncAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastSync < (config.syncIntervalHours || 1)) return;
      }

      console.log('[MetaSync] Starting scheduled sync...');
      const results = await metaService.syncAllLeads();
      const totalNew = results.reduce((acc, r) => acc + (r.newCount || 0), 0);
      console.log(`[MetaSync] Sync complete. New leads: ${totalNew}`);
    } catch (err) {
      console.error('[MetaSync] Scheduled sync error:', err.message);
    }
  });

  console.log('[MetaSync] Auto-sync cron job started (checks every 30 min)');
}

module.exports = startMetaSyncCron;
