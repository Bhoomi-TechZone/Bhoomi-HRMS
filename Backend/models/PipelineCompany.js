const mongoose = require('mongoose');

const pipelineCompanySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    domain: {
      type: String,
      default: '',
      trim: true
    },
    owner: {
      type: String,
      default: 'Artiflow',
      trim: true
    },
    industry: {
      type: String,
      default: '',
      trim: true
    },
    country: {
      type: String,
      default: 'United States',
      trim: true
    },
    state: {
      type: String,
      default: '',
      trim: true
    },
    city: {
      type: String,
      default: '',
      trim: true
    },
    postalCode: {
      type: String,
      default: '',
      trim: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PipelineCompany', pipelineCompanySchema);
