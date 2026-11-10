const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendNotification } = require('../utils/socketNotifier');

let isCheckingBirthdays = false;
let lastCheckTimestamp = 0;
const CHECK_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown between evaluations

/**
 * Evaluates active employees whose birthday is today,
 * sends a warm birthday wish notification to the employee,
 * and sends a birthday alert notification to all HR & Admin team members.
 * Guarantees idempotency (only 1 wish & 1 alert per employee per day).
 */
async function checkAndSendBirthdayNotifications(io = null) {
  const nowMs = Date.now();
  // Concurrency guard: if already running or checked recently, skip
  if (isCheckingBirthdays || (nowMs - lastCheckTimestamp < CHECK_COOLDOWN_MS)) {
    return;
  }
  isCheckingBirthdays = true;

  try {
    const now = new Date();
    // Get current month & day in IST (Asia/Kolkata)
    const istDateParts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    }).formatToParts(now);

    const dayObj = istDateParts.find(p => p.type === 'day');
    const monthObj = istDateParts.find(p => p.type === 'month');
    const yearObj = istDateParts.find(p => p.type === 'year');

    const currentDay = parseInt(dayObj?.value || now.getDate(), 10);
    const currentMonth = parseInt(monthObj?.value || (now.getMonth() + 1), 10); // 1-12
    const currentYear = parseInt(yearObj?.value || now.getFullYear(), 10);

    // Start and end of today in UTC for safe querying
    const startOfToday = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 0, 0, 0, 0));
    // Provide a small margin for timezone offsets
    startOfToday.setHours(startOfToday.getHours() - 12);
    const endOfToday = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay, 23, 59, 59, 999));
    endOfToday.setHours(endOfToday.getHours() + 12);

    // 1. Fetch all active employees with a dateOfBirth or dob
    const activeUsers = await User.find({
      isActive: true,
      $or: [
        { dateOfBirth: { $ne: null } },
        { dob: { $ne: null, $ne: '' } }
      ]
    }).populate('role');

    if (!activeUsers || activeUsers.length === 0) return;

    // 2. Identify employees whose birthday falls on currentDay & currentMonth
    const birthdayEmployees = activeUsers.filter(u => {
      const rawDob = u.dateOfBirth || u.dob;
      if (!rawDob) return false;
      const d = new Date(rawDob);
      if (isNaN(d.getTime())) return false;

      const utcMonth = d.getUTCMonth() + 1;
      const utcDay = d.getUTCDate();
      const localMonth = d.getMonth() + 1;
      const localDay = d.getDate();

      return (utcMonth === currentMonth && utcDay === currentDay) ||
             (localMonth === currentMonth && localDay === currentDay);
    });

    if (birthdayEmployees.length === 0) return;

    // 3. Identify all HR and Admin recipients
    const allUsers = await User.find({ isActive: true }).populate('role');
    const hrAndAdminUsers = allUsers.filter(u => {
      const roleName = (u.role?.name || (typeof u.role === 'string' ? u.role : '') || '').toString().trim().toLowerCase();
      return ['admin', 'director', 'hr', 'hr manager', 'super admin'].some(r => roleName === r || roleName.includes(r)) || u.isSuperAdmin;
    });

    const calendarLink = '/operations/calendar/overview?view=month';

    for (const bEmp of birthdayEmployees) {
      const empIdStr = bEmp._id.toString();
      const firstName = (bEmp.firstName || 'Colleague').trim();
      const fullName = `${bEmp.firstName || ''} ${bEmp.lastName || ''}`.trim() || firstName;
      const designation = bEmp.designation || (bEmp.role?.name) || 'Team Member';
      const department = bEmp.department ? ` • ${bEmp.department}` : '';

      // ── A. Send Birthday Wish to the Employee ──
      const wishTitle = `🎉 Happy Birthday, ${firstName}!`;
      const wishMessage = `Dear ${fullName}, the entire team at Bhoomi Techzone wishes you a very Happy Birthday! May your day be filled with joy, wonderful celebrations, and tremendous success in the year ahead! 🎂✨`;

      const existingWish = await Notification.findOne({
        user: bEmp._id,
        type: 'Birthday',
        title: { $regex: new RegExp(`Happy Birthday.*${firstName}`, 'i') },
        createdAt: { $gte: startOfToday, $lte: endOfToday }
      });

      if (!existingWish) {
        await sendNotification(io, bEmp._id, wishTitle, wishMessage, 'Birthday', calendarLink);
        console.log(`[BirthdayService] Sent birthday wish to employee: ${fullName} (${empIdStr})`);
      }

      // ── B. Send Birthday Alert to HR and Admins ──
      const alertTitle = `🎂 Birthday Alert: ${fullName}`;
      const alertMessage = `Today is ${fullName}'s birthday (${designation}${department})! Don't forget to wish them and celebrate! 🎈`;

      for (const adminUser of hrAndAdminUsers) {
        // If the admin user is the birthday person themselves, they already received the wish
        if (adminUser._id.toString() === empIdStr) continue;

        const existingAlert = await Notification.findOne({
          user: adminUser._id,
          type: 'Birthday',
          title: alertTitle,
          createdAt: { $gte: startOfToday, $lte: endOfToday }
        });

        if (!existingAlert) {
          await sendNotification(io, adminUser._id, alertTitle, alertMessage, 'Birthday', calendarLink);
        }
      }
      console.log(`[BirthdayService] Sent birthday alerts for ${fullName} to ${hrAndAdminUsers.length} HR/Admin members`);
    }

    lastCheckTimestamp = Date.now();
  } catch (err) {
    console.error('[BirthdayService] Error evaluating birthday notifications:', err);
  } finally {
    isCheckingBirthdays = false;
  }
}

module.exports = {
  checkAndSendBirthdayNotifications
};

