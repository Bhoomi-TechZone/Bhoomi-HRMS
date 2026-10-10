import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import {
    Plus, Search, Calendar, Video, Phone, Users, CheckCircle, XCircle,
    Clock, Eye, Trash2, ChevronDown, Check, RefreshCw, ExternalLink,
    MapPin, UserCheck, UserX, AlertCircle, Edit3, Award, Star, MessageSquare,
    Layers, UserPlus, X, Sparkles
} from 'lucide-react';
import './RecruitmentDashboard.css';

const statusColors = {
    Scheduled: { bg: '#dbeafe', color: '#1d4ed8' },
    Completed: { bg: '#dcfce7', color: '#166534' },
    Cancelled: { bg: '#fee2e2', color: '#991b1b' },
    Pending: { bg: '#fef9c3', color: '#854d0e' },
};

const typeColors = {
    Video: { bg: '#eff6ff', color: '#2563eb', icon: Video, label: 'Video Call (Google Meet / Zoom)' },
    Phone: { bg: '#fdf4ff', color: '#9333ea', icon: Phone, label: 'Phone Screen Call' },
    'In-Person': { bg: '#f0fdf4', color: '#16a34a', icon: Users, label: 'In-Person (Office)' }
};

const avatarColors = [
    { bg: '#e0e7ff', color: '#4338ca' },
    { bg: '#fce7f3', color: '#be185d' },
    { bg: '#e0f2fe', color: '#0369a1' },
    { bg: '#dcfce7', color: '#15803d' },
    { bg: '#fef3c7', color: '#b45309' },
    { bg: '#ede9fe', color: '#6d28d9' }
];

const DEFAULT_ROUNDS = [
    'HR Round',
    'Technical Interview',
    'Practical / Coding',
    'Final Discussion'
];

// Helper to strip existing "Round X - " or "Round X: " or "Stage X - " or "#X"
const cleanRoundTitle = (str = '') => {
    return str
        .replace(/^Round\s*\d+\s*[-:]?\s*/i, '')
        .replace(/^Stage\s*\d+\s*[-:]?\s*/i, '')
        .replace(/^#\d+\s*[-:]?\s*/i, '')
        .trim();
};

const ScheduleInterview = () => {
    const calcChange = (cur, prev) => {
        if (!prev) return cur ? '100%' : '0%';
        return Math.round(Math.abs((cur - prev) / prev * 100)) + '%';
    };
    const isUp = (cur, prev) => cur >= prev;

    const Sparkline = ({ data, color }) => {
        const w = 80, h = 32;
        const max = Math.max(...data, 1);
        const min = Math.min(...data);
        const range = max - min || 1;
        const pts = data.map((v, i) => {
            const x = (i / (data.length - 1)) * w;
            const y = h - 4 - ((v - min) / range) * (h - 10);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        const fillPts = `0,${h} ${pts} ${w},${h}`;
        return (
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
                <defs>
                    <linearGradient id={`slg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.2" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <polygon points={fillPts} fill={`url(#slg-${color.replace('#', '')})`} />
                <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                {data.map((v, i) => {
                    const x = (i / (data.length - 1)) * w;
                    const y = h - 4 - ((v - min) / range) * (h - 10);
                    return i === data.length - 1 ? <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} /> : null;
                })}
            </svg>
        );
    };

    const [interviews, setInterviews] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [interviewers, setInterviewers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [viewInterview, setViewInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Dynamic Rounds with local storage persistence
    const [rounds, setRounds] = useState(() => {
        try {
            const saved = localStorage.getItem('interview_rounds');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const cleaned = parsed.map(r => cleanRoundTitle(r)).filter(Boolean);
                    if (cleaned.length > 0) return Array.from(new Set(cleaned));
                }
            }
        } catch (_) { }
        return DEFAULT_ROUNDS;
    });
    const [newRoundInput, setNewRoundInput] = useState('');
    const [newEditRoundInput, setNewEditRoundInput] = useState('');

    // Modal Dropdowns visibility state (Schedule Modal)
    const [showCandDd, setShowCandDd] = useState(false);
    const [showInterviewerDd, setShowInterviewerDd] = useState(false);
    const [showTypeDd, setShowTypeDd] = useState(false);
    const [showRoundDd, setShowRoundDd] = useState(false);
    const [showStatusDd, setShowStatusDd] = useState(false);

    // Modal Dropdowns visibility state (Edit Modal)
    const [showEditInterviewerDd, setShowEditInterviewerDd] = useState(false);
    const [showEditTypeDd, setShowEditTypeDd] = useState(false);
    const [showEditRoundDd, setShowEditRoundDd] = useState(false);
    const [showEditStatusDd, setShowEditStatusDd] = useState(false);

    // Filter dropdowns
    const [showStatusFilterDd, setShowStatusFilterDd] = useState(false);
    const [showTypeFilterDd, setShowTypeFilterDd] = useState(false);
    const [activeStatusDdId, setActiveStatusDdId] = useState(null);

    // Dropdown search queries
    const [candSearch, setCandSearch] = useState('');
    const [interviewerSearch, setInterviewerSearch] = useState('');
    const [editInterviewerSearch, setEditInterviewerSearch] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const INTERVIEWS_PER_PAGE = 10;

    const initialForm = {
        candidateId: '',
        jobId: '',
        interviewerId: '',
        date: '',
        type: 'Video',
        status: 'Scheduled',
        round: rounds[0] || 'HR Round',
        notes: '',
        location: ''
    };
    const [formData, setFormData] = useState(initialForm);
    const [editFormData, setEditFormData] = useState(initialForm);

    useEffect(() => {
        fetchInterviews();
        fetchCandidates();
        fetchInterviewers();
    }, []);

    useEffect(() => {
        const close = () => {
            setShowStatusFilterDd(false);
            setShowTypeFilterDd(false);
            setShowCandDd(false);
            setShowInterviewerDd(false);
            setShowTypeDd(false);
            setShowRoundDd(false);
            setShowStatusDd(false);
            setShowEditInterviewerDd(false);
            setShowEditTypeDd(false);
            setShowEditRoundDd(false);
            setShowEditStatusDd(false);
            setActiveStatusDdId(null);
        };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, typeFilter]);

    const fetchInterviews = async () => {
        try {
            const res = await api.get('/recruitment/interviews');
            setInterviews(res.data || []);
        }
        catch (err) { console.error("Failed to load interviews", err); }
        finally { setLoading(false); }
    };

    const fetchCandidates = async () => {
        try {
            const res = await api.get('/recruitment/candidates');
            setCandidates(res.data || []);
        }
        catch (err) { console.error("Failed to load candidates", err); }
    };

    const fetchInterviewers = async () => {
        try {
            const res = await api.get('/recruitment/interviewers');
            setInterviewers(res.data || []);
        } catch (err) {
            console.error("Failed to load interviewers", err);
        }
    };

    // Add round directly
    const handleAddRound = (isEdit = false) => {
        const inputVal = isEdit ? newEditRoundInput : newRoundInput;
        const trimmed = inputVal.trim();
        if (!trimmed) return;
        const clean = cleanRoundTitle(trimmed) || trimmed;
        if (rounds.some(r => r.toLowerCase() === clean.toLowerCase())) {
            alert('This round title already exists in the list.');
            return;
        }
        const updated = [...rounds, clean];
        setRounds(updated);
        try { localStorage.setItem('interview_rounds', JSON.stringify(updated)); } catch (_) { }

        if (isEdit) {
            setEditFormData(prev => ({ ...prev, round: clean }));
            setNewEditRoundInput('');
        } else {
            setFormData(prev => ({ ...prev, round: clean }));
            setNewRoundInput('');
        }
    };

    // Remove round directly
    const handleRemoveRound = (roundName, e) => {
        if (e) e.stopPropagation();
        if (rounds.length <= 1) {
            alert('You must keep at least one interview round.');
            return;
        }
        const cleanName = cleanRoundTitle(roundName) || roundName;
        if (!window.confirm(`Remove "${cleanName}" from interview rounds?`)) return;
        const remaining = rounds.filter(r => cleanRoundTitle(r) !== cleanName);
        setRounds(remaining);
        try { localStorage.setItem('interview_rounds', JSON.stringify(remaining)); } catch (_) { }

        if (cleanRoundTitle(formData.round) === cleanName || !remaining.includes(formData.round)) {
            setFormData(prev => ({ ...prev, round: remaining[0] || '' }));
        }
        if (cleanRoundTitle(editFormData.round) === cleanName || !remaining.includes(editFormData.round)) {
            setEditFormData(prev => ({ ...prev, round: remaining[0] || '' }));
        }
    };

    const handleCandidateSelect = (c) => {
        setFormData({
            ...formData,
            candidateId: c._id,
            jobId: c?.jobId?._id || c?.jobId || ''
        });
        setShowCandDd(false);
        setCandSearch('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.candidateId) {
            alert('Please select a candidate.');
            return;
        }
        if (!formData.date) {
            alert('Please select an interview date & time.');
            return;
        }
        setSubmitting(true);
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const payload = {
                ...formData,
                interviewerId: formData.interviewerId || user._id
            };
            await api.post('/recruitment/interviews', payload);
            setShowModal(false);
            setFormData(initialForm);
            fetchInterviews();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to schedule interview');
        } finally {
            setSubmitting(false);
        }
    };

    const openEditModal = (interview) => {
        let formattedDate = '';
        if (interview.date) {
            const d = new Date(interview.date);
            const pad = (n) => String(n).padStart(2, '0');
            formattedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }

        const currentRound = cleanRoundTitle(interview.round) || rounds[0] || 'HR Round';
        if (currentRound && !rounds.includes(currentRound)) {
            const updated = [...rounds, currentRound];
            setRounds(updated);
            try { localStorage.setItem('interview_rounds', JSON.stringify(updated)); } catch (_) { }
        }

        setEditFormData({
            _id: interview._id,
            candidateId: interview.candidateId?._id || interview.candidateId,
            candidateName: `${interview.candidateId?.firstName || ''} ${interview.candidateId?.lastName || ''}`.trim(),
            jobTitle: interview.jobId?.title || '',
            jobId: interview.jobId?._id || interview.jobId || '',
            interviewerId: interview.interviewerId?._id || interview.interviewerId || '',
            date: formattedDate,
            type: interview.type || 'Video',
            status: interview.status || 'Scheduled',
            round: currentRound,
            location: interview.location || interview.meetingLink || '',
            notes: interview.notes || '',
            feedback: interview.feedback || '',
            score: interview.score || 0
        });
        setShowEditModal(true);
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!editFormData.date) {
            alert('Please select an interview date & time.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await api.put(`/recruitment/interviews/${editFormData._id}`, editFormData);
            setShowEditModal(false);
            if (viewInterview?._id === editFormData._id) {
                setViewInterview(res.data);
            }
            fetchInterviews();
        } catch (err) {
            console.error('Failed to update interview:', err);
            alert(err.response?.data?.message || 'Failed to update interview');
        } finally {
            setSubmitting(false);
        }
    };

    const handleStatusUpdate = async (id, status) => {
        const prev = interviews.find(i => i._id === id);
        setInterviews(list => list.map(i => i._id === id ? { ...i, status } : i));
        if (viewInterview?._id === id) setViewInterview(v => ({ ...v, status }));
        setActiveStatusDdId(null);
        try {
            await api.patch(`/recruitment/interviews/${id}/status`, { status });
        } catch (err) {
            console.error('Status update failed:', err);
            if (prev) {
                setInterviews(list => list.map(i => i._id === id ? { ...i, status: prev.status } : i));
                if (viewInterview?._id === id) setViewInterview(v => ({ ...v, status: prev.status }));
            }
            alert(`Failed to update status: ${err?.response?.data?.message || err.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this interview schedule?')) return;
        try {
            await api.delete(`/recruitment/interviews/${id}`);
            if (viewInterview?._id === id) setViewInterview(null);
            fetchInterviews();
        }
        catch (err) { alert('Failed to delete'); }
    };

    const filtered = interviews.filter(i => {
        const candName = `${i.candidateId?.firstName || ''} ${i.candidateId?.lastName || ''}`.toLowerCase();
        const candEmail = (i.candidateId?.email || '').toLowerCase();
        const appId = (i.candidateId?.applicationId || '').toLowerCase();
        const jobTitle = (i.jobId?.title || '').toLowerCase();
        const interviewerName = `${i.interviewerId?.firstName || ''} ${i.interviewerId?.lastName || ''}`.toLowerCase();
        const term = searchTerm.toLowerCase();

        const matchSearch = !term || candName.includes(term) || candEmail.includes(term) || jobTitle.includes(term) || interviewerName.includes(term) || appId.includes(term);
        const matchStatus = statusFilter === 'All' || i.status === statusFilter;
        const matchType = typeFilter === 'All' || i.type === typeFilter;
        return matchSearch && matchStatus && matchType;
    });

    const totalPages = Math.ceil(filtered.length / INTERVIEWS_PER_PAGE) || 1;
    const startIndex = (currentPage - 1) * INTERVIEWS_PER_PAGE;
    const paginatedInterviews = filtered.slice(startIndex, startIndex + INTERVIEWS_PER_PAGE);

    const sparklineData = useMemo(() => {
        const now = new Date();
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });
        const countFor = (filterFn) =>
            months.map(({ year, month }) =>
                interviews.filter(item => {
                    const d = new Date(item.date || item.createdAt || Date.now());
                    return d.getFullYear() === year && d.getMonth() === month && filterFn(item);
                }).length
            );
        return {
            total: countFor(() => true),
            scheduled: countFor(i => i.status === 'Scheduled'),
            completed: countFor(i => i.status === 'Completed'),
            cancelled: countFor(i => i.status === 'Cancelled' || i.status === 'Pending')
        };
    }, [interviews]);

    const stats = {
        total: interviews.length,
        scheduled: interviews.filter(i => i.status === 'Scheduled').length,
        completed: interviews.filter(i => i.status === 'Completed').length,
        cancelled: interviews.filter(i => i.status === 'Cancelled').length,
    };

    const getAvatarColor = (name = '') => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return avatarColors[Math.abs(hash) % avatarColors.length];
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return { date: '—', time: '' };
        const d = new Date(dateString);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const date = `${dd}-${mm}-${yyyy}`;
        const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return { date, time };
    };

    if (loading) return (
        <div className="page-container" style={{ background: '#f8fafc', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', -apple-system, sans-serif", padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                @keyframes rc-pro-shimmer {
                    0% { background-position: -800px 0; }
                    100% { background-position: 800px 0; }
                }
                .skel {
                    background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 35%, #f8fafc 50%, #e2e8f0 65%, #f1f5f9 100%);
                    background-size: 800px 100%;
                    animation: rc-pro-shimmer 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    border-radius: 6px;
                }
                .skel-card {
                    background: #ffffff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 14px 16px 10px;
                    position: relative;
                    overflow: hidden;
                }
            `}</style>

            {/* Header Skeleton */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <div className="skel" style={{ width: '180px', height: '22px', marginBottom: '6px' }} />
                    <div className="skel" style={{ width: '300px', height: '12px' }} />
                </div>
                <div className="skel" style={{ width: '160px', height: '38px', borderRadius: '10px' }} />
            </div>

            {/* Top 4 Stat Cards Skeleton */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="skel-card">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div className="skel" style={{ width: '85px', height: '12px' }} />
                            <div className="skel" style={{ width: '42px', height: '18px', borderRadius: '20px' }} />
                        </div>
                        <div className="skel" style={{ width: '48px', height: '26px', marginBottom: '10px' }} />
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                            <div>
                                <div className="skel" style={{ width: '44px', height: '11px', marginBottom: '4px' }} />
                                <div className="skel" style={{ width: '64px', height: '9px' }} />
                            </div>
                            <div className="skel" style={{ width: '76px', height: '26px', borderRadius: '6px' }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters Bar Skeleton */}
            <div style={{ padding: '14px 16px', background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', gap: '10px', marginBottom: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="skel" style={{ flex: 1, minWidth: '220px', height: '36px', borderRadius: '10px' }} />
                <div className="skel" style={{ width: '120px', height: '36px', borderRadius: '10px' }} />
                <div className="skel" style={{ width: '120px', height: '36px', borderRadius: '10px' }} />
            </div>

            {/* Table Skeleton */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '40px 2.2fr 1.6fr 1.8fr 1.1fr 1.4fr 1.1fr 80px', gap: '12px', padding: '11px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    {['#', 'CANDIDATE', 'APPLIED FOR', 'DATE & TIME', 'TYPE', 'INTERVIEWER', 'STATUS', 'ACTIONS'].map((col, i) => (
                        <div key={i} className="skel" style={{ width: i === 0 ? '16px' : i === 7 ? '54px' : '70px', height: '10px' }} />
                    ))}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 2.2fr 1.6fr 1.8fr 1.1fr 1.4fr 1.1fr 80px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                            <div className="skel" style={{ width: '16px', height: '12px' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="skel" style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />
                                <div>
                                    <div className="skel" style={{ width: `${100 + (i % 3) * 20}px`, height: '13px', marginBottom: '5px' }} />
                                    <div className="skel" style={{ width: '130px', height: '10px' }} />
                                </div>
                            </div>
                            <div className="skel" style={{ width: '100px', height: '12px' }} />
                            <div className="skel" style={{ width: '110px', height: '12px' }} />
                            <div className="skel" style={{ width: '60px', height: '22px', borderRadius: '6px' }} />
                            <div className="skel" style={{ width: '90px', height: '12px' }} />
                            <div className="skel" style={{ width: '72px', height: '22px', borderRadius: '999px' }} />
                            <div className="skel" style={{ width: '60px', height: '26px', borderRadius: '6px' }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="page-container" style={{ background: '#f8fafc', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', -apple-system, sans-serif", padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                .ist-action-btn { background: transparent; border: none; padding: 6px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
                .ist-action-btn:hover { background: #f1f5f9; }
                .ist-action-btn.danger:hover { background: #fee2e2; color: #ef4444; }
                .ist-action-btn.edit:hover { background: #e0e7ff; color: #4338ca; }
                
                .ist-tbl { font-family: 'Inter','Poppins','Segoe UI',sans-serif; width: 100%; border-collapse: collapse; }
                .ist-tbl thead tr { background: #fafafa; }
                .ist-tbl thead th { position: sticky; top: 0; z-index: 10; background: #fafafa; font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding: 9px 12px; text-align: left; white-space: nowrap; font-family: 'Inter','Poppins','Segoe UI',sans-serif; border-bottom: 1px solid #f1f5f9; }
                .ist-tbl tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .15s; }
                .ist-tbl tbody tr:hover { background: #fafffe; }
                .ist-tbl tbody td { font-size: 13px; color: #475569; padding: 8px 12px; vertical-align: middle; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
                .ist-tbl tbody tr:last-child { border-bottom: none; }
                
                @keyframes bubble-float-large { 0% { transform: translate(0px, 0px) scale(1); } 30% { transform: translate(-5px, -7px) scale(1.04); } 60% { transform: translate(4px, -4px) scale(0.97); } 100% { transform: translate(0px, 0px) scale(1); } }
                @keyframes bubble-float-small { 0% { transform: translate(0px, 0px) scale(1); } 40% { transform: translate(6px, -4px) scale(0.95); } 75% { transform: translate(-3px, 5px) scale(1.05); } 100% { transform: translate(0px, 0px) scale(1); } }
                .ist-stats-grid > div { position: relative; overflow: hidden; isolation: isolate; }
                .ist-stats-grid > div::before { content: ''; position: absolute; z-index: 0; width: 90px; height: 90px; border-radius: 50%; opacity: 0.06; right: -26px; bottom: -26px; pointer-events: none; animation: bubble-float-large 5.5s ease-in-out infinite; }
                .ist-stats-grid > div::after { content: ''; position: absolute; z-index: 0; width: 54px; height: 54px; border-radius: 50%; opacity: 0.04; right: 36px; bottom: -20px; pointer-events: none; animation: bubble-float-small 4.2s ease-in-out infinite; }
                .ist-stats-grid > div:nth-child(1)::before, .ist-stats-grid > div:nth-child(1)::after { background: #667eea; }
                .ist-stats-grid > div:nth-child(2)::before, .ist-stats-grid > div:nth-child(2)::after { background: #3b82f6; }
                .ist-stats-grid > div:nth-child(3)::before, .ist-stats-grid > div:nth-child(3)::after { background: #10b981; }
                .ist-stats-grid > div:nth-child(4)::before, .ist-stats-grid > div:nth-child(4)::after { background: #ef4444; }
                .ist-stats-grid > div:nth-child(2)::before { animation-delay: 0.8s; } .ist-stats-grid > div:nth-child(3)::before { animation-delay: 1.5s; } .ist-stats-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
                .ist-stats-grid > div:nth-child(2)::after { animation-delay: 1.2s; } .ist-stats-grid > div:nth-child(3)::after { animation-delay: 0.5s; } .ist-stats-grid > div:nth-child(4)::after { animation-delay: 1.8s; }

                .job-modal { background: #fff; border-radius: 20px; width: 100%; max-width: 800px; max-height: 90vh; overflow-y: auto; border: 1px solid #e8edf0; box-shadow: 0 16px 50px rgba(0,0,0,0.18); font-family: 'Inter', 'Segoe UI', sans-serif; animation: jobModalIn 0.22s cubic-bezier(0.16,1,0.3,1); -ms-overflow-style: none; scrollbar-width: none; }
                .job-modal::-webkit-scrollbar { display: none; }
                .job-modal-sticky-head { position: sticky; top: 0; background: #fff; z-index: 100; border-bottom: 1px solid #f1f3f5; }
                .job-modal-hd { display: flex; align-items: center; gap: 12px; padding: 20px 24px 16px; background: #fafafa; border-radius: 20px 20px 0 0; }
                .job-modal-hd-icon { width: 38px; height: 38px; border-radius: 11px; background: rgba(59,119,94,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .job-modal-title { font-size: 16px; font-weight: 700; color: #111827; letter-spacing: -0.01em; line-height: 1.3; }
                .job-modal-sub { font-size: 12.5px; color: #9ca3af; margin-top: 2px; line-height: 1.3; }
                .job-close-btn { margin-left: auto; width: 30px; height: 30px; border-radius: 50%; background: #f1f5f9; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; flex-shrink: 0; transition: background 0.15s, color 0.15s; font-size: 20px; line-height: 1; }
                .job-close-btn:hover { background: #e5e7eb; color: #111827; }
                .job-modal-body { padding: 24px 26px; }
                .job-form { display: flex; flex-direction: column; gap: 18px; }
                .job-section-lbl { font-size: 10.5px; font-weight: 700; color: #3b775e; text-transform: uppercase; letter-spacing: 0.08em; padding-bottom: 6px; border-bottom: 1.5px solid #e8f3ee; margin-bottom: 4px; }
                .job-field { display: flex; flex-direction: column; gap: 6px; position: relative; }
                .job-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .job-lbl { font-size: 12px; font-weight: 600; color: #374151; letter-spacing: 0.02em; }
                .job-req { color: #ef4444; margin-left: 2px; }
                .job-input { width: 100%; padding: 10px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 13px; color: #111827; background: #fff; font-family: 'Inter', sans-serif; box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s; outline: none; }
                .job-input:focus { border-color: #3b775e; box-shadow: 0 0 0 3px rgba(59,119,94,0.09); }
                .job-input::placeholder { color: #c4c9d4; font-size: 12.5px; }
                .job-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 18px; border-top: 1px solid #f1f3f5; margin-top: 6px; }
                .job-btn-primary { padding: 10px 26px; border: none; background: linear-gradient(135deg, #3b775e 0%, #56a07a 100%); border-radius: 10px; font-size: 13px; font-weight: 700; color: #fff; cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity 0.15s, transform 0.15s; }
                .job-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
                .job-btn-ghost { position: relative; isolation: isolate; color: #64748b; background: #fff; border: 1.5px solid #e2e8f0; padding: 10px 24px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s; display: flex; align-items: center; gap: 6px; overflow: hidden; }
                .job-btn-ghost:hover { background: #f8fafc; color: #1e293b; border-color: #cbd5e1; }
                
                .job-dd-btn { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 42px; padding: 9px 14px; border: 1.5px solid #e2e8f0; border-radius: 10px; font-size: 13px; color: #1e293b; background: #fff; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; outline: none; text-align: left; box-sizing: border-box; }
                .job-dd-btn:hover { border-color: #cbd5e1; }
                .job-dd-btn:focus, .job-dd-btn.active { border-color: #3b775e; box-shadow: 0 0 0 3px rgba(59,119,94,0.09); }
                .job-dd-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 16px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.06); z-index: 1000; max-height: 380px; padding: 12px; overflow: hidden; animation: jobModalIn 0.18s ease; border: 1px solid #e2e8f0; display: flex; flex-direction: column; box-sizing: border-box; }
                .job-dd-search-input { width: 100%; padding: 8px 12px; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 12.5px; background: #f8fafc; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box; transition: border-color 0.15s, background 0.15s; }
                .job-dd-search-input:focus { border-color: #3b775e; background: #fff; }
                .job-dd-scroll { max-height: 240px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; display: flex; flex-direction: column; gap: 4px; }
                .job-dd-scroll::-webkit-scrollbar { width: 5px; }
                .job-dd-scroll::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 4px; }
                .job-dd-option { padding: 9px 12px; border-radius: 8px; font-size: 12.5px; cursor: pointer; transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease; color: #334155; display: flex; align-items: center; justify-content: space-between; gap: 8px; box-sizing: border-box; user-select: none; }
                .job-dd-option:hover { background: #f1f5f9 !important; color: #0f172a !important; }
                .job-dd-option.selected { background: #f0fdf4 !important; color: #15803d !important; font-weight: 600; }
                .rc-dd-option { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.15s ease; }
                .rc-dd-option:hover { background: #f1f5f9; color: #0f172a; }

                @keyframes jobModalIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            {/* Page Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "22px",
                    gap: "12px",
                    flexWrap: "wrap",
                }}
            >
                <div>
                    <h1
                        style={{
                            fontSize: "24px",
                            fontWeight: 600,
                            color: "#0f172a",
                            margin: 0,
                            letterSpacing: "-0.025em",
                        }}
                    >
                        Interview Schedule
                    </h1>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>
                        Track, filter and manage candidate interview appointments and evaluations
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={() => { setFormData(initialForm); setShowModal(true); }}
                        style={{
                            padding: '10px 18px',
                            border: 'none',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: 'none',
                            transition: 'all 0.2s',
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <Plus size={16} /> Schedule Interview
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="ist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Interviews', value: stats.total, color: '#667eea', spark: sparklineData.total, filterVal: 'All' },
                    { label: 'Scheduled', value: stats.scheduled, color: '#3b82f6', spark: sparklineData.scheduled, filterVal: 'Scheduled' },
                    { label: 'Completed', value: stats.completed, color: '#10b981', spark: sparklineData.completed, filterVal: 'Completed' },
                    { label: 'Cancelled', value: stats.cancelled, color: '#ef4444', spark: sparklineData.cancelled, filterVal: 'Cancelled' }
                ].map((s) => {
                    const cur = s.spark[5] || 0;
                    const prev = s.spark[4] || 0;
                    const trend = calcChange(cur, prev);
                    const up = isUp(cur, prev);
                    const isSelected = s.filterVal === 'All' ? (statusFilter === 'All') : (statusFilter === s.filterVal);
                    return (
                        <div
                            key={s.label}
                            style={{
                                background: 'white',
                                padding: '14px 16px 10px',
                                borderRadius: '12px',
                                border: isSelected && statusFilter !== 'All' ? `2px solid ${s.color}` : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                overflow: 'hidden',
                                position: 'relative'
                            }}
                            onClick={() => setStatusFilter(s.filterVal)}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{s.label}</div>
                                <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: up ? 'rgba(168,230,61,0.15)' : 'rgba(239,68,68,0.1)', color: up ? '#3d7c00' : '#dc2626', whiteSpace: 'nowrap' }}>
                                    {up ? '▲' : '▼'} {trend}
                                </span>
                            </div>
                            <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px' }}>{s.value}</div>
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 700, color: up ? '#16a34a' : '#ef4444', lineHeight: 1.2 }}>{up ? '+' : ''}{trend}</span>
                                    <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.4 }}>vs last month</span>
                                </div>
                                <Sparkline data={s.spark} color={s.color} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filters Bar */}
            <div style={{ padding: '14px 16px', background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0 12px' }}>
                    <Search size={16} color="#94a3b8" />
                    <input
                        style={{ border: 'none', background: 'transparent', outline: 'none', padding: '8px 0', fontSize: '12px', width: '100%', color: '#334155' }}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search candidate, job position or interviewer..."
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}>
                            &times;
                        </button>
                    )}
                </div>

                {/* Type Filter Custom Dropdown */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowTypeFilterDd(!showTypeFilterDd);
                            setShowStatusFilterDd(false);
                            setActiveStatusDdId(null);
                        }}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: showTypeFilterDd ? '1px solid #3b775e' : '1px solid #e2e8f0',
                            background: '#fff',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: typeFilter !== 'All' ? '#0f172a' : '#475569',
                            outline: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <span>{typeFilter === 'All' ? 'All Types' : typeFilter}</span>
                        <ChevronDown size={14} style={{ color: '#94a3b8', transform: showTypeFilterDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                    {showTypeFilterDd && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                left: 0,
                                background: '#ffffff',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                                border: '1px solid #e2e8f0',
                                zIndex: 1000,
                                minWidth: '150px',
                                padding: '6px',
                                animation: 'jobModalIn 0.15s ease'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {['All', 'Video', 'Phone', 'In-Person'].map(tp => {
                                const isSelected = typeFilter === tp;
                                return (
                                    <div
                                        key={tp}
                                        className="rc-dd-option"
                                        onClick={() => { setTypeFilter(tp); setShowTypeFilterDd(false); }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        style={{
                                            padding: '7px 10px',
                                            borderRadius: '7px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                            background: isSelected ? '#f8fafc' : 'transparent',
                                            color: isSelected ? '#0f172a' : '#334155',
                                            fontWeight: isSelected ? 600 : 400,
                                            marginTop: '2px'
                                        }}
                                    >
                                        <span>{tp === 'All' ? 'All Types' : tp}</span>
                                        {isSelected && <Check size={12} color="#3b775e" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Status Filter Custom Dropdown */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowStatusFilterDd(!showStatusFilterDd);
                            setShowTypeFilterDd(false);
                            setActiveStatusDdId(null);
                        }}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: showStatusFilterDd ? '1px solid #3b775e' : '1px solid #e2e8f0',
                            background: '#fff',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: statusFilter !== 'All' ? '#0f172a' : '#475569',
                            outline: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <span>{statusFilter === 'All' ? 'All Status' : statusFilter}</span>
                        <ChevronDown size={14} style={{ color: '#94a3b8', transform: showStatusFilterDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                    {showStatusFilterDd && (
                        <div
                            style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                left: 0,
                                background: '#ffffff',
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                                border: '1px solid #e2e8f0',
                                zIndex: 1000,
                                minWidth: '150px',
                                padding: '6px',
                                animation: 'jobModalIn 0.15s ease'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            {['All', 'Scheduled', 'Completed', 'Cancelled', 'Pending'].map(st => {
                                const isSelected = statusFilter === st;
                                const sc = statusColors[st] || { color: '#64748b', bg: '#f1f5f9' };
                                return (
                                    <div
                                        key={st}
                                        className="rc-dd-option"
                                        onClick={() => { setStatusFilter(st); setShowStatusFilterDd(false); }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        style={{
                                            padding: '7px 10px',
                                            borderRadius: '7px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '8px',
                                            background: isSelected ? '#f8fafc' : 'transparent',
                                            color: isSelected ? '#0f172a' : '#334155',
                                            fontWeight: isSelected ? 600 : 400,
                                            marginTop: '2px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st === 'All' ? '#94a3b8' : sc.color }} />
                                            <span>{st === 'All' ? 'All Status' : st}</span>
                                        </div>
                                        {isSelected && <Check size={12} color="#3b775e" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Reset Filters button */}
                {(searchTerm || statusFilter !== 'All' || typeFilter !== 'All') && (
                    <button
                        type="button"
                        onClick={() => { setSearchTerm(''); setStatusFilter('All'); setTypeFilter('All'); }}
                        style={{
                            padding: '8px 12px',
                            background: '#f1f5f9',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <RefreshCw size={12} /> Reset
                    </button>
                )}
            </div>

            {/* Content Area - Table */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        <table className="ist-tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px', paddingLeft: '16px' }}>#</th>
                                    <th>Candidate</th>
                                    <th>Job Position</th>
                                    <th>Date & Time</th>
                                    <th>Interview Type</th>
                                    <th>Interviewer</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right', paddingRight: '16px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedInterviews.length > 0 ? (
                                    paginatedInterviews.map((item, idx) => {
                                        const sc = statusColors[item.status] || { bg: '#f1f5f9', color: '#475569' };
                                        const tc = typeColors[item.type] || { bg: '#f1f5f9', color: '#475569', icon: Video };
                                        const TypeIconComponent = tc.icon || Video;
                                        const av = getAvatarColor(`${item.candidateId?.firstName} ${item.candidateId?.lastName}`);
                                        const initials = `${(item.candidateId?.firstName || '')[0] || ''}${(item.candidateId?.lastName || '')[0] || ''}`.toUpperCase() || 'C';
                                        const { date, time } = formatDateTime(item.date);
                                        const rowNum = startIndex + idx + 1;

                                        return (
                                            <tr key={item._id}>
                                                <td style={{ paddingLeft: '16px', color: '#94a3b8', fontSize: '12px' }}>{rowNum}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                                                            {initials}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span>{item.candidateId?.firstName} {item.candidateId?.lastName}</span>
                                                                {item.candidateId?.applicationId && (
                                                                    <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', fontWeight: 500 }}>
                                                                        {item.candidateId.applicationId}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                                                {item.candidateId?.email || '—'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ color: '#1e293b', fontWeight: 500, fontSize: '13px' }}>
                                                        {item.jobId?.title || 'General / Open Role'}
                                                    </div>
                                                    {item.jobId?.department && (
                                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                            {item.jobId.department}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Calendar size={12} color="#64748b" /> {date}
                                                        </div>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Clock size={11} color="#94a3b8" /> {time}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span style={{
                                                        background: tc.bg,
                                                        color: tc.color,
                                                        padding: '3px 9px',
                                                        borderRadius: '20px',
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '5px'
                                                    }}>
                                                        <TypeIconComponent size={12} /> {item.type}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500 }}>
                                                        {item.interviewerId?.firstName ? `${item.interviewerId.firstName} ${item.interviewerId.lastName || ''}` : 'Recruiter / HR'}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveStatusDdId(activeStatusDdId === item._id ? null : item._id);
                                                            }}
                                                            style={{
                                                                backgroundColor: '#fff',
                                                                color: sc.color,
                                                                border: `1.5px solid ${sc.color}`,
                                                                padding: '3px 10px',
                                                                borderRadius: '20px',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                cursor: 'pointer',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                fontFamily: 'inherit',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                        >
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sc.color }} />
                                                            <span>{item.status}</span>
                                                            <ChevronDown size={11} style={{ transform: activeStatusDdId === item._id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                                        </button>
                                                        {activeStatusDdId === item._id && (
                                                            <div
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: 'calc(100% + 6px)',
                                                                    left: 0,
                                                                    background: '#ffffff',
                                                                    borderRadius: '12px',
                                                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                                                                    border: '1px solid #e2e8f0',
                                                                    zIndex: 1000,
                                                                    minWidth: '150px',
                                                                    padding: '6px',
                                                                    animation: 'jobModalIn 0.15s ease'
                                                                }}
                                                                onClick={e => e.stopPropagation()}
                                                            >
                                                                {['Scheduled', 'Completed', 'Cancelled', 'Pending'].map(st => {
                                                                    const optSc = statusColors[st] || { bg: '#f1f5f9', color: '#475569' };
                                                                    const isSelected = item.status === st;
                                                                    return (
                                                                        <div
                                                                            key={st}
                                                                            className="rc-dd-option"
                                                                            onClick={() => handleStatusUpdate(item._id, st)}
                                                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = optSc.bg; }}
                                                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                                                            style={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                justifyContent: 'space-between',
                                                                                gap: '8px',
                                                                                padding: '7px 10px',
                                                                                borderRadius: '8px',
                                                                                fontSize: '12px',
                                                                                fontWeight: isSelected ? '600' : '500',
                                                                                color: optSc.color,
                                                                                backgroundColor: isSelected ? optSc.bg : 'transparent',
                                                                                cursor: 'pointer',
                                                                                transition: 'all 0.15s ease',
                                                                                marginTop: '2px'
                                                                            }}
                                                                        >
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: optSc.color }} />
                                                                                <span>{st}</span>
                                                                            </div>
                                                                            {isSelected && <Check size={12} color={optSc.color} />}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                                                    <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                                        <button
                                                            onClick={() => setViewInterview(item)}
                                                            title="View Details"
                                                            className="ist-action-btn"
                                                        >
                                                            <Eye size={15} color="#3b775e" />
                                                        </button>
                                                        <button
                                                            onClick={() => openEditModal(item)}
                                                            title="Reschedule / Edit"
                                                            className="ist-action-btn edit"
                                                        >
                                                            <Edit3 size={15} color="#4338ca" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(item._id)}
                                                            title="Delete Schedule"
                                                            className="ist-action-btn danger"
                                                        >
                                                            <Trash2 size={15} color="#ef4444" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '56px 16px', color: '#94a3b8', fontSize: '13px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Calendar size={22} color="#94a3b8" />
                                                </div>
                                                <div style={{ fontWeight: 600, color: '#334155' }}>No interview appointments found</div>
                                                <div style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '320px', lineHeight: 1.4 }}>
                                                    {searchTerm || statusFilter !== 'All' || typeFilter !== 'All'
                                                        ? 'Try modifying your search keywords or filter criteria.'
                                                        : 'Get started by scheduling an interview for your shortlisted applicants.'}
                                                </div>
                                                {(!searchTerm && statusFilter === 'All' && typeFilter === 'All') && (
                                                    <button
                                                        onClick={() => { setFormData(initialForm); setShowModal(true); }}
                                                        style={{
                                                            marginTop: '6px',
                                                            padding: '8px 16px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            background: '#3b775e',
                                                            color: '#fff',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        + Schedule Interview
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
                        <div>
                            Showing <span style={{ fontWeight: 600, color: '#0f172a' }}>{filtered.length ? startIndex + 1 : 0}</span> to <span style={{ fontWeight: 600, color: '#0f172a' }}>{Math.min(startIndex + INTERVIEWS_PER_PAGE, filtered.length)}</span> of <span style={{ fontWeight: 600, color: '#0f172a' }}>{filtered.length}</span> interviews
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                                disabled={currentPage === 1}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    background: currentPage === 1 ? '#f8fafc' : '#fff',
                                    color: currentPage === 1 ? '#cbd5e1' : '#334155',
                                    fontSize: '12px',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Previous
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setCurrentPage(p)}
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '8px',
                                        border: currentPage === p ? 'none' : '1px solid #e2e8f0',
                                        background: currentPage === p ? '#3b775e' : '#fff',
                                        color: currentPage === p ? '#fff' : '#334155',
                                        fontSize: '12px',
                                        fontWeight: currentPage === p ? 700 : 400,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                style={{
                                    padding: '5px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    background: currentPage === totalPages ? '#f8fafc' : '#fff',
                                    color: currentPage === totalPages ? '#cbd5e1' : '#334155',
                                    fontSize: '12px',
                                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                                }}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Schedule Interview Modal */}
            {showModal && (
                <div className="rc-modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(5px)', padding: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
                    <div className="job-modal" onClick={e => e.stopPropagation()}>
                        <div className="job-modal-sticky-head">
                            <div className="job-modal-hd">
                                <div className="job-modal-hd-icon">
                                    <Plus size={18} color="#3b775e" />
                                </div>
                                <div>
                                    <div className="job-modal-title">Schedule New Interview</div>
                                    <div className="job-modal-sub">Set up date, candidate, interviewer and interview format</div>
                                </div>
                                <button className="job-close-btn" onClick={() => setShowModal(false)}>&times;</button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="job-modal-body">
                            <div className="job-form">
                                <div className="job-section-lbl">Candidate & Position</div>

                                {/* Candidate Selection Custom Dropdown */}
                                <div className="job-field" onClick={e => e.stopPropagation()}>
                                    <label className="job-lbl">Select Candidate<span className="job-req">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            className={`job-dd-btn ${showCandDd ? 'active' : ''}`}
                                            onClick={() => {
                                                setShowCandDd(!showCandDd);
                                                setShowInterviewerDd(false);
                                                setShowTypeDd(false);
                                                setShowRoundDd(false);
                                                setShowStatusDd(false);
                                            }}
                                        >
                                            <span style={{ color: formData.candidateId ? '#1e293b' : '#9ca3af' }}>
                                                {formData.candidateId ? (
                                                    (() => {
                                                        const c = candidates.find(x => x._id === formData.candidateId);
                                                        return c ? `${c.firstName} ${c.lastName} • ${c.jobId?.title || 'Open Position'}` : 'Candidate Selected';
                                                    })()
                                                ) : 'Select candidate for interview...'}
                                            </span>
                                            <ChevronDown size={14} color="#94a3b8" style={{ transform: showCandDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                        </button>
                                        {showCandDd && (
                                            <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                <div style={{ marginBottom: '8px' }}>
                                                    <input
                                                        type="text"
                                                        className="job-dd-search-input"
                                                        placeholder="Search candidate by name or email..."
                                                        value={candSearch}
                                                        onChange={(e) => setCandSearch(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="job-dd-scroll">
                                                    {candidates
                                                        .filter(c => `${c.firstName} ${c.lastName} ${c.email} ${c.applicationId || ''}`.toLowerCase().includes(candSearch.toLowerCase()))
                                                        .map(c => {
                                                            const isSel = formData.candidateId === c._id;
                                                            return (
                                                                <div
                                                                    key={c._id}
                                                                    className={`job-dd-option ${isSel ? 'selected' : ''}`}
                                                                    onClick={() => handleCandidateSelect(c)}
                                                                >
                                                                    <div>
                                                                        <div style={{ fontWeight: isSel ? 600 : 500, color: isSel ? '#15803d' : '#0f172a' }}>
                                                                            {c.firstName} {c.lastName}
                                                                        </div>
                                                                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                                                                            {c.jobId?.title || 'General'} {c.applicationId ? `• ${c.applicationId}` : ''}
                                                                        </div>
                                                                    </div>
                                                                    {isSel && <Check size={14} color="#15803d" />}
                                                                </div>
                                                            );
                                                        })}
                                                    {candidates.filter(c => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(candSearch.toLowerCase())).length === 0 && (
                                                        <div style={{ padding: '12px 10px', fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
                                                            No candidates found.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Assign Interviewer Custom Dropdown */}
                                <div className="job-field" onClick={e => e.stopPropagation()}>
                                    <label className="job-lbl">Assign Interviewer</label>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            className={`job-dd-btn ${showInterviewerDd ? 'active' : ''}`}
                                            onClick={() => {
                                                setShowInterviewerDd(!showInterviewerDd);
                                                setShowCandDd(false);
                                                setShowTypeDd(false);
                                                setShowRoundDd(false);
                                                setShowStatusDd(false);
                                            }}
                                        >
                                            <span style={{ color: '#1e293b' }}>
                                                {(() => {
                                                    if (!formData.interviewerId) return 'Current User / HR Manager (Default)';
                                                    const u = interviewers.find(x => x._id === formData.interviewerId);
                                                    return u ? `${u.firstName} ${u.lastName} ${u.designation ? `(${u.designation})` : ''}` : 'Interviewer Selected';
                                                })()}
                                            </span>
                                            <ChevronDown size={14} color="#94a3b8" style={{ transform: showInterviewerDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                        </button>
                                        {showInterviewerDd && (
                                            <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                <div style={{ marginBottom: '8px' }}>
                                                    <input
                                                        type="text"
                                                        className="job-dd-search-input"
                                                        placeholder="Search interviewer by name or role..."
                                                        value={interviewerSearch}
                                                        onChange={(e) => setInterviewerSearch(e.target.value)}
                                                        autoFocus
                                                    />
                                                </div>
                                                <div className="job-dd-scroll">
                                                    <div
                                                        className={`job-dd-option ${!formData.interviewerId ? 'selected' : ''}`}
                                                        onClick={() => { setFormData({ ...formData, interviewerId: '' }); setShowInterviewerDd(false); }}
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: !formData.interviewerId ? 600 : 500 }}>Current User / HR Manager (Default)</div>
                                                            <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>Assigns to logged-in recruiter</div>
                                                        </div>
                                                        {!formData.interviewerId && <Check size={14} color="#15803d" />}
                                                    </div>
                                                    {interviewers
                                                        .filter(u => `${u.firstName} ${u.lastName} ${u.email || ''} ${u.designation || ''}`.toLowerCase().includes(interviewerSearch.toLowerCase()))
                                                        .map(u => {
                                                            const isSel = formData.interviewerId === u._id;
                                                            return (
                                                                <div
                                                                    key={u._id}
                                                                    className={`job-dd-option ${isSel ? 'selected' : ''}`}
                                                                    onClick={() => { setFormData({ ...formData, interviewerId: u._id }); setShowInterviewerDd(false); }}
                                                                >
                                                                    <div>
                                                                        <div style={{ fontWeight: isSel ? 600 : 500 }}>{u.firstName} {u.lastName}</div>
                                                                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{u.designation || u.department || 'Team Member'}</div>
                                                                    </div>
                                                                    {isSel && <Check size={14} color="#15803d" />}
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="job-section-lbl" style={{ marginTop: '6px' }}>Date & Format</div>

                                <div className="job-field-row">
                                    <div className="job-field">
                                        <label className="job-lbl">Date & Time<span className="job-req">*</span></label>
                                        <input
                                            type="datetime-local"
                                            className="job-input"
                                            value={formData.date}
                                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                                            required
                                        />
                                    </div>

                                    {/* Interview Type Custom Dropdown */}
                                    <div className="job-field" onClick={e => e.stopPropagation()}>
                                        <label className="job-lbl">Interview Type</label>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                type="button"
                                                className={`job-dd-btn ${showTypeDd ? 'active' : ''}`}
                                                onClick={() => {
                                                    setShowTypeDd(!showTypeDd);
                                                    setShowCandDd(false);
                                                    setShowInterviewerDd(false);
                                                    setShowRoundDd(false);
                                                    setShowStatusDd(false);
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {(() => {
                                                        const tc = typeColors[formData.type] || typeColors.Video;
                                                        const IconComp = tc.icon;
                                                        return (
                                                            <>
                                                                <IconComp size={14} color={tc.color} />
                                                                <span>{tc.label}</span>
                                                            </>
                                                        );
                                                    })()}
                                                </span>
                                                <ChevronDown size={14} color="#94a3b8" style={{ transform: showTypeDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                            </button>
                                            {showTypeDd && (
                                                <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                    {['Video', 'Phone', 'In-Person'].map(tp => {
                                                        const tc = typeColors[tp];
                                                        const IconComp = tc.icon;
                                                        const isSel = formData.type === tp;
                                                        return (
                                                            <div
                                                                key={tp}
                                                                className={`job-dd-option ${isSel ? 'selected' : ''}`}
                                                                onClick={() => { setFormData({ ...formData, type: tp }); setShowTypeDd(false); }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <IconComp size={13} color={tc.color} />
                                                                    </div>
                                                                    <span>{tc.label}</span>
                                                                </div>
                                                                {isSel && <Check size={14} color="#15803d" />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Interview Round / Stage Custom Dropdown with Dynamic Add & Delete */}
                                <div className="job-field" onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label className="job-lbl">Interview Round / Stage</label>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            className={`job-dd-btn ${showRoundDd ? 'active' : ''}`}
                                            onClick={() => {
                                                setShowRoundDd(!showRoundDd);
                                                setShowCandDd(false);
                                                setShowInterviewerDd(false);
                                                setShowTypeDd(false);
                                                setShowStatusDd(false);
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                                                <Award size={15} color="#3b775e" />
                                                <span style={{ fontWeight: 600 }}>{cleanRoundTitle(formData.round) || 'Select Round'}</span>
                                            </span>
                                            <ChevronDown size={14} color="#94a3b8" style={{ transform: showRoundDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                        </button>
                                        {showRoundDd && (
                                            <div className="job-dd-menu" style={{ width: '100%' }} onClick={e => e.stopPropagation()}>
                                                {/* Add New Round Input Header */}
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <input
                                                        type="text"
                                                        className="job-dd-search-input"
                                                        placeholder="+ Add round name (e.g. HR Round)..."
                                                        value={newRoundInput}
                                                        onChange={e => setNewRoundInput(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRound(false); } }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddRound(false)}
                                                        style={{
                                                            padding: '7px 14px',
                                                            background: '#3b775e',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        Add
                                                    </button>
                                                </div>

                                                {/* Round Options List */}
                                                <div className="job-dd-scroll">
                                                    {rounds.map((r, idx) => {
                                                        const cleanR = cleanRoundTitle(r);
                                                        const isSel = cleanRoundTitle(formData.round) === cleanR;

                                                        return (
                                                            <div
                                                                key={`${r}-${idx}`}
                                                                className={`job-dd-option ${isSel ? 'selected' : ''}`}
                                                                onClick={() => { setFormData({ ...formData, round: cleanR }); setShowRoundDd(false); }}
                                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px' }}
                                                            >
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSel ? 600 : 500, color: isSel ? '#15803d' : '#1e293b', fontSize: '13px' }}>
                                                                    {cleanR}
                                                                </span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                                    {isSel && <Check size={14} color="#15803d" />}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleRemoveRound(r, e)}
                                                                        title={`Remove ${cleanR}`}
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            cursor: 'pointer',
                                                                            padding: '3px',
                                                                            color: '#94a3b8',
                                                                            borderRadius: '4px',
                                                                            display: 'flex',
                                                                            alignItems: 'center'
                                                                        }}
                                                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="job-field">
                                    <label className="job-lbl">Meeting Link / Room Location</label>
                                    <input
                                        type="text"
                                        className="job-input"
                                        placeholder="e.g. meet.google.com/... or Room 402"
                                        value={formData.location}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>

                                <div className="job-field" style={{ gridColumn: '1 / -1' }}>
                                    <label className="job-lbl">Notes & Instructions</label>
                                    <textarea
                                        rows={3}
                                        className="job-input"
                                        placeholder="Add discussion topics, candidate checklist or instructions..."
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                            </div>

                            <div className="job-footer">
                                <button type="button" className="job-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" disabled={submitting} className="job-btn-primary">
                                    {submitting ? 'Scheduling...' : 'Schedule Interview'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit / Reschedule Modal */}
            {showEditModal && (
                <div className="rc-modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(5px)', padding: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowEditModal(false)}>
                    <div className="job-modal" onClick={e => e.stopPropagation()}>
                        <div className="job-modal-sticky-head">
                            <div className="job-modal-hd">
                                <div className="job-modal-hd-icon" style={{ background: 'rgba(67, 56, 202, 0.1)' }}>
                                    <Edit3 size={18} color="#4338ca" />
                                </div>
                                <div>
                                    <div className="job-modal-title">Reschedule / Edit Interview</div>
                                    <div className="job-modal-sub">{editFormData.candidateName} • {editFormData.jobTitle || 'General Position'}</div>
                                </div>
                                <button className="job-close-btn" onClick={() => setShowEditModal(false)}>&times;</button>
                            </div>
                        </div>

                        <form onSubmit={handleEditSubmit} className="job-modal-body">
                            <div className="job-form">
                                <div className="job-section-lbl">Schedule & Format</div>

                                <div className="job-field-row">
                                    <div className="job-field">
                                        <label className="job-lbl">Date & Time<span className="job-req">*</span></label>
                                        <input
                                            type="datetime-local"
                                            className="job-input"
                                            value={editFormData.date}
                                            onChange={e => setEditFormData({ ...editFormData, date: e.target.value })}
                                            required
                                        />
                                    </div>

                                    {/* Edit Interview Type Custom Dropdown */}
                                    <div className="job-field" onClick={e => e.stopPropagation()}>
                                        <label className="job-lbl">Interview Type</label>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                type="button"
                                                className={`job-dd-btn ${showEditTypeDd ? 'active' : ''}`}
                                                onClick={() => {
                                                    setShowEditTypeDd(!showEditTypeDd);
                                                    setShowEditInterviewerDd(false);
                                                    setShowEditRoundDd(false);
                                                    setShowEditStatusDd(false);
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {(() => {
                                                        const tc = typeColors[editFormData.type] || typeColors.Video;
                                                        const IconComp = tc.icon;
                                                        return (
                                                            <>
                                                                <IconComp size={14} color={tc.color} />
                                                                <span>{tc.label}</span>
                                                            </>
                                                        );
                                                    })()}
                                                </span>
                                                <ChevronDown size={14} color="#94a3b8" style={{ transform: showEditTypeDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                            </button>
                                            {showEditTypeDd && (
                                                <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                    {['Video', 'Phone', 'In-Person'].map(tp => {
                                                        const tc = typeColors[tp];
                                                        const IconComp = tc.icon;
                                                        const isSel = editFormData.type === tp;
                                                        return (
                                                            <div
                                                                key={tp}
                                                                className={`job-dd-option ${isSel ? 'selected' : ''}`}
                                                                onClick={() => { setEditFormData({ ...editFormData, type: tp }); setShowEditTypeDd(false); }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: tc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <IconComp size={13} color={tc.color} />
                                                                    </div>
                                                                    <span>{tc.label}</span>
                                                                </div>
                                                                {isSel && <Check size={14} color="#15803d" />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="job-field-row">
                                    {/* Edit Interviewer Custom Dropdown */}
                                    <div className="job-field" onClick={e => e.stopPropagation()}>
                                        <label className="job-lbl">Interviewer</label>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                type="button"
                                                className={`job-dd-btn ${showEditInterviewerDd ? 'active' : ''}`}
                                                onClick={() => {
                                                    setShowEditInterviewerDd(!showEditInterviewerDd);
                                                    setShowEditTypeDd(false);
                                                    setShowEditRoundDd(false);
                                                    setShowEditStatusDd(false);
                                                }}
                                            >
                                                <span style={{ color: '#1e293b' }}>
                                                    {(() => {
                                                        if (!editFormData.interviewerId) return 'Current Recruiter / Default';
                                                        const u = interviewers.find(x => x._id === editFormData.interviewerId);
                                                        return u ? `${u.firstName} ${u.lastName} ${u.designation ? `(${u.designation})` : ''}` : 'Interviewer Selected';
                                                    })()}
                                                </span>
                                                <ChevronDown size={14} color="#94a3b8" style={{ transform: showEditInterviewerDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                            </button>
                                            {showEditInterviewerDd && (
                                                <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <input
                                                            type="text"
                                                            className="job-dd-search-input"
                                                            placeholder="Search interviewer..."
                                                            value={editInterviewerSearch}
                                                            onChange={(e) => setEditInterviewerSearch(e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="job-dd-scroll">
                                                        <div
                                                            className={`job-dd-option ${!editFormData.interviewerId ? 'selected' : ''}`}
                                                            onClick={() => { setEditFormData({ ...editFormData, interviewerId: '' }); setShowEditInterviewerDd(false); }}
                                                        >
                                                            <div>
                                                                <div style={{ fontWeight: !editFormData.interviewerId ? 600 : 500 }}>Current Recruiter / Default</div>
                                                            </div>
                                                            {!editFormData.interviewerId && <Check size={14} color="#15803d" />}
                                                        </div>
                                                        {interviewers
                                                            .filter(u => `${u.firstName} ${u.lastName} ${u.email || ''} ${u.designation || ''}`.toLowerCase().includes(editInterviewerSearch.toLowerCase()))
                                                            .map(u => {
                                                                const isSel = editFormData.interviewerId === u._id;
                                                                return (
                                                                    <div
                                                                        key={u._id}
                                                                        className={`job-dd-option ${isSel ? 'selected' : ''}`}
                                                                        onClick={() => { setEditFormData({ ...editFormData, interviewerId: u._id }); setShowEditInterviewerDd(false); }}
                                                                    >
                                                                        <div>
                                                                            <div style={{ fontWeight: isSel ? 600 : 500 }}>{u.firstName} {u.lastName}</div>
                                                                            <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{u.designation || u.department || 'Team Member'}</div>
                                                                        </div>
                                                                        {isSel && <Check size={14} color="#15803d" />}
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Edit Status Custom Dropdown */}
                                    <div className="job-field" onClick={e => e.stopPropagation()}>
                                        <label className="job-lbl">Status</label>
                                        <div style={{ position: 'relative' }}>
                                            <button
                                                type="button"
                                                className={`job-dd-btn ${showEditStatusDd ? 'active' : ''}`}
                                                onClick={() => {
                                                    setShowEditStatusDd(!showEditStatusDd);
                                                    setShowEditInterviewerDd(false);
                                                    setShowEditTypeDd(false);
                                                    setShowEditRoundDd(false);
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: (statusColors[editFormData.status] || {}).color || '#64748b' }} />
                                                    <span style={{ fontWeight: 600, color: (statusColors[editFormData.status] || {}).color || '#1e293b' }}>{editFormData.status}</span>
                                                </span>
                                                <ChevronDown size={14} color="#94a3b8" style={{ transform: showEditStatusDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                            </button>
                                            {showEditStatusDd && (
                                                <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                    {['Scheduled', 'Completed', 'Cancelled', 'Pending'].map(st => {
                                                        const sc = statusColors[st] || { color: '#64748b', bg: '#f1f5f9' };
                                                        const isSel = editFormData.status === st;
                                                        return (
                                                            <div
                                                                key={st}
                                                                className={`job-dd-option ${isSel ? 'selected' : ''}`}
                                                                onClick={() => { setEditFormData({ ...editFormData, status: st }); setShowEditStatusDd(false); }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sc.color }} />
                                                                    <span>{st}</span>
                                                                </div>
                                                                {isSel && <Check size={14} color="#15803d" />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Edit Round / Stage Custom Dropdown with Dynamic Add & Delete */}
                                <div className="job-field" onClick={e => e.stopPropagation()}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <label className="job-lbl">Round / Stage</label>
                                    </div>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            type="button"
                                            className={`job-dd-btn ${showEditRoundDd ? 'active' : ''}`}
                                            onClick={() => {
                                                setShowEditRoundDd(!showEditRoundDd);
                                                setShowEditInterviewerDd(false);
                                                setShowEditTypeDd(false);
                                                setShowEditStatusDd(false);
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                                                <Award size={15} color="#3b775e" />
                                                <span style={{ fontWeight: 600 }}>{cleanRoundTitle(editFormData.round) || 'Select Round'}</span>
                                            </span>
                                            <ChevronDown size={14} color="#94a3b8" style={{ transform: showEditRoundDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                        </button>
                                        {showEditRoundDd && (
                                            <div className="job-dd-menu" style={{ width: '100%' }} onClick={e => e.stopPropagation()}>
                                                {/* Add New Round Input Header */}
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                                                    <input
                                                        type="text"
                                                        className="job-dd-search-input"
                                                        placeholder="+ Add round name (e.g. HR Round)..."
                                                        value={newEditRoundInput}
                                                        onChange={e => setNewEditRoundInput(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRound(true); } }}
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddRound(true)}
                                                        style={{
                                                            padding: '7px 14px',
                                                            background: '#3b775e',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            whiteSpace: 'nowrap',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        Add
                                                    </button>
                                                </div>

                                                {/* Round Options List */}
                                                <div className="job-dd-scroll">
                                                    {rounds.map((r, idx) => {
                                                        const cleanR = cleanRoundTitle(r);
                                                        const isSel = cleanRoundTitle(editFormData.round) === cleanR;

                                                        return (
                                                            <div
                                                                key={`${r}-${idx}`}
                                                                className={`job-dd-option ${isSel ? 'selected' : ''}`}
                                                                onClick={() => { setEditFormData({ ...editFormData, round: cleanR }); setShowEditRoundDd(false); }}
                                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px' }}
                                                            >
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: isSel ? 600 : 500, color: isSel ? '#15803d' : '#1e293b', fontSize: '13px' }}>
                                                                    {cleanR}
                                                                </span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                                    {isSel && <Check size={14} color="#15803d" />}
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => handleRemoveRound(r, e)}
                                                                        title={`Remove ${cleanR}`}
                                                                        style={{
                                                                            background: 'transparent',
                                                                            border: 'none',
                                                                            cursor: 'pointer',
                                                                            padding: '3px',
                                                                            color: '#94a3b8',
                                                                            borderRadius: '4px',
                                                                            display: 'flex',
                                                                            alignItems: 'center'
                                                                        }}
                                                                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                                        onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="job-field">
                                    <label className="job-lbl">Meeting Link / Location</label>
                                    <input
                                        type="text"
                                        className="job-input"
                                        placeholder="e.g. meet.google.com/... or Office Room"
                                        value={editFormData.location}
                                        onChange={e => setEditFormData({ ...editFormData, location: e.target.value })}
                                    />
                                </div>

                                <div className="job-field" style={{ gridColumn: '1 / -1' }}>
                                    <label className="job-lbl">Notes & Discussion Points</label>
                                    <textarea
                                        rows={2}
                                        className="job-input"
                                        value={editFormData.notes}
                                        onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>

                                <div className="job-field" style={{ gridColumn: '1 / -1' }}>
                                    <label className="job-lbl">Candidate Evaluation & Feedback</label>
                                    <textarea
                                        rows={2}
                                        className="job-input"
                                        placeholder="Add post-interview remarks, rating summary or evaluation..."
                                        value={editFormData.feedback}
                                        onChange={e => setEditFormData({ ...editFormData, feedback: e.target.value })}
                                        style={{ resize: 'vertical' }}
                                    />
                                </div>
                            </div>

                            <div className="job-footer">
                                <button type="button" className="job-btn-ghost" onClick={() => setShowEditModal(false)}>Cancel</button>
                                <button type="submit" disabled={submitting} className="job-btn-primary">
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Interview Modal */}
            {viewInterview && (
                <div className="rc-modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(5px)', padding: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewInterview(null)}>
                    <div className="job-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                        <div className="job-modal-sticky-head">
                            <div className="job-modal-hd">
                                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px' }}>
                                    {viewInterview.candidateId?.firstName?.[0]}{viewInterview.candidateId?.lastName?.[0]}
                                </div>
                                <div>
                                    <div className="job-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span>{viewInterview.candidateId?.firstName} {viewInterview.candidateId?.lastName}</span>
                                        {viewInterview.candidateId?.applicationId && (
                                            <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontWeight: 500 }}>
                                                {viewInterview.candidateId.applicationId}
                                            </span>
                                        )}
                                    </div>
                                    <div className="job-modal-sub">{viewInterview.jobId?.title || 'General Position'} • {cleanRoundTitle(viewInterview.round) || `${viewInterview.type} Interview`}</div>
                                </div>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ ...(statusColors[viewInterview.status] || {}), padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                                        {viewInterview.status}
                                    </span>
                                    <button className="job-close-btn" onClick={() => setViewInterview(null)}>&times;</button>
                                </div>
                            </div>
                        </div>

                        <div className="job-modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                                {[
                                    { l: 'Candidate Email', v: viewInterview.candidateId?.email || '—' },
                                    { l: 'Candidate Phone', v: viewInterview.candidateId?.phone || '—' },
                                    { l: 'Job Position', v: viewInterview.jobId?.title || '—' },
                                    { l: 'Department', v: viewInterview.jobId?.department || 'General' },
                                    { l: 'Date & Time', v: viewInterview.date ? new Date(viewInterview.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—' },
                                    { l: 'Interview Type', v: viewInterview.type },
                                    { l: 'Interviewer', v: viewInterview.interviewerId?.firstName ? `${viewInterview.interviewerId.firstName} ${viewInterview.interviewerId.lastName || ''}` : 'Recruiter / HR' },
                                    {
                                        l: 'Meeting Link / Room',
                                        v: viewInterview.location || viewInterview.meetingLink || 'Online Call',
                                        isLink: (viewInterview.location || viewInterview.meetingLink || '').startsWith('http') || (viewInterview.location || '').startsWith('meet.') || (viewInterview.location || '').startsWith('zoom.')
                                    }
                                ].map((f, i) => (
                                    <div key={i} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>{f.l}</div>
                                        {f.isLink ? (
                                            <a
                                                href={f.v.startsWith('http') ? f.v : `https://${f.v}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ fontSize: '13px', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none', wordBreak: 'break-all' }}
                                            >
                                                <span>{f.v}</span>
                                                <ExternalLink size={12} />
                                            </a>
                                        ) : (
                                            <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: 600 }}>{f.v}</div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {viewInterview.notes && (
                                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px', border: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Notes & Instructions</div>
                                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{viewInterview.notes}</div>
                                </div>
                            )}

                            {viewInterview.feedback && (
                                <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', border: '1px solid #dcfce7' }}>
                                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Interviewer Feedback & Evaluation</div>
                                    <div style={{ fontSize: '13px', color: '#14532d', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{viewInterview.feedback}</div>
                                </div>
                            )}

                            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>UPDATE STATUS</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {['Scheduled', 'Completed', 'Cancelled', 'Pending'].map(s => {
                                        const sc = statusColors[s] || {};
                                        const isActive = viewInterview.status === s;
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => handleStatusUpdate(viewInterview._id, s)}
                                                style={{
                                                    padding: '6px 14px',
                                                    borderRadius: '20px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    border: isActive ? `1.5px solid ${sc.color}` : '1px solid #e2e8f0',
                                                    background: isActive ? sc.bg : '#fff',
                                                    color: isActive ? sc.color : '#64748b',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                {s}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="job-footer" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                                type="button"
                                className="job-btn-ghost"
                                onClick={() => {
                                    const id = viewInterview._id;
                                    handleDelete(id);
                                }}
                                style={{ color: '#ef4444', borderColor: '#fee2e2' }}
                            >
                                <Trash2 size={13} /> Delete Schedule
                            </button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="job-btn-ghost"
                                    onClick={() => {
                                        const item = viewInterview;
                                        setViewInterview(null);
                                        openEditModal(item);
                                    }}
                                    style={{ color: '#4338ca', borderColor: '#e0e7ff', background: '#f5f3ff' }}
                                >
                                    <Edit3 size={13} /> Reschedule / Edit
                                </button>
                                <button type="button" className="job-btn-primary" onClick={() => setViewInterview(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleInterview;
