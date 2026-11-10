const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { classifyRole } = require('../utils/crmNotifier');
const { getTeamUserIds } = require('../utils/roleAccess');

// Get all notifications for the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    // Proactively evaluate any pending birthday wishes/alerts for today (rate-limited / locked)
    const { checkAndSendBirthdayNotifications } = require('../services/birthdayNotificationService');
    const io = req.app.get('socketio');
    await checkAndSendBirthdayNotifications(io).catch(err => console.warn('Birthday check error:', err.message));

    // Fetch latest notifications for the current user
    const rawNotifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    // ── 1. Deduplicate Existing Notifications ─────────────────────────────────────
    // If multiple duplicate notifications exist in DB (e.g. from prior race conditions or multi-saves),
    // keep the latest one and prune the duplicates.
    const seen = new Set();
    const duplicateIdsToDelete = [];
    const uniqueNotifications = [];

    for (const n of rawNotifications) {
      const titleClean = (n.title || '').trim();
      const msgClean = (n.message || '').trim();

      // For Birthday notifications, deduplicate by recipient + title + calendar date
      const dedupeKey = n.type === 'Birthday'
        ? `bday_${titleClean}_${new Date(n.createdAt).toDateString()}`
        : `${n.type}_${titleClean}_${msgClean}`;

      if (seen.has(dedupeKey)) {
        duplicateIdsToDelete.push(n._id);
      } else {
        seen.add(dedupeKey);
        uniqueNotifications.push(n);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      Notification.deleteMany({ _id: { $in: duplicateIdsToDelete } }).catch(err =>
        console.warn('Cleanup duplicate notifications error:', err.message)
      );
    }

    // ── 2. Strict Sales Head Isolation & Self-Action Suppression ──────────────────
    // A Sales Head must only see notifications related to themselves and their team.
    // Clean up any historical notifications originating from other Sales Heads or other sales teams.
    const userRole = req.user.role?.name || (typeof req.user.role === 'string' ? req.user.role : '');
    const userCategory = classifyRole(userRole, req.user.designation);

    if (userCategory === 'SALES_HEAD') {
      const myTeamIds = await getTeamUserIds(req.user._id);
      const myTeamIdStrings = new Set(myTeamIds.map(i => i.toString()));

      // Fetch team members' names for checking actor attribution
      const teamUsers = await User.find({ _id: { $in: Array.from(myTeamIdStrings) } }).select('firstName lastName email');
      const teamNames = new Set();
      teamUsers.forEach(u => {
        const full = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
        if (full) teamNames.add(full);
        if (u.firstName) teamNames.add(u.firstName.toLowerCase().trim());
      });

      // All active users who are other Sales Heads or subordinates outside this team
      const otherUsers = await User.find({
        _id: { $nin: Array.from(myTeamIdStrings) },
        isActive: true
      }).populate('role').select('firstName lastName email role designation');

      const otherSalesNames = [];
      for (const ou of otherUsers) {
        const ouRole = ou.role?.name || (typeof ou.role === 'string' ? ou.role : '');
        const ouCat = classifyRole(ouRole, ou.designation);
        if (ouCat === 'SALES_HEAD' || ouCat === 'SUBORDINATE') {
          const full = `${ou.firstName || ''} ${ou.lastName || ''}`.trim().toLowerCase();
          if (full && !teamNames.has(full)) {
            otherSalesNames.push(full);
          }
        }
      }

      const otherTeamIdsToDelete = [];
      const myName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim().toLowerCase();
      const filteredList = [];

      for (const n of uniqueNotifications) {
        // Only evaluate CRM-specific entity notifications for team filtering
        if (['Deal', 'Contact', 'Company', 'Lead', 'Task', 'CRM'].includes(n.type)) {
          const msgLower = (n.message || '').toLowerCase();

          // Suppress notifications where the Sales Head performed the action themselves (self-action)
          if (myName && msgLower.startsWith(myName)) {
            otherTeamIdsToDelete.push(n._id);
            continue;
          }

          // If the action was taken by another Sales Head or an employee outside their team
          const isFromOtherTeam = otherSalesNames.some(otherName => msgLower.includes(otherName));
          if (isFromOtherTeam) {
            otherTeamIdsToDelete.push(n._id);
            continue;
          }
        }

        filteredList.push(n);
      }

      if (otherTeamIdsToDelete.length > 0) {
        Notification.deleteMany({ _id: { $in: otherTeamIdsToDelete } }).catch(err =>
          console.warn('Cleanup other team notifications error:', err.message)
        );
      }

      return res.json(filteredList.slice(0, 50));
    }

    res.json(uniqueNotifications.slice(0, 50));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// Mark a single notification as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Error updating notification' });
  }
});

// Mark all notifications as read for the logged-in user
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Error updating notifications' });
  }
});

// Clear all notifications for the logged-in user
router.delete('/clear-all', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });
    res.json({ message: 'All notifications cleared' });
  } catch (error) {
    console.error('Error clearing notifications:', error);
    res.status(500).json({ message: 'Error clearing notifications' });
  }
});

// General export-notify endpoint for any module
router.post('/export-notify', auth, async (req, res) => {
  try {
    const { category = 'Data', count = 0, details = '', link = '' } = req.body;
    const { sendAdminDataActivityNotification } = require('../utils/crmNotifier');
    const io = req.app.get('socketio');
    await sendAdminDataActivityNotification(io, {
      actorUser: req.user,
      activityType: 'export',
      category,
      count: parseInt(count, 10) || 0,
      details,
      link
    });
    res.status(200).json({ success: true, message: `Admin notified of ${category} export` });
  } catch (error) {
    console.error('Export notify error:', error);
    res.status(500).json({ message: 'Error notifying admin', error: error.message });
  }
});

module.exports = router;
