const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  // Deal Basic Information
  dealName: {
    type: String,
    required: true,
    trim: true
  },
  clientName: {
    type: String,
    required: true,
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
  
  // Pipeline & Stage
  pipeline: {
    type: String,
    default: 'Sales Pipeline',
    trim: true
  },
  stage: {
    type: String,
    required: true,
    default: 'New'
  },
  
  // Deal Financials
  dealValue: {
    type: Number,
    required: true,
    default: 0
  },
  currency: {
    type: String,
    default: '$'
  },
  dealType: {
    type: String,
    default: 'New Business'
  },
  
  // Probability & Dates
  probability: {
    type: Number,
    min: 0,
    max: 100,
    default: 10
  },
  expectedCloseDate: {
    type: Date,
    default: null
  },
  actualCloseDate: {
    type: Date,
    default: null
  },
  
  // Ownership & Location
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  salesOwner: {
    type: String,
    default: 'Akhil Verma'
  },
  location: {
    type: String,
    default: 'Pune, India'
  },
  
  // Deal Source & Relations
  source: {
    type: String,
    default: 'Direct'
  },
  contactId: {
    type: String,
    default: null
  },
  relatedLead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    default: null
  },
  relatedMetaLead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MetaLead',
    default: null
  },
  
  // Deal Details & Requirements
  description: {
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
  lostReason: {
    type: String,
    default: ''
  },

  // Milestone Status Tracking
  milestoneStatuses: {
    type: Map,
    of: String,
    default: {}
  },

  // Activities Log
  activities: [{
    type: { type: String, default: 'note' },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    remarks: { type: String, default: '' },
    channel: { type: String, default: 'Call' },
    status: { type: String, default: 'Scheduled' },
    followUpDate: { type: String, default: '' },
    followUpTime: { type: String, default: '' },
    nextFollowUpDate: { type: String, default: '' },
    author: { type: String, default: '' },
    authorRole: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedToName: { type: String, default: '' },
    member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    memberId: { type: String, default: '' },
    memberName: { type: String, default: '' },
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: { type: Date, default: null },
    time: { type: String, default: '' },
    date: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Created By
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  addedBy: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for faster queries
dealSchema.index({ assignedTo: 1, stage: 1 });
dealSchema.index({ pipeline: 1 });
dealSchema.index({ createdAt: -1 });
dealSchema.index({ expectedCloseDate: 1 });

module.exports = mongoose.model('Deal', dealSchema);
