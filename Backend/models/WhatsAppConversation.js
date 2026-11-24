const mongoose = require('mongoose');

const whatsAppConversationSchema = new mongoose.Schema(
  {
    // Associated Deal
    dealId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Deal',
      required: true,
      index: true
    },
    dealName: {
      type: String,
      default: '',
      trim: true
    },
    // Customer Contact Details
    contactPhone: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    contactName: {
      type: String,
      default: 'Customer',
      trim: true
    },
    // Deal Owner (Salesperson)
    dealOwner: {
      type: String,
      default: '',
      trim: true
    },
    dealOwnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    // WhatsApp Connection mapped to Deal Owner
    connectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppConnection',
      default: null,
      index: true
    },
    // Meta Phone Number ID used for this conversation
    phoneNumberId: {
      type: String,
      default: '',
      index: true,
      trim: true
    },
    // Last Message Preview
    lastMessage: {
      type: String,
      default: ''
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    lastMessageDirection: {
      type: String,
      enum: ['inbound', 'outbound'],
      default: 'outbound'
    },
    lastMessageStatus: {
      type: String,
      default: 'sent'
    },
    // Unread count
    unreadCount: {
      type: Number,
      default: 0
    },
    // Conversation State
    status: {
      type: String,
      enum: ['active', 'archived'],
      default: 'active'
    }
  },
  {
    timestamps: true
  }
);

whatsAppConversationSchema.index({ dealId: 1, contactPhone: 1 });
whatsAppConversationSchema.index({ dealOwnerId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('WhatsAppConversation', whatsAppConversationSchema);
