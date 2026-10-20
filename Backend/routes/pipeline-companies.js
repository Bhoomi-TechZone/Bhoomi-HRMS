const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PipelineCompany = require('../models/PipelineCompany');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendCrmNotification } = require('../utils/crmNotifier');

// Helper for checking role permissions and data access levels
// Cutoff timestamp: old pipeline data (before this cutoff) is strictly visible ONLY to Admin
const DATA_CUTOFF_DATE = new Date(process.env.CRM_DATA_CUTOFF_DATE || '2026-10-17T00:00:00+05:30');

function checkAccess(user) {
  const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase().trim();
  const roleNormalized = roleName.replace(/\s+/g, ' ');

  const isSalesHead =
    roleNormalized.includes('sales head') ||
    roleNormalized === 'saleshead' ||
    roleNormalized === 'head of sales';

  const isSalesManager =
    roleNormalized.includes('sales manager') ||
    roleNormalized.includes('salesmanager') ||
    roleNormalized === 'manager of sales';

  const designation = (user?.designation || '').toString().toLowerCase().trim();
  const department = (user?.department || '').toString().toLowerCase().trim();
  const email = (user?.email || '').toString().toLowerCase().trim();

  const isAdmin =
    roleNormalized === 'admin' ||
    roleNormalized.includes('admin') ||
    roleNormalized.includes('superadmin') ||
    roleNormalized.includes('director') ||
    designation.includes('admin') ||
    designation.includes('director') ||
    department === 'administration' ||
    email.startsWith('admin@') ||
    user?.role?.name === 'Admin' ||
    user?.role?.name === 'Super Admin' ||
    user?.role?.name === 'Director';

  const hasFullAccess = isAdmin || isSalesHead || isSalesManager;

  const permissions = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];
  const hasRead = hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'companies' || p.module === 'deals') && p.actions.includes('read'));
  const hasCreate = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'companies' || p.module === 'deals') && p.actions.includes('create'));
  const hasUpdate = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'companies' || p.module === 'deals') && p.actions.includes('update'));
  const hasDelete = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'companies' || p.module === 'deals') && p.actions.includes('delete'));

  return { roleName, isSalesHead, isSalesManager, isAdmin, hasFullAccess, hasRead, hasCreate, hasUpdate, hasDelete };
}

// Helper to check if a specific company is accessible to a user
function isCompanyOwnedByUser(company, user, hasFullAccess, isAdmin) {
  if (isAdmin) return true;
  if (!company || !user) return false;

  const companyDate = new Date(company.createdAt || 0);
  if (companyDate < DATA_CUTOFF_DATE) return false;

  if (hasFullAccess) return true;

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

    const { hasRead, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasRead) {
      return res.status(403).json({ message: 'Access denied. Read permission required.' });
    }

    let query = {};

    const dataViewMode = (req.query.dataViewMode || '').toLowerCase().trim();

    // Data filtering by cutoff:
    // If not admin, strictly only see data from 17 OCT 2026 onwards
    // If admin and dataViewMode === 'new', only see data >= DATA_CUTOFF_DATE
    // If admin and dataViewMode === 'old', only see data < DATA_CUTOFF_DATE
    // If admin and dataViewMode === 'all' (or not specified), see all data
    if (!isAdmin) {
      query.createdAt = { $gte: DATA_CUTOFF_DATE };
    } else if (dataViewMode === 'new') {
      query.createdAt = { $gte: DATA_CUTOFF_DATE };
    } else if (dataViewMode === 'old') {
      query.createdAt = { $lt: DATA_CUTOFF_DATE };
    }

    // Data isolation: Sales Head, Sales Manager, and Admin see all new companies; other roles only see their own
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

    const { hasRead, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasRead) {
      return res.status(403).json({ message: 'Access denied. Read permission required.' });
    }

    const company = await PipelineCompany.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email');

    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (!isCompanyOwnedByUser(company, user, hasFullAccess, isAdmin)) {
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

    const { hasUpdate, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasUpdate) {
      return res.status(403).json({ message: 'Access denied. Update permission required.' });
    }

    const company = await PipelineCompany.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (!isCompanyOwnedByUser(company, user, hasFullAccess, isAdmin)) {
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

    const { hasDelete, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasDelete) {
      return res.status(403).json({ message: 'Access denied. Delete permission required.' });
    }

    const company = await PipelineCompany.findById(req.params.id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    if (!isCompanyOwnedByUser(company, user, hasFullAccess, isAdmin)) {
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

