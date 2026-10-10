import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip as ChartTooltip, Legend as ChartLegend } from 'chart.js';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import './AdminDasboard.css';
import {
  Users, Timer,
  RefreshCw, TrendingUp, TrendingDown,
  BarChart2, Activity, Calendar, Clock, Target, LogIn
, Hourglass, XCircle, Camera, Loader2, CheckCircle2, AlertTriangle, Coffee, Utensils } from 'lucide-react';

ChartJS.register(ArcElement, ChartTooltip, ChartLegend);

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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {isOpen && (
        <div style={{
          marginTop: '8px',
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

function HRDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Check-in/out states
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [checkInTimer, setCheckInTimer] = useState(0);
  // --- BREAK LOGIC STATES ---
  const [activeBreak, setActiveBreak] = useState(null);
  const [hideBreakScreen, setHideBreakScreen] = useState(false);
  const [breakTimer, setBreakTimer] = useState(0);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breakForm, setBreakForm] = useState({ type: 'Tea Break', reason: '' });
  const [breakDetailsModal, setBreakDetailsModal] = useState({ visible: false, type: '', breaks: [] });
  const [breakLimits, setBreakLimits] = useState({ totalBreakLimit: 60 });
  const [errorToast, setErrorToast] = useState(null);
  const [successToast, setSuccessToast] = useState(null);
  const [cachedLocation, setCachedLocation] = useState(null);
  const [shiftConfig, setShiftConfig] = useState(null);
  const [currentWorkingHours, setCurrentWorkingHours] = useState('0:00:00');
  
  // Selfie state
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  const [selfieType, setSelfieType] = useState('checkin');
  const [selfieImage, setSelfieImage] = useState(null);
  const [isCheckInSelfieUploaded, setIsCheckInSelfieUploaded] = useState(false);
  const [isCheckOutSelfieUploaded, setIsCheckOutSelfieUploaded] = useState(false);
  const [checkInSelfie, setCheckInSelfie] = useState(null);
  const [checkOutSelfie, setCheckOutSelfie] = useState(null);
  const [isUploadingSelfie, setIsUploadingSelfie] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkOutTime, setCheckOutTime] = useState(null);
  const [showLateReasonModal, setShowLateReasonModal] = useState(false);
  const [lateReasonInput, setLateReasonInput] = useState('');
  const [savedLateReason, setSavedLateReason] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get('/attendance/break-limits').then(res => {
      if (res.data) {
        setBreakLimits(res.data);
      }
    }).catch(() => {});

    const type = user?.shiftType || 'morning';
    api.get(`/shift-configs/${type}`).then(res => {
      if (res.data) setShiftConfig(res.data);
    }).catch(() => { });
  }, [user?.shiftType]);
  
  // Pre-fetch location
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
  
  // Selfie Camera Access
  useEffect(() => {
    // Check database for existing selfie
    api.get('/attendance/my-selfie')
      .then(response => {
        if (response.data?.uploaded) {
          setCheckInSelfie(response.data.image);
          setIsCheckInSelfieUploaded(true);
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
    if (showSelfieModal && !selfieImage) {
      setCameraError('');
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) videoRef.current.srcObject = stream;
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

  const breakAudioRef = useRef(null);

  useEffect(() => {
    let interval;
    if (activeBreak && activeBreak.startTime && !activeBreak.endTime) {
      const updateBreakTimer = () => {
        const elapsed = Math.floor((Date.now() - new Date(activeBreak.startTime).getTime()) / 1000);
        setBreakTimer(elapsed);

        // Only enforce limit on standard breaks (Lunch / Refreshment), ignore 'Other' breaks
        if (activeBreak.breakType === 'Other') return;

        // Calculate past completed standard breaks taken today
        let pastStandardBreakSecs = 0;
        if (todayAttendance?.breaks) {
          todayAttendance.breaks.forEach(b => {
            if (b.breakType === 'Other') return;
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
      updateBreakTimer();
      interval = setInterval(updateBreakTimer, 1000);
    } else {
      setBreakTimer(0);
      if (breakAudioRef.current) {
        breakAudioRef.current.pause();
        breakAudioRef.current.currentTime = 0;
        breakAudioRef.current = null;
      }
    }
    return () => {
      clearInterval(interval);
      if (breakAudioRef.current) {
        breakAudioRef.current.pause();
        breakAudioRef.current.currentTime = 0;
        breakAudioRef.current = null;
      }
    };
  }, [activeBreak, breakLimits]);

  const checkInIntervalRef = useRef(null);
  const checkedInThisSession = useRef(false);
  const [stats, setStats] = useState({
    presentToday: 0,
    absentToday: 0,
    activeProjects: 0,
    totalLeads: 0,
    totalActive: 0,
  });
  // Previous period values for dynamic percentage calculation
  const [prevStats, setPrevStats] = useState({
    presentToday: 0,
    absentToday: 0,
    activeProjects: 0,
    totalLeads: 0,
  });
  const [departmentData, setDepartmentData] = useState({ departments: [], counts: [], maleCounts: [], femaleCounts: [] });
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [projectStatusCounts, setProjectStatusCounts] = useState({ completed: 0, working: 0, canceled: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [recentGoals, setRecentGoals] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const isMounted = useRef(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear());
  const monthPickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) {
        setShowMonthPicker(false);
      }
    };
    if (showMonthPicker) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthPicker]);

  // Lead sources — populated from meta-leads/source-stats
  const [leadSources, setLeadSources] = useState([]);

  useEffect(() => { fetchAll(); }, []);

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

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    if (selectedMonth) fetchDepartmentData(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (!loading && !chartLoading && departmentData.departments.length > 0) renderChart();
    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [departmentData, loading, chartLoading]);

  const fetchDepartmentData = async (month) => {
    setChartLoading(true);
    try {
      const genderStats = await api.get(`/employees/gender-stats?month=${month}`)
        .catch(() => ({ data: { departments: [], overall: { total: 0, male: 0, female: 0 } } }));
      const depts = genderStats.data?.departments || [];
      const newData = {
        departments: depts.map(d => d.name),
        counts: depts.map(d => d.total),
        maleCounts: depts.map(d => d.male),
        femaleCounts: depts.map(d => d.female),
      };
      setDepartmentData(newData);
      setChartLoading(false);
      // Call renderChart directly with fresh data to avoid stale closure
      setTimeout(() => renderChart(newData), 0);
    } catch {
      setChartLoading(false);
    }
  };


  const fetchTodayAttendance = async () => {
    try {
      const response = await api.get('/attendance/today');
      if (response.data) {
        setTodayAttendance(response.data);
        if (response.data.breaks && response.data.breaks.length > 0) {
          const ongoingBreak = response.data.breaks.find(b => !b.endTime);
          setActiveBreak(ongoingBreak || null);
        } else {
          setActiveBreak(null);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      setTodayAttendance(null);
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
      await api.post('/attendance/break/end');
      if (breakAudioRef.current) {
        breakAudioRef.current.pause();
        breakAudioRef.current.currentTime = 0;
        breakAudioRef.current = null;
      }
      setActiveBreak(null);
      setBreakTimer(0);
      await fetchTodayAttendance();
      alert('Break ended successfully.');
    } catch (error) {
      console.error('Error ending break:', error);
      alert(error.response?.data?.message || 'Failed to end break. Please try again.');
    }
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
    if (isBeforeShiftStart()) {
      setErrorToast(`Check-in is unavailable before your check-in window opens. Window opens at: ${getCheckinWindowOpenTime()} (Shift starts: ${user?.shiftStartTime})`);
      return;
    }

    const currentReason = userLateReason || savedLateReason;

    // FIRST: If late, prompt for late reason BEFORE selfie/check-in!
    if (isLateCheckIn() && !currentReason) {
      setShowLateReasonModal(true);
      return;
    }

    if (!skipSelfieCheck && !isCheckInSelfieUploaded) {
      setErrorToast('Please capture and upload your check-in selfie before checking in.');
      setSelfieType('checkin');
      setShowSelfieModal(true);
      return;
    }

    try {
      checkedInThisSession.current = true;
      setCheckInTimer(0);
      if (!checkInIntervalRef.current) {
        checkInIntervalRef.current = setInterval(() => {
          setCheckInTimer(prev => prev + 1);
        }, 1000);
      }
      if (!cachedLocation) {
        checkedInThisSession.current = false;
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
        setCheckInTimer(0);
        setErrorToast('Location is still being determined. Please ensure location services are enabled and try again in a few seconds.');
        return;
      }
      const response = await api.post('/attendance/mark', {
        method: 'self-checkin',
        location: cachedLocation,
        lateReason: currentReason ? currentReason.trim() : null
      });
      if (response.data) {
        setTodayAttendance(response.data);
        setSuccessToast('Successfully Checked In!');
        fetchAll();
      }
    } catch (error) {
      checkedInThisSession.current = false;
      clearInterval(checkInIntervalRef.current);
      checkInIntervalRef.current = null;
      setCheckInTimer(0);
      const msg = error.response?.data?.message || '';
      if (msg.toLowerCase().includes('away') || msg.toLowerCase().includes('office')) {
        setErrorToast('Check-in failed. You must be inside the office bounds.');
      } else if (msg.toLowerCase().includes('late check-in reason') || msg.toLowerCase().includes('reason for checking in late')) {
        // Backend detected late check-in but frontend missed it — show the reason modal
        setSavedLateReason('');
        setLateReasonInput('');
        setShowLateReasonModal(true);
      } else {
        setErrorToast(msg || 'Failed to check in. Please try again.');
      }
    }
  };

  const handleCheckOut = async (skipSelfieCheck = false) => {
    if (!skipSelfieCheck && !isCheckOutSelfieUploaded) {
      setErrorToast("Please capture and upload your check-out selfie before checking out.");
      setSelfieType('checkout');
      setShowSelfieModal(true);
      return;
    }
    try {
      checkedInThisSession.current = false;
      if (checkInIntervalRef.current) {
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
      }
      setCheckInTimer(0);

      if (!cachedLocation) {
        setErrorToast('Location is still being determined. Please wait a moment.');
        return;
      }

      api.post('/attendance/checkout', { location: cachedLocation })
        .then(response => {
          if (response.data) {
            setTodayAttendance(response.data);
            setSuccessToast(`Checkout successful! Working Hours: ${response.data.workingHours} hrs`);
            fetchAll();
          }
        })
        .catch(err => {
          const msg = err.response?.data?.message || '';
          if (msg.toLowerCase().includes('away') || msg.toLowerCase().includes('office')) {
            setErrorToast('Checkout failed. You must be inside the office bounds.');
          } else {
            setErrorToast(msg || 'Failed to check out. Please try again.');
          }
        });
    } catch (error) {
      console.error('Error checking out:', error);
      setErrorToast(error.response?.data?.message || 'Failed to check out. Please try again.');
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch today\'s attendance first
      await fetchTodayAttendance();
      // Fetch current and previous stats in parallel (adjust endpoint as needed)
      const [attendanceStats, projects, metaLeadsResp, genderStats, prevStatsResp] = await Promise.all([
        api.get('/attendance/today-stats').catch(() => ({ data: { presentToday: 0, absentToday: 0 } })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/meta-leads?limit=10').catch(() => ({ data: { leads: [], total: 0 } })),
        api.get(`/employees/gender-stats?month=${selectedMonth}`).catch(() => ({ data: { departments: [], overall: { total: 0, male: 0, female: 0 } } })),
        api.get('/dashboard/previous-stats').catch(() => ({ data: { presentToday: 0, absentToday: 0, activeProjects: 0, totalLeads: 0 } })),
      ]);

      // Use meta-leads response for the Total Leads count
      const leadsArr = metaLeadsResp.data?.leads || (Array.isArray(metaLeadsResp.data) ? metaLeadsResp.data : []);
      const totalMetaLeads = metaLeadsResp.data?.pagination?.total ?? metaLeadsResp.data?.total ?? (Array.isArray(metaLeadsResp.data) ? metaLeadsResp.data.length : leadsArr.length);

      // Fetch recent activities
      const activitiesResp = await api.get('/activities').catch(() => ({ data: [] }));
      const activitiesData = Array.isArray(activitiesResp.data) ? activitiesResp.data : [];
      setRecentActivities(activitiesData);

      // Fetch today\'s goals
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const goalsResp = await api.get(`/goals?startDate=${todayStart.toISOString()}&endDate=${todayEnd.toISOString()}&limit=1000`).catch(() => ({ data: [] }));
      const goalsData = Array.isArray(goalsResp.data) ? goalsResp.data : [];
      const sortedGoals = [...goalsData].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRecentGoals(sortedGoals);

      // Fetch lead source stats
      const GAUGE_COLORS = ['#162a16', '#3b775e', '#a8e63d', '#0891b2', '#8b5cf6', '#f59e0b'];
      const sourceStatsResp = await api.get('/meta-leads/source-stats').catch(() => ({ data: { sources: [] } }));
      const rawSources = sourceStatsResp.data?.sources || [];
      setLeadSources(rawSources.map((s, i) => ({
        label: s.label,
        color: GAUGE_COLORS[i % GAUGE_COLORS.length],
        value: s.percent,
        count: s.count,
      })));

      // Count project statuses for pie chart
      let completed = 0, working = 0, canceled = 0;
      (projects.data || []).forEach(p => {
        if (['completed', 'done', 'finished'].includes((p.status || '').toLowerCase())) completed++;
        else if (['active', 'in-progress', 'working', 'progress'].includes((p.status || '').toLowerCase())) working++;
        else if (['canceled', 'cancelled', 'aborted'].includes((p.status || '').toLowerCase())) canceled++;
      });
      setProjectStatusCounts({ completed, working, canceled });

      const activeProjects = (projects.data || []).filter(
        p => p.status === 'active' || p.status === 'on-hold'
      ).length;

      setStats({
        presentToday: attendanceStats.data?.presentToday || 0,
        absentToday: attendanceStats.data?.absentToday || 0,
        activeProjects,
        totalLeads: totalMetaLeads,
        totalActive: attendanceStats.data?.totalActive || 0,
      });

      // Set previous stats for percentage calculation
      setPrevStats({
        presentToday: prevStatsResp.data?.presentToday || 0,
        absentToday: prevStatsResp.data?.absentToday || 0,
        activeProjects: prevStatsResp.data?.activeProjects || 0,
        totalLeads: prevStatsResp.data?.totalLeads || 0,
      });

      const depts = genderStats.data?.departments || [];
      setDepartmentData({
        departments: depts.map(d => d.name),
        counts: depts.map(d => d.total),
        maleCounts: depts.map(d => d.male),
        femaleCounts: depts.map(d => d.female),
      });
      // Prevent the selectedMonth useEffect from double-fetching on initial load
      // by setting departmentData here directly with the initial month
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const renderChart = (data) => {
    const chartData = data || departmentData;
    if (!chartRef.current || !window.Chart) return;
    if (chartInstance.current) chartInstance.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    const canvasHeight = chartRef.current.offsetHeight || 320;

    // Dynamic y-axis: spread the data to fill the chart height naturally
    const allVals = [...(chartData.counts || []), ...(chartData.maleCounts || []), ...(chartData.femaleCounts || [])];
    const dataMax = Math.max(...allVals, 1);
    const rawStep = dataMax <= 5 ? 1 : dataMax <= 20 ? 5 : dataMax <= 50 ? 10 : dataMax <= 100 ? 20 : 50;
    const suggestedMax = Math.ceil((dataMax * 1.6) / rawStep) * rawStep;

    // Strong gradient fills — bold wave style like the reference
    const makeGrad = (r, g, b, topAlpha, botAlpha) => {
      const g1 = ctx.createLinearGradient(0, 0, 0, canvasHeight);
      g1.addColorStop(0,    `rgba(${r},${g},${b},${topAlpha})`);
      g1.addColorStop(0.45, `rgba(${r},${g},${b},${topAlpha * 0.5})`);
      g1.addColorStop(1,    `rgba(${r},${g},${b},${botAlpha})`);
      return g1;
    };

    const crosshairPlugin = {
      id: 'crosshair',
      afterDraw(chart) {
        if (!chart.tooltip._active || !chart.tooltip._active.length) return;
        const c = chart.ctx;
        const x = chart.tooltip._active[0].element.x;
        c.save();
        c.beginPath();
        c.moveTo(x, chart.scales.y.top);
        c.lineTo(x, chart.scales.y.bottom);
        c.lineWidth = 1;
        c.strokeStyle = 'rgba(107,114,128,0.3)';
        c.setLineDash([5, 4]);
        c.stroke();
        c.restore();
      },
    };

    chartInstance.current = new window.Chart(ctx, {
      type: 'line',
      plugins: [crosshairPlugin],
      data: {
        labels: chartData.departments,
        datasets: [
          {
            label: 'Total',
            data: chartData.counts,
            borderColor: '#b2ff1e',
            backgroundColor: makeGrad(178, 255, 0, 0.55, 0.02),
            borderWidth: 2.5,
            tension: 0.5,
            cubicInterpolationMode: 'monotone',
            fill: 'origin',
            order: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#b2ff1e',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
          {
            label: 'Male',
            data: chartData.maleCounts,
            borderColor: '#3b775e',
            backgroundColor: makeGrad(59, 119, 94, 0.50, 0.02),
            borderWidth: 2.5,
            tension: 0.5,
            cubicInterpolationMode: 'monotone',
            fill: 'origin',
            order: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#3b775e',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
          {
            label: 'Female',
            data: chartData.femaleCounts,
            borderColor: '#ff9900',
            backgroundColor: makeGrad(255, 153, 0, 0.45, 0.02),
            borderWidth: 2.5,
            tension: 0.5,
            cubicInterpolationMode: 'monotone',
            fill: 'origin',
            order: 1,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: '#ff9900',
            pointHoverBorderColor: '#fff',
            pointHoverBorderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 8, right: 4, bottom: 0, left: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            padding: { top: 10, bottom: 10, left: 14, right: 16 },
            titleColor: '#111827',
            bodyColor: '#4b5563',
            titleFont: { size: 13, weight: '700', family: 'Inter, Segoe UI, Arial, sans-serif' },
            bodyFont: { size: 12, weight: '400', family: 'Inter, Segoe UI, Arial, sans-serif' },
            cornerRadius: 10,
            borderColor: '#e5e7eb',
            borderWidth: 1,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 5,
            caretSize: 5,
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => `  ${item.dataset.label}: ${item.parsed.y}`,
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            suggestedMax,
            ticks: {
              font: { size: 11, family: 'Inter, Segoe UI, Arial, sans-serif' },
              color: '#c4c9d4',
              stepSize: rawStep,
              padding: 12,
              maxTicksLimit: 5,
            },
            grid: {
              display: true,
              color: 'rgba(229,231,235,0.55)',
              lineWidth: 1,
            },
            border: { display: false },
          },
          x: {
            ticks: {
              font: { size: 11, family: 'Inter, Segoe UI, Arial, sans-serif' },
              color: '#c4c9d4',
              maxRotation: 0,
              minRotation: 0,
              padding: 8,
            },
            grid: { display: false },
            border: { display: false },
          },
        },
        interaction: { intersect: false, mode: 'index' },
        animation: { duration: 800, easing: 'easeInOutCubic' },
      },
    });
  };

  // Dynamic gauge arc helpers
  const gaugeArcPoint = (frac) => {
    const angle = Math.PI * (1 - frac);
    return [+(50 + 40 * Math.cos(angle)).toFixed(3), +(50 - 40 * Math.sin(angle)).toFixed(3)];
  };
  const gaugeArcPath = (fromFrac, toFrac) => {
    if (toFrac - fromFrac < 0.001) return '';
    const [x1, y1] = gaugeArcPoint(fromFrac);
    const [x2, y2] = gaugeArcPoint(toFrac);
    // The full gauge is only 180Â° (a semicircle), so any segment within it
    // is always â‰¤180Â° — large-arc-flag must always be 0.
    return `M${x1},${y1} A40,40 0 0,1 ${x2},${y2}`;
  };

  const formatTimeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const activityIconMap = {
    leave: { color: '#f59e0b', bg: '#fffbeb' },
    attendance: { color: '#16a34a', bg: '#f0fdf4' },
    project: { color: '#3b82f6', bg: '#eff6ff' },
    lead: { color: '#8b5cf6', bg: '#f5f3ff' },
    payroll: { color: '#0891b2', bg: '#ecfeff' },
    employee: { color: '#3b775e', bg: '#f0faf5' },
    default: { color: '#6b7280', bg: '#f3f4f6' },
  };

  const getActivityStyle = (type = '') => {
    const t = type.toLowerCase();
    const key = Object.keys(activityIconMap).find(k => t.includes(k)) || 'default';
    return activityIconMap[key];
  };

  const getActivityIcon = (type = '', color) => {
    const t = type.toLowerCase();
    if (t.includes('leave'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="4" width="18" height="18" rx="3" fill="#fbbf24" opacity="0.18"/>
          <rect x="3" y="4" width="18" height="18" rx="3" stroke="#f59e0b" strokeWidth="1.5" fill="none"/>
          <line x1="16" y1="2" x2="16" y2="6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="8" y1="2" x2="8" y2="6" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="3" y1="10" x2="21" y2="10" stroke="#f59e0b" strokeWidth="1.3"/>
          <rect x="7" y="13" width="3" height="3" rx="0.8" fill="#f59e0b"/>
          <rect x="11" y="13" width="3" height="3" rx="0.8" fill="#fcd34d"/>
          <rect x="7" y="17" width="3" height="2" rx="0.8" fill="#fcd34d"/>
        </svg>
      );
    if (t.includes('attendance'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" fill="#16a34a" opacity="0.14"/>
          <circle cx="12" cy="12" r="9" stroke="#16a34a" strokeWidth="1.5" fill="none"/>
          <circle cx="12" cy="12" r="2" fill="#16a34a"/>
          <line x1="12" y1="7" x2="12" y2="12" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="12" y1="12" x2="15.5" y2="14.5" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      );
    if (t.includes('project'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M3 7c0-1.1.9-2 2-2h4l2 2.5h8a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="#3b82f6" opacity="0.18"/>
          <path d="M3 7c0-1.1.9-2 2-2h4l2 2.5h8a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="#3b82f6" strokeWidth="1.5" fill="none"/>
          <line x1="8" y1="13" x2="16" y2="13" stroke="#60a5fa" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="8" y1="16" x2="13" y2="16" stroke="#93c5fd" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      );
    if (t.includes('lead'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="9" width="20" height="6" rx="3" fill="#8b5cf6" opacity="0.12"/>
          <polyline points="2 12 5.5 12 8 5 12 19 15 9 17.5 12 22 12" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <circle cx="8" cy="5" r="1.2" fill="#a78bfa"/>
          <circle cx="15" cy="9" r="1.2" fill="#a78bfa"/>
        </svg>
      );
    if (t.includes('payroll'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" fill="#0891b2" opacity="0.13"/>
          <circle cx="12" cy="12" r="9" stroke="#0891b2" strokeWidth="1.5" fill="none"/>
          <line x1="12" y1="6" x2="12" y2="18" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M15 9H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
      );
    if (t.includes('employee') || t.includes('joined') || t.includes('team') || t.includes('user'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.5" fill="#3b775e" opacity="0.2"/>
          <circle cx="12" cy="8" r="3.5" stroke="#3b775e" strokeWidth="1.5" fill="none"/>
          <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#3b775e" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <path d="M5 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="#3b775e" strokeWidth="1.5" strokeLinecap="round" fill="#3b775e" opacity="0.1"/>
        </svg>
      );
    if (t.includes('goal'))
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="#f97316" strokeWidth="1.5" fill="#fed7aa" opacity="0.9" fillOpacity="0.2"/>
          <circle cx="12" cy="12" r="6" stroke="#f97316" strokeWidth="1.3" fill="none"/>
          <circle cx="12" cy="12" r="3" stroke="#f97316" strokeWidth="1.2" fill="#fed7aa" fillOpacity="0.4"/>
          <circle cx="12" cy="12" r="1.5" fill="#f97316"/>
        </svg>
      );
    // default: info
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="#6b7280" opacity="0.12"/>
        <circle cx="12" cy="12" r="9" stroke="#6b7280" strokeWidth="1.5" fill="none"/>
        <circle cx="12" cy="8" r="1" fill="#6b7280"/>
        <line x1="12" y1="11" x2="12" y2="17" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  };

  // Helper to calculate percent change and arrow
  // Accepts a themeColor for positive values
  function getPercentChange(current, prev, themeColor = '#16a34a', themeBg = 'rgba(22,163,74,0.08)') {
    if (prev === 0 && current === 0) return { percent: '0%', color: '#6b7280', bg: '#f3f4f6', arrow: 'up' };
    if (prev === 0) return { percent: '+100%', color: themeColor, bg: themeBg, arrow: 'up' };
    const diff = current - prev;
    const pct = Math.round((diff / Math.abs(prev)) * 100);
    if (pct > 0) return { percent: `+${pct}%`, color: themeColor, bg: themeBg, arrow: 'up' };
    if (pct < 0) return { percent: `${pct}%`, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', arrow: 'down' };
    return { percent: '0%', color: '#6b7280', bg: '#f3f4f6', arrow: 'up' };
  }

  const cards = [
    {
      key: 'present',
      label: 'Present',
      value: stats.presentToday,
      icon: (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:'#a8e63d', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7.5" r="3.5" fill="#162a16"/>
            <path d="M2.5 19.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" fill="#162a16"/>
            <path d="M15 12.5l2.5 2.5 5-5" stroke="#162a16" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      ),
      featured: true,
      valueColor: 'white',
      ...getPercentChange(stats.presentToday, prevStats.presentToday, '#16a34a', 'rgba(22,163,74,0.08)'),
      percentText: 'from last month',
      trendIcon: <Users size={10} color="#a8e63d" />,
      trendText: `out of ${stats.totalActive} active`,
      trendColor: '#a8e63d',
      trendSuffix: 'employees in office',
    },
    {
      key: 'absent',
      label: 'Absent',
      value: stats.absentToday,
      icon: (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:'#3b775e', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="7.5" r="3.5" fill="#fff"/>
            <path d="M2.5 19.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" fill="#fff"/>
            <line x1="16.5" y1="10" x2="21.5" y2="15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="21.5" y1="10" x2="16.5" y2="15" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
        </span>
      ),
      featured: false,
      valueColor: '#111827',
      ...getPercentChange(stats.absentToday, prevStats.absentToday, '#ef4444', 'rgba(239,68,68,0.08)'),
      percentText: 'from last month',
      trendIcon: <TrendingDown size={10} color="#ef4444" />,
      trendText: `out of ${stats.totalActive} active`,
      trendColor: '#ef4444',
      trendSuffix: 'absent from office',
    },
    {
      key: 'leads',
      label: 'Total Leads',
      value: stats.totalLeads,
      icon: (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:'#3b775e', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="13" width="4" height="7" rx="1" fill="#fff"/>
            <rect x="10" y="8" width="4" height="12" rx="1" fill="#fff"/>
            <rect x="17" y="4" width="4" height="16" rx="1" fill="#fff"/>
          </svg>
        </span>
      ),
      featured: false,
      valueColor: '#111827',
      ...getPercentChange(stats.totalLeads, prevStats.totalLeads, '#0891b2', 'rgba(8,145,178,0.08)'),
      percentText: 'from last month',
      trendIcon: <TrendingUp size={10} color="#0891b2" />,
      trendText: 'assigned',
      trendColor: '#0891b2',
      trendSuffix: 'leads total',
    },
    {
      key: 'projects',
      label: 'Active Projects',
      value: stats.activeProjects,
      icon: (
        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:'50%', background:'#3b775e', flexShrink:0 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="8" width="18" height="12" rx="2" fill="#fff"/>
            <path d="M15 8V6a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            <line x1="8" y1="13" x2="16" y2="13" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.7"/>
            <line x1="8" y1="17" x2="13" y2="17" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5"/>
          </svg>
        </span>
      ),
      featured: false,
      valueColor: '#111827',
      ...getPercentChange(stats.activeProjects, prevStats.activeProjects, '#16a34a', 'rgba(22,163,74,0.08)'),
      percentText: 'from last month',
      trendIcon: <Activity size={10} color="#16a34a" />,
      trendText: 'in progress',
      trendColor: '#16a34a',
      trendSuffix: 'this month',
    },

  ];

  let totalBreakMins = 0;
  if (breakDetailsModal.breaks) {
    breakDetailsModal.breaks.forEach(b => {
      if (b.breakType !== 'Other') {
        const dur = b.duration !== undefined ? b.duration : Math.max(0, Math.floor((Date.now() - new Date(b.startTime).getTime()) / 60000));
        totalBreakMins += dur;
      }
    });
  }
  const limitMins = breakLimits?.totalBreakLimit || 60;
  const timeLeftMins = Math.max(0, limitMins - totalBreakMins);

  return (
    <div className="hr-page-wrapper page-container">
      <div className="admin-dashboard">

        {/* Header */}
        <div className="admin-dashboard-header">
          <div className="admin-dashboard-title">
            <BarChart2 size={18} color="#14532d" />
            <h2>HR Overview</h2>
          </div>
          <div className="hr-header-actions">
            {/* Check-in/Check-out Button */}
            {todayAttendance?.loginTime && !todayAttendance?.logoutTime ? (
              <span className="hr-checkout-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    if (isCheckInSelfieUploaded && isCheckOutSelfieUploaded) {
                      setShowSelfieModal(true);
                      return;
                    }
                    if (!isCheckInSelfieUploaded && isBeforeShiftStart()) {
                      setErrorToast(`Check-in selfie upload is unavailable before your check-in window opens. Window opens at: ${getCheckinWindowOpenTime()} (Shift starts: ${user?.shiftStartTime})`);
                      return;
                    }
                    if (!isCheckInSelfieUploaded && isLateCheckIn() && !savedLateReason) {
                      setShowLateReasonModal(true);
                      return;
                    }
                    if (!isCheckInSelfieUploaded) {
                      setSelfieType('checkin');
                    } else if (!isCheckOutSelfieUploaded) {
                      setSelfieType('checkout');
                    }
                    
                    if (cachedLocation) {
                      const OFFICE_LAT = 28.62886;
                      const OFFICE_LNG = 77.38141;
                      const R = 6371e3;
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
                    
                    setShowSelfieModal(true);
                  }}
                  style={{
                    background: (isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? '#dcfce7' : '#e0f2fe',
                    color: (isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? '#166534' : '#0284c7',
                    padding: '0 12px', height: '36px', borderRadius: '8px',
                    fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    border: 'none', cursor: 'pointer', gap: '4px'
                  }}
                >
                  {(isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? <><CheckCircle2 size={14} /> Selfies Uploaded</> : <><Camera size={14} /> Upload {(isCheckInSelfieUploaded && !isCheckOutSelfieUploaded) ? 'Check-out' : 'Check-in'} Selfie</>}
                </button>
                <button
                  onClick={() => handleCheckOut(false)}
                  className="hr-btn-checkout"
                >
                  <LogIn size={14} style={{ transform: 'rotate(180deg)' }} /> Check Out
                </button>
                {todayAttendance?.loginTime && !todayAttendance?.logoutTime && (
                  <span className="hr-timer">
                    {new Date(checkInTimer * 1000).toISOString().substr(11, 8)}
                  </span>
                )}
              </span>
            ) : (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    if (!isCheckInSelfieUploaded) {
                      setSelfieType('checkin');
                    } else if (!isCheckOutSelfieUploaded) {
                      setSelfieType('checkout');
                    }
                    
                    if (cachedLocation) {
                      const OFFICE_LAT = 28.62886;
                      const OFFICE_LNG = 77.38141;
                      const R = 6371e3;
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
                    
                    setShowSelfieModal(true);
                  }}
                  style={{
                    background: (isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? '#dcfce7' : '#e0f2fe',
                    color: (isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? '#166534' : '#0284c7',
                    padding: '0 12px', height: '36px', borderRadius: '8px',
                    fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    border: 'none', cursor: 'pointer', gap: '4px'
                  }}
                >
                  {(isCheckInSelfieUploaded && isCheckOutSelfieUploaded) ? <><CheckCircle2 size={14} /> Selfies Uploaded</> : <><Camera size={14} /> Upload {(isCheckInSelfieUploaded && !isCheckOutSelfieUploaded) ? 'Check-out' : 'Check-in'} Selfie</>}
                </button>
                <button
                  onClick={() => handleCheckIn()}
                  className="hr-btn-checkin"
                  disabled={isBeforeShiftStart()}
                  title={isBeforeShiftStart() ? `You can only check-in from ${user?.shiftStartTime}` : ''}
                  style={isBeforeShiftStart() ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  <LogIn size={14} /> Check In
                </button>
              </div>
            )}
            <button className="admin-refresh-btn" onClick={handleRefresh} disabled={refreshing || loading} style={{ boxShadow: 'none' }}>
              {refreshing
                ? <span className="admin-skeleton" style={{ width: 62, height: 16, borderRadius: 5, display: 'inline-block' }} />
                : <><RefreshCw size={13} /> Refresh</>}
            </button>
              
              {/* --- FANCY BREAK BADGES & BUTTONS --- */}
              {todayAttendance?.loginTime && !todayAttendance?.logoutTime && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div
                        onClick={() => setBreakDetailsModal({ visible: true, type: 'All Breaks', breaks: todayAttendance.breaks || [] })}
                        style={{
                          background: '#c4ef4e', color: '#1e293b', padding: '0 16px', height: '36px', borderRadius: '999px',
                          fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', boxSizing: 'border-box', cursor: 'pointer', gap: '6px'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg> Break Details
                      </div>
                  {activeBreak ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        background: '#fef3c7', color: '#d97706', padding: '0 16px', height: '36px', borderRadius: '999px',
                        fontSize: '13.5px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        border: '1px solid #fde68a', boxSizing: 'border-box', fontVariantNumeric: 'tabular-nums'
                      }}>
                        <Hourglass size={14} /> {new Date(breakTimer * 1000).toISOString().substr(11, 8)}
                      </div>
                      <button 
                        onClick={handleBreakEnd}
                        style={{
                          background: '#ef4444', color: 'white', border: 'none', borderRadius: '999px', padding: '0 16px', height: '36px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s ease', cursor: 'pointer', boxSizing: 'border-box'
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
                        background: 'transparent', color: '#f59e0b', border: '1.5px solid #f59e0b', borderRadius: '999px', padding: '0 16px', height: '36px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s ease', cursor: 'pointer', boxSizing: 'border-box'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f59e0b'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f59e0b'; }}
                    >
                      <Hourglass size={14} /> Take Break
                    </button>
                  )}
                </div>
              )}
          </div>{/* end hr-header-actions */}
        </div>{/* end admin-dashboard-header */}

          <div className="admin-right-card admin-dept-chart">
            <div className="admin-right-card-header">
              <h4 className="admin-right-card-title">Department</h4>
              <div style={{ position: 'relative' }} ref={monthPickerRef}>
                <button
                  onClick={() => setShowMonthPicker(v => !v)}
                  style={{
                    background: selectedMonth ? '#edffd1' : '#f3f4f6',
                    border: selectedMonth ? '1px solid #c8f07a' : '1px solid #e5e7eb',
                    borderRadius: 20, padding: '2px 10px', fontSize: 11.5, fontWeight: 600,
                    color: selectedMonth ? '#3b775e' : '#6b7280', cursor: 'pointer'
                  }}
                >
                  {selectedMonth
                    ? new Date(selectedMonth + '-01').toLocaleString('default', { month: 'short', year: 'numeric' })
                    : 'All time'}
                </button>
                {showMonthPicker && (
                  <div style={{
                    position: 'absolute', right: 0, top: 28, zIndex: 100, background: '#fff',
                    border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 4px 18px rgba(0,0,0,0.10)',
                    padding: '12px 12px 8px', minWidth: 200
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const now = new Date();
                        const year = now.getFullYear();
                        const val = `${year}-${String(i + 1).padStart(2, '0')}`;
                        const label = new Date(year, i, 1).toLocaleString('default', { month: 'short' });
                        const isSelected = selectedMonth === val;
                        return (
                          <button
                            key={val}
                            onClick={() => { setSelectedMonth(val); setShowMonthPicker(false); }}
                            style={{
                              background: isSelected ? '#3b775e' : 'none',
                              color: isSelected ? '#fff' : '#374151',
                              border: 'none', borderRadius: 6, padding: '4px 2px',
                              fontSize: 12, cursor: 'pointer', fontWeight: isSelected ? 700 : 400
                            }}
                          >{label}</button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
                      <button
                        onClick={() => { setSelectedMonth(''); setShowMonthPicker(false); }}
                        style={{ background: 'none', border: 'none', fontSize: 12, color: '#9ca3af', cursor: 'pointer', fontWeight: 500 }}
                      >Clear</button>
                      <button
                        onClick={() => {
                          const n = new Date();
                          setSelectedMonth(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`);
                          setShowMonthPicker(false);
                        }}
                        style={{ background: 'none', border: 'none', fontSize: 12, color: '#3b775e', cursor: 'pointer', fontWeight: 700 }}
                      >This month</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="admin-right-card-dots"><span /><span /><span /></div>
            </div>
              {loading || chartLoading ? (
                <div style={{ padding: '10px 4px 4px' }}>
                  {/* Legend skeleton */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>

                    {[44, 36, 48].map((w, i) => (
                      <div className="admin-skeleton" key={i} style={{ height: 20, width: w, borderRadius: 20 }} />
                    ))}
                  </div>
                  {/* Chart area skeleton — bars rising from bottom */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 180, padding: '0 8px' }}>
                    {[60, 90, 45, 110, 70, 130, 55, 95].map((h, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'stretch' }}>
                        <div className="admin-skeleton" style={{ height: h, borderRadius: '6px 6px 2px 2px' }} />
                        <div className="admin-skeleton" style={{ height: 10, borderRadius: 4 }} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : departmentData.departments.length === 0 ? (
                <div className="admin-chart-empty">No department data available</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {/* Custom Legend */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 6, paddingRight: 4, marginBottom: 10 }}>
                    {[
                      { label: 'Total',  color: '#edffd1', textColor: '#4a7c10', border: '#c8f07a' },
                      { label: 'Male',   color: '#e0f0ea', textColor: '#2d5e48', border: '#a8d4c0' },
                      { label: 'Female', color: '#fff3e0', textColor: '#c06800', border: '#ffd08a' },
                    ].map(({ label, color, textColor, border }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 7px', borderRadius: 20, background: color, border: `1px solid ${border}` }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: textColor, letterSpacing: 0.2 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  {/* Chart */}
                  <div className="admin-chart-wrapper admin-chart-wrapper--expanded">
                    <canvas ref={chartRef} />
                  </div>
                </div>
              )}
            </div>

          {/* Project Status Donut */}
          <div className="admin-right-card admin-project-status">
              <div className="admin-right-card-header">
                <h4 className="admin-right-card-title">Project Status</h4>
                <div className="admin-right-card-dots"><span /><span /><span /></div>
              </div>
              {loading ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
                    <div className="admin-skeleton" style={{ width: 100, height: 100, borderRadius: '50%' }} />
                  </div>
                  <div className="admin-donut-legend">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="admin-donut-legend-row">
                        <div className="admin-skeleton" style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                        <div className="admin-skeleton" style={{ height: 10, flex: 1, borderRadius: 5, margin: '0 8px' }} />
                        <div className="admin-skeleton" style={{ width: 28, height: 10, borderRadius: 5 }} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="admin-pie-chart-wrap">
                    {(() => {
                      const total = projectStatusCounts.completed + projectStatusCounts.working + projectStatusCounts.canceled;
                      const topPct = total
                        ? Math.round((Math.max(projectStatusCounts.completed, projectStatusCounts.working, projectStatusCounts.canceled) / total) * 100)
                        : 0;
                      const topLabel = total
                        ? (projectStatusCounts.working >= projectStatusCounts.completed && projectStatusCounts.working >= projectStatusCounts.canceled
                            ? 'Working'
                            : projectStatusCounts.completed >= projectStatusCounts.canceled
                              ? 'Done'
                              : 'Canceled')
                        : '';
                      return (
                        <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Pie
                            data={{
                              labels: ['Completed', 'Working', 'Canceled'],
                              datasets: [{
                                data: [projectStatusCounts.completed, projectStatusCounts.working, projectStatusCounts.canceled],
                                backgroundColor: ['#10b981', '#3b775e', '#a8e63d'],
                                borderColor: '#fff',
                                borderWidth: 3,
                                hoverOffset: 6,
                              }],
                            }}
                            options={{
                              cutout: '68%',
                              plugins: {
                                legend: { display: false },
                                tooltip: {
                                  callbacks: {
                                    label: (ctx) => {
                                      const t = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                      const pct = t ? ((ctx.parsed / t) * 100).toFixed(1) : 0;
                                      return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
                                    },
                                  },
                                },
                              },
                            }}
                            width={140}
                            height={140}
                          />
                          {/* Centre label */}
                          <div style={{
                            position: 'absolute',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            pointerEvents: 'none',
                          }}>
                            <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1, letterSpacing: '-0.5px' }}>
                              {topPct}<span style={{ fontSize: 11, fontWeight: 600 }}>%</span>
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 600, color: '#6b7280', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{topLabel}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="admin-donut-legend">
                    {(() => {
                      const total = projectStatusCounts.completed + projectStatusCounts.working + projectStatusCounts.canceled;
                      return [
                        { label: 'Completed', color: '#10b981', value: projectStatusCounts.completed },
                        { label: 'Working',   color: '#3b775e', value: projectStatusCounts.working },
                        { label: 'Canceled',  color: '#a8e63d', value: projectStatusCounts.canceled },
                      ].map((item) => (
                        <div key={item.label} className="admin-donut-legend-row">
                          <span className="admin-donut-legend-dot" style={{ background: item.color }} />
                          <span className="admin-donut-legend-label">{item.label}</span>
                          <span className="admin-donut-legend-value">{total ? Math.round((item.value / total) * 100) : 0}%</span>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
          </div>{/* end project status */}

          {/* Leads Source */}
          <div className="admin-right-card admin-leads-section">
              <div className="admin-right-card-header">
                <h4 className="admin-right-card-title">Leads Source</h4>
                <div className="admin-right-card-dots"><span /><span /><span /></div>
              </div>
              {loading ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '10px 0 6px' }}>
                    <div className="admin-skeleton" style={{ width: 84, height: 42, borderRadius: 8 }} />
                    <div className="admin-skeleton" style={{ width: 80, height: 10, borderRadius: 5, marginTop: 8 }} />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    {[...Array(3)].map((_, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                        <div className="admin-skeleton" style={{ width: 7, height: 7, borderRadius: '50%', marginRight: 7, flexShrink: 0 }} />
                        <div className="admin-skeleton" style={{ height: 10, flex: 1, borderRadius: 5, marginRight: 4 }} />
                        <div className="admin-skeleton" style={{ width: 28, height: 10, borderRadius: 5 }} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Semi-circular gauge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '14px 0 8px' }}>
                    <div style={{ position: 'relative', width: 104, height: 52, marginBottom: 8 }}>
                      <svg width="104" height="52" viewBox="0 0 100 50">
                        {/* Background track */}
                        <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                        {/* Dynamic colored arcs */}
                        {(() => {
                          const total = leadSources.reduce((s, x) => s + x.value, 0);
                          if (!total) return null;
                          let cum = 0;
                          return leadSources.map((src) => {
                            const frac = src.value / 100;
                            const path = gaugeArcPath(cum, cum + frac);
                            cum += frac;
                            return path ? (
                              <path key={src.label} d={path} fill="none" stroke={src.color} strokeWidth="10" />
                            ) : null;
                          });
                        })()}
                      </svg>
                      {/* Center total */}
                      <span style={{
                        position: 'absolute', left: 0, right: 0, top: 32,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 19, color: '#162a16',
                        letterSpacing: '-1px', lineHeight: 1.1, fontFamily: 'inherit', width: '100%'
                      }}>
                        {leadSources.reduce((a, b) => a + b.value, 0)}<span style={{ fontSize: 12, fontWeight: 600, marginLeft: 1 }}>%</span>
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: '#6b7280', marginTop: 0 }}>of leads tracked</span>
                  </div>
                  {/* Legend */}
                  <div style={{ marginTop: 12 }}>
                    {leadSources.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '8px 0' }}>No data</div>
                    ) : leadSources.map((src) => (
                      <div key={src.label} style={{ display: 'flex', alignItems: 'center', marginBottom: 9, fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: src.color, display: 'inline-block', marginRight: 8, flexShrink: 0 }} />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={src.label}>{src.label}</span>
                        <span style={{ fontWeight: 600, color: '#162a16', marginLeft: 4 }}>{src.value}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
          </div>{/* end leads source */}

          {/* â”€â”€ ROW 2 LEFT: Today's Tasks table â”€â”€ */}
          <div className="admin-left-bottom">
            <div className="hr-tasks-card">
              <h2>
                <Target size={16} style={{ color: '#3b775e' }} /> Today's Tasks
              </h2>
              <div className="hr-tasks-table-wrap">
              {loading ? (
                <table className="hr-tasks-table">
                  <thead>
                    <tr>
                      <th>Project / Task</th>
                      <th>Employee</th>
                      <th>Complete</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(3)].map((_, idx) => (
                      <tr key={idx}>
                        <td><div className="admin-skeleton" style={{ height: 10, width: '60%', borderRadius: 4 }} /></td>
                        <td><div className="admin-skeleton" style={{ height: 10, width: '50%', borderRadius: 4 }} /></td>
                        <td><div className="admin-skeleton" style={{ height: 10, width: '30%', borderRadius: 4 }} /></td>
                        <td><div className="admin-skeleton" style={{ height: 10, width: '40%', borderRadius: 4 }} /></td>
                        <td><div className="admin-skeleton" style={{ height: 20, width: '70px', borderRadius: 6 }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : recentGoals.length > 0 ? (
                <table className="hr-tasks-table">
                  <thead>
                    <tr>
                      <th>Project / Task</th>
                      <th>Employee</th>
                      <th>Complete</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentGoals.map((goal, idx) => {
                      const completedCount = goal.goals?.filter(g => g.isCompleted).length || 0;
                      const totalCount = goal.goals?.length || 0;
                      const computedStatus =
                        totalCount === 0 ? 'Pending'
                        : completedCount === totalCount ? 'Completed'
                        : completedCount > 0 ? 'In Progress'
                        : 'Pending';
                      const statusConfig = {
                        'Completed':   { bg: '#d1fae5', color: '#047857' },
                        'In Progress': { bg: '#dbeafe', color: '#1d4ed8' },
                        'Pending':     { bg: '#fef3c7', color: '#d97706' },
                      };
                      const statusStyle = statusConfig[computedStatus] || { bg: '#f3f4f6', color: '#6b7280' };
                      const projectName = goal.projectName
                        || goal.projects?.[0]?.projectName
                        || goal.projects?.[0]?.projectId?.name
                        || goal.project?.name
                        || goal.goals?.[0]?.projectName
                        || goal.goals?.[0]?.projectId?.name
                        || goal.goals?.[0]?.name
                        || '—';
                      const employeeName = goal.employee
                        ? `${goal.employee.firstName || ''} ${goal.employee.lastName || ''}`.trim()
                        : `${goal.createdBy?.firstName || ''} ${goal.createdBy?.lastName || ''}`.trim() || '—';
                      return (
                        <tr key={goal._id}>
                          <td style={{ fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectName}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{employeeName}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600, color: completedCount === totalCount && totalCount > 0 ? '#047857' : '#374151' }}>{completedCount}</span>
                            <span style={{ color: '#9ca3af' }}>/{totalCount}</span>
                          </td>
                          <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{new Date(goal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                          <td>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: statusStyle.bg,
                              color: statusStyle.color,
                              whiteSpace: 'nowrap',
                            }}>
                              {computedStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>No task created today</div>
              )}
              </div>
            </div>
          </div>{/* end left-bottom */}

          {/* â”€â”€ ROW 2 RIGHT: Recent Activity â”€â”€ */}
          <div className="admin-right-bottom">
            <div className="admin-right-card admin-right-card--grow">
              <div className="admin-right-card-header">
                <h4 className="admin-right-card-title">Recent Activity</h4>
                <div className="admin-right-card-dots"><span /><span /><span /></div>
              </div>
              {loading ? (
                <div style={{ marginTop: 6 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: i < 4 ? '1px solid #f3f4f6' : 'none' }}>
                      <div className="admin-skeleton" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="admin-skeleton" style={{ height: 11, width: '75%', borderRadius: 5, marginBottom: 4 }} />
                        <div className="admin-skeleton" style={{ height: 9, width: '45%', borderRadius: 5 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivities.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: '24px 0' }}>No recent activity</div>
              ) : (
                <div className="no-scrollbar admin-activity-scroll" style={{ marginTop: 6 }}>
                  {recentActivities.map((activity, i) => {
                    const activityText = activity.description || activity.title || activity.action || activity.type || '—';
                    const style = getActivityStyle(activity.type || activityText);
                    const timeStr = activity.timestamp || activity.createdAt;
                    const userName = activity.user?.firstName
                      ? `${activity.user.firstName} ${activity.user.lastName || ''}`.trim()
                      : activity.performedBy || '';
                    return (
                      <div key={activity._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: i < recentActivities.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {getActivityIcon(activity.type || activityText, style.color)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 500, color: '#111827', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {activity.description || activity.action || activity.type || '—'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            {userName && <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 500 }}>{userName}</span>}
                            {userName && timeStr && <span style={{ fontSize: 10, color: '#d1d5db' }}>·</span>}
                            {timeStr && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 10, color: '#9ca3af' }}>
                                <Clock size={9} color="#9ca3af" />{formatTimeAgo(timeStr)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>{/* end right-bottom */}

        </div>{/* end outer layout */}

      
      {/* Break Selection Modal */}
      {showBreakModal && (() => {
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

              <form onSubmit={handleBreakStart}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Break Type <span style={{ color: '#ef4444' }}>*</span></label>
                  <BreakDropdown
                    value={breakForm.type}
                    onChange={(val) => setBreakForm({ ...breakForm, type: val })}
                    disabledOptions={disabledBreakOptions}
                  />
                </div>

                {(breakForm.type === 'Briefing/Meeting' || breakForm.type === 'Breifing/Meeting' || breakForm.type === 'Other') && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Reason <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea
                      rows={3}
                      value={breakForm.reason}
                      onChange={(e) => setBreakForm({ ...breakForm, reason: e.target.value })}
                      placeholder="Enter briefing agenda / meeting details..."
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#0f172a', background: '#f8fafc', outline: 'none', resize: 'vertical' }}
                      required
                    ></textarea>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px' }}>
                  <button type="button" onClick={() => setShowBreakModal(false)} style={{ padding: '10px 22px', border: '1px solid #e2e8f0', background: '#fff', borderRadius: '10px', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>Cancel</button>
                  <button type="submit" style={{ padding: '10px 22px', border: 'none', background: '#f59e0b', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '14px', boxShadow: '0 2px 8px rgba(245,158,11,0.25)' }}>Start Break</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Break Details Info Modal */}
      {breakDetailsModal.visible && (() => {
        let totalBreakSecs = 0;
        if (breakDetailsModal.breaks) {
          breakDetailsModal.breaks.forEach(b => {
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

        const formatDurationHMS = (seconds) => {
          const s = Math.max(0, Math.floor(seconds || 0));
          const hrs = Math.floor(s / 3600);
          const mins = Math.floor((s % 3600) / 60);
          const secs = s % 60;
          return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        };

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
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }} onClick={() => setBreakDetailsModal({ visible: false, type: '', breaks: [] })}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 12px 40px rgba(15,23,42,0.16)', padding: '26px', width: '840px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={18} strokeWidth={2} />
                  </div>
                  <h3 style={{ margin: '0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Break Details</h3>
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
                  Today's Taken Breaks ({breakDetailsModal.breaks?.length || 0})
                </div>
                {breakDetailsModal.breaks && breakDetailsModal.breaks.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '235px', overflowY: 'auto', paddingRight: '6px' }}>
                    {breakDetailsModal.breaks.map((b, idx) => {
                      const startMs = new Date(b.startTime).getTime();
                      const endMs = b.endTime ? new Date(b.endTime).getTime() : Date.now();
                      const durSecs = Math.max(0, Math.floor((endMs - startMs) / 1000));
                      const displayType = b.breakType === 'Tea Break' ? 'Refreshment Break' : (b.breakType || `Break ${idx + 1}`);
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
                    No {breakDetailsModal.type}s taken yet today.
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
      })()}

      {/* Active Break Glassmorphism Screen */}
      {activeBreak && !hideBreakScreen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(255, 255, 255, 0.25)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.4s ease'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '24px', opacity: 0.8 }}>
              <Clock size={40} color="#334155" strokeWidth={1.5} />
            </div>
            <h1 style={{ fontSize: '26px', color: '#0f172a', margin: '0 0 6px 0', fontWeight: 600, letterSpacing: '-0.3px' }}>On Break</h1>
            <p style={{ fontSize: '15px', color: '#475569', margin: '0 0 36px 0', fontWeight: 500 }}>{activeBreak.type === 'Tea Break' ? 'Refreshment Break' : activeBreak.type}</p>
            
            <div style={{ fontSize: '64px', fontWeight: '300', color: '#0f172a', fontVariantNumeric: 'tabular-nums', margin: '0 0 44px 0', letterSpacing: '-1.5px' }}>
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
      )}

      {/* Selfie Upload Modal */}
      {showSelfieModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '24px', width: '850px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                  <Camera size={20} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 700 }}>Attendance Selfies</h3>
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
                                handleCheckIn(true);
                              })
                              .catch(err => {
                                console.error('Error uploading selfie:', err);
                                setErrorToast(err.response?.data?.message || 'Failed to upload selfie to database. Please try again.');
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
                                handleCheckOut(true);
                              })
                              .catch(err => {
                                console.error('Error uploading selfie:', err);
                                setErrorToast(err.response?.data?.message || 'Failed to upload selfie to database. Please try again.');
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
          </div>
        </div>
      )}

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
          animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
          animation: 'fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
                    setErrorToast('Please enter a reason for late check-in.');
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

      </div>
  );
}

export default HRDashboard;
