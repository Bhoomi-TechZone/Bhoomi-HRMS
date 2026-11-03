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
      halfDayDeduction: { type: Number, default: 0 },
      goalDeduction: { type: Number, default: 0 },
      penalty: { type: Number, default: 0 }
    },
    grossSalary: { type: Number },
    totalDeductions: { type: Number },
    netSalary: { type: Number }
  },
  customComponents: [
    {
      title: { type: String, required: true },
      type: { type: String, enum: ['addition', 'deduction', 'Addition', 'Deduction'], required: true },
      amount: { type: Number, required: true, default: 0 },
      remarks: { type: String, default: '' }
    }
  ],
  status: {
    type: String,
    enum: ['draft', 'approved', 'processed', 'paid'],
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
  remarks: { type: String },
  editHistory: [
    {
      editedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      editedByName: { type: String, default: 'Admin' },
      editedAt: { type: Date, default: Date.now },
      action: { type: String, default: 'Edited Payroll' },
      changesSummary: { type: String },
      previousState: {
        grossSalary: Number,
        netSalary: Number,
        bonus: Number,
        penalty: Number,
        customComponents: Array
      },
      newState: {
        grossSalary: Number,
        netSalary: Number,
        bonus: Number,
        penalty: Number,
        customComponents: Array
      },
      customComponentsAdded: Array,
      customComponentsRemoved: Array,
      remarks: { type: String, default: '' }
    }
  ]
}, {
  timestamps: true
});

// Ensure unique payroll per employee per month/year
payrollSchema.index({ employee: 1, 'payPeriod.month': 1, 'payPeriod.year': 1 }, { unique: true });

// Pre-save hook to calculate salary
payrollSchema.pre('save', function (next) {
  const allowances = this.salaryDetails.allowances || {};
  const deductions = this.salaryDetails.deductions || {};

  const customAdditions = (this.customComponents || [])
    .filter(c => (c.type || '').toLowerCase() === 'addition')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const customDeductions = (this.customComponents || [])
    .filter(c => (c.type || '').toLowerCase() === 'deduction')
    .reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const totalDeductions =
    (deductions.pf || 0) +
    (deductions.esi || 0) +
    (deductions.tax || 0) +
    (deductions.loan || 0) +
    (deductions.advance || 0) +
    (deductions.other || 0) +
    (deductions.lossOfPay || 0) +
    (deductions.lateDeduction || 0) +
    (deductions.goalDeduction || 0) +
    (deductions.penalty || 0) +
    customDeductions;

  this.salaryDetails.totalDeductions = Number(totalDeductions.toFixed(2));

  // Compute base gross: basic + allowances
  const baseGross = (this.salaryDetails.basicSalary || 0) +
    (allowances.hra || 0) +
    (allowances.da || 0) +
    (allowances.conveyance || 0) +
    (allowances.food || 0) +
    (allowances.transport || 0) +
    (allowances.medical || 0) +
    (allowances.other || 0);

  // Preserve grossSalary if set with additions, otherwise default to baseGross + customAdditions
  if (this.salaryDetails.grossSalary === undefined || this.salaryDetails.grossSalary === baseGross) {
    this.salaryDetails.grossSalary = Number((baseGross + customAdditions).toFixed(2));
  }

  // Net salary = baseGross + bonus + customAdditions - totalDeductions
  const net = baseGross + (this.salaryDetails.bonus || 0) + customAdditions - totalDeductions;
  this.salaryDetails.netSalary = Number(Math.max(0, net).toFixed(2));

  next();
});

module.exports = mongoose.model('Payroll', payrollSchema);
