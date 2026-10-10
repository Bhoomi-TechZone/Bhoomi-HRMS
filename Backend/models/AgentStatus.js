const mongoose = require('mongoose');

const agentStatusSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  version: {
    type: String,
    required: true
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  // Policy & Enforcement Status Extensions
  activePolicyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccessPolicy',
    default: null
  },
  policyVersion: {
    type: Number,
    default: null
  },
  enforcementVersion: {
    type: Number,
    default: null
  },
  lastPolicySyncAt: {
    type: Date,
    default: null
  },
  lastEnforcementCheckAt: {
    type: Date,
    default: null
  },
  enforcementStatus: {
    type: String,
    enum: [
      'NOT_INSTALLED',
      'STARTING',
      'SYNCING',
      'ACTIVE',
      'LIMITED',
      'UNSUPPORTED',
      'ERROR',
      'OFFLINE_USING_CACHE'
    ],
    default: 'NOT_INSTALLED'
  },
  appEnforcementStatus: {
    type: String,
    enum: ['ACTIVE', 'LIMITED', 'UNSUPPORTED', 'ERROR', 'NOT_INSTALLED'],
    default: 'NOT_INSTALLED'
  },
  webEnforcementStatus: {
    type: String,
    enum: ['ACTIVE', 'LIMITED', 'UNSUPPORTED', 'ERROR', 'NOT_INSTALLED'],
    default: 'NOT_INSTALLED'
  },
  lastEnforcementError: {
    type: String,
    default: ''
  },
  windowsVersion: {
    type: String,
    default: ''
  },
  windowsBuild: {
    type: String,
    default: ''
  },
  windowsEdition: {
    type: String,
    default: ''
  },
  appControlSupported: {
    type: Boolean,
    default: false
  },
  webControlSupported: {
    type: Boolean,
    default: false
  },
  limitationReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AgentStatus', agentStatusSchema);
