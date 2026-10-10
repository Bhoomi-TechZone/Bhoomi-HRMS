import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import './Broadcasts.css';

function Broadcasts() {
  const { hasPermission, user } = useAuth();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expandedBroadcastId, setExpandedBroadcastId] = useState(null);
  const [commentText, setCommentText] = useState({});
  const [adminView, setAdminView] = useState(false);
  const [allComments, setAllComments] = useState([]);
  const [commentStats, setCommentStats] = useState(null);
  const [editingBroadcast, setEditingBroadcast] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'medium',
    mediaType: null,
    mediaFile: null,
    mediaCaption: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [reactions, setReactions] = useState({});
  const [animatingReacts, setAnimatingReacts] = useState({});
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openPinnedMenuId, setOpenPinnedMenuId] = useState(null);
  const [viewPostBroadcast, setViewPostBroadcast] = useState(null);
  const [announcementPage, setAnnouncementPage] = useState(1);
  const announcementListRef = useRef(null);
  // Likers modal state
  const [likersModal, setLikersModal] = useState({ open: false, likers: [], loading: false, broadcastTitle: '' });

  const isAdmin = useCallback(() => {
    return user && user.role && (user.role.name === 'Admin' || user.role.name === 'HR Manager');
  }, [user]);

  const canCreate = hasPermission('broadcasts', 'create');
  const canUpdate = hasPermission('broadcasts', 'update');
  const canDelete = hasPermission('broadcasts', 'delete');

  const fetchBroadcasts = useCallback(async () => {
    try {
      setLoading(true);
      let response;
      if (adminView && isAdmin()) {
        response = await api.get('/broadcasts/admin/all');
      } else {
        response = await api.get('/broadcasts');
      }
      setBroadcasts(response.data);

      // Mark all broadcasts as viewed (only for regular view)
      if (!adminView) {
        response.data.forEach(async (broadcast) => {
          try {
            await api.post(`/broadcasts/${broadcast._id}/view`);
          } catch (err) {
            // Silently fail
          }
        });
      }
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    } finally {
      setLoading(false);
    }
  }, [adminView, isAdmin]);

  const fetchAllComments = useCallback(async () => {
    try {
      const response = await api.get('/broadcasts/admin/comments/all');
      setAllComments(response.data);
    } catch (error) {
      console.error('Error fetching all comments:', error);
    }
  }, []);

  const fetchCommentStats = useCallback(async () => {
    try {
      const response = await api.get('/broadcasts/admin/comments/stats');
      setCommentStats(response.data);
    } catch (error) {
      console.error('Error fetching comment stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
    if (isAdmin()) {
      fetchCommentStats();
    }
  }, [fetchBroadcasts, isAdmin, fetchCommentStats]);

  useEffect(() => {
    if (adminView && isAdmin()) {
      fetchAllComments();
    }
    fetchBroadcasts(); // Refetch broadcasts when switching views
  }, [adminView, fetchBroadcasts, isAdmin, fetchAllComments]);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuId(null);
      setOpenPinnedMenuId(null);
    };
    if (openMenuId || openPinnedMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId, openPinnedMenuId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/broadcasts', formData);
      setShowModal(false);
      setFormData({ title: '', message: '', priority: 'medium' });
      fetchBroadcasts();
    } catch (error) {
      alert('Error creating broadcast');
    }
  };

  const handleEdit = (broadcast) => {
    setEditingBroadcast(broadcast);
    setFormData({
      title: broadcast.title,
      message: broadcast.message,
      priority: broadcast.priority,
      mediaType: null,
      mediaFile: null,
      mediaCaption: ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const updatePayload = {
        title: formData.title,
        message: formData.message,
        priority: formData.priority
      };
      
      await api.put(`/broadcasts/${editingBroadcast._id}`, updatePayload);
      
      setShowEditModal(false);
      setEditingBroadcast(null);
      setFormData({ title: '', message: '', priority: 'medium', mediaType: null, mediaFile: null, mediaCaption: '' });
      fetchBroadcasts();
    } catch (error) {
      alert('Error updating broadcast');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this broadcast?')) {
      try {
        await api.delete(`/broadcasts/${id}`);
        fetchBroadcasts();
      } catch (error) {
        alert('Error deleting broadcast');
      }
    }
  };

  const handleAddComment = async (broadcastId) => {
    const comment = commentText[broadcastId]?.trim();
    if (!comment) {
      alert('Comment cannot be empty');
      return;
    }

    try {
      await api.post(`/broadcasts/${broadcastId}/comments`, { comment });
      setCommentText({ ...commentText, [broadcastId]: '' });
      await fetchBroadcasts();
      // If view-post modal is open for this broadcast, refresh it from updated list
      setViewPostBroadcast(prev =>
        prev && prev._id === broadcastId
          ? { ...prev, _needsRefresh: Date.now() }
          : prev
      );
    } catch (error) {
      alert('Error adding comment');
    }
  };

  const handleDeleteComment = async (broadcastId, commentId) => {
    if (window.confirm('Delete this comment?')) {
      try {
        if (isAdmin()) {
          await api.delete(`/broadcasts/admin/comments/${commentId}`);
        } else {
          await api.delete(`/broadcasts/${broadcastId}/comments/${commentId}`);
        }
        fetchBroadcasts();
        if (adminView) {
          fetchAllComments();
        }
      } catch (error) {
        alert('Error deleting comment');
      }
    }
  };

  const toggleAdminView = () => {
    setAdminView(!adminView);
    setExpandedBroadcastId(null);
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      low: 'badge-info',
      medium: 'badge-warning',
      high: 'badge-danger'
    };
    return badges[priority] || 'badge-info';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: '#f87171',
      medium: '#60a5fa',
      low: '#34d399'
    };
    return colors[priority] || '#60a5fa';
  };

  const handleReaction = async (broadcastId) => {
    const isCurrentlyLiked = broadcasts.find(b => b._id === broadcastId)?.likes?.some(id => String(id) === String(user?._id || user?.id));
    if (!isCurrentlyLiked) {
      setAnimatingReacts(prev => ({ ...prev, [broadcastId]: true }));
      setTimeout(() => setAnimatingReacts(prev => { const n = { ...prev }; delete n[broadcastId]; return n; }), 700);
    }
    try {
      // Optimistic update
      setBroadcasts(prev => prev.map(b => {
        if (b._id === broadcastId) {
          const alreadyLiked = b.likes?.some(id => String(id) === String(user?._id || user?.id));
          const newLikes = alreadyLiked 
            ? b.likes.filter(id => String(id) !== String(user?._id || user?.id))
            : [...(b.likes || []), user?._id || user?.id];
          return { ...b, likes: newLikes, likesCount: newLikes.length };
        }
        return b;
      }));

      await api.post(`/broadcasts/${broadcastId}/react`);
    } catch (error) {
      console.error('Error adding reaction:', error);
      fetchBroadcasts(); // Revert on error
    }
  };

  const handleShowLikers = async (broadcastId, broadcastTitle) => {
    setLikersModal({ open: true, likers: [], loading: true, broadcastTitle });
    try {
      const res = await api.get(`/broadcasts/${broadcastId}/likes`);
      setLikersModal({ open: true, likers: res.data, loading: false, broadcastTitle });
    } catch (err) {
      setLikersModal({ open: true, likers: [], loading: false, broadcastTitle });
    }
  };

  const handleShare = async (broadcastId) => {
    try {
      await api.post(`/broadcasts/${broadcastId}/share`);
      fetchBroadcasts();
    } catch (error) {
      console.error('Error sharing broadcast:', error);
    }
  };

  const handleTogglePin = async (broadcast) => {
    try {
      const nextPriority = broadcast.priority === 'high' ? 'medium' : 'high';
      await api.put(`/broadcasts/${broadcast._id}`, { priority: nextPriority });
      fetchBroadcasts();
    } catch (error) {
      alert('Error updating pin status');
    }
  };

  const filteredBroadcasts = broadcasts.filter(b => {
    const creatorName = `${b.createdBy?.firstName || ''} ${b.createdBy?.lastName || ''}`.toLowerCase();
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      creatorName.includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter ? b.priority === priorityFilter : true;

    let matchesDate = true;
    if (dateFilter) {
      const bDate = new Date(b.createdAt);
      const now = new Date();
      if (dateFilter === 'today') {
        matchesDate = bDate.toDateString() === now.toDateString();
      } else if (dateFilter === 'week') {
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesDate = bDate >= lastWeek;
      } else if (dateFilter === 'month') {
        matchesDate = bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear();
      }
    }

    return matchesSearch && matchesPriority && matchesDate;
  });

  const pinnedBroadcasts = filteredBroadcasts.filter(b => b.priority === 'high');
  const announcementsPerPage = 10;
  const totalAnnouncementPages = Math.max(1, Math.ceil(filteredBroadcasts.length / announcementsPerPage));
  const paginatedAnnouncements = filteredBroadcasts.slice(
    (announcementPage - 1) * announcementsPerPage,
    announcementPage * announcementsPerPage
  );

  const handleAnnouncementPageChange = (nextPage) => {
    const page = Math.min(Math.max(nextPage, 1), totalAnnouncementPages);
    setAnnouncementPage(page);
    if (announcementListRef.current) {
      announcementListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (announcementPage > totalAnnouncementPages) {
      setAnnouncementPage(totalAnnouncementPages);
    }
  }, [announcementPage, totalAnnouncementPages]);

  useEffect(() => {
    setAnnouncementPage(1);
  }, [dateFilter, searchTerm, priorityFilter]);

  useEffect(() => {
    if (!viewPostBroadcast) return;
    const index = broadcasts.findIndex((b) => b._id === viewPostBroadcast._id);
    if (index === -1) return;
    const targetPage = Math.floor(index / announcementsPerPage) + 1;
    if (targetPage !== announcementPage) {
      setAnnouncementPage(targetPage);
    }
  }, [viewPostBroadcast, broadcasts, announcementsPerPage, announcementPage]);

  return (
    <div className="broadcast-page-wrapper">
      {/* Main Content Area - hidden when viewing a post */}
      {!viewPostBroadcast && <><div className="broadcast-main-content">
        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
            <span className="page-title" style={{ color: '#111827' }}>Announcement</span>
          </div>
          <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <NotificationBell filterType="Announcement" />
            <div className="date-filter-btn">
              <div className="date-filter-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'inherit' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>{dateFilter ? (dateFilter === 'today' ? 'Today' : dateFilter === 'week' ? 'This Week' : 'This Month') : 'Date Range'}</span>
              </div>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="">Date Range</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>
        </div>

        {/* Create Announcement Section */}
        {canCreate && (
          <div className="create-announcement-box">
            <div className="user-avatar">
              <div className="avatar-circle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
              </div>
            </div>
            <input
              type="text"
              className="create-input search-live-input"
              placeholder="Search by title or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="create-actions">
              <button className="btn-generate" onClick={() => setShowModal(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                </svg>
                <span>Generate</span>
              </button>
            </div>
          </div>
        )}

        {/* Announcements Feed */}
        <div className="announcements-feed">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="announcement-post skeleton-card">
                <div className="post-header">
                  <div className="post-author">
                    <div className="skeleton skeleton-avatar"></div>
                    <div className="author-info">
                      <div className="skeleton skeleton-line" style={{ width: '140px', height: '13px' }}></div>
                      <div className="skeleton skeleton-line" style={{ width: '100px', height: '11px', marginTop: '6px' }}></div>
                    </div>
                  </div>
                </div>
                <div className="skeleton skeleton-line" style={{ width: '70px', height: '20px', marginBottom: '10px', borderRadius: '5px' }}></div>
                <div className="skeleton skeleton-line" style={{ width: '75%', height: '15px', marginBottom: '8px' }}></div>
                <div className="skeleton skeleton-line" style={{ width: '100%', height: '12px', marginBottom: '5px' }}></div>
                <div className="skeleton skeleton-line" style={{ width: '90%', height: '12px', marginBottom: '5px' }}></div>
                <div className="skeleton skeleton-line" style={{ width: '80%', height: '12px', marginBottom: '14px' }}></div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div className="skeleton skeleton-btn"></div>
                  <div className="skeleton skeleton-btn"></div>
                  <div className="skeleton skeleton-btn"></div>
                  <div className="skeleton skeleton-btn"></div>
                </div>
              </div>
            ))
          ) : filteredBroadcasts.length === 0 ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21.5 12H16c-.7 2-2 3-4 3s-3.3-1-4-3H2.5"/>
                <path d="M5.5 5.1L2 12v6c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2v-6l-3.4-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.8 1.1z"/>
              </svg>
              <h3>No announcements found</h3>
              <p>Try adjusting your filters or search term.</p>
            </div>
          ) : (
            filteredBroadcasts.map((broadcast) => (
            <div key={broadcast._id} className="announcement-post">
              {/* Post Header */}
              <div className="post-header">
                <div className="post-author">
                  <div className="author-avatar">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                    </svg>
                  </div>
                  <div className="author-info">
                    <h4 className="author-name">
                      {broadcast.createdBy?.firstName} {broadcast.createdBy?.lastName}
                    </h4>
                    <p className="author-meta">
                      {broadcast.createdBy?.role?.name || 'Employee'} · {new Date(broadcast.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}, {new Date(broadcast.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="post-menu">
                  <div className="post-badge post-badge--header" style={{ color: getPriorityColor(broadcast.priority) }}>
                    <span className="badge-dot" style={{ background: getPriorityColor(broadcast.priority) }} aria-hidden="true"></span>
                    {broadcast.priority ? broadcast.priority.charAt(0).toUpperCase() + broadcast.priority.slice(1) : 'Medium'}
                  </div>
                  {canUpdate && (
                    <button
                      className={`pin-btn${broadcast.priority === 'high' ? ' pin-btn--active' : ''}`}
                      title={broadcast.priority === 'high' ? 'Unpin' : 'Pin'}
                      onClick={() => handleTogglePin(broadcast)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={broadcast.priority === 'high' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    </button>
                  )}
                  {(canUpdate || canDelete) && (
                    <div className="menu-btn-wrapper">
                      <button className="menu-btn" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === broadcast._id ? null : broadcast._id); }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5"/>
                          <circle cx="12" cy="12" r="1.5"/>
                          <circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>
                      {openMenuId === broadcast._id && (
                        <div className="post-dropdown-menu">
                          {canUpdate && (
                            <button className="post-dropdown-item" onClick={() => { setOpenMenuId(null); handleEdit(broadcast); }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Edit
                            </button>
                          )}
                          {canUpdate && (
                            <button className="post-dropdown-item" onClick={() => { setOpenMenuId(null); handleTogglePin(broadcast); }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                              </svg>
                              {broadcast.priority === 'high' ? 'Unpin' : 'Pin to Top'}
                            </button>
                          )}
                          {canDelete && (
                            <button className="post-dropdown-item post-dropdown-item--danger" onClick={() => { setOpenMenuId(null); handleDelete(broadcast._id); }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/>
                                <path d="M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Post Content */}
              <div className="post-content">
                <h3 className="post-title">{broadcast.title}</h3>
                <p className="post-message">{broadcast.message}</p>
              </div>

              {/* Post Stats */}
              <div className="post-stats">
                <span
                  className="stat-reactions"
                  style={{ cursor: (broadcast.likesCount || 0) > 0 ? 'pointer' : 'default' }}
                  onClick={() => (broadcast.likesCount || 0) > 0 && handleShowLikers(broadcast._id, broadcast.title)}
                  title={(broadcast.likesCount || 0) > 0 ? 'See who liked this' : ''}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={broadcast.likes?.some(id => String(id) === String(user?._id || user?.id)) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                  {broadcast.likesCount || 0} {broadcast.likesCount === 1 ? 'Like' : 'Likes'}
                </span>
                <span className="stat-engagement">
                  {broadcast.comments?.length || 0} Comments
                </span>
              </div>

              {/* Post Actions */}
              <div className="post-actions">
                <button
                  className={`action-btn react-btn${broadcast.likes?.some(id => String(id) === String(user?._id || user?.id)) ? ' is-liked' : ''}${animatingReacts[broadcast._id] ? ' is-animating' : ''}`}
                  onClick={() => handleReaction(broadcast._id)}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'white'; }}
                >
                  <span className="react-icon">
                    {animatingReacts[broadcast._id] && (
                      <span className="react-burst" aria-hidden="true">
                        <span className="burst-particle burst-particle--1"></span>
                        <span className="burst-particle burst-particle--2"></span>
                        <span className="burst-particle burst-particle--3"></span>
                        <span className="burst-particle burst-particle--4"></span>
                        <span className="burst-particle burst-particle--5"></span>
                        <span className="burst-particle burst-particle--6"></span>
                      </span>
                    )}
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={broadcast.likes?.some(id => String(id) === String(user?._id || user?.id)) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                  </span>
                  <span>React</span>
                </button>
                <button className="action-btn" onClick={() => setExpandedBroadcastId(expandedBroadcastId === broadcast._id ? null : broadcast._id)} onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'white'; }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>Comment</span>
                </button>
                {canUpdate && (
                  <button className="action-btn" onClick={() => handleShare(broadcast._id)} onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'white'; }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                      <circle cx="18" cy="5" r="3"/>
                      <circle cx="6" cy="12" r="3"/>
                      <circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    <span>Mail</span>
                  </button>
                )}
                <button className="action-btn" onClick={() => setViewPostBroadcast(broadcast)} onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'white'; }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>View Full Post</span>
                </button>
              </div>

              {/* Comments Section */}
              {expandedBroadcastId === broadcast._id && (
                <div className="comments-section">
                  <h4 className="comments-title">Comments ({broadcast.comments?.length || 0})</h4>
                  <div className="comments-list">
                    {broadcast.comments?.map(comment => (
                      <div key={comment._id} className="comment-item">
                        <div className="comment-avatar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        </div>
                        <div className="comment-content">
                          <strong className="comment-author">{comment.commentedBy?.firstName}:</strong>
                          <span className="comment-text">{comment.comment}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="comment-input-wrap">
                    <input
                      type="text"
                      className="comment-input"
                      placeholder="Add a comment..."
                      value={commentText[broadcast._id] || ''}
                      onChange={(e) => setCommentText({ ...commentText, [broadcast._id]: e.target.value })}
                    />
                    <button className="btn-post-comment" onClick={() => handleAddComment(broadcast._id)} onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'white'; }}>
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            ))
          )}
        </div>
      </div>

      {/* Right Sidebar - Pinned Announcements */}
      <div className="broadcast-sidebar-right">
        <div className="pinned-section">
          <div className="pinned-header">
            <h3>Pinned Announcement</h3>
          </div>
          <div className="pinned-list">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="pinned-item skeleton-card">
                  <div className="pinned-author">
                    <div className="skeleton skeleton-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%' }}></div>
                    <div className="pinned-info" style={{ flex: 1 }}>
                      <div className="skeleton skeleton-line" style={{ width: '110px', height: '12px', marginBottom: '6px' }}></div>
                      <div className="skeleton skeleton-line" style={{ width: '60px', height: '10px' }}></div>
                    </div>
                  </div>
                  <div className="skeleton skeleton-line" style={{ width: '70px', height: '11px', margin: '8px 0' }}></div>
                  <div className="skeleton skeleton-line" style={{ width: '90%', height: '13px', marginBottom: '6px' }}></div>
                  <div className="skeleton skeleton-line" style={{ width: '100%', height: '11px', marginBottom: '4px' }}></div>
                  <div className="skeleton skeleton-line" style={{ width: '85%', height: '11px', marginBottom: '10px' }}></div>
                  <div className="skeleton skeleton-btn" style={{ width: '80px', height: '26px', borderRadius: '6px' }}></div>
                </div>
              ))
            ) : pinnedBroadcasts.map((pin) => (
              <div key={pin._id} className="pinned-item">
                <div className="pinned-item-top">
                  <div className="pinned-author">
                    <div className="pinned-avatar">{pin.createdBy?.firstName?.charAt(0) || 'U'}</div>
                    <div className="pinned-info">
                      <p className="pinned-name">{pin.createdBy?.firstName} {pin.createdBy?.lastName}</p>
                      <span className="pinned-badge">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#6366f1" stroke="#6366f1" strokeWidth="1.5">
                          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
                          <line x1="12" y1="17" x2="12" y2="22"/>
                        </svg>
                        Pinned
                      </span>
                    </div>
                  </div>
                  {canUpdate && (
                    <div className="menu-btn-wrapper pinned-menu-wrapper">
                      <button
                        className="menu-btn pinned-more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenPinnedMenuId(openPinnedMenuId === pin._id ? null : pin._id);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="12" cy="5" r="1.5"/>
                          <circle cx="12" cy="12" r="1.5"/>
                          <circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>
                      {openPinnedMenuId === pin._id && (
                        <div className="post-dropdown-menu pinned-dropdown-menu">
                          <button
                            className="post-dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenPinnedMenuId(null);
                              handleTogglePin(pin);
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                            </svg>
                            Unpin
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="pinned-category" style={{ color: getPriorityColor(pin.priority) }}>
                  <span className="badge-dot" style={{ background: getPriorityColor(pin.priority) }} aria-hidden="true"></span>
                  {pin.priority ? pin.priority.charAt(0).toUpperCase() + pin.priority.slice(1) : 'Medium'}
                </div>
                <p className="pinned-title">{pin.title}</p>
                <p className="pinned-preview">{pin.message.substring(0, 60)}...</p>
                <button className="btn-view-post" onClick={() => setViewPostBroadcast(pin)} onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280'; }}>
                  <span>View post &rarr;</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>}
      {viewPostBroadcast && (() => {
        const livePost = broadcasts.find(b => b._id === viewPostBroadcast._id) || viewPostBroadcast;
        return (
        <div className="vp-fullpage">
          <div className="vp-fullpage-inner">
            <div className="vp-layout">
              <div className="vp-card">
                {/* Header */}
                <div className="vp-card-header">
                  <div className="vp-author">
                    <div className="author-avatar" style={{ width: 44, height: 44 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                        <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="vp-author-name">{livePost.createdBy?.firstName} {livePost.createdBy?.lastName}</p>
                      <p className="vp-author-meta">{livePost.createdBy?.role?.name || 'Employee'} · {new Date(livePost.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, {new Date(livePost.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="vp-badge" style={{ color: getPriorityColor(livePost.priority) }}>
                    <span className="badge-dot" style={{ background: getPriorityColor(livePost.priority) }} aria-hidden="true"></span>
                    {livePost.priority ? livePost.priority.charAt(0).toUpperCase() + livePost.priority.slice(1) : 'Medium'}
                  </div>
                </div>

                {/* Content */}
                <div className="vp-card-body">
                  <h2 className="vp-title">{livePost.title}</h2>
                  <p className="vp-message">{livePost.message}</p>
                </div>

                {/* Stats */}
                <div className="vp-stats">
                  <span
                    className="stat-reactions"
                    style={{ cursor: (livePost.likesCount || 0) > 0 ? 'pointer' : 'default' }}
                    onClick={() => (livePost.likesCount || 0) > 0 && handleShowLikers(livePost._id, livePost.title)}
                    title={(livePost.likesCount || 0) > 0 ? 'See who liked this' : ''}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={livePost.likes?.some(id => String(id) === String(user?._id || user?.id)) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                    </svg>
                    {livePost.likesCount || 0} {livePost.likesCount === 1 ? 'Like' : 'Likes'}
                  </span>
                  <span className="stat-engagement">
                    {livePost.comments?.length || 0} Comments
                  </span>
                </div>

                {/* Like Action */}
                <div className="post-actions" style={{ paddingTop: '8px', paddingBottom: '4px', borderTop: '1px solid #f1f5f9' }}>
                  <button
                    className={`action-btn react-btn${livePost.likes?.some(id => String(id) === String(user?._id || user?.id)) ? ' is-liked' : ''}${animatingReacts[livePost._id] ? ' is-animating' : ''}`}
                    onClick={() => handleReaction(livePost._id)}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'white'; }}
                  >
                    <span className="react-icon">
                      {animatingReacts[livePost._id] && (
                        <span className="react-burst" aria-hidden="true">
                          <span className="burst-particle burst-particle--1"></span>
                          <span className="burst-particle burst-particle--2"></span>
                          <span className="burst-particle burst-particle--3"></span>
                          <span className="burst-particle burst-particle--4"></span>
                          <span className="burst-particle burst-particle--5"></span>
                          <span className="burst-particle burst-particle--6"></span>
                        </span>
                      )}
                      <svg width="15" height="15" viewBox="0 0 24 24" fill={livePost.likes?.some(id => String(id) === String(user?._id || user?.id)) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </span>
                    <span>React</span>
                  </button>
                </div>

                {/* Comments */}
                <div className="vp-comments-section">
                  <h4 className="vp-comments-title">Comments ({livePost.comments?.length || 0})</h4>
                  <div className="vp-comments-list">
                    {livePost.comments?.length > 0 ? livePost.comments.map(comment => (
                      <div key={comment._id} className="comment-item">
                        <div className="comment-avatar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                          </svg>
                        </div>
                        <div className="comment-content">
                          <strong className="comment-author">{comment.commentedBy?.firstName}:</strong>
                          <span className="comment-text">{comment.comment}</span>
                        </div>
                      </div>
                    )) : (
                      <p className="vp-no-comments">No comments yet. Be the first to comment!</p>
                    )}
                  </div>
                  <div className="comment-input-wrap" style={{ marginTop: 12 }}>
                    <input
                      type="text"
                      className="comment-input"
                      placeholder="Add a comment..."
                      value={commentText[livePost._id] || ''}
                      onChange={(e) => setCommentText({ ...commentText, [livePost._id]: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(livePost._id); }}
                    />
                    <button className="btn-post-comment" onClick={() => handleAddComment(livePost._id)} onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'white'; }}>
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              </div>

              <aside className="vp-announcement-sidebar">
                <button className="vp-back-btn" onClick={() => setViewPostBroadcast(null)} onMouseEnter={(e) => { e.currentTarget.style.color = '#1f2937'; }} onMouseLeave={(e) => { e.currentTarget.style.color = 'white'; }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 12H5M12 5l-7 7 7 7"/>
                  </svg>
                  <span>Back</span>
                </button>
                <div className="vp-announcement-sidebar-header">All Announcements</div>
                <div className="vp-announcement-list" ref={announcementListRef}>
                  {filteredBroadcasts.length === 0 ? (
                    <p className="vp-announcement-empty">No announcements available.</p>
                  ) : (
                    paginatedAnnouncements.map((item) => (
                      <button
                        key={item._id}
                        className={`vp-announcement-item${item._id === livePost._id ? ' active' : ''}`}
                        onClick={() => setViewPostBroadcast(item)}
                        type="button"
                      >
                        <p className="vp-announcement-item-title">{item.title}</p>
                        <p className="vp-announcement-item-meta">
                          {item.createdBy?.firstName} {item.createdBy?.lastName} · {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </p>
                      </button>
                    ))
                  )}
                </div>
                {filteredBroadcasts.length > announcementsPerPage && (
                  <div className="vp-announcement-pagination">
                    <button
                      type="button"
                      className="vp-pagination-btn"
                      disabled={announcementPage === 1}
                      onClick={() => handleAnnouncementPageChange(announcementPage - 1)}
                    >
                      Prev
                    </button>
                    <span className="vp-pagination-info">{announcementPage} / {totalAnnouncementPages}</span>
                    <button
                      type="button"
                      className="vp-pagination-btn"
                      disabled={announcementPage === totalAnnouncementPages}
                      onClick={() => handleAnnouncementPageChange(announcementPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Create Broadcast Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bc-modal-header">
              <div className="bc-modal-title-wrap">
                <div className="bc-modal-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                  </svg>
                </div>
                <div>
                  <h2 className="bc-modal-title">New Announcement</h2>
                  <p className="bc-modal-subtitle">Fill in the details to broadcast</p>
                </div>
              </div>
              <button className="bc-modal-close" onClick={() => setShowModal(false)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="bc-modal-body">
                <div className="bc-priority-tabs">
                  {['low', 'medium', 'high'].map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`bc-tab-btn${formData.priority === p ? ' bc-tab-active' : ''}`}
                      onClick={() => setFormData({ ...formData, priority: p })}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="bc-form-group">
                  <label className="bc-label">Announcement Title<span className="bc-label-required">*</span></label>
                  <input
                    type="text"
                    className="bc-input"
                    placeholder="Enter Title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="bc-form-group">
                  <label className="bc-label">Message<span className="bc-label-required">*</span></label>
                  <textarea
                    className="bc-input bc-textarea"
                    rows="4"
                    placeholder="Add Message..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="bc-modal-footer">
                <button type="button" className="bc-btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="bc-btn-submit">Post Announcement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Broadcast Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditingBroadcast(null); }}>
          <div className="bc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bc-modal-header">
              <div className="bc-modal-title-wrap">
                <div className="bc-modal-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="bc-modal-title">Edit Announcement</h2>
                  <p className="bc-modal-subtitle">Update the broadcast details</p>
                </div>
              </div>
              <button className="bc-modal-close" onClick={() => { setShowEditModal(false); setEditingBroadcast(null); }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="bc-modal-body">
                <div className="bc-priority-tabs">
                  {['low', 'medium', 'high'].map(p => (
                    <button
                      key={p}
                      type="button"
                      className={`bc-tab-btn${formData.priority === p ? ' bc-tab-active' : ''}`}
                      onClick={() => setFormData({ ...formData, priority: p })}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="bc-form-group">
                  <label className="bc-label">Announcement Title<span className="bc-label-required">*</span></label>
                  <input
                    type="text"
                    className="bc-input"
                    placeholder="e.g. Leave Policy Update"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div className="bc-form-group">
                  <label className="bc-label">Message<span className="bc-label-required">*</span></label>
                  <textarea
                    className="bc-input bc-textarea"
                    rows="4"
                    placeholder="Add notes or details..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  ></textarea>
                </div>
              </div>
              <div className="bc-modal-footer">
                <button type="button" className="bc-btn-cancel" onClick={() => { setShowEditModal(false); setEditingBroadcast(null); }}>Cancel</button>
                <button type="submit" className="bc-btn-submit">Update Announcement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Instagram-style Likers Modal ── */}
      {likersModal.open && (
        <div
          onClick={() => setLikersModal({ open: false, likers: [], loading: false, broadcastTitle: '' })}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
            animation: 'bc-fade-in 0.18s ease'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '380px',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              animation: 'bc-slide-up 0.22s cubic-bezier(0.34,1.56,0.64,1)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fafafa'
            }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                  ❤️ Liked by
                </div>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', fontFamily: 'Inter, sans-serif', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {likersModal.broadcastTitle}
                </div>
              </div>
              <button
                onClick={() => setLikersModal({ open: false, likers: [], loading: false, broadcastTitle: '' })}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  width: '30px', height: '30px',
                  borderRadius: '50%',
                  fontSize: '16px',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#64748b',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              {likersModal.loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
                  {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e2e8f0', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: 13, width: '60%', background: '#e2e8f0', borderRadius: 6, marginBottom: 6 }} />
                        <div style={{ height: 11, width: '35%', background: '#f1f5f9', borderRadius: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : likersModal.likers.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 20px', gap: '10px' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  <span style={{ fontSize: '13px', color: '#94a3b8', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                    No likes yet
                  </span>
                </div>
              ) : (
                likersModal.likers.map((liker, i) => {
                  const initials = `${liker.firstName?.charAt(0) || ''}${liker.lastName?.charAt(0) || ''}`.toUpperCase();
                  const colors = ['#3b775e', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#10b981', '#8b5cf6'];
                  const bg = colors[i % colors.length];
                  return (
                    <div
                      key={liker._id || i}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 20px',
                        borderBottom: i < likersModal.likers.length - 1 ? '1px solid #f8fafc' : 'none',
                        transition: 'background 0.12s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff',
                        fontSize: '14px', fontWeight: 700,
                        flexShrink: 0,
                        fontFamily: 'Inter, sans-serif'
                      }}>
                        {initials || '?'}
                      </div>
                      {/* Name + role */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                          {liker.firstName} {liker.lastName}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px', fontFamily: 'Inter, sans-serif' }}>
                          {liker.role?.name || 'Employee'}
                        </div>
                      </div>
                      {/* Heart icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#f43f5e" stroke="#f43f5e" strokeWidth="1.5" style={{ flexShrink: 0, opacity: 0.85 }}>
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                      </svg>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer count */}
            {!likersModal.loading && likersModal.likers.length > 0 && (
              <div style={{
                padding: '10px 20px',
                borderTop: '1px solid #f1f5f9',
                background: '#fafafa',
                fontSize: '12px',
                color: '#94a3b8',
                fontFamily: 'Inter, sans-serif',
                textAlign: 'center'
              }}>
                {likersModal.likers.length} {likersModal.likers.length === 1 ? 'person' : 'people'} liked this
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bc-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes bc-slide-up { from { opacity: 0; transform: translateY(24px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
      `}</style>
    </div>
  );
}

export default Broadcasts;
