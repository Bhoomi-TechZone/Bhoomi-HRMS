import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './Dashboard.css';
import './AdminDasboard.css';
import SalesDashboard from './SalesDashboard';
import {
  CheckCircle2, XCircle, Trophy, FolderOpen, Clock, Target, Megaphone,
  Hourglass, Umbrella, ClipboardList, BarChart2, Building2, Pin,
  FileText, RefreshCw, Loader2, AlertTriangle, Lightbulb, LogIn,
  Circle, CheckCheck, Users, TrendingUp, CalendarDays, Camera,
  Coffee, Utensils
} from 'lucide-react';

// Load Inter & Poppins fonts for professional typography
if (typeof document !== 'undefined' && !document.getElementById('dashboard-pro-fonts')) {
  const link = document.createElement('link');
  link.id = 'dashboard-pro-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@400;500;600;700&display=swap';
  document.head.appendChild(link);
}

const BreakDropdown = ({ value, onChange, disabledOptions = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  const options = ['1st Refreshment Break', 'Lunch Break', '2nd Refreshment Break', 'Briefing/Meeting'];
  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #e2e8f0', borderRadius: '8px',
          background: '#fff', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        <span style={{ color: value ? '#0f172a' : '#94a3b8' }}>
          {value || 'Select Break Type'}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
      </div>
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px',
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.08)', zIndex: 50, padding: '8px'
        }}>
          <input
            type="text"
            placeholder="Search break types..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', fontSize: '13px', background: '#f8fafc',
              border: '1px solid #f1f5f9', borderRadius: '6px', outline: 'none', marginBottom: '8px'
            }}
          />
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filteredOptions.map(opt => {
              const isDisabled = disabledOptions.includes(opt);
              return (
                <div
                  key={opt}
                  onClick={() => {
                    if (isDisabled) return;
                    onChange(opt);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '14px',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    borderRadius: '6px',
                    background: !isDisabled && value === opt ? '#dcfce7' : 'transparent',
                    color: isDisabled ? '#94a3b8' : (value === opt ? '#166534' : '#334155'),
                    fontWeight: value === opt ? 600 : 400,
                    opacity: isDisabled ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                  onMouseEnter={e => {
                    if (!isDisabled && value !== opt) e.currentTarget.style.background = '#f8fafc';
                  }}
                  onMouseLeave={e => {
                    if (!isDisabled && value !== opt) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>{opt}</span>
                  {isDisabled && (
                    <span style={{ fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      Already Taken
                    </span>
                  )}
                </div>
              );
            })}
            {filteredOptions.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                No matches found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function Dashboard() {
  // Timer for check-in (only active when checked in during this session)
  const [checkInTimer, setCheckInTimer] = useState(0);
  const checkInIntervalRef = useRef(null);
  const checkedInThisSession = useRef(false);
  const { user, setActiveToast } = useAuth();
  const roleName = user?.role?.name?.toLowerCase().trim() || '';
  const isSalesRole = roleName === 'sales' || roleName === 'sales head' || roleName === 'saleshead' || roleName === 'head of sales';
  const isAdmin = user?.role?.permissions?.some(
    p => p.module === 'employees' && p.actions.includes('update')
  );
  const [stats, setStats] = useState({
    broadcasts: 0,
    goals: 0,
    assets: 0,
    pendingLeaves: 0,
    totalEmployees: 0,
    activeEmployees: 0,
    activeProjects: 0,
    goalsInProgress: 0,
    pendingApprovals: 0,
    presentToday: 0,
    absentToday: 0,
    completedProjects: 0,
    upcomingDeadlines: 0,
    todayLeads: 0,
    rejectedLeaves: 0,
    approvedLeaves: 0
  });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [recentGoals, setRecentGoals] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [departmentDistribution, setDepartmentDistribution] = useState({
    departments: [],
    employeeCounts: []
  });
  const [personalAttendance, setPersonalAttendance] = useState({
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    lateMarks: 0
  });
  const [monthlyStats, setMonthlyStats] = useState({
    currentMonth: {
      present: 0,
      absent: 0,
      halfDay: 0,
      assignedProjects: 0,
      completedProjects: 0,
      totalLeaves: 0
    },
    lastMonth: {
      present: 0,
      absent: 0,
      halfDay: 0,
      assignedProjects: 0,
      completedProjects: 0,
      totalLeaves: 0
    },
    trends: {
      present: 0,
      absent: 0,
      assignedProjects: 0,
      completedProjects: 0,
      totalLeaves: 0
    }
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [weeklyAnalytics, setWeeklyAnalytics] = useState({
    days: [],
    goalsCompleted: [],
    completedProjects: [],
    newJoining: [],
    upcomingDeadlines: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentWorkingHours, setCurrentWorkingHours] = useState('0:00:00');
  const [breakLimits, setBreakLimits] = useState({ lunchBreakLimit: 30, teaBreakLimit: 15 });
  // Break state
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakForm, setBreakForm] = useState({ type: 'Tea Break', reason: '' });
  const [activeBreak, setActiveBreak] = useState(null);
  const [hideBreakScreen, setHideBreakScreen] = useState(false);
  const [breakTimer, setBreakTimer] = useState(0);
  const [breakDetailsModal, setBreakDetailsModal] = useState({ visible: false, type: '', breaks: [] });
  const [errorToast, setErrorToast] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [shiftConfig, setShiftConfig] = useState(null);
  
  // Selfie state
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieType, setSelfieType] = useState('checkin'); // 'checkin' or 'checkout'
  const [selfieImage, setSelfieImage] = useState(null);
  const [checkInSelfie, setCheckInSelfie] = useState(null);
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkOutSelfie, setCheckOutSelfie] = useState(null);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [isCheckInSelfieUploaded, setIsCheckInSelfieUploaded] = useState(false);
  const [isCheckOutSelfieUploaded, setIsCheckOutSelfieUploaded] = useState(false);
  const [isSelfieUploaded, setIsSelfieUploaded] = useState(false); // Backwards compatibility variable if needed

  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);
  const [cachedLocation, setCachedLocation] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [cameraError, setCameraError] = useState(null);
  const [showLateReasonModal, setShowLateReasonModal] = useState(false);
  const [lateReasonInput, setLateReasonInput] = useState('');
  const [savedLateReason, setSavedLateReason] = useState('');

  useEffect(() => {
    // Check database for existing selfie
    api.get('/attendance/my-selfie')
      .then(response => {
        if (response.data?.uploaded) {
          setCheckInSelfie(response.data.image);
          setIsCheckInSelfieUploaded(true);
          setIsSelfieUploaded(true); // for backwards compat logic
          setCheckInTime(response.data.checkInTime);
        }
        if (response.data?.checkOutUploaded) {
          setCheckOutSelfie(response.data.checkOutImage);
          setIsCheckOutSelfieUploaded(true);
          setCheckOutTime(response.data.checkOutTime);
        }
      })
      .catch(err => console.error('Error fetching selfie:', err));
  }, []);

  useEffect(() => {
    if (successToast) {
      const t = setTimeout(() => setSuccessToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successToast]);

  useEffect(() => {
    if (errorToast) {
      const t = setTimeout(() => setErrorToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [errorToast]);

  useEffect(() => {
    if (showSelfieModal && !selfieImage) {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError("Camera access is not supported in this browser or environment (requires HTTPS or localhost).");
        return;
      }
      
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(err => {
          console.error("Camera access error:", err);
          setCameraError("Failed to access camera. Please ensure you have granted camera permissions.");
        });
    } else if (!showSelfieModal && videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, [showSelfieModal, selfieImage]);

  // Pre-fetch location to make check-in instant
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCachedLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            address: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
          });
        },
        (err) => console.log('Background geolocation error:', err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  const breakIntervalRef = useRef(null);
  const breakAudioRef = useRef(null);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const weeklyChartRef = useRef(null);
  const weeklyChartInstance = useRef(null);
  const personalAttendanceChartRef = useRef(null);
  const personalAttendanceChartInstance = useRef(null);

  useEffect(() => {
    fetchAllData();
    // Fetch break limits for timer calculations
    api.get('/attendance/break-limits').then(res => {
      if (res.data) setBreakLimits(res.data);
    }).catch(() => { });
    
    // Fetch user shift config for break schedules
    const type = user?.shiftType || 'morning';
    api.get(`/shift-configs/${type}`).then(res => {
      if (res.data) setShiftConfig(res.data);
    }).catch(() => { });
  }, [user?.shiftType]);

  // Update working hours counter every second (live)
  useEffect(() => {
    if (!todayAttendance?.loginTime) {
      setCurrentWorkingHours('0:00:00');
      return;
    }

    const parseShiftStartTime = () => {
      let shiftStartStr = todayAttendance?.shiftStartTime || user?.shiftStartTime || '09:00 AM';
      try {
        const match = String(shiftStartStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!match) return new Date(todayAttendance.loginTime);
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3] ? match[3].toUpperCase() : null;
        if (period === 'PM' && hours !== 12) hours += 12;
        else if (period === 'AM' && hours === 12) hours = 0;
        const d = new Date(todayAttendance.loginTime);
        d.setHours(hours, minutes, 0, 0);
        return d;
      } catch (e) {
        return new Date(todayAttendance.loginTime);
      }
    };

    const parseShiftEndTime = () => {
      let shiftEndStr = todayAttendance?.shiftEndTime || user?.shiftEndTime;
      if (!shiftEndStr || shiftEndStr === 'Not Assigned') return null;
      try {
        const match = String(shiftEndStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (!match) return null;
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3] ? match[3].toUpperCase() : null;
        if (period === 'PM' && hours !== 12) hours += 12;
        else if (period === 'AM' && hours === 12) hours = 0;
        const d = new Date(todayAttendance.loginTime);
        d.setHours(hours, minutes, 0, 0);
        if (d < new Date(todayAttendance.loginTime)) {
          d.setDate(d.getDate() + 1);
        }
        return d;
      } catch (e) {
        return null;
      }
    };

    const updateWorkingHours = () => {
      const shiftStart = parseShiftStartTime();
      const shiftEnd = parseShiftEndTime();
      let endTime = todayAttendance.logoutTime ? new Date(todayAttendance.logoutTime) : new Date();
      if (shiftEnd && (endTime > shiftEnd || endTime >= new Date(shiftEnd.getTime() - 2 * 60000))) {
        endTime = shiftEnd;
      }

      const markLateAfterHrs = breakLimits?.markLateAfter !== undefined ? breakLimits.markLateAfter : 0.25;
      const markLateAfterMs = markLateAfterHrs * 60 * 60 * 1000;

      const login = new Date(todayAttendance.loginTime);
      let calculationStart = login;
      if (shiftStart) {
        const markPresentTill = new Date(shiftStart.getTime() + markLateAfterMs);
        if (todayAttendance.status === 'late-checkin' || login > markPresentTill) {
          calculationStart = login;
        } else {
          calculationStart = shiftStart;
        }
      }
      let totalSecs = Math.max(0, Math.round((endTime - calculationStart) / 1000));
      let totalBreakSecs = 0;

      if (todayAttendance.breaks && todayAttendance.breaks.length > 0) {
        todayAttendance.breaks.forEach(b => {
          if (b.breakType === 'Other' || b.breakType === 'Briefing/Meeting' || b.breakType === 'Breifing/Meeting') return;
          let breakDur = 0;
          if (b.endTime) {
            breakDur = Math.round((new Date(b.endTime) - new Date(b.startTime)) / 1000);
          } else {
            const breakEnd = todayAttendance.logoutTime ? new Date(todayAttendance.logoutTime) : new Date();
            const cappedBreakEnd = shiftEnd && breakEnd > shiftEnd ? shiftEnd : breakEnd;
            breakDur = Math.round((cappedBreakEnd - new Date(b.startTime)) / 1000);
          }
          totalBreakSecs += Math.max(0, breakDur);
        });
      }

      // Only deduct actual break time taken — break limit is for enforcement/warning only
      let totalDeductSecs = totalBreakSecs;

      let netSecs = Math.max(0, totalSecs - totalDeductSecs);
      const hrs = Math.floor(netSecs / 3600);
      const mins = Math.floor((netSecs % 3600) / 60);
      const secs = netSecs % 60;
      setCurrentWorkingHours(`${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`);
    };

    updateWorkingHours();
    if (!todayAttendance.logoutTime) {
      const interval = setInterval(updateWorkingHours, 1000);
      return () => clearInterval(interval);
    }
  }, [todayAttendance, activeBreak, breakLimits, user]);

  // Timer: always run from shiftStartTime so it survives page reloads
  useEffect(() => {
    if (todayAttendance?.loginTime) {
      const parseShiftStartTime = () => {
        let shiftStartStr = todayAttendance?.shiftStartTime || user?.shiftStartTime || shiftConfig?.startTime || '09:00 AM';
        try {
          const match = String(shiftStartStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
          if (!match) return new Date(todayAttendance.loginTime);
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const period = match[3] ? match[3].toUpperCase() : null;
          if (period === 'PM' && hours !== 12) hours += 12;
          else if (period === 'AM' && hours === 12) hours = 0;
          const d = new Date(todayAttendance.loginTime);
          d.setHours(hours, minutes, 0, 0);
          return d;
        } catch (e) {
          return new Date(todayAttendance.loginTime);
        }
      };

      const parseShiftEndTime = () => {
        let shiftEndStr = todayAttendance?.shiftEndTime || user?.shiftEndTime || shiftConfig?.endTime;
        if (!shiftEndStr || shiftEndStr === 'Not Assigned') return null;
        try {
          const match = String(shiftEndStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
          if (!match) return null;
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const period = match[3] ? match[3].toUpperCase() : null;
          if (period === 'PM' && hours !== 12) hours += 12;
          else if (period === 'AM' && hours === 12) hours = 0;
          const d = new Date(todayAttendance.loginTime);
          d.setHours(hours, minutes, 0, 0);
          if (d < new Date(todayAttendance.loginTime)) {
            d.setDate(d.getDate() + 1);
          }
          return d;
        } catch (e) {
          return null;
        }
      };

      const updateTimer = () => {
        const shiftStart = parseShiftStartTime();
        const shiftEnd = parseShiftEndTime();
        let endTime = todayAttendance.logoutTime ? new Date(todayAttendance.logoutTime) : new Date();
        if (shiftEnd && (endTime > shiftEnd || endTime >= new Date(shiftEnd.getTime() - 2 * 60000))) {
          endTime = shiftEnd;
        }

        const markLateAfterHrs = breakLimits?.markLateAfter !== undefined ? breakLimits.markLateAfter : 0.25;
        const markLateAfterMs = markLateAfterHrs * 60 * 60 * 1000;

        const login = new Date(todayAttendance.loginTime);
        let calculationStart = login;
        if (shiftStart) {
          const markPresentTill = new Date(shiftStart.getTime() + markLateAfterMs);
          if (todayAttendance.status === 'late-checkin' || login > markPresentTill) {
            calculationStart = login;
          } else {
            calculationStart = shiftStart;
          }
        }
        let elapsed = Math.max(0, Math.round((endTime - calculationStart) / 1000));
        let totalBreakSecs = 0;
        if (todayAttendance.breaks && todayAttendance.breaks.length > 0) {
          todayAttendance.breaks.forEach(b => {
            if (b.breakType === 'Other' || b.breakType === 'Briefing/Meeting' || b.breakType === 'Breifing/Meeting') return;
            if (b.endTime) {
              const dur = Math.round((new Date(b.endTime) - new Date(b.startTime)) / 1000);
              totalBreakSecs += Math.max(0, dur);
            } else {
              const breakEnd = todayAttendance.logoutTime ? new Date(todayAttendance.logoutTime) : new Date();
              const cappedBreakEnd = shiftEnd && breakEnd > shiftEnd ? shiftEnd : breakEnd;
              totalBreakSecs += Math.max(0, Math.round((cappedBreakEnd - new Date(b.startTime)) / 1000));
            }
          });
        }
        // Only deduct actual break time taken — break limit is for enforcement/warning only
        let totalDeductSecs = totalBreakSecs;
        let netSecs = Math.max(0, elapsed - totalDeductSecs);
        setCheckInTimer(netSecs);
      };

      updateTimer();
      if (checkInIntervalRef.current) {
        clearInterval(checkInIntervalRef.current);
      }
      if (!todayAttendance.logoutTime) {
        checkInIntervalRef.current = setInterval(updateTimer, 1000);
      }
    } else {
      setCheckInTimer(0);
      if (checkInIntervalRef.current) {
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
      }
    }
    return () => {
      if (checkInIntervalRef.current) {
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
      }
    };
  }, [todayAttendance, activeBreak, breakLimits, user]);

  const fetchAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const isAdmin = user?.role?.permissions?.some(
        p => p.module === 'employees' && p.actions.includes('update')
      );

      if (isAdmin) {
        await Promise.all([
          fetchStats(),
          fetchTodayAttendance(),
          fetchDepartmentDistribution(),
          fetchWeeklyAnalytics(),
          fetchRecentActivities()
        ]);
      } else {
        await Promise.all([
          fetchStats(),
          fetchTodayAttendance(),
          fetchPersonalAttendance(),
          fetchMonthlyStats(),
          fetchWeeklyAnalytics(),
          fetchRecentActivities()
        ]);
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const response = await api.get('/activities');
      setRecentActivities(response.data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
      setRecentActivities([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  };

  useEffect(() => {
    if (departmentDistribution.departments.length > 0) {
      renderChart();
    }
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [departmentDistribution]);

  useEffect(() => {
    if (weeklyAnalytics.days.length > 0) {
      renderWeeklyChart();
    }
    return () => {
      if (weeklyChartInstance.current) {
        weeklyChartInstance.current.destroy();
      }
    };
  }, [weeklyAnalytics]);

  useEffect(() => {
    const isAdmin = user?.role?.permissions?.some(
      p => p.module === 'employees' && p.actions.includes('update')
    );

    if (!isAdmin && !loading) {
      renderPersonalAttendanceChart();
    }
    return () => {
      if (personalAttendanceChartInstance.current) {
        personalAttendanceChartInstance.current.destroy();
      }
    };
  }, [personalAttendance, loading]);

  const fetchTodayAttendance = async () => {
    try {
      const response = await api.get('/attendance/today');
      if (response.data) {
        setTodayAttendance(response.data);
        if (response.data.breaks && Array.isArray(response.data.breaks)) {
          const ongoing = response.data.breaks.find(b => !b.endTime);
          setActiveBreak(ongoing || null);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setTodayAttendance(null);
    }
  };

  const getCheckinWindowOpenTime = () => {
    if (!user || !user.shiftStartTime) return user?.shiftStartTime || '';
    try {
      const timeStr = user.shiftStartTime;
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      const windowBefore = breakLimits?.checkinWindowBefore !== undefined ? breakLimits.checkinWindowBefore : 15;
      let windowMins = hours * 60 + (minutes || 0) - windowBefore;
      if (windowMins < 0) windowMins += 1440;
      const wHour = Math.floor(windowMins / 60) % 24;
      const wMin = windowMins % 60;
      const wPeriod = wHour >= 12 ? 'PM' : 'AM';
      const wHour12 = wHour % 12 === 0 ? 12 : wHour % 12;
      return `${String(wHour12).padStart(2, '0')}:${String(wMin).padStart(2, '0')} ${wPeriod}`;
    } catch (e) {
      return user?.shiftStartTime || '';
    }
  };

  const isBeforeShiftStart = () => {
    if (!user || !user.shiftStartTime) return false;
    try {
      const timeStr = user.shiftStartTime;
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      const windowBefore = breakLimits?.checkinWindowBefore !== undefined ? breakLimits.checkinWindowBefore : 15;

      const now = new Date();
      const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);
      let currentHour = parseInt(parts.find(p => p.type === 'hour').value, 10);
      let currentMinute = parseInt(parts.find(p => p.type === 'minute').value, 10);
      if (currentHour === 24) currentHour = 0;
      
      const currentTotalMins = currentHour * 60 + currentMinute;
      const windowOpenTotalMins = (hours * 60 + (minutes || 0)) - windowBefore;

      const endTimeStr = user.shiftEndTime || '06:00 PM';
      const [eTime, ePeriod] = endTimeStr.split(' ');
      let [eHours, eMinutes] = eTime.split(':').map(Number);
      if (ePeriod === 'PM' && eHours !== 12) eHours += 12;
      if (ePeriod === 'AM' && eHours === 12) eHours = 0;
      
      const shiftStartTotalMins = hours * 60 + (minutes || 0);
      const shiftEndTotalMins = eHours * 60 + (eMinutes || 0);
      const isOvernightShift = shiftStartTotalMins > shiftEndTotalMins;

      if (isOvernightShift) {
        // Overnight shift: e.g. 09:45 PM → 06:45 AM, window opens at 09:30 PM
        // After midnight (small currentTotalMins < shiftEndTotalMins): employee is in shift, NOT before start
        if (currentTotalMins < shiftEndTotalMins) return false;
        // Before the window opens (e.g. 4:55 PM when window is at 9:30 PM): IS before start
        return currentTotalMins < windowOpenTotalMins;
      }

      // Normal (non-overnight) shift
      return currentTotalMins < windowOpenTotalMins;
    } catch (e) {
      return false;
    }
  };

  const isLateCheckIn = () => {
    if (!user || !user.shiftStartTime) return false;
    try {
      const timeStr = user.shiftStartTime;
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      const markLateAfterHrs = breakLimits?.markLateAfter !== undefined ? breakLimits.markLateAfter : 0.25;
      const markLateAfterMins = Math.round(markLateAfterHrs * 60);

      const now = new Date();
      const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);
      let currentHour = parseInt(parts.find(p => p.type === 'hour').value, 10);
      let currentMinute = parseInt(parts.find(p => p.type === 'minute').value, 10);
      if (currentHour === 24) currentHour = 0;
      
      const currentTotalMins = currentHour * 60 + currentMinute;
      const shiftStartTotalMins = hours * 60 + (minutes || 0);
      const markPresentTillMins = shiftStartTotalMins + markLateAfterMins;

      const endTimeStr = user.shiftEndTime || '06:00 PM';
      const [eTime, ePeriod] = endTimeStr.split(' ');
      let [eHours, eMinutes] = eTime.split(':').map(Number);
      if (ePeriod === 'PM' && eHours !== 12) eHours += 12;
      if (ePeriod === 'AM' && eHours === 12) eHours = 0;
      const shiftEndTotalMins = eHours * 60 + (eMinutes || 0);
      const isOvernightShift = shiftStartTotalMins > shiftEndTotalMins;

      if (isOvernightShift) {
        if (currentTotalMins >= markPresentTillMins || currentTotalMins < shiftEndTotalMins) {
          return true;
        }
        return false;
      }

      return currentTotalMins > markPresentTillMins;
    } catch (e) {
      return false;
    }
  };

  const handleCheckIn = async (skipSelfieCheck = false, userLateReason = null) => {
    if (isCheckingIn) return;
    if (isBeforeShiftStart()) {
      alert(`Check-in is unavailable before your check-in window opens.\nWindow opens at: ${getCheckinWindowOpenTime()} (Shift starts: ${user?.shiftStartTime})`);
      return;
    }

    const currentReason = userLateReason || savedLateReason;

    // FIRST: If late, prompt for late reason BEFORE selfie/check-in!
    if (isLateCheckIn() && !currentReason) {
      setShowLateReasonModal(true);
      return;
    }

    if (!skipSelfieCheck && !isCheckInSelfieUploaded) {
      alert("Please capture and upload your check-in selfie before checking in.");
      setSelfieType('checkin');
      setShowSelfieModal(true);
      return;
    }

    setIsCheckingIn(true);

    try {
      // Mark as checked in this session and start timer for UI feedback
      checkedInThisSession.current = true;
      setCheckInTimer(0);
      if (!checkInIntervalRef.current) {
        checkInIntervalRef.current = setInterval(() => {
          setCheckInTimer(prev => prev + 1);
        }, 1000);
      }
      const attendanceData = { 
        method: 'self-checkin',
        lateReason: currentReason ? currentReason.trim() : null
      };

      // Location is required for geofenced check-in
      if (!navigator.geolocation) {
        checkedInThisSession.current = false;
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
        setCheckInTimer(0);
        setIsCheckingIn(false);
        alert('Location access is not supported by your browser. Check-in requires location.');
        return;
      }

      const executeCheckIn = (locationData) => {
        api.post('/attendance/mark', { ...attendanceData, location: locationData })
          .then(response => {
            if (response.data) {
              setTodayAttendance(response.data);
              setIsCheckingIn(false);
              setActiveToast({ title: 'Attendance', message: 'Check-in successful!' });
            }
          })
          .catch(err => {
            checkedInThisSession.current = false;
            clearInterval(checkInIntervalRef.current);
            checkInIntervalRef.current = null;
            setCheckInTimer(0);
            setIsCheckingIn(false);
            const msg = err.response?.data?.message || '';
            if (msg.toLowerCase().includes('away') || msg.toLowerCase().includes('office')) {
              alert('You can only check in inside the office.');
            } else if (msg.toLowerCase().includes('late check-in reason') || msg.toLowerCase().includes('reason for checking in late')) {
              // Backend detected late check-in but frontend missed it — show the reason modal
              setSavedLateReason('');
              setLateReasonInput('');
              setShowLateReasonModal(true);
            } else {
              alert(msg || 'Failed to check in. Please try again.');
            }
          });
      };

      if (cachedLocation) {
        executeCheckIn(cachedLocation);
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const loc = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              address: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
            };
            executeCheckIn(loc);
          },
          (geoErr) => {
            checkedInThisSession.current = false;
            clearInterval(checkInIntervalRef.current);
            checkInIntervalRef.current = null;
            setCheckInTimer(0);
            setIsCheckingIn(false);
            alert('Please give permission for location to check in.');
          },
          { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
        );
      }
    } catch (error) {
      console.error('Error checking in:', error);
      checkedInThisSession.current = false;
      clearInterval(checkInIntervalRef.current);
      checkInIntervalRef.current = null;
      setCheckInTimer(0);
      setIsCheckingIn(false);
      const errMsg = error.response?.data?.message || '';
      if (errMsg.toLowerCase().includes('late check-in reason') || errMsg.toLowerCase().includes('reason for checking in late')) {
        setSavedLateReason('');
        setLateReasonInput('');
        setShowLateReasonModal(true);
      } else {
        alert(errMsg || 'Failed to check in. Please try again.');
      }
    }
  };

  const handleCheckOut = async (skipSelfieCheck = false) => {
    if (isCheckingOut) return;
    if (!skipSelfieCheck && !isCheckOutSelfieUploaded) {
      alert("Please capture and upload your check-out selfie before checking out.");
      setSelfieType('checkout');
      setShowSelfieModal(true);
      return;
    }

    setIsCheckingOut(true);

    try {
      // Stop timer and clear session flag
      checkedInThisSession.current = false;
      if (checkInIntervalRef.current) {
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
      }
      setCheckInTimer(0);

      if (!navigator.geolocation) {
        setIsCheckingOut(false);
        alert('Location access is not supported by your browser. Check-out requires location.');
        return;
      }

      const executeCheckOut = (locationData) => {
        api.post('/attendance/checkout', { location: locationData })
          .then(response => {
            if (response.data) {
              setTodayAttendance(response.data);
              setIsCheckingOut(false);
              setActiveToast({ title: 'Attendance', message: `Checkout successful! Working Hours: ${response.data.workingHours} hrs` });
            }
          })
          .catch(err => {
            setIsCheckingOut(false);
            const msg = err.response?.data?.message || '';
            if (msg.toLowerCase().includes('away') || msg.toLowerCase().includes('office')) {
              alert('You can only check out inside the office.');
            } else {
              alert(msg || 'Failed to check out. Please try again.');
            }
          });
      };

      if (cachedLocation) {
        executeCheckOut(cachedLocation);
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const loc = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              address: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
            };
            executeCheckOut(loc);
          },
          (error) => {
            console.error('Geolocation error:', error);
            setIsCheckingOut(false);
            alert('Please give permission for location to check out.');
          },
          { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
        );
      }
    } catch (error) {
      console.error('Error checking out:', error);
      setIsCheckingOut(false);
      alert('Failed to check out. Please try again.');
    }
  };

  const handleOpenBreakModal = () => {
    const takenBreakTypes = (todayAttendance?.breaks || []).map(b => b.breakType);
    const disabledBreakOptions = [];
    if (takenBreakTypes.includes('1st Refreshment Break')) disabledBreakOptions.push('1st Refreshment Break');
    if (takenBreakTypes.includes('2nd Refreshment Break')) disabledBreakOptions.push('2nd Refreshment Break');
    if (takenBreakTypes.includes('Lunch Break')) disabledBreakOptions.push('Lunch Break');
    
    const refCount = takenBreakTypes.filter(t => t === 'Tea Break' || t === 'Refreshment Break' || t === '1st Refreshment Break' || t === '2nd Refreshment Break').length;
    if (refCount >= 2) {
      if (!disabledBreakOptions.includes('1st Refreshment Break')) disabledBreakOptions.push('1st Refreshment Break');
      if (!disabledBreakOptions.includes('2nd Refreshment Break')) disabledBreakOptions.push('2nd Refreshment Break');
    } else if (refCount === 1 && !takenBreakTypes.includes('1st Refreshment Break') && !takenBreakTypes.includes('2nd Refreshment Break')) {
      disabledBreakOptions.push('1st Refreshment Break');
    }

    const availableType = ['1st Refreshment Break', 'Lunch Break', '2nd Refreshment Break', 'Briefing/Meeting'].find(opt => !disabledBreakOptions.includes(opt)) || 'Briefing/Meeting';
    setBreakForm({ type: availableType, reason: '' });
    setShowBreakModal(true);
  };

  const handleBreakStart = async (e) => {
    setHideBreakScreen(false);
    e.preventDefault();
    if ((breakForm.type === 'Briefing/Meeting' || breakForm.type === 'Breifing/Meeting' || breakForm.type === 'Other') && !breakForm.reason.trim()) {
      alert('Please enter a reason for the Briefing/Meeting.');
      return;
    }
    try {
      const response = await api.post('/attendance/break/start', {
        breakType: breakForm.type,
        reason: breakForm.reason
      });
      if (response.data?.break) {
        setActiveBreak(response.data.break);
        setShowBreakModal(false);
        setBreakForm({ type: '1st Refreshment Break', reason: '' });
        await fetchTodayAttendance();
      }
    } catch (error) {
      console.error('Error starting break:', error);
      const msg = error.response?.data?.message || '';
      alert(msg || 'Failed to start break. Please try again.');
      if (error.response?.status === 400) {
        setShowBreakModal(false);
      }
    }
  };

  const handleBreakEnd = async () => {
    try {
      const response = await api.post('/attendance/break/end');
      if (response.data) {
        if (breakAudioRef.current) {
          breakAudioRef.current.pause();
          breakAudioRef.current.currentTime = 0;
          breakAudioRef.current = null;
        }
        setActiveBreak(null);
        setBreakTimer(0);
        if (breakIntervalRef.current) {
          clearInterval(breakIntervalRef.current);
          breakIntervalRef.current = null;
        }
        await fetchTodayAttendance();
      }
    } catch (error) {
      console.error('Error ending break:', error);
      alert(error.response?.data?.message || 'Failed to end break. Please try again.');
    }
  };

  // Timer & Alarm: active break duration
  useEffect(() => {
    if (activeBreak && !activeBreak.endTime) {
      const updateTimer = () => {
        const elapsed = Math.floor((Date.now() - new Date(activeBreak.startTime).getTime()) / 1000);
        setBreakTimer(elapsed);

        // Only enforce limit on standard breaks (Lunch / Refreshment), ignore 'Other' breaks
        if (activeBreak.breakType === 'Other') return;

        // Calculate past completed standard breaks taken today
        let pastStandardBreakSecs = 0;
        if (todayAttendance?.breaks) {
          todayAttendance.breaks.forEach(b => {
            if (b.breakType === 'Other') return;
            // Skip the current active break in the array to avoid double-counting
            if (b.startTime === activeBreak.startTime && !b.endTime) return;
            if (b.duration) {
              pastStandardBreakSecs += b.duration * 60;
            } else if (b.startTime && b.endTime) {
              pastStandardBreakSecs += Math.max(0, Math.floor((new Date(b.endTime) - new Date(b.startTime)) / 1000));
            }
          });
        }

        const totalUsedSecs = pastStandardBreakSecs + elapsed;
        const limitMins = breakLimits?.totalBreakLimit || 60;
        const limitSecs = limitMins * 60;

        if (totalUsedSecs > limitSecs) {
          if (!breakAudioRef.current) {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
            const soundUrl = isMac ? '/sounds/BreakAlarm.m4r' : '/sounds/BreakAlarm.mp3';
            const audio = new Audio(soundUrl);
            audio.loop = true;
            breakAudioRef.current = audio;
            audio.play().catch(err => console.log('Browser blocked alarm playback until interaction:', err));
          }
        }
      };
      updateTimer();
      if (!breakIntervalRef.current) {
        breakIntervalRef.current = setInterval(updateTimer, 1000);
      }
    } else {
      setBreakTimer(0);
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
        breakIntervalRef.current = null;
      }
      if (breakAudioRef.current) {
        breakAudioRef.current.pause();
        breakAudioRef.current.currentTime = 0;
        breakAudioRef.current = null;
      }
    }
    return () => {
      if (breakIntervalRef.current) {
        clearInterval(breakIntervalRef.current);
        breakIntervalRef.current = null;
      }
      if (breakAudioRef.current) {
        breakAudioRef.current.pause();
        breakAudioRef.current.currentTime = 0;
        breakAudioRef.current = null;
      }
    };
  }, [activeBreak, breakLimits]);

  const fetchPersonalAttendance = async () => {
    try {
      const response = await api.get('/attendance/my-stats');
      if (response.data) {
        setPersonalAttendance({
          presentDays: response.data.presentDays || 0,
          absentDays: response.data.absentDays || 0,
          halfDays: response.data.halfDays || 0,
          lateMarks: response.data.lateMarks || 0
        });
      }
    } catch (error) {
      console.error('Error fetching personal attendance:', error);
      setPersonalAttendance({
        presentDays: 0,
        absentDays: 0,
        halfDays: 0,
        lateMarks: 0
      });
    }
  };

  const fetchMonthlyStats = async () => {
    try {
      const response = await api.get('/attendance/monthly-stats');
      if (response.data) {
        setMonthlyStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching monthly stats:', error);
      setMonthlyStats({
        currentMonth: {
          present: 0,
          absent: 0,
          halfDay: 0,
          assignedProjects: 0,
          completedProjects: 0,
          totalLeaves: 0
        },
        lastMonth: {
          present: 0,
          absent: 0,
          halfDay: 0,
          assignedProjects: 0,
          completedProjects: 0,
          totalLeaves: 0
        },
        trends: {
          present: 0,
          absent: 0,
          assignedProjects: 0,
          completedProjects: 0,
          totalLeaves: 0
        }
      });
    }
  };

  const fetchDepartmentDistribution = async () => {
    try {
      const response = await api.get('/employees');
      if (!response.data || response.data.length === 0) {
        setDepartmentDistribution({ departments: [], employeeCounts: [] });
        return;
      }

      const employees = response.data;

      // Dynamically group employees by their actual department
      const departmentMap = {};

      employees.forEach(emp => {
        let dept = emp.department || 'Unassigned';

        // Filter out email addresses and invalid department names
        if (dept.includes('@') || dept.trim() === '') {
          dept = 'Unassigned';
        }

        departmentMap[dept] = (departmentMap[dept] || 0) + 1;
      });

      // Sort departments by employee count (descending) and take top 8
      const sortedDepartments = Object.entries(departmentMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)  // Limit to top 8 departments
        .reduce((acc, [dept, count]) => {
          acc.departments.push(dept);
          acc.counts.push(count);
          return acc;
        }, { departments: [], counts: [] });

      setDepartmentDistribution({
        departments: sortedDepartments.departments,
        employeeCounts: sortedDepartments.counts
      });
    } catch (error) {
      console.error('Error fetching department distribution:', error);
      setDepartmentDistribution({ departments: [], employeeCounts: [] });
    }
  };

  const renderChart = () => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');

    // Destroy existing chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Load Chart.js dynamically
    if (window.Chart) {
      chartInstance.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: departmentDistribution.departments,
          datasets: [
            {
              label: 'Number of Employees',
              data: departmentDistribution.employeeCounts,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderWidth: 3,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#3b82f6',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 6,
              pointHoverRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: {
                size: 14,
                weight: '600'
              },
              bodyFont: {
                size: 13
              },
              cornerRadius: 8,
              callbacks: {
                label: function (context) {
                  return 'Employees: ' + context.parsed.y;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font: {
                  size: 11
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              ticks: {
                font: {
                  size: 10,
                  weight: '500'
                },
                maxRotation: 45,
                minRotation: 45,
                autoSkip: false
              },
              grid: {
                display: false
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });
    }
  };

  const renderPersonalAttendanceChart = () => {
    if (!personalAttendanceChartRef.current) return;

    const ctx = personalAttendanceChartRef.current.getContext('2d');

    if (personalAttendanceChartInstance.current) {
      personalAttendanceChartInstance.current.destroy();
    }

    if (window.Chart) {
      personalAttendanceChartInstance.current = new window.Chart(ctx, {
        type: 'line',
        data: {
          labels: ['Present Days', 'Absent Days', 'Half Days', 'Late Marks'],
          datasets: [
            {
              label: 'Number of Days',
              data: [
                personalAttendance.presentDays,
                personalAttendance.absentDays,
                personalAttendance.halfDays,
                personalAttendance.lateMarks
              ],
              borderColor: '#a8e63d',
              backgroundColor: 'rgba(168, 230, 61, 0.15)',
              borderWidth: 3,
              tension: 0.4,
              fill: true,
              pointBackgroundColor: ['#166534', '#15803d', '#16a34a', '#4ade80'],
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 8,
              pointHoverRadius: 10
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 12,
              titleFont: {
                size: 14,
                weight: '600'
              },
              bodyFont: {
                size: 13
              },
              cornerRadius: 8,
              callbacks: {
                label: function (context) {
                  return 'Days: ' + context.parsed.y;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font: {
                  size: 11
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              ticks: {
                font: {
                  size: 11,
                  weight: '500'
                }
              },
              grid: {
                display: false
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });
    }
  };

  const fetchWeeklyAnalytics = async () => {
    try {
      const [goals, employees, projects] = await Promise.all([
        api.get('/goals').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] }))
      ]);

      const goalsData = Array.isArray(goals.data) ? goals.data : [];
      const employeesData = Array.isArray(employees.data) ? employees.data : [];
      const projectsData = Array.isArray(projects.data) ? projects.data : [];

      const daysData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const goalsCompletedData = [];
      const completedProjectsData = [];
      const newJoiningData = [];
      const upcomingDeadlinesData = [];

      const today = new Date();
      const currentDay = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(monday);
        dayDate.setDate(monday.getDate() + i);
        const dayStart = new Date(dayDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayDate);
        dayEnd.setHours(23, 59, 59, 999);

        // Count TOTAL goals completed on this day (across all documents)
        let totalCompletedGoals = 0;
        goalsData.forEach(g => {
          g.goals?.forEach(item => {
            if (item.isCompleted && item.completedAt) {
              const completedDate = new Date(item.completedAt);
              if (completedDate >= dayStart && completedDate <= dayEnd) {
                totalCompletedGoals++;
              }
            }
          });
        });

        // Count projects completed on this day
        const completedProjectsCount = projectsData.filter(p => {
          if (p.status === 'completed' && p.updatedAt) {
            const completedDate = new Date(p.updatedAt);
            return completedDate >= dayStart && completedDate <= dayEnd;
          }
          return false;
        }).length;

        // Count new joinings on this day
        const newJoins = employeesData.filter(e => {
          const joiningDate = new Date(e.joiningDate || e.createdAt);
          return joiningDate >= dayStart && joiningDate <= dayEnd;
        }).length;

        // Count projects with deadlines on THIS specific day
        const upcomingProjects = projectsData.filter(p => {
          if (p.deadline) {
            const deadline = new Date(p.deadline);
            deadline.setHours(0, 0, 0, 0);
            return deadline.getTime() === dayStart.getTime();
          }
          return false;
        }).length;

        goalsCompletedData.push(totalCompletedGoals);
        completedProjectsData.push(completedProjectsCount);
        newJoiningData.push(newJoins);
        upcomingDeadlinesData.push(upcomingProjects);
      }

      setWeeklyAnalytics({
        days: daysData,
        goalsCompleted: goalsCompletedData,
        completedProjects: completedProjectsData,
        newJoining: newJoiningData,
        upcomingDeadlines: upcomingDeadlinesData
      });
    } catch (error) {
      console.error('Error fetching weekly analytics:', error);
      setWeeklyAnalytics({
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        goalsCompleted: [0, 0, 0, 0, 0, 0, 0],
        completedProjects: [0, 0, 0, 0, 0, 0, 0],
        newJoining: [0, 0, 0, 0, 0, 0, 0],
        upcomingDeadlines: [0, 0, 0, 0, 0, 0, 0]
      });
    }
  };

  const renderWeeklyChart = () => {
    if (!weeklyChartRef.current) return;

    const ctx = weeklyChartRef.current.getContext('2d');

    if (weeklyChartInstance.current) {
      weeklyChartInstance.current.destroy();
    }

    if (window.Chart) {
      weeklyChartInstance.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: weeklyAnalytics.days,
          datasets: [
            {
              label: 'Goals Completed',
              data: weeklyAnalytics.goalsCompleted,
              backgroundColor: '#3b82f6',
              borderRadius: 4,
              barThickness: 15
            },
            {
              label: 'Completed Project',
              data: weeklyAnalytics.completedProjects,
              backgroundColor: '#a855f7',
              borderRadius: 4,
              barThickness: 15
            },
            {
              label: 'New Joinings',
              data: weeklyAnalytics.newJoining,
              backgroundColor: '#f59e0b',
              borderRadius: 4,
              barThickness: 15
            },
            {
              label: 'Upcoming Deadlines',
              data: weeklyAnalytics.upcomingDeadlines,
              backgroundColor: '#10b981',
              borderRadius: 4,
              barThickness: 15
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                padding: 10,
                boxWidth: 12,
                font: {
                  size: 10,
                  weight: '600'
                },
                usePointStyle: true
              }
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: 10,
              titleFont: {
                size: 12,
                weight: '600'
              },
              bodyFont: {
                size: 11
              },
              cornerRadius: 6
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                font: {
                  size: 10
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              ticks: {
                font: {
                  size: 10
                }
              },
              grid: {
                display: false
              }
            }
          }
        }
      });
    }
  };

  const fetchStats = async () => {
    try {
      const isSales = user?.role?.name === 'Sales';
      const [broadcasts, goals, assets, leaves, employees, projects, requests, attendanceStats, myLeads, metaLeads] = await Promise.all([
        api.get('/broadcasts').catch(() => ({ data: [] })),
        api.get('/goals').catch(() => ({ data: [] })),
        api.get('/assets').catch(() => ({ data: [] })),
        api.get('/leaves').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/requests').catch(() => ({ data: [] })),
        api.get('/attendance/today-stats').catch(() => ({ data: { presentToday: 0, absentToday: 0 } })),
        isSales ? api.get('/lead-assignments/my-leads').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        isSales ? api.get('/meta-leads?limit=500').catch(() => ({ data: { leads: [] } })) : Promise.resolve({ data: { leads: [] } })
      ]);

      // Count today's assigned leads for Sales role (both Excel + Meta sources)
      let todayLeadsCount = 0;
      if (isSales) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);

        // Excel leads — filter by createdAt (assignment creation date)
        if (Array.isArray(myLeads.data)) {
          todayLeadsCount += myLeads.data.filter(lead => {
            const d = new Date(lead.createdAt);
            return d >= today && d <= endOfDay;
          }).length;
        }

        // Meta leads — check history for assignment that happened today
        const metaArr = metaLeads.data?.leads || metaLeads.data || [];
        if (Array.isArray(metaArr)) {
          todayLeadsCount += metaArr.filter(lead => {
            // Check if this lead was assigned today via history entries
            if (Array.isArray(lead.history)) {
              return lead.history.some(h => {
                const hDate = new Date(h.date);
                return (h.action === 'Assignment Update' || h.action === 'Assignment') &&
                  hDate >= today && hDate <= endOfDay;
              });
            }
            // Fallback: if no history, check updatedAt (covers fresh assignments)
            const d = new Date(lead.updatedAt || lead.createdAt);
            return d >= today && d <= endOfDay;
          }).length;
        }
      }

      // Calculate stats from actual API data
      const activeEmployees = employees.data.filter(emp => emp.isActive === true || emp.status === 'active');

      // Check if user is admin
      const isAdmin = user?.role?.permissions?.some(
        p => p.module === 'employees' && p.actions.includes('update')
      );

      // Filter active projects based on user role
      let activeProjects;
      if (isAdmin) {
        // Admin sees all active projects
        activeProjects = projects.data.filter(proj => proj.status === 'active' || proj.status === 'on-hold');
      } else {
        // Employee sees only their assigned projects
        activeProjects = projects.data.filter(proj => {
          const isActive = proj.status === 'active' || proj.status === 'on-hold';
          const isAssigned = proj.assignedEmployees?.some(emp => emp._id === user._id || emp === user._id) ||
            proj.createdBy?._id === user._id || proj.createdBy === user._id;
          return isActive && isAssigned;
        });
      }

      const goalsInProgress = goals.data.filter(g => {
        const completedGoals = g.goals?.filter(item => item.isCompleted).length || 0;
        const totalGoals = g.goals?.length || 0;
        return completedGoals < totalGoals && totalGoals > 0;
      });
      const pendingApprovals = [
        ...leaves.data.filter(l => l.status === 'pending'),
        ...requests.data.filter(r => r.status === 'pending')
      ];

      setStats({
        broadcasts: broadcasts.data.length || 0,
        goals: goals.data.length || 0,
        assets: assets.data.length || 0,
        pendingLeaves: leaves.data.filter(l => l.status === 'pending').length || 0,
        rejectedLeaves: leaves.data.filter(l => l.status === 'rejected').length || 0,
        approvedLeaves: leaves.data.filter(l => l.status === 'approved').length || 0,
        totalEmployees: employees.data.length || 0,
        activeEmployees: activeEmployees.length || 0,
        activeProjects: activeProjects.length || 0,
        goalsInProgress: goalsInProgress.length || 0,
        pendingApprovals: pendingApprovals.length || 0,
        presentToday: attendanceStats.data.presentToday || 0,
        absentToday: attendanceStats.data.absentToday || 0,
        completedProjects: projects.data.filter(p => p.status === 'completed').length || 0,
        upcomingDeadlines: projects.data.filter(p => {
          if (p.deadline && p.status !== 'completed') {
            const d = new Date(p.deadline);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);
            return d >= today && d <= endOfDay;
          }
          return false;
        }).length || 0,
        todayLeads: todayLeadsCount
      });

      // Get recent 5 leaves sorted by date
      const sortedLeaves = [...leaves.data].sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
      setRecentLeaves(sortedLeaves.slice(0, 5));

      // Get recent 5 goals sorted by date
      // Flatten individual tasks from all goal documents
      // Non-admin employees only see their own goals
      const currentUserId = user?._id;
      const isAdminUser = user?.role?.permissions?.some(
        p => p.module === 'employees' && p.actions.includes('update')
      );
      const flatTasks = [];
      goals.data.forEach(goalDoc => {
        // For non-admin: only include goals where createdBy matches the current user
        if (!isAdminUser) {
          const creatorId = goalDoc.createdBy?._id || goalDoc.createdBy;
          if (String(creatorId) !== String(currentUserId)) return;
        }
        (goalDoc.goals || []).forEach((task, i) => {
          flatTasks.push({
            _id: `${goalDoc._id}-${i}`,
            name: task.name,
            createdBy: goalDoc.createdBy,
            createdAt: goalDoc.createdAt,
            isCompleted: task.isCompleted
          });
        });
      });
      flatTasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRecentGoals(flatTasks.slice(0, 5));

    } catch (error) {
      console.error('Error fetching stats:', error);
      // Set default values on error
      setStats({
        broadcasts: 0,
        goals: 0,
        assets: 0,
        pendingLeaves: 0,
        totalEmployees: 0,
        activeEmployees: 0,
        activeProjects: 0,
        goalsInProgress: 0,
        pendingApprovals: 0,
        presentToday: 0,
        absentToday: 0,
        rejectedLeaves: 0,
        approvedLeaves: 0
      });
    }
  };

  const attendanceStatus = todayAttendance
    ? (todayAttendance.logoutTime
      ? (todayAttendance.status === 'present' ? 'Present'
        : todayAttendance.status === 'half-day' ? 'Half Day'
          : 'Absent')
      : (todayAttendance.status === 'late-checkin' ? 'Late Check-in' : todayAttendance.status === 'early-checkin' ? 'Early Check-in' : 'Checked In'))
    : 'Not Logged In';
  const userInitials = `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() || 'EM';
  const employeeRecentActivities = recentActivities.slice(0, 4);
  const employeeRecentLeaves = recentLeaves.slice(0, 4);

  // Maps activity.type → { Icon, accent color, tinted bg }
  const getActivityMeta = (type) => {
    switch (type) {
      case 'leave': return { Icon: CalendarDays, color: '#0ea5e9', bg: '#f0f9ff' };
      case 'goal': return { Icon: Target, color: '#8b5cf6', bg: '#faf5ff' };
      case 'request': return { Icon: ClipboardList, color: '#f59e0b', bg: '#fffbeb' };
      case 'broadcast': return { Icon: Megaphone, color: '#ec4899', bg: '#fdf2f8' };
      case 'joining': return { Icon: Users, color: '#10b981', bg: '#f0fdf4' };
      case 'attendance': return { Icon: Clock, color: '#6366f1', bg: '#eef2ff' };
      default: return { Icon: CheckCircle2, color: '#64748b', bg: '#f8fafc' };
    }
  };

  // Trend calculation functions (matching Clients page pattern)
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  const getTrendDirection = (current, previous) => {
    return current >= previous;
  };

  // Calculate trend changes
  const presentChange = calculateChange(monthlyStats.currentMonth.present, monthlyStats.lastMonth.present);
  const absentChange = calculateChange(monthlyStats.currentMonth.absent, monthlyStats.lastMonth.absent);
  const projectsChange = calculateChange(monthlyStats.currentMonth.assignedProjects, monthlyStats.lastMonth.assignedProjects);
  const completedChange = calculateChange(monthlyStats.currentMonth.completedProjects, monthlyStats.lastMonth.completedProjects);
  const leavesChange = calculateChange(monthlyStats.currentMonth.totalLeaves, monthlyStats.lastMonth.totalLeaves);

  // Get trend directions
  const presentTrend = getTrendDirection(monthlyStats.currentMonth.present, monthlyStats.lastMonth.present);
  const absentTrend = getTrendDirection(monthlyStats.currentMonth.absent, monthlyStats.lastMonth.absent);
  const projectsTrend = getTrendDirection(monthlyStats.currentMonth.assignedProjects, monthlyStats.lastMonth.assignedProjects);
  const completedTrend = getTrendDirection(monthlyStats.currentMonth.completedProjects, monthlyStats.lastMonth.completedProjects);
  const leavesTrend = getTrendDirection(monthlyStats.currentMonth.totalLeaves, monthlyStats.lastMonth.totalLeaves);

  const employeeHighlights = [
    {
      label: 'Total Present',
      value: monthlyStats.currentMonth.present || 0,
      icon: CheckCheck,
      tone: 'emerald',
      sub: 'this month',
      trend: presentChange,
      isUp: presentTrend
    },
    {
      label: 'Total Absent',
      value: monthlyStats.currentMonth.absent || 0,
      icon: XCircle,
      tone: 'rose',
      sub: 'this month',
      trend: absentChange,
      isUp: absentTrend
    },
    {
      label: 'Assigned Projects',
      value: monthlyStats.currentMonth.assignedProjects || 0,
      icon: FolderOpen,
      tone: 'sky',
      sub: 'active',
      trend: projectsChange,
      isUp: projectsTrend
    },
    {
      label: 'Completed Projects',
      value: monthlyStats.currentMonth.completedProjects || 0,
      icon: CheckCircle2,
      tone: 'violet',
      sub: 'this month',
      trend: completedChange,
      isUp: completedTrend
    },
    {
      label: 'Total Leaves',
      value: monthlyStats.currentMonth.totalLeaves || 0,
      icon: Umbrella,
      tone: 'amber',
      sub: 'this month',
      trend: leavesChange,
      isUp: leavesTrend
    },
  ];
  const employeeSupportStats = [
    { label: 'Approved Leaves', value: stats.approvedLeaves || 0, icon: Hourglass, tone: 'emerald' },
    { label: 'Pending Leaves', value: stats.pendingLeaves || 0, icon: Umbrella, tone: 'violet' },
    { label: 'Rejected Leaves', value: stats.rejectedLeaves || 0, icon: XCircle, tone: 'rose' },
  ];
  const formatActivityDate = (timestamp) => {
    if (!timestamp) return 'No timestamp';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderActiveBreakScreen = () => {
    if (!activeBreak || hideBreakScreen) return null;
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'rgba(255, 255, 255, 0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 0.4s ease'
      }}>

        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '24px', opacity: 0.8 }}>
            <Clock size={40} color="#334155" strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: '26px', color: '#0f172a', margin: '0 0 6px 0', fontWeight: 600, letterSpacing: '-0.3px' }}>On Break</h1>
          <p style={{ fontSize: '15px', color: '#475569', margin: '0 0 36px 0', fontWeight: 500 }}>{activeBreak.type === 'Tea Break' ? 'Refreshment Break' : activeBreak.type}</p>
          
          <div style={{ 
            fontSize: '64px', 
            fontWeight: '300', 
            color: '#0f172a', 
            fontVariantNumeric: 'tabular-nums', 
            margin: '0 0 44px 0', 
            letterSpacing: '-1.5px'
          }}>
             {new Date(breakTimer * 1000).toISOString().substr(11, 8)}
          </div>
          
          <button 
             onClick={() => setHideBreakScreen(true)}
             style={{ padding: '12px 40px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)', transition: 'all 0.2s ease' }}
             onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(245, 158, 11, 0.35)'; e.currentTarget.style.background = '#d97706'; }}
             onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.25)'; e.currentTarget.style.background = '#f59e0b'; }}
          >
             Resume Work
          </button>
        </div>
      </div>
    );
  };

  const renderBreakModal = () => {
    if (!showBreakModal) return null;

    let totalBreakMinsTaken = 0;
    if (todayAttendance?.breaks) {
      todayAttendance.breaks.forEach(b => {
        if (b.breakType !== 'Other' && b.breakType !== 'Briefing/Meeting' && b.breakType !== 'Breifing/Meeting') {
          const dur = b.duration !== undefined ? b.duration : Math.max(0, Math.floor((Date.now() - new Date(b.startTime).getTime()) / 60000));
          totalBreakMinsTaken += dur;
        }
      });
    }
    const limitMins = breakLimits?.totalBreakLimit || 60;
    const isLimitExceeded = totalBreakMinsTaken >= limitMins;

    const takenBreakTypes = (todayAttendance?.breaks || []).map(b => b.breakType);
    const disabledBreakOptions = [];
    if (takenBreakTypes.includes('1st Refreshment Break')) disabledBreakOptions.push('1st Refreshment Break');
    if (takenBreakTypes.includes('2nd Refreshment Break')) disabledBreakOptions.push('2nd Refreshment Break');
    if (takenBreakTypes.includes('Lunch Break')) disabledBreakOptions.push('Lunch Break');
    
    const refCount = takenBreakTypes.filter(t => t === 'Tea Break' || t === 'Refreshment Break' || t === '1st Refreshment Break' || t === '2nd Refreshment Break').length;
    if (refCount >= 2) {
      if (!disabledBreakOptions.includes('1st Refreshment Break')) disabledBreakOptions.push('1st Refreshment Break');
      if (!disabledBreakOptions.includes('2nd Refreshment Break')) disabledBreakOptions.push('2nd Refreshment Break');
    } else if (refCount === 1 && !takenBreakTypes.includes('1st Refreshment Break') && !takenBreakTypes.includes('2nd Refreshment Break')) {
      disabledBreakOptions.push('1st Refreshment Break');
    }

    const availableType = ['1st Refreshment Break', 'Lunch Break', '2nd Refreshment Break', 'Briefing/Meeting'].find(opt => !disabledBreakOptions.includes(opt)) || 'Briefing/Meeting';

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 16px 48px rgba(15,23,42,0.18)', padding: '28px', width: '520px', maxWidth: '92vw' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Take a Break</h3>

          {breakForm.type !== 'Other' && breakForm.type !== 'Briefing/Meeting' && breakForm.type !== 'Breifing/Meeting' && isLimitExceeded && (
            <div style={{ background: '#fffbe8', border: '1px solid #ffe58f', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertTriangle size={18} style={{ color: '#d48806', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', color: '#8c5900', lineHeight: '1.45' }}>
                <strong>Break Limit Reached!</strong><br />
                Your allotted break time ({limitMins} mins) is fully taken. If you exceed the limit, it will be deducted from your working hours.
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Break Type <span style={{ color: '#ef4444' }}>*</span></label>
            <BreakDropdown
              value={breakForm.type}
              onChange={val => setBreakForm({ ...breakForm, type: val })}
              disabledOptions={disabledBreakOptions}
            />
          </div>
          {(breakForm.type === 'Briefing/Meeting' || breakForm.type === 'Breifing/Meeting' || breakForm.type === 'Other') && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Reason <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                value={breakForm.reason}
                onChange={e => setBreakForm({ ...breakForm, reason: e.target.value })}
                placeholder="Enter briefing agenda / meeting details..."
                rows="3"
                style={{ width: '100%', padding: '12px 14px', fontSize: '14px', border: '1px solid #e2e8f0', borderRadius: '10px', outline: 'none', resize: 'vertical' }}
                required
              />
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '28px' }}>
            <button
              onClick={() => { setShowBreakModal(false); setBreakForm({ type: availableType, reason: '' }); }}
              style={{ padding: '10px 22px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '10px', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
            >
              Cancel
            </button>
            <button
              onClick={handleBreakStart}
              style={{ padding: '10px 22px', border: 'none', background: '#f59e0b', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 2px 8px rgba(245,158,11,0.25)' }}
            >
              Start Break
            </button>
          </div>
        </div>
      </div>
    );
  };

  const formatDurationHMS = (seconds) => {
    const s = Math.max(0, Math.floor(seconds || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const renderBreakDetailsModal = () => {
    if (!breakDetailsModal.visible) return null;
    const { breaks } = breakDetailsModal;

    let totalBreakSecs = 0;
    if (breaks) {
      breaks.forEach(b => {
        if (b.breakType !== 'Other' && b.breakType !== 'Briefing/Meeting' && b.breakType !== 'Breifing/Meeting') {
          const startMs = new Date(b.startTime).getTime();
          const endMs = b.endTime ? new Date(b.endTime).getTime() : Date.now();
          const sec = Math.max(0, Math.floor((endMs - startMs) / 1000));
          totalBreakSecs += sec;
        }
      });
    }
    const limitMins = breakLimits?.totalBreakLimit || 60;
    const limitSecs = limitMins * 60;
    const remainingSecs = Math.max(0, limitSecs - totalBreakSecs);

    const ref1Schedule = shiftConfig?.allowRefreshment1Anytime
      ? 'Anytime'
      : (shiftConfig?.refreshment1StartTime && shiftConfig?.refreshment1EndTime
        ? `${shiftConfig.refreshment1StartTime} - ${shiftConfig.refreshment1EndTime}`
        : (shiftConfig?.teaTime || 'N/A'));

    const lunchSchedule = shiftConfig?.allowLunchAnytime
      ? 'Anytime'
      : (shiftConfig?.lunchStartTime && shiftConfig?.lunchEndTime
        ? `${shiftConfig.lunchStartTime} - ${shiftConfig.lunchEndTime}`
        : (shiftConfig?.lunchTime || 'N/A'));

    const ref2Schedule = shiftConfig?.allowRefreshment2Anytime
      ? 'Anytime'
      : (shiftConfig?.refreshment2StartTime && shiftConfig?.refreshment2EndTime
        ? `${shiftConfig.refreshment2StartTime} - ${shiftConfig.refreshment2EndTime}`
        : 'N/A');

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 16px 48px rgba(15,23,42,0.18)', padding: '26px', width: '840px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={19} strokeWidth={2} />
              </div>
              <h3 style={{ margin: '0', fontSize: '19px', fontWeight: 700, color: '#0f172a' }}>Break Details</h3>
            </div>
            <button onClick={() => setBreakDetailsModal({ visible: false, type: '', breaks: [] })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
              <XCircle size={22} />
            </button>
          </div>

          {/* Time Remaining & Taken Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', padding: '16px 20px', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Time Remaining</div>
              <div style={{ fontSize: '26px', color: remainingSecs === 0 ? '#ef4444' : '#0f172a', fontWeight: 800, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                {formatDurationHMS(remainingSecs)}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Limit: {limitMins} mins total</div>
            </div>
            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '20px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Time Taken</div>
              <div style={{ fontSize: '26px', color: '#059669', fontWeight: 800, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
                {formatDurationHMS(totalBreakSecs)}
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Format: HH:MM:SS</div>
            </div>
          </div>
          
          {/* Shift Break Schedule Pill Badges */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
              Shift Break Schedule & Allowed Timelines
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '4px 8px', background: '#fffbeb', borderRadius: '9999px', border: '1px solid #fde68a', boxShadow: '0 1px 2px rgba(245,158,11,0.05)', minWidth: 0 }}>
                <Coffee size={12} strokeWidth={2} style={{ color: '#d97706', flexShrink: 0 }} />
                <span style={{ fontSize: '10.5px', color: '#92400e', fontWeight: 600, letterSpacing: '0.2px', flexShrink: 0 }}>1st Ref:</span>
                <span style={{ fontSize: '11px', color: '#b45309', fontWeight: 500, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ref1Schedule}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '4px 8px', background: '#eff6ff', borderRadius: '9999px', border: '1px solid #bfdbfe', boxShadow: '0 1px 2px rgba(59,130,246,0.05)', minWidth: 0 }}>
                <Utensils size={12} strokeWidth={2} style={{ color: '#2563eb', flexShrink: 0 }} />
                <span style={{ fontSize: '10.5px', color: '#1e40af', fontWeight: 600, letterSpacing: '0.2px', flexShrink: 0 }}>Lunch:</span>
                <span style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 500, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lunchSchedule}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '4px 8px', background: '#faf5ff', borderRadius: '9999px', border: '1px solid #e9d5ff', boxShadow: '0 1px 2px rgba(168,85,247,0.05)', minWidth: 0 }}>
                <Coffee size={12} strokeWidth={2} style={{ color: '#9333ea', flexShrink: 0 }} />
                <span style={{ fontSize: '10.5px', color: '#6b21a8', fontWeight: 600, letterSpacing: '0.2px', flexShrink: 0 }}>2nd Ref:</span>
                <span style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 500, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ref2Schedule}</span>
              </div>
            </div>
          </div>

          {/* Break History List */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Today's Taken Breaks ({breaks?.length || 0})
            </div>
            {breaks && breaks.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '235px', overflowY: 'auto', paddingRight: '6px' }}>
                {breaks.map((b, idx) => {
                  const startMs = new Date(b.startTime).getTime();
                  const endMs = b.endTime ? new Date(b.endTime).getTime() : Date.now();
                  const durSecs = Math.max(0, Math.floor((endMs - startMs) / 1000));
                  const displayType = b.breakType === 'Tea Break' ? 'Refreshment Break' : b.breakType;
                  const isOngoing = !b.endTime;

                  return (
                    <div key={idx} style={{ padding: '14px 16px', background: isOngoing ? '#f0fdf4' : '#fff', borderRadius: '12px', border: isOngoing ? '1px solid #86efac' : '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 5px rgba(15,23,42,0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isOngoing ? '#22c55e' : '#94a3b8', flexShrink: 0, boxShadow: isOngoing ? '0 0 0 3px rgba(34,197,94,0.2)' : 'none' }}></div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{displayType}</span>
                            {isOngoing && (
                              <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase' }}>Active</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                            <Hourglass size={12} style={{ color: '#94a3b8' }} />
                            <span>{new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            <span>→</span>
                            <span>{b.endTime ? new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Ongoing'}</span>
                          </div>
                          {b.reason && (
                            <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '4px', fontStyle: 'italic' }}>
                              Reason: "{b.reason}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                          {formatDurationHMS(durSecs)}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94a3b8', fontWeight: 600 }}>duration</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                No breaks taken yet today.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              onClick={() => setBreakDetailsModal({ visible: false, type: '', breaks: [] })}
              style={{ padding: '9px 24px', border: 'none', background: '#10b981', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '13.5px', boxShadow: '0 2px 8px rgba(16,185,129,0.25)', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#059669'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#10b981'; }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  const getTotalBreakDurationString = () => {
    let totalSecs = 0;
    if (todayAttendance?.breaks) {
      todayAttendance.breaks.forEach(b => {
        if (b.breakType === 'Other') return;
        if (b.duration) {
          totalSecs += b.duration * 60;
        } else if (b.startTime && !b.endTime) {
          totalSecs += Math.floor((Date.now() - new Date(b.startTime).getTime()) / 1000);
        }
      });
    }
    if (activeBreak && activeBreak.breakType !== 'Other') {
      const inArray = todayAttendance?.breaks?.some(b => b.startTime === activeBreak.startTime);
      if (!inArray) {
        totalSecs += Math.floor((Date.now() - new Date(activeBreak.startTime).getTime()) / 1000);
      }
    }
    if (totalSecs === 0) return '0:00:00';
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  };

  // Sales role users get a dedicated sales dashboard
  if (isSalesRole) {
    return <SalesDashboard />;
  }

  if (!isAdmin) {
    return (
      <div className="dashboard-container employee-dashboard-shell">
        <div className="employee-dashboard-frame">
          <div className="employee-dashboard-grid">
            <aside className="employee-dashboard-sidebar">
              {loading ? (
                <>
                  <section className="employee-profile-card employee-skeleton-panel">
                    <div className="employee-profile-top">
                      <div className="employee-skeleton employee-skeleton-avatar" />
                      <div className="employee-profile-copy" style={{ width: '100%' }}>
                        <div className="employee-skeleton employee-skeleton-line sm" />
                        <div className="employee-skeleton employee-skeleton-line md" style={{ marginTop: '10px' }} />
                        <div className="employee-skeleton employee-skeleton-line sm" style={{ marginTop: '8px' }} />
                      </div>
                    </div>

                    <div className="employee-status-row">
                      <div className="employee-skeleton employee-skeleton-pill" />
                      <div className="employee-skeleton employee-skeleton-line sm" />
                    </div>

                    <div className="employee-profile-stats">
                      {[1, 2, 3, 4].map((item) => (
                        <div className="employee-profile-stat employee-skeleton-item" key={`profile-skeleton-${item}`}>
                          <div className="employee-skeleton employee-skeleton-line xs" />
                          <div className="employee-skeleton employee-skeleton-line lg" style={{ marginTop: '6px' }} />
                        </div>
                      ))}
                    </div>

                  </section>

                  {/* Activity skeleton */}
                  <div className="employee-skeleton-card" style={{ borderRadius: 14, padding: '18px 20px', background: '#fff', border: '1px solid #e2e8f0', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                      <div><div className="employee-skeleton employee-skeleton-line xs" style={{ width: 60 }} /><div className="employee-skeleton employee-skeleton-line md" style={{ marginTop: 8 }} /></div>
                      <div className="employee-skeleton" style={{ width: 50, height: 22, borderRadius: 999 }} />
                    </div>
                    {[1, 2, 3, 4].map(r => (
                      <div key={r} style={{ display: 'grid', gridTemplateColumns: '34px 1fr', gap: 12, marginBottom: 12 }}>
                        <div className="employee-skeleton" style={{ width: 34, height: 34, borderRadius: 10 }} />
                        <div>
                          <div className="employee-skeleton employee-skeleton-line sm" />
                          <div className="employee-skeleton employee-skeleton-line md" style={{ marginTop: 6 }} />
                        </div>
                      </div>
                    ))}
                  </div>

                </>
              ) : (
                <>
                  <section className="employee-profile-card">
                    <div className="employee-profile-top">
                      <div className="employee-avatar">{userInitials}</div>
                      <div className="employee-profile-copy">
                        <span className="employee-overline">Dashboard User</span>
                        <h1>{`${user?.firstName || 'Employee'} ${user?.lastName || ''}`.trim()}</h1>
                        <p>{user?.email || 'employee@company.com'}</p>
                      </div>
                    </div>


                    <div className="employee-status-row">
                      {todayAttendance ? (
                        todayAttendance.logoutTime ? (
                          <span className={`employee-status-pill ${attendanceStatus === 'Present' ? 'present' : attendanceStatus === 'Absent' ? 'offline' : 'present'}`}>
                            {attendanceStatus}
                          </span>
                        ) : (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleCheckOut()}
                              disabled={isCheckingOut}
                              className="employee-status-pill live"
                              style={{
                                cursor: isCheckingOut ? 'not-allowed' : 'pointer',
                                border: 'none',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: '#ef4444',
                                color: 'white',
                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                                opacity: isCheckingOut ? 0.7 : 1
                              }}
                              onMouseEnter={(e) => {
                                if (!isCheckingOut) {
                                  e.target.style.background = '#dc2626';
                                  e.target.style.transform = 'translateY(-1px)';
                                  e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isCheckingOut) {
                                  e.target.style.background = '#ef4444';
                                  e.target.style.transform = 'translateY(0)';
                                  e.target.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
                                }
                              }}
                            >
                              {isCheckingOut ? (
                                <><Loader2 size={14} className="spin-animation" /> Checking Out...</>
                              ) : (
                                <><LogIn size={14} style={{ transform: 'rotate(180deg)' }} /> Check Out</>
                              )}
                            </button>


                            {todayAttendance?.loginTime && !todayAttendance?.logoutTime && (
                              <span style={{ fontWeight: 600, color: 'white', fontSize: 13, background: 'rgba(255,255,255,0.18)', borderRadius: 8, padding: '2px 10px', border: '1px solid rgba(255,255,255,0.3)', marginLeft: 2, letterSpacing: '0.03em' }}>
                                {new Date(checkInTimer * 1000).toISOString().substr(11, 8)}
                              </span>
                            )}
                          </span>
                        )
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleCheckIn()}
                            disabled={isCheckingIn || isBeforeShiftStart()}
                            title={isBeforeShiftStart() ? `You can only check-in from ${user?.shiftStartTime}` : ''}
                            style={{
                              padding: '6px 16px',
                              fontSize: '13px',
                              fontWeight: '700',
                              background: '#a8e63d',
                              color: '#14532d',
                              border: '1.5px solid #a8e63d',
                              borderRadius: '999px',
                              cursor: (isCheckingIn || isBeforeShiftStart()) ? 'not-allowed' : 'pointer',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(168, 230, 61, 0.3)',
                              opacity: (isCheckingIn || isBeforeShiftStart()) ? 0.6 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (!isCheckingIn && !isBeforeShiftStart()) {
                                e.target.style.background = 'white';
                                e.target.style.color = '#a8e63d';
                                e.target.style.borderColor = '#a8e63d';
                                e.target.style.transform = 'translateY(-1px)';
                                e.target.style.boxShadow = '0 4px 12px rgba(168, 230, 61, 0.4)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isCheckingIn && !isBeforeShiftStart()) {
                                e.target.style.background = '#a8e63d';
                                e.target.style.color = '#14532d';
                                e.target.style.borderColor = '#a8e63d';
                                e.target.style.transform = 'translateY(0)';
                                e.target.style.boxShadow = '0 2px 8px rgba(168, 230, 61, 0.3)';
                              }
                            }}
                          >
                            {isCheckingIn ? (
                              <><Loader2 size={14} className="spin-animation" /> Checking In...</>
                            ) : (
                              <><LogIn size={14} /> Check In</>
                            )}
                          </button>
                          {todayAttendance?.loginTime && !todayAttendance?.logoutTime && (
                            <span style={{ fontWeight: 600, color: '#14532d', fontSize: 13, background: '#f3f4f6', borderRadius: 8, padding: '2px 10px', border: '1px solid #e5e7eb', marginLeft: 2 }}>
                              {new Date(checkInTimer * 1000).toISOString().substr(11, 8)}
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    <div className="employee-profile-stats">
                      <div className="employee-profile-stat">
                        <span>Login Time</span>
                        <strong>
                          {todayAttendance?.loginTime
                            ? new Date(todayAttendance.loginTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                            : '--:--'}
                        </strong>
                      </div>
                      <div className="employee-profile-stat">
                        <span>Working Hours</span>
                        <strong>{currentWorkingHours}</strong>
                      </div>
                      <div className="employee-profile-stat">
                        <span>Break Taken</span>
                        <strong>{getTotalBreakDurationString()}</strong>
                      </div>
                      <div className="employee-profile-stat">
                        <span>Today Status</span>
                        <strong style={{ fontSize: '12px' }}>
                          {todayAttendance
                            ? (todayAttendance.logoutTime
                              ? (todayAttendance.status === 'present' ? 'Present' : todayAttendance.status === 'half-day' ? 'Half Day' : 'Absent')
                              : (todayAttendance.status === 'late-checkin' ? 'Late Check-in' : todayAttendance.status === 'early-checkin' ? 'Early Check-in' : 'Checked In'))
                            : 'Not Logged'}
                        </strong>
                      </div>
                    </div>
                  </section>

                  {/* Recent Activity card */}
                  <section className="employee-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div className="employee-card-head">
                      <div>
                        <span className="employee-overline dark">Timeline</span>
                        <h3>Recent Activity</h3>
                      </div>
                      <span className="employee-panel-badge">{employeeRecentActivities.length} items</span>
                    </div>
                    <div className="employee-activity-list" style={{ flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
                      {employeeRecentActivities.length > 0 ? (
                        employeeRecentActivities.map((activity, index) => {
                          const { Icon, color, bg } = getActivityMeta(activity.type);
                          return (
                            <div key={index} style={{
                              display: 'flex', alignItems: 'flex-start', gap: '10px',
                              padding: '9px 11px', marginBottom: '7px',
                              borderRadius: '9px', background: bg,
                              border: `1px solid ${color}22`,
                              borderLeft: `3px solid ${color}`
                            }}>
                              <div style={{
                                width: '30px', height: '30px', borderRadius: '7px',
                                background: `${color}15`, border: `1px solid ${color}28`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, marginTop: '1px'
                              }}>
                                <Icon size={14} color={color} strokeWidth={2} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginBottom: '2px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {activity.title || 'Activity'}
                                  </span>
                                  <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0, fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>
                                    {formatActivityDate(activity.timestamp)}
                                  </span>
                                </div>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4', fontFamily: "'Inter', sans-serif", wordBreak: 'break-word' }}>
                                  {activity.description || ''}
                                </p>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: '8px' }}>
                          <CheckCircle2 size={26} color='#cbd5e1' strokeWidth={1.5} />
                          <span style={{ fontSize: '11.5px', color: '#94a3b8', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>No recent activities</span>
                        </div>
                      )}
                    </div>
                  </section>

                </>
              )}
            </aside>

            <main className="employee-dashboard-main">
              <section className="employee-topbar-card">
                <div>
                  {loading ? (
                    <>
                      <div className="employee-skeleton employee-skeleton-line xs" />
                      <div className="employee-skeleton employee-skeleton-line md" style={{ marginTop: '8px', height: '30px' }} />
                    </>
                  ) : (
                    <>
                      <span className="employee-overline dark">Welcome, </span>
                      <h2>{`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Employee'}</h2>
                    </>
                  )}
                </div>
                <div className="employee-topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {loading ? (
                    <div className="employee-skeleton employee-skeleton-button" />
                  ) : (
                    <>
                      {/* Upload Selfie Button */}
                      <div
                        onClick={() => {
                          if (isCheckInSelfieUploaded && isCheckOutSelfieUploaded) {
                            setShowSelfieModal(true);
                            return;
                          }
                          if (!isCheckInSelfieUploaded && isBeforeShiftStart()) {
                            alert(`Check-in selfie upload is unavailable before your check-in window opens.\nWindow opens at: ${getCheckinWindowOpenTime()} (Shift starts: ${user?.shiftStartTime})`);
                            return;
                          }
                          if (!isCheckInSelfieUploaded && isLateCheckIn() && !savedLateReason) {
                            setShowLateReasonModal(true);
                            return;
                          }
                          // Geofence check for uploading new selfie
                          if (cachedLocation) {
                            const OFFICE_LAT = 28.62886;
                            const OFFICE_LNG = 77.38141;
                            const R = 6371e3; // Earth radius in meters
                            const dLat = (OFFICE_LAT - cachedLocation.latitude) * Math.PI / 180;
                            const dLon = (OFFICE_LNG - cachedLocation.longitude) * Math.PI / 180;
                            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                      Math.cos(cachedLocation.latitude * Math.PI / 180) * Math.cos(OFFICE_LAT * Math.PI / 180) *
                                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
                            const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            
                            if (distance > 50) {
                              setErrorToast(`Selfie upload is only allowed from the office. You are ${Math.round(distance)}m away.`);
                              return;
                            }
                          } else {
                            setErrorToast('Fetching location... Please wait a moment and try again.');
                            return;
                          }
                          setSelfieImage(null);
                          if (!isCheckInSelfieUploaded) {
                            setSelfieType('checkin');
                          } else {
                            setSelfieType('checkout');
                          }
                          setShowSelfieModal(true);
                        }}
                        style={{
                          background: (isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? '#dcfce7' : '#e0f2fe', 
                          color: (isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? '#166534' : '#0284c7', 
                          padding: '0 12px', height: '32px', borderRadius: '999px',
                          fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          border: 'none', boxSizing: 'border-box', 
                          cursor: 'pointer', gap: '4px'
                        }}
                      >
                        {(isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? (
                          <>
                            <CheckCircle2 size={14} /> Selfies Uploaded
                          </>
                        ) : !isCheckInSelfieUploaded ? (
                          <>
                            <Camera size={14} /> Upload Check-in Selfie
                          </>
                        ) : (
                          <>
                            <Camera size={14} /> Upload Check-out Selfie
                          </>
                        )}
                      </div>
                      {/* Break history badges */}
                      {(() => {
                        if (!todayAttendance || !todayAttendance.loginTime || todayAttendance.logoutTime) return null;
                        return (
                          <div
                            onClick={() => setBreakDetailsModal({ visible: true, type: 'All Breaks', breaks: todayAttendance.breaks || [] })}
                            style={{
                              background: '#e0e7ff', color: '#4338ca', padding: '0 12px', height: '32px', borderRadius: '999px',
                              fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', boxSizing: 'border-box', cursor: 'pointer', gap: '4px'
                            }}
                          >
                            <ClipboardList size={14} /> Break Details
                          </div>
                        );
                      })()}
                      {/* Break buttons */}
                      {todayAttendance && !todayAttendance.logoutTime && todayAttendance.loginTime && (
                        activeBreak ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              background: '#fef3c7',
                              color: '#d97706',
                              padding: '0 12px',
                              height: '32px',
                              borderRadius: '999px',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '6px',
                              border: '1px solid #fde68a',
                              boxSizing: 'border-box',
                              fontVariantNumeric: 'tabular-nums'
                            }}>
                              <Clock size={14} /> {new Date(breakTimer * 1000).toISOString().substr(11, 8)}
                            </div>
                            <button
                              onClick={handleBreakEnd}
                              className="employee-refresh-btn"
                              style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '999px',
                                padding: '0 12px',
                                height: '32px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.2s ease',
                                cursor: 'pointer',
                                boxSizing: 'border-box'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
                            >
                              Stop
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleOpenBreakModal}
                            style={{
                              background: '#ffedd5',
                              color: '#c2410c',
                              border: 'none',
                              borderRadius: '999px',
                              padding: '0 14px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              transition: 'all 0.2s ease',
                              cursor: 'pointer',
                              boxSizing: 'border-box'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.background = '#fdba74';
                              e.currentTarget.style.color = '#9a3412';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#ffedd5';
                              e.currentTarget.style.color = '#c2410c';
                            }}
                          >
                            Take Break
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        className="employee-refresh-btn"
                        onClick={handleRefresh}
                        disabled={refreshing || loading}
                        style={{
                          borderRadius: '999px',
                          padding: '0 12px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: (refreshing || loading) ? 'not-allowed' : 'pointer',
                          boxSizing: 'border-box',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                      >
                        {refreshing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </>
                  )}
                </div>
              </section>

              {/* Inline Selfie Section */}
              {showSelfieModal && (
                <section style={{ 
                  background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '24px', 
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0',
                  animation: 'employeeModalFadeIn 0.3s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                        <Camera size={20} />
                      </div>
                      <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 700 }}>Capture Selfie</h3>
                    </div>
                    <button
                      onClick={() => {
                        setShowSelfieModal(false);
                        if (videoRef.current?.srcObject) {
                          videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                        }
                      }}
                      style={{
                        background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
                        padding: '8px', borderRadius: '8px', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', justifyContent: 'center'
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
                      {isCheckInSelfieUploaded && checkInSelfie ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '100%', maxWidth: '300px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                            <img src={checkInSelfie} alt="Check-in Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>
                            Check-in Selfie <br/>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {checkInTime ? new Date(checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Uploaded'}
                            </span>
                          </span>
                        </div>
                      ) : (selfieType === 'checkin' ? (
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
                          {cameraError ? (
                            <div style={{ padding: '20px', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', fontSize: '14px', border: '1px solid #fecaca', width: '100%', maxWidth: '400px' }}>
                              {cameraError}
                            </div>
                          ) : !selfieImage ? (
                            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#0f172a', aspectRatio: '4/3' }}>
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                                onCanPlay={() => {
                                  setTimeout(() => {
                                    if (videoRef.current && canvasRef.current) {
                                      const context = canvasRef.current.getContext('2d');
                                      context.translate(canvasRef.current.width, 0);
                                      context.scale(-1, 1);
                                      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                                      const imgData = canvasRef.current.toDataURL('image/png');
                                      setSelfieImage(imgData);
                                      if (videoRef.current.srcObject) {
                                        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                                      }
                                    }
                                  }, 3000);
                                }}
                              />
                              <div style={{ position: 'absolute', bottom: '16px', left: '0', right: '0', textAlign: 'center', color: 'white', fontWeight: 'bold', textShadow: '0px 2px 4px rgba(0,0,0,0.8)' }}>
                                Capturing in 3 seconds...
                              </div>
                              <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
                            </div>
                          ) : (
                            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                              <img src={selfieImage} alt="Captured Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          
                          {selfieImage && (
                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                              <button
                                onClick={() => {
                                  setSelfieImage(null);
                                  navigator.mediaDevices.getUserMedia({ video: true })
                                    .then(stream => {
                                      if (videoRef.current) videoRef.current.srcObject = stream;
                                    })
                                    .catch(err => {
                                      console.error("Camera access error:", err);
                                      setCameraError("Failed to access camera.");
                                    });
                                }}
                                style={{
                                  padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                                  background: 'white', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s ease'
                                }}
                              >
                                Retake
                              </button>
                              <button
                                disabled={isUploadingSelfie}
                                onClick={() => {
                                  setIsUploadingSelfie(true);
                                  api.post('/attendance/upload-selfie', { image: selfieImage, type: selfieType, location: cachedLocation })
                                    .then(response => {
                                      setCheckInSelfie(selfieImage);
                                      setIsCheckInSelfieUploaded(true);
                                      setCheckInTime(new Date().toISOString());
                                      setSelfieImage(null);
                                      setShowSelfieModal(false);
                                      setIsUploadingSelfie(false);
                                    })
                                    .catch(err => {
                                      console.error('Error uploading selfie:', err);
                                      alert(err.response?.data?.message || 'Failed to upload selfie to database. Please try again.');
                                      setIsUploadingSelfie(false);
                                    });
                                }}
                                style={{
                                  padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                                  background: '#0ea5e9', color: 'white', border: 'none', cursor: isUploadingSelfie ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)',
                                  opacity: isUploadingSelfie ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                              >
                                {isUploadingSelfie ? <><Loader2 size={14} className="spin-animation" /> Uploading...</> : 'Upload Selfie'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ width: '100%', maxWidth: '300px', aspectRatio: '4/3', border: '2px dashed #cbd5e1', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Pending Check-in Selfie</div>
                      ))}
                    </div>

                    {/* RIGHT COLUMN: Check-out */}
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {isCheckOutSelfieUploaded && checkOutSelfie ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '100%', maxWidth: '300px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                            <img src={checkOutSelfie} alt="Check-out Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#475569', textAlign: 'center' }}>
                            Check-out Selfie <br/>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                              {checkOutTime ? new Date(checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Uploaded'}
                            </span>
                          </span>
                        </div>
                      ) : (selfieType === 'checkout' ? (
                        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
                          {cameraError ? (
                            <div style={{ padding: '20px', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', fontSize: '14px', border: '1px solid #fecaca', width: '100%', maxWidth: '400px' }}>
                              {cameraError}
                            </div>
                          ) : !selfieImage ? (
                            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', borderRadius: '16px', overflow: 'hidden', backgroundColor: '#0f172a', aspectRatio: '4/3' }}>
                              <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                                onCanPlay={() => {
                                  setTimeout(() => {
                                    if (videoRef.current && canvasRef.current) {
                                      const context = canvasRef.current.getContext('2d');
                                      context.translate(canvasRef.current.width, 0);
                                      context.scale(-1, 1);
                                      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
                                      const imgData = canvasRef.current.toDataURL('image/png');
                                      setSelfieImage(imgData);
                                      if (videoRef.current.srcObject) {
                                        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                                      }
                                    }
                                  }, 3000);
                                }}
                              />
                              <div style={{ position: 'absolute', bottom: '16px', left: '0', right: '0', textAlign: 'center', color: 'white', fontWeight: 'bold', textShadow: '0px 2px 4px rgba(0,0,0,0.8)' }}>
                                Capturing in 3 seconds...
                              </div>
                              <canvas ref={canvasRef} width={640} height={480} style={{ display: 'none' }} />
                            </div>
                          ) : (
                            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', borderRadius: '16px', overflow: 'hidden', border: '2px solid #e2e8f0', aspectRatio: '4/3' }}>
                              <img src={selfieImage} alt="Captured Selfie" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          )}
                          
                          {selfieImage && (
                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '12px' }}>
                              <button
                                onClick={() => {
                                  setSelfieImage(null);
                                  navigator.mediaDevices.getUserMedia({ video: true })
                                    .then(stream => {
                                      if (videoRef.current) videoRef.current.srcObject = stream;
                                    })
                                    .catch(err => {
                                      console.error("Camera access error:", err);
                                      setCameraError("Failed to access camera.");
                                    });
                                }}
                                style={{
                                  padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                                  background: 'white', color: '#475569', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s ease'
                                }}
                              >
                                Retake
                              </button>
                              <button
                                disabled={isUploadingSelfie}
                                onClick={() => {
                                  setIsUploadingSelfie(true);
                                  api.post('/attendance/upload-selfie', { image: selfieImage, type: selfieType, location: cachedLocation })
                                    .then(response => {
                                      setCheckOutSelfie(selfieImage);
                                      setIsCheckOutSelfieUploaded(true);
                                      setCheckOutTime(new Date().toISOString());
                                      setSelfieImage(null);
                                      setShowSelfieModal(false);
                                      setIsUploadingSelfie(false);
                                    })
                                    .catch(err => {
                                      console.error('Error uploading selfie:', err);
                                      alert(err.response?.data?.message || 'Failed to upload selfie to database. Please try again.');
                                      setIsUploadingSelfie(false);
                                    });
                                }}
                                style={{
                                  padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                                  background: '#0ea5e9', color: 'white', border: 'none', cursor: isUploadingSelfie ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.2)',
                                  opacity: isUploadingSelfie ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '8px'
                                }}
                              >
                                {isUploadingSelfie ? <><Loader2 size={14} className="spin-animation" /> Uploading...</> : 'Upload Selfie'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ width: '100%', maxWidth: '300px', aspectRatio: '4/3', border: '2px dashed #cbd5e1', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Pending Check-out Selfie</div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* Late Check-in Reason Modal */}
              {showLateReasonModal && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 999999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)'
                }}>
                  <div style={{
                    background: '#ffffff', borderRadius: '16px', padding: '24px',
                    width: '420px', maxWidth: '92vw', boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                    display: 'flex', flexDirection: 'column', gap: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px',
                        background: '#fef2f2', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', color: '#dc2626'
                      }}>
                        <AlertTriangle size={22} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                          Late Check-in Reason Required
                        </h3>
                        <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                          You are checking in after shift threshold time. Please provide a reason.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Reason for Late Check-in <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <textarea
                        rows={3}
                        value={lateReasonInput}
                        onChange={(e) => setLateReasonInput(e.target.value)}
                        placeholder="Specify why you are checking in late (e.g. Traffic delay, Personal work...)"
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '8px',
                          border: '1px solid #cbd5e1', fontSize: '13.5px', color: '#0f172a',
                          outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                      <button
                        onClick={() => {
                          setShowLateReasonModal(false);
                          setLateReasonInput('');
                        }}
                        style={{
                          padding: '9px 16px', background: '#f1f5f9', color: '#475569',
                          border: 'none', borderRadius: '8px', fontSize: '13px',
                          fontWeight: '600', cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          if (!lateReasonInput.trim()) {
                            alert('Please enter a reason for late check-in.');
                            return;
                          }
                          const reasonToSubmit = lateReasonInput.trim();
                          setSavedLateReason(reasonToSubmit);
                          setShowLateReasonModal(false);
                          setLateReasonInput('');
                          if (!isCheckInSelfieUploaded) {
                            setSelfieType('checkin');
                            setShowSelfieModal(true);
                          } else {
                            handleCheckIn(true, reasonToSubmit);
                          }
                        }}
                        style={{
                          padding: '9px 20px', background: '#dc2626', color: '#ffffff',
                          border: 'none', borderRadius: '8px', fontSize: '13px',
                          fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
                        }}
                      >
                        Submit & Continue
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {loading && (
                <>
                  {/* KPI cards skeleton */}
                  <section className="employee-kpi-grid employee-skeleton-grid">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <article className="employee-kpi-card employee-skeleton-card" key={`kpi-skeleton-${item}`}>
                        <div className="employee-skeleton employee-skeleton-icon" />
                        <div className="employee-skeleton employee-skeleton-line sm" />
                        <div className="employee-skeleton employee-skeleton-line lg" />
                        <div className="employee-skeleton employee-skeleton-line xs" />
                      </article>
                    ))}
                  </section>

                  {/* Work Snapshot skeleton */}
                  <section style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '14px' }}>
                    <div className="employee-skeleton-card" style={{ borderRadius: 10, padding: '12px 16px', background: '#fff', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div><div className="employee-skeleton employee-skeleton-line xs" style={{ width: 70 }} /><div className="employee-skeleton employee-skeleton-line sm" style={{ marginTop: 6, width: 110 }} /></div>
                        <div className="employee-skeleton" style={{ width: 44, height: 18, borderRadius: 999 }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                        {[1, 2, 3].map(i => (
                          <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px', border: '1px solid #f1f5f9' }}>
                            <div className="employee-skeleton" style={{ width: 22, height: 22, borderRadius: 6, marginBottom: 8 }} />
                            <div className="employee-skeleton employee-skeleton-line xs" style={{ width: '60%', marginBottom: 6 }} />
                            <div className="employee-skeleton employee-skeleton-line lg" style={{ width: '40%' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Chart panel skeleton */}
                  <section className="employee-dashboard-panels" style={{ marginBottom: 14 }}>
                    <div className="employee-skeleton-card" style={{ borderRadius: 10, padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div><div className="employee-skeleton employee-skeleton-line xs" style={{ width: 90 }} /><div className="employee-skeleton employee-skeleton-line md" style={{ marginTop: 6 }} /></div>
                        <div className="employee-skeleton" style={{ width: 50, height: 18, borderRadius: 999 }} />
                      </div>
                      {/* Fake chart bars */}
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 100, padding: '0 2px' }}>
                        {[50, 65, 40, 80, 60, 95, 45, 72, 55, 70, 58, 84].map((h, i) => (
                          <div key={i} className="employee-skeleton" style={{ flex: 1, height: h, borderRadius: '3px 3px 0 0' }} />
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Bottom tables skeleton */}
                  <section className="employee-dashboard-bottom">
                    {[0, 1].map(t => (
                      <div key={t} className="employee-skeleton-card" style={{ borderRadius: 10, padding: '14px 16px', background: '#fff', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div><div className="employee-skeleton employee-skeleton-line xs" style={{ width: 50 }} /><div className="employee-skeleton employee-skeleton-line md" style={{ marginTop: 6 }} /></div>
                          <div className="employee-skeleton" style={{ width: 44, height: 18, borderRadius: 999 }} />
                        </div>
                        {[1, 2, 3, 4].map(r => (
                          <div key={r} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid #f8fafc' }}>
                            <div className="employee-skeleton employee-skeleton-line sm" />
                            <div className="employee-skeleton employee-skeleton-line sm" />
                            <div className="employee-skeleton employee-skeleton-line sm" />
                            <div className="employee-skeleton" style={{ height: 16, borderRadius: 999 }} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </section>
                </>
              )}

              {error && (
                <div className="employee-error-card">
                  <strong>Error:</strong> {error}
                </div>
              )}

              {!loading && (
                <>
                  <section className="employee-kpi-grid">
                    {employeeHighlights.map((item, index) => {
                      const Icon = item.icon;
                      const iconColors = {
                        emerald: '#166534',  // dark green
                        rose: '#15803d',  // royal green
                        sky: '#16a34a',  // medium green
                        violet: '#22c55e',  // fresh green
                        amber: '#4ade80'   // soft green
                      };
                      const watermarkColors = {
                        emerald: 'rgba(22,101,52,0.10)',
                        rose: 'rgba(21,128,61,0.10)',
                        sky: 'rgba(22,163,74,0.10)',
                        violet: 'rgba(34,197,94,0.10)',
                        amber: 'rgba(74,222,128,0.10)'
                      };
                      const iconColor = iconColors[item.tone] || '#64748b';
                      const watermarkColor = watermarkColors[item.tone] || 'rgba(100,116,139,0.08)';
                      return (
                        <div
                          key={item.label}
                          className="employee-kpi-item"
                          style={{
                            background: 'white',
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            position: 'relative',
                            overflow: 'hidden',
                            transition: 'all 0.3s',
                            animation: `fadeInUp 0.4s ease-out ${index * 0.08}s both`,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                        >
                          {/* Watermark circle */}
                          <div style={{
                            position: 'absolute', right: '-18px', bottom: '-18px',
                            width: '100px', height: '100px', borderRadius: '50%',
                            background: watermarkColor, pointerEvents: 'none'
                          }} />

                          {/* Top row: label (left) + icon (right) */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{item.label}</div>
                            <div style={{ color: iconColor }}><Icon size={20} /></div>
                          </div>

                          {/* Big value */}
                          <div style={{ fontSize: '28px', fontWeight: 300, color: '#1e293b', marginBottom: '6px', lineHeight: 1 }}>
                            {item.value}
                          </div>

                          {/* Trend row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: item.isUp ? '#a8e63d' : '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              {item.isUp
                                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                              }
                              <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.trend}</span>
                            </span>
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>from last month</span>
                          </div>
                        </div>
                      );
                    })}

                    {/* Work Snapshot — spans cols 2-4 of row 2, same height as Leaves card */}
                    <article className="employee-panel employee-snapshot-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden' }}>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <div>
                          <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Support Metrics</span>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', lineHeight: 1.2, marginTop: '1px' }}>Snapshot</div>
                        </div>
                        <span className="employee-panel-badge">Overall</span>
                      </div>
                      {/* Stats row */}
                      <div className="employee-snapshot-stats" style={{ display: 'grid', gap: '10px', flex: 1 }}>
                        {employeeSupportStats.map((item) => {
                          const Icon = item.icon;
                          return (
                            <div className={`employee-support-card tone-${item.tone}`} key={item.label} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div className="employee-support-icon" style={{ flexShrink: 0 }}><Icon size={15} /></div>
                              <div>
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '2px' }}>{item.label}</div>
                                <div style={{ fontSize: '22px', fontWeight: 300, color: '#111827', lineHeight: 1, letterSpacing: '-0.5px' }}>{item.value}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </article>
                  </section>

                  <section className="employee-dashboard-panels" style={{ flex: 1 }}>
                    <article className="employee-panel employee-chart-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="employee-card-head">
                        <div>
                          <span className="employee-overline dark">Attendance Statistic</span>
                          <h3>My Attendance Statistics</h3>
                        </div>
                        <span className="employee-panel-badge">Monthly</span>
                      </div>
                      <div className="chart-wrapper employee-chart-wrapper" style={{ flex: 1, height: 'auto' }}>
                        <canvas ref={personalAttendanceChartRef}></canvas>
                      </div>
                    </article>

                  </section>

                </>
              )}
            </main>
          </div>
          {!loading && (
            <section className="employee-dashboard-bottom">
              <article className="employee-panel employee-table-panel">
                <div className="employee-card-head">
                  <div>
                    <span className="employee-overline dark">Cases</span>
                    <h3>Recent Leave Applications</h3>
                  </div>
                  <span className="employee-panel-badge">{employeeRecentLeaves.length} items</span>
                </div>
                <div className="employee-table-wrap">
                  {employeeRecentLeaves.length > 0 ? (
                    <table className="employee-table">
                      <thead>
                        <tr>
                          <th>Employee</th>
                          <th>Type</th>
                          <th>From</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employeeRecentLeaves.map((leave) => (
                          <tr key={leave._id || `${leave.startDate}-${leave.leaveType}`}>
                            <td>{leave.employee?.firstName || 'N/A'} {leave.employee?.lastName || ''}</td>
                            <td>{leave.leaveType || 'N/A'}</td>
                            <td>{leave.startDate ? new Date(leave.startDate).toLocaleDateString() : 'N/A'}</td>
                            <td>
                              <span className={`employee-status-badge ${(leave.status || 'pending').toLowerCase()}`}>
                                {leave.status || 'pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="employee-empty-state">No leave applications yet</div>
                  )}
                </div>
              </article>

              <article className="employee-panel employee-table-panel">
                <div className="employee-card-head">
                  <div>
                    <span className="employee-overline dark">Goals</span>
                    <h3>Recently Created</h3>
                  </div>
                  <span className="employee-panel-badge">{recentGoals.length} items</span>
                </div>
                <div className="employee-table-wrap">
                  {recentGoals.length > 0 ? (
                    <table className="employee-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          {isAdmin && <th>Created By</th>}
                          <th>Date</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentGoals.map((goal) => (
                          <tr key={goal._id}>
                            <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.name || 'N/A'}</td>
                            {isAdmin && <td>{goal.createdBy?.firstName || 'N/A'} {goal.createdBy?.lastName || ''}</td>}
                            <td>{goal.createdAt ? new Date(goal.createdAt).toLocaleDateString() : 'N/A'}</td>
                            <td>
                              <span className={`employee-status-badge ${goal.isCompleted ? 'completed' : 'pending'}`}>
                                {goal.isCompleted ? 'Completed' : 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="employee-empty-state">No goals yet</div>
                  )}
                </div>
              </article>
            </section>
          )}
        </div>
        {renderBreakModal()}
        {renderBreakDetailsModal()}
        {renderActiveBreakScreen()}
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif" }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            box-sizing: border-box;
          }
          
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
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
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .spin-animation {
            animation: spin 1s linear infinite;
          }
          
          .stats-grid > div,
          .employee-scroll-container > div {
            animation: fadeInUp 0.6s ease-out forwards;
            position: relative;
            overflow: hidden;
            isolation: isolate;
          }
          
          .stats-grid > div::before,
          .employee-scroll-container > div::before {
            content: '';
            position: absolute;
            z-index: -1;
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
          
          .stats-grid > div::after,
          .employee-scroll-container > div::after {
            content: '';
            position: absolute;
            z-index: -1;
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
          
          .stats-grid > div:nth-child(1)::before,
          .stats-grid > div:nth-child(1)::after { background: #10b981; }
          
          .stats-grid > div:nth-child(2)::before,
          .stats-grid > div:nth-child(2)::after { background: #ef4444; }
          
          .stats-grid > div:nth-child(3)::before,
          .stats-grid > div:nth-child(3)::after { background: #8b5cf6; }
          
          .stats-grid > div:nth-child(4)::before,
          .stats-grid > div:nth-child(4)::after { background: #0891b2; }
          
          .stats-grid > div:nth-child(5)::before,
          .stats-grid > div:nth-child(5)::after { background: #f97316; }
          
          .stats-grid > div:nth-child(6)::before,
          .stats-grid > div:nth-child(6)::after { background: #f59e0b; }
          
          .stats-grid > div:nth-child(1) { animation-delay: 0.1s; }
          .stats-grid > div:nth-child(2) { animation-delay: 0.2s; }
          .stats-grid > div:nth-child(3) { animation-delay: 0.3s; }
          .stats-grid > div:nth-child(4) { animation-delay: 0.4s; }
          .stats-grid > div:nth-child(5) { animation-delay: 0.5s; }
          .stats-grid > div:nth-child(6) { animation-delay: 0.6s; }
        `}
      </style>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1e293b',
          margin: 0,
          letterSpacing: '-0.02em',
          fontFamily: "'Inter', sans-serif"
        }}>
          Welcome, {user?.firstName || 'User'}!
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          style={{
            padding: '10px 18px',
            background: refreshing || loading ? '#e2e8f0' : 'white',
            color: refreshing || loading ? '#64748b' : '#374151',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            cursor: refreshing || loading ? 'not-allowed' : 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            fontFamily: "'Inter', sans-serif"
          }}
          onMouseEnter={(e) => !refreshing && !loading && (e.currentTarget.style.borderColor = '#9ca3af')}
          onMouseLeave={(e) => !refreshing && !loading && (e.currentTarget.style.borderColor = '#e2e8f0')}
        >
          {refreshing
            ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            : <RefreshCw size={16} />}
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {loading && (
        <>
          <style>{`
            @keyframes db-shimmer {
              0%   { background-position: -600px 0; }
              100% { background-position: 600px 0; }
            }
            .db-skel {
              background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
              background-size: 600px 100%;
              animation: db-shimmer 1.4s infinite linear;
              border-radius: 8px;
            }
          `}</style>

          {/* Attendance card skeleton */}
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', marginBottom: 18, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div className="db-skel" style={{ width: 110, height: 13 }} />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[80, 90, 100].map((w, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                  <div className="db-skel" style={{ width: 60, height: 10 }} />
                  <div className="db-skel" style={{ width: w, height: 20 }} />
                </div>
              ))}
            </div>
          </div>

          {/* Stat cards skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px,1fr))', gap: 16, marginBottom: 22 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div className="db-skel" style={{ width: '55%', height: 12 }} />
                  <div className="db-skel" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                </div>
                <div className="db-skel" style={{ width: '35%', height: 30, marginBottom: 12 }} />
                <div className="db-skel" style={{ width: '70%', height: 10 }} />
              </div>
            ))}
          </div>

          {/* Chart + activities skeleton */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
              {/* Bar chart skeleton */}
              <div>
                <div className="db-skel" style={{ width: 220, height: 14, marginBottom: 10 }} />
                <div className="db-skel" style={{ width: 160, height: 10, marginBottom: 20 }} />
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 200 }}>
                  {[80, 120, 70, 160, 100, 140, 90, 180, 110, 130, 85, 150].map((h, i) => (
                    <div key={i} className="db-skel" style={{ flex: 1, height: h, borderRadius: '5px 5px 0 0' }} />
                  ))}
                </div>
              </div>
              {/* Activities skeleton */}
              <div>
                <div className="db-skel" style={{ width: 180, height: 14, marginBottom: 18 }} />
                {[1, 2, 3, 4, 5].map(r => (
                  <div key={r} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <div className="db-skel" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="db-skel" style={{ width: '80%', height: 11, marginBottom: 7 }} />
                      <div className="db-skel" style={{ width: '60%', height: 10, marginBottom: 6 }} />
                      <div className="db-skel" style={{ width: '40%', height: 9 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {error && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #fecaca',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          <strong style={{ fontWeight: '600' }}>Error:</strong> {error}
        </div>
      )}

      {!loading && (
        <>

          <div className="card attendance-card" style={{ padding: '10px 15px', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '15px', margin: '0 0 8px 0', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <BarChart2 size={16} /> Today's Attendance
            </h3>
            <div className="attendance-grid" style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '15px',
              justifyContent: 'space-between',
              marginBottom: '5px'
            }}>
              <div className="attendance-stat" style={{ flex: '1', minWidth: '100px', padding: '5px', textAlign: 'center' }}>
                <p className="attendance-stat-label" style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>Status</p>
                <p className="attendance-stat-value" style={{ fontSize: '14px', fontWeight: '600', marginBottom: '0', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  {todayAttendance
                    ? (todayAttendance.logoutTime
                      ? <><CheckCheck size={14} /> {todayAttendance.status === 'present' ? 'Present' : todayAttendance.status === 'half-day' ? 'Half Day' : 'Absent'}</>
                      : <button
                        onClick={() => handleCheckOut()}
                        disabled={isCheckingOut}
                        style={{
                          padding: '6px 16px',
                          fontSize: '13px',
                          fontWeight: '700',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '999px',
                          cursor: isCheckingOut ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                          opacity: isCheckingOut ? 0.7 : 1
                        }}
                        onMouseEnter={(e) => {
                          if (!isCheckingOut) {
                            e.target.style.background = '#dc2626';
                            e.target.style.transform = 'translateY(-1px)';
                            e.target.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCheckingOut) {
                            e.target.style.background = '#ef4444';
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
                          }
                        }}
                      >
                        {isCheckingOut ? (
                          <><Loader2 size={14} className="spin-animation" /> Checking Out...</>
                        ) : (
                          <><LogIn size={14} style={{ transform: 'rotate(180deg)' }} /> Check Out</>
                        )}
                      </button>)
                    : <button
                      onClick={() => handleCheckIn()}
                      disabled={isCheckingIn || isBeforeShiftStart()}
                      title={isBeforeShiftStart() ? `You can only check-in from ${user?.shiftStartTime}` : ''}
                      style={{
                        padding: '6px 16px',
                        fontSize: '13px',
                        fontWeight: '700',
                        background: '#a8e63d',
                        color: '#14532d',
                        border: '1.5px solid #a8e63d',
                        borderRadius: '999px',
                        cursor: (isCheckingIn || isBeforeShiftStart()) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(168, 230, 61, 0.3)',
                        opacity: (isCheckingIn || isBeforeShiftStart()) ? 0.6 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isCheckingIn && !isBeforeShiftStart()) {
                          e.target.style.transform = 'translateY(-1px)';
                          e.target.style.boxShadow = '0 4px 12px rgba(168, 230, 61, 0.4)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isCheckingIn && !isBeforeShiftStart()) {
                          e.target.style.background = '#a8e63d';
                          e.target.style.color = '#14532d';
                          e.target.style.borderColor = '#a8e63d';
                          e.target.style.transform = 'translateY(0)';
                          e.target.style.boxShadow = '0 2px 8px rgba(168, 230, 61, 0.3)';
                        }
                      }}
                      onMouseDown={(e) => {
                        if (!isCheckingIn && !isBeforeShiftStart()) {
                          e.target.style.background = 'white';
                          e.target.style.color = '#a8e63d';
                        }
                      }}
                    >
                      {isCheckingIn ? (
                        <><Loader2 size={14} className="spin-animation" /> Checking In...</>
                      ) : (
                        <><LogIn size={14} /> Check In</>
                      )}
                    </button>}
                </p>
              </div>
              <div className="attendance-stat" style={{ flex: '1', minWidth: '80px', padding: '5px', textAlign: 'center' }}>
                <p className="attendance-stat-label" style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>Login Time</p>
                <p className="attendance-stat-value" style={{ fontSize: '14px', fontWeight: '600', marginBottom: '0', color: '#0f172a' }}>
                  {todayAttendance?.loginTime
                    ? new Date(todayAttendance.loginTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </p>
              </div>
              <div className="attendance-stat" style={{ flex: '1', minWidth: '80px', padding: '5px', textAlign: 'center' }}>
                <p className="attendance-stat-label" style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}>Working Hours</p>
                <p className="attendance-stat-value" style={{ fontSize: '14px', fontWeight: '600', marginBottom: '0', color: '#0f172a' }}>
                  {currentWorkingHours}
                </p>
              </div>
            </div>
            {!todayAttendance && (
              <div className="attendance-warning" style={{
                marginTop: '5px',
                padding: '6px 10px',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#f0f9f4',
                color: '#166534',
                borderRadius: '8px'
              }}>
                <Lightbulb size={14} />
                <p style={{ margin: 0 }}>
                  Check in to start tracking your attendance for today
                </p>
              </div>
            )}
          </div>

          {/* Statistics Cards - Responsive Layout */}
          <div className="stats-grid employee-scroll-container" style={{ gap: '16px', marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {isAdmin && (
              <>
                {/* Present Today */}
                <div style={{
                  background: 'white',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                      Present Today
                    </div>
                    <div style={{ color: '#10b981' }}>
                      <CheckCircle2 size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                    {stats.presentToday || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <TrendingUp size={14} strokeWidth={2.5} />
                      <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>+5.2%</span>
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>from last month</span>
                  </div>
                </div>

                {/* Absent Today */}
                <div style={{
                  background: 'white',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                      Absent Today
                    </div>
                    <div style={{ color: '#ef4444' }}>
                      <XCircle size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                    {stats.absentToday || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <AlertTriangle size={14} strokeWidth={2.5} />
                      <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>needs attention</span>
                    </span>
                  </div>
                </div>

                {/* Completed Projects */}
                <div style={{
                  background: 'white',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                      Completed Projects
                    </div>
                    <div style={{ color: '#8b5cf6' }}>
                      <Trophy size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                    {stats.completedProjects || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <CheckCircle2 size={14} strokeWidth={2.5} />
                      <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>+12.5%</span>
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: "'Inter', sans-serif" }}>from last month</span>
                  </div>
                </div>
              </>
            )}

            {/* Active Projects */}
            <div style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                  Active Projects
                </div>
                <div style={{ color: '#f97316' }}>
                  <FolderOpen size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                {stats.activeProjects || 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#f97316', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <TrendingUp size={14} strokeWidth={2.5} />
                  <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>in progress</span>
                </span>
              </div>
            </div>

            {/* Upcoming Deadlines */}
            <div style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                  Upcoming Deadlines
                </div>
                <div style={{ color: '#0891b2' }}>
                  <Clock size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                {stats.upcomingDeadlines || 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#0891b2', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <CalendarDays size={14} strokeWidth={2.5} />
                  <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>due soon</span>
                </span>
              </div>
            </div>

            {/* My Goals */}
            <div style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                  My Goals
                </div>
                <div style={{ color: '#0d9488' }}>
                  <Target size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                {stats.goals || 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#0d9488', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <CheckCheck size={14} strokeWidth={2.5} />
                  <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>assigned to me</span>
                </span>
              </div>
            </div>

            {/* Broadcasts */}
            <div style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              transition: 'all 0.3s',
              cursor: 'pointer'
            }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                  Announcements
                </div>
                <div style={{ color: '#f59e0b' }}>
                  <Megaphone size={18} />
                </div>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                {stats.broadcasts || 0}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <TrendingUp size={14} strokeWidth={2.5} />
                  <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>active broadcasts</span>
                </span>
              </div>
            </div>

            {!user?.role?.permissions?.some(p => p.module === 'employees' && p.actions.includes('update')) && (
              <>
                {/* Pending Approvals */}
                <div style={{
                  background: 'white',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                      Pending Approvals
                    </div>
                    <div style={{ color: '#e11d48' }}>
                      <Hourglass size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                    {stats.pendingApprovals || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#e11d48', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <AlertTriangle size={14} strokeWidth={2.5} />
                      <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>pending review</span>
                    </span>
                  </div>
                </div>

                {/* Pending Leaves */}
                <div style={{
                  background: 'white',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                      Pending Leaves
                    </div>
                    <div style={{ color: '#6366f1' }}>
                      <Umbrella size={18} />
                    </div>
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                    {stats.pendingLeaves || 0}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: '#6366f1', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Hourglass size={14} strokeWidth={2.5} />
                      <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>awaiting approval</span>
                    </span>
                  </div>
                </div>
              </>
            )}

            {user?.role?.name === 'Sales' && (
              <div style={{
                background: 'white',
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                transition: 'all 0.3s',
                cursor: 'pointer'
              }}
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', fontFamily: "'Inter', sans-serif" }}>
                    Today's Leads
                  </div>
                  <div style={{ color: '#8b5cf6' }}>
                    <ClipboardList size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '28px', fontWeight: '300', color: '#1e293b', marginBottom: '6px', fontFamily: "'Inter', sans-serif" }}>
                  {stats.todayLeads || 0}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <TrendingUp size={14} strokeWidth={2.5} />
                    <span style={{ fontSize: '12px', fontWeight: '600', fontFamily: "'Inter', sans-serif" }}>assigned today</span>
                  </span>
                </div>
              </div>
            )}
          </div>



          {/* Department Distribution & Recent HR Activities */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px', overflow: 'hidden', borderRadius: '14px', border: '1px solid #e8f0e4', boxShadow: '0 2px 14px rgba(0,40,0,0.06)' }}>
            <div className="dashboard-charts-section">
              {/* Department Distribution Chart OR Personal Attendance Stats */}
              <div>
                {user?.role?.permissions?.some(p => p.module === 'employees' && p.actions.includes('update')) ? (
                  <>
                    <h2 style={{ fontSize: '16px', marginBottom: '8px', fontWeight: '700', color: '#14532d', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '8px' }}><Building2 size={16} /> Department-wise Employee Distribution</h2>
                    <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '15px', fontWeight: '500' }}>
                      Employee count per department
                    </p>
                    <div className="chart-wrapper">
                      <canvas ref={chartRef}></canvas>
                    </div>
                    {departmentDistribution.departments.length === 0 && (
                      <p style={{ textAlign: 'center', color: '#64748b', padding: '30px 0' }}>
                        Loading department data...
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 style={{ fontSize: '16px', marginBottom: '8px', fontWeight: '700', color: '#14532d', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={16} /> My Attendance Statistics</h2>
                    <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '15px', fontWeight: '500' }}>
                      Your monthly attendance overview
                    </p>
                    <div className="chart-wrapper">
                      <canvas ref={personalAttendanceChartRef}></canvas>
                    </div>
                  </>
                )}
              </div>

              {/* Recent HR Activities */}
              <div className="activities-sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Pin size={13} color='#16a34a' strokeWidth={2} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '9.5px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: "'Inter', sans-serif", lineHeight: 1 }}>
                        {['HR', 'HR Manager', 'Director', 'Manager'].includes(user?.role?.name) ? 'HR Feed' : 'My Feed'}
                      </p>
                      <h2 style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.2px', fontFamily: "'Inter', sans-serif" }}>
                        Recent Activities
                      </h2>
                    </div>
                  </div>
                  <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '20px', padding: '3px 9px', fontFamily: "'Inter', sans-serif", flexShrink: 0 }}>
                    {recentActivities.length} events
                  </span>
                </div>

                {/* Scrollable list — maxHeight keeps card fixed */}
                <div style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: '320px', paddingRight: '3px', flex: 1 }}>
                  {recentActivities.length > 0 ? (
                    recentActivities.map((activity, index) => {
                      const { Icon, color, bg } = getActivityMeta(activity.type);
                      return (
                        <div key={index}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '10px',
                            padding: '10px 12px', marginBottom: '7px',
                            borderRadius: '9px', background: bg,
                            border: `1px solid ${color}20`,
                            borderLeft: `3px solid ${color}`,
                            transition: 'box-shadow 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.boxShadow = `0 2px 8px ${color}20`}
                          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                          {/* SVG icon badge */}
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: `${color}14`, border: `1px solid ${color}28`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <Icon size={15} color={color} strokeWidth={2} />
                          </div>

                          {/* Text content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a', fontFamily: "'Inter', sans-serif", letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {activity.title}
                              </span>
                              <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: "'Inter', sans-serif", fontWeight: '500', flexShrink: 0 }}>
                                {new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '11.5px', color: '#475569', lineHeight: '1.45', fontFamily: "'Inter', sans-serif", fontWeight: '400', wordBreak: 'break-word' }}>
                              {activity.description}
                            </p>
                            <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', fontWeight: '600', color: color, background: `${color}12`, borderRadius: '4px', padding: '1px 6px', textTransform: 'capitalize', letterSpacing: '0.02em', fontFamily: "'Inter', sans-serif" }}>
                              {activity.type || 'event'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '160px', gap: '10px' }}>
                      <CheckCircle2 size={30} color='#cbd5e1' strokeWidth={1.5} />
                      <span style={{ fontSize: '12.5px', color: '#94a3b8', fontFamily: "'Inter', sans-serif", fontWeight: '500' }}>No recent activities</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Goals Table */}
          <div className="card" style={{ padding: '20px', marginBottom: '20px', overflow: 'hidden', borderRadius: '14px', border: '1px solid #e8f0e4', boxShadow: '0 2px 14px rgba(0,40,0,0.06)' }}>
            <h2 style={{ fontSize: '16px', marginBottom: '12px', fontWeight: '700', color: '#14532d', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={16} /> Recent Goals</h2>
            <div style={{
              overflowY: 'auto',
              overflowX: 'auto',
              maxHeight: '280px'
            }}>
              {recentGoals.length > 0 ? (
                <table className="table" style={{ minWidth: '400px', fontSize: 'clamp(10px, 1.8vw, 13px)' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 'clamp(6px, 1.5vw, 10px)', whiteSpace: 'nowrap' }}>Title</th>
                      <th style={{ padding: 'clamp(6px, 1.5vw, 10px)', whiteSpace: 'nowrap' }}>Created By</th>
                      <th style={{ padding: 'clamp(6px, 1.5vw, 10px)', whiteSpace: 'nowrap' }}>Created Date</th>
                      <th style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGoals.map((goal) => (
                      <tr key={goal._id}>
                        <td style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{goal.name || 'N/A'}</td>
                        <td style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap' }}>{goal.createdBy?.firstName || 'N/A'} {goal.createdBy?.lastName || ''}</td>
                        <td style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap' }}>{goal.createdAt ? new Date(goal.createdAt).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ padding: 'clamp(8px, 2vw, 12px)' }}>
                          <span className={`badge ${goal.isCompleted ? 'badge-info' : 'badge-secondary'}`} style={{ fontSize: 'clamp(10px, 2vw, 12px)', padding: 'clamp(3px, 1vw, 5px) clamp(6px, 1.5vw, 10px)' }}>
                            {goal.isCompleted ? 'Completed' : 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ marginTop: '15px', color: '#64748b', fontSize: 'clamp(11px, 2.5vw, 14px)' }}>No goals yet</p>
              )}
            </div>
          </div>

          {/* Weekly Analytics & Recent Leave Applications in same row */}
          <div className="dashboard-bottom-grid">
            {/* Weekly Analytics Bar Chart */}
            <div className="card" style={{ padding: '20px', overflow: 'hidden', minWidth: 0, maxWidth: '100%', borderRadius: '14px', border: '1px solid #e8f0e4', boxShadow: '0 2px 14px rgba(0,40,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', marginBottom: '8px', fontWeight: '700', color: '#14532d', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={16} /> Weekly Analytics</h2>
              <p style={{ color: '#6b7280', fontSize: '12px', marginBottom: '12px', fontWeight: '500' }}>
                Day-wise analysis of goals, joinings & upcoming project
              </p>
              <div className="chart-wrapper" style={{ height: '250px' }}>
                <canvas ref={weeklyChartRef}></canvas>
              </div>
              {weeklyAnalytics.days.length === 0 && (
                <p style={{ textAlign: 'center', color: '#64748b', padding: '20px 0' }}>
                  Loading weekly data...
                </p>
              )}
            </div>

            {/* Recent Leave Applications */}
            <div className="card" style={{ padding: '20px', overflow: 'hidden', minWidth: 0, maxWidth: '100%', borderRadius: '14px', border: '1px solid #e8f0e4', boxShadow: '0 2px 14px rgba(0,40,0,0.06)' }}>
              <h2 style={{ fontSize: '16px', marginBottom: '12px', fontWeight: '700', color: '#14532d', letterSpacing: '-0.2px', display: 'flex', alignItems: 'center', gap: '8px' }}><FileText size={16} /> Recent Leave Applications</h2>
              <div style={{
                overflowY: 'auto',
                overflowX: 'auto',
                maxHeight: '280px'
              }}>
                {recentLeaves.length > 0 ? (
                  <table className="table" style={{ minWidth: '400px', fontSize: 'clamp(10px, 1.8vw, 13px)' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 'clamp(6px, 1.5vw, 10px)', whiteSpace: 'nowrap' }}>Employee</th>
                        <th style={{ padding: 'clamp(6px, 1.5vw, 10px)', whiteSpace: 'nowrap' }}>Leave Type</th>
                        <th style={{ padding: 'clamp(6px, 1.5vw, 10px)', whiteSpace: 'nowrap' }}>Start Date</th>
                        <th style={{ padding: 'clamp(6px, 1.5vw, 10px)', whiteSpace: 'nowrap' }}>End Date</th>
                        <th style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentLeaves.map((leave) => (
                        <tr key={leave._id}>
                          <td style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap' }}>{leave.employee?.firstName || 'N/A'} {leave.employee?.lastName || ''}</td>
                          <td style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap' }}>{leave.leaveType || 'N/A'}</td>
                          <td style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap' }}>{leave.startDate ? new Date(leave.startDate).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ padding: 'clamp(8px, 2vw, 12px)', whiteSpace: 'nowrap' }}>{leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ padding: 'clamp(8px, 2vw, 12px)' }}>
                            <span className={`badge ${leave.status === 'approved' ? 'badge-success' :
                              leave.status === 'rejected' ? 'badge-danger' :
                                'badge-warning'
                              }`} style={{ fontSize: 'clamp(10px, 2vw, 12px)', padding: 'clamp(3px, 1vw, 5px) clamp(6px, 1.5vw, 10px)' }}>
                              {leave.status || 'pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ marginTop: '15px', color: '#64748b', fontSize: 'clamp(11px, 2.5vw, 14px)' }}>No leave applications yet</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {renderBreakModal()}
      {renderBreakDetailsModal()}
      {renderActiveBreakScreen()}

      {/* Success Toast Portal */}
      {successToast && createPortal(
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#10b981',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '999px',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 9999999,
          fontSize: '15px',
          fontWeight: 600,
          animation: 'employeeModalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          whiteSpace: 'nowrap'
        }}>
          <CheckCircle2 size={18} strokeWidth={2.5} />
          <span style={{ flex: 1, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{successToast}</span>
          <button 
            onClick={() => setSuccessToast(null)} 
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: 'white', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <XCircle size={14} strokeWidth={2.5} />
          </button>
        </div>,
        document.body
      )}

      {/* Error Toast Portal */}
      {errorToast && createPortal(
        <div style={{
          position: 'fixed',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#ef4444',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '999px',
          boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 9999999,
          fontSize: '15px',
          fontWeight: 600,
          animation: 'employeeModalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          whiteSpace: 'nowrap'
        }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <span style={{ flex: 1, textShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{errorToast}</span>
          <button 
            onClick={() => setErrorToast(null)} 
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: 'white', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <XCircle size={14} strokeWidth={2.5} />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Dashboard;
