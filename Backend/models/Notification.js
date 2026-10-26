const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Task', 'Leave', 'Attendance', 'Announcement', 'Project', 'General', 'Deal', 'Contact', 'Company', 'CRM', 'Client', 'Follow-up', 'Followup', 'Lead'],
    default: 'General'
  },
  link: {
    type: String,
    default: ''
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 30 * 24 * 60 * 60 // Auto-delete after 30 days
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Notification', notificationSchema);
