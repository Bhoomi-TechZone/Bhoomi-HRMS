const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Deal = require('../models/Deal');
const Client = require('../models/Client');
const User = require('../models/User');
const Lead = require('../models/Lead');
const MetaLead = require('../models/MetaLead');
const auth = require('../middleware/auth');
const { sendCrmNotification } = require('../utils/crmNotifier');
const { notifyFollowUpScheduled, parseFollowUpDateTime } = require('../services/followupNotificationService');

// Helper to safely parse dates (supports DD-MM-YYYY, ISO strings, timestamps)
function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const ddmmyyyy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

// Helper to validate Mongo ObjectIds
function parseObjectId(val, fallback = null) {
  if (val && mongoose.Types.ObjectId.isValid(val)) {
    return val;
  }
  if (fallback && mongoose.Types.ObjectId.isValid(fallback)) {
    return fallback;
  }
  return null;
}

// Cutoff timestamp: old pipeline data (before this cutoff) is strictly visible ONLY to Admin
const DATA_CUTOFF_DATE = new Date(process.env.CRM_DATA_CUTOFF_DATE || '2026-10-17T00:00:00+05:30');

// Helper for checking role permissions and data access levels
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
    user?.role?.name === 'Director' ||
    user?.isAdmin === true;

  const hasFullAccess = isAdmin || isSalesHead || isSalesManager;

  const permissions = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];
  const hasRead = hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'deals' || p.module === 'proposals' || p.module === 'contacts' || p.module === 'leads') && p.actions.includes('read'));
  const hasCreate = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'deals' || p.module === 'contacts' || p.module === 'leads') && p.actions.includes('create'));
  const hasUpdate = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'deals' || p.module === 'contacts' || p.module === 'leads') && p.actions.includes('update'));
  const hasDelete = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'deals' || p.module === 'contacts' || p.module === 'leads') && p.actions.includes('delete'));

  return { roleName, isSalesHead, isSalesManager, isAdmin, hasFullAccess, hasRead, hasCreate, hasUpdate, hasDelete };
}

// Helper to check if a specific deal is accessible to a user
function isDealOwnedByUser(deal, user, hasFullAccess, isAdmin) {
  if (isAdmin || hasFullAccess) return true;
  if (!deal || !user) return false;

  // Non-privileged users cannot access deals before cutoff
  const dealDate = new Date(deal.createdAt || 0);
  if (dealDate < DATA_CUTOFF_DATE) return false;
  if (!deal || !user) return false;

  const userId = (user._id || user.id || '').toString();
  const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  const userOfficialEmail = (user.officialEmail || '').trim().toLowerCase();

  const assignedId = (deal.assignedTo?._id || deal.assignedTo || '').toString();
  const createdId = (deal.createdBy?._id || deal.createdBy || '').toString();
  const salesOwner = (deal.salesOwner || '').trim().toLowerCase();
  const addedBy = (deal.addedBy || '').trim().toLowerCase();
  const dealEmail = (deal.email || '').trim().toLowerCase();

  if (userId && (assignedId === userId || createdId === userId)) return true;
  if (userFullName && (salesOwner === userFullName || addedBy === userFullName)) return true;
  if (userEmail && (dealEmail === userEmail || salesOwner === userEmail || addedBy === userEmail)) return true;
  if (userOfficialEmail && (dealEmail === userOfficialEmail || salesOwner === userOfficialEmail)) return true;

  return false;
}

// Filter activities: Admin, Sales Head, and Sales Manager see all activities.
// Sales Executives and other non-full-access users only see follow-ups they personally created.
function filterActivitiesForUser(activities, user, hasFullAccess) {
  if (hasFullAccess || !Array.isArray(activities)) return activities;
  const userId = (user._id || user.id || '').toString();
  const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  const userOfficialEmail = (user.officialEmail || '').trim().toLowerCase();

  return activities.filter(act => {
    if (act.type !== 'followup') return true;
    const creatorId = (act.createdBy?._id || act.createdBy || '').toString();
    const author = (act.author || '').trim().toLowerCase();

    if (userId && creatorId && creatorId === userId) return true;
    if (userFullName && author === userFullName) return true;
    if (userEmail && author === userEmail) return true;
    if (userOfficialEmail && author === userOfficialEmail) return true;
    return false;
  });
}

// Get all deals (with optional filtering and role isolation)
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

    // Data isolation: Sales Head, Sales Manager, and Admin see all new deals; other roles only see their own
    if (!hasFullAccess) {
      const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const userEmail = (user.email || '').toLowerCase().trim();
      const userOfficialEmail = (user.officialEmail || '').toLowerCase().trim();

      const orConditions = [
        { assignedTo: user._id },
        { createdBy: user._id }
      ];
      if (userFullName) {
        orConditions.push({ salesOwner: { $regex: new RegExp(`^${userFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
        orConditions.push({ addedBy: { $regex: new RegExp(`^${userFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
      }
      if (userEmail) {
        orConditions.push({ email: userEmail });
      }
      if (userOfficialEmail) {
        orConditions.push({ email: userOfficialEmail });
      }

      query.$or = orConditions;
    }

    // Filter by pipeline if provided
    if (req.query.pipeline) {
      query.pipeline = req.query.pipeline;
    }
    
    // Filter by stage if provided
    if (req.query.stage && req.query.stage !== 'all') {
      query.stage = req.query.stage;
    }
    
    // Filter by source if provided
    if (req.query.source && req.query.source !== 'all') {
      query.source = req.query.source;
    }
    
    try {
      const deals = await Deal.find(query)
        .populate('assignedTo', 'firstName lastName email officialEmail employeeId designation department phone alternatePhone isActive role')
        .populate('createdBy', 'firstName lastName email')
        .populate('relatedLead', 'phone contactNumber requirement requirements notes history')
        .populate('relatedMetaLead', 'phone notes businessCategory fieldData')
        .sort({ createdAt: -1 });

      const sanitizedDeals = (!hasFullAccess && Array.isArray(deals))
        ? deals.map(d => {
            const dObj = d.toObject ? d.toObject() : { ...d };
            if (dObj.activities) {
              dObj.activities = filterActivitiesForUser(dObj.activities, user, hasFullAccess);
            }
            return dObj;
          })
        : deals;

      res.json(sanitizedDeals || []);
    } catch (popError) {
      const unpopulated = await Deal.find(query).sort({ createdAt: -1 });
      const sanitizedDeals = (!hasFullAccess && Array.isArray(unpopulated))
        ? unpopulated.map(d => {
            const dObj = d.toObject ? d.toObject() : { ...d };
            if (dObj.activities) {
              dObj.activities = filterActivitiesForUser(dObj.activities, user, hasFullAccess);
            }
            return dObj;
          })
        : unpopulated;
      res.json(sanitizedDeals || []);
    }
  } catch (error) {
    console.error('Get deals error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single deal by ID
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

    let deal;
    try {
      deal = await Deal.findById(req.params.id)
        .populate('assignedTo', 'firstName lastName email officialEmail employeeId designation department phone alternatePhone isActive role')
        .populate('createdBy', 'firstName lastName email')
        .populate('relatedLead', 'phone contactNumber requirement requirements notes history')
        .populate('relatedMetaLead', 'phone notes businessCategory fieldData');
    } catch (e) {
      deal = await Deal.findById(req.params.id);
    }
    
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    // Role data isolation check
    if (!isDealOwnedByUser(deal, user, hasFullAccess, isAdmin)) {
      return res.status(403).json({ message: 'Access denied. You can only view your own deals.' });
    }
    
    if (!hasFullAccess && deal.activities) {
      const dealObj = deal.toObject ? deal.toObject() : { ...deal };
      dealObj.activities = filterActivitiesForUser(dealObj.activities, user, hasFullAccess);
      return res.json(dealObj);
    }

    res.json(deal);
  } catch (error) {
    console.error('Get deal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new deal
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
      dealName,
      clientName,
      email,
      phone,
      company,
      pipeline,
      stage,
      dealValue,
      currency,
      dealType,
      location,
      salesOwner,
      contactId,
      expectedCloseDate,
      probability,
      source,
      description,
      requirements,
      notes,
      assignedTo
    } = req.body;
    
    let validAssignedTo = parseObjectId(assignedTo, null);
    const validCreatedBy = parseObjectId(req.user?._id, null);
    const parsedCloseDate = parseDate(expectedCloseDate);
    const resolvedSalesOwner = salesOwner || (req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : 'Akhil Verma');

    // Auto-resolve assignedTo if missing
    if (!validAssignedTo && resolvedSalesOwner) {
      try {
        const foundUser = await User.findOne({
          $or: [
            { $expr: { $eq: [{ $concat: ['$firstName', ' ', '$lastName'] }, resolvedSalesOwner.trim()] } },
            { email: resolvedSalesOwner.trim().toLowerCase() },
            { officialEmail: resolvedSalesOwner.trim().toLowerCase() }
          ]
        });
        if (foundUser) validAssignedTo = foundUser._id;
      } catch (e) { }
    }

    const deal = new Deal({
      dealName: dealName || clientName || 'New Deal',
      clientName: clientName || dealName || 'Client',
      email: email || '',
      phone: phone || '',
      company: company || '',
      pipeline: pipeline || 'Sales Pipeline',
      stage: stage || 'New',
      dealValue: dealValue ? Number(dealValue) : 0,
      currency: currency || '$',
      dealType: dealType || 'New Business',
      location: location || 'Pune, India',
      salesOwner: resolvedSalesOwner,
      contactId: contactId || null,
      expectedCloseDate: parsedCloseDate,
      probability: probability !== undefined ? Number(probability) : 10,
      source: source || 'Direct',
      description: description || '',
      requirements: requirements || '',
      notes: notes || '',
      assignedTo: validAssignedTo,
      createdBy: validCreatedBy,
      addedBy: req.body.addedBy || (req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : '') || 'Admin'
    });
    
    await deal.save();
    
    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Deal',
        action: 'create',
        entityName: deal.dealName || deal.clientName || 'New Deal',
        assigneeUser: deal.assignedTo,
        assigneeName: deal.salesOwner,
        link: '/pipeline?tab=deals'
      });
    } catch (notifErr) {
      console.error('Deal create notification error:', notifErr);
    }
    
    try {
      const populatedDeal = await Deal.findById(deal._id)
        .populate('assignedTo', 'firstName lastName email employeeId')
        .populate('createdBy', 'firstName lastName email');
      res.status(201).json(populatedDeal || deal);
    } catch (popErr) {
      res.status(201).json(deal);
    }
  } catch (error) {
    console.error('Create deal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update deal
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

    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (!isDealOwnedByUser(deal, user, hasFullAccess, isAdmin)) {
      return res.status(403).json({ message: 'Access denied. You can only update your own deals.' });
    }
    
    const {
      dealName,
      clientName,
      email,
      phone,
      company,
      pipeline,
      stage,
      dealValue,
      currency,
      dealType,
      location,
      salesOwner,
      contactId,
      expectedCloseDate,
      probability,
      source,
      description,
      requirements,
      notes,
      lostReason,
      assignedTo,
      milestoneStatuses
    } = req.body;

    const oldSalesOwner = (deal.salesOwner || '').trim();
    const oldAssignedToStr = (deal.assignedTo?._id || deal.assignedTo || '').toString();
    
    // Update fields
    if (dealName !== undefined) deal.dealName = dealName;
    if (clientName !== undefined) deal.clientName = clientName;
    if (email !== undefined) deal.email = email;
    if (phone !== undefined) deal.phone = phone;
    if (company !== undefined) deal.company = company;
    if (pipeline !== undefined) {
      deal.pipeline = pipeline;
      if (stage === undefined) {
        deal.stage = pipeline;
      }
    }
    if (dealValue !== undefined) deal.dealValue = Number(dealValue);
    if (currency !== undefined) deal.currency = currency;
    if (dealType !== undefined) deal.dealType = dealType;
    if (location !== undefined) deal.location = location;
    if (salesOwner !== undefined) deal.salesOwner = salesOwner;
    if (contactId !== undefined) deal.contactId = contactId;
    if (expectedCloseDate !== undefined) deal.expectedCloseDate = parseDate(expectedCloseDate);
    if (probability !== undefined) deal.probability = Number(probability);
    if (source !== undefined) deal.source = source;
    if (description !== undefined) deal.description = description;
    if (requirements !== undefined) deal.requirements = requirements;
    if (notes !== undefined) deal.notes = notes;
    if (req.body.addedBy !== undefined) deal.addedBy = req.body.addedBy;
    if (assignedTo !== undefined) deal.assignedTo = parseObjectId(assignedTo, deal.assignedTo);
    if (milestoneStatuses !== undefined) {
      deal.milestoneStatuses = milestoneStatuses;
    }

    // Auto-resolve assignedTo if salesOwner updated or missing
    if (deal.salesOwner && (!deal.assignedTo || (salesOwner !== undefined && salesOwner !== oldSalesOwner && assignedTo === undefined))) {
      try {
        const foundUser = await User.findOne({
          $or: [
            { $expr: { $eq: [{ $concat: ['$firstName', ' ', '$lastName'] }, deal.salesOwner.trim()] } },
            { email: deal.salesOwner.trim().toLowerCase() },
            { officialEmail: deal.salesOwner.trim().toLowerCase() }
          ]
        });
        if (foundUser) deal.assignedTo = foundUser._id;
      } catch (e) { }
    }

    const newSalesOwner = (deal.salesOwner || '').trim();
    const newAssignedToStr = (deal.assignedTo?._id || deal.assignedTo || '').toString();

    const isOwnerChanged = (salesOwner !== undefined && newSalesOwner.toLowerCase() !== oldSalesOwner.toLowerCase()) ||
      (assignedTo !== undefined && newAssignedToStr !== oldAssignedToStr && newAssignedToStr);

    // If deal owner changed, automatically log activity in deal
    if (isOwnerChanged && newSalesOwner) {
      const actorName = (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : '') || user.email || 'Admin System';
      const now = new Date();
      const istTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
      const istDate = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
      const activityContent = oldSalesOwner && oldSalesOwner.toLowerCase() !== newSalesOwner.toLowerCase()
        ? `${actorName} changed deal owner from ${oldSalesOwner} to ${newSalesOwner}.`
        : `${actorName} assigned the deal to ${newSalesOwner}.`;

      deal.activities.unshift({
        type: 'deal',
        title: 'Deal Owner Assigned',
        content: activityContent,
        author: actorName,
        time: istTime,
        date: istDate,
        createdAt: now
      });
    }
    
    // Update stage & keep synchronized with pipeline
    if (stage !== undefined) {
      deal.stage = stage;
      if (pipeline === undefined) {
        deal.pipeline = stage;
      }
    }
    
    const effectiveStage = (deal.stage || deal.pipeline || '').trim();
    if (effectiveStage.toLowerCase() === 'won' || effectiveStage.toLowerCase() === 'closed won') {
      deal.actualCloseDate = new Date();
      const existingClient = await Client.findOne({ relatedDeal: deal._id });
      if (!existingClient) {
        const newClient = new Client({
          name: deal.clientName,
          company: deal.company || '',
          email: deal.email || '',
          phone: deal.phone || '',
          source: deal.source || 'Lead Conversion',
          requirements: deal.requirements || '',
          notes: deal.notes || '',
          dealValue: deal.dealValue || 0,
          assignedTo: deal.assignedTo || null,
          createdBy: parseObjectId(req.user?._id, null),
          relatedDeal: deal._id,
          convertedAt: new Date()
        });
        await newClient.save();
      }
    } else if (effectiveStage.toLowerCase() === 'lost' || effectiveStage.toLowerCase() === 'closed lost') {
      deal.actualCloseDate = new Date();
      if (lostReason) deal.lostReason = lostReason;
    }
    
    await deal.save();
    
    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Deal',
        action: isOwnerChanged ? 'assign' : 'update',
        entityName: deal.dealName || deal.clientName || 'Deal',
        assigneeUser: deal.assignedTo,
        assigneeName: deal.salesOwner,
        link: '/pipeline?tab=deals'
      });
    } catch (notifErr) {
      console.error('Deal update notification error:', notifErr);
    }
    
    try {
      const updatedDeal = await Deal.findById(deal._id)
        .populate('assignedTo', 'firstName lastName email employeeId')
        .populate('createdBy', 'firstName lastName email');
      res.json(updatedDeal || deal);
    } catch (popErr) {
      res.json(deal);
    }
  } catch (error) {
    console.error('Update deal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk delete deals
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) return res.status(401).json({ message: 'User not found' });
    const { hasDelete, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasDelete) return res.status(403).json({ message: 'Access denied. Delete permission required.' });

    const { dealIds } = req.body;
    if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
      return res.status(400).json({ message: 'dealIds array is required' });
    }

    const validIds = dealIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return res.json({ success: true, count: 0 });
    }

    let filter = { _id: { $in: validIds } };
    if (!isAdmin && !hasFullAccess) {
      const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      const userEmail = (user.email || '').trim().toLowerCase();
      filter.$or = [
        { assignedTo: user._id },
        { createdBy: user._id }
      ];
      if (userFullName) {
        filter.$or.push({ salesOwner: new RegExp(`^${userFullName}$`, 'i') });
        filter.$or.push({ addedBy: new RegExp(`^${userFullName}$`, 'i') });
      }
      if (userEmail) {
        filter.$or.push({ email: userEmail });
      }
    }

    // Find deals before deletion to clean up any related leads
    const dealsToDelete = await Deal.find(filter).select('_id relatedLead relatedMetaLead dealName clientName');
    const dealIdsToDelete = dealsToDelete.map(d => d._id);

    const result = await Deal.deleteMany({ _id: { $in: dealIdsToDelete } });

    // Clean up related leads if any
    const leadIds = dealsToDelete.map(d => d.relatedLead).filter(Boolean);
    const metaLeadIds = dealsToDelete.map(d => d.relatedMetaLead).filter(Boolean);

    if (leadIds.length > 0) {
      await Lead.updateMany(
        { _id: { $in: leadIds } },
        { $set: { movedToPipeline: false, pipelineDealId: null } }
      ).catch(() => {});
    }
    if (metaLeadIds.length > 0) {
      await MetaLead.updateMany(
        { _id: { $in: metaLeadIds } },
        { $set: { movedToPipeline: false, pipelineDealId: null } }
      ).catch(() => {});
    }

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Deal',
        action: 'delete',
        entityName: `${dealsToDelete.length} Deal(s)`,
        link: '/pipeline?tab=deals'
      });
    } catch (notifErr) {}

    res.json({ success: true, count: result.deletedCount });
  } catch (error) {
    console.error('Bulk delete deals error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete deal
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

    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (!isDealOwnedByUser(deal, user, hasFullAccess, isAdmin)) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own deals.' });
    }
    
    const deletedDealName = deal.dealName || deal.clientName || 'Deal';
    await Deal.findByIdAndDelete(req.params.id);

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Deal',
        action: 'delete',
        entityName: deletedDealName,
        link: '/pipeline?tab=deals'
      });
    } catch (notifErr) {
      console.error('Deal delete notification error:', notifErr);
    }

    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Delete deal error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add activity log to deal
router.post('/:id/activities', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasUpdate, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasUpdate) {
      return res.status(403).json({ message: 'Access denied. Update permission required.' });
    }

    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    if (!isDealOwnedByUser(deal, user, hasFullAccess, isAdmin)) {
      return res.status(403).json({ message: 'Access denied. You can only add activities to your own deals.' });
    }

    const { type, title, content, remarks, channel, status, followUpDate, followUpTime, nextFollowUpDate, author, authorRole, time, date, memberId, memberName, assignedTo, assignedToName } = req.body;
    const authorName = author || (req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() : 'Admin System');
    
    // Resolve member/assignedTo ObjectId if valid MongoDB ObjectId
    const resolvedMemberId = memberId || assignedTo || null;
    const isValidMemberObjectId = resolvedMemberId && mongoose.Types.ObjectId.isValid(resolvedMemberId);

    const newActivity = {
      type: type || 'note',
      title: title || '',
      content: content || remarks || '',
      remarks: remarks || content || '',
      channel: channel || 'Call',
      status: status || 'Scheduled',
      followUpDate: followUpDate || '',
      followUpTime: followUpTime || '',
      nextFollowUpDate: nextFollowUpDate || '',
      author: authorName,
      authorRole: authorRole || (user?.role?.name || user?.role || ''),
      createdBy: user._id,
      assignedTo: isValidMemberObjectId ? resolvedMemberId : null,
      assignedToName: memberName || assignedToName || '',
      member: isValidMemberObjectId ? resolvedMemberId : null,
      memberId: resolvedMemberId ? String(resolvedMemberId) : '',
      memberName: memberName || assignedToName || '',
      reminderSent: false,
      time: time || 'Just now',
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: new Date()
    };

    // Deduplication check: prevent adding duplicate activity
    const isDuplicate = Array.isArray(deal.activities) && deal.activities.some(a =>
      a.type === (type || 'note') &&
      (a.title || '').trim().toLowerCase() === (title || '').trim().toLowerCase() &&
      (a.remarks || a.content || '').trim().toLowerCase() === (remarks || content || '').trim().toLowerCase() &&
      (a.followUpDate || a.date || '') === (followUpDate || date || '') &&
      (a.followUpTime || a.time || '') === (followUpTime || time || '')
    );

    if (isDuplicate) {
      return res.status(200).json(deal.activities.find(a => (a.title || '').trim().toLowerCase() === (title || '').trim().toLowerCase()) || deal.activities[0]);
    }

    deal.activities.unshift(newActivity);
    await deal.save();

    const savedActivity = deal.activities[0];

    if (newActivity.type === 'followup') {
      notifyFollowUpScheduled(req.app.get('socketio'), {
        entity: deal,
        activity: savedActivity,
        creatorUser: user,
        isContact: false
      }).catch(err => console.error('notifyFollowUpScheduled error:', err));
    }

    res.status(201).json(savedActivity);
  } catch (error) {
    console.error('Add deal activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update deal activity (e.g. status or remarks)
router.patch('/:id/activities/:activityId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    const actId = req.params.activityId;
    const activity = deal.activities.find(a => (a._id && a._id.toString() === actId) || a.id === actId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    const { status, remarks, content, followUpDate, followUpTime, nextFollowUpDate, title, channel, memberId, memberName, assignedTo, assignedToName } = req.body;

    const { hasFullAccess, isAdmin } = checkAccess(user);
    const isCreator = (activity.createdBy && activity.createdBy.toString() === user._id.toString()) ||
      (activity.author && activity.author.toLowerCase() === `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase());
    const isAssignedMember = (activity.assignedTo && activity.assignedTo.toString() === user._id.toString()) ||
      (activity.member && activity.member.toString() === user._id.toString()) ||
      (activity.memberId && activity.memberId.toString() === user._id.toString()) ||
      (activity.memberName && activity.memberName.toLowerCase() === `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase());

    // User can edit if creator, assigned member, or admin/sales head
    if (!isCreator && !isAssignedMember && !isAdmin && !hasFullAccess) {
      return res.status(403).json({ message: 'Access denied. You can only edit follow-ups you created or are assigned to.' });
    }

    let rescheduled = false;
    if (title !== undefined) activity.title = title;
    if (channel !== undefined) activity.channel = channel;
    if (status !== undefined) activity.status = status;
    if (remarks !== undefined) {
      activity.remarks = remarks;
      activity.content = remarks;
    }
    if (content !== undefined && remarks === undefined) activity.content = content;
    if (followUpDate !== undefined && followUpDate !== activity.followUpDate) {
      activity.followUpDate = followUpDate;
      rescheduled = true;
    }
    if (followUpTime !== undefined && followUpTime !== activity.followUpTime) {
      activity.followUpTime = followUpTime;
      rescheduled = true;
    }
    if (nextFollowUpDate !== undefined) activity.nextFollowUpDate = nextFollowUpDate;

    if (memberId !== undefined || assignedTo !== undefined) {
      const newMemberId = memberId !== undefined ? memberId : assignedTo;
      if (newMemberId && mongoose.Types.ObjectId.isValid(newMemberId)) {
        activity.assignedTo = newMemberId;
        activity.member = newMemberId;
      } else {
        activity.assignedTo = null;
        activity.member = null;
      }
      activity.memberId = newMemberId ? String(newMemberId) : '';
    }
    if (memberName !== undefined || assignedToName !== undefined) {
      const newMemberName = memberName !== undefined ? memberName : assignedToName;
      activity.memberName = newMemberName || '';
      activity.assignedToName = newMemberName || '';
    }

    if (rescheduled || (status && status !== 'Completed' && status !== 'Missed')) {
      activity.reminderSent = false;
      activity.reminderSentAt = null;
    }

    await deal.save();

    if (rescheduled && activity.type === 'followup') {
      notifyFollowUpScheduled(req.app.get('socketio'), {
        entity: deal,
        activity,
        creatorUser: user,
        isContact: false
      }).catch(err => console.error('notifyFollowUpScheduled error on reschedule:', err));
    }

    res.json(activity);
  } catch (error) {
    console.error('Update deal activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete deal activity
router.delete('/:id/activities/:activityId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ message: 'Deal not found' });
    }

    const actId = req.params.activityId;
    const activity = deal.activities.find(a => (a._id && a._id.toString() === actId) || a.id === actId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    const { hasFullAccess, isAdmin } = checkAccess(user);
    const isCreator = (activity.createdBy && activity.createdBy.toString() === user._id.toString()) ||
      (activity.author && activity.author.toLowerCase() === `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase());

    // User can only delete if creator or admin/sales head
    if (!isCreator && !isAdmin && !hasFullAccess) {
      return res.status(403).json({ message: 'Access denied. You can only delete follow-ups you created.' });
    }

    deal.activities = deal.activities.filter(a => !(a._id && a._id.toString() === actId) && a.id !== actId);
    await deal.save();
    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Delete deal activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get deals statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const allDeals = await Deal.find({});
    const total = allDeals.length;
    const wonDeals = allDeals.filter(d => (d.stage || '').toLowerCase() === 'won' || d.stage === 'Closed Won');
    const totalValue = allDeals.reduce((sum, d) => sum + (d.dealValue || 0), 0);
    const wonValue = wonDeals.reduce((sum, d) => sum + (d.dealValue || 0), 0);
    
    res.json({
      total,
      totalValue,
      wonValue,
      winRate: total > 0 ? ((wonDeals.length / total) * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
