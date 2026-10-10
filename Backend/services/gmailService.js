const { google } = require('googleapis');
const WebsiteLead = require('../models/WebsiteLead');

/* ═══════════════════════════════════════════
   Gmail Service — OAuth2 + Email Parser
   for Bhoomi Tech Zone website inquiry leads
═══════════════════════════════════════════ */

// ─── OAuth2 Client ───────────────────────
let oauth2Client = null;

function getOAuth2Client() {
  if (!oauth2Client) {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Gmail OAuth2 credentials not configured in .env');
    }

    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }
  return oauth2Client;
}

/**
 * Generate the Google OAuth consent URL
 */
function getAuthUrl() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const redirectUri = process.env.GMAIL_REDIRECT_URI;
  const scope = encodeURIComponent('https://www.googleapis.com/auth/gmail.readonly');
  return `https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&access_type=offline&prompt=consent`;
}

/**
 * Exchange authorization code for tokens and persist them
 */
async function handleAuthCallback(code) {
  const client = getOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Persist tokens to DB so they survive server restarts
  const mongoose = require('mongoose');
  const GmailToken = getTokenModel();
  await GmailToken.findOneAndUpdate(
    { key: 'gmail_tokens' },
    { key: 'gmail_tokens', tokens, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  return tokens;
}

/**
 * Load persisted tokens and set them on the OAuth2 client.
 * Returns true if tokens were loaded, false otherwise.
 */
async function loadTokens() {
  const client = getOAuth2Client();
  const GmailToken = getTokenModel();
  const doc = await GmailToken.findOne({ key: 'gmail_tokens' });

  if (doc?.tokens) {
    client.setCredentials(doc.tokens);

    // Auto-refresh listener — persist new tokens on refresh
    client.on('tokens', async (newTokens) => {
      const existing = (await GmailToken.findOne({ key: 'gmail_tokens' }))?.tokens || {};
      await GmailToken.findOneAndUpdate(
        { key: 'gmail_tokens' },
        { tokens: { ...existing, ...newTokens }, updatedAt: new Date() },
        { upsert: true }
      );
    });

    return true;
  }
  return false;
}

/**
 * Check if we have valid credentials
 */
async function isAuthenticated() {
  try {
    const loaded = await loadTokens();
    if (!loaded) return false;
    const client = getOAuth2Client();
    const tokenInfo = client.credentials;
    return !!(tokenInfo && tokenInfo.access_token);
  } catch {
    return false;
  }
}

// ─── Helper: Token model (simple key-value) ───
let _tokenModel = null;
function getTokenModel() {
  if (_tokenModel) return _tokenModel;
  const mongoose = require('mongoose');

  // Avoid recompiling if already registered
  if (mongoose.models.GmailToken) {
    _tokenModel = mongoose.models.GmailToken;
    return _tokenModel;
  }

  const schema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    tokens: { type: Object },
    updatedAt: { type: Date, default: Date.now }
  });
  _tokenModel = mongoose.model('GmailToken', schema);
  return _tokenModel;
}

// ─── Email Parsing ───────────────────────

/**
 * Parse the email body (plain text or HTML) to extract lead fields.
 * Handles the Bhoomi Tech Zone website form emails:
 *   Full Name / Email / Mobile / Project Type / Description
 */
function parseLeadFromEmail(body, subject) {
  const text = body
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[^>]+(>|$)/g, '')   // strip HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  const get = (label) => {
    // Match "Label:" followed by the value (up to the next label or end)
    const regex = new RegExp(label + '\\s*:\\s*(.+?)(?=\\n\\s*(?:Full Name|Email|Mobile|Project Type|Description|Bhoomi Tech|Received)\\s*:|$)', 'is');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const name = get('Full Name');
  const email = get('Email');
  const phone = get('Mobile');
  const projectType = get('Project Type');
  const description = get('Description');

  // Detect form source from subject or body
  let formSource = 'Website';
  if (subject) {
    const formMatch = subject.match(/\(([^)]+Form)\)/i);
    if (formMatch) formSource = formMatch[1];
  }
  if (formSource === 'Website') {
    const bodyFormMatch = text.match(/Bhoomi Tech Zone\s*[-–—]\s*(.+?Form)/i);
    if (bodyFormMatch) formSource = bodyFormMatch[1];
  }

  return { name, email, phone, projectType, description, formSource };
}

// ─── Gmail Fetch & Sync ─────────────────

/**
 * Fetch lead emails from Gmail and store new ones in DB.
 * @param {number} maxResults  Max emails to fetch per call (default 20)
 * @returns {{ total, newCount, skipped, errors }}
 */
async function syncLeadsFromGmail(maxResults = 20) {
  const loaded = await loadTokens();
  if (!loaded) throw new Error('Gmail not authenticated. Please login via /api/website-leads/auth');

  const client = getOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth: client });

  // Query: emails from website forms with "New Project Inquiry" in subject
  const query = 'subject:"New Project Inquiry" from:bhoomitechzone';

  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: query,
  });

  const messages = listResponse.data.messages || [];

  let newCount = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of messages) {
    try {
      // Skip if already synced
      const exists = await WebsiteLead.findOne({ gmailMessageId: msg.id });
      if (exists) { skipped++; continue; }

      const full = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      const headers = full.data.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject');
      const dateStr = getHeader('Date');

      // Extract body
      let body = '';
      const payload = full.data.payload;
      if (payload.parts) {
        // Prefer HTML, fallback to plain text
        const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
        const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
        const part = htmlPart || textPart;
        if (part?.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      } else if (payload.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      }

      if (!body) {
        // fallback to snippet
        body = full.data.snippet || '';
      }

      const parsed = parseLeadFromEmail(body, subject);

      // Only save if we extracted at least a name or email or phone
      if (!parsed.name && !parsed.email && !parsed.phone) {
        skipped++;
        continue;
      }

      await WebsiteLead.create({
        gmailMessageId: msg.id,
        threadId: msg.threadId || '',
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        projectType: parsed.projectType,
        description: parsed.description,
        formSource: parsed.formSource,
        emailSubject: subject,
        emailDate: dateStr ? new Date(dateStr) : new Date(),
        rawSnippet: (full.data.snippet || '').substring(0, 500),
        status: 'New',
        syncedAt: new Date()
      });

      newCount++;
    } catch (err) {
      console.error(`Error processing Gmail message ${msg.id}:`, err.message);
      errors++;
    }
  }

  return { total: messages.length, newCount, skipped, errors };
}

module.exports = {
  getAuthUrl,
  handleAuthCallback,
  loadTokens,
  isAuthenticated,
  syncLeadsFromGmail,
  parseLeadFromEmail,
};
