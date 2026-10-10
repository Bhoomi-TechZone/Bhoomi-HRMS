const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const AccessPolicy = require('../models/AccessPolicy');
const EmployeePolicyAssignment = require('../models/EmployeePolicyAssignment');
const AccessPolicyRevision = require('../models/AccessPolicyRevision');
const AccessPolicyAudit = require('../models/AccessPolicyAudit');
const PolicyViolation = require('../models/PolicyViolation');
const User = require('../models/User');
const { normalizeDomain } = require('../utils/domainNormalizer');

// Helper to record revision and audit log atomically
async function recordPolicyChange({ policy, adminId, changeType, changeSummary, target = '', previousVersion, newVersion, metadata = {} }) {
  try {
    // 1. Create Revision snapshot
    await AccessPolicyRevision.create({
      policyId: policy._id,
      version: newVersion,
      snapshot: {
        name: policy.name,
        description: policy.description,
        status: policy.status,
        version: newVersion,
        blockedWebsites: policy.blockedWebsites,
        blockedApplications: policy.blockedApplications
      },
      changedBy: adminId,
      changeType,
      changeSummary
    });

    // 2. Create Audit log
    await AccessPolicyAudit.create({
      admin: adminId,
      action: changeType,
      policy: policy._id,
      target,
      previousVersion,
      newVersion,
      metadata
    });
  } catch (err) {
    console.error('[AccessPolicy][Audit/Revision Error]:', err.message);
  }
}

// ==========================================
// 1. POLICY CRUD & LISTING
// ==========================================

// @route   GET /api/access-policies
// @desc    Get all access policies with assignment counts
router.get('/', auth, checkPermission('roles', 'read'), async (req, res) => {
  try {
    const policies = await AccessPolicy.find()
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    // Aggregate assigned employee counts
    const assignmentCounts = await EmployeePolicyAssignment.aggregate([
      { $group: { _id: '$policy', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    assignmentCounts.forEach(c => { countMap[c._id.toString()] = c.count; });

    const result = policies.map(p => ({
      ...p.toObject(),
      assignedEmployeeCount: countMap[p._id.toString()] || 0
    }));

    res.json(result);
  } catch (err) {
    console.error('[AccessPolicy GET ALL]:', err.message);
    res.status(500).json({ message: 'Failed to fetch access policies' });
  }
});

// @route   GET /api/access-policies/violations
// @desc    Get violations log across all employees with filters and pagination
router.get('/violations', auth, checkPermission('roles', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, type, employeeId, startDate, endDate } = req.query;
    const filter = {};

    if (type) filter.type = type;
    if (employeeId) filter.employee = employeeId;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const violations = await PolicyViolation.find(filter)
      .populate('employee', 'firstName lastName employeeId email department')
      .populate('policy', 'name version')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PolicyViolation.countDocuments(filter);

    res.json({
      violations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('[AccessPolicy Violations]:', err.message);
    res.status(500).json({ message: 'Failed to fetch policy violations' });
  }
});

// @route   GET /api/access-policies/:id
// @desc    Get single policy by ID with assigned employees
router.get('/:id', auth, checkPermission('roles', 'read'), async (req, res) => {
  try {
    const policy = await AccessPolicy.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email')
      .populate('updatedBy', 'firstName lastName email');

    if (!policy) {
      return res.status(404).json({ message: 'Access policy not found' });
    }

    const assignments = await EmployeePolicyAssignment.find({ policy: policy._id })
      .populate('employee', 'firstName lastName employeeId email department');

    res.json({
      ...policy.toObject(),
      assignedEmployees: assignments.map(a => a.employee)
    });
  } catch (err) {
    console.error('[AccessPolicy GET]:', err.message);
    res.status(500).json({ message: 'Failed to fetch policy' });
  }
});

// @route   POST /api/access-policies
// @desc    Create a new access policy
router.post('/', auth, checkPermission('roles', 'create'), async (req, res) => {
  try {
    const { name, description, blockedWebsites = [], blockedApplications = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Policy name is required' });
    }

    const initialWebsites = blockedWebsites.map(w => ({
      domain: typeof w === 'string' ? normalizeDomain(w) : normalizeDomain(w.domain),
      addedAt: new Date()
    })).filter(w => !!w.domain);

    const initialApps = blockedApplications.map(a => ({
      name: (typeof a === 'string' ? a : a.name || a.executable || '').trim(),
      executable: (typeof a === 'string' ? a : a.executable || a.name || '').trim().toLowerCase(),
      addedAt: new Date()
    })).filter(a => !!a.executable);

    const policy = new AccessPolicy({
      name: name.trim(),
      description: (description || '').trim(),
      version: 1,
      status: 'active',
      blockedWebsites: initialWebsites,
      blockedApplications: initialApps,
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await policy.save();

    await recordPolicyChange({
      policy,
      adminId: req.user._id,
      changeType: 'CREATE_POLICY',
      changeSummary: `Created initial policy '${policy.name}' (v1)`,
      target: policy.name,
      previousVersion: null,
      newVersion: 1
    });

    res.status(201).json(policy);
  } catch (err) {
    console.error('[AccessPolicy CREATE]:', err.message);
    res.status(500).json({ message: 'Failed to create policy', error: err.message });
  }
});

// @route   PUT /api/access-policies/:id
// @desc    Update policy details (name, description, status)
router.put('/:id', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const prevVersion = policy.version;
    const newVersion = prevVersion + 1;

    const { name, description, status } = req.body;
    if (name !== undefined) policy.name = name.trim();
    if (description !== undefined) policy.description = description.trim();
    if (status !== undefined) policy.status = status;

    policy.version = newVersion;
    policy.updatedBy = req.user._id;
    await policy.save();

    await recordPolicyChange({
      policy,
      adminId: req.user._id,
      changeType: 'UPDATE_POLICY',
      changeSummary: `Updated policy settings to v${newVersion}`,
      target: policy.name,
      previousVersion: prevVersion,
      newVersion
    });

    // Notify agents via Socket.IO if available
    const io = req.app.get('socketio');
    if (io) {
      io.emit('policy-updated', { policyId: policy._id, version: newVersion });
    }

    res.json(policy);
  } catch (err) {
    console.error('[AccessPolicy UPDATE]:', err.message);
    res.status(500).json({ message: 'Failed to update policy' });
  }
});

// @route   DELETE /api/access-policies/:id
// @desc    Delete policy and remove employee assignments
router.delete('/:id', auth, checkPermission('roles', 'delete'), async (req, res) => {
  try {
    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    // Remove assignments
    await EmployeePolicyAssignment.deleteMany({ policy: policy._id });

    // Record audit before removing
    await AccessPolicyAudit.create({
      admin: req.user._id,
      action: 'DELETE_POLICY',
      policy: policy._id,
      target: policy.name,
      previousVersion: policy.version,
      newVersion: null
    });

    await policy.deleteOne();

    res.json({ message: 'Policy deleted successfully' });
  } catch (err) {
    console.error('[AccessPolicy DELETE]:', err.message);
    res.status(500).json({ message: 'Failed to delete policy' });
  }
});

// ==========================================
// 2. WEBSITES SUB-RESOURCE
// ==========================================

// @route   POST /api/access-policies/:id/websites
// @desc    Add blocked website to policy
router.post('/:id/websites', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    const { domain } = req.body;
    const normalized = normalizeDomain(domain);

    if (!normalized) {
      return res.status(400).json({ message: 'A valid domain is required' });
    }

    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const exists = policy.blockedWebsites.some(w => normalizeDomain(w.domain) === normalized);
    if (exists) {
      return res.status(400).json({ message: `Domain '${normalized}' is already in the blocklist` });
    }

    const prevVersion = policy.version;
    const newVersion = prevVersion + 1;

    policy.blockedWebsites.push({ domain: normalized, addedAt: new Date() });
    policy.version = newVersion;
    policy.updatedBy = req.user._id;
    await policy.save();

    await recordPolicyChange({
      policy,
      adminId: req.user._id,
      changeType: 'ADD_WEBSITE',
      changeSummary: `Added blocked website '${normalized}'`,
      target: normalized,
      previousVersion: prevVersion,
      newVersion
    });

    const io = req.app.get('socketio');
    if (io) io.emit('policy-updated', { policyId: policy._id, version: newVersion });

    res.json(policy);
  } catch (err) {
    console.error('[AccessPolicy ADD WEBSITE]:', err.message);
    res.status(500).json({ message: 'Failed to add website' });
  }
});

// @route   DELETE /api/access-policies/:id/websites/:websiteId
// @desc    Remove blocked website from policy
router.delete('/:id/websites/:websiteId', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const targetSite = policy.blockedWebsites.id(req.params.websiteId);
    if (!targetSite) {
      return res.status(404).json({ message: 'Blocked website entry not found' });
    }

    const removedDomain = targetSite.domain;
    const prevVersion = policy.version;
    const newVersion = prevVersion + 1;

    policy.blockedWebsites.pull({ _id: req.params.websiteId });
    policy.version = newVersion;
    policy.updatedBy = req.user._id;
    await policy.save();

    await recordPolicyChange({
      policy,
      adminId: req.user._id,
      changeType: 'REMOVE_WEBSITE',
      changeSummary: `Removed blocked website '${removedDomain}'`,
      target: removedDomain,
      previousVersion: prevVersion,
      newVersion
    });

    const io = req.app.get('socketio');
    if (io) io.emit('policy-updated', { policyId: policy._id, version: newVersion });

    res.json(policy);
  } catch (err) {
    console.error('[AccessPolicy REMOVE WEBSITE]:', err.message);
    res.status(500).json({ message: 'Failed to remove website' });
  }
});

// ==========================================
// 3. APPLICATIONS SUB-RESOURCE
// ==========================================

// @route   POST /api/access-policies/:id/applications
// @desc    Add blocked application to policy
router.post('/:id/applications', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    const { name, executable } = req.body;
    const cleanExec = (executable || '').trim().toLowerCase();
    const cleanName = (name || cleanExec).trim();

    if (!cleanExec) {
      return res.status(400).json({ message: 'Executable filename is required (e.g., discord.exe)' });
    }

    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const exists = policy.blockedApplications.some(a => a.executable === cleanExec);
    if (exists) {
      return res.status(400).json({ message: `Application '${cleanExec}' is already in the blocklist` });
    }

    const prevVersion = policy.version;
    const newVersion = prevVersion + 1;

    policy.blockedApplications.push({
      name: cleanName,
      executable: cleanExec,
      addedAt: new Date()
    });
    policy.version = newVersion;
    policy.updatedBy = req.user._id;
    await policy.save();

    await recordPolicyChange({
      policy,
      adminId: req.user._id,
      changeType: 'ADD_APPLICATION',
      changeSummary: `Added blocked application '${cleanName}' (${cleanExec})`,
      target: cleanExec,
      previousVersion: prevVersion,
      newVersion
    });

    const io = req.app.get('socketio');
    if (io) io.emit('policy-updated', { policyId: policy._id, version: newVersion });

    res.json(policy);
  } catch (err) {
    console.error('[AccessPolicy ADD APP]:', err.message);
    res.status(500).json({ message: 'Failed to add application' });
  }
});

// @route   DELETE /api/access-policies/:id/applications/:applicationId
// @desc    Remove blocked application from policy
router.delete('/:id/applications/:applicationId', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const targetApp = policy.blockedApplications.id(req.params.applicationId);
    if (!targetApp) {
      return res.status(404).json({ message: 'Blocked application entry not found' });
    }

    const removedApp = targetApp.name || targetApp.executable;
    const prevVersion = policy.version;
    const newVersion = prevVersion + 1;

    policy.blockedApplications.pull({ _id: req.params.applicationId });
    policy.version = newVersion;
    policy.updatedBy = req.user._id;
    await policy.save();

    await recordPolicyChange({
      policy,
      adminId: req.user._id,
      changeType: 'REMOVE_APPLICATION',
      changeSummary: `Removed blocked application '${removedApp}'`,
      target: removedApp,
      previousVersion: prevVersion,
      newVersion
    });

    const io = req.app.get('socketio');
    if (io) io.emit('policy-updated', { policyId: policy._id, version: newVersion });

    res.json(policy);
  } catch (err) {
    console.error('[AccessPolicy REMOVE APP]:', err.message);
    res.status(500).json({ message: 'Failed to remove application' });
  }
});

// ==========================================
// 4. EMPLOYEE ASSIGNMENT
// ==========================================

// @route   POST /api/access-policies/:id/employees
// @desc    Assign employee(s) to a policy (1:1 active policy mapping)
router.post('/:id/employees', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    const { employeeIds } = req.body; // Array or single ID
    const empList = Array.isArray(employeeIds) ? employeeIds : [employeeIds];

    if (!empList || empList.length === 0) {
      return res.status(400).json({ message: 'At least one employeeId is required' });
    }

    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const results = [];
    for (const empId of empList) {
      // Upsert: exactly 1 active policy per employee
      const assignment = await EmployeePolicyAssignment.findOneAndUpdate(
        { employee: empId },
        {
          policy: policy._id,
          assignedBy: req.user._id,
          assignedAt: new Date()
        },
        { upsert: true, new: true }
      );

      await AccessPolicyAudit.create({
        admin: req.user._id,
        action: 'ASSIGN_EMPLOYEE',
        policy: policy._id,
        target: empId.toString(),
        previousVersion: policy.version,
        newVersion: policy.version
      });

      results.push(assignment);
    }

    const io = req.app.get('socketio');
    if (io) {
      empList.forEach(eId => io.emit(`employee-policy-assigned:${eId}`, { policyId: policy._id, version: policy.version }));
    }

    res.json({ success: true, count: results.length, assignments: results });
  } catch (err) {
    console.error('[AccessPolicy ASSIGN EMPLOYEES]:', err.message);
    res.status(500).json({ message: 'Failed to assign employees to policy' });
  }
});

// @route   DELETE /api/access-policies/:id/employees/:employeeId
// @desc    Unassign employee from a policy
router.delete('/:id/employees/:employeeId', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    await EmployeePolicyAssignment.findOneAndDelete({
      policy: policy._id,
      employee: req.params.employeeId
    });

    await AccessPolicyAudit.create({
      admin: req.user._id,
      action: 'UNASSIGN_EMPLOYEE',
      policy: policy._id,
      target: req.params.employeeId,
      previousVersion: policy.version,
      newVersion: policy.version
    });

    res.json({ success: true, message: 'Employee unassigned successfully' });
  } catch (err) {
    console.error('[AccessPolicy UNASSIGN EMPLOYEE]:', err.message);
    res.status(500).json({ message: 'Failed to unassign employee' });
  }
});

// ==========================================
// 5. REVISIONS, NON-DESTRUCTIVE ROLLBACK & AUDIT
// ==========================================

// @route   GET /api/access-policies/:id/revisions
// @desc    Get revision history for a policy
router.get('/:id/revisions', auth, checkPermission('roles', 'read'), async (req, res) => {
  try {
    const revisions = await AccessPolicyRevision.find({ policyId: req.params.id })
      .populate('changedBy', 'firstName lastName email')
      .sort({ version: -1 });

    res.json(revisions);
  } catch (err) {
    console.error('[AccessPolicy REVISIONS]:', err.message);
    res.status(500).json({ message: 'Failed to fetch revisions' });
  }
});

// @route   POST /api/access-policies/:id/rollback
// @desc    Non-destructively rollback policy to a target version snapshot
//          (e.g., rollback v4 to v2 snapshot creates v5 containing v2 data)
router.post('/:id/rollback', auth, checkPermission('roles', 'update'), async (req, res) => {
  try {
    const { targetVersion } = req.body;
    if (!targetVersion || typeof targetVersion !== 'number') {
      return res.status(400).json({ message: 'Valid targetVersion number is required' });
    }

    const policy = await AccessPolicy.findById(req.params.id);
    if (!policy) return res.status(404).json({ message: 'Policy not found' });

    const targetRevision = await AccessPolicyRevision.findOne({
      policyId: policy._id,
      version: targetVersion
    });

    if (!targetRevision || !targetRevision.snapshot) {
      return res.status(404).json({ message: `Revision v${targetVersion} not found` });
    }

    const prevVersion = policy.version;
    const newVersion = prevVersion + 1;
    const snapshot = targetRevision.snapshot;

    // Apply snapshot to current policy document
    policy.name = snapshot.name || policy.name;
    policy.description = snapshot.description !== undefined ? snapshot.description : policy.description;
    policy.status = snapshot.status || policy.status;
    policy.blockedWebsites = (snapshot.blockedWebsites || []).map(w => ({
      domain: w.domain,
      addedAt: new Date()
    }));
    policy.blockedApplications = (snapshot.blockedApplications || []).map(a => ({
      name: a.name,
      executable: a.executable,
      addedAt: new Date()
    }));
    policy.version = newVersion;
    policy.updatedBy = req.user._id;

    await policy.save();

    await recordPolicyChange({
      policy,
      adminId: req.user._id,
      changeType: 'ROLLBACK_POLICY',
      changeSummary: `Non-destructively rolled back to snapshot of v${targetVersion} (created v${newVersion})`,
      target: `v${targetVersion}`,
      previousVersion: prevVersion,
      newVersion
    });

    const io = req.app.get('socketio');
    if (io) io.emit('policy-updated', { policyId: policy._id, version: newVersion });

    res.json({
      message: `Successfully rolled back to v${targetVersion} as v${newVersion}`,
      policy
    });
  } catch (err) {
    console.error('[AccessPolicy ROLLBACK]:', err.message);
    res.status(500).json({ message: 'Failed to rollback policy' });
  }
});

// @route   GET /api/access-policies/:id/audit
// @desc    Get audit trail for a policy
router.get('/:id/audit', auth, checkPermission('roles', 'read'), async (req, res) => {
  try {
    const audits = await AccessPolicyAudit.find({ policy: req.params.id })
      .populate('admin', 'firstName lastName email')
      .sort({ timestamp: -1 });

    res.json(audits);
  } catch (err) {
    console.error('[AccessPolicy AUDIT]:', err.message);
    res.status(500).json({ message: 'Failed to fetch audit log' });
  }
});

module.exports = router;
