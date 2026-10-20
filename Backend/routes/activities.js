const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Goal = require('../models/Goal');
const Leave = require('../models/Leave');
const Request = require('../models/Request');
const Broadcast = require('../models/Broadcast');
const Attendance = require('../models/Attendance');

// Get recent activities based on role
router.get('/', auth, async (req, res) => {
    try {
        const user = req.user;
        const userRole = user.role.name;
        const isAdminOrHR = ['Admin', 'HR Manager', 'HR', 'Manager', 'Director'].includes(userRole);

        let activities = [];
        const limit = 10;

        if (isAdminOrHR) {
            // --- ADMIN/HR VIEW: System-wide interactions ---

            const [recentLeaves, recentGoals, recentRequests, recentBroadcasts, recentJoinings] = await Promise.all([
                // 1. Recent Leave Applications
                Leave.find()
                    .populate('employee', 'firstName lastName')
                    .sort({ createdAt: -1 })
                    .limit(5),

                // 2. Recent Goals Created/Updated
                Goal.find()
                    .populate('employee', 'firstName lastName')
                    .sort({ createdAt: -1 })
                    .limit(5),

                // 3. Recent Requests
                Request.find()
                    .populate('employee', 'firstName lastName')
                    .sort({ createdAt: -1 })
                    .limit(5),

                // 4. Recent Broadcasts Created
                Broadcast.find()
                    .sort({ createdAt: -1 })
                    .limit(3),

                // 5. New Joinings
                User.find()
                    .sort({ createdAt: -1 })
                    .limit(3)
            ]);

            // Map Leaves
            recentLeaves.forEach(l => {
                activities.push({
                    type: 'leave',
                    title: `Leave Application`,
                    description: `${l.employee?.firstName} applied for ${l.leaveType} (${l.status})`,
                    timestamp: l.createdAt,
                    icon: 'calendar'
                });
            });

            // Map Goals
            recentGoals.forEach(g => {
                activities.push({
                    type: 'goal',
                    title: `Goal Activity`,
                    description: `${g.employee?.firstName} updated goals`,
                    timestamp: g.updatedAt || g.createdAt,
                    icon: '🎯'
                });
            });

            // Map Requests
            recentRequests.forEach(r => {
                activities.push({
                    type: 'request',
                    title: `New Request`,
                    description: `${r.employee?.firstName}: ${r.requestType} (${r.status})`,
                    timestamp: r.createdAt,
                    icon: '📋'
                });
            });

            // Map Broadcasts
            recentBroadcasts.forEach(b => {
                activities.push({
                    type: 'broadcast',
                    title: `Broadcast Sent`,
                    description: b.title,
                    timestamp: b.createdAt,
                    icon: '📢'
                });
            });

            // Map Joinings
            recentJoinings.forEach(u => {
                activities.push({
                    type: 'joining',
                    title: `New Employee Joined`,
                    description: `${u.firstName} ${u.lastName} joined the team`,
                    timestamp: u.createdAt,
                    icon: '👋'
                });
            });

        } else {
            // --- EMPLOYEE VIEW: Their own activities ---

            const [myLeaves, myGoals, myRequests, myAttendance] = await Promise.all([
                // 1. My Leaves
                Leave.find({ employee: user._id })
                    .sort({ createdAt: -1 })
                    .limit(5),

                // 2. My Goals
                Goal.find({ employee: user._id })
                    .sort({ updatedAt: -1 })
                    .limit(5),

                // 3. My Requests
                Request.find({ employee: user._id })
                    .sort({ createdAt: -1 })
                    .limit(5),

                // 4. My Attendance (Punches)
                Attendance.find({ employee: user._id })
                    .sort({ date: -1 })
                    .limit(3)
            ]);

            // Map My Leaves
            myLeaves.forEach(l => {
                activities.push({
                    type: 'leave',
                    title: `Leave Request`,
                    description: `Applied for ${l.leaveType} - Status: ${l.status}`,
                    timestamp: l.createdAt,
                    icon: 'calendar'
                });
            });

            // Map My Goals
            myGoals.forEach(g => {
                const completedCount = g.goals?.filter(x => x.isCompleted).length || 0;
                activities.push({
                    type: 'goal',
                    title: `Goal Progress`,
                    description: `You have completed ${completedCount} goals`,
                    timestamp: g.updatedAt || g.createdAt,
                    icon: '🎯'
                });
            });

            // Map My Requests
            myRequests.forEach(r => {
                activities.push({
                    type: 'request',
                    title: `My Request`,
                    description: `${r.requestType} is ${r.status}`,
                    timestamp: r.createdAt,
                    icon: '📋'
                });
            });

            // Map Attendance
            myAttendance.forEach(a => {
                if (a.punchIn) {
                    activities.push({
                        type: 'attendance',
                        title: 'Punch In',
                        description: `You punched in at ${new Date(a.punchIn).toLocaleTimeString()}`,
                        timestamp: a.punchIn,
                        icon: '⏰'
                    });
                }
                if (a.punchOut) {
                    activities.push({
                        type: 'attendance',
                        title: 'Punch Out',
                        description: `You punched out at ${new Date(a.punchOut).toLocaleTimeString()}`,
                        timestamp: a.punchOut,
                        icon: '🚪'
                    });
                }
            });
        }

        // Sort all combined activities by date desc
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(activities.slice(0, limit));

    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({ message: 'Error fetching recent activities' });
    }
});

module.exports = router;
