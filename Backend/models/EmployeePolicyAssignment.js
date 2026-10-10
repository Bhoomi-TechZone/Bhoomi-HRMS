const mongoose = require('mongoose');

const employeePolicyAssignmentSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true, // V1 Requirement: Exactly one active policy per employee
    index: true
  },
  policy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccessPolicy',
    required: true,
    index: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('EmployeePolicyAssignment', employeePolicyAssignmentSchema);
