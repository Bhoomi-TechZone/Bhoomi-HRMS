const mongoose = require('mongoose');

const taskRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  requestTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false
  },
  projectName: {
    type: String,
    default: ''
  },
  taskTitle: {
    type: String,
    required: true,
    trim: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Moderate', 'High'],
    default: 'Low'
  },
  status: {
    type: String,
    enum: ['Progress', 'Pending', 'Completed', 'Cancelled', 'Hold'],
    default: 'Pending'
  },
  notes: {
    type: String,
    default: ''
  },
  remarks: {
    type: String,
    default: ''
  },
  requestedDate: {
    type: Date,
    required: true
  },
  deadlineDate: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TaskRequest', taskRequestSchema);
