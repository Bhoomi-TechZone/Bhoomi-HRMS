import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, Check, BellRing, Trash2, Megaphone, Briefcase, 
  Target, Umbrella, Info, Circle, DollarSign, Users, Building, CheckSquare, UserCheck, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const getIconForType = (type, title = '') => {
  if (type === 'Follow-up' || type === 'Followup' || (title && (title.includes('Follow-up') || title.includes('Followup')))) {
    return <Calendar size={16} color="#0284c7" />;
  }
  switch(type) {
    case 'Announcement': return <Megaphone size={16} color="#3b82f6" />;
    case 'Project': return <Briefcase size={16} color="#8b5cf6" />;
    case 'Task': return <CheckSquare size={16} color="#10b981" />;
    case 'Leave': return <Umbrella size={16} color="#f59e0b" />;
    case 'Deal':
    case 'Payment': return <DollarSign size={16} color="#10b981" />;
    case 'Contact': return <UserCheck size={16} color="#06b6d4" />;
    case 'Company': return <Building size={16} color="#8b5cf6" />;
    case 'Lead':
    case 'CRM':
    case 'Client': return <Briefcase size={16} color="#3b82f6" />;
    default: return <Info size={16} color="#64748b" />;
  }
};

function NotificationBell({ filterType, filterTypes }) {
  const { user, notifications: allNotifications, setNotifications } = useAuth();
  
  // Filter notifications based on filterType or filterTypes if provided
  const notifications = (() => {
    if (Array.isArray(filterTypes) && filterTypes.length > 0) {
      return allNotifications.filter(n => filterTypes.includes(n.type));
    }
    if (!filterType) return allNotifications;
    if (filterType === 'CRM' || filterType === 'Pipeline' || filterType === 'Lead') {
      return allNotifications.filter(n => ['Deal', 'Payment', 'Contact', 'Company', 'Task', 'CRM', 'Client', 'Follow-up', 'Followup', 'Lead'].includes(n.type));
    }
    return allNotifications.filter(n => n.type === filterType);
  })();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = async (notification) => {
    setIsOpen(false);
    try {
      if (!notification.isRead) {
        await api.patch(`/notifications/${notification._id}/read`);
        setNotifications(prev => prev.map(n => n._id === notification._id ? { ...n, isRead: true } : n));
      }
      if (notification.link) {
        navigate(notification.link);
      }
    } catch (err) {
      console.error('Error marking notification as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('Error marking all as read', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
    } catch (err) {
      console.error('Error clearing all notifications', err);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#475569',
          borderRadius: '50%',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {unreadCount > 0 ? <BellRing size={22} color="#3b775e" /> : <Bell size={22} />}
        
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: '#ef4444',
            color: 'white',
            fontSize: '10px',
            fontWeight: 'bold',
            borderRadius: '50%',
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 4px'
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          width: 'min(385px, calc(100vw - 24px))',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
          zIndex: 1000,
          marginTop: '8px',
          overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc'
          }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600', color: '#1e293b' }}>Notifications</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#2563eb'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#3b82f6'}
                >
                  <Check size={14} /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button 
                  onClick={clearAllNotifications}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0,
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#ef4444'}
                >
                  <Trash2 size={14} /> Clear all
                </button>
              )}
            </div>
          </div>
          
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 24px', textAlign: 'center', color: '#64748b', fontSize: '13.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <Bell size={32} color="#cbd5e1" />
                <span>You're all caught up!</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: notif.isRead ? '#ffffff' : '#f8fafc',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseLeave={(e) => e.currentTarget.style.background = notif.isRead ? '#ffffff' : '#f8fafc'}
                >
                  {/* Unread dot indicator */}
                  {!notif.isRead && (
                    <div style={{ position: 'absolute', left: '6px', top: '24px' }}>
                      <Circle size={6} fill="#3b82f6" color="#3b82f6" />
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: notif.isRead ? '#f1f5f9' : '#eff6ff',
                    flexShrink: 0
                  }}>
                    {getIconForType(notif.type, notif.title)}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span style={{ 
                        fontSize: '13.5px', 
                        fontWeight: notif.isRead ? '500' : '600', 
                        color: notif.isRead ? '#334155' : '#0f172a', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        paddingRight: '8px' 
                      }}>
                        {notif.title ? notif.title.replace(/[📅⏰]/g, '').trim() : ''}
                      </span>
                      <span style={{ fontSize: '11px', color: notif.isRead ? '#94a3b8' : '#64748b', whiteSpace: 'nowrap', fontWeight: '500', marginTop: '2px' }}>
                        {new Date(notif.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.45', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {notif.message ? notif.message.replace(/[📅⏰]/g, '').replace(/\s*\|\s*Notes:\s*/i, ' — Notes: ').trim() : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div 
            onClick={() => { setIsOpen(false); navigate('/notifications'); }}
            style={{
              padding: '12px',
              textAlign: 'center',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}
          >
            <span style={{ fontSize: '13px', color: '#3b82f6', fontWeight: '600' }}>View Notification Center</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
