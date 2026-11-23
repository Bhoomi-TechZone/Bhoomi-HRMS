const mongoose = require('mongoose');

const whatsAppMessageSchema = new mongoose.Schema(
  {
    // Unique Meta WhatsApp Message ID (e.g. wamid.HBgL...)
    wamid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    // WhatsApp Business Account ID (WABA ID)
    wabaId: {
      type: String,
      default: '',
      index: true,
      trim: true
    },
    // WhatsApp Business Phone Number ID
    phoneNumberId: {
      type: String,
      default: '',
      index: true,
      trim: true
    },
    // Business Display Phone Number (e.g. +91 95489 61117)
    displayPhoneNumber: {
      type: String,
      default: '',
      trim: true
    },
    // Message Direction: 'inbound' (from customer) or 'outbound' (from business)
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'inbound',
      index: true
    },
    // Sender phone number (wa_id / phone digits)
    from: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    // Recipient phone number
    to: {
      type: String,
      default: '',
      trim: true
    },
    // Sender profile name provided by WhatsApp
    contactName: {
      type: String,
      default: 'WhatsApp User',
      trim: true
    },
    // Type of message
    messageType: {
      type: String,
      enum: [
        'text',
        'image',
        'video',
        'audio',
        'document',
        'location',
        'contacts',
        'interactive',
        'button',
        'reaction',
        'sticker',
        'unsupported',
        'unknown'
      ],
      default: 'text'
    },
    // Message body (for text or summary description of media)
    text: {
      type: String,
      default: ''
    },
    // Media attachment information
    media: {
      id: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      sha256: { type: String, default: '' },
      caption: { type: String, default: '' },
      filename: { type: String, default: '' },
      url: { type: String, default: '' },
      localPath: { type: String, default: '' }
    },
    // Location information
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      name: { type: String, default: '' },
      address: { type: String, default: '' }
    },
    // Interactive button or list response
    interactive: {
      type: { type: String, default: '' }, // 'button_reply' | 'list_reply'
      buttonId: { type: String, default: '' },
      buttonTitle: { type: String, default: '' },
      listId: { type: String, default: '' },
      listTitle: { type: String, default: '' },
      listDescription: { type: String, default: '' }
    },
    // Quick reply button response
    button: {
      text: { type: String, default: '' },
      payload: { type: String, default: '' }
    },
    // Message reaction
    reaction: {
      messageId: { type: String, default: '' },
      emoji: { type: String, default: '' }
    },
    // Current delivery status
    status: {
      type: String,
      enum: ['received', 'sent', 'delivered', 'read', 'failed'],
      default: 'received',
      index: true
    },
    // Full status transition audit trail
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        recipientId: { type: String, default: '' },
        errorDetails: { type: Array, default: [] },
        raw: { type: mongoose.Schema.Types.Mixed }
      }
    ],
    // Timestamp from Meta payload
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    // Associations with existing CRM entities
    associatedLead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true
    },
    associatedContact: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PipelineContact',
      default: null,
      index: true
    },
    associatedDeal: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      default: null,
      index: true
    },
    // Read status in HRMS CRM inbox
    isReadByAdmin: {
      type: Boolean,
      default: false
    },
    // Complete raw event object for auditing
    rawPayload: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Helpful compound indexes for CRM lookups
whatsAppMessageSchema.index({ from: 1, timestamp: -1 });
whatsAppMessageSchema.index({ associatedDeal: 1, timestamp: -1 });
whatsAppMessageSchema.index({ associatedContact: 1, timestamp: -1 });
whatsAppMessageSchema.index({ associatedLead: 1, timestamp: -1 });

module.exports = mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
