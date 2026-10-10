const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema({
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true
    },
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job'
    },
    interviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    date: {
        type: Date,
        required: true
    },
    type: {
        type: String,
        enum: ['Phone', 'Video', 'In-Person'],
        default: 'Video'
    },
    status: {
        type: String,
        enum: ['Scheduled', 'Completed', 'Cancelled', 'Pending'],
        default: 'Scheduled'
    },
    location: {
        type: String,
        default: ''
    },
    meetingLink: {
        type: String,
        default: ''
    },
    round: {
        type: String,
        default: 'Technical & HR'
    },
    feedback: {
        type: String,
        default: ''
    },
    notes: {
        type: String,
        default: ''
    },
    score: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Interview', interviewSchema);

