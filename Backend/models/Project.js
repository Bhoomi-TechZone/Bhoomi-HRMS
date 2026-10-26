const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  projectId: {
    type: String,
    unique: true,
    sparse: true
  },
  name: {
    type: String,
    required: true
  },
  clientName: {
    type: String,
    default: ''
  },
  clientCompany: {
    type: String,
    default: ''
  },
  clientEmail: {
    type: String,
    default: ''
  },
  clientPhone: {
    type: String,
    default: ''
  },
  clientAddress: {
    type: String,
    default: ''
  },
  clientCity: {
    type: String,
    default: ''
  },
  clientState: {
    type: String,
    default: ''
  },
  clientPostalCode: {
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
  gstType: {
    type: String,
    default: 'cgst_sgst'
  },
  gstRate: {
    type: Number,
    default: 18
  },
  hsnSac: {
    type: String,
    default: '9975'
  },
  description: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: ''
  },
  currency: {
    type: String,
    default: ''
  },
  projectValue: {
    type: Number,
    default: 0
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Partially Paid', 'Unpaid'],
    default: 'Unpaid'
  },
  paymentHistory: [{
    amount: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    paymentMethod: { type: String, default: 'Bank Transfer' },
    notes: { type: String, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  priority: {
    type: String,
    enum: ['high', 'medium', 'low'],
    default: 'medium'
  },
  projectTypes: [{
    type: String
  }],
  assignedEmployees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  employeeAssignmentDates: {
    type: Map,
    of: Date,
    default: {}
  },
  startDate: {
    type: Date,
    required: false
  },
  deadline: {
    type: Date,
    required: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'on-hold', 'review', 'canceled'],
    default: 'active'
  },
  statusReason: {
    type: String,
    default: ''
  },
  documents: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    path: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  activities: [{
    action: { type: String, required: true },
    message: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed
  }]
}, {
  timestamps: true
});

// Generate projectId before saving
projectSchema.pre('save', async function(next) {
  if (!this.projectId && this.isNew) {
    try {
      // Find the highest existing projectId number
      const lastProject = await mongoose.model('Project')
        .findOne({}, { projectId: 1 })
        .sort({ projectId: -1 })
        .lean();
      
      let nextNumber = 1;
      if (lastProject && lastProject.projectId) {
        // Extract number from projectId (e.g., "PRJ0121" -> 121)
        const match = lastProject.projectId.match(/PRJ(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      // Keep trying until we find an available ID (handles race conditions)
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        const candidateId = `PRJ${String(nextNumber).padStart(4, '0')}`;
        
        // Check if this ID already exists
        const existing = await mongoose.model('Project').findOne({ projectId: candidateId }).lean();
        
        if (!existing) {
          this.projectId = candidateId;
          break;
        }
        
        nextNumber++;
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique project ID after multiple attempts');
      }
      
    } catch (error) {
      return next(error);
    }
  }
  next();
});

module.exports = mongoose.model('Project', projectSchema);
