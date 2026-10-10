const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const AgentStatus = require('../models/AgentStatus');

const LATEST_VERSION = '1.2.1';

const AdmZip = require('adm-zip');

// @route   GET /api/agent/download
// @desc    Download the desktop agent installer (packaged as .zip to bypass browser warning block)
router.get('/download', (req, res) => {
  const version = req.query.version || LATEST_VERSION;
  const zipFilename = `Bhoomi-HRMS-Agent-${version}.zip`;
  const zipFilePath = path.join(__dirname, '../downloads', zipFilename);
  const exeFilename = `Bhoomi-HRMS-Agent-${version}.exe`;
  const exeFilePath = path.join(__dirname, '../downloads', exeFilename);

  const format = req.query.format;

  // Helper to serve zipped exe file dynamically
  const sendZippedFile = (targetExePath, targetZipPath, targetZipName) => {
    if (format === 'exe') {
      return res.download(targetExePath, targetExePath.split(/[\\/]/).pop());
    }

    try {
      if (fs.existsSync(targetZipPath)) {
        return res.download(targetZipPath, targetZipName);
      }

      console.log(`[Agent Download] Zipping ${targetExePath} dynamically...`);
      const zip = new AdmZip();
      zip.addLocalFile(targetExePath);
      zip.writeZip(targetZipPath);

      res.download(targetZipPath, targetZipName);
    } catch (err) {
      console.error('[Agent Download] Zipping failed:', err.message);
      // Fallback to serving raw exe file if zipping fails
      res.download(targetExePath, targetExePath.split(/[\\/]/).pop());
    }
  };

  if (fs.existsSync(exeFilePath)) {
    sendZippedFile(exeFilePath, zipFilePath, zipFilename);
  } else {
    // Fallback to LATEST_VERSION if version not found
    const fallbackExeFilename = `Bhoomi-HRMS-Agent-${LATEST_VERSION}.exe`;
    const fallbackExePath = path.join(__dirname, '../downloads', fallbackExeFilename);
    const fallbackZipFilename = `Bhoomi-HRMS-Agent-${LATEST_VERSION}.zip`;
    const fallbackZipPath = path.join(__dirname, '../downloads', fallbackZipFilename);

    if (fs.existsSync(fallbackExePath)) {
      sendZippedFile(fallbackExePath, fallbackZipPath, fallbackZipFilename);
    } else {
      res.status(404).json({ message: 'Agent installer executable not found' });
    }
  }
});

// @route   GET /api/agent/latest-version
// @desc    Get the latest version of the desktop agent and its download URL
router.get('/latest-version', (req, res) => {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const downloadUrl = `${protocol}://${host}/api/agent/download`;

  res.json({
    version: LATEST_VERSION,
    downloadUrl
  });
});

// @route   POST /api/agent/heartbeat
// @desc    Receive periodic heartbeat from desktop agent
router.post('/heartbeat', async (req, res) => {
  try {
    const { employeeId, version } = req.body;

    if (!employeeId || !version) {
      return res.status(400).json({ message: 'employeeId and version are required' });
    }

    const status = await AgentStatus.findOneAndUpdate(
      { employeeId },
      {
        version,
        lastSeen: new Date(),
        isOnline: true
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, status });
  } catch (err) {
    console.error('[Heartbeat Error]:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// @route   GET /api/agent/status
// @desc    Get the current user's agent status
router.get('/status', auth, async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID not found for current user' });
    }

    const status = await AgentStatus.findOne({ employeeId });

    if (!status) {
      return res.json({
        installed: false,
        online: false,
        version: null,
        latestVersion: LATEST_VERSION,
        updateAvailable: false,
        lastSeen: null
      });
    }

    const online = status.isOnline && (Date.now() - status.lastSeen.getTime()) < 2 * 60 * 1000;

    res.json({
      installed: true,
      online,
      version: status.version,
      latestVersion: LATEST_VERSION,
      updateAvailable: status.version !== LATEST_VERSION,
      lastSeen: status.lastSeen
    });
  } catch (err) {
    console.error('[Agent Status Error]:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==========================================
// ACCESS POLICY AGENT ENDPOINTS
// ==========================================

const AccessPolicy = require('../models/AccessPolicy');
const EmployeePolicyAssignment = require('../models/EmployeePolicyAssignment');
const PolicyViolation = require('../models/PolicyViolation');

// @route   GET /api/agent/policy/version
// @desc    Lightweight check for employee's assigned policy version
router.get('/policy/version', auth, async (req, res) => {
  try {
    const employeeUser = req.user;
    const assignment = await EmployeePolicyAssignment.findOne({ employee: employeeUser._id })
      .populate('policy', 'version status');

    if (!assignment || !assignment.policy || assignment.policy.status !== 'active') {
      return res.json({
        hasPolicy: false,
        policyId: null,
        version: 0,
        status: 'none'
      });
    }

    res.json({
      hasPolicy: true,
      policyId: assignment.policy._id,
      version: assignment.policy.version,
      status: assignment.policy.status
    });
  } catch (err) {
    console.error('[Agent Policy Version Error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve policy version' });
  }
});

// @route   GET /api/agent/policy
// @desc    Get full assigned access policy for the authenticated employee
router.get('/policy', auth, async (req, res) => {
  try {
    const employeeUser = req.user;
    const assignment = await EmployeePolicyAssignment.findOne({ employee: employeeUser._id })
      .populate('policy');

    if (!assignment || !assignment.policy || assignment.policy.status !== 'active') {
      return res.json({
        hasPolicy: false,
        policyId: null,
        version: 0,
        status: 'none',
        blockedWebsites: [],
        blockedApplications: []
      });
    }

    const policy = assignment.policy;

    // Return normalized format per requirement #9
    res.json({
      hasPolicy: true,
      policyId: policy._id,
      version: policy.version,
      status: policy.status,
      blockedWebsites: policy.blockedWebsites.map(w => w.domain),
      blockedApplications: policy.blockedApplications.map(a => ({
        name: a.name,
        executable: a.executable
      }))
    });
  } catch (err) {
    console.error('[Agent Policy Error]:', err.message);
    res.status(500).json({ message: 'Failed to retrieve policy' });
  }
});

// @route   POST /api/agent/policy-violations
// @desc    Ingest policy violation events from agent / windows service
router.post('/policy-violations', auth, async (req, res) => {
  try {
    const employeeUser = req.user;
    const { violations = [], deviceId } = req.body;

    const violationList = Array.isArray(violations) ? violations : [req.body];
    const createdViolations = [];

    // Resolve employee active policy
    const assignment = await EmployeePolicyAssignment.findOne({ employee: employeeUser._id })
      .populate('policy', '_id version');

    const policyId = assignment?.policy?._id;
    const currentVersion = assignment?.policy?.version || 1;

    for (const v of violationList) {
      if (!v.target || !v.type) continue;

      const violationDoc = new PolicyViolation({
        employee: employeeUser._id,
        device: deviceId || v.deviceId || 'unknown-device',
        policy: v.policyId || policyId,
        policyVersion: v.policyVersion || currentVersion,
        type: v.type.toUpperCase() === 'APPLICATION' ? 'APPLICATION' : 'WEBSITE',
        target: v.target.trim(),
        action: v.action || 'BLOCKED',
        timestamp: v.timestamp ? new Date(v.timestamp) : new Date(),
        metadata: v.metadata || {}
      });

      await violationDoc.save();
      createdViolations.push(violationDoc);
    }

    res.json({ success: true, count: createdViolations.length });
  } catch (err) {
    console.error('[Agent Policy Violations Error]:', err.message);
    res.status(500).json({ message: 'Failed to record policy violations' });
  }
});

// @route   POST /api/agent/enforcement-status
// @desc    Report detailed Windows Service enforcement health and capability
router.post('/enforcement-status', auth, async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const {
      policyId,
      policyVersion,
      enforcementVersion,
      enforcementStatus,
      appEnforcementStatus,
      webEnforcementStatus,
      lastEnforcementError,
      windowsVersion,
      windowsBuild,
      windowsEdition,
      appControlSupported,
      webControlSupported,
      limitationReason
    } = req.body;

    const updateFields = {
      lastSeen: new Date(),
      lastEnforcementCheckAt: new Date()
    };

    if (policyId) updateFields.activePolicyId = policyId;
    if (policyVersion !== undefined) updateFields.policyVersion = policyVersion;
    if (enforcementVersion !== undefined) updateFields.enforcementVersion = enforcementVersion;
    if (enforcementStatus) updateFields.enforcementStatus = enforcementStatus;
    if (appEnforcementStatus) updateFields.appEnforcementStatus = appEnforcementStatus;
    if (webEnforcementStatus) updateFields.webEnforcementStatus = webEnforcementStatus;
    if (lastEnforcementError !== undefined) updateFields.lastEnforcementError = lastEnforcementError;
    if (windowsVersion !== undefined) updateFields.windowsVersion = windowsVersion;
    if (windowsBuild !== undefined) updateFields.windowsBuild = windowsBuild;
    if (windowsEdition !== undefined) updateFields.windowsEdition = windowsEdition;
    if (appControlSupported !== undefined) updateFields.appControlSupported = appControlSupported;
    if (webControlSupported !== undefined) updateFields.webControlSupported = webControlSupported;
    if (limitationReason !== undefined) updateFields.limitationReason = limitationReason;

    const status = await AgentStatus.findOneAndUpdate(
      { employeeId },
      { $set: updateFields },
      { upsert: true, new: true }
    );

    res.json({ success: true, status });
  } catch (err) {
    console.error('[Agent Enforcement Status Error]:', err.message);
    res.status(500).json({ message: 'Failed to record enforcement status' });
  }
});

module.exports = router;
