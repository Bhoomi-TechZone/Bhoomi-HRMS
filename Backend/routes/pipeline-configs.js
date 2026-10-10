const express = require('express');
const router = express.Router();
const PipelineConfig = require('../models/PipelineConfig');
const auth = require('../middleware/auth');

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

// POST / PUT update pipeline configuration
router.post('/save', auth, async (req, res) => {
  try {
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
