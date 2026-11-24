const mongoose = require('mongoose');

const aiSensyContactSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AiSensyGroup',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    email: {
      type: String,
      default: '',
      trim: true
    },
    company: {
      type: String,
      default: '',
      trim: true
    },
    tags: [
      {
        type: String,
        trim: true
      }
    ],
    source: {
      type: String,
      default: 'manual', // 'manual' | 'csv_import' | 'crm_lead'
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate phone numbers within the same group for the same user
aiSensyContactSchema.index({ groupId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model('AiSensyContact', aiSensyContactSchema);
