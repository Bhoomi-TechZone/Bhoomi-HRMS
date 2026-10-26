const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PipelineContact = require('../models/PipelineContact');
const Deal = require('../models/Deal');
const Lead = require('../models/Lead');
const MetaLead = require('../models/MetaLead');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendCrmNotification, sendAdminDataActivityNotification } = require('../utils/crmNotifier');
const { notifyFollowUpScheduled, parseFollowUpDateTime } = require('../services/followupNotificationService');

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
    user?.role?.name === 'Director';

  const hasFullAccess = isAdmin || isSalesHead || isSalesManager;

  const permissions = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];
  const hasRead = hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'contacts' || p.module === 'deals' || p.module === 'leads') && p.actions.includes('read'));
  const hasCreate = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'contacts' || p.module === 'deals' || p.module === 'leads') && p.actions.includes('create'));
  const hasUpdate = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'contacts' || p.module === 'deals' || p.module === 'leads') && p.actions.includes('update'));
  const hasDelete = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'contacts' || p.module === 'deals' || p.module === 'leads') && p.actions.includes('delete'));

  return { roleName, isSalesHead, isSalesManager, isAdmin, hasFullAccess, hasRead, hasCreate, hasUpdate, hasDelete };
}

// Helper to check if a specific contact is accessible to a user
function isContactOwnedByUser(contact, user, hasFullAccess, isAdmin) {
  if (isAdmin || hasFullAccess) return true;
  if (!contact || !user) return false;

  const contactDate = new Date(contact.createdAt || 0);
  if (contactDate < DATA_CUTOFF_DATE) return false;

  const userId = (user._id || user.id || '').toString();
  const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();
  const userOfficialEmail = (user.officialEmail || '').trim().toLowerCase();

  const assignedId = (contact.assignedTo?._id || contact.assignedTo || '').toString();
  const createdId = (contact.createdBy?._id || contact.createdBy || '').toString();
  const owner = (contact.owner || '').trim().toLowerCase();
  const addedBy = (contact.addedBy || '').trim().toLowerCase();
  const contactEmail = (contact.email || '').trim().toLowerCase();

  if (userId && (assignedId === userId || createdId === userId)) return true;
  if (userFullName && (owner === userFullName || addedBy === userFullName)) return true;
  if (userEmail && (contactEmail === userEmail || owner === userEmail || addedBy === userEmail)) return true;
  if (userOfficialEmail && (contactEmail === userOfficialEmail || owner === userOfficialEmail)) return true;

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

// Get all pipeline contacts
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
    if (req.query.includeUnmoved !== 'true') {
      query.isUnmoved = { $ne: true };
    }

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

    // Data isolation: Sales Head, Sales Manager, and Admin see all new contacts; other roles only see their own
    if (!hasFullAccess) {
      const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const userEmail = (user.email || '').toLowerCase().trim();
      const userOfficialEmail = (user.officialEmail || '').toLowerCase().trim();

      const orConditions = [
        { assignedTo: user._id },
        { createdBy: user._id }
      ];
      if (userFullName) {
        orConditions.push({ owner: { $regex: new RegExp(`^${userFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
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

    const contacts = await PipelineContact.find(query)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    const sanitizedContacts = (!hasFullAccess && Array.isArray(contacts))
      ? contacts.map(c => {
          const cObj = c.toObject ? c.toObject() : { ...c };
          if (cObj.activities) {
            cObj.activities = filterActivitiesForUser(cObj.activities, user, hasFullAccess);
          }
          return cObj;
        })
      : contacts;

    res.json(sanitizedContacts || []);
  } catch (error) {
    console.error('Get pipeline contacts error:', error);
    try {
      // Fallback without populate if population schema has any issue
      const unpopulated = await PipelineContact.find(query).sort({ createdAt: -1 });
      const sanitizedContacts = (!hasFullAccess && Array.isArray(unpopulated))
        ? unpopulated.map(c => {
            const cObj = c.toObject ? c.toObject() : { ...c };
            if (cObj.activities) {
              cObj.activities = filterActivitiesForUser(cObj.activities, user, hasFullAccess);
            }
            return cObj;
          })
        : unpopulated;
      return res.json(sanitizedContacts || []);
    } catch (e) {
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
});

// Get single contact by ID
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

    const contact = await PipelineContact.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email');

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    // Role data isolation check
    if (!isContactOwnedByUser(contact, user, hasFullAccess, isAdmin)) {
      return res.status(403).json({ message: 'Access denied. You can only view your own contacts.' });
    }

    if (!hasFullAccess && contact.activities) {
      const contactObj = contact.toObject ? contact.toObject() : { ...contact };
      contactObj.activities = filterActivitiesForUser(contactObj.activities, user, hasFullAccess);
      return res.json(contactObj);
    }

    res.json(contact);
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper to move a single lead into Deals (New Lead stage) and Pipeline Contacts
async function moveSingleLeadToPipeline({ leadId, leadType = 'regular', overrideData = {}, user, userFullName }) {
  if (!leadId) return null;

  let lead = null;
  if (leadType === 'meta') {
    lead = await MetaLead.findById(leadId).populate('assignedTo');
  } else {
    lead = await Lead.findById(leadId).populate('assignedTo');
  }

  // Parse name
  let firstName = (overrideData.firstName || '').trim();
  let lastName = (overrideData.lastName || '').trim();
  if (!firstName) {
    const rawName = (lead?.name || '').trim();
    if (rawName) {
      const parts = rawName.split(/\s+/);
      firstName = parts[0] || 'Lead';
      lastName = parts.slice(1).join(' ') || '';
    } else {
      firstName = 'Lead';
    }
  }

  const cleanEmail = (overrideData.email || lead?.email || '').toLowerCase().trim();
  const phone = (overrideData.phone || lead?.phone || '').trim();
  const company = (overrideData.company || lead?.company || lead?.businessCategory || '').trim();
  const address = overrideData.address || lead?.country || lead?.city || '';
  const notes = overrideData.notes || lead?.requirements || lead?.requirement || lead?.notes || '';
  const contactSource = overrideData.contactSource || (leadType === 'meta' ? (lead?.pageName ? `Meta · ${lead.pageName}` : 'Meta') : (lead?.source || 'Manual'));

  // Assigned To & Owner resolution
  let validAssignedTo = overrideData.assignedTo;
  if (!validAssignedTo && lead?.assignedTo) {
    validAssignedTo = lead.assignedTo._id || lead.assignedTo;
  }
  if (validAssignedTo && !mongoose.Types.ObjectId.isValid(validAssignedTo)) {
    validAssignedTo = null;
  }

  let owner = overrideData.owner;
  if (!owner && lead?.assignedTo) {
    owner = `${lead.assignedTo.firstName || ''} ${lead.assignedTo.lastName || ''}`.trim() || lead.assignedTo.email;
  }
  if (!owner) owner = userFullName;

  const targetStage = 'New Lead';

  // 1. PipelineContact upsert
  let contact = null;
  if (cleanEmail) {
    contact = await PipelineContact.findOne({ email: cleanEmail });
  }
  if (!contact && leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    contact = await PipelineContact.findOne({ relatedLead: leadId });
  }

  if (contact) {
    contact.leadStage = targetStage;
    contact.firstName = firstName;
    if (lastName) contact.lastName = lastName;
    if (phone) contact.phone = phone;
    if (overrideData.countryCode) contact.countryCode = overrideData.countryCode;
    if (overrideData.origin) contact.origin = overrideData.origin;
    if (contactSource) contact.contactSource = contactSource;
    if (company) contact.company = company;
    if (address) contact.address = address;
    if (notes) contact.notes = contact.notes ? `${contact.notes}\n${notes}` : notes;
    if (owner) contact.owner = owner;
    if (validAssignedTo) contact.assignedTo = validAssignedTo;
    if (leadId && mongoose.Types.ObjectId.isValid(leadId)) contact.relatedLead = leadId;
    contact.leadRecordType = leadType;
    contact.isUnmoved = false;
    contact.unmovedAt = null;
    contact.unmovedBy = null;
    contact.activities.push({
      type: 'note',
      title: 'Lead moved to Pipeline',
      content: `Lead updated and moved to stage "${targetStage}" by ${userFullName}.`,
      author: userFullName,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      createdAt: new Date()
    });
    await contact.save();
  } else {
    contact = new PipelineContact({
      firstName,
      lastName: lastName || '',
      email: cleanEmail || undefined,
      phone: phone || '',
      countryCode: overrideData.countryCode || '+1',
      origin: overrideData.origin || 'Domestic',
      contactSource: contactSource || (leadType === 'meta' ? 'Meta' : 'Manual'),
      leadStage: targetStage,
      leadStatus: 'New',
      owner,
      addedBy: overrideData.addedBy || userFullName,
      assignedTo: validAssignedTo,
      company: company || '',
      address: address || '',
      notes: notes || '',
      createdBy: user._id,
      relatedLead: (leadId && mongoose.Types.ObjectId.isValid(leadId)) ? leadId : null,
      leadRecordType: leadType,
      isUnmoved: false,
      activities: [{
        type: 'note',
        title: 'Lead moved to Pipeline',
        content: `Moved from ${leadType === 'meta' ? 'Meta Leads' : 'Leads'} into "${targetStage}" stage by ${userFullName}.`,
        author: userFullName,
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        createdAt: new Date()
      }]
    });
    await contact.save();
  }

  // 2. Deal upsert into Deals collection under "New Lead" stage
  let deal = null;
  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    if (leadType === 'meta') {
      deal = await Deal.findOne({ relatedMetaLead: leadId });
    } else {
      deal = await Deal.findOne({ relatedLead: leadId });
    }
  }
  if (!deal && cleanEmail) {
    deal = await Deal.findOne({ email: cleanEmail });
  }

  const clientDisplayName = `${firstName} ${lastName || ''}`.trim() || company || 'Client';
  const dealName = clientDisplayName;

  if (deal) {
    deal.dealName = deal.dealName || dealName;
    deal.clientName = clientDisplayName;
    if (cleanEmail) deal.email = cleanEmail;
    if (phone) deal.phone = phone;
    if (company) deal.company = company;
    deal.stage = 'New Lead';
    deal.pipeline = 'New Lead';
    if (validAssignedTo) deal.assignedTo = validAssignedTo;
    if (owner) deal.salesOwner = owner;
    if (contact) deal.contactId = contact._id.toString();
    if (leadType === 'meta') {
      deal.relatedMetaLead = leadId;
    } else if (leadId) {
      deal.relatedLead = leadId;
    }
    deal.createdAt = new Date();
    deal.activities.push({
      type: 'note',
      title: 'Lead moved to Pipeline Deals',
      content: `Lead updated and moved to Deals under "New Lead" stage by ${userFullName}.`,
      author: userFullName,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      createdAt: new Date()
    });
    await deal.save();
  } else {
    deal = new Deal({
      dealName,
      clientName: clientDisplayName,
      email: cleanEmail || '',
      phone,
      company,
      pipeline: 'New Lead',
      stage: 'New Lead',
      dealValue: Number(overrideData.dealValue || lead?.budget || 0) || 0,
      currency: overrideData.currency || '$',
      dealType: 'New Business',
      location: address || 'Pune, India',
      salesOwner: owner,
      assignedTo: validAssignedTo,
      createdBy: user._id,
      addedBy: overrideData.addedBy || userFullName,
      source: contactSource,
      description: notes,
      requirements: notes,
      notes,
      contactId: contact ? contact._id.toString() : null,
      relatedLead: (leadType !== 'meta' && leadId && mongoose.Types.ObjectId.isValid(leadId)) ? leadId : null,
      relatedMetaLead: (leadType === 'meta' && leadId && mongoose.Types.ObjectId.isValid(leadId)) ? leadId : null,
      activities: [{
        type: 'note',
        title: 'Lead moved to Pipeline Deals',
        content: `Moved from ${leadType === 'meta' ? 'Meta Leads' : 'Leads'} into Deals under "New Lead" stage by ${userFullName}.`,
        author: userFullName,
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        createdAt: new Date()
      }]
    });
    await deal.save();
  }

  // 3. Mark Lead / MetaLead as movedToPipeline
  const historyEntry = {
    action: 'Moved to Pipeline',
    details: `Lead moved to Pipeline Deals under "New Lead" stage by ${userFullName}`,
    by: user._id,
    date: new Date()
  };

  if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
    const updatePayload = {
      movedToPipeline: true,
      pipelineContactId: contact ? contact._id : null,
      pipelineDealId: deal ? deal._id : null,
      $push: { history: historyEntry }
    };
    if (leadType === 'meta') {
      await MetaLead.findByIdAndUpdate(leadId, updatePayload);
    } else {
      await Lead.findByIdAndUpdate(leadId, updatePayload);
    }
  }

  return { contact, deal, leadId, leadType };
}

// Move a single lead into Pipeline Deals under "New Lead" stage (Sales Head, Sales Manager, Admin OR assigned user)
router.post('/move-lead', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { isSalesHead, isSalesManager, isAdmin } = checkAccess(user);
    const hasGlobalMoveAccess = isAdmin || isSalesHead || isSalesManager;

    const {
      leadId,
      leadType = 'regular',
      firstName,
      lastName,
      email,
      countryCode,
      phone,
      origin,
      contactSource,
      company,
      address,
      notes,
      owner,
      addedBy,
      assignedTo,
      dealValue,
      currency
    } = req.body;

    const trimmedFirstName = (firstName || '').trim();
    if (!trimmedFirstName && !company) {
      return res.status(400).json({ message: 'Contact name or company is required' });
    }

    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }

    if (!hasGlobalMoveAccess) {
      const targetLead = leadType === 'meta'
        ? await MetaLead.findById(leadId)
        : await Lead.findById(leadId);

      if (!targetLead) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      const userIdStr = (user._id || user.id || '').toString();
      const isAssigned = Array.isArray(targetLead.assignedTo)
        ? targetLead.assignedTo.some(a => (a?._id || a || '').toString() === userIdStr)
        : (targetLead.assignedTo?._id || targetLead.assignedTo || '').toString() === userIdStr;
      const isCreator = (targetLead.createdBy?._id || targetLead.createdBy || '').toString() === userIdStr;

      if (!isAssigned && !isCreator) {
        return res.status(403).json({ message: 'Access denied. You can only move your assigned leads to the pipeline.' });
      }
    }

    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';

    const result = await moveSingleLeadToPipeline({
      leadId,
      leadType,
      overrideData: {
        firstName: trimmedFirstName,
        lastName,
        email,
        countryCode,
        phone,
        origin,
        contactSource,
        company,
        address,
        notes,
        owner,
        addedBy,
        assignedTo,
        dealValue,
        currency
      },
      user,
      userFullName
    });

    if (!result) {
      return res.status(400).json({ message: 'Failed to move lead to pipeline' });
    }

    // Trigger CRM socket notifications
    try {
      const io = req.app.get('socketio');
      if (result.deal) {
        sendCrmNotification(io, {
          actorUser: user,
          entityType: 'Deal',
          action: 'create',
          entityName: result.deal.dealName || result.deal.clientName || 'New Deal',
          link: '/pipeline?tab=deals'
        });
      }
      if (result.contact) {
        const contactDisplayName = `${result.contact.firstName || ''} ${result.contact.lastName || ''}`.trim() || result.contact.email || 'Lead Contact';
        sendCrmNotification(io, {
          actorUser: user,
          entityType: 'Contact',
          action: 'create',
          entityName: contactDisplayName,
          link: '/pipeline?tab=contacts'
        });
      }
    } catch (notifErr) {
      console.error('Move lead notification error:', notifErr);
    }

    res.status(200).json({
      success: true,
      message: 'Lead successfully moved to Pipeline Deals under "New Lead" stage.',
      contact: result.contact,
      deal: result.deal,
      leadId,
      leadType
    });
  } catch (error) {
    console.error('Move lead to pipeline error:', error);
    res.status(500).json({ message: 'Server error while moving lead to pipeline', error: error.message });
  }
});

// Bulk move multiple leads into Pipeline Deals under "New Lead" stage in one shot (restricted to Sales Head, Sales Manager, Admin)
router.post('/bulk-move-leads', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { isSalesHead, isSalesManager, isAdmin } = checkAccess(user);
    const hasGlobalMoveAccess = isAdmin || isSalesHead || isSalesManager;

    const { leads = [] } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: 'No leads provided to move' });
    }

    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';
    const results = [];
    const errors = [];

    for (const item of leads) {
      try {
        let leadId = null;
        let leadType = 'regular';

        if (typeof item === 'string') {
          if (item.startsWith('meta-')) {
            leadType = 'meta';
            leadId = item.replace('meta-', '');
          } else if (item.startsWith('regular-')) {
            leadType = 'regular';
            leadId = item.replace('regular-', '');
          } else {
            leadId = item;
          }
        } else if (item && typeof item === 'object') {
          leadId = item.id || item.leadId || item._id;
          leadType = item.type || item.leadType || item._type || 'regular';
          if (typeof leadId === 'string') {
            if (leadId.startsWith('meta-')) {
              leadType = 'meta';
              leadId = leadId.replace('meta-', '');
            } else if (leadId.startsWith('regular-')) {
              leadType = 'regular';
              leadId = leadId.replace('regular-', '');
            }
          }
        }

        if (!leadId || !mongoose.Types.ObjectId.isValid(leadId)) {
          continue;
        }

        if (!hasGlobalMoveAccess) {
          const targetLead = leadType === 'meta'
            ? await MetaLead.findById(leadId)
            : await Lead.findById(leadId);

          if (!targetLead) {
            errors.push({ id: leadId, reason: 'Lead not found' });
            continue;
          }

          const userIdStr = (user._id || user.id || '').toString();
          const isAssigned = Array.isArray(targetLead.assignedTo)
            ? targetLead.assignedTo.some(a => (a?._id || a || '').toString() === userIdStr)
            : (targetLead.assignedTo?._id || targetLead.assignedTo || '').toString() === userIdStr;
          const isCreator = (targetLead.createdBy?._id || targetLead.createdBy || '').toString() === userIdStr;

          if (!isAssigned && !isCreator) {
            errors.push({ id: leadId, reason: 'Access denied. You can only move your assigned leads.' });
            continue;
          }
        }

        const moveRes = await moveSingleLeadToPipeline({
          leadId,
          leadType,
          overrideData: (item && typeof item === 'object' && item.overrideData) ? item.overrideData : {},
          user,
          userFullName
        });

        if (moveRes) {
          results.push(moveRes);
        }
      } catch (itemErr) {
        console.error('Error in bulk-move-leads item:', itemErr);
        errors.push({ item, error: itemErr.message });
      }
    }

    // Trigger CRM socket notification for bulk move
    try {
      const io = req.app.get('socketio');
      await sendAdminDataActivityNotification(io, {
        actorUser: user,
        activityType: 'import',
        category: 'Pipeline',
        count: results.length,
        details: `${results.length} lead(s) moved to Pipeline Deals under "New Lead" stage`,
        link: '/pipeline?tab=deals'
      });
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Deal',
        action: 'create',
        entityName: `${results.length} Leads moved to Deals`,
        link: '/pipeline?tab=deals'
      });
    } catch (notifErr) {
      console.error('Bulk move notification error:', notifErr);
    }

    res.status(200).json({
      success: true,
      message: `Successfully moved ${results.length} lead(s) to Pipeline Deals under "New Lead" stage.`,
      count: results.length,
      results,
      errors
    });
  } catch (error) {
    console.error('Bulk move leads error:', error);
    res.status(500).json({ message: 'Server error while bulk moving leads to pipeline', error: error.message });
  }
});

// Unmove a lead from pipeline (restricted to Sales Head, Sales Manager, Admin)
router.post('/unmove-lead', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { isSalesHead, isSalesManager, isAdmin } = checkAccess(user);
    if (!isAdmin && !isSalesHead && !isSalesManager) {
      return res.status(403).json({ message: 'Access denied. Only Sales Head, Sales Manager, and Admin can unmove leads from pipeline.' });
    }

    const { leadId, leadType = 'regular', contactId } = req.body;
    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }

    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';

    // 1. Find and mark/remove contact in PipelineContact
    let contact = null;
    if (contactId && mongoose.Types.ObjectId.isValid(contactId)) {
      contact = await PipelineContact.findById(contactId);
    }
    if (!contact && leadId && mongoose.Types.ObjectId.isValid(leadId)) {
      contact = await PipelineContact.findOne({ relatedLead: leadId });
    }
    if (!contact) {
      const targetLead = leadType === 'meta' ? await MetaLead.findById(leadId) : await Lead.findById(leadId);
      if (targetLead && targetLead.email) {
        contact = await PipelineContact.findOne({ email: targetLead.email.toLowerCase().trim() });
      }
    }

    let contactDisplayName = 'Pipeline Contact';

    if (contact) {
      contactDisplayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Pipeline Contact';
      contact.isUnmoved = true;
      contact.unmovedAt = new Date();
      contact.unmovedBy = user._id;

      contact.activities.push({
        type: 'note',
        title: 'Lead Unmoved from Pipeline',
        content: `Lead was unmoved from Pipeline Deals & Contacts back to Leads by ${userFullName}.`,
        author: userFullName,
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        createdAt: new Date()
      });

      await contact.save();
    }

    // 2. Remove or clean up associated deal
    if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
      if (leadType === 'meta') {
        await Deal.deleteMany({ relatedMetaLead: leadId });
      } else {
        await Deal.deleteMany({ relatedLead: leadId });
      }
    }

    // 3. Update the lead record in Lead or MetaLead and add history tracking
    const historyEntry = {
      action: 'Unmoved from Pipeline',
      details: `Lead was unmoved from Pipeline Deals by ${userFullName}`,
      by: user._id,
      date: new Date()
    };

    if (leadType === 'meta') {
      await MetaLead.findByIdAndUpdate(leadId, {
        movedToPipeline: false,
        pipelineContactId: null,
        pipelineDealId: null,
        $push: { history: historyEntry }
      });
    } else {
      await Lead.findByIdAndUpdate(leadId, {
        movedToPipeline: false,
        pipelineContactId: null,
        pipelineDealId: null,
        $push: { history: historyEntry }
      });
    }

    // 4. Trigger CRM socket notification so pipeline board removes the deal/contact in real-time
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Deal',
        action: 'delete',
        entityName: 'Unmoved Deal',
        link: '/pipeline?tab=deals'
      });
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Contact',
        action: 'delete',
        entityName: contactDisplayName,
        link: '/pipeline?tab=contacts'
      });
    } catch (notifErr) {
      console.error('Contact/Deal notification error:', notifErr);
    }

    res.status(200).json({
      success: true,
      message: 'Lead successfully unmoved from Pipeline.',
      leadId,
      leadType,
      contactId: contact ? contact._id : null
    });
  } catch (error) {
    console.error('Unmove lead from pipeline error:', error);
    res.status(500).json({ message: 'Server error while unmoving lead from pipeline', error: error.message });
  }
});

// Create new pipeline contact (upsert by email if already exists to prevent duplicate key 500)
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
      firstName,
      lastName,
      email,
      countryCode,
      phone,
      origin,
      contactSource,
      leadStage,
      leadStatus,
      owner,
      addedBy,
      assignedTo,
      company,
      address,
      notes
    } = req.body;

    const cleanEmail = (email || '').toLowerCase().trim();
    if (!firstName || !firstName.trim()) {
      return res.status(400).json({ message: 'First name is required' });
    }

    // Reject duplicate email on contact creation
    if (cleanEmail) {
      const existingContact = await PipelineContact.findOne({ email: cleanEmail });
      if (existingContact) {
        return res.status(400).json({
          message: `A contact with email "${cleanEmail}" already exists. Duplicate email is not allowed.`
        });
      }
    }

    const validAssignedTo = (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo))
      ? assignedTo
      : (user._id || null);

    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';

    const contact = new PipelineContact({
      firstName: firstName.trim(),
      lastName: (lastName || '').trim(),
      email: cleanEmail || undefined,
      countryCode: countryCode || '+1',
      phone: phone || '',
      origin: origin || 'Domestic',
      contactSource: contactSource || 'Organic Search',
      leadStage: leadStage || 'Lead',
      leadStatus: leadStatus || 'New',
      owner: owner || userFullName,
      addedBy: addedBy || owner || userFullName,
      assignedTo: validAssignedTo,
      company: company || '',
      address: address || '',
      notes: notes || '',
      createdBy: user._id
    });

    await contact.save();

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'New Contact';
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Contact',
        action: 'create',
        entityName: contactName,
        link: '/pipeline?tab=contacts'
      });
    } catch (notifErr) {
      console.error('Contact create notification error:', notifErr);
    }

    res.status(201).json(contact);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A contact with this email already exists. Duplicate email is not allowed.' });
    }
    console.error('Create pipeline contact error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk update contacts stage
router.post('/bulk-stage', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) return res.status(401).json({ message: 'User not found' });
    const { hasUpdate } = checkAccess(user);
    if (!hasUpdate) return res.status(403).json({ message: 'Access denied. Update permission required.' });

    const { contactIds, targetStage } = req.body;
    if (!contactIds || !Array.isArray(contactIds) || !targetStage) {
      return res.status(400).json({ message: 'contactIds and targetStage are required' });
    }

    const validIds = contactIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    await PipelineContact.updateMany(
      { _id: { $in: validIds } },
      { $set: { leadStage: targetStage } }
    );
    res.json({ success: true, count: validIds.length });
  } catch (error) {
    console.error('Bulk move contact stage error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk delete contacts
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) return res.status(401).json({ message: 'User not found' });
    const { hasDelete, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasDelete) return res.status(403).json({ message: 'Access denied. Delete permission required.' });

    const { contactIds } = req.body;
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ message: 'contactIds array is required' });
    }

    const validIds = contactIds.filter(id => mongoose.Types.ObjectId.isValid(id));
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
        filter.$or.push({ owner: new RegExp(`^${userFullName}$`, 'i') });
        filter.$or.push({ addedBy: new RegExp(`^${userFullName}$`, 'i') });
      }
      if (userEmail) {
        filter.$or.push({ email: userEmail });
      }
    }

    const contactsToDelete = await PipelineContact.find(filter).select('_id email relatedLead');
    const contactIdsToDelete = contactsToDelete.map(c => c._id);
    const emailsToDelete = contactsToDelete.map(c => (c.email || '').trim().toLowerCase()).filter(Boolean);

    const result = await PipelineContact.deleteMany({ _id: { $in: contactIdsToDelete } });

    // Clean up related leads if any
    const leadIds = contactsToDelete.map(c => c.relatedLead).filter(Boolean);
    if (leadIds.length > 0) {
      await Lead.updateMany(
        { _id: { $in: leadIds } },
        { $set: { movedToPipeline: false, pipelineContactId: null } }
      ).catch(() => {});
      await MetaLead.updateMany(
        { _id: { $in: leadIds } },
        { $set: { movedToPipeline: false, pipelineContactId: null } }
      ).catch(() => {});
    }

    // Also delete any associated deals if linked by contactId
    await Deal.deleteMany({
      $or: [
        { contactId: { $in: contactIdsToDelete.map(String) } },
        { associatedContactId: { $in: contactIdsToDelete.map(String) } },
        ...(emailsToDelete.length > 0 ? [{ email: { $in: emailsToDelete } }] : [])
      ]
    }).catch(() => {});

    res.json({ success: true, count: result.deletedCount });
  } catch (error) {
    console.error('Bulk delete contacts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update pipeline contact
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

    const contact = await PipelineContact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (!isContactOwnedByUser(contact, user, hasFullAccess, isAdmin)) {
      return res.status(403).json({ message: 'Access denied. You can only update your own contacts.' });
    }

    const {
      firstName,
      lastName,
      email,
      countryCode,
      phone,
      origin,
      contactSource,
      leadStage,
      leadStatus,
      owner,
      addedBy,
      assignedTo,
      company,
      address,
      notes
    } = req.body;

    if (firstName) contact.firstName = firstName.trim();
    if (lastName !== undefined) contact.lastName = (lastName || '').trim();
    if (email !== undefined) {
      const cleanEmail = (email || '').toLowerCase().trim();
      if (cleanEmail) {
        const existingContact = await PipelineContact.findOne({
          email: cleanEmail,
          _id: { $ne: req.params.id }
        });
        if (existingContact) {
          return res.status(400).json({
            message: `A contact with email "${cleanEmail}" already exists. Duplicate email is not allowed.`
          });
        }
        contact.email = cleanEmail;
      } else {
        contact.email = undefined;
      }
    }
    if (countryCode !== undefined) contact.countryCode = countryCode;
    if (phone !== undefined) contact.phone = phone;
    if (origin !== undefined) contact.origin = origin || 'Domestic';
    if (contactSource !== undefined) contact.contactSource = contactSource;
    if (leadStage !== undefined) contact.leadStage = leadStage;
    if (leadStatus !== undefined) contact.leadStatus = leadStatus;
    if (owner !== undefined) contact.owner = owner;
    if (addedBy !== undefined) contact.addedBy = addedBy;
    if (assignedTo !== undefined) {
      contact.assignedTo = (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) ? assignedTo : null;
    }
    if (company !== undefined) contact.company = company;
    if (address !== undefined) contact.address = address;
    if (notes !== undefined) contact.notes = notes;

    await contact.save();

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Contact';
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Contact',
        action: 'update',
        entityName: contactName,
        link: '/pipeline?tab=contacts'
      });
    } catch (notifErr) {
      console.error('Contact update notification error:', notifErr);
    }

    res.json(contact);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A contact with this email already exists. Duplicate email is not allowed.' });
    }
    console.error('Update pipeline contact error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete pipeline contact
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

    const contact = await PipelineContact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (!isContactOwnedByUser(contact, user, hasFullAccess, isAdmin)) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own contacts.' });
    }

    const deletedContactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Contact';
    await PipelineContact.findByIdAndDelete(req.params.id);

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Contact',
        action: 'delete',
        entityName: deletedContactName,
        link: '/pipeline?tab=contacts'
      });
    } catch (notifErr) {
      console.error('Contact delete notification error:', notifErr);
    }

    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete pipeline contact error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add activity log to contact
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

    const contact = await PipelineContact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (!isContactOwnedByUser(contact, user, hasFullAccess, isAdmin)) {
      return res.status(403).json({ message: 'Access denied. You can only add activities to your own contacts.' });
    }

    const { type, title, content, remarks, channel, status, followUpDate, followUpTime, nextFollowUpDate, author, authorRole, time, date } = req.body;
    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';
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
      author: author || userFullName,
      authorRole: authorRole || (user?.role?.name || user?.role || ''),
      createdBy: user._id,
      reminderSent: false,
      time: time || 'Just now',
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: new Date()
    };

    contact.activities.unshift(newActivity);
    await contact.save();

    if (newActivity.type === 'followup') {
      notifyFollowUpScheduled(req.app.get('socketio'), {
        entity: contact,
        activity: newActivity,
        creatorUser: user,
        isContact: true
      }).catch(err => console.error('notifyFollowUpScheduled contact error:', err));
    }

    res.status(201).json(newActivity);
  } catch (error) {
    console.error('Add contact activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update contact activity (e.g. status or remarks)
router.patch('/:id/activities/:activityId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const contact = await PipelineContact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const actId = req.params.activityId;
    const activity = contact.activities.find(a => (a._id && a._id.toString() === actId) || a.id === actId);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    const { status, remarks, content, followUpDate, followUpTime, nextFollowUpDate, title, channel } = req.body;

    const { hasFullAccess, isAdmin } = checkAccess(user);
    const isCreator = (activity.createdBy && activity.createdBy.toString() === user._id.toString()) ||
      (activity.author && activity.author.toLowerCase() === `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase());

    // User can only edit if creator or admin/sales head
    if (!isCreator && !isAdmin && !hasFullAccess) {
      return res.status(403).json({ message: 'Access denied. You can only edit follow-ups you created.' });
    }

    // Time check: if scheduled time has already passed, editing schedule is not allowed
    if (activity.type === 'followup' && !isAdmin && !hasFullAccess) {
      const scheduledTime = parseFollowUpDateTime(activity.followUpDate, activity.followUpTime);
      if (scheduledTime && scheduledTime.getTime() <= Date.now()) {
        const onlyStatusChange = status !== undefined && remarks === undefined && followUpDate === undefined && followUpTime === undefined && title === undefined && channel === undefined;
        if (!onlyStatusChange) {
          return res.status(400).json({ message: 'Cannot edit this follow-up because its scheduled time has already passed.' });
        }
      }
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

    if (rescheduled || (status && status !== 'Completed' && status !== 'Missed')) {
      activity.reminderSent = false;
      activity.reminderSentAt = null;
    }

    await contact.save();

    if (rescheduled && activity.type === 'followup') {
      notifyFollowUpScheduled(req.app.get('socketio'), {
        entity: contact,
        activity,
        creatorUser: user,
        isContact: true
      }).catch(err => console.error('notifyFollowUpScheduled contact reschedule error:', err));
    }

    res.json(activity);
  } catch (error) {
    console.error('Update contact activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete contact activity
router.delete('/:id/activities/:activityId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const contact = await PipelineContact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    const actId = req.params.activityId;
    const activity = (contact.activities || []).find(a => (a._id && a._id.toString() === actId) || a.id === actId);
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

    contact.activities = (contact.activities || []).filter(a => !(a._id && a._id.toString() === actId) && a.id !== actId);
    await contact.save();
    res.json({ message: 'Activity deleted successfully' });
  } catch (error) {
    console.error('Delete contact activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Notify admin when user exports pipeline data (Deals, Contacts, Companies, Tasks)
router.post('/export-notify', auth, async (req, res) => {
  try {
    const { category = 'Pipeline', count = 0, details = '' } = req.body;
    const io = req.app.get('socketio');
    const tab = (category || 'deals').toLowerCase();
    const link = `/pipeline?tab=${tab}`;
    await sendAdminDataActivityNotification(io, {
      actorUser: req.user,
      activityType: 'export',
      category,
      count: parseInt(count, 10) || 0,
      details,
      link
    });
    res.status(200).json({ success: true, message: `Admin notified of ${category} export` });
  } catch (error) {
    console.error('Pipeline export notification error:', error);
    res.status(500).json({ message: 'Error notifying admin', error: error.message });
  }
});

module.exports = router;
