const express = require('express');
const router = express.Router();
const PipelineConfig = require('../models/PipelineConfig');
const Deal = require('../models/Deal');
const PipelineContact = require('../models/PipelineContact');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Cutoff timestamp: stages and pipeline data before this cutoff are strictly hidden from non-admin roles
const DATA_CUTOFF_DATE = new Date(process.env.CRM_DATA_CUTOFF_DATE || '2026-10-17T00:00:00+05:30');

// Pre-cutoff legacy default stages that existed before 17 Oct 2026
const PRE_CUTOFF_LEGACY_STAGES = new Set([
  'sales pipeline',
  'enterprise pipeline',
  'lead conversion pipeline',
  'renewal & retention pipeline',
  'partnership pipeline',
  'hot',
  'cold',
  'old',
  'won',
  'lost',
  'new',
  'lead',
  'marketing qualified (mql)',
  'marketing qualified',
  'sales qualified (sql)',
  'sales qualified',
  'opportunity',
  'opportunity stage',
  'customer',
  'retention & customer'
]);

// Helper for checking admin privileges
function checkIsAdmin(user) {
  if (!user) return false;
  const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase().trim();
  const roleNormalized = roleName.replace(/\s+/g, ' ');
  const designation = (user?.designation || '').toString().toLowerCase().trim();
  const department = (user?.department || '').toString().toLowerCase().trim();
  const email = (user?.email || '').toString().toLowerCase().trim();

  return (
    roleNormalized === 'admin' ||
    roleNormalized.includes('admin') ||
    roleNormalized.includes('superadmin') ||
    roleNormalized.includes('director') ||
    designation.includes('admin') ||
    designation.includes('director') ||
    department === 'administration' ||
    email.startsWith('admin@') ||
    user?.role?.name === 'Admin' ||
    user?.role?.name === 'Super Admin' ||
    user?.role?.name === 'Director' ||
    user?.isAdmin === true
  );
}

// GET pipeline configuration
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    let config = await PipelineConfig.findOne({ key: 'default_config' });
    if (!config) {
      config = new PipelineConfig({ key: 'default_config' });
      await config.save();
    }

    const isAdmin = checkIsAdmin(user);

    // Admin can see all historical and new pipeline stages with data
    if (isAdmin) {
      return res.json(config);
    }

    // For non-admin roles (Sales Head, Sales Manager, Sales Executives),
    // strictly do NOT show stages that were created before 17 Oct 2026.
    const [postCutoffDeals, preCutoffDeals, postCutoffContacts, preCutoffContacts] = await Promise.all([
      Deal.find({ createdAt: { $gte: DATA_CUTOFF_DATE } }).select('pipeline stage'),
      Deal.find({ createdAt: { $lt: DATA_CUTOFF_DATE } }).select('pipeline stage'),
      PipelineContact.find({ createdAt: { $gte: DATA_CUTOFF_DATE } }).select('leadStage'),
      PipelineContact.find({ createdAt: { $lt: DATA_CUTOFF_DATE } }).select('leadStage')
    ]);

    const postCutoffStageNames = new Set(['new lead', 'initial']);
    postCutoffDeals.forEach(d => {
      if (d.pipeline) postCutoffStageNames.add(d.pipeline.toLowerCase().trim());
      if (d.stage) postCutoffStageNames.add(d.stage.toLowerCase().trim());
    });
    postCutoffContacts.forEach(c => {
      if (c.leadStage) postCutoffStageNames.add(c.leadStage.toLowerCase().trim());
    });

    const preCutoffOnlyStageNames = new Set(PRE_CUTOFF_LEGACY_STAGES);
    preCutoffDeals.forEach(d => {
      const p = (d.pipeline || '').toLowerCase().trim();
      const s = (d.stage || '').toLowerCase().trim();
      if (p && !postCutoffStageNames.has(p)) preCutoffOnlyStageNames.add(p);
      if (s && !postCutoffStageNames.has(s)) preCutoffOnlyStageNames.add(s);
    });
    preCutoffContacts.forEach(c => {
      const s = (c.leadStage || '').toLowerCase().trim();
      if (s && !postCutoffStageNames.has(s)) preCutoffOnlyStageNames.add(s);
    });

    // Also collect any stage explicitly stamped with createdAt < DATA_CUTOFF_DATE
    const collectExplicitOldStages = (list) => {
      if (!Array.isArray(list)) return;
      list.forEach(item => {
        if (typeof item === 'object' && item !== null && item.createdAt) {
          if (new Date(item.createdAt) < DATA_CUTOFF_DATE) {
            if (item.name) preCutoffOnlyStageNames.add(item.name.toLowerCase().trim());
            if (item.id) preCutoffOnlyStageNames.add(item.id.toLowerCase().trim());
          }
        }
      });
    };
    collectExplicitOldStages(config.pipelines);
    collectExplicitOldStages(config.stages);
    collectExplicitOldStages(config.contactStages);

    const isStageCreatedOnOrAfterCutoff = (item) => {
      if (!item) return false;
      const strName = (typeof item === 'string' ? item : (item?.name || item?.id || '')).toLowerCase().trim();
      if (!strName) return false;

      // 1. If explicitly stamped with createdAt, check against cutoff date
      if (typeof item === 'object' && item !== null && item.createdAt) {
        return new Date(item.createdAt) >= DATA_CUTOFF_DATE;
      }

      // 2. If it's a known pre-cutoff legacy stage, strictly hide it
      if (preCutoffOnlyStageNames.has(strName) || PRE_CUTOFF_LEGACY_STAGES.has(strName)) {
        return false;
      }

      // 3. Base post-cutoff stages
      if (strName === 'new lead' || strName === 'initial') {
        return true;
      }

      // 4. Any stage that is not a pre-cutoff legacy stage was created on or after 17 Oct 2026.
      // All sales roles (Sales Head, Sales Manager, Sales Executives / Sales Role) must see all
      // these stages, even if they currently do not have any deals in those stages!
      return true;
    };

    const filteredConfig = config.toObject ? config.toObject() : { ...config };

    if (Array.isArray(filteredConfig.pipelines)) {
      filteredConfig.pipelines = filteredConfig.pipelines
        .filter(isStageCreatedOnOrAfterCutoff)
        .map(p => {
          if (typeof p === 'object' && p !== null && !p.createdAt) {
            return { ...p, createdAt: DATA_CUTOFF_DATE.toISOString() };
          }
          return p;
        });
      if (filteredConfig.pipelines.length === 0) {
        filteredConfig.pipelines = [
          { id: 'New Lead', name: 'New Lead', badgeClass: 'new', createdAt: DATA_CUTOFF_DATE.toISOString() },
          { id: 'Initial', name: 'Initial', badgeClass: 'new', createdAt: DATA_CUTOFF_DATE.toISOString() }
        ];
      }
    }
    if (Array.isArray(filteredConfig.stages)) {
      filteredConfig.stages = filteredConfig.stages
        .filter(isStageCreatedOnOrAfterCutoff)
        .map(s => {
          if (typeof s === 'object' && s !== null && !s.createdAt) {
            return { ...s, createdAt: DATA_CUTOFF_DATE.toISOString() };
          }
          return s;
        });
      if (filteredConfig.stages.length === 0) {
        filteredConfig.stages = [
          { id: 'New Lead', name: 'New Lead', badgeClass: 'new', createdAt: DATA_CUTOFF_DATE.toISOString() },
          { id: 'Initial', name: 'Initial', badgeClass: 'new', createdAt: DATA_CUTOFF_DATE.toISOString() }
        ];
      }
    }
    if (Array.isArray(filteredConfig.contactStages)) {
      filteredConfig.contactStages = filteredConfig.contactStages
        .filter(isStageCreatedOnOrAfterCutoff)
        .map(cs => {
          if (typeof cs === 'object' && cs !== null && !cs.createdAt) {
            return { ...cs, createdAt: DATA_CUTOFF_DATE.toISOString() };
          }
          return cs;
        });
      if (filteredConfig.contactStages.length === 0) {
        filteredConfig.contactStages = [
          { id: 'New Lead', name: 'New Lead', badgeClass: 'new', createdAt: DATA_CUTOFF_DATE.toISOString() }
        ];
      }
    }
    if (Array.isArray(filteredConfig.pipelineOptions)) {
      filteredConfig.pipelineOptions = filteredConfig.pipelineOptions.filter(isStageCreatedOnOrAfterCutoff);
      if (filteredConfig.pipelineOptions.length === 0) {
        filteredConfig.pipelineOptions = ['New Lead', 'Initial'];
      }
    }
    if (Array.isArray(filteredConfig.leadStages)) {
      filteredConfig.leadStages = filteredConfig.leadStages.filter(isStageCreatedOnOrAfterCutoff);
      if (filteredConfig.leadStages.length === 0) {
        filteredConfig.leadStages = ['New Lead'];
      }
    }

    return res.json(filteredConfig);
  } catch (error) {
    console.error('Error fetching pipeline config:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST / PUT update pipeline configuration (Restricted to Admin, Sales Head, and Sales Manager)
router.post('/save', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase().trim();
    const roleNormalized = roleName.replace(/\s+/g, ' ');
    const isSalesHead =
      roleNormalized.includes('sales head') ||
      roleNormalized === 'saleshead' ||
      roleNormalized === 'head of sales';

    const isSalesManager =
      roleNormalized.includes('sales manager') ||
      roleNormalized.includes('salesmanager') ||
      roleNormalized === 'manager of sales';

    const isAdmin = checkIsAdmin(user);
    const hasFullAccess = isAdmin || isSalesHead || isSalesManager;
    if (!hasFullAccess) {
      return res.status(403).json({ message: 'Access denied. Only Admin, Sales Head, and Sales Manager can edit or configure pipeline stages.' });
    }

    const {
      pipelines,
      stages,
      contactStages,
      pipelineOptions,
      leadStages,
      contactSources,
      leadStatuses,
      industryOptions,
      dealTypes,
      deletedStages,
      deletedPipelines
    } = req.body;

    let config = await PipelineConfig.findOne({ key: 'default_config' });
    if (!config) {
      config = new PipelineConfig({ key: 'default_config' });
    }

    // Preserve existing createdAt or attach current timestamp to new stages
    const nowIso = new Date().toISOString();
    const stampStages = (incomingList, existingList = []) => {
      if (!Array.isArray(incomingList)) return incomingList;
      return incomingList.map(item => {
        if (typeof item === 'object' && item !== null) {
          if (item.createdAt) return item;
          const match = existingList.find(e => (e.id || e.name) === (item.id || item.name));
          if (match?.createdAt) return { ...item, createdAt: match.createdAt };

          const nameLower = (item.name || item.id || '').toLowerCase().trim();
          if (PRE_CUTOFF_LEGACY_STAGES.has(nameLower)) {
            return {
              ...item,
              createdAt: '2026-09-01T00:00:00+05:30'
            };
          }

          return {
            ...item,
            createdAt: nowIso
          };
        }
        return item;
      });
    };

    if (pipelines !== undefined) {
      config.pipelines = stampStages(pipelines, config.pipelines);
      config.markModified('pipelines');
    }
    if (stages !== undefined) {
      config.stages = stampStages(stages, config.stages);
      config.markModified('stages');
    }
    if (contactStages !== undefined) {
      config.contactStages = stampStages(contactStages, config.contactStages);
      config.markModified('contactStages');
    }
    if (pipelineOptions !== undefined) {
      config.pipelineOptions = pipelineOptions;
      config.markModified('pipelineOptions');
    }
    if (leadStages !== undefined) {
      config.leadStages = leadStages;
      config.markModified('leadStages');
    }
    if (contactSources !== undefined) {
      config.contactSources = contactSources;
      config.markModified('contactSources');
    }
    if (leadStatuses !== undefined) {
      config.leadStatuses = leadStatuses;
      config.markModified('leadStatuses');
    }
    if (industryOptions !== undefined) {
      config.industryOptions = industryOptions;
      config.markModified('industryOptions');
    }
    if (dealTypes !== undefined) {
      config.dealTypes = dealTypes;
      config.markModified('dealTypes');
    }
    if (deletedStages !== undefined) {
      config.deletedStages = deletedStages;
      config.markModified('deletedStages');
    }
    if (deletedPipelines !== undefined) {
      config.deletedPipelines = deletedPipelines;
      config.markModified('deletedPipelines');
    }

    await config.save();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error saving pipeline config:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
