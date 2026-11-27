const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const MetaLead = require('../models/MetaLead');
const Project = require('../models/Project');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Role = require('../models/Role');

// In-memory cache for historical stats (expires every 1 hour)
let previousStatsCache = { timestamp: 0, data: null };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * GET /api/dashboard/overview-summary
 * High-performance consolidated endpoint that delivers all KPI metrics,
 * project statuses, lead counts, sparklines, and lead sources in a single pass.
 */
router.get('/overview-summary', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);

    // 7 days date calculation for sparklines
    const dayKeys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayKeys.push(key);
    }
    const oldestSparkDay = new Date(today);
    oldestSparkDay.setDate(oldestSparkDay.getDate() - 6);

    // Previous month range
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    const daysInLastMonth = lastMonthEnd.getDate();

    // Parallel execution of all required aggregations and counts
    const [
      adminRole,
      todayAttendanceRecords,
      projectStatusAgg,
      totalMetaLeads,
      totalCrmLeads,
      sparkAttAgg,
      sparkMetaAgg,
      sparkCrmAgg,
      leadSourceStats
    ] = await Promise.all([
      Role.findOne({ name: 'Admin' }).select('_id').lean(),
      Attendance.find({
        date: { $gte: today, $lte: todayEnd },
        loginTime: { $exists: true, $ne: null }
      }).select('employee').populate('employee', 'role').lean(),
      Project.aggregate([
        {
          $group: {
            _id: { $toLower: { $ifNull: ['$status', ''] } },
            count: { $sum: 1 }
          }
        }
      ]),
      MetaLead.countDocuments({}),
      Lead.countDocuments({ movedToPipeline: { $ne: true } }),
      // Sparklines: 7-day attendance
      Attendance.aggregate([
        { $match: { date: { $gte: oldestSparkDay }, status: { $in: ['present', 'absent'] } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              status: '$status'
            },
            count: { $sum: 1 }
          }
        }
      ]),
      // Sparklines: 7-day meta leads
      MetaLead.aggregate([
        { $match: { createdTime: { $gte: oldestSparkDay } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdTime' } },
            count: { $sum: 1 }
          }
        }
      ]),
      // Sparklines: 7-day CRM leads
      Lead.aggregate([
        { $match: { createdAt: { $gte: oldestSparkDay }, movedToPipeline: { $ne: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        }
      ]),
      // Lead sources distribution
      MetaLead.aggregate([
        {
          $addFields: {
            sourceLabel: {
              $let: {
                vars: {
                  p: { $toLower: { $ifNull: ['$platform', ''] } },
                  fn: { $toLower: { $ifNull: ['$formName', ''] } }
                },
                in: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$$p', 'ig'] }, then: 'Instagram' },
                      { case: { $eq: ['$$p', 'fb'] }, then: 'Facebook' },
                      { case: { $eq: ['$$p', 'website'] }, then: 'Website' },
                      { case: { $regexMatch: { input: '$$fn', regex: 'instagram' } }, then: 'Instagram' },
                      { case: { $regexMatch: { input: '$$fn', regex: 'website' } }, then: 'Website' },
                      { case: { $regexMatch: { input: '$$fn', regex: 'facebook' } }, then: 'Facebook' }
                    ],
                    default: {
                      $cond: [
                        { $gt: [{ $strLenCP: { $ifNull: ['$formName', ''] } }, 0] },
                        '$formName',
                        {
                          $cond: [
                            { $gt: [{ $strLenCP: { $ifNull: ['$pageName', ''] } }, 0] },
                            '$pageName',
                            'Website'
                          ]
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: '$sourceLabel',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 6 }
      ])
    ]);

    // Active employees excluding Admin role
    const activeEmployeesCount = await User.countDocuments({
      isActive: true,
      role: { $ne: adminRole?._id }
    });

    // Attendance present/absent calculation
    const adminRoleIdStr = adminRole?._id ? adminRole._id.toString() : '';
    const presentToday = todayAttendanceRecords.filter(r => {
      return r.employee && r.employee.role &&
        r.employee.role.toString() !== adminRoleIdStr;
    }).length;
    const absentToday = Math.max(0, activeEmployeesCount - presentToday);

    // Project status breakdown
    let completed = 0, working = 0, canceled = 0, activeProjects = 0;
    (projectStatusAgg || []).forEach(item => {
      const st = item._id;
      const cnt = item.count || 0;
      if (['completed', 'done', 'finished'].includes(st)) {
        completed += cnt;
      } else if (['active', 'in-progress', 'working', 'progress'].includes(st)) {
        working += cnt;
        if (st === 'active') activeProjects += cnt;
      } else if (['canceled', 'cancelled', 'aborted'].includes(st)) {
        canceled += cnt;
      }
    });
    if (activeProjects === 0 && working > 0) activeProjects = working;

    // Total leads combined
    const totalLeads = (totalMetaLeads || 0) + (totalCrmLeads || 0);

    // Calculate or use cached previous month stats
    let prevStats = previousStatsCache.data;
    const nowTimestamp = Date.now();
    if (!prevStats || (nowTimestamp - previousStatsCache.timestamp > CACHE_TTL)) {
      try {
        const [attPrevAgg, metaPrevCount, crmPrevCount, projPrevCount] = await Promise.all([
          Attendance.aggregate([
            { $match: { date: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: { $in: ['present', 'absent'] } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ]),
          MetaLead.countDocuments({ createdTime: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
          Lead.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
          Project.countDocuments({ createdAt: { $lte: lastMonthEnd }, status: { $in: ['active', 'on-hold'] } })
        ]);

        let pPrev = 0, aPrev = 0;
        attPrevAgg.forEach(item => {
          if (item._id === 'present') pPrev = item.count;
          else if (item._id === 'absent') aPrev = item.count;
        });

        prevStats = {
          presentToday: Math.round(pPrev / daysInLastMonth) || 0,
          absentToday: Math.round(aPrev / daysInLastMonth) || 0,
          totalLeads: metaPrevCount + crmPrevCount,
          activeProjects: projPrevCount
        };
        previousStatsCache = { timestamp: nowTimestamp, data: prevStats };
      } catch (cacheErr) {
        prevStats = { presentToday: 0, absentToday: 0, totalLeads: 0, activeProjects: 0 };
      }
    }

    // Build sparklines arrays from mapped aggregations
    const presentSparkMap = {};
    const absentSparkMap = {};
    (sparkAttAgg || []).forEach(item => {
      if (item._id.status === 'present') presentSparkMap[item._id.day] = item.count;
      else if (item._id.status === 'absent') absentSparkMap[item._id.day] = item.count;
    });

    const leadsSparkMap = {};
    (sparkMetaAgg || []).forEach(item => { leadsSparkMap[item._id] = (leadsSparkMap[item._id] || 0) + item.count; });
    (sparkCrmAgg || []).forEach(item => { leadsSparkMap[item._id] = (leadsSparkMap[item._id] || 0) + item.count; });

    const cardSparklines = {
      present: dayKeys.map(k => presentSparkMap[k] || 0),
      absent: dayKeys.map(k => absentSparkMap[k] || 0),
      leads: dayKeys.map(k => leadsSparkMap[k] || 0),
      projects: dayKeys.map(() => activeProjects)
    };

    // Format lead sources
    const GAUGE_COLORS = ['#162a16', '#3b775e', '#a8e63d', '#0891b2', '#8b5cf6', '#f59e0b'];
    const totalSourceCount = (leadSourceStats || []).reduce((sum, s) => sum + s.count, 0);
    const leadSources = (leadSourceStats || []).map((s, idx) => ({
      label: s._id || 'Unknown',
      color: GAUGE_COLORS[idx % GAUGE_COLORS.length],
      value: totalSourceCount > 0 ? Math.round((s.count / totalSourceCount) * 100) : 0,
      count: s.count
    }));

    res.json({
      success: true,
      stats: {
        presentToday,
        absentToday,
        activeProjects,
        totalLeads,
        totalActive: activeEmployeesCount
      },
      prevStats,
      cardSparklines,
      projectStatusCounts: {
        completed,
        working,
        canceled
      },
      leadSources
    });
  } catch (err) {
    console.error('Error in /api/dashboard/overview-summary:', err);
    res.status(500).json({ message: 'Server error in dashboard overview', error: err.message });
  }
});

/**
 * GET /api/dashboard/previous-stats
 * Returns counts for the previous month to calculate trends (cached)
 */
router.get('/previous-stats', auth, async (req, res) => {
  try {
    const now = Date.now();
    if (previousStatsCache.data && (now - previousStatsCache.timestamp < CACHE_TTL)) {
      return res.json(previousStatsCache.data);
    }

    const today = new Date();
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    const daysInMonth = lastMonthEnd.getDate();

    const [attPrevAgg, metaLeadsPrev, crmLeadsPrev, projectsPrev] = await Promise.all([
      Attendance.aggregate([
        { $match: { date: { $gte: lastMonthStart, $lte: lastMonthEnd }, status: { $in: ['present', 'absent'] } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      MetaLead.countDocuments({ createdTime: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
      Lead.countDocuments({ createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd } }),
      Project.countDocuments({ createdAt: { $lte: lastMonthEnd }, status: { $in: ['active', 'on-hold'] } })
    ]);

    let presentPrev = 0, absentPrev = 0;
    (attPrevAgg || []).forEach(item => {
      if (item._id === 'present') presentPrev = item.count;
      else if (item._id === 'absent') absentPrev = item.count;
    });

    const result = {
      presentToday: Math.round(presentPrev / daysInMonth) || 0,
      absentToday: Math.round(absentPrev / daysInMonth) || 0,
      totalLeads: metaLeadsPrev + crmLeadsPrev,
      activeProjects: projectsPrev
    };

    previousStatsCache = { timestamp: now, data: result };
    res.json(result);
  } catch (err) {
    console.error('Previous stats error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/dashboard/weekly-sparklines
 * Returns last-7-days daily counts for: present, absent, leads, active-projects
 * Optimized to use 3 aggregations instead of 28 individual countDocuments queries.
 */
router.get('/weekly-sparklines', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayKeys = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dayKeys.push(key);
    }
    const oldestDay = new Date(today);
    oldestDay.setDate(oldestDay.getDate() - 6);

    const [attAgg, metaAgg, crmAgg, activeProjects] = await Promise.all([
      Attendance.aggregate([
        { $match: { date: { $gte: oldestDay }, status: { $in: ['present', 'absent'] } } },
        {
          $group: {
            _id: {
              day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
              status: '$status'
            },
            count: { $sum: 1 }
          }
        }
      ]),
      MetaLead.aggregate([
        { $match: { createdTime: { $gte: oldestDay } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdTime' } },
            count: { $sum: 1 }
          }
        }
      ]),
      Lead.aggregate([
        { $match: { createdAt: { $gte: oldestDay }, movedToPipeline: { $ne: true } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        }
      ]),
      Project.countDocuments({ status: { $in: ['active', 'on-hold'] } })
    ]);

    const presentMap = {};
    const absentMap = {};
    (attAgg || []).forEach(item => {
      if (item._id.status === 'present') presentMap[item._id.day] = item.count;
      else if (item._id.status === 'absent') absentMap[item._id.day] = item.count;
    });

    const leadsMap = {};
    (metaAgg || []).forEach(item => { leadsMap[item._id] = (leadsMap[item._id] || 0) + item.count; });
    (crmAgg || []).forEach(item => { leadsMap[item._id] = (leadsMap[item._id] || 0) + item.count; });

    res.json({
      present: dayKeys.map(k => presentMap[k] || 0),
      absent: dayKeys.map(k => absentMap[k] || 0),
      leads: dayKeys.map(k => leadsMap[k] || 0),
      projects: dayKeys.map(() => activeProjects)
    });
  } catch (err) {
    console.error('Sparklines error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
