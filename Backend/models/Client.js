const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
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
  source: {
    type: String,
    default: 'Lead Conversion'
  },
  requirements: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  dealValue: {
    type: Number,
    default: 0
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  relatedDeal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Deal',
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
  convertedAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },

  // ── Basic / Personal Details ──────────────────────────────────
  firstName: { type: String, default: '', trim: true },
  lastName:  { type: String, default: '', trim: true },
  phoneCountryCode:    { type: String, default: '+91' },
  altPhoneCountryCode: { type: String, default: '+91' },
  alternatePhone: { type: String, default: '', trim: true },
  personalEmail:  { type: String, default: '', lowercase: true, trim: true },
  personalAddress: {
    country:    { type: String, default: '' },
    state:      { type: String, default: '' },
    city:       { type: String, default: '' },
    postalCode: { type: String, default: '' },
  },

  // ── Company Details ───────────────────────────────────────────
  ownedBy:            { type: String, default: '', trim: true },
  businessIdentifier: { type: String, default: 'GSTIN', trim: true },
  registrationNo:     { type: String, default: '', trim: true },
  gstNo:              { type: String, default: '', trim: true },
  companyContactCode: { type: String, default: '+91' },
  companyContactNo:   { type: String, default: '', trim: true },
  companyAltCode:     { type: String, default: '+91' },
  companyAltNo:       { type: String, default: '', trim: true },
  businessEmail:      { type: String, default: '', lowercase: true, trim: true },
  companyAddress: {
    country:    { type: String, default: '' },
    state:      { type: String, default: '' },
    city:       { type: String, default: '' },
    postalCode: { type: String, default: '' },
  },
}, {
  timestamps: true
});

clientSchema.index({ createdAt: -1 });
clientSchema.index({ assignedTo: 1 });

module.exports = mongoose.model('Client', clientSchema);
