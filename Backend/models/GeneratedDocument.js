const mongoose = require('mongoose');

const generatedDocumentSchema = new mongoose.Schema({
  documentNumber: {
    type: String,
    unique: true
    // Not required since it's auto-generated in pre-save hook
  },
  template: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DocumentTemplate',
    required: false  // Made optional for custom letters without templates
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  title: {
    type: String,
    required: true
  },
  placeholderData: {
    type: Map,
    of: String
  },
  finalHtml: {
    type: String,
    required: true
  },
  pdfPath: {
    type: String
  },
  pdfUrl: {
    type: String
  },
  status: {
    type: String,
    enum: ['draft', 'generated', 'sent', 'signed'],
    default: 'draft'
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sentTo: {
    email: String,
    date: Date
  },
  metadata: {
    clientName: String,
    position: String,
    department: String,
    templateName: String,
    joiningDate: Date,
    salary: Number,
    location: String
  }
}, {
  timestamps: true
});

// Auto-increment document number
generatedDocumentSchema.pre('save', async function(next) {
  if (!this.documentNumber) {
    const year = new Date().getFullYear();
    const prefix = `DOC-${year}-`;
    const last = await this.constructor
      .findOne({ documentNumber: { $regex: `^${prefix}` } })
      .sort({ documentNumber: -1 })
      .select('documentNumber')
      .lean();
    const lastNum = last ? parseInt(last.documentNumber.replace(prefix, ''), 10) : 0;
    this.documentNumber = `${prefix}${String(lastNum + 1).padStart(5, '0')}`;
  }
  next();
});

module.exports = mongoose.model('GeneratedDocument', generatedDocumentSchema);
