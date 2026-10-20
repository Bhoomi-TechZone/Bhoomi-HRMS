import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, X, Calendar, Clock, ExternalLink,
  DollarSign, CheckSquare, Megaphone, Umbrella, Briefcase
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getToastTheme = (type, title = '') => {
  const t = (type || '').toLowerCase();
  const titleLower = (title || '').toLowerCase();

  if (t === 'follow-up' || t === 'followup' || titleLower.includes('follow-up') || titleLower.includes('followup')) {
    return {
      icon: <Calendar size={18} color="#0284c7" />,
      bg: '#f0f9ff',
      borderColor: '#0284c7',
      badgeBg: '#e0f2fe',
      badgeColor: '#0369a1',
      badgeText: 'Follow-up'
    };
  }
  if (t === 'task' || titleLower.includes('task')) {
    return {
      icon: <CheckSquare size={18} color="#059669" />,
      bg: '#f0fdf4',
      borderColor: '#059669',
      badgeBg: '#dcfce7',
      badgeColor: '#15803d',
      badgeText: 'Task'
    };
  }
  if (t === 'deal' || t === 'payment' || titleLower.includes('deal') || titleLower.includes('payment')) {
    return {
      icon: <DollarSign size={18} color="#0284c7" />,
      bg: '#f0f9ff',
      borderColor: '#0284c7',
      badgeBg: '#e0f2fe',
      badgeColor: '#0369a1',
      badgeText: 'Deal'
    };
  }
  if (t === 'leave') {
    return {
      icon: <Umbrella size={18} color="#d97706" />,
      bg: '#fffbeb',
      borderColor: '#d97706',
      badgeBg: '#fef3c7',
      badgeColor: '#b45309',
      badgeText: 'Leave'
    };
  }
  if (t === 'announcement') {
    return {
      icon: <Megaphone size={18} color="#7c3aed" />,
      bg: '#f5f3ff',
      borderColor: '#7c3aed',
      badgeBg: '#ede9fe',
      badgeColor: '#6d28d9',
      badgeText: 'Announcement'
    };
  }
  if (t === 'crm' || t === 'client' || t === 'contact' || t === 'company') {
    return {
      icon: <Briefcase size={18} color="#0284c7" />,
      bg: '#f0f9ff',
      borderColor: '#0284c7',
      badgeBg: '#e0f2fe',
      badgeColor: '#0369a1',
      badgeText: 'CRM'
    };
  }

  return {
    icon: <Bell size={18} color="#0284c7" />,
    bg: '#eff6ff',
    borderColor: '#3b82f6',
    badgeBg: '#eff6ff',
    badgeColor: '#1d4ed8',
    badgeText: 'Notification'
  };
};

const parseNotificationContent = (message) => {
  if (!message) return { mainText: '', notes: '' };

  const cleanMsg = message.replace(/[📅⏰]/g, '').trim();

  // Extract optional notes
  if (cleanMsg.includes(' | Notes: "') || cleanMsg.includes('| Notes: "')) {
    const parts = cleanMsg.split(/\s*\|\s*Notes:\s*"/i);
    const mainText = parts[0].trim();
    const notes = parts[1] ? parts[1].replace(/"$/, '').trim() : '';
    return { mainText, notes };
  }
  if (cleanMsg.includes('Notes: "')) {
    const parts = cleanMsg.split(/Notes:\s*"/i);
    const mainText = parts[0].replace(/\|\s*$/, '').trim();
    const notes = parts[1] ? parts[1].replace(/"$/, '').trim() : '';
    return { mainText, notes };
  }
  if (cleanMsg.includes(' | Purpose: ')) {
    const parts = cleanMsg.split(/\s*\|\s*Purpose:\s*/i);
    return { mainText: parts[0].trim(), notes: parts[1] ? parts[1].trim() : '' };
  }

  return { mainText: cleanMsg, notes: '' };
};

function Toast({ notification, onClose }) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const remainingTimeRef = useRef(7500);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);

  useEffect(() => {
    if (!notification) return;

    remainingTimeRef.current = 7500;
    startTimeRef.current = Date.now();

    timerRef.current = setTimeout(() => {
      onClose();
    }, remainingTimeRef.current);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification, onClose]);

  // Pause auto-dismiss timer on mouse hover so user can comfortably read longer content
  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        const elapsed = Date.now() - startTimeRef.current;
        remainingTimeRef.current = Math.max(1200, remainingTimeRef.current - elapsed);
      }
    } else {
      if (notification && remainingTimeRef.current > 0) {
        startTimeRef.current = Date.now();
        timerRef.current = setTimeout(() => {
          onClose();
        }, remainingTimeRef.current);
      }
    }
  }, [isHovered, notification, onClose]);

  if (!notification) return null;

  const theme = getToastTheme(notification.type, notification.title);
  const cleanTitle = (notification.title || '').replace(/[📅⏰]/g, '').trim();
  const { mainText, notes } = parseNotificationContent(notification.message);

  const handleCardClick = () => {
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  return (
    <div
      className="hrms-toast-notification"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: '#ffffff',
        boxShadow: '0 12px 30px -4px rgba(15, 23, 42, 0.1), 0 4px 8px -2px rgba(15, 23, 42, 0.04)',
        borderRadius: '12px',
        padding: '14px 16px 16px 16px',
        width: 'clamp(340px, 92vw, 420px)',
        zIndex: 99999,
        border: '1px solid #e2e8f0',
        boxSizing: 'border-box',
        animation: 'toastSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: notification.link ? 'pointer' : 'default',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Left Circular / Rounded Badge Icon */}
        <div
          style={{
            backgroundColor: theme.bg,
            border: `1px solid ${theme.borderColor}33`,
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: '1px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
          }}
        >
          {theme.icon}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Top Metadata Row: App Tag + Category Badge + Just Now + Close Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '5px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                  color: '#475569',
                  background: '#f1f5f9',
                  padding: '1.5px 6px',
                  borderRadius: '4px'
                }}
              >
                HRMS
              </span>
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: theme.badgeColor,
                  background: theme.badgeBg,
                  padding: '1.5px 7px',
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center'
                }}
              >
                {theme.badgeText}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Clock size={11} /> Just now
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '3px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#0f172a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#94a3b8';
                }}
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Title on its own clean line */}
          <h4
            style={{
              margin: '0 0 5px 0',
              color: '#0f172a',
              fontSize: '13.5px',
              fontWeight: 700,
              lineHeight: 1.35,
              wordBreak: 'break-word'
            }}
          >
            {cleanTitle}
          </h4>

          {/* Main Message Body */}
          <p
            style={{
              margin: 0,
              color: '#475569',
              fontSize: '12.5px',
              lineHeight: 1.45,
              wordBreak: 'break-word'
            }}
          >
            {mainText}
          </p>

          {/* Notes Callout Box (if present) */}
          {notes && (
            <div
              style={{
                marginTop: '8px',
                padding: '6px 10px',
                backgroundColor: '#f8fafc',
                border: '1px solid #f1f5f9',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#334155',
                lineHeight: 1.45,
                wordBreak: 'break-word'
              }}
            >
              <span style={{ fontWeight: 600, color: '#64748b', marginRight: '4px' }}>Notes:</span>
              <span>"{notes}"</span>
            </div>
          )}

          {/* Action Link Row */}
          {notification.link && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '9px',
                paddingTop: '6px',
                borderTop: '1px solid #f1f5f9'
              }}
            >
              <span
                style={{
                  fontSize: '11.5px',
                  color: '#0284c7',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span>View details</span>
                <ExternalLink size={11} />
              </span>
              <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>Click to open</span>
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          @keyframes toastSlideIn {
            from {
              transform: translateY(20px) scale(0.96);
              opacity: 0;
            }
            to {
              transform: translateY(0) scale(1);
              opacity: 1;
            }
          }

          @media (max-width: 480px) {
            .hrms-toast-notification {
              bottom: 14px !important;
              right: 14px !important;
              left: 14px !important;
              width: auto !important;
            }
          }
        `}
      </style>
    </div>
  );
}

export default Toast;
