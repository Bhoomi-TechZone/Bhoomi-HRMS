import { useEffect, useState, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useContextualQueryState } from '../utils/routeUtils';
import NotificationBell from './NotificationBell';

// Professional SVG Icons
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const SearchIcon = ({ style }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

const GiftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

const PlusCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const UmbrellaIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12a10 10 0 0 0-20 0" />
    <path d="M12 12v8a2 2 0 0 0 4 0" />
    <path d="M12 2v1" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const EyeIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24" />
  </svg>
);

const SunIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

// Format date and time in IST (Indian Standard Time, Asia/Kolkata)
const formatDateTimeIST = (dateStr, { includeZone = false } = {}) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  const formatted = d.toLocaleString('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
  return includeZone ? `${formatted} IST` : formatted;
};

const CustomDropdown = ({ label, options, value, onChange, isOpen, onToggle }) => {
  return (
    <div style={{ position: 'relative' }}>
      <button 
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        style={{
          padding: '0 8px', 
          borderRadius: '5px', 
          border: '1px solid #cbd5e1', 
          fontSize: '11px', 
          color: '#334155', 
          background: 'white', 
          cursor: 'pointer', 
          fontFamily: 'inherit', 
          height: '24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          gap: '6px',
          minWidth: '85px'
        }}
      >
        <span>{value}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      
      {isOpen && (
        <div 
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', 
            top: '100%', 
            left: 0, 
            marginTop: '4px', 
            background: 'white', 
            border: '1px solid #e2e8f0', 
            borderRadius: '8px', 
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)', 
            zIndex: 50, 
            minWidth: '160px', 
            padding: '6px 0', 
            overflow: 'hidden'
          }}
        >
          {label && (
            <div style={{ padding: '6px 14px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {label}
            </div>
          )}
          {options.map(opt => {
            const isSelected = value === opt;
            return (
              <div 
                key={opt}
                onClick={() => { onChange(opt); onToggle(); }}
                style={{
                  padding: '7px 14px', 
                  fontSize: '12px', 
                  color: isSelected ? '#059669' : '#334155', 
                  background: isSelected ? '#ecfdf5' : 'transparent', 
                  cursor: 'pointer', 
                  transition: 'background 0.15s',
                  fontWeight: isSelected ? 500 : 400
                }}
                onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background = '#f8fafc' }}
                onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                {opt}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function Leaves() {
  const { user, hasPermission } = useAuth();
  const isRoleAdmin = ['Admin', 'Super Admin', 'Director'].includes(user?.role?.name);

  const [{ tab: activeTab, status: filterStatus, search: searchQuery, page: currentPage }, setQueryState] = useContextualQueryState({
    ref: 'sidebar',
    tab: 'all',
    status: '',
    search: '',
    page: 1,
  });

  const setActiveTab = useCallback((tab) => setQueryState({ tab, page: 1 }), [setQueryState]);
  const setFilterStatus = useCallback((status) => setQueryState({ status, page: 1 }), [setQueryState]);
  const setSearchQuery = useCallback((search) => setQueryState({ search, page: 1 }), [setQueryState]);
  const setCurrentPage = useCallback((page) => setQueryState((prev) => ({ page: typeof page === 'function' ? page(prev.page || 1) : page })), [setQueryState]);

  const ITEMS_PER_PAGE = 10;
  const [loading, setLoading] = useState(true);
  const [hrmsSettings, setHrmsSettings] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [dropdownStatus, setDropdownStatus] = useState('All Statuses');
  const [dateRange, setDateRange] = useState('');
  const [openFilter, setOpenFilter] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState({ monthlyQuota: 0, used: 0, remaining: 0 });
  const [showModal, setShowModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [openStatusDropdown, setOpenStatusDropdown] = useState(null);
  const [dropdownCoords, setDropdownCoords] = useState({ top: 0, left: 0 });
  const [hoveredDesc, setHoveredDesc] = useState(null);
  const [descTooltipCoords, setDescTooltipCoords] = useState({ top: 'auto', bottom: 'auto', left: 0, showUpward: true });
  const [editingLeave, setEditingLeave] = useState(null);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [attachmentError, setAttachmentError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingAttachment, setExistingAttachment] = useState('');
  const [isAttachmentRemoved, setIsAttachmentRemoved] = useState(false);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState(null);
  const [previewAttachmentType, setPreviewAttachmentType] = useState(null);
  const [formData, setFormData] = useState({
    leaveCategory: 'Casual Leave',
    leaveType: 'Personal',
    durationType: 'Full Day',
    startDate: '',
    endDate: '',
    reason: 'Personal',
    description: ''
  });
  const [responseData, setResponseData] = useState({
    status: '',
    adminResponse: ''
  });
  const [holidayFormData, setHolidayFormData] = useState({
    name: '',
    date: '',
    description: '',
    isOptional: false
  });

  const userRoleName = String(user?.role?.name || user?.roleName || '').trim().toLowerCase();
  const userDesignation = String(user?.designation || '').trim().toLowerCase();

  const isHrOrAdmin = ['admin', 'super admin', 'director', 'hr', 'hr manager', 'hr admin'].some(
    keyword => userRoleName === keyword || userDesignation === keyword
  );

  const isSalesHeadOrManager = [
    'sales head',
    'head of sales',
    'sales manager',
    'sales lead',
    'email marketing manager',
    'marketing manager',
    'email marketing head'
  ].some(target => userRoleName.includes(target) || userDesignation.includes(target));

  const hasUpdatePermission = hasPermission('leaves', 'update');
  const hasDeletePermission = hasPermission('leaves', 'delete');
  const isTeamLeader = userRoleName === 'team leader' || userDesignation === 'team leader';

  // Only HR/Admin and Sales Head/Manager can view other employees' leaves (Backend restricts to sales & marketing team)
  const canViewAllLeaves = isHrOrAdmin || isSalesHeadOrManager;
  // STRICT: Only HR, HR Manager, HR Admin, and Admin can approve or reject leaves
  const canRespond = isHrOrAdmin;

  // Reset to page 1 when tab changes
  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenStatusDropdown(null);
      setOpenFilter(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle URL parameters for notifications
  useEffect(() => {
    if (leaves.length > 0) {
      const searchParams = new URLSearchParams(location.search);
      const leaveId = searchParams.get('id');
      const action = searchParams.get('action');

      if (leaveId) {
        const targetLeave = leaves.find(l => String(l._id) === leaveId);
        if (targetLeave) {
          setSelectedLeave(targetLeave);
          setShowDetailsModal(true);
          if (action === 'chat') {
            setIsFlipped(true);
          }
          // Clean up the URL so it doesn't reopen on refresh
          navigate(location.pathname, { replace: true });
        }
      }
    }
  }, [leaves, location.search, location.pathname, navigate]);

  // Pagination calculations
  const filteredLeaves = useMemo(() => {
    let result = leaves;

    // Filter by Metric Card Status OR Dropdown Status
    if (filterStatus) {
      const statusToMatch = filterStatus.split(' ')[0].toLowerCase();
      result = result.filter(l => l.status === statusToMatch);
    } else if (dropdownStatus !== 'All Statuses') {
      result = result.filter(l => l.status === dropdownStatus.toLowerCase());
    }

    // Filter by Search Query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(l => {
        const emp = typeof l.employee === 'object' && l.employee !== null ? l.employee : {};
        const empDirectName = typeof l.employee === 'string' ? l.employee.toLowerCase() : '';
        const empFirstName = (emp.firstName || '').toLowerCase();
        const empLastName = (emp.lastName || '').toLowerCase();
        const empFullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim().toLowerCase();
        const empId = (emp.employeeId || emp.empId || '').toLowerCase();
        const empEmail = (emp.email || '').toLowerCase();
        const leaveCat = (l.leaveCategory || '').toLowerCase();
        const leaveTyp = (l.leaveType || '').toLowerCase();
        const duration = (l.durationType || '').toLowerCase();
        const reason = (l.reason || '').toLowerCase();
        const desc = (l.description || '').toLowerCase();
        const status = (l.status || '').toLowerCase();

        return (
          empFullName.includes(query) ||
          empDirectName.includes(query) ||
          empFirstName.includes(query) ||
          empLastName.includes(query) ||
          empId.includes(query) ||
          empEmail.includes(query) ||
          leaveCat.includes(query) ||
          leaveTyp.includes(query) ||
          duration.includes(query) ||
          reason.includes(query) ||
          desc.includes(query) ||
          status.includes(query)
        );
      });
    }

    // Filter by Date Range
    if (dateRange && dateRange !== 'Any Date') {
      const now = new Date();
      result = result.filter(l => {
        const leaveDate = new Date(l.createdAt || l.startDate);
        
        if (dateRange.includes('-')) {
          // It's a specific date from input type=date (YYYY-MM-DD)
          return leaveDate.toDateString() === new Date(dateRange).toDateString();
        } else if (dateRange === 'Today') {
          return leaveDate.toDateString() === now.toDateString();
        } else if (dateRange === 'This Week') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return leaveDate >= oneWeekAgo;
        } else if (dateRange === 'This Month') {
          return leaveDate.getMonth() === now.getMonth() && leaveDate.getFullYear() === now.getFullYear();
        }
        return true;
      });
    }

    return result;
  }, [leaves, filterStatus, dropdownStatus, searchQuery, dateRange]);

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredLeaves.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLeaves.length / ITEMS_PER_PAGE);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const promises = [fetchLeaves(), fetchHolidays(), fetchHRMSSettings()];
        if (!isRoleAdmin) {
          promises.push(fetchLeaveBalance());
        }
        await Promise.all(promises);
      } catch (err) {
        console.error('Error loading leaves data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const fetchHRMSSettings = async () => {
    try {
      const res = await api.get('/settings/hrms');
      setHrmsSettings(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await api.get('/leaves/balance');
      setLeaveBalance(response.data);
    } catch (error) {
      console.error('Error fetching leave balance:', error);
    }
  };

  const fetchLeaves = async () => {
    try {
      const response = await api.get('/leaves');
      setLeaves(response.data);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const response = await api.get('/leaves/holidays');
      setHolidays(response.data);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    }
  };

  const handleRemoveAttachment = (e) => {
    e.stopPropagation();
    setAttachmentFile(null);
    setExistingAttachment('');
    setIsAttachmentRemoved(true);
    setAttachmentError('');
    const el = document.getElementById('leave-attachment-input');
    if (el) el.value = '';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];

    if (!file) {
      setAttachmentError('');
      setAttachmentFile(null);


      return;
    }
    const allowedExtensions = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      const errMsg = `Unsupported file format (.${ext || 'unknown'}). Supported formats are: PDF, DOC, DOCX, JPG, JPEG, PNG, and WEBP.`;
      setAttachmentError(errMsg);
      setAttachmentFile(null);


      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const errMsg = `File size (${sizeMB} MB) exceeds the 2MB limit. Please upload a file smaller than 2MB.`;
      setAttachmentError(errMsg);
      setAttachmentFile(null);


      e.target.value = '';
      return;
    }

    setAttachmentError('');
    setAttachmentFile(file);
    setIsAttachmentRemoved(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('leaveCategory', formData.leaveCategory);
      data.append('leaveType', formData.leaveType);
      data.append('durationType', formData.durationType);
      data.append('startDate', formData.startDate);
      data.append('endDate', formData.endDate);
      data.append('reason', formData.reason);
      data.append('description', formData.description || '');
      if (attachmentFile) {
        data.append('attachment', attachmentFile);
      } else if (isAttachmentRemoved) {
        data.append('removeAttachment', 'true');
      }

      if (editingLeave) {
        const res = await api.put(`/leaves/${editingLeave._id}`, data);
        if (res.data) {
          setLeaves(prev => prev.map(l => l._id === editingLeave._id ? res.data : l));
        }
        setEditingLeave(null);
      } else {
        await api.post('/leaves', data);
      }
      setShowModal(false);
      setAttachmentError('');
      setFormData({
        leaveCategory: 'Casual Leave',
        leaveType: 'Personal',
        durationType: 'Full Day',
        startDate: '',
        endDate: '',
        reason: 'Personal',
        description: ''
      });
      setAttachmentFile(null);
      setExistingAttachment('');
      setIsAttachmentRemoved(false);

      await fetchLeaves();
    } catch (error) {
      alert(error.response?.data?.message || 'Error processing leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditLeave = (leave) => {
    const isOwner = String(user?._id || user?.userId || user?.id) === String(leave.employee?._id || leave.employee);
    if (!isOwner && !isHrOrAdmin) {
      alert('You can only edit your own leave requests.');
      return;
    }
    if (leave.status === 'approved' && !isHrOrAdmin) {
      alert('Approved leave requests cannot be edited.');
      return;
    }
    setEditingLeave(leave);
    setAttachmentError('');
    setAttachmentFile(null);
    setExistingAttachment(leave.attachmentFileName || '');
    setIsAttachmentRemoved(false);


    setFormData({
      leaveCategory: leave.leaveCategory || 'Casual Leave',
      leaveType: leave.leaveType || 'Personal',
      durationType: leave.durationType || 'Full Day',
      startDate: new Date(leave.startDate).toISOString().split('T')[0],
      endDate: new Date(leave.endDate).toISOString().split('T')[0],
      reason: leave.reason || 'Personal',
      description: leave.description || ''
    });
    setShowModal(true);
  };

  const handleDeleteLeave = async (id) => {
    if (!window.confirm('Are you sure you want to delete this leave request?')) return;
    try {
      await api.delete(`/leaves/${id}`);
      fetchLeaves();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting leave');
    }
  };

  const handleDownloadAttachment = async (leave) => {
    try {
      const response = await api.get(`/leaves/${leave._id}/attachment`, { responseType: 'blob' });
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const file = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(file);
      setPreviewAttachmentUrl(url);
      setPreviewAttachmentType(contentType);
    } catch (error) {
      if (error.response && error.response.data instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const errObj = JSON.parse(reader.result);
            alert(errObj.message || 'Error previewing attachment');
          } catch (e) {
            alert('Error previewing attachment');
          }
        };
        reader.readAsText(error.response.data);
      } else {
        alert(error.response?.data?.message || 'Error previewing attachment');
      }
    }
  };

  const handleRespond = (leave) => {
    if (!canRespond) {
      alert('Only HR, HR Manager, HR Admin, and Admin can approve or reject leaves.');
      return;
    }
    setSelectedLeave(leave);
    setResponseData({
      status: leave.status,
      adminResponse: leave.adminResponse || ''
    });
    setShowResponseModal(true);
  };

  const handleResponseSubmit = async (e) => {
    e.preventDefault();
    if (!canRespond) {
      alert('Only HR, HR Manager, HR Admin, and Admin can approve or reject leaves.');
      return;
    }
    try {
      await api.put(`/leaves/${selectedLeave._id}`, responseData);
      setShowResponseModal(false);
      setSelectedLeave(null);
      setResponseData({ status: '', adminResponse: '' });
      fetchLeaves();
    } catch (error) {
      alert(error.response?.data?.message || 'Error responding to leave');
    }
  };

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;
    try {
      const response = await api.post(`/leaves/${selectedLeave._id}/reply`, { message: replyMessage });
      setReplyMessage('');
      // Update selected leave to show new timeline without closing modal
      setSelectedLeave(response.data);
      fetchLeaves(); // Refresh background table too
    } catch (error) {
      alert(error.response?.data?.message || 'Error sending reply');
    }
  };

  const handleQuickStatusChange = async (leave, newStatus) => {
    if (!canRespond) {
      alert('Only HR, HR Manager, HR Admin, and Admin can change leave status.');
      return;
    }
    if (newStatus === leave.status) return;
    try {
      await api.put(`/leaves/${leave._id}`, { status: newStatus });
      fetchLeaves();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating status');
    }
  };

  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await api.put(`/leaves/holidays/${editingHoliday._id}`, holidayFormData);
      } else {
        await api.post('/leaves/holidays', holidayFormData);
      }
      setShowHolidayModal(false);
      setEditingHoliday(null);
      setHolidayFormData({ name: '', date: '', description: '', isOptional: false });
      fetchHolidays();
    } catch (error) {
      alert('Error saving holiday');
    }
  };

  const handleEditHoliday = (holiday) => {
    setEditingHoliday(holiday);
    setHolidayFormData({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().split('T')[0],
      description: holiday.description || '',
      isOptional: holiday.isOptional
    });
    setShowHolidayModal(true);
  };

  const handleDeleteHoliday = async (id) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      try {
        await api.delete(`/leaves/holidays/${id}`);
        fetchHolidays();
      } catch (error) {
        alert('Error deleting holiday');
      }
    }
  };

  const handleExportExcel = async () => {
    try {
      const response = await api.get('/leaves/export/excel', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leaves.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting to Excel');
      console.error('Export error:', error);
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await api.get('/leaves/export/pdf', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leaves.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error exporting to PDF');
      console.error('Export error:', error);
    }
  };

  const handleExportWord = async () => {
    try {
      const response = await api.get('/leaves/export/word', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'leaves.docx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Error exporting to Word');
      console.error('Export error:', error);
    }
  };

  const getDayOfWeek = (date) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date(date).getDay()];
  };


  const leaveStats = useMemo(() => {
    const total = leaves.length;
    const pending = leaves.filter(l => l.status === 'pending').length;
    const approved = leaves.filter(l => l.status === 'approved').length;
    const rejected = leaves.filter(l => l.status === 'rejected').length;

    return { total, pending, approved, rejected };
  }, [leaves]);

  const prevMonthLeaveStats = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const prev = leaves.filter(l => { const d = new Date(l.createdAt || l.startDate); return d >= start && d <= end; });
    return {
      total: prev.length,
      pending: prev.filter(l => l.status === 'pending').length,
      approved: prev.filter(l => l.status === 'approved').length,
      rejected: prev.filter(l => l.status === 'rejected').length,
    };
  }, [leaves]);

  const leaveSparklineData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    const countFor = (filterFn) =>
      months.map(({ year, month }) =>
        leaves.filter(l => {
          const d = new Date(l.createdAt || l.startDate);
          return d.getFullYear() === year && d.getMonth() === month && filterFn(l);
        }).length
      );
    return {
      total: countFor(() => true),
      pending: countFor(l => l.status === 'pending'),
      approved: countFor(l => l.status === 'approved'),
      rejected: countFor(l => l.status === 'rejected'),
    };
  }, [leaves]);

  const calcChange = (cur, prev) => {
    if (prev === 0) return cur > 0 ? '+100%' : '0%';
    const pct = ((cur - prev) / prev) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };
  const isUp = (cur, prev) => cur >= prev;

  const Sparkline = ({ data, color }) => {
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
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`slg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fillPts} fill={`url(#slg-${color.replace('#', '')})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => {
          const x = (i / (data.length - 1)) * w;
          const y = h - 4 - ((v - min) / range) * (h - 10);
          return i === data.length - 1 ? <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} /> : null;
        })}
      </svg>
    );
  };


  if (loading) {
    return (
      <div className="page-container" style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#ffffff',
        padding: '28px 24px',
        boxSizing: 'border-box',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
      }}>
        <style>{`
          @keyframes leaves-skeleton-shimmer {
            0% { background-position: -600px 0; }
            100% { background-position: 600px 0; }
          }
          .leaves-skel {
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 600px 100%;
            animation: leaves-skeleton-shimmer 1.4s infinite linear;
            border-radius: 8px;
          }
        `}</style>

        {/* Header Skeleton */}
        <div className="leaves-header" style={{
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div className="leaves-skel" style={{ width: '220px', height: '28px', marginBottom: '8px' }} />
            <div className="leaves-skel" style={{ width: '280px', height: '14px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="leaves-skel" style={{ width: '38px', height: '38px', borderRadius: '10px' }} />
            <div className="leaves-skel" style={{ width: '90px', height: '38px', borderRadius: '10px' }} />
            <div className="leaves-skel" style={{ width: '80px', height: '38px', borderRadius: '10px' }} />
            <div className="leaves-skel" style={{ width: '130px', height: '38px', borderRadius: '10px' }} />
          </div>
        </div>

        {/* Metrics Cards Skeleton */}
        <div className="leaves-metrics-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '24px'
        }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                padding: '14px 16px 12px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div className="leaves-skel" style={{ width: '110px', height: '12px' }} />
                <div className="leaves-skel" style={{ width: '45px', height: '16px', borderRadius: '20px' }} />
              </div>
              <div className="leaves-skel" style={{ width: '52px', height: '28px', marginBottom: '10px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div className="leaves-skel" style={{ width: '75px', height: '12px' }} />
                <div className="leaves-skel" style={{ width: '60px', height: '22px', borderRadius: '4px' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Main Table Container Skeleton */}
        <div style={{
          background: '#fff',
          borderRadius: '14px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0
        }}>
          {/* Filter Bar Skeleton */}
          <div style={{
            padding: '10px 16px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            flexWrap: 'wrap',
            background: '#fafafa'
          }}>
            <div className="leaves-skel" style={{ width: '280px', height: '34px', borderRadius: '8px' }} />
            <div className="leaves-skel" style={{ width: '130px', height: '34px', borderRadius: '8px' }} />
            <div className="leaves-skel" style={{ width: '150px', height: '34px', borderRadius: '8px' }} />
            <div className="leaves-skel" style={{ width: '90px', height: '34px', borderRadius: '8px', marginLeft: 'auto' }} />
          </div>

          {/* Table Header Skeleton */}
          <div style={{
            background: '#ffffff',
            padding: '12px 16px',
            borderBottom: '2px solid #e5e7eb',
            display: 'grid',
            gridTemplateColumns: '1.8fr 1.2fr 1.2fr 1.5fr 1fr 100px',
            gap: '12px',
            alignItems: 'center'
          }}>
            <div className="leaves-skel" style={{ width: '80px', height: '12px' }} />
            <div className="leaves-skel" style={{ width: '90px', height: '12px' }} />
            <div className="leaves-skel" style={{ width: '70px', height: '12px' }} />
            <div className="leaves-skel" style={{ width: '80px', height: '12px' }} />
            <div className="leaves-skel" style={{ width: '60px', height: '12px' }} />
            <div className="leaves-skel" style={{ width: '50px', height: '12px', marginLeft: 'auto' }} />
          </div>

          {/* Table Rows Skeleton */}
          <div style={{ flex: 1, overflowY: 'hidden', padding: '0 16px' }}>
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.8fr 1.2fr 1.2fr 1.5fr 1fr 100px',
                  gap: '12px',
                  padding: '14px 0',
                  borderBottom: i < 5 ? '1px solid #f1f5f9' : 'none',
                  alignItems: 'center'
                }}
              >
                {/* Employee Column */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div className="leaves-skel" style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />
                  <div>
                    <div className="leaves-skel" style={{ width: '110px', height: '13px', marginBottom: '5px' }} />
                    <div className="leaves-skel" style={{ width: '70px', height: '10px' }} />
                  </div>
                </div>

                {/* Leave Type */}
                <div>
                  <div className="leaves-skel" style={{ width: '90px', height: '13px', marginBottom: '4px' }} />
                  <div className="leaves-skel" style={{ width: '55px', height: '10px' }} />
                </div>

                {/* Duration */}
                <div>
                  <div className="leaves-skel" style={{ width: '100px', height: '13px', marginBottom: '4px' }} />
                  <div className="leaves-skel" style={{ width: '45px', height: '10px' }} />
                </div>

                {/* Reason / Details */}
                <div>
                  <div className="leaves-skel" style={{ width: '130px', height: '13px' }} />
                </div>

                {/* Status */}
                <div>
                  <div className="leaves-skel" style={{ width: '80px', height: '24px', borderRadius: '999px' }} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <div className="leaves-skel" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                  <div className="leaves-skel" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Skeleton */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#fafafa'
          }}>
            <div className="leaves-skel" style={{ width: '160px', height: '14px' }} />
            <div style={{ display: 'flex', gap: '6px' }}>
              <div className="leaves-skel" style={{ width: '32px', height: '30px', borderRadius: '6px' }} />
              <div className="leaves-skel" style={{ width: '32px', height: '30px', borderRadius: '6px' }} />
              <div className="leaves-skel" style={{ width: '32px', height: '30px', borderRadius: '6px' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <style>{`
        .leaves-table {
          width: 100% !important;
          border-collapse: collapse !important;
          font-family: 'Inter','Poppins','Segoe UI',sans-serif !important;
        }
        .leaves-table thead tr {
          background: #fafafa !important;
        }
        .leaves-table thead th {
          font-size: 9.5px !important;
          font-weight: 700 !important;
          color: #94a3b8 !important;
          text-transform: uppercase !important;
          letter-spacing: .05em !important;
          padding: 7px 8px !important;
          text-align: left !important;
          white-space: nowrap !important;
          border-bottom: 1px solid #f1f5f9 !important;
          font-family: 'Inter','Poppins','Segoe UI',sans-serif !important;
        }
        .leaves-table tbody tr {
          border-bottom: 1px solid #f1f5f9 !important;
          transition: background .15s !important;
          background: white !important;
        }
        .leaves-table tbody tr:hover {
          background: #fafffe !important;
        }
        .leaves-table tbody td {
          font-size: 11px !important;
          color: #475569 !important;
          padding: 5px 8px !important;
          vertical-align: middle !important;
          font-family: 'Inter','Poppins','Segoe UI',sans-serif !important;
        }
        .leaves-action-btn {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition: color 0.35s ease, border-color 0.35s ease;
        }
        .leaves-action-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }
        .leaves-action-btn::after {
          content: '';
          position: absolute;
          top: -35%;
          left: -38%;
          width: 62%;
          height: 170%;
          background:
            radial-gradient(circle at 30% 50%, rgba(255,255,255,0.30) 0 28%, rgba(255,255,255,0) 58%),
            radial-gradient(circle at 58% 38%, rgba(255,255,255,0.22) 0 24%, rgba(255,255,255,0) 56%),
            radial-gradient(circle at 62% 68%, rgba(255,255,255,0.16) 0 18%, rgba(255,255,255,0) 52%);
          border-radius: 44% 56% 58% 42%;
          transform: translateX(-145%) rotate(8deg);
          transition: transform 0.8s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          opacity: 0.95;
          pointer-events: none;
        }
        .leaves-action-btn:hover {
          color: #1f2937 !important;
          border-color: transparent !important;
        }
        .leaves-action-btn:hover::before {
          transform: translateX(0%);
        }
        .leaves-action-btn:hover::after {
          transform: translateX(255%) rotate(8deg);
        }
        @media (max-width: 768px) {
          .leaves-date-grid {
            grid-template-columns: 1fr !important;
          }
          .leaves-info-grid {
            grid-template-columns: 1fr !important;
          }
          /* Page wrapper */
          .leaves-page-wrap {
            padding: 14px 12px !important;
            padding-top: calc(70px + env(safe-area-inset-top, 0px)) !important;
            padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
            box-sizing: border-box;
          }
          /* Header stacks vertically */
          .leaves-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
            margin-bottom: 14px !important;
          }
          /* Action buttons fill row */
          .leaves-header-actions {
            width: 100% !important;
            flex-wrap: wrap !important;
            justify-content: flex-start !important;
            gap: 6px !important;
          }
          .leaves-header-actions > button {
            flex: 1 1 auto !important;
            justify-content: center !important;
            min-width: 0 !important;
          }
          /* Table: horizontal scroll on mobile */
          .leaves-table-wrap {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
          }
          .leaves-table {
            min-width: 900px !important;
          }
          /* Pagination wraps */
          .leaves-pagination {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }
          /* Smaller font sizes for mobile */
          .leaves-table th {
            font-size: 9px !important;
            padding: 8px 12px !important;
          }
          .leaves-table td {
            font-size: 10px !important;
            padding: 8px 12px !important;
          }
        }
        @media (max-width: 480px) {
          .leaves-page-wrap {
            padding: 10px 8px !important;
            padding-top: calc(68px + env(safe-area-inset-top, 0px)) !important;
          }
          .leaves-table {
            min-width: 800px !important;
          }
        }

        @keyframes leaves-bubble-float-large {
          0% { transform: translate(0px, 0px) scale(1); }
          30% { transform: translate(-5px, -7px) scale(1.04); }
          60% { transform: translate(4px, -4px) scale(0.97); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        @keyframes leaves-bubble-float-small {
          0% { transform: translate(0px, 0px) scale(1); }
          35% { transform: translate(6px, -9px) scale(1.06); }
          65% { transform: translate(-4px, -3px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        .leaves-metrics-grid > div {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }

        .leaves-metrics-grid > div::before {
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
          animation: leaves-bubble-float-large 5.5s ease-in-out infinite;
        }

        .leaves-metrics-grid > div::after {
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
          animation: leaves-bubble-float-small 4.2s ease-in-out infinite;
        }

        .leaves-metrics-grid > div:nth-child(1)::before,
        .leaves-metrics-grid > div:nth-child(1)::after {
          background: #667eea;
        }

        .leaves-metrics-grid > div:nth-child(2)::before,
        .leaves-metrics-grid > div:nth-child(2)::after {
          background: #f59e0b;
        }

        .leaves-metrics-grid > div:nth-child(3)::before,
        .leaves-metrics-grid > div:nth-child(3)::after {
          background: #10b981;
        }

        .leaves-metrics-grid > div:nth-child(4)::before,
        .leaves-metrics-grid > div:nth-child(4)::after {
          background: #ef4444;
        }

        .leaves-metrics-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
        .leaves-metrics-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
        .leaves-metrics-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
        .leaves-metrics-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
        .leaves-metrics-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
        .leaves-metrics-grid > div:nth-child(4)::after { animation-delay: 1.8s; }

        .ist-action-btn {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: all 0.2s;
        }
      `}</style>
      <div className="leaves-page-wrap" style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#ffffff',
        padding: '28px 24px',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div className="leaves-header" style={{
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '600',
                color: '#0f172a',
                fontFamily: 'Inter, -apple-system, sans-serif',
                letterSpacing: '-0.02em'
              }}>Leaves Management</h1>
              <p style={{
                margin: '2px 0 0 0',
                fontSize: '13px',
                color: '#64748b',
                fontFamily: 'Inter, -apple-system, sans-serif'
              }}>Track and manage employee leave requests</p>
            </div>
          </div>
          <div className="leaves-header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <NotificationBell filterType="Leave" />
            {leaves.length > 0 && (isRoleAdmin || user?.role?.name === 'HR' || user?.role?.name === 'HR Manager') && (<>
              <button
                className="leaves-action-btn"
                onClick={handleExportExcel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  background: '#fff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '7px' }}><DownloadIcon /> Excel</span>
              </button>
              <button
                className="leaves-action-btn"
                onClick={handleExportPDF}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 14px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  background: '#fff',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: '7px' }}><FileTextIcon /> PDF</span>
              </button>
            </>)}
            {!isRoleAdmin && hasPermission('leaves', 'create') && <button onClick={() => { setEditingLeave(null); setShowModal(true); }} style={{
              background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
              color: 'white',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'Inter, -apple-system, sans-serif',
              boxShadow: 'none',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '7px'
            }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
              }}>
              <PlusIcon /> Apply Leave
            </button>}
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="leaves-metrics-grid ist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            {
              label: 'Total Leaves Applied', value: leaveStats.total, prev: prevMonthLeaveStats.total, color: '#667eea', spark: leaveSparklineData.total,
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
            },
            {
              label: 'Pending Leaves', value: leaveStats.pending, prev: prevMonthLeaveStats.pending, color: '#f59e0b', spark: leaveSparklineData.pending,
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            },
            {
              label: 'Approved Leaves', value: leaveStats.approved, prev: prevMonthLeaveStats.approved, color: '#10b981', spark: leaveSparklineData.approved,
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            },
            {
              label: 'Rejected Leaves', value: leaveStats.rejected, prev: prevMonthLeaveStats.rejected, color: '#ef4444', spark: leaveSparklineData.rejected,
              icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            },
          ].map(({ label, value, prev, color, spark, icon }) => {
            const trend = prev !== null ? calcChange(value, prev) : null;
            const up = prev !== null ? isUp(value, prev) : true;
            const isSelected = filterStatus === label || (filterStatus === '' && label === 'Total Leaves Applied');
            return (
              <div
                key={label}
                style={{
                  background: 'white',
                  padding: '14px 16px 10px',
                  borderRadius: '12px',
                  border: isSelected ? `2px solid ${color}` : '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  overflow: 'hidden',
                  position: 'relative'
                }}
                onClick={() => {
                  setFilterStatus(label === 'Total Leaves Applied' ? '' : label);
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                {/* Label row + trend badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
                  {trend !== null && (
                    <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: up ? 'rgba(168,230,61,0.15)' : 'rgba(239,68,68,0.1)', color: up ? '#3d7c00' : '#dc2626', whiteSpace: 'nowrap' }}>
                      {up ? '▲' : '▼'} {trend}
                    </span>
                  )}
                  {trend === null && <div style={{ color }}>{icon}</div>}
                </div>
                {/* Value */}
                <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px' }}>{value}</div>
                {/* Bottom: vs last month + sparkline */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                  {trend !== null ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: up ? '#16a34a' : '#ef4444', lineHeight: 1.2 }}>{up ? '+' : ''}{trend}</span>
                      <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>vs last month</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>this month</span>
                    </div>
                  )}
                  <Sparkline data={spark} color={color} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '14px',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          justifyContent: 'space-between'
        }}>



          {activeTab !== 'leaveBalance' && (<>
            {/* Filter Bar */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', background: '#ffffff' }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '350px' }}>
                <SearchIcon style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', width: '12px', height: '12px' }} />
                <input 
                  type="text" 
                  placeholder="Search by name, ID, leave type..." 
                  value={searchQuery || ''}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: searchQuery ? '0 24px 0 24px' : '0 8px 0 24px', borderRadius: '5px', border: '1px solid #cbd5e1', fontSize: '11px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit', height: '24px', boxSizing: 'border-box' }}
                  onFocus={(e) => e.target.style.borderColor = '#94a3b8'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={{
                      position: 'absolute',
                      right: '6px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      lineHeight: 1
                    }}
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <CustomDropdown 
                label="STATUS"
                value={dropdownStatus} 
                options={["All Statuses", "Approved", "Pending", "Rejected"]}
                isOpen={openFilter === 'status'}
                onToggle={() => setOpenFilter(openFilter === 'status' ? null : 'status')}
                onChange={(val) => { setDropdownStatus(val); setFilterStatus(''); }}
              />
              <div style={{ position: 'relative' }}>
                <button 
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('dateFilterInput');
                    if(input && input.showPicker) input.showPicker();
                  }}
                  style={{
                    padding: '0 8px', 
                    borderRadius: '5px', 
                    border: '1px solid #cbd5e1', 
                    fontSize: '11px', 
                    color: '#334155', 
                    background: 'white', 
                    cursor: 'pointer', 
                    fontFamily: 'inherit', 
                    height: '24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    gap: '6px',
                    minWidth: '85px'
                  }}
                >
                  <span>{dateRange ? new Date(dateRange).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Any Date'}</span>
                  {dateRange ? (
                    <span 
                      onClick={(e) => { e.stopPropagation(); setDateRange(''); setCurrentPage(1); }}
                      style={{ color: '#ef4444', display: 'flex', alignItems: 'center', padding: '2px' }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </span>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  )}
                </button>
                <input
                  id="dateFilterInput"
                  type="date"
                  value={dateRange}
                  onChange={(e) => { setDateRange(e.target.value); setCurrentPage(1); }}
                  style={{
                    position: 'absolute',
                    visibility: 'hidden',
                    top: '100%',
                    left: 0
                  }}
                />
              </div>
            </div>
            
            <div className="leaves-table-wrap" style={{ overflowX: "auto", overflowY: "auto", WebkitOverflowScrolling: "touch", flex: 1, minHeight: 0 }}>
              <table className="leaves-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: "#ffffff", boxShadow: '0 1px 0 #f1f5f9' }}>
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "50px"
                    }}>
                      S.No
                    </th>
                    {canViewAllLeaves && (
                      <th style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid #f1f5f9",
                        whiteSpace: "nowrap",
                        minWidth: "140px"
                      }}>
                        Employee
                      </th>
                    )}
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "80px"
                    }}>
                      Category
                    </th>
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "80px"
                    }}>
                      Leave Type
                    </th>
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "70px"
                    }}>
                      Duration
                    </th>
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "120px"
                    }}>
                      Date Range
                    </th>
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "100px"
                    }}>
                      Applied On
                    </th>
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "150px"
                    }}>
                      Description
                    </th>
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "100px"
                    }}>
                      Status
                    </th>
                    {canViewAllLeaves && (
                      <th style={{
                        padding: "12px 16px",
                        textAlign: "left",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid #f1f5f9",
                        whiteSpace: "nowrap",
                        minWidth: "120px"
                      }}>
                        Action By
                      </th>
                    )}
                    <th style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#94a3b8",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid #f1f5f9",
                      whiteSpace: "nowrap",
                      minWidth: "120px"
                    }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.map((leave, index) => {
                    const isOwnLeave = String(user?._id || user?.userId || user?.id) === String(leave.employee?._id || leave.employee);
                    return (
                    <tr key={leave._id} style={{ borderBottom: index < currentItems.length - 1 ? "1px solid #f8fafc" : "none" }}>
                      <td data-label="S.No" style={{ padding: "12px 16px", minWidth: "50px", color: "#64748b", fontSize: "12px", fontWeight: 500 }}>
                        {indexOfFirstItem + index + 1}
                      </td>
                      {canViewAllLeaves && (
                        <td data-label="Employee" style={{ padding: "12px 16px", minWidth: "140px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontSize: "11px",
                              fontWeight: 600
                            }}>
                              {leave.employee?.firstName?.charAt(0)}{leave.employee?.lastName?.charAt(0)}
                            </div>
                            <div>
                              <div style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a" }}>
                                {leave.employee?.firstName} {leave.employee?.lastName}
                              </div>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                                ID: {leave.employee?.employeeId}
                              </div>
                            </div>
                          </div>
                        </td>
                      )}
                      <td data-label="Category" style={{ padding: "12px 16px", minWidth: "80px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "10px",
                          fontWeight: 600,
                          textTransform: "capitalize",
                          background: leave.leaveCategory === 'Casual Leave' ? '#dbeafe' : '#fee2e2',
                          color: leave.leaveCategory === 'Casual Leave' ? '#1e40af' : '#991b1b',
                          border: `1px solid ${leave.leaveCategory === 'Casual Leave' ? '#93c5fd' : '#fecaca'}`
                        }}>
                          {leave.leaveCategory === 'Casual Leave' ? 'Casual' : 'Unpaid'}
                        </span>
                      </td>
                      <td data-label="Leave Type" style={{ padding: "12px 16px", minWidth: "80px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ color: "#3b775e" }}>
                            <FileTextIcon />
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#0f172a" }}>
                            {leave.leaveType || leave.reason}
                          </span>
                        </div>
                      </td>
                      <td data-label="Duration" style={{ padding: "12px 16px", minWidth: "70px" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "10px",
                          fontWeight: 600,
                          textTransform: "capitalize",
                          background: '#f0fdf4',
                          color: '#166534',
                          border: '1px solid #bbf7d0'
                        }}>
                          {leave.durationType || 'Full Day'}
                        </span>
                      </td>
                      <td data-label="Date Range" style={{ minWidth: "120px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ color: "#64748b", display: "inline-flex" }}>
                            <CalendarIcon />
                          </div>
                          <span style={{ fontSize: "11px", color: "#475569" }}>
                            {new Date(leave.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {new Date(leave.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      </td>
                      <td data-label="Applied On" style={{ padding: "12px 16px", minWidth: "140px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <div style={{ color: "#94a3b8", display: "inline-flex" }}>
                            <ClockIcon />
                          </div>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>
                            {formatDateTimeIST(leave.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td data-label="Description" style={{ padding: "12px 16px", minWidth: "180px" }}>
                        <div 
                          className="custom-tooltip-container"
                          onClick={() => { setSelectedLeave(leave); setShowDetailsModal(true); }}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const showUpward = spaceBelow < 200;
                            setDescTooltipCoords({
                              top: showUpward ? 'auto' : rect.bottom + 10,
                              bottom: showUpward ? window.innerHeight - rect.top + 10 : 'auto',
                              left: rect.left + rect.width / 2,
                              showUpward: showUpward
                            });
                    
                            setHoveredDesc(leave._id);
                          }}
                          onMouseLeave={() => setHoveredDesc(null)}
                          style={{
                            fontSize: "11.5px",
                            color: "#334155",
                            fontWeight: 400,
                            lineHeight: "1.5",
                            maxWidth: "180px",
                            cursor: "pointer"
                          }}
                        >
                          <div style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            letterSpacing: "0.01em"
                          }}>
                            {leave.description || leave.reason || '—'}
                          </div>
                          {hoveredDesc === leave._id && (leave.description || leave.reason) && (
                            <div 
                              className="custom-tooltip-text"
                              style={{
                                visibility: 'visible',
                                opacity: 1,
                                position: 'fixed',
                                top: descTooltipCoords.top !== 'auto' ? `${descTooltipCoords.top}px` : 'auto',
                                bottom: descTooltipCoords.bottom !== 'auto' ? `${descTooltipCoords.bottom}px` : 'auto',
                                left: `${descTooltipCoords.left}px`,
                                transform: 'translateX(-50%)',
                                zIndex: 99999,
                                width: 'max-content',
                                maxWidth: '300px',
                                pointerEvents: 'none',
                                transition: 'none'
                              }}
                            >
                              {leave.description || leave.reason}
                              <div style={{
                                position: 'absolute',
                                left: '50%',
                                marginLeft: '-6px',
                                borderWidth: '6px',
                                borderStyle: 'solid',
                                borderColor: !descTooltipCoords.showUpward 
                                  ? 'transparent transparent #ffffff transparent' 
                                  : '#ffffff transparent transparent transparent',
                                top: !descTooltipCoords.showUpward ? '-12px' : '100%',
                              }}></div>
                              <div style={{
                                position: 'absolute',
                                left: '50%',
                                marginLeft: '-7px',
                                borderWidth: '7px',
                                borderStyle: 'solid',
                                borderColor: !descTooltipCoords.showUpward 
                                  ? 'transparent transparent #e2e8f0 transparent' 
                                  : '#e2e8f0 transparent transparent transparent',
                                top: !descTooltipCoords.showUpward ? '-14px' : '100%',
                                zIndex: -1
                              }}></div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td data-label="Status" style={{ padding: "12px 16px", minWidth: "100px" }}>
                        <div style={{ position: 'relative' }}>
                          {(canRespond && (isRoleAdmin || !isOwnLeave)) ? (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                const spaceBelow = window.innerHeight - rect.bottom;
                                const showUpward = spaceBelow < 150;
                                setDropdownCoords({ 
                                  top: showUpward ? 'auto' : rect.bottom + 4,
                                  bottom: showUpward ? window.innerHeight - rect.top + 4 : 'auto',
                                  left: rect.left 
                                });
                        
                                setOpenStatusDropdown(openStatusDropdown === leave._id ? null : leave._id);
                              }}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 6px",
                                borderRadius: "999px",
                                fontSize: "8.5px",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                background: leave.status === 'approved' ? '#dcfce7' : leave.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                                color: leave.status === 'approved' ? '#166534' : leave.status === 'rejected' ? '#991b1b' : '#92400e',
                                border: `1px solid ${leave.status === 'approved' ? '#86efac' : leave.status === 'rejected' ? '#fecaca' : '#fcd34d'}`,
                                cursor: 'pointer',
                              }}
                            >
                              {leave.status === 'approved' ? <CheckCircleIcon /> : leave.status === 'rejected' ? <XCircleIcon /> : <ClockIcon />}
                              {leave.status}
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "2px" }}><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                          ) : (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "2px 6px",
                              borderRadius: "999px",
                              fontSize: "8.5px",
                              fontWeight: 600,
                              textTransform: "capitalize",
                              background: leave.status === 'approved' ? '#dcfce7' : leave.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                              color: leave.status === 'approved' ? '#166534' : leave.status === 'rejected' ? '#991b1b' : '#92400e',
                              border: `1px solid ${leave.status === 'approved' ? '#86efac' : leave.status === 'rejected' ? '#fecaca' : '#fcd34d'}`
                            }}>
                              {leave.status === 'approved' ? <CheckCircleIcon /> : leave.status === 'rejected' ? <XCircleIcon /> : <ClockIcon />}
                              {leave.status}
                            </span>
                          )}

                          {/* Custom Dropdown */}
                          {openStatusDropdown === leave._id && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'fixed',
                                top: dropdownCoords.top !== 'auto' ? `${dropdownCoords.top}px` : 'auto',
                                bottom: dropdownCoords.bottom !== 'auto' ? `${dropdownCoords.bottom}px` : 'auto',
                                left: `${dropdownCoords.left}px`,
                                background: 'white',
                                borderRadius: '12px',
                                padding: '6px',
                                width: '130px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                border: '1px solid #f1f5f9',
                                zIndex: 50,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}
                            >
                              {[
                                { value: 'pending', label: 'Pending', color: '#f59e0b', bg: '#fef3c7' },
                                { value: 'approved', label: 'Approved', color: '#10b981', bg: '#dcfce7' },
                                { value: 'rejected', label: 'Rejected', color: '#ef4444', bg: '#fee2e2' }
                              ].map(opt => (
                                <div
                                  key={opt.value}
                                  onClick={() => {
                                    handleQuickStatusChange(leave, opt.value);
                                    setOpenStatusDropdown(null);
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                  style={{
                                    padding: '8px 12px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    cursor: 'pointer',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#334155',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <span style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    background: opt.color 
                                  }}></span>
                                  {opt.label}
                                </div>
                              ))}
                            </div>
                          )}
                          {leave.adminResponse && (
                            <div style={{ marginTop: "4px", fontSize: "9px", color: "#64748b", fontStyle: "italic" }}>
                              "{leave.adminResponse.substring(0, 30)}{leave.adminResponse.length > 30 ? '...' : ''}"
                            </div>
                          )}
                          {leave.rejectionReason && leave.status === 'rejected' && (
                            <div style={{ marginTop: "4px", fontSize: "9px", color: "#dc2626", fontStyle: "italic" }}>
                              Reason: {leave.rejectionReason.substring(0, 20)}{leave.rejectionReason.length > 20 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      </td>
                      {canViewAllLeaves && (
                        <td data-label="Action By" style={{ padding: "12px 16px", minWidth: "120px" }}>
                          {leave.approvedBy ? (
                            <div style={{ fontSize: "11px", color: "#475569", fontWeight: 500 }}>
                              {leave.approvedBy.firstName} {leave.approvedBy.lastName}
                              {leave.approvedAt && (
                                <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px" }}>
                                  {new Date(leave.approvedAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>-</span>
                          )}
                        </td>
                      )}
                      <td data-label="Actions" style={{ padding: "12px 16px", minWidth: "120px" }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                          {/* View Button */}
                          <button
                            className="ist-action-btn"
                            title="View"
                            onClick={() => { setSelectedLeave(leave); setShowDetailsModal(true); }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                          </button>

                          {/* Respond Button: Only HR/Admin and not own leave */}
                          {canRespond && !isOwnLeave && (
                            <button
                              className="ist-action-btn"
                              title="Respond"
                              onClick={() => handleRespond(leave)}
                              onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                            </button>
                          )}

                          {/* Edit Button: Only own leave and only if NOT approved */}
                          {(isOwnLeave || isHrOrAdmin) && (leave.status !== 'approved' || isHrOrAdmin) && (
                            <button
                              className="ist-action-btn"
                              title="Edit"
                              onClick={() => handleEditLeave(leave)}
                              onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            </button>
                          )}

                          {/* Delete Button */}
                          {hasDeletePermission && (isRoleAdmin || isOwnLeave) && leave.status === 'pending' && (
                            <button
                              className="ist-action-btn"
                              title="Delete"
                              onClick={() => handleDeleteLeave(leave._id)}
                              onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination Controls */}
            {filteredLeaves.length > ITEMS_PER_PAGE && (
              <div className="leaves-pagination" style={{
                padding: '8px 14px',
                background: 'white',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                  Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLeaves.length)} of {filteredLeaves.length} records
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentPage(p => p - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: '5px 9px',
                      border: 'none',
                      borderRadius: '7px',
                      background: currentPage === 1 ? '#f0fdf4' : '#a3e635',
                      color: currentPage === 1 ? '#86efac' : '#365314',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      opacity: currentPage === 1 ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.background = '#84cc16'; }}
                    onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.background = '#a3e635'; }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                      Prev
                    </span>
                  </button>
                  <div style={{ display: 'flex', gap: '3px' }}>
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
                            padding: '5px 9px',
                            border: currentPage === pageNum ? 'none' : '1px solid #d9f99d',
                            borderRadius: '7px',
                            background: currentPage === pageNum ? '#a3e635' : '#f0fdf4',
                            color: currentPage === pageNum ? '#365314' : '#4d7c0f',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            minWidth: '28px',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = currentPage === pageNum ? '#84cc16' : '#bef264'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = currentPage === pageNum ? '#a3e635' : '#f0fdf4'; }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '5px 9px',
                      border: 'none',
                      borderRadius: '7px',
                      background: currentPage === totalPages ? '#f0fdf4' : '#a3e635',
                      color: currentPage === totalPages ? '#86efac' : '#365314',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                      opacity: currentPage === totalPages ? 0.5 : 1
                    }}
                    onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = '#84cc16'; }}
                    onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = '#a3e635'; }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      Next
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                    </span>
                  </button>
                </div>
              </div>
            )}
          </>)}

          {/* Holidays section disabled for now */}

          {activeTab === 'leaveBalance' && (
            <div style={{ padding: '20px' }}>
              <h2>Monthly Leave Balance</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
                <div className="stat-card" style={{ padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '14px', color: '#64748b' }}>Monthly Quota</h3>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>{leaveBalance.monthlyQuota}</p>
                </div>
                <div className="stat-card" style={{ padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '14px', color: '#64748b' }}>Leaves Used</h3>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#d97706' }}>{leaveBalance.used}</p>
                </div>
                <div className="stat-card" style={{ padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '14px', color: '#64748b' }}>Remaining</h3>
                  <p style={{ fontSize: '24px', fontWeight: 'bold', color: leaveBalance.remaining > 0 ? '#10b981' : '#ef4444' }}>{leaveBalance.remaining}</p>
                </div>
              </div>
              <div style={{ marginTop: '20px', background: '#eff6ff', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #bfdbfe' }}>
                <InfoIcon />
                <span>Policy: Employees are allowed a maximum of <strong>{leaveBalance.monthlyQuota} leaves</strong> per month.</span>
              </div>
            </div>
          )}

          {activeTab !== 'leaveBalance' && filteredLeaves.length === 0 && (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '14px',
              fontFamily: 'Inter, -apple-system, sans-serif'
            }}>
              No leave records found. Apply for a leave to see it here.
            </div>
          )}


        </div>
      </div>

      {
        showModal && (
          <div onClick={() => { if (!isSubmitting) { setShowModal(false); setEditingLeave(null); setAttachmentFile(null); setExistingAttachment(''); setIsAttachmentRemoved(false); setAttachmentError(''); } }} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '900px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div style={{
                padding: '24px 28px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileTextIcon />
                  </div>
                  <div>
                    <h2 style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#0f172a',
                      fontFamily: 'Inter, -apple-system, sans-serif'
                    }}>{editingLeave ? 'Edit Leave' : 'Apply Leave'}</h2>
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '12.5px',
                      color: '#64748b',
                      fontFamily: 'Inter, -apple-system, sans-serif'
                    }}>{editingLeave ? 'Update your leave request' : 'Submit your leave request'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => { if (!isSubmitting) { setShowModal(false); setEditingLeave(null); setAttachmentFile(null); setExistingAttachment(''); setIsAttachmentRemoved(false); setAttachmentError(''); } }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '24px',
                    color: '#94a3b8',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease',
                    opacity: isSubmitting ? 0.4 : 1
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f1f5f9';
                    e.target.style.color = '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#94a3b8';
                  }}>&times;</button>
              </div>

              <form onSubmit={handleSubmit} style={{ padding: '16px 24px' }}>

                {/* Leave Type */}
                <div style={{ marginBottom: '12px' }}>

                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#334155', fontFamily: 'Inter, -apple-system, sans-serif' }}>Leave Type <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    value={formData.leaveCategory}
                    onChange={(e) => setFormData({ ...formData, leaveCategory: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0f172a', outline: 'none' }}
                    onFocus={(e) => { e.target.style.borderColor = '#3b775e'; e.target.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                  >
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Unpaid Leave">Unpaid Leave</option>
                  </select>
                </div>

                {/* Reason & Duration Type in Grid */}
                <div className="leaves-date-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
  
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#334155', fontFamily: 'Inter, -apple-system, sans-serif' }}>Reason <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value, leaveType: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={(e) => { e.target.style.borderColor = '#3b775e'; e.target.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                    >
                      <option value="Medical">Medical</option>
                      <option value="Personal">Personal</option>
                      <option value="Bereavement">Bereavement</option>
                      <option value="Maternity">Maternity</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
  
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#334155', fontFamily: 'Inter, -apple-system, sans-serif' }}>Duration Type <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      value={formData.durationType}
                      onChange={(e) => setFormData({ ...formData, durationType: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={(e) => { e.target.style.borderColor = '#3b775e'; e.target.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                    >
                      <option value="Full Day">Full Day</option>
                      <option value="Half Day">Half Day</option>
                    </select>
                  </div>
                </div>

                {/* Start Date + End Date */}
                <div className="leaves-date-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
  
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#334155', fontFamily: 'Inter, -apple-system, sans-serif' }}>Start Date</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={(e) => { e.target.style.borderColor = '#3b775e'; e.target.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                  <div>
  
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#334155', fontFamily: 'Inter, -apple-system, sans-serif' }}>End Date</label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      required
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                      onFocus={(e) => { e.target.style.borderColor = '#3b775e'; e.target.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: '12px' }}>

                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#334155', fontFamily: 'Inter, -apple-system, sans-serif' }}>Description <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span></label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    placeholder="Add any additional details about your leave request..."
                    style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'Inter, -apple-system, sans-serif', color: '#0f172a', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => { e.target.style.borderColor = '#3b775e'; e.target.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                  />
                </div>

                {/* Attachment below Reason */}
                <div style={{ marginBottom: '16px' }}>

                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: '#334155', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                    Attachment <span style={{ fontWeight: 400, color: '#94a3b8' }}>(optional)</span> <span style={{ fontWeight: 500, color: '#64748b', fontSize: '11px', marginLeft: '6px' }}>(Supported: <strong style={{ color: '#0f172a' }}>PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP</strong> · Max <strong style={{ color: '#0f172a' }}>2MB</strong>)</span>
                  </label>
                  <div
                    onClick={() => { const el = document.getElementById('leave-attachment-input'); if (el) { el.value = ''; el.click(); } }}
                    style={{
                      border: attachmentError ? '1.5px dashed #ef4444' : '1.5px dashed #e2e8f0',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      background: attachmentError ? '#fef2f2' : '#ffffff',

                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = attachmentError ? '#ef4444' : '#3b775e'; e.currentTarget.style.background = attachmentError ? '#fef2f2' : '#f0fdf4'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = attachmentError ? '#ef4444' : '#e2e8f0'; e.currentTarget.style.background = attachmentError ? '#fef2f2' : '#ffffff'; }}
                  >
                    <DownloadIcon />
                    <span style={{ fontSize: '12.5px', color: (attachmentFile || existingAttachment) ? '#0f172a' : '#94a3b8', fontFamily: 'Inter, -apple-system, sans-serif', flex: 1 }}>
                      {attachmentFile 
                        ? `${attachmentFile.name} (${(attachmentFile.size / 1024).toFixed(0)} KB)` 
                        : (existingAttachment 
                          ? `Current: ${existingAttachment} (Click to change file)` 
                          : 'Click to upload (PDF, DOC, DOCX, JPG, JPEG, PNG, WEBP — max 2MB)')}
                    </span>
                    {(attachmentFile || existingAttachment) && (
                      <button
                        type="button"
                        title="Remove attachment"
                        onClick={handleRemoveAttachment}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '0 4px', display: 'flex', alignItems: 'center' }}
                      >&times;</button>
                    )}
                  </div>
                  <input
                    id="leave-attachment-input"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                  />
                  {attachmentError && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      color: '#b91c1c',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      fontWeight: 500
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{attachmentError}</span>
                    </div>
                  )}
                  <span style={{ display: 'none' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="leaves-action-btn"
                    disabled={isSubmitting}
                    onClick={() => { if (!isSubmitting) { setShowModal(false); setAttachmentFile(null); setExistingAttachment(''); setIsAttachmentRemoved(false); setAttachmentError(''); } }}
                    style={{
                      padding: '9px 20px',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: '9px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontFamily: "'Inter', sans-serif",
                      background: '#fff',
                      color: '#64748b',
                      opacity: isSubmitting ? 0.5 : 1
                    }}>
                    <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      background: isSubmitting
                        ? '#94a3b8'
                        : 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      transition: 'all 0.2s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: isSubmitting ? 0.8 : 1
                    }}
                    onMouseEnter={(e) => { if (!isSubmitting) e.target.style.opacity = '0.9'; }}
                    onMouseLeave={(e) => { if (!isSubmitting) e.target.style.opacity = '1'; }}>
                    {isSubmitting ? (
                      <>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}
                        >
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        <span>{editingLeave ? 'Updating...' : 'Applying...'}</span>
                      </>
                    ) : (
                      <span>{editingLeave ? 'Update Leave' : 'Apply Leave'}</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Admin Response Modal */}
      {
        showResponseModal && selectedLeave && (
          <div onClick={() => setShowResponseModal(false)} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '580px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div style={{
                padding: '24px 28px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircleIcon />
                  </div>
                  <div>
                    <h2 style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#0f172a',
                      fontFamily: 'Inter, -apple-system, sans-serif'
                    }}>Respond to Leave Request</h2>
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '12.5px',
                      color: '#64748b',
                      fontFamily: 'Inter, -apple-system, sans-serif'
                    }}>Approve or reject leave application</p>
                  </div>
                </div>
                <button onClick={() => setShowResponseModal(false)} style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f1f5f9';
                    e.target.style.color = '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#94a3b8';
                  }}>&times;</button>
              </div>

              <div style={{ padding: '20px 28px', background: '#f8fafc', margin: '0', borderBottom: '1px solid #f1f5f9' }}>
                <div className="leaves-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                  <div>
                    <div style={{ color: '#64748b', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee</div>
                    <div style={{ color: '#0f172a', fontWeight: '600' }}>{selectedLeave.employee?.firstName} {selectedLeave.employee?.lastName}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Leave Type</div>
                    <div style={{ color: '#0f172a', fontWeight: '600' }}>{selectedLeave.leaveType}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Period</div>
                    <div style={{ color: '#0f172a', fontWeight: '500' }}>{new Date(selectedLeave.startDate).toLocaleDateString()} - {new Date(selectedLeave.endDate).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div style={{ color: '#64748b', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Applied On</div>
                    <div style={{ color: '#0f172a', fontWeight: '500' }}>{formatDateTimeIST(selectedLeave.createdAt, { includeZone: true })}</div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ color: '#64748b', marginBottom: '4px', fontSize: '11.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason</div>
                    <div style={{ color: '#0f172a', fontWeight: '400' }}>{selectedLeave.reason}</div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleResponseSubmit} style={{ padding: '24px 28px' }}>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    fontFamily: 'Inter, -apple-system, sans-serif'
                  }}>Status *</label>
                  <select
                    value={responseData.status}
                    onChange={(e) => setResponseData({ ...responseData, status: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      color: '#0f172a',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b775e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 119, 94, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">Select Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    fontFamily: 'Inter, -apple-system, sans-serif'
                  }}>Admin Response</label>
                  <textarea
                    value={responseData.adminResponse}
                    onChange={(e) => setResponseData({ ...responseData, adminResponse: e.target.value })}
                    placeholder="Provide feedback or additional information to the employee"
                    rows="4"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      color: '#0f172a',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b775e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 119, 94, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="leaves-action-btn" onClick={() => setShowResponseModal(false)} style={{
                    padding: '10px 16px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    background: 'white',
                    color: '#64748b',
                  }}>
                    <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
                  </button>
                  <button type="submit" style={{
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    transition: 'all 0.2s ease'
                  }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}>
                    Submit Response
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Add/Edit Holiday Modal */}
      {
        false && showHolidayModal && (
          <div onClick={() => setShowHolidayModal(false)} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <div style={{
                padding: '24px 28px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CalendarIcon />
                  </div>
                  <div>
                    <h2 style={{
                      margin: 0,
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#0f172a',
                      fontFamily: 'Inter, -apple-system, sans-serif'
                    }}>{editingHoliday ? 'Edit Holiday' : 'Add Holiday'}</h2>
                    <p style={{
                      margin: '2px 0 0 0',
                      fontSize: '12.5px',
                      color: '#64748b',
                      fontFamily: 'Inter, -apple-system, sans-serif'
                    }}>Manage company holidays</p>
                  </div>
                </div>
                <button onClick={() => setShowHolidayModal(false)} style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease'
                }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#f1f5f9';
                    e.target.style.color = '#0f172a';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#94a3b8';
                  }}>&times;</button>
              </div>

              <form onSubmit={handleHolidaySubmit} style={{ padding: '24px 28px' }}>
                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    fontFamily: 'Inter, -apple-system, sans-serif'
                  }}>Holiday Name *</label>
                  <input
                    type="text"
                    value={holidayFormData.name}
                    onChange={(e) => setHolidayFormData({ ...holidayFormData, name: e.target.value })}
                    required
                    placeholder="e.g., Diwali, Christmas"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      color: '#0f172a',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b775e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 119, 94, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    fontFamily: 'Inter, -apple-system, sans-serif'
                  }}>Date *</label>
                  <input
                    type="date"
                    value={holidayFormData.date}
                    onChange={(e) => setHolidayFormData({ ...holidayFormData, date: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      color: '#0f172a',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b775e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 119, 94, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  {holidayFormData.date && (
                    <div style={{ color: '#64748b', marginTop: '6px', fontSize: '12px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                      Day: <strong>{getDayOfWeek(holidayFormData.date)}</strong>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '18px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '7px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    fontFamily: 'Inter, -apple-system, sans-serif'
                  }}>Occasion/Description</label>
                  <textarea
                    value={holidayFormData.description}
                    onChange={(e) => setHolidayFormData({ ...holidayFormData, description: e.target.value })}
                    placeholder="Brief description of the holiday"
                    rows="3"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '13.5px',
                      fontFamily: 'Inter, -apple-system, sans-serif',
                      color: '#0f172a',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b775e';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 119, 94, 0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    fontFamily: 'Inter, -apple-system, sans-serif'
                  }}>
                    <input
                      type="checkbox"
                      checked={holidayFormData.isOptional}
                      onChange={(e) => setHolidayFormData({ ...holidayFormData, isOptional: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    Optional Holiday
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="leaves-action-btn" onClick={() => {
                    setShowHolidayModal(false);
                    setEditingHoliday(null);
                  }} style={{
                    padding: '10px 16px',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    background: 'white',
                    color: '#64748b',
                  }}>
                    <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
                  </button>
                  <button type="submit" style={{
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                    transition: 'all 0.2s ease'
                  }}
                    onMouseEnter={(e) => e.target.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.target.style.opacity = '1'}>
                    {editingHoliday ? 'Update' : 'Add'} Holiday
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Leave Details Modal */}
      {showDetailsModal && selectedLeave && (
        <div onClick={() => { setShowDetailsModal(false); setSelectedLeave(null); setIsFlipped(false); }} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          perspective: '1200px'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            position: 'relative',
            width: '100%',
            maxWidth: '980px',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}>
            {/* Front Face */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              position: isFlipped ? 'absolute' : 'relative',
              top: 0, left: 0,
              zIndex: isFlipped ? 0 : 1
            }}>
            {/* Header */}
            <div style={{
              padding: '24px 28px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileTextIcon />
                </div>
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#0f172a',
                    fontFamily: 'Inter, -apple-system, sans-serif'
                  }}>Leave Details</h2>
                  <p style={{
                    margin: '2px 0 0 0',
                    fontSize: '12.5px',
                    color: '#64748b',
                    fontFamily: 'Inter, -apple-system, sans-serif'
                  }}>View full leave application info</p>
                </div>
              </div>
              <button onClick={() => { setShowDetailsModal(false); setSelectedLeave(null); }} style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                color: '#94a3b8',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
              }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }}>&times;</button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '0', flex: 1, overflowY: 'auto' }}>

              {/* Employee Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '18px 28px',
                background: '#ffffff',
                borderBottom: '1px solid #f1f5f9'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {selectedLeave.employee?.firstName?.charAt(0)}{selectedLeave.employee?.lastName?.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                    {selectedLeave.employee?.firstName} {selectedLeave.employee?.lastName}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                    Employee ID: {selectedLeave.employee?.employeeId}
                  </div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    background: selectedLeave.status === 'approved' ? '#dcfce7' : selectedLeave.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                    color: selectedLeave.status === 'approved' ? '#166534' : selectedLeave.status === 'rejected' ? '#991b1b' : '#92400e',
                    border: `1px solid ${selectedLeave.status === 'approved' ? '#86efac' : selectedLeave.status === 'rejected' ? '#fecaca' : '#fcd34d'}`
                  }}>
                    {selectedLeave.status === 'approved' ? <CheckCircleIcon /> : selectedLeave.status === 'rejected' ? <XCircleIcon /> : <ClockIcon />}
                    {selectedLeave.status}
                  </span>
                </div>
              </div>

              {/* Details Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                <tbody>
                  {[
                    {
                      label: 'Leave Category',
                      value: (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          background: selectedLeave.leaveCategory === 'Casual Leave' ? '#dbeafe' : '#fee2e2',
                          color: selectedLeave.leaveCategory === 'Casual Leave' ? '#1e40af' : '#991b1b',
                          border: `1px solid ${selectedLeave.leaveCategory === 'Casual Leave' ? '#93c5fd' : '#fecaca'}`,
                          display: 'inline-block'
                        }}>
                          {selectedLeave.leaveCategory}
                        </span>
                      )
                    },
                    {
                      label: 'Leave Type / Reason',
                      value: <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>{selectedLeave.leaveType || selectedLeave.reason}</span>
                    },
                    {
                      label: 'Duration Type',
                      value: (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          background: '#f0fdf4',
                          color: '#166534',
                          border: '1px solid #bbf7d0',
                          display: 'inline-block'
                        }}>
                          {selectedLeave.durationType || 'Full Day'}
                        </span>
                      )
                    },
                    {
                      label: 'Date Range',
                      value: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#0f172a', fontWeight: 500 }}>
                          <CalendarIcon />
                          <span>
                            {new Date(selectedLeave.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} — {new Date(selectedLeave.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      )
                    },
                    {
                      label: 'Applied On',
                      value: (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#475569', fontWeight: 500 }}>
                          <ClockIcon />
                          <span>
                            {formatDateTimeIST(selectedLeave.createdAt, { includeZone: true })}
                          </span>
                        </div>
                      )
                    },
                    {
                      label: 'Description',
                      topAlign: true,
                      value: (
                        <div style={{
                          fontSize: '13px',
                          padding: '12px 16px',
                          background: '#ffffff',
    
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          letterSpacing: '0.01em',
                          color: '#334155',
                          lineHeight: '1.65',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {selectedLeave.description || selectedLeave.reason || '—'}
                        </div>
                      )
                    },
                    ...(selectedLeave.attachmentFileName ? [{
                      label: 'Attachment',
                      value: (
                        <button
                          onClick={() => handleDownloadAttachment(selectedLeave)}
                          style={{
                            background: '#fff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '7px',
                            padding: '6px 14px',
                            fontSize: '12px',
                            color: '#3b775e',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontFamily: 'Inter, -apple-system, sans-serif',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#f0fdf4';
                            e.currentTarget.style.borderColor = '#3b775e';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#fff';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                          }}
                        >
                          <FileTextIcon />
                          <span>{selectedLeave.attachmentFileName}</span>
                        </button>
                      )
                    }] : []),
                    ...(selectedLeave.approvedBy ? [{
                      label: selectedLeave.status === 'rejected' ? 'Rejected By' : 'Approved By',
                      topAlign: true,
                      value: (
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>
                            {selectedLeave.approvedBy.firstName} {selectedLeave.approvedBy.lastName}
                          </div>
                          {selectedLeave.adminResponse && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                              "{selectedLeave.adminResponse}"
                            </div>
                          )}
                          {selectedLeave.rejectionReason && selectedLeave.status === 'rejected' && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626', fontStyle: 'italic' }}>
                              Reason: "{selectedLeave.rejectionReason}"
                            </div>
                          )}
                        </div>
                      )
                    }] : [])
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{
                        padding: '13px 28px',
                        width: '20%',
                        minWidth: '180px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        verticalAlign: row.topAlign ? 'top' : 'middle',
                        whiteSpace: 'nowrap',
                        background: '#ffffff'
                      }}>
                        {row.label}
                      </td>
                      <td style={{
                        padding: '13px 24px',
                        fontSize: '12.5px',
                        color: '#475569',
                        verticalAlign: row.topAlign ? 'top' : 'middle',
                        background: '#fff'
                      }}>
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 28px',
              borderTop: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#ffffff',
              borderRadius: '0 0 16px 16px',
              flexShrink: 0
            }}>
              <button
                onClick={() => { setShowDetailsModal(false); setSelectedLeave(null); setIsFlipped(false); }}
                style={{
                  padding: '9px 20px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: '#fff',
                  color: '#475569',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
              >
                Close
              </button>
              {(canRespond || selectedLeave.employee?._id === user?._id || selectedLeave.employee?._id === user?.userId || selectedLeave.employee?._id === user?.id) && (
                <button
                  onClick={() => setIsFlipped(true)}
                  style={{
                    marginLeft: '10px',
                    padding: '9px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    color: '#fff',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 6px -1px rgba(59, 119, 94, 0.2)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Reply
                </button>
              )}
            </div>
            </div>

            {/* Back Face (Timeline) */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              height: '600px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              position: !isFlipped ? 'absolute' : 'relative',
              top: 0,
              left: 0,
              zIndex: !isFlipped ? 0 : 1
            }}>
              {/* Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: '#ffffff',
                borderRadius: '16px 16px 0 0'
              }}>
                <button onClick={() => setIsFlipped(false)} style={{
                  background: 'transparent', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center'
                }}>
                  ←
                </button>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>Chat History</h2>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>Leave discussion & activity</p>
                </div>
              </div>

              {/* Timeline Items */}
              <div style={{ flex: 1, padding: '24px', overflowY: 'auto', background: '#fff', minHeight: 0 }}>
                {!selectedLeave.timeline || selectedLeave.timeline.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '40px' }}>
                    No activity yet.
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    {selectedLeave.timeline.map((item, index) => (
                      <div key={index} style={{ position: 'relative', paddingLeft: '32px', paddingBottom: '24px' }}>
                        {/* Connecting Line */}
                        {index < selectedLeave.timeline.length - 1 && (
                          <div style={{ position: 'absolute', left: '7px', top: '24px', bottom: 0, width: '2px', background: '#e2e8f0' }} />
                        )}
                        {/* Circle */}
                        <div style={{
                          position: 'absolute', left: 0, top: '2px', width: '16px', height: '16px',
                          borderRadius: '50%', background: '#fff',
                          border: `2px solid ${item.type === 'status_change' ? '#3b82f6' : '#10b981'}`,
                          zIndex: 1
                        }} />
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                              {item.type === 'status_change' ? 'Status Changed' : 'Message'}
                            </div>
                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', lineHeight: '1.5' }}>
                              {item.type !== 'status_change' && <span style={{ color: '#94a3b8' }}>Message: </span>}
                              {item.message}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#cbd5e1' }} />
                              By {item.by?.firstName || 'Admin'} {item.by?.lastName || ''}
                            </div>
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {formatDateTimeIST(item.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reply Input Box */}
              {(canRespond || selectedLeave.employee?._id === user?._id || selectedLeave.employee?._id === user?.userId || selectedLeave.employee?._id === user?.id) && (
                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', borderRadius: '0 0 16px 16px' }}>
                  <form onSubmit={handleReplySubmit} style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      placeholder="Type your message..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '13px',
                        outline: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                    <button type="submit" disabled={!replyMessage.trim()} style={{
                      padding: '10px 20px',
                      background: replyMessage.trim() ? '#3b775e' : '#94a3b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: replyMessage.trim() ? 'pointer' : 'not-allowed',
                      transition: 'background 0.2s'
                    }}>
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewAttachmentUrl && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '980px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>Attachment Preview</h2>
              <button onClick={() => { setPreviewAttachmentUrl(null); setPreviewAttachmentType(null); }} style={{
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s',
                width: '32px',
                height: '32px',
                borderRadius: '6px'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94a3b8'; }}
              >&times;</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', background: '#f8fafc', maxHeight: '70vh', overflow: 'auto' }}>
              {previewAttachmentType && previewAttachmentType.startsWith('image/') ? (
                <img src={previewAttachmentUrl} alt="Attachment Preview" style={{ maxWidth: '100%', borderRadius: '8px' }} />
              ) : (
                <iframe src={previewAttachmentUrl} title="Attachment Preview" style={{ width: '100%', height: '60vh', border: 'none', borderRadius: '8px' }} />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Leaves;
