const mongoose = require('mongoose');

const aiChatLeadSchema = new mongoose.Schema({
  name: {
    type: String,
    default: 'Website Prospect',
    trim: true
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true,
    lowercase: true
  },
  service: {
    type: String,
    default: 'IT Inquiry',
    trim: true
  },
  budget: {
    type: String,
    default: 'Discuss on call',
    trim: true
  },
  status: {
    type: String,
    default: 'New Lead',
    trim: true
  },
  source: {
    type: String,
    default: 'Website AI Assistant',
    trim: true
  },
  transcript: {
    type: mongoose.Schema.Types.Mixed,
    default: ''
  },
  sessionId: {
    type: String,
    default: '',
    trim: true
  },
  notes: {
    type: String,
    default: ''
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

aiChatLeadSchema.index({ createdAt: -1 });
aiChatLeadSchema.index({ status: 1 });
aiChatLeadSchema.index({ phone: 1 });
aiChatLeadSchema.index({ email: 1 });

module.exports = mongoose.model('AIChatLead', aiChatLeadSchema);

