const Notification = require('../models/Notification');

// Allowed enum types from Notification model
const VALID_TYPES = new Set([
  'Task', 'Leave', 'Attendance', 'Announcement', 'Project', 'General',
  'Deal', 'Contact', 'Company', 'CRM', 'Client', 'Follow-up', 'Followup',
  'Lead', 'Payment', 'Invoice', 'Proposal', 'Birthday'
]);

/**
 * Sends a notification by saving it to DB and emitting via Socket.IO.
 * Includes comprehensive deduplication guards to prevent double notifications.
 * 
 * @param {Object} io - The Socket.IO server instance (req.app.get('socketio'))
 * @param {String} userId - The MongoDB ObjectId of the user receiving the notification
 * @param {String} title - Notification title
 * @param {String} message - Notification message body
 * @param {String} type - Notification type (e.g., 'Task', 'Leave', 'Announcement', 'Project', 'Payment', 'Birthday')
 * @param {String} link - URL to navigate to when the notification is clicked
 */
const sendNotification = async (io, userId, title, message, type = 'General', link = '') => {
  try {
    if (!userId) return null;
    const safeType = VALID_TYPES.has(type) ? type : 'General';
    const userIdStr = userId.toString();

    // ── Deduplication Guard 1: Birthday Notifications ─────────────────────────────
    // Strictly max 1 birthday wish or alert per recipient per day for the same title
    if (safeType === 'Birthday') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const existingBirthdayNotif = await Notification.findOne({
        user: userId,
        type: 'Birthday',
        title: title.trim(),
        createdAt: { $gte: todayStart }
      });
      if (existingBirthdayNotif) {
        return existingBirthdayNotif;
      }
    }

    // ── Deduplication Guard 2: Short-Term General / CRM Duplicate Suppression ─────
    // Suppress identical title + message to the same recipient within 60 seconds
    // (Prevents duplicate API calls, double-clicks, auto-saves, or concurrent triggers)
    const sixtySecsAgo = new Date(Date.now() - 60 * 1000);
    const recentDuplicate = await Notification.findOne({
      user: userId,
      title: title.trim(),
      message: message.trim(),
      createdAt: { $gte: sixtySecsAgo }
    });
    if (recentDuplicate) {
      return recentDuplicate;
    }

    // 1. Save to DB
    const notification = await Notification.create({
      user: userId,
      title: title.trim(),
      message: message.trim(),
      type: safeType,
      link
    });

    // 2. Emit to the specific user's socket room
    if (io) {
      io.to(`user:${userIdStr}`).emit('new-notification', notification);
    }
    
    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    return null;
  }
};

module.exports = { sendNotification };
