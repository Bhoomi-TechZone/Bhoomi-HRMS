const mongoose = require('mongoose');

const proposalTemplateSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    content: {
        type: String,
        default: ''
    },
    fileName: {
        type: String
    },
    filePath: {
        type: String
    },
    fileType: {
        type: String,
        enum: ['html', 'pdf', 'docx', 'txt', 'text'],
        default: 'text'
    },
    type: {
        type: String,
        enum: ['standard', 'marketing', 'software', 'custom'],
        default: 'custom'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ProposalTemplate', proposalTemplateSchema);
