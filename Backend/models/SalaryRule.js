const mongoose = require('mongoose');

const salaryRuleSchema = new mongoose.Schema({
    ruleType: {
        type: String,
        required: true,
        enum: ['Late Check-in', 'Incomplete Goals', 'Absence', 'Uninformed Leave']
    },
    threshold: {
        type: String, // e.g., "10:10 AM" or "End of Day"
        required: true
    },
    penaltyType: {
        type: String,
        required: true,
        enum: ['Half-day', 'Full-day', 'Per-day', '3-Day']
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    description: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SalaryRule', salaryRuleSchema);
