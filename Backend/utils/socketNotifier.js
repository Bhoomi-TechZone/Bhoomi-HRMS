const Notification = require('../models/Notification');

// Allowed enum types from Notification model
const VALID_TYPES = new Set([
  'Task', 'Leave', 'Attendance', 'Announcement', 'Project', 'General',
  'Deal', 'Contact', 'Company', 'CRM', 'Client', 'Follow-up', 'Followup',
  'Lead', 'Payment', 'Invoice', 'Proposal'
]);

/**
 * Sends a notification by saving it to DB and emitting via Socket.IO
 * 
 * @param {Object} io - The Socket.IO server instance (req.app.get('socketio'))
 * @param {String} userId - The MongoDB ObjectId of the user receiving the notification
 * @param {String} title - Notification title
 * @param {String} message - Notification message body
 * @param {String} type - Notification type (e.g., 'Task', 'Leave', 'Announcement', 'Project', 'Payment')
 * @param {String} link - URL to navigate to when the notification is clicked
 */
const sendNotification = async (io, userId, title, message, type = 'General', link = '') => {
  try {
    const safeType = VALID_TYPES.has(type) ? type : 'General';

    // 1. Save to DB
    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type: safeType,
      link
    });

    // 2. Emit to the specific user's socket room
    if (io) {
      io.to(`user:${userId}`).emit('new-notification', notification);
    }
    
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
};

module.exports = { sendNotification };
