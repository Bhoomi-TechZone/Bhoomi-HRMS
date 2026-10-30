const mongoose = require('mongoose');

const websiteLeadSchema = new mongoose.Schema({
  // Gmail identifiers (for dedup)
  gmailMessageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  threadId: {
    type: String,
    default: ''
  },

  // Which form submitted it
  formSource: {
    type: String,
    default: 'Website',
    index: true
  },

  // Parsed CRM fields
  name: {
    type: String,
    default: ''
  },
  email: {
    type: String,
    default: '',
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    default: ''
  },
  projectType: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },

  // CRM management fields
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Interested', 'Follow-up', 'Converted', 'Not Interested', 'Closed', 'Invalid', 'International'],
    default: 'New',
    index: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  notes: {
    type: String,
    default: ''
  },
  followUpDate: {
    type: Date,
    default: null
  },
  history: [{
    action: { type: String },
    details: { type: String },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now }
  }],

  // Email metadata
  emailSubject: {
    type: String,
    default: ''
  },
  emailDate: {
    type: Date,
    default: null
  },
  rawSnippet: {
    type: String,
    default: ''
  },

  // Sync metadata
  syncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

websiteLeadSchema.index({ status: 1, createdAt: -1 });
websiteLeadSchema.index({ emailDate: -1 });
websiteLeadSchema.index({ formSource: 1, status: 1 });

module.exports = mongoose.model('WebsiteLead', websiteLeadSchema);
