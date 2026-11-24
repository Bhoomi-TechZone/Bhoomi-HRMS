const express = require('express');
const router = express.Router();
const whatsappMultiUserController = require('../controllers/whatsappMultiUserController');
const whatsappWebhookController = require('../controllers/whatsappWebhookController');

// Optional auth helper to decode user if token is sent
let authMiddleware = (req, res, next) => next();
try {
  const auth = require('../middleware/auth');
  if (auth) {
    authMiddleware = (req, res, next) => {
      // If authorization header exists, authenticate; otherwise proceed as guest/internal
      if (req.headers.authorization) {
        return auth(req, res, next);
      }
      return next();
    };
  }
} catch (err) {
  console.warn('Auth middleware not loaded for WhatsApp routes, using passthrough:', err.message);
}

// 1. GET /api/whatsapp/connect - Start Meta authorization
router.get('/connect', authMiddleware, whatsappMultiUserController.getConnectUrl);

// 2. GET /api/whatsapp/callback - Handle OAuth/Embedded Signup callback
router.get('/callback', whatsappMultiUserController.handleCallback);

// 3. POST /api/whatsapp/connect/complete - Save connected WhatsApp account
router.post('/connect/complete', authMiddleware, whatsappMultiUserController.saveConnection);

// 3.1. GET /api/whatsapp/company-numbers - Get available company WhatsApp Business numbers
router.get('/company-numbers', authMiddleware, whatsappMultiUserController.getCompanyNumbers);

// 3.2. POST /api/whatsapp/verify-and-connect - Verify and connect company WhatsApp number for salesperson
router.post('/verify-and-connect', authMiddleware, whatsappMultiUserController.verifyAndConnectNumber);

// 4. GET /api/whatsapp/connections - Get connected numbers
router.get('/connections', authMiddleware, whatsappMultiUserController.getConnections);

// 5. GET /api/whatsapp/connections/me - Get logged-in salesperson's number
router.get('/connections/me', authMiddleware, whatsappMultiUserController.getMyConnection);

// 6. DELETE /api/whatsapp/connections/:id - Disconnect a number
router.delete('/connections/:id', authMiddleware, whatsappMultiUserController.disconnectConnection);

// 7. GET /api/whatsapp/conversations/:dealId - Fetch deal conversation & mapped number
router.get('/conversations/:dealId', authMiddleware, whatsappMultiUserController.getDealConversation);

// 8. POST /api/whatsapp/messages/send - Send WhatsApp message using employee's phone number ID
router.post('/messages/send', authMiddleware, whatsappMultiUserController.sendMessage);

// 9. GET /api/whatsapp/messages/:conversationId - Fetch message history
router.get('/messages/:conversationId', authMiddleware, whatsappMultiUserController.getMessageHistory);

// 10. Webhook aliases under /api/whatsapp/webhook as well as /api/webhooks/whatsapp/integration
router.get('/webhook', whatsappWebhookController.verifyWebhook);
router.post('/webhook', whatsappWebhookController.handleWebhookEvent);

module.exports = router;
