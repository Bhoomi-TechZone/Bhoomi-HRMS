const mongoose = require('mongoose');

const offerLetterSchema = new mongoose.Schema({
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true
    },
    position: { type: String, required: true },
    department: { type: String },
    reportingTo: { type: String },
    salary: { type: Number, required: true },
    joiningDate: { type: Date, required: true },
    offerExpiry: { type: Date, required: true },
    notes: { type: String },
    candidateAddress: { type: String },
    workingHours:     { type: String, default: '10:00 AM – 7:00 PM' },
    probationPeriod:  { type: String, default: '1 Month' },
    attendanceBonus:  { type: Number, default: 2000 },
    performanceBonus: { type: Number, default: 2000 },
    hrManagerName:    { type: String, default: 'HR Manager' },
    hrContact:        { type: String },
    employmentType:   { type: String, default: 'Full Time' },
    noticePeriod:     { type: String, default: '30 Days' },
    workLocation:     { type: String },
    status: {
        type: String,
        enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'],
        default: 'Draft'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

module.exports = mongoose.model('OfferLetter', offerLetterSchema);
