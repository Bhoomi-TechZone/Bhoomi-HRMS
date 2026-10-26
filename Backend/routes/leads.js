const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const MetaLead = require('../models/MetaLead');
const WebsiteLead = require('../models/WebsiteLead');
const Deal = require('../models/Deal');
const Client = require('../models/Client');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const { sendAdminDataActivityNotification } = require('../utils/crmNotifier');

// Cutoff timestamp: old leads (before this cutoff) are strictly visible ONLY to Admin.
// Sales Head and other roles only see new leads added from this cutoff onwards.
const DATA_CUTOFF_DATE = new Date(process.env.CRM_DATA_CUTOFF_DATE || '2026-10-17T00:00:00+05:30');

// Helper to evaluate lead permissions
// Only Sales Head, Sales Manager, and Admin have organization-wide full access in their timeframe.
// Only Admin can see old data as well as new data.
function getLeadRoleAccess(user) {
  const roleObj = user?.role;
  const roleName = (typeof roleObj === 'object' && roleObj !== null ? roleObj.name : roleObj || user?.roleName || '').toString().toLowerCase().trim();
  const roleNormalized = roleName.replace(/\s+/g, ' ');
  const designation = (user?.designation || '').toString().toLowerCase().trim();
  const department = (user?.department || '').toString().toLowerCase().trim();
  const email = (user?.email || '').toString().toLowerCase().trim();

  const isSalesHead =
    roleNormalized.includes('sales head') ||
    roleNormalized === 'saleshead' ||
    roleNormalized === 'head of sales' ||
    designation.includes('sales head') ||
    designation === 'saleshead' ||
    designation === 'head of sales';

  const isSalesManager =
    roleNormalized.includes('sales manager') ||
    roleNormalized.includes('salesmanager') ||
    roleNormalized === 'manager of sales' ||
    designation.includes('sales manager') ||
    designation.includes('salesmanager') ||
    designation === 'manager of sales';

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
  const canAssignOrManage = hasFullAccess;

  return { hasFullAccess, canAssignOrManage, isSalesHead, isSalesManager, isAdmin, roleName, roleNormalized };
}

// Get all leads
router.get('/', auth, async (req, res) => {
  try {
    const user = (req.user?.role?.name) ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');

    let query = {};

    const { hasFullAccess, canAssignOrManage, isAdmin, roleName } = getLeadRoleAccess(user);

    // Check if user has read permission
    const hasReadPermission = hasFullAccess ||
      roleName.includes('sales') ||
      roleName.includes('executive') ||
      (user?.role?.permissions && user.role.permissions.some(
        p => p.module === 'leads' && p.actions.includes('read')
      ));

    // If user doesn't have read permission, deny access
    if (!hasReadPermission) {
      return res.status(403).json({ message: 'Access denied. Read permission required.' });
    }

    // Only Admin can see old leads. Sales Head, Sales Manager, and other roles only see new data.
    if (!isAdmin) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { createdAt: { $gte: DATA_CUTOFF_DATE } },
          { addedOn: { $gte: DATA_CUTOFF_DATE } }
        ]
      });
    }

    // Non-full-access roles only see their own assigned or created leads
    if (!hasFullAccess) {
      const currentUserId = req.user?._id || req.user?.id;
      query.$or = [
        { assignedTo: currentUserId },
        { createdBy: currentUserId }
      ];
    }

    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    // Filter by source if provided
    if (req.query.source) {
      query.source = req.query.source;
    }

    // Exclude leads moved to pipeline by default so they only appear in Deals in Pipeline
    if (req.query.includeMoved !== 'true') {
      query.movedToPipeline = { $ne: true };
    }

    const leads = await Lead.find(query)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .populate('history.by', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    res.json(leads);
  } catch (error) {
    console.error('Get leads error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single lead by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = (req.user?.role?.name) ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .populate('history.by', 'firstName lastName');

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const { hasFullAccess, isAdmin } = getLeadRoleAccess(user);

    // Old leads are strictly visible only to Admin
    if (!isAdmin) {
      const leadDate = new Date(lead.createdAt || lead.addedOn || 0);
      if (leadDate < DATA_CUTOFF_DATE) {
        return res.status(403).json({ message: 'Access denied. Old leads are only accessible by Admin.' });
      }
    }

    // Sales and regular employees can only view their assigned leads or leads they created/added
    const isOwnerOrAssignee = (lead.assignedTo?._id?.toString() || lead.assignedTo?.toString() || '') === req.user.id ||
      (lead.createdBy?._id?.toString() || lead.createdBy?.toString() || '') === req.user.id;
    if (!hasFullAccess && !isOwnerOrAssignee) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(lead);
  } catch (error) {
    console.error('Get lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new lead
router.post('/', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      company,
      country,
      industry,
      source,
      assignedTo,
      budget,
      requirements,
      notes,
      nextFollowUp,
      followUpNotes,
      leadType
    } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !source) {
      return res.status(400).json({ message: 'Missing required fields: name, email, phone, source' });
    }

    // Validate assigned user and assignment permissions
    let finalAssignedTo = null;
    if (assignedTo) {
      const creator = (req.user?.role?.name) ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');
      const { canAssignOrManage: canAssign } = getLeadRoleAccess(creator);

      if (canAssign) {
        const assignedUser = await User.findById(assignedTo);
        if (!assignedUser) {
          return res.status(400).json({ message: 'Assigned user not found' });
        }
        finalAssignedTo = assignedTo;
      }
    }

    // Prepare lead data
    const leadData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      company: company ? company.trim() : '',
      country: country ? country.trim() : '',
      industry: industry ? industry.trim() : '',
      source,
      assignedTo: finalAssignedTo,
      budget: budget ? parseFloat(budget) : 0,
      requirements: requirements ? requirements.trim() : '',
      notes: notes ? notes.trim() : '',
      followUpNotes: followUpNotes ? followUpNotes.trim() : '',
      createdBy: req.user.id,
      status: 'New',
      leadType: leadType || null,
      history: [{
        action: 'Lead Created',
        details: 'Lead added manually to CRM',
        by: req.user.id,
        date: new Date()
      }]
    };

    // Handle nextFollowUp date - convert from string if provided
    if (nextFollowUp && nextFollowUp.trim()) {
      leadData.nextFollowUp = new Date(nextFollowUp);
    } else {
      leadData.nextFollowUp = null;
    }

    const lead = new Lead(leadData);
    await lead.save();

    const populatedLead = await Lead.findById(lead._id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .populate('history.by', 'firstName lastName');

    res.status(201).json(populatedLead);
  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clean and normalize any phone input from spreadsheet or database
function cleanPhoneNumber(val) {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  if (!str) return '';

  // 1. Handle scientific notation (e.g. 8.21888E+09 or 9.18218880283e+11)
  if (/^[0-9.]+[eE][+-]?[0-9]+$/.test(str)) {
    try {
      str = BigInt(Math.floor(Number(str))).toString();
    } catch (e) {
      str = Number(str).toFixed(0);
    }
  }

  // 2. Remove trailing .0 from Excel float numbers (e.g. 8218880283.0 -> 8218880283)
  if (str.endsWith('.0')) {
    str = str.slice(0, -2);
  }

  // 3. Remove all non-digit characters
  return str.replace(/\D/g, '');
}

// Helper to identify dummy or placeholder phone numbers that should never be used for deduplication
function isDummyPhoneNumber(digits) {
  if (!digits || digits.length < 7) return true;
  if (/^(\d)\1+$/.test(digits)) return true; // 0000000, 9999999999, etc.
  if (['1234567', '12345678', '123456789', '1234567890', '9876543210', '0123456789'].includes(digits)) return true;
  return false;
}

// Helper to extract core phone digits (specifically for Indian 10-digit mobile numbers with 0 or 91 prefix)
function extractCorePhoneDigits(val) {
  const digits = cleanPhoneNumber(val);
  if (!digits || isDummyPhoneNumber(digits)) return '';
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

// Check duplicate phone numbers against all CRM databases (Lead, MetaLead, WebsiteLead)
router.post('/check-duplicates', auth, async (req, res) => {
  try {
    const { phones } = req.body;
    if (!Array.isArray(phones) || phones.length === 0) {
      return res.json({ duplicates: {} });
    }

    const existingPhoneSet = new Set();
    const existingPhoneDetails = new Map();

    const [existingLeads, existingMetaLeads, existingWebsiteLeads] = await Promise.all([
      Lead.find({ phone: { $exists: true, $ne: '' } }).select('name phone company email').lean(),
      MetaLead.find({ phone: { $exists: true, $ne: '' } }).select('name phone').lean(),
      WebsiteLead.find({ phone: { $exists: true, $ne: '' } }).select('name phone').lean()
    ]);

    const indexRecord = (rec) => {
      if (!rec || !rec.phone) return;
      const digits = cleanPhoneNumber(rec.phone);
      if (isDummyPhoneNumber(digits)) return;
      const core = extractCorePhoneDigits(rec.phone);
      const label = rec.name || rec.company || 'Existing Lead';

      if (digits && digits.length >= 7) {
        existingPhoneSet.add(digits);
        if (!existingPhoneDetails.has(digits)) existingPhoneDetails.set(digits, label);
      }
      if (core && core.length >= 7) {
        existingPhoneSet.add(core);
        if (!existingPhoneDetails.has(core)) existingPhoneDetails.set(core, label);
      }
    };

    (existingLeads || []).forEach(indexRecord);
    (existingMetaLeads || []).forEach(indexRecord);
    (existingWebsiteLeads || []).forEach(indexRecord);

    const duplicates = {};
    phones.forEach(p => {
      const raw = String(p || '').trim();
      const digits = cleanPhoneNumber(raw);
      if (!digits || isDummyPhoneNumber(digits)) return;
      const core = extractCorePhoneDigits(raw);

      if (existingPhoneSet.has(digits) || (core && existingPhoneSet.has(core))) {
        duplicates[raw] = existingPhoneDetails.get(core) || existingPhoneDetails.get(digits) || 'Existing Lead';
      }
    });

    res.json({ duplicates });
  } catch (err) {
    console.error('Check duplicates error:', err);
    res.status(500).json({ message: 'Error checking duplicates', error: err.message });
  }
});

// Bulk import leads from Excel/CSV upload with professional duplicate prevention
router.post('/bulk-import', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const { leads: leadsData, skipDuplicates = true } = req.body;
    if (!Array.isArray(leadsData) || leadsData.length === 0) {
      return res.status(400).json({ message: 'No leads data provided' });
    }

    // ── 1. Query all existing phone numbers in CRM database for exhaustive duplicate prevention ────
    const existingPhoneSet = new Set();
    const existingPhoneDetails = new Map();

    if (skipDuplicates) {
      const [existingLeads, existingMetaLeads, existingWebsiteLeads] = await Promise.all([
        Lead.find({ phone: { $exists: true, $ne: '' } }).select('name phone company email').lean(),
        MetaLead.find({ phone: { $exists: true, $ne: '' } }).select('name phone').lean(),
        WebsiteLead.find({ phone: { $exists: true, $ne: '' } }).select('name phone').lean()
      ]);

      const indexRecord = (rec) => {
        if (!rec || !rec.phone) return;
        const digits = cleanPhoneNumber(rec.phone);
        if (isDummyPhoneNumber(digits)) return;
        const core = extractCorePhoneDigits(rec.phone);
        const label = rec.name || rec.company || 'Existing Lead';

        if (digits && digits.length >= 7) {
          existingPhoneSet.add(digits);
          if (!existingPhoneDetails.has(digits)) {
            existingPhoneDetails.set(digits, label);
          }
        }
        if (core && core.length >= 7) {
          existingPhoneSet.add(core);
          if (!existingPhoneDetails.has(core)) {
            existingPhoneDetails.set(core, label);
          }
        }
      };

      (existingLeads || []).forEach(indexRecord);
      (existingMetaLeads || []).forEach(indexRecord);
      (existingWebsiteLeads || []).forEach(indexRecord);
    }

    const created = [];
    const duplicates = [];
    const errors = [];
    const seenInBatch = new Set();

    // ── 2. Process each lead record ──────────────────────────────────────────
    for (let i = 0; i < leadsData.length; i++) {
      const row = leadsData[i];
      const rowNum = i + 1;

      try {
        const rawPhone = row.phone !== undefined && row.phone !== null ? String(row.phone).trim() : '';
        const digits = cleanPhoneNumber(rawPhone);
        const corePhone = extractCorePhoneDigits(rawPhone);

        // Phone is STRICTLY REQUIRED (must have at least 7 valid digits)
        if (!rawPhone || !digits || digits.length < 7) {
          errors.push({
            row: rowNum,
            phone: rawPhone || '—',
            name: row.name || '—',
            reason: 'Phone number is required and must contain at least 7 digits'
          });
          continue;
        }

        // Duplicate Check 1: Duplicate within the uploaded file batch
        if (seenInBatch.has(digits) || (corePhone && seenInBatch.has(corePhone))) {
          duplicates.push({
            row: rowNum,
            phone: rawPhone,
            name: row.name || '—',
            reason: `Duplicate phone: "${rawPhone}" already appears earlier in this uploaded file`
          });
          continue;
        }

        // Duplicate Check 2: Already exists anywhere in CRM database (when skipDuplicates is true)
        if (skipDuplicates && (existingPhoneSet.has(digits) || (corePhone && existingPhoneSet.has(corePhone)))) {
          const matchedName = (corePhone && existingPhoneDetails.get(corePhone)) || existingPhoneDetails.get(digits) || 'Existing Lead';
          duplicates.push({
            row: rowNum,
            phone: rawPhone,
            name: row.name || '—',
            reason: `Duplicate lead: phone "${rawPhone}" already exists in CRM (${matchedName})`
          });
          continue;
        }

        // Mark as seen in this import batch
        seenInBatch.add(digits);
        if (corePhone) seenInBatch.add(corePhone);

        // Client Name is OPTIONAL: clean it up, or fall back to company or empty string
        const clientName = (row.name && String(row.name).trim() !== '—')
          ? String(row.name).trim()
          : (row.company ? String(row.company).trim() : '');

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

        // Clean phone representation for storage (remove trailing .0 or scientific notation)
        let phoneToSave = rawPhone;
        if (/^[0-9.]+[eE][+-]?[0-9]+$/.test(rawPhone) || rawPhone.endsWith('.0')) {
          phoneToSave = digits;
        }

        // Parse date safely (supports DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, ISO, and standard dates)
        let parsedDate = new Date();
        if (row.date) {
          const rawDateStr = String(row.date).trim();
          const dmyMatch = rawDateStr.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
          if (dmyMatch) {
            const day = parseInt(dmyMatch[1], 10);
            const month = parseInt(dmyMatch[2], 10) - 1;
            const year = parseInt(dmyMatch[3], 10);
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) parsedDate = d;
          } else {
            const d = new Date(rawDateStr);
            if (!isNaN(d.getTime())) parsedDate = d;
          }
        }

        // Parse budget safely (strip currency symbols and commas, prevent NaN)
        let parsedBudget = 0;
        if (row.budget !== undefined && row.budget !== null && row.budget !== '') {
          const cleanBudget = String(row.budget).replace(/[^0-9.-]/g, '');
          const val = parseFloat(cleanBudget);
          if (!isNaN(val)) parsedBudget = val;
        }

        const leadData = {
          name: clientName,
          email: row.email ? String(row.email).toLowerCase().trim() : '',
          phone: phoneToSave,
          company: row.company ? String(row.company).trim() : '',
          country: row.country ? String(row.country).trim() : '',
          industry: row.industry ? String(row.industry).trim() : '',
          date: parsedDate,
          addedOn: new Date(),
          source: row.source || 'Excel Import',
          leadType: normalizedLeadType,
          requirement: row.requirement ? String(row.requirement).trim() : '',
          requirements: row.requirements ? String(row.requirements).trim() : (row.requirement ? String(row.requirement).trim() : ''),
          notes: row.notes ? String(row.notes).trim() : '',
          budget: parsedBudget,
          status: 'New',
          createdBy: req.user.id,
          history: [{
            action: 'Lead Imported',
            details: 'Lead imported via spreadsheet upload (Deduplicated)',
            by: req.user.id,
            date: new Date()
          }]
        };

        if (row.assignedTo) {
          const assignedUser = await User.findById(row.assignedTo);
          if (assignedUser) leadData.assignedTo = row.assignedTo;
        }

        const lead = new Lead(leadData);
        await lead.save();
        created.push(lead._id);

        // Keep local cache updated for subsequent rows
        existingPhoneSet.add(digits);
        if (corePhone) existingPhoneSet.add(corePhone);
        if (corePhone) existingPhoneDetails.set(corePhone, clientName || 'Imported Lead');
      } catch (err) {
        console.error(`Bulk import row ${rowNum} save error:`, err.message);
        errors.push({ row: rowNum, reason: err.message });
      }
    }

    const message = created.length > 0
      ? `Successfully imported ${created.length} new lead${created.length > 1 ? 's' : ''}.${duplicates.length > 0 ? ` ${duplicates.length} duplicate lead${duplicates.length > 1 ? 's were' : ' was'} safely skipped.` : ''}`
      : `No new leads imported. ${duplicates.length > 0 ? `${duplicates.length} duplicate lead(s) were skipped.` : 'Please verify your file.'}`;

    // Notify all admins about lead import
    if (created.length > 0) {
      try {
        const io = req.app.get('socketio');
        await sendAdminDataActivityNotification(io, {
          actorUser: req.user,
          activityType: 'import',
          category: 'Leads',
          count: created.length,
          details: duplicates.length > 0 ? `${duplicates.length} duplicate(s) skipped` : '',
          link: '/leads'
        });
      } catch (notifErr) {
        console.error('Lead import admin notification error:', notifErr);
      }
    }

    res.status(200).json({
      success: true,
      imported: created.length,
      duplicatesCount: duplicates.length,
      errorsCount: errors.length,
      totalProcessed: leadsData.length,
      duplicates,
      errors,
      message
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Notify admin when user exports leads
router.post('/export-notify', auth, async (req, res) => {
  try {
    const { count = 0, details = '' } = req.body;
    const io = req.app.get('socketio');
    await sendAdminDataActivityNotification(io, {
      actorUser: req.user,
      activityType: 'export',
      category: 'Leads',
      count: parseInt(count, 10) || 0,
      details,
      link: '/leads'
    });
    res.status(200).json({ success: true, message: 'Admin notified of lead export' });
  } catch (error) {
    console.error('Lead export notification error:', error);
    res.status(500).json({ message: 'Error notifying admin', error: error.message });
  }
});

// Update lead
router.put('/:id', auth, async (req, res) => {
  try {
    const user = (req.user?.role?.name) ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Check permissions
    const hasUpdatePermission = user.role?.permissions ? user.role.permissions.some(
      p => p.module === 'leads' && p.actions.includes('update')
    ) : false;
    const hasReadPermission = user.role?.permissions ? user.role.permissions.some(
      p => p.module === 'leads' && p.actions.includes('read')
    ) : false;
    const { hasFullAccess, canAssignOrManage, isAdmin } = getLeadRoleAccess(user);

    // Old leads can only be updated by Admin
    if (!isAdmin) {
      const leadDate = new Date(lead.createdAt || lead.addedOn || 0);
      if (leadDate < DATA_CUTOFF_DATE) {
        return res.status(403).json({ message: 'Access denied. Old leads are only managed by Admin.' });
      }
    }

    const isOwnerOrAssignee = (lead.assignedTo?._id?.toString() || lead.assignedTo?.toString() || '') === req.user.id ||
      (lead.createdBy?._id?.toString() || lead.createdBy?.toString() || '') === req.user.id;

    if (!hasFullAccess && !isOwnerOrAssignee) {
      return res.status(403).json({ message: 'Access denied. You can only update your assigned or created leads.' });
    }

    // For read-only users without assignment/update permission, restrict updates to status/followup/type/notes only
    if (!hasUpdatePermission && !canAssignOrManage) {
      if (!hasReadPermission) {
        return res.status(403).json({ message: 'Access denied' });
      }
      // Restrict the update to status + nextFollowUp + leadType + notes/newNote only
      const { status, nextFollowUp, leadType, newNote, notes } = req.body;
      if (!status && leadType === undefined && !newNote && notes === undefined) {
        return res.status(403).json({ message: 'Read-only users can only update lead status, type, or notes' });
      }

      if (newNote && String(newNote).trim()) {
        const authorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';
        const now = new Date();
        const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const formattedEntry = `[${timeStr} - ${authorName}]: ${String(newNote).trim()}`;
        lead.notes = lead.notes ? `${lead.notes}\n\n${formattedEntry}` : formattedEntry;
        lead.history.push({
          action: 'Note Added',
          details: String(newNote).trim(),
          by: req.user.id,
          date: now
        });
      } else if (notes !== undefined) {
        lead.notes = notes ? String(notes).trim() : '';
      }

      if (status) {
        const resolvedStatus = (nextFollowUp && nextFollowUp.trim() &&
          !['Converted', 'Closed', 'Not Interested', 'Lost', 'Client'].includes(status || lead.status))
          ? 'Follow-up' : status;

        if (resolvedStatus && resolvedStatus !== lead.status) {
          lead.history.push({
            action: 'Status Change',
            details: `Status changed from ${lead.status} to ${resolvedStatus}`,
            by: req.user.id,
            date: new Date()
          });
        }

        lead.status = resolvedStatus;

        // Auto-create deal on conversion (even for read-only users)
        if (resolvedStatus === 'Converted') {
          lead.convertedDate = new Date();
          const existingDeal = await Deal.findOne({ relatedLead: lead._id });
          if (!existingDeal) {
            const closeDate = new Date();
            closeDate.setDate(closeDate.getDate() + 30);
            await new Deal({
              dealName: lead.company || lead.name,
              clientName: lead.name,
              email: lead.email || '',
              phone: lead.phone,
              company: lead.company || '',
              dealValue: lead.budget || 0,
              stage: 'Qualification',
              probability: 10,
              expectedCloseDate: closeDate,
              source: 'Lead Conversion',
              description: lead.requirements || lead.notes || '',
              requirements: lead.requirements || '',
              notes: lead.notes || '',
              assignedTo: lead.assignedTo || req.user.id,
              createdBy: req.user.id,
              relatedLead: lead._id
            }).save();
          }
        }
      }

      if (nextFollowUp !== undefined) {
        lead.nextFollowUp = nextFollowUp && nextFollowUp.trim() ? new Date(nextFollowUp) : null;
      }

      if (leadType !== undefined) {
        if (leadType === null || ['Hot', 'Warm', 'Cold', ''].includes(leadType)) {
          const targetType = leadType === '' ? null : leadType;
          if (targetType !== lead.leadType) {
            lead.history.push({
              action: 'Lead Type Change',
              details: `Lead type changed from ${lead.leadType || 'None'} to ${targetType || 'None'}`,
              by: req.user.id,
              date: new Date()
            });
            lead.leadType = targetType;
          }
        }
      }

      await lead.save();
      const updatedLead = await Lead.findById(lead._id)
        .populate('assignedTo', 'firstName lastName email employeeId')
        .populate('createdBy', 'firstName lastName email')
        .populate('history.by', 'firstName lastName');
      return res.json(updatedLead);
    }

    const {
      name,
      email,
      phone,
      company,
      country,
      industry,
      requirement,
      source,
      status,
      assignedTo,
      budget,
      requirements,
      notes,
      newNote,
      nextFollowUp,
      followUpNotes,
      lostReason,
      dealStage,
      leadType
    } = req.body;

    // Handle newNote or notes
    if (newNote && String(newNote).trim()) {
      const authorName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'User';
      const now = new Date();
      const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const formattedEntry = `[${timeStr} - ${authorName}]: ${String(newNote).trim()}`;
      lead.notes = lead.notes ? `${lead.notes}\n\n${formattedEntry}` : formattedEntry;
      lead.history.push({
        action: 'Note Added',
        details: String(newNote).trim(),
        by: req.user.id,
        date: now
      });
    } else if (notes !== undefined) {
      lead.notes = notes ? String(notes).trim() : '';
    }

    // Update fields
    if (name) lead.name = name.trim();
    if (email) lead.email = email.toLowerCase().trim();
    if (phone) lead.phone = phone.trim();
    if (company !== undefined) lead.company = company ? company.trim() : '';
    if (country !== undefined) lead.country = country ? country.trim() : '';
    if (industry !== undefined) lead.industry = industry ? industry.trim() : '';
    if (source) lead.source = source;
    if (budget !== undefined) lead.budget = budget ? parseFloat(budget) : 0;
    if (requirements !== undefined) lead.requirements = requirements ? requirements.trim() : '';
    if (requirement !== undefined) { lead.requirement = requirement ? requirement.trim() : ''; lead.requirements = requirement ? requirement.trim() : lead.requirements; }
    if (followUpNotes !== undefined) lead.followUpNotes = followUpNotes ? followUpNotes.trim() : '';

    // Handle nextFollowUp date - convert from string if provided
    if (nextFollowUp !== undefined) {
      if (nextFollowUp && nextFollowUp.trim()) {
        lead.nextFollowUp = new Date(nextFollowUp);
        // Reset followUpCompleted when setting a new follow-up date
        lead.followUpCompleted = false;
        lead.followUpCompletedDate = null;
      } else {
        lead.nextFollowUp = null;
      }
    }

    const historyEntries = [];

    // Only Admin, Director, HR, Manager, Team Leader, Sales Head, Sales Team can reassign leads
    if (assignedTo !== undefined && canAssignOrManage) {
      const currentAssignee = lead.assignedTo ? lead.assignedTo.toString() : null;
      const newAssignee = assignedTo ? assignedTo.toString() : null;
      if (currentAssignee !== newAssignee) {
        historyEntries.push({
          action: 'Assignment Update',
          details: 'Lead reassigned',
          by: req.user.id,
          date: new Date()
        });
      }
      lead.assignedTo = assignedTo || null;
    }

    // Update status
    const resolvedStatus = (nextFollowUp && nextFollowUp.trim() && !['Converted', 'Closed', 'Not Interested', 'Lost', 'Client'].includes(status || lead.status))
      ? 'Follow-up'
      : status;

    if (resolvedStatus) {
      if (resolvedStatus !== lead.status) {
        historyEntries.push({
          action: 'Status Change',
          details: `Status changed from ${lead.status} to ${resolvedStatus}`,
          by: req.user.id,
          date: new Date()
        });
      }
      lead.status = resolvedStatus;
      if (resolvedStatus === 'Converted') {
        lead.convertedDate = new Date();
        // Auto-create a Deal record if one doesn't already exist for this lead
        const existingDeal = await Deal.findOne({ relatedLead: lead._id });
        if (!existingDeal) {
          const closeDate = new Date();
          closeDate.setDate(closeDate.getDate() + 30);
          const newDeal = new Deal({
            dealName: lead.company || lead.name,
            clientName: lead.name,
            email: lead.email || '',
            phone: lead.phone,
            company: lead.company || '',
            dealValue: lead.budget || 0,
            stage: 'Qualification',
            probability: 10,
            expectedCloseDate: closeDate,
            source: 'Lead Conversion',
            description: lead.requirements || lead.notes || '',
            requirements: lead.requirements || '',
            notes: lead.notes || '',
            assignedTo: lead.assignedTo || req.user.id,
            createdBy: req.user.id,
            relatedLead: lead._id
          });
          await newDeal.save();
        }
      }
      if (status === 'Client') {
        // Auto-create a Client record if one doesn't already exist
        const existingClient = await Client.findOne({ relatedLead: lead._id });
        if (!existingClient) {
          const newClient = new Client({
            name: lead.name,
            company: lead.company || '',
            email: lead.email || '',
            phone: lead.phone || '',
            source: lead.source || 'Lead Conversion',
            requirements: lead.requirements || '',
            notes: lead.notes || '',
            dealValue: lead.budget || 0,
            assignedTo: lead.assignedTo || null,
            createdBy: req.user.id,
            relatedLead: lead._id,
            convertedAt: new Date()
          });
          await newClient.save();
        }
      }
      if (status === 'Lost' && lostReason) {
        lead.lostReason = lostReason;
      }
    }

    if (dealStage !== undefined) lead.dealStage = dealStage;
    if (leadType !== undefined) lead.leadType = leadType || null;

    if (historyEntries.length > 0) {
      lead.history.push(...historyEntries);
    }

    await lead.save();

    const updatedLead = await Lead.findById(lead._id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .populate('history.by', 'firstName lastName');

    res.json(updatedLead);
  } catch (error) {
    console.error('Update lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Bulk delete leads
router.post('/bulk-delete', auth, checkPermission('leads', 'delete'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No lead IDs provided for deletion' });
    }

    const result = await Lead.deleteMany({ _id: { $in: ids } });
    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} lead(s)`,
      count: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete leads error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete lead
router.delete('/:id', auth, checkPermission('leads', 'delete'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await Lead.findByIdAndDelete(req.params.id);

    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Delete lead error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get leads statistics
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const user = (req.user?.role?.name) ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');

    let query = {};

    // Full access: Admin, Sales Head, Sales Manager
    const { hasFullAccess, isAdmin } = getLeadRoleAccess(user);

    // Only Admin sees stats for old data; others only see stats for new data
    if (!isAdmin) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { createdAt: { $gte: DATA_CUTOFF_DATE } },
          { addedOn: { $gte: DATA_CUTOFF_DATE } }
        ]
      });
    }

    // Regular sales, executives, and other roles only see their assigned leads or leads they added stats
    if (!hasFullAccess) {
      query.$or = [
        { assignedTo: req.user.id },
        { createdBy: req.user.id }
      ];
    }

    const [total, newLeads, inProgress, converted, lost] = await Promise.all([
      Lead.countDocuments(query),
      Lead.countDocuments({ ...query, status: 'New' }),
      Lead.countDocuments({ ...query, status: 'In Progress' }),
      Lead.countDocuments({ ...query, status: 'Converted' }),
      Lead.countDocuments({ ...query, status: 'Lost' })
    ]);

    res.json({
      total,
      new: newLeads,
      inProgress,
      converted,
      lost,
      conversionRate: total > 0 ? ((converted / total) * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update follow-up for a lead
router.put('/:id/follow-up', auth, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const { nextFollowUp, followUpNotes, followUpCompleted, followUpCompletedNotes } = req.body;
    const historyEntries = [];

    if (nextFollowUp) {
      lead.nextFollowUp = new Date(nextFollowUp);
      lead.followUpNotes = followUpNotes || '';
      lead.followUpCompleted = false;
      lead.followUpCompletedDate = null;

      historyEntries.push({
        action: 'Follow-up Scheduled',
        details: `Follow-up scheduled for ${new Date(nextFollowUp).toLocaleDateString()}`,
        by: req.user.id,
        date: new Date()
      });
    }

    if (followUpCompleted) {
      lead.followUpCompleted = true;
      lead.followUpCompletedDate = new Date();

      historyEntries.push({
        action: 'Follow-up Completed',
        details: followUpCompletedNotes || 'Follow-up marked as completed',
        by: req.user.id,
        date: new Date()
      });
    }

    if (historyEntries.length > 0) {
      lead.history.push(...historyEntries);
    }

    await lead.save();
    const populatedLead = await Lead.findById(lead._id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .populate('history.by', 'firstName lastName');

    res.json(populatedLead);
  } catch (error) {
    console.error('Error updating follow-up:', error);
    res.status(500).json({ message: 'Error updating follow-up' });
  }
});

// Get leads with due follow-ups
router.get('/followups/due', auth, async (req, res) => {
  try {
    const now = new Date();

    const user = (req.user?.role?.name) ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');
    // Check if user has full access
    const { hasFullAccess, isAdmin } = getLeadRoleAccess(user);

    const query = {
      nextFollowUp: { $ne: null, $lte: now },
      followUpCompleted: { $ne: true },
      status: { $nin: ['Converted', 'Closed', 'Not Interested', 'Lost'] },
      movedToPipeline: { $ne: true }
    };

    if (!isAdmin) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { createdAt: { $gte: DATA_CUTOFF_DATE } },
          { addedOn: { $gte: DATA_CUTOFF_DATE } }
        ]
      });
    }

    if (!hasFullAccess) {
      query.$or = [
        { assignedTo: req.user.id },
        { createdBy: req.user.id }
      ];
    }

    const leads = await Lead.find(query)
      .populate('assignedTo', 'firstName lastName')
      .select('name email phone company nextFollowUp followUpNotes status assignedTo source')
      .sort({ nextFollowUp: 1 })
      .lean();

    res.json(leads);
  } catch (error) {
    console.error('Error fetching due follow-ups:', error);
    res.status(500).json({ message: 'Error fetching due follow-ups' });
  }
});

module.exports = router;
