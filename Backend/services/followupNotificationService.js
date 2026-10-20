const User = require('../models/User');
const Deal = require('../models/Deal');
const PipelineContact = require('../models/PipelineContact');
const { sendNotification } = require('../utils/socketNotifier');

/**
 * Parses date string (YYYY-MM-DD or DD-MM-YYYY or MM/DD/YYYY or DD/MM/YYYY or ISO)
 * and time string (11:48 AM, 11:48AM, 11:48:00 AM, 11:48, etc.)
 * into a Date object aligned to Indian Standard Time (Asia/Kolkata, UTC+05:30).
 */
function parseFollowUpDateTime(dateStr, timeStr) {
  if (!dateStr) return null;

  try {
    let year, month, day;
    const str = String(dateStr).trim();
    const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    const splitMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);

    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10);
      day = parseInt(isoMatch[3], 10);
    } else if (splitMatch) {
      const p1 = parseInt(splitMatch[1], 10);
      const p2 = parseInt(splitMatch[2], 10);
      year = parseInt(splitMatch[3], 10);

      // Distinguish DD/MM/YYYY vs MM/DD/YYYY
      if (p1 > 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12) {
        month = p1;
        day = p2;
      } else {
        // In India and CRM context, DD-MM-YYYY is standard
        day = p1;
        month = p2;
      }
    } else {
      const d = new Date(str);
      if (isNaN(d.getTime())) return null;
      year = d.getFullYear();
      month = d.getMonth() + 1;
      day = d.getDate();
    }

    // Default to 10:00 AM IST if no time provided
    let hours = 10;
    let minutes = 0;

    if (timeStr && typeof timeStr === 'string' && timeStr.trim()) {
      const clean = timeStr.trim();
      // Match "11:48 AM", "11:48AM", "11:48:00 AM", "11:48", "11:48:00", "11.48 AM"
      const ampmMatch = clean.match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
      if (ampmMatch) {
        let h = parseInt(ampmMatch[1], 10);
        const m = parseInt(ampmMatch[2], 10);
        const period = ampmMatch[3] ? ampmMatch[3].toUpperCase() : null;

        if (period === 'PM' && h !== 12) {
          h += 12;
        } else if (period === 'AM' && h === 12) {
          h = 0;
        }
        hours = h;
        minutes = m;
      }
    }

    const yStr = String(year).padStart(4, '0');
    const mStr = String(month).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const hStr = String(hours).padStart(2, '0');
    const minStr = String(minutes).padStart(2, '0');

    // Explicitly align to Indian Standard Time (UTC+05:30)
    const isoTarget = `${yStr}-${mStr}-${dStr}T${hStr}:${minStr}:00+05:30`;
    const targetDate = new Date(isoTarget);

    return isNaN(targetDate.getTime()) ? null : targetDate;
  } catch (err) {
    console.error('[FollowUpNotification] parseFollowUpDateTime error:', err);
    return null;
  }
}

/**
 * Retrieves all active Admin user ObjectIds in the system
 */
async function getAllAdminUserIds() {
  try {
    const allUsers = await User.find({ isActive: true }).populate('role');
    const adminUserIds = new Set();

    for (const u of allUsers) {
      const uRole = (u.role?.name || (typeof u.role === 'string' ? u.role : '')).toLowerCase().trim();
      const uDesignation = (u.designation || '').toLowerCase().trim();
      const uDept = (u.department || '').toLowerCase().trim();
      const uEmail = (u.email || '').toLowerCase().trim();

      const isAdmin = 
        uRole === 'admin' ||
        uRole.includes('admin') ||
        uRole.includes('super admin') ||
        uRole.includes('director') ||
        uDesignation.includes('admin') ||
        uDesignation.includes('director') ||
        uDept === 'administration' ||
        uEmail.startsWith('admin@') ||
        u.isAdmin === true;

      if (isAdmin) {
        adminUserIds.add(u._id.toString());
      }
    }

    return Array.from(adminUserIds);
  } catch (err) {
    console.error('[FollowUpNotification] getAllAdminUserIds error:', err);
    return [];
  }
}

/**
 * Resolves creator user ObjectId from activity data or entity fallbacks
 */
async function resolveCreatorUserId(activity, entity = null) {
  if (activity?.createdBy) {
    const idStr = (activity.createdBy._id || activity.createdBy).toString();
    if (idStr && idStr !== 'null' && idStr !== 'undefined') return idStr;
  }

  if (activity?.author) {
    const cleanAuthor = activity.author.trim();
    const authorParts = cleanAuthor.split(/\s+/);
    const fName = authorParts[0];
    const lName = authorParts.slice(1).join(' ');

    const searchOr = [
      { email: cleanAuthor.toLowerCase() },
      { officialEmail: cleanAuthor.toLowerCase() }
    ];

    if (fName && lName) {
      searchOr.push({
        firstName: new RegExp(`^${fName}$`, 'i'),
        lastName: new RegExp(`^${lName}$`, 'i')
      });
    } else if (fName) {
      searchOr.push({
        firstName: new RegExp(`^${fName}$`, 'i')
      });
    }

    const authorUser = await User.findOne({ $or: searchOr });
    if (authorUser) return authorUser._id.toString();
  }

  if (entity) {
    if (entity.assignedTo) {
      const id = (entity.assignedTo._id || entity.assignedTo).toString();
      if (id) return id;
    }
    if (entity.createdBy) {
      const id = (entity.createdBy._id || entity.createdBy).toString();
      if (id) return id;
    }
  }

  return null;
}

/**
 * Sends an immediate notification when a follow-up is scheduled or logged.
 * Both the creator user AND all Admins receive professional notifications.
 */
async function notifyFollowUpScheduled(io, { entity, activity, creatorUser, isContact = false }) {
  try {
    if (!entity || !activity) return;

    const entityName = entity.dealName || entity.clientName || entity.name || 
      (isContact ? `${entity.firstName || ''} ${entity.lastName || ''}`.trim() : 'Deal');

    const creatorName = creatorUser 
      ? `${creatorUser.firstName || ''} ${creatorUser.lastName || ''}`.trim() || creatorUser.email 
      : (activity.author || 'Sales Team');

    let creatorId = creatorUser?._id ? creatorUser._id.toString() : null;
    if (!creatorId) {
      creatorId = await resolveCreatorUserId(activity, entity);
    }

    const channel = activity.channel || 'Follow-up';
    const dateStr = activity.followUpDate || activity.date || '';
    const timeStr = (activity.followUpTime || activity.time) ? ` at ${activity.followUpTime || activity.time}` : '';
    const remarks = activity.remarks || activity.content || '';
    const remarksSnippet = remarks ? ` | Notes: "${remarks.length > 80 ? remarks.substring(0, 80) + '...' : remarks}"` : '';

    const link = isContact
      ? `/pipeline/crm/overview?ref=sidebar&tab=contacts&view=list&detailTab=followups&contactId=${entity._id}&stage=all`
      : `/pipeline/crm/overview?ref=sidebar&tab=deals&view=kanban&detailTab=followups&dealId=${entity._id}&stage=all`;

    const adminUserIds = await getAllAdminUserIds();

    // 1. Notify Creator (confirmation)
    if (creatorId) {
      const creatorTitle = `Follow-up Scheduled: ${channel} with ${entityName}`;
      const creatorMsg = `You scheduled a ${channel} follow-up for "${entityName}" on ${dateStr}${timeStr}.${remarksSnippet}`;
      await sendNotification(io, creatorId, creatorTitle, creatorMsg, 'Follow-up', link);
    }

    // 2. Notify Admins
    for (const adminId of adminUserIds) {
      if (creatorId && adminId === creatorId) {
        // Creator already received the dedicated creator message
        continue;
      }
      const adminTitle = `New Follow-up Scheduled: ${channel} with ${entityName}`;
      const adminMsg = `${creatorName} scheduled a ${channel} follow-up for "${entityName}" on ${dateStr}${timeStr}.${remarksSnippet}`;
      await sendNotification(io, adminId, adminTitle, adminMsg, 'Follow-up', link);
    }

    console.log(`[FollowUpNotification] Immediate schedule notification sent for "${entityName}" to creator (${creatorId}) + ${adminUserIds.length} admin(s).`);
  } catch (err) {
    console.error('[FollowUpNotification] notifyFollowUpScheduled error:', err);
  }
}

/**
 * Periodically checks all Deals and Contacts for follow-ups that are due as per their date and time.
 * Dispatches high-priority reminder notifications to the creator user AND all Admins.
 */
async function checkAndSendFollowUpReminders(io) {
  try {
    const now = new Date();
    const nowMs = now.getTime();
    const staleThresholdMs = nowMs - (24 * 60 * 60 * 1000); // 24 hours ago

    const adminUserIds = await getAllAdminUserIds();

    // 1. Process Deals
    const deals = await Deal.find({
      'activities.type': 'followup',
      'activities.reminderSent': { $ne: true }
    });

    for (const deal of deals) {
      let dealModified = false;

      if (!Array.isArray(deal.activities)) continue;

      for (const act of deal.activities) {
        if (
          act.type === 'followup' &&
          !act.reminderSent &&
          (act.followUpDate || act.date) &&
          act.status !== 'Completed' &&
          act.status !== 'Missed'
        ) {
          const dateVal = act.followUpDate || act.date;
          const timeVal = act.followUpTime || act.time;
          const targetDate = parseFollowUpDateTime(dateVal, timeVal);
          if (!targetDate) continue;

          const targetMs = targetDate.getTime();

          // If scheduled time has arrived!
          if (targetMs <= nowMs) {
            // Check if older than 24h: silence stale reminders
            if (targetMs < staleThresholdMs) {
              act.reminderSent = true;
              act.reminderSentAt = now;
              dealModified = true;
              continue;
            }

            // Valid due reminder!
            const dealName = deal.dealName || deal.clientName || 'Deal';
            const channel = act.channel || 'Follow-up';
            const authorName = act.author || 'Sales Team';
            const timeDisplay = timeVal ? `${timeVal}, ` : '';
            const dateDisplay = dateVal;
            const remarks = act.remarks || act.content || '';
            const remarksSnippet = remarks ? ` | Notes: "${remarks.length > 80 ? remarks.substring(0, 80) + '...' : remarks}"` : '';
            const link = `/pipeline/crm/overview?ref=sidebar&tab=deals&view=kanban&detailTab=followups&dealId=${deal._id}&stage=all`;

            const creatorId = await resolveCreatorUserId(act, deal);

            // Target recipients: Creator + All Admins
            const recipients = new Set([...adminUserIds]);
            if (creatorId) recipients.add(creatorId);

            for (const recipientId of recipients) {
              const isCreator = creatorId && recipientId === creatorId;
              const title = `Follow-up Due: ${channel} with ${dealName}`;
              const message = isCreator
                ? `Your scheduled ${channel} follow-up for deal "${dealName}" is due now (${timeDisplay}${dateDisplay}). Purpose: ${act.title || 'Touchpoint'}${remarksSnippet}`
                : `Scheduled ${channel} follow-up for deal "${dealName}" (by ${authorName}) is due now (${timeDisplay}${dateDisplay}). Purpose: ${act.title || 'Touchpoint'}${remarksSnippet}`;

              await sendNotification(io, recipientId, title, message, 'Follow-up', link);
            }

            act.reminderSent = true;
            act.reminderSentAt = now;
            dealModified = true;

            console.log(`[FollowUpNotification] Dispatched due reminder for deal "${dealName}" (${channel}) to ${recipients.size} recipient(s) at ${now.toISOString()}.`);
          }
        }
      }

      if (dealModified) {
        await deal.save();
      }
    }

    // 2. Process Contacts
    const contacts = await PipelineContact.find({
      'activities.type': 'followup',
      'activities.reminderSent': { $ne: true }
    });

    for (const contact of contacts) {
      let contactModified = false;

      if (!Array.isArray(contact.activities)) continue;

      for (const act of contact.activities) {
        if (
          act.type === 'followup' &&
          !act.reminderSent &&
          (act.followUpDate || act.date) &&
          act.status !== 'Completed' &&
          act.status !== 'Missed'
        ) {
          const dateVal = act.followUpDate || act.date;
          const timeVal = act.followUpTime || act.time;
          const targetDate = parseFollowUpDateTime(dateVal, timeVal);
          if (!targetDate) continue;

          const targetMs = targetDate.getTime();

          if (targetMs <= nowMs) {
            if (targetMs < staleThresholdMs) {
              act.reminderSent = true;
              act.reminderSentAt = now;
              contactModified = true;
              continue;
            }

            const contactName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Contact';
            const channel = act.channel || 'Follow-up';
            const authorName = act.author || 'Sales Team';
            const timeDisplay = timeVal ? `${timeVal}, ` : '';
            const dateDisplay = dateVal;
            const remarks = act.remarks || act.content || '';
            const remarksSnippet = remarks ? ` | Notes: "${remarks.length > 80 ? remarks.substring(0, 80) + '...' : remarks}"` : '';
            const link = `/pipeline/crm/overview?ref=sidebar&tab=contacts&view=list&detailTab=followups&contactId=${contact._id}&stage=all`;

            const creatorId = await resolveCreatorUserId(act, contact);

            const recipients = new Set([...adminUserIds]);
            if (creatorId) recipients.add(creatorId);

            for (const recipientId of recipients) {
              const isCreator = creatorId && recipientId === creatorId;
              const title = `Follow-up Due: ${channel} with ${contactName}`;
              const message = isCreator
                ? `Your scheduled ${channel} follow-up for contact "${contactName}" is due now (${timeDisplay}${dateDisplay}). Purpose: ${act.title || 'Touchpoint'}${remarksSnippet}`
                : `Scheduled ${channel} follow-up for contact "${contactName}" (by ${authorName}) is due now (${timeDisplay}${dateDisplay}). Purpose: ${act.title || 'Touchpoint'}${remarksSnippet}`;

              await sendNotification(io, recipientId, title, message, 'Follow-up', link);
            }

            act.reminderSent = true;
            act.reminderSentAt = now;
            contactModified = true;

            console.log(`[FollowUpNotification] Dispatched due reminder for contact "${contactName}" (${channel}) to ${recipients.size} recipient(s) at ${now.toISOString()}.`);
          }
        }
      }

      if (contactModified) {
        await contact.save();
      }
    }
  } catch (err) {
    console.error('[FollowUpNotification] checkAndSendFollowUpReminders error:', err);
  }
}

module.exports = {
  parseFollowUpDateTime,
  getAllAdminUserIds,
  resolveCreatorUserId,
  notifyFollowUpScheduled,
  checkAndSendFollowUpReminders
};
