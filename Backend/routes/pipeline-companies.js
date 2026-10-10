const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PipelineCompany = require('../models/PipelineCompany');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendCrmNotification } = require('../utils/crmNotifier');

// Helper for checking role permissions and data access levels
function checkAccess(user) {
  const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase().trim();
  const isSalesHead = roleName === 'sales head' || roleName === 'saleshead' || roleName === 'head of sales';
  const isAdmin = roleName === 'admin' || roleName === 'super admin' || roleName === 'director';
  const hasFullAccess = isAdmin || isSalesHead;

  const permissions = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];
  const hasRead = hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'companies' || p.module === 'deals') && p.actions.includes('read'));
  const hasCreate = isAdmin || permissions.some(p => (p.module === 'pipeline' || p.module === 'companies' || p.module === 'deals') && p.actions.includes('create'));
  const hasUpdate = isAdmin || permissions.some(p => (p.module === 'pipeline' || p.module === 'companies' || p.module === 'deals') && p.actions.includes('update'));
  const hasDelete = isAdmin || permissions.some(p => (p.module === 'pipeline' || p.module === 'companies' || p.module === 'deals') && p.actions.includes('delete'));

  return { roleName, isSalesHead, isAdmin, hasFullAccess, hasRead, hasCreate, hasUpdate, hasDelete };
}

// Helper to check if a specific company is accessible to a user
function isCompanyOwnedByUser(company, user, hasFullAccess) {
  if (hasFullAccess) return true;
  if (!company || !user) return false;

  const userId = (user._id || user.id || '').toString();
  const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();

  const assignedId = (company.assignedTo?._id || company.assignedTo || '').toString();
  const createdId = (company.createdBy?._id || company.createdBy || '').toString();
  const owner = (company.owner || '').trim().toLowerCase();

  if (userId && (assignedId === userId || createdId === userId)) return true;
  if (userFullName && owner === userFullName) return true;
  if (userEmail && owner === userEmail) return true;

  return false;
}

// Get all pipeline companies
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasRead, hasFullAccess } = checkAccess(user);
    if (!hasRead) {
      return res.status(403).json({ message: 'Access denied. Read permission required.' });
    }

    let query = {};

    // Data isolation: Sales Head and Admin see all companies; other roles only see their data
    if (!hasFullAccess) {
      const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const userEmail = (user.email || '').toLowerCase().trim();

      const orConditions = [
        { assignedTo: user._id },
        { createdBy: user._id }
      ];
      if (userFullName) {
        orConditions.push({ owner: { $regex: new RegExp(`^${userFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
      }
      if (userEmail) {
        orConditions.push({ owner: userEmail });
      }

      query.$or = orConditions;
    }

    const companies = await PipelineCompany.find(query)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(companies || []);
  } catch (error) {
    console.error('Get pipeline companies error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single company by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasRead, hasFullAccess } = checkAccess(user);
    if (!hasRead) {
      return res.status(403).json({ message: 'Access denied. Read permission required.' });
    }

    const company = await PipelineCompany.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email');

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (!isCompanyOwnedByUser(company, user, hasFullAccess)) {
      return res.status(403).json({ message: 'Access denied. You can only view your own companies.' });
    }

    res.json(company);
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new pipeline company
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasCreate } = checkAccess(user);
    if (!hasCreate) {
      return res.status(403).json({ message: 'Access denied. Create permission required.' });
    }

    const {
      name,
      domain,
      owner,
      industry,
      country,
      state,
      city,
      postalCode,
      assignedTo
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Company name is required' });
    }

    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';
    const validAssignedTo = (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo))
      ? assignedTo
      : (user._id || null);

    const company = new PipelineCompany({
      name: name.trim(),
      domain: domain || '',
      owner: owner || userFullName,
      industry: industry || 'Software & Tech',
      country: country || 'United States',
      state: state || '',
      city: city || '',
      postalCode: postalCode || '',
      assignedTo: validAssignedTo,
      createdBy: user._id
    });

    await company.save();

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Company',
        action: 'create',
        entityName: company.name || 'New Company',
        link: '/pipeline?tab=companies'
      });
    } catch (notifErr) {
      console.error('Company create notification error:', notifErr);
    }

    res.status(201).json(company);
  } catch (error) {
    console.error('Create pipeline company error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update pipeline company
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasUpdate, hasFullAccess } = checkAccess(user);
    if (!hasUpdate) {
      return res.status(403).json({ message: 'Access denied. Update permission required.' });
    }

    const company = await PipelineCompany.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (!isCompanyOwnedByUser(company, user, hasFullAccess)) {
      return res.status(403).json({ message: 'Access denied. You can only update your own companies.' });
    }

    const {
      name,
      domain,
      owner,
      industry,
      country,
      state,
      city,
      postalCode,
      assignedTo
    } = req.body;

    if (name) company.name = name.trim();
    if (domain !== undefined) company.domain = domain;
    if (owner !== undefined) company.owner = owner;
    if (industry !== undefined) company.industry = industry;
    if (country !== undefined) company.country = country;
    if (state !== undefined) company.state = state;
    if (city !== undefined) company.city = city;
    if (postalCode !== undefined) company.postalCode = postalCode;
    if (assignedTo !== undefined) {
      company.assignedTo = (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) ? assignedTo : null;
    }

    await company.save();

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Company',
        action: 'update',
        entityName: company.name || 'Company',
        link: '/pipeline?tab=companies'
      });
    } catch (notifErr) {
      console.error('Company update notification error:', notifErr);
    }

    res.json(company);
  } catch (error) {
    console.error('Update pipeline company error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete pipeline company
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasDelete, hasFullAccess } = checkAccess(user);
    if (!hasDelete) {
      return res.status(403).json({ message: 'Access denied. Delete permission required.' });
    }

    const company = await PipelineCompany.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (!isCompanyOwnedByUser(company, user, hasFullAccess)) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own companies.' });
    }

    const deletedCompanyName = company.name || 'Company';
    await PipelineCompany.findByIdAndDelete(req.params.id);

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Company',
        action: 'delete',
        entityName: deletedCompanyName,
        link: '/pipeline?tab=companies'
      });
    } catch (notifErr) {
      console.error('Company delete notification error:', notifErr);
    }

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Delete pipeline company error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

