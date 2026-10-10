const mongoose = require('mongoose');
const { normalizeDomain } = require('../utils/domainNormalizer');

const blockedWebsiteSchema = new mongoose.Schema({
  domain: {
    type: String,
    required: true,
    trim: true,
    set: normalizeDomain
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const blockedApplicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  executable: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: true });

const accessPolicySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Policy name is required'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  version: {
    type: Number,
    default: 1
  },
  blockedWebsites: [blockedWebsiteSchema],
  blockedApplications: [blockedApplicationSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Clean up duplicate domains / executables before saving
accessPolicySchema.pre('save', function(next) {
  if (this.blockedWebsites && this.blockedWebsites.length > 0) {
    const seenWebsites = new Set();
    this.blockedWebsites = this.blockedWebsites.filter(item => {
      const norm = normalizeDomain(item.domain);
      if (!norm || seenWebsites.has(norm)) return false;
      seenWebsites.add(norm);
      item.domain = norm;
      return true;
    });
  }

  if (this.blockedApplications && this.blockedApplications.length > 0) {
    const seenApps = new Set();
    this.blockedApplications = this.blockedApplications.filter(item => {
      const normExec = item.executable ? item.executable.trim().toLowerCase() : '';
      if (!normExec || seenApps.has(normExec)) return false;
      seenApps.add(normExec);
      item.executable = normExec;
      return true;
    });
  }
  next();
});

module.exports = mongoose.model('AccessPolicy', accessPolicySchema);
