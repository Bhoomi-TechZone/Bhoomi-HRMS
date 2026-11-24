const mongoose = require('mongoose');

const employeeAuditLogSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  employeeName: {
    type: String,
    required: true
  },
  employeeId: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    enum: ['DEACTIVATED', 'ACTIVATED', 'EDITED', 'PASSWORD_CHANGED', 'ACCESS_CONTROL_UPDATED', 'CREATED', 'STATUS_CHANGE'],
    required: true,
    index: true
  },
  actionTitle: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  performedByName: {
    type: String,
    default: 'Admin'
  },
  performedByEmail: {
    type: String,
    default: ''
  },
  performedByRole: {
    type: String,
    default: ''
  },
  changes: [{
    field: { type: String },
    fieldLabel: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    description: { type: String }
  }],
  summary: {
    type: String,
    default: ''
  },
  timezone: {
    type: String,
    default: 'Asia/Kolkata (IST)'
  },
  ipAddress: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EmployeeAuditLog', employeeAuditLogSchema);
