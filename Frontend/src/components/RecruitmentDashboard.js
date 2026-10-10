import React, { useEffect, useState, useMemo } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { 
    Briefcase, Users, UserCheck, UserX, FileText, Star, CalendarClock, 
    TrendingUp, ArrowRight, Clock, Plus, Calendar, ChevronRight, Video, 
    Phone, MapPin, CheckCircle2, AlertCircle 
} from 'lucide-react';
import './RecruitmentDashboard.css';

const statusColors = {
    Applied: { bg: '#e0f2fe', color: '#0369a1' },
    Shortlisted: { bg: '#fef9c3', color: '#854d0e' },
    'Phone Screen': { bg: '#ede9fe', color: '#6d28d9' },
    Interview: { bg: '#dbeafe', color: '#1d4ed8' },
    Hired: { bg: '#dcfce7', color: '#166534' },
    Rejected: { bg: '#fee2e2', color: '#991b1b' },
    Scheduled: { bg: '#dbeafe', color: '#1d4ed8' },
    Completed: { bg: '#dcfce7', color: '#166534' },
    Cancelled: { bg: '#fee2e2', color: '#991b1b' },
    Pending: { bg: '#fef9c3', color: '#854d0e' },
};

const avatarColors = [
    { bg: '#e0e7ff', color: '#4338ca' },
    { bg: '#fce7f3', color: '#be185d' },
    { bg: '#e0f2fe', color: '#0369a1' },
    { bg: '#dcfce7', color: '#15803d' },
    { bg: '#fef3c7', color: '#b45309' },
    { bg: '#ede9fe', color: '#6d28d9' }
];

const RecruitmentDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalOpenings: 0,
        totalApplications: 0,
        totalHired: 0,
        totalRejected: 0,
        newApplications: 0,
        shortlisted: 0,
        todaysInterviews: 0,
        jobStats: [],
        recentInterviews: [],
        openJobsList: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => { 
        fetchDashboardData(); 
    }, []);

    const fetchDashboardData = async () => {
        try {
            const response = await api.get('/recruitment/dashboard-stats');
            setStats(response.data || {});
        } catch (error) {
            console.error("Error fetching recruitment stats:", error);
        } finally {
            setLoading(false);
        }
    };

    const getAvatarColor = (name = '') => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return avatarColors[Math.abs(hash) % avatarColors.length];
    };

    const Sparkline = ({ data = [2, 4, 3, 6, 5, 8], color }) => {
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

    const funnelTotal = Math.max(
        (stats.newApplications || 0) + 
        (stats.shortlisted || 0) + 
        (stats.todaysInterviews || 0) + 
        (stats.totalHired || 0) + 
        (stats.totalRejected || 0), 
        1
    );

    if (loading) return (
        <div className="page-container" style={{ background: '#f8fafc', height: '100vh', overflow: 'hidden', fontFamily: "'Inter', -apple-system, sans-serif", padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
                .skel { background: linear-gradient(90deg, #f1f5f9 25%, #e9eef5 50%, #f1f5f9 75%); background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: 6px; }
            `}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <div className="skel" style={{ width: '220px', height: '26px', marginBottom: '8px' }} />
                    <div className="skel" style={{ width: '320px', height: '13px' }} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="skel" style={{ width: '130px', height: '36px', borderRadius: '10px' }} />
                    <div className="skel" style={{ width: '130px', height: '36px', borderRadius: '10px' }} />
                </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[...Array(4)].map((_, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f1f5f9', padding: '16px' }}>
                        <div className="skel" style={{ width: '90px', height: '12px', marginBottom: '10px' }} />
                        <div className="skel" style={{ width: '50px', height: '28px' }} />
                    </div>
                ))}
            </div>
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', height: '140px', marginBottom: '24px', padding: '20px' }}>
                <div className="skel" style={{ width: '180px', height: '16px', marginBottom: '16px' }} />
                <div className="skel" style={{ width: '100%', height: '36px', borderRadius: '8px' }} />
            </div>
        </div>
    );

    return (
        <div className="page-container" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif", padding: '28px 24px', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                .ist-tbl { font-family: 'Inter','Poppins','Segoe UI',sans-serif; width: 100%; border-collapse: collapse; }
                .ist-tbl thead tr { background: #fafafa; }
                .ist-tbl thead th { position: sticky; top: 0; z-index: 10; background: #fafafa; font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding: 9px 12px; text-align: left; white-space: nowrap; font-family: 'Inter','Poppins','Segoe UI',sans-serif; border-bottom: 1px solid #f1f5f9; }
                .ist-tbl tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .15s; }
                .ist-tbl tbody tr:hover { background: #fafffe; }
                .ist-tbl tbody td { font-size: 13px; color: #475569; padding: 10px 12px; vertical-align: middle; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
                .ist-tbl tbody tr:last-child { border-bottom: none; }
                
                @keyframes bubble-float-large { 0% { transform: translate(0px, 0px) scale(1); } 30% { transform: translate(-5px, -7px) scale(1.04); } 60% { transform: translate(4px, -4px) scale(0.97); } 100% { transform: translate(0px, 0px) scale(1); } }
                @keyframes bubble-float-small { 0% { transform: translate(0px, 0px) scale(1); } 40% { transform: translate(6px, -4px) scale(0.95); } 75% { transform: translate(-3px, 5px) scale(1.05); } 100% { transform: translate(0px, 0px) scale(1); } }
                .ist-stats-grid > div { position: relative; overflow: hidden; isolation: isolate; cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; }
                .ist-stats-grid > div:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.06); }
                .ist-stats-grid > div::before { content: ''; position: absolute; z-index: 0; width: 90px; height: 90px; border-radius: 50%; opacity: 0.06; right: -26px; bottom: -26px; pointer-events: none; animation: bubble-float-large 5.5s ease-in-out infinite; }
                .ist-stats-grid > div::after { content: ''; position: absolute; z-index: 0; width: 54px; height: 54px; border-radius: 50%; opacity: 0.04; right: 36px; bottom: -20px; pointer-events: none; animation: bubble-float-small 4.2s ease-in-out infinite; }
                .ist-stats-grid > div:nth-child(1)::before, .ist-stats-grid > div:nth-child(1)::after { background: #6366f1; }
                .ist-stats-grid > div:nth-child(2)::before, .ist-stats-grid > div:nth-child(2)::after { background: #0ea5e9; }
                .ist-stats-grid > div:nth-child(3)::before, .ist-stats-grid > div:nth-child(3)::after { background: #10b981; }
                .ist-stats-grid > div:nth-child(4)::before, .ist-stats-grid > div:nth-child(4)::after { background: #f59e0b; }
                .ist-stats-grid > div:nth-child(2)::before { animation-delay: 0.8s; } .ist-stats-grid > div:nth-child(3)::before { animation-delay: 1.5s; } .ist-stats-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
                .ist-stats-grid > div:nth-child(2)::after { animation-delay: 1.2s; } .ist-stats-grid > div:nth-child(3)::after { animation-delay: 0.5s; } .ist-stats-grid > div:nth-child(4)::after { animation-delay: 1.8s; }

                .dash-card { background: #fff; border-radius: 16px; border: 1px solid #f1f5f9; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
                .dash-card-hd { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f1f5f9; }
                .dash-card-title { font-size: 14.5px; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 8px; }
                .dash-card-link { background: none; border: none; color: #3b775e; cursor: pointer; font-size: 12px; font-weight: 600; display: inline-flex; alignItems: center; gap: 4px; transition: color 0.15s; }
                .dash-card-link:hover { color: #2d5a47; }
                .dash-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #f8fafc; transition: background 0.15s; }
                .dash-item:hover { background: #f8fafc; }
                .dash-item:last-child { border-bottom: none; }
            `}</style>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: 0 }}>Recruitment Dashboard</h1>
                    <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', marginBottom: 0 }}>Real-time hiring metrics, pipeline funnel, and interview schedule overview</p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => navigate('/recruitment/jobs/create')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '9px 16px',
                            background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(59,119,94,0.25)',
                            transition: 'opacity 0.15s, transform 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                    >
                        <Plus size={15} /> Post a Job
                    </button>
                    <button
                        onClick={() => navigate('/recruitment/applications/pipeline')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '9px 16px',
                            background: '#fff',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            fontWeight: 600,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                    >
                        <Users size={15} /> Pipeline View
                    </button>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="ist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                    { label: 'Open Positions', val: stats.totalOpenings, sub: 'active job postings', color: '#6366f1', bg: '#eef2ff', data: [2, 4, 3, 5, 4, stats.totalOpenings || 6], link: '/recruitment/jobs/list' },
                    { label: 'Total Applicants', val: stats.totalApplications, sub: 'in database', color: '#0ea5e9', bg: '#f0f9ff', data: [3, 5, 6, 8, 9, stats.totalApplications || 12], link: '/recruitment/candidates/database' },
                    { label: 'Hired Candidates', val: stats.totalHired, sub: 'successfully hired', color: '#10b981', bg: '#ecfdf5', data: [0, 1, 1, 2, 2, stats.totalHired || 2], link: '/recruitment/candidates/database' },
                    { label: "Today's Interviews", val: stats.todaysInterviews, sub: 'scheduled today', color: '#f59e0b', bg: '#fffbeb', data: [1, 2, 1, 3, 2, stats.todaysInterviews || 3], link: '/recruitment/interviews/schedule' },
                ].map((s, i) => (
                    <div 
                        key={i} 
                        onClick={() => navigate(s.link)}
                        style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{s.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '10.5px', fontWeight: 700, color: s.color, background: s.bg, padding: '2px 6px', borderRadius: '6px' }}>
                                <span>▲</span>
                                <span>100%</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.val}</div>
                                <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '5px' }}>
                                    <span style={{ fontWeight: 600, color: s.color }}>{s.sub}</span>
                                </div>
                            </div>
                            <Sparkline data={s.data} color={s.color} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Hiring Pipeline Overview Card */}
            <div className="dash-card" style={{ marginBottom: '24px' }}>
                <div className="dash-card-hd">
                    <div className="dash-card-title">
                        <TrendingUp size={18} color="#3b775e" />
                        <span>Hiring Pipeline Overview</span>
                    </div>
                    <button onClick={() => navigate('/recruitment/applications/pipeline')} className="dash-card-link">
                        View Full Pipeline <ArrowRight size={13} />
                    </button>
                </div>
                <div style={{ padding: '20px' }}>
                    {/* Visual Segment Bar */}
                    <div style={{ display: 'flex', gap: '3px', borderRadius: '10px', overflow: 'hidden', height: '36px', background: '#f1f5f9', padding: '3px' }}>
                        {[
                            { label: 'Applied', val: stats.newApplications, color: '#3b82f6' },
                            { label: 'Shortlisted', val: stats.shortlisted, color: '#8b5cf6' },
                            { label: 'Interview', val: stats.todaysInterviews, color: '#f59e0b' },
                            { label: 'Hired', val: stats.totalHired, color: '#10b981' },
                            { label: 'Rejected', val: stats.totalRejected, color: '#ef4444' },
                        ].map((s, i) => {
                            const pct = Math.max((s.val / funnelTotal) * 100, s.val > 0 ? 8 : 2);
                            return (
                                <div 
                                    key={i} 
                                    title={`${s.label}: ${s.val}`}
                                    style={{ 
                                        background: s.color, 
                                        flex: pct, 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        color: '#fff', 
                                        fontSize: '11px', 
                                        fontWeight: 700, 
                                        borderRadius: '6px',
                                        transition: 'all 0.3s ease', 
                                        minWidth: 0, 
                                        overflow: 'hidden' 
                                    }}
                                >
                                    {pct > 12 ? `${s.label} (${s.val})` : (pct > 6 ? s.val : '')}
                                </div>
                            );
                        })}
                    </div>

                    {/* Legend Badges */}
                    <div style={{ display: 'flex', gap: '20px', marginTop: '16px', flexWrap: 'wrap' }}>
                        {[
                            { label: 'Applied', val: stats.newApplications, color: '#3b82f6' },
                            { label: 'Shortlisted', val: stats.shortlisted, color: '#8b5cf6' },
                            { label: 'Interview', val: stats.todaysInterviews, color: '#f59e0b' },
                            { label: 'Hired', val: stats.totalHired, color: '#10b981' },
                            { label: 'Rejected', val: stats.totalRejected, color: '#ef4444' },
                        ].map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: '#64748b' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color }} />
                                <span>{s.label}:</span>
                                <b style={{ color: '#0f172a', fontWeight: 700 }}>{s.val}</b>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom 2-Column Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
                {/* Left Column: Applications by Job */}
                <div className="dash-card">
                    <div className="dash-card-hd">
                        <div className="dash-card-title">
                            <Briefcase size={17} color="#3b775e" />
                            <span>Applications by Job Position</span>
                        </div>
                        <button onClick={() => navigate('/recruitment/applications/pipeline')} className="dash-card-link">
                            All Applications <ArrowRight size={13} />
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ist-tbl">
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: '20px' }}>Job Position</th>
                                    <th>Applied</th>
                                    <th>Interview</th>
                                    <th>Hired</th>
                                    <th style={{ textAlign: 'right', paddingRight: '20px' }}>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.jobStats && stats.jobStats.length > 0 ? (
                                    stats.jobStats.slice(0, 6).map((job, i) => (
                                        <tr key={i}>
                                            <td style={{ paddingLeft: '20px' }}>
                                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>{job.jobTitle}</div>
                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Open Position</div>
                                            </td>
                                            <td>
                                                <span style={{ ...statusColors.Applied, padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                                                    {job.applied || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ ...statusColors.Interview, padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                                                    {job.interview || 0}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ ...statusColors.Hired, padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                                                    {job.hired || 0}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right', paddingRight: '20px', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                                                {job.totalApplications || 0}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', color: '#94a3b8', padding: '36px 0', fontSize: '12.5px' }}>
                                            No job application data recorded yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right Column: Today's Interviews & Active Jobs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Today's Scheduled Interviews */}
                    <div className="dash-card">
                        <div className="dash-card-hd">
                            <div className="dash-card-title">
                                <Clock size={17} color="#0ea5e9" />
                                <span>Today's Interviews</span>
                            </div>
                            <button onClick={() => navigate('/recruitment/interviews/schedule')} className="dash-card-link">
                                Schedule <ArrowRight size={13} />
                            </button>
                        </div>
                        <div>
                            {stats.recentInterviews && stats.recentInterviews.length > 0 ? (
                                stats.recentInterviews.map((iv, i) => {
                                    const cName = `${iv.candidateId?.firstName || 'Candidate'} ${iv.candidateId?.lastName || ''}`;
                                    const av = getAvatarColor(cName);
                                    const initials = `${(iv.candidateId?.firstName || '')[0] || ''}${(iv.candidateId?.lastName || '')[0] || ''}`.toUpperCase() || 'C';
                                    const sc = statusColors[iv.status] || { bg: '#f1f5f9', color: '#475569' };
                                    return (
                                        <div key={i} className="dash-item">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '11px', flexShrink: 0 }}>
                                                    {initials}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>{cName}</div>
                                                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{iv.jobId?.title || 'No Job Assigned'} · {iv.type || 'Video'}</div>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, marginBottom: '3px' }}>
                                                    {new Date(iv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                                <span style={{ ...sc, padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 600 }}>
                                                    {iv.status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                                    No interviews scheduled for today
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Active Job Openings */}
                    <div className="dash-card">
                        <div className="dash-card-hd">
                            <div className="dash-card-title">
                                <Briefcase size={17} color="#10b981" />
                                <span>Active Job Openings</span>
                            </div>
                            <button onClick={() => navigate('/recruitment/jobs/list')} className="dash-card-link">
                                All Jobs <ArrowRight size={13} />
                            </button>
                        </div>
                        <div>
                            {stats.openJobsList && stats.openJobsList.length > 0 ? (
                                stats.openJobsList.map((job, i) => (
                                    <div key={i} className="dash-item">
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>{job.title}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{job.department || 'General'} · {job.type || 'Full Time'}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '3px' }}>
                                                {job.deadline ? `Due ${new Date(job.deadline).toLocaleDateString()}` : 'No deadline'}
                                            </div>
                                            <span style={{ background: '#ecfdf5', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontSize: '10.5px', fontWeight: 700 }}>
                                                Open
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '12.5px' }}>
                                    No open jobs found
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecruitmentDashboard;
