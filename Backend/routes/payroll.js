
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const Payroll = require('../models/Payroll');
const SalaryStructure = require('../models/SalaryStructure');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const SalaryRule = require('../models/SalaryRule');
const xlsx = require('xlsx');
const { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType } = require('docx');
const { sendSalaryPaidEmail, sendBulkSalaryPaidEmails } = require('../utils/emailService');
const { generateSalaryReceiptPDF } = require('../utils/pdfGenerator');
const ShiftConfig = require('../models/ShiftConfig');
const Holiday = require('../models/Holiday');
const Leave = require('../models/Leave');

// Helper to calculate employee monthly attendance, leaves (paid/unpaid) and payroll metrics
function calculateMonthlyAttendanceMetrics({
  employee,
  totalDaysInMonth,
  year,
  month,
  today,
  endDate,
  defaultWeekoffDays,
  allShiftConfigs,
  holidayDays,
  leaveMap,
  attendances,
  lateCheckInRule,
  lateThreshold,
  perDaySalary
}) {
  let presentCount = 0;
  let halfDayCount = 0;
  let absentCount = 0;
  let weekOffCount = 0;
  let holidayCount = 0;
  let lateCount = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let totalWorkingHours = 0;
  const dailyBreakdown = [];

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const currentDate = new Date(year, month - 1, day);
    const dayOfWeek = currentDate.getDay();

    let applicableWeekoffDays = defaultWeekoffDays;
    if (employee.shiftHistory && employee.shiftHistory.length > 0) {
      const historyEntry = employee.shiftHistory.find(h => {
        const s = new Date(h.startDate); s.setHours(0, 0, 0, 0);
        const e = h.endDate ? new Date(h.endDate) : new Date('2099-12-31');
        if (h.endDate) e.setHours(23, 59, 59, 999);
        return currentDate >= s && currentDate <= e;
      });
      if (historyEntry) {
        const matchingConfig = allShiftConfigs.find(sc => sc.type === historyEntry.shiftType);
        if (matchingConfig) applicableWeekoffDays = matchingConfig.weekoff || 1;
      }
    }

    const isWeekOff = (
      (applicableWeekoffDays >= 1 && dayOfWeek === 0) ||
      (applicableWeekoffDays >= 2 && dayOfWeek === 6) ||
      (applicableWeekoffDays >= 3 && dayOfWeek === 5)
    );
    const isHoliday = holidayDays.has(day);
    const leaveInfo = leaveMap.get(day);
    const isFutureDate = currentDate > today;
    const isToday = currentDate.getTime() === today.getTime();

    const att = attendances.find(a => new Date(a.date).getDate() === day);

    const leaveCat = (leaveInfo?.leaveCategory || '').toLowerCase().trim();
    const leaveTyp = (leaveInfo?.leaveType || '').toLowerCase().trim();
    const isUnpaidLeave = !!leaveInfo && (
      leaveCat.includes('unpaid') || leaveCat.includes('lop') ||
      leaveTyp.includes('unpaid') || leaveTyp.includes('lop')
    );
    const isHalfDayLeave = !!leaveInfo && (leaveInfo.durationType || '').toLowerCase().includes('half');

    let dayStatus;
    let dayLoginTime = null;
    let dayLogoutTime = null;
    let dayWorkingHours = 0;
    let dayIsLate = false;

    if (att) {
      const st = (att.status || '').toLowerCase().trim();
      dayLoginTime = att.loginTime || null;
      dayLogoutTime = att.logoutTime || null;
      dayWorkingHours = att.workingHours || 0;
      totalWorkingHours += dayWorkingHours;

      if (att.loginTime && lateCheckInRule) {
        const login = new Date(att.loginTime);
        const [hour, minute] = lateThreshold.split(':');
        const thresholdDate = new Date(login);
        thresholdDate.setHours(parseInt(hour, 10), parseInt(minute, 10), 0);
        if (login > thresholdDate) {
          dayIsLate = true;
          lateCount++;
        }
      }

      if (st === 'present' || st === 'late-checkin' || st === 'early-checkin') {
        presentCount++;
        dayStatus = 'Present';
      } else if (st === 'half-day') {
        dayStatus = 'Half-day';
        if (leaveInfo && !isUnpaidLeave) {
          // Half day present + half day paid leave = full day paid
          presentCount += 0.5;
          paidLeaveDays += 0.5;
        } else {
          // Half day worked, other half day is deducted via halfDayCount
          halfDayCount++;
        }
      } else if (st === 'absent') {
        absentCount++;
        dayStatus = 'Absent';
      } else if (st === 'week off' || st === 'week-off') {
        weekOffCount++;
        dayStatus = 'Week Off';
      } else if (st === 'not-checkout') {
        halfDayCount++;
        dayStatus = 'Half-day';
      } else if (st === 'checked-in') {
        if (isToday) {
          presentCount++;
          dayStatus = 'Present';
        } else if (!isFutureDate) {
          halfDayCount++;
          dayStatus = 'Half-day';
        } else {
          dayStatus = '—';
        }
      } else {
        absentCount++;
        dayStatus = 'Absent';
      }
    } else {
      // No attendance record for this day
      if (leaveInfo) {
        if (isUnpaidLeave) {
          unpaidLeaveDays += isHalfDayLeave ? 0.5 : 1;
          dayStatus = 'Unpaid Leave';
          if (isHalfDayLeave && !isFutureDate && !isToday) absentCount += 0.5;
        } else {
          paidLeaveDays += isHalfDayLeave ? 0.5 : 1;
          dayStatus = 'Leave';
          if (isHalfDayLeave && !isFutureDate && !isToday) absentCount += 0.5;
        }
      } else if (isWeekOff) {
        weekOffCount++;
        dayStatus = 'Week Off';
      } else if (isHoliday) {
        holidayCount++;
        dayStatus = 'Holiday';
      } else if (!isFutureDate && !isToday) {
        absentCount++;
        dayStatus = 'Absent';
      } else {
        dayStatus = '—';
      }
    }

    dailyBreakdown.push({
      day: day,
      date: currentDate.toISOString().split('T')[0],
      status: dayStatus,
      isWeekend: isWeekOff,
      isHoliday: isHoliday,
      leaveInfo: leaveInfo ? {
        leaveType: leaveInfo.leaveType,
        leaveCategory: leaveInfo.leaveCategory,
        durationType: leaveInfo.durationType,
        reason: leaveInfo.reason,
        status: leaveInfo.status
      } : null,
      loginTime: dayLoginTime,
      logoutTime: dayLogoutTime,
      workingHours: dayWorkingHours,
      isLate: dayIsLate,
      shift: 'General'
    });
  }

  // Count elapsed weekoffs/holidays/paid leaves up to today
  let elapsedWeekOffCount = 0;
  let elapsedHolidayCount = 0;
  let elapsedPaidLeaveCount = 0;

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const cDate = new Date(year, month - 1, d);
    if (cDate > today) break;

    const dOfWeek = cDate.getDay();
    let appWeekoff = defaultWeekoffDays;
    if (employee.shiftHistory && employee.shiftHistory.length > 0) {
      const hEntry = employee.shiftHistory.find(h => {
        const s = new Date(h.startDate); s.setHours(0, 0, 0, 0);
        const e = h.endDate ? new Date(h.endDate) : new Date('2099-12-31');
        if (h.endDate) e.setHours(23, 59, 59, 999);
        return cDate >= s && cDate <= e;
      });
      if (hEntry) {
        const mConfig = allShiftConfigs.find(sc => sc.type === hEntry.shiftType);
        if (mConfig) appWeekoff = mConfig.weekoff || 1;
      }
    }

    const isWo = (
      (appWeekoff >= 1 && dOfWeek === 0) ||
      (appWeekoff >= 2 && dOfWeek === 6) ||
      (appWeekoff >= 3 && dOfWeek === 5)
    );
    const isHol = holidayDays.has(d);
    const lInfo = leaveMap.get(d);
    const att = attendances.find(a => new Date(a.date).getDate() === d);

    const lCat = (lInfo?.leaveCategory || '').toLowerCase().trim();
    const lTyp = (lInfo?.leaveType || '').toLowerCase().trim();
    const isUnp = lCat.includes('unpaid') || lCat.includes('lop') || lTyp.includes('unpaid') || lTyp.includes('lop');

    if (att) {
      const st = (att.status || '').toLowerCase().trim();
      if (st === 'present' || st === 'late-checkin' || st === 'early-checkin') {
        // present
      } else if (st === 'half-day' || st === 'not-checkout' || st === 'checked-in') {
        // half day / checked in
      } else if (st === 'absent') {
        // Explicitly absent! Do NOT count towards elapsed week off or elapsed holiday!
      } else if (st === 'week off' || st === 'week-off') {
        elapsedWeekOffCount++;
      } else if (lInfo && !isUnp) {
        elapsedPaidLeaveCount++;
      } else if (isWo) {
        elapsedWeekOffCount++;
      } else if (isHol) {
        elapsedHolidayCount++;
      }
    } else {
      if (lInfo && !isUnp) {
        elapsedPaidLeaveCount++;
      } else if (isWo) {
        elapsedWeekOffCount++;
      } else if (isHol) {
        elapsedHolidayCount++;
      }
    }
  }

  const TOTAL_PAYROLL_DAYS = 30;
  const totalUnpaidDays = Number((absentCount + unpaidLeaveDays + (halfDayCount * 0.5)).toFixed(1));
  const isMonthCompleted = endDate <= today;
  let paidDaysForCalc;
  if (isMonthCompleted) {
    paidDaysForCalc = Math.min(TOTAL_PAYROLL_DAYS, Math.max(0, TOTAL_PAYROLL_DAYS - totalUnpaidDays));
  } else {
    const elapsedDays = Math.min(TOTAL_PAYROLL_DAYS, today.getDate());
    paidDaysForCalc = Math.min(elapsedDays, Math.max(0, elapsedDays - totalUnpaidDays));
  }

  const earnedGross = Number((paidDaysForCalc * perDaySalary).toFixed(2));
  const totalLossOfPay = Number((totalUnpaidDays * perDaySalary).toFixed(2));
  const halfDayDeduction = Number((halfDayCount * (perDaySalary * 0.5)).toFixed(2));
  const absentLossOfPay = Number(((absentCount + unpaidLeaveDays) * perDaySalary).toFixed(2));

  return {
    presentCount,
    halfDayCount,
    absentCount,
    weekOffCount,
    holidayCount,
    lateCount,
    paidLeaveDays,
    unpaidLeaveDays,
    totalWorkingHours,
    dailyBreakdown,
    elapsedWeekOffCount,
    elapsedHolidayCount,
    elapsedPaidLeaveCount,
    TOTAL_PAYROLL_DAYS,
    totalUnpaidDays,
    paidDaysForCalc,
    earnedGross,
    totalLossOfPay,
    halfDayDeduction,
    absentLossOfPay
  };
}

// Get employee's own payslip
router.get('/my-payslip', auth, async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const payslip = await Payroll.findOne({
      employee: req.user._id.toString(),
      'payPeriod.month': parseInt(month),
      'payPeriod.year': parseInt(year),
      status: 'paid'
    })
      .populate('employee', 'firstName lastName employeeId department designation email bankName accountNumber ifscCode panNumber')
      .populate('salaryStructure')
      .sort({ createdAt: -1 });

    if (!payslip) {
      return res.status(404).json({ message: 'Payslip not found' });
    }

    // Auto-sync detailed allowances from SalaryStructure if missing or zero
    try {
      const structure = payslip.salaryStructure || await SalaryStructure.findOne({
        $or: [{ employee: req.user._id }, { employee: req.user._id.toString() }],
        isActive: true
      });

      if (structure && structure.basicSalary) {
        const sAllow = structure.allowances || {};
        const sHra = Number(sAllow.hra) || 0;
        const sConv = Number(sAllow.conveyance || sAllow.transport) || 0;
        const sFood = Number(sAllow.food) || 0;
        const sDa = Number(sAllow.da) || 0;
        const sMed = Number(sAllow.medical) || 0;
        const sOther = Number(sAllow.other) || 0;
        const structTot = sHra + sConv + sFood + sDa + sMed + sOther;

        const curAllow = payslip.salaryDetails?.allowances || {};
        const curTot = (Number(curAllow.hra) || 0) + (Number(curAllow.conveyance || curAllow.transport) || 0) + (Number(curAllow.food) || 0) + (Number(curAllow.da) || 0) + (Number(curAllow.medical) || 0) + (Number(curAllow.other) || 0);

        if (structTot > 0 && (curTot === 0 || Number(payslip.salaryDetails?.basicSalary) > Number(structure.basicSalary))) {
          if (!payslip.salaryDetails) payslip.salaryDetails = {};
          payslip.salaryDetails.basicSalary = Number(structure.basicSalary);
          payslip.salaryDetails.allowances = {
            hra: sHra,
            conveyance: sConv,
            food: sFood,
            da: sDa,
            medical: sMed,
            transport: Number(sAllow.transport) || 0,
            other: sOther
          };
          payslip.salaryStructure = structure._id;
        }
      }

      // Calculate accurate LOP including half-days
      const absentDays = Number(payslip.workingDays?.absent) || 0;
      const halfDays = Number(payslip.workingDays?.halfDay ?? payslip.workingDays?.halfDays) || 0;
      const unpaidDays = absentDays + (halfDays * 0.5);

      const bSal = Number(payslip.salaryDetails?.basicSalary) || 0;
      const al = payslip.salaryDetails?.allowances || {};
      const totAl = (Number(al.hra) || 0) + (Number(al.conveyance || al.transport) || 0) + (Number(al.food) || 0) + (Number(al.da) || 0) + (Number(al.medical) || 0) + (Number(al.other) || 0);
      const fullGross = bSal + totAl;
      const perDaySalary = fullGross > 0 ? (fullGross / 30) : 0;
      const calculatedLop = unpaidDays > 0 ? Number((unpaidDays * perDaySalary).toFixed(2)) : 0;

      const d = payslip.salaryDetails?.deductions || {};
      const manualPenalty = Number(d.penalty) || 0;
      const latePenalty = Number(d.lateDeduction) || 0;
      const goalPenalty = Number(d.goalDeduction) || 0;
      const totalPenalties = manualPenalty + latePenalty + goalPenalty;
      const stdDed = (Number(d.pf) || 0) + (Number(d.esi) || 0) + (Number(d.tax) || 0) + (Number(d.loan) || 0) + (Number(d.advance) || 0) + (Number(d.other) || 0);

      const effectiveLop = calculatedLop;
      const netSalary = Number((fullGross + (payslip.salaryDetails?.bonus || 0) - effectiveLop - stdDed - totalPenalties).toFixed(2));

      if (!payslip.salaryDetails) payslip.salaryDetails = {};
      if (!payslip.salaryDetails.deductions) payslip.salaryDetails.deductions = {};
      payslip.salaryDetails.deductions.lossOfPay = effectiveLop;
      payslip.salaryDetails.deductions.halfDayDeduction = 0;
      payslip.salaryDetails.netSalary = netSalary;
      payslip.salaryDetails.totalDeductions = effectiveLop + stdDed + totalPenalties;

      await Payroll.findByIdAndUpdate(payslip._id, {
        'salaryDetails.basicSalary': payslip.salaryDetails.basicSalary,
        'salaryDetails.allowances': payslip.salaryDetails.allowances,
        'salaryDetails.deductions.lossOfPay': effectiveLop,
        'salaryDetails.deductions.halfDayDeduction': 0,
        'salaryDetails.netSalary': netSalary,
        'salaryDetails.totalDeductions': payslip.salaryDetails.totalDeductions,
        salaryStructure: structure?._id || payslip.salaryStructure
      });
    } catch (syncErr) {
      console.warn('Warning syncing structure for my-payslip:', syncErr.message);
    }

    res.json(payslip);
  } catch (error) {
    console.error('Error fetching my payslip:', error);
    res.status(500).json({ message: 'Error fetching payslip' });
  }
});

// Get all payroll records
router.get('/', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { month, year, status } = req.query;
    let query = {};

    if (month && year) {
      query['payPeriod.month'] = parseInt(month);
      query['payPeriod.year'] = parseInt(year);
    }

    if (status) {
      query.status = status;
    }

    const payrolls = await Payroll.find(query)
      .populate('employee', 'firstName lastName employeeId department designation email bankName accountNumber ifscCode panNumber')
      .populate('processedBy', 'firstName lastName')
      .populate('salaryStructure')
      .sort({ createdAt: -1 });

    res.json(payrolls);
  } catch (error) {
    console.error('Error fetching payroll records:', error);
    res.status(500).json({ message: 'Error fetching payroll records' });
  }
});

// Generate single individual salary slip (manual creation)
router.post('/generate-single', auth, checkPermission('payroll', 'create'), async (req, res) => {
  try {
    const { employee, month, year, salaryStructure, salaryDetails, workingDays } = req.body;

    if (!employee || !month || !year) {
      return res.status(400).json({ message: 'Employee, month, and year are required' });
    }

    const empUser = await User.findById(employee);
    if (!empUser) {
      return res.status(404).json({ message: 'Employee user not found' });
    }

    // Check if payroll already exists for this employee/period
    let payroll = await Payroll.findOne({
      employee: employee.toString(),
      'payPeriod.month': parseInt(month, 10),
      'payPeriod.year': parseInt(year, 10)
    });

    if (payroll) {
      // Update existing
      payroll.salaryDetails = salaryDetails;
      payroll.workingDays = workingDays;
      payroll.processedBy = req.user._id;
      payroll.processedAt = new Date();
      if (salaryStructure) payroll.salaryStructure = salaryStructure;
      await payroll.save();
    } else {
      // Create new
      payroll = new Payroll({
        employee: employee.toString(),
        employeeId: empUser.employeeId || 'N/A',
        salaryStructure: salaryStructure || null,
        payPeriod: {
          month: parseInt(month, 10),
          year: parseInt(year, 10)
        },
        workingDays: workingDays || {
          total: 30,
          present: 30,
          absent: 0
        },
        salaryDetails: salaryDetails,
        processedBy: req.user._id,
        processedAt: new Date(),
        status: 'draft'
      });
      await payroll.save();
    }

    const populatedPayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId department designation joiningDate bankName accountNumber ifscCode panNumber email')
      .populate('processedBy', 'firstName lastName');

    res.json(populatedPayroll);
  } catch (error) {
    console.error('Error generating single salary slip:', error);
    res.status(500).json({ message: 'Error generating salary slip' });
  }
});

// Calculate and Generate Payroll
router.post('/calculate', auth, checkPermission('payroll', 'create'), async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    // 1. Fetch Rules, ShiftConfigs, Holidays, Leaves
    const ShiftConfig = require('../models/ShiftConfig');
    const Holiday = require('../models/Holiday');
    const Leave = require('../models/Leave');

    const rules = await SalaryRule.find({ status: 'active' });
    const lateCheckInRule = rules.find(r => r.ruleType === 'Late Check-in');
    const lateThreshold = lateCheckInRule ? lateCheckInRule.threshold : "10:10 AM";

    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);
    const totalDaysInMonth = endDate.getDate();

    const todayNow = new Date();
    const today = new Date(todayNow.getFullYear(), todayNow.getMonth(), todayNow.getDate());

    const allShiftConfigs = await ShiftConfig.find({});
    const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
    const holidayDays = new Set(holidays.map(h => new Date(h.date).getDate()));

    // 2. Clear existing draft payrolls for this period to avoid duplicates,
    // but preserve any user customized additions, deductions, penalties, and audit history
    const existingDrafts = await Payroll.find({
      'payPeriod.month': parseInt(month, 10),
      'payPeriod.year': parseInt(year, 10),
      status: 'draft'
    });
    const preservedDraftData = new Map();
    existingDrafts.forEach(p => {
      const empId = p.employee ? p.employee.toString() : '';
      if (empId) {
        preservedDraftData.set(empId, {
          customComponents: p.customComponents || [],
          bonus: p.salaryDetails?.bonus || 0,
          penalty: p.salaryDetails?.deductions?.penalty || 0,
          editHistory: p.editHistory || []
        });
      }
    });

    await Payroll.deleteMany({
      'payPeriod.month': parseInt(month, 10),
      'payPeriod.year': parseInt(year, 10),
      status: 'draft'
    });

    const employees = await User.find({ isActive: true });
    const generatedPayrolls = [];

    for (const employee of employees) {
      // Get salary structure
      const structure = await SalaryStructure.findOne({
        $or: [{ employee: employee._id }, { employee: employee._id.toString() }],
        isActive: true
      });
      if (!structure) continue;

      // Check for existing processed/paid payroll to avoid duplicates
      const existingPayroll = await Payroll.findOne({
        employee: employee._id.toString(),
        'payPeriod.month': parseInt(month, 10),
        'payPeriod.year': parseInt(year, 10),
        status: { $ne: 'draft' }
      });

      if (existingPayroll) continue;

      const shiftConfig = allShiftConfigs.find(sc => sc.type === (employee.shiftType || 'morning'));
      const defaultWeekoffDays = shiftConfig?.weekoff || 1;

      // Fetch leaves for employee in this month
      const leaves = await Leave.find({
        employee: employee._id,
        status: { $nin: ['rejected', 'Rejected'] },
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      });

      const leaveMap = new Map();
      leaves.forEach(leave => {
        let cur = new Date(Math.max(new Date(leave.startDate).getTime(), startDate.getTime()));
        const last = new Date(Math.min(new Date(leave.endDate).getTime(), endDate.getTime()));
        cur.setHours(0, 0, 0, 0);
        last.setHours(23, 59, 59, 999);

        while (cur <= last) {
          leaveMap.set(cur.getDate(), leave);
          cur.setDate(cur.getDate() + 1);
        }
      });

      const attendances = await Attendance.find({
        employee: { $in: [employee._id, employee._id.toString()] },
        date: { $gte: startDate, $lte: endDate }
      });

      const totalAllowances = 
        (structure.allowances?.hra || 0) + 
        (structure.allowances?.da || 0) + 
        (structure.allowances?.conveyance || 0) + 
        (structure.allowances?.food || 0) + 
        (structure.allowances?.transport || 0) + 
        (structure.allowances?.medical || 0) + 
        (structure.allowances?.other || 0);

      const grossSalaryAmt = structure.basicSalary + totalAllowances;
      const perDaySalary = grossSalaryAmt / 30;

      const metrics = calculateMonthlyAttendanceMetrics({
        employee,
        totalDaysInMonth,
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        today,
        endDate,
        defaultWeekoffDays,
        allShiftConfigs,
        holidayDays,
        leaveMap,
        attendances,
        lateCheckInRule,
        lateThreshold,
        perDaySalary
      });

      const stdDeductions = structure.deductions || {};
      const totalStdDeductions =
        (stdDeductions.pf || 0) +
        (stdDeductions.esi || 0) +
        (stdDeductions.tax || 0) +
        (stdDeductions.loan || 0) +
        (stdDeductions.advance || 0) +
        (stdDeductions.other || 0);

      const preserved = preservedDraftData.get(employee._id.toString());
      const customComponentsToApply = preserved?.customComponents || [];
      const bonusToApply = preserved?.bonus || 0;
      const penaltyToApply = preserved?.penalty || 0;
      const editHistoryToApply = preserved?.editHistory || [];

      const customAdditions = customComponentsToApply
        .filter(c => (c.type || '').toLowerCase() === 'addition')
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const customDeductions = customComponentsToApply
        .filter(c => (c.type || '').toLowerCase() === 'deduction')
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      const lateDeduction = 0;
      const penaltyDeductions = Number((lateDeduction + penaltyToApply).toFixed(2));
      const totalDeductionsCalc = Number((metrics.totalLossOfPay + totalStdDeductions + penaltyDeductions + customDeductions).toFixed(2));
      const calculatedGross = Number((grossSalaryAmt + customAdditions).toFixed(2));
      const currentNet = Number(Math.max(0, metrics.earnedGross + bonusToApply + customAdditions - totalStdDeductions - penaltyDeductions - customDeductions).toFixed(2));

      const payroll = new Payroll({
        employee: employee._id.toString(),
        employeeId: employee.employeeId,
        salaryStructure: structure._id,
        payPeriod: { month: parseInt(month, 10), year: parseInt(year, 10) },
        workingDays: {
          total: metrics.TOTAL_PAYROLL_DAYS,
          present: metrics.presentCount,
          halfDay: metrics.halfDayCount,
          leave: Number((metrics.paidLeaveDays + metrics.unpaidLeaveDays).toFixed(1)),
          weekoff: metrics.elapsedWeekOffCount,
          holiday: metrics.elapsedHolidayCount,
          absent: Number((metrics.absentCount + metrics.unpaidLeaveDays).toFixed(1))
        },
        leaves: {
          paid: Number(metrics.paidLeaveDays.toFixed(1)),
          unpaid: Number(metrics.unpaidLeaveDays.toFixed(1))
        },
        attendance: {
          lateCheckIns: metrics.lateCount,
          present: metrics.presentCount,
          total: metrics.TOTAL_PAYROLL_DAYS
        },
        performance: {
          incompleteGoals: 0,
          status: 'COMPLETED'
        },
        salaryDetails: {
          basicSalary: structure.basicSalary,
          bonus: bonusToApply,
          gratuity: structure.gratuity || 0,
          allowances: {
            hra: structure.allowances?.hra || 0,
            da: structure.allowances?.da || 0,
            conveyance: structure.allowances?.conveyance || 0,
            food: structure.allowances?.food || 0,
            transport: structure.allowances?.transport || 0,
            medical: structure.allowances?.medical || 0,
            other: structure.allowances?.other || 0
          },
          deductions: {
            pf: stdDeductions.pf || 0,
            esi: stdDeductions.esi || 0,
            tax: stdDeductions.tax || 0,
            loan: stdDeductions.loan || 0,
            advance: stdDeductions.advance || 0,
            other: stdDeductions.other || 0,
            lossOfPay: metrics.totalLossOfPay,
            halfDayDeduction: 0,
            lateDeduction: lateDeduction,
            penalty: penaltyToApply,
            goalDeduction: 0
          },
          grossSalary: calculatedGross,
          totalDeductions: totalDeductionsCalc,
          netSalary: currentNet
        },
        customComponents: customComponentsToApply,
        editHistory: editHistoryToApply,
        processedBy: req.user._id,
        processedAt: new Date(),
        status: 'draft'
      });

      await payroll.save();
      generatedPayrolls.push(payroll);
    }

    res.json({
      message: `Payroll calculated for ${generatedPayrolls.length} employees`,
      count: generatedPayrolls.length
    });

  } catch (error) {
    console.error('Error calculating payroll:', error);
    res.status(500).json({ message: 'Error calculating payroll' });
  }
});

// Preview Payroll Stats for an Employee
router.get('/preview/:employeeId', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    // 1. Fetch Rules
    const rules = await SalaryRule.find({ status: 'active' });
    const lateCheckInRule = rules.find(r => r.ruleType === 'Late Check-in');

    // Default threshold for late check-in if not in rules
    const lateThreshold = lateCheckInRule ? lateCheckInRule.threshold : "10:10 AM";

    // 2. Fetch Attendance
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);

    const attendances = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    });

    let lateCount = 0;
    let presentCount = attendances.filter(a => a.status === 'present').length;
    const TOTAL_PAYROLL_DAYS = 30;
    let totalDays = TOTAL_PAYROLL_DAYS;

    attendances.forEach(att => {
      // Late Check-in logic
      if (att.loginTime && lateCheckInRule) {
        const login = new Date(att.loginTime);
        const [hour, minute] = lateThreshold.split(':');
        const thresholdDate = new Date(login);
        thresholdDate.setHours(parseInt(hour), parseInt(minute), 0);

        if (login > thresholdDate) lateCount++;
      }
    });

    const absentDays = totalDays - presentCount >= 0 ? totalDays - presentCount : 0;

    res.json({
      lateArrivals: lateCount,
      uninformedLeave: absentDays
    });

  } catch (error) {
    console.error('Error previewing payroll stats:', error);
    res.status(500).json({ message: 'Error fetching payroll stats' });
  }
});

// Update payroll status (draft, approved, paid)
router.patch('/:id/status', auth, checkPermission('payroll', 'update'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['draft', 'approved', 'processed', 'paid'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be draft, approved, or paid' });
    }

    const updateData = { status };
    if (status === 'paid') {
      updateData.paidAt = new Date();
    } else if (status === 'approved' || status === 'processed') {
      updateData.processedBy = req.user._id;
      updateData.processedAt = new Date();
    }

    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
      .populate('employee', 'firstName lastName email employeeId designation department bankName accountNumber')
      .populate('processedBy', 'firstName lastName');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    if (status === 'paid' && payroll.employee && payroll.employee.email) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = months[payroll.payPeriod.month - 1];

      sendSalaryPaidEmail(payroll.employee, payroll, monthName, payroll.payPeriod.year)
        .then(result => {
          if (result.success) console.log(`✅ Salary notification sent to ${payroll.employee.email}`);
        })
        .catch(err => console.error('Email error:', err));
    }

    res.json(payroll);
  } catch (error) {
    console.error('Error updating payroll status:', error);
    res.status(500).json({ message: 'Error updating payroll status' });
  }
});

// Finalize payroll
router.patch('/:id/finalize', auth, checkPermission('payroll', 'update'), async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      { status: 'processed', processedBy: req.user._id, processedAt: new Date() },
      { new: true }
    )
      .populate('employee', 'firstName lastName email employeeId designation department bankName accountNumber')
      .populate('processedBy', 'firstName lastName');
    res.json(payroll);
  } catch (error) {
    res.status(500).json({ message: 'Error finalizing payroll' });
  }
});

// Mark as paid
router.patch('/:id/mark-paid', auth, checkPermission('payroll', 'update'), async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      { status: 'paid', paidAt: new Date() },
      { new: true }
    )
      .populate('employee', 'firstName lastName email employeeId designation department bankName accountNumber')
      .populate('processedBy', 'firstName lastName');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    // Send email notification to employee
    if (payroll.employee && payroll.employee.email) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = months[payroll.payPeriod.month - 1];

      // Send email asynchronously (don't wait for it)
      sendSalaryPaidEmail(payroll.employee, payroll, monthName, payroll.payPeriod.year)
        .then(result => {
          if (result.success) {
            console.log(`✅ Salary notification sent to ${payroll.employee.email}`);
          } else {
            console.log(`⚠️ Failed to send notification to ${payroll.employee.email}: ${result.error}`);
          }
        })
        .catch(err => console.error('Email error:', err));
    }

    res.json(payroll);
  } catch (error) {
    console.error('Error marking payroll as paid:', error);
    res.status(500).json({ message: 'Error marking payroll as paid' });
  }
});

// Mark all payrolls as paid for a month (bulk operation)
router.patch('/mark-all-paid', auth, checkPermission('payroll', 'update'), async (req, res) => {
  try {
    const { month, year } = req.body;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    // Update all payrolls for this period
    await Payroll.updateMany(
      {
        'payPeriod.month': parseInt(month),
        'payPeriod.year': parseInt(year),
        status: { $ne: 'paid' }
      },
      { status: 'paid', paidAt: new Date() }
    );

    // Fetch updated payrolls with employee details for email
    const payrolls = await Payroll.find({
      'payPeriod.month': parseInt(month),
      'payPeriod.year': parseInt(year),
      status: 'paid'
    }).populate('employee', 'firstName lastName email employeeId designation department bankName accountNumber');

    // Send bulk email notifications
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = months[parseInt(month) - 1];

    sendBulkSalaryPaidEmails(payrolls, monthName, year)
      .then(results => {
        const successful = results.filter(r => r.success).length;
        console.log(`✅ Sent ${successful}/${results.length} salary notifications for ${monthName} ${year}`);
      })
      .catch(err => console.error('Bulk email error:', err));

    res.json({
      message: `All payrolls marked as paid for ${monthName} ${year}`,
      count: payrolls.length
    });
  } catch (error) {
    console.error('Error marking all payrolls as paid:', error);
    res.status(500).json({ message: 'Error marking payrolls as paid' });
  }
});

// Clear all payroll records for a period
router.delete('/clear-period', auth, checkPermission('payroll', 'delete'), async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const result = await Payroll.deleteMany({
      'payPeriod.month': parseInt(month),
      'payPeriod.year': parseInt(year)
    });

    res.json({ message: `Deleted ${result.deletedCount} payroll records for the selected period` });
  } catch (error) {
    console.error('Error clearing payroll period:', error);
    res.status(500).json({ message: 'Error clearing payroll records' });
  }
});

// Edit payroll record (bonus, penalty, and custom additions/deductions)
router.put('/:id', auth, checkPermission('payroll', 'update'), async (req, res) => {
  try {
    const { bonus, penalty, customComponents, remarks } = req.body;
    
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    if (payroll.status === 'paid') {
      return res.status(400).json({ message: 'Cannot edit an already paid payroll' });
    }

    // Capture previous state for history tracking
    const prevBonus = payroll.salaryDetails?.bonus || 0;
    const prevPenalty = payroll.salaryDetails?.deductions?.penalty || 0;
    const prevGross = payroll.salaryDetails?.grossSalary || 0;
    const prevNet = payroll.salaryDetails?.netSalary || 0;
    const prevComponents = Array.isArray(payroll.customComponents) ? JSON.parse(JSON.stringify(payroll.customComponents)) : [];

    // Update fields
    if (bonus !== undefined) {
      payroll.salaryDetails.bonus = Number(bonus) || 0;
    }
    if (!payroll.salaryDetails.deductions) {
      payroll.salaryDetails.deductions = {};
    }
    if (penalty !== undefined) {
      payroll.salaryDetails.deductions.penalty = Number(penalty) || 0;
    }

    // Ensure LOP and paid-days earned gross are accurately preserved
    const absentDays = payroll.workingDays?.absent || 0;
    const halfDays = payroll.workingDays?.halfDay || 0;
    const unpaidDays = absentDays + (halfDays * 0.5);
    const paidDays = Math.max(0, 30 - unpaidDays);

    const allowances = payroll.salaryDetails?.allowances || {};
    const totalAllowances = (allowances.hra || 0) + (allowances.da || 0) + (allowances.conveyance || 0) + (allowances.food || 0) + (allowances.transport || 0) + (allowances.medical || 0) + (allowances.other || 0);
    const fullMonthlyGross = (payroll.salaryDetails?.basicSalary || 0) + totalAllowances;
    const perDaySalary = fullMonthlyGross > 0 ? (fullMonthlyGross / 30) : 0;
    const earnedGross = fullMonthlyGross > 0 ? Number((paidDays * perDaySalary).toFixed(2)) : (payroll.salaryDetails?.grossSalary || 0);
    const calculatedLop = unpaidDays > 0 ? Number((unpaidDays * perDaySalary).toFixed(2)) : 0;

    // Loss of Pay is strictly calculated on unpaidDays (e.g. 0.5 for half-day = 0.5 * per-day salary)
    payroll.salaryDetails.deductions.lossOfPay = calculatedLop;
    payroll.salaryDetails.deductions.halfDayDeduction = 0;

    // Process custom additions and deductions
    if (Array.isArray(customComponents)) {
      payroll.customComponents = customComponents
        .filter(c => c && c.title && c.title.trim() && Number(c.amount) > 0)
        .map(c => ({
          title: c.title.trim(),
          type: (c.type || 'addition').toString().trim().toLowerCase() === 'deduction' ? 'deduction' : 'addition',
          amount: Number(c.amount) || 0,
          remarks: (c.remarks || '').trim()
        }));
    }

    const customAdditions = (payroll.customComponents || [])
      .filter(c => (c.type || '').toLowerCase() === 'addition')
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const customDeductions = (payroll.customComponents || [])
      .filter(c => (c.type || '').toLowerCase() === 'deduction')
      .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

    const newGross = Number((fullMonthlyGross + customAdditions).toFixed(2));
    payroll.salaryDetails.grossSalary = newGross;

    const totalStdDeductions =
      (payroll.salaryDetails.deductions?.pf || 0) +
      (payroll.salaryDetails.deductions?.esi || 0) +
      (payroll.salaryDetails.deductions?.tax || 0) +
      (payroll.salaryDetails.deductions?.loan || 0) +
      (payroll.salaryDetails.deductions?.advance || 0) +
      (payroll.salaryDetails.deductions?.other || 0) +
      (payroll.salaryDetails.deductions?.penalty || 0) +
      (payroll.salaryDetails.deductions?.lateDeduction || 0);

    const totalDeductions = Number((calculatedLop + totalStdDeductions + customDeductions).toFixed(2));
    payroll.salaryDetails.totalDeductions = totalDeductions;

    // Final Net salary = earnedGross + bonus + customAdditions - totalStdDeductions - customDeductions
    const finalNet = Number(Math.max(0, earnedGross + (payroll.salaryDetails.bonus || 0) + customAdditions - totalStdDeductions - customDeductions).toFixed(2));
    payroll.salaryDetails.netSalary = finalNet;

    // Build changes summary for audit history
    const changes = [];
    const newBonus = Number(payroll.salaryDetails.bonus) || 0;
    const newPenalty = Number(payroll.salaryDetails.deductions.penalty) || 0;
    if (newBonus !== prevBonus) {
      changes.push(`Bonus: ₹${prevBonus.toFixed(2)} → ₹${newBonus.toFixed(2)}`);
    }
    if (newPenalty !== prevPenalty) {
      changes.push(`Penalty: ₹${prevPenalty.toFixed(2)} → ₹${newPenalty.toFixed(2)}`);
    }
    const currentComponents = payroll.customComponents || [];
    if (JSON.stringify(currentComponents) !== JSON.stringify(prevComponents)) {
      const compDesc = currentComponents.map(c => `${c.type === 'deduction' ? '-' : '+'}${c.title} (₹${Number(c.amount).toFixed(2)})`).join(', ');
      changes.push(`Components (${currentComponents.length}): ${compDesc || 'None'}`);
    }
    if (newGross !== prevGross) {
      changes.push(`Gross: ₹${prevGross.toFixed(2)} → ₹${newGross.toFixed(2)}`);
    }
    if (finalNet !== prevNet) {
      changes.push(`Net Pay: ₹${prevNet.toFixed(2)} → ₹${finalNet.toFixed(2)}`);
    }

    const editorName = req.user ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email || 'Admin' : 'Admin';

    if (!Array.isArray(payroll.editHistory)) {
      payroll.editHistory = [];
    }

    payroll.editHistory.push({
      editedBy: req.user?._id,
      editedByName: editorName,
      editedAt: new Date(),
      action: 'Updated Payroll Record',
      changesSummary: changes.length > 0 ? changes.join(' | ') : 'Saved adjustments',
      previousState: {
        grossSalary: prevGross,
        netSalary: prevNet,
        bonus: prevBonus,
        penalty: prevPenalty,
        customComponents: prevComponents
      },
      newState: {
        grossSalary: newGross,
        netSalary: finalNet,
        bonus: newBonus,
        penalty: newPenalty,
        customComponents: currentComponents
      },
      remarks: (remarks || '').trim()
    });

    payroll.markModified('salaryDetails');
    payroll.markModified('customComponents');
    payroll.markModified('editHistory');

    await payroll.save();

    const populatedPayroll = await Payroll.findById(payroll._id)
      .populate('employee', 'firstName lastName employeeId department designation email bankName accountNumber ifscCode panNumber')
      .populate('processedBy', 'firstName lastName')
      .populate('editHistory.editedBy', 'firstName lastName email');

    res.json({ message: 'Payroll updated successfully', payroll: populatedPayroll });
  } catch (error) {
    console.error('Error updating payroll:', error);
    res.status(500).json({ message: 'Error updating payroll record' });
  }
});

// Get audit/edit history of a payroll record
router.get('/:id/history', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId designation department email')
      .populate('processedBy', 'firstName lastName email')
      .populate('editHistory.editedBy', 'firstName lastName email role');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    const allowances = payroll.salaryDetails?.allowances || {};
    const totalAllowances = (allowances.hra || 0) + (allowances.da || 0) + (allowances.conveyance || 0) + (allowances.food || 0) + (allowances.transport || 0) + (allowances.medical || 0) + (allowances.other || 0);
    const basicSalary = payroll.salaryDetails?.basicSalary || 0;
    const baseGross = (basicSalary + totalAllowances) > 0 ? (basicSalary + totalAllowances) : (payroll.salaryDetails?.grossSalary || 0);

    res.json({
      payrollId: payroll._id,
      employee: payroll.employee,
      payPeriod: payroll.payPeriod,
      status: payroll.status,
      baseGross: baseGross,
      currentGross: payroll.salaryDetails?.grossSalary || baseGross,
      currentNet: payroll.salaryDetails?.netSalary || 0,
      currentBonus: payroll.salaryDetails?.bonus || 0,
      currentPenalty: payroll.salaryDetails?.deductions?.penalty || 0,
      currentComponents: payroll.customComponents || [],
      createdAt: payroll.createdAt,
      processedBy: payroll.processedBy,
      history: (payroll.editHistory || []).slice().reverse()
    });
  } catch (error) {
    console.error('Error fetching payroll history:', error);
    res.status(500).json({ message: 'Error fetching payroll history' });
  }
});

// Delete payroll record
router.delete('/:id', auth, checkPermission('payroll', 'delete'), async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndDelete(req.params.id);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }
    res.json({ message: 'Payroll record deleted successfully' });
  } catch (error) {
    console.error('Error deleting payroll record:', error);
    res.status(500).json({ message: 'Error deleting payroll record' });
  }
});

// Bulk delete payroll records
router.post('/bulk-delete', auth, checkPermission('payroll', 'delete'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No payroll IDs provided for deletion' });
    }

    const result = await Payroll.deleteMany({ _id: { $in: ids } });
    res.json({ message: `Successfully deleted ${result.deletedCount} payroll record(s)`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Error bulk deleting payroll records:', error);
    res.status(500).json({ message: 'Error deleting payroll records' });
  }
});

// Recalculate / Regenerate selected payroll records
router.post('/recalculate-selected', auth, checkPermission('payroll', 'create'), async (req, res) => {
  try {
    const { month, year, ids } = req.body;

    if (!month || !year || !ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Month, year, and payroll IDs are required' });
    }

    const targetPayrolls = await Payroll.find({ _id: { $in: ids } });
    if (targetPayrolls.length === 0) {
      return res.status(404).json({ message: 'No matching payroll records found' });
    }

    const employeeIdsToRegenerate = targetPayrolls.map(p => p.employee.toString());

    const ShiftConfig = require('../models/ShiftConfig');
    const Holiday = require('../models/Holiday');
    const Leave = require('../models/Leave');

    const rules = await SalaryRule.find({ status: 'active' });
    const lateCheckInRule = rules.find(r => r.ruleType === 'Late Check-in');
    const lateThreshold = lateCheckInRule ? lateCheckInRule.threshold : "10:10 AM";

    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);
    const totalDaysInMonth = endDate.getDate();

    const todayNow = new Date();
    const today = new Date(todayNow.getFullYear(), todayNow.getMonth(), todayNow.getDate());

    const allShiftConfigs = await ShiftConfig.find({});
    const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
    const holidayDays = new Set(holidays.map(h => new Date(h.date).getDate()));

    // Preserve existing draft data (components, bonus, penalty, history)
    const preservedDraftData = new Map();
    targetPayrolls.forEach(p => {
      const empId = p.employee ? p.employee.toString() : '';
      if (empId) {
        preservedDraftData.set(empId, {
          customComponents: p.customComponents || [],
          bonus: p.salaryDetails?.bonus || 0,
          penalty: p.salaryDetails?.deductions?.penalty || 0,
          editHistory: p.editHistory || []
        });
      }
    });

    // Delete existing target payrolls
    await Payroll.deleteMany({ _id: { $in: ids } });

    const employees = await User.find({ _id: { $in: employeeIdsToRegenerate } });
    const regeneratedPayrolls = [];

    for (const employee of employees) {
      const structure = await SalaryStructure.findOne({
        $or: [{ employee: employee._id }, { employee: employee._id.toString() }],
        isActive: true
      });
      if (!structure) continue;

      const shiftConfig = allShiftConfigs.find(sc => sc.type === (employee.shiftType || 'morning'));
      const defaultWeekoffDays = shiftConfig?.weekoff || 1;

      const leaves = await Leave.find({
        employee: employee._id,
        status: { $nin: ['rejected', 'Rejected'] },
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      });

      const leaveMap = new Map();
      leaves.forEach(leave => {
        let cur = new Date(Math.max(new Date(leave.startDate).getTime(), startDate.getTime()));
        const last = new Date(Math.min(new Date(leave.endDate).getTime(), endDate.getTime()));
        cur.setHours(0, 0, 0, 0);
        last.setHours(23, 59, 59, 999);

        while (cur <= last) {
          leaveMap.set(cur.getDate(), leave);
          cur.setDate(cur.getDate() + 1);
        }
      });

      const attendances = await Attendance.find({
        employee: { $in: [employee._id, employee._id.toString()] },
        date: { $gte: startDate, $lte: endDate }
      });

      const totalAllowances = 
        (structure.allowances?.hra || 0) + 
        (structure.allowances?.da || 0) + 
        (structure.allowances?.conveyance || 0) + 
        (structure.allowances?.food || 0) + 
        (structure.allowances?.transport || 0) + 
        (structure.allowances?.medical || 0) + 
        (structure.allowances?.other || 0);

      const grossSalaryAmt = structure.basicSalary + totalAllowances;
      const perDaySalary = grossSalaryAmt / 30;

      const metrics = calculateMonthlyAttendanceMetrics({
        employee,
        totalDaysInMonth,
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        today,
        endDate,
        defaultWeekoffDays,
        allShiftConfigs,
        holidayDays,
        leaveMap,
        attendances,
        lateCheckInRule,
        lateThreshold,
        perDaySalary
      });

      const stdDeductions = structure.deductions || {};
      const totalStdDeductions =
        (stdDeductions.pf || 0) +
        (stdDeductions.esi || 0) +
        (stdDeductions.tax || 0) +
        (stdDeductions.loan || 0) +
        (stdDeductions.advance || 0) +
        (stdDeductions.other || 0);

      const preserved = preservedDraftData.get(employee._id.toString());
      const customComponentsToApply = preserved?.customComponents || [];
      const bonusToApply = preserved?.bonus || 0;
      const penaltyToApply = preserved?.penalty || 0;
      const editHistoryToApply = preserved?.editHistory || [];

      const customAdditions = customComponentsToApply
        .filter(c => (c.type || '').toLowerCase() === 'addition')
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const customDeductions = customComponentsToApply
        .filter(c => (c.type || '').toLowerCase() === 'deduction')
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      const lateDeduction = 0;
      const penaltyDeductions = Number((lateDeduction + penaltyToApply).toFixed(2));
      const totalDeductionsCalc = Number((metrics.totalLossOfPay + totalStdDeductions + penaltyDeductions + customDeductions).toFixed(2));
      const calculatedGross = Number((grossSalaryAmt + customAdditions).toFixed(2));
      const currentNet = Number(Math.max(0, metrics.earnedGross + bonusToApply + customAdditions - totalStdDeductions - penaltyDeductions - customDeductions).toFixed(2));

      const payroll = new Payroll({
        employee: employee._id.toString(),
        employeeId: employee.employeeId,
        salaryStructure: structure._id,
        payPeriod: { month: parseInt(month, 10), year: parseInt(year, 10) },
        workingDays: {
          total: metrics.TOTAL_PAYROLL_DAYS,
          present: metrics.presentCount,
          halfDay: metrics.halfDayCount,
          leave: Number((metrics.paidLeaveDays + metrics.unpaidLeaveDays).toFixed(1)),
          weekoff: metrics.elapsedWeekOffCount,
          holiday: metrics.elapsedHolidayCount,
          absent: Number((metrics.absentCount + metrics.unpaidLeaveDays).toFixed(1))
        },
        leaves: {
          paid: Number(metrics.paidLeaveDays.toFixed(1)),
          unpaid: Number(metrics.unpaidLeaveDays.toFixed(1))
        },
        attendance: {
          lateCheckIns: metrics.lateCount,
          present: metrics.presentCount,
          total: metrics.TOTAL_PAYROLL_DAYS
        },
        performance: {
          incompleteGoals: 0,
          status: 'COMPLETED'
        },
        salaryDetails: {
          basicSalary: structure.basicSalary,
          bonus: bonusToApply,
          gratuity: structure.gratuity || 0,
          allowances: {
            hra: structure.allowances?.hra || 0,
            da: structure.allowances?.da || 0,
            conveyance: structure.allowances?.conveyance || 0,
            food: structure.allowances?.food || 0,
            transport: structure.allowances?.transport || 0,
            medical: structure.allowances?.medical || 0,
            other: structure.allowances?.other || 0
          },
          deductions: {
            pf: stdDeductions.pf || 0,
            esi: stdDeductions.esi || 0,
            tax: stdDeductions.tax || 0,
            loan: stdDeductions.loan || 0,
            advance: stdDeductions.advance || 0,
            other: stdDeductions.other || 0,
            lossOfPay: metrics.totalLossOfPay,
            halfDayDeduction: 0,
            lateDeduction: lateDeduction,
            penalty: penaltyToApply,
            goalDeduction: 0
          },
          grossSalary: calculatedGross,
          totalDeductions: totalDeductionsCalc,
          netSalary: currentNet
        },
        customComponents: customComponentsToApply,
        editHistory: editHistoryToApply,
        processedBy: req.user._id,
        processedAt: new Date(),
        status: 'draft'
      });

      await payroll.save();
      regeneratedPayrolls.push(payroll);
    }

    res.json({ message: `Successfully recalculated ${regeneratedPayrolls.length} payroll record(s)`, count: regeneratedPayrolls.length });
  } catch (error) {
    console.error('Error recalculating selected payrolls:', error);
    res.status(500).json({ message: 'Error recalculating payroll records' });
  }
});

// Stats summary
router.get('/summary/stats', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const match = {
      'payPeriod.month': parseInt(month),
      'payPeriod.year': parseInt(year)
    };

    const stats = await Payroll.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalEmployees: { $sum: 1 },
          totalGrossSalary: { $sum: '$salaryDetails.grossSalary' },
          totalDeductions: { $sum: '$salaryDetails.totalDeductions' },
          totalNetSalary: { $sum: '$salaryDetails.netSalary' }
        }
      }
    ]);

    res.json(stats[0] || {
      totalEmployees: 0,
      totalGrossSalary: 0,
      totalDeductions: 0,
      totalNetSalary: 0
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching stats' });
  }
});

// Get detailed employee attendance breakdown for a month
router.get('/employee-attendance/:employeeId', auth, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    // Check if user is viewing their own data or has admin permission
    const hasAdminAccess = req.user.role.permissions.find(
      p => p.module === 'payroll' && p.actions.includes('read')
    );

    const isOwnData = req.user._id.toString() === employeeId;

    if (!isOwnData && !hasAdminAccess) {
      return res.status(403).json({ message: 'Access denied. You can only view your own attendance details.' });
    }

    // Get employee details
    const employee = await User.findById(employeeId).select('firstName lastName employeeId department designation shiftType shiftHistory');
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // Get attendance date range for the month
    const startDate = new Date(year, month - 1, 1);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(year, month, 0);
    endDate.setHours(23, 59, 59, 999);
    const totalDaysInMonth = endDate.getDate();

    const todayNow = new Date();
    const today = new Date(todayNow.getFullYear(), todayNow.getMonth(), todayNow.getDate());

    // Get shift configs, holidays and leaves
    const ShiftConfig = require('../models/ShiftConfig');
    const Holiday = require('../models/Holiday');
    const Leave = require('../models/Leave');

    const shiftConfig = await ShiftConfig.findOne({ type: employee.shiftType || 'morning' });
    const defaultWeekoffDays = shiftConfig?.weekoff || 1;
    const allShiftConfigs = await ShiftConfig.find({});

    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate }
    });

    const holidayDays = new Set(
      holidays.map(h => new Date(h.date).getDate())
    );

    // Get leaves for employee in this month
    const leaves = await Leave.find({
      employee: employeeId,
      status: { $nin: ['rejected', 'Rejected'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    });

    // Create leave map for daily lookup
    const leaveMap = new Map();
    leaves.forEach(leave => {
      let cur = new Date(Math.max(new Date(leave.startDate).getTime(), startDate.getTime()));
      const last = new Date(Math.min(new Date(leave.endDate).getTime(), endDate.getTime()));
      cur.setHours(0, 0, 0, 0);
      last.setHours(23, 59, 59, 999);

      while (cur <= last) {
        leaveMap.set(cur.getDate(), {
          leaveType: leave.leaveType,
          leaveCategory: leave.leaveCategory,
          durationType: leave.durationType,
          reason: leave.reason,
          status: leave.status
        });
        cur.setDate(cur.getDate() + 1);
      }
    });

    // Get salary structure
    const structure = await SalaryStructure.findOne({
      $or: [{ employee: employeeId }, { employee: employeeId.toString() }],
      isActive: true
    });

    const attendances = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Get salary rules
    const rules = await SalaryRule.find({ status: 'active' });
    const lateCheckInRule = rules.find(r => r.ruleType === 'Late Check-in');
    const lateThreshold = lateCheckInRule ? lateCheckInRule.threshold : "10:10 AM";

    const totalAllowances = 
      (structure?.allowances?.hra || 0) + 
      (structure?.allowances?.da || 0) + 
      (structure?.allowances?.conveyance || 0) + 
      (structure?.allowances?.food || 0) + 
      (structure?.allowances?.transport || 0) + 
      (structure?.allowances?.medical || 0) + 
      (structure?.allowances?.other || 0);

    const grossSalaryAmt = (structure?.basicSalary || 0) + totalAllowances;
    const perDaySalary = grossSalaryAmt > 0 ? (grossSalaryAmt / 30) : 0;

    const metrics = calculateMonthlyAttendanceMetrics({
      employee,
      totalDaysInMonth,
      year: parseInt(year, 10),
      month: parseInt(month, 10),
      today,
      endDate,
      defaultWeekoffDays,
      allShiftConfigs,
      holidayDays,
      leaveMap,
      attendances,
      lateCheckInRule,
      lateThreshold,
      perDaySalary
    });

    const basicSalary = structure?.basicSalary || 0;
    const TOTAL_PAYROLL_DAYS = 30;
    const presentEarnings = Number((metrics.paidDaysForCalc * perDaySalary).toFixed(2));
    const lateDeduction = 0;

    let payrollData = null;
    if (structure) {
      const goalDeduction = 0;
      const stdDeductions = structure.deductions || {};
      const totalStdDed = (stdDeductions.pf || 0) + (stdDeductions.esi || 0) + (stdDeductions.tax || 0) + (stdDeductions.loan || 0) + (stdDeductions.advance || 0) + (stdDeductions.other || 0);

      let totalPenaltyDed = Number((lateDeduction + goalDeduction + metrics.halfDayDeduction).toFixed(2));
      let netSalary = Number((presentEarnings + 0 - (totalStdDed + totalPenaltyDed)).toFixed(2));

      payrollData = {
        basicSalary: structure.basicSalary,
        bonus: 0,
        gratuity: structure.gratuity || 0,
        grossSalary: structure.grossSalary,
        pf: stdDeductions.pf || 0,
        esi: stdDeductions.esi || 0,
        tax: stdDeductions.tax || 0,
        loan: stdDeductions.loan || 0,
        advance: stdDeductions.advance || 0,
        totalDeductions: (totalStdDed + totalPenaltyDed),
        netSalary: netSalary,
        deductionBreakdown: {
          lateDeduction: lateDeduction,
          halfDayDeduction: metrics.halfDayDeduction,
          goalDeduction: goalDeduction,
          lossOfPay: metrics.totalLossOfPay
        }
      };
    }

    res.json({
      employee: {
        id: employee._id,
        name: `${employee.firstName} ${employee.lastName}`,
        employeeId: employee.employeeId,
        department: employee.department,
        designation: employee.designation,
        shift: {
          name: shiftConfig?.name || 'Standard Shift',
          type: employee.shiftType || 'morning',
          startTime: shiftConfig?.startTime || '09:00 AM',
          endTime: shiftConfig?.endTime || '06:00 PM',
          lunchTime: shiftConfig?.lunchTime || '01:00 PM',
          teaTime: shiftConfig?.teaTime || '04:00 PM',
          weekoff: defaultWeekoffDays
        }
      },
      salaryBreakdown: {
        basicSalary: basicSalary,
        perDaySalary: Number(perDaySalary.toFixed(2)),
        presentEarnings: presentEarnings,
        halfDayDeduction: metrics.halfDayDeduction,
        absentLossOfPay: metrics.absentLossOfPay,
        lateDeduction: lateDeduction
      },
      month: parseInt(month, 10),
      year: parseInt(year, 10),
      summary: {
        totalDays: TOTAL_PAYROLL_DAYS,
        presentDays: metrics.presentCount,
        halfDays: metrics.halfDayCount,
        absentDays: metrics.absentCount,
        leaveDays: Number((metrics.paidLeaveDays + metrics.unpaidLeaveDays).toFixed(1)),
        paidLeaveDays: Number(metrics.paidLeaveDays.toFixed(1)),
        casualLeaveDays: Number(metrics.paidLeaveDays.toFixed(1)),
        unpaidLeaveDays: Number(metrics.unpaidLeaveDays.toFixed(1)),
        weekOffDays: metrics.weekOffCount,
        holidayDays: metrics.holidayCount,
        lateDays: metrics.lateCount,
        totalWorkingHours: Math.round(metrics.totalWorkingHours * 100) / 100
      },
      dailyBreakdown: metrics.dailyBreakdown,
      payroll: payrollData
    });
    return;
  } catch (error) {
    console.error('Error fetching employee attendance breakdown:', error);
    res.status(500).json({ message: 'Error fetching attendance breakdown' });
  }
});

// Export Payroll to Excel
router.get('/export/excel', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = {};

    if (month && year) {
      query['payPeriod.month'] = parseInt(month);
      query['payPeriod.year'] = parseInt(year);
    }

    const payrolls = await Payroll.find(query)
      .populate('employee', 'firstName lastName employeeId department designation')
      .sort({ createdAt: -1 });

    const data = payrolls.map(payroll => {
      const presentDays = payroll.attendance?.present || 0;
      const incompleteGoals = payroll.performance?.incompleteGoals || 0;
      const lateCheckIns = payroll.attendance?.lateCheckIns || 0;
      const absentDays = payroll.workingDays?.absent || 0;
      const penaltyDays = (lateCheckIns * 0.5) + (incompleteGoals * 1.0) + absentDays;

      return {
        'Employee ID': payroll.employeeId || 'N/A',
        'Employee Name': payroll.employee ? `${payroll.employee.firstName} ${payroll.employee.lastName}` : 'N/A',
        'Department': payroll.employee?.department || 'N/A',
        'Designation': payroll.employee?.designation || 'N/A',
        'Month': payroll.payPeriod?.month || 'N/A',
        'Year': payroll.payPeriod?.year || 'N/A',
        'Basic Salary': payroll.salaryDetails?.basicSalary || 0,
        'Gross Salary': payroll.salaryDetails?.grossSalary || 0,
        'Present Days': presentDays,
        'Late Check-ins': lateCheckIns,
        'Incomplete Goals': incompleteGoals,
        'Absent Days': absentDays,
        'Penalty Days': penaltyDays,
        'Total Deductions': payroll.salaryDetails?.totalDeductions || 0,
        'Net Salary': payroll.salaryDetails?.netSalary || 0,
        'Status': payroll.status || 'N/A'
      };
    });

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(wb, ws, 'Payroll');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="payroll.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting payroll to Excel:', error);
    res.status(500).json({ message: 'Error exporting payroll' });
  }
});

// Export Payroll to Word
router.get('/export/word', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = {};

    if (month && year) {
      query['payPeriod.month'] = parseInt(month);
      query['payPeriod.year'] = parseInt(year);
    }

    const payrolls = await Payroll.find(query)
      .populate('employee', 'firstName lastName employeeId department designation')
      .sort({ createdAt: -1 });

    const monthNames = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = month ? monthNames[parseInt(month)] : 'All';

    // Create table rows
    const tableRows = [
      // Header row
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ text: 'Employee', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Grade', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Gross Salary', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Present', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Late', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Penalty Days', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Deduction', bold: true })] }),
          new TableCell({ children: [new Paragraph({ text: 'Net Salary', bold: true })] }),
        ],
      }),
      // Data rows
      ...payrolls.map(payroll => {
        const presentDays = payroll.attendance?.present || 0;
        const incompleteGoals = payroll.performance?.incompleteGoals || 0;
        const lateCheckIns = payroll.attendance?.lateCheckIns || 0;
        const absentDays = payroll.workingDays?.absent || 0;
        const penaltyDays = (lateCheckIns * 0.5) + (incompleteGoals * 1.0) + absentDays;

        return new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(`${payroll.employee?.firstName || ''} ${payroll.employee?.lastName || ''}`)] }),
            new TableCell({ children: [new Paragraph(payroll.employee?.designation || 'N/A')] }),
            new TableCell({ children: [new Paragraph(`Rs. ${(payroll.salaryDetails?.grossSalary || 0).toLocaleString()}`)] }),
            new TableCell({ children: [new Paragraph(presentDays.toString())] }),
            new TableCell({ children: [new Paragraph(lateCheckIns.toString())] }),
            new TableCell({ children: [new Paragraph(penaltyDays.toString())] }),
            new TableCell({ children: [new Paragraph(`Rs. ${(payroll.salaryDetails?.totalDeductions || 0).toLocaleString()}`)] }),
            new TableCell({ children: [new Paragraph(`Rs. ${(payroll.salaryDetails?.netSalary || 0).toLocaleString()}`)] }),
          ],
        });
      }),
    ];

    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: `Monthly Payroll - ${monthName} ${year || ''}`,
            heading: 'Heading1',
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: `Generated on: ${new Date().toLocaleDateString()}`,
            spacing: { after: 200 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
          }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Disposition', 'attachment; filename="payroll.docx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    console.error('Error exporting payroll to Word:', error);
    res.status(500).json({ message: 'Error exporting Word document' });
  }
});

// Download individual employee payslip PDF
router.get('/:id/payslip-pdf', auth, async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id)
      .populate('employee', 'firstName lastName employeeId department designation email joiningDate bankName accountNumber ifscCode panNumber')
      .populate('salaryStructure');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    // Check access: own data or admin
    const hasAdminAccess = req.user.role?.permissions?.find(
      p => p.module === 'payroll' && p.actions.includes('read')
    );
    const empId = payroll.employee?._id || payroll.employee;
    const isOwnData = req.user._id.toString() === empId.toString();

    if (!isOwnData && !hasAdminAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (isOwnData && !hasAdminAccess && payroll.status !== 'paid') {
      return res.status(403).json({ message: 'Salary slip is not available until status is marked as Paid' });
    }

    // Auto-sync structure allowances to payroll if missing or zero
    try {
      const structure = payroll.salaryStructure || await SalaryStructure.findOne({
        $or: [{ employee: empId }, { employee: empId.toString() }],
        isActive: true
      });

      if (structure && structure.basicSalary) {
        const sAllow = structure.allowances || {};
        const sHra = Number(sAllow.hra) || 0;
        const sConv = Number(sAllow.conveyance || sAllow.transport) || 0;
        const sFood = Number(sAllow.food) || 0;
        const sDa = Number(sAllow.da) || 0;
        const sMed = Number(sAllow.medical) || 0;
        const sOther = Number(sAllow.other) || 0;
        const structTot = sHra + sConv + sFood + sDa + sMed + sOther;

        const curAllow = payroll.salaryDetails?.allowances || {};
        const curTot = (Number(curAllow.hra) || 0) + (Number(curAllow.conveyance || curAllow.transport) || 0) + (Number(curAllow.food) || 0) + (Number(curAllow.da) || 0) + (Number(curAllow.medical) || 0) + (Number(curAllow.other) || 0);

        if (structTot > 0 && (curTot === 0 || Number(payroll.salaryDetails?.basicSalary) > Number(structure.basicSalary))) {
          if (!payroll.salaryDetails) payroll.salaryDetails = {};
          payroll.salaryDetails.basicSalary = Number(structure.basicSalary);
          payroll.salaryDetails.allowances = {
            ...curAllow,
            hra: sHra,
            conveyance: sConv,
            food: sFood,
            da: sDa,
            medical: sMed,
            transport: Number(sAllow.transport) || 0,
            other: sOther
          };
          payroll.salaryStructure = structure._id;
        }
      }

      // Calculate accurate LOP including half-days
      const absentDays = Number(payroll.workingDays?.absent) || 0;
      const halfDays = Number(payroll.workingDays?.halfDay ?? payroll.workingDays?.halfDays) || 0;
      const unpaidDays = absentDays + (halfDays * 0.5);

      const bSal = Number(payroll.salaryDetails?.basicSalary) || 0;
      const al = payroll.salaryDetails?.allowances || {};
      const totAl = (Number(al.hra) || 0) + (Number(al.conveyance || al.transport) || 0) + (Number(al.food) || 0) + (Number(al.da) || 0) + (Number(al.medical) || 0) + (Number(al.other) || 0);
      const fullGross = bSal + totAl;
      const perDaySalary = fullGross > 0 ? (fullGross / 30) : 0;
      const calculatedLop = unpaidDays > 0 ? Number((unpaidDays * perDaySalary).toFixed(2)) : 0;

      const d = payroll.salaryDetails?.deductions || {};
      const manualPenalty = Number(d.penalty) || 0;
      const latePenalty = Number(d.lateDeduction) || 0;
      const goalPenalty = Number(d.goalDeduction) || 0;
      const totalPenalties = manualPenalty + latePenalty + goalPenalty;
      const stdDed = (Number(d.pf) || 0) + (Number(d.esi) || 0) + (Number(d.tax) || 0) + (Number(d.loan) || 0) + (Number(d.advance) || 0) + (Number(d.other) || 0);

      const effectiveLop = calculatedLop;

      const customComponents = Array.isArray(payroll.customComponents) ? payroll.customComponents : [];
      const customAddTotal = customComponents.filter(c => (c.type || '').toLowerCase() === 'addition').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
      const customDedTotal = customComponents.filter(c => (c.type || '').toLowerCase() === 'deduction').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

      const netSalary = Number((fullGross + (payroll.salaryDetails?.bonus || 0) + customAddTotal - effectiveLop - stdDed - totalPenalties - customDedTotal).toFixed(2));

      if (!payroll.salaryDetails) payroll.salaryDetails = {};
      if (!payroll.salaryDetails.deductions) payroll.salaryDetails.deductions = {};
      payroll.salaryDetails.deductions.lossOfPay = effectiveLop;
      payroll.salaryDetails.deductions.halfDayDeduction = 0;
      payroll.salaryDetails.netSalary = netSalary;
      payroll.salaryDetails.totalDeductions = effectiveLop + stdDed + totalPenalties + customDedTotal;

      await Payroll.findByIdAndUpdate(payroll._id, {
        'salaryDetails.basicSalary': payroll.salaryDetails.basicSalary,
        'salaryDetails.allowances': payroll.salaryDetails.allowances,
        'salaryDetails.deductions.lossOfPay': effectiveLop,
        'salaryDetails.deductions.halfDayDeduction': 0,
        'salaryDetails.netSalary': netSalary,
        'salaryDetails.totalDeductions': payroll.salaryDetails.totalDeductions,
        salaryStructure: structure?._id || payroll.salaryStructure
      });
    } catch (syncErr) {
      console.warn('Warning syncing structure for payslip PDF:', syncErr.message);
    }

    const { generateSalaryReceiptPDF } = require('../utils/pdfGenerator');
    const pdfBuffer = await generateSalaryReceiptPDF(payroll);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[payroll.payPeriod.month - 1];
    const empName = `${payroll.employee.firstName}_${payroll.employee.lastName}`;

    res.setHeader('Content-Disposition', `attachment; filename="Payslip_${empName}_${monthName}_${payroll.payPeriod.year}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating payslip PDF:', error);
    res.status(500).json({ message: 'Error generating payslip PDF' });
  }
});

// Accounting / Finance Journal Entries for a month
router.get('/accounting/journal', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const payrolls = await Payroll.find({
      'payPeriod.month': parseInt(month),
      'payPeriod.year': parseInt(year)
    }).populate('employee', 'firstName lastName employeeId department designation');

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = monthNames[parseInt(month) - 1];

    // Aggregate totals
    const totals = payrolls.reduce((acc, p) => {
      const sd = p.salaryDetails || {};
      const d = sd.deductions || {};
      acc.grossSalary += sd.grossSalary || 0;
      acc.bonus += sd.bonus || 0;
      acc.pf += d.pf || 0;
      acc.esi += d.esi || 0;
      acc.tax += d.tax || 0;
      acc.loan += d.loan || 0;
      acc.advance += d.advance || 0;
      acc.lossOfPay += d.lossOfPay || 0;
      acc.lateDeduction += d.lateDeduction || 0;
      acc.goalDeduction += d.goalDeduction || 0;
      acc.otherDeductions += (d.other || 0);
      acc.totalDeductions += sd.totalDeductions || 0;
      acc.netSalary += sd.netSalary || 0;
      return acc;
    }, {
      grossSalary: 0, bonus: 0, pf: 0, esi: 0, tax: 0, loan: 0, advance: 0,
      lossOfPay: 0, lateDeduction: 0, goalDeduction: 0, otherDeductions: 0,
      totalDeductions: 0, netSalary: 0
    });

    // Department-wise breakdown
    const deptBreakdown = {};
    payrolls.forEach(p => {
      const dept = p.employee?.department || 'Unknown';
      if (!deptBreakdown[dept]) {
        deptBreakdown[dept] = { department: dept, employees: 0, grossSalary: 0, totalDeductions: 0, netSalary: 0 };
      }
      deptBreakdown[dept].employees++;
      deptBreakdown[dept].grossSalary += p.salaryDetails?.grossSalary || 0;
      deptBreakdown[dept].totalDeductions += p.salaryDetails?.totalDeductions || 0;
      deptBreakdown[dept].netSalary += p.salaryDetails?.netSalary || 0;
    });

    // Journal Entries (Double-entry bookkeeping)
    const journalEntries = [
      {
        date: new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0],
        description: `Salary Expense - ${monthName} ${year}`,
        account: 'Salary Expense A/C',
        debit: totals.grossSalary + totals.bonus,
        credit: 0,
        narration: `Gross payroll expense for ${payrolls.length} employees`
      },
      {
        date: new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0],
        description: `PF Payable - ${monthName} ${year}`,
        account: 'PF Payable A/C',
        debit: 0,
        credit: totals.pf,
        narration: 'Provident Fund deduction (employee contribution)'
      },
      {
        date: new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0],
        description: `ESI Payable - ${monthName} ${year}`,
        account: 'ESI Payable A/C',
        debit: 0,
        credit: totals.esi,
        narration: 'Employee State Insurance deduction'
      },
      {
        date: new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0],
        description: `TDS Payable - ${monthName} ${year}`,
        account: 'TDS Payable A/C',
        debit: 0,
        credit: totals.tax,
        narration: 'Tax Deducted at Source (Income Tax)'
      },
      {
        date: new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0],
        description: `Salary Payable - ${monthName} ${year}`,
        account: 'Salary Payable A/C',
        debit: 0,
        credit: totals.netSalary,
        narration: `Net salary payable to ${payrolls.length} employees`
      }
    ];

    // Payment entry (only for paid payrolls)
    const paidPayrolls = payrolls.filter(p => p.status === 'paid');
    const totalPaid = paidPayrolls.reduce((sum, p) => sum + (p.salaryDetails?.netSalary || 0), 0);
    if (totalPaid > 0) {
      journalEntries.push({
        date: new Date().toISOString().split('T')[0],
        description: `Bank Payment - Salary ${monthName} ${year}`,
        account: 'Bank A/C',
        debit: 0,
        credit: totalPaid,
        narration: `Salary disbursed to ${paidPayrolls.length} employees via bank transfer`
      });
      journalEntries.push({
        date: new Date().toISOString().split('T')[0],
        description: `Salary Cleared - ${monthName} ${year}`,
        account: 'Salary Payable A/C',
        debit: totalPaid,
        credit: 0,
        narration: 'Clearing salary payable on bank payment'
      });
    }

    res.json({
      month: parseInt(month),
      year: parseInt(year),
      monthName,
      summary: {
        totalEmployees: payrolls.length,
        paid: paidPayrolls.length,
        pending: payrolls.length - paidPayrolls.length,
        ...totals
      },
      departmentBreakdown: Object.values(deptBreakdown),
      journalEntries,
      payrolls: payrolls.map(p => ({
        employeeId: p.employeeId,
        name: p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : 'N/A',
        department: p.employee?.department,
        designation: p.employee?.designation,
        grossSalary: p.salaryDetails?.grossSalary || 0,
        bonus: p.salaryDetails?.bonus || 0,
        totalDeductions: p.salaryDetails?.totalDeductions || 0,
        netSalary: p.salaryDetails?.netSalary || 0,
        status: p.status
      }))
    });
  } catch (error) {
    console.error('Error fetching accounting journal:', error);
    res.status(500).json({ message: 'Error fetching accounting data' });
  }
});

module.exports = router;