import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { Search, RefreshCw, Calendar, User, Clock, Eye, X, Activity, Shield, ShieldAlert, Download, Video } from 'lucide-react';
import { io } from 'socket.io-client';
import './MyLeads.css';
import LiveScreenModal from './LiveScreenModal';
import AccessPolicyModal from './AccessPolicyModal';

// Component to return app-specific icons
function AppIcon({ appName }) {
  if (!appName || appName === '-') {
    return <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '11px' }}>—</span>;
  }

  // Professional SVG Icons Map
  const svgIcons = {
    code: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    browser: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
    chat: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    doc: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
    mail: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    ),
    terminal: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    ),
    design: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#db2777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" />
        <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" />
      </svg>
    ),
    desktop: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    )
  };

  const appMappings = {
    'vs code': 'code',
    'visual studio code': 'code',
    'code': 'code',
    'chrome': 'browser',
    'google chrome': 'browser',
    'firefox': 'browser',
    'edge': 'browser',
    'microsoft edge': 'browser',
    'teams': 'chat',
    'microsoft teams': 'chat',
    'slack': 'chat',
    'zoom': 'chat',
    'excel': 'doc',
    'microsoft excel': 'doc',
    'word': 'doc',
    'microsoft word': 'doc',
    'notepad': 'doc',
    'outlook': 'mail',
    'microsoft outlook': 'mail',
    'terminal': 'terminal',
    'cmd': 'terminal',
    'powershell': 'terminal',
    'postman': 'terminal',
    'figma': 'design',
    'photoshop': 'design'
  };

  const lower = appName.toLowerCase();
  const iconKey = Object.entries(appMappings).find(([key]) => lower.includes(key))?.[1] || 'desktop';
  const icon = svgIcons[iconKey];

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: '#334155', fontWeight: '500' }}>
      {icon}
      <span style={{
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '180px'
      }} title={appName}>{appName}</span>
    </span>
  );
}

// Format duration helper
function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Format duration without seconds
function formatDurationNoSeconds(sec) {
  if (!sec || isNaN(sec) || sec < 60) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// Format idle time helper
function formatIdleTime(sec) {
  if (sec === undefined || sec === null || sec === 0) return '—';
  if (sec >= 300) return `no activity since ${Math.floor(sec / 60)}min`;
  return formatDuration(sec);
}

// Format date helper
function formatDateOnly(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Check if activity belongs to the current shift (started within the last 16 hours)
function isCurrentShift(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const diffHours = (now - d) / (1000 * 60 * 60);
  return diffHours <= 16;
}

// Helper to get stylized colourful role badge colors
function getRoleBadgeStyle(roleName) {
  const normalized = (roleName || '').toLowerCase().trim();
  const baseStyle = {
    padding: '2px 8px',
    borderRadius: '20px',
    fontSize: '9px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center'
  };

  switch (normalized) {
    case 'developer':
    case 'dev':
      return {
        ...baseStyle,
        background: '#eef2ff',
        color: '#4f46e5',
        border: '1px solid #c7d2fe'
      };
    case 'sales':
      return {
        ...baseStyle,
        background: '#fffbeb',
        color: '#d97706',
        border: '1px solid #fde68a'
      };
    case 'marketing':
      return {
        ...baseStyle,
        background: '#f0f9ff',
        color: '#0284c7',
        border: '1px solid #bae6fd'
      };
    case 'hr manager':
    case 'hr':
      return {
        ...baseStyle,
        background: '#f0fdf4',
        color: '#16a34a',
        border: '1px solid #bbf7d0'
      };
    case 'admin':
    case 'director':
      return {
        ...baseStyle,
        background: '#fff1f2',
        color: '#e11d48',
        border: '1px solid #fecdd3'
      };
    case 'manager':
      return {
        ...baseStyle,
        background: '#faf5ff',
        color: '#9333ea',
        border: '1px solid #e9d5ff'
      };
    default:
      return {
        ...baseStyle,
        background: '#f8fafc',
        color: '#475569',
        border: '1px solid #e2e8f0'
      };
  }
}

function Activities() {
  const { user, hasPermission } = useAuth();

  // States
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Live Screen State
  const [showLiveScreenModal, setShowLiveScreenModal] = useState(false);
  const [selectedLiveEmployee, setSelectedLiveEmployee] = useState(null);

  // Desktop Agent Status States
  const [agentStatus, setAgentStatus] = useState({
    installed: false,
    online: false,
    version: null,
    latestVersion: null,
    updateAvailable: false,
    lastSeen: null
  });
  const [agentStatusLoading, setAgentStatusLoading] = useState(true);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [showAgentGuide, setShowAgentGuide] = useState(false);
  const [showAgentNotification, setShowAgentNotification] = useState(false);
  const [showIdleModal, setShowIdleModal] = useState(false);
  const [showUniqueAppsModal, setShowUniqueAppsModal] = useState(false);
  const [expandedApp, setExpandedApp] = useState(null);
  const [showActiveTimeModal, setShowActiveTimeModal] = useState(false);

  // Access Policy Modal States
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [selectedPolicyForEdit, setSelectedPolicyForEdit] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);

  // Filters & Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'oldest'

  // Dropdown filter manager
  const [openFilterDrop, setOpenFilterDrop] = useState(null); // 'role' | 'date' | 'sort' | null
  const filterDropRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Live Tracking state
  const [liveTracking, setLiveTracking] = useState([]);

  // Live Tracking application names map: { employeeId: appName }
  const [liveApps, setLiveApps] = useState({});

  // Timeline Modal States
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineActivities, setTimelineActivities] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState('');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [modalFilterDate, setModalFilterDate] = useState('');

  // Close filter dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (filterDropRef.current && !filterDropRef.current.contains(e.target)) {
        setOpenFilterDrop(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close agent notification on outside click
  const agentDropRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (agentDropRef.current && !agentDropRef.current.contains(e.target)) {
        setShowAgentNotification(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isPrivileged = useMemo(() => {
    return ['Admin', 'HR Manager', 'HR', 'Manager', 'Director', 'Team Leader'].includes(user?.role?.name);
  }, [user]);

  const fetchActivities = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const endpoint = isPrivileged ? '/activity/admin' : '/activity/me';
      const [res, liveRes] = await Promise.all([
        api.get(endpoint),
        api.get('/activity/live')
      ]);
      const currentShiftActivities = (res.data || []).filter(act => isCurrentShift(act.startTime));
      setActivities(currentShiftActivities);
      setLiveTracking(liveRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching activities:', err);
      // Fallback mock data
      setActivities([
        { _id: 'mock1', employeeId: 'EMP184', employeeName: 'Boby Singh', role: 'Sales', appName: 'Google Chrome', startTime: new Date().toISOString(), durationSeconds: 640, idleSeconds: 90 },
        { _id: 'mock2', employeeId: 'EMP185', employeeName: 'Rahul Verma', role: 'Developer', appName: 'Visual Studio Code', startTime: new Date().toISOString(), durationSeconds: 1200, idleSeconds: 30 },
        { _id: 'mock3', employeeId: 'EMP190', employeeName: 'Amit Kumar', role: 'Marketing', appName: 'Microsoft Teams', startTime: new Date(Date.now() - 3600000).toISOString(), durationSeconds: 400, idleSeconds: 220 },
      ]);
      setLiveTracking([
        { employeeId: 'EMP184', status: 'tracking' },
        { employeeId: 'EMP185', status: 'tracking' }
      ]);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPrivileged]);

  const fetchAgentStatus = useCallback(async () => {
    try {
      const res = await api.get('/agent/status');
      setAgentStatus(res.data);
    } catch (err) {
      console.error('Error fetching agent status:', err);
    } finally {
      setAgentStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    fetchAgentStatus();
    const interval = setInterval(() => {
      fetchActivities(true);
      fetchAgentStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchActivities, fetchAgentStatus]);

  // Set up real-time Socket.IO connection to track focused applications in real-time
  useEffect(() => {
    if (!isPrivileged) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Use backend URL dynamically based on environment configuration
    const socketUrl = process.env.REACT_APP_SOCKET_URL || (process.env.REACT_APP_API_URL
      ? process.env.REACT_APP_API_URL.replace('/api', '')
      : window.location.origin);

    console.log('[Activities Socket] Connecting to real-time feed at:', socketUrl);
    const socket = io(socketUrl, {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket'],
      upgrade: false,
      reconnectionAttempts: 5,
      timeout: 10000
    });

    socket.on('connect', () => {
      console.log('[Activities Socket] Socket connection established successfully.');
    });

    socket.on('employee-connected', (data) => {
      console.log('[Activities Socket] Employee connected:', data);
      if (data && data.employeeId) {
        setLiveTracking(prev => {
          const exists = prev.some(item => item.employeeId === data.employeeId);
          if (exists) {
            return prev.map(item => item.employeeId === data.employeeId ? { ...item, status: 'tracking' } : item);
          }
          return [...prev, { employeeId: data.employeeId, status: 'tracking' }];
        });
      }
    });

    socket.on('employee-disconnected', (data) => {
      console.log('[Activities Socket] Employee disconnected:', data);
      if (data && data.employeeId) {
        setLiveTracking(prev => {
          const exists = prev.some(item => item.employeeId === data.employeeId);
          if (exists) {
            return prev.map(item => item.employeeId === data.employeeId ? { ...item, status: 'deactivated' } : item);
          }
          return [...prev, { employeeId: data.employeeId, status: 'deactivated' }];
        });
        setLiveApps(prev => {
          const next = { ...prev };
          delete next[data.employeeId];
          return next;
        });
      }
    });

    socket.on('employee-app-changed', (data) => {
      console.log('[Activities Socket] Real-time app focus changed:', data);
      if (data && data.employeeId) {
        setLiveApps(prev => ({
          ...prev,
          [data.employeeId]: data.appName
        }));
        // If employee focus changed, ensure they are marked as tracking in liveTracking
        setLiveTracking(prev => {
          const exists = prev.some(item => item.employeeId === data.employeeId);
          if (exists) {
            return prev.map(item => item.employeeId === data.employeeId && item.status !== 'tracking' ? { ...item, status: 'tracking' } : item);
          }
          return [...prev, { employeeId: data.employeeId, status: 'tracking' }];
        });
      }
    });

    socket.on('connect_error', (err) => {
      console.error('[Activities Socket] Socket connection error:', err);
    });

    return () => {
      console.log('[Activities Socket] Cleaning up socket connection...');
      socket.disconnect();
    };
  }, [isPrivileged]);

  // Handle modal tracking click
  const handleTrackActivityClick = async (empId, name) => {
    setSelectedEmployeeId(empId);
    setSelectedEmployeeName(name);
    setModalSearchTerm('');
    setModalFilterDate('');
    setShowTimelineModal(true);
    setTimelineLoading(true);

    try {
      const endpoint = isPrivileged ? `/activity/admin?employeeId=${empId}` : `/activity/me`;
      const res = await api.get(endpoint);
      const currentShiftTimeline = (res.data || []).filter(act => isCurrentShift(act.startTime));
      setTimelineActivities(currentShiftTimeline);
    } catch (err) {
      console.error('Failed to fetch detailed employee history:', err);
      const fallback = activities.filter(act => act.employeeId === empId);
      setTimelineActivities(fallback);
    } finally {
      setTimelineLoading(false);
    }
  };

  // Reset pagination when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDate, filterRole, sortBy]);

  // Derived unique roles for filter dropdown
  const uniqueRoles = useMemo(() => {
    const roles = activities.map(act => act.role).filter(Boolean);
    return [...new Set(roles)];
  }, [activities]);

  // Derived aggregate metrics for stats cards
  const metrics = useMemo(() => {
    let totalActive = 0;
    let totalIdle = 0;
    const apps = new Set();
    activities.forEach(act => {
      if (act.appName === "System Idle (No Activity)") {
        totalIdle += (act.durationSeconds || 0);
      } else {
        totalActive += (act.durationSeconds || 0);
        if (act.appName && act.appName !== '-') {
          apps.add(act.appName.toLowerCase().trim());
        }
      }
    });
    return {
      totalActive,
      totalIdle,
      uniqueAppsCount: apps.size
    };
  }, [activities]);

  // Group idle time per employee
  const idleEmployees = useMemo(() => {
    const map = new Map();
    activities.forEach(act => {
      if (act.appName === "System Idle (No Activity)") {
        if (!map.has(act.employeeId)) {
          map.set(act.employeeId, {
            employeeId: act.employeeId,
            employeeName: act.employeeName,
            role: act.role,
            designation: act.designation,
            idleSeconds: 0
          });
        }
        map.get(act.employeeId).idleSeconds += (act.durationSeconds || 0);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.idleSeconds - a.idleSeconds);
  }, [activities]);

  // Group by distinct app
  const appUsageData = useMemo(() => {
    const appMap = new Map();
    activities.forEach(act => {
      if (act.appName === "System Idle (No Activity)" || !act.appName || act.appName === '-') return;
      const appName = act.appName;
      if (!appMap.has(appName)) {
        appMap.set(appName, {
          appName,
          totalDuration: 0,
          users: new Map() // employeeId -> userData
        });
      }
      const appData = appMap.get(appName);
      appData.totalDuration += (act.durationSeconds || 0);
      
      if (!appData.users.has(act.employeeId)) {
        appData.users.set(act.employeeId, {
          employeeId: act.employeeId,
          employeeName: act.employeeName,
          email: act.email || '',
          designation: act.designation || '',
          role: act.role || '',
          timeSpent: 0
        });
      }
      appData.users.get(act.employeeId).timeSpent += (act.durationSeconds || 0);
    });

    return Array.from(appMap.values()).map(app => ({
      ...app,
      users: Array.from(app.users.values()).sort((a, b) => b.timeSpent - a.timeSpent)
    })).sort((a, b) => b.totalDuration - a.totalDuration);
  }, [activities]);

  // Group active time per employee
  const activeEmployees = useMemo(() => {
    const empMap = new Map();
    activities.forEach(act => {
      if (act.appName === "System Idle (No Activity)") return;
      if (!empMap.has(act.employeeId)) {
        empMap.set(act.employeeId, {
          employeeId: act.employeeId,
          employeeName: act.employeeName,
          role: act.role,
          designation: act.designation,
          activeSeconds: 0
        });
      }
      empMap.get(act.employeeId).activeSeconds += (act.durationSeconds || 0);
    });
    return Array.from(empMap.values()).sort((a, b) => b.activeSeconds - a.activeSeconds);
  }, [activities]);

  // Sparkline data generators
  const sparklineData = useMemo(() => {
    const generateSpark = (factor) => {
      const pts = [2, 4, 3, 5, 4, 6];
      return pts.map(p => Math.round(p * factor));
    };

    return {
      total: generateSpark(activities.length || 1),
      active: generateSpark(metrics.totalActive ? Math.round(metrics.totalActive / 1000) : 1),
      idle: generateSpark(metrics.totalIdle ? Math.round(metrics.totalIdle / 100) : 0.5),
      apps: generateSpark(metrics.uniqueAppsCount || 1)
    };
  }, [activities, metrics]);

  // Sparkline renderer
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

  // Filtered + sorted main logs
  const filtered = useMemo(() => {
    return activities.filter(act => {
      const nameMatch = (act.employeeName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const idMatch = (act.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase());
      const appMatch = (act.appName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const searchOk = nameMatch || idMatch || appMatch;

      let dateOk = true;
      if (filterDate) {
        const actDate = new Date(act.startTime).toISOString().split('T')[0];
        dateOk = actDate === filterDate;
      }

      let roleOk = true;
      if (filterRole) {
        roleOk = act.role === filterRole;
      }

      return searchOk && dateOk && roleOk;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.startTime) - new Date(a.startTime);
      if (sortBy === 'oldest') return new Date(a.startTime) - new Date(b.startTime);
      return 0;
    });
  }, [activities, searchTerm, filterDate, filterRole, sortBy]);

  // Group by unique employeeId to show a single record per employee (their latest activity)
  const uniqueEmployeeRows = useMemo(() => {
    const seen = new Set();
    const rows = [];
    filtered.forEach(act => {
      if (!seen.has(act.employeeId)) {
        seen.add(act.employeeId);
        rows.push(act);
      }
    });
    return rows;
  }, [filtered]);

  // Pagination bounds
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginated = useMemo(() => {
    return uniqueEmployeeRows.slice(startIndex, startIndex + itemsPerPage);
  }, [uniqueEmployeeRows, startIndex]);

  const totalPages = Math.ceil(uniqueEmployeeRows.length / itemsPerPage) || 1;

  // Filtered detailed timeline logs
  const filteredTimeline = useMemo(() => {
    return timelineActivities.filter(act => {
      const appMatch = (act.appName || '').toLowerCase().includes(modalSearchTerm.toLowerCase());

      let dateOk = true;
      if (modalFilterDate) {
        const actDate = new Date(act.startTime).toISOString().split('T')[0];
        dateOk = actDate === modalFilterDate;
      }
      return appMatch && dateOk;
    });
  }, [timelineActivities, modalSearchTerm, modalFilterDate]);

  const isFiltered = searchTerm || filterDate || filterRole;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterDate('');
    setFilterRole('');
  };

  const handleDownload = (version) => {
    const baseURL = api.defaults.baseURL || '/api';
    const downloadUrl = baseURL.endsWith('/api')
      ? `${baseURL}/agent/download${version ? `?version=${version}` : ''}`
      : `${baseURL.replace(/\/api\/?$/, '')}/api/agent/download${version ? `?version=${version}` : ''}`;
    window.open(downloadUrl);
  };

  const renderAgentCard = () => {
    if (agentStatusLoading) {
      return (
        <div style={{ margin: '0', padding: '16px 20px', background: '#ffffff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#64748b', fontSize: '12px' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid #cbd5e1', borderTopColor: '#3b775e', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <span>Loading Desktop Agent status...</span>
          </div>
        </div>
      );
    }

    const formatLastSeen = (dateStr) => {
      if (!dateStr) return 'Never';
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just Now';
      if (minutes === 1) return '1 minute ago';
      if (minutes < 60) return `${minutes} minutes ago`;
      return new Date(dateStr).toLocaleTimeString();
    };

    const checkUpdatesManually = async () => {
      setCheckingUpdates(true);
      try {
        const res = await api.get('/agent/status');
        setAgentStatus(res.data);
        if (res.data.updateAvailable) {
          alert(`An update is available! Latest: ${res.data.latestVersion}`);
        } else {
          alert('Your Desktop Agent is up to date!');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingUpdates(false);
      }
    };

    // STATE 3: UPDATE AVAILABLE
    if (agentStatus.updateAvailable) {
      return (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Desktop Agent</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#059669', fontSize: '9px', fontWeight: '700' }}>
                  ● Update Available
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0', fontWeight: 500 }}>
                Version: <strong>{agentStatus.version || '—'}</strong> · Latest: <strong>{agentStatus.latestVersion}</strong>
              </p>
            </div>
          </div>
          <button onClick={() => setShowAgentGuide(true)} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: '#0f172a', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Inter', sans-serif", flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
            View Guide
          </button>
        </div>
      );
    }

    // STATE 2: INSTALLED & ONLINE/OFFLINE
    if (agentStatus.installed) {
      const isOnline = agentStatus.online;
      return (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: isOnline ? '#f0fdf4' : '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isOnline ? '#16a34a' : '#64748b', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Desktop Agent</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', background: isOnline ? '#ecfdf5' : '#f1f5f9', color: isOnline ? '#059669' : '#475569', fontSize: '9px', fontWeight: '700' }}>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: isOnline ? '#10b981' : '#64748b', animation: isOnline ? 'actPulse 1.8s ease-in-out infinite' : 'none' }} />
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0', fontWeight: 500 }}>
                Version: <strong>{agentStatus.version}</strong> · Last Seen: <strong>{formatLastSeen(agentStatus.lastSeen)}</strong>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {!isOnline && (
              <button onClick={() => handleDownload()} style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', background: '#0f172a', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Inter', sans-serif" }} onMouseEnter={e => e.currentTarget.style.background = '#334155'} onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}>
                Download
              </button>
            )}
            <button onClick={checkUpdatesManually} disabled={checkingUpdates} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#fff', color: '#0f172a', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Inter', sans-serif", boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}>
              {checkingUpdates ? 'Checking...' : 'Check'}
            </button>
          </div>
        </div>
      );
    }

    // STATE 1: NOT INSTALLED
    return (
      <div style={{ background: '#fff', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Desktop Agent</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', fontSize: '9px', fontWeight: '700' }}>
                ● Not Installed
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0', fontWeight: 500 }}>
              Install agent for activity tracking.
            </p>
          </div>
        </div>
        <button onClick={() => setShowAgentGuide(true)} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#0f172a', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Inter', sans-serif", flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} onMouseEnter={e => { e.currentTarget.style.background = '#334155'; }} onMouseLeave={e => { e.currentTarget.style.background = '#0f172a'; }}>
          View Guide
        </button>
      </div>
    );
  };

  return (
    <div className="page-container" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", paddingTop: '24px' }}>
      <style>{`
        @keyframes actPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.3); }
        }
        .ist-btn-primary { padding: 8px 18px; border: none; border-radius: 10px; background: linear-gradient(135deg,#3b775e 0%,#56a07a 100%); color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter',-apple-system,sans-serif; transition: all .2s; display: flex; align-items: center; gap: 6px; box-shadow: none; }
        .ist-btn-primary:hover { opacity: .92; transform: translateY(-1px); box-shadow: none; }
        .ist-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .ist-btn-ghost { padding: 9px 18px; border: 1.5px solid #e5e7eb; background: #fff; border-radius: 10px; font-size: 13px; font-weight: 600; color: #6b7280; cursor: pointer; font-family: 'Inter',-apple-system,sans-serif; transition: all .2s; }
        .ist-btn-ghost:hover { border-color: #3b775e; color: #3b775e; background: #f8fafb; }
        .ist-tbl {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Inter', sans-serif;
          table-layout: auto;
        }
        .ist-tbl thead tr {
          background: #f8fafc;
        }
        .ist-tbl thead th {
          padding: 8px 12px;
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          border-bottom: 1.5px solid #e2e8f0;
          white-space: nowrap;
        }
        .ist-tbl tbody tr {
          border-bottom: 1px solid #f1f5f9;
          transition: background-color 0.2s;
        }
        .ist-tbl tbody tr:hover {
          background: #f8fafc;
        }
        .ist-tbl tbody td {
          padding: 6px 12px;
          border-bottom: 1px solid #f1f5f9;
          color: #334155;
          vertical-align: middle;
          font-size: 11px;
          white-space: nowrap;
          text-align: center;
        }
        .ist-tbl tbody tr:last-child td {
          border-bottom: none;
        }
        .ist-pagination-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #6b7280; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s; font-family: 'Inter',-apple-system,sans-serif; }
        .ist-pagination-btn:hover:not(:disabled) { background: #f0fdf4; border-color: #a3e635; }
        .ist-pagination-btn.active { background: #a3e635; border-color: #a3e635; color: #fff; }
        .ist-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }

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
        
        /* Floating bubble effects on stat cards */
        .ist-stats-grid > div {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }
        
        .ist-stats-grid > div::before {
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
        
        .ist-stats-grid > div::after {
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
        .ist-stats-grid > div:nth-child(1)::before,
        .ist-stats-grid > div:nth-child(1)::after {
          background: #667eea;
        }
        
        .ist-stats-grid > div:nth-child(2)::before,
        .ist-stats-grid > div:nth-child(2)::after {
          background: #3b82f6;
        }
        
        .ist-stats-grid > div:nth-child(3)::before,
        .ist-stats-grid > div:nth-child(3)::after {
          background: #f59e0b;
        }
        
        .ist-stats-grid > div:nth-child(4)::before,
        .ist-stats-grid > div:nth-child(4)::after {
          background: #10b981;
        }
        
        .ist-stats-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
        .ist-stats-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
        .ist-stats-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
        
        .ist-stats-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
        .ist-stats-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
        .ist-stats-grid > div:nth-child(4)::after { animation-delay: 1.8s; }

        .timeline-container::-webkit-scrollbar {
          width: 6px;
        }
        .timeline-container::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .timeline-container::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .timeline-container::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        /* Employee Management Download Button Styles */
        .emp-download-btn {
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
        .emp-download-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px', padding: '0 24px' }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.025em" }}>Track Employee Activities</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>
            Live agent activity log — auto-refreshes every 30 seconds
            {lastUpdated && (
              <span style={{ color: '#cbd5e1', marginLeft: '5px' }}>
                · Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div ref={agentDropRef} style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative' }}>
          <button
            onClick={() => setShowAgentNotification(!showAgentNotification)}
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', background: showAgentNotification ? '#f8fafc' : '#fff', color: '#475569', fontSize: '12px', fontWeight: 750, cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = showAgentNotification ? '#cbd5e1' : '#e2e8f0'; e.currentTarget.style.background = showAgentNotification ? '#f8fafc' : '#fff'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            Agent Status
            {(agentStatus.updateAvailable || !agentStatus.installed) && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', position: 'absolute', top: '-2px', right: '-2px', border: '2px solid #fff' }} />
            )}
          </button>

          {showAgentNotification && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: '110px', zIndex: 100, width: '380px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15), 0 4px 6px -4px rgba(0,0,0,0.1)', animation: 'fadeIn 0.2s ease-out' }}>
              {renderAgentCard()}
            </div>
          )}

          <button
            onClick={async () => {
              try {
                const [pRes, eRes] = await Promise.all([
                  api.get('/access-policies'),
                  api.get('/employees')
                ]);
                setAllEmployees(eRes.data?.filter(e => e.isActive !== false) || []);
                const firstPolicy = pRes.data?.[0];
                if (firstPolicy) {
                  const fullPolicy = await api.get(`/access-policies/${firstPolicy._id}`);
                  setSelectedPolicyForEdit(fullPolicy.data);
                } else {
                  setSelectedPolicyForEdit(null);
                }
                setShowPolicyModal(true);
              } catch (err) {
                console.error(err);
              }
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              border: '1px solid #c7d2fe',
              borderRadius: '10px',
              background: '#eef2ff',
              color: '#4338ca',
              fontSize: '12px',
              fontWeight: 750,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
            }}
          >
            <Shield size={14} />
            Access Policies
          </button>

          <button
            onClick={() => { fetchActivities(true); fetchAgentStatus(); }}
            disabled={refreshing}
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
              fontWeight: 750,
              cursor: 'pointer',
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
            }}
          >
            <svg style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="ist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px', padding: '0 24px' }}>
        {[
          { label: 'Total Employees', value: new Set(activities.map(a => a.employeeId)).size, color: '#667eea', spark: sparklineData.total, bottomLabel: 'employees tracked' },
          { label: 'Active Time', value: formatDuration(metrics.totalActive), color: '#3b82f6', spark: sparklineData.active, bottomLabel: 'working online', onClick: () => { if (isPrivileged) setShowActiveTimeModal(true); } },
          { label: 'Idle Time', value: formatDuration(metrics.totalIdle), color: '#f59e0b', spark: sparklineData.idle, bottomLabel: 'inactivity detected', onClick: () => setShowIdleModal(true) },
          { label: 'App Utilization', value: metrics.uniqueAppsCount, color: '#10b981', spark: sparklineData.apps, bottomLabel: 'applications used', onClick: () => { if (isPrivileged) setShowUniqueAppsModal(true); } },
        ].map(({ label, value, color, spark, bottomLabel, onClick }) => (
          <div
            key={label}
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '16px',
              border: label === 'Total Employees' ? `1px solid ${color}` : '1px solid #e2e8f0',
              boxShadow: label === 'Total Employees' ? `0 2px 8px ${color}20` : 'none',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              cursor: onClick ? 'pointer' : 'default',
              overflow: 'hidden',
              transition: 'all 0.2s',
              minHeight: '130px'
            }}
            onClick={onClick}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; e.currentTarget.style.borderColor = color; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = label === 'Total Employees' ? `0 2px 8px ${color}20` : 'none'; e.currentTarget.style.borderColor = label === 'Total Employees' ? color : '#e2e8f0'; }}
          >
            {/* Background Blob */}
            <div style={{
              position: 'absolute',
              right: '-15px',
              bottom: '-15px',
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color}22 0%, ${color}00 70%)`,
              zIndex: 0
            }} />

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
                  {label}
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#1e293b', lineHeight: 1.2, marginBottom: '12px' }}>
                  {value}
                </div>
              </div>
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>
                  {bottomLabel}
                </div>
              </div>
              <div style={{ width: '60px', height: '24px', marginRight: '4px' }}>
                <Sparkline data={spark} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table Card */}
      <div style={{ margin: '0 24px 24px', background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'visible', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>

        {/* Filter Bar */}
        <div ref={filterDropRef} style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: '#fafafa', borderRadius: '14px 14px 0 0', position: 'relative', zIndex: 10 }}>

          {/* Search Wrapper */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', flex: '1', minWidth: '220px', maxWidth: '320px', transition: 'all 0.2s' }}
            onFocus={e => {
              e.currentTarget.style.borderColor = '#3b775e';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.08)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = '#e5e7eb';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            <input
              type="text"
              placeholder="Search employee, ID or app name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#0f172a', background: 'transparent', width: '100%', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500 }}
            />
          </div>

          {/* Filters List */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>

            {/* Roles Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenFilterDrop(p => p === 'role' ? null : 'role')}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: `1px solid ${filterRole ? '#3b775e' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px', color: filterRole ? '#3b775e' : '#475569', background: filterRole ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
              >
                {filterRole || 'All Roles'}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {openFilterDrop === 'role' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '10px', minWidth: '180px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 4px' }}>Filter by Role</div>
                  <button
                    onClick={() => { setFilterRole(''); setOpenFilterDrop(null); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: !filterRole ? '#f0fdf4' : 'transparent', color: !filterRole ? '#15803d' : '#475569', fontSize: '12px', fontWeight: !filterRole ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                  >All Roles</button>
                  {uniqueRoles.map(role => (
                    <button
                      key={role}
                      onClick={() => { setFilterRole(role); setOpenFilterDrop(null); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: filterRole === role ? '#f0fdf4' : 'transparent', color: filterRole === role ? '#15803d' : '#475569', fontSize: '12px', fontWeight: filterRole === role ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                    >{role}</button>
                  ))}
                </div>
              )}
            </div>



            {/* Sorting Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setOpenFilterDrop(p => p === 'sort' ? null : 'sort')}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#475569', background: '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
              >
                {sortBy === 'newest' ? 'Newest First' : 'Oldest First'}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {openFilterDrop === 'sort' && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '10px', minWidth: '150px' }}>
                  <button
                    onClick={() => { setSortBy('newest'); setOpenFilterDrop(null); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: sortBy === 'newest' ? '#f0fdf4' : 'transparent', color: sortBy === 'newest' ? '#15803d' : '#475569', fontSize: '12px', fontWeight: sortBy === 'newest' ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                  >Newest First</button>
                  <button
                    onClick={() => { setSortBy('oldest'); setOpenFilterDrop(null); }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: sortBy === 'oldest' ? '#f0fdf4' : 'transparent', color: sortBy === 'oldest' ? '#15803d' : '#475569', fontSize: '12px', fontWeight: sortBy === 'oldest' ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                  >Oldest First</button>
                </div>
              )}
            </div>

            {isFiltered && (
              <button className="is-clear-btn" onClick={clearFilters}>
                Clear Filters
              </button>
            )}
          </div>

          <span className="is-result-count">
            Showing {uniqueEmployeeRows.length} of {new Set(activities.map(a => a.employeeId)).size} employees
          </span>
        </div>

        {/* Table Wrapper */}
        <div className="is-table-wrap">
          <table className="ist-tbl" style={{ tableLayout: 'auto' }}>
            <thead>
              <tr>
                <th style={{ width: '40px', paddingLeft: '16px' }}>#</th>
                <th style={{ width: '110px' }}>Employee ID</th>
                <th>Employee Name</th>
                <th>Role</th>
                <th style={{ width: '120px' }}>Tracking</th>
                <th>Date & Time</th>
                <th>Current Tab / Application</th>
                <th style={{ width: '110px' }}>Idle Time</th>
                <th style={{ width: '140px', textAlign: 'center', paddingRight: '16px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#64748b' }}>
                      <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#3b775e', borderRadius: '50%', animation: 'is-spin 0.7s linear infinite' }} />
                      <span style={{ fontSize: '12px' }}>Loading activities...</span>
                    </div>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div className="is-empty-state">
                      <span style={{ fontSize: '32px', marginBottom: '8px' }}>📋</span>
                      <p style={{ color: '#64748b', fontSize: '13px' }}>No activities logs found matching criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginated.map((act, idx) => {
                  const isTrackingOn = liveTracking.some(item => item.employeeId === act.employeeId && item.status === 'tracking');
                  const empIdleObj = idleEmployees.find(e => e.employeeId === act.employeeId);
                  const empIdle = empIdleObj ? empIdleObj.idleSeconds : 0;
                  return (
                    <tr key={act._id}>
                      <td style={{ paddingLeft: '16px', color: '#94a3b8', fontWeight: 600 }}>
                        {startIndex + idx + 1}
                      </td>
                      <td style={{ fontWeight: '700', color: '#0f172a' }}>
                        {act.employeeId}
                      </td>
                      <td style={{ fontWeight: '500', color: '#0f172a' }}>{act.employeeName}</td>
                      <td>
                        <span style={getRoleBadgeStyle(act.role)}>
                          {act.role || 'Employee'}
                        </span>
                      </td>
                      <td>
                        {isTrackingOn ? (
                          <span
                            className="is-status-badge status-qualified"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              background: '#f0fdf4',
                              color: '#16a34a',
                              fontSize: '9px',
                              fontWeight: '600',
                              border: '1px solid #dcfce7',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em'
                            }}
                          >
                            <span
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                background: '#22c55e',
                                animation: 'actPulse 1.8s ease-in-out infinite',
                                marginRight: '1px'
                              }}
                            />
                            Active
                          </span>
                        ) : (
                          <span
                            className="is-status-badge status-not-interested"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              background: '#fef2f2',
                              color: '#ef4444',
                              fontSize: '9px',
                              fontWeight: '600',
                              border: '1px solid #fee2e2',
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em'
                            }}
                          >
                            <span
                              style={{
                                width: '5px',
                                height: '5px',
                                borderRadius: '50%',
                                background: '#ef4444',
                                marginRight: '1px'
                              }}
                            />
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#64748b', fontSize: '10.5px', fontWeight: '500' }}>
                        {new Date(act.startTime).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                          <AppIcon appName={isTrackingOn ? (liveApps[act.employeeId] || act.appName) : act.appName} />
                          {isTrackingOn && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#ecfdf5',
                              color: '#059669',
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: '700',
                              border: '1px solid #a7f3d0',
                              gap: '3px'
                            }}>
                              <span style={{
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: '#10b981',
                                animation: 'actPulse 1.5s ease-in-out infinite'
                              }} />
                              LIVE
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{
                        color: act.appName === "System Idle (No Activity)" && act.durationSeconds > 120 ? '#dc2626' : '#475569',
                        fontWeight: act.appName === "System Idle (No Activity)" && act.durationSeconds > 120 ? '600' : '400'
                      }}>
                        {act.appName === "System Idle (No Activity)" ? formatIdleTime(act.durationSeconds) : '—'}
                      </td>
                      <td style={{ textAlign: 'center', paddingRight: '16px' }}>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
                          <button
                            title="View Activities"
                            style={{
                              background: 'transparent',
                              color: '#059669',
                              border: 'none',
                              padding: '2px',
                              marginRight: '6px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'opacity 0.2s ease',
                              opacity: 0.8
                            }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; }}
                            onClick={() => handleTrackActivityClick(act.employeeId, act.employeeName)}
                          >
                            <Activity size={15} strokeWidth={2.5} />
                          </button>
                          
                          <button
                            title="Configure Blocklist & Policies"
                            style={{
                              background: 'transparent',
                              color: '#6366f1',
                              border: 'none',
                              padding: '2px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'opacity 0.2s ease',
                              opacity: 0.8
                            }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; }}
                            onClick={async () => {
                              try {
                                const [pRes, eRes] = await Promise.all([
                                  api.get('/access-policies'),
                                  api.get('/employees')
                                ]);
                                const emps = eRes.data?.filter(e => e.isActive !== false) || [];
                                setAllEmployees(emps);
                                const currentEmp = emps.find(e => e.employeeId === act.employeeId || e._id === act.employeeId);
                                
                                const firstPolicy = pRes.data?.[0];
                                if (firstPolicy) {
                                  const fullPolicy = await api.get(`/access-policies/${firstPolicy._id}`);
                                  // Pre-select this employee if not selected
                                  const policyObj = fullPolicy.data;
                                  if (currentEmp && !policyObj.assignedEmployees?.some(e => e._id === currentEmp._id)) {
                                    policyObj.assignedEmployees = [...(policyObj.assignedEmployees || []), currentEmp];
                                  }
                                  setSelectedPolicyForEdit(policyObj);
                                } else {
                                  setSelectedPolicyForEdit(null);
                                }
                                setShowPolicyModal(true);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                          >
                            <Shield size={15} strokeWidth={2.5} />
                          </button>

                          <button
                            title="View Live Screen"
                            style={{
                              background: 'transparent',
                              color: '#0ea5e9',
                              border: 'none',
                              padding: '2px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'opacity 0.2s ease',
                              opacity: 0.8
                            }}
                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.8'; }}
                            onClick={() => {
                              setSelectedLiveEmployee({ id: act.employeeId, name: act.employeeName });
                              setShowLiveScreenModal(true);
                            }}
                          >
                            <Video size={15} strokeWidth={2.5} />
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

        {/* Pagination */}
        {uniqueEmployeeRows.length > 0 && (
          <div className="is-pagination">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                Showing {paginated.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + itemsPerPage, uniqueEmployeeRows.length)} of {uniqueEmployeeRows.length} entries
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="ist-pagination-btn" style={{ width: 'auto', padding: '0 12px' }} disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</button>
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button key={i} className={`ist-pagination-btn ${currentPage === i + 1 ? 'active' : ''}`} onClick={() => setCurrentPage(i + 1)}>{i + 1}</button>
                ))}
                <button className="ist-pagination-btn" style={{ width: 'auto', padding: '0 12px' }} disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}>Next</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Modal (Timeline) */}
      {showTimelineModal && (
        <div className="is-modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowTimelineModal(false)}>
          <div
            className="is-modal"
            style={{
              maxWidth: '850px',
              width: '90%',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
              background: 'white',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: '#3b775e' }} />
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  Activity Logs: {selectedEmployeeName} ({selectedEmployeeId})
                </h2>
              </div>
              <button
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.2s'
                }}
                onClick={() => setShowTimelineModal(false)}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filters */}
            <div style={{ padding: '14px 24px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                  <Search size={14} />
                </div>
                <input
                  type="text"
                  className="is-search-input"
                  style={{ paddingLeft: '32px' }}
                  placeholder="Filter timeline by application name..."
                  value={modalSearchTerm}
                  onChange={e => setModalSearchTerm(e.target.value)}
                />
              </div>

            </div>

            {/* Body */}
            <div
              className="timeline-container"
              style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1
              }}
            >
              {timelineLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ width: '36px', height: '36px', border: '3px solid #e2e8f0', borderTopColor: '#3b775e', borderRadius: '50%', animation: 'is-spin 0.7s linear infinite', margin: '0 auto 12px' }} />
                  <span style={{ fontSize: '13px', color: '#64748b' }}>Loading chronological history...</span>
                </div>
              ) : filteredTimeline.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
                  <span style={{ fontSize: '28px', display: 'block', marginBottom: '8px' }}>🔍</span>
                  <span style={{ fontSize: '13px' }}>No logs found for the selected application/date.</span>
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #e2e8f0', margin: '4px 0 4px 8px' }}>
                  {filteredTimeline.map((item, idx) => {
                    const isSystemIdleBlock = item.appName === "System Idle (No Activity)";
                    return (
                      <div key={item._id || idx} style={{ position: 'relative', marginBottom: '24px' }}>
                        {/* Bullet */}
                        <div style={{
                          position: 'absolute',
                          left: '-31px',
                          top: '5px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: isSystemIdleBlock ? '#ea580c' : '#3b775e',
                          border: '3px solid white',
                          boxShadow: '0 0 0 2px ' + (isSystemIdleBlock ? '#ffedd5' : '#e2f0e9')
                        }} />

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          background: isSystemIdleBlock ? '#fff7ed' : '#f8fafc',
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: isSystemIdleBlock ? '1px solid #ffedd5' : '1px solid #f1f5f9',
                          transition: 'background 0.2s'
                        }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <AppIcon appName={item.appName} />
                              {isSystemIdleBlock && (
                                <span className="is-status-badge status-follow-up" style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '3px', background: '#ffedd5', color: '#ea580c', border: '1px solid #fed7aa' }}>
                                  System Idle
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={11} />
                              <span>
                                {new Date(item.startTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                {' - '}
                                {new Date(item.endTime).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span style={{ color: '#cbd5e1' }}>|</span>
                              <span>{formatDateOnly(item.startTime)}</span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>
                              Duration: {formatDuration(item.durationSeconds)}
                            </div>
                            {item.idleSeconds > 0 && (
                              <div style={{ fontSize: '11px', color: item.idleSeconds > 120 ? '#dc2626' : '#64748b', marginTop: '2px', fontWeight: item.idleSeconds > 120 ? '500' : '400' }}>
                                Idle Time: {formatDuration(item.idleSeconds)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', background: '#fafafa' }}>
              <button
                className="ist-btn-ghost"
                style={{ padding: '8px 16px', borderRadius: '6px' }}
                onClick={() => setShowTimelineModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {showAgentGuide && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(248, 250, 252, 0.7)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ background: '#ffffff', borderRadius: '24px', border: '1px solid rgba(226, 232, 240, 0.8)', padding: '32px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '700px', position: 'relative', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <button onClick={() => setShowAgentGuide(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#0f172a'} onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}>
              <X size={20} strokeWidth={2} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', flexShrink: 0 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em' }}>Bhoomi Desktop Agent</h3>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Secure, lightweight background tracker for precise activity and time logging.</p>
                </div>
              </div>

              {/* Specifications Section */}
              <div style={{ display: 'flex', gap: '16px', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Shield size={14} style={{ color: '#0ea5e9' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>Silent Tracking</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>Runs quietly without windows.</p>
                </div>
                <div style={{ width: '1px', background: '#e2e8f0' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Activity size={14} style={{ color: '#10b981' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>Real-time Sync</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>Live activity updates to HRMS.</p>
                </div>
                <div style={{ width: '1px', background: '#e2e8f0' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Clock size={14} style={{ color: '#8b5cf6' }} />
                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a' }}>Idle Monitor</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>Smart inactivity detection.</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: '#f1f5f9', color: '#475569', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>1</span>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Download Agent</h4>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>Download the zip file below.</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: '#f1f5f9', color: '#475569', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>2</span>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Extract & Install</h4>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>Extract and run the setup file.</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: '#f1f5f9', color: '#475569', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>3</span>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Complete Setup</h4>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>Follow on-screen instructions.</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '32px', height: '32px', background: '#f1f5f9', color: '#475569', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>4</span>
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Connect</h4>
                  <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>Login with your HRMS credentials.</p>
                </div>
              </div>
            </div>

            <div style={{ paddingTop: '8px' }}>
              <button
                className="emp-download-btn"
                onClick={() => { handleDownload(agentStatus?.latestVersion); setShowAgentGuide(false); }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Download size={15} />
                <span>Download Desktop Agent</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Idle Employees Modal */}
      {showIdleModal && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(3px)', animation: 'fadeIn 0.2s ease-out' }}
          onClick={() => setShowIdleModal(false)}
        >
          <div
            style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '750px', maxHeight: '85vh', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: '#f59e0b' }} />
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  Idle Employees Details
                </h2>
              </div>
              <button
                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                onClick={() => setShowIdleModal(false)}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {idleEmployees.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No employees are currently idle.
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'auto', flex: 1, minHeight: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Employee Name</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Designation</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Idle Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {idleEmployees.map((emp, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: '500' }}>{emp.employeeName}</td>
                          <td style={{ padding: '12px 16px', color: '#64748b' }}>
                            <span style={{ color: '#475569', fontWeight: '500' }}>
                              {emp.designation || emp.role || 'Unknown'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#ea580c', fontWeight: '600' }}>{formatDurationNoSeconds(emp.idleSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unique Apps Details Modal */}
      {showUniqueAppsModal && (
        <div className="is-modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowUniqueAppsModal(false)}>
          <div
            className="is-modal"
            style={{
              maxWidth: '600px',
              width: '100%',
              borderRadius: '12px',
              background: 'white',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} style={{ color: '#10b981' }} />
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  Application Usage Overview
                </h2>
              </div>
              <button
                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                onClick={() => setShowUniqueAppsModal(false)}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              {appUsageData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13px' }}>
                  No app usage data available.
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: '#475569' }}>App Name</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Users</th>
                        <th style={{ padding: '12px 16px', fontWeight: '600', color: '#475569', textAlign: 'right' }}>Total Time Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appUsageData.map((app, idx) => (
                        <React.Fragment key={idx}>
                          <tr 
                            style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: expandedApp === app.appName ? '#f8fafc' : 'white' }}
                            onClick={() => setExpandedApp(expandedApp === app.appName ? null : app.appName)}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AppIcon appName={app.appName} />
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: '500' }}>
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {app.users.slice(0, 5).map((u, i) => (
                                  <div key={i} style={{
                                    width: '24px', height: '24px', borderRadius: '50%', background: '#cbd5e1', 
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '10px', fontWeight: 'bold', marginLeft: i > 0 ? '-8px' : '0',
                                    border: '2px solid white', zIndex: 10 - i, title: u.employeeName
                                  }}>
                                    {u.employeeName.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {app.users.length > 5 && (
                                  <div style={{
                                    width: '24px', height: '24px', borderRadius: '50%', background: '#e2e8f0', 
                                    color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '10px', fontWeight: 'bold', marginLeft: '-8px', border: '2px solid white', zIndex: 5
                                  }}>
                                    +{app.users.length - 5}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: '600', textAlign: 'right' }}>
                              {formatDurationNoSeconds(app.totalDuration)}
                            </td>
                          </tr>
                          {expandedApp === app.appName && (
                            <tr>
                              <td colSpan="3" style={{ padding: 0 }}>
                                <div style={{ background: '#f8fafc', padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
                                  <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>Employee Usage Details</h4>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                      <tr style={{ borderBottom: '1px solid #cbd5e1' }}>
                                        <th style={{ padding: '8px', color: '#64748b' }}>Name</th>
                                        <th style={{ padding: '8px', color: '#64748b' }}>Email</th>
                                        <th style={{ padding: '8px', color: '#64748b' }}>Designation</th>
                                        <th style={{ padding: '8px', color: '#64748b', textAlign: 'right' }}>Time Spent</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {app.users.map((u, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                          <td style={{ padding: '8px', fontWeight: '500', color: '#1e293b' }}>{u.employeeName}</td>
                                          <td style={{ padding: '8px', color: '#64748b' }}>{u.email || '-'}</td>
                                          <td style={{ padding: '8px', color: '#64748b' }}>{u.designation || u.role || '-'}</td>
                                          <td style={{ padding: '8px', color: '#3b82f6', fontWeight: '600', textAlign: 'right' }}>{formatDurationNoSeconds(u.timeSpent)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Time Details Modal */}
      {showActiveTimeModal && (
        <div className="is-modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowActiveTimeModal(false)}>
          <div
            className="is-modal"
            style={{
              maxWidth: '750px',
              width: '100%',
              borderRadius: '12px',
              background: 'white',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '85vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: '#3b82f6' }} />
                <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  Active Time by Employee
                </h2>
              </div>
              <button
                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
                onClick={() => setShowActiveTimeModal(false)}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              {activeEmployees.length === 0 ? (
                <div style={{ margin: 'auto', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No active time data available.
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'auto', flex: 1, minHeight: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Employee Name</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Designation</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '12px 16px', fontWeight: '600', color: '#475569' }}>Tracking</th>
                        <th style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '12px 16px', fontWeight: '600', color: '#475569', textAlign: 'right' }}>Active Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmployees.map((emp, idx) => {
                        const isTrackingOn = liveTracking.some(item => item.employeeId === emp.employeeId && item.status === 'tracking');
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '12px 16px', color: '#1e293b', fontWeight: '500' }}>{emp.employeeName}</td>
                            <td style={{ padding: '12px 16px', color: '#64748b' }}>
                              <span style={{ color: '#475569', fontWeight: '500' }}>
                                {emp.designation || emp.role || 'Unknown'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              {isTrackingOn ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px',
                                  background: '#f0fdf4', color: '#16a34a', fontSize: '9px', fontWeight: '600', border: '1px solid #dcfce7', textTransform: 'uppercase', letterSpacing: '0.03em'
                                }}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', animation: 'actPulse 1.8s ease-in-out infinite', marginRight: '1px' }} />
                                  Active
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '20px',
                                  background: '#fef2f2', color: '#ef4444', fontSize: '9px', fontWeight: '600', border: '1px solid #fee2e2', textTransform: 'uppercase', letterSpacing: '0.03em'
                                }}>
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444', marginRight: '1px' }} />
                                  Deactivated
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#3b82f6', fontWeight: '600', textAlign: 'right' }}>{formatDurationNoSeconds(emp.activeSeconds)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Screen Modal */}
      {showLiveScreenModal && selectedLiveEmployee && (
        <LiveScreenModal
          employeeId={selectedLiveEmployee.id}
          employeeName={selectedLiveEmployee.name}
          onClose={() => {
            setShowLiveScreenModal(false);
            setSelectedLiveEmployee(null);
          }}
        />
      )}

      {/* Access Policy & Blocklist Modal */}
      {showPolicyModal && (
        <AccessPolicyModal
          policy={selectedPolicyForEdit}
          employees={allEmployees}
          onClose={() => {
            setShowPolicyModal(false);
            setSelectedPolicyForEdit(null);
          }}
          onSaved={() => {
            setShowPolicyModal(false);
            setSelectedPolicyForEdit(null);
            fetchActivities(true);
          }}
        />
      )}
    </div>
  );
}


export default Activities;
