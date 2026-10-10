const mongoose = require('mongoose');

const paymentRecordSchema = new mongoose.Schema({
  dealId: {
    type: String,
    index: true,
    default: null
  },
  contactId: {
    type: String,
    index: true,
    default: null
  },
  srNo: {
    type: Number,
    default: 1
  },
  clientName: {
    type: String,
    required: true,
    trim: true
  },
  clientEmail: {
    type: String,
    default: '',
    trim: true
  },
  projectName: {
    type: String,
    required: true,
    trim: true
  },
  paidAmount: {
    type: String,
    required: true,
    trim: true
  },
  paymentMode: {
    type: String,
    required: true,
    default: 'Bank Transfer'
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Partial', 'Overdue', 'Cancelled'],
    default: 'Paid'
  },
  paymentDate: {
    type: String,
    required: true
  },
  recordedOnDate: {
    type: String,
    default: ''
  },
  recordedOnTime: {
    type: String,
    default: ''
  },
  recordedOn: {
    type: String,
    default: ''
  },
  attachmentName: {
    type: String,
    default: ''
  },
  attachmentPath: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

paymentRecordSchema.index({ dealId: 1, createdAt: -1 });
paymentRecordSchema.index({ contactId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentRecord', paymentRecordSchema);
