import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import {
    Search, Eye, Trash2, Star, Phone, Mail, ChevronDown,
    Users, UserCheck, Clock, ExternalLink, FileText, Check,
    RefreshCw, Archive, RotateCcw, Briefcase, Calendar, ShieldCheck,
    GraduationCap, MapPin, Award
} from 'lucide-react';
import './RecruitmentDashboard.css';

const statusColors = {
    Applied: { bg: '#e0f2fe', color: '#0369a1' },
    Shortlisted: { bg: '#fef9c3', color: '#854d0e' },
    'Phone Screen': { bg: '#ede9fe', color: '#6d28d9' },
    Interview: { bg: '#dbeafe', color: '#1d4ed8' },
    Hired: { bg: '#dcfce7', color: '#166534' },
    Rejected: { bg: '#fee2e2', color: '#991b1b' },
};

const avatarColors = [
    { bg: '#e0e7ff', color: '#4338ca' },
    { bg: '#fce7f3', color: '#be185d' },
    { bg: '#e0f2fe', color: '#0369a1' },
    { bg: '#dcfce7', color: '#15803d' },
    { bg: '#fef3c7', color: '#b45309' },
    { bg: '#ede9fe', color: '#6d28d9' }
];

const CANDIDATES_PER_PAGE = 10;

const AddCandidate = () => {
    const calcChange = (cur, prev) => {
        if (!prev) return cur ? '100%' : '0%';
        return Math.round(Math.abs((cur - prev) / prev * 100)) + '%';
    };
    const isUp = (cur, prev) => cur >= prev;

    const Sparkline = ({ data, color }) => {
        const w = 80, h = 32;
        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
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
    const [jobFilter, setJobFilter] = useState('All');
    const [ratingFilter, setRatingFilter] = useState('All');
    const [viewCandidate, setViewCandidate] = useState(null);
    const [loading, setLoading] = useState(true);

    // Dropdown visibility states
    const [showJobFilterDd, setShowJobFilterDd] = useState(false);
    const [jobSearch, setJobSearch] = useState('');
    const [showRatingFilterDd, setShowRatingFilterDd] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        fetchCandidates();
        fetchJobs();
    }, []);

    useEffect(() => {
        const close = () => {
            setShowJobFilterDd(false);
            setShowRatingFilterDd(false);
        };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, jobFilter, ratingFilter]);

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

    const getAvatarColor = (name = '') => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return avatarColors[Math.abs(hash) % avatarColors.length];
    };

    // Filter ONLY archived candidates for this database
    const archivedCandidates = useMemo(() => {
        return candidates.filter(c => c.isArchived === true);
    }, [candidates]);

    const filtered = useMemo(() => {
        return archivedCandidates.filter(c => {
            const name = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
            const matchSearch = name.includes(searchTerm.toLowerCase()) ||
                (c.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.phone || '').includes(searchTerm) ||
                (c.jobId?.title || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchJob = jobFilter === 'All' || (c.jobId?._id === jobFilter || c.jobId === jobFilter);
            const matchRating = ratingFilter === 'All' || (c.rating && c.rating >= Number(ratingFilter));
            return matchSearch && matchJob && matchRating;
        });
    }, [archivedCandidates, searchTerm, jobFilter, ratingFilter]);

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
                archivedCandidates.filter(c => {
                    const d = new Date(c.archivedAt || c.updatedAt || c.createdAt || Date.now());
                    return d.getFullYear() === year && d.getMonth() === month && filterFn(c);
                }).length
            );
        return {
            total: countFor(() => true),
            inProgress: countFor(c => !['Hired', 'Rejected'].includes(c.status)),
            hired: countFor(c => c.status === 'Hired'),
            rejected: countFor(c => c.status === 'Rejected')
        };
    }, [archivedCandidates]);

    const stats = {
        total: archivedCandidates.length,
        inProgress: archivedCandidates.filter(c => !['Hired', 'Rejected'].includes(c.status)).length,
        hired: archivedCandidates.filter(c => c.status === 'Hired').length,
        rejected: archivedCandidates.filter(c => c.status === 'Rejected').length,
    };

    const handleRestore = async (id) => {
        if (!window.confirm('Restore this candidate back to active Job Applications pipeline?')) return;
        try {
            await api.patch(`/recruitment/candidates/${id}/archive`, { isArchived: false });
            fetchCandidates();
            if (viewCandidate && viewCandidate._id === id) {
                setViewCandidate(null);
            }
        } catch (err) {
            console.error('Failed to restore candidate', err);
            alert('Failed to restore candidate');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Permanently delete this archived candidate record?')) return;
        try { 
            await api.delete(`/recruitment/candidates/${id}`); 
            fetchCandidates(); 
            if (viewCandidate && viewCandidate._id === id) {
                setViewCandidate(null);
            }
        } catch (err) { 
            alert('Failed to delete candidate'); 
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
                    <div className="skel" style={{ width: '190px', height: '22px', marginBottom: '6px' }} />
                    <div className="skel" style={{ width: '330px', height: '12px' }} />
                </div>
                <div className="skel" style={{ width: '135px', height: '32px', borderRadius: '12px' }} />
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
            <div style={{ padding: '14px 16px', background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', gap: '10px', marginBottom: '24px', alignItems: 'center' }}>
                <div className="skel" style={{ flex: 1, minWidth: '240px', height: '36px', borderRadius: '10px' }} />
                <div className="skel" style={{ width: '120px', height: '36px', borderRadius: '10px' }} />
                <div className="skel" style={{ width: '110px', height: '36px', borderRadius: '10px' }} />
            </div>

            {/* Table Skeleton */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '40px 2.2fr 1.6fr 1.6fr 1.1fr 1.1fr 1.1fr 70px', gap: '12px', padding: '11px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    {['#', 'CANDIDATE', 'APPLIED FOR', 'CONTACT', 'RATING', 'DATE ARCHIVED', 'STAGE AT ARCHIVE', 'ACTIONS'].map((col, i) => (
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
                .ist-tbl tbody td { font-size: 13px; color: #475569; padding: 10px 12px; vertical-align: middle; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
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
                .job-modal-hd-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(99,102,241,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .job-modal-title { font-size: 15px; font-weight: 700; color: #111827; letter-spacing: -0.01em; line-height: 1.3; }
                .job-modal-sub { font-size: 12px; color: #9ca3af; margin-top: 2px; line-height: 1.3; }
                .job-close-btn { margin-left: auto; width: 28px; height: 28px; border-radius: 50%; background: #f1f5f9; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; flex-shrink: 0; transition: background 0.15s, color 0.15s; font-size: 20px; line-height: 1; }
                .job-close-btn:hover { background: #e5e7eb; color: #111827; }
                .job-modal-body { padding: 20px; }
                .job-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 16px; border-top: 1px solid #f1f3f5; margin-top: 4px; }
                .job-btn-primary { padding: 9px 24px; border: none; background: linear-gradient(135deg, #3b775e 0%, #56a07a 100%); border-radius: 9px; font-size: 12.5px; font-weight: 700; color: #fff; cursor: pointer; font-family: 'Inter', sans-serif; transition: opacity 0.15s, transform 0.15s; }
                .job-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
                .job-btn-ghost { position: relative; isolation: isolate; color: #64748b; background: #fff; border: 1px solid #e2e8f0; padding: 9px 20px; border-radius: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: 'Inter', sans-serif; transition: all 0.2s; display: flex; align-items: center; gap: 6px; overflow: hidden; }
                .job-btn-ghost:hover { background: #f8fafc; color: #1e293b; border-color: #cbd5e1; }
                
                .rc-dd-option { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; border-radius: 8px; font-size: 12px; cursor: pointer; transition: all 0.15s ease; }
                .rc-dd-option:hover { background: #f1f5f9; color: #0f172a; }

                .rc-dossier-modal { max-width: 1020px !important; width: 94vw !important; border-radius: 20px !important; }
                .dossier-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
                .dossier-sec-hd { display: flex; align-items: center; gap: 8px; font-size: 11.5px; font-weight: 800; color: #6d28d9; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }
                .dossier-item-box { background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 3px; }
                .dossier-lbl { font-size: 10.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; }
                .dossier-val { font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-word; }

                @keyframes jobModalIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Candidate Database</h1>
                    <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>Archived candidate profiles preserved from the job applications pipeline</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f5f3ff', padding: '6px 14px', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                    <Archive size={16} color="#6d28d9" />
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#6d28d9' }}>{archivedCandidates.length} Archived Record{archivedCandidates.length !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {/* Top Stat Cards (Matching Job Applications Page) */}
            <div className="ist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                    { label: 'Archived Candidates', value: stats.total, color: '#667eea', spark: sparklineData.total },
                    { label: 'In Progress', value: stats.inProgress, color: '#3b82f6', spark: sparklineData.inProgress },
                    { label: 'Hired', value: stats.hired, color: '#10b981', spark: sparklineData.hired },
                    { label: 'Rejected', value: stats.rejected, color: '#ef4444', spark: sparklineData.rejected }
                ].map((s) => {
                    const cur = s.spark[5];
                    const prev = s.spark[4];
                    const trend = calcChange(cur, prev);
                    const up = isUp(cur, prev);
                    return (
                        <div
                            key={s.label}
                            style={{ 
                                background: 'white', 
                                padding: '14px 16px 10px', 
                                borderRadius: '12px', 
                                border: '1px solid #e2e8f0', 
                                cursor: 'default', 
                                transition: 'all 0.3s', 
                                overflow: 'hidden', 
                                position: 'relative' 
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
                                    <span style={{ fontSize: '9.5px', color: '#94a3b8', lineHeight: 1.2 }}>vs last month</span>
                                </div>
                                <Sparkline data={s.spark} color={s.color} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Filters Bar */}
            <div style={{ padding: '14px 16px', background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px', alignItems: 'center' }}>
                {/* Search Bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0 12px' }}>
                    <Search size={16} color="#94a3b8" />
                    <input
                        style={{ border: 'none', background: 'transparent', outline: 'none', padding: '8px 0', fontSize: '12px', width: '100%', color: '#334155' }}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search archived candidate by name, email, phone or job..."
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}>
                            &times;
                        </button>
                    )}
                </div>

                {/* Job Position Custom Dropdown */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowJobFilterDd(!showJobFilterDd);
                            setShowRatingFilterDd(false);
                        }}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: showJobFilterDd ? '1px solid #6366f1' : '1px solid #e2e8f0',
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
                                    style={{
                                        padding: '7px 10px',
                                        borderRadius: '7px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        background: jobFilter === 'All' ? '#f5f3ff' : 'transparent',
                                        color: jobFilter === 'All' ? '#6366f1' : '#334155',
                                        fontWeight: jobFilter === 'All' ? 600 : 400,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <span>All Jobs</span>
                                    {jobFilter === 'All' && <Check size={13} color="#6366f1" />}
                                </div>
                                {jobs.filter(j => j.title.toLowerCase().includes(jobSearch.toLowerCase())).map(j => {
                                    const isSelected = jobFilter === j._id;
                                    return (
                                        <div
                                            key={j._id}
                                            className="rc-dd-option"
                                            onClick={() => { setJobFilter(j._id); setShowJobFilterDd(false); setJobSearch(''); }}
                                            style={{
                                                padding: '7px 10px',
                                                borderRadius: '7px',
                                                fontSize: '12px',
                                                cursor: 'pointer',
                                                background: isSelected ? '#f5f3ff' : 'transparent',
                                                color: isSelected ? '#6366f1' : '#334155',
                                                fontWeight: isSelected ? 600 : 400,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                marginTop: '2px'
                                            }}
                                        >
                                            <span>{j.title}</span>
                                            {isSelected && <Check size={13} color="#6366f1" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Rating Filter Custom Dropdown */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowRatingFilterDd(!showRatingFilterDd);
                            setShowJobFilterDd(false);
                        }}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '10px',
                            border: showRatingFilterDd ? '1px solid #6366f1' : '1px solid #e2e8f0',
                            background: '#fff',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: ratingFilter !== 'All' ? '#0f172a' : '#475569',
                            outline: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <span>{ratingFilter === 'All' ? 'All Ratings' : `${ratingFilter}★ & above`}</span>
                        <ChevronDown size={14} style={{ color: '#94a3b8', transform: showRatingFilterDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                    </button>
                    {showRatingFilterDd && (
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
                            {[
                                { id: 'All', label: 'All Ratings' },
                                { id: '4', label: '4★ & above' },
                                { id: '3', label: '3★ & above' },
                                { id: '1', label: '1★ & above' }
                            ].map(r => {
                                const isSelected = ratingFilter === r.id;
                                return (
                                    <div
                                        key={r.id}
                                        className="rc-dd-option"
                                        onClick={() => { setRatingFilter(r.id); setShowRatingFilterDd(false); }}
                                        style={{
                                            padding: '7px 10px',
                                            borderRadius: '7px',
                                            fontSize: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            background: isSelected ? '#f5f3ff' : 'transparent',
                                            color: isSelected ? '#6366f1' : '#334155',
                                            fontWeight: isSelected ? 600 : 400,
                                            marginTop: '2px'
                                        }}
                                    >
                                        <span>{r.label}</span>
                                        {isSelected && <Check size={13} color="#6366f1" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Reset Filters */}
                {(searchTerm !== '' || jobFilter !== 'All' || ratingFilter !== 'All') && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            setJobFilter('All');
                            setRatingFilter('All');
                        }}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            border: '1px solid #fee2e2',
                            background: '#fff1f2',
                            color: '#e11d48',
                            fontSize: '12px',
                            fontWeight: 600,
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

            {/* Table Area */}
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
                                <th>Date Archived</th>
                                <th>Stage at Archive</th>
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
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{c.firstName} {c.lastName}</span>
                                                            <span style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                                <Archive size={10} /> Archived
                                                            </span>
                                                        </div>
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
                                                {formatDate(c.archivedAt || c.updatedAt || c.appliedDate || c.createdAt)}
                                            </td>
                                            <td>
                                                <span style={{ ...sc, padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sc.color }} />
                                                    {c.status}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                                                <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                                    <button
                                                        onClick={() => openCandidateModal(c)}
                                                        title="View Profile Details"
                                                        className="ist-action-btn"
                                                    >
                                                        <Eye size={15} color="#3b775e" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRestore(c._id)}
                                                        title="Restore to Active Job Applications"
                                                        className="ist-action-btn"
                                                    >
                                                        <RotateCcw size={15} color="#0f766e" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(c._id)}
                                                        title="Permanently Delete"
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
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '60px 0' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Archive size={24} color="#8b5cf6" />
                                            </div>
                                            <div style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>No Archived Candidates</div>
                                            <div style={{ color: '#94a3b8', fontSize: '12.5px', maxWidth: '360px', lineHeight: '1.5' }}>
                                                Candidates archived from the <b>Job Applications</b> pipeline will be preserved and searchable here in the database.
                                            </div>
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
                        Showing <span style={{ fontWeight: 600, color: '#0f172a' }}>{filtered.length ? startIndex + 1 : 0}</span> to <span style={{ fontWeight: 600, color: '#0f172a' }}>{Math.min(startIndex + CANDIDATES_PER_PAGE, filtered.length)}</span> of <span style={{ fontWeight: 600, color: '#0f172a' }}>{filtered.length}</span> archived candidates
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

            {/* View Candidate Modal (Executive Application Form Dossier) */}
            {viewCandidate && (
                <div className="rc-modal-overlay" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)', padding: '20px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setViewCandidate(null)}>
                    <div className="job-modal rc-dossier-modal" onClick={e => e.stopPropagation()}>
                        
                        {/* Dossier Sticky Header */}
                        <div className="job-modal-sticky-head" style={{ padding: '16px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                                
                                {/* Avatar & Candidate Identity */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                    <div style={{ 
                                        width: '48px', 
                                        height: '48px', 
                                        borderRadius: '12px', 
                                        background: '#f0fdf4', 
                                        color: '#166534', 
                                        border: '1.5px solid #bbf7d0',
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        fontWeight: 800, 
                                        fontSize: '17px',
                                        boxShadow: '0 2px 8px rgba(22, 101, 52, 0.12)'
                                    }}>
                                        {viewCandidate.firstName?.[0]}{viewCandidate.lastName?.[0]}
                                    </div>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                                                {viewCandidate.firstName} {viewCandidate.lastName}
                                            </span>
                                            {viewCandidate.applicationId && (
                                                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 9px', borderRadius: '20px' }}>
                                                    {viewCandidate.applicationId}
                                                </span>
                                            )}
                                            <span style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                                <Archive size={11} /> Archived Candidate
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
                                            Applied for <strong style={{ color: '#334155' }}>{viewCandidate.jobId?.title || 'General Pool'}</strong>
                                            {viewCandidate.jobId?.department ? ` • ${viewCandidate.jobId.department}` : ''}
                                            {viewCandidate.source && (
                                                <span style={{ marginLeft: '8px', color: '#94a3b8' }}>
                                                    via {viewCandidate.source.replace('_', ' ')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Status & Quick Actions */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ 
                                        ...(statusColors[viewCandidate.status] || { bg: '#f1f5f9', color: '#475569' }), 
                                        padding: '5px 14px', 
                                        borderRadius: '20px', 
                                        fontSize: '12px', 
                                        fontWeight: 700,
                                        border: `1px solid ${statusColors[viewCandidate.status]?.color}44`
                                    }}>
                                        {viewCandidate.status}
                                    </span>

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
                                                border: '1px solid #bbf7d0', 
                                                padding: '6px 12px', 
                                                borderRadius: '8px', 
                                                fontSize: '12px', 
                                                fontWeight: 700, 
                                                textDecoration: 'none' 
                                            }}
                                        >
                                            <FileText size={13} /> View Resume <ExternalLink size={11} />
                                        </a>
                                    )}

                                    <button 
                                        className="job-close-btn" 
                                        onClick={() => setViewCandidate(null)}
                                        style={{ fontSize: '20px', padding: '4px 8px', marginLeft: '6px' }}
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Dossier Body with structured form cards */}
                        <div className="job-modal-body" style={{ maxHeight: 'calc(90vh - 140px)', overflowY: 'auto', padding: '20px 24px', background: '#f8fafc' }}>
                            
                            {/* Card 1: Contact Coordinates & Application Details */}
                            <div className="dossier-card">
                                <div className="dossier-sec-hd">
                                    <Mail size={15} color="#166534" /> 1. Contact Coordinates &amp; Application Details
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Email Address</span>
                                        <span className="dossier-val" style={{ wordBreak: 'break-all' }}>{viewCandidate.email || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Primary Phone</span>
                                        <span className="dossier-val">{viewCandidate.phone || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Alternate Phone</span>
                                        <span className="dossier-val">{viewCandidate.personalDetails?.altPhone || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Application Date</span>
                                        <span className="dossier-val">{formatDate(viewCandidate.appliedDate || viewCandidate.createdAt)}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Archived Date</span>
                                        <span className="dossier-val">{formatDate(viewCandidate.archivedAt || viewCandidate.updatedAt)}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Target Job Role</span>
                                        <span className="dossier-val">{viewCandidate.jobId?.title || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Department</span>
                                        <span className="dossier-val">{viewCandidate.jobId?.department || '—'}</span>
                                    </div>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Location / HQ</span>
                                        <span className="dossier-val">{viewCandidate.jobId?.location || 'Headquarters'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Card 2: Personal & Demographic Information */}
                            <div className="dossier-card">
                                <div className="dossier-sec-hd">
                                    <Users size={15} color="#166534" /> 2. Personal Profile &amp; Demographic Information
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                                    <div className="dossier-item-box">
                                        <span className="dossier-lbl">Father / Guardian</span>
                                        <span className="dossier-val">
                                            {viewCandidate.personalDetails?.guardianName ? (
                                                `${viewCandidate.personalDetails.guardianSalutation || ''} ${viewCandidate.personalDetails.guardianName} (${viewCandidate.personalDetails.guardianRelation || 'Guardian'})`
                                            ) : '—'}
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
                                        <span className="dossier-lbl">Religion</span>
                                        <span className="dossier-val">{viewCandidate.personalDetails?.religion || '—'}</span>
                                    </div>
                                </div>

                                {/* Address Breakdown inside Card 2 */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
                                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#166534', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                            <MapPin size={12} /> Present / Communication Address
                                        </div>
                                        <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                                            {!viewCandidate.personalDetails?.currentAddress?.street && !viewCandidate.personalDetails?.currentAddress?.city ? (
                                                <span style={{ color: '#94a3b8' }}>No present address provided</span>
                                            ) : (
                                                <>
                                                    {viewCandidate.personalDetails?.currentAddress?.street ? `${viewCandidate.personalDetails.currentAddress.street}, ` : ''}
                                                    {viewCandidate.personalDetails?.currentAddress?.city ? `${viewCandidate.personalDetails.currentAddress.city}, ` : ''}
                                                    {viewCandidate.personalDetails?.currentAddress?.state || ''} {viewCandidate.personalDetails?.currentAddress?.zip ? `- ${viewCandidate.personalDetails.currentAddress.zip}` : ''}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#475569', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                            <MapPin size={12} /> Permanent Residence Address
                                        </div>
                                        <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: '1.5' }}>
                                            {!viewCandidate.personalDetails?.permanentAddress?.street && !viewCandidate.personalDetails?.permanentAddress?.city ? (
                                                <span style={{ color: '#94a3b8' }}>Same as present address or not specified</span>
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

                            {/* Card 5: Recruiter Evaluation, Rating & Notes */}
                            <div className="dossier-card" style={{ background: '#fcfdfd', borderColor: '#e2e8f0' }}>
                                <div className="dossier-sec-hd">
                                    <Award size={15} color="#166534" /> 5. Recruiter Evaluation &amp; Candidate Record Notes
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {/* Left Side: Rating */}
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
                                    </div>

                                    {/* Right Side: Notes */}
                                    <div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                            Candidate Archive Notes &amp; Observations
                                        </div>
                                        <textarea
                                            rows={4}
                                            className="job-input"
                                            placeholder="Add recruiter observations, interview feedback or archive remarks (auto-saves on blur)..."
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
                                <Trash2 size={13} /> Delete Record
                            </button>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="job-btn-ghost"
                                    onClick={() => {
                                        const id = viewCandidate._id;
                                        setViewCandidate(null);
                                        handleRestore(id);
                                    }}
                                    style={{ color: '#0f766e', borderColor: '#ccfbf1', background: '#f0fdfa' }}
                                >
                                    <RotateCcw size={13} color="#0f766e" /> Restore to Pipeline
                                </button>
                                <button type="button" className="job-btn-primary" onClick={() => setViewCandidate(null)}>
                                    Close Dossier
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddCandidate;
