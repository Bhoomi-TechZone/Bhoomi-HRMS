const mongoose = require('mongoose');

const fieldDataSchema = new mongoose.Schema({
  name: { type: String },
  values: [{ type: String }]
}, { _id: false });

const metaLeadSchema = new mongoose.Schema({
  // Facebook identifiers
  metaLeadId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  formId: {
    type: String,
    required: true,
    index: true
  },
  formName: {
    type: String,
    default: ''
  },
  pageId: {
    type: String,
    required: true,
    index: true
  },
  pageName: {
    type: String,
    default: ''
  },

  // Lead time from Meta
  createdTime: {
    type: Date,
    required: true
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
  city: {
    type: String,
    default: ''
  },
  businessCategory: {
    type: String,
    default: ''
  },
  websiteType: {
    type: String,
    default: ''
  },

  // Raw data from Meta
  fieldData: [fieldDataSchema],

  // CRM management fields
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Connected', 'Not Connected', 'Qualified', 'Interested', 'Follow-up', 'Converted', 'Not Interested', 'Closed', 'Client', 'Invalid', 'International'],
    default: 'New',
    index: true
  },
  dealStage: {
    type: String,
    enum: ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedDate: {
    type: Date,
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
  followUpCompleted: {
    type: Boolean,
    default: false,
    description: 'Whether follow-up has been completed'
  },
  followUpCompletedDate: {
    type: Date,
    description: 'When the follow-up was completed'
  },
  movedToPipeline: {
    type: Boolean,
    default: false
  },
  pipelineContactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PipelineContact',
    default: null
  },
  pipelineDealId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
    default: null
  },
  history: [{
    action: { type: String },
    details: { type: String },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, default: Date.now }
  }],

  // Platform attribution — 'fb' | 'ig' | 'website' | 'unknown'
  platform: {
    type: String,
    enum: ['fb', 'ig', 'website', 'unknown'],
    default: 'unknown',
    index: true
  },

  // Sync metadata
  syncedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
metaLeadSchema.index({ pageId: 1, formId: 1 });
metaLeadSchema.index({ status: 1, createdTime: -1 });
metaLeadSchema.index({ createdTime: -1 });

module.exports = mongoose.model('MetaLead', metaLeadSchema);
