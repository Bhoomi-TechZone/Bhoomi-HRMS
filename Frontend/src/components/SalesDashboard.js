import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Chart } from 'chart.js/auto';
import { createPortal } from 'react-dom';
import { LogIn, Timer, Hourglass, XCircle, Clock, Camera, CheckCircle2, Loader2, RefreshCw, AlertTriangle, Coffee, Utensils } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './SalesDashboard.css';

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

function SalesDashboard() {
  const { user } = useAuth();
  const [isNarrowScreen, setIsNarrowScreen] = useState(() => {
    return window.innerWidth <= 1280;
  });
  const [loading, setLoading] = useState(true);
  const [leadStats, setLeadStats] = useState({ total: 0, byStatus: {} });
  const [dealStats, setDealStats] = useState({});
  const [myLeads, setMyLeads] = useState([]);
  const [metaLeads, setMetaLeads] = useState([]);
  const [salesAnalytics, setSalesAnalytics] = useState({});
  const [recentActivities, setRecentActivities] = useState([]);

  // Attendance states
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [checkInTimer, setCheckInTimer] = useState(0);
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
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get('/attendance/break-limits').then(res => {
      if (res.data) {
        setBreakLimits(res.data);
      }
    }).catch(() => { });

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
  const checkedInThisSession = useRef(false);
  const [personalAttendance, setPersonalAttendance] = useState({ presentDays: 0, absentDays: 0, halfDays: 0, lateMarks: 0 });
  const [generalStats, setGeneralStats] = useState({
    activeProjects: 0, upcomingDeadlines: 0, goals: 0, broadcasts: 0,
    pendingApprovals: 0, pendingLeaves: 0
  });
  const [weeklyAnalytics, setWeeklyAnalytics] = useState({ days: [], goalsCompleted: [], completedProjects: [], newJoining: [], upcomingDeadlines: [] });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [showLateReasonModal, setShowLateReasonModal] = useState(false);
  const [lateReasonInput, setLateReasonInput] = useState('');
  const [savedLateReason, setSavedLateReason] = useState('');

  // Chart refs
  const pipelineChartRef = useRef(null);
  const pipelineChartInst = useRef(null);
  const leadStagesChartRef = useRef(null);
  const leadStagesChartInst = useRef(null);
  const personalChartRef = useRef(null);
  const personalChartInst = useRef(null);
  const weeklyChartRef = useRef(null);
  const weeklyChartInst = useRef(null);

  // Timer logic
  // Rules: only Lunch/Tea breaks pause this timer; Other breaks do not.
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

      const updateTimer = () => {
        const shiftStart = parseShiftStartTime();
        const shiftEndStr = todayAttendance?.shiftEndTime || user?.shiftEndTime;
        let shiftEnd = null;
        if (shiftEndStr && shiftEndStr !== 'Not Assigned') {
          try {
            const match = String(shiftEndStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (match) {
              let hours = parseInt(match[1], 10);
              const minutes = parseInt(match[2], 10);
              const period = match[3] ? match[3].toUpperCase() : null;
              if (period === 'PM' && hours !== 12) hours += 12;
              else if (period === 'AM' && hours === 12) hours = 0;
              const d = new Date(todayAttendance.loginTime);
              d.setHours(hours, minutes, 0, 0);
              if (d < new Date(todayAttendance.loginTime)) d.setDate(d.getDate() + 1);
              shiftEnd = d;
            }
          } catch (e) { }
        }

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
        let deductSecs = 0;

        if (todayAttendance.breaks && todayAttendance.breaks.length > 0) {
          todayAttendance.breaks.forEach(b => {
            if (b.breakType === 'Other' || b.breakType === 'Briefing/Meeting' || b.breakType === 'Breifing/Meeting') return; // ignore Other & Briefing/Meeting breaks

            let breakDur = 0;
            if (b.endTime) {
              breakDur = Math.round((new Date(b.endTime) - new Date(b.startTime)) / 1000);
            } else {
              // Active: pause by subtracting full elapsed
              const breakEnd = todayAttendance.logoutTime ? new Date(todayAttendance.logoutTime) : new Date();
              const cappedBreakEnd = shiftEnd && breakEnd > shiftEnd ? shiftEnd : breakEnd;
              breakDur = Math.round((cappedBreakEnd - new Date(b.startTime)) / 1000);
            }
            deductSecs += Math.max(0, breakDur);
          });
        }

        // Only deduct actual break time taken — break limit is for enforcement/warning only
        let totalDeductSecs = deductSecs;
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
  }, [todayAttendance, activeBreak, breakLimits]);

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
      const attendanceData = {
        method: 'self-checkin',
        lateReason: currentReason ? currentReason.trim() : null
      };

      if (!cachedLocation) {
        checkedInThisSession.current = false;
        clearInterval(checkInIntervalRef.current);
        checkInIntervalRef.current = null;
        setCheckInTimer(0);
        setErrorToast('Location is still being determined. Please ensure location services are enabled and try again in a few seconds.');
        return;
      }

      api.post('/attendance/mark', { ...attendanceData, location: cachedLocation })
        .then(response => {
          if (response.data) {
            setTodayAttendance(response.data);
            setSuccessToast('Successfully Checked In!');
            fetchAll();
          }
        })
        .catch(err => {
          checkedInThisSession.current = false;
          clearInterval(checkInIntervalRef.current);
          checkInIntervalRef.current = null;
          setCheckInTimer(0);
          const msg = err.response?.data?.message || '';
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
        });
    } catch (error) {
      console.error('Error checking in:', error);
      checkedInThisSession.current = false;
      clearInterval(checkInIntervalRef.current);
      checkInIntervalRef.current = null;
      setCheckInTimer(0);
      const errMsg = error.response?.data?.message || '';
      if (errMsg.toLowerCase().includes('late check-in reason') || errMsg.toLowerCase().includes('reason for checking in late')) {
        setSavedLateReason('');
        setLateReasonInput('');
        setShowLateReasonModal(true);
      } else {
        setErrorToast(errMsg || 'Failed to check in. Please try again.');
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
  };  const fetchAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const [
        metaStatsRes, dealStatsRes, myLeadsRes, leadAssignmentsRes, metaLeadsRes, analyticsRes, activitiesRes,
        attendanceRes, attendanceStatsRes, broadcastsRes, goalsRes, leavesRes, projectsRes, requestsRes, employeesRes
      ] = await Promise.all([
        api.get('/meta-leads/stats').catch(() => ({ data: { total: 0, byStatus: {} } })),
        api.get('/deals/stats/overview').catch(() => ({ data: {} })),
        api.get('/leads').catch(() => ({ data: [] })),
        api.get('/lead-assignments/my-leads').catch(() => ({ data: [] })),
        api.get('/meta-leads?limit=500').catch(() => ({ data: { leads: [] } })),
        api.get('/sales-reports/analytics/dashboard').catch(() => ({ data: {} })),
        api.get('/activities').catch(() => ({ data: [] })),
        api.get('/attendance/today').catch(() => ({ data: null })),
        api.get('/attendance/my-stats').catch(() => ({ data: {} })),
        api.get('/broadcasts').catch(() => ({ data: [] })),
        api.get('/goals').catch(() => ({ data: [] })),
        api.get('/leaves').catch(() => ({ data: [] })),
        api.get('/projects').catch(() => ({ data: [] })),
        api.get('/requests').catch(() => ({ data: [] })),
        api.get('/employees').catch(() => ({ data: [] })),
      ]);

      setLeadStats(metaStatsRes.data);
      setDealStats(dealStatsRes.data);

      const regularLeads = Array.isArray(myLeadsRes.data) ? myLeadsRes.data : [];
      const assignedLeads = Array.isArray(leadAssignmentsRes.data) ? leadAssignmentsRes.data : [];
      const combinedLeads = [...regularLeads, ...assignedLeads];
      setMyLeads(combinedLeads);

      const normalizedMetaLeads = Array.isArray(metaLeadsRes.data?.leads)
        ? metaLeadsRes.data.leads
        : Array.isArray(metaLeadsRes.data?.data)
          ? metaLeadsRes.data.data
          : Array.isArray(metaLeadsRes.data)
            ? metaLeadsRes.data
            : [];
      setMetaLeads(normalizedMetaLeads);

      setSalesAnalytics(analyticsRes.data || {});
      setRecentActivities((activitiesRes.data || []).slice(0, 8));

      setTodayAttendance(attendanceRes.data || null);
      if (attendanceRes.data && attendanceRes.data.breaks && attendanceRes.data.breaks.length > 0) {
        const ongoingBreak = attendanceRes.data.breaks.find(b => !b.endTime);
        setActiveBreak(ongoingBreak || null);
      } else {
        setActiveBreak(null);
      }
      setPersonalAttendance({
        presentDays: attendanceStatsRes.data?.presentDays || 0,
        absentDays: attendanceStatsRes.data?.absentDays || 0,
        halfDays: attendanceStatsRes.data?.halfDays || 0,
        lateMarks: attendanceStatsRes.data?.lateMarks || 0,
      });

      const activeProjects = projectsRes.data.filter(p => {
        const isActive = p.status === 'active' || p.status === 'on-hold';
        const isAssigned = p.assignedEmployees?.some(e => e._id === user?._id || e === user?._id) ||
          p.createdBy?._id === user?._id || p.createdBy === user?._id;
        return isActive && isAssigned;
      });
      setGeneralStats({
        activeProjects: activeProjects.length,
        upcomingDeadlines: projectsRes.data.filter(p => {
          if (p.deadline && p.status !== 'completed') {
            const d = new Date(p.deadline);
            const t = new Date(); t.setHours(0, 0, 0, 0);
            const e = new Date(t); e.setHours(23, 59, 59, 999);
            return d >= t && d <= e;
          }
          return false;
        }).length,
        goals: goalsRes.data.length || 0,
        broadcasts: broadcastsRes.data.length || 0,
        pendingApprovals: [...leavesRes.data.filter(l => l.status === 'pending'), ...requestsRes.data.filter(r => r.status === 'pending')].length,
        pendingLeaves: leavesRes.data.filter(l => l.status === 'pending').length,
      });

      computeWeeklyAnalytics(goalsRes.data, employeesRes.data, projectsRes.data);

      const sortedLeaves = [...leavesRes.data].sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
      setRecentLeaves(sortedLeaves.slice(0, 5));

    } catch (err) {
      console.error('Sales dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  const computeWeeklyAnalytics = (goalsData, employeesData, projectsData) => {
    const gData = Array.isArray(goalsData) ? goalsData : [];
    const eData = Array.isArray(employeesData) ? employeesData : [];
    const pData = Array.isArray(projectsData) ? projectsData : [];

    const daysLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const gc = [], cp = [], nj = [], ud = [];
    const now = new Date();
    const day = now.getDay();
    const mon = new Date(now);
    mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));

    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(mon.getDate() + i);
      const ds = new Date(d); ds.setHours(0, 0, 0, 0);
      const de = new Date(d); de.setHours(23, 59, 59, 999);

      let totalGoals = 0;
      gData.forEach(g => g.goals?.forEach(item => {
        if (item.isCompleted && item.completedAt) {
          const cd = new Date(item.completedAt);
          if (cd >= ds && cd <= de) totalGoals++;
        }
      }));

      gc.push(totalGoals);
      cp.push(pData.filter(p => p.status === 'completed' && p.updatedAt && new Date(p.updatedAt) >= ds && new Date(p.updatedAt) <= de).length);
      nj.push(eData.filter(e => { const jd = new Date(e.joiningDate || e.createdAt); return jd >= ds && jd <= de; }).length);
      ud.push(pData.filter(p => { if (!p.deadline) return false; const dl = new Date(p.deadline); dl.setHours(0, 0, 0, 0); return dl.getTime() === ds.getTime(); }).length);
    }
    setWeeklyAnalytics({ days: daysLabels, goalsCompleted: gc, completedProjects: cp, newJoining: nj, upcomingDeadlines: ud });
  };

  useEffect(() => { fetchAll(true); }, [fetchAll]);

  useEffect(() => {
    const onResize = () => setIsNarrowScreen(window.innerWidth <= 1280);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Derived stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const todayExcelLeads = myLeads.filter(l => {
    const d = new Date(l.createdAt);
    return d >= today && d <= endOfDay;
  }).length;

  const todayMetaLeads = metaLeads.filter(l => {
    if (Array.isArray(l.history)) {
      return l.history.some(h => {
        const hd = new Date(h.date);
        return (h.action === 'Assignment Update' || h.action === 'Assignment') && hd >= today && hd <= endOfDay;
      });
    }
    const d = new Date(l.updatedAt || l.createdAt);
    return d >= today && d <= endOfDay;
  }).length;

  const todayLeads = todayExcelLeads + todayMetaLeads;

  const normalizeLeadStatus = (status) => {
    if (!status || typeof status !== 'string') return 'New';
    const normalized = status.trim().toLowerCase();
    const statusMap = {
      new: 'New',
      contacted: 'Contacted',
      qualified: 'Qualified',
      interested: 'Interested',
      'follow-up': 'Follow-up',
      followup: 'Follow-up',
      converted: 'Converted',
      'not interested': 'Not Interested',
      notinterested: 'Not Interested',
      closed: 'Closed',
    };
    return statusMap[normalized] || 'New';
  };

  const combinedByStatus = useMemo(() => {
    const counts = {};

    (Array.isArray(metaLeads) ? metaLeads : []).forEach((lead) => {
      const key = normalizeLeadStatus(lead?.status);
      counts[key] = (counts[key] || 0) + 1;
    });

    (Array.isArray(myLeads) ? myLeads : []).forEach((lead) => {
      const key = normalizeLeadStatus(lead?.status);
      counts[key] = (counts[key] || 0) + 1;
    });

    if (Object.keys(counts).length === 0 && leadStats.byStatus) {
      Object.entries(leadStats.byStatus).forEach(([status, value]) => {
        const key = normalizeLeadStatus(status);
        counts[key] = (counts[key] || 0) + (Number(value) || 0);
      });
    }

    return counts;
  }, [metaLeads, myLeads, leadStats.byStatus]);

  const listBasedTotalLeads = (Array.isArray(metaLeads) ? metaLeads.length : 0) + (Array.isArray(myLeads) ? myLeads.length : 0);
  const totalLeads = listBasedTotalLeads > 0 ? listBasedTotalLeads : ((leadStats.total || 0) + myLeads.length);
  const convertedLeads = combinedByStatus.Converted || 0;
  const winRate = dealStats.winRate || (totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0);
  const closedWon = dealStats.closedWon || 0;

  // Pipeline stages data
  const stageOrder = ['New', 'Contacted', 'Qualified', 'Interested', 'Follow-up', 'Converted', 'Not Interested', 'Closed'];
  const stageData = useMemo(
    () => stageOrder.map((s) => combinedByStatus[s] || 0),
    [combinedByStatus]
  );

  // Charts hooks
  useEffect(() => {
    if (loading) return;
    if (pipelineChartRef.current) {
      if (pipelineChartInst.current) pipelineChartInst.current.destroy();
      const ctx = pipelineChartRef.current.getContext('2d');

      const gradients = [
        { start: '#14532d', end: '#166534' },
        { start: '#166534', end: '#15803d' },
        { start: '#15803d', end: '#16a34a' },
        { start: '#16a34a', end: '#22c55e' },
        { start: '#65a30d', end: '#84cc16' },
        { start: '#15803d', end: '#22c55e' },
        { start: '#ef4444', end: '#dc2626' },
        { start: '#6b7280', end: '#4b5563' },
      ];

      const backgroundColors = gradients.map(grad => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, grad.start);
        gradient.addColorStop(1, grad.end);
        return gradient;
      });

      pipelineChartInst.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: stageOrder,
          datasets: [{
            label: 'Leads',
            data: stageData,
            backgroundColor: backgroundColors,
            borderRadius: 8,
            borderSkipped: false,
            barThickness: window.innerWidth <= 480 ? 20 : window.innerWidth <= 768 ? 28 : 40,
            hoverBackgroundColor: [
              '#14532d', '#166534', '#15803d', '#16a34a',
              '#65a30d', '#22c55e', '#dc2626', '#4b5563'
            ],
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              titleFont: { size: 15, weight: 'bold', family: 'Inter' },
              bodyFont: { size: 14, weight: 'bold', family: 'Inter' },
              padding: 14,
              cornerRadius: 8,
              borderColor: '#166534',
              borderWidth: 2,
              displayColors: true,
              boxWidth: 12,
              boxHeight: 12,
              boxPadding: 6,
              callbacks: {
                title: (items) => items[0].label,
                label: (item) => ` ${item.formattedValue} Leads`
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                color: '#64748b',
                font: { size: 13, weight: 'bold', family: 'Inter' },
                stepSize: 1,
                padding: 8
              },
              grid: {
                color: 'rgba(226, 232, 240, 0.5)',
                drawBorder: false,
                lineWidth: 1
              },
              border: { display: false }
            },
            x: {
              ticks: {
                color: '#1f2937',
                font: { size: 12, weight: 'bold', family: 'Inter' },
                maxRotation: 45,
                minRotation: 45,
                padding: 8
              },
              grid: { display: false },
              border: { display: false }
            }
          },
          animation: {
            duration: 800,
            easing: 'easeInOutQuart'
          }
        }
      });
    }
    return () => { if (pipelineChartInst.current) pipelineChartInst.current.destroy(); };
  }, [loading, stageData]);

  useEffect(() => {
    if (loading) return;
    if (leadStagesChartRef.current) {
      if (leadStagesChartInst.current) leadStagesChartInst.current.destroy();
      const ctx = leadStagesChartRef.current.getContext('2d');
      const activeStages = stageOrder.filter(s => (combinedByStatus[s] || 0) > 0);
      const activeData = activeStages.map(s => combinedByStatus[s]);
      const colors = {
        New: '#14532d', Contacted: '#166534', Qualified: '#15803d', Interested: '#16a34a',
        'Follow-up': '#65a30d', Converted: '#22c55e', 'Not Interested': '#ef4444', Closed: '#6b7280'
      };
      leadStagesChartInst.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: activeStages.length > 0 ? activeStages : ['No Data'],
          datasets: [{
            data: activeStages.length > 0 ? activeData : [1],
            backgroundColor: activeStages.length > 0 ? activeStages.map(s => colors[s]) : ['#e2e8f0'],
            borderWidth: 4,
            borderColor: '#fff',
            hoverOffset: 8,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '65%',
          plugins: {
            legend: {
              position: window.innerWidth <= 768 ? 'bottom' : 'right',
              labels: {
                color: '#1f2937',
                font: { size: window.innerWidth <= 480 ? 11 : 13, weight: '700' },
                padding: window.innerWidth <= 480 ? 10 : 16,
                usePointStyle: true,
                pointStyleWidth: 12,
              }
            },
            tooltip: {
              backgroundColor: '#0f172a',
              titleFont: { size: 14, weight: '700' },
              bodyFont: { size: 13, weight: '600' },
              padding: 12,
              cornerRadius: 0,
              borderColor: '#dbe6d5',
              borderWidth: 1,
            }
          }
        }
      });
    }
    return () => { if (leadStagesChartInst.current) leadStagesChartInst.current.destroy(); };
  }, [loading, combinedByStatus]);

  // Personal Attendance Chart
  useEffect(() => {
    if (loading || !personalChartRef.current) return;
    if (personalChartInst.current) personalChartInst.current.destroy();
    const ctx = personalChartRef.current.getContext('2d');
    personalChartInst.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Present', 'Absent', 'Half Day', 'Late'],
        datasets: [{
          label: 'Days',
          data: [personalAttendance.presentDays, personalAttendance.absentDays, personalAttendance.halfDays, personalAttendance.lateMarks],
          borderColor: '#166534',
          backgroundColor: 'rgba(22,101,52,0.12)',
          borderWidth: 3, tension: 0.4, fill: true,
          pointBackgroundColor: ['#22c55e', '#ef4444', '#65a30d', '#14532d'],
          pointBorderColor: '#fff', pointBorderWidth: 3, pointRadius: 8, pointHoverRadius: 10,
          pointStyle: 'rect'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12,
            cornerRadius: 0,
            borderColor: '#dbe6d5',
            borderWidth: 1,
            titleFont: { size: 14, weight: '700' },
            bodyFont: { size: 13, weight: '600' }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 12, weight: '600' }, color: '#4b5563' }, grid: { color: '#eef3ea' } },
          x: { ticks: { font: { size: 12, weight: '700' }, color: '#1f2937' }, grid: { display: false } }
        }
      }
    });
    return () => { if (personalChartInst.current) personalChartInst.current.destroy(); };
  }, [loading, personalAttendance]);

  // Weekly Analytics Chart
  useEffect(() => {
    if (loading || !weeklyChartRef.current || weeklyAnalytics.days.length === 0) return;
    if (weeklyChartInst.current) weeklyChartInst.current.destroy();
    const ctx = weeklyChartRef.current.getContext('2d');
    weeklyChartInst.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: weeklyAnalytics.days,
        datasets: [
          { label: 'Goals Completed', data: weeklyAnalytics.goalsCompleted, backgroundColor: '#166534', borderRadius: 0, barThickness: 16 },
          { label: 'Completed Projects', data: weeklyAnalytics.completedProjects, backgroundColor: '#14532d', borderRadius: 0, barThickness: 16 },
          { label: 'New Joinings', data: weeklyAnalytics.newJoining, backgroundColor: '#65a30d', borderRadius: 0, barThickness: 16 },
          { label: 'Upcoming Deadlines', data: weeklyAnalytics.upcomingDeadlines, backgroundColor: '#22c55e', borderRadius: 0, barThickness: 16 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              padding: 12,
              boxWidth: 14,
              font: { size: 11, weight: '700' },
              usePointStyle: true,
              color: '#1f2937'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            padding: 12,
            cornerRadius: 0,
            borderColor: '#dbe6d5',
            borderWidth: 1,
            titleFont: { size: 14, weight: '700' },
            bodyFont: { size: 13, weight: '600' }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11, weight: '600' }, color: '#4b5563' }, grid: { color: '#eef3ea' } },
          x: { ticks: { font: { size: 11, weight: '700' }, color: '#1f2937' }, grid: { display: false } }
        }
      }
    });
    return () => { if (weeklyChartInst.current) weeklyChartInst.current.destroy(); };
  }, [loading, weeklyAnalytics]);

  // ––– Helpers –––
  const fmtCurrency = (v) => {
    if (!v) return '₹0';
    if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
    return `₹${v}`;
  };

  const fmtDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const timeAgo = (d) => {
    if (!d) return '';
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  // Top leads (recent with status)
  const metaRecentLeads = (Array.isArray(metaLeads) ? metaLeads : []).map((lead) => ({
    ...lead,
    _sourceType: 'Meta',
    _sourceLabel: lead.pageName || 'Meta',
    _sortDate: lead.createdTime || lead.createdAt,
  }));

  const excelRecentLeads = (Array.isArray(myLeads) ? myLeads : []).map((lead, index) => ({
    ...lead,
    _id: lead._id || `excel-lead-${index}`,
    name: lead.name || lead.company || lead.email || lead.contactNumber || 'Excel Lead',
    phone: lead.phone || lead.contactNumber,
    status: lead.status || 'New',
    pageName: lead.source || 'Excel',
    createdTime: lead.leadDate || lead.createdAt,
    _sourceType: 'Excel',
    _sourceLabel: lead.source || 'Excel',
    _sortDate: lead.leadDate || lead.createdAt,
  }));

  const allLeadsForTable = [...metaRecentLeads, ...excelRecentLeads]
    .sort((a, b) => new Date(b._sortDate || b.createdAt || 0) - new Date(a._sortDate || a.createdAt || 0));

  const recentLeads = allLeadsForTable.slice(0, 6);

  const statusColors = {
    New: { bg: '#ecfdf3', color: '#14532d' },
    Contacted: { bg: '#f0fdf4', color: '#166534' },
    Qualified: { bg: '#f7fee7', color: '#3f6212' },
    Interested: { bg: '#dcfce7', color: '#15803d' },
    'Follow-up': { bg: '#fff7ed', color: '#854d0e' },
    Converted: { bg: '#dcfce7', color: '#14532d' },
    'Not Interested': { bg: '#fef2f2', color: '#dc2626' },
    Closed: { bg: '#f8fafc', color: '#64748b' },
  };

  const activityIcons = {
    'Status Change': { icon: '🔄', color: '#166534' },
    'Assignment Update': { icon: '🤝', color: '#15803d' },
    'Note Added': { icon: '📝', color: '#65a30d' },
    'Follow-up Set': { icon: '📅', color: '#16a34a' },
    default: { icon: '📌', color: '#64748b' },
  };

  const attendanceStatus = todayAttendance
    ? (todayAttendance.logoutTime
      ? (todayAttendance.status === 'present' ? 'Present'
        : todayAttendance.status === 'half-day' ? 'Half Day'
          : 'Absent')
      : (todayAttendance.status === 'late-checkin' ? 'Late Check-in' : todayAttendance.status === 'early-checkin' ? 'Early Check-in' : 'Checked In'))
    : 'Not Logged In';

  const workingHours = todayAttendance?.loginTime
    ? (() => {
      let shiftStartStr = todayAttendance?.shiftStartTime || user?.shiftStartTime || '09:00 AM';
      let shiftStart = null;
      try {
        const match = String(shiftStartStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
        if (match) {
          let hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          const period = match[3] ? match[3].toUpperCase() : null;
          if (period === 'PM' && hours !== 12) hours += 12;
          else if (period === 'AM' && hours === 12) hours = 0;
          const d = new Date(todayAttendance.loginTime);
          d.setHours(hours, minutes, 0, 0);
          shiftStart = d;
        }
      } catch (e) { }

      let shiftEndStr = todayAttendance?.shiftEndTime || user?.shiftEndTime;
      let shiftEnd = null;
      if (shiftEndStr && shiftEndStr !== 'Not Assigned') {
        try {
          const match = String(shiftEndStr).trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
          if (match) {
            let hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            const period = match[3] ? match[3].toUpperCase() : null;
            if (period === 'PM' && hours !== 12) hours += 12;
            else if (period === 'AM' && hours === 12) hours = 0;
            const d = new Date(todayAttendance.loginTime);
            d.setHours(hours, minutes, 0, 0);
            if (d < new Date(todayAttendance.loginTime)) d.setDate(d.getDate() + 1);
            shiftEnd = d;
          }
        } catch (e) { }
      }
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
        calculationStart = login <= markPresentTill ? shiftStart : login;
      }
      const totalSecs = Math.max(0, Math.round((endTime - calculationStart) / 1000));
      let totalBreakSecs = 0;
      if (todayAttendance.breaks && todayAttendance.breaks.length > 0) {
        todayAttendance.breaks.forEach(b => {
          if (b.breakType === 'Other') return;
          if (b.endTime) {
            totalBreakSecs += Math.round((new Date(b.endTime) - new Date(b.startTime)) / 1000);
          } else {
            const breakEnd = todayAttendance.logoutTime ? new Date(todayAttendance.logoutTime) : new Date();
            const cappedBreakEnd = shiftEnd && breakEnd > shiftEnd ? shiftEnd : breakEnd;
            totalBreakSecs += Math.round((cappedBreakEnd - new Date(b.startTime)) / 1000);
          }
        });
      }
      // Only deduct actual break time taken — break limit is for enforcement/warning only
      let netSecs = Math.max(0, totalSecs - totalBreakSecs);
      const hrs = Math.floor(netSecs / 3600);
      const mins = Math.floor((netSecs % 3600) / 60);
      const secs = netSecs % 60;
      return `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    })()
    : '0:00:00';

  const userInitials = `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`.toUpperCase() || 'SU';

  const attendanceMetrics = [
    {
      label: 'Login Time',
      value: todayAttendance?.loginTime
        ? new Date(todayAttendance.loginTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : '--:--',
      sub: 'Session start'
    },
    { label: 'Working Hours', value: workingHours, sub: 'Live today' },
    {
      label: 'Break Time',
      value: getTotalBreakDurationString(),
      sub: 'Total breaks'
    },
    {
      label: 'Today Status',
      value: attendanceStatus,
      sub: attendanceStatus === 'Checked In' || attendanceStatus === 'Late Check-in' || attendanceStatus === 'Early Check-in' || attendanceStatus === 'Present' ? 'Active' : 'Inactive'
    }
  ];

  const kpiCards = [
    { label: "Today's Leads", value: todayLeads, sub: 'Assigned today', tone: 'dark' },
    { label: 'Total Leads', value: totalLeads, sub: 'Meta + Excel', tone: 'primary' },
    { label: 'Deals Closed', value: closedWon, sub: `${fmtCurrency(dealStats.wonValue || 0)} value`, tone: 'success' },
    { label: 'Win Rate', value: `${winRate}%`, sub: `${convertedLeads} converted`, tone: 'lime' },
  ];

  const focusCards = [
    { label: 'Active Projects', value: generalStats.activeProjects },
    { label: 'Deadlines', value: generalStats.upcomingDeadlines },
    { label: 'My Goals', value: generalStats.goals },
    { label: 'Broadcasts', value: generalStats.broadcasts },
    { label: 'Approvals', value: generalStats.pendingApprovals },
    { label: 'Pending Leaves', value: generalStats.pendingLeaves },
  ];

  const performanceMetrics = [
    {
      label: 'Total Calls',
      value: salesAnalytics.totalCalls || 0,
      width: 100,
      color: '#14532d'
    },
    {
      label: 'Connections',
      value: salesAnalytics.totalConnections || 0,
      width: Math.min(salesAnalytics.connectionRate || 0, 100),
      color: '#166534'
    },
    {
      label: 'Qualified',
      value: salesAnalytics.totalQualifiedProspects || 0,
      width: Math.min(salesAnalytics.conversionRate || 0, 100),
      color: '#22c55e'
    },
    {
      label: 'Avg Score',
      value: (salesAnalytics.avgPerformanceScore || 0).toFixed(1),
      width: Math.min((salesAnalytics.avgPerformanceScore || 0) * 10, 100),
      color: '#84cc16'
    }
  ];

  const visibleStages = useMemo(
    () => stageOrder
      .map((stage) => ({ stage, value: combinedByStatus[stage] || 0 }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value),
    [combinedByStatus]
  );

  const profileCard = (
    <section className="sd-profile-card">
      <div className="sd-profile-flip">
        <div className="sd-profile-face sd-profile-front">
          <div className="sd-profile-top">
            <div className="sd-avatar">{userInitials}</div>
            <div className="sd-profile-copy">
              <span className="sd-overline">Dashboard User</span>
              <h2>{`${user?.firstName || 'Sales'} ${user?.lastName || 'User'}`.trim()}</h2>
              <p>{user?.email || 'sales@company.com'}</p>
            </div>
          </div>

          <div className="sd-presence-strip">
            <span className={`sd-presence-pill ${attendanceStatus === 'Present' || attendanceStatus === 'Half Day' ? 'is-present' : (attendanceStatus === 'Checked In' || attendanceStatus === 'Late Check-in') ? 'is-live' : 'is-offline'}`}>
              {attendanceStatus}
            </span>
          </div>

          <div className="sd-profile-grid">
            {attendanceMetrics.map((item) => (
              <div className="sd-profile-metric" key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.sub}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="sd-profile-face sd-profile-back">
          <div className="sd-profile-back-head">
            <span className="sd-overline">Quick Snapshot</span>
            <h3>{`${user?.firstName || 'Sales'} Summary`}</h3>
          </div>

          <div className="sd-profile-back-grid">
            <div className="sd-profile-back-item">
              <span>Today's Leads</span>
              <strong>{todayLeads}</strong>
              <small>assigned today</small>
            </div>
            <div className="sd-profile-back-item">
              <span>Total Leads</span>
              <strong>{totalLeads}</strong>
              <small>meta + excel</small>
            </div>
            <div className="sd-profile-back-item">
              <span>Deals Closed</span>
              <strong>{closedWon}</strong>
              <small>{fmtCurrency(dealStats.wonValue || 0)} value</small>
            </div>
            <div className="sd-profile-back-item">
              <span>Win Rate</span>
              <strong>{winRate}%</strong>
              <small>{convertedLeads} converted</small>
            </div>
          </div>

          <div className="sd-profile-back-tip">Hover out to return to attendance view.</div>
        </div>
      </div>
    </section>
  );

  if (loading) {
    return (
      <div className="sd-container">
        <div className="sd-shell">
          <aside className="sd-rail">
            <section className="sd-profile-card sd-skeleton-card">
              <div className="sd-profile-top">
                <div className="sd-avatar sd-skeleton" />
                <div className="sd-profile-copy">
                  <div className="sd-skeleton sd-skel-overline" />
                  <div className="sd-skeleton sd-skel-title" />
                  <div className="sd-skeleton sd-skel-subtitle" />
                </div>
              </div>
              <div className="sd-profile-grid">
                {[...Array(4)].map((_, i) => (
                  <div className="sd-profile-metric sd-skeleton-metric" key={`profile-metric-${i}`}>
                    <div className="sd-skeleton sd-skel-line-sm" />
                    <div className="sd-skeleton sd-skel-value" />
                    <div className="sd-skeleton sd-skel-line-xs" />
                  </div>
                ))}
              </div>
            </section>

            {[...Array(2)].map((_, i) => (
              <section className="sd-side-card sd-skeleton-card" key={`side-skeleton-${i}`}>
                <div className="sd-side-head">
                  <div className="sd-skeleton-group">
                    <div className="sd-skeleton sd-skel-overline" />
                    <div className="sd-skeleton sd-skel-subtitle" />
                  </div>
                  <div className="sd-skeleton sd-skel-badge" />
                </div>
                <div className="sd-focus-list">
                  {[...Array(3)].map((__, j) => (
                    <div className="sd-focus-item sd-skeleton-item" key={`focus-skeleton-${i}-${j}`}>
                      <div className="sd-skeleton sd-skel-line" />
                      <div className="sd-skeleton sd-skel-value-sm" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </aside>

          <main className="sd-main">
            <div className="sd-header">
              <div className="sd-header-left sd-skeleton-group">
                <div className="sd-skeleton sd-skel-overline" />
                <div className="sd-skeleton sd-skel-hero-title" />
                <div className="sd-skeleton sd-skel-line-lg" />
              </div>
              <div className="sd-header-right">
                <div className="sd-skeleton sd-skel-date" />
                <div className="sd-skeleton sd-skel-btn" />
              </div>
            </div>

            <section className="sd-kpi-grid">
              {[...Array(4)].map((_, i) => (
                <article className="sd-kpi-card sd-skeleton-card" key={`kpi-skeleton-${i}`}>
                  <div className="sd-kpi-copy sd-skeleton-group">
                    <div className="sd-skeleton sd-skel-overline" />
                    <div className="sd-skeleton sd-skel-kpi-value" />
                    <div className="sd-skeleton sd-skel-line-sm" />
                  </div>
                  <div className="sd-skeleton sd-skel-ring" />
                </article>
              ))}
            </section>

            <section className="sd-feature-grid">
              {[...Array(2)].map((_, i) => (
                <article className="sd-panel sd-skeleton-card" key={`feature-skeleton-${i}`}>
                  <div className="sd-panel-head">
                    <div className="sd-skeleton-group">
                      <div className="sd-skeleton sd-skel-overline" />
                      <div className="sd-skeleton sd-skel-subtitle" />
                    </div>
                    <div className="sd-skeleton sd-skel-badge" />
                  </div>
                  <div className="sd-skeleton sd-skel-chart" />
                </article>
              ))}
            </section>
          </main>
        </div>
      </div>
    );
  }

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
    <div className="sd-container">
      <div className="sd-shell">
        <aside className="sd-rail">
          {!isNarrowScreen && profileCard}

          <section className="sd-side-card">
            <div className="sd-side-head">
              <div>
                <span className="sd-overline">Overview</span>
                <h3>Quick Focus</h3>
              </div>
              <span className="sd-side-badge">Live</span>
            </div>
            <div className="sd-focus-list">
              {focusCards.map((item) => (
                <div className="sd-focus-item" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </section>

          {(salesAnalytics.totalCalls > 0 || salesAnalytics.totalConnections > 0) && (
            <section className="sd-side-card">
              <div className="sd-side-head">
                <div>
                  <span className="sd-overline">Performance</span>
                  <h3>Sales Pulse</h3>
                </div>
                <span className="sd-side-badge">Tracked</span>
              </div>
              <div className="sd-progress-list">
                {performanceMetrics.map((metric) => (
                  <div className="sd-progress-item" key={metric.label}>
                    <div className="sd-progress-copy">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                    <div className="sd-progress-bar">
                      <div className="sd-progress-fill" style={{ width: `${metric.width}%`, background: metric.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="sd-side-card">
            <div className="sd-side-head">
              <div>
                <span className="sd-overline">Timeline</span>
                <h3>Recent Activity</h3>
              </div>
              <span className="sd-side-badge">{recentActivities.length} items</span>
            </div>
            <div className="sd-activity-list sd-activity-list-compact">
              {recentActivities.length > 0 ? recentActivities.slice(0, 5).map((act, index) => {
                const cfg = activityIcons[act.type] || activityIcons.default;
                return (
                  <div className="sd-activity-item" key={index}>
                    <div className="sd-activity-dot" style={{ background: act.color || cfg.color }}>
                      {act.icon || cfg.icon}
                    </div>
                    <div className="sd-activity-content">
                      <p className="sd-activity-title">{act.title || act.description || 'Activity'}</p>
                      <span className="sd-activity-time">{timeAgo(act.timestamp || act.date)}</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="sd-empty-activity">No recent activity</div>
              )}
            </div>
          </section>
        </aside>

        <main className="sd-main">
          <div className="sd-header">
            <div className="sd-header-left">
              <span className="sd-overline">Sales Overview</span>
              <h1 className="sd-title">Sales Dashboard</h1>
              <p className="sd-subtitle">Track real-time sales metrics, lead conversions, and performance analytics.</p>
            </div>
            <div className="sd-header-right">
              <span className="sd-date-badge">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              {!todayAttendance && (
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
                    onClick={() => handleCheckIn()}
                    className="sd-btn-checkin"
                    disabled={isBeforeShiftStart()}
                    title={isBeforeShiftStart() ? `You can only check-in from ${user?.shiftStartTime}` : ''}
                    style={isBeforeShiftStart() ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  >
                    <LogIn size={16} /> Check In
                  </button>
                </div>
              )}
              {todayAttendance?.loginTime && !todayAttendance?.logoutTime && (
                <div className="sd-checkout-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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
                  <span className="sd-timer">
                    {new Date(checkInTimer * 1000).toISOString().substr(11, 8)}
                  </span>
                  <button
                    onClick={() => handleCheckOut()}
                    className="sd-btn-checkout"
                  >
                    <LogIn size={14} style={{ transform: 'rotate(180deg)' }} /> Check Out
                  </button>
                </div>
              )}
              <button className="sd-btn-refresh" onClick={fetchAll}>Refresh</button>
              {/* --- BREAK BUTTONS --- */}
              {todayAttendance?.loginTime && !todayAttendance?.logoutTime && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {activeBreak ? (
                    <button
                      onClick={handleBreakEnd}
                      className="sd-btn-checkout"
                      style={{ background: '#ef4444' }}
                    >
                      Stop Break ({new Date(breakTimer * 1000).toISOString().substr(11, 8)})
                    </button>
                  ) : (
                    <button
                      onClick={handleOpenBreakModal}
                      className="sd-btn-checkin"
                      style={{ background: '#f59e0b', borderColor: 'transparent', color: '#000' }}
                    >
                      Take Break
                    </button>
                  )}


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
                </div>
              )}

            </div>
          </div>

          {isNarrowScreen && <div className="sd-main-profile-slot">{profileCard}</div>}

          <section className="sd-kpi-grid">
            {kpiCards.map((card, index) => (
              <article className={`sd-kpi-card tone-${card.tone}`} key={card.label}>
                <div className="sd-kpi-copy">
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.sub}</small>
                </div>
                <div className="sd-kpi-visual">
                  {index === 3 ? (
                    <div className="sd-kpi-ring">
                      <svg viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="16" pathLength="100" className="sd-kpi-ring-track" />
                        <circle
                          cx="22"
                          cy="22"
                          r="16"
                          pathLength="100"
                          className="sd-kpi-ring-value"
                          style={{ strokeDasharray: `${Math.min(parseFloat(winRate) || 0, 100)} 100` }}
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="sd-kpi-bars">
                      {stageData.slice(index, index + 4).map((value, barIndex) => (
                        <span
                          key={`${card.label}-${barIndex}`}
                          style={{ height: `${Math.max(value * 8, 10)}px` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </section>

          <section className="sd-feature-grid">
            <article className="sd-panel sd-panel-hero">
              <div className="sd-panel-head">
                <div>
                  <span className="sd-overline">Main Report</span>
                  <h3>Lead Pipeline</h3>
                </div>
                <span className="sd-panel-badge">This Month</span>
              </div>
              <div className="sd-chart-body sd-chart-body-lg">
                <canvas ref={pipelineChartRef} />
              </div>
              <div className="sd-hero-footer">
                <div>
                  <span>Total Leads</span>
                  <strong>{totalLeads}</strong>
                </div>
                <div>
                  <span>Converted</span>
                  <strong>{convertedLeads}</strong>
                </div>
                <div>
                  <span>Won Value</span>
                  <strong>{fmtCurrency(dealStats.wonValue || 0)}</strong>
                </div>
              </div>
            </article>

            <article className="sd-panel sd-panel-stage">
              <div className="sd-panel-head">
                <div>
                  <span className="sd-overline">Distribution</span>
                  <h3>Lead Stages</h3>
                </div>
                <span className="sd-panel-badge">{totalLeads} total</span>
              </div>
              <div className="sd-stage-layout">
                <div className="sd-stage-chart">
                  <canvas ref={leadStagesChartRef} />
                </div>
                <div className="sd-stage-list">
                  {visibleStages.length > 0 ? visibleStages.slice(0, 6).map((item) => (
                    <div className="sd-stage-item" key={item.stage}>
                      <span>{item.stage}</span>
                      <strong>{item.value}</strong>
                    </div>
                  )) : (
                    <div className="sd-stage-empty">No stage data available.</div>
                  )}
                </div>
              </div>
            </article>
          </section>

          <section className="sd-content-grid">
            <article className="sd-panel sd-panel-table">
              <div className="sd-panel-head">
                <div>
                  <span className="sd-overline">Fresh Leads</span>
                  <h3>Recent Leads</h3>
                </div>
                <span className="sd-panel-badge">{allLeadsForTable.length} total</span>
              </div>
              <div className="sd-table-wrap">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Source</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeads.length > 0 ? recentLeads.map((lead) => (
                      <tr key={lead._id}>
                        <td>
                          <div className="sd-lead-name">{lead.name || '—'}</div>
                          {lead.city && <div className="sd-lead-sub">{lead.city}</div>}
                        </td>
                        <td>
                          <div className="sd-lead-phone">{lead.phone || '—'}</div>
                          {lead.email && <div className="sd-lead-sub">{lead.email}</div>}
                        </td>
                        <td><span className="sd-source-badge">{lead._sourceLabel || lead.pageName || 'Meta'}</span></td>
                        <td>
                          <span
                            className="sd-status-pill"
                            style={{
                              background: statusColors[lead.status]?.bg || '#f8fafc',
                              color: statusColors[lead.status]?.color || '#64748b',
                            }}
                          >
                            {lead.status || 'New'}
                          </span>
                        </td>
                        <td className="sd-date-cell">{fmtDate(lead.createdTime || lead.createdAt || lead._sortDate)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="5" className="sd-empty-row">No leads yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <div className="sd-panel-stack">
              <article className="sd-panel">
                <div className="sd-panel-head">
                  <div>
                    <span className="sd-overline">Attendance</span>
                    <h3>Personal Attendance</h3>
                  </div>
                  <span className="sd-panel-badge">This month</span>
                </div>
                <div className="sd-chart-wrap sd-chart-medium">
                  <canvas ref={personalChartRef} />
                </div>
              </article>
            </div>
          </section>

          {recentLeaves.length > 0 && (
            <section className="sd-panel sd-panel-leaves">
              <div className="sd-panel-head">
                <div>
                  <span className="sd-overline">Approvals</span>
                  <h3>Recent Leave Applications</h3>
                </div>
                <span className="sd-panel-badge">{recentLeaves.length} entries</span>
              </div>
              <div className="sd-leaves-table-wrap">
                <table className="sd-leaves-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLeaves.map((lv, index) => (
                      <tr key={index}>
                        <td>{lv.employeeName || lv.employee?.name || lv.userId?.name || '—'}</td>
                        <td>{lv.leaveType || lv.type || '—'}</td>
                        <td>{fmtDate(lv.startDate || lv.from)}</td>
                        <td>{fmtDate(lv.endDate || lv.to)}</td>
                        <td>
                          <span className={`sd-leave-badge sd-leave-${(lv.status || 'pending').toLowerCase()}`}>
                            {lv.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>

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
                      value={breakForm.reason}
                      onChange={(e) => setBreakForm({ ...breakForm, reason: e.target.value })}
                      placeholder="Enter briefing agenda / meeting details..."
                      rows="3"
                      style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '14px', color: '#0f172a', background: '#f8fafc', outline: 'none', resize: 'vertical' }}
                      required
                    />
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
                      Check-in Selfie <br />
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
                      Check-out Selfie <br />
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
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 16px 48px rgba(15,23,42,0.18)', padding: '26px', width: '840px', maxWidth: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
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
  );
}

export default SalesDashboard;
