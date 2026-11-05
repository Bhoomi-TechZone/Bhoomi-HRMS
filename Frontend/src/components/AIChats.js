import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axios';
import {
  Bot,
  Sparkles,
  MessageSquare,
  Mail,
  Calendar,
  DollarSign,
  Search,
  X,
  ChevronDown,
  RotateCw,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  User
} from 'lucide-react';

// Green WhatsApp SVG Icon
const WhatsAppIcon = ({ size = 18, color = "#25D366" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    style={{ color, display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.971.53 1.77.781 2.8.781 3.182 0 5.768-2.587 5.768-5.766.001-3.181-2.585-5.767-5.772-5.767zm3.364 8.163c-.14.394-.715.728-1.026.77-.312.042-.716.082-2.146-.508-1.721-.71-2.83-2.476-2.916-2.59-.086-.114-.689-.918-.689-1.752 0-.834.437-1.246.592-1.417.156-.171.341-.214.455-.214.114 0 .228.001.328.006.105.005.245-.039.384.294.142.341.485 1.18.528 1.266.043.086.071.186.014.3-.057.114-.085.186-.17.286-.086.1-.18.223-.257.3-.086.086-.176.179-.076.35.1.171.444.733.953 1.186.655.584 1.207.765 1.378.851.171.086.271.071.371-.043.1-.114.428-.499.542-.67.114-.171.228-.143.385-.086.157.057.998.471 1.169.557.171.086.285.128.328.2.043.072.043.414-.097.808zM12.012 2c-5.506 0-9.985 4.479-9.985 9.985 0 1.761.458 3.483 1.332 5.006L2 22l5.163-1.319a9.925 9.925 0 004.849 1.304c5.506 0 9.988-4.479 9.988-9.985 0-5.506-4.482-10-9.988-10z" />
  </svg>
);

const STATUS_CONFIG = {
  'New Lead': {
    bg: '#eff6ff',
    color: '#1d4ed8',
    border: '#bfdbfe',
    dot: '#3b82f6'
  },
  'Contacted': {
    bg: '#fffbeb',
    color: '#b45309',
    border: '#fde68a',
    dot: '#f59e0b'
  },
  'Meeting Fixed': {
    bg: '#faf5ff',
    color: '#7e22ce',
    border: '#e9d5ff',
    dot: '#a855f7'
  },
  'Proposal Sent': {
    bg: '#ecfeff',
    color: '#0e7490',
    border: '#a5f3fc',
    dot: '#06b6d4'
  },
  'Closed': {
    bg: '#ecfdf5',
    color: '#047857',
    border: '#a7f3d0',
    dot: '#10b981'
  },
  'Not Interested': {
    bg: '#fef2f2',
    color: '#b91c1c',
    border: '#fecaca',
    dot: '#ef4444'
  }
};

const STATUS_OPTIONS = [
  'New Lead',
  'Contacted',
  'Meeting Fixed',
  'Proposal Sent',
  'Closed',
  'Not Interested'
];

function AIChats() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stats, setStats] = useState({
    total: 0,
    newLeads: 0,
    contacted: 0,
    meetingFixed: 0,
    closed: 0
  });

  // Modals state
  const [selectedTranscriptLead, setSelectedTranscriptLead] = useState(null);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [webhookConfig, setWebhookConfig] = useState({
    webhookUrl: '',
    webhookSecret: ''
  });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Fetch webhook configuration from backend .env
  const fetchWebhookConfig = useCallback(async () => {
    try {
      setLoadingConfig(true);
      const res = await api.get('/ai-chats/webhook-config');
      if (res.data?.success && res.data?.data) {
        setWebhookConfig(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load webhook configuration:', err);
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhookConfig();
  }, [fetchWebhookConfig]);

  const openWebhookModal = () => {
    fetchWebhookConfig();
    setShowSecret(false);
    setShowWebhookModal(true);
  };

  // Fetch leads
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/ai-chats/leads', {
        params: {
          search: search || undefined,
          status: statusFilter !== 'All' ? statusFilter : undefined
        }
      });
      if (res.data?.success) {
        setLeads(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
      } else {
        setLeads([]);
      }
    } catch (err) {
      console.error('Failed to load AI Chat leads:', err);
      setError('Unable to load AI chatbot leads. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Update lead status
  const handleStatusChange = async (leadId, newStatus) => {
    try {
      setActionLoadingId(leadId);
      // Optimistic update
      setLeads((prev) =>
        prev.map((l) => (l._id === leadId ? { ...l, status: newStatus } : l))
      );

      await api.patch(`/ai-chats/leads/${leadId}/status`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update status:', err);
      // Revert
      fetchLeads();
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete lead
  const handleDeleteLead = async (leadId) => {
    if (!window.confirm('Are you sure you want to delete this AI Chat lead?')) return;
    try {
      setActionLoadingId(leadId);
      await api.delete(`/ai-chats/leads/${leadId}`);
      setLeads((prev) => prev.filter((l) => l._id !== leadId));
      setStats((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }));
    } catch (err) {
      console.error('Failed to delete lead:', err);
      alert('Failed to delete lead. Please try again.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Copy to clipboard helper
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return dateString;
    }
  };

  // Clean phone number for WhatsApp link
  const getWhatsAppUrl = (lead) => {
    const rawPhone = (lead.phone || '').replace(/[^0-9]/g, '');
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const msg = `Hi ${lead.name || 'there'}, thank you for contacting Bhoomi Techzone regarding your inquiry for ${lead.service || 'our services'}. How can we assist you further?`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  // Parse chat transcript into structured messages
  const parsedTranscript = useMemo(() => {
    if (!selectedTranscriptLead) return [];
    const t = selectedTranscriptLead.transcript;
    if (!t) return [];

    // If it's already an array
    if (Array.isArray(t)) return t;

    // Try JSON parsing
    if (typeof t === 'string' && (t.trim().startsWith('[') || t.trim().startsWith('{'))) {
      try {
        const parsed = JSON.parse(t);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // Fall back to text parsing
      }
    }

    // Parse plain text with User:/Bot: or lines
    if (typeof t === 'string') {
      const lines = t.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const messages = [];

      lines.forEach((line) => {
        const trimmed = line.trim();
        const userMatch = trimmed.match(/^(user|visitor|client|customer)\s*:\s*(.*)$/i);
        const botMatch = trimmed.match(/^(bot|ai|assistant|bhoomi)\s*:\s*(.*)$/i);

        if (userMatch) {
          messages.push({ sender: 'user', text: userMatch[2] });
        } else if (botMatch) {
          messages.push({ sender: 'bot', text: botMatch[2] });
        } else {
          // Default: append to previous or as bot
          messages.push({ sender: 'bot', text: trimmed });
        }
      });

      return messages;
    }

    return [{ sender: 'bot', text: String(t) }];
  }, [selectedTranscriptLead]);

  return (
    <div
      className="page-container"
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '24px 32px 64px',
        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
      }}
    >
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 1. PAGE HEADER                                                             */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.25)'
              }}
            >
              <Bot size={24} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#0f172a',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span>AI Chats</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 20,
                    background: '#ecfdf5',
                    color: '#059669',
                    border: '1px solid #a7f3d0'
                  }}
                >
                  Website AI Leads
                </span>
              </h1>
              <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
                Live inquiries, captured client details, and complete AI chat transcripts from the website
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={openWebhookModal}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#334155',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.15s ease'
            }}
            title="View Webhook Integration details for WordPress"
          >
            <Sparkles size={16} style={{ color: '#059669' }} />
            <span>Webhook Settings</span>
          </button>

          <button
            onClick={fetchLeads}
            disabled={loading}
            style={{
              padding: '9px 16px',
              borderRadius: 10,
              border: 'none',
              background: '#059669',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            <RotateCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 2. STATS CARDS                                                             */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24
        }}
      >
        <div
          style={{
            background: '#ffffff',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Total AI Leads</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
              <Bot size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', marginTop: 8 }}>
            {stats.total || leads.length}
          </div>
          <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Captured from Website</span>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>New Inquiries</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
              <Sparkles size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#1d4ed8', marginTop: 8 }}>
            {leads.filter((l) => l.status === 'New Lead').length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Needs initial call / outreach
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>In Discussion</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
              <MessageSquare size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#b45309', marginTop: 8 }}>
            {leads.filter((l) => ['Contacted', 'Meeting Fixed', 'Proposal Sent'].includes(l.status)).length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Contacted / Proposals Sent
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            padding: '18px 20px',
            borderRadius: 14,
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Converted / Closed</span>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <Check size={18} />
            </div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#047857', marginTop: 8 }}>
            {leads.filter((l) => l.status === 'Closed').length}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Successful conversions
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#b91c1c', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 3. FILTER & SEARCH BAR                                                     */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px 16px 0 0',
          border: '1px solid #e2e8f0',
          borderBottom: 'none',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        {/* Search */}
        <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8'
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client, phone, service..."
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
              background: '#f8fafc',
              transition: 'border-color 0.15s ease'
            }}
          />
        </div>

        {/* Status Pills Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {['All', ...STATUS_OPTIONS].map((status) => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: isActive ? '1px solid #059669' : '1px solid #e2e8f0',
                  background: isActive ? '#059669' : '#ffffff',
                  color: isActive ? '#ffffff' : '#64748b',
                  transition: 'all 0.15s ease'
                }}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 4. LEADS TABLE                                                             */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '0 0 16px 16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
          overflow: 'hidden'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
              fontSize: 13
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                <th style={{ padding: '14px 18px', width: 140 }}>Date & Time</th>
                <th style={{ padding: '14px 18px' }}>Client Details</th>
                <th style={{ padding: '14px 18px' }}>Phone / WhatsApp</th>
                <th style={{ padding: '14px 18px' }}>Service Needed</th>
                <th style={{ padding: '14px 18px' }}>Budget</th>
                <th style={{ padding: '14px 18px', width: 160 }}>Status</th>
                <th style={{ padding: '14px 18px', textAlign: 'center', width: 170 }}>Chat Transcript</th>
                <th style={{ padding: '14px 18px', textAlign: 'center', width: 60 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <RotateCw size={26} className="spin" style={{ color: '#059669' }} />
                      <span style={{ fontSize: 14, fontWeight: 500 }}>Loading AI Chat leads...</span>
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '70px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        maxWidth: 420,
                        margin: '0 auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: '50%',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#059669'
                        }}
                      >
                        <Bot size={28} />
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0 }}>
                        No Website AI Leads Yet
                      </h3>
                      <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                        When visitors chat with the AI assistant on your WordPress website, inquiries will instantly appear in this table with full conversation transcripts.
                      </p>
                      <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                        <button
                          onClick={openWebhookModal}
                          style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            background: '#059669',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Sparkles size={14} />
                          <span>View Setup Instructions</span>
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const statusConf = STATUS_CONFIG[lead.status] || STATUS_CONFIG['New Lead'];
                  const hasTranscript = Boolean(lead.transcript);

                  return (
                    <tr
                      key={lead._id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fbfcfe')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                    >
                      {/* Date & Time */}
                      <td style={{ padding: '14px 18px', color: '#64748b', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={14} style={{ color: '#94a3b8' }} />
                          <span>{formatDate(lead.createdAt)}</span>
                        </div>
                      </td>

                      {/* Client Name & Details */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: '50%',
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontWeight: 700,
                              fontSize: 13,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {(lead.name || 'W').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: 13.5 }}>
                              {lead.name || 'Website Prospect'}
                            </div>
                            {lead.email ? (
                              <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <Mail size={12} style={{ color: '#94a3b8' }} />
                                <a
                                  href={`mailto:${lead.email}`}
                                  style={{ color: '#64748b', textDecoration: 'none' }}
                                  onMouseEnter={(e) => (e.target.style.color = '#059669')}
                                  onMouseLeave={(e) => (e.target.style.color = '#64748b')}
                                >
                                  {lead.email}
                                </a>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      {/* Phone Number & WhatsApp Button */}
                      <td style={{ padding: '14px 18px' }}>
                        {lead.phone ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>
                              {lead.phone}
                            </span>
                            <a
                              href={getWhatsAppUrl(lead)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: '#dcfce7',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #86efac',
                                color: '#16a34a',
                                textDecoration: 'none',
                                cursor: 'pointer',
                                transition: 'transform 0.15s ease'
                              }}
                              title="Chat on WhatsApp"
                              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.12)')}
                              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                            >
                              <WhatsAppIcon size={16} />
                            </a>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Not provided</span>
                        )}
                      </td>

                      {/* Service Needed */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                            maxWidth: 180,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={lead.service}
                        >
                          {lead.service || 'General Inquiry'}
                        </span>
                      </td>

                      {/* Budget */}
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: '#0f172a',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          <DollarSign size={13} style={{ color: '#059669' }} />
                          {lead.budget || 'Discuss on call'}
                        </span>
                      </td>

                      {/* Status Dropdown */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                          <select
                            value={lead.status || 'New Lead'}
                            onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                            disabled={actionLoadingId === lead._id}
                            style={{
                              width: '100%',
                              padding: '6px 26px 6px 24px',
                              borderRadius: 20,
                              fontSize: 12,
                              fontWeight: 600,
                              border: `1px solid ${statusConf.border}`,
                              background: statusConf.bg,
                              color: statusConf.color,
                              cursor: 'pointer',
                              outline: 'none',
                              appearance: 'none',
                              WebkitAppearance: 'none'
                            }}
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt} style={{ background: '#fff', color: '#0f172a' }}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          {/* Dot indicator */}
                          <span
                            style={{
                              position: 'absolute',
                              left: 10,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: statusConf.dot,
                              pointerEvents: 'none'
                            }}
                          />
                          {/* Chevron icon */}
                          <ChevronDown
                            size={14}
                            style={{
                              position: 'absolute',
                              right: 8,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: statusConf.color,
                              pointerEvents: 'none'
                            }}
                          />
                        </div>
                      </td>

                      {/* View Chat Transcript Button */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedTranscriptLead(lead)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            background: hasTranscript ? '#ffffff' : '#f8fafc',
                            color: hasTranscript ? '#059669' : '#94a3b8',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: hasTranscript ? 'pointer' : 'default',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (hasTranscript) {
                              e.currentTarget.style.background = '#ecfdf5';
                              e.currentTarget.style.borderColor = '#a7f3d0';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (hasTranscript) {
                              e.currentTarget.style.background = '#ffffff';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                            }
                          }}
                        >
                          <MessageSquare size={14} />
                          <span>View Transcript</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteLead(lead._id)}
                          style={{
                            padding: '6px',
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            transition: 'color 0.15s ease'
                          }}
                          title="Delete Lead"
                          onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '12px 20px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: 12,
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>
            Showing <strong>{leads.length}</strong> website AI inquiries
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Syncs in real-time from WordPress BTPL AI Assistant
          </span>
        </div>
      </div>

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 5. CHAT TRANSCRIPT MODAL                                                   */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {selectedTranscriptLead && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setSelectedTranscriptLead(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 680,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.18)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Bot size={18} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                    AI Conversation Transcript
                  </h3>
                </div>
                <div style={{ fontSize: 13, color: '#a7f3d0', marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span><strong>Client:</strong> {selectedTranscriptLead.name || 'Prospect'}</span>
                  {selectedTranscriptLead.phone && (
                    <span><strong>Phone:</strong> {selectedTranscriptLead.phone}</span>
                  )}
                  {selectedTranscriptLead.service && (
                    <span><strong>Service:</strong> {selectedTranscriptLead.service}</span>
                  )}
                  {selectedTranscriptLead.budget && (
                    <span><strong>Budget:</strong> {selectedTranscriptLead.budget}</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedTranscriptLead.phone && (
                  <a
                    href={getWhatsAppUrl(selectedTranscriptLead)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: '#25D366',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <WhatsAppIcon size={14} color="#fff" />
                    <span>WhatsApp</span>
                  </a>
                )}
                <button
                  onClick={() => setSelectedTranscriptLead(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Conversation Messages Container */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}
            >
              {parsedTranscript.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
                  <MessageSquare size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <div>No transcript messages recorded for this lead.</div>
                </div>
              ) : (
                parsedTranscript.map((msg, idx) => {
                  const isUser = msg.sender === 'user' || msg.sender === 'visitor' || msg.sender === 'client';
                  const isBot = !isUser;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isUser ? 'flex-end' : 'flex-start',
                        gap: 4
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#94a3b8',
                          padding: '0 6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        {isBot ? (
                          <>
                            <Bot size={12} style={{ color: '#059669' }} />
                            <span>Bhoomi AI Assistant</span>
                          </>
                        ) : (
                          <>
                            <User size={12} style={{ color: '#2563eb' }} />
                            <span>{selectedTranscriptLead.name || 'Client'}</span>
                          </>
                        )}
                        {msg.time && <span>• {msg.time}</span>}
                      </div>

                      <div
                        style={{
                          maxWidth: '78%',
                          padding: '12px 16px',
                          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isUser ? '#059669' : '#ffffff',
                          color: isUser ? '#ffffff' : '#1e293b',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                          border: isUser ? 'none' : '1px solid #e2e8f0',
                          fontSize: 13.5,
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <button
                onClick={() => {
                  const fullText = parsedTranscript
                    .map((m) => `${m.sender.toUpperCase()}: ${m.text}`)
                    .join('\n\n');
                  handleCopy(fullText, 'transcript');
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                {copiedKey === 'transcript' ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                <span>{copiedKey === 'transcript' ? 'Copied Transcript!' : 'Copy Transcript'}</span>
              </button>

              <button
                onClick={() => setSelectedTranscriptLead(null)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────────── */}
      {/* 6. WEBHOOK SETUP INSTRUCTIONS MODAL                                        */}
      {/* ────────────────────────────────────────────────────────────────────────── */}
      {showWebhookModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
          onClick={() => setShowWebhookModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 780,
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              padding: '32px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    WordPress Webhook Integration
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#64748b', margin: 0 }}>
                    Connect BTPL AI Assistant plugin to sync leads into this page
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWebhookModal(false)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Instruction Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Webhook URL */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  1. Webhook URL
                </label>
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: '8px 12px',
                    gap: 8
                  }}
                >
                  <code style={{ flex: 1, fontSize: 13, color: '#0f172a', wordBreak: 'break-all' }}>
                    {webhookConfig.webhookUrl || (loadingConfig ? 'Loading webhook URL...' : 'https://hrmsbackend.bhoomitechzone.in/api/leads/webhook')}
                  </code>
                  <button
                    onClick={() =>
                      handleCopy(
                        webhookConfig.webhookUrl || 'https://hrmsbackend.bhoomitechzone.in/api/leads/webhook',
                        'url'
                      )
                    }
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      color: copiedKey === 'url' ? '#10b981' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {copiedKey === 'url' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey === 'url' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Secret Token */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  2. Secret Token
                </label>
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    alignItems: 'center',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 10,
                    padding: '8px 12px',
                    gap: 8
                  }}
                >
                  <code
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: '#059669',
                      fontWeight: 600,
                      wordBreak: 'break-all',
                      letterSpacing: showSecret ? 'normal' : '2px',
                      userSelect: showSecret ? 'all' : 'none'
                    }}
                  >
                    {webhookConfig.webhookSecret
                      ? showSecret
                        ? webhookConfig.webhookSecret
                        : '••••••••••••••••••••••••••••••••'
                      : (loadingConfig ? 'Loading secret...' : '••••••••••••••••')}
                  </code>

                  {/* Eye Toggle Button */}
                  <button
                    type="button"
                    onClick={() => setShowSecret((prev) => !prev)}
                    title={showSecret ? 'Hide secret' : 'Show secret'}
                    style={{
                      border: '1px solid #cbd5e1',
                      background: showSecret ? '#ecfdf5' : '#ffffff',
                      borderRadius: 6,
                      padding: '4px 8px',
                      cursor: 'pointer',
                      color: showSecret ? '#059669' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>

                  {/* Copy Button */}
                  <button
                    type="button"
                    onClick={() => handleCopy(webhookConfig.webhookSecret || '', 'secret')}
                    disabled={!webhookConfig.webhookSecret}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: webhookConfig.webhookSecret ? 'pointer' : 'not-allowed',
                      color: copiedKey === 'secret' ? '#10b981' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0
                    }}
                  >
                    {copiedKey === 'secret' ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedKey === 'secret' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Steps Guide */}
              <div
                style={{
                  background: '#f0fdf4',
                  borderRadius: 12,
                  border: '1px solid #bbf7d0',
                  padding: '16px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#166534'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>How to connect in 2 minutes:</div>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Open WordPress Admin ➔ <strong>BTPL AI Assistant</strong> ➔ <strong>API & Model</strong>.</li>
                  <li>Find the <strong>Node.js HRMS / CRM Webhook Integration</strong> card.</li>
                  <li>Turn <strong>Enable Webhook Sync</strong> ON.</li>
                  <li>Paste the <strong>Webhook URL</strong> and <strong>Secret Token</strong> from above.</li>
                  <li>Click <strong>⚡ Test Webhook Connection</strong>. When it displays green <em>"Connection Successful (HTTP 200)"</em>, you are live!</li>
                </ol>
              </div>
            </div>

            <div style={{ marginTop: 24, textAlign: 'right' }}>
              <button
                onClick={() => setShowWebhookModal(false)}
                style={{
                  padding: '9px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIChats;
