import React from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  Bell, Check, BellRing, Megaphone, Briefcase, 
  Target, Umbrella, Info, DollarSign, UserCheck, Building, CheckSquare, Calendar, Cake
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const getNotificationIcon = (type, title = '') => {
  if (type === 'Birthday' || (title && title.toLowerCase().includes('birthday'))) {
    return <Cake size={18} color="#ffffff" />;
  }
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
    case 'Birthday': return <Cake size={18} color="#ffffff" />;
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
            {notifications.map((notification) => {
              const isBirthday = notification.type === 'Birthday' || (notification.title && notification.title.toLowerCase().includes('birthday'));
              const isWish = isBirthday && (notification.title && (notification.title.toLowerCase().includes('happy birthday') || notification.title.toLowerCase().includes('wish')));

              let rowBg = notification.isRead ? 'transparent' : '#f0f9ff';
              let hoverBg = notification.isRead ? '#f8fafc' : '#e0f2fe';
              let borderStyle = '1px solid #f1f5f9';
              let iconBg = notification.isRead ? '#f1f5f9' : '#dbeafe';
              let iconColor = notification.isRead ? '#64748b' : '#3b82f6';
              let titleColor = '#0f172a';
              let messageColor = notification.isRead ? '#64748b' : '#334155';
              let dotBg = '#3b82f6';

              if (isBirthday) {
                rowBg = notification.isRead 
                  ? 'linear-gradient(135deg, #fff5f8 0%, #fdf4f9 100%)' 
                  : 'linear-gradient(135deg, #fff0f5 0%, #fdf2f8 50%, #fce7f3 100%)';
                hoverBg = 'linear-gradient(135deg, #ffe4e9 0%, #fce7f3 100%)';
                borderStyle = notification.isRead ? '1px solid #fce7f3' : '1.5px solid #fbcfe8';
                iconBg = 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)';
                iconColor = '#ffffff';
                titleColor = '#831843';
                messageColor = notification.isRead ? '#831843' : '#4c0519';
                dotBg = '#ec4899';
              }

              return (
                <div 
                  key={notification._id}
                  onClick={() => handleNotificationClick(notification)}
                  style={{
                    padding: '16px 24px',
                    borderBottom: isBirthday ? 'none' : borderStyle,
                    background: rowBg,
                    border: isBirthday ? borderStyle : undefined,
                    borderRadius: isBirthday ? '12px' : 0,
                    margin: isBirthday ? '8px 14px' : 0,
                    boxShadow: isBirthday && !notification.isRead ? '0 4px 14px rgba(236, 72, 153, 0.12)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    transition: 'all 0.25s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = rowBg;
                  }}
                >
                  <div style={{ 
                    background: iconBg, 
                    color: iconColor, 
                    padding: '10px', 
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: isBirthday ? '0 4px 12px rgba(236, 72, 153, 0.25)' : 'none'
                  }}>
                    {getNotificationIcon(notification.type, notification.title)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '15px', color: titleColor, fontWeight: notification.isRead ? 600 : 700 }}>
                          {notification.title ? notification.title.replace(/[📅⏰]/g, '').trim() : ''}
                        </h4>
                        {isBirthday && (
                          <span style={{ 
                            background: isWish 
                              ? 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)' 
                              : 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', 
                            color: '#ffffff', 
                            fontSize: '11px', 
                            fontWeight: 700, 
                            padding: '2px 9px', 
                            borderRadius: '999px',
                            letterSpacing: '0.3px',
                            boxShadow: isWish 
                              ? '0 2px 6px rgba(236, 72, 153, 0.3)' 
                              : '0 2px 6px rgba(244, 63, 94, 0.3)'
                          }}>
                            {isWish ? '🎂 Birthday Wish' : '🎈 Birthday Alert'}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: isBirthday ? '#be185d' : '#94a3b8', fontWeight: 500 }}>
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: messageColor, lineHeight: '1.5' }}>
                      {notification.message ? notification.message.replace(/[📅⏰]/g, '').trim() : ''}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      background: dotBg, 
                      borderRadius: '50%', 
                      marginTop: '6px',
                      boxShadow: isBirthday ? '0 0 10px rgba(236, 72, 153, 0.7)' : 'none',
                      flexShrink: 0
                    }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Notifications;
