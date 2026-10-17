const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Deal = require('../models/Deal');
const Client = require('../models/Client');
const User = require('../models/User');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

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
    roleNormalized === 'head of sales';

  const isSalesManager =
    roleNormalized.includes('sales manager') ||
    roleNormalized.includes('salesmanager') ||
    roleNormalized === 'manager of sales';

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

// Bulk import leads from Excel upload
router.post('/bulk-import', auth, checkPermission('leads', 'create'), async (req, res) => {
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
        // Skip rows that don't have at least a name or phone
        if (!row.name || row.name === '—') {
          if (!row.phone && !row.company) {
            errors.push({ row: i + 1, reason: 'Missing required data: need at least name, phone, or company' });
            continue;
          }
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
          name: row.name && row.name !== '—' ? String(row.name).trim() : (row.company ? String(row.company).trim() : 'Unknown Lead'),
          email: row.email ? String(row.email).toLowerCase().trim() : `noemail_${Date.now()}_${i}@placeholder.com`,
          phone: row.phone ? String(row.phone).trim() : 'N/A',
          company: row.company ? String(row.company).trim() : '',
          country: row.country ? String(row.country).trim() : '',
          industry: row.industry ? String(row.industry).trim() : '',
          date: row.date ? new Date(row.date) : new Date(),
          addedOn: new Date(),
          source: row.source || 'Excel Import',
          leadType: normalizedLeadType,
          requirement: row.requirement ? String(row.requirement).trim() : '',
          requirements: row.requirements ? String(row.requirements).trim() : (row.requirement ? String(row.requirement).trim() : ''),
          notes: row.notes ? String(row.notes).trim() : '',
          budget: row.budget ? parseFloat(row.budget) : 0,
          status: 'New',
          createdBy: req.user.id,
          history: [{
            action: 'Lead Imported',
            details: 'Lead imported via Excel upload',
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
      } catch (err) {
        errors.push({ row: i + 1, reason: err.message });
      }
    }

    res.status(201).json({ imported: created.length, errors });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
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

    // For read-only users without assignment/update permission, restrict updates to status/followup/type only
    if (!hasUpdatePermission && !canAssignOrManage) {
      if (!hasReadPermission) {
        return res.status(403).json({ message: 'Access denied' });
      }
      // Restrict the update to status + nextFollowUp + leadType only
      const { status, nextFollowUp, leadType } = req.body;
      if (!status && leadType === undefined) {
        return res.status(403).json({ message: 'Read-only users can only update lead status or type' });
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
      nextFollowUp,
      followUpNotes,
      lostReason,
      dealStage,
      leadType
    } = req.body;

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
    if (notes !== undefined) lead.notes = notes ? notes.trim() : '';
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
      status: { $nin: ['Converted', 'Closed', 'Not Interested', 'Lost'] }
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
