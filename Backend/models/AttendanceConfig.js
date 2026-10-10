const mongoose = require('mongoose');

const attendanceConfigSchema = new mongoose.Schema({
  markLateAfter: {
    type: Number, // Hours after shift start time
    default: 0.25, // 15 minutes = 0.25 hours
    min: 0,
    max: 24
  },
  checkinWindowBefore: {
    type: Number, // In minutes before shift start time
    default: 15,
    min: 0
  },
  totalBreakLimit: {
    type: Number, // In minutes
    default: 60,
    min: 0
  },
  checkoutGracePeriod: {
    type: Number, // In minutes
    default: 20,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure only one active configuration exists
attendanceConfigSchema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('AttendanceConfig', attendanceConfigSchema);