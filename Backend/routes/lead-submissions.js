const express = require('express');
const router = express.Router();
const LeadSubmission = require('../models/LeadSubmission');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get all lead submissions (HR can see all, employees see their own)
router.get('/', auth, async (req, res) => {
  try {
    const isHR = req.user.role && req.user.role.name === 'HR';
    
    let query = isHR 
      ? LeadSubmission.find()
      : LeadSubmission.find({ submittedBy: req.user.id });

    const submissions = await query
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(submissions);
  } catch (error) {
    console.error('Get submissions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single submission
router.get('/:id', auth, async (req, res) => {
  try {
    const submission = await LeadSubmission.findById(req.params.id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email');

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check if user can view this submission
    const isHR = req.user.role && req.user.role.name === 'HR';
    const isOwner = submission.submittedBy._id.toString() === req.user.id;

    if (!isHR && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to view this submission' });
    }

    res.json(submission);
  } catch (error) {
    console.error('Get submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create lead submission (Employee)
router.post('/', auth, async (req, res) => {
  try {
    const { leadName, contactNumber, status, updates, contactedCount } = req.body;

    // Validation
    if (!leadName || !leadName.trim()) {
      return res.status(400).json({ message: 'Lead name is required' });
    }

    if (!contactNumber || !contactNumber.trim()) {
      return res.status(400).json({ message: 'Contact number is required' });
    }

    const newSubmission = new LeadSubmission({
      leadName: leadName.trim(),
      contactNumber: contactNumber.trim(),
      status: status || 'New',
      updates: updates ? updates.trim() : '',
      contactedCount: contactedCount || 0,
      submittedBy: req.user.id
    });

    await newSubmission.save();

    const populatedSubmission = await LeadSubmission.findById(newSubmission._id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email');

    res.status(201).json(populatedSubmission);
  } catch (error) {
    console.error('Create submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update lead submission (Employee can update own, HR can update any)
router.put('/:id', auth, async (req, res) => {
  try {
    const submission = await LeadSubmission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    // Check permissions
    const isHR = req.user.role && req.user.role.name === 'HR';
    const isOwner = submission.submittedBy.toString() === req.user.id;

    if (!isHR && !isOwner) {
      return res.status(403).json({ message: 'Not authorized to update this submission' });
    }

    // Update fields
    if (req.body.leadName) submission.leadName = req.body.leadName.trim();
    if (req.body.contactNumber) submission.contactNumber = req.body.contactNumber.trim();
    if (req.body.status) submission.status = req.body.status;
    if (req.body.updates !== undefined) submission.updates = req.body.updates ? req.body.updates.trim() : '';
    if (req.body.contactedCount !== undefined) submission.contactedCount = req.body.contactedCount;
    if (isHR && req.body.assignedTo) submission.assignedTo = req.body.assignedTo;

    await submission.save();

    const updatedSubmission = await LeadSubmission.findById(submission._id)
      .populate('submittedBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email');

    res.json(updatedSubmission);
  } catch (error) {
    console.error('Update submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete lead submission (HR only)
router.delete('/:id', auth, checkPermission('leads', 'delete'), async (req, res) => {
  try {
    const submission = await LeadSubmission.findByIdAndDelete(req.params.id);

    if (!submission) {
      return res.status(404).json({ message: 'Submission not found' });
    }

    res.json({ message: 'Submission deleted successfully' });
  } catch (error) {
    console.error('Delete submission error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
