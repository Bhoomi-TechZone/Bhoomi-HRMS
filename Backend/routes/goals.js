const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Goal = require('../models/Goal');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Role = require('../models/Role');
const { sendNotification } = require('../utils/socketNotifier');

// Get all goals (admin can see all, employee sees their own)
router.get('/', auth, async (req, res) => {
  try {
    let query = {};

    // Check if user has permission to read all goals
    const userRole = req.user.role;

    // Check for proper goals read permission
    const hasReadPermission = req.user.role.permissions && req.user.role.permissions.find(
      p => p.module === 'goals' && p.actions.includes('read')
    );

    // Management roles + permission-based access
    const hasFullAccess =
      ['Admin', 'HR Manager', 'Manager', 'HR', 'Team Leader', 'Sales'].includes(userRole.name) ||
      hasReadPermission;

    if (!hasFullAccess) {
      // Regular users can only see their own tasks
      query.employee = req.user._id;
    }

    // Pagination support
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000; // Default limit to 1000 to improve performance
    const skip = (page - 1) * limit;

    // Date range filter support
    if (req.query.startDate) {
      query.createdAt = {
        ...query.createdAt,
        $gte: new Date(req.query.startDate)
      };
    }
    if (req.query.employee && hasFullAccess) {
      query.employee = req.query.employee;
    }
    if (req.query.projectId) {
      query.$or = [
        { project: req.query.projectId },
        { 'projects.projectId': req.query.projectId }
      ];
    }
    if (req.query.endDate) {
      query.createdAt = {
        ...query.createdAt,
        $lte: new Date(req.query.endDate)
      };
    }

    const goals = await Goal.find(query)
      .populate({
        path: 'employee',
        select: 'firstName lastName employeeId department designation',
        populate: {
          path: 'role',
          select: 'name'
        }
      })
      .populate({
        path: 'project',
        select: 'name startDate deadline status'
      })
      .populate({
        path: 'projects.projectId',
        select: 'name startDate deadline status'
      })
      .populate('createdBy', 'firstName lastName')
      .populate({
        path: 'reviewRequest.teamLeader',
        select: 'firstName lastName role',
        populate: {
          path: 'role',
          select: 'name'
        }
      })
      .populate({
        path: 'reviewRequest.history.teamLeader',
        select: 'firstName lastName role',
        populate: {
          path: 'role',
          select: 'name'
        }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean for better performance

    res.json(goals);
  } catch (error) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ message: 'Error fetching goals' });
  }
});

// Get goal statistics
router.get('/stats', auth, async (req, res) => {
  try {
    let query = {};
    const userRole = req.user.role;

    // Check for proper goals read permission
    const hasReadPermission = req.user.role.permissions && req.user.role.permissions.find(
      p => p.module === 'goals' && p.actions.includes('read')
    );

    // Management roles + permission-based access for stats
    const hasFullAccess =
      ['Admin', 'HR Manager', 'Manager', 'HR', 'Team Leader', 'Sales'].includes(userRole.name) ||
      hasReadPermission;

    if (!hasFullAccess) {
      // Regular users can only see their own tasks stats
      query.employee = req.user._id;
    }

    // 1. Get stats for Today's Activities (for Completed, In Progress, No Check-in)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysGoalsQuery = {
      ...query,
      createdAt: { $gte: today, $lt: tomorrow }
    };

    const todaysGoals = await Goal.find(todaysGoalsQuery).lean();

    // Group today's goals by employee
    const employeeGoalStatus = {}; // { empId: { total: 0, completed: 0 } }

    todaysGoals.forEach(goal => {
      const empId = goal.employee.toString();
      if (!employeeGoalStatus[empId]) {
        employeeGoalStatus[empId] = { total: 0, completed: 0 };
      }
      goal.goals.forEach(g => {
        employeeGoalStatus[empId].total++;
        if (g.isCompleted) employeeGoalStatus[empId].completed++;
      });
    });

    let completedEmployeesCount = 0;
    let inProgressEmployeesCount = 0;

    for (const empId in employeeGoalStatus) {
      const status = employeeGoalStatus[empId];
      if (status.total > 0 && status.completed === status.total) {
        completedEmployeesCount++;
      } else {
        inProgressEmployeesCount++;
      }
    }

    // 2. Scan for Delayed Employees (Any uncompleted goal with past deadline)
    // OPTIMIZATION: Only fetch goals that have at least one uncompleted item
    // This drastically reduces the dataset by excluding all fully completed historical goals
    const delayQuery = {
      ...query,
      'goals.isCompleted': false
    };

    const allUncompletedGoals = await Goal.find(delayQuery)
      .select('employee project projects goals')
      .populate('project', 'deadline')
      .populate('projects.projectId', 'deadline')
      .lean();

    const delayedEmployeeIds = new Set();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    allUncompletedGoals.forEach(goalDoc => {
      // Determine deadlines
      let deadlines = [];
      if (goalDoc.project?.deadline) {
        deadlines.push(new Date(goalDoc.project.deadline));
      }
      if (goalDoc.projects && goalDoc.projects.length > 0) {
        goalDoc.projects.forEach(p => {
          if (p.projectId?.deadline) {
            deadlines.push(new Date(p.projectId.deadline));
          }
        });
      }

      // Check if any deadline is past and there are uncompleted goals
      // Note: We already filtered for uncompleted goals in the query, but we check again for safety
      const isOverdue = deadlines.some(d => d < todayEnd) && goalDoc.goals.some(g => !g.isCompleted);

      if (isOverdue) {
        delayedEmployeeIds.add(goalDoc.employee.toString());
      }
    });

    // 3. No Check-in Employees
    let noCheckInCount = 0;
    if (hasFullAccess) {
      // Count total active employees
      // We assume "Active" employees have isActive: true
      const totalActiveEmployees = await User.countDocuments({ isActive: true });
      const checkedInCount = Object.keys(employeeGoalStatus).length;
      noCheckInCount = Math.max(0, totalActiveEmployees - checkedInCount);
    }

    res.json({
      completedEmployees: completedEmployeesCount,
      inProgressEmployees: inProgressEmployeesCount,
      delayedEmployees: delayedEmployeeIds.size,
      noCheckInEmployees: noCheckInCount,
      // Keep legacy fields just in case types depend on them, though likely unused now
      total: 0,
      completed: 0,
      inProgress: 0,
      delayed: 0
    });
  } catch (error) {
    console.error('Error fetching goal stats:', error);
    res.status(500).json({ message: 'Error fetching goal statistics' });
  }
});

// Get detailed goal statistics for popups
router.get('/stats-details', auth, async (req, res) => {
  try {
    const { type } = req.query;
    let query = {};
    const userRole = req.user.role;
    // Only Admin, HR Manager, Manager, HR, Team Leader, and Sales can view detailed stats for all employees
    const hasFullAccess =
      userRole.name === 'Admin' ||
      userRole.name === 'HR Manager' ||
      userRole.name === 'Manager' ||
      userRole.name === 'HR' ||
      userRole.name === 'Team Leader' ||
      userRole.name === 'Sales';

    if (!hasFullAccess) {
      return res.status(403).json({ message: 'Access denied - insufficient permissions to view statistics' });
    }

    // Common date calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let result = [];

    if (type === 'delayed') {
      // 2. Scan for Delayed Employees (Any uncompleted goal with past deadline)
      const allGoals = await Goal.find({})
        .select('employee project projects goals')
        .populate('employee', 'firstName lastName employeeId role')
        .populate({
          path: 'employee',
          populate: { path: 'role', select: 'name' }
        })
        .populate('project', 'deadline name')
        .populate('projects.projectId', 'deadline name');

      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const delayedEmployeesMap = new Map();

      allGoals.forEach(goalDoc => {
        // Determine deadlines
        let deadlines = [];
        if (goalDoc.project?.deadline) {
          deadlines.push({ date: new Date(goalDoc.project.deadline), projectName: goalDoc.project.name });
        }
        if (goalDoc.projects && goalDoc.projects.length > 0) {
          goalDoc.projects.forEach(p => {
            if (p.projectId?.deadline) {
              deadlines.push({ date: new Date(p.projectId.deadline), projectName: p.projectId.name });
            }
          });
        }

        // Check if any deadline is past and there are uncompleted goals
        const overdueInfos = deadlines.filter(d => d.date < todayEnd);
        const hasUncompleted = goalDoc.goals.some(g => !g.isCompleted);

        if (overdueInfos.length > 0 && hasUncompleted) {
          const empId = goalDoc.employee._id.toString();
          if (!delayedEmployeesMap.has(empId)) {
            delayedEmployeesMap.set(empId, {
              employee: goalDoc.employee,
              details: []
            });
          }
          overdueInfos.forEach(info => {
            delayedEmployeesMap.get(empId).details.push({
              projectName: info.projectName,
              overdueSince: info.date
            });
          });
        }
      });
      result = Array.from(delayedEmployeesMap.values());

    } else if (type === 'no-check-in') {
      // 3. No Check-in Employees (Active employees with no goals created today)
      // Get all active employees
      const allEmployees = await User.find({ isActive: true })
        .select('firstName lastName employeeId role')
        .populate('role', 'name');

      // Get employees who have created goals today
      const todaysGoals = await Goal.find({ createdAt: { $gte: today, $lt: tomorrow } })
        .distinct('employee');

      const todaysMinersSet = new Set(todaysGoals.map(id => id.toString()));

      result = allEmployees
        .filter(emp => !todaysMinersSet.has(emp._id.toString()))
        .map(emp => ({
          employee: emp,
          details: [{ message: 'No goals created for today' }]
        }));

    } else {
      // Completed or In Progress (Based on Today's goals)
      const todaysGoals = await Goal.find({ createdAt: { $gte: today, $lt: tomorrow } })
        .populate('employee', 'firstName lastName employeeId role')
        .populate({
          path: 'employee',
          populate: { path: 'role', select: 'name' }
        });

      const employeeGoalStatus = {};

      todaysGoals.forEach(goal => {
        const empId = goal.employee._id.toString();
        if (!employeeGoalStatus[empId]) {
          employeeGoalStatus[empId] = {
            employee: goal.employee,
            total: 0,
            completed: 0,
            goals: []
          };
        }
        goal.goals.forEach(g => {
          employeeGoalStatus[empId].total++;
          if (g.isCompleted) employeeGoalStatus[empId].completed++;
          employeeGoalStatus[empId].goals.push(g);
        });
      });

      if (type === 'completed') {
        for (const empId in employeeGoalStatus) {
          const status = employeeGoalStatus[empId];
          if (status.total > 0 && status.completed === status.total) {
            result.push({
              employee: status.employee,
              details: [{ message: `Completed all ${status.total} goals today` }]
            });
          }
        }
      } else if (type === 'in-progress') {
        for (const empId in employeeGoalStatus) {
          const status = employeeGoalStatus[empId];
          // In progress means they have goals, but not all are completed
          if (status.total > 0 && status.completed < status.total) {
            result.push({
              employee: status.employee,
              details: [{ message: `${status.completed}/${status.total} goals completed` }]
            });
          }
        }
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching goal stat details:', error);
    res.status(500).json({ message: 'Error fetching goal statistics details' });
  }
});

// Create goal
router.post('/', auth, checkPermission('goals', 'create'), async (req, res) => {
  try {
    // If employee is not specified in request body, use the logged-in user
    const employeeId = req.body.employee || req.user._id;

    console.log('Creating goal with data:', req.body);

    let goalData = {
      employee: employeeId,
      createdBy: req.user._id,
      goals: req.body.goals
    };

    // Handle multiple projects (new array format)
    if (req.body.projects && Array.isArray(req.body.projects) && req.body.projects.length > 0) {
      // Filter out any projects with null/undefined IDs (for HR/Manager/Sales creating without projects)
      const validProjects = req.body.projects.filter(proj => proj.project || proj.projectId);
      if (validProjects.length > 0) {
        goalData.projects = validProjects.map(proj => ({
          projectId: proj.project || proj.projectId,
          projectName: proj.projectName || proj.name
        }));
      }
    }
    // Handle single project (backward compatibility)
    else if (req.body.project) {
      goalData.project = req.body.project;
      goalData.projectName = req.body.projectName || '';
      // Also store in projects array for consistency
      goalData.projects = [{
        projectId: req.body.project,
        projectName: req.body.projectName || ''
      }];
    }

    const goal = await Goal.create(goalData);

    await goal.populate('employee', 'firstName lastName employeeId');

    // Populate both single project and projects array
    if (goal.project) {
      await goal.populate('project', 'name startDate deadline status');
    }
    if (goal.projects && goal.projects.length > 0) {
      await goal.populate('projects.projectId', 'name startDate deadline status');
    }

    await goal.populate('createdBy', 'firstName lastName');
    await goal.populate({
      path: 'reviewRequest.teamLeader',
      select: 'firstName lastName role',
      populate: {
        path: 'role',
        select: 'name'
      }
    });

    // Attendance marking logic removed - tasks/goals are now independent of attendance
    // const today = new Date();
    // today.setHours(0, 0, 0, 0);
    //
    // const existingAttendance = await Attendance.findOne({
    //   employee: goal.employee._id,
    //   date: today
    // });
    //
    // if (!existingAttendance) {
    //   await Attendance.create({
    //     employee: goal.employee._id,
    //     date: today,
    //     loginTime: new Date(),
    //     status: 'absent'
    //   });
    // }

    // Notify employee and admins
    try {
      const io = req.app.get('socketio');

      // Notify employee and admins if created by someone else
      if (String(goal.employee._id) !== String(req.user._id)) {
        // Notify employee
        sendNotification(
          io,
          goal.employee._id,
          'Task Assigned',
          `${req.user.firstName} assigned you new task(s).`,
          'Task',
          `/goals?taskId=${goal._id}`
        );

        // Notify Admins
        const adminRole = await Role.findOne({ name: 'Admin' }).select('_id');
        if (adminRole) {
          const admins = await User.find({ role: adminRole._id, isActive: true }).select('_id');
          Promise.all(admins.map(admin => {
            if (String(admin._id) !== String(req.user._id)) {
              return sendNotification(io, admin._id, 'Task Assigned', `${req.user.firstName} assigned task to ${goal.employee.firstName}.`, 'Task', `/goals?taskId=${goal._id}`);
            }
          })).catch(err => console.error(err));
        }
      }
    } catch (notifyErr) {
      console.error('Error sending task notifications:', notifyErr);
    }

    res.status(201).json(goal);
  } catch (error) {
    console.error('Error creating goal:', error);
    res.status(500).json({ message: 'Error creating goal', error: error.message });
  }
});

// Update goal (toggle completion OR edit goal details)
router.put('/:id', auth, async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    // Check if user is updating their own goal or has admin access
    const hasFullAccess = req.user.role.permissions.find(
      p => p.module === 'goals' && p.actions.includes('delete')
    );

    const hasUpdatePermission = req.user.role.permissions.find(
      p => p.module === 'goals' && p.actions.includes('update')
    );

    if (!hasUpdatePermission) {
      return res.status(403).json({ message: 'No permission to update goals' });
    }

    const isReviewReply = req.body.reviewRequest && req.body.isEditing === false;
    const isDesignatedTeamLeader = goal.reviewRequest?.teamLeader?.toString() === req.user._id.toString();

    if (!hasFullAccess && goal.employee.toString() !== req.user._id.toString() && !(isReviewReply && isDesignatedTeamLeader)) {
      return res.status(403).json({ message: 'You can only update your own goals' });
    }

    // Check if this is an edit request (isEditing = true) or completion toggle
    const isEditing = req.body.isEditing;

    let originalDescription = null;
    if (req.body.reviewRequest) {
      originalDescription = goal.reviewRequest?.description;
    }

    console.log('Goal update request:', {
      goalId: req.params.id,
      isEditing,
      currentGoalsCount: goal.goals.length,
      newGoalsCount: req.body.goals ? req.body.goals.length : 0,
      newGoals: req.body.goals
    });

    if (isEditing) {
      // Allow editing only on the day of creation, unless admin
      if (!hasFullAccess) {
        const created = new Date(goal.createdAt);
        const today = new Date();
        created.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        if (created.getTime() !== today.getTime()) {
          return res.status(403).json({ message: 'Goals can only be edited on the day they are created' });
        }
      }

      // Update project and goal names
      if (req.body.project) {
        goal.project = req.body.project;
      }

      // Update custom project name when editing
      if (req.body.projectName) {
        goal.projectName = req.body.projectName;
      }

      // Update projects array
      if (req.body.projects && Array.isArray(req.body.projects)) {
        goal.projects = req.body.projects.map(proj => ({
          projectId: proj.project || proj.projectId,
          projectName: proj.projectName || proj.name || ''
        }));
      }

      if (req.body.goals && Array.isArray(req.body.goals)) {
        // Replace all goals with the new ones (allows adding/removing goals)
        goal.goals = req.body.goals.filter(g => g.name && g.name.trim()).map((newGoal, index) => {
          // Try to preserve existing goal data if it exists
          const existingGoal = goal.goals[index];
          return {
            _id: newGoal._id || (existingGoal ? existingGoal._id : undefined),
            name: newGoal.name.trim(),
            notes: newGoal.notes || (existingGoal ? existingGoal.notes : ''),
            isCompleted: newGoal.isCompleted !== undefined ? newGoal.isCompleted : (existingGoal ? existingGoal.isCompleted : false),
            completedAt: newGoal.completedAt || (existingGoal ? existingGoal.completedAt : null),
            projectId: newGoal.projectId || undefined,
            projectId: newGoal.projectId || undefined,
            projectName: newGoal.projectName || ''
          };
        });
      }
      if (req.body.reviewRequest) {
        if (req.body.reviewRequest.status === 'Pending' && goal.reviewRequest && goal.reviewRequest.requested && goal.reviewRequest.status !== 'Pending') {
          goal.reviewRequest.history.push({
            description: goal.reviewRequest.description,
            teamLeader: goal.reviewRequest.teamLeader,
            status: goal.reviewRequest.status,
            requestedAt: goal.reviewRequest.requestedAt,
            seenAt: goal.reviewRequest.seenAt,
            projectId: goal.reviewRequest.projectId,
            projectName: goal.reviewRequest.projectName,
            taskId: goal.reviewRequest.taskId,
            taskName: goal.reviewRequest.taskName
          });
        }

        goal.reviewRequest.requested = req.body.reviewRequest.requested !== undefined ? req.body.reviewRequest.requested : goal.reviewRequest.requested;
        goal.reviewRequest.description = req.body.reviewRequest.description !== undefined ? req.body.reviewRequest.description : goal.reviewRequest.description;
        goal.reviewRequest.teamLeader = req.body.reviewRequest.teamLeader !== undefined ? req.body.reviewRequest.teamLeader : goal.reviewRequest.teamLeader;
        goal.reviewRequest.status = req.body.reviewRequest.status !== undefined ? req.body.reviewRequest.status : goal.reviewRequest.status;
        goal.reviewRequest.requestedAt = req.body.reviewRequest.requestedAt !== undefined ? req.body.reviewRequest.requestedAt : goal.reviewRequest.requestedAt;
        goal.reviewRequest.seenAt = req.body.reviewRequest.seenAt !== undefined ? req.body.reviewRequest.seenAt : goal.reviewRequest.seenAt;
        if (req.body.reviewRequest.projectId !== undefined) goal.reviewRequest.projectId = req.body.reviewRequest.projectId;
        if (req.body.reviewRequest.projectName !== undefined) goal.reviewRequest.projectName = req.body.reviewRequest.projectName;
        if (req.body.reviewRequest.taskId !== undefined) goal.reviewRequest.taskId = req.body.reviewRequest.taskId;
        if (req.body.reviewRequest.taskName !== undefined) goal.reviewRequest.taskName = req.body.reviewRequest.taskName;
      }
    } else {
      // Original behavior: toggle goal completion with notes update
      // Users can now modify goals anytime (date restriction removed)

      // Update goals
      if (req.body.goals) {
        req.body.goals.forEach(updatedGoal => {
          const goalIndex = goal.goals.findIndex(g => g._id.toString() === updatedGoal._id);
          if (goalIndex !== -1) {
            if (updatedGoal.isCompleted !== undefined) {
              goal.goals[goalIndex].isCompleted = updatedGoal.isCompleted;
              if (updatedGoal.isCompleted) {
                goal.goals[goalIndex].completedAt = new Date();
              } else {
                goal.goals[goalIndex].completedAt = null;
              }
            }
            // Update notes if provided
            if (updatedGoal.notes !== undefined) {
              goal.goals[goalIndex].notes = updatedGoal.notes;
            }
          }
        });
      }

      if (req.body.reviewRequest) {
        // If there's a new interaction (indicated by a new requestedAt timestamp) and an existing request, push old to history
        if (
          req.body.reviewRequest.requestedAt &&
          goal.reviewRequest && goal.reviewRequest.requested &&
          new Date(req.body.reviewRequest.requestedAt).getTime() !== (goal.reviewRequest.requestedAt ? new Date(goal.reviewRequest.requestedAt).getTime() : 0)
        ) {
          goal.reviewRequest.history.push({
            description: goal.reviewRequest.description,
            teamLeader: goal.reviewRequest.teamLeader,
            status: goal.reviewRequest.status,
            requestedAt: goal.reviewRequest.requestedAt,
            seenAt: goal.reviewRequest.seenAt,
            projectId: goal.reviewRequest.projectId,
            projectName: goal.reviewRequest.projectName,
            taskId: goal.reviewRequest.taskId,
            taskName: goal.reviewRequest.taskName
          });
        }

        goal.reviewRequest.requested = req.body.reviewRequest.requested !== undefined ? req.body.reviewRequest.requested : goal.reviewRequest.requested;
        goal.reviewRequest.description = req.body.reviewRequest.description !== undefined ? req.body.reviewRequest.description : goal.reviewRequest.description;
        goal.reviewRequest.teamLeader = req.body.reviewRequest.teamLeader !== undefined ? req.body.reviewRequest.teamLeader : goal.reviewRequest.teamLeader;
        goal.reviewRequest.status = req.body.reviewRequest.status !== undefined ? req.body.reviewRequest.status : goal.reviewRequest.status;
        goal.reviewRequest.requestedAt = req.body.reviewRequest.requestedAt !== undefined ? req.body.reviewRequest.requestedAt : goal.reviewRequest.requestedAt;
        goal.reviewRequest.seenAt = req.body.reviewRequest.seenAt !== undefined ? req.body.reviewRequest.seenAt : goal.reviewRequest.seenAt;
        if (req.body.reviewRequest.projectId !== undefined) goal.reviewRequest.projectId = req.body.reviewRequest.projectId;
        if (req.body.reviewRequest.projectName !== undefined) goal.reviewRequest.projectName = req.body.reviewRequest.projectName;
        if (req.body.reviewRequest.taskId !== undefined) goal.reviewRequest.taskId = req.body.reviewRequest.taskId;
        if (req.body.reviewRequest.taskName !== undefined) goal.reviewRequest.taskName = req.body.reviewRequest.taskName;
      }
    }

    await goal.save();
    await goal.populate({
      path: 'employee',
      select: 'firstName lastName employeeId',
      populate: {
        path: 'role',
        select: 'name'
      }
    });
    await goal.populate('project', 'name startDate deadline status');
    await goal.populate('createdBy', 'firstName lastName');
    await goal.populate({
      path: 'reviewRequest.teamLeader',
      select: 'firstName lastName role',
      populate: {
        path: 'role',
        select: 'name'
      }
    });
    await goal.populate({
      path: 'reviewRequest.history.teamLeader',
      select: 'firstName lastName role',
      populate: {
        path: 'role',
        select: 'name'
      }
    });

    if (req.body.reviewRequest && req.body.reviewRequest.status === 'Pending') {
      try {
        const io = req.app.get('socketio');
        const User = require('../models/User');
        const requester = await User.findById(goal.employee._id).select('firstName lastName');

        // Notify Admins
        const adminRole = await Role.findOne({ name: 'Admin' }).select('_id');
        if (adminRole) {
          const admins = await User.find({ role: adminRole._id, isActive: true }).select('_id');
          Promise.all(admins.map(admin => {
            if (String(admin._id) !== String(req.user._id)) {
              return sendNotification(
                io,
                admin._id,
                'Task Review Requested',
                `${requester.firstName} ${requester.lastName} requested a review for the task ${req.body.reviewRequest.taskName || 'task'}.`,
                'Task',
                `/goals?taskId=${goal._id}`
              );
            }
          })).catch(err => console.error(err));
        }

        // Notify Team Leader if provided
        if (req.body.reviewRequest.teamLeader) {
          if (String(req.body.reviewRequest.teamLeader) !== String(req.user._id)) {
            sendNotification(
              io,
              req.body.reviewRequest.teamLeader,
              'Task Review Requested',
              `${requester.firstName} ${requester.lastName} requested a review for the task ${req.body.reviewRequest.taskName || 'task'}.`,
              'Task',
              `/goals?taskId=${goal._id}`
            );
          }
        }

      } catch (notifyErr) {
        console.error('Error sending review request notifications:', notifyErr);
      }
    }

    if (req.body.reviewRequest && req.body.reviewRequest.status === 'Reverted') {
      try {
        const io = req.app.get('socketio');

        console.log("SENDING REVERT NOTIFICATION", {
          employeeId: goal.employee._id || goal.employee,
          firstName: req.user.firstName
        });

        // Notify the employee only if the replier is not the employee
        if (goal.employee && String(goal.employee._id || goal.employee) !== String(req.user._id)) {
          await sendNotification(
            io,
            goal.employee._id || goal.employee,
            'Review Request Reverted',
            req.body.reviewRequest?.description
              ? (originalDescription
                ? `${req.user.firstName} replied to your message "${originalDescription}" with "${req.body.reviewRequest.description}"`
                : `${req.user.firstName} replied: "${req.body.reviewRequest.description}"`)
              : `${req.user.firstName} replied to your review request`,
            'Task',
            `/goals?taskId=${goal._id}`
          );
          console.log("NOTIFICATION SENT SUCCESS");
        }

        // Notify Admins
        const Role = require('../models/Role');
        const User = require('../models/User');
        const adminRole = await Role.findOne({ name: 'Admin' }).select('_id');
        if (adminRole) {
          const admins = await User.find({ role: adminRole._id, isActive: true }).select('_id');
          Promise.all(admins.map(admin => {
            if (String(admin._id) !== String(req.user._id)) {
              return sendNotification(
                io,
                admin._id,
                'Review Request Reverted',
                req.body.reviewRequest?.description
                  ? (originalDescription
                    ? `${req.user.firstName} replied to ${goal.employee.firstName}'s message "${originalDescription}" with "${req.body.reviewRequest.description}"`
                    : `${req.user.firstName} replied to ${goal.employee.firstName}: "${req.body.reviewRequest.description}"`)
                  : `${req.user.firstName} replied to ${goal.employee.firstName}'s review request`,
                'Task',
                `/goals?taskId=${goal._id}`
              );
            }
          })).catch(err => console.error(err));
        }
      } catch (notifyErr) {
        console.error('Error sending revert request notifications:', notifyErr);
      }
    }

    // Attendance update logic removed - tasks/goals are now independent of attendance
    // const today = new Date();
    // today.setHours(0, 0, 0, 0);
    // const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    //
    // const attendance = await Attendance.findOne({
    //   employee: goal.employee._id,
    //   date: today
    // });
    //
    // if (attendance) {
    //   // Count all goals (created and completed) for today across all goal documents
    //   const allGoals = await Goal.find({
    //     employee: goal.employee._id,
    //     createdAt: {
    //       $gte: today,
    //       $lt: tomorrow
    //     }
    //   });
    //
    //   let totalCreatedGoals = 0;
    //   let totalCompletedGoals = 0;
    //   allGoals.forEach(g => {
    //     totalCreatedGoals += g.goals.length;
    //     const completedToday = g.goals.filter(gi =>
    //       gi.isCompleted &&
    //       gi.completedAt >= today &&
    //       gi.completedAt < tomorrow
    //     );
    //     totalCompletedGoals += completedToday.length;
    //   });
    //
    //   // Mark present if 3 or more goals completed
    //   if (totalCompletedGoals >= 3) {
    //     attendance.status = 'present';
    //   }
    //
    //   // If all goals for the day are completed, record logoutTime
    //   if (totalCreatedGoals > 0 && totalCompletedGoals === totalCreatedGoals) {
    //     attendance.logoutTime = new Date();
    //     if (attendance.loginTime) {
    //       const diffMs = attendance.logoutTime.getTime() - new Date(attendance.loginTime).getTime();
    //       attendance.workingHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
    //     }
    //   } else if (!(totalCreatedGoals > 0 && totalCompletedGoals === totalCreatedGoals)) {
    //     // If not all goals are completed (user unchecked some), clear logoutTime and reset workingHours
    //     if (attendance.logoutTime) {
    //       attendance.logoutTime = null;
    //       attendance.workingHours = 0;
    //     }
    //   }
    //
    //   await attendance.save();
    // }

    res.json(goal);
  } catch (error) {
    console.error('Error updating goal:', error);
    res.status(500).json({ message: 'Error updating goal', error: error.message });
  }
});

// Delete goal
router.delete('/:id', auth, checkPermission('goals', 'delete'), async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);

    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const userRole = req.user.role;
    const hasFullAccess =
      userRole.name === 'Admin' ||
      userRole.name === 'HR Manager' ||
      userRole.name === 'Manager' ||
      userRole.name === 'HR' ||
      userRole.name === 'Team Leader' ||
      userRole.name === 'Sales';

    if (!hasFullAccess && goal.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own goals' });
    }

    await goal.deleteOne();

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting goal' });
  }
});

module.exports = router;
