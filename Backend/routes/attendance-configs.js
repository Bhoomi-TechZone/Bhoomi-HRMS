const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const AttendanceConfig = require('../models/AttendanceConfig');

// Get attendance configuration
router.get('/', auth, checkPermission('employees', 'read'), async (req, res) => {
  try {
    let config = await AttendanceConfig.findOne({ isActive: true });
    
    // If no configuration exists, create default one
    if (!config) {
      config = await AttendanceConfig.create({
        markLateAfter: 0.25, // 15 minutes
        totalBreakLimit: 60,  // 60 minutes
        checkoutGracePeriod: 20, // 20 minutes
        isActive: true
      });
    }

    res.json(config);
  } catch (error) {
    console.error('Error fetching attendance configuration:', error);
    res.status(500).json({ message: 'Error fetching attendance configuration' });
  }
});

// Update attendance configuration
router.put('/', auth, checkPermission('employees', 'update'), async (req, res) => {
  try {
    const { markLateAfter, checkinWindowBefore, totalBreakLimit, checkoutGracePeriod } = req.body;

    console.log('Updating attendance configuration:', req.body);

    // Validate the values
    if (markLateAfter !== undefined && (markLateAfter < 0 || markLateAfter > 24)) {
      return res.status(400).json({ message: 'Mark Late After must be between 0 and 24 hours' });
    }

    if (checkinWindowBefore !== undefined && (typeof checkinWindowBefore !== 'number' || checkinWindowBefore < 0)) {
      return res.status(400).json({ message: 'Checkin window before must be a positive number of minutes' });
    }

    if (totalBreakLimit !== undefined && (typeof totalBreakLimit !== 'number' || totalBreakLimit < 0)) {
      return res.status(400).json({ message: 'Total break limit must be a positive number of minutes' });
    }
    if (checkoutGracePeriod !== undefined && (typeof checkoutGracePeriod !== 'number' || checkoutGracePeriod < 0)) {
      return res.status(400).json({ message: 'Checkout grace period must be a positive number of minutes' });
    }

    let config = await AttendanceConfig.findOne({ isActive: true });
    
    if (config) {
      if (markLateAfter !== undefined) config.markLateAfter = parseFloat(markLateAfter);
      if (checkinWindowBefore !== undefined) config.checkinWindowBefore = parseInt(checkinWindowBefore);
      if (totalBreakLimit !== undefined) config.totalBreakLimit = parseInt(totalBreakLimit);
      if (checkoutGracePeriod !== undefined) config.checkoutGracePeriod = parseInt(checkoutGracePeriod);
      await config.save();
    } else {
      config = await AttendanceConfig.create({
        markLateAfter: markLateAfter !== undefined ? parseFloat(markLateAfter) : 0.25,
        checkinWindowBefore: checkinWindowBefore !== undefined ? parseInt(checkinWindowBefore) : 15,
        totalBreakLimit: totalBreakLimit !== undefined ? parseInt(totalBreakLimit) : 60,
        checkoutGracePeriod: checkoutGracePeriod !== undefined ? parseInt(checkoutGracePeriod) : 20,
        isActive: true
      });
    }

    console.log('Attendance configuration updated successfully:', config);
    res.json(config);
  } catch (error) {
    console.error('Error updating attendance configuration:', error);
    res.status(500).json({ message: 'Error updating attendance configuration' });
  }
});

module.exports = router;