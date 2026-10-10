const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true,
        default: 'Bhoomi Techzone Pvt Ltd'
    },
    brandColor: {
        type: String,
        default: '#2563eb'
    },
    logo: {
        type: String, // URL or path to logo
        default: '/logo.png'
    },
    website: {
        type: String
    },
    address: {
        type: String
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // HRMS Specific Settings
    defaultLeaveQuota: {
        type: Number,
        default: 24 // Yearly default (e.g. 2 per month)
    },
    monthlyLeaveQuota: {
        type: Number,
        default: 2 // Monthly limit as per user request
    },
    workingDays: {
        type: String,
        default: 'Mon - Fri'
    }
}, { timestamps: true });

// Ensure only one settings document exists usually, or just fetch the first one
module.exports = mongoose.model('CompanySettings', companySettingsSchema);
