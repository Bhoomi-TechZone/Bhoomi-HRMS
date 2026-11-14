const mongoose = require('mongoose');

const aiSensyTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    campaignName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    category: {
      type: String,
      enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'],
      default: 'MARKETING'
    },
    headerType: {
      type: String,
      enum: ['IMAGE', 'VIDEO', 'DOCUMENT', 'TEXT', 'NONE'],
      default: 'IMAGE'
    },
    headerMediaUrl: {
      type: String,
      default: 'https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6353da2e153a147b991dd812/4958901_highanglekidcheatingschooltestmin.jpg',
      trim: true
    },
    headerTitle: {
      type: String,
      default: '',
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    templateParams: {
      type: [String],
      default: ['$FirstName']
    },
    paramsFallbackValue: {
      type: mongoose.Schema.Types.Mixed,
      default: { FirstName: 'user' }
    },
    buttons: [
      {
        type: { type: String, default: 'QUICK_REPLY' },
        text: { type: String, default: '' },
        url: { type: String, default: '' }
      }
    ],
    isDefault: {
      type: Boolean,
      default: false
    },
    tags: [String],
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    assignedRoles: [
      {
        type: String,
        trim: true
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AiSensyTemplate', aiSensyTemplateSchema);

