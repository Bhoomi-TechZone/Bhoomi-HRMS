import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, Target, CheckCircle2, Camera, Loader2, Clock, LogIn, LogOut, Timer, BarChart2, RefreshCw, CalendarDays, Activity, FileText, XCircle, Hourglass, AlertTriangle, Coffee, Utensils } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './MarketingDashboard.css';
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

function MarketingDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceStats, setAttendanceStats] = useState({
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    lateMarks: 0
  });
  const [broadcastCount, setBroadcastCount] = useState(0);
  const [goalsCount, setGoalsCount] = useState(0);
  const [goalsList, setGoalsList] = useState([]);
  const [leavesList, setLeavesList] = useState([]);
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

  useEffect(() => {
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
  
  // Selfie Camera Access
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

        // Only enforce limit on standard breaks (Lunch / Refreshment), ignore 'Other' and 'Briefing/Meeting' breaks
        if (activeBreak.breakType === 'Other' || activeBreak.breakType === 'Briefing/Meeting' || activeBreak.breakType === 'Breifing/Meeting') return;

        // Calculate past completed standard breaks taken today
        let pastStandardBreakSecs = 0;
        if (todayAttendance?.breaks) {
          todayAttendance.breaks.forEach(b => {
            if (b.breakType === 'Other' || b.breakType === 'Briefing/Meeting' || b.breakType === 'Breifing/Meeting') return;
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

  useEffect(() => {
    fetchDashboardData();
    return () => {
      if (checkInIntervalRef.current) {
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
      }
    };
  }, []);

  // Update working hours counter every second (live)
  useEffect(() => {
    if (!todayAttendance?.loginTime) {
      setCurrentWorkingHours('0:00:00');
      return;
    }

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

  // Timer logic
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

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [todayRes, statsRes, broadcastsRes, goalsRes, leavesRes] = await Promise.all([
        api.get('/attendance/today').catch(() => ({ data: null })),
        api.get('/attendance/my-stats').catch(() => ({ data: {} })),
        api.get('/broadcasts').catch(() => ({ data: [] })),
        api.get('/goals').catch(() => ({ data: [] })),
        api.get('/leaves').catch(() => ({ data: [] }))
      ]);
      setTodayAttendance(todayRes.data || null);
      if (todayRes.data && todayRes.data.breaks && todayRes.data.breaks.length > 0) {
        const ongoingBreak = todayRes.data.breaks.find(b => !b.endTime);
        setActiveBreak(ongoingBreak || null);
      } else {
        setActiveBreak(null);
      }
      setAttendanceStats({
        presentDays: statsRes.data?.presentDays || 0,
        absentDays: statsRes.data?.absentDays || 0,
        halfDays: statsRes.data?.halfDays || 0,
        lateMarks: statsRes.data?.lateMarks || 0
      });
      setBroadcastCount(Array.isArray(broadcastsRes.data) ? broadcastsRes.data.length : 0);
      const goalsData = Array.isArray(goalsRes.data) ? goalsRes.data : [];
      setGoalsCount(goalsData.length);
      setGoalsList(goalsData);
      setLeavesList(Array.isArray(leavesRes.data) ? leavesRes.data : []);
    } catch (error) {
      console.error('Error fetching marketing dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
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
      if (!cachedLocation) {
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
        fetchDashboardData();
      }
    } catch (error) {
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
      if (!cachedLocation) {
        setErrorToast('Location is still being determined. Please wait a moment.');
        return;
      }
      api.post('/attendance/checkout', { location: cachedLocation })
        .then(response => {
          if (response.data) {
            setTodayAttendance(response.data);
            setSuccessToast(`Checkout successful! Working Hours: ${response.data.workingHours} hrs`);
            fetchDashboardData();
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

  const formatTime = (time) => {
    if (!time) return '—';
    return new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatTimer = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const attendanceStatusLabel = useMemo(() => {
    if (!todayAttendance) return 'Not Checked In';
    if (todayAttendance.logoutTime) return 'Checked Out';
    if (todayAttendance.status === 'late-checkin') return 'Late Check-in';
    if (todayAttendance.status === 'early-checkin') return 'Early Check-in';
    return 'Checked In';
  }, [todayAttendance]);

  const attendanceStatusColor = useMemo(() => {
    if (!todayAttendance) return '#6b7280';
    if (todayAttendance.logoutTime) return '#3b775e';
    if (todayAttendance.status === 'late-checkin') return '#f59e0b';
    if (todayAttendance.status === 'early-checkin') return '#0ea5e9';
    return '#16a34a';
  }, [todayAttendance]);

  const totalDays = attendanceStats.presentDays + attendanceStats.absentDays + attendanceStats.halfDays;

  let lunchCount = 0, teaCount = 0, otherCount = 0;
  if (todayAttendance?.breaks) {
    todayAttendance.breaks.forEach(b => {
      if (b.breakType === 'Lunch Break') lunchCount++;
      else if (b.breakType === 'Tea Break') teaCount++;
      else if (b.breakType === 'Other') otherCount++;
    });
  }

  const availableBreakOptions = [];
  if (teaCount < 2) availableBreakOptions.push('Tea Break');
  if (lunchCount < 1) availableBreakOptions.push('Lunch Break');
  availableBreakOptions.push('Other');

  const cards = [
    {
      key: 'announcements',
      label: 'Announcements',
      value: broadcastCount,
      featured: true,
      iconBg: '#a8e63d',
      icon: <Megaphone size={14} color="#162a16" />,
      bubbleColor: '#a8e63d',
      trendText: 'total broadcasts',
    },
    {
      key: 'tasks',
      label: 'Total Tasks',
      value: goalsCount,
      featured: false,
      iconBg: '#3b775e',
      icon: <Target size={14} color="#fff" />,
      bubbleColor: '#3b775e',
      trendText: 'goals assigned',
      trendColor: '#3b775e',
    },
    {
      key: 'present',
      label: 'Present Days',
      value: attendanceStats.presentDays,
      featured: false,
      iconBg: '#16a34a',
      icon: <CheckCircle2 size={14} color="#fff" />,
      bubbleColor: '#16a34a',
      trendText: 'this month',
      trendColor: '#16a34a',
    },
    {
      key: 'absent',
      label: 'Absent Days',
      value: attendanceStats.absentDays,
      featured: false,
      iconBg: '#ef4444',
      icon: <XCircle size={14} color="#fff" />,
      bubbleColor: '#ef4444',
      trendText: 'this month',
      trendColor: '#ef4444',
    },
  ];

  const summaryItems = [
    {
      label: 'Present',
      value: attendanceStats.presentDays,
      color: '#10b981',
      pct: totalDays ? Math.round((attendanceStats.presentDays / totalDays) * 100) : 0,
    },
    {
      label: 'Absent',
      value: attendanceStats.absentDays,
      color: '#ef4444',
      pct: totalDays ? Math.round((attendanceStats.absentDays / totalDays) * 100) : 0,
    },
    {
      label: 'Half Day',
      value: attendanceStats.halfDays,
      color: '#f59e0b',
      pct: totalDays ? Math.round((attendanceStats.halfDays / totalDays) * 100) : 0,
    },
    {
      label: 'Late Marks',
      value: attendanceStats.lateMarks,
      color: '#8b5cf6',
      pct: attendanceStats.presentDays
        ? Math.min(100, Math.round((attendanceStats.lateMarks / attendanceStats.presentDays) * 100))
        : 0,
    },
  ];

  const recentActivity = useMemo(() => {
    const items = [];
    if (todayAttendance?.loginTime) {
      items.push({ id: 'ci', type: 'checkin', label: 'Checked in', sub: new Date(todayAttendance.loginTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), date: new Date(todayAttendance.loginTime) });
    }
    if (todayAttendance?.logoutTime) {
      items.push({ id: 'co', type: 'checkout', label: 'Checked out', sub: new Date(todayAttendance.logoutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }), date: new Date(todayAttendance.logoutTime) });
    }
    goalsList.forEach(g => {
      const name = g.goals?.map(t => t.name).join(', ') || 'Task';
      items.push({ id: 'g-' + g._id, type: 'task', label: 'Task created', sub: name.length > 32 ? name.slice(0, 32) + '\u2026' : name, date: new Date(g.createdAt) });
    });
    leavesList.forEach(l => {
      items.push({ id: 'l-' + l._id, type: 'leave', label: `${l.leaveType} applied`, sub: `${new Date(l.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2014 ${l.status}`, date: new Date(l.createdAt) });
    });
    return items.sort((a, b) => b.date - a.date).slice(0, 7);
  }, [todayAttendance, goalsList, leavesList]);

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
    <div className="page-container marketing-dashboard-root" style={{ padding: '20px 24px', background: '#f4f7f0', minHeight: '100vh' }}>
      <div className="mk-dashboard">

        {/* ── Header ── */}
        <div className="mk-dashboard-header">
          <div className="mk-dashboard-title">
            <BarChart2 size={18} color="#14532d" />
            <h2>Marketing Dashboard</h2>
          </div>
          <button
            className="mk-refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            style={{ boxShadow: 'none' }}
          >
            {refreshing
              ? <span className="mk-skeleton" style={{ width: 62, height: 16, borderRadius: 5, display: 'inline-block' }} />
              : <><RefreshCw size={13} /> Refresh</>}
          </button>
        </div>

        {/* ── Outer 2-col layout ── */}
        <div className="mk-outer-layout">

          {/* ── LEFT COLUMN ── */}
          <div className="mk-left-col">

            {/* Stat Cards */}
            <div className="mk-stats-grid">
              {cards.map((card) => (
                <div
                  key={card.key}
                  className={`mk-stat-card${card.featured ? ' mk-stat-card--featured' : ''}`}
                  style={{ '--bubble-color': card.bubbleColor }}
                >
                  <div className="mk-card-top">
                    <span className={`mk-card-label${card.featured ? ' mk-card-label--featured' : ''}`}>
                      {card.label}
                    </span>
                    <span className="mk-card-icon" style={{ background: card.iconBg }}>
                      {card.icon}
                    </span>
                  </div>
                  {loading ? (
                    <>
                      <div className="mk-skeleton" style={{ height: 22, width: '55%', borderRadius: 6, margin: '6px 0 4px' }} />
                      <div className="mk-skeleton" style={{ height: 11, width: '70%', borderRadius: 5 }} />
                    </>
                  ) : (
                    <>
                      <p
                        className="mk-card-value"
                        style={{ color: card.featured ? '#ffffff' : '#111827' }}
                      >
                        {card.value}
                      </p>
                      <div
                        className="mk-card-trend"
                        style={{ color: card.featured ? 'rgba(255,255,255,0.75)' : '#9ca3af' }}
                      >
                        {card.trendText}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Today Attendance Card */}
            <div className="mk-attendance-card">
              <div className="mk-attendance-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CalendarDays size={19} color="#16a34a" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 className="mk-section-title">Today's Attendance</h3>
                    <p className="mk-section-subtitle">
                      {loading ? (
                        <span className="mk-skeleton" style={{ width: 90, height: 20, borderRadius: 20, display: 'inline-block' }} />
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '2px 10px', borderRadius: 20,
                          background: todayAttendance?.logoutTime ? '#d1fae5' : todayAttendance?.loginTime ? '#dcfce7' : '#f3f4f6',
                          color: attendanceStatusColor,
                          fontWeight: 600, fontSize: 11,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: attendanceStatusColor, display: 'inline-block' }} />
                          {attendanceStatusLabel}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Action button */}
                {!loading && (
                  <div>
                    {!todayAttendance?.loginTime ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                          className="mk-btn mk-btn-checkin" 
                          onClick={() => handleCheckIn()}
                          disabled={isBeforeShiftStart()}
                          title={isBeforeShiftStart() ? `You can only check-in from ${user?.shiftStartTime}` : ''}
                          style={isBeforeShiftStart() ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                        >
                          <LogIn size={14} /> Check In
                        </button>
                      </div>
                    ) : !todayAttendance?.logoutTime ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {(() => {
                          if (!todayAttendance || !todayAttendance.loginTime || todayAttendance.logoutTime) return null;
                          return (
                            <div
                              onClick={() => setBreakDetailsModal({ visible: true, type: 'All Breaks', breaks: todayAttendance.breaks || [] })}
                              style={{
                                background: '#c4ef4e', color: '#1e293b', padding: '0 16px', height: '36px', borderRadius: '999px',
                                fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', boxSizing: 'border-box', cursor: 'pointer', gap: '6px'
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M12 11h4"></path><path d="M12 16h4"></path><path d="M8 11h.01"></path><path d="M8 16h.01"></path></svg> Break Details
                            </div>
                          );
                        })()}
                        {activeBreak ? (
                          <button className="mk-btn mk-btn-checkout" style={{ background: '#fef3c7', color: '#d97706', borderColor: '#fde68a' }} onClick={handleBreakEnd}>
                            <Hourglass size={14} /> Stop Break ({new Date(breakTimer * 1000).toISOString().substr(11, 8)})
                          </button>
                        ) : (
                          <button className="mk-btn mk-btn-checkout" style={{ background: '#fff', color: '#d97706', borderColor: '#fde68a' }} onClick={handleOpenBreakModal}>
                            <Hourglass size={14} /> Take Break
                          </button>
                        )}
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
                        <button className="mk-btn mk-btn-checkout" onClick={() => handleCheckOut(false)}>
                          <LogOut size={14} /> Check Out
                        </button>
                      </div>
                    ) : (
                      <button className="mk-btn mk-btn-done" disabled>
                        Day Completed
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Time info grid */}
              <div className="mk-time-grid">
                <div className="mk-time-cell">
                  <span className="mk-time-label">Check-in Time</span>
                  {loading
                    ? <div className="mk-skeleton" style={{ height: 22, width: 80, borderRadius: 5, marginTop: 4 }} />
                    : <b className="mk-time-value">{formatTime(todayAttendance?.loginTime)}</b>}
                </div>
                <div className="mk-time-cell">
                  <span className="mk-time-label">Check-out Time</span>
                  {loading
                    ? <div className="mk-skeleton" style={{ height: 22, width: 80, borderRadius: 5, marginTop: 4 }} />
                    : <b className="mk-time-value">{formatTime(todayAttendance?.logoutTime)}</b>}
                </div>
                <div className="mk-time-cell">
                  <span className="mk-time-label">Working Hours</span>
                  {loading
                    ? <div className="mk-skeleton" style={{ height: 22, width: 80, borderRadius: 5, marginTop: 4 }} />
                    : <b className="mk-time-value">{todayAttendance?.logoutTime ? (todayAttendance?.workingHours ? `${todayAttendance.workingHours} hrs` : '—') : currentWorkingHours}</b>}
                </div>
                <div className="mk-time-cell">
                  <span className="mk-time-label">Status</span>
                  {loading
                    ? <div className="mk-skeleton" style={{ height: 22, width: 70, borderRadius: 5, marginTop: 4 }} />
                    : (
                      <span className={`mk-status-badge mk-status-badge--${todayAttendance?.status || 'none'}`}>
                        {todayAttendance?.status
                          ? todayAttendance.status.charAt(0).toUpperCase() + todayAttendance.status.slice(1)
                          : '—'}
                      </span>
                    )}
                </div>
                <div className="mk-time-cell mk-time-cell--timer">
                  <span className="mk-time-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Timer size={12} /> Live Timer
                  </span>
                  {loading
                    ? <div className="mk-skeleton" style={{ height: 22, width: 100, borderRadius: 5, marginTop: 4 }} />
                    : <b className="mk-time-value mk-timer-value">{formatTimer(checkInTimer)}</b>}
                </div>
              </div>
            </div>

            {/* Tasks Table */}
            <div className="mk-attendance-card" style={{ marginTop: 0 }}>
              <div className="mk-attendance-card-header" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Target size={19} color="#3b775e" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 className="mk-section-title">My Tasks</h3>
                    <p className="mk-section-subtitle">Tasks assigned to you</p>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>
                  {goalsCount} total
                </span>
              </div>

              {loading ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Task', 'Project', 'Date', 'Progress'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(3)].map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {[...Array(4)].map((__, j) => (
                          <td key={j} style={{ padding: '10px 12px' }}><div className="mk-skeleton" style={{ height: 10, width: j === 0 ? '70%' : '50%', borderRadius: 4 }} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : goalsList.length === 0 ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No tasks found</div>
              ) : (
                <div className="custom-scrollbar" style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>#</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>Task</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>Project</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goalsList.map((goal, idx) => {
                        const total = goal.goals?.length || 0;
                        const done = goal.goals?.filter(g => g.isCompleted).length || 0;
                        const pct = total ? Math.round((done / total) * 100) : 0;
                        const projectName = goal.projectName || goal.project?.name || '—';
                        const taskNames = goal.goals?.map(g => g.name).join(', ') || '—';
                        return (
                          <tr key={goal._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            <td style={{ padding: '10px 12px', color: '#9ca3af', fontSize: 11 }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 500, maxWidth: 220 }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }} title={taskNames}>
                                {taskNames}
                              </div>
                              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{total} sub-task{total !== 1 ? 's' : ''}</div>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{projectName}</td>
                            <td style={{ padding: '10px 12px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                              {goal.createdAt ? new Date(goal.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                            </td>
                            <td style={{ padding: '10px 12px', minWidth: 110 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 5, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10b981' : '#a8e63d', borderRadius: 99, transition: 'width 0.4s' }} />
                                </div>
                                <span style={{ fontSize: 10, fontWeight: 700, color: pct === 100 ? '#10b981' : '#3b775e', minWidth: 28 }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Leaves Table */}
            <div className="mk-attendance-card" style={{ marginTop: 0 }}>
              <div className="mk-attendance-card-header" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CalendarDays size={19} color="#3b775e" style={{ flexShrink: 0 }} />
                  <div>
                    <h3 className="mk-section-title">My Leaves</h3>
                    <p className="mk-section-subtitle">Your leave history</p>
                  </div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, background: '#f0fdf4', color: '#16a34a', padding: '3px 10px', borderRadius: 20, border: '1px solid #bbf7d0' }}>
                  {leavesList.length} total
                </span>
              </div>

              {loading ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Type', 'From', 'To', 'Days', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(3)].map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {[...Array(5)].map((__, j) => (
                          <td key={j} style={{ padding: '10px 12px' }}><div className="mk-skeleton" style={{ height: 10, width: j === 3 ? '30%' : '60%', borderRadius: 4 }} /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : leavesList.length === 0 ? (
                <div style={{ padding: '28px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No leave records found</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>Type</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>From</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>To</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>Days</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>Reason</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leavesList.map((leave, idx) => {
                        const start = new Date(leave.startDate);
                        const end = new Date(leave.endDate);
                        const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
                        const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const statusColors = {
                          approved: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
                          pending:  { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
                          rejected: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }
                        };
                        const sc = statusColors[leave.status] || statusColors.pending;
                        return (
                          <tr key={leave._id} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>
                            <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 500, whiteSpace: 'nowrap' }}>{leave.leaveType}</td>
                            <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmt(start)}</td>
                            <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmt(end)}</td>
                            <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 600, textAlign: 'center' }}>{days}</td>
                            <td style={{ padding: '10px 12px', color: '#6b7280', maxWidth: 180 }}>
                              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }} title={leave.reason}>{leave.reason || '—'}</div>
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: 20, border: `1px solid ${sc.border}`, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                                {leave.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>{/* end left col */}

          {/* ── RIGHT PANEL ── */}
          <div className="mk-right-panel">

            {/* Monthly Summary */}
            <div className="mk-right-card">
              <div className="mk-right-card-header">
                <h4 className="mk-right-card-title">Monthly Summary</h4>
                <div className="mk-right-card-dots"><span /><span /><span /></div>
              </div>
              {loading ? (
                <div style={{ marginTop: 6 }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                      <div className="mk-skeleton" style={{ width: 8, height: 8, borderRadius: '50%', marginRight: 8, flexShrink: 0 }} />
                      <div className="mk-skeleton" style={{ height: 10, flex: 1, borderRadius: 5, marginRight: 8 }} />
                      <div className="mk-skeleton" style={{ width: 24, height: 10, borderRadius: 5 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mk-summary-list">
                  {summaryItems.map((item) => (
                    <div key={item.label} className="mk-summary-row">
                      <div className="mk-summary-label-wrap">
                        <span className="mk-summary-dot" style={{ background: item.color }} />
                        <span className="mk-summary-label">{item.label}</span>
                      </div>
                      <div className="mk-summary-bar-wrap">
                        <div className="mk-summary-bar" style={{ width: `${item.pct}%`, background: item.color }} />
                      </div>
                      <span className="mk-summary-val">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile / Welcome card */}
            <div className="mk-right-card mk-profile-card">
              <div className="mk-right-card-header" style={{ marginBottom: 14 }}>
                <h4 className="mk-right-card-title">My Profile</h4>
                <div className="mk-right-card-dots"><span /><span /><span /></div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="mk-avatar">
                  {(user?.firstName || 'U').charAt(0).toUpperCase()}
                </div>
                <p className="mk-profile-name">
                  {user?.firstName} {user?.lastName || ''}
                </p>
                <p className="mk-profile-role">{user?.role?.name || 'Marketing'}</p>
                <div className="mk-profile-divider" />
                <p className="mk-profile-date">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <div className="mk-profile-stats">
                  <div>
                    <strong>{attendanceStats.presentDays}</strong>
                    <span>Present</span>
                  </div>
                  <div>
                    <strong>{attendanceStats.absentDays}</strong>
                    <span>Absent</span>
                  </div>
                  <div>
                    <strong>{goalsCount}</strong>
                    <span>Tasks</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="mk-right-card" style={{ flex: 1 }}>
              <div className="mk-right-card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Activity size={14} color="#3b775e" />
                  <h4 className="mk-right-card-title">Recent Activity</h4>
                </div>
                <div className="mk-right-card-dots"><span /><span /><span /></div>
              </div>
              {loading ? (
                <div style={{ marginTop: 4 }}>
                  {[...Array(5)].map((_, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'flex-start' }}>
                      <div className="mk-skeleton" style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div className="mk-skeleton" style={{ height: 10, width: '70%', borderRadius: 4, marginBottom: 5 }} />
                        <div className="mk-skeleton" style={{ height: 8, width: '50%', borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No recent activity</div>
              ) : (
                <div style={{ position: 'relative', maxHeight: '400px', overflowY: 'auto', paddingRight: '10px' }}>
                  <div style={{ position: 'absolute', left: 13, top: 0, bottom: 0, width: 1, background: '#e5e7eb', zIndex: 0 }} />
                  {recentActivity.map((item, idx) => {
                    const iconMap = {
                      checkin:  { icon: <LogIn  size={13} />, bg: '#dcfce7', color: '#16a34a', border: '#bbf7d0' },
                      checkout: { icon: <LogOut size={13} />, bg: '#fee2e2', color: '#dc2626', border: '#fecaca' },
                      task:     { icon: <Target size={13} />, bg: '#f0fdf4', color: '#3b775e', border: '#d1fae5' },
                      leave:    { icon: <FileText size={13} />, bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
                    };
                    const ic = iconMap[item.type] || iconMap.task;
                    const isToday = item.date.toDateString() === new Date().toDateString();
                    const timeStr = isToday
                      ? item.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                      : item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <div key={item.id} style={{ display: 'flex', gap: 10, marginBottom: idx < recentActivity.length - 1 ? 14 : 0, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div style={{ width: 27, height: 27, borderRadius: '50%', background: ic.bg, color: ic.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1.5px solid ${ic.border}` }}>
                          {ic.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{item.label}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.sub}>{item.sub}</div>
                        </div>
                        <div style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap', marginTop: 3, flexShrink: 0 }}>{timeStr}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>{/* end right panel */}

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

      {/* Selfie Modal */}
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
    </div>
  );
}

export default MarketingDashboard;
