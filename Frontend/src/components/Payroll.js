
import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Payroll.css';

if (typeof document !== 'undefined' && !document.getElementById('hrms-pro-fonts')) {
  const link = document.createElement('link');
  link.id = 'hrms-pro-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

function Payroll() {
  const { hasPermission, user, setActiveToast } = useAuth();
  const [activeTab, setActiveTab] = useState('payroll');
  const [payrolls, setPayrolls] = useState([]);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalGrossSalary: 0,
    totalDeductions: 0,
    totalNetSalary: 0
  });
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Data states
  const [rules, setRules] = useState([]);
  const [structures, setStructures] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [paidPayslips, setPaidPayslips] = useState([]);

  // Modal states
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [isStructureViewMode, setIsStructureViewMode] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);
  const [selectedStructure, setSelectedStructure] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEmpDd, setShowEmpDd] = useState(false);
  const [empSearch, setEmpSearch] = useState('');
  const [payrollSearchTerm, setPayrollSearchTerm] = useState('');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState('all');
  const [payrollEmployeeFilter, setPayrollEmployeeFilter] = useState('all');
  const [statusDdOpen, setStatusDdOpen] = useState(false);
  const [selectedPayrollIds, setSelectedPayrollIds] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const handleClose = () => setActivePayrollMenu(null);
    window.addEventListener('click', handleClose);
    window.addEventListener('scroll', handleClose, true);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('scroll', handleClose, true);
    };
  }, []);

  const handleOpenMenu = (e, payrollId) => {
    e.stopPropagation();
    if (activePayrollMenu === payrollId) {
      setActivePayrollMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const showAbove = spaceBelow < 170;
    setMenuPos({
      top: showAbove ? Math.max(10, rect.top - 150) : rect.bottom + 4,
      right: Math.max(16, window.innerWidth - rect.right)
    });
    setActivePayrollMenu(payrollId);
  };
  const [empDdOpen, setEmpDdOpen] = useState(false);
  const [filterEmpSearch, setFilterEmpSearch] = useState('');
  const [structSearchTerm, setStructSearchTerm] = useState('');
  const [structEmployeeFilter, setStructEmployeeFilter] = useState('all');
  const [structEmpDdOpen, setStructEmpDdOpen] = useState(false);
  const [structFilterEmpSearch, setStructFilterEmpSearch] = useState('');
  const [payslipSearchTerm, setPayslipSearchTerm] = useState('');
  const [payslipStatusFilter, setPayslipStatusFilter] = useState('all');
  const [payslipEmployeeFilter, setPayslipEmployeeFilter] = useState('all');
  const [payslipStatusDdOpen, setPayslipStatusDdOpen] = useState(false);
  const [payslipEmpDdOpen, setPayslipEmpDdOpen] = useState(false);
  const [payslipFilterEmpSearch, setPayslipFilterEmpSearch] = useState('');
  const [viewEmployeeData, setViewEmployeeData] = useState(null);
  const [showDetailedAttendanceModal, setShowDetailedAttendanceModal] = useState(false);
  const [detailedAttendanceData, setDetailedAttendanceData] = useState(null);
  const [showPaymentDateModal, setShowPaymentDateModal] = useState(false);
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [bankFormData, setBankFormData] = useState({
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    panNumber: '',
    upiId: ''
  });

  // Form data states
  const [ruleFormData, setRuleFormData] = useState({
    ruleType: '',
    threshold: '',
    penaltyType: '',
    penaltyAmount: '',
    status: 'active'
  });

  const [structureFormData, setStructureFormData] = useState({
    employee: '',
    basicSalary: '',
    hra: '',
    da: '',
    conveyance: '',
    food: '',
    allowancesOther: '',
    pf: '',
    esi: '',
    tax: '',
    loan: '',
    advance: '',
    deductionsOther: '',
    bonus: '',
    gratuity: '',
    grossSalary: '',
    lateArrivals: '',
    uninformedLeave: '',
    penaltyDeduction: ''
  });

  // Accounting tab state
  const [accountingData, setAccountingData] = useState(null);
  const [loadingAccounting, setLoadingAccounting] = useState(false);

  const [employeesWithoutStructure, setEmployeesWithoutStructure] = useState([]);

  // Employee summary modal states
  const [showEmployeeSummaryModal, setShowEmployeeSummaryModal] = useState(false);
  const [employeeSummaryData, setEmployeeSummaryData] = useState(null);
  const [employeeSummaryLoading, setEmployeeSummaryLoading] = useState(false);
  const [activePayrollMenu, setActivePayrollMenu] = useState(null);
  const [showEditPayrollModal, setShowEditPayrollModal] = useState(false);
  const [editPayrollData, setEditPayrollData] = useState(null);

  // Manual Generate Slip Modal State
  const [showGenerateSlipModal, setShowGenerateSlipModal] = useState(false);
  const [generatingSlip, setGeneratingSlip] = useState(false);
  const [generateSlipFormData, setGenerateSlipFormData] = useState({
    employee: '',
    basicSalary: '',
    hra: '',
    conveyance: '',
    food: '',
    bonus: '',
    penalty: '',
    lopDays: '',
    lopDeduction: '',
    pf: '',
    esi: '',
    tax: '',
    presentDays: '',
    month: selectedMonth,
    year: selectedYear
  });

  const handleOpenGenerateSlip = () => {
    setGenerateSlipFormData({
      employee: '',
      basicSalary: '',
      hra: '',
      conveyance: '',
      food: '',
      bonus: '',
      penalty: '',
      lopDays: '0',
      lopDeduction: '0',
      pf: '',
      esi: '',
      tax: '',
      presentDays: '30',
      month: selectedMonth,
      year: selectedYear
    });
    setShowGenerateSlipModal(true);
  };

  const handleSelectEmployeeForSlip = (empId) => {
    const struct = structures.find(s => (s.employee?._id || s.employee) === empId);
    if (struct) {
      setGenerateSlipFormData(prev => ({
        ...prev,
        employee: empId,
        basicSalary: struct.basicSalary || '',
        hra: struct.allowances?.hra || '',
        conveyance: struct.allowances?.conveyance || struct.allowances?.transport || '',
        food: struct.allowances?.food || '',
        bonus: struct.bonus || '',
        pf: struct.deductions?.pf || '',
        esi: struct.deductions?.esi || '',
        tax: struct.deductions?.tax || '',
      }));
    } else {
      setGenerateSlipFormData(prev => ({
        ...prev,
        employee: empId
      }));
    }
  };

  const handleManualGenerateSlip = async (e) => {
    e.preventDefault();
    if (!generateSlipFormData.employee) {
      alert('Please select an employee');
      return;
    }
    setGeneratingSlip(true);
    try {
      const basicSal = parseFloat(generateSlipFormData.basicSalary) || 0;
      const hra = parseFloat(generateSlipFormData.hra) || 0;
      const conv = parseFloat(generateSlipFormData.conveyance) || 0;
      const food = parseFloat(generateSlipFormData.food) || 0;
      const bonus = parseFloat(generateSlipFormData.bonus) || 0;
      const gross = basicSal + hra + conv + food;

      const penalty = parseFloat(generateSlipFormData.penalty) || 0;
      const lop = parseFloat(generateSlipFormData.lopDeduction) || 0;
      const pf = parseFloat(generateSlipFormData.pf) || 0;
      const esi = parseFloat(generateSlipFormData.esi) || 0;
      const tax = parseFloat(generateSlipFormData.tax) || 0;
      const totalDed = penalty + lop + pf + esi + tax;
      const net = gross + bonus - totalDed;

      // Find structure ID or first matching structure
      const struct = structures.find(s => (s.employee?._id || s.employee) === generateSlipFormData.employee);

      const payload = {
        employee: generateSlipFormData.employee,
        month: parseInt(generateSlipFormData.month),
        year: parseInt(generateSlipFormData.year),
        salaryStructure: struct?._id,
        salaryDetails: {
          basicSalary: basicSal,
          bonus: bonus,
          allowances: {
            hra: hra,
            conveyance: conv,
            food: food
          },
          deductions: {
            penalty: penalty,
            lossOfPay: lop,
            pf: pf,
            esi: esi,
            tax: tax
          },
          grossSalary: gross,
          totalDeductions: totalDed,
          netSalary: net
        },
        workingDays: {
          total: 30,
          present: parseFloat(generateSlipFormData.presentDays) || 30,
          absent: parseFloat(generateSlipFormData.lopDays) || 0
        }
      };

      const response = await api.post('/payroll/generate-single', payload);
      alert('✅ Salary Slip generated successfully!');
      setShowGenerateSlipModal(false);
      fetchPayrolls();
      fetchPaidPayslips();
      
      // Prompt download
      if (response.data && response.data._id) {
        handleDownloadPayslip(response.data);
      }
    } catch (err) {
      console.error('Error generating salary slip:', err);
      alert(err.response?.data?.message || 'Error generating salary slip');
    } finally {
      setGeneratingSlip(false);
    }
  };

  const handleEmployeeClick = async (empId) => {
    if (!empId) return;
    setEmployeeSummaryLoading(true);
    setEmployeeSummaryData(null);
    setShowEmployeeSummaryModal(true);
    try {
      const res = await api.get(`/employees/${empId}/summary`);
      setEmployeeSummaryData(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to fetch employee details');
      setShowEmployeeSummaryModal(false);
    } finally {
      setEmployeeSummaryLoading(false);
    }
  };

  // Fetch payroll data and stats
  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    try {
      const [payrollRes, statsRes] = await Promise.all([
        api.get('/payroll', {
          params: { month: selectedMonth, year: selectedYear }
        }),
        api.get('/payroll/summary/stats', {
          params: { month: selectedMonth, year: selectedYear }
        })
      ]);

      if (payrollRes.data) {
        setPayrolls(payrollRes.data);
      }
      if (statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (error) {
      console.error('Error fetching payroll data:', error);
      setPayrolls([]);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  // Fetch salary rules
  const fetchRules = useCallback(async () => {
    try {
      const response = await api.get('/salary-rules');
      if (response.data) {
        setRules(response.data);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  }, []);

  // Fetch salary structures
  const fetchStructures = useCallback(async () => {
    try {
      const response = await api.get('/salary-structure');
      if (response.data) {
        setStructures(response.data);
      }
    } catch (error) {
      console.error('Error fetching structures:', error);
    }
  }, []);

  // Fetch all employees for filters and modals
  const fetchAllEmployees = useCallback(async () => {
    try {
      const response = await api.get('/employees/list');
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        setAllEmployees(response.data);
        return;
      }
    } catch (error) {
      console.warn('Could not fetch /employees/list, trying /employees fallback:', error);
    }
    try {
      const fallbackRes = await api.get('/employees');
      if (fallbackRes.data && Array.isArray(fallbackRes.data)) {
        setAllEmployees(fallbackRes.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, []);

  // Fetch payslips (all generated payrolls for this month)
  const fetchPaidPayslips = useCallback(async () => {
    try {
      const response = await api.get('/payroll', {
        params: { month: selectedMonth, year: selectedYear }
      });
      if (response.data) {
        setPaidPayslips(response.data);
      }
    } catch (error) {
      console.error('Error fetching payslips:', error);
    }
  }, [selectedMonth, selectedYear]);

  // Fetch accounting journal data
  const fetchAccountingData = useCallback(async () => {
    setLoadingAccounting(true);
    try {
      const response = await api.get('/payroll/accounting/journal', {
        params: { month: selectedMonth, year: selectedYear }
      });
      if (response.data) {
        setAccountingData(response.data);
      }
    } catch (error) {
      console.error('Error fetching accounting data:', error);
    } finally {
      setLoadingAccounting(false);
    }
  }, [selectedMonth, selectedYear]);

  // Fetch employees without structure
  const fetchEmployeesWithoutStructure = useCallback(async () => {
    try {
      const response = await api.get('/salary-structure/employees/without-structure');
      if (response.data) {
        setEmployeesWithoutStructure(response.data);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, []);

  // Fetch preview stats for selected employee
  const fetchPreviewStats = useCallback(async (employeeId) => {
    if (!employeeId) return;
    try {
      const response = await api.get(`/payroll/preview/${employeeId}`, {
        params: { month: selectedMonth, year: selectedYear }
      });
      if (response.data) {
        setStructureFormData(prev => ({
          ...prev,
          lateArrivals: response.data.lateArrivals.toString(),
          uninformedLeave: response.data.uninformedLeave.toString()
        }));
      }
    } catch (error) {
      console.error('Error fetching preview stats:', error);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    const handleClickOutsideMenu = (e) => {
      if (!e.target.closest('.action-menu-container')) {
        setActivePayrollMenu(null);
      }
      if (!e.target.closest('.payroll-status-dd-container')) {
        setStatusDdOpen(false);
      }
      if (!e.target.closest('.payroll-emp-dd-container')) {
        setEmpDdOpen(false);
      }
      if (!e.target.closest('.struct-emp-dd-container')) {
        setStructEmpDdOpen(false);
      }
      if (!e.target.closest('.payslip-status-dd-container')) {
        setPayslipStatusDdOpen(false);
      }
      if (!e.target.closest('.payslip-emp-dd-container')) {
        setPayslipEmpDdOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutsideMenu);
    return () => document.removeEventListener('mousedown', handleClickOutsideMenu);
  }, []);

  useEffect(() => {
    if (structureFormData.employee && showStructureModal) {
      const isAutoFetch = !selectedStructure; // Only auto-fetch if creating new
      if (isAutoFetch) {
        fetchPreviewStats(structureFormData.employee);
      }
    }
  }, [structureFormData.employee, showStructureModal, fetchPreviewStats, selectedStructure]);

  // Auto-calculate penalty deduction when salary or penalty days change
  useEffect(() => {
    if (showStructureModal) {
      const basic = parseFloat(structureFormData.basicSalary) || 0;
      // Re-calculate allowances/gross locally to ensure we have latest values
      // Note: This logic duplicates the onChange logic for basic salary slightly but ensures consistency
      const hra = Math.round(basic * 0.3);
      const allowances = Math.round(basic * 0.3);
      const gross = basic; // User requested Gross = Basic (no allowances)

      const late = parseFloat(structureFormData.lateArrivals) || 0;
      const leave = parseFloat(structureFormData.uninformedLeave) || 0;

      const penaltyDays = leave * 1;

      if (basic > 0) {
        const perDaySalary = basic / 30; // Standard 30 days based on BASIC
        const deduction = Math.round(penaltyDays * perDaySalary);

        setStructureFormData(prev => ({
          ...prev,
          penaltyDeduction: deduction.toString()
        }));
      }
    }
  }, [
    structureFormData.basicSalary,
    structureFormData.lateArrivals,
    structureFormData.uninformedLeave,
    showStructureModal
  ]);

  useEffect(() => {
    if (hasPermission('payroll', 'read')) {
      fetchPayrolls();
      fetchRules();
      fetchStructures();
      fetchEmployeesWithoutStructure();
      fetchAllEmployees();
      fetchPaidPayslips();
    }
  }, [fetchPayrolls, fetchRules, fetchStructures, fetchEmployeesWithoutStructure, fetchAllEmployees, fetchPaidPayslips, hasPermission]);

  useEffect(() => {
    if (activeTab === 'accounting' && hasPermission('payroll', 'read')) {
      fetchAccountingData();
    }
  }, [activeTab, fetchAccountingData, hasPermission]);

  // Download individual payslip PDF
  const handleDownloadPayslip = async (payroll) => {
    try {
      const response = await api.get(`/payroll/${payroll._id}/payslip-pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      const monthName = months.find(m => m.value === payroll.payPeriod?.month)?.label || 'Month';
      const empName = `${payroll.employee?.firstName}_${payroll.employee?.lastName}`;
      link.download = `Payslip_${empName}_${monthName}_${payroll.payPeriod?.year}.pdf`;
      link.click();
    } catch (error) {
      console.error('Error downloading payslip:', error);
      alert('Error downloading payslip PDF');
    }
  };

  const handleToggleSelectPayroll = (id) => {
    setSelectedPayrollIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPayrolls = (filteredPayrolls) => {
    const allIds = filteredPayrolls.map(p => p._id);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedPayrollIds.includes(id));
    if (isAllSelected) {
      setSelectedPayrollIds(prev => prev.filter(id => !allIds.includes(id)));
    } else {
      setSelectedPayrollIds(prev => Array.from(new Set([...prev, ...allIds])));
    }
  };


  const handleDeleteSelectedPayrolls = async (idsToDelete = selectedPayrollIds) => {
    if (!idsToDelete || idsToDelete.length === 0) {
      alert('Please select at least one record to delete.');
      return;
    }
    const count = idsToDelete.length;
    if (!window.confirm(`Are you sure you want to delete ${count} selected payroll record(s)?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/payroll/bulk-delete', { ids: idsToDelete });
      await fetchPayrolls();
      setSelectedPayrollIds(prev => prev.filter(id => !idsToDelete.includes(id)));
      alert(res.data?.message || `Successfully deleted ${count} record(s).`);
    } catch (err) {
      console.error('Error deleting selected payrolls:', err);
      alert(err.response?.data?.message || 'Failed to delete selected payroll records.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllPayrolls = async () => {
    if (!window.confirm(`Are you sure you want to delete ALL payroll records for Month ${selectedMonth}/${selectedYear}?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await api.delete('/payroll/clear-period', {
        params: { month: selectedMonth, year: selectedYear }
      });
      alert(res.data?.message || 'All records deleted for this period.');
      setSelectedPayrollIds([]);
      await fetchPayrolls();
    } catch (err) {
      console.error('Error clearing payroll period:', err);
      alert(err.response?.data?.message || 'Failed to clear payroll records.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateSelectedPayrolls = async (idsToRecalc = selectedPayrollIds) => {
    if (!idsToRecalc || idsToRecalc.length === 0) {
      return;
    }
    setLoading(true);
    try {
      await api.post('/payroll/recalculate-selected', {
        month: selectedMonth,
        year: selectedYear,
        ids: idsToRecalc
      });
      await fetchPayrolls();
      setSelectedPayrollIds(prev => prev.filter(id => !idsToRecalc.includes(id)));
    } catch (err) {
      console.error('Error recalculating selected payrolls:', err);
      alert(err.response?.data?.message || 'Failed to recalculate selected payroll records.');
    } finally {
      setLoading(false);
    }
  };

  // Delete individual payslip / payroll record
  const handleDeletePayslip = async (payslipId) => {
    if (window.confirm('Are you sure you want to delete this salary slip record?')) {
      try {
        await api.delete(`/payroll/${payslipId}`);
        alert('Salary slip deleted successfully');
        fetchPaidPayslips();
        fetchPayrolls();
      } catch (error) {
        console.error('Error deleting salary slip:', error);
        alert(error.response?.data?.message || 'Error deleting salary slip');
      }
    }
  };

  // Calculate and generate payroll
  const handleCalculatePayroll = async () => {
    setLoading(true);
    try {
      const response = await api.post('/payroll/calculate', {
        month: selectedMonth,
        year: selectedYear
      });

      if (response.data) {
        await fetchPayrolls();
      }
    } catch (error) {
      console.error('Error calculating payroll:', error);
      alert('Error calculating payroll. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Edit Payroll Handlers
  const handleEditPayrollClick = (payroll) => {
    setActivePayrollMenu(null);
    setEditPayrollData({
      id: payroll._id,
      employeeName: payroll.employeeId?.firstName ? `${payroll.employeeId.firstName} ${payroll.employeeId.lastName}` : 'Employee',
      basicSalary: payroll.salaryDetails?.basicSalary || 0,
      bonus: payroll.salaryDetails?.bonus || 0,
      penalty: payroll.salaryDetails?.deductions?.penalty || 0,
      originalGross: payroll.salaryDetails?.grossSalary || 0,
      originalTotalDeductions: payroll.salaryDetails?.totalDeductions || 0,
    });
    setShowEditPayrollModal(true);
  };

  const handleSaveEditPayroll = async () => {
    try {
      await api.put(`/payroll/${editPayrollData.id}`, {
        bonus: editPayrollData.bonus,
        penalty: editPayrollData.penalty
      });
      setShowEditPayrollModal(false);
      setEditPayrollData(null);
      await fetchPayrolls();
      
      setActiveToast({
        title: 'Payroll Updated',
        message: 'Bonus and penalty have been successfully updated.',
        type: 'success'
      });
    } catch (error) {
      console.error('Error updating payroll:', error);
      alert(error.response?.data?.message || 'Failed to update payroll');
    }
  };

  // Process individual payroll
  const handleProcessPayroll = async (payrollId) => {
    try {
      await api.patch(`/payroll/${payrollId}/process`);
      await fetchPayrolls();
    } catch (error) {
      console.error('Error processing payroll:', error);
      alert('Error processing payroll. Please try again.');
    }
  };

  // Mark payroll as paid
  const handleMarkAsPaid = async (payrollId) => {
    if (!window.confirm('Are you sure you want to mark this salary as paid? An email notification will be sent to the employee.')) {
      return;
    }
    try {
      await api.patch(`/payroll/${payrollId}/mark-paid`);
      await fetchPayrolls();
      alert('✅ Salary marked as paid! Email notification sent to employee.');
    } catch (error) {
      console.error('Error marking payroll as paid:', error);
      alert('Error marking payroll as paid. Please try again.');
    }
  };

  // Mark all payrolls as paid for the month
  const handleMarkAllAsPaid = async () => {
    if (!window.confirm(`Are you sure you want to mark ALL salaries as paid for this month? Email notifications will be sent to all employees.`)) {
      return;
    }
    try {
      const response = await api.patch('/payroll/mark-all-paid', {
        month: selectedMonth,
        year: selectedYear
      });
      await fetchPayrolls();
      alert(`✅ ${response.data.count} salaries marked as paid! Email notifications sent to all employees.`);
    } catch (error) {
      console.error('Error marking all payrolls as paid:', error);
      alert('Error marking payrolls as paid. Please try again.');
    }
  };

  // Edit employee bank details
  const handleEditBankDetails = (employee) => {
    setSelectedEmployee(employee);
    setBankFormData({
      bankName: employee.bankName || '',
      accountNumber: employee.accountNumber || '',
      ifscCode: employee.ifscCode || '',
      accountHolderName: employee.accountHolderName || '',
      panNumber: employee.panNumber || '',
      upiId: employee.upiId || ''
    });
    setShowBankModal(true);
  };

  // Save bank details (HR edit - kept for backwards compatibility)
  const handleSaveBankDetails = async () => {
    try {
      await api.put(`/users/${selectedEmployee._id}`, bankFormData);
      alert('✅ Bank details updated successfully!');
      setShowBankModal(false);
      fetchAllEmployees();
    } catch (error) {
      console.error('Error updating bank details:', error);
      alert('Error updating bank details. Please try again.');
    }
  };

  // Verify bank details (HR approve)
  const handleVerifyBankDetails = async (userId) => {
    if (!window.confirm('Are you sure you want to verify and approve these bank details?')) return;
    try {
      await api.patch(`/users/verify-bank-details/${userId}`, { status: 'verified' });
      alert('✅ Bank details verified successfully!');
      fetchAllEmployees();
    } catch (error) {
      console.error('Error verifying bank details:', error);
      alert('Error verifying bank details. Please try again.');
    }
  };

  // Reject bank details (HR reject)
  const handleRejectBankDetails = async (userId) => {
    const reason = prompt('Enter rejection reason (required):');
    if (!reason) {
      alert('Rejection reason is required.');
      return;
    }
    try {
      await api.patch(`/users/verify-bank-details/${userId}`, { status: 'rejected', rejectionReason: reason });
      alert('Bank details rejected. Employee will be notified.');
      fetchAllEmployees();
    } catch (error) {
      console.error('Error rejecting bank details:', error);
      alert('Error rejecting bank details. Please try again.');
    }
  };

  // Finalize payroll
  const handleFinalizePayroll = async (payrollId) => {
    try {
      await api.patch(`/payroll/${payrollId}/finalize`);
      await fetchPayrolls();
      alert('Payroll finalized successfully!');
    } catch (error) {
      console.error('Error finalizing payroll:', error);
      alert('Error finalizing payroll.');
    }
  };

  const handleDeletePayroll = async (payrollId) => {
    if (window.confirm('Are you sure you want to delete this payroll record? This action cannot be undone.')) {
      try {
        await api.delete(`/payroll/${payrollId}`);
        // Optimistically update UI
        setPayrolls(prev => prev.filter(p => p._id !== payrollId));
        setSelectedPayrollIds(prev => prev.filter(id => id !== payrollId));
        alert('Payroll record deleted permanently from database.');
      } catch (error) {
        console.error('Error deleting payroll:', error);
        alert('Error deleting payroll record.');
        fetchPayrolls(); // Revert on error
      }
    }
  };

  const handleClearMonth = async () => {
    const monthName = months.find(m => m.value === selectedMonth)?.label;
    if (window.confirm(`Are you sure you want to delete ALL payroll records for ${monthName} ${selectedYear}? This cannot be undone.`)) {
      try {
        await api.delete('/payroll/clear-period', {
          params: { month: selectedMonth, year: selectedYear }
        });
        setPayrolls([]);
        alert(`All payroll records for ${monthName} ${selectedYear} have been deleted.`);
      } catch (error) {
        console.error('Error clearing month:', error);
        alert('Error clearing payroll records.');
      }
    }
  };

  // Salary Structure Handlers
  const handleSaveRule = async () => {
    try {
      const payload = {
        ruleType: ruleFormData.ruleType,
        threshold: ruleFormData.threshold,
        penaltyType: ruleFormData.penaltyType,
        status: ruleFormData.status,
        description: ruleFormData.description
      };

      if (selectedRule && selectedRule._id) {
        await api.put(`/salary-rules/${selectedRule._id}`, payload);
        alert('Rule updated successfully!');
      } else {
        await api.post('/salary-rules', payload);
        alert('Rule created successfully!');
      }
      setShowRuleModal(false);
      fetchRules();
    } catch (error) {
      console.error('Error saving rule:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.message || 'Error saving salary rule.';
      alert(errorMsg);
    }
  };

  const handleSaveStructure = async () => {
    try {
      if (!structureFormData.employee) {
        alert('Please select an employee.');
        return;
      }

      if (!selectedStructure) {
        const existingStructure = structures.find(s =>
          (s.employee?._id || s.employee) === structureFormData.employee
        );
        if (existingStructure) {
          alert('A salary structure already exists for this employee. Please edit the existing one.');
          return;
        }
      }

      const late = parseFloat(structureFormData.lateArrivals) || 0;
      const leave = parseFloat(structureFormData.uninformedLeave) || 0;
      const penaltyDays = leave * 1;

      const payload = {
        employee: structureFormData.employee,
        basicSalary: parseFloat(structureFormData.basicSalary),
        bonus: parseFloat(structureFormData.bonus) || 0,
        gratuity: parseFloat(structureFormData.gratuity) || 0,
        allowances: {
          hra: parseFloat(structureFormData.hra) || 0,
          da: parseFloat(structureFormData.da) || 0,
          conveyance: parseFloat(structureFormData.conveyance) || 0,
          food: parseFloat(structureFormData.food) || 0,
          other: parseFloat(structureFormData.allowancesOther) || 0
        },
        deductions: {
          pf: parseFloat(structureFormData.pf) || 0,
          esi: parseFloat(structureFormData.esi) || 0,
          tax: parseFloat(structureFormData.tax) || 0,
          loan: parseFloat(structureFormData.loan) || 0,
          advance: parseFloat(structureFormData.advance) || 0,
          other: parseFloat(structureFormData.deductionsOther) || 0
        },
        lateArrivals: late,
        uninformedLeave: leave,
        totalPenaltyDays: penaltyDays,
        penaltyDeduction: parseFloat(structureFormData.penaltyDeduction) || 0,
        effectiveFrom: new Date()
      };

      if (selectedStructure && selectedStructure._id) {
        await api.put(`/salary-structure/${selectedStructure._id}`, payload);
        alert('Structure updated successfully!');
      } else {
        await api.post('/salary-structure', payload);
        alert('Structure created successfully!');
      }
      setShowStructureModal(false);
      fetchStructures();
    } catch (error) {
      console.error('Error saving structure:', error);
      const errorMsg = error.response?.data?.message || 'Error saving salary structure.';
      alert(errorMsg);
    }
  };

  const handleAddNewRule = () => {
    setSelectedRule(null);
    setRuleFormData({
      ruleType: '',
      threshold: '',
      penaltyType: '',
      status: 'active',
      description: ''
    });
    setShowRuleModal(true);
  };

  const handleEditRule = (rule) => {
    setSelectedRule(rule);
    setRuleFormData({
      ruleType: rule.ruleType,
      threshold: rule.threshold,
      penaltyType: rule.penaltyType,
      status: rule.status,
      description: rule.description || ''
    });
    setShowRuleModal(true);
  };

  const handleDeleteRule = async (ruleId) => {
    if (window.confirm(`Are you sure you want to delete this rule?`)) {
      try {
        await api.delete(`/salary-rules/${ruleId}`);
        alert('Rule deleted successfully!');
        fetchRules();
      } catch (error) {
        console.error('Error deleting rule:', error);
        alert('Error deleting salary rule.');
      }
    }
  };

  const handleAddNewStructure = () => {
    setIsStructureViewMode(false);
    setSelectedStructure(null);
    setStructureFormData({
      employee: '',
      basicSalary: '',
      hra: '',
      da: '',
      conveyance: '',
      food: '',
      allowancesOther: '',
      pf: '',
      esi: '',
      tax: '',
      loan: '',
      advance: '',
      deductionsOther: '',
      bonus: '',
      gratuity: '',
      grossSalary: '',
      lateArrivals: '',
      uninformedLeave: '',
      penaltyDeduction: ''
    });
    fetchEmployeesWithoutStructure();
    setShowStructureModal(true);
  };

  const handleDeleteStructure = async (structureId) => {
    if (window.confirm(`Are you sure you want to delete this salary structure? This action permanently removes it from the database.`)) {
      try {
        await api.delete(`/salary-structure/${structureId}`);
        alert('Structure deleted successfully!');
        fetchStructures();
        fetchEmployeesWithoutStructure();
      } catch (error) {
        console.error('Error deleting structure:', error);
        alert('Error deleting salary structure.');
      }
    }
  };

  const handleEditStructure = (structure) => {
    setIsStructureViewMode(false);
    setSelectedStructure(structure);
    setStructureFormData({
      employee: structure.employee?._id || structure.employee,
      basicSalary: structure.basicSalary || '',
      hra: structure.allowances?.hra || '',
      da: structure.allowances?.da || '',
      conveyance: structure.allowances?.conveyance || '',
      food: structure.allowances?.food || '',
      allowancesOther: structure.allowances?.other || '',
      pf: structure.deductions?.pf || '',
      esi: structure.deductions?.esi || '',
      tax: structure.deductions?.tax || '',
      loan: structure.deductions?.loan || '',
      advance: structure.deductions?.advance || '',
      deductionsOther: structure.deductions?.other || '',
      bonus: structure.bonus || '',
      gratuity: structure.gratuity || '',
      grossSalary: structure.grossSalary || '',
      lateArrivals: structure.lateArrivals || '',
      uninformedLeave: structure.uninformedLeave || '',
      penaltyDeduction: structure.penaltyDeduction || ''
    });
    setShowStructureModal(true);
  };

  const handleViewStructureOnly = (structure) => {
    setIsStructureViewMode(true);
    setSelectedStructure(structure);
    setStructureFormData({
      employee: structure.employee?._id || structure.employee,
      basicSalary: structure.basicSalary || '',
      hra: structure.allowances?.hra || '',
      da: structure.allowances?.da || '',
      conveyance: structure.allowances?.conveyance || '',
      food: structure.allowances?.food || '',
      allowancesOther: structure.allowances?.other || '',
      pf: structure.deductions?.pf || '',
      esi: structure.deductions?.esi || '',
      tax: structure.deductions?.tax || '',
      loan: structure.deductions?.loan || '',
      advance: structure.deductions?.advance || '',
      deductionsOther: structure.deductions?.other || '',
      bonus: structure.bonus || '',
      gratuity: structure.gratuity || '',
      grossSalary: structure.grossSalary || '',
      lateArrivals: structure.lateArrivals || '',
      uninformedLeave: structure.uninformedLeave || '',
      penaltyDeduction: structure.penaltyDeduction || ''
    });
    setShowStructureModal(true);
  };

  const handleViewStructure = async (payroll) => {
    setLoadingAttendance(true);
    setShowDetailedAttendanceModal(true);

    try {
      const response = await api.get(`/payroll/employee-attendance/${payroll.employee._id}`, {
        params: { month: selectedMonth, year: selectedYear, _t: Date.now() }
      });
      setDetailedAttendanceData(response.data);
    } catch (error) {
      console.error('Error fetching detailed attendance:', error);
      const errorMessage = error.response?.data?.message || 'Error loading attendance details. Please try again.';
      alert(errorMessage);
      setShowDetailedAttendanceModal(false);
    } finally {
      setLoadingAttendance(false);
    }
  };



  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  // Helper for PDF: simple formatting without special symbols
  const formatCurrencyForPDF = (amount) => {
    return 'Rs. ' + (amount || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    });
  };

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Export Monthly Payroll PDF
  const handleExportPayroll = () => {
    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      const monthName = months.find(m => m.value === selectedMonth)?.label || 'Month';

      // Header Banner
      doc.setFillColor(59, 119, 94);
      doc.rect(0, 0, 842, 50, 'F');
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`Monthly Payroll Summary - ${monthName} ${selectedYear}`, 30, 32);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(230, 245, 235);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')}`, 630, 32);

      const tableColumn = [
        "Sr", "Date", "Emp ID", "Employee Name", "Designation",
        "Present", "Late", "Basic Salary", "Allowances", "Deductions", "Net Salary", "Status"
      ];

      const filtered = payrolls.filter((payroll) => {
        if (payrollStatusFilter !== 'all' && (payroll.status || '').toLowerCase() !== payrollStatusFilter.toLowerCase()) return false;
        if (payrollEmployeeFilter !== 'all') {
          const empId = (typeof payroll.employee === 'object' ? payroll.employee?._id : payroll.employee) || '';
          if (empId.toString() !== payrollEmployeeFilter.toString()) return false;
        }
        if (payrollSearchTerm.trim()) {
          const term = payrollSearchTerm.toLowerCase().trim();
          const emp = payroll.employee || {};
          const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
          const email = (emp.email || '').toLowerCase();
          const empCode = (emp.employeeId || '').toLowerCase();
          const designation = (emp.designation || '').toLowerCase();
          if (!fullName.includes(term) && !email.includes(term) && !empCode.includes(term) && !designation.includes(term)) return false;
        }
        return true;
      });

      const listToExport = filtered.length > 0 ? filtered : payrolls;
      let totalNet = 0;
      let totalDed = 0;

      const tableRows = listToExport.map((p, idx) => {
        const emp = p.employee || {};
        const basic = p.salaryDetails?.basicSalary || 0;
        const gross = p.salaryDetails?.grossSalary || 0;
        const ded = p.salaryDetails?.totalDeductions || 0;
        const net = p.salaryDetails?.netSalary || 0;
        const allow = gross - basic;
        totalNet += net;
        totalDed += ded;

        return [
          idx + 1,
          p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '-',
          emp.employeeId || 'N/A',
          `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
          emp.designation || '-',
          p.attendance?.present || 0,
          p.attendance?.lateCheckIns || 0,
          formatCurrencyForPDF(basic),
          formatCurrencyForPDF(allow > 0 ? allow : 0),
          formatCurrencyForPDF(ded),
          formatCurrencyForPDF(net),
          (p.status || 'Draft').toUpperCase()
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 119, 94],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 55 },
          2: { halign: 'center', cellWidth: 55 },
          3: { halign: 'left', cellWidth: 100 },
          4: { halign: 'left', cellWidth: 90 },
          5: { halign: 'center', cellWidth: 45 },
          6: { halign: 'center', cellWidth: 40 },
          7: { halign: 'right', cellWidth: 70 },
          8: { halign: 'right', cellWidth: 65 },
          9: { halign: 'right', cellWidth: 65, textColor: [220, 38, 38] },
          10: { halign: 'right', cellWidth: 75, fontStyle: 'bold', textColor: [22, 101, 52] },
          11: { halign: 'center', cellWidth: 55 }
        },
        foot: [[
          { content: 'TOTALS', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatCurrencyForPDF(listToExport.reduce((acc, p) => acc + (p.salaryDetails?.basicSalary || 0), 0)), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatCurrencyForPDF(listToExport.reduce((acc, p) => acc + Math.max(0, (p.salaryDetails?.grossSalary || 0) - (p.salaryDetails?.basicSalary || 0)), 0)), styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatCurrencyForPDF(totalDed), styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] } },
          { content: formatCurrencyForPDF(totalNet), styles: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] } },
          { content: '', styles: { halign: 'center' } }
        ]],
        footStyles: {
          fillColor: [240, 253, 244],
          textColor: [15, 23, 42],
          fontSize: 8.5
        }
      });

      doc.save(`Monthly_Payroll_${monthName}_${selectedYear}.pdf`);
    } catch (error) {
      console.error('Error generating payroll PDF:', error);
      alert('Error generating PDF file: ' + error.message);
    }
  };

  // Export Monthly Payroll to Excel
  const handleExportPayrollExcel = () => {
    try {
      const monthName = months.find(m => m.value === selectedMonth)?.label || 'Month';
      const filtered = payrolls.filter((payroll) => {
        if (payrollStatusFilter !== 'all' && (payroll.status || '').toLowerCase() !== payrollStatusFilter.toLowerCase()) return false;
        if (payrollEmployeeFilter !== 'all') {
          const empId = (typeof payroll.employee === 'object' ? payroll.employee?._id : payroll.employee) || '';
          if (empId.toString() !== payrollEmployeeFilter.toString()) return false;
        }
        if (payrollSearchTerm.trim()) {
          const term = payrollSearchTerm.toLowerCase().trim();
          const emp = payroll.employee || {};
          const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
          const email = (emp.email || '').toLowerCase();
          const empCode = (emp.employeeId || '').toLowerCase();
          const designation = (emp.designation || '').toLowerCase();
          if (!fullName.includes(term) && !email.includes(term) && !empCode.includes(term) && !designation.includes(term)) return false;
        }
        return true;
      });

      const exportData = (filtered.length > 0 ? filtered : payrolls).map((p, idx) => {
        const emp = p.employee || {};
        const presentDays = p.attendance?.present || 0;
        const lateCheckIns = p.attendance?.lateCheckIns || 0;
        const absentDays = p.workingDays?.absent || 0;
        const halfDays = p.workingDays?.halfDay || 0;
        const paidDays = presentDays + (halfDays * 0.5) + (p.leaves?.paid || 0);

        return {
          'Sr No': idx + 1,
          'Date': p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN') : '',
          'Employee ID': emp.employeeId || 'N/A',
          'Employee Name': `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
          'Designation': emp.designation || 'N/A',
          'Department': typeof emp.department === 'object' ? emp.department?.name : (emp.department || 'N/A'),
          'Present Days': presentDays,
          'Late Check-Ins': lateCheckIns,
          'Absent Days': absentDays,
          'Paid Days': paidDays,
          'LOP Days': p.workingDays?.absent || 0,
          'Allowances (INR)': p.salaryDetails?.allowances ? Object.values(p.salaryDetails.allowances).reduce((a, b) => a + (parseFloat(b) || 0), 0) : 0,
          'Penalties (INR)': p.salaryDetails?.deductions?.penalty || 0,
          'Basic Salary (INR)': p.salaryDetails?.basicSalary || 0,
          'Gross Salary (INR)': p.salaryDetails?.grossSalary || 0,
          'Total Deductions (INR)': p.salaryDetails?.totalDeductions || 0,
          'Net Salary (INR)': p.salaryDetails?.netSalary || 0,
          'Payment Due Date': p.paymentDueDate ? new Date(p.paymentDueDate).toLocaleDateString('en-IN') : '',
          'Status': (p.status || 'Draft').toUpperCase(),
          'Generated By': p.generatedBy ? (typeof p.generatedBy === 'object' ? `${p.generatedBy.firstName || ''} ${p.generatedBy.lastName || ''}`.trim() : p.generatedBy) : 'Admin'
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 20 },
        { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
        { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
        { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Payroll');
      XLSX.writeFile(wb, `Monthly_Payroll_${monthName}_${selectedYear}.xlsx`);
    } catch (error) {
      console.error('Error exporting payroll Excel:', error);
      alert('Error exporting Excel file: ' + error.message);
    }
  };

  // Export Salary Structures PDF
  const handleExportStructures = () => {
    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      doc.setFillColor(59, 119, 94);
      doc.rect(0, 0, 842, 50, 'F');
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text("Employee Salary Structures", 30, 32);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(230, 245, 235);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 680, 32);

      const tableColumn = [
        "Sr", "Emp ID", "Employee Name", "Designation", "Department",
        "Basic Salary", "HRA", "DA", "Transport", "Total Allowances", "Gross Salary", "Created On"
      ];

      const filtered = structures.filter((s) => {
        if (structEmployeeFilter !== 'all') {
          const empId = (typeof s.employee === 'object' ? s.employee?._id : s.employee) || '';
          if (empId.toString() !== structEmployeeFilter.toString()) return false;
        }
        if (structSearchTerm.trim()) {
          const term = structSearchTerm.toLowerCase().trim();
          const emp = s.employee || {};
          const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
          const email = (emp.email || '').toLowerCase();
          const empCode = (emp.employeeId || '').toLowerCase();
          const desig = (emp.designation || '').toLowerCase();
          if (!fullName.includes(term) && !email.includes(term) && !empCode.includes(term) && !desig.includes(term)) return false;
        }
        return true;
      });

      const list = filtered.length > 0 ? filtered : structures;

      const tableRows = list.map((s, idx) => {
        const emp = s.employee || {};
        const basic = parseFloat(s.basicSalary) || 0;
        const hra = parseFloat(s.hra || s.allowances?.hra) || 0;
        const da = parseFloat(s.da || s.allowances?.da) || 0;
        const transport = parseFloat(s.transport || s.allowances?.transport || s.allowances?.conveyance) || 0;
        const medical = parseFloat(s.medical || s.allowances?.medical || s.allowances?.food) || 0;
        const bonus = parseFloat(s.bonus) || 0;
        const totAllow = hra + da + transport + medical + bonus;
        const gross = basic + totAllow;

        return [
          idx + 1,
          emp.employeeId || 'N/A',
          `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
          emp.designation || '-',
          typeof emp.department === 'object' ? emp.department?.name : (emp.department || '-'),
          formatCurrencyForPDF(basic),
          formatCurrencyForPDF(hra),
          formatCurrencyForPDF(da),
          formatCurrencyForPDF(transport),
          formatCurrencyForPDF(totAllow),
          formatCurrencyForPDF(gross),
          s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '-'
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 119, 94],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 55 },
          2: { halign: 'left', cellWidth: 100 },
          3: { halign: 'left', cellWidth: 90 },
          4: { halign: 'left', cellWidth: 80 },
          5: { halign: 'right', cellWidth: 70 },
          6: { halign: 'right', cellWidth: 55 },
          7: { halign: 'right', cellWidth: 55 },
          8: { halign: 'right', cellWidth: 60 },
          9: { halign: 'right', cellWidth: 75, textColor: [22, 163, 74] },
          10: { halign: 'right', cellWidth: 75, fontStyle: 'bold', textColor: [22, 101, 52] },
          11: { halign: 'center', cellWidth: 60 }
        }
      });

      doc.save(`Salary_Structures_${new Date().getFullYear()}.pdf`);
    } catch (error) {
      console.error('Error generating structures PDF:', error);
      alert('Error generating PDF file: ' + error.message);
    }
  };

  // Export Salary Structures to Excel
  const handleExportStructuresExcel = () => {
    try {
      const filtered = structures.filter((s) => {
        if (structEmployeeFilter !== 'all') {
          const empId = (typeof s.employee === 'object' ? s.employee?._id : s.employee) || '';
          if (empId.toString() !== structEmployeeFilter.toString()) return false;
        }
        if (structSearchTerm.trim()) {
          const term = structSearchTerm.toLowerCase().trim();
          const emp = s.employee || {};
          const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
          const email = (emp.email || '').toLowerCase();
          const empCode = (emp.employeeId || '').toLowerCase();
          const desig = (emp.designation || '').toLowerCase();
          if (!fullName.includes(term) && !email.includes(term) && !empCode.includes(term) && !desig.includes(term)) return false;
        }
        return true;
      });

      const list = filtered.length > 0 ? filtered : structures;
      const exportData = list.map((s, idx) => {
        const emp = s.employee || {};
        const basic = parseFloat(s.basicSalary) || 0;
        const hra = parseFloat(s.hra || s.allowances?.hra) || 0;
        const da = parseFloat(s.da || s.allowances?.da) || 0;
        const transport = parseFloat(s.transport || s.allowances?.transport || s.allowances?.conveyance) || 0;
        const medical = parseFloat(s.medical || s.allowances?.medical || s.allowances?.food) || 0;
        const bonus = parseFloat(s.bonus) || 0;
        const totAllow = hra + da + transport + medical + bonus;
        const gross = basic + totAllow;

        return {
          'Sr No': idx + 1,
          'Employee ID': emp.employeeId || 'N/A',
          'Employee Name': `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
          'Designation': emp.designation || 'N/A',
          'Department': typeof emp.department === 'object' ? emp.department?.name : (emp.department || 'N/A'),
          'Basic Salary (INR)': basic,
          'HRA (INR)': hra,
          'DA (INR)': da,
          'Transport Allowance (INR)': transport,
          'Medical Allowance (INR)': medical,
          'Bonus (INR)': bonus,
          'Total Allowances (INR)': totAllow,
          'Gross Salary (INR)': gross,
          'Created On': s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '',
          'Created By': s.createdBy && typeof s.createdBy === 'object' ? `${s.createdBy.firstName || ''} ${s.createdBy.lastName || ''}`.trim() : (s.createdBy || 'Admin')
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 18 },
        { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
        { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 18 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Salary Structures');
      XLSX.writeFile(wb, `Salary_Structures_${new Date().getFullYear()}.xlsx`);
    } catch (error) {
      console.error('Error exporting structures Excel:', error);
      alert('Error exporting Excel file: ' + error.message);
    }
  };

  // Export Salary Slips PDF
  const handleExportSalarySlipsPDF = () => {
    try {
      const doc = new jsPDF('landscape', 'pt', 'a4');
      const monthName = months.find(m => m.value === selectedMonth)?.label || 'Month';

      doc.setFillColor(59, 119, 94);
      doc.rect(0, 0, 842, 50, 'F');
      doc.setFontSize(15);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`Salary Slips Summary - ${monthName} ${selectedYear}`, 30, 32);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(230, 245, 235);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 680, 32);

      const tableColumn = [
        "Sr", "Date", "Emp ID", "Employee Name", "Designation", "Department",
        "Basic Salary", "Bonus/Allowances", "Deductions", "Net Salary", "Payment Date", "Status"
      ];

      const filtered = paidPayslips.filter((s) => {
        if (payslipStatusFilter !== 'all' && (s.status || '').toLowerCase() !== payslipStatusFilter.toLowerCase()) return false;
        if (payslipEmployeeFilter !== 'all') {
          const empId = (typeof s.employee === 'object' ? s.employee?._id : s.employee) || '';
          if (empId.toString() !== payslipEmployeeFilter.toString()) return false;
        }
        if (payslipSearchTerm.trim()) {
          const term = payslipSearchTerm.toLowerCase().trim();
          const emp = s.employee || {};
          const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
          const email = (emp.email || '').toLowerCase();
          const empCode = (emp.employeeId || '').toLowerCase();
          const desig = (emp.designation || '').toLowerCase();
          if (!fullName.includes(term) && !email.includes(term) && !empCode.includes(term) && !desig.includes(term)) return false;
        }
        return true;
      });

      const list = filtered.length > 0 ? filtered : paidPayslips;
      let totalNet = 0;
      let totalDed = 0;

      const tableRows = list.map((s, idx) => {
        const emp = s.employee || {};
        const basic = s.salaryDetails?.basicSalary || 0;
        const gross = s.salaryDetails?.grossSalary || 0;
        const ded = s.salaryDetails?.totalDeductions || 0;
        const net = s.salaryDetails?.netSalary || 0;
        const bonus = s.salaryDetails?.bonus || 0;
        const allow = gross - basic;
        totalNet += net;
        totalDed += ded;

        return [
          idx + 1,
          s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '-',
          emp.employeeId || 'N/A',
          `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
          emp.designation || '-',
          typeof emp.department === 'object' ? emp.department?.name : (emp.department || '-'),
          formatCurrencyForPDF(basic),
          formatCurrencyForPDF(allow + bonus),
          formatCurrencyForPDF(ded),
          formatCurrencyForPDF(net),
          s.paidAt ? new Date(s.paidAt).toLocaleDateString('en-IN') : (s.paymentDueDate ? new Date(s.paymentDueDate).toLocaleDateString('en-IN') : '-'),
          (s.status || 'Paid').toUpperCase()
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 119, 94],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 4,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 25 },
          1: { halign: 'center', cellWidth: 55 },
          2: { halign: 'center', cellWidth: 55 },
          3: { halign: 'left', cellWidth: 95 },
          4: { halign: 'left', cellWidth: 85 },
          5: { halign: 'left', cellWidth: 75 },
          6: { halign: 'right', cellWidth: 65 },
          7: { halign: 'right', cellWidth: 65 },
          8: { halign: 'right', cellWidth: 60, textColor: [220, 38, 38] },
          9: { halign: 'right', cellWidth: 70, fontStyle: 'bold', textColor: [22, 101, 52] },
          10: { halign: 'center', cellWidth: 65 },
          11: { halign: 'center', cellWidth: 50 }
        },
        foot: [[
          { content: 'TOTALS', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatCurrencyForPDF(totalDed), styles: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] } },
          { content: formatCurrencyForPDF(totalNet), styles: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] } },
          { content: '', colSpan: 2, styles: { halign: 'center' } }
        ]],
        footStyles: {
          fillColor: [240, 253, 244],
          textColor: [15, 23, 42],
          fontSize: 8.5
        }
      });

      doc.save(`Salary_Slips_${monthName}_${selectedYear}.pdf`);
    } catch (error) {
      console.error('Error generating salary slips PDF:', error);
      alert('Error generating PDF file: ' + error.message);
    }
  };

  // Export Salary Slips to Excel
  const handleExportSalarySlipsExcel = () => {
    try {
      const monthName = months.find(m => m.value === selectedMonth)?.label || 'Month';
      const filtered = paidPayslips.filter((s) => {
        if (payslipStatusFilter !== 'all' && (s.status || '').toLowerCase() !== payslipStatusFilter.toLowerCase()) return false;
        if (payslipEmployeeFilter !== 'all') {
          const empId = (typeof s.employee === 'object' ? s.employee?._id : s.employee) || '';
          if (empId.toString() !== payslipEmployeeFilter.toString()) return false;
        }
        if (payslipSearchTerm.trim()) {
          const term = payslipSearchTerm.toLowerCase().trim();
          const emp = s.employee || {};
          const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
          const email = (emp.email || '').toLowerCase();
          const empCode = (emp.employeeId || '').toLowerCase();
          const desig = (emp.designation || '').toLowerCase();
          if (!fullName.includes(term) && !email.includes(term) && !empCode.includes(term) && !desig.includes(term)) return false;
        }
        return true;
      });

      const list = filtered.length > 0 ? filtered : paidPayslips;
      const exportData = list.map((s, idx) => {
        const emp = s.employee || {};
        const basic = s.salaryDetails?.basicSalary || 0;
        const gross = s.salaryDetails?.grossSalary || 0;
        const ded = s.salaryDetails?.totalDeductions || 0;
        const net = s.salaryDetails?.netSalary || 0;
        const bonus = s.salaryDetails?.bonus || 0;
        const allow = gross - basic;

        return {
          'Sr No': idx + 1,
          'Date': s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN') : '',
          'Employee ID': emp.employeeId || 'N/A',
          'Employee Name': `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'N/A',
          'Designation': emp.designation || 'N/A',
          'Department': typeof emp.department === 'object' ? emp.department?.name : (emp.department || 'N/A'),
          'Month': monthName,
          'Year': selectedYear,
          'Present Days': s.attendance?.present || s.workingDays?.present || 30,
          'Basic Salary (INR)': basic,
          'Bonus / Allowances (INR)': allow + bonus,
          'Gross Salary (INR)': gross,
          'Total Deductions (INR)': ded,
          'Net Salary (INR)': net,
          'Payment Date': s.paidAt ? new Date(s.paidAt).toLocaleDateString('en-IN') : (s.paymentDueDate ? new Date(s.paymentDueDate).toLocaleDateString('en-IN') : '-'),
          'Status': (s.status || 'Paid').toUpperCase()
        };
      });

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 }, { wch: 12 }, { wch: 14 }, { wch: 22 }, { wch: 20 },
        { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 20 },
        { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 12 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Salary Slips');
      XLSX.writeFile(wb, `Salary_Slips_${monthName}_${selectedYear}.xlsx`);
    } catch (error) {
      console.error('Error exporting salary slips Excel:', error);
      alert('Error exporting Excel file: ' + error.message);
    }
  };

  // Export Payroll to Word
  const handleExportPayrollWord = async () => {
    try {
      const response = await api.get('/payroll/export/word', {
        params: { month: selectedMonth, year: selectedYear },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      const monthName = months.find(m => m.value === selectedMonth)?.label;
      link.download = `Payroll_${monthName}_${selectedYear}.docx`;
      link.click();
    } catch (error) {
      console.error('Error exporting payroll to Word:', error);
      alert('Error exporting Word file');
    }
  };

  return (
    <div className="page-container" style={{ background: '#f8fafc', minHeight: '100vh', padding: '14px 16px 32px', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif" }}>
      <div className="payroll-container" style={{ padding: 0 }}>
        {/* Header Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>Payroll Management</h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0', fontWeight: 500 }}>Calculate monthly salary and manage payroll details</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Month:</label>
              <select
                className="filter-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>Year:</label>
              <select
                className="filter-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {years.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            
            {activeTab === 'payslips' && (
              <button
                onClick={handleOpenGenerateSlip}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 2px 4px rgba(59,119,94,0.18)',
                  whiteSpace: 'nowrap',
                  transition: 'opacity 0.15s, transform 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>Generate Salary Slip</span>
              </button>
            )}

            {activeTab === 'payroll' && (
              <button
                className="calculate-btn"
                onClick={handleCalculatePayroll}
                style={{ padding: '8px 18px', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Calculate &amp; Generate
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="payroll-tabs">
          <button
            className={`tab-btn ${activeTab === 'payroll' ? 'active' : ''}`}
            onClick={() => setActiveTab('payroll')}
          >
            Monthly Payroll
          </button>
          <button
            className={`tab-btn ${activeTab === 'salary' ? 'active' : ''}`}
            onClick={() => setActiveTab('salary')}
          >
            Salary Structure
          </button>

          <button
            className={`tab-btn ${activeTab === 'payslips' ? 'active' : ''}`}
            onClick={() => setActiveTab('payslips')}
          >
            Salary Slip
          </button>
          {/* <button
            className={`tab-btn ${activeTab === 'accounting' ? 'active' : ''}`}
            onClick={() => setActiveTab('accounting')}
          >
            Finance / Accounting
          </button> */}
        </div>

        {activeTab === 'payroll' && (
          <>

            {/* Stats Section — MyLeads style */}
            {(() => {
              // Sparkline component
              const PaySparkline = ({ data, color }) => {
                const w = 80, h = 32;
                const max = Math.max(...data, 1);
                const min = Math.min(...data);
                const range = max - min || 1;
                const pts = data.map((v, i) => {
                  const x = (i / (data.length - 1)) * w;
                  const y = h - 4 - ((v - min) / range) * (h - 10);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ');
                const fillPts = `0,${h} ${pts} ${w},${h}`;
                const gradId = `slg-pay-${color.replace('#', '')}`;
                return (
                  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points={fillPts} fill={`url(#${gradId})`} />
                    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    {data.map((v, i) => {
                      const x = (i / (data.length - 1)) * w;
                      const y = h - 4 - ((v - min) / range) * (h - 10);
                      return i === data.length - 1 ? <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} /> : null;
                    })}
                  </svg>
                );
              };

              const cards = [
                {
                  label: 'Employees',
                  value: stats.totalEmployees,
                  display: stats.totalEmployees,
                  sublabel: 'payroll generated',
                  color: '#3b82f6',
                  spark: [0, 0, 0, 0, 0, stats.totalEmployees],
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                },
                {
                  label: 'Total Gross Salary',
                  value: stats.totalGrossSalary,
                  display: formatCurrency(stats.totalGrossSalary),
                  sublabel: 'gross payroll',
                  color: '#22c55e',
                  spark: [0, 0, 0, 0, 0, stats.totalGrossSalary],
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                },
                {
                  label: 'Total Deductions',
                  value: stats.totalDeductions,
                  display: formatCurrency(stats.totalDeductions),
                  sublabel: 'Penalties and Deductions',
                  color: '#ef4444',
                  spark: [0, 0, 0, 0, 0, stats.totalDeductions],
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                },
                {
                  label: 'Total Net Salary',
                  value: stats.totalNetSalary,
                  display: formatCurrency(stats.totalNetSalary),
                  sublabel: 'in-hand disbursement',
                  color: '#8b5cf6',
                  spark: [0, 0, 0, 0, 0, stats.totalNetSalary],
                  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                },
              ];

              return (
                <>
                  <style>{`
                    @keyframes pay-bubble-large {
                      0%   { transform: translate(0px, 0px) scale(1); }
                      30%  { transform: translate(-5px, -7px) scale(1.04); }
                      60%  { transform: translate(4px, -4px) scale(0.97); }
                      100% { transform: translate(0px, 0px) scale(1); }
                    }
                    @keyframes pay-bubble-small {
                      0%   { transform: translate(0px, 0px) scale(1); }
                      35%  { transform: translate(6px, -9px) scale(1.06); }
                      65%  { transform: translate(-4px, -3px) scale(0.95); }
                      100% { transform: translate(0px, 0px) scale(1); }
                    }
                    .pay-ist-grid > div { position: relative; overflow: hidden; isolation: isolate; }
                    .pay-ist-grid > div::before {
                      content: ''; position: absolute; z-index: 0;
                      width: 90px; height: 90px; border-radius: 50%;
                      opacity: 0.06; right: -26px; bottom: -26px;
                      pointer-events: none;
                      animation: pay-bubble-large 5.5s ease-in-out infinite;
                    }
                    .pay-ist-grid > div::after {
                      content: ''; position: absolute; z-index: 0;
                      width: 54px; height: 54px; border-radius: 50%;
                      opacity: 0.04; right: 36px; bottom: -20px;
                      pointer-events: none;
                      animation: pay-bubble-small 4.2s ease-in-out infinite;
                    }
                    .pay-ist-grid > div:nth-child(1)::before, .pay-ist-grid > div:nth-child(1)::after { background: #3b82f6; }
                    .pay-ist-grid > div:nth-child(2)::before, .pay-ist-grid > div:nth-child(2)::after { background: #22c55e; }
                    .pay-ist-grid > div:nth-child(3)::before, .pay-ist-grid > div:nth-child(3)::after { background: #ef4444; }
                    .pay-ist-grid > div:nth-child(4)::before, .pay-ist-grid > div:nth-child(4)::after { background: #8b5cf6; }
                    .pay-ist-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
                    .pay-ist-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
                    .pay-ist-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
                    .pay-ist-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
                    .pay-ist-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
                    .pay-ist-grid > div:nth-child(4)::after { animation-delay: 1.8s; }
                    @media (max-width: 768px) {
                      .pay-ist-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
                      .pay-ist-grid > div::before, .pay-ist-grid > div::after { display: none !important; }
                    }
                  `}</style>
                  <div className="pay-ist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                    {cards.map(({ label, display, sublabel, color, spark }) => (
                      <div
                        key={label}
                        style={{ background: 'white', padding: '14px 16px 10px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'default', transition: 'all 0.3s', overflow: 'hidden', position: 'relative' }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                      >
                        {/* Row 1: Label + green badge */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
                          <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: 'rgba(168,230,61,0.15)', color: '#3d7c00', whiteSpace: 'nowrap' }}>
                            ▲ +100%
                          </span>
                        </div>
                        {/* Row 2: Value */}
                        <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px' }}>{display}</div>
                        {/* Row 3: Trend text left + sparkline right */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: color, lineHeight: 1.2 }}>+{sublabel}</span>
                            <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>In this month</span>
                          </div>
                          <PaySparkline data={spark} color={color} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Payroll Records Table */}
            <style>{`
              .pr-tbl { font-family: 'Inter','Poppins','Segoe UI',sans-serif; width: 100%; border-collapse: collapse; }
              .pr-tbl thead tr { background: #fafafa; box-shadow: 0 1px 0 #f1f5f9; }
              .pr-tbl thead th { font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding: 10px 12px; text-align: left; white-space: nowrap; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
              .pr-tbl tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .15s; }
              .pr-tbl tbody tr:hover { background: #fafffe; }
              .pr-tbl tbody td { font-size: 11px; color: #475569; padding: 10px 12px; vertical-align: middle; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
              .pr-tbl tbody tr:last-child { border-bottom: none; }
            `}</style>
            <div className="payroll-records" style={{ overflow: 'visible' }}>
              <div className="payroll-records-header" style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: '#fafafa', borderRadius: '14px 14px 0 0', position: 'relative', zIndex: (empDdOpen || statusDdOpen) ? 1000 : 20, justifyContent: 'space-between', flexDirection: 'row' }}>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', flex: 1 }}>
                  {/* Search */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px', minWidth: '220px', maxWidth: '300px', transition: 'all 0.2s' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3b775e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input
                      type="text"
                      placeholder="Search by name, email..."
                      value={payrollSearchTerm}
                      onChange={e => setPayrollSearchTerm(e.target.value)}
                      style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#0f172a', background: 'transparent', width: '100%', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500 }}
                    />
                    {payrollSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setPayrollSearchTerm('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#94a3b8' }}
                        title="Clear search"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                  </div>

                  {/* Filter Dropdowns */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {/* Status Dropdown Popover */}
                    <div className="payroll-status-dd-container" style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStatusDdOpen(prev => !prev);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 11px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: payrollStatusFilter !== 'all' ? '#15803d' : '#475569',
                          background: payrollStatusFilter !== 'all' ? '#dcfce7' : '#fff',
                          cursor: 'pointer',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          fontWeight: 500,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => {
                          if (payrollStatusFilter === 'all') e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={e => {
                          if (payrollStatusFilter === 'all') e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <span>
                          {payrollStatusFilter === 'all'
                            ? 'All Statuses'
                            : payrollStatusFilter === 'draft'
                              ? 'Draft'
                              : payrollStatusFilter === 'processed'
                                ? 'Processed'
                                : payrollStatusFilter === 'paid'
                                  ? 'Paid'
                                  : payrollStatusFilter}
                        </span>
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={payrollStatusFilter !== 'all' ? '#15803d' : '#64748b'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: statusDdOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {statusDdOpen && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            background: '#ffffff',
                            borderRadius: '14px',
                            boxShadow: '0 10px 35px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                            zIndex: 300,
                            width: '180px',
                            padding: '6px',
                            overflow: 'hidden'
                          }}
                        >
                          {[
                            { value: 'all', label: 'All Statuses', dot: null },
                            { value: 'draft', label: 'Draft', dot: '#f59e0b' },
                            { value: 'processed', label: 'Processed', dot: '#3b82f6' },
                            { value: 'paid', label: 'Paid', dot: '#16a34a' }
                          ].map(opt => {
                            const isSelected = payrollStatusFilter === opt.value;
                            return (
                              <div
                                key={opt.value}
                                onClick={() => {
                                  setPayrollStatusFilter(opt.value);
                                  setStatusDdOpen(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11.5px',
                                  fontWeight: isSelected ? 600 : 500,
                                  cursor: 'pointer',
                                  color: isSelected ? '#15803d' : '#1e293b',
                                  background: isSelected ? '#dcfce7' : 'transparent',
                                  marginBottom: '2px',
                                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={e => {
                                  if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                }}
                                onMouseLeave={e => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                {opt.dot ? (
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: opt.dot, flexShrink: 0, display: 'inline-block' }} />
                                ) : (
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', border: '1.5px solid #94a3b8', flexShrink: 0, display: 'inline-block' }} />
                                )}
                                <span>{opt.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Employees Dropdown Popover */}
                    <div className="payroll-emp-dd-container" style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEmpDdOpen(prev => !prev);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 11px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: payrollEmployeeFilter !== 'all' ? '#15803d' : '#475569',
                          background: payrollEmployeeFilter !== 'all' ? '#dcfce7' : '#fff',
                          cursor: 'pointer',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          fontWeight: 500,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => {
                          if (payrollEmployeeFilter === 'all') e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={e => {
                          if (payrollEmployeeFilter === 'all') e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <span>
                          {payrollEmployeeFilter === 'all'
                            ? 'All Employees'
                            : (() => {
                                const found = allEmployees.find(emp => emp._id === payrollEmployeeFilter);
                                return found ? `${found.firstName} ${found.lastName}` : 'All Employees';
                              })()}
                        </span>
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={payrollEmployeeFilter !== 'all' ? '#15803d' : '#64748b'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: empDdOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {empDdOpen && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            background: '#ffffff',
                            borderRadius: '16px',
                            boxShadow: '0 10px 35px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                            zIndex: 300,
                            width: '640px',
                            maxWidth: '90vw',
                            padding: '12px',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Search Bar */}
                          <div style={{ padding: '2px 4px', marginBottom: '8px' }}>
                            <input
                              type="text"
                              placeholder="Search employees..."
                              value={filterEmpSearch}
                              onChange={(e) => setFilterEmpSearch(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px',
                                outline: 'none',
                                fontFamily: "'Inter','Poppins','Segoe UI',sans-serif"
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          </div>

                          {/* All Employees option */}
                          <div
                            onClick={() => {
                              setPayrollEmployeeFilter('all');
                              setEmpDdOpen(false);
                              setFilterEmpSearch('');
                            }}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: payrollEmployeeFilter === 'all' ? '600' : '500',
                              cursor: 'pointer',
                              color: payrollEmployeeFilter === 'all' ? '#15803d' : '#1e293b',
                              background: payrollEmployeeFilter === 'all' ? '#dcfce7' : 'transparent',
                              marginBottom: '6px',
                              fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => {
                              if (payrollEmployeeFilter !== 'all') e.currentTarget.style.background = '#f8fafc';
                            }}
                            onMouseLeave={e => {
                              if (payrollEmployeeFilter !== 'all') e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            All Employees
                          </div>

                          {/* Grid of employees */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: '4px',
                              maxHeight: '280px',
                              overflowY: 'auto',
                              paddingRight: '4px'
                            }}
                          >
                            {allEmployees
                              .filter(emp => emp.isActive !== false)
                              .filter(emp => {
                                const q = filterEmpSearch.toLowerCase().trim();
                                if (!q) return true;
                                const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
                                const code = (emp.employeeId || '').toLowerCase();
                                const desig = (emp.designation || '').toLowerCase();
                                return name.includes(q) || code.includes(q) || desig.includes(q);
                              })
                              .slice()
                              .sort((a, b) => `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`))
                              .map(emp => {
                                const isSelected = payrollEmployeeFilter === emp._id;
                                return (
                                  <div
                                    key={emp._id}
                                    onClick={() => {
                                      setPayrollEmployeeFilter(emp._id);
                                      setEmpDdOpen(false);
                                    }}
                                    style={{
                                      padding: '6px 8px',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      color: isSelected ? '#15803d' : '#1e293b',
                                      background: isSelected ? '#dcfce7' : 'transparent',
                                      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                                      transition: 'background 0.15s',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '2px',
                                      border: isSelected ? '1px solid #86efac' : '1px solid transparent'
                                    }}
                                    onMouseEnter={e => {
                                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                    }}
                                    onMouseLeave={e => {
                                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    }}
                                    title={`${emp.firstName} ${emp.lastName}${emp.employeeId ? ` (${emp.employeeId})` : ''}${emp.designation ? ` - ${emp.designation}` : ''}`}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                      <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                      {emp.employeeId && (
                                        <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px', flexShrink: 0 }}>
                                          {emp.employeeId}
                                        </span>
                                      )}
                                    </div>
                                    {emp.designation && (
                                      <span style={{ fontSize: '9.5px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {emp.designation}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reset button if any filter is active */}
                    {(payrollSearchTerm || payrollStatusFilter !== 'all' || payrollEmployeeFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setPayrollSearchTerm('');
                          setPayrollStatusFilter('all');
                          setPayrollEmployeeFilter('all');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 9px',
                          border: '1px solid #fed7aa',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#c2410c',
                          background: '#fff7ed',
                          cursor: 'pointer',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          fontWeight: 600,
                          transition: 'all 0.15s'
                        }}
                        title="Clear all filters"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions (Export & Bulk Operations) */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {selectionMode && selectedPayrollIds.length > 0 && (
                    <>
                      <button
                        onClick={() => handleRecalculateSelectedPayrolls()}
                        style={{
                          padding: '6px 12px', border: '1px solid #bfdbfe', background: '#eff6ff', borderRadius: '8px',
                          fontSize: '11px', fontWeight: 600, color: '#1d4ed8', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', gap: '5px', boxShadow: '0 1px 2px rgba(29,78,216,0.1)'
                        }}
                        title="Recalculate selected payroll records"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        <span>Recalculate Selected ({selectedPayrollIds.length})</span>
                      </button>
                      <button
                        onClick={handleDeleteSelectedPayrolls}
                        style={{
                          padding: '6px 12px', border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: '8px',
                          fontSize: '11px', fontWeight: 600, color: '#dc2626', cursor: 'pointer', display: 'flex',
                          alignItems: 'center', gap: '5px', boxShadow: '0 1px 2px rgba(220,38,38,0.1)'
                        }}
                        title="Delete selected payroll records"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                        <span>Delete All ({selectedPayrollIds.length})</span>
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => {
                      if (selectionMode) {
                        setSelectionMode(false);
                        setSelectedPayrollIds([]);
                      } else {
                        setSelectionMode(true);
                      }
                    }}
                    style={{
                      padding: '5px 12px',
                      border: selectionMode ? '1px solid #10b981' : '1px solid #cbd5e1',
                      background: selectionMode ? '#ecfdf5' : '#fff',
                      borderRadius: '999px',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: selectionMode ? '#047857' : '#475569',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s'
                    }}
                    title={selectionMode ? "Cancel selection mode" : "Select records for bulk actions"}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 11 12 14 22 4"></polyline>
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
                    </svg>
                    <span>{selectionMode ? 'Cancel Select' : 'Select'}</span>
                  </button>
                  <button onClick={() => setShowPaymentDateModal(true)} className="payroll-export-btn" style={{ padding: '5px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, color: '#166534', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 2px rgba(22,163,74,0.1)', transition: 'all 0.2s' }}>
                    <svg style={{ position: 'relative', zIndex: 1 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    <span style={{ position: 'relative', zIndex: 1 }}>Mark Paid</span>
                  </button>
                  <button onClick={handleExportPayrollExcel} className="payroll-export-btn" style={{ padding: '7px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg style={{ position: 'relative', zIndex: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span style={{ position: 'relative', zIndex: 1 }}>Export Excel</span>
                  </button>
                  <button onClick={handleExportPayroll} className="payroll-export-btn" style={{ padding: '7px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg style={{ position: 'relative', zIndex: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span style={{ position: 'relative', zIndex: 1 }}>Export PDF</span>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="payroll-loading">
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: 0 }}>Processing & Updating Payroll Records...</p>
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Please wait while attendance and salary calculations are being updated</span>
                </div>
              ) : payrolls.length === 0 ? (
                <div className="payroll-empty">
                  <h3>No Payroll Records Found</h3>
                  <p>Click "Calculate & Generate" to create payroll for this period</p>
                </div>
              ) : (() => {
                const filteredPayrolls = payrolls.filter((payroll) => {
                  if (payrollStatusFilter !== 'all') {
                    if ((payroll.status || '').toLowerCase() !== payrollStatusFilter.toLowerCase()) {
                      return false;
                    }
                  }
                  if (payrollEmployeeFilter !== 'all') {
                    const empId = (typeof payroll.employee === 'object' ? payroll.employee?._id : payroll.employee) || '';
                    if (empId.toString() !== payrollEmployeeFilter.toString()) {
                      return false;
                    }
                  }
                  if (payrollSearchTerm.trim()) {
                    const term = payrollSearchTerm.toLowerCase().trim();
                    const emp = payroll.employee || {};
                    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
                    const email = (emp.email || '').toLowerCase();
                    const empCode = (emp.employeeId || '').toLowerCase();
                    const designation = (emp.designation || '').toLowerCase();
                    if (!fullName.includes(term) && !email.includes(term) && !empCode.includes(term) && !designation.includes(term)) {
                      return false;
                    }
                  }
                  return true;
                });

                if (filteredPayrolls.length === 0) {
                  return (
                    <div className="payroll-empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                      <h3 style={{ fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>No Matching Payroll Records</h3>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>No records match your selected employee, status, or search filters.</p>
                      <button
                        onClick={() => {
                          setPayrollSearchTerm('');
                          setPayrollStatusFilter('all');
                          setPayrollEmployeeFilter('all');
                        }}
                        style={{
                          padding: '6px 14px',
                          background: '#3b775e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Reset Filters
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="salary-structures-table" style={{ overflowX: 'auto', background: '#fff', borderRadius: '0 0 12px 12px' }}>
                    <table className="payroll-table" style={{ width: '100%', minWidth: '1150px', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr style={{ boxShadow: '0 1px 0 #f1f5f9' }}>
                      {selectionMode && (
                        <th style={{ width: '38px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={filteredPayrolls.length > 0 && filteredPayrolls.every(p => selectedPayrollIds.includes(p._id))}
                            onChange={() => handleSelectAllPayrolls(filteredPayrolls)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
                            title="Select / Deselect All"
                          />
                        </th>
                      )}
                      <th>Sr No</th>
                      <th>Date</th>
                      <th>Employee</th>
                      <th>Attendance</th>
                      <th>Earnings</th>
                      <th>LOP</th>
                      <th>Allowance</th>
                      <th>Penalty</th>
                      <th>Basic Salary</th>
                      <th>Net Salary</th>
                      <th>Due Date</th>
                      <th>Status</th>
                      <th>Generated By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayrolls.map((payroll, index) => {
                      const presentDays = payroll.attendance?.present || 0;
                      const absentDays = payroll.workingDays?.absent || 0;
                      const totalLeaves = (payroll.leaves?.paid || 0) + (payroll.leaves?.unpaid || 0);
                      const lateCheckIns = payroll.attendance?.lateCheckIns || 0;
                      const workingDays = payroll.workingDays?.total || payroll.attendance?.workingDays || 0;
                      const paidDays = (payroll.workingDays?.present || 0) +
                        ((payroll.workingDays?.halfDay || 0) * 0.5) +
                        (payroll.workingDays?.weekoff || 0) +
                        (payroll.workingDays?.holiday || 0) +
                        (payroll.workingDays?.leave || 0);
                      const lopAmount = payroll.salaryDetails?.deductions?.lossOfPay || 0;
                      const earnedGross = payroll.salaryDetails?.grossSalary || 0;

                      const deductions = payroll.salaryDetails?.deductions || {};
                      const allowances = payroll.salaryDetails?.allowances || {};

                      const totalAllowances = (allowances.hra || 0) + (allowances.da || 0) + (allowances.transport || 0) + (allowances.medical || 0) + (allowances.other || 0) + (payroll.salaryDetails?.bonus || 0);
                      const manualPenalty = payroll.salaryDetails?.deductions?.penalty || 0;
                      const latePenalty = payroll.salaryDetails?.deductions?.lateDeduction || 0;
                      const halfDayPenalty = payroll.salaryDetails?.deductions?.halfDayDeduction || 0;
                      const totalPenalties = manualPenalty + latePenalty + halfDayPenalty;
                      const basicSalary = payroll.salaryDetails?.basicSalary || 0;
                      const netSalary = payroll.salaryDetails?.netSalary || 0;

                      const processedBy = payroll.processedBy && typeof payroll.processedBy === 'object'
                        ? `${payroll.processedBy.firstName || ''} ${payroll.processedBy.lastName || ''}`.trim()
                        : typeof payroll.processedBy === 'string' && payroll.processedBy
                          ? payroll.processedBy
                          : 'Admin System';

                      const openUpward = index >= filteredPayrolls.length - 2 || filteredPayrolls.length <= 3;

                      return (
                        <tr key={payroll._id} style={{ borderBottom: '1px solid #f1f5f9', background: selectedPayrollIds.includes(payroll._id) ? '#f0fdf4' : 'transparent', position: activePayrollMenu === payroll._id ? 'relative' : 'static', zIndex: activePayrollMenu === payroll._id ? 50 : 1 }}>
                          {selectionMode && (
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selectedPayrollIds.includes(payroll._id)}
                                onChange={() => handleToggleSelectPayroll(payroll._id)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#10b981' }}
                              />
                            </td>
                          )}
                          <td><span style={{ color: '#94a3b8', fontSize: '10px', fontWeight: 600 }}>{index + 1}</span></td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 500, color: '#475569', whiteSpace: 'nowrap' }}>
                              {payroll.createdAt ? (() => {
                                const d = new Date(payroll.createdAt);
                                return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                              })() : '-'}
                            </span>
                          </td>
                          <td>
                            <span
                              onClick={() => handleEmployeeClick(payroll.employee?._id)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2px 8px',
                                background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)',
                                color: '#0369a1',
                                borderRadius: '999px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                border: '1px solid #bae6fd',
                                boxShadow: '0 1px 3px rgba(3,105,161,0.08)',
                                transition: 'all 0.2s',
                                whiteSpace: 'nowrap',
                                letterSpacing: '0.01em'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 3px 6px rgba(3,105,161,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(3,105,161,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                            >
                              {payroll.employee?.firstName} {payroll.employee?.lastName}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => handleViewStructure(payroll)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '999px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: '#f0fdf4',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.transform = 'translateY(0)'; }}
                              title={`P:${presentDays} A:${absentDays} L:${totalLeaves} H:${lateCheckIns}`}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                              </svg>
                              View
                            </button>
                          </td>
                          <td><span style={{ color: '#0f172a', fontWeight: 700, fontSize: '11px' }}>{formatCurrency(earnedGross)}</span></td>
                          <td><span style={{ color: lopAmount > 0 ? '#ef4444' : '#94a3b8', fontWeight: 700, fontSize: '11px' }}>{lopAmount > 0 ? formatCurrency(lopAmount) : '—'}</span></td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: totalAllowances > 0 ? '#10b981' : '#94a3b8' }}>
                              {totalAllowances > 0 ? formatCurrency(totalAllowances) : '—'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: totalPenalties > 0 ? '#ef4444' : '#94a3b8' }}>
                              {totalPenalties > 0 ? formatCurrency(totalPenalties) : '—'}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(basicSalary)}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: netSalary >= 0 ? '#059669' : '#ef4444' }}>{formatCurrency(netSalary)}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '11px', color: paymentDueDate ? '#0f172a' : '#94a3b8', fontWeight: paymentDueDate ? 600 : 400 }}>
                              {paymentDueDate ? new Date(paymentDueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </span>
                          </td>
                          <td>
                            {(() => {
                              const s = payroll.status;
                              const cfg = s === 'paid'
                                ? { bg: '#d1fae5', color: '#047857', dot: '#059669', label: 'Paid' }
                                : s === 'processed'
                                  ? { bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6', label: 'Processed' }
                                  : { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b', label: 'Draft' };
                              return (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: cfg.bg, color: cfg.color }}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.dot, flexShrink: 0, display: 'inline-block' }} />
                                  {cfg.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 9px', borderRadius: '999px', background: 'linear-gradient(135deg, #f3e8ff 0%, #faf5ff 100%)', border: '1px solid #e9d5ff', fontSize: '10px', fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap' }}>
                              {processedBy || 'Admin'}
                            </span>
                          </td>
                          <td style={{ position: 'relative', zIndex: activePayrollMenu === payroll._id ? 60 : 1, paddingRight: '12px' }}>
                            <div className="action-buttons" style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                              {/* View */}
                              <button
                                onClick={() => handleViewStructure(payroll)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', width: '24px', height: '24px', borderRadius: '6px' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                title="View Details"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                              </button>

                              {/* Download */}
                              <button
                                onClick={() => handleDownloadPayslip(payroll)}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', width: '24px', height: '24px', borderRadius: '6px' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f3e8ff'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                title="Payslip PDF"
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                              </button>

                              {/* 3 Dots Menu */}
                              <div className="action-menu-container" style={{ position: 'relative' }}>
                                <button
                                  onClick={(e) => handleOpenMenu(e, payroll._id)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', width: '24px', height: '24px', borderRadius: '6px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  title="More Actions"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="5" r="1"></circle>
                                    <circle cx="12" cy="12" r="1"></circle>
                                    <circle cx="12" cy="19" r="1"></circle>
                                  </svg>
                                </button>

                                {activePayrollMenu === payroll._id && (
                                  <div
                                    style={{
                                      position: 'fixed',
                                      top: `${menuPos.top}px`,
                                      right: `${menuPos.right}px`,
                                      background: '#ffffff',
                                      borderRadius: '10px',
                                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                                      border: '1px solid #cbd5e1',
                                      zIndex: 99999,
                                      width: '135px',
                                      overflow: 'hidden',
                                      padding: '4px 0'
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {payroll.status !== 'paid' && (
                                      <button
                                        onClick={() => {
                                          setActivePayrollMenu(null);
                                          handleMarkAsPaid(payroll._id);
                                        }}
                                        style={{
                                          width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left',
                                          fontSize: '12px', fontWeight: 600, color: '#166534', cursor: 'pointer', transition: 'background 0.15s',
                                          display: 'flex', alignItems: 'center', gap: '8px'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                        Mark Paid
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        setActivePayrollMenu(null);
                                        handleEditPayrollClick(payroll);
                                      }}
                                      style={{
                                        width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left',
                                        fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer', transition: 'background 0.15s',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActivePayrollMenu(null);
                                        handleRecalculateSelectedPayrolls([payroll._id]);
                                      }}
                                      style={{
                                        width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left',
                                        fontSize: '12px', fontWeight: 600, color: '#2563eb', cursor: 'pointer', transition: 'background 0.15s',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                                      Recalculate
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActivePayrollMenu(null);
                                        handleDeletePayroll(payroll._id);
                                      }}
                                      style={{
                                        width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', textAlign: 'left',
                                        fontSize: '12px', fontWeight: 600, color: '#ef4444', cursor: 'pointer', transition: 'background 0.15s',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {activeTab === 'salary' && (
          <div className="salary-structures-container">


            {/* Employee Salary Structures */}
            <div className="payroll-records" style={{ marginTop: '20px', overflow: 'visible' }}>
              <div className="payroll-records-header">
                <h2>Employee Salary Structures</h2>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={handleAddNewStructure} style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", display: 'flex', alignItems: 'center', gap: '5px', transition: 'opacity 0.15s, transform 0.15s' }} onMouseEnter={e => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>Add New Structure</span>
                  </button>
                </div>
              </div>

              <div className="payroll-records-header" style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: '#fafafa', borderRadius: '0 0 0 0', position: 'relative', zIndex: structEmpDdOpen ? 1000 : 20, justifyContent: 'space-between', flexDirection: 'row' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', flex: 1 }}>
                  {/* Search */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', minWidth: '220px', maxWidth: '320px', transition: 'all 0.2s' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3b775e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input
                      type="text"
                      placeholder="Search by name, email..."
                      value={structSearchTerm}
                      onChange={e => setStructSearchTerm(e.target.value)}
                      style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#0f172a', background: 'transparent', width: '100%', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500 }}
                    />
                  </div>

                  {/* Filter Dropdowns */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {/* Employees Dropdown Popover */}
                    <div className="struct-emp-dd-container" style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStructEmpDdOpen(prev => !prev);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 11px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: structEmployeeFilter !== 'all' ? '#15803d' : '#475569',
                          background: structEmployeeFilter !== 'all' ? '#dcfce7' : '#fff',
                          cursor: 'pointer',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          fontWeight: 500,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => {
                          if (structEmployeeFilter === 'all') e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={e => {
                          if (structEmployeeFilter === 'all') e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <span>
                          {structEmployeeFilter === 'all'
                            ? 'All Employees'
                            : (() => {
                                const found = allEmployees.find(emp => emp._id === structEmployeeFilter);
                                return found ? `${found.firstName} ${found.lastName}` : 'All Employees';
                              })()}
                        </span>
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={structEmployeeFilter !== 'all' ? '#15803d' : '#64748b'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: structEmpDdOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {structEmpDdOpen && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            background: '#ffffff',
                            borderRadius: '16px',
                            boxShadow: '0 10px 35px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                            zIndex: 300,
                            width: '640px',
                            maxWidth: '90vw',
                            padding: '12px',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Search Bar */}
                          <div style={{ padding: '2px 4px', marginBottom: '8px' }}>
                            <input
                              type="text"
                              placeholder="Search employees..."
                              value={structFilterEmpSearch}
                              onChange={(e) => setStructFilterEmpSearch(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px',
                                outline: 'none',
                                fontFamily: "'Inter','Poppins','Segoe UI',sans-serif"
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          </div>

                          {/* All Employees option */}
                          <div
                            onClick={() => {
                              setStructEmployeeFilter('all');
                              setStructEmpDdOpen(false);
                              setStructFilterEmpSearch('');
                            }}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: structEmployeeFilter === 'all' ? '600' : '500',
                              cursor: 'pointer',
                              color: structEmployeeFilter === 'all' ? '#15803d' : '#1e293b',
                              background: structEmployeeFilter === 'all' ? '#dcfce7' : 'transparent',
                              marginBottom: '6px',
                              fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => {
                              if (structEmployeeFilter !== 'all') e.currentTarget.style.background = '#f8fafc';
                            }}
                            onMouseLeave={e => {
                              if (structEmployeeFilter !== 'all') e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            All Employees
                          </div>

                          {/* Grid of employees */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: '4px',
                              maxHeight: '280px',
                              overflowY: 'auto',
                              paddingRight: '4px'
                            }}
                          >
                            {allEmployees
                              .filter(emp => emp.isActive !== false)
                              .filter(emp => {
                                const q = structFilterEmpSearch.toLowerCase().trim();
                                if (!q) return true;
                                const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
                                const code = (emp.employeeId || '').toLowerCase();
                                const desig = (emp.designation || '').toLowerCase();
                                return name.includes(q) || code.includes(q) || desig.includes(q);
                              })
                              .slice()
                              .sort((a, b) => `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`))
                              .map(emp => {
                                const isSelected = structEmployeeFilter === emp._id;
                                return (
                                  <div
                                    key={emp._id}
                                    onClick={() => {
                                      setStructEmployeeFilter(emp._id);
                                      setStructEmpDdOpen(false);
                                    }}
                                    style={{
                                      padding: '6px 8px',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      color: isSelected ? '#15803d' : '#1e293b',
                                      background: isSelected ? '#dcfce7' : 'transparent',
                                      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                                      transition: 'background 0.15s',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '2px',
                                      border: isSelected ? '1px solid #86efac' : '1px solid transparent'
                                    }}
                                    onMouseEnter={e => {
                                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                    }}
                                    onMouseLeave={e => {
                                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    }}
                                    title={`${emp.firstName} ${emp.lastName}${emp.employeeId ? ` (${emp.employeeId})` : ''}${emp.designation ? ` - ${emp.designation}` : ''}`}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                      <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                      {emp.employeeId && (
                                        <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px', flexShrink: 0 }}>
                                          {emp.employeeId}
                                        </span>
                                      )}
                                    </div>
                                    {emp.designation && (
                                      <span style={{ fontSize: '9.5px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {emp.designation}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    {(structSearchTerm || structEmployeeFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setStructSearchTerm('');
                          setStructEmployeeFilter('all');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 9px',
                          border: '1px solid #fed7aa',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#c2410c',
                          background: '#fff7ed',
                          cursor: 'pointer',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          fontWeight: 600,
                          transition: 'all 0.15s'
                        }}
                        title="Clear filters"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions (Export) */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={handleExportStructuresExcel} className="payroll-export-btn" style={{ padding: '7px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg style={{ position: 'relative', zIndex: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span style={{ position: 'relative', zIndex: 1 }}>Export Excel</span>
                  </button>
                  <button onClick={handleExportStructures} className="payroll-export-btn" style={{ padding: '7px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg style={{ position: 'relative', zIndex: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span style={{ position: 'relative', zIndex: 1 }}>Export PDF</span>
                  </button>
                </div>
              </div>

              <div className="salary-structures-table">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Sr No</th>
                      <th>Employee ID</th>
                      <th>Employee Name</th>
                      <th>Designation</th>
                      <th>Department</th>
                      <th>Basic Salary</th>
                      <th>Allowance</th>
                      <th>Allowance Type</th>
                      <th>Created On</th>
                      <th>Created By</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures.filter(s => {
                      if (structEmployeeFilter !== 'all') {
                        const empId = (typeof s.employee === 'object' ? s.employee?._id : s.employee) || '';
                        if (empId.toString() !== structEmployeeFilter.toString()) {
                          return false;
                        }
                      }
                      if (!structSearchTerm) return true;
                      const q = structSearchTerm.toLowerCase();
                      const n = `${s.employee?.firstName || ''} ${s.employee?.lastName || ''} ${s.employee?.employeeId || ''} ${s.employee?.email || ''} ${s.employee?.designation || ''}`.toLowerCase();
                      return n.includes(q);
                    }).length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ textAlign: 'center', padding: '40px' }}>
                          No salary structures found.
                        </td>
                      </tr>
                    ) : (
                      structures.filter(s => {
                        if (structEmployeeFilter !== 'all') {
                          const empId = (typeof s.employee === 'object' ? s.employee?._id : s.employee) || '';
                          if (empId.toString() !== structEmployeeFilter.toString()) {
                            return false;
                          }
                        }
                        if (!structSearchTerm) return true;
                        const q = structSearchTerm.toLowerCase();
                        const n = `${s.employee?.firstName || ''} ${s.employee?.lastName || ''} ${s.employee?.employeeId || ''} ${s.employee?.email || ''} ${s.employee?.designation || ''}`.toLowerCase();
                        return n.includes(q);
                      }).map((structure, index) => {
                        const totalAllowances = (parseFloat(structure.hra) || 0) + (parseFloat(structure.da) || 0) + (parseFloat(structure.transport) || 0) + (parseFloat(structure.medical) || 0) + (parseFloat(structure.bonus) || 0);
                        const totalPenalties = parseFloat(structure.penaltyDeduction) || 0;

                        return (
                          <tr key={structure._id}>
                            <td>
                              <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>{index + 1}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#475569' }}>{structure.employee?.employeeId}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{structure.employee?.firstName} {structure.employee?.lastName}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#475569' }}>{structure.employee?.designation || '-'}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#475569' }}>
                                {typeof structure.employee?.department === 'object' ? structure.employee?.department?.name : (structure.employee?.department || '-')}
                              </span>
                            </td>
                            <td><span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>{formatCurrency(structure.basicSalary)}</span></td>
                            <td><span style={{ fontSize: '13px', fontWeight: 600, color: '#16a34a' }}>{formatCurrency(totalAllowances)}</span></td>
                            <td>
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '180px' }}>
                                {(parseFloat(structure.hra) > 0) && <span style={{ padding: '2px 6px', background: '#eff6ff', color: '#3b82f6', borderRadius: '12px', fontSize: '10.5px', fontWeight: 600, border: '1px solid #bfdbfe' }}>HRA</span>}
                                {(parseFloat(structure.da) > 0) && <span style={{ padding: '2px 6px', background: '#ecfdf5', color: '#10b981', borderRadius: '12px', fontSize: '10.5px', fontWeight: 600, border: '1px solid #a7f3d0' }}>DA</span>}
                                {(parseFloat(structure.transport) > 0) && <span style={{ padding: '2px 6px', background: '#fffbeb', color: '#f59e0b', borderRadius: '12px', fontSize: '10.5px', fontWeight: 600, border: '1px solid #fde68a' }}>Transport</span>}
                                {(parseFloat(structure.medical) > 0) && <span style={{ padding: '2px 6px', background: '#fef2f2', color: '#ef4444', borderRadius: '12px', fontSize: '10.5px', fontWeight: 600, border: '1px solid #fecaca' }}>Medical</span>}
                                {(parseFloat(structure.bonus) > 0) && <span style={{ padding: '2px 6px', background: '#f5f3ff', color: '#8b5cf6', borderRadius: '12px', fontSize: '10.5px', fontWeight: 600, border: '1px solid #ddd6fe' }}>Bonus</span>}
                                {totalAllowances === 0 && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Not Provided</span>}
                              </div>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#475569' }}>
                                {structure.createdAt ? (() => {
                                  const d = new Date(structure.createdAt);
                                  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                                })() : '-'}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12.5px', color: '#475569' }}>
                                {structure.createdBy && typeof structure.createdBy === 'object'
                                  ? `${structure.createdBy.firstName || ''} ${structure.createdBy.lastName || ''}`.trim() || '-'
                                  : '-'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => handleViewStructureOnly(structure)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', width: '24px', height: '24px', borderRadius: '6px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  title="View"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                </button>
                                <button
                                  onClick={() => handleEditStructure(structure)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', width: '24px', height: '24px', borderRadius: '6px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  title="Edit"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteStructure(structure._id)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', width: '24px', height: '24px', borderRadius: '6px' }}
                                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  title="Delete"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}


        {/* Salary Slip Tab */}
        {activeTab === 'payslips' && (
          <>
            {/* Stats Section — Matching Monthly Payroll */}
            {(() => {
              const PaySparkline = ({ data, color }) => {
                const w = 80, h = 32;
                const max = Math.max(...data, 1);
                const min = Math.min(...data);
                const range = max - min || 1;
                const pts = data.map((v, i) => {
                  const x = (i / (data.length - 1)) * w;
                  const y = h - 4 - ((v - min) / range) * (h - 10);
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' ');
                const fillPts = `0,${h} ${pts} ${w},${h}`;
                const gradId = `slg-slip-${color.replace('#', '')}`;
                return (
                  <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points={fillPts} fill={`url(#${gradId})`} />
                    <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    {data.map((v, i) => {
                      const x = (i / (data.length - 1)) * w;
                      const y = h - 4 - ((v - min) / range) * (h - 10);
                      return i === data.length - 1 ? <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} /> : null;
                    })}
                  </svg>
                );
              };

              const totalSlips = paidPayslips.length;
              const totalGross = paidPayslips.reduce((sum, p) => sum + (p.salaryDetails?.grossSalary || 0), 0);
              const totalDed = paidPayslips.reduce((sum, p) => sum + (p.salaryDetails?.totalDeductions || 0), 0);
              const totalNet = paidPayslips.reduce((sum, p) => sum + (p.salaryDetails?.netSalary || 0), 0);

              const cards = [
                {
                  label: 'Salary Slips',
                  value: totalSlips,
                  display: totalSlips,
                  sublabel: 'slips available',
                  color: '#3b82f6',
                  spark: [0, 0, 0, 0, 0, totalSlips]
                },
                {
                  label: 'Total Gross Amount',
                  value: totalGross,
                  display: formatCurrency(totalGross),
                  sublabel: 'gross salary',
                  color: '#22c55e',
                  spark: [0, 0, 0, 0, 0, totalGross]
                },
                {
                  label: 'Total Deductions',
                  value: totalDed,
                  display: formatCurrency(totalDed),
                  sublabel: 'penalties & deductions',
                  color: '#ef4444',
                  spark: [0, 0, 0, 0, 0, totalDed]
                },
                {
                  label: 'Total Net Disbursement',
                  value: totalNet,
                  display: formatCurrency(totalNet),
                  sublabel: 'in-hand paid',
                  color: '#8b5cf6',
                  spark: [0, 0, 0, 0, 0, totalNet]
                }
              ];

              return (
                <div className="pay-ist-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
                  {cards.map(({ label, display, sublabel, color, spark }) => (
                    <div
                      key={label}
                      style={{ background: 'white', padding: '14px 16px 10px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'default', transition: 'all 0.3s', overflow: 'hidden', position: 'relative' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
                        <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: 'rgba(168,230,61,0.15)', color: '#3d7c00', whiteSpace: 'nowrap' }}>
                          ▲ +100%
                        </span>
                      </div>
                      <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px' }}>{display}</div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: color, lineHeight: 1.2 }}>+{sublabel}</span>
                          <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>In this month</span>
                        </div>
                        <PaySparkline data={spark} color={color} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Salary Slips Table Container */}
            <div className="payroll-records" style={{ overflow: 'visible' }}>
              <div className="payroll-records-header" style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: '#fafafa', borderRadius: '14px 14px 0 0', position: 'relative', zIndex: (payslipEmpDdOpen || payslipStatusDdOpen) ? 1000 : 20, justifyContent: 'space-between', flexDirection: 'row' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', flex: 1 }}>
                  {/* Search */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '7px 12px', minWidth: '220px', maxWidth: '300px', transition: 'all 0.2s' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#3b775e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.08)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                    <input
                      type="text"
                      placeholder="Search by name, email..."
                      value={payslipSearchTerm}
                      onChange={e => setPayslipSearchTerm(e.target.value)}
                      style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#0f172a', background: 'transparent', width: '100%', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500 }}
                    />
                    {payslipSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setPayslipSearchTerm('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#94a3b8' }}
                        title="Clear search"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    )}
                  </div>

                  {/* Filter Dropdowns */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {/* Status Dropdown Popover */}
                    <div className="payslip-status-dd-container" style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayslipStatusDdOpen(prev => !prev);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 11px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: payslipStatusFilter !== 'all' ? '#15803d' : '#475569',
                          background: payslipStatusFilter !== 'all' ? '#dcfce7' : '#fff',
                          cursor: 'pointer',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          fontWeight: 500,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => {
                          if (payslipStatusFilter === 'all') e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={e => {
                          if (payslipStatusFilter === 'all') e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <span>
                          {payslipStatusFilter === 'all'
                            ? 'All Statuses'
                            : payslipStatusFilter === 'draft'
                              ? 'Draft'
                              : payslipStatusFilter === 'processed'
                                ? 'Processed'
                                : payslipStatusFilter === 'paid'
                                  ? 'Paid'
                                  : payslipStatusFilter}
                        </span>
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={payslipStatusFilter !== 'all' ? '#15803d' : '#64748b'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: payslipStatusDdOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {payslipStatusDdOpen && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            background: '#ffffff',
                            borderRadius: '14px',
                            boxShadow: '0 10px 35px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                            zIndex: 300,
                            width: '180px',
                            padding: '6px',
                            overflow: 'hidden'
                          }}
                        >
                          {[
                            { value: 'all', label: 'All Statuses', dot: null },
                            { value: 'paid', label: 'Paid', dot: '#16a34a' },
                            { value: 'draft', label: 'Draft', dot: '#f59e0b' },
                            { value: 'processed', label: 'Processed', dot: '#3b82f6' }
                          ].map(opt => {
                            const isSelected = payslipStatusFilter === opt.value;
                            return (
                              <div
                                key={opt.value}
                                onClick={() => {
                                  setPayslipStatusFilter(opt.value);
                                  setPayslipStatusDdOpen(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '7px 10px',
                                  borderRadius: '8px',
                                  fontSize: '11.5px',
                                  fontWeight: isSelected ? 600 : 500,
                                  cursor: 'pointer',
                                  color: isSelected ? '#15803d' : '#1e293b',
                                  background: isSelected ? '#dcfce7' : 'transparent',
                                  marginBottom: '2px',
                                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                                  transition: 'background 0.15s'
                                }}
                                onMouseEnter={e => {
                                  if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                }}
                                onMouseLeave={e => {
                                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                {opt.dot ? (
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: opt.dot, flexShrink: 0, display: 'inline-block' }} />
                                ) : (
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', border: '1.5px solid #94a3b8', flexShrink: 0, display: 'inline-block' }} />
                                )}
                                <span>{opt.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Employee Dropdown Popover */}
                    <div className="payslip-emp-dd-container" style={{ position: 'relative', display: 'inline-block' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayslipEmpDdOpen(prev => !prev);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 11px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: payslipEmployeeFilter !== 'all' ? '#15803d' : '#475569',
                          background: payslipEmployeeFilter !== 'all' ? '#dcfce7' : '#fff',
                          cursor: 'pointer',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          fontWeight: 500,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={e => {
                          if (payslipEmployeeFilter === 'all') e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={e => {
                          if (payslipEmployeeFilter === 'all') e.currentTarget.style.background = '#fff';
                        }}
                      >
                        <span>
                          {payslipEmployeeFilter === 'all'
                            ? 'All Employees'
                            : (() => {
                                const found = allEmployees.find(emp => emp._id === payslipEmployeeFilter);
                                return found ? `${found.firstName} ${found.lastName}` : 'All Employees';
                              })()}
                        </span>
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={payslipEmployeeFilter !== 'all' ? '#15803d' : '#64748b'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ transform: payslipEmpDdOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {payslipEmpDdOpen && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            background: '#ffffff',
                            borderRadius: '16px',
                            boxShadow: '0 10px 35px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05)',
                            zIndex: 300,
                            width: '640px',
                            maxWidth: '90vw',
                            padding: '12px',
                            overflow: 'hidden'
                          }}
                        >
                          {/* Search Bar */}
                          <div style={{ padding: '2px 4px', marginBottom: '8px' }}>
                            <input
                              type="text"
                              placeholder="Search employees..."
                              value={payslipFilterEmpSearch}
                              onChange={(e) => setPayslipFilterEmpSearch(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px',
                                outline: 'none',
                                fontFamily: "'Inter','Poppins','Segoe UI',sans-serif"
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                            />
                          </div>

                          {/* All Employees option */}
                          <div
                            onClick={() => {
                              setPayslipEmployeeFilter('all');
                              setPayslipEmpDdOpen(false);
                              setPayslipFilterEmpSearch('');
                            }}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: payslipEmployeeFilter === 'all' ? '600' : '500',
                              cursor: 'pointer',
                              color: payslipEmployeeFilter === 'all' ? '#15803d' : '#1e293b',
                              background: payslipEmployeeFilter === 'all' ? '#dcfce7' : 'transparent',
                              marginBottom: '6px',
                              fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={e => {
                              if (payslipEmployeeFilter !== 'all') e.currentTarget.style.background = '#f8fafc';
                            }}
                            onMouseLeave={e => {
                              if (payslipEmployeeFilter !== 'all') e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            All Employees
                          </div>

                          {/* Grid of employees */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: '4px',
                              maxHeight: '280px',
                              overflowY: 'auto',
                              paddingRight: '4px'
                            }}
                          >
                            {allEmployees
                              .filter(emp => emp.isActive !== false)
                              .filter(emp => {
                                const q = payslipFilterEmpSearch.toLowerCase().trim();
                                if (!q) return true;
                                const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
                                const code = (emp.employeeId || '').toLowerCase();
                                const desig = (emp.designation || '').toLowerCase();
                                return name.includes(q) || code.includes(q) || desig.includes(q);
                              })
                              .slice()
                              .sort((a, b) => `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`))
                              .map(emp => {
                                const isSelected = payslipEmployeeFilter === emp._id;
                                return (
                                  <div
                                    key={emp._id}
                                    onClick={() => {
                                      setPayslipEmployeeFilter(emp._id);
                                      setPayslipEmpDdOpen(false);
                                    }}
                                    style={{
                                      padding: '6px 8px',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      color: isSelected ? '#15803d' : '#1e293b',
                                      background: isSelected ? '#dcfce7' : 'transparent',
                                      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                                      transition: 'background 0.15s',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '2px',
                                      border: isSelected ? '1px solid #86efac' : '1px solid transparent'
                                    }}
                                    onMouseEnter={e => {
                                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                                    }}
                                    onMouseLeave={e => {
                                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    }}
                                    title={`${emp.firstName} ${emp.lastName}${emp.employeeId ? ` (${emp.employeeId})` : ''}${emp.designation ? ` - ${emp.designation}` : ''}`}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                      <span style={{ fontWeight: isSelected ? 600 : 500, fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {emp.firstName} {emp.lastName}
                                      </span>
                                      {emp.employeeId && (
                                        <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px', flexShrink: 0 }}>
                                          {emp.employeeId}
                                        </span>
                                      )}
                                    </div>
                                    {emp.designation && (
                                      <span style={{ fontSize: '9.5px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {emp.designation}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Reset button if any filter is active */}
                    {(payslipSearchTerm || payslipStatusFilter !== 'all' || payslipEmployeeFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setPayslipSearchTerm('');
                          setPayslipStatusFilter('all');
                          setPayslipEmployeeFilter('all');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '5px 9px',
                          border: '1px solid #fed7aa',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#c2410c',
                          background: '#fff7ed',
                          cursor: 'pointer',
                          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                          fontWeight: 600,
                          transition: 'all 0.15s'
                        }}
                        title="Clear filters"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions (Export) */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={handleExportSalarySlipsExcel} className="payroll-export-btn" style={{ padding: '7px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg style={{ position: 'relative', zIndex: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span style={{ position: 'relative', zIndex: 1 }}>Export Excel</span>
                  </button>
                  <button onClick={handleExportSalarySlipsPDF} className="payroll-export-btn" style={{ padding: '7px 12px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg style={{ position: 'relative', zIndex: 1 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    <span style={{ position: 'relative', zIndex: 1 }}>Export PDF</span>
                  </button>
                </div>
              </div>

              {paidPayslips.length === 0 ? (
                <div className="payroll-empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>No Salary Slips Found</h3>
                  <p style={{ fontSize: '12px', color: '#64748b' }}>No salary slips generated for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}.</p>
                </div>
              ) : (() => {
                const filteredSlips = paidPayslips.filter(s => {
                  if (payslipStatusFilter !== 'all') {
                    if ((s.status || '').toLowerCase() !== payslipStatusFilter.toLowerCase()) return false;
                  }
                  if (payslipEmployeeFilter !== 'all') {
                    const empId = (typeof s.employee === 'object' ? s.employee?._id : s.employee) || '';
                    if (empId.toString() !== payslipEmployeeFilter.toString()) return false;
                  }
                  if (payslipSearchTerm.trim()) {
                    const term = payslipSearchTerm.toLowerCase().trim();
                    const emp = s.employee || {};
                    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
                    const email = (emp.email || '').toLowerCase();
                    const empCode = (emp.employeeId || '').toLowerCase();
                    const desig = (emp.designation || '').toLowerCase();
                    if (!fullName.includes(term) && !email.includes(term) && !empCode.includes(term) && !desig.includes(term)) return false;
                  }
                  return true;
                });

                if (filteredSlips.length === 0) {
                  return (
                    <div className="payroll-empty" style={{ padding: '36px 16px', textAlign: 'center' }}>
                      <h3 style={{ fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>No Matching Salary Slips</h3>
                      <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>No records match your selected employee, status, or search filters.</p>
                      <button
                        onClick={() => {
                          setPayslipSearchTerm('');
                          setPayslipStatusFilter('all');
                          setPayslipEmployeeFilter('all');
                        }}
                        style={{
                          padding: '6px 14px',
                          background: '#3b775e',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Reset Filters
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="salary-structures-table" style={{ overflowX: 'auto', background: '#fff', borderRadius: '0 0 12px 12px' }}>
                    <table className="payroll-table" style={{ width: '100%', minWidth: '1150px', borderCollapse: 'collapse' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr>
                          <th style={{ width: '50px', textAlign: 'center' }}>Sr No</th>
                          <th>Date</th>
                          <th>Employee</th>
                          <th>Attendance</th>
                          <th>Basic Salary</th>
                          <th>Bonus / Allow</th>
                          <th>Deductions</th>
                          <th>Net Salary</th>
                          <th>Payment Date</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSlips.map((payslip, index) => {
                          const emp = payslip.employee || {};
                          const basic = payslip.salaryDetails?.basicSalary || 0;
                          const gross = payslip.salaryDetails?.grossSalary || 0;
                          const bonus = payslip.salaryDetails?.bonus || 0;
                          const allow = Math.max(0, gross - basic);
                          const totalDed = payslip.salaryDetails?.totalDeductions || 0;
                          const netSalary = payslip.salaryDetails?.netSalary || 0;

                          return (
                            <tr key={payslip._id || index}>
                              <td>
                                <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600 }}>
                                  {index + 1}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '11.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                                  {payslip.createdAt ? (() => {
                                    const d = new Date(payslip.createdAt);
                                    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                                  })() : '-'}
                                </span>
                              </td>
                              <td>
                                <span
                                  onClick={() => handleEmployeeClick(payslip.employee?._id)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '3px 10px',
                                    background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 100%)',
                                    color: '#0369a1',
                                    borderRadius: '999px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: '1px solid #bae6fd',
                                    boxShadow: '0 1px 3px rgba(3,105,161,0.08)',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 3px 6px rgba(3,105,161,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(3,105,161,0.08)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                  <span>{emp.firstName} {emp.lastName}</span>
                                  {emp.employeeId && (
                                    <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#0284c7', background: '#ffffff', padding: '1px 6px', borderRadius: '999px', marginLeft: '2px', border: '1px solid #bae6fd' }}>
                                      {emp.employeeId}
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td>
                                <button
                                  onClick={() => handleViewStructure(payslip)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    background: '#f0fdf4',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                  title="View Attendance Details"
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                                  </svg>
                                  View
                                </button>
                              </td>
                              <td>
                                <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '11.5px' }}>
                                  {formatCurrency(basic)}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '11.5px', fontWeight: 600, color: (allow + bonus) > 0 ? '#10b981' : '#94a3b8' }}>
                                  {(allow + bonus) > 0 ? formatCurrency(allow + bonus) : '—'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '11.5px', fontWeight: 600, color: totalDed > 0 ? '#ef4444' : '#94a3b8' }}>
                                  {totalDed > 0 ? `-${formatCurrency(totalDed)}` : '—'}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534' }}>
                                  {formatCurrency(netSalary)}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: '11.5px', color: '#475569', whiteSpace: 'nowrap' }}>
                                  {payslip.paidAt ? (() => {
                                    const d = new Date(payslip.paidAt);
                                    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                                  })() : (payslip.paymentDueDate ? (() => {
                                    const d = new Date(payslip.paymentDueDate);
                                    return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                                  })() : '-')}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 10px',
                                    borderRadius: '999px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    background: (payslip.status === 'paid') ? '#dcfce7' : (payslip.status === 'processed') ? '#dbeafe' : '#fef3c7',
                                    color: (payslip.status === 'paid') ? '#15803d' : (payslip.status === 'processed') ? '#1d4ed8' : '#b45309',
                                    border: (payslip.status === 'paid') ? '1px solid #bbf7d0' : (payslip.status === 'processed') ? '1px solid #bfdbfe' : '1px solid #fde68a'
                                  }}
                                >
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: (payslip.status === 'paid') ? '#16a34a' : (payslip.status === 'processed') ? '#2563eb' : '#d97706' }} />
                                  {(payslip.status || 'Paid').charAt(0).toUpperCase() + (payslip.status || 'Paid').slice(1)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                  {/* Download PDF SVG icon */}
                                  <button
                                    onClick={() => handleDownloadPayslip(payslip)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      transition: 'all 0.15s',
                                      color: '#16a34a'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.color = '#15803d'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#16a34a'; }}
                                    title="Download PDF Salary Slip"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                  </button>

                                  {/* Delete SVG icon */}
                                  <button
                                    onClick={() => handleDeletePayslip(payslip._id)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '28px',
                                      height: '28px',
                                      borderRadius: '6px',
                                      transition: 'all 0.15s',
                                      color: '#ef4444'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444'; }}
                                    title="Delete Salary Slip"
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"></polyline>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
                                      <line x1="10" y1="11" x2="10" y2="17"></line>
                                      <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* Accounting / Finance Tab */}
        {activeTab === 'accounting' && (
          <div className="salary-structures-container">
            {/* Month/Year Filter */}
            <div className="payroll-filters" style={{ marginBottom: '16px' }}>
              <div className="filter-group">
                <label>Month:</label>
                <select className="filter-select" value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label>Year:</label>
                <select className="filter-select" value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button className="calculate-btn" onClick={fetchAccountingData} style={{ margin: 0 }}>
                Refresh Journal
              </button>
            </div>

            {loadingAccounting ? (
              <div className="payroll-loading"><p>Loading accounting data...</p></div>
            ) : accountingData ? (
              <>
                {/* Summary Stats */}
                <div className="payroll-stats" style={{ marginBottom: '20px' }}>
                  <div className="stat-card-payroll blue">
                    <h3>{accountingData.summary?.totalEmployees || 0}</h3>
                    <p className="stat-label">Total Employees</p>
                  </div>
                  <div className="stat-card-payroll green">
                    <h3>{formatCurrency((accountingData.summary?.grossSalary || 0) + (accountingData.summary?.bonus || 0))}</h3>
                    <p className="stat-label">Total Salary Expense</p>
                    <p className="stat-sublabel">(Gross + Bonus)</p>
                  </div>
                  <div className="stat-card-payroll red">
                    <h3>{formatCurrency((accountingData.summary?.pf || 0) + (accountingData.summary?.esi || 0) + (accountingData.summary?.tax || 0))}</h3>
                    <p className="stat-label">Statutory Deductions</p>
                    <p className="stat-sublabel">(PF + ESI + TDS)</p>
                  </div>
                  <div className="stat-card-payroll purple">
                    <h3>{formatCurrency(accountingData.summary?.netSalary || 0)}</h3>
                    <p className="stat-label">Net Disbursement</p>
                    <p className="stat-sublabel">{accountingData.summary?.paid} of {accountingData.summary?.totalEmployees} Paid</p>
                  </div>
                </div>

                {/* Deductions Breakdown */}
                <div className="payroll-records" style={{ marginBottom: '20px' }}>
                  <div className="payroll-records-header">
                    <h2>Deductions Summary - {accountingData.monthName} {accountingData.year}</h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', padding: '16px' }}>
                    {[
                      { label: 'PF (Employee)', value: accountingData.summary?.pf, color: '#3b82f6' },
                      { label: 'ESI', value: accountingData.summary?.esi, color: '#8b5cf6' },
                      { label: 'TDS / Income Tax', value: accountingData.summary?.tax, color: '#ef4444' },
                      { label: 'Loan Deductions', value: accountingData.summary?.loan, color: '#f59e0b' },
                      { label: 'Advance Recovery', value: accountingData.summary?.advance, color: '#ec4899' },
                      { label: 'Loss of Pay', value: accountingData.summary?.lossOfPay, color: '#dc2626' },
                      { label: 'Late Penalties', value: accountingData.summary?.lateDeduction, color: '#d97706' },
                    ].map(item => (
                      <div key={item.label} style={{ background: 'white', padding: '14px', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${item.color}` }}>
                        <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{item.label}</div>
                        <div style={{ fontSize: '16px', fontWeight: '700', color: item.color }}>{formatCurrency(item.value || 0)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Department Breakdown */}
                {accountingData.departmentBreakdown?.length > 0 && (
                  <div className="payroll-records" style={{ marginBottom: '20px' }}>
                    <div className="payroll-records-header">
                      <h2>Department-wise Payroll</h2>
                    </div>
                    <table className="payroll-table">
                      <thead>
                        <tr>
                          <th>Department</th>
                          <th>Employees</th>
                          <th>Gross Salary</th>
                          <th>Total Deductions</th>
                          <th>Net Salary</th>
                          <th>Per Employee Avg</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accountingData.departmentBreakdown.map(dept => (
                          <tr key={dept.department}>
                            <td><strong>{dept.department}</strong></td>
                            <td className="centered-text">{dept.employees}</td>
                            <td className="salary-amount">{formatCurrency(dept.grossSalary)}</td>
                            <td className="deduction-amount">-{formatCurrency(dept.totalDeductions)}</td>
                            <td><strong className="green">{formatCurrency(dept.netSalary)}</strong></td>
                            <td className="centered-text">{formatCurrency(dept.employees > 0 ? dept.netSalary / dept.employees : 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Journal Entries */}
                <div className="payroll-records">
                  <div className="payroll-records-header">
                    <h2>Accounting Journal Entries (Double-Entry)</h2>
                    <p style={{ color: '#64748b', fontSize: '13px' }}>Standard double-entry bookkeeping for payroll accounting</p>
                  </div>
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Account</th>
                        <th>Description</th>
                        <th>Debit (Dr)</th>
                        <th>Credit (Cr)</th>
                        <th>Narration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingData.journalEntries?.map((entry, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{entry.date}</td>
                          <td><strong style={{ color: '#1e40af' }}>{entry.account}</strong></td>
                          <td style={{ fontSize: '12px' }}>{entry.description}</td>
                          <td>
                            {entry.debit > 0 ? (
                              <span style={{ fontWeight: '700', color: '#dc2626' }}>{formatCurrency(entry.debit)}</span>
                            ) : <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>
                          <td>
                            {entry.credit > 0 ? (
                              <span style={{ fontWeight: '700', color: '#059669' }}>{formatCurrency(entry.credit)}</span>
                            ) : <span style={{ color: '#94a3b8' }}>—</span>}
                          </td>
                          <td style={{ fontSize: '11px', color: '#64748b' }}>{entry.narration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '12px 16px', background: '#f0f9ff', borderTop: '1px solid #e0f2fe', fontSize: '12px', color: '#0369a1' }}>
                    Note: These journal entries follow standard Indian payroll accounting practices. Export to your accounting software (Tally/Zoho Books/QuickBooks) for integration.
                  </div>
                </div>

                {/* Employee-wise Payroll Ledger */}
                <div className="payroll-records" style={{ marginTop: '20px' }}>
                  <div className="payroll-records-header">
                    <h2>Employee Payroll Ledger</h2>
                  </div>
                  <table className="payroll-table">
                    <thead>
                      <tr>
                        <th>Emp ID</th>
                        <th>Name</th>
                        <th>Dept / Designation</th>
                        <th>Gross</th>
                        <th>Bonus</th>
                        <th>Deductions</th>
                        <th>Net Salary</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingData.payrolls?.map(p => (
                        <tr key={p.employeeId}>
                          <td style={{ fontSize: '12px', color: '#64748b' }}>{p.employeeId}</td>
                          <td><strong>{p.name}</strong></td>
                          <td>
                            <div className="employee-cell">
                              <span style={{ fontSize: '12px' }}>{p.designation}</span>
                              <span className="employee-id">{p.department}</span>
                            </div>
                          </td>
                          <td className="salary-amount">{formatCurrency(p.grossSalary)}</td>
                          <td style={{ color: p.bonus > 0 ? '#059669' : '#94a3b8' }}>{p.bonus > 0 ? formatCurrency(p.bonus) : '—'}</td>
                          <td className="deduction-amount">-{formatCurrency(p.totalDeductions)}</td>
                          <td><strong className="green">{formatCurrency(p.netSalary)}</strong></td>
                          <td>
                            <span className={`status-badge ${p.status}`}>
                              {p.status === 'paid' ? '✅ Paid' : p.status === 'processed' ? '🔄 Processed' : '📝 Draft'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="payroll-empty">
                <h3>No Accounting Data</h3>
                <p>Select a month and year and click Refresh Journal to load accounting data</p>
              </div>
            )}
          </div>
        )}

        {/* Bank Details Modal */}
        {showBankModal && (
          <div className="modal-overlay" onClick={() => setShowBankModal(false)}>
            <div className="modal-container" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🏦 Bank Details - {selectedEmployee?.firstName} {selectedEmployee?.lastName}</h2>
                <button className="modal-close" onClick={() => setShowBankModal(false)}>×</button>
              </div>

              <div className="modal-body">
                {/* Status Banner */}
                {selectedEmployee && (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    background: selectedEmployee.bankDetailsStatus === 'verified' ? '#dcfce7' :
                      selectedEmployee.bankDetailsStatus === 'rejected' ? '#fee2e2' : '#fef3c7',
                    color: selectedEmployee.bankDetailsStatus === 'verified' ? '#166534' :
                      selectedEmployee.bankDetailsStatus === 'rejected' ? '#991b1b' : '#92400e'
                  }}>
                    <strong>Status: </strong>
                    {selectedEmployee.bankDetailsStatus === 'verified' ? '✅ Verified' :
                      selectedEmployee.bankDetailsStatus === 'rejected' ? '❌ Rejected' : '⏳ Pending Verification'}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>Bank Name</label>
                    <input
                      type="text"
                      placeholder="e.g., State Bank of India"
                      value={bankFormData.bankName}
                      onChange={(e) => setBankFormData({ ...bankFormData, bankName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Account Number</label>
                    <input
                      type="text"
                      placeholder="Enter account number"
                      value={bankFormData.accountNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountNumber: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>IFSC Code</label>
                    <input
                      type="text"
                      placeholder="e.g., SBIN0001234"
                      value={bankFormData.ifscCode}
                      onChange={(e) => setBankFormData({ ...bankFormData, ifscCode: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Account Holder Name</label>
                    <input
                      type="text"
                      placeholder="Enter account holder name"
                      value={bankFormData.accountHolderName}
                      onChange={(e) => setBankFormData({ ...bankFormData, accountHolderName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>PAN Number</label>
                    <input
                      type="text"
                      placeholder="e.g., ABCDE1234F"
                      value={bankFormData.panNumber}
                      onChange={(e) => setBankFormData({ ...bankFormData, panNumber: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="form-group">
                    <label>UPI ID</label>
                    <input
                      type="text"
                      placeholder="e.g., name@upi"
                      value={bankFormData.upiId}
                      onChange={(e) => setBankFormData({ ...bankFormData, upiId: e.target.value })}
                    />
                  </div>
                </div>

                {/* Payment QR Code Section */}
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e1'
                }}>
                  <h4 style={{ margin: '0 0 15px', color: '#334155' }}>
                    📱 Payment QR Code / Barcode
                  </h4>

                  {selectedEmployee?.paymentQRCode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{
                        width: '150px',
                        height: '150px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '10px',
                        overflow: 'hidden',
                        background: 'white'
                      }}>
                        <img
                          src={`${process.env.REACT_APP_API_URL || 'https://hrmsbackend.bhoomitechzone.in'}/${selectedEmployee.paymentQRCode}`}
                          alt="Payment QR Code"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8">No Image</text></svg>'; }}
                        />
                      </div>
                      <div>
                        <p style={{ color: '#10b981', fontWeight: '600', marginBottom: '10px' }}>✅ QR Code Available</p>
                        <p style={{ fontSize: '12px', color: '#64748b' }}>
                          Use this QR code for quick salary transfer via UPI
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                      <p style={{ fontSize: '48px', marginBottom: '10px' }}>📷</p>
                      <p>Employee has not uploaded a QR code</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button className="modal-btn modal-btn-secondary" onClick={() => setShowBankModal(false)}>
                  Cancel
                </button>
                <button className="modal-btn modal-btn-primary" onClick={handleSaveBankDetails}>
                  💾 Save Bank Details
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rule Modal */}
        {showRuleModal && (
          <div className="modal-overlay" onClick={() => setShowRuleModal(false)}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedRule ? `Edit ${selectedRule} Rule` : 'Add New Salary Rule'}</h2>
                <button className="modal-close" onClick={() => setShowRuleModal(false)}>×</button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label>Rule Type <span>*</span></label>
                  <select
                    value={ruleFormData.ruleType}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, ruleType: e.target.value })}
                  >
                    <option value="">Select Rule Type</option>
                    <option value="Late Check-in">Late Check-in Penalty</option>
                    <option value="Incomplete Goals">Incomplete Daily Goals</option>
                    <option value="Absence">Absence Penalty</option>
                    <option value="Uninformed Leave">Uninformed Leave Penalty</option>
                  </select>
                  <div className="form-hint">Choose the type of salary calculation rule</div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Threshold/Criteria</label>
                    <input
                      type="text"
                      placeholder="e.g., 10:10 AM"
                      value={ruleFormData.threshold}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, threshold: e.target.value })}
                    />
                    <div className="form-hint">Time or condition for rule application</div>
                  </div>

                  <div className="form-group">
                    <label>Status <span>*</span></label>
                    <select
                      value={ruleFormData.status}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Penalty Type <span>*</span></label>
                  <select
                    value={ruleFormData.penaltyType}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, penaltyType: e.target.value })}
                  >
                    <option value="">Select Penalty Type</option>
                    <option value="Half-day">Half-day Attendance (0.5 day deduction)</option>
                    <option value="Full-day">Full-day Absence (marked absent)</option>
                    <option value="3-Day">3-Day Absence Penalty</option>
                    <option value="Per-day">Per-day Salary Deduction</option>
                  </select>
                  <div className="form-hint">How the penalty will be calculated</div>
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    placeholder="Additional notes about this rule..."
                    value={ruleFormData.description || ''}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button className="modal-btn modal-btn-secondary" onClick={() => setShowRuleModal(false)}>
                  Cancel
                </button>
                <button className="modal-btn modal-btn-primary" onClick={handleSaveRule}>
                  {selectedRule ? 'Update Rule' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Generate Salary Slip Modal */}
        {showGenerateSlipModal && (
          <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowGenerateSlipModal(false)}>
            <div className="struct-modal" style={{ margin: 0, maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <div className="struct-modal-sticky-head">
                <div className="struct-modal-hd">
                  <div className="struct-modal-hd-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="12" y1="18" x2="12" y2="12"></line>
                      <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                  </div>
                  <div>
                    <div className="struct-modal-title">Generate Salary Slip</div>
                    <div className="struct-modal-sub">Create &amp; download formatted Bhoomi Techzone payslip</div>
                  </div>
                  <button className="struct-close-btn" onClick={() => setShowGenerateSlipModal(false)}>&times;</button>
                </div>
              </div>

              <div className="struct-modal-body" style={{ padding: '18px 24px', maxHeight: '72vh', overflowY: 'auto' }}>
                <form onSubmit={handleManualGenerateSlip}>
                  {/* Select Employee */}
                  <div className="struct-field-row" style={{ marginBottom: '14px' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">Select Employee<span className="struct-req">*</span></label>
                      <select
                        className="struct-input"
                        value={generateSlipFormData.employee}
                        onChange={(e) => handleSelectEmployeeForSlip(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Employee --</option>
                        {allEmployees.map(emp => (
                          <option key={emp._id} value={emp._id}>
                            {emp.firstName} {emp.lastName} ({emp.employeeId || 'ID: ' + emp._id.slice(-4)}) - {emp.designation || 'Staff'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Month and Year */}
                  <div className="struct-field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">Month</label>
                      <select
                        className="struct-input"
                        value={generateSlipFormData.month}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, month: parseInt(e.target.value) })}
                      >
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div className="struct-field">
                      <label className="struct-lbl">Year</label>
                      <select
                        className="struct-input"
                        value={generateSlipFormData.year}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, year: parseInt(e.target.value) })}
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="struct-section-lbl" style={{ marginTop: '8px', marginBottom: '10px' }}>EARNINGS DETAILS</div>
                  
                  {/* Basic Salary & HRA */}
                  <div className="struct-field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">Basic Salary (₹)<span className="struct-req">*</span></label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="e.g. 25000"
                        value={generateSlipFormData.basicSalary}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, basicSalary: e.target.value })}
                        required
                      />
                    </div>
                    <div className="struct-field">
                      <label className="struct-lbl">House Rent Allowance (HRA)</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.hra}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, hra: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Conveyance & Food Allowance */}
                  <div className="struct-field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">Conveyance Allowance</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.conveyance}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, conveyance: e.target.value })}
                      />
                    </div>
                    <div className="struct-field">
                      <label className="struct-lbl">Food Allowance</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.food}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, food: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Additional Bonus */}
                  <div className="struct-field-row" style={{ marginBottom: '16px' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">Additional Bonus</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.bonus}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, bonus: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="struct-section-lbl" style={{ marginTop: '8px', marginBottom: '10px' }}>DEDUCTIONS &amp; ATTENDANCE</div>

                  {/* Penalty & LOP */}
                  <div className="struct-field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">Penalty (Deduction)</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.penalty}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, penalty: e.target.value })}
                      />
                    </div>
                    <div className="struct-field">
                      <label className="struct-lbl">LOP Days</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.lopDays}
                        onChange={(e) => {
                          const lop = parseFloat(e.target.value) || 0;
                          const basic = parseFloat(generateSlipFormData.basicSalary) || 0;
                          const perDay = basic / 30;
                          setGenerateSlipFormData({
                            ...generateSlipFormData,
                            lopDays: e.target.value,
                            lopDeduction: (lop * perDay).toFixed(2),
                            presentDays: Math.max(0, 30 - lop).toString()
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* PF, ESI, Tax */}
                  <div className="struct-field-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">PF (₹)</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.pf}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, pf: e.target.value })}
                      />
                    </div>
                    <div className="struct-field">
                      <label className="struct-lbl">ESI (₹)</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.esi}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, esi: e.target.value })}
                      />
                    </div>
                    <div className="struct-field">
                      <label className="struct-lbl">Tax / TDS (₹)</label>
                      <input
                        type="number"
                        className="struct-input"
                        placeholder="0"
                        value={generateSlipFormData.tax}
                        onChange={(e) => setGenerateSlipFormData({ ...generateSlipFormData, tax: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Live Calculation Preview */}
                  {(() => {
                    const basicSal = parseFloat(generateSlipFormData.basicSalary) || 0;
                    const hra = parseFloat(generateSlipFormData.hra) || 0;
                    const conv = parseFloat(generateSlipFormData.conveyance) || 0;
                    const food = parseFloat(generateSlipFormData.food) || 0;
                    const bonus = parseFloat(generateSlipFormData.bonus) || 0;
                    const gross = basicSal + hra + conv + food;

                    const penalty = parseFloat(generateSlipFormData.penalty) || 0;
                    const lop = parseFloat(generateSlipFormData.lopDeduction) || 0;
                    const pf = parseFloat(generateSlipFormData.pf) || 0;
                    const esi = parseFloat(generateSlipFormData.esi) || 0;
                    const tax = parseFloat(generateSlipFormData.tax) || 0;
                    const totalDed = penalty + lop + pf + esi + tax;
                    const net = gross + bonus - totalDed;

                    return (
                      <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>GROSS EARNINGS</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(gross + bonus)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>TOTAL DEDUCTIONS</div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#ef4444' }}>-{formatCurrency(totalDed)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>NET PAYABLE</div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#10b981' }}>{formatCurrency(net)}</div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="struct-footer">
                    <button type="button" className="struct-btn-ghost" onClick={() => setShowGenerateSlipModal(false)}>
                      <span>Cancel</span>
                    </button>
                    <button type="submit" className="struct-btn-primary" disabled={generatingSlip} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                      <span>{generatingSlip ? 'Generating...' : 'Generate & Download PDF'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Generated Payroll Modal */}
        {showEditPayrollModal && editPayrollData && (
          <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={() => setShowEditPayrollModal(false)}>
            <div className="struct-modal" style={{ margin: 0, maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
              
              <div className="struct-modal-sticky-head">
                <div className="struct-modal-hd">
                  <div className="struct-modal-hd-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                  </div>
                  <div>
                    <div className="struct-modal-title">Edit Generated Payroll</div>
                    <div className="struct-modal-sub">{editPayrollData.employeeName}</div>
                  </div>
                  <button className="struct-close-btn" onClick={() => setShowEditPayrollModal(false)}>&times;</button>
                </div>
              </div>

              <div className="struct-modal-body">
                <div className="struct-form">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div className="struct-section-lbl" style={{ margin: 0, padding: 0, border: 'none' }}>BASIC SALARY</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>{formatCurrency(editPayrollData.basicSalary)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="struct-section-lbl" style={{ margin: 0, padding: 0, border: 'none' }}>NET SALARY (PREVIEW)</div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                        {formatCurrency(
                          (Number(editPayrollData.originalGross) || 0) + 
                          (Number(editPayrollData.bonus) || 0) - 
                          (
                            (Number(editPayrollData.originalTotalDeductions) || 0) 
                            - (Number(editPayrollData.originalPenalty) || 0) 
                            + (Number(editPayrollData.penalty) || 0)
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="struct-field-row" style={{ display: 'block', marginBottom: '16px' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">Additional Bonus</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>₹</span>
                        <input
                          type="number"
                          className="struct-input"
                          value={editPayrollData.bonus}
                          onChange={(e) => setEditPayrollData({ ...editPayrollData, bonus: e.target.value })}
                          style={{ paddingLeft: '28px' }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="struct-field-row" style={{ display: 'block' }}>
                    <div className="struct-field">
                      <label className="struct-lbl">Penalty (Deduction)</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>₹</span>
                        <input
                          type="number"
                          className="struct-input"
                          value={editPayrollData.penalty}
                          onChange={(e) => setEditPayrollData({ ...editPayrollData, penalty: e.target.value })}
                          style={{ paddingLeft: '28px' }}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="struct-footer">
                    <button type="button" className="struct-btn-ghost" onClick={() => setShowEditPayrollModal(false)}>
                      <span>Cancel</span>
                    </button>
                    <button type="button" className="struct-btn-primary" onClick={handleSaveEditPayroll}>
                      <span>Save Changes</span>
                    </button>
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* Structure Modal */}
        {showStructureModal && (() => {
          let selectedEmpData = (structureFormData.employee ? allEmployees.find(e => e._id === structureFormData.employee) : null) || selectedStructure?.employee;
          // Do not show employee details card in edit mode
          if (selectedStructure && !isStructureViewMode) {
            selectedEmpData = null;
          }
          return (
            <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.3)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }} onClick={() => setShowStructureModal(false)}>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'stretch', maxHeight: isStructureViewMode || selectedStructure ? '80vh' : '80vh' }} onClick={(e) => { e.stopPropagation(); setShowEmpDd(false); }}>
                <div className="struct-modal" style={{ margin: 0, maxHeight: isStructureViewMode || selectedStructure ? '80vh' : '80vh' }}>
                  <div className="struct-modal-sticky-head">
                    <div className="struct-modal-hd">
                      <div className="struct-modal-hd-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                      </div>
                      <div>
                        <div className="struct-modal-title">{isStructureViewMode ? 'View Salary Structure' : selectedStructure ? 'Edit Salary Structure' : 'Add New Salary Structure'}</div>
                        <div className="struct-modal-sub">Define employee basic salary and allowances</div>
                      </div>
                      <button className="struct-close-btn" onClick={() => setShowStructureModal(false)}>&times;</button>
                    </div>
                  </div>

                  <div className="struct-modal-body">
                    <div className="struct-form">

                      {!selectedStructure && <div className="struct-section-lbl">Employee Details</div>}
                      <div className="struct-field-row">
                        <div className="struct-field">
                          <label className="struct-lbl">Select Employee<span className="struct-req">*</span></label>
                          {isStructureViewMode ? (
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              {selectedStructure?.employee?.firstName} {selectedStructure?.employee?.lastName} ({selectedStructure?.employee?.employeeId})
                            </div>
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!selectedStructure) setShowEmpDd(!showEmpDd);
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                                  fontSize: '13px', fontWeight: '400', cursor: selectedStructure ? 'not-allowed' : 'pointer',
                                  background: showEmpDd ? '#f8fafc' : (selectedStructure ? '#f8fafc' : '#ffffff'),
                                  color: structureFormData.employee ? '#0f172a' : '#9ca3af', outline: 'none',
                                  fontFamily: "'Inter', sans-serif",
                                  transition: 'all 0.2s',
                                  opacity: selectedStructure ? 0.7 : 1
                                }}
                              >
                                <span>
                                  {selectedStructure
                                    ? `${selectedStructure.employee?.firstName} ${selectedStructure.employee?.lastName}`
                                    : structureFormData.employee
                                      ? (() => {
                                        const emp = employeesWithoutStructure.find(e => e._id === structureFormData.employee);
                                        return emp ? `${emp.firstName} ${emp.lastName}` : "Select Employee";
                                      })()
                                      : "Select Employee"}
                                </span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEmpDd ? 'rotate(180deg)' : 'none' }}>
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </button>

                              {showEmpDd && !selectedStructure && (
                                <div onClick={e => e.stopPropagation()} style={{
                                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                                  background: '#ffffff', borderRadius: '12px',
                                  boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                                  maxHeight: '240px', padding: '8px', overflow: 'hidden',
                                  animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                                }}>
                                  <div style={{ marginBottom: '8px' }}>
                                    <input
                                      type="text"
                                      placeholder="Search employees..."
                                      value={empSearch}
                                      onChange={(e) => setEmpSearch(e.target.value)}
                                      style={{
                                        width: '100%', padding: '8px 10px', border: '1px solid #f1f5f9',
                                        borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                        outline: 'none', fontFamily: "'Inter', sans-serif"
                                      }}
                                    />
                                  </div>
                                  <div style={{ maxHeight: '180px', overflowY: 'auto' }} className="emp-modal-scroll">
                                    <div
                                      className="proj-dd-option"
                                      onClick={() => { setStructureFormData({ ...structureFormData, employee: "" }); setShowEmpDd(false); setEmpSearch(""); }}
                                      style={{
                                        padding: '8px 10px', borderRadius: '6px', fontSize: '12.5px',
                                        fontWeight: structureFormData.employee === "" ? '600' : '400',
                                        cursor: 'pointer', color: structureFormData.employee === "" ? '#15803d' : '#1e293b',
                                        background: structureFormData.employee === "" ? '#dcfce7' : 'transparent',
                                        marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                        transition: 'all 0.15s'
                                      }}
                                      onMouseEnter={e => { if (structureFormData.employee !== "") e.currentTarget.style.background = '#f8fafc' }}
                                      onMouseLeave={e => { if (structureFormData.employee !== "") e.currentTarget.style.background = 'transparent' }}
                                    >Select Employee</div>
                                    {employeesWithoutStructure.length === 0 ? (
                                      <div style={{
                                        padding: '12px 10px', fontSize: '12px', color: '#64748b',
                                        fontStyle: 'italic', textAlign: 'center'
                                      }}>
                                        No employees available for a new structure.
                                      </div>
                                    ) : (
                                      employeesWithoutStructure
                                        .filter(e => `${e.firstName} ${e.lastName} ${e.employeeId}`.toLowerCase().includes(empSearch.toLowerCase()))
                                        .map(emp => (
                                          <div
                                            key={emp._id}
                                            className="proj-dd-option"
                                            onClick={() => { setStructureFormData({ ...structureFormData, employee: emp._id }); setShowEmpDd(false); setEmpSearch(""); }}
                                            style={{
                                              padding: '8px 10px', borderRadius: '6px', fontSize: '12.5px',
                                              fontWeight: structureFormData.employee === emp._id ? '600' : '400',
                                              cursor: 'pointer', color: structureFormData.employee === emp._id ? '#15803d' : '#1e293b',
                                              background: structureFormData.employee === emp._id ? '#dcfce7' : 'transparent',
                                              marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                              transition: 'all 0.15s'
                                            }}
                                            onMouseEnter={e => { if (structureFormData.employee !== emp._id) e.currentTarget.style.background = '#f8fafc' }}
                                            onMouseLeave={e => { if (structureFormData.employee !== emp._id) e.currentTarget.style.background = 'transparent' }}
                                          >{emp.firstName} {emp.lastName} <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>({emp.employeeId})</span></div>
                                        ))
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="struct-section-lbl">Salary Configuration & Allowances</div>
                      <div className="struct-field-row">
                        <div className="struct-field">
                          <label className="struct-lbl">Basic Salary<span className="struct-req">*</span></label>
                          {isStructureViewMode ? (
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              {formatCurrency(structureFormData.basicSalary || 0)}
                            </div>
                          ) : (
                            <input
                              type="number"
                              className="struct-input"
                              placeholder="Enter Amount"
                              value={structureFormData.basicSalary}
                              onChange={(e) => {
                                const basic = parseFloat(e.target.value) || 0;
                                const hra = Math.round(basic * 0.3);
                                setStructureFormData({
                                  ...structureFormData,
                                  basicSalary: e.target.value,
                                  hra: hra.toString(),
                                  grossSalary: basic.toString()
                                });
                              }}
                            />
                          )}
                        </div>
                        <div className="struct-field">
                          <label className="struct-lbl">House Rent Allowance (HRA)</label>
                          {isStructureViewMode ? (
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              {formatCurrency(structureFormData.hra || 0)}
                            </div>
                          ) : (
                            <input className="struct-input" type="number" placeholder="0" value={structureFormData.hra}
                              onChange={(e) => setStructureFormData({ ...structureFormData, hra: e.target.value })} />
                          )}
                        </div>
                      </div>

                      <div className="struct-field-row">
                        <div className="struct-field">
                          <label className="struct-lbl">Conveyance Allowance</label>
                          {isStructureViewMode ? (
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              {formatCurrency(structureFormData.conveyance || 0)}
                            </div>
                          ) : (
                            <input className="struct-input" type="number" placeholder="0" value={structureFormData.conveyance}
                              onChange={(e) => setStructureFormData({ ...structureFormData, conveyance: e.target.value })} />
                          )}
                        </div>
                        <div className="struct-field">
                          <label className="struct-lbl">Food Allowance</label>
                          {isStructureViewMode ? (
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              {formatCurrency(structureFormData.food || 0)}
                            </div>
                          ) : (
                            <input className="struct-input" type="number" placeholder="0" value={structureFormData.food}
                              onChange={(e) => setStructureFormData({ ...structureFormData, food: e.target.value })} />
                          )}
                        </div>
                      </div>





                      <div className="struct-footer">
                        <button type="button" className="struct-btn-ghost" onClick={() => setShowStructureModal(false)}>
                          <span>{isStructureViewMode ? 'Close' : 'Cancel'}</span>
                        </button>
                        {!isStructureViewMode && (
                          <button type="button" className="struct-btn-primary" onClick={handleSaveStructure}>
                            <span>{selectedStructure ? 'Update Structure' : 'Create Structure'}</span>
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                </div>

                {/* Side Card for Employee Details */}
                <div style={{
                  flex: selectedEmpData ? "0 0 340px" : "0 0 0px",
                  minWidth: selectedEmpData ? "300px" : "0px",
                  width: selectedEmpData ? "340px" : "0px",
                  background: "#fff", borderRadius: "14px",
                  border: selectedEmpData ? "1px solid #e5e7eb" : "none",
                  padding: selectedEmpData ? "16px" : "0px",
                  display: "flex", flexDirection: "column", gap: "10px",
                  opacity: selectedEmpData ? 1 : 0,
                  overflow: "hidden",
                  transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  visibility: selectedEmpData ? "visible" : "hidden",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)"
                }}>
                  {selectedEmpData && (
                    <div style={{ minWidth: "200px", display: "flex", flexDirection: "column", height: "100%", gap: "10px" }}>
                      {/* Avatar */}
                      <div style={{
                        height: "100px", borderRadius: "11px", overflow: "hidden", flexShrink: 0,
                        background: "#f0fdf4",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        <div style={{
                          width: "56px", height: "56px", borderRadius: "50%",
                          background: "#166534",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                          </svg>
                        </div>
                      </div>

                      {/* Name + verified */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                          {selectedEmpData.firstName || ''} {selectedEmpData.lastName || ''}
                        </div>
                        <div style={{
                          width: "14px", height: "14px", borderRadius: "50%",
                          background: selectedEmpData.isActive !== false ? "#4caf50" : "#dc2626",
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                        }}>
                          {selectedEmpData.isActive !== false ? (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                              <path d="M20 7L10 17l-6-6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                              <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                      </div>

                      {/* Key info */}
                      <div style={{ display: "grid", gap: "6px", marginTop: "8px", overflowY: "auto", flex: 1, paddingRight: "4px" }}>
                        {[
                          ["Employee ID", selectedEmpData.employeeId],
                          ["Designation", selectedEmpData.designation || "—"],
                          ["Department", typeof selectedEmpData.department === 'object' ? selectedEmpData.department?.name : (selectedEmpData.department || "—")],
                          ["Role", selectedEmpData.role?.name || "—"],
                          ["Email", selectedEmpData.email || "—"],
                          ["Phone", selectedEmpData.phoneNumber || "—"],
                          ["Joining Date", selectedEmpData.joiningDate ? (() => {
                            const d = new Date(selectedEmpData.joiningDate);
                            return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
                          })() : "—"],
                          ["Bank Name", selectedEmpData.bankName || "—"],
                          ["Account No.", selectedEmpData.accountNumber || "—"],
                          ["IFSC", selectedEmpData.ifscCode || "—"],
                          ["PAN", selectedEmpData.panNumber || "—"]
                        ].map(([label, val]) => (
                          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                            <span style={{ fontSize: "10px", color: "#6b7280", flexShrink: 0 }}>{label}</span>
                            <span style={{ fontSize: "10px", fontWeight: 600, color: "#111827", textAlign: "right", wordBreak: "break-word" }}>{val}</span>
                          </div>
                        ))}
                      </div>

                    </div>
                  )}
                </div>
              </div>

            </div>
          );
        })()}
        {/* View Modal */}
        {showViewModal && viewEmployeeData && (
          <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
            <div className="modal-container" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Employee Summary</h2>
                <button className="modal-close" onClick={() => setShowViewModal(false)}>×</button>
              </div>

              <div className="modal-body">
                <div className="component-list" style={{ gap: '15px', display: 'flex', flexDirection: 'column' }}>
                  <div className="component-item" style={{ fontSize: '1.1rem', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
                    <span>Employee:</span>
                    <strong>{viewEmployeeData.name}</strong>
                  </div>
                  <div className="component-item">
                    <span>Grade:</span>
                    <span>{viewEmployeeData.grade}</span>
                  </div>
                  <div className="component-item">
                    <span>Gross Salary:</span>
                    <strong>{formatCurrency(viewEmployeeData.gross)}</strong>
                  </div>
                  <div className="component-item">
                    <span>Penalty Days:</span>
                    <span style={{ color: viewEmployeeData.penaltyDays > 0 ? '#ef4444' : '#10b981', fontWeight: '600' }}>
                      {viewEmployeeData.penaltyDays} Days
                    </span>
                  </div>
                  <div className="component-item">
                    <span>Total Deduction:</span>
                    <span style={{ color: '#ef4444', fontWeight: '600' }}>-{formatCurrency(viewEmployeeData.deduction)}</span>
                  </div>
                  <div className="component-item" style={{ marginTop: '10px', paddingTop: '15px', borderTop: '2px solid #e2e8f0' }}>
                    <span style={{ fontSize: '1.2rem' }}>Net Salary:</span>
                    <strong className="green" style={{ fontSize: '1.5rem' }}>{formatCurrency(viewEmployeeData.net)}</strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="modal-btn modal-btn-secondary" onClick={() => setShowViewModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Payment Date Modal */}
        {showPaymentDateModal && (
          <div className="modal-overlay" onClick={() => setShowPaymentDateModal(false)} style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}>
            <div className="modal-container" style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 32px 64px rgba(0,0,0,0.18)', width: '380px', padding: '24px', fontFamily: "'Inter','Poppins',sans-serif", display: 'flex', flexDirection: 'column', gap: '20px' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: '0', color: '#0f172a', fontSize: '18px', fontWeight: 700 }}>Select Payment Due Date</h3>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Due Date</label>
                <input 
                  type="date" 
                  value={paymentDueDate} 
                  onChange={(e) => setPaymentDueDate(e.target.value)}
                  style={{ width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#0f172a', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button onClick={() => setShowPaymentDateModal(false)} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>Cancel</button>
                <button 
                  onClick={() => setShowPaymentDateModal(false)} 
                  style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.2)', transition: 'all 0.2s' }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Attendance Modal */}
        {showDetailedAttendanceModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowDetailedAttendanceModal(false)}
            style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(5px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 32px 64px rgba(0,0,0,0.18)', width: '95vw', maxWidth: '1300px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', borderRadius: '16px 16px 0 0' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                    {detailedAttendanceData ? `${detailedAttendanceData.employee.name} — Attendance Details` : 'Loading...'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {detailedAttendanceData ? `${months.find(m => m.value === detailedAttendanceData.month)?.label} ${detailedAttendanceData.year}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailedAttendanceModal(false)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >×</button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
                {loadingAttendance ? (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px' }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1.4s linear infinite', marginBottom: '12px' }}>
                      <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                    </svg>
                    <div>Loading attendance details...</div>
                  </div>
                ) : detailedAttendanceData ? (
                  <>
                    {/* Employee & Shift Info Bar */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '16px', padding: '14px 18px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                      {[
                        { label: 'Employee ID', value: detailedAttendanceData.employee.employeeId },
                        { label: 'Department', value: detailedAttendanceData.employee.department || 'N/A' },
                        { label: 'Designation', value: detailedAttendanceData.employee.designation || 'N/A' },
                        { label: 'Shift Type', value: detailedAttendanceData.employee.shift?.name || 'Standard Shift' },
                        { label: 'Shift Timing', value: detailedAttendanceData.employee.shift ? `${detailedAttendanceData.employee.shift.startTime} - ${detailedAttendanceData.employee.shift.endTime}` : '09:00 AM - 06:00 PM' },
                        { label: 'Month / Year', value: `${months.find(m => m.value === detailedAttendanceData.month)?.label} ${detailedAttendanceData.year}` },
                      ].map((item, i) => (
                        <div key={i}>
                          <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{item.label}</div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Salary & Deductions Breakdown Card */}
                    {detailedAttendanceData.salaryBreakdown && (
                      <div style={{ background: '#faf5ff', border: '1px solid #f3e8ff', borderRadius: '10px', padding: '12px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b21a8', textTransform: 'uppercase', display: 'block' }}>Per Day Rate</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#581c87' }}>₹{detailedAttendanceData.salaryBreakdown.perDaySalary?.toLocaleString('en-IN') || 0}/day</span>
                          </div>
                          <div style={{ width: '1px', height: '24px', background: '#e9d5ff' }} />
                          <div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', display: 'block' }}>Paid Days Earned</span>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#15803d' }}>+₹{detailedAttendanceData.salaryBreakdown.presentEarnings?.toLocaleString('en-IN') || 0}</span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {detailedAttendanceData.salaryBreakdown.halfDayDeduction > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 700, border: '1px solid #fde68a' }}>
                              Half-day Deducted: -₹{detailedAttendanceData.salaryBreakdown.halfDayDeduction.toLocaleString('en-IN')}
                            </span>
                          )}
                          {detailedAttendanceData.salaryBreakdown.absentLossOfPay > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: '#fee2e2', color: '#991b1b', fontSize: '11px', fontWeight: 700, border: '1px solid #fecaca' }}>
                              Absent Loss of Pay: -₹{detailedAttendanceData.salaryBreakdown.absentLossOfPay.toLocaleString('en-IN')}
                            </span>
                          )}
                          {detailedAttendanceData.salaryBreakdown.lateDeduction > 0 && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: '#ede9fe', color: '#5b21b6', fontSize: '11px', fontWeight: 700, border: '1px solid #ddd6fe' }}>
                              Late Penalty: -₹{detailedAttendanceData.salaryBreakdown.lateDeduction.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Summary Chips */}
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                      {[
                        { label: 'Present', value: detailedAttendanceData.summary.presentDays, bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
                        { label: 'Absent', value: detailedAttendanceData.summary.absentDays, bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
                        { label: 'Half-day', value: detailedAttendanceData.summary.halfDays, bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
                        { label: 'Leave', value: detailedAttendanceData.summary.leaveDays || 0, bg: '#e0f2fe', color: '#0369a1', dot: '#0284c7' },
                        { label: 'Holiday', value: detailedAttendanceData.summary.holidayDays || 0, bg: '#fce7f3', color: '#9d174d', dot: '#ec4899' },
                        { label: 'Week Off', value: detailedAttendanceData.summary.weekOffDays || 0, bg: '#e0e7ff', color: '#3730a3', dot: '#6366f1' },
                        { label: 'Working Days', value: detailedAttendanceData.summary.totalDays, bg: '#f0f9ff', color: '#0369a1', dot: '#38bdf8' },
                      ].map((chip, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 11px', borderRadius: '999px', background: chip.bg, color: chip.color, fontSize: '10.5px', fontWeight: 700, border: `1px solid ${chip.dot}30` }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: chip.dot, display: 'inline-block' }} />
                          {chip.label}: {chip.value}
                        </span>
                      ))}
                    </div>

                    {/* Daily Attendance Table — Export Style */}
                    <div style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: "'Inter','Poppins',sans-serif" }}>
                        <thead>
                          {/* Day Name Row (Sun, Mon, Tue...) */}
                          <tr>
                            <th style={{ padding: '6px 12px', background: '#0f172a', color: '#94a3b8', fontWeight: 700, fontSize: '9.5px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 5, minWidth: '110px' }}>Day</th>
                            {detailedAttendanceData.dailyBreakdown.map(day => {
                              const d = new Date(detailedAttendanceData.year, detailedAttendanceData.month - 1, day.day);
                              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                              return (
                                <th key={`dn-${day.day}`} style={{ padding: '5px 4px', background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '9.5px', textAlign: 'center', minWidth: '40px', border: '1px solid #e5e7eb', textTransform: 'uppercase' }}>
                                  {dayName}
                                </th>
                              );
                            })}
                            <th style={{ padding: '6px 10px', background: '#f1f5f9', color: '#475569', fontWeight: 700, fontSize: '9.5px', textAlign: 'center', minWidth: '80px', border: '1px solid #e5e7eb' }}>Total</th>
                          </tr>

                          {/* Date Number Row (1, 2, 3...) */}
                          <tr>
                            <th style={{ padding: '8px 12px', background: '#1e3a5f', color: '#fff', fontWeight: 700, fontSize: '10px', textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', left: 0, zIndex: 5, minWidth: '110px' }}>Date</th>
                            {detailedAttendanceData.dailyBreakdown.map(day => (
                              <th key={day.day} style={{ padding: '6px 4px', background: '#f8fafc', color: '#374151', fontWeight: 700, fontSize: '10px', textAlign: 'center', minWidth: '40px', border: '1px solid #e5e7eb' }}>
                                {day.day}
                              </th>
                            ))}
                            <th style={{ padding: '8px 10px', background: '#f8fafc', color: '#374151', fontWeight: 700, fontSize: '10px', textAlign: 'center', minWidth: '80px', border: '1px solid #e5e7eb' }}>Summary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* Arrived Time */}
                          <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '7px 12px', fontWeight: 600, color: '#374151', background: '#fafafa', fontSize: '10.5px', position: 'sticky', left: 0, zIndex: 2, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Arrived Time</td>
                            {detailedAttendanceData.dailyBreakdown.map(day => (
                              <td key={`at-${day.day}`} style={{ padding: '7px 4px', textAlign: 'center', color: '#475569', border: '1px solid #f3f4f6', fontSize: '10px', background: day.loginTime ? '#f0fdf4' : 'white' }}>
                                {day.loginTime ? new Date(day.loginTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                              </td>
                            ))}
                            <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700, color: '#166534', background: '#f0fdf4', border: '1px solid #e5e7eb', fontSize: '10.5px' }}>{detailedAttendanceData.summary.presentDays} P</td>
                          </tr>
                          {/* Dept Time (Logout) */}
                          <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '7px 12px', fontWeight: 600, color: '#374151', background: '#fafafa', fontSize: '10.5px', position: 'sticky', left: 0, zIndex: 2, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Dept Time</td>
                            {detailedAttendanceData.dailyBreakdown.map(day => (
                              <td key={`dt-${day.day}`} style={{ padding: '7px 4px', textAlign: 'center', color: '#475569', border: '1px solid #f3f4f6', fontSize: '10px', background: day.logoutTime ? '#f0fdf4' : 'white' }}>
                                {day.logoutTime ? new Date(day.logoutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}
                              </td>
                            ))}
                            <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700, color: '#991b1b', background: '#fef2f2', border: '1px solid #e5e7eb', fontSize: '10.5px' }}>{detailedAttendanceData.summary.absentDays} A</td>
                          </tr>
                          {/* Working Hrs */}
                          <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '7px 12px', fontWeight: 600, color: '#374151', background: '#fafafa', fontSize: '10.5px', position: 'sticky', left: 0, zIndex: 2, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Working Hrs</td>
                            {detailedAttendanceData.dailyBreakdown.map(day => (
                              <td key={`wh-${day.day}`} style={{ padding: '7px 4px', textAlign: 'center', fontWeight: 600, color: day.workingHours > 0 ? '#059669' : '#94a3b8', border: '1px solid #f3f4f6', fontSize: '10px' }}>
                                {day.workingHours > 0 ? `${String(Math.floor(day.workingHours)).padStart(2, '0')}:${String(Math.round((day.workingHours % 1) * 60)).padStart(2, '0')}` : '00:00'}
                              </td>
                            ))}
                            <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700, color: '#0369a1', background: '#f0f9ff', border: '1px solid #e5e7eb', fontSize: '10.5px' }}>{detailedAttendanceData.summary.totalWorkingHours}h</td>
                          </tr>

                          {/* Status Row */}
                          <tr>
                            <td style={{ padding: '7px 12px', fontWeight: 700, color: '#0f172a', background: '#f1f5f9', fontSize: '10.5px', position: 'sticky', left: 0, zIndex: 2, border: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>Status</td>
                            {detailedAttendanceData.dailyBreakdown.map(day => {
                              const isLeave = day.status === 'Leave' || day.leaveInfo;
                              const isHoliday = day.status === 'Holiday' || day.isHoliday;
                              const isWeekoff = day.status === 'Week Off' || day.isWeekend;
                              const cfg = day.status === 'Present'
                                ? { bg: '#dcfce7', color: '#166534', label: 'P' }
                                : day.status === 'Half-day'
                                  ? { bg: '#fef3c7', color: '#92400e', label: 'H' }
                                  : isLeave
                                    ? { bg: '#e0f2fe', color: '#0369a1', label: 'L' }
                                    : isHoliday
                                      ? { bg: '#fce7f3', color: '#9d174d', label: 'HOL' }
                                      : isWeekoff
                                        ? { bg: '#e0e7ff', color: '#3730a3', label: 'WO' }
                                        : day.status === 'Absent'
                                          ? { bg: '#fee2e2', color: '#991b1b', label: 'A' }
                                          : { bg: '#f1f5f9', color: '#64748b', label: '—' };
                              return (
                                <td key={`st-${day.day}`} title={day.holidayName || (day.leaveInfo ? `${day.leaveInfo.leaveType} (${day.leaveInfo.reason})` : '')} style={{ padding: '7px 4px', textAlign: 'center', background: cfg.bg, color: cfg.color, fontWeight: 700, border: '1px solid #e5e7eb', fontSize: '10.5px' }}>
                                  {cfg.label}
                                </td>
                              );
                            })}
                            <td style={{ padding: '7px', textAlign: 'center', fontWeight: 700, color: '#f59e0b', background: '#fef3c7', border: '1px solid #e5e7eb', fontSize: '10.5px' }}>{detailedAttendanceData.summary.halfDays} H</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8', fontSize: '14px' }}>No attendance data available</div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#fafafa', borderRadius: '0 0 16px 16px' }}>
                <button
                  onClick={() => setShowDetailedAttendanceModal(false)}
                  style={{ padding: '9px 24px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins',sans-serif", boxShadow: '0 4px 12px rgba(59,119,94,0.25)', transition: 'opacity 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}


        {/* QR Code Preview Modal */}
        <div
          id="qr-preview-modal"
          onClick={(e) => {
            if (e.target.id === 'qr-preview-modal') {
              document.getElementById('qr-preview-modal').style.display = 'none';
            }
          }}
          style={{
            display: 'none',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 1000,
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#334155' }}>
                📱 Payment QR Code
              </h3>
              <button
                onClick={() => document.getElementById('qr-preview-modal').style.display = 'none'}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#94a3b8'
                }}
              >
                ×
              </button>
            </div>

            {selectedEmployee && (
              <>
                <p style={{ textAlign: 'center', marginBottom: '15px', color: '#64748b' }}>
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                </p>

                {selectedEmployee.paymentQRCode ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    background: '#f8fafc',
                    borderRadius: '8px'
                  }}>
                    <img
                      src={`${process.env.REACT_APP_API_URL || 'https://hrmsbackend.bhoomitechzone.in'}/${selectedEmployee.paymentQRCode}`}
                      alt="Payment QR Code"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '300px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px'
                      }}
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23f1f5f9" width="200" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="14">Image not found</text></svg>';
                      }}
                    />
                    <p style={{ marginTop: '15px', fontSize: '13px', color: '#10b981' }}>
                      ✅ Scan this QR code for salary transfer
                    </p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    No QR code uploaded
                  </div>
                )}

                {selectedEmployee.upiId && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    background: '#f0fdf4',
                    borderRadius: '8px',
                    textAlign: 'center'
                  }}>
                    <span style={{ color: '#166534', fontSize: '14px' }}>
                      <strong>UPI ID:</strong> {selectedEmployee.upiId}
                    </span>
                  </div>
                )}
              </>
            )}

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={() => document.getElementById('qr-preview-modal').style.display = 'none'}
                style={{
                  padding: '10px 24px',
                  background: '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Employee Summary Modal */}
      {showEmployeeSummaryModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowEmployeeSummaryModal(false)}
          style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
              width: "480px",
              maxWidth: "92vw",
              background: "#ffffff",
              borderRadius: "20px",
              border: "1px solid #e5e7eb",
              overflow: "hidden",
              boxShadow: "0 32px 64px rgba(0, 0, 0, 0.18), 0 8px 24px rgba(0,0,0,0.08)",
              animation: "is-modal-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both",
              position: "relative",
              boxSizing: "border-box"
            }}
          >
            {/* Gradient Header Banner */}
            <div style={{
              height: "160px",
              background: "linear-gradient(135deg, #3b775e 0%, #56a07a 55%, #a8e63d 100%)",
              position: "relative",
              display: "flex",
              alignItems: "flex-end",
              padding: "0 24px 0"
            }}>
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowEmployeeSummaryModal(false)}
                style={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  background: "rgba(255,255,255,0.15)",
                  color: "#fff",
                  width: "30px",
                  height: "30px",
                  borderRadius: "50%",
                  fontSize: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  zIndex: 20,
                  backdropFilter: "blur(4px)",
                  transition: "all 0.2s"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; }}
              >
                ×
              </button>

              {/* Avatar — overlaps banner */}
              <div style={{
                position: "absolute",
                bottom: "-36px",
                left: "24px",
                width: "72px",
                height: "72px",
                borderRadius: "16px",
                overflow: "hidden",
                border: "3px solid #fff",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                background: "linear-gradient(135deg, #a8e63d, #56a07a)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                {employeeSummaryLoading ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 1.8s linear infinite' }}>
                    <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                  </svg>
                ) : employeeSummaryData?.profileImage || employeeSummaryData?.avatar || employeeSummaryData?.photo ? (
                  <img
                    src={employeeSummaryData.profileImage || employeeSummaryData.avatar || employeeSummaryData.photo}
                    alt="profile"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "52px 24px 24px" }}>
              {/* Name + Badge */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
                    {employeeSummaryData ? `${employeeSummaryData.firstName} ${employeeSummaryData.lastName}` : "Loading..."}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                    {employeeSummaryData?.designation || employeeSummaryData?.role?.name || "Employee"}
                  </div>
                </div>
                {employeeSummaryData && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: "#d1fae5", color: "#047857" }}>
                    <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#059669", display: "inline-block" }} />
                    Active
                  </span>
                )}
              </div>

              <div style={{ height: "1px", background: "#f1f5f9", margin: "16px 0" }} />

              {/* Info Grid */}
              {employeeSummaryData && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  {[
                    { label: "Employee ID", value: employeeSummaryData.employeeId || "-" },
                    { label: "Department", value: employeeSummaryData.department || "-" },
                    { label: "Role", value: employeeSummaryData.role?.name || "-" },
                    { label: "Phone", value: employeeSummaryData.phone || "-" },
                    { label: "Joining Date", value: employeeSummaryData.joiningDate ? new Date(employeeSummaryData.joiningDate).toLocaleDateString('en-IN') : "-" },
                    { label: "Email", value: employeeSummaryData.email || "-", fullWidth: true },
                  ].map((item, i) => (
                    <div key={i} style={{ gridColumn: item.fullWidth ? '1 / -1' : 'auto' }}>
                      <div style={{ fontSize: "9.5px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>{item.label}</div>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: "#1e293b", wordBreak: "break-word" }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer Button */}
              <button
                type="button"
                onClick={() => setShowEmployeeSummaryModal(false)}
                style={{
                  marginTop: "20px",
                  width: "100%",
                  border: "none",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)",
                  color: "#fff",
                  padding: "11px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(59,119,94,0.28)",
                  fontFamily: "'Inter', 'Poppins', sans-serif",
                  transition: "opacity 0.2s"
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payroll;