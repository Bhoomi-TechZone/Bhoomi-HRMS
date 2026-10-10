import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { 
    Search, LayoutGrid, List, Eye, Trash2, Star, Phone, Mail, 
    ChevronDown, Users, UserCheck, UserX, Clock, Plus, ExternalLink, 
    Calendar, Briefcase, FileText, Check, AlertCircle, RefreshCw, Archive,
    GraduationCap, MapPin, User, ShieldCheck, Award
} from 'lucide-react';
import './RecruitmentDashboard.css';

const DEFAULT_STATUS_COLORS = {
    Applied: { bg: '#e0f2fe', color: '#0369a1' },
    Shortlisted: { bg: '#fef9c3', color: '#854d0e' },
    'Phone Screen': { bg: '#ede9fe', color: '#6d28d9' },
    Interview: { bg: '#dbeafe', color: '#1d4ed8' },
    Hired: { bg: '#dcfce7', color: '#166534' },
    Rejected: { bg: '#fee2e2', color: '#991b1b' },
};

const STAGE_COLOR_PRESETS = [
    { label: 'Teal', bg: '#ccfbf1', color: '#0f766e' },
    { label: 'Indigo', bg: '#e0e7ff', color: '#4338ca' },
    { label: 'Rose', bg: '#ffe4e6', color: '#be123c' },
    { label: 'Amber', bg: '#fef3c7', color: '#b45309' },
    { label: 'Sky', bg: '#e0f2fe', color: '#0369a1' },
    { label: 'Purple', bg: '#ede9fe', color: '#6d28d9' },
    { label: 'Emerald', bg: '#dcfce7', color: '#166534' },
    { label: 'Orange', bg: '#ffedd5', color: '#c2410c' },
];

const avatarColors = [
    { bg: '#e0e7ff', color: '#4338ca' },
    { bg: '#fce7f3', color: '#be185d' },
    { bg: '#e0f2fe', color: '#0369a1' },
    { bg: '#dcfce7', color: '#15803d' },
    { bg: '#fef3c7', color: '#b45309' },
    { bg: '#ede9fe', color: '#6d28d9' }
];

const RecruitmentPipeline = () => {
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

    const [candidates, setCandidates] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [jobFilter, setJobFilter] = useState('All');
    const [viewMode, setViewMode] = useState('table');
    const [viewCandidate, setViewCandidate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Dynamic Stages & Custom Stage State
    const [stages, setStages] = useState(() => {
        try {
            const saved = localStorage.getItem('recruitment_pipeline_stages');
            if (saved) {
                const parsed = JSON.parse(saved);
                const cleaned = parsed.filter(s => s !== 'Phone Screen');
                return cleaned.length > 0 ? cleaned : ['Applied', 'Shortlisted', 'Interview', 'Hired', 'Rejected'];
            }
            return ['Applied', 'Shortlisted', 'Interview', 'Hired', 'Rejected'];
        } catch {
            return ['Applied', 'Shortlisted', 'Interview', 'Hired', 'Rejected'];
        }
    });

    // Selectable options for dropdown card & status selection: only Applied, Shortlisted, Hired, Rejected (+ custom stages, excludes Interview)
    const selectableStatuses = useMemo(() => {
        return stages.filter(st => st !== 'Interview' && st !== 'Phone Screen');
    }, [stages]);

    const [customStatusColors, setCustomStatusColors] = useState(() => {
        try {
            const saved = localStorage.getItem('recruitment_status_colors');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const statusColors = useMemo(() => ({
        ...DEFAULT_STATUS_COLORS,
        ...customStatusColors
    }), [customStatusColors]);

    const [showAddStageModal, setShowAddStageModal] = useState(false);
    const [newStageName, setNewStageName] = useState('');
    const [selectedPresetColor, setSelectedPresetColor] = useState(STAGE_COLOR_PRESETS[0]);

    // Drag & Drop Highlighting State
    const [dragOverStage, setDragOverStage] = useState(null);
    const [draggingCandidateId, setDraggingCandidateId] = useState(null);

    // Dropdown visibility states
    const [showJobFilterDd, setShowJobFilterDd] = useState(false);
    const [jobSearch, setJobSearch] = useState('');
    const [showStatusFilterDd, setShowStatusFilterDd] = useState(false);
    const [showAddJobDd, setShowAddJobDd] = useState(false);
    const [addJobSearch, setAddJobSearch] = useState('');
    const [activeStatusDdId, setActiveStatusDdId] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const CANDIDATES_PER_PAGE = 10;

    const initialForm = { firstName: '', lastName: '', email: '', phone: '', jobId: '', status: 'Applied', rating: 0, notes: '', resumeUrl: '' };
    const [formData, setFormData] = useState(initialForm);

    useEffect(() => {
        fetchCandidates();
        fetchJobs();
    }, []);

    useEffect(() => {
        const close = () => {
            setShowJobFilterDd(false);
            setShowStatusFilterDd(false);
            setShowAddJobDd(false);
            setActiveStatusDdId(null);
        };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, jobFilter]);

    const fetchCandidates = async () => {
        try {
            const res = await api.get('/recruitment/candidates');
            setCandidates(res.data || []);
        } catch (err) { 
            console.error("Failed to load candidates", err); 
        } finally { 
            setLoading(false); 
        }
    };

    const fetchJobs = async () => {
        try { 
            const res = await api.get('/recruitment/jobs'); 
            setJobs(res.data || []); 
        } catch (err) { 
            console.error("Failed to load jobs", err); 
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    };

    const openCandidateModal = async (candidate) => {
        setViewCandidate(candidate);
        try {
            const res = await api.get(`/recruitment/candidates/${candidate._id}`);
            if (res.data) setViewCandidate(res.data);
        } catch (_) {}
    };

    const handleStatusChange = async (candidateId, newStatus) => {
        setCandidates(prev => prev.map(c => c._id === candidateId ? { ...c, status: newStatus } : c));
        setActiveStatusDdId(null);
        try { 
            await api.patch(`/recruitment/candidates/${candidateId}/status`, { status: newStatus }); 
        } catch (error) { 
            console.error("Failed to update status", error); 
            fetchCandidates(); 
        }
    };

    const handleRatingChange = async (candidateId, newRating) => {
        setCandidates(prev => prev.map(c => c._id === candidateId ? { ...c, rating: newRating } : c));
        if (viewCandidate && viewCandidate._id === candidateId) {
            setViewCandidate(prev => ({ ...prev, rating: newRating }));
        }
        try { 
            await api.patch(`/recruitment/candidates/${candidateId}/rating`, { rating: newRating }); 
        } catch (error) { 
            console.error("Failed to update rating", error); 
            fetchCandidates(); 
        }
    };

    const handleNotesChange = async (candidateId, notes) => {
        setCandidates(prev => prev.map(c => c._id === candidateId ? { ...c, notes } : c));
        if (viewCandidate && viewCandidate._id === candidateId) {
            setViewCandidate(prev => ({ ...prev, notes }));
        }
        try { 
            await api.patch(`/recruitment/candidates/${candidateId}/notes`, { notes }); 
        } catch (error) { 
            console.error("Failed to update notes", error); 
        }
    };

    const handleAddStage = (e) => {
        e.preventDefault();
        const trimmed = newStageName.trim();
        if (!trimmed) return;
        if (stages.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
            alert('A stage with this name already exists.');
            return;
        }
        let updated;
        const hiredIdx = stages.indexOf('Hired');
        if (hiredIdx !== -1) {
            updated = [...stages.slice(0, hiredIdx), trimmed, ...stages.slice(hiredIdx)];
        } else {
            updated = [...stages, trimmed];
        }
        const updatedColors = {
            ...customStatusColors,
            [trimmed]: { bg: selectedPresetColor.bg, color: selectedPresetColor.color }
        };
        setStages(updated);
        setCustomStatusColors(updatedColors);
        localStorage.setItem('recruitment_pipeline_stages', JSON.stringify(updated));
        localStorage.setItem('recruitment_status_colors', JSON.stringify(updatedColors));
        setShowAddStageModal(false);
        setNewStageName('');
    };

    const handleDeleteStage = (stageToDelete) => {
        const defaultStages = ['Applied', 'Shortlisted', 'Interview', 'Hired', 'Rejected'];
        if (defaultStages.includes(stageToDelete)) {
            alert('Default system stages cannot be deleted.');
            return;
        }
        const countInStage = candidates.filter(c => c.status === stageToDelete).length;
        if (countInStage > 0) {
            if (!window.confirm(`There are ${countInStage} candidate(s) in "${stageToDelete}". Deleting this stage will move them to "Applied". Continue?`)) {
                return;
            }
            candidates.filter(c => c.status === stageToDelete).forEach(c => {
                handleStatusChange(c._id, 'Applied');
            });
        } else {
            if (!window.confirm(`Delete stage "${stageToDelete}"?`)) return;
        }
        const updated = stages.filter(s => s !== stageToDelete);
        const updatedColors = { ...customStatusColors };
        delete updatedColors[stageToDelete];
        setStages(updated);
        setCustomStatusColors(updatedColors);
        localStorage.setItem('recruitment_pipeline_stages', JSON.stringify(updated));
        localStorage.setItem('recruitment_status_colors', JSON.stringify(updatedColors));
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this candidate application?')) return;
        try { 
            await api.delete(`/recruitment/candidates/${id}`); 
            fetchCandidates(); 
        } catch (err) { 
            alert('Failed to delete candidate'); 
        }
    };

    const handleArchive = async (id) => {
        if (!window.confirm('Archive this candidate application? They will be moved to the Candidate Database.')) return;
        try {
            await api.patch(`/recruitment/candidates/${id}/archive`, { isArchived: true });
            fetchCandidates();
        } catch (err) {
            console.error('Failed to archive candidate', err);
            alert('Failed to archive candidate');
        }
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        if (!formData.jobId) { alert('Please select a job position.'); return; }
        setSubmitting(true);
        try {
            await api.post('/recruitment/candidates', formData);
            setShowAddModal(false);
            setFormData(initialForm);
            fetchCandidates();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add application');
        } finally { 
            setSubmitting(false); 
        }
    };

    const handleDragStart = (e, candidateId) => {
        e.dataTransfer.setData('candidateId', candidateId);
        setDraggingCandidateId(candidateId);
    };
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = async (e, newStatus) => {
        const candidateId = e.dataTransfer.getData('candidateId');
        if (candidateId) {
            handleStatusChange(candidateId, newStatus);
        }
    };

    const activeCandidates = useMemo(() => candidates.filter(c => !c.isArchived), [candidates]);

    const filtered = activeCandidates.filter(c => {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        const matchSearch = name.includes(searchTerm.toLowerCase()) || 
            (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.phone || '').includes(searchTerm);
        const matchStatus = statusFilter === 'All' || c.status === statusFilter;
        const matchJob = jobFilter === 'All' || (c.jobId?._id === jobFilter || c.jobId === jobFilter);
        return matchSearch && matchStatus && matchJob;
    });

    const totalPages = Math.ceil(filtered.length / CANDIDATES_PER_PAGE) || 1;
    const startIndex = (currentPage - 1) * CANDIDATES_PER_PAGE;
    const paginatedCandidates = filtered.slice(startIndex, startIndex + CANDIDATES_PER_PAGE);

    const sparklineData = useMemo(() => {
        const now = new Date();
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });
        const countFor = (filterFn) =>
            months.map(({ year, month }) =>
                activeCandidates.filter(c => {
                    const d = new Date(c.createdAt || c.appliedDate || Date.now());
                    return d.getFullYear() === year && d.getMonth() === month && filterFn(c);
                }).length
            );
        return {
            total: countFor(() => true),
            inProgress: countFor(c => !['Hired', 'Rejected'].includes(c.status)),
            hired: countFor(c => c.status === 'Hired'),
            rejected: countFor(c => c.status === 'Rejected')
        };
    }, [activeCandidates]);

    const stats = {
        total: activeCandidates.length,
        inProgress: activeCandidates.filter(c => !['Hired', 'Rejected'].includes(c.status)).length,
        hired: activeCandidates.filter(c => c.status === 'Hired').length,
        rejected: activeCandidates.filter(c => c.status === 'Rejected').length,
    };

    const renderStars = (rating, candidateId = null, interactive = false) => Array.from({ length: 5 }, (_, i) => {
        const starNum = i + 1;
        const isFilled = i < rating;
        return (
            <Star
                key={i}
                size={interactive ? 13 : 12}
                fill={isFilled ? '#f59e0b' : 'none'}
                color={isFilled ? '#f59e0b' : '#d1d5db'}
                style={{
                    cursor: interactive && candidateId ? 'pointer' : 'default',
                    transition: 'transform 0.1s'
                }}
                onClick={(e) => {
                    if (interactive && candidateId) {
                        e.stopPropagation();
                        handleRatingChange(candidateId, starNum === rating ? 0 : starNum);
                    }
                }}
            />
        );
    });

    const getAvatarColor = (name = '') => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return avatarColors[Math.abs(hash) % avatarColors.length];
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
                <div>
                    <div className="skel" style={{ width: '180px', height: '24px', marginBottom: '6px' }} />
                    <div className="skel" style={{ width: '310px', height: '13px' }} />
                </div>
                <div className="skel" style={{ width: '145px', height: '38px', borderRadius: '10px' }} />
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
                <div className="skel" style={{ width: '105px', height: '36px', borderRadius: '10px' }} />
                <div className="skel" style={{ width: '72px', height: '36px', borderRadius: '10px' }} />
            </div>

            {/* Table Skeleton */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '40px 2.2fr 1.6fr 1.6fr 1.1fr 1.1fr 1.1fr 70px', gap: '12px', padding: '11px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    {['#', 'CANDIDATE', 'APPLIED FOR', 'CONTACT', 'RATING', 'APPLIED DATE', 'STATUS', 'ACTIONS'].map((col, i) => (
                        <div key={i} className="skel" style={{ width: i === 0 ? '16px' : i === 7 ? '44px' : '70px', height: '10px' }} />
                    ))}
                </div>

                {/* Table Rows */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 2.2fr 1.6fr 1.6fr 1.1fr 1.1fr 1.1fr 70px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                            <div className="skel" style={{ width: '16px', height: '12px' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="skel" style={{ width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0 }} />
                                <div>
                                    <div className="skel" style={{ width: `${100 + (i % 3) * 20}px`, height: '13px', marginBottom: '5px' }} />
                                    <div className="skel" style={{ width: '130px', height: '10px' }} />
                                </div>
                            </div>
                            <div>
                                <div className="skel" style={{ width: `${90 + (i % 2) * 25}px`, height: '12px', marginBottom: '4px' }} />
                                <div className="skel" style={{ width: '60px', height: '9px' }} />
                            </div>
                            <div>
                                <div className="skel" style={{ width: '100px', height: '11px', marginBottom: '4px' }} />
                                <div className="skel" style={{ width: '80px', height: '9px' }} />
                            </div>
                            <div className="skel" style={{ width: '68px', height: '12px' }} />
                            <div className="skel" style={{ width: '74px', height: '12px' }} />
                            <div className="skel" style={{ width: '72px', height: '22px', borderRadius: '999px' }} />
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <div className="skel" style={{ width: '26px', height: '26px', borderRadius: '6px' }} />
                                <div className="skel" style={{ width: '26px', height: '26px', borderRadius: '6px' }} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Table Footer / Pagination Skeleton */}
                <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
                    <div className="skel" style={{ width: '140px', height: '12px' }} />
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <div className="skel" style={{ width: '64px', height: '28px', borderRadius: '8px' }} />
                        <div className="skel" style={{ width: '64px', height: '28px', borderRadius: '8px' }} />
                    </div>
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

                .job-modal { background: #fff; border-radius: 18px; width: 100%; max-width: 680px; max-height: 88vh; overflow-y: auto; border: 1px solid #e8edf0; box-shadow: 0 8px 40px rgba(0,0,0,0.13); font-family: 'Inter', 'Segoe UI', sans-serif; animation: jobModalIn 0.22s cubic-bezier(0.16,1,0.3,1); -ms-overflow-style: none; scrollbar-width: none; }
                .job-modal::-webkit-scrollbar { display: none; }
                .job-modal-sticky-head { position: sticky; top: 0; background: #fff; z-index: 100; border-bottom: 1px solid #f1f3f5; }
                .job-modal-hd { display: flex; align-items: center; gap: 12px; padding: 18px 20px 14px; background: #fafafa; border-radius: 18px 18px 0 0; }
                .job-modal-hd-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(59,119,94,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .job-modal-title { font-size: 15px; font-weight: 700; color: #111827; letter-spacing: -0.01em; line-height: 1.3; }
                .job-modal-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; line-height: 1.3; }
                .job-close-btn { margin-left: auto; width: 28px; height: 28px; border-radius: 50%; background: #f1f5f9; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; flex-shrink: 0; transition: background 0.15s, color 0.15s; font-size: 20px; line-height: 1; }
                .job-close-btn:hover { background: #e5e7eb; color: #111827; }
                .job-modal-body { padding: 20px; }
                .job-form { display: flex; flex-direction: column; gap: 16px; }
                .job-section-lbl { font-size: 10.5px; font-weight: 700; color: #3b775e; text-transform: uppercase; letter-spacing: 0.07em; padding-bottom: 6px; border-bottom: 1.5px solid #e8f3ee; margin-bottom: 6px; }
                .job-field { display: flex; flex-direction: column; gap: 5px; }
                .job-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .job-lbl { font-size: 11.5px; font-weight: 600; color: #374151; letter-spacing: 0.02em; }
                .job-req { color: #ef4444; margin-left: 2px; }
                .job-input { width: 100%; padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 9px; font-size: 13px; color: #111827; background: #fff; font-family: 'Inter', sans-serif; box-sizing: border-box; transition: border-color 0.15s, box-shadow 0.15s; outline: none; }
                .job-input:focus { border-color: #3b775e; box-shadow: 0 0 0 3px rgba(59,119,94,0.09); }
                .job-input::placeholder { color: #c4c9d4; font-size: 12.5px; }
                .job-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 16px; border-top: 1px solid #f1f3f5; margin-top: 4px; }
                .job-btn-primary { padding: 9px 24px; border: none; background: linear-gradient(135deg, #3b775e 0%, #56a07a 100%); border-radius: 9px; font-size: 12.5px; font-weight: 700; color: #fff; cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity 0.15s, transform 0.15s; }
                .job-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
                .job-btn-ghost { position: relative; isolation: isolate; color: #64748b; background: #fff; border: 1px solid #e2e8f0; padding: 9px 24px; border-radius: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s; display: flex; align-items: center; gap: 6px; overflow: hidden; }
                .job-btn-ghost:hover { background: #f8fafc; color: #1e293b; border-color: #cbd5e1; }
                
                .job-dd-btn { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 13px; color: #1e293b; background: #fff; cursor: pointer; transition: all 0.2s; font-family: 'Inter', sans-serif; outline: none; }
                .job-dd-btn:hover { border-color: #cbd5e1; }
                .job-dd-btn:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
                .job-dd-menu { position: absolute; top: calc(100% + 8px); left: 0; right: 0; background: #ffffff; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.12); z-index: 300; max-height: 200px; padding: 8px; overflow: hidden; animation: jobModalIn 0.2s ease; border: 1px solid #e2e8f0; }
                .job-dd-search-input { width: 100%; padding: 6px 10px; border: 1px solid #f1f5f9; border-radius: 6px; font-size: 12px; background: #f8fafc; outline: none; font-family: 'Inter', sans-serif; box-sizing: border-box; }
                .job-dd-scroll { max-height: 150px; overflow-y: auto; -ms-overflow-style: none; scrollbar-width: none; }
                .job-dd-scroll::-webkit-scrollbar { display: none; }
                .job-dd-option { padding: 7px 10px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: background 0.15s ease, color 0.15s ease; color: #334155; margin-top: 2px; }
                .job-dd-option:hover { background: #f1f5f9 !important; color: #0f172a !important; }

                .rc-dd-option { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.15s ease; }
                .rc-dd-option:hover { background: #f1f5f9; color: #0f172a; }

                .rc-dossier-modal { max-width: 1020px !important; width: 94vw !important; border-radius: 20px !important; }
                .dossier-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
                .dossier-sec-hd { display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
                .dossier-item-box { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
                .dossier-lbl { font-size: 10.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
                .dossier-val { font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-word; }

                @keyframes jobModalIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
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
                        Job Applications
                    </h1>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>
                        Track, filter and manage candidates across all hiring stages
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={() => { setFormData(initialForm); setShowAddModal(true); }}
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
                        <Plus size={16} /> Add Application
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="ist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Candidates', value: stats.total, color: '#667eea', spark: sparklineData.total, filterVal: 'All' },
                    { label: 'In Progress', value: stats.inProgress, color: '#3b82f6', spark: sparklineData.inProgress, filterVal: 'InProgress' },
                    { label: 'Hired', value: stats.hired, color: '#10b981', spark: sparklineData.hired, filterVal: 'Hired' },
                    { label: 'Rejected', value: stats.rejected, color: '#ef4444', spark: sparklineData.rejected, filterVal: 'Rejected' }
                ].map((s) => {
                    const cur = s.spark[5];
                    const prev = s.spark[4];
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
                            onClick={() => {
                                if (s.filterVal === 'All') setStatusFilter('All');
                                else if (s.filterVal === 'InProgress') setStatusFilter('Applied');
                                else setStatusFilter(s.filterVal);
                            }}
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

            {/* Filters & View Toggle */}
            <div style={{ padding: '14px 16px', background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0 12px' }}>
                    <Search size={16} color="#94a3b8" />
                    <input 
                        style={{ border: 'none', background: 'transparent', outline: 'none', padding: '8px 0', fontSize: '12px', width: '100%', color: '#334155' }} 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                        placeholder="Search candidate by name, email or phone..." 
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}>
                            &times;
                        </button>
                    )}
                </div>

                {/* Job Position Filter Custom Dropdown */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowJobFilterDd(!showJobFilterDd);
                            setShowStatusFilterDd(false);
                            setActiveStatusDdId(null);
                        }}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: showJobFilterDd ? '1px solid #3b775e' : '1px solid #e2e8f0',
                            background: '#fff',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: jobFilter !== 'All' ? '#0f172a' : '#475569',
                            outline: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <span>{jobFilter === 'All' ? 'All Jobs' : (jobs.find(j => j._id === jobFilter)?.title || 'Selected Job')}</span>
                        <ChevronDown size={14} style={{ color: '#94a3b8', transform: showJobFilterDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                    {showJobFilterDd && (
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
                                minWidth: '220px',
                                padding: '6px',
                                animation: 'jobModalIn 0.15s ease'
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ padding: '4px', marginBottom: '4px' }}>
                                <input
                                    type="text"
                                    placeholder="Search jobs..."
                                    value={jobSearch}
                                    onChange={(e) => setJobSearch(e.target.value)}
                                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '7px', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                <div
                                    className="rc-dd-option"
                                    onClick={() => { setJobFilter('All'); setShowJobFilterDd(false); setJobSearch(''); }}
                                    onMouseEnter={e => { if (jobFilter !== 'All') e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                    onMouseLeave={e => { if (jobFilter !== 'All') e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    style={{
                                        padding: '7px 10px',
                                        borderRadius: '7px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        background: jobFilter === 'All' ? '#f0fdf4' : 'transparent',
                                        color: jobFilter === 'All' ? '#15803d' : '#334155',
                                        fontWeight: jobFilter === 'All' ? 600 : 400,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <span>All Jobs</span>
                                    {jobFilter === 'All' && <Check size={13} color="#15803d" />}
                                </div>
                                {jobs.filter(j => j.title.toLowerCase().includes(jobSearch.toLowerCase())).map(j => {
                                    const isSelected = jobFilter === j._id;
                                    return (
                                        <div
                                            key={j._id}
                                            className="rc-dd-option"
                                            onClick={() => { setJobFilter(j._id); setShowJobFilterDd(false); setJobSearch(''); }}
                                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                            style={{
                                                padding: '7px 10px',
                                                borderRadius: '7px',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                background: isSelected ? '#f0fdf4' : 'transparent',
                                                color: isSelected ? '#15803d' : '#334155',
                                                fontWeight: isSelected ? 600 : 400,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginTop: '2px'
                                            }}
                                        >
                                            <span>{j.title}</span>
                                            {isSelected && <Check size={13} color="#15803d" />}
                                        </div>
                                    );
                                })}
                            </div>
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
                            setShowJobFilterDd(false);
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
                            {['All', ...stages].map(st => {
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

                {/* Reset Filters button if active */}
                {(searchTerm || statusFilter !== 'All' || jobFilter !== 'All') && (
                    <button
                        type="button"
                        onClick={() => { setSearchTerm(''); setStatusFilter('All'); setJobFilter('All'); }}
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

                {/* View Switcher (Table / Kanban) */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', marginLeft: 'auto', gap: '2px' }}>
                    <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        title="Table View"
                        style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: viewMode === 'table' ? '#ffffff' : 'transparent',
                            color: viewMode === 'table' ? '#0f172a' : '#64748b',
                            boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.15s'
                        }}
                    >
                        <List size={14} /> List
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('kanban')}
                        title="Kanban Board"
                        style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: viewMode === 'kanban' ? '#ffffff' : 'transparent',
                            color: viewMode === 'kanban' ? '#0f172a' : '#64748b',
                            boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                            transition: 'all 0.15s'
                        }}
                    >
                        <LayoutGrid size={14} /> Kanban
                    </button>
                </div>

                {/* Add Stage Button just after List / Kanban Switcher */}
                <button
                    type="button"
                    onClick={() => setShowAddStageModal(true)}
                    title="Add custom pipeline stage"
                    style={{
                        padding: '7px 13px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '10px',
                        border: '1.5px dashed #cbd5e1',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ffffff',
                        color: '#475569',
                        transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#3b775e';
                        e.currentTarget.style.color = '#3b775e';
                        e.currentTarget.style.background = '#f0fdf4';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#cbd5e1';
                        e.currentTarget.style.color = '#475569';
                        e.currentTarget.style.background = '#ffffff';
                    }}
                >
                    <Plus size={14} /> Add Stage
                </button>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                {viewMode === 'table' ? (
                    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <table className="ist-tbl">
                                <thead>
                                    <tr>
                                        <th style={{ width: '40px', paddingLeft: '16px' }}>#</th>
                                        <th>Candidate</th>
                                        <th>Applied For</th>
                                        <th>Contact</th>
                                        <th>Rating</th>
                                        <th>Applied Date</th>
                                        <th>Status</th>
                                        <th style={{ textAlign: 'right', paddingRight: '16px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedCandidates.length > 0 ? (
                                        paginatedCandidates.map((c, idx) => {
                                            const sc = statusColors[c.status] || { bg: '#f1f5f9', color: '#475569' };
                                            const av = getAvatarColor(`${c.firstName} ${c.lastName}`);
                                            const initials = `${(c.firstName || '')[0] || ''}${(c.lastName || '')[0] || ''}`.toUpperCase() || 'C';
                                            const rowNum = startIndex + idx + 1;
                                            return (
                                                <tr key={c._id}>
                                                    <td style={{ paddingLeft: '16px', color: '#94a3b8', fontSize: '12px' }}>{rowNum}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                                                                {initials}
                                                            </div>
                                                            <div>
                                                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{c.firstName} {c.lastName}</div>
                                                                <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{c.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ color: '#1e293b', fontWeight: 500, fontSize: '13px' }}>{c.jobId?.title || '—'}</div>
                                                        {c.jobId?.department && (
                                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{c.jobId.department}</div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            {c.phone && (
                                                                <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Phone size={11} color="#94a3b8" /> {c.phone}
                                                                </div>
                                                            )}
                                                            {c.email && (
                                                                <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <Mail size={11} color="#94a3b8" /> {c.email}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '2px' }}>{renderStars(c.rating || 0, c._id, true)}</div>
                                                    </td>
                                                    <td style={{ fontSize: '12.5px', color: '#64748b' }}>
                                                        {formatDate(c.appliedDate || c.createdAt)}
                                                    </td>
                                                    <td>
                                                        <div style={{ position: 'relative', display: 'inline-block' }} onClick={e => e.stopPropagation()}>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveStatusDdId(activeStatusDdId === c._id ? null : c._id);
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
                                                                <span>{c.status}</span>
                                                                <ChevronDown size={11} style={{ transform: activeStatusDdId === c._id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                                            </button>
                                                            {activeStatusDdId === c._id && (
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
                                                                    {selectableStatuses.map(st => {
                                                                        const optSc = statusColors[st] || { bg: '#f1f5f9', color: '#475569' };
                                                                        const isSelected = c.status === st;
                                                                        return (
                                                                            <div
                                                                                key={st}
                                                                                className="rc-dd-option"
                                                                                onClick={() => handleStatusChange(c._id, st)}
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
                                                                onClick={() => openCandidateModal(c)} 
                                                                title="View Details" 
                                                                className="ist-action-btn"
                                                            >
                                                                <Eye size={15} color="#3b775e" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleArchive(c._id)} 
                                                                title="Archive Application (Move to Candidate Database)" 
                                                                className="ist-action-btn"
                                                            >
                                                                <Archive size={15} color="#6366f1" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDelete(c._id)} 
                                                                title="Delete Application" 
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
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: '13px' }}>
                                                No candidates found matching criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
                            <div>
                                Showing <span style={{ fontWeight: 600, color: '#0f172a' }}>{filtered.length ? startIndex + 1 : 0}</span> to <span style={{ fontWeight: 600, color: '#0f172a' }}>{Math.min(startIndex + CANDIDATES_PER_PAGE, filtered.length)}</span> of <span style={{ fontWeight: 600, color: '#0f172a' }}>{filtered.length}</span> candidates
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
                ) : (
                    /* Kanban View with Drag Highlight */
                    <div style={{ display: 'flex', overflowX: 'auto', gap: '16px', paddingBottom: '20px', flex: 1 }}>
                        {stages.map(stage => {
                            const sc = statusColors[stage] || { bg: '#f1f5f9', color: '#475569' };
                            const stageCandidates = filtered.filter(c => c.status === stage);
                            const isDragTarget = dragOverStage === stage;
                            const isDefault = ['Applied', 'Shortlisted', 'Interview', 'Hired', 'Rejected'].includes(stage);
                            return (
                                <div
                                    key={stage}
                                    style={{
                                        minWidth: '270px',
                                        maxWidth: '270px',
                                        background: isDragTarget ? `${sc.bg}88` : '#f8fafc',
                                        borderRadius: '14px',
                                        padding: '14px',
                                        border: isDragTarget ? `2px dashed ${sc.color}` : '1px solid #e2e8f0',
                                        boxShadow: isDragTarget ? `0 10px 25px -5px ${sc.color}33` : 'none',
                                        transform: isDragTarget ? 'translateY(-2px)' : 'none',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flexShrink: 0,
                                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                                    }}
                                    onDragOver={e => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'move';
                                        if (dragOverStage !== stage) setDragOverStage(stage);
                                    }}
                                    onDragEnter={e => {
                                        e.preventDefault();
                                        setDragOverStage(stage);
                                    }}
                                    onDragLeave={e => {
                                        if (e.currentTarget.contains(e.relatedTarget)) return;
                                        if (dragOverStage === stage) setDragOverStage(null);
                                    }}
                                    onDrop={e => {
                                        setDragOverStage(null);
                                        setDraggingCandidateId(null);
                                        handleDrop(e, stage);
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: sc.color }} />
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{stage}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '11.5px', background: isDragTarget ? sc.bg : '#e2e8f0', color: isDragTarget ? sc.color : '#334155', padding: '2px 8px', borderRadius: '12px', fontWeight: 700, transition: 'all 0.2s' }}>
                                                {stageCandidates.length}
                                            </span>
                                            {!isDefault && (
                                                <button
                                                    type="button"
                                                    title="Delete Custom Stage"
                                                    onClick={() => handleDeleteStage(stage)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex', borderRadius: '4px' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                    onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {isDragTarget && (
                                        <div style={{
                                            padding: '8px 10px',
                                            marginBottom: '10px',
                                            background: sc.color,
                                            color: '#ffffff',
                                            borderRadius: '9px',
                                            fontSize: '11.5px',
                                            fontWeight: 600,
                                            textAlign: 'center',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '6px',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                                            animation: 'jobModalIn 0.15s ease'
                                        }}>
                                            <Check size={13} /> Move to {stage}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '2px' }}>
                                        {stageCandidates.map(c => {
                                            const av = getAvatarColor(`${c.firstName} ${c.lastName}`);
                                            const initials = `${(c.firstName || '')[0] || ''}${(c.lastName || '')[0] || ''}`.toUpperCase() || 'C';
                                            const isBeingDragged = draggingCandidateId === c._id;
                                            return (
                                                <div
                                                    key={c._id}
                                                    draggable
                                                    onDragStart={e => {
                                                        handleDragStart(e, c._id);
                                                        setDraggingCandidateId(c._id);
                                                    }}
                                                    onDragEnd={() => {
                                                        setDraggingCandidateId(null);
                                                        setDragOverStage(null);
                                                    }}
                                                    style={{
                                                        background: '#ffffff',
                                                        padding: '14px',
                                                        borderRadius: '12px',
                                                        border: '1px solid #e2e8f0',
                                                        cursor: 'grab',
                                                        opacity: isBeingDragged ? 0.4 : 1,
                                                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (!isBeingDragged) {
                                                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
                                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                                        }
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px' }}>
                                                                {initials}
                                                            </div>
                                                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                                                                {c.firstName} {c.lastName}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <button 
                                                                onClick={() => openCandidateModal(c)} 
                                                                title="View Details"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex', borderRadius: '4px' }}
                                                                onMouseEnter={e => e.currentTarget.style.color = '#3b775e'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleArchive(c._id)} 
                                                                title="Archive Candidate (Move to Database)"
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex', borderRadius: '4px' }}
                                                                onMouseEnter={e => e.currentTarget.style.color = '#6366f1'}
                                                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                                                            >
                                                                <Archive size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#3b775e', fontWeight: 600, marginBottom: '6px' }}>
                                                        {c.jobId?.title || 'No job assigned'}
                                                    </div>
                                                    {c.email && (
                                                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                                            <Mail size={10} color="#94a3b8" /> {c.email}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                                        <div style={{ display: 'flex', gap: '1px' }}>
                                                            {renderStars(c.rating || 0, c._id, true)}
                                                        </div>
                                                        <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>
                                                            {formatDate(c.appliedDate || c.createdAt)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {stageCandidates.length === 0 && (
                                            <div style={{
                                                textAlign: 'center',
                                                color: isDragTarget ? sc.color : '#cbd5e1',
                                                fontSize: '12px',
                                                fontWeight: isDragTarget ? 600 : 400,
                                                padding: '32px 0',
                                                border: isDragTarget ? `1.5px dashed ${sc.color}` : '1.5px dashed #e2e8f0',
                                                borderRadius: '10px',
                                                background: isDragTarget ? 'rgba(255,255,255,0.8)' : 'transparent',
                                                transition: 'all 0.2s'
                                            }}>
                                                {isDragTarget ? `Drop candidate here` : 'Drop candidates here'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add Application Modal */}
            {showAddModal && (
                <div className="rc-modal-overlay" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAddModal(false)}>
                    <div className="job-modal" onClick={e => e.stopPropagation()}>
                        <div className="job-modal-sticky-head">
                            <div className="job-modal-hd">
                                <div className="job-modal-hd-icon">
                                    <Plus size={18} color="#3b775e" />
                                </div>
                                <div>
                                    <div className="job-modal-title">New Candidate Application</div>
                                    <div className="job-modal-sub">Add candidate details and assign to a job position</div>
                                </div>
                                <button className="job-close-btn" onClick={() => setShowAddModal(false)}>&times;</button>
                            </div>
                        </div>

                        <form onSubmit={handleAddSubmit} className="job-modal-body" autoComplete="off">
                            <div className="job-form">
                                <div className="job-section-lbl">Candidate Information</div>

                                <div className="job-field">
                                    <label className="job-lbl">Job Position<span className="job-req">*</span></label>
                                    <div style={{ position: 'relative' }}>
                                        <button 
                                            type="button" 
                                            className="job-dd-btn"
                                            onClick={() => setShowAddJobDd(!showAddJobDd)}
                                        >
                                            <span style={{ color: formData.jobId ? '#1e293b' : '#9ca3af' }}>
                                                {formData.jobId ? (jobs.find(j => j._id === formData.jobId)?.title || 'Job Selected') : 'Select job position...'}
                                            </span>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                        </button>
                                        {showAddJobDd && (
                                            <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                <div style={{ marginBottom: '8px' }}>
                                                    <input 
                                                        type="text" 
                                                        className="job-dd-search-input" 
                                                        placeholder="Search job position..." 
                                                        value={addJobSearch} 
                                                        onChange={(e) => setAddJobSearch(e.target.value)} 
                                                    />
                                                </div>
                                                <div className="job-dd-scroll">
                                                    {jobs.filter(j => j.title.toLowerCase().includes(addJobSearch.toLowerCase())).map(j => (
                                                        <div 
                                                            key={j._id} 
                                                            className="job-dd-option" 
                                                            onClick={() => { setFormData({ ...formData, jobId: j._id }); setShowAddJobDd(false); setAddJobSearch(''); }} 
                                                            style={{ fontWeight: formData.jobId === j._id ? '600' : 'normal', background: formData.jobId === j._id ? '#f0fdf4' : 'transparent', color: formData.jobId === j._id ? '#15803d' : '#334155' }}
                                                        >
                                                            {j.title} {j.department ? `(${j.department})` : ''}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="job-field-row">
                                    <div className="job-field">
                                        <label className="job-lbl">First Name<span className="job-req">*</span></label>
                                        <input 
                                            type="text" 
                                            className="job-input" 
                                            placeholder="e.g. John" 
                                            value={formData.firstName} 
                                            onChange={e => setFormData({ ...formData, firstName: e.target.value })} 
                                            required 
                                        />
                                    </div>
                                    <div className="job-field">
                                        <label className="job-lbl">Last Name</label>
                                        <input 
                                            type="text" 
                                            className="job-input" 
                                            placeholder="e.g. Doe (Optional)" 
                                            value={formData.lastName} 
                                            onChange={e => setFormData({ ...formData, lastName: e.target.value })} 
                                        />
                                    </div>
                                </div>

                                <div className="job-field-row">
                                    <div className="job-field">
                                        <label className="job-lbl">Email Address<span className="job-req">*</span></label>
                                        <input 
                                            type="email" 
                                            className="job-input" 
                                            placeholder="candidate@example.com" 
                                            value={formData.email} 
                                            onChange={e => setFormData({ ...formData, email: e.target.value })} 
                                            required 
                                        />
                                    </div>
                                    <div className="job-field">
                                        <label className="job-lbl">Phone Number</label>
                                        <input 
                                            type="tel" 
                                            className="job-input" 
                                            placeholder="+91 98765 43210" 
                                            value={formData.phone} 
                                            onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                                        />
                                    </div>
                                </div>

                                <div className="job-section-lbl" style={{ marginTop: '10px' }}>Pipeline Status & Evaluation</div>

                                <div className="job-field-row">
                                    <div className="job-field">
                                        <label className="job-lbl">Initial Stage</label>
                                        <select 
                                            className="job-input" 
                                            style={{ backgroundColor: '#fff', appearance: 'auto' }} 
                                            value={formData.status} 
                                            onChange={e => setFormData({ ...formData, status: e.target.value })}
                                        >
                                            {selectableStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="job-field">
                                        <label className="job-lbl">Rating (1 to 5 Stars)</label>
                                        <select 
                                            className="job-input" 
                                            style={{ backgroundColor: '#fff', appearance: 'auto' }} 
                                            value={formData.rating} 
                                            onChange={e => setFormData({ ...formData, rating: Number(e.target.value) })}
                                        >
                                            <option value={0}>No Rating (0 Stars)</option>
                                            <option value={1}>★☆☆☆☆ (1 Star)</option>
                                            <option value={2}>★★☆☆☆ (2 Stars)</option>
                                            <option value={3}>★★★☆☆ (3 Stars)</option>
                                            <option value={4}>★★★★☆ (4 Stars)</option>
                                            <option value={5}>★★★★★ (5 Stars - Top Pick)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="job-field" style={{ gridColumn: '1 / -1' }}>
                                    <label className="job-lbl">Resume Link / URL</label>
                                    <input 
                                        type="url" 
                                        className="job-input" 
                                        placeholder="https://drive.google.com/..." 
                                        value={formData.resumeUrl} 
                                        onChange={e => setFormData({ ...formData, resumeUrl: e.target.value })} 
                                    />
                                </div>

                                <div className="job-field" style={{ gridColumn: '1 / -1' }}>
                                    <label className="job-lbl">Interview Notes & Observations</label>
                                    <textarea 
                                        rows={3} 
                                        className="job-input" 
                                        placeholder="Add recruiter notes, candidate strengths or scheduling details..." 
                                        value={formData.notes} 
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })} 
                                        style={{ resize: 'vertical' }} 
                                    />
                                </div>
                            </div>

                            <div className="job-footer">
                                <button type="button" className="job-btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" disabled={submitting} className="job-btn-primary">
                                    {submitting ? 'Adding...' : 'Add Application'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Add Custom Stage Modal */}
            {showAddStageModal && (
                <div className="rc-modal-overlay" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAddStageModal(false)}>
                    <div className="job-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="job-modal-sticky-head">
                            <div className="job-modal-hd">
                                <div className="job-modal-hd-icon">
                                    <Plus size={18} color="#3b775e" />
                                </div>
                                <div>
                                    <div className="job-modal-title">Add Pipeline Stage</div>
                                    <div className="job-modal-sub">Create a custom hiring stage for candidate workflows</div>
                                </div>
                                <button className="job-close-btn" onClick={() => setShowAddStageModal(false)}>&times;</button>
                            </div>
                        </div>

                        <form onSubmit={handleAddStage} className="job-modal-body">
                            <div className="job-form">
                                <div className="job-field">
                                    <label className="job-lbl">Stage Name<span className="job-req">*</span></label>
                                    <input
                                        type="text"
                                        className="job-input"
                                        placeholder="e.g. Technical Assessment, HR Round, Offer Letter..."
                                        value={newStageName}
                                        onChange={e => setNewStageName(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="job-field">
                                    <label className="job-lbl">Stage Color Theme</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '4px' }}>
                                        {STAGE_COLOR_PRESETS.map((p, i) => {
                                            const isSelected = selectedPresetColor.color === p.color;
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => setSelectedPresetColor(p)}
                                                    style={{
                                                        padding: '8px 6px',
                                                        borderRadius: '8px',
                                                        background: p.bg,
                                                        color: p.color,
                                                        fontSize: '11.5px',
                                                        fontWeight: 700,
                                                        textAlign: 'center',
                                                        cursor: 'pointer',
                                                        border: isSelected ? `2px solid ${p.color}` : '1.5px solid transparent',
                                                        boxShadow: isSelected ? `0 0 0 2px ${p.color}33` : 'none',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                >
                                                    {p.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>Badge Preview:</span>
                                    <span style={{ background: selectedPresetColor.bg, color: selectedPresetColor.color, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                                        {newStageName.trim() || 'New Stage'}
                                    </span>
                                </div>
                            </div>

                            <div className="job-footer">
                                <button type="button" className="job-btn-ghost" onClick={() => setShowAddStageModal(false)}>Cancel</button>
                                <button type="submit" className="job-btn-primary">Add Stage</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Candidate Application Dossier Modal */}
            {viewCandidate && (
                <div 
                    className="rc-modal-overlay" 
                    style={{ 
                        background: 'rgba(15, 23, 42, 0.55)', 
                        backdropFilter: 'blur(6px)', 
                        padding: '24px 16px', 
                        zIndex: 1000, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        position: 'fixed',
                        inset: 0
                    }} 
                    onClick={() => setViewCandidate(null)}
                >
                    <div 
                        className="job-modal rc-dossier-modal" 
                        onClick={e => e.stopPropagation()} 
                        style={{ 
                            maxWidth: '1020px', 
                            width: '94vw', 
                            maxHeight: '90vh', 
                            borderRadius: '20px', 
                            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            background: '#ffffff',
                            overflow: 'hidden' 
                        }}
                    >
                        {/* Dossier Sticky Top Header */}
                        <div className="job-modal-sticky-head" style={{ borderBottom: '1px solid #e2e8f0', background: '#ffffff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ 
                                        width: '46px', 
                                        height: '46px', 
                                        borderRadius: '12px', 
                                        background: 'linear-gradient(135deg, #e0e7ff 0%, #ede9fe 100%)', 
                                        color: '#4338ca', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        fontWeight: 800, 
                                        fontSize: '17px',
                                        flexShrink: 0,
                                        boxShadow: '0 2px 8px rgba(67, 56, 202, 0.15)'
                                    }}>
                                        {`${(viewCandidate.firstName || '')[0] || ''}${(viewCandidate.lastName || '')[0] || ''}`.toUpperCase() || 'C'}
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                                                {viewCandidate.firstName} {viewCandidate.lastName}
                                            </h3>
                                            {viewCandidate.applicationId && (
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px' }}>
                                                    {viewCandidate.applicationId}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#0369a1', background: '#e0f2fe', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '6px', textTransform: 'capitalize' }}>
                                                {viewCandidate.source?.replace('_', ' ') || 'Career Portal'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontWeight: 600, color: '#334155' }}>{viewCandidate.jobId?.title || 'Open Position'}</span>
                                            {viewCandidate.jobId?.department && <span>• {viewCandidate.jobId.department}</span>}
                                            {viewCandidate.jobId?.location && <span>• {viewCandidate.jobId.location}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    {viewCandidate.resumeUrl && (
                                        <a 
                                            href={viewCandidate.resumeUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            style={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                background: '#f0fdf4', 
                                                color: '#15803d', 
                                                border: '1px solid #86efac', 
                                                padding: '6px 14px', 
                                                borderRadius: '8px', 
                                                fontSize: '12px', 
                                                fontWeight: 700, 
                                                textDecoration: 'none',
                                                transition: 'all 0.15s'
                                            }}
                                        >
                                            <FileText size={14} /> View Resume <ExternalLink size={12} />
                                        </a>
                                    )}

                                    <span style={{ 
                                        ...(statusColors[viewCandidate.status] || { bg: '#f1f5f9', color: '#475569' }), 
                                        padding: '6px 14px', 
                                        borderRadius: '20px', 
                                        fontSize: '12px', 
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: (statusColors[viewCandidate.status] || {}).color || '#475569' }} />
                                        {viewCandidate.status}
                                    </span>

                                    <button 
                                        className="job-close-btn" 
                                        onClick={() => setViewCandidate(null)}
                                        title="Close dossier"
                                        style={{ marginLeft: '4px' }}
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Dossier Multi-Card Application Form Body */}
                        <div className="job-modal-body" style={{ maxHeight: 'calc(90vh - 135px)', overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            
                            {/* Card 1: Basic & Contact Details */}
                            <div className="dossier-card">
                                <div className="dossier-sec-hd">
                                    <Mail size={15} color="#166534" /> 1. Contact Coordinates &amp; Application Information
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Email Address</span>
                                        <a href={`mailto:${viewCandidate.email}`} style={{ color: '#2563eb', fontWeight: 600, fontSize: '13px', textDecoration: 'none', wordBreak: 'break-all' }}>
                                            {viewCandidate.email || '—'}
                                        </a>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Primary Phone</span>
                                        <a href={`tel:${viewCandidate.phone}`} style={{ color: '#0f172a', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
                                            {viewCandidate.phone || '—'}
                                        </a>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Alternate Phone</span>
                                        <span className="dossier-val">{viewCandidate.personalDetails?.altPhone || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Applied Date</span>
                                        <span className="dossier-val">{formatDate(viewCandidate.appliedDate || viewCandidate.createdAt)}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Target Job Role</span>
                                        <span className="dossier-val" style={{ color: '#166534' }}>{viewCandidate.jobId?.title || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Department</span>
                                        <span className="dossier-val">{viewCandidate.jobId?.department || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Job Location / Type</span>
                                        <span className="dossier-val">{viewCandidate.jobId?.location || '—'} {viewCandidate.jobId?.type ? `(${viewCandidate.jobId.type})` : ''}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Application Ref Code</span>
                                        <span className="dossier-val" style={{ color: '#0369a1' }}>{viewCandidate.applicationId || '—'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Personal & Demographic Details */}
                            <div className="dossier-card">
                                <div className="dossier-sec-hd">
                                    <ShieldCheck size={15} color="#166534" /> 2. Personal &amp; Demographic Information
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">{viewCandidate.personalDetails?.guardianRelation || 'Father / Guardian'}</span>
                                        <span className="dossier-val">
                                            {viewCandidate.personalDetails?.guardianName ? `${viewCandidate.personalDetails.guardianSalutation || ''} ${viewCandidate.personalDetails.guardianName}`.trim() : '—'}
                                        </span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Date of Birth</span>
                                        <span className="dossier-val">{viewCandidate.personalDetails?.dob || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Gender</span>
                                        <span className="dossier-val">{viewCandidate.personalDetails?.gender || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Marital Status</span>
                                        <span className="dossier-val">{viewCandidate.personalDetails?.maritalStatus || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Nationality</span>
                                        <span className="dossier-val">{viewCandidate.personalDetails?.nationality || 'Indian'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Religion / Category</span>
                                        <span className="dossier-val">
                                            {viewCandidate.personalDetails?.religion || '—'} {viewCandidate.personalDetails?.caste ? `(${viewCandidate.personalDetails.caste})` : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* Address Breakdown */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '12px 14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <MapPin size={12} color="#15803d" /> Current Residential Address
                                        </div>
                                        <div style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 500, lineHeight: '1.4' }}>
                                            {viewCandidate.personalDetails?.currentAddress?.street || viewCandidate.personalDetails?.currentAddress?.city ? (
                                                <>
                                                    {viewCandidate.personalDetails.currentAddress.street ? `${viewCandidate.personalDetails.currentAddress.street}, ` : ''}
                                                    {viewCandidate.personalDetails.currentAddress.city ? `${viewCandidate.personalDetails.currentAddress.city}, ` : ''}
                                                    {viewCandidate.personalDetails.currentAddress.state || ''} {viewCandidate.personalDetails.currentAddress.zip ? `- ${viewCandidate.personalDetails.currentAddress.zip}` : ''}
                                                </>
                                            ) : 'No current address provided'}
                                        </div>
                                    </div>

                                    <div style={{ background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '12px 14px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <MapPin size={12} color="#6366f1" /> Permanent Address
                                        </div>
                                        <div style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 500, lineHeight: '1.4' }}>
                                            {viewCandidate.personalDetails?.isAddressSame !== false ? (
                                                <span style={{ color: '#64748b', fontStyle: 'italic' }}>Same as current residential address</span>
                                            ) : (
                                                <>
                                                    {viewCandidate.personalDetails?.permanentAddress?.street ? `${viewCandidate.personalDetails.permanentAddress.street}, ` : ''}
                                                    {viewCandidate.personalDetails?.permanentAddress?.city ? `${viewCandidate.personalDetails.permanentAddress.city}, ` : ''}
                                                    {viewCandidate.personalDetails?.permanentAddress?.state || ''} {viewCandidate.personalDetails?.permanentAddress?.zip ? `- ${viewCandidate.personalDetails.permanentAddress.zip}` : ''}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card 3: Academic Qualifications */}
                            <div className="dossier-card">
                                <div className="dossier-sec-hd">
                                    <GraduationCap size={15} color="#166534" /> 3. Academic &amp; Educational Qualifications
                                </div>
                                {(() => {
                                    const q = viewCandidate.qualifications || {};
                                    const entries = [
                                        { key: '10th (Secondary)', val: q.tenth, name: q.tenth?.school, board: q.tenth?.board, year: q.tenth?.year, score: q.tenth?.score || q.tenth?.marks, gradeType: q.tenth?.gradeType },
                                        { key: '12th (Higher Secondary)', val: q.twelfth, name: q.twelfth?.school, board: q.twelfth?.board, stream: q.twelfth?.stream, year: q.twelfth?.year, score: q.twelfth?.score || q.twelfth?.marks, gradeType: q.twelfth?.gradeType },
                                        { key: 'Diploma / Technical', val: q.diploma, name: q.diploma?.college, stream: q.diploma?.stream, year: q.diploma?.year, score: q.diploma?.score || q.diploma?.marks },
                                        { key: 'Graduation Degree', val: q.graduation, name: q.graduation?.college, degree: q.graduation?.degree, year: q.graduation?.year, score: q.graduation?.score || q.graduation?.marks },
                                        { key: 'Post-Graduation', val: q.postGraduation, name: q.postGraduation?.college, degree: q.postGraduation?.degree, year: q.postGraduation?.year, score: q.postGraduation?.score || q.postGraduation?.marks }
                                    ].filter(item => item.name || item.degree || item.score);

                                    if (entries.length === 0) {
                                        return (
                                            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '10px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                                                No formal academic records submitted for this application.
                                            </div>
                                        );
                                    }

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {entries.map((item, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '8px' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#166534', background: '#dcfce7', padding: '2px 8px', borderRadius: '5px' }}>
                                                                {item.key}
                                                            </span>
                                                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                                                                {item.degree || item.name || '—'}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                                                            {item.name && item.degree ? `${item.name} • ` : ''}
                                                            {item.board ? `${item.board} • ` : ''}
                                                            {item.stream ? `${item.stream} • ` : ''}
                                                            {item.year ? `Year of Passing: ${item.year}` : ''}
                                                        </div>
                                                    </div>
                                                    {item.score && (
                                                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 700, color: '#0f172a' }}>
                                                            Score: <span style={{ color: '#15803d' }}>{item.score} {item.gradeType === 'Percentage' ? '%' : ''}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Card 4: Work Experience & Skill Profile */}
                            <div className="dossier-card">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                    <div className="dossier-sec-hd" style={{ marginBottom: 0 }}>
                                        <Briefcase size={15} color="#166534" /> 4. Professional Experience &amp; Skill Profile
                                    </div>
                                    <span style={{ 
                                        fontSize: '11px', 
                                        fontWeight: 700, 
                                        padding: '3px 10px', 
                                        borderRadius: '12px',
                                        background: viewCandidate.experience?.candidateType === 'Experienced' ? '#f0fdf4' : '#eff6ff',
                                        color: viewCandidate.experience?.candidateType === 'Experienced' ? '#15803d' : '#2563eb',
                                        border: viewCandidate.experience?.candidateType === 'Experienced' ? '1px solid #bbf7d0' : '1px solid #bfdbfe'
                                    }}>
                                        {viewCandidate.experience?.candidateType || 'Fresher'}
                                    </span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Current / Recent Company</span>
                                        <span className="dossier-val">{viewCandidate.experience?.currentCompany || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Designation / Role</span>
                                        <span className="dossier-val">{viewCandidate.experience?.currentRole || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Total Experience</span>
                                        <span className="dossier-val">
                                            {viewCandidate.experience?.totalExpYears !== undefined && viewCandidate.experience?.totalExpYears !== null ? (
                                                `${viewCandidate.experience.totalExpYears} Years ${viewCandidate.experience.totalExpMonths ? `& ${viewCandidate.experience.totalExpMonths} Months` : ''}`
                                            ) : 'Fresher (0 Years)'}
                                        </span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Notice Period</span>
                                        <span className="dossier-val">{viewCandidate.experience?.noticePeriod || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Current CTC</span>
                                        <span className="dossier-val">{viewCandidate.experience?.currentSalary || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box" style={{ background: '#f0fdf4', borderColor: '#dcfce7' }}>
                                        <span className="dossier-lbl" style={{ color: '#166534' }}>Expected CTC</span>
                                        <span className="dossier-val" style={{ color: '#15803d', fontWeight: 700 }}>
                                            {viewCandidate.experience?.expectedSalary || '—'}
                                        </span>
                                    </div>
                                </div>

                                {/* Skills Chips */}
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                                        Key Skills &amp; Competencies
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {viewCandidate.experience?.keySkills ? (
                                            viewCandidate.experience.keySkills.split(',').map((skill, idx) => (
                                                <span 
                                                    key={idx} 
                                                    style={{ 
                                                        background: '#f8fafc', 
                                                        color: '#334155', 
                                                        border: '1px solid #e2e8f0', 
                                                        padding: '4px 10px', 
                                                        borderRadius: '6px', 
                                                        fontSize: '12px', 
                                                        fontWeight: 600 
                                                    }}
                                                >
                                                    {skill.trim()}
                                                </span>
                                            ))
                                        ) : (
                                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>No specific skills tags submitted.</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Card 5: Recruiter Evaluation, Rating & Pipeline Management */}
                            <div className="dossier-card" style={{ background: '#fcfdfd', borderColor: '#e2e8f0' }}>
                                <div className="dossier-sec-hd">
                                    <Award size={15} color="#166534" /> 5. Recruiter Evaluation &amp; Pipeline Stage Progression
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {/* Left Side: Rating + Move Stage */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                        <div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                                Evaluation Rating (Click to Rate)
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                {renderStars(viewCandidate.rating || 0, viewCandidate._id, true)}
                                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginLeft: '6px' }}>
                                                    ({viewCandidate.rating || 0} / 5 Stars)
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
                                                Move Candidate Stage
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {selectableStatuses.map(s => {
                                                    const sc = statusColors[s] || { bg: '#f1f5f9', color: '#475569' };
                                                    const isActive = viewCandidate.status === s;
                                                    return (
                                                        <button 
                                                            key={s} 
                                                            type="button"
                                                            onClick={() => { handleStatusChange(viewCandidate._id, s); setViewCandidate({ ...viewCandidate, status: s }); }}
                                                            style={{ 
                                                                padding: '6px 14px', 
                                                                borderRadius: '20px', 
                                                                fontSize: '12px', 
                                                                fontWeight: 600, 
                                                                cursor: 'pointer', 
                                                                border: isActive ? `1.5px solid ${sc.color}` : '1px solid #e2e8f0', 
                                                                background: isActive ? sc.bg : '#fff', 
                                                                color: isActive ? sc.color : '#64748b',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                transition: 'all 0.15s'
                                                            }}
                                                        >
                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sc.color }} />
                                                            {s}
                                                            {isActive && <Check size={12} color={sc.color} />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Notes */}
                                    <div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Recruiter Notes &amp; Observations
                                        </div>
                                        <textarea
                                            rows={4}
                                            className="job-input"
                                            placeholder="Add recruiter observations, interview feedback or internal remarks (auto-saves on blur)..."
                                            value={viewCandidate.notes || ''}
                                            onChange={e => setViewCandidate({ ...viewCandidate, notes: e.target.value })}
                                            onBlur={e => handleNotesChange(viewCandidate._id, e.target.value)}
                                            style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5', resize: 'vertical', background: '#fff' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Controls */}
                        <div className="job-footer" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    type="button" 
                                    className="job-btn-ghost" 
                                    onClick={() => {
                                        const id = viewCandidate._id;
                                        setViewCandidate(null);
                                        handleArchive(id);
                                    }}
                                    style={{ color: '#6366f1', borderColor: '#e0e7ff', background: '#f5f3ff' }}
                                >
                                    <Archive size={13} color="#6366f1" /> Archive Candidate
                                </button>
                                <button 
                                    type="button" 
                                    className="job-btn-ghost" 
                                    onClick={() => {
                                        const id = viewCandidate._id;
                                        setViewCandidate(null);
                                        handleDelete(id);
                                    }}
                                    style={{ color: '#ef4444', borderColor: '#fee2e2' }}
                                >
                                    <Trash2 size={13} /> Delete Application
                                </button>
                            </div>
                            <button 
                                type="button" 
                                className="job-btn-primary" 
                                onClick={() => setViewCandidate(null)}
                                style={{ padding: '8px 24px' }}
                            >
                                Close Dossier
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecruitmentPipeline;
