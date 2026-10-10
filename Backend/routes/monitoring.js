const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const AgentStatus = require('../models/AgentStatus');
const MonitoringSession = require('../models/MonitoringSession');
const crypto = require('crypto');

// POST /api/monitoring/request
router.post('/request', auth, async (req, res) => {
  try {
    const { employeeId } = req.body;
    const adminUser = req.user; // Assuming req.user is populated by auth middleware

    // 1. Check Admin Permissions
    // Typically, only Admins or HR can monitor
    if (!adminUser.role || (adminUser.role.name !== 'Admin' && adminUser.role.name !== 'HR Manager')) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to monitor screens.' });
    }

    if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required.' });
    }

    // 2. Employee exists
    const employee = await User.findOne({ employeeId });
    if (!employee) {
        return res.status(404).json({ message: 'Employee not found.' });
    }

    // 3. Employee is online
    const agentStatus = await AgentStatus.findOne({ employeeId });
    if (!agentStatus || !agentStatus.isOnline) {
        return res.status(400).json({ message: 'Employee is not online or desktop agent is not running.' });
    }

    // 4. Clear any stale sessions for this employee to prevent lockups during testing/reconnects
    await MonitoringSession.updateMany(
        { employeeId, status: { $in: ['REQUESTED', 'CONNECTING', 'ACTIVE'] } },
        { $set: { status: 'STOPPED', endedAt: new Date() } }
    );

    // 5. Create monitoring session
    const sessionId = `mon_${crypto.randomBytes(4).toString('hex')}`;
    const session = new MonitoringSession({
        sessionId,
        employeeId,
        adminId: adminUser._id,
        status: 'REQUESTED'
    });
    
    await session.save();

    // 6. Notify the employee through Socket.IO
    const io = req.app.get('socketio');
    if (io) {
        io.to(`employee:${employeeId}`).emit('monitoring:request', {
            sessionId,
            employeeId
        });
        console.log(`[MONITORING] Requested employee ${employeeId}, session ${sessionId}`);
    } else {
        console.error('[MONITORING] Socket.io instance not found on app!');
    }

    return res.status(200).json({ sessionId });

  } catch (error) {
    console.error('Monitoring request error:', error);
    res.status(500).json({ message: 'Server error processing monitoring request.' });
  }
});

module.exports = router;
