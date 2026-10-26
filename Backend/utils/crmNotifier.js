const User = require('../models/User');
const { sendNotification } = require('./socketNotifier');

/**
 * Formats a Date object to IST timestamp string
 * Example: "07/09/2026, 05:45 PM"
 */
function formatISTDateTime(date = new Date()) {
  try {
    return new Date(date).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return new Date(date).toLocaleString();
  }
}

/**
 * Classifies a user role into ADMIN, SALES_HEAD, or SUBORDINATE
 */
function classifyRole(roleName = '', designation = '') {
  const r = (roleName || '').toLowerCase().trim();
  const d = (designation || '').toLowerCase().trim();

  const isAdmin = 
    r === 'admin' || 
    r === 'super admin' || 
    r === 'director' || 
    r === 'hr' || 
    d.includes('director') || 
    d.includes('super admin') ||
    d.includes('administrator');

  const isSalesHead = 
    r === 'sales head' || 
    r === 'saleshead' || 
    r === 'head of sales' || 
    d.includes('sales head') || 
    d.includes('head of sales');

  if (isAdmin) return 'ADMIN';
  if (isSalesHead) return 'SALES_HEAD';
  return 'SUBORDINATE';
}

/**
 * Helper to get user display name
 */
function getUserDisplayName(user) {
  if (!user) return 'User';
  if (typeof user === 'string') return user;
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return fullName || user.email || 'User';
}

/**
 * Sends notifications for CRM actions (Deals, Contacts, Companies, Tasks)
 * 
 * Strict Routing & Suppression Rules:
 * 1. Actor NEVER receives their own generated notification.
 * 2. If actor is Subordinate -> Admins and Sales Heads get notified.
 * 3. If actor is Sales Head -> Admins get notified (no subordinates, not himself).
 * 4. If actor is Admin -> Sales Heads and other Admins get notified (not himself).
 * 5. If it's a Task assigned to an employee -> Assignee gets notified, along with supervisory hierarchy (Sales Heads / Admins), actor is excluded.
 */
async function sendCrmNotification(io, {
  actorUser,
  entityType, // 'Deal' | 'Contact' | 'Company' | 'Task'
  action,     // 'create' | 'update' | 'delete' | 'assign' | 'complete'
  entityName, // Deal Name, Contact Name, Company Name, Task Title
  assigneeUser = null, // User ObjectId or User Object or Assignee Name string
  assigneeName = '',
  link = '/pipeline'
}) {
  try {
    if (!actorUser) return;

    const actorIdStr = (actorUser._id || actorUser.id || '').toString();
    const actorName = getUserDisplayName(actorUser);
    const actorRole = actorUser.role?.name || (typeof actorUser.role === 'string' ? actorUser.role : '');
    const actorCategory = classifyRole(actorRole, actorUser.designation);

    const timestamp = formatISTDateTime(new Date());

    // Fetch all active users with roles
    const allUsers = await User.find({ isActive: true }).populate('role');
    
    const adminUserIds = [];
    const salesHeadUserIds = [];
    const userMapByName = new Map();
    const userMapByEmail = new Map();

    for (const u of allUsers) {
      const uIdStr = u._id.toString();
      const uRole = u.role?.name || (typeof u.role === 'string' ? u.role : '');
      const category = classifyRole(uRole, u.designation);

      if (category === 'ADMIN') {
        adminUserIds.push(uIdStr);
      } else if (category === 'SALES_HEAD') {
        salesHeadUserIds.push(uIdStr);
      }

      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
      if (fullName) userMapByName.set(fullName, u);
      if (u.email) userMapByEmail.set(u.email.toLowerCase().trim(), u);
    }

    // Determine target recipient IDs based on actor hierarchy
    const targetUserIds = new Set();

    if (actorCategory === 'SUBORDINATE') {
      // Subordinate action -> Goes to Admin and Sales Head
      adminUserIds.forEach(id => targetUserIds.add(id));
      salesHeadUserIds.forEach(id => targetUserIds.add(id));
    } else if (actorCategory === 'SALES_HEAD') {
      // Sales Head action -> Goes to Admin only (not subordinates, not himself)
      adminUserIds.forEach(id => targetUserIds.add(id));
    } else if (actorCategory === 'ADMIN') {
      // Admin action -> Goes to Sales Heads and other Admins (not himself)
      salesHeadUserIds.forEach(id => targetUserIds.add(id));
      adminUserIds.forEach(id => targetUserIds.add(id));
    }

    // Resolve assignee if task or deal action
    let resolvedAssigneeId = null;
    let resolvedAssigneeName = assigneeName || '';

    if (entityType === 'Task' || entityType === 'Deal') {
      if (assigneeUser && typeof assigneeUser === 'object' && assigneeUser._id) {
        resolvedAssigneeId = assigneeUser._id.toString();
        resolvedAssigneeName = getUserDisplayName(assigneeUser);
      } else if (assigneeUser && typeof assigneeUser === 'string' && assigneeUser.match(/^[0-9a-fA-F]{24}$/)) {
        resolvedAssigneeId = assigneeUser;
        const found = allUsers.find(u => u._id.toString() === assigneeUser);
        if (found) {
          resolvedAssigneeName = getUserDisplayName(found);
        }
      } else if (assigneeName) {
        const cleanName = assigneeName.toLowerCase().trim();
        if (userMapByName.has(cleanName)) {
          const u = userMapByName.get(cleanName);
          resolvedAssigneeId = u._id.toString();
          resolvedAssigneeName = getUserDisplayName(u);
        } else if (userMapByEmail.has(cleanName)) {
          const u = userMapByEmail.get(cleanName);
          resolvedAssigneeId = u._id.toString();
          resolvedAssigneeName = getUserDisplayName(u);
        }
      }

      // If task or deal is assigned/created and has a specific assignee, notify assignee
      if (resolvedAssigneeId && (action === 'assign' || action === 'create' || action === 'update')) {
        targetUserIds.add(resolvedAssigneeId);
      }
    }

    // CRITICAL: Strict self-notification suppression — never notify the actor
    if (actorIdStr) {
      targetUserIds.delete(actorIdStr);
    }

    if (targetUserIds.size === 0) {
      return;
    }

    // Format notification Title and Message
    let title = '';
    let message = '';
    const rawName = (entityName || '').trim();

    if (entityType === 'Deal') {
      if ((action === 'assign' || action === 'create') && resolvedAssigneeName) {
        title = action === 'assign' ? 'Deal Assigned' : 'Deal Created';
        message = `${actorName} assigned deal "${rawName || 'Deal'}" to ${resolvedAssigneeName} at ${timestamp}`;
      } else if (action === 'create') {
        title = 'Deal Created';
        message = `${actorName} created deal - ${rawName || 'New Deal'} at ${timestamp}`;
      } else if (action === 'update') {
        title = 'Deal Updated';
        message = `${actorName} updated deal - ${rawName || 'Deal'} at ${timestamp}`;
      } else if (action === 'delete') {
        title = 'Deal Deleted';
        message = `${actorName} deleted deal - ${rawName || 'Deal'} at ${timestamp}`;
      }
    } else if (entityType === 'Contact') {
      if (action === 'create') {
        title = 'Contact Created';
        message = `${actorName} created contact - ${rawName || 'New Contact'} at ${timestamp}`;
      } else if (action === 'update') {
        title = 'Contact Updated';
        message = `${actorName} updated contact - ${rawName || 'Contact'} at ${timestamp}`;
      } else if (action === 'delete') {
        title = 'Contact Deleted';
        message = `${actorName} deleted contact - ${rawName || 'Contact'} at ${timestamp}`;
      }
    } else if (entityType === 'Company') {
      if (action === 'create') {
        title = 'Company Created';
        message = `${actorName} created company - ${rawName || 'New Company'} at ${timestamp}`;
      } else if (action === 'update') {
        title = 'Company Updated';
        message = `${actorName} updated company - ${rawName || 'Company'} at ${timestamp}`;
      } else if (action === 'delete') {
        title = 'Company Deleted';
        message = `${actorName} deleted company - ${rawName || 'Company'} at ${timestamp}`;
      }
    } else if (entityType === 'Task') {
      if ((action === 'assign' || action === 'create') && resolvedAssigneeName) {
        title = 'Task Assigned';
        message = `${actorName} assigned task "${rawName || 'New Task'}" to ${resolvedAssigneeName} at ${timestamp}`;
      } else if (action === 'create') {
        title = 'Task Created';
        message = `${actorName} created task - ${rawName || 'New Task'} at ${timestamp}`;
      } else if (action === 'complete') {
        title = 'Task Completed';
        message = `${actorName} marked task "${rawName || 'Task'}" as completed at ${timestamp}`;
      } else if (action === 'update') {
        title = 'Task Updated';
        message = `${actorName} updated task - ${rawName || 'Task'} at ${timestamp}`;
      } else if (action === 'delete') {
        title = 'Task Deleted';
        message = `${actorName} deleted task - ${rawName || 'Task'} at ${timestamp}`;
      }
    } else if (entityType === 'Payment') {
      if (action === 'create') {
        title = 'Payment Recorded';
        message = `${actorName} recorded payment of ${rawName || 'Payment'} at ${timestamp}`;
      } else if (action === 'update') {
        title = 'Payment Updated';
        message = `${actorName} updated payment record - ${rawName || 'Payment'} at ${timestamp}`;
      } else if (action === 'delete') {
        title = 'Payment Deleted';
        message = `${actorName} deleted payment record - ${rawName || 'Payment'} at ${timestamp}`;
      }
    }

    // Fallback if no matching title/message
    if (!title || !message) {
      title = `${entityType} ${action.charAt(0).toUpperCase() + action.slice(1)}`;
      message = `${actorName} ${action}d ${entityType.toLowerCase()} - ${rawName} at ${timestamp}`;
    }

    // Send notifications to all target users
    const sendPromises = Array.from(targetUserIds).map(recipientId =>
      sendNotification(io, recipientId, title, message, entityType, link)
    );

    await Promise.all(sendPromises);
  } catch (err) {
    console.error('[sendCrmNotification] Error sending notifications:', err);
  }
}

/**
 * Sends immediate notification to all Admins when any user imports or exports Leads or Pipeline data
 */
async function sendAdminDataActivityNotification(io, {
  actorUser,
  activityType = 'export', // 'import' | 'export'
  category = 'Leads',      // 'Leads' | 'Deals' | 'Contacts' | 'Companies' | 'Tasks' | 'Pipeline'
  count = 0,
  details = '',
  link = ''
}) {
  try {
    const actorName = getUserDisplayName(actorUser);
    const timestamp = formatISTDateTime(new Date());

    // Fetch all active users with their roles
    const allUsers = await User.find({ isActive: true }).populate('role');
    const adminRecipients = new Set();

    for (const u of allUsers) {
      const uRole = u.role?.name || (typeof u.role === 'string' ? u.role : '');
      const categoryRole = classifyRole(uRole, u.designation);
      if (categoryRole === 'ADMIN') {
        adminRecipients.add(u._id.toString());
      }
    }

    if (adminRecipients.size === 0) {
      return;
    }

    let title = '';
    let message = '';
    let notifType = 'CRM';

    if (activityType === 'import') {
      if (category === 'Leads') {
        title = 'Leads Imported';
        message = `${actorName} imported ${count} lead(s) into CRM${details ? ` (${details})` : ''} at ${timestamp}`;
        notifType = 'Lead';
        if (!link) link = '/leads';
      } else if (category === 'Pipeline' || category === 'Deals') {
        title = 'Pipeline Deals Imported';
        message = `${actorName} imported/moved ${count} lead(s) into Pipeline Deals at ${timestamp}`;
        notifType = 'Deal';
        if (!link) link = '/pipeline?tab=deals';
      } else {
        title = `${category} Imported`;
        message = `${actorName} imported ${count} ${category.toLowerCase()} record(s) at ${timestamp}`;
        notifType = category === 'Contacts' ? 'Contact' : (category === 'Companies' ? 'Company' : 'CRM');
        if (!link) link = '/pipeline';
      }
    } else {
      // Export activity
      if (category === 'Leads') {
        title = 'Leads Data Exported';
        message = `${actorName} exported ${count} lead(s) from CRM Leads at ${timestamp}`;
        notifType = 'Lead';
        if (!link) link = '/leads';
      } else if (category === 'Deals') {
        title = 'Pipeline Deals Exported';
        message = `${actorName} exported ${count} deal(s) from Pipeline at ${timestamp}`;
        notifType = 'Deal';
        if (!link) link = '/pipeline?tab=deals';
      } else if (category === 'Contacts') {
        title = 'Pipeline Contacts Exported';
        message = `${actorName} exported ${count} contact(s) from Pipeline at ${timestamp}`;
        notifType = 'Contact';
        if (!link) link = '/pipeline?tab=contacts';
      } else if (category === 'Companies') {
        title = 'Pipeline Companies Exported';
        message = `${actorName} exported ${count} company record(s) from Pipeline at ${timestamp}`;
        notifType = 'Company';
        if (!link) link = '/pipeline?tab=companies';
      } else if (category === 'Tasks') {
        title = 'Pipeline Tasks Exported';
        message = `${actorName} exported ${count} task(s) from Pipeline at ${timestamp}`;
        notifType = 'Task';
        if (!link) link = '/pipeline?tab=tasks';
      } else {
        title = 'Pipeline Data Exported';
        message = `${actorName} exported ${count} record(s) from Pipeline (${category}) at ${timestamp}`;
        notifType = 'CRM';
        if (!link) link = '/pipeline';
      }
    }

    // Send notifications to all admin users via socket and save to DB
    const sendPromises = Array.from(adminRecipients).map(adminId =>
      sendNotification(io, adminId, title, message, notifType, link)
    );

    await Promise.all(sendPromises);
  } catch (err) {
    console.error('[sendAdminDataActivityNotification] Error sending notifications:', err);
  }
}

module.exports = {
  sendCrmNotification,
  sendAdminDataActivityNotification,
  formatISTDateTime,
  classifyRole,
  getUserDisplayName
};
