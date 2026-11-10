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
        birthday: 'Birthday',
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
    const [employeesList, setEmployeesList] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState('all');
    const [hoverCard, setHoverCard] = useState(null);
    const [showCalendar, setShowCalendar] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState('month');
    const [showModal, setShowModal] = useState(false);
    const [viewEvent, setViewEvent] = useState(null);
    const [showOccasionModal, setShowOccasionModal] = useState(false);
    const [occasionData, setOccasionData] = useState({ date: null, events: [] });
    const justClickedOccasionRef = useRef(false);
    const [newEvent, setNewEvent] = useState({
        title: '',
        description: '',
        start: new Date(),
        end: new Date(),
        type: 'event', // event, holiday, meeting, deadline, birthday
        isAllDay: false
    });
    const [editMode, setEditMode] = useState(false);
    const [actionDropdown, setActionDropdown] = useState({ type: null, anchor: null });
    const [successPopup, setSuccessPopup] = useState(null);

    // Permission checks
    const canCreate = hasPermission('calendar', 'create');
    const canUpdate = hasPermission('calendar', 'update');
    const canDelete = hasPermission('calendar', 'delete');
    const canRead = hasPermission('calendar', 'read');

    // Helper to open Add Event card for a specific date (e.g. when clicking white area cell)
    const openAddEventForDate = (date) => {
        if (justClickedOccasionRef.current) return;
        const d = date ? new Date(date) : new Date();
        const start = new Date(d);
        start.setHours(9, 0, 0, 0);
        const end = new Date(d);
        end.setHours(10, 0, 0, 0);

        setNewEvent({
            title: '',
            description: '',
            start,
            end,
            type: 'event',
            isAllDay: false
        });
        setEditMode(false);
        setViewEvent(null);
        setShowOccasionModal(false);
        setHoverCard(null);
        setShowModal(true);
    };

    // Helper to open the Occasion modal for a specific day
    const handleOpenOccasion = (date, dayEvents) => {
        justClickedOccasionRef.current = true;
        setOccasionData({
            date: new Date(date),
            events: dayEvents || []
        });
        setShowModal(false);
        setShowOccasionModal(true);
        setHoverCard(null);
        setTimeout(() => {
            justClickedOccasionRef.current = false;
        }, 500);
    };

    // Native capture listener to prevent react-big-calendar from intercepting badge/date clicks as slot selection
    const attachOccasionStop = (el) => {
        if (el && !el._stopBound) {
            el._stopBound = true;
            const stopHandler = (e) => {
                justClickedOccasionRef.current = true;
                e.stopPropagation();
                if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                setTimeout(() => {
                    justClickedOccasionRef.current = false;
                }, 500);
            };
            el.addEventListener('mousedown', stopHandler, true);
            el.addEventListener('touchstart', stopHandler, true);
            el.addEventListener('mouseup', stopHandler, true);
        }
    };

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
            const [holidaysRes, eventsRes, projectsRes, leavesRes, employeesRes] = await Promise.all([
                canRead ? api.get('/holidays') : Promise.resolve({ data: [] }),
                canRead ? api.get('/events') : Promise.resolve({ data: [] }),
                hasPermission('projects', 'read') ? api.get('/projects') : Promise.resolve({ data: [] }),
                hasPermission('leaves', 'read') ? api.get('/leaves') : Promise.resolve({ data: [] }),
                api.get('/employees').catch(() => api.get('/employees/list').catch(() => ({ data: [] })))
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
                allDay: e.type === 'holiday' || e.type === 'deadline' || e.type === 'birthday',
                type: e.type, // meeting, event, birthday, etc.
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

            setEmployeesList(Array.isArray(employeesRes.data) ? employeesRes.data : []);
            setEvents([...holidays, ...calendarEvents, ...projectDeadlines, ...leaves]);

        } catch (error) {
            console.error("Error fetching calendar data", error);
        }
    };

    const handleSelectSlot = ({ start, end }) => {
        if (justClickedOccasionRef.current) {
            justClickedOccasionRef.current = false;
            return;
        }
        // Clicking on the white area cell of a date opens the Add Event card for that date
        openAddEventForDate(start);
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

    const birthdayEvents = React.useMemo(() => {
        const role = (user?.role?.name || (typeof user?.role === 'string' ? user.role : '') || '').toString().trim().toLowerCase();
        const hrOrAdmin = ['admin', 'director', 'hr', 'hr manager', 'super admin'].some(r => role === r || role.includes(r)) || user?.isSuperAdmin;

        const currentUserId = (user?._id || user?.id || '').toString();
        const currentUserEmpId = (user?.employeeId || '').toString().trim().toLowerCase();
        const currentUserEmail = (user?.email || user?.officialEmail || '').toString().trim().toLowerCase();

        // 1. Only active employees
        const activeEmployees = employeesList.filter(emp => emp.isActive !== false && (emp.status || '').toLowerCase() !== 'inactive');

        // 2. HR & Admin see all active employee birthdays; regular users see only their respective birthday
        let targetEmployees = [];
        if (hrOrAdmin) {
            targetEmployees = activeEmployees;
        } else {
            targetEmployees = activeEmployees.filter(emp => {
                const empId = (emp._id || emp.id || '').toString();
                const empCode = (emp.employeeId || '').toString().trim().toLowerCase();
                const empMail = (emp.email || emp.officialEmail || '').toString().trim().toLowerCase();
                return (currentUserId && empId === currentUserId) ||
                       (currentUserEmpId && empCode === currentUserEmpId) ||
                       (currentUserEmail && empMail === currentUserEmail);
            });

            if (targetEmployees.length === 0 && (user?.dateOfBirth || user?.dob)) {
                targetEmployees = [user];
            }
        }

        if (!targetEmployees.length) return [];

        const viewYear = moment(currentDate).year();
        const years = [viewYear - 2, viewYear - 1, viewYear, viewYear + 1, viewYear + 2];
        const bEvents = [];

        targetEmployees.forEach(emp => {
            const rawDob = emp.dateOfBirth || emp.dob || emp.personalDetails?.dob;
            if (!rawDob) return;
            const mDob = moment(rawDob);
            if (!mDob.isValid()) return;
            const birthMonth = mDob.month();
            const birthDay = mDob.date();
            const empName = `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.name || 'Employee';

            years.forEach(yr => {
                const bDate = new Date(yr, birthMonth, birthDay);
                bEvents.push({
                    id: `birthday-${emp._id || emp.id || emp.employeeId || 'self'}-${yr}`,
                    title: `🎂 ${empName}'s Birthday`,
                    employeeName: empName,
                    start: bDate,
                    end: bDate,
                    allDay: true,
                    type: 'birthday',
                    desc: `Happy Birthday to ${empName}!${emp.designation ? ` (${emp.designation})` : ''}${emp.department ? ` • ${emp.department}` : ''}`,
                    employee: emp
                });
            });
        });
        return bEvents;
    }, [employeesList, currentDate, user]);

    const allEvents = React.useMemo(() => [...events, ...birthdayEvents], [events, birthdayEvents]);

    const eventPropGetter = (event) => {
        let className = '';
        switch (event.type) {
            case 'holiday': className = 'event-holiday'; break;
            case 'meeting': className = 'event-meeting'; break;
            case 'deadline': className = 'event-deadline'; break;
            case 'leave': className = 'event-leave'; break;
            case 'birthday': className = 'event-birthday'; break;
            default: className = 'event-task'; break;
        }
        return { className };
    };

    const visibleEvents = selectedFilter === 'all'
        ? allEvents
        : allEvents.filter((ev) => (ev.type || 'event') === selectedFilter);

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
        const birthdayEvents = dayEvents.filter(ev => ev.type === 'birthday');
        const hasBirthday = birthdayEvents.length > 0;

        let dateClass = 'calendar-date-number';
        if (isToday && hasBirthday) {
            dateClass = 'calendar-date-today calendar-date-today-birthday';
        } else if (isToday) {
            dateClass = 'calendar-date-today';
        } else if (hasBirthday) {
            dateClass = 'calendar-date-birthday';
        }

        // When user clicks the badge, date badge, or occasion dots -> show occasion modal
        const handleBadgeOrDateClick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.nativeEvent) {
                e.nativeEvent.stopImmediatePropagation();
            }
            justClickedOccasionRef.current = true;
            closeHoverCard();

            if (dayEvents && dayEvents.length > 0) {
                handleOpenOccasion(date, dayEvents);
            } else {
                openAddEventForDate(date);
            }
        };

        return (
            <div
                className={`calendar-date-cell-head${hasBirthday ? ' calendar-date-cell-has-birthday' : ''}`}
                onMouseEnter={(e) => openHoverCard(e, dayMoment, dayEvents)}
                onMouseMove={(e) => openHoverCard(e, dayMoment, dayEvents)}
                onMouseLeave={closeHoverCard}
            >
                <div 
                    className="calendar-date-header-inner"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', width: '100%', minHeight: '26px' }}
                >
                    {hasBirthday && (
                        <span
                            ref={attachOccasionStop}
                            className="calendar-birthday-badge"
                            title="Click to view occasion of this day"
                            onMouseDown={(e) => {
                                justClickedOccasionRef.current = true;
                                e.stopPropagation();
                            }}
                            onTouchStart={(e) => {
                                justClickedOccasionRef.current = true;
                                e.stopPropagation();
                            }}
                            onClick={handleBadgeOrDateClick}
                            style={{ cursor: 'pointer' }}
                        >
                            🎂 {birthdayEvents.length === 1 
                                ? (birthdayEvents[0].employeeName || 'Birthday')
                                : `${birthdayEvents.length} Birthdays`}
                        </span>
                    )}
                    <span 
                        ref={attachOccasionStop}
                        className={dateClass} 
                        title={dayEvents.length > 0 ? "Click to view occasion of this day" : "Click to add event"}
                        onMouseDown={(e) => {
                            if (dayEvents && dayEvents.length > 0) {
                                justClickedOccasionRef.current = true;
                                e.stopPropagation();
                            }
                        }}
                        onTouchStart={(e) => {
                            if (dayEvents && dayEvents.length > 0) {
                                justClickedOccasionRef.current = true;
                                e.stopPropagation();
                            }
                        }}
                        onClick={handleBadgeOrDateClick}
                        style={{ cursor: 'pointer' }}
                    >
                        {label}
                    </span>
                </div>
                <span 
                    ref={attachOccasionStop}
                    className="calendar-date-dots"
                    onMouseDown={(e) => {
                        justClickedOccasionRef.current = true;
                        e.stopPropagation();
                    }}
                    onTouchStart={(e) => {
                        justClickedOccasionRef.current = true;
                        e.stopPropagation();
                    }}
                    onClick={handleBadgeOrDateClick}
                    style={{ cursor: 'pointer' }}
                    title={dayEvents.length > 0 ? "Click to view occasion of this day" : undefined}
                >
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
                    <div className="legend-item"><div className="legend-color event-birthday"></div> Birthday</div>
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
                            selectable={true}
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
                                            holiday:  { color: '#166534', bg: '#dcfce7', border: '#bbf7d0' },
                                            meeting:  { color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
                                            deadline: { color: '#be123c', bg: '#ffe4e6', border: '#fecdd3' },
                                            event:    { color: '#6b21a8', bg: '#f3e8ff', border: '#e9d5ff' },
                                            birthday: { color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
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
                                                        {ev.type === 'birthday' ? (
                                                            <span style={{ fontSize: '10px', color: '#be185d', background: '#fdf2f8', border: '1px solid #fbcfe8', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>
                                                                🎂 Birthday
                                                            </span>
                                                        ) : (
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
                                                        )}
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
                            {canUpdate && hoverCard.events.some(ev => ev.type !== 'birthday') && (
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
                            {canDelete && hoverCard.events.some(ev => ev.type !== 'birthday') && (
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
                            {hoverCard.events.filter(ev => ev.type !== 'birthday').map((ev, idx) => (
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

            {/* Day Occasions Modal (shown when clicking badge or date badge with occasions) */}
            {showOccasionModal && occasionData.date && (
                <div className="modal-overlay" onClick={() => setShowOccasionModal(false)}>
                    <div 
                        className="cal-modal occasion-modal" 
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                            width: '94%',
                            maxWidth: '650px', 
                            borderRadius: '18px', 
                            overflow: 'hidden', 
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 24px 50px rgba(0, 0, 0, 0.16), 0 4px 16px rgba(0, 0, 0, 0.08)'
                        }}
                    >
                        {/* ── Occasion Header ── */}
                        <div 
                            className="cal-modal-hd"
                            style={{
                                background: occasionData.events.some(ev => ev.type === 'birthday')
                                    ? 'linear-gradient(135deg, #fff1f2 0%, #fdf2f8 50%, #fce7f3 100%)'
                                    : '#f8fafc',
                                borderBottom: occasionData.events.some(ev => ev.type === 'birthday')
                                    ? '1.5px solid #fbcfe8'
                                    : '1px solid #e2e8f0',
                                padding: '22px 28px 20px'
                            }}
                        >
                            <div 
                                className="cal-modal-hd-icon"
                                style={{
                                    background: occasionData.events.some(ev => ev.type === 'birthday')
                                        ? 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)'
                                        : 'rgba(59, 119, 94, 0.12)',
                                    color: occasionData.events.some(ev => ev.type === 'birthday') ? '#ffffff' : '#3b775e',
                                    width: '44px',
                                    height: '44px',
                                    borderRadius: '12px',
                                    boxShadow: occasionData.events.some(ev => ev.type === 'birthday')
                                        ? '0 4px 14px rgba(236, 72, 153, 0.35)'
                                        : 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}
                            >
                                {occasionData.events.some(ev => ev.type === 'birthday') ? (
                                    <span style={{ fontSize: '20px', lineHeight: 1 }}>🎂</span>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <rect x="3" y="4" width="18" height="18" rx="3" stroke="#3b775e" strokeWidth="1.8" fill="none"/>
                                        <line x1="16" y1="2" x2="16" y2="6" stroke="#3b775e" strokeWidth="1.8" strokeLinecap="round"/>
                                        <line x1="8" y1="2" x2="8" y2="6" stroke="#3b775e" strokeWidth="1.8" strokeLinecap="round"/>
                                        <line x1="3" y1="10" x2="21" y2="10" stroke="#3b775e" strokeWidth="1.3"/>
                                        <circle cx="12" cy="15" r="2" fill="#3b775e" />
                                    </svg>
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div 
                                    className="cal-modal-title"
                                    style={{ 
                                        fontSize: '17px', 
                                        fontWeight: 800, 
                                        color: occasionData.events.some(ev => ev.type === 'birthday') ? '#831843' : '#0f172a'
                                    }}
                                >
                                    Occasions of the Day
                                </div>
                                <div 
                                    className="cal-modal-sub"
                                    style={{
                                        fontSize: '13px',
                                        color: occasionData.events.some(ev => ev.type === 'birthday') ? '#9d174d' : '#64748b',
                                        marginTop: '3px',
                                        fontWeight: 500
                                    }}
                                >
                                    {moment(occasionData.date).format('dddd, MMMM D, YYYY')} • {occasionData.events.length} {occasionData.events.length === 1 ? 'Occasion' : 'Occasions'}
                                </div>
                            </div>
                            <button 
                                className="cal-close-btn" 
                                onClick={() => setShowOccasionModal(false)}
                                style={{ background: '#f1f5f9', cursor: 'pointer', width: '32px', height: '32px' }}
                            >
                                <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </button>
                        </div>

                        {/* ── Occasions Body ── */}
                        <div 
                            className="cal-modal-body" 
                            style={{ 
                                padding: '24px 28px', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '16px', 
                                maxHeight: '64vh', 
                                overflowY: 'auto' 
                            }}
                        >
                            {occasionData.events.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '36px 16px', color: '#94a3b8' }}>
                                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📅</div>
                                    <h4 style={{ margin: 0, fontSize: '15px', color: '#475569', fontWeight: 600 }}>No occasions scheduled</h4>
                                    <p style={{ margin: '6px 0 16px', fontSize: '13px' }}>There are no special occasions, birthdays, or meetings on this date.</p>
                                    <button
                                        type="button"
                                        className="cal-btn-primary"
                                        style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                        onClick={() => {
                                            setShowOccasionModal(false);
                                            openAddEventForDate(occasionData.date);
                                        }}
                                    >
                                        + Add Event
                                    </button>
                                </div>
                            ) : (
                                occasionData.events.map((ev, idx) => {
                                    if (ev.type === 'birthday') {
                                        const emp = ev.employee || {};
                                        const empName = ev.employeeName || ev.title.replace(/🎂|'s Birthday/g, '').trim();
                                        const initials = empName ? empName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '🎂';
                                        return (
                                            <div 
                                                key={ev.id || `bday-${idx}`}
                                                style={{
                                                    background: 'linear-gradient(135deg, #fff5f8 0%, #fdf2f8 50%, #fce7f3 100%)',
                                                    border: '1.5px solid #fbcfe8',
                                                    borderRadius: '16px',
                                                    padding: '20px 24px',
                                                    boxShadow: '0 4px 16px rgba(236, 72, 153, 0.09)'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                                    <span style={{
                                                        background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
                                                        color: '#ffffff',
                                                        fontSize: '11.5px',
                                                        fontWeight: 700,
                                                        padding: '4px 12px',
                                                        borderRadius: '999px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px',
                                                        boxShadow: '0 2px 8px rgba(236, 72, 153, 0.35)'
                                                    }}>
                                                        🎂 Birthday Celebration
                                                    </span>
                                                    <span style={{ fontSize: '12px', color: '#be185d', fontWeight: 600 }}>All Day</span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                                                    <div style={{
                                                        width: '56px',
                                                        height: '56px',
                                                        borderRadius: '50%',
                                                        background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                                                        color: '#ffffff',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '20px',
                                                        fontWeight: 700,
                                                        flexShrink: 0,
                                                        boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)'
                                                    }}>
                                                        {initials}
                                                    </div>
                                                    <div>
                                                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#831843' }}>
                                                            {empName}
                                                        </h3>
                                                        <div style={{ fontSize: '13.5px', color: '#9d174d', marginTop: '3px', fontWeight: 500 }}>
                                                            {emp.designation || (emp.role?.name) || 'Bhoomi Techzone Team Member'}
                                                            {emp.department ? ` • ${emp.department}` : ''}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div style={{
                                                    background: 'rgba(255, 255, 255, 0.88)',
                                                    border: '1.5px dashed #f472b6',
                                                    borderRadius: '12px',
                                                    padding: '13px 16px',
                                                    fontSize: '13.5px',
                                                    color: '#701a75',
                                                    lineHeight: 1.55
                                                }}>
                                                    🎉 <strong>Warm Birthday Wishes:</strong> Wishing {empName} a very Happy Birthday! May your day be filled with celebration, joy, and inspiring success in the year ahead! 🎂🎈
                                                </div>

                                                {(emp.email || emp.officialEmail || emp.phone || emp.mobile) && (
                                                    <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginTop: '12px', fontSize: '12.5px', color: '#9d174d', fontWeight: 500 }}>
                                                        {(emp.email || emp.officialEmail) && (
                                                            <span>📧 {emp.email || emp.officialEmail}</span>
                                                        )}
                                                        {(emp.phone || emp.mobile) && (
                                                            <span>📞 {emp.phone || emp.mobile}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    }

                                    if (ev.type === 'holiday') {
                                        return (
                                            <div 
                                                key={ev.id || `holiday-${idx}`}
                                                style={{
                                                    background: '#f0fdf4',
                                                    border: '1.5px solid #bbf7d0',
                                                    borderRadius: '14px',
                                                    padding: '16px 18px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{
                                                        background: '#10b981',
                                                        color: '#fff',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        padding: '3px 10px',
                                                        borderRadius: '999px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        🌴 Public Holiday
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        {canUpdate && (
                                                            <button 
                                                                onClick={() => { setShowOccasionModal(false); handleEditEvent(ev); }}
                                                                style={{ background: 'white', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '3px 8px', fontSize: '11.5px', color: '#16a34a', cursor: 'pointer', fontWeight: 600 }}
                                                            >
                                                                Edit
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button 
                                                                onClick={() => { setShowOccasionModal(false); handleDeleteEvent(ev); }}
                                                                style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 8px', fontSize: '11.5px', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <h4 style={{ margin: '0 0 4px', fontSize: '15.5px', color: '#14532d', fontWeight: 700 }}>
                                                    {ev.title}
                                                </h4>
                                                <p style={{ margin: 0, fontSize: '13px', color: '#166534', lineHeight: 1.45 }}>
                                                    {ev.desc || 'Public holiday scheduled for the office.'}
                                                </p>
                                            </div>
                                        );
                                    }

                                    if (ev.type === 'meeting') {
                                        return (
                                            <div 
                                                key={ev.id || `meeting-${idx}`}
                                                style={{
                                                    background: '#eff6ff',
                                                    border: '1.5px solid #bfdbfe',
                                                    borderRadius: '14px',
                                                    padding: '16px 18px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{
                                                        background: '#3b82f6',
                                                        color: '#fff',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        padding: '3px 10px',
                                                        borderRadius: '999px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        👥 Meeting
                                                    </span>
                                                    <span style={{ fontSize: '11.5px', color: '#2563eb', fontWeight: 600 }}>
                                                        {moment(ev.start).format('h:mm A')} – {moment(ev.end).format('h:mm A')}
                                                    </span>
                                                </div>
                                                <h4 style={{ margin: '0 0 4px', fontSize: '15.5px', color: '#1e3a8a', fontWeight: 700 }}>
                                                    {ev.title}
                                                </h4>
                                                {ev.desc && (
                                                    <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: 1.45 }}>
                                                        {ev.desc}
                                                    </p>
                                                )}
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                                    {canUpdate && (
                                                        <button 
                                                            onClick={() => { setShowOccasionModal(false); handleEditEvent(ev); }}
                                                            style={{ background: 'white', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '3px 8px', fontSize: '11.5px', color: '#2563eb', cursor: 'pointer', fontWeight: 600 }}
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button 
                                                            onClick={() => { setShowOccasionModal(false); handleDeleteEvent(ev); }}
                                                            style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 8px', fontSize: '11.5px', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (ev.type === 'deadline') {
                                        return (
                                            <div 
                                                key={ev.id || `deadline-${idx}`}
                                                style={{
                                                    background: '#fef2f2',
                                                    border: '1.5px solid #fecaca',
                                                    borderRadius: '14px',
                                                    padding: '16px 18px'
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span style={{
                                                        background: '#ef4444',
                                                        color: '#fff',
                                                        fontSize: '11px',
                                                        fontWeight: 700,
                                                        padding: '3px 10px',
                                                        borderRadius: '999px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        ⏰ Project Deadline
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>Due Today</span>
                                                </div>
                                                <h4 style={{ margin: '0 0 4px', fontSize: '15.5px', color: '#7f1d1d', fontWeight: 700 }}>
                                                    {ev.title}
                                                </h4>
                                                {ev.desc && (
                                                    <p style={{ margin: 0, fontSize: '13px', color: '#991b1b', lineHeight: 1.45 }}>
                                                        {ev.desc}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    }

                                    return (
                                        <div 
                                            key={ev.id || `event-${idx}`}
                                            style={{
                                                background: ev.type === 'leave' ? '#fffbeb' : '#f5f3ff',
                                                border: `1.5px solid ${ev.type === 'leave' ? '#fde68a' : '#ddd6fe'}`,
                                                borderRadius: '14px',
                                                padding: '16px 18px'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                <span style={{
                                                    background: ev.type === 'leave' ? '#f59e0b' : '#8b5cf6',
                                                    color: '#fff',
                                                    fontSize: '11px',
                                                    fontWeight: 700,
                                                    padding: '3px 10px',
                                                    borderRadius: '999px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}>
                                                    {ev.type === 'leave' ? '🏖️ Leave' : '📌 Event'}
                                                </span>
                                                {!ev.allDay && (
                                                    <span style={{ fontSize: '11.5px', color: ev.type === 'leave' ? '#d97706' : '#7c3aed', fontWeight: 600 }}>
                                                        {moment(ev.start).format('h:mm A')}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 style={{ margin: '0 0 4px', fontSize: '15.5px', color: ev.type === 'leave' ? '#78350f' : '#4c1d95', fontWeight: 700 }}>
                                                {ev.title}
                                            </h4>
                                            {ev.desc && (
                                                <p style={{ margin: 0, fontSize: '13px', color: ev.type === 'leave' ? '#92400e' : '#5b21b6', lineHeight: 1.45 }}>
                                                    {ev.desc}
                                                </p>
                                            )}
                                            {ev.type !== 'leave' && (
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                                    {canUpdate && (
                                                        <button 
                                                            onClick={() => { setShowOccasionModal(false); handleEditEvent(ev); }}
                                                            style={{ background: 'white', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '3px 8px', fontSize: '11.5px', color: '#7c3aed', cursor: 'pointer', fontWeight: 600 }}
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button 
                                                            onClick={() => { setShowOccasionModal(false); handleDeleteEvent(ev); }}
                                                            style={{ background: 'white', border: '1px solid #fecaca', borderRadius: '6px', padding: '3px 8px', fontSize: '11.5px', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* ── Occasions Footer ── */}
                        <div 
                            className="cal-footer" 
                            style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                borderTop: '1px solid #f1f5f9', 
                                padding: '14px 20px', 
                                background: '#fafafa' 
                            }}
                        >
                            <button
                                type="button"
                                style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    gap: '8px', 
                                    fontSize: '13.5px', 
                                    padding: '10px 22px', 
                                    background: '#3b775e', 
                                    color: '#ffffff', 
                                    borderRadius: '10px', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    fontWeight: 600,
                                    transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#2f6350'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#3b775e'}
                                onClick={() => {
                                    setShowOccasionModal(false);
                                    openAddEventForDate(occasionData.date);
                                }}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <line x1="7" y1="1" x2="7" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                                    <line x1="1" y1="7" x2="13" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                                Add Event for this Day
                            </button>
                            <button
                                type="button"
                                className="cal-btn-ghost"
                                style={{ 
                                    padding: '10px 22px', 
                                    background: '#f1f5f9', 
                                    color: '#475569', 
                                    borderRadius: '10px', 
                                    border: 'none', 
                                    cursor: 'pointer', 
                                    fontWeight: 600,
                                    fontSize: '13.5px',
                                    transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                onClick={() => setShowOccasionModal(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => { setShowModal(false); setEditMode(false); }}>
                    <div className="cal-modal" onClick={(e) => e.stopPropagation()} style={{ width: '94%', maxWidth: '620px', borderRadius: '18px' }}>
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
                                            ? `${viewEvent.type === 'birthday' ? '🎂 Birthday' : viewEvent.type} · ${moment(viewEvent.start).format('MMM D, YYYY')}`
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
                                            { v: 'holiday', l: 'Holiday' },
                                            { v: 'birthday', l: 'Birthday' }
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
                                        <span className="cal-detail-val" style={{ textTransform: 'capitalize', color: viewEvent.type === 'birthday' ? '#be185d' : 'inherit', fontWeight: viewEvent.type === 'birthday' ? 700 : 'inherit' }}>
                                            {viewEvent.type === 'birthday' ? '🎂 Birthday' : viewEvent.type}
                                        </span>
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
