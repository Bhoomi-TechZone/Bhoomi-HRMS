const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leaveCategory: {
    type: String,
    required: true,
    enum: ['Casual Leave', 'Unpaid Leave'],
    default: 'Casual Leave'
  },
  leaveType: {
    type: String,
    required: true,
    enum: ['Medical', 'Personal', 'Bereavement', 'Maternity', 'Other'],
    default: 'Personal'
  },
  durationType: {
    type: String,
    required: true,
    enum: ['Full Day', 'Half Day', 'Short Leave'],
    default: 'Full Day'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  attachmentFileName: {
    type: String
  },
  attachmentFilePath: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  adminResponse: {
    type: String
  },
  timeline: [{
    type: {
      type: String,
      enum: ['status_change', 'message', 'assignment', 'created'],
      default: 'message'
    },
    message: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Leave', leaveSchema);
