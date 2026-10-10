const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNo: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  invoiceCategory: {
    type: String,
    enum: ['tax', 'proforma'],
    default: 'tax'
  },
  invoiceType: {
    type: String,
    default: 'Tax Invoice'
  },
  invoiceDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  dueDate: {
    type: String,
    default: () => new Date().toISOString().split('T')[0]
  },
  prefillProjectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null
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
  clientPhone: {
    type: String,
    default: '',
    trim: true
  },
  clientAddress: {
    type: String,
    default: ''
  },
  clientCity: {
    type: String,
    default: ''
  },
  clientPostalCode: {
    type: String,
    default: ''
  },
  clientState: {
    type: String,
    default: ''
  },
  clientGstin: {
    type: String,
    default: ''
  },
  clientPan: {
    type: String,
    default: ''
  },
  projectName: {
    type: String,
    default: ''
  },
  itemDescription: {
    type: String,
    required: true
  },
  itemDetails: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  hsnSac: {
    type: String,
    default: '9975'
  },
  qty: {
    type: String,
    default: '1'
  },
  rate: {
    type: String,
    default: '0'
  },
  discount: {
    type: String,
    default: '0'
  },
  gstType: {
    type: String,
    enum: ['cgst_sgst', 'igst', 'none'],
    default: 'cgst_sgst'
  },
  gstRate: {
    type: String,
    default: '18'
  },
  advanceAmount: {
    type: String,
    default: '0'
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  baseAmount: {
    type: Number,
    default: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  dueAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    default: 'Generated'
  },
  projectStatus: {
    type: String,
    default: 'Active'
  },
  generatedBy: {
    type: String,
    default: 'Admin'
  },
  generatedOn: {
    type: String,
    default: () => new Date().toISOString()
  },
  rawForm: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ clientName: 1 });
invoiceSchema.index({ prefillProjectId: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
