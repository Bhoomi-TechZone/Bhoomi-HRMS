
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
      'payPeriod.year': parseInt(year)
    })
      .populate('employee', 'firstName lastName employeeId department designation')
      .sort({ createdAt: -1 });

    if (!payslip) {
      return res.status(404).json({ message: 'Payslip not found' });
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

    const allShiftConfigs = await ShiftConfig.find({});
    const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
    const holidayDays = new Set(holidays.map(h => new Date(h.date).getDate()));

    // 2. Clear existing draft payrolls for this period to avoid duplicates
    await Payroll.deleteMany({
      'payPeriod.month': parseInt(month, 10),
      'payPeriod.year': parseInt(year, 10),
      status: 'draft'
    });

    const employees = await User.find({ isActive: true });
    const generatedPayrolls = [];

    const todayNow = new Date();
    const today = new Date(todayNow.getFullYear(), todayNow.getMonth(), todayNow.getDate());

    for (const employee of employees) {
      // Get salary structure
      const structure = await SalaryStructure.findOne({ employee: employee._id.toString(), isActive: true });
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
        status: { $in: ['approved', 'pending'] },
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

      let presentCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let weekOffCount = 0;
      let holidayCount = 0;
      let leaveCount = 0;
      let lateCount = 0;

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

        if (att) {
          // 'present', 'late-checkin', 'early-checkin' → present
          if (att.status === 'present' || att.status === 'late-checkin' || att.status === 'early-checkin') {
            presentCount++;
          // 'half-day' → half day
          } else if (att.status === 'half-day') {
            halfDayCount++;
          // 'absent' → absent
          } else if (att.status === 'absent') {
            absentCount++;
          // 'not-checkout' → half day (user checked in but never checked out)
          } else if (att.status === 'not-checkout') {
            halfDayCount++;
          // 'checked-in' → still active (today), count as present; old checked-in without logout = half day
          } else if (att.status === 'checked-in') {
            if (isToday) {
              presentCount++;
            } else if (!isFutureDate) {
              // Checked in but no checkout on a past day → half day
              halfDayCount++;
            }
          } else if (leaveInfo) {
            leaveCount++;
          } else if (isWeekOff) {
            weekOffCount++;
          } else if (isHoliday) {
            holidayCount++;
          } else if (!isFutureDate && !isToday) {
            absentCount++;
          }

          if (att.loginTime && lateCheckInRule) {
            const login = new Date(att.loginTime);
            const [hour, minute] = lateThreshold.split(':');
            const thresholdDate = new Date(login);
            thresholdDate.setHours(parseInt(hour), parseInt(minute), 0);
            if (login > thresholdDate) lateCount++;
          }
        } else {
          if (leaveInfo) leaveCount++;
          else if (isWeekOff) weekOffCount++;
          else if (isHoliday) holidayCount++;
          else if (!isFutureDate && !isToday) absentCount++;
        }
      }

      // Count elapsed weekoffs/holidays for ongoing month pro-rata calculation
      let elapsedWeekOffCount = 0;
      let elapsedHolidayCount = 0;
      let elapsedLeaveCount = 0;

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

        if (att) {
          if (att.status === 'present') {
            // counted in presentCount
          } else if (att.status === 'half-day') {
            // counted in halfDayCount
          } else if (lInfo) elapsedLeaveCount++;
          else if (isWo) elapsedWeekOffCount++;
          else if (isHol) elapsedHolidayCount++;
        } else {
          if (lInfo) elapsedLeaveCount++;
          else if (isWo) elapsedWeekOffCount++;
          else if (isHol) elapsedHolidayCount++;
        }
      }

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
      const elapsedPaidDaysCount = presentCount + (halfDayCount * 0.5) + elapsedWeekOffCount + elapsedHolidayCount + elapsedLeaveCount;

      const lateDeduction = 0;
      const halfDayDeduction = Number((halfDayCount * (perDaySalary * 0.5)).toFixed(2));
      const lossOfPay = Number((absentCount * perDaySalary).toFixed(2));

      const stdDeductions = structure.deductions || {};
      const totalStdDeductions =
        (stdDeductions.pf || 0) +
        (stdDeductions.esi || 0) +
        (stdDeductions.tax || 0) +
        (stdDeductions.loan || 0) +
        (stdDeductions.advance || 0) +
        (stdDeductions.other || 0);

      // Option A: Net Salary is strictly calculated on Paid Days Earned so far (Elapsed Present + Elapsed Week Offs + Elapsed Holidays + Elapsed Leaves)
      // Cap paid days to 30 for calculations if per day salary is /30, or just use elapsed.
      const paidDaysForCalc = elapsedPaidDaysCount;

      const earnedGross = Number((paidDaysForCalc * perDaySalary).toFixed(2));
      const penaltyDeductions = Number((lateDeduction + halfDayDeduction).toFixed(2));
      const currentNet = Number((earnedGross + 0 - totalStdDeductions - penaltyDeductions).toFixed(2));

      const payroll = new Payroll({
        employee: employee._id.toString(),
        employeeId: employee.employeeId,
        salaryStructure: structure._id,
        payPeriod: { month: parseInt(month, 10), year: parseInt(year, 10) },
        workingDays: {
          total: totalDaysInMonth,
          present: presentCount,
          halfDay: halfDayCount,
          leave: elapsedLeaveCount,
          weekoff: elapsedWeekOffCount,
          holiday: elapsedHolidayCount,
          absent: absentCount
        },
        attendance: {
          lateCheckIns: lateCount,
          present: presentCount,
          total: totalDaysInMonth
        },
        performance: {
          incompleteGoals: 0,
          status: 'COMPLETED'
        },
        salaryDetails: {
          basicSalary: structure.basicSalary,
          bonus: 0,
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
            lossOfPay: lossOfPay,
            halfDayDeduction: halfDayDeduction,
            lateDeduction: lateDeduction,
            goalDeduction: 0
          },
          grossSalary: earnedGross,
          totalDeductions: totalStdDeductions + penaltyDeductions,
          netSalary: currentNet
        },
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
    let totalDays = endDate.getDate();

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

// Finalize payroll
router.patch('/:id/finalize', auth, checkPermission('payroll', 'update'), async (req, res) => {
  try {
    const payroll = await Payroll.findByIdAndUpdate(
      req.params.id,
      { status: 'processed', processedBy: req.user._id, processedAt: new Date() },
      { new: true }
    );
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
    ).populate('employee', 'firstName lastName email employeeId designation department bankName accountNumber');

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

// Edit payroll record (bonus and penalty)
router.put('/:id', auth, checkPermission('payroll', 'update'), async (req, res) => {
  try {
    const { bonus, penalty } = req.body;
    
    const payroll = await Payroll.findById(req.params.id);
    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    if (payroll.status === 'paid') {
      return res.status(400).json({ message: 'Cannot edit an already paid payroll' });
    }

    // Update fields
    payroll.salaryDetails.bonus = Number(bonus) || 0;
    if (!payroll.salaryDetails.deductions) {
      payroll.salaryDetails.deductions = {};
    }
    payroll.salaryDetails.deductions.penalty = Number(penalty) || 0;

    // Force recalculation by unsetting netSalary
    payroll.salaryDetails.netSalary = undefined;

    await payroll.save();

    res.json({ message: 'Payroll updated successfully', payroll });
  } catch (error) {
    console.error('Error updating payroll:', error);
    res.status(500).json({ message: 'Error updating payroll record' });
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

    const allShiftConfigs = await ShiftConfig.find({});
    const holidays = await Holiday.find({ date: { $gte: startDate, $lte: endDate } });
    const holidayDays = new Set(holidays.map(h => new Date(h.date).getDate()));

    // Delete existing target payrolls
    await Payroll.deleteMany({ _id: { $in: ids } });

    const employees = await User.find({ _id: { $in: employeeIdsToRegenerate } });
    const regeneratedPayrolls = [];

    const todayNow = new Date();
    const today = new Date(todayNow.getFullYear(), todayNow.getMonth(), todayNow.getDate());

    for (const employee of employees) {
      const structure = await SalaryStructure.findOne({ employee: employee._id.toString(), isActive: true });
      if (!structure) continue;

      const shiftConfig = allShiftConfigs.find(sc => sc.type === (employee.shiftType || 'morning'));
      const defaultWeekoffDays = shiftConfig?.weekoff || 1;

      const leaves = await Leave.find({
        employee: employee._id,
        status: { $in: ['approved', 'pending'] },
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

      let presentCount = 0;
      let halfDayCount = 0;
      let absentCount = 0;
      let weekOffCount = 0;
      let holidayCount = 0;
      let leaveCount = 0;
      let lateCount = 0;

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

        if (att) {
          // 'present', 'late-checkin', 'early-checkin' → present
          if (att.status === 'present' || att.status === 'late-checkin' || att.status === 'early-checkin') {
            presentCount++;
          // 'half-day' → half day
          } else if (att.status === 'half-day') {
            halfDayCount++;
          // 'absent' → absent
          } else if (att.status === 'absent') {
            absentCount++;
          // 'not-checkout' → half day (user checked in but never checked out)
          } else if (att.status === 'not-checkout') {
            halfDayCount++;
          // 'checked-in' → still active (today), count as present; old checked-in without logout = half day
          } else if (att.status === 'checked-in') {
            if (isToday) {
              presentCount++;
            } else if (!isFutureDate) {
              // Checked in but no checkout on a past day → half day
              halfDayCount++;
            }
          } else if (leaveInfo) {
            leaveCount++;
          } else if (isWeekOff) {
            weekOffCount++;
          } else if (isHoliday) {
            holidayCount++;
          } else if (!isFutureDate && !isToday) {
            absentCount++;
          }

          if (att.loginTime && lateCheckInRule) {
            const login = new Date(att.loginTime);
            const [hour, minute] = lateThreshold.split(':');
            const thresholdDate = new Date(login);
            thresholdDate.setHours(parseInt(hour), parseInt(minute), 0);
            if (login > thresholdDate) lateCount++;
          }
        } else {
          if (leaveInfo) leaveCount++;
          else if (isWeekOff) weekOffCount++;
          else if (isHoliday) holidayCount++;
          else if (!isFutureDate && !isToday) absentCount++;
        }
      }

      let elapsedWeekOffCount = 0;
      let elapsedHolidayCount = 0;
      let elapsedLeaveCount = 0;

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

        if (att) {
          if (att.status === 'present') {
          } else if (att.status === 'half-day') {
          } else if (lInfo) elapsedLeaveCount++;
          else if (isWo) elapsedWeekOffCount++;
          else if (isHol) elapsedHolidayCount++;
        } else {
          if (lInfo) elapsedLeaveCount++;
          else if (isWo) elapsedWeekOffCount++;
          else if (isHol) elapsedHolidayCount++;
        }
      }

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
      const elapsedPaidDaysCount = presentCount + (halfDayCount * 0.5) + elapsedWeekOffCount + elapsedHolidayCount + elapsedLeaveCount;

      const lateDeduction = 0;
      const halfDayDeduction = Number((halfDayCount * (perDaySalary * 0.5)).toFixed(2));
      const lossOfPay = Number((absentCount * perDaySalary).toFixed(2));

      const stdDeductions = structure.deductions || {};
      const totalStdDeductions =
        (stdDeductions.pf || 0) +
        (stdDeductions.esi || 0) +
        (stdDeductions.tax || 0) +
        (stdDeductions.loan || 0) +
        (stdDeductions.advance || 0) +
        (stdDeductions.other || 0);

      const paidDaysForCalc = elapsedPaidDaysCount;
      const earnedGross = Number((paidDaysForCalc * perDaySalary).toFixed(2));
      const penaltyDeductions = Number((lateDeduction + halfDayDeduction).toFixed(2));
      const currentNet = Number((earnedGross + 0 - totalStdDeductions - penaltyDeductions).toFixed(2));

      const payroll = new Payroll({
        employee: employee._id.toString(),
        employeeId: employee.employeeId,
        salaryStructure: structure._id,
        payPeriod: { month: parseInt(month, 10), year: parseInt(year, 10) },
        workingDays: {
          total: totalDaysInMonth,
          present: presentCount,
          halfDay: halfDayCount,
          leave: elapsedLeaveCount,
          weekoff: elapsedWeekOffCount,
          holiday: elapsedHolidayCount,
          absent: absentCount
        },
        attendance: {
          lateCheckIns: lateCount,
          present: presentCount,
          total: totalDaysInMonth
        },
        performance: {
          incompleteGoals: 0,
          status: 'COMPLETED'
        },
        salaryDetails: {
          basicSalary: structure.basicSalary,
          bonus: 0,
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
            lossOfPay: lossOfPay,
            halfDayDeduction: halfDayDeduction,
            lateDeduction: lateDeduction,
            goalDeduction: 0
          },
          grossSalary: earnedGross,
          totalDeductions: totalStdDeductions + penaltyDeductions,
          netSalary: currentNet
        },
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
      status: { $in: ['approved', 'pending'] },
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
    const structure = await SalaryStructure.findOne({ employee: employeeId, isActive: true });

    const attendances = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Get salary rules
    const rules = await SalaryRule.find({ status: 'active' });
    const lateCheckInRule = rules.find(r => r.ruleType === 'Late Check-in');
    const lateThreshold = lateCheckInRule ? lateCheckInRule.threshold : "10:10 AM";

    // Create daily breakdown
    const dailyBreakdown = [];
    let presentCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let weekOffCount = 0;
    let holidayCount = 0;
    let leaveCount = 0;
    let lateCount = 0;
    let totalWorkingHours = 0;

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const currentDate = new Date(year, month - 1, day);
      const dayOfWeek = currentDate.getDay(); // 0=Sun, 6=Sat, 5=Fri

      // Determine weekoff for this day
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

      const attendance = attendances.find(att => new Date(att.date).getDate() === day);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFutureDate = currentDate > today;
      const isToday = currentDate.getTime() === today.getTime();

      let dayData = {
        day: day,
        date: currentDate.toISOString().split('T')[0],
        status: isFutureDate || isToday ? '—' : (leaveInfo ? 'Leave' : isWeekOff ? 'Week Off' : isHoliday ? 'Holiday' : 'Absent'),
        isWeekend: isWeekOff,
        isHoliday: isHoliday,
        leaveInfo: leaveInfo || null,
        loginTime: null,
        logoutTime: null,
        workingHours: 0,
        isLate: false,
        shift: 'General'
      };

      if (attendance) {
        dayData.status = attendance.status === 'present' ? 'Present' : attendance.status === 'half-day' ? 'Half-day' : (isFutureDate || isToday ? '—' : (leaveInfo ? 'Leave' : isWeekOff ? 'Week Off' : isHoliday ? 'Holiday' : 'Absent'));
        dayData.loginTime = attendance.loginTime;
        dayData.logoutTime = attendance.logoutTime;
        dayData.workingHours = attendance.workingHours || 0;

        // Check if late
        if (attendance.loginTime && lateCheckInRule) {
          const login = new Date(attendance.loginTime);
          const [hour, minute] = lateThreshold.split(':');
          const thresholdDate = new Date(login);
          thresholdDate.setHours(parseInt(hour), parseInt(minute), 0);
          dayData.isLate = login > thresholdDate;
          if (dayData.isLate) lateCount++;
        }

        if (attendance.status === 'present') presentCount++;
        if (attendance.status === 'half-day') halfDayCount++;
        totalWorkingHours += dayData.workingHours;
      } else {
        if (!isFutureDate && !isToday) {
          if (leaveInfo) leaveCount++;
          else if (isWeekOff) weekOffCount++;
          else if (isHoliday) holidayCount++;
          else absentCount++;
        }
      }

      dailyBreakdown.push(dayData);
    }

    // Calculate payroll amounts
    let payrollData = null;
    const basicSalary = structure?.basicSalary || 0;
    const totalAllowances = 
      (structure.allowances?.hra || 0) + 
      (structure.allowances?.da || 0) + 
      (structure.allowances?.conveyance || 0) + 
      (structure.allowances?.food || 0) + 
      (structure.allowances?.transport || 0) + 
      (structure.allowances?.medical || 0) + 
      (structure.allowances?.other || 0);

    const grossSalaryAmt = basicSalary + totalAllowances;
    const perDaySalary = grossSalaryAmt / 30;
    const safeAbsent = Math.max(0, absentCount);

    const paidDaysCount = presentCount + (halfDayCount * 0.5) + weekOffCount + holidayCount + leaveCount;
    const presentEarnings = Number((paidDaysCount * perDaySalary).toFixed(2));
    const halfDayDeduction = Number((halfDayCount * (perDaySalary * 0.5)).toFixed(2));
    const absentLossOfPay = Number((safeAbsent * perDaySalary).toFixed(2));
    const lateDeduction = 0;

    if (structure) {
      const goalDeduction = 0;
      const stdDeductions = structure.deductions || {};
      const totalStdDed = (stdDeductions.pf || 0) + (stdDeductions.esi || 0) + (stdDeductions.tax || 0) + (stdDeductions.loan || 0) + (stdDeductions.advance || 0) + (stdDeductions.other || 0);

      let totalPenaltyDed = Number((lateDeduction + goalDeduction + halfDayDeduction).toFixed(2));
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
          halfDayDeduction: halfDayDeduction,
          goalDeduction: goalDeduction,
          lossOfPay: absentLossOfPay
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
        halfDayDeduction: halfDayDeduction,
        absentLossOfPay: absentLossOfPay,
        lateDeduction: lateDeduction
      },
      month: parseInt(month),
      year: parseInt(year),
      summary: {
        totalDays: totalDaysInMonth,
        presentDays: presentCount,
        halfDays: halfDayCount,
        absentDays: Math.max(0, absentCount),
        leaveDays: leaveCount,
        weekOffDays: weekOffCount,
        holidayDays: holidayCount,
        lateDays: lateCount,
        totalWorkingHours: Math.round(totalWorkingHours * 100) / 100
      },
      dailyBreakdown: dailyBreakdown,
      payroll: payrollData
    });

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
      .populate('employee', 'firstName lastName employeeId department designation email joiningDate bankName accountNumber ifscCode panNumber');

    if (!payroll) {
      return res.status(404).json({ message: 'Payroll record not found' });
    }

    // Check access: own data or admin
    const hasAdminAccess = req.user.role?.permissions?.find(
      p => p.module === 'payroll' && p.actions.includes('read')
    );
    const isOwnData = req.user._id.toString() === payroll.employee._id.toString();

    if (!isOwnData && !hasAdminAccess) {
      return res.status(403).json({ message: 'Access denied' });
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