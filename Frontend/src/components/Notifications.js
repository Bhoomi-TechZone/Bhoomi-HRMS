import React from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  Bell, Check, BellRing, Megaphone, Briefcase, 
  Target, Umbrella, Info, DollarSign, UserCheck, Building, CheckSquare, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getNotificationIcon = (type, title = '') => {
  if (type === 'Follow-up' || type === 'Followup' || (title && (title.includes('Follow-up') || title.includes('Followup')))) {
    return <Calendar size={18} color="#0284c7" />;
  }
  switch(type) {
    case 'Announcement': return <Megaphone size={18} />;
    case 'Project': return <Briefcase size={18} />;
    case 'Task': return <CheckSquare size={18} />;
    case 'Leave': return <Umbrella size={18} />;
    case 'Deal': return <DollarSign size={18} />;
    case 'Contact': return <UserCheck size={18} />;
    case 'Company': return <Building size={18} />;
    case 'CRM':
    case 'Client': return <Briefcase size={18} />;
    default: return <Bell size={18} />;
  }
};

function Notifications() {
  const { notifications, setNotifications, unreadNotificationsCount } = useAuth();
  const navigate = useNavigate();

  const handleNotificationClick = async (notification) => {
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

  const clearAll = async () => {
    try {
      await api.delete('/notifications/clear-all');
      setNotifications([]);
    } catch (err) {
      console.error('Error clearing notifications', err);
    }
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 60000); // in minutes
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const hours = Math.floor(diff / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="page-container" style={{ padding: '28px', background: '#f8fafc', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={24} color="#667eea" />
            Notifications
            {unreadNotificationsCount > 0 && (
              <span style={{ background: '#ef4444', color: 'white', fontSize: '12px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
                {unreadNotificationsCount} New
              </span>
            )}
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>View and manage your recent alerts</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {unreadNotificationsCount > 0 && (
            <button onClick={markAllAsRead} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '8px', color: '#475569', fontWeight: 500, cursor: 'pointer' }}>
              <Check size={16} /> Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', border: '1px solid #fee2e2', padding: '8px 16px', borderRadius: '8px', color: '#ef4444', fontWeight: 500, cursor: 'pointer' }}>
              Clear all
            </button>
          )}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', flex: 1, overflowY: 'auto' }}>
            <BellRing size={48} strokeWidth={1} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <h3 style={{ margin: 0, fontSize: '18px', color: '#475569', fontWeight: 600 }}>All caught up!</h3>
            <p style={{ marginTop: '8px', fontSize: '14px' }}>You have no new notifications.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
            {notifications.map((notification) => (
              <div 
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid #f1f5f9',
                  background: notification.isRead ? 'transparent' : '#f0f9ff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (notification.isRead) e.currentTarget.style.background = '#f8fafc';
                  else e.currentTarget.style.background = '#e0f2fe';
                }}
                onMouseLeave={(e) => {
                  if (notification.isRead) e.currentTarget.style.background = 'transparent';
                  else e.currentTarget.style.background = '#f0f9ff';
                }}
              >
                <div style={{ 
                  background: notification.isRead ? '#f1f5f9' : '#dbeafe', 
                  color: notification.isRead ? '#64748b' : '#3b82f6', 
                  padding: '10px', 
                  borderRadius: '10px' 
                }}>
                  {getNotificationIcon(notification.type, notification.title)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: notification.isRead ? 500 : 700 }}>
                      {notification.title ? notification.title.replace(/[📅⏰]/g, '').trim() : ''}
                    </h4>
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: notification.isRead ? '#64748b' : '#334155', lineHeight: '1.5' }}>
                    {notification.message ? notification.message.replace(/[📅⏰]/g, '').trim() : ''}
                  </p>
                </div>
                {!notification.isRead && (
                  <div style={{ width: '8px', height: '8px', background: '#3b82f6', borderRadius: '50%', marginTop: '6px' }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Notifications;
