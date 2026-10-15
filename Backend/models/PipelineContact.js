const mongoose = require('mongoose');

const pipelineContactSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    default: '',
    trim: true
  },
  email: {
    type: String,
    required: false,
    default: undefined,
    lowercase: true,
    trim: true
  },
  countryCode: {
    type: String,
    default: '+1'
  },
  phone: {
    type: String,
    default: '',
    trim: true
  },
  origin: {
    type: String,
    enum: ['Domestic', 'International', ''],
    default: 'Domestic',
    trim: true
  },
  contactSource: {
    type: String,
    default: ''
  },
  leadStage: {
    type: String,
    default: ''
  },
  leadStatus: {
    type: String,
    default: ''
  },
  owner: {
    type: String,
    default: 'Artiflow'
  },
  addedBy: {
    type: String,
    default: ''
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  company: {
    type: String,
    default: '',
    trim: true
  },
  address: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  activities: [{
    type: { type: String, default: 'note' },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    author: { type: String, default: '' },
    time: { type: String, default: '' },
    date: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  relatedLead: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  leadRecordType: {
    type: String,
    default: ''
  },
  isUnmoved: {
    type: Boolean,
    default: false,
    index: true
  },
  unmovedAt: {
    type: Date,
    default: null
  },
  unmovedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

pipelineContactSchema.index(
  { email: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { email: { $type: 'string', $gt: '' } }
  }
);
pipelineContactSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PipelineContact', pipelineContactSchema);
