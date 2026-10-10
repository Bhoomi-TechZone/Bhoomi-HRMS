const mongoose = require('mongoose');

const accessPolicyAuditSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: [
      'CREATE_POLICY',
      'UPDATE_POLICY',
      'DELETE_POLICY',
      'ADD_WEBSITE',
      'REMOVE_WEBSITE',
      'ADD_APPLICATION',
      'REMOVE_APPLICATION',
      'ASSIGN_EMPLOYEE',
      'UNASSIGN_EMPLOYEE',
      'ACTIVATE_POLICY',
      'DEACTIVATE_POLICY',
      'ROLLBACK_POLICY'
    ],
    required: true,
    index: true
  },
  policy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccessPolicy',
    index: true
  },
  target: {
    type: String,
    trim: true,
    default: ''
  },
  previousVersion: {
    type: Number
  },
  newVersion: {
    type: Number
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
  timestamps: { createdAt: true, updatedAt: false }
});

module.exports = mongoose.model('AccessPolicyAudit', accessPolicyAuditSchema);
