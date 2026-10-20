const express = require('express');
const router = express.Router();
const PipelineConfig = require('../models/PipelineConfig');
const auth = require('../middleware/auth');

const User = require('../models/User');

// GET pipeline configuration
router.get('/', auth, async (req, res) => {
  try {
    let config = await PipelineConfig.findOne({ key: 'default_config' });
    if (!config) {
      config = new PipelineConfig({ key: 'default_config' });
      await config.save();
    }
    res.json(config);
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
    const department = (user?.department || '').toString().toLowerCase().trim();
    const email = (user?.email || '').toString().toLowerCase().trim();

    const isSalesHead =
      roleNormalized.includes('sales head') ||
      roleNormalized === 'saleshead' ||
      roleNormalized === 'head of sales';

    const isSalesManager =
      roleNormalized.includes('sales manager') ||
      roleNormalized.includes('salesmanager') ||
      roleNormalized === 'manager of sales';

    const isAdmin =
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
      user?.role?.name === 'Director';

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

    if (pipelines !== undefined) config.pipelines = pipelines;
    if (stages !== undefined) config.stages = stages;
    if (contactStages !== undefined) config.contactStages = contactStages;
    if (pipelineOptions !== undefined) config.pipelineOptions = pipelineOptions;
    if (leadStages !== undefined) config.leadStages = leadStages;
    if (contactSources !== undefined) config.contactSources = contactSources;
    if (leadStatuses !== undefined) config.leadStatuses = leadStatuses;
    if (industryOptions !== undefined) config.industryOptions = industryOptions;
    if (dealTypes !== undefined) config.dealTypes = dealTypes;
    if (deletedStages !== undefined) config.deletedStages = deletedStages;
    if (deletedPipelines !== undefined) config.deletedPipelines = deletedPipelines;

    await config.save();
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error saving pipeline config:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
