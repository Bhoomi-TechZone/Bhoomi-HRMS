const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: {
    type: String,
    ref: 'User',
    required: true
  },
  employeeId: {
    type: String,
    required: true
  },
  salaryStructure: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SalaryStructure',
    required: false
  },
  payPeriod: {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true, min: 2020 }
  },
  workingDays: {
    total: { type: Number, required: true, default: 30 },
    present: { type: Number, required: true, default: 0 },
    halfDay: { type: Number, default: 0 },
    leave: { type: Number, default: 0 },
    weekoff: { type: Number, default: 0 },
    holiday: { type: Number, default: 0 },
    absent: { type: Number, default: 0 }
  },
  leaves: {
    paid: { type: Number, default: 0 },
    unpaid: { type: Number, default: 0 }
  },
  performance: {
    incompleteGoals: { type: Number, default: 0 },
    status: { type: String, enum: ['DRAFT', 'COMPLETED'], default: 'DRAFT' }
  },
  attendance: {
    lateCheckIns: { type: Number, default: 0 },
    present: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  salaryDetails: {
    basicSalary: { type: Number, required: true },
    bonus: { type: Number, default: 0 },
    gratuity: { type: Number, default: 0 },
    allowances: {
      hra: { type: Number, default: 0 },
      da: { type: Number, default: 0 },
      conveyance: { type: Number, default: 0 },
      food: { type: Number, default: 0 },
      transport: { type: Number, default: 0 },
      medical: { type: Number, default: 0 },
      other: { type: Number, default: 0 }
    },
    deductions: {
      pf: { type: Number, default: 0 },
      esi: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      loan: { type: Number, default: 0 },
      advance: { type: Number, default: 0 },
      other: { type: Number, default: 0 },
      lossOfPay: { type: Number, default: 0 },
      lateDeduction: { type: Number, default: 0 },
      goalDeduction: { type: Number, default: 0 },
      penalty: { type: Number, default: 0 }
    },
    grossSalary: { type: Number },
    totalDeductions: { type: Number },
    netSalary: { type: Number }
  },
  status: {
    type: String,
    enum: ['draft', 'processed', 'paid'],
    default: 'draft'
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: { type: Date },
  paidAt: { type: Date },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'cheque'],
    default: 'bank_transfer'
  },
  remarks: { type: String }
}, {
  timestamps: true
});

// Ensure unique payroll per employee per month/year
payrollSchema.index({ employee: 1, 'payPeriod.month': 1, 'payPeriod.year': 1 }, { unique: true });

// Pre-save hook to calculate salary
payrollSchema.pre('save', function (next) {
  const allowances = this.salaryDetails.allowances || {};
  const deductions = this.salaryDetails.deductions || {};

  // Preserve grossSalary if already calculated (e.g. pro-rata), otherwise fallback to basicSalary
  this.salaryDetails.grossSalary = this.salaryDetails.grossSalary !== undefined ? this.salaryDetails.grossSalary : (this.salaryDetails.basicSalary || 0);

  const totalDeductions =
    (deductions.pf || 0) +
    (deductions.esi || 0) +
    (deductions.tax || 0) +
    (deductions.loan || 0) +
    (deductions.advance || 0) +
    (deductions.other || 0) +
    (deductions.lossOfPay || 0) +
    (deductions.lateDeduction || 0) +
    (deductions.halfDayDeduction || 0) +
    (deductions.goalDeduction || 0) +
    (deductions.penalty || 0);

  this.salaryDetails.totalDeductions = totalDeductions;

  // Preserve netSalary if already calculated (e.g. pro-rata), otherwise calculate here
  this.salaryDetails.netSalary = this.salaryDetails.netSalary !== undefined ? this.salaryDetails.netSalary : (this.salaryDetails.grossSalary + (this.salaryDetails.bonus || 0) - totalDeductions);

  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);
