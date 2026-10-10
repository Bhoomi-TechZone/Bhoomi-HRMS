import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';
import { Plus, Search, FileText, Eye, Send, CheckCircle, XCircle, X, Printer, Download, Mail } from 'lucide-react';
import './RecruitmentDashboard.css';

const printStyle = `
@media print {
  body * { visibility: hidden !important; }
  #offer-letter-print, #offer-letter-print * { visibility: visible !important; }
  #offer-letter-print {
    position: fixed !important; left: 0 !important; top: 0 !important;
    width: 100% !important; height: auto !important; z-index: 99999 !important;
    background: white !important; overflow: visible !important;
  }
  .offer-page { page-break-after: always; break-after: page; }
  .offer-page:last-child { page-break-after: avoid; break-after: avoid; }
  @page { margin: 0; size: A4 portrait; }
}
`;

const offerStatusColors = {
    Draft:    { bg: '#f1f5f9', color: '#475569' },
    Sent:     { bg: '#dbeafe', color: '#1d4ed8' },
    Accepted: { bg: '#dcfce7', color: '#166534' },
    Rejected: { bg: '#fee2e2', color: '#991b1b' },
    Expired:  { bg: '#fef9c3', color: '#854d0e' },
};

const emptyForm = {
    candidateId: '', position: '', salary: '', joiningDate: '', offerExpiry: '',
    department: '', reportingTo: '', notes: '', status: 'Draft',
    candidateAddress: '', workingHours: '10:00 AM – 7:00 PM',
    probationPeriod: '1 Month', attendanceBonus: '2000', performanceBonus: '2000',
    hrManagerName: '', hrContact: '',
    employmentType: 'Full Time', noticePeriod: '30 Days', workLocation: '',
};

const RecruitOfferLetters = () => {
    const [candidates, setCandidates] = useState([]);
    const [offerLetters, setOfferLetters] = useState([]);
    const [company, setCompany] = useState({ companyName: 'Your Company', website: '', address: '', logo: '/logo.png' });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [pdfLoading, setPdfLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [previewLetter, setPreviewLetter] = useState(null);
    const [formData, setFormData] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [sendingEmail, setSendingEmail] = useState(null); // letter._id being emailed
    const [emailToast, setEmailToast] = useState(null); // { type: 'success'|'error', msg }

    useEffect(() => { fetchOfferLetters(); fetchCandidates(); fetchCompany(); }, []);

    const fetchOfferLetters = async () => {
        try {
            const res = await api.get('/recruitment/offer-letters');
            setOfferLetters(res.data);
        } catch (err) { console.error('Failed to load offer letters', err); }
        finally { setLoading(false); }
    };

    const fetchCompany = async () => {
        try {
            const res = await api.get('/settings/company');
            setCompany(res.data);
        } catch (err) { /* use defaults */ }
    };

    const fetchCandidates = async () => {
        try {
            const res = await api.get('/recruitment/candidates');
            setCandidates(res.data.filter(c => c.status === 'Hired'));
        } catch (err) { console.error('Failed to load candidates', err); }
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post('/recruitment/offer-letters', {
                ...formData,
                salary:           Number(formData.salary),
                attendanceBonus:  Number(formData.attendanceBonus) || 0,
                performanceBonus: Number(formData.performanceBonus) || 0,
                employmentType:   formData.employmentType || 'Full Time',
                noticePeriod:     formData.noticePeriod || '30 Days',
                workLocation:     formData.workLocation,
            });
            setOfferLetters(prev => [res.data, ...prev]);
            setShowModal(false);
            setFormData(emptyForm);
        } catch (err) { console.error(err); alert('Failed to generate offer letter'); }
        finally { setSaving(false); }
    };

    const handleStatusChange = async (id, status) => {
        try {
            await api.put(`/recruitment/offer-letters/${id}`, { status });
            setOfferLetters(prev => prev.map(l => l._id === id ? { ...l, status } : l));
            if (previewLetter?._id === id) setPreviewLetter(prev => ({ ...prev, status }));
        } catch (err) { console.error(err); alert('Failed to update status'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this offer letter?')) return;
        try {
            await api.delete(`/recruitment/offer-letters/${id}`);
            setOfferLetters(prev => prev.filter(l => l._id !== id));
            if (previewLetter?._id === id) setPreviewLetter(null);
        } catch (err) { alert('Failed to delete offer letter'); }
    };

    const handleSendEmail = async (letter) => {
        const name = getName(letter);
        const email = getEmail(letter);
        if (!email) { setEmailToast({ type: 'error', msg: `${name} has no email address.` }); setTimeout(() => setEmailToast(null), 4000); return; }
        if (!window.confirm(`Send offer letter email to ${name} (${email})?`)) return;
        setSendingEmail(letter._id);
        try {
            const res = await api.post(`/recruitment/offer-letters/${letter._id}/send-email`);
            // Update status in state if it changed to Sent
            if (res.data.status) {
                setOfferLetters(prev => prev.map(l => l._id === letter._id ? { ...l, status: res.data.status } : l));
                if (previewLetter?._id === letter._id) setPreviewLetter(prev => ({ ...prev, status: res.data.status }));
            }
            setEmailToast({ type: 'success', msg: `✅ Offer letter emailed to ${email}` });
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to send email';
            setEmailToast({ type: 'error', msg: `❌ ${msg}` });
        } finally {
            setSendingEmail(null);
            setTimeout(() => setEmailToast(null), 5000);
        }
    };

    const getName  = l => `${l.candidateId?.firstName || ''} ${l.candidateId?.lastName || ''}`.trim();
    const getEmail = l => l.candidateId?.email || '';
    const getPhone = l => l.candidateId?.phone || '';

    const filtered = offerLetters.filter(l => {
        const name = getName(l).toLowerCase();
        const matchSearch = name.includes(searchTerm.toLowerCase()) || (l.position || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchSearch && (statusFilter === 'All' || l.status === statusFilter);
    });

    const stats = {
        total:    offerLetters.length,
        sent:     offerLetters.filter(l => l.status === 'Sent').length,
        accepted: offerLetters.filter(l => l.status === 'Accepted').length,
        rejected: offerLetters.filter(l => l.status === 'Rejected').length,
    };

    /* ─────────────────────────────────────────────────────
       PDF Download using html2canvas + jsPDF
    ───────────────────────────────────────────────────── */
    const handleDownloadPDF = async () => {
        setPdfLoading(true);
        const removed = [];
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: html2canvas } = await import('html2canvas');

            // Wait for all images to settle (load or error)
            const allImgs = Array.from(document.querySelectorAll('.offer-page img'));
            await Promise.all(allImgs.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                    setTimeout(resolve, 3000);
                });
            }));
            await new Promise(res => setTimeout(res, 100));

            // NUCLEAR: replace loaded images with data URLs, remove broken ones
            const imgs = Array.from(document.querySelectorAll('.offer-page img'));
            for (const img of imgs) {
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                if (img.complete && w > 0 && h > 0) {
                    try {
                        const cvs = document.createElement('canvas');
                        cvs.width = w;
                        cvs.height = h;
                        cvs.getContext('2d').drawImage(img, 0, 0);
                        removed.push({ type: 'src', img, oldSrc: img.src });
                        img.src = cvs.toDataURL('image/png');
                    } catch (e) {
                        removed.push({ type: 'remove', parent: img.parentNode, img, next: img.nextSibling });
                        img.parentNode.removeChild(img);
                    }
                } else {
                    if (img.parentNode) {
                        removed.push({ type: 'remove', parent: img.parentNode, img, next: img.nextSibling });
                        img.parentNode.removeChild(img);
                    }
                }
            }

            const pages = document.querySelectorAll('.offer-page');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfW = pdf.internal.pageSize.getWidth();
            for (let i = 0; i < pages.length; i++) {
                const canvas = await html2canvas(pages[i], {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    imageTimeout: 0,
                    onclone: (clonedDoc) => {
                        clonedDoc.querySelectorAll('img').forEach(img => {
                            const rect = img.getBoundingClientRect();
                            if (rect.width === 0 || rect.height === 0) img.remove();
                        });
                    },
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                const pdfH = (canvas.height * pdfW) / canvas.width;
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
            }
            const name = previewLetter ? getName(previewLetter) : 'offer-letter';
            pdf.save(`${name.replace(/\s+/g, '-')}-offer-letter.pdf`);
        } catch (err) { console.error(err); alert('PDF generation failed'); }
        finally {
            // Restore everything
            for (const entry of removed) {
                if (entry.type === 'src') {
                    entry.img.src = entry.oldSrc;
                } else if (entry.type === 'remove') {
                    try {
                        if (entry.next && entry.next.parentNode === entry.parent) {
                            entry.parent.insertBefore(entry.img, entry.next);
                        } else {
                            entry.parent.appendChild(entry.img);
                        }
                    } catch (e) { /* parent unmounted */ }
                }
            }
            setPdfLoading(false);
        }
    };

    /* ─────────────────────────────────────────────────────
       Shared LetterHead / Footer used on every page
    ───────────────────────────────────────────────────── */
    const LetterHead = () => (
        <div style={{ position: 'relative', background: '#fff', borderBottom: '2px solid #e5e7eb' }}>
            {/* Top-right decorative corner */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0,
                borderTop: '70px solid #111827', borderLeft: '70px solid transparent' }} />
            <div style={{ position: 'absolute', top: 8, right: 0, width: 0, height: 0,
                borderTop: '56px solid #16a34a', borderLeft: '56px solid transparent' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 28px 12px' }}>
                <img src={company.logo || '/logo.png'} alt="Company Logo"
                    style={{ height: 64, maxWidth: 180, objectFit: 'contain' }}
                    width={180}
                    height={64}
                    onError={e => { e.target.onerror = null; e.target.src = ''; e.target.style.display = 'none'; }}
                    onLoad={e => { if (e.target.naturalWidth === 0 || e.target.naturalHeight === 0) e.target.style.display = 'none'; }} />
                <div style={{ textAlign: 'right', fontSize: 11, color: '#374151', lineHeight: 2, paddingRight: 80 }}>
                    {company.website && <div>🌐 {company.website}</div>}
                    <div>📧 hr@{(company.website || 'yourcompany.com').replace(/^https?:\/\//, '')}</div>
                </div>
            </div>
            <div style={{ background: '#f3f4f6', padding: '6px 28px', fontSize: 11, fontWeight: 700, color: '#111827', borderTop: '1px solid #e5e7eb' }}>
                <strong>{company.companyName || 'Your Company'}</strong>
                {company.address && <span style={{ fontWeight: 400, marginLeft: 8, color: '#6b7280' }}>| Registered Office: {company.address}</span>}
            </div>
        </div>
    );

    const LetterFooter = () => (
        <div style={{ position: 'relative', background: '#f9fafb', borderTop: '1.5px solid #e5e7eb', marginTop: 'auto' }}>
            {/* Bottom-left corner */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, width: 0, height: 0,
                borderBottom: '48px solid #16a34a', borderRight: '48px solid transparent' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 28px 10px 68px', fontSize: 11, color: '#6b7280' }}>
                <span>🌐 {company.website || 'www.yourcompany.com'}</span>
                <span>📧 hr@{(company.website || 'yourcompany.com').replace(/^https?:\/\//, '')}</span>
                <span>📍 {company.address || 'Company Address'}</span>
            </div>
        </div>
    );

    const OfferLetterPreview = ({ letter }) => {
        const name     = getName(letter);
        const email    = getEmail(letter);
        const phone    = getPhone(letter);
        const monthly  = letter.salary ? Math.round(Number(letter.salary) / 12) : 0;
        const attBonus = Number(letter.attendanceBonus) || 2000;
        const perfBonus= Number(letter.performanceBonus) || 2000;
        const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
        const probPeriod    = letter.probationPeriod || '1 Month';
        const wkHours      = letter.workingHours || '10:00 AM – 7:00 PM';
        const hrMgr        = letter.hrManagerName || 'HR Manager';
        const hrContact    = letter.hrContact || '';
        const empType      = letter.employmentType || 'Full Time';
        const noticePeriod = letter.noticePeriod || '30 Days';
        const workLocation = letter.workLocation || company.address || '';
        const pageStyle = {
            width: '210mm', minHeight: '297mm', background: '#fff',
            fontFamily: "'Segoe UI', Arial, sans-serif",
            fontSize: 12, color: '#111827', lineHeight: 1.7,
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)', margin: '0 auto',
        };

        return (
            <div id="offer-letter-print" style={{ background: '#e5e7eb', padding: '16px 0' }}>

                {/* ══════════════ PAGE 1 – JOINING LETTER ══════════════ */}
                <div className="offer-page" style={pageStyle}>
                    <LetterHead />

                    <div style={{ padding: '18px 32px', flex: 1 }}>
                        {/* Title */}
                        <div style={{ textAlign: 'center', margin: '8px 0 16px' }}>
                            <div style={{ display: 'inline-block', borderBottom: '2px solid #111827', paddingBottom: 4, fontWeight: 800, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' }}>
                                Joining Letter
                            </div>
                        </div>

                        {/* Addressee */}
                        <div style={{ marginBottom: 14, fontSize: 12 }}>
                            <div>To,</div>
                            <div style={{ fontWeight: 700 }}>Mr./Ms. {name}</div>
                            {phone    && <div>Contact No: {phone}</div>}
                            {email    && <div>Email: {email}</div>}
                            {letter.candidateAddress && <div>Address: {letter.candidateAddress}</div>}
                        </div>

                        {/* Salutation & opening */}
                        <p style={{ margin: '0 0 8px' }}>Dear {name},</p>
                        <p style={{ margin: '0 0 12px', textAlign: 'justify' }}>
                            We are pleased to welcome you to <strong>{company.companyName || 'the company'}</strong> as a{' '}
                            <strong>{letter.position}</strong>. After reviewing your qualifications and potential, we are
                            confident that your skills align well with our organizational objectives and values.
                        </p>

                        {/* Joining Details */}
                        <div style={{ fontWeight: 800, textDecoration: 'underline', marginBottom: 8, fontSize: 13 }}>JOINING DETAILS:</div>
                        <ul style={{ margin: '0 0 14px', paddingLeft: 22, lineHeight: 2 }}>
                            <li>Employment Type: {empType}</li>
                            <li>Position: {letter.position}{letter.department ? ` – ${letter.department}` : ''}</li>
                            <li>Date of Joining: {fmtDate(letter.joiningDate)}</li>
                            <li>
                                Monthly Salary (CTC): <strong>₹{monthly.toLocaleString('en-IN')} per month</strong>
                                {(attBonus || perfBonus) && (
                                    <span style={{ color: '#374151' }}>
                                        {' '}(including {attBonus ? `₹${attBonus.toLocaleString('en-IN')} Attendance Bonus` : ''}
                                        {attBonus && perfBonus ? ' + ' : ''}
                                        {perfBonus ? `₹${perfBonus.toLocaleString('en-IN')} Performance Bonus` : ''})
                                        {' '}as per company payroll policy
                                    </span>
                                )}
                            </li>
                            <li>Working Hours: {wkHours} (as per company rules)</li>
                            <li>Probation Period: {probPeriod}</li>
                            {workLocation && <li>Work Location: {workLocation}</li>}
                            {letter.reportingTo && <li>Reporting To: {letter.reportingTo}</li>}
                        </ul>

                        {letter.notes && (
                            <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 11.5 }}>
                                <strong>Additional Note:</strong> {letter.notes}
                            </div>
                        )}
                    </div>
                    <LetterFooter />
                </div>

                {/* ══════════════ PAGE 2 – TERMS & POLICIES ══════════════ */}
                <div className="offer-page" style={{ ...pageStyle, marginTop: 16 }}>
                    <LetterHead />

                    <div style={{ padding: '20px 32px', flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10 }}>
                            NOTICE PERIOD, FINAL SETTLEMENT &amp; TERMINATION During probation.
                        </div>
                        <p style={{ margin: '0 0 12px', textAlign: 'justify' }}>
                            If you leave the company before completing the probation period of <strong>{probPeriod}</strong>, no salary will be payable as per company policy.
                            Upon successful completion of probation, your employment status will be reviewed for confirmation
                            as a regular employee. As a regular employee, you will be required to serve a minimum notice period
                            of <strong>{noticePeriod}</strong> prior to resignation.
                        </p>
                        <p style={{ margin: '0 0 16px', textAlign: 'justify' }}>
                            In case of termination by the Company due to poor performance, misconduct, or unethical practices,
                            the Company shall not be liable to pay any salary or dues beyond the last cleared payment. Further,
                            if any employee is found to have misused, disclosed, or otherwise acted in a manner that adversely
                            affects the Company's data, confidential information, or reputation/retaining in the market,
                            the Company reserves the right to terminate such employee immediately, without being liable to pay
                            any salary, compensation, or dues beyond the last cleared payment.
                        </p>

                        <div style={{ marginBottom: 12 }}>
                            <span style={{ fontWeight: 800 }}>PERFORMANCE &amp; CONDUCT</span>{'  '}
                            <span style={{ textAlign: 'justify' }}>
                                This position requires consistent, result-oriented performance. Instances of zero business,
                                repeated underperformance, or misconduct may result in salary deductions, warnings, or
                                termination of employment. Misconduct, breach of confidentiality, or violation of company
                                policies may lead to immediate termination without payment.
                            </span>
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>CONFIDENTIALITY &amp; NDA</div>
                            <p style={{ margin: 0, textAlign: 'justify' }}>
                                You agree to maintain strict confidentiality regarding all company information, client data,
                                business strategies, and proprietary materials both during and after your tenure.
                                You will be required to sign the NDA on or before your date of joining.
                            </p>
                        </div>

                        <div>
                            <div style={{ fontWeight: 800, marginBottom: 6 }}>DOCUMENT SUBMISSION</div>
                            <p style={{ margin: 0, textAlign: 'justify' }}>
                                You are required to submit the following on your date of joining: original educational
                                certificates, last employer's relieving letter (if applicable), government-issued ID proof,
                                address proof, PAN card, and two passport-size photographs.
                            </p>
                        </div>
                    </div>
                    <LetterFooter />
                </div>

                {/* ══════════════ PAGE 3 – EMPLOYMENT & LEAVE POLICY ══════════════ */}
                <div className="offer-page" style={{ ...pageStyle, marginTop: 16 }}>
                    <LetterHead />

                    <div style={{ padding: '20px 32px', flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, textDecoration: 'underline', marginBottom: 8 }}>EMPLOYMENT POLICY:</div>
                        <p style={{ margin: '0 0 14px', textAlign: 'justify' }}>
                            You are strictly prohibited from engaging in any external employment, freelance, or business
                            activity during your tenure. Violation of this policy will lead to immediate termination without
                            notice and forfeiture of any pending salary or incentives.
                        </p>

                        <div style={{ fontWeight: 800, marginBottom: 8 }}>LATE ARRIVAL &amp; LEAVE POLICY</div>
                        <ul style={{ margin: '0 0 16px', paddingLeft: 22, lineHeight: 2 }}>
                            <li>Working Hours: {wkHours}.</li>
                            {workLocation && <li>Work Location: {workLocation}.</li>}
                            <li>Late Arrival: After 15 minutes of shift start – considered late.</li>
                            <li>Between 30 min – 2 hrs late – Half-day deduction.</li>
                            <li>More than 2 hrs late – Full-day deduction.</li>
                            <li>Uninformed Leave: Treated as 3 days leave without pay. Exceptions will be considered only for valid reasons (e.g., medical emergencies) with prior intimation to HR/Reporting Manager.</li>
                        </ul>

                        <p style={{ margin: '0 0 24px', textAlign: 'justify' }}>
                            We are excited about the prospect of you joining our team and contributing to the success of{' '}
                            <strong>{company.companyName || 'the company'}</strong>. We look forward to your dedication and commitment.
                        </p>

                        {/* HR Signature Block */}
                        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 16 }}>
                            <div style={{ minWidth: 180 }}>
                                <img src={company.logo || '/logo.png'} alt="Logo"
                                    style={{ height: 44, objectFit: 'contain', marginBottom: 10, display: 'block' }}
                                    onError={e => { e.target.style.display = 'none'; }} />
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{company.companyName || 'Your Company'}</div>
                                <div style={{ fontSize: 12, marginTop: 4, color: '#374151' }}>{hrMgr}</div>
                                <div style={{ fontSize: 12, color: '#374151' }}>HR Manager</div>
                                {hrContact && <div style={{ fontSize: 12, color: '#374151' }}>Contact No: {hrContact}</div>}
                                {company.website && <div style={{ fontSize: 12, color: '#374151' }}>Website: {company.website}</div>}
                            </div>
                            <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                <div style={{ borderTop: '1.5px solid #374151', paddingTop: 6, marginTop: 40 }}>
                                    <div style={{ fontWeight: 700 }}>{name}</div>
                                    <div style={{ fontSize: 11.5, color: '#6b7280' }}>Candidate Signature &amp; Date</div>
                                    <div style={{ fontSize: 11.5, color: '#6b7280' }}>I hereby accept the offer and all terms stated above.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <LetterFooter />
                </div>

            </div>
        );
    };

    if (loading) return (
        <div className="recruitment-container">
            {/* Header */}
            <div className="recruitment-header">
                <div>
                    <div className="skeleton skeleton-title" style={{ width: 140, marginBottom: 8 }} />
                    <div className="skeleton skeleton-text" style={{ width: 200 }} />
                </div>
                <div className="skeleton skeleton-btn" style={{ width: 185 }} />
            </div>

            {/* 4 Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {[1,2,3,4].map(i => (
                    <div key={i} style={{ background: 'white', borderRadius: 10, padding: '16px 20px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div className="skeleton skeleton-text" style={{ width: 88, marginBottom: 8 }} />
                            <div className="skeleton" style={{ width: 52, height: 30, borderRadius: 6 }} />
                        </div>
                        <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                    </div>
                ))}
            </div>

            {/* Filters bar */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, background: 'white', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div className="skeleton" style={{ flex: 1, height: 36, borderRadius: 8 }} />
                <div className="skeleton" style={{ width: 130, height: 36, borderRadius: 8 }} />
            </div>

            {/* Table */}
            <div className="dark-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '11px 14px', borderBottom: '1.5px solid #e8edf2', background: '#f8fafc', gap: 0 }}>
                    {[{ w: 150 }, { w: 110 }, { w: 100 }, { w: 80 }, { w: 90 }, { w: 82 }, { w: 68 }, { w: 68 }].map((col, i) => (
                        <div key={i} className="skeleton" style={{ height: 11, borderRadius: 4, width: col.w, marginRight: i < 7 ? 14 : 0, flexShrink: 0 }} />
                    ))}
                </div>
                {/* Data rows */}
                {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '13px 14px', borderBottom: '1px solid #f1f5f9', gap: 0 }}>
                        {/* Candidate name + email */}
                        <div style={{ width: 150, flexShrink: 0, marginRight: 14 }}>
                            <div className="skeleton skeleton-text" style={{ width: '80%', marginBottom: 5 }} />
                            <div className="skeleton skeleton-text" style={{ width: '90%' }} />
                        </div>
                        {/* Position */}
                        <div className="skeleton skeleton-text" style={{ width: 100, flexShrink: 0, marginRight: 14 }} />
                        {/* Department */}
                        <div className="skeleton skeleton-text" style={{ width: 82, flexShrink: 0, marginRight: 14 }} />
                        {/* Salary */}
                        <div className="skeleton skeleton-text" style={{ width: 68, flexShrink: 0, marginRight: 14 }} />
                        {/* Joining Date */}
                        <div className="skeleton skeleton-text" style={{ width: 78, flexShrink: 0, marginRight: 14 }} />
                        {/* Expiry */}
                        <div className="skeleton skeleton-text" style={{ width: 78, flexShrink: 0, marginRight: 14 }} />
                        {/* Status badge */}
                        <div className="skeleton" style={{ width: 64, height: 22, borderRadius: 20, flexShrink: 0, marginRight: 14 }} />
                        {/* Actions: eye + X */}
                        <div style={{ display: 'flex', gap: 6 }}>
                            <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 6 }} />
                            <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 6 }} />
                        </div>
                    </div>
                ))}
                {/* Footer */}
                <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <div className="skeleton skeleton-text" style={{ width: 210 }} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="recruitment-container">
            <style>{printStyle}</style>

            {/* ── Header ── */}
            <div className="recruitment-header">
                <div>
                    <h2>Offer Letters</h2>
                    <div className="breadcrumb"><span className="bc-parent">Recruit</span><span className="bc-sep"> • </span><span className="bc-current">Offer Letters</span></div>
                </div>
                <button onClick={() => setShowModal(true)} className="rc-btn rc-btn-primary">
                    <Plus size={16} /> Generate Offer Letter
                </button>
            </div>

            {/* ── Stats ── */}
            <div className="rc-stat-grid">
                {[
                    { label: 'Total Letters', val: stats.total,    color: '#6366f1', bg: '#eef2ff', icon: <FileText size={20} /> },
                    { label: 'Sent',          val: stats.sent,     color: '#3b82f6', bg: '#eff6ff', icon: <Send size={20} /> },
                    { label: 'Accepted',      val: stats.accepted, color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle size={20} /> },
                    { label: 'Rejected',      val: stats.rejected, color: '#ef4444', bg: '#fff1f2', icon: <XCircle size={20} /> },
                ].map((s, i) => (
                    <div key={i} className="rc-stat-card">
                        <div>
                            <div className="rc-stat-label">{s.label}</div>
                            <div className="rc-stat-value" style={{ color: s.color }}>{s.val}</div>
                        </div>
                        <div className="rc-stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
                    </div>
                ))}
            </div>

            {/* ── Filters ── */}
            <div className="rc-filters">
                <div className="rc-search-wrap">
                    <Search size={15} />
                    <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by candidate or position..." />
                </div>
                <select className="rc-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="All">All Status</option>
                    {Object.keys(offerStatusColors).map(s => <option key={s}>{s}</option>)}
                </select>
            </div>

            {/* ── Table ── */}
            <div className="dark-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="dark-table">
                    <thead>
                        <tr>
                            <th>Candidate</th><th>Position</th><th>Department</th>
                            <th>Salary</th><th>Joining Date</th><th>Expiry</th>
                            <th>Status</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length > 0 ? filtered.map(letter => {
                            const sc = offerStatusColors[letter.status] || { bg: '#f1f5f9', color: '#475569' };
                            const expired = letter.offerExpiry && new Date(letter.offerExpiry) < new Date();
                            return (
                                <tr key={letter._id}>
                                    <td>
                                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{getName(letter)}</div>
                                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{getEmail(letter)}</div>
                                    </td>
                                    <td style={{ fontSize: 13, color: '#475569' }}>{letter.position}</td>
                                    <td style={{ fontSize: 13, color: '#475569' }}>{letter.department || '—'}</td>
                                    <td style={{ fontSize: 13, color: '#475569' }}>{letter.salary ? `₹${Number(letter.salary).toLocaleString()}` : '—'}</td>
                                    <td style={{ fontSize: 13, color: '#475569' }}>{letter.joiningDate ? new Date(letter.joiningDate).toLocaleDateString() : '—'}</td>
                                    <td style={{ fontSize: 13, color: expired ? '#ef4444' : '#475569' }}>{letter.offerExpiry ? new Date(letter.offerExpiry).toLocaleDateString() : '—'}</td>
                                    <td><span style={{ ...sc, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{letter.status}</span></td>
                                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => setPreviewLetter(letter)} title="Preview" className="rc-icon-btn"><Eye size={14} /></button>
                                            <button
                                                onClick={() => handleSendEmail(letter)}
                                                title={`Send email to ${getEmail(letter) || 'candidate'}`}
                                                className="rc-icon-btn"
                                                disabled={sendingEmail === letter._id}
                                                style={{ background: '#eff6ff', color: '#2563eb' }}>
                                                {sendingEmail === letter._id ? '…' : <Mail size={14} />}
                                            </button>
                                            <button onClick={() => handleDelete(letter._id)} title="Delete" className="rc-icon-btn danger"><X size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
                                {candidates.length === 0 ? 'No hired candidates yet. Mark candidates as "Hired" in Job Applications first.' : 'No offer letters yet. Click "Generate Offer Letter" to create one.'}
                            </td></tr>
                        )}
                    </tbody>
                </table>
                <div className="rc-table-footer">
                    {offerLetters.length} offer letter{offerLetters.length !== 1 ? 's' : ''} total
                    {candidates.length > 0 && <span style={{ marginLeft: 16, color: '#10b981', fontWeight: 600 }}>{candidates.length} hired candidate{candidates.length !== 1 ? 's' : ''} available</span>}
                </div>
            </div>

            {/* ── Generate Modal ── */}
            {showModal && (
                <div className="rc-modal-overlay">
                    <div className="rc-modal xl">
                        <div className="rc-modal-header">
                            <div>
                                <h3 className="rc-modal-title">Generate Offer Letter</h3>
                                <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--rc-text-2)' }}>Only candidates with "Hired" status appear below.</p>
                            </div>
                            <button className="rc-modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        {candidates.length === 0 ? (
                            <div style={{ background: '#fef9c3', border: '1px solid #fcd34d', borderRadius: 8, padding: 16, color: '#854d0e', fontSize: 13 }}>
                                No hired candidates found. Go to Job Applications and mark candidates as "Hired" first.
                            </div>
                        ) : (
                            <form onSubmit={handleGenerate}>
                                {/* Candidate + Position */}
                                <div className="form-group">
                                    <label>Candidate *</label>
                                    <select required value={formData.candidateId} onChange={e => {
                                        const c = candidates.find(c => c._id === e.target.value);
                                        setFormData({ ...formData, candidateId: e.target.value, position: c?.jobId?.title || '' });
                                    }}>
                                        <option value="">Select Hired Candidate</option>
                                        {candidates.map(c => <option key={c._id} value={c._id}>{c.firstName} {c.lastName} — {c.jobId?.title || 'No job'}</option>)}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Position *</label>
                                        <input required value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} placeholder="Job Title" />
                                    </div>
                                    <div className="form-group">
                                        <label>Department</label>
                                        <input value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} placeholder="e.g. Engineering" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Candidate Address</label>
                                    <input value={formData.candidateAddress} onChange={e => setFormData({ ...formData, candidateAddress: e.target.value })} placeholder="e.g. New Ashok Nagar, Delhi" />
                                </div>
                                {/* Salary */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Annual Salary (₹) *</label>
                                        <input type="number" required value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} placeholder="e.g. 120000" />
                                    </div>
                                    <div className="form-group">
                                        <label>Attendance Bonus (₹/mo)</label>
                                        <input type="number" value={formData.attendanceBonus} onChange={e => setFormData({ ...formData, attendanceBonus: e.target.value })} placeholder="2000" />
                                    </div>
                                    <div className="form-group">
                                        <label>Performance Bonus (₹/mo)</label>
                                        <input type="number" value={formData.performanceBonus} onChange={e => setFormData({ ...formData, performanceBonus: e.target.value })} placeholder="2000" />
                                    </div>
                                </div>
                                {/* Dates */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Joining Date *</label>
                                        <input type="date" required value={formData.joiningDate} onChange={e => setFormData({ ...formData, joiningDate: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Offer Expiry *</label>
                                        <input type="date" required value={formData.offerExpiry} onChange={e => setFormData({ ...formData, offerExpiry: e.target.value })} />
                                    </div>
                                </div>
                                {/* Reporting & Working */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Reporting To</label>
                                        <input value={formData.reportingTo} onChange={e => setFormData({ ...formData, reportingTo: e.target.value })} placeholder="Manager name" />
                                    </div>
                                    <div className="form-group">
                                        <label>Working Hours</label>
                                        <input value={formData.workingHours} onChange={e => setFormData({ ...formData, workingHours: e.target.value })} placeholder="10:00 AM – 7:00 PM" />
                                    </div>
                                </div>
                                {/* Employment Type, Notice Period, Work Location */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Employment Type</label>
                                        <select value={formData.employmentType} onChange={e => setFormData({ ...formData, employmentType: e.target.value })}>
                                            <option>Full Time</option>
                                            <option>Part Time</option>
                                            <option>Contract</option>
                                            <option>Internship</option>
                                            <option>Freelance</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Notice Period</label>
                                        <input value={formData.noticePeriod} onChange={e => setFormData({ ...formData, noticePeriod: e.target.value })} placeholder="e.g. 30 Days" />
                                    </div>
                                    <div className="form-group">
                                        <label>Work Location</label>
                                        <input value={formData.workLocation} onChange={e => setFormData({ ...formData, workLocation: e.target.value })} placeholder="e.g. Delhi, On-site" />
                                    </div>
                                </div>
                                {/* Probation & HR */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>Probation Period</label>
                                        <input value={formData.probationPeriod} onChange={e => setFormData({ ...formData, probationPeriod: e.target.value })} placeholder="e.g. 1 Month" />
                                    </div>
                                    <div className="form-group">
                                        <label>HR Manager Name</label>
                                        <input value={formData.hrManagerName} onChange={e => setFormData({ ...formData, hrManagerName: e.target.value })} placeholder="e.g. Tamanna Chauhan" />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div className="form-group">
                                        <label>HR Contact Number</label>
                                        <input value={formData.hrContact} onChange={e => setFormData({ ...formData, hrContact: e.target.value })} placeholder="+91 98765 43210" />
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                                            {Object.keys(offerStatusColors).map(s => <option key={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Additional Notes</label>
                                    <textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Any special conditions..." />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="rc-btn rc-btn-secondary">Cancel</button>
                                    <button type="submit" disabled={saving} className="rc-btn rc-btn-primary" style={{ opacity: saving ? 0.7 : 1 }}>
                                        {saving ? 'Saving...' : 'Generate Letter'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ── Preview Modal ── */}
            {previewLetter && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div style={{ background: '#1e293b', borderRadius: 14, width: '95%', maxWidth: 900, maxHeight: '95vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 72px rgba(0,0,0,0.4)' }}>
                        {/* Modal toolbar */}
                        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, flexShrink: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>📄 Offer Letter – {getName(previewLetter)}</div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                {/* Status buttons */}
                                {Object.keys(offerStatusColors).map(s => {
                                    const sc = offerStatusColors[s];
                                    const isActive = previewLetter.status === s;
                                    return (
                                        <button key={s} onClick={() => handleStatusChange(previewLetter._id, s)}
                                            style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                                border: isActive ? 'none' : '1px solid #475569',
                                                background: isActive ? sc.bg : 'transparent',
                                                color: isActive ? sc.color : '#94a3b8' }}>
                                            {s}
                                        </button>
                                    );
                                })}
                                {/* Send Email from preview */}
                                <button
                                    onClick={() => handleSendEmail(previewLetter)}
                                    disabled={sendingEmail === previewLetter._id}
                                    style={{ background: '#3b82f6', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, opacity: sendingEmail === previewLetter._id ? 0.7 : 1 }}>
                                    <Mail size={14} /> {sendingEmail === previewLetter._id ? 'Sending…' : 'Send Email'}
                                </button>
                                {/* Print */}
                                <button onClick={() => window.print()}
                                    style={{ background: '#334155', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                                    <Printer size={14} /> Print
                                </button>
                                {/* Download PDF */}
                                <button onClick={handleDownloadPDF} disabled={pdfLoading}
                                    style={{ background: '#16a34a', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, opacity: pdfLoading ? 0.7 : 1 }}>
                                    <Download size={14} /> {pdfLoading ? 'Generating…' : 'Download PDF'}
                                </button>
                                <button onClick={() => setPreviewLetter(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}>×</button>
                            </div>
                        </div>
                        {/* Scrollable letter area */}
                        <div style={{ overflowY: 'auto', flex: 1, padding: '0 0 16px' }}>
                            <OfferLetterPreview letter={previewLetter} />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Email Toast Notification ── */}
            {emailToast && (
                <div style={{
                    position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
                    background: emailToast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1.5px solid ${emailToast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: emailToast.type === 'success' ? '#166534' : '#991b1b',
                    padding: '14px 20px', borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
                    fontWeight: 600, fontSize: 14, maxWidth: 360,
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    <span>{emailToast.msg}</span>
                    <button onClick={() => setEmailToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'inherit', padding: 0, lineHeight: 1, marginLeft: 4 }}>×</button>
                </div>
            )}
        </div>
    );
};

export default RecruitOfferLetters;
