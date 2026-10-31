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
// Pre-cutoff retired legacy template pipelines that should never be shown to sales roles
const RETIRED_LEGACY_TEMPLATES = new Set([
  'sales pipeline',
  'enterprise pipeline',
  'lead conversion pipeline',
  'renewal & retention pipeline',
  'partnership pipeline',
  'marketing qualified (mql)',
  'marketing qualified',
  'sales qualified (sql)',
  'sales qualified',
  'opportunity stage'
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

    // For all user roles (including Sales Head, Sales Manager, Sales Executives, sales roles):
    // Show ALL stages created on or after 17 Oct 2026 (DATA_CUTOFF_DATE),
    // regardless of whether they currently have deals in those stages or not!
    const [postCutoffDeals, postCutoffContacts] = await Promise.all([
      Deal.find({ createdAt: { $gte: DATA_CUTOFF_DATE } }).select('pipeline stage'),
      PipelineContact.find({ createdAt: { $gte: DATA_CUTOFF_DATE } }).select('leadStage')
    ]);

    const postCutoffDiscoveredStages = new Set(['new lead', 'initial']);
    postCutoffDeals.forEach(d => {
      if (d.pipeline) postCutoffDiscoveredStages.add(d.pipeline.toLowerCase().trim());
      if (d.stage) postCutoffDiscoveredStages.add(d.stage.toLowerCase().trim());
    });
    postCutoffContacts.forEach(c => {
      if (c.leadStage) postCutoffDiscoveredStages.add(c.leadStage.toLowerCase().trim());
    });

    const isStageCreatedOnOrAfterCutoff = (item) => {
      if (!item) return false;
      const strName = (typeof item === 'string' ? item : (item?.name || item?.id || '')).toLowerCase().trim();
      if (!strName) return false;

      // 1. If it's a retired legacy template pipeline and has NO post-cutoff data, hide it
      if (RETIRED_LEGACY_TEMPLATES.has(strName) && !postCutoffDiscoveredStages.has(strName)) {
        return false;
      }

      // 2. Core active stages in the post-cutoff system must always be visible
      if (strName === 'lost' || strName === 'won' || strName === 'new lead' || strName === 'initial') {
        return true;
      }

      // 3. If explicitly stamped with createdAt < DATA_CUTOFF_DATE and has NO post-cutoff data, hide it
      if (typeof item === 'object' && item !== null && item.createdAt) {
        if (new Date(item.createdAt) < DATA_CUTOFF_DATE && !postCutoffDiscoveredStages.has(strName)) {
          return false;
        }
        return true;
      }

      // 4. All other stages configured or created on or after 17 Oct 2026 MUST be shown to all sales roles,
      // does not matter if they currently have deals in those stages or not!
      return true;
    };

    const filteredConfig = config.toObject ? config.toObject() : { ...config };
    const deletedPipelines = Array.isArray(config.deletedPipelines) ? config.deletedPipelines.map(p => String(p).toLowerCase().trim()) : [];
    const deletedStages = Array.isArray(config.deletedStages) ? config.deletedStages.map(s => String(s).toLowerCase().trim()) : [];

    // Helper to format pipeline/stage item
    const formatStageItem = (item, defaultId) => {
      const name = (typeof item === 'string' ? item : (item?.name || item?.id || defaultId)).trim();
      const id = (typeof item === 'string' ? item : (item?.id || item?.name || defaultId)).trim();
      const createdAt = (typeof item === 'object' && item?.createdAt) ? item.createdAt : DATA_CUTOFF_DATE.toISOString();
      return {
        id,
        name,
        badgeClass: (typeof item === 'object' && item?.badgeClass) ? item.badgeClass : 'new',
        createdAt
      };
    };

    // 1. Pipelines
    let activePipelines = [];
    if (Array.isArray(filteredConfig.pipelines)) {
      activePipelines = filteredConfig.pipelines
        .filter(p => !deletedPipelines.includes((typeof p === 'string' ? p : (p?.name || p?.id || '')).toLowerCase().trim()))
        .filter(isStageCreatedOnOrAfterCutoff)
        .map((p, idx) => formatStageItem(p, `Stage ${idx + 1}`));
    }

    // Merge any discovered stages from post-cutoff deals so all sales users can see them
    const existingPipelineNames = new Set(activePipelines.map(p => (p.name || p.id || '').toLowerCase().trim()));
    postCutoffDeals.forEach(d => {
      [d.stage, d.pipeline].filter(Boolean).forEach(st => {
        const stageName = String(st).trim();
        if (stageName && !existingPipelineNames.has(stageName.toLowerCase()) && !deletedPipelines.includes(stageName.toLowerCase()) && !RETIRED_LEGACY_TEMPLATES.has(stageName.toLowerCase())) {
          existingPipelineNames.add(stageName.toLowerCase());
          activePipelines.push({
            id: stageName,
            name: stageName,
            badgeClass: 'new',
            createdAt: DATA_CUTOFF_DATE.toISOString()
          });
        }
      });
    });

    // Also include any custom options from pipelineOptions
    if (Array.isArray(filteredConfig.pipelineOptions)) {
      filteredConfig.pipelineOptions.forEach(opt => {
        const optName = String(opt || '').trim();
        if (optName && !existingPipelineNames.has(optName.toLowerCase()) && !deletedPipelines.includes(optName.toLowerCase()) && !RETIRED_LEGACY_TEMPLATES.has(optName.toLowerCase())) {
          existingPipelineNames.add(optName.toLowerCase());
          activePipelines.push({
            id: optName,
            name: optName,
            badgeClass: 'new',
            createdAt: DATA_CUTOFF_DATE.toISOString()
          });
        }
      });
    }

    if (activePipelines.length === 0) {
      activePipelines = [
        { id: 'Lost', name: 'Lost', badgeClass: 'lost', createdAt: DATA_CUTOFF_DATE.toISOString() },
        { id: 'New Lead', name: 'New Lead', badgeClass: 'new', createdAt: DATA_CUTOFF_DATE.toISOString() },
        { id: 'Indias', name: 'Indias', badgeClass: 'custom', createdAt: DATA_CUTOFF_DATE.toISOString() },
        { id: 'Initial', name: 'Initial', badgeClass: 'new', createdAt: DATA_CUTOFF_DATE.toISOString() }
      ];
    }
    filteredConfig.pipelines = activePipelines;

    // 2. Stages
    let activeStages = [];
    if (Array.isArray(filteredConfig.stages)) {
      activeStages = filteredConfig.stages
        .filter(s => !deletedStages.includes((typeof s === 'string' ? s : (s?.name || s?.id || '')).toLowerCase().trim()))
        .filter(isStageCreatedOnOrAfterCutoff)
        .map((s, idx) => formatStageItem(s, `Stage ${idx + 1}`));
    }
    const existingStageNames = new Set(activeStages.map(s => (s.name || s.id || '').toLowerCase().trim()));
    activePipelines.forEach(p => {
      if (!existingStageNames.has((p.name || p.id || '').toLowerCase().trim())) {
        existingStageNames.add((p.name || p.id || '').toLowerCase().trim());
        activeStages.push(p);
      }
    });
    activeStages.forEach(s => {
      if (!existingPipelineNames.has((s.name || s.id || '').toLowerCase().trim())) {
        existingPipelineNames.add((s.name || s.id || '').toLowerCase().trim());
        activePipelines.push(s);
      }
    });
    filteredConfig.stages = activeStages;
    filteredConfig.pipelines = activePipelines;

    // 3. Pipeline Options
    const optSet = new Set(activePipelines.map(p => p.name));
    filteredConfig.pipelineOptions = Array.from(optSet);

    // 4. Contact Stages
    if (Array.isArray(filteredConfig.contactStages)) {
      filteredConfig.contactStages = filteredConfig.contactStages
        .filter(cs => !deletedStages.includes((typeof cs === 'string' ? cs : (cs?.name || cs?.id || '')).toLowerCase().trim()))
        .filter(isStageCreatedOnOrAfterCutoff)
        .map((cs, idx) => formatStageItem(cs, `Contact Stage ${idx + 1}`));
      if (filteredConfig.contactStages.length === 0) {
        filteredConfig.contactStages = [
          { id: 'New Lead', name: 'New Lead', badgeClass: 'new', createdAt: DATA_CUTOFF_DATE.toISOString() }
        ];
      }
    }

    // 5. Lead Stages
    if (Array.isArray(filteredConfig.leadStages)) {
      filteredConfig.leadStages = filteredConfig.leadStages
        .filter(ls => !deletedStages.includes(String(ls).toLowerCase().trim()))
        .filter(isStageCreatedOnOrAfterCutoff);
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
    const designation = (user?.designation || '').toString().toLowerCase().trim();
    const isSalesHead =
      roleNormalized.includes('sales head') ||
      roleNormalized === 'saleshead' ||
      roleNormalized === 'head of sales' ||
      designation.includes('sales head') ||
      designation.includes('head of sales');

    const isSalesManager =
      roleNormalized.includes('sales manager') ||
      roleNormalized.includes('salesmanager') ||
      roleNormalized === 'manager of sales' ||
      designation.includes('sales manager') ||
      designation.includes('manager of sales');

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
          if (RETIRED_LEGACY_TEMPLATES.has(nameLower)) {
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
