const mongoose = require('mongoose');

const aiSensyMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: String,
      required: true,
      index: true
    },
    destination: {
      type: String,
      required: true,
      index: true
    },
    contactName: {
      type: String,
      default: 'Contact',
      trim: true
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'outbound',
      index: true
    },
    messageType: {
      type: String,
      enum: ['text', 'campaign', 'media', 'template'],
      default: 'text'
    },
    text: {
      type: String,
      default: ''
    },
    mediaUrl: {
      type: String,
      default: ''
    },
    mediaFilename: {
      type: String,
      default: ''
    },
    campaignName: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent'
    },
    statusCode: {
      type: Number,
      default: 200
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

module.exports = mongoose.model('AiSensyMessage', aiSensyMessageSchema);

