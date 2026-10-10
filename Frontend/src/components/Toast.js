import React, { useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function Toast({ notification, onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        onClose();
      }, 6000); // 7 seconds
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: '#ffffff',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        width: '320px',
        zIndex: 9999,
        border: '1px solid #f1f5f9',
        animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: notification.link ? 'pointer' : 'default'
      }}
      onClick={() => {
        if (notification.link) {
          navigate(notification.link);
          onClose();
        }
      }}
    >
      <div style={{
        backgroundColor: '#eff6ff',
        color: '#3b82f6',
        padding: '8px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Bell size={20} />
      </div>

      <div style={{ flex: 1 }}>
        <h4 style={{ margin: '0 0 4px 0', color: '#0f172a', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          HRMS <span style={{ width: '4px', height: '4px', background: '#cbd5e1', borderRadius: '50%' }} /> {notification.title}
        </h4>
        <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: 1.4 }}>
          {notification.message}
        </p>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#94a3b8',
          padding: '4px',
          display: 'flex'
        }}
      >
        <X size={16} />
      </button>

      <style>
        {`
          @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}
      </style>
    </div>
  );
}

export default Toast;
