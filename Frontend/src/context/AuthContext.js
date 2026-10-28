import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';
import { io } from 'socket.io-client';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    return !(token && savedUser);
  });
  const [socket, setSocket] = useState(null);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await api.get('/users/me');
      const profile = res.data;
      setUser(profile);
      localStorage.setItem('user', JSON.stringify(profile));
    } catch (err) {
      // Token invalid — force logout
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const restoreUser = async () => {
      if (savedUser && !user) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.warn('AuthContext: failed to parse saved user', e);
          localStorage.removeItem('user');
        }
      }

      // If token exists, validate it in background by calling profile endpoint.
      if (token) {
        try {
          const res = await api.get('/users/me');
          const profile = res.data;
          // Use profile from server (in case it's more up-to-date)
          setUser(profile);
          localStorage.setItem('user', JSON.stringify(profile));
        } catch (err) {
          // Token invalid/expired — clear storage and force logout
          console.warn('AuthContext: token validation failed', err?.message || err);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    };

    restoreUser();

    // Re-fetch fresh permissions whenever the tab regains focus so that
    // role changes made by an admin take effect without a manual reload.
    const onFocus = () => { if (localStorage.getItem('token')) refreshUser(); };
    window.addEventListener('focus', onFocus);

    // Listen for global auth failure events (dispatched by axios interceptor)
    const onUnauthorized = () => {
      // Clear storage and update state; this keeps logout logic centralized
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      initialLoadRef.current = false;
    };

    window.addEventListener('auth:unauthorized', onUnauthorized);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('auth:unauthorized', onUnauthorized);
    };
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Notifications logic
  const [notifications, setNotifications] = useState([]);
  const [activeToast, setActiveToast] = useState(null);
  const initialLoadRef = useRef(false);

  // Socket setup
  useEffect(() => {
    let newSocket;
    const token = localStorage.getItem('token');

    if (user && token) {
      const apiUrl = process.env.REACT_APP_API_URL;
      const defaultSocketUrl = apiUrl.replace('/api', '');
      newSocket = io(process.env.REACT_APP_SOCKET_URL || defaultSocketUrl, {
        auth: { token },
        path: '/socket.io'
      });
      setSocket(newSocket);

      // Listen for notifications globally
      const handleNewNotification = (notification) => {
        setNotifications((prev) => [notification, ...prev]);
        setActiveToast(notification);

        // Play notification sound
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
        const soundUrl = isMac ? '/sounds/that-was-quick-606.m4r' : '/sounds/that-was-quick-606.mp3';
        const audio = new Audio(soundUrl);
        audio.play().catch(err => console.log('Browser blocked audio playback:', err));

        // Show Native Browser Notification unconditionally
        if ("Notification" in window) {
          if (Notification.permission === "granted") {
            new Notification(notification.title || 'New Notification', {
              body: notification.message || ''
            });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
              if (permission === "granted") {
                new Notification(notification.title || 'New Notification', {
                  body: notification.message || ''
                });
              }
            });
          }
        }
      };

      newSocket.on('new-notification', handleNewNotification);
    }

    return () => {
      if (newSocket) newSocket.close();
    };
  }, [user?._id]);

  // Fetch initial notifications globally and poll periodically
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!user || !token) return;

    const fetchNotifications = () => {
      api.get('/notifications')
        .then(res => {
          const fetchedNotifications = res.data || [];
          setNotifications(prev => {
            // Check if there are newly arrived unread notifications that were not in prev
            const prevIds = new Set((prev || []).map(p => p._id));
            const brandNew = fetchedNotifications.filter(n => !n.isRead && !prevIds.has(n._id));
            if (initialLoadRef.current && brandNew.length > 0) {
              setActiveToast(brandNew[0]);
              const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
              const soundUrl = isMac ? '/sounds/that-was-quick-606.m4r' : '/sounds/that-was-quick-606.mp3';
              const audio = new Audio(soundUrl);
              audio.play().catch(err => console.log('Browser blocked audio playback:', err));
            }
            return fetchedNotifications;
          });

          if (!initialLoadRef.current) {
            initialLoadRef.current = true;
            const unread = fetchedNotifications.filter(n => !n.isRead);
            if (unread.length > 0) {
              if (unread.length === 1) {
                setActiveToast(unread[0]);
              } else {
                setActiveToast({
                  title: 'New Notifications',
                  message: `You have ${unread.length} unread notifications waiting for you.`,
                  link: '/notifications'
                });
              }

              const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0 || navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
              const soundUrl = isMac ? '/sounds/that-was-quick-606.m4r' : '/sounds/that-was-quick-606.mp3';
              const audio = new Audio(soundUrl);
              audio.play().catch(err => console.log('Browser blocked audio on load:', err));
            }
          }
        })
        .catch(err => {
          if (err.response?.status !== 401) {
            console.error('Error fetching notifications:', err);
          }
        });
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  // Only re-run when the logged-in user identity changes, not on every
  // profile object re-fetch (which creates a new reference each time).
  }, [user?._id]);

  useEffect(() => {
    setUnreadNotificationsCount(notifications.filter(n => !n.isRead).length);
  }, [notifications]);

  const login = async (email, password) => {
    try {
      console.log('AuthContext: Attempting login for', email);
      const response = await api.post('/auth/login', { email, password });
      console.log('AuthContext: Login response received', response.data);
      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      setUser(user);

      console.log('AuthContext: User state updated', user);
      return { success: true };
    } catch (error) {
      console.error('AuthContext: Login error', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Login failed'
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    initialLoadRef.current = false;
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const hasPermission = useCallback((module, action) => {
    if (!user || !user.role) return false;

    const roleObj = user.role;
    const roleName = (typeof roleObj === 'object' && roleObj !== null ? roleObj.name : roleObj || '').toLowerCase().trim();
    const designation = (user.designation || '').toLowerCase().trim();
    const department = (user.department || '').toLowerCase().trim();
    const targetModule = String(module || '').toLowerCase().trim();
    const targetAction = String(action || '').toLowerCase().trim();

    if (roleName === 'admin' || roleName === 'super admin' || roleName === 'director') return true;

    // Check specific role permissions configured in database
    if (user.role.permissions && Array.isArray(user.role.permissions) && user.role.permissions.length > 0) {
      const modulePermission = user.role.permissions.find(
        p => p.module && p.module.toLowerCase().trim() === targetModule
      );
      if (modulePermission && Array.isArray(modulePermission.actions)) {
        if (modulePermission.actions.map(a => a.toLowerCase().trim()).includes(targetAction)) {
          return true;
        }
      }
    }

    // Sales, executives, telecallers, and BDEs should always have read permission on leads
    if (targetModule === 'leads' && targetAction === 'read') {
      const isSalesOrLeadRole =
        roleName.includes('sales') ||
        roleName.includes('executive') ||
        roleName.includes('telecaller') ||
        roleName.includes('bde') ||
        roleName.includes('business development') ||
        designation.includes('sales') ||
        designation.includes('telecaller') ||
        designation.includes('bde') ||
        department.includes('sales');

      if (isSalesOrLeadRole) return true;
    }

    return false;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser, hasPermission, refreshUser, socket, unreadNotificationsCount, setUnreadNotificationsCount, notifications, setNotifications, activeToast, setActiveToast }}>
      {children}
    </AuthContext.Provider>
  );
};
