const mongoose = require('mongoose');

const salaryStructureSchema = new mongoose.Schema({
  employee: {
    type: String,
    ref: 'User',
    required: true
  },
  employeeId: {
    type: String,
    required: true
  },
  basicSalary: {
    type: Number,
    required: true,
    min: 0
  },
  allowances: {
    hra: { type: Number, default: 0 }, // House Rent Allowance
    da: { type: Number, default: 0 },  // Dearness Allowance
    conveyance: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    medical: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  deductions: {
    pf: { type: Number, default: 0 }, // Provident Fund
    esi: { type: Number, default: 0 }, // Employee State Insurance
    tax: { type: Number, default: 0 },
    loan: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  bonus: {
    type: Number,
    default: 0
  },
  gratuity: {
    type: Number,
    default: 0
  },
  lateArrivals: {
    type: Number,
    default: 0
  },
  goalMissed: {
    type: Number,
    default: 0
  },
  uninformedLeave: {
    type: Number,
    default: 0
  },
  totalPenaltyDays: {
    type: Number,
    default: 0
  },
  penaltyDeduction: {
    type: Number,
    default: 0
  },
  grossSalary: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    default: 0
  },
  effectiveFrom: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Calculate gross and net salary before saving
salaryStructureSchema.pre('save', function (next) {
  // Safe helper to get number
  const getVal = (val) => Number(val) || 0;

  // Gross Salary = Basic Salary (as requested)
  this.grossSalary = getVal(this.basicSalary);

  // Standard deductions from salary structure
  const deductions = this.deductions || {};
  const totalDeductions =
    getVal(deductions.pf) +
    getVal(deductions.esi) +
    getVal(deductions.tax) +
    getVal(deductions.loan) +
    getVal(deductions.advance) +
    getVal(deductions.other);

  // Net Salary = Basic + Bonus - Standard Deductions - Penalty Deduction
  this.netSalary = getVal(this.basicSalary) + getVal(this.bonus) - totalDeductions - getVal(this.penaltyDeduction);

  next();
});

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);