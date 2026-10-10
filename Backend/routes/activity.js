const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Activity = require('../models/Activity');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

// --- Dependency-Free Custom Memory Rate Limiter ---
const rateLimitWindow = 15 * 60 * 1000; // 15 minutes
const maxRequests = 100; // Max 100 requests per IP per window
const ipCache = new Map();

const rateLimiter = (req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();

  if (!ipCache.has(ip)) {
    ipCache.set(ip, { count: 1, resetTime: now + rateLimitWindow });
    return next();
  }

  const data = ipCache.get(ip);
  if (now > data.resetTime) {
    ipCache.set(ip, { count: 1, resetTime: now + rateLimitWindow });
    return next();
  }

  data.count++;
  if (data.count > maxRequests) {
    return res.status(429).json({ message: 'Too many requests. Please try again later.' });
  }

  next();
};

// Helper to bulk-resolve employee roles and append to activities
async function appendRolesToActivities(activities) {
  if (!activities || activities.length === 0) return [];
  
  const employeeIds = [...new Set(activities.map(act => act.employeeId))];
  const users = await User.find({ employeeId: { $in: employeeIds } }).populate('role');
  
  const roleMap = {};
  const nameMap = {};
  const emailMap = {};
  const designationMap = {};
  users.forEach(u => {
    if (u.employeeId) {
      roleMap[u.employeeId] = u.role?.name || 'Employee';
      nameMap[u.employeeId] = `${u.firstName} ${u.lastName}`.trim();
      emailMap[u.employeeId] = u.email || '';
      designationMap[u.employeeId] = u.designation || '';
    }
  });

  return activities.map(act => {
    const actObj = act.toObject ? act.toObject() : act;
    actObj.role = roleMap[act.employeeId] || 'Employee';
    if (nameMap[act.employeeId]) {
      actObj.employeeName = nameMap[act.employeeId];
    }
    actObj.email = emailMap[act.employeeId] || '';
    actObj.designation = designationMap[act.employeeId] || '';
    return actObj;
  });
}

// @route   POST /api/activity
// @desc    Ingest bulk activities from Electron agent
// @access  Private (JWT Protected)
router.post('/', auth, rateLimiter, async (req, res) => {
  try {
    const { activities } = req.body;

    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      return res.status(400).json({ message: 'Invalid payload: activities must be a non-empty array' });
    }

    const employeeId = req.user.employeeId;
    const employeeName = `${req.user.firstName} ${req.user.lastName}`.trim();

    // 1. Extract unique dates from activities
    const uniqueDates = [...new Set(activities.map(act => {
      if (!act.startTime) return null;
      const d = new Date(act.startTime);
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    }))].filter(Boolean).map(dateStr => new Date(dateStr));

    // 2. Query attendance records matching these dates for this employee
    const attendances = await Attendance.find({
      employee: req.user._id,
      date: { $in: uniqueDates }
    });

    // 3. Build a lookup map of date string -> loginTime (check-in time)
    const attendanceMap = {};
    attendances.forEach(att => {
      if (att.loginTime) {
        const d = new Date(att.date);
        d.setHours(0, 0, 0, 0);
        attendanceMap[d.toISOString()] = new Date(att.loginTime);
      }
    });

    // Map and validate activities for insertion
    const activitiesToInsert = activities.map(act => {
      // Validate required fields in each item
      if (!act.appName || !act.startTime || !act.endTime || act.durationSeconds === undefined) {
        throw new Error('Missing required activity fields (appName, startTime, endTime, durationSeconds)');
      }

      const actStartTime = new Date(act.startTime);

      // Find the start of day for this activity
      const d = new Date(actStartTime);
      d.setHours(0, 0, 0, 0);
      const dayStr = d.toISOString();

      // Get check-in login time
      const loginTime = attendanceMap[dayStr];

      // Expiration date is check-in loginTime + 24 hours, or fallback to activity startTime + 24 hours
      const expiresAt = loginTime
        ? new Date(loginTime.getTime() + 24 * 60 * 60 * 1000)
        : new Date(actStartTime.getTime() + 24 * 60 * 60 * 1000);

      return {
        employeeId: employeeId,
        employeeName: employeeName,
        appName: act.appName,
        startTime: actStartTime,
        endTime: new Date(act.endTime),
        durationSeconds: Number(act.durationSeconds),
        idleSeconds: act.idleSeconds !== undefined ? Number(act.idleSeconds) : 0,
        createdAt: act.createdAt ? new Date(act.createdAt) : new Date(),
        expiresAt: expiresAt
      };
    });

    // Bulk insert into MongoDB
    const result = await Activity.insertMany(activitiesToInsert);

    res.status(201).json({
      success: true,
      message: 'Activities ingested successfully',
      count: result.length
    });

  } catch (error) {
    console.error('Error during activity ingestion:', error.message);
    res.status(500).json({
      message: error.message.includes('Missing required') ? 'Bad Request' : 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/activity/me
// @desc    Get current employee's activity history
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { date, from, to } = req.query;
    let query = { employeeId };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.startTime = { $gte: start, $lte: end };
    } else if (from || to) {
      query.startTime = {};
      if (from) query.startTime.$gte = new Date(from);
      if (to) query.startTime.$lte = new Date(to);
    }

    const activities = await Activity.find(query).sort({ startTime: -1 });
    const userRole = req.user.role?.name || 'Employee';
    const activitiesWithRole = activities.map(act => {
      const actObj = act.toObject ? act.toObject() : act;
      actObj.role = userRole;
      return actObj;
    });

    res.json(activitiesWithRole);
  } catch (error) {
    console.error('Error fetching employee activities:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/activity/admin
// @desc    Get admin activity log view with filters
// @access  Private (Admin/HR/Manager or with read permission)
router.get('/admin', auth, async (req, res) => {
  try {
    const userRole = req.user.role?.name;
    const isAdminOrHR = ['Admin', 'HR Manager', 'HR', 'Manager', 'Director', 'Team Leader'].includes(userRole);
    if (!isAdminOrHR) {
      return res.status(403).json({ message: 'Access denied. View permission required.' });
    }

    const { employeeId, date, from, to } = req.query;
    let query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    }

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.startTime = { $gte: start, $lte: end };
    } else if (from || to) {
      query.startTime = {};
      if (from) query.startTime.$gte = new Date(from);
      if (to) query.startTime.$lte = new Date(to);
    }

    const activities = await Activity.find(query).sort({ startTime: -1 });
    let activitiesWithRole = await appendRolesToActivities(activities);
    
    if (userRole === 'Team Leader') {
      activitiesWithRole = activitiesWithRole.filter(act => act.role === 'Developer' || act.employeeId === req.user.employeeId);
    }
    
    res.json(activitiesWithRole);
  } catch (error) {
    console.error('Error fetching admin activities:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/activity/summary
// @desc    Get daily application tracking duration summary for charts
// @access  Private
router.get('/summary', auth, async (req, res) => {
  try {
    const employeeId = req.user.employeeId;
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(23, 59, 59, 999);

    const summary = await Activity.aggregate([
      {
        $match: {
          employeeId,
          startTime: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: "$appName",
          durationSeconds: { $sum: "$durationSeconds" }
        }
      },
      {
        $project: {
          _id: 0,
          appName: "$_id",
          durationSeconds: 1
        }
      },
      {
        $sort: { durationSeconds: -1 }
      }
    ]);

    res.json(summary);
  } catch (error) {
    console.error('Error fetching daily activity summary:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/activity/live
// @desc    Get live tracking status of checked-in employees
// @access  Private
router.get('/live', auth, async (req, res) => {
  try {
    const userRole = req.user.role?.name;
    const hasReadPermission = req.user.role?.permissions?.some(
      p => p.module === 'activities' && p.actions.includes('read')
    );
    const isAdminOrHR = ['Admin', 'HR Manager', 'HR', 'Manager', 'Director', 'Team Leader'].includes(userRole) || hasReadPermission;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Query active attendance records for today (those without a logoutTime)
    let query = { date: today, logoutTime: null };
    if (!isAdminOrHR) {
      query.employee = req.user.id;
    }

    const activePunches = await Attendance.find(query).populate({
      path: 'employee',
      select: 'firstName lastName employeeId role',
      populate: { path: 'role', select: 'name' }
    });

    let filteredPunches = activePunches;
    if (userRole === 'Team Leader') {
      filteredPunches = activePunches.filter(p => p.employee?.role?.name === 'Developer' || String(p.employee?._id) === String(req.user.id));
    }

    const io = req.app.get('socketio');

    const liveStatus = filteredPunches.map(p => {
      const empId = p.employee?.employeeId;
      const room = io ? io.sockets.adapter.rooms.get(`employee:${empId}`) : null;
      const isSocketConnected = room ? room.size > 0 : false;
      return {
        employeeId: empId || 'N/A',
        employeeName: p.employee ? `${p.employee.firstName} ${p.employee.lastName}`.trim() : 'Unknown',
        status: isSocketConnected ? 'tracking' : 'deactivated'
      };
    });

    res.json(liveStatus);
  } catch (error) {
    console.error('Error fetching live tracking status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
