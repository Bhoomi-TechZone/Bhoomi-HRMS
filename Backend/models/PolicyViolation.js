const mongoose = require('mongoose');

const policyViolationSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  device: {
    type: String,
    trim: true,
    default: 'unknown-device'
  },
  policy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccessPolicy',
    required: true,
    index: true
  },
  policyVersion: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['WEBSITE', 'APPLICATION'],
    required: true,
    index: true
  },
  target: {
    type: String,
    required: true,
    trim: true
  },
  action: {
    type: String,
    enum: ['BLOCKED', 'AUDIT_DETECTED'],
    default: 'BLOCKED'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PolicyViolation', policyViolationSchema);
