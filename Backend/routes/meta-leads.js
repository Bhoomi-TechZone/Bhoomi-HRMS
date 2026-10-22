const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const MetaConfig = require('../models/MetaConfig');
const MetaLead = require('../models/MetaLead');
const Lead = require('../models/Lead');
const Deal = require('../models/Deal');
const Client = require('../models/Client');
const User = require('../models/User');
const metaService = require('../services/metaService');

// Cutoff timestamp: old Meta leads are strictly visible ONLY to Admin
const DATA_CUTOFF_DATE = new Date(process.env.CRM_DATA_CUTOFF_DATE || '2026-10-17T00:00:00+05:30');

// Helper to evaluate Meta leads role access
function getMetaLeadRoleAccess(user) {
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

  const canSeeAllLeads = isAdmin || isSalesHead || isSalesManager;
  const canAssign = canSeeAllLeads;

  return { canSeeAllLeads, canAssign, isSalesHead, isSalesManager, isAdmin, roleName, roleNormalized };
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIG ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/meta-leads/config
 * Returns current Meta API configuration (tokens are masked for security)
 */
router.get('/config', auth, async (req, res) => {
  try {
    const config = await MetaConfig.findOne().lean();
    if (!config) return res.json({ configured: false });

    // Mask tokens in response
    const safe = {
      ...config,
      userAccessToken: config.userAccessToken ? '***CONFIGURED***' : null,
      pages: (config.pages || []).map(p => ({
        ...p,
        pageToken: p.pageToken ? '***CONFIGURED***' : null
      })),
      configured: true
    };
    res.json(safe);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * POST /api/meta-leads/config
 * Save or update Meta API config with user access token.
 * Automatically fetches pages & forms from Facebook.
 */
router.post('/config', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const { userAccessToken, graphApiVersion, autoSync, syncIntervalHours } = req.body;
    if (!userAccessToken) {
      return res.status(400).json({ message: 'userAccessToken is required' });
    }

    const version = graphApiVersion || 'v25.0';

    // Fetch pages & forms from Meta
    let pages;
    try {
      pages = await metaService.refreshPagesAndForms(userAccessToken, version);
    } catch (err) {
      return res.status(400).json({
        message: 'Failed to fetch pages from Meta. Check your access token.',
        error: err.response?.data?.error?.message || err.message
      });
    }

    // Preserve existing per-form sync timestamps if config already exists
    const existing = await MetaConfig.findOne();
    if (existing) {
      for (const newPage of pages) {
        const existingPage = existing.pages.find(p => p.pageId === newPage.pageId);
        if (!existingPage) continue;
        for (const newForm of newPage.forms) {
          const existingForm = existingPage.forms.find(f => f.formId === newForm.formId);
          if (existingForm) {
            newForm.lastSyncedAt = existingForm.lastSyncedAt;
            newForm.lastLeadTime = existingForm.lastLeadTime;
            newForm.isEnabled = existingForm.isEnabled;
          }
        }
      }
    }

    const configData = {
      userAccessToken,
      graphApiVersion: version,
      pages,
      autoSync: autoSync !== undefined ? autoSync : true,
      syncIntervalHours: syncIntervalHours || 1,
      updatedBy: req.user._id
    };

    const config = await MetaConfig.findOneAndUpdate(
      {},
      { $set: configData },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Meta config saved successfully',
      pagesFound: pages.length,
      totalForms: pages.reduce((acc, p) => acc + p.forms.length, 0),
      config: {
        ...config.toObject(),
        userAccessToken: '***CONFIGURED***',
        pages: config.pages.map(p => ({ ...p.toObject(), pageToken: '***CONFIGURED***' }))
      }
    });
  } catch (err) {
    console.error('Meta config save error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PATCH /api/meta-leads/config/form/:formId
 * Enable/disable a specific form
 */
router.patch('/config/form/:formId', auth, checkPermission('leads', 'update'), async (req, res) => {
  try {
    const { isEnabled } = req.body;
    const config = await MetaConfig.findOne();
    if (!config) return res.status(404).json({ message: 'Meta config not found' });

    let found = false;
    for (const page of config.pages) {
      const form = page.forms.find(f => f.formId === req.params.formId);
      if (form) {
        form.isEnabled = isEnabled;
        found = true;
        break;
      }
    }
    if (!found) return res.status(404).json({ message: 'Form not found in config' });

    config.markModified('pages');
    await config.save();
    res.json({ message: 'Form config updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// FACEBOOK GRAPH API PROXY ENDPOINTS (live data from Meta)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/meta-leads/pages
 * Fetch list of managed Facebook pages from Meta (live)
 */
router.get('/pages', auth, async (req, res) => {
  try {
    const config = await MetaConfig.findOne();
    if (!config) return res.status(400).json({ message: 'Meta config not set. Please configure first.' });

    const pages = await metaService.getPages(config.userAccessToken, config.graphApiVersion);
    res.json({ pages });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch pages from Meta',
      error: err.response?.data?.error?.message || err.message
    });
  }
});

/**
 * GET /api/meta-leads/pages/:pageId/forms
 * Fetch lead-gen forms for a page (live from Meta)
 */
router.get('/pages/:pageId/forms', auth, async (req, res) => {
  try {
    const config = await MetaConfig.findOne();
    if (!config) return res.status(400).json({ message: 'Meta config not set.' });

    const page = config.pages.find(p => p.pageId === req.params.pageId);
    if (!page) return res.status(404).json({ message: 'Page not found in config' });

    const forms = await metaService.getLeadGenForms(page.pageId, page.pageToken, config.graphApiVersion);
    res.json({ forms });
  } catch (err) {
    res.status(500).json({
      message: 'Failed to fetch forms from Meta',
      error: err.response?.data?.error?.message || err.message
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SYNC ENDPOINTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/meta-leads/sync
 * Full sync: fetch all new leads from all enabled pages & forms
 */
router.post('/sync', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const results = await metaService.syncAllLeads();
    const totalNew = results.reduce((acc, r) => acc + (r.newCount || 0), 0);
    res.json({
      message: 'Sync completed',
      totalNewLeads: totalNew,
      details: results
    });
  } catch (err) {
    console.error('Meta sync error:', err);
    res.status(500).json({ message: 'Sync failed', error: err.message });
  }
});

/**
 * POST /api/meta-leads/sync/form/:formId
 * Sync leads for a specific form only
 */
router.post('/sync/form/:formId', auth, checkPermission('leads', 'create'), async (req, res) => {
  try {
    const config = await MetaConfig.findOne();
    if (!config) return res.status(400).json({ message: 'Meta config not set.' });

    let targetPage = null;
    let targetForm = null;
    let formIndex = -1;

    for (const page of config.pages) {
      const idx = page.forms.findIndex(f => f.formId === req.params.formId);
      if (idx !== -1) {
        targetPage = page;
        targetForm = page.forms[idx];
        formIndex = idx;
        break;
      }
    }

    if (!targetForm) return res.status(404).json({ message: 'Form not found in config' });

    const rawLeads = await metaService.getFormLeads(
      targetForm.formId,
      targetPage.pageToken,
      config.graphApiVersion,
      targetForm.lastLeadTime
    );

    let newCount = 0;
    let newestTime = targetForm.lastLeadTime ? new Date(targetForm.lastLeadTime) : null;

    const MetaLeadModel = require('../models/MetaLead');
    for (const raw of rawLeads) {
      const parsed = metaService.parseFieldData(raw.field_data || []);
      const lt = new Date(raw.created_time);
      await MetaLeadModel.findOneAndUpdate(
        { metaLeadId: raw.id },
        {
          $set: {
            metaLeadId: raw.id,
            formId: targetForm.formId,
            formName: targetForm.formName,
            pageId: targetPage.pageId,
            pageName: targetPage.pageName,
            createdTime: lt,
            name: parsed.name,
            email: parsed.email,
            phone: parsed.phone,
            city: parsed.city,
            businessCategory: parsed.businessCategory,
            websiteType: parsed.websiteType,
            fieldData: raw.field_data || [],
            syncedAt: new Date()
          },
          $setOnInsert: { status: 'New', assignedTo: null, notes: '' }
        },
        { upsert: true, new: true }
      );
      newCount++;
      if (!newestTime || lt > newestTime) newestTime = lt;
    }

    // Update config
    const pageInConfig = config.pages.find(p => p.pageId === targetPage.pageId);
    if (pageInConfig) {
      pageInConfig.forms[formIndex].lastSyncedAt = new Date();
      if (newestTime) pageInConfig.forms[formIndex].lastLeadTime = newestTime;
    }
    config.markModified('pages');
    await config.save();

    res.json({ message: 'Form sync completed', newLeads: newCount, formId: req.params.formId });
  } catch (err) {
    console.error('Form sync error:', err);
    res.status(500).json({ message: 'Form sync failed', error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// LEAD CRUD ENDPOINTS (from local DB)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/meta-leads
 * Get all Meta leads from DB with filtering, pagination, search
 */
router.get('/', auth, async (req, res) => {
  try {
    const {
      status, pageId, formId, assignedTo,
      search, page = 1, limit = 20,
      sortBy = 'createdTime', sortOrder = 'desc',
      assignedDate
    } = req.query;

    const query = {};

    // Only Sales Head, Sales Manager, and Admin see all new leads to assign them
    const user = req.user?.role?.name ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');
    const { canSeeAllLeads, isAdmin } = getMetaLeadRoleAccess(user);

    // Only Admin can see old Meta leads
    if (!isAdmin) {
      query.createdTime = { $gte: DATA_CUTOFF_DATE };
    }

    if (!canSeeAllLeads) {
      query.assignedTo = req.user._id;
    }

    if (status) query.status = status;
    if (pageId) query.pageId = pageId;
    if (assignedTo && canSeeAllLeads) query.assignedTo = assignedTo;

    // Exclude leads moved to pipeline by default so they only appear in Deals in Pipeline
    if (req.query.includeMoved !== 'true') {
      query.movedToPipeline = { $ne: true };
    }

    // Filter by assigned date — match leads whose history has an Assignment Update on that date
    if (assignedDate) {
      const dateStart = new Date(assignedDate);
      dateStart.setHours(0, 0, 0, 0);
      const dateEnd = new Date(assignedDate);
      dateEnd.setHours(23, 59, 59, 999);
      query.history = {
        $elemMatch: {
          action: 'Assignment Update',
          date: { $gte: dateStart, $lte: dateEnd }
        }
      };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [leads, total] = await Promise.all([
      MetaLead.find(query)
        .populate('assignedTo', 'firstName lastName email employeeId')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      MetaLead.countDocuments(query)
    ]);

    res.json({
      leads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Get meta leads error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/meta-leads/stats
 * Get Meta leads statistics overview
 */
router.get('/stats', auth, async (req, res) => {
  try {
    const { pageId, formId } = req.query;
    const baseQuery = {};

    // Current month filter - Start of month to end of month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Filter by current month using createdTime
    baseQuery.createdTime = {
      $gte: startOfMonth,
      $lte: endOfMonth
    };

    // Only Admin sees stats for old leads; others only see new data
    const user = req.user?.role?.name ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');
    const { canSeeAllLeads, isAdmin } = getMetaLeadRoleAccess(user);
    if (!isAdmin) {
      baseQuery.createdTime = { $gte: DATA_CUTOFF_DATE };
    }
    if (!canSeeAllLeads) {
      baseQuery.assignedTo = req.user._id;
    }

    if (pageId) baseQuery.pageId = pageId;
    if (formId) baseQuery.formId = formId;

    const [total, byStatus, byPage, recentLeads] = await Promise.all([
      MetaLead.countDocuments(baseQuery),
      MetaLead.aggregate([
        { $match: baseQuery },

        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      MetaLead.aggregate([
        { $match: baseQuery },
        { $group: { _id: { pageId: '$pageId', pageName: '$pageName' }, count: { $sum: 1 } } }
      ]),
      MetaLead.find(baseQuery)
        .sort({ createdTime: -1 })
        .limit(5)
        .select('name email phone status createdTime pageName formName')
        .lean()
    ]);

    const statusMap = {};
    for (const s of byStatus) statusMap[s._id] = s.count;

    res.json({
      total,
      byStatus: statusMap,
      byPage,
      recentLeads
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/meta-leads/source-stats
 * Aggregate lead counts grouped by pageName (source)
 */
router.get('/source-stats', auth, async (req, res) => {
  try {
    const roleName = req.user.role?.name;
    const isAdmin = ['Admin', 'Director', 'HR'].includes(roleName);
    const matchQuery = {};
    if (!isAdmin) matchQuery.assignedTo = req.user._id;

    const stats = await MetaLead.aggregate([
      { $match: matchQuery },
      {
        $addFields: {
          sourceLabel: {
            $let: {
              vars: {
                p: { $toLower: { $ifNull: ['$platform', ''] } },
                fn: { $toLower: { $ifNull: ['$formName', ''] } }
              },
              in: {
                $switch: {
                  branches: [
                    // ── Platform field (populated from Meta API) ──────────────
                    { case: { $eq: ['$$p', 'ig'] }, then: 'Instagram' },
                    { case: { $eq: ['$$p', 'fb'] }, then: 'Facebook' },
                    { case: { $eq: ['$$p', 'website'] }, then: 'Website' },
                    // ── Keyword fallback (existing leads before platform field) ─
                    { case: { $regexMatch: { input: '$$fn', regex: 'instagram' } }, then: 'Instagram' },
                    { case: { $regexMatch: { input: '$$fn', regex: 'website' } }, then: 'Website' },
                    { case: { $regexMatch: { input: '$$fn', regex: 'facebook' } }, then: 'Facebook' },
                  ],
                  default: {
                    $cond: [
                      { $gt: [{ $strLenCP: { $ifNull: ['$formName', ''] } }, 0] },
                      '$formName',
                      {
                        $cond: [
                          { $gt: [{ $strLenCP: { $ifNull: ['$pageName', ''] } }, 0] },
                          '$pageName',
                          'Unknown'
                        ]
                      }
                    ]
                  }
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: '$sourceLabel',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 6 }
    ]);

    const total = stats.reduce((sum, s) => sum + s.count, 0);
    const sources = stats.map(s => ({
      label: s._id || 'Unknown',
      count: s.count,
      percent: total > 0 ? Math.round((s.count / total) * 100) : 0
    }));

    // Normalise so percentages sum to 100
    if (sources.length && total > 0) {
      const diff = 100 - sources.reduce((s, x) => s + x.percent, 0);
      if (diff !== 0) sources[0].percent += diff;
    }

    res.json({ sources, total });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/meta-leads/timeline
 * Returns daily lead counts grouped by source for timeline chart
 * Query params:
 *   - month: YYYY-MM (defaults to current month)
 */
router.get('/timeline', auth, async (req, res) => {
  try {
    const roleName = (req.user.role?.name || '').toLowerCase();
    const canSeeAllLeads =
      roleName.includes('admin') ||
      roleName.includes('director') ||
      roleName.includes('hr') ||
      roleName.includes('leader') ||
      roleName.includes('team lead') ||
      roleName.includes('head') ||
      roleName.includes('manager');

    // Parse month param or default to current month
    const { month } = req.query;
    let startDate, endDate;
    if (month) {
      const [year, monthNum] = month.split('-').map(Number);
      startDate = new Date(year, monthNum - 1, 1);
      endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    const matchQuery = {
      createdTime: { $gte: startDate, $lte: endDate }
    };
    if (!canSeeAllLeads) matchQuery.assignedTo = req.user._id;

    // Aggregate leads by day and source
    const [timelineMeta, timelineManual] = await Promise.all([
      MetaLead.aggregate([
        { $match: matchQuery },
        {
          $addFields: {
            dateOnly: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdTime' }
            },
            sourceLabel: {
              $let: {
                vars: {
                  p: { $toLower: { $ifNull: ['$platform', ''] } },
                  fn: { $toLower: { $ifNull: ['$formName', ''] } }
                },
                in: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$$p', 'ig'] }, then: 'Instagram' },
                      { case: { $eq: ['$$p', 'fb'] }, then: 'Facebook' },
                      { case: { $eq: ['$$p', 'website'] }, then: 'Website' },
                      { case: { $regexMatch: { input: '$$fn', regex: 'instagram' } }, then: 'Instagram' },
                      { case: { $regexMatch: { input: '$$fn', regex: 'website' } }, then: 'Website' },
                      { case: { $regexMatch: { input: '$$fn', regex: 'facebook' } }, then: 'Facebook' },
                      { case: { $regexMatch: { input: '$$fn', regex: 'indiamart' } }, then: 'IndiaMART' },
                      { case: { $regexMatch: { input: '$$fn', regex: 'linkedin' } }, then: 'LinkedIn' },
                    ],
                    default: 'Other'
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              date: '$dateOnly',
              source: '$sourceLabel'
            },
            count: { $sum: 1 }
          }
        }
      ]),
      Lead.aggregate([
        {
          $addFields: {
            actualDate: { $ifNull: ['$date', '$createdAt'] }
          }
        },
        {
          $match: {
            actualDate: { $gte: startDate, $lte: endDate },
            ...(canSeeAllLeads ? {} : { assignedTo: req.user._id })
          }
        },
        {
          $addFields: {
            dateOnly: { $dateToString: { format: '%Y-%m-%d', date: '$actualDate' } },
            sourceLabel: { $ifNull: ['$source', 'Manual'] }
          }
        },
        {
          $group: {
            _id: { date: '$dateOnly', source: '$sourceLabel' },
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    const timelineRaw = [...timelineMeta, ...timelineManual];
    const timeline = timelineRaw.sort((a, b) => {
      if (a._id.date !== b._id.date) return a._id.date.localeCompare(b._id.date);
      return a._id.source.localeCompare(b._id.source);
    });

    // Transform aggregation result into chart-friendly format
    const datesSet = new Set();
    const sourcesMap = new Map();

    // Initialize map with required default sources so they always show up on the chart
    const defaultSources = ['Website', 'Other', 'Instagram', 'Email Marketing', 'Manual', 'Excel Import', 'Facebook'];
    defaultSources.forEach(src => sourcesMap.set(src, new Map()));

    timeline.forEach(item => {
      datesSet.add(item._id.date);
      if (!sourcesMap.has(item._id.source)) {
        sourcesMap.set(item._id.source, new Map());
      }
      sourcesMap.get(item._id.source).set(item._id.date, item.count);
    });

    // Sort dates chronologically
    const dates = Array.from(datesSet).sort();

    // Format dates for display (e.g., "Jan 10", "Feb 07")
    const formattedDates = dates.map(dateStr => {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Build sources array with data aligned to dates
    const sources = Array.from(sourcesMap.entries()).map(([sourceName, dateMap]) => {
      return {
        name: sourceName,
        data: dates.map(date => dateMap.get(date) || 0)
      };
    });

    res.json({ dates: formattedDates, sources });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PUT /api/meta-leads/:id/follow-up
 * Update follow-up for a meta lead or mark it as completed
 */
router.put('/:id/follow-up', auth, async (req, res) => {
  try {
    const lead = await MetaLead.findById(req.params.id);

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Check permission
    const roleName = (req.user.role?.name || '').toLowerCase();
    const canManageLeads =
      roleName.includes('admin') ||
      roleName.includes('director') ||
      roleName.includes('hr') ||
      roleName.includes('leader') ||
      roleName.includes('lead') ||
      roleName.includes('head') ||
      roleName.includes('sales') ||
      roleName.includes('manager');
    if (!canManageLeads && String(lead.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied. This lead is not assigned to you.' });
    }

    const { followUpDate, notes, followUpCompleted } = req.body;

    if (followUpDate) {
      lead.followUpDate = new Date(followUpDate);
      lead.notes = notes || lead.notes || '';
      lead.followUpCompleted = false;
      lead.followUpCompletedDate = null;
    }

    if (followUpCompleted) {
      lead.followUpCompleted = true;
      lead.followUpCompletedDate = new Date();
    }

    await lead.save();

    const updated = await MetaLead.findById(lead._id)
      .populate('assignedTo', 'firstName lastName')
      .lean();

    res.json(updated);
  } catch (error) {
    console.error('Error updating follow-up:', error);
    res.status(500).json({ message: 'Error updating follow-up' });
  }
});

/**
 * GET /api/meta-leads/followups/due
 * Get meta leads with due follow-ups (today or past)
 */
router.get('/followups/due', auth, async (req, res) => {
  try {
    const now = new Date();

    const user = req.user?.role?.name ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');
    const { canSeeAllLeads: canManageLeads, isAdmin } = getMetaLeadRoleAccess(user);

    const query = {
      followUpDate: { $ne: null, $lte: now },
      followUpCompleted: { $ne: true },
      status: { $nin: ['Converted', 'Closed', 'Not Interested'] },
      movedToPipeline: { $ne: true }
    };
    if (!isAdmin) {
      query.createdTime = { $gte: DATA_CUTOFF_DATE };
    }
    if (!canManageLeads) query.assignedTo = req.user._id;

    const leads = await MetaLead.find(query)
      .populate('assignedTo', 'firstName lastName')
      .select('name email phone followUpDate notes status assignedTo pageName businessCategory')
      .sort({ followUpDate: 1 })
      .lean();

    res.json(leads);
  } catch (error) {
    console.error('Error fetching meta lead follow-ups:', error);
    res.status(500).json({ message: 'Error fetching due follow-ups' });
  }
});

/**
 * GET /api/meta-leads/:id
 * Get a single Meta lead by DB id
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const lead = await MetaLead.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('history.by', 'firstName lastName')
      .lean();

    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Non-admin roles cannot view old Meta leads
    const user = req.user?.role?.name ? req.user : await User.findById(req.user?._id || req.user?.id).populate('role');
    const { canSeeAllLeads, isAdmin } = getMetaLeadRoleAccess(user);
    if (!isAdmin) {
      const leadTime = new Date(lead.createdTime || lead.createdAt || 0);
      if (leadTime < DATA_CUTOFF_DATE) {
        return res.status(403).json({ message: 'Access denied. Old leads are only visible to Admin.' });
      }
    }
    if (!canSeeAllLeads && String(lead.assignedTo?._id || lead.assignedTo) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Access denied. This lead is not assigned to you.' });
    }

    res.json(lead);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PATCH /api/meta-leads/:id
 * Update CRM fields of a Meta lead (status, assignedTo, notes, followUpDate)
 */
router.patch('/:id', auth, async (req, res) => {
  try {
    const { status, assignedTo, notes, newNote, followUpDate, dealStage } = req.body;
    const lead = await MetaLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Only Sales Head, Sales Manager, and Admin can assign and reassign leads
    const { canAssign } = getMetaLeadRoleAccess(req.user);
    if (!canAssign) {
      if (String(lead.assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Access denied. This lead is not assigned to you.' });
      }
      if (assignedTo !== undefined && String(assignedTo) !== String(req.user._id)) {
        return res.status(403).json({ message: 'You cannot reassign leads.' });
      }
    }

    const historyEntry = { by: req.user._id, date: new Date() };
    const resolvedStatus = (followUpDate && !['Converted', 'Closed', 'Not Interested', 'Lost', 'Client'].includes(status || lead.status))
      ? 'Follow-up'
      : status;

    if (resolvedStatus && resolvedStatus !== lead.status) {
      historyEntry.action = 'Status Change';
      historyEntry.details = `Status changed from ${lead.status} to ${resolvedStatus}`;
      lead.status = resolvedStatus;

      // Auto-create Deal when meta lead is Converted
      if (resolvedStatus === 'Converted') {
        const existingDeal = await Deal.findOne({ relatedMetaLead: lead._id });
        if (!existingDeal) {
          const closeDate = new Date();
          closeDate.setDate(closeDate.getDate() + 30);
          const newDeal = new Deal({
            dealName: lead.businessCategory || lead.pageName || lead.name || 'Untitled Deal',
            clientName: lead.name || '',
            email: lead.email || '',
            phone: lead.phone || '',
            company: lead.businessCategory || lead.pageName || '',
            dealValue: 0,
            stage: 'Qualification',
            probability: 10,
            expectedCloseDate: closeDate,
            source: 'Meta',
            description: lead.notes || lead.websiteType || '',
            requirements: lead.notes || '',
            notes: lead.notes || '',
            assignedTo: lead.assignedTo || req.user._id,
            createdBy: req.user._id,
            relatedMetaLead: lead._id
          });
          await newDeal.save();
        }
      }

      // Auto-create Client when meta lead is marked as Client
      if (status === 'Client') {
        const existingClient = await Client.findOne({ relatedMetaLead: lead._id });
        if (!existingClient) {
          const newClient = new Client({
            name: lead.name || '',
            company: lead.businessCategory || lead.pageName || '',
            email: lead.email || '',
            phone: lead.phone || '',
            source: `Meta · ${lead.pageName || 'Facebook'}`,
            requirements: lead.notes || lead.websiteType || '',
            notes: lead.notes || '',
            dealValue: 0,
            assignedTo: lead.assignedTo || null,
            createdBy: req.user._id,
            relatedMetaLead: lead._id,
            convertedAt: new Date()
          });
          await newClient.save();
        }
      }
    }
    if (assignedTo !== undefined) {
      historyEntry.action = historyEntry.action || 'Assignment Update';
      historyEntry.details = historyEntry.details || 'Lead reassigned';
      lead.assignedTo = assignedTo || null;
    }
    if (newNote && String(newNote).trim()) {
      const authorUser = req.user?.firstName ? req.user : await User.findById(req.user?._id || req.user?.id);
      const authorName = `${authorUser?.firstName || ''} ${authorUser?.lastName || ''}`.trim() || authorUser?.email || 'User';
      const now = new Date();
      const timeStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const formattedEntry = `[${timeStr} - ${authorName}]: ${String(newNote).trim()}`;
      lead.notes = lead.notes ? `${lead.notes}\n\n${formattedEntry}` : formattedEntry;
      lead.history.push({
        action: 'Note Added',
        details: String(newNote).trim(),
        by: req.user._id,
        date: now
      });
    } else if (notes !== undefined) {
      lead.notes = notes;
    }
    if (followUpDate !== undefined) {
      lead.followUpDate = followUpDate ? new Date(followUpDate) : null;
      // Reset followUpCompleted when setting a new follow-up date
      if (followUpDate) {
        lead.followUpCompleted = false;
        lead.followUpCompletedDate = null;
      }
    }
    if (dealStage !== undefined) lead.dealStage = dealStage;

    if (historyEntry.action) lead.history.push(historyEntry);

    await lead.save();

    const updated = await MetaLead.findById(lead._id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .lean();

    res.json(updated);
  } catch (err) {
    console.error('Update meta lead error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * DELETE /api/meta-leads/:id
 * Delete a Meta lead
 */
router.delete('/:id', auth, checkPermission('leads', 'delete'), async (req, res) => {
  try {
    const lead = await MetaLead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
