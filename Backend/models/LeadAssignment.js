const mongoose = require('mongoose');

const leadAssignmentSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Core Lead Info
  name: {
    type: String,
    description: 'Contact/buyer name'
  },
  contactNumber: {
    type: String,
    required: true
  },
  email: {
    type: String
  },
  company: {
    type: String
  },
  // Additional Fields from Excel
  source: {
    type: String,
    description: 'Lead source (e.g., Website, Referral, etc.)'
  },
  product: {
    type: String,
    description: 'Product/Service interested in'
  },
  city: {
    type: String
  },
  state: {
    type: String
  },
  address: {
    type: String
  },
  designation: {
    type: String,
    description: 'Contact person designation'
  },
  industry: {
    type: String
  },
  description: {
    type: String,
    description: 'Client requirements/description'
  },
  leadDate: {
    type: Date,
    description: 'Date when lead was received'
  },
  // Store all extra columns from Excel
  extraFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Qualified', 'Interested', 'Follow-up', 'Converted', 'Not Interested', 'Closed', 'Invalid', 'International'],
    default: 'New'
  },
  history: [{
    action: String, // e.g., 'Status Change', 'Note Added', 'Call Logged'
    details: String,
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  value: {
    type: Number
  },
  notes: {
    type: String
  },
  // Follow-up fields
  nextFollowUp: {
    type: Date,
    description: 'Date for next follow-up'
  },
  followUpNotes: {
    type: String,
    description: 'Notes about what to discuss in follow-up'
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
  followUpCompletedNotes: {
    type: String,
    description: 'Notes from the completed follow-up'
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadedFile: {
    type: String
  },
  // Lead Scoring & Priority
  score: {
    type: Number,
    default: 0
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LeadAssignment', leadAssignmentSchema);
