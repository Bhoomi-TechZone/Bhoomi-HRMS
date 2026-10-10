const mongoose = require('mongoose');

const accessPolicyRevisionSchema = new mongoose.Schema({
  policyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccessPolicy',
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true
  },
  snapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  changeType: {
    type: String,
    enum: [
      'CREATE_POLICY',
      'UPDATE_POLICY',
      'ADD_WEBSITE',
      'REMOVE_WEBSITE',
      'ADD_APPLICATION',
      'REMOVE_APPLICATION',
      'ACTIVATE_POLICY',
      'DEACTIVATE_POLICY',
      'ROLLBACK_POLICY'
    ],
    required: true
  },
  changeSummary: {
    type: String,
    trim: true,
    default: ''
  }
}, {
  timestamps: { createdAt: true, updatedAt: false }
});

accessPolicyRevisionSchema.index({ policyId: 1, version: 1 }, { unique: true });

module.exports = mongoose.model('AccessPolicyRevision', accessPolicyRevisionSchema);
