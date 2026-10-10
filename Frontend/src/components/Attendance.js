import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Camera, XCircle, Loader2 } from 'lucide-react';

const HoverSelfie = ({ record, type, fetchEmployeeSelfie, formatTime }) => {
  const [show, setShow] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const spanRef = useRef(null);

  const isToday = (dateString) => {
    const d = new Date(dateString);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const isRecordToday = isToday(record.date);

  const handleMouseEnter = async () => {
    if (!isRecordToday) return;
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect();
      setPos({ top: rect.top - 150, left: rect.left + rect.width / 2 });
    }
    setShow(true);
    if (!imgSrc && !loading) {
      setLoading(true);
      try {
        const response = await api.get(`/attendance/employee-selfie/${record.employee._id}/${record.date}`);
        if (response.data) {
          if (type === 'login' && response.data.image) setImgSrc(response.data.image);
          if (type === 'logout' && response.data.checkOutImage) setImgSrc(response.data.checkOutImage);
        }
      } catch (err) {
        console.error('Error fetching selfie:', err);
      }
      setLoading(false);
    }
  };

  if (!isRecordToday) {
    return <span style={{ color: '#475569' }}>{formatTime(type === 'login' ? record.loginTime : record.logoutTime)}</span>;
  }

  return (
    <div style={{ display: 'inline-block' }} onMouseEnter={handleMouseEnter} onMouseLeave={() => setShow(false)}>
      <span
        ref={spanRef}
        style={{ cursor: 'pointer', color: '#0ea5e9' }}
        onClick={() => fetchEmployeeSelfie(record.employee._id, record.date, `${record.employee.firstName} ${record.employee.lastName}`)}
      >
        {formatTime(type === 'login' ? record.loginTime : record.logoutTime)}
      </span>
      {show && (
        <div style={{
          position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)',
          padding: '4px', background: '#fff', border: '1px solid #cbd5e1',
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 999999,
          width: '140px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {loading ? <Loader2 className="spin-animation" size={16} color="#94a3b8" /> : (
            imgSrc ? <img src={imgSrc} alt="Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} /> : <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>No Selfie</span>
          )}
        </div>
      )}
    </div>
  );
};

const WeekOffDropdown = ({ currentStatus, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (status) => {
    setIsOpen(false);
    if (status !== 'Week Off') {
      onChange(status);
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <div
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          background: '#f3f4f6',
          color: '#6b7280',
          cursor: 'pointer',
          border: '1px solid #e5e7eb',
          transition: 'all 0.2s',
          boxShadow: isOpen ? '0 0 0 2px rgba(107, 114, 128, 0.2)' : 'none',
          lineHeight: 1.3
        }}
      >
        {currentStatus}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginTop: '6px',
          background: '#fff',
          borderRadius: '8px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.05)',
          border: '1px solid #e2e8f0',
          padding: '4px',
          zIndex: 50,
          minWidth: '100px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          {currentStatus !== 'Week Off' && (
            <div
              onClick={(e) => { e.stopPropagation(); handleSelect('Week Off'); }}
              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#6b7280', cursor: 'pointer', borderRadius: '6px', textAlign: 'center', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Week Off
            </div>
          )}
          {currentStatus !== 'Present' && (
            <div
              onClick={(e) => { e.stopPropagation(); handleSelect('Present'); }}
              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#15803d', cursor: 'pointer', borderRadius: '6px', textAlign: 'center', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#dcfce7'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Present
            </div>
          )}
          {currentStatus !== 'Absent' && (
            <div
              onClick={(e) => { e.stopPropagation(); handleSelect('Absent'); }}
              style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, color: '#dc2626', cursor: 'pointer', borderRadius: '6px', textAlign: 'center', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Absent
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function Attendance() {
  const { hasPermission, user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [appliedMonth, setAppliedMonth] = useState('');
  const [appliedYear, setAppliedYear] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailedModal, setShowDetailedModal] = useState(false);
  const [detailedData, setDetailedData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const isAdmin = user?.role?.name === 'Admin' || user?.role?.name === 'HR';
  const isStrictAdmin = user?.role?.name === 'Admin' || user?.role?.name === 'HR';
  const [showAttendanceConfigModal, setShowAttendanceConfigModal] = useState(false);
  const [attendanceConfig, setAttendanceConfig] = useState({
    markLateAfter: 0.25,
    checkinWindowBefore: 15,
    checkoutGracePeriod: 20
  });

  const fetchAttendanceConfig = async () => {
    if (!isAdmin) return;
    try {
      const response = await api.get("/attendance-configs");
      console.log('Fetched attendance config in Attendance page:', response.data);
      setAttendanceConfig({
        markLateAfter: response.data.markLateAfter,
        checkinWindowBefore: response.data.checkinWindowBefore !== undefined ? response.data.checkinWindowBefore : 15,
        checkoutGracePeriod: response.data.checkoutGracePeriod !== undefined ? response.data.checkoutGracePeriod : 20
      });
    } catch (error) {
      console.error("Error fetching attendance configuration in Attendance page:", error);
    }
  };
  const canReadAttendance = hasPermission?.('attendance', 'read');
  const canUpdateAttendance = hasPermission?.('attendance', 'update');
  const canCreateAttendance = hasPermission?.('attendance', 'create');
  const canDeleteAttendance = hasPermission?.('attendance', 'delete');
  const canClickStatCards = isAdmin;

  // Today's stats (present/absent based on actual check-ins)
  const [todayStats, setTodayStats] = useState({ presentToday: 0, absentToday: 0, totalActive: 0 });
  const [statsType, setStatsType] = useState('today'); // 'today' or 'monthly'

  // Today employee list modal
  const [showTodayModal, setShowTodayModal] = useState(false);
  const [todayModalType, setTodayModalType] = useState(''); // 'present' | 'absent'
  const [todayEmployeeList, setTodayEmployeeList] = useState([]);
  const [loadingTodayList, setLoadingTodayList] = useState(false);
  const [todayModalSearch, setTodayModalSearch] = useState('');

  // Detailed modal month/year selection
  const [detailMonth, setDetailMonth] = useState(new Date().getMonth() + 1);
  const [detailYear, setDetailYear] = useState(new Date().getFullYear());

  // Last 6-months attendance for sparklines
  const [sparklineAttendance, setSparklineAttendance] = useState([]);

  // Edit attendance state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    status: '',
    loginTime: '',
    logoutTime: '',
    workingHours: '',
    reason: ''
  });

  // Add attendance state
  const [showAddModal, setShowAddModal] = useState(false);
  const [employees, setEmployees] = useState([]);

  // Updater Info Modal State
  const [updaterInfo, setUpdaterInfo] = useState(null);
  const [showLegendPopover, setShowLegendPopover] = useState(false);

  // Break modal state
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakModalRecord, setBreakModalRecord] = useState(null);

  // Reason modal state
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonModalText, setReasonModalText] = useState('');
  const [hoveredLateReason, setHoveredLateReason] = useState(null);

  // Edit Reason Modal State
  const [showEditReasonModal, setShowEditReasonModal] = useState(false);
  const [editReasonDetails, setEditReasonDetails] = useState(null);
  const [showReasonCard, setShowReasonCard] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Admin Selfie Modal State
  const [adminSelfieModal, setAdminSelfieModal] = useState({ visible: false, checkInSelfie: null, checkOutSelfie: null, checkInTime: null, checkOutTime: null, employeeName: '' });
  const [fetchingSelfie, setFetchingSelfie] = useState(false);

  const fetchEmployeeSelfie = async (employeeId, date, employeeName) => {
    try {
      setFetchingSelfie(true);
      const response = await api.get(`/attendance/employee-selfie/${employeeId}/${date}`);
      setAdminSelfieModal({
        visible: true,
        employeeName,
        checkInSelfie: response.data.image,
        checkOutSelfie: response.data.checkOutImage,
        checkInTime: response.data.checkInTime,
        checkOutTime: response.data.checkOutTime
      });
    } catch (err) {
      console.error('Error fetching selfie:', err);
      alert('Failed to fetch selfies for this record.');
    } finally {
      setFetchingSelfie(false);
    }
  };

  const handleShowUpdateInfo = (record) => {
    const updatedBy = record.updatedBy;
    const isAdded = record.createdAt && record.updatedAt && (new Date(record.updatedAt).getTime() - new Date(record.createdAt).getTime() < 1000);

    if (updatedBy) {
      setUpdaterInfo({
        name: `${updatedBy.firstName || ''} ${updatedBy.lastName || ''}`,
        date: record.updatedAt ? new Date(record.updatedAt).toLocaleString('en-IN') : 'N/A',
        action: isAdded ? 'added' : 'updated'
      });
    } else {
      setUpdaterInfo({
        name: 'Admin/HR User',
        date: record.updatedAt ? new Date(record.updatedAt).toLocaleString('en-IN') : 'N/A',
        action: isAdded ? 'added' : 'updated'
      });
    }
  };

  // Manual cron trigger state (Admin only)
  const [cronRunning, setCronRunning] = useState(false);
  const [cronResult, setCronResult] = useState(null);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [addForm, setAddForm] = useState({
    employeeId: '',
    date: '',
    status: 'present',
    loginTime: '',
    logoutTime: '',
    workingHours: '',
    reason: ''
  });

  const [showStatsCards, setShowStatsCards] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 120) {
        // Only hide on scroll down, don't auto-show on scroll up
        setShowStatsCards(false);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fetchAttendance = useCallback(async (filters = {}, showLoading = true) => {
    if (!canReadAttendance) {
      setLoading(false);
      return;
    }
    try {
      if (showLoading) {
        setLoading(true);
      }
      const params = new URLSearchParams();

      if (filters.startDate && filters.endDate) {
        params.append('startDate', filters.startDate);
        params.append('endDate', filters.endDate);
      } else if (filters.month && filters.year) {
        const monthStart = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
        const monthEnd = formatDateInputValue(new Date(filters.year, filters.month, 0));

        params.append('startDate', monthStart);
        params.append('endDate', monthEnd);
      }

      const queryString = params.toString();
      const url = queryString ? `/attendance?${queryString}` : '/attendance';
      const response = await api.get(url);
      const sorted = response.data.slice().sort((a, b) => {
        const dateA = new Date(a.date || a.loginTime || 0);
        const dateB = new Date(b.date || b.loginTime || 0);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB - dateA;
        }
        const timeA = new Date(a.loginTime || a.logoutTime || 0);
        const timeB = new Date(b.loginTime || b.logoutTime || 0);
        return timeB - timeA;
      });
      setAttendance(sorted);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    if (!canReadAttendance) return;
    api.get('/attendance/today-stats')
      .then(res => {
        setTodayStats(res.data);
        // Store the type to determine labels
        setStatsType(res.data.type || 'today');
      })
      .catch(err => console.error('Error fetching today stats:', err));
  }, []);

  useEffect(() => {
    if (!canReadAttendance) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = d => d.toISOString().slice(0, 10);
    api.get(`/attendance?startDate=${fmt(start)}&endDate=${fmt(end)}`)
      .then(res => setSparklineAttendance(res.data))
      .catch(err => console.error('Error fetching sparkline data:', err));
  }, [isAdmin, canReadAttendance]);



  const saveAttendanceConfig = async () => {
    if (!isAdmin) return;
    try {
      console.log('Saving attendance configuration from Attendance page:', attendanceConfig);

      const response = await api.put("/attendance-configs", attendanceConfig);
      console.log('Attendance configuration saved successfully from Attendance page:', response.data);

      alert('Attendance configuration saved successfully!');
      setShowAttendanceConfigModal(false);
    } catch (error) {
      console.error('Error saving attendance configuration from Attendance page:', error);
      alert(error.response?.data?.message || 'Error saving attendance configuration. Please try again.');
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAttendanceConfig();
    }
  }, [isAdmin]);

  // Close attendance config modal when clicking outside
  useEffect(() => {
    if (!showAttendanceConfigModal) return;
    const close = (e) => {
      if (e.target.closest('[data-attendance-config-button]') || e.target.closest('[data-attendance-config-panel]')) {
        return;
      }
      setShowAttendanceConfigModal(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showAttendanceConfigModal]);

  // Close employee dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showEmployeeDropdown) {
        setShowEmployeeDropdown(false);
      }
    };

    if (showEmployeeDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showEmployeeDropdown]);

  // Close legend popover when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showLegendPopover) {
        setShowLegendPopover(false);
      }
    };

    if (showLegendPopover) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showLegendPopover]);

  // Sparkline data — last 6 months
  const sparklineData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    const countFor = filterFn =>
      months.map(({ year, month }) =>
        sparklineAttendance.filter(r => {
          const d = new Date(r.date);
          return d.getFullYear() === year && d.getMonth() === month && filterFn(r);
        }).length
      );
    return {
      present: countFor(r => r.loginTime),
      absent: countFor(r => !r.loginTime),
      total: countFor(() => true),
    };
  }, [sparklineAttendance]);

  // Previous month stats for trend comparison
  const prevMonthStats = useMemo(() => {
    const now = new Date();
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prev = sparklineAttendance.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    return {
      present: prev.filter(r => r.loginTime).length,
      absent: prev.filter(r => !r.loginTime).length,
      total: prev.length,
    };
  }, [sparklineAttendance]);

  // Trend helpers
  const calcChange = (cur, prev) => {
    if (prev === 0) return cur > 0 ? '+100%' : '0%';
    const pct = ((cur - prev) / prev) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };
  const isUp = (cur, prev) => cur >= prev;

  const handleTodayCardClick = async (type) => {
    if (!canReadAttendance) return;
    setTodayModalType(type);
    setTodayEmployeeList([]); // clear stale data immediately
    setShowTodayModal(true);
    setLoadingTodayList(true);
    try {
      const res = await api.get(`/attendance/today-list?type=${type}`);
      setTodayEmployeeList(res.data);
    } catch (err) {
      console.error('Error fetching today employee list:', err);
      setTodayEmployeeList([]);
    } finally {
      setLoadingTodayList(false);
    }
  };

  // Sparkline SVG component
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
    const gradId = `slg-att-${color.replace('#', '')}`;
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

  // Pagination logic
  // First filter by search query
  const filteredAttendance = useMemo(() => {
    if (!searchQuery.trim()) return attendance;

    const query = searchQuery.toLowerCase();
    return attendance.filter(record => {
      const employee = record.employee;
      if (!employee) return false;

      // Search by name
      const fullName = `${employee.firstName || ''} ${employee.lastName || ''}`.toLowerCase();
      if (fullName.includes(query)) return true;

      // Search by employee ID
      if (employee.employeeId && employee.employeeId.toLowerCase().includes(query)) return true;

      // Search by designation
      if (employee.designation && employee.designation.toLowerCase().includes(query)) return true;

      return false;
    });
  }, [attendance, searchQuery]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentAttendance = filteredAttendance.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredAttendance.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset to page 1 when attendance data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [attendance.length]);

  const handleFilter = () => {
    if (startDate && endDate) {
      setAppliedStartDate(startDate);
      setAppliedEndDate(endDate);
      setAppliedMonth('');
      setAppliedYear('');
      fetchAttendance({ startDate, endDate });
    } else if (!startDate && !endDate) {
      setAppliedStartDate('');
      setAppliedEndDate('');
      setAppliedMonth(selectedMonth);
      setAppliedYear(selectedYear);
      fetchAttendance({ month: selectedMonth, year: selectedYear });
    } else {
      alert('Please select both start date and end date');
    }
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    setAppliedStartDate('');
    setAppliedEndDate('');
    setAppliedMonth('');
    setAppliedYear('');
    setSelectedMonth(new Date().getMonth() + 1);
    setSelectedYear(new Date().getFullYear());
    fetchAttendance();
  };

  // Run the missed-checkout cron immediately (Admin only)
  const handleRunCron = async () => {
    if (cronRunning) return;
    setCronRunning(true);
    setCronResult(null);
    try {
      const res = await api.post('/attendance/run-missed-checkout-cron');

      // Handle new response format with month-wide processing
      const { totalMarked, monthStats, dayResults } = res.data;

      let message = `Done — Total marked absent: ${totalMarked}`;

      if (monthStats) {
        message += ` (${monthStats.totalRecords} total records, ${monthStats.withoutCheckout} without checkout)`;
      }

      if (dayResults && dayResults.length > 0) {
        const dayBreakdown = dayResults.map(day => `${day.date.split(' ').slice(0, 3).join(' ')}: ${day.marked}`).join(', ');
        message += `\nDays processed: ${dayBreakdown}`;
      }

      setCronResult({
        success: true,
        message: message,
      });

      // Refresh attendance list so changes show immediately
      await fetchAttendance({ month: appliedMonth || selectedMonth, year: appliedYear || selectedYear }, false);
    } catch (err) {
      setCronResult({
        success: false,
        message: err.response?.data?.message || 'Failed to run cron',
      });
    } finally {
      setCronRunning(false);
      // Auto-clear the result toast after 8 seconds (longer for more detailed message)
      setTimeout(() => setCronResult(null), 8000);
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();

      if (appliedStartDate && appliedEndDate) {
        params.append('startDate', appliedStartDate);
        params.append('endDate', appliedEndDate);
      } else if (appliedMonth && appliedYear) {
        // Export all employees' attendance for the selected month
        params.append('month', appliedMonth);
        params.append('year', appliedYear);
      } else if (selectedMonth && selectedYear) {
        // If no filter applied, use current selected month/year
        params.append('month', selectedMonth);
        params.append('year', selectedYear);
      }

      const queryString = params.toString();
      const url = queryString ? `/attendance/export/excel?${queryString}` : '/attendance/export/excel';

      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);

      // Generate filename based on filter
      let filename;
      if (appliedStartDate && appliedEndDate) {
        filename = `Attendance_${appliedStartDate}_to_${appliedEndDate}.xlsx`;
      } else {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'];
        const month = appliedMonth || selectedMonth;
        const year = appliedYear || selectedYear;
        const monthName = monthNames[month - 1];
        filename = `All_Employees_Attendance_${monthName}_${year}.xlsx`;
      }

      link.download = filename;
      link.click();
    } catch (error) {
      console.error('Error exporting excel:', error);
      alert(error.response?.data?.message || 'Error exporting Excel file');
    }
  };



  // const getStatusBadge = (status) => {
  //   const badges = {
  //     present: 'badge-success',
  //     absent: 'badge-danger',
  //     'half-day': 'badge-warning'
  //   };
  //   return badges[status] || 'badge-info';
  // };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    return new Date(time).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateTotalBreakDuration = (breaks) => {
    if (!breaks || breaks.length === 0) return 0;
    return breaks.reduce((sum, b) => {
      if (b.endTime) {
        return sum + (b.duration || 0);
      } else {
        const activeDuration = Math.round((Date.now() - new Date(b.startTime)) / 60000);
        return sum + Math.max(0, activeDuration);
      }
    }, 0);
  };

  const calculateBadgeBreakDuration = (breaks) => {
    if (!breaks || breaks.length === 0) return 0;
    return breaks.reduce((sum, b) => {
      const startMs = new Date(b.startTime).getTime();
      const endMs = b.endTime ? new Date(b.endTime).getTime() : Date.now();
      return sum + Math.max(0, Math.floor((endMs - startMs) / 1000));
    }, 0);
  };

  const formatBreakDuration = (minutes) => {
    if (!minutes) return '0:00';
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hrs}:${String(mins).padStart(2, '0')}`;
  };

  const formatDurationHMS = (seconds) => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatWorkingDuration = (hours, logoutMethod) => {
    const numeric = Number(hours);

    // Show N/A for not-checkout cases with 0 working hours
    if (logoutMethod === 'not-checkout' && (numeric === 0 || !numeric)) {
      return 'N/A';
    }

    if (!numeric || numeric <= 0) return 'N/A';
    const totalSecs = Math.round(numeric * 3600);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getLocationLabel = (location) => {
    if (!location || (!location.latitude && !location.longitude)) {
      return 'N/A';
    }

    // Office coordinates
    const OFFICE_LAT = 28.62886;
    const OFFICE_LNG = 77.38141;
    const OFFICE_RADIUS = 50; // 50 meters

    // Calculate distance
    const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
      const R = 6371000; // Earth radius in meters
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const distance = getDistanceMeters(
      location.latitude,
      location.longitude,
      OFFICE_LAT,
      OFFICE_LNG
    );

    if (distance <= OFFICE_RADIUS) {
      return 'Office';
    }

    return location.address || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount || 0);
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

  const handleViewDetails = async (employeeId) => {
    if (!canReadAttendance) return;
    setLoadingDetails(true);
    setShowDetailedModal(true);
    // Set current month/year when opening modal
    setDetailMonth(selectedMonth);
    setDetailYear(selectedYear);

    try {
      const response = await api.get(`/attendance/employee-details/${employeeId}`, {
        params: { month: selectedMonth, year: selectedYear }
      });
      setDetailedData(response.data);
    } catch (error) {
      console.error('Error fetching detailed attendance:', error);
      const errorMessage = error.response?.data?.message || 'Error loading attendance details. Please try again.';
      alert(errorMessage);
      setShowDetailedModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Fetch attendance details for selected month
  const fetchDetailedAttendance = async (employeeId, month, year) => {
    setLoadingDetails(true);
    try {
      const response = await api.get(`/attendance/employee-details/${employeeId}`, {
        params: { month, year }
      });
      setDetailedData(response.data);
    } catch (error) {
      console.error('Error fetching detailed attendance:', error);
      alert(error.response?.data?.message || 'Error loading attendance details');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Handle month change in detail modal
  const handleDetailMonthChange = (month, year) => {
    setDetailMonth(month);
    setDetailYear(year);
    if (detailedData?.employee?.employeeId) {
      fetchDetailedAttendance(detailedData.employee._id, month, year);
    }
  };

  // Handle inline status change for Week Off days
  const handleWeekOffStatusChange = async (dayString, newStatus) => {
    if (!canUpdateAttendance || !detailedData || !detailedData.employee) return;
    try {
      // dayString is like "1", "2", we need to format it to YYYY-MM-DD
      const recordDate = new Date(detailYear, detailMonth - 1, parseInt(dayString));
      const formattedDate = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;

      // Convert "Present" or "Absent" to lowercase for the API, keep "Week Off" logic safe
      const apiStatus = newStatus.toLowerCase();

      // The backend now supports reverting to Week Off by deleting the manual attendance record.

      await api.put('/attendance/update-status', {
        employeeId: detailedData.employee._id,
        date: formattedDate,
        status: apiStatus,
        editReason: 'Updated status for Week Off day'
      });

      // Refetch to get the updated detailed data
      fetchDetailedAttendance(detailedData.employee._id, detailMonth, detailYear);
    } catch (error) {
      console.error('Error updating week off status:', error);
      alert(error.response?.data?.message || 'Error updating status');
    }
  };

  // Export employee attendance to Excel
  const handleExportEmployeeAttendance = async () => {
    if (!detailedData?.employee?._id) {
      alert('No employee data available to export');
      return;
    }

    try {
      const response = await api.get(
        `/attendance/employee-details/${detailedData.employee._id}/export`,
        {
          params: { month: detailMonth, year: detailYear },
          responseType: 'blob'
        }
      );

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[detailMonth - 1];

      link.download = `${detailedData.employee.name.replace(/\s+/g, '_')}_Attendance_${monthName}_${detailYear}.xlsx`;
      link.click();
    } catch (error) {
      console.error('Error exporting attendance:', error);
      alert(error.response?.data?.message || 'Error exporting attendance data');
    }
  };

  const handleEditClick = (record) => {
    if (!canUpdateAttendance) return;
    setEditingRecord(record);
    setEditForm({
      status: record.status || 'present',
      loginTime: record.loginTime ? formatDateTimeLocal(record.loginTime) : '',
      logoutTime: record.logoutTime ? formatDateTimeLocal(record.logoutTime) : '',
      workingHours: record.workingHours || '',
      reason: record.editReason || ''
    });
    setShowEditModal(true);
  };

  const fetchAttendanceHistory = async (recordId) => {
    try {
      const response = await api.get(`/attendance/history/${recordId}`);
      return response.data.history || [];
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      return [];
    }
  };

  const formatDateInputValue = (value) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateTimeLocal = (value) => {
    const date = new Date(value);
    return `${formatDateInputValue(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getTimeParts = (datetimeStr) => {
    if (!datetimeStr) return { hour: '09', minute: '00', period: 'AM' };
    const dt = new Date(datetimeStr);
    let hour = dt.getHours();
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return {
      hour: hour.toString().padStart(2, '0'),
      minute: dt.getMinutes().toString().padStart(2, '0'),
      period
    };
  };

  const buildDateTime = (date, hour, minute, period) => {
    if (!date) return '';
    let hour24 = parseInt(hour, 10);
    if (period === 'PM' && hour24 !== 12) hour24 += 12;
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    return `${date}T${hour24.toString().padStart(2, '0')}:${minute}`;
  };

  const updateTimeField = (field, part, value) => {
    const attendanceDate = formatDateInputValue(editingRecord?.date || new Date());
    const currentValue = editForm[field];
    const timeParts = getTimeParts(currentValue);
    const nextParts = { ...timeParts, [part]: value };
    const newDateTime = buildDateTime(attendanceDate, nextParts.hour, nextParts.minute, nextParts.period);

    const updatedForm = {
      ...editForm,
      [field]: newDateTime
    };

    // Auto-calculate working hours if both login and logout times are set
    if (field === 'loginTime' || field === 'logoutTime') {
      const loginTime = field === 'loginTime' ? newDateTime : editForm.loginTime;
      const logoutTime = field === 'logoutTime' ? newDateTime : editForm.logoutTime;

      if (loginTime && logoutTime && loginTime.trim() !== '' && logoutTime.trim() !== '') {
        try {
          const login = new Date(loginTime);
          const logout = new Date(logoutTime);

          if (!isNaN(login.getTime()) && !isNaN(logout.getTime())) {
            let diffMs = logout - login;
            let diffHours = diffMs / (1000 * 60 * 60);

            // Handle overnight shifts: if logout is before login, add 24 hours
            if (diffHours < 0) {
              diffHours += 24;
            }

            updatedForm.workingHours = Math.round(diffHours * 100) / 100;
          }
        } catch (err) {
          console.error('Error calculating working hours:', err);
        }
      }
    }

    setEditForm(updatedForm);
  };

  const clearTimeField = (field) => {
    const updatedForm = { ...editForm, [field]: '' };

    // Recalculate working hours if clearing login or logout time
    if (field === 'loginTime' || field === 'logoutTime') {
      const loginTime = field === 'loginTime' ? '' : editForm.loginTime;
      const logoutTime = field === 'logoutTime' ? '' : editForm.logoutTime;

      // If either time is cleared, reset working hours
      if (!loginTime || !logoutTime || loginTime.trim() === '' || logoutTime.trim() === '') {
        updatedForm.workingHours = '';
      }
    }

    setEditForm(updatedForm);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!canUpdateAttendance) return;
    try {
      // Format date as YYYY-MM-DD to avoid timezone issues
      const recordDate = new Date(editingRecord.date);
      const formattedDate = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}-${String(recordDate.getDate()).padStart(2, '0')}`;

      const payload = {
        employeeId: editingRecord.employee._id,
        date: formattedDate,
        status: editForm.status,
        editReason: editForm.reason
      };

      // Only send times if they have values
      // Convert local datetime string to UTC ISO string so the server stores the correct time
      if (editForm.loginTime && editForm.loginTime.trim() !== '') {
        payload.loginTime = new Date(editForm.loginTime).toISOString();
      }
      if (editForm.logoutTime && editForm.logoutTime.trim() !== '') {
        payload.logoutTime = new Date(editForm.logoutTime).toISOString();
      }

      // Only send working hours if manually specified AND times are not both provided
      // If both times are provided, let backend calculate
      if (editForm.workingHours && editForm.workingHours !== '' &&
        !(payload.loginTime && payload.logoutTime)) {
        payload.workingHours = parseFloat(editForm.workingHours);
      }

      // Close modal immediately
      setShowEditModal(false);
      setEditForm({ status: '', loginTime: '', logoutTime: '', workingHours: '', reason: '' });

      // Make API call
      const response = await api.put('/attendance/update-status', payload);

      // Optimistically update the record in the list
      const updatedRecord = response.data.attendance;
      setAttendance(prev => prev.map(record =>
        record._id === editingRecord._id ? updatedRecord : record
      ));

    } catch (error) {
      console.error('Error updating attendance:', error);
      alert(error.response?.data?.message || 'Error updating attendance');

      // Refetch on error to ensure data consistency
      fetchAttendance({
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        month: appliedMonth,
        year: appliedYear,
      }, false); // Don't show loading on error refetch
    }
  };

  // Add record functions
  const handleAddClick = async () => {
    if (!canCreateAttendance) return;
    setLoadingEmployees(true);
    try {
      const response = await api.get('/attendance/employees/active');
      setEmployees(response.data);

      const todayDate = formatDateInputValue(new Date());
      const defaultLogin = buildDateTime(todayDate, '09', '00', 'AM');
      const defaultLogout = buildDateTime(todayDate, '06', '00', 'PM');

      setAddForm({
        employeeId: '',
        date: todayDate,
        status: 'present',
        loginTime: defaultLogin,
        logoutTime: defaultLogout,
        workingHours: 9.0,
        reason: ''
      });
      setShowAddModal(true);
    } catch (error) {
      console.error('Error fetching employees:', error);
      alert(error.response?.data?.message || 'Error loading employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Delete record function
  const handleDeleteRecord = async (record) => {
    if (!canDeleteAttendance) return;
    if (!window.confirm(`Are you sure you want to delete the attendance record for ${record.employee?.firstName} ${record.employee?.lastName} on ${new Date(record.date).toLocaleDateString()}?`)) {
      return;
    }

    try {
      // Optimistically remove from UI
      setAttendance(prev => prev.filter(r => r._id !== record._id));

      // Update stats optimistically
      if (record.loginTime) {
        setTodayStats(prev => ({
          ...prev,
          presentToday: Math.max(0, prev.presentToday - 1)
        }));
      }

      // Make API call
      await api.delete(`/attendance/${record._id}`);

    } catch (error) {
      console.error('Error deleting attendance:', error);
      alert(error.response?.data?.message || 'Error deleting attendance record');

      // Refetch on error to ensure data consistency
      fetchAttendance({
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        month: appliedMonth,
        year: appliedYear,
      }, false);
    }
  };

  const updateAddTimeField = (field, part, value) => {
    const attendanceDate = addForm.date;
    const currentValue = addForm[field];
    const timeParts = getTimeParts(currentValue);
    const nextParts = { ...timeParts, [part]: value };
    const newDateTime = buildDateTime(attendanceDate, nextParts.hour, nextParts.minute, nextParts.period);

    const updatedForm = {
      ...addForm,
      [field]: newDateTime
    };

    // Auto-calculate working hours if both login and logout times are set
    if (field === 'loginTime' || field === 'logoutTime') {
      const loginTime = field === 'loginTime' ? newDateTime : addForm.loginTime;
      const logoutTime = field === 'logoutTime' ? newDateTime : addForm.logoutTime;

      if (loginTime && logoutTime && loginTime.trim() !== '' && logoutTime.trim() !== '') {
        try {
          const login = new Date(loginTime);
          const logout = new Date(logoutTime);

          if (!isNaN(login.getTime()) && !isNaN(logout.getTime())) {
            let diffMs = logout - login;
            let diffHours = diffMs / (1000 * 60 * 60);

            // Handle overnight shifts: if logout is before login, add 24 hours
            if (diffHours < 0) {
              diffHours += 24;
            }

            updatedForm.workingHours = Math.round(diffHours * 100) / 100;
          }
        } catch (err) {
          console.error('Error calculating working hours:', err);
        }
      }
    }

    setAddForm(updatedForm);
  };

  const clearAddTimeField = (field) => {
    const updatedForm = { ...addForm, [field]: '' };

    if (field === 'loginTime' || field === 'logoutTime') {
      const loginTime = field === 'loginTime' ? '' : addForm.loginTime;
      const logoutTime = field === 'logoutTime' ? '' : addForm.logoutTime;

      if (loginTime && logoutTime && loginTime.trim() !== '' && logoutTime.trim() !== '') {
        try {
          const login = new Date(loginTime);
          const logout = new Date(logoutTime);

          if (!isNaN(login.getTime()) && !isNaN(logout.getTime())) {
            let diffMs = logout - login;
            let diffHours = diffMs / (1000 * 60 * 60);

            // Handle overnight shifts: if logout is before login, add 24 hours
            if (diffHours < 0) {
              diffHours += 24;
            }

            updatedForm.workingHours = Math.round(diffHours * 100) / 100;
          }
        } catch (err) {
          console.error('Error calculating working hours:', err);
        }
      } else {
        updatedForm.workingHours = '';
      }
    }

    setAddForm(updatedForm);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!canCreateAttendance) return;

    if (!addForm.employeeId || !addForm.date) {
      alert('Please select an employee and date');
      return;
    }

    // Close dropdown if open
    setShowEmployeeDropdown(false);

    try {
      const payload = {
        employeeId: addForm.employeeId,
        date: addForm.date,
        status: addForm.status,
        isNewRecord: true, // Flag to indicate this is a new record creation
        editReason: addForm.reason
      };

      if (addForm.loginTime && addForm.loginTime.trim() !== '') {
        payload.loginTime = new Date(addForm.loginTime).toISOString();
      }
      if (addForm.logoutTime && addForm.logoutTime.trim() !== '') {
        payload.logoutTime = new Date(addForm.logoutTime).toISOString();
      }

      if (addForm.workingHours && addForm.workingHours !== '' &&
        !(payload.loginTime && payload.logoutTime)) {
        payload.workingHours = parseFloat(addForm.workingHours);
      }

      // Close modal immediately for better UX
      setShowAddModal(false);
      setAddForm({ employeeId: '', date: '', status: 'present', loginTime: '', logoutTime: '', workingHours: '', reason: '' });
      setEmployeeSearch('');

      // Make API call
      const response = await api.put('/attendance/update-status', payload);

      // Optimistically add the new record to the list without refetching
      const newRecord = response.data.attendance;
      setAttendance(prev => [newRecord, ...prev]);

      // Update stats optimistically
      if (newRecord.loginTime) {
        setTodayStats(prev => ({
          ...prev,
          presentToday: prev.presentToday + 1
        }));
      }

    } catch (error) {
      console.error('Error adding attendance:', error);

      // Check if it's a duplicate record error
      if (error.response?.status === 409 && error.response?.data?.existingRecord) {
        alert('Attendance record already exists for this employee on this date. Please edit the existing record instead.');
      } else {
        alert(error.response?.data?.message || 'Error adding attendance record');
      }

      // Refetch on error to ensure data consistency
      fetchAttendance({
        startDate: appliedStartDate,
        endDate: appliedEndDate,
        month: appliedMonth,
        year: appliedYear,
      }, false); // Don't show loading on error refetch
    }
  };

  const skeletonStyles = `
    <style>
      @keyframes attendance-shimmer {
        0%   { background-position: -600px 0; }
        100% { background-position:  600px 0; }
      }
      @keyframes spin {
        0%   { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .attendance-skeleton-cell {
        height: 14px;
        border-radius: 6px;
        background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
        background-size: 600px 100%;
        animation: attendance-shimmer 1.4s infinite linear;
      }
      .attendance-skeleton-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
        background-size: 600px 100%;
        animation: attendance-shimmer 1.4s infinite linear;
      }
      .attendance-skeleton-badge {
        width: 70px;
        height: 24px;
        border-radius: 20px;
        background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
        background-size: 600px 100%;
        animation: attendance-shimmer 1.4s infinite linear;
      }
      .attendance-skeleton-button {
        width: 80px;
        height: 30px;
        border-radius: 8px;
        background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
        background-size: 600px 100%;
        animation: attendance-shimmer 1.4s infinite linear;
      }

      /* Bubble float animations */
      @keyframes att-bubble-large {
        0%   { transform: translate(0px, 0px) scale(1); }
        30%  { transform: translate(-5px, -7px) scale(1.04); }
        60%  { transform: translate(4px, -4px) scale(0.97); }
        100% { transform: translate(0px, 0px) scale(1); }
      }
      @keyframes att-bubble-small {
        0%   { transform: translate(0px, 0px) scale(1); }
        35%  { transform: translate(6px, -9px) scale(1.06); }
        65%  { transform: translate(-4px, -3px) scale(0.95); }
        100% { transform: translate(0px, 0px) scale(1); }
      }

      /* Floating bubble effects on attendance stat cards */
      .att-stats-grid > div {
        position: relative;
        overflow: hidden;
        isolation: isolate;
      }
      .att-stats-grid > div::before {
        content: '';
        position: absolute;
        z-index: 0;
        width: 90px;
        height: 90px;
        border-radius: 50%;
        opacity: 0.06;
        right: -26px;
        bottom: -26px;
        pointer-events: none;
        animation: att-bubble-large 5.5s ease-in-out infinite;
      }
      .att-stats-grid > div::after {
        content: '';
        position: absolute;
        z-index: 0;
        width: 54px;
        height: 54px;
        border-radius: 50%;
        opacity: 0.04;
        right: 36px;
        bottom: -20px;
        pointer-events: none;
        animation: att-bubble-small 4.2s ease-in-out infinite;
      }

      /* Per-card bubble colors: Present=green, Absent=red, Total=indigo */
      .att-stats-grid > div:nth-child(1)::before,
      .att-stats-grid > div:nth-child(1)::after { background: #10b981; }
      .att-stats-grid > div:nth-child(2)::before,
      .att-stats-grid > div:nth-child(2)::after { background: #ef4444; }
      .att-stats-grid > div:nth-child(3)::before,
      .att-stats-grid > div:nth-child(3)::after { background: #667eea; }

      /* Stagger animation delays */
      .att-stats-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
      .att-stats-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
      .att-stats-grid > div:nth-child(2)::after  { animation-delay: 1.2s; }
      .att-stats-grid > div:nth-child(3)::after  { animation-delay: 0.5s; }

      /* Card modal scale-in */
      @keyframes att-modal-pop {
        from { transform: scale(0.94); opacity: 0; }
        to   { transform: scale(1);    opacity: 1; }
      }
      .att-today-modal-card {
        animation: att-modal-pop 0.22s cubic-bezier(0.22, 1, 0.36, 1) both;
      }

      /* Backdrop fade-in */
      @keyframes att-backdrop-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .att-today-backdrop {
        animation: att-backdrop-in 0.18s ease both;
      }

      /* Row slide-in from right */
      @keyframes att-row-slide-in {
        from { transform: translateX(60px); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
    </style>
  `;

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: skeletonStyles }} />
      <style>{`
        /* Arrow jiggle animation */
        @keyframes att-arrow-jiggle {
          0%,  65%, 100% { transform: translateX(0);   }
          70%            { transform: translateX(5px);  }
          76%            { transform: translateX(-4px); }
          82%            { transform: translateX(4px);  }
          88%            { transform: translateX(-2px); }
          94%            { transform: translateX(2px);  }
          97%            { transform: translateX(0);    }
        }
        .att-arrow-jiggle {
          animation: att-arrow-jiggle 3.5s ease-in-out infinite;
        }

        /* Late reason hover card popover */
        .att-status-td {
          position: relative;
        }
        .att-status-td:hover .late-reason-hover-card {
          opacity: 1;
          visibility: visible;
          transform: translateX(-50%) translateY(0);
        }
        .late-reason-hover-card {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%) translateY(6px);
          background: #ffffff;
          border: 1px solid #fed7aa;
          border-radius: 10px;
          padding: 10px 14px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
          white-space: normal;
          width: max-content;
          max-width: 260px;
          z-index: 99999;
          opacity: 0;
          visibility: hidden;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          text-align: left;
        }
        .late-reason-hover-card::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -6px;
          border-width: 6px;
          border-style: solid;
          border-color: #ffffff transparent transparent transparent;
        }

        /* Cancel button animated hover effect */
        .attendance-cancel-btn::before,
        .attendance-clear-btn::before,
        .attendance-view-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }

        .attendance-cancel-btn::after,
        .attendance-clear-btn::after,
        .attendance-view-btn::after {
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

        .attendance-cancel-btn:hover,
        .attendance-clear-btn:hover,
        .attendance-view-btn:hover {
          color: #1f2937 !important;
          border-color: transparent !important;
        }

        .attendance-cancel-btn:hover::before,
        .attendance-clear-btn:hover::before,
        .attendance-view-btn:hover::before {
          transform: translateX(0%);
        }

        .attendance-cancel-btn:hover::after,
        .attendance-clear-btn:hover::after,
        .attendance-view-btn:hover::after {
          transform: translateX(255%) rotate(8deg);
        }
        @media (max-width: 768px) {
          .att-edit-form-grid {
            grid-template-columns: 1fr !important;
          }
          .att-time-grid {
            grid-template-columns: 1fr 1fr 0.8fr !important;
          }
          .att-detail-info-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .att-detail-salary-grid {
            grid-template-columns: 1fr !important;
          }
          .att-today-modal-card {
            width: 96vw !important;
            max-width: 96vw !important;
          }
        }
        @media (max-width: 480px) {
          .att-detail-info-grid {
            grid-template-columns: 1fr !important;
          }
          .att-time-grid {
            grid-template-columns: 1fr !important;
          }
        }
        .att-updated-badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(14, 165, 233, 0.2);
          background-color: rgba(14, 165, 233, 0.25) !important;
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
      `}</style>

      <div
        className="page-container"
        style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "#f8fafc",
          padding: "28px 28px 40px",
          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "22px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "24px",
                fontWeight: 600,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.025em",
              }}
            >
              Attendance Management
            </h1>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>
              Track and manage employee attendance and working hours.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', position: 'relative' }}>
            {isAdmin && (
              <div style={{ position: 'relative' }}>
                <button
                  data-attendance-config-button="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAttendanceConfigModal(!showAttendanceConfigModal);
                  }}
                  style={{
                    padding: '10px 18px',
                    border: 'none',
                    borderRadius: '10px',
                    background: showAttendanceConfigModal
                      ? 'linear-gradient(135deg, #2d5a42 0%, #4a7c59 100%)'
                      : 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(59, 119, 94, 0.2)',
                    transition: 'all 0.2s',
                    fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                  }}
                  onMouseEnter={(e) => {
                    if (!showAttendanceConfigModal) {
                      e.currentTarget.style.opacity = '0.92';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!showAttendanceConfigModal) {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                  title="Configure attendance rules"
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

                {/* Attendance Configuration Dropdown Panel */}
                {showAttendanceConfigModal && (
                  <div
                    data-attendance-config-panel="true"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '600px',
                      maxWidth: '95vw',
                      background: '#fff',
                      borderRadius: '16px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                      zIndex: 1000,
                      animation: 'shiftConfigSlideIn 0.3s ease-out',
                      border: '1px solid #e2e8f0',
                      cursor: 'default'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{
                      padding: '20px 24px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left'
                    }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                          Attendance Configuration
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                          Configure attendance marking rules and thresholds
                        </p>
                      </div>
                      <button
                        onClick={() => setShowAttendanceConfigModal(false)}
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
                      overflowY: 'auto',
                      textAlign: 'left'
                    }}>
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
                            {/* Check-in Window Open Time */}
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                Check-in Window Open Time (Before shift start)
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <select
                                      value={Math.floor((attendanceConfig.checkinWindowBefore || 15) / 60)}
                                      onChange={(e) => {
                                        const hours = parseInt(e.target.value);
                                        const minutes = (attendanceConfig.checkinWindowBefore || 15) % 60;
                                        setAttendanceConfig({
                                          ...attendanceConfig,
                                          checkinWindowBefore: hours * 60 + minutes
                                        });
                                      }}
                                      style={{
                                        width: '70px',
                                        padding: '8px 6px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        textAlign: 'center'
                                      }}
                                    >
                                      {Array.from({ length: 25 }, (_, i) => (
                                        <option key={i} value={i}>{i}</option>
                                      ))}
                                    </select>
                                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Hours</span>
                                  </div>
                                  <span style={{ fontSize: '16px', color: '#64748b', fontWeight: '600' }}>:</span>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <select
                                      value={(attendanceConfig.checkinWindowBefore || 15) % 60}
                                      onChange={(e) => {
                                        const hours = Math.floor((attendanceConfig.checkinWindowBefore || 15) / 60);
                                        const minutes = parseInt(e.target.value);
                                        setAttendanceConfig({
                                          ...attendanceConfig,
                                          checkinWindowBefore: hours * 60 + minutes
                                        });
                                      }}
                                      style={{
                                        width: '70px',
                                        padding: '8px 6px',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        textAlign: 'center'
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
                                  Total: {attendanceConfig.checkinWindowBefore !== undefined ? attendanceConfig.checkinWindowBefore : 15} minutes
                                </div>
                              </div>
                              <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
                                Time allowed before shift start time when employees can start uploading selfie and checking in.
                              </p>
                            </div>

                            {/* Mark Present Till */}
                            <div style={{ paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                                Mark Present Till (After shift start)
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                        textAlign: 'center'
                                      }}
                                    >
                                      {Array.from({ length: 25 }, (_, i) => (
                                        <option key={i} value={i}>{i}</option>
                                      ))}
                                    </select>
                                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Hours</span>
                                  </div>
                                  <span style={{ fontSize: '16px', color: '#64748b', fontWeight: '600' }}>:</span>
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
                                        textAlign: 'center'
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
                                Employees checking in after this duration will be marked as late check-in.
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

                        <div style={{
                          padding: '14px',
                          background: '#f0f9ff',
                          borderRadius: '8px',
                          border: '1px solid #bae6fd',
                          textAlign: 'left'
                        }}>
                          <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '600', color: '#0369a1' }}>
                            How Attendance Marking Works
                          </h4>
                          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#0c4a6e', lineHeight: '1.5' }}>
                            <li><strong>Check-in Window Open:</strong> Opens {attendanceConfig.checkinWindowBefore || 15} minutes before shift start. Employees can check in anytime after this.</li>
                            <li><strong>Mark Present / Late:</strong> Checking in before the "Mark Present Till" time marks status as Present; checking in after marks status as Late Check-in.</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      padding: '16px 24px',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      gap: '12px',
                      justifyContent: 'flex-end',
                      background: '#fff',
                      borderBottomLeftRadius: '16px',
                      borderBottomRightRadius: '16px'
                    }}>
                      <button
                        type="button"
                        onClick={() => setShowAttendanceConfigModal(false)}
                        style={{
                          padding: '8px 16px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          background: '#fff',
                          color: '#374151',
                          fontSize: '13px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveAttendanceConfig}
                        style={{
                          padding: '8px 16px',
                          border: 'none',
                          borderRadius: '6px',
                          background: '#3b775e',
                          color: '#fff',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                        }}
                      >
                        Save Configuration
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {canCreateAttendance && (
              <button
                onClick={handleAddClick}
                style={{
                  padding: '10px 18px',
                  border: 'none',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                  boxShadow: '0 2px 8px rgba(59, 119, 94, 0.2)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 119, 94, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 119, 94, 0.2)';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <line x1="7" y1="1" x2="7" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <line x1="1" y1="7" x2="13" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add Record
              </button>
            )}
          </div>
        </div>

        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: '#f8fafc',
          paddingTop: '10px',
          paddingBottom: '10px',
          marginTop: '-10px',
        }}>
          {/* Search Bar - Only for Admin, HR, HR Manager, Manager, Director */}
          {(['Admin', 'HR', 'HR Manager', 'Manager', 'Director'].includes(user?.role?.name)) && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "14px 18px",
                marginBottom: "16px",
                boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by employee name, ID, or designation..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page on search
                  }}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '13px',
                    color: '#0f172a',
                    fontWeight: 500,
                    fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                    background: 'transparent',
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '4px 8px',
                      border: 'none',
                      background: '#f1f5f9',
                      borderRadius: '6px',
                      color: '#64748b',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              {searchQuery && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#64748b',
                  fontWeight: 500
                }}>
                  Found {filteredAttendance.length} record{filteredAttendance.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "18px",
              marginBottom: "20px",
              boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
            }}
          >
            <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
              <div style={{ marginBottom: 0, flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '11.5px',
                  color: '#64748b',
                  fontWeight: 600,
                  marginBottom: '6px'
                }}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    setStartDate(selectedDate);

                    // Update month and year dropdowns based on selected date
                    if (selectedDate) {
                      const date = new Date(selectedDate);
                      setSelectedMonth(date.getMonth() + 1);
                      setSelectedYear(date.getFullYear());
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#0f172a',
                    fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                  }}
                />
              </div>
              <div style={{ marginBottom: 0, flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '11.5px',
                  color: '#64748b',
                  fontWeight: 600,
                  marginBottom: '6px'
                }}>
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    const selectedDate = e.target.value;
                    setEndDate(selectedDate);

                    // Update month and year dropdowns based on selected date
                    if (selectedDate) {
                      const date = new Date(selectedDate);
                      setSelectedMonth(date.getMonth() + 1);
                      setSelectedYear(date.getFullYear());
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#0f172a',
                    fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                  }}
                />
              </div>
              {isAdmin && (
                <>
                  <div style={{ marginBottom: 0, flex: '1 1 120px', minWidth: '120px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '11.5px',
                      color: '#64748b',
                      fontWeight: 600,
                      marginBottom: '6px'
                    }}>
                      Month
                    </label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#0f172a',
                        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                      }}
                    >
                      {months.map(month => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginBottom: 0, flex: '1 1 100px', minWidth: '100px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '11.5px',
                      color: '#64748b',
                      fontWeight: 600,
                      marginBottom: '6px'
                    }}>
                      Year
                    </label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#0f172a',
                        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                      }}
                    >
                      {years.map(year => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <button
                onClick={handleFilter}
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                Filter
              </button>
              <button
                onClick={handleClear}
                className="attendance-clear-btn"
                style={{
                  position: 'relative',
                  isolation: 'isolate',
                  overflow: 'hidden',
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
                <span style={{ position: 'relative', zIndex: 1 }}>Clear</span>
              </button>
              <button
                onClick={handleExportExcel}
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  whiteSpace: 'nowrap',
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export Excel
              </button>

              {/* Manual missed-checkout trigger — Admin only */}
              {isStrictAdmin && (
                <button
                  onClick={handleRunCron}
                  disabled={cronRunning}
                  title="Mark all employees who forgot to checkout this month as Absent"
                  style={{
                    padding: '8px 14px',
                    border: 'none',
                    borderRadius: '10px',
                    background: cronRunning
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#fff',
                    cursor: cronRunning ? 'not-allowed' : 'pointer',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                    fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                    transition: 'opacity 0.2s',
                    opacity: cronRunning ? 0.7 : 1,
                  }}
                >
                  {cronRunning ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Running...
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      Mark Absent
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cron result toast — auto-dismisses after 5s */}
        {cronResult && (
          <div style={{
            margin: '-8px 0 16px 0',
            padding: '10px 16px',
            borderRadius: '10px',
            background: cronResult.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${cronResult.success ? '#bbf7d0' : '#fecaca'}`,
            color: cronResult.success ? '#166534' : '#991b1b',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
          }}>
            {cronResult.success ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {cronResult.message}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px', marginTop: '-8px' }}>
          <button
            onClick={() => setShowStatsCards(!showStatsCards)}
            title={showStatsCards ? "Hide Stats" : "Show Stats"}
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              color: '#475569',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#475569'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showStatsCards ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        <div style={{
          maxHeight: showStatsCards ? '500px' : '0',
          opacity: showStatsCards ? 1 : 0,
          overflow: 'hidden',
          transition: 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: showStatsCards ? 'auto' : 'none',
          marginBottom: showStatsCards ? '24px' : '0',
        }}>
          <div className="att-stats-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px'
          }}>
            {[
              {
                label: statsType === 'today' ? 'Present Today' : 'Present This Month',
                value: todayStats.presentToday,
                prev: prevMonthStats.present, color: '#10b981', spark: sparklineData.present,
                clickType: canClickStatCards ? 'present' : null
              },
              {
                label: statsType === 'today' ? 'Absent Today' : 'Absent This Month',
                value: todayStats.absentToday,
                prev: prevMonthStats.absent, color: '#ef4444', spark: sparklineData.absent,
                clickType: canClickStatCards ? 'absent' : null
              },
              { label: 'Total Records', value: attendance.length, prev: prevMonthStats.total, color: '#667eea', spark: sparklineData.total, clickType: null },
            ].map(({ label, value, prev, color, spark, clickType }) => {
              const trend = calcChange(value, prev);
              const up = isUp(value, prev);
              return (
                <div
                  key={label}
                  onClick={() => clickType && handleTodayCardClick(clickType)}
                  style={{ background: 'white', padding: '14px 16px 10px', borderRadius: '12px', border: '1px solid #e2e8f0', transition: 'all 0.3s', overflow: 'hidden', position: 'relative', cursor: clickType ? 'pointer' : 'default' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  {/* Label + trend badge */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
                    <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: up ? 'rgba(168,230,61,0.15)' : 'rgba(239,68,68,0.1)', color: up ? '#3d7c00' : '#dc2626', whiteSpace: 'nowrap' }}>
                      {up ? '▲' : '▼'} {trend}
                    </span>
                  </div>
                  {/* Value */}
                  <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px' }}>{value}</div>
                  {/* Bottom: vs last month + sparkline */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                      <svg className="att-arrow-jiggle" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a8e63d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                      </svg>
                      <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>vs last month</span>
                    </div>
                    <Sparkline data={spark} color={color} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today Employee List Modal — All Employees card style + table */}
        {showTodayModal && (() => {
          const isPresent = todayModalType === 'present';
          const filtered = todayEmployeeList.filter(emp => {
            const name = `${emp.firstName || ''} ${emp.lastName || ''} ${emp.employeeId || ''}`.toLowerCase();
            return name.includes(todayModalSearch.toLowerCase());
          });
          const thStyle = { padding: '8px 10px', fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', whiteSpace: 'nowrap', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 };
          const tdStyle = { padding: '9px 10px', fontSize: '12px', color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
          return (
            <div
              className="att-today-backdrop"
              style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
              onClick={e => { if (e.target === e.currentTarget) { setShowTodayModal(false); setTodayModalSearch(''); } }}
            >
              <div
                className="att-today-modal-card"
                style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '12px', width: '580px', maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
              >
                {/* Title row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', padding: '0 2px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                    {isPresent ? 'Present Today' : 'Absent Today'}
                  </div>
                  <button
                    onClick={() => { setShowTodayModal(false); setTodayModalSearch(''); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </div>
                {/* Search */}
                <input
                  autoFocus
                  placeholder="Search employees..."
                  value={todayModalSearch}
                  onChange={e => setTodayModalSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                />
                {/* Table */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filtered.length === 0 && !loadingTodayList ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>No employees found</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>Emp ID</th>
                          <th style={thStyle}>Name</th>
                          <th style={thStyle}>Designation</th>
                          <th style={thStyle}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((emp, i) => (
                          <tr
                            key={emp._id || i}
                            style={{ animation: `att-row-slide-in 0.28s cubic-bezier(0.22,1,0.36,1) both`, animationDelay: `${Math.min(i * 30, 350)}ms` }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ ...tdStyle, color: '#cbd5e1', width: '30px', fontSize: '11px' }}>{i + 1}</td>
                            <td style={{ ...tdStyle, fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>{emp.employeeId || '—'}</td>
                            <td style={{ ...tdStyle, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                              {emp.firstName} {emp.lastName}
                              {isPresent && emp.loginTime && (
                                <div style={{ fontSize: '10px', fontWeight: 400, color: '#10b981', marginTop: '1px' }}>
                                  ✓ {new Date(emp.loginTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </div>
                              )}
                            </td>
                            <td style={{ ...tdStyle, color: '#64748b' }}>{emp.designation || '—'}</td>
                            <td style={tdStyle}>
                              <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: isPresent ? '#f0fdf4' : '#fff1f2', color: isPresent ? '#15803d' : '#991b1b' }}>
                                {isPresent ? 'Present' : 'Absent'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {/* Footer */}
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {todayStats[isPresent ? 'presentToday' : 'absentToday']} {isPresent ? 'present' : 'absent'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                    {filtered.length !== todayEmployeeList.length ? `${filtered.length} of ` : ''}{todayEmployeeList.length} employees
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        <div
          style={{
            background: "#fff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fafafa",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
              Showing {attendance.length} {attendance.length === 1 ? 'record' : 'records'}
            </div>

            <div style={{ position: "relative", display: "inline-block" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLegendPopover(!showLegendPopover);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: showLegendPopover ? '#0284c7' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.2s',
                  outline: 'none',
                }}
                title="View logout status legends"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>

              {showLegendPopover && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 5px)",
                    right: "0px",
                    width: "280px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
                    padding: "14px",
                    zIndex: 50,
                    textAlign: "left",
                    textTransform: "none",
                    letterSpacing: "normal",
                    fontWeight: "normal",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "12px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    Logout Status Legend
                  </h4>

                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{
                        alignSelf: "flex-start",
                        padding: "2px 8px",
                        borderRadius: "20px",
                        fontSize: "9px",
                        fontWeight: 700,
                        background: "rgba(139,92,246,0.15)",
                        color: "#8b5cf6",
                        border: "none",
                      }}>
                        Self Checkout
                      </span>
                      <span style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
                        The employee has self checked out from his system/device.
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                      <span style={{
                        alignSelf: "flex-start",
                        padding: "2px 8px",
                        borderRadius: "20px",
                        fontSize: "9px",
                        fontWeight: 700,
                        background: "rgba(14, 165, 233, 0.15)",
                        color: "#0284c7",
                        border: "1px solid rgba(14, 165, 233, 0.3)",
                      }}>
                        Checkout
                      </span>
                      <span style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
                        This record entry is updated by the user (click to view who updated).
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                      <span style={{
                        alignSelf: "flex-start",
                        padding: "2px 8px",
                        borderRadius: "20px",
                        fontSize: "9px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: "#0f172a",
                        color: "#ffffff",
                        border: "1px solid rgba(0, 0, 0, 0.2)",
                      }}>
                        Updated
                      </span>
                      <span style={{ fontSize: "11px", color: "#64748b", lineHeight: "1.4" }}>
                        This attendance record's status was updated. Click on the badge to view the reason and details.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }} className="emp-modal-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: "#fafafa", boxShadow: '0 1px 0 #f1f5f9' }}>
                  {canReadAttendance && (
                    <th style={{
                      padding: "8px 10px",
                      whiteSpace: "nowrap",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: "1px solid #f1f5f9",
                    }}>
                      Employee
                    </th>
                  )}
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Date & Day
                  </th>
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Shift Time
                  </th>
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Login Time
                  </th>
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Logout Time
                  </th>
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Logout Status
                  </th>
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Working Hours
                  </th>
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Break Taken
                  </th>
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Location
                  </th>
                  <th style={{
                    padding: "8px 10px",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    borderBottom: "1px solid #f1f5f9",
                  }}>
                    Status
                  </th>
                  {canReadAttendance && (
                    <th style={{
                      padding: "8px 10px",
                      whiteSpace: "nowrap",
                      textAlign: "right",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#64748b",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      borderBottom: "1px solid #f1f5f9",
                    }}>
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {canReadAttendance && (
                        <td style={{ padding: "8px 10px" }}>
                          <div className="attendance-skeleton-avatar"></div>
                        </td>
                      )}
                      <td style={{ padding: "8px 10px" }}>
                        <div className="attendance-skeleton-cell" style={{ width: "80%" }}></div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div className="attendance-skeleton-cell" style={{ width: "70%" }}></div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div className="attendance-skeleton-cell" style={{ width: "60%" }}></div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div className="attendance-skeleton-cell" style={{ width: "60%" }}></div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div className="attendance-skeleton-cell" style={{ width: "60%" }}></div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div className="attendance-skeleton-cell" style={{ width: "50%" }}></div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div className="attendance-skeleton-cell" style={{ width: "70%" }}></div>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div className="attendance-skeleton-badge"></div>
                      </td>
                      {canReadAttendance && (
                        <td style={{ padding: "8px 10px", textAlign: "right" }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <div className="attendance-skeleton-button"></div>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  currentAttendance.map((record, index) => (
                    <tr
                      key={record._id}
                      style={{
                        borderBottom: index < currentAttendance.length - 1 ? "1px solid #f8fafc" : "none",
                      }}
                    >
                      {canReadAttendance && (
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{
                            fontSize: "12px",
                            fontWeight: 600,
                            color: "#0f172a",
                            marginBottom: "2px",
                          }}>
                            {record.employee?.firstName} {record.employee?.lastName}
                          </div>
                          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                            ({record.employee?.employeeId})
                          </div>
                        </td>
                      )}
                      <td style={{
                        padding: "8px 10px",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        color: "#475569",
                      }}>
                        {new Date(record.date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}, {new Date(record.date).toLocaleDateString('en-US', { weekday: 'long' })}
                      </td>
                      <td style={{
                        padding: "8px 10px",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        color: "#475569",
                      }}>
                        {(() => {
                          let start = record.shiftStartTime;
                          let end = record.shiftEndTime;

                          if (start === "09:00 AM" && end === "06:00 PM") {
                            start = null;
                            end = null;
                          }

                          if (!start || !end) {
                            start = record.employee?.shiftStartTime;
                            end = record.employee?.shiftEndTime;
                          }

                          if (!start || !end || (start === "09:00 AM" && end === "06:00 PM")) {
                            return <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>Not Assigned</span>;
                          }
                          return `${start} - ${end}`;
                        })()}
                      </td>
                      <td style={{
                        padding: "8px 10px",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        color: "#475569",
                      }}>
                        {fetchingSelfie ? (
                          <span style={{ color: '#94a3b8' }}>{formatTime(record.loginTime)}</span>
                        ) : (
                          <HoverSelfie
                            record={record}
                            type="login"
                            fetchEmployeeSelfie={fetchEmployeeSelfie}
                            formatTime={formatTime}
                          />
                        )}
                      </td>
                      <td style={{
                        padding: "8px 10px",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        color: "#475569",
                        fontWeight: 400,
                      }}>
                        {record.logoutMethod === 'not-checkout' ? 'N/A' : (
                          fetchingSelfie ? (
                            <span style={{ color: '#94a3b8' }}>{formatTime(record.logoutTime)}</span>
                          ) : (
                            <HoverSelfie
                              record={record}
                              type="logout"
                              fetchEmployeeSelfie={fetchEmployeeSelfie}
                              formatTime={formatTime}
                            />
                          )
                        )}
                      </td>
                      <td style={{ padding: "11px 14px", textAlign: "center" }}>
                        <span
                          className={record.logoutMethod === 'updated' || record.editReason ? 'att-updated-badge' : ''}
                          onClick={async () => {
                            if (record.logoutMethod === 'updated' || record.editReason) {
                              // Fetch history for timeline view
                              const history = await fetchAttendanceHistory(record._id);
                              setAttendanceHistory(history);
                              setShowHistoryModal(true);
                            }
                          }}
                          title={record.logoutMethod === 'updated' || record.editReason ? 'Click to view edit history' : ''}
                          style={{
                            padding: "3px 9px",
                            borderRadius: "20px",
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "capitalize",
                            background:
                              record.logoutMethod === 'updated' || record.editReason ? "rgba(14, 165, 233, 0.15)" :
                                record.logoutMethod === 'not-checkout' ? "rgba(239,68,68,0.12)" :
                                  !record.logoutTime ? "rgba(148,163,184,0.15)" :
                                    record.logoutMethod === 'auto' ? "rgba(245,158,11,0.15)" :
                                      "rgba(139,92,246,0.15)",
                            color:
                              record.logoutMethod === 'updated' || record.editReason ? "#0284c7" :
                                record.logoutMethod === 'not-checkout' ? "#dc2626" :
                                  !record.logoutTime ? "#94a3b8" :
                                    record.logoutMethod === 'auto' ? "#f59e0b" :
                                      "#8b5cf6",
                            cursor: record.logoutMethod === 'updated' || record.editReason ? "pointer" : "default",
                            border: record.logoutMethod === 'updated' || record.editReason ? "1px solid rgba(14, 165, 233, 0.3)" : "none",
                            display: "inline-block",
                          }}
                        >
                          {record.logoutMethod === 'updated'
                            ? 'Checkout'
                            : record.logoutMethod === 'not-checkout'
                              ? 'Not Checkout'
                              : !record.logoutTime
                                ? 'N/A'
                                : record.logoutMethod === 'self-logout'
                                  ? 'Self Checkout'
                                  : record.logoutMethod || 'Self Checkout'}
                        </span>
                      </td>
                      <td style={{
                        padding: "8px 10px",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        color: "#475569",
                        fontWeight: 600,
                      }}>
                        {formatWorkingDuration(record.workingHours, record.logoutMethod)}
                      </td>
                      <td style={{
                        padding: "8px 10px",
                        whiteSpace: "nowrap",
                        fontSize: "12px",
                        color: "#475569",
                        fontWeight: 600,
                      }}>
                        {(() => {
                          const totalSecs = calculateBadgeBreakDuration(record.breaks);
                          const hasBreaks = record.breaks && record.breaks.length > 0;
                          return (
                            <span
                              onClick={() => {
                                if (hasBreaks) {
                                  setBreakModalRecord(record);
                                  setShowBreakModal(true);
                                }
                              }}
                              title={hasBreaks ? "Click to view break details" : "No breaks taken"}
                              style={{
                                padding: "4px 8px",
                                borderRadius: "12px",
                                fontSize: "11px",
                                fontWeight: 700,
                                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                fontVariantNumeric: "tabular-nums",
                                cursor: hasBreaks ? "pointer" : "default",
                                background: hasBreaks ? "rgba(139, 92, 246, 0.12)" : "rgba(148, 163, 184, 0.1)",
                                color: hasBreaks ? "#7c3aed" : "#94a3b8",
                                border: hasBreaks ? "1px solid rgba(139, 92, 246, 0.2)" : "none",
                                transition: "all 0.2s ease",
                                display: "inline-block"
                              }}
                              onMouseEnter={(e) => {
                                if (hasBreaks) {
                                  e.currentTarget.style.transform = "scale(1.05)";
                                  e.currentTarget.style.boxShadow = "0 2px 4px rgba(139, 92, 246, 0.15)";
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (hasBreaks) {
                                  e.currentTarget.style.transform = "scale(1)";
                                  e.currentTarget.style.boxShadow = "none";
                                }
                              }}
                            >
                              {hasBreaks ? formatDurationHMS(totalSecs) : 'not taken'}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{
                        padding: "11px 14px",
                        fontSize: "12px",
                        color: getLocationLabel(record.location) === 'Office' ? "#10b981" : "#64748b",
                        fontWeight: getLocationLabel(record.location) === 'Office' ? 600 : 500,
                      }}>
                        {getLocationLabel(record.location)}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <span
                          onClick={async () => {
                            if (record.lateReason) {
                              setReasonModalText(`Reason for Late Check-in:\n\n${record.lateReason}`);
                              setShowReasonModal(true);
                            } else if (record.editReason) {
                              // Check if this was actually a status change or just a comment/reason update
                              const isActualStatusChange = record.oldStatus && record.oldStatus !== record.status;

                              setEditReasonDetails({
                                reason: record.editReason,
                                oldStatus: record.oldStatus, // Always pass oldStatus if available
                                newStatus: record.status, // Always pass current status
                                updatedBy: record.updatedBy ? `${record.updatedBy.firstName} ${record.updatedBy.lastName}` : 'Admin',
                                updatedAt: record.updatedAt ? new Date(record.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown Date',
                                isAdded: record.createdAt && record.updatedAt && (new Date(record.updatedAt).getTime() - new Date(record.createdAt).getTime() < 1000),
                                isCommentOnly: false // Always show as status update to display old -> new
                              });
                              setShowReasonCard(false);
                              setShowEditReasonModal(true);
                            }
                          }}
                          onMouseEnter={(e) => {
                            if (record.lateReason) {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setHoveredLateReason({
                                text: record.lateReason,
                                x: rect.left + rect.width / 2,
                                y: rect.top
                              });
                            }
                          }}
                          onMouseLeave={() => setHoveredLateReason(null)}
                          style={{
                            padding: "4px 10px",
                            borderRadius: "20px",
                            fontSize: "10px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            cursor: (record.lateReason || record.editReason) ? "pointer" : "default",
                            border: record.editReason ? "1px solid rgba(0, 0, 0, 0.2)" : "none",
                            background:
                              record.editReason ? "#0f172a" :
                                (record.breaks && record.breaks.some(b => !b.endTime)) ? "rgba(234,179,8,0.15)" :
                                  record.status === 'present' ? "rgba(16,185,129,0.15)" :
                                    record.status === 'absent' ? "rgba(239,68,68,0.15)" :
                                      record.status === 'half-day' ? "rgba(245,158,11,0.15)" :
                                        record.status === 'checked-in' ? "rgba(59,130,246,0.15)" :
                                          record.status === 'late-checkin' ? "rgba(245,158,11,0.15)" :
                                            record.status === 'early-checkin' ? "rgba(14,165,233,0.15)" :
                                              record.status === 'not-checkout' ? "rgba(239,68,68,0.12)" :
                                                "rgba(148,163,184,0.15)",
                            color:
                              record.editReason ? "#ffffff" :
                                (record.breaks && record.breaks.some(b => !b.endTime)) ? "#ca8a04" :
                                  record.status === 'present' ? "#10b981" :
                                    record.status === 'absent' ? "#ef4444" :
                                      record.status === 'half-day' ? "#f59e0b" :
                                        record.status === 'checked-in' ? "#3b82f6" :
                                          record.status === 'late-checkin' ? "#f59e0b" :
                                            record.status === 'early-checkin' ? "#0ea5e9" :
                                              record.status === 'not-checkout' ? "#ef4444" :
                                                "#64748b",
                          }}
                        >
                          {(record.breaks && record.breaks.some(b => !b.endTime)) ? 'ON BREAK' :
                            record.status === 'present' ? 'PRESENT' :
                              record.status === 'absent' ? 'ABSENT' :
                                record.status === 'half-day' ? 'HALF DAY' :
                                  record.status === 'checked-in' ? 'CHECKED IN' :
                                    record.status === 'late-checkin' ? 'LATE CHECK-IN' :
                                      record.status === 'early-checkin' ? 'EARLY CHECK-IN' :
                                        record.status === 'not-checkout' ? 'NOT CHECKOUT' :
                                          record.status ? record.status :
                                            'CHECK-IN'}
                        </span>
                      </td>
                      {canReadAttendance && (
                        <td style={{ padding: "11px 14px", textAlign: "right" }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {canUpdateAttendance && (
                              <button
                                onClick={() => handleEditClick(record)}
                                title="Edit Record"
                                style={{
                                  padding: '6px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: '#fff',
                                  color: '#3b775e',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f0fdf4';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#fff';
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </button>
                            )}
                            {canDeleteAttendance && (
                              <button
                                onClick={() => handleDeleteRecord(record)}
                                title="Delete Record"
                                style={{
                                  padding: '6px',
                                  border: 'none',
                                  borderRadius: '6px',
                                  background: '#fff',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#fef2f2';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = '#fff';
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path>
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleViewDetails(record.employee?._id)}
                              title="View Details"
                              style={{
                                padding: '6px',
                                border: 'none',
                                borderRadius: '6px',
                                background: '#fff',
                                color: '#3b82f6',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#eff6ff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = '#fff';
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && attendance.length === 0 && (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div style={{
                fontSize: "14px",
                color: "#94a3b8",
                fontWeight: 500,
              }}>
                No attendance records found
              </div>
            </div>
          )}

          {!loading && attendance.length > 0 && totalPages > 1 && (
            <div
              style={{
                padding: "16px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: currentPage === 1 ? "#f8fafc" : "#fff",
                  color: currentPage === 1 ? "#cbd5e1" : "#475569",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>

              {(() => {
                const pageNumbers = [];
                let startPage = 1;
                let endPage = totalPages;

                if (totalPages > 5) {
                  if (currentPage <= 3) {
                    endPage = 5;
                  } else if (currentPage >= totalPages - 2) {
                    startPage = totalPages - 4;
                  } else {
                    startPage = currentPage - 2;
                    endPage = currentPage + 2;
                  }
                }

                for (let i = startPage; i <= endPage; i++) {
                  pageNumbers.push(
                    <button
                      key={i}
                      onClick={() => handlePageChange(i)}
                      style={{
                        padding: "6px 12px",
                        border: "1px solid",
                        borderColor: currentPage === i ? "#3b775e" : "#e2e8f0",
                        borderRadius: "8px",
                        background: currentPage === i ? "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)" : "#fff",
                        color: currentPage === i ? "#fff" : "#475569",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: currentPage === i ? 700 : 600,
                        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                      }}
                    >
                      {i}
                    </button>
                  );
                }
                return pageNumbers;
              })()}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  padding: "6px 10px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: currentPage === totalPages ? "#f8fafc" : "#fff",
                  color: currentPage === totalPages ? "#cbd5e1" : "#475569",
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: 'center',
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Detailed Attendance Modal */}
        {showDetailedModal && detailedData && (
          <div
            className="modal-overlay"
            onClick={() => setShowDetailedModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
            }}
          >
            <div
              style={{
                maxWidth: '95%',
                width: '1200px',
                background: 'white',
                borderRadius: '16px',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
              }}>
                <div>
                  <h2 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#fff',
                  }}>
                    {detailedData.employee.name} - Attendance Details
                  </h2>
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.9)',
                  }}>
                    Employee ID: {detailedData.employee.employeeId} • {detailedData.employee.designation || 'N/A'}
                  </p>
                  {detailedData.shiftInfo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: 'rgba(255,255,255,0.25)',
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {(() => {
                          let start = detailedData.shiftInfo.startTime;
                          let end = detailedData.shiftInfo.endTime;
                          let name = detailedData.shiftInfo.name;

                          if (start === "09:00 AM" && end === "06:00 PM") {
                            start = detailedData.employee?.shiftStartTime;
                            end = detailedData.employee?.shiftEndTime;
                            name = "Shift";
                          }

                          if (!start || !end || (start === "09:00 AM" && end === "06:00 PM")) {
                            return 'Shift Not Assigned';
                          }

                          return `${name} (${start} – ${end})`;
                        })()}
                      </span>
                      <span style={{
                        background: 'rgba(255,255,255,0.18)',
                        color: '#fff',
                        padding: '3px 10px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        {detailedData.shiftInfo.weekoff === 1 ? '1 Weekoff (Sun)' : detailedData.shiftInfo.weekoff === 2 ? '2 Weekoffs (Sat–Sun)' : '3 Weekoffs (Fri–Sun)'}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setShowDetailedModal(false)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#fff',
                    lineHeight: 1,
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                >
                  ×
                </button>
              </div>

              {/* Month/Year Selector */}
              <div style={{
                padding: '16px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
              }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                  Select Month:
                </label>
                <select
                  value={detailMonth}
                  onChange={(e) => handleDetailMonthChange(parseInt(e.target.value), detailYear)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#0f172a',
                    background: '#fff',
                    cursor: 'pointer',
                    outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <select
                  value={detailYear}
                  onChange={(e) => handleDetailMonthChange(detailMonth, parseInt(e.target.value))}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#0f172a',
                    background: '#fff',
                    cursor: 'pointer',
                    outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>

                {/* Summary Stats */}
                <div style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  gap: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b' }}>Present:</span>
                    <span style={{
                      padding: '4px 10px',
                      background: '#dcfce7',
                      color: '#15803d',
                      borderRadius: '6px',
                    }}>
                      {detailedData.summary?.presentDays || 0}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b' }}>Absent:</span>
                    <span style={{
                      padding: '4px 10px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      borderRadius: '6px',
                    }}>
                      {detailedData.summary?.absentDays || 0}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b' }}>Half Day:</span>
                    <span style={{
                      padding: '4px 10px',
                      background: '#fef3c7',
                      color: '#d97706',
                      borderRadius: '6px',
                    }}>
                      {detailedData.summary?.halfDays || 0}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#64748b' }}>Leave:</span>
                    <span style={{
                      padding: '4px 10px',
                      background: '#e0e7ff',
                      color: '#3730a3',
                      borderRadius: '6px',
                    }}>
                      {detailedData.summary?.leaveDays || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                {loadingDetails ? (
                  <div style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{
                      display: 'inline-block',
                      width: '40px',
                      height: '40px',
                      border: '4px solid #f3f4f6',
                      borderTopColor: '#3b775e',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }} />
                    <p style={{
                      fontSize: '14px',
                      color: '#94a3b8',
                      fontWeight: 500,
                      marginTop: '16px',
                    }}>
                      Loading attendance details...
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'separate',
                      borderSpacing: 0,
                      fontSize: '13px',
                    }}>
                      <thead>
                        <tr>
                          <th style={{
                            padding: '14px 16px',
                            background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            textAlign: 'left',
                            fontSize: '12px',
                            borderTopLeftRadius: '10px',
                          }}>
                            Date & Day
                          </th>
                          <th style={{
                            padding: '14px 16px',
                            background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            textAlign: 'center',
                            fontSize: '12px',
                          }}>
                            Check-in Time
                          </th>
                          <th style={{
                            padding: '14px 16px',
                            background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            textAlign: 'center',
                            fontSize: '12px',
                          }}>
                            Checkout Time
                          </th>
                          <th style={{
                            padding: '14px 16px',
                            background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            textAlign: 'center',
                            fontSize: '12px',
                          }}>
                            Working Hours
                          </th>
                          <th style={{
                            padding: '14px 16px',
                            background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            textAlign: 'center',
                            fontSize: '12px',
                            borderTopRightRadius: '10px',
                          }}>
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailedData.dailyBreakdown && detailedData.dailyBreakdown.length > 0 ? (
                          detailedData.dailyBreakdown.map((day, index) => (
                            <tr
                              key={day.day}
                              style={{
                                background: index % 2 === 0 ? '#fff' : '#f8fafc',
                                transition: 'all 0.2s',
                                position: 'relative'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#f0fdf4';
                                const tooltip = e.currentTarget.querySelector('.edit-reason-tooltip');
                                if (tooltip) {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  tooltip.style.position = 'fixed';
                                  tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                  tooltip.style.top = `${rect.top - 8}px`;
                                  tooltip.style.opacity = 1;
                                  tooltip.style.visibility = 'visible';
                                  tooltip.style.transform = 'translate(-50%, -100%) scale(1)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = index % 2 === 0 ? '#fff' : '#f8fafc';
                                const tooltip = e.currentTarget.querySelector('.edit-reason-tooltip');
                                if (tooltip) {
                                  tooltip.style.opacity = 0;
                                  tooltip.style.visibility = 'hidden';
                                  tooltip.style.transform = 'translate(-50%, -100%) scale(0.95)';
                                }
                              }}
                            >
                              <td style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid #e2e8f0',
                                fontWeight: 600,
                                color: '#0f172a',
                              }}>
                                <div>
                                  <span>
                                    {day.day} {months.find(m => m.value === detailMonth)?.label} {detailYear}, {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(detailYear, detailMonth - 1, day.day).getDay()]}
                                  </span>
                                </div>
                                {day.editReason && (
                                  <div className="edit-reason-tooltip" style={{
                                    position: 'fixed',
                                    backgroundColor: '#1e293b',
                                    color: '#f8fafc',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    whiteSpace: 'pre-line',
                                    width: 'max-content',
                                    maxWidth: '320px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                    zIndex: 9999,
                                    opacity: 0,
                                    visibility: 'hidden',
                                    transform: 'translate(-50%, -100%) scale(0.95)',
                                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                    pointerEvents: 'none',
                                    fontWeight: 'normal',
                                    textAlign: 'left'
                                  }}>
                                    <div style={{ fontWeight: 700, marginBottom: '8px', color: '#38bdf8', fontSize: '13px' }}>Update Details</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: '6px' }}>
                                      <span style={{ color: '#94a3b8' }}>Updated By:</span>
                                      <span>{day.updatedBy ? `${day.updatedBy.firstName} ${day.updatedBy.lastName}` : 'Admin'}</span>
                                      <span style={{ color: '#94a3b8' }}>Date:</span>
                                      <span>{day.updatedAt ? new Date(day.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown Date'}</span>
                                      <span style={{ color: '#94a3b8' }}>Reason:</span>
                                      <span style={{ fontStyle: 'italic', wordBreak: 'break-word', whiteSpace: 'normal' }}>{day.editReason}</span>
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid #e2e8f0',
                                textAlign: 'center',
                                color: day.loginTime ? '#0f172a' : '#94a3b8',
                              }}>
                                {day.loginTime
                                  ? new Date(day.loginTime).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                  })
                                  : '—'}
                              </td>
                              <td style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid #e2e8f0',
                                textAlign: 'center',
                              }}>
                                {day.logoutMethod === 'not-checkout' ? (
                                  <span style={{
                                    color: '#f59e0b',
                                    fontWeight: 600,
                                    fontSize: '12px',
                                  }}>
                                    Not Checkout
                                  </span>
                                ) : day.logoutTime ? (
                                  <span style={{ color: '#0f172a' }}>
                                    {new Date(day.logoutTime).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      hour12: true
                                    })}
                                  </span>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>—</span>
                                )}
                              </td>
                              <td style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid #e2e8f0',
                                textAlign: 'center',
                                fontWeight: 600,
                                color: day.workingHours > 0 ? '#0f172a' : '#94a3b8',
                              }}>
                                {day.workingHours > 0 ? formatWorkingDuration(day.workingHours, day.logoutMethod) : '—'}
                              </td>
                              <td style={{
                                padding: '14px 16px',
                                borderBottom: '1px solid #e2e8f0',
                                textAlign: 'center',
                              }}>
                                <span style={(day.status === 'Week Off' || day.isWeekOff) && canUpdateAttendance ? { display: 'inline-flex', justifyContent: 'center', alignItems: 'center' } : {
                                  display: 'inline-flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  lineHeight: 1.3,
                                  background:
                                    day.status === 'Present' ? '#dcfce7' :
                                      day.status === 'Absent' ? '#fee2e2' :
                                        day.status === 'Half-day' ? '#fef3c7' :
                                          day.status === 'Leave' ? '#e0e7ff' :
                                            day.status === 'Holiday' ? '#fdf2f8' :
                                              day.status === 'Week Off' ? '#f3f4f6' : '#f1f5f9',
                                  color:
                                    day.status === 'Present' ? '#15803d' :
                                      day.status === 'Absent' ? '#dc2626' :
                                        day.status === 'Half-day' ? '#d97706' :
                                          day.status === 'Leave' ? '#3730a3' :
                                            day.status === 'Holiday' ? '#be185d' :
                                              day.status === 'Week Off' ? '#6b7280' : '#64748b',
                                }}>
                                  <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: day.isHistoricalShift ? 'pointer' : 'default', position: 'relative' }}
                                    onMouseEnter={(e) => {
                                      if (day.isHistoricalShift) {
                                        const tooltip = e.currentTarget.querySelector('.custom-shift-tooltip');
                                        if (tooltip) {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          tooltip.style.position = 'fixed';
                                          tooltip.style.left = `${rect.left + rect.width / 2}px`;
                                          tooltip.style.top = `${rect.top - 8}px`;

                                          tooltip.style.opacity = 1;
                                          tooltip.style.visibility = 'visible';
                                          tooltip.style.transform = 'translate(-50%, -100%) scale(1)';
                                        }
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (day.isHistoricalShift) {
                                        const tooltip = e.currentTarget.querySelector('.custom-shift-tooltip');
                                        if (tooltip) {
                                          tooltip.style.opacity = 0;
                                          tooltip.style.visibility = 'hidden';
                                          tooltip.style.transform = 'translate(-50%, -100%) scale(0.95)';
                                        }
                                      }
                                    }}
                                  >
                                    {(day.status === 'Week Off' || day.isWeekOff) && canUpdateAttendance ? (
                                      <WeekOffDropdown
                                        currentStatus={day.status}
                                        onChange={(status) => handleWeekOffStatusChange(day.day, status)}
                                      />
                                    ) : (
                                      <span>{day.status || 'N/A'}</span>
                                    )}
                                    {day.isHistoricalShift && (
                                      <>
                                        <svg
                                          xmlns="http://www.w3.org/2000/svg"
                                          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                          style={{ opacity: 0.85 }}
                                        >
                                          <circle cx="12" cy="12" r="10"></circle>
                                          <polyline points="12 6 12 12 8 14"></polyline>
                                        </svg>
                                        <div className="custom-shift-tooltip" style={{
                                          position: 'fixed',
                                          backgroundColor: '#1e293b',
                                          color: '#f8fafc',
                                          padding: '10px 14px',
                                          borderRadius: '8px',
                                          fontSize: '12px',
                                          whiteSpace: 'pre-line',
                                          width: 'max-content',
                                          maxWidth: '280px',
                                          textAlign: 'center',
                                          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
                                          zIndex: 9999,
                                          opacity: 0,
                                          visibility: 'hidden',
                                          transform: 'translate(-50%, -100%) scale(0.95)',
                                          transformOrigin: 'bottom center',
                                          transition: 'opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                                          pointerEvents: 'none',
                                          border: '1px solid #334155',
                                          lineHeight: '1.4'
                                        }}>
                                          {day.historicalShiftInfo || "Calculated from previous shift schedule"}
                                          <div style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            borderWidth: '6px',
                                            borderStyle: 'solid',
                                            borderColor: '#1e293b transparent transparent transparent'
                                          }} />
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {day.status === 'Leave' && day.leaveType && (
                                    <span style={{ fontSize: '9px', fontWeight: 400, marginTop: '1px', opacity: 0.85 }}>
                                      {day.leaveType}
                                    </span>
                                  )}
                                  {day.hasLeaveOverride && day.status !== 'Leave' && (
                                    <span style={{ fontSize: '9px', fontWeight: 400, marginTop: '1px', color: '#6366f1', opacity: 0.85 }}>
                                      (Leave overridden)
                                    </span>
                                  )}
                                  {day.holidayName && (
                                    <span style={{ fontSize: '9px', fontWeight: 400, marginTop: '1px', opacity: 0.85, maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={day.holidayName}>
                                      {day.holidayName}
                                    </span>
                                  )}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan="5"
                              style={{
                                padding: '40px',
                                textAlign: 'center',
                                color: '#94a3b8',
                                fontSize: '14px',
                              }}
                            >
                              No attendance records found for this month
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                gap: '12px',
              }}>
                <button
                  onClick={handleExportEmployeeAttendance}
                  disabled={loadingDetails || !detailedData?.dailyBreakdown?.length}
                  className="attendance-clear-btn"
                  style={{
                    position: 'relative',
                    isolation: 'isolate',
                    overflow: 'hidden',
                    padding: '10px 20px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    background: loadingDetails || !detailedData?.dailyBreakdown?.length ? '#f8fafc' : '#fff',
                    color: loadingDetails || !detailedData?.dailyBreakdown?.length ? '#cbd5e1' : '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: loadingDetails || !detailedData?.dailyBreakdown?.length ? 'not-allowed' : 'pointer',
                    fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: loadingDetails || !detailedData?.dailyBreakdown?.length ? 0.6 : 1,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span style={{ position: 'relative', zIndex: 1 }}>Export to Excel</span>
                </button>

                <button
                  onClick={() => setShowDetailedModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 119, 94, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Break Details Modal */}
        {showBreakModal && breakModalRecord && (
          <div
            onClick={() => setShowBreakModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 1000,
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 720,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 40px rgba(15,23,42,0.18)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh'
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
              }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Break Breakdown Details</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    {breakModalRecord.employee?.firstName} {breakModalRecord.employee?.lastName} • {new Date(breakModalRecord.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <button
                  onClick={() => setShowBreakModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 22,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    lineHeight: 1,
                    padding: 4
                  }}
                >×</button>
              </div>

              {/* Modal Content */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Break Type</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Start Time</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>End Time</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Duration</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakModalRecord.breaks.map((b, idx) => {
                      const typeColors = {
                        'Lunch Break': { bg: 'rgba(59, 130, 246, 0.1)', color: '#2563eb' },
                        '1st Refreshment Break': { bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706' },
                        '2nd Refreshment Break': { bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706' },
                        'Refreshment Break': { bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706' },
                        'Tea Break': { bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706' },
                        'Briefing/Meeting': { bg: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5' },
                        'Other': { bg: 'rgba(107, 114, 128, 0.1)', color: '#4b5563' }
                      };
                      const displayType = b.breakType === 'Tea Break' ? 'Refreshment Break' : b.breakType;
                      const color = typeColors[displayType] || typeColors[b.breakType] || typeColors['Other'];
                      
                      const startMs = new Date(b.startTime).getTime();
                      const endMs = b.endTime ? new Date(b.endTime).getTime() : Date.now();
                      const durSecs = Math.max(0, Math.floor((endMs - startMs) / 1000));

                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 12px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '10px',
                              fontSize: '10px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              background: color.bg,
                              color: color.color,
                              whiteSpace: 'nowrap',
                              display: 'inline-block'
                            }}>
                              {displayType}
                            </span>
                          </td>
                          <td style={{ padding: '12px 12px', color: '#334155', fontFamily: "'Inter', -apple-system, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                            {formatTime(b.startTime)}
                          </td>
                          <td style={{ padding: '12px 12px', color: '#334155', fontFamily: "'Inter', -apple-system, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                            {b.endTime ? formatTime(b.endTime) : (
                              <span style={{ color: '#10b981', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Active</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 12px', textAlign: 'right', fontWeight: 700, color: '#1e293b', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                            {formatDurationHMS(durSecs)}
                          </td>
                          <td style={{ padding: '12px 12px', color: '#64748b', fontStyle: b.reason ? 'normal' : 'italic' }}>
                            {b.reason ? (
                              <span
                                onClick={() => {
                                  setReasonModalText(b.reason);
                                  setShowReasonModal(true);
                                }}
                                title="Click to view full reason"
                                style={{
                                  cursor: 'pointer',
                                  borderBottom: '1px dashed #94a3b8',
                                  display: 'inline-block'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = '#4f46e5'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; }}
                              >
                                {b.reason.length > 25 ? `${b.reason.slice(0, 25)}...` : b.reason}
                              </span>
                            ) : (
                              'None provided'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569', fontFamily: 'Inter, -apple-system, sans-serif' }}>
                  Total Break Time: <span style={{ color: '#0f172a', fontWeight: 800, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                    {(() => {
                      const totalModalBreakSecs = breakModalRecord?.breaks?.reduce((sum, b) => {
                        const startMs = new Date(b.startTime).getTime();
                        const endMs = b.endTime ? new Date(b.endTime).getTime() : Date.now();
                        return sum + Math.max(0, Math.floor((endMs - startMs) / 1000));
                      }, 0) || 0;
                      return formatDurationHMS(totalModalBreakSecs);
                    })()}
                  </span>
                </div>
                <button
                  onClick={() => setShowBreakModal(false)}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    background: '#fff',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fff';
                  }}
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Reason Details modal */}
        {showEditReasonModal && editReasonDetails && (
          <div
            onClick={() => setShowEditReasonModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 1100,
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
              backdropFilter: 'blur(3px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 400,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{
                padding: '12px 18px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc'
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Update Details</span>
                <button
                  onClick={() => setShowEditReasonModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 22,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                >
                  &times;
                </button>
              </div>
              <div style={{
                position: 'relative',
                perspective: '1000px',
                width: '100%',
              }}>
                <div style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gridTemplateRows: '1fr',
                  transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  transformStyle: 'preserve-3d',
                  transform: showReasonCard ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}>
                  {/* Front: existing content */}
                  <div style={{
                    gridArea: '1 / 1',
                    backfaceVisibility: 'hidden',
                    padding: '24px 20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>
                      <div style={{ marginBottom: '4px' }}>
                        {`Attendance record was ${editReasonDetails.isAdded ? 'added' : 'updated'} by`} <span style={{ fontWeight: 700, color: '#1e293b' }}>{editReasonDetails.updatedBy}</span>
                      </div>
                      <div>
                        on <span style={{ fontWeight: 600, color: '#1e293b' }}>{editReasonDetails.updatedAt}</span>
                      </div>
                    </div>

                    {/* Show status badge for all updates */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'transparent',
                      padding: '6px 12px',
                      borderRadius: '12px',
                      border: 'none',
                      marginBottom: '8px'
                    }}>
                      {/* Always show old -> new transition for any update */}
                      {editReasonDetails.oldStatus ? (
                        // Show transition when oldStatus exists
                        <>
                          <span style={{
                            background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', color: '#475569', padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px'
                          }}>
                            {editReasonDetails.oldStatus}
                          </span>
                          <span style={{ margin: '0 12px', color: '#94a3b8', fontSize: '12px' }}>➔</span>
                          <span style={{
                            background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', color: '#2563eb', padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px'
                          }}>
                            {editReasonDetails.newStatus}
                          </span>
                        </>
                      ) : (
                        // Just show current status if no oldStatus available
                        <span style={{
                          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', color: '#2563eb', padding: '4px 10px', borderRadius: '8px', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>
                          {editReasonDetails.newStatus || 'Unknown'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Back: Reason content */}
                  <div style={{
                    gridArea: '1 / 1',
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    padding: '24px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f8fafc',
                  }}>
                    <div style={{ fontStyle: 'italic', color: '#334155', fontSize: '13px', lineHeight: 1.6, textAlign: 'center' }}>
                      "{editReasonDetails.reason}"
                    </div>
                  </div>
                </div>
              </div>

              <div style={{
                padding: '12px 18px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '8px',
                background: '#f8fafc'
              }}>
                <button
                  onClick={() => setShowReasonCard(!showReasonCard)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid transparent',
                    borderRadius: 6,
                    background: showReasonCard ? '#f1f5f9' : '#10b981',
                    color: showReasonCard ? '#475569' : '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { if (!showReasonCard) e.currentTarget.style.background = '#059669'; }}
                  onMouseLeave={(e) => { if (!showReasonCard) e.currentTarget.style.background = '#10b981'; }}
                >
                  {showReasonCard ? 'Hide Reason' : 'View Reason'}
                </button>
                <button
                  onClick={() => setShowEditReasonModal(false)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 6,
                    background: '#fff',
                    color: '#475569',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timeline History Modal */}
        {showHistoryModal && (
          <div
            onClick={() => setShowHistoryModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 1100,
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
              backdropFilter: 'blur(3px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 600,
                maxHeight: '80vh',
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{
                padding: '24px 28px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#fff'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Attendance History</h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b', fontWeight: 400 }}>Complete edit history for this record</p>
                </div>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 22,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    lineHeight: 1,
                    padding: '4px'
                  }}
                >
                  &times;
                </button>
              </div>

              <div style={{
                padding: '24px 28px',
                maxHeight: '500px',
                overflowY: 'auto',
                flex: 1
              }}>
                {attendanceHistory.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
                    {attendanceHistory.map((entry, index) => (
                      <div key={index} style={{
                        position: 'relative',
                        paddingLeft: '36px',
                        paddingBottom: index < attendanceHistory.length - 1 ? '28px' : '0px'
                      }}>
                        {/* Timeline line */}
                        {index < attendanceHistory.length - 1 && (
                          <div style={{
                            position: 'absolute',
                            left: '11px',
                            top: '28px',
                            bottom: '-8px',
                            width: '2px',
                            background: '#e2e8f0'
                          }} />
                        )}

                        {/* Timeline dot */}
                        <div style={{
                          position: 'absolute',
                          left: '0px',
                          top: '6px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: entry.changeType === 'created' ? '#10b981' :
                            entry.changeType === 'status' ? '#3b82f6' :
                              entry.changeType === 'comment' ? '#f59e0b' :
                                entry.changeType === 'time' && entry.oldStatus === null && entry.newStatus === null ? '#f59e0b' :
                                  entry.changeType === 'time' ? '#8b5cf6' : '#6b7280',
                          border: '3px solid #fff',
                          boxShadow: '0 0 0 2px #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <div style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#fff'
                          }} />
                        </div>

                        {/* Content */}
                        <div style={{
                          paddingTop: '2px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            marginBottom: '8px'
                          }}>
                            <div>
                              <h4 style={{
                                margin: 0,
                                fontSize: '14px',
                                fontWeight: 600,
                                color: '#1e293b',
                                marginBottom: '4px'
                              }}>
                                {entry.changeType === 'created' ? 'Record Created' :
                                  entry.changeType === 'status' ? 'Status Changed' :
                                    entry.changeType === 'comment' ? 'Comment Added' :
                                      entry.changeType === 'time' && entry.oldStatus === null && entry.newStatus === null ? 'Comment Added' :
                                        entry.changeType === 'time' ? 'Time Updated' : 'Record Updated'}
                              </h4>
                              {(entry.changeType === 'status' || (entry.changeType === 'time' && entry.oldStatus && entry.newStatus)) && (
                                <div style={{
                                  fontSize: '13px',
                                  color: '#64748b',
                                  marginBottom: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  <span style={{
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                  }}>
                                    {entry.oldStatus || 'Unknown'}
                                  </span>
                                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>→</span>
                                  <span style={{
                                    background: '#dbeafe',
                                    color: '#2563eb',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    fontSize: '11px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                  }}>
                                    {entry.newStatus || 'Unknown'}
                                  </span>
                                </div>
                              )}
                              <div style={{ fontSize: '12px', color: '#64748b' }}>
                                By: <span style={{ fontWeight: 600, color: '#475569' }}>
                                  {entry.updatedBy?.firstName} {entry.updatedBy?.lastName}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500, textAlign: 'right' }}>
                              {new Date(entry.updatedAt).toLocaleString('en-IN', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </div>
                          </div>

                          {entry.reason && (
                            <div style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              padding: '12px',
                              marginTop: '8px'
                            }}>
                              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                                Message
                              </div>
                              <div style={{
                                fontStyle: 'italic',
                                fontSize: '13px',
                                color: '#374151',
                                lineHeight: '1.5'
                              }}>
                                {entry.reason}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '14px',
                    padding: '60px 20px',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '2px dashed #e2e8f0'
                  }}>
                    <div style={{ fontSize: '16px', marginBottom: '8px' }}>📋</div>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>No Edit History</div>
                    <div>This record has not been edited yet.</div>
                  </div>
                )}
              </div>

              <div style={{
                padding: '16px 28px 24px 28px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#fff'
              }}>
                <button
                  onClick={() => setShowHistoryModal(false)}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    background: '#f9fafb',
                    color: '#374151',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f9fafb';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reason details modal */}
        {showReasonModal && (
          <div
            onClick={() => setShowReasonModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 1100,
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
              backdropFilter: 'blur(3px)',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 400,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                  {reasonModalText?.startsWith('Reason for Late Check-in') ? 'Late Check-in Reason' : 'Reason Note'}
                </span>
                <button
                  onClick={() => setShowReasonModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 18,
                    color: '#94a3b8',
                    cursor: 'pointer',
                    lineHeight: 1
                  }}
                >×</button>
              </div>

              {/* Content */}
              <div style={{ padding: '16px', fontSize: 12, color: '#334155', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {reasonModalText}
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f8fafc'
              }}>
                <button
                  onClick={() => setShowReasonModal(false)}
                  style={{
                    padding: '6px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    background: '#fff',
                    color: '#475569',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Close Note
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Attendance Modal */}
        {showEditModal && editingRecord && (
          <div
            onClick={() => setShowEditModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 1000,
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 760,
                background: '#fff',
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 20px 40px rgba(15,23,42,0.18)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Edit Attendance Record</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                    {editingRecord.employee?.firstName} {editingRecord.employee?.lastName} • {new Date(editingRecord.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <button onClick={() => setShowEditModal(false)} style={{ background: 'transparent', border: 'none', fontSize: 22, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>

              <form onSubmit={handleEditSubmit}>
                <div className="att-edit-form-grid" style={{ padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#334155' }}>
                    <span>Status <span style={{ color: '#ef4444' }}>*</span></span>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      required
                      style={{ height: 34, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 10px', fontSize: 12, color: '#0f172a', fontFamily: "'Inter', sans-serif", outline: 'none', background: '#fff' }}
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="half-day">Half Day</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#334155' }}>
                    <span>Working Hrs <span style={{ fontSize: 9, fontWeight: 400, color: '#94a3b8' }}>(auto-calculated)</span></span>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.workingHours}
                      readOnly
                      placeholder="Auto-calculated"
                      style={{
                        height: 34,
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        padding: '0 10px',
                        fontSize: 12,
                        color: '#64748b',
                        fontFamily: "'Inter', sans-serif",
                        outline: 'none',
                        background: '#f8fafc',
                        cursor: 'not-allowed'
                      }}
                    />
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Login Time</span>
                      {editForm.loginTime && (
                        <button type="button" onClick={() => clearTimeField('loginTime')} style={{ background: 'transparent', border: 'none', fontSize: 10, fontWeight: 700, color: '#94a3b8', cursor: 'pointer' }}>Clear</button>
                      )}
                    </div>
                    <div className="att-time-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 0.9fr', gap: 6 }}>
                      <select
                        value={getTimeParts(editForm.loginTime).hour}
                        onChange={(e) => updateTimeField('loginTime', 'hour', e.target.value)}
                        style={{ height: 34, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 8px', fontSize: 11, color: '#0f172a', fontFamily: "'Inter', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((hour) => (
                          <option key={hour} value={hour}>{hour} Hour</option>
                        ))}
                      </select>
                      <select
                        value={getTimeParts(editForm.loginTime).minute}
                        onChange={(e) => updateTimeField('loginTime', 'minute', e.target.value)}
                        style={{ height: 34, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 8px', fontSize: 11, color: '#0f172a', fontFamily: "'Inter', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                          <option key={minute} value={minute}>{minute} Min</option>
                        ))}
                      </select>
                      <select
                        value={getTimeParts(editForm.loginTime).period}
                        onChange={(e) => updateTimeField('loginTime', 'period', e.target.value)}
                        style={{ height: 34, borderRadius: 8, border: '1px solid #3b775e', padding: '0 8px', fontSize: 11, color: '#3b775e', fontWeight: 700, fontFamily: "'Inter', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>Logout Time</span>
                      {editForm.logoutTime && (
                        <button type="button" onClick={() => clearTimeField('logoutTime')} style={{ background: 'transparent', border: 'none', fontSize: 10, fontWeight: 700, color: '#94a3b8', cursor: 'pointer' }}>Clear</button>
                      )}
                    </div>
                    <div className="att-time-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 0.9fr', gap: 6 }}>
                      <select
                        value={getTimeParts(editForm.logoutTime).hour}
                        onChange={(e) => updateTimeField('logoutTime', 'hour', e.target.value)}
                        style={{ height: 34, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 8px', fontSize: 11, color: '#0f172a', fontFamily: "'Inter', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((hour) => (
                          <option key={hour} value={hour}>{hour} Hour</option>
                        ))}
                      </select>
                      <select
                        value={getTimeParts(editForm.logoutTime).minute}
                        onChange={(e) => updateTimeField('logoutTime', 'minute', e.target.value)}
                        style={{ height: 34, borderRadius: 8, border: '1px solid #e2e8f0', padding: '0 8px', fontSize: 11, color: '#0f172a', fontFamily: "'Inter', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                          <option key={minute} value={minute}>{minute} Min</option>
                        ))}
                      </select>
                      <select
                        value={getTimeParts(editForm.logoutTime).period}
                        onChange={(e) => updateTimeField('logoutTime', 'period', e.target.value)}
                        style={{ height: 34, borderRadius: 8, border: '1px solid #3b775e', padding: '0 8px', fontSize: 11, color: '#3b775e', fontWeight: 700, fontFamily: "'Inter', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div style={{ padding: '0 18px 14px 18px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#334155' }}>
                    <span>Reason for Edit <span style={{ color: '#ef4444' }}>*</span></span>
                    <textarea
                      value={editForm.reason || ''}
                      onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                      required
                      placeholder="Please provide a reason for editing this record..."
                      style={{ minHeight: 60, borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px 10px', fontSize: 12, color: '#0f172a', fontFamily: "'Inter', sans-serif", outline: 'none', background: '#fff', resize: 'vertical' }}
                    />
                  </label>
                </div>

                <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="attendance-cancel-btn"
                    style={{
                      position: 'relative',
                      isolation: 'isolate',
                      overflow: 'hidden',
                      padding: '7px 14px',
                      border: '1.5px solid #e5e7eb',
                      borderRadius: 8,
                      background: '#fff',
                      color: '#6b7280',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                    }}
                  >
                    <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
                  </button>
                  <button type="submit" style={{ padding: '7px 14px', border: 'none', borderRadius: 8, background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Update Attendance
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Attendance Modal - Calendar Style */}
        {showAddModal && (
          <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
            <div className="cal-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
              {/* Header */}
              <div className="cal-modal-hd">
                <div className="cal-modal-hd-icon">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M9 11l3 3L22 4" stroke="#3b775e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="#3b775e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="17" cy="17" r="5" fill="#3b775e" opacity="0.18" />
                    <line x1="17" y1="14.5" x2="17" y2="19.5" stroke="#3b775e" strokeWidth="1.6" strokeLinecap="round" />
                    <line x1="14.5" y1="17" x2="19.5" y2="17" stroke="#3b775e" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="cal-modal-title">Add Attendance Record</div>
                  <div className="cal-modal-sub">Create a new attendance entry for any employee</div>
                </div>
                <button className="cal-close-btn" onClick={() => setShowAddModal(false)}>
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="cal-modal-body">
                <form onSubmit={handleAddSubmit} className="cal-form">
                  {/* Employee & Date Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="cal-field" style={{ position: 'relative', overflow: 'visible' }}>
                      <label className="cal-lbl">Employee <span style={{ color: '#ef4444' }}>*</span></label>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setShowEmployeeDropdown(!showEmployeeDropdown); }}
                        disabled={loadingEmployees}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: loadingEmployees ? 'not-allowed' : 'pointer',
                          background: showEmployeeDropdown ? '#f0fdf4' : '#ffffff',
                          color: addForm.employeeId ? '#1e293b' : '#94a3b8',
                          outline: 'none',
                          fontFamily: "'Inter', sans-serif",
                          transition: 'all 0.2s ease',
                          textAlign: 'left'
                        }}
                      >
                        <span>
                          {loadingEmployees ? 'Loading...' :
                            addForm.employeeId ?
                              (() => {
                                const emp = employees.find(e => e._id === addForm.employeeId);
                                return emp ? `${emp.firstName} ${emp.lastName} (${emp.employeeId})` : 'Select Employee';
                              })() :
                              'Select Employee'}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEmployeeDropdown ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {showEmployeeDropdown && (
                        <div onClick={e => e.stopPropagation()} style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          left: 0,
                          right: 0,
                          background: '#ffffff',
                          borderRadius: '12px',
                          boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          padding: '10px',
                          maxHeight: '280px',
                          display: 'flex',
                          flexDirection: 'column'
                        }}>
                          <div style={{ marginBottom: '8px' }}>
                            <input
                              type="text"
                              placeholder="Search employees..."
                              value={employeeSearch}
                              onChange={(e) => setEmployeeSearch(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #f1f5f9',
                                borderRadius: '8px',
                                fontSize: '12px',
                                background: '#f8fafc',
                                outline: 'none',
                                fontFamily: "'Inter', sans-serif"
                              }}
                            />
                          </div>
                          <div style={{ overflowY: 'auto', flex: 1 }} className="emp-modal-scroll">
                            {employees
                              .filter(emp =>
                                `${emp.firstName} ${emp.lastName} ${emp.employeeId}`
                                  .toLowerCase()
                                  .includes(employeeSearch.toLowerCase())
                              )
                              .map(emp => (
                                <div
                                  key={emp._id}
                                  onClick={() => {
                                    setAddForm({ ...addForm, employeeId: emp._id });
                                    setShowEmployeeDropdown(false);
                                    setEmployeeSearch('');
                                  }}
                                  style={{
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    fontWeight: addForm.employeeId === emp._id ? '600' : '400',
                                    cursor: 'pointer',
                                    color: addForm.employeeId === emp._id ? '#15803d' : '#1e293b',
                                    background: addForm.employeeId === emp._id ? '#dcfce7' : 'transparent',
                                    marginBottom: '4px',
                                    fontFamily: "'Inter', sans-serif",
                                    transition: 'all 0.15s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (addForm.employeeId !== emp._id) {
                                      e.currentTarget.style.background = '#f8fafc';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (addForm.employeeId !== emp._id) {
                                      e.currentTarget.style.background = 'transparent';
                                    }
                                  }}
                                >
                                  <div style={{ fontWeight: 600 }}>
                                    {emp.firstName} {emp.lastName}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    ID: {emp.employeeId}
                                  </div>
                                </div>
                              ))}
                            {employees.filter(emp =>
                              `${emp.firstName} ${emp.lastName} ${emp.employeeId}`
                                .toLowerCase()
                                .includes(employeeSearch.toLowerCase())
                            ).length === 0 && (
                                <div style={{
                                  padding: '20px',
                                  textAlign: 'center',
                                  color: '#94a3b8',
                                  fontSize: '12px'
                                }}>
                                  No employees found
                                </div>
                              )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="cal-field">
                      <label className="cal-lbl">Date <span style={{ color: '#ef4444' }}>*</span></label>
                      <div className="cal-input-wrap">
                        <svg className="cal-input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="4" width="18" height="18" rx="3" stroke="#9ca3af" strokeWidth="1.7" fill="none" />
                          <line x1="16" y1="2" x2="16" y2="6" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round" />
                          <line x1="8" y1="2" x2="8" y2="6" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round" />
                          <line x1="3" y1="10" x2="21" y2="10" stroke="#9ca3af" strokeWidth="1.3" />
                        </svg>
                        <input
                          className="cal-input cal-input--dt"
                          type="date"
                          value={addForm.date}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setAddForm(prev => {
                              const updated = { ...prev, date: newDate };
                              if (prev.loginTime) {
                                const parts = getTimeParts(prev.loginTime);
                                updated.loginTime = buildDateTime(newDate, parts.hour, parts.minute, parts.period);
                              }
                              if (prev.logoutTime) {
                                const parts = getTimeParts(prev.logoutTime);
                                updated.logoutTime = buildDateTime(newDate, parts.hour, parts.minute, parts.period);
                              }
                              // Re-calculate working hours with the new date's datetimes
                              if (updated.loginTime && updated.logoutTime) {
                                const login = new Date(updated.loginTime);
                                const logout = new Date(updated.logoutTime);
                                if (!isNaN(login.getTime()) && !isNaN(logout.getTime())) {
                                  let diffMs = logout - login;
                                  let diffHours = diffMs / (1000 * 60 * 60);
                                  if (diffHours < 0) {
                                    diffHours += 24;
                                  }
                                  updated.workingHours = Math.round(diffHours * 100) / 100;
                                }
                              }
                              return updated;
                            });
                          }}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status Segmented Control */}
                  <div className="cal-field">
                    <label className="cal-lbl">Status <span style={{ color: '#ef4444' }}>*</span></label>
                    <div className="cal-seg-wrap">
                      {[
                        { v: 'present', l: 'Present' },
                        { v: 'absent', l: 'Absent' },
                        { v: 'half-day', l: 'Half Day' }
                      ].map(opt => (
                        <button
                          key={opt.v}
                          type="button"
                          className={`cal-seg-btn${addForm.status === opt.v ? ' cal-seg-btn--on' : ''}`}
                          onClick={() => setAddForm({ ...addForm, status: opt.v })}
                        >{opt.l}</button>
                      ))}
                    </div>
                  </div>

                  {/* Login & Logout Time Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="cal-field">
                      <label className="cal-lbl">
                        Login Time
                        {addForm.loginTime && (
                          <button type="button" onClick={() => clearAddTimeField('loginTime')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: 10, fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}>Clear</button>
                        )}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: 6 }}>
                        <select
                          className="cal-input"
                          value={getTimeParts(addForm.loginTime).hour}
                          onChange={(e) => updateAddTimeField('loginTime', 'hour', e.target.value)}
                          style={{ padding: '0 8px' }}
                        >
                          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((hour) => (
                            <option key={hour} value={hour}>{hour}h</option>
                          ))}
                        </select>
                        <select
                          className="cal-input"
                          value={getTimeParts(addForm.loginTime).minute}
                          onChange={(e) => updateAddTimeField('loginTime', 'minute', e.target.value)}
                          style={{ padding: '0 8px' }}
                        >
                          {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                            <option key={minute} value={minute}>{minute}m</option>
                          ))}
                        </select>
                        <select
                          className="cal-input"
                          value={getTimeParts(addForm.loginTime).period}
                          onChange={(e) => updateAddTimeField('loginTime', 'period', e.target.value)}
                          style={{ padding: '0 8px', fontWeight: 700, color: '#3b775e' }}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>

                    <div className="cal-field">
                      <label className="cal-lbl">
                        Logout Time
                        {addForm.logoutTime && (
                          <button type="button" onClick={() => clearAddTimeField('logoutTime')} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', fontSize: 10, fontWeight: 600, color: '#94a3b8', cursor: 'pointer' }}>Clear</button>
                        )}
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: 6 }}>
                        <select
                          className="cal-input"
                          value={getTimeParts(addForm.logoutTime).hour}
                          onChange={(e) => updateAddTimeField('logoutTime', 'hour', e.target.value)}
                          style={{ padding: '0 8px' }}
                        >
                          {Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0')).map((hour) => (
                            <option key={hour} value={hour}>{hour}h</option>
                          ))}
                        </select>
                        <select
                          className="cal-input"
                          value={getTimeParts(addForm.logoutTime).minute}
                          onChange={(e) => updateAddTimeField('logoutTime', 'minute', e.target.value)}
                          style={{ padding: '0 8px' }}
                        >
                          {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((minute) => (
                            <option key={minute} value={minute}>{minute}m</option>
                          ))}
                        </select>
                        <select
                          className="cal-input"
                          value={getTimeParts(addForm.logoutTime).period}
                          onChange={(e) => updateAddTimeField('logoutTime', 'period', e.target.value)}
                          style={{ padding: '0 8px', fontWeight: 700, color: '#3b775e' }}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Working Hours (Read-only) */}
                  <div className="cal-field">
                    <label className="cal-lbl">Working Hours <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: '11px' }}>auto-calculated</span></label>
                    <input
                      className="cal-input"
                      type="text"
                      value={addForm.workingHours ? `${addForm.workingHours} hours` : '—'}
                      readOnly
                      style={{ background: '#f8fafc', color: '#64748b', cursor: 'not-allowed' }}
                    />
                  </div>

                  <div className="cal-field">
                    <label className="cal-lbl">Reason <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea
                      value={addForm.reason}
                      onChange={(e) => setAddForm(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Why is this record being added?"
                      required
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13px',
                        fontFamily: "'Inter', sans-serif",
                        outline: 'none',
                        resize: 'vertical',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#10b981'}
                      onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
                    />
                  </div>

                  {/* Footer */}
                  <div className="cal-footer">
                    <button type="button" className="cal-btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                    <button type="submit" className="cal-btn-primary">Add Attendance</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Updater Info Modal */}
        {updaterInfo && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.3)',
              backdropFilter: 'blur(4px)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px'
            }}
            onClick={() => setUpdaterInfo(null)}
          >
            <div
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                animation: 'att-modal-pop 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
                fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(244, 63, 94, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f43f5e'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Update Information</h3>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Attendance Record Details</p>
                </div>
              </div>
              <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, marginBottom: '20px' }}>
                This attendance record was {updaterInfo.action === 'added' ? 'added' : 'updated'} by: <strong style={{ color: '#0f172a' }}>{updaterInfo.name}</strong>.
                <br />
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '6px' }}>
                  {updaterInfo.action === 'added' ? 'Added' : 'Updated'} on: {updaterInfo.date}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setUpdaterInfo(null)}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Admin Selfie Modal */}
      {adminSelfieModal.visible && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', width: '850px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <Camera size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 700 }}>Attendance Selfies</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{adminSelfieModal.employeeName}</p>
                </div>
              </div>
              <button
                onClick={() => setAdminSelfieModal({ visible: false, checkInSelfie: null, checkOutSelfie: null, checkInTime: null, checkOutTime: null, employeeName: '' })}
                style={{
                  background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                  padding: '8px', borderRadius: '8px', transition: 'all 0.2s ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', justifyItems: 'center', width: '100%' }}>
              {/* LEFT COLUMN: Check-in */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {adminSelfieModal.checkInSelfie ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100%', maxWidth: '300px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                      <img src={adminSelfieModal.checkInSelfie} alt="Check-in Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>
                      Check-in Selfie <br />
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {adminSelfieModal.checkInTime ? new Date(adminSelfieModal.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Uploaded'}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div style={{ width: '100%', maxWidth: '300px', aspectRatio: '4/3', border: '2px dashed #cbd5e1', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No Check-in Selfie</div>
                )}
              </div>

              {/* RIGHT COLUMN: Check-out */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {adminSelfieModal.checkOutSelfie ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100%', maxWidth: '300px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                      <img src={adminSelfieModal.checkOutSelfie} alt="Check-out Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>
                      Check-out Selfie <br />
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {adminSelfieModal.checkOutTime ? new Date(adminSelfieModal.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Uploaded'}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div style={{ width: '100%', maxWidth: '300px', aspectRatio: '4/3', border: '2px dashed #cbd5e1', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>No Check-out Selfie</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Hover Card Portal for Late Reason */}
      {hoveredLateReason && createPortal(
        <div style={{
          position: 'fixed',
          top: `${hoveredLateReason.y - 10}px`,
          left: `${hoveredLateReason.x}px`,
          transform: 'translate(-50%, -100%)',
          background: '#ffffff',
          border: '1px solid #fed7aa',
          borderRadius: '10px',
          padding: '10px 14px',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.18)',
          maxWidth: '280px',
          zIndex: 9999999,
          pointerEvents: 'none',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span></span> Late Check-in Reason
          </div>
          <div style={{ fontSize: '12px', color: '#1e293b', lineHeight: '1.4', fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-word' }}>
            {hoveredLateReason.text}
          </div>
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '6px',
            borderStyle: 'solid',
            borderColor: '#ffffff transparent transparent transparent'
          }} />
        </div>,
        document.body
      )}

    </>
  );
}

export default Attendance;
