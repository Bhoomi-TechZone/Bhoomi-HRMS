const mongoose = require('mongoose');

const ndaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  agreementUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    agreedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    version: Number
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('NDA', ndaSchema);
