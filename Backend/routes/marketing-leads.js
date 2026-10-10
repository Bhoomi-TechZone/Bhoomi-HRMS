const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

// Get stats for marketing role (added leads count)
router.get('/stats', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('role');
    
    // Only marketing role with create permission should access this
    if (!user.role.permissions.some(p => p.module === 'leads' && p.actions.includes('create'))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get total leads added by this user
    const totalAdded = await Lead.countDocuments({ createdBy: req.user.id });
    
    // Get today's leads added by this user
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    
    const todayAdded = await Lead.countDocuments({
      createdBy: req.user.id,
      addedOn: { $gte: todayStart, $lte: todayEnd }
    });
    
    res.json({
      totalAdded,
      todayAdded
    });
  } catch (error) {
    console.error('Get marketing stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get leads added by marketing user (only if they have read permission)
router.get('/my-added-leads', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('role');
    
    // Check if user has both create and read permission
    const hasCreatePermission = user.role.permissions.some(
      p => p.module === 'leads' && p.actions.includes('create')
    );
    const hasReadPermission = user.role.permissions.some(
      p => p.module === 'leads' && p.actions.includes('read')
    );
    
    if (!hasCreatePermission || !hasReadPermission) {
      return res.status(403).json({ message: 'Access denied. Both create and read permissions required.' });
    }
    
    // Get leads created by this user
    const leads = await Lead.find({ createdBy: req.user.id })
      .populate('createdBy', 'firstName lastName email')
      .sort({ addedOn: -1 });
    
    res.json(leads);
  } catch (error) {
    console.error('Get my added leads error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add manual lead (marketing role)
router.post('/add-manual', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const {
      date,
      name,
      email,
      phone,
      company,
      country,
      industry,
      source,
      leadType,
      requirement,
      notes
    } = req.body;
    
    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }
    
    // Prepare lead data
    const leadData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : '',
      company: company ? company.trim() : '',
      country: country ? country.trim() : '',
      industry: industry ? industry.trim() : '',
      date: date ? new Date(date) : new Date(), // User-specified date or today
      addedOn: new Date(), // System timestamp
      source: source || 'Email Marketing', // Default to Email Marketing
      requirement: requirement ? requirement.trim() : '',
      requirements: requirement ? requirement.trim() : '', // Support both fields
      notes: notes ? notes.trim() : '',
      createdBy: req.user.id,
      leadType: leadType || null,
      status: 'New'
    };
    
    const lead = new Lead(leadData);
    await lead.save();
    
    const populatedLead = await Lead.findById(lead._id)
      .populate('createdBy', 'firstName lastName email');
    
    res.status(201).json(populatedLead);
  } catch (error) {
    console.error('Add manual lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk import leads from Excel (marketing role)
router.post('/import-excel', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const { leads: leadsData } = req.body;
    
    if (!Array.isArray(leadsData) || leadsData.length === 0) {
      return res.status(400).json({ message: 'No leads data provided' });
    }

    const created = [];
    const errors = [];

    for (let i = 0; i < leadsData.length; i++) {
      const row = leadsData[i];
      try {
        // Validate required fields
        if (!row.name || !row.email) {
          errors.push({ 
            row: i + 1, 
            reason: 'Missing required fields: name and email are required' 
          });
          continue;
        }
        
        let normalizedLeadType = null;
        if (row.leadType) {
          const cleanType = String(row.leadType).trim();
          if (cleanType) {
            const normalized = cleanType.charAt(0).toUpperCase() + cleanType.slice(1).toLowerCase();
            if (['Hot', 'Warm', 'Cold'].includes(normalized)) {
              normalizedLeadType = normalized;
            }
          }
        }

        const leadData = {
          name: String(row.name).trim(),
          email: String(row.email).toLowerCase().trim(),
          phone: row.phone ? String(row.phone).trim() : '',
          company: row.company ? String(row.company).trim() : '',
          country: row.country ? String(row.country).trim() : '',
          industry: row.industry ? String(row.industry).trim() : '',
          date: row.date ? new Date(row.date) : new Date(),
          addedOn: new Date(), // System timestamp
          source: row.source || 'Email Marketing',
          leadType: normalizedLeadType,
          requirement: row.requirement ? String(row.requirement).trim() : '',
          requirements: row.requirement ? String(row.requirement).trim() : '',
          notes: row.notes ? String(row.notes).trim() : '',
          status: 'New',
          createdBy: req.user.id
        };
        
        const lead = new Lead(leadData);
        await lead.save();
        created.push(lead._id);
      } catch (err) {
        errors.push({ row: i + 1, reason: err.message });
      }
    }

    res.status(201).json({ 
      imported: created.length, 
      failed: errors.length,
      errors 
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Check user permissions for marketing leads page
router.get('/check-permissions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('role');
    
    const hasCreatePermission = user.role.permissions.some(
      p => p.module === 'leads' && p.actions.includes('create')
    );
    const hasReadPermission = user.role.permissions.some(
      p => p.module === 'leads' && p.actions.includes('read')
    );
    
    res.json({
      canCreate: hasCreatePermission,
      canRead: hasReadPermission,
      canViewAddedLeads: hasCreatePermission && hasReadPermission
    });
  } catch (error) {
    console.error('Check permissions error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
