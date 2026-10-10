const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const TaskRequest = require('../models/TaskRequest');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const Role = require('../models/Role');
const User = require('../models/User');

// GET all task requests
// Admin/Manager can see all; employees see only their own
router.get('/', auth, async (req, res) => {
  try {
    const userRole = req.user.role;
    const hasFullAccess = ['Admin', 'HR Manager', 'Manager', 'HR', 'Team Leader'].includes(userRole.name);

    let query = {};
    if (!hasFullAccess) {
      query.requestedBy = req.user._id;
    }

    const requests = await TaskRequest.find(query)
      .populate('requestedBy', 'firstName lastName employeeId')
      .populate('requestTo', 'firstName lastName employeeId')
      .populate('project', 'name')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching task requests:', error);
    res.status(500).json({ message: 'Error fetching task requests' });
  }
});

// POST create a new task request
router.post('/', auth, async (req, res) => {
  try {
    const {
      requestTo,
      projectId,
      projectName,
      taskTitle,
      priority,
      status,
      notes,
      remarks,
      requestedDate,
      deadlineDate
    } = req.body;

    if (!taskTitle || !taskTitle.trim()) {
      return res.status(400).json({ message: 'Task title is required' });
    }

    if (!requestedDate) {
      return res.status(400).json({ message: 'Requested date is required' });
    }

    const taskRequest = new TaskRequest({
      requestedBy: req.user._id,
      requestTo: requestTo || undefined,
      project: projectId || undefined,
      projectName: projectName || '',
      taskTitle: taskTitle.trim(),
      priority: priority || 'Low',
      status: status || 'Pending',
      notes: notes || '',
      remarks: remarks || '',
      requestedDate: new Date(requestedDate),
      deadlineDate: deadlineDate ? new Date(deadlineDate) : undefined
    });

    await taskRequest.save();
    await taskRequest.populate('requestedBy', 'firstName lastName employeeId');
    await taskRequest.populate('requestTo', 'firstName lastName employeeId');
    await taskRequest.populate('project', 'name');

    if (taskRequest.requestTo) {
      const notification = new Notification({
        user: taskRequest.requestTo,
        title: 'New Task Request',
        message: `You have a new task request "${taskRequest.taskTitle}" from ${req.user.firstName} ${req.user.lastName}.`,
        type: 'Task'
      });
      await notification.save();
    }

    // Notify admins
    const adminRole = await Role.findOne({ name: 'Admin' });
    if (adminRole) {
      const admins = await User.find({ role: adminRole._id });
      for (const admin of admins) {
        // Don't notify if the admin created it
        if (admin._id.toString() === req.user._id.toString()) continue;
        
        const adminNotification = new Notification({
          user: admin._id,
          title: 'New Task Request Created',
          message: `A new task request "${taskRequest.taskTitle}" was created by ${req.user.firstName} ${req.user.lastName}.`,
          type: 'Task'
        });
        await adminNotification.save();
      }
    }

    res.status(201).json({ message: 'Task request created successfully', taskRequest });
  } catch (error) {
    console.error('Error creating task request:', error);
    res.status(500).json({ message: 'Error creating task request', error: error.message });
  }
});

// PUT update a task request (status/remarks by admin/manager)
router.put('/:id', auth, async (req, res) => {
  try {
    const taskRequest = await TaskRequest.findById(req.params.id);
    if (!taskRequest) {
      return res.status(404).json({ message: 'Task request not found' });
    }

    const userRole = req.user.role;
    const hasFullAccess = ['Admin', 'HR Manager', 'Manager', 'HR', 'Team Leader'].includes(userRole.name);
    const isOwner = taskRequest.requestedBy.toString() === req.user._id.toString();

    if (!hasFullAccess && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const oldStatus = taskRequest.status;
    const oldRemarks = taskRequest.remarks || '';
    const oldNotes = taskRequest.notes || '';

    const allowedFields = ['status', 'remarks', 'priority', 'notes', 'deadlineDate', 'taskTitle', 'projectId', 'projectName'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'projectId') taskRequest.project = req.body[field];
        else taskRequest[field] = req.body[field];
      }
    });

    await taskRequest.save();

    if (oldStatus !== taskRequest.status && req.user._id.toString() !== taskRequest.requestedBy.toString()) {
      const notification = new Notification({
        user: taskRequest.requestedBy,
        title: 'Task Request Status Updated',
        message: `The status of your task request "${taskRequest.taskTitle}" was updated to ${taskRequest.status} by ${req.user.firstName} ${req.user.lastName}.`,
        type: 'Task'
      });
      await notification.save();
    }

    if (oldRemarks !== (taskRequest.remarks || '') && req.user._id.toString() !== taskRequest.requestedBy.toString()) {
      const notification = new Notification({
        user: taskRequest.requestedBy,
        title: 'Task Request Remark Updated',
        message: `A remark was added/updated on your task request "${taskRequest.taskTitle}" by ${req.user.firstName} ${req.user.lastName}.`,
        type: 'Task'
      });
      await notification.save();
    }

    if (oldNotes !== (taskRequest.notes || '') && taskRequest.requestTo && req.user._id.toString() !== taskRequest.requestTo.toString()) {
      const notification = new Notification({
        user: taskRequest.requestTo,
        title: 'Task Request Note Updated',
        message: `A note was added/updated on the task request "${taskRequest.taskTitle}" by ${req.user.firstName} ${req.user.lastName}.`,
        type: 'Task'
      });
      await notification.save();
    }

    if (oldStatus !== taskRequest.status) {
      // Notify admins
      const adminRole = await Role.findOne({ name: 'Admin' });
      if (adminRole) {
        const admins = await User.find({ role: adminRole._id });
        for (const admin of admins) {
          // Don't notify the admin if they are the ones who updated it
          if (admin._id.toString() === req.user._id.toString()) continue;
          
          const adminNotification = new Notification({
            user: admin._id,
            title: 'Task Request Status Updated',
            message: `The status of task request "${taskRequest.taskTitle}" was updated to ${taskRequest.status} by ${req.user.firstName} ${req.user.lastName}.`,
            type: 'Task'
          });
          await adminNotification.save();
        }
      }
    }

    res.json({ message: 'Task request updated successfully', taskRequest });
  } catch (error) {
    console.error('Error updating task request:', error);
    res.status(500).json({ message: 'Error updating task request' });
  }
});

// DELETE a task request
router.delete('/:id', auth, async (req, res) => {
  try {
    const taskRequest = await TaskRequest.findById(req.params.id);
    if (!taskRequest) {
      return res.status(404).json({ message: 'Task request not found' });
    }

    const userRole = req.user.role;
    const hasFullAccess = ['Admin', 'HR Manager', 'Manager'].includes(userRole.name);
    const isOwner = taskRequest.requestedBy.toString() === req.user._id.toString();

    if (!hasFullAccess && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await taskRequest.deleteOne();
    res.json({ message: 'Task request deleted successfully' });
  } catch (error) {
    console.error('Error deleting task request:', error);
    res.status(500).json({ message: 'Error deleting task request' });
  }
});

module.exports = router;
