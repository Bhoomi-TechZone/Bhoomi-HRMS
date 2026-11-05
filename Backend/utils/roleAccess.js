const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Get module viewScope from user's role permissions ('public' | 'private' | 'team')
 */
function getModuleViewScope(user, moduleName = 'leads') {
  const roleObj = user?.role;
  const roleName = (typeof roleObj === 'object' && roleObj !== null ? roleObj.name : roleObj || user?.roleName || '').toString().toLowerCase().trim();

  // System administrators always have public access
  if (roleName === 'admin' || roleName === 'super admin' || roleName === 'director') {
    return 'public';
  }

  if (roleObj && Array.isArray(roleObj.permissions)) {
    const perm = roleObj.permissions.find(p => p.module && p.module.toLowerCase().trim() === moduleName.toLowerCase().trim());
    if (perm && perm.viewScope) {
      return perm.viewScope.toLowerCase().trim();
    }
  }

  // Fallback if not configured: sales heads/managers public, standard employees private
  const isManagerOrHead = roleName.includes('sales head') || roleName.includes('sales manager') || roleName === 'saleshead' || user?.isManager;
  return isManagerOrHead ? 'public' : 'private';
}

/**
 * Get all user ObjectIds and String IDs that belong to the user's team (including the user themselves)
 * - If user is a manager (or has direct reports), includes all direct reports (and sub-reports)
 * - If user is an employee reporting to a manager, includes their manager and teammates
 */
async function getTeamUserIds(userId) {
  const teamIdSet = new Set([userId.toString()]);
  const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;

  // 1. Direct reports: find all active employees where assignedManager is this user
  const directReports = await User.find({
    $or: [
      { assignedManager: userObjectId },
      { assignedManager: userId.toString() }
    ],
    isActive: { $ne: false },
    status: { $nin: ['Inactive', 'inactive', 'Suspended', 'Terminated'] }
  }).select('_id assignedManager isManager');

  const directReportIds = [];
  directReports.forEach(emp => {
    teamIdSet.add(emp._id.toString());
    directReportIds.push(emp._id);
  });

  // 2. Sub-reports (if any direct report is also a manager)
  if (directReportIds.length > 0) {
    const subReports = await User.find({
      assignedManager: { $in: directReportIds },
      isActive: { $ne: false },
      status: { $nin: ['Inactive', 'inactive', 'Suspended', 'Terminated'] }
    }).select('_id');
    subReports.forEach(emp => teamIdSet.add(emp._id.toString()));
  }

  // 3. Subordinate employee fallback: If current user does NOT have direct reports and is NOT a Sales Head/Manager,
  // their team includes their manager and teammates.
  // For a Sales Head or Manager (or anyone with direct reports), their team is strictly themselves and their subordinates.
  const currentUser = await User.findById(userObjectId).populate('role').select('assignedManager isManager role');
  const roleName = (currentUser?.role?.name || (typeof currentUser?.role === 'string' ? currentUser.role : '') || '').toString().toLowerCase().trim();
  const isHeadOrManager = roleName.includes('sales head') || roleName.includes('saleshead') || roleName.includes('sales manager') || roleName.includes('salesmanager') || directReportIds.length > 0 || currentUser?.isManager;

  if (!isHeadOrManager && currentUser && currentUser.assignedManager) {
    const mgrId = (currentUser.assignedManager._id || currentUser.assignedManager).toString();
    teamIdSet.add(mgrId);

    const mgrObjectId = mongoose.Types.ObjectId.isValid(mgrId) ? new mongoose.Types.ObjectId(mgrId) : mgrId;
    const peers = await User.find({
      $or: [
        { assignedManager: mgrObjectId },
        { assignedManager: mgrId }
      ],
      isActive: { $ne: false },
      status: { $nin: ['Inactive', 'inactive', 'Suspended', 'Terminated'] }
    }).select('_id');
    peers.forEach(p => teamIdSet.add(p._id.toString()));
  }

  const objectIds = Array.from(teamIdSet).filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
  const stringIds = Array.from(teamIdSet);
  return [...objectIds, ...stringIds];
}

module.exports = {
  getModuleViewScope,
  getTeamUserIds
};
