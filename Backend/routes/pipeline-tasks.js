const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PipelineTask = require('../models/PipelineTask');
const User = require('../models/User');
const Deal = require('../models/Deal');
const PipelineContact = require('../models/PipelineContact');
const auth = require('../middleware/auth');
const { sendCrmNotification } = require('../utils/crmNotifier');

// Cutoff timestamp: old pipeline data (before this cutoff) is strictly visible ONLY to Admin
const DATA_CUTOFF_DATE = new Date(process.env.CRM_DATA_CUTOFF_DATE || '2026-10-17T00:00:00+05:30');

// Helper for checking role permissions and data access levels
function checkAccess(user) {
  const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase().trim();
  const roleNormalized = roleName.replace(/\s+/g, ' ');

  const isSalesHead =
    roleNormalized.includes('sales head') ||
    roleNormalized === 'saleshead' ||
    roleNormalized === 'head of sales';

  const isSalesManager =
    roleNormalized.includes('sales manager') ||
    roleNormalized.includes('salesmanager') ||
    roleNormalized === 'manager of sales';

  const designation = (user?.designation || '').toString().toLowerCase().trim();
  const department = (user?.department || '').toString().toLowerCase().trim();
  const email = (user?.email || '').toString().toLowerCase().trim();

  const isAdmin =
    roleNormalized === 'admin' ||
    roleNormalized.includes('admin') ||
    roleNormalized.includes('superadmin') ||
    roleNormalized.includes('director') ||
    designation.includes('admin') ||
    designation.includes('director') ||
    department === 'administration' ||
    email.startsWith('admin@') ||
    user?.role?.name === 'Admin' ||
    user?.role?.name === 'Super Admin' ||
    user?.role?.name === 'Director';

  const hasFullAccess = isAdmin || isSalesHead || isSalesManager;

  const permissions = Array.isArray(user?.role?.permissions) ? user.role.permissions : [];
  const hasRead = hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'tasks' || p.module === 'deals') && p.actions.includes('read'));
  const hasCreate = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'tasks' || p.module === 'deals') && p.actions.includes('create'));
  const hasUpdate = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'tasks' || p.module === 'deals') && p.actions.includes('update'));
  const hasDelete = isAdmin || hasFullAccess || permissions.some(p => (p.module === 'pipeline' || p.module === 'tasks' || p.module === 'deals') && p.actions.includes('delete'));

  return { roleName, isSalesHead, isSalesManager, isAdmin, hasFullAccess, hasRead, hasCreate, hasUpdate, hasDelete };
}

// Helper to check if a specific task is accessible to a user
async function isTaskOwnedByUser(task, user, hasFullAccess, isAdmin) {
  if (isAdmin) return true;
  if (!task || !user) return false;

  // Old tasks are strictly visible only to Admin
  const taskDate = new Date(task.createdAt || 0);
  if (taskDate < DATA_CUTOFF_DATE) return false;

  if (hasFullAccess) return true;

  const userId = (user._id || user.id || '').toString();
  const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
  const userEmail = (user.email || '').trim().toLowerCase();

  const assignedId = (task.assignedTo?._id || task.assignedTo || '').toString();
  const createdId = (task.createdBy?._id || task.createdBy || '').toString();
  const assignee = (task.assignee || '').trim().toLowerCase();

  if (userId && (assignedId === userId || createdId === userId)) return true;
  if (userFullName && (assignee === userFullName || assignee === 'admin system')) return true;
  if (userEmail && assignee === userEmail) return true;

  // Check if associated with a deal owned by or assigned to this user
  if (task.associatedDealId) {
    try {
      const deal = await Deal.findById(task.associatedDealId).select('assignedTo salesOwner addedBy');
      if (deal) {
        const dealAssignedId = (deal.assignedTo?._id || deal.assignedTo || '').toString();
        const dealOwner = (deal.salesOwner || '').toLowerCase().trim();
        const dealAddedBy = (deal.addedBy || '').toLowerCase().trim();
        if (userId && dealAssignedId === userId) return true;
        if (userFullName && (dealOwner === userFullName || dealAddedBy === userFullName)) return true;
      }
    } catch (e) {}
  }

  // Check if associated with a contact owned by or assigned to this user
  if (task.associatedContactId) {
    try {
      const contact = await PipelineContact.findById(task.associatedContactId).select('assignedTo owner addedBy');
      if (contact) {
        const contactAssignedId = (contact.assignedTo?._id || contact.assignedTo || '').toString();
        const contactOwner = (contact.owner || '').toLowerCase().trim();
        const contactAddedBy = (contact.addedBy || '').toLowerCase().trim();
        if (userId && contactAssignedId === userId) return true;
        if (userFullName && (contactOwner === userFullName || contactAddedBy === userFullName)) return true;
      }
    } catch (e) {}
  }

  return false;
}

// Get all pipeline tasks
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasRead, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasRead) {
      return res.status(403).json({ message: 'Access denied. Read permission required.' });
    }

    let query = {};

    const dataViewMode = (req.query.dataViewMode || '').toLowerCase().trim();

    // Data filtering by cutoff:
    // If not admin, strictly only see data from 17 OCT 2026 onwards
    // If admin and dataViewMode === 'new', only see data >= DATA_CUTOFF_DATE
    // If admin and dataViewMode === 'old', only see data < DATA_CUTOFF_DATE
    // If admin and dataViewMode === 'all' (or not specified), see all data
    if (!isAdmin) {
      query.createdAt = { $gte: DATA_CUTOFF_DATE };
    } else if (dataViewMode === 'new') {
      query.createdAt = { $gte: DATA_CUTOFF_DATE };
    } else if (dataViewMode === 'old') {
      query.createdAt = { $lt: DATA_CUTOFF_DATE };
    }

    // Data isolation: Sales Head, Sales Manager, and Admin see all new tasks; other roles only see their data
    if (!hasFullAccess) {
      const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      const userEmail = (user.email || '').toLowerCase().trim();

      const orConditions = [
        { assignedTo: user._id },
        { createdBy: user._id }
      ];
      if (userFullName) {
        orConditions.push({ assignee: { $regex: new RegExp(`^${userFullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
      }
      if (userEmail) {
        orConditions.push({ assignee: userEmail });
      }

      // Also include tasks associated with user's assigned deals
      try {
        const userDeals = await Deal.find({
          $or: [
            { assignedTo: user._id },
            ...(userFullName ? [{ salesOwner: userFullName }] : [])
          ]
        }).select('_id');
        const dealIds = userDeals.map(d => d._id.toString());
        if (dealIds.length > 0) {
          orConditions.push({ associatedDealId: { $in: dealIds } });
        }
      } catch (e) {}

      // Also include tasks associated with user's assigned contacts
      try {
        const userContacts = await PipelineContact.find({
          $or: [
            { assignedTo: user._id },
            ...(userFullName ? [{ owner: userFullName }] : [])
          ]
        }).select('_id');
        const contactIds = userContacts.map(c => c._id.toString());
        if (contactIds.length > 0) {
          orConditions.push({ associatedContactId: { $in: contactIds } });
        }
      } catch (e) {}

      query.$or = orConditions;
    }

    const tasks = await PipelineTask.find(query)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(tasks || []);
  } catch (error) {
    console.error('Get pipeline tasks error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single task by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasRead, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasRead) {
      return res.status(403).json({ message: 'Access denied. Read permission required.' });
    }

    const task = await PipelineTask.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email employeeId')
      .populate('createdBy', 'firstName lastName email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!(await isTaskOwnedByUser(task, user, hasFullAccess, isAdmin))) {
      return res.status(403).json({ message: 'Access denied. You can only view your own tasks.' });
    }

    res.json(task);
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new pipeline task
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasCreate } = checkAccess(user);
    if (!hasCreate) {
      return res.status(403).json({ message: 'Access denied. Create permission required.' });
    }

    const {
      title,
      description,
      dueDate,
      priority,
      status,
      completed,
      type,
      assignee,
      associatedDealId,
      associatedDealName,
      associatedContactId,
      associatedContactName,
      assignedTo
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    const isCompleted = completed !== undefined ? completed : status === 'Completed';
    const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Artiflow';
    const validAssignedTo = (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo))
      ? assignedTo
      : (user._id || null);

    const task = new PipelineTask({
      title: title.trim(),
      description: description || '',
      dueDate: dueDate || '',
      priority: priority || 'Medium',
      status: status || (isCompleted ? 'Completed' : 'Pending'),
      completed: isCompleted,
      type: type || 'Follow-up',
      assignee: assignee || userFullName,
      associatedDealId: associatedDealId || '',
      associatedDealName: associatedDealName || '',
      associatedContactId: associatedContactId || '',
      associatedContactName: associatedContactName || '',
      assignedTo: validAssignedTo,
      createdBy: user._id
    });

    await task.save();

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Task',
        action: (task.assignedTo || task.assignee) ? 'assign' : 'create',
        entityName: task.title,
        assigneeUser: task.assignedTo,
        assigneeName: task.assignee || '',
        link: '/pipeline?tab=tasks'
      });
    } catch (notifErr) {
      console.error('Task create notification error:', notifErr);
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Create pipeline task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update pipeline task
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasUpdate, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasUpdate) {
      return res.status(403).json({ message: 'Access denied. Update permission required.' });
    }

    const task = await PipelineTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!(await isTaskOwnedByUser(task, user, hasFullAccess, isAdmin))) {
      return res.status(403).json({ message: 'Access denied. You can only update your own tasks.' });
    }

    const {
      title,
      description,
      dueDate,
      priority,
      status,
      completed,
      type,
      assignee,
      associatedDealId,
      associatedDealName,
      associatedContactId,
      associatedContactName,
      assignedTo
    } = req.body;

    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description;
    if (dueDate !== undefined) task.dueDate = dueDate;
    if (priority !== undefined) task.priority = priority;
    if (status !== undefined) task.status = status;
    if (completed !== undefined) {
      task.completed = completed;
      if (completed && task.status !== 'Completed') task.status = 'Completed';
      if (!completed && task.status === 'Completed') task.status = 'Pending';
    }
    if (type !== undefined) task.type = type;
    if (assignee !== undefined) task.assignee = assignee;
    if (associatedDealId !== undefined) task.associatedDealId = associatedDealId;
    if (associatedDealName !== undefined) task.associatedDealName = associatedDealName;
    if (associatedContactId !== undefined) task.associatedContactId = associatedContactId;
    if (associatedContactName !== undefined) task.associatedContactName = associatedContactName;
    if (assignedTo !== undefined) {
      task.assignedTo = (assignedTo && mongoose.Types.ObjectId.isValid(assignedTo)) ? assignedTo : null;
    }

    await task.save();

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      const isCompleted = task.completed || task.status === 'Completed';
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Task',
        action: isCompleted ? 'complete' : 'update',
        entityName: task.title,
        assigneeUser: task.assignedTo,
        assigneeName: task.assignee || '',
        link: '/pipeline?tab=tasks'
      });
    } catch (notifErr) {
      console.error('Task update notification error:', notifErr);
    }

    res.json(task);
  } catch (error) {
    console.error('Update pipeline task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete pipeline task
router.delete('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id || req.user._id).populate('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const { hasDelete, hasFullAccess, isAdmin } = checkAccess(user);
    if (!hasDelete) {
      return res.status(403).json({ message: 'Access denied. Delete permission required.' });
    }

    const task = await PipelineTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!(await isTaskOwnedByUser(task, user, hasFullAccess, isAdmin))) {
      return res.status(403).json({ message: 'Access denied. You can only delete your own tasks.' });
    }

    const taskTitle = task.title || 'Task';
    await PipelineTask.findByIdAndDelete(req.params.id);

    // Trigger CRM notification
    try {
      const io = req.app.get('socketio');
      sendCrmNotification(io, {
        actorUser: user,
        entityType: 'Task',
        action: 'delete',
        entityName: taskTitle,
        link: '/pipeline?tab=tasks'
      });
    } catch (notifErr) {
      console.error('Task delete notification error:', notifErr);
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete pipeline task error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;

