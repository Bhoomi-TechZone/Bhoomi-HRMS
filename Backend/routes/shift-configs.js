const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const ShiftConfig = require('../models/ShiftConfig');

// Helper to provide default shift configs with full break windows
const getDefaultConfigs = () => [
  {
    name: 'Morning Shift',
    type: 'morning',
    startTime: '09:00 AM',
    endTime: '06:00 PM',
    lunchTime: '01:00 PM',
    lunchStartTime: '01:00 PM',
    lunchEndTime: '02:00 PM',
    teaTime: '04:00 PM',
    refreshment1StartTime: '11:00 AM',
    refreshment1EndTime: '11:30 AM',
    refreshment2StartTime: '04:00 PM',
    refreshment2EndTime: '04:30 PM',
    isActive: true,
    weekoff: 1
  },
  {
    name: 'Noon Shift',
    type: 'noon',
    startTime: '12:00 PM',
    endTime: '09:00 PM',
    lunchTime: '02:30 PM',
    lunchStartTime: '02:30 PM',
    lunchEndTime: '03:30 PM',
    teaTime: '06:30 PM',
    refreshment1StartTime: '01:30 PM',
    refreshment1EndTime: '02:00 PM',
    refreshment2StartTime: '06:30 PM',
    refreshment2EndTime: '07:00 PM',
    isActive: true,
    weekoff: 1
  },
  {
    name: 'Evening Shift',
    type: 'evening',
    startTime: '03:00 PM',
    endTime: '12:00 AM',
    lunchTime: '07:30 PM',
    lunchStartTime: '07:30 PM',
    lunchEndTime: '08:30 PM',
    teaTime: '10:00 PM',
    refreshment1StartTime: '05:30 PM',
    refreshment1EndTime: '06:00 PM',
    refreshment2StartTime: '10:00 PM',
    refreshment2EndTime: '10:30 PM',
    isActive: true,
    weekoff: 1
  },
  {
    name: 'Night Shift',
    type: 'night',
    startTime: '10:00 PM',
    endTime: '07:00 AM',
    lunchTime: '02:00 AM',
    lunchStartTime: '02:00 AM',
    lunchEndTime: '03:00 AM',
    teaTime: '04:30 AM',
    refreshment1StartTime: '12:00 AM',
    refreshment1EndTime: '12:30 AM',
    refreshment2StartTime: '04:30 AM',
    refreshment2EndTime: '05:00 AM',
    isActive: true,
    weekoff: 1
  }
];

// Helper to parse time string
const parseTimeString = (timeStr) => {
  try {
    const match = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return { hours: 9, minutes: 0 };
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3] ? match[3].toUpperCase() : null;
    if (period === 'PM' && hours !== 12) hours += 12;
    else if (period === 'AM' && hours === 12) hours = 0;
    return { hours, minutes: minutes || 0 };
  } catch (error) {
    return { hours: 9, minutes: 0 };
  }
};

// Helper to add minutes to a time string
const addMinutesToTime = (timeStr, minsToAdd) => {
  if (!timeStr) return '01:00 PM';
  const p = parseTimeString(timeStr);
  const totalMins = (p.hours * 60 + p.minutes + minsToAdd + 1440) % 1440;
  let hours = Math.floor(totalMins / 60);
  const minutes = totalMins % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

// Get all shift configurations
router.get('/', auth, async (req, res) => {
  try {
    const shiftConfigs = await ShiftConfig.find().sort({ type: 1 });
    res.json(shiftConfigs);
  } catch (error) {
    console.error('Error fetching shift configurations:', error);
    res.status(500).json({ message: 'Error fetching shift configurations' });
  }
});

// Middleware for bulk shift update (Admins always allowed, or users with settings/employees update)
const canUpdateShifts = (req, res, next) => {
  if (req.user && (req.user.role?.name === 'Admin' || req.user.role?.name === 'Director')) {
    return next();
  }
  return checkPermission(['employees', 'settings'], 'update')(req, res, next);
};

// Update shift configurations (bulk update)
router.put('/bulk', auth, canUpdateShifts, async (req, res) => {
  try {
    const { configs } = req.body;

    if (!Array.isArray(configs)) {
      return res.status(400).json({ message: 'Configs must be an array' });
    }

    console.log('Updating shift configurations with dynamic break intervals:', configs);

    const incomingTypes = configs.map(c => c.type).filter(Boolean);

    // If a list of shifts is provided, remove any shifts from DB that were removed from the list
    if (incomingTypes.length > 0) {
      await ShiftConfig.deleteMany({ type: { $nin: incomingTypes } });
    }

    const updatePromises = configs.map(async (config) => {
      const {
        type,
        name,
        startTime,
        endTime,
        lunchStartTime,
        lunchEndTime,
        refreshment1StartTime,
        refreshment1EndTime,
        refreshment2StartTime,
        refreshment2EndTime,
        allowLunchAnytime,
        allowRefreshment1Anytime,
        allowRefreshment2Anytime,
        isActive,
        weekoff
      } = config;

      return await ShiftConfig.findOneAndUpdate(
        { type },
        {
          name,
          startTime,
          endTime,
          lunchTime: lunchStartTime || config.lunchTime,
          lunchStartTime,
          lunchEndTime,
          teaTime: refreshment1StartTime || config.teaTime,
          refreshment1StartTime,
          refreshment1EndTime,
          refreshment2StartTime,
          refreshment2EndTime,
          allowLunchAnytime: Boolean(allowLunchAnytime),
          allowRefreshment1Anytime: Boolean(allowRefreshment1Anytime),
          allowRefreshment2Anytime: Boolean(allowRefreshment2Anytime),
          isActive: isActive !== undefined ? Boolean(isActive) : true,
          weekoff: weekoff ? parseInt(weekoff, 10) : 1
        },
        { 
          new: true, 
          upsert: true, 
          runValidators: true 
        }
      );
    });

    const updatedConfigs = await Promise.all(updatePromises);
    
    console.log('Shift configurations updated successfully:', updatedConfigs);
    res.json(updatedConfigs);
  } catch (error) {
    console.error('Error updating shift configurations:', error);
    res.status(500).json({ message: 'Error updating shift configurations' });
  }
});

// Delete a single shift configuration
router.delete('/:type', auth, canUpdateShifts, async (req, res) => {
  try {
    const deleted = await ShiftConfig.findOneAndDelete({ type: req.params.type });
    if (!deleted) {
      return res.status(404).json({ message: 'Shift configuration not found' });
    }
    res.json({ message: 'Shift configuration deleted successfully', deleted });
  } catch (error) {
    console.error('Error deleting shift configuration:', error);
    res.status(500).json({ message: 'Error deleting shift configuration' });
  }
});

// Get single shift configuration
router.get('/:type', auth, async (req, res) => {
  try {
    const shiftConfig = await ShiftConfig.findOne({ type: req.params.type });
    
    if (!shiftConfig) {
      return res.status(404).json({ message: 'Shift configuration not found' });
    }

    res.json(shiftConfig);
  } catch (error) {
    console.error('Error fetching shift configuration:', error);
    res.status(500).json({ message: 'Error fetching shift configuration' });
  }
});

module.exports = router;