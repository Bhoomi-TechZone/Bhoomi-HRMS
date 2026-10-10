const mongoose = require('mongoose');

const pipelineConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: 'default_config'
  },
  pipelines: {
    type: Array,
    default: []
  },
  stages: {
    type: Array,
    default: []
  },
  contactStages: {
    type: Array,
    default: []
  },
  pipelineOptions: {
    type: Array,
    default: []
  },
  leadStages: {
    type: Array,
    default: []
  },
  contactSources: {
    type: Array,
    default: []
  },
  leadStatuses: {
    type: Array,
    default: []
  },
  industryOptions: {
    type: Array,
    default: []
  },
  dealTypes: {
    type: Array,
    default: []
  },
  deletedStages: {
    type: Array,
    default: []
  },
  deletedPipelines: {
    type: Array,
    default: []
  }
}, { timestamps: true });

module.exports = mongoose.model('PipelineConfig', pipelineConfigSchema);
