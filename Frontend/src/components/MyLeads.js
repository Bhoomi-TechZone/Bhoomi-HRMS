import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './MyLeads.css';

const STATUS_OPTIONS = ['New', 'Connected', 'Interested', 'Follow-up', 'Not Connected', 'Not Interested', 'Converted'];
const FOLLOW_UP_TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = Math.floor(i / 2) || 12;
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minutes}`;
});

const META_STATUS_COLORS = {
  'New': '#1e40af',
  'Contacted': '#9a3412',
  'Qualified': '#047857',
  'Interested': '#3730a3',
  'Follow-up': '#6b21a8',
  'Converted': '#166534',
  'Not Interested': '#991b1b',
  'Closed': '#334155'
};

const META_STATUS_BG_COLORS = {
  'New': '#dbeafe',
  'Contacted': '#ffedd5',
  'Qualified': '#d1fae5',
  'Interested': '#e0e7ff',
  'Follow-up': '#f3e8ff',
  'Converted': '#dcfce7',
  'Not Interested': '#fee2e2',
  'Closed': '#f1f5f9'
};

function MyLeads() {
  const { user, hasPermission } = useAuth();
  const canRead = hasPermission('leads', 'read');
  const canCreate = hasPermission('leads', 'create');
  const canUpdate = hasPermission('leads', 'update');
  const canDelete = hasPermission('leads', 'delete');

  // Admin sees ALL leads in the system.
  // Everyone else (even with canRead) sees only leads assigned to them.
  const hasFullAccess =
    user?.role?.name === 'Admin' ||
    user?.role?.name === 'HR' ||
    user?.role?.name === 'Manager' ||
    user?.role?.name === 'HR Manager';

  const isSales = user?.role?.name?.toLowerCase().includes('sales');

  // ── Data ──────────────────────────────────────────────────────────────────
  const [leads, setLeads] = useState([]);          // regular leads
  const [metaLeads, setMetaLeads] = useState([]);  // meta leads (normalised)
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // ── Pagination ────────────────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 10;

  // ── Regular-lead modals ───────────────────────────────────────────────────
  const [selectedLead, setSelectedLead] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusFollowUpAt, setStatusFollowUpAt] = useState('');
  const [activeFollowUpPicker, setActiveFollowUpPicker] = useState(null);
  const [openFollowUpDrop, setOpenFollowUpDrop] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [pendingConversion, setPendingConversion] = useState(null);

  // ── Add Lead Modal states ──────────────────────────────────────────────────
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [addLeadSaving, setAddLeadSaving] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    country: '',
    industry: '',
    source: 'Manual',
    budget: '',
    requirement: '',
    notes: '',
    leadType: '',
    assignedTo: ''
  });

  // ── Employee summary modal/card states ─────────────────────────────────────
  const [showEmployeeSummaryModal, setShowEmployeeSummaryModal] = useState(false);
  const [employeeSummaryData, setEmployeeSummaryData] = useState(null);
  const [employeeSummaryLoading, setEmployeeSummaryLoading] = useState(false);

  // ── Meta-lead modal ───────────────────────────────────────────────────────
  const [metaSelected, setMetaSelected] = useState(null);
  const [showMetaModal, setShowMetaModal] = useState(false);
  const [metaEditForm, setMetaEditForm] = useState({ assignedTo: '', status: '', notes: '', followUpDate: '' });
  const [metaSaving, setMetaSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // ── Regular-lead rich edit form ───────────────────────────────────────────
  const [leadEditForm, setLeadEditForm] = useState({
    assignedTo: '', status: '', notes: '', followUpDate: '',
    // Full editable fields
    name: '', email: '', phone: '', company: '',
    country: '', industry: '', requirement: '',
    source: '', budget: '', leadType: '',
  });
  const [leadSaving, setLeadSaving] = useState(false);
  // ── Follow-up reminders ──────────────────────────────────────────────
  const [followUpAlerts, setFollowUpAlerts] = useState([]);
  const [showFollowUpPanel, setShowFollowUpPanel] = useState(false);
  const [notificationPosition, setNotificationPosition] = useState({ x: null, y: null });
  const followUpWidgetRef = useRef(null);
  const headerActionsRef = useRef(null);
  const exportButtonRef = useRef(null);
  const hasDraggedNotificationRef = useRef(false);
  const notificationDragRef = useRef({ dragging: false, moved: false, offsetX: 0, offsetY: 0, startX: 0, startY: 0 });
  const touchToggledRef = useRef(false); // suppresses synthetic click after touchend toggle
  const [notifHighlight, setNotifHighlight] = useState(false);
  const notifHighlightFiredRef = useRef(false); // fire only once per page load

  // ── Excel Upload ──────────────────────────────────────────────────────────────
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadRows, setUploadRows] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  // ── Assign dropdown for Excel leads ──────────────────────────────────────
  const [openAssignDropdown, setOpenAssignDropdown] = useState(null); // leadId
  const [assignDropPos, setAssignDropPos] = useState({ top: 0, left: 0 });
  const [assignSearch, setAssignSearch] = useState('');
  const assignDropdownRef = useRef(null);
  // ── Filter card dropdowns ─────────────────────────────────────────────────
  const [openFilterDrop, setOpenFilterDrop] = useState(null); // 'status'|'source'|'employee'|'date'|'sort'|null
  const [filterEmpSearch, setFilterEmpSearch] = useState('');
  const filterDropRef = useRef(null);
  // ── Inline row status card dropdowns ─────────────────────────────────────
  const [openStatusDrop, setOpenStatusDrop] = useState(null); // leadId
  const [statusDropPos, setStatusDropPos] = useState({ top: 0, left: 0 });
  const statusDropRef = useRef(null);
  // ── Inline row leadType card dropdowns ─────────────────────────────────────
  const [openLeadTypeDrop, setOpenLeadTypeDrop] = useState(null); // leadId
  const [leadTypeDropPos, setLeadTypeDropPos] = useState({ top: 0, left: 0 });
  const leadTypeDropRef = useRef(null);
  // ── Multi Assign ──────────────────────────────────────────────────────────
  const [multiAssignMode, setMultiAssignMode] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
  const [showMultiAssignModal, setShowMultiAssignModal] = useState(false);
  const [multiAssignEmployee, setMultiAssignEmployee] = useState('');
  const [multiAssignSearch, setMultiAssignSearch] = useState('');
  const [multiAssigning, setMultiAssigning] = useState(false);
  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    try {
      const [leadsRes, metaRes, empRes] = await Promise.allSettled([
        api.get('/leads'),
        api.get('/meta-leads?limit=1000'),
        api.get('/employees'),
      ]);
      if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data || []);
      if (metaRes.status === 'fulfilled') setMetaLeads(metaRes.value.data.leads || []);
      if (empRes.status === 'fulfilled') setEmployees((empRes.value.data || []).filter(u => u.isActive));
    } catch (err) {
      console.error('fetchAll error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Close assign dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (assignDropdownRef.current && !assignDropdownRef.current.contains(e.target)) {
        setOpenAssignDropdown(null);
        setAssignSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close filter dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (filterDropRef.current && !filterDropRef.current.contains(e.target)) {
        setOpenFilterDrop(null);
        setFilterEmpSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close inline status dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (statusDropRef.current && !statusDropRef.current.contains(e.target)) {
        setOpenStatusDrop(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close inline leadType dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (leadTypeDropRef.current && !leadTypeDropRef.current.contains(e.target)) {
        setOpenLeadTypeDrop(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const clampNotificationPosition = useCallback((x, y) => {
    const pad = 12;
    const widgetWidth = followUpWidgetRef.current?.offsetWidth || (showFollowUpPanel ? 360 : 170);
    const widgetHeight = followUpWidgetRef.current?.offsetHeight || (showFollowUpPanel ? 220 : 44);
    const maxX = Math.max(pad, window.innerWidth - widgetWidth - pad);
    const maxY = Math.max(pad, window.innerHeight - widgetHeight - pad);

    return {
      x: Math.min(Math.max(pad, x), maxX),
      y: Math.min(Math.max(pad, y), maxY),
    };
  }, [showFollowUpPanel]);

  const placeNotificationNearHeader = useCallback(() => {
    if (typeof window === 'undefined') return;

    const anchorRect = exportButtonRef.current?.getBoundingClientRect() || headerActionsRef.current?.getBoundingClientRect();
    if (!anchorRect) return;

    const widgetWidth = followUpWidgetRef.current?.offsetWidth || (showFollowUpPanel ? 360 : 170);
    const next = clampNotificationPosition(
      exportButtonRef.current ? anchorRect.left - widgetWidth - 10 : anchorRect.right - widgetWidth,
      Math.max(12, anchorRect.top)
    );

    setNotificationPosition(next);
  }, [clampNotificationPosition, showFollowUpPanel]);

  const startNotificationDrag = (e) => {
    if (e.button !== 0) return;

    const rect = followUpWidgetRef.current?.getBoundingClientRect();
    const currentX = notificationPosition.x ?? (window.innerWidth - (rect?.width || 170) - 16);
    const currentY = notificationPosition.y ?? (window.innerHeight - (rect?.height || 44) - 16);

    notificationDragRef.current = {
      dragging: true,
      moved: false,
      offsetX: e.clientX - currentX,
      offsetY: e.clientY - currentY,
      startX: e.clientX,
      startY: e.clientY,
    };

    document.body.style.userSelect = 'none';
  };

  const startNotificationDragTouch = (e) => {
    const touch = e.touches[0];
    const rect = followUpWidgetRef.current?.getBoundingClientRect();
    const currentX = notificationPosition.x ?? (window.innerWidth - (rect?.width || 170) - 16);
    const currentY = notificationPosition.y ?? (window.innerHeight - (rect?.height || 44) - 16);

    notificationDragRef.current = {
      dragging: true,
      moved: false,
      offsetX: touch.clientX - currentX,
      offsetY: touch.clientY - currentY,
      startX: touch.clientX,
      startY: touch.clientY,
    };

    document.body.style.userSelect = 'none';
  };

  const handleNotificationToggle = () => {
    // Suppress synthetic click fired right after touchend
    if (touchToggledRef.current) {
      touchToggledRef.current = false;
      return;
    }
    if (notificationDragRef.current.moved) {
      notificationDragRef.current.moved = false;
      return;
    }
    setShowFollowUpPanel(v => !v);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      const drag = notificationDragRef.current;
      if (!drag.dragging) return;

      if (Math.abs(e.clientX - drag.startX) > 3 || Math.abs(e.clientY - drag.startY) > 3) {
        drag.moved = true;
        hasDraggedNotificationRef.current = true;
      }

      const next = clampNotificationPosition(
        e.clientX - drag.offsetX,
        e.clientY - drag.offsetY
      );

      setNotificationPosition(next);
    };

    const handleMouseUp = () => {
      if (!notificationDragRef.current.dragging) return;
      notificationDragRef.current.dragging = false;
      document.body.style.userSelect = '';
    };

    const handleTouchMove = (e) => {
      const drag = notificationDragRef.current;
      if (!drag.dragging) return;
      const touch = e.touches[0];

      if (Math.abs(touch.clientX - drag.startX) > 3 || Math.abs(touch.clientY - drag.startY) > 3) {
        drag.moved = true;
        hasDraggedNotificationRef.current = true;
        e.preventDefault(); // prevent page scroll while dragging
      }

      const next = clampNotificationPosition(
        touch.clientX - drag.offsetX,
        touch.clientY - drag.offsetY
      );

      setNotificationPosition(next);
    };

    const handleTouchEnd = () => {
      if (!notificationDragRef.current.dragging) return;
      notificationDragRef.current.dragging = false;
      document.body.style.userSelect = '';
      // If touch ended without moving, treat as toggle tap
      if (!notificationDragRef.current.moved) {
        touchToggledRef.current = true; // flag so the synthetic click skips
        setShowFollowUpPanel(v => !v);
      }
      notificationDragRef.current.moved = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      document.body.style.userSelect = '';
    };
  }, [clampNotificationPosition]);

  useEffect(() => {
    if (notificationPosition.x === null || notificationPosition.y === null) return;

    setNotificationPosition((prev) => {
      const next = clampNotificationPosition(prev.x, prev.y);
      return next.x === prev.x && next.y === prev.y ? prev : next;
    });
  }, [showFollowUpPanel, followUpAlerts.length, clampNotificationPosition, notificationPosition.x, notificationPosition.y]);

  useEffect(() => {
    if (!followUpAlerts.length) {


      hasDraggedNotificationRef.current = false;
      setNotificationPosition({ x: null, y: null });
      return;
    }

    const syncNotificationPosition = () => {
      if (hasDraggedNotificationRef.current) {
        setNotificationPosition((prev) => {
          if (prev.x === null || prev.y === null) return prev;
          const next = clampNotificationPosition(prev.x, prev.y);
          return next.x === prev.x && next.y === prev.y ? prev : next;
        });
        return;
      }

      placeNotificationNearHeader();
    };

    syncNotificationPosition();
    window.addEventListener('resize', syncNotificationPosition);
    return () => window.removeEventListener('resize', syncNotificationPosition);
  }, [followUpAlerts.length, showFollowUpPanel, clampNotificationPosition, placeNotificationNearHeader]);

  useEffect(() => {
    if (!followUpAlerts.length || notifHighlightFiredRef.current) return;

    notifHighlightFiredRef.current = true;
    setNotifHighlight(true);

    const timer = setTimeout(() => {
      setNotifHighlight(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [followUpAlerts.length]);

  const dismissFollowUp = (alert) => {
    const dismissed = JSON.parse(sessionStorage.getItem('dismissedFollowUps') || '[]');
    const dismissKey = `${alert._id}-${alert.followUpDate || alert.nextFollowUp || ''}`;
    dismissed.push(dismissKey);
    sessionStorage.setItem('dismissedFollowUps', JSON.stringify(dismissed));
    const updated = followUpAlerts.filter(a => a._id !== alert._id);
    setFollowUpAlerts(updated);
    if (updated.length === 0) setShowFollowUpPanel(false);
  };

  const markFollowUpComplete = async (alert) => {
    try {
      if (alert._alertType === 'meta') {
        await api.put(`/meta-leads/${alert._id}/follow-up`, { followUpCompleted: true });
      } else {
        await api.put(`/leads/${alert._id}/follow-up`, { followUpCompleted: true });
      }
      const updated = followUpAlerts.filter(a => a._id !== alert._id);
      setFollowUpAlerts(updated);
      if (updated.length === 0) setShowFollowUpPanel(false);
      fetchAll();
    } catch (err) {
      console.error('Error marking follow-up as complete:', err);
      alert('Failed to mark follow-up as complete');
    }
  };

  // ── Normalise meta leads into a unified shape ─────────────────────────────
  // Each entry gets _type:'meta' so we know which API to call on update
  const allLeads = useMemo(() => {
    const regular = leads.map(l => ({ ...l, _type: 'regular', contactNumber: l.phone || l.contactNumber || '' }));
    const meta = metaLeads.map(m => ({
      ...m,
      _type: 'meta',
      // map meta fields → common display fields
      leadName: m.name || '',
      contactNumber: m.phone || '',
      company: m.businessCategory || '',
      product: m.websiteType || '',
      source: `Meta · ${m.pageName || 'Facebook'}`,
      createdAt: m.createdTime,
      assignedTo: m.assignedTo,
    }));
    return [...regular, ...meta];
  }, [leads, metaLeads]);

  // ── Sales employees only (for lead assignment dropdowns) ─────────────────
  const salesEmployees = useMemo(() =>
    employees.filter(emp => emp.role?.name?.toLowerCase().includes('sales')),
    [employees]);

  // ── Sales and Marketing employees (for filtering) ────────────────────────
  const filterEmployees = useMemo(() =>
    employees.filter(emp =>
      emp.role?.name?.toLowerCase().includes('sales') ||
      emp.role?.name?.toLowerCase().includes('marketing')
    ),
    [employees]);

  // ── Base dataset for stats: for regular employees only their own leads ──────────
  const statsLeads = useMemo(() => {
    if (!hasFullAccess && user?._id) {
      return allLeads.filter(l => (l.assignedTo?._id || l.assignedTo) === user._id);
    }
    return allLeads;
  }, [allLeads, hasFullAccess, user?._id]);

  // ── Stats from merged data ────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = statsLeads.length;
    const newLeads = statsLeads.filter(l => l.status === 'New').length;
    const contacted = statsLeads.filter(l => l.status === 'Contacted' || l.status === 'Connected').length;
    const converted = statsLeads.filter(l => l.status === 'Converted').length;
    const closed = statsLeads.filter(l => ['Closed', 'Not Interested'].includes(l.status)).length;
    // Count leads with pending follow-ups (have a follow-up date and not completed, or status is Follow-up)
    const followUp = statsLeads.filter(l => {
      const hasFollowUpDate = l.followUpDate || l.nextFollowUp;
      const isCompleted = l.followUpCompleted;
      const isActiveLead = !['Converted', 'Closed', 'Not Interested'].includes(l.status);
      return (hasFollowUpDate && !isCompleted && isActiveLead) || l.status === 'Follow-up';
    }).length;
    const notInterested = statsLeads.filter(l => l.status === 'Not Interested').length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLeads = statsLeads.filter(l => new Date(l.createdAt) >= today).length;
    const sources = [...new Set(statsLeads.map(l => l.source).filter(Boolean))];
    return { total, newLeads, contacted, converted, closed, followUp, notInterested, todayLeads, sources };
  }, [statsLeads]);

  // ── Previous-month stats for trend comparison ─────────────────────────────
  const prevMonthStats = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const prev = statsLeads.filter(l => { const d = new Date(l.createdAt); return d >= start && d <= end; });
    return {
      total: prev.length,
      newLeads: prev.filter(l => l.status === 'New').length,
      contacted: prev.filter(l => l.status === 'Contacted' || l.status === 'Connected').length,
      converted: prev.filter(l => l.status === 'Converted').length,
      closed: prev.filter(l => ['Closed', 'Not Interested'].includes(l.status)).length,
      followUp: prev.filter(l => l.status === 'Follow-up').length,
      notInterested: prev.filter(l => l.status === 'Not Interested').length,
      todayLeads: prev.length,
    };
  }, [statsLeads]);

  // ── Sparkline data: last 6 months per metric ──────────────────────────────
  const sparklineData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
    const countFor = (filterFn) =>
      months.map(({ year, month }) =>
        statsLeads.filter(l => {
          const d = new Date(l.createdAt);
          return d.getFullYear() === year && d.getMonth() === month && filterFn(l);
        }).length
      );
    return {
      total: countFor(() => true),
      newLeads: countFor(l => l.status === 'New'),
      contacted: countFor(l => l.status === 'Contacted' || l.status === 'Connected'),
      converted: countFor(l => l.status === 'Converted'),
      closed: countFor(l => ['Closed', 'Not Interested'].includes(l.status)),
      followUp: countFor(l => l.status === 'Follow-up'),
      notInterested: countFor(l => l.status === 'Not Interested'),
      todayLeads: countFor(() => true),
    };
  }, [statsLeads]);

  // ── Trend helpers ─────────────────────────────────────────────────────────
  const calcChange = (cur, prev) => {
    if (prev === 0) return cur > 0 ? '+100%' : '0%';
    const pct = ((cur - prev) / prev) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  };
  const isUp = (cur, prev) => cur >= prev;

  // ── Sparkline component ───────────────────────────────────────────────────
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

  // ── Filtered + sorted ─────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    return allLeads.filter(lead => {
      // Regular employees (non-Admin/HR/Manager): only show leads assigned to this user
      // Backend already filters, but this is an additional safety check
      if (!hasFullAccess && user?._id) {
        const assignedId = lead.assignedTo?._id || lead.assignedTo;
        if (assignedId !== user._id) return false;
      }

      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (lead.leadName?.toLowerCase().includes(term)) ||
        (lead.name?.toLowerCase().includes(term)) ||
        (lead.contactNumber?.includes(term)) ||
        (lead.phone?.includes(term)) ||
        (lead.email?.toLowerCase().includes(term)) ||
        (lead.company?.toLowerCase().includes(term)) ||
        (lead.product?.toLowerCase().includes(term));

      const hasPendingFollowUp = !!(lead.followUpDate || lead.nextFollowUp)
        && !lead.followUpCompleted
        && !['Converted', 'Closed', 'Not Interested', 'Lost'].includes(lead.status);

      const matchesStatus = !filterStatus || (
        filterStatus === 'Follow-up'
          ? hasPendingFollowUp || lead.status === 'Follow-up'
          : lead.status === filterStatus
      );

      const matchesSource = !filterSource || lead.source === filterSource;
      const matchesEmployee = !filterEmployee ||
        (Array.isArray(lead.assignedTo)
          ? lead.assignedTo.some(e => e._id === filterEmployee)
          : lead.assignedTo?._id === filterEmployee) ||
        (lead.createdBy?._id === filterEmployee || lead.createdBy === filterEmployee);

      let matchesDate = true;
      if (filterDate || filterEndDate) {
        const leadDate = new Date(lead.createdAt);
        leadDate.setHours(0, 0, 0, 0);
        let passesStart = true;
        let passesEnd = true;
        if (filterDate) {
          const [yf, mf, df] = filterDate.split('-').map(Number);
          const start = new Date(yf, mf - 1, df);
          if (leadDate < start) passesStart = false;
        }
        if (filterEndDate) {
          const [yf, mf, df] = filterEndDate.split('-').map(Number);
          const end = new Date(yf, mf - 1, df);
          if (leadDate > end) passesEnd = false;
        }
        matchesDate = passesStart && passesEnd;
      }
      return matchesSearch && matchesStatus && matchesSource && matchesEmployee && matchesDate;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      return 0;
    });
  }, [allLeads, searchTerm, filterStatus, filterSource, filterEmployee, filterDate, filterEndDate, sortBy, hasFullAccess, user?._id]);

  const isAnyModalOpen = showDetailsModal || showStatusModal || showNoteModal || showHistoryModal || showMetaModal || showConversionModal || showUploadModal || showMultiAssignModal;

  // ── Follow-up reminder polling for the currently visible page data ───────
  const checkFollowUps = useCallback(async () => {
    try {
      const dismissed = JSON.parse(sessionStorage.getItem('dismissedFollowUps') || '[]');
      const now = new Date();

      const visibleDueLeads = filteredLeads
        .filter((lead) => {
          const dueDate = lead.followUpDate || lead.nextFollowUp;
          const isDue = dueDate && new Date(dueDate) <= now;
          const isActiveLead = !lead.followUpCompleted && !['Converted', 'Closed', 'Not Interested', 'Lost'].includes(lead.status);
          return isDue && isActiveLead;
        })
        .map((lead) => ({
          ...lead,
          _alertType: lead._type === 'meta' ? 'meta' : 'lead',
          _displayName: lead.company || lead.leadName || lead.name || lead.phone || 'Lead'
        }));

      const all = visibleDueLeads.filter((l) => {
        const dismissKey = `${l._id}-${l.followUpDate || l.nextFollowUp || ''}`;
        return !dismissed.includes(l._id) && !dismissed.includes(dismissKey);
      });

      setFollowUpAlerts(all);
      setShowFollowUpPanel(prev => (all.length === 0 ? false : prev));
    } catch (err) {
      console.error('Follow-up check error:', err);
    }
  }, [filteredLeads]);

  useEffect(() => {
    checkFollowUps();
    const interval = setInterval(checkFollowUps, 60000);
    return () => clearInterval(interval);
  }, [checkFollowUps]);

  useEffect(() => {
    if (isAnyModalOpen) {
      setShowFollowUpPanel(false);
    }
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (!showDetailsModal && !showMetaModal && !showStatusModal) {
      setActiveFollowUpPicker(null);
      setOpenFollowUpDrop(null);
    }
  }, [showDetailsModal, showMetaModal, showStatusModal]);

  const handleFollowUpOverlayClick = () => {
    if (openFollowUpDrop) {
      setOpenFollowUpDrop(null);
      return;
    }
    setActiveFollowUpPicker(null);
  };

  // Close notification panel when clicking outside the widget
  useEffect(() => {
    if (!showFollowUpPanel) return;
    const handleOutsideClick = (e) => {
      if (followUpWidgetRef.current && !followUpWidgetRef.current.contains(e.target)) {
        setShowFollowUpPanel(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showFollowUpPanel]);

  // ── Pagination calculations ──────────────────────────────────────────────
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE);
  const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + LEADS_PER_PAGE);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterSource, filterEmployee, filterDate, filterEndDate, sortBy]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getStatusClass = (status) => ({
    'New': 'status-new', 'Contacted': 'status-contacted', 'Qualified': 'status-qualified',
    'Interested': 'status-interested', 'Follow-up': 'status-follow-up',
    'Converted': 'status-converted', 'Not Interested': 'status-not-interested', 'Closed': 'status-closed',
  }[status] || 'status-new');

  const getAssigneeName = (lead) => {
    if (!lead.assignedTo) return 'Unassigned';
    if (Array.isArray(lead.assignedTo))
      return lead.assignedTo.map(e => `${e.firstName} ${e.lastName}`).join(', ') || 'Unassigned';
    if (typeof lead.assignedTo === 'object')
      return `${lead.assignedTo.firstName || ''} ${lead.assignedTo.lastName || ''}`.trim() || 'Unassigned';
    return 'Unassigned';
  };

  const getEffectiveStatus = (lead) => {
    const hasPendingFollowUp = !!(lead?.followUpDate || lead?.nextFollowUp)
      && !lead?.followUpCompleted
      && !['Converted', 'Closed', 'Not Interested', 'Lost', 'Client'].includes(lead?.status);
    return hasPendingFollowUp ? 'Follow-up' : (lead?.status || 'New');
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }) : '—';

  const renderFollowUpBadges = (value) => {
    if (!value) return null;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const targetDay = new Date(parsed);
    targetDay.setHours(0, 0, 0, 0);

    let metaLabel = 'Scheduled';
    let metaColors = { background: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };

    if (parsed < now) {
      metaLabel = 'Due now';
      metaColors = { background: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    } else if (targetDay.getTime() === today.getTime()) {
      metaLabel = 'Today';
      metaColors = { background: '#ecfdf5', color: '#15803d', border: '#bbf7d0' };
    } else if (targetDay.getTime() === tomorrow.getTime()) {
      metaLabel = 'Tomorrow';
      metaColors = { background: '#f5f3ff', color: '#6d28d9', border: '#ddd6fe' };
    }

    const chipStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '6px 10px',
      borderRadius: '999px',
      border: '1px solid #dbe7f3',
      background: '#f8fbff',
      color: '#0f172a',
      fontSize: '11px',
      fontWeight: 700,
      lineHeight: 1,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04)'
    };

    return (
      <>
        <span style={{ ...chipStyle, background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)', border: '1px solid #bbf7d0', color: '#166534' }}>
          Follow-up
        </span>
        <span style={chipStyle}>{parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <span style={chipStyle}>{parsed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</span>
        <span style={{ ...chipStyle, background: metaColors.background, color: metaColors.color, border: `1px solid ${metaColors.border}` }}>
          {metaLabel}
        </span>
      </>
    );
  };

  const toDateTimeLocal = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
  };

  const toIsoStringOrNull = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };

  const getScheduleParts = (value) => {
    if (!value || !value.includes('T')) {
      return { datePart: '', timePart: '09:00', meridiem: 'AM' };
    }

    const [datePart, timeRaw = '09:00'] = value.split('T');
    const [hourRaw = '09', minuteRaw = '00'] = timeRaw.split(':');
    const hour24 = Number.parseInt(hourRaw, 10);

    if (Number.isNaN(hour24)) {
      return { datePart, timePart: '09:00', meridiem: 'AM' };
    }

    const meridiem = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;

    return {
      datePart,
      timePart: `${String(hour12).padStart(2, '0')}:${minuteRaw}`,
      meridiem,
    };
  };

  const buildFollowUpValue = (datePart, timePart = '09:00', meridiem = 'AM') => {
    if (!datePart) return '';

    let [hour = '09', minute = '00'] = String(timePart).split(':');
    let hourNum = Number.parseInt(hour, 10);

    if (Number.isNaN(hourNum)) hourNum = 9;
    if (meridiem === 'AM' && hourNum === 12) hourNum = 0;
    if (meridiem === 'PM' && hourNum !== 12) hourNum += 12;

    return `${datePart}T${String(hourNum).padStart(2, '0')}:${minute}`;
  };

  const renderFollowUpScheduleCard = (value, onChange, onDone, onSave = null) => {
    const { datePart, timePart, meridiem } = getScheduleParts(value);
    const dateLabel = datePart
      ? new Date(`${datePart}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'Select Date';
    const triggerStyle = {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '6px',
      padding: '8px 10px',
      border: '1px solid #d7e2ee',
      borderRadius: '10px',
      fontSize: '12px',
      color: '#334155',
      background: '#fff',
      cursor: 'pointer',
      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
      fontWeight: 500,
      transition: 'all 0.15s'
    };
    const dropdownStyle = {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      left: 0,
      zIndex: 1000,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '14px',
      boxShadow: '0 8px 32px rgba(15,23,42,0.13)',
      padding: '10px'
    };

    return (
      <div style={{
        width: 'min(360px, 82vw)',
        borderRadius: '18px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.18)',
        overflow: 'visible',
        fontFamily: "'Inter','Poppins','Segoe UI',sans-serif"
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          background: 'linear-gradient(135deg, #f8fbff 0%, #eef7f1 100%)',
          borderBottom: '1px solid #edf2f7'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #e8f3eb 0%, #dff6e8 100%)',
              color: '#3b775e',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 0 1px rgba(59,119,94,0.10)'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Set Follow-up</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>Pick date and time</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onDone}
            style={{
              border: 'none',
              background: '#ffffff',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '16px',
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              boxShadow: '0 1px 2px rgba(15,23,42,0.06)'
            }}
          >×</button>
        </div>

        <div style={{ padding: '14px', overflow: 'visible' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', overflow: 'visible' }}>
            <div style={{ position: 'relative' }}>
              <label className="is-mlead-field-lbl" style={{ marginBottom: '5px', display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Date</label>
              <button type="button" onClick={() => setOpenFollowUpDrop(v => v === 'date' ? null : 'date')} style={triggerStyle}>
                <span>{dateLabel}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {openFollowUpDrop === 'date' && (
                <div style={{ ...dropdownStyle, minWidth: '220px' }}>
                  <input
                    type="date"
                    value={datePart}
                    onChange={e => {
                      onChange(buildFollowUpValue(e.target.value, timePart, meridiem));
                      setOpenFollowUpDrop(null);
                    }}
                    className="is-form-select"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 86px', gap: '8px', overflow: 'visible' }}>
              <div style={{ position: 'relative' }}>
                <label className="is-mlead-field-lbl" style={{ marginBottom: '5px', display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>Time</label>
                <button type="button" onClick={() => setOpenFollowUpDrop(v => v === 'time' ? null : 'time')} style={triggerStyle}>
                  <span>{timePart}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {openFollowUpDrop === 'time' && (
                  <div style={{ ...dropdownStyle, minWidth: '120px', maxHeight: '180px', overflowY: 'auto' }}>
                    {FOLLOW_UP_TIME_OPTIONS.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          onChange(buildFollowUpValue(datePart, option, meridiem));
                          setOpenFollowUpDrop(null);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: timePart === option ? '#f0fdf4' : 'transparent',
                          color: timePart === option ? '#15803d' : '#475569',
                          fontSize: '12px',
                          fontWeight: timePart === option ? 600 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                <label className="is-mlead-field-lbl" style={{ marginBottom: '5px', display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b' }}>AM/PM</label>
                <button type="button" onClick={() => setOpenFollowUpDrop(v => v === 'meridiem' ? null : 'meridiem')} style={triggerStyle}>
                  <span>{meridiem}</span>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
                {openFollowUpDrop === 'meridiem' && (
                  <div style={{ ...dropdownStyle, minWidth: '86px' }}>
                    {['AM', 'PM'].map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          onChange(buildFollowUpValue(datePart, timePart, option));
                          setOpenFollowUpDrop(null);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: meridiem === option ? '#f0fdf4' : 'transparent',
                          color: meridiem === option ? '#15803d' : '#475569',
                          fontSize: '12px',
                          fontWeight: meridiem === option ? 600 : 400,
                          cursor: 'pointer'
                        }}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
            <button
              type="button"
              className="ist-btn-ghost leads-multi-assign-btn"
              style={{ padding: '7px 14px', fontSize: '11px', borderRadius: '10px' }}
              onClick={onDone}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
            </button>
            <button
              type="button"
              className="is-btn is-btn-primary"
              style={{
                padding: '7px 14px',
                fontSize: '11px',
                borderRadius: '10px',
                border: 'none',
                color: '#fff',
                background: 'linear-gradient(135deg, #1f5c43 0%, #2f7a57 100%)',
                boxShadow: '0 10px 22px rgba(31,92,67,0.24)'
              }}
              onClick={onSave || onDone}
            >
              {onSave ? 'Save' : 'Done'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const clearFilters = () => {
    setSearchTerm(''); setFilterStatus(''); setFilterSource('');
    setFilterDate(''); setFilterEndDate(''); setFilterEmployee(''); setSortBy('newest');
    setCurrentPage(1);
  };

  // ── Regular-lead actions ──────────────────────────────────────────────────
  const handleStatusSave = async () => {
    if (!selectedLead) return;

    const isMetaLead = selectedLead._type === 'meta';

    if (selectedLead.status === 'Converted') {
      alert('Cannot change status of a converted lead!');
      return;
    }

    if (newStatus === 'Follow-up' && !statusFollowUpAt) {
      alert('Please select a follow-up date and time.');
      return;
    }

    if (newStatus === 'Converted') {
      setPendingConversion({ type: isMetaLead ? 'meta' : 'regular', leadId: selectedLead._id, status: newStatus });
      setShowConversionModal(true);
      return;
    }

    setUpdating(true);
    try {
      if (isMetaLead) {
        await api.patch(`/meta-leads/${selectedLead._id}`, {
          status: newStatus,
          followUpDate: newStatus === 'Follow-up' ? toIsoStringOrNull(statusFollowUpAt) : null,
        });
      } else {
        const payload = {
          status: newStatus,
          nextFollowUp: newStatus === 'Follow-up' ? toIsoStringOrNull(statusFollowUpAt) : null,
        };

        const res = await api.put(`/leads/${selectedLead._id}`, payload);
        setLeads(leads.map(l => l._id === selectedLead._id ? res.data : l));
      }

      setShowStatusModal(false);
      setActiveFollowUpPicker(null);
      setStatusFollowUpAt('');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally { setUpdating(false); }
  };

  const confirmConversion = async () => {
    if (!pendingConversion) return;
    setUpdating(true);
    try {
      if (pendingConversion.type === 'regular') {
        const res = await api.put(`/leads/${pendingConversion.leadId}`, { status: pendingConversion.status });
        setLeads(leads.map(l => l._id === pendingConversion.leadId ? res.data : l));
        setShowStatusModal(false);
        // Refresh to pick up auto-created deal and updated stats
        fetchAll();
      } else if (pendingConversion.type === 'meta') {
        await api.patch(`/meta-leads/${pendingConversion.leadId}`, { status: pendingConversion.status });
        setTimeout(() => {
          fetchAll();
        }, 500);
      } else if (pendingConversion.type === 'metaEdit') {
        await api.patch(`/meta-leads/${pendingConversion.leadId}`, pendingConversion.data);
        alert('Lead converted successfully!');
        setShowMetaModal(false);
        fetchAll();
      }
      setShowConversionModal(false);
      setPendingConversion(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally { setUpdating(false); setMetaSaving(false); }
  };

  const cancelConversion = () => {
    setShowConversionModal(false);
    setPendingConversion(null);
  };

  const handleNoteSave = async () => {
    if (!selectedLead || !newNote.trim()) return;
    setUpdating(true);
    try {
      const res = await api.put(`/leads/${selectedLead._id}`, { newNote });
      setLeads(leads.map(l => l._id === selectedLead._id ? res.data : l));
      setShowNoteModal(false); setNewNote('');
    } catch (err) {
      alert('Failed to add note');
    } finally { setUpdating(false); }
  };

  const openRegularLead = (lead, editMode = false) => {
    setActiveFollowUpPicker(null);
    setSelectedLead(lead);
    setLeadEditForm({
      assignedTo: lead.assignedTo?._id || lead.assignedTo || '',
      status: getEffectiveStatus(lead),
      notes: lead.notes || '',
      followUpDate: toDateTimeLocal(lead.nextFollowUp),
      // Full editable fields
      name: lead.name || lead.leadName || '',
      email: lead.email || '',
      phone: lead.phone || lead.contactNumber || '',
      company: lead.company || '',
      country: lead.country || '',
      industry: lead.industry || '',
      requirement: lead.requirement || lead.requirements || lead.product || '',
      source: lead.source || '',
      budget: lead.budget || '',
      leadType: lead.leadType || '',
    });
    setIsEditing(editMode);
    setShowDetailsModal(true);
  };

  const fetchAndShowEmployeeSummary = async (empId) => {
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

  const openAddLeadModal = () => {
    setAddLeadForm({
      name: '',
      email: '',
      phone: '',
      company: '',
      country: '',
      industry: '',
      source: 'Manual',
      budget: '',
      requirement: '',
      notes: '',
      leadType: '',
      assignedTo: ''
    });
    setShowAddLeadModal(true);
  };

  const handleAddLeadSubmit = async (e) => {
    e.preventDefault();
    if (!addLeadForm.name.trim() || !addLeadForm.email.trim() || !addLeadForm.phone.trim() || !addLeadForm.source.trim()) {
      alert('Please fill out all required fields: Name, Email, Phone, and Source.');
      return;
    }

    setAddLeadSaving(true);
    try {
      await api.post('/leads', {
        name: addLeadForm.name.trim(),
        email: addLeadForm.email.toLowerCase().trim(),
        phone: addLeadForm.phone.trim(),
        company: addLeadForm.company ? addLeadForm.company.trim() : '',
        country: addLeadForm.country ? addLeadForm.country.trim() : '',
        industry: addLeadForm.industry ? addLeadForm.industry.trim() : '',
        source: addLeadForm.source.trim(),
        budget: addLeadForm.budget ? Number(addLeadForm.budget) : undefined,
        requirements: addLeadForm.requirement ? addLeadForm.requirement.trim() : '',
        notes: addLeadForm.notes ? addLeadForm.notes.trim() : '',
        leadType: addLeadForm.leadType || undefined,
        assignedTo: addLeadForm.assignedTo || undefined
      });
      setShowAddLeadModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add lead');
    } finally {
      setAddLeadSaving(false);
    }
  };

  const handleRegularLeadSave = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;

    if (leadEditForm.status === 'Follow-up' && !leadEditForm.followUpDate) {
      alert('Please select a follow-up date and time.');
      return;
    }

    const resolvedStatus = leadEditForm.followUpDate
      && !['Converted', 'Closed', 'Not Interested', 'Lost', 'Client'].includes(leadEditForm.status)
      ? 'Follow-up'
      : leadEditForm.status;

    if (selectedLead.status === 'Converted' && resolvedStatus !== 'Converted') {
      alert('Cannot change status of a converted lead!');
      return;
    }

    if (resolvedStatus === 'Converted' && selectedLead.status !== 'Converted') {
      setPendingConversion({
        type: 'regularEdit',
        leadId: selectedLead._id,
        data: {
          status: resolvedStatus,
          assignedTo: leadEditForm.assignedTo || null,
          notes: leadEditForm.notes,
          nextFollowUp: toIsoStringOrNull(leadEditForm.followUpDate),
        }
      });
      setShowConversionModal(true);
      return;
    }

    setLeadSaving(true);
    try {
      await api.put(`/leads/${selectedLead._id}`, {
        status: resolvedStatus,
        assignedTo: leadEditForm.assignedTo || null,
        notes: leadEditForm.notes,
        nextFollowUp: toIsoStringOrNull(leadEditForm.followUpDate),
        // Full editable fields
        name: leadEditForm.name,
        email: leadEditForm.email,
        phone: leadEditForm.phone,
        company: leadEditForm.company,
        country: leadEditForm.country,
        industry: leadEditForm.industry,
        requirement: leadEditForm.requirement,
        requirements: leadEditForm.requirement,
        source: leadEditForm.source,
        budget: leadEditForm.budget ? Number(leadEditForm.budget) : undefined,
        leadType: leadEditForm.leadType || null,
      });
      setShowDetailsModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally { setLeadSaving(false); }
  };

  const openMetaLead = (lead, editMode = false) => {
    setActiveFollowUpPicker(null);
    setMetaSelected(lead);
    setMetaEditForm({
      assignedTo: lead.assignedTo?._id || lead.assignedTo || '',
      status: getEffectiveStatus(lead),
      notes: lead.notes || '',
      followUpDate: toDateTimeLocal(lead.followUpDate),
    });
    setIsEditing(editMode);
    setShowMetaModal(true);
  };

  // ── Meta-lead actions ─────────────────────────────────────────────────────
  const handleMetaSync = async () => {
    if (!window.confirm('Sync new leads from Meta?')) return;
    setSyncing(true);
    try {
      const res = await api.post('/meta-leads/sync');
      await fetchAll();
      alert(`Sync complete! ${res.data.totalNewLeads} new leads imported.`);
    } catch (err) {
      alert(err.response?.data?.message || 'Sync failed');
    } finally { setSyncing(false); }
  };



  const handleMetaSave = async (e) => {
    e.preventDefault();
    if (!metaSelected) return;

    if (metaEditForm.status === 'Follow-up' && !metaEditForm.followUpDate) {
      alert('Please select a follow-up date and time.');
      return;
    }

    const resolvedStatus = metaEditForm.followUpDate
      && !['Converted', 'Closed', 'Not Interested', 'Lost', 'Client'].includes(metaEditForm.status)
      ? 'Follow-up'
      : metaEditForm.status;

    // Check if trying to change from Converted status
    if (metaSelected.status === 'Converted' && resolvedStatus !== 'Converted') {
      alert('Cannot change status of a converted lead!');
      return;
    }

    // If changing to Converted, show confirmation
    if (resolvedStatus === 'Converted' && metaSelected.status !== 'Converted') {
      setPendingConversion({
        type: 'metaEdit',
        leadId: metaSelected._id,
        data: {
          status: resolvedStatus,
          assignedTo: metaEditForm.assignedTo || null,
          notes: metaEditForm.notes,
          followUpDate: toIsoStringOrNull(metaEditForm.followUpDate),
        }
      });
      setShowConversionModal(true);
      return;
    }

    setMetaSaving(true);
    try {
      await api.patch(`/meta-leads/${metaSelected._id}`, {
        status: resolvedStatus,
        assignedTo: metaEditForm.assignedTo || null,
        notes: metaEditForm.notes,
        followUpDate: toIsoStringOrNull(metaEditForm.followUpDate),
      });
      alert('Lead updated successfully!');
      setShowMetaModal(false);
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally { setMetaSaving(false); }
  };

  const handleExcelQuickAssign = async (leadId, employeeId) => {
    const empId = employeeId || null;
    // Optimistic update for instant UI feedback
    setLeads(prev => prev.map(l => l._id === leadId
      ? { ...l, assignedTo: empId ? (employees.find(e => e._id === empId) || empId) : null }
      : l
    ));
    try {
      const res = await api.put(`/leads/${leadId}`, { assignedTo: empId });
      // Sync with server response to ensure assignedTo is the populated object
      if (res.data) {
        setLeads(prev => prev.map(l => l._id === leadId ? { ...l, ...res.data, _type: 'regular' } : l));
      }
    } catch (err) {
      // Revert on failure
      setLeads(prev => prev.map(l => l._id === leadId ? { ...l, assignedTo: l.assignedTo } : l));
      console.error('Assign failed:', err);
      alert(err.response?.data?.message || 'Assign failed');
    }
  };

  const handleExcelQuickStatus = async (leadId, status, currentStatus) => {
    if (currentStatus === 'Converted') {
      alert('Cannot change status of a converted lead!');
      return;
    }
    if (status === 'Follow-up') {
      const lead = leads.find(l => l._id === leadId);
      if (lead) {
        setSelectedLead({ ...lead, _type: 'regular' });
        setNewStatus('Follow-up');
        setStatusFollowUpAt(toDateTimeLocal(lead.nextFollowUp));
        setShowStatusModal(false);
        setActiveFollowUpPicker('status');
      }
      return;
    }
    if (status === 'Converted') {
      setPendingConversion({ type: 'regular', leadId, status });
      setShowConversionModal(true);
      return;
    }
    const prev = leads.find(l => l._id === leadId)?.status;
    setLeads(ls => ls.map(l => l._id === leadId ? { ...l, status, nextFollowUp: null } : l));
    try {
      await api.put(`/leads/${leadId}`, { status, nextFollowUp: null });
    } catch (err) {
      setLeads(ls => ls.map(l => l._id === leadId ? { ...l, status: prev } : l));
      console.error('Status update failed:', err);
      alert(err.response?.data?.message || 'Status update failed');
    }
  };

  // Quick-update leadType inline from table badge (optimistic)
  const handleQuickLeadType = async (leadId, leadType) => {
    const prev = leads.find(l => l._id === leadId)?.leadType;
    setLeads(ls => ls.map(l => l._id === leadId ? { ...l, leadType } : l));
    try {
      await api.put(`/leads/${leadId}`, { leadType });
    } catch (err) {
      setLeads(ls => ls.map(l => l._id === leadId ? { ...l, leadType: prev } : l));
      console.error('Lead type update failed:', err);
      alert(err.response?.data?.message || 'Lead type update failed');
    }
  };

  const handleMetaQuickAssign = async (leadId, employeeId, currentStatus) => {
    // Check if lead is converted
    if (currentStatus === 'Converted') {
      alert('Cannot change assigned employee for a converted lead!');
      return;
    }

    const empId = employeeId || null;
    // Optimistic update
    setMetaLeads(prev => prev.map(l => l._id === leadId ? { ...l, assignedTo: empId ? employees.find(e => e._id === empId) || empId : null } : l));
    try {
      await api.patch(`/meta-leads/${leadId}`, { assignedTo: empId });
    } catch (err) {
      // Revert on failure
      setMetaLeads(prev => prev.map(l => l._id === leadId ? { ...l, assignedTo: l.assignedTo } : l));
      console.error('Assign failed:', err);
      alert(err.response?.data?.message || 'Assign failed');
    }
  };

  const handleMetaQuickStatus = async (leadId, status, currentStatus) => {
    if (currentStatus === 'Converted') {
      alert('Cannot change status of a converted lead!');
      return;
    }
    if (status === 'Follow-up') {
      const lead = metaLeads.find(l => l._id === leadId);
      if (lead) {
        setSelectedLead({ ...lead, _type: 'meta' });
        setNewStatus('Follow-up');
        setStatusFollowUpAt(toDateTimeLocal(lead.followUpDate));
        setShowStatusModal(false);
        setActiveFollowUpPicker('status');
      }
      return;
    }
    if (status === 'Converted') {
      setPendingConversion({ type: 'meta', leadId, status });
      setShowConversionModal(true);
      return;
    }
    const prev = metaLeads.find(l => l._id === leadId)?.status;
    setMetaLeads(ls => ls.map(l => l._id === leadId ? { ...l, status, followUpDate: null } : l));
    try {
      await api.patch(`/meta-leads/${leadId}`, { status, followUpDate: null });
    } catch (err) {
      setMetaLeads(ls => ls.map(l => l._id === leadId ? { ...l, status: prev } : l));
      console.error('Status update failed:', err);
      alert(err.response?.data?.message || 'Status update failed');
    }
  };

  // ── Delete lead (admin only) ────────────────────────────────────────────────
  const handleDeleteLead = async (lead) => {
    const name = lead.leadName || lead.name || lead.company || 'this lead';
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      if (lead._type === 'meta') {
        await api.delete(`/meta-leads/${lead._id}`);
        setMetaLeads(prev => prev.filter(l => l._id !== lead._id));
      } else {
        await api.delete(`/leads/${lead._id}`);
        setLeads(prev => prev.filter(l => l._id !== lead._id));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  // ── Multi Assign handler ──────────────────────────────────────────────────
  const handleMultiAssign = async () => {
    if (!multiAssignEmployee) { alert('Please select an employee to assign.'); return; }
    if (selectedLeadIds.size === 0) { alert('No leads selected.'); return; }
    setMultiAssigning(true);
    const selectedArr = Array.from(selectedLeadIds);
    const failures = [];
    await Promise.all(
      selectedArr.map(async (compositeId) => {
        // compositeId = "regular-<id>" or "meta-<id>"
        const [type, id] = compositeId.split(/-(.+)/);
        try {
          if (type === 'meta') {
            await api.patch(`/meta-leads/${id}`, { assignedTo: multiAssignEmployee });
          } else {
            await api.put(`/leads/${id}`, { assignedTo: multiAssignEmployee });
          }
        } catch {
          failures.push(compositeId);
        }
      })
    );
    // Update local state
    const emp = employees.find(e => e._id === multiAssignEmployee);
    setLeads(prev => prev.map(l =>
      selectedLeadIds.has(`regular-${l._id}`) ? { ...l, assignedTo: emp || multiAssignEmployee } : l
    ));
    setMetaLeads(prev => prev.map(l =>
      selectedLeadIds.has(`meta-${l._id}`) ? { ...l, assignedTo: emp || multiAssignEmployee } : l
    ));
    setMultiAssigning(false);
    setShowMultiAssignModal(false);
    setSelectedLeadIds(new Set());
    setMultiAssignMode(false);
    setMultiAssignEmployee('');
    setMultiAssignSearch('');
    if (failures.length > 0) {
      alert(`${selectedArr.length - failures.length} leads assigned. ${failures.length} failed.`);
    }
  };

  // ── Excel Upload handlers ─────────────────────────────────────────────────

  // Canonical field names used in the import template and normaliser
  const IMPORT_FIELDS = [
    { key: 'name', label: 'Client Name', aliases: ['name', 'client', 'client_name', 'clientname', 'lead_name', 'leadname', 'contact_person', 'person', 'full_name', 'customer'] },
    { key: 'company', label: 'Company', aliases: ['company', 'company_name', 'companyname', 'organisation', 'organization', 'firm', 'business'] },
    { key: 'phone', label: 'Phone', aliases: ['phone', 'mobile', 'contact', 'phone_number', 'contact_number', 'phone_no', 'mobileno', 'phoneno', 'number', 'mob'] },
    { key: 'email', label: 'Email', aliases: ['email', 'email_address', 'email_id', 'emailid', 'mail'] },
    { key: 'country', label: 'Country', aliases: ['country', 'nation', 'location'] },
    { key: 'industry', label: 'Industry', aliases: ['industry', 'sector', 'vertical', 'domain'] },
    { key: 'requirements', label: 'Requirement', aliases: ['requirement', 'requirements', 'product', 'service', 'req', 'need', 'needs', 'description'] },
    { key: 'source', label: 'Source', aliases: ['source', 'lead_source', 'leadsource'] },
    { key: 'budget', label: 'Budget', aliases: ['budget', 'amount', 'value'] },
    { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'remarks', 'comment', 'comments'] },
    { key: 'date', label: 'Date', aliases: ['date', 'lead_date', 'enquiry_date', 'created_date', 'entry_date'] },
    { key: 'leadType', label: 'Lead Type', aliases: ['leadtype', 'lead_type', 'type', 'priority'] },
  ];

  const handleDownloadTemplate = () => {
    const headers = IMPORT_FIELDS.map(f => f.label);
    const example = [
      'John Smith', 'Acme Corp', '9876543210', 'john@acme.com',
      'India', 'IT', 'ERP Software', 'Excel Import',
      '50000', 'Interested in demo', '06/06/2026', 'Hot'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads Template');
    XLSX.writeFile(wb, 'leads_import_template.xlsx');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!json.length) { setUploadError('No data found in the file.'); return; }

        const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        const normalise = (row) => {
          // Clean all keys: lowercase, non-alphanumeric → _
          const r = {};
          Object.keys(row).forEach(k => {
            const clean = k.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            r[clean] = row[k];
          });

          const get = (...keys) => {
            for (const k of keys) {
              const v = r[k];
              if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
            }
            // Partial match fallback
            for (const k of keys) {
              for (const rKey of Object.keys(r)) {
                if (rKey.includes(k) || k.includes(rKey)) {
                  const v = r[rKey];
                  if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
                }
              }
            }
            return '';
          };

          const result = {};
          IMPORT_FIELDS.forEach(f => {
            result[f.key] = get(...f.aliases);
          });

          // Defaults
          result.source = result.source || 'Excel Import';
          result.date = result.date || today;
          result.name = result.name || '—';

          return result;
        };

        setUploadRows(json.map(normalise));
        setShowUploadModal(true);
      } catch (err) {
        setUploadError('Failed to parse file. Please use a valid .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleUploadSubmit = async () => {
    if (!uploadRows.length) return;
    setUploading(true);
    try {
      const res = await api.post('/leads/bulk-import', { leads: uploadRows });
      alert(`Import complete! ${res.data.imported} leads imported.${res.data.errors?.length ? ` ${res.data.errors.length} rows had errors.` : ''}`);
      setShowUploadModal(false);
      setUploadRows([]);
      fetchAll();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Export all filtered leads to Excel ────────────────────────────────────
  const handleExportExcel = () => {
    const headers = [
      '#', 'Client Name', 'Company', 'Phone', 'Email',
      'Requirement', 'Country', 'Industry', 'Source',
      'Assigned To', 'Status', 'Lead Type', 'Budget', 'Notes', 'Date', 'Added On', 'Added By'
    ];

    const asText = (val) => val ? `="${val}"` : '';

    const rows = filteredLeads.map((lead, idx) => [
      idx + 1,
      lead.leadName || lead.name || '',
      lead.company || '',
      asText(lead.contactNumber && lead.contactNumber !== 'N/A' ? lead.contactNumber : lead.phone && lead.phone !== 'N/A' ? lead.phone : ''),
      lead.email || '',
      lead.requirement || lead.requirements || lead.product || lead.description?.slice(0, 100) || '',
      lead.country || '',
      lead.industry || '',
      lead._type === 'meta'
        ? `Meta · ${lead.pageName || 'Facebook / Instagram'}`
        : (lead.source || 'Manual'),
      getAssigneeName(lead),
      lead.status || 'New',
      lead.leadType || '',
      lead.budget || '',
      lead.notes || '',
      fmtDate(lead.createdAt),
      fmtDate(lead.addedOn),
      lead.createdBy ? `${lead.createdBy.firstName || ''} ${lead.createdBy.lastName || ''}`.trim() || lead.createdBy.email : '—',
    ]);

    const escape = (val) => {
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const csvContent = [headers, ...rows].map(row => row.map(escape).join(',')).join('\n');
    // UTF-8 BOM ensures Excel opens the file correctly
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── SVG Icons ─────────────────────────────────────────────────────────────
  const IconBarChart = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" /></svg>);
  const IconPlus = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>);
  const IconPhone = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.4 2 2 0 0 1 3.57 1.21h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.75a16 16 0 0 0 5.34 5.34l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z" /></svg>);
  const IconCheckCircle = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>);
  const IconXCircle = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>);
  const IconCalendar = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
  const IconSearch = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>);
  const IconRefresh = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>);
  const IconEye = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
  const IconEdit = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>);
  const IconPencil = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>);
  const IconClock = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>);
  const IconInbox = () => (<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>);
  const IconTrash = () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>);

  if (loading) return (
    <div className="page-container" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", padding: '28px 24px' }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .skel { background: linear-gradient(90deg, #f1f5f9 25%, #e9eef5 50%, #f1f5f9 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: 6px; }
      `}</style>
      {/* Header skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div className="skel" style={{ width: '130px', height: '26px', marginBottom: '8px' }} />
          <div className="skel" style={{ width: '260px', height: '13px' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="skel" style={{ width: '110px', height: '34px', borderRadius: '10px' }} />
          <div className="skel" style={{ width: '110px', height: '34px', borderRadius: '10px' }} />
          <div className="skel" style={{ width: '80px', height: '34px', borderRadius: '10px' }} />
        </div>
      </div>
      {/* Stats cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '16px' }}>
            <div className="skel" style={{ width: '70px', height: '12px', marginBottom: '10px' }} />
            <div className="skel" style={{ width: '50px', height: '28px' }} />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
        {/* Filter bar skeleton */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div className="skel" style={{ width: '220px', height: '32px', borderRadius: '8px' }} />
          <div className="skel" style={{ width: '120px', height: '32px', borderRadius: '8px' }} />
          <div className="skel" style={{ width: '140px', height: '32px', borderRadius: '8px' }} />
          <div className="skel" style={{ width: '130px', height: '32px', borderRadius: '8px' }} />
        </div>
        {/* Table header skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr 1fr 1fr 80px 100px', gap: '0', padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
          {[30, 80, 90, 80, 100, 90, 70, 70, 60].map((w, i) => (
            <div key={i} className="skel" style={{ width: `${w}px`, height: '11px', borderRadius: '4px' }} />
          ))}
        </div>
        {/* Table rows skeleton */}
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 1fr 1fr 1fr 80px 100px', gap: '0', padding: '12px 12px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
            <div className="skel" style={{ width: '18px', height: '11px', borderRadius: '4px' }} />
            <div>
              <div className="skel" style={{ width: '90px', height: '12px', marginBottom: '5px' }} />
              <div className="skel" style={{ width: '60px', height: '10px' }} />
            </div>
            <div>
              <div className="skel" style={{ width: '85px', height: '12px', marginBottom: '5px' }} />
              <div className="skel" style={{ width: '110px', height: '10px' }} />
            </div>
            <div className="skel" style={{ width: '70px', height: '12px' }} />
            <div className="skel" style={{ width: '80px', height: '22px', borderRadius: '999px' }} />
            <div className="skel" style={{ width: '95px', height: '28px', borderRadius: '8px' }} />
            <div className="skel" style={{ width: '65px', height: '22px', borderRadius: '999px' }} />
            <div className="skel" style={{ width: '55px', height: '11px' }} />
            <div style={{ display: 'flex', gap: '4px' }}>
              <div className="skel" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
              <div className="skel" style={{ width: '28px', height: '28px', borderRadius: '8px' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-container" style={{ background: '#f8fafc', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <style>{`
        .ist-btn-primary { padding: 8px 18px; border: none; border-radius: 10px; background: linear-gradient(135deg,#3b775e 0%,#56a07a 100%); color: #fff; font-size: 12px; font-weight: 700; cursor: pointer; font-family: 'Inter',-apple-system,sans-serif; transition: all .2s; display: flex; align-items: center; gap: 6px; box-shadow: none; }
        .ist-btn-primary:hover { opacity: .92; transform: translateY(-1px); box-shadow: none; }
        .ist-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .ist-btn-ghost { padding: 9px 18px; border: 1.5px solid #e5e7eb; background: #fff; border-radius: 10px; font-size: 13px; font-weight: 600; color: #6b7280; cursor: pointer; font-family: 'Inter',-apple-system,sans-serif; transition: all .2s; }
        .ist-btn-ghost:hover { border-color: #3b775e; color: #3b775e; background: #f8fafb; }
        .ist-action-btn { width: 24px; height: 24px; border-radius: 6px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; }
        .ist-tbl { font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
        .ist-tbl thead tr { background: #fafafa; }
        .ist-tbl thead th { font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding: 7px 8px; text-align: left; white-space: nowrap; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
        .ist-tbl tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .15s; }
        .ist-tbl tbody tr:hover { background: #fafffe; }
        .ist-tbl tbody td { font-size: 11px; color: #475569; padding: 5px 8px; vertical-align: middle; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
        .ist-tbl tbody tr:last-child { border-bottom: none; }
        .ist-pagination-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #6b7280; font-size: 12px; font-weight: 600; cursor: pointer; transition: all .15s; font-family: 'Inter',-apple-system,sans-serif; }
        .ist-pagination-btn:hover:not(:disabled) { background: #f0fdf4; border-color: #a3e635; }
        .ist-pagination-btn.active { background: #a3e635; border-color: #a3e635; color: #fff; }
        .ist-pagination-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Upload button liquid fill animation */
        .leads-upload-btn, .leads-multi-assign-btn {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition: color 0.35s ease, border-color 0.35s ease;
        }

        .leads-upload-btn::before, .leads-multi-assign-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }

        .leads-upload-btn::after, .leads-multi-assign-btn::after {
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

        .leads-upload-btn:hover, .leads-multi-assign-btn:hover {
          color: #1f2937 !important;
          border-color: transparent !important;
        }

        .leads-upload-btn:hover::before, .leads-multi-assign-btn:hover::before {
          transform: translateX(0%);
        }

        .leads-upload-btn:hover::after, .leads-multi-assign-btn:hover::after {
          transform: translateX(255%) rotate(8deg);
        }

        @keyframes notificationShutterDrop {
          0% {
            opacity: 0;
            transform: perspective(700px) rotateX(-14deg) scaleY(0.12) translateY(-22px);
            transform-origin: top center;
            filter: blur(1px);
          }
          60% {
            opacity: 1;
            transform: perspective(700px) rotateX(4deg) scaleY(1.03) translateY(2px);
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: perspective(700px) rotateX(0deg) scaleY(1) translateY(0);
            transform-origin: top center;
          }
        }

        @keyframes notificationCardDrop {
          0% {
            opacity: 0;
            transform: translateY(-14px) scale(0.98);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
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
        
        .ist-stats-grid > div:nth-child(5)::before,
        .ist-stats-grid > div:nth-child(5)::after {
          background: #ef4444;
        }
        
        .ist-stats-grid > div:nth-child(6)::before,
        .ist-stats-grid > div:nth-child(6)::after {
          background: #eab308;
        }
        
        /* Stagger bubble animations for visual variety */
        .ist-stats-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
        .ist-stats-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
        .ist-stats-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
        .ist-stats-grid > div:nth-child(5)::before { animation-delay: 0.3s; }
        .ist-stats-grid > div:nth-child(6)::before { animation-delay: 1.0s; }
        
        .ist-stats-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
        .ist-stats-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
        .ist-stats-grid > div:nth-child(4)::after { animation-delay: 1.8s; }
        .ist-stats-grid > div:nth-child(5)::after { animation-delay: 0.7s; }
        .ist-stats-grid > div:nth-child(6)::after { animation-delay: 1.4s; }

        /* ── Notification badge moving gradient effect ── */
        .notif-badge-pill {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }

        .notif-badge-pill > * {
          position: relative;
          z-index: 2;
        }

        @keyframes notif-gradient-sweep {
          0% {
            transform: translateX(-140%);
            opacity: 0;
          }
          12% {
            opacity: 0.35;
          }
          45% {
            opacity: 0.9;
          }
          100% {
            transform: translateX(220%);
            opacity: 0;
          }
        }

        @keyframes notif-pill-glow {
          0% {
            box-shadow: none;
            border-color: rgba(132, 204, 22, 0.20);
          }
          50% {
            box-shadow: none;
            border-color: rgba(132, 204, 22, 0.55);
          }
          100% {
            box-shadow: none;
            border-color: rgba(132, 204, 22, 0.20);
          }
        }

        .notif-badge-attention {
          background: linear-gradient(90deg, #ffffff 0%, #f7fee7 45%, #ffffff 100%) !important;
          box-shadow: none !important;
          animation: notif-pill-glow 2s ease-in-out 1 !important;
        }

        .notif-badge-attention::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 45%;
          height: 100%;
          z-index: 1;
          pointer-events: none;
          background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(217,249,157,0.12) 20%, rgba(190,242,100,0.75) 50%, rgba(217,249,157,0.12) 80%, rgba(255,255,255,0) 100%);
          filter: blur(1px);
          transform: translateX(-140%);
          animation: notif-gradient-sweep 2s ease-in-out 1;
        }

        /* ── Mobile responsive ── */
        @media (max-width: 768px) {
          .ist-stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
          .ist-tbl thead th { font-size: 8px; padding: 6px 6px; }
          .ist-tbl tbody td { font-size: 10px; padding: 4px 6px; }
          .ist-btn-primary { padding: 7px 12px; font-size: 11px; }
          .ist-btn-ghost { padding: 7px 12px; font-size: 12px; }
          /* notification dropdown: pin to screen edge on mobile */
          .notif-dropdown {
            position: fixed !important;
            top: auto !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-height: 70vh;
            overflow-y: auto;
            border-radius: 20px 20px 0 0;
            padding: 12px 12px 20px;
            background: #fff;
            box-shadow: 0 -4px 24px rgba(15,23,42,0.14);
            gap: 10px;
          }
        }
        @media (max-width: 480px) {
          .ist-stats-grid { grid-template-columns: 1fr !important; gap: 6px !important; }
          .ist-stats-grid > div::before, .ist-stats-grid > div::after { display: none; }
          /* hide 'Notifications' text label on very small screens, show only icon + count */
          .notif-badge-label { display: none !important; }
          .notif-badge-pill { padding: 7px 10px !important; }
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#0f172a", margin: 0, letterSpacing: "-0.025em" }}>Leads Management</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>Manage and monitor all leads across the organisation</p>
        </div>
        <div ref={headerActionsRef} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {canRead && (
            <button
              ref={exportButtonRef}
              className="leads-upload-btn"
              onClick={handleExportExcel}
              title="Export all leads to Excel"
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
              <svg style={{ position: 'relative', zIndex: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ position: 'relative', zIndex: 1 }}>Export Excel</span>
            </button>
          )}
          {canCreate && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
              <button
                className="leads-upload-btn"
                onClick={() => { setUploadError(''); fileInputRef.current?.click(); }}
                title="Upload Excel to import leads"
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
                <svg style={{ position: 'relative', zIndex: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span style={{ position: 'relative', zIndex: 1 }}>Import Excel</span>
              </button>
            </>
          )}
          {hasFullAccess && (
            <button className="ist-btn-primary" onClick={handleMetaSync} disabled={syncing}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: syncing ? 'spin 0.8s linear infinite' : 'none' }}><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          )}
          {canCreate && (
            <button
              className="leads-upload-btn"
              onClick={openAddLeadModal}
              title="Add a new lead manually"
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
              <svg style={{ position: 'relative', zIndex: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span style={{ position: 'relative', zIndex: 1 }}>Add Lead</span>
            </button>
          )}

          {/* ── Notification Badge (inline, next to Export) ──────────────── */}
          {followUpAlerts.length > 0 && !isAnyModalOpen && (
            <div ref={followUpWidgetRef} style={{ position: 'relative' }}>
              <div
                className={`notif-badge-pill${notifHighlight ? ' notif-badge-attention' : ''}`}
                onClick={handleNotificationToggle}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '8px 12px',
                  background: 'rgba(255,255,255,0.96)',
                  border: '1px solid #e2e8f0',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: '16px', height: '16px', borderRadius: '999px', background: '#84cc16', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                </span>
                <span className="notif-badge-label" style={{ fontSize: '11px', fontWeight: 800, color: '#334155' }}>Notifications</span>
                <span style={{ minWidth: '18px', height: '18px', borderRadius: '999px', background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{followUpAlerts.length}</span>
                <span style={{ fontSize: '9px', color: '#64748b' }}>{showFollowUpPanel ? '▲' : '▼'}</span>
              </div>

              {showFollowUpPanel && (
                <div
                  className="notif-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 1200,
                    width: 'min(360px, calc(100vw - 20px))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transformOrigin: 'top right',
                    animation: 'notificationShutterDrop 0.42s cubic-bezier(0.22, 1, 0.36, 1)'
                  }}
                >
                  {followUpAlerts.map((alert, index) => {
                    const followUpValue = alert.followUpDate || alert.nextFollowUp;
                    const reminderText = (alert.followUpNotes || alert.notes || '').trim();
                    return (
                      <div
                        key={alert._id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: 'linear-gradient(135deg, #f7fce8 0%, #eef8d9 100%)',
                          border: '1.5px solid #a3d63b',
                          borderRadius: '18px',
                          padding: '10px 12px 10px 12px',
                          boxShadow: '0 8px 22px rgba(132,204,22,0.12), 0 3px 8px rgba(15,23,42,0.04)',
                          position: 'relative',
                          overflow: 'hidden',
                          animation: 'notificationCardDrop 0.34s ease both',
                          animationDelay: `${index * 70}ms`
                        }}
                      >
                        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top right, rgba(132,204,22,0.18), transparent 35%)', pointerEvents: 'none' }}></div>
                        <div style={{ position: 'relative', width: '28px', height: '28px', borderRadius: '999px', background: '#84cc16', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 6px 14px rgba(132,204,22,0.24)' }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                        </div>
                        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, color: '#1f2937', lineHeight: 1.25 }}>{alert._displayName}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '5px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: '999px', background: '#ffffff', border: '1px solid #d9f99d', color: '#3f6212', fontSize: '10px', fontWeight: 700, lineHeight: 1.2 }}>
                              {fmtDateTime(followUpValue)}
                            </span>
                          </div>
                          {reminderText && (
                            <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {reminderText}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (alert._alertType === 'meta') openMetaLead(alert);
                            else openRegularLead(alert);
                          }}
                          style={{
                            position: 'relative',
                            border: 'none',
                            borderRadius: '12px',
                            padding: '6px 10px',
                            background: 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(132,204,22,0.18)',
                            flexShrink: 0,
                            minWidth: '52px'
                          }}
                        >
                          View
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="ist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {[
          {
            label: 'Total Leads', value: stats.total, prev: prevMonthStats.total, color: '#667eea', spark: sparklineData.total,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          },
          {
            label: 'New', value: stats.newLeads, prev: prevMonthStats.newLeads, color: '#3b82f6', spark: sparklineData.newLeads,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
          },
          {
            label: 'Follow-up', value: stats.followUp, prev: prevMonthStats.followUp, color: '#f59e0b', spark: sparklineData.followUp,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
          },
          {
            label: 'Converted', value: stats.converted, prev: prevMonthStats.converted, color: '#10b981', spark: sparklineData.converted,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          },
          {
            label: 'Not Interested', value: stats.notInterested, prev: prevMonthStats.notInterested, color: '#ef4444', spark: sparklineData.notInterested,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
          },
        ].map(({ label, value, prev, color, spark, icon }) => {
          const trend = prev !== null ? calcChange(value, prev) : null;
          const up = prev !== null ? isUp(value, prev) : true;
          const isSelected = filterStatus === label || (filterStatus === '' && label === 'Total Leads');
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
                setFilterStatus(label === 'Total Leads' ? '' : label);
                setCurrentPage(1);
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
                    <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>added today</span>
                  </div>
                )}
                <Sparkline data={spark} color={color} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Card */}
      <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e5e7eb', overflow: 'visible', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Filter Bar */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: '#fafafa', borderRadius: '14px 14px 0 0', position: 'relative', zIndex: 10 }}>
          {/* Search */}
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
              placeholder="Search by name, phone, email, company..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#0f172a', background: 'transparent', width: '100%', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500 }}
            />
          </div>

          {/* Filters — card dropdowns */}
          <div ref={filterDropRef} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>

            {/* Status */}
            {(() => {
              const label = filterStatus || 'All Statuses';
              const isActive = !!filterStatus;
              return (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setOpenFilterDrop(p => p === 'status' ? null : 'status'); setFilterEmpSearch(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: `1px solid ${isActive ? '#3b775e' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px', color: isActive ? '#3b775e' : '#475569', background: isActive ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  >
                    {label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {openFilterDrop === 'status' && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '10px', minWidth: '200px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 4px' }}>Status</div>
                      <button
                        onClick={() => { setFilterStatus(''); setOpenFilterDrop(null); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: !filterStatus ? '#f0fdf4' : 'transparent', color: !filterStatus ? '#15803d' : '#475569', fontSize: '12px', fontWeight: !filterStatus ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                      >All Statuses</button>
                      {STATUS_OPTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => { setFilterStatus(s); setOpenFilterDrop(null); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: filterStatus === s ? '#f0fdf4' : 'transparent', color: filterStatus === s ? '#15803d' : '#475569', fontSize: '12px', fontWeight: filterStatus === s ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                        >{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Source */}
            {(() => {
              const label = filterSource || 'All Sources';
              const isActive = !!filterSource;
              return (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setOpenFilterDrop(p => p === 'source' ? null : 'source'); setFilterEmpSearch(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: `1px solid ${isActive ? '#3b775e' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px', color: isActive ? '#3b775e' : '#475569', background: isActive ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  >
                    {label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {openFilterDrop === 'source' && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '10px', minWidth: '200px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 4px' }}>Source</div>
                      <button
                        onClick={() => { setFilterSource(''); setOpenFilterDrop(null); }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: !filterSource ? '#f0fdf4' : 'transparent', color: !filterSource ? '#15803d' : '#475569', fontSize: '12px', fontWeight: !filterSource ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                      >All Sources</button>
                      {stats.sources.map(s => (
                        <button
                          key={s}
                          onClick={() => { setFilterSource(s); setOpenFilterDrop(null); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: filterSource === s ? '#f0fdf4' : 'transparent', color: filterSource === s ? '#15803d' : '#475569', fontSize: '12px', fontWeight: filterSource === s ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                        >{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Employees — multi-column grid card (hidden for regular employees) */}
            {hasFullAccess && (() => {
              const selectedEmp = filterEmployees.find(e => e._id === filterEmployee);
              const label = selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : 'All Employees';
              const isActive = !!filterEmployee;
              const filteredEmps = filterEmployees.filter(e => {
                const name = `${e.firstName} ${e.lastName}`.toLowerCase();
                return name.includes(filterEmpSearch.toLowerCase());
              });
              return (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setOpenFilterDrop(p => p === 'employee' ? null : 'employee'); setFilterEmpSearch(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: `1px solid ${isActive ? '#3b775e' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px', color: isActive ? '#3b775e' : '#475569', background: isActive ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  >
                    {label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {openFilterDrop === 'employee' && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '12px', width: '520px', maxWidth: '90vw' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', marginBottom: '10px', padding: '0 2px' }}>All Employees</div>
                      <input
                        autoFocus
                        placeholder="Search employees..."
                        value={filterEmpSearch}
                        onChange={e => setFilterEmpSearch(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', outline: 'none', marginBottom: '10px', boxSizing: 'border-box', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', maxHeight: '260px', overflowY: 'auto' }}>
                        <button
                          onClick={() => { setFilterEmployee(''); setOpenFilterDrop(null); setFilterEmpSearch(''); }}
                          style={{ padding: '7px 8px', borderRadius: '8px', border: 'none', background: !filterEmployee ? '#f0fdf4' : 'transparent', color: !filterEmployee ? '#15803d' : '#475569', fontSize: '11.5px', fontWeight: !filterEmployee ? 700 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", transition: 'background 0.12s' }}
                          onMouseEnter={e => { if (filterEmployee) e.currentTarget.style.background = '#f0fdf4'; }}
                          onMouseLeave={e => { if (filterEmployee) e.currentTarget.style.background = 'transparent'; }}
                        >All Employees</button>
                        {filteredEmps.map(emp => {
                          const name = `${emp.firstName} ${emp.lastName}`;
                          const active = filterEmployee === emp._id;
                          return (
                            <button
                              key={emp._id}
                              onClick={() => { setFilterEmployee(emp._id); setOpenFilterDrop(null); setFilterEmpSearch(''); }}
                              style={{ padding: '7px 8px', borderRadius: '8px', border: 'none', background: active ? '#f0fdf4' : 'transparent', color: active ? '#15803d' : '#475569', fontSize: '11.5px', fontWeight: active ? 700 : 400, cursor: 'pointer', textAlign: 'left', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", transition: 'background 0.12s' }}
                              onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f8fafc'; }}
                              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                            >{name}</button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Date */}
            {(() => {
              const label = filterDate && filterEndDate
                ? `${new Date(filterDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(filterEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : filterDate
                  ? `>= ${new Date(filterDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                  : filterEndDate
                    ? `<= ${new Date(filterEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : 'Any Date';
              const isActive = !!filterDate || !!filterEndDate;
              return (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setOpenFilterDrop(p => p === 'date' ? null : 'date'); setFilterEmpSearch(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: `1px solid ${isActive ? '#3b775e' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px', color: isActive ? '#3b775e' : '#475569', background: isActive ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  >
                    {label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {openFilterDrop === 'date' && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '12px', minWidth: '200px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 2px' }}>Start Date</div>
                      <input
                        type="date"
                        value={filterDate}
                        onChange={e => setFilterDate(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                      />
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 2px' }}>End Date</div>
                      <input
                        type="date"
                        value={filterEndDate}
                        onChange={e => setFilterEndDate(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => setOpenFilterDrop(null)} style={{ flex: 1, padding: '6px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#3b775e', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>Apply</button>
                        {(filterDate || filterEndDate) && (
                          <button
                            onClick={() => {
                              setFilterDate('');
                              setFilterEndDate('');
                              setOpenFilterDrop(null);
                            }}
                            style={{ flex: 1, padding: '6px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Sort */}
            {(() => {
              const label = sortBy === 'oldest' ? 'Oldest First' : 'Newest First';
              return (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => { setOpenFilterDrop(p => p === 'sort' ? null : 'sort'); setFilterEmpSearch(''); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', color: '#475569', background: '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  >
                    {label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                  </button>
                  {openFilterDrop === 'sort' && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '10px', minWidth: '160px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 4px' }}>Sort By</div>
                      {[['newest', 'Newest First'], ['oldest', 'Oldest First']].map(([val, lbl]) => (
                        <button
                          key={val}
                          onClick={() => { setSortBy(val); setOpenFilterDrop(null); }}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', background: sortBy === val ? '#f0fdf4' : 'transparent', color: sortBy === val ? '#15803d' : '#475569', fontSize: '12px', fontWeight: sortBy === val ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                        >{lbl}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>

          {(searchTerm || filterStatus || filterSource || filterEmployee || filterDate || filterEndDate) && (
            <button className="ist-btn-ghost" onClick={clearFilters} style={{ padding: '7px 12px', fontSize: '11px' }}>Clear</button>
          )}

          {hasFullAccess && (
            <button
              className="ist-btn-ghost leads-multi-assign-btn"
              onClick={() => {
                if (multiAssignMode) {
                  setMultiAssignMode(false);
                  setSelectedLeadIds(new Set());
                } else {
                  setMultiAssignMode(true);
                }
              }}
              style={{
                padding: '7px 12px',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                ...(multiAssignMode ? { borderColor: '#3b775e', color: '#3b775e', background: '#f0fdf4' } : {}),
              }}
            >
              <svg style={{ position: 'relative', zIndex: 1 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={{ position: 'relative', zIndex: 1 }}>{multiAssignMode ? `Cancel (${selectedLeadIds.size} selected)` : 'Multi Assign'}</span>
            </button>
          )}

          {multiAssignMode && selectedLeadIds.size > 0 && (
            <button
              className="ist-btn-ghost leads-multi-assign-btn"
              onClick={() => setShowMultiAssignModal(true)}
              style={{
                padding: '7px 12px',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                whiteSpace: 'nowrap',
                borderColor: '#3b775e',
                color: '#3b775e',
                background: '#f0fdf4',
              }}
            >
              <svg style={{ position: 'relative', zIndex: 1 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ position: 'relative', zIndex: 1 }}>Assign {selectedLeadIds.size} Lead{selectedLeadIds.size > 1 ? 's' : ''}</span>
            </button>
          )}

          <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 600 }}>
            {filteredLeads.length} of {statsLeads.length}
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', overflowY: 'auto', position: 'relative', flex: 1, minHeight: 0 }} className="emp-modal-scroll">
          {paginatedLeads.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 8px rgba(0,0,0,0.04)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '6px', fontFamily: "'Inter', -apple-system, sans-serif" }}>No leads found</div>
              <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px', fontFamily: "'Inter', -apple-system, sans-serif" }}>Try adjusting your filters or search query</div>
              <button className="ist-btn-ghost" onClick={clearFilters}>Clear All Filters</button>
            </div>
          ) : (
            <table className="ist-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ boxShadow: '0 1px 0 #f1f5f9' }}>
                  {multiAssignMode && (
                    <th style={{ width: '36px', textAlign: 'center', padding: '0 8px' }}>
                      <input
                        type="checkbox"
                        style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#3b775e' }}
                        checked={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeadIds.has(`${l._type}-${l._id}`))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLeadIds(prev => {
                              const next = new Set(prev);
                              paginatedLeads.forEach(l => next.add(`${l._type}-${l._id}`));
                              return next;
                            });
                          } else {
                            setSelectedLeadIds(prev => {
                              const next = new Set(prev);
                              paginatedLeads.forEach(l => next.delete(`${l._type}-${l._id}`));
                              return next;
                            });
                          }
                        }}
                      />
                    </th>
                  )}
                  <th>#</th>
                  <th>Lead</th>
                  <th>Contact</th>
                  <th>Requirement</th>
                  <th>Country</th>
                  <th>Industry</th>
                  <th>Source</th>
                  <th>Lead Type</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Added On</th>
                  <th>Added By</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLeads.map((lead, idx) => {
                  const statusColors = {
                    'New': { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6' },
                    'Contacted': { bg: '#ffedd5', color: '#d97706', dot: '#f59e0b' },
                    'Qualified': { bg: '#dcfce7', color: '#16a34a', dot: '#22c55e' },
                    'Interested': { bg: '#ede9fe', color: '#7c3aed', dot: '#8b5cf6' },
                    'Follow-up': { bg: '#fce7f3', color: '#be185d', dot: '#ec4899' },
                    'Converted': { bg: '#d1fae5', color: '#047857', dot: '#059669' },
                    'Not Interested': { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
                    'Closed': { bg: '#f1f5f9', color: '#475569', dot: '#64748b' },
                  };
                  const displayStatus = getEffectiveStatus(lead);
                  const st = statusColors[displayStatus] || statusColors['New'];

                  const compositeId = `${lead._type}-${lead._id}`;
                  const isChecked = selectedLeadIds.has(compositeId);
                  // Hide sensitive details for non-admin users on converted leads
                  const isConvertedHidden = displayStatus === 'Converted' && !hasFullAccess;
                  return (
                    <tr
                      key={compositeId}
                      style={multiAssignMode && isChecked ? { background: '#f0fdf4' } : {}}
                    >
                      {multiAssignMode && (
                        <td style={{ textAlign: 'center', padding: '0 8px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            style={{ width: '14px', height: '14px', cursor: 'pointer', accentColor: '#3b775e' }}
                            onChange={() => {
                              setSelectedLeadIds(prev => {
                                const next = new Set(prev);
                                if (next.has(compositeId)) next.delete(compositeId);
                                else next.add(compositeId);
                                return next;
                              });
                            }}
                          />
                        </td>
                      )}
                      <td style={{ fontWeight: 600, color: '#94a3b8', fontSize: '10px' }}>{startIndex + idx + 1}</td>
                      <td>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a', marginBottom: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{lead.leadName || lead.name || lead.company || '—'}</div>
                        {!isConvertedHidden && lead.company && (lead.leadName || lead.name) && <div style={{ fontSize: '9.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>{lead.company}</div>}
                      </td>
                      <td>
                        {isConvertedHidden ? (
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Hidden</span>
                        ) : (
                          <>
                            <div style={{ fontSize: '11px', fontWeight: 500, color: '#475569', marginBottom: '1px' }}>{(lead.contactNumber && lead.contactNumber !== 'N/A') ? lead.contactNumber : (lead.phone && lead.phone !== 'N/A') ? lead.phone : '—'}</div>
                            {lead.email && <div style={{ fontSize: '9.5px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>{lead.email}</div>}
                          </>
                        )}
                      </td>
                      <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#475569' }}>{isConvertedHidden ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Hidden</span> : (lead.requirements || lead.requirement || lead.product || lead.description?.slice(0, 50) || '—')}</td>
                      <td style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#475569' }}>{isConvertedHidden ? '—' : (lead.country || '—')}</td>
                      <td style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '11px', color: '#475569' }}>{isConvertedHidden ? '—' : (lead.industry || '—')}</td>
                      <td>
                        {(() => {
                          let bg = '#f8fafc';
                          let color = '#64748b';
                          if (lead._type === 'meta') {
                            bg = '#ede9fe';
                            color = '#7c3aed';
                          } else if (lead.source === 'Excel Import') {
                            bg = '#f0fdf4';
                            color = '#15803d';
                          } else if (lead.source === 'Email Marketing') {
                            bg = '#e0f2fe';
                            color = '#0369a1';
                          }
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, background: bg, color: color }}>
                              {lead._type === 'meta'
                                ? (lead.pageName || 'Meta')
                                : (lead.source || 'Manual').replace(' - Buyer Lead', '').replace(' - Enquiry', '')}
                            </span>
                          );
                        })()}
                      </td>
                      {/* Lead Type badge — interactive dropdown */}
                      <td>
                        {lead._type === 'meta' ? (
                          // Meta leads don't have leadType — show dash
                          <span style={{ color: '#cbd5e1', fontSize: '10px' }}>—</span>
                        ) : (() => {
                          const lt = lead.leadType;
                          const LEAD_TYPE_OPTIONS = ['Hot', 'Warm', 'Cold'];
                          const ltCfg = (type) => type === 'Hot'
                            ? { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', dot: '#ef4444' }
                            : type === 'Warm'
                              ? { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa', dot: '#f97316' }
                              : { bg: '#e0f2fe', color: '#0284c7', border: '#bae6fd', dot: '#38bdf8' };

                          // Editable badge with dropdown
                          const cfg = lt ? ltCfg(lt) : { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', dot: '#cbd5e1' };
                          return (
                            <div ref={openLeadTypeDrop === lead._id ? leadTypeDropRef : null} style={{ display: 'inline-block' }}>
                              <button
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setLeadTypeDropPos({ top: rect.bottom + 5, left: rect.left });
                                  setOpenLeadTypeDrop(p => p === lead._id ? null : lead._id);
                                }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', border: `1px solid ${cfg.border}`, borderRadius: '999px', fontSize: '10px', color: cfg.color, background: cfg.bg, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 700, whiteSpace: 'nowrap' }}
                              >
                                {lt ? (
                                  <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />{lt}</>
                                ) : (
                                  <span style={{ fontSize: '10px', fontWeight: 500 }}>Set Type</span>
                                )}
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                              </button>
                              {openLeadTypeDrop === lead._id && (
                                <div style={{ position: 'fixed', top: leadTypeDropPos.top, left: leadTypeDropPos.left, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '8px', minWidth: '130px' }}>
                                  {/* None / clear option */}
                                  <button
                                    onClick={() => {
                                      setOpenLeadTypeDrop(null);
                                      if (lt) handleQuickLeadType(lead._id, null);
                                    }}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '8px', border: 'none', background: !lt ? '#f0fdf4' : 'transparent', color: !lt ? '#15803d' : '#94a3b8', fontSize: '11px', fontWeight: !lt ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontStyle: 'italic' }}
                                  >None</button>
                                  {LEAD_TYPE_OPTIONS.map(opt => {
                                    const oc = ltCfg(opt);
                                    return (
                                      <button
                                        key={opt}
                                        onClick={() => {
                                          setOpenLeadTypeDrop(null);
                                          if (opt !== lt) handleQuickLeadType(lead._id, opt);
                                        }}
                                        style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '8px', border: 'none', background: lt === opt ? oc.bg : 'transparent', color: lt === opt ? oc.color : '#475569', fontSize: '11.5px', fontWeight: lt === opt ? 700 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                                      >
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: oc.dot, flexShrink: 0 }} />
                                        {opt}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        {(() => {
                          // Resolve assigned employee: prefer employees list lookup, fall back to populated object
                          const assignedEmp = employees.find(e => e._id === (lead.assignedTo?._id || lead.assignedTo))
                            || (lead.assignedTo?.firstName ? lead.assignedTo : null);
                          const avatarColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                          // Regular employees: show read-only badge
                          if (!hasFullAccess) {
                            const colorIdx = assignedEmp ? (assignedEmp.firstName?.charCodeAt(0) || 0) % avatarColors.length : 0;
                            const initials = assignedEmp ? `${assignedEmp.firstName?.[0] || ''}${assignedEmp.lastName?.[0] || ''}`.toUpperCase() : null;
                            return (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 7px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#f8fafc', fontSize: '10px', fontWeight: 600, color: assignedEmp ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap', maxWidth: '130px', overflow: 'hidden' }}>
                                {assignedEmp ? (
                                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: avatarColors[colorIdx], color: '#fff', fontSize: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</span>
                                ) : (
                                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                  </span>
                                )}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{assignedEmp ? `${assignedEmp.firstName} ${assignedEmp.lastName}` : 'Unassigned'}</span>
                              </div>
                            );
                          }
                          const colorIdx = assignedEmp ? (assignedEmp.firstName?.charCodeAt(0) || 0) % avatarColors.length : 0;
                          const initials = assignedEmp ? `${assignedEmp.firstName?.[0] || ''}${assignedEmp.lastName?.[0] || ''}`.toUpperCase() : null;
                          const canUnassign = displayStatus === 'New';
                          const isDisabled = displayStatus === 'Converted';
                          const doAssign = (empId) => {
                            if (lead._type === 'meta') handleMetaQuickAssign(lead._id, empId, displayStatus);
                            else handleExcelQuickAssign(lead._id, empId);
                          };
                          const filteredSales = salesEmployees.filter(emp =>
                            `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(
                              openAssignDropdown === lead._id ? assignSearch.toLowerCase() : ''
                            )
                          );
                          return (
                            <div ref={openAssignDropdown === lead._id ? assignDropdownRef : null} style={{ display: 'inline-block' }}>
                              <button
                                onClick={(e) => { if (isDisabled) return; const rect = e.currentTarget.getBoundingClientRect(); setAssignDropPos({ top: rect.bottom + 4, left: rect.left }); setOpenAssignDropdown(openAssignDropdown === lead._id ? null : lead._id); setAssignSearch(''); }}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 7px', border: '1px solid #e2e8f0', borderRadius: '7px', background: '#fff', fontSize: '10px', fontWeight: 600, color: assignedEmp ? '#0f172a' : '#94a3b8', cursor: isDisabled ? 'not-allowed' : 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", opacity: isDisabled ? 0.6 : 1, whiteSpace: 'nowrap', maxWidth: '130px', overflow: 'hidden' }}
                              >
                                {assignedEmp ? (
                                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: avatarColors[colorIdx], color: '#fff', fontSize: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</span>
                                ) : (
                                  <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                  </span>
                                )}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{assignedEmp ? `${assignedEmp.firstName} ${assignedEmp.lastName}` : 'Unassigned'}</span>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                              </button>
                              {openAssignDropdown === lead._id && (
                                <div style={{ position: 'fixed', top: assignDropPos.top, left: assignDropPos.left, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 24px rgba(15,23,42,0.14)', width: '220px', overflow: 'hidden' }}>
                                  <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                                    <input
                                      autoFocus
                                      placeholder="Search sales team…"
                                      value={assignSearch}
                                      onChange={e => setAssignSearch(e.target.value)}
                                      style={{ width: '100%', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '11px', outline: 'none', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", boxSizing: 'border-box' }}
                                    />
                                  </div>
                                  <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '6px' }}>
                                    {/* Unassigned option — only enabled when status is New */}
                                    <div
                                      onClick={() => { if (!canUnassign) return; doAssign(''); setOpenAssignDropdown(null); setAssignSearch(''); }}
                                      title={!canUnassign ? 'Cannot unassign — status is not New' : ''}
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', cursor: canUnassign ? 'pointer' : 'not-allowed', marginBottom: '2px', background: !assignedEmp ? '#f0fdf4' : 'transparent', opacity: canUnassign ? 1 : 0.4 }}
                                      onMouseEnter={e => { if (canUnassign) e.currentTarget.style.background = '#f8fafc'; }}
                                      onMouseLeave={e => { if (canUnassign) e.currentTarget.style.background = !assignedEmp ? '#f0fdf4' : 'transparent'; }}
                                    >
                                      <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                      </span>
                                      <div>
                                        <div style={{ fontSize: '11.5px', color: '#94a3b8', fontWeight: 500 }}>Unassigned</div>
                                        {!canUnassign && <div style={{ fontSize: '10px', color: '#fbbf24' }}>Status must be New</div>}
                                      </div>
                                    </div>
                                    {filteredSales.length === 0 && (
                                      <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>No sales employees found</div>
                                    )}
                                    {filteredSales.map(emp => {
                                      const idx = (emp.firstName?.charCodeAt(0) || 0) % avatarColors.length;
                                      const ini = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
                                      const isSelected = (lead.assignedTo?._id || lead.assignedTo) === emp._id;
                                      return (
                                        <div
                                          key={emp._id}
                                          onClick={() => { doAssign(emp._id); setOpenAssignDropdown(null); setAssignSearch(''); }}
                                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', cursor: 'pointer', marginBottom: '2px', background: isSelected ? '#f0fdf4' : 'transparent', border: isSelected ? '1px solid #bbf7d0' : '1px solid transparent' }}
                                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                          <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: avatarColors[idx], color: '#fff', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{ini}</span>
                                          <div>
                                            <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#0f172a' }}>{emp.firstName} {emp.lastName}</div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{emp.role?.name || 'Sales'}</div>
                                          </div>
                                          {isSelected && <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        {/* Status dropdown — shown to ALL users with canRead; read-only badge for converted */}
                        {displayStatus === 'Converted' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: st.bg, color: st.color, borderRadius: '999px', padding: '2px 7px', fontSize: '10px', fontWeight: 600 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                            {displayStatus}
                          </span>
                        ) : (
                          <div ref={openStatusDrop === lead._id ? statusDropRef : null} style={{ display: 'inline-block' }}>
                            <button
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setStatusDropPos({ top: rect.bottom + 5, left: rect.left });
                                setOpenStatusDrop(p => p === lead._id ? null : lead._id);
                              }}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', border: `1px solid ${st.dot}`, borderRadius: '999px', fontSize: '10px', color: st.color, background: st.bg, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                              {displayStatus}
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                            </button>
                            {openStatusDrop === lead._id && (
                              <div style={{ position: 'fixed', top: statusDropPos.top, left: statusDropPos.left, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '8px', minWidth: '150px' }}>
                                {STATUS_OPTIONS.map(s => (
                                  <button
                                    key={s}
                                    onClick={() => {
                                      setOpenStatusDrop(null);
                                      if (s !== displayStatus) {
                                        if (lead._type === 'meta') handleMetaQuickStatus(lead._id, s, displayStatus);
                                        else handleExcelQuickStatus(lead._id, s, displayStatus);
                                      }
                                    }}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: '8px', border: 'none', background: displayStatus === s ? '#f0fdf4' : 'transparent', color: displayStatus === s ? '#15803d' : '#475569', fontSize: '11.5px', fontWeight: displayStatus === s ? 600 : 400, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                                  >{s}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(lead.createdAt)}</td>
                      <td style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap' }}>{fmtDate(lead.addedOn)}</td>
                      <td style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>
                        {lead.createdBy ? (() => {
                          const nameColors = [
                            { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', hoverBg: '#dbeafe' }, // Blue
                            { bg: '#f5f3ff', color: '#5b21b6', border: '#e9d5ff', hoverBg: '#ede9fe' }, // Purple
                            { bg: '#fdf2f8', color: '#9d174d', border: '#fbcfe8', hoverBg: '#fce7f3' }, // Pink
                            { bg: '#fffbeb', color: '#92400e', border: '#fde68a', hoverBg: '#fef3c7' }, // Amber
                            { bg: '#f0fdf4', color: '#065f46', border: '#bbf7d0', hoverBg: '#dcfce7' }, // Emerald
                            { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5', hoverBg: '#fee2e2' }, // Red
                            { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4', hoverBg: '#ccfbf1' }  // Teal
                          ];
                          const nameStr = `${lead.createdBy.firstName || ''} ${lead.createdBy.lastName || ''}`.trim() || lead.createdBy.email || '';
                          const colorIdx = nameStr.length > 0 ? nameStr.charCodeAt(0) % nameColors.length : 0;
                          const c = nameColors[colorIdx];
                          return (
                            <span
                              onClick={() => fetchAndShowEmployeeSummary(lead.createdBy._id || lead.createdBy)}
                              title="Click to view details"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '2.5px 9px',
                                borderRadius: '999px',
                                background: c.bg,
                                color: c.color,
                                border: `1px solid ${c.border}`,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease-in-out',
                                fontFamily: "'Inter', sans-serif"
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = c.hoverBg;
                                e.currentTarget.style.transform = 'translateY(-1px)';
                                e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.08)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = c.bg;
                                e.currentTarget.style.transform = 'none';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              {nameStr}
                            </span>
                          );
                        })() : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                          {/* Converted leads: non-admin users can't view details */}
                          {isConvertedHidden ? (
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', padding: '0 4px' }}>Converted</span>
                          ) : (
                            <>
                              {/* View — always visible to anyone who can read */}
                              <button className="ist-action-btn" title="View" onClick={() => { if (lead._type === 'meta') openMetaLead(lead, false); else openRegularLead(lead, false); }} onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                              </button>
                              {/* Edit — only with canUpdate */}
                              {canUpdate && (
                                <button className="ist-action-btn" title="Edit" onClick={() => { if (lead._type === 'meta') openMetaLead(lead, true); else openRegularLead(lead, true); }} onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                </button>
                              )}
                              {/* Note — for regular CRM leads */}
                              {lead._type !== 'meta' && (
                                <button className="ist-action-btn" title="Note" onClick={() => { setSelectedLead(lead); setNewNote(''); setShowNoteModal(true); }} onMouseEnter={e => e.currentTarget.style.background = '#fef3c7'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                </button>
                              )}
                              {/* History — for regular CRM leads */}
                              {lead._type !== 'meta' && (
                                <button className="ist-action-btn" title="History" onClick={() => { setSelectedLead(lead); setShowHistoryModal(true); }} onMouseEnter={e => e.currentTarget.style.background = '#f3e8ff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                </button>
                              )}
                              {/* Delete — only with canDelete */}
                              {canDelete && (
                                <button className="ist-action-btn" title="Delete" onClick={() => handleDeleteLead(lead)} onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
              Page {currentPage} of {totalPages}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="ist-pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
                style={{ padding: '6px 12px', width: 'auto' }}
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    className={`ist-pagination-btn ${pageNum === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="ist-pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                style={{ padding: '6px 12px', width: 'auto' }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Regular Lead Modals ─────────────────────────────────────────────── */}
      {showDetailsModal && selectedLead && (
        <div className="is-modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="is-modal is-modal-wide" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="is-modal-header">
              <div className="is-mlead-header-info">
                <div className="is-mlead-avatar">
                  {((selectedLead.company || selectedLead.leadName || selectedLead.name || '?')[0]).toUpperCase()}
                </div>
                <div>
                  <h2 className="is-mlead-name">
                    {selectedLead.company || selectedLead.leadName || selectedLead.name || '—'}
                  </h2>
                  <div className="is-mlead-meta">
                    <span className="is-source-badge" style={{
                      background: selectedLead.source === 'Excel Import' ? '#f0fdf4' : selectedLead.source === 'Email Marketing' ? '#e0f2fe' : '#f8fafc',
                      color: selectedLead.source === 'Excel Import' ? '#15803d' : selectedLead.source === 'Email Marketing' ? '#0369a1' : '#64748b',
                      border: `1px solid ${selectedLead.source === 'Excel Import' ? '#bbf7d0' : selectedLead.source === 'Email Marketing' ? '#bae6fd' : '#e2e8f0'}`,
                    }}>
                      {selectedLead.source || 'CRM'}
                    </span>
                    <span className={`is-status-badge ${getStatusClass(getEffectiveStatus(selectedLead))}`}>
                      {getEffectiveStatus(selectedLead)}
                    </span>
                  </div>
                </div>
              </div>
              <button className="is-modal-close" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>

            <div className="is-modal-body">
              <div className="is-mlead-layout">

                {/* LEFT — full edit form */}
                <div className="is-mlead-left">

                  {/* Contact & Lead Details */}
                  <div className="is-mlead-section">
                    <p className="is-mlead-section-title">Lead Details</p>
                    <form onSubmit={handleRegularLeadSave}>
                      <div className="is-mlead-form-grid">

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Name / Client</label>
                          {isEditing ? (
                            <input className="is-form-input" type="text" placeholder="Lead name" value={leadEditForm.name} onChange={e => setLeadEditForm(p => ({ ...p, name: e.target.value }))} disabled={!canUpdate} />
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.name || '—'}</div>
                          )}
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Company</label>
                          {isEditing ? (
                            <input className="is-form-input" type="text" placeholder="Company" value={leadEditForm.company} onChange={e => setLeadEditForm(p => ({ ...p, company: e.target.value }))} disabled={!canUpdate} />
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.company || '—'}</div>
                          )}
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Phone</label>
                          {isEditing ? (
                            <input className="is-form-input" type="text" placeholder="Phone number" value={leadEditForm.phone} onChange={e => setLeadEditForm(p => ({ ...p, phone: e.target.value }))} disabled={!canUpdate} />
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.phone || '—'}</div>
                          )}
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Email</label>
                          {isEditing ? (
                            <input className="is-form-input" type="email" placeholder="Email address" value={leadEditForm.email} onChange={e => setLeadEditForm(p => ({ ...p, email: e.target.value }))} disabled={!canUpdate} />
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.email || '—'}</div>
                          )}
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Country</label>
                          {isEditing ? (
                            <input className="is-form-input" type="text" placeholder="Country" value={leadEditForm.country} onChange={e => setLeadEditForm(p => ({ ...p, country: e.target.value }))} disabled={!canUpdate} />
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.country || '—'}</div>
                          )}
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Industry</label>
                          {isEditing ? (
                            <input className="is-form-input" type="text" placeholder="Industry" value={leadEditForm.industry} onChange={e => setLeadEditForm(p => ({ ...p, industry: e.target.value }))} disabled={!canUpdate} />
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.industry || '—'}</div>
                          )}
                        </div>

                        <div className="is-mlead-field" style={{ gridColumn: '1 / -1' }}>
                          <label className="is-mlead-field-lbl">Requirement</label>
                          {isEditing ? (
                            <textarea
                              className="is-form-textarea"
                              placeholder="Requirement / product"
                              value={leadEditForm.requirement}
                              onChange={e => setLeadEditForm(p => ({ ...p, requirement: e.target.value }))}
                              disabled={!canUpdate}
                              style={{ minHeight: '120px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}
                            />
                          ) : (
                            <div className="is-mlead-val-textarea">{leadEditForm.requirement || '—'}</div>
                          )}
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Source</label>
                          {isEditing ? (
                            <input className="is-form-input" type="text" placeholder="Source" value={leadEditForm.source} onChange={e => setLeadEditForm(p => ({ ...p, source: e.target.value }))} disabled={!canUpdate} />
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.source || '—'}</div>
                          )}
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Budget (₹)</label>
                          {isEditing ? (
                            <input className="is-form-input" type="number" placeholder="Budget" value={leadEditForm.budget} onChange={e => setLeadEditForm(p => ({ ...p, budget: e.target.value }))} disabled={!canUpdate} />
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.budget ? `₹ ${leadEditForm.budget}` : '—'}</div>
                          )}
                        </div>

                        {/* Lead Type */}
                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Lead Type</label>
                          {isEditing ? (
                            <select
                              className="is-form-select"
                              value={leadEditForm.leadType}
                              onChange={e => setLeadEditForm(p => ({ ...p, leadType: e.target.value }))}
                              disabled={!canUpdate}
                            >
                              <option value="">-- Select Type --</option>
                              <option value="Hot">Hot</option>
                              <option value="Warm">Warm</option>
                              <option value="Cold">Cold</option>
                            </select>
                          ) : (
                            <div className="is-mlead-val-text">
                              {leadEditForm.leadType ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                                  padding: '3px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                                  background: leadEditForm.leadType === 'Hot' ? '#fef2f2' : leadEditForm.leadType === 'Warm' ? '#fff7ed' : '#e0f2fe',
                                  color: leadEditForm.leadType === 'Hot' ? '#dc2626' : leadEditForm.leadType === 'Warm' ? '#ea580c' : '#0284c7',
                                  border: `1px solid ${leadEditForm.leadType === 'Hot' ? '#fecaca' : leadEditForm.leadType === 'Warm' ? '#fed7aa' : '#bae6fd'}`,
                                }}>
                                  {leadEditForm.leadType}
                                </span>
                              ) : '—'}
                            </div>
                          )}
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Added By</label>
                          <div className="is-mlead-val-text">
                            {selectedLead.createdBy ? `${selectedLead.createdBy.firstName || ''} ${selectedLead.createdBy.lastName || ''}`.trim() || selectedLead.createdBy.email : 'System / Import'}
                          </div>
                        </div>

                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Status {selectedLead.status === 'Converted' && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 500 }}>(Locked)</span>}</label>
                          {isEditing ? (
                            <select
                              value={leadEditForm.status}
                              onChange={e => {
                                const value = e.target.value;
                                setLeadEditForm(p => ({
                                  ...p,
                                  status: value,
                                  followUpDate: value === 'Follow-up' ? p.followUpDate : ''
                                }));
                                if (value === 'Follow-up') setActiveFollowUpPicker('lead');
                                else setActiveFollowUpPicker(null);
                              }}
                              className="is-form-select"
                              disabled={!canUpdate || selectedLead.status === 'Converted'}
                              style={{ opacity: selectedLead.status === 'Converted' ? 0.6 : 1, cursor: (!canUpdate || selectedLead.status === 'Converted') ? 'not-allowed' : 'pointer' }}
                            >
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <div className="is-mlead-val-text">{leadEditForm.status || '—'}</div>
                          )}
                        </div>

                        {hasFullAccess && (
                          <div className="is-mlead-field">
                            <label className="is-mlead-field-lbl">Assign To {selectedLead.status === 'Converted' && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 500 }}>(Locked)</span>}</label>
                            {isEditing ? (
                              <select
                                value={leadEditForm.assignedTo}
                                onChange={e => setLeadEditForm(p => ({ ...p, assignedTo: e.target.value }))}
                                className="is-form-select"
                                disabled={!canUpdate || selectedLead.status === 'Converted'}
                                style={{ opacity: selectedLead.status === 'Converted' ? 0.6 : 1, cursor: (!canUpdate || selectedLead.status === 'Converted') ? 'not-allowed' : 'pointer' }}
                              >
                                <option value="">— Unassigned —</option>
                                {salesEmployees.map(emp => <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>)}
                              </select>
                            ) : (
                              <div className="is-mlead-val-text">
                                {salesEmployees.find(emp => emp._id === leadEditForm.assignedTo)
                                  ? `${salesEmployees.find(emp => emp._id === leadEditForm.assignedTo).firstName} ${salesEmployees.find(emp => emp._id === leadEditForm.assignedTo).lastName}`
                                  : '— Unassigned —'}
                              </div>
                            )}
                          </div>
                        )}

                        {!!leadEditForm.followUpDate && (
                          <div className="is-mlead-field" style={{ gridColumn: '1 / -1' }}>
                            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {renderFollowUpBadges(leadEditForm.followUpDate)}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="is-mlead-field" style={{ marginTop: 10 }}>
                        <label className="is-mlead-field-lbl">Notes</label>
                        {isEditing ? (
                          <textarea className="is-form-textarea" rows={3} placeholder="Add notes..." value={leadEditForm.notes} onChange={e => setLeadEditForm(p => ({ ...p, notes: e.target.value }))} disabled={!canUpdate} />
                        ) : (
                          <div className="is-mlead-val-textarea" style={{ minHeight: '80px' }}>{leadEditForm.notes || '—'}</div>
                        )}
                      </div>

                      <div className="is-mlead-form-actions">
                        {isEditing ? (
                          <>
                            {canUpdate && <button type="submit" className="is-btn is-btn-primary" disabled={leadSaving}>{leadSaving ? 'Saving…' : 'Save Changes'}</button>}
                            <button type="button" className="is-btn is-btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            {canUpdate && <button type="button" className="is-btn is-btn-primary" onClick={() => setIsEditing(true)}>Edit Details</button>}
                            <button type="button" className="is-btn is-btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
                          </>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                {/* RIGHT — activity timeline */}
                <div className="is-mlead-right">
                  <p className="is-mlead-section-title">Activity History</p>
                  {selectedLead.history?.length > 0 ? (
                    <div className="is-timeline">
                      {selectedLead.history.slice().reverse().map((h, i) => (
                        <div key={i} className="is-timeline-item">
                          <div className="is-timeline-dot"></div>
                          <div className="is-timeline-content">
                            <div className="is-timeline-top">
                              <strong className="is-timeline-action">{h.action}</strong>
                              <span className="is-timeline-date">{fmtDate(h.date)}</span>
                            </div>
                            <p className="is-timeline-details">{h.details}</p>
                            {h.by && (
                              <span className="is-timeline-by">
                                {typeof h.by === 'object' ? `${h.by.firstName} ${h.by.lastName || ''}`.trim() : h.by}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="is-mlead-empty">No activity yet.</p>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {showStatusModal && selectedLead && activeFollowUpPicker !== 'status' && (
        <div className="is-modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="is-modal is-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="is-modal-header"><h2>Change Status</h2><button className="is-modal-close" onClick={() => setShowStatusModal(false)}>×</button></div>
            <div className="is-modal-body">
              <label className="is-form-label">Lead: <strong>{selectedLead.leadName || selectedLead.name || selectedLead.company || 'Lead'}</strong></label>
              <select
                className="is-form-select"
                value={newStatus}
                onChange={e => {
                  const value = e.target.value;
                  setNewStatus(value);
                  if (value !== 'Follow-up') setStatusFollowUpAt('');
                  setActiveFollowUpPicker(value === 'Follow-up' ? 'status' : null);
                }}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="is-modal-footer">
              <button className="is-btn is-btn-primary" onClick={handleStatusSave} disabled={updating}>{updating ? 'Saving...' : 'Update Status'}</button>
              <button className="is-btn is-btn-secondary" onClick={() => setShowStatusModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showNoteModal && selectedLead && (
        <div className="is-modal-overlay" onClick={() => setShowNoteModal(false)}>
          <div className="is-modal is-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="is-modal-header"><h2>Add Note</h2><button className="is-modal-close" onClick={() => setShowNoteModal(false)}>×</button></div>
            <div className="is-modal-body">
              <label className="is-form-label">Lead: <strong>{selectedLead.leadName || selectedLead.name || selectedLead.company}</strong></label>
              <textarea className="is-form-textarea" placeholder="Enter your note here..." value={newNote} onChange={e => setNewNote(e.target.value)} />
            </div>
            <div className="is-modal-footer">
              <button className="is-btn is-btn-primary" onClick={handleNoteSave} disabled={updating || !newNote.trim()}>{updating ? 'Saving...' : 'Add Note'}</button>
              <button className="is-btn is-btn-secondary" onClick={() => setShowNoteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showHistoryModal && selectedLead && (
        <div className="is-modal-overlay" onClick={() => setShowHistoryModal(false)}>
          <div className="is-modal" onClick={e => e.stopPropagation()}>
            <div className="is-modal-header"><h2>Lead History</h2><button className="is-modal-close" onClick={() => setShowHistoryModal(false)}>×</button></div>
            <div className="is-modal-body">
              {selectedLead.history?.length > 0 ? (
                <div className="is-history-list">
                  {selectedLead.history.slice().reverse().map((item, idx) => (
                    <div key={idx} className="is-history-item">
                      <div className="is-history-header"><strong>{item.action}</strong><span className="is-history-date">{new Date(item.date).toLocaleString()}</span></div>
                      <p className="is-history-details">{item.details}</p>
                      {item.by && <span className="is-history-by">By: {typeof item.by === 'object' ? `${item.by.firstName} ${item.by.lastName || ''}` : 'User'}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="is-empty-state"><div className="is-empty-icon">📋</div><p>No history available.</p></div>
              )}
            </div>
            <div className="is-modal-footer">
              <button className="is-btn is-btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Meta Lead Detail / Edit Modal ───────────────────────────────────── */}
      {showMetaModal && metaSelected && (
        <div className="is-modal-overlay" onClick={() => setShowMetaModal(false)}>
          <div className="is-modal is-modal-wide" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="is-modal-header">
              <div className="is-mlead-header-info">
                <div className="is-mlead-avatar">{(metaSelected.name || '?')[0].toUpperCase()}</div>
                <div>
                  <h2 className="is-mlead-name">{metaSelected.name || '—'}</h2>
                  <div className="is-mlead-meta">
                    <span className="is-source-badge">Facebook / {metaSelected.pageName || 'Meta'}</span>
                    <span className={`is-status-badge ${getStatusClass(getEffectiveStatus(metaSelected))}`}>{getEffectiveStatus(metaSelected)}</span>
                  </div>
                </div>
              </div>
              <button className="is-modal-close" onClick={() => setShowMetaModal(false)}>×</button>
            </div>

            <div className="is-modal-body">
              <div className="is-mlead-layout">

                {/* LEFT — info + update form */}
                <div className="is-mlead-left">

                  {/* Contact Info */}
                  <div className="is-mlead-section">
                    <p className="is-mlead-section-title">Contact Information</p>
                    <div className="is-mlead-info-rows">
                      <div className="is-mlead-row"><span className="is-mlead-lbl">Phone</span><span className="is-mlead-val">{metaSelected.phone || '—'}</span></div>
                      <div className="is-mlead-row"><span className="is-mlead-lbl">Email</span><span className="is-mlead-val">{metaSelected.email || '—'}</span></div>
                      <div className="is-mlead-row"><span className="is-mlead-lbl">City</span><span className="is-mlead-val">{metaSelected.city || '—'}</span></div>
                      <div className="is-mlead-row"><span className="is-mlead-lbl">Business</span><span className="is-mlead-val">{metaSelected.businessCategory || '—'}</span></div>
                      <div className="is-mlead-row"><span className="is-mlead-lbl">Website Type</span><span className="is-mlead-val">{metaSelected.websiteType || '—'}</span></div>
                      <div className="is-mlead-row"><span className="is-mlead-lbl">Received</span><span className="is-mlead-val">{fmtDate(metaSelected.createdTime)}</span></div>
                    </div>
                  </div>

                  {/* CRM Update Form */}
                  <div className="is-mlead-section">
                    <p className="is-mlead-section-title">Update Lead</p>
                    <form onSubmit={handleMetaSave}>
                      <div className="is-mlead-form-grid">
                        <div className="is-mlead-field">
                          <label className="is-mlead-field-lbl">Status {metaSelected.status === 'Converted' && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 500 }}>(Locked)</span>}</label>
                          {isEditing ? (
                            <select
                              value={metaEditForm.status}
                              onChange={e => {
                                const value = e.target.value;
                                setMetaEditForm(p => ({
                                  ...p,
                                  status: value,
                                  followUpDate: value === 'Follow-up' ? p.followUpDate : ''
                                }));
                                if (value === 'Follow-up') setActiveFollowUpPicker('meta');
                                else setActiveFollowUpPicker(null);
                              }}
                              className="is-form-select"
                              disabled={metaSelected.status === 'Converted'}
                              style={{ opacity: metaSelected.status === 'Converted' ? 0.6 : 1, cursor: metaSelected.status === 'Converted' ? 'not-allowed' : 'pointer' }}
                            >
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <div className="is-mlead-val-text">{metaEditForm.status || '—'}</div>
                          )}
                        </div>
                        {hasFullAccess && (
                          <div className="is-mlead-field">
                            <label className="is-mlead-field-lbl">Assign To {metaSelected.status === 'Converted' && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 500 }}>(Locked)</span>}</label>
                            {isEditing ? (
                              <select
                                value={metaEditForm.assignedTo}
                                onChange={e => setMetaEditForm(p => ({ ...p, assignedTo: e.target.value }))}
                                className="is-form-select"
                                disabled={metaSelected.status === 'Converted'}
                                style={{ opacity: metaSelected.status === 'Converted' ? 0.6 : 1, cursor: metaSelected.status === 'Converted' ? 'not-allowed' : 'pointer' }}
                              >
                                <option value="">— Unassigned —</option>
                                {salesEmployees.map(emp => <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName}</option>)}
                              </select>
                            ) : (
                              <div className="is-mlead-val-text">
                                {salesEmployees.find(emp => emp._id === metaEditForm.assignedTo)
                                  ? `${salesEmployees.find(emp => emp._id === metaEditForm.assignedTo).firstName} ${salesEmployees.find(emp => emp._id === metaEditForm.assignedTo).lastName}`
                                  : '— Unassigned —'}
                              </div>
                            )}
                          </div>
                        )}
                        {!!metaEditForm.followUpDate && (
                          <div className="is-mlead-field" style={{ gridColumn: '1 / -1' }}>
                            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {renderFollowUpBadges(metaEditForm.followUpDate)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="is-mlead-field" style={{ marginTop: 10 }}>
                        <label className="is-mlead-field-lbl">Notes</label>
                        {isEditing ? (
                          <textarea className="is-form-textarea" rows={3} placeholder="Add notes..." value={metaEditForm.notes} onChange={e => setMetaEditForm(p => ({ ...p, notes: e.target.value }))} />
                        ) : (
                          <div className="is-mlead-val-textarea" style={{ minHeight: '80px' }}>{metaEditForm.notes || '—'}</div>
                        )}
                      </div>
                      <div className="is-mlead-form-actions">
                        {isEditing ? (
                          <>
                            {canUpdate && <button type="submit" className="is-btn is-btn-primary" disabled={metaSaving}>{metaSaving ? 'Saving…' : 'Save Changes'}</button>}
                            <button type="button" className="is-btn is-btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
                          </>
                        ) : (
                          <>
                            {canUpdate && <button type="button" className="is-btn is-btn-primary" onClick={() => setIsEditing(true)}>Edit Details</button>}
                            <button type="button" className="is-btn is-btn-secondary" onClick={() => setShowMetaModal(false)}>Close</button>
                          </>
                        )}
                      </div>
                    </form>
                  </div>
                </div>

                {/* RIGHT — activity timeline */}
                <div className="is-mlead-right">
                  <p className="is-mlead-section-title">Activity History</p>
                  {metaSelected.history?.length > 0 ? (
                    <div className="is-timeline">
                      {metaSelected.history.slice().reverse().map((h, i) => (
                        <div key={i} className="is-timeline-item">
                          <div className="is-timeline-dot"></div>
                          <div className="is-timeline-content">
                            <div className="is-timeline-top">
                              <strong className="is-timeline-action">{h.action}</strong>
                              <span className="is-timeline-date">{fmtDate(h.date)}</span>
                            </div>
                            <p className="is-timeline-details">{h.details}</p>
                            {h.by && (
                              <span className="is-timeline-by">
                                {typeof h.by === 'object' ? `${h.by.firstName} ${h.by.lastName || ''}`.trim() : h.by}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="is-mlead-empty">No activity yet.</p>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {activeFollowUpPicker && (
        <div
          className="is-modal-overlay"
          style={{ zIndex: 2100, background: 'rgba(15,23,42,0.18)' }}
          onClick={handleFollowUpOverlayClick}
        >
          <div onClick={e => e.stopPropagation()}>
            {activeFollowUpPicker === 'lead' && renderFollowUpScheduleCard(
              leadEditForm.followUpDate,
              (nextValue) => setLeadEditForm(p => ({ ...p, followUpDate: nextValue, status: nextValue ? 'Follow-up' : p.status })),
              () => setActiveFollowUpPicker(null)
            )}
            {activeFollowUpPicker === 'meta' && renderFollowUpScheduleCard(
              metaEditForm.followUpDate,
              (nextValue) => setMetaEditForm(p => ({ ...p, followUpDate: nextValue, status: nextValue ? 'Follow-up' : p.status })),
              () => setActiveFollowUpPicker(null)
            )}
            {activeFollowUpPicker === 'status' && renderFollowUpScheduleCard(
              statusFollowUpAt,
              setStatusFollowUpAt,
              () => {
                setActiveFollowUpPicker(null);
                setStatusFollowUpAt('');
              },
              handleStatusSave
            )}
          </div>
        </div>
      )}

      {/* ── Conversion Confirmation Modal ──────────────────────────────────── */}
      {showConversionModal && (
        <div className="is-modal-overlay" onClick={cancelConversion}>
          <div className="is-modal is-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="is-modal-header">
              <h2>Convert Lead to Deal</h2>
              <button className="is-modal-close" onClick={cancelConversion}>×</button>
            </div>
            <div className="is-modal-body">
              <div style={{ padding: '10px 0', textAlign: 'center' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 16px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>
                  Are you sure you wanna convert it into a deal?
                </p>
                <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '0' }}>
                  Once converted, the status cannot be changed again.
                </p>
              </div>
            </div>
            <div className="is-modal-footer">
              <button className="is-btn is-btn-primary" onClick={confirmConversion} disabled={updating}>
                {updating ? 'Converting...' : 'Yes, Convert'}
              </button>
              <button className="is-btn is-btn-secondary" onClick={cancelConversion}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ── Excel Upload Preview Modal ────────────────────────────────────── */}
      {showUploadModal && (
        <div onClick={() => { if (!uploading) { setShowUploadModal(false); setUploadRows([]); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '1000px', background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 24px 48px rgba(15,23,42,0.18)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>

            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>Import Leads from Excel</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>{uploadRows.length} rows found — review before importing</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={handleDownloadTemplate}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '8px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Download Template
                </button>
                <button onClick={() => { setShowUploadModal(false); setUploadRows([]); }}
                  style={{ background: 'transparent', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            </div>

            {/* Column name guide */}
            <div style={{ padding: '12px 22px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                📋 Required / Accepted Column Names in your Excel file:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {IMPORT_FIELDS.map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '4px 9px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a' }}>{f.label}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>({f.aliases.slice(0, 3).join(', ')})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                <thead>
                  <tr style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
                    {['#', 'Client Name', 'Company', 'Phone', 'Email', 'Country', 'Industry', 'Requirement', 'Source', 'Lead Type', 'Budget', 'Notes'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {uploadRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11.5px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{row.name || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569' }}>{row.company || <span style={{ color: '#94a3b8' }}>—</span>}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', whiteSpace: 'nowrap' }}>{row.phone || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.email || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569' }}>{row.country || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569' }}>{row.industry || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.requirements || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: '#f0fdf4', color: '#15803d', whiteSpace: 'nowrap' }}>
                          {row.source || 'Excel Import'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569' }}>{row.leadType || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569' }}>{row.budget || '—'}</td>
                      <td style={{ padding: '8px 12px', fontSize: '11px', color: '#475569', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {uploadError && (
              <div style={{ padding: '10px 22px', background: '#fef2f2', borderTop: '1px solid #fecaca', fontSize: '12px', color: '#dc2626', fontWeight: 600 }}>{uploadError}</div>
            )}
            <div style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => { setShowUploadModal(false); setUploadRows([]); }} disabled={uploading}
                style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                Cancel
              </button>
              <button onClick={handleUploadSubmit} disabled={uploading || !uploadRows.length}
                style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1, fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                {uploading ? 'Importing…' : `Import ${uploadRows.length} Leads`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Multi Assign Modal ─────────────────────────────────────────── */}
      {showMultiAssignModal && (
        <div
          onClick={() => { if (!multiAssigning) { setShowMultiAssignModal(false); } }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 20px 40px rgba(15,23,42,0.18)', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>Assign Leads</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  {selectedLeadIds.size} lead{selectedLeadIds.size > 1 ? 's' : ''} selected
                </div>
              </div>
              <button
                onClick={() => setShowMultiAssignModal(false)}
                disabled={multiAssigning}
                style={{ background: 'transparent', border: 'none', fontSize: '22px', color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                Select Employee <span style={{ color: '#ef4444' }}>*</span>
              </div>
              {/* Search input */}
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  placeholder="Search employee…"
                  value={multiAssignSearch}
                  onChange={e => setMultiAssignSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px 8px 30px', border: '1px solid #e2e8f0', borderRadius: '9px', fontSize: '12px', outline: 'none', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", boxSizing: 'border-box' }}
                />
              </div>
              {/* Employee list */}
              <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '6px' }}>
                {salesEmployees
                  .filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(multiAssignSearch.toLowerCase()))
                  .map(emp => {
                    const avatarColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
                    const colorIdx = (emp.firstName?.charCodeAt(0) || 0) % avatarColors.length;
                    const initials = `${emp.firstName?.[0] || ''}${emp.lastName?.[0] || ''}`.toUpperCase();
                    const isSelected = multiAssignEmployee === emp._id;
                    return (
                      <div
                        key={emp._id}
                        onClick={() => setMultiAssignEmployee(emp._id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '9px', cursor: 'pointer', background: isSelected ? '#f0fdf4' : 'transparent', border: isSelected ? '1px solid #bbf7d0' : '1px solid transparent', marginBottom: '3px', transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: avatarColors[colorIdx], color: '#fff', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials}</span>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{emp.firstName} {emp.lastName}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8' }}>{emp.role?.name || 'Sales'}</div>
                        </div>
                        {isSelected && (
                          <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    );
                  })}
                {salesEmployees.filter(e => `${e.firstName} ${e.lastName}`.toLowerCase().includes(multiAssignSearch.toLowerCase())).length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>No employees found</div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowMultiAssignModal(false)}
                disabled={multiAssigning}
                style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
              >
                Cancel
              </button>
              <button
                onClick={handleMultiAssign}
                disabled={multiAssigning || !multiAssignEmployee}
                style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: multiAssignEmployee ? 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)' : '#e2e8f0', color: multiAssignEmployee ? '#fff' : '#94a3b8', fontSize: '12px', fontWeight: 700, cursor: multiAssignEmployee && !multiAssigning ? 'pointer' : 'not-allowed', opacity: multiAssigning ? 0.7 : 1, fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
              >
                {multiAssigning ? 'Assigning…' : `Assign to ${salesEmployees.find(e => e._id === multiAssignEmployee) ? `${salesEmployees.find(e => e._id === multiAssignEmployee).firstName} ${salesEmployees.find(e => e._id === multiAssignEmployee).lastName}` : 'Employee'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddLeadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: '#fff', borderRadius: '18px', width: '600px', maxHeight: '90vh', boxShadow: '0 20px 48px rgba(15,23,42,0.18)', overflow: 'hidden', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Create New Lead</h3>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0' }}>Add a new client or lead manually to CRM</p>
              </div>
              <button
                onClick={() => setShowAddLeadModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer', outline: 'none' }}
              >×</button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddLeadSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Body */}
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>

                  {/* Name */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Name / Client <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      className="is-form-input"
                      type="text"
                      placeholder="e.g. John Doe"
                      value={addLeadForm.name}
                      onChange={e => setAddLeadForm(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>

                  {/* Email */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Email Address <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      className="is-form-input"
                      type="email"
                      placeholder="e.g. john@example.com"
                      value={addLeadForm.email}
                      onChange={e => setAddLeadForm(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>

                  {/* Phone */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Phone Number <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      required
                      className="is-form-input"
                      type="tel"
                      placeholder="e.g. +1 555-0199"
                      value={addLeadForm.phone}
                      onChange={e => setAddLeadForm(p => ({ ...p, phone: e.target.value }))}
                    />
                  </div>

                  {/* Source */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Lead Source <span style={{ color: '#ef4444' }}>*</span></label>
                    <select
                      required
                      className="is-form-input"
                      value={addLeadForm.source}
                      onChange={e => setAddLeadForm(p => ({ ...p, source: e.target.value }))}
                    >
                      <option value="Manual">Manual</option>
                      <option value="Email Marketing">Email Marketing</option>
                      <option value="Excel Import">Excel Import</option>
                      <option value="Reference">Reference</option>
                      <option value="Website">Website</option>
                      <option value="Social Media">Social Media</option>
                    </select>
                  </div>

                  {/* Company */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Company</label>
                    <input
                      className="is-form-input"
                      type="text"
                      placeholder="e.g. Acme Corp"
                      value={addLeadForm.company}
                      onChange={e => setAddLeadForm(p => ({ ...p, company: e.target.value }))}
                    />
                  </div>

                  {/* Country */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Country</label>
                    <input
                      className="is-form-input"
                      type="text"
                      placeholder="e.g. United States"
                      value={addLeadForm.country}
                      onChange={e => setAddLeadForm(p => ({ ...p, country: e.target.value }))}
                    />
                  </div>

                  {/* Industry */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Industry</label>
                    <input
                      className="is-form-input"
                      type="text"
                      placeholder="e.g. Technology"
                      value={addLeadForm.industry}
                      onChange={e => setAddLeadForm(p => ({ ...p, industry: e.target.value }))}
                    />
                  </div>

                  {/* Budget */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Budget ($)</label>
                    <input
                      className="is-form-input"
                      type="number"
                      placeholder="e.g. 5000"
                      value={addLeadForm.budget}
                      onChange={e => setAddLeadForm(p => ({ ...p, budget: e.target.value }))}
                    />
                  </div>

                  {/* Lead Type */}
                  <div className="is-mlead-field">
                    <label className="is-mlead-field-lbl">Lead Type</label>
                    <select
                      className="is-form-input"
                      value={addLeadForm.leadType}
                      onChange={e => setAddLeadForm(p => ({ ...p, leadType: e.target.value }))}
                    >
                      <option value="">-- Select Type --</option>
                      <option value="Hot">Hot</option>
                      <option value="Warm">Warm</option>
                      <option value="Cold">Cold</option>
                    </select>
                  </div>

                  {/* Assigned To */}
                  <div className="is-mlead-field" style={{ gridColumn: 'span 2' }}>
                    <label className="is-mlead-field-lbl">Assign to Salesperson</label>
                    <select
                      className="is-form-input"
                      value={addLeadForm.assignedTo}
                      onChange={e => setAddLeadForm(p => ({ ...p, assignedTo: e.target.value }))}
                    >
                      <option value="">-- Select Salesperson (Optional) --</option>
                      {salesEmployees.map(emp => (
                        <option key={emp._id} value={emp._id}>
                          {emp.firstName} {emp.lastName} ({emp.role?.name || 'Sales'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Requirement */}
                  <div className="is-mlead-field" style={{ gridColumn: 'span 2' }}>
                    <label className="is-mlead-field-lbl">Requirement</label>
                    <textarea
                      className="is-form-input"
                      style={{ minHeight: '100px', resize: 'vertical' }}
                      placeholder="Paste requirement details here..."
                      value={addLeadForm.requirement}
                      onChange={e => setAddLeadForm(p => ({ ...p, requirement: e.target.value }))}
                    />
                  </div>

                  {/* Notes */}
                  <div className="is-mlead-field" style={{ gridColumn: 'span 2' }}>
                    <label className="is-mlead-field-lbl">Notes</label>
                    <textarea
                      className="is-form-input"
                      style={{ minHeight: '80px', resize: 'vertical' }}
                      placeholder="Additional notes about this lead..."
                      value={addLeadForm.notes}
                      onChange={e => setAddLeadForm(p => ({ ...p, notes: e.target.value }))}
                    />
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  disabled={addLeadSaving}
                  style={{ padding: '9px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLeadSaving}
                  style={{ padding: '9px 16px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", opacity: addLeadSaving ? 0.7 : 1 }}
                >
                  {addLeadSaving ? 'Creating…' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEmployeeSummaryModal && (
        <div className="is-modal-overlay" onClick={() => setShowEmployeeSummaryModal(false)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              fontFamily: "'Poppins', 'Inter', 'Segoe UI', sans-serif",
              width: "350px",
              maxWidth: "90vw",
              minHeight: "auto",
              background: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #e5e7eb",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "9px",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.15)",
              animation: "is-modal-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
              position: "relative",
              boxSizing: "border-box"
            }}
          >
            {/* Close Button 'X' at top right */}
            <button
              type="button"
              onClick={() => setShowEmployeeSummaryModal(false)}
              style={{
                position: "absolute",
                top: "22px",
                right: "22px",
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                color: "#6b7280",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                zIndex: 20,
                boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
                transition: "all 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "#f9fafb";
                e.currentTarget.style.color = "#111827";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "#ffffff";
                e.currentTarget.style.color = "#6b7280";
              }}
            >
              ×
            </button>

            <div
              style={{
                position: "relative",
                height: "135px",
                borderRadius: "11px",
                overflow: "hidden",
                background: "linear-gradient(135deg, #d1d5db, #e5e7eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {employeeSummaryLoading ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="3" strokeLinecap="round" style={{ animation: 'spin 1.8s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              ) : employeeSummaryData?.profileImage || employeeSummaryData?.avatar || employeeSummaryData?.photo ? (
                <img
                  src={employeeSummaryData.profileImage || employeeSummaryData.avatar || employeeSummaryData.photo}
                  alt={employeeSummaryData ? `${employeeSummaryData.firstName} ${employeeSummaryData.lastName}` : "Member"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "#a8e63d",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                  </svg>
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827", lineHeight: 1.15 }}>
                {employeeSummaryData ? `${employeeSummaryData.firstName} ${employeeSummaryData.lastName}` : "Loading..."}
              </div>
              {employeeSummaryData && (
                <div style={{
                  width: "14px",
                  height: "14px",
                  marginLeft: "-2px",
                  borderRadius: "50%",
                  background: "#4caf50",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 7L10 17l-6-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>

            <div style={{ fontSize: "11px", color: "#6b7280", lineHeight: 1.35 }}>
              {employeeSummaryData?.designation || employeeSummaryData?.role?.name || "CRM User"}
            </div>

            <div style={{ height: "1px", background: "#f1f5f9", margin: "4px 0" }} />

            {employeeSummaryData && (
              <div style={{ display: "grid", gap: "6px", marginTop: "2px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#6b7280" }}>Employee ID</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937" }}>{employeeSummaryData.employeeId || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#6b7280" }}>Department</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right" }}>{employeeSummaryData.department || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#6b7280" }}>Role</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right" }}>{employeeSummaryData.role?.name || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#6b7280" }}>Contact</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right" }}>{employeeSummaryData.phone || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#6b7280" }}>Joining Date</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right" }}>
                    {employeeSummaryData.joiningDate ? new Date(employeeSummaryData.joiningDate).toLocaleDateString('en-IN') : "-"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#6b7280" }}>Email</span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#1f2937", textAlign: "right", wordBreak: "break-all", maxWidth: "220px" }}>{employeeSummaryData.email}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "10px", color: "#6b7280" }}>Leads Added</span>
                  <span style={{ fontSize: "10px", fontWeight: 750, color: "#166534" }}>{employeeSummaryData.totalLeadsAdded || 0}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowEmployeeSummaryModal(false)}
              style={{
                marginTop: "12px",
                border: "none",
                borderRadius: "999px",
                background: "linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%)",
                color: "#1f2937",
                padding: "8px 10px",
                fontSize: "10px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 3px 8px rgba(168, 230, 61, 0.2)",
                fontFamily: "'Poppins', 'Inter', 'Segoe UI', sans-serif"
              }}
            >
              Close Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyLeads;
