const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  assetName: {
    type: String,
    required: true
  },
  brandName: {
    type: String,
    default: ''
  },
  assetType: {
    type: String,
    required: true,
  },
  assetId: {
    type: String,
    required: true,
    unique: true
  },
  serialNumber: {
    type: String,
    default: ''
  },
  deviceId: {
    type: String,
    default: ''
  },
  productId: {
    type: String,
    default: ''
  },
  model: {
    type: String,
    default: ''
  },
  colour: {
    type: String,
    default: ''
  },
  imei1: {
    type: String,
    default: ''
  },
  imei2: {
    type: String,
    default: ''
  },
  telecomProvider: {
    type: String,
    default: ''
  },
  simNumber: {
    type: String,
    default: ''
  },
  condition: {
    type: String,
    default: 'Good'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedDate: {
    type: Date
  },
  issuerSignature: {
    type: String,
    default: ''
  },
  issuerDeclarationText: {
    type: String,
    default: ''
  },
  signature: {
    type: String,
    default: ''
  },
  acknowledgement: {
    type: Boolean,
    default: false
  },
  acknowledgementText: {
    type: String,
    default: ''
  },
  signedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['available', 'assigned', 'maintenance', 'retired'],
    default: 'available'
  },
  description: {
    type: String,
    default: ''
  },
  maintenanceDetails: {
    issue: String,
    shopName: String,
    contactPerson: String,
    phoneNumber: String,
    address: String,
    sentOnDate: Date,
    updatedBy: String
  },
  assignmentHistory: [{
    statusType: {
      type: String,
      enum: ['assigned', 'maintenance'],
      default: 'assigned'
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    issuerSignature: {
      type: String,
      default: ''
    },
    issuerDeclarationText: {
      type: String,
      default: ''
    },
    signature: {
      type: String,
      default: ''
    },
    acknowledgement: {
      type: Boolean,
      default: false
    },
    acknowledgementText: {
      type: String,
      default: ''
    },
    signedAt: {
      type: Date
    },
    maintenanceDetails: {
      issue: String,
      shopName: String,
      contactPerson: String,
      phoneNumber: String,
      address: String,
      updatedBy: String
    },
    assignedDate: Date,
    returnedDate: Date
  }]
}, {
  timestamps: true
});

assetSchema.index({ createdAt: -1 });
assetSchema.index({ createdAt: 1 });
assetSchema.index({ assignedTo: 1, createdAt: -1 });
assetSchema.index({ status: 1 });
assetSchema.index({ assetType: 1 });

module.exports = mongoose.model('Asset', assetSchema);
