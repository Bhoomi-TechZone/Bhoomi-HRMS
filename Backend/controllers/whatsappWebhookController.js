const crypto = require('crypto');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const WhatsAppConnection = require('../models/WhatsAppConnection');
const WhatsAppConversation = require('../models/WhatsAppConversation');
const WhatsAppWebhookEvent = require('../models/WhatsAppWebhookEvent');
const PipelineContact = require('../models/PipelineContact');
const Lead = require('../models/Lead');
const Deal = require('../models/Deal');

/**
 * Verify HMAC SHA-256 signature from Meta
 * Meta passes signature in header 'x-hub-signature-256' in format 'sha256=<hash>'
 */
function verifyMetaSignature(req) {
  const metaAppSecret = process.env.META_APP_SECRET;

  // If META_APP_SECRET is not configured or left as placeholder, allow in dev/staging with a warning
  if (!metaAppSecret || metaAppSecret === 'your_meta_app_secret') {
    console.warn('[WhatsApp Webhook] META_APP_SECRET is not configured. Skipping HMAC signature verification for development.');
    return true;
  }

  const signatureHeader = req.headers['x-hub-signature-256'];
  if (!signatureHeader) {
    console.error('[WhatsApp Webhook] Missing x-hub-signature-256 header.');
    return false;
  }

  try {
    // Prefer the raw request body buffer if captured by express.json verify hook
    const payload = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body));
    const hmac = crypto.createHmac('sha256', metaAppSecret);
    hmac.update(payload);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const actualBuffer = Buffer.from(signatureHeader, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      console.error('[WhatsApp Webhook] Signature length mismatch.');
      return false;
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    if (!isValid) {
      console.error('[WhatsApp Webhook] HMAC SHA-256 signature verification failed.');
    }
    return isValid;
  } catch (err) {
    console.error('[WhatsApp Webhook] Error during signature calculation:', err.message);
    return false;
  }
}

/**
 * Helper to match incoming phone number with existing CRM records:
 * PipelineContact, Lead, and Deal.
 */
async function findCrmAssociations(phoneNumber) {
  const associations = {
    contactId: null,
    leadId: null,
    dealId: null,
    matchedEntity: null
  };

  if (!phoneNumber) return associations;

  try {
    const cleanDigits = String(phoneNumber).replace(/\D/g, '');
    const last10 = cleanDigits.slice(-10);
    const regex10 = last10.length === 10 ? new RegExp(`${last10}$`) : null;

    // Build matching query for phone variations
    const phoneQueries = [{ phone: phoneNumber }, { phone: `+${cleanDigits}` }, { phone: cleanDigits }];
    if (regex10) {
      phoneQueries.push({ phone: regex10 });
    }

    // 1. Search PipelineContact
    const contact = await PipelineContact.findOne({ $or: phoneQueries }).select('_id firstName lastName email phone');
    if (contact) {
      associations.contactId = contact._id;
      associations.matchedEntity = contact;
    }

    // 2. Search Lead
    const lead = await Lead.findOne({ $or: phoneQueries }).select('_id name email phone company');
    if (lead) {
      associations.leadId = lead._id;
      if (!associations.matchedEntity) associations.matchedEntity = lead;
    }

    // 3. Search Deal
    const dealQuery = [{ phone: phoneNumber }, { phone: `+${cleanDigits}` }, { phone: cleanDigits }];
    if (regex10) {
      dealQuery.push({ phone: regex10 });
    }
    if (associations.leadId) {
      dealQuery.push({ relatedLead: associations.leadId });
    }
    const deal = await Deal.findOne({ $or: dealQuery }).select('_id dealName clientName phone stage activities');
    if (deal) {
      associations.dealId = deal._id;
    }
  } catch (err) {
    console.warn('[WhatsApp Webhook] Error resolving CRM associations:', err.message);
  }

  return associations;
}

/**
 * 1. Webhook Verification (GET /api/webhooks/whatsapp/integration)
 * Meta verifies the endpoint by sending GET request with query params:
 * hub.mode, hub.verify_token, hub.challenge
 */
exports.verifyWebhook = (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

    console.log(`[WhatsApp Webhook Verification] Received mode: "${mode}", token: "${token ? '***' : 'none'}"`);

    // Validate parameters
    if (mode === 'subscribe' && token && expectedToken && token === expectedToken) {
      if (challenge) {
        console.log('✅ [WhatsApp Webhook] Verification SUCCESSFUL. Returning challenge.');
        // Return EXACT challenge as plain text HTTP 200 (NOT JSON)
        res.setHeader('Content-Type', 'text/plain');
        return res.status(200).send(challenge);
      } else {
        console.warn('⚠️ [WhatsApp Webhook] Missing hub.challenge parameter.');
        return res.status(400).send('Bad Request: Missing challenge parameter');
      }
    } else {
      console.error('❌ [WhatsApp Webhook] Verification FAILED. Token mismatch or invalid mode.');
      return res.status(403).send('Forbidden: Verification token mismatch');
    }
  } catch (err) {
    console.error('❌ [WhatsApp Webhook Verification Error]:', err);
    return res.status(500).send('Internal Server Error during verification');
  }
};

/**
 * 2. Process an individual incoming message from Meta
 */
async function processIncomingMessage(msg, metadata, contactMap, wabaId, io) {
  const wamid = msg.id;
  if (!wamid) return;

  // Idempotency: Check if message is already stored
  const existing = await WhatsAppMessage.findOne({ wamid });
  if (existing) {
    console.log(`[WhatsApp Webhook] Message ${wamid} already processed. Skipping duplicate.`);
    return existing;
  }

  const senderWaId = msg.from;
  const contactName = (contactMap && contactMap[senderWaId]) ? contactMap[senderWaId] : 'WhatsApp User';
  const displayPhoneNumber = metadata.display_phone_number || '';
  const phoneNumberId = metadata.phone_number_id || '';

  // Parse timestamp (Meta sends Unix timestamp in seconds)
  const timestamp = msg.timestamp ? new Date(parseInt(msg.timestamp, 10) * 1000) : new Date();

  // Parse message content based on type
  const messageType = msg.type || 'text';
  let messageText = '';
  const mediaData = {
    id: '',
    mimeType: '',
    sha256: '',
    caption: '',
    filename: '',
    url: '',
    localPath: ''
  };
  const locationData = { latitude: null, longitude: null, name: '', address: '' };
  const interactiveData = { type: '', buttonId: '', buttonTitle: '', listId: '', listTitle: '', listDescription: '' };
  const buttonData = { text: '', payload: '' };
  const reactionData = { messageId: '', emoji: '' };

  switch (messageType) {
    case 'text':
      messageText = (msg.text && msg.text.body) ? msg.text.body : '';
      break;

    case 'image':
      if (msg.image) {
        mediaData.id = msg.image.id || '';
        mediaData.mimeType = msg.image.mime_type || '';
        mediaData.sha256 = msg.image.sha256 || '';
        mediaData.caption = msg.image.caption || '';
        messageText = msg.image.caption || '[Image received]';
      }
      break;

    case 'video':
      if (msg.video) {
        mediaData.id = msg.video.id || '';
        mediaData.mimeType = msg.video.mime_type || '';
        mediaData.sha256 = msg.video.sha256 || '';
        mediaData.caption = msg.video.caption || '';
        messageText = msg.video.caption || '[Video received]';
      }
      break;

    case 'audio':
      if (msg.audio) {
        mediaData.id = msg.audio.id || '';
        mediaData.mimeType = msg.audio.mime_type || '';
        mediaData.sha256 = msg.audio.sha256 || '';
        messageText = '[Voice note / Audio message]';
      }
      break;

    case 'document':
      if (msg.document) {
        mediaData.id = msg.document.id || '';
        mediaData.mimeType = msg.document.mime_type || '';
        mediaData.sha256 = msg.document.sha256 || '';
        mediaData.filename = msg.document.filename || '';
        mediaData.caption = msg.document.caption || '';
        messageText = msg.document.filename
          ? `[Document: ${msg.document.filename}]`
          : '[Document received]';
      }
      break;

    case 'location':
      if (msg.location) {
        locationData.latitude = msg.location.latitude;
        locationData.longitude = msg.location.longitude;
        locationData.name = msg.location.name || '';
        locationData.address = msg.location.address || '';
        messageText = locationData.name
          ? `[Location: ${locationData.name} - ${locationData.address}]`
          : `[Location: Lat ${locationData.latitude}, Long ${locationData.longitude}]`;
      }
      break;

    case 'interactive':
      if (msg.interactive) {
        interactiveData.type = msg.interactive.type || '';
        if (msg.interactive.button_reply) {
          interactiveData.buttonId = msg.interactive.button_reply.id || '';
          interactiveData.buttonTitle = msg.interactive.button_reply.title || '';
          messageText = msg.interactive.button_reply.title || '[Button Reply]';
        } else if (msg.interactive.list_reply) {
          interactiveData.listId = msg.interactive.list_reply.id || '';
          interactiveData.listTitle = msg.interactive.list_reply.title || '';
          interactiveData.listDescription = msg.interactive.list_reply.description || '';
          messageText = msg.interactive.list_reply.title || '[List Reply]';
        }
      }
      break;

    case 'button':
      if (msg.button) {
        buttonData.text = msg.button.text || '';
        buttonData.payload = msg.button.payload || '';
        messageText = msg.button.text || '[Quick Reply]';
      }
      break;

    case 'reaction':
      if (msg.reaction) {
        reactionData.messageId = msg.reaction.message_id || '';
        reactionData.emoji = msg.reaction.emoji || '';
        messageText = reactionData.emoji ? `[Reaction: ${reactionData.emoji}]` : '[Reaction]';
      }
      break;

    case 'contacts':
      messageText = '[Contact Card shared]';
      break;

    default:
      messageText = `[${messageType} message]`;
      break;
  }

  // Find CRM Associations
  const crm = await findCrmAssociations(senderWaId);

  // Look up mapped WhatsAppConnection by phoneNumberId
  let connection = null;
  if (phoneNumberId) {
    connection = await WhatsAppConnection.findOne({ phoneNumberId });
  }

  // Find or update WhatsAppConversation for this Deal / phone
  let conversation = null;
  if (crm.dealId) {
    conversation = await WhatsAppConversation.findOne({ dealId: crm.dealId });
  }
  if (!conversation && senderWaId) {
    conversation = await WhatsAppConversation.findOne({ contactPhone: new RegExp(`${senderWaId.slice(-10)}$`) });
  }

  if (conversation) {
    conversation.lastMessage = messageText;
    conversation.lastMessageAt = timestamp;
    conversation.lastMessageDirection = 'inbound';
    conversation.lastMessageStatus = 'received';
    conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    await conversation.save();
  }

  // Construct WhatsAppMessage document
  const newMessage = new WhatsAppMessage({
    wamid,
    wabaId: wabaId || '',
    phoneNumberId,
    displayPhoneNumber,
    direction: 'inbound',
    from: senderWaId,
    to: displayPhoneNumber || phoneNumberId,
    contactName,
    messageType,
    text: messageText,
    media: mediaData,
    location: locationData,
    interactive: interactiveData,
    button: buttonData,
    reaction: reactionData,
    status: 'received',
    statusHistory: [
      {
        status: 'received',
        timestamp,
        recipientId: displayPhoneNumber || phoneNumberId,
        errorDetails: [],
        raw: { type: messageType }
      }
    ],
    timestamp,
    associatedContact: crm.contactId,
    associatedLead: crm.leadId,
    associatedDeal: crm.dealId,
    conversationId: conversation?._id || null,
    connectionId: connection?._id || null,
    dealOwner: conversation?.dealOwner || connection?.employeeName || '',
    rawPayload: msg
  });

  const saved = await newMessage.save();
  console.log(`✅ [WhatsApp Webhook] Inbound message saved: ${wamid} from ${senderWaId} (${contactName})`);

  // If associated with a Deal, append incoming communication activity to the Deal's activities log
  if (crm.dealId) {
    try {
      await Deal.findByIdAndUpdate(crm.dealId, {
        $push: {
          activities: {
            type: 'whatsapp',
            title: `WhatsApp Message from ${contactName}`,
            content: messageText,
            remarks: `Received via WhatsApp Cloud API (${senderWaId})`,
            createdAt: timestamp,
            createdBy: contactName || 'WhatsApp User'
          }
        }
      });
    } catch (dealErr) {
      console.warn('[WhatsApp Webhook] Could not append activity to Deal:', dealErr.message);
    }
  }

  // Emit Socket.IO event for real-time frontend chat updates
  if (io) {
    io.emit('whatsapp:new_message', {
      wamid,
      from: senderWaId,
      contactName,
      text: messageText,
      messageType,
      media: mediaData,
      location: locationData,
      interactive: interactiveData,
      timestamp,
      associatedContact: crm.contactId,
      associatedLead: crm.leadId,
      associatedDeal: crm.dealId
    });
  }

  return saved;
}

/**
 * 3. Process an individual status update from Meta
 * Status values: 'sent', 'delivered', 'read', 'failed'
 */
async function processStatusUpdate(statusObj, io) {
  const wamid = statusObj.id;
  const status = statusObj.status; // sent | delivered | read | failed
  if (!wamid || !status) return;

  const timestamp = statusObj.timestamp
    ? new Date(parseInt(statusObj.timestamp, 10) * 1000)
    : new Date();

  const recipientId = statusObj.recipient_id || '';
  const errors = statusObj.errors || [];

  try {
    const updated = await WhatsAppMessage.findOneAndUpdate(
      { wamid },
      {
        $set: { status },
        $push: {
          statusHistory: {
            status,
            timestamp,
            recipientId,
            errorDetails: errors,
            raw: statusObj
          }
        }
      },
      { new: true }
    );

    if (updated) {
      console.log(`✅ [WhatsApp Webhook] Updated message status: ${wamid} -> ${status}`);
      if (io) {
        io.emit('whatsapp:status_update', {
          wamid,
          status,
          recipientId,
          timestamp
        });
      }
    } else {
      console.log(`[WhatsApp Webhook] Message ${wamid} not found in database for status "${status}". Logging transition.`);
    }
  } catch (err) {
    console.error(`[WhatsApp Webhook] Error updating status for ${wamid}:`, err.message);
  }
}

/**
 * 4. Main Event Receiver (POST /api/webhooks/whatsapp/integration)
 */
exports.handleWebhookEvent = async (req, res) => {
  // 1. Signature Verification
  if (!verifyMetaSignature(req)) {
    return res.status(403).send('Forbidden: Invalid HMAC Signature');
  }

  // 2. Immediate 200 OK Response to Meta (Meta requires fast 200 response to avoid retries)
  res.status(200).send('EVENT_RECEIVED');

  // 3. Asynchronously Process Payload
  setImmediate(async () => {
    try {
      const body = req.body;
      if (!body || body.object !== 'whatsapp_business_account' && !body.entry) {
        console.warn('[WhatsApp Webhook] Received non-WhatsApp payload or unexpected object type.');
        return;
      }

      // Record Raw Webhook Event in Audit Collection
      try {
        await WhatsAppWebhookEvent.create({
          eventId: `evt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          eventType: body.entry?.[0]?.changes?.[0]?.value?.messages ? 'message' : 'status',
          wabaId: body.entry?.[0]?.id || '',
          phoneNumberId: body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || '',
          payload: body,
          processed: true
        });
      } catch (logErr) {
        console.warn('[WhatsApp Webhook] Could not save raw webhook event:', logErr.message);
      }

      const io = req.app.get('socketio');

      for (const entry of body.entry || []) {
        const wabaId = entry.id || '';
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value || {};
          const metadata = value.metadata || {};

          // Build contact lookup map by wa_id
          const contactMap = {};
          if (Array.isArray(value.contacts)) {
            value.contacts.forEach((contact) => {
              if (contact.wa_id) {
                contactMap[contact.wa_id] = contact.profile ? contact.profile.name : 'WhatsApp User';
              }
            });
          }

          // A. Process Inbound Messages
          if (Array.isArray(value.messages)) {
            for (const msg of value.messages) {
              try {
                await processIncomingMessage(msg, metadata, contactMap, wabaId, io);
              } catch (msgErr) {
                console.error(`[WhatsApp Webhook] Error processing message ${msg.id}:`, msgErr);
              }
            }
          }

          // B. Process Outbound Status Updates (sent, delivered, read, failed)
          if (Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              try {
                await processStatusUpdate(statusObj, io);
              } catch (statusErr) {
                console.error(`[WhatsApp Webhook] Error processing status ${statusObj.id}:`, statusErr);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('[WhatsApp Webhook] Unexpected error in async payload processing:', err);
    }
  });
};

/**
 * 5. GET /api/webhooks/whatsapp/messages
 * Utility endpoint to query stored WhatsApp messages for CRM UI
 */
exports.getMessages = async (req, res) => {
  try {
    const { phone, leadId, dealId, contactId, limit = 50, page = 1 } = req.query;

    const filter = {};
    if (phone) {
      const clean = String(phone).replace(/\D/g, '');
      const last10 = clean.slice(-10);
      filter.$or = [
        { from: phone },
        { to: phone },
        { from: clean },
        { to: clean },
        { from: new RegExp(`${last10}$`) },
        { to: new RegExp(`${last10}$`) }
      ];
    }
    if (leadId) filter.associatedLead = leadId;
    if (dealId) filter.associatedDeal = dealId;
    if (contactId) filter.associatedContact = contactId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [messages, total] = await Promise.all([
      WhatsAppMessage.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .lean(),
      WhatsAppMessage.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / limit),
      messages
    });
  } catch (err) {
    console.error('[WhatsApp Webhook] getMessages error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve messages' });
  }
};

/**
 * 6. GET /api/webhooks/whatsapp/config
 * Return current configuration & webhook registration details for the UI
 */
exports.getConfig = (req, res) => {
  try {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.get('host') || '127.0.0.1:5000';
    const baseUrl = `${protocol}://${host}`;

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || '';
    const hasAppSecret = Boolean(process.env.META_APP_SECRET && process.env.META_APP_SECRET !== 'your_meta_app_secret');
    const hasAccessToken = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_ACCESS_TOKEN !== 'your_meta_system_user_access_token');
    const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

    return res.status(200).json({
      success: true,
      data: {
        callbackUrl: `${baseUrl}/api/webhooks/whatsapp/integration`,
        verifyToken,
        hasAppSecret,
        hasAccessToken,
        apiVersion,
        status: 'Active',
        subscribedFields: ['messages', 'message_deliveries', 'message_reads', 'message_echoes'],
        routes: {
          whatsappWebhook: '/api/webhooks/whatsapp/integration',
          whatsappMessages: '/api/webhooks/whatsapp/messages',
          instagramWebhook: '/api/webhooks/instagram',
          aiSensyWebhook: '/api/aisensy/webhook',
          aiChatWebhook: '/api/ai-chats/webhook'
        }
      }
    });
  } catch (err) {
    console.error('[WhatsApp Webhook] getConfig error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve webhook config' });
  }
};

/**
 * 7. POST /api/webhooks/whatsapp/test-handshake
 * Simulate Meta's GET verification handshake to verify token configuration
 */
exports.testHandshake = (req, res) => {
  try {
    const { token, challenge = 'test_challenge_' + Math.floor(Math.random() * 100000) } = req.body;
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (token && expectedToken && token === expectedToken) {
      return res.status(200).json({
        success: true,
        message: 'Verification handshake SUCCESSFUL! Meta will receive HTTP 200 with challenge.',
        challenge
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Verification FAILED: Token mismatch. Provided token does not match WHATSAPP_VERIFY_TOKEN.'
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
