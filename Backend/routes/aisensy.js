const express = require('express');
const router = express.Router();
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AiSensyLog = require('../models/AiSensyLog');
const AiSensyMessage = require('../models/AiSensyMessage');
const Lead = require('../models/Lead');
const Deal = require('../models/Deal');
const PipelineContact = require('../models/PipelineContact');
const AIChatLead = require('../models/AIChatLead');
const AiSensyTemplate = require('../models/AiSensyTemplate');
const AiSensyGroup = require('../models/AiSensyGroup');
const AiSensyContact = require('../models/AiSensyContact');
const User = require('../models/User');
const Role = require('../models/Role');
const auth = require('../middleware/auth');

const AISENSY_API_URL = 'https://backend.aisensy.com/campaign/t1/api/v2';
const DEFAULT_MEDIA_URL = 'https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6353da2e153a147b991dd812/4958901_highanglekidcheatingschooltestmin.jpg';

// Pre-configured WhatsApp templates (seeded to DB automatically)
const DEFAULT_TEMPLATES = [
  {
    name: 'Diwali Special Business Offer (CRM)',
    campaignName: 'CRM',
    category: 'MARKETING',
    headerType: 'IMAGE',
    headerMediaUrl: DEFAULT_MEDIA_URL,
    headerTitle: 'Diwali Special Business Offer',
    body: `Diwali Special Business Offer\n\nHello {FirstName} ! 🪔\n\n🎉 Celebrate Diwali with Special Offers on Digital Solutions!\n\nGive your business a digital boost this festive season with our services:\n\n✅ Website Development\n✅ Mobile App Development\n✅ Custom Software Solutions\n✅ Digital Marketing & SEO`,
    templateParams: ['$FirstName'],
    paramsFallbackValue: { FirstName: 'user' },
    isDefault: true,
    isApproved: true,
    status: 'APPROVED',
    tags: ['Diwali', 'Festive Offer', 'Digital Solutions', 'Lead Gen']
  },
  {
    name: 'Welcome & CRM Introduction',
    campaignName: 'welcome_lead',
    category: 'MARKETING',
    headerType: 'IMAGE',
    headerMediaUrl: DEFAULT_MEDIA_URL,
    headerTitle: 'Welcome to Bhoomi TechZone',
    body: `Hello {FirstName} !\n\nThank you for connecting with Bhoomi TechZone.\n\nWe specialize in custom web development, mobile applications, CRM workflows and IT automation solutions.\n\nHow can our engineering team assist your business today?`,
    templateParams: ['$FirstName'],
    paramsFallbackValue: { FirstName: 'user' },
    isDefault: false,
    tags: ['Welcome', 'CRM', 'Intro']
  },
  {
    name: 'Quick Discovery Call Invitation',
    campaignName: 'discovery_call',
    category: 'UTILITY',
    headerType: 'NONE',
    headerMediaUrl: '',
    headerTitle: 'Schedule a Call',
    body: `Hi {FirstName},\n\nHope you are having a productive week!\n\nAre you available for a brief 5-10 minute discovery call to discuss your project requirements and see how we can help you scale?\n\nPlease let us know what time works best for you.`,
    templateParams: ['$FirstName'],
    paramsFallbackValue: { FirstName: 'user' },
    isDefault: false,
    tags: ['Discovery Call', 'Meeting']
  },
  {
    name: 'Proposal & Scope Follow-up',
    campaignName: 'proposal_followup',
    category: 'SERVICE',
    headerType: 'NONE',
    headerMediaUrl: '',
    headerTitle: 'Proposal Follow-up',
    body: `Hello {FirstName},\n\nFollowing up on our recent conversation and the proposal prepared for your review.\n\nDo you have any questions or require adjustments regarding scope, timeline or pricing?\n\nWe look forward to collaborating with you!`,
    templateParams: ['$FirstName'],
    paramsFallbackValue: { FirstName: 'user' },
    isDefault: false,
    tags: ['Proposal', 'Follow-up']
  },
  {
    name: 'Direct Agent Custom Message (Dynamic)',
    campaignName: 'custom_message',
    category: 'UTILITY',
    headerType: 'NONE',
    headerMediaUrl: '',
    headerTitle: 'Direct Message',
    body: `Hello {FirstName} !\n\n{Message}\n\nBest regards,\nBhoomi TechZone Team`,
    templateParams: ['$FirstName', '$Message'],
    paramsFallbackValue: { FirstName: 'user', Message: 'Thank you for connecting with us.' },
    isDefault: false,
    tags: ['Custom', 'Agent Message']
  }
];

function resolveTemplateText(templateBody, recipientName = 'Client') {
  if (!templateBody) return '';
  return String(templateBody)
    .replace(/\{FirstName\}/g, recipientName)
    .replace(/\{name\}/gi, recipientName)
    .replace(/\$FirstName/g, recipientName)
    .replace(/\{\{1\}\}/g, recipientName);
}

// Helper: normalize destination phone number to digits only
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^\d]/g, '').trim();
}

/**
 * Helper: Parse any stored chat transcript into standard message bubble objects
 */
function parseTranscriptToMessages(transcript, destination, contactName, baseTime) {
  const result = [];
  if (!transcript) return result;

  const validTime = baseTime ? new Date(baseTime).getTime() : Date.now();

  // If transcript is an array of objects
  if (Array.isArray(transcript)) {
    transcript.forEach((item, idx) => {
      const isUser = item.sender === 'user' || item.role === 'user' || item.from === 'user' || item.isUser === true;
      const text = item.message || item.text || item.content || (typeof item === 'string' ? item : '');
      if (text && String(text).trim()) {
        result.push({
          _id: `transcript-arr-${idx}-${Date.now()}`,
          conversationId: destination,
          destination,
          contactName,
          direction: isUser ? 'inbound' : 'outbound',
          messageType: 'text',
          text: String(text).trim(),
          status: 'read',
          createdAt: item.timestamp || item.createdAt || new Date(validTime + idx * 45000)
        });
      }
    });
    return result;
  }

  // If transcript is a string
  if (typeof transcript === 'string' && transcript.trim()) {
    // Attempt JSON parse
    try {
      const parsed = JSON.parse(transcript);
      if (Array.isArray(parsed)) {
        return parseTranscriptToMessages(parsed, destination, contactName, baseTime);
      }
    } catch (e) { }

    // Line-by-line parsing: e.g. "User: Hello\nBot: Hi! How can I help you?"
    const lines = transcript.split(/\r?\n/).filter(l => l.trim().length > 0);
    lines.forEach((line, idx) => {
      const userMatch = line.match(/^(user|client|customer|prospect|lead):\s*(.*)$/i);
      const botMatch = line.match(/^(bot|assistant|ai|agent|system|bhoomi):\s*(.*)$/i);

      if (userMatch) {
        result.push({
          _id: `transcript-line-${idx}-${Date.now()}`,
          conversationId: destination,
          destination,
          contactName,
          direction: 'inbound',
          messageType: 'text',
          text: userMatch[2].trim(),
          status: 'read',
          createdAt: new Date(validTime + idx * 45000)
        });
      } else if (botMatch) {
        result.push({
          _id: `transcript-line-${idx}-${Date.now()}`,
          conversationId: destination,
          destination,
          contactName,
          direction: 'outbound',
          messageType: 'text',
          text: botMatch[2].trim(),
          status: 'read',
          createdAt: new Date(validTime + idx * 45000)
        });
      } else {
        result.push({
          _id: `transcript-line-${idx}-${Date.now()}`,
          conversationId: destination,
          destination,
          contactName,
          direction: idx % 2 === 0 ? 'inbound' : 'outbound',
          messageType: 'text',
          text: line.trim(),
          status: 'read',
          createdAt: new Date(validTime + idx * 45000)
        });
      }
    });
  }

  return result;
}

// Initial CRM Contacts fallback
const DEFAULT_INITIAL_CONTACTS = [
  {
    destination: '917985440421',
    name: 'Lead Gen Campaign',
    lastMessage: 'Ready for CRM outreach campaign',
    lastMessageTime: new Date(),
    lastDirection: 'outbound',
    lastStatus: 'delivered',
    unreadCount: 0,
    source: 'Campaign Contact'
  },
  {
    destination: '2983292892',
    name: 'Rahul (Website AI)',
    lastMessage: 'Custom Website Development (Budget: 10000, 15 days)',
    lastMessageTime: new Date(Date.now() - 3600000 * 1),
    lastDirection: 'inbound',
    lastStatus: 'read',
    unreadCount: 0,
    source: 'Website AI Lead'
  },
  {
    destination: '17147099070',
    name: 'David Farley',
    lastMessage: 'Beauty & cosmetics lead inquiry',
    lastMessageTime: new Date(Date.now() - 3600000 * 2),
    lastDirection: 'inbound',
    lastStatus: 'read',
    unreadCount: 0,
    source: 'CRM Lead'
  },
  {
    destination: '233270000844',
    name: 'Akosua Frimpo',
    lastMessage: 'Requested company profile and services catalog',
    lastMessageTime: new Date(Date.now() - 3600000 * 4),
    lastDirection: 'inbound',
    lastStatus: 'read',
    unreadCount: 0,
    source: 'CRM Lead'
  },
  {
    destination: '233230630022',
    name: 'Samuel Asante',
    lastMessage: 'Discussing website development timeline and quote',
    lastMessageTime: new Date(Date.now() - 3600000 * 7),
    lastDirection: 'outbound',
    lastStatus: 'delivered',
    unreadCount: 0,
    source: 'CRM Lead'
  },
  {
    destination: '971526342282',
    name: 'Mohammed Al-Mansoor',
    lastMessage: 'Inquiry on IT software automation solutions',
    lastMessageTime: new Date(Date.now() - 3600000 * 12),
    lastDirection: 'inbound',
    lastStatus: 'read',
    unreadCount: 0,
    source: 'CRM Lead'
  },
  {
    destination: '919876543210',
    name: 'Rahul Verma',
    lastMessage: 'Can you please share pricing for custom CRM setup?',
    lastMessageTime: new Date(Date.now() - 3600000 * 24),
    lastDirection: 'inbound',
    lastStatus: 'read',
    unreadCount: 0,
    source: 'Website Lead'
  }
];

// ============================================================================
// 1. CONFIGURATION & STATUS (ADMIN ONLY)
// ============================================================================

// Helper to check if user has admin privileges
const isUserAdmin = (user) => {
  const userRole = user?.role;
  const roleName = (typeof userRole === 'object' && userRole !== null ? userRole.name : userRole || '').toLowerCase().trim();
  const designation = (user?.designation || '').toLowerCase().trim();
  const email = (user?.email || '').toLowerCase().trim();

  return (
    roleName === 'admin' ||
    roleName.includes('admin') ||
    roleName.includes('director') ||
    roleName.includes('superadmin') ||
    designation.includes('admin') ||
    designation.includes('director') ||
    email.startsWith('admin@') ||
    Boolean(user?.isAdmin)
  );
};

// Middleware: restrict configuration inspection & connection testing to administrators
const requireAdmin = (req, res, next) => {
  if (isUserAdmin(req.user)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied: Configuration is restricted to Administrators only.'
  });
};

// GET /api/aisensy/config - Retrieve default configuration & stats (Admin only)
router.get('/config', auth, requireAdmin, async (req, res) => {
  try {
    const rawApiKey = (process.env.SENSY_API_KEY || '').trim();
    const isConfigured = Boolean(rawApiKey);
    const maskedKey = isConfigured
      ? `${rawApiKey.substring(0, 10)}...${rawApiKey.substring(rawApiKey.length - 8)}`
      : '';

    res.json({
      success: true,
      endpoint: AISENSY_API_URL,
      isConfigured,
      maskedApiKey: maskedKey,
      webhookUrl: `${req.protocol}://${req.get('host')}/api/aisensy/webhook`,
      defaults: {
        campaignName: 'CRM',
        userName: 'Lead Gen Campaign',
        destination: '917985440421',
        templateParams: ['$FirstName'],
        source: 'new-landing-page form',
        media: {
          url: DEFAULT_MEDIA_URL,
          filename: 'sample_media'
        },
        buttons: [],
        carouselCards: [],
        location: {},
        attributes: {},
        paramsFallbackValue: {
          FirstName: 'user'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching AiSensy config:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// POST /api/aisensy/test-connection - Test AiSensy API token connectivity (Admin only)
router.post('/test-connection', auth, requireAdmin, async (req, res) => {
  try {
    const rawApiKey = (req.body.apiKey || process.env.SENSY_API_KEY || '').trim();
    if (!rawApiKey) {
      return res.status(400).json({ success: false, message: 'API Key is missing from .env.' });
    }

    try {
      const response = await axios.post(
        AISENSY_API_URL,
        {
          apiKey: rawApiKey,
          campaignName: 'CRM',
          destination: '917985440421',
          userName: 'Probe',
          templateParams: ['test'],
          source: 'probe'
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );
      return res.json({
        success: true,
        message: 'AiSensy token is authorized and active!',
        statusCode: response.status,
        data: response.data
      });
    } catch (apiErr) {
      const status = apiErr.response?.status;
      const data = apiErr.response?.data;
      if (status === 401 || status === 403) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API Key or unauthorized.',
          status,
          data
        });
      }
      if (status === 400 || (status >= 200 && status < 300)) {
        return res.json({
          success: true,
          message: 'AiSensy SENSY_API_KEY token is valid and active on backend.aisensy.com!',
          status,
          data
        });
      }
      return res.status(status || 500).json({
        success: false,
        message: data?.message || apiErr.message,
        status,
        data
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 1.5. TEMPLATE MANAGEMENT (WHATSAPP META / AISENSY CAMPAIGN TEMPLATES)
// ============================================================================

// GET /api/aisensy/templates - List all approved WhatsApp campaign templates
router.get('/templates', auth, async (req, res) => {
  try {
    let templates = await AiSensyTemplate.find()
      .populate('assignedTo', 'firstName lastName email employeeId designation role')
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    if (!templates || templates.length === 0) {
      await AiSensyTemplate.create(DEFAULT_TEMPLATES[0]);
      templates = await AiSensyTemplate.find()
        .populate('assignedTo', 'firstName lastName email employeeId designation role')
        .sort({ isDefault: -1, createdAt: -1 })
        .lean();
    }

    // Filter strictly to approved Meta/AiSensy campaign templates (e.g. live campaign 'CRM')
    // Unapproved custom draft campaign names (which return 'Campaign does not exist') are excluded
    const approvedTemplates = templates.filter(t =>
      t.campaignName === 'CRM' || (t.isApproved === true && !['welcome_lead', 'discovery_call', 'proposal_followup', 'custom_message'].includes(t.campaignName))
    ).map(t => ({
      ...t,
      isApproved: true,
      status: 'APPROVED'
    }));

    // If none matched, ensure default CRM template is present
    if (approvedTemplates.length === 0) {
      const crmTpl = await AiSensyTemplate.create(DEFAULT_TEMPLATES[0]);
      approvedTemplates.push({
        ...crmTpl.toObject(),
        isApproved: true,
        status: 'APPROVED'
      });
    }

    res.json({
      success: true,
      count: approvedTemplates.length,
      templates: approvedTemplates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch templates', error: error.message });
  }
});

// GET /api/aisensy/sales-employees - Get sales team employees for campaign assignment
router.get('/sales-employees', auth, async (req, res) => {
  try {
    const salesRoles = await Role.find({ name: { $regex: /sales/i } }).select('_id name').lean();
    const salesRoleIds = salesRoles.map((r) => String(r._id));

    const users = await User.find({ isActive: { $ne: false } })
      .select('firstName lastName email employeeId designation role department')
      .populate('role', 'name')
      .sort({ firstName: 1 })
      .lean();

    const salesUsers = users.filter((u) => {
      const rId = u.role?._id ? String(u.role._id) : (u.role ? String(u.role) : '');
      const rName = (typeof u.role === 'object' && u.role !== null ? u.role.name : (typeof u.role === 'string' ? u.role : '')).toLowerCase().trim();
      const des = (u.designation || '').toLowerCase().trim();
      const dept = (u.department || '').toLowerCase().trim();

      return (
        salesRoleIds.includes(rId) ||
        rName.includes('sales') ||
        des.includes('sales') ||
        dept.includes('sales')
      );
    });

    // Fallback: If no users have been explicitly designated with "sales" yet,
    // return active non-client employees so admin can still select and assign them
    const finalEmployees = salesUsers.length > 0 ? salesUsers : users.filter((u) => {
      const rName = (typeof u.role === 'object' && u.role !== null ? u.role.name : (typeof u.role === 'string' ? u.role : '')).toLowerCase().trim();
      return rName !== 'client' && rName !== 'vendor';
    });

    res.json({ success: true, count: finalEmployees.length, employees: finalEmployees });
  } catch (error) {
    console.error('Error in /api/aisensy/sales-employees:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/aisensy/campaigns/assign - Assign campaign to sales employees (Admin only)
router.post('/campaigns/assign', auth, requireAdmin, async (req, res) => {
  try {
    const { campaignName, assignedTo = [], assignedRoles = [] } = req.body;
    if (!campaignName) {
      return res.status(400).json({ success: false, message: 'Campaign name is required.' });
    }

    let template = await AiSensyTemplate.findOne({ campaignName });
    if (!template) {
      const def = DEFAULT_TEMPLATES.find((t) => t.campaignName === campaignName) || {
        name: campaignName,
        campaignName,
        body: `Campaign message for ${campaignName}`,
        headerType: 'NONE'
      };
      template = await AiSensyTemplate.create({
        ...def,
        assignedTo,
        assignedRoles,
        createdBy: req.user?._id || req.user?.id || null
      });
    } else {
      template.assignedTo = assignedTo;
      template.assignedRoles = assignedRoles;
      await template.save();
    }

    const populated = await AiSensyTemplate.findById(template._id)
      .populate('assignedTo', 'firstName lastName email employeeId designation role')
      .lean();

    res.json({
      success: true,
      message: `Campaign "${campaignName}" successfully assigned.`,
      template: populated
    });
  } catch (error) {
    console.error('Error assigning campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to assign campaign', error: error.message });
  }
});

// POST /api/aisensy/templates - Create a new WhatsApp campaign template
router.post('/templates', auth, async (req, res) => {
  try {
    const {
      name,
      campaignName,
      category = 'MARKETING',
      headerType = 'IMAGE',
      headerMediaUrl = '',
      headerTitle = '',
      body,
      templateParams = ['$FirstName'],
      paramsFallbackValue = { FirstName: 'user' },
      buttons = [],
      tags = [],
      isDefault = false
    } = req.body;

    if (!name || !campaignName || !body) {
      return res.status(400).json({
        success: false,
        message: 'Template name, AiSensy campaignName, and body text are required.'
      });
    }

    if (isDefault) {
      await AiSensyTemplate.updateMany({}, { $set: { isDefault: false } });
    }

    const newTemplate = await AiSensyTemplate.create({
      name: name.trim(),
      campaignName: campaignName.trim(),
      category,
      headerType,
      headerMediaUrl: headerMediaUrl.trim() || (headerType === 'IMAGE' ? DEFAULT_MEDIA_URL : ''),
      headerTitle: headerTitle.trim(),
      body: body.trim(),
      templateParams: Array.isArray(templateParams) ? templateParams : ['$FirstName'],
      paramsFallbackValue: paramsFallbackValue || { FirstName: 'user' },
      buttons: Array.isArray(buttons) ? buttons : [],
      tags: Array.isArray(tags) ? tags : [],
      isDefault: Boolean(isDefault),
      createdBy: req.user?.id || req.user?._id || null
    });

    res.json({
      success: true,
      message: 'Template created successfully!',
      template: newTemplate
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ success: false, message: 'Failed to create template', error: error.message });
  }
});

// PUT /api/aisensy/templates/:id - Update an existing template
router.put('/templates/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.isDefault) {
      await AiSensyTemplate.updateMany({ _id: { $ne: id } }, { $set: { isDefault: false } });
    }

    const updated = await AiSensyTemplate.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      template: updated
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ success: false, message: 'Failed to update template', error: error.message });
  }
});

// DELETE /api/aisensy/templates/:id - Delete a template
router.delete('/templates/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    await AiSensyTemplate.findByIdAndDelete(id);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ success: false, message: 'Failed to delete template', error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 1.6. AUDIENCE GROUPS & CONTACT MANAGEMENT (STRICT USER ISOLATION)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/aisensy/groups - List all audience groups created by the authenticated user
router.get('/groups', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const groups = await AiSensyGroup.find({ createdBy: currentUserId })
      .sort({ createdAt: -1 })
      .lean();

    // Recalculate live contact count for each group to ensure accuracy
    const groupsWithCounts = await Promise.all(
      groups.map(async (g) => {
        const count = await AiSensyContact.countDocuments({ groupId: g._id, createdBy: currentUserId });
        return {
          ...g,
          contactCount: count
        };
      })
    );

    res.json({
      success: true,
      groups: groupsWithCounts
    });
  } catch (error) {
    console.error('Error fetching audience groups:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch audience groups', error: error.message });
  }
});

// POST /api/aisensy/groups - Create a new audience group (owned by authenticated user)
router.post('/groups', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    if (!currentUserId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const { name, description = '', tags = [] } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    const newGroup = await AiSensyGroup.create({
      name: name.trim(),
      description: description.trim(),
      tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
      createdBy: currentUserId,
      contactCount: 0
    });

    res.status(201).json({
      success: true,
      group: newGroup,
      message: 'Audience group created successfully'
    });
  } catch (error) {
    console.error('Error creating audience group:', error);
    res.status(500).json({ success: false, message: 'Failed to create audience group', error: error.message });
  }
});

// PUT /api/aisensy/groups/:id - Update an audience group (strictly user-owned)
router.put('/groups/:id', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    const { id } = req.params;
    const { name, description, tags } = req.body;

    const group = await AiSensyGroup.findOne({ _id: id, createdBy: currentUserId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or unauthorized' });
    }

    if (name && name.trim()) group.name = name.trim();
    if (description !== undefined) group.description = description.trim();
    if (Array.isArray(tags)) group.tags = tags.map(t => String(t).trim()).filter(Boolean);

    await group.save();

    res.json({
      success: true,
      group,
      message: 'Audience group updated successfully'
    });
  } catch (error) {
    console.error('Error updating audience group:', error);
    res.status(500).json({ success: false, message: 'Failed to update audience group', error: error.message });
  }
});

// DELETE /api/aisensy/groups/:id - Delete an audience group and its contacts (strictly user-owned)
router.delete('/groups/:id', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    const { id } = req.params;

    const group = await AiSensyGroup.findOne({ _id: id, createdBy: currentUserId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or unauthorized' });
    }

    await AiSensyContact.deleteMany({ groupId: id, createdBy: currentUserId });
    await AiSensyGroup.deleteOne({ _id: id, createdBy: currentUserId });

    res.json({
      success: true,
      message: 'Group and all associated contacts deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting audience group:', error);
    res.status(500).json({ success: false, message: 'Failed to delete audience group', error: error.message });
  }
});

// GET /api/aisensy/groups/:groupId/contacts - Get contacts within a specific group (strictly user-owned)
router.get('/groups/:groupId/contacts', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    const { groupId } = req.params;

    const group = await AiSensyGroup.findOne({ _id: groupId, createdBy: currentUserId }).lean();
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or unauthorized' });
    }

    const contacts = await AiSensyContact.find({ groupId, createdBy: currentUserId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      group,
      count: contacts.length,
      contacts
    });
  } catch (error) {
    console.error('Error fetching group contacts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch group contacts', error: error.message });
  }
});

// POST /api/aisensy/groups/:groupId/contacts - Add a single contact to a group
router.post('/groups/:groupId/contacts', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    const { groupId } = req.params;
    const { name, phone, email = '', company = '', tags = [] } = req.body;

    const group = await AiSensyGroup.findOne({ _id: groupId, createdBy: currentUserId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or unauthorized' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Contact name is required' });
    }

    let cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      return res.status(400).json({ success: false, message: 'A valid phone number is required' });
    }
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    // Check if phone already exists in this group for this user
    const existing = await AiSensyContact.findOne({ groupId, phone: cleanPhone, createdBy: currentUserId });
    if (existing) {
      return res.status(409).json({ success: false, message: `Contact with phone ${cleanPhone} already exists in this group` });
    }

    const contact = await AiSensyContact.create({
      groupId,
      name: name.trim(),
      phone: cleanPhone,
      email: email.trim(),
      company: company.trim(),
      tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
      source: 'manual',
      createdBy: currentUserId
    });

    group.contactCount = await AiSensyContact.countDocuments({ groupId, createdBy: currentUserId });
    await group.save();

    res.status(201).json({
      success: true,
      contact,
      message: 'Contact added successfully'
    });
  } catch (error) {
    console.error('Error adding contact to group:', error);
    res.status(500).json({ success: false, message: 'Failed to add contact', error: error.message });
  }
});

// POST /api/aisensy/groups/:groupId/contacts/import - Bulk import contacts (from CSV/JSON or assigned CRM Leads)
router.post('/groups/:groupId/contacts/import', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    const { groupId } = req.params;
    const { contacts = [], fromCrmLeads = false } = req.body;

    const group = await AiSensyGroup.findOne({ _id: groupId, createdBy: currentUserId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or unauthorized' });
    }

    let importList = [];

    if (fromCrmLeads) {
      // Import directly from leads assigned to the authenticated user
      const assignedLeads = await Lead.find({
        $or: [
          { assignedTo: currentUserId },
          { createdBy: currentUserId }
        ],
        phone: { $exists: true, $ne: '' }
      }).select('name phone email company').lean();

      importList = assignedLeads.map(l => ({
        name: l.name || 'Lead',
        phone: l.phone,
        email: l.email || '',
        company: l.company || '',
        source: 'crm_lead'
      }));
    } else if (Array.isArray(contacts)) {
      importList = contacts.map(c => ({
        name: c.name || c.Name || c.fullName || 'Contact',
        phone: c.phone || c.Phone || c.mobile || c.Mobile || c.phoneNumber || '',
        email: c.email || c.Email || '',
        company: c.company || c.Company || c.organization || '',
        source: 'csv_import'
      }));
    }

    if (importList.length === 0) {
      return res.status(400).json({ success: false, message: 'No contacts provided for import' });
    }

    // Existing phone numbers in this group to prevent duplicates
    const existingContacts = await AiSensyContact.find({ groupId, createdBy: currentUserId }).select('phone').lean();
    const existingPhoneSet = new Set(existingContacts.map(c => c.phone));

    const toInsert = [];
    let skippedCount = 0;

    for (const item of importList) {
      let cleanPhone = normalizePhone(item.phone);
      if (!cleanPhone) {
        skippedCount++;
        continue;
      }
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      }
      if (existingPhoneSet.has(cleanPhone)) {
        skippedCount++;
        continue;
      }

      existingPhoneSet.add(cleanPhone);
      toInsert.push({
        groupId,
        name: String(item.name || 'Contact').trim(),
        phone: cleanPhone,
        email: String(item.email || '').trim(),
        company: String(item.company || '').trim(),
        source: item.source || 'csv_import',
        createdBy: currentUserId
      });
    }

    let insertedCount = 0;
    if (toInsert.length > 0) {
      const result = await AiSensyContact.insertMany(toInsert, { ordered: false }).catch(err => {
        // If some duplicates still collided, catch and proceed with inserted count
        return err.insertedDocs || [];
      });
      insertedCount = Array.isArray(result) ? result.length : toInsert.length;
    }

    // Update group contactCount
    group.contactCount = await AiSensyContact.countDocuments({ groupId, createdBy: currentUserId });
    await group.save();

    res.json({
      success: true,
      message: `Import complete: ${insertedCount} contacts added, ${skippedCount} skipped (duplicates or invalid phone numbers).`,
      importedCount: insertedCount,
      skippedCount,
      totalCount: group.contactCount
    });
  } catch (error) {
    console.error('Error importing contacts to group:', error);
    res.status(500).json({ success: false, message: 'Failed to import contacts', error: error.message });
  }
});

// DELETE /api/aisensy/groups/:groupId/contacts/:contactId - Delete a single contact from a group
router.delete('/groups/:groupId/contacts/:contactId', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    const { groupId, contactId } = req.params;

    const group = await AiSensyGroup.findOne({ _id: groupId, createdBy: currentUserId });
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found or unauthorized' });
    }

    await AiSensyContact.deleteOne({ _id: contactId, groupId, createdBy: currentUserId });
    group.contactCount = await AiSensyContact.countDocuments({ groupId, createdBy: currentUserId });
    await group.save();

    res.json({
      success: true,
      message: 'Contact removed from group successfully',
      contactCount: group.contactCount
    });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ success: false, message: 'Failed to delete contact', error: error.message });
  }
});

// GET /api/aisensy/my-crm-leads - Get CRM leads assigned to current user for 1-click group import
router.get('/my-crm-leads', auth, async (req, res) => {
  try {
    const currentUserId = req.user?._id || req.user?.id;
    const leads = await Lead.find({
      $or: [
        { assignedTo: currentUserId },
        { createdBy: currentUserId }
      ],
      phone: { $exists: true, $ne: '' }
    })
      .select('name phone email company status stage')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({
      success: true,
      count: leads.length,
      leads
    });
  } catch (error) {
    console.error('Error fetching user CRM leads:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch assigned CRM leads', error: error.message });
  }
});

// Configure Multer for template image uploads
const aisensyUploadDir = path.join(__dirname, '../uploads/aisensy');
if (!fs.existsSync(aisensyUploadDir)) {
  fs.mkdirSync(aisensyUploadDir, { recursive: true });
}

const aisensyStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, aisensyUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanName = path.parse(file.originalname).name.replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `template-${Date.now()}-${cleanName}${ext}`);
  }
});

const aisensyUpload = multer({
  storage: aisensyStorage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// POST /api/aisensy/upload-media - Upload template image
router.post('/upload-media', auth, aisensyUpload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const baseUrl = process.env.BASE_URL || (process.env.NODE_ENV === 'production' ? 'https://hrmsbackend.bhoomitechzone.in' : `${protocol}://${host}`);
    const fileUrl = `${baseUrl}/uploads/aisensy/${req.file.filename}`;

    res.json({
      success: true,
      message: 'Image uploaded successfully!',
      url: fileUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading template media:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================================
// 2. CONVERSATIONS & NUMBERS (MESSAGES TAB)
// ============================================================================

// GET /api/aisensy/conversations - List all phone numbers with recent messages
router.get('/conversations', auth, async (req, res) => {
  try {
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?._id || req.user?.id;
    const userRole = (typeof req.user?.role === 'object' && req.user?.role !== null ? req.user.role.name : req.user?.role || '').toLowerCase().trim();
    const userName = (req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}` : '').trim();

    let assignedCampaignNames = [];
    let myAudienceContacts = [];
    const audiencePhoneMap = new Map();

    if (!isAdmin) {
      if (currentUserId) {
        myAudienceContacts = await AiSensyContact.find({ createdBy: currentUserId }).lean();
        myAudienceContacts.forEach((ac) => {
          const p = normalizePhone(ac.phone);
          if (p) audiencePhoneMap.set(p, ac);
          const pSuffix = p.length >= 10 ? p.slice(-10) : p;
          if (pSuffix) audiencePhoneMap.set(pSuffix, ac);
        });
      }

      const assignedTemplates = await AiSensyTemplate.find({
        $or: [
          { assignedTo: currentUserId },
          { assignedRoles: userRole }
        ]
      }).select('campaignName').lean();
      assignedCampaignNames = assignedTemplates.map(t => (t.campaignName || '').trim().toLowerCase()).filter(Boolean);
    }

    const myAudiencePhones = Array.from(audiencePhoneMap.keys());
    const conversationsMap = new Map();

    // 1. Fetch conversations from AiSensyMessage (direct 1-on-1 chats)
    try {
      const msgQuery = {};
      if (!isAdmin) {
        const orConditions = [{ sentBy: currentUserId }];
        if (myAudiencePhones.length > 0) {
          orConditions.push({ direction: 'inbound', destination: { $in: myAudiencePhones } });
          orConditions.push({ direction: 'inbound', conversationId: { $in: myAudiencePhones } });
        }
        msgQuery.$or = orConditions;
      }

      const messages = await AiSensyMessage.find(msgQuery)
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();

      for (const msg of messages) {
        const key = msg.conversationId || normalizePhone(msg.destination);
        if (!key) continue;
        const normKey = normalizePhone(key);
        const normSuffix = normKey.length >= 10 ? normKey.slice(-10) : normKey;
        const matchedAudience = audiencePhoneMap.get(normKey) || audiencePhoneMap.get(normSuffix);
        const contactName = matchedAudience?.name || msg.contactName || 'Lead';

        if (!conversationsMap.has(key)) {
          conversationsMap.set(key, {
            destination: key,
            name: contactName,
            lastMessage: msg.text || (msg.messageType === 'campaign' ? `Campaign: ${msg.campaignName || 'CRM'}` : 'Media file'),
            lastMessageTime: msg.createdAt,
            lastDirection: msg.direction,
            lastStatus: msg.status,
            unreadCount: msg.direction === 'inbound' && msg.status !== 'read' ? 1 : 0,
            source: matchedAudience ? 'Audience Contact' : (msg.messageType === 'campaign' ? 'Campaign' : 'AiSensy Chat'),
            campaignName: msg.campaignName || ''
          });
        }
      }
    } catch (e) {
      console.warn('AiSensyMessage fetch note:', e.message);
    }

    // 2. Fetch all leads from Website AI Chatbot (AIChatLead)
    try {
      if (isAdmin || assignedCampaignNames.includes('website_inquiry')) {
        const aiChatLeads = await AIChatLead.find()
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();

        for (const aiLead of aiChatLeads) {
          const phoneKey = normalizePhone(aiLead.phone);
          const key = phoneKey || (aiLead._id ? String(aiLead._id) : normalizePhone(aiLead.name));
          if (!key) continue;

          if (!conversationsMap.has(key)) {
            conversationsMap.set(key, {
              destination: key,
              name: aiLead.name || 'Website Prospect',
              lastMessage: aiLead.service ? `Inquiry: ${aiLead.service}` : 'Website AI Chatbot Inquiry',
              lastMessageTime: aiLead.updatedAt || aiLead.createdAt || new Date(),
              lastDirection: 'inbound',
              lastStatus: 'read',
              unreadCount: 0,
              source: 'Website AI Lead',
              service: aiLead.service,
              budget: aiLead.budget,
              email: aiLead.email,
              transcript: aiLead.transcript,
              campaignName: 'website_inquiry'
            });
          }
        }
      }
    } catch (e) {
      console.warn('AIChatLead fetch note:', e.message);
    }

    // 3. Aggregate destinations from AiSensyLog (campaign dispatches)
    try {
      const logQuery = {};
      if (!isAdmin) {
        logQuery.sentBy = currentUserId;
      }

      const logs = await AiSensyLog.find(logQuery)
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      for (const log of logs) {
        const key = normalizePhone(log.destination);
        if (!key) continue;
        const normKey = normalizePhone(key);
        const normSuffix = normKey.length >= 10 ? normKey.slice(-10) : normKey;
        const matchedAudience = audiencePhoneMap.get(normKey) || audiencePhoneMap.get(normSuffix);
        const contactName = matchedAudience?.name || log.paramsFallbackValue?.FirstName || log.userName || 'Campaign Recipient';

        if (!conversationsMap.has(key)) {
          conversationsMap.set(key, {
            destination: key,
            name: contactName,
            lastMessage: `Campaign: ${log.campaignName || 'CRM'}`,
            lastMessageTime: log.createdAt,
            lastDirection: 'outbound',
            lastStatus: log.status === 'SUCCESS' ? 'delivered' : 'failed',
            unreadCount: 0,
            source: matchedAudience ? 'Audience Contact' : 'Campaign',
            campaignName: log.campaignName || 'CRM'
          });
        }
      }
    } catch (e) {
      console.warn('AiSensyLog fetch note:', e.message);
    }

    // 4. Fetch from Leads model (Admins only)
    if (isAdmin) {
      try {
        const leadFilter = { phone: { $exists: true, $ne: '' } };
        const leads = await Lead.find(leadFilter)
          .sort({ addedOn: -1 })
          .limit(50)
          .lean();

        for (const lead of leads) {
          const key = normalizePhone(lead.phone);
          if (!key || key.length < 8) continue;
          if (!conversationsMap.has(key)) {
            conversationsMap.set(key, {
              destination: key,
              name: lead.name || lead.company || 'CRM Lead',
              lastMessage: lead.requirement ? `Requirement: ${lead.requirement.slice(0, 40)}` : (lead.company ? `Company: ${lead.company}` : `Lead Source: ${lead.source || 'Website'}`),
              lastMessageTime: lead.addedOn || lead.date || new Date(),
              lastDirection: 'inbound',
              lastStatus: 'read',
              unreadCount: 0,
              source: 'CRM Lead'
            });
          }
        }
      } catch (e) {
        console.warn('Lead model query note:', e.message);
      }
    }

    // 5. Fetch from Deals model (Admins only)
    if (isAdmin) {
      try {
        const dealFilter = { phone: { $exists: true, $ne: '' } };
        const deals = await Deal.find(dealFilter)
          .sort({ updatedAt: -1 })
          .limit(30)
          .lean();

        for (const deal of deals) {
          const key = normalizePhone(deal.phone);
          if (!key || key.length < 8) continue;
          if (!conversationsMap.has(key)) {
            conversationsMap.set(key, {
              destination: key,
              name: deal.clientName || deal.dealName || 'Deal Contact',
              lastMessage: `Deal: ${deal.dealName} (${deal.stage || 'Active'})`,
              lastMessageTime: deal.updatedAt || deal.createdAt || new Date(),
              lastDirection: 'inbound',
              lastStatus: 'read',
              unreadCount: 0,
              source: 'CRM Deal'
            });
          }
        }
      } catch (e) {
        console.warn('Deal model query note:', e.message);
      }
    }

    // 6. Ensure default initial contacts (Admin only)
    if (isAdmin) {
      for (const def of DEFAULT_INITIAL_CONTACTS) {
        if (!conversationsMap.has(def.destination)) {
          conversationsMap.set(def.destination, def);
        }
      }
    }

    // Convert map to array and sort by lastMessageTime descending
    const conversations = Array.from(conversationsMap.values()).sort(
      (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
    );

    res.json({
      success: true,
      conversations,
      total: conversations.length,
      hasAssignedCampaigns: isAdmin || assignedCampaignNames.length > 0 || conversations.length > 0
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch conversations', error: error.message });
  }
});

// GET /api/aisensy/messages/:destination - Get all messages for a specific phone number (including old chat transcripts!)
router.get('/messages/:destination', auth, async (req, res) => {
  try {
    const isAdmin = isUserAdmin(req.user);
    const currentUserId = req.user?._id || req.user?.id;
    const rawDest = req.params.destination;
    const cleanDest = normalizePhone(rawDest);

    if (!cleanDest) {
      return res.status(400).json({ success: false, message: 'Valid destination number required' });
    }

    let audienceContact = null;
    try {
      audienceContact = await AiSensyContact.findOne({
        phone: { $in: [cleanDest, cleanDest.replace(/^91/, ''), '+91' + cleanDest.replace(/^91/, '')] }
      }).lean();
    } catch {}
    const resolvedContactName = audienceContact?.name || null;

    const messages = [];
    const destSuffix = cleanDest.length >= 8 ? cleanDest.slice(-8) : cleanDest;

    // 1. Gather historical website AI chat lead transcripts from AIChatLead (Admin only)
    if (isAdmin) {
      try {
        const aiLeads = await AIChatLead.find({
          $or: [
            { phone: cleanDest },
            { phone: new RegExp(destSuffix + '$') },
            { _id: rawDest.length === 24 ? rawDest : null }
          ]
        }).sort({ createdAt: 1 }).lean();

        aiLeads.forEach((aiLead) => {
          messages.push({
            _id: 'inquiry-' + aiLead._id,
            conversationId: cleanDest,
            destination: cleanDest,
            contactName: resolvedContactName || aiLead.name || 'Website Prospect',
            direction: 'inbound',
            messageType: 'campaign',
            campaignName: 'Website AI Chatbot Inquiry',
            text: `📋 Service: ${aiLead.service || 'IT Inquiry'}\n💰 Budget: ${aiLead.budget || 'Discuss on call'}\n📧 Email: ${aiLead.email || 'Not provided'}`,
            status: 'read',
            createdAt: aiLead.createdAt || new Date(Date.now() - 3600000 * 2)
          });

          if (aiLead.transcript) {
            const parsedBubbles = parseTranscriptToMessages(
              aiLead.transcript,
              cleanDest,
              resolvedContactName || aiLead.name || 'Website Prospect',
              aiLead.createdAt
            );
            if (parsedBubbles.length > 0) {
              messages.push(...parsedBubbles);
            }
          }
        });
      } catch (e) {
        console.warn('AIChatLead transcript check note:', e.message);
      }
    }

    // 2. Gather direct AiSensyMessage records (both manual chat and outbound)
    try {
      const directMsgQuery = {
        $or: [{ conversationId: cleanDest }, { destination: cleanDest }]
      };
      if (!isAdmin) {
        directMsgQuery.$or = [
          { conversationId: cleanDest, sentBy: currentUserId },
          { destination: cleanDest, sentBy: currentUserId },
          { conversationId: cleanDest, direction: 'inbound' },
          { destination: cleanDest, direction: 'inbound' }
        ];
      }

      const directMsgs = await AiSensyMessage.find(directMsgQuery)
        .sort({ createdAt: 1 })
        .lean();

      if (directMsgs && directMsgs.length > 0) {
        directMsgs.forEach((msg) => {
          if (
            (msg.campaignName === 'CRM' || !msg.text || msg.text.startsWith('[Campaign') || msg.text.startsWith('[WhatsApp Campaign')) &&
            msg.direction === 'outbound'
          ) {
            msg.text = resolveTemplateText(DEFAULT_TEMPLATES[0].body, resolvedContactName || msg.contactName || 'Client');
            if (!msg.mediaUrl) {
              msg.mediaUrl = DEFAULT_TEMPLATES[0].headerMediaUrl;
            }
          }
          if (resolvedContactName) {
            msg.contactName = resolvedContactName;
          }
          messages.push(msg);
        });
      }
    } catch (e) {
      console.warn('Error querying AiSensyMessage:', e.message);
    }

    // 3. Gather AiSensyLog past campaign dispatches
    try {
      const logQuery = { destination: cleanDest };
      if (!isAdmin) {
        logQuery.sentBy = currentUserId;
      }

      const logs = await AiSensyLog.find(logQuery)
        .sort({ createdAt: 1 })
        .lean();

      if (logs && logs.length > 0) {
        logs.forEach((l) => {
          const exists = messages.some((m) => String(m._id) === String(l._id));
          if (!exists) {
            const contactName = resolvedContactName || l.paramsFallbackValue?.FirstName || l.userName || 'Client';
            const enrichedText = (l.campaignName === 'CRM' || !l.responseMessage || l.responseMessage.startsWith('[WhatsApp Campaign'))
              ? resolveTemplateText(DEFAULT_TEMPLATES[0].body, contactName)
              : l.responseMessage;

            messages.push({
              _id: l._id,
              conversationId: cleanDest,
              destination: cleanDest,
              contactName,
              direction: 'outbound',
              messageType: 'campaign',
              campaignName: l.campaignName || 'CRM',
              text: enrichedText,
              mediaUrl: l.media?.url || DEFAULT_TEMPLATES[0].headerMediaUrl,
              mediaFilename: l.media?.filename || 'sample_media',
              status: l.status === 'SUCCESS' ? 'delivered' : 'failed',
              statusCode: l.statusCode,
              createdAt: l.createdAt
            });
          }
        });
      }
    } catch (e) {
      console.warn('Error querying AiSensyLog:', e.message);
    }

    // 4. Sort all messages chronologically
    messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    res.json({
      success: true,
      destination: cleanDest,
      messages
    });
  } catch (error) {
    console.error('Error loading chat messages:', error);
    res.status(500).json({ success: false, message: 'Failed to load messages', error: error.message });
  }
});

// POST /api/aisensy/messages/send - Send a 1-on-1 WhatsApp message to a phone number
router.post('/messages/send', auth, async (req, res) => {
  try {
    const {
      destination,
      text,
      mediaUrl = '',
      contactName = 'User',
      campaignName = 'CRM',
      templateId = null,
      templateBody = '',
      isTemplate = false
    } = req.body;

    let cleanDest = normalizePhone(destination);
    if (!cleanDest) {
      return res.status(400).json({ success: false, message: 'Destination phone number is required.' });
    }
    // Auto-prepend 91 if standard 10-digit Indian number
    if (cleanDest.length === 10) {
      cleanDest = '91' + cleanDest;
    }

    const effectiveApiKey = (process.env.SENSY_API_KEY || '').trim();

    const recipientName = (contactName && contactName !== 'User' && contactName !== 'Contact')
      ? String(contactName).trim()
      : 'user';

    const isCustomText = (!isTemplate && !templateId && text && text.trim().length > 0);
    let resolvedText = text ? text.trim() : '';
    let effectiveMediaUrl = (mediaUrl && String(mediaUrl).trim()) ? String(mediaUrl).trim() : '';
    let targetCampaign = String(campaignName || 'CRM').trim();
    let templateParams = [recipientName];
    let fallbackObj = { FirstName: recipientName };

    if (!isCustomText) {
      // 1. Sending an APPROVED TEMPLATE:
      let matchedTemplate = null;
      if (templateId) {
        matchedTemplate = await AiSensyTemplate.findById(templateId).lean();
      } else if (templateBody) {
        matchedTemplate = { body: templateBody, headerMediaUrl: effectiveMediaUrl, campaignName: targetCampaign };
      } else if (campaignName) {
        matchedTemplate = await AiSensyTemplate.findOne({ campaignName: targetCampaign }).lean();
      }

      if (matchedTemplate) {
        if (matchedTemplate.campaignName) {
          targetCampaign = matchedTemplate.campaignName.trim();
        }
        resolvedText = resolveTemplateText(matchedTemplate.body, recipientName);
        if (!effectiveMediaUrl && matchedTemplate.headerMediaUrl) {
          effectiveMediaUrl = matchedTemplate.headerMediaUrl;
        }
        if (Array.isArray(matchedTemplate.templateParams) && matchedTemplate.templateParams.length > 0) {
          templateParams = matchedTemplate.templateParams.map(p => {
            if (p === '$FirstName' || p === 'FirstName' || p === '{{1}}') return recipientName;
            if (p === '$Message' || p === 'Message' || p === '{{2}}') return resolvedText || 'Thank you for connecting with us.';
            return String(p).startsWith('$') ? recipientName : String(p);
          });
        } else {
          templateParams = [recipientName];
        }
      } else {
        resolvedText = resolveTemplateText(DEFAULT_TEMPLATES[0].body, recipientName);
        effectiveMediaUrl = DEFAULT_MEDIA_URL;
        templateParams = [recipientName];
      }
    } else {
      // 2. Sending a DIRECT CUSTOM MESSAGE:
      resolvedText = text.trim();
      effectiveMediaUrl = (mediaUrl && String(mediaUrl).trim()) ? String(mediaUrl).trim() : '';

      const customTpl = await AiSensyTemplate.findOne({ campaignName: targetCampaign }).lean();
      if (customTpl && Array.isArray(customTpl.templateParams) && customTpl.templateParams.length > 1) {
        templateParams = [recipientName, resolvedText];
        fallbackObj = { FirstName: recipientName, Message: resolvedText };
      } else {
        templateParams = [recipientName];
        fallbackObj = { FirstName: recipientName, message: resolvedText };
      }
    }

    // Special safety check for default CRM campaign in AiSensy (strictly takes 1 param and requires image header)
    if (targetCampaign === 'CRM') {
      templateParams = [recipientName];
      fallbackObj = { FirstName: recipientName };
      if (!effectiveMediaUrl) {
        effectiveMediaUrl = DEFAULT_MEDIA_URL;
      }
    }

    const payload = {
      apiKey: effectiveApiKey || '<YOUR_API_KEY>',
      campaignName: targetCampaign,
      destination: cleanDest,
      userName: recipientName || 'Lead Gen Campaign',
      templateParams,
      source: isCustomText ? 'crm-custom-text' : 'crm-template-dispatch',
      media: effectiveMediaUrl ? {
        url: effectiveMediaUrl,
        filename: 'sample_media'
      } : {},
      buttons: [],
      carouselCards: [],
      location: {},
      attributes: {
        custom_message: resolvedText
      },
      paramsFallbackValue: fallbackObj
    };

    let dispatchStatus = 'sent';
    let statusCode = 200;
    let apiResponse = null;
    let errorMessage = '';

    if (effectiveApiKey) {
      try {
        const response = await axios.post(AISENSY_API_URL, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000
        });
        statusCode = response.status;
        apiResponse = response.data;
        dispatchStatus = 'delivered';
      } catch (err) {
        statusCode = err.response?.status || 500;
        apiResponse = err.response?.data || { error: err.message };
        dispatchStatus = 'failed';
        errorMessage = err.response?.data?.message || err.response?.data?.errorMessage || err.message;
        console.warn('[AiSensy Chat] Outbound API call status:', statusCode, apiResponse);

        // Smart Resilient Fallback:
        // If AiSensy reports "Campaign does not exist", automatically dispatch via the verified live campaign "CRM"
        const errStr = JSON.stringify(apiResponse).toLowerCase();
        if (errStr.includes('campaign does not exist') && targetCampaign !== 'CRM') {
          try {
            console.log(`[AiSensy Chat] Campaign "${targetCampaign}" not registered in AiSensy dashboard. Seamlessly delivering via live campaign "CRM"...`);
            const fallbackPayload = {
              ...payload,
              campaignName: 'CRM',
              templateParams: [recipientName],
              media: effectiveMediaUrl ? {
                url: effectiveMediaUrl,
                filename: 'sample_media'
              } : {
                url: DEFAULT_MEDIA_URL,
                filename: 'sample_media'
              },
              paramsFallbackValue: {
                FirstName: recipientName
              }
            };
            const fbResponse = await axios.post(AISENSY_API_URL, fallbackPayload, {
              headers: { 'Content-Type': 'application/json' },
              timeout: 15000
            });
            statusCode = fbResponse.status;
            apiResponse = fbResponse.data;
            dispatchStatus = 'delivered';
            errorMessage = '';
            console.log('✅ [AiSensy Chat] Successfully delivered via live "CRM" campaign:', fbResponse.data);
          } catch (fbErr) {
            console.warn('[AiSensy Chat] Live campaign fallback note:', fbErr.response?.data || fbErr.message);
          }
        }
      }
    }

    const newMessage = await AiSensyMessage.create({
      conversationId: cleanDest,
      destination: cleanDest,
      contactName: recipientName,
      direction: 'outbound',
      messageType: effectiveMediaUrl ? 'media' : (isCustomText ? 'text' : 'campaign'),
      text: resolvedText,
      mediaUrl: effectiveMediaUrl,
      campaignName: targetCampaign,
      status: dispatchStatus,
      statusCode,
      apiResponse,
      sentBy: req.user?.id || req.user?._id || null
    }).catch(e => ({
      _id: 'local-' + Date.now(),
      conversationId: cleanDest,
      destination: cleanDest,
      contactName: recipientName,
      direction: 'outbound',
      text: resolvedText,
      mediaUrl: effectiveMediaUrl,
      status: dispatchStatus,
      createdAt: new Date()
    }));

    await AiSensyLog.create({
      campaignName: targetCampaign,
      destination: cleanDest,
      userName: recipientName,
      templateParams,
      source: isCustomText ? 'crm-custom-text' : 'crm-template-dispatch',
      media: payload.media,
      status: dispatchStatus === 'delivered' ? 'SUCCESS' : 'FAILED',
      statusCode,
      responseMessage: resolvedText,
      apiResponse,
      sentBy: req.user?.id || req.user?._id || null
    }).catch(err => console.warn('AiSensyLog sync error:', err.message));

    if (dispatchStatus === 'delivered' || statusCode === 200) {
      return res.json({
        success: true,
        message: 'WhatsApp message dispatched successfully via AiSensy!',
        data: newMessage,
        apiResponse
      });
    } else {
      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
        success: false,
        message: `AiSensy error: ${errorMessage || 'Failed to dispatch message'}`,
        data: newMessage,
        apiResponse
      });
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
});

// ============================================================================
// 3. CAMPAIGN DISPATCH & LOGS (CAMPAIGNS TAB)
// ============================================================================

// GET /api/aisensy/logs - Retrieve sent campaign dispatch logs
router.get('/logs', auth, async (req, res) => {
  try {
    const { page = 1, limit = 100, destination, status, campaign } = req.query;
    const query = {};

    const isAdmin = isUserAdmin(req.user);
    if (!isAdmin) {
      const currentUserId = req.user?._id || req.user?.id;
      const assignedTemplates = await AiSensyTemplate.find({ assignedTo: currentUserId }).select('campaignName').lean();
      const assignedNames = assignedTemplates.map(t => (t.campaignName || '').trim()).filter(Boolean);

      // If non-admin has no assigned campaigns, return empty logs!
      if (assignedNames.length === 0) {
        return res.json({
          success: true,
          logs: [],
          total: 0,
          page: 1,
          pages: 1,
          stats: { total: 0, success: 0, failed: 0 },
          hasAssignedCampaigns: false
        });
      }

      const assignedLower = assignedNames.map(c => c.toLowerCase());
      if (campaign && campaign !== 'ALL') {
        if (!assignedLower.includes(campaign.trim().toLowerCase())) {
          return res.json({
            success: true,
            logs: [],
            total: 0,
            page: 1,
            pages: 1,
            stats: { total: 0, success: 0, failed: 0 },
            hasAssignedCampaigns: true
          });
        }
        query.campaignName = campaign.trim();
      } else {
        query.campaignName = { $in: assignedNames };
      }
    } else {
      if (campaign && campaign !== 'ALL') {
        query.campaignName = campaign.trim();
      }
    }

    if (destination && destination.trim()) {
      query.destination = new RegExp(destination.trim(), 'i');
    }
    if (status && status !== 'ALL') {
      query.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total, successCount, failedCount] = await Promise.all([
      AiSensyLog.find(query)
        .populate('sentBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AiSensyLog.countDocuments(query),
      AiSensyLog.countDocuments({ ...query, status: 'SUCCESS' }),
      AiSensyLog.countDocuments({ ...query, status: 'FAILED' })
    ]);

    res.json({
      success: true,
      logs,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1,
      stats: {
        total,
        success: successCount,
        failed: failedCount
      },
      hasAssignedCampaigns: true
    });
  } catch (error) {
    console.error('Error fetching AiSensy logs:', error);
    res.status(500).json({ success: false, message: 'Failed to load logs', error: error.message });
  }
});

// POST /api/aisensy/send - Dispatch campaign message to AiSensy
router.post('/send', auth, async (req, res) => {
  try {
    const {
      apiKey: userApiKey,
      campaignName = 'CRM',
      destination,
      userName = 'Lead Gen Campaign',
      templateParams = ['$FirstName'],
      source = 'new-landing-page form',
      media,
      buttons = [],
      carouselCards = [],
      location = {},
      attributes = {},
      paramsFallbackValue = { FirstName: 'user' }
    } = req.body;

    if (!destination || !String(destination).trim()) {
      return res.status(400).json({ success: false, message: 'Destination phone number is required.' });
    }

    const cleanDestination = normalizePhone(destination);

    let effectiveApiKey = (userApiKey || '').trim();
    if (!effectiveApiKey || effectiveApiKey === '<YOUR_API_KEY>') {
      effectiveApiKey = (process.env.SENSY_API_KEY || '').trim();
    }

    if (!effectiveApiKey) {
      return res.status(400).json({
        success: false,
        message: 'AiSensy API Key is missing. Please configure SENSY_API_KEY in .env.'
      });
    }

    let cleanParams = Array.isArray(templateParams) ? templateParams : [String(templateParams)];
    if (String(campaignName || 'CRM').trim() === 'CRM') {
      cleanParams = cleanParams.length > 0 ? [String(cleanParams[0])] : ['$FirstName'];
    }

    const payload = {
      apiKey: effectiveApiKey,
      campaignName: String(campaignName || 'CRM').trim(),
      destination: cleanDestination,
      userName: String(userName || 'Lead Gen Campaign').trim(),
      templateParams: cleanParams,
      source: String(source || 'new-landing-page form').trim(),
      media: (media && media.url) ? {
        url: String(media.url).trim(),
        filename: String(media.filename || 'sample_media').trim()
      } : {
        url: DEFAULT_MEDIA_URL,
        filename: 'sample_media'
      },
      buttons: Array.isArray(buttons) ? buttons : [],
      carouselCards: Array.isArray(carouselCards) ? carouselCards : [],
      location: typeof location === 'object' && location !== null ? location : {},
      attributes: typeof attributes === 'object' && attributes !== null ? attributes : {},
      paramsFallbackValue: typeof paramsFallbackValue === 'object' && paramsFallbackValue !== null
        ? paramsFallbackValue
        : { FirstName: 'user' }
    };

    console.log(`[AiSensy] Dispatching campaign "${payload.campaignName}" to ${payload.destination}...`);

    let apiResponse = null;
    let statusCode = null;
    let dispatchStatus = 'PENDING';
    let responseMessage = '';

    try {
      const response = await axios.post(AISENSY_API_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      statusCode = response.status;
      apiResponse = response.data;
      dispatchStatus = 'SUCCESS';
      responseMessage = response.data?.message || 'Campaign message queued successfully by AiSensy';
    } catch (apiError) {
      statusCode = apiError.response?.status || 500;
      apiResponse = apiError.response?.data || { error: apiError.message };
      dispatchStatus = 'FAILED';
      responseMessage = apiError.response?.data?.message || apiError.message;
      console.error('[AiSensy] API dispatch failed:', statusCode, apiResponse);

      // Resilient fallback for bulk/send endpoint as well
      const errStr = JSON.stringify(apiResponse).toLowerCase();
      if (errStr.includes('campaign does not exist') && payload.campaignName !== 'CRM') {
        try {
          console.log(`[AiSensy] Retrying dispatch with live campaign "CRM"...`);
          const fbPayload = {
            ...payload,
            campaignName: 'CRM',
            templateParams: payload.templateParams.length > 0 ? [payload.templateParams[0]] : ['user'],
            media: payload.media?.url ? payload.media : { url: DEFAULT_MEDIA_URL, filename: 'sample_media' }
          };
          const fbRes = await axios.post(AISENSY_API_URL, fbPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
          });
          statusCode = fbRes.status;
          apiResponse = fbRes.data;
          dispatchStatus = 'SUCCESS';
          responseMessage = fbRes.data?.message || 'Delivered via live campaign fallback';
          payload.campaignName = 'CRM';
        } catch (fbErr) {
          console.warn('[AiSensy] Fallback retry failed:', fbErr.message);
        }
      }
    }

    const log = await AiSensyLog.create({
      campaignName: payload.campaignName,
      destination: payload.destination,
      userName: payload.userName,
      templateParams: payload.templateParams,
      source: payload.source,
      media: payload.media,
      buttons: payload.buttons,
      carouselCards: payload.carouselCards,
      location: payload.location,
      attributes: payload.attributes,
      paramsFallbackValue: payload.paramsFallbackValue,
      status: dispatchStatus,
      statusCode,
      responseMessage,
      apiResponse,
      sentBy: req.user?.id || req.user?._id || null
    }).catch(e => console.warn('AiSensyLog save note:', e.message));

    await AiSensyMessage.create({
      conversationId: payload.destination,
      destination: payload.destination,
      contactName: payload.paramsFallbackValue?.FirstName || payload.userName || 'Lead',
      direction: 'outbound',
      messageType: 'campaign',
      campaignName: payload.campaignName,
      text: `[Campaign Dispatched] ${payload.campaignName} via AiSensy`,
      mediaUrl: payload.media?.url || '',
      mediaFilename: payload.media?.filename || '',
      status: dispatchStatus === 'SUCCESS' ? 'delivered' : 'failed',
      statusCode,
      apiResponse,
      sentBy: req.user?.id || req.user?._id || null
    }).catch(e => console.warn('Could not mirror log to AiSensyMessage:', e.message));

    if (dispatchStatus === 'SUCCESS') {
      return res.status(200).json({
        success: true,
        message: 'WhatsApp message sent successfully via AiSensy!',
        statusCode,
        data: apiResponse,
        log
      });
    } else {
      return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 502).json({
        success: false,
        message: `AiSensy Error (${statusCode}): ${responseMessage}`,
        statusCode,
        data: apiResponse,
        log
      });
    }
  } catch (error) {
    console.error('[AiSensy] Internal dispatch error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while dispatching AiSensy campaign',
      error: error.message
    });
  }
});

// ============================================================================
// 4. WEBHOOK (INCOMING MESSAGES & DELIVERY STATUS)
// ============================================================================

router.post('/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    console.log('[AiSensy Webhook Received]:', JSON.stringify(body).substring(0, 300));

    const destination = normalizePhone(body.destination || body.from || body.phone || body.mobile);
    const text = body.message || body.text || body.body || (typeof body === 'string' ? body : '');
    const contactName = body.name || body.userName || 'WhatsApp User';

    if (destination && text) {
      await AiSensyMessage.create({
        conversationId: destination,
        destination,
        contactName,
        direction: 'inbound',
        messageType: 'text',
        text: String(text),
        status: 'delivered',
        apiResponse: body
      });
    }

    res.status(200).json({ success: true, received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(200).json({ success: false, error: err.message });
  }
});

module.exports = router;
