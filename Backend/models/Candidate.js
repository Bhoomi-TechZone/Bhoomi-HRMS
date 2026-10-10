const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    applicationId: {
        type: String,
        trim: true,
        index: true
    },
    source: {
        type: String,
        default: 'career_board'
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        default: '',
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        default: '',
        trim: true
    },
    resumeUrl: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Applied', 'Shortlisted', 'Phone Screen', 'Interview', 'Hired', 'Rejected'],
        default: 'Applied'
    },
    appliedDate: {
        type: Date,
        default: Date.now
    },
    rating: {
        type: Number, // 1-5
        default: 0
    },
    notes: {
        type: String,
        default: ''
    },
    qualifications: {
        tenth: {
            school: { type: String, default: '' },
            board: { type: String, default: '' },
            year: { type: String, default: '' },
            gradeType: { type: String, default: 'Percentage' },
            score: { type: String, default: '' },
            marks: { type: String, default: '' }
        },
        twelfth: {
            hasTwelfth: { type: Boolean, default: true },
            school: { type: String, default: '' },
            board: { type: String, default: '' },
            stream: { type: String, default: '' },
            year: { type: String, default: '' },
            gradeType: { type: String, default: 'Percentage' },
            score: { type: String, default: '' },
            marks: { type: String, default: '' }
        },
        diploma: {
            hasDiploma: { type: Boolean, default: false },
            college: { type: String, default: '' },
            stream: { type: String, default: '' },
            year: { type: String, default: '' },
            gradeType: { type: String, default: 'Percentage' },
            score: { type: String, default: '' },
            marks: { type: String, default: '' }
        },
        graduation: {
            hasGraduation: { type: Boolean, default: true },
            degree: { type: String, default: '' },
            college: { type: String, default: '' },
            year: { type: String, default: '' },
            gradeType: { type: String, default: 'Percentage' },
            score: { type: String, default: '' },
            marks: { type: String, default: '' },
            status: { type: String, default: '' }
        },
        postGraduation: {
            hasPostGraduation: { type: Boolean, default: false },
            degree: { type: String, default: '' },
            college: { type: String, default: '' },
            year: { type: String, default: '' },
            gradeType: { type: String, default: 'Percentage' },
            score: { type: String, default: '' },
            marks: { type: String, default: '' },
            status: { type: String, default: '' }
        }
    },
    personalDetails: {
        middleName: { type: String, default: '' },
        guardianSalutation: { type: String, default: '' },
        guardianRelation: { type: String, default: '' },
        guardianName: { type: String, default: '' },
        dob: { type: String, default: '' },
        gender: { type: String, default: '' },
        maritalStatus: { type: String, default: '' },
        nationality: { type: String, default: 'Indian' },
        religion: { type: String, default: '' },
        caste: { type: String, default: '' },
        altPhone: { type: String, default: '' },
        isAddressSame: { type: Boolean, default: true },
        currentAddress: {
            street: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            country: { type: String, default: 'India' },
            zip: { type: String, default: '' }
        },
        permanentAddress: {
            street: { type: String, default: '' },
            city: { type: String, default: '' },
            state: { type: String, default: '' },
            country: { type: String, default: 'India' },
            zip: { type: String, default: '' }
        }
    },
    experience: {
        candidateType: {
            type: String,
            enum: ['Fresher', 'Experienced'],
            default: 'Experienced'
        },
        currentCompany: { type: String, default: '' },
        currentRole: { type: String, default: '' },
        totalExpYears: { type: String, default: '' },
        totalExpMonths: { type: String, default: '' },
        currentSalary: { type: String, default: '' },
        expectedSalary: { type: String, default: '' },
        noticePeriod: { type: String, default: '' },
        keySkills: { type: String, default: '' }
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date
    }
}, {
    timestamps: true
});

candidateSchema.index({ createdAt: -1 });
candidateSchema.index({ appliedDate: -1 });
candidateSchema.index({ isArchived: 1, status: 1 });
candidateSchema.index({ jobId: 1 });

module.exports = mongoose.model('Candidate', candidateSchema);
