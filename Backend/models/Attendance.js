const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  shiftStartTime: {
    type: String,
    default: null
  },
  shiftEndTime: {
    type: String,
    default: null
  },
  loginTime: {
    type: Date
  },
  logoutTime: {
    type: Date
  },
  workingHours: {
    type: Number,
    default: 0
  },
  breaks: [{
    breakType: {
      type: String,
      enum: ['1st Refreshment Break', 'Lunch Break', '2nd Refreshment Break', 'Tea Break', 'Refreshment Break', 'Briefing/Meeting', 'Breifing/Meeting', 'Other'],
      required: true
    },
    reason: {
      type: String
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number,
      default: 0
    }
  }],
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'checked-in', 'not-checkout', 'late-checkin', 'early-checkin', null],
    default: null
  },
  oldStatus: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'checked-in', 'not-checkout', 'late-checkin', 'early-checkin', null],
    default: null
  },
  lateReason: {
    type: String,
    default: null
  },
  method: {
    type: String,
    enum: ['self-checkin', 'hr-checkin', 'auto'],
    default: 'self-checkin'
  },
  location: {
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String }
  },
  markedAbsentAt: {
    type: Date
  },
  logoutMethod: {
    type: String,
    enum: ['self-logout', 'auto', 'not-checkout', 'updated', null],
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  editReason: {
    type: String,
    default: null
  },
  editHistory: [{
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    oldStatus: {
      type: String,
      enum: ['present', 'absent', 'half-day', 'checked-in', 'not-checkout', 'late-checkin', 'early-checkin', null],
    },
    newStatus: {
      type: String,
      enum: ['present', 'absent', 'half-day', 'checked-in', 'not-checkout', 'late-checkin', 'early-checkin', null],
    },
    reason: {
      type: String
    },
    changeType: {
      type: String,
      enum: ['status', 'time', 'created', 'comment'],
      default: 'status'
    }
  }]
}, {
  timestamps: true
});

// Compound index to ensure one attendance record per employee per day
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
