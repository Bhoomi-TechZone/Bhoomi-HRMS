const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');
const SalaryStructure = require('../models/SalaryStructure');
const User = require('../models/User');
const Payroll = require('../models/Payroll');

// Get all salary structures
router.get('/', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const salaryStructures = await SalaryStructure.find({ isActive: true })
      .populate('employee', 'firstName lastName employeeId department designation')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(salaryStructures);
  } catch (error) {
    console.error('Error fetching salary structures:', error);
    res.status(500).json({ message: 'Error fetching salary structures' });
  }
});

// Get salary structure by employee ID
router.get('/employee/:employeeId', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    const salaryStructure = await SalaryStructure.findOne({
      employee: req.params.employeeId, // Assuming this is passed as user _id string. If passed as employeeId like "149", logical change needed? The route param is :employeeId. Based on context, this is usually the User ID.
      isActive: true
    })
      .populate('employee', 'firstName lastName employeeId department designation')
      .populate('createdBy', 'firstName lastName');

    if (!salaryStructure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }

    // Auto-sync updated structure to existing payrolls for this employee
    try {
      const empId = salaryStructure.employee?._id || salaryStructure.employee;
      if (empId) {
        await Payroll.updateMany(
          {
            $or: [{ employee: empId }, { employee: empId.toString() }],
            status: { $in: ['draft', 'approved', 'processed'] }
          },
          {
            $set: {
              salaryStructure: salaryStructure._id,
              'salaryDetails.basicSalary': salaryStructure.basicSalary,
              'salaryDetails.allowances': salaryStructure.allowances || {},
              'salaryDetails.deductions.pf': salaryStructure.deductions?.pf || 0,
              'salaryDetails.deductions.esi': salaryStructure.deductions?.esi || 0,
              'salaryDetails.deductions.tax': salaryStructure.deductions?.tax || 0,
              'salaryDetails.deductions.loan': salaryStructure.deductions?.loan || 0,
              'salaryDetails.deductions.advance': salaryStructure.deductions?.advance || 0,
              'salaryDetails.deductions.other': salaryStructure.deductions?.other || 0
            }
          }
        );
      }
    } catch (syncErr) {
      console.warn('Warning syncing updated salary structure to payrolls:', syncErr.message);
    }

    res.json(salaryStructure);
  } catch (error) {
    console.error('Error fetching salary structure:', error);
    res.status(500).json({ message: 'Error fetching salary structure' });
  }
});

const mongoose = require('mongoose');
// ... imports

// Create new salary structure
router.post('/', auth, checkPermission('payroll', 'create'), async (req, res) => {
  try {
    const {
      employee, basicSalary, allowances, deductions, effectiveFrom,
      lateArrivals, goalMissed, uninformedLeave, totalPenaltyDays, penaltyDeduction,
      bonus, gratuity
    } = req.body;

    // Validate request
    if (!employee || !mongoose.Types.ObjectId.isValid(employee)) {
      return res.status(400).json({ message: 'Invalid or missing employee ID' });
    }

    if (!basicSalary || isNaN(basicSalary)) {
      return res.status(400).json({ message: 'Basic salary is required and must be a number' });
    }

    // Check if employee exists
    const employeeExists = await User.findById(employee);
    if (!employeeExists) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    // DELETE existing salary structures for this employee (Hard Delete as requested)
    await SalaryStructure.deleteMany({ employee });

    const basic = Number(basicSalary);
    const late = Number(lateArrivals) || 0;
    const goals = Number(goalMissed) || 0;
    const leave = Number(uninformedLeave) || 0;

    const penaltyDaysCalculated = (goals * 1.0) + (leave * 1.0);
    const perDaySalary = basic / 30;
    const penaltyDeductionCalculated = Math.round(penaltyDaysCalculated * perDaySalary);

    // Create new salary structure
    const salaryStructure = await SalaryStructure.create({
      employee: employeeExists._id.toString(),
      employeeId: employeeExists.employeeId,
      basicSalary: basic,
      bonus: Number(bonus) || 0,
      gratuity: Number(gratuity) || 0,
      allowances: allowances || {},
      deductions: deductions || {},
      lateArrivals: late,
      goalMissed: goals,
      uninformedLeave: leave,
      totalPenaltyDays: penaltyDaysCalculated,
      penaltyDeduction: penaltyDeductionCalculated,
      effectiveFrom: effectiveFrom || new Date(),
      createdBy: req.user._id
    });

    await salaryStructure.populate('employee', 'firstName lastName employeeId department designation');
    await salaryStructure.populate('createdBy', 'firstName lastName');

    // Auto-sync new structure to existing payrolls for this employee
    try {
      await Payroll.updateMany(
        {
          $or: [{ employee: employeeExists._id }, { employee: employeeExists._id.toString() }],
          status: { $in: ['draft', 'approved', 'processed'] }
        },
        {
          $set: {
            salaryStructure: salaryStructure._id,
            'salaryDetails.basicSalary': salaryStructure.basicSalary,
            'salaryDetails.allowances': salaryStructure.allowances || {},
            'salaryDetails.deductions.pf': salaryStructure.deductions?.pf || 0,
            'salaryDetails.deductions.esi': salaryStructure.deductions?.esi || 0,
            'salaryDetails.deductions.tax': salaryStructure.deductions?.tax || 0,
            'salaryDetails.deductions.loan': salaryStructure.deductions?.loan || 0,
            'salaryDetails.deductions.advance': salaryStructure.deductions?.advance || 0,
            'salaryDetails.deductions.other': salaryStructure.deductions?.other || 0
          }
        }
      );
    } catch (syncErr) {
      console.warn('Warning syncing salary structure to payrolls:', syncErr.message);
    }

    res.status(201).json(salaryStructure);
  } catch (error) {
    console.error('Error creating salary structure:', error);
    if (error.code === 11000) {
      // Should not happen with deleteMany, but good safety
      return res.status(400).json({ message: 'Salary structure already exists for this employee' });
    }
    res.status(500).json({ message: `Error creating salary structure: ${error.message}` });
  }
});

// Update salary structure
router.put('/:id', auth, checkPermission('payroll', 'update'), async (req, res) => {
  try {
    const {
      basicSalary, allowances, deductions,
      lateArrivals, goalMissed, uninformedLeave,
      bonus, gratuity
    } = req.body;

    const basic = Number(basicSalary);
    const late = Number(lateArrivals) || 0;
    const goals = Number(goalMissed) || 0;
    const leave = Number(uninformedLeave) || 0;

    const penaltyDaysCalculated = (goals * 1.0) + (leave * 1.0);
    const perDaySalary = basic / 30;
    const penaltyDeductionCalculated = Math.round(penaltyDaysCalculated * perDaySalary);

    const totalDeductions =
      (Number(deductions?.pf) || 0) +
      (Number(deductions?.esi) || 0) +
      (Number(deductions?.tax) || 0) +
      (Number(deductions?.loan) || 0) +
      (Number(deductions?.advance) || 0) +
      (Number(deductions?.other) || 0);

    const totalAllowances = (Number(allowances?.hra) || 0) + (Number(allowances?.da) || 0) + (Number(allowances?.conveyance) || 0) + (Number(allowances?.food) || 0) + (Number(allowances?.medical) || 0) + (Number(allowances?.transport) || 0) + (Number(allowances?.other) || 0);
    const grossSalaryCalculated = basic + totalAllowances;
    const netSalaryCalculated = basic + (Number(bonus) || 0) - totalDeductions - penaltyDeductionCalculated;

    const salaryStructure = await SalaryStructure.findByIdAndUpdate(
      req.params.id,
      {
        basicSalary: basic,
        bonus: Number(bonus) || 0,
        gratuity: Number(gratuity) || 0,
        allowances: allowances || {},
        deductions: deductions || {},
        lateArrivals: late,
        goalMissed: goals,
        uninformedLeave: leave,
        totalPenaltyDays: penaltyDaysCalculated,
        penaltyDeduction: penaltyDeductionCalculated,
        grossSalary: grossSalaryCalculated,
        netSalary: netSalaryCalculated
      },
      { new: true, runValidators: true }
    )
      .populate('employee', 'firstName lastName employeeId department designation')
      .populate('createdBy', 'firstName lastName');

    if (!salaryStructure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }

    res.json(salaryStructure);
  } catch (error) {
    console.error('Error updating salary structure:', error);
    res.status(500).json({ message: 'Error updating salary structure' });
  }
});

// Delete salary structure
router.delete('/:id', auth, checkPermission('payroll', 'delete'), async (req, res) => {
  try {
    const salaryStructure = await SalaryStructure.findByIdAndDelete(req.params.id);

    if (!salaryStructure) {
      return res.status(404).json({ message: 'Salary structure not found' });
    }

    res.json({ message: 'Salary structure deleted successfully' });
  } catch (error) {
    console.error('Error deleting salary structure:', error);
    res.status(500).json({ message: 'Error deleting salary structure' });
  }
});

// Get employees without salary structure
router.get('/employees/without-structure', auth, checkPermission('payroll', 'read'), async (req, res) => {
  try {
    // Get all employee IDs with active salary structures
    const employeesWithStructure = await SalaryStructure.find({ isActive: true }).distinct('employee');

    // Get employees without salary structures
    const employeesWithoutStructure = await User.find({
      _id: { $nin: employeesWithStructure },
      isActive: true
    }).select('firstName lastName employeeId department designation');

    res.json(employeesWithoutStructure);
  } catch (error) {
    console.error('Error fetching employees without structure:', error);
    res.status(500).json({ message: 'Error fetching employees' });
  }
});

module.exports = router;