const mongoose = require('mongoose');

const selfieSchema = new mongoose.Schema({
  attendance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attendance',
    required: false
  },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  image: {
    type: String,
    required: true
  },
  checkOutImage: {
    type: String,
    required: false
  },
  checkOutTime: {
    type: Date,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 72000 // Automatically delete document after 20 hours (72000 seconds)
  }
});

module.exports = mongoose.model('Selfie', selfieSchema);
