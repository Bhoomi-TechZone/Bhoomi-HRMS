const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    default: ''
  },
  employeeId: {
    type: String,
    unique: true,
    required: true
  },
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: true
  },
  department: {
    type: String,
    default: ''
  },
  designation: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  alternatePhone: {
    type: String,
    default: ''
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  dateOfBirth: {
    type: Date,
    default: null
  },
  fatherName: {
    type: String,
    default: ''
  },
  highestQualification: {
    type: String,
    default: ''
  },
  officialEmail: {
    type: String,
    default: ''
  },
  currentAddress: {
    type: String,
    default: ''
  },
  permanentAddress: {
    type: String,
    default: ''
  },
  aadharNumber: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Banking Details
  bankName: {
    type: String,
    default: ''
  },
  accountNumber: {
    type: String,
    default: ''
  },
  ifscCode: {
    type: String,
    default: ''
  },
  accountHolderName: {
    type: String,
    default: ''
  },
  panNumber: {
    type: String,
    default: ''
  },
  upiId: {
    type: String,
    default: ''
  },
  // Payment QR Code
  paymentQRCode: {
    type: String,
    default: ''
  },
  // Bank Details Verification
  bankDetailsStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  bankDetailsVerifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  bankDetailsVerifiedAt: {
    type: Date
  },
  bankDetailsRejectionReason: {
    type: String,
    default: ''
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', ''],
    default: ''
  },
  // Document Paths
  aadharCard: {
    type: String,
    default: ''
  },
  panCard: {
    type: String,
    default: ''
  },
  markSheet10: {
    type: String,
    default: ''
  },
  markSheet12: {
    type: String,
    default: ''
  },
  graduation: {
    type: String,
    default: ''
  },
  otherDocs: {
    type: String,
    default: ''
  },
  // Shift Timing
  shiftStartTime: {
    type: String,
    default: ''
  },
  shiftEndTime: {
    type: String,
    default: ''
  },
  shiftType: {
    type: String,
    default: ''
  },
  shiftHistory: [{
    shiftType: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  // Password Change OTP Fields
  changePasswordOtp: {
    type: String,
    default: null
  },
  changePasswordOtpExpiry: {
    type: Date,
    default: null
  },
  changePasswordOtpAttempts: {
    type: Number,
    default: 0
  },
  changePasswordOtpVerified: {
    type: Boolean,
    default: false
  },
  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  deactivationDetails: {
    lastWorkingDay: String,
    leavingType: String,
    reason: String,
    exitFormalities: String,
    handover: String,
    handoverTo: String,
    handoverToOther: String,
    handoverReason: String,
    addedBy: String
  },
  accessModules: [{
    id: String,
    title: String,
    description: String
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate OTP for password change
userSchema.methods.generateChangePasswordOtp = function() {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.changePasswordOtp = otp;
  this.changePasswordOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  this.changePasswordOtpAttempts = 0;
  this.changePasswordOtpVerified = false;
  return otp;
};

// Verify OTP for password change
userSchema.methods.verifyChangePasswordOtp = function(providedOtp) {
  if (this.changePasswordOtpExpiry < new Date()) {
    return { valid: false, message: 'OTP has expired' };
  }
  if (this.changePasswordOtpAttempts >= 5) {
    return { valid: false, message: 'Maximum OTP verification attempts exceeded' };
  }
  if (this.changePasswordOtp !== providedOtp) {
    this.changePasswordOtpAttempts += 1;
    return { valid: false, message: 'Invalid OTP' };
  }
  this.changePasswordOtpVerified = true;
  return { valid: true };
};

// Clear OTP after password change
userSchema.methods.clearChangePasswordOtp = function() {
  this.changePasswordOtp = null;
  this.changePasswordOtpExpiry = null;
  this.changePasswordOtpAttempts = 0;
  this.changePasswordOtpVerified = false;
};

module.exports = mongoose.model('User', userSchema);
