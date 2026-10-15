import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { ProposalGenerator } from './ProposalGenerator';
import DomesticProposalGenerator from './DomesticProposalGenerator';
import './Proposals.css';

// Status helpers moved outside to avoid re-creation and ensure they are defined
const statusTones = {
    draft: { bg: '#f5f3ff', color: '#7c3aed', dot: '#8b5cf6', label: 'Generated' }, // Purple
    sent: { bg: '#eff6ff', color: '#2563eb', dot: '#3b82f6', label: 'Sent' },
    viewed: { bg: '#fdf4ff', color: '#c026d3', dot: '#d946ef', label: 'Viewed' },
    accepted: { bg: '#f0fdf4', color: '#15803d', dot: '#16a34a', label: 'Accepted' },
    rejected: { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'Rejected' },
    expired: { bg: '#fff7ed', color: '#d97706', dot: '#f59e0b', label: 'Expired' },
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const SHARED_STYLE = `
    @keyframes proposals-skeleton-shimmer {
        0% { background-position: 100% 0; }
        100% { background-position: -100% 0; }
    }
    .proposals-skeleton {
        background: linear-gradient(90deg, #eef2f7 25%, #f8fafc 37%, #eef2f7 63%);
        background-size: 400% 100%;
        animation: proposals-skeleton-shimmer 1.4s ease infinite;
    }
    @keyframes proposals-bubble-float-large {
        0% { transform: translate(0px, 0px) scale(1); }
        30% { transform: translate(-5px, -7px) scale(1.04); }
        60% { transform: translate(4px, -4px) scale(0.97); }
        100% { transform: translate(0px, 0px) scale(1); }
    }
    @keyframes proposals-bubble-float-small {
        0% { transform: translate(0px, 0px) scale(1); }
        35% { transform: translate(6px, -9px) scale(1.06); }
        65% { transform: translate(-4px, -3px) scale(0.95); }
        100% { transform: translate(0px, 0px) scale(1); }
    }
    .proposals-metrics-grid > div {
        position: relative;
        overflow: hidden;
        isolation: isolate;
    }
    .proposals-metrics-grid > div::before {
        content: '';
        position: absolute;
        z-index: 0;
        width: 90px;
        height: 90px;
        border-radius: 50%;
        background: #667eea;
        opacity: 0.06;
        right: -26px;
        bottom: -26px;
        pointer-events: none;
        animation: proposals-bubble-float-large 5.5s ease-in-out infinite;
    }
    .proposals-metrics-grid > div::after {
        content: '';
        position: absolute;
        z-index: 0;
        width: 54px;
        height: 54px;
        border-radius: 50%;
        background: #667eea;
        opacity: 0.04;
        right: 36px;
        bottom: -20px;
        pointer-events: none;
        animation: proposals-bubble-float-small 4.2s ease-in-out infinite;
    }
    .proposals-metrics-grid > div:nth-child(1)::before,
    .proposals-metrics-grid > div:nth-child(1)::after { background: #667eea; }
    .proposals-metrics-grid > div:nth-child(2)::before,
    .proposals-metrics-grid > div:nth-child(2)::after { background: #a8e63d; }
    .proposals-metrics-grid > div:nth-child(3)::before,
    .proposals-metrics-grid > div:nth-child(3)::after { background: #3b82f6; }
    .proposals-metrics-grid > div:nth-child(4)::before,
    .proposals-metrics-grid > div:nth-child(4)::after { background: #16a34a; }
    
    .prop-action-btn { 
        width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent; 
        cursor: pointer; display: flex; align-items: center; justify-content: center; 
        transition: background .15s; 
    }
    .prop-btn-primary { 
        padding: 9px 20px; border: none; border-radius: 10px; 
        background: linear-gradient(135deg,#3b775e 0%,#56a07a 100%); 
        color: #fff; font-size: 12.5px; font-weight: 700; cursor: pointer; 
        font-family: 'Inter',sans-serif; transition: opacity .15s; 
        display: flex; align-items: center; gap: 6px; 
    }
    .prop-btn-primary:hover { opacity: .88; }
    
    .dropdown-item-btn {
        width: 100%;
        text-align: left;
        padding: 8px;
        border: none;
        background: transparent;
        cursor: pointer;
        font-size: 12px;
        transition: background .12s;
        border-radius: 4px;
        color: #374151;
    }
    .dropdown-item-btn:hover {
        background: #f3f4f6;
    }
    
    .filter-option-btn {
        display: block; width: 100%; text-align: left; padding: 7px 10px; border-radius: 8px; border: none;
        background: transparent; font-size: 12px; cursor: pointer; font-family: 'Inter','Poppins','Segoe UI',sans-serif;
        transition: background 0.12s;
    }
    .filter-option-btn:hover:not(.active) { background: #f8fafc !important; }
    
    .prop-tbl thead th { 
        font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; 
        letter-spacing: .06em; padding: 10px 16px; text-align: left; white-space: nowrap; 
    }
    .prop-tbl tbody td { font-size: 13px; color: #374151; padding: 12px 16px; vertical-align: middle; }
    .prop-tbl tbody tr { border-bottom: 1px solid #f3f4f6; transition: background .12s; }
    .prop-tbl tbody tr:hover { background: #f9fafb; }
    
    .prop-pagination-btn {
        width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e2e8f0;
        background: #fff; color: #475569; font-size: 13px; font-weight: 600;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all .15s; font-family: 'Inter',sans-serif; padding: 0;
    }
    .prop-pagination-btn:hover:not(:disabled) { background: #f8fafc; color: #0f172a; border-color: #cbd5e1; }
    .prop-pagination-btn.active { background: #3b775e; color: #fff; border-color: #3b775e; }
    .prop-pagination-btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

function Proposals() {
    const { hasPermission, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [proposals, setProposals] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [isInternationalGeneratorOpen, setIsInternationalGeneratorOpen] = useState(false);
    const [isDomesticGeneratorOpen, setIsDomesticGeneratorOpen] = useState(false);
    const [editingProposalId, setEditingProposalId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [recordsPerPage] = useState(10);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [initialTab, setInitialTab] = useState('form');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentEditData, setCurrentEditData] = useState(null);

    // Filter states
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    
    const [openStatusDrop, setOpenStatusDrop] = useState(null);
    const [statusDropPos, setStatusDropPos] = useState({ top: 0, left: 0 });
    const statusDropRef = useRef(null);
    const [openFilterDrop, setOpenFilterDrop] = useState(null);
    const filterDropRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            setActiveDropdown(null);
            if (statusDropRef.current && !statusDropRef.current.contains(e.target)) {
                setOpenStatusDrop(null);
            }
            if (filterDropRef.current && !filterDropRef.current.contains(e.target)) {
                setOpenFilterDrop(null);
            }
        };
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Reset page to 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatus, filterDate, filterEndDate]);

    const fetchProposals = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/proposals');
            setProposals(response.data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching proposals:', error);
            setLoading(false);
        }
    }, []);

    const hasAccess = hasPermission('proposals', 'read') || hasPermission('proposals', 'create') ||
        hasPermission('proposals', 'update') || hasPermission('proposals', 'delete');

    useEffect(() => {
        if (hasAccess) {
            fetchProposals();
        }
    }, [fetchProposals, hasAccess]);

    // Handle auto-open generator if passed via location state
    useEffect(() => {
        if (location.state?.createProposal && hasPermission('proposals', 'create')) {
            setIsDomesticGeneratorOpen(true);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, hasPermission]);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this proposal?')) {
            try {
                await api.delete(`/proposals/${id}`);
                fetchProposals();
                alert('Proposal deleted successfully');
            } catch (error) {
                alert('Error deleting proposal');
            }
        }
    };

    const handleEdit = (id) => {
        const prop = proposals.find(p => p._id === id);
        if (prop) {
            setCurrentEditData({ ...prop });
            setIsEditModalOpen(true);
        }
    };

    const isInternationalProposal = (prop) => {
        if (!prop) return false;
        if (prop.proposalType === 'international') return true;
        if (prop.proposalType === 'domestic') return false;
        // Fallback detection for legacy records
        if (prop.pdfEditorState?.savedTextBoxes?.length > 0 || prop.pdfEditorState?.savedPageSequence?.length > 0) {
            return true;
        }
        return false;
    };

    const handleRegenerate = (id) => {
        setEditingProposalId(id);
        setIsReadOnly(false); // Allow editing
        setInitialTab('form'); // Start in edit mode
        const prop = proposals.find(p => p._id === id);
        if (isInternationalProposal(prop)) {
             setIsInternationalGeneratorOpen(true);
        } else {
             setIsDomesticGeneratorOpen(true);
        }
    };

    const handleView = (id) => {
        setEditingProposalId(id);
        setIsReadOnly(true); // Read-only mode
        setInitialTab('preview'); // Start in preview mode
        const prop = proposals.find(p => p._id === id);
        if (isInternationalProposal(prop)) {
             setIsInternationalGeneratorOpen(true);
        } else {
             setIsDomesticGeneratorOpen(true);
        }
    };

    const handleStatusChange = async (id, newStatus) => {
        // Optimistic update
        const originalProposals = [...proposals];
        setProposals(prev => prev.map(p => p._id === id ? { ...p, status: newStatus } : p));

        try {
            await api.patch(`/proposals/${id}/status`, { status: newStatus });
            // Optionally fetch in background to ensure sync
            // fetchProposals(); 
        } catch (error) {
            setProposals(originalProposals);
            alert('Error updating status');
        }
    };

    const downloadPDF = async (id) => {
        try {
            // Fetch proposal to see if it has a custom generated base64 PDF
            // Added timestamp to bypass browser caching when regenerating proposal
            const propRes = await api.get(`/proposals/${id}?t=${Date.now()}`);
            const titleName = propRes.data?.title?.trim() || propRes.data?.proposalNumber || `proposal-${id}`;
            const safeFileName = `${titleName.replace(/[/\\?%*:|"<>]/g, '_').trim()}.pdf`;

            if (propRes.data && propRes.data.pdfEditorState && propRes.data.pdfEditorState.base64Pdf) {
                const link = document.createElement('a');
                link.href = propRes.data.pdfEditorState.base64Pdf;
                link.setAttribute('download', safeFileName);
                document.body.appendChild(link);
                link.click();
                link.remove();
                return;
            }

            // Fallback to backend generated PDF template
            const response = await api.get(`/proposals/${id}/pdf`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', safeFileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Error downloading PDF');
        }
    };

    const filteredProposals = proposals.filter(p => {
        const matchesSearch = p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.clientEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.proposalNumber?.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Use exact match for backend status code (e.g., 'draft', 'sent')
        const matchesStatus = filterStatus ? (p.status === filterStatus) : true;
        
        let matchesDate = true;
        if (p.date && (filterDate || filterEndDate)) {
            const propDate = new Date(p.date).setHours(0, 0, 0, 0);
            if (filterDate) {
                const start = new Date(filterDate).setHours(0, 0, 0, 0);
                if (propDate < start) matchesDate = false;
            }
            if (filterEndDate) {
                const end = new Date(filterEndDate).setHours(0, 0, 0, 0);
                if (propDate > end) matchesDate = false;
            }
        }
        
        return matchesSearch && matchesStatus && matchesDate;
    });

    // Access Control Check (Hooks above this!)
    if (!hasAccess) {
        return (
            <div className="page-container" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '48px', textAlign: 'center', maxWidth: '420px', margin: '60px auto' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>Access Denied</div>
                    <p style={{ fontSize: '13px', color: '#9ca3af' }}>You do not have permission to access the Proposals section.</p>
                </div>
            </div>
        );
    }

    const totalProposals = proposals.length;
    const draftCount = proposals.filter(p => p.status === 'draft').length;
    const sentCount = proposals.filter(p => p.status === 'sent').length;
    const acceptedCount = proposals.filter(p => p.status === 'accepted').length;

    // Pagination logic
    const indexOfLastRecord = currentPage * recordsPerPage;
    const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
    const currentProposals = filteredProposals.slice(indexOfFirstRecord, indexOfLastRecord);
    const totalPages = Math.ceil(filteredProposals.length / recordsPerPage);

    if (loading) {
        return (
            <div className="page-container" style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', -apple-system, sans-serif" }}>
                <style>{SHARED_STYLE}</style>
                <div style={{ textAlign: 'center', padding: '100px', color: '#6b7280' }}>Loading proposals...</div>
            </div>
        );
    }

    // List View
    return (
        <div className="page-container" style={{ background: '#f8fafc', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'Inter', -apple-system, sans-serif" }}>
            <style>{SHARED_STYLE}</style>

            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <div style={{ fontSize: '22px', fontWeight: 600, color: '#111827', letterSpacing: '-0.02em' }}>Generate Proposals</div>
                    <div style={{ fontSize: '13px', color: '#9ca3af', marginTop: '2px' }}>Create and manage client proposals</div>
                </div>
                {hasPermission('proposals', 'create') && (
                    <div style={{ position: 'relative' }}>
                        <button className="prop-btn-primary" onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === 'generate' ? null : 'generate'); }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                            Generate Proposal
                        </button>
                        {activeDropdown === 'generate' && (
                            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '8px', background: '#fff', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', zIndex: 100, minWidth: '230px', padding: '6px', overflow: 'hidden' }}>
                                <div style={{ padding: '8px 10px 6px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Template</div>
                                
                                <button onClick={() => { setEditingProposalId(null); setIsReadOnly(false); setInitialTab('form'); setIsDomesticGeneratorOpen(true); setActiveDropdown(null); }} className="dropdown-item-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', width: '100%', marginBottom: '2px' }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-3"/><path d="M9 9v.01"/><path d="M9 13v.01"/><path d="M9 17v.01"/></svg>
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>Domestic</div>
                                        <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '2px' }}>Standard Web Proposal</div>
                                    </div>
                                </button>
                                
                                <button onClick={() => { setEditingProposalId(null); setIsReadOnly(false); setInitialTab('form'); setIsInternationalGeneratorOpen(true); setActiveDropdown(null); }} className="dropdown-item-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', width: '100%' }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>International</div>
                                        <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '2px' }}>Advanced PDF Editor</div>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Metric Cards */}
            <div className="proposals-metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Proposals', value: totalProposals, color: '#667eea', note: 'Across all clients', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>, filter: '' },
                    { label: 'Generated', value: draftCount, color: '#7c3aed', note: 'To be refined', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>, filter: 'draft' },
                    { label: 'Sent', value: sentCount, color: '#3b82f6', note: 'Awaiting response', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2 11 13" /><path d="M22 2 15 22 11 13 2 9 22 2z" /></svg>, filter: 'sent' },
                    { label: 'Accepted', value: acceptedCount, color: '#16a34a', note: 'Won proposals', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>, filter: 'accepted' },
                ].map(({ label, value, color, note, icon, filter }) => {
                    const isSelected = filterStatus === filter;
                    return (
                        <div
                            key={label}
                            style={{
                                background: 'white',
                                padding: '14px 16px 10px',
                                borderRadius: '12px',
                                border: isSelected ? `2px solid ${color}` : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'all 0.3s',
                                overflow: 'hidden',
                                position: 'relative'
                            }}
                            onClick={() => {
                                setFilterStatus(isSelected ? '' : filter);
                                setCurrentPage(1);
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            {/* Label row */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
                                <div style={{ color }}>{icon}</div>
                            </div>
                            {/* Value */}
                            <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px' }}>{value}</div>
                            {/* Bottom note */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '9.5px', color: '#94a3b8' }}>{note}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Table card */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid #f3f4f6', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', background: '#fafafa', borderRadius: '16px 16px 0 0', position: 'relative', zIndex: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', flex: '1', minWidth: '220px', maxWidth: '320px', transition: 'all 0.2s' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                        <input type="text" placeholder="Search proposals…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '12px', color: '#0f172a', background: 'transparent', width: '100%', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500 }} />
                    </div>

                    {/* Filters — card dropdowns */}
                    <div ref={filterDropRef} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            {/* Status */}
                            {(() => {
                                const label = filterStatus ? (statusTones[filterStatus]?.label || filterStatus) : 'All Statuses';
                                const isActive = !!filterStatus;
                                return (
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => { setOpenFilterDrop(p => p === 'status' ? null : 'status'); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: `1px solid ${isActive ? '#3b775e' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px', color: isActive ? '#3b775e' : '#475569', background: isActive ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                        >
                                            {label}
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                                        </button>
                                        {openFilterDrop === 'status' && (
                                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '10px', minWidth: '200px' }}>
                                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 4px' }}>Status</div>
                                                <button
                                                    onClick={() => { setFilterStatus(''); setOpenFilterDrop(null); }}
                                                    className={`filter-option-btn ${!filterStatus ? 'active' : ''}`}
                                                    style={{ background: !filterStatus ? '#f0fdf4' : '', color: !filterStatus ? '#15803d' : '#475569', fontWeight: !filterStatus ? 600 : 400 }}
                                                >All Statuses</button>
                                                {['draft', 'sent', 'accepted', 'rejected'].map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => { setFilterStatus(s); setOpenFilterDrop(null); }}
                                                        className={`filter-option-btn ${filterStatus === s ? 'active' : ''}`}
                                                        style={{ background: filterStatus === s ? '#f0fdf4' : '', color: filterStatus === s ? '#15803d' : '#475569', fontWeight: filterStatus === s ? 600 : 400 }}
                                                    >{statusTones[s].label}</button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            
                            {/* Date Filter */}
                            {(() => {
                                const label = filterDate && filterEndDate
                                    ? `${new Date(filterDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(filterEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                    : filterDate
                                        ? `>= ${new Date(filterDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                        : filterEndDate
                                            ? `<= ${new Date(filterEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                                            : 'Any Date';
                                const isActive = !!filterDate || !!filterEndDate;
                                return (
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => { setOpenFilterDrop(p => p === 'date' ? null : 'date'); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: `1px solid ${isActive ? '#3b775e' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px', color: isActive ? '#3b775e' : '#475569', background: isActive ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                        >
                                            {label}
                                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                                        </button>
                                        {openFilterDrop === 'date' && (
                                            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '12px', minWidth: '200px' }}>
                                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 2px' }}>Start Date</div>
                                                <input
                                                    type="date"
                                                    value={filterDate}
                                                    onChange={e => setFilterDate(e.target.value)}
                                                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: 'none', marginBottom: '8px', boxSizing: 'border-box' }}
                                                />
                                                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 2px' }}>End Date</div>
                                                <input
                                                    type="date"
                                                    value={filterEndDate}
                                                    onChange={e => setFilterEndDate(e.target.value)}
                                                    style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }}
                                                />
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button onClick={() => setOpenFilterDrop(null)} style={{ flex: 1, padding: '6px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#3b775e', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>Apply</button>
                                                    {(filterDate || filterEndDate) && (
                                                        <button
                                                            onClick={() => {
                                                                setFilterDate('');
                                                                setFilterEndDate('');
                                                                setOpenFilterDrop(null);
                                                            }}
                                                            style={{ flex: 1, padding: '6px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc', color: '#dc2626', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                        
                        {(searchTerm || filterStatus || filterDate || filterEndDate) && (
                            <button className="prop-action-btn" onClick={() => { setSearchTerm(''); setFilterStatus(''); setFilterDate(''); setFilterEndDate(''); }} style={{ padding: '7px 12px', fontSize: '11px', width: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#475569', fontWeight: 600 }}>Clear</button>
                        )}

                    <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 600 }}>
                        {filteredProposals.length} of {proposals.length}
                    </span>
                </div>

                <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                    <table className="prop-tbl" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <tr>
                                <th>#</th>
                                <th>Title</th>
                                <th>Client</th>
                                <th>Total</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Generated By</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentProposals.length === 0 ? (
                                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>No proposals found</td></tr>
                            ) : (
                                currentProposals.map((proposal, idx) => {
                                    const st = statusTones[proposal.status] || statusTones.draft;
                                    return (
                                        <tr key={proposal._id}>
                                            <td style={{ fontWeight: 600, color: '#94a3b8', fontSize: '10px' }}>{indexOfFirstRecord + idx + 1}</td>
                                            <td style={{ fontWeight: 600 }}>{proposal.title}</td>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{proposal.clientName}</div>
                                                <div style={{ fontSize: '11px', color: '#6b7280' }}>{proposal.clientEmail}</div>
                                            </td>
                                            <td style={{ fontWeight: 600 }}>₹{proposal.total?.toLocaleString()}</td>
                                            <td>{fmt(proposal.date)}</td>
                                            <td>
                                                <div ref={openStatusDrop === proposal._id ? statusDropRef : null} style={{ display: 'inline-block', position: 'relative' }}>
                                                    <button
                                                        onClick={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setStatusDropPos({ top: rect.bottom + 5, left: rect.left });
                                                            setOpenStatusDrop(p => p === proposal._id ? null : proposal._id);
                                                        }}
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            background: st.bg,
                                                            color: st.color,
                                                            borderRadius: '999px',
                                                            padding: '4px 10px',
                                                            fontSize: '11px',
                                                            fontWeight: 700,
                                                            border: `1px solid ${st.dot}40`,
                                                            cursor: 'pointer',
                                                            fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                                                        {st.label || proposal.status}
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                                                    </button>
                                                    {openStatusDrop === proposal._id && (
                                                        <div style={{ position: 'fixed', top: statusDropPos.top, left: statusDropPos.left, zIndex: 9999, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '8px', minWidth: '130px' }}>
                                                            {['draft', 'sent', 'accepted', 'rejected'].map(k => [k, statusTones[k]]).map(([statusKey, cfg]) => (
                                                                <button
                                                                    key={statusKey}
                                                                    onClick={() => {
                                                                        setOpenStatusDrop(null);
                                                                        if (proposal.status !== statusKey) handleStatusChange(proposal._id, statusKey);
                                                                    }}
                                                                    className={`filter-option-btn ${proposal.status === statusKey ? 'active' : ''}`}
                                                                    style={{
                                                                        background: proposal.status === statusKey ? cfg.bg : '', color: proposal.status === statusKey ? cfg.color : '#475569', fontSize: '11px', fontWeight: proposal.status === statusKey ? 700 : 500
                                                                    }}
                                                                >
                                                                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, marginRight: '8px' }}></span>
                                                                    {cfg.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#475569' }}>
                                                        {proposal.createdBy?.firstName?.[0] || 'U'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: '12.5px' }}>
                                                            {proposal.createdBy ? `${proposal.createdBy.firstName} ${proposal.createdBy.lastName}` : 'System'}
                                                        </div>
                                                        <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            {proposal.createdBy?.role?.name || 'Staff'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', position: 'relative' }}>
                                                    <button className="prop-action-btn" onClick={() => handleView(proposal._id)} title="View">
                                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                    </button>
                                                    {hasPermission('proposals', 'update') && (
                                                        <button className="prop-action-btn" onClick={() => downloadPDF(proposal._id)} title="Download">
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                                        </button>
                                                    )}
                                                    {(hasPermission('proposals', 'update') || hasPermission('proposals', 'delete')) && (
                                                        <div style={{ position: 'relative' }}>
                                                            <button className="prop-action-btn" onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === proposal._id ? null : proposal._id); }}>
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                                            </button>
                                                            {activeDropdown === proposal._id && (
                                                                <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#fff', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', zIndex: 100, minWidth: '120px', padding: '4px' }}>
                                                                    {hasPermission('proposals', 'update') && <button onClick={() => handleEdit(proposal._id)} className="dropdown-item-btn">Edit Details</button>}
                                                                    {hasPermission('proposals', 'update') && <button onClick={() => handleRegenerate(proposal._id)} className="dropdown-item-btn">Regenerate</button>}
                                                                    {hasPermission('proposals', 'update') && proposal.status === 'draft' && <button onClick={() => handleStatusChange(proposal._id, 'sent')} className="dropdown-item-btn" style={{ color: '#2563eb' }}>Mark as Sent</button>}
                                                                    {hasPermission('proposals', 'delete') && proposal.status !== 'accepted' && proposal.status !== 'rejected' && <button onClick={() => handleDelete(proposal._id)} className="dropdown-item-btn" style={{ color: '#dc2626' }}>Delete</button>}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600 }}>
                            Page {currentPage} of {totalPages}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                                className="prop-pagination-btn"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                style={{ padding: '6px 12px', width: 'auto' }}
                            >
                                ← Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        className={`prop-pagination-btn ${pageNum === currentPage ? 'active' : ''}`}
                                        onClick={() => setCurrentPage(pageNum)}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                className="prop-pagination-btn"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                style={{ padding: '6px 12px', width: 'auto' }}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Proposal Modal */}
            {isEditModalOpen && currentEditData && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '450px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: 600, color: '#111827' }}>Edit Proposal Details</h2>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: '#374151' }}>Title</label>
                            <input type="text" value={currentEditData.title} onChange={e => setCurrentEditData({ ...currentEditData, title: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: '#374151' }}>Client Name</label>
                                <input type="text" value={currentEditData.clientName} onChange={e => setCurrentEditData({ ...currentEditData, clientName: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: '#374151' }}>Client Email</label>
                                <input type="email" value={currentEditData.clientEmail || ''} onChange={e => setCurrentEditData({ ...currentEditData, clientEmail: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: '#374151' }}>Total Amount</label>
                            <input type="number" value={currentEditData.total} onChange={e => setCurrentEditData({ ...currentEditData, total: Number(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }} />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 500, color: '#374151' }}>Status</label>
                            <select value={currentEditData.status} onChange={e => setCurrentEditData({ ...currentEditData, status: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}>
                                <option value="draft">Generated</option>
                                <option value="sent">Sent</option>
                                <option value="accepted">Accepted</option>
                                <option value="rejected">Rejected</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button onClick={() => setIsEditModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 500, color: '#374151' }}>Cancel</button>
                            <button onClick={async () => {
                                try {
                                    const res = await api.put(`/proposals/${currentEditData._id}`, currentEditData);
                                    setProposals(prev => prev.map(p => p._id === res.data._id ? res.data : p));
                                    setIsEditModalOpen(false);
                                } catch (e) {
                                    alert('Error updating proposal');
                                }
                            }} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 500 }}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Proposal Generator Modals */}
            <DomesticProposalGenerator
                isOpen={isDomesticGeneratorOpen}
                proposalId={editingProposalId}
                initialTab={initialTab}
                readOnly={isReadOnly}
                onClose={() => {
                    setIsDomesticGeneratorOpen(false);
                    setEditingProposalId(null);
                    setIsReadOnly(false);
                }}
                onSuccess={(data) => {
                    setIsDomesticGeneratorOpen(false);
                    setEditingProposalId(null);
                    setIsReadOnly(false);
                    if (data) {
                        setProposals(prev => {
                            const exists = prev.find(p => p._id === data._id);
                            if (exists) return prev.map(p => p._id === data._id ? data : p);
                            return [data, ...prev];
                        });
                    } else {
                        fetchProposals();
                    }
                }}
            />

            <ProposalGenerator
                isOpen={isInternationalGeneratorOpen}
                proposalId={editingProposalId}
                initialTab={initialTab}
                readOnly={isReadOnly}
                onClose={() => {
                    setIsInternationalGeneratorOpen(false);
                    setEditingProposalId(null);
                    setIsReadOnly(false);
                }}
                onSuccess={(data) => {
                    setIsInternationalGeneratorOpen(false);
                    setEditingProposalId(null);
                    setIsReadOnly(false);
                    if (data) {
                        setProposals(prev => {
                            const exists = prev.find(p => p._id === data._id);
                            if (exists) return prev.map(p => p._id === data._id ? data : p);
                            return [data, ...prev];
                        });
                    } else {
                        fetchProposals();
                    }
                }}
            />
        </div>
    );
}

export default Proposals;
