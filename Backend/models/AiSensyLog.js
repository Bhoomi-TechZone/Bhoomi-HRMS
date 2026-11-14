const mongoose = require('mongoose');

const aiSensyLogSchema = new mongoose.Schema(
  {
    campaignName: {
      type: String,
      default: 'CRM'
    },
    destination: {
      type: String,
      required: true,
      index: true
    },
    userName: {
      type: String,
      default: 'Lead Gen Campaign'
    },
    templateParams: {
      type: [String],
      default: ['$FirstName']
    },
    source: {
      type: String,
      default: 'new-landing-page form'
    },
    media: {
      url: { type: String, default: '' },
      filename: { type: String, default: '' }
    },
    buttons: {
      type: Array,
      default: []
    },
    carouselCards: {
      type: Array,
      default: []
    },
    location: {
      type: Object,
      default: {}
    },
    attributes: {
      type: Object,
      default: {}
    },
    paramsFallbackValue: {
      type: Object,
      default: { FirstName: 'user' }
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'PENDING'],
      default: 'PENDING',
      index: true
    },
    statusCode: {
      type: Number,
      default: null
    },
    responseMessage: {
      type: String,
      default: ''
    },
    apiResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AiSensyLog', aiSensyLogSchema);

