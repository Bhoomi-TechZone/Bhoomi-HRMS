import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { useContextualQueryState } from "../utils/routeUtils";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Download, Eye, EyeOff, UserX, UserCheck, MoreVertical, Edit2, Trash2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Helper: Format numeric ID with at least 3 digits (001 to 100, 101 to 200, 201 to 300, etc.)
function formatEmpNumber(val) {
  if (!val) return '';
  const clean = String(val).replace(/^EMP/i, '').replace(/\D/g, '');
  if (!clean) return '';
  return clean.padStart(3, '0');
}

// Helper: Calculate next available EMP ID (min 3 digits: EMP001, EMP002... EMP109...)
function getNextEmpId(empList) {
  if (!empList || !empList.length) return 'EMP001';
  let maxNum = 0;
  empList.forEach(emp => {
    const idStr = String(emp.employeeId || '');
    const numMatch = idStr.match(/\d+/g);
    if (numMatch) {
      const num = parseInt(numMatch[numMatch.length - 1], 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  });
  const nextNum = maxNum + 1;
  return `EMP${String(nextNum).padStart(3, '0')}`;
}

// Helper: Get last 6 months labels
function getLastMonths(n = 6) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }));
  }
  return arr;
}

// Helper: Parse 12-hour time format (e.g., "09:30 AM" -> {hour: "09", minute: "30", period: "AM"})
function parseTime12Hour(timeStr) {
  if (!timeStr) return { hour: "09", minute: "00", period: "AM" };
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return { hour: "09", minute: "00", period: "AM" };
  return {
    hour: match[1].padStart(2, '0'),
    minute: match[2],
    period: match[3].toUpperCase()
  };
}

// Helper: Format time parts to 12-hour string (e.g., {hour: "09", minute: "30", period: "AM"} -> "09:30 AM")
function formatTime12Hour(hour, minute, period) {
  return `${hour}:${minute} ${period}`;
}

// Helper: Prepare chart data for completed/overdue projects
function getPerformanceChartData(projects) {
  const months = getLastMonths(6);
  const completed = Array(months.length).fill(0);
  const overdue = Array(months.length).fill(0);
  projects.forEach((p) => {
    if (!p.deadline) return;
    const deadline = new Date(p.deadline);
    const idx = months.findIndex((label, i) => {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - (months.length - 1 - i), 1);
      return deadline.getFullYear() === d.getFullYear() && deadline.getMonth() === d.getMonth();
    });
    if (idx === -1) return;
    if (p.status === 'completed') completed[idx]++;
    else if (deadline < new Date() && p.status !== 'completed') overdue[idx]++;
  });
  return {
    labels: months,
    datasets: [
      {
        label: 'Completed',
        data: completed,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.12)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Overdue',
        data: overdue,
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.10)',
        tension: 0.4,
        fill: true,
      },
    ],
  };
}

function Employees() {
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role?.name === 'Admin' || user?.role?.name === 'HR';
  const canReadEmployee = hasPermission?.('employees', 'read');
  const canCreateEmployee = hasPermission?.('employees', 'create');
  const canUpdateEmployee = hasPermission?.('employees', 'update');
  const canDeleteEmployee = hasPermission?.('employees', 'delete');

  const [{ search: initialSearch, role: filterRole, dept: filterDepartment, status: filterStatus, filter: quickFilter, page: currentPage }, setQueryState] = useContextualQueryState({
    ref: 'sidebar',
    tab: 'all',
    status: 'active',
    role: '',
    dept: '',
    filter: 'all',
    search: '',
    page: 1,
  });

  const [searchTerm, setSearchTerm] = useState(initialSearch || "");

  const setFilterRole = useCallback((role) => setQueryState({ role, page: 1 }), [setQueryState]);
  const setFilterDepartment = useCallback((dept) => setQueryState({ dept, page: 1 }), [setQueryState]);
  const setFilterStatus = useCallback((status) => setQueryState({ status, page: 1 }), [setQueryState]);
  const setQuickFilter = useCallback((filter) => setQueryState({ filter, page: 1 }), [setQueryState]);
  const setCurrentPage = useCallback((page) => setQueryState((prev) => ({ page: typeof page === 'function' ? page(prev.page || 1) : page })), [setQueryState]);

  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [selectedEmployeeForPassword, setSelectedEmployeeForPassword] = useState(null);
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const ITEMS_PER_PAGE = 10;
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeProjects, setEmployeeProjects] = useState([]);
  const [editFormData, setEditFormData] = useState({});
  const navigate = useNavigate();
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateEmployeeData, setDeactivateEmployeeData] = useState(null);
  const [deactivateFormData, setDeactivateFormData] = useState({
    lastWorkingDay: '',
    leavingType: '',
    reason: '',
    exitFormalities: '',
    handover: '',
    handoverTo: '',
    handoverToOther: '',
    handoverReason: ''
  });
  const [viewModalTab, setViewModalTab] = useState("info");
  const [showClosureSide, setShowClosureSide] = useState(false);
  const [showAccessControl, setShowAccessControl] = useState(false);
  const [accessModules, setAccessModules] = useState([]);
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [moduleFormData, setModuleFormData] = useState({ title: '', description: '' });
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [showDeptDd, setShowDeptDd] = useState(false);
  const [showDesigDd, setShowDesigDd] = useState(false);
  const [showRoleFilterDd, setShowRoleFilterDd] = useState(false);
  const [showExitDd, setShowExitDd] = useState(false);
  const [showHandoverDd, setShowHandoverDd] = useState(false);
  const [exitDdPos, setExitDdPos] = useState({ top: 0, left: 0, width: 0 });
  const [handoverDdPos, setHandoverDdPos] = useState({ top: 0, left: 0, width: 0 });
  const [showHandoverToDd, setShowHandoverToDd] = useState(false);
  const [handoverToDdPos, setHandoverToDdPos] = useState({ top: 0, left: 0, width: 0 });
  const [showLeavingTypeDd, setShowLeavingTypeDd] = useState(false);
  const [leavingTypeDdPos, setLeavingTypeDdPos] = useState({ top: 0, left: 0, width: 0 });
  const [exitSearch, setExitSearch] = useState('');
  const [handoverSearch, setHandoverSearch] = useState('');
  const [handoverToSearch, setHandoverToSearch] = useState('');
  const [leavingTypeSearch, setLeavingTypeSearch] = useState('');
  const [showAddRoleDd, setShowAddRoleDd] = useState(false);
  const [showEditRoleDd, setShowEditRoleDd] = useState(false);
  const [showAddShiftDd, setShowAddShiftDd] = useState(false);
  const [showEditShiftDd, setShowEditShiftDd] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [editRoleSearch, setEditRoleSearch] = useState("");
  const [shiftSearch, setShiftSearch] = useState("");
  const [editShiftSearch, setEditShiftSearch] = useState("");
  const [showAddManagerDd, setShowAddManagerDd] = useState(false);
  const [showEditManagerDd, setShowEditManagerDd] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");
  const [editManagerSearch, setEditManagerSearch] = useState("");
  const [showAddGenderDd, setShowAddGenderDd] = useState(false);
  const [showEditGenderDd, setShowEditGenderDd] = useState(false);
  const [showDeptFilterDd, setShowDeptFilterDd] = useState(false);
  const [showStatusFilterDd, setShowStatusFilterDd] = useState(false);
  const [deptSearch, setDeptSearch] = useState("");
  const [desigSearch, setDesigSearch] = useState("");
  const [roleFilterSearch, setRoleFilterSearch] = useState("");
  const [deptFilterSearch, setDeptFilterSearch] = useState("");
  const [hoveredDeptItem, setHoveredDeptItem] = useState(null);
  const [hoveredDesigItem, setHoveredDesigItem] = useState(null);

  const [removedDepts, setRemovedDepts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('removedDepts')) || []; } catch (e) { return []; }
  });
  const [removedDesigs, setRemovedDesigs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('removedDesigs')) || []; } catch (e) { return []; }
  });

  const handleRemoveDept = (deptToRemove) => {
    const updated = [...removedDepts, deptToRemove.toLowerCase()];
    setRemovedDepts(updated);
    localStorage.setItem('removedDepts', JSON.stringify(updated));
    setDepartments(departments.filter(d => d.toLowerCase() !== deptToRemove.toLowerCase()));
  };

  const handleRemoveDesig = (desigToRemove) => {
    const updated = [...removedDesigs, desigToRemove.toLowerCase()];
    setRemovedDesigs(updated);
    localStorage.setItem('removedDesigs', JSON.stringify(updated));
    setDesignations(designations.filter(d => d.toLowerCase() !== desigToRemove.toLowerCase()));
  };

  const [formStep, setFormStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [docFiles, setDocFiles] = useState({
    aadharCard: null,
    panCard: null,
    markSheet10: null,
    markSheet12: null,
    graduation: null,
    otherDocs: null
  });
  const [showShiftConfigModal, setShowShiftConfigModal] = useState(false);
  const [configTab, setConfigTab] = useState('shift'); // 'shift' or 'attendance'
  const [attendanceConfig, setAttendanceConfig] = useState({
    markLateAfter: 0.25,
    markHalfdayAfter: 2,
    markAbsentAfter: 4
  });
  const [shiftConfigs, setShiftConfigs] = useState([
    {
      id: 1,
      name: 'Morning Shift',
      type: 'morning',
      startTime: '09:00 AM',
      endTime: '06:00 PM',
      isActive: true
    },
    {
      id: 2,
      name: 'Noon Shift',
      type: 'noon',
      startTime: '12:00 PM',
      endTime: '09:00 PM',
      isActive: true
    },
    {
      id: 3,
      name: 'Evening Shift',
      type: 'evening',
      startTime: '03:00 PM',
      endTime: '12:00 AM',
      isActive: true
    },
    {
      id: 4,
      name: 'Night Shift',
      type: 'night',
      startTime: '10:00 PM',
      endTime: '07:00 AM',
      isActive: true
    }
  ]);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    employeeId: "",
    role: "",
    department: "",
    designation: "",
    phone: "",
    gender: "",
    assignedManager: "",
    // Additional Info
    joiningDate: "",
    dateOfBirth: "",
    fatherName: "",
    highestQualification: "",
    alternatePhone: "",
    officialEmail: "",
    aadharNumber: "",
    currentAddress: "",
    permanentAddress: "",
    // Shift Timing
    shiftStartTime: "",
    shiftEndTime: "",
    shiftType: "",
    // Banking Details
    bankName: "",
    accountNumber: "",
    ifscCode: "",
    accountHolderName: "",
    panNumber: "",
    upiId: "",
    // Documents
    aadharCard: "",
    panCard: "",
    markSheet10: "",
    markSheet12: "",
    graduation: "",
    otherDocs: "",
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    developers: 0,
    sales: 0,
    newJoinees: 0,
    changes: {
      total: 0,
      active: 0,
      inactive: 0,
      developers: 0,
      sales: 0,
      newJoinees: 0
    }
  });

  // Real-time Employee ID existence check for Add Employee modal
  const existingEmpForAddId = useMemo(() => {
    if (!formData.employeeId) return null;
    const rawNum = formData.employeeId.replace(/^EMP/i, '').replace(/\D/g, '');
    if (!rawNum) return null;
    const paddedId = `EMP${rawNum.padStart(3, '0')}`.toUpperCase();
    const directId = `EMP${rawNum}`.toUpperCase();
    const rawOnly = rawNum.toUpperCase();

    return employees.find(e => {
      const eid = (e.employeeId || '').toUpperCase().trim();
      return eid === paddedId || eid === directId || eid === rawOnly;
    }) || null;
  }, [formData.employeeId, employees]);

  // Real-time Employee ID existence check for Edit Employee modal
  const existingEmpForEditId = useMemo(() => {
    if (!editFormData.employeeId) return null;
    const rawNum = editFormData.employeeId.replace(/^EMP/i, '').replace(/\D/g, '');
    if (!rawNum) return null;
    const paddedId = `EMP${rawNum.padStart(3, '0')}`.toUpperCase();
    const directId = `EMP${rawNum}`.toUpperCase();
    const rawOnly = rawNum.toUpperCase();

    return employees.find(e => {
      if (selectedEmployee && (e._id === selectedEmployee._id || e.id === selectedEmployee._id)) return false;
      const eid = (e.employeeId || '').toUpperCase().trim();
      return eid === paddedId || eid === directId || eid === rawOnly;
    }) || null;
  }, [editFormData.employeeId, selectedEmployee, employees]);

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
    fetchStats();
    fetchShiftConfigs();
    fetchAttendanceConfig();
  }, []);

  useEffect(() => {
    if (!showViewModal && showClosureSide) {
      const timer = setTimeout(() => {
        setShowClosureSide(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showViewModal, showClosureSide]);

  // Fetch projects for selected employee when modal opens
  useEffect(() => {
    const fetchEmployeeProjects = async () => {
      if (!selectedEmployee) return;
      try {
        const res = await api.get('/projects');
        // Filter projects assigned to this employee
        const filtered = (res.data || []).filter(
          (p) =>
            p.assignedEmployees &&
            p.assignedEmployees.some(
              (emp) => emp._id === selectedEmployee._id || emp === selectedEmployee._id
            )
        );
        setEmployeeProjects(filtered);
      } catch (err) {
        setEmployeeProjects([]);
      }
    };
    if (showViewModal && selectedEmployee) fetchEmployeeProjects();
  }, [showViewModal, selectedEmployee]);

  useEffect(() => {
    if (!openMenuId && !showDeptDd && !showDesigDd && !showRoleFilterDd && !showDeptFilterDd && !showShiftConfigModal && !showAddRoleDd && !showEditRoleDd && !showAddShiftDd && !showEditShiftDd) return;
    const close = (e) => {
      // Don't close if clicking on the shift config button or its children
      if (e.target.closest('[data-shift-config-button]') || e.target.closest('[data-shift-config-panel]')) {
        return;
      }
      setOpenMenuId(null);
      setShowDeptDd(false);
      setShowDesigDd(false);
      setShowRoleFilterDd(false);
      setShowAddRoleDd(false);
      setShowEditRoleDd(false);
      setShowAddShiftDd(false);
      setShowEditShiftDd(false);
      setShowAddManagerDd(false);
      setShowEditManagerDd(false);
      setShowAddGenderDd(false);
      setShowEditGenderDd(false);
      setShowDeptFilterDd(false);
      setShowStatusFilterDd(false);
      setShowShiftConfigModal(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openMenuId, showDeptDd, showDesigDd, showRoleFilterDd, showDeptFilterDd, showStatusFilterDd, showShiftConfigModal, showAddRoleDd, showEditRoleDd, showAddShiftDd, showEditShiftDd, showAddManagerDd, showEditManagerDd, showAddGenderDd, showEditGenderDd]);

  const handleOverlayClick = (e, closeFn) => {
    if (e.target === e.currentTarget) {
      const isAnyDropdownOpen = showDeptDd || showDesigDd || showRoleFilterDd || showDeptFilterDd || showAddRoleDd || showEditRoleDd || showAddShiftDd || showEditShiftDd || showAddManagerDd || showEditManagerDd || showAddGenderDd || showEditGenderDd || showStatusFilterDd || openMenuId;
      if (isAnyDropdownOpen) {
        return;
      }
      closeFn();
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/employees/stats");
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchShiftConfigs = async () => {
    if (!canUpdateEmployee && !canCreateEmployee) return;
    try {
      const response = await api.get("/shift-configs");
      console.log('Fetched shift configs:', response.data);

      // Convert backend data to frontend format
      const configs = response.data.map((config, index) => ({
        id: index + 1,
        name: config.name,
        type: config.type,
        startTime: config.startTime,
        endTime: config.endTime,
        lunchTime: config.lunchTime || '01:00 PM',
        teaTime: config.teaTime || '04:00 PM',
        isActive: config.isActive,
        weekoff: config.weekoff || 1
      }));

      setShiftConfigs(configs);
    } catch (error) {
      console.error("Error fetching shift configurations:", error);
      // Keep default configurations if fetch fails
    }
  };

  const fetchAttendanceConfig = async () => {
    if (!canUpdateEmployee && !canCreateEmployee) return;
    try {
      const response = await api.get("/attendance-configs");
      console.log('Fetched attendance config:', response.data);
      setAttendanceConfig({
        markLateAfter: response.data.markLateAfter,
        checkoutGracePeriod: response.data.checkoutGracePeriod !== undefined ? response.data.checkoutGracePeriod : 20
      });
    } catch (error) {
      console.error("Error fetching attendance configuration:", error);
    }
  };

  const saveAttendanceConfig = async () => {
    if (!canUpdateEmployee) return;
    try {
      console.log('Saving attendance configuration:', attendanceConfig);

      const response = await api.put("/attendance-configs", attendanceConfig);
      console.log('Attendance configuration saved successfully:', response.data);

      alert('Attendance configuration saved successfully!');

      // Refresh the configuration to get the latest data
      await fetchAttendanceConfig();
    } catch (error) {
      console.error('Error saving attendance configuration:', error);
      alert(error.response?.data?.message || 'Error saving attendance configuration. Please try again.');
    }
  };

  const addNewShift = () => {
    const newShift = {
      id: shiftConfigs.length + 1,
      name: '',
      type: `custom_${Date.now()}`, // Unique type for custom shifts
      startTime: '09:00 AM',
      endTime: '06:00 PM',
      lunchTime: '01:00 PM',
      teaTime: '04:00 PM',
      isActive: true
    };
    setShiftConfigs([...shiftConfigs, newShift]);
  };

  const removeShift = (shiftId) => {
    if (shiftConfigs.length <= 1) {
      alert('At least one shift configuration is required.');
      return;
    }
    if (window.confirm('Are you sure you want to remove this shift?')) {
      setShiftConfigs(shiftConfigs.filter(shift => shift.id !== shiftId));
    }
  };

  const saveShiftConfigs = async () => {
    if (!canUpdateEmployee) return;
    try {
      console.log('Saving shift configurations:', shiftConfigs);

      const configsToSave = shiftConfigs.map(config => ({
        ...config,
        type: config.type,
        name: config.name,
        startTime: config.startTime,
        endTime: config.endTime,
        lunchTime: config.lunchTime || config.lunchStartTime || '01:00 PM',
        lunchStartTime: config.lunchStartTime,
        lunchEndTime: config.lunchEndTime,
        teaTime: config.teaTime || config.refreshment1StartTime || '04:00 PM',
        refreshment1StartTime: config.refreshment1StartTime,
        refreshment1EndTime: config.refreshment1EndTime,
        refreshment2StartTime: config.refreshment2StartTime,
        refreshment2EndTime: config.refreshment2EndTime,
        allowLunchAnytime: Boolean(config.allowLunchAnytime),
        allowRefreshment1Anytime: Boolean(config.allowRefreshment1Anytime),
        allowRefreshment2Anytime: Boolean(config.allowRefreshment2Anytime),
        isActive: config.isActive,
        weekoff: config.weekoff || 1
      }));

      const response = await api.put("/shift-configs/bulk", { configs: configsToSave });
      console.log('Shift configurations saved successfully:', response.data);

      alert('Shift configurations saved successfully!');
      setShowShiftConfigModal(false);

      // Refresh the configurations to get the latest data
      await fetchShiftConfigs();
    } catch (error) {
      console.error('Error saving shift configurations:', error);
      alert('Error saving shift configurations. Please try again.');
    }
  };

  const fetchEmployees = async () => {
    if (!canReadEmployee) {
      setLoading(false);
      return;
    }
    try {
      const response = await api.get("/employees");
      console.log('========== FETCH EMPLOYEES ==========');
      console.log('First employee shift data:', {
        shiftStartTime: response.data[0]?.shiftStartTime,
        shiftEndTime: response.data[0]?.shiftEndTime,
        shiftType: response.data[0]?.shiftType
      });
      console.log('=====================================');

      setEmployees(response.data);
      setLoading(false);

      // Fetch latest removed from localStorage directly in case state is stale
      const localRemovedDepts = (() => { try { return JSON.parse(localStorage.getItem('removedDepts')) || []; } catch (e) { return []; } })();
      const localRemovedDesigs = (() => { try { return JSON.parse(localStorage.getItem('removedDesigs')) || []; } catch (e) { return []; } })();

      // Extract unique departments from employees and include default options
      const predefinedDepts = ["IT", "Sales", "HR/Manager"];
      const extractedDepts = response.data.map((emp) => emp.department).filter(Boolean);
      const allDepts = [...predefinedDepts, ...extractedDepts];
      const uniqueDeptsMap = new Map();
      allDepts.forEach(d => {
        if (!uniqueDeptsMap.has(d.toLowerCase()) && !localRemovedDepts.includes(d.toLowerCase())) {
          uniqueDeptsMap.set(d.toLowerCase(), d);
        }
      });
      setDepartments(Array.from(uniqueDeptsMap.values()).sort());

      // Extract unique designations from employees
      const extractedDesignations = response.data.map((emp) => emp.designation).filter(Boolean);
      const uniqueDesigMap = new Map();
      extractedDesignations.forEach(d => {
        if (!uniqueDesigMap.has(d.toLowerCase()) && !localRemovedDesigs.includes(d.toLowerCase())) {
          uniqueDesigMap.set(d.toLowerCase(), d);
        }
      });
      setDesignations(Array.from(uniqueDesigMap.values()).sort());

    } catch (error) {
      console.error("Error fetching employees:", error);
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    if (!canReadEmployee) return;
    try {
      console.log("Fetching roles from /roles/list...");
      const response = await api.get("/roles/list");
      console.log("Roles API response:", response.data);

      if (response.data && Array.isArray(response.data)) {
        setRoles(response.data);
        console.log(`Successfully loaded ${response.data.length} roles:`, response.data.map(r => r.name));
      } else {
        console.warn("Invalid roles data format received:", response.data);
        setRoles([]);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
      console.error("Error details:", error.response?.data || error.message);

      // Show user-friendly error message
      if (error.response?.status === 404) {
        console.warn("Roles endpoint not found. Please ensure the roles module is properly configured.");
      } else if (error.response?.status === 403) {
        console.warn("Access denied to roles. Please check user permissions.");
      } else {
        console.warn("Failed to load roles. Please check your connection and try again.");
      }

      // Set empty array to avoid undefined errors
      setRoles([]);
    }
  };

  const nextStep = (e) => {
    if (e) e.preventDefault();
    if (formStep === 1) {
      if (!formData.firstName || !formData.email || !formData.password || !formData.employeeId || !formData.role || !formData.department || !formData.designation || !formData.phone || !formData.gender) {
        alert("Please fill all required fields in Basic Information.");
        return;
      }
      if (existingEmpForAddId) {
        alert(`Employee ID ${formData.employeeId} is already assigned to ${existingEmpForAddId.firstName} ${existingEmpForAddId.lastName}. Please enter a unique Employee ID.`);
        return;
      }
      // Auto pad Employee ID to at least 3 digits (e.g. 1 -> 001, 12 -> 012, 100 -> 100)
      const rawNum = formData.employeeId.replace(/^EMP/i, '').replace(/\D/g, '');
      if (rawNum) {
        setFormData(prev => ({ ...prev, employeeId: `EMP${rawNum.padStart(3, '0')}` }));
      }
      if (!formData.shiftType) {
        alert("Please select a Shift Type.");
        return;
      }
    }
    setFormStep(prev => prev + 1);
  };

  const prevStep = () => {
    setFormStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (existingEmpForAddId) {
      alert(`Employee ID ${formData.employeeId} is already assigned to another employee. Please enter a unique Employee ID.`);
      return;
    }
    if (!formData.shiftType) {
      alert("Please select a Shift Type.");
      return;
    }
    setIsSubmitting(true);
    try {
      const data = new FormData();
      // Ensure formatted Employee ID
      const finalFormData = { ...formData };
      const rawNum = finalFormData.employeeId ? finalFormData.employeeId.replace(/^EMP/i, '').replace(/\D/g, '') : '';
      if (rawNum) {
        finalFormData.employeeId = `EMP${rawNum.padStart(3, '0')}`;
      }

      // Append basic fields and bank details
      Object.keys(finalFormData).forEach(key => {
        // Only append if it's not a placeholder for documents in formData
        if (!['aadharCard', 'panCard', 'markSheet10', 'markSheet12', 'graduation', 'otherDocs'].includes(key)) {
          if ((key === 'joiningDate' || key === 'dateOfBirth') && finalFormData[key] === "") {
            // Skip empty dates to let backend use defaults
          } else {
            data.append(key, finalFormData[key]);
          }
        }
      });
      // Append actual files from docFiles state
      Object.keys(docFiles).forEach(key => {
        if (docFiles[key]) {
          data.append(key, docFiles[key]);
        }
      });

      if (!canCreateEmployee) return;
      await api.post("/employees", data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setShowModal(false);
      setFormStep(1);
      setFormData({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        employeeId: "",
        role: "",
        department: "",
        designation: "",
        phone: "",
        gender: "",
        // Additional Info
        joiningDate: "",
        dateOfBirth: "",
        fatherName: "",
        highestQualification: "",
        alternatePhone: "",
        officialEmail: "",
        aadharNumber: "",
        currentAddress: "",
        permanentAddress: "",
        // Shift Timing
        shiftStartTime: "",
        shiftEndTime: "",
        shiftType: "",
        // Banking Details
        bankName: "",
        accountNumber: "",
        ifscCode: "",
        accountHolderName: "",
        panNumber: "",
        upiId: "",
        aadharCard: "",
        panCard: "",
        markSheet10: "",
        markSheet12: "",
        graduation: "",
        otherDocs: "",
      });
      setDocFiles({
        aadharCard: null,
        panCard: null,
        markSheet10: null,
        markSheet12: null,
        graduation: null,
        otherDocs: null
      });
      fetchEmployees();
      alert("Employee added successfully!");
    } catch (error) {
      alert(error.response?.data?.message || "Error creating employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (id) => {
    if (!canDeleteEmployee) return;
    if (!window.confirm('Are you sure you want to permanently delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      fetchEmployees();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting employee');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    if (!canUpdateEmployee) return;

    if (currentStatus) { // Employee is currently active, so we want to deactivate
      setDeactivateEmployeeData(id);
      setDeactivateFormData({
        lastWorkingDay: '',
        leavingType: '',
        reason: '',
        exitFormalities: '',
        handover: '',
        handoverTo: '',
        handoverToOther: '',
        handoverReason: ''
      });
      setShowDeactivateModal(true);
      return;
    }

    // Activating employee
    const confirmMessage = 'Are you sure you want to activate this employee? They will be able to login to the system.';
    if (!window.confirm(confirmMessage)) return;

    try {
      await api.put(`/employees/${id}`, { isActive: true });
      alert('Employee activated successfully. They can now login to the system.');
      fetchEmployees();
    } catch (error) {
      alert(error.response?.data?.message || 'Error activating employee. Please try again.');
    }
  };

  const submitDeactivate = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const addedByStr = user ? (user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim()) : 'Admin';

      const finalHandoverTo = deactivateFormData.handoverTo === 'Other' ? deactivateFormData.handoverToOther : deactivateFormData.handoverTo;

      const payload = {
        isActive: false,
        deactivationDetails: {
          ...deactivateFormData,
          handoverTo: finalHandoverTo,
          addedBy: addedByStr
        }
      };

      await api.put(`/employees/${deactivateEmployeeData}`, payload);
      alert('Employee deactivated successfully. They can no longer login to the system.');
      setShowDeactivateModal(false);
      fetchEmployees();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deactivating employee. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update access modules in backend
  const updateAccessModulesAPI = async (newModules) => {
    setAccessModules(newModules);
    if (!selectedEmployee) return;
    try {
      await api.put(`/employees/${selectedEmployee._id}`, { accessModules: newModules });
      setSelectedEmployee({ ...selectedEmployee, accessModules: newModules });
      setEmployees(employees.map(emp => emp._id === selectedEmployee._id ? { ...emp, accessModules: newModules } : emp));
    } catch (err) {
      console.error("Failed to update access modules:", err);
      // Optional: Add a toast notification here
    }
  };

  // View employee details
  const handleViewEmployee = (employee) => {
    setSelectedEmployee(employee);
    setViewModalTab("info");
    setShowClosureSide(false);
    setShowAccessControl(false);
    setAccessModules(employee.accessModules || []);
    setIsAddingModule(false);
    setEditingModuleId(null);
    setShowViewModal(true);
  };

  // Open edit modal
  const handleEditEmployee = (employee) => {
    setEditFormData({
      firstName: employee.firstName || "",
      lastName: employee.lastName || "",
      email: employee.email || "",
      employeeId: employee.employeeId || "",
      role: employee.role?._id || "",
      department: employee.department || "",
      designation: employee.designation || "",
      phone: employee.phone || "",
      gender: employee.gender || "",
      assignedManager: employee.assignedManager?._id || employee.assignedManager || "",
      // Additional Info
      joiningDate: employee.joiningDate || "",
      dateOfBirth: employee.dateOfBirth || "",
      fatherName: employee.fatherName || "",
      highestQualification: employee.highestQualification || "",
      alternatePhone: employee.alternatePhone || "",
      officialEmail: employee.officialEmail || "",
      aadharNumber: employee.aadharNumber || "",
      currentAddress: employee.currentAddress || "",
      permanentAddress: employee.permanentAddress || "",
      // Shift Timing
      shiftStartTime: employee.shiftStartTime || (employee.shiftType ? shiftConfigs.find(c => c.type === employee.shiftType)?.startTime : "") || "",
      shiftEndTime: employee.shiftEndTime || (employee.shiftType ? shiftConfigs.find(c => c.type === employee.shiftType)?.endTime : "") || "",
      shiftType: employee.shiftType || "",
      // Banking Details
      bankName: employee.bankName || "",
      accountNumber: employee.accountNumber || "",
      ifscCode: employee.ifscCode || "",
      accountHolderName: employee.accountHolderName || "",
      panNumber: employee.panNumber || "",
      upiId: employee.upiId || "",
    });
    setSelectedEmployee(employee);
    setShowEditModal(true);
  };

  // Open edit closure modal
  const handleEditClosure = (employee) => {
    setDeactivateEmployeeData(employee._id);
    const details = employee.deactivationDetails || {};

    // Check if handoverTo is one of the standard options or 'Other'
    // Since the dropdown handles 'Other', we can just set it directly if it exists
    const isStandardOption = false; // We could check against employees list, but simplest is to just assign it

    setDeactivateFormData({
      lastWorkingDay: details.lastWorkingDay ? new Date(details.lastWorkingDay).toISOString().split('T')[0] : '',
      leavingType: details.leavingType || '',
      reason: details.reason || '',
      exitFormalities: details.exitFormalities || '',
      handover: details.handover || '',
      handoverTo: details.handoverTo || '',
      handoverToOther: '',
      handoverReason: details.handoverReason || ''
    });
    setShowDeactivateModal(true);
  };

  // Open change password modal
  const handleChangePassword = (employee) => {
    setSelectedEmployeeForPassword(employee);
    setPasswordData({
      newPassword: '',
      confirmPassword: ''
    });
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowChangePasswordModal(true);
  };

  // Submit change password
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert("Password must be at least 6 characters long!");
      return;
    }

    try {
      await api.put(`/employees/${selectedEmployeeForPassword._id}/change-password`, {
        newPassword: passwordData.newPassword
      });

      setShowChangePasswordModal(false);
      setSelectedEmployeeForPassword(null);
      setPasswordData({
        newPassword: '',
        confirmPassword: ''
      });
      alert("Password changed successfully!");
    } catch (error) {
      alert(error.response?.data?.message || "Error changing password");
    }
  };

  // Submit edit form
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.shiftType) {
      alert("Please select a Shift Type.");
      return;
    }
    if (existingEmpForEditId) {
      alert(`Employee ID ${editFormData.employeeId} is already assigned to ${existingEmpForEditId.firstName} ${existingEmpForEditId.lastName}. Please enter a unique Employee ID.`);
      return;
    }
    try {
      console.log('========== FRONTEND EDIT SUBMIT ==========');

      const payload = { ...editFormData };
      // Format employeeId if needed (min 3 digits)
      const rawNum = payload.employeeId ? payload.employeeId.replace(/^EMP/i, '').replace(/\D/g, '') : '';
      if (rawNum) {
        payload.employeeId = `EMP${rawNum.padStart(3, '0')}`;
      }
      if (payload.joiningDate === "") payload.joiningDate = null;
      if (payload.dateOfBirth === "") payload.dateOfBirth = null;
      if (payload.assignedManager === "") payload.assignedManager = null;

      console.log('Sending payload:', JSON.stringify(payload, null, 2));
      console.log('Shift timing being sent:');
      console.log('- shiftStartTime:', payload.shiftStartTime);
      console.log('- shiftEndTime:', payload.shiftEndTime);
      console.log('- shiftType:', payload.shiftType);
      console.log('==========================================');

      await api.put(`/employees/${selectedEmployee._id}`, payload);
      setShowEditModal(false);
      setSelectedEmployee(null);
      fetchEmployees();
      alert("Employee updated successfully!");
    } catch (error) {
      alert(error.response?.data?.message || "Error updating employee");
    }
  };

  const handleExportEmployee = async (employeeId, employeeName) => {
    try {
      console.log(
        `📊 Exporting data for employee: ${employeeName} (${employeeId})`
      );

      // Fetch employee data from available endpoints with error handling
      let attendanceData = [];
      let leadsData = [];
      let leavesData = [];
      let dealsData = [];
      let projectsData = [];

      try {
        const attendanceRes = await api.get(
          `/attendance?employeeId=${employeeId}`
        );
        attendanceData = Array.isArray(attendanceRes.data)
          ? attendanceRes.data
          : [];
        console.log(`✓ Attendance: ${attendanceData.length} records`);
      } catch (err) {
        console.log("⚠ Attendance data not available:", err.message);
      }

      try {
        const leavesRes = await api.get(`/leaves?employeeId=${employeeId}`);
        leavesData = Array.isArray(leavesRes.data) ? leavesRes.data : [];
        console.log(`✓ Leaves: ${leavesData.length} records`);
      } catch (err) {
        console.log("⚠ Leaves data not available:", err.message);
      }

      try {
        // Get assigned leads for this employee
        const leadsRes = await api.get(
          `/lead-assignments/my-leads?employeeId=${employeeId}`
        );
        leadsData = Array.isArray(leadsRes.data) ? leadsRes.data : [];
        console.log(`✓ Leads: ${leadsData.length} records`);
      } catch (err) {
        console.log("⚠ Leads data not available:", err.message);
      }

      try {
        const dealsRes = await api.get(`/deals`);
        // Filter deals by assigned employee
        dealsData = Array.isArray(dealsRes.data)
          ? dealsRes.data.filter(
            (d) =>
              d.assignedTo &&
              (d.assignedTo._id === employeeId || d.assignedTo === employeeId)
          )
          : [];
        console.log(`✓ Deals: ${dealsData.length} records`);
      } catch (err) {
        console.log("⚠ Deals data not available:", err.message);
      }

      try {
        const projectsRes = await api.get(`/projects`);
        // Filter projects by assigned employees
        projectsData = Array.isArray(projectsRes.data)
          ? projectsRes.data.filter(
            (p) =>
              p.assignedEmployees &&
              p.assignedEmployees.some(
                (emp) => emp._id === employeeId || emp === employeeId
              )
          )
          : [];
        console.log(`✓ Projects: ${projectsData.length} records`);
      } catch (err) {
        console.log("⚠ Projects data not available:", err.message);
      }

      // Create PDF document
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let yPosition = 20;
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const lineHeight = 7;

      // Helper function to add new page if needed
      const addNewPageIfNeeded = (spaceNeeded) => {
        if (yPosition + spaceNeeded > pageHeight - 10) {
          pdf.addPage();
          yPosition = 20;
        }
      };

      // Title
      pdf.setFontSize(16);
      pdf.setFont(undefined, "bold");
      pdf.text("Employee Report", margin, yPosition);
      yPosition += 12;

      // Employee Info Header
      pdf.setFontSize(11);
      pdf.setFont(undefined, "bold");
      pdf.text(`Name: ${employeeName}`, margin, yPosition);
      yPosition += lineHeight;
      pdf.setFont(undefined, "normal");
      pdf.setFontSize(9);
      pdf.text(
        `Generated: ${new Date().toLocaleDateString("en-IN")}`,
        margin,
        yPosition
      );
      yPosition += 12;

      // Attendance Section - Only if data exists
      if (attendanceData.length > 0) {
        addNewPageIfNeeded(20);
        pdf.setFontSize(12);
        pdf.setFont(undefined, "bold");
        pdf.text("Attendance Records", margin, yPosition);
        yPosition += 8;

        pdf.setFont(undefined, "normal");
        pdf.setFontSize(8);
        const attendanceTableData = attendanceData.map((att) => [
          att.date ? new Date(att.date).toLocaleDateString("en-IN") : "N/A",
          att.status === "present"
            ? "Present"
            : att.status === "absent"
              ? "Absent"
              : "Half-day",
          att.workingHours ? att.workingHours.toString() : "0",
        ]);

        if (attendanceTableData.length > 0) {
          autoTable(pdf, {
            startY: yPosition,
            head: [["Date", "Status", "Hours"]],
            body: attendanceTableData,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: {
              fillColor: [41, 128, 185],
              textColor: 255,
              fontStyle: "bold",
            },
          });
          yPosition = pdf.lastAutoTable.finalY + 8;
        }
      }

      // Leaves Section - Only if data exists
      if (leavesData.length > 0) {
        addNewPageIfNeeded(20);
        pdf.setFontSize(12);
        pdf.setFont(undefined, "bold");
        pdf.text("Leave Applications", margin, yPosition);
        yPosition += 8;

        pdf.setFont(undefined, "normal");
        pdf.setFontSize(8);
        const leaveTableData = leavesData.map((leave) => [
          leave.startDate
            ? new Date(leave.startDate).toLocaleDateString("en-IN")
            : "N/A",
          leave.endDate
            ? new Date(leave.endDate).toLocaleDateString("en-IN")
            : "N/A",
          leave.leaveType || "N/A",
          leave.status || "Pending",
        ]);

        if (leaveTableData.length > 0) {
          autoTable(pdf, {
            startY: yPosition,
            head: [["Start", "End", "Type", "Status"]],
            body: leaveTableData,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: {
              fillColor: [46, 204, 113],
              textColor: 255,
              fontStyle: "bold",
            },
          });
          yPosition = pdf.lastAutoTable.finalY + 8;
        }
      }

      // Assigned Leads Section - Only if data exists
      if (leadsData.length > 0) {
        addNewPageIfNeeded(20);
        pdf.setFontSize(12);
        pdf.setFont(undefined, "bold");
        pdf.text("Assigned Leads/Clients", margin, yPosition);
        yPosition += 8;

        pdf.setFont(undefined, "normal");
        pdf.setFontSize(8);
        const leadsTableData = leadsData.map((lead) => [
          lead.leadName || "N/A",
          lead.contactNumber || "N/A",
          lead.email || "N/A",
          lead.status || "New",
        ]);

        if (leadsTableData.length > 0) {
          autoTable(pdf, {
            startY: yPosition,
            head: [["Lead Name", "Contact", "Email", "Status"]],
            body: leadsTableData,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: {
              fillColor: [241, 196, 15],
              textColor: 0,
              fontStyle: "bold",
            },
          });
          yPosition = pdf.lastAutoTable.finalY + 8;
        }
      }

      // Deals Section - Only if data exists
      if (dealsData.length > 0) {
        addNewPageIfNeeded(20);
        pdf.setFontSize(12);
        pdf.setFont(undefined, "bold");
        pdf.text("Deals", margin, yPosition);
        yPosition += 8;

        pdf.setFont(undefined, "normal");
        pdf.setFontSize(8);
        const dealsTableData = dealsData.map((deal) => [
          deal.dealName || "N/A",
          deal.dealValue ? `₹${deal.dealValue.toLocaleString()}` : "N/A",
          deal.stage || "N/A",
          deal.status || "Active",
        ]);

        if (dealsTableData.length > 0) {
          autoTable(pdf, {
            startY: yPosition,
            head: [["Deal Name", "Value", "Stage", "Status"]],
            body: dealsTableData,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: {
              fillColor: [230, 126, 34],
              textColor: 255,
              fontStyle: "bold",
            },
          });
          yPosition = pdf.lastAutoTable.finalY + 8;
        }
      }

      // Projects Section - Only if data exists
      if (projectsData.length > 0) {
        addNewPageIfNeeded(20);
        pdf.setFontSize(12);
        pdf.setFont(undefined, "bold");
        pdf.text("Projects", margin, yPosition);
        yPosition += 8;

        pdf.setFont(undefined, "normal");
        pdf.setFontSize(8);
        const projectsTableData = projectsData.map((project) => [
          project.name || "N/A",
          project.status || "Active",
          project.deadline
            ? new Date(project.deadline).toLocaleDateString("en-IN")
            : "N/A",
        ]);

        if (projectsTableData.length > 0) {
          autoTable(pdf, {
            startY: yPosition,
            head: [["Project Name", "Status", "Deadline"]],
            body: projectsTableData,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: {
              fillColor: [155, 89, 182],
              textColor: 255,
              fontStyle: "bold",
            },
          });
          yPosition = pdf.lastAutoTable.finalY + 8;
        }
      }

      // Summary Section
      addNewPageIfNeeded(10);
      pdf.setFontSize(11);
      pdf.setFont(undefined, "bold");
      pdf.text("Summary", margin, yPosition);
      yPosition += 8;
      pdf.setFont(undefined, "normal");
      pdf.setFontSize(9);

      const summaryData = [
        ["Attendance Records", attendanceData.length],
        ["Leave Applications", leavesData.length],
        ["Assigned Leads", leadsData.length],
        ["Deals", dealsData.length],
        ["Projects", projectsData.length],
      ];

      autoTable(pdf, {
        startY: yPosition,
        head: [["Item", "Count"]],
        body: summaryData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: {
          fillColor: [52, 73, 94],
          textColor: 255,
          fontStyle: "bold",
        },
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setFont(undefined, "italic");
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
          align: "center",
        });
      }

      // Download PDF
      const filename = `${employeeName.replace(/\s+/g, "_")}_Report_${new Date().toISOString().split("T")[0]
        }.pdf`;
      pdf.save(filename);
      console.log(`✓ PDF exported: ${filename}`);
      alert("Report downloaded successfully!");
    } catch (error) {
      console.error("❌ Error exporting employee data:", error);
      alert("Error generating report. Please try again.");
    }
  };

  // Filter employees based on selected role, department, and search term
  // Helper function to render trend indicator
  const renderTrend = (change) => {
    // Handle undefined or null values
    if (change === undefined || change === null) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8', fontWeight: '500' }}>calculating...</span>
        </div>
      );
    }

    const isPositive = change >= 0;
    const color = isPositive ? '#22c55e' : '#ef4444';
    const arrow = isPositive ? (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px' }}>
        <polyline points="18 15 12 9 6 15" />
      </svg>
    ) : (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '2px' }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '4px' }}>
        <span style={{ color, display: 'flex', alignItems: 'center', fontWeight: '600' }}>
          {arrow}
          {isPositive ? '+' : ''}{change}%
        </span>
        <span style={{ color: '#94a3b8', fontWeight: '500' }}>from last month</span>
      </div>
    );
  };

  const filteredEmployees = employees.filter((employee) => {
    const roleMatch = !filterRole || employee.role?._id === filterRole;
    const deptMatch =
      !filterDepartment || employee.department === filterDepartment;

    const query = (searchTerm || '').trim().toLowerCase();
    const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.trim().toLowerCase();
    const empId = String(employee.employeeId || '').toLowerCase();
    const customEmpId = String(employee.customEmployeeId || '').toLowerCase();
    const email = String(employee.email || '').toLowerCase();
    const officialEmail = String(employee.officialEmail || '').toLowerCase();
    const phone = String(employee.phone || employee.contactNumber || employee.mobile || '').toLowerCase();
    const dept = String(employee.department || '').toLowerCase();
    const desig = String(employee.designation || '').toLowerCase();
    const roleName = String(employee.role?.name || '').toLowerCase();

    const nameMatch =
      !query ||
      fullName.includes(query) ||
      empId.includes(query) ||
      customEmpId.includes(query) ||
      email.includes(query) ||
      officialEmail.includes(query) ||
      phone.includes(query) ||
      dept.includes(query) ||
      desig.includes(query) ||
      roleName.includes(query);

    const statusMatch = !filterStatus || (
      filterStatus === "active" ? employee.isActive : !employee.isActive
    );

    // Quick filter logic
    let quickMatch = true;
    if (quickFilter === 'developers') {
      const rn = employee.role?.name?.toLowerCase() || '';
      quickMatch = rn.includes('developer') || rn.includes('dev');
    } else if (quickFilter === 'sales') {
      const rn = employee.role?.name?.toLowerCase() || '';
      quickMatch = rn.includes('sales') || rn.includes('business development') || rn.includes('bde');
    } else if (quickFilter === 'newJoinees') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const joinDate = employee.createdAt ? new Date(employee.createdAt) : new Date(employee.joiningDate);
      quickMatch = joinDate >= thirtyDaysAgo;
    }

    return roleMatch && deptMatch && nameMatch && statusMatch && quickMatch;
  });

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = filteredEmployees.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleExportListExcel = async () => {
    try {
      const response = await api.get('/employees/export/excel', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Employees_List.xlsx`;
      link.click();
    } catch (error) {
      console.error('Error exporting excel:', error);
      alert('Error exporting Excel file');
    }
  };

  const handleExportListWord = async () => {
    try {
      const response = await api.get('/employees/export/word', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Employees_List.docx`;
      link.click();
    } catch (error) {
      console.error('Error exporting word:', error);
      alert('Error exporting Word file');
    }
  };

  const handleExportListPDF = async () => {
    try {
      const response = await api.get('/employees/export/pdf', { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Employees_List.pdf`;
      link.click();
      window.URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF file');
    }
  };

  if (loading) return (
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .skel { background: linear-gradient(90deg, #f1f5f9 25%, #e9eef5 50%, #f1f5f9 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: 8px; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div className="skel" style={{ width: '170px', height: '28px', marginBottom: '8px' }} />
          <div className="skel" style={{ width: '280px', height: '13px' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="skel" style={{ width: '110px', height: '36px', borderRadius: '10px' }} />
          <div className="skel" style={{ width: '110px', height: '36px', borderRadius: '10px' }} />
          <div className="skel" style={{ width: '90px', height: '36px', borderRadius: '10px' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '16px' }}>
            <div className="skel" style={{ width: '80px', height: '12px', marginBottom: '10px' }} />
            <div className="skel" style={{ width: '56px', height: '28px', marginBottom: '8px' }} />
            <div className="skel" style={{ width: '110px', height: '10px' }} />
          </div>
        ))}
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div className="skel" style={{ width: '240px', height: '34px', borderRadius: '10px' }} />
          <div className="skel" style={{ width: '140px', height: '34px', borderRadius: '10px' }} />
          <div className="skel" style={{ width: '140px', height: '34px', borderRadius: '10px' }} />
          <div className="skel" style={{ width: '100px', height: '34px', borderRadius: '10px', marginLeft: 'auto' }} />
        </div>

        <div style={{ padding: '12px 16px' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 100px', gap: '16px', padding: '12px 0', borderBottom: i < 7 ? '1px solid #f8fafc' : 'none', alignItems: 'center' }}>
              <div>
                <div className="skel" style={{ width: '120px', height: '12px', marginBottom: '6px' }} />
                <div className="skel" style={{ width: '80px', height: '10px' }} />
              </div>
              <div className="skel" style={{ width: '90px', height: '12px' }} />
              <div className="skel" style={{ width: '100px', height: '12px' }} />
              <div className="skel" style={{ width: '110px', height: '24px', borderRadius: '999px' }} />
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <div className="skel" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                <div className="skel" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                <div className="skel" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const managerList = employees.filter(emp =>
    emp.role?.name?.toLowerCase().includes('manager') ||
    emp.role?.name?.toLowerCase().includes('team leader') ||
    emp.role?.name?.toLowerCase() === 'team leader' ||
    emp.role?.name?.toLowerCase() === 'manager'
  );

  return (
    <div className="page-container" style={{ padding: "20px", background: "#f8fafc", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif", overflow: "hidden" }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            box-sizing: border-box;
          }
          
          /* Bubble float animations */
          @keyframes bubble-float-large {
            0%   { transform: translate(0px, 0px) scale(1); }
            30%  { transform: translate(-5px, -7px) scale(1.04); }
            60%  { transform: translate(4px, -4px) scale(0.97); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          
          @keyframes bubble-float-small {
            0%   { transform: translate(0px, 0px) scale(1); }
            35%  { transform: translate(6px, -9px) scale(1.06); }
            65%  { transform: translate(-4px, -3px) scale(0.95); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 16px;
            margin-bottom: 20px;
            width: 100%;
          }
          
          /* Floating bubble effects on stat cards */
          .stats-grid > div {
            position: relative;
            overflow: hidden;
            isolation: isolate;
          }
          
          .stats-grid > div::before {
            content: '';
            position: absolute;
            z-index: 0;
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background: #667eea;
            opacity: 0.06;
            right: -26px;
            bottom: -26px;
            pointer-events: none;
            animation: bubble-float-large 5.5s ease-in-out infinite;
          }
          
          .stats-grid > div::after {
            content: '';
            position: absolute;
            z-index: 0;
            width: 54px;
            height: 54px;
            border-radius: 50%;
            background: #667eea;
            opacity: 0.04;
            right: 36px;
            bottom: -20px;
            pointer-events: none;
            animation: bubble-float-small 4.2s ease-in-out infinite;
          }
          
          /* Different bubble colors for each card */
          .stats-grid > div:nth-child(1)::before,
          .stats-grid > div:nth-child(1)::after {
            background: #3b82f6;
          }
          
          .stats-grid > div:nth-child(2)::before,
          .stats-grid > div:nth-child(2)::after {
            background: #22c55e;
          }
          
          .stats-grid > div:nth-child(3)::before,
          .stats-grid > div:nth-child(3)::after {
            background: #ef4444;
          }
          
          .stats-grid > div:nth-child(4)::before,
          .stats-grid > div:nth-child(4)::after {
            background: #8b5cf6;
          }
          
          .stats-grid > div:nth-child(5)::before,
          .stats-grid > div:nth-child(5)::after {
            background: #f59e0b;
          }
          
          .stats-grid > div:nth-child(6)::before,
          .stats-grid > div:nth-child(6)::after {
            background: #06b6d4;
          }
          
          /* Stagger bubble animations */
          .stats-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
          .stats-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
          .stats-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
          .stats-grid > div:nth-child(5)::before { animation-delay: 0.3s; }
          .stats-grid > div:nth-child(6)::before { animation-delay: 1.0s; }
          
          .stats-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
          .stats-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
          .stats-grid > div:nth-child(4)::after { animation-delay: 1.8s; }
          .stats-grid > div:nth-child(5)::after { animation-delay: 0.7s; }
          .stats-grid > div:nth-child(6)::after { animation-delay: 1.4s; }

          /* ── Mobile Responsive ── */
          @media (max-width: 768px) {
            .stats-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 10px !important;
            }
            .stats-grid > div::before,
            .stats-grid > div::after {
              display: none !important;
            }
            .emp-field-row {
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }
            .emp-modal {
              max-width: 96vw !important;
              width: 96% !important;
              max-height: 92vh !important;
              border-radius: 14px !important;
            }
            .emp-modal-body {
              padding: 14px !important;
            }
            .emp-modal-hd {
              padding: 14px 16px 12px !important;
            }
            .emp-step-indicator {
              padding: 10px 16px !important;
            }
            .emp-step-indicator > div > span {
              font-size: 9px !important;
            }
            .emp-flip-container {
              max-width: 96vw !important;
              width: 96% !important;
              max-height: 92vh !important;
            }
            .emp-card-left {
              flex: 1 1 100% !important;
              min-width: 0 !important;
            }
            .emp-card-right {
              flex: 1 1 100% !important;
              min-width: 0 !important;
            }
            .shift-config-modal .emp-modal-body {
              padding: 16px !important;
            }
            .shift-config-modal .emp-modal-body > div > div {
              grid-template-columns: 1fr !important;
              gap: 12px !important;
            }
          }
          @media (max-width: 480px) {
            .stats-grid {
              grid-template-columns: 1fr !important;
            }
            .emp-modal {
              max-width: 98vw !important;
              width: 98% !important;
              border-radius: 12px !important;
            }
            .emp-modal-body {
              padding: 12px !important;
            }
          }

          /* Shift Configuration Modal Styles */
          .shift-config-modal {
            animation: modalSlideIn 0.3s ease-out;
          }
          
          @keyframes modalSlideIn {
            from {
              opacity: 0;
              transform: translateY(-20px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes shiftConfigSlideIn {
            from {
              opacity: 0;
              transform: translateY(-10px) scale(0.95);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          
          .shift-config-modal .emp-modal-body {
            max-height: 70vh;
            overflow-y: auto;
          }
          
          .shift-config-modal .emp-modal-body::-webkit-scrollbar {
            width: 6px;
          }
          
          .shift-config-modal .emp-modal-body::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 3px;
          }
          
          .shift-config-modal .emp-modal-body::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 3px;
          }
          
          .shift-config-modal .emp-modal-body::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}
      </style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px', position: 'relative' }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#0f172a", margin: 0, letterSpacing: "-0.025em" }}>Employee Management</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>Manage and monitor all employees in the organization</p>
        </div>

        {/* Configuration Button */}
        {(canCreateEmployee || canUpdateEmployee) && (
          <div style={{ position: 'relative' }}>
            {console.log('Rendering config button, showShiftConfigModal:', showShiftConfigModal)}
            <button
              data-shift-config-button="true"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Button clicked, current state:', showShiftConfigModal);
                setShowShiftConfigModal(!showShiftConfigModal);
              }}
              style={{
                padding: '8px 18px',
                border: 'none',
                borderRadius: '8px',
                background: showShiftConfigModal
                  ? 'linear-gradient(135deg, #2d5a42 0%, #4a7c59 100%)'
                  : 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
                fontFamily: "'Inter', sans-serif"
              }}
              onMouseEnter={(e) => {
                if (!showShiftConfigModal) {
                  e.currentTarget.style.opacity = '0.92';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!showShiftConfigModal) {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}
              title="Configure shift settings and thresholds"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Configuration
            </button>

            {/* Shift Configuration Dropdown Panel */}
            {showShiftConfigModal && (
              <div
                data-shift-config-panel="true"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '600px',
                  maxWidth: '90vw',
                  background: '#fff',
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                  zIndex: 1000,
                  animation: 'shiftConfigSlideIn 0.3s ease-out',
                  border: '1px solid #e2e8f0'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{
                  padding: '20px 24px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                      Configuration
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                      Configure shift timings
                    </p>
                  </div>
                  <button
                    onClick={() => setShowShiftConfigModal(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '20px',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.color = '#64748b';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'none';
                      e.currentTarget.style.color = '#94a3b8';
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{
                  padding: '20px 24px',
                  maxHeight: '60vh',
                  overflowY: 'auto'
                }}>
                  {/* Shift Configuration Tab */}
                  {configTab === 'shift' && (
                    <>
                      <div style={{ display: 'grid', gap: '16px' }}>
                        {shiftConfigs.map((shift, index) => (
                          <div key={shift.id} style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '12px',
                            padding: '16px',
                            background: shift.isActive ? '#fff' : '#f8fafc',
                            transition: 'all 0.2s'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                                {/* Check if it's a predefined shift or custom shift */}
                                {['morning', 'noon', 'evening', 'night'].includes(shift.type) ? (
                                  <input
                                    type="text"
                                    value={shift.name}
                                    onChange={(e) => {
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].name = e.target.value;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    placeholder="Enter shift name"
                                    style={{
                                      background:
                                        shift.type === 'morning' ? "#fef08a" :  // Bright yellow
                                          shift.type === 'noon' ? "#3b82f6" :     // Blue
                                            shift.type === 'evening' ? "#f97316" :  // Orange
                                              shift.type === 'night' ? "#6b7280" : "#f3f4f6",  // Gray
                                      color:
                                        shift.type === 'morning' ? "#713f12" :  // Dark yellow text
                                          shift.type === 'noon' ? "#ffffff" :     // White text
                                            shift.type === 'evening' ? "#ffffff" :  // White text
                                              shift.type === 'night' ? "#ffffff" : "#6b7280",  // White text
                                      padding: "6px 12px",
                                      borderRadius: "999px",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      fontFamily: "'Inter', sans-serif",
                                      border: "none",
                                      outline: "none",
                                      minWidth: "120px",
                                      textAlign: "center"
                                    }}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={shift.name}
                                    onChange={(e) => {
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].name = e.target.value;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    placeholder="Enter shift name"
                                    style={{
                                      background: "#dcfce7", // Soft green background
                                      color: "#166534",       // Dark green text
                                      padding: "6px 12px",
                                      borderRadius: "999px",
                                      fontSize: "12px",
                                      fontWeight: "600",
                                      fontFamily: "'Inter', sans-serif",
                                      border: "1px solid #bbf7d0", // Light green border
                                      outline: "none",
                                      minWidth: "120px",
                                      textAlign: "center"
                                    }}
                                  />
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={shift.isActive}
                                    onChange={(e) => {
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].isActive = e.target.checked;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ transform: 'scale(1.1)' }}
                                  />
                                  <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>Active</span>
                                </label>
                                {shiftConfigs.length > 1 && (
                                  <button
                                    onClick={() => removeShift(shift.id)}
                                    style={{
                                      background: '#fee2e2',
                                      border: '1px solid #fecaca',
                                      borderRadius: '6px',
                                      padding: '4px 8px',
                                      fontSize: '12px',
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#fecaca';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#fee2e2';
                                    }}
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
                              {/* Start Time */}
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                                  Start Time
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: '4px' }}>
                                  <select
                                    value={parseTime12Hour(shift.startTime).hour}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.startTime);
                                      const newTime = formatTime12Hour(e.target.value, timeParts.minute, timeParts.period);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].startTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                                  >
                                    {Array.from({ length: 12 }, (_, i) => {
                                      const hour = String(i + 1).padStart(2, '0');
                                      return <option key={hour} value={hour}>{hour}</option>;
                                    })}
                                  </select>
                                  <select
                                    value={parseTime12Hour(shift.startTime).minute}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.startTime);
                                      const newTime = formatTime12Hour(timeParts.hour, e.target.value, timeParts.period);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].startTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                                  >
                                    {['00', '15', '30', '45'].map(minute => (
                                      <option key={minute} value={minute}>{minute}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={parseTime12Hour(shift.startTime).period}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.startTime);
                                      const newTime = formatTime12Hour(timeParts.hour, timeParts.minute, e.target.value);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].startTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                </div>
                              </div>

                              {/* End Time */}
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                                  End Time
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: '4px' }}>
                                  <select
                                    value={parseTime12Hour(shift.endTime).hour}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.endTime);
                                      const newTime = formatTime12Hour(e.target.value, timeParts.minute, timeParts.period);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].endTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                                  >
                                    {Array.from({ length: 12 }, (_, i) => {
                                      const hour = String(i + 1).padStart(2, '0');
                                      return <option key={hour} value={hour}>{hour}</option>;
                                    })}
                                  </select>
                                  <select
                                    value={parseTime12Hour(shift.endTime).minute}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.endTime);
                                      const newTime = formatTime12Hour(timeParts.hour, e.target.value, timeParts.period);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].endTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                                  >
                                    {['00', '15', '30', '45'].map(minute => (
                                      <option key={minute} value={minute}>{minute}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={parseTime12Hour(shift.endTime).period}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.endTime);
                                      const newTime = formatTime12Hour(timeParts.hour, timeParts.minute, e.target.value);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].endTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                </div>
                              </div>

                              {/* Weekoff */}
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                                  Weekoff
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  max="3"
                                  value={shift.weekoff || 1}
                                  onChange={(e) => {
                                    let val = parseInt(e.target.value, 10);
                                    if (isNaN(val)) val = 1;
                                    if (val < 1) val = 1;
                                    if (val > 3) val = 3;
                                    const newConfigs = [...shiftConfigs];
                                    newConfigs[index].weekoff = val;
                                    setShiftConfigs(newConfigs);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '6px 12px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>

                              {/* Lunch Time */}
                              <div>
                                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                                  Lunch Time
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: '4px' }}>
                                  <select
                                    value={parseTime12Hour(shift.lunchTime || '01:00 PM').hour}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.lunchTime || '01:00 PM');
                                      const newTime = formatTime12Hour(e.target.value, timeParts.minute, timeParts.period);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].lunchTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                                  >
                                    {Array.from({ length: 12 }, (_, i) => {
                                      const hour = String(i + 1).padStart(2, '0');
                                      return <option key={hour} value={hour}>{hour}</option>;
                                    })}
                                  </select>
                                  <select
                                    value={parseTime12Hour(shift.lunchTime || '01:00 PM').minute}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.lunchTime || '01:00 PM');
                                      const newTime = formatTime12Hour(timeParts.hour, e.target.value, timeParts.period);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].lunchTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px' }}
                                  >
                                    {['00', '15', '30', '45'].map(minute => (
                                      <option key={minute} value={minute}>{minute}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={parseTime12Hour(shift.lunchTime || '01:00 PM').period}
                                    onChange={(e) => {
                                      const timeParts = parseTime12Hour(shift.lunchTime || '01:00 PM');
                                      const newTime = formatTime12Hour(timeParts.hour, timeParts.minute, e.target.value);
                                      const newConfigs = [...shiftConfigs];
                                      newConfigs[index].lunchTime = newTime;
                                      setShiftConfigs(newConfigs);
                                    }}
                                    style={{ padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Shift Button */}
                      <div style={{ marginTop: '16px' }}>
                        <button
                          onClick={addNewShift}
                          style={{
                            width: '100%',
                            padding: '12px',
                            background: '#f8fafc',
                            border: '2px dashed #cbd5e1',
                            borderRadius: '8px',
                            color: '#64748b',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.borderColor = '#94a3b8';
                            e.currentTarget.style.color = '#475569';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f8fafc';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.color = '#64748b';
                          }}
                        >
                          + Add Shift
                        </button>
                      </div>

                      <div style={{
                        marginTop: '20px',
                        padding: '14px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0'
                      }}>
                        <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '600', color: '#374151' }}>
                          Shift Configuration Notes
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
                          <li><strong>Predefined Shifts:</strong> Morning (yellow), Noon (blue), Evening (orange), Night (gray)</li>
                          <li><strong>Custom Shifts:</strong> User-added shifts appear in soft green badges</li>
                          <li><strong>Active Shifts:</strong> Only active shifts will be available for employee assignment</li>
                          <li><strong>Shift Timing:</strong> These settings define when employees should start and end work</li>
                        </ul>
                      </div>
                    </>
                  )}

                  {/* Attendance Configuration Tab */}
                  {configTab === 'attendance' && (
                    <>
                      <div style={{ display: 'grid', gap: '20px' }}>
                        <div style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '12px',
                          padding: '20px',
                          background: '#fff'
                        }}>
                          <h4 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                            Attendance Marking Rules
                          </h4>
                          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>
                            Configure how attendance status is determined based on check-in time relative to shift start time.
                          </p>

                          <div style={{ display: 'grid', gap: '16px' }}>
                            {/* Mark Late After */}
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                Mark Late After
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {/* Hours Picker */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <select
                                      value={Math.floor(attendanceConfig.markLateAfter)}
                                      onChange={(e) => {
                                        const hours = parseInt(e.target.value);
                                        const minutes = Math.round((attendanceConfig.markLateAfter % 1) * 60);
                                        const newValue = hours + (minutes / 60);
                                        setAttendanceConfig({
                                          ...attendanceConfig,
                                          markLateAfter: newValue
                                        });
                                      }}
                                      style={{
                                        width: '70px',
                                        padding: '8px 6px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        textAlign: 'center',
                                        maxHeight: '80px',
                                        overflowY: 'auto'
                                      }}
                                    >
                                      {Array.from({ length: 25 }, (_, i) => (
                                        <option key={i} value={i}>{i}</option>
                                      ))}
                                    </select>
                                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Hours</span>
                                  </div>

                                  <span style={{ fontSize: '16px', color: '#64748b', fontWeight: '600' }}>:</span>

                                  {/* Minutes Picker */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <select
                                      value={Math.round((attendanceConfig.markLateAfter % 1) * 60)}
                                      onChange={(e) => {
                                        const hours = Math.floor(attendanceConfig.markLateAfter);
                                        const minutes = parseInt(e.target.value);
                                        const newValue = hours + (minutes / 60);
                                        setAttendanceConfig({
                                          ...attendanceConfig,
                                          markLateAfter: newValue
                                        });
                                      }}
                                      style={{
                                        width: '70px',
                                        padding: '8px 6px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        textAlign: 'center',
                                        maxHeight: '80px',
                                        overflowY: 'auto'
                                      }}
                                    >
                                      {Array.from({ length: 60 }, (_, i) => (
                                        <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>
                                      ))}
                                    </select>
                                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Minutes</span>
                                  </div>
                                </div>

                                <div style={{
                                  padding: '6px 12px',
                                  background: '#f1f5f9',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  color: '#475569'
                                }}>
                                  Total: {Math.floor(attendanceConfig.markLateAfter * 60)} minutes
                                </div>
                              </div>
                              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
                                Employees checking in after this time will be marked as late but still present.
                              </p>
                            </div>

                            {/* Checkout Grace Period */}
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                Checkout Grace Period (Minutes)
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <input
                                  type="number"
                                  min="0"
                                  value={attendanceConfig.checkoutGracePeriod || 0}
                                  onChange={(e) => setAttendanceConfig({ ...attendanceConfig, checkoutGracePeriod: parseInt(e.target.value) || 0 })}
                                  style={{
                                    width: '100px',
                                    padding: '8px 12px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '6px',
                                    fontSize: '13px'
                                  }}
                                />
                              </div>
                              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
                                Time allowed after shift end before working hours calculation is capped.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div style={{
                        marginTop: '20px',
                        padding: '14px',
                        background: '#f0f9ff',
                        borderRadius: '8px',
                        border: '1px solid #bae6fd'
                      }}>
                        <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '600', color: '#0369a1' }}>
                          How Attendance Marking Works
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#0c4a6e', lineHeight: '1.5' }}>
                          <li><strong>Present:</strong> Check-in within the "Mark Late After" threshold</li>
                          <li><strong>Late (Present):</strong> Check-in after the "Mark Late After" threshold</li>
                          <li><strong>Note:</strong> All times are calculated relative to each employee's assigned shift start time</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>

                <div style={{
                  padding: '16px 24px',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="button"
                    className="emp-btn-ghost"
                    onClick={() => setShowShiftConfigModal(false)}
                  >
                    <span>Cancel</span>
                  </button>
                  <button
                    type="button"
                    className="emp-btn-primary"
                    onClick={configTab === 'shift' ? saveShiftConfigs : saveAttendanceConfig}
                  >
                    <span>Save Configuration</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>



      {/* Stats Cards */}
      {/* Only show stats cards to Admin, HR Manager, HR, Director, and Manager */}
      {["Admin", "HR Manager", "HR", "Director", "Manager"].includes(user?.role?.name) ? (
        <div className="stats-grid">
          {/* Total Employees */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: quickFilter === 'all' && filterStatus === '' ? "2px solid #3b82f6" : "1px solid #e2e8f0",
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
            onClick={() => setQueryState({ status: '', role: '', dept: '', filter: 'all', page: 1 })}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Employees</div>
              <div style={{ color: '#3b82f6' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '300', color: '#1e293b', position: 'relative', zIndex: 1, marginBottom: '8px' }}>{stats.total}</div>
            {renderTrend(stats.changes?.total)}
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>workforce strength</div>
          </div>

          {/* Active Employees */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: quickFilter === 'all' && filterStatus === 'active' ? "2px solid #22c55e" : "1px solid #e2e8f0",
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
            onClick={() => setQueryState({ status: 'active', role: '', dept: '', filter: 'all', page: 1 })}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active</div>
              <div style={{ color: '#22c55e' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '300', color: '#1e293b', position: 'relative', zIndex: 1, marginBottom: '8px' }}>{stats.active}</div>
            {renderTrend(stats.changes?.active)}
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>currently working</div>
          </div>

          {/* Inactive Employees */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: quickFilter === 'all' && filterStatus === 'inactive' ? "2px solid #ef4444" : "1px solid #e2e8f0",
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
            onClick={() => setQueryState({ status: 'inactive', role: '', dept: '', filter: 'all', page: 1 })}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inactive</div>
              <div style={{ color: '#ef4444' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '300', color: '#1e293b', position: 'relative', zIndex: 1, marginBottom: '8px' }}>{stats.inactive}</div>
            {renderTrend(stats.changes?.inactive)}
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>not on duty</div>
          </div>

          {/* Developers */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: quickFilter === 'developers' ? "2px solid #8b5cf6" : "1px solid #e2e8f0",
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
            onClick={() => setQueryState({ filter: 'developers', status: '', role: '', dept: '', page: 1 })}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Developers</div>
              <div style={{ color: '#8b5cf6' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '300', color: '#1e293b', position: 'relative', zIndex: 1, marginBottom: '8px' }}>{stats.developers}</div>
            {renderTrend(stats.changes?.developers)}
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>technical team</div>
          </div>

          {/* Sales */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: quickFilter === 'sales' ? "2px solid #f59e0b" : "1px solid #e2e8f0",
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
            onClick={() => setQueryState({ filter: 'sales', status: '', role: '', dept: '', page: 1 })}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sales</div>
              <div style={{ color: '#f59e0b' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '300', color: '#1e293b', position: 'relative', zIndex: 1, marginBottom: '8px' }}>{stats.sales}</div>
            {renderTrend(stats.changes?.sales)}
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>sales department</div>
          </div>

          {/* New Joinees */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            border: quickFilter === 'newJoinees' ? "2px solid #06b6d4" : "1px solid #e2e8f0",
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
            onClick={() => setQueryState({ filter: 'newJoinees', status: '', role: '', dept: '', page: 1 })}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>New Joinees</div>
              <div style={{ color: '#06b6d4' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><polyline points="17 11 19 13 23 9" />
                </svg>
              </div>
            </div>
            <div style={{ fontSize: '32px', fontWeight: '300', color: '#1e293b', position: 'relative', zIndex: 1, marginBottom: '8px' }}>{stats.newJoinees}</div>
            {renderTrend(stats.changes?.newJoinees)}
            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>joined recently</div>
          </div>
        </div>
      ) : null}

      {/* Search and Filters Section */}
      <div style={{
        background: '#fff',
        borderRadius: '14px',
        border: '1px solid #e5e7eb',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        marginBottom: '20px'
      }}>
        {/* Search Bar and Filters Row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search Input */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '8px 14px',
            flex: '1',
            minWidth: '180px',
            maxWidth: '400px',
            transition: 'all 0.2s'
          }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#3b775e';
              e.currentTarget.style.background = '#fff';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.08)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.boxShadow = 'none';
            }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, ID, email, role..."
              value={searchTerm || ''}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '13px',
                color: '#0f172a',
                background: 'transparent',
                width: '100%',
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500
              }}
            />
            {Boolean(searchTerm) && (
              <button
                type="button"
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#94a3b8',
                  outline: 'none'
                }}
                title="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Role Filter - Custom Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowRoleFilterDd(!showRoleFilterDd); setShowDeptFilterDd(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 16px', border: 'none', borderRadius: '999px',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                background: showRoleFilterDd ? '#f0fdf4' : '#ffffff',
                color: '#475569', outline: 'none', border: '1px solid #e2e8f0',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.25s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = showRoleFilterDd ? '#16a34a' : '#e2e8f0'}
            >
              <span>{filterRole === "" ? "All Roles" : roles.find(r => r._id === filterRole)?.name || "All Roles"}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showRoleFilterDd ? 'rotate(180deg)' : 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showRoleFilterDd && (
              <div onClick={e => e.stopPropagation()} style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                background: '#ffffff', borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                width: '320px', maxWidth: 'calc(100vw - 40px)', padding: '12px', overflow: 'hidden',
                animation: 'empDdIn 0.2s ease'
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder="Search roles..."
                    value={roleFilterSearch}
                    onChange={(e) => setRoleFilterSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', border: '1px solid #f1f5f9',
                      borderRadius: '10px', fontSize: '12px', background: '#f8fafc',
                      outline: 'none', fontFamily: "'Inter', sans-serif"
                    }}
                  />
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }} className="emp-modal-scroll">
                  <div
                    className="proj-dd-option"
                    onClick={() => { setQueryState({ role: '', page: 1 }); setShowRoleFilterDd(false); setRoleFilterSearch(''); }}
                    style={{
                      padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                      fontWeight: filterRole === "" ? '600' : '400',
                      cursor: 'pointer', color: filterRole === "" ? '#15803d' : '#1e293b',
                      background: filterRole === "" ? '#dcfce7' : 'transparent',
                      marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                    }}
                  >All Roles</div>
                  {roles.filter(r => r.name.toLowerCase().includes(roleFilterSearch.toLowerCase())).map(role => (
                    <div
                      key={role._id}
                      className="proj-dd-option"
                      onClick={() => { setQueryState({ role: role._id, page: 1 }); setShowRoleFilterDd(false); setRoleFilterSearch(''); }}
                      style={{
                        padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: filterRole === role._id ? '600' : '400',
                        cursor: 'pointer', color: filterRole === role._id ? '#15803d' : '#1e293b',
                        background: filterRole === role._id ? '#dcfce7' : 'transparent',
                        marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                      }}
                    >{role.name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Department Filter - Custom Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeptFilterDd(!showDeptFilterDd); setShowRoleFilterDd(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 16px', border: 'none', borderRadius: '999px',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                background: showDeptFilterDd ? '#f0fdf4' : '#ffffff',
                color: '#475569', outline: 'none', border: '1px solid #e2e8f0',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.25s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = showDeptFilterDd ? '#16a34a' : '#e2e8f0'}
            >
              <span>{filterDepartment === "" ? "All Departments" : filterDepartment}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showDeptFilterDd ? 'rotate(180deg)' : 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showDeptFilterDd && (
              <div onClick={e => e.stopPropagation()} style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                background: '#ffffff', borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                width: '320px', maxWidth: 'calc(100vw - 40px)', padding: '12px', overflow: 'hidden',
                animation: 'empDdIn 0.2s ease'
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={deptFilterSearch}
                    onChange={(e) => setDeptFilterSearch(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', border: '1px solid #f1f5f9',
                      borderRadius: '10px', fontSize: '12px', background: '#f8fafc',
                      outline: 'none', fontFamily: "'Inter', sans-serif"
                    }}
                  />
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }} className="emp-modal-scroll">
                  <div
                    className="proj-dd-option"
                    onClick={() => { setQueryState({ dept: '', page: 1 }); setShowDeptFilterDd(false); setDeptFilterSearch(''); }}
                    style={{
                      padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                      fontWeight: filterDepartment === "" ? '600' : '400',
                      cursor: 'pointer', color: filterDepartment === "" ? '#15803d' : '#1e293b',
                      background: filterDepartment === "" ? '#dcfce7' : 'transparent',
                      marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                    }}
                  >All Departments</div>
                  {departments.filter(d => d.toLowerCase().includes(deptFilterSearch.toLowerCase())).map(dept => (
                    <div
                      key={dept}
                      className="proj-dd-option"
                      onClick={() => { setQueryState({ dept, page: 1 }); setShowDeptFilterDd(false); setDeptFilterSearch(''); }}
                      style={{
                        padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: filterDepartment === dept ? '600' : '400',
                        cursor: 'pointer', color: filterDepartment === dept ? '#15803d' : '#1e293b',
                        background: filterDepartment === dept ? '#dcfce7' : 'transparent',
                        marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                      }}
                    >{dept}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Filter - Custom Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowStatusFilterDd(!showStatusFilterDd); setShowDeptFilterDd(false); setShowRoleFilterDd(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '9px 16px', border: 'none', borderRadius: '999px',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                background: showStatusFilterDd ? '#f0fdf4' : '#ffffff',
                color: '#475569', outline: 'none', border: '1px solid #e2e8f0',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.25s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = showStatusFilterDd ? '#16a34a' : '#e2e8f0'}
            >
              <span>{filterStatus === "" ? "All Status" : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showStatusFilterDd ? 'rotate(180deg)' : 'none' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {showStatusFilterDd && (
              <div onClick={e => e.stopPropagation()} style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                background: '#ffffff', borderRadius: '16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                width: '180px', padding: '8px', overflow: 'hidden',
                animation: 'empDdIn 0.2s ease'
              }}>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }} className="emp-modal-scroll">
                  <div
                    className="proj-dd-option"
                    onClick={() => { setQueryState({ status: '', page: 1 }); setShowStatusFilterDd(false); }}
                    style={{
                      padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                      fontWeight: filterStatus === "" ? '600' : '400',
                      cursor: 'pointer', color: filterStatus === "" ? '#15803d' : '#1e293b',
                      background: filterStatus === "" ? '#dcfce7' : 'transparent',
                      marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                    }}
                  >All Status</div>
                  {["active", "inactive"].map(status => (
                    <div
                      key={status}
                      className="proj-dd-option"
                      onClick={() => { setQueryState({ status, page: 1 }); setShowStatusFilterDd(false); }}
                      style={{
                        padding: '8px 12px', borderRadius: '8px', fontSize: '13px',
                        fontWeight: filterStatus === status ? '600' : '400',
                        cursor: 'pointer', color: filterStatus === status ? '#15803d' : '#1e293b',
                        background: filterStatus === status ? '#dcfce7' : 'transparent',
                        marginBottom: '4px', fontFamily: "'Inter', sans-serif"
                      }}
                    >{status.charAt(0).toUpperCase() + status.slice(1)}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons Row */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {canUpdateEmployee && (
            <>
              <button
                className="emp-excel-btn"
                onClick={handleExportListExcel}
                title="Export Excel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Excel</span>
              </button>
              <button
                className="emp-download-btn"
                onClick={handleExportListPDF}
                title="Download PDF"
              >
                <Download size={15} />
                <span>Download</span>
              </button>
            </>
          )}
          {canCreateEmployee && <button
            onClick={() => {
              const nextId = getNextEmpId(employees);
              setFormData({
                email: "",
                password: "",
                firstName: "",
                lastName: "",
                employeeId: nextId,
                role: "",
                department: "",
                designation: "",
                phone: "",
                gender: "",
                // Shift Timing
                shiftStartTime: "",
                shiftEndTime: "",
                shiftType: "",
                // Banking Details
                accountNumber: "",
                ifscCode: "",
                accountHolderName: "",
                panNumber: "",
                upiId: "",
                aadharCard: "",
                panCard: "",
                markSheet10: "",
                markSheet12: "",
                graduation: "",
                otherDocs: "",
              });
              setDocFiles({
                aadharCard: null,
                panCard: null,
                markSheet10: null,
                markSheet12: null,
                graduation: null,
                otherDocs: null,
              });
              setFormStep(1);
              setShowPassword(false);
              setIsSubmitting(false);
              setShowModal(true);
            }}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              fontFamily: "'Inter', sans-serif",
              marginLeft: 'auto'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.92';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,119,94,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Employee
          </button>}
        </div>
      </div>

      {/* Employee Table */}
      <div style={{
        background: '#fff',
        borderRadius: '14px',
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}>
        <div style={{ overflowX: "auto", overflowY: "auto", flex: 1 }} className="emp-modal-scroll">
          <table className="table" style={{ marginBottom: 0, width: '100%', borderCollapse: 'collapse', minWidth: '950px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: "#fafafa", borderBottom: '2px solid #e5e7eb', boxShadow: '0 1px 0 #e5e7eb' }}>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif", textAlign: "center", verticalAlign: "middle", width: "60px" }}>Sr. No.</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif", textAlign: "center", verticalAlign: "middle" }}>Employee ID</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif" }}>Name</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif", textAlign: "center", verticalAlign: "middle", maxWidth: "200px" }}>Email</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>Role</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>Department</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>Shift</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>Shift Time</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", borderBottom: "none", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>Status</th>
                <th style={{ color: "#64748b", fontWeight: "600", padding: "9px 12px", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.6px", textAlign: "center", borderBottom: "none", fontFamily: "'Inter', sans-serif" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((employee, index) => (
                <tr key={employee._id} style={{
                  background: "#fff",
                  transition: "all 0.15s ease",
                  borderBottom: "1px solid #f1f5f9"
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fafffe'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}>
                  <td style={{ padding: "7px 12px", fontWeight: "500", color: "#64748b", fontSize: "12px", fontFamily: "'Inter', sans-serif", textAlign: "center", verticalAlign: "middle" }}>
                    {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                  </td>
                  <td style={{ padding: "7px 12px", fontWeight: "600", color: "#3b775e", fontSize: "12px", fontFamily: "'Inter', sans-serif", textAlign: "center", verticalAlign: "middle" }}>
                    {employee.employeeId}
                  </td>
                  <td style={{ padding: "7px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-start" }}>
                      <div style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#166534",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                        </svg>
                      </div>
                      <div style={{ textAlign: "left" }}>
                        <div style={{ fontWeight: "600", color: "#0f172a", fontSize: "12px", fontFamily: "'Inter', sans-serif" }}>
                          {employee.firstName} {employee.lastName}
                        </div>
                        <div style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "'Inter', sans-serif" }}>
                          {employee.designation || "—"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "7px 12px", fontSize: "12px", color: "#475569", fontFamily: "'Inter', sans-serif", textAlign: "center", verticalAlign: "middle", wordBreak: "break-all", maxWidth: "200px" }}>{employee.email}</td>
                  <td style={{ padding: "7px 12px", textAlign: "center" }}>
                    <span style={{
                      background: "#eff6ff",
                      color: "#2563eb",
                      padding: "4px 12px",
                      borderRadius: "999px",
                      fontSize: "11px",
                      fontWeight: "600",
                      fontFamily: "'Inter', sans-serif",
                      display: "inline-block",
                      minWidth: "60px"
                    }}>
                      {employee.role?.name}
                    </span>
                  </td>
                  <td style={{ padding: "7px 12px", fontSize: "12px", color: "#475569", fontFamily: "'Inter', sans-serif", textAlign: "center" }}>{employee.department || "—"}</td>
                  <td style={{ padding: "7px 12px", textAlign: "center" }}>
                    <span style={{
                      background: (() => {
                        const shift = employee.shiftType?.toLowerCase() || '';
                        const configName = shiftConfigs.find(c => c.type === employee.shiftType)?.name?.toLowerCase() || '';
                        if (shift === 'morning' || configName.includes('morning')) return "#fef08a"; // Bright yellow
                        if (shift === 'noon' || configName.includes('noon') || configName.includes('afternoon')) return "#3b82f6"; // Blue
                        if (shift === 'evening' || configName.includes('evening')) return "#f97316"; // Orange
                        if (shift === 'night' || configName.includes('night')) return "#6b7280"; // Gray
                        return "#f1f5f9"; // Light gray fallback
                      })(),
                      color: (() => {
                        const shift = employee.shiftType?.toLowerCase() || '';
                        const configName = shiftConfigs.find(c => c.type === employee.shiftType)?.name?.toLowerCase() || '';
                        if (shift === 'morning' || configName.includes('morning')) return "#713f12"; // Dark yellow text
                        if (shift === 'noon' || configName.includes('noon') || configName.includes('afternoon') ||
                          shift === 'evening' || configName.includes('evening') ||
                          shift === 'night' || configName.includes('night')) return "#ffffff"; // White text
                        return "#64748b"; // Dark gray text fallback
                      })(),
                      padding: "4px 12px",
                      borderRadius: "999px",  // Pill shape
                      fontSize: "11px",
                      fontWeight: "600",
                      fontFamily: "'Inter', sans-serif",
                      textTransform: "capitalize",
                      display: "inline-block",
                      minWidth: "70px",
                      textAlign: "center"
                    }}>
                      {(() => {
                        if (!employee.shiftType) return 'Not Assigned';
                        const config = shiftConfigs.find(c => c.type === employee.shiftType);
                        if (config) {
                          return config.name.replace(/\s*[Ss]hift\s*/g, '');
                        }
                        return employee.shiftType.charAt(0).toUpperCase() + employee.shiftType.slice(1);
                      })()}
                    </span>
                  </td>
                  <td style={{ padding: "7px 12px", fontSize: "11px", color: "#475569", fontFamily: "'Inter', sans-serif", fontWeight: "500", textAlign: "center" }}>
                    {(() => {
                      if (!employee.shiftType || !employee.shiftStartTime || !employee.shiftEndTime) return "Not Assigned";
                      return `${employee.shiftStartTime} - ${employee.shiftEndTime}`;
                    })()}
                  </td>
                  <td style={{ padding: "7px 12px", textAlign: "center" }}>
                    <span style={{
                      background: employee.isActive ? "#f0fdf4" : "#fef2f2",
                      color: employee.isActive ? "#16a34a" : "#dc2626",
                      padding: "3px 8px",
                      borderRadius: "5px",
                      fontSize: "11px",
                      fontWeight: "600",
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontFamily: "'Inter', sans-serif"
                    }}>
                      <span style={{ fontSize: '7px' }}>●</span> {employee.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "7px 12px" }}>
                    <div className="templates-actions" style={{ justifyContent: "center", position: "relative" }}>
                      {canReadEmployee && <button
                        className="templates-action-btn" onClick={() => handleViewEmployee(employee)} title="View">
                        <Eye size={14} />
                      </button>}
                      {canUpdateEmployee && <button
                        className={`templates-action-btn${employee.isActive ? ' templates-action-delete' : ''}`}
                        onClick={() => handleToggleStatus(employee._id, employee.isActive)}
                        title={employee.isActive ? "Deactivate" : "Activate"}
                      >
                        {employee.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>}
                      {canUpdateEmployee && <button
                        className="templates-action-btn" onClick={() => handleEditEmployee(employee)} title="Edit">
                        <Edit2 size={14} />
                      </button>}
                      {canUpdateEmployee && <button
                        className="templates-action-btn" onClick={() => handleChangePassword(employee)} title="Change Password">
                        <Lock size={14} />
                      </button>}
                      {canDeleteEmployee && <button
                        className="templates-action-btn templates-action-delete" onClick={() => handleDeleteEmployee(employee._id)} title="Delete">
                        <Trash2 size={14} />
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedEmployees.length === 0 && (
                <tr>
                  <td colSpan={10} style={{
                    padding: "60px 20px",
                    textAlign: "center",
                    color: "#94a3b8",
                    background: '#fff'
                  }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      margin: '0 auto 16px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0.9
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: 600,
                      color: '#0f172a',
                      fontFamily: "'Inter', sans-serif"
                    }}>No employees found</p>
                    <p style={{
                      margin: '6px 0 0',
                      fontSize: "13px",
                      color: '#94a3b8',
                      fontFamily: "'Inter', sans-serif"
                    }}>Try adjusting your search or filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredEmployees.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '16px',
            borderTop: '1px solid #f1f5f9',
            background: '#fafafa'
          }}>
            {/* Prev */}
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                width: '28px', height: '28px', borderRadius: '7px',
                background: currentPage === 1 ? '#f0fdf4' : '#a3e635',
                border: 'none',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', outline: 'none',
                opacity: currentPage === 1 ? 0.4 : 1
              }}
              onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.background = '#84cc16'; }}
              onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.background = '#a3e635'; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#365314" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Page numbers */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '7px',
                    background: currentPage === pageNum ? '#a3e635' : '#f0fdf4',
                    border: currentPage === pageNum ? 'none' : '1px solid #d9f99d',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.2s ease', outline: 'none',
                    fontSize: '11px', fontWeight: '700',
                    color: currentPage === pageNum ? '#365314' : '#4d7c0f',
                    fontFamily: "'Inter', -apple-system, sans-serif"
                  }}
                  onMouseEnter={(e) => { if (currentPage !== pageNum) e.currentTarget.style.background = '#bef264'; }}
                  onMouseLeave={(e) => { if (currentPage !== pageNum) e.currentTarget.style.background = '#f0fdf4'; }}
                >{pageNum}</button>
              );
            })}

            {/* Ellipsis + last page */}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span style={{ padding: '0 4px', color: '#84cc16', fontSize: '12px', fontWeight: '700', fontFamily: "'Inter', -apple-system, sans-serif" }}>...</span>
            )}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <button
                onClick={() => setCurrentPage(totalPages)}
                style={{
                  width: '28px', height: '28px', borderRadius: '7px',
                  background: '#f0fdf4', border: '1px solid #d9f99d',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s ease', outline: 'none',
                  fontSize: '11px', fontWeight: '700', color: '#4d7c0f',
                  fontFamily: "'Inter', -apple-system, sans-serif"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#bef264'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#f0fdf4'}
              >{totalPages}</button>
            )}

            {/* Next */}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{
                width: '28px', height: '28px', borderRadius: '7px',
                background: currentPage === totalPages ? '#f0fdf4' : '#a3e635',
                border: 'none',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s ease', outline: 'none',
                opacity: currentPage === totalPages ? 0.4 : 1
              }}
              onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = '#84cc16'; }}
              onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = '#a3e635'; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#365314" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <style>{`
              @keyframes empModalIn {
                from { opacity: 0; transform: translateY(16px) scale(0.98); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
              .emp-modal {
                background: #fff;
                border-radius: 18px;
                width: 100%;
                max-width: 780px;
                max-height: 88vh;
                overflow-y: auto;
                border: 1px solid #e8edf0;
                box-shadow: 0 8px 40px rgba(0,0,0,0.13);
                font-family: 'Inter', 'Segoe UI', sans-serif;
                animation: empModalIn 0.22s cubic-bezier(0.16,1,0.3,1);
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
              .emp-modal::-webkit-scrollbar {
                display: none;
              }
              .emp-modal-sticky-head {
                position: sticky;
                top: 0;
                background: #fff;
                z-index: 2000;
                border-bottom: 1px solid #f1f3f5;
              }
              .emp-modal-hd {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 18px 20px 14px;
                background: #fafafa;
                border-radius: 18px 18px 0 0;
              }
              .emp-modal-hd-icon {
                width: 36px;
                height: 36px;
                border-radius: 10px;
                background: rgba(59,119,94,0.1);
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              }
              .emp-modal-title {
                font-size: 14px;
                font-weight: 700;
                color: #111827;
                letter-spacing: -0.01em;
                line-height: 1.3;
              }
              .emp-modal-sub {
                font-size: 11.5px;
                color: #9ca3af;
                margin-top: 2px;
                line-height: 1.3;
              }
              .emp-close-btn {
                margin-left: auto;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: #f1f5f9;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #6b7280;
                flex-shrink: 0;
                transition: background 0.15s, color 0.15s;
                font-size: 20px;
                line-height: 1;
              }
              .emp-close-btn:hover { background: #e5e7eb; color: #111827; }
              .emp-modal-body { padding: 20px; }
              .emp-form { display: flex; flex-direction: column; gap: 16px; }
              .emp-section-lbl {
                font-size: 10.5px;
                font-weight: 700;
                color: #3b775e;
                text-transform: uppercase;
                letter-spacing: 0.07em;
                padding-bottom: 6px;
                border-bottom: 1.5px solid #e8f3ee;
                margin-bottom: 6px;
              }
              .emp-field { display: flex; flex-direction: column; gap: 5px; }
              .emp-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
              .emp-lbl {
                font-size: 11.5px;
                font-weight: 600;
                color: #374151;
                letter-spacing: 0.02em;
              }
              .emp-req { color: #ef4444; margin-left: 2px; }
              .emp-optional { font-weight: 400; color: #c4c9d4; margin-left: 4px; font-size: 11px; }
              .emp-input {
                width: 100%;
                padding: 9px 12px;
                border: 1.5px solid #e5e7eb;
                border-radius: 9px;
                font-size: 13px;
                color: #111827;
                background: #fff;
                font-family: 'Inter', sans-serif;
                box-sizing: border-box;
                transition: border-color 0.15s, box-shadow 0.15s;
                outline: none;
              }
              .emp-input:focus {
                border-color: #3b775e;
                box-shadow: 0 0 0 3px rgba(59,119,94,0.09);
              }
              .emp-input::placeholder { color: #c4c9d4; font-size: 12.5px; }
              .emp-footer {
                display: flex;
                justify-content: flex-end;
                gap: 8px;
                padding-top: 16px;
                border-top: 1px solid #f1f3f5;
                margin-top: 4px;
              }
              /* emp-btn-ghost is defined in Templates.css */
              .emp-btn-primary {
                padding: 9px 24px;
                border: none;
                background: linear-gradient(135deg, #3b775e 0%, #56a07a 100%);
                border-radius: 9px;
                font-size: 12.5px;
                font-weight: 700;
                color: #fff;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
                transition: opacity 0.15s, transform 0.15s;
              }
              .emp-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
              .emp-btn-ghost {
                position: relative;
                isolation: isolate;
                color: #64748b;
                background: #fff;
                border: 1px solid #e2e8f0;
                padding: 9px 24px;
                border-radius: 9px;
                font-size: 12.5px;
                font-weight: 600;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
                overflow: hidden;
              }
              .emp-btn-ghost:hover {
                background: #f8fafc;
                color: #1e293b;
                border-color: #cbd5e1;
              }
              .emp-btn-ghost span, .emp-btn-primary span {
                position: relative;
                z-index: 1;
              }
              .proj-dd-option:hover {
                background: #f0fdf4 !important;
                color: #15803d !important;
              }
              @keyframes empDdIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .emp-modal-scroll {
                -ms-overflow-style: none;
                scrollbar-width: none;
              }
              .emp-modal-scroll::-webkit-scrollbar {
                display: none;
              }
              .emp-step-indicator {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 40px;
                background: #fff;
                border-bottom: 1px solid #f1f3f5;
              }
              .emp-step-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                position: relative;
                z-index: 1;
              }
              .emp-step-circle {
                width: 26px;
                height: 26px;
                border-radius: 50%;
                background: #fff;
                border: 2px solid #e2e8f0;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 11px;
                font-weight: 700;
                color: #94a3b8;
                transition: all 0.3s;
              }
              .emp-step-item.active .emp-step-circle {
                background: #3b775e;
                border-color: #3b775e;
                color: #fff;
                box-shadow: 0 0 0 4px rgba(59,119,94,0.15);
              }
              .emp-step-item.completed .emp-step-circle {
                background: #10b981;
                border-color: #10b981;
                color: #fff;
              }
              .emp-step-label {
                font-size: 10px;
                font-weight: 600;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
              .emp-step-item.active .emp-step-label { color: #3b775e; }
              .emp-step-line {
                position: absolute;
                top: 13px;
                left: calc(50% + 20px);
                right: calc(-50% + 20px);
                height: 2px;
                background: #e2e8f0;
                z-index: -1;
              }
              .emp-step-line.filled { background: #10b981; }
              .emp-file-btn {
                position: relative;
                overflow: hidden;
                display: inline-block;
                width: 100%;
              }
              .emp-file-input {
                position: absolute;
                top: 0; left: 0; opacity: 0;
                width: 100%; height: 100%;
                cursor: pointer;
              }
              .emp-file-placeholder {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 9px 12px;
                border: 1.5px dashed #e5e7eb;
                border-radius: 9px;
                font-size: 12px;
                color: #64748b;
                background: #f8fafc;
                transition: all 0.2s;
              }
              .emp-file-placeholder:hover { border-color: #3b775e; background: #fff; color: #3b775e; }
              .emp-file-selected {
                border-style: solid;
                border-color: #10b981;
                background: #f0fdf4;
                color: #166534;
              }
              .emp-excel-btn, .emp-download-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 8px 16px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #fff;
                color: #475569;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                font-family: 'Inter', sans-serif;
              }
              .emp-excel-btn:hover, .emp-download-btn:hover {
                background: #f8fafc;
                border-color: #cbd5e1;
                color: #1e293b;
              }
              .emp-kebab-menu {
                background: #fff;
                border-radius: 12px;
                border: 1px solid #e2e8f0;
                box-shadow: 0 10px 30px rgba(0,0,0,0.12);
                padding: 8px;
                min-width: 140px;
              }
              .emp-kebab-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border: none;
                background: none;
                color: #475569;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                border-radius: 8px;
                width: 100%;
                text-align: left;
                transition: all 0.2s;
                font-family: 'Inter', sans-serif;
              }
              .emp-kebab-item:hover {
                background: #f8fafc;
                color: #1e293b;
              }
              .emp-kebab-delete:hover {
                background: #fef2f2;
                color: #dc2626;
              }
              .templates-actions {
                display: flex;
                align-items: center;
                gap: 6px;
              }
              .templates-action-btn {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                background: #fff;
                color: #64748b;
                cursor: pointer;
                transition: all 0.2s;
                padding: 0;
              }
              .templates-action-btn:hover {
                background: #f8fafc;
                border-color: #cbd5e1;
                color: #1e293b;
              }
              .templates-action-delete:hover {
                background: #fef2f2;
                border-color: #fecaca;
                color: #dc2626;
              }
              .modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                padding: 20px;
              }
              @media (max-width: 768px) {
                .emp-step-indicator {
                  padding: 10px 12px !important;
                  gap: 4px;
                }
                .emp-step-label {
                  font-size: 9px !important;
                }
                .emp-step-circle {
                  width: 22px !important;
                  height: 22px !important;
                  font-size: 10px !important;
                }
                .emp-field-row {
                  grid-template-columns: 1fr !important;
                }
              }
            `}</style>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, () => setShowModal(false))}>
          <div className="emp-modal">
            <div className="emp-modal-sticky-head">
              <div className="emp-modal-hd">
                <div className="emp-modal-hd-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                </div>
                <div>
                  <div className="emp-modal-title">Add New Employee</div>
                  <div className="emp-modal-sub">Step {formStep} of 3: {formStep === 1 ? 'Personal Info' : formStep === 2 ? 'Bank Details' : 'Documents'}</div>
                </div>
                <button className="emp-close-btn" onClick={() => setShowModal(false)}>&times;</button>
              </div>

              {/* Progress Indicator */}
              <div className="emp-step-indicator">
                <div className={`emp-step-item ${formStep === 1 ? 'active' : 'completed'}`}>
                  <div className="emp-step-circle">{formStep > 1 ? '✓' : '1'}</div>
                  <div className="emp-step-label">Basic</div>
                  <div className={`emp-step-line ${formStep > 1 ? 'filled' : ''}`}></div>
                </div>
                <div className={`emp-step-item ${formStep === 2 ? 'active' : formStep > 2 ? 'completed' : ''}`}>
                  <div className="emp-step-circle">{formStep > 2 ? '✓' : '2'}</div>
                  <div className="emp-step-label">Banking</div>
                  <div className={`emp-step-line ${formStep > 2 ? 'filled' : ''}`}></div>
                </div>
                <div className={`emp-step-item ${formStep === 3 ? 'active' : ''}`}>
                  <div className="emp-step-circle">3</div>
                  <div className="emp-step-label">Docs</div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="emp-modal-body" autoComplete="off">
              <div className="emp-form">

                {formStep === 1 && (
                  <>
                    <div className="emp-section-lbl">Basic Information</div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">First Name<span className="emp-req">*</span></label>
                        <input type="text" className="emp-input" placeholder="Enter first name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Last Name</label>
                        <input type="text" className="emp-input" placeholder="Enter last name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Email<span className="emp-req">*</span></label>
                        <input type="email" className="emp-input" placeholder="employee@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} autoComplete="off" required />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Password<span className="emp-req">*</span></label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input type={showPassword ? 'text' : 'password'} className="emp-input" style={{ paddingRight: '38px', width: '100%' }} placeholder="Min 8 characters" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} autoComplete="new-password" minLength="8" maxLength="15" required />
                          <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: 0 }} tabIndex={-1}>
                            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Employee ID<span className="emp-req">*</span></label>
                        <div style={{ display: 'flex' }}>
                          <span style={{
                            padding: '9px 12px',
                            background: '#f8fafc',
                            border: `1.5px solid ${formData.employeeId && existingEmpForAddId ? '#ef4444' : formData.employeeId ? '#22c55e' : '#e5e7eb'}`,
                            borderRight: 'none',
                            borderRadius: '9px 0 0 9px',
                            color: formData.employeeId && existingEmpForAddId ? '#ef4444' : '#64748b',
                            fontSize: '13px',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.2s ease'
                          }}>EMP</span>
                          <input
                            type="text"
                            className="emp-input"
                            style={{
                              borderRadius: '0 9px 9px 0',
                              borderColor: formData.employeeId && existingEmpForAddId ? '#ef4444' : formData.employeeId ? '#22c55e' : '#e5e7eb',
                              transition: 'all 0.2s ease'
                            }}
                            placeholder="001"
                            maxLength="6"
                            value={formData.employeeId ? formData.employeeId.replace(/^EMP/i, '') : ''}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '');
                              setFormData({ ...formData, employeeId: val ? `EMP${val}` : '' });
                            }}
                            onBlur={() => {
                              const raw = formData.employeeId ? formData.employeeId.replace(/^EMP/i, '').replace(/\D/g, '') : '';
                              if (raw) {
                                setFormData(prev => ({ ...prev, employeeId: `EMP${raw.padStart(3, '0')}` }));
                              }
                            }}
                            required
                          />
                        </div>
                        {/* Real-time Employee ID existence indicator */}
                        {formData.employeeId && existingEmpForAddId ? (
                          <div style={{ marginTop: '5px', fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}>
                            <AlertCircle size={13} style={{ flexShrink: 0 }} />
                            <span>EMP{formData.employeeId.replace(/^EMP/i, '')} is already assigned to {existingEmpForAddId.firstName} {existingEmpForAddId.lastName} ({existingEmpForAddId.designation || existingEmpForAddId.role?.name || 'Employee'})</span>
                          </div>
                        ) : formData.employeeId ? (
                          <div style={{ marginTop: '5px', fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}>
                            <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                            <span>EMP{(formData.employeeId.replace(/^EMP/i, '')).padStart(3, '0')} is available</span>
                          </div>
                        ) : (
                          <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                            Min 3 digits
                          </div>
                        )}
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Role<span className="emp-req">*</span></label>
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowAddRoleDd(!showAddRoleDd); }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                              fontSize: '13px', fontWeight: '400', cursor: 'pointer',
                              background: showAddRoleDd ? '#f8fafc' : '#ffffff',
                              color: formData.role ? '#0f172a' : '#9ca3af', outline: 'none',
                              fontFamily: "'Inter', sans-serif",
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = showAddRoleDd ? '#3b82f6' : '#e2e8f0'}
                          >
                            <span>{formData.role ? roles.find(r => r._id === formData.role)?.name || "Select Role" : "Select Role"}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showAddRoleDd ? 'rotate(180deg)' : 'none' }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>

                          {showAddRoleDd && (
                            <div onClick={e => e.stopPropagation()} style={{
                              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                              background: '#ffffff', borderRadius: '12px',
                              boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                              maxHeight: '200px', padding: '8px', overflow: 'hidden',
                              animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                            }}>
                              <div style={{ marginBottom: '8px' }}>
                                <input
                                  type="text"
                                  placeholder="Search roles..."
                                  value={roleSearch}
                                  onChange={(e) => setRoleSearch(e.target.value)}
                                  style={{
                                    width: '100%', padding: '6px 10px', border: '1px solid #f1f5f9',
                                    borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                    outline: 'none', fontFamily: "'Inter', sans-serif"
                                  }}
                                />
                              </div>
                              <div style={{ maxHeight: '150px', overflowY: 'auto' }} className="emp-modal-scroll">
                                <div
                                  className="proj-dd-option"
                                  onClick={() => { setFormData({ ...formData, role: "" }); setShowAddRoleDd(false); setRoleSearch(""); }}
                                  style={{
                                    padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                    fontWeight: formData.role === "" ? '600' : '400',
                                    cursor: 'pointer', color: formData.role === "" ? '#15803d' : '#1e293b',
                                    background: formData.role === "" ? '#dcfce7' : 'transparent',
                                    marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                    transition: 'all 0.15s'
                                  }}
                                >Select Role</div>
                                {roles.length === 0 ? (
                                  <div style={{
                                    padding: '8px 10px', fontSize: '12px', color: '#64748b',
                                    fontStyle: 'italic', textAlign: 'center'
                                  }}>
                                    No roles available. Please create roles in the User Roles module.
                                  </div>
                                ) : (
                                  roles.filter(r => r.name.toLowerCase().includes(roleSearch.toLowerCase())).map(role => (
                                    <div
                                      key={role._id}
                                      className="proj-dd-option"
                                      onClick={() => { setFormData({ ...formData, role: role._id }); setShowAddRoleDd(false); setRoleSearch(""); }}
                                      style={{
                                        padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                        fontWeight: formData.role === role._id ? '600' : '400',
                                        cursor: 'pointer', color: formData.role === role._id ? '#15803d' : '#1e293b',
                                        background: formData.role === role._id ? '#dcfce7' : 'transparent',
                                        marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                        transition: 'all 0.15s'
                                      }}
                                    >{role.name}</div>
                                  ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Department<span className="emp-req">*</span></label>
                        <div style={{ position: 'relative' }}>
                          <div onClick={(e) => { e.stopPropagation(); setShowDeptDd(!showDeptDd); setShowDesigDd(false); }} style={{ padding: '10px 14px', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '9px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: formData.department ? '#111827' : '#9ca3af' }}>
                            <span>{formData.department || "Select or Type Department"}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                          </div>
                          {showDeptDd && (
                            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1500, padding: '8px' }}>
                              <div style={{ padding: '4px', marginBottom: '8px' }}>
                                <input type="text" placeholder="Search or Add..." value={deptSearch} onChange={(e) => { setDeptSearch(e.target.value); setFormData({ ...formData, department: e.target.value }); }} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '7px', fontSize: '13px', outline: 'none' }} />
                              </div>
                              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                {departments.filter(d => d.toLowerCase().includes(deptSearch.toLowerCase())).map(dept => (
                                  <div
                                    key={dept}
                                    onMouseEnter={() => setHoveredDeptItem(dept)}
                                    onMouseLeave={() => setHoveredDeptItem(null)}
                                    onClick={() => { setFormData({ ...formData, department: dept }); setDeptSearch(""); setShowDeptDd(false); }}
                                    style={{ padding: '8px 12px', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', background: formData.department === dept ? '#f0fdf4' : 'transparent', color: formData.department === dept ? '#15803d' : '#374151', transition: 'background 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                  >
                                    <span>{dept}</span>
                                    {hoveredDeptItem === dept && (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveDept(dept);
                                        }}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderRadius: '50%',
                                          background: '#fee2e2',
                                          color: '#ef4444',
                                          fontSize: '14px',
                                          fontWeight: 'bold',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        &times;
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Designation<span className="emp-req">*</span></label>
                        <div style={{ position: 'relative' }}>
                          <div onClick={(e) => { e.stopPropagation(); setShowDesigDd(!showDesigDd); setShowDeptDd(false); }} style={{ padding: '10px 14px', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '9px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: formData.designation ? '#111827' : '#9ca3af' }}>
                            <span>{formData.designation || "Select or Type Designation"}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                          </div>
                          {showDesigDd && (
                            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '6px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1500, padding: '8px' }}>
                              <div style={{ padding: '4px', marginBottom: '8px' }}>
                                <input type="text" placeholder="Search or Add..." value={desigSearch} onChange={(e) => { setDesigSearch(e.target.value); setFormData({ ...formData, designation: e.target.value }); }} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '7px', fontSize: '13px', outline: 'none' }} />
                              </div>
                              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                {designations.filter(d => d.toLowerCase().includes(desigSearch.toLowerCase())).map(desig => (
                                  <div
                                    key={desig}
                                    onMouseEnter={() => setHoveredDesigItem(desig)}
                                    onMouseLeave={() => setHoveredDesigItem(null)}
                                    onClick={() => { setFormData({ ...formData, designation: desig }); setDesigSearch(""); setShowDesigDd(false); }}
                                    style={{ padding: '8px 12px', borderRadius: '7px', fontSize: '13px', cursor: 'pointer', background: formData.designation === desig ? '#f0fdf4' : 'transparent', color: formData.designation === desig ? '#15803d' : '#374151', transition: 'background 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                  >
                                    <span>{desig}</span>
                                    {hoveredDesigItem === desig && (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemoveDesig(desig);
                                        }}
                                        style={{
                                          width: '20px',
                                          height: '20px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          borderRadius: '50%',
                                          background: '#fee2e2',
                                          color: '#ef4444',
                                          fontSize: '14px',
                                          fontWeight: 'bold',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        &times;
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Phone<span className="emp-req">*</span></label>
                        <input type="tel" className="emp-input" placeholder="10 digit number" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })} maxLength="10" required />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Gender<span className="emp-req">*</span></label>
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowAddGenderDd(!showAddGenderDd); }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                              fontSize: '13px', fontWeight: '400', cursor: 'pointer',
                              background: showAddGenderDd ? '#f8fafc' : '#ffffff',
                              color: formData.gender ? '#0f172a' : '#9ca3af', outline: 'none',
                              fontFamily: "'Inter', sans-serif",
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = showAddGenderDd ? '#3b82f6' : '#e2e8f0'}
                          >
                            <span>{formData.gender ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1) : "Select gender"}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showAddGenderDd ? 'rotate(180deg)' : 'none' }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          {showAddGenderDd && (
                            <div onClick={e => e.stopPropagation()} style={{
                              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                              background: '#ffffff', borderRadius: '12px',
                              boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                              padding: '8px', overflow: 'hidden',
                              animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                            }}>
                              <div style={{ maxHeight: '150px', overflowY: 'auto' }} className="emp-modal-scroll">
                                {['male', 'female', 'other'].map(genderVal => (
                                  <div
                                    key={genderVal}
                                    className="proj-dd-option"
                                    onClick={() => { setFormData({ ...formData, gender: genderVal }); setShowAddGenderDd(false); }}
                                    style={{
                                      padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                      fontWeight: formData.gender === genderVal ? '600' : '400',
                                      cursor: 'pointer', color: formData.gender === genderVal ? '#15803d' : '#1e293b',
                                      background: formData.gender === genderVal ? '#dcfce7' : 'transparent',
                                      marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    {genderVal.charAt(0).toUpperCase() + genderVal.slice(1)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Assign Manager</label>
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowAddManagerDd(!showAddManagerDd); }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                              fontSize: '13px', fontWeight: '400', cursor: 'pointer',
                              background: showAddManagerDd ? '#f8fafc' : '#ffffff',
                              color: formData.assignedManager ? '#0f172a' : '#9ca3af', outline: 'none',
                              fontFamily: "'Inter', sans-serif",
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = showAddManagerDd ? '#3b82f6' : '#e2e8f0'}
                          >
                            <span>{formData.assignedManager ? (() => {
                              const mgr = managerList.find(m => m._id === formData.assignedManager);
                              return mgr ? `${mgr.firstName} ${mgr.lastName} (${mgr.employeeId})` : "Select Manager";
                            })() : "Select Manager"}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showAddManagerDd ? 'rotate(180deg)' : 'none' }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          {showAddManagerDd && (
                            <div onClick={e => e.stopPropagation()} style={{
                              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                              background: '#ffffff', borderRadius: '12px',
                              boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                              maxHeight: '200px', padding: '8px', overflow: 'hidden',
                              animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                            }}>
                              <div style={{ marginBottom: '8px' }}>
                                <input
                                  type="text"
                                  placeholder="Search manager..."
                                  value={managerSearch}
                                  onChange={(e) => setManagerSearch(e.target.value)}
                                  style={{
                                    width: '100%', padding: '6px 10px', border: '1px solid #f1f5f9',
                                    borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                    outline: 'none', fontFamily: "'Inter', sans-serif"
                                  }}
                                />
                              </div>
                              <div style={{ maxHeight: '150px', overflowY: 'auto' }} className="emp-modal-scroll">
                                <div
                                  className="proj-dd-option"
                                  onClick={() => { setFormData({ ...formData, assignedManager: "" }); setShowAddManagerDd(false); setManagerSearch(""); }}
                                  style={{
                                    padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                    fontWeight: formData.assignedManager === "" ? '600' : '400',
                                    cursor: 'pointer', color: formData.assignedManager === "" ? '#15803d' : '#1e293b',
                                    background: formData.assignedManager === "" ? '#dcfce7' : 'transparent',
                                    marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                    transition: 'all 0.15s'
                                  }}
                                >No Manager</div>
                                {managerList.filter(m => `${m.firstName} ${m.lastName} ${m.employeeId}`.toLowerCase().includes(managerSearch.toLowerCase())).map(mgr => (
                                  <div
                                    key={mgr._id}
                                    className="proj-dd-option"
                                    onClick={() => { setFormData({ ...formData, assignedManager: mgr._id }); setShowAddManagerDd(false); setManagerSearch(""); }}
                                    style={{
                                      padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                      fontWeight: formData.assignedManager === mgr._id ? '600' : '400',
                                      cursor: 'pointer', color: formData.assignedManager === mgr._id ? '#15803d' : '#1e293b',
                                      background: formData.assignedManager === mgr._id ? '#dcfce7' : 'transparent',
                                      marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    {mgr.firstName} {mgr.lastName} ({mgr.employeeId}) - {mgr.designation} - {mgr.role?.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="emp-field"></div>
                    </div>

                    {/* Shift Assignment Section */}
                    <div className="emp-section-lbl">Shift Assignment</div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Shift Type<span className="emp-req">*</span></label>
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowAddShiftDd(!showAddShiftDd); }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                              fontSize: '13px', fontWeight: '400', cursor: 'pointer',
                              background: showAddShiftDd ? '#f8fafc' : '#ffffff',
                              color: formData.shiftType ? '#0f172a' : '#9ca3af', outline: 'none',
                              fontFamily: "'Inter', sans-serif",
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                            onMouseLeave={(e) => e.currentTarget.style.borderColor = showAddShiftDd ? '#3b82f6' : '#e2e8f0'}
                          >
                            <span>
                              {formData.shiftType ?
                                shiftConfigs.find(config => config.type === formData.shiftType)?.name || formData.shiftType :
                                "Select Shift"
                              }
                            </span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showAddShiftDd ? 'rotate(180deg)' : 'none' }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>

                          {showAddShiftDd && (
                            <div onClick={e => e.stopPropagation()} style={{
                              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                              background: '#ffffff', borderRadius: '12px',
                              boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                              maxHeight: '200px', padding: '8px', overflow: 'hidden',
                              animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                            }}>
                              <div style={{ marginBottom: '8px' }}>
                                <input
                                  type="text"
                                  placeholder="Search shifts..."
                                  value={shiftSearch}
                                  onChange={(e) => setShiftSearch(e.target.value)}
                                  style={{
                                    width: '100%', padding: '6px 10px', border: '1px solid #f1f5f9',
                                    borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                    outline: 'none', fontFamily: "'Inter', sans-serif"
                                  }}
                                />
                              </div>
                              <div style={{ maxHeight: '150px', overflowY: 'auto' }} className="emp-modal-scroll">
                                <div
                                  className="proj-dd-option"
                                  onClick={() => {
                                    setFormData({ ...formData, shiftType: "", shiftStartTime: "", shiftEndTime: "" });
                                    setShowAddShiftDd(false);
                                    setShiftSearch("");
                                  }}
                                  style={{
                                    padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                    fontWeight: formData.shiftType === "" ? '600' : '400',
                                    cursor: 'pointer', color: formData.shiftType === "" ? '#15803d' : '#1e293b',
                                    background: formData.shiftType === "" ? '#dcfce7' : 'transparent',
                                    marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                    transition: 'all 0.15s'
                                  }}
                                >Not Assigned</div>
                                {shiftConfigs.length === 0 ? (
                                  <div style={{
                                    padding: '8px 10px', fontSize: '12px', color: '#64748b',
                                    fontStyle: 'italic', textAlign: 'center'
                                  }}>
                                    No shifts available. Please configure shifts in settings.
                                  </div>
                                ) : (
                                  shiftConfigs
                                    .filter(config => config.isActive && config.name.toLowerCase().includes(shiftSearch.toLowerCase()))
                                    .map(config => (
                                      <div
                                        key={config.type}
                                        className="proj-dd-option"
                                        onClick={() => {
                                          setFormData({
                                            ...formData,
                                            shiftType: config.type,
                                            shiftStartTime: config.startTime,
                                            shiftEndTime: config.endTime
                                          });
                                          setShowAddShiftDd(false);
                                          setShiftSearch("");
                                        }}
                                        style={{
                                          padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                          fontWeight: formData.shiftType === config.type ? '600' : '400',
                                          cursor: 'pointer', color: formData.shiftType === config.type ? '#15803d' : '#1e293b',
                                          background: formData.shiftType === config.type ? '#dcfce7' : 'transparent',
                                          marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                          transition: 'all 0.15s'
                                        }}
                                      >{config.name}</div>
                                    ))
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {formData.shiftType && (
                        <div className="emp-field">
                          <label className="emp-lbl">Shift Timing</label>
                          <div style={{
                            padding: '10px 12px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#475569',
                            fontWeight: '500'
                          }}>
                            {(() => {
                              const selectedShift = shiftConfigs.find(config => config.type === formData.shiftType);
                              return selectedShift ? `${selectedShift.startTime} - ${selectedShift.endTime}` : "Select a shift to see timing";
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Additional Employee Information */}
                    <div className="emp-section-lbl">Additional Information</div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Date of Joining</label>
                        <input type="date" className="emp-input" value={formData.joiningDate ? new Date(formData.joiningDate).toISOString().split('T')[0] : ''} onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })} />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Date of Birth</label>
                        <input type="date" className="emp-input" value={formData.dateOfBirth ? new Date(formData.dateOfBirth).toISOString().split('T')[0] : ''} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} />
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Father's Name</label>
                        <input type="text" className="emp-input" placeholder="Enter father's name" value={formData.fatherName || ''} onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })} />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Highest Qualification</label>
                        <input type="text" className="emp-input" placeholder="e.g., B.Tech, MBA" value={formData.highestQualification || ''} onChange={(e) => setFormData({ ...formData, highestQualification: e.target.value })} />
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Alternate Contact Number</label>
                        <input type="tel" className="emp-input" placeholder="10 digit number" value={formData.alternatePhone || ''} onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value.replace(/\D/g, '') })} maxLength="10" />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Official Email ID</label>
                        <input type="email" className="emp-input" placeholder="official@company.com" value={formData.officialEmail || ''} onChange={(e) => setFormData({ ...formData, officialEmail: e.target.value })} />
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Aadhaar Number</label>
                        <input type="text" className="emp-input" placeholder="12 digit Aadhaar number" value={formData.aadharNumber || ''} onChange={(e) => setFormData({ ...formData, aadharNumber: e.target.value.replace(/\D/g, '') })} maxLength="12" />
                      </div>
                    </div>
                    <div className="emp-field">
                      <label className="emp-lbl">Current Address</label>
                      <textarea className="emp-input" placeholder="Enter current residential address" value={formData.currentAddress || ''} onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })} rows="2" style={{ resize: 'vertical', minHeight: '60px' }} />
                    </div>
                    <div className="emp-field">
                      <label className="emp-lbl">Permanent Address</label>
                      <textarea className="emp-input" placeholder="Enter permanent address" value={formData.permanentAddress || ''} onChange={(e) => setFormData({ ...formData, permanentAddress: e.target.value })} rows="2" style={{ resize: 'vertical', minHeight: '60px' }} />
                    </div>

                    <div className="emp-footer">
                      <button type="button" className="emp-btn-ghost" onClick={() => setShowModal(false)}><span>Cancel</span></button>
                      <button type="button" className="emp-btn-primary" onClick={nextStep}><span>Next</span></button>
                    </div>
                  </>
                )}

                {formStep === 2 && (
                  <>
                    <div className="emp-section-lbl">Banking Details</div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Bank Name</label>
                        <input type="text" className="emp-input" placeholder="e.g., State Bank of India" value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Account Holder Name</label>
                        <input type="text" className="emp-input" placeholder="Name as per bank" value={formData.accountHolderName} onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })} />
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Account Number</label>
                        <input type="text" className="emp-input" placeholder="Enter account number" value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">IFSC Code</label>
                        <input type="text" className="emp-input" placeholder="e.g., SBIN0001234" value={formData.ifscCode} onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })} />
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">PAN Number</label>
                        <input type="text" className="emp-input" placeholder="e.g., ABCDE1234F" value={formData.panNumber} onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })} />
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">UPI ID</label>
                        <input type="text" className="emp-input" placeholder="e.g., name@upi" value={formData.upiId} onChange={(e) => setFormData({ ...formData, upiId: e.target.value })} />
                      </div>
                    </div>
                    <div className="emp-footer">
                      <button type="button" className="emp-btn-ghost" onClick={prevStep}><span>Back</span></button>
                      <button type="button" className="emp-btn-primary" onClick={nextStep}><span>Next</span></button>
                    </div>
                  </>
                )}

                {formStep === 3 && (
                  <>
                    <div className="emp-section-lbl">Employee Documents</div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Aadhar Card</label>
                        <div className="emp-file-btn">
                          <div className={`emp-file-placeholder ${docFiles.aadharCard ? 'emp-file-selected' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            {docFiles.aadharCard ? docFiles.aadharCard.name : 'Upload Aadhar...'}
                          </div>
                          <input type="file" className="emp-file-input" onChange={(e) => setDocFiles({ ...docFiles, aadharCard: e.target.files[0] })} />
                        </div>
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">PAN Card</label>
                        <div className="emp-file-btn">
                          <div className={`emp-file-placeholder ${docFiles.panCard ? 'emp-file-selected' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            {docFiles.panCard ? docFiles.panCard.name : 'Upload PAN...'}
                          </div>
                          <input type="file" className="emp-file-input" onChange={(e) => setDocFiles({ ...docFiles, panCard: e.target.files[0] })} />
                        </div>
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">10th Marksheet</label>
                        <div className="emp-file-btn">
                          <div className={`emp-file-placeholder ${docFiles.markSheet10 ? 'emp-file-selected' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            {docFiles.markSheet10 ? docFiles.markSheet10.name : 'Upload 10th...'}
                          </div>
                          <input type="file" className="emp-file-input" onChange={(e) => setDocFiles({ ...docFiles, markSheet10: e.target.files[0] })} />
                        </div>
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">12th Marksheet</label>
                        <div className="emp-file-btn">
                          <div className={`emp-file-placeholder ${docFiles.markSheet12 ? 'emp-file-selected' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            {docFiles.markSheet12 ? docFiles.markSheet12.name : 'Upload 12th...'}
                          </div>
                          <input type="file" className="emp-file-input" onChange={(e) => setDocFiles({ ...docFiles, markSheet12: e.target.files[0] })} />
                        </div>
                      </div>
                    </div>
                    <div className="emp-field-row">
                      <div className="emp-field">
                        <label className="emp-lbl">Graduation</label>
                        <div className="emp-file-btn">
                          <div className={`emp-file-placeholder ${docFiles.graduation ? 'emp-file-selected' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            {docFiles.graduation ? docFiles.graduation.name : 'Upload Graduation...'}
                          </div>
                          <input type="file" className="emp-file-input" onChange={(e) => setDocFiles({ ...docFiles, graduation: e.target.files[0] })} />
                        </div>
                      </div>
                      <div className="emp-field">
                        <label className="emp-lbl">Other Document</label>
                        <div className="emp-file-btn">
                          <div className={`emp-file-placeholder ${docFiles.otherDocs ? 'emp-file-selected' : ''}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                            {docFiles.otherDocs ? docFiles.otherDocs.name : 'Upload Other...'}
                          </div>
                          <input type="file" className="emp-file-input" onChange={(e) => setDocFiles({ ...docFiles, otherDocs: e.target.files[0] })} />
                        </div>
                      </div>
                    </div>
                    <div className="emp-footer">
                      <button type="button" className="emp-btn-ghost" onClick={prevStep}><span>Back</span></button>
                      <button type="submit" className="emp-btn-primary" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.6 : 1, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}><span>{isSubmitting ? 'Adding...' : 'Finish & Add Employee'}</span></button>
                    </div>
                  </>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Employee Modal */}
      {showViewModal && selectedEmployee && (
        <div
          className="modal-overlay"
          onClick={(e) => handleOverlayClick(e, () => setShowViewModal(false))}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1200, padding: "10px"
          }}
        >
          <style>{`
            .emp-detail-scroll::-webkit-scrollbar{display:none}
            .emp-detail-scroll{-ms-overflow-style:none;scrollbar-width:none}
            
            @keyframes flipIn {
              0% {
                transform: perspective(1200px) rotateY(-80deg) rotateX(10deg) scale(0.3);
                opacity: 0;
              }
              40% {
                transform: perspective(1200px) rotateY(-20deg) rotateX(5deg) scale(0.8);
                opacity: 0.8;
              }
              70% {
                transform: perspective(1200px) rotateY(5deg) rotateX(-2deg) scale(1.02);
                opacity: 1;
              }
              100% {
                transform: perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1);
                opacity: 1;
              }
            }
            
            .emp-flip-container {
              animation: flipIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1);
              transform-style: preserve-3d;
              transform-origin: center center;
            }
            
            @keyframes slideInLeft {
              0% {
                transform: translateX(-50px) scale(0.9);
                opacity: 0;
              }
              100% {
                transform: translateX(0) scale(1);
                opacity: 1;
              }
            }
            
            @keyframes slideInRight {
              0% {
                transform: translateX(50px) scale(0.9);
                opacity: 0;
              }
              100% {
                transform: translateX(0) scale(1);
                opacity: 1;
              }
            }
            
            .emp-card-left {
              animation: slideInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s backwards;
            }
            
            .emp-card-right {
              animation: slideInRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s backwards;
            }

            @media (max-width: 768px) {
              .emp-flip-container {
                max-width: 96vw !important;
                width: 96vw !important;
              }
              .emp-card-left {
                flex: 1 1 100% !important;
                min-width: 0 !important;
              }
              .emp-card-right {
                flex: 1 1 100% !important;
                min-width: 0 !important;
              }
            }
          `}</style>
          <div
            className="emp-detail-scroll emp-flip-container"
            style={{
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              width: "100%", maxWidth: showAccessControl ? "1180px" : "860px",
              maxHeight: "90vh", overflowY: "auto",
              transition: "max-width 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            <div style={{ display: "flex", gap: "16px", alignItems: "stretch", flexWrap: "wrap" }}>

              {/* ── Left card ── */}
              <div className="emp-card-left" style={{
                flex: "0 0 230px", minWidth: "210px",
                background: "#fff", borderRadius: "14px",
                border: "1px solid #e5e7eb", padding: "16px",
                display: "flex", flexDirection: "column", gap: "10px"
              }}>
                {/* Avatar */}
                <div style={{
                  height: "160px", borderRadius: "11px", overflow: "hidden",
                  background: "#f0fdf4",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <div style={{
                    width: "80px", height: "80px", borderRadius: "50%",
                    background: "#166534",
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                    </svg>
                  </div>
                </div>

                {/* Name + verified */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </div>
                  <div style={{
                    width: "14px", height: "14px", borderRadius: "50%",
                    background: selectedEmployee.isActive ? "#4caf50" : "#dc2626",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                  }}>
                    {selectedEmployee.isActive ? (
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
                <div style={{ display: "grid", gap: "6px", marginTop: "8px" }}>
                  {[
                    ["Employee ID", selectedEmployee.employeeId],
                    ["Designation", selectedEmployee.designation || "—"],
                    ["Department", selectedEmployee.department || "—"],
                    ["Role", selectedEmployee.role?.name || "—"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>{label}</span>
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "#111827", textAlign: "right" }}>{val}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  {canUpdateEmployee && <button
                    type="button"
                    onClick={() => { setShowViewModal(false); handleEditEmployee(selectedEmployee); }}
                    style={{
                      flex: 1, border: "none", borderRadius: "999px",
                      background: "linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%)",
                      color: "#1f2937", padding: "8px 10px",
                      fontSize: "10px", fontWeight: 600, cursor: "pointer"
                    }}
                  >
                    Edit Employee
                  </button>}

                  {!selectedEmployee.isActive && (
                    <button
                      type="button"
                      onClick={() => setShowClosureSide(!showClosureSide)}
                      style={{
                        flex: 1, border: "none", borderRadius: "999px",
                        background: "#dc2626",
                        color: "#fff",
                        padding: "8px 10px", fontSize: "10px", fontWeight: 600, cursor: "pointer", transition: "all 0.3s"
                      }}
                    >
                      {showClosureSide ? "Back" : "View Closure"}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Right card (Flip Container) ── */}
              <div className="emp-card-right" style={{ flex: "1 1 340px", minWidth: "260px", perspective: "1000px" }}>
                <div style={{
                  position: "relative", width: "100%", height: "100%", minHeight: "460px",
                  transition: "transform 0.6s", transformStyle: "preserve-3d",
                  transform: showClosureSide ? "rotateY(180deg)" : "rotateY(0deg)"
                }}>
                  {/* Front Side */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                    backfaceVisibility: "hidden", background: "#fff", borderRadius: "14px",
                    border: "1px solid #e5e7eb", padding: "14px",
                    display: "flex", flexDirection: "column", gap: "10px"
                  }}>
                    {/* Header row */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontSize: "18px", fontWeight: 700, color: "#111827" }}>
                          Employee Details
                        </div>
                        <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                          Personal, contact & banking information
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => setShowAccessControl(!showAccessControl)}
                          style={{
                            border: "none",
                            background: showAccessControl ? "linear-gradient(135deg, #eab308, #ca8a04)" : "linear-gradient(135deg, #fef08a, #facc15)",
                            color: showAccessControl ? "#fff" : "#713f12",
                            height: "20px",
                            borderRadius: "999px",
                            padding: "0 8px",
                            fontSize: "9px",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            transition: "all 0.3s",
                            marginTop: "6px", /* Shift downwards */
                            letterSpacing: "0.02em"
                          }}
                        >
                          Access Control
                        </button>
                        <button
                          onClick={() => setShowViewModal(false)}
                          style={{
                            border: "1px solid #d1d5db", background: "#fff", color: "#6b7280",
                            width: "30px", height: "30px", borderRadius: "50%",
                            fontSize: "15px", cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center", flexShrink: 0
                          }}
                        >×</button>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div style={{
                      display: "flex", background: "#f3f4f6",
                      borderRadius: "999px", padding: "3px"
                    }}>
                      {[
                        ["info", "Information"],
                        ["banking", "Banking"]
                      ].map(([id, label]) => (
                        <button key={id} onClick={() => setViewModalTab(id)} style={{
                          flex: 1, border: "none", borderRadius: "999px",
                          background: viewModalTab === id ? "#a3e635" : "transparent",
                          padding: "6px 10px", fontSize: "11px", fontWeight: 600,
                          color: viewModalTab === id ? "#365314" : "#374151", cursor: "pointer", transition: "background 0.2s"
                        }}>{label}</button>
                      ))}
                    </div>

                    <div className="custom-scroll" style={{ height: "350px", overflowY: "auto", paddingRight: "8px" }}>

                      {viewModalTab === "info" && (
                        <>

                          {/* Status badge */}
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                            <span style={{
                              fontSize: "9px", fontWeight: 600, borderRadius: "999px", padding: "3px 10px",
                              background: selectedEmployee.isActive ? "#e9f8ef" : "#fef2f2",
                              color: selectedEmployee.isActive ? "#2e7d32" : "#dc2626",
                              border: `1px solid ${selectedEmployee.isActive ? "#b7e4c7" : "#fecaca"}`
                            }}>
                              {selectedEmployee.isActive ? "Active" : "Inactive"}
                            </span>
                            {selectedEmployee.gender && (
                              <span style={{
                                fontSize: "9px", fontWeight: 600, borderRadius: "999px", padding: "3px 10px",
                                background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe"
                              }}>{selectedEmployee.gender}</span>
                            )}
                          </div>

                          {/* Info rows */}
                          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                            {[
                              ["Full Name", `${selectedEmployee.firstName} ${selectedEmployee.lastName}`],
                              ["Email", selectedEmployee.email],
                              ["Phone", selectedEmployee.phone || "—"],
                              ["Alternate Phone", selectedEmployee.alternatePhone || "—"],
                              ["Official Email", selectedEmployee.officialEmail || "—"],
                              ["Date of Birth", selectedEmployee.dateOfBirth ? new Date(selectedEmployee.dateOfBirth).toLocaleDateString('en-IN') : "—"],
                              ["Date of Joining", selectedEmployee.joiningDate ? new Date(selectedEmployee.joiningDate).toLocaleDateString('en-IN') : "—"],
                              ["Father's Name", selectedEmployee.fatherName || "—"],
                              ["Highest Qualification", selectedEmployee.highestQualification || "—"],
                              ["Aadhaar Number", selectedEmployee.aadharNumber || "—"],
                              ["Current Address", selectedEmployee.currentAddress || "—"],
                              ["Permanent Address", selectedEmployee.permanentAddress || "—"],
                              ["Role", selectedEmployee.role?.name || "—"],
                              ["Department", selectedEmployee.department || "—"],
                              ["Designation", selectedEmployee.designation || "—"],
                              ["Employee ID", selectedEmployee.employeeId],
                              ["Shift Type", selectedEmployee.shiftType ?
                                (shiftConfigs.find(c => c.type === selectedEmployee.shiftType)?.name ||
                                  (selectedEmployee.shiftType === 'morning' ? 'Morning Shift' :
                                    selectedEmployee.shiftType === 'noon' ? 'Noon Shift' :
                                      selectedEmployee.shiftType === 'evening' ? 'Evening Shift' :
                                        selectedEmployee.shiftType === 'night' ? 'Night Shift' :
                                          selectedEmployee.shiftType.charAt(0).toUpperCase() + selectedEmployee.shiftType.slice(1) + " Shift")) : "Not Assigned"],
                              ["Shift Timing", (!selectedEmployee.shiftType || !selectedEmployee.shiftStartTime || !selectedEmployee.shiftEndTime) ? "Not Assigned" : `${selectedEmployee.shiftStartTime} - ${selectedEmployee.shiftEndTime}`],
                            ].map(([label, val]) => (
                              <div key={label} style={{
                                display: "flex", justifyContent: "space-between",
                                padding: "8px 0", borderBottom: "1px solid #f3f4f6"
                              }}>
                                <span style={{ color: "#4b5563", fontSize: "12px" }}>{label}</span>
                                <span style={{ fontWeight: 600, fontSize: "12px", color: "#111827", textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{val}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {viewModalTab === "banking" && (
                        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                          {[
                            ["Bank Name", selectedEmployee.bankName || "—"],
                            ["Account Holder", selectedEmployee.accountHolderName || "—"],
                            ["Account Number", selectedEmployee.accountNumber || "—"],
                            ["IFSC Code", selectedEmployee.ifscCode || "—"],
                            ["PAN Number", selectedEmployee.panNumber || "—"],
                            ["UPI ID", selectedEmployee.upiId || "—"],
                          ].map(([label, val]) => (
                            <div key={label} style={{
                              display: "flex", justifyContent: "space-between",
                              padding: "8px 0", borderBottom: "1px solid #f3f4f6"
                            }}>
                              <span style={{ color: "#4b5563", fontSize: "12px" }}>{label}</span>
                              <span style={{ fontWeight: 600, fontSize: "12px", color: "#111827", textAlign: "right", maxWidth: "60%" }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>{/* end tab content wrapper */}
                  </div>

                  {/* Back Side */}
                  <div style={{
                    position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
                    backfaceVisibility: "hidden", background: "#fff", borderRadius: "14px",
                    border: "1px solid #e5e7eb", padding: "14px",
                    display: "flex", flexDirection: "column", gap: "10px",
                    transform: "rotateY(180deg)"
                  }}>
                    {/* Header row for back */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div>
                          <div style={{ fontSize: "18px", fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: "8px" }}>
                            Closure Details
                            {canUpdateEmployee && (
                              <svg
                                onClick={() => { setShowViewModal(false); handleEditClosure(selectedEmployee); }}
                                width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                style={{ cursor: "pointer", transition: "stroke 0.2s" }}
                                onMouseEnter={(e) => e.target.style.stroke = "#2563eb"}
                                onMouseLeave={(e) => e.target.style.stroke = "#6b7280"}
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            )}
                          </div>
                          <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px" }}>
                            Information about employee deactivation
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() => setShowViewModal(false)}
                          style={{
                            border: "1px solid #d1d5db", background: "#fff", color: "#6b7280",
                            width: "30px", height: "30px", borderRadius: "50%",
                            fontSize: "15px", cursor: "pointer", display: "flex",
                            alignItems: "center", justifyContent: "center", flexShrink: 0
                          }}
                        >×</button>
                      </div>
                    </div>
                    <div className="custom-scroll" style={{ height: "390px", overflowY: "auto", paddingRight: "8px" }}>
                      {selectedEmployee?.deactivationDetails ? (
                        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                          {[
                            ["Last Working Day", selectedEmployee.deactivationDetails.lastWorkingDay ? new Date(selectedEmployee.deactivationDetails.lastWorkingDay).toLocaleDateString('en-IN') : "—"],
                            ["Leaving Type", selectedEmployee.deactivationDetails.leavingType || "—"],
                            ["Reason", selectedEmployee.deactivationDetails.reason || "—"],
                            ["Exit Formalities", selectedEmployee.deactivationDetails.exitFormalities || "—"],
                            ["Handover Status", selectedEmployee.deactivationDetails.handover || "—"],
                            ["Handover To", selectedEmployee.deactivationDetails.handoverTo || "—"],
                            ...(selectedEmployee.deactivationDetails.handover !== 'Completed' ? [["Handover Reason", selectedEmployee.deactivationDetails.handoverReason || "—"]] : []),
                            ["Deactivated On", selectedEmployee.updatedAt ? new Date(selectedEmployee.updatedAt).toLocaleDateString('en-IN') : "—"],
                            ["Deactivated By", selectedEmployee.deactivationDetails.addedBy || "—"]
                          ].map(([label, val]) => (
                            <div key={label} style={{
                              display: "flex", justifyContent: "space-between",
                              padding: "8px 0", borderBottom: "1px solid #f3f4f6"
                            }}>
                              <span style={{ color: "#4b5563", fontSize: "12px", minWidth: "100px" }}>{label}</span>
                              <span style={{ fontWeight: 600, fontSize: "12px", color: "#111827", textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>{val}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: "12px" }}>
                          No closure details available for this employee.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Access Control Card ── */}
              <div className="emp-card-right" style={{
                flex: showAccessControl ? "0 0 300px" : "0 0 0px",
                minWidth: showAccessControl ? "260px" : "0px",
                width: showAccessControl ? "300px" : "0px",
                height: "460px", /* Fixed height to match other cards */
                background: "#fff", borderRadius: "14px",
                border: showAccessControl ? "1px solid #e5e7eb" : "none",
                padding: showAccessControl ? "16px" : "0px",
                display: "flex", flexDirection: "column", gap: "10px",
                opacity: showAccessControl ? 1 : 0,
                overflow: "hidden",
                transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                visibility: showAccessControl ? "visible" : "hidden"
              }}>
                <div style={{ minWidth: "260px", display: "flex", flexDirection: "column", height: "100%", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                      Access Control
                    </div>
                    {!isAddingModule && (
                      <button onClick={() => {
                        setIsAddingModule(true);
                        setModuleFormData({ title: '', description: '' });
                        setEditingModuleId(null);
                      }} style={{ background: "#f3f4f6", border: "none", borderRadius: "4px", padding: "4px 8px", fontSize: "10px", fontWeight: 600, cursor: "pointer", color: "#4b5563", transition: "background 0.2s" }} onMouseEnter={(e) => e.target.style.background = "#e5e7eb"} onMouseLeave={(e) => e.target.style.background = "#f3f4f6"}>+ Add</button>
                    )}
                  </div>
                  <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "-6px", marginBottom: "6px", flexShrink: 0 }}>
                    Manage access details for this employee
                  </div>

                  {/* Permissions UI Placeholder or implementation */}
                  <div className="custom-scroll" style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, overflowY: "auto", paddingRight: "4px" }}>
                    {isAddingModule && (
                      <div style={{ border: "1px solid #e5e7eb", padding: "10px", borderRadius: "8px", background: "#fff" }}>
                        <input type="text" placeholder="Title" value={moduleFormData.title} onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })} style={{ width: "100%", marginBottom: "8px", padding: "6px 8px", fontSize: "12px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
                        <input type="text" placeholder="Description" value={moduleFormData.description} onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })} style={{ width: "100%", marginBottom: "8px", padding: "6px 8px", fontSize: "11px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button onClick={() => {
                            if (moduleFormData.title) {
                              updateAccessModulesAPI([{ id: Date.now().toString(), title: moduleFormData.title, description: moduleFormData.description }, ...accessModules]);
                              setIsAddingModule(false);
                            }
                          }} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 10px", fontSize: "10px", cursor: "pointer" }}>Save</button>
                          <button onClick={() => setIsAddingModule(false)} style={{ background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: "4px", padding: "4px 10px", fontSize: "10px", cursor: "pointer" }}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {accessModules.map(module => (
                      <div key={module.id} style={{
                        border: "1px solid #f3f4f6", padding: "10px", borderRadius: "8px",
                        background: "#f8fafc"
                      }}>
                        {editingModuleId === module.id ? (
                          <div>
                            <input type="text" value={moduleFormData.title} onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })} style={{ width: "100%", marginBottom: "8px", padding: "6px 8px", fontSize: "12px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
                            <input type="text" value={moduleFormData.description} onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })} style={{ width: "100%", marginBottom: "8px", padding: "6px 8px", fontSize: "11px", border: "1px solid #d1d5db", borderRadius: "4px" }} />
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => {
                                updateAccessModulesAPI(accessModules.map(m => m.id === module.id ? { ...m, title: moduleFormData.title, description: moduleFormData.description } : m));
                                setEditingModuleId(null);
                              }} style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", padding: "4px 10px", fontSize: "10px", cursor: "pointer" }}>Save</button>
                              <button onClick={() => setEditingModuleId(null)} style={{ background: "#f3f4f6", color: "#4b5563", border: "none", borderRadius: "4px", padding: "4px 10px", fontSize: "10px", cursor: "pointer" }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div>
                                <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>{module.title}</div>
                                {module.description && <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>{module.description}</div>}
                              </div>
                              <div style={{ display: "flex", gap: "4px" }}>
                                <button onClick={() => { setEditingModuleId(module.id); setModuleFormData({ title: module.title, description: module.description || '' }); setIsAddingModule(false); }} style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", padding: "2px" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                </button>
                                <button onClick={() => {
                                  if (window.confirm("Are you sure you want to delete this record?")) {
                                    updateAccessModulesAPI(accessModules.filter(m => m.id !== module.id));
                                  }
                                }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "2px" }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {showEditModal && selectedEmployee && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, () => setShowEditModal(false))}>
          <div className="emp-modal">
            <div className="emp-modal-sticky-head">
              <div className="emp-modal-hd">
                <div className="emp-modal-hd-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                </div>
                <div>
                  <div className="emp-modal-title">Edit Employee</div>
                  <div className="emp-modal-sub">{selectedEmployee.firstName} {selectedEmployee.lastName} &middot; {selectedEmployee.employeeId}</div>
                </div>
                <button className="emp-close-btn" onClick={() => setShowEditModal(false)}>&times;</button>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="emp-modal-body" autoComplete="off">
              <div className="emp-form">
                <div className="emp-section-lbl">Basic Information</div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">First Name<span className="emp-req">*</span></label>
                    <input type="text" className="emp-input" placeholder="Enter first name" value={editFormData.firstName} onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })} required />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Last Name</label>
                    <input type="text" className="emp-input" placeholder="Enter last name" value={editFormData.lastName} onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Email<span className="emp-req">*</span></label>
                    <input type="email" className="emp-input" placeholder="employee@company.com" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} required />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Employee ID<span className="emp-req">*</span></label>
                    <div style={{ display: 'flex' }}>
                      <span style={{
                        padding: '9px 12px',
                        background: '#f8fafc',
                        border: `1.5px solid ${editFormData.employeeId && existingEmpForEditId ? '#ef4444' : editFormData.employeeId ? '#22c55e' : '#e5e7eb'}`,
                        borderRight: 'none',
                        borderRadius: '9px 0 0 9px',
                        color: editFormData.employeeId && existingEmpForEditId ? '#ef4444' : '#64748b',
                        fontSize: '13px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'all 0.2s ease'
                      }}>EMP</span>
                      <input
                        type="text"
                        className="emp-input"
                        style={{
                          borderRadius: '0 9px 9px 0',
                          borderColor: editFormData.employeeId && existingEmpForEditId ? '#ef4444' : editFormData.employeeId ? '#22c55e' : '#e5e7eb',
                          transition: 'all 0.2s ease'
                        }}
                        placeholder="001"
                        maxLength="6"
                        value={editFormData.employeeId ? editFormData.employeeId.replace(/^EMP/i, '') : ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setEditFormData({ ...editFormData, employeeId: val ? `EMP${val}` : '' });
                        }}
                        onBlur={() => {
                          const raw = editFormData.employeeId ? editFormData.employeeId.replace(/^EMP/i, '').replace(/\D/g, '') : '';
                          if (raw) {
                            setEditFormData(prev => ({ ...prev, employeeId: `EMP${raw.padStart(3, '0')}` }));
                          }
                        }}
                        required
                      />
                    </div>
                    {/* Real-time Employee ID existence indicator */}
                    {editFormData.employeeId && existingEmpForEditId ? (
                      <div style={{ marginTop: '5px', fontSize: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}>
                        <AlertCircle size={13} style={{ flexShrink: 0 }} />
                        <span>EMP{editFormData.employeeId.replace(/^EMP/i, '')} is already assigned to {existingEmpForEditId.firstName} {existingEmpForEditId.lastName} ({existingEmpForEditId.designation || existingEmpForEditId.role?.name || 'Employee'})</span>
                      </div>
                    ) : editFormData.employeeId ? (
                      <div style={{ marginTop: '5px', fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: '500' }}>
                        <CheckCircle2 size={13} style={{ flexShrink: 0 }} />
                        <span>EMP{(editFormData.employeeId.replace(/^EMP/i, '')).padStart(3, '0')} is available</span>
                      </div>
                    ) : (
                      <div style={{ marginTop: '4px', fontSize: '11px', color: '#94a3b8' }}>
                        Min 3 digits
                      </div>
                    )}
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Role<span className="emp-req">*</span></label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowEditRoleDd(!showEditRoleDd); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                          fontSize: '13px', fontWeight: '400', cursor: 'pointer',
                          background: showEditRoleDd ? '#f8fafc' : '#ffffff',
                          color: editFormData.role ? '#0f172a' : '#9ca3af', outline: 'none',
                          fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = showEditRoleDd ? '#3b82f6' : '#e2e8f0'}
                      >
                        <span>{editFormData.role ? roles.find(r => r._id === editFormData.role)?.name || "Select Role" : "Select Role"}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEditRoleDd ? 'rotate(180deg)' : 'none' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {showEditRoleDd && (
                        <div onClick={e => e.stopPropagation()} style={{
                          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                          background: '#ffffff', borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                          maxHeight: '200px', padding: '8px', overflow: 'hidden',
                          animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <input
                              type="text"
                              placeholder="Search roles..."
                              value={editRoleSearch}
                              onChange={(e) => setEditRoleSearch(e.target.value)}
                              style={{
                                width: '100%', padding: '6px 10px', border: '1px solid #f1f5f9',
                                borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                outline: 'none', fontFamily: "'Inter', sans-serif"
                              }}
                            />
                          </div>
                          <div style={{ maxHeight: '150px', overflowY: 'auto' }} className="emp-modal-scroll">
                            <div
                              className="proj-dd-option"
                              onClick={() => { setEditFormData({ ...editFormData, role: "" }); setShowEditRoleDd(false); setEditRoleSearch(""); }}
                              style={{
                                padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                fontWeight: editFormData.role === "" ? '600' : '400',
                                cursor: 'pointer', color: editFormData.role === "" ? '#15803d' : '#1e293b',
                                background: editFormData.role === "" ? '#dcfce7' : 'transparent',
                                marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                transition: 'all 0.15s'
                              }}
                            >Select Role</div>
                            {roles.length === 0 ? (
                              <div style={{
                                padding: '8px 10px', fontSize: '12px', color: '#64748b',
                                fontStyle: 'italic', textAlign: 'center'
                              }}>
                                No roles available. Please create roles in the User Roles module.
                              </div>
                            ) : (
                              roles.filter(r => r.name.toLowerCase().includes(editRoleSearch.toLowerCase())).map(role => (
                                <div
                                  key={role._id}
                                  className="proj-dd-option"
                                  onClick={() => { setEditFormData({ ...editFormData, role: role._id }); setShowEditRoleDd(false); setEditRoleSearch(""); }}
                                  style={{
                                    padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                    fontWeight: editFormData.role === role._id ? '600' : '400',
                                    cursor: 'pointer', color: editFormData.role === role._id ? '#15803d' : '#1e293b',
                                    background: editFormData.role === role._id ? '#dcfce7' : 'transparent',
                                    marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                    transition: 'all 0.15s'
                                  }}
                                >{role.name}</div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Department</label>
                    <input type="text" className="emp-input" placeholder="e.g., Engineering" value={editFormData.department} onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })} list="edit-department-list" autoComplete="off" />
                    <datalist id="edit-department-list">
                      {departments.map((dept, index) => (<option key={index} value={dept} />))}
                    </datalist>
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Designation</label>
                    <input type="text" className="emp-input" placeholder="e.g., Software Engineer" value={editFormData.designation} onChange={(e) => setEditFormData({ ...editFormData, designation: e.target.value })} list="edit-designation-list" autoComplete="off" />
                    <datalist id="edit-designation-list">
                      {designations.map((desig, index) => (<option key={index} value={desig} />))}
                    </datalist>
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Assign Manager</label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowEditManagerDd(!showEditManagerDd); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                          fontSize: '13px', fontWeight: '400', cursor: 'pointer',
                          background: showEditManagerDd ? '#f8fafc' : '#ffffff',
                          color: editFormData.assignedManager ? '#0f172a' : '#9ca3af', outline: 'none',
                          fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = showEditManagerDd ? '#3b82f6' : '#e2e8f0'}
                      >
                        <span>{editFormData.assignedManager ? (() => {
                          const mgr = managerList.find(m => m._id === editFormData.assignedManager);
                          return mgr ? `${mgr.firstName} ${mgr.lastName} (${mgr.employeeId})` : "Select Manager";
                        })() : "Select Manager"}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEditManagerDd ? 'rotate(180deg)' : 'none' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {showEditManagerDd && (
                        <div onClick={e => e.stopPropagation()} style={{
                          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                          background: '#ffffff', borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                          maxHeight: '200px', padding: '8px', overflow: 'hidden',
                          animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <input
                              type="text"
                              placeholder="Search manager..."
                              value={editManagerSearch}
                              onChange={(e) => setEditManagerSearch(e.target.value)}
                              style={{
                                width: '100%', padding: '6px 10px', border: '1px solid #f1f5f9',
                                borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                outline: 'none', fontFamily: "'Inter', sans-serif"
                              }}
                            />
                          </div>
                          <div style={{ maxHeight: '150px', overflowY: 'auto' }} className="emp-modal-scroll">
                            <div
                              className="proj-dd-option"
                              onClick={() => { setEditFormData({ ...editFormData, assignedManager: "" }); setShowEditManagerDd(false); setEditManagerSearch(""); }}
                              style={{
                                padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                fontWeight: editFormData.assignedManager === "" ? '600' : '400',
                                cursor: 'pointer', color: editFormData.assignedManager === "" ? '#15803d' : '#1e293b',
                                background: editFormData.assignedManager === "" ? '#dcfce7' : 'transparent',
                                marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                transition: 'all 0.15s'
                              }}
                            >No Manager</div>
                            {managerList.filter(m => `${m.firstName} ${m.lastName} ${m.employeeId}`.toLowerCase().includes(editManagerSearch.toLowerCase())).map(mgr => (
                              <div
                                key={mgr._id}
                                className="proj-dd-option"
                                onClick={() => { setEditFormData({ ...editFormData, assignedManager: mgr._id }); setShowEditManagerDd(false); setEditManagerSearch(""); }}
                                style={{
                                  padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                  fontWeight: editFormData.assignedManager === mgr._id ? '600' : '400',
                                  cursor: 'pointer', color: editFormData.assignedManager === mgr._id ? '#15803d' : '#1e293b',
                                  background: editFormData.assignedManager === mgr._id ? '#dcfce7' : 'transparent',
                                  marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                  transition: 'all 0.15s'
                                }}
                              >
                                {mgr.firstName} {mgr.lastName} ({mgr.employeeId}) - {mgr.designation} - {mgr.role?.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Phone</label>
                    <input type="tel" className="emp-input" placeholder="10 digit number" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value.replace(/\D/g, '') })} maxLength="10" />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Gender</label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowEditGenderDd(!showEditGenderDd); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                          fontSize: '13px', fontWeight: '400', cursor: 'pointer',
                          background: showEditGenderDd ? '#f8fafc' : '#ffffff',
                          color: editFormData.gender ? '#0f172a' : '#9ca3af', outline: 'none',
                          fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = showEditGenderDd ? '#3b82f6' : '#e2e8f0'}
                      >
                        <span>{editFormData.gender ? editFormData.gender.charAt(0).toUpperCase() + editFormData.gender.slice(1) : "Select gender"}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEditGenderDd ? 'rotate(180deg)' : 'none' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      {showEditGenderDd && (
                        <div onClick={e => e.stopPropagation()} style={{
                          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                          background: '#ffffff', borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                          padding: '8px', overflow: 'hidden',
                          animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ maxHeight: '150px', overflowY: 'auto' }} className="emp-modal-scroll">
                            {['male', 'female', 'other'].map(genderVal => (
                              <div
                                key={genderVal}
                                className="proj-dd-option"
                                onClick={() => { setEditFormData({ ...editFormData, gender: genderVal }); setShowEditGenderDd(false); }}
                                style={{
                                  padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                  fontWeight: editFormData.gender === genderVal ? '600' : '400',
                                  cursor: 'pointer', color: editFormData.gender === genderVal ? '#15803d' : '#1e293b',
                                  background: editFormData.gender === genderVal ? '#dcfce7' : 'transparent',
                                  marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                  transition: 'all 0.15s'
                                }}
                              >
                                {genderVal.charAt(0).toUpperCase() + genderVal.slice(1)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional Information Section */}
                <div className="emp-section-lbl" style={{ marginTop: '8px' }}>Additional Information</div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Date of Joining</label>
                    <input
                      type="date"
                      className="emp-input"
                      value={editFormData.joiningDate ? new Date(editFormData.joiningDate).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditFormData({ ...editFormData, joiningDate: e.target.value })}
                    />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Date of Birth</label>
                    <input
                      type="date"
                      className="emp-input"
                      value={editFormData.dateOfBirth ? new Date(editFormData.dateOfBirth).toISOString().split('T')[0] : ''}
                      onChange={(e) => setEditFormData({ ...editFormData, dateOfBirth: e.target.value })}
                    />
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Father's Name</label>
                    <input
                      type="text"
                      className="emp-input"
                      placeholder="Enter father's name"
                      value={editFormData.fatherName || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, fatherName: e.target.value })}
                    />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Highest Qualification</label>
                    <input
                      type="text"
                      className="emp-input"
                      placeholder="e.g., B.Tech, MBA"
                      value={editFormData.highestQualification || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, highestQualification: e.target.value })}
                    />
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Alternate Contact Number</label>
                    <input
                      type="tel"
                      className="emp-input"
                      placeholder="10 digit number"
                      value={editFormData.alternatePhone || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, alternatePhone: e.target.value.replace(/\D/g, '') })}
                      maxLength="10"
                    />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Official Email ID</label>
                    <input
                      type="email"
                      className="emp-input"
                      placeholder="official@company.com"
                      value={editFormData.officialEmail || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, officialEmail: e.target.value })}
                    />
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Aadhaar Number</label>
                    <input
                      type="text"
                      className="emp-input"
                      placeholder="12 digit Aadhaar number"
                      value={editFormData.aadharNumber || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, aadharNumber: e.target.value.replace(/\D/g, '') })}
                      maxLength="12"
                    />
                  </div>
                  <div className="emp-field"></div>
                </div>
                <div className="emp-field">
                  <label className="emp-lbl">Current Address</label>
                  <textarea
                    className="emp-input"
                    placeholder="Enter current residential address"
                    value={editFormData.currentAddress || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, currentAddress: e.target.value })}
                    rows="2"
                    style={{ resize: 'vertical', minHeight: '60px' }}
                  />
                </div>
                <div className="emp-field">
                  <label className="emp-lbl">Permanent Address</label>
                  <textarea
                    className="emp-input"
                    placeholder="Enter permanent address"
                    value={editFormData.permanentAddress || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, permanentAddress: e.target.value })}
                    rows="2"
                    style={{ resize: 'vertical', minHeight: '60px' }}
                  />
                </div>

                {/* Shift Assignment Section */}
                <div className="emp-section-lbl" style={{ marginTop: '8px' }}>Shift Assignment</div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Shift Type<span className="emp-req">*</span></label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowEditShiftDd(!showEditShiftDd); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
                          fontSize: '13px', fontWeight: '400', cursor: 'pointer',
                          background: showEditShiftDd ? '#f8fafc' : '#ffffff',
                          color: editFormData.shiftType ? '#0f172a' : '#9ca3af', outline: 'none',
                          fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = showEditShiftDd ? '#3b82f6' : '#e2e8f0'}
                      >
                        <span>
                          {editFormData.shiftType ?
                            shiftConfigs.find(config => config.type === editFormData.shiftType)?.name || editFormData.shiftType :
                            "Select Shift"
                          }
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEditShiftDd ? 'rotate(180deg)' : 'none' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {showEditShiftDd && (
                        <div onClick={e => e.stopPropagation()} style={{
                          position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                          background: '#ffffff', borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.12)', zIndex: 300,
                          maxHeight: '200px', padding: '8px', overflow: 'hidden',
                          animation: 'empDdIn 0.2s ease', border: '1px solid #e2e8f0'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <input
                              type="text"
                              placeholder="Search shifts..."
                              value={editShiftSearch}
                              onChange={(e) => setEditShiftSearch(e.target.value)}
                              style={{
                                width: '100%', padding: '6px 10px', border: '1px solid #f1f5f9',
                                borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                outline: 'none', fontFamily: "'Inter', sans-serif"
                              }}
                            />
                          </div>
                          <div style={{ maxHeight: '150px', overflowY: 'auto' }} className="emp-modal-scroll">
                            <div
                              className="proj-dd-option"
                              onClick={() => {
                                setEditFormData({ ...editFormData, shiftType: "", shiftStartTime: "", shiftEndTime: "" });
                                setShowEditShiftDd(false);
                                setEditShiftSearch("");
                              }}
                              style={{
                                padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                fontWeight: editFormData.shiftType === "" ? '600' : '400',
                                cursor: 'pointer', color: editFormData.shiftType === "" ? '#15803d' : '#1e293b',
                                background: editFormData.shiftType === "" ? '#dcfce7' : 'transparent',
                                marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                transition: 'all 0.15s'
                              }}
                            >Not Assigned</div>
                            {shiftConfigs.length === 0 ? (
                              <div style={{
                                padding: '8px 10px', fontSize: '12px', color: '#64748b',
                                fontStyle: 'italic', textAlign: 'center'
                              }}>
                                No shifts available. Please configure shifts in settings.
                              </div>
                            ) : (
                              shiftConfigs
                                .filter(config => config.isActive && config.name.toLowerCase().includes(editShiftSearch.toLowerCase()))
                                .map(config => (
                                  <div
                                    key={config.type}
                                    className="proj-dd-option"
                                    onClick={() => {
                                      setEditFormData({
                                        ...editFormData,
                                        shiftType: config.type,
                                        shiftStartTime: config.startTime,
                                        shiftEndTime: config.endTime
                                      });
                                      setShowEditShiftDd(false);
                                      setEditShiftSearch("");
                                    }}
                                    style={{
                                      padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
                                      fontWeight: editFormData.shiftType === config.type ? '600' : '400',
                                      cursor: 'pointer', color: editFormData.shiftType === config.type ? '#15803d' : '#1e293b',
                                      background: editFormData.shiftType === config.type ? '#dcfce7' : 'transparent',
                                      marginBottom: '2px', fontFamily: "'Inter', sans-serif",
                                      transition: 'all 0.15s'
                                    }}
                                  >{config.name}</div>
                                ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {editFormData.shiftType && (
                    <div className="emp-field">
                      <label className="emp-lbl">Shift Timing</label>
                      <div style={{
                        padding: '10px 12px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#475569',
                        fontWeight: '500'
                      }}>
                        {(() => {
                          const selectedShift = shiftConfigs.find(config => config.type === editFormData.shiftType);
                          return selectedShift ? `${selectedShift.startTime} - ${selectedShift.endTime}` : "Select a shift to see timing";
                        })()}
                      </div>
                    </div>
                  )}
                </div>

                <div className="emp-section-lbl" style={{ marginTop: '8px' }}>Banking Details</div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Bank Name</label>
                    <input type="text" className="emp-input" placeholder="e.g., State Bank of India" value={editFormData.bankName} onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })} />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">Account Holder Name</label>
                    <input type="text" className="emp-input" placeholder="Name as per bank account" value={editFormData.accountHolderName} onChange={(e) => setEditFormData({ ...editFormData, accountHolderName: e.target.value })} />
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">Account Number</label>
                    <input type="text" className="emp-input" placeholder="Enter account number" value={editFormData.accountNumber} onChange={(e) => setEditFormData({ ...editFormData, accountNumber: e.target.value })} />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">IFSC Code</label>
                    <input type="text" className="emp-input" placeholder="Enter IFSC code" value={editFormData.ifscCode} onChange={(e) => setEditFormData({ ...editFormData, ifscCode: e.target.value.toUpperCase() })} />
                  </div>
                </div>
                <div className="emp-field-row">
                  <div className="emp-field">
                    <label className="emp-lbl">PAN Number</label>
                    <input type="text" className="emp-input" placeholder="Enter PAN number" value={editFormData.panNumber} onChange={(e) => setEditFormData({ ...editFormData, panNumber: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="emp-field">
                    <label className="emp-lbl">UPI ID</label>
                    <input type="text" className="emp-input" placeholder="Enter UPI ID (e.g., name@upi)" value={editFormData.upiId} onChange={(e) => setEditFormData({ ...editFormData, upiId: e.target.value })} />
                  </div>
                </div>

                <div className="emp-footer">
                  <button type="button" className="emp-btn-ghost" onClick={() => setShowEditModal(false)}><span>Cancel</span></button>
                  <button type="submit" className="emp-btn-primary"><span>Update Employee</span></button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, () => setShowChangePasswordModal(false))}>
          <div className="emp-modal" style={{
            maxWidth: '700px',
            width: '95%',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
            animation: 'modalSlideIn 0.3s ease-out',
            transform: 'scale(1)',
            margin: '20px'
          }}>
            <div className="emp-header" style={{
              padding: '18px 28px 14px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Change Password</h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>Update employee login credentials</p>
              </div>
              <button className="emp-close" onClick={() => setShowChangePasswordModal(false)} style={{
                background: 'none',
                border: 'none',
                fontSize: '22px',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                transition: 'all 0.2s'
              }}>×</button>
            </div>
            <form onSubmit={handleChangePasswordSubmit}>
              <div className="emp-body" style={{ padding: '18px 28px' }}>
                <div style={{
                  marginBottom: '18px',
                  padding: '14px 18px',
                  background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                  borderRadius: '10px',
                  border: '1px solid #bae6fd'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: '#166534',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: '#0f172a', marginBottom: '2px' }}>
                        {selectedEmployeeForPassword?.firstName} {selectedEmployeeForPassword?.lastName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        Employee ID: {selectedEmployeeForPassword?.employeeId}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', marginBottom: '16px' }}>
                  <div className="emp-field">
                    <label className="emp-lbl" style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? "text" : "password"}
                        className="emp-input"
                        placeholder="Enter new password (min 6 characters)"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        required
                        minLength="6"
                        style={{
                          paddingRight: '40px',
                          fontSize: '13px',
                          padding: '10px 40px 10px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          width: '100%',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          fontFamily: "'Inter', sans-serif"
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          padding: '4px',
                          borderRadius: '4px',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#374151'}
                        onMouseLeave={(e) => e.target.style.color = '#64748b'}
                      >
                        {showNewPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="emp-field">
                    <label className="emp-lbl" style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px', display: 'block' }}>Confirm New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        className="emp-input"
                        placeholder="Confirm new password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        required
                        minLength="6"
                        style={{
                          paddingRight: '40px',
                          fontSize: '13px',
                          padding: '10px 40px 10px 12px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          width: '100%',
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          fontFamily: "'Inter', sans-serif"
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                        onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                          padding: '4px',
                          borderRadius: '4px',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.color = '#374151'}
                        onMouseLeave={(e) => e.target.style.color = '#64748b'}
                      >
                        {showConfirmPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {passwordData.newPassword && passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword && (
                  <div style={{
                    padding: '8px 12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#dc2626',
                    marginTop: '8px'
                  }}>
                    Passwords do not match
                  </div>
                )}

                <div style={{
                  padding: '12px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#0369a1',
                  marginTop: '16px'
                }}>
                  <strong>Security Note:</strong> The employee will need to use this new password for their next login. Make sure to communicate the new password securely.
                </div>
              </div>

              <div className="emp-footer" style={{
                padding: '14px 28px 18px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button type="button" className="emp-btn-ghost" onClick={() => setShowChangePasswordModal(false)} style={{
                  padding: '8px 18px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: "'Inter', sans-serif"
                }}>
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="emp-btn-primary"
                  disabled={!passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword}
                  style={{
                    padding: '8px 18px',
                    border: 'none',
                    borderRadius: '8px',
                    background: (!passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword)
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: (!passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword)
                      ? 'not-allowed'
                      : 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: "'Inter', sans-serif",
                    opacity: (!passwordData.newPassword || !passwordData.confirmPassword || passwordData.newPassword !== passwordData.confirmPassword) ? 0.6 : 1
                  }}
                >
                  <span>Change Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="modal-overlay" onClick={(e) => handleOverlayClick(e, () => setShowDeactivateModal(false))}>
          <div className="emp-modal-content" style={{
            background: '#ffffff', borderRadius: '16px', width: '100%', maxWidth: '600px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            height: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div className="emp-header" style={{
              padding: '20px 28px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Deactivate Employee</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>Please provide details before deactivating</p>
              </div>
              <button
                onClick={() => setShowDeactivateModal(false)}
                style={{
                  background: '#f1f5f9', border: 'none', borderRadius: '50%',
                  width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <form onSubmit={submitDeactivate} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="emp-body" style={{
                padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px',
                flex: 1, overflowY: 'auto'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  <div className="emp-form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Last Working Day
                    </label>
                    <input
                      type="date"
                      value={deactivateFormData.lastWorkingDay}
                      onChange={(e) => setDeactivateFormData({ ...deactivateFormData, lastWorkingDay: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
                        fontSize: '13px', color: '#1e293b', background: '#f8fafc', boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div className="emp-form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Leaving Type
                    </label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setLeavingTypeDdPos({ top: rect.bottom, left: rect.left, width: rect.width });
                          setShowLeavingTypeDd(!showLeavingTypeDd);
                          setShowExitDd(false);
                          setShowHandoverDd(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                          width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px',
                          fontSize: '13px', color: deactivateFormData.leavingType ? '#1e293b' : '#9ca3af',
                          background: '#f8fafc',
                          cursor: 'pointer', outline: 'none', fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.25s ease', borderColor: showLeavingTypeDd ? '#3b82f6' : '#cbd5e1'
                        }}
                      >
                        <span>{deactivateFormData.leavingType || "Select leaving type..."}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showLeavingTypeDd ? 'rotate(180deg)' : 'none' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {showLeavingTypeDd && (
                        <>
                          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }} onClick={() => setShowLeavingTypeDd(false)} />
                          <div style={{
                            position: 'fixed', top: leavingTypeDdPos.top + 4, left: leavingTypeDdPos.left, width: leavingTypeDdPos.width,
                            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            zIndex: 10001, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px'
                          }}>
                            <div style={{ marginBottom: '4px' }}>
                              <input
                                type="text"
                                placeholder="Search..."
                                value={leavingTypeSearch}
                                onChange={(e) => setLeavingTypeSearch(e.target.value)}
                                style={{
                                  width: '100%', padding: '8px 12px', border: 'none',
                                  borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                  outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            {["Termination", "Resignation"].filter(o => o.toLowerCase().includes(leavingTypeSearch.toLowerCase())).map(option => (
                              <div
                                key={option}
                                onClick={() => {
                                  setDeactivateFormData({ ...deactivateFormData, leavingType: option });
                                  setShowLeavingTypeDd(false);
                                  setLeavingTypeSearch('');
                                }}
                                onMouseEnter={(e) => { if (deactivateFormData.leavingType !== option) e.currentTarget.style.background = '#f1f5f9' }}
                                onMouseLeave={(e) => { if (deactivateFormData.leavingType !== option) e.currentTarget.style.background = 'transparent' }}
                                style={{
                                  padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                  background: deactivateFormData.leavingType === option ? '#dcfce7' : 'transparent',
                                  color: deactivateFormData.leavingType === option ? '#16a34a' : '#1e293b',
                                  fontWeight: deactivateFormData.leavingType === option ? '500' : '400',
                                  transition: 'background 0.2s'
                                }}
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="emp-form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Reason
                    </label>
                    <textarea
                      rows="3"
                      value={deactivateFormData.reason}
                      onChange={(e) => setDeactivateFormData({ ...deactivateFormData, reason: e.target.value })}
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
                        fontSize: '13px', color: '#1e293b', background: '#f8fafc', boxSizing: 'border-box', resize: 'vertical'
                      }}
                    />
                  </div>

                  <div className="emp-form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Exit Formalities
                    </label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setExitDdPos({ top: rect.bottom, left: rect.left, width: rect.width });
                          setShowExitDd(!showExitDd);
                          setShowHandoverDd(false);
                          setShowLeavingTypeDd(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                          width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px',
                          fontSize: '13px', color: deactivateFormData.exitFormalities ? '#1e293b' : '#9ca3af',
                          background: '#f8fafc',
                          cursor: 'pointer', outline: 'none', fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.25s ease', borderColor: showExitDd ? '#3b82f6' : '#cbd5e1'
                        }}
                      >
                        <span>{deactivateFormData.exitFormalities || "Select status..."}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showExitDd ? 'rotate(180deg)' : 'none' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {showExitDd && (
                        <>
                          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }} onClick={() => setShowExitDd(false)} />
                          <div style={{
                            position: 'fixed', top: exitDdPos.top + 4, left: exitDdPos.left, width: exitDdPos.width,
                            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            zIndex: 10001, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px'
                          }}>
                            <div style={{ marginBottom: '4px' }}>
                              <input
                                type="text"
                                placeholder="Search..."
                                value={exitSearch}
                                onChange={(e) => setExitSearch(e.target.value)}
                                style={{
                                  width: '100%', padding: '8px 12px', border: 'none',
                                  borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                  outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            {["Completed", "Not Completed"].filter(o => o.toLowerCase().includes(exitSearch.toLowerCase())).map(option => (
                              <div
                                key={option}
                                onClick={() => {
                                  setDeactivateFormData({ ...deactivateFormData, exitFormalities: option });
                                  setShowExitDd(false);
                                  setExitSearch('');
                                }}
                                onMouseEnter={(e) => { if (deactivateFormData.exitFormalities !== option) e.currentTarget.style.background = '#f1f5f9' }}
                                onMouseLeave={(e) => { if (deactivateFormData.exitFormalities !== option) e.currentTarget.style.background = 'transparent' }}
                                style={{
                                  padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                  background: deactivateFormData.exitFormalities === option ? '#dcfce7' : 'transparent',
                                  color: deactivateFormData.exitFormalities === option ? '#16a34a' : '#1e293b',
                                  fontWeight: deactivateFormData.exitFormalities === option ? '500' : '400',
                                  transition: 'background 0.2s'
                                }}
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="emp-form-group">
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Handover
                    </label>
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setHandoverDdPos({ top: rect.bottom, left: rect.left, width: rect.width });
                          setShowHandoverDd(!showHandoverDd);
                          setShowExitDd(false);
                          setShowLeavingTypeDd(false);
                          setShowHandoverToDd(false);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                          width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px',
                          fontSize: '13px', color: deactivateFormData.handover ? '#1e293b' : '#9ca3af',
                          background: '#f8fafc',
                          cursor: 'pointer', outline: 'none', fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.25s ease', borderColor: showHandoverDd ? '#3b82f6' : '#cbd5e1'
                        }}
                      >
                        <span>{deactivateFormData.handover || "Select status..."}</span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showHandoverDd ? 'rotate(180deg)' : 'none' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {showHandoverDd && (
                        <>
                          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }} onClick={() => setShowHandoverDd(false)} />
                          <div style={{
                            position: 'fixed', top: handoverDdPos.top + 4, left: handoverDdPos.left, width: handoverDdPos.width,
                            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            zIndex: 10001, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px'
                          }}>
                            <div style={{ marginBottom: '4px' }}>
                              <input
                                type="text"
                                placeholder="Search..."
                                value={handoverSearch}
                                onChange={(e) => setHandoverSearch(e.target.value)}
                                style={{
                                  width: '100%', padding: '8px 12px', border: 'none',
                                  borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                  outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box'
                                }}
                              />
                            </div>
                            {["Completed", "Not Completed"].filter(o => o.toLowerCase().includes(handoverSearch.toLowerCase())).map(option => (
                              <div
                                key={option}
                                onClick={() => {
                                  setDeactivateFormData({
                                    ...deactivateFormData,
                                    handover: option,
                                    handoverTo: option === 'Completed' ? deactivateFormData.handoverTo : '',
                                    handoverReason: option === 'Not Completed' ? deactivateFormData.handoverReason : ''
                                  });
                                  setShowHandoverDd(false);
                                  setHandoverSearch('');
                                }}
                                onMouseEnter={(e) => { if (deactivateFormData.handover !== option) e.currentTarget.style.background = '#f1f5f9' }}
                                onMouseLeave={(e) => { if (deactivateFormData.handover !== option) e.currentTarget.style.background = 'transparent' }}
                                style={{
                                  padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                  background: deactivateFormData.handover === option ? '#dcfce7' : 'transparent',
                                  color: deactivateFormData.handover === option ? '#16a34a' : '#1e293b',
                                  fontWeight: deactivateFormData.handover === option ? '500' : '400',
                                  transition: 'background 0.2s'
                                }}
                              >
                                {option}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {deactivateFormData.handover === 'Completed' && (
                    <>
                      <div className="emp-form-group">
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                          Handover To
                        </label>
                        <div style={{ position: 'relative' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHandoverToDdPos({ top: rect.bottom, left: rect.left, width: rect.width });
                              setShowHandoverToDd(!showHandoverToDd);
                              setShowExitDd(false);
                              setShowHandoverDd(false);
                              setShowLeavingTypeDd(false);
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                              width: '100%', padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px',
                              fontSize: '13px', color: deactivateFormData.handoverTo ? '#1e293b' : '#9ca3af',
                              background: '#f8fafc',
                              cursor: 'pointer', outline: 'none', fontFamily: "'Inter', sans-serif",
                              transition: 'all 0.25s ease', borderColor: showHandoverToDd ? '#3b82f6' : '#cbd5e1'
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deactivateFormData.handoverTo === 'Other' ? 'Other' : (deactivateFormData.handoverTo ? deactivateFormData.handoverTo : "Select employee...")}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showHandoverToDd ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>

                          {showHandoverToDd && (
                            <>
                              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 }} onClick={() => setShowHandoverToDd(false)} />
                              <div style={{
                                position: 'fixed', top: handoverToDdPos.top + 4, left: handoverToDdPos.left, width: handoverToDdPos.width,
                                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                zIndex: 10001, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px'
                              }}>
                                <div style={{ marginBottom: '4px' }}>
                                  <input
                                    type="text"
                                    placeholder="Search..."
                                    value={handoverToSearch}
                                    onChange={(e) => setHandoverToSearch(e.target.value)}
                                    style={{
                                      width: '100%', padding: '8px 12px', border: 'none',
                                      borderRadius: '6px', fontSize: '12px', background: '#f8fafc',
                                      outline: 'none', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }} className="emp-modal-scroll">
                                  {[...employees.filter(emp => emp.role?.name === 'Team Leader').map(emp => `${emp.firstName} ${emp.lastName} (${emp.employeeId}) - ${emp.designation || 'N/A'} - ${emp.role?.name}`), "Other"].filter(o => o.toLowerCase().includes(handoverToSearch.toLowerCase())).map(option => (
                                    <div
                                      key={option}
                                      onClick={() => {
                                        setDeactivateFormData({ ...deactivateFormData, handoverTo: option });
                                        setShowHandoverToDd(false);
                                        setHandoverToSearch('');
                                      }}
                                      onMouseEnter={(e) => { if (deactivateFormData.handoverTo !== option) e.currentTarget.style.background = '#f1f5f9' }}
                                      onMouseLeave={(e) => { if (deactivateFormData.handoverTo !== option) e.currentTarget.style.background = 'transparent' }}
                                      style={{
                                        padding: '8px 12px', borderRadius: '6px', fontSize: '13px',
                                        cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                                        background: deactivateFormData.handoverTo === option ? '#dcfce7' : 'transparent',
                                        color: deactivateFormData.handoverTo === option ? '#16a34a' : '#1e293b',
                                        fontWeight: deactivateFormData.handoverTo === option ? '500' : '400',
                                        transition: 'background 0.2s'
                                      }}
                                    >
                                      {option}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {deactivateFormData.handoverTo === 'Other' && (
                        <div className="emp-form-group">
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                            Specify Other
                          </label>
                          <input
                            type="text"
                            value={deactivateFormData.handoverToOther || ''}
                            onChange={(e) => setDeactivateFormData({ ...deactivateFormData, handoverToOther: e.target.value })}
                            style={{
                              width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
                              fontSize: '13px', color: '#1e293b', background: '#f8fafc', boxSizing: 'border-box'
                            }}
                            placeholder="Enter person's name"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {deactivateFormData.handover === 'Not Completed' && (
                    <div className="emp-form-group animation-fade-in">
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Reason for Handover Incompletion
                      </label>
                      <textarea
                        rows="2"
                        value={deactivateFormData.handoverReason}
                        onChange={(e) => setDeactivateFormData({ ...deactivateFormData, handoverReason: e.target.value })}
                        style={{
                          width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1',
                          fontSize: '13px', color: '#1e293b', background: '#f8fafc', boxSizing: 'border-box', resize: 'vertical'
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="emp-footer" style={{
                padding: '14px 28px 18px', borderTop: '1px solid #f1f5f9',
                display: 'flex', gap: '12px', justifyContent: 'flex-end', background: '#fafafa', borderRadius: '0 0 16px 16px',
                flexShrink: 0
              }}>
                <button type="button" className="emp-btn-ghost" onClick={() => setShowDeactivateModal(false)} style={{
                  padding: '8px 18px', border: '1px solid #cbd5e1', borderRadius: '8px',
                  background: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
                }}>
                  <span>Cancel</span>
                </button>
                <button
                  type="submit"
                  className="emp-btn-primary"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px', border: 'none', borderRadius: '8px',
                    background: '#ef4444', color: '#ffffff', fontSize: '13px', fontWeight: '600', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting ? 0.7 : 1
                  }}
                >
                  <span>{isSubmitting ? 'Deactivating...' : 'Deactivate Employee'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Employees;
