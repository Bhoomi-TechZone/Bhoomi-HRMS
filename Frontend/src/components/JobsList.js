import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Briefcase, MapPin, Clock, Calendar, MoreVertical, Eye, Pencil, Trash2, Users, LayoutGrid, List, ChevronDown, Check, QrCode, RefreshCw, Download, Copy, ExternalLink, Maximize2, FileText, CheckCircle2, AlignLeft, Sparkles, X } from 'lucide-react';
import './RecruitmentDashboard.css';

const statusColors = { Open: { bg: '#dcfce7', color: '#166534' }, Closed: { bg: '#fee2e2', color: '#991b1b' }, 'On Hold': { bg: '#fef9c3', color: '#854d0e' } };
const typeColors = { 'Full-time': { bg: '#eff6ff', color: '#1d4ed8' }, 'Part-time': { bg: '#fdf4ff', color: '#7e22ce' }, 'Contract': { bg: '#fff7ed', color: '#c2410c' }, 'Internship': { bg: '#f0fdf4', color: '#15803d' } };

const JobsList = () => {
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

    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All');
    const [viewMode, setViewMode] = useState('table');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [activeStatusDropdown, setActiveStatusDropdown] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [viewJob, setViewJob] = useState(null);
    const [currentJobId, setCurrentJobId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const JOBS_PER_PAGE = 10;

    const formatSalaryRange = (min, max, period = 'per month', withCurrency = false) => {
        const hasMin = min !== undefined && min !== null && String(min).trim() !== '';
        const hasMax = max !== undefined && max !== null && String(max).trim() !== '';
        if (!hasMin && !hasMax) return null;
        
        const isAnnual = period === 'per annum' || period === 'per year' || period === 'annum' || period === 'ctc' || period === 'annual';

        if (isAnnual) {
            const formatLpa = (val) => {
                const num = Number(val);
                if (isNaN(num)) return val;
                if (num >= 10000) {
                    const lpa = Math.round((num / 100000) * 100) / 100;
                    return (withCurrency ? '₹' : '') + `${lpa}`;
                }
                const lpa = Math.round(num * 100) / 100;
                return (withCurrency ? '₹' : '') + `${lpa}`;
            };

            if (hasMin && hasMax) {
                if (Number(min) === Number(max)) {
                    return `${formatLpa(min)} LPA`;
                }
                return `${formatLpa(min)} - ${formatLpa(max)} LPA`;
            }
            if (hasMin) {
                return `From ${formatLpa(min)} LPA`;
            }
            return `Up to ${formatLpa(max)} LPA`;
        }

        const formatAmt = (val) => {
            const num = Number(val);
            if (isNaN(num)) return val;
            return (withCurrency ? '₹' : '') + num.toLocaleString('en-IN');
        };
        
        const periodLabel = '/mon';
        
        if (hasMin && hasMax) {
            if (Number(min) === Number(max)) {
                return `${formatAmt(min)} ${periodLabel}`;
            }
            return `${formatAmt(min)} - ${formatAmt(max)} ${periodLabel}`;
        }
        if (hasMin) {
            return `From ${formatAmt(min)} ${periodLabel}`;
        }
        return `Up to ${formatAmt(max)} ${periodLabel}`;
    };

    const formatExperienceRange = (min, minUnit = 'years', max, maxUnit = 'years') => {
        const hasMin = min !== undefined && min !== null && String(min).trim() !== '';
        const hasMax = max !== undefined && max !== null && String(max).trim() !== '';
        if (!hasMin && !hasMax) return null;

        const formatVal = (v, u) => {
            const num = Number(v);
            if (isNaN(num)) return v;
            if (num === 0) return 'Fresher';
            const unitName = u === 'months' ? (num === 1 ? 'Month' : 'Months') : (num === 1 ? 'Year' : 'Years');
            return `${num} ${unitName}`;
        };

        if (hasMin && hasMax) {
            if (Number(min) === Number(max) && minUnit === maxUnit) {
                return formatVal(min, minUnit);
            }
            if (minUnit === maxUnit) {
                const unitName = minUnit === 'months' ? 'Months' : 'Years';
                return `${min} - ${max} ${unitName}`;
            }
            return `${formatVal(min, minUnit)} - ${formatVal(max, maxUnit)}`;
        }
        if (hasMin) return `Min ${formatVal(min, minUnit)}`;
        return `Up to ${formatVal(max, maxUnit)}`;
    };

    const initialFormState = {
        title: '', department: '', description: '', requirements: '', eligibilityCriteria: '',
        type: 'Full-time', location: 'On-site', status: 'Open',
        minSalary: '', maxSalary: '', salaryCurrency: 'INR', salaryPeriod: 'per month',
        minExperience: '', minExpUnit: 'years', maxExperience: '', maxExpUnit: 'years'
    };
    const [formData, setFormData] = useState(initialFormState);

    const [showDeptDd, setShowDeptDd] = useState(false);
    const [deptSearch, setDeptSearch] = useState("");
    const [showTypeDd, setShowTypeDd] = useState(false);
    const [typeSearch, setTypeSearch] = useState("");
    const [showLocDd, setShowLocDd] = useState(false);
    const [locSearch, setLocSearch] = useState("");
    const [showStatusModalDd, setShowStatusModalDd] = useState(false);

    const [showStatusFilterDd, setShowStatusFilterDd] = useState(false);
    const [showTypeFilterDd, setShowTypeFilterDd] = useState(false);

    // Dedicated Full-Card Textarea Editor State for Job Description & Requirements
    const [activeTextEditor, setActiveTextEditor] = useState(null); // 'description' | 'requirements' | null

    const openTextEditor = (fieldName) => {
        setActiveTextEditor(fieldName);
    };

    const closeTextEditor = () => {
        setActiveTextEditor(null);
    };

    const getOfficialQrData = () => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const careersUrl = `${baseUrl}/careers?ref=qr&source=hiring_poster`;
        const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(careersUrl)}&margin=12`;
        return {
            url: careersUrl,
            qrUrl: qrImg,
            generatedAt: new Date().toISOString()
        };
    };

    const [qrData, setQrData] = useState(() => {
        try {
            const saved = localStorage.getItem('recruitment_job_qr');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.url && !parsed.url.includes('/careers/apply')) {
                    return parsed;
                }
            }
            const fallback = getOfficialQrData();
            try {
                localStorage.setItem('recruitment_job_qr', JSON.stringify(fallback));
            } catch (_) {}
            return fallback;
        } catch {
            return getOfficialQrData();
        }
    });
    const [showQrModal, setShowQrModal] = useState(false);
    const [isRegeneratingQr, setIsRegeneratingQr] = useState(false);
    const [copiedQrLink, setCopiedQrLink] = useState(false);

    const generateQrData = () => {
        const baseUrl = window.location.origin;
        const careersUrl = `${baseUrl}/careers?ref=qr&source=hiring_poster`;
        const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(careersUrl)}&margin=12`;
        const newQr = {
            url: careersUrl,
            qrUrl: qrImg,
            generatedAt: new Date().toISOString()
        };
        setQrData(newQr);
        try {
            localStorage.setItem('recruitment_job_qr', JSON.stringify(newQr));
        } catch (e) {
            console.error(e);
        }
        return newQr;
    };

    const handleGenerateQr = () => {
        if (!qrData || !qrData.url || qrData.url.includes('/careers/apply')) {
            generateQrData();
        }
        setShowQrModal(true);
    };

    const handleRegenerateQr = () => {
        setIsRegeneratingQr(true);
        setTimeout(() => {
            generateQrData();
            setIsRegeneratingQr(false);
        }, 450);
    };

    const handleCopyQrLink = () => {
        if (qrData?.url) {
            navigator.clipboard.writeText(qrData.url);
            setCopiedQrLink(true);
            setTimeout(() => setCopiedQrLink(false), 2000);
        }
    };

    const [isDownloadingQr, setIsDownloadingQr] = useState(false);

    const handleDownloadQr = async () => {
        if (!qrData?.qrUrl) return;
        setIsDownloadingQr(true);

        try {
            const W = 1240;
            const H = 1754; // A4 proportions
            const canvas = document.createElement('canvas');
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            // ── BACKGROUND ───────────────────────────────────────────────
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);

            // Light warm off-white inner area
            ctx.fillStyle = '#fafaf9';
            ctx.fillRect(56, 56, W - 112, H - 112);

            // ── BRAND COLOR PALETTE ───────────────────────────────────────
            const GREEN      = '#2d6a4f';
            const GREEN_LT   = '#40916c';
            const GOLD       = '#b5902a';
            const DARK       = '#1a1a2e';
            const GRAY       = '#6b7280';
            const LGRAY      = '#e5e7eb';

            // ── TOP ACCENT BAR ────────────────────────────────────────────
            const topGrad = ctx.createLinearGradient(0, 0, W, 0);
            topGrad.addColorStop(0, GREEN);
            topGrad.addColorStop(1, GREEN_LT);
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, 0, W, 10);

            // ── OUTER BORDER (subtle dark) ────────────────────────────────
            ctx.strokeStyle = '#d1d5db';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(56, 56, W - 112, H - 112);

            // ── GOLD CORNER MARKS ─────────────────────────────────────────
            // drawCorner(ox, oy, dx, dy) — ox/oy = corner origin, dx/dy = ±1 direction inward
            const drawCorner = (ox, oy, dx, dy) => {
                const cm = 50;
                ctx.strokeStyle = GOLD;
                ctx.lineWidth = 3.5;
                ctx.lineCap = 'square';
                ctx.beginPath();
                ctx.moveTo(ox + dx * cm, oy);   // horizontal arm
                ctx.lineTo(ox, oy);              // corner point
                ctx.lineTo(ox, oy + dy * cm);   // vertical arm
                ctx.stroke();
            };
            drawCorner(56,     56,     +1, +1);  // top-left
            drawCorner(W - 56, 56,     -1, +1);  // top-right
            drawCorner(56,     H - 56, +1, -1);  // bottom-left
            drawCorner(W - 56, H - 56, -1, -1);  // bottom-right

            // ── LOAD ARIAL / BUSINESS FONT FOR HEADLINE ───────────────────
            // Arial is a built-in system font — no async load needed
            const headlineFont = "bold 90px Arial, 'Helvetica Neue', Helvetica, sans-serif";

            // ── COMPANY LOGO ──────────────────────────────────────────────
            const logoImg = new Image();
            logoImg.crossOrigin = 'anonymous';
            logoImg.src = '/logo.png';
            await new Promise((res) => { logoImg.onload = res; logoImg.onerror = res; });

            const logoH = 90;
            const logoW = logoImg.naturalWidth && logoImg.naturalHeight
                ? Math.round((logoImg.naturalWidth / logoImg.naturalHeight) * logoH)
                : 220;
            const logoX = (W - logoW) / 2;
            const logoY = 116;
            try { ctx.drawImage(logoImg, logoX, logoY, logoW, logoH); } catch (_) {}

            // ── GOLD RULE UNDER LOGO ──────────────────────────────────────
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(200, logoY + logoH + 24); ctx.lineTo(W - 200, logoY + logoH + 24);
            ctx.stroke();

            // ── TAGLINE UNDER RULE ────────────────────────────────────────
            ctx.fillStyle = GRAY;
            ctx.font = "italic 19px Arial, 'Helvetica Neue', sans-serif";
            ctx.textAlign = 'center';
            ctx.fillText("Empowering Talent · Driving Innovation", W / 2, logoY + logoH + 58);

            // ── "WE'RE HIRING" HEADLINE ───────────────────────────────────
            const headY = logoY + logoH + 116;
            // Eyebrow label
            ctx.fillStyle = GOLD;
            ctx.font = "bold 15px Arial, 'Helvetica Neue', sans-serif";
            ctx.letterSpacing = '6px';
            ctx.fillText("CAREER OPPORTUNITY", W / 2, headY);
            ctx.letterSpacing = '0px';

            // Headline — Playfair Display
            ctx.fillStyle = DARK;
            ctx.font = headlineFont;
            ctx.fillText("We're Hiring", W / 2, headY + 94);

            // Thin green underline accent below headline
            const ulW = 260;
            ctx.strokeStyle = GREEN_LT;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo((W - ulW) / 2, headY + 108); ctx.lineTo((W + ulW) / 2, headY + 108);
            ctx.stroke();

            // ── SUBTITLE ──────────────────────────────────────────────────
            ctx.fillStyle = GRAY;
            ctx.font = "400 21px Arial, 'Helvetica Neue', sans-serif";
            ctx.fillText("Join our growing team — Scan the QR code below", W / 2, headY + 150);
            ctx.fillText("to explore open positions and apply instantly.", W / 2, headY + 184);

            // ── QR CODE SECTION ───────────────────────────────────────────
            const qrPad   = 28;
            const qrSize  = 380;
            const cardW   = qrSize + qrPad * 2;
            const cardH   = qrSize + qrPad * 2;
            const cardX   = (W - cardW) / 2;
            const cardY   = headY + 266;

            // White card behind QR
            ctx.shadowColor   = 'rgba(0,0,0,0.10)';
            ctx.shadowBlur    = 40;
            ctx.shadowOffsetY = 16;
            ctx.fillStyle     = '#ffffff';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 20);
            else ctx.rect(cardX, cardY, cardW, cardH);
            ctx.fill();
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

            // Green border around card
            ctx.strokeStyle = GREEN_LT;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Draw QR image
            const qrImg = new Image();
            qrImg.crossOrigin = 'anonymous';
            qrImg.src = qrData.qrUrl;
            await new Promise((res) => { qrImg.onload = res; qrImg.onerror = res; });
            try { ctx.drawImage(qrImg, cardX + qrPad, cardY + qrPad, qrSize, qrSize); } catch (_) {}

            // ── SCAN LABEL ────────────────────────────────────────────────
            const scanY = cardY + cardH + 30;
            ctx.fillStyle = GREEN;
            ctx.font = "600 22px 'Georgia', serif";
            ctx.fillText("Point your phone camera here to apply", W / 2, scanY);

            // ── GOLD DIVIDER ──────────────────────────────────────────────
            const divY = scanY + 46;
            ctx.strokeStyle = GOLD;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(200, divY); ctx.lineTo(W - 200, divY);
            ctx.stroke();

            // ── 3-STEP GUIDE ──────────────────────────────────────────────
            const stepsY = divY + 36;
            ctx.fillStyle = DARK;
            ctx.font = "bold 26px Arial, 'Helvetica Neue', sans-serif";
            ctx.fillText("How to Apply", W / 2, stepsY);

            const steps = [
                { n: "01", label: "Open Camera",         desc: "Use any QR scanner or\nyour phone's camera app" },
                { n: "02", label: "Scan & View Openings",desc: "Aim at the QR code &\ntap the link that appears" },
                { n: "03", label: "Choose Role & Apply", desc: "Browse open roles and\nsubmit your application" },
            ];
            const stepW  = 300;
            const stepGap = 40;
            const totalW  = steps.length * stepW + (steps.length - 1) * stepGap;
            const startX  = (W - totalW) / 2;
            const stepCardY = stepsY + 28;

            steps.forEach((s, i) => {
                const sx = startX + i * (stepW + stepGap);
                const sy = stepCardY;

                // Step card
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(sx, sy, stepW, 148, 12);
                else ctx.rect(sx, sy, stepW, 148);
                ctx.fill();
                ctx.strokeStyle = LGRAY; ctx.lineWidth = 1.5;
                ctx.stroke();

                // Green top accent bar on card
                ctx.fillStyle = GREEN;
                ctx.beginPath();
                if (ctx.roundRect) ctx.roundRect(sx, sy, stepW, 6, [12, 12, 0, 0]);
                else ctx.rect(sx, sy, stepW, 6);
                ctx.fill();

                // Number
                ctx.fillStyle = GREEN;
                ctx.font = "bold 30px 'Georgia', serif";
                ctx.textAlign = 'left';
                ctx.fillText(s.n, sx + 20, sy + 56);

                // Label
                ctx.fillStyle = DARK;
                ctx.font = "bold 20px 'Georgia', serif";
                ctx.fillText(s.label, sx + 20, sy + 86);

                // Desc (two lines)
                ctx.fillStyle = GRAY;
                ctx.font = "400 15px 'Georgia', serif";
                const lines = s.desc.split('\n');
                lines.forEach((ln, li) => ctx.fillText(ln, sx + 20, sy + 110 + li * 22));

                ctx.textAlign = 'center';
            });

            // ── APPLY LINK BOX ────────────────────────────────────────────
            const linkY = stepCardY + 148 + 40;
            ctx.fillStyle = '#f0fdf4';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(160, linkY, W - 320, 64, 12);
            else ctx.rect(160, linkY, W - 320, 64);
            ctx.fill();
            ctx.strokeStyle = '#bbf7d0'; ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = GREEN;
            ctx.font = "500 18px monospace";
            ctx.fillText(`🔗  ${qrData.url}`, W / 2, linkY + 39);

            // ── FOOTER DIVIDER ────────────────────────────────────────────
            const ftDivY = linkY + 96;
            ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(200, ftDivY); ctx.lineTo(W - 200, ftDivY);
            ctx.stroke();

            // Re-draw logo small in footer
            try {
                const fLogoH = 46;
                const fLogoW = logoImg.naturalWidth && logoImg.naturalHeight
                    ? Math.round((logoImg.naturalWidth / logoImg.naturalHeight) * fLogoH)
                    : 110;
                ctx.drawImage(logoImg, (W - fLogoW) / 2, ftDivY + 22, fLogoW, fLogoH);
            } catch (_) {}

            ctx.fillStyle = GREEN;
            ctx.font = "bold 22px Arial, 'Helvetica Neue', sans-serif";
            ctx.fillText("Bhoomi TechZone Private Limited", W / 2, ftDivY + 96);

            ctx.fillStyle = GRAY;
            ctx.font = "400 17px Arial, 'Helvetica Neue', sans-serif";
            ctx.fillText("Official Careers Portal  ·  careers@bhoomitechzone.com", W / 2, ftDivY + 126);

            ctx.fillStyle = '#9ca3af';
            ctx.font = "400 14px Arial, 'Helvetica Neue', sans-serif";
            ctx.fillText(`Generated ${new Date(qrData.generatedAt).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}  ·  All Rights Reserved`, W / 2, ftDivY + 158);

            // ── BOTTOM ACCENT BAR ─────────────────────────────────────────
            ctx.fillStyle = topGrad;
            ctx.fillRect(0, H - 10, W, 10);

            // ── DOWNLOAD ──────────────────────────────────────────────────
            const imgUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = imgUrl;
            a.download = 'Bhoomi_Hiring_Flyer.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (err) {
            console.error("Error generating flyer:", err);
            window.open(qrData.qrUrl, '_blank');
        } finally {
            setIsDownloadingQr(false);
        }
    };

    const [departments, setDepartments] = useState([]);
    const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];
    const LOCATIONS = ['On-site', 'Remote', 'Noida', 'Mumbai', 'Bangalore', 'Delhi', 'Hyderabad', 'Chennai'];

    useEffect(() => { 
        fetchJobs(); 
        fetchCandidates(); 
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const localRemovedDepts = (() => {
                try { return JSON.parse(localStorage.getItem('removedDepts')) || []; } catch(e) { return []; }
            })();
            const res = await api.get('/employees');
            const extracted = (res.data || []).map(emp => emp.department).filter(Boolean);
            const uniqueMap = new Map();
            extracted.forEach(d => {
                const trimmed = String(d).trim();
                if (trimmed && !uniqueMap.has(trimmed.toLowerCase()) && !localRemovedDepts.includes(trimmed.toLowerCase())) {
                    uniqueMap.set(trimmed.toLowerCase(), trimmed);
                }
            });
            setDepartments(Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b)));
        } catch (err) {
            console.error('Error loading employee departments:', err);
        }
    };
    useEffect(() => {
        const close = () => {
            setActiveDropdown(null);
            setActiveStatusDropdown(null);
            setShowStatusFilterDd(false);
            setShowTypeFilterDd(false);
            setShowDeptDd(false);
            setShowTypeDd(false);
            setShowLocDd(false);
        };
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, []);

    const fetchJobs = async () => {
        try {
            const response = await api.get('/recruitment/jobs');
            setJobs(response.data);
        } catch (error) { console.error("Error fetching jobs:", error); }
        finally { setLoading(false); }
    };
    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
    };

    const fetchCandidates = async () => {
        try { const res = await api.get('/recruitment/candidates'); setCandidates(res.data); }
        catch (err) { console.error("Failed to load candidates", err); }
    };

    const getApplicantCount = (jobId) => candidates.filter(c => c.jobId?._id === jobId || c.jobId === jobId).length;

    const handleFormChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleAddClick = () => { setIsEditing(false); setCurrentJobId(null); setFormData(initialFormState); setShowModal(true); };
    const handleEditClick = (job) => {
        setIsEditing(true); setCurrentJobId(job._id);
        setFormData({
            title: job.title || '',
            department: job.department || '',
            description: job.description || '',
            requirements: job.requirements || '',
            eligibilityCriteria: job.eligibilityCriteria || '',
            type: job.type || 'Full-time',
            location: job.location || 'On-site',
            status: job.status || 'Open',
            minSalary: job.minSalary !== undefined && job.minSalary !== null ? job.minSalary : '',
            maxSalary: job.maxSalary !== undefined && job.maxSalary !== null ? job.maxSalary : '',
            salaryCurrency: job.salaryCurrency || 'INR',
            salaryPeriod: job.salaryPeriod || 'per month',
            minExperience: job.minExperience !== undefined && job.minExperience !== null ? job.minExperience : '',
            minExpUnit: job.minExpUnit || 'years',
            maxExperience: job.maxExperience !== undefined && job.maxExperience !== null ? job.maxExperience : '',
            maxExpUnit: job.maxExpUnit || 'years'
        });
        setShowModal(true); setActiveDropdown(null);
    };
    const handleViewClick = (job) => { setViewJob(job); setActiveDropdown(null); };
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) { await api.put(`/recruitment/jobs/${currentJobId}`, formData); }
            else { await api.post('/recruitment/jobs', formData); }
            setShowModal(false); setFormData(initialFormState); setIsEditing(false); setCurrentJobId(null);
            fetchJobs();
        } catch (error) { console.error('Error saving job', error); alert('Failed to save job'); }
    };
    const toggleDropdown = (id, e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === id ? null : id); };
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this job posting?')) return;
        try { await api.delete(`/recruitment/jobs/${id}`); fetchJobs(); } catch (err) { alert('Failed to delete job'); }
        setActiveDropdown(null);
    };

    const handleStatusChange = async (jobId, newStatus) => {
        try {
            await api.put(`/recruitment/jobs/${jobId}`, { status: newStatus });
            setJobs(prev => prev.map(j => j._id === jobId ? { ...j, status: newStatus } : j));
        } catch (error) {
            console.error("Error updating job status:", error);
            alert(error.response?.data?.message || 'Failed to update job status');
        }
    };

    const filteredJobs = jobs.filter(job => {
        const matchSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) || job.department.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = statusFilter === 'All' || job.status === statusFilter;
        const matchType = typeFilter === 'All' || job.type === typeFilter;
        return matchSearch && matchStatus && matchType;
    });

    const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE) || 1;
    const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
    const paginatedJobs = filteredJobs.slice(startIndex, startIndex + JOBS_PER_PAGE);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, typeFilter]);

    const sparklineData = useMemo(() => {
        const now = new Date();
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });
        const countFor = (filterFn) =>
            months.map(({ year, month }) =>
                jobs.filter(j => {
                    const d = new Date(j.createdAt);
                    return d.getFullYear() === year && d.getMonth() === month && filterFn(j);
                }).length
            );
        return {
            total: countFor(() => true),
            open: countFor(j => j.status === 'Open'),
            closed: countFor(j => j.status === 'Closed'),
            onHold: countFor(j => j.status === 'On Hold')
        };
    }, [jobs]);

    const stats = { total: jobs.length, open: jobs.filter(j => j.status === 'Open').length, closed: jobs.filter(j => j.status === 'Closed').length, onHold: jobs.filter(j => j.status === 'On Hold').length };

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
                    <div className="skel" style={{ width: '160px', height: '22px', marginBottom: '6px' }} />
                    <div className="skel" style={{ width: '290px', height: '12px' }} />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div className="skel" style={{ width: '110px', height: '38px', borderRadius: '10px' }} />
                    <div className="skel" style={{ width: '115px', height: '38px', borderRadius: '10px' }} />
                    <div className="skel" style={{ width: '110px', height: '38px', borderRadius: '10px' }} />
                </div>
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
                <div className="skel" style={{ width: '72px', height: '36px', borderRadius: '10px' }} />
            </div>

            {/* Table Skeleton */}
            <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Table Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.1fr 1fr 1.1fr 0.9fr 1fr 60px', gap: '12px', padding: '11px 16px', background: '#fafafa', borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
                    {['JOB TITLE', 'DEPARTMENT', 'TYPE', 'EXPERIENCE', 'SALARY RANGE', 'POSTED ON', 'LOCATION', 'APPLICANTS', 'STATUS', 'ACTIONS'].map((col, i) => (
                        <div key={i} className="skel" style={{ width: i === 9 ? '44px' : '65px', height: '10px' }} />
                    ))}
                </div>

                {/* Table Rows */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr 1.1fr 1.1fr 0.9fr 1.1fr 1fr 60px', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f8fafc', alignItems: 'center' }}>
                            <div>
                                <div className="skel" style={{ width: `${110 + (i % 3) * 25}px`, height: '13px', marginBottom: '4px' }} />
                                <div className="skel" style={{ width: '70px', height: '9px' }} />
                            </div>
                            <div className="skel" style={{ width: '85px', height: '12px' }} />
                            <div className="skel" style={{ width: '65px', height: '22px', borderRadius: '6px' }} />
                            <div className="skel" style={{ width: '75px', height: '12px' }} />
                            <div className="skel" style={{ width: '32px', height: '12px' }} />
                            <div className="skel" style={{ width: '80px', height: '12px' }} />
                            <div className="skel" style={{ width: '60px', height: '22px', borderRadius: '999px' }} />
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
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
                .ist-action-btn { background: transparent; border: none; padding: 6px; border-radius: 8px; cursor: pointer; transition: all 0.2s; display: flex; alignItems: center; justifyContent: center; }
                .ist-action-btn:hover { background: #f1f5f9; }
                .ist-btn-primary { background: #0f172a; color: white; border: none; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
                .ist-btn-primary:hover { background: #1e293b; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,42,0.15); }
                
                .ist-tbl { font-family: 'Inter','Poppins','Segoe UI',sans-serif; width: 100%; border-collapse: collapse; }
                .ist-tbl thead tr { background: #fafafa; }
                .ist-tbl thead th { position: sticky; top: 0; z-index: 10; background: #fafafa; font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding: 7px 8px; text-align: left; white-space: nowrap; font-family: 'Inter','Poppins','Segoe UI',sans-serif; border-bottom: 1px solid #f1f5f9; }
                .ist-tbl tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .15s; }
                .ist-tbl tbody tr:hover { background: #fafffe; }
                .ist-tbl tbody td { font-size: 13px; color: #475569; padding: 6px 10px; vertical-align: middle; font-family: 'Inter','Poppins','Segoe UI',sans-serif; }
                .ist-tbl tbody tr:last-child { border-bottom: none; }
                
                @keyframes bubble-float-large { 0% { transform: translate(0px, 0px) scale(1); } 30% { transform: translate(-5px, -7px) scale(1.04); } 60% { transform: translate(4px, -4px) scale(0.97); } 100% { transform: translate(0px, 0px) scale(1); } }
                @keyframes bubble-float-small { 0% { transform: translate(0px, 0px) scale(1); } 40% { transform: translate(6px, -4px) scale(0.95); } 75% { transform: translate(-3px, 5px) scale(1.05); } 100% { transform: translate(0px, 0px) scale(1); } }
                .ist-stats-grid > div { position: relative; overflow: hidden; isolation: isolate; }
                .ist-stats-grid > div::before { content: ''; position: absolute; z-index: 0; width: 90px; height: 90px; border-radius: 50%; opacity: 0.06; right: -26px; bottom: -26px; pointer-events: none; animation: bubble-float-large 5.5s ease-in-out infinite; }
                .ist-stats-grid > div::after { content: ''; position: absolute; z-index: 0; width: 54px; height: 54px; border-radius: 50%; opacity: 0.04; right: 36px; bottom: -20px; pointer-events: none; animation: bubble-float-small 4.2s ease-in-out infinite; }
                .ist-stats-grid > div:nth-child(1)::before, .ist-stats-grid > div:nth-child(1)::after { background: #667eea; }
                .ist-stats-grid > div:nth-child(2)::before, .ist-stats-grid > div:nth-child(2)::after { background: #3b82f6; }
                .ist-stats-grid > div:nth-child(3)::before, .ist-stats-grid > div:nth-child(3)::after { background: #f59e0b; }
                .ist-stats-grid > div:nth-child(4)::before, .ist-stats-grid > div:nth-child(4)::after { background: #10b981; }
                .ist-stats-grid > div:nth-child(2)::before { animation-delay: 0.8s; } .ist-stats-grid > div:nth-child(3)::before { animation-delay: 1.5s; } .ist-stats-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
                .ist-stats-grid > div:nth-child(2)::after { animation-delay: 1.2s; } .ist-stats-grid > div:nth-child(3)::after { animation-delay: 0.5s; } .ist-stats-grid > div:nth-child(4)::after { animation-delay: 1.8s; }
                .job-modal { background: #fff; border-radius: 18px; width: 100%; max-width: 780px; max-height: 88vh; overflow-y: auto; border: 1px solid #e8edf0; box-shadow: 0 8px 40px rgba(0,0,0,0.13); font-family: 'Inter', 'Segoe UI', sans-serif; animation: jobModalIn 0.22s cubic-bezier(0.16,1,0.3,1); -ms-overflow-style: none; scrollbar-width: none; }
                .job-modal::-webkit-scrollbar { display: none; }
                .job-modal-sticky-head { position: sticky; top: 0; background: #fff; z-index: 100; border-bottom: 1px solid #f1f3f5; }
                .job-modal-hd { display: flex; align-items: center; gap: 12px; padding: 18px 20px 14px; background: #fafafa; border-radius: 18px 18px 0 0; }
                .job-modal-hd-icon { width: 36px; height: 36px; border-radius: 10px; background: rgba(59,119,94,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .job-modal-title { font-size: 14px; font-weight: 700; color: #111827; letter-spacing: -0.01em; line-height: 1.3; }
                .job-modal-sub { font-size: 11.5px; color: #9ca3af; margin-top: 2px; line-height: 1.3; }
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
                .desc-editor-card { background: #ffffff; border-radius: 20px; width: 100%; max-width: 720px; max-height: 90vh; border: 1px solid #e2e8f0; box-shadow: 0 25px 60px rgba(15, 23, 42, 0.22); overflow: hidden; animation: jobModalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1); display: flex; flex-direction: column; }
                .desc-tool-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; background: #f1f5f9; color: #334155; border-radius: 7px; font-size: 11.5px; font-weight: 500; border: 1px solid #e2e8f0; cursor: pointer; transition: all 0.15s ease; font-family: 'Inter', sans-serif; }
                .desc-tool-chip:hover { background: #e2e8f0; color: #0f172a; border-color: #cbd5e1; }
                .desc-editor-box { position: relative; border: 1.5px solid #e2e8f0; border-radius: 11px; background: #fafbfc; cursor: pointer; padding: 12px 14px; transition: all 0.2s ease; box-sizing: border-box; }
                .desc-editor-box:hover { border-color: #3b775e; background: #f6fbf8; box-shadow: 0 4px 14px rgba(59,119,94,0.08); }
                .desc-expand-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: #2d6a4f; background: #e8f5ed; padding: 3px 9px; border-radius: 6px; transition: all 0.15s; }
                .desc-editor-box:hover .desc-expand-badge { background: #3b775e; color: #ffffff; }
                @keyframes jobModalIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
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
                        Jobs Management
                    </h1>
                    <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>
                        Manage and monitor all job postings
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        type="button"
                        onClick={() => {
                            if (!qrData) generateQrData();
                            setShowQrModal(true);
                        }}
                        style={{
                            padding: '9px 16px',
                            border: '1.5px solid #3b775e',
                            borderRadius: '10px',
                            background: '#f0fdf4',
                            color: '#3b775e',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'all 0.2s',
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        <QrCode size={16} /> Preview QR
                    </button>


                    <button
                        onClick={handleAddClick}
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
                        <Plus size={16} /> Post New Job
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="ist-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                {[
                    { label: 'Total Jobs', value: stats.total, color: '#667eea', spark: sparklineData.total },
                    { label: 'Open', value: stats.open, color: '#3b82f6', spark: sparklineData.open },
                    { label: 'On Hold', value: stats.onHold, color: '#f59e0b', spark: sparklineData.onHold },
                    { label: 'Closed', value: stats.closed, color: '#10b981', spark: sparklineData.closed }
                ].map((s, i) => {
                    const cur = s.spark[5];
                    const prev = s.spark[4];
                    const trend = calcChange(cur, prev);
                    const up = isUp(cur, prev);
                    const isSelected = statusFilter === (s.label === 'Total Jobs' ? 'All' : s.label);
                    return (
                        <div
                            key={s.label}
                            style={{ background: 'white', padding: '14px 16px 10px', borderRadius: '12px', border: isSelected ? `2px solid ${s.color}` : '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.3s', overflow: 'hidden', position: 'relative' }}
                            onClick={() => setStatusFilter(s.label === 'Total Jobs' ? 'All' : s.label)}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            {/* Label row + trend badge */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>{s.label}</div>
                                <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: up ? 'rgba(168,230,61,0.15)' : 'rgba(239,68,68,0.1)', color: up ? '#3d7c00' : '#dc2626', whiteSpace: 'nowrap' }}>
                                    {up ? '▲' : '▼'} {trend}
                                </span>
                            </div>
                            {/* Value */}
                            <div style={{ fontSize: '26px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '8px' }}>{s.value}</div>
                            {/* Bottom: vs last month + sparkline */}
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
                    <input style={{ border: 'none', background: 'transparent', outline: 'none', padding: '8px 0', fontSize: '12px', width: '100%', color: '#334155' }} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search by title or department..." />
                </div>
                {/* Status Filter Custom Dropdown */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowStatusFilterDd(!showStatusFilterDd);
                            setShowTypeFilterDd(false);
                            setActiveStatusDropdown(null);
                            setActiveDropdown(null);
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
                            {[
                                { value: 'All', label: 'All Status', color: '#64748b' },
                                { value: 'Open', label: 'Open', color: '#166534' },
                                { value: 'On Hold', label: 'On Hold', color: '#854d0e' },
                                { value: 'Closed', label: 'Closed', color: '#991b1b' }
                            ].map(st => {
                                const isSelected = statusFilter === st.value;
                                return (
                                    <div
                                        key={st.value}
                                        className={`job-dd-option ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() => {
                                            setStatusFilter(st.value);
                                            setShowStatusFilterDd(false);
                                            setCurrentPage(1);
                                        }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
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
                                            color: isSelected ? '#0f172a' : '#475569',
                                            backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: st.color }}></span>
                                            <span>{st.label}</span>
                                        </div>
                                        {isSelected && <Check size={13} color="#3b775e" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Job Type Filter Custom Dropdown */}
                <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowTypeFilterDd(!showTypeFilterDd);
                            setShowStatusFilterDd(false);
                            setActiveStatusDropdown(null);
                            setActiveDropdown(null);
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
                            {[
                                { value: 'All', label: 'All Types' },
                                { value: 'Full-time', label: 'Full-time' },
                                { value: 'Part-time', label: 'Part-time' },
                                { value: 'Contract', label: 'Contract' },
                                { value: 'Internship', label: 'Internship' }
                            ].map(tf => {
                                const isSelected = typeFilter === tf.value;
                                return (
                                    <div
                                        key={tf.value}
                                        className={`job-dd-option ${isSelected ? 'is-selected' : ''}`}
                                        onClick={() => {
                                            setTypeFilter(tf.value);
                                            setShowTypeFilterDd(false);
                                            setCurrentPage(1);
                                        }}
                                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
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
                                            color: isSelected ? '#0f172a' : '#475569',
                                            backgroundColor: isSelected ? '#f1f5f9' : 'transparent',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        <span>{tf.label}</span>
                                        {isSelected && <Check size={13} color="#3b775e" />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                    <button onClick={() => setViewMode('table')} style={{ border: 'none', background: viewMode === 'table' ? '#fff' : 'transparent', color: viewMode === 'table' ? '#0f172a' : '#64748b', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }} title="Table view"><List size={14} /></button>
                    <button onClick={() => setViewMode('grid')} style={{ border: 'none', background: viewMode === 'grid' ? '#fff' : 'transparent', color: viewMode === 'grid' ? '#0f172a' : '#64748b', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }} title="Grid view"><LayoutGrid size={14} /></button>
                </div>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 24, overflowY: 'auto' }}>
                    {paginatedJobs.length === 0 && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#94a3b8', padding: 48, background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9' }}>No jobs found</div>}
                    {paginatedJobs.map(job => {
                        const sc = statusColors[job.status] || { bg: '#f1f5f9', color: '#475569' };
                        const tc = typeColors[job.type] || { bg: '#f1f5f9', color: '#475569' };
                        const appCount = getApplicantCount(job._id);
                        return (
                            <div key={job._id} style={{ background: 'white', borderRadius: 14, border: '1px solid #f1f5f9', padding: 20, position: 'relative', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
                                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 20px rgba(15,23,42,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.04)'}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}><Briefcase size={20} /></div>
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveStatusDropdown(activeStatusDropdown === job._id ? null : job._id);
                                                    setActiveDropdown(null);
                                                }}
                                                style={{
                                                    backgroundColor: '#fff',
                                                    color: sc.color,
                                                    border: `1.5px solid ${sc.color}`,
                                                    padding: '3px 10px',
                                                    borderRadius: 20,
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 6,
                                                    fontFamily: 'inherit',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sc.color }} />
                                                <span>{job.status}</span>
                                                <ChevronDown size={11} style={{ transform: activeStatusDropdown === job._id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                            </button>
                                            {activeStatusDropdown === job._id && (
                                                <div
                                                    style={{
                                                        position: 'absolute',
                                                        top: 'calc(100% + 6px)',
                                                        right: 0,
                                                        background: '#ffffff',
                                                        borderRadius: '12px',
                                                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                                                        border: '1px solid #e2e8f0',
                                                        zIndex: 1000,
                                                        minWidth: '130px',
                                                        padding: '6px',
                                                        animation: 'jobModalIn 0.15s ease'
                                                    }}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    {['Open', 'On Hold', 'Closed'].map(st => {
                                                        const optSc = statusColors[st] || { bg: '#f1f5f9', color: '#475569' };
                                                        const isSelected = job.status === st;
                                                        return (
                                                            <div
                                                                key={st}
                                                                className="job-dd-option"
                                                                onClick={() => {
                                                                    handleStatusChange(job._id, st);
                                                                    setActiveStatusDropdown(null);
                                                                }}
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
                                                                    transition: 'all 0.15s ease'
                                                                }}
                                                            >
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: optSc.color }}></span>
                                                                    <span>{st}</span>
                                                                </div>
                                                                {isSelected && <Check size={12} color={optSc.color} />}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={e => toggleDropdown(job._id, e)} className="ist-action-btn"><MoreVertical size={16} color="#64748b" /></button>
                                        {activeDropdown === job._id && (
                                            <div style={{ position: 'absolute', right: 16, top: 56, background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', zIndex: 10, minWidth: 140, overflow: 'hidden', padding: '6px' }}>
                                                <div style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onClick={() => handleViewClick(job)}><Eye size={14} /> View</div>
                                                <div style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: 12, color: '#334155', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onClick={() => handleEditClick(job)}><Pencil size={14} /> Edit</div>
                                                <div style={{ padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} onClick={() => handleDelete(job._id)}><Trash2 size={14} /> Delete</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 2 }}>{job.title}</div>
                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>{job.department}</div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                    <span style={{ ...tc, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>{job.type}</span>
                                    <span style={{ background: '#f8fafc', color: '#64748b', padding: '2px 8px', borderRadius: 20, fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}><MapPin size={10} /> {job.location}</span>
                                    {formatSalaryRange(job.minSalary, job.maxSalary, job.salaryPeriod) && (
                                        <span style={{ background: '#f8fafc', color: '#475569', padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
                                            {formatSalaryRange(job.minSalary, job.maxSalary, job.salaryPeriod)}
                                        </span>
                                    )}
                                </div>
                                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {appCount} applicants</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b' }}>Posted {formatDate(job.createdAt)}</div>
                                </div>
                            </div>
                        );
                    })}
                    {filteredJobs.length > 0 && (
                        <div style={{ gridColumn: '1/-1', padding: '14px 20px', background: '#fff', borderRadius: '14px', border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                                Page <strong style={{ color: '#0f172a' }}>{currentPage}</strong> of <strong style={{ color: '#0f172a' }}>{totalPages}</strong> (Showing <strong style={{ color: '#0f172a' }}>{paginatedJobs.length}</strong> of <strong style={{ color: '#0f172a' }}>{filteredJobs.length}</strong> jobs)
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                    disabled={currentPage <= 1}
                                    onClick={() => setCurrentPage(p => p - 1)}
                                    style={{
                                        padding: '6px 14px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        background: currentPage <= 1 ? '#f8fafc' : '#fff',
                                        color: currentPage <= 1 ? '#94a3b8' : '#475569',
                                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    ← Prev
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    const isActive = pageNum === currentPage;
                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            style={{
                                                minWidth: '32px',
                                                height: '32px',
                                                padding: '0 8px',
                                                borderRadius: '8px',
                                                border: isActive ? '1px solid #3b775e' : '1px solid #e2e8f0',
                                                background: isActive ? 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)' : '#fff',
                                                color: isActive ? '#fff' : '#475569',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                boxShadow: 'none',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            {pageNum}
                                        </button>
                                    );
                                })}
                                <button
                                    disabled={currentPage >= totalPages}
                                    onClick={() => setCurrentPage(p => p + 1)}
                                    style={{
                                        padding: '6px 14px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        background: currentPage >= totalPages ? '#f8fafc' : '#fff',
                                        color: currentPage >= totalPages ? '#94a3b8' : '#475569',
                                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Table View */}
            {viewMode === 'table' && (
                <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ overflowX: 'auto', flex: 1 }}>
                        <table className="ist-tbl">
                            <thead>
                                <tr>
                                    <th>Sr.</th>
                                    <th>Job Title</th>
                                    <th>Department</th>
                                    <th>Job Type</th>
                                    <th>Experience</th>
                                    <th>Salary Range (INR)</th>
                                    <th>Posted On</th>
                                    <th>Location</th>
                                    <th>Applicants</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedJobs.length > 0 ? paginatedJobs.map((job, i) => {
                                    const index = startIndex + i;
                                    const sc = statusColors[job.status] || { bg: '#f1f5f9', color: '#475569' };
                                    const appCount = getApplicantCount(job._id);
                                    const salRange = formatSalaryRange(job.minSalary, job.maxSalary, job.salaryPeriod);
                                    const expRange = formatExperienceRange(job.minExperience, job.minExpUnit, job.maxExperience, job.maxExpUnit);
                                    return (
                                        <tr key={job._id}>
                                            <td style={{ color: '#64748b', fontWeight: 500 }}>{index + 1}</td>
                                            <td>
                                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px', lineHeight: 1.2 }}>{job.title}</div>
                                            </td>
                                            <td style={{ color: '#475569', fontWeight: 500 }}>{job.department}</td>
                                            <td>
                                                <span style={{ ...(typeColors[job.type] || {}), padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: `1px solid ${(typeColors[job.type] || {}).color || '#ccc'}`, backgroundColor: '#fff', color: (typeColors[job.type] || {}).color }}>{job.type}</span>
                                            </td>
                                            <td style={{ color: expRange ? '#334155' : '#94a3b8', fontWeight: expRange ? 500 : 400, fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                {expRange || '—'}
                                            </td>
                                            <td style={{ color: salRange ? '#334155' : '#94a3b8', fontWeight: salRange ? 500 : 400, fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                {salRange || '—'}
                                            </td>
                                            <td style={{ color: '#64748b', fontWeight: 500 }}>{formatDate(job.createdAt)}</td>
                                            <td style={{ color: '#475569', fontWeight: 500 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} style={{ color: '#94a3b8' }} /> {job.location}</div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#3b82f6', fontWeight: 600 }} onClick={() => navigate('/recruitment/job-applications')}>
                                                    <Users size={14} /> {appCount}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveStatusDropdown(activeStatusDropdown === job._id ? null : job._id);
                                                            setActiveDropdown(null);
                                                        }}
                                                        style={{
                                                            backgroundColor: '#fff',
                                                            color: sc.color,
                                                            border: `1.5px solid ${sc.color}`,
                                                            padding: '3px 10px',
                                                            borderRadius: 20,
                                                            fontSize: 11,
                                                            fontWeight: 600,
                                                            cursor: 'pointer',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            fontFamily: 'inherit',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: sc.color }} />
                                                        <span>{job.status}</span>
                                                        <ChevronDown size={11} style={{ transform: activeStatusDropdown === job._id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                                    </button>
                                                    {activeStatusDropdown === job._id && (
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
                                                                minWidth: '130px',
                                                                padding: '6px',
                                                                animation: 'jobModalIn 0.15s ease'
                                                            }}
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            {['Open', 'On Hold', 'Closed'].map(st => {
                                                                const optSc = statusColors[st] || { bg: '#f1f5f9', color: '#475569' };
                                                                const isSelected = job.status === st;
                                                                return (
                                                                    <div
                                                                        key={st}
                                                                        className="job-dd-option"
                                                                        onClick={() => {
                                                                            handleStatusChange(job._id, st);
                                                                            setActiveStatusDropdown(null);
                                                                        }}
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
                                                                            transition: 'all 0.15s ease'
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: optSc.color }}></span>
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
                                            <td style={{ textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                    <button className="ist-action-btn" title="View" onClick={() => handleViewClick(job)} onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <Eye size={14} color="#16a34a" />
                                                    </button>
                                                    <button className="ist-action-btn" title="Edit" onClick={() => handleEditClick(job)} onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <Pencil size={14} color="#2563eb" />
                                                    </button>
                                                    <button className="ist-action-btn" title="Delete" onClick={() => handleDelete(job._id)} onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <Trash2 size={14} color="#ef4444" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8', fontSize: '13px' }}>No jobs found. Click "Post New Job" to create one.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Footer */}
                    <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>
                            Page <strong style={{ color: '#0f172a' }}>{currentPage}</strong> of <strong style={{ color: '#0f172a' }}>{totalPages}</strong> (Showing <strong style={{ color: '#0f172a' }}>{paginatedJobs.length}</strong> of <strong style={{ color: '#0f172a' }}>{filteredJobs.length}</strong> jobs)
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage(p => p - 1)}
                                style={{
                                    padding: '6px 14px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    background: currentPage <= 1 ? '#f8fafc' : '#fff',
                                    color: currentPage <= 1 ? '#94a3b8' : '#475569',
                                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                ← Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) pageNum = i + 1;
                                else if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;
                                const isActive = pageNum === currentPage;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        style={{
                                            minWidth: '32px',
                                            height: '32px',
                                            padding: '0 8px',
                                            borderRadius: '8px',
                                            border: isActive ? '1px solid #3b775e' : '1px solid #e2e8f0',
                                            background: isActive ? 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)' : '#fff',
                                            color: isActive ? '#fff' : '#475569',
                                            cursor: 'pointer',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            boxShadow: 'none',
                                            transition: 'all 0.15s ease'
                                        }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage(p => p + 1)}
                                style={{
                                    padding: '6px 14px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: '1px solid #e2e8f0',
                                    background: currentPage >= totalPages ? '#f8fafc' : '#fff',
                                    color: currentPage >= totalPages ? '#94a3b8' : '#475569',
                                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                Next →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="rc-modal-overlay" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', padding: '24px', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowModal(false)}>
                    <div className="job-modal" onClick={e => e.stopPropagation()}>
                        <div className="job-modal-sticky-head">
                            <div className="job-modal-hd">
                                <div className="job-modal-hd-icon">
                                    <Pencil size={18} color="#3b775e" />
                                </div>
                                <div>
                                    <div className="job-modal-title">{isEditing ? 'Edit Job' : 'Post New Job'}</div>
                                    <div className="job-modal-sub">{isEditing ? `Update details for ${formData.title || 'this job'}` : 'Fill in the details to create a new job posting'}</div>
                                </div>
                                <button className="job-close-btn" onClick={() => setShowModal(false)}>&times;</button>
                            </div>
                        </div>

                        <form onSubmit={handleFormSubmit} className="job-modal-body" autoComplete="off">
                            <div className="job-form">
                                <div className="job-section-lbl">Job Details</div>
                                <div className="job-field-row">
                                    <div className="job-field">
                                        <label className="job-lbl">Job Title<span className="job-req">*</span></label>
                                        <input name="title" type="text" className="job-input" placeholder="e.g. Senior Software Engineer" value={formData.title} onChange={handleFormChange} required />
                                    </div>
                                    <div className="job-field">
                                        <label className="job-lbl">Department<span className="job-req">*</span></label>
                                        <div style={{ position: 'relative' }}>
                                            <button type="button" className="job-dd-btn" onClick={(e) => { e.stopPropagation(); setShowDeptDd(!showDeptDd); setShowTypeDd(false); setShowLocDd(false); }}>
                                                {formData.department || "Select Department"}
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                            </button>
                                            {showDeptDd && (
                                                <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <input type="text" className="job-dd-search-input" placeholder="Search or add department..." value={deptSearch} onChange={(e) => setDeptSearch(e.target.value)} />
                                                    </div>
                                                    <div className="job-dd-scroll">
                                                        <div className="job-dd-option" onClick={() => { setFormData({ ...formData, department: "" }); setShowDeptDd(false); setDeptSearch(""); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: formData.department === "" ? '600' : 'normal' }}>
                                                            <span>Select Department</span>
                                                            {formData.department === "" && <Check size={13} color="#15803d" />}
                                                        </div>
                                                        {departments.filter(d => d.toLowerCase().includes(deptSearch.toLowerCase())).map(dept => {
                                                            const isSel = formData.department === dept;
                                                            return (
                                                                <div key={dept} className="job-dd-option" onClick={() => { setFormData({ ...formData, department: dept }); setShowDeptDd(false); setDeptSearch(""); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: isSel ? '600' : 'normal', color: isSel ? '#15803d' : '#334155', background: isSel ? '#f0fdf4' : 'transparent' }}>
                                                                    <span>{dept}</span>
                                                                    {isSel && <Check size={13} color="#15803d" />}
                                                                </div>
                                                            );
                                                        })}
                                                        {deptSearch.trim() && !departments.some(d => d.toLowerCase() === deptSearch.trim().toLowerCase()) && (
                                                            <div
                                                                className="job-dd-option"
                                                                style={{ color: '#15803d', fontWeight: 600, borderTop: '1px dashed #e2e8f0', marginTop: '4px' }}
                                                                onClick={() => {
                                                                    const newDept = deptSearch.trim();
                                                                    if (!departments.includes(newDept)) {
                                                                        setDepartments(prev => [...prev, newDept].sort());
                                                                    }
                                                                    setFormData({ ...formData, department: newDept });
                                                                    setShowDeptDd(false);
                                                                    setDeptSearch("");
                                                                }}
                                                            >
                                                                + Add "{deptSearch.trim()}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="job-field-row">
                                    <div className="job-field">
                                        <label className="job-lbl">Job Type</label>
                                        <div style={{ position: 'relative' }}>
                                            <button type="button" className="job-dd-btn" onClick={(e) => { e.stopPropagation(); setShowTypeDd(!showTypeDd); setShowDeptDd(false); setShowLocDd(false); setShowStatusModalDd(false); }}>
                                                {formData.type || "Select Type"}
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showTypeDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}><polyline points="6 9 12 15 18 9" /></svg>
                                            </button>
                                            {showTypeDd && (
                                                <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <input type="text" className="job-dd-search-input" placeholder="Search job type..." value={typeSearch} onChange={(e) => setTypeSearch(e.target.value)} />
                                                    </div>
                                                    <div className="job-dd-scroll">
                                                        {JOB_TYPES.filter(d => d.toLowerCase().includes(typeSearch.toLowerCase())).map(type => {
                                                            const isSel = formData.type === type;
                                                            return (
                                                                <div key={type} className="job-dd-option" onClick={() => { setFormData({ ...formData, type: type }); setShowTypeDd(false); setTypeSearch(""); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: isSel ? '600' : 'normal', color: isSel ? '#15803d' : '#334155', background: isSel ? '#f0fdf4' : 'transparent' }}>
                                                                    <span>{type}</span>
                                                                    {isSel && <Check size={13} color="#15803d" />}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="job-field">
                                        <label className="job-lbl">Location</label>
                                        <div style={{ position: 'relative' }}>
                                            <button type="button" className="job-dd-btn" onClick={(e) => { e.stopPropagation(); setShowLocDd(!showLocDd); setShowDeptDd(false); setShowTypeDd(false); setShowStatusModalDd(false); }}>
                                                {formData.location || "Select Location"}
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showLocDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}><polyline points="6 9 12 15 18 9" /></svg>
                                            </button>
                                            {showLocDd && (
                                                <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <input type="text" className="job-dd-search-input" placeholder="Search location..." value={locSearch} onChange={(e) => setLocSearch(e.target.value)} />
                                                    </div>
                                                    <div className="job-dd-scroll">
                                                        <div className="job-dd-option" onClick={() => { setFormData({ ...formData, location: "" }); setShowLocDd(false); setLocSearch(""); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: formData.location === "" ? '600' : 'normal' }}>
                                                            <span>Select Location</span>
                                                            {formData.location === "" && <Check size={13} color="#15803d" />}
                                                        </div>
                                                        {LOCATIONS.filter(d => d.toLowerCase().includes(locSearch.toLowerCase())).map(loc => {
                                                            const isSel = formData.location === loc;
                                                            return (
                                                                <div key={loc} className="job-dd-option" onClick={() => { setFormData({ ...formData, location: loc }); setShowLocDd(false); setLocSearch(""); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: isSel ? '600' : 'normal', color: isSel ? '#15803d' : '#334155', background: isSel ? '#f0fdf4' : 'transparent' }}>
                                                                    <span>{loc}</span>
                                                                    {isSel && <Check size={13} color="#15803d" />}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="job-section-lbl" style={{ marginTop: '10px' }}>Salary Range {formData.salaryPeriod === 'per annum' ? '(CTC / LPA)' : '(INR ₹)'}</div>
                                <div className="job-field-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                    <div className="job-field">
                                        <label className="job-lbl">Min Salary {formData.salaryPeriod === 'per annum' ? '(LPA / ₹)' : '(INR ₹)'}</label>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <span style={{ position: 'absolute', left: '12px', fontSize: '13.5px', fontWeight: '700', color: '#64748b', pointerEvents: 'none' }}>₹</span>
                                            <input
                                                name="minSalary"
                                                type="number"
                                                min="0"
                                                step="any"
                                                className="job-input"
                                                placeholder={formData.salaryPeriod === 'per annum' ? "e.g. 3.5 or 350000" : "e.g. 25000"}
                                                style={{ paddingLeft: '28px' }}
                                                value={formData.minSalary}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="job-field">
                                        <label className="job-lbl">Max Salary {formData.salaryPeriod === 'per annum' ? '(LPA / ₹)' : '(INR ₹)'}</label>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <span style={{ position: 'absolute', left: '12px', fontSize: '13.5px', fontWeight: '700', color: '#64748b', pointerEvents: 'none' }}>₹</span>
                                            <input
                                                name="maxSalary"
                                                type="number"
                                                min="0"
                                                step="any"
                                                className="job-input"
                                                placeholder={formData.salaryPeriod === 'per annum' ? "e.g. 6 or 600000" : "e.g. 50000"}
                                                style={{ paddingLeft: '28px' }}
                                                value={formData.maxSalary}
                                                onChange={handleFormChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="job-field">
                                        <label className="job-lbl">Pay Period</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', height: '39px', alignItems: 'center' }}>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, salaryPeriod: 'per month' })}
                                                style={{
                                                    height: '100%',
                                                    border: (formData.salaryPeriod || 'per month') === 'per month' ? '1.5px solid #3b775e' : '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    background: (formData.salaryPeriod || 'per month') === 'per month' ? '#f0fdf4' : '#fff',
                                                    color: (formData.salaryPeriod || 'per month') === 'per month' ? '#166534' : '#64748b',
                                                    fontWeight: (formData.salaryPeriod || 'per month') === 'per month' ? 700 : 500,
                                                    fontSize: '11.5px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                / Month
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, salaryPeriod: 'per annum' })}
                                                style={{
                                                    height: '100%',
                                                    border: formData.salaryPeriod === 'per annum' ? '1.5px solid #3b775e' : '1px solid #e2e8f0',
                                                    borderRadius: '8px',
                                                    background: formData.salaryPeriod === 'per annum' ? '#f0fdf4' : '#fff',
                                                    color: formData.salaryPeriod === 'per annum' ? '#166534' : '#64748b',
                                                    fontWeight: formData.salaryPeriod === 'per annum' ? 700 : 500,
                                                    fontSize: '11.5px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                / Year (CTC)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {(formData.minSalary || formData.maxSalary) && (
                                    <div style={{ fontSize: '11.5px', color: '#166534', background: '#f0fdf4', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                        <span>✨ Salary Preview:</span>
                                        <span style={{ color: '#0f172a' }}>{formatSalaryRange(formData.minSalary, formData.maxSalary, formData.salaryPeriod, true)}</span>
                                    </div>
                                )}

                                <div className="job-section-lbl" style={{ marginTop: '10px' }}>Experience Range</div>
                                <div className="job-field-row">
                                    <div className="job-field">
                                        <label className="job-lbl">Minimum Experience</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                name="minExperience"
                                                type="number"
                                                min="0"
                                                step="0.5"
                                                className="job-input"
                                                placeholder="e.g. 1"
                                                style={{ flex: 1 }}
                                                value={formData.minExperience}
                                                onChange={handleFormChange}
                                            />
                                            <select
                                                name="minExpUnit"
                                                value={formData.minExpUnit || 'years'}
                                                onChange={handleFormChange}
                                                style={{
                                                    width: '110px',
                                                    padding: '9px 10px',
                                                    borderRadius: '9px',
                                                    border: '1.5px solid #e5e7eb',
                                                    background: '#fff',
                                                    color: '#334155',
                                                    fontSize: '13px',
                                                    fontWeight: 500,
                                                    outline: 'none',
                                                    cursor: 'pointer',
                                                    fontFamily: "'Inter', sans-serif"
                                                }}
                                            >
                                                <option value="years">Years</option>
                                                <option value="months">Months</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="job-field">
                                        <label className="job-lbl">Maximum Experience</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input
                                                name="maxExperience"
                                                type="number"
                                                min="0"
                                                step="0.5"
                                                className="job-input"
                                                placeholder="e.g. 3"
                                                style={{ flex: 1 }}
                                                value={formData.maxExperience}
                                                onChange={handleFormChange}
                                            />
                                            <select
                                                name="maxExpUnit"
                                                value={formData.maxExpUnit || 'years'}
                                                onChange={handleFormChange}
                                                style={{
                                                    width: '110px',
                                                    padding: '9px 10px',
                                                    borderRadius: '9px',
                                                    border: '1.5px solid #e5e7eb',
                                                    background: '#fff',
                                                    color: '#334155',
                                                    fontSize: '13px',
                                                    fontWeight: 500,
                                                    outline: 'none',
                                                    cursor: 'pointer',
                                                    fontFamily: "'Inter', sans-serif"
                                                }}
                                            >
                                                <option value="years">Years</option>
                                                <option value="months">Months</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                {(formData.minExperience !== '' || formData.maxExperience !== '') && (
                                    <div style={{ fontSize: '11.5px', color: '#166534', background: '#f0fdf4', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                        <span>✨ Experience Preview:</span>
                                        <span style={{ color: '#0f172a' }}>{formatExperienceRange(formData.minExperience, formData.minExpUnit, formData.maxExperience, formData.maxExpUnit)}</span>
                                    </div>
                                )}

                                {isEditing && (
                                    <>
                                        <div className="job-section-lbl" style={{ marginTop: '10px' }}>Job Status</div>
                                        <div className="job-field">
                                            <label className="job-lbl">Status</label>
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    type="button"
                                                    className="job-dd-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowStatusModalDd(!showStatusModalDd);
                                                        setShowDeptDd(false);
                                                        setShowTypeDd(false);
                                                        setShowLocDd(false);
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: (statusColors[formData.status] || {}).color || '#166534' }} />
                                                        <span>{formData.status || 'Open'}</span>
                                                    </div>
                                                    <ChevronDown size={14} style={{ color: '#94a3b8', transform: showStatusModalDd ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                                                </button>
                                                {showStatusModalDd && (
                                                    <div className="job-dd-menu" onClick={e => e.stopPropagation()}>
                                                        <div className="job-dd-scroll">
                                                            {['Open', 'On Hold', 'Closed'].map(st => {
                                                                const sc = statusColors[st] || { bg: '#f1f5f9', color: '#475569' };
                                                                const isSel = formData.status === st;
                                                                return (
                                                                    <div
                                                                        key={st}
                                                                        className="job-dd-option"
                                                                        onClick={() => {
                                                                            setFormData({ ...formData, status: st });
                                                                            setShowStatusModalDd(false);
                                                                        }}
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'space-between',
                                                                            fontWeight: isSel ? '600' : '500',
                                                                            color: sc.color,
                                                                            backgroundColor: isSel ? sc.bg : 'transparent',
                                                                            padding: '7px 10px',
                                                                            borderRadius: '8px'
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: sc.color }} />
                                                                            <span>{st}</span>
                                                                        </div>
                                                                        {isSel && <Check size={12} color={sc.color} />}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <div className="job-section-lbl" style={{ marginTop: '10px' }}>Description</div>
                                <div className="job-field" style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <label className="job-lbl" style={{ margin: 0 }}>Job Description<span className="job-req">*</span></label>
                                        <button
                                            type="button"
                                            className="desc-expand-badge"
                                            style={{ border: 'none', cursor: 'pointer' }}
                                            onClick={() => openTextEditor('description')}
                                        >
                                            <Maximize2 size={12} /> Click to open full card
                                        </button>
                                    </div>
                                    <div
                                        className="desc-editor-box"
                                        onClick={() => openTextEditor('description')}
                                        title="Click to write and view description in full card editor"
                                    >
                                        {formData.description ? (
                                            <div style={{ fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap', maxHeight: '88px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: '1.55' }}>
                                                {formData.description}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12.5px', padding: '8px 0' }}>
                                                <AlignLeft size={16} color="#94a3b8" />
                                                <span>Click here to write and view role description in full card...</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                                            <span style={{ color: '#3b775e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Pencil size={11} /> Open editor card
                                            </span>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        name="description"
                                        value={formData.description}
                                        required
                                        tabIndex={-1}
                                        style={{ opacity: 0, height: 0, width: 0, position: 'absolute', pointerEvents: 'none' }}
                                        onChange={() => {}}
                                    />
                                </div>
                                <div className="job-field" style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <label className="job-lbl" style={{ margin: 0 }}>Requirements</label>
                                        <button
                                            type="button"
                                            className="desc-expand-badge"
                                            style={{ border: 'none', cursor: 'pointer' }}
                                            onClick={() => openTextEditor('requirements')}
                                        >
                                            <Maximize2 size={12} /> Click to open full card
                                        </button>
                                    </div>
                                    <div
                                        className="desc-editor-box"
                                        onClick={() => openTextEditor('requirements')}
                                        title="Click to write and view requirements in full card editor"
                                    >
                                        {formData.requirements ? (
                                            <div style={{ fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: '1.55' }}>
                                                {formData.requirements}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12.5px', padding: '8px 0' }}>
                                                <AlignLeft size={16} color="#94a3b8" />
                                                <span>Click here to write skills, qualifications and requirements...</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                                            <span style={{ color: '#3b775e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Pencil size={11} /> Open editor card
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="job-field" style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <label className="job-lbl" style={{ margin: 0 }}>Eligibility Criteria</label>
                                        <button
                                            type="button"
                                            className="desc-expand-badge"
                                            style={{ border: 'none', cursor: 'pointer' }}
                                            onClick={() => openTextEditor('eligibilityCriteria')}
                                        >
                                            <Maximize2 size={12} /> Click to open full card
                                        </button>
                                    </div>
                                    <div
                                        className="desc-editor-box"
                                        onClick={() => openTextEditor('eligibilityCriteria')}
                                        title="Click to write and view eligibility criteria in full card editor"
                                    >
                                        {formData.eligibilityCriteria ? (
                                            <div style={{ fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: '1.55' }}>
                                                {formData.eligibilityCriteria}
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12.5px', padding: '8px 0' }}>
                                                <AlignLeft size={16} color="#94a3b8" />
                                                <span>Click here to write or paste eligibility criteria points...</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', fontSize: '11px', color: '#64748b' }}>
                                            <span style={{ color: '#3b775e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Pencil size={11} /> Open editor card
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="job-footer">
                                <button type="button" className="job-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="job-btn-primary">{isEditing ? 'Update Job' : 'Post Job'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Separate Full-Card Description / Requirements Editor Modal */}
            {activeTextEditor && (
                <div
                    className="rc-modal-overlay"
                    style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(6px)',
                        padding: '20px',
                        zIndex: 1200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                    onClick={closeTextEditor}
                >
                    <div
                        className="desc-editor-card"
                        style={{ maxWidth: '760px', width: '92%' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{ padding: '16px 22px', borderBottom: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(59,119,94,0.12)', color: '#3b775e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={18} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                                        {activeTextEditor === 'description' ? 'Job Description' : activeTextEditor === 'requirements' ? 'Job Requirements' : 'Eligibility Criteria'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                                        Paste or write your content. Line breaks, bullets and indentation are preserved exactly as copied.
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {formData[activeTextEditor] && (
                                    <button
                                        type="button"
                                        style={{ fontSize: '11.5px', color: '#ef4444', background: '#fee2e2', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                        onClick={() => {
                                            if (window.confirm('Clear all text?')) {
                                                setFormData(prev => ({ ...prev, [activeTextEditor]: '' }));
                                            }
                                        }}
                                    >
                                        Clear
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="job-close-btn"
                                    onClick={closeTextEditor}
                                    style={{ width: '30px', height: '30px' }}
                                >
                                    &times;
                                </button>
                            </div>
                        </div>

                        {/* Direct Spacious Textarea Field */}
                        <div style={{ padding: '18px 22px', background: '#ffffff' }}>
                            <textarea
                                autoFocus
                                rows={14}
                                value={formData[activeTextEditor] || ''}
                                onChange={(e) => setFormData({ ...formData, [activeTextEditor]: e.target.value })}
                                placeholder={
                                    activeTextEditor === 'description'
                                        ? "Paste or write your full job description here (line breaks, spacing and bullet points will be preserved exactly)..."
                                        : activeTextEditor === 'requirements'
                                        ? "Paste or write requirements and qualifications here..."
                                        : "Paste or write eligibility criteria, degree, experience, skills or bullet points here (exact formatting, spacing and line breaks will be preserved)..."
                                }
                                style={{
                                    width: '100%',
                                    minHeight: '340px',
                                    maxHeight: '58vh',
                                    padding: '16px 18px',
                                    fontSize: '13.5px',
                                    lineHeight: '1.65',
                                    color: '#0f172a',
                                    background: '#fafbfc',
                                    border: '1.5px solid #cbd5e1',
                                    borderRadius: '12px',
                                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)',
                                    outline: 'none',
                                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                                    boxSizing: 'border-box',
                                    resize: 'vertical',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    tabSize: 4
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#3b775e';
                                    e.target.style.background = '#ffffff';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.1)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#cbd5e1';
                                    e.target.style.background = '#fafbfc';
                                    e.target.style.boxShadow = 'inset 0 1px 2px rgba(0,0,0,0.03)';
                                }}
                            />
                        </div>

                        {/* Card Footer */}
                        <div style={{ padding: '14px 22px', background: '#fafbfc', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                Formatted text & line breaks are preserved automatically.
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    type="button"
                                    className="job-btn-ghost"
                                    style={{ padding: '8px 18px', fontSize: '12px' }}
                                    onClick={closeTextEditor}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="job-btn-primary"
                                    style={{ padding: '8px 22px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onClick={closeTextEditor}
                                >
                                    <Check size={14} /> Done & Apply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View Details Modal */}
            {viewJob && (
                <div className="rc-modal-overlay">
                    <div className="rc-modal">
                        <div className="rc-modal-header">
                            <div>
                                <h3 className="rc-modal-title">{viewJob.title}</h3>
                                <div style={{ fontSize: 12, color: 'var(--rc-text-2)', marginTop: 2 }}>{viewJob.department}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <span className="rc-badge" style={{ ...(statusColors[viewJob.status] || {}) }}>{viewJob.status}</span>
                                <button className="rc-modal-close" onClick={() => setViewJob(null)}>×</button>
                            </div>
                        </div>
                        <div style={{ padding: 24 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                                {[
                                    { l: 'Type', v: viewJob.type },
                                    { l: 'Experience Required', v: formatExperienceRange(viewJob.minExperience, viewJob.minExpUnit, viewJob.maxExperience, viewJob.maxExpUnit) || 'Not specified' },
                                    { l: 'Salary Range (INR)', v: formatSalaryRange(viewJob.minSalary, viewJob.maxSalary, viewJob.salaryPeriod) || 'Not Disclosed' },
                                    { l: 'Location', v: viewJob.location },
                                    { l: 'Posted', v: new Date(viewJob.createdAt).toLocaleDateString() }
                                ].map((f, i) => (
                                    <div key={i} style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px' }}>
                                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{f.l}</div>
                                        <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 500 }}>{f.v}</div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8, fontSize: 13 }}>Description</div>
                                <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 8, padding: 14 }}>{viewJob.description}</div>
                            </div>
                            {viewJob.requirements && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8, fontSize: 13 }}>Requirements</div>
                                    <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 8, padding: 14 }}>{viewJob.requirements}</div>
                                </div>
                            )}
                            {viewJob.eligibilityCriteria && (
                                <div style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 8, fontSize: 13 }}>Eligibility Criteria</div>
                                    <div style={{ color: '#475569', fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#f8fafc', borderRadius: 8, padding: 14 }}>{viewJob.eligibilityCriteria}</div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--rc-border-light)' }}>
                                <button onClick={() => { setViewJob(null); handleEditClick(viewJob); }} className="rc-btn rc-btn-primary"><Pencil size={13} /> Edit Job</button>
                                <button onClick={() => setViewJob(null)} className="rc-btn rc-btn-secondary">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Preview & Regenerate Modal */}
            {showQrModal && qrData && (
                <div
                    className="rc-modal-overlay"
                    style={{
                        background: 'rgba(15, 23, 42, 0.45)',
                        backdropFilter: 'blur(5px)',
                        padding: '24px',
                        zIndex: 1100,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'jobModalIn 0.2s ease'
                    }}
                    onClick={() => setShowQrModal(false)}
                >
                    <div
                        className="job-modal"
                        style={{
                            maxWidth: '460px',
                            borderRadius: '20px',
                            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
                            overflow: 'hidden'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="job-modal-sticky-head">
                            <div className="job-modal-hd" style={{ background: '#fafafa', borderBottom: '1px solid #f1f3f5' }}>
                                <div className="job-modal-hd-icon" style={{ background: 'rgba(59,119,94,0.12)', color: '#3b775e' }}>
                                    <QrCode size={20} />
                                </div>
                                <div>
                                    <div className="job-modal-title" style={{ fontSize: '15px' }}>Careers & Job Openings QR Code</div>
                                    <div className="job-modal-sub" style={{ fontSize: '12px' }}>Scan to explore all open positions & apply</div>
                                </div>
                                <button className="job-close-btn" onClick={() => setShowQrModal(false)}>&times;</button>
                            </div>
                        </div>

                        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {/* QR Code Container */}
                            <div
                                style={{
                                    background: '#ffffff',
                                    border: '2px solid #e2e8f0',
                                    borderRadius: '16px',
                                    padding: '16px',
                                    boxShadow: '0 8px 24px rgba(15,23,42,0.06)',
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: '260px',
                                    minWidth: '260px'
                                }}
                            >
                                {isRegeneratingQr ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#3b775e' }}>
                                        <RefreshCw size={32} style={{ animation: 'spin 0.8s linear infinite' }} />
                                        <span style={{ fontSize: '12.5px', fontWeight: 600 }}>Regenerating QR Code...</span>
                                    </div>
                                ) : (
                                    <img
                                        src={qrData.qrUrl}
                                        alt="Job Application QR Code"
                                        style={{ width: '220px', height: '220px', display: 'block', borderRadius: '8px' }}
                                    />
                                )}
                            </div>

                            <div style={{ marginTop: '16px', textAlign: 'center' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '11.5px', fontWeight: 600 }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                                    Active Careers Portal Link
                                </span>
                                <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '6px 0 0' }}>
                                    Generated: {new Date(qrData.generatedAt).toLocaleString()}
                                </p>
                            </div>

                            {/* Direct Link & Copy */}
                            <div style={{ width: '100%', marginTop: '16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', boxSizing: 'border-box' }}>
                                <div style={{ fontSize: '11.5px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                    {qrData.url}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleCopyQrLink}
                                    style={{
                                        border: 'none',
                                        background: copiedQrLink ? '#dcfce7' : '#fff',
                                        color: copiedQrLink ? '#166534' : '#334155',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '6px',
                                        padding: '4px 8px',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        flexShrink: 0,
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {copiedQrLink ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ width: '100%', display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'space-between', boxSizing: 'border-box' }}>
                                <button
                                    type="button"
                                    onClick={handleRegenerateQr}
                                    disabled={isRegeneratingQr}
                                    style={{
                                        flex: 1,
                                        padding: '9px 14px',
                                        borderRadius: '10px',
                                        border: '1.5px solid #e2e8f0',
                                        background: '#fff',
                                        color: '#334155',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                                >
                                    <RefreshCw size={14} style={{ animation: isRegeneratingQr ? 'spin 0.8s linear infinite' : 'none' }} />
                                    Regenerate QR
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDownloadQr}
                                    disabled={isDownloadingQr}
                                    style={{
                                        flex: 1,
                                        padding: '9px 14px',
                                        borderRadius: '10px',
                                        border: 'none',
                                        background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                                        color: '#fff',
                                        fontSize: '12.5px',
                                        fontWeight: 600,
                                        cursor: isDownloadingQr ? 'wait' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        transition: 'all 0.15s ease',
                                        opacity: isDownloadingQr ? 0.8 : 1
                                    }}
                                    onMouseEnter={e => { if (!isDownloadingQr) e.currentTarget.style.opacity = '0.92'; }}
                                    onMouseLeave={e => { if (!isDownloadingQr) e.currentTarget.style.opacity = '1'; }}
                                >
                                    {isDownloadingQr ? (
                                        <>
                                            <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                                            Downloading...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={14} />
                                            Download
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobsList;
