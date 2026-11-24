const mongoose = require('mongoose');

const whatsAppWebhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      default: '',
      index: true
    },
    eventType: {
      type: String,
      default: 'message', // 'message' | 'status' | 'unknown'
      index: true
    },
    wabaId: {
      type: String,
      default: '',
      index: true
    },
    phoneNumberId: {
      type: String,
      default: '',
      index: true
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    processed: {
      type: Boolean,
      default: true
    },
    error: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

whatsAppWebhookEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('WhatsAppWebhookEvent', whatsAppWebhookEventSchema);
