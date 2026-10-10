const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const MetaLead = require('../models/MetaLead');
const Project = require('../models/Project');
const Lead = require('../models/Lead');

/**
 * GET /api/dashboard/previous-stats
 * Returns counts for the previous month to calculate trends
 */
router.get('/previous-stats', auth, async (req, res) => {
  try {
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const [presentPrev, absentPrev, metaLeadsPrev, crmLeadsPrev, projectsPrev] = await Promise.all([
      Attendance.countDocuments({ date: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: 'present' }),
      Attendance.countDocuments({ date: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: 'absent' }),
      MetaLead.countDocuments({ createdTime: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
      Lead.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
      Project.countDocuments({ createdAt: { $lte: lastMonthEnd }, status: { $in: ['active', 'on-hold'] } })
    ]);

    // Average daily attendance for previous month (simplified)
    const daysInMonth = lastMonthEnd.getDate();
    
    res.json({
      presentToday: Math.round(presentPrev / daysInMonth) || 0,
      absentToday: Math.round(absentPrev / daysInMonth) || 0,
      totalLeads: metaLeadsPrev + crmLeadsPrev,
      activeProjects: projectsPrev
    });
  } catch (err) {
    console.error('Previous stats error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/dashboard/weekly-sparklines
 * Returns last-7-days daily counts for: present, absent, leads, active-projects
 */
router.get('/weekly-sparklines', auth, async (req, res) => {
  try {
    // Build array of last 7 days (today inclusive)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    // Parallel queries for all 7 days
    const [presentCounts, absentCounts, leadCounts] = await Promise.all([
      // Present per day
      Promise.all(days.map(day => {
        const next = new Date(day); next.setDate(next.getDate() + 1);
        return Attendance.countDocuments({ date: { $gte: day, $lt: next }, status: 'present' });
      })),
      // Absent per day
      Promise.all(days.map(day => {
        const next = new Date(day); next.setDate(next.getDate() + 1);
        return Attendance.countDocuments({ date: { $gte: day, $lt: next }, status: 'absent' });
      })),
      // Leads created per day (Meta + CRM)
      Promise.all(days.map(async day => {
        const next = new Date(day); next.setDate(next.getDate() + 1);
        const [metaCount, crmCount] = await Promise.all([
          MetaLead.countDocuments({ createdTime: { $gte: day, $lt: next } }),
          Lead.countDocuments({ createdAt: { $gte: day, $lt: next } })
        ]);
        return metaCount + crmCount;
      })),
    ]);

    // Active projects count is a single value — replicate across 7 days with cumulative style
    const activeProjects = await Project.countDocuments({
      status: { $in: ['active', 'on-hold'] }
    });
    // Simple flat sparkline for projects (same value each day since we don't track daily changes)
    const projectCounts = days.map(() => activeProjects);

    res.json({
      present:  presentCounts,
      absent:   absentCounts,
      leads:    leadCounts,
      projects: projectCounts,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
