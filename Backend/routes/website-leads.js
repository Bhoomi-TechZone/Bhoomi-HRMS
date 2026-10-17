const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const WebsiteLead = require('../models/WebsiteLead');
const gmailService = require('../services/gmailService');

// ══════════════════════════════════════════════════════════════════════════════
// GMAIL OAUTH ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/website-leads/auth/status
 * Check if Gmail is authenticated
 */
router.get('/auth/status', auth, async (req, res) => {
  try {
    const authenticated = await gmailService.isAuthenticated();
    res.json({ authenticated });
  } catch (err) {
    res.json({ authenticated: false, error: err.message });
  }
});

/**
 * GET /api/website-leads/auth/url
 * Get the Google OAuth consent URL (admin only)
 */
router.get('/auth/url', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const url = gmailService.getAuthUrl();
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: 'Failed to generate auth URL', error: err.message });
  }
});

/**
 * GET /api/website-leads/auth/callback
 * Google redirects here after user consents — exchanges code for tokens.
 * This is a browser endpoint (not API), so it renders HTML.
 */
router.get('/auth/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('Missing authorization code');

    await gmailService.handleAuthCallback(code);

    // Show success page that auto-closes
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Gmail Connected</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc;">
        <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
          <div style="font-size:48px;margin-bottom:16px;">&#x2705;</div>
          <h2 style="margin:0 0 8px;color:#1e293b;">Gmail Connected!</h2>
          <p style="color:#64748b;margin:0;">You can close this tab and return to the CRM.</p>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Gmail auth callback error:', err);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Auth Error</title></head>
      <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fef2f2;">
        <div style="text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.1);">
          <div style="font-size:48px;margin-bottom:16px;">&#x274C;</div>
          <h2 style="margin:0 0 8px;color:#991b1b;">Auth Failed</h2>
          <p style="color:#64748b;margin:0;">${err.message}</p>
        </div>
      </body>
      </html>
    `);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SYNC ENDPOINT
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/website-leads/sync
 * Manually trigger a Gmail sync — fetches new inquiry emails and saves leads
 */
router.post('/sync', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const maxResults = Math.min(parseInt(req.query.max) || 50, 200);
    const result = await gmailService.syncLeadsFromGmail(maxResults);
    res.json({
      message: 'Gmail sync completed',
      ...result,
    });
  } catch (err) {
    console.error('Gmail sync error:', err);
    res.status(500).json({ message: 'Sync failed', error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// LEAD CRUD ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/website-leads
 * Get all website leads (role-filtered: sales sees only their own)
 */
router.get('/', auth, async (req, res) => {
  try {
    const { status, formSource, assignedTo, search, page = 1, limit = 100, sortBy = 'emailDate', sortOrder = 'desc' } = req.query;

    const query = {};

    // Role-based access
    const roleName = (req.user?.role?.name || req.user?.role || '').toString().toLowerCase();
    const isAdmin = roleName.includes('admin') || roleName.includes('director') || roleName.includes('hr');
    if (!isAdmin) {
      query.assignedTo = req.user._id;
    }

    if (status) query.status = status;
    if (formSource) query.formSource = formSource;
    if (assignedTo && isAdmin) query.assignedTo = assignedTo;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { projectType: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [leads, total] = await Promise.all([
      WebsiteLead.find(query)
        .populate('assignedTo', 'firstName lastName email employeeId')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      WebsiteLead.countDocuments(query),
    ]);

    res.json({ leads, total });
  } catch (err) {
    console.error('Get website leads error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/website-leads/:id
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const lead = await WebsiteLead.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('history.by', 'firstName lastName')
      .lean();
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PATCH /api/website-leads/:id
 * Update CRM fields: status, assignedTo, notes, followUpDate
 */
router.patch('/:id', auth, async (req, res) => {
  try {
    const { status, assignedTo, notes, followUpDate } = req.body;
    const lead = await WebsiteLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const historyEntry = { by: req.user._id, date: new Date() };

    if (status && status !== lead.status) {
      historyEntry.action = 'Status Change';
      historyEntry.details = `Status changed from ${lead.status} to ${status}`;
      lead.status = status;
    }
    if (assignedTo !== undefined) {
      historyEntry.action = historyEntry.action || 'Assignment Update';
      historyEntry.details = historyEntry.details || 'Lead reassigned';
      lead.assignedTo = assignedTo || null;
    }
    if (notes !== undefined) lead.notes = notes;
    if (followUpDate !== undefined) lead.followUpDate = followUpDate ? new Date(followUpDate) : null;

    if (historyEntry.action) lead.history.push(historyEntry);

    await lead.save();

    const updated = await WebsiteLead.findById(lead._id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .lean();

    res.json(updated);
  } catch (err) {
    console.error('Update website lead error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * DELETE /api/website-leads/:id
 */
router.delete('/:id', auth, checkPermission('leads', 'delete'), async (req, res) => {
  try {
    const lead = await WebsiteLead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
