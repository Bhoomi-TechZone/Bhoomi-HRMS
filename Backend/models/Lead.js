const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    default: '',
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  company: {
    type: String,
    default: '',
    trim: true
  },
  country: {
    type: String,
    default: '',
    trim: true
  },
  industry: {
    type: String,
    default: '',
    trim: true
  },
  date: {
    type: Date,
    description: 'User-specified date for the lead (e.g., from manual form or Excel)'
  },
  addedOn: {
    type: Date,
    default: Date.now,
    description: 'System timestamp when lead was added to the database'
  },
  source: {
    type: String,
    required: true
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  budget: {
    type: Number,
    default: 0
  },
  requirement: {
    type: String,
    default: ''
  },
  requirements: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  followUpNotes: {
    type: String,
    default: ''
  },
  nextFollowUp: {
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
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Connected', 'Not Connected', 'Qualified', 'Interested', 'Follow-up', 'Converted', 'Not Interested', 'Lost', 'Closed', 'Client', 'Invalid', 'International'],
    default: 'New',
    index: true
  },
  leadType: {
    type: String,
    enum: ['Hot', 'Warm', 'Cold'],
    default: null
  },
  dealStage: {
    type: String,
    enum: ['Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
    default: null
  },
  convertedDate: {
    type: Date,
    default: null
  },
  lostReason: {
    type: String,
    default: ''
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
  }]
}, {
  timestamps: true
});

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ phone: 1 });

module.exports = mongoose.model('Lead', leadSchema);
