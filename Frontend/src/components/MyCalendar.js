import React, { useState, useEffect, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './Calendar.css';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const localizer = momentLocalizer(moment);

const CalendarToolbar = ({ date, onNavigate, selectedFilter, onFilterChange }) => {
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    const filterWrapRef = useRef(null);
    const fullDateLabel = moment(date).format('MMMM D, YYYY');
    const filterLabelMap = {
        all: 'All',
        holiday: 'Holiday',
        meeting: 'Meeting',
        deadline: 'Deadline',
        event: 'Event',
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (filterWrapRef.current && !filterWrapRef.current.contains(e.target)) {
                setShowFilterMenu(false);
            }
        };
        if (showFilterMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showFilterMenu]);

    return (
        <div className="rbc-toolbar">
            <span className="rbc-btn-group">
                <button type="button" onClick={() => onNavigate('TODAY')}>Today</button>
            </span>

            <span className="rbc-toolbar-label">{fullDateLabel}</span>

            <span className="calendar-filter-wrap" ref={filterWrapRef}>
                <button
                    type="button"
                    className="calendar-filter-btn"
                    onClick={() => setShowFilterMenu((prev) => !prev)}
                    title={`Filter: ${filterLabelMap[selectedFilter] || 'All'}`}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        <circle cx="8" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.8" fill="white"/>
                        <circle cx="16" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" fill="white"/>
                        <circle cx="10" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.8" fill="white"/>
                    </svg>
                    {selectedFilter !== 'all' && (
                        <span className="calendar-filter-dot" />
                    )}
                </button>

                {showFilterMenu && (
                    <div className="calendar-filter-menu">
                        <div className="calendar-filter-menu-label">Filter by type</div>
                        <div className="calendar-filter-menu-pills">
                            {Object.entries(filterLabelMap).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    className={`calendar-filter-item${selectedFilter === value ? ' calendar-filter-item--active' : ''}`}
                                    onClick={() => onFilterChange(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </span>
        </div>
    );
};

const MonthEventEmpty = () => null;

const MyCalendar = () => {
            const [loading, setLoading] = useState(true);
        // Pagination state
        const [currentPage, setCurrentPage] = useState(1);
        const [rowsPerPage, setRowsPerPage] = useState(10);
    const { user, hasPermission } = useAuth();
    const [events, setEvents] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [hoverCard, setHoverCard] = useState(null);
    const [showCalendar, setShowCalendar] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState('month');
    const [showModal, setShowModal] = useState(false);
    const [viewEvent, setViewEvent] = useState(null);
    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        start: new Date(),
        end: new Date(),
        type: 'event', // event, holiday, meeting, deadline
        isAllDay: false
    });
    const [editMode, setEditMode] = useState(false);
    const [actionDropdown, setActionDropdown] = useState({ type: null, anchor: null });
    const [successPopup, setSuccessPopup] = useState(null);

    // Permission checks
    const isAdmin = user?.role?.name === 'Admin' || user?.role?.name === 'HR';
    const canCreate = hasPermission('calendar', 'create');
    const canUpdate = hasPermission('calendar', 'update');
    const canDelete = hasPermission('calendar', 'delete');
    const canRead = hasPermission('calendar', 'read');

    // Success popup function
    const showSuccessPopup = (message, type = 'success') => {
        setSuccessPopup({ message, type });
        setTimeout(() => setSuccessPopup(null), 2000);
    };


    useEffect(() => {
        setLoading(true);
        fetchData().finally(() => setLoading(false));
    }, []);

    const fetchData = async () => {
        try {
            const [holidaysRes, eventsRes, projectsRes, leavesRes] = await Promise.all([
                canRead ? api.get('/holidays') : Promise.resolve({ data: [] }),
                canRead ? api.get('/events') : Promise.resolve({ data: [] }),
                hasPermission('projects', 'read') ? api.get('/projects') : Promise.resolve({ data: [] }),
                hasPermission('leaves', 'read') ? api.get('/leaves') : Promise.resolve({ data: [] })
            ]);

            const holidays = holidaysRes.data.map(h => ({
                id: h._id,
                title: h.name,
                start: new Date(h.date),
                end: new Date(h.date),
                allDay: true,
                type: 'holiday',
                desc: h.description
            }));

            const calendarEvents = eventsRes.data.map(e => ({
                id: e._id,
                title: e.title,
                start: new Date(e.start),
                end: new Date(e.end),
                allDay: e.type === 'holiday' || e.type === 'deadline',
                type: e.type, // meeting, event, etc.
                desc: e.description
            }));

            const projectDeadlines = projectsRes.data.map(p => ({
                id: p._id,
                title: p.name, // Only the name
                start: new Date(p.deadline),
                end: new Date(p.deadline),
                allDay: true,
                type: 'deadline',
                desc: `Project Status: ${p.status}`
            }));

            // Filter leaves - if admin see all, if employee see own? 
            // Usually calendar shows all approved leaves for transparency or dependent on role.
            // Let's assume we show all approved leaves.
            const leaves = leavesRes.data
                .filter(l => l.status === 'approved')
                .map(l => ({
                    id: l._id,
                    title: l.employee?.firstName || 'Employee', // Only the name
                    start: new Date(l.startDate),
                    end: new Date(l.endDate),
                    allDay: true,
                    type: 'leave',
                    desc: l.reason
                }));

            setEvents([...holidays, ...calendarEvents, ...projectDeadlines, ...leaves]);

        } catch (error) {
            console.error("Error fetching calendar data", error);
        }
    };

    const handleSelectSlot = ({ start, end }) => {
        // Allow past dates
        setNewEvent({ ...newEvent, start, end });
        setShowModal(true);
        setViewEvent(null);
    };

    const handleSelectEvent = (event) => {
        setViewEvent(event);
        setEditMode(false);
        setShowModal(true);
    };

    const handleEditEvent = (event) => {
        setNewEvent({
            title: event.title,
            description: event.desc || '',
            start: event.start,
            end: event.end,
            type: event.type,
            isAllDay: event.allDay || false,
            id: event.id
        });
        setEditMode(true);
        setShowModal(true);
        setActionDropdown({ type: null, anchor: null });
    };

    const handleDeleteEvent = async (event) => {
        setActionDropdown({ type: null, anchor: null });
        if (!window.confirm('Are you sure you want to delete this event?')) return;
        try {
            // Determine endpoint based on event type
            let endpoint = '';
            if (event.type === 'holiday') endpoint = `/holidays/${event.id}`;
            else if (event.type === 'leave') endpoint = `/leaves/${event.id}`;
            else if (event.type === 'deadline') endpoint = `/projects/${event.id}`;
            else endpoint = `/events/${event.id}`;
            await api.delete(endpoint);
            fetchData();
            setHoverCard(null);
            showSuccessPopup('Event deleted successfully!', 'success');
        } catch (error) {
            console.error('Error deleting event:', error);
            showSuccessPopup('Failed to delete event. Please try again.', 'error');
        }
    };

    const openActionDropdown = (type, anchor) => {
        setActionDropdown({ type, anchor });
    };

    const closeActionDropdown = () => {
        setActionDropdown({ type: null, anchor: null });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editMode) {
                // Update event
                let endpoint = '';
                let payload = {};
                if (newEvent.type === 'holiday') {
                    endpoint = `/holidays/${newEvent.id}`;
                    payload = {
                        name: newEvent.title,
                        date: newEvent.start,
                        description: newEvent.description,
                        isOptional: false
                    };
                } else if (newEvent.type === 'leave') {
                    endpoint = `/leaves/${newEvent.id}`;
                    payload = {
                        // Add leave update fields if needed
                        // For now, just allow editing reason and title (if supported by backend)
                        reason: newEvent.description,
                        employeeName: newEvent.title // Update this key if your backend expects a different field
                    };
                } else if (newEvent.type === 'deadline') {
                    endpoint = `/projects/${newEvent.id}`;
                    payload = {
                        deadline: newEvent.start,
                        name: newEvent.title // Update project name if title is edited
                    };
                } else {
                    endpoint = `/events/${newEvent.id}`;
                    payload = {
                        title: newEvent.title,
                        description: newEvent.description,
                        start: newEvent.start,
                        end: newEvent.end,
                        type: newEvent.type
                    };
                }
                await api.put(endpoint, payload);
            } else {
                // Create event
                if (newEvent.type === 'holiday') {
                    await api.post('/holidays', {
                        name: newEvent.title,
                        date: newEvent.start,
                        description: newEvent.description,
                        isOptional: false // default
                    });
                } else if (newEvent.type === 'leave') {
                    // For leaves, you might need to add more fields like employee, leaveType, etc.
                    // For now, creating as a generic event with type 'leave'
                    await api.post('/events', {
                        title: newEvent.title,
                        description: newEvent.description,
                        start: newEvent.start,
                        end: newEvent.end,
                        type: 'leave'
                    });
                } else if (newEvent.type === 'deadline') {
                    // For deadlines, creating as a generic event with type 'deadline'
                    await api.post('/events', {
                        title: newEvent.title,
                        description: newEvent.description,
                        start: newEvent.start,
                        end: newEvent.end,
                        type: 'deadline'
                    });
                } else {
                    // For event, meeting, and any other types
                    await api.post('/events', {
                        title: newEvent.title,
                        description: newEvent.description,
                        start: newEvent.start,
                        end: newEvent.end,
                        type: newEvent.type // This will be 'event' or 'meeting'
                    });
                }
            }
            setShowModal(false);
            setEditMode(false);
            setNewEvent({
                title: '',
                description: '',
                start: new Date(),
                end: new Date(),
                type: 'event',
                isAllDay: false
            });
            fetchData(); // Refresh
            showSuccessPopup(editMode ? 'Event updated successfully!' : 'Event created successfully!', 'success');
        } catch (error) {
            console.error('Error saving event:', error);
            showSuccessPopup('Failed to save event. Please try again.', 'error');
        }
    };

    const eventPropGetter = (event) => {
        let className = '';
        switch (event.type) {
            case 'holiday': className = 'event-holiday'; break;
            case 'meeting': className = 'event-meeting'; break;
            case 'deadline': className = 'event-deadline'; break;
            case 'leave': className = 'event-leave'; break;
            default: className = 'event-task'; break;
        }
        return { className };
    };

    const visibleEvents = selectedFilter === 'all'
        ? events
        : events.filter((ev) => (ev.type || 'event') === selectedFilter);

    // Pagination logic
    const totalRows = visibleEvents.length;
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const pagedEvents = visibleEvents.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

    const handleBottomNavigate = (direction) => {
        const stepUnit = currentView === 'day' ? 'day' : currentView === 'week' ? 'week' : 'month';
        const nextDate = direction === 'next'
            ? moment(currentDate).add(1, stepUnit).toDate()
            : moment(currentDate).subtract(1, stepUnit).toDate();
        setCurrentDate(nextDate);
    };

    const openHoverCard = (e, dayMoment, dayEvents) => {
        if (!dayEvents.length) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const cardWidth = 260;
        const cardHeight = 150; // Approximate height
        
        // Check if cell is in bottom portion of viewport
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        const spaceAbove = rect.top;
        const openUpward = spaceBelow < cardHeight && spaceAbove > spaceBelow;
        
        // Position horizontally centered
        const x = Math.max(8, Math.min(window.innerWidth - cardWidth - 8, rect.left + rect.width / 2 - cardWidth / 2));
        
        // Position vertically - above or below
        const y = openUpward ? rect.top - 6 : rect.bottom + 6;
        
        setHoverCard({
            x,
            y,
            openUpward,
            dateLabel: dayMoment.format('ddd, MMM D, YYYY'),
            events: dayEvents,
        });
    };

    const closeHoverCard = () => {
        setHoverCard(null);
    };

    const MonthDateHeader = ({ label, date }) => {
        const dayMoment = moment(date);
        const isToday = dayMoment.isSame(moment(), 'day');
        const dayEvents = visibleEvents.filter((ev) => {
            const start = moment(ev.start).startOf('day');
            const end = moment(ev.end).endOf('day');
            return dayMoment.isBetween(start, end, 'day', '[]');
        });
        // Only show hover card if this cell is being hovered
        const isHovered = hoverCard && hoverCard.dateLabel === dayMoment.format('ddd, MMM D, YYYY');
        return (
            <div
                className="calendar-date-cell-head"
                onMouseEnter={(e) => openHoverCard(e, dayMoment, dayEvents)}
                onMouseMove={(e) => openHoverCard(e, dayMoment, dayEvents)}
                onMouseLeave={closeHoverCard}
            >
                <span className={isToday ? 'calendar-date-today' : ''}>{label}</span>
                <span className="calendar-date-dots">
                    {dayEvents.map((ev, idx) => (
                        <span
                            key={`${ev.id || ev.title}-${idx}-${dayMoment.format('YYYY-MM-DD')}`}
                            className={`calendar-event-dot calendar-event-dot--${(ev.type === 'leave' ? 'event' : ev.type) || 'task'}`}
                            title={ev.title}
                        />
                    ))}
                </span>
            </div>
        );
    };

    return (
        <div className="calendar-container">
            <div className="calendar-header">
                <div className="calendar-header-left">
                    <div className="calendar-header-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <rect x="3" y="4" width="18" height="18" rx="3" stroke="#3b775e" strokeWidth="1.8" fill="none"/>
                            <line x1="16" y1="2" x2="16" y2="6" stroke="#3b775e" strokeWidth="1.8" strokeLinecap="round"/>
                            <line x1="8" y1="2" x2="8" y2="6" stroke="#3b775e" strokeWidth="1.8" strokeLinecap="round"/>
                            <line x1="3" y1="10" x2="21" y2="10" stroke="#3b775e" strokeWidth="1.3"/>
                            <rect x="7" y="14" width="3" height="3" rx="0.8" fill="#3b775e" opacity="0.5"/>
                            <rect x="11" y="14" width="3" height="3" rx="0.8" fill="#3b775e" opacity="0.35"/>
                            <rect x="15" y="14" width="3" height="3" rx="0.8" fill="#3b775e" opacity="0.2"/>
                        </svg>
                    </div>
                    <div>
                        <h2>My Calendar</h2>
                        <div className="calendar-breadcrumb">Home • My Calendar</div>
                    </div>
                </div>
                {canCreate && (
                    <button className="add-event-btn" onClick={() => {
                        setNewEvent({ ...newEvent, start: new Date(), end: new Date() });
                        setViewEvent(null);
                        setShowModal(true);
                    }}>
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                            <line x1="7" y1="1" x2="7" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                            <line x1="1" y1="7" x2="13" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        Add Event
                    </button>
                )}
            </div>

            <div className="calendar-legend">
                <div className="calendar-legend-items">
                    <div className="legend-item"><div className="legend-color event-holiday"></div> Holiday</div>
                    <div className="legend-item"><div className="legend-color event-meeting"></div> Meeting</div>
                    <div className="legend-item"><div className="legend-color event-deadline"></div> Deadline</div>
                    <div className="legend-item"><div className="legend-color event-task"></div> Event</div>
                </div>
                <button
                    type="button"
                    className={`calendar-open-btn${showCalendar ? ' calendar-open-btn--active' : ''}`}
                    onClick={() => {
                        if (!showCalendar) {
                            setCurrentDate(new Date());
                            setCurrentView('month');
                        }
                        setShowCalendar((prev) => !prev);
                    }}
                    aria-pressed={showCalendar}
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.3"/>
                    </svg>
                    Calendar
                </button>
            </div>


            {showCalendar ? (
                <div className="calendar-card-wrap">
                    <div className="calendar-main">
                        <Calendar
                            localizer={localizer}
                            events={visibleEvents}
                            components={{
                                toolbar: (toolbarProps) => (
                                    <CalendarToolbar
                                        {...toolbarProps}
                                        selectedFilter={selectedFilter}
                                        onFilterChange={setSelectedFilter}
                                    />
                                ),
                                month: { dateHeader: MonthDateHeader, event: MonthEventEmpty },
                            }}
                            showAllEvents
                            date={currentDate}
                            view={currentView}
                            startAccessor="start"
                            endAccessor="end"
                            style={{ height: '100%' }}
                            eventPropGetter={eventPropGetter}
                            selectable={canCreate}
                            onNavigate={(date) => setCurrentDate(date)}
                            onView={(view) => setCurrentView(view)}
                            onSelectSlot={handleSelectSlot}
                            onSelectEvent={handleSelectEvent}
                            views={['month', 'week', 'day', 'agenda']}
                        />
                    </div>
                    <div className="calendar-bottom-nav">
                        <button
                            type="button"
                            className="calendar-arrow-btn"
                            aria-label="Previous"
                            onClick={() => handleBottomNavigate('prev')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                        <button
                            type="button"
                            className="calendar-arrow-btn"
                            aria-label="Next"
                            onClick={() => handleBottomNavigate('next')}
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <path d="M9 5L16 12L9 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(15,23,42,0.06)', marginTop: 4, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {/* Table toolbar */}
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
                        <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 500 }}>
                            {totalRows} {totalRows === 1 ? 'event' : 'events'}
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#fafafa' }}>
                                    {['Title', 'Type', 'Start', 'End', 'Description'].map(label => (
                                        <th key={label} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                                            {label}
                                        </th>
                                    ))}
                                    {(canUpdate || canDelete) && (
                                        <th style={{ padding: '9px 14px', textAlign: 'center', fontSize: '9.5px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                                            Actions
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 8 }).map((_, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #f8fafc' }}>
                                            {[140, 80, 90, 90, 160, 60].filter((_, i) => i < 5 || (canUpdate || canDelete)).map((w, cidx) => (
                                                <td key={cidx} style={{ padding: '11px 14px' }}>
                                                    <div style={{ height: 11, width: w, background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)', borderRadius: 5, animation: 'skeleton-loading 1.2s infinite linear' }} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                ) : pagedEvents.length === 0 ? (
                                    <tr>
                                        <td colSpan={(canUpdate || canDelete) ? "6" : "5"} style={{ padding: '48px 0', textAlign: 'center' }}>
                                            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                                </svg>
                                            </div>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>No events found</div>
                                            <div style={{ fontSize: 12, color: '#94a3b8' }}>Adjust your filter to see results.</div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagedEvents.map((ev, index) => {
                                        const typeBadge = {
                                            holiday: { color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
                                            meeting:  { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
                                            deadline: { color: '#be123c', bg: '#ffe4e6', border: '#fecdd3' },
                                            event:    { color: '#6b21a8', bg: '#f3e8ff', border: '#e9d5ff' },
                                        }[ev.type] || { color: '#334155', bg: '#f1f5f9', border: '#e2e8f0' };
                                        return (
                                            <tr
                                                key={ev.id}
                                                style={{ borderBottom: index < pagedEvents.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.15s', cursor: 'default' }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={e => e.currentTarget.style.background = ''}
                                            >
                                                <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>
                                                </td>
                                                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: '10px', fontWeight: 600, color: typeBadge.color, background: typeBadge.bg, border: `1px solid ${typeBadge.border}`, textTransform: 'capitalize' }}>
                                                        {ev.type || 'event'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '10px 14px', fontSize: '11px', color: '#475569', whiteSpace: 'nowrap' }}>{moment(ev.start).format('MMM D, YYYY')}</td>
                                                <td style={{ padding: '10px 14px', fontSize: '11px', color: '#475569', whiteSpace: 'nowrap' }}>{moment(ev.end).format('MMM D, YYYY')}</td>
                                                <td style={{ padding: '10px 14px', maxWidth: 240 }}>
                                                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.desc || <span style={{ color: '#cbd5e1' }}>—</span>}</span>
                                                </td>
                                                {(canUpdate || canDelete) && (
                                                    <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                            {canUpdate && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleEditEvent(ev); }}
                                                                    style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'background 0.2s' }}
                                                                    title="Edit Event"
                                                                    onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                                                        <path d="M3 17h2.586l9.293-9.293a1 1 0 0 0 0-1.414l-2.172-2.172a1 1 0 0 0-1.414 0L3 13.586V17z" stroke="#3b775e" strokeWidth="1.5"/>
                                                                        <path d="M14.293 5.707l-2-2" stroke="#3b775e" strokeWidth="1.5"/>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev); }}
                                                                    style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'background 0.2s' }}
                                                                    title="Delete Event"
                                                                    onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                                                                        <rect x="5" y="7" width="10" height="8" rx="2" stroke="#e11d48" strokeWidth="1.5"/>
                                                                        <path d="M8 9v4M12 9v4" stroke="#e11d48" strokeWidth="1.5"/>
                                                                        <path d="M7 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="#e11d48" strokeWidth="1.5"/>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ padding: '8px 14px', borderTop: '1px solid #e2e8f0', background: '#fff', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                                Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, totalRows)} of {totalRows} events
                            </div>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                {/* Prev button */}
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    style={{ padding: '5px 9px', border: 'none', borderRadius: 7, background: currentPage === 1 ? '#f0fdf4' : '#a3e635', color: currentPage === 1 ? '#86efac' : '#365314', fontSize: 11, fontWeight: 700, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: currentPage === 1 ? 0.5 : 1 }}
                                    onMouseEnter={e => { if (currentPage !== 1) e.currentTarget.style.background = '#84cc16'; }}
                                    onMouseLeave={e => { if (currentPage !== 1) e.currentTarget.style.background = '#a3e635'; }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                                        Prev
                                    </span>
                                </button>
                                {/* Page numbers */}
                                <div style={{ display: 'flex', gap: 3 }}>
                                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) pageNum = i + 1;
                                        else if (currentPage <= 3) pageNum = i + 1;
                                        else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                        else pageNum = currentPage - 2 + i;
                                        return (
                                            <button
                                                key={pageNum}
                                                onClick={() => setCurrentPage(pageNum)}
                                                style={{ padding: '5px 9px', border: currentPage === pageNum ? 'none' : '1px solid #d9f99d', borderRadius: 7, background: currentPage === pageNum ? '#a3e635' : '#f0fdf4', color: currentPage === pageNum ? '#365314' : '#4d7c0f', fontSize: 11, fontWeight: 700, cursor: 'pointer', minWidth: 28, transition: 'all 0.15s' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = currentPage === pageNum ? '#84cc16' : '#bef264'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = currentPage === pageNum ? '#a3e635' : '#f0fdf4'; }}
                                            >{pageNum}</button>
                                        );
                                    })}
                                </div>
                                {/* Next button */}
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    style={{ padding: '5px 9px', border: 'none', borderRadius: 7, background: currentPage === totalPages ? '#f0fdf4' : '#a3e635', color: currentPage === totalPages ? '#86efac' : '#365314', fontSize: 11, fontWeight: 700, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: currentPage === totalPages ? 0.5 : 1 }}
                                    onMouseEnter={e => { if (currentPage !== totalPages) e.currentTarget.style.background = '#84cc16'; }}
                                    onMouseLeave={e => { if (currentPage !== totalPages) e.currentTarget.style.background = '#a3e635'; }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                        Next
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                    {totalPages <= 1 && (
                        <div style={{ padding: '8px 16px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{totalRows} {totalRows === 1 ? 'event' : 'events'}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Hover card rendered outside calendar structure for proper z-index stacking */}
            {hoverCard && hoverCard.events && hoverCard.events.length > 0 && (
                <div
                    className="calendar-hover-card"
                    style={{
                        position: 'fixed',
                        left: `${hoverCard.x}px`,
                        top: `${hoverCard.y}px`,
                        transform: hoverCard.openUpward ? 'translateY(-100%)' : 'none',
                        zIndex: 9999,
                        minWidth: 220,
                        maxWidth: 280,
                        maxHeight: '400px',
                        overflowY: 'auto'
                    }}
                    onMouseEnter={(e) => {
                        e.stopPropagation();
                    }}
                    onMouseLeave={closeHoverCard}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="calendar-hover-card-date">{hoverCard.dateLabel}</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {canUpdate && (
                                <button
                                    className="calendar-hover-edit-btn"
                                    title="Edit Event"
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                    onClick={(e) => openActionDropdown('edit', e.currentTarget)}
                                >
                                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                                        <path d="M3 17h2.586l9.293-9.293a1 1 0 0 0 0-1.414l-2.172-2.172a1 1 0 0 0-1.414 0L3 13.586V17z" stroke="#3b775e" strokeWidth="1.3"/>
                                        <path d="M14.293 5.707l-2-2" stroke="#3b775e" strokeWidth="1.3"/>
                                    </svg>
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    className="calendar-hover-delete-btn"
                                    title="Delete Event"
                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                                    onClick={(e) => openActionDropdown('delete', e.currentTarget)}
                                >
                                    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
                                        <rect x="5" y="7" width="10" height="8" rx="2" stroke="#e11d48" strokeWidth="1.3"/>
                                        <path d="M8 9v4M12 9v4" stroke="#e11d48" strokeWidth="1.3"/>
                                        <path d="M7 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" stroke="#e11d48" strokeWidth="1.3"/>
                                    </svg>
                                </button>
                            )}
                        </div>
                    </div>
                    {actionDropdown.type && (
                        <div className="calendar-hover-dropdown" style={{ marginTop: 8, marginBottom: 8, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', position: 'relative', right: 0, zIndex: 10 }}>
                            <div style={{ padding: '6px 12px', fontWeight: 600, fontSize: 13, color: '#3b775e' }}>
                                Select event to {actionDropdown.type}
                            </div>
                            {hoverCard.events.map((ev, idx) => (
                                <button
                                    key={ev.id || ev.title}
                                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', fontSize: 13, cursor: 'pointer', color: '#222' }}
                                    onClick={() => {
                                        if (actionDropdown.type === 'edit') handleEditEvent(ev);
                                        else if (actionDropdown.type === 'delete') handleDeleteEvent(ev);
                                    }}
                                >
                                    <span style={{ color: '#3b775e', marginRight: 6 }}>•</span>{ev.title}
                                </button>
                            ))}
                            <button style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', background: 'none', border: 'none', fontSize: 13, color: '#e11d48', cursor: 'pointer' }} onClick={closeActionDropdown}>Cancel</button>
                        </div>
                    )}
                    <div style={{ marginTop: actionDropdown.type ? 40 : 8 }}>
                        {hoverCard.events.map((ev, idx) => (
                            <div
                                key={`${ev.id || ev.title}-hover-${idx}`}
                                className="calendar-hover-item"
                                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                            >
                                <span className={`calendar-event-dot calendar-event-dot--${(ev.type === 'leave' ? 'event' : ev.type) || 'task'}`} />
                                <span>{ev.title}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay">
                    <div className="cal-modal">
                        {/* ── Header ── */}
                        <div className="cal-modal-hd">
                            <div className="cal-modal-hd-icon">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                    <rect x="3" y="4" width="18" height="18" rx="3" stroke="#3b775e" strokeWidth="1.8" fill="none"/>
                                    <line x1="16" y1="2" x2="16" y2="6" stroke="#3b775e" strokeWidth="1.8" strokeLinecap="round"/>
                                    <line x1="8" y1="2" x2="8" y2="6" stroke="#3b775e" strokeWidth="1.8" strokeLinecap="round"/>
                                    <line x1="3" y1="10" x2="21" y2="10" stroke="#3b775e" strokeWidth="1.3"/>
                                    {!viewEvent && <circle cx="17" cy="17" r="5" fill="#3b775e" opacity="0.18"/>}
                                    {!viewEvent && <line x1="17" y1="14.5" x2="17" y2="19.5" stroke="#3b775e" strokeWidth="1.6" strokeLinecap="round"/>}
                                    {!viewEvent && <line x1="14.5" y1="17" x2="19.5" y2="17" stroke="#3b775e" strokeWidth="1.6" strokeLinecap="round"/>}
                                </svg>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="cal-modal-title">{editMode ? 'Edit Event' : (viewEvent ? viewEvent.title : 'Add New Event')}</div>
                                <div className="cal-modal-sub">
                                    {editMode
                                        ? `${newEvent.type} · ${moment(newEvent.start).format('MMM D, YYYY')}`
                                        : viewEvent
                                            ? `${viewEvent.type} · ${moment(viewEvent.start).format('MMM D, YYYY')}`
                                            : 'Fill in the details to schedule'}
                                </div>
                            </div>
                            <button className="cal-close-btn" onClick={() => { setShowModal(false); setEditMode(false); }}>
                                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </button>
                        </div>
                        {/* ── Body ── */}
                        <div className="cal-modal-body">
                            {editMode || !viewEvent ? (
                                <form onSubmit={handleSubmit} className="cal-form">
                                    {/* Type segmented control */}
                                    <div className="cal-seg-wrap">
                                        {[
                                            { v: 'event', l: 'Event' }, 
                                            { v: 'meeting', l: 'Meeting' }, 
                                            { v: 'deadline', l: 'Deadline' },
                                            { v: 'holiday', l: 'Holiday' }
                                        ].map(opt => (
                                            <button
                                                key={opt.v}
                                                type="button"
                                                className={`cal-seg-btn${newEvent.type === opt.v ? ' cal-seg-btn--on' : ''}`}
                                                onClick={() => setNewEvent({ ...newEvent, type: opt.v })}
                                            >{opt.l}</button>
                                        ))}
                                    </div>
                                    {/* Title */}
                                    <div className="cal-field">
                                        <label className="cal-lbl">Title</label>
                                        <input
                                            className="cal-input"
                                            type="text"
                                            required
                                            value={newEvent.title}
                                            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                                            placeholder="e.g. Annual Meeting"
                                        />
                                    </div>
                                    {/* Start / End side-by-side */}
                                    <div className="cal-date-row">
                                        <div className="cal-field">
                                            <label className="cal-lbl">Start</label>
                                            <div className="cal-input-wrap">
                                                <svg className="cal-input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none">
                                                    <rect x="3" y="4" width="18" height="18" rx="3" stroke="#9ca3af" strokeWidth="1.7" fill="none"/>
                                                    <line x1="16" y1="2" x2="16" y2="6" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round"/>
                                                    <line x1="8" y1="2" x2="8" y2="6" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round"/>
                                                    <line x1="3" y1="10" x2="21" y2="10" stroke="#9ca3af" strokeWidth="1.3"/>
                                                </svg>
                                                <input
                                                    className="cal-input cal-input--dt"
                                                    type="datetime-local"
                                                    required
                                                    value={moment(newEvent.start).format('YYYY-MM-DDTHH:mm')}
                                                    onChange={(e) => setNewEvent({ ...newEvent, start: new Date(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div className="cal-field">
                                            <label className="cal-lbl">End</label>
                                            <div className="cal-input-wrap">
                                                <svg className="cal-input-icon" width="13" height="13" viewBox="0 0 24 24" fill="none">
                                                    <circle cx="12" cy="12" r="9" stroke="#9ca3af" strokeWidth="1.7" fill="none"/>
                                                    <line x1="12" y1="7" x2="12" y2="12" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round"/>
                                                    <line x1="12" y1="12" x2="15.5" y2="14.5" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round"/>
                                                </svg>
                                                <input
                                                    className="cal-input cal-input--dt"
                                                    type="datetime-local"
                                                    required
                                                    value={moment(newEvent.end).format('YYYY-MM-DDTHH:mm')}
                                                    onChange={(e) => setNewEvent({ ...newEvent, end: new Date(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Description */}
                                    <div className="cal-field">
                                        <label className="cal-lbl">Description <span className="cal-optional">optional</span></label>
                                        <textarea
                                            className="cal-input cal-textarea"
                                            rows="3"
                                            value={newEvent.description}
                                            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                                            placeholder="Add notes or details..."
                                        />
                                    </div>
                                    <div className="cal-footer">
                                        <button type="button" className="cal-btn-ghost" onClick={() => { setShowModal(false); setEditMode(false); }}>Cancel</button>
                                        <button type="submit" className="cal-btn-primary">{editMode ? 'Save Changes' : 'Create Event'}</button>
                                    </div>
                                </form>
                            ) : (
                                <div>
                                    <div className="cal-detail-row">
                                        <span className="cal-detail-lbl">Type</span>
                                        <span className="cal-detail-val" style={{ textTransform: 'capitalize' }}>{viewEvent.type}</span>
                                    </div>
                                    <div className="cal-detail-row">
                                        <span className="cal-detail-lbl">Start</span>
                                        <span className="cal-detail-val">{moment(viewEvent.start).format('MMM D, YYYY · h:mm A')}</span>
                                    </div>
                                    <div className="cal-detail-row">
                                        <span className="cal-detail-lbl">End</span>
                                        <span className="cal-detail-val">{moment(viewEvent.end).format('MMM D, YYYY · h:mm A')}</span>
                                    </div>
                                    {viewEvent.desc && (
                                        <div className="cal-detail-row">
                                            <span className="cal-detail-lbl">Note</span>
                                            <span className="cal-detail-val">{viewEvent.desc}</span>
                                        </div>
                                    )}
                                    <div className="cal-footer">
                                        <button className="cal-btn-ghost" onClick={() => setShowModal(false)}>Close</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Success Popup Modal */}
            {successPopup && (
                <div className="success-popup-overlay" onClick={() => setSuccessPopup(null)}>
                    <div className={`success-popup success-popup--${successPopup.type}`} onClick={(e) => e.stopPropagation()}>
                        <div className="success-popup-icon">
                            {successPopup.type === 'success' ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                                    <path d="M8 12.5l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" fill="none"/>
                                    <path d="M12 7v6M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            )}
                        </div>
                        <div className="success-popup-message">{successPopup.message}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyCalendar;
