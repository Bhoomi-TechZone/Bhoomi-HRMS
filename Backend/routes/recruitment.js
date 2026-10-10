const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Interview = require('../models/Interview');
const OfferLetter = require('../models/OfferLetter');
const CompanySettings = require('../models/CompanySettings');
const auth = require('../middleware/auth');
const { sendOfferLetterEmail } = require('../utils/offerLetterMailer');

// Helper to generate Application ID
const generateAppId = () => {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `#AP-${dateStr}-${rand}`;
};

// Optional auth helper: populates req.user if token is present, continues without error if not
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (token) {
            const jwt = require('jsonwebtoken');
            const User = require('../models/User');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).populate('role');
            if (user && user.isActive) {
                req.user = user;
            }
        }
    } catch (_) {}
    next();
};

// =========================================================================
// PUBLIC CAREER PORTAL APIs (No Login Required)
// =========================================================================

// GET /public/jobs - List all open jobs for public career board
router.get('/public/jobs', async (req, res) => {
    try {
        const jobs = await Job.find({ status: 'Open' })
            .select('-postedBy')
            .sort({ createdAt: -1 });
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching public jobs:', error);
        res.status(500).json({ message: 'Failed to fetch job postings' });
    }
});

// GET /public/jobs/:id - Get single job details
router.get('/public/jobs/:id', async (req, res) => {
    try {
        const job = await Job.findById(req.params.id).select('-postedBy');
        if (!job) {
            return res.status(404).json({ message: 'Job posting not found' });
        }
        res.json(job);
    } catch (error) {
        console.error('Error fetching job details:', error);
        res.status(500).json({ message: 'Failed to fetch job details' });
    }
});

// POST /public/apply - Public candidate application submission
router.post(['/public/apply', '/apply'], async (req, res) => {
    try {
        const {
            jobId,
            firstName,
            middleName,
            lastName,
            email,
            phone,
            altPhone,
            source,
            applicationId,
            resumeUrl,
            personalDetails,
            qualifications,
            experience
        } = req.body;

        // Validation
        if (!firstName || !firstName.trim()) {
            return res.status(400).json({ message: 'First name is required' });
        }
        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'Valid email address is required' });
        }
        if (!jobId) {
            return res.status(400).json({ message: 'Target job position is required' });
        }

        // Verify job exists
        const job = await Job.findById(jobId);
        if (!job) {
            return res.status(404).json({ message: 'The specified job opening does not exist' });
        }

        const cleanEmail = email.trim().toLowerCase();

        // Check duplicate application for the same job (case insensitive)
        const existingCandidate = await Candidate.findOne({
            email: cleanEmail,
            jobId: jobId
        });

        if (existingCandidate) {
            return res.status(400).json({
                message: `An application from ${cleanEmail} for "${job.title}" has already been received (Ref: ${existingCandidate.applicationId || 'Submitted'}).`
            });
        }

        // Generate clean unique application reference code
        const finalAppId = applicationId && String(applicationId).trim().startsWith('#AP')
            ? applicationId.trim()
            : generateAppId();

        // Assemble candidate document
        const candidate = new Candidate({
            jobId,
            applicationId: finalAppId,
            source: source || 'career_board',
            firstName: firstName.trim(),
            lastName: (lastName || '').trim(),
            email: cleanEmail,
            phone: phone ? phone.trim() : '',
            resumeUrl: resumeUrl || '',
            status: 'Applied',
            rating: 0,
            notes: '',
            personalDetails: {
                middleName: middleName || personalDetails?.middleName || '',
                guardianSalutation: personalDetails?.guardianSalutation || '',
                guardianRelation: personalDetails?.guardianRelation || '',
                guardianName: personalDetails?.guardianName || '',
                dob: personalDetails?.dob || '',
                gender: personalDetails?.gender || '',
                maritalStatus: personalDetails?.maritalStatus || '',
                nationality: personalDetails?.nationality || 'Indian',
                religion: personalDetails?.religion || '',
                caste: personalDetails?.caste || '',
                altPhone: altPhone || personalDetails?.altPhone || '',
                isAddressSame: personalDetails?.isAddressSame !== undefined ? personalDetails.isAddressSame : true,
                currentAddress: personalDetails?.currentAddress || {},
                permanentAddress: personalDetails?.permanentAddress || {}
            },
            qualifications: qualifications || {},
            experience: experience || { candidateType: 'Fresher' },
            appliedDate: new Date()
        });

        await candidate.save();
        await candidate.populate('jobId', 'title department type location');

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            applicationId: finalAppId,
            candidate
        });
    } catch (error) {
        console.error('Error in public candidate application:', error);
        res.status(500).json({ message: error.message || 'Failed to submit application. Please try again.' });
    }
});

// GET /public/track/:identifier - Track application status by Application ID or Email
router.get('/public/track/:identifier', async (req, res) => {
    try {
        const iden = req.params.identifier.trim();
        const candidate = await Candidate.findOne({
            $or: [
                { applicationId: iden },
                { email: iden.toLowerCase() }
            ]
        })
            .select('applicationId firstName lastName status appliedDate jobId')
            .populate('jobId', 'title department location');

        if (!candidate) {
            return res.status(404).json({ message: 'No application found with provided details' });
        }

        res.json({
            applicationId: candidate.applicationId,
            name: `${candidate.firstName} ${candidate.lastName}`,
            jobTitle: candidate.jobId?.title || 'Open Position',
            department: candidate.jobId?.department || 'General',
            status: candidate.status,
            appliedDate: candidate.appliedDate
        });
    } catch (error) {
        console.error('Error tracking application:', error);
        res.status(500).json({ message: 'Failed to look up application status' });
    }
});

// =========================================================================
// RECRUITMENT DASHBOARD & JOBS MANAGEMENT (Admin / HR)
// =========================================================================

// Get Recruitment Dashboard Stats
router.get('/dashboard-stats', auth, async (req, res) => {
    try {
        const [
            totalOpenings,
            totalApplications,
            totalHired,
            totalRejected,
            newApplications,
            shortlisted,
            todaysInterviews,
            jobStats,
            recentInterviews,
            openJobsList
        ] = await Promise.all([
            Job.countDocuments({ status: 'Open' }),
            Candidate.countDocuments(),
            Candidate.countDocuments({ status: 'Hired' }),
            Candidate.countDocuments({ status: 'Rejected' }),
            Candidate.countDocuments({ status: 'Applied' }),
            Candidate.countDocuments({ status: 'Shortlisted' }),
            Interview.countDocuments({
                date: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    $lt: new Date(new Date().setHours(23, 59, 59, 999))
                }
            }),
            Candidate.aggregate([
                {
                    $group: {
                        _id: '$jobId',
                        total: { $sum: 1 },
                        applied: { $sum: { $cond: [{ $eq: ['$status', 'Applied'] }, 1, 0] } },
                        phoneScreen: { $sum: { $cond: [{ $eq: ['$status', 'Phone Screen'] }, 1, 0] } },
                        interview: { $sum: { $cond: [{ $eq: ['$status', 'Interview'] }, 1, 0] } },
                        hired: { $sum: { $cond: [{ $eq: ['$status', 'Hired'] }, 1, 0] } },
                        rejected: { $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] } }
                    }
                },
                {
                    $lookup: {
                        from: 'jobs',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'job'
                    }
                },
                { $unwind: '$job' },
                {
                    $project: {
                        jobTitle: '$job.title',
                        totalApplications: '$total',
                        applied: 1,
                        phoneScreen: 1,
                        interview: 1,
                        hired: 1,
                        rejected: 1
                    }
                }
            ]),
            Interview.find({
                date: {
                    $gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            })
                .populate('candidateId', 'firstName lastName')
                .populate('jobId', 'title')
                .sort({ date: 1 })
                .limit(5),
            Job.find({ status: 'Open' }).sort({ createdAt: -1 }).limit(5)
        ]);

        res.json({
            totalOpenings,
            totalApplications,
            totalHired,
            totalRejected,
            newApplications,
            shortlisted,
            todaysInterviews,
            jobStats,
            recentInterviews,
            openJobsList
        });

    } catch (error) {
        console.error("Error fetching recruitment stats:", error);
        res.status(500).json({ message: error.message });
    }
});

// GET all jobs (Allows public read when unauthenticated, full recruiter details if authenticated)
router.get('/jobs', optionalAuth, async (req, res) => {
    try {
        const filter = {};
        // If unauthenticated visitor, only show Open jobs
        if (!req.user) {
            filter.status = 'Open';
        }
        const jobs = await Job.find(filter)
            .populate('postedBy', 'firstName lastName role')
            .sort({ createdAt: -1 });
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET single job details by ID
router.get('/jobs/:id', optionalAuth, async (req, res) => {
    try {
        const job = await Job.findById(req.params.id)
            .populate('postedBy', 'firstName lastName role');
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json(job);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create Job
router.post('/jobs', auth, async (req, res) => {
    try {
        const job = new Job({
            ...req.body,
            postedBy: req.user._id
        });
        await job.save();
        await job.populate('postedBy', 'firstName lastName role');
        res.status(201).json(job);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update Job
router.put('/jobs/:id', auth, async (req, res) => {
    try {
        const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
            .populate('postedBy', 'firstName lastName role');
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json(job);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete Job
router.delete('/jobs/:id', auth, async (req, res) => {
    try {
        const job = await Job.findByIdAndDelete(req.params.id);
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json({ message: 'Job deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// =========================================================================
// CANDIDATES & PIPELINE MANAGEMENT (Admin / HR)
// =========================================================================

// GET all candidates with filtering
router.get('/candidates', auth, async (req, res) => {
    try {
        const { status, jobId, isArchived, search } = req.query;
        const query = {};

        if (status && status !== 'All' && status !== 'undefined' && status !== 'null') {
            query.status = status;
        }

        if (jobId && jobId !== 'All' && jobId !== 'undefined' && jobId !== 'null' && typeof jobId === 'string' && jobId.trim() !== '') {
            if (mongoose.Types.ObjectId.isValid(jobId.trim())) {
                query.jobId = new mongoose.Types.ObjectId(jobId.trim());
            }
        }

        if (isArchived !== undefined && isArchived !== '' && isArchived !== 'undefined' && isArchived !== 'null') {
            query.isArchived = isArchived === 'true';
        }

        if (search && typeof search === 'string' && search.trim()) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'i');
            query.$or = [
                { firstName: regex },
                { lastName: regex },
                { email: regex },
                { phone: regex },
                { applicationId: regex }
            ];
        }

        const candidates = await Candidate.find(query)
            .select('-resumeUrl')
            .populate('jobId', 'title department location type')
            .sort({ _id: -1 })
            .lean();

        res.json(candidates || []);
    } catch (error) {
        console.error('[Recruitment API] GET /candidates error:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch candidates' });
    }
});

// GET single candidate by ID
router.get('/candidates/:id', auth, async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id)
            .populate('jobId', 'title department location type minSalary maxSalary salaryPeriod requirements');
        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
        res.json(candidate);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST Create Candidate (Recruiter / Admin manual add or API)
router.post('/candidates', optionalAuth, async (req, res) => {
    try {
        const {
            firstName,
            middleName,
            lastName,
            email,
            phone,
            altPhone,
            jobId,
            status,
            rating,
            notes,
            resumeUrl,
            source,
            applicationId,
            qualifications,
            personalDetails,
            experience
        } = req.body;

        if (!firstName || !firstName.trim()) return res.status(400).json({ message: 'First name is required' });
        if (!email || !email.trim()) return res.status(400).json({ message: 'Email is required' });
        if (!jobId) return res.status(400).json({ message: 'Job position is required' });

        const cleanEmail = email.trim().toLowerCase();

        // Check duplicate
        const existing = await Candidate.findOne({ email: cleanEmail, jobId });
        if (existing) {
            return res.status(400).json({ message: 'This candidate has already applied for this job' });
        }

        const candidate = new Candidate({
            jobId,
            applicationId: applicationId || generateAppId(),
            source: source || (req.user ? 'recruiter_portal' : 'career_board'),
            firstName: firstName.trim(),
            lastName: (lastName || '').trim(),
            email: cleanEmail,
            phone: phone ? phone.trim() : '',
            status: status || 'Applied',
            rating: rating || 0,
            notes: notes || '',
            resumeUrl: resumeUrl || '',
            personalDetails: {
                middleName: middleName || personalDetails?.middleName || '',
                guardianSalutation: personalDetails?.guardianSalutation || '',
                guardianRelation: personalDetails?.guardianRelation || '',
                guardianName: personalDetails?.guardianName || '',
                dob: personalDetails?.dob || '',
                gender: personalDetails?.gender || '',
                maritalStatus: personalDetails?.maritalStatus || '',
                nationality: personalDetails?.nationality || 'Indian',
                religion: personalDetails?.religion || '',
                caste: personalDetails?.caste || '',
                altPhone: altPhone || personalDetails?.altPhone || '',
                isAddressSame: personalDetails?.isAddressSame !== undefined ? personalDetails.isAddressSame : true,
                currentAddress: personalDetails?.currentAddress || {},
                permanentAddress: personalDetails?.permanentAddress || {}
            },
            qualifications: qualifications || {},
            experience: experience || { candidateType: 'Fresher' },
            appliedDate: new Date()
        });

        await candidate.save();
        await candidate.populate('jobId', 'title department');

        res.status(201).json(candidate);
    } catch (error) {
        console.error('Error creating candidate:', error);
        res.status(400).json({ message: error.message || 'Failed to create candidate' });
    }
});

// Update candidate status (Pipeline drag-drop or stage selector)
router.patch('/candidates/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate('jobId', 'title department');

        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
        res.json(candidate);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Toggle Archive candidate (move between pipeline and candidate database)
router.patch('/candidates/:id/archive', auth, async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

        const isArchived = req.body.isArchived !== undefined ? req.body.isArchived : !candidate.isArchived;
        candidate.isArchived = isArchived;
        candidate.archivedAt = isArchived ? new Date() : null;
        await candidate.save();
        await candidate.populate('jobId', 'title department');
        res.json(candidate);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update candidate rating
router.patch('/candidates/:id/rating', auth, async (req, res) => {
    try {
        const { rating } = req.body;
        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            { rating: Number(rating) || 0 },
            { new: true }
        ).populate('jobId', 'title department');
        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
        res.json(candidate);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update candidate internal notes
router.patch('/candidates/:id/notes', auth, async (req, res) => {
    try {
        const { notes } = req.body;
        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            { notes: notes || '' },
            { new: true }
        ).populate('jobId', 'title department');
        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
        res.json(candidate);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Update Candidate full document
router.put('/candidates/:id', auth, async (req, res) => {
    try {
        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        ).populate('jobId', 'title department');
        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
        res.json(candidate);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete Candidate
router.delete('/candidates/:id', auth, async (req, res) => {
    try {
        const candidate = await Candidate.findByIdAndDelete(req.params.id);
        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
        res.json({ message: 'Candidate deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// =========================================================================
// INTERVIEWS MANAGEMENT (Admin / HR)
// =========================================================================

// GET active employees / users to assign as interviewers
router.get('/interviewers', auth, async (req, res) => {
    try {
        const User = require('../models/User');
        const users = await User.find({ isActive: { $ne: false } })
            .select('firstName lastName email department designation role')
            .populate('role', 'name')
            .sort({ firstName: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Schedule Interview
router.post('/interviews', auth, async (req, res) => {
    try {
        const {
            candidateId,
            jobId,
            interviewerId,
            date,
            type,
            status,
            location,
            meetingLink,
            round,
            notes,
            feedback,
            score
        } = req.body;

        if (!candidateId) {
            return res.status(400).json({ message: 'Candidate is required' });
        }
        if (!date) {
            return res.status(400).json({ message: 'Interview date & time is required' });
        }

        // Check candidate exists
        const candidate = await Candidate.findById(candidateId);
        if (!candidate) {
            return res.status(404).json({ message: 'Candidate not found' });
        }

        // Auto-resolve jobId if not provided
        const finalJobId = jobId || candidate.jobId || null;

        const interview = new Interview({
            candidateId,
            jobId: finalJobId,
            interviewerId: interviewerId || req.user?._id || null,
            date: new Date(date),
            type: type || 'Video',
            status: status || 'Scheduled',
            location: location || '',
            meetingLink: meetingLink || location || '',
            round: round || 'Technical & HR',
            notes: notes || '',
            feedback: feedback || '',
            score: score !== undefined ? Number(score) : 0
        });

        await interview.save();

        // Automatically set candidate application status to 'Interview' when interview is scheduled
        candidate.status = 'Interview';
        await candidate.save();

        await interview.populate([
            { path: 'candidateId', select: 'firstName lastName email phone applicationId resumeUrl photo status' },
            { path: 'jobId', select: 'title department location type' },
            { path: 'interviewerId', select: 'firstName lastName email' }
        ]);

        res.status(201).json(interview);
    } catch (error) {
        console.error('Error scheduling interview:', error);
        res.status(400).json({ message: error.message || 'Failed to schedule interview' });
    }
});

// GET all interviews with filtering and search
router.get('/interviews', auth, async (req, res) => {
    try {
        const { status, type, candidateId, jobId, search } = req.query;
        const query = {};

        if (status && status !== 'All' && status !== 'undefined' && status !== 'null') query.status = status;
        if (type && type !== 'All' && type !== 'undefined' && type !== 'null') query.type = type;
        if (candidateId && candidateId !== 'undefined' && candidateId !== 'null' && typeof candidateId === 'string' && candidateId.trim() !== '') {
            if (mongoose.Types.ObjectId.isValid(candidateId.trim())) query.candidateId = new mongoose.Types.ObjectId(candidateId.trim());
        }
        if (jobId && jobId !== 'All' && jobId !== 'undefined' && jobId !== 'null' && typeof jobId === 'string' && jobId.trim() !== '') {
            if (mongoose.Types.ObjectId.isValid(jobId.trim())) query.jobId = new mongoose.Types.ObjectId(jobId.trim());
        }

        let interviews = await Interview.find(query)
            .populate('candidateId', 'firstName lastName email phone applicationId resumeUrl photo status')
            .populate('jobId', 'title department location type')
            .populate('interviewerId', 'firstName lastName email')
            .sort({ date: -1, createdAt: -1 });

        if (search && search.trim()) {
            const term = search.trim().toLowerCase();
            interviews = interviews.filter(i => {
                const candName = `${i.candidateId?.firstName || ''} ${i.candidateId?.lastName || ''}`.toLowerCase();
                const candEmail = (i.candidateId?.email || '').toLowerCase();
                const jobTitle = (i.jobId?.title || '').toLowerCase();
                const interviewerName = `${i.interviewerId?.firstName || ''} ${i.interviewerId?.lastName || ''}`.toLowerCase();
                const appId = (i.candidateId?.applicationId || '').toLowerCase();
                return candName.includes(term) || candEmail.includes(term) || jobTitle.includes(term) || interviewerName.includes(term) || appId.includes(term);
            });
        }

        res.json(interviews);
    } catch (error) {
        console.error('Error fetching interviews:', error);
        res.status(500).json({ message: error.message || 'Failed to fetch interviews' });
    }
});

// GET single interview by ID
router.get('/interviews/:id', auth, async (req, res) => {
    try {
        const interview = await Interview.findById(req.params.id)
            .populate('candidateId', 'firstName lastName email phone applicationId resumeUrl photo status')
            .populate('jobId', 'title department location type')
            .populate('interviewerId', 'firstName lastName email');
        if (!interview) return res.status(404).json({ message: 'Interview not found' });
        res.json(interview);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Interview (Date, notes, feedback, status, type, interviewer, etc.)
router.put('/interviews/:id', auth, async (req, res) => {
    try {
        const updateData = { ...req.body };
        if (updateData.date) {
            updateData.date = new Date(updateData.date);
        }

        const interview = await Interview.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
            .populate('candidateId', 'firstName lastName email phone applicationId resumeUrl photo status')
            .populate('jobId', 'title department location type')
            .populate('interviewerId', 'firstName lastName email');

        if (!interview) return res.status(404).json({ message: 'Interview not found' });
        res.json(interview);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PATCH Interview status
router.patch('/interviews/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const interview = await Interview.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        )
            .populate('candidateId', 'firstName lastName email phone applicationId resumeUrl photo status')
            .populate('jobId', 'title department location type')
            .populate('interviewerId', 'firstName lastName email');

        if (!interview) return res.status(404).json({ message: 'Interview not found' });
        res.json(interview);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete Interview
router.delete('/interviews/:id', auth, async (req, res) => {
    try {
        const interview = await Interview.findByIdAndDelete(req.params.id);
        if (!interview) return res.status(404).json({ message: 'Interview not found' });
        res.json({ message: 'Interview deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// =========================================================================
// OFFER LETTERS (Admin / HR)
// =========================================================================

// GET all offer letters
router.get('/offer-letters', auth, async (req, res) => {
    try {
        const letters = await OfferLetter.find()
            .populate('candidateId', 'firstName lastName email jobId')
            .populate('createdBy', 'firstName lastName')
            .sort({ createdAt: -1 });
        res.json(letters);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST create offer letter
router.post('/offer-letters', auth, async (req, res) => {
    try {
        const letter = new OfferLetter({ ...req.body, createdBy: req.user._id });
        await letter.save();
        await letter.populate('candidateId', 'firstName lastName email jobId');
        res.status(201).json(letter);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT update offer letter (status, fields)
router.put('/offer-letters/:id', auth, async (req, res) => {
    try {
        const letter = await OfferLetter.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('candidateId', 'firstName lastName email jobId');
        if (!letter) return res.status(404).json({ message: 'Offer letter not found' });
        res.json(letter);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE offer letter
router.delete('/offer-letters/:id', auth, async (req, res) => {
    try {
        const letter = await OfferLetter.findByIdAndDelete(req.params.id);
        if (!letter) return res.status(404).json({ message: 'Offer letter not found' });
        res.json({ message: 'Offer letter deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST send offer letter by email
router.post('/offer-letters/:id/send-email', auth, async (req, res) => {
    try {
        const letter = await OfferLetter.findById(req.params.id)
            .populate('candidateId', 'firstName lastName email');
        if (!letter) return res.status(404).json({ message: 'Offer letter not found' });
        if (!letter.candidateId?.email) return res.status(400).json({ message: 'Candidate has no email address' });

        let company = { companyName: 'the Company', website: '', address: '' };
        try {
            const settings = await CompanySettings.findOne();
            if (settings) company = settings;
        } catch (_) {}

        const result = await sendOfferLetterEmail(letter, company);
        if (!result.success) {
            console.error('❌ Offer email failed:', result.error);
            return res.status(500).json({ message: result.error || 'Failed to send email' });
        }

        let newStatus = letter.status;
        if (letter.status === 'Draft') {
            await OfferLetter.findByIdAndUpdate(req.params.id, { status: 'Sent' });
            newStatus = 'Sent';
        }

        res.json({ message: 'Offer letter sent successfully', status: newStatus });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
