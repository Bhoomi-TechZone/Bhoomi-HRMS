const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    department: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    requirements: {
        type: String
    },
    eligibilityCriteria: {
        type: String
    },
    status: {
        type: String,
        enum: ['Open', 'Closed', 'On Hold'],
        default: 'Open'
    },
    type: {
        type: String, // Full-time, Part-time, Contract
        default: 'Full-time'
    },
    location: {
        type: String,
        default: 'On-site'
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    minSalary: {
        type: Number,
        default: null,
        set: v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v))
    },
    maxSalary: {
        type: Number,
        default: null,
        set: v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v))
    },
    salaryCurrency: {
        type: String,
        default: 'INR'
    },
    salaryPeriod: {
        type: String,
        enum: ['per month', 'per annum'],
        default: 'per month'
    },
    minExperience: {
        type: Number,
        default: null,
        set: v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v))
    },
    minExpUnit: {
        type: String,
        enum: ['months', 'years'],
        default: 'years'
    },
    maxExperience: {
        type: Number,
        default: null,
        set: v => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v))
    },
    maxExpUnit: {
        type: String,
        enum: ['months', 'years'],
        default: 'years'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Job', jobSchema);
