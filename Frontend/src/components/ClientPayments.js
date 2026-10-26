import React, { useState, useEffect, useMemo, useRef } from "react";
import "./ClientPayments.css";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useContextualQueryState } from "../utils/routeUtils";
import ProjectPaymentHistoryModal from "./ProjectPaymentHistoryModal";

// Icons
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const InvoiceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <line x1="8" y1="9" x2="10" y2="9" />
  </svg>
);

const DeleteIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

function ClientPayments() {
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role?.name === 'Admin';
  const canCreate = hasPermission?.('accounts', 'create');
  const canDelete = hasPermission?.('accounts', 'delete');
  const canEdit = hasPermission?.('accounts', 'update') || hasPermission?.('projects', 'update');

  const [{ tab: queryTab, status: statusFilter, search: searchTerm, page: currentPage }, setQueryState] = useContextualQueryState({
    ref: 'sidebar',
    tab: 'payments',
    status: 'all',
    search: '',
    page: 1,
  });

  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || queryTab;
    return tab === 'invoices' ? 'invoices' : 'payments';
  });

  useEffect(() => {
    if (queryTab === 'invoices' || queryTab === 'payments') {
      setActiveTab(queryTab);
    }
  }, [queryTab]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setQueryState((prev) => ({ ...prev, tab, page: 1 }));
  };

  const setSearchTerm = (search) => setQueryState({ search, page: 1 });
  const setStatusFilter = (status) => setQueryState({ status, page: 1 });
  const setCurrentPage = (page) => setQueryState((prev) => ({ page: typeof page === 'function' ? page(prev.page || 1) : page }));

  const [paymentData, setPaymentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prevMonthData, setPrevMonthData] = useState([]);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [invoiceCurrentPage, setInvoiceCurrentPage] = useState(1);
  const [customInvoices, setCustomInvoices] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('generated_invoices_list') || '[]');
      const seen = new Set();
      return (Array.isArray(raw) ? raw : []).filter(item => {
        const key = String(item.invoiceNo || item.id || '').trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch {
      return [];
    }
  });
  const ITEMS_PER_PAGE = 10;

  // Get display name of the currently logged-in user
  const getLoggedInUserDisplayName = () => {
    if (user) {
      const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || user.name || user.email || 'Admin';
      const empId = user.employeeId || user.empId ? `(${user.employeeId || user.empId})` : '';
      return `${name} ${empId}`.trim();
    }
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const name = `${stored.firstName || ''} ${stored.lastName || ''}`.trim() || stored.username || stored.name || stored.email || 'Admin';
      const empId = stored.employeeId || stored.empId ? `(${stored.employeeId || stored.empId})` : '';
      return `${name} ${empId}`.trim();
    } catch {
      return 'Admin';
    }
  };

  // DD-MM-YYYY Date Formatter
  const formatDDMMYYYY = (dateVal) => {
    if (!dateVal) return '-';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Colorful pill badge style generator for clients
  const getClientBadgeStyle = (name) => {
    if (!name || name === '-') return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
    const palette = [
      { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' }, // Blue
      { bg: '#fdf4ff', color: '#a21caf', border: '#f5d0fe' }, // Fuchsia
      { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' }, // Green
      { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' }, // Orange
      { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' }, // Purple
      { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' }, // Cyan
      { bg: '#fff1f2', color: '#be123c', border: '#fecdd3' }, // Rose
      { bg: '#fefce8', color: '#a16207', border: '#fef08a' }, // Amber
      { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe' }, // Indigo
      { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' }, // Teal
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % palette.length;
    return palette[index];
  };

  // Professional pill styles generator for payment status
  const getPaymentPillStyles = (status) => {
    const norm = String(status || 'unpaid').toLowerCase();
    if (norm === 'paid') {
      return {
        bg: '#dcfce7',
        color: '#15803d',
        border: '#86efac',
        dot: '#22c55e',
        chevron: '%2315803d'
      };
    }
    if (norm.includes('part')) {
      return {
        bg: '#fef3c7',
        color: '#b45309',
        border: '#fcd34d',
        dot: '#f59e0b',
        chevron: '%23b45309'
      };
    }
    return {
      bg: '#fee2e2',
      color: '#b91c1c',
      border: '#fca5a5',
      dot: '#ef4444',
      chevron: '%23b91c1c'
    };
  };

  // Fetch payment data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, invoicesRes] = await Promise.allSettled([
        api.get('/projects'),
        api.get('/invoices')
      ]);

      // Transform projects data to include payment information
      const projects = projectsRes.status === 'fulfilled' ? (projectsRes.value.data || []) : [];
      let dbInvoices = invoicesRes.status === 'fulfilled' ? (invoicesRes.value.data || []) : [];

      // If local storage has invoices not yet in db, sync them to backend once
      try {
        const localRaw = JSON.parse(localStorage.getItem('generated_invoices_list') || '[]');
        if (Array.isArray(localRaw) && localRaw.length > 0) {
          const dbNos = new Set(dbInvoices.map(i => String(i.invoiceNo || '').trim().toLowerCase()));
          const unSynced = localRaw.filter(i => {
            const no = String(i.invoiceNo || i.id || '').trim().toLowerCase();
            return no && !dbNos.has(no);
          });
          if (unSynced.length > 0) {
            await api.post('/invoices/bulk-sync', { invoices: unSynced });
            const refetched = await api.get('/invoices');
            if (refetched.data) {
              dbInvoices = refetched.data;
            }
          }
        }
      } catch (syncErr) {
        console.warn('Sync invoices error:', syncErr);
      }

            // Merge dbInvoices and local storage so any newly created local invoices are always preserved
      const mergedInvoices = [...dbInvoices];
      const knownNos = new Set(dbInvoices.map(i => String(i.invoiceNo || i.id || '').trim().toLowerCase()));
      try {
        const localRaw = JSON.parse(localStorage.getItem('generated_invoices_list') || '[]');
        if (Array.isArray(localRaw)) {
          localRaw.forEach(loc => {
            const locNo = String(loc.invoiceNo || loc.id || '').trim().toLowerCase();
            if (locNo && !knownNos.has(locNo)) {
              mergedInvoices.push(loc);
              knownNos.add(locNo);
            }
          });
        }
      } catch (e) {}

      if (mergedInvoices.length > 0) {
        setCustomInvoices(mergedInvoices);
        try {
          localStorage.setItem('generated_invoices_list', JSON.stringify(mergedInvoices));
        } catch (e) {}
      }

      const paymentsWithData = projects.map((project, index) => {
        const baseAmount = project.projectValue || project.budget || project.totalAmount || 0;
        const paidAmount = project.paidAmount || 0;
        
        // Derive payment status
        let derivedPaymentStatus = project.paymentStatus;
        if (!derivedPaymentStatus) {
          if (baseAmount <= 0) derivedPaymentStatus = 'Paid';
          else if (paidAmount >= baseAmount) derivedPaymentStatus = 'Paid';
          else if (paidAmount > 0) derivedPaymentStatus = 'Partially Paid';
          else derivedPaymentStatus = 'Unpaid';
        }
        
        return {
          id: project.projectId || `PRJ${String(index + 1).padStart(4, '0')}`,
          _id: project._id, // Store MongoDB ObjectId for delete/edit operations
          clientName: project.clientName || project.client?.name || '-',
          email: project.clientEmail || project.client?.email || '-',
          phone: project.clientPhone || project.client?.phone || '-',
          clientAddress: project.clientAddress || project.client?.companyAddress?.address || project.client?.personalAddress?.city || '',
          clientCity: project.clientCity || project.client?.companyAddress?.city || project.client?.personalAddress?.city || '',
          clientPostalCode: project.clientPostalCode || project.client?.companyAddress?.postalCode || project.client?.personalAddress?.postalCode || '',
          clientState: project.clientState || project.client?.companyAddress?.state || project.client?.personalAddress?.state || '',
          clientGstin: project.clientGstin || project.client?.gstNo || '',
          clientPan: project.clientPan || project.client?.registrationNo || '',
          projectName: project.projectName || project.name || 'Untitled Project',
          projectStatus: project.status === 'active' ? 'Active' :
            project.status === 'completed' ? 'Completed' :
              project.status === 'on-hold' ? 'On Hold' :
                project.status || 'Active',
          paymentStatus: derivedPaymentStatus,
          baseAmount: baseAmount,
          rate: baseAmount,
          totalAmount: baseAmount,
          paidAmount: paidAmount,
          description: project.description || '',
          itemDetails: project.description || '',
          hsnSac: project.hsnSac || '9975',
          gstType: project.gstType || 'cgst_sgst',
          gstRate: project.gstRate !== undefined ? project.gstRate : '18',
          createdAt: project.createdAt || new Date().toISOString()
        };
      });

      setPaymentData(paymentsWithData);

      // Calculate previous month data for trend comparison
      const lastMonthStart = new Date();
      lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
      lastMonthStart.setDate(1);
      lastMonthStart.setHours(0, 0, 0, 0);

      const lastMonthEnd = new Date();
      lastMonthEnd.setDate(0);
      lastMonthEnd.setHours(23, 59, 59, 999);

      const prevMonthProjects = paymentsWithData.filter((payment) => {
        const createdDate = new Date(payment.createdAt);
        return createdDate >= lastMonthStart && createdDate <= lastMonthEnd;
      });

      setPrevMonthData(prevMonthProjects);
    } catch (err) {
      console.error('Error fetching data:', err);
      // Use mock data if API fails
      setPaymentData([
        { id: 'PM001', clientName: 'Amit Sharma', email: 'amit.sharma@example.com', phone: '+91 9876543210', projectName: 'CRM Setup', projectStatus: 'Active', totalAmount: 150000, paidAmount: 100000 },
        { id: 'PM002', clientName: 'Neha Verma', email: 'neha.verma@example.com', phone: '+91 9876543211', projectName: 'Website Revamp', projectStatus: 'In Progress', totalAmount: 200000, paidAmount: 150000 },
        { id: 'PM003', clientName: 'Rohit Mehra', email: 'rohit.mehra@example.com', phone: '+91 9876543212', projectName: 'Lead Automation', projectStatus: 'Completed', totalAmount: 120000, paidAmount: 120000 },
        { id: 'PM004', clientName: 'Priya Singh', email: 'priya.singh@example.com', phone: '+91 9876543213', projectName: 'Mobile App Development', projectStatus: 'Active', totalAmount: 350000, paidAmount: 200000 },
        { id: 'PM005', clientName: 'Vikram Patel', email: 'vikram.patel@example.com', phone: '+91 9876543214', projectName: 'E-commerce Platform', projectStatus: 'In Progress', totalAmount: 280000, paidAmount: 80000 },
      ]);
      setPrevMonthData([]);
    } finally {
      setLoading(false);
    }
  };

  // Unique payment statuses
  const uniqueStatuses = useMemo(() => {
    return ['Paid', 'Partially Paid', 'Unpaid'];
  }, []);

  // Filter and search
  const filteredData = useMemo(() => {
    return paymentData.filter(payment => {
      const query = (searchTerm || '').trim().toLowerCase();
      
      const clientName = String(payment.clientName || '').toLowerCase();
      const email = String(payment.email || '').toLowerCase();
      const phone = String(payment.phone || '').toLowerCase();
      const projectName = String(payment.projectName || '').toLowerCase();
      const id = String(payment.id || '').toLowerCase();
      const payStatus = String(payment.paymentStatus || '').toLowerCase();
      const projStatus = String(payment.projectStatus || '').toLowerCase();

      const matchesSearch = !query ||
        clientName.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        projectName.includes(query) ||
        id.includes(query) ||
        payStatus.includes(query) ||
        projStatus.includes(query);

      const matchesStatus = !statusFilter || statusFilter.toLowerCase() === 'all' || 
        payStatus === statusFilter.toLowerCase() ||
        (statusFilter.toLowerCase() === 'partial' && payStatus === 'partially paid');

      return matchesSearch && matchesStatus;
    });
  }, [paymentData, searchTerm, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Calculate stats
  const stats = {
    total: paymentData.length,
    totalRevenue: paymentData.reduce((sum, p) => sum + p.totalAmount, 0),
    totalPaid: paymentData.reduce((sum, p) => sum + p.paidAmount, 0),
    pending: paymentData.reduce((sum, p) => sum + (p.totalAmount - p.paidAmount), 0)
  };

  // Calculate previous month stats for trends
  const prevMonthStats = {
    total: prevMonthData.length,
    totalRevenue: prevMonthData.reduce((sum, p) => sum + p.totalAmount, 0),
    totalPaid: prevMonthData.reduce((sum, p) => sum + p.paidAmount, 0),
    pending: prevMonthData.reduce((sum, p) => sum + (p.totalAmount - p.paidAmount), 0)
  };

  // Trend calculation functions
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  const getTrendDirection = (current, previous) => {
    return current >= previous;
  };

  const totalChange = calculateChange(stats.total, prevMonthStats.total);
  const revenueChange = calculateChange(stats.totalRevenue, prevMonthStats.totalRevenue);
  const paidChange = calculateChange(stats.totalPaid, prevMonthStats.totalPaid);
  const pendingChange = calculateChange(stats.pending, prevMonthStats.pending);

  const totalTrend = getTrendDirection(stats.total, prevMonthStats.total);
  const revenueTrend = getTrendDirection(stats.totalRevenue, prevMonthStats.totalRevenue);
  const paidTrend = getTrendDirection(stats.totalPaid, prevMonthStats.totalPaid);
  const pendingTrend = getTrendDirection(stats.pending, prevMonthStats.pending);

  // Export to Excel-compatible CSV for Payment Records
  const handleExportPayments = () => {
    const escapeCell = (val) => {
      const str = val === null || val === undefined ? '' : String(val);
      return '"' + str.replace(/"/g, '""') + '"';
    };
    const headers = [
      'Project ID',
      'Client Name',
      'Client Email',
      'Client Phone',
      'Project Name',
      'Project Status',
      'Total Amount (₹)',
      'Paid Amount (₹)',
      'Due Amount (₹)',
      'Payment Status',
      'Payment %'
    ];
    const rows = filteredData.map(p => {
      const total = Math.round(p.totalAmount || 0);
      const paid = Math.round(p.paidAmount || 0);
      const due = Math.max(0, total - paid);
      const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
      const paymentStatus = (paid >= total && total > 0) ? 'Fully Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid');
      return [
        p.id,
        p.clientName,
        p.email || '-',
        p.phone || '-',
        p.projectName,
        p.projectStatus,
        total,
        paid,
        due,
        paymentStatus,
        pct + '%'
      ];
    });

    const csvContent =
      '\uFEFF' + // UTF-8 BOM so Excel opens with correct encoding
      [headers, ...rows]
        .map(row => row.map(escapeCell).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-records-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Compile all generated invoices with strict deduplication
  const allInvoices = useMemo(() => {
    const seen = new Set();
    const result = [];

    customInvoices.forEach((ci) => {
      const invNoClean = String(ci.invoiceNo || ci.id || '').trim().replace(/^INV-PRJPRJ/i, 'INV-PRJ');
      const dedupeKey = invNoClean.toLowerCase();
      if (!dedupeKey || seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      const isProf = ci.invoiceCategory === 'proforma' || invNoClean.startsWith('PI/');
      
      // Look for corresponding project in paymentData
      const proj = paymentData.find(p => 
        (ci.prefillProjectId && p._id === ci.prefillProjectId) ||
        (ci.id && (p.id === ci.id || p.id === String(ci.id).replace(/^INV-/, '') || p.id === String(ci.id).replace(/^INV-PRJPRJ/, 'PRJ') || p.id === String(ci.id).replace(/^INV-PRJ/, 'PRJ'))) ||
        (ci.invoiceNo && (p.id && (ci.invoiceNo.includes(p.id) || ci.invoiceNo.replace(/INV-PRJPRJ/i, 'PRJ').includes(p.id))))
      );

      const clientName = (ci.clientName && ci.clientName !== '-' && ci.clientName !== 'Client' && ci.clientName !== 'Unknown')
        ? ci.clientName
        : (proj && proj.clientName !== '-' ? proj.clientName : (ci.clientName || 'Client'));

      const projectName = (ci.projectName && ci.projectName !== '-' && ci.projectName !== 'Custom Invoice')
        ? ci.projectName
        : (proj?.projectName || ci.itemDescription || '-');

      result.push({
        ...ci,
        srNo: result.length + 1,
        invoiceNo: invNoClean || ci.invoiceNo,
        invoiceCategory: isProf ? 'proforma' : 'tax',
        invoiceType: isProf ? 'Proforma Invoice' : 'Tax Invoice',
        generatedOn: ci.generatedOn || ci.createdAt || ci.invoiceDate || new Date().toISOString(),
        generatedBy: ci.generatedBy || ci.rawForm?.generatedBy || (proj?.createdBy ? (typeof proj.createdBy === 'object' ? `${proj.createdBy.firstName || ''} ${proj.createdBy.lastName || ''}`.trim() : null) : null) || 'Admin',
        clientName: clientName,
        clientAddress: ci.clientAddress || ci.rawForm?.clientAddress || proj?.clientAddress || '',
        clientCity: ci.clientCity || ci.rawForm?.clientCity || proj?.clientCity || '',
        clientPostalCode: ci.clientPostalCode || ci.rawForm?.clientPostalCode || proj?.clientPostalCode || '',
        clientState: ci.clientState || ci.rawForm?.clientState || proj?.clientState || '',
        clientGstin: ci.clientGstin || ci.rawForm?.clientGstin || proj?.clientGstin || '',
        clientPan: ci.clientPan || ci.rawForm?.clientPan || proj?.clientPan || '',
        projectName: projectName,
        itemDescription: ci.itemDescription || projectName,
        itemDetails: ci.itemDetails || ci.description || ci.rawForm?.itemDetails || ci.rawForm?.description || proj?.description || '',
        description: ci.itemDetails || ci.description || ci.rawForm?.itemDetails || ci.rawForm?.description || proj?.description || '',
        hsnSac: ci.hsnSac || ci.rawForm?.hsnSac || proj?.hsnSac || '9975',
        qty: ci.qty || ci.rawForm?.qty || '1',
        rate: (() => {
          let r = ci.rate !== undefined && ci.rate !== '' ? ci.rate : (ci.rawForm?.rate !== undefined ? ci.rawForm.rate : (ci.baseAmount !== undefined ? ci.baseAmount : (proj?.baseAmount !== undefined ? proj.baseAmount : (ci.totalAmount || 0))));
          if (proj && proj.baseAmount && (parseFloat(r) === proj.totalAmount || parseFloat(r) === Math.round(proj.baseAmount * 1.18))) {
            r = proj.baseAmount;
          }
          return r;
        })(),
        discount: ci.discount || ci.rawForm?.discount || '0',
        gstType: ci.gstType || ci.rawForm?.gstType || proj?.gstType || 'cgst_sgst',
        gstRate: ci.gstRate || ci.rawForm?.gstRate || proj?.gstRate || '18',
        advanceAmount: ci.advanceAmount !== undefined ? ci.advanceAmount : (ci.rawForm?.advanceAmount !== undefined ? ci.rawForm.advanceAmount : (ci.paidAmount !== undefined ? ci.paidAmount : (proj?.paidAmount || 0))),
        status: ci.status || 'Generated',
        isCustom: true
      });
    });

    return result;
  }, [customInvoices, paymentData]);

  // Filter and search invoices
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter(inv => {
      const search = invoiceSearchTerm.toLowerCase();
      const matchesSearch =
        !invoiceSearchTerm ||
        (inv.clientName && inv.clientName.toLowerCase().includes(search)) ||
        (inv.projectName && inv.projectName.toLowerCase().includes(search)) ||
        (inv.invoiceNo && inv.invoiceNo.toLowerCase().includes(search)) ||
        (inv.invoiceType && inv.invoiceType.toLowerCase().includes(search)) ||
        (inv.generatedBy && inv.generatedBy.toLowerCase().includes(search));

      const matchesStatus = invoiceStatusFilter === 'all' || inv.status === invoiceStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [allInvoices, invoiceSearchTerm, invoiceStatusFilter]);

  const invoiceTotalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const paginatedInvoices = filteredInvoices.slice(
    (invoiceCurrentPage - 1) * ITEMS_PER_PAGE,
    invoiceCurrentPage * ITEMS_PER_PAGE
  );

  const invoiceStats = useMemo(() => {
    return {
      total: allInvoices.length,
      totalInvoiced: allInvoices.reduce((sum, i) => sum + (i.totalAmount || 0), 0),
      totalPaid: allInvoices.reduce((sum, i) => sum + (i.paidAmount || 0), 0),
      pending: allInvoices.reduce((sum, i) => sum + (i.dueAmount || 0), 0)
    };
  }, [allInvoices]);

  // Export to Excel-compatible CSV for Invoices
  const handleExportInvoices = () => {
    const escapeCell = (val) => {
      const str = val === null || val === undefined ? '' : String(val);
      return '"' + str.replace(/"/g, '""') + '"';
    };
    const headers = ['Sr No', 'Invoice No', 'Invoice Type', 'Client Name', 'Project', 'Generated On', 'Generated By', 'Status'];
    const rows = filteredInvoices.map((inv, idx) => [
      idx + 1,
      inv.invoiceNo,
      inv.invoiceType || (String(inv.invoiceNo).startsWith('PI/') ? 'Proforma Invoice' : 'Tax Invoice'),
      inv.clientName,
      inv.projectName || inv.itemDescription || '-',
      formatDDMMYYYY(inv.generatedOn),
      inv.generatedBy,
      inv.status
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(escapeCell).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoices_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    if (activeTab === 'invoices') {
      handleExportInvoices();
    } else {
      handleExportPayments();
    }
  };

  // Invoice modal state
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoicePayment, setSelectedInvoicePayment] = useState(null);

  // Payment Details Modal state (for Payment Records table)
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [selectedPaymentRecord, setSelectedPaymentRecord] = useState(null);

  const handleOpenPaymentDetails = (payment) => {
    setSelectedPaymentRecord(payment);
    setShowPaymentDetailsModal(true);
  };

  // Generate Invoice modal state
  const [showGenInvoiceModal, setShowGenInvoiceModal] = useState(false);
  const [showInvoiceTypeMenu, setShowInvoiceTypeMenu] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const invoiceMenuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      setActiveDropdown(null);
      if (invoiceMenuRef.current && !invoiceMenuRef.current.contains(e.target)) {
        setShowInvoiceTypeMenu(false);
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const formatInvoiceNumberInput = (inputVal, category = 'tax') => {
    const raw = String(inputVal || '').trim();
    if (!raw) return '';
    const now = new Date();
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStr = `${String(fy).slice(-2)}-${String(fy + 1).slice(-2)}`;
    const prefix = category === 'proforma' ? 'PI' : 'BT';

    // If user entered only digits e.g. "26", "026"
    if (/^\d+$/.test(raw)) {
      return `${prefix}/${fyStr}/${String(parseInt(raw, 10)).padStart(3, '0')}`;
    }
    // If user entered "PI/14", "BT/26", "INV/26"
    if (/^(PI|BT|INV)\/(\d+)$/i.test(raw)) {
      const match = raw.match(/^(PI|BT|INV)\/(\d+)$/i);
      const chosenPrefix = category === 'proforma' ? 'PI' : (match[1].toUpperCase() === 'PI' ? 'PI' : 'BT');
      return `${chosenPrefix}/${fyStr}/${String(parseInt(match[2], 10)).padStart(3, '0')}`;
    }
    return raw;
  };

  const getNextInvoiceNum = (category = 'tax') => {
    const now = new Date();
    // Indian Financial Year: April 1 (month index 3) of current year to March 31 of next year
    const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const fyStr = `${String(fy).slice(-2)}-${String(fy + 1).slice(-2)}`;
    const prefix = category === 'proforma' ? 'PI' : 'BT';

    // Scan existing invoices in state and localStorage to find the highest sequence number for this prefix & FY
    let maxSeq = 0;
    const checkItem = (item) => {
      const inv = String(item?.invoiceNo || item?.id || '').trim();
      const match = inv.match(new RegExp(`^${prefix}/${fyStr}/(\\d+)`, 'i')) ||
                    (category === 'tax' ? inv.match(new RegExp(`^INV/${fyStr}/(\\d+)`, 'i')) : null);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxSeq) maxSeq = num;
      }
    };

    if (Array.isArray(customInvoices)) {
      customInvoices.forEach(checkItem);
    }

    try {
      const stored = JSON.parse(localStorage.getItem('generated_invoices_list') || '[]');
      (Array.isArray(stored) ? stored : []).forEach(checkItem);
    } catch (e) {
      console.warn('Error reading stored invoices for sequence:', e);
    }

    let nextNum;
    if (category === 'tax') {
      // For FY 26-27: sequence starts from 026. If maxSeq is below 25, next is 26 (i.e. BT/26-27/026).
      // For future FYs (e.g. 27-28 on 1 April onwards): sequence starts from 001.
      if (fyStr === '26-27') {
        nextNum = maxSeq < 25 ? 26 : maxSeq + 1;
      } else {
        nextNum = maxSeq + 1;
      }
    } else {
      // Proforma invoice (PI) starts from 001 every financial year
      nextNum = maxSeq + 1;
    }

    const seq = String(nextNum).padStart(3, '0');
    return `${prefix}/${fyStr}/${seq}`;
  };

  const getNextHsnSacCode = () => {
    // Get the last HSN/SAC code from localStorage
    const storageKey = 'lastHsnSacCode';
    const lastCode = parseInt(localStorage.getItem(storageKey) || '9971', 10);
    const nextCode = lastCode + 1;

    // Store the new HSN/SAC code
    localStorage.setItem(storageKey, String(nextCode));

    return String(nextCode);
  };

  const [genInvoiceForm, setGenInvoiceForm] = useState({
    // Invoice meta
    invoiceCategory: 'tax', // 'tax' | 'proforma'
    invoiceNo: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    // Pre-fill from project
    prefillProjectId: '',
    // Client / Bill To
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientGstin: '',
    clientPan: '',
    clientAddress: '',
    clientCity: '',
    clientPostalCode: '',
    clientState: '',
    // Service line item
    itemDescription: '',
    itemDetails: '',
    hsnSac: '9975',
    qty: '1',
    rate: '',
    discount: '',
    // GST
    gstType: 'cgst_sgst',
    gstRate: '18',
    // Payment
    advanceAmount: '',
  });

  const handleSwitchInvoiceCategory = (category) => {
    const currentNum = genInvoiceForm.invoiceNo;
    let newNum = currentNum;
    if (category === 'proforma' && (currentNum.startsWith('INV/') || currentNum.startsWith('BT/') || currentNum.startsWith('BC/'))) {
      newNum = currentNum.replace(/^(INV|BT|BC)\//i, 'PI/');
    } else if (category === 'tax' && currentNum.startsWith('PI/')) {
      newNum = currentNum.replace(/^PI\//i, 'BT/');
      const match = newNum.match(/^BT\/26-27\/(\d+)/i);
      if (match && parseInt(match[1], 10) < 26) {
        newNum = getNextInvoiceNum('tax');
      }
    } else if (!newNum) {
      newNum = getNextInvoiceNum(category);
    }
    setGenInvoiceForm(prev => ({
      ...prev,
      invoiceCategory: category,
      invoiceNo: newNum
    }));
  };

  const handleOpenGenInvoice = (category = 'tax') => {
    const creatorStr = getLoggedInUserDisplayName();
    setGenInvoiceForm({
      invoiceCategory: category,
      invoiceNo: getNextInvoiceNum(category),
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: new Date().toISOString().split('T')[0],
      prefillProjectId: '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientGstin: '',
      clientPan: '',
      clientAddress: '',
      clientCity: '',
      clientPostalCode: '',
      clientState: '',
      itemDescription: '',
      itemDetails: '',
      hsnSac: '9975',
      qty: '1',
      rate: '',
      discount: '',
      gstType: 'cgst_sgst',
      gstRate: '18',
      advanceAmount: '',
      generatedBy: creatorStr,
      generatedOn: new Date().toISOString()
    });
    setShowInvoiceTypeMenu(false);
    setShowGenInvoiceModal(true);
  };

  const handleGenInvoicePrefill = (projectId) => {
    const proj = paymentData.find(p => p._id === projectId);
    if (!proj) {
      setGenInvoiceForm(f => ({ ...f, prefillProjectId: projectId }));
      return;
    }

    const savedCustom = customInvoices.find(ci => 
      ci.prefillProjectId === projectId || 
      ci.rawForm?.prefillProjectId === projectId ||
      (proj.id && (ci.id === proj.id || ci.invoiceNo === `INV-${proj.id}` || ci.invoiceNo === `INV-PRJ${String(proj.id).padStart(4, '0')}`))
    );

    const merged = savedCustom ? { ...proj, ...savedCustom, rawForm: { ...(proj.rawForm || {}), ...(savedCustom.rawForm || {}) } } : proj;
    const creatorStr = getLoggedInUserDisplayName();

    setGenInvoiceForm(f => ({
      ...f,
      prefillProjectId: projectId,
      clientName: merged.clientName !== '-' ? merged.clientName : (merged.rawForm?.clientName || f.clientName),
      clientEmail: merged.email !== '-' ? merged.email : (merged.clientEmail || merged.rawForm?.clientEmail || f.clientEmail),
      clientPhone: merged.phone !== '-' ? merged.phone : (merged.clientPhone || merged.rawForm?.clientPhone || f.clientPhone),
      clientGstin: merged.clientGstin || merged.rawForm?.clientGstin || f.clientGstin,
      clientPan: merged.clientPan || merged.rawForm?.clientPan || f.clientPan,
      clientAddress: merged.clientAddress || merged.rawForm?.clientAddress || f.clientAddress,
      clientCity: merged.clientCity || merged.rawForm?.clientCity || f.clientCity,
      clientPostalCode: merged.clientPostalCode || merged.rawForm?.clientPostalCode || f.clientPostalCode,
      clientState: merged.clientState || merged.rawForm?.clientState || f.clientState,
      itemDescription: merged.projectName || merged.itemDescription || f.itemDescription,
      itemDetails: merged.itemDetails || merged.description || merged.rawForm?.itemDetails || merged.rawForm?.description || f.itemDetails || '',
      hsnSac: merged.hsnSac || merged.rawForm?.hsnSac || f.hsnSac,
      qty: merged.qty ? String(merged.qty) : (merged.rawForm?.qty ? String(merged.rawForm.qty) : f.qty),
      rate: merged.rate !== undefined && merged.rate !== '' ? String(merged.rate) : (merged.baseAmount !== undefined ? String(merged.baseAmount) : (merged.totalAmount ? String(merged.totalAmount) : f.rate)),
      discount: merged.discount ? String(merged.discount) : (merged.rawForm?.discount ? String(merged.rawForm.discount) : f.discount),
      gstType: merged.gstType || merged.rawForm?.gstType || f.gstType,
      gstRate: merged.gstRate ? String(merged.gstRate) : (merged.rawForm?.gstRate ? String(merged.rawForm.gstRate) : f.gstRate),
      advanceAmount: merged.paidAmount !== undefined ? String(merged.paidAmount) : (merged.advanceAmount !== undefined ? String(merged.advanceAmount) : f.advanceAmount),
      generatedBy: merged.generatedBy || merged.rawForm?.generatedBy || creatorStr,
      generatedOn: merged.generatedOn || merged.rawForm?.generatedOn || new Date().toISOString()
    }));
  };

  const handlePrintGeneratedInvoice = (form, isDownload = false) => {
    const isProforma = form.invoiceCategory === 'proforma' || (form.invoiceNo && String(form.invoiceNo).startsWith('PI/'));
    const rate = parseFloat(form.rate) || 0;
    const qty = parseFloat(form.qty) || 1;
    const discount = parseFloat(form.discount) || 0;
    const lineTotal = rate * qty - discount;
    const gstRate = parseFloat(form.gstRate) || 0;
    const noGst = form.gstType === 'none' || gstRate === 0;
    const isIgst = form.gstType === 'igst';
    const isCgstSgst = form.gstType === 'cgst_sgst' || (!isIgst && form.gstType !== 'none');
    const gstAmount = noGst ? 0 : Math.round(lineTotal * gstRate / 100);
    const halfGst = Math.round(gstAmount / 2);
    const subTotal = lineTotal + gstAmount;
    const advance = parseFloat(form.advanceAmount) || 0;
    const pending = Math.max(0, subTotal - advance);

    const fmtNum = (n) => Math.round(n).toLocaleString('en-IN');
    const fmtAmt = (n) => `${fmtNum(n)}/-`;
    const invoiceDate = new Date(form.invoiceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const dueDate = new Date(form.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

    const itemDetailsRaw = (form.itemDetails || form.description || '').trim();
    let itemContentHtml = `<div style="font-weight:700;color:#111;line-height:1.35;font-size:8.8pt;">${form.itemDescription || '—'}</div>`;
    if (itemDetailsRaw) {
      const bulletLines = itemDetailsRaw
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
      
      if (bulletLines.length > 0) {
        const lis = bulletLines.map(line => {
          const cleanLine = line.replace(/^[•\-\*\u2022]\s*/, '').replace(/^\d+[\.\)]\s*/, '');
          return `<li style="margin-top:3px;margin-bottom:2px;color:#333;font-size:8pt;line-height:1.35;">${cleanLine}</li>`;
        }).join('');
        itemContentHtml += `<ul style="margin:4px 0 0 0;padding-left:15px;list-style-type:disc;text-align:left;">${lis}</ul>`;
      }
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${isProforma ? 'Proforma' : 'Tax'} Invoice ${form.invoiceNo}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Calibri','Segoe UI',Arial,sans-serif;font-size:10pt;color:#000;background:#fff;margin:0;padding:0;}
  .page{width:210mm;min-height:295mm;margin:0 auto;padding:10mm;background:#fff;position:relative;}

  /* ── HEADER ── */
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;}
  .hdr-left{display:flex;align-items:center;gap:10px;}
  .hdr-logo{height:54px;width:auto;object-fit:contain;}
  .hdr-brand{font-size:13pt;font-weight:700;color:#2C7B30;letter-spacing:0.3px;}
  .hdr-gstin{font-size:8pt;color:#333;margin-top:3px;}
  .hdr-right{text-align:right;}
  .hdr-addr{font-size:8pt;color:#444;line-height:1.7;margin-bottom:5px;}
  .meta-grid{display:flex;flex-direction:column;gap:2px;align-items:flex-end;}
  .meta-line{font-size:8.5pt;color:#222;}
  .meta-line b{font-weight:700;}

  /* ── SEPARATOR ── */
  .sep{height:1px;background:#cccccc;margin:5px 0;}

  /* ── CONTACT BAR ── */
  .contact{text-align:center;font-size:8pt;color:#444;padding:3px 0;border-top:1px solid #ccc;border-bottom:1px solid #ccc;margin:4px 0 6px;}

  /* ── INVOICE BADGE ── */
  .ti-badge{background:#2C7B30;color:#fff;text-align:center;font-size:14pt;font-weight:700;letter-spacing:4px;padding:5px 0;margin:6px 0;}

  /* ── BILL TABLE (BILLED BY / BILL TO) ── */
  .tbl-bill{width:100%;border-collapse:collapse;border:1px solid #2C7B30;}
  .tbl-bill .col-hdr{background:#2C7B30;color:#fff;font-size:9pt;font-weight:700;padding:5px 8px;letter-spacing:1px;border-right:1px solid #fff;}
  .tbl-bill .col-hdr:last-child{border-right:none;}
  .tbl-bill .fld-row>td{font-size:8pt;padding:2px 8px;border-right:1px solid #2C7B30;vertical-align:top;}
  .tbl-bill .fld-row>td:last-child{border-right:none;}
  .tbl-bill .fld-row:last-child>td{padding-bottom:6px;}
  .lbl{font-weight:700;color:#222;min-width:80px;display:inline-block;}
  .val{color:#000;}

  /* ── ITEMS TABLE ── */
  .tbl-items{width:100%;border-collapse:collapse;border:1px solid #2C7B30;border-top:none;}
  .tbl-items thead tr{background:#2C7B30;}
  .tbl-items th{color:#fff;font-size:8.5pt;font-weight:700;padding:5px 7px;text-align:left;border-right:1px solid rgba(255,255,255,0.35);}
  .tbl-items th:last-child{border-right:none;}
  .tbl-items td{font-size:8.5pt;padding:7px 7px;border-bottom:1px solid #ddd;color:#000;vertical-align:top;}
  .tbl-items .r{text-align:right;} .tbl-items .c{text-align:center;}

  /* ── PAYMENT / TOTALS TABLE ── */
  .tbl-pay{width:100%;border-collapse:collapse;border:1px solid #2C7B30;border-top:none;}
  .tbl-pay .pay-hdr{background:#2C7B30;color:#fff;font-size:8.5pt;font-weight:700;padding:5px 8px;letter-spacing:1px;border-right:1px solid #2C7B30;}
  .tbl-pay td{font-size:8.5pt;padding:3px 8px;vertical-align:top;border-right:1px solid #ddd;border-bottom:1px solid #ddd;}
  .tbl-pay td:last-child{border-right:none;}
  .tbl-pay .td-lbl{font-weight:400;color:#333;width:52%;}
  .tbl-pay .td-amt{font-weight:700;color:#000;text-align:right;width:48%;}
  .tbl-pay .sep-right{border-right:1px solid #2C7B30 !important;}
  .tbl-pay tr:last-child td{border-bottom:none;}
  .pay-left-lbl{font-weight:700;min-width:85px;display:inline-block;}

  /* ── PENDING AMOUNT ── */
  .pending-row{background:#2C7B30;color:#fff;font-size:10.5pt;font-weight:700;padding:6px 10px;display:flex;justify-content:space-between;border:1px solid #2C7B30;border-top:none;}

  /* ── TERMS + SIGNATORY ── */
  .bottom-grid{display:flex;justify-content:space-between;align-items:flex-start;margin-top:8px;gap:16px;}
  .terms-blk{flex:1;}
  .terms-hdr{font-size:9pt;font-weight:700;color:#2C7B30;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;}
  .term-item{font-size:8pt;color:#333;line-height:1.9;display:flex;gap:5px;}
  .sign-blk{text-align:center;min-width:160px;}
  .sign-img{height:72px;width:auto;object-fit:contain;}

  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    .page{width:100%;padding:6mm 8mm;}
    @page{size:A4;margin:0;}
  }
</style>
</head>
<body>
<div class="page">

  <!-- ░░ HEADER ░░ -->
  <div class="hdr">
    <div class="hdr-left">
      <img class="hdr-logo" src="/inv_logo.png" alt="Bhoomi Techzone"/>
      <div>
        <div class="hdr-brand">BHOOMI TECHZONE<br>PRIVATE LIMITED</div>
        <div class="hdr-gstin">GSTIN: 09AAMCB0572D1ZS &nbsp;|&nbsp; PAN: AAMCB0572D</div>
      </div>
    </div>
    <div class="hdr-right">
      <div class="hdr-addr">
        3rd Floor, Office No 308, A-43,<br>
        Sector 63, Noida – 201301
      </div>
      <div class="meta-grid">
        <div class="meta-line"><b>${isProforma ? 'Proforma No:' : 'Invoice No:'}</b> &nbsp;${form.invoiceNo}</div>
        <div class="meta-line"><b>${isProforma ? 'Date:' : 'Invoice Date:'}</b> &nbsp;${invoiceDate}</div>
        <div class="meta-line"><b>Due Date:</b> &nbsp;${dueDate}</div>
      </div>
    </div>
  </div>

  <div class="sep"></div>

  <!-- ░░ CONTACT BAR ░░ -->
  <div class="contact">
    +91 8130787194 &nbsp;|&nbsp; www.bhoomitechzone.in &nbsp;|&nbsp; info@bhoomitechzone.in
  </div>

  <!-- ░░ BADGE ░░ -->
  <div class="ti-badge">${isProforma ? 'PROFORMA INVOICE' : 'TAX INVOICE'}</div>

  <!-- ░░ BILLED BY / BILL TO ░░ -->
  <table class="tbl-bill">
    <thead>
      <tr>
        <th class="col-hdr" style="width:50%">BILLED &nbsp;BY</th>
        <th class="col-hdr" style="width:50%">BILL &nbsp;TO</th>
      </tr>
    </thead>
    <tbody>
      <tr class="fld-row"><td><span class="lbl">Business Name:</span><span class="val">Bhoomi Techzone Private Limited</span></td><td><span class="lbl">Business Name:</span><span class="val">${form.clientName || '—'}</span></td></tr>
      <tr class="fld-row"><td><span class="lbl">Email:</span><span class="val">info@bhoomitechzone.in</span></td><td><span class="lbl">Email:</span><span class="val">${form.clientEmail || '—'}</span></td></tr>
      <tr class="fld-row"><td><span class="lbl">Phone:</span><span class="val">8130787194</span></td><td><span class="lbl">Phone:</span><span class="val">${form.clientPhone || '—'}</span></td></tr>
      <tr class="fld-row"><td><span class="lbl">GSTIN:</span><span class="val">09AAMCB0572D1ZS</span></td><td><span class="lbl">GSTIN:</span><span class="val">${form.clientGstin || '—'}</span></td></tr>
      <tr class="fld-row"><td><span class="lbl">PAN:</span><span class="val">AAMCB0572D</span></td><td><span class="lbl">PAN:</span><span class="val">${form.clientPan || '—'}</span></td></tr>
      <tr class="fld-row"><td><span class="lbl">Address:</span><span class="val">3rd Floor, Office No 308, A-43, Sector 63, Noida – 201301</span></td><td><span class="lbl">Address:</span><span class="val">${form.clientAddress || '—'}</span></td></tr>
      <tr class="fld-row"><td><span class="lbl">City:</span><span class="val">NOIDA</span></td><td><span class="lbl">District:</span><span class="val">${form.clientCity || '—'}</span></td></tr>
      <tr class="fld-row"><td><span class="lbl">Postal Code:</span><span class="val">201301</span></td><td><span class="lbl">Postal Code:</span><span class="val">${form.clientPostalCode || '—'}</span></td></tr>
      <tr class="fld-row"><td><span class="lbl">State:</span><span class="val">Uttar Pradesh</span></td><td><span class="lbl">State:</span><span class="val">${form.clientState || '—'}</span></td></tr>
    </tbody>
  </table>

  <!-- ░░ ITEMS TABLE ░░ -->
  <table class="tbl-items">
    <thead>
      <tr>
        <th style="width:${form.hsnSac ? '34%' : '44%'}">${isProforma ? 'ITEM / SERVICE DESCRIPTION' : 'ITEM'}</th>
        ${form.hsnSac ? `<th style="width:10%">HSN/SAC</th>` : ''}
        <th style="width:16%" class="r">${isProforma ? 'UNIT RATE (Rs.)' : 'RATE (Rs.)'}</th>
        <th style="width:8%" class="c">QTY</th>
        <th style="width:14%" class="r">DISCOUNT</th>
        <th style="width:18%" class="r">TOTAL (Rs.)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:6px 8px;">${itemContentHtml}</td>
        ${form.hsnSac ? `<td>${form.hsnSac}</td>` : ''}
        <td class="r">${fmtAmt(rate)}</td>
        <td class="c">${qty}</td>
        <td class="r">${discount > 0 ? fmtAmt(discount) : '—'}</td>
        <td class="r" style="font-weight:700">${fmtAmt(lineTotal)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ░░ PAYMENT DETAILS + TOTALS ░░ -->
  <table class="tbl-pay">
    <thead>
      <tr>
        <td colspan="2" class="pay-hdr sep-right">${isProforma ? 'BANK / PAYMENT DETAILS' : 'PAYMENT DETAILS'}</td>
        <td colspan="2" style="padding:0;border-bottom:1px solid #ddd;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td class="td-lbl" style="padding:3px 8px;border-bottom:1px solid #ddd;">${isProforma ? 'Subtotal' : 'Total'}</td><td class="td-amt" style="padding:3px 8px;border-bottom:1px solid #ddd;">${fmtAmt(lineTotal)}</td></tr>
          </table>
        </td>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sep-right" style="font-weight:700;width:14%;padding:3px 8px;border-bottom:1px solid #ddd;">Name:</td>
        <td class="sep-right" style="width:36%;padding:3px 8px;border-bottom:1px solid #ddd;">BHOOMI TECHZONE PRIVATE LIMITED</td>
        <td class="td-lbl">CGST / SGST ${noGst || !isCgstSgst ? '' : '(' + (gstRate / 2) + '%+' + (gstRate / 2) + '%)'}</td>
        <td class="td-amt">${noGst || !isCgstSgst ? '—' : fmtAmt(gstAmount)}</td>
      </tr>
      <tr>
        <td class="sep-right" style="font-weight:700;padding:3px 8px;border-bottom:1px solid #ddd;">Account No:</td>
        <td class="sep-right" style="padding:3px 8px;border-bottom:1px solid #ddd;">2602210510517073</td>
        <td class="td-lbl">IGST ${noGst || !isIgst ? '' : '(' + gstRate + '%)'}</td>
        <td class="td-amt">${noGst || !isIgst ? '—' : fmtAmt(gstAmount)}</td>
      </tr>
      <tr>
        <td class="sep-right" style="font-weight:700;padding:3px 8px;border-bottom:1px solid #ddd;">IFSC Code:</td>
        <td class="sep-right" style="padding:3px 8px;border-bottom:1px solid #ddd;">AUBL0002105</td>
        <td class="td-lbl" style="font-weight:700;">${isProforma ? 'Total Amount Payable' : 'Sub Total'}</td>
        <td class="td-amt" style="font-weight:700;">${fmtAmt(subTotal)}</td>
      </tr>
      <tr>
        <td class="sep-right" style="font-weight:700;padding:3px 8px;">Bank:</td>
        <td class="sep-right" style="padding:3px 8px;">AU SMALL FINANCE BANK</td>
        <td class="td-lbl">${isProforma ? 'Advance / Paid Amount' : 'Advance Amount'}</td>
        <td class="td-amt">${fmtAmt(advance)}</td>
      </tr>
    </tbody>
  </table>

  <!-- ░░ PENDING / BALANCE AMOUNT ░░ -->
  <div class="pending-row">
    <span>${isProforma ? 'BALANCE PAYABLE' : 'PENDING AMOUNT'}</span>
    <span>Rs. ${fmtAmt(pending)}</span>
  </div>

  <!-- ░░ TERMS & CONDITIONS ░░ -->
  <div class="bottom-grid">
    <div class="terms-blk">
      <div class="terms-hdr">Terms &amp; Conditions</div>
      ${isProforma ? `
        <div class="term-item"><span>•</span><span>This is a Proforma Invoice (Quotation / Estimate) and not a Tax Invoice.</span></div>
        <div class="term-item"><span>•</span><span>Payment is due upon receipt of this proforma invoice as per agreed project milestone terms.</span></div>
        <div class="term-item"><span>•</span><span>Work deliverables and timeline commencement will take effect upon receipt of advance remittance.</span></div>
        <div class="term-item"><span>•</span><span>All disputes are subject to NOIDA UP jurisdiction only.</span></div>
      ` : `
        <div class="term-item"><span>•</span><span>GRN will be shared upon receipt of goods.</span></div>
        <div class="term-item"><span>•</span><span>The credit period will start upon successful receipt / GRN.</span></div>
        <div class="term-item"><span>•</span><span>All disputes are subject to NOIDA UP jurisdiction only.</span></div>
      `}
    </div>
  </div>

</div>
${isDownload ? '' : `
<style>
  @media screen {
    .download-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #3b775e, #2f6350);
      color: white;
      padding: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 9999;
    }
    .download-bar h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    .download-bar .btn-group {
      display: flex;
      gap: 10px;
    }
    .download-bar button {
      padding: 8px 16px;
      border: 2px solid white;
      background: transparent;
      color: white;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .download-bar button:hover {
      background: white;
      color: #3b775e;
    }
    .page {
      margin-top: 70px;
    }
  }
  @media print {
    .download-bar { display: none !important; }
    .page { 
      margin: 0 auto !important;
    }
  }
</style>
<script>
  function downloadPDF() {
    const element = document.querySelector('.page');
    const opt = {
      margin: 0,
      filename: 'Invoice_${form.invoiceNo}.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        logging: false,
        windowWidth: 794,
        windowHeight: element.scrollHeight
      },
      jsPDF: { 
        unit: 'mm', 
        format: 'a4', 
        orientation: 'portrait',
        compress: true
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    
    // Hide download bar during PDF generation
    const downloadBar = document.querySelector('.download-bar');
    if (downloadBar) downloadBar.style.display = 'none';
    
    // Temporarily remove top margin to prevent top space and second blank page
    const originalMargin = element.style.marginTop;
    element.style.marginTop = '0px';
    
    html2pdf().set(opt).from(element).save().then(() => {
      if (downloadBar) downloadBar.style.display = 'flex';
      element.style.marginTop = originalMargin;
    });
  }
</script>
<div class="download-bar">
  <h3>📄 Invoice Preview - ${form.invoiceNo}</h3>
  <div class="btn-group">
    <button onclick="downloadPDF()" title="Download as PDF">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download PDF
    </button>
    <button onclick="window.close()" title="Close preview">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
      Close
    </button>
  </div>
</div>
`}
</body>
</html>`;

    if (isDownload) {
      const autoDownloadScript = `
        <script>
          window.onload = function() {
            const element = document.querySelector('.page');
            const opt = {
              margin: 0,
              filename: 'Invoice_${form.invoiceNo}.pdf',
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2, useCORS: true, letterRendering: true, logging: false },
              jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
              pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
            };
            html2pdf().set(opt).from(element).save().then(() => {
              window.parent.postMessage({ type: 'PDF_DOWNLOAD_COMPLETE' }, '*');
            });
          };
        </script>
      `;
      const htmlWithAutoDownload = html.replace('</body>', autoDownloadScript + '</body>');
      
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '794px';
      iframe.style.height = '1150px';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
      
      const listener = (event) => {
        if (event.data && event.data.type === 'PDF_DOWNLOAD_COMPLETE') {
          setTimeout(() => {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
          }, 500);
          window.removeEventListener('message', listener);
        }
      };
      window.addEventListener('message', listener);
      
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(htmlWithAutoDownload);
      iframe.contentWindow.document.close();
    } else {
      const win = window.open('', '_blank', 'width=794,height=1150');
      if (win) { win.document.write(html); win.document.close(); }
    }
  };

  const handleDeleteInvoice = async (inv) => {
    if (!inv) return;
    const targetInvoiceNo = String(inv.invoiceNo || '').trim();
    const targetClean = targetInvoiceNo.replace(/^INV-PRJPRJ/i, 'INV-PRJ').toLowerCase();
    
    if (window.confirm(`Are you sure you want to delete invoice ${targetInvoiceNo}?`)) {
      try {
        const idToDelete = inv._id || inv.id || targetInvoiceNo;
        await api.delete(`/invoices/${encodeURIComponent(idToDelete)}`);
      } catch (err) {
        console.warn('Backend delete invoice warning:', err);
      }

      setCustomInvoices(prev => {
        const nextList = prev.filter(ci => {
          const ciNo = String(ci.invoiceNo || '').trim();
          const ciClean = ciNo.replace(/^INV-PRJPRJ/i, 'INV-PRJ').toLowerCase();
          const matchNo = (ciNo && targetInvoiceNo && ciNo.toLowerCase() === targetInvoiceNo.toLowerCase()) || 
                          (ciClean && targetClean && ciClean === targetClean);
          const matchId = (ci._id && inv._id && String(ci._id) === String(inv._id)) || 
                          (ci.id && inv.id && String(ci.id) === String(inv.id));
          return !matchNo && !matchId;
        });
        try {
          localStorage.setItem('generated_invoices_list', JSON.stringify(nextList));
        } catch (err) {
          console.error('Error removing invoice:', err);
        }
        return nextList;
      });
      alert('Invoice deleted successfully!');
    }
  };

  const resolveInvoiceDetails = (payment) => {
    const raw = payment.rawPayment || payment;
    
    // 1. Find matching project from paymentData
    const proj = paymentData.find(p => 
      (raw.prefillProjectId && p._id === raw.prefillProjectId) ||
      (raw._id && p._id === raw._id) ||
      (raw.id && (p.id === raw.id || p.id === String(raw.id).replace(/^INV-/, '') || p.id === String(raw.id).replace(/^INV-PRJPRJ/i, 'PRJ') || p.id === String(raw.id).replace(/^INV-PRJ/i, 'PRJ'))) ||
      (raw.invoiceNo && p.id && (raw.invoiceNo.includes(p.id) || raw.invoiceNo.replace(/INV-PRJPRJ/i, 'PRJ').includes(p.id)))
    );

    // 2. Find matching saved custom invoice
    const savedCustom = customInvoices.find(ci => 
      (raw.invoiceNo && ci.invoiceNo === raw.invoiceNo) || 
      (raw._id && (ci.prefillProjectId === raw._id || ci.rawForm?.prefillProjectId === raw._id)) ||
      (proj?._id && (ci.prefillProjectId === proj._id || ci.rawForm?.prefillProjectId === proj._id)) ||
      (raw.id && (ci.id === raw.id || ci.invoiceNo === `INV-${raw.id}` || ci.invoiceNo === `INV-PRJ${String(raw.id).padStart(4, '0')}`))
    );

    let invNo = raw.invoiceNo || savedCustom?.invoiceNo;
    if (!invNo) {
      const idStr = String(proj?.id || raw.id || '');
      if (idStr.startsWith('INV-')) invNo = idStr;
      else if (idStr.startsWith('PRJ')) invNo = `INV-${idStr}`;
      else invNo = `INV-PRJ${idStr.padStart(4, '0')}`;
    }
    invNo = String(invNo).replace(/^INV-PRJPRJ/i, 'INV-PRJ');

    const clientName = (raw.clientName && raw.clientName !== '-' && raw.clientName !== 'Client' && raw.clientName !== 'Unknown')
      ? raw.clientName
      : (proj?.clientName && proj.clientName !== '-' && proj.clientName !== 'Unknown' ? proj.clientName : (savedCustom?.clientName || 'Client'));

    const clientEmail = (raw.email && raw.email !== '-' && raw.email !== 'Not provided')
      ? raw.email
      : (raw.clientEmail || (proj?.email && proj.email !== '-' && proj.email !== 'Not provided' ? proj.email : (savedCustom?.email || savedCustom?.rawForm?.clientEmail || '')));

    const clientPhone = (raw.phone && raw.phone !== '-' && raw.phone !== 'Not provided')
      ? raw.phone
      : (raw.clientPhone || (proj?.phone && proj.phone !== '-' && proj.phone !== 'Not provided' ? proj.phone : (savedCustom?.phone || savedCustom?.rawForm?.clientPhone || '')));

    const clientAddress = raw.clientAddress || raw.rawForm?.clientAddress || proj?.clientAddress || savedCustom?.clientAddress || savedCustom?.rawForm?.clientAddress || '';
    const clientCity = raw.clientCity || raw.rawForm?.clientCity || proj?.clientCity || savedCustom?.clientCity || savedCustom?.rawForm?.clientCity || '';
    const clientPostalCode = raw.clientPostalCode || raw.rawForm?.clientPostalCode || proj?.clientPostalCode || savedCustom?.clientPostalCode || savedCustom?.rawForm?.clientPostalCode || '';
    const clientState = raw.clientState || raw.rawForm?.clientState || proj?.clientState || savedCustom?.clientState || savedCustom?.rawForm?.clientState || '';
    const clientGstin = raw.clientGstin || raw.rawForm?.clientGstin || proj?.clientGstin || savedCustom?.clientGstin || savedCustom?.rawForm?.clientGstin || '';
    const clientPan = raw.clientPan || raw.rawForm?.clientPan || proj?.clientPan || savedCustom?.clientPan || savedCustom?.rawForm?.clientPan || '';

    const projectName = (raw.projectName && raw.projectName !== '-' && raw.projectName !== 'Custom Invoice')
      ? raw.projectName
      : (proj?.projectName || raw.itemDescription || savedCustom?.projectName || savedCustom?.itemDescription || 'Services');

    const hsnSac = raw.hsnSac || raw.rawForm?.hsnSac || proj?.hsnSac || savedCustom?.hsnSac || '9975';
    const gstType = raw.gstType || raw.rawForm?.gstType || proj?.gstType || savedCustom?.gstType || savedCustom?.rawForm?.gstType || 'cgst_sgst';
    const gstRate = raw.gstRate ? String(raw.gstRate) : (raw.rawForm?.gstRate ? String(raw.rawForm.gstRate) : (proj?.gstRate ? String(proj.gstRate) : (savedCustom?.gstRate ? String(savedCustom.gstRate) : '18')));

    let resolvedRate = raw.rate !== undefined && raw.rate !== '' 
      ? String(raw.rate) 
      : (raw.rawForm?.rate !== undefined 
          ? String(raw.rawForm.rate) 
          : (raw.baseAmount !== undefined 
              ? String(raw.baseAmount) 
              : (proj?.baseAmount !== undefined 
                  ? String(proj.baseAmount) 
                  : (proj?.totalAmount !== undefined 
                      ? String(Math.round(proj.totalAmount / (1 + (parseFloat(gstRate) || 18) / 100))) 
                      : (raw.totalAmount ? String(Math.round(raw.totalAmount / (1 + (parseFloat(gstRate) || 18) / 100))) : '0')))));

    // Prevent double GST if resolvedRate was stored as totalAmount with GST
    if (proj && proj.baseAmount && (parseFloat(resolvedRate) === proj.totalAmount || parseFloat(resolvedRate) === Math.round(proj.baseAmount * 1.18))) {
      resolvedRate = String(proj.baseAmount);
    }

    const resolvedAdvance = raw.advanceAmount !== undefined && raw.advanceAmount !== ''
      ? String(raw.advanceAmount)
      : (raw.rawForm?.advanceAmount !== undefined
          ? String(raw.rawForm.advanceAmount)
          : (raw.paidAmount !== undefined
              ? String(raw.paidAmount)
              : (proj?.paidAmount !== undefined ? String(proj.paidAmount) : '0')));

    const generatedBy = raw.generatedBy || raw.rawForm?.generatedBy || savedCustom?.generatedBy || savedCustom?.rawForm?.generatedBy;
    const generatedOn = raw.generatedOn || raw.rawForm?.generatedOn || savedCustom?.generatedOn || savedCustom?.rawForm?.generatedOn;

    return {
      prefillProjectId: proj?._id || raw._id || raw.prefillProjectId || '',
      invoiceCategory: raw.invoiceCategory || savedCustom?.invoiceCategory || (String(invNo).startsWith('PI/') ? 'proforma' : 'tax'),
      invoiceNo: invNo,
      invoiceDate: raw.invoiceDate || raw.rawForm?.invoiceDate || savedCustom?.invoiceDate || new Date().toISOString().split('T')[0],
      dueDate: raw.dueDate || raw.rawForm?.dueDate || savedCustom?.dueDate || new Date().toISOString().split('T')[0],
      clientName,
      clientEmail,
      clientPhone,
      clientGstin,
      clientPan,
      clientAddress,
      clientCity,
      clientPostalCode,
      clientState,
      itemDescription: projectName,
      itemDetails: raw.itemDetails || raw.description || raw.rawForm?.itemDetails || raw.rawForm?.description || proj?.description || savedCustom?.itemDetails || savedCustom?.description || savedCustom?.rawForm?.itemDetails || savedCustom?.rawForm?.description || '',
      description: raw.itemDetails || raw.description || raw.rawForm?.itemDetails || raw.rawForm?.description || proj?.description || savedCustom?.itemDetails || savedCustom?.description || savedCustom?.rawForm?.itemDetails || savedCustom?.rawForm?.description || '',
      hsnSac,
      qty: raw.qty ? String(raw.qty) : (raw.rawForm?.qty ? String(raw.rawForm.qty) : (savedCustom?.qty ? String(savedCustom.qty) : '1')),
      rate: resolvedRate,
      discount: raw.discount ? String(raw.discount) : (raw.rawForm?.discount ? String(raw.rawForm.discount) : (savedCustom?.discount ? String(savedCustom.discount) : '0')),
      gstType,
      gstRate,
      advanceAmount: resolvedAdvance,
      generatedBy,
      generatedOn
    };
  };

  const handleViewInvoice = (payment, isDownload = false) => {
    const form = resolveInvoiceDetails(payment);
    handlePrintGeneratedInvoice(form, isDownload);
  };

  const handlePrintInvoice = (payment) => {
    const dueAmount = Math.max(0, payment.totalAmount - payment.paidAmount);
    const paidPct = payment.totalAmount > 0 ? Math.round((payment.paidAmount / payment.totalAmount) * 100) : 0;
    const invoiceDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const invoiceNum = payment.invoiceNo || (String(payment.id).startsWith('PRJ') ? `INV-${payment.id}` : (String(payment.id).startsWith('INV-') ? payment.id : `INV-PRJ${String(payment.id).padStart(4, '0')}`));
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${invoiceNum}</title><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Calibri','Segoe UI',Arial,sans-serif;color:#000;background:#fff;font-size:11pt;line-height:1.4;}
      .page{max-width:210mm;margin:15mm auto;padding:0;background:#fff;}
      .invoice-container{padding:25mm 20mm;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #3b775e;}
      .company-info{display:flex;align-items:center;gap:15px;}
      .company-logo{width:65px;height:65px;object-fit:contain;}
      .company-details h1{font-size:24pt;font-weight:700;color:#3b775e;margin:0 0 4px 0;letter-spacing:-0.5px;}
      .company-details p{font-size:9pt;color:#666;margin:2px 0;}
      .invoice-info{text-align:right;}
      .invoice-label{font-size:36pt;font-weight:700;color:#3b775e;margin:0;letter-spacing:-1px;}
      .invoice-details{margin-top:10px;font-size:10pt;}
      .invoice-details div{margin:3px 0;color:#444;}
      .invoice-details strong{color:#000;font-weight:600;}
      .section-row{display:flex;justify-content:space-between;margin:25px 0;}
      .info-box{flex:1;margin-right:20px;}
      .info-box:last-child{margin-right:0;}
      .info-box-title{font-size:9pt;font-weight:700;text-transform:uppercase;color:#666;margin-bottom:8px;letter-spacing:0.5px;}
      .info-box-content{font-size:10pt;line-height:1.6;}
      .info-box-content strong{font-weight:600;color:#000;}
      .items-table{width:100%;border-collapse:collapse;margin:25px 0;border:2px solid #3b775e;}
      .items-table thead{background:#3b775e;color:#fff;}
      .items-table th{padding:12px;text-align:left;font-size:10pt;font-weight:600;border-right:1px solid #56a07a;}
      .items-table th:last-child{border-right:none;text-align:right;}
      .items-table td{padding:14px 12px;border-bottom:1px solid #e0e0e0;font-size:10pt;color:#333;}
      .items-table td:last-child{text-align:right;font-weight:600;color:#000;}
      .items-table tbody tr:last-child td{border-bottom:2px solid #3b775e;}
      .totals-section{display:flex;justify-content:flex-end;margin-top:20px;}
      .totals-box{width:300px;border:2px solid #3b775e;}
      .total-row{display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #e0e0e0;font-size:11pt;}
      .total-row:last-child{border-bottom:none;background:#f8faf9;}
      .total-label{color:#444;font-weight:500;}
      .total-value{font-weight:700;color:#000;}
      .total-row.subtotal{background:#f8faf9;}
      .total-row.grand-total{background:#3b775e;color:#fff;font-size:12pt;}
      .total-row.grand-total .total-label,.total-row.grand-total .total-value{color:#fff;font-weight:700;}
      .total-row.balance{background:#fff7ed;}
      .total-row.balance .total-value{color:#ea580c;font-size:12pt;font-weight:700;}
      .payment-status{margin:25px 0;padding:15px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px;}
      .payment-status-title{font-size:10pt;font-weight:700;color:#15803d;margin-bottom:8px;}
      .payment-progress{height:6px;background:#d1fae5;border-radius:3px;overflow:hidden;margin:8px 0;}
      .payment-progress-bar{height:100%;background:#16a34a;width:${paidPct}%;transition:width 0.3s;}
      .payment-status-text{font-size:9pt;color:#166534;font-weight:500;}
      .notes-section{margin:25px 0;padding:15px;background:#f9fafb;border-radius:4px;border:1px solid #e5e7eb;}
      .notes-title{font-size:9pt;font-weight:700;color:#374151;margin-bottom:6px;text-transform:uppercase;}
      .notes-content{font-size:9pt;color:#6b7280;line-height:1.6;}
      .footer{margin-top:40px;padding-top:20px;border-top:2px solid #e5e7eb;text-align:center;}
      .footer-text{font-size:9pt;color:#9ca3af;margin:4px 0;}
      .footer-company{font-size:10pt;font-weight:600;color:#3b775e;margin-top:8px;}
      @media print{
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
        .page{margin:0;padding:0;}
        .invoice-container{padding:15mm;}
      }
    </style></head><body>
    <div class="page">
      <div class="invoice-container">
        <div class="header">
          <div class="company-info">
            <img src="/logo.png" alt="Bhoomi Techzone" class="company-logo" />
            <div class="company-details">
              <h1>Bhoomi Techzone</h1>
              <p>Noida Sector 63, Uttar Pradesh</p>
              <p>Email: info@bhoomitechzone.com</p>
              <p>Website: https://bhoomitechzone.in</p>
            </div>
          </div>
          <div class="invoice-info">
            <div class="invoice-label">INVOICE</div>
            <div class="invoice-details">
              <div><strong>Invoice #:</strong> ${invoiceNum}</div>
              <div><strong>Date:</strong> ${invoiceDate}</div>
              <div><strong>Project ID:</strong> PRJ${String(payment.id).padStart(4, '0')}</div>
            </div>
          </div>
        </div>

        <div class="section-row">
          <div class="info-box">
            <div class="info-box-title">Bill To:</div>
            <div class="info-box-content">
              <strong>${payment.clientName}</strong><br/>
              ${payment.email}<br/>
              ${payment.phone}
            </div>
          </div>
          <div class="info-box">
            <div class="info-box-title">Project Details:</div>
            <div class="info-box-content">
              <strong>${payment.projectName}</strong><br/>
              Status: ${payment.projectStatus}
            </div>
          </div>
          <div class="info-box">
            <div class="info-box-title">Payment Terms:</div>
            <div class="info-box-content">
              Due on Receipt<br/>
              Currency: INR (₹)
            </div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width:8%;">#</th>
              <th style="width:52%;">Description</th>
              <th style="width:20%;">Quantity</th>
              <th style="width:20%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>
                <strong>${payment.projectName}</strong><br/>
                <span style="font-size:9pt;color:#666;">Project Services & Deliverables</span>
              </td>
              <td>1</td>
              <td>₹${payment.totalAmount.toLocaleString('en-IN')}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="total-row subtotal">
              <span class="total-label">Subtotal:</span>
              <span class="total-value">₹${payment.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Tax (0%):</span>
              <span class="total-value">₹0</span>
            </div>
            <div class="total-row grand-total">
              <span class="total-label">Total Amount:</span>
              <span class="total-value">₹${payment.totalAmount.toLocaleString('en-IN')}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Amount Paid:</span>
              <span class="total-value" style="color:#16a34a;">₹${payment.paidAmount.toLocaleString('en-IN')}</span>
            </div>
            <div class="total-row balance">
              <span class="total-label">Balance Due:</span>
              <span class="total-value">₹${dueAmount.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        <div class="payment-status">
          <div class="payment-status-title">Payment Status: ${paidPct}% Completed</div>
          <div class="payment-progress">
            <div class="payment-progress-bar"></div>
          </div>
          <div class="payment-status-text">
            ${paidPct >= 100 ? 'Payment Fully Settled' : `₹${dueAmount.toLocaleString('en-IN')} remaining`}
          </div>
        </div>

        <div class="notes-section">
          <div class="notes-title">Payment Instructions & Notes:</div>
          <div class="notes-content">
            • Payment should be made within 15 days of invoice date<br/>
            • Please reference invoice number ${invoiceNum} with your payment<br/>
            • For any queries, contact us at info@bhoomitechzone.com<br/>
            • Thank you for your business!
          </div>
        </div>

        <div class="footer">
          <div class="footer-text">This is a computer-generated invoice and does not require a physical signature</div>
          <div class="footer-text">Document generated on ${new Date().toLocaleString('en-IN')}</div>
          <div class="footer-company">Bhoomi Techzone © ${new Date().getFullYear()}</div>
        </div>
      </div>
    </div>
    <script>window.onload=function(){window.print();}<\/script></body></html>`;
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (win) { win.document.write(html); win.document.close(); }
  };

  // Handle delete payment
  const handleDelete = async (payment) => {
    if (!window.confirm(`Are you sure you want to delete the payment record for project "${payment.projectName}"? This will clear the payment record (paid amount set to ₹0) without deleting the project.`)) {
      return;
    }

    try {
      await api.put(`/projects/${payment._id}`, {
        paidAmount: 0,
        paymentHistory: []
      });
      alert('Payment record deleted successfully!');
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error deleting payment record:', error);
      alert(error.response?.data?.message || 'Failed to delete payment record. Please try again.');
    }
  };

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [addingPayment, setAddingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    projectId: '',
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer',
    notes: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editForm, setEditForm] = useState({ projectStatus: 'Active' });

  const handleEditDetailsClick = (payment) => {
    setEditingPayment(payment);
    setEditForm({
      projectStatus: payment.projectStatus || 'Active',
      paymentStatus: payment.paymentStatus || 'Unpaid'
    });
    setActiveDropdown(null);
    setIsEditModalOpen(true);
  };

  const handleMarkAsPaid = async (payment) => {
    if (!canEdit) {
      alert('You do not have permission to edit payment records.');
      return;
    }

    const dueAmount = Math.max(0, (payment.totalAmount || payment.baseAmount || 0) - (payment.paidAmount || 0));
    
    if (dueAmount <= 0 && payment.paymentStatus === 'Paid') {
      alert('This project payment is already marked as Paid.');
      return;
    }

    const confirmMsg = dueAmount > 0
      ? `Mark payment for "${payment.projectName}" as Paid?\n\nThis will record the remaining balance of ₹${dueAmount.toLocaleString('en-IN')} as Paid.`
      : `Mark payment for "${payment.projectName}" as Paid?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setLoading(true);

      // If there is remaining due, create a payment record
      if (dueAmount > 0) {
        const now = new Date();
        const defaultRecordedDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
        const defaultRecordedTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

        await api.post('/payment-records', {
          projectId: payment._id,
          srNo: 1,
          clientName: payment.clientName,
          clientEmail: payment.email,
          projectName: payment.projectName,
          paidAmount: `₹ ${dueAmount.toLocaleString('en-IN')}`,
          paymentMode: 'Bank Transfer',
          paymentStatus: 'Paid',
          paymentDate: defaultRecordedDate,
          recordedOnDate: defaultRecordedDate,
          recordedOnTime: defaultRecordedTime,
          recordedOn: `${defaultRecordedDate}, ${defaultRecordedTime}`,
          notes: `Marked as fully paid by ${user?.name || user?.firstName || 'Admin'}`
        });
      }

      // Also ensure project paymentStatus and paidAmount are updated
      await api.put(`/projects/${payment._id}`, {
        paymentStatus: 'Paid',
        paidAmount: payment.totalAmount || payment.baseAmount || dueAmount
      });

      alert(`Payment for "${payment.projectName}" marked as Paid successfully!`);
      await fetchData();
    } catch (err) {
      console.error('Error marking payment as paid:', err);
      alert(err.response?.data?.message || 'Failed to update payment status to Paid. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentStatusChange = async (payment, newStatus) => {
    if (!canEdit) {
      alert('You do not have permission to update payment status.');
      return;
    }
    if (payment.paymentStatus === newStatus) return;

    try {
      setLoading(true);
      const total = payment.totalAmount || payment.baseAmount || 0;
      const currentPaid = payment.paidAmount || 0;
      const due = Math.max(0, total - currentPaid);

      const updatePayload = {
        paymentStatus: newStatus
      };

      if (newStatus === 'Paid') {
        if (due > 0) {
          const now = new Date();
          const defaultRecordedDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
          const defaultRecordedTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

          await api.post('/payment-records', {
            projectId: payment._id,
            srNo: 1,
            clientName: payment.clientName,
            clientEmail: payment.email,
            projectName: payment.projectName,
            paidAmount: `₹ ${due.toLocaleString('en-IN')}`,
            paymentMode: 'Bank Transfer',
            paymentStatus: 'Paid',
            paymentDate: defaultRecordedDate,
            recordedOnDate: defaultRecordedDate,
            recordedOnTime: defaultRecordedTime,
            recordedOn: `${defaultRecordedDate}, ${defaultRecordedTime}`,
            notes: `Status changed to Paid by ${user?.name || user?.firstName || 'Admin'}`
          });
        }
        updatePayload.paidAmount = total;
      } else if (newStatus === 'Unpaid') {
        updatePayload.paidAmount = 0;
      }

      await api.put(`/projects/${payment._id}`, updatePayload);
      await fetchData();
    } catch (err) {
      console.error('Error changing payment status:', err);
      alert(err.response?.data?.message || 'Failed to update payment status.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateInvoice = (payment) => {
    setActiveDropdown(null);
    const form = resolveInvoiceDetails(payment);
    setGenInvoiceForm(form);
    setShowGenInvoiceModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      let dbStatus = 'active';
      if (editForm.projectStatus === 'Completed') dbStatus = 'completed';
      if (editForm.projectStatus === 'On Hold') dbStatus = 'on-hold';
      if (editForm.projectStatus === 'Active') dbStatus = 'active';
      if (editForm.projectStatus === 'In Progress') dbStatus = 'in-progress';
      
      const updatePayload = {
        status: dbStatus,
        paymentStatus: editForm.paymentStatus || 'Unpaid'
      };

      if (editForm.paymentStatus === 'Paid') {
        const total = editingPayment.totalAmount || editingPayment.baseAmount || 0;
        updatePayload.paidAmount = total;
      } else if (editForm.paymentStatus === 'Unpaid') {
        updatePayload.paidAmount = 0;
      }
      
      await api.put(`/projects/${editingPayment._id}`, updatePayload);
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Failed to update status.');
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.projectId || !paymentForm.amount) {
      alert("Please select a project and enter an amount");
      return;
    }

    const selectedProj = paymentData.find(p => p._id === paymentForm.projectId);
    if (!selectedProj) return;

    setAddingPayment(true);
    try {
      const addedAmount = parseFloat(paymentForm.amount);
      const currentPaid = selectedProj.paidAmount || 0;
      const newPaidAmount = currentPaid + addedAmount;

      const now = new Date();
      const defaultRecordedDate = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
      const defaultRecordedTime = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

      const formattedPaidDate = paymentForm.paymentDate
        ? new Date(paymentForm.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
        : defaultRecordedDate;

      // 1. Save to payment-records API (same backend as Pipeline)
      await api.post('/payment-records', {
        projectId: selectedProj._id,
        clientName: selectedProj.clientName || 'Client',
        clientEmail: selectedProj.email || '',
        projectName: selectedProj.projectName,
        paidAmount: `₹ ${addedAmount.toLocaleString('en-IN')}`,
        paymentMode: paymentForm.paymentMethod || 'Bank Transfer',
        paymentStatus: 'Paid',
        paymentDate: formattedPaidDate,
        recordedOnDate: defaultRecordedDate,
        recordedOnTime: defaultRecordedTime,
        recordedOn: `${defaultRecordedDate}, ${defaultRecordedTime}`,
        notes: paymentForm.notes || ''
      });

      // 2. Update Project paidAmount
      await api.put(`/projects/${selectedProj._id}`, {
        paidAmount: newPaidAmount,
      });

      alert('Payment added successfully!');
      setIsPaymentModalOpen(false);
      setPaymentForm({
        projectId: '',
        amount: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Bank Transfer',
        notes: ''
      });
      fetchData();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Failed to add payment. Please try again.');
    } finally {
      setAddingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="client-payments-page">
        <style>{`
          @keyframes shimmer {
            0% { background-position: -800px 0; }
            100% { background-position: 800px 0; }
          }
          .skeleton {
            background: #f1f5f9;
            background-image: linear-gradient(90deg, #f1f5f9 0px, #e2e8f0 40px, #f1f5f9 80px);
            background-size: 800px 100%;
            animation: shimmer 1.5s infinite linear;
            border-radius: 8px;
          }

        `}</style>

        {/* Header Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <div className="skeleton" style={{ width: '200px', height: '28px', marginBottom: '8px' }}></div>
            <div className="skeleton" style={{ width: '350px', height: '14px' }}></div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton" style={{ width: '100px', height: '36px', borderRadius: '10px' }}></div>
            <div className="skeleton" style={{ width: '120px', height: '36px', borderRadius: '10px' }}></div>
          </div>
        </div>

        {/* Stats Cards Skeleton */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '16px', padding: '20px', height: '110px' }}>
              <div className="skeleton" style={{ width: '80px', height: '14px', marginBottom: '16px' }}></div>
              <div className="skeleton" style={{ width: '120px', height: '28px', marginBottom: '12px' }}></div>
              <div className="skeleton" style={{ width: '140px', height: '12px' }}></div>
            </div>
          ))}
        </div>

        {/* Table Controls Skeleton */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', background: '#fff', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
          <div className="skeleton" style={{ width: '300px', height: '36px', borderRadius: '8px' }}></div>
          <div className="skeleton" style={{ width: '150px', height: '36px', borderRadius: '8px' }}></div>
        </div>

        {/* Table Skeleton */}
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton" style={{ flex: 1, height: '14px', marginRight: '16px' }}></div>
            ))}
          </div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', padding: '20px', borderBottom: '1px solid #f8fafc' }}>
              {[1, 2, 3, 4, 5, 6].map(j => (
                <div key={j} className="skeleton" style={{ flex: 1, height: '16px', marginRight: '16px' }}></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="client-payments-page">
      <style>{`
        .cp-export-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 6px;
          background: #fff;
          color: #6b7280;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.01em;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition: color 0.35s ease, border-color 0.35s ease;
        }
        .pay-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }
        @keyframes payModalIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .pay-modal {
          background: #fff;
          border-radius: 18px;
          width: 100%;
          max-width: 500px;
          max-height: 88vh;
          overflow-y: auto;
          border: 1px solid #e8edf0;
          box-shadow: 0 8px 40px rgba(0,0,0,0.13);
          font-family: 'Inter', 'Segoe UI', sans-serif;
          animation: payModalIn 0.22s cubic-bezier(0.16,1,0.3,1);
          scrollbar-width: none;
        }
        .pay-modal::-webkit-scrollbar { display: none; }
        .pay-modal-hd {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px 20px 16px;
          border-bottom: 1px solid #f1f3f5;
          background: #fafafa;
          border-radius: 18px 18px 0 0;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .pay-modal-hd-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(22,163,74,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .pay-modal-title {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        .pay-modal-sub {
          font-size: 11.5px;
          color: #9ca3af;
          margin-top: 2px;
          line-height: 1.3;
        }
        .pay-close-btn {
          margin-left: auto;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f1f5f9;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6b7280;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s;
        }
        .pay-close-btn:hover { background: #e5e7eb; color: #111827; }
        .pay-modal-body {
          padding: 20px;
          overflow-y: auto;
        }
        .pay-form { display: flex; flex-direction: column; gap: 14px; }
        .pay-section-lbl {
          font-size: 10.5px;
          font-weight: 700;
          color: #16a34a;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          padding-bottom: 6px;
          border-bottom: 1.5px solid #dcfce7;
          margin-bottom: 2px;
        }
        .pay-field { display: flex; flex-direction: column; gap: 5px; }
        .pay-lbl {
          font-size: 11.5px;
          font-weight: 600;
          color: #374151;
          letter-spacing: 0.02em;
        }
        .pay-req { color: #ef4444; margin-left: 2px; }
        .pay-input {
          width: 100%;
          padding: 9px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          font-size: 13px;
          color: #111827;
          background: #fff;
          font-family: 'Inter', sans-serif;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .pay-input:focus {
          border-color: #16a34a;
          box-shadow: 0 0 0 3px rgba(22,163,74,0.09);
        }
        .pay-input::placeholder { color: #c4c9d4; font-size: 12.5px; }
        .pay-select {
          appearance: none;
          background: #fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center;
        }
        .pay-textarea { resize: vertical; min-height: 72px; line-height: 1.55; }
        .pay-date-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .pay-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 16px;
          border-top: 1px solid #f1f3f5;
          margin-top: 4px;
        }
        .pay-btn-ghost {
          padding: 6px 12px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.01em;
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition: color 0.35s ease, border-color 0.35s ease;
        }
        .pay-btn-ghost::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }
        .pay-btn-ghost::after {
          content: '';
          position: absolute;
          top: -35%;
          left: -38%;
          width: 62%;
          height: 170%;
          background:
            radial-gradient(circle at 30% 50%, rgba(255,255,255,0.30) 0 28%, rgba(255,255,255,0) 58%),
            radial-gradient(circle at 58% 38%, rgba(255,255,255,0.22) 0 24%, rgba(255,255,255,0) 56%),
            radial-gradient(circle at 62% 68%, rgba(255,255,255,0.16) 0 18%, rgba(255,255,255,0) 52%);
          border-radius: 44% 56% 58% 42%;
          transform: translateX(-145%) rotate(8deg);
          transition: transform 0.8s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          opacity: 0.95;
          pointer-events: none;
        }
        .pay-btn-ghost:hover { color: #1f2937 !important; border-color: transparent !important; }
        .pay-btn-ghost:hover::before { transform: translateX(0%); }
        .pay-btn-ghost:hover::after { transform: translateX(255%) rotate(8deg); }
        .pay-btn-primary {
          padding: 6px 12px;
          border: none;
          background: #3b775e;
          color: #fff;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          transition: background 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
          letter-spacing: 0.01em;
        }
        .pay-btn-primary:hover { background: #2f6350; }
        .pay-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        @media (max-width: 768px) {
          .pay-modal {
            max-width: 96vw !important;
            width: 96% !important;
          }
          .pay-date-row {
            grid-template-columns: 1fr !important;
          }
        }
        .pay-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 15px;
        }
        .cp-export-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }
        .cp-export-btn::after {
          content: '';
          position: absolute;
          top: -35%;
          left: -38%;
          width: 62%;
          height: 170%;
          background:
            radial-gradient(circle at 30% 50%, rgba(255,255,255,0.30) 0 28%, rgba(255,255,255,0) 58%),
            radial-gradient(circle at 58% 38%, rgba(255,255,255,0.22) 0 24%, rgba(255,255,255,0) 56%),
            radial-gradient(circle at 62% 68%, rgba(255,255,255,0.16) 0 18%, rgba(255,255,255,0) 52%);
          border-radius: 44% 56% 58% 42%;
          transform: translateX(-145%) rotate(8deg);
          transition: transform 0.8s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          opacity: 0.95;
          pointer-events: none;
        }
        .cp-export-btn:hover { color: #1f2937 !important; border-color: transparent !important; }
        .cp-export-btn:hover::before { transform: translateX(0%); }
        .cp-export-btn:hover::after { transform: translateX(255%) rotate(8deg); }
        .cp-export-btn > * { position: relative; z-index: 1; }

        @keyframes bubble-float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(3px, -4px) scale(1.03); }
        }

        .metric-card::before {
          content: '';
          position: absolute;
          z-index: 0;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.05;
          top: -10px;
          left: -12px;
          pointer-events: none;
          animation: bubble-float 4.5s ease-in-out infinite;
        }

        .metric-card::after {
          content: '';
          position: absolute;
          z-index: 0;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.03;
          right: 20px;
          bottom: -12px;
          pointer-events: none;
          animation: bubble-float 3.8s ease-in-out infinite;
        }

        .metric-card:nth-child(1)::before,
        .metric-card:nth-child(1)::after {
          background: #667eea;
        }

        .metric-card:nth-child(2)::before,
        .metric-card:nth-child(2)::after {
          background: #10b981;
        }

        .metric-card:nth-child(3)::before,
        .metric-card:nth-child(3)::after {
          background: #8b5cf6;
        }

        .cp-tabs-bar {
          display: flex !important;
          flex: 0 0 auto !important;
          align-items: center !important;
          gap: 6px;
          margin-bottom: 20px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 50px;
          padding: 4px 6px;
          width: 100%;
          box-sizing: border-box;
          height: auto !important;
          min-height: 40px;
          max-height: 44px;
        }

        .cp-tab-pill {
          background: transparent;
          color: #64748b;
          border: none;
          border-radius: 50px;
          padding: 7px 18px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          line-height: 1.2;
          white-space: nowrap;
          box-shadow: none;
          outline: none;
        }

        .cp-tab-pill:hover:not(.active) {
          color: #334155;
          background: #f1f5f9;
        }

        .cp-tab-pill.active {
          background: #0596691A !important;
          color: #059669 !important;
        }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '18px',
        gap: '12px',
        flexWrap: 'wrap',
        flex: '0 0 auto'
      }}>
        <div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#0f172a',
            margin: 0,
            letterSpacing: '-0.025em'
          }}>
            Accounts Management
          </h1>
          <p style={{
            fontSize: '13px',
            color: '#94a3b8',
            margin: '4px 0 0',
            fontWeight: 500
          }}>
            Track project payments, invoice and payment status across all projects.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {activeTab === 'payments' && (
            <button
              onClick={handleExportPayments}
              className="cp-export-btn"
            >
              <DownloadIcon />
              <span>Export Excel</span>
            </button>
          )}

          {activeTab === 'invoices' && (
            <div style={{ position: 'relative' }} ref={invoiceMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInvoiceTypeMenu(prev => !prev);
                }}
                className="cp-export-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: showInvoiceTypeMenu ? '#2f6350' : '#3b775e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'none',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#2f6350'}
                onMouseLeave={e => {
                  if (!showInvoiceTypeMenu) e.currentTarget.style.background = '#3b775e';
                }}
              >
                <InvoiceIcon />
                <span>Generate Invoice</span>
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transition: 'transform 0.2s ease',
                    transform: showInvoiceTypeMenu ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {showInvoiceTypeMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '185px',
                    background: '#ffffff',
                    borderRadius: '9px',
                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #e2e8f0',
                    zIndex: 1000,
                    padding: '5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => handleOpenGenInvoice('tax')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '7px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#f0fdf4';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      background: '#ecfdf5',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0f172a',
                      letterSpacing: '-0.015em',
                      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    }}>
                      Tax Invoice
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenGenInvoice('proforma')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '7px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      width: '100%',
                      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#eff6ff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      background: '#eff6ff',
                      color: '#2563eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        <path d="M9 12h6" />
                        <path d="M9 16h6" />
                      </svg>
                    </div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0f172a',
                      letterSpacing: '-0.015em',
                      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    }}>
                      Proforma Invoice
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'payments' && canCreate && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                background: '#3b775e',
                color: '#fff',
                outline: 'none',
                transition: 'background 0.2s ease',
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.01em'
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#2f6350'}
              onMouseLeave={e => e.currentTarget.style.background = '#3b775e'}
            >
              <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                <line x1="7" y1="1" x2="7" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <line x1="1" y1="7" x2="13" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Add Payment
            </button>
          )}
        </div>
      </div>

      {/* Sub-navbar / Tabs */}
      <div className="cp-tabs-bar">
        <button
          type="button"
          className={`cp-tab-pill ${activeTab === 'payments' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('payments')}
        >
          Payment Records
        </button>
        <button
          type="button"
          className={`cp-tab-pill ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => handleTabSwitch('invoices')}
        >
          Invoices
        </button>
      </div>

      {activeTab === 'payments' ? (
        <>
          {/* Stats Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginBottom: '22px'
          }}>
            {[
              { label: "Total Projects", value: stats.total, trend: totalChange, isUp: totalTrend },
              { label: "Total Revenue", value: `₹${Math.round(stats.totalRevenue).toLocaleString()}`, trend: revenueChange, isUp: revenueTrend },
              { label: "Total Paid", value: `₹${Math.round(stats.totalPaid).toLocaleString()}`, trend: paidChange, isUp: paidTrend },
              { label: "Pending", value: `₹${Math.round(stats.pending).toLocaleString()}`, trend: pendingChange, isUp: pendingTrend }
            ].map((item) => (
              <div
                key={item.label}
                className="metric-card"
                style={{
                  position: 'relative',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '10px' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 300, color: '#0f172a', lineHeight: 1, marginBottom: '8px' }}>
                    {item.value}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: item.isUp ? '#a8e63d' : '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {item.isUp ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                          <polyline points="17 18 23 18 23 12" />
                        </svg>
                      )}
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.trend}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>from last month</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Search and Filter Controls */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              position: 'relative',
              flex: '1 1 300px',
              minWidth: '200px'
            }}>
              <div style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none'
              }}>
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search by client name, email, phone, project, or ID..."
                value={searchTerm || ''}
                onChange={e => {
                  setSearchTerm(e.target.value);
                }}
                style={{
                  width: '100%',
                  padding: searchTerm ? '10px 34px 10px 40px' : '10px 14px 10px 40px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#0f172a',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    lineHeight: 1
                  }}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>

            <select
              value={statusFilter || 'all'}
              onChange={e => {
                setStatusFilter(e.target.value);
              }}
              style={{
                padding: '10px 14px',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#475569',
                background: '#fff',
                cursor: 'pointer',
                outline: 'none',
                minWidth: '150px',
                transition: 'all 0.2s ease'
              }}
              onFocus={e => e.target.style.borderColor = '#16a34a'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            >
              <option value="all">All Payment Statuses</option>
              {uniqueStatuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            marginBottom: '16px',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0
          }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px'
              }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>ID</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Client Name</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Email</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Phone</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Project Name</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Payment Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Total Amount</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Paid Amount</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Due Amount</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{
                        padding: '40px 14px',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontWeight: 500,
                        fontSize: '12px'
                      }}>
                        No payment records found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((payment, index) => (
                      <tr
                        key={payment.id}
                        style={{
                          borderBottom: index < paginatedData.length - 1 ? '1px solid #f8fafc' : 'none',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        <td style={{ padding: '11px 14px', color: '#64748b', fontWeight: 500, fontSize: '12px' }}>{payment.id}</td>
                        <td style={{ padding: '11px 14px', color: '#0f172a', fontWeight: 500, fontSize: '12px' }}>{payment.clientName}</td>
                        <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{payment.email}</td>
                        <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px' }}>{payment.phone}</td>
                        <td style={{ padding: '11px 14px', color: '#0f172a', fontWeight: 500, fontSize: '12px' }}>{payment.projectName}</td>
                        <td style={{ padding: '11px 14px' }}>
                          {(() => {
                            const pill = getPaymentPillStyles(payment.paymentStatus);
                            return canEdit ? (
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <select
                                  value={payment.paymentStatus || 'Unpaid'}
                                  onChange={(e) => handlePaymentStatusChange(payment, e.target.value)}
                                  title="Change Payment Status"
                                  style={{
                                    appearance: 'none',
                                    WebkitAppearance: 'none',
                                    MozAppearance: 'none',
                                    background: `${pill.bg} url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${pill.chevron}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>") no-repeat right 9px center`,
                                    color: pill.color,
                                    border: `1.5px solid ${pill.border}`,
                                    borderRadius: '50px',
                                    padding: '4px 24px 4px 11px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    cursor: 'pointer',
                                    outline: 'none',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                    transition: 'all 0.15s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center'
                                  }}
                                  onMouseEnter={(e) => e.target.style.filter = 'brightness(0.96)'}
                                  onMouseLeave={(e) => e.target.style.filter = 'none'}
                                >
                                  <option value="Paid" style={{ background: '#fff', color: '#15803d', fontWeight: 700 }}>PAID</option>
                                  <option value="Partially Paid" style={{ background: '#fff', color: '#b45309', fontWeight: 700 }}>PARTIALLY PAID</option>
                                  <option value="Unpaid" style={{ background: '#fff', color: '#b91c1c', fontWeight: 700 }}>UNPAID</option>
                                </select>
                              </div>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 12px',
                                borderRadius: '50px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                background: pill.bg,
                                color: pill.color,
                                border: `1.5px solid ${pill.border}`
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pill.dot }}></span>
                                {payment.paymentStatus}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right', color: '#0f172a', fontWeight: 600, fontSize: '12px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            ₹{Math.round(payment.totalAmount || payment.baseAmount || 0).toLocaleString()}
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                          <span style={{
                            color: payment.paidAmount >= payment.totalAmount ? '#16a34a' : '#f59e0b',
                            fontWeight: 600,
                            fontSize: '12px'
                          }}>
                            ₹{Math.round(payment.paidAmount).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                          <span style={{
                            color: (payment.totalAmount - payment.paidAmount) <= 0 ? '#16a34a' : '#ef4444',
                            fontWeight: 600,
                            fontSize: '12px'
                          }}>
                            ₹{Math.round(Math.max(0, payment.totalAmount - payment.paidAmount)).toLocaleString()}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', position: 'relative' }}>
                            <button className="cp-action-btn" onClick={() => handleOpenPaymentDetails(payment)} title="View Payment Details">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
                            {(canDelete || canCreate || canEdit) && (
                                <div style={{ position: 'relative' }}>
                                    <button className="cp-action-btn" onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === payment._id ? null : payment._id); }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
                                    </button>
                                    {activeDropdown === payment._id && (
                                        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', background: '#fff', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', zIndex: 100, minWidth: '135px', padding: '4px', textAlign: 'left' }}>
                                            {canCreate && (
                                              <button onClick={() => {
                                                setActiveDropdown(null);
                                                handleOpenPaymentDetails(payment);
                                              }} className="cp-dropdown-item-btn">
                                                Add Payment
                                              </button>
                                            )}
                                            <button onClick={() => {
                                              setActiveDropdown(null);
                                              handleOpenPaymentDetails(payment);
                                            }} className="cp-dropdown-item-btn">
                                              Payment History
                                            </button>
                                            {canEdit && (
                                              <button
                                                onClick={() => {
                                                  setActiveDropdown(null);
                                                  handleMarkAsPaid(payment);
                                                }}
                                                className="cp-dropdown-item-btn"
                                                style={{ color: payment.paymentStatus === 'Paid' ? '#94a3b8' : '#16a34a', fontWeight: 600 }}
                                              >
                                                {payment.paymentStatus === 'Paid' ? '✓ Marked Paid' : 'Mark as Paid'}
                                              </button>
                                            )}
                                            {canEdit && <button onClick={() => handleEditDetailsClick(payment)} className="cp-dropdown-item-btn">Edit Details</button>}
                                            {canDelete && <button onClick={() => { handleDelete(payment); setActiveDropdown(null); }} className="cp-dropdown-item-btn" style={{ color: '#dc2626' }}>Delete</button>}
                                        </div>
                                    )}
                                </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <p style={{
                fontSize: '12px',
                color: '#64748b',
                fontWeight: 500,
                margin: 0
              }}>
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredData.length)} of {filteredData.length} results
              </p>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: currentPage === 1 ? '#f8fafc' : '#fff',
                    color: currentPage === 1 ? '#cbd5e1' : '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.borderColor = '#16a34a';
                      e.currentTarget.style.color = '#16a34a';
                    }
                  }}
                  onMouseLeave={e => {
                    if (currentPage !== 1) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#475569';
                    }
                  }}
                >
                  Previous
                </button>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0 8px'
                }}>
                  {(() => {
                    const pageNumbers = [];
                    let startPage = 1;
                    let endPage = totalPages;

                    if (totalPages > 5) {
                      if (currentPage <= 3) {
                        endPage = 5;
                      } else if (currentPage >= totalPages - 2) {
                        startPage = totalPages - 4;
                      } else {
                        startPage = currentPage - 2;
                        endPage = currentPage + 2;
                      }
                    }

                    for (let i = startPage; i <= endPage; i++) {
                      pageNumbers.push(
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          style={{
                            width: '32px',
                            height: '32px',
                            border: currentPage === i ? '1px solid #16a34a' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            background: currentPage === i ? '#16a34a' : '#fff',
                            color: currentPage === i ? '#fff' : '#475569',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => {
                            if (currentPage !== i) {
                              e.currentTarget.style.borderColor = '#16a34a';
                              e.currentTarget.style.color = '#16a34a';
                            }
                          }}
                          onMouseLeave={e => {
                            if (currentPage !== i) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.color = '#475569';
                            }
                          }}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pageNumbers;
                  })()}
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: currentPage === totalPages ? '#f8fafc' : '#fff',
                    color: currentPage === totalPages ? '#cbd5e1' : '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.borderColor = '#16a34a';
                      e.currentTarget.style.color = '#16a34a';
                    }
                  }}
                  onMouseLeave={e => {
                    if (currentPage !== totalPages) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#475569';
                    }
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Invoices View */}
          {/* Invoices Stats Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            marginBottom: '22px'
          }}>
            {[
              { label: "Total Invoices", value: invoiceStats.total, trend: totalChange, isUp: totalTrend },
              { label: "Total Invoiced", value: `₹${invoiceStats.totalInvoiced.toLocaleString()}`, trend: revenueChange, isUp: revenueTrend },
              { label: "Total Paid", value: `₹${invoiceStats.totalPaid.toLocaleString()}`, trend: paidChange, isUp: paidTrend },
              { label: "Total Outstanding", value: `₹${invoiceStats.pending.toLocaleString()}`, trend: pendingChange, isUp: pendingTrend }
            ].map((item) => (
              <div
                key={item.label}
                className="metric-card"
                style={{
                  position: 'relative',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  overflow: 'hidden'
                }}
              >
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, marginBottom: '10px' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 300, color: '#0f172a', lineHeight: 1, marginBottom: '8px' }}>
                    {item.value}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ color: item.isUp ? '#a8e63d' : '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                      {item.isUp ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                          <polyline points="17 6 23 6 23 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                          <polyline points="17 18 23 18 23 12" />
                        </svg>
                      )}
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.trend}</span>
                    </span>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>from last month</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Invoices Search and Filter */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <div style={{
              position: 'relative',
              flex: '1 1 300px',
              minWidth: '200px'
            }}>
              <div style={{
                position: 'absolute',
                left: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                pointerEvents: 'none'
              }}>
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Search by invoice number, client name, project, or generated by..."
                value={invoiceSearchTerm || ''}
                onChange={e => {
                  setInvoiceSearchTerm(e.target.value);
                  setInvoiceCurrentPage(1);
                }}
                style={{
                  width: '100%',
                  padding: invoiceSearchTerm ? '10px 34px 10px 40px' : '10px 14px 10px 40px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#0f172a',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
              {invoiceSearchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceSearchTerm('');
                    setInvoiceCurrentPage(1);
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    lineHeight: 1
                  }}
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Invoices Table */}
          <div style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            marginBottom: '16px',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0
          }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '12px'
              }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #f1f5f9' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px', width: '60px' }}>Sr No</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Invoice No</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Invoice Type</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Client Name</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Project</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Generated On</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Generated By</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Status</th>
                    <th style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap', fontSize: '11px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{
                        padding: '40px 14px',
                        textAlign: 'center',
                        color: '#94a3b8',
                        fontWeight: 500,
                        fontSize: '12px'
                      }}>
                        No invoices found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedInvoices.map((inv, index) => (
                      <tr
                        key={inv.invoiceNo || index}
                        style={{
                          borderBottom: index < paginatedInvoices.length - 1 ? '1px solid #f8fafc' : 'none',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                      >
                        <td style={{ padding: '11px 14px', color: '#64748b', fontWeight: 500, fontSize: '12px' }}>
                          {((invoiceCurrentPage - 1) * ITEMS_PER_PAGE) + index + 1}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#0f172a', fontWeight: 500, fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {inv.invoiceNo}
                        </td>
                        <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const isProf = inv.invoiceCategory === 'proforma' || String(inv.invoiceNo).startsWith('PI/');
                            return isProf ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 10px',
                                borderRadius: '50px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                gap: '4px',
                                letterSpacing: '0.01em'
                              }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                                </svg>
                                Proforma Invoice
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 10px',
                                borderRadius: '50px',
                                fontSize: '11px',
                                fontWeight: 600,
                                background: '#ecfdf5',
                                color: '#059669',
                                border: '1px solid #a7f3d0',
                                gap: '4px',
                                letterSpacing: '0.01em'
                              }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>
                                Tax Invoice
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {(() => {
                            const badge = getClientBadgeStyle(inv.clientName);
                            return (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px 12px',
                                borderRadius: '50px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                background: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                letterSpacing: '0.01em'
                              }}>
                                {inv.clientName || '-'}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#0f172a', fontWeight: 500, fontSize: '12px' }}>
                          {inv.projectName || inv.itemDescription || '-'}
                        </td>
                        <td style={{ padding: '11px 14px', color: '#475569', fontWeight: 500, fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {formatDDMMYYYY(inv.generatedOn || inv.invoiceDate)}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '50%',
                              background: '#e0e7ff',
                              color: '#4338ca',
                              fontSize: '10px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {(inv.generatedBy || 'A').charAt(0).toUpperCase()}
                            </span>
                            <span style={{ color: '#0f172a', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>
                              {inv.generatedBy || 'Admin'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '4px 12px',
                            borderRadius: '50px',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.02em',
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            gap: '4px'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }}></span>
                            Generated
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                            <button className="cp-action-btn" onClick={() => handleViewInvoice(inv.rawPayment || inv)} title="View Invoice">
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            </button>
                            <button className="cp-action-btn" onClick={() => handleViewInvoice(inv.rawPayment || inv, true)} title="Download PDF">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            </button>
                            {(canDelete || canCreate || canEdit) && (
                              <div style={{ position: 'relative' }}>
                                <button
                                  className="cp-action-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdown(activeDropdown === `inv-${inv.invoiceNo}` ? null : `inv-${inv.invoiceNo}`);
                                  }}
                                  title="More Actions"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="1" />
                                    <circle cx="12" cy="5" r="1" />
                                    <circle cx="12" cy="19" r="1" />
                                  </svg>
                                </button>
                                {activeDropdown === `inv-${inv.invoiceNo}` && (
                                  <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    marginTop: '4px',
                                    background: '#fff',
                                    borderRadius: '8px',
                                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                    border: '1px solid #e5e7eb',
                                    zIndex: 100,
                                    minWidth: '120px',
                                    padding: '4px',
                                    textAlign: 'left'
                                  }}>
                                    {(canEdit || canCreate) && (
                                      <button
                                        onClick={() => {
                                          setActiveDropdown(null);
                                          handleRegenerateInvoice(inv.rawPayment || inv);
                                        }}
                                        className="cp-dropdown-item-btn"
                                      >
                                        Regenerate
                                      </button>
                                    )}
                                    {canDelete && (
                                      <button
                                        onClick={() => {
                                          setActiveDropdown(null);
                                          handleDeleteInvoice(inv);
                                        }}
                                        className="cp-dropdown-item-btn"
                                        style={{ color: '#dc2626' }}
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoices Pagination */}
          {invoiceTotalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <p style={{
                fontSize: '12px',
                color: '#64748b',
                fontWeight: 500,
                margin: 0
              }}>
                Showing {((invoiceCurrentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(invoiceCurrentPage * ITEMS_PER_PAGE, filteredInvoices.length)} of {filteredInvoices.length} results
              </p>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setInvoiceCurrentPage(p => Math.max(1, p - 1))}
                  disabled={invoiceCurrentPage === 1}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: invoiceCurrentPage === 1 ? '#f8fafc' : '#fff',
                    color: invoiceCurrentPage === 1 ? '#cbd5e1' : '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: invoiceCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    if (invoiceCurrentPage !== 1) {
                      e.currentTarget.style.borderColor = '#16a34a';
                      e.currentTarget.style.color = '#16a34a';
                    }
                  }}
                  onMouseLeave={e => {
                    if (invoiceCurrentPage !== 1) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#475569';
                    }
                  }}
                >
                  Previous
                </button>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '0 8px'
                }}>
                  {(() => {
                    const pageNumbers = [];
                    let startPage = 1;
                    let endPage = invoiceTotalPages;

                    if (invoiceTotalPages > 5) {
                      if (invoiceCurrentPage <= 3) {
                        endPage = 5;
                      } else if (invoiceCurrentPage >= invoiceTotalPages - 2) {
                        startPage = invoiceTotalPages - 4;
                      } else {
                        startPage = invoiceCurrentPage - 2;
                        endPage = invoiceCurrentPage + 2;
                      }
                    }

                    for (let i = startPage; i <= endPage; i++) {
                      pageNumbers.push(
                        <button
                          key={i}
                          onClick={() => setInvoiceCurrentPage(i)}
                          style={{
                            width: '32px',
                            height: '32px',
                            border: invoiceCurrentPage === i ? '1px solid #16a34a' : '1px solid #e2e8f0',
                            borderRadius: '6px',
                            background: invoiceCurrentPage === i ? '#16a34a' : '#fff',
                            color: invoiceCurrentPage === i ? '#fff' : '#475569',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => {
                            if (invoiceCurrentPage !== i) {
                              e.currentTarget.style.borderColor = '#16a34a';
                              e.currentTarget.style.color = '#16a34a';
                            }
                          }}
                          onMouseLeave={e => {
                            if (invoiceCurrentPage !== i) {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                              e.currentTarget.style.color = '#475569';
                            }
                          }}
                        >
                          {i}
                        </button>
                      );
                    }
                    return pageNumbers;
                  })()}
                </div>

                <button
                  onClick={() => setInvoiceCurrentPage(p => Math.min(invoiceTotalPages, p + 1))}
                  disabled={invoiceCurrentPage === invoiceTotalPages}
                  style={{
                    padding: '8px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: invoiceCurrentPage === invoiceTotalPages ? '#f8fafc' : '#fff',
                    color: invoiceCurrentPage === invoiceTotalPages ? '#cbd5e1' : '#475569',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: invoiceCurrentPage === invoiceTotalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={e => {
                    if (invoiceCurrentPage !== invoiceTotalPages) {
                      e.currentTarget.style.borderColor = '#16a34a';
                      e.currentTarget.style.color = '#16a34a';
                    }
                  }}
                  onMouseLeave={e => {
                    if (invoiceCurrentPage !== invoiceTotalPages) {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.color = '#475569';
                    }
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && selectedInvoicePayment && (() => {
        const p = selectedInvoicePayment;
        const dueAmount = Math.max(0, p.totalAmount - p.paidAmount);
        const paidPct = p.totalAmount > 0 ? Math.round((p.paidAmount / p.totalAmount) * 100) : 0;
        const invoiceDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const invoiceNum = p.invoiceNo || (String(p.id).startsWith('PRJ') ? `INV-${p.id}` : (String(p.id).startsWith('INV-') ? p.id : `INV-PRJ${String(p.id).padStart(4, '0')}`));
        return (
          <div
            style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(15,23,42,0.55)',
              backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1100, padding: '24px'
            }}
            onClick={() => setShowInvoiceModal(false)}
          >
            <style>{`
              @keyframes invModalIn {
                from { opacity: 0; transform: translateY(20px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
              .inv-modal {
                background: #fff;
                border-radius: 20px;
                width: 100%;
                max-width: 680px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
                font-family: 'Inter', 'Segoe UI', sans-serif;
                animation: invModalIn 0.25s cubic-bezier(0.16,1,0.3,1);
                scrollbar-width: none;
              }
              .inv-modal::-webkit-scrollbar { display: none; }
              @media (max-width: 768px) {
                .inv-modal {
                  max-width: 96vw !important;
                  width: 96% !important;
                  border-radius: 14px !important;
                }
                .inv-modal > div {
                  padding-left: 16px !important;
                  padding-right: 16px !important;
                }
              }
            `}</style>
            <div className="inv-modal" onClick={e => e.stopPropagation()}>

              {/* Modal Top Bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 24px', borderBottom: '1px solid #f1f5f9',
                background: '#fafbfc', borderRadius: '20px 20px 0 0', position: 'sticky', top: 0, zIndex: 1
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="8" y1="13" x2="16" y2="13" />
                      <line x1="8" y1="17" x2="16" y2="17" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Invoice Preview</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{invoiceNum}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handlePrintInvoice(p)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', border: 'none', borderRadius: '8px',
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      color: '#fff', fontSize: '11.5px', fontWeight: 600,
                      cursor: 'pointer', transition: 'opacity 0.2s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download PDF
                  </button>
                  <button
                    onClick={() => setShowInvoiceModal(false)}
                    style={{
                      width: '30px', height: '30px', borderRadius: '8px',
                      border: '1px solid #e2e8f0', background: '#fff',
                      color: '#64748b', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748b'; }}
                  >
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Invoice Body */}
              <div style={{ padding: '32px 40px 40px', background: '#fff' }}>

                {/* Company Header */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  paddingBottom: '20px', borderBottom: '3px solid #3b775e', marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <img src="/logo.png" alt="Bhoomi Techzone" style={{ width: '60px', height: '60px', objectFit: 'contain' }} />
                    <div>
                      <div style={{
                        fontSize: '26px', fontWeight: 700, color: '#3b775e',
                        letterSpacing: '-0.5px', marginBottom: '4px'
                      }}>
                        Bhoomi Techzone
                      </div>
                      <div style={{ fontSize: '10px', color: '#666', lineHeight: 1.7 }}>
                        Noida Sector 63, Uttar Pradesh<br />
                        Email: info@bhoomitechzone.com
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#3b775e', marginBottom: '8px', letterSpacing: '-1px' }}>INVOICE</div>
                    <div style={{ fontSize: '11px', color: '#444', lineHeight: 1.8 }}>
                      <strong>Invoice #:</strong> {invoiceNum}<br />
                      <strong>Date:</strong> {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}<br />
                      <strong>Project ID:</strong> PRJ{String(p.id).replace(/^PRJ/i, '').padStart(4, '0')}
                    </div>
                  </div>
                </div>

                {/* Client & Project Info Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                  <div style={{ flex: 1, marginRight: '20px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: '8px' }}>Bill To:</div>
                    <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
                      <strong style={{ fontSize: '12px', color: '#000' }}>{p.clientName}</strong><br />
                      {p.email}<br />
                      {p.phone}
                    </div>
                  </div>
                  <div style={{ flex: 1, marginRight: '20px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: '8px' }}>Project Details:</div>
                    <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
                      <strong style={{ fontSize: '12px', color: '#000' }}>{p.projectName}</strong><br />
                      Status: {p.projectStatus}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#666', marginBottom: '8px' }}>Payment Terms:</div>
                    <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
                      Due on Receipt<br />
                      Currency: INR (₹)
                    </div>
                  </div>
                </div>

                {/* Services Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', border: '2px solid #3b775e' }}>
                  <thead style={{ background: '#3b775e', color: '#fff' }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, width: '8%', borderRight: '1px solid #56a07a' }}>#</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, width: '52%', borderRight: '1px solid #56a07a' }}>Description</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '11px', fontWeight: 600, width: '20%', borderRight: '1px solid #56a07a' }}>Quantity</th>
                      <th style={{ padding: '12px', textAlign: 'right', fontSize: '11px', fontWeight: 600, width: '20%' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '2px solid #3b775e' }}>
                      <td style={{ padding: '14px 12px', fontSize: '11px', color: '#333' }}>1</td>
                      <td style={{ padding: '14px 12px', fontSize: '11px' }}>
                        <strong style={{ color: '#000' }}>{p.projectName}</strong><br />
                        <span style={{ fontSize: '10px', color: '#666' }}>Project Services & Deliverables</span>
                      </td>
                      <td style={{ padding: '14px 12px', fontSize: '11px', color: '#333' }}>1</td>
                      <td style={{ padding: '14px 12px', fontSize: '11px', textAlign: 'right', fontWeight: 600, color: '#000' }}>₹{p.totalAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Totals Section */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                  <div style={{ width: '300px', border: '2px solid #3b775e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#f8faf9', borderBottom: '1px solid #e0e0e0' }}>
                      <span style={{ fontSize: '12px', color: '#444', fontWeight: 500 }}>Subtotal:</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#000' }}>₹{p.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e0e0e0' }}>
                      <span style={{ fontSize: '12px', color: '#444', fontWeight: 500 }}>Tax (0%):</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#000' }}>₹0</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#3b775e', color: '#fff' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>Total Amount:</span>
                      <span style={{ fontSize: '13px', fontWeight: 700 }}>₹{p.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #e0e0e0' }}>
                      <span style={{ fontSize: '12px', color: '#444', fontWeight: 500 }}>Amount Paid:</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#16a34a' }}>₹{p.paidAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: '#fff7ed' }}>
                      <span style={{ fontSize: '12px', color: '#444', fontWeight: 500 }}>Balance Due:</span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#ea580c' }}>₹{dueAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Status */}
                <div style={{ margin: '20px 0', padding: '14px', background: '#f0fdf4', borderLeft: '4px solid #16a34a', borderRadius: '4px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', marginBottom: '8px' }}>Payment Status: {paidPct}% Completed</div>
                  <div style={{ height: '6px', background: '#d1fae5', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                    <div style={{
                      height: '100%', background: '#16a34a', width: `${paidPct}%`, transition: 'width 0.3s'
                    }} />
                  </div>
                  <div style={{ fontSize: '10px', color: '#166534', fontWeight: 500 }}>
                    ${paidPct >= 100 ? 'Payment Fully Settled' : `₹${dueAmount.toLocaleString('en-IN')} remaining`}
                  </div>
                </div>

                {/* Notes Section */}
                <div style={{ padding: '14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '4px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase' }}>Payment Instructions & Notes:</div>
                  <div style={{ fontSize: '10px', color: '#6b7280', lineHeight: 1.8 }}>
                    • Payment should be made within 15 days of invoice date<br />
                    • Please reference invoice number {invoiceNum} with your payment<br />
                    • For any queries, contact us at info@bhoomitechzone.com<br />
                    • Thank you for your business!
                  </div>
                </div>

                {/* Footer */}
                <div style={{ paddingTop: '20px', borderTop: '2px solid #e5e7eb', textAlign: 'center' }}>
                  <div style={{ fontSize: '10px', color: '#9ca3af', margin: '4px 0' }}>
                    This is a computer-generated invoice and does not require a physical signature
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#3b775e', marginTop: '8px' }}>
                    Bhoomi Techzone © {new Date().getFullYear()}
                  </div>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* Generate Invoice Modal */}
      {showGenInvoiceModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1200, padding: '20px'
          }}
          onClick={() => setShowGenInvoiceModal(false)}
        >
          <>
            <style>{`
              @keyframes genInvModalIn {
                from { opacity: 0; transform: translateY(18px) scale(0.97); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
              .gen-inv-modal {
                background: #fff;
                border-radius: 18px;
                width: 100%;
                max-width: 720px;
                max-height: 92vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.18);
                font-family: 'Inter', 'Segoe UI', sans-serif;
                animation: genInvModalIn 0.24s cubic-bezier(0.16,1,0.3,1);
                scrollbar-width: thin;
                scrollbar-color: #e2e8f0 transparent;
              }
              .gen-inv-modal::-webkit-scrollbar { width: 5px; }
              .gen-inv-modal::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
              .gi-hd {
                display: flex; align-items: center; gap: 12px;
                padding: 18px 22px 16px;
                border-bottom: 1px solid #f1f5f9;
                background: #fafbfc;
                border-radius: 18px 18px 0 0;
                position: sticky; top: 0; z-index: 10;
              }
              .gi-hd-icon {
                width: 38px; height: 38px; border-radius: 10px;
                background: linear-gradient(135deg,#6366f1,#8b5cf6);
                display: flex; align-items: center; justify-content: center; flex-shrink: 0;
              }
              .gi-title { font-size: 14px; font-weight: 700; color: #111827; letter-spacing: -0.01em; }
              .gi-sub { font-size: 11.5px; color: #9ca3af; margin-top: 2px; }
              .gi-close {
                margin-left: auto; width: 28px; height: 28px; border-radius: 50%;
                background: #f1f5f9; border: none; cursor: pointer;
                display: flex; align-items: center; justify-content: center;
                color: #6b7280; transition: background 0.15s, color 0.15s;
              }
              .gi-close:hover { background: #e2e8f0; color: #111827; }
              .gi-body { padding: 22px; }
              .gi-section-lbl {
                font-size: 10px; font-weight: 700; color: #6366f1;
                text-transform: uppercase; letter-spacing: 0.08em;
                padding-bottom: 6px; border-bottom: 1.5px solid #e0e7ff;
                margin: 16px 0 12px;
              }
              .gi-section-lbl:first-child { margin-top: 0; }
              .gi-grid { display: grid; gap: 12px; }
              .gi-grid-2 { grid-template-columns: 1fr 1fr; }
              .gi-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
              .gi-field { display: flex; flex-direction: column; gap: 5px; }
              .gi-lbl { font-size: 11px; font-weight: 600; color: #374151; letter-spacing: 0.02em; }
              .gi-req { color: #ef4444; margin-left: 2px; }
              .gi-input {
                width: 100%; padding: 9px 11px;
                border: 1.5px solid #e5e7eb; border-radius: 8px;
                font-size: 12.5px; color: #111827; background: #fff;
                font-family: 'Inter', sans-serif; box-sizing: border-box;
                transition: border-color 0.15s, box-shadow 0.15s; outline: none;
              }
              .gi-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
              .gi-input::placeholder { color: #c4c9d4; font-size: 12px; }
              .gi-select {
                appearance: none;
                background: #fff url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 11px center;
              }
              .gi-footer {
                display: flex; justify-content: flex-end; gap: 8px;
                padding: 18px 22px 20px;
                border-top: 1px solid #f1f5f9;
              }
              .gi-btn-cancel {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                padding: 7px 16px;
                border: 1.5px solid #e5e7eb;
                border-radius: 7px;
                background: #fff;
                color: #6b7280;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                font-family: 'Inter', sans-serif;
                letter-spacing: 0.01em;
                position: relative;
                isolation: isolate;
                overflow: hidden;
                transition: color 0.35s ease, border-color 0.35s ease;
              }
              .gi-btn-cancel::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
                transform: translateX(-110%);
                transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
                z-index: 0;
                pointer-events: none;
              }
              .gi-btn-cancel::after {
                content: '';
                position: absolute;
                top: -35%;
                left: -38%;
                width: 62%;
                height: 170%;
                background:
                  radial-gradient(circle at 30% 50%, rgba(255,255,255,0.30) 0 28%, rgba(255,255,255,0) 58%),
                  radial-gradient(circle at 58% 38%, rgba(255,255,255,0.22) 0 24%, rgba(255,255,255,0) 56%),
                  radial-gradient(circle at 62% 68%, rgba(255,255,255,0.16) 0 18%, rgba(255,255,255,0) 52%);
                border-radius: 44% 56% 58% 42%;
                transform: translateX(-145%) rotate(8deg);
                transition: transform 0.8s cubic-bezier(0.22, 0.61, 0.36, 1);
                z-index: 0;
                opacity: 0.95;
                pointer-events: none;
              }
              .gi-btn-cancel:hover { color: #1f2937 !important; border-color: transparent !important; }
              .gi-btn-cancel:hover::before { transform: translateX(0%); }
              .gi-btn-cancel:hover::after { transform: translateX(255%) rotate(8deg); }
              .gi-btn-cancel > * { position: relative; z-index: 1; }
              .gi-btn-generate {
                padding: 7px 18px; border: none; border-radius: 7px;
                background: #3b775e;
                color: #fff; font-size: 12px; font-weight: 600;
                cursor: pointer; font-family: 'Inter', sans-serif;
                display: flex; align-items: center; gap: 6px;
                transition: all 0.2s;
                box-shadow: 0 2px 6px rgba(59, 119, 94, 0.25);
              }
              .gi-btn-generate:hover { 
                background: #2f6350;
                box-shadow: 0 4px 10px rgba(59, 119, 94, 0.35);
                transform: translateY(-1px);
              }
              .gi-info-box {
                background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
                border: 1.5px solid #e2e8f0;
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.04);
              }
              .gi-company-header {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 14px;
                padding-bottom: 12px;
                border-bottom: 1.5px solid #e2e8f0;
              }
              .gi-company-icon {
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
              }
              .gi-company-name {
                font-size: 14px;
                font-weight: 700;
                color: #0f172a;
                letter-spacing: -0.01em;
              }
              .gi-company-details {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
              }
              .gi-detail-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                font-size: 11px;
                color: #475569;
                line-height: 1.5;
              }
              .gi-detail-icon {
                width: 16px;
                height: 16px;
                flex-shrink: 0;
                margin-top: 1px;
              }
              .gi-detail-content {
                flex: 1;
              }
              .gi-detail-label {
                font-weight: 600;
                color: #64748b;
                font-size: 9.5px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 2px;
              }
              .gi-detail-value {
                color: #0f172a;
                font-weight: 500;
              }
              @media (max-width: 768px) {
                .gen-inv-modal {
                  max-width: 96vw !important;
                  width: 96% !important;
                }
                .gi-body {
                  padding: 14px !important;
                }
                .gi-grid-2 {
                  grid-template-columns: 1fr !important;
                }
                .gi-grid-3 {
                  grid-template-columns: 1fr !important;
                }
                .gi-company-details {
                  grid-template-columns: 1fr !important;
                }
                .gi-footer {
                  padding: 14px !important;
                }
              }
            `}</style>

            <div className="gen-inv-modal" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="gi-hd" style={{
                background: genInvoiceForm.invoiceCategory === 'proforma'
                  ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)'
                  : 'linear-gradient(135deg, #244d3d 0%, #3b775e 100%)'
              }}>
                <div className="gi-hd-icon" style={{
                  background: genInvoiceForm.invoiceCategory === 'proforma' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.15)'
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="8" y1="13" x2="16" y2="13" />
                    <line x1="8" y1="17" x2="16" y2="17" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="gi-title">
                    {genInvoiceForm.invoiceCategory === 'proforma' ? 'Generate Proforma Invoice' : 'Generate Tax Invoice'}
                  </div>
                  <div className="gi-sub">
                    {genInvoiceForm.invoiceCategory === 'proforma'
                      ? 'Fill in quotation details — Pre-invoice estimate'
                      : 'Fill in the details below — Bhoomi Techzone info is pre-filled'}
                  </div>
                </div>
                <button className="gi-close" type="button" onClick={() => setShowGenInvoiceModal(false)}>
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="gi-body">

                {/* Pre-fill from project (optional) */}
                <div className="gi-section-lbl">Quick Fill from Project (Optional)</div>
                <div className="gi-field">
                  <label className="gi-lbl">Select existing project to auto-fill client &amp; amount</label>
                  <select
                    className="gi-input gi-select"
                    value={genInvoiceForm.prefillProjectId}
                    onChange={e => handleGenInvoicePrefill(e.target.value)}
                  >
                    <option value="">— Select a project —</option>
                    {paymentData.map(proj => (
                      <option key={proj._id} value={proj._id}>
                        {proj.id} — {proj.projectName} ({proj.clientName})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice Details */}
                <div className="gi-section-lbl">
                  {genInvoiceForm.invoiceCategory === 'proforma' ? 'Proforma Invoice Details' : 'Invoice Details'}
                </div>
                <div className="gi-grid gi-grid-3">
                  <div className="gi-field">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <label className="gi-lbl" style={{ margin: 0 }}>
                        {genInvoiceForm.invoiceCategory === 'proforma' ? 'Proforma No' : 'Invoice No'} <span className="gi-req">*</span>
                      </label>
                      <span style={{
                        fontSize: '10px',
                        color: '#059669',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        background: '#ecfdf5',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #a7f3d0'
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        Editable
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="text"
                          className="gi-input"
                          value={genInvoiceForm.invoiceNo}
                          onChange={e => setGenInvoiceForm(f => ({ ...f, invoiceNo: e.target.value }))}
                          onBlur={e => setGenInvoiceForm(f => ({ ...f, invoiceNo: formatInvoiceNumberInput(e.target.value, f.invoiceCategory) }))}
                          placeholder={genInvoiceForm.invoiceCategory === 'proforma' ? 'e.g. PI/26-27/001' : 'e.g. BT/26-27/026'}
                          style={{
                            background: '#ffffff',
                            fontWeight: 600,
                            color: '#0f172a',
                            letterSpacing: '0.01em',
                            paddingRight: '10px'
                          }}
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setGenInvoiceForm(f => ({ ...f, invoiceNo: getNextInvoiceNum(f.invoiceCategory) }))}
                        title="Reset / Generate next automatic sequence number"
                        style={{
                          padding: '7px 10px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: '#f8fafc',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: '8px',
                          color: '#475569',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          height: '38px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.color = '#2563eb'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                        Auto
                      </button>
                    </div>
                    <span style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>
                      Editable field — type custom number or click <b>Auto</b> for sequence.
                    </span>
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">
                      {genInvoiceForm.invoiceCategory === 'proforma' ? 'Issue Date' : 'Invoice Date'} <span className="gi-req">*</span>
                    </label>
                    <input type="date" className="gi-input" value={genInvoiceForm.invoiceDate}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, invoiceDate: e.target.value }))} required />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">Due Date</label>
                    <input type="date" className="gi-input" value={genInvoiceForm.dueDate}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                </div>

                {/* Billed By (static info display) */}
                <div className="gi-section-lbl">Billed By (Company Information)</div>
                <div className="gi-info-box">
                  <div className="gi-company-header">
                    <div className="gi-company-icon" style={{
                      background: genInvoiceForm.invoiceCategory === 'proforma'
                        ? 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)'
                        : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </div>
                    <div className="gi-company-name">Bhoomi Techzone Private Limited</div>
                  </div>
                  <div className="gi-company-details">
                    <div className="gi-detail-item">
                      <svg className="gi-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                      </svg>
                      <div className="gi-detail-content">
                        <div className="gi-detail-label">GSTIN</div>
                        <div className="gi-detail-value">09AAMCB0572D1ZS</div>
                      </div>
                    </div>
                    <div className="gi-detail-item">
                      <svg className="gi-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <div className="gi-detail-content">
                        <div className="gi-detail-label">Address</div>
                        <div className="gi-detail-value">3rd Floor, Office No 308, A-43, Sector 63, Noida – 201301, Uttar Pradesh</div>
                      </div>
                    </div>
                    <div className="gi-detail-item">
                      <svg className="gi-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <div className="gi-detail-content">
                        <div className="gi-detail-label">Phone</div>
                        <div className="gi-detail-value">+91 9650017061</div>
                      </div>
                    </div>
                    <div className="gi-detail-item">
                      <svg className="gi-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <polyline points="3,8 12,13 21,8" />
                      </svg>
                      <div className="gi-detail-content">
                        <div className="gi-detail-label">Email</div>
                        <div className="gi-detail-value">info@bhoomitechzone.in</div>
                      </div>
                    </div>
                    <div className="gi-detail-item">
                      <svg className="gi-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                      </svg>
                      <div className="gi-detail-content">
                        <div className="gi-detail-label">PAN</div>
                        <div className="gi-detail-value">AAMCB0572D</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bill To */}
                <div className="gi-section-lbl">Bill To</div>
                <div className="gi-grid gi-grid-2">
                  <div className="gi-field">
                    <label className="gi-lbl">Client / Business Name <span className="gi-req">*</span></label>
                    <input className="gi-input" value={genInvoiceForm.clientName}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientName: e.target.value }))}
                      placeholder="e.g. AstroTripathi" required />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">Email</label>
                    <input type="email" className="gi-input" value={genInvoiceForm.clientEmail}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientEmail: e.target.value }))}
                      placeholder="client@example.com" />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">Phone</label>
                    <input className="gi-input" value={genInvoiceForm.clientPhone}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientPhone: e.target.value }))}
                      placeholder="+91 XXXXXXXXXX" />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">
                      {genInvoiceForm.invoiceCategory === 'proforma' ? 'GSTIN (Optional)' : 'GSTIN'}
                    </label>
                    <input className="gi-input" value={genInvoiceForm.clientGstin}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientGstin: e.target.value }))}
                      placeholder={genInvoiceForm.invoiceCategory === 'proforma' ? 'Optional' : 'e.g. 09XXXXXX'} />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">PAN</label>
                    <input className="gi-input" value={genInvoiceForm.clientPan}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientPan: e.target.value }))}
                      placeholder="e.g. ABCDE1234F" />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">State</label>
                    <input className="gi-input" value={genInvoiceForm.clientState}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientState: e.target.value }))}
                      placeholder="e.g. Uttar Pradesh" />
                  </div>
                </div>
                <div className="gi-grid" style={{ marginTop: '12px' }}>
                  <div className="gi-field">
                    <label className="gi-lbl">Address</label>
                    <input className="gi-input" value={genInvoiceForm.clientAddress}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientAddress: e.target.value }))}
                      placeholder="Full address" />
                  </div>
                </div>
                <div className="gi-grid gi-grid-2" style={{ marginTop: '12px' }}>
                  <div className="gi-field">
                    <label className="gi-lbl">City / District</label>
                    <input className="gi-input" value={genInvoiceForm.clientCity}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientCity: e.target.value }))}
                      placeholder="e.g. Lucknow" />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">Postal Code</label>
                    <input className="gi-input" value={genInvoiceForm.clientPostalCode}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, clientPostalCode: e.target.value }))}
                      placeholder="e.g. 226001" />
                  </div>
                </div>

                {/* Service / Item */}
                <div className="gi-section-lbl">
                  {genInvoiceForm.invoiceCategory === 'proforma' ? 'Service / Scope Details' : 'Service / Item Details'}
                </div>
                <div className="gi-field" style={{ marginBottom: '12px' }}>
                  <label className="gi-lbl">
                    {genInvoiceForm.invoiceCategory === 'proforma' ? 'Service / Milestone Description' : 'Item Description'} <span className="gi-req">*</span>
                  </label>
                  <input className="gi-input" value={genInvoiceForm.itemDescription}
                    onChange={e => setGenInvoiceForm(f => ({ ...f, itemDescription: e.target.value }))}
                    placeholder="e.g. Dynamic Web Development" required />
                </div>

                <div className="gi-field" style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label className="gi-lbl" style={{ margin: 0 }}>
                      Item Scope / Description Points <span style={{ fontWeight: 'normal', color: '#6b7280', fontSize: '11px' }}>(Optional)</span>
                    </label>
                    <span style={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                      💡 Add line-by-line points to display on invoice
                    </span>
                  </div>
                  <textarea
                    className="gi-input"
                    rows={3}
                    value={genInvoiceForm.itemDetails || ''}
                    onChange={e => setGenInvoiceForm(f => ({ ...f, itemDetails: e.target.value }))}
                    placeholder={"• Scope / Feature point 1\n• Scope / Feature point 2\n• Deliverable details"}
                    style={{
                      resize: 'vertical',
                      minHeight: '72px',
                      lineHeight: '1.5',
                      padding: '8px 10px',
                      fontSize: '12.5px'
                    }}
                  />
                </div>
                
                <div className="gi-grid gi-grid-3">
                  <div className="gi-field">
                    <label className="gi-lbl">HSN/SAC Code</label>
                    <input className="gi-input" value={genInvoiceForm.hsnSac}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, hsnSac: e.target.value }))}
                      placeholder="e.g. 998314" />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">Rate (₹) <span className="gi-req">*</span></label>
                    <input type="number" min="0" step="0.01" className="gi-input" value={genInvoiceForm.rate}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, rate: e.target.value }))}
                      placeholder="e.g. 50000" required />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">Quantity</label>
                    <input type="number" min="1" step="1" className="gi-input" value={genInvoiceForm.qty}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, qty: e.target.value }))}
                      placeholder="1" />
                  </div>
                </div>

                <div className="gi-grid gi-grid-2" style={{ marginTop: '12px' }}>
                  <div className="gi-field">
                    <label className="gi-lbl">Discount (₹)</label>
                    <input type="number" min="0" step="0.01" className="gi-input" value={genInvoiceForm.discount}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, discount: e.target.value }))}
                      placeholder="0" />
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">
                      {genInvoiceForm.invoiceCategory === 'proforma' ? 'Advance / Received Amount (₹)' : 'Advance Amount Paid (₹)'}
                    </label>
                    <input type="number" min="0" step="0.01" className="gi-input" value={genInvoiceForm.advanceAmount}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, advanceAmount: e.target.value }))}
                      placeholder="0" />
                  </div>
                </div>

                {/* GST Details */}
                <div className="gi-section-lbl">GST Details</div>
                <div className="gi-grid gi-grid-2">
                  <div className="gi-field">
                    <label className="gi-lbl">GST Type</label>
                    <select className="gi-input gi-select" value={genInvoiceForm.gstType}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, gstType: e.target.value }))}>
                      <option value="cgst_sgst">CGST + SGST (Intra-state)</option>
                      <option value="igst">IGST (Inter-state)</option>
                      <option value="none">No GST / Exempt</option>
                    </select>
                  </div>
                  <div className="gi-field">
                    <label className="gi-lbl">GST Rate (%)</label>
                    <select className="gi-input gi-select" value={genInvoiceForm.gstRate}
                      onChange={e => setGenInvoiceForm(f => ({ ...f, gstRate: e.target.value }))}>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>

                {/* Live preview of totals */}
                {genInvoiceForm.rate && (
                  (() => {
                    const isProf = genInvoiceForm.invoiceCategory === 'proforma';
                    const rate = parseFloat(genInvoiceForm.rate) || 0;
                    const qty = parseFloat(genInvoiceForm.qty) || 1;
                    const disc = parseFloat(genInvoiceForm.discount) || 0;
                    const lineTotal = rate * qty - disc;
                    const gstRate = parseFloat(genInvoiceForm.gstRate) || 0;
                    const gstAmt = genInvoiceForm.gstType === 'none' ? 0 : Math.round(lineTotal * gstRate / 100);
                    const subTotal = lineTotal + gstAmt;
                    const advance = parseFloat(genInvoiceForm.advanceAmount) || 0;
                    const pending = Math.max(0, subTotal - advance);
                    return (
                      <div style={{ marginTop: '16px', background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{
                          padding: '8px 14px',
                          background: isProf ? '#eff6ff' : '#f1f5f9',
                          fontSize: '10px',
                          fontWeight: 700,
                          color: isProf ? '#1e40af' : '#475569',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}>
                          <span>{isProf ? '📋 Proforma Summary Preview' : '📄 Invoice Summary Preview'}</span>
                          <span>{`GST (${genInvoiceForm.gstType === 'none' ? 'None' : `${genInvoiceForm.gstRate}%`}): ₹${gstAmt.toLocaleString('en-IN')}`}</span>
                        </div>
                        <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                          {[
                            { label: 'Line Total', value: `₹${Math.round(lineTotal).toLocaleString('en-IN')}`, color: '#0f172a' },
                            { label: `GST (${genInvoiceForm.gstType === 'none' ? '0%' : `${genInvoiceForm.gstRate}%`})`, value: `₹${gstAmt.toLocaleString('en-IN')}`, color: isProf ? '#2563eb' : '#6366f1' },
                            { label: isProf ? 'Total Payable' : 'Sub Total', value: `₹${Math.round(subTotal).toLocaleString('en-IN')}`, color: '#16a34a' },
                            { label: isProf ? 'Balance Due' : 'Pending', value: `₹${Math.round(pending).toLocaleString('en-IN')}`, color: pending > 0 ? '#ea580c' : '#16a34a' },
                          ].map(item => (
                            <div key={item.label} style={{ textAlign: 'center', padding: '8px', background: '#fff', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600, marginBottom: '4px' }}>{item.label}</div>
                              <div style={{ fontSize: '13.5px', fontWeight: 700, color: item.color }}>{item.value}</div>
                            </div>
                          ))} 
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
              {/* Footer */}
              <div className="gi-footer">
                <button type="button" className="gi-btn-cancel" onClick={() => setShowGenInvoiceModal(false)}>
                  <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
                </button>
                <button
                  type="button"
                  className="gi-btn-generate"
                  disabled={!genInvoiceForm.clientName || !genInvoiceForm.rate || !genInvoiceForm.itemDescription || !genInvoiceForm.invoiceNo}
                  onClick={async () => {
                    if (!genInvoiceForm.clientName || !genInvoiceForm.rate || !genInvoiceForm.itemDescription || !genInvoiceForm.invoiceNo) {
                      alert('Please fill in Client Name, Item Description, and Rate.');
                      return;
                    }
                    if (genInvoiceForm.prefillProjectId) {
                      try {
                        await api.put(`/projects/${genInvoiceForm.prefillProjectId}`, {
                          name: genInvoiceForm.itemDescription,
                          description: genInvoiceForm.itemDetails || '',
                          clientName: genInvoiceForm.clientName,
                          clientEmail: genInvoiceForm.clientEmail,
                          clientPhone: genInvoiceForm.clientPhone,
                          clientAddress: genInvoiceForm.clientAddress,
                          clientCity: genInvoiceForm.clientCity,
                          clientPostalCode: genInvoiceForm.clientPostalCode,
                          clientState: genInvoiceForm.clientState,
                          clientGstin: genInvoiceForm.clientGstin,
                          clientPan: genInvoiceForm.clientPan,
                          gstType: genInvoiceForm.gstType,
                          gstRate: genInvoiceForm.gstRate,
                          hsnSac: genInvoiceForm.hsnSac,
                          projectValue: genInvoiceForm.rate
                        });
                        fetchData();
                      } catch (error) {
                        console.error('Error updating project details:', error);
                      }
                    }

                    // Save to custom generated invoices list
                    const isProf = genInvoiceForm.invoiceCategory === 'proforma';
                    const rateVal = parseFloat(genInvoiceForm.rate) || 0;
                    const qtyVal = parseFloat(genInvoiceForm.qty) || 1;
                    const discVal = parseFloat(genInvoiceForm.discount) || 0;
                    const lineTot = rateVal * qtyVal - discVal;
                    const gstRateVal = parseFloat(genInvoiceForm.gstRate) || 0;
                    const noGstVal = genInvoiceForm.gstType === 'none' || gstRateVal === 0;
                    const isIgstVal = genInvoiceForm.gstType === 'igst';
                    const isCgstSgstVal = genInvoiceForm.gstType === 'cgst_sgst' || (!isIgstVal && !noGstVal);
                    const cgstVal = (!noGstVal && isCgstSgstVal) ? Math.round(lineTot * (gstRateVal / 200)) : 0;
                    const sgstVal = (!noGstVal && isCgstSgstVal) ? Math.round(lineTot * (gstRateVal / 200)) : 0;
                    const igstVal = (!noGstVal && isIgstVal) ? Math.round(lineTot * (gstRateVal / 100)) : 0;
                    const grandTot = lineTot + cgstVal + sgstVal + igstVal;
                    const advVal = parseFloat(genInvoiceForm.advanceAmount) || 0;

                    const creatorStr = getLoggedInUserDisplayName();
                    const genByStr = genInvoiceForm.generatedBy || creatorStr;
                    const genOnStr = genInvoiceForm.generatedOn || new Date().toISOString();
                    const finalInvNo = formatInvoiceNumberInput(genInvoiceForm.invoiceNo, genInvoiceForm.invoiceCategory) || genInvoiceForm.invoiceNo;

                    const newInvItem = {
                      id: finalInvNo,
                      invoiceNo: finalInvNo,
                      invoiceCategory: genInvoiceForm.invoiceCategory || 'tax',
                      invoiceDate: genInvoiceForm.invoiceDate,
                      dueDate: genInvoiceForm.dueDate,
                      generatedOn: genOnStr,
                      generatedBy: genByStr,
                      prefillProjectId: genInvoiceForm.prefillProjectId || '',
                      clientName: genInvoiceForm.clientName,
                      email: genInvoiceForm.clientEmail,
                      phone: genInvoiceForm.clientPhone,
                      clientAddress: genInvoiceForm.clientAddress || '',
                      clientCity: genInvoiceForm.clientCity || '',
                      clientPostalCode: genInvoiceForm.clientPostalCode || '',
                      clientState: genInvoiceForm.clientState || '',
                      clientGstin: genInvoiceForm.clientGstin || '',
                      clientPan: genInvoiceForm.clientPan || '',
                      projectName: genInvoiceForm.itemDescription,
                      itemDescription: genInvoiceForm.itemDescription,
                      itemDetails: genInvoiceForm.itemDetails || '',
                      description: genInvoiceForm.itemDetails || '',
                      hsnSac: genInvoiceForm.hsnSac || '9975',
                      qty: String(qtyVal),
                      rate: String(rateVal),
                      discount: String(discVal),
                      gstType: genInvoiceForm.gstType || 'cgst_sgst',
                      gstRate: String(gstRateVal),
                      advanceAmount: String(advVal),
                      totalAmount: grandTot,
                      baseAmount: lineTot,
                      paidAmount: advVal,
                      dueAmount: Math.max(0, grandTot - advVal),
                      status: advVal >= grandTot && grandTot > 0 ? 'Paid' : advVal > 0 ? 'Partially Paid' : 'Unpaid',
                      projectStatus: 'Active',
                      createdAt: genOnStr,
                      rawForm: { ...genInvoiceForm, invoiceNo: finalInvNo, generatedBy: genByStr, generatedOn: genOnStr }
                    };

                    const targetNo = String(newInvItem.invoiceNo || '').trim().toLowerCase();
                    const nextCustom = [
                      newInvItem,
                      ...customInvoices.filter(ci => {
                        const ciNo = String(ci.invoiceNo || ci.id || '').trim().toLowerCase();
                        return ciNo && ciNo !== targetNo;
                      })
                    ];
                    setCustomInvoices(nextCustom);
                    try {
                      localStorage.setItem('generated_invoices_list', JSON.stringify(nextCustom));
                    } catch (err) {
                      console.error('Error storing custom invoice:', err);
                    }

                    // Save to backend MongoDB database
                    try {
                      const res = await api.post('/invoices', newInvItem);
                      if (res.data) {
                        setCustomInvoices(prev => [
                          res.data,
                          ...prev.filter(ci => String(ci.invoiceNo || '').toLowerCase() !== targetNo && String(ci._id || '') !== String(res.data._id || ''))
                        ]);
                      }
                    } catch (apiErr) {
                      console.error('Error saving invoice to backend:', apiErr);
                    }

                    // Switch to Invoices tab and reset search & page so the new invoice is immediately visible at the top
                    handleTabSwitch('invoices');
                    setInvoiceSearchTerm('');
                    setInvoiceCurrentPage(1);
                    setInvoiceStatusFilter('all');

                    handlePrintGeneratedInvoice({ ...genInvoiceForm, invoiceNo: finalInvNo, generatedBy: genByStr, generatedOn: genOnStr }, true);
                    setShowGenInvoiceModal(false);
                  }}
                  style={{
                    padding: '7px 18px', border: 'none', borderRadius: '7px',
                    background: (!genInvoiceForm.clientName || !genInvoiceForm.rate || !genInvoiceForm.itemDescription || !genInvoiceForm.invoiceNo)
                      ? '#9ca3af' : (genInvoiceForm.invoiceCategory === 'proforma' ? '#2563eb' : '#3b775e'),
                    color: '#fff', fontSize: '12px', fontWeight: 600,
                    cursor: (!genInvoiceForm.clientName || !genInvoiceForm.rate || !genInvoiceForm.itemDescription || !genInvoiceForm.invoiceNo) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: (!genInvoiceForm.clientName || !genInvoiceForm.rate || !genInvoiceForm.itemDescription || !genInvoiceForm.invoiceNo)
                      ? 'none' : '0 2px 6px rgba(0, 0, 0, 0.15)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => {
                    if (genInvoiceForm.clientName && genInvoiceForm.rate && genInvoiceForm.itemDescription && genInvoiceForm.invoiceNo) {
                      e.currentTarget.style.background = genInvoiceForm.invoiceCategory === 'proforma' ? '#1d4ed8' : '#2f6350';
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(0, 0, 0, 0.25)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (genInvoiceForm.clientName && genInvoiceForm.rate && genInvoiceForm.itemDescription && genInvoiceForm.invoiceNo) {
                      e.currentTarget.style.background = genInvoiceForm.invoiceCategory === 'proforma' ? '#2563eb' : '#3b775e';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.15)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <span>Generate {genInvoiceForm.invoiceCategory === 'proforma' ? 'Proforma' : 'Tax'} Invoice</span>
                </button>
              </div>
            </div>
          </>
        </div>
      )}

      {/* Project Payment History & Installments Modal */}
      <ProjectPaymentHistoryModal
        isOpen={showPaymentDetailsModal}
        onClose={() => setShowPaymentDetailsModal(false)}
        project={selectedPaymentRecord}
        onPaymentUpdated={fetchData}
        currentUser={user}
      />

      {/* Add Payment Modal */}
      {isPaymentModalOpen && (
        <div
          className="pay-overlay"
          onClick={() => setIsPaymentModalOpen(false)}
        >
          <>
            <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="pay-modal-hd">
                <div className="pay-modal-hd-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="5" width="20" height="14" rx="2" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="2" y1="10" x2="22" y2="10" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" />
                    <line x1="6" y1="15" x2="10" y2="15" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="pay-modal-title">Add Project Payment</div>
                  <div className="pay-modal-sub">Record a payment against a project</div>
                </div>
                <button
                  className="pay-close-btn"
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                >
                  <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="pay-modal-body">
                <form onSubmit={handleAddPayment} className="pay-form">

                  {/* Select Project */}
                  <div className="pay-section-lbl">Select Project</div>
                  <div className="pay-field">
                    <label className="pay-lbl">Project <span className="pay-req">*</span></label>
                    <select
                      className="pay-input pay-select"
                      value={paymentForm.projectId}
                      onChange={(e) => setPaymentForm({ ...paymentForm, projectId: e.target.value })}
                      required
                    >
                      <option value="">Select a project...</option>
                      {paymentData.map(proj => (
                        <option key={proj._id} value={proj._id}>
                          {proj.id} - {proj.projectName} ({proj.clientName})
                        </option>
                      ))}
                    </select>
                    {paymentForm.projectId && (() => {
                      const selectedProj = paymentData.find(p => p._id === paymentForm.projectId);
                      if (!selectedProj) return null;
                      const dueAmount = Math.max(0, selectedProj.totalAmount - selectedProj.paidAmount);
                      const paidPct = selectedProj.totalAmount > 0 ? Math.round((selectedProj.paidAmount / selectedProj.totalAmount) * 100) : 0;
                      return (
                        <div style={{ marginTop: '10px', borderRadius: '10px', border: '1.5px solid #e8f3ee', background: '#f7fdf9', overflow: 'hidden' }}>
                          {/* Header row */}
                          <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8f3ee' }}>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Payment Breakdown</span>
                            <span style={{
                              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                              background: paidPct >= 100 ? '#dcfce7' : paidPct > 0 ? '#fef9c3' : '#fee2e2',
                              color: paidPct >= 100 ? '#166534' : paidPct > 0 ? '#854d0e' : '#b91c1c',
                              border: `1px solid ${paidPct >= 100 ? '#bbf7d0' : paidPct > 0 ? '#fde68a' : '#fecaca'}`
                            }}>
                              {paidPct}% Paid
                            </span>
                          </div>
                          {/* Metrics */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#fff' }}>
                            <div style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9' }}>
                              <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>Total</div>
                              <div style={{ fontSize: '14px', color: '#111827', fontWeight: 700 }}>₹{selectedProj.totalAmount.toLocaleString()}</div>
                            </div>
                            <div style={{ padding: '12px 14px', borderRight: '1px solid #f1f5f9' }}>
                              <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>Paid</div>
                              <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: 700 }}>₹{selectedProj.paidAmount.toLocaleString()}</div>
                            </div>
                            <div style={{ padding: '12px 14px' }}>
                              <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>Due</div>
                              <div style={{ fontSize: '14px', color: dueAmount > 0 ? '#ef4444' : '#16a34a', fontWeight: 700 }}>₹{dueAmount.toLocaleString()}</div>
                            </div>
                          </div>

                        </div>
                      );
                    })()}
                  </div>

                  {/* Payment Details */}
                  <div className="pay-section-lbl" style={{ marginTop: '4px' }}>Payment Details</div>
                  <div className="pay-date-row">
                    <div className="pay-field">
                      <label className="pay-lbl">Amount (₹) <span className="pay-req">*</span></label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        className="pay-input"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                        placeholder="e.g. 50000"
                      />
                    </div>
                    <div className="pay-field">
                      <label className="pay-lbl">Payment Date</label>
                      <input
                        type="date"
                        className="pay-input"
                        value={paymentForm.paymentDate}
                        onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="pay-field">
                    <label className="pay-lbl">Payment Method</label>
                    <select
                      className="pay-input pay-select"
                      value={paymentForm.paymentMethod}
                      onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="UPI / Wallet">UPI / Wallet</option>
                      <option value="Cash">Cash</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div className="pay-field">
                    <label className="pay-lbl">Notes <span style={{ fontWeight: 400, color: '#c4c9d4', fontSize: '11px' }}>(optional)</span></label>
                    <textarea
                      className="pay-input pay-textarea"
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                      placeholder="Add reference number or notes..."
                      rows="3"
                    />
                  </div>

                  <div className="pay-footer">
                    <button
                      type="button"
                      className="pay-btn-ghost"
                      onClick={() => setIsPaymentModalOpen(false)}
                    >
                      <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
                    </button>
                    <button
                      type="submit"
                      className="pay-btn-primary"
                      disabled={addingPayment}
                    >
                      {addingPayment ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                          Adding...
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add Payment
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </>
        </div>
      )}
      {/* Edit Details Modal */}
      {isEditModalOpen && (
        <div className="pay-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pay-modal-hd">
              <div className="pay-modal-hd-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 20h9" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div className="pay-modal-title">Edit Project Details</div>
                <div className="pay-modal-sub">Update the project status</div>
              </div>
              <button
                className="pay-close-btn"
                type="button"
                onClick={() => setIsEditModalOpen(false)}
              >
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="pay-modal-body">
              <form onSubmit={handleEditSubmit} className="pay-form">
                {editingPayment && (
                  <>
                    <div className="pay-section-lbl">Project Information</div>
                    <div className="pay-date-row">
                      <div className="pay-field">
                        <label className="pay-lbl">Project ID</label>
                        <input className="pay-input" value={editingPayment.id} disabled style={{ backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#f3f4f6' }} />
                      </div>
                      <div className="pay-field">
                        <label className="pay-lbl">Project Name</label>
                        <input className="pay-input" value={editingPayment.projectName} disabled style={{ backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#f3f4f6' }} />
                      </div>
                    </div>

                    <div className="pay-section-lbl" style={{ marginTop: '5px' }}>Client Details</div>
                    <div className="pay-date-row">
                      <div className="pay-field">
                        <label className="pay-lbl">Client Name</label>
                        <input className="pay-input" value={editingPayment.clientName} disabled style={{ backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#f3f4f6' }} />
                      </div>
                      <div className="pay-field">
                        <label className="pay-lbl">Email</label>
                        <input className="pay-input" value={editingPayment.email} disabled style={{ backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#f3f4f6' }} />
                      </div>
                    </div>

                    <div className="pay-section-lbl" style={{ marginTop: '5px' }}>Financials</div>
                    <div className="pay-date-row">
                      <div className="pay-field">
                        <label className="pay-lbl">Total Amount</label>
                        <input className="pay-input" value={`₹${(editingPayment.totalAmount || 0).toLocaleString()}`} disabled style={{ backgroundColor: '#f9fafb', color: '#6b7280', borderColor: '#f3f4f6' }} />
                      </div>
                      <div className="pay-field">
                        <label className="pay-lbl">Due Amount</label>
                        <input className="pay-input" value={`₹${((editingPayment.totalAmount || 0) - (editingPayment.paidAmount || 0)).toLocaleString()}`} disabled style={{ backgroundColor: '#f9fafb', color: '#ef4444', borderColor: '#f3f4f6', fontWeight: '600' }} />
                      </div>
                    </div>

                    <div className="pay-section-lbl" style={{ marginTop: '5px' }}>Update Status</div>
                  </>
                )}
                
                <div className="pay-date-row">
                  <div className="pay-field">
                    <label className="pay-lbl">Project Status <span className="pay-req">*</span></label>
                    <select
                      className="pay-input pay-select"
                      value={editForm.projectStatus}
                      onChange={(e) => setEditForm({ ...editForm, projectStatus: e.target.value })}
                      required
                    >
                      <option value="Active">Active</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="On Hold">On Hold</option>
                    </select>
                  </div>
                  <div className="pay-field">
                    <label className="pay-lbl">Payment Status <span className="pay-req">*</span></label>
                    <select
                      className="pay-input pay-select"
                      value={editForm.paymentStatus || 'Unpaid'}
                      onChange={(e) => setEditForm({ ...editForm, paymentStatus: e.target.value })}
                      required
                    >
                      <option value="Unpaid">Unpaid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>
                </div>

                <div className="pay-actions">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="pay-btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="pay-btn-primary"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default ClientPayments;
