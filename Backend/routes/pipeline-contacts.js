const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PipelineContact = require('../models/PipelineContact');
const Lead = require('../models/Lead');
const MetaLead = require('../models/MetaLead');
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
  const hasRead = hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'contacts' || p.module === 'deals' || p.module === 'leads') && p.actions.includes('read'));
  const hasCreate = isAdmin || permissions.some(p => (p.module === 'pipeline' || p.module === 'contacts' || p.module === 'deals' || p.module === 'leads') && p.actions.includes('create'));
  const hasUpdate = isAdmin || permissions.some(p => (p.module === 'pipeline' || p.module === 'contacts' || p.module === 'deals' || p.module === 'leads') && p.actions.includes('update'));
  const hasDelete = isAdmin || permissions.some(p => (p.module === 'pipeline' || p.module === 'contacts' || p.module === 'deals' || p.module === 'leads') && p.actions.includes('delete'));

  return { roleName, isSalesHead, isAdmin, hasFullAccess, hasRead, hasCreate, hasUpdate, hasDelete };
}

// Helper to check if a specific contact is accessible to a user
function isContactOwnedByUser(contact, user, hasFullAccess) {
  if (hasFullAccess) return true;
  if (!contact || !user) return false;

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

// Get all pipeline contacts
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
    if (req.query.includeUnmoved !== 'true') {
      query.isUnmoved = { $ne: true };
    }

    // Data isolation: Sales Head and Admin see all contacts; other roles only see their data
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

    res.json(contacts || []);
  } catch (error) {
    console.error('Get pipeline contacts error:', error);
    try {
      // Fallback without populate if population schema has any issue
      const unpopulated = await PipelineContact.find(query).sort({ createdAt: -1 });
      return res.json(unpopulated || []);
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

    const { hasRead, hasFullAccess } = checkAccess(user);
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
    if (!isContactOwnedByUser(contact, user, hasFullAccess)) {
      return res.status(403).json({ message: 'Access denied. You can only view your own contacts.' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Move a lead (regular or meta) into pipeline contacts under "Meta Lead" stage
router.post('/move-lead', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasRead, hasFullAccess } = checkAccess(user);
    if (!hasRead && !hasFullAccess) {
      return res.status(403).json({ message: 'Access denied. You do not have permission to move leads.' });
    }

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
      leadStage = 'Meta Lead',
      leadStatus = 'New',
      company,
      address,
      notes,
      owner,
      addedBy,
      assignedTo
    } = req.body;

    const trimmedFirstName = (firstName || '').trim();
    if (!trimmedFirstName) {
      return res.status(400).json({ message: 'Contact name is required' });
    }

    const cleanEmail = (email || '').toLowerCase().trim();
    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';

    let contact = null;

    // Check if a contact already exists with this email or relatedLead
    if (cleanEmail) {
      contact = await PipelineContact.findOne({ email: cleanEmail });
    }
    if (!contact && leadId && mongoose.Types.ObjectId.isValid(leadId)) {
      contact = await PipelineContact.findOne({ relatedLead: leadId });
    }

    const targetStage = (leadStage || 'Meta Lead').trim();
    const validAssignedTo = (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo))
      ? assignedTo
      : null;

    if (contact) {
      // Update existing contact and ensure stage is targetStage
      contact.leadStage = targetStage;
      contact.firstName = trimmedFirstName;
      if (lastName !== undefined) contact.lastName = (lastName || '').trim();
      if (phone !== undefined) contact.phone = (phone || '').trim();
      if (countryCode !== undefined) contact.countryCode = countryCode || '+1';
      if (origin !== undefined) contact.origin = origin || 'Domestic';
      if (contactSource) contact.contactSource = contactSource;
      if (leadStatus) contact.leadStatus = leadStatus;
      if (company !== undefined) contact.company = company || '';
      if (address !== undefined) contact.address = address || '';
      if (notes) {
        contact.notes = contact.notes ? `${contact.notes}\n${notes}` : notes;
      }
      if (owner) contact.owner = owner;
      if (addedBy) contact.addedBy = addedBy;
      if (validAssignedTo) contact.assignedTo = validAssignedTo;
      if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
        contact.relatedLead = leadId;
      }
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
        firstName: trimmedFirstName,
        lastName: (lastName || '').trim(),
        email: cleanEmail || undefined,
        countryCode: countryCode || '+1',
        phone: (phone || '').trim(),
        origin: origin || 'Domestic',
        contactSource: contactSource || (leadType === 'meta' ? 'Meta' : 'Manual'),
        leadStage: targetStage,
        leadStatus: leadStatus || 'New',
        owner: owner || userFullName,
        addedBy: addedBy || userFullName,
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

    // Mark lead record as movedToPipeline and push to history
    const historyEntry = {
      action: 'Moved to Pipeline',
      details: `Lead moved to Pipeline Contacts under "${targetStage}" stage by ${userFullName}`,
      by: user._id,
      date: new Date()
    };

    if (leadId && mongoose.Types.ObjectId.isValid(leadId)) {
      if (leadType === 'meta') {
        await MetaLead.findByIdAndUpdate(leadId, {
          movedToPipeline: true,
          pipelineContactId: contact._id,
          $push: { history: historyEntry }
        });
      } else {
        await Lead.findByIdAndUpdate(leadId, {
          movedToPipeline: true,
          pipelineContactId: contact._id,
          $push: { history: historyEntry }
        });
      }
    }

    // Trigger CRM socket notification
    try {
      const io = req.app.get('socketio');
      const contactDisplayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Lead Contact';
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Contact',
        action: 'create',
        entityName: contactDisplayName,
        link: '/pipeline?tab=contacts'
      });
    } catch (notifErr) {
      console.error('Contact notification error:', notifErr);
    }

    res.status(200).json({
      success: true,
      message: `Lead successfully moved to Pipeline under "${targetStage}" stage.`,
      contact,
      leadId,
      leadType
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A contact with this email already exists in pipeline.' });
    }
    console.error('Move lead to pipeline error:', error);
    res.status(500).json({ message: 'Server error while moving lead to pipeline', error: error.message });
  }
});

// Unmove a lead from pipeline contacts
router.post('/unmove-lead', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasRead, hasFullAccess } = checkAccess(user);
    if (!hasRead && !hasFullAccess) {
      return res.status(403).json({ message: 'Access denied. You do not have permission to unmove leads.' });
    }

    const { leadId, leadType = 'regular', contactId } = req.body;
    if (!leadId) {
      return res.status(400).json({ message: 'Lead ID is required' });
    }

    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';

    // 1. Find the contact in PipelineContact
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

    // 2. If contact found, mark as unmoved and track activity
    if (contact) {
      contactDisplayName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Pipeline Contact';
      contact.isUnmoved = true;
      contact.unmovedAt = new Date();
      contact.unmovedBy = user._id;

      contact.activities.push({
        type: 'note',
        title: 'Lead Unmoved from Pipeline',
        content: `Lead was unmoved from Pipeline Contacts back to Leads by ${userFullName}.`,
        author: userFullName,
        time: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        createdAt: new Date()
      });

      await contact.save();
    }

    // 3. Update the lead record in Lead or MetaLead and add history tracking
    const historyEntry = {
      action: 'Unmoved from Pipeline',
      details: `Lead was unmoved from Pipeline Contacts (Meta Lead stage) by ${userFullName}`,
      by: user._id,
      date: new Date()
    };

    if (leadType === 'meta') {
      await MetaLead.findByIdAndUpdate(leadId, {
        movedToPipeline: false,
        pipelineContactId: null,
        $push: { history: historyEntry }
      });
    } else {
      await Lead.findByIdAndUpdate(leadId, {
        movedToPipeline: false,
        pipelineContactId: null,
        $push: { history: historyEntry }
      });
    }

    // 4. Trigger CRM socket notification so pipeline board removes the contact in real-time
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Contact',
        action: 'delete',
        entityName: contactDisplayName,
        link: '/pipeline?tab=contacts'
      });
    } catch (notifErr) {
      console.error('Contact notification error:', notifErr);
    }

    res.status(200).json({
      success: true,
      message: 'Lead successfully unmoved from Pipeline Contacts.',
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

// Update pipeline contact
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

    const contact = await PipelineContact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (!isContactOwnedByUser(contact, user, hasFullAccess)) {
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

    const { hasDelete, hasFullAccess } = checkAccess(user);
    if (!hasDelete) {
      return res.status(403).json({ message: 'Access denied. Delete permission required.' });
    }

    const contact = await PipelineContact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (!isContactOwnedByUser(contact, user, hasFullAccess)) {
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

    const { hasUpdate, hasFullAccess } = checkAccess(user);
    if (!hasUpdate) {
      return res.status(403).json({ message: 'Access denied. Update permission required.' });
    }

    const contact = await PipelineContact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    if (!isContactOwnedByUser(contact, user, hasFullAccess)) {
      return res.status(403).json({ message: 'Access denied. You can only add activities to your own contacts.' });
    }

    const { type, title, content, author, time, date } = req.body;
    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';
    const newActivity = {
      type: type || 'note',
      title: title || '',
      content: content || '',
      author: author || userFullName,
      time: time || 'Just now',
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: new Date()
    };

    contact.activities.unshift(newActivity);
    await contact.save();

    res.status(201).json(newActivity);
  } catch (error) {
    console.error('Add contact activity error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
