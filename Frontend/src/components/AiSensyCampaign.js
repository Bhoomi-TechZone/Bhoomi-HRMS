import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../api/axios';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// CRISP PROFESSIONAL SVG ICONS
// ─────────────────────────────────────────────────────────────────────────────

const WhatsAppIcon = ({ size = 18, color = "#25D366" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ color, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.77.781 2.8.781 3.182 0 5.768-2.587 5.768-5.766.001-3.181-2.585-5.767-5.772-5.772zm3.364 8.163c-.14.394-.715.728-1.026.77-.312.042-.716.082-2.146-.508-1.721-.71-2.83-2.476-2.916-2.59-.086-.114-.689-.918-.689-1.752 0-.834.437-1.246.592-1.417.156-.171.341-.214.455-.214.114 0 .228.001.328.006.105.005.245-.039.384.294.142.341.485 1.18.528 1.266.043.086.071.186.014.3-.057.114-.085.186-.17.286-.086.1-.18.223-.257.3-.086.086-.176.179-.076.35.1.171.444.733.953 1.186.655.584 1.207.765 1.378.851.171.086.271.071.371-.043.1-.114.428-.499.542-.67.114-.171.228-.143.385-.086.157.057.998.471 1.169.557.171.086.285.128.328.2.043.072.043.414-.097.808zM12.012 2c-5.506 0-9.985 4.479-9.985 9.985 0 1.761.458 3.483 1.332 5.006L2 22l5.163-1.319a9.925 9.925 0 004.849 1.304c5.506 0 9.988-4.479 9.988-9.985 0-5.506-4.482-10-9.988-10z" />
  </svg>
);

const DoubleCheckIcon = ({ size = 14, blue = true }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={blue ? "#34b7f1" : "#94a3b8"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M18 6L7 17l-5-5" />
    <path d="M22 10l-7.5 7.5L13 16" />
  </svg>
);

const SendIcon = ({ size = 16, color = "#ffffff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const SearchIcon = ({ size = 14, color = "#94a3b8" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const PaperclipIcon = ({ size = 15, color = "#64748b" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);

const PlusIcon = ({ size = 13, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CopyIcon = ({ size = 13, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = ({ size = 13, color = "#10b981" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const RefreshIcon = ({ size = 13, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const ExternalLinkIcon = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const MessagesTabIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const CampaignsTabIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

const ConfigTabIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

const ShieldIcon = ({ size = 15, color = "#10b981" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const TemplateIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const TrashIcon = ({ size = 13, color = "#ef4444" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const EditIcon = ({ size = 13, color = "#3b82f6" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const EyeIcon = ({ size = 13, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserCheckIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <polyline points="17 11 19 13 23 9" />
  </svg>
);

const UserPlusIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const UsersIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ChevronDownIcon = ({ size = 13, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ClockIcon = ({ size = 13, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TagIcon = ({ size = 13, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
    <line x1="7" y1="7" x2="7.01" y2="7" />
  </svg>
);

const SparklesIcon = ({ size = 14, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2z" />
  </svg>
);

const DEFAULT_MEDIA_URL = "https://d3jt6ku4g6z5l8.cloudfront.net/IMAGE/6353da2e153a147b991dd812/4958901_highanglekidcheatingschooltestmin.jpg";
const AISENSY_ENDPOINT = "https://backend.aisensy.com/campaign/t1/api/v2";

// Avatar colors
const AVATAR_PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#6366f1'];
function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// Initial CRM Contacts fallback
const INITIAL_CRM_CONTACTS = [
  {
    destination: '917985440421',
    name: 'Lead Gen Campaign',
    lastMessage: 'Ready for CRM outreach campaign',
    lastMessageTime: new Date().toISOString(),
    lastDirection: 'outbound',
    lastStatus: 'delivered',
    source: 'Campaign'
  },
  {
    destination: '2983292892',
    name: 'Rahul (Website AI Lead)',
    lastMessage: 'Custom Website Development (Budget: 10000, 15 days)',
    lastMessageTime: new Date(Date.now() - 3600000 * 1).toISOString(),
    lastDirection: 'inbound',
    lastStatus: 'read',
    source: 'Website AI Lead'
  },
  {
    destination: '17147099070',
    name: 'David Farley',
    lastMessage: 'Beauty & cosmetics lead inquiry',
    lastMessageTime: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastDirection: 'inbound',
    lastStatus: 'read',
    source: 'CRM Lead'
  },
  {
    destination: '233270000844',
    name: 'Akosua Frimpo',
    lastMessage: 'Requested services catalog & pricing',
    lastMessageTime: new Date(Date.now() - 3600000 * 4).toISOString(),
    lastDirection: 'inbound',
    lastStatus: 'read',
    source: 'CRM Lead'
  },
  {
    destination: '233230630022',
    name: 'Samuel Asante',
    lastMessage: 'Website development quote discussed',
    lastMessageTime: new Date(Date.now() - 3600000 * 7).toISOString(),
    lastDirection: 'outbound',
    lastStatus: 'delivered',
    source: 'CRM Lead'
  },
  {
    destination: '971526342282',
    name: 'Mohammed Al-Mansoor',
    lastMessage: 'Inquiry on IT software automation',
    lastMessageTime: new Date(Date.now() - 3600000 * 12).toISOString(),
    lastDirection: 'inbound',
    lastStatus: 'read',
    source: 'CRM Lead'
  },
  {
    destination: '919876543210',
    name: 'Rahul Verma',
    lastMessage: 'Can you please share pricing for custom CRM?',
    lastMessageTime: new Date(Date.now() - 3600000 * 24).toISOString(),
    lastDirection: 'inbound',
    lastStatus: 'read',
    source: 'Website Lead'
  }
];

export default function AiSensyCampaign({ embedded = true, isAdmin: propIsAdmin }) {
  const { user } = useAuth();

  const isAdmin = useMemo(() => {
    if (typeof propIsAdmin === 'boolean') return propIsAdmin;
    const roleNormalized = (typeof user?.role === 'object' && user?.role !== null ? user.role.name : user?.role || '').toString().toLowerCase().trim();
    const des = (user?.designation || '').toString().toLowerCase().trim();
    const dept = (user?.department || '').toString().toLowerCase().trim();
    const em = (user?.email || '').toString().toLowerCase().trim();
    return (
      roleNormalized === 'admin' ||
      roleNormalized.includes('admin') ||
      roleNormalized.includes('superadmin') ||
      roleNormalized.includes('director') ||
      des.includes('admin') ||
      des.includes('director') ||
      dept === 'administration' ||
      em.startsWith('admin@') ||
      Boolean(user?.isAdmin)
    );
  }, [propIsAdmin, user]);

  // Active horizontal tab
  const [activeTab, setActiveTab] = useState('messages'); // 'messages' | 'campaigns' | 'configuration'

  // Safety: Prevent non-admin users from viewing configuration tab
  useEffect(() => {
    if (!isAdmin && activeTab === 'configuration') {
      setActiveTab('messages');
    }
  }, [isAdmin, activeTab]);

  // Messages state
  const [conversations, setConversations] = useState(INITIAL_CRM_CONTACTS);
  const [convLoading, setConvLoading] = useState(false);
  const [selectedDest, setSelectedDest] = useState('917985440421');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [newMessageText, setNewMessageText] = useState('');
  const [newChatMediaUrl, setNewChatMediaUrl] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [searchNumber, setSearchNumber] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [showNewNumberModal, setShowNewNumberModal] = useState(false);
  const [newPhoneInput, setNewPhoneInput] = useState('');
  const [newNameInput, setNewNameInput] = useState('');
  const [chatError, setChatError] = useState(null);
  const [chatCampaignName, setChatCampaignName] = useState('CRM');
  const messagesEndRef = useRef(null);

  // Template Management State
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showTemplatePreviewBar, setShowTemplatePreviewBar] = useState(true);

  // Campaign Form State
  const [formData, setFormData] = useState({
    campaignName: 'CRM',
    destination: '917985440421',
    userName: 'Lead Gen Campaign',
    firstName: 'user',
    source: 'new-landing-page form',
    includeMedia: true,
    mediaUrl: DEFAULT_MEDIA_URL,
    mediaFilename: 'sample_media',
    customApiKey: ''
  });

  const [sending, setSending] = useState(false);
  const [resultBanner, setResultBanner] = useState(null);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState('curl');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Logs & Config
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
  const [logFilter, setLogFilter] = useState('ALL');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState('ALL');
  const [campaignSearchText, setCampaignSearchText] = useState('');
  const [showCustomCampaignInput, setShowCustomCampaignInput] = useState(false);
  const [previewChatLog, setPreviewChatLog] = useState(null);
  const [messagesCampaignFilter, setMessagesCampaignFilter] = useState('ALL');
  const [config, setConfig] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Sales Role Employees & Admin Assignment State
  const [salesEmployees, setSalesEmployees] = useState([]);
  const [salesEmployeesLoading, setSalesEmployeesLoading] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningCampaign, setAssigningCampaign] = useState('CRM');
  const [selectedAssignees, setSelectedAssignees] = useState([]);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState(null);
  const [assignSearch, setAssignSearch] = useState('');

  // Fetch Config (Admin Only)
  const fetchConfig = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await api.get('/aisensy/config');
      if (res.data?.success) setConfig(res.data);
    } catch (err) {
      console.warn('AiSensy config load note:', err);
    }
  }, [isAdmin]);

  // Fetch Sales Role Employees (for Admin Assignment)
  const fetchSalesEmployees = useCallback(async () => {
    try {
      setSalesEmployeesLoading(true);
      const res = await api.get('/aisensy/sales-employees');
      if (res.data?.success && Array.isArray(res.data.employees)) {
        setSalesEmployees(res.data.employees);
      }
    } catch (err) {
      console.warn('Failed to load sales employees:', err);
    } finally {
      setSalesEmployeesLoading(false);
    }
  }, []);

  const handleOpenAssignModal = (campaignName) => {
    fetchSalesEmployees();
    const cName = campaignName || (selectedCampaignFilter !== 'ALL' ? selectedCampaignFilter : (availableCampaigns[0]?.campaignName || 'CRM'));
    setAssigningCampaign(cName);
    const matched = templates.find((t) => (t.campaignName || '').toLowerCase() === cName.toLowerCase());
    if (matched && Array.isArray(matched.assignedTo)) {
      setSelectedAssignees(matched.assignedTo.map((u) => (typeof u === 'object' && u ? String(u._id || u.id) : String(u))));
    } else {
      setSelectedAssignees([]);
    }
    setAssignSearch('');
    setShowAssignModal(true);
  };

  const handleSaveAssignment = async () => {
    if (!assigningCampaign) return;
    try {
      setSavingAssignment(true);
      const res = await api.post('/aisensy/campaigns/assign', {
        campaignName: assigningCampaign,
        assignedTo: selectedAssignees
      });
      if (res.data?.success) {
        setAssignSuccessMsg(`Campaign "${assigningCampaign}" assigned to ${selectedAssignees.length} sales member(s)!`);
        setTimeout(() => setAssignSuccessMsg(null), 3500);
        await fetchTemplates();
        setShowAssignModal(false);
      }
    } catch (err) {
      console.error('Assignment save error:', err);
      alert(err.response?.data?.message || 'Failed to save campaign assignment.');
    } finally {
      setSavingAssignment(false);
    }
  };

  // Fetch Logs
  const fetchLogs = useCallback(async () => {
    try {
      setLogsLoading(true);
      const res = await api.get('/aisensy/logs');
      if (res.data?.success) {
        setLogs(res.data.logs || []);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      console.error('AiSensy logs note:', err);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // Fetch Conversations
  const fetchConversations = useCallback(async () => {
    try {
      setConvLoading(true);
      const res = await api.get('/aisensy/conversations');
      if (res.data?.success && Array.isArray(res.data.conversations) && res.data.conversations.length > 0) {
        const map = new Map();
        for (const c of res.data.conversations) map.set(c.destination, c);
        for (const init of INITIAL_CRM_CONTACTS) {
          if (!map.has(init.destination)) map.set(init.destination, init);
        }
        setConversations(Array.from(map.values()));
      }
    } catch (err) {
      console.error('Conversations note:', err);
    } finally {
      setConvLoading(false);
    }
  }, []);

  // Fetch Messages for destination
  const fetchMessagesForDest = useCallback(async (destination) => {
    if (!destination) return;
    try {
      setChatLoading(true);
      const res = await api.get(`/aisensy/messages/${destination}`);
      if (res.data?.success && Array.isArray(res.data.messages) && res.data.messages.length > 0) {
        setChatMessages(res.data.messages);
      } else {
        setChatMessages([
          {
            _id: 'seed-' + destination,
            conversationId: destination,
            destination: destination,
            contactName: 'Lead Gen Campaign',
            direction: 'outbound',
            messageType: 'text',
            text: `Hi! This is Bhoomi TechZone CRM. Connected via AiSensy WhatsApp Cloud. How can we assist you?`,
            status: 'delivered',
            createdAt: new Date().toISOString()
          }
        ]);
      }
    } catch (err) {
      console.error('Messages note:', err);
    } finally {
      setChatLoading(false);
    }
  }, []);

  // Fetch Templates from Backend
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/aisensy/templates');
      if (res.data?.success && Array.isArray(res.data.templates)) {
        setTemplates(res.data.templates);
        // Default to first template or default template if not set
        setSelectedTemplate((prev) => {
          if (prev) return prev;
          const def = res.data.templates.find((t) => t.isDefault) || res.data.templates[0];
          if (def) setChatCampaignName(def.campaignName || 'CRM');
          return def || null;
        });
      }
    } catch (err) {
      console.warn('AiSensy templates load note:', err);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchConfig();
    }
    fetchSalesEmployees();
    fetchLogs();
    fetchConversations();
    fetchTemplates();
  }, [isAdmin, fetchConfig, fetchSalesEmployees, fetchLogs, fetchConversations, fetchTemplates]);

  useEffect(() => {
    if (selectedDest) fetchMessagesForDest(selectedDest);
  }, [selectedDest, fetchMessagesForDest]);

  // Scroll messages separately
  useEffect(() => {
    if (activeTab === 'messages' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const activeContact = useMemo(() => {
    return (
      conversations.find((c) => c.destination === selectedDest) || {
        destination: selectedDest || '917985440421',
        name: 'Lead Gen Campaign',
        source: 'Campaign'
      }
    );
  }, [conversations, selectedDest]);

  // For non-admin employees: find the names of all campaigns assigned to this user
  const myAssignedCampaignNames = useMemo(() => {
    if (isAdmin) return [];
    const currentUserId = String(user?._id || user?.id || '');
    if (!currentUserId) return [];
    return templates
      .filter((t) => {
        const assignees = t.assignedTo || [];
        return assignees.some((a) => {
          const aId = typeof a === 'object' && a !== null ? String(a._id || a.id) : String(a);
          return aId === currentUserId;
        });
      })
      .map((t) => (t.campaignName || '').trim().toLowerCase())
      .filter(Boolean);
  }, [isAdmin, user, templates]);

  const hasAssignedCampaigns = isAdmin || myAssignedCampaignNames.length > 0;

  // Combined list of all available campaigns from templates & logs
  const availableCampaigns = useMemo(() => {
    const map = new Map();

    // 1. Templates (configured templates with rich display names)
    templates.forEach((t) => {
      const cName = (t.campaignName || '').trim();
      if (!cName) return;
      if (!isAdmin && !myAssignedCampaignNames.includes(cName.toLowerCase())) return;
      if (!map.has(cName)) {
        map.set(cName, {
          campaignName: cName,
          displayName: t.name || cName,
          category: t.category || 'MARKETING',
          headerType: t.headerType || 'NONE',
          headerMediaUrl: t.headerMediaUrl || '',
          body: t.body || '',
          templateId: t._id,
          assignedTo: t.assignedTo || []
        });
      }
    });

    // 2. Logs (any campaigns that have sent dispatches)
    logs.forEach((l) => {
      const cName = (l.campaignName || '').trim();
      if (!cName) return;
      if (!isAdmin && !myAssignedCampaignNames.includes(cName.toLowerCase())) return;
      if (!map.has(cName)) {
        map.set(cName, {
          campaignName: cName,
          displayName: cName,
          category: 'CAMPAIGN',
          headerType: l.media?.url ? 'IMAGE' : 'NONE',
          headerMediaUrl: l.media?.url || '',
          body: l.responseMessage || '',
          templateId: null
        });
      }
    });

    // 3. Fallback standard default campaigns for Admin only
    if (isAdmin) {
      const defaultFallbacks = [
        { campaignName: 'CRM', displayName: 'Diwali Special Business Offer (CRM)' },
        { campaignName: 'welcome_lead', displayName: 'Welcome & CRM Introduction' },
        { campaignName: 'discovery_call', displayName: 'Quick Discovery Call Invitation' },
        { campaignName: 'proposal_followup', displayName: 'Proposal & Scope Follow-up' },
        { campaignName: 'custom_message', displayName: 'Direct Agent Custom Message' }
      ];
      defaultFallbacks.forEach((def) => {
        if (!map.has(def.campaignName)) {
          map.set(def.campaignName, def);
        }
      });
    }

    return Array.from(map.values());
  }, [templates, logs, isAdmin, myAssignedCampaignNames]);

  // Helper to get assigned sales users for any campaign
  const getCampaignAssignees = useCallback((cName) => {
    if (!cName) return [];
    const target = cName.trim().toLowerCase();
    const matched = templates.find((t) => (t.campaignName || '').trim().toLowerCase() === target);
    return matched?.assignedTo || [];
  }, [templates]);

  // Filtered sales employees for Admin campaign assignment
  const filteredSalesEmployees = useMemo(() => {
    if (!assignSearch.trim()) return salesEmployees;
    const q = assignSearch.toLowerCase().trim();
    return salesEmployees.filter((emp) => {
      const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase();
      const email = (emp.email || '').toLowerCase();
      const desig = (emp.designation || '').toLowerCase();
      const role = (typeof emp.role === 'object' && emp.role !== null ? emp.role.name : emp.role || '').toLowerCase();
      const dept = (emp.department || '').toLowerCase();
      const empId = (emp.employeeId || '').toLowerCase();
      return name.includes(q) || email.includes(q) || desig.includes(q) || role.includes(q) || dept.includes(q) || empId.includes(q);
    });
  }, [salesEmployees, assignSearch]);

  const filteredConversations = useMemo(() => {
    if (!isAdmin && myAssignedCampaignNames.length === 0) return [];

    return conversations.filter((c) => {
      // Non-admin restriction: only show conversations belonging to assigned campaigns
      if (!isAdmin) {
        const cCamp = (c.campaignName || '').toLowerCase().trim();
        const lastMsg = (c.lastMessage || '').toLowerCase();
        const cleanDest = (c.destination || '').replace(/[^\d]/g, '');
        const belongsToMyCampaign =
          (cCamp && myAssignedCampaignNames.includes(cCamp)) ||
          myAssignedCampaignNames.some((camp) => lastMsg.includes(`campaign: ${camp}`)) ||
          logs.some((l) => (l.destination || '').replace(/[^\d]/g, '') === cleanDest && myAssignedCampaignNames.includes((l.campaignName || '').toLowerCase().trim()));
        if (!belongsToMyCampaign) return false;
      }

      const q = searchNumber.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.destination.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q));

      if (!matchSearch) return false;
      if (filterCategory === 'CRM') return c.source?.includes('Lead') || c.source?.includes('Contact');
      if (filterCategory === 'CAMPAIGN') return c.source?.includes('Campaign');

      // Filter by Campaign in Messages Tab
      if (messagesCampaignFilter !== 'ALL') {
        const targetCamp = messagesCampaignFilter.toLowerCase().trim();
        const cCamp = (c.campaignName || '').toLowerCase().trim();
        const lastMsg = (c.lastMessage || '').toLowerCase();
        const cleanDest = (c.destination || '').replace(/[^\d]/g, '');
        const isMatched =
          cCamp === targetCamp ||
          lastMsg.includes(`campaign: ${targetCamp}`) ||
          logs.some((l) => (l.destination || '').replace(/[^\d]/g, '') === cleanDest && (l.campaignName || 'CRM').toLowerCase().trim() === targetCamp);
        if (!isMatched) return false;
      }

      return true;
    });
  }, [conversations, searchNumber, filterCategory, messagesCampaignFilter, logs, isAdmin, myAssignedCampaignNames]);

  const formatPhone = (phone) => {
    if (!phone) return '';
    const digits = String(phone).replace(/[^\d]/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return `+${digits}`;
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!newMessageText.trim() && !newChatMediaUrl.trim()) return;

    const messageText = newMessageText.trim();
    const media = newChatMediaUrl.trim();
    setNewMessageText('');
    setNewChatMediaUrl('');
    setShowMediaInput(false);
    setChatError(null);

    const optimisticMsg = {
      _id: 'temp-' + Date.now(),
      conversationId: selectedDest,
      destination: selectedDest,
      contactName: activeContact.name || 'User',
      direction: 'outbound',
      messageType: media ? 'media' : 'text',
      text: messageText,
      mediaUrl: media,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      setSendingChat(true);
      const res = await api.post('/aisensy/messages/send', {
        destination: selectedDest,
        text: messageText,
        mediaUrl: media,
        contactName: activeContact.name || 'User',
        campaignName: chatCampaignName || 'CRM',
        isTemplate: false
      });

      if (res.data?.success && res.data.data) {
        setChatMessages((prev) =>
          prev.map((m) => (m._id === optimisticMsg._id ? res.data.data : m))
        );
        fetchConversations();
        fetchLogs();
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      const errDetail = err.response?.data?.message || err.response?.data?.errorMessage || err.message || 'AiSensy dispatch failed';
      setChatError(errDetail);
      setChatMessages((prev) =>
        prev.map((m) => (m._id === optimisticMsg._id ? { ...m, status: 'failed', error: errDetail } : m))
      );
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendTemplate = async (templateToSend = selectedTemplate) => {
    if (!templateToSend) return;
    const recipientName = activeContact.name || 'User';
    const resolvedBody = (templateToSend.body || '')
      .replace(/\{FirstName\}/g, recipientName)
      .replace(/\{name\}/gi, recipientName)
      .replace(/\$FirstName/g, recipientName)
      .replace(/\{\{1\}\}/g, recipientName);

    const optimisticMsg = {
      _id: 'temp-' + Date.now(),
      conversationId: selectedDest,
      destination: selectedDest,
      contactName: recipientName,
      direction: 'outbound',
      messageType: templateToSend.headerMediaUrl ? 'media' : 'text',
      text: resolvedBody,
      mediaUrl: templateToSend.headerMediaUrl || '',
      campaignName: templateToSend.campaignName || 'CRM',
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setChatMessages((prev) => [...prev, optimisticMsg]);
    setChatError(null);

    try {
      setSendingChat(true);
      const res = await api.post('/aisensy/messages/send', {
        destination: selectedDest,
        text: resolvedBody,
        mediaUrl: templateToSend.headerMediaUrl || '',
        contactName: recipientName,
        campaignName: templateToSend.campaignName || 'CRM',
        templateId: templateToSend._id,
        templateBody: templateToSend.body,
        isTemplate: true
      });

      if (res.data?.success && res.data.data) {
        setChatMessages((prev) =>
          prev.map((m) => (m._id === optimisticMsg._id ? res.data.data : m))
        );
        fetchConversations();
        fetchLogs();
      }
    } catch (err) {
      console.error('Failed to send template message:', err);
      const errDetail = err.response?.data?.message || err.response?.data?.errorMessage || err.message || 'Template dispatch failed';
      setChatError(errDetail);
      setChatMessages((prev) =>
        prev.map((m) => (m._id === optimisticMsg._id ? { ...m, status: 'failed', error: errDetail } : m))
      );
    } finally {
      setSendingChat(false);
    }
  };

  const handleSaveTemplate = async (templateData) => {
    try {
      if (templateData._id) {
        const res = await api.put(`/aisensy/templates/${templateData._id}`, templateData);
        if (res.data?.success) {
          fetchTemplates();
          if (selectedTemplate?._id === templateData._id) {
            setSelectedTemplate(res.data.template);
          }
          setTemplateModalMode('list');
        }
      } else {
        const res = await api.post('/aisensy/templates', templateData);
        if (res.data?.success) {
          fetchTemplates();
          setSelectedTemplate(res.data.template);
          setChatCampaignName(res.data.template.campaignName || 'CRM');
          setTemplateModalMode('list');
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/aisensy/templates/${id}`);
      fetchTemplates();
      if (selectedTemplate?._id === id) {
        setSelectedTemplate(templates.find((t) => t._id !== id) || null);
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete template');
    }
  };

  const handleStartNewChat = () => {
    const clean = newPhoneInput.replace(/[^\d]/g, '').trim();
    if (!clean || clean.length < 8) {
      alert('Please enter a valid phone number with country code (e.g. 917985440421)');
      return;
    }

    const newContact = {
      destination: clean,
      name: newNameInput.trim() || `Lead ${clean.slice(-4)}`,
      lastMessage: 'Conversation started',
      lastMessageTime: new Date().toISOString(),
      lastDirection: 'outbound',
      lastStatus: 'delivered',
      source: 'Direct Chat'
    };

    setConversations((prev) => [newContact, ...prev.filter((c) => c.destination !== clean)]);
    setSelectedDest(clean);
    setShowNewNumberModal(false);
    setNewPhoneInput('');
    setNewNameInput('');
  };

  const handleJumpToCampaign = (dest) => {
    setFormData((prev) => ({
      ...prev,
      destination: dest,
      firstName: activeContact.name || 'user'
    }));
    setActiveTab('campaigns');
  };

  const currentPayload = useMemo(() => {
    return {
      apiKey: formData.customApiKey.trim() || "<YOUR_API_KEY>",
      campaignName: formData.campaignName.trim() || "CRM",
      destination: formData.destination.trim().replace(/[^\d]/g, '') || "917985440421",
      userName: formData.userName.trim() || "Lead Gen Campaign",
      templateParams: ["$FirstName"],
      source: formData.source.trim() || "new-landing-page form",
      media: formData.includeMedia ? {
        url: formData.mediaUrl.trim() || DEFAULT_MEDIA_URL,
        filename: formData.mediaFilename.trim() || "sample_media"
      } : {},
      buttons: [],
      carouselCards: [],
      location: {},
      attributes: {},
      paramsFallbackValue: {
        FirstName: formData.firstName.trim() || "user"
      }
    };
  }, [formData]);

  const curlCommand = useMemo(() => {
    const jsonStr = JSON.stringify(currentPayload, null, 2);
    return `curl -X POST -H "Content-Type: application/json" -d '${jsonStr}'  ${AISENSY_ENDPOINT}`;
  }, [currentPayload]);

  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(currentPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleCopyWebhook = () => {
    if (config?.webhookUrl) {
      navigator.clipboard.writeText(config.webhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    }
  };

  const handleSendCampaign = async (e) => {
    if (e) e.preventDefault();
    if (!formData.destination.trim()) {
      alert('Please enter a destination phone number with country code (e.g. 917985440421)');
      return;
    }

    try {
      setSending(true);
      setResultBanner(null);

      const res = await api.post('/aisensy/send', currentPayload);

      if (res.data?.success) {
        setResultBanner({
          type: 'success',
          message: res.data.message || 'WhatsApp Campaign Dispatched Successfully!',
          statusCode: res.data.statusCode || 200,
          details: res.data.data
        });
      } else {
        setResultBanner({
          type: 'error',
          message: res.data?.message || 'Failed to dispatch campaign',
          statusCode: res.data?.statusCode || 500,
          details: res.data?.data
        });
      }
      fetchLogs();
      fetchConversations();
    } catch (err) {
      setResultBanner({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to connect to AiSensy server',
        statusCode: err.response?.status || 500,
        details: err.response?.data
      });
      fetchLogs();
    } finally {
      setSending(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTestingConnection(true);
      setTestResult(null);
      const res = await api.post('/aisensy/test-connection', {
        apiKey: formData.customApiKey.trim() || undefined
      });
      setTestResult({
        success: res.data?.success,
        message: res.data?.message || 'AiSensy token verified successfully!',
        details: res.data?.data
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || 'Connection test failed',
        details: err.response?.data
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Filtered campaign chats & logs based on selected campaign, status, and search query
  const filteredLogs = useMemo(() => {
    if (!isAdmin && myAssignedCampaignNames.length === 0) return [];

    return logs.filter((log) => {
      // Non-admin restriction: only show logs belonging to assigned campaigns
      if (!isAdmin) {
        const logCamp = (log.campaignName || 'CRM').trim().toLowerCase();
        if (!myAssignedCampaignNames.includes(logCamp)) return false;
      }

      // 1. Campaign Filter
      if (selectedCampaignFilter !== 'ALL') {
        const cName = (log.campaignName || 'CRM').trim().toLowerCase();
        if (cName !== selectedCampaignFilter.trim().toLowerCase()) {
          return false;
        }
      }
      // 2. Status Filter
      if (logFilter !== 'ALL' && log.status !== logFilter) {
        return false;
      }
      // 3. Search query
      if (campaignSearchText && campaignSearchText.trim()) {
        const q = campaignSearchText.trim().toLowerCase();
        const dest = (log.destination || '').toLowerCase();
        const user = (log.userName || log.paramsFallbackValue?.FirstName || '').toLowerCase();
        const msg = (log.responseMessage || '').toLowerCase();
        if (!dest.includes(q) && !user.includes(q) && !msg.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedCampaignFilter, logFilter, campaignSearchText, isAdmin, myAssignedCampaignNames]);

  // Dynamic stats reflecting the selected campaign
  const campaignStats = useMemo(() => {
    let pool = logs;
    if (!isAdmin) {
      if (myAssignedCampaignNames.length === 0) {
        return { total: 0, success: 0, failed: 0 };
      }
      pool = logs.filter((l) => myAssignedCampaignNames.includes((l.campaignName || 'CRM').trim().toLowerCase()));
    }

    const relevantLogs = selectedCampaignFilter === 'ALL'
      ? pool
      : pool.filter((l) => (l.campaignName || 'CRM').trim().toLowerCase() === selectedCampaignFilter.trim().toLowerCase());

    const total = relevantLogs.length;
    const success = relevantLogs.filter((l) => l.status === 'SUCCESS').length;
    const failed = relevantLogs.filter((l) => l.status === 'FAILED').length;

    return { total, success, failed };
  }, [logs, selectedCampaignFilter, isAdmin, myAssignedCampaignNames]);

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '16px 20px',
        boxSizing: 'border-box',
        background: '#f8fafc',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        color: '#0f172a'
      }}
    >
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. MINIMAL HEADER                                                          */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 12,
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(37, 211, 102, 0.28)',
              color: '#fff'
            }}
          >
            <WhatsAppIcon size={20} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                AiSensy
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: 12,
                  background: '#ecfdf5',
                  color: '#059669',
                  border: '1px solid #a7f3d0'
                }}
              >
                ● SENSY_API_KEY Active
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '1px 7px',
                  borderRadius: 12,
                  background: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe'
                }}
              >
                WhatsApp Cloud v2
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0', fontWeight: 400 }}>
              Live WhatsApp 2-way conversational outreach, campaign dispatch & CRM integration
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={handleCopyCurl}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 6,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              fontSize: '11.5px',
              fontWeight: 600,
              color: copiedCurl ? '#10b981' : '#334155',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(15,23,42,0.03)',
              transition: 'all 0.15s ease'
            }}
            title="Copy exact cURL command"
          >
            {copiedCurl ? <CheckIcon size={12} color="#10b981" /> : <CopyIcon size={12} color="#64748b" />}
            <span>{copiedCurl ? 'Copied' : 'Copy cURL'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchConversations();
              fetchLogs();
              if (selectedDest) fetchMessagesForDest(selectedDest);
            }}
            disabled={convLoading || logsLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 6,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              fontSize: '11.5px',
              fontWeight: 600,
              color: '#334155',
              cursor: (convLoading || logsLoading) ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(15,23,42,0.03)'
            }}
          >
            <RefreshIcon size={12} className={(convLoading || logsLoading) ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <NotificationBell filterType="CRM" />
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. SLICK HORIZONTAL TABS                                                   */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: '#ffffff',
          padding: '3px',
          borderRadius: 8,
          border: '1px solid #e2e8f0',
          marginBottom: 12,
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          width: 'fit-content',
          flexShrink: 0
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'messages' ? '#10b981' : 'transparent',
            color: activeTab === 'messages' ? '#ffffff' : '#64748b',
            boxShadow: activeTab === 'messages' ? '0 1px 3px rgba(16, 185, 129, 0.25)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <MessagesTabIcon size={14} />
          <span>Messages</span>
          <span
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 8,
              background: activeTab === 'messages' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
              color: activeTab === 'messages' ? '#ffffff' : '#475569'
            }}
          >
            {conversations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            border: 'none',
            background: activeTab === 'campaigns' ? '#10b981' : 'transparent',
            color: activeTab === 'campaigns' ? '#ffffff' : '#64748b',
            boxShadow: activeTab === 'campaigns' ? '0 1px 3px rgba(16, 185, 129, 0.25)' : 'none',
            transition: 'all 0.15s ease'
          }}
        >
          <CampaignsTabIcon size={14} />
          <span>Campaigns</span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 8,
              background: activeTab === 'campaigns' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
              color: activeTab === 'campaigns' ? '#ffffff' : '#475569'
            }}
          >
            v2
          </span>
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('configuration')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: 'none',
              background: activeTab === 'configuration' ? '#10b981' : 'transparent',
              color: activeTab === 'configuration' ? '#ffffff' : '#64748b',
              boxShadow: activeTab === 'configuration' ? '0 1px 3px rgba(16, 185, 129, 0.25)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <ConfigTabIcon size={14} />
            <span>Configuration</span>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: config?.isConfigured ? '#10b981' : '#f59e0b'
              }}
            />
          </button>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. TAB 1: MESSAGES (SEPARATELY SCROLLABLE WHATSAPP WORKBENCH)             */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'messages' && (
        !hasAssignedCampaigns ? (
          <div
            style={{
              flex: 1,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: '72px 28px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '10px 0 24px'
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                color: '#64748b'
              }}
            >
              <MessagesTabIcon size={28} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
              You have not any assigned campaign yet
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '460px', margin: 0, lineHeight: 1.55 }}>
              No WhatsApp campaign chats are accessible because you have not been assigned to any campaigns. Contact your administrator to assign a campaign to your account.
            </p>
          </div>
        ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0, // Essential for flex-child independent scrolling!
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
            overflow: 'hidden'
          }}
        >
          {/* ── Left Pane: Numbers & Conversations List (Independent Scroll) ── */}
          <div
            style={{
              borderRight: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            {/* Conversations Header */}
            <div
              style={{
                padding: '12px 14px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>WhatsApp Chats</span>
                <span style={{ fontSize: '10.5px', fontWeight: 600, background: '#f1f5f9', color: '#64748b', padding: '1px 6px', borderRadius: 8 }}>
                  {conversations.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowNewNumberModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 9px',
                  borderRadius: 6,
                  background: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <PlusIcon size={12} color="#fff" />
                <span>New Chat</span>
              </button>
            </div>

            {/* Search Box */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  background: '#f8fafc',
                  borderRadius: 6,
                  padding: '5px 9px',
                  border: '1px solid #e2e8f0'
                }}
              >
                <SearchIcon size={13} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search numbers or names..."
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '11.5px',
                    width: '100%',
                    color: '#0f172a'
                  }}
                />
                {searchNumber && (
                  <button
                    type="button"
                    onClick={() => setSearchNumber('')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '11px', padding: 0 }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Chips */}
              <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'CRM', label: 'CRM Leads' },
                  { id: 'CAMPAIGN', label: 'Campaigns' }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterCategory(f.id)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: '10.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      background: filterCategory === f.id ? '#0f172a' : '#f1f5f9',
                      color: filterCategory === f.id ? '#ffffff' : '#64748b'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Campaign Filter Dropdown in Messages Tab */}
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>Campaign:</span>
                <select
                  value={messagesCampaignFilter}
                  onChange={(e) => setMessagesCampaignFilter(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '2px 6px',
                    borderRadius: 4,
                    border: '1px solid #cbd5e1',
                    fontSize: '10.5px',
                    background: '#ffffff',
                    color: '#0f172a',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">All Campaigns</option>
                  {availableCampaigns.map((c) => (
                    <option key={c.campaignName} value={c.campaignName}>
                      {c.campaignName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Conversations Scrollable List */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto'
              }}
            >
              {filteredConversations.map((c) => {
                const isSelected = c.destination === selectedDest;
                const avatarBg = getAvatarColor(c.name || c.destination);
                return (
                  <div
                    key={c.destination}
                    onClick={() => setSelectedDest(c.destination)}
                    style={{
                      padding: '10px 12px',
                      borderBottom: '1px solid #f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 9,
                      cursor: 'pointer',
                      background: isSelected ? '#f0fdf4' : '#ffffff',
                      borderLeft: isSelected ? '3px solid #10b981' : '3px solid transparent',
                      transition: 'background 0.1s ease'
                    }}
                  >
                    {/* Modern Avatar */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: avatarBg,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '12.5px',
                        flexShrink: 0,
                        position: 'relative'
                      }}
                    >
                      {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: -1,
                          right: -1,
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: '#10b981',
                          border: '1.5px solid #ffffff'
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: 700,
                            color: isSelected ? '#047857' : '#0f172a',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '150px'
                          }}
                        >
                          {c.name || 'Contact'}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {formatTime(c.lastMessageTime)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', fontFamily: 'monospace' }}>
                          {formatPhone(c.destination)}
                        </span>
                        {c.source && (
                          <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: 3, background: '#f1f5f9', color: '#64748b' }}>
                            {c.source}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                          marginTop: 2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {c.lastDirection === 'outbound' && (
                          <DoubleCheckIcon size={11} blue={c.lastStatus === 'read' || c.lastStatus === 'delivered'} />
                        )}{' '}
                        {c.lastMessage}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right Pane: Active WhatsApp Chat Window (Independent Scroll) ── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#f8fafc',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Chat Header (Fixed at top) */}
            <div
              style={{
                padding: '10px 16px',
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: getAvatarColor(activeContact.name),
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '13.5px'
                  }}
                >
                  {activeContact.name ? activeContact.name.charAt(0).toUpperCase() : 'W'}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      {activeContact.name || 'WhatsApp Contact'}
                    </span>
                    <span style={{ fontSize: '11.5px', fontFamily: 'monospace', color: '#059669', fontWeight: 600 }}>
                      {formatPhone(selectedDest)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
                    <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: 500 }}>
                      AiSensy WhatsApp Cloud Connected
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Campaign Template Quick Selector & Dropdown */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#166534',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    title="Select WhatsApp Template"
                  >
                    <TemplateIcon size={12} color="#166534" />
                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedTemplate ? selectedTemplate.name : 'Select Template'}
                    </span>
                    <span style={{ fontSize: '9px', marginLeft: 2 }}>▾</span>
                  </button>

                  {/* Template Dropdown Menu */}
                  {showTemplateDropdown && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 4,
                        width: '290px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12)',
                        zIndex: 100,
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{ padding: '8px 10px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>WhatsApp Templates</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowTemplateDropdown(false);
                            setTemplateModalMode('create');
                            setEditingTemplate(null);
                            setShowTemplateModal(true);
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#10b981',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          <PlusIcon size={10} color="#10b981" /> Add
                        </button>
                      </div>

                      <div style={{ maxHeight: '210px', overflowY: 'auto' }}>
                        {templates.map((tpl) => (
                          <div
                            key={tpl._id}
                            onClick={() => {
                              setSelectedTemplate(tpl);
                              setChatCampaignName(tpl.campaignName || 'CRM');
                              setShowTemplatePreviewBar(true);
                              setShowTemplateDropdown(false);
                            }}
                            style={{
                              padding: '8px 10px',
                              borderBottom: '1px solid #f8fafc',
                              cursor: 'pointer',
                              background: selectedTemplate?._id === tpl._id ? '#ecfdf5' : '#ffffff',
                              transition: 'background 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11.5px', fontWeight: 600, color: selectedTemplate?._id === tpl._id ? '#047857' : '#0f172a' }}>
                                {tpl.name}
                              </span>
                              <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: 3, background: '#f1f5f9', color: '#64748b' }}>
                                {tpl.campaignName}
                              </span>
                            </div>
                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tpl.body.slice(0, 45)}...
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ padding: '7px 10px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowTemplateDropdown(false);
                            setTemplateModalMode('list');
                            setShowTemplateModal(true);
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#059669',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <TemplateIcon size={12} color="#059669" />
                          <span>Manage & Customize Templates</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTemplateModalMode('list');
                    setShowTemplateModal(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 9px',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                  title="Open Template Manager"
                >
                  <TemplateIcon size={12} color="#64748b" />
                  <span>Templates</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleJumpToCampaign(selectedDest)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <CampaignsTabIcon size={12} />
                  <span>Send Campaign</span>
                </button>

                <a
                  href={`https://wa.me/${selectedDest}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: '#ffffff',
                    color: '#0f172a',
                    border: '1px solid #e2e8f0',
                    textDecoration: 'none',
                    fontSize: '11px',
                    fontWeight: 600
                  }}
                >
                  <WhatsAppIcon size={12} />
                  <span>WhatsApp Web</span>
                  <ExternalLinkIcon size={10} />
                </a>
              </div>
            </div>

            {/* AiSensy Error Banner if last dispatch had an issue */}
            {chatError && (
              <div
                style={{
                  padding: '7px 14px',
                  background: '#fef2f2',
                  borderBottom: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: '#991b1b',
                  fontSize: '11px',
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '13px' }}>⚠️</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <strong>AiSensy WhatsApp API Notice:</strong> {chatError}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setChatError(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#991b1b',
                    fontWeight: 700,
                    padding: '0 4px',
                    fontSize: '12px'
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Chat Messages Body (SEPARATELY SCROLLABLE!) */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                background: '#f8fafc'
              }}
            >
              {/* Date divider */}
              <div style={{ textAlign: 'center', margin: '2px 0 6px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#64748b',
                    background: '#f1f5f9',
                    padding: '2px 9px',
                    borderRadius: 10
                  }}
                >
                  Today • Official WhatsApp API Communication
                </span>
              </div>

              {chatLoading ? (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '12px' }}>
                  <RefreshIcon size={15} className="spin" />
                  <span style={{ marginLeft: 6 }}>Loading messages...</span>
                </div>
              ) : (
                chatMessages.map((msg, index) => {
                  const isOutbound = msg.direction === 'outbound';
                  return (
                    <div
                      key={msg._id || index}
                      style={{
                        alignSelf: isOutbound ? 'flex-end' : 'flex-start',
                        maxWidth: '68%',
                        background: isOutbound ? '#dcfce7' : '#ffffff',
                        border: isOutbound ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                        borderRadius: isOutbound ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                        padding: '8px 12px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                      }}
                    >
                      {/* Campaign Tag */}
                      {msg.messageType === 'campaign' && (
                        <div
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 700,
                            color: '#047857',
                            background: '#ecfdf5',
                            padding: '1px 6px',
                            borderRadius: 4,
                            marginBottom: 5,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                        >
                          <CampaignsTabIcon size={10} />
                          <span>Campaign: {msg.campaignName || 'CRM'}</span>
                        </div>
                      )}

                      {/* Media image */}
                      {msg.mediaUrl && (
                        <div style={{ marginBottom: 6, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.05)' }}>
                          <img
                            src={msg.mediaUrl}
                            alt="Attachment"
                            style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block' }}
                          />
                        </div>
                      )}

                      {/* Message text */}
                      <div style={{ fontSize: '12px', color: '#0f172a', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {msg.text}
                      </div>

                      {/* Time & tick */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3 }}>
                        <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                          {formatTime(msg.createdAt)}
                        </span>
                        {isOutbound && (
                          msg.status === 'failed' ? (
                            <span
                              title={msg.error || 'AiSensy delivery error'}
                              style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                color: '#ef4444',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2,
                                background: '#fef2f2',
                                padding: '1px 4px',
                                borderRadius: 3
                              }}
                            >
                              ⚠️ Not delivered
                            </span>
                          ) : msg.status === 'sending' ? (
                            <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>⏳</span>
                          ) : (
                            <DoubleCheckIcon size={12} blue={msg.status === 'read' || msg.status === 'delivered'} />
                          )
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Interactive Template Quick-Send Banner */}
            {selectedTemplate && showTemplatePreviewBar && (
              <div
                style={{
                  padding: '7px 14px',
                  background: '#f0fdf4',
                  borderTop: '1px solid #bbf7d0',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexShrink: 0
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  {selectedTemplate.headerMediaUrl && (
                    <img
                      src={selectedTemplate.headerMediaUrl}
                      alt="Template Media"
                      style={{ width: 34, height: 34, borderRadius: 5, objectFit: 'cover', border: '1px solid #86efac', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534' }}>
                        {selectedTemplate.name}
                      </span>
                      <span style={{ fontSize: '9px', fontWeight: 600, background: '#dcfce7', color: '#15803d', padding: '1px 5px', borderRadius: 4 }}>
                        Campaign: {selectedTemplate.campaignName}
                      </span>
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#15803d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                      {(selectedTemplate.body || '').replace(/\{FirstName\}|\$FirstName|\{\{1\}\}/g, activeContact.name || 'Client').slice(0, 75)}...
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    disabled={sendingChat}
                    onClick={() => handleSendTemplate(selectedTemplate)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '5px 12px',
                      borderRadius: 6,
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: sendingChat ? 'not-allowed' : 'pointer',
                      boxShadow: '0 1px 2px rgba(16,185,129,0.3)'
                    }}
                    title="Send this pre-approved WhatsApp template"
                  >
                    <SendIcon size={11} color="#ffffff" />
                    <span>{sendingChat ? 'Sending...' : `Send Template to ${activeContact.name || 'Lead'}`}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplatePreviewBar(false)}
                    title="Hide Banner"
                    style={{ border: 'none', background: 'transparent', color: '#166534', cursor: 'pointer', fontSize: '12px' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* If template banner hidden, give quick re-open toggle */}
            {selectedTemplate && !showTemplatePreviewBar && (
              <div style={{ padding: '3px 14px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowTemplatePreviewBar(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#059669',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3
                  }}
                >
                  <TemplateIcon size={10} color="#059669" /> Show Template Quick-Send ({selectedTemplate.name})
                </button>
              </div>
            )}

            {/* Quick Templates Chips (Fixed above input) */}
            <div
              style={{
                padding: '5px 14px',
                background: '#ffffff',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>Quick:</span>
              {[
                "Hi! Following up on your inquiry with Bhoomi TechZone.",
                "Here is our business proposal and service catalog.",
                "Are you available for a quick 5-min discovery call?",
                "Thank you for contacting us! How can our CRM team assist you?"
              ].map((template, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewMessageText(template)}
                  style={{
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: '10px',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {template.slice(0, 30)}...
                </button>
              ))}
            </div>

            {/* Optional Media Drawer */}
            {showMediaInput && (
              <div
                style={{
                  padding: '6px 14px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0
                }}
              >
                <input
                  type="text"
                  placeholder="Paste image or media URL..."
                  value={newChatMediaUrl}
                  onChange={(e) => setNewChatMediaUrl(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    fontSize: '11px'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setNewChatMediaUrl(DEFAULT_MEDIA_URL)}
                  style={{
                    padding: '3px 7px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 5,
                    fontSize: '10.5px',
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Sample Media
                </button>
              </div>
            )}

            {/* Chat Input Bar (Pinned firmly at bottom) */}
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: '8px 14px',
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                flexShrink: 0
              }}
            >
              <button
                type="button"
                onClick={() => setShowMediaInput(!showMediaInput)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: showMediaInput ? '#ecfdf5' : '#f8fafc',
                  color: showMediaInput ? '#059669' : '#64748b',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Attach Media URL"
              >
                <PaperclipIcon size={14} color={showMediaInput ? '#059669' : '#64748b'} />
              </button>

              <input
                type="text"
                placeholder={`Type a WhatsApp message to ${activeContact.name || formatPhone(selectedDest)}...`}
                value={newMessageText}
                onChange={(e) => setNewMessageText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 18,
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: '12.5px',
                  color: '#0f172a',
                  background: '#f8fafc'
                }}
              />

              {/* Direct WhatsApp Web Sender with typed custom message */}
              {newMessageText.trim() && (
                <a
                  href={`https://wa.me/${selectedDest}?text=${encodeURIComponent(newMessageText)}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Send this custom text directly via WhatsApp Web"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: '#25D366',
                    color: '#ffffff',
                    textDecoration: 'none',
                    boxShadow: '0 1px 3px rgba(37,211,102,0.35)',
                    flexShrink: 0
                  }}
                >
                  <WhatsAppIcon size={16} color="#ffffff" />
                </a>
              )}

              <button
                type="submit"
                disabled={sendingChat || (!newMessageText.trim() && !newChatMediaUrl.trim())}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: (!newMessageText.trim() && !newChatMediaUrl.trim()) ? '#cbd5e1' : '#10b981',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: (!newMessageText.trim() && !newChatMediaUrl.trim()) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 3px rgba(16,185,129,0.25)',
                  transition: 'background 0.15s ease'
                }}
                title="Send via AiSensy & Save to CRM"
              >
                {sendingChat ? <RefreshIcon size={13} className="spin" /> : <SendIcon size={14} color="#fff" />}
              </button>
            </form>
          </div>
        </div>
        )
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. TAB 2: CAMPAIGNS (SCROLLABLE VIEW WITH CAMPAIGN SELECTOR & CHATS)      */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        !hasAssignedCampaigns ? (
          <div
            style={{
              flex: 1,
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              padding: '72px 28px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '10px 0 24px'
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                color: '#059669'
              }}
            >
              <CampaignsTabIcon size={28} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
              You have not any assigned campaign yet
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '460px', margin: 0, lineHeight: 1.55 }}>
              No marketing or outreach campaigns are currently assigned to your sales account. Once an administrator assigns a campaign to you, its leads, client chats, and WhatsApp interactions will appear here automatically.
            </p>
          </div>
        ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '4px' }}>
          {/* ASSIGNMENT SUCCESS NOTIFICATION TOAST */}
          {assignSuccessMsg && (
            <div
              style={{
                padding: '9px 14px',
                marginBottom: 12,
                borderRadius: 8,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 4px rgba(16,185,129,0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <UserCheckIcon size={15} color="#059669" />
                <span>{assignSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setAssignSuccessMsg(null)}
                style={{ background: 'none', border: 'none', color: '#065f46', cursor: 'pointer', fontSize: '13px', padding: 0 }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ──────────────────────────────────────────────────────────────────────── */}
          {/* CAMPAIGN DIRECTORY & SALES ROLE ASSIGNMENT HUB                            */}
          {/* ──────────────────────────────────────────────────────────────────────── */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: '16px 18px',
              marginBottom: 14,
              boxShadow: '0 1px 3px rgba(15,23,42,0.03)'
            }}
          >
            {/* Header: Title & Primary Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
                marginBottom: 14
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 9,
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #d1fae5',
                    flexShrink: 0
                  }}
                >
                  <CampaignsTabIcon size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Campaigns & Sales Team Assignment
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: 1 }}>
                    Select a campaign to inspect conversations, or assign dedicated sales roles (Executives, Telecallers, Managers) to handle outreach.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal(selectedCampaignFilter !== 'ALL' ? selectedCampaignFilter : (availableCampaigns[0]?.campaignName || 'CRM'))}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 7,
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(16,185,129,0.28)',
                      transition: 'all 0.15s ease'
                    }}
                    title="Assign any campaign to sales team members"
                  >
                    <UserPlusIcon size={14} color="#ffffff" />
                    <span>Assign Campaign to Sales Team</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    fetchLogs();
                    fetchTemplates();
                    if (isAdmin) fetchSalesEmployees();
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 7,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <RefreshIcon size={12} className={logsLoading ? 'spin' : ''} />
                  <span>{logsLoading ? 'Syncing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {/* Campaign Cards Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: 10
              }}
            >
              {/* Card 1: All Campaigns */}
              <div
                onClick={() => setSelectedCampaignFilter('ALL')}
                style={{
                  padding: '11px 13px',
                  borderRadius: 10,
                  border: selectedCampaignFilter === 'ALL' ? '2px solid #10b981' : '1px solid #e2e8f0',
                  background: selectedCampaignFilter === 'ALL' ? '#f0fdf4' : '#fafafa',
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: selectedCampaignFilter === 'ALL' ? '0 2px 6px rgba(16,185,129,0.12)' : '0 1px 2px rgba(15,23,42,0.02)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                      All Campaigns
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: selectedCampaignFilter === 'ALL' ? '#dcfce7' : '#f1f5f9',
                        color: selectedCampaignFilter === 'ALL' ? '#15803d' : '#64748b'
                      }}
                    >
                      {logs.length} chats
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.35, marginBottom: 8 }}>
                    Full CRM view across all registered campaign templates
                  </div>
                </div>

                <div style={{ paddingTop: 6, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: 600 }}>
                    {availableCampaigns.length} campaigns
                  </span>
                  {selectedCampaignFilter === 'ALL' && (
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669' }}>
                      ● Active Filter
                    </span>
                  )}
                </div>
              </div>

              {/* Individual Campaign Cards */}
              {availableCampaigns.map((c) => {
                const count = logs.filter((l) => (l.campaignName || 'CRM').trim().toLowerCase() === c.campaignName.trim().toLowerCase()).length;
                const assignees = getCampaignAssignees(c.campaignName);
                const isSelected = selectedCampaignFilter === c.campaignName;
                const isAssignedToMe = user && assignees.some((a) => {
                  const aId = typeof a === 'object' && a ? String(a._id || a.id) : String(a);
                  return aId === String(user._id || user.id);
                });

                return (
                  <div
                    key={c.campaignName}
                    onClick={() => setSelectedCampaignFilter(c.campaignName)}
                    style={{
                      padding: '11px 13px',
                      borderRadius: 10,
                      border: isSelected ? '2px solid #10b981' : '1px solid #e2e8f0',
                      background: isSelected ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: isSelected ? '0 2px 6px rgba(16,185,129,0.12)' : '0 1px 2px rgba(15,23,42,0.02)'
                    }}
                  >
                    <div>
                      {/* Top: Name & Count */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                          {c.campaignName}
                        </span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: 10,
                            background: count > 0 ? '#eff6ff' : '#f8fafc',
                            color: count > 0 ? '#1d4ed8' : '#94a3b8',
                            border: count > 0 ? '1px solid #bfdbfe' : '1px solid #e2e8f0'
                          }}
                        >
                          {count} chats
                        </span>
                      </div>

                      {/* Display name */}
                      {c.displayName && c.displayName !== c.campaignName && (
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            marginBottom: 6,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={c.displayName}
                        >
                          {c.displayName}
                        </div>
                      )}

                      {/* Assigned to me pill */}
                      {isAssignedToMe && (
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                            ✓ Assigned to You
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Team Avatars & 1-Click Assign */}
                    <div
                      style={{
                        paddingTop: 7,
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {assignees.length === 0 ? (
                          <span style={{ fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Unassigned
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {assignees.slice(0, 3).map((assignee, idx) => {
                                const aName = typeof assignee === 'object' && assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email || 'Sales Rep' : 'Sales Rep';
                                const aRole = typeof assignee === 'object' && assignee ? assignee.designation || assignee.role?.name || 'Sales' : 'Sales';
                                const aColor = getAvatarColor(aName);
                                return (
                                  <div
                                    key={idx}
                                    title={`${aName} (${aRole})`}
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: '50%',
                                      background: aColor,
                                      color: '#ffffff',
                                      fontSize: '9px',
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: '1.5px solid #ffffff',
                                      marginLeft: idx === 0 ? 0 : -5,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }}
                                  >
                                    {aName.charAt(0).toUpperCase()}
                                  </div>
                                );
                              })}
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669', marginLeft: 4 }}>
                              {assignees.length} {assignees.length === 1 ? 'rep' : 'reps'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Quick Assign Button */}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAssignModal(c.campaignName);
                          }}
                          style={{
                            padding: '3px 7px',
                            borderRadius: 5,
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            fontSize: '10.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3
                          }}
                          title={`Assign or manage sales employees for ${c.campaignName}`}
                        >
                          <UserPlusIcon size={11} color="#059669" />
                          <span>Assign</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expanded Active Campaign & Assigned Sales Reps Banner */}
            {selectedCampaignFilter !== 'ALL' && (
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Active Campaign:</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        background: '#ecfdf5',
                        color: '#059669',
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid #a7f3d0'
                      }}
                    >
                      {selectedCampaignFilter}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Assigned Team:</span>
                    {getCampaignAssignees(selectedCampaignFilter).length === 0 ? (
                      <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
                        ⚠️ No sales employees assigned yet
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        {getCampaignAssignees(selectedCampaignFilter).map((assignee, idx) => {
                          const aName = typeof assignee === 'object' && assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() || assignee.email || 'Sales Rep' : 'Sales Rep';
                          const aRole = typeof assignee === 'object' && assignee ? assignee.designation || assignee.role?.name || 'Sales' : 'Sales';
                          return (
                            <span
                              key={idx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 12,
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                color: '#1e293b'
                              }}
                            >
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                              <span>{aName}</span>
                              <span style={{ color: '#64748b', fontSize: '10px' }}>({aRole})</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleOpenAssignModal(selectedCampaignFilter)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <UserPlusIcon size={12} color="#ffffff" />
                      <span>Manage Team</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedCampaignFilter('ALL')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    ✕ View All Campaigns
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CAMPAIGN CHATS & DISPATCHES SECTION */}
          <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Campaign Chats</span>
                <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: selectedCampaignFilter === 'ALL' ? '#f1f5f9' : '#ecfdf5', color: selectedCampaignFilter === 'ALL' ? '#475569' : '#059669', border: selectedCampaignFilter === 'ALL' ? '1px solid #e2e8f0' : '1px solid #a7f3d0' }}>
                  {selectedCampaignFilter === 'ALL' ? 'All Campaigns' : `Campaign: ${selectedCampaignFilter}`} ({filteredLogs.length})
                </span>
              </div>

              {/* Filters & Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Search Box */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f8fafc', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', width: '180px' }}>
                  <SearchIcon size={12} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="Search chats or phone..."
                    value={campaignSearchText}
                    onChange={(e) => setCampaignSearchText(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '11px', width: '100%', color: '#0f172a' }}
                  />
                  {campaignSearchText && (
                    <button type="button" onClick={() => setCampaignSearchText('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '10px', padding: 0 }}>✕</button>
                  )}
                </div>

                {/* Campaign Dropdown Filter (in table header) */}
                <select
                  value={selectedCampaignFilter}
                  onChange={(e) => setSelectedCampaignFilter(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#0f172a',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">All Campaigns ({logs.length})</option>
                  {availableCampaigns.map((c) => {
                    const count = logs.filter((l) => (l.campaignName || 'CRM').trim().toLowerCase() === c.campaignName.trim().toLowerCase()).length;
                    return (
                      <option key={c.campaignName} value={c.campaignName}>
                        {c.campaignName} ({count})
                      </option>
                    );
                  })}
                </select>

                {/* Status Filter */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {['ALL', 'SUCCESS', 'FAILED'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setLogFilter(st)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: '10.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: 'none',
                        background: logFilter === st ? '#0f172a' : '#f1f5f9',
                        color: logFilter === st ? '#ffffff' : '#64748b'
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chats Table */}
            {filteredLogs.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                  <MessagesTabIcon size={26} color="#cbd5e1" />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                  No chats found for campaign "{selectedCampaignFilter === 'ALL' ? 'All Campaigns' : selectedCampaignFilter}"
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: 4 }}>
                  Dispatches sent with this campaign name will appear here automatically.
                </div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '9px 12px', width: '90px' }}>Status</th>
                    <th style={{ padding: '9px 12px', width: '170px' }}>Recipient & Phone</th>
                    <th style={{ padding: '9px 12px', width: '130px' }}>Campaign</th>
                    <th style={{ padding: '9px 12px' }}>WhatsApp Chat Message</th>
                    <th style={{ padding: '9px 12px', width: '120px' }}>Sent Time</th>
                    <th style={{ padding: '9px 12px', width: '130px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const recipientName = log.paramsFallbackValue?.FirstName || log.userName || 'Lead';
                    const messageContent = log.responseMessage || log.text || (log.templateParams ? `Params: [${log.templateParams.join(', ')}]` : 'WhatsApp Campaign Message');
                    const isSuccess = log.status === 'SUCCESS';
                    const hasMedia = Boolean(log.media?.url);
                    const timeFormatted = log.createdAt ? formatTime(log.createdAt) : '';
                    const dateFormatted = log.createdAt ? new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

                    return (
                      <tr key={log._id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s ease' }}>
                        <td style={{ padding: '9px 12px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: isSuccess ? '#ecfdf5' : '#fef2f2',
                              color: isSuccess ? '#059669' : '#dc2626',
                              border: isSuccess ? '1px solid #a7f3d0' : '1px solid #fecaca'
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: isSuccess ? '#10b981' : '#ef4444' }} />
                            {isSuccess ? 'DELIVERED' : 'FAILED'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{recipientName}</div>
                          <div style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '10.5px', marginTop: 1 }}>
                            {formatPhone(log.destination)}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 600,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              display: 'inline-block'
                            }}
                          >
                            {log.campaignName || 'CRM'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', maxWidth: '320px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                            {hasMedia && (
                              <span style={{ fontSize: '9.5px', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '1px 5px', borderRadius: 3, flexShrink: 0, fontWeight: 700 }}>
                                Media
                              </span>
                            )}
                            <div
                              onClick={() => setPreviewChatLog(log)}
                              title="Click to view full message"
                              style={{
                                color: '#334155',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textDecorationStyle: 'dotted'
                              }}
                            >
                              {messageContent}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', color: '#64748b', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                          <div>{dateFormatted}</div>
                          <div style={{ color: '#94a3b8' }}>{timeFormatted}</div>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDest(log.destination);
                                setActiveTab('messages');
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '3px 8px',
                                borderRadius: 5,
                                background: '#10b981',
                                color: '#ffffff',
                                border: 'none',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 1px 2px rgba(16,185,129,0.2)'
                              }}
                              title="Open 2-way conversation in Messages workbench"
                            >
                              <WhatsAppIcon size={11} color="#ffffff" />
                              <span>Chat</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPreviewChatLog(log)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '3px 7px',
                                borderRadius: 5,
                                background: '#f8fafc',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                fontSize: '10.5px',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                              title="Preview full message & delivery details"
                            >
                              <EyeIcon size={11} color="#64748b" />
                              <span>View</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
        )
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. MODAL: ASSIGN CAMPAIGN TO SALES TEAM (ADMIN ONLY)                      */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isAdmin && showAssignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '95%',
              maxWidth: '1060px',
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: 16,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 60px -15px rgba(15,23,42,0.25)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 26px',
                background: '#ffffff',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#ecfdf5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #d1fae5',
                    flexShrink: 0
                  }}
                >
                  <UsersIcon size={20} color="#059669" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                      Assign Campaign to Sales Team
                    </h3>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 9px',
                        borderRadius: 6,
                        background: '#eff6ff',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe'
                      }}
                    >
                      {assigningCampaign}
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Select active sales team employees to handle incoming client leads & campaign interactions
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b',
                  fontSize: '14px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Campaign Selection Row inside Modal */}
            <div
              style={{
                padding: '12px 26px',
                background: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                <span>Target Campaign:</span>
                <select
                  value={assigningCampaign}
                  onChange={(e) => {
                    const cName = e.target.value;
                    setAssigningCampaign(cName);
                    const matched = templates.find((t) => (t.campaignName || '').toLowerCase() === cName.toLowerCase());
                    if (matched && Array.isArray(matched.assignedTo)) {
                      setSelectedAssignees(matched.assignedTo.map((u) => (typeof u === 'object' && u ? String(u._id || u.id) : String(u))));
                    } else {
                      setSelectedAssignees([]);
                    }
                  }}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#0f172a',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  {availableCampaigns.map((c) => (
                    <option key={c.campaignName} value={c.campaignName}>
                      {c.campaignName} {c.displayName && c.displayName !== c.campaignName ? `— ${c.displayName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Selected: <strong style={{ color: '#059669' }}>{selectedAssignees.length}</strong> of {salesEmployees.length} sales members
              </div>
            </div>

            {/* Search & Bulk Select Actions */}
            <div style={{ padding: '14px 26px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
                  <SearchIcon size={14} color="#94a3b8" />
                </div>
                <input
                  type="text"
                  placeholder="Filter sales employees by name, designation, email..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                />
                {assignSearch && (
                  <button
                    type="button"
                    onClick={() => setAssignSearch('')}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '11px' }}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => {
                    const allIds = salesEmployees.map((e) => String(e._id));
                    setSelectedAssignees(allIds);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 7,
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#065f46',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAssignees([])}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 7,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Sales Employee List */}
            <div style={{ flex: 1, minHeight: '300px', maxHeight: '520px', overflowY: 'auto', padding: '10px 26px 18px' }}>
              {salesEmployeesLoading ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: '#64748b' }}>
                  <RefreshIcon size={18} className="spin" />
                  <div style={{ marginTop: 8, fontSize: '12px' }}>Loading sales role employees...</div>
                </div>
              ) : filteredSalesEmployees.length === 0 ? (
                <div style={{ padding: '48px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <UsersIcon size={24} color="#cbd5e1" />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                    {assignSearch ? 'No sales employees match your search.' : 'No active sales employees found.'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: 4 }}>
                    Employees with a Sales role or department will appear here automatically.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 10 }}>
                  {filteredSalesEmployees.map((emp) => {
                    const empId = String(emp._id);
                    const isChecked = selectedAssignees.includes(empId);
                    const fullName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Sales Member';
                    const roleName = (typeof emp.role === 'object' && emp.role !== null ? emp.role.name : emp.role) || emp.designation || 'Sales Role';
                    const avatarColor = getAvatarColor(fullName);

                    return (
                      <div
                        key={empId}
                        onClick={() => {
                          setSelectedAssignees((prev) =>
                            prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
                          );
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: 10,
                          border: isChecked ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                          background: isChecked ? '#f0fdf4' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.14s ease',
                          boxShadow: isChecked ? '0 2px 8px rgba(16,185,129,0.14)' : '0 1px 2px rgba(15,23,42,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1, paddingRight: 8 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => { }}
                            style={{ cursor: 'pointer', accentColor: '#10b981', width: 17, height: 17, flexShrink: 0 }}
                          />

                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              background: avatarColor,
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: 700,
                              flexShrink: 0
                            }}
                          >
                            {fullName.charAt(0).toUpperCase()}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                {fullName}
                              </span>
                              {emp.employeeId && (
                                <span style={{ fontSize: '10.5px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', flexShrink: 0 }}>
                                  {emp.employeeId}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              <span>{emp.email}</span>
                              {emp.department && (
                                <span style={{ color: '#94a3b8' }}>• {emp.department}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: 12,
                            background: isChecked ? '#dcfce7' : '#f1f5f9',
                            color: isChecked ? '#15803d' : '#475569',
                            border: isChecked ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                            flexShrink: 0,
                            marginLeft: 8,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {roleName}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 20px',
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                {selectedAssignees.length === 0 ? (
                  <span style={{ color: '#f59e0b' }}>⚠️ Unassigned (no members selected)</span>
                ) : (
                  <span style={{ color: '#059669', fontWeight: 600 }}>
                    ✓ {selectedAssignees.length} sales member(s) selected
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#475569',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignment}
                  disabled={savingAssignment}
                  style={{
                    padding: '7px 18px',
                    borderRadius: 6,
                    background: '#10b981',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                    cursor: savingAssignment ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {savingAssignment ? (
                    <>
                      <RefreshIcon size={12} className="spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <UserCheckIcon size={14} color="#ffffff" />
                      <span>Save & Assign Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QUICK CHAT PREVIEW MODAL */}
      {previewChatLog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div style={{ width: '100%', maxWidth: '480px', background: '#ffffff', borderRadius: 12, padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Campaign Chat Details</span>
                <span style={{ fontSize: '10.5px', fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', padding: '1px 6px', borderRadius: 4 }}>
                  {previewChatLog.campaignName || 'CRM'}
                </span>
              </div>
              <button type="button" onClick={() => setPreviewChatLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px' }}>✕</button>
            </div>

            <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Recipient:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{previewChatLog.paramsFallbackValue?.FirstName || previewChatLog.userName || 'Lead'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Phone Number:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>{formatPhone(previewChatLog.destination)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginBottom: 4 }}>
                <span style={{ color: '#64748b' }}>Status:</span>
                <span style={{ fontWeight: 700, color: previewChatLog.status === 'SUCCESS' ? '#059669' : '#dc2626' }}>
                  {previewChatLog.status === 'SUCCESS' ? '● Delivered (HTTP 200)' : `● Failed (${previewChatLog.statusCode || 400})`}
                </span>
              </div>
              {previewChatLog.createdAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span style={{ color: '#64748b' }}>Sent At:</span>
                  <span style={{ color: '#334155' }}>{new Date(previewChatLog.createdAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {previewChatLog.media?.url && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#64748b', marginBottom: 3 }}>Attached Header Media:</div>
                <img
                  src={previewChatLog.media.url}
                  alt="Campaign Media"
                  style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: 4 }}>WhatsApp Message Content:</div>
              <div style={{ padding: '10px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '12px', color: '#14532d', whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: '180px', overflowY: 'auto' }}>
                {previewChatLog.responseMessage || previewChatLog.text || 'Campaign message text'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedDest(previewChatLog.destination);
                  setPreviewChatLog(null);
                  setActiveTab('messages');
                }}
                style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#10b981', color: '#ffffff', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <WhatsAppIcon size={13} color="#ffffff" />
                <span>Open in 2-Way Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewChatLog(null)}
                style={{ padding: '8px 14px', borderRadius: 6, background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 5. TAB 3: CONFIGURATION (SCROLLABLE VIEW - ADMIN ONLY)                    */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {isAdmin && activeTab === 'configuration' && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', maxWidth: '780px', paddingRight: '4px' }}>
          <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px', marginBottom: 14 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>
              AiSensy API Key & Authorization
            </h3>
            <p style={{ margin: '0 0 12px', fontSize: '11.5px', color: '#64748b' }}>
              Connected via process.env.SENSY_API_KEY
            </p>

            <div style={{ padding: '10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155' }}>SENSY_API_KEY</span>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#16a34a' }}>● Active</span>
              </div>
              <div style={{ marginTop: 6, fontSize: '11px', fontFamily: 'monospace', color: '#475569' }}>
                {config?.maskedApiKey || 'eyJhbGciOi...TZj7LAk'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              style={{ padding: '7px 14px', borderRadius: 6, background: '#10b981', color: '#ffffff', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              {testingConnection ? 'Testing...' : 'Test SENSY_API_KEY Connection'}
            </button>

            {testResult && (
              <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: testResult.success ? '#ecfdf5' : '#fef2f2', fontSize: '11.5px', color: testResult.success ? '#065f46' : '#991b1b' }}>
                {testResult.message}
              </div>
            )}
          </div>

          <div style={{ background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', padding: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>
              Webhook Endpoint
            </h3>
            <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: '#64748b' }}>
              Incoming WhatsApp messages sync automatically to your Messages tab
            </p>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                readOnly
                value={config?.webhookUrl || 'http://localhost:9410/api/aisensy/webhook'}
                style={{ flex: 1, padding: '6px 8px', borderRadius: 5, border: '1px solid #cbd5e1', fontSize: '11.5px', fontFamily: 'monospace', background: '#f8fafc' }}
              />
              <button
                type="button"
                onClick={handleCopyWebhook}
                style={{ padding: '6px 12px', borderRadius: 5, background: '#ffffff', border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                {copiedWebhook ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 6. MODAL: START NEW CHAT                                                   */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showNewNumberModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div style={{ width: '100%', maxWidth: '360px', background: '#ffffff', borderRadius: 12, padding: '18px', boxShadow: '0 16px 24px -4px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Start WhatsApp Chat</span>
              <button type="button" onClick={() => setShowNewNumberModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: 3 }}>Phone Number (with Country Code)</label>
              <input
                type="text"
                placeholder="e.g. 917985440421"
                value={newPhoneInput}
                onChange={(e) => setNewPhoneInput(e.target.value)}
                style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12.5px', fontFamily: 'monospace' }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: 3 }}>Contact Name (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Rahul Verma"
                value={newNameInput}
                onChange={(e) => setNewNameInput(e.target.value)}
                style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setShowNewNumberModal(false)}
                style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#f1f5f9', border: 'none', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartNewChat}
                style={{ flex: 1, padding: '8px', borderRadius: 6, background: '#10b981', border: 'none', fontSize: '11.5px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
              >
                Open Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 7. MODAL: WHATSAPP TEMPLATE MANAGER                                        */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showTemplateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '680px',
              maxHeight: '85vh',
              background: '#ffffff',
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
              overflow: 'hidden'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '14px 18px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TemplateIcon size={16} color="#059669" />
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    {templateModalMode === 'create'
                      ? 'Create New WhatsApp Template'
                      : templateModalMode === 'edit'
                        ? 'Edit WhatsApp Template'
                        : 'Manage WhatsApp Templates'}
                  </span>
                  <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                    {templateModalMode === 'list'
                      ? 'Choose, preview or add pre-approved Meta/AiSensy templates'
                      : 'Campaign name must match the approved campaign in your AiSensy dashboard'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {templateModalMode === 'list' && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate({
                        name: '',
                        campaignName: 'CRM',
                        category: 'MARKETING',
                        headerType: 'IMAGE',
                        headerMediaUrl: DEFAULT_MEDIA_URL,
                        body: 'Hello {FirstName} !\n\n'
                      });
                      setTemplateModalMode('create');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '5px 11px',
                      borderRadius: 6,
                      background: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <PlusIcon size={11} color="#ffffff" />
                    <span>New Template</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowTemplateModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }}
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px' }}>
              {/* ── LIST VIEW ── */}
              {templateModalMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {templates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: '12.5px' }}>
                      No templates found. Click "New Template" to add one.
                    </div>
                  ) : (
                    templates.map((tpl) => {
                      const isSelected = selectedTemplate?._id === tpl._id;
                      return (
                        <div
                          key={tpl._id}
                          style={{
                            border: isSelected ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                            borderRadius: 8,
                            padding: '12px',
                            background: isSelected ? '#f0fdf4' : '#ffffff',
                            display: 'flex',
                            gap: 12,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                          }}
                        >
                          {/* Image preview */}
                          {tpl.headerMediaUrl && (
                            <img
                              src={tpl.headerMediaUrl}
                              alt="Header Preview"
                              style={{
                                width: 70,
                                height: 70,
                                objectFit: 'cover',
                                borderRadius: 6,
                                border: '1px solid #cbd5e1',
                                flexShrink: 0
                              }}
                            />
                          )}

                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                  {tpl.name}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                  <span style={{ fontSize: '9.5px', fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#e0f2fe', color: '#0369a1' }}>
                                    Campaign: {tpl.campaignName}
                                  </span>
                                  <span style={{ fontSize: '9.5px', fontWeight: 600, padding: '1px 5px', borderRadius: 4, background: '#f1f5f9', color: '#475569' }}>
                                    {tpl.category}
                                  </span>
                                  {tpl.isDefault && (
                                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: 3, background: '#dcfce7', color: '#166534' }}>
                                      DEFAULT
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Card Actions */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingTemplate(tpl);
                                    setTemplateModalMode('edit');
                                  }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                                  title="Edit Template"
                                >
                                  <EditIcon size={12} color="#64748b" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(tpl._id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                                  title="Delete Template"
                                >
                                  <TrashIcon size={12} color="#ef4444" />
                                </button>
                              </div>
                            </div>

                            {/* Body snippet */}
                            <div
                              style={{
                                fontSize: '11.5px',
                                color: '#334155',
                                background: '#f8fafc',
                                padding: '8px',
                                borderRadius: 6,
                                marginTop: 8,
                                whiteSpace: 'pre-line',
                                lineHeight: 1.45,
                                border: '1px solid #f1f5f9'
                              }}
                            >
                              {(tpl.body || '').replace(/\{FirstName\}|\$FirstName|\{\{1\}\}/g, activeContact.name || 'Rahul')}
                            </div>

                            {/* Select / Use button */}
                            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTemplate(tpl);
                                  setChatCampaignName(tpl.campaignName || 'CRM');
                                  setShowTemplatePreviewBar(true);
                                  setShowTemplateModal(false);
                                }}
                                style={{
                                  padding: '4px 12px',
                                  borderRadius: 5,
                                  background: isSelected ? '#047857' : '#10b981',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {isSelected ? '✓ Selected Active' : 'Use This Template'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* ── CREATE / EDIT VIEW ── */}
              {(templateModalMode === 'create' || templateModalMode === 'edit') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: 3 }}>
                      Template Display Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Diwali Special Business Offer"
                      value={editingTemplate?.name || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: 3 }}>
                        AiSensy Campaign Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CRM"
                        value={editingTemplate?.campaignName || ''}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, campaignName: e.target.value })}
                        style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px', fontFamily: 'monospace' }}
                      />
                      <span style={{ fontSize: '9.5px', color: '#64748b' }}>Must match registered campaign name in AiSensy</span>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: 3 }}>
                        Category
                      </label>
                      <select
                        value={editingTemplate?.category || 'MARKETING'}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, category: e.target.value })}
                        style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff' }}
                      >
                        <option value="MARKETING">MARKETING</option>
                        <option value="UTILITY">UTILITY</option>
                        <option value="SERVICE">SERVICE</option>
                        <option value="AUTHENTICATION">AUTHENTICATION</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                        Header Media URL (Optional Image)
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingTemplate({ ...editingTemplate, headerMediaUrl: DEFAULT_MEDIA_URL })}
                        style={{ background: 'none', border: 'none', color: '#059669', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Use Default Image
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="https://...image.jpg"
                      value={editingTemplate?.headerMediaUrl || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, headerMediaUrl: e.target.value })}
                      style={{ width: '100%', padding: '7px 9px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#334155', marginBottom: 3 }}>
                      Template Body Text *
                    </label>
                    <textarea
                      rows={6}
                      placeholder="Type template body... Use {FirstName} for dynamic lead personalization"
                      value={editingTemplate?.body || ''}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '12px', lineHeight: 1.45, fontFamily: 'inherit' }}
                    />
                    <div style={{ fontSize: '10px', color: '#059669', marginTop: 2 }}>
                      💡 Tip: Use <code>&#123;FirstName&#125;</code> to dynamically greet the customer (e.g. <em>Hello Rahul ! 🪔</em>)
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setTemplateModalMode('list')}
                      style={{ padding: '7px 14px', borderRadius: 6, background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Back to List
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveTemplate(editingTemplate)}
                      style={{ padding: '7px 16px', borderRadius: 6, background: '#10b981', color: '#ffffff', border: 'none', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Save Template
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
