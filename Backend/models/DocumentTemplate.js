const mongoose = require('mongoose');

const documentTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['offer_letter', 'joining_letter', 'experience_letter', 'relieving_letter', 'salary_certificate', 'appraisal_letter', 'promotion_letter', 'warning_letter', 'nda', 'custom'],
    default: 'custom'
  },
  description: {
    type: String,
    trim: true
  },
  htmlContent: {
    type: String,
    required: true
  },
  placeholders: [{
    key: String,
    label: String,
    type: {
      type: String,
      enum: ['text', 'date', 'number', 'textarea', 'select'],
      default: 'text'
    },
    required: {
      type: Boolean,
      default: false
    },
    options: [String], // For select type
    defaultValue: String
  }],
  editableSections: [{
    sectionId: String,
    label: String,
    allowFormatting: {
      type: Boolean,
      default: true
    }
  }],
  styles: {
    type: String, // CSS styles
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DocumentTemplate', documentTemplateSchema);
