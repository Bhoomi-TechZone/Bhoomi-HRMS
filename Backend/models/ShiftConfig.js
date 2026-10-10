const mongoose = require('mongoose');

const shiftConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    unique: true
  },
  startTime: {
    type: String,
    required: true,
    default: '09:00 AM'
  },
  endTime: {
    type: String,
    required: true,
    default: '06:00 PM'
  },
  lunchTime: {
    type: String,
    default: '01:00 PM'
  },
  lunchStartTime: {
    type: String,
    default: '01:00 PM'
  },
  lunchEndTime: {
    type: String,
    default: '02:00 PM'
  },
  teaTime: {
    type: String,
    default: '04:00 PM'
  },
  refreshment1StartTime: {
    type: String,
    default: '11:00 AM'
  },
  refreshment1EndTime: {
    type: String,
    default: '11:30 AM'
  },
  refreshment2StartTime: {
    type: String,
    default: '04:00 PM'
  },
  refreshment2EndTime: {
    type: String,
    default: '04:30 PM'
  },
  allowLunchAnytime: {
    type: Boolean,
    default: false
  },
  allowRefreshment1Anytime: {
    type: Boolean,
    default: false
  },
  allowRefreshment2Anytime: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  weekoff: {
    type: Number,
    min: 1,
    max: 3,
    default: 1
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ShiftConfig', shiftConfigSchema);