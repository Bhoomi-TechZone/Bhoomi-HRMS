const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Request = require('../models/Request');

// GET all requests
// Admin / HR / Manager sees all; regular employees see their own
router.get('/', auth, async (req, res) => {
  try {
    const userRole = req.user?.role?.name || (typeof req.user?.role === 'string' ? req.user.role : '');
    const isAdminOrHR = ['Admin', 'HR Manager', 'HR', 'Manager', 'Director', 'Team Leader'].includes(userRole);

    let query = {};
    if (!isAdminOrHR) {
      query.employee = req.user._id;
    }

    // Optional status filter
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Optional category filter
    if (req.query.category) {
      query.category = req.query.category;
    }

    const requests = await Request.find(query)
      .populate('employee', 'firstName lastName employeeId email avatar')
      .populate('respondedBy', 'firstName lastName employeeId')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
});

// GET single request by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId email avatar')
      .populate('respondedBy', 'firstName lastName employeeId');

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const userRole = req.user?.role?.name || (typeof req.user?.role === 'string' ? req.user.role : '');
    const isAdminOrHR = ['Admin', 'HR Manager', 'HR', 'Manager', 'Director'].includes(userRole);
    if (!isAdminOrHR && String(request.employee?._id || request.employee) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not authorized to view this request' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ message: 'Error fetching request' });
  }
});

// POST create a new request
router.post('/', auth, async (req, res) => {
  try {
    const { subject, description, category } = req.body;

    if (!subject || !description || !category) {
      return res.status(400).json({ message: 'Subject, description, and category are required' });
    }

    const newRequest = new Request({
      employee: req.user._id,
      subject,
      description,
      category,
      status: 'pending'
    });

    const savedRequest = await newRequest.save();
    await savedRequest.populate('employee', 'firstName lastName employeeId email avatar');

    res.status(201).json(savedRequest);
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Error creating request', error: error.message });
  }
});

// PUT update request (status / admin response)
router.put('/:id', auth, async (req, res) => {
  try {
    const { status, adminResponse, viewedByEmployee } = req.body;
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const userRole = req.user?.role?.name || (typeof req.user?.role === 'string' ? req.user.role : '');
    const isAdminOrHR = ['Admin', 'HR Manager', 'HR', 'Manager', 'Director'].includes(userRole);

    if (isAdminOrHR) {
      if (status) request.status = status;
      if (adminResponse !== undefined) {
        request.adminResponse = adminResponse;
        request.respondedBy = req.user._id;
        request.respondedAt = new Date();
      }
    }

    if (viewedByEmployee !== undefined && String(request.employee) === String(req.user._id)) {
      request.viewedByEmployee = viewedByEmployee;
    }

    const updated = await request.save();
    await updated.populate('employee', 'firstName lastName employeeId email avatar');
    await updated.populate('respondedBy', 'firstName lastName employeeId');

    res.json(updated);
  } catch (error) {
    console.error('Error updating request:', error);
    res.status(500).json({ message: 'Error updating request', error: error.message });
  }
});

// DELETE request
router.delete('/:id', auth, async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    const userRole = req.user?.role?.name || (typeof req.user?.role === 'string' ? req.user.role : '');
    const isAdmin = ['Admin', 'HR Manager'].includes(userRole);
    const isOwner = String(request.employee) === String(req.user._id);

    if (!isAdmin && (!isOwner || request.status !== 'pending')) {
      return res.status(403).json({ message: 'Not authorized to delete this request' });
    }

    await Request.findByIdAndDelete(req.params.id);
    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Error deleting request:', error);
    res.status(500).json({ message: 'Error deleting request' });
  }
});

module.exports = router;

