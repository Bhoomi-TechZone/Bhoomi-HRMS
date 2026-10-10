const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  // Vendor Profile Details
  vendorName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    default: ''
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  alternatePhone: {
    type: String,
    trim: true,
    default: ''
  },
  location: {
    type: String,
    trim: true,
    default: ''
  },

  // Profile vs Order distinction
  isProfileOnly: {
    type: Boolean,
    default: false
  },

  // Order / Purchase Details
  productName: {
    type: String,
    trim: true,
    default: ''
  },
  amount: {
    type: Number,
    min: 0,
    default: 0
  },
  unit: {
    type: String,
    default: 'Pcs'
  },
  quantity: {
    type: Number,
    min: 1,
    default: 1
  },
  paymentMode: {
    type: String,
    default: 'Bank Transfer / NEFT'
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Partially Paid', 'Draft', 'Active'],
    default: 'Paid'
  },
  invoiceNumber: {
    type: String,
    trim: true,
    default: ''
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    default: ''
  },

  // Attachment (Invoice / Receipt / Bill document)
  attachment: {
    type: String,
    default: ''
  },
  attachmentName: {
    type: String,
    default: ''
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Vendor', vendorSchema);
