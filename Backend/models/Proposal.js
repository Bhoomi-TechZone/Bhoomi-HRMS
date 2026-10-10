
const mongoose = require('mongoose');
const proposalSchema = new mongoose.Schema({
    // Basic Information
    proposalNumber: {
        type: String,
        unique: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },

    // Client Information
    clientName: {
        type: String,
        required: true,
        trim: true
    },
    clientEmail: {
        type: String,
        trim: true
    },
    clientPhone: {
        type: String,
        trim: true
    },
    clientAddress: {
        type: String,
        trim: true
    },
    contactName: {
        type: String,
        trim: true
    },

    // Deal Reference
    deal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Deal',
        required: false
    },

    // Dates
    date: {
        type: Date,
        default: Date.now
    },
    validTill: {
        type: Date,
        required: false
    },

    // Project Details
    projectScope: {
        type: String
    },
    projectObjectives: {
        type: String
    },
    projectSections: [{
        type: { type: String, enum: ['page-heading', 'heading', 'sub-heading', 'bullet', 'paragraph', 'formatted-paragraph'], default: 'paragraph' },
        content: { type: String },
        page: { type: Number, default: 1 }
    }],
    projectTimeline: {
        type: String
    },

    // Services/Items
    items: [{
        description: {
            type: String,
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        },
        rate: {
            type: Number,
            required: true
        },
        amount: {
            type: Number,
            required: true
        }
    }],

    // Financial Details
    subtotal: {
        type: Number,
        default: 0
    },
    taxPercentage: {
        type: Number,
        default: 18 // GST
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    total: {
        type: Number,
        required: true
    },

    // Payment Terms
    paymentTerms: {
        type: String,
        default: '50% advance, 50% on completion'
    },

    // Terms and Conditions
    termsAndConditions: {
        type: String,
        default: `1. Payment terms: 50% advance, 50% on project completion
2. Project timeline is estimated and may vary based on client inputs
3. Any additional features beyond scope will be quoted separately
4. Client must provide all necessary access and resources
5. All intellectual property rights remain with the company until full payment`
    },

    // Additional Details
    notes: {
        type: String
    },
    template: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ProposalTemplate'
    },

    // Status and Tracking
    status: {
        type: String,
        enum: ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'],
        default: 'draft'
    },
    sentDate: {
        type: Date
    },
    viewedDate: {
        type: Date
    },
    respondedDate: {
        type: Date
    },

    // Signature Images
    authorizedSignature: {
        type: String
    },
    clientSignature: {
        type: String
    },

    // System Fields
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // PDF Generator State
    pdfEditorState: {
        type: mongoose.Schema.Types.Mixed
    },
    proposalType: {
        type: String,
        enum: ['domestic', 'international'],
        default: 'domestic'
    }
}, {
    timestamps: true
});

// ✅ FIXED: Auto-generate proposal number without duplicate conflict
proposalSchema.pre('save', async function (next) {
    if (!this.proposalNumber) {
        let isUnique = false;
        while (!isUnique) {
            const year = new Date().getFullYear();

            // Last proposal is nahi dhundhte jo same year ka ho
            const last = await mongoose.model('Proposal')
                .findOne({ proposalNumber: new RegExp(`^PROP-${year}-`) })
                .sort({ proposalNumber: -1 })
                .lean();

            let nextNum = 1;
            if (last && last.proposalNumber) {
                const parts = last.proposalNumber.split('-');
                const lastNum = parseInt(parts[parts.length - 1]);
                if (!isNaN(lastNum)) {
                    nextNum = lastNum + 1;
                }
            }

            const candidate = `PROP-${year}-${String(nextNum).padStart(4, '0')}`;

            // Double check: yeh number already exist toh nahi karta
            const existing = await mongoose.model('Proposal').findOne({ proposalNumber: candidate }).lean();
            if (!existing) {
                this.proposalNumber = candidate;
                isUnique = true;
            }
            // Agar exist karta hai toh loop chalega aur nextNum + 1 ho jaayega
        }
    }
    next();
});

module.exports = mongoose.model('Proposal', proposalSchema);