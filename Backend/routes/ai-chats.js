const express = require('express');
const router = express.Router();
const AIChatLead = require('../models/AIChatLead');
const auth = require('../middleware/auth');

/**
 * Helper to process incoming webhook payload
 */
async function processWebhookPayload(req, res) {
  try {
    // 1. Security Check (Secret Key verification)
    const authHeader = req.headers['authorization'];
    const receivedSecret = authHeader
      ? authHeader.replace(/^Bearer\s+/i, '').trim()
      : (req.headers['x-btpl-secret'] || req.headers['x-webhook-secret'] || req.query.secret);

    const EXPECTED_SECRET = process.env.WEBHOOK_SECRET;

    if (!receivedSecret || receivedSecret !== EXPECTED_SECRET) {
      console.warn('⚠️ Webhook Auth Failed: Received secret does not match EXPECTED_SECRET');
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid secret key' });
    }

    // Handle "Test Webhook Connection" ping from WordPress
    if (
      req.body?.test === true ||
      req.body?.action === 'test' ||
      req.body?.ping === true ||
      req.body?.type === 'test' ||
      (Object.keys(req.body || {}).length === 0 && !req.query.test)
    ) {
      console.log('⚡ Webhook Test Connection ping received and verified successfully');
      return res.status(200).json({
        success: true,
        message: 'Connection Successful (HTTP 200) - HRMS Webhook is active and reachable'
      });
    }

    // 2. Extract Data from payload
    const { client, inquiry, chat_transcript, source, session_id } = req.body || {};

    const name = client?.name || req.body?.name || 'Website Prospect';
    const phone = client?.phone || req.body?.phone || '';
    const email = client?.email || req.body?.email || '';
    const service = inquiry?.service_needed || req.body?.service || req.body?.service_needed || 'IT Inquiry';
    const budget = inquiry?.budget_or_timeline || req.body?.budget || req.body?.budget_or_timeline || 'Discuss on call';
    const transcript = chat_transcript || req.body?.transcript || req.body?.chat || '';
    const leadSource = source || req.body?.source || 'Website AI Assistant';
    const sessionId = session_id || req.body?.sessionId || req.body?.session_id || '';

    // 3. Save to Database
    const newLead = await AIChatLead.create({
      name,
      phone,
      email,
      service,
      budget,
      transcript,
      source: leadSource,
      sessionId,
      status: 'New Lead'
    });

    console.log(`✅ New AI Chat Lead captured in HRMS: ${name} (${phone})`);

    // Real-time socket broadcast if available
    try {
      const io = req.app?.get('io') || global.io;
      if (io) {
        io.emit('new-ai-lead', newLead);
      }
    } catch (sockErr) {
      console.error('Socket emit error for new AI lead:', sockErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Lead saved successfully in HRMS',
      leadId: newLead._id
    });
  } catch (error) {
    console.error('HRMS AI Webhook Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WEBHOOK ENDPOINTS (Public, protected by secret key)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', express.json(), processWebhookPayload);
router.get('/webhook', (req, res) => {
  // Helpful status check if developer opens in browser
  res.json({
    status: 'online',
    endpoint: '/api/ai-chats/webhook',
    method: 'POST',
    description: 'Bhoomi HRMS AI Chatbot Webhook Receiver'
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. AI LEADS DASHBOARD API (Protected by HRMS auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ai-chats/leads
 * Fetch all leads captured from the Website AI chatbot
 */
router.get('/leads', auth, async (req, res) => {
  try {
    const { search, status, page = 1, limit = 50 } = req.query;

    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { service: searchRegex },
        { budget: searchRegex },
        { status: searchRegex }
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [leads, totalCount, statsCounts] = await Promise.all([
      AIChatLead.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AIChatLead.countDocuments(query),
      AIChatLead.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ])
    ]);

    // Compute status stats
    const stats = {
      total: await AIChatLead.countDocuments({}),
      newLeads: 0,
      contacted: 0,
      meetingFixed: 0,
      closed: 0
    };

    statsCounts.forEach((s) => {
      const st = (s._id || '').toLowerCase();
      if (st.includes('new')) stats.newLeads += s.count;
      else if (st.includes('contact') || st.includes('call')) stats.contacted += s.count;
      else if (st.includes('meet') || st.includes('proposal')) stats.meetingFixed += s.count;
      else if (st.includes('close') || st.includes('convert')) stats.closed += s.count;
    });

    res.json({
      success: true,
      data: leads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      },
      stats
    });
  } catch (error) {
    console.error('Error fetching AI chat leads:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch AI chat leads', error: error.message });
  }
});

/**
 * PATCH /api/ai-chats/leads/:id/status
 * Update the status / notes of an AI chat lead
 */
router.patch('/leads/:id/status', auth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;

    const lead = await AIChatLead.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!lead) {
      return res.status(404).json({ success: false, message: 'AI lead not found' });
    }

    res.json({ success: true, message: 'Status updated successfully', data: lead });
  } catch (error) {
    console.error('Error updating AI lead status:', error);
    res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
  }
});

/**
 * DELETE /api/ai-chats/leads/:id
 * Delete an AI chat lead
 */
router.delete('/leads/:id', auth, async (req, res) => {
  try {
    const lead = await AIChatLead.findByIdAndDelete(req.params.id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }
    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('Error deleting AI lead:', error);
    res.status(500).json({ success: false, message: 'Failed to delete lead', error: error.message });
  }
});

/**
 * POST /api/ai-chats/test-lead
 * Create a sample test lead directly from UI for testing
 */
router.post('/test-lead', auth, async (req, res) => {
  try {
    const sample = await AIChatLead.create({
      name: req.body.name || 'Sample Client',
      phone: req.body.phone || '+91 98765 43210',
      email: req.body.email || 'sample.client@example.com',
      service: req.body.service || 'Custom ERP & Mobile App',
      budget: req.body.budget || '₹1,50,000',
      status: 'New Lead',
      source: 'Website AI Assistant',
      transcript: req.body.transcript || [
        { sender: 'bot', text: 'Namaste! Welcome to Bhoomi Techzone. How can I assist you with your software requirements today?' },
        { sender: 'user', text: 'Hi, I need a Custom ERP software and a mobile application for our distribution business.' },
        { sender: 'bot', text: 'That sounds great! We specialize in custom ERP development and cross-platform apps. Could you please share your tentative budget and preferred timeline?' },
        { sender: 'user', text: 'Our budget is around ₹1.5 Lakhs and we want to launch within 6-8 weeks.' },
        { sender: 'bot', text: 'Perfect. May I have your name, mobile number, and email so our senior technical consultant can get in touch with you?' },
        { sender: 'user', text: 'My name is Sample Client, phone is 9876543210, email is sample.client@example.com.' },
        { sender: 'bot', text: 'Thank you Sample Client! We have recorded your inquiry. Our team will reach out to you shortly via WhatsApp and call.' }
      ]
    });

    res.status(201).json({ success: true, message: 'Sample lead created', data: sample });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = {
  router,
  processWebhookPayload
};

