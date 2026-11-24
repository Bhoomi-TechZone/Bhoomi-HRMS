const mongoose = require('mongoose');
const crypto = require('crypto');

// Encryption key from env or fallback
const ENCRYPTION_KEY = process.env.WHATSAPP_TOKEN_SECRET || process.env.JWT_SECRET || 'bhoomi_hrms_whatsapp_secure_enc_key_32bytes!';
const IV_LENGTH = 16;

function encrypt(text) {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text || '';
  try {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Error decrypting token:', err.message);
    return '';
  }
}

const whatsAppConnectionSchema = new mongoose.Schema(
  {
    // Associated HRMS Employee / User
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    employeeName: {
      type: String,
      default: '',
      trim: true
    },
    employeeEmail: {
      type: String,
      default: '',
      lowercase: true,
      trim: true
    },
    // WhatsApp Business Account ID (WABA ID)
    wabaId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },
    // WhatsApp Phone Number ID assigned by Meta
    phoneNumberId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },
    // Display Phone Number (e.g. +91 95489 61117)
    displayPhoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    // Verified Business Name / Profile Name in Meta
    verifiedName: {
      type: String,
      default: 'Bhoomi TechZone',
      trim: true
    },
    // Connection Status
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'pending', 'expired'],
      default: 'connected',
      index: true
    },
    // Quality rating given by Meta (GREEN, YELLOW, RED, UNKNOWN)
    qualityRating: {
      type: String,
      default: 'GREEN'
    },
    // Encrypted token for server-side Meta Graph API calls
    accessTokenEncrypted: {
      type: String,
      default: ''
    },
    // Is this the fallback default company number?
    isDefault: {
      type: Boolean,
      default: false
    },
    // Last active time
    lastActiveAt: {
      type: Date,
      default: Date.now
    },
    // Extra Meta metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Method to set token securely
whatsAppConnectionSchema.methods.setAccessToken = function(token) {
  if (token) {
    this.accessTokenEncrypted = encrypt(token);
  }
};

// Method to retrieve decrypted token
whatsAppConnectionSchema.methods.getAccessToken = function() {
  if (!this.accessTokenEncrypted) {
    return process.env.WHATSAPP_ACCESS_TOKEN || '';
  }
  return decrypt(this.accessTokenEncrypted) || process.env.WHATSAPP_ACCESS_TOKEN || '';
};

module.exports = mongoose.model('WhatsAppConnection', whatsAppConnectionSchema);
