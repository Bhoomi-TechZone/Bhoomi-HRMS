const mongoose = require('mongoose');

const formConfigSchema = new mongoose.Schema({
  formId: { type: String, required: true },
  formName: { type: String, default: '' },
  platform: { type: String, default: '' }, // 'fb' | 'ig' | '' (from Meta API)
  status: { type: String, default: 'ACTIVE' }, // ACTIVE | ARCHIVED
  isEnabled: { type: Boolean, default: true },  // Whether to sync this form
  lastSyncedAt: { type: Date, default: null },
  lastLeadTime: { type: Date, default: null }   // Newest lead createdTime seen
}, { _id: false });

const pageConfigSchema = new mongoose.Schema({
  pageId: { type: String, required: true },
  pageName: { type: String, default: '' },
  pageToken: { type: String, required: true },
  isEnabled: { type: Boolean, default: true },
  forms: [formConfigSchema]
}, { _id: false });

const metaConfigSchema = new mongoose.Schema({
  // Main user-level access token for fetching pages
  userAccessToken: {
    type: String,
    required: true
  },
  graphApiVersion: {
    type: String,
    default: 'v25.0'
  },
  pages: [pageConfigSchema],

  // Auto-sync settings
  autoSync: {
    type: Boolean,
    default: true
  },
  syncIntervalHours: {
    type: Number,
    default: 1  // sync every hour
  },
  lastFullSyncAt: {
    type: Date,
    default: null
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Singleton — only one config doc
module.exports = mongoose.model('MetaConfig', metaConfigSchema);
