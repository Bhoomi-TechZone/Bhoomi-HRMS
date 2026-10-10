import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useContextualQueryState } from '../utils/routeUtils';
import './DocumentGenerator.css';
import './Letters.css';
import { generateNDAHtml, generateNDADocx } from '../utils/ndaTemplateGenerator';
import { saveAs } from 'file-saver';
import { downloadHtmlAsPdf } from '../utils/pdfDownloadHelper';

const LETTER_TYPES = [
  'offer_letter', 'joining_letter', 'experience_letter', 'nda', 'exit_certificate'
];

// Convert a public-folder image URL to a base64 data URI so Puppeteer (which has
// no web-server context) can embed it in the generated PDF.
const imgToBase64 = async (url) => {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return url; // fallback: use original path
  }
};

function Letters() {
  const { user, hasPermission } = useAuth();
  const [{ filter: filterType, page: currentPage, view: viewMode, search: searchTerm, employeeId, id }, setQueryState] = useContextualQueryState({
    filter: '',
    page: 1,
    view: 'list',
    search: '',
    employeeId: '',
  });

  const setSearchTerm = useCallback((search) => setQueryState({ search, page: 1 }), [setQueryState]);
  const setFilterType = useCallback((filter) => setQueryState({ filter, page: 1 }), [setQueryState]);
  const setCurrentPage = useCallback((page) => setQueryState((prev) => ({ page: typeof page === 'function' ? page(prev.page || 1) : page })), [setQueryState]);
  const setViewMode = useCallback((view) => setQueryState({ view }), [setQueryState]);

  const menuRef = useRef({});
  const genBtnRef = useRef(null);

  const [employees, setEmployees] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const itemsPerPage = 10;

  // Generate modal
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState('setup'); // 'setup' | 'fill'
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [formData, setFormData] = useState({});
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);

  // Preview
  const [previewHtml, setPreviewHtml] = useState('');
  const [rawTemplateHtml, setRawTemplateHtml] = useState(''); // raw HTML from server (file or content)
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  // Edit Document
  const [editingDocId, setEditingDocId] = useState(null);
  const [editingHtml, setEditingHtml] = useState('');
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Sales Joining Letter
  const [showJoiningLetterModal, setShowJoiningLetterModal] = useState(false);
  const [showITOfferLetterModal, setShowITOfferLetterModal] = useState(false);
  const [showSalesOfferLetterModal, setShowSalesOfferLetterModal] = useState(false);
  const [showITJoiningLetterModal, setShowITJoiningLetterModal] = useState(false);
  const [showExperienceLetterModal, setShowExperienceLetterModal] = useState(false);
  const [showExitLetterModal, setShowExitLetterModal] = useState(false);
  const [showNDAModal, setShowNDAModal] = useState(false);
  const [ndaForm, setNdaForm] = useState({
    salutation: 'Mr.',
    employeeName: '',
    fathersName: '',
    fullAddress: '',
    designation: '',
    mobileNo: '',
    emailId: '',
    joiningDate: new Date().toISOString().split('T')[0],
    employeeId: '',
  });
  const [ndaEmpSearch, setNdaEmpSearch] = useState('');
  const [ndaEmpDropdownOpen, setNdaEmpDropdownOpen] = useState(false);
  const [genDropdownOpen, setGenDropdownOpen] = useState(false);
  const [expandedLetterSection, setExpandedLetterSection] = useState(null);
  const [joiningLetterForm, setJoiningLetterForm] = useState({
    letterDate: new Date().toISOString().split('T')[0],
    candidateName: '',
    position: '',
    department: 'Sales',
    joiningDate: '',
    salary: '',
    workingHours: '10:00 AM – 7:00 PM',
    probationPeriod: '1 Month',
    lateThreshold: '10:15 AM',
    halfDayStart: '10:30 AM',
    halfDayEnd: '12:00 PM',
    fullDayAfter: '12:00 PM',
  });

  const [itOfferLetterForm, setItOfferLetterForm] = useState({
    letterDate: new Date().toISOString().split('T')[0],
    candidateName: '',
    position: '',
    joiningDate: '',
    salary: '',
    duration: '',
    observationPeriod: '3 Days Unpaid',
    workingDays: 'Monday to Saturday',
    officeHours: '10:00 AM to 7:00 PM',
    reportingTime: '09:45 AM',
  });

  const [salesOfferLetterForm, setSalesOfferLetterForm] = useState({
    letterDate: new Date().toISOString().split('T')[0],
    candidateName: '',
    position: '',
    joiningDate: '',
    salary: '',
    stipend: '',
    trainingPeriod: '15 Days',
    salesTarget: '91,000',
    workingDays: 'Monday to Saturday',
    officeHours: '10:00 AM to 7:00 PM',
    reportingTime: '09:45 AM',
  });

  const [experienceLetterForm, setExperienceLetterForm] = useState({
    letterDate: new Date().toISOString().split('T')[0],
    salutation: 'Ms.',
    candidateName: '',
    position: '',
    department: '',
    dateOfJoining: '',
    dateOfRelieving: '',
    reasonForResignation: '',
    responsibilities: '',
  });

  const [itJoiningLetterForm, setItJoiningLetterForm] = useState({
    letterDate: new Date().toISOString().split('T')[0],
    candidateName: '',
    position: '',
    joiningDate: '',
    salary: '',
    workingHours: '10:00 AM – 7:00 PM',
    probationPeriod: '1 Month',
    lateThreshold: '10:15 AM',
    halfDayStart: '10:30 AM',
    halfDayEnd: '12:00 PM',
    fullDayAfter: '12:00 PM',
  });

  const [exitLetterForm, setExitLetterForm] = useState({
    letterDate: new Date().toISOString().split('T')[0],
    salutation: 'Ms.',
    candidateName: '',
    position: '',
    dateOfJoining: '',
    dateOfRelieving: '',
  });

  const hasAccess = hasPermission?.('letters', 'read');
  const isAdmin = user?.role?.name === 'Admin';
  const canCreate = hasPermission?.('letters', 'create');
  const canDelete = hasPermission?.('letters', 'delete');
  const canUpdate = hasPermission?.('letters', 'update') || isAdmin;

  const BADGE_COLORS = [
    { bg: '#dbeafe', color: '#1e40af' },
    { bg: '#dcfce7', color: '#166534' },
    { bg: '#fef9c3', color: '#854d0e' },
    { bg: '#fce7f3', color: '#9d174d' },
    { bg: '#e0e7ff', color: '#3730a3' },
    { bg: '#ffedd5', color: '#9a3412' },
    { bg: '#f3e8ff', color: '#6b21a8' },
    { bg: '#ccfbf1', color: '#115e59' },
    { bg: '#fee2e2', color: '#991b1b' },
    { bg: '#e0f2fe', color: '#075985' },
  ];
  const nameBadgeStyle = (name) => {
    if (!name) return {};
    const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const palette = BADGE_COLORS[hash % BADGE_COLORS.length];
    return { background: palette.bg, color: palette.color };
  };

  const fetchTemplates = useCallback(async () => {
    try { const res = await api.get('/proposal-templates'); setTemplates(res.data); }
    catch (e) { console.error(e); }
  }, []);

  // Extract {{placeholder}} keys from template content or rawTemplateHtml
  const getTemplatePlaceholders = (template) => {
    if (!template) return [];
    if (Array.isArray(template.placeholders) && template.placeholders.length) return template.placeholders;
    const content = rawTemplateHtml || template.content || '';
    const keys = [...new Set([...content.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))];
    return keys.map(key => ({ key, label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), type: 'text', defaultValue: '' }));
  };

  // Build comprehensive employee → placeholder key map
  const buildEmployeeData = (emp) => {
    if (!emp) return {};
    const fullName = `${emp.firstName} ${emp.lastName}`;
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const todayShort = new Date().toLocaleDateString('en-IN');
    const joiningLong = emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
    const joiningShort = emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-IN') : '';
    const honorific = emp.gender === 'female' ? 'Ms.' : emp.gender === 'male' ? 'Mr.' : '';
    const pronoun = emp.gender === 'female' ? 'she' : emp.gender === 'male' ? 'he' : 'they';
    const possessive = emp.gender === 'female' ? 'her' : emp.gender === 'male' ? 'his' : 'their';
    return {
      // Name
      employee_name: fullName, full_name: fullName, name: fullName, candidate_name: fullName,
      first_name: emp.firstName, last_name: emp.lastName,
      salutation: honorific ? `${honorific} ${fullName}` : fullName,
      honorific,
      // Employee ID
      employee_id: emp.employeeId || '', emp_id: emp.employeeId || '',
      emp_code: emp.employeeId || '', staff_id: emp.employeeId || '',
      // Role
      designation: emp.designation || '', position: emp.designation || '',
      role: emp.role?.name || emp.designation || '', job_title: emp.designation || '',
      post: emp.designation || '', title: emp.designation || '',
      // Department
      department: emp.department || '', dept: emp.department || '',
      division: emp.department || '', team: emp.department || '',
      // Contact
      email: emp.email || '', email_id: emp.email || '', employee_email: emp.email || '',
      phone: emp.phone || '', mobile: emp.phone || '', contact: emp.phone || '',
      phone_number: emp.phone || '', mobile_number: emp.phone || '',
      // Dates
      joining_date: joiningLong, date_of_joining: joiningLong,
      doj: joiningShort, start_date: joiningLong, commencement_date: joiningLong,
      date: today, today: today, current_date: today,
      issue_date: today, letter_date: today, effective_date: today,
      date_short: todayShort,
      // Gender / pronouns
      gender: emp.gender || '', pronoun, possessive,
      // Banking
      bank_name: emp.bankName || '', bank: emp.bankName || '',
      account_number: emp.accountNumber || '', account_no: emp.accountNumber || '',
      acc_no: emp.accountNumber || '', account: emp.accountNumber || '',
      ifsc: emp.ifscCode || '', ifsc_code: emp.ifscCode || '',
      account_holder: emp.accountHolderName || fullName,
      pan: emp.panNumber || '', pan_number: emp.panNumber || '', pan_no: emp.panNumber || '',
      upi_id: emp.upiId || '',
    };
  };

  // Client-side live preview: replace {{keys}} in rawTemplateHtml
  const renderLetterPreview = useCallback((data) => {
    const base = rawTemplateHtml;
    if (!base) return '<div style="color:#9ca3af;text-align:center;padding:40px;font-size:13px">Loading preview…</div>';
    let html = base;
    Object.entries(data).forEach(([key, val]) => {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val || '');
    });
    // Highlight remaining unfilled placeholders in yellow
    html = html.replace(/\{\{(\w+)\}\}/g, '<mark style="background:#fef9c3;color:#92400e;padding:0 2px;border-radius:3px">{{$1}}</mark>');
    return html;
  }, [rawTemplateHtml]);

  const fetchEmployees = useCallback(async () => {
    try { const res = await api.get('/employees'); setEmployees(res.data); }
    catch (e) { console.error(e); }
  }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try { const res = await api.get('/document-generator'); setDocuments(res.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const handleSaveEdit = async () => {
    if (!editingDocId) return;
    setSavingEdit(true);
    try {
      await api.put(`/document-generator/${editingDocId}`, { finalHtml: editingHtml });
      alert('Document updated successfully!');
      fetchDocuments();
      setIsEditingDoc(false);
    } catch (e) {
      alert('Error updating document: ' + (e.response?.data?.message || e.message));
    } finally {
      setSavingEdit(false);
    }
  };

  const saveGeneratedDocument = async (payload) => {
    if (editingDocId) {
      await api.put(`/document-generator/${editingDocId}`, payload);
      setEditingDocId(null);
    } else {
      await api.post('/document-generator/generate', payload);
    }
  };

  useEffect(() => {
    if (hasAccess) { fetchTemplates(); fetchEmployees(); fetchDocuments(); }
    else { setLoading(false); }
  }, [fetchTemplates, fetchEmployees, fetchDocuments, hasAccess]);

  // Pre-select employee from ?employeeId= or ?id= query param
  useEffect(() => {
    const empId = employeeId || id;
    if (empId && employees.length > 0) {
      const emp = employees.find(e => e._id === empId);
      if (emp) {
        setSelectedEmployee(emp);
        setEmployeeSearch(`${emp.firstName} ${emp.lastName}`);
        setShowModal(true);
        setModalStep('setup');
      }
    }
  }, [employeeId, id, employees]);

  // Close kebab on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = () => setOpenMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  // Close generate-letter dropdown on outside click
  useEffect(() => {
    if (!genDropdownOpen) return;
    const handler = (e) => {
      if (genBtnRef.current && !genBtnRef.current.contains(e.target)) setGenDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [genDropdownOpen]);

  // Auto-fill placeholders when template + employee selected (or raw HTML loaded)
  useEffect(() => {
    if (!selectedTemplate) return;
    // Start with all employee data pre-mapped
    const empData = buildEmployeeData(selectedEmployee);
    // Add empty slots for any template placeholders not covered by employee data
    getTemplatePlaceholders(selectedTemplate).forEach(p => {
      if (!Object.prototype.hasOwnProperty.call(empData, p.key)) {
        empData[p.key] = p.defaultValue || '';
      }
    });
    setFormData(empData);
  }, [selectedTemplate, selectedEmployee, rawTemplateHtml]);

  // Live preview HTML computed from current formData (no backend call)
  const letterLivePreview = useMemo(
    () => renderLetterPreview(formData),
    [renderLetterPreview, formData]
  );

  // Placeholders that are NOT already auto-filled from employee data
  const customPlaceholders = useMemo(() => {
    if (!selectedTemplate) return [];
    // Get the set of all keys that buildEmployeeData can produce
    const dummyEmp = { firstName: '', lastName: '', joiningDate: null, gender: '' };
    const empKeys = new Set(Object.keys(buildEmployeeData(dummyEmp)));
    return getTemplatePlaceholders(selectedTemplate).filter(p => !empKeys.has(p.key));
  }, [selectedTemplate, rawTemplateHtml]); // rawTemplateHtml included so list updates after fetch

  const openModal = () => {
    setSelectedTemplate(null);
    setFormData({});
    setModalStep('setup');
    setShowModal(true);
  };

  const handleOpenJoiningLetter = () => {
    setJoiningLetterForm({
      letterDate: new Date().toISOString().split('T')[0],
      candidateName: '',
      position: '',
      department: 'Sales',
      joiningDate: '',
      salary: '',
      workingHours: '10:00 AM – 7:00 PM',
      probationPeriod: '1 Month',
      lateThreshold: '10:15 AM',
      halfDayStart: '10:30 AM',
      halfDayEnd: '12:00 PM',
      fullDayAfter: '12:00 PM',
    });
    setShowJoiningLetterModal(true);
  };

  const handleLetterSelection = (letterType, department) => {
    setGenDropdownOpen(false);
    if (letterType === 'Joining' && department === 'Sales') {
      handleOpenJoiningLetter();
    } else if (letterType === 'Joining' && department === 'IT') {
      setItJoiningLetterForm({
        letterDate: new Date().toISOString().split('T')[0],
        candidateName: '',
        position: '',
        joiningDate: '',
        salary: '',
        workingHours: '10:00 AM – 7:00 PM',
        probationPeriod: '1 Month',
        lateThreshold: '10:15 AM',
        halfDayStart: '10:30 AM',
        halfDayEnd: '12:00 PM',
        fullDayAfter: '12:00 PM',
      });
      setShowITJoiningLetterModal(true);
    } else if (letterType === 'Offer' && department === 'IT') {
      setItOfferLetterForm({
        letterDate: new Date().toISOString().split('T')[0],
        candidateName: '',
        position: '',
        joiningDate: '',
        salary: '',
        duration: '',
        observationPeriod: '3 Days Unpaid',
        workingDays: 'Monday to Saturday',
        officeHours: '10:00 AM to 7:00 PM',
        reportingTime: '09:45 AM',
      });
      setShowITOfferLetterModal(true);
    } else if (letterType === 'Offer' && department === 'Sales') {
      setSalesOfferLetterForm({
        letterDate: new Date().toISOString().split('T')[0],
        candidateName: '',
        position: '',
        joiningDate: '',
        salary: '',
        stipend: '',
        trainingPeriod: '15 Days',
        salesTarget: '91,000',
        workingDays: 'Monday to Saturday',
        officeHours: '10:00 AM to 7:00 PM',
        reportingTime: '09:45 AM',
      });
      setShowSalesOfferLetterModal(true);
    } else if (letterType === 'NDA') {
        setEditingDocId(null);
        setNdaEmpSearch('');
        setNdaForm({
          salutation: 'Mr.',
          employeeName: '',
          fathersName: '',
          fullAddress: '',
          designation: '',
          joiningDate: new Date().toISOString().split('T')[0],
        });
        setShowNDAModal(true);
      } else if (letterType === 'Experience') {
      setExperienceLetterForm({
        letterDate: new Date().toISOString().split('T')[0],
        salutation: 'Ms.',
        candidateName: '',
        position: '',
        department: '',
        dateOfJoining: '',
        dateOfRelieving: '',
        reasonForResignation: '',
        responsibilities: '',
      });
      setShowExperienceLetterModal(true);
    } else if (letterType === 'Exit') {
      setExitLetterForm({
        letterDate: new Date().toISOString().split('T')[0],
        salutation: 'Ms.',
        candidateName: '',
        position: '',
        dateOfJoining: '',
        dateOfRelieving: '',
      });
      setShowExitLetterModal(true);
    } else {
      // For other combinations, open generic modal (future templates)
      openModal();
    }
  };

  const handleGenerateJoiningLetter = async (form) => {
    setGenerating(true);
    try {
      const hrName = 'Nicki Verma';

      const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '___________';
      const letterDateFmt = fmt(form.letterDate);
      const joiningDateFmt = fmt(form.joiningDate);
      const salaryDisplay = form.salary ? `Rs. ${parseFloat(form.salary).toLocaleString('en-IN')}/-` : '___________';

      const [logoSrc, signSrc] = await Promise.all([
        imgToBase64('/sj_logo.png'),
        imgToBase64('/sj_extra.png'),
      ]);

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Joining Letter – ${form.candidateName || 'Candidate'}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#393939;background:#fff;}
  .page{width:100%;max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;display:flex;flex-direction:column;}

  .top-bar{height:6px;background:#2C7946;width:100%;flex-shrink:0;}
  .content{padding:0 30px 10px 30px;flex:1;}

  /* Letterhead */
  .lh-header{display:flex;align-items:flex-start;justify-content:space-between;padding:6px 0 4px;min-height:58px;}
  .lh-logo-wrap{flex:0 0 auto;}
  .lh-logo{height:50px;max-width:170px;object-fit:contain;display:block;}
  .lh-company-wrap{flex:1;text-align:right;padding-left:10px;}
  .lh-company-name{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin-bottom:1px;}
  .lh-info{font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;line-height:1.35;}
  .lh-divider{width:100%;height:2px;background:#2C7946;margin:2px 0 8px 0;}

  /* Title */
  .letter-title{font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;text-align:center;
    text-decoration:underline;margin:14px 0 12px;color:#000;}

  /* Address */
  .to-line{font-family:Arial,sans-serif;font-size:9.5pt;margin-bottom:2px;color:#393939;}
  .dear-line{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;margin-bottom:8px;}

  /* Body paragraph */
  .body-para{font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;margin-bottom:10px;text-align:justify;color:#393939;}

  /* Numbered section headings */
  .sec-heading{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#1F6B39;
    text-decoration:underline;margin:14px 0 5px;}

  /* Joining details — borderless two-column table */
  .dt-table{width:100%;border-collapse:collapse;margin-bottom:10px;}
  .dt-table td{font-size:9.5pt;padding:2px 0;vertical-align:top;color:#393939;}
  .dt-ltr{width:24px;font-weight:normal;}
  .dt-lbl{width:210px;font-weight:bold;padding-right:8px;}
  .dt-val{color:#393939;}

  /* Policy lettered items */
  .policy-item{display:flex;font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;
    margin-bottom:5px;text-align:justify;color:#393939;}
  .item-ltr{min-width:24px;font-weight:normal;flex-shrink:0;}
  .item-body{flex:1;}

  /* Sub-bullets inside policy items */
  .sub-item{font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;
    margin-bottom:3px;padding-left:48px;text-align:justify;color:#393939;}

  /* Signature block */
  .sig-section{margin-top:28px;display:flex;justify-content:space-between;}
  .sig-left{width:48%;}
  .sig-right{width:48%;text-align:left;}
  .sig-logo{height:42px;max-width:130px;object-fit:contain;display:block;margin-bottom:2px;}
  .sig-img{height:50px;object-fit:contain;display:block;margin:4px 0 2px;}
  .sig-name{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#000;}
  .sig-dept{font-family:Arial,sans-serif;font-size:9pt;color:#393939;}
  .sig-company{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin-bottom:1px;}
  .accept-heading{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#393939;margin-bottom:5px;}
  .accept-name{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#393939;}

  /* Note */
  .note-section{margin-top:20px;border-top:0.5px solid #BDDFC6;padding-top:8px;}
  .note-text{font-family:Arial,sans-serif;font-size:8pt;font-style:italic;color:#858585;line-height:1.5;}
  .note-text b{font-weight:bold;}

  /* Footer */
  .footer-wrap{margin-top:auto;}
  .footer-divider{height:0.5px;background:#2C7946;margin-bottom:4px;}
  .footer-cols{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;padding-bottom:5px;}
  .footer-cols a{color:#000;text-decoration:none;}
  .bottom-bar{height:6px;background:#2C7946;width:100%;}
</style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>

  <div class="content">
    <!-- Letterhead -->
    <div class="lh-header">
      <div class="lh-logo-wrap">
        <img class="lh-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
      </div>
      <div class="lh-company-wrap">
        <div class="lh-company-name">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="lh-info">Registered Office: A-43, Sector 63, Noida (201301), Uttar Pradesh</div>
        <div class="lh-info">GSTIN: 09AAMCB0572D1ZS | CIN: US5499UP2023PTC191784</div>
      </div>
    </div>
    <div class="lh-divider"></div>

    <!-- Title -->
    <div class="letter-title">JOINING LETTER</div>

    <!-- Address -->
    <p class="to-line">To,</p>
    <p class="dear-line">Dear ${form.candidateName || '___________'},</p>

    <!-- Opening paragraph -->
    <p class="body-para" style="margin-top:6px;">
      We are pleased to welcome you to <b>Bhoomi Techzone Pvt. Ltd.</b> as a <b>${form.position || '___________'}</b>.
      After reviewing your qualifications and potential, we are confident that your skills align well
      with our organizational objectives and values.
    </p>

    <!-- 1. JOINING DETAILS -->
    <div class="sec-heading">1.&nbsp;&nbsp; JOINING DETAILS</div>
    <table class="dt-table">
      <tr><td class="dt-ltr">a)</td><td class="dt-lbl">Employment Type:</td><td class="dt-val">Full-time</td></tr>
      <tr><td class="dt-ltr">b)</td><td class="dt-lbl">Position:</td><td class="dt-val">${form.position || '___________'}</td></tr>
      <tr><td class="dt-ltr">c)</td><td class="dt-lbl">Date of Joining:</td><td class="dt-val">${joiningDateFmt}</td></tr>
      <tr><td class="dt-ltr">d)</td><td class="dt-lbl">Monthly Salary (CTC):</td><td class="dt-val">${salaryDisplay}</td></tr>
      <tr><td class="dt-ltr">e)</td><td class="dt-lbl">Working Hours:</td><td class="dt-val">${form.workingHours || '10:00 AM – 7:00 PM'} (as per company rules)</td></tr>
      <tr><td class="dt-ltr">f)</td><td class="dt-lbl">Probation Period:</td><td class="dt-val">${form.probationPeriod || '1 Month'}</td></tr>
    </table>

    <!-- 2. NOTICE PERIOD -->
    <div class="sec-heading">2.&nbsp;&nbsp; NOTICE PERIOD, FINAL SETTLEMENT &amp; TERMINATION</div>
    <div class="policy-item"><span class="item-ltr">a)</span><span class="item-body">During probation, if you leave the company before completing <b>15 days</b>, no salary will be payable as per company policy.</span></div>
    <div class="policy-item"><span class="item-ltr">b)</span><span class="item-body">Upon successful completion of probation, your employment status will be reviewed for confirmation as a regular employee.</span></div>
    <div class="policy-item"><span class="item-ltr">c)</span><span class="item-body">As a regular employee, you will be required to serve a minimum notice period of <b>one (1) month</b> prior to resignation.</span></div>
    <div class="policy-item"><span class="item-ltr">d)</span><span class="item-body">If you fail to serve the full notice period, you shall forfeit the salary for the days worked during that month, and no partial settlement will be made.</span></div>
    <div class="policy-item"><span class="item-ltr">e)</span><span class="item-body">If you duly serve the notice period after resignation, the salary for the notice period shall be processed and disbursed within <b>45 days</b> from your last working day, subject to clearance of all handover formalities.</span></div>
    <div class="policy-item"><span class="item-ltr">f)</span><span class="item-body">In case of termination due to poor performance, misconduct, or unethical practices, the Company shall not be liable to pay any salary or dues beyond the last cleared payment.</span></div>

    <!-- 3. PERFORMANCE & CONDUCT -->
    <div class="sec-heading">3.&nbsp;&nbsp; PERFORMANCE &amp; CONDUCT</div>
    <div class="policy-item"><span class="item-ltr">a)</span><span class="item-body">This position requires consistent, result-oriented performance. Instances of zero business, repeated underperformance, or misconduct may result in salary deductions, warnings, or termination of employment.</span></div>
    <div class="policy-item"><span class="item-ltr">b)</span><span class="item-body"><b>Performance Policy:</b></span></div>
    <p class="sub-item">– Monthly Sales Target = Salary × 7</p>
    <p class="sub-item">– If <b>70% of the target</b> is achieved, full salary will be disbursed.</p>
    <p class="sub-item">– If the target achieved is less than 70%, salary will be subject to proportional deduction based on actual performance.</p>
    <p class="sub-item">– Misconduct, breach of confidentiality, or violation of company policies may lead to <b>immediate termination</b> without payment.</p>

    <!-- 4. EMPLOYMENT POLICY -->
    <div class="sec-heading">4.&nbsp;&nbsp; EMPLOYMENT POLICY</div>
    <div class="policy-item"><span class="item-ltr">a)</span><span class="item-body">You are strictly prohibited from engaging in any external employment, freelance, or business activity during your tenure. Violation of this policy will lead to immediate termination without notice and forfeiture of any pending salary or incentives.</span></div>

    <!-- 5. LATE ARRIVAL & LEAVE POLICY -->
    <div class="sec-heading" style="page-break-before:always;break-before:page;margin-top:60px;">5.&nbsp;&nbsp; LATE ARRIVAL &amp; LEAVE POLICY</div>
    <div class="policy-item"><span class="item-ltr">a)</span><span class="item-body">Working Hours: ${form.workingHours || '10:00 AM – 7:00 PM'} (9 hours per day).</span></div>
    <div class="policy-item"><span class="item-ltr">b)</span><span class="item-body">Late Arrival:</span></div>
    <p class="sub-item">– After ${form.lateThreshold || '10:15 AM'} – considered late.</p>
    <p class="sub-item">– Between ${form.halfDayStart || '10:30 AM'} – ${form.halfDayEnd || '12:00 PM'} – Half-day deduction.</p>
    <p class="sub-item">– After ${form.fullDayAfter || '12:00 PM'} – Full-day deduction.</p>
    <div class="policy-item"><span class="item-ltr">c)</span><span class="item-body">Uninformed Leave: Treated as 3 days leave without pay. Exceptions will be considered only for valid reasons (e.g., medical emergencies) with prior intimation to HR / Reporting Manager.</span></div>

    <!-- Closing -->
    <p class="body-para" style="margin-top:14px;">
      We are excited about the prospect of you joining our team and contributing to the success of
      <b>Bhoomi Techzone Pvt. Ltd.</b> We look forward to your dedication and commitment.
    </p>

    <!-- Best regards -->
    <p class="body-para" style="margin-top:6px;">Best regards,</p>

    <!-- Signature Section -->
    <div class="sig-section">
      <div class="sig-left">
        <img class="sig-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
        <img class="sig-img" src="${signSrc}" alt="Signature" onerror="this.style.display='none'" />
        <div class="sig-name">${hrName}</div>
        <div class="sig-dept">HR Department</div>
        <div class="sig-company">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="sig-dept">Contact No: 9821724181</div>
      </div>
      <div class="sig-right">
        <div class="accept-heading">Acceptance by Employee</div>
        <div class="accept-name">Name: ${form.candidateName || '___________'}</div>
        <div style="margin-top:30px;">Signature: _______________________</div>
        <div style="margin-top:14px;">Date: ___________________________</div>
      </div>
    </div>

    <!-- Note -->
    <div class="note-section">
      <p class="note-text">
        <b>Note:</b> This joining letter is valid only when signed and stamped by an authorised representative of
        Bhoomi Techzone Private Limited, and countersigned by the employee. A letter without the official company
        stamp and authorised signature shall not be considered a legally binding employment offer.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer-wrap">
    <div style="padding:0 30px;">
      <div class="footer-divider"></div>
      <div class="footer-cols">
        <span>A-43, Noida, Sector 63, NOIDA, Uttar Pradesh – 201301</span>
        <span>
          <a href="mailto:hr@bhoomitechzone.in">hr@bhoomitechzone.in</a>
          &nbsp;|&nbsp;
          <a href="http://www.bhoomitechzone.in">www.bhoomitechzone.in</a>
        </span>
      </div>
    </div>
    <div class="bottom-bar"></div>
  </div>

</div>
</body>
</html>`;

      await api.post('/document-generator/generate', {
        content: html,
        title: `Sales Joining Letter - ${form.candidateName || 'Candidate'}`,
        metadata: {
          clientName: form.candidateName,
          position: form.position,
          department: form.department || 'Sales',
          templateName: 'Sales Joining Letter',
          joiningDate: form.joiningDate,
          salary: form.salary,
        },
      });

      alert('Sales Joining Letter generated successfully!');
      fetchDocuments();
      setShowJoiningLetterModal(false);
    } catch (e) {
      alert('Error generating letter: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  /*
  const _unusedDocxNDA = async (e) => {
    if (e) e.preventDefault();
    setGenerating(true);
    try {
      const PizZip = (await import('pizzip')).default || (await import('pizzip'));
      const { saveAs } = (await import('file-saver'));

      const response = await fetch('/NDA_Formate.docx');
      if (!response.ok) throw new Error('Template not found in public folder.');
      
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const zip = new PizZip(arrayBuffer);
      let docXml = zip.file("word/document.xml").asText();

      // Replace placeholders
      docXml = docXml.replace(/\(SAL\)/g, ndaForm.salutation);
      docXml = docXml.replace(/\(Employee Name\)/g, ndaForm.employeeName);
      docXml = docXml.replace(/\(Father’s Name\)/g, ndaForm.fathersName);
      docXml = docXml.replace(/\(Full Address\)/g, ndaForm.fullAddress);
      docXml = docXml.replace(/\(Designation\)/g, ndaForm.designation);
      docXml = docXml.replace(/\(Mobile No\.\)/g, ndaForm.mobileNo);
      docXml = docXml.replace(/\(Mail id\)/g, ndaForm.emailId);
      
      const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '___________';
      const joiningDateFmt = fmt(ndaForm.joiningDate);
      docXml = docXml.replace(/\(Joining date\)/g, joiningDateFmt);
      docXml = docXml.replace(/\(DOJ\)/g, joiningDateFmt);

      zip.file("word/document.xml", docXml);
      const generatedBlob = zip.generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      saveAs(generatedBlob, `NDA_${ndaForm.employeeName}.docx`);
      alert('NDA generated successfully!');
      setShowNDAModal(false);
    } catch (e) {
      alert('Error generating NDA: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };
  */

  const handleGenerateITOfferLetter = async (form) => {
    setGenerating(true);
    try {
      const hrName = 'Nicki Verma';

      const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '___________';
      const joiningDateFmt = fmt(form.joiningDate);
      const salaryDisplay = form.salary ? `Rs. ${parseFloat(form.salary).toLocaleString('en-IN')}/-` : '___________';

      const [logoSrc, signSrc] = await Promise.all([
        imgToBase64('/it_offer_logo.png'),
        imgToBase64('/it_offer_sign.png'),
      ]);

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Offer Letter \u2013 ${form.candidateName || 'Candidate'}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#000;background:#fff;}
  .page{width:100%;max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;display:flex;flex-direction:column;}

  /* Top green bar \u2013 full page width, no padding */
  .top-bar{height:6px;background:#2C7946;width:100%;flex-shrink:0;}

  /* Content area with DOCX margins */
  .content{padding:0 30px 10px 30px;flex:1;}

  /* Letterhead: logo left, company info block right-aligned */
  .lh-header{display:flex;align-items:flex-start;justify-content:space-between;padding:6px 0 4px;min-height:58px;}
  .lh-logo-wrap{flex:0 0 auto;}
  .lh-logo{height:50px;max-width:170px;object-fit:contain;display:block;}
  .lh-company-wrap{flex:1;text-align:right;padding-left:10px;}
  .lh-company-name{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin-bottom:1px;}
  .lh-info{font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;line-height:1.35;}
  .lh-info a{color:#000;text-decoration:none;}

  /* Green horizontal separator under letterhead */
  .lh-divider{width:100%;height:2px;background:#2C7946;margin:2px 0 8px 0;}

  /* OFFER LETTER title \u2013 Arial Bold 14pt, centered */
  .offer-title{font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;text-align:center;margin:14px 0 5px;color:#000;}
  .title-divider{width:100%;height:0.5px;background:#2C7946;margin-bottom:12px;}

  /* Body paragraphs */
  .dear-line{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;margin-bottom:5px;}
  .body-para{font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;margin-bottom:10px;text-align:justify;}

  /* Section headings \u2013 Heading1 style: Arial Bold 10.5pt, green #2C7946, green underline */
  .sec-heading{font-family:Arial,sans-serif;font-size:10.5pt;font-weight:bold;color:#2C7946;
    border-bottom:1px solid #2C7946;padding-bottom:2px;margin:16px 0 6px;}

  /* Detail rows with tab-like label/value layout */
  .od-row{display:flex;font-family:Arial,sans-serif;font-size:9.5pt;margin-bottom:5px;line-height:1.5;}
  .od-lbl{font-weight:bold;min-width:190px;flex-shrink:0;}
  .od-val{color:#000;}

  /* Terms items */
  .tc-item{font-family:Arial,sans-serif;font-size:9.5pt;margin-bottom:8px;line-height:1.65;}
  .tc-lbl{font-weight:bold;}

  /* Signature block */
  .sig-block{margin-top:20px;}
  .sig-for{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;margin-bottom:4px;}
  .sig-img{height:50px;object-fit:contain;display:block;margin:6px 0;}
  .sig-company{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin:4px 0 3px;}
  .sig-line{font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;margin:2px 0;}

  /* Footer \u2013 two columns (address left | links right) + bottom green bar */
  .footer-wrap{margin-top:auto;}
  .footer-divider{height:0.5px;background:#2C7946;margin-bottom:4px;}
  .footer-cols{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;padding-bottom:5px;}
  .footer-cols a{color:#000;text-decoration:none;}
  .bottom-bar{height:6px;background:#2C7946;width:100%;}
</style>
</head>
<body>
<div class="page">
  <!-- Top green bar -->
  <div class="top-bar"></div>

  <div class="content">
    <!-- Letterhead: logo left, company info right -->
    <div class="lh-header">
      <div class="lh-logo-wrap">
        <img class="lh-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
      </div>
      <div class="lh-company-wrap">
        <div class="lh-company-name">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="lh-info">www.bhoomitechzone.in | hr@bhoomitechzone.in</div>
        <div class="lh-info">GSTIN: 09AAMCB0572D1ZS | CIN: US5499UP2023PTC191784</div>
        <div class="lh-info">Registered Office: A-43, Sector 63, Noida (201301), Uttar Pradesh</div>
      </div>
    </div>
    <!-- Green separator line -->
    <div class="lh-divider"></div>

    <!-- OFFER LETTER title: Arial Bold 14pt, centered, no color background -->
    <div class="offer-title">OFFER LETTER</div>
    <div class="title-divider"></div>

    <!-- Dear -->
    <p class="dear-line">Dear ${form.candidateName || '___________'},</p>
    <br/>

    <!-- Opening paragraph -->
    <p class="body-para">
      We are pleased to confirm your appointment as <b>${form.position || '___________'}</b> at
      <b>Bhoomi TechZone Pvt. Ltd.</b>, with your joining date being <b>${joiningDateFmt}</b>.
      We welcome you to our team and look forward to your valuable contribution.
    </p>

    <!-- Offer Details -->
    <div class="sec-heading">Offer Details:</div>
    <div class="od-row"><span class="od-lbl">Position:</span><span class="od-val">${form.position || '___________'}</span></div>
    <div class="od-row"><span class="od-lbl">Date of Joining:</span><span class="od-val">${joiningDateFmt}</span></div>
    <div class="od-row"><span class="od-lbl">Observation Period:</span><span class="od-val">${form.observationPeriod || '3 Days Unpaid'}</span></div>
    <div class="od-row"><span class="od-lbl">Monthly Stipend:</span><span class="od-val">${salaryDisplay} per month (as per company payroll policy)</span></div>
    ${form.duration ? `<div class="od-row"><span class="od-lbl">Internship Duration:</span><span class="od-val">${form.duration} months</span></div>` : ''}

    <!-- Work Schedule -->
    <div class="sec-heading">Work Schedule:</div>
    <div class="od-row"><span class="od-lbl">Working Days:</span><span class="od-val">${form.workingDays || 'Monday to Saturday'}</span></div>
    <div class="od-row"><span class="od-lbl">Office Hours:</span><span class="od-val">${form.officeHours || '10:00 AM to 7:00 PM'}</span></div>
    <div class="od-row"><span class="od-lbl">Reporting Time:</span><span class="od-val">${form.reportingTime || '09:45 AM'}</span></div>

    <!-- Terms & Conditions -->
    <div class="sec-heading">Terms &amp; Conditions:</div>
    <p class="tc-item"><span class="tc-lbl">Salary Disbursement: </span>Between 10th to 15th of each month.</p>
    <p class="tc-item"><span class="tc-lbl">Observation Period: </span>First 3 days shall be treated as observation.</p>
    <p class="tc-item"><span class="tc-lbl">Probation Period: </span>1 month. Performance will be evaluated for confirmation. During probation, if you leave the company before completing 15 days, no salary will be payable as per company policy.</p>
    <p class="tc-item"><span class="tc-lbl">Performance Expectation: </span>Regular and result-oriented work is mandatory. \u201cZero business\u201d may result in deduction or disciplinary action.</p>
    <p class="tc-item"><span class="tc-lbl">Notice Period: </span>30 days required for resignation.</p>
    <p class="tc-item"><span class="tc-lbl">Final Settlement: </span>Salary and dues settled within 45 days of last working day.</p>
    <p class="tc-item"><span class="tc-lbl">Conduct: </span>Breach of company policy, misconduct, or poor performance may result in immediate termination.</p>
    <p class="tc-item"><span class="tc-lbl">Conflict of Interest: </span>External employment or freelance work is strictly prohibited.</p>

    <!-- Closing -->
    <p class="body-para" style="margin-top:14px;">
      We are excited about the prospect of you joining our team and contributing to the success of
      <b>Bhoomi Techzone Pvt. Ltd.</b> We look forward to your dedication and commitment.
    </p>

    <!-- Signature -->
    <div class="sig-block">
      <p class="sig-for">For Bhoomi Techzone Private Limited</p>
      <img class="sig-img" src="${signSrc}" alt="Signature" onerror="this.style.display='none'" />
      <div class="sig-company">BHOOMI TECHZONE PRIVATE LIMITED</div>
      <div class="sig-line">Nicki Verma</div>
      <div class="sig-line">HR Department</div>
      <div class="sig-line">Contact No: +91 9211947852</div>
      <div class="sig-line">Website: www.bhoomitechzone.in</div>
    </div>
  </div>

  <!-- Footer: thin green line + two columns + bottom green bar -->
  <div class="footer-wrap">
    <div style="padding:0 43px 0 57px;">
      <div class="footer-divider"></div>
      <div class="footer-cols">
        <span>A-43, Noida, Sector 63, NOIDA, Uttar Pradesh \u2013 201301</span>
        <span>
          <a href="mailto:hr@bhoomitechzone.in">hr@bhoomitechzone.in</a>
          &nbsp;|&nbsp;
          <a href="http://www.bhoomitechzone.in">www.bhoomitechzone.in</a>
        </span>
      </div>
    </div>
    <div class="bottom-bar"></div>
  </div>

</div>
</body>
</html>`;

      await api.post('/document-generator/generate', {
        content: html,
        title: `IT Offer Letter - ${form.candidateName || 'Candidate'}`,
        metadata: {
          clientName: form.candidateName,
          position: form.position,
          department: 'IT',
          templateName: 'IT Offer Letter',
          joiningDate: form.joiningDate,
          salary: form.salary,
        },
      });

      alert('IT Offer Letter generated successfully!');
      fetchDocuments();
      setShowITOfferLetterModal(false);
    } catch (e) {
      alert('Error generating letter: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateSalesOfferLetter = async (form) => {
    setGenerating(true);
    try {
      const hrName = 'Nicki Verma';

      const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '___________';
      const joiningDateFmt = fmt(form.joiningDate);
      const salaryDisplay = form.salary ? `Rs. ${parseFloat(form.salary).toLocaleString('en-IN')}/-` : '___________';
      const stipendDisplay = form.stipend ? `Rs. ${parseFloat(form.stipend).toLocaleString('en-IN')}/-` : '___________';

      const [logoSrc, signSrc] = await Promise.all([
        imgToBase64('/it_offer_logo.png'),
        imgToBase64('/it_offer_sign.png'),
      ]);

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Offer Letter – ${form.candidateName || 'Candidate'}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#000;background:#fff;}
  .page{width:100%;max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;display:flex;flex-direction:column;}

  /* Top green bar */
  .top-bar{height:6px;background:#2C7946;width:100%;flex-shrink:0;}

  /* Content area */
  .content{padding:0 30px 10px 30px;flex:1;}

  /* Letterhead: logo left, company info right-aligned */
  .lh-header{display:flex;align-items:flex-start;justify-content:space-between;padding:6px 0 4px;min-height:58px;}
  .lh-logo-wrap{flex:0 0 auto;}
  .lh-logo{height:50px;max-width:170px;object-fit:contain;display:block;}
  .lh-company-wrap{flex:1;text-align:right;padding-left:10px;}
  .lh-company-name{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin-bottom:1px;}
  .lh-info{font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;line-height:1.35;}
  .lh-info a{color:#000;text-decoration:none;}

  /* Green horizontal separator */
  .lh-divider{width:100%;height:2px;background:#2C7946;margin:2px 0 8px 0;}

  /* OFFER LETTER title */
  .offer-title{font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;text-align:center;margin:14px 0 5px;color:#000;}
  .title-divider{width:100%;height:0.5px;background:#2C7946;margin-bottom:12px;}

  /* Body paragraphs */
  .dear-line{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;margin-bottom:5px;}
  .body-para{font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;margin-bottom:10px;text-align:justify;}

  /* Section headings */
  .sec-heading{font-family:Arial,sans-serif;font-size:10.5pt;font-weight:bold;color:#2C7946;
    border-bottom:1px solid #2C7946;padding-bottom:2px;margin:16px 0 6px;}

  /* Detail rows */
  .od-row{display:flex;font-family:Arial,sans-serif;font-size:9.5pt;margin-bottom:5px;line-height:1.5;}
  .od-lbl{font-weight:bold;min-width:220px;flex-shrink:0;}
  .od-val{color:#000;}

  /* Terms items */
  .tc-item{font-family:Arial,sans-serif;font-size:9.5pt;margin-bottom:8px;line-height:1.65;}
  .tc-lbl{font-weight:bold;}

  /* Signature block */
  .sig-block{margin-top:20px;}
  .sig-for{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;margin-bottom:4px;}
  .sig-img{height:50px;object-fit:contain;display:block;margin:6px 0;}
  .sig-company{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin:4px 0 3px;}
  .sig-line{font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;margin:2px 0;}

  /* Footer */
  .footer-wrap{margin-top:auto;}
  .footer-divider{height:0.5px;background:#2C7946;margin-bottom:4px;}
  .footer-cols{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;padding-bottom:5px;}
  .footer-cols a{color:#000;text-decoration:none;}
  .bottom-bar{height:6px;background:#2C7946;width:100%;}
</style>
</head>
<body>
<div class="page">
  <!-- Top green bar -->
  <div class="top-bar"></div>

  <div class="content">
    <!-- Letterhead -->
    <div class="lh-header">
      <div class="lh-logo-wrap">
        <img class="lh-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
      </div>
      <div class="lh-company-wrap">
        <div class="lh-company-name">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="lh-info">Registered Office: A-43, Sector 63, Noida (201301), Uttar Pradesh</div>
        <div class="lh-info">GSTIN: 09AAMCB0572D1ZS | CIN: US5499UP2023PTC191784</div>
      </div>
    </div>
    <div class="lh-divider"></div>

    <!-- OFFER LETTER title -->
    <div class="offer-title">OFFER LETTER</div>
    <div class="title-divider"></div>

    <!-- Dear -->
    <p class="dear-line">Dear ${form.candidateName || '___________'},</p>
    <br/>

    <!-- Opening paragraph -->
    <p class="body-para">
      We are pleased to confirm your appointment as <b>${form.position || '___________'}</b> at
      <b>Bhoomi TechZone Pvt. Ltd.</b>, with your joining date being <b>${joiningDateFmt}</b>.
      We welcome you to our team and look forward to your valuable contribution.
    </p>

    <!-- Offer Details -->
    <div class="sec-heading">Offer Details</div>
    <div class="od-row"><span class="od-lbl">Position:</span><span class="od-val">${form.position || '___________'}</span></div>
    <div class="od-row"><span class="od-lbl">Date of Joining:</span><span class="od-val">${joiningDateFmt}</span></div>
    <div class="od-row"><span class="od-lbl">Initial Training Period:</span><span class="od-val">${form.trainingPeriod || '15 Days'} | Stipend: ${stipendDisplay} for the training period</span></div>
    <div class="od-row"><span class="od-lbl">Monthly Salary (Post-Training):</span><span class="od-val">${salaryDisplay} per month (as per company payroll policy)</span></div>
    <div class="od-row"><span class="od-lbl">Monthly Sales Target:</span><span class="od-val">${form.salesTarget || '91,000'} Rs. per month</span></div>

    <!-- Work Schedule -->
    <div class="sec-heading">Work Schedule</div>
    <div class="od-row"><span class="od-lbl">Working Days:</span><span class="od-val">${form.workingDays || 'Monday to Saturday'}</span></div>
    <div class="od-row"><span class="od-lbl">Office Hours:</span><span class="od-val">${form.officeHours || '10:00 AM to 7:00 PM'}</span></div>
    <div class="od-row"><span class="od-lbl">Reporting Time:</span><span class="od-val">${form.reportingTime || '09:45 AM'}</span></div>

    <!-- Terms & Conditions -->
    <div class="sec-heading">Terms &amp; Conditions</div>
    <p class="tc-item"><span class="tc-lbl">Salary Disbursement: </span>Between 10th to 15th of each month.</p>
    <p class="tc-item"><span class="tc-lbl">Observation Period: </span>First 3 days shall be treated as observation. If continued, those days will be paid; otherwise unpaid.</p>
    <p class="tc-item"><span class="tc-lbl">Probation Period: </span>1 month. Performance will be evaluated for confirmation.</p>
    <p class="tc-item"><span class="tc-lbl">Performance Expectation: </span>Regular and result-oriented work is mandatory. "Zero business" may result in deduction or disciplinary action.</p>
    <p class="tc-item"><span class="tc-lbl">Notice Period: </span>30 days required for resignation.</p>
    <p class="tc-item"><span class="tc-lbl">Final Settlement: </span>Salary and dues settled within 45 days of last working day.</p>
    <p class="tc-item"><span class="tc-lbl">Conduct: </span>Breach of company policy, misconduct, or poor performance may result in immediate termination.</p>
    <p class="tc-item"><span class="tc-lbl">Conflict of Interest: </span>External employment or freelance work is strictly prohibited.</p>

    <!-- Closing -->
    <p class="body-para" style="margin-top:14px;">
      We are excited about the prospect of you joining our team and contributing to the success of
      <b>Bhoomi Techzone Pvt. Ltd.</b> We look forward to your dedication and commitment.
    </p>

    <!-- Signature -->
    <div class="sig-block">
      <div class="sig-company">BHOOMI TECHZONE PRIVATE LIMITED</div>
      <img class="sig-img" src="${signSrc}" alt="Signature" onerror="this.style.display='none'" />
      <div class="sig-line">${hrName}</div>
      <div class="sig-line">HR Department</div>
      <div class="sig-line">Contact: 9821724181 | www.bhoomitechzone.in</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer-wrap">
    <div style="padding:0 30px;">
      <div class="footer-divider"></div>
      <div class="footer-cols">
        <span>A-43, Noida, Sector 63, NOIDA, Uttar Pradesh – 201301</span>
        <span>
          <a href="mailto:hr@bhoomitechzone.in">hr@bhoomitechzone.in</a>
          &nbsp;|&nbsp;
          <a href="http://www.bhoomitechzone.in">www.bhoomitechzone.in</a>
        </span>
      </div>
    </div>
    <div class="bottom-bar"></div>
  </div>

</div>
</body>
</html>`;

      await api.post('/document-generator/generate', {
        content: html,
        title: `Sales Offer Letter - ${form.candidateName || 'Candidate'}`,
        metadata: {
          clientName: form.candidateName,
          position: form.position,
          department: 'Sales',
          templateName: 'Sales Offer Letter',
          joiningDate: form.joiningDate,
          salary: form.salary,
        },
      });

      alert('Sales Offer Letter generated successfully!');
      fetchDocuments();
      setShowSalesOfferLetterModal(false);
    } catch (e) {
      alert('Error generating letter: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateITJoiningLetter = async (form) => {
    setGenerating(true);
    try {
      const hrName = 'Nicki Verma';

      const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '___________';
      const letterDateFmt = fmt(form.letterDate);
      const joiningDateFmt = fmt(form.joiningDate);
      const salaryDisplay = form.salary ? `Rs. ${parseFloat(form.salary).toLocaleString('en-IN')}/-` : '___________';

      const [logoSrc, signSrc] = await Promise.all([
        imgToBase64('/it_offer_logo.png'),
        imgToBase64('/it_offer_sign.png'),
      ]);

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Joining Letter – ${form.candidateName || 'Candidate'}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#393939;background:#fff;}
  .page{width:100%;max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;display:flex;flex-direction:column;}
  
  /* Top green bar */
  .top-bar{height:6px;background:#2C7946;width:100%;flex-shrink:0;}
  
  /* Content area */
  .content{padding:0 30px 10px 30px;flex:1;}
  
  /* Letterhead */
  .lh-header{display:flex;align-items:flex-start;justify-content:space-between;padding:6px 0 4px;min-height:58px;}
  .lh-logo-wrap{flex:0 0 auto;}
  .lh-logo{height:50px;max-width:170px;object-fit:contain;display:block;}
  .lh-company-wrap{flex:1;text-align:right;padding-left:10px;}
  .lh-company-name{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin-bottom:1px;}
  .lh-info{font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;line-height:1.35;}
  
  /* Green separator */
  .lh-divider{width:100%;height:2px;background:#2C7946;margin:2px 0 8px 0;}
  
  /* Title */
  .letter-title{font-family:Arial,sans-serif;font-size:14pt;font-weight:bold;text-align:center;margin:14px 0 5px;color:#000;}
  .title-divider{width:100%;height:0.5px;background:#2C7946;margin-bottom:12px;}
  
  /* Date line */
  .date-line{text-align:right;font-size:9pt;margin-bottom:8px;color:#393939;}
  
  /* Dear line */
  .dear-line{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;margin-bottom:5px;}
  
  /* Body paragraph */
  .body-para{font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;margin-bottom:10px;text-align:justify;color:#393939;}
  
  /* Section headings */
  .sec-heading{font-family:Arial,sans-serif;font-size:10.5pt;font-weight:bold;color:#1F6B39;
    border-bottom:1px solid #BDDFC6;padding-bottom:2px;margin:14px 0 6px;}
  
  /* Green table (Joining Details) */
  .jd-table{width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #BDDFC6;}
  .jd-table td{font-size:9pt;padding:6px 10px;border:1px solid #BDDFC6;}
  .jd-table tr:nth-child(odd) td:first-child{background:#E8F4EB;}
  .jd-table tr:nth-child(even) td:first-child{background:#E8F4EB;}
  .jd-table tr:nth-child(odd) td:last-child{background:#fff;}
  .jd-table tr:nth-child(even) td:last-child{background:#F4F9F6;}
  .jd-lbl{font-weight:bold;color:#1F6B39;width:200px;}
  .jd-val{color:#393939;}
  
  /* Policy list */
  .policy-para{font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;margin-bottom:8px;text-align:justify;color:#393939;}
  
  /* Leave policy table */
  .lp-table{width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid #BDDFC6;}
  .lp-table td{font-size:9pt;padding:6px 10px;border:1px solid #BDDFC6;}
  .lp-table tr td:first-child{background:#E8F4EB;font-weight:bold;color:#1F6B39;width:200px;}
  .lp-table tr:nth-child(odd) td:last-child{background:#fff;}
  .lp-table tr:nth-child(even) td:last-child{background:#F4F9F6;}
  .lp-val{color:#393939;}
  
  /* Signature block */
  .sig-section{margin-top:20px;display:flex;justify-content:space-between;}
  .sig-left{width:48%;}
  .sig-right{width:48%;text-align:left;}
  .sig-company{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin-bottom:4px;}
  .sig-img{height:50px;object-fit:contain;display:block;margin:6px 0;}
  .sig-name{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#000;}
  .sig-dept{font-family:Arial,sans-serif;font-size:8pt;font-weight:bold;color:#393939;}
  .accept-heading{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#393939;margin-bottom:5px;}
  .accept-name{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#393939;}
  
  /* Note */
  .note-section{margin-top:20px;border-top:0.5px solid #BDDFC6;padding-top:8px;}
  .note-text{font-family:Arial,sans-serif;font-size:8pt;font-style:italic;color:#858585;line-height:1.5;}
  .note-text b{font-weight:bold;}
  
  /* Footer */
  .footer-wrap{margin-top:auto;}
  .footer-divider{height:0.5px;background:#2C7946;margin-bottom:4px;}
  .footer-cols{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;padding-bottom:5px;}
  .footer-cols a{color:#000;text-decoration:none;}
  .bottom-bar{height:6px;background:#2C7946;width:100%;}
</style>
</head>
<body>
<div class="page">
  <!-- Top green bar -->
  <div class="top-bar"></div>
  
  <div class="content">
    <!-- Letterhead -->
    <div class="lh-header">
      <div class="lh-logo-wrap">
        <img class="lh-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
      </div>
      <div class="lh-company-wrap">
        <div class="lh-company-name">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="lh-info">www.bhoomitechzone.in | hr@bhoomitechzone.in</div>
        <div class="lh-info">GSTIN: 09AAMCB0572D1ZS | CIN: US5499UP2023PTC191784</div>
        <div class="lh-info">Registered Office: A-43, Sector 63, Noida (201301), Uttar Pradesh</div>
      </div>
    </div>
    <div class="lh-divider"></div>
    
    <!-- Title -->
    <div class="letter-title">JOINING LETTER</div>
    <div class="title-divider"></div>
    
    <!-- Date -->
    <div class="date-line">Date: <b>${letterDateFmt}</b></div>
    
    <!-- Dear -->
    <p class="dear-line">Dear ${form.candidateName || '___________'},</p>
    <br/>
    
    <!-- Opening paragraph -->
    <p class="body-para">
      We are pleased to welcome you to <b>Bhoomi Techzone Pvt. Ltd.</b> Based on your qualifications and potential, 
      we are confident that your skills align well with our organizational objectives and values.
    </p>
    
    <!-- Joining Details -->
    <div class="sec-heading">JOINING DETAILS</div>
    <table class="jd-table">
      <tr><td class="jd-lbl">Employment Type</td><td class="jd-val">Full Time</td></tr>
      <tr><td class="jd-lbl">Position</td><td class="jd-val">${form.position || '___________'}</td></tr>
      <tr><td class="jd-lbl">Date of Joining</td><td class="jd-val">${joiningDateFmt}</td></tr>
      <tr><td class="jd-lbl">Monthly Salary (CTC)</td><td class="jd-val">${salaryDisplay} per month (including Rs. 2,000 Attendance Bonus + Rs. 2,000 Performance Bonus) as per company payroll policy</td></tr>
      <tr><td class="jd-lbl">Working Hours</td><td class="jd-val">${form.workingHours || '10:00 AM – 7:00 PM'} (as per company rules)</td></tr>
      <tr><td class="jd-lbl">Probation Period</td><td class="jd-val">${form.probationPeriod || '1 Month'}</td></tr>
    </table>
    
    <!-- Notice Period Section -->
    <div class="sec-heading">NOTICE PERIOD, FINAL SETTLEMENT & TERMINATION</div>
    <p class="policy-para">
      During probation, if you leave the Company before completing <b>15 days</b>, no salary will be payable as per company policy. 
      Upon successful completion of probation, your employment status will be reviewed for confirmation as a regular employee. 
      As a regular employee, you will be required to serve a minimum notice period of <b>one (1) month</b> prior to resignation.
    </p>
    <p class="policy-para">
      In case of termination by the Company due to poor performance, misconduct, or unethical practices, the Company shall not be 
      liable to pay any salary or dues beyond the last cleared payment. If any employee is found to have misused, disclosed, or 
      otherwise acted in a manner that adversely affects the Company's data, confidential information, or reputation in the market, 
      the Company reserves the right to terminate such employee immediately, without being liable to pay any salary, compensation, 
      or dues beyond the last cleared payment.
    </p>
    
    <!-- Performance & Conduct Section -->
    <div class="sec-heading">PERFORMANCE & CONDUCT</div>
    <p class="policy-para">
      This position requires consistent, result-oriented performance. Instances of zero business, repeated underperformance, 
      or misconduct may result in salary deductions, written warnings, or termination of employment.
    </p>
    <p class="policy-para">
      Misconduct, breach of confidentiality, or violation of company policies may lead to immediate termination without payment.
    </p>
    
    <!-- Employment Policy Section -->
    <div class="sec-heading">EMPLOYMENT POLICY</div>
    <p class="policy-para">
      You are strictly prohibited from engaging in any external employment, freelance work, or business activity during your 
      tenure with the Company. Violation of this policy will lead to immediate termination without notice and forfeiture of 
      any pending salary or incentives.
    </p>
    
    <!-- Late Arrival & Leave Policy Section -->
    <div class="sec-heading" style="page-break-before:always;break-before:page;margin-top:60px;">LATE ARRIVAL & LEAVE POLICY</div>
    <table class="lp-table">
      <tr><td>Working Hours</td><td class="lp-val">${form.workingHours || '10:00 AM – 7:00 PM'} (9 hours per day)</td></tr>
      <tr><td>Late Arrival</td><td class="lp-val">Arrival after ${form.lateThreshold || '10:15 AM'} is considered late</td></tr>
      <tr><td>Half-Day Deduction</td><td class="lp-val">Arrival between ${form.halfDayStart || '10:30 AM'} – ${form.halfDayEnd || '12:00 PM'}</td></tr>
      <tr><td>Full-Day Deduction</td><td class="lp-val">Arrival after ${form.fullDayAfter || '12:00 PM'}</td></tr>
      <tr><td>Uninformed Leave</td><td class="lp-val">Treated as 3 days leave without pay. Exceptions only for valid reasons (e.g., medical emergencies) with prior intimation to HR / Reporting Manager.</td></tr>
    </table>
    
    <!-- Closing -->
    <p class="body-para" style="margin-top:28px;">
      We are excited about the prospect of you joining our team and contributing to the success of 
      <b>Bhoomi Techzone Pvt. Ltd.</b> We look forward to your dedication and commitment.
    </p>
    
    <!-- Signature Section -->
    <div class="sig-section" style="margin-top:44px;">
      <div class="sig-left">
        <div class="sig-company">Bhoomi Techzone Private Limited</div>
        <img class="sig-img" src="${signSrc}" alt="Signature" onerror="this.style.display='none'" />
        <div class="sig-name">${hrName}</div>
        <div class="sig-dept">HR Department</div>
        <div class="sig-dept">Contact: 9821724181</div>
        <div class="sig-dept">Website: www.bhoomitechzone.in</div>
      </div>
      <div class="sig-right">
        <div class="accept-heading">Acceptance by Employee</div>
        <div class="accept-name">Name: ${form.candidateName || '___________'}</div>
        <div style="margin-top:30px;">Signature:</div>
        <div style="margin-top:40px;">Date: ${letterDateFmt}</div>
      </div>
    </div>
    
    <!-- Note -->
    <div class="note-section">
      <p class="note-text">
        <b>Note:</b> This joining letter is valid only when signed and stamped by an authorised representative of 
        Bhoomi Techzone Private Limited, and countersigned by the employee. A letter without the official company 
        stamp and authorised signature shall not be considered a legally binding employment offer.
      </p>
    </div>
  </div>
  
  <!-- Footer -->
  <div class="footer-wrap">
    <div style="padding:0 30px;">
      <div class="footer-divider"></div>
      <div class="footer-cols">
        <span>A-43, Noida, Sector 63, NOIDA, Uttar Pradesh – 201301</span>
        <span>
          <a href="mailto:hr@bhoomitechzone.in">hr@bhoomitechzone.in</a>
          &nbsp;|&nbsp;
          <a href="http://www.bhoomitechzone.in">www.bhoomitechzone.in</a>
        </span>
      </div>
    </div>
    <div class="bottom-bar"></div>
  </div>
</div>
</body>
</html>`;

      await api.post('/document-generator/generate', {
        content: html,
        title: `IT Joining Letter - ${form.candidateName || 'Candidate'}`,
        metadata: {
          clientName: form.candidateName,
          position: form.position,
          department: 'IT',
          templateName: 'IT Joining Letter',
          joiningDate: form.joiningDate,
          salary: form.salary,
        },
      });

      alert('IT Joining Letter generated successfully!');
      fetchDocuments();
      setShowITJoiningLetterModal(false);
    } catch (e) {
      alert('Error generating letter: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateExperienceLetter = async (form) => {
    setGenerating(true);
    try {
      const hrName = 'Nicki Verma';

      const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '___________';
      const joiningDateFmt = fmt(form.dateOfJoining);
      const relievingDateFmt = fmt(form.dateOfRelieving);
      const pronoun = form.salutation === 'Mr.' ? 'He' : 'She';
      const possessive = form.salutation === 'Mr.' ? 'his' : 'her';
      const objective = form.salutation === 'Mr.' ? 'him' : 'her';
      const subjective = form.salutation === 'Mr.' ? 'he' : 'she';
      const fullName = `${form.salutation} ${form.candidateName}`.trim();

      const responsibilitiesHtml = (form.responsibilities || '')
        .split('\n')
        .map(r => r.trim())
        .filter(Boolean)
        .map(r => `<li class="resp-item">${r}</li>`)
        .join('');

      const [logoSrc, signSrc] = await Promise.all([
        imgToBase64('/exp_logo.png'),
        imgToBase64('/exp_extra.png'),
      ]);

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Experience Letter – ${fullName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:9.5pt;color:#000;background:#fff;}
  .page{width:100%;max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;display:flex;flex-direction:column;}
  .top-bar{height:6px;background:#2C7946;width:100%;flex-shrink:0;}
  .content{padding:0 30px 10px 30px;flex:1;}
  .lh-header{display:flex;align-items:flex-start;justify-content:space-between;padding:6px 0 4px;min-height:58px;}
  .lh-logo{height:50px;max-width:170px;object-fit:contain;display:block;}
  .lh-company-wrap{flex:1;text-align:right;padding-left:10px;}
  .lh-company-name{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;color:#000;margin-bottom:1px;}
  .lh-info{font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;line-height:1.35;}
  .lh-divider{width:100%;height:2px;background:#2C7946;margin:2px 0 10px 0;}
  .title-section{text-align:center;margin:6px 0 14px;}
  .company-title{font-family:Arial,sans-serif;font-size:11pt;font-weight:bold;color:#000;margin-bottom:4px;}
  .letter-title{font-family:Arial,sans-serif;font-size:11pt;font-weight:bold;text-decoration:underline;color:#1F6B39;}
  .to-line{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;margin-bottom:6px;}
  .info-table{width:100%;border-collapse:collapse;margin-bottom:14px;}
  .info-table td{font-family:Arial,sans-serif;font-size:9.5pt;padding:3px 0;vertical-align:top;}
  .info-lbl{width:220px;font-weight:bold;}
  .info-colon{width:14px;padding:3px 6px;}
  .info-val{color:#000;}
  .body-para{font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;margin-bottom:10px;text-align:justify;color:#000;}
  .resp-heading{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;margin-bottom:6px;color:#1F6B39;}
  .resp-list{margin-left:20px;margin-bottom:12px;}
  .resp-item{font-family:Arial,sans-serif;font-size:9.5pt;line-height:1.65;margin-bottom:4px;}
  .sig-section{margin-top:20px;}
  .sig-logo{height:42px;max-width:130px;object-fit:contain;display:block;margin-bottom:4px;}
  .sig-regards{font-family:Arial,sans-serif;font-size:9.5pt;margin-bottom:1px;}
  .sig-img{height:50px;object-fit:contain;display:block;margin:4px 0 2px;}
  .sig-name{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#000;margin-bottom:1px;}
  .sig-dept{font-family:Arial,sans-serif;font-size:9pt;color:#000;margin-bottom:1px;}
  .sig-company{font-family:Arial,sans-serif;font-size:9.5pt;font-weight:bold;text-decoration:underline;color:#000;margin-bottom:1px;}
  .sig-contact{font-family:Arial,sans-serif;font-size:9pt;font-weight:bold;color:#000;margin-bottom:1px;}
  .note-section{margin-top:12px;padding-top:6px;}
  .note-text{font-family:Arial,sans-serif;font-size:7.5pt;font-style:italic;color:#858585;line-height:1.5;}
  .note-text b{font-weight:bold;}
  .footer-wrap{margin-top:auto;}
  .footer-divider{height:0.5px;background:#2C7946;margin-bottom:4px;}
  .footer-cols{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:7.5pt;font-weight:bold;color:#000;padding-bottom:5px;}
  .footer-cols a{color:#000;text-decoration:none;}
  .bottom-bar{height:6px;background:#2C7946;width:100%;}
</style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>

  <div class="content">
    <!-- Letterhead -->
    <div class="lh-header">
      <img class="lh-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
      <div class="lh-company-wrap">
        <div class="lh-company-name">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="lh-info">www.bhoomitechzone.in | hr@bhoomitechzone.in</div>
        <div class="lh-info">GSTIN: 09AAMCB0572D1ZS | CIN: US5499UP2023PTC191784</div>
        <div class="lh-info">Registered Office: A-43, Sector 63, Noida (201301), Uttar Pradesh</div>
      </div>
    </div>
    <div class="lh-divider"></div>

    <!-- Title -->
    <div class="title-section">
      <div class="company-title">BHOOMI TECHZONE PRIVATE LIMITED</div>
      <div class="letter-title">Experience Cum Relieving Letter</div>
    </div>

    <!-- Info -->
    <p class="to-line">To :</p>
    <table class="info-table">
      <tr><td class="info-lbl">Name</td><td class="info-colon">:</td><td class="info-val">${form.candidateName || '___________'}</td></tr>
      <tr><td class="info-lbl">Position</td><td class="info-colon">:</td><td class="info-val">${form.position || '___________'}</td></tr>
      <tr><td class="info-lbl">Date of Joining</td><td class="info-colon">:</td><td class="info-val">${joiningDateFmt}</td></tr>
      <tr><td class="info-lbl">Date of Relieving</td><td class="info-colon">:</td><td class="info-val">${relievingDateFmt}</td></tr>
      <tr><td class="info-lbl">Reason For Resignation</td><td class="info-colon">:</td><td class="info-val">${form.reasonForResignation || '___________'}</td></tr>
    </table>

    <!-- Certification paragraph -->
    <p class="body-para">
      This is to certify that <b>${fullName}</b> was employed with <b>Bhoomi Techzone Private Limited</b>
      as a <b>${form.position || '___________'}</b> from ${joiningDateFmt} to ${relievingDateFmt} as per company norms.
    </p>

    <!-- Key Responsibilities -->
    <p class="resp-heading">Key Responsibilities &amp; Contributions:</p>
    <ul class="resp-list">
      ${responsibilitiesHtml}
    </ul>

    <!-- Relieving paragraph -->
    <p class="body-para">
      ${pronoun} has been officially relieved from the services of Bhoomi Techzone Pvt. Ltd. with effect from
      <b>${relievingDateFmt}</b>. All dues have been cleared and there are no outstanding obligations owed to the company.
    </p>

    <!-- Well wishes -->
    <p class="body-para">
      We wish <b>${fullName}</b> all the best in ${possessive} future endeavors and wholeheartedly recommend
      ${objective} for any role ${subjective} may pursue.
    </p>

    <!-- Signature -->
    <div class="sig-section">
      <img class="sig-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
      <p class="sig-regards">Warm Regards</p>
      <div class="sig-name">${hrName}</div>
      <img class="sig-img" src="${signSrc}" alt="Signature" onerror="this.style.display='none'" />
      <div class="sig-dept">HR Department</div>
      <div class="sig-company">Bhoomi Techzone Private Limited</div>
      <div class="sig-contact">Contact No : 9211947852</div>
      <div class="sig-contact">Email Id : hr@bhoomitechzone.in</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer-wrap">
    <div style="padding:0 30px;">
      <div class="footer-divider"></div>
      <div class="footer-cols">
        <span>www.bhoomitechzone.in &nbsp;|&nbsp; hr@bhoomitechzone.in</span>
        <span>A-43, Noida, Sector 63, NOIDA, Uttar Pradesh – 201301</span>
      </div>
      <div class="note-section">
        <p class="note-text">
          <b>Note:</b> This experience letter is issued on the request of the employee and is valid only when signed and stamped by
          authorised representative of Bhoomi Techzone Private Limited. A letter without the official company stamp and
          authorised signature shall not be considered a legally binding document.
        </p>
      </div>
    </div>
    <div class="bottom-bar"></div>
  </div>

</div>
</body>
</html>`;

      await api.post('/document-generator/generate', {
        content: html,
        title: `Experience Letter - ${form.candidateName || 'Candidate'}`,
        metadata: {
          clientName: form.candidateName,
          position: form.position,
          department: form.department || '',
          templateName: 'Experience Letter',
          joiningDate: form.dateOfJoining,
        },
      });

      alert('Experience Letter generated successfully!');
      fetchDocuments();
      setShowExperienceLetterModal(false);
    } catch (e) {
      alert('Error generating letter: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateExitLetter = async (form) => {
    setGenerating(true);
    try {
      const hrName = 'Nicki Verma';
      const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '___________';
      const letterDateFmt = fmt(form.letterDate);
      const joiningDateFmt = fmt(form.dateOfJoining);
      const relievingDateFmt = fmt(form.dateOfRelieving);
      const pronoun = form.salutation === 'Mr.' ? 'his' : 'her';
      const objective = form.salutation === 'Mr.' ? 'him' : 'her';
      const fullName = `${form.salutation} ${form.candidateName}`.trim();

      const [logoSrc, signSrc] = await Promise.all([
        imgToBase64('/exp_logo.png'),
        imgToBase64('/exp_extra.png'),
      ]);

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Exit Certificate – ${fullName}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Arial,sans-serif;font-size:10.5pt;color:#000;background:#fff;}
  .page{width:100%;max-width:210mm;min-height:297mm;margin:0 auto;background:#fff;display:flex;flex-direction:column;}
  .top-bar{height:6px;background:#2C7946;width:100%;flex-shrink:0;}
  .content{padding:0 32px 14px 32px;flex:1;}
  .lh-header{display:flex;align-items:flex-start;justify-content:space-between;padding:8px 0 4px;min-height:62px;}
  .lh-logo{height:52px;max-width:180px;object-fit:contain;display:block;}
  .lh-company-wrap{flex:1;text-align:right;padding-left:10px;}
  .lh-company-name{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#000;margin-bottom:2px;}
  .lh-info{font-family:Arial,sans-serif;font-size:8pt;font-weight:bold;color:#000;line-height:1.4;}
  .lh-divider{width:100%;height:2px;background:#2C7946;margin:3px 0 12px 0;}
  .title-section{text-align:center;margin:8px 0 16px;}
  .company-title{font-family:Arial,sans-serif;font-size:12pt;font-weight:bold;color:#000;margin-bottom:6px;}
  .letter-title{font-family:Arial,sans-serif;font-size:12pt;font-weight:bold;text-decoration:underline;color:#1F6B39;letter-spacing:0.5px;}
  .dear-line{font-family:Arial,sans-serif;font-size:10.5pt;font-weight:bold;margin-bottom:16px;display:flex;gap:40px;}
  .body-para{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.7;margin-bottom:12px;text-align:justify;color:#000;}
  .section-heading{font-family:Arial,sans-serif;font-size:11pt;font-weight:bold;color:#1F6B39;text-decoration:underline;border-bottom:1.5px solid #2C7946;padding-bottom:3px;margin:18px 0 10px;}
  .term-title{font-family:Arial,sans-serif;font-size:10.5pt;font-weight:bold;margin:10px 0 4px;color:#000;}
  .term-body{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.7;margin-bottom:6px;text-align:justify;color:#000;}
  .term-list{list-style:disc;margin-left:36px;margin-bottom:10px;}
  .term-list li{font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.7;margin-bottom:3px;}
  .sig-section{margin-top:22px;}
  .sig-logo{height:44px;max-width:140px;object-fit:contain;display:block;margin-bottom:6px;}
  .sig-name{font-family:Arial,sans-serif;font-size:11pt;font-weight:bold;color:#000;margin-bottom:2px;}
  .sig-img{height:52px;object-fit:contain;display:block;margin:6px 0 4px;}
  .sig-dept{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#000;margin-bottom:2px;}
  .sig-company{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;text-decoration:underline;color:#000;margin-bottom:2px;}
  .sig-contact{font-family:Arial,sans-serif;font-size:10pt;font-weight:bold;color:#000;margin-bottom:2px;}
  .footer-wrap{margin-top:auto;}
  .footer-divider{height:0.5px;background:#2C7946;margin-bottom:5px;}
  .footer-cols{display:flex;justify-content:space-between;font-family:Arial,sans-serif;font-size:8pt;font-weight:bold;color:#000;padding-bottom:5px;}
  .note-section{margin-top:10px;padding-top:4px;}
  .note-text{font-family:Arial,sans-serif;font-size:8pt;font-style:italic;color:#555;line-height:1.5;}
  .note-text b{font-weight:bold;}
  .bottom-bar{height:6px;background:#2C7946;width:100%;}
</style>
</head>
<body>
<div class="page">
  <div class="top-bar"></div>
  <div class="content">

    <!-- Letterhead -->
    <div class="lh-header">
      <img class="lh-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
      <div class="lh-company-wrap">
        <div class="lh-company-name">BHOOMI TECHZONE PRIVATE LIMITED</div>
        <div class="lh-info">www.bhoomitechzone.in | hr@bhoomitechzone.in</div>
        <div class="lh-info">GSTIN: 09AAMCB0572D1ZS | CIN: US5499UP2023PTC191784</div>
        <div class="lh-info">Registered Office: A-43, Sector 63, Noida (201301), Uttar Pradesh</div>
      </div>
    </div>
    <div class="lh-divider"></div>

    <!-- Title -->
    <div class="title-section">
      <div class="company-title">BHOOMI TECHZONE PRIVATE LIMITED</div>
      <div class="letter-title">EMPLOYEE EXIT CERTIFICATE</div>
    </div>

    <!-- Dear line matching template exactly -->
    <p class="dear-line">
      <span>Dear:<strong>${form.candidateName || '___________'}</strong>,</span>
      <span>Date: <strong>${letterDateFmt}</strong></span>
    </p>

    <!-- Certification paragraph -->
    <p class="body-para">
      This is to certify that <strong>${fullName}</strong> who was employed with <strong>Bhoomi Techzone Private Limited</strong>
      as a <strong>${form.position || '___________'}</strong> from <strong>${joiningDateFmt}</strong>
      to <strong>${relievingDateFmt}</strong>, has formally exited the company with effect from <strong>${relievingDateFmt}</strong>.
    </p>

    <!-- Tenure paragraph -->
    <p class="body-para">
      During ${pronoun} tenure, the employee was engaged in various projects involving sensitive business data,
      proprietary codebases, technical documentation, and confidential information pertaining to the company and its clients.
    </p>

    <!-- Section heading with bottom border -->
    <div class="section-heading">Exit Terms &amp; Conditions</div>

    <!-- Term 1 -->
    <p class="term-title">Non-Disclosure of Confidential Information</p>
    <p class="term-body">The employee shall not disclose, share, or use any confidential data, including but not limited to:</p>
    <ul class="term-list">
      <li>Source code, business strategies, product architecture</li>
      <li>Financial information, client data, or internal reports</li>
      <li>Project documents, presentations, or internal communication</li>
    </ul>

    <!-- Term 2 -->
    <p class="term-title">Return of Company Property</p>
    <p class="term-body">The employee confirms the return of all company-owned assets, including:</p>
    <ul class="term-list">
      <li>Laptops, access cards, software licenses, hard drives</li>
      <li>Documents (physical or digital), credentials, and tools</li>
    </ul>

    <!-- Term 3 -->
    <p class="term-title">Non-Retention Clause</p>
    <p class="term-body">The employee shall not retain any form of: Code repositories (local or cloud-based), downloaded files,
    backup copies, or cached data, internal emails, project documents, or designs.</p>

    <!-- Term 4 -->
    <p class="term-title">Intellectual Property</p>
    <p class="term-body">All work created during employment, including code, designs, reports, and documentation, remains the
    exclusive intellectual property of Bhoomi Techzone Pvt. Ltd. Any attempt to reuse, redistribute, or claim ownership may result in legal action.</p>

    <!-- Term 5 -->
    <p class="term-title">Legal Consequences</p>
    <p class="term-body">Any breach of the above terms, resulting in loss of data, intellectual property theft, or client
    dissatisfaction, may attract civil and/or criminal legal action under applicable Indian laws including the Information Technology Act and relevant contract laws.</p>

    <!-- Term 6 -->
    <p class="term-title">No Pending Dues / Full &amp; Final Settlement</p>
    <p class="term-body">All dues have been cleared and acknowledged. Any financial or legal disputes after the date of exit shall be subject to arbitration as per company policies.</p>

    <!-- Closing paragraph -->
    <p class="body-para">We thank <strong>${fullName}</strong> for ${pronoun} contributions during ${pronoun} time with us and wish ${objective} success in ${pronoun} future endeavors.</p>

    <!-- Signature -->
    <div class="sig-section">
      <img class="sig-logo" src="${logoSrc}" alt="Bhoomi Techzone" onerror="this.style.display='none'" />
      <div class="sig-name">${hrName}</div>
      <img class="sig-img" src="${signSrc}" alt="Signature" onerror="this.style.display='none'" />
      <div class="sig-dept">HR Department</div>
      <div class="sig-company">BHOOMI TECHZONE PRIVATE LIMITED</div>
      <div class="sig-contact">Contact No : 9211947852</div>
      <div class="sig-contact">Website :www.bhoomitechzone.in</div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer-wrap">
    <div style="padding:0 32px;">
      <div class="footer-divider"></div>
      <div class="footer-cols">
        <span>✉ hr@bhoomitechzone.in &nbsp;■&nbsp; www.bhoomitechzone.in</span>
        <span>A-43, Sector 63, Noida (201301), Uttar Pradesh</span>
      </div>
      <div class="note-section">
        <p class="note-text">
          <b>Note:</b> This joining letter is valid only when signed and stamped by an authorised representative of Bhoomi Techzone Private Limited, and countersigned by the employee. A letter without the official company stamp and authorised signature shall not be considered a legally binding employment offer.
        </p>
      </div>
    </div>
    <div class="bottom-bar"></div>
  </div>

</div>
</body>
</html>`;

      await api.post('/document-generator/generate', {
        content: html,
        title: `Exit Certificate - ${form.candidateName || 'Employee'}`,
        metadata: {
          clientName: form.candidateName,
          position: form.position,
          templateName: 'Exit Certificate',
          joiningDate: form.dateOfJoining,
          relievingDate: form.dateOfRelieving,
        },
      });

      alert('Exit Certificate generated successfully!');
      fetchDocuments();
      setShowExitLetterModal(false);
    } catch (e) {
      alert('Error generating letter: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateNDA = async () => {
    setGenerating(true);
    try {
      const hrName = 'Nicki Verma';
      const [logoSrc, bgSrc, signSrc] = await Promise.all([
        imgToBase64('/nda_logo.png'),
        imgToBase64('/nda_bg.png'),
        imgToBase64('/Niki Sign.png'),
      ]);

      const html = generateNDAHtml({
        ndaForm,
        logoSrc,
        bgSrc,
        signSrc,
        hrName,
      });

      const payload = {
        content: html,
        title: `NDA - ${ndaForm.employeeName || 'Employee'}`,
        employeeId: ndaForm.employeeId || undefined,
        placeholderData: { ...ndaForm },
        metadata: {
          clientName: ndaForm.employeeName,
          position: ndaForm.designation,
          templateName: 'Non-Disclosure Agreement',
          joiningDate: ndaForm.joiningDate,
          location: ndaForm.fullAddress,
        },
      };

      await saveGeneratedDocument(payload);

      alert(editingDocId ? 'NDA updated successfully!' : 'NDA generated successfully!');
      fetchDocuments();
      setShowNDAModal(false);
      setEditingDocId(null);
    } catch (e) {
      alert('Error generating NDA: ' + (e.response?.data?.message || e.message));
    } finally {
      setGenerating(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmployee(null);
    setSelectedTemplate(null);
    setEmployeeSearch('');
    setFormData({});
    setRawTemplateHtml('');
    setPreviewFullscreen(false);
    setModalStep('setup');
  };

  const handleNext = async () => {
    if (!selectedEmployee) { alert('Please select an employee.'); return; }
    if (!selectedTemplate) { alert('Please select a letter template.'); return; }
    // Fetch the raw template HTML from backend (handles file-based templates)
    try {
      const res = await api.get(`/document-generator/template-content/${selectedTemplate._id}`);
      setRawTemplateHtml(res.data.html || '');
    } catch (e) {
      setRawTemplateHtml(selectedTemplate.content || '');
    }
    setModalStep('fill');
  };

  const handleInputChange = (key, value) => setFormData(prev => ({ ...prev, [key]: value }));

  const handlePreview = async () => {
    try {
      const res = await api.post('/document-generator/preview', {
        templateId: selectedTemplate._id,
        placeholderData: formData,
      });
      setPreviewHtml(res.data.html);
      setShowModal(false);
      setViewMode('preview');
    } catch (e) { alert('Error generating preview'); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const empName = selectedEmployee
      ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
      : (formData.employee_name || formData.candidate_name || formData.name || 'Document');
    try {
      await api.post('/document-generator/generate', {
        templateId: selectedTemplate._id,
        placeholderData: formData,
        employeeId: selectedEmployee?._id,
        title: `${selectedTemplate.name} - ${empName}`,
        metadata: { clientName: empName, position: formData.position || formData.designation, department: formData.department },
      });
      alert('Letter generated successfully!');
      fetchDocuments();
      closeModal();
      setViewMode('list');
    } catch (e) {
      alert('Error: ' + (e.response?.data?.message || e.message));
    } finally { setGenerating(false); }
  };

  const handleDownload = async (docId) => {
    const doc = documents.find(d => d._id === docId);
    const rawFileName = doc?.title ? `${doc.title}.pdf` : `letter-${docId}.pdf`;
    const cleanFileName = rawFileName.replace(/[/\\?%*:|"<>]/g, '_');

    try {
      let downloaded = false;
      try {
        const res = await api.get(`/document-generator/${docId}/download`, { responseType: 'blob' });
        
        if (res.data && res.data.type !== 'application/json' && res.data.size > 500) {
          const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = cleanFileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
          downloaded = true;
        }
      } catch (serverErr) {
        console.warn('Server download failed, using client-side generator:', serverErr.message);
      }

      if (!downloaded) {
        if (doc?.finalHtml && doc.finalHtml.length > 50 && !doc.finalHtml.includes('Document generated in DOCX format.')) {
          await downloadHtmlAsPdf(doc.finalHtml, cleanFileName);
          downloaded = true;
        } else {
          throw new Error('Document content not available for PDF generation');
        }
      }
    } catch (e) {
      console.error('Download error:', e);
      alert('Error downloading letter: ' + (e.message || 'File not available'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this letter?')) return;
    try { await api.delete(`/document-generator/${id}`); fetchDocuments(); }
    catch (e) { alert('Error deleting letter'); }
  };

  const filteredDocs = documents.filter(d => {
    const isFilterAll = !filterType || filterType === 'all';
    const typeStr = (filterType || '').toLowerCase().replace(/_/g, ' ');
    const docType = (d.template?.type || d.type || '').toLowerCase().replace(/_/g, ' ');
    const templateName = (d.metadata?.templateName || d.template?.name || '').toLowerCase().replace(/_/g, ' ');
    const docTitle = (d.title || '').toLowerCase();

    const matchesFilter = isFilterAll ||
      docType.includes(typeStr) ||
      templateName.includes(typeStr) ||
      (typeStr === 'nda' && (templateName.includes('nda') || templateName.includes('disclosure') || docTitle.includes('nda'))) ||
      (typeStr === 'exit certificate' && (templateName.includes('exit') || docTitle.includes('exit')));

    const term = (searchTerm || '').trim().toLowerCase();
    const matchesSearch = !term ||
      (d.title && d.title.toLowerCase().includes(term)) ||
      (d.documentNumber && d.documentNumber.toLowerCase().includes(term)) ||
      (d.metadata?.clientName && d.metadata.clientName.toLowerCase().includes(term)) ||
      (d.metadata?.templateName && d.metadata.templateName.toLowerCase().includes(term)) ||
      (d.employee && `${d.employee.firstName || ''} ${d.employee.lastName || ''}`.toLowerCase().includes(term)) ||
      (d.generatedBy && `${d.generatedBy.firstName || ''} ${d.generatedBy.lastName || ''}`.toLowerCase().includes(term));

    return matchesFilter && matchesSearch;
  });






  // Pagination
  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);
  const paginatedDocs = filteredDocs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterType]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId && !e.target.closest('.letters-kebab-btn') && !e.target.closest('.letters-kebab-menu')) {
        setOpenMenuId(null);
      }
      if (showFilterDropdown && !e.target.closest('.letters-filter-btn') && !e.target.closest('.letters-filter-dropdown')) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId, showFilterDropdown]);

  const filteredEmployees = employees.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (e.designation || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );

  // ── Access denied ────────────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="docgen-container">
        <div className="docgen-access-denied">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="docgen-access-title">Access Denied</div>
          <p>Only Admin, Director, and HR personnel can access Letters.</p>
        </div>
      </div>
    );
  }

  // ── Preview view ─────────────────────────────────────────────────────────
  if (viewMode === 'preview') {
    return (
      <div className="docgen-container">
        <div className="docgen-header">
          <div className="docgen-header-left">
            <button
              onClick={() => { setViewMode('list'); setShowModal(true); setModalStep('fill'); }}
              className="docgen-back-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div>
              <div className="docgen-title">Preview Letter</div>
              <div className="docgen-subtitle">Review before generating PDF</div>
            </div>
          </div>
          <div className="docgen-header-actions">
            <button
              onClick={() => { setViewMode('list'); setShowModal(true); setModalStep('fill'); }}
              className="docgen-btn-ghost"
            >Edit</button>
            <button onClick={handleGenerate} className="docgen-btn-primary" disabled={generating}>
              {generating ? 'Generating…' : 'Generate PDF'}
            </button>
          </div>
        </div>
        <div className="docgen-preview-container">
          <div className="docgen-preview-paper" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div className="docgen-container">

      {/* Header */}
      <div className="docgen-header">
        <div className="docgen-header-left">
          <div>
            <div className="docgen-title">Letters</div>
            <div className="docgen-subtitle">Generate and manage employee letters</div>
          </div>
        </div>
        {canCreate && <div style={{ position: 'relative' }} ref={genBtnRef}>
          <button
            className="letters-generate-btn"
            onClick={() => setGenDropdownOpen(o => !o)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            <span>Generate Letter</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ marginLeft: 2 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {genDropdownOpen && (
            <div className="gen-letter-dropdown">
              <div className="gld-section" onClick={e => e.stopPropagation()}>
                {/* Sales Section */}
                <div
                  className={`gld-expand-item ${expandedLetterSection === 'sales' ? 'active' : ''}`}
                  onClick={() => setExpandedLetterSection(expandedLetterSection === 'sales' ? null : 'sales')}
                >
                  <div className="gld-item-details">
                    <div className="gld-item-title">Sales</div>
                    <div className="gld-item-desc">Offer & Joining Letters</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: expandedLetterSection === 'sales' ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {expandedLetterSection === 'sales' && (
                  <div className="gld-inline-submenu">
                    <button className="gld-submenu-item" onClick={() => handleLetterSelection('Offer', 'Sales')}>
                      Offer Letter
                    </button>
                    <button className="gld-submenu-item" onClick={() => handleLetterSelection('Joining', 'Sales')}>
                      Joining Letter
                    </button>
                  </div>
                )}

                {/* Tech Section */}
                <div
                  className={`gld-expand-item ${expandedLetterSection === 'tech' ? 'active' : ''}`}
                  onClick={() => setExpandedLetterSection(expandedLetterSection === 'tech' ? null : 'tech')}
                >
                  <div className="gld-item-details">
                    <div className="gld-item-title">Tech</div>
                    <div className="gld-item-desc">Offer & Joining Letters</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: expandedLetterSection === 'tech' ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {expandedLetterSection === 'tech' && (
                  <div className="gld-inline-submenu">
                    <button className="gld-submenu-item" onClick={() => handleLetterSelection('Offer', 'IT')}>
                      Offer Letter
                    </button>
                    <button className="gld-submenu-item" onClick={() => handleLetterSelection('Joining', 'IT')}>
                      Joining Letter
                    </button>
                  </div>
                )}

                {/* Compliance Section */}
                <div
                  className={`gld-expand-item ${expandedLetterSection === 'compliance' ? 'active' : ''}`}
                  onClick={() => setExpandedLetterSection(expandedLetterSection === 'compliance' ? null : 'compliance')}
                >
                  <div className="gld-item-details">
                    <div className="gld-item-title">Compliance</div>
                    <div className="gld-item-desc">Non-Disclosure Agreements</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: expandedLetterSection === 'compliance' ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
                {expandedLetterSection === 'compliance' && (
                  <div className="gld-inline-submenu">
                    <button className="gld-submenu-item" onClick={() => handleLetterSelection('NDA', 'Compliance')}>
                      Generate NDA
                    </button>
                  </div>
                )}

                {/* Divider */}
                <div style={{ height: '1px', background: '#f1f5f9', margin: '6px 10px' }} />

                {/* Experience Letter */}
                <button className="gld-item" onClick={() => handleLetterSelection('Experience')}>
                  <div className="gld-item-details">
                    <div className="gld-item-title">Experience Letter</div>
                    <div className="gld-item-desc">Professional service record</div>
                  </div>
                </button>

                {/* Exit Certificate */}
                <button className="gld-item" onClick={() => handleLetterSelection('Exit')}>
                  <div className="gld-item-details">
                    <div className="gld-item-title">Exit Certificate</div>
                    <div className="gld-item-desc">Relieving & conduct record</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>}
      </div>

      {/* Generated letters table */}
      <div className="docgen-table-card">
        <div className="docgen-table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <div className="docgen-search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search letters…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Type Button */}
            <div style={{ position: 'relative' }}>
              <button
                className="letters-filter-btn"
                onClick={(e) => {
                  setShowFilterDropdown(!showFilterDropdown);
                  // Store button position for fixed dropdown
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.dataset.dropTop = rect.bottom + 6;
                  e.currentTarget.dataset.dropLeft = rect.left;
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 9px',
                  border: `1px solid ${filterType ? '#3b775e' : '#e2e8f0'}`,
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: filterType ? '#3b775e' : '#475569',
                  background: filterType ? '#f0fdf4' : '#fff',
                  cursor: 'pointer',
                  fontFamily: "'Inter', 'Segoe UI', sans-serif",
                  fontWeight: 500,
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap'
                }}
              >
                {(!filterType || filterType === 'all') ? 'All Types' : filterType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showFilterDropdown && (() => {
                const btn = document.querySelector('.letters-filter-btn');
                const rect = btn?.getBoundingClientRect();
                return (
                  <div
                    className="letters-filter-dropdown"
                    style={{
                      position: 'fixed',
                      top: `${rect ? rect.bottom + 6 : 0}px`,
                      left: `${rect ? rect.left : 0}px`,
                      zIndex: 9999,
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      boxShadow: '0 8px 32px rgba(15,23,42,0.13)',
                      padding: '10px',
                      minWidth: '200px'
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 4px' }}>
                      Letter Type
                    </div>
                    <button
                      onClick={() => { setFilterType('all'); setShowFilterDropdown(false); }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: (!filterType || filterType === 'all') ? '#f0fdf4' : 'transparent',
                        color: (!filterType || filterType === 'all') ? '#15803d' : '#475569',
                        fontSize: '12px',
                        fontWeight: (!filterType || filterType === 'all') ? 600 : 400,
                        cursor: 'pointer',
                        fontFamily: "'Inter', 'Segoe UI', sans-serif"
                      }}
                    >
                      All Types
                    </button>
                    {LETTER_TYPES.map(t => (
                      <button
                        key={t}
                        onClick={() => { setFilterType(t); setShowFilterDropdown(false); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: filterType === t ? '#f0fdf4' : 'transparent',
                          color: filterType === t ? '#15803d' : '#475569',
                          fontSize: '12px',
                          fontWeight: filterType === t ? 600 : 400,
                          cursor: 'pointer',
                          fontFamily: "'Inter', 'Segoe UI', sans-serif"
                        }}
                      >
                        {t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
          <span className="docgen-count">{filteredDocs.length} of {documents.length}</span>
        </div>

        {loading ? (
          <div className="letters-skeleton-table">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="letters-skeleton-row">
                <div className="letters-skeleton-cell" style={{ width: '8%' }} />
                <div className="letters-skeleton-cell" style={{ width: '22%' }} />
                <div className="letters-skeleton-cell" style={{ width: '13%' }} />
                <div className="letters-skeleton-cell" style={{ width: '14%' }} />
                <div className="letters-skeleton-cell" style={{ width: '13%' }} />
                <div className="letters-skeleton-cell" style={{ width: '10%' }} />
                <div className="letters-skeleton-cell" style={{ width: '10%' }} />
                <div className="letters-skeleton-cell" style={{ width: '6%' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="docgen-table-wrapper">
            <table className="docgen-table">
              <thead>
                <tr>
                  <th>Doc #</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Employee</th>
                  <th>Generated By</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="docgen-empty">
                      No letters generated yet. Click "Generate Letter" to get started.
                    </td>
                  </tr>
                ) : (
                  paginatedDocs.map((doc) => (
                    <tr key={doc._id}>
                      <td className="docgen-doc-number">{doc.documentNumber}</td>
                      <td className="docgen-doc-title">{doc.title}</td>
                      <td>{doc.metadata?.templateName || doc.template?.name || doc.template?.type?.replace(/_/g, ' ') || '—'}</td>
                      <td>{doc.metadata?.clientName ? <span className="letters-name-badge" style={nameBadgeStyle(doc.metadata.clientName)}>{doc.metadata.clientName}</span> : (doc.employee ? <span className="letters-name-badge" style={nameBadgeStyle(`${doc.employee.firstName || ''} ${doc.employee.lastName || ''}`.trim())}>{`${doc.employee.firstName || ''} ${doc.employee.lastName || ''}`.trim()}</span> : '—')}</td>
                      <td>{doc.generatedBy ? <span className="letters-name-badge" style={nameBadgeStyle(`${doc.generatedBy.firstName || ''} ${doc.generatedBy.lastName || ''}`.trim())}>{`${doc.generatedBy.firstName || ''} ${doc.generatedBy.lastName || ''}`.trim()}</span> : '—'}</td>
                      <td>{new Date(doc.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span className={`docgen-status docgen-status-${doc.status}`}>{doc.status}</span>
                      </td>
                      <td>
                        <div style={{ display: 'inline-block' }}>
                          <button
                            className="letters-kebab-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setOpenMenuId(openMenuId === doc._id ? null : doc._id);
                              if (openMenuId !== doc._id) {
                                // Store position for the menu - position to the left of button
                                e.currentTarget.dataset.menuTop = rect.top;
                                e.currentTarget.dataset.menuLeft = rect.left - 170; // 170px = menu width + gap
                              }
                            }}
                            title="Actions"
                            ref={el => { menuRef.current[doc._id] = el; }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="5" r="1" fill="currentColor" />
                              <circle cx="12" cy="12" r="1" fill="currentColor" />
                              <circle cx="12" cy="19" r="1" fill="currentColor" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredDocs.length > itemsPerPage && (
          <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              style={{ width: '28px', height: '28px', borderRadius: '7px', background: currentPage === 1 ? '#f0fdf4' : '#a3e635', border: 'none', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', opacity: currentPage === 1 ? 0.4 : 1 }}
              onMouseEnter={e => { if (currentPage !== 1) e.currentTarget.style.background = '#84cc16'; }}
              onMouseLeave={e => { if (currentPage !== 1) e.currentTarget.style.background = '#a3e635'; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#365314" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>

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
                  style={{ width: '28px', height: '28px', borderRadius: '7px', background: currentPage === pageNum ? '#a3e635' : '#f0fdf4', border: currentPage === pageNum ? 'none' : '1px solid #d9f99d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', fontSize: '11px', fontWeight: '700', color: currentPage === pageNum ? '#365314' : '#4d7c0f', fontFamily: "'Inter', sans-serif" }}
                  onMouseEnter={e => { if (currentPage !== pageNum) e.currentTarget.style.background = '#bef264'; }}
                  onMouseLeave={e => { if (currentPage !== pageNum) e.currentTarget.style.background = '#f0fdf4'; }}
                >{pageNum}</button>
              );
            })}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <span style={{ padding: '0 4px', color: '#84cc16', fontSize: '12px', fontWeight: '700' }}>...</span>
            )}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <button
                onClick={() => setCurrentPage(totalPages)}
                style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#f0fdf4', border: '1px solid #d9f99d', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', fontSize: '11px', fontWeight: '700', color: '#4d7c0f', fontFamily: "'Inter', sans-serif" }}
                onMouseEnter={e => e.currentTarget.style.background = '#bef264'}
                onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
              >{totalPages}</button>
            )}

            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{ width: '28px', height: '28px', borderRadius: '7px', background: currentPage === totalPages ? '#f0fdf4' : '#a3e635', border: 'none', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', opacity: currentPage === totalPages ? 0.4 : 1 }}
              onMouseEnter={e => { if (currentPage !== totalPages) e.currentTarget.style.background = '#84cc16'; }}
              onMouseLeave={e => { if (currentPage !== totalPages) e.currentTarget.style.background = '#a3e635'; }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#365314" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Generate Letter Modal ── */}
      {showModal && (<div className="letters-modal-overlay" onClick={closeModal}>
        <div className={`letters-modal${modalStep === 'fill' ? ' letters-modal-wide' : ''}`} onClick={e => e.stopPropagation()}>

          {/* Modal Header */}
          <div className="letters-modal-header">
            <div>
              <div className="letters-modal-title">
                {modalStep === 'setup' ? 'Generate Letter' : `Fill Details — ${selectedTemplate?.name}`}
              </div>
              <div className="letters-modal-sub">
                {modalStep === 'setup'
                  ? 'Select an employee and choose a letter template'
                  : 'Review and complete the letter fields'}
              </div>
            </div>
            <button className="letters-modal-close" onClick={closeModal}>×</button>
          </div>

          {/* Step: Setup — employee + template selection */}
          {modalStep === 'setup' && (
            <div className="letters-modal-body">

              <div className="letters-modal-section">
                <label className="letters-modal-label">
                  Employee <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="letters-modal-input"
                    placeholder="Search by name or designation…"
                    value={employeeSearch}
                    onChange={(e) => { setEmployeeSearch(e.target.value); setEmpDropdownOpen(true); }}
                    onFocus={() => setEmpDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setEmpDropdownOpen(false), 180)}
                    autoComplete="off"
                  />
                  {selectedEmployee && (
                    <div className="letters-selected-pill">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      {selectedEmployee.firstName} {selectedEmployee.lastName}
                      <button
                        onClick={() => { setSelectedEmployee(null); setEmployeeSearch(''); }}
                        className="letters-pill-clear"
                      >×</button>
                    </div>
                  )}
                  {empDropdownOpen && filteredEmployees.length > 0 && (
                    <div className="letters-emp-list">
                      {filteredEmployees.slice(0, 8).map(emp => (
                        <div
                          key={emp._id}
                          className="letters-emp-item"
                          onMouseDown={() => {
                            setSelectedEmployee(emp);
                            setEmployeeSearch(`${emp.firstName} ${emp.lastName}`);
                            setEmpDropdownOpen(false);
                          }}
                        >
                          <div className="letters-emp-name">{emp.firstName} {emp.lastName}</div>
                          <div className="letters-emp-meta">
                            {emp.designation || ''}{emp.department ? ` · ${emp.department}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="letters-modal-section">
                <label className="letters-modal-label">
                  Letter Template <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {templates.length === 0 ? (
                  <div className="letters-no-templates">
                    No templates found. Create templates from the Templates page first.
                  </div>
                ) : (
                  <div className="letters-template-list">
                    {templates.map(t => (
                      <div
                        key={t._id}
                        className={`letters-template-row ${selectedTemplate?._id === t._id ? 'selected' : ''}`}
                        onClick={() => setSelectedTemplate(selectedTemplate?._id === t._id ? null : t)}
                      >
                        <div className="letters-template-row-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                          </svg>
                        </div>
                        <div className="letters-template-row-info">
                          <div className="letters-template-row-name">{t.name}</div>
                          <div className="letters-template-row-type">{t.type.replace(/_/g, ' ')}</div>
                        </div>
                        {selectedTemplate?._id === t._id && (
                          <div className="letters-template-row-check">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="letters-modal-footer">
                <button className="docgen-btn-ghost" onClick={closeModal}>Cancel</button>
                <button
                  className="docgen-btn-primary"
                  onClick={handleNext}
                  disabled={!selectedEmployee || !selectedTemplate}
                >
                  Next — Fill Details
                </button>
              </div>
            </div>
          )}

          {/* Step: Fill placeholders */}
          {modalStep === 'fill' && (
            <div className="letters-fill-body">

              {/* ── Left: editable fields (hidden when fullscreen) ── */}
              {!previewFullscreen && (
                <div className="letters-fill-left">
                  <div className="letters-fill-section-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                    Custom Fields
                  </div>

                  {customPlaceholders.length === 0 ? (
                    <div className="letters-all-filled">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <p>All fields auto-filled from employee data.</p>
                    </div>
                  ) : (
                    <div className="letters-fields-grid">
                      {customPlaceholders.map((placeholder) => (
                        <div key={placeholder.key} className="letters-field-item">
                          <label className="letters-field-label">
                            {placeholder.label}
                            {placeholder.required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
                          </label>
                          {placeholder.type === 'textarea' ? (
                            <textarea
                              className="letters-field-input"
                              value={formData[placeholder.key] || ''}
                              onChange={(e) => handleInputChange(placeholder.key, e.target.value)}
                              rows="3"
                            />
                          ) : placeholder.type === 'select' ? (
                            <select
                              className="letters-field-input"
                              value={formData[placeholder.key] || ''}
                              onChange={(e) => handleInputChange(placeholder.key, e.target.value)}
                            >
                              <option value="">Select…</option>
                              {(placeholder.options || []).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={placeholder.type || 'text'}
                              className="letters-field-input"
                              value={formData[placeholder.key] || ''}
                              onChange={(e) => handleInputChange(placeholder.key, e.target.value)}
                              placeholder={`Enter ${placeholder.label.toLowerCase()}…`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Employee data chips */}
                  <div className="letters-fill-section-label" style={{ marginTop: 18 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    Auto-filled from Employee
                  </div>
                  <div className="letters-autofill-chips">
                    {selectedEmployee && [
                      { label: 'Name', value: `${selectedEmployee.firstName} ${selectedEmployee.lastName}` },
                      { label: 'ID', value: selectedEmployee.employeeId },
                      { label: 'Designation', value: selectedEmployee.designation },
                      { label: 'Department', value: selectedEmployee.department },
                      { label: 'Email', value: selectedEmployee.email },
                      { label: 'Phone', value: selectedEmployee.phone },
                      { label: 'Joining', value: selectedEmployee.joiningDate ? new Date(selectedEmployee.joiningDate).toLocaleDateString('en-IN') : '' },
                    ].filter(c => c.value).map(chip => (
                      <div key={chip.label} className="letters-autofill-chip">
                        <span className="letters-chip-label">{chip.label}</span>
                        <span className="letters-chip-value">{chip.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="letters-fill-footer">
                    <button className="docgen-btn-ghost" onClick={() => setModalStep('setup')}>Back</button>
                    <button className="docgen-btn-primary" onClick={handleGenerate} disabled={generating}>
                      {generating ? 'Generating…' : 'Generate PDF'}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Right: live letter preview ── */}
              <div className={`letters-fill-right${previewFullscreen ? ' letters-fill-right-full' : ''}`}>
                <div className="letters-preview-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  Live Preview
                  <span className="letters-preview-hint">Yellow = unfilled fields</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {previewFullscreen && (
                      <button className="docgen-btn-primary" style={{ fontSize: 11.5, padding: '5px 12px' }} onClick={handleGenerate} disabled={generating}>
                        {generating ? 'Generating…' : 'Generate PDF'}
                      </button>
                    )}
                    <button
                      className="letters-preview-toggle-btn"
                      onClick={() => setPreviewFullscreen(f => !f)}
                      title={previewFullscreen ? 'Exit full view' : 'Full page view'}
                    >
                      {previewFullscreen ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
                      )}
                      {previewFullscreen ? 'Exit Full View' : 'Full Page'}
                    </button>
                  </div>
                </div>
                <div className="letters-live-preview-scroll">
                  <div
                    className="letters-live-preview-paper"
                    dangerouslySetInnerHTML={{ __html: letterLivePreview }}
                  />
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
      )}

      {/* ── Sales Joining Letter Modal ── */}
      {showJoiningLetterModal && (
        <div className="letters-modal-overlay" onClick={() => setShowJoiningLetterModal(false)}>
          <div className="jl-modal" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="letters-modal-header">
              <div>
                <div className="letters-modal-title">Sales Joining Letter</div>
                <div className="letters-modal-sub">Fill candidate details — company info is pre-filled</div>
              </div>
              <button className="letters-modal-close" onClick={() => setShowJoiningLetterModal(false)}>×</button>
            </div>

            {/* Body */}
            <div className="jl-modal-body">

              {/* Static company info notice */}
              <div className="jl-company-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                <span><b>Company:</b> Bhoomi Techzone Private Limited &nbsp;|&nbsp; <b>HR:</b> Nicki Verma &nbsp;|&nbsp; <b>Phone:</b> +91 9211947852</span>
              </div>

              {/* Form grid */}
              <div className="jl-form-grid">

                <div className="jl-field">
                  <label className="jl-label">Letter Date <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={joiningLetterForm.letterDate}
                    onChange={e => setJoiningLetterForm(f => ({ ...f, letterDate: e.target.value }))} required />
                </div>

                                <div className="jl-field jl-full">
                  <label className="jl-label">Mobile Number <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. 9876543210"
                    value={ndaForm.mobileNo}
                    onChange={e => setNdaForm(f => ({ ...f, mobileNo: e.target.value }))} required />
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Email ID <span className="jl-req">*</span></label>
                  <input type="email" className="jl-input" placeholder="e.g. rahul@example.com"
                    value={ndaForm.emailId}
                    onChange={e => setNdaForm(f => ({ ...f, emailId: e.target.value }))} required />
                </div>
                <div className="jl-field">
                  <label className="jl-label">Date of Joining <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={joiningLetterForm.joiningDate}
                    onChange={e => setJoiningLetterForm(f => ({ ...f, joiningDate: e.target.value }))} required />
                </div>

                <div className="jl-field jl-full">
                  <label className="jl-label">Candidate Full Name <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Rahul Sharma"
                    value={joiningLetterForm.candidateName}
                    onChange={e => setJoiningLetterForm(f => ({ ...f, candidateName: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Position / Designation <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Sales Executive"
                    value={joiningLetterForm.position}
                    onChange={e => setJoiningLetterForm(f => ({ ...f, position: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Department</label>
                  <input type="text" className="jl-input" placeholder="e.g. Sales"
                    value={joiningLetterForm.department}
                    onChange={e => setJoiningLetterForm(f => ({ ...f, department: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Monthly Salary (CTC) <span className="jl-req">*</span></label>
                  <input type="number" className="jl-input" placeholder="e.g. 25000"
                    value={joiningLetterForm.salary}
                    onChange={e => setJoiningLetterForm(f => ({ ...f, salary: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Working Hours</label>
                  <input type="text" className="jl-input"
                    value={joiningLetterForm.workingHours}
                    onChange={e => setJoiningLetterForm(f => ({ ...f, workingHours: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Probation Period</label>
                  <input type="text" className="jl-input"
                    value={joiningLetterForm.probationPeriod}
                    onChange={e => setJoiningLetterForm(f => ({ ...f, probationPeriod: e.target.value }))} />
                </div>

              </div>

              {/* Late Arrival Policy section */}
              <div className="jl-policy-section">
                <div className="jl-policy-header">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span>Late Arrival Policy Times (Optional)</span>
                </div>
                <div className="jl-form-grid" style={{ marginTop: 10 }}>
                  <div className="jl-field">
                    <label className="jl-label">Late Threshold</label>
                    <input type="text" className="jl-input" placeholder="e.g. 10:15 AM"
                      value={joiningLetterForm.lateThreshold}
                      onChange={e => setJoiningLetterForm(f => ({ ...f, lateThreshold: e.target.value }))} />
                  </div>
                  <div className="jl-field">
                    <label className="jl-label">Full Day After</label>
                    <input type="text" className="jl-input" placeholder="e.g. 12:00 PM"
                      value={joiningLetterForm.fullDayAfter}
                      onChange={e => setJoiningLetterForm(f => ({ ...f, fullDayAfter: e.target.value }))} />
                  </div>
                  <div className="jl-field">
                    <label className="jl-label">Half-Day Start</label>
                    <input type="text" className="jl-input" placeholder="e.g. 10:30 AM"
                      value={joiningLetterForm.halfDayStart}
                      onChange={e => setJoiningLetterForm(f => ({ ...f, halfDayStart: e.target.value }))} />
                  </div>
                  <div className="jl-field">
                    <label className="jl-label">Half-Day End</label>
                    <input type="text" className="jl-input" placeholder="e.g. 12:00 PM"
                      value={joiningLetterForm.halfDayEnd}
                      onChange={e => setJoiningLetterForm(f => ({ ...f, halfDayEnd: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Policy preview */}
              <div className="jl-policy-notice">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>Notice Period, Performance, Employment &amp; Leave policies are auto-included as per company standard.</span>
              </div>

            </div>

            {/* Footer */}
            <div className="jl-modal-footer">
              <button className="jl-btn-cancel" onClick={() => setShowJoiningLetterModal(false)}>Cancel</button>
              <button
                className="jl-btn-generate"
                onClick={() => {
                  if (!joiningLetterForm.candidateName || !joiningLetterForm.position || !joiningLetterForm.joiningDate || !joiningLetterForm.salary) {
                    alert('Please fill in Candidate Name, Position, Date of Joining, and Salary.');
                    return;
                  }
                  handleGenerateJoiningLetter(joiningLetterForm);
                }}
                disabled={generating}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {generating ? 'Generating…' : 'Generate PDF'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── IT Offer Letter Modal ── */}
      {showITOfferLetterModal && (
        <div className="letters-modal-overlay" onClick={() => setShowITOfferLetterModal(false)}>
          <div className="jl-modal" onClick={e => e.stopPropagation()}>

            <div className="letters-modal-header">
              <div>
                <div className="letters-modal-title">IT Offer Letter</div>
                <div className="letters-modal-sub">Fill candidate details — company info is pre-filled</div>
              </div>
              <button className="letters-modal-close" onClick={() => setShowITOfferLetterModal(false)}>×</button>
            </div>

            <div className="jl-modal-body">

              <div className="jl-company-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                <span><b>Company:</b> Bhoomi Techzone Private Limited &nbsp;|&nbsp; <b>HR:</b> Nicki Verma &nbsp;|&nbsp; <b>Phone:</b> +91 9211947852</span>
              </div>

              <div className="jl-form-grid">

                <div className="jl-field">
                  <label className="jl-label">Letter Date <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={itOfferLetterForm.letterDate}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, letterDate: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Date of Joining <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={itOfferLetterForm.joiningDate}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, joiningDate: e.target.value }))} required />
                </div>

                <div className="jl-field jl-full">
                  <label className="jl-label">Candidate Full Name <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Rahul Sharma"
                    value={itOfferLetterForm.candidateName}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, candidateName: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Position / Designation <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Software Developer"
                    value={itOfferLetterForm.position}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, position: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Monthly Stipend (₹) <span className="jl-req">*</span></label>
                  <input type="number" className="jl-input" placeholder="e.g. 20000"
                    value={itOfferLetterForm.salary}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, salary: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Internship Duration (months) <span style={{ color: '#666', fontWeight: 'normal' }}>(Optional)</span></label>
                  <input type="number" className="jl-input" placeholder="Leave empty if not applicable"
                    value={itOfferLetterForm.duration}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, duration: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Observation Period</label>
                  <input type="text" className="jl-input" placeholder="e.g. 3 Days Unpaid"
                    value={itOfferLetterForm.observationPeriod}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, observationPeriod: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Working Days</label>
                  <input type="text" className="jl-input" placeholder="e.g. Monday to Saturday"
                    value={itOfferLetterForm.workingDays}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, workingDays: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Office Hours</label>
                  <input type="text" className="jl-input" placeholder="e.g. 10:00 AM to 7:00 PM"
                    value={itOfferLetterForm.officeHours}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, officeHours: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Reporting Time</label>
                  <input type="text" className="jl-input" placeholder="e.g. 09:45 AM"
                    value={itOfferLetterForm.reportingTime}
                    onChange={e => setItOfferLetterForm(f => ({ ...f, reportingTime: e.target.value }))} />
                </div>

              </div>

              <div className="jl-policy-notice">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>Probation policy, notice period, salary disbursement, and conduct terms are auto-included as per company standard.</span>
              </div>

            </div>

            <div className="jl-modal-footer">
              <button className="jl-btn-cancel" onClick={() => setShowITOfferLetterModal(false)}>Cancel</button>
              <button
                className="jl-btn-generate"
                onClick={() => {
                  if (!itOfferLetterForm.candidateName || !itOfferLetterForm.position || !itOfferLetterForm.joiningDate || !itOfferLetterForm.salary) {
                    alert('Please fill in Candidate Name, Position, Date of Joining, and Monthly Stipend.');
                    return;
                  }
                  handleGenerateITOfferLetter(itOfferLetterForm);
                }}
                disabled={generating}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {generating ? 'Generating…' : 'Generate PDF'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Sales Offer Letter Modal ── */}
      {showSalesOfferLetterModal && (
        <div className="letters-modal-overlay" onClick={() => setShowSalesOfferLetterModal(false)}>
          <div className="jl-modal" onClick={e => e.stopPropagation()}>

            <div className="letters-modal-header">
              <div>
                <div className="letters-modal-title">Sales Offer Letter</div>
                <div className="letters-modal-sub">Fill candidate details — company info is pre-filled</div>
              </div>
              <button className="letters-modal-close" onClick={() => setShowSalesOfferLetterModal(false)}>×</button>
            </div>

            <div className="jl-modal-body">
              <div className="jl-company-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                <span><b>Company:</b> Bhoomi Techzone Private Limited &nbsp;|&nbsp; <b>HR:</b> Nicki Verma &nbsp;|&nbsp; <b>Phone:</b> +91 9821724181</span>
              </div>

              <div className="jl-form-grid">

                <div className="jl-field">
                  <label className="jl-label">Letter Date <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={salesOfferLetterForm.letterDate}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, letterDate: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Date of Joining <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={salesOfferLetterForm.joiningDate}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, joiningDate: e.target.value }))} required />
                </div>

                <div className="jl-field jl-full">
                  <label className="jl-label">Candidate Full Name <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Rahul Sharma"
                    value={salesOfferLetterForm.candidateName}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, candidateName: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Position / Designation <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Sales Executive"
                    value={salesOfferLetterForm.position}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, position: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Monthly Salary (Post-Training) <span className="jl-req">*</span></label>
                  <input type="number" className="jl-input" placeholder="e.g. 25000"
                    value={salesOfferLetterForm.salary}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, salary: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Training Period</label>
                  <input type="text" className="jl-input" placeholder="e.g. 15 Days"
                    value={salesOfferLetterForm.trainingPeriod}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, trainingPeriod: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Training Stipend (₹)</label>
                  <input type="number" className="jl-input" placeholder="e.g. 5000"
                    value={salesOfferLetterForm.stipend}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, stipend: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Monthly Sales Target (₹)</label>
                  <input type="text" className="jl-input" placeholder="e.g. 91,000"
                    value={salesOfferLetterForm.salesTarget}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, salesTarget: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Working Days</label>
                  <input type="text" className="jl-input" placeholder="e.g. Monday to Saturday"
                    value={salesOfferLetterForm.workingDays}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, workingDays: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Office Hours</label>
                  <input type="text" className="jl-input" placeholder="e.g. 10:00 AM to 7:00 PM"
                    value={salesOfferLetterForm.officeHours}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, officeHours: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Reporting Time</label>
                  <input type="text" className="jl-input" placeholder="e.g. 09:45 AM"
                    value={salesOfferLetterForm.reportingTime}
                    onChange={e => setSalesOfferLetterForm(f => ({ ...f, reportingTime: e.target.value }))} />
                </div>

              </div>

              <div className="jl-policy-notice">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>Observation period, probation policy, notice period, salary disbursement, and conduct terms are auto-included as per company standard.</span>
              </div>

            </div>

            <div className="jl-modal-footer">
              <button className="jl-btn-cancel" onClick={() => setShowSalesOfferLetterModal(false)}>Cancel</button>
              <button
                className="jl-btn-generate"
                onClick={() => {
                  if (!salesOfferLetterForm.candidateName || !salesOfferLetterForm.position || !salesOfferLetterForm.joiningDate || !salesOfferLetterForm.salary) {
                    alert('Please fill in Candidate Name, Position, Date of Joining, and Monthly Salary.');
                    return;
                  }
                  handleGenerateSalesOfferLetter(salesOfferLetterForm);
                }}
                disabled={generating}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {generating ? 'Generating…' : 'Generate PDF'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── IT Joining Letter Modal ── */}
      {showITJoiningLetterModal && (
        <div className="letters-modal-overlay" onClick={() => setShowITJoiningLetterModal(false)}>
          <div className="jl-modal" onClick={e => e.stopPropagation()}>

            <div className="letters-modal-header">
              <div>
                <div className="letters-modal-title">IT Joining Letter</div>
                <div className="letters-modal-sub">Fill candidate details — company info is pre-filled</div>
              </div>
              <button className="letters-modal-close" onClick={() => setShowITJoiningLetterModal(false)}>×</button>
            </div>

            <div className="jl-modal-body">
              <div className="jl-company-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                <span><b>Company:</b> Bhoomi Techzone Private Limited &nbsp;|&nbsp; <b>HR:</b> Nicki Verma &nbsp;|&nbsp; <b>Phone:</b> +91 9821724181</span>
              </div>

              <div className="jl-form-grid">

                <div className="jl-field">
                  <label className="jl-label">Letter Date <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={itJoiningLetterForm.letterDate}
                    onChange={e => setItJoiningLetterForm(f => ({ ...f, letterDate: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Date of Joining <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={itJoiningLetterForm.joiningDate}
                    onChange={e => setItJoiningLetterForm(f => ({ ...f, joiningDate: e.target.value }))} required />
                </div>

                <div className="jl-field jl-full">
                  <label className="jl-label">Candidate Full Name <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Rahul Sharma"
                    value={itJoiningLetterForm.candidateName}
                    onChange={e => setItJoiningLetterForm(f => ({ ...f, candidateName: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Position / Designation <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Software Developer"
                    value={itJoiningLetterForm.position}
                    onChange={e => setItJoiningLetterForm(f => ({ ...f, position: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Monthly Salary (CTC) <span className="jl-req">*</span></label>
                  <input type="number" className="jl-input" placeholder="e.g. 25000"
                    value={itJoiningLetterForm.salary}
                    onChange={e => setItJoiningLetterForm(f => ({ ...f, salary: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Working Hours</label>
                  <input type="text" className="jl-input" placeholder="e.g. 10:00 AM – 7:00 PM"
                    value={itJoiningLetterForm.workingHours}
                    onChange={e => setItJoiningLetterForm(f => ({ ...f, workingHours: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Probation Period</label>
                  <input type="text" className="jl-input" placeholder="e.g. 1 Month"
                    value={itJoiningLetterForm.probationPeriod}
                    onChange={e => setItJoiningLetterForm(f => ({ ...f, probationPeriod: e.target.value }))} />
                </div>

              </div>

              {/* Late Arrival Policy Section */}
              <div className="jl-policy-section">
                <div className="jl-policy-header">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  <span>Late Arrival Policy Times (Optional)</span>
                </div>
                <div className="jl-form-grid" style={{ marginTop: 10 }}>
                  <div className="jl-field">
                    <label className="jl-label">Late Threshold</label>
                    <input type="text" className="jl-input" placeholder="e.g. 10:15 AM"
                      value={itJoiningLetterForm.lateThreshold}
                      onChange={e => setItJoiningLetterForm(f => ({ ...f, lateThreshold: e.target.value }))} />
                  </div>
                  <div className="jl-field">
                    <label className="jl-label">Full Day After</label>
                    <input type="text" className="jl-input" placeholder="e.g. 12:00 PM"
                      value={itJoiningLetterForm.fullDayAfter}
                      onChange={e => setItJoiningLetterForm(f => ({ ...f, fullDayAfter: e.target.value }))} />
                  </div>
                  <div className="jl-field">
                    <label className="jl-label">Half-Day Start</label>
                    <input type="text" className="jl-input" placeholder="e.g. 10:30 AM"
                      value={itJoiningLetterForm.halfDayStart}
                      onChange={e => setItJoiningLetterForm(f => ({ ...f, halfDayStart: e.target.value }))} />
                  </div>
                  <div className="jl-field">
                    <label className="jl-label">Half-Day End</label>
                    <input type="text" className="jl-input" placeholder="e.g. 12:00 PM"
                      value={itJoiningLetterForm.halfDayEnd}
                      onChange={e => setItJoiningLetterForm(f => ({ ...f, halfDayEnd: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="jl-policy-notice">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>Notice Period, Performance, Employment &amp; Leave policies are auto-included as per company standard.</span>
              </div>

            </div>

            <div className="jl-modal-footer">
              <button className="jl-btn-cancel" onClick={() => setShowITJoiningLetterModal(false)}>Cancel</button>
              <button
                className="jl-btn-generate"
                onClick={() => {
                  if (!itJoiningLetterForm.candidateName || !itJoiningLetterForm.position || !itJoiningLetterForm.joiningDate || !itJoiningLetterForm.salary) {
                    alert('Please fill in Candidate Name, Position, Date of Joining, and Monthly Salary.');
                    return;
                  }
                  handleGenerateITJoiningLetter(itJoiningLetterForm);
                }}
                disabled={generating}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {generating ? 'Generating…' : 'Generate PDF'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Exit Certificate Modal ── */}
      {showExitLetterModal && (
        <div className="letters-modal-overlay" onClick={() => setShowExitLetterModal(false)}>
          <div className="jl-modal" onClick={e => e.stopPropagation()}>
            <div className="letters-modal-header">
              <div>
                <div className="letters-modal-title">Employee Exit Certificate</div>
                <div className="letters-modal-sub">Fill employee details — company info is pre-filled</div>
              </div>
              <button className="letters-modal-close" onClick={() => setShowExitLetterModal(false)}>×</button>
            </div>
            <div className="jl-modal-body">
              <div className="jl-company-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                <span><b>Company:</b> Bhoomi Techzone Private Limited &nbsp;|&nbsp; <b>HR:</b> Nicki Verma &nbsp;|&nbsp; <b>Phone:</b> +91 9211947852</span>
              </div>
              <div className="jl-form-grid">
                <div className="jl-field">
                  <label className="jl-label">Letter Date <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={exitLetterForm.letterDate}
                    onChange={e => setExitLetterForm(f => ({ ...f, letterDate: e.target.value }))} required />
                </div>
                <div className="jl-field">
                  <label className="jl-label">Salutation</label>
                  <select className="jl-input" value={exitLetterForm.salutation}
                    onChange={e => setExitLetterForm(f => ({ ...f, salutation: e.target.value }))}>
                    <option value="Ms.">Ms.</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Miss">Miss</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Employee Full Name <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Arzu Mehreen"
                    value={exitLetterForm.candidateName}
                    onChange={e => setExitLetterForm(f => ({ ...f, candidateName: e.target.value }))} required />
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Position / Designation <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Web Developer"
                    value={exitLetterForm.position}
                    onChange={e => setExitLetterForm(f => ({ ...f, position: e.target.value }))} required />
                </div>
                <div className="jl-field">
                  <label className="jl-label">Date of Joining <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={exitLetterForm.dateOfJoining}
                    onChange={e => setExitLetterForm(f => ({ ...f, dateOfJoining: e.target.value }))} required />
                </div>
                <div className="jl-field">
                  <label className="jl-label">Date of Relieving <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={exitLetterForm.dateOfRelieving}
                    onChange={e => setExitLetterForm(f => ({ ...f, dateOfRelieving: e.target.value }))} required />
                </div>
              </div>
            </div>
            <div className="jl-modal-footer">
              <button className="jl-btn-cancel" onClick={() => setShowExitLetterModal(false)}>Cancel</button>
              <button
                className="jl-btn-generate"
                onClick={() => {
                  if (!exitLetterForm.candidateName || !exitLetterForm.position || !exitLetterForm.dateOfJoining || !exitLetterForm.dateOfRelieving) {
                    alert('Please fill in Employee Name, Position, Date of Joining, and Date of Relieving.');
                    return;
                  }
                  handleGenerateExitLetter(exitLetterForm);
                }}
                disabled={generating}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {generating ? 'Generating…' : 'Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── NDA Modal ── */}
      {showNDAModal && (
        <div className="letters-modal-overlay" onClick={() => setShowNDAModal(false)}>
          <div className="jl-modal" onClick={e => e.stopPropagation()}>
            <div className="letters-modal-header">
              <div>
                <div className="letters-modal-title">Generate NDA</div>
                <div className="letters-modal-sub">Fill employee details to generate the Non-Disclosure Agreement</div>
              </div>
              <button className="letters-modal-close" onClick={() => setShowNDAModal(false)}>&times;</button>
            </div>
            <div className="jl-modal-body">
              <div style={{ marginBottom: '14px', position: 'relative' }}>
                <label className="jl-label" style={{ marginBottom: '5px', display: 'block' }}>
                  Auto-fill from Employee (Optional)
                </label>
                <input
                  type="text"
                  className="jl-input"
                  placeholder="Search existing employee to auto-fill details..."
                  value={ndaEmpSearch}
                  onChange={(e) => {
                    setNdaEmpSearch(e.target.value);
                    setNdaEmpDropdownOpen(true);
                  }}
                  onFocus={() => setNdaEmpDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setNdaEmpDropdownOpen(false), 200)}
                />
                {ndaEmpDropdownOpen && employees.filter(e =>
                  `${e.firstName} ${e.lastName}`.toLowerCase().includes(ndaEmpSearch.toLowerCase()) ||
                  (e.designation || '').toLowerCase().includes(ndaEmpSearch.toLowerCase())
                ).length > 0 && (
                  <div className="letters-emp-list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                    {employees.filter(e =>
                      `${e.firstName} ${e.lastName}`.toLowerCase().includes(ndaEmpSearch.toLowerCase()) ||
                      (e.designation || '').toLowerCase().includes(ndaEmpSearch.toLowerCase())
                    ).slice(0, 8).map(emp => (
                      <div
                        key={emp._id}
                        className="letters-emp-item"
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' }}
                        onMouseDown={() => {
                          const fullName = `${emp.firstName} ${emp.lastName}`.trim();
                          const honorific = emp.gender === 'female' ? 'Ms.' : emp.gender === 'male' ? 'Mr.' : 'Mr.';
                          const doj = emp.joiningDate ? new Date(emp.joiningDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
                          const addr = emp.address || emp.currentAddress || emp.permanentAddress || '';
                          const father = emp.fatherName || emp.emergencyContactName || '';
                          setNdaForm(f => ({
                            ...f,
                            salutation: honorific,
                            employeeName: fullName,
                            fathersName: father,
                            fullAddress: addr,
                            mobileNo: emp.phone || emp.mobile || f.mobileNo,
                            emailId: emp.email || f.emailId,
                            designation: emp.designation || f.designation,
                            joiningDate: doj,
                            employeeId: emp._id,
                          }));
                          setNdaEmpSearch(fullName);
                          setNdaEmpDropdownOpen(false);
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '13px', color: '#1e293b' }}>{emp.firstName} {emp.lastName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{emp.designation || 'Employee'}{emp.department ? ` · ${emp.department}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="jl-form-grid">
                <div className="jl-field">
                  <label className="jl-label">Salutation</label>
                  <select className="jl-input" value={ndaForm.salutation}
                    onChange={e => setNdaForm(f => ({ ...f, salutation: e.target.value }))}>
                    <option value="Mr.">Mr.</option>
                    <option value="Ms.">Ms.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Miss">Miss</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Employee Full Name <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Rahul Sharma"
                    value={ndaForm.employeeName}
                    onChange={e => setNdaForm(f => ({ ...f, employeeName: e.target.value }))} required />
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Father's Name <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Ramesh Sharma"
                    value={ndaForm.fathersName}
                    onChange={e => setNdaForm(f => ({ ...f, fathersName: e.target.value }))} required />
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Full Address <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. 123, Main Street, Delhi - 110001"
                    value={ndaForm.fullAddress}
                    onChange={e => setNdaForm(f => ({ ...f, fullAddress: e.target.value }))} required />
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Mobile Number <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. 9876543210"
                    value={ndaForm.mobileNo}
                    onChange={e => setNdaForm(f => ({ ...f, mobileNo: e.target.value }))} required />
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Email ID <span className="jl-req">*</span></label>
                  <input type="email" className="jl-input" placeholder="e.g. rahul@example.com"
                    value={ndaForm.emailId}
                    onChange={e => setNdaForm(f => ({ ...f, emailId: e.target.value }))} required />
                </div>
                <div className="jl-field jl-full">
                  <label className="jl-label">Designation <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Software Developer"
                    value={ndaForm.designation}
                    onChange={e => setNdaForm(f => ({ ...f, designation: e.target.value }))} required />
                </div>
                <div className="jl-field">
                  <label className="jl-label">Date of Joining <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={ndaForm.joiningDate}
                    onChange={e => setNdaForm(f => ({ ...f, joiningDate: e.target.value }))} required />
                </div>
              </div>
            </div>
            <div className="jl-modal-footer">
              <button className="jl-btn-cancel" onClick={() => setShowNDAModal(false)}>Cancel</button>
              <button
                className="jl-btn-generate"
                onClick={handleGenerateNDA}
                disabled={generating || !ndaForm.employeeName || !ndaForm.fathersName || !ndaForm.fullAddress || !ndaForm.designation || !ndaForm.mobileNo || !ndaForm.emailId}
              >
                {generating ? (
                  <svg className="letters-btn-spinner" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" />
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
                {generating ? 'Generating NDA…' : 'Generate NDA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Experience Letter Modal ── */}
      {showExperienceLetterModal && (
        <div className="letters-modal-overlay" onClick={() => setShowExperienceLetterModal(false)}>
          <div className="jl-modal" onClick={e => e.stopPropagation()}>

            <div className="letters-modal-header">
              <div>
                <div className="letters-modal-title">Experience Cum Relieving Letter</div>
                <div className="letters-modal-sub">Fill candidate details — company info is pre-filled</div>
              </div>
              <button className="letters-modal-close" onClick={() => setShowExperienceLetterModal(false)}>&times;</button>
            </div>

            <div className="jl-modal-body">

              <div className="jl-company-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                <span><b>Company:</b> Bhoomi Techzone Private Limited &nbsp;|&nbsp; <b>HR:</b> Nicki Verma &nbsp;|&nbsp; <b>Phone:</b> +91 9211947852</span>
              </div>

              <div className="jl-form-grid">

                <div className="jl-field">
                  <label className="jl-label">Letter Date <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={experienceLetterForm.letterDate}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, letterDate: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Salutation</label>
                  <select className="jl-input" value={experienceLetterForm.salutation}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, salutation: e.target.value }))}>
                    <option value="Ms.">Ms.</option>
                    <option value="Mr.">Mr.</option>
                    <option value="Mrs.">Mrs.</option>
                    <option value="Dr.">Dr.</option>
                  </select>
                </div>

                <div className="jl-field jl-full">
                  <label className="jl-label">Candidate Full Name <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Arzu Mehreen"
                    value={experienceLetterForm.candidateName}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, candidateName: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Position / Designation <span className="jl-req">*</span></label>
                  <input type="text" className="jl-input" placeholder="e.g. Python Developer"
                    value={experienceLetterForm.position}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, position: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Department</label>
                  <input type="text" className="jl-input" placeholder="e.g. IT / Sales"
                    value={experienceLetterForm.department}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, department: e.target.value }))} />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Date of Joining <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={experienceLetterForm.dateOfJoining}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, dateOfJoining: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Date of Relieving <span className="jl-req">*</span></label>
                  <input type="date" className="jl-input" value={experienceLetterForm.dateOfRelieving}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, dateOfRelieving: e.target.value }))} required />
                </div>

                <div className="jl-field">
                  <label className="jl-label">Reason for Resignation</label>
                  <input type="text" className="jl-input" placeholder="e.g. Growth / Personal"
                    value={experienceLetterForm.reasonForResignation}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, reasonForResignation: e.target.value }))} />
                </div>

                <div className="jl-field jl-full">
                  <label className="jl-label">Key Responsibilities (one per line) <span className="jl-req">*</span></label>
                  <textarea className="jl-input" rows={6} placeholder={"Developed and maintained backend applications...\nCollaborated with cross-functional teams...\nParticipated in code reviews and deployments..."}
                    value={experienceLetterForm.responsibilities}
                    onChange={e => setExperienceLetterForm(f => ({ ...f, responsibilities: e.target.value }))}
                    style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }} />
                </div>

              </div>
            </div>

            <div className="jl-modal-footer">
              <button className="jl-btn-cancel" onClick={() => setShowExperienceLetterModal(false)}>Cancel</button>
              <button
                className="jl-btn-generate"
                onClick={() => {
                  if (!experienceLetterForm.candidateName || !experienceLetterForm.position || !experienceLetterForm.dateOfJoining || !experienceLetterForm.dateOfRelieving) {
                    alert('Please fill in Candidate Name, Position, Date of Joining, and Date of Relieving.');
                    return;
                  }
                  if (!experienceLetterForm.responsibilities.trim()) {
                    alert('Please enter at least one Key Responsibility.');
                    return;
                  }
                  handleGenerateExperienceLetter(experienceLetterForm);
                }}
                disabled={generating}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {generating ? 'Generating…' : 'Generate PDF'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Floating Actions Menu (Outside Table) ── */}
      {openMenuId && menuRef.current[openMenuId] && (
        <div
          className="letters-kebab-menu"
          onClick={e => e.stopPropagation()}
          style={{
            top: `${menuRef.current[openMenuId].dataset.menuTop}px`,
            left: `${menuRef.current[openMenuId].dataset.menuLeft}px`
          }}
        >
          <button
            className="letters-kebab-item"
            onClick={() => {
              setOpenMenuId(null);
              const doc = paginatedDocs.find(d => d._id === openMenuId);
              if (doc) {
                const win = window.open('', '_blank', 'width=900,height=1150');
                if (win) {
                  win.document.write(doc.finalHtml || '<p>No content available</p>');
                  win.document.close();
                }
              }
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Preview
          </button>
          {canCreate && (() => {
            const doc = paginatedDocs.find(d => d._id === openMenuId);
            const isNda = doc && (
              doc.metadata?.templateName?.toLowerCase().includes('nda') ||
              doc.metadata?.templateName?.toLowerCase().includes('disclosure') ||
              doc.title?.toLowerCase().includes('nda')
            );
            if (isNda) {
              return (
                <button
                  className="letters-kebab-item"
                  onClick={async () => {
                    setOpenMenuId(null);
                    try {
                      const docxBlob = await generateNDADocx(doc.placeholderData || {
                        employeeName: doc.metadata?.clientName,
                        designation: doc.metadata?.position,
                        joiningDate: doc.metadata?.joiningDate,
                        fullAddress: doc.metadata?.location,
                      });
                      saveAs(docxBlob, `NDA_${doc.metadata?.clientName || 'Employee'}.docx`);
                    } catch (err) {
                      alert('Error downloading DOCX: ' + err.message);
                    }
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Download Word (.docx)
                </button>
              );
            }
            return (
              <button
                className="letters-kebab-item"
                onClick={() => { setOpenMenuId(null); handleDownload(openMenuId); }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download PDF
              </button>
            );
          })()}











          {canUpdate && <button
            className="letters-kebab-item"
            onClick={() => {
              const doc = paginatedDocs.find(d => d._id === openMenuId);
              setOpenMenuId(null);
              if (!doc) return;
              setEditingDocId(doc._id);
              const pd = doc.placeholderData || {};
              const templateName = doc.metadata?.templateName || '';
              if (Object.keys(pd).length > 0) {
                if (templateName === 'Sales Joining Letter') {
                  setJoiningLetterForm({ ...pd });
                  setShowJoiningLetterModal(true);
                  return;
                }
                if (templateName === 'IT Offer Letter') {
                  setItOfferLetterForm({ ...pd });
                  setShowITOfferLetterModal(true);
                  return;
                }
                if (templateName === 'Sales Offer Letter') {
                  setSalesOfferLetterForm({ ...pd });
                  setShowSalesOfferLetterModal(true);
                  return;
                }
                if (templateName === 'IT Joining Letter') {
                  setItJoiningLetterForm({ ...pd });
                  setShowITJoiningLetterModal(true);
                  return;
                }
                if (templateName === 'Experience Letter' || templateName === 'Experience Cum Relieving Letter') {
                  setExperienceLetterForm({ ...pd });
                  setShowExperienceLetterModal(true);
                  return;
                }
                if (templateName === 'Exit Certificate' || templateName === 'Employee Exit Certificate') {
                  setExitLetterForm({ ...pd });
                  setShowExitLetterModal(true);
                  return;
                }
                if (templateName === 'Non-Disclosure Agreement' || templateName === 'NDA' || templateName.toLowerCase().includes('nda') || templateName.toLowerCase().includes('disclosure')) {
                  setNdaForm({ ...pd });
                  setShowNDAModal(true);
                  return;
                }
              }
              // Fallback: raw HTML editor
              setEditingHtml(doc.finalHtml || '');
              setIsEditingDoc(true);
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </button>}
          {canDelete && <button
            className="letters-kebab-item letters-kebab-delete"
            onClick={() => { setOpenMenuId(null); handleDelete(openMenuId); }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>}
        </div>
      )}

      {/* ── Edit Document Modal ── */}
      {isEditingDoc && (
        <div className="letters-modal-overlay" onClick={() => !savingEdit && setIsEditingDoc(false)} style={{ zIndex: 9999 }}>
          <div className="letters-modal-content" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="letters-modal-header" style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="letters-modal-title" style={{ fontSize: 18, fontWeight: 600, color: '#0f172a' }}>Edit Generated Letter</div>
                <div className="letters-modal-sub" style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Modify text directly on the document below</div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="docgen-btn-ghost" onClick={() => setIsEditingDoc(false)} disabled={savingEdit} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: 'pointer', background: '#fff', color: '#475569', fontWeight: 500 }}>Cancel</button>
                <button className="docgen-btn-primary" onClick={handleSaveEdit} disabled={savingEdit} style={{ padding: '6px 16px', borderRadius: 6, background: '#166534', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 500 }}>
                  {savingEdit ? 'Saving...' : 'Save & Update PDF'}
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
              <div
                className="docgen-preview-paper"
                style={{ background: '#fff', padding: '40px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', width: '100%', maxWidth: '210mm', minHeight: '297mm', outline: 'none' }}
                contentEditable={true}
                suppressContentEditableWarning={true}
                onBlur={(e) => setEditingHtml(e.target.innerHTML)}
                dangerouslySetInnerHTML={{ __html: editingHtml }}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Letters;
