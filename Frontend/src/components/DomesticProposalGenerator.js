import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import mammoth from 'mammoth';
import PaginatedProjectPreview from './PaginatedProjectPreview';
import CanvaTextEditor from './CanvaTextEditor';
import './ProposalGenerator.css';

// Convert Mammoth generated HTML to structured proposal markdown/HTML text format
function htmlToProposalMarkdown(html) {
    if (!html) return '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Heading level → font size mapping (editor px values)
    const HEADING_SIZES = { h1: 22, h2: 18, h3: 15, h4: 14, h5: 13, h6: 12 };

    function parseNode(node, listType = null, listIndex = { count: 1 }) {
        if (!node) return '';
        if (node.nodeType === Node.TEXT_NODE) {
            return node.textContent || '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tagName = node.tagName.toLowerCase();
        const getInner = () => Array.from(node.childNodes).map(n => parseNode(n, listType, listIndex)).join('');

        // Headings → styled spans that preserve heading hierarchy in editor & preview
        if (HEADING_SIZES[tagName]) {
            const inner = getInner().trim();
            const size = HEADING_SIZES[tagName];
            return inner ? `\n<span style="font-size: ${size}px; font-weight: bold;">${inner}</span>\n` : '';
        }

        if (tagName === 'strong' || tagName === 'b') {
            const inner = getInner().trim();
            return inner ? `<strong>${inner}</strong>` : '';
        }
        if (tagName === 'em' || tagName === 'i') {
            const inner = getInner().trim();
            return inner ? `<em>${inner}</em>` : '';
        }
        if (tagName === 'u') {
            const inner = getInner().trim();
            return inner ? `<u>${inner}</u>` : '';
        }
        if (tagName === 's' || tagName === 'del' || tagName === 'strike') {
            const inner = getInner().trim();
            return inner ? `<s>${inner}</s>` : '';
        }

        // Span — preserve display-relevant CSS properties (color, background-color, font-size)
        if (tagName === 'span') {
            const inner = getInner();
            const style = node.getAttribute('style') || '';
            if (style && inner.trim()) {
                const parts = [];
                const colorM = style.match(/(?:^|;)\s*color:\s*([^;]+)/i);
                if (colorM) {
                    const c = colorM[1].trim();
                    // Skip default black to avoid adding unnecessary wrappers
                    if (!/^(black|#000000?|#000|rgb\(\s*0\s*,\s*0\s*,\s*0\s*\))$/i.test(c)) {
                        parts.push(`color: ${c}`);
                    }
                }
                const bgM = style.match(/(?:^|;)\s*background-color:\s*([^;]+)/i);
                if (bgM) {
                    const bg = bgM[1].trim();
                    if (!/^(transparent|rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\))$/i.test(bg)) {
                        parts.push(`background-color: ${bg}`);
                    }
                }
                const sizeM = style.match(/(?:^|;)\s*font-size:\s*([^;]+)/i);
                if (sizeM) parts.push(`font-size: ${sizeM[1].trim()}`);
                const weightM = style.match(/(?:^|;)\s*font-weight:\s*([^;]+)/i);
                if (weightM && /bold|[6-9]\d\d/.test(weightM[1])) parts.push(`font-weight: ${weightM[1].trim()}`);
                const italicM = style.match(/(?:^|;)\s*font-style:\s*italic/i);
                if (italicM) parts.push('font-style: italic');
                const underlineM = style.match(/(?:^|;)\s*text-decoration:[^;]*underline/i);
                if (underlineM) parts.push('text-decoration: underline');

                if (parts.length > 0) {
                    return `<span style="${parts.join('; ')}">${inner}</span>`;
                }
            }
            return inner;
        }

        if (tagName === 'p') {
            const inner = getInner().trim();
            return inner ? `${inner}\n\n` : '\n';
        }
        if (tagName === 'ul') {
            const inner = Array.from(node.childNodes)
                .filter(n => n.nodeName && n.nodeName.toLowerCase() === 'li')
                .map(n => parseNode(n, 'ul'))
                .join('');
            return `\n${inner}\n`;
        }
        if (tagName === 'ol') {
            const counter = { count: 1 };
            const inner = Array.from(node.childNodes)
                .filter(n => n.nodeName && n.nodeName.toLowerCase() === 'li')
                .map(n => parseNode(n, 'ol', counter))
                .join('');
            return `\n${inner}\n`;
        }
        if (tagName === 'li') {
            const inner = getInner().trim();
            if (listType === 'ol') {
                const num = listIndex.count++;
                return `${num}. ${inner}\n`;
            }
            return `• ${inner}\n`;
        }
        if (tagName === 'table') {
            const rows = Array.from(node.querySelectorAll('tr'));
            if (!rows.length) return '';
            const renderedRows = rows.map((tr, rIdx) => {
                const cells = Array.from(tr.querySelectorAll('th, td'));
                const isHeaderRow = rIdx === 0 && (tr.querySelector('th') || tr.closest('thead'));
                const cellTags = cells.map(cell => {
                    const cellInner = Array.from(cell.childNodes).map(n => parseNode(n)).join('').trim();
                    const tag = isHeaderRow ? 'th' : 'td';
                    return `<${tag}>${cellInner || '&nbsp;'}</${tag}>`;
                }).join('');
                return `<tr>${cellTags}</tr>`;
            }).join('');
            return `\n<table class="pg-custom-table">\n${renderedRows}\n</table>\n\n`;
        }
        if (tagName === 'br') {
            return '\n';
        }

        return getInner();
    }

    const raw = parseNode(doc.body);
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// Smartly distribute large continuous text & tables into balanced pages
function distributeTextIntoPages(fullText) {
    if (!fullText || !fullText.trim()) return [''];

    // Separate tables as distinct tokens
    const tables = [];
    let processed = fullText.replace(/<table[\s\S]*?<\/table>/gi, (match) => {
        tables.push(match);
        return `___TABLE_TOKEN_${tables.length - 1}___`;
    });

    // Normalize block boundaries so every div/p/li/br becomes a distinct visual line
    processed = processed
        .replace(/<div>\s*<br\s*[\/]?>\s*<\/div>/gi, '\n___EMPTY_LINE___\n')
        .replace(/<p>\s*<br\s*[\/]?>\s*<\/p>/gi, '\n___EMPTY_LINE___\n')
        .replace(/<br\s*[\/]?>/gi, '\n___EMPTY_LINE___\n')
        .replace(/<\/div>/gi, '</div>\n')
        .replace(/<\/p>/gi, '</p>\n')
        .replace(/<\/li>/gi, '</li>\n');

    const rawSplits = processed.split('\n');
    const tokens = [];

    rawSplits.forEach(segment => {
        let s = segment.trim();
        if (s === '___EMPTY_LINE___' || !s) {
            tokens.push('');
            return;
        }
        if (s.includes('___TABLE_TOKEN_')) {
            s = s.replace(/___TABLE_TOKEN_(\d+)___/g, (_, idx) => tables[parseInt(idx, 10)] || '');
        }
        tokens.push(s);
    });

    const pages = [];
    let curLines = [];
    let curLineCount = 0;

    // Balanced page line targets: ~52 lines fills A4 preview right to the footer
    const TARGET_PAGE_LINES = 52;
    const MIN_PAGE_LINES = 46;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const isTable = token.trim().startsWith('<table');
        const visualLines = isTable
            ? ((token.match(/<tr/gi) || []).length * 1.5 + 2)
            : (token.trim() ? Math.max(1, Math.ceil(token.length / 115)) : 0.25);

        const isHeaderLike = !isTable && (
            token.match(/^(\*\*.*?\*\*|#{1,3}\s+.*|\d+\.\s+[A-Z\s]{3,}|[A-Z\s]{4,}:)/) ||
            // Styled heading spans from htmlToProposalMarkdown (e.g. h1→22px, h2→18px, h3→15px)
            /<span[^>]*font-size:\s*(?:1[5-9]|2\d)px[^>]*font-weight:\s*bold[^>]*>/.test(token) ||
            /<span[^>]*font-weight:\s*bold[^>]*font-size:\s*(?:1[5-9]|2\d)px[^>]*>/.test(token)
        );

        if (curLineCount >= MIN_PAGE_LINES && (curLineCount + visualLines > TARGET_PAGE_LINES) && (isHeaderLike || isTable)) {
            pages.push(curLines.join('\n').trim());
            curLines = [token];
            curLineCount = visualLines;
        } else if (curLineCount + visualLines > TARGET_PAGE_LINES + 5) {
            pages.push(curLines.join('\n').trim());
            curLines = [token];
            curLineCount = visualLines;
        } else {
            curLines.push(token);
            curLineCount += visualLines;
        }
    }

    if (curLines.length > 0 && curLines.some(l => l.trim())) {
        pages.push(curLines.join('\n').trim());
    }

    return pages.length > 0 ? pages : [''];
}



const COMPANY = {
    name: 'BHOOMI TECHZONE PRIVATE LIMITED',
    shortName: 'Bhoomi Techzone Pvt. Ltd.',
    website: 'www.bhoomitechzone.in',
    email: 'bhoomi.sales@bhoomitechzone.in',
    gstin: '09AAMCB0572D1ZS',
    cin: 'U55499UP2023PTC191784',
    address: 'A-43, 3rd Floor, Sector 63, Noida (201301), Uttar Pradesh',
    phone: '',
    bankName: 'AU SMALL FINANCE BANK',
    accountName: 'BHOOMI TECHZONE PRIVATE LIMITED',
    accountNumber: '2602210510517073',
    ifsc: 'AUBL0002105',
    upi: 'bhoomitechzone@okaxis',
};

const SERVICES = [
    'Website Development', 'Web Portals Development', 'Software Development',
    'Android Application Development', 'Mobile Apps Development', 'Digital Marketing',
    'Graphics Designing', 'Promotional Video', 'Logo & Banner Designing',
    'Content Writing & Hosting Provider', 'ERP, CRM Development', 'MLM Website/App Development',
    'E-Commerce Development', 'Desktop Software Development', 'Taxi Booking Apps',
    'Food Delivery Apps', 'Service Provider Apps', 'Tournament/Contest Apps',
    'Real Estate Software', 'Pathology Software', 'Hospital Software',
    'Small Business Software', 'Billing Software', 'Examination Software',
    'Education Portals', 'Hotels Management Software', 'School Management Software',
];

const PROFILE_TEXT = `At BHOOMI TECHZONE, we help businesses create a strong and professional digital presence through innovative web and digital marketing solutions. We specialize in website design and development, SEO, and targeted digital marketing tailored to meet the unique needs of every business.

Our approach combines creative design, modern technology, functionality, and result-driven strategies to help brands connect with their target audience, improve online visibility, and achieve sustainable growth.

With a focus on quality and innovation, we aim to deliver effective digital solutions that turn ideas into impactful online experiences and help businesses grow with confidence.`;

export function DomesticProposalGenerator({ isOpen, onClose, onSuccess, proposalId, initialTab = 'form', readOnly = false }) {
    const { user, hasPermission } = useAuth();
    const hasAccess = hasPermission('proposals', 'create') || hasPermission('proposals', 'read');
    const previewRef = useRef(null);

    const [clients, setClients] = useState([]);
    const [deals, setDeals] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [saving, setSaving] = useState(false);
    const [isLoadingProposal, setIsLoadingProposal] = useState(false);
    const [activeTab, setActiveTab] = useState(initialTab);
    const [previewZoom, setPreviewZoom] = useState(1);
    const [showFullPreview, setShowFullPreview] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    useEffect(() => {
        if (isOpen) setActiveTab(initialTab);
    }, [isOpen, initialTab]);

    // Signature states
    const [authorizedSigFile, setAuthorizedSigFile] = useState(null);
    const [clientSigFile, setClientSigFile] = useState(null);
    const [authorizedSigPreview, setAuthorizedSigPreview] = useState(null);
    const [clientSigPreview, setClientSigPreview] = useState(null);

    const handleSigChange = (type, file) => {
        if (!file) return;
        const url = URL.createObjectURL(file);
        if (type === 'authorized') {
            setAuthorizedSigFile(file);
            setAuthorizedSigPreview(url);
        } else {
            setClientSigFile(file);
            setClientSigPreview(url);
        }
    };

    const removeSig = (type) => {
        if (type === 'authorized') {
            setAuthorizedSigFile(null);
            if (authorizedSigPreview) URL.revokeObjectURL(authorizedSigPreview);
            setAuthorizedSigPreview(null);
        } else {
            setClientSigFile(null);
            if (clientSigPreview) URL.revokeObjectURL(clientSigPreview);
            setClientSigPreview(null);
        }
    };

    const zoomIn = () => setPreviewZoom(prev => Math.min(prev + 0.15, 2));
    const zoomOut = () => setPreviewZoom(prev => Math.max(prev - 0.15, 0.5));
    const zoomReset = () => setPreviewZoom(1);

    const [form, setForm] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        validTill: '',
        clientId: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: '',
        contactName: '',
        deal: '',
        projectSections: [{ type: 'page-heading', content: '', page: 1 }],
        projectTimeline: '',
        items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        subtotal: 0,
        taxPercentage: 18,
        taxAmount: 0,
        discount: 0,
        total: 0,
        paymentTerms: 'Payment Method: 50% Payment Advance • 30% in between • 20% After Completion',
        termsAndConditions: `1. Payment terms: 50% advance, 50% on project completion\n2. Project timeline is estimated and may vary based on client inputs\n3. Any additional features beyond scope will be quoted separately\n4. Client must provide all necessary access and resources\n5. All intellectual property rights remain with the company until full payment`,
        notes: '',
        template: '',
    });
    const [activeProjectPage, setActiveProjectPage] = useState(1);
    const [pageCapacities, setPageCapacities] = useState({});

    // Selection mode states
    const [clientMode, setClientMode] = useState('select'); // 'select' or 'manual'

    // DOCX upload & parser states
    const [isParsingDocx, setIsParsingDocx] = useState(false);
    const [isDraggingDocx, setIsDraggingDocx] = useState(false);
    const docxInputRef = useRef(null);

    const fetchData = useCallback(async () => {
        try {
            const [cRes, dRes, tRes] = await Promise.allSettled([
                api.get('/clients'),
                api.get('/deals'),
                api.get('/proposal-templates'),
            ]);
            if (cRes.status === 'fulfilled' && Array.isArray(cRes.value?.data)) {
                setClients(cRes.value.data);
            }
            if (dRes.status === 'fulfilled' && Array.isArray(dRes.value?.data)) {
                setDeals(dRes.value.data);
            }
            if (tRes.status === 'fulfilled' && Array.isArray(tRes.value?.data)) {
                setTemplates(tRes.value.data);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
        }
    }, []);

    const fetchProposal = useCallback(async () => {
        if (!proposalId) return;
        try {
            const res = await api.get(`/proposals/${proposalId}`);
            const p = res.data;
            setForm({
                title: p.title || '',
                proposalNumber: p.proposalNumber || '',
                date: p.date ? new Date(p.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                validTill: p.validTill ? new Date(p.validTill).toISOString().split('T')[0] : '',
                clientId: p.client?._id || p.clientId || '',
                clientName: p.clientName || '',
                clientEmail: p.clientEmail || '',
                clientPhone: p.clientPhone || '',
                clientAddress: p.clientAddress || '',
                contactName: p.contactName || '',
                deal: p.deal?._id || p.deal || '',
                projectSections: p.projectSections && p.projectSections.length > 0 ? p.projectSections : [{ type: 'formatted-paragraph', content: '', page: 1 }],
                projectTimeline: p.projectTimeline || '',
                items: p.items && p.items.length > 0 ? p.items : [{ description: '', quantity: 1, rate: 0, amount: 0 }],
                subtotal: p.subtotal || 0,
                taxPercentage: p.taxPercentage !== undefined ? p.taxPercentage : 18,
                taxAmount: p.taxAmount || 0,
                discount: p.discount || 0,
                total: p.total || 0,
                paymentTerms: p.paymentTerms || 'Payment Method: 50% Payment Advance • 30% in between • 20% After Completion',
                termsAndConditions: p.termsAndConditions || `1. Payment terms: 50% advance, 50% on project completion\n2. Project timeline is estimated and may vary based on client inputs\n3. Any additional features beyond scope will be quoted separately\n4. Client must provide all necessary access and resources\n5. All intellectual property rights remain with the company until full payment`,
                notes: p.notes || '',
                template: p.template?._id || p.template || '',
            });
            if (p.authorizedSignature) {
                setAuthorizedSigPreview(p.authorizedSignature.startsWith('http') ? p.authorizedSignature : `${process.env.REACT_APP_API_URL || ''}${p.authorizedSignature}`);
            }
            if (p.clientSignature) {
                setClientSigPreview(p.clientSignature.startsWith('http') ? p.clientSignature : `${process.env.REACT_APP_API_URL || ''}${p.clientSignature}`);
            }
            setClientMode(p.client ? 'select' : 'manual');
        } catch (err) {
            console.error('Error fetching proposal:', err);
            alert('Error loading proposal data');
            setIsLoadingProposal(false);
        }
    }, [proposalId]);

    useEffect(() => {
        if (hasAccess && isOpen) {
            setIsLoadingProposal(true);
            fetchData();
            if (proposalId) {
                fetchProposal().then(() => {
                    setTimeout(() => {
                        setIsLoadingProposal(false);
                    }, 600);
                });
            } else {
                setForm({
                    title: '',
                    proposalNumber: '',
                    date: new Date().toISOString().split('T')[0],
                    validTill: '',
                    clientId: '',
                    clientName: '',
                    clientEmail: '',
                    clientPhone: '',
                    clientAddress: '',
                    contactName: '',
                    deal: '',
                    projectSections: [{ type: 'formatted-paragraph', content: '', page: 1 }],
                    projectTimeline: '',
                    items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
                    subtotal: 0,
                    taxPercentage: 18,
                    taxAmount: 0,
                    discount: 0,
                    total: 0,
                    paymentTerms: 'Payment Method: 50% Payment Advance • 30% in between • 20% After Completion',
                    termsAndConditions: `1. Payment terms: 50% advance, 50% on project completion\n2. Project timeline is estimated and may vary based on client inputs\n3. Any additional features beyond scope will be quoted separately\n4. Client must provide all necessary access and resources\n5. All intellectual property rights remain with the company until full payment`,
                    notes: '',
                    template: '',
                });
                setClientMode('select');
                setAuthorizedSigFile(null);
                setClientSigFile(null);
                setAuthorizedSigPreview(null);
                setClientSigPreview(null);

                setTimeout(() => {
                    setIsLoadingProposal(false);
                }, 500);
            }
        } else if (!isOpen) {
            setIsLoadingProposal(false);
        }
    }, [fetchData, fetchProposal, hasAccess, isOpen, proposalId]);

    // Auto calculate
    useEffect(() => {
        const subtotal = form.items.reduce((s, i) => s + (i.amount || 0), 0);
        const taxAmount = Math.round(subtotal * form.taxPercentage / 100 * 100) / 100;
        const total = subtotal + taxAmount - (form.discount || 0);
        setForm(p => ({ ...p, subtotal, taxAmount, total }));
    }, [form.items, form.taxPercentage, form.discount]);

    const set = (name, value) => setForm(p => ({ ...p, [name]: value }));
    const handleChange = (e) => set(e.target.name, e.target.value);

    const handleItemChange = (idx, field, val) => {
        const items = [...form.items];
        items[idx][field] = val;
        if (field === 'quantity' || field === 'rate') {
            items[idx].amount = items[idx].quantity * items[idx].rate;
        }
        set('items', items);
    };
    const addItem = () => set('items', [...form.items, { description: '', quantity: 1, rate: 0, amount: 0 }]);
    const removeItem = (idx) => { if (form.items.length > 1) set('items', form.items.filter((_, i) => i !== idx)); };

    // Project Pages & Content handlers
    const maxProjectPages = React.useMemo(() => {
        let max = 1;
        (form.projectSections || []).forEach(s => {
            const p = Math.max(1, Number(s.page || 1));
            if (p > max) max = p;
        });
        return max;
    }, [form.projectSections]);

    const getPageData = React.useCallback((pageNumber) => {
        const sections = (form.projectSections || []).filter(s => Math.max(1, Number(s.page || 1)) === pageNumber);
        const headingSec = sections.find(s => s.type === 'page-heading');
        const contentSecs = sections.filter(s => s.type !== 'page-heading');
        const pageHeading = headingSec ? headingSec.content : '';
        const pageContent = contentSecs.map(s => s.content || '').join('\n');
        return { pageHeading, pageContent };
    }, [form.projectSections]);

    const handlePageContentChange = (pageNumber, newContent) => {
        const currentHeading = getPageData(pageNumber).pageHeading;
        const otherSections = (form.projectSections || []).filter(s => Math.max(1, Number(s.page || 1)) !== pageNumber);
        const newPageSections = [];
        if (currentHeading && currentHeading.trim()) {
            newPageSections.push({ type: 'page-heading', content: currentHeading, page: pageNumber });
        }
        newPageSections.push({ type: 'formatted-paragraph', content: newContent, page: pageNumber });
        set('projectSections', [...otherSections, ...newPageSections].sort((a, b) => (a.page || 1) - (b.page || 1)));
    };

    const handlePageHeadingChange = (pageNumber, newHeading) => {
        const currentContent = getPageData(pageNumber).pageContent;
        const otherSections = (form.projectSections || []).filter(s => Math.max(1, Number(s.page || 1)) !== pageNumber);
        const newPageSections = [];
        if (newHeading && newHeading.trim()) {
            newPageSections.push({ type: 'page-heading', content: newHeading, page: pageNumber });
        }
        newPageSections.push({ type: 'formatted-paragraph', content: currentContent || '', page: pageNumber });
        set('projectSections', [...otherSections, ...newPageSections].sort((a, b) => (a.page || 1) - (b.page || 1)));
    };

    const handleAddProjectPage = () => {
        const nextPageIndex = maxProjectPages + 1;
        const newSection = { type: 'formatted-paragraph', content: '', page: nextPageIndex };
        set('projectSections', [...(form.projectSections || []), newSection]);
        setActiveProjectPage(nextPageIndex);
    };

    const handleRemoveProjectPage = (pageNumber) => {
        if (maxProjectPages <= 1) return;
        const remainingSections = (form.projectSections || [])
            .filter(s => Math.max(1, Number(s.page || 1)) !== pageNumber)
            .map(s => {
                const curPage = Math.max(1, Number(s.page || 1));
                if (curPage > pageNumber) {
                    return { ...s, page: curPage - 1 };
                }
                return s;
            });
        set('projectSections', remainingSections.length ? remainingSections : [{ type: 'formatted-paragraph', content: '', page: 1 }]);
        setActiveProjectPage(prev => Math.max(1, Math.min(prev, maxProjectPages - 1)));
    };

    // DOCX Import & Parsing Handlers
    const handleDocxFile = async (file) => {
        if (!file) return;
        if (!file.name.match(/\.(docx)$/i)) {
            alert('Please upload a valid Word document (.docx file).');
            return;
        }

        setIsParsingDocx(true);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            const html = result.value || '';
            const markdown = htmlToProposalMarkdown(html);

            if (!markdown || !markdown.trim()) {
                alert('Could not extract readable text from this document. Please ensure the document is not empty.');
                setIsParsingDocx(false);
                return;
            }

            const pages = distributeTextIntoPages(markdown);

            let docTitle = '';
            const firstLine = markdown.split('\n')[0].replace(/^[#*•\s]+/, '').trim();
            if (firstLine && firstLine.length <= 80) {
                docTitle = firstLine;
            }

            if (docTitle && (!form.title || form.title.trim() === 'Dynamic Website' || form.title.trim() === '')) {
                set('title', docTitle);
            }

            const newSections = pages.map((pageText, idx) => ({
                type: 'formatted-paragraph',
                content: pageText,
                page: idx + 1
            }));

            set('projectSections', newSections.length ? newSections : [{ type: 'formatted-paragraph', content: markdown, page: 1 }]);
            setActiveProjectPage(1);

            // Brief pause for visual confirmation of loader
            await new Promise(res => setTimeout(res, 500));
        } catch (err) {
            console.error('Error parsing DOCX file:', err);
            alert('Failed to parse the DOCX file: ' + (err.message || 'Unknown error'));
        } finally {
            setIsParsingDocx(false);
            if (docxInputRef.current) docxInputRef.current.value = '';
        }
    };

    const handleDocxUpload = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleDocxFile(file);
    };

    const handleDocxDrop = (e) => {
        e.preventDefault();
        setIsDraggingDocx(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleDocxFile(e.dataTransfer.files[0]);
        }
    };

    const handleDocxDragOver = (e) => {
        e.preventDefault();
        setIsDraggingDocx(true);
    };

    const handleDocxDragLeave = (e) => {
        e.preventDefault();
        setIsDraggingDocx(false);
    };

    const handleClientSelect = (id) => {
        const c = clients.find(x => x._id === id);
        if (c) setForm(p => ({
            ...p,
            clientId: c._id,
            clientName: c.company || c.name || '',
            contactName: c.name || '',
            clientEmail: c.email || '',
            clientPhone: c.phone || '',
            clientAddress: c.address || ''
        }));
        else setForm(p => ({ ...p, clientId: '', clientName: '', contactName: '', clientEmail: '', clientPhone: '', clientAddress: '' }));
    };

    const clearClientFields = () => {
        setForm(p => ({
            ...p,
            clientId: '',
            clientName: '',
            contactName: '',
            clientEmail: '',
            clientPhone: '',
            clientAddress: ''
        }));
    };

    const waitForPaint = () => new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 80)));

    const PDF_INJECTED_STYLES = `
        :root {
            --pg-green: #2e7d32 !important;
            --pg-green-light: #e8f5e9 !important;
            --pg-green-dark: #1b5e20 !important;
            --pg-green-mid: #4caf50 !important;
            --pg-border: #e2e8f0 !important;
            --pg-text: #1e293b !important;
            --pg-text-muted: #64748b !important;
        }

        body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        [data-pdf-page-key], .pg-page {
            width: 650px !important;
            height: 920px !important;
            min-width: 650px !important;
            min-height: 920px !important;
            max-width: 650px !important;
            max-height: 920px !important;
            position: relative !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
        }

        .pg-page-border {
            position: absolute !important;
            top: 8px !important;
            left: 8px !important;
            right: 8px !important;
            bottom: 8px !important;
            width: calc(100% - 16px) !important;
            height: calc(100% - 16px) !important;
            border: 2.5px solid #1b5e20 !important;
            border-radius: 2px !important;
            padding: 8px 16px 2px !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
        }

        .pg-header {
            display: flex !important;
            align-items: flex-start !important;
            gap: 10px !important;
            margin-bottom: 2px !important;
            width: 100% !important;
        }

        .pg-header-logo {
            flex-shrink: 0 !important;
            width: 150px !important;
        }

        .pg-logo-img {
            width: 140px !important;
            height: 48px !important;
            object-fit: contain !important;
            display: block !important;
        }

        .pg-header-info {
            flex: 1 !important;
            text-align: right !important;
        }

        .pg-header-company {
            font-size: 12.8px !important;
            font-weight: 800 !important;
            color: #1b5e20 !important;
            margin-bottom: 1px !important;
        }

        .pg-header-company--first-page {
            font-size: 11.4px !important;
            line-height: 1.15 !important;
        }

        .pg-header-detail {
            font-size: 8.4px !important;
            color: #555555 !important;
            line-height: 1.5 !important;
        }

        .pg-header-detail--first-page {
            font-size: 7.6px !important;
            line-height: 1.35 !important;
        }

        .pg-header-line {
            height: 1.5px !important;
            background: #1b5e20 !important;
            margin-bottom: 2px !important;
            width: 100% !important;
            display: block !important;
            border: none !important;
        }

        .pg-title {
            text-align: center !important;
            font-size: 14px !important;
            font-weight: 800 !important;
            color: #1e293b !important;
            margin-bottom: 3px !important;
            letter-spacing: 0.02em !important;
        }

        .pg-subtitle {
            text-align: center !important;
            font-size: 10.2px !important;
            font-weight: 700 !important;
            color: #1b5e20 !important;
            font-style: italic !important;
            margin-bottom: 10px !important;
        }

        .pg-info-table {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            margin-bottom: 8px !important;
            font-size: 7.8px !important;
            border: 1px solid #2e7d32 !important;
            display: table !important;
        }

        .pg-info-table td {
            border: 1px solid #2e7d32 !important;
            padding: 3px 6px !important;
            vertical-align: middle !important;
            box-sizing: border-box !important;
        }

        .pg-info-table td.pg-it-label {
            background: #f5f5f5 !important;
            font-weight: 700 !important;
            width: 30% !important;
            color: #333333 !important;
            box-sizing: border-box !important;
        }

        .pg-info-table td.pg-it-value {
            color: #444444 !important;
            width: 70% !important;
            box-sizing: border-box !important;
        }

        .pg-section-title {
            font-size: 9.8px !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            background: #1b5e20 !important;
            padding: 3px 6px !important;
            margin: 6px 0 4px !important;
            border-radius: 2px !important;
            display: block !important;
        }

        .pg-services-grid {
            display: flex !important;
            flex-wrap: wrap !important;
            border: 1px solid #2e7d32 !important;
            margin-bottom: 8px !important;
            width: 100% !important;
            box-sizing: border-box !important;
        }

        .pg-service-cell {
            width: 33.333% !important;
            box-sizing: border-box !important;
            border: 1px solid #2e7d32 !important;
            padding: 3px 5px !important;
            font-size: 6.8px !important;
            color: #333333 !important;
            background: #fafafa !important;
        }

        .pg-body-text {
            font-size: 7.8px !important;
            line-height: 1.45 !important;
            color: #333333 !important;
            margin-bottom: 5px !important;
            text-align: justify !important;
        }

        .pg-meta-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 7.4px !important;
            color: #555555 !important;
            margin: 8px 0 !important;
            padding: 4px 6px !important;
            background: #fafafa !important;
            border-radius: 2px !important;
        }

        .pg-footer {
            position: absolute !important;
            bottom: 4px !important;
            left: 16px !important;
            right: 16px !important;
            width: calc(100% - 32px) !important;
        }

        .pg-footer-line {
            height: 1px !important;
            background: #2e7d32 !important;
            margin-bottom: 4px !important;
            width: 100% !important;
            display: block !important;
            border: none !important;
        }

        .pg-footer-row {
            display: flex !important;
            justify-content: space-between !important;
            font-size: 6.8px !important;
            color: #555555 !important;
        }

        .pg-footer-link {
            color: #2e7d32 !important;
        }

        .pg-paginated-sections-box {
            flex: 1 !important;
            overflow: hidden !important;
            margin-bottom: 0px !important;
        }

        .pg-prev-sections-box {
            flex: 1 !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
        }

        .pg-preview-line {
            line-height: 1.55 !important;
            font-size: 9.5px !important;
        }

        .pg-costing-header {
            font-size: 9.8px !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            background: #1b5e20 !important;
            padding: 3px 6px !important;
            margin: 6px 0 4px !important;
            border-radius: 2px !important;
            text-align: center !important;
        }

        .pg-table-wrap {
            width: 100% !important;
            display: block !important;
            box-sizing: border-box !important;
        }

        .pg-cost-table {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            margin-bottom: 6px !important;
            font-size: 7.8px !important;
            border: 1px solid #2e7d32 !important;
            display: table !important;
        }

        .pg-cost-table th,
        .pg-cost-table td {
            box-sizing: border-box !important;
        }

        .pg-cost-table th:nth-child(1) {
            width: 48% !important;
        }

        .pg-cost-table th:nth-child(2) {
            width: 24% !important;
        }

        .pg-cost-table th:nth-child(3) {
            width: 28% !important;
        }

        .pg-cost-table tr:not(.pg-ct-summary):not(.pg-ct-total) td:nth-child(1) {
            width: 48% !important;
        }

        .pg-cost-table tr:not(.pg-ct-summary):not(.pg-ct-total) td:nth-child(2) {
            width: 24% !important;
        }

        .pg-cost-table tr:not(.pg-ct-summary):not(.pg-ct-total) td:nth-child(3) {
            width: 28% !important;
        }

        .pg-cost-table tr.pg-ct-summary td:nth-child(1),
        .pg-cost-table tr.pg-ct-total td:nth-child(1) {
            width: 72% !important;
        }

        .pg-cost-table tr.pg-ct-summary td:nth-child(2),
        .pg-cost-table tr.pg-ct-total td:nth-child(2) {
            width: 28% !important;
        }

        .pg-cost-table th {
            background: #1b5e20 !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            border: 1px solid #2e7d32 !important;
            padding: 4px 6px !important;
            font-size: 7.6px !important;
            text-align: left !important;
            letter-spacing: 0.02em !important;
        }

        .pg-cost-table td {
            border: 1px solid #2e7d32 !important;
            padding: 3px 6px !important;
            font-size: 7.8px !important;
            color: #333333 !important;
        }

        .pg-ct-summary td {
            background: #fafafa !important;
            font-weight: 600 !important;
        }

        .pg-ct-total td {
            background: #e8f5e9 !important;
            color: #1b5e20 !important;
            font-weight: 800 !important;
            font-size: 7.8px !important;
        }

        .pg-ct-amount {
            text-align: right !important;
            font-weight: 600 !important;
        }

        .pg-bank-table {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            margin-bottom: 6px !important;
            font-size: 7.8px !important;
            border: 1px solid #2e7d32 !important;
            display: table !important;
        }

        .pg-bank-table td {
            border: 1px solid #2e7d32 !important;
            padding: 3px 6px !important;
            box-sizing: border-box !important;
        }

        .pg-bank-table td.pg-it-label {
            width: 30% !important;
            background: #f5f5f5 !important;
            font-weight: 700 !important;
            color: #333333 !important;
            box-sizing: border-box !important;
        }

        .pg-bank-table td.pg-it-value {
            width: 70% !important;
            color: #444444 !important;
            box-sizing: border-box !important;
        }

        .pg-payment-note {
            font-size: 6px !important;
            color: #c62828 !important;
            font-weight: 700 !important;
            text-align: center !important;
            margin: 5px 0 !important;
            padding: 3px 6px !important;
            background: #ffebee !important;
            border: 1px solid #ffcdd2 !important;
            border-radius: 2px !important;
            font-style: normal !important;
        }

        .pg-tc-title {
            font-size: 9.8px !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            background: #1b5e20 !important;
            padding: 4px 6px !important;
            margin: 6px 0 4px !important;
            border-radius: 2px !important;
            letter-spacing: 0.04em !important;
        }

        .pg-tc-content {
            font-size: 7.2px !important;
            color: #444444 !important;
            line-height: 1.45 !important;
            margin-bottom: 5px !important;
            padding: 5px 8px !important;
            background: #fafafa !important;
            border-radius: 2px !important;
            border: 1px solid #e2e8f0 !important;
        }

        .pg-tc-line {
            font-size: 7.2px !important;
            color: #444444 !important;
            line-height: 1.45 !important;
            margin: 0 0 2px !important;
        }

        .pg-tc-bold {
            font-size: 7.2px !important;
            font-weight: 700 !important;
            color: #d32f2f !important;
            margin: 4px 0 4px !important;
            padding: 4px 7px !important;
            background: #ffebee !important;
            border-left: 3px solid #ef4444 !important;
            border-radius: 2px !important;
        }

        .pg-tc-refund {
            font-size: 7.2px !important;
            color: #444444 !important;
            margin: 0 0 5px !important;
            padding: 4px 7px !important;
            background: #e8f5e9 !important;
            border-left: 3px solid #2e7d32 !important;
            border-radius: 2px !important;
        }

        .pg-regards {
            margin: 8px 0 10px !important;
            font-size: 7.6px !important;
            color: #444444 !important;
            line-height: 1.6 !important;
            padding: 5px 7px !important;
            background: #fafafa !important;
            border-radius: 2px !important;
        }

        .pg-regards p {
            margin: 2px 0 !important;
        }

        .pg-signatures {
            display: flex !important;
            justify-content: space-between !important;
            margin-top: 16px !important;
            gap: 20px !important;
            background: #fafafa !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 2px !important;
            padding: 8px 12px 6px !important;
            box-sizing: border-box !important;
        }

        .pg-sig-block {
            flex: 1 !important;
            border-top: none !important;
            padding-top: 0 !important;
        }

        .pg-sig-for {
            font-size: 8px !important;
            font-weight: 700 !important;
            color: #1b5e20 !important;
            margin-bottom: 6px !important;
        }

        .pg-sig-space {
            height: 36px !important;
            width: 100% !important;
            background: transparent !important;
            display: block !important;
        }

        .pg-sig-line {
            height: 1px !important;
            max-height: 1px !important;
            min-height: 1px !important;
            background: #94a3b8 !important;
            width: 100% !important;
            margin: 0 0 6px 0 !important;
            padding: 0 !important;
            border: none !important;
            display: block !important;
            box-shadow: none !important;
        }

        .pg-sig-label {
            font-size: 7.6px !important;
            color: #333333 !important;
            margin-top: 4px !important;
        }

        .pg-sig-name {
            font-size: 7.2px !important;
            color: #666666 !important;
        }
    `;

    const buildPdfInstance = async () => {
        const prevTab = activeTab;
        const prevZoom = previewZoom;
        let zoomArea = null;
        let originalZoomAreaTransform = '';
        let originalZoomAreaTransformOrigin = '';
        let previewPanel = null;
        let prevScrollTop = 0;
        const convertedImages = [];

        const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

        const waitForFrames = async (count = 2) => {
            for (let i = 0; i < count; i++) {
                await nextFrame();
            }
        };

        const ensureElementVisible = (el, label) => {
            if (!el) throw new Error(`${label} not found`);
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            const isHidden = style.display === 'none' || style.visibility === 'hidden';
            const hasSize = rect.width > 0 && rect.height > 0;
            if (isHidden || !hasSize) {
                throw new Error(`${label} is hidden or has zero size`);
            }
        };

        const waitForInlineImages = async (root) => {
            const imgs = Array.from(root.querySelectorAll('img'));
            await Promise.all(imgs.map((img) => {
                if (!img.getAttribute('crossorigin')) {
                    img.setAttribute('crossorigin', 'anonymous');
                }

                if (img.complete) {
                    return Promise.resolve();
                }

                return new Promise((resolve) => {
                    const onDone = () => resolve();
                    img.addEventListener('load', onDone, { once: true });
                    img.addEventListener('error', onDone, { once: true });
                });
            }));
        };

        const renderSafePage = async (pageEl, pageKey) => {
            const canvas = await html2canvas(pageEl, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                imageTimeout: 0,
                width: 650,
                height: 920,
                windowWidth: 650,
                windowHeight: 920,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                onclone: (clonedDoc) => {
                    const targetPage = clonedDoc.querySelector(`[data-pdf-page-key="${pageKey}"]`);
                    if (targetPage) {
                        clonedDoc.body.innerHTML = '';
                        clonedDoc.body.style.margin = '0';
                        clonedDoc.body.style.padding = '0';
                        clonedDoc.body.style.background = '#ffffff';
                        clonedDoc.body.style.width = '650px';
                        clonedDoc.body.style.height = '920px';
                        clonedDoc.body.style.overflow = 'hidden';

                        targetPage.style.position = 'relative';
                        targetPage.style.margin = '0 auto';
                        targetPage.style.left = '0';
                        targetPage.style.top = '0';
                        targetPage.style.width = '650px';
                        targetPage.style.height = '920px';
                        targetPage.style.boxShadow = 'none';
                        targetPage.style.background = '#ffffff';

                        // Explicitly enforce table cell widths in cloned DOM so html2canvas renders full width
                        const allTables = targetPage.querySelectorAll('table');
                        allTables.forEach((tbl) => {
                            tbl.style.setProperty('width', '100%', 'important');
                            tbl.style.setProperty('min-width', '100%', 'important');
                            tbl.style.setProperty('max-width', '100%', 'important');
                            tbl.style.setProperty('table-layout', 'fixed', 'important');
                            tbl.style.setProperty('border-collapse', 'collapse', 'important');
                            tbl.style.setProperty('box-sizing', 'border-box', 'important');
                            tbl.style.setProperty('display', 'table', 'important');

                            if (tbl.parentElement) {
                                tbl.parentElement.style.setProperty('width', '100%', 'important');
                                tbl.parentElement.style.setProperty('display', 'block', 'important');
                                tbl.parentElement.style.setProperty('box-sizing', 'border-box', 'important');
                            }

                            if (tbl.classList.contains('pg-cost-table')) {
                                tbl.querySelectorAll('tr').forEach((tr) => {
                                    const cells = tr.querySelectorAll('th, td');
                                    if (cells.length === 3) {
                                        cells[0].style.setProperty('width', '48%', 'important');
                                        cells[1].style.setProperty('width', '24%', 'important');
                                        cells[2].style.setProperty('width', '28%', 'important');
                                    } else if (cells.length === 2) {
                                        cells[0].style.setProperty('width', '72%', 'important');
                                        cells[1].style.setProperty('width', '28%', 'important');
                                    }
                                });
                            }

                            if (tbl.classList.contains('pg-info-table') || tbl.classList.contains('pg-bank-table') || tbl.classList.contains('pg-client-table')) {
                                tbl.querySelectorAll('tr').forEach((tr) => {
                                    const cells = tr.querySelectorAll('th, td');
                                    if (cells.length === 2) {
                                        cells[0].style.setProperty('width', '30%', 'important');
                                        cells[1].style.setProperty('width', '70%', 'important');
                                    }
                                });
                            }
                        });

                        // Explicitly enforce clean signature styles in cloned DOM
                        targetPage.querySelectorAll('.pg-signatures').forEach((sigBox) => {
                            sigBox.style.setProperty('background', '#fafafa', 'important');
                            sigBox.style.setProperty('border', '1px solid #e2e8f0', 'important');
                            sigBox.style.setProperty('box-shadow', 'none', 'important');
                            sigBox.style.setProperty('display', 'flex', 'important');
                        });

                        targetPage.querySelectorAll('.pg-sig-space').forEach((sp) => {
                            sp.style.setProperty('height', '36px', 'important');
                            sp.style.setProperty('background', 'transparent', 'important');
                            sp.style.setProperty('display', 'block', 'important');
                        });

                        targetPage.querySelectorAll('.pg-sig-line').forEach((line) => {
                            line.style.setProperty('height', '1px', 'important');
                            line.style.setProperty('max-height', '1px', 'important');
                            line.style.setProperty('min-height', '1px', 'important');
                            line.style.setProperty('background', '#94a3b8', 'important');
                            line.style.setProperty('border', 'none', 'important');
                            line.style.setProperty('box-shadow', 'none', 'important');
                            line.style.setProperty('width', '100%', 'important');
                            line.style.setProperty('margin', '0 0 6px 0', 'important');
                            line.style.setProperty('padding', '0', 'important');
                            line.style.setProperty('display', 'block', 'important');
                        });

                        clonedDoc.body.appendChild(targetPage);
                    }

                    const styleTag = clonedDoc.createElement('style');
                    styleTag.textContent = PDF_INJECTED_STYLES;
                    clonedDoc.head.appendChild(styleTag);
                }
            });

            if (!canvas || canvas.width === 0 || canvas.height === 0) {
                throw new Error(`Canvas for page ${pageKey} is empty`);
            }

            return canvas;
        };

        const originalPageKeys = [];

        try {
            if (prevTab !== 'preview') setActiveTab('preview');
            if (prevZoom !== 1) setPreviewZoom(1);

            await waitForFrames(3);
            await waitForPaint();

            const previewRoot = previewRef.current;
            if (!previewRoot) throw new Error('Preview root not found');

            previewPanel = previewRoot.closest('.pg-preview-panel') || previewRoot.parentElement;
            if (previewPanel) {
                prevScrollTop = previewPanel.scrollTop;
                previewPanel.scrollTop = 0;
            }

            zoomArea = previewRoot.querySelector('.pg-preview-zoom-area');
            if (zoomArea) {
                originalZoomAreaTransform = zoomArea.style.transform;
                originalZoomAreaTransformOrigin = zoomArea.style.transformOrigin;
                zoomArea.style.transform = 'none';
                zoomArea.style.transformOrigin = 'top left';
                await waitForFrames(2);
            }

            const pages = Array.from(previewRoot.querySelectorAll('.pg-page'));
            if (!pages.length) throw new Error('Preview pages not found');

            ensureElementVisible(previewPanel, 'Preview panel');
            pages.forEach((page, idx) => ensureElementVisible(page, `Page ${idx + 1}`));

            pages.forEach((page, idx) => {
                const oldVal = page.getAttribute('data-pdf-page-key');
                originalPageKeys.push(oldVal);
                page.setAttribute('data-pdf-page-key', String(idx));
            });

            await waitForInlineImages(previewRoot);

            // Convert images in preview to base64 Data URLs so html2canvas renders them synchronously without CORS issues
            const allImages = Array.from(previewRoot.querySelectorAll('img'));
            for (const img of allImages) {
                if (img.src && img.src.startsWith('data:')) continue;
                try {
                    if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
                        const cvs = document.createElement('canvas');
                        cvs.width = img.naturalWidth;
                        cvs.height = img.naturalHeight;
                        const ctx = cvs.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        const dataUrl = cvs.toDataURL('image/png');
                        convertedImages.push({ img, origSrc: img.src });
                        img.src = dataUrl;
                    }
                } catch (imgErr) {
                    // Ignore tainted image error
                }
            }

            await waitForFrames(2);

            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfW = 210;
            const pdfH = 297;

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const canvas = await renderSafePage(page, String(i));
                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
            }

            return pdf;
        } finally {
            // Restore converted image sources
            convertedImages.forEach(({ img, origSrc }) => {
                try { img.src = origSrc; } catch (e) {}
            });

            if (previewPanel) {
                previewPanel.scrollTop = prevScrollTop;
            }

            if (zoomArea) {
                zoomArea.style.transform = originalZoomAreaTransform;
                zoomArea.style.transformOrigin = originalZoomAreaTransformOrigin;
            }

            const previewRoot = previewRef.current;
            if (previewRoot) {
                const pages = Array.from(previewRoot.querySelectorAll('.pg-page'));
                pages.forEach((page, idx) => {
                    const oldVal = originalPageKeys[idx];
                    if (oldVal === null || oldVal === undefined) {
                        page.removeAttribute('data-pdf-page-key');
                    } else {
                        page.setAttribute('data-pdf-page-key', oldVal);
                    }
                });
            }

            setActiveTab(prevTab);
            setPreviewZoom(prevZoom);
        }
    };

    const generatePDF = async (fileName) => {
        setIsGeneratingPdf(true);
        try {
            const pdf = await buildPdfInstance();
            if (pdf) {
                const safeTitle = (form.title || form.proposalNumber || 'proposal')
                    .replace(/[/\\?%*:|"<>]/g, '_')
                    .trim();
                pdf.save(fileName || `${safeTitle}.pdf`);

                // Also update the proposal's pdfEditorState in the database if proposalId exists
                if (proposalId) {
                    try {
                        const base64Pdf = pdf.output('datauristring');
                        api.put(`/proposals/${proposalId}`, {
                            ...form,
                            proposalType: 'domestic',
                            pdfEditorState: {
                                ...(form.pdfEditorState || {}),
                                base64Pdf: base64Pdf,
                                savedAt: new Date().toISOString()
                            }
                        }).catch(e => console.warn('Background PDF state sync warning:', e.message));
                    } catch (e) { /* ignore */ }
                }
            }
        } catch (error) {
            console.error('PDF generation error:', error);
            alert('Error generating PDF: ' + (error?.message || 'Unknown error'));
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const saveProposalWithSignatures = async () => {
        const cleanForm = { ...form };
        cleanForm.proposalType = 'domestic';
        if (!cleanForm.clientName) {
            cleanForm.clientName = cleanForm.contactName || 'Client';
        }
        if (!cleanForm.deal || cleanForm.deal === '') delete cleanForm.deal;
        if (!cleanForm.template || cleanForm.template === '') delete cleanForm.template;

        // Auto-generate high-resolution preview PDF to save along with the proposal
        try {
            const pdf = await buildPdfInstance();
            if (pdf) {
                const base64Pdf = pdf.output('datauristring');
                cleanForm.pdfEditorState = {
                    ...(cleanForm.pdfEditorState || {}),
                    base64Pdf: base64Pdf,
                    savedAt: new Date().toISOString()
                };
            }
        } catch (pdfErr) {
            console.warn('Could not auto-generate base64 PDF on save:', pdfErr.message);
        }

        let res;
        if (proposalId) {
            res = await api.put(`/proposals/${proposalId}`, cleanForm);
        } else {
            res = await api.post('/proposals', cleanForm);
        }

        if (authorizedSigFile || clientSigFile) {
            const fd = new FormData();
            if (authorizedSigFile) fd.append('authorizedSignature', authorizedSigFile);
            if (clientSigFile) fd.append('clientSignature', clientSigFile);
            await api.post(`/proposals/${res.data._id}/signatures`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }

        return res.data;
    };

    const downloadExactPreviewPDF = async (fileName) => {
        await generatePDF(fileName);
    };

    const downloadFromPreview = async (fileName) => {
        await generatePDF(fileName);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const savedProposal = await saveProposalWithSignatures();

            alert(`Proposal ${proposalId ? 'updated' : 'created'} successfully!`);
            if (onSuccess) onSuccess(savedProposal);
            if (onClose) onClose();
        } catch (err) {
            alert('Error: ' + (err.response?.data?.message || err.message));
        }
        setSaving(false);
    };

    const downloadPreview = async () => {
        if (readOnly) {
            await downloadFromPreview(`proposal-${form.proposalNumber || 'view'}.pdf`);
            return;
        }
        // Save first
        setSaving(true);
        try {
            const savedProposal = await saveProposalWithSignatures();
            if (onSuccess) onSuccess(savedProposal);
            if (onClose) onClose();
        } catch (err) {
            alert('Error saving proposal: ' + (err.response?.data?.message || err.message));
        }
        setSaving(false);
    };

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    const fmtINR = (n) => Number(n || 0).toLocaleString('en-IN');

    const renderRepeatedHeader = () => (
        <>
            <div className="pg-header">
                <div className="pg-header-logo">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="pg-logo-img"
                        onError={e => {
                            e.target.onerror = null;
                            e.target.src = '';
                            e.target.style.display = 'none';
                        }}
                        onLoad={e => {
                            if (e.target.naturalWidth === 0 || e.target.naturalHeight === 0) {
                                e.target.style.display = 'none';
                            }
                        }}
                        width={100}
                        height={35}
                    />
                </div>
                <div className="pg-header-info">
                    <div className="pg-header-company">{COMPANY.name}</div>
                    <div className="pg-header-detail">{COMPANY.website} | {COMPANY.email}</div>
                    <div className="pg-header-detail">GSTIN: {COMPANY.gstin} | CIN: {COMPANY.cin}</div>
                    <div className="pg-header-detail">Registered Office: {COMPANY.address}</div>
                </div>
            </div>
            <div className="pg-header-line" />
        </>
    );

    const renderRepeatedFooter = () => (
        <div className="pg-footer">
            <div className="pg-footer-line" />
            <div className="pg-footer-row">
                <span>{COMPANY.shortName}</span>
                <span>{COMPANY.address}</span>
                <span className="pg-footer-link">{COMPANY.email}</span>
                <span className="pg-footer-link">{COMPANY.website}</span>
            </div>
        </div>
    );

    if (!hasAccess) {
        return (
            <div className="pg-container">
                <div className="pg-access-denied">
                    <div className="pg-ad-icon">🔒</div>
                    <h3>Access Denied</h3>
                    <p>You don't have permission to access the Proposal Generator.</p>
                </div>
            </div>
        );
    }

    // ======================== LIVE PREVIEW ========================
    // Always keep previewRef attached to a hidden root in the DOM
    const renderPreview = () => (

        <div className="pg-preview-wrap">
            {/* ========== PAGE 1: Company Profile ========== */}
            <div className="pg-page">
                <div className="pg-page-border">
                    {/* Header */}
                    <div className="pg-header">
                        <div className="pg-header-logo">
                            <img
                                src="/logo.png"
                                alt="Logo"
                                className="pg-logo-img"
                                onError={e => {
                                    e.target.onerror = null;
                                    e.target.style.display = 'none';
                                }}
                                onLoad={e => {
                                    if (e.target.naturalWidth === 0 || e.target.naturalHeight === 0) {
                                        e.target.style.display = 'none';
                                    }
                                }}
                                width={100}
                                height={35}
                            />
                        </div>
                        <div className="pg-header-info pg-header-info--first-page">
                            <div className="pg-header-company pg-header-company--first-page">{COMPANY.name}</div>
                            <div className="pg-header-detail pg-header-detail--first-page">{COMPANY.website} | {COMPANY.email}</div>
                            <div className="pg-header-detail pg-header-detail--first-page">GSTIN: {COMPANY.gstin} | CIN: {COMPANY.cin}</div>
                            <div className="pg-header-detail pg-header-detail--first-page">Registered Office: {COMPANY.address}</div>
                        </div>
                    </div>
                    <div className="pg-header-line" />

                    {/* Title */}
                    <div className="pg-title">PROJECT PROPOSAL</div>
                    <div className="pg-subtitle">{form.title || 'Dynamic Website'}</div>

                    {/* Company Info Table */}
                    <div className="pg-table-wrap" style={{ width: '100%', display: 'block', boxSizing: 'border-box' }}>
                        <table className="pg-info-table" style={{ width: '100%', minWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                            <colgroup>
                                <col style={{ width: '30%' }} />
                                <col style={{ width: '70%' }} />
                            </colgroup>
                            <tbody>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Prepared By</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.shortName}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Website</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.website}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Email</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.email}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Address</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.address}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Client Info */}
                    <div className="pg-section-title">CLIENT INFORMATION</div>
                    <div className="pg-table-wrap" style={{ width: '100%', display: 'block', boxSizing: 'border-box' }}>
                        <table className="pg-info-table pg-client-table" style={{ width: '100%', minWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                            <colgroup>
                                <col style={{ width: '30%' }} />
                                <col style={{ width: '70%' }} />
                            </colgroup>
                            <tbody>
                                {/* Client Name row removed as per request */}
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Contact Person</td><td className="pg-it-value" style={{ width: '70%' }}>{form.contactName || '—'}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Email</td><td className="pg-it-value" style={{ width: '70%' }}>{form.clientEmail || '—'}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Phone</td><td className="pg-it-value" style={{ width: '70%' }}>{form.clientPhone || '—'}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Address</td><td className="pg-it-value" style={{ width: '70%' }}>{form.clientAddress || '—'}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    {form.proposalNumber && (
                        <div className="pg-meta-row">
                            <span>Proposal #: {form.proposalNumber}</span>
                        </div>
                    )}

                    {/* Profile */}
                    <div className="pg-section-title">SUMMARY OF COMPANY PROFILE</div>
                    {PROFILE_TEXT.split('\n\n').map((paragraph, pIdx) => (
                        <p key={pIdx} className="pg-body-text">{paragraph}</p>
                    ))}

                    {/* Our Services (moved to first page) */}
                    <div className="pg-section-title">OUR SERVICES</div>
                    <div className="pg-services-grid">
                        {SERVICES.map((s, i) => (
                            <div key={i} className="pg-service-cell">• {s}</div>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="pg-footer">
                        <div className="pg-footer-line" />
                        <div className="pg-footer-row">
                            <span>{COMPANY.shortName}</span>
                            <span>{COMPANY.address}</span>
                            <span className="pg-footer-link">{COMPANY.email}</span>
                            <span className="pg-footer-link">{COMPANY.website}</span>
                        </div>
                    </div>
                </div>
            </div>

            <PaginatedProjectPreview
                sections={form.projectSections}
                timeline={form.projectTimeline}
                renderHeader={renderRepeatedHeader}
                renderFooter={renderRepeatedFooter}
                readOnly={readOnly}
                onUpdatePageContent={(pageNum, newContent) => handlePageContentChange(pageNum, newContent)}
                onPageClick={(pageNum) => setActiveProjectPage(pageNum)}
                onPageCapacityChange={setPageCapacities}
            />

            {/* ========== PAGE 3: Costing & Payment ========== */}
            <div className="pg-page">
                <div className="pg-page-border">
                    {/* Header */}
                    <div className="pg-header">
                        <div className="pg-header-logo">
                            <img
                                src="/logo.png"
                                alt="Logo"
                                className="pg-logo-img"
                                onError={e => {
                                    e.target.onerror = null;
                                    e.target.src = '';
                                    e.target.style.display = 'none';
                                }}
                                onLoad={e => {
                                    if (e.target.naturalWidth === 0 || e.target.naturalHeight === 0) {
                                        e.target.style.display = 'none';
                                    }
                                }}
                                width={100}
                                height={35}
                            />
                        </div>
                        <div className="pg-header-info">
                            <div className="pg-header-company">{COMPANY.name}</div>
                            <div className="pg-header-detail">{COMPANY.website} | {COMPANY.email}</div>
                            <div className="pg-header-detail">GSTIN: {COMPANY.gstin} | CIN: {COMPANY.cin}</div>
                            <div className="pg-header-detail">Registered Office: {COMPANY.address}</div>
                        </div>
                    </div>
                    <div className="pg-header-line" />
                    <div className="pg-costing-header">
                        COSTING FOR {(form.title || 'PROJECT').toUpperCase()}
                    </div>
                    <div className="pg-table-wrap" style={{ width: '100%', display: 'block', boxSizing: 'border-box' }}>
                        <table className="pg-cost-table" style={{ width: '100%', minWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                            <colgroup>
                                <col style={{ width: '48%' }} />
                                <col style={{ width: '24%' }} />
                                <col style={{ width: '28%' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th style={{ width: '48%' }}>Individuals</th>
                                    <th style={{ width: '24%' }}>Term's</th>
                                    <th style={{ width: '28%', textAlign: 'right' }}>Price Rs.(₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {form.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td style={{ width: '48%' }}>{item.description || '—'}</td>
                                        <td style={{ width: '24%' }}>{item.quantity > 1 ? `${item.quantity} units` : 'Total'}</td>
                                        <td className="pg-ct-amount" style={{ width: '28%', textAlign: 'right' }}>{fmtINR(item.amount)}/-</td>
                                    </tr>
                                ))}
                                <tr className="pg-ct-summary">
                                    <td colSpan="2" style={{ width: '72%' }}><strong>Sub Total</strong></td>
                                    <td className="pg-ct-amount" style={{ width: '28%', textAlign: 'right' }}><strong>{fmtINR(form.subtotal)}/-</strong></td>
                                </tr>
                                {form.taxAmount > 0 && (
                                    <tr className="pg-ct-summary">
                                        <td colSpan="2" style={{ width: '72%' }}>GST {form.taxPercentage}%</td>
                                        <td className="pg-ct-amount" style={{ width: '28%', textAlign: 'right' }}>{fmtINR(form.taxAmount)}/-</td>
                                    </tr>
                                )}
                                {form.discount > 0 && (
                                    <tr className="pg-ct-summary">
                                        <td colSpan="2" style={{ width: '72%' }}>Discount</td>
                                        <td className="pg-ct-amount" style={{ width: '28%', textAlign: 'right' }}>-{fmtINR(form.discount)}/-</td>
                                    </tr>
                                )}
                                <tr className="pg-ct-total">
                                    <td colSpan="2" style={{ width: '72%' }}><strong>Offered Price / Net Amount</strong></td>
                                    <td className="pg-ct-amount" style={{ width: '28%', textAlign: 'right' }}><strong>{fmtINR(form.total)}/-</strong></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Payment Details */}
                    <div className="pg-costing-header">
                        PAYMENT DETAILS
                    </div>
                    <div className="pg-table-wrap" style={{ width: '100%', display: 'block', boxSizing: 'border-box' }}>
                        <table className="pg-info-table pg-bank-table" style={{ width: '100%', minWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                            <colgroup>
                                <col style={{ width: '30%' }} />
                                <col style={{ width: '70%' }} />
                            </colgroup>
                            <tbody>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Account Name</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.accountName}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Account Number</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.accountNumber}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>IFSC Code</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.ifsc}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>Bank Name</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.bankName}</td></tr>
                                <tr><td className="pg-it-label" style={{ width: '30%' }}>UPI ID</td><td className="pg-it-value" style={{ width: '70%' }}>{COMPANY.upi}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="pg-payment-note">
                        Note: Pay only on Company's account or on QR Code. Don't Pay on any employee's account or QR Code.
                    </div>

                    <div className="pg-tc-title">TERMS AND CONDITIONS</div>

                    <div className="pg-tc-content">
                        {form.termsAndConditions && form.termsAndConditions.split('\n').map((line, i) => (
                            <p key={i} className="pg-tc-line">{line}</p>
                        ))}
                    </div>

                    <p className="pg-tc-bold">If you cancel the project midway, the company will not refund your payment.</p>
                    <p className="pg-tc-refund">
                        <strong>Refund Policy:</strong> If the Project is canceled by the Company (BTPL), your money will be refunded within 45 days.
                    </p>

                    <div className="pg-meta-row" style={{ marginTop: '12px' }}>
                        <span>Date: {fmtDate(form.date)}</span>
                    </div>

                    {form.notes && (
                        <>
                            <div className="pg-section-title" style={{ marginTop: '16px' }}>ADDITIONAL NOTES</div>
                            <p className="pg-body-text">{form.notes}</p>
                        </>
                    )}

                    {/* Footer */}
                    <div className="pg-footer">
                        <div className="pg-footer-line" />
                        <div className="pg-footer-row">
                            <span>{COMPANY.shortName}</span>
                            <span>{COMPANY.address}</span>
                            <span className="pg-footer-link">{COMPANY.email}</span>
                            <span className="pg-footer-link">{COMPANY.website}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="pg-page">
                <div className="pg-page-border">
                    <div className="pg-header">
                        <div className="pg-header-logo">
                            <img
                                src="/logo.png"
                                alt="Logo"
                                className="pg-logo-img"
                                onError={e => {
                                    e.target.onerror = null;
                                    e.target.src = '';
                                    e.target.style.display = 'none';
                                }}
                                onLoad={e => {
                                    if (e.target.naturalWidth === 0 || e.target.naturalHeight === 0) {
                                        e.target.style.display = 'none';
                                    }
                                }}
                                width={100}
                                height={35}
                            />
                        </div>
                        <div className="pg-header-info">
                            <div className="pg-header-company">{COMPANY.name}</div>
                            <div className="pg-header-detail">{COMPANY.website} | {COMPANY.email}</div>
                            <div className="pg-header-detail">GSTIN: {COMPANY.gstin} | CIN: {COMPANY.cin}</div>
                            <div className="pg-header-detail">Registered Office: {COMPANY.address}</div>
                        </div>
                    </div>
                    <div className="pg-header-line" />

                    <div className="pg-section-title">APPROVAL AND SIGNATURES</div>

                    <div className="pg-regards">
                        <p>Regards,</p>
                        <p><strong>{COMPANY.shortName}</strong></p>
                        <p>Add – {COMPANY.address}</p>
                        <p>Email: {COMPANY.email}</p>
                    </div>

                    <div className="pg-signatures">
                        <div className="pg-sig-block">
                            <div className="pg-sig-for">For {COMPANY.shortName}</div>
                            {authorizedSigPreview ? (
                                <img src={authorizedSigPreview} alt="Authorized Signature" style={{ maxHeight: '50px', maxWidth: '150px', objectFit: 'contain', margin: '8px 0' }} />
                            ) : (
                                <>
                                    <div className="pg-sig-space" style={{ height: '36px', width: '100%', background: 'transparent' }} />
                                    <div className="pg-sig-line" style={{ height: '1px', maxHeight: '1px', minHeight: '1px', background: '#94a3b8', width: '100%', margin: '0 0 6px 0', border: 'none' }} />
                                </>
                            )}
                            <div className="pg-sig-label"><strong>Authorized Signatory</strong></div>
                            <div className="pg-sig-name">{COMPANY.shortName}</div>
                        </div>
                        <div className="pg-sig-block">
                            <div className="pg-sig-for">Acceptance / Client Signature</div>
                            {clientSigPreview ? (
                                <img src={clientSigPreview} alt="Client Signature" style={{ maxHeight: '50px', maxWidth: '150px', objectFit: 'contain', margin: '8px 0' }} />
                            ) : (
                                <>
                                    <div className="pg-sig-space" style={{ height: '36px', width: '100%', background: 'transparent' }} />
                                    <div className="pg-sig-line" style={{ height: '1px', maxHeight: '1px', minHeight: '1px', background: '#94a3b8', width: '100%', margin: '0 0 6px 0', border: 'none' }} />
                                </>
                            )}
                            <div className="pg-sig-label"><strong>Client Name & Signature</strong></div>
                            <div className="pg-sig-name">Date: ________________</div>
                        </div>
                    </div>

                    <div className="pg-footer">
                        <div className="pg-footer-line" />
                        <div className="pg-footer-row">
                            <span>{COMPANY.shortName}</span>
                            <span>{COMPANY.address}</span>
                            <span className="pg-footer-link">{COMPANY.email}</span>
                            <span className="pg-footer-link">{COMPANY.website}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (!isOpen) return null;

    return (
        <div className="pg-modal-overlay">
            {/* Loading & Saving Spinner Overlay */}
            {(isLoadingProposal || saving) && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10005,
                    backdropFilter: 'blur(6px)'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '32px 36px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                        maxWidth: '420px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            border: '4px solid #e2e8f0',
                            borderTop: '4px solid #2e7d32',
                            borderRadius: '50%',
                            animation: 'domestic-spinner 0.8s linear infinite',
                            marginBottom: '18px'
                        }} />
                        <div style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#0f172a',
                            marginBottom: '6px',
                            fontFamily: "'Inter', sans-serif"
                        }}>
                            {saving
                                ? (proposalId ? 'Updating & Generating Proposal...' : 'Generating & Saving Proposal...')
                                : (readOnly ? 'Loading Proposal Preview...' : 'Loading Proposal Data...')}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            lineHeight: 1.5,
                            fontFamily: "'Inter', sans-serif"
                        }}>
                            {saving
                                ? 'Rendering preview, compiling high-resolution pages and saving...'
                                : (readOnly ? 'Preparing proposal document for preview...' : 'Loading proposal form and assets...')}
                        </div>
                    </div>
                </div>
            )}

            {/* DOCX Parsing Spinner Overlay */}
            {isParsingDocx && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10002,
                    backdropFilter: 'blur(6px)'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '32px 36px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                        maxWidth: '400px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            border: '4px solid #e2e8f0',
                            borderTop: '4px solid #3b775e',
                            borderRadius: '50%',
                            animation: 'domestic-spinner 0.8s linear infinite',
                            marginBottom: '18px'
                        }} />
                        <div style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#0f172a',
                            marginBottom: '6px'
                        }}>
                            Importing Word Document...
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            lineHeight: 1.5
                        }}>
                            Extracting headings, bullet lists & layout across proposal pages...
                        </div>
                    </div>
                </div>
            )}

            {/* PDF Generation Spinner Overlay */}
            {isGeneratingPdf && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(15, 23, 42, 0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10003,
                    backdropFilter: 'blur(6px)'
                }}>
                    <div style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        padding: '32px 36px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                        maxWidth: '400px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            width: '52px',
                            height: '52px',
                            border: '4px solid #e2e8f0',
                            borderTop: '4px solid #2e7d32',
                            borderRadius: '50%',
                            animation: 'domestic-spinner 0.8s linear infinite',
                            marginBottom: '18px'
                        }} />
                        <div style={{
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#0f172a',
                            marginBottom: '6px'
                        }}>
                            Generating High-Resolution PDF...
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            lineHeight: 1.5
                        }}>
                            Rendering pages exactly as previewed with high-fidelity formatting...
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes domestic-spinner {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>

            <div className="pg-modal-content">
                <button className="pg-modal-close" onClick={onClose} title="Close Generator">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <div className="pg-container">
                    {/* Top bar */}
                    <div className="pg-topbar">
                        <div style={{ padding: '0 24px' }}>
                            <h1 className="pg-page-title">{proposalId ? (readOnly ? 'View Proposal' : 'Edit Proposal') : 'Proposal Generator'}</h1>
                            <p className="pg-page-subtitle">{readOnly ? 'Detailed preview of the client proposal' : 'Create professional proposals with live preview'}</p>
                        </div>
                        <div className="pg-topbar-actions" style={{ padding: '0 24px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                type="button"
                                className="pg-btn pg-btn-primary"
                                onClick={() => generatePDF(`proposal-${form.proposalNumber || 'bhoomi'}.pdf`)}
                                disabled={isGeneratingPdf}
                                title="Download PDF exactly matching the Live Preview"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    backgroundColor: '#2e7d32',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                            </button>
                        </div>
                    </div>

                    {/* Mobile tab toggle */}
                    {!readOnly && (
                        <div className="pg-tab-bar">
                            <button className={`pg-tab ${activeTab === 'form' ? 'pg-tab-active' : ''}`} onClick={() => setActiveTab('form')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                                Form
                            </button>
                            <button className={`pg-tab ${activeTab === 'preview' ? 'pg-tab-active' : ''}`} onClick={() => setActiveTab('preview')}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                Preview
                            </button>
                        </div>
                    )}

                    <div className="pg-layout" style={{
                        height: 'calc(100% - 100px)',
                        overflow: 'hidden',
                        gridTemplateColumns: readOnly ? '1fr' : undefined
                    }}>
                        {/* LEFT: Form */}
                        {!readOnly && (
                            <div className={`pg-form-panel ${activeTab === 'form' ? 'pg-panel-visible' : ''}`} style={{ height: '100%', overflowY: 'auto', padding: '0 24px 40px' }}>
                                <div className="pg-form-header" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h2 className="pg-form-title" style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>{proposalId ? 'Update' : 'Generate'} Proposal</h2>
                                        <p className="pg-form-subtitle" style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Fill in the details below to {proposalId ? 'update' : 'create'} a professional proposal</p>
                                    </div>
                                </div>
                                <form onSubmit={handleSave}>
                                    <fieldset disabled={readOnly} style={{ border: 'none', padding: 0, margin: 0 }}>
                                        {/* Basic */}
                                        <div className="pg-form-section">
                                            <div className="pg-fs-header">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                                Basic Information
                                            </div>
                                            <div className="pg-grid-2">
                                                <div className="pg-field">
                                                    <label className="pg-lbl">Proposal Title <span className="pg-req">*</span></label>
                                                    <input type="text" name="title" className="pg-input" placeholder="e.g. Dynamic Website" value={form.title} onChange={handleChange} required />
                                                </div>
                                                {/* Template field removed as per request */}
                                            </div>
                                            <div className="pg-grid-2">
                                                <div className="pg-field">
                                                    <label className="pg-lbl">Date <span className="pg-req">*</span></label>
                                                    <input type="date" name="date" className="pg-input" value={form.date} onChange={handleChange} required />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Client */}
                                        <div className="pg-form-section">
                                            <div className="pg-fs-header">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                Client Information
                                            </div>

                                            {/* Client Mode Toggle */}
                                            <div className="pg-mode-toggle">
                                                <button
                                                    type="button"
                                                    className={`pg-mode-btn ${clientMode === 'select' ? 'pg-mode-active' : ''}`}
                                                    onClick={() => {
                                                        setClientMode('select');
                                                        clearClientFields();
                                                    }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>
                                                    Select Existing
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`pg-mode-btn ${clientMode === 'manual' ? 'pg-mode-active' : ''}`}
                                                    onClick={() => {
                                                        setClientMode('manual');
                                                        clearClientFields();
                                                    }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                                                    Enter Manually
                                                </button>
                                            </div>

                                            {/* Select Existing Client */}
                                            {clientMode === 'select' && (
                                                <div className="pg-grid-2">
                                                    <div className="pg-field">
                                                        <label className="pg-lbl">Select Client <span className="pg-req">*</span></label>
                                                        <select className="pg-input pg-select" onChange={(e) => handleClientSelect(e.target.value)} value={form.clientId || ''}>
                                                            <option value="">-- Choose a client --</option>
                                                            {clients.map(c => {
                                                                const displayText = `${c.company || c.name} ${c.email ? `(${c.email})` : ''}`;
                                                                return <option key={c._id} value={c._id}>{displayText}</option>;
                                                            })}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Manual Client Entry intentionally starts with contact fields */}
                                            {clientMode === 'manual' && (
                                                <div className="pg-field">
                                                    <label className="pg-lbl">Client/Company Name <span className="pg-req">*</span></label>
                                                    <input type="text" name="clientName" className="pg-input" placeholder="e.g. Acme Corp" value={form.clientName} onChange={handleChange} required />
                                                </div>
                                            )}

                                            {/* Common Details (always visible after selection/entry) */}
                                            {(clientMode === 'manual' || form.clientName || form.clientId) && (
                                                <>
                                                    <div className="pg-grid-2">
                                                        <div className="pg-field">
                                                            <label className="pg-lbl">Contact Person</label>
                                                            <input type="text" name="contactName" className="pg-input" placeholder="Contact Person" value={form.contactName} onChange={handleChange} />
                                                        </div>
                                                        <div className="pg-field">
                                                            <label className="pg-lbl">Email</label>
                                                            <input type="email" name="clientEmail" className="pg-input" placeholder="client@email.com" value={form.clientEmail} onChange={handleChange} />
                                                        </div>
                                                    </div>
                                                    <div className="pg-grid-2">
                                                        <div className="pg-field">
                                                            <label className="pg-lbl">Phone</label>
                                                            <input type="tel" name="clientPhone" className="pg-input" placeholder="+91 XXXXXXXXXX" value={form.clientPhone} onChange={handleChange} />
                                                        </div>
                                                        <div className="pg-field">
                                                            <label className="pg-lbl">Address</label>
                                                            <input type="text" name="clientAddress" className="pg-input" placeholder="Complete address" value={form.clientAddress} onChange={handleChange} />
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Project Details */}
                                        <div className="pg-form-section">
                                            <div className="pg-fs-header" style={{ justifyContent: 'space-between' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                                                    Project Details
                                                </span>
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>
                                                    Total Project Pages: {maxProjectPages}
                                                </span>
                                            </div>

                                            {/* Multi-Page Navigation Bar */}
                                            <div className="pg-page-tabs-container">
                                                <div className="pg-page-tabs-list">
                                                    {Array.from({ length: maxProjectPages }, (_, idx) => {
                                                        const pageNum = idx + 1;
                                                        const isActive = pageNum === activeProjectPage;
                                                        return (
                                                            <button
                                                                key={`page-tab-${pageNum}`}
                                                                type="button"
                                                                className={`pg-page-tab-btn ${isActive ? 'active' : ''}`}
                                                                onClick={() => setActiveProjectPage(pageNum)}
                                                            >
                                                                Page {pageNum}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className="pg-page-tab-actions">
                                                    <button
                                                        type="button"
                                                        className="pg-btn-add-page"
                                                        onClick={handleAddProjectPage}
                                                        title="Add a new blank page for additional content"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                        Add Page
                                                    </button>
                                                    {maxProjectPages > 1 && (
                                                        <button
                                                            type="button"
                                                            className="pg-btn-del-page"
                                                            onClick={() => handleRemoveProjectPage(activeProjectPage)}
                                                            title={`Delete Page ${activeProjectPage}`}
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                                            Delete Page {activeProjectPage}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* DOCX Import or Manual Entry Bar */}
                                            <div className="pg-import-bar">
                                                <div className="pg-import-bar-left">
                                                    <span className="pg-import-label">Content Import:</span>
                                                    <label className={`pg-docx-upload-btn ${isParsingDocx ? 'is-parsing' : ''}`} title="Upload a Word document (.docx) to automatically parse headings, bullets, and text">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><line x1="9" y1="15" x2="12" y2="12" /><line x1="15" y1="15" x2="12" y2="12" /></svg>
                                                        <span>{isParsingDocx ? 'Parsing Document...' : 'Import from Word (.docx)'}</span>
                                                        <input
                                                            type="file"
                                                            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                                            onChange={handleDocxUpload}
                                                            disabled={isParsingDocx}
                                                            style={{ display: 'none' }}
                                                            ref={docxInputRef}
                                                        />
                                                    </label>
                                                </div>
                                                <span className="pg-import-hint">or manually type / paste content below (drag & drop .docx supported)</span>
                                            </div>

                                            {/* Active Page Editor Card */}
                                            <div
                                                className={`pg-content-box ${isDraggingDocx ? 'is-dragging-docx' : ''}`}
                                                onDrop={handleDocxDrop}
                                                onDragOver={handleDocxDragOver}
                                                onDragLeave={handleDocxDragLeave}
                                            >

                                                <div className="pg-field" style={{ marginBottom: '4px' }}>
                                                    <label className="pg-lbl">
                                                        Enter Content
                                                    </label>
                                                    <CanvaTextEditor
                                                        value={getPageData(activeProjectPage).pageContent}
                                                        onChange={(newContent) => handlePageContentChange(activeProjectPage, newContent)}
                                                        pageNumber={activeProjectPage}
                                                        isPageFull={pageCapacities[activeProjectPage]?.isFull}
                                                        pageCapacity={pageCapacities[activeProjectPage]}
                                                        onAddPage={handleAddProjectPage}
                                                        placeholder={`Paste or type your project details, scope, features, or bullet points here for Page ${activeProjectPage}...\n\n• Select text to apply Bold, Italic, Underline, Colors & Font Sizes using the toolbar.\n• Format is reflected in live preview instantly.\n• Click "+ Add Page" above if your content needs another page.`}
                                                    />
                                                </div>
                                            </div>

                                            <div className="pg-field" style={{ marginTop: '12px' }}>
                                                <label className="pg-lbl">Timeline</label>
                                                <input type="text" name="projectTimeline" className="pg-input" placeholder="e.g. 8–10 weeks" value={form.projectTimeline} onChange={handleChange} />
                                            </div>
                                        </div>

                                        {/* Pricing */}
                                        <div className="pg-form-section">
                                            <div className="pg-fs-header" style={{ justifyContent: 'space-between' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                                    Services & Pricing
                                                </span>
                                                <button type="button" className="pg-btn-add" onClick={addItem}>+ Add</button>
                                            </div>

                                            <div className="pg-items-header">
                                                <span>Description</span><span>Qty</span><span>Rate (₹)</span><span>Amount</span><span></span>
                                            </div>
                                            {form.items.map((item, i) => (
                                                <div className="pg-item-row" key={i}>
                                                    <input type="text" className="pg-input" placeholder="Service name" value={item.description} onChange={(e) => handleItemChange(i, 'description', e.target.value)} required />
                                                    <input type="number" className="pg-input" min="1" value={item.quantity} onChange={(e) => handleItemChange(i, 'quantity', parseFloat(e.target.value) || 0)} />
                                                    <input type="number" className="pg-input" min="0" value={item.rate} onChange={(e) => handleItemChange(i, 'rate', parseFloat(e.target.value) || 0)} />
                                                    <input type="number" className="pg-input pg-readonly" value={item.amount} readOnly />
                                                    {form.items.length > 1 ? (
                                                        <button type="button" className="pg-btn-remove" onClick={() => removeItem(i)}>×</button>
                                                    ) : <span />}
                                                </div>
                                            ))}

                                            <div className="pg-totals">
                                                <div className="pg-total-row"><span>Subtotal</span><span>₹{fmtINR(form.subtotal)}</span></div>
                                                <div className="pg-total-row">
                                                    <span className="pg-total-with-input">Tax <input type="number" name="taxPercentage" className="pg-input pg-input-mini" value={form.taxPercentage} onChange={handleChange} min="0" max="100" /> %</span>
                                                    <span>₹{fmtINR(form.taxAmount)}</span>
                                                </div>
                                                <div className="pg-total-row">
                                                    <span className="pg-total-with-input">Discount <input type="number" name="discount" className="pg-input pg-input-mini" value={form.discount} onChange={handleChange} min="0" style={{ width: '80px' }} /></span>
                                                    <span>−₹{fmtINR(form.discount)}</span>
                                                </div>
                                                <div className="pg-total-row pg-total-final"><span>Total</span><span>₹{fmtINR(form.total)}</span></div>
                                            </div>
                                        </div>

                                        {/* Terms */}
                                        <div className="pg-form-section">
                                            <div className="pg-fs-header">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                                                Payment & Terms
                                            </div>
                                            <div className="pg-field">
                                                <label className="pg-lbl">Terms & Conditions</label>
                                                <textarea name="termsAndConditions" className="pg-input pg-textarea" rows="6" value={form.termsAndConditions} onChange={handleChange} />
                                            </div>
                                            <div className="pg-field">
                                                <label className="pg-lbl">Additional Notes</label>
                                                <textarea name="notes" className="pg-input pg-textarea" rows="3" placeholder="Any special notes..." value={form.notes} onChange={handleChange} />
                                            </div>
                                        </div>

                                        {/* Signatures Upload */}
                                        <div className="pg-form-section">
                                            <div className="pg-fs-header">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></svg>
                                                Signatures
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                {/* Authorized Signature */}
                                                <div className="pg-field">
                                                    <label className="pg-lbl">Authorized Signatory</label>
                                                    {authorizedSigPreview ? (
                                                        <div style={{ position: 'relative', display: 'inline-block', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                                                            <img src={authorizedSigPreview} alt="Authorized" style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                                                            <button type="button" onClick={() => removeSig('authorized')} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                                                        </div>
                                                    ) : (
                                                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '18px 12px', border: '2px dashed #cbd5e1', borderRadius: '10px', cursor: 'pointer', color: '#94a3b8', fontSize: '12px', transition: 'border-color .2s', background: '#fff' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#3b775e'} onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}>
                                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                            Upload Signature Image
                                                            <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => handleSigChange('authorized', e.target.files[0])} />
                                                        </label>
                                                    )}
                                                </div>
                                                {/* Client Signature */}
                                                <div className="pg-field">
                                                    <label className="pg-lbl">Client Signature</label>
                                                    {clientSigPreview ? (
                                                        <div style={{ position: 'relative', display: 'inline-block', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '10px', background: '#fff' }}>
                                                            <img src={clientSigPreview} alt="Client" style={{ maxHeight: '70px', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
                                                            {!readOnly && <button type="button" onClick={() => removeSig('client')} style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22, borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>}
                                                        </div>
                                                    ) : (
                                                        <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '18px 12px', border: '2px dashed #cbd5e1', borderRadius: '10px', cursor: readOnly ? 'default' : 'pointer', color: '#94a3b8', fontSize: '12px', transition: 'border-color .2s', background: '#fff' }} onMouseEnter={e => !readOnly && (e.currentTarget.style.borderColor = '#3b775e')} onMouseLeave={e => !readOnly && (e.currentTarget.style.borderColor = '#cbd5e1')}>
                                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                            Upload Signature Image
                                                            <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={(e) => handleSigChange('client', e.target.files[0])} disabled={readOnly} />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </fieldset>

                                    <div className="pg-form-footer" style={{ marginTop: '20px' }}>
                                        <button type="submit" className="pg-btn pg-btn-primary" disabled={saving}>
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                                            {saving ? 'Saving...' : (proposalId ? 'Update Proposal' : 'Create Proposal')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}



                        {/* RIGHT: Preview (always rendered, hidden if not active) */}
                        <div
                            className={`pg-preview-panel${activeTab === 'preview' ? ' pg-panel-visible' : ''}`}
                            style={{
                                height: '100%',
                                overflowY: 'auto',
                                padding: '0 24px 40px',
                                background: '#f8fafc',
                                display: readOnly || activeTab === 'preview' || window.innerWidth > 768 ? 'block' : 'none',
                                flex: readOnly ? 1 : undefined
                            }}
                        >
                            <div ref={previewRef} style={{ display: 'contents' }}>
                                <div className="pg-preview-toolbar" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', padding: '12px 0' }}>
                                    <div className="pg-preview-label">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                        Live Preview
                                    </div>
                                    <div className="pg-zoom-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <button
                                            type="button"
                                            onClick={() => generatePDF(`proposal-${form.proposalNumber || 'bhoomi'}.pdf`)}
                                            disabled={isGeneratingPdf}
                                            title="Download PDF exactly matching the preview"
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                padding: '4px 10px',
                                                fontSize: '12px',
                                                fontWeight: '600',
                                                background: '#2e7d32',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                marginRight: '4px'
                                            }}
                                        >
                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                                        </button>
                                        <button type="button" className="pg-zoom-btn" onClick={zoomOut} title="Zoom Out">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                                        </button>
                                        <span className="pg-zoom-level" onClick={zoomReset} title="Reset zoom">{Math.round(previewZoom * 100)}%</span>
                                        <button type="button" className="pg-zoom-btn" onClick={zoomIn} title="Zoom In">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                                        </button>
                                        <button type="button" className="pg-zoom-btn pg-expand-btn" onClick={() => setShowFullPreview(true)} title="Fullscreen Preview">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                                        </button>
                                    </div>
                                </div>
                                <div className="pg-preview-zoom-area" style={{ transform: `scale(${previewZoom})`, transformOrigin: 'top center' }}>
                                    <div>
                                        {renderPreview()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Fullscreen Preview Modal */}
                        {showFullPreview && (
                            <div className="pg-fullpreview-overlay" onClick={() => setShowFullPreview(false)}>
                                <div className="pg-fullpreview-modal" onClick={(e) => e.stopPropagation()}>
                                    <div className="pg-fullpreview-header">
                                        <span className="pg-fullpreview-title">Proposal Preview</span>
                                        <button type="button" className="pg-fullpreview-close" onClick={() => setShowFullPreview(false)}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                        </button>
                                    </div>
                                    <div className="pg-fullpreview-body">
                                        {renderPreview()}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DomesticProposalGenerator;
