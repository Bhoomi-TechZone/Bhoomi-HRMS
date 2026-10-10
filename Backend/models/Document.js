const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  category: {
    type: String,
    enum: ['Address Proof', 'Educational Certificates', 'Aadhar Card', 'PAN Card', 'Bank Account', 'Passport', 'Driving License', 'Voter id card', 'Electricity Bill', 'Wi-Fi Bill', 'Marksheet', 'Degree Certificate', 'Experience Letter', 'Offer Letter', 'Appointment Letter', 'Relieving Letter', 'Policy', 'Contract', 'Report', 'Screenshot of Resignation Email', 'Two Passport Size Photographs', "Last 3 Months' Salary Slips", 'Other'],
    default: 'Other'
  },
  subCategory: {
    type: String
  },
  filename: {
    type: String,
    required: true
  },
  filepath: {
    type: String,
    required: true
  },
  filesize: Number,
  mimetype: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  rejectionReason: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Document', documentSchema);
