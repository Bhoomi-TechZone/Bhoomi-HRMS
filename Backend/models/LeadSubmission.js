const mongoose = require('mongoose');

const LeadSubmissionSchema = new mongoose.Schema(
  {
    leadName: {
      type: String,
      required: true,
      trim: true
    },
    contactNumber: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['New', 'In Progress', 'Contacted', 'Interested', 'Not Interested', 'Converted', 'Invalid', 'International'],
      default: 'New'
    },
    updates: {
      type: String,
      default: '',
      trim: true
    },
    contactedCount: {
      type: Number,
      default: 0
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeadSubmission', LeadSubmissionSchema);
