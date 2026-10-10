import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './MyLeads.css';

// Trend icons
const TrendUpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const TrendDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
    <polyline points="17 18 23 18 23 12" />
  </svg>
);

// Helper function to parse CSV row (handles quotes and commas properly)
function parseCsvRow(row) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper function to parse CSV text
function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvRow(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

const emptyDealForm = {
  dealName: '',
  clientName: '',
  email: '',
  phone: '',
  company: '',
  dealValue: '',
  expectedCloseDate: '',
  probability: '10',
  source: 'Lead Conversion',
  description: '',
  requirements: '',
  notes: ''
};

function generateDealId(clientName, existingDeals) {
  const prefix = (clientName || 'DL')
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');

  const samePrefix = existingDeals.filter(d =>
    d.dealId && d.dealId.startsWith(prefix)
  );

  const maxNum = samePrefix.reduce((max, d) => {
    const num = parseInt((d.dealId || '').slice(3), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);

  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

// Helper function to get source badge colors
function getSourceBadgeStyle(source) {
  const sourceColors = {
    'Email': { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    'Phone': { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    'Website': { bg: '#e0e7ff', color: '#4338ca', border: '#a5b4fc' },
    'Referral': { bg: '#fce7f3', color: '#be185d', border: '#f9a8d4' },
    'LinkedIn': { bg: '#dbeafe', color: '#0369a1', border: '#7dd3fc' },
    'Facebook': { bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd' },
    'Instagram': { bg: '#fce7f3', color: '#9f1239', border: '#fda4af' },
    'Twitter': { bg: '#dbeafe', color: '#075985', border: '#7dd3fc' },
    'Meta': { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    'WhatsApp': { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
    'IndiaMART': { bg: '#fed7aa', color: '#c2410c', border: '#fdba74' },
    'Advertisement': { bg: '#fed7aa', color: '#9a3412', border: '#fdba74' },
    'Other': { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
  };
  return sourceColors[source] || sourceColors['Other'];
}

// Helper function to get dealer badge colors
function getDealerBadgeStyle(dealerName) {
  if (!dealerName || dealerName === 'Unassigned') {
    return { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
  }
  // Generate consistent color based on name
  const colors = [
    { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    { bg: '#fce7f3', color: '#be185d', border: '#f9a8d4' },
    { bg: '#e0e7ff', color: '#4338ca', border: '#a5b4fc' },
    { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' }
  ];
  const hash = dealerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Helper function to get probability badge colors
function getProbabilityBadgeStyle(probability) {
  const prob = parseInt(probability) || 0;
  if (prob === 0) {
    return { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' }; // Red - 0%
  } else if (prob <= 25) {
    return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' }; // Red - Low
  } else if (prob <= 50) {
    return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' }; // Orange - Medium-Low
  } else if (prob <= 75) {
    return { bg: '#fefce8', color: '#ca8a04', border: '#fde047' }; // Yellow - Medium-High
  } else if (prob < 100) {
    return { bg: '#dcfce7', color: '#16a34a', border: '#86efac' }; // Green - High
  } else {
    return { bg: '#dcfce7', color: '#166534', border: '#86efac' }; // Dark Green - 100%
  }
}

function Deals() {
  const { user, hasPermission } = useAuth();

  // Check if user has full access to all deals (same logic as backend)
  const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase().trim();
  const hasFullAccess =
    roleName === 'admin' ||
    roleName === 'super admin' ||
    roleName === 'director' ||
    roleName === 'hr' ||
    roleName === 'manager' ||
    roleName === 'hr manager' ||
    roleName === 'sales head' ||
    roleName === 'saleshead' ||
    roleName === 'head of sales';

  const isSales = roleName.includes('sales');
  const navigate = useNavigate();
  const csvInputRef = useRef(null);

  const [deals, setDeals] = useState([]);
  const [prevStats, setPrevStats] = useState({
    total: 0,
    qualification: 0,
    proposal: 0,
    negotiation: 0,
    closedWon: 0,
    wonValue: 0
  });
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [filter, setFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [actionMenu, setActionMenu] = useState(null);
  const [importingCsv, setImportingCsv] = useState(false);
  const [showConversionModal, setShowConversionModal] = useState(false);
  const [pendingConversion, setPendingConversion] = useState(null);

  const [formData, setFormData] = useState(emptyDealForm);
  const [formErrors, setFormErrors] = useState({});

  const DEALS_PER_PAGE = 10;

  // All deals from the deals collection (includes Lead Conversion and Meta auto-created deals)
  const allDeals = React.useMemo(() => {
    const combined = [...deals]
      .filter(deal => {
        // Regular employees: only show deals owned or assigned to this user
        if (!hasFullAccess && user) {
          const userId = (user._id || user.id || '').toString();
          const assignedId = (deal.assignedTo?._id || deal.assignedTo || '').toString();
          const createdId = (deal.createdBy?._id || deal.createdBy || '').toString();
          const userFullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
          const userEmail = (user.email || '').trim().toLowerCase();
          const userOfficialEmail = (user.officialEmail || '').trim().toLowerCase();
          const salesOwner = (deal.salesOwner || '').trim().toLowerCase();
          const addedBy = (deal.addedBy || '').trim().toLowerCase();
          const dealEmail = (deal.email || '').trim().toLowerCase();

          if (userId && (assignedId === userId || createdId === userId)) return true;
          if (userFullName && (salesOwner === userFullName || addedBy === userFullName)) return true;
          if (userEmail && (dealEmail === userEmail || salesOwner === userEmail || addedBy === userEmail)) return true;
          if (userOfficialEmail && (dealEmail === userOfficialEmail || salesOwner === userOfficialEmail)) return true;
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Assign dealId to each entry that doesn't already have one
    const assigned = [];
    for (const deal of combined) {
      if (!deal.dealId) {
        deal.dealId = generateDealId(deal.clientName || deal.dealName, assigned);
      }
      assigned.push(deal);
    }

    return combined;
  }, [deals]);

  // Calculate stats from the combined list of all deals
  const stats = React.useMemo(() => {
    return allDeals.reduce(
      (acc, deal) => {
        acc.total += 1;
        if (deal.stage === 'Qualification') acc.qualification += 1;
        if (deal.stage === 'Proposal') acc.proposal += 1;
        if (deal.stage === 'Negotiation') acc.negotiation += 1;
        if (deal.stage === 'Closed Won') {
          acc.closedWon += 1;
          acc.wonValue += Number(deal.dealValue) || 0;
        }
        return acc;
      },
      { total: 0, qualification: 0, proposal: 0, negotiation: 0, closedWon: 0, wonValue: 0 }
    );
  }, [allDeals]);

  // Filtered and searched deals
  const filteredDeals = allDeals.filter((deal) => {
    const matchesFilter = filter === 'all' || deal.stage === filter;
    const matchesSource = sourceFilter === 'all' || deal.source === sourceFilter;
    const matchesSearch =
      !searchTerm ||
      deal.dealName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.phone?.includes(searchTerm);

    return matchesFilter && matchesSource && matchesSearch;
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredDeals.length / DEALS_PER_PAGE));
  const pageStartIndex = (currentPage - 1) * DEALS_PER_PAGE;
  const paginatedDeals = filteredDeals.slice(pageStartIndex, pageStartIndex + DEALS_PER_PAGE);

  const canCreateDeals = hasPermission?.("deals", "create");
  const canUpdateDeals = hasPermission?.("deals", "update");
  const canDeleteDeals = hasPermission?.("deals", "delete");

  // Calculate percentage changes dynamically
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
  };

  const getTrendDirection = (current, previous) => {
    return current >= previous;
  };

  const totalChange = calculateChange(stats.total || 0, prevStats.total || 0);
  const proposalChange = calculateChange(stats.proposal || 0, prevStats.proposal || 0);
  const negotiationChange = calculateChange(stats.negotiation || 0, prevStats.negotiation || 0);
  const wonChange = calculateChange(stats.closedWon || 0, prevStats.closedWon || 0);
  const valueChange = calculateChange(stats.wonValue || 0, prevStats.wonValue || 0);

  const totalTrend = getTrendDirection(stats.total || 0, prevStats.total || 0);
  const proposalTrend = getTrendDirection(stats.proposal || 0, prevStats.proposal || 0);
  const negotiationTrend = getTrendDirection(stats.negotiation || 0, prevStats.negotiation || 0);
  const wonTrend = getTrendDirection(stats.closedWon || 0, prevStats.closedWon || 0);
  const valueTrend = getTrendDirection(stats.wonValue || 0, prevStats.wonValue || 0);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  useEffect(() => {
    fetchDeals();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (actionMenu && !event.target.closest('[data-deal-action-menu]')) {
        setActionMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionMenu]);

  const fetchDeals = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefetching(true);
      }

      // Fetch deals from the deals collection (includes auto-created from lead conversions)
      let url = '/deals';
      const params = [];

      if (filter !== 'all') {
        params.push(`stage=${filter}`);
      }

      if (sourceFilter !== 'all') {
        params.push(`source=${sourceFilter}`);
      }

      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const res = await api.get(url);
      setDeals(res.data || []);
    } catch (error) {
      console.error('Error fetching deals:', error);
    } finally {
      setLoading(false);
      setRefetching(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Real-time email validation
    if (name === 'email') {
      if (!value.trim()) {
        setFormErrors({ ...formErrors, email: 'Email is required' });
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value.trim())) {
          setFormErrors({ ...formErrors, email: 'Please enter a valid email address' });
        } else {
          // Clear error if email is valid
          const newErrors = { ...formErrors };
          delete newErrors.email;
          setFormErrors(newErrors);
        }
      }
    }
    // Real-time phone validation
    else if (name === 'phone') {
      if (!value.trim()) {
        setFormErrors({ ...formErrors, phone: 'Phone number is required' });
      } else {
        const phoneRegex = /^[0-9]{10}$/;
        const cleanPhone = value.replace(/[\s-()]/g, '');
        if (cleanPhone.length > 0 && cleanPhone.length < 10) {
          setFormErrors({ ...formErrors, phone: `Phone number must be 10 digits (${cleanPhone.length}/10)` });
        } else if (cleanPhone.length === 10 && !phoneRegex.test(cleanPhone)) {
          setFormErrors({ ...formErrors, phone: 'Phone number must contain only digits' });
        } else if (cleanPhone.length === 10) {
          // Clear error if phone is valid
          const newErrors = { ...formErrors };
          delete newErrors.phone;
          setFormErrors(newErrors);
        }
      }
    }
    else {
      // Clear error for other fields when user starts typing
      if (formErrors[name]) {
        const newErrors = { ...formErrors };
        delete newErrors[name];
        setFormErrors(newErrors);
      }
    }
  };

  const validateForm = () => {
    const errors = {};

    // Deal Name validation
    if (!formData.dealName || !formData.dealName.trim()) {
      errors.dealName = 'Deal name is required';
    } else if (formData.dealName.trim().length < 3) {
      errors.dealName = 'Deal name must be at least 3 characters';
    } else if (formData.dealName.trim().length > 100) {
      errors.dealName = 'Deal name must not exceed 100 characters';
    }

    // Client Name validation
    if (!formData.clientName || !formData.clientName.trim()) {
      errors.clientName = 'Client name is required';
    } else if (formData.clientName.trim().length < 2) {
      errors.clientName = 'Client name must be at least 2 characters';
    } else if (formData.clientName.trim().length > 100) {
      errors.clientName = 'Client name must not exceed 100 characters';
    }

    // Email validation
    if (!formData.email || !formData.email.trim()) {
      errors.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address';
      }
    }

    // Phone validation
    if (!formData.phone || !formData.phone.trim()) {
      errors.phone = 'Phone number is required';
    } else {
      const phoneRegex = /^[0-9]{10}$/;
      const cleanPhone = formData.phone.replace(/[\s-()]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        errors.phone = 'Phone number must be 10 digits';
      }
    }

    // Company validation (optional but if provided, check length)
    if (formData.company && formData.company.trim().length > 100) {
      errors.company = 'Company name must not exceed 100 characters';
    }

    // Deal Value validation
    if (!formData.dealValue || formData.dealValue === '') {
      errors.dealValue = 'Deal value is required';
    } else if (isNaN(formData.dealValue) || Number(formData.dealValue) < 0) {
      errors.dealValue = 'Deal value must be a positive number';
    } else if (Number(formData.dealValue) === 0) {
      errors.dealValue = 'Deal value must be greater than zero';
    } else if (Number(formData.dealValue) > 999999999) {
      errors.dealValue = 'Deal value is too large';
    }

    // Expected Close Date validation
    if (!formData.expectedCloseDate) {
      errors.expectedCloseDate = 'Expected close date is required';
    } else {
      const selectedDate = new Date(formData.expectedCloseDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        errors.expectedCloseDate = 'Expected close date cannot be in the past';
      }
    }

    // Probability validation
    if (formData.probability !== '' && formData.probability !== null) {
      const prob = Number(formData.probability);
      if (isNaN(prob) || prob < 0 || prob > 100) {
        errors.probability = 'Probability must be between 0 and 100';
      }
    }

    // Source validation
    if (!formData.source || !formData.source.trim()) {
      errors.source = 'Source is required';
    }

    // Description validation (optional but check length if provided)
    if (formData.description && formData.description.length > 500) {
      errors.description = 'Description must not exceed 500 characters';
    }

    // Requirements validation (optional but check length if provided)
    if (formData.requirements && formData.requirements.length > 1000) {
      errors.requirements = 'Requirements must not exceed 1000 characters';
    }

    // Notes validation (optional but check length if provided)
    if (formData.notes && formData.notes.length > 500) {
      errors.notes = 'Notes must not exceed 500 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openAddDealModal = () => {
    setEditingDeal(null);
    setIsViewOnly(false);
    setFormData({ ...emptyDealForm, source: 'Manual' });
    setFormErrors({});
    setShowModal(true);
  };

  const openEditDealModal = (deal, viewOnly = false) => {
    setEditingDeal(deal);
    setIsViewOnly(viewOnly);
    setFormData({
      dealName: deal.dealName,
      clientName: deal.clientName,
      email: deal.email,
      phone: deal.phone,
      company: deal.company || '',
      dealValue: deal.dealValue || '',
      expectedCloseDate: deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : '',
      probability: deal.probability || '10',
      source: deal.source,
      description: deal.description || '',
      requirements: deal.requirements || '',
      notes: deal.notes || ''
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form before submission
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = Object.keys(formErrors)[0];
      const errorElement = document.querySelector(`[name="${firstErrorField}"]`);
      if (errorElement) {
        errorElement.focus();
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    try {
      const submitData = {
        ...formData,
        dealName: formData.dealName.trim(),
        clientName: formData.clientName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        company: formData.company.trim(),
        description: formData.description.trim(),
        requirements: formData.requirements.trim(),
        notes: formData.notes.trim(),
        assignedTo: user._id
      };

      if (editingDeal) {
        await api.put(`/deals/${editingDeal._id}`, submitData);
        alert('Deal updated successfully!');
      } else {
        await api.post('/deals', submitData);
        alert('Deal created successfully!');
      }

      setShowModal(false);
      setFormData(emptyDealForm);
      setFormErrors({});
      setEditingDeal(null);
      fetchDeals(false);
    } catch (error) {
      console.error('Error saving deal:', error);
      alert(error.response?.data?.message || 'Error saving deal');
    }
  };

  const confirmConversion = async () => {
    if (!pendingConversion) return;
    const { deal } = pendingConversion;

    try {
      await api.put(`/deals/${deal._id}`, { stage: 'Closed Won', probability: 100 });
      setShowConversionModal(false);
      setPendingConversion(null);
      fetchDeals(false);
      alert('Deal marked as Closed Won! Client has been added to the Clients page.');
    } catch (error) {
      console.error('Error updating stage:', error);
      alert('Error updating deal stage');
    }
  };

  const cancelConversion = () => {
    setShowConversionModal(false);
    setPendingConversion(null);
  };

  const handleDeleteDeal = async (deal) => {
    if (window.confirm(`Are you sure you want to delete the deal "${deal.dealName}"?`)) {
      try {
        await api.delete(`/deals/${deal._id}`);
        alert('Deal deleted successfully!');
        fetchDeals(false);
      } catch (error) {
        console.error('Error deleting deal:', error);
        alert(error.response?.data?.message || 'Error deleting deal');
      }
    }
  };

  const handleStageChange = async (dealId, newStage, currentStage) => {
    try {
      const deal = allDeals.find(d => d._id === dealId);
      if (!deal) return;

      // Check if trying to change from Closed Won status
      if (currentStage === 'Closed Won') {
        alert('Cannot change stage of a won deal!');
        return;
      }

      // If changing to Closed Won, show confirmation
      if (newStage === 'Closed Won') {
        setPendingConversion({ dealId, newStage, deal });
        setShowConversionModal(true);
        return;
      }

      let updateData = { stage: newStage };

      if (newStage === 'Closed Lost') {
        const reason = prompt('Please enter reason for losing this deal:');
        if (!reason) return;
        updateData.lostReason = reason;
      }

      // Update the stage in backend — all deals are now in the deals collection
      await api.put(`/deals/${deal._id}`, updateData);

      alert('Deal stage updated!');

      fetchDeals(false);
    } catch (error) {
      console.error('Error updating stage:', error);
      alert('Error updating deal stage');
    }
  };

  const handleProbabilityChange = async (dealId, newProbability) => {
    try {
      const deal = allDeals.find(d => d._id === dealId);
      if (!deal) return;

      // Check if deal is closed won (cannot change)
      if (deal.stage === 'Closed Won') {
        alert('Cannot change probability of a won deal!');
        return;
      }

      // Update the probability in backend
      await api.put(`/deals/${deal._id}`, { probability: parseInt(newProbability) });

      // Refresh deals to show updated probability
      fetchDeals(false);
    } catch (error) {
      console.error('Error updating probability:', error);
      alert('Error updating deal probability');
    }
  };

  const toggleActionMenu = (event, dealId) => {
    event.stopPropagation();

    if (actionMenu?.id === dealId) {
      setActionMenu(null);
      return;
    }

    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 100;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = rect.bottom + 5;
    let left = rect.left;

    if (left + menuWidth > viewportWidth) {
      left = rect.right - menuWidth;
    }

    if (top + menuHeight > viewportHeight) {
      top = rect.top - menuHeight - 5;
    }

    setActionMenu({ id: dealId, top, left });
  };

  const openProposalComposer = (deal) => {
    setActionMenu(null);
    navigate('/proposals', {
      state: {
        createProposal: true,
        clientDraft: {
          title: `${deal.company && deal.company !== '-' ? deal.company : deal.dealName} Proposal`,
          clientName: deal.clientName === 'Untitled Deal' ? '' : deal.clientName,
          clientEmail: deal.email === '-' ? '' : deal.email,
          clientPhone: deal.phone === '-' ? '' : deal.phone,
          clientAddress: deal.company === '-' ? '' : deal.company,
          contactName: deal.clientName === 'Untitled Deal' ? '' : deal.clientName,
          notes: deal.description === '-' ? '' : deal.description,
          projectScope: deal.requirements === '-' ? '' : deal.requirements,
        },
      },
    });
  };

  const handleExportCsv = () => {
    if (allDeals.length === 0) {
      alert('No deals to export');
      return;
    }

    const headers = [
      'Deal Name',
      'Client Name',
      'Email',
      'Phone',
      'Deal Value',
      'Company',
      'Dealer Name',
      'Stage',
      'Probability (%)',
      'Expected Close Date',
      'Source',
      'Record Type',
      'Description',
      'Requirements',
      'Notes',
      'Created Date'
    ];

    const rows = allDeals.map((deal) => [
      deal.dealName || '',
      deal.clientName || '',
      deal.email || '',
      deal.phone ? `\t${deal.phone}` : '',
      deal.dealValue || 0,
      deal.company || '',
      deal.assignedTo ? `${deal.assignedTo.firstName || ''} ${deal.assignedTo.lastName || ''}`.trim() : 'Unassigned',
      deal.stage || 'Qualification',
      deal.probability || '10',
      deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
      deal.source || '',
      deal.recordType ? (deal.recordType === 'crm' ? 'CRM Lead' : deal.recordType === 'meta' ? 'Meta Lead' : 'Regular Deal') : 'Regular Deal',
      deal.description || '',
      deal.requirements || '',
      deal.notes || '',
      deal.createdAt ? new Date(deal.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const escaped = String(cell).replace(/"/g, '""');
            return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
              ? `"${escaped}"`
              : escaped;
          })
          .join(',')
      ),
    ].join('\n');

    // Add UTF-8 BOM for Excel compatibility
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `deals_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleImportClick = () => {
    csvInputRef.current?.click();
  };

  const handleCsvImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingCsv(true);

    try {
      const text = await file.text();
      const rows = parseCsvText(text);

      if (rows.length === 0) {
        alert('CSV file is empty');
        setImportingCsv(false);
        return;
      }

      const normalizedRows = rows.map((row) => ({
        dealName: (row['deal name'] || row['dealname'] || '').trim(),
        clientName: (row['client name'] || row['clientname'] || row['client'] || '').trim(),
        email: (row.email || '').trim(),
        phone: (row.phone || row.mobile || row.contact || '').trim(),
        company: (row.company || '').trim(),
        dealValue: row['deal value'] || row['dealvalue'] || row.value || 0,
        expectedCloseDate: row['expected close date'] || row['close date'] || row.closedate || '',
        probability: row.probability || '10',
        source: (row.source || 'Manual').trim(),
        description: (row.description || '').trim(),
        requirements: (row.requirements || row.requirement || '').trim(),
        notes: (row.notes || row.note || '').trim()
      }));

      const validRows = normalizedRows.filter(
        (row) => row.dealName && row.clientName && row.email && row.phone
      );

      if (validRows.length === 0) {
        alert('No valid rows found. Required fields: Deal Name, Client Name, Email, Phone');
        setImportingCsv(false);
        return;
      }

      let successCount = 0;
      let errorCount = 0;

      for (const dealData of validRows) {
        try {
          await api.post('/deals', {
            ...dealData,
            assignedTo: user._id
          });
          successCount++;
        } catch (error) {
          console.error('Error creating deal:', error);
          errorCount++;
        }
      }

      alert(`Import complete!\nSuccess: ${successCount}\nFailed: ${errorCount}`);
      fetchDeals(false);
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Error importing CSV file');
    } finally {
      setImportingCsv(false);
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStageBadgeStyle = (stage) => {
    switch (stage) {
      case 'Qualification':
        return { color: '#2563eb', background: '#dbeafe' };
      case 'Proposal':
        return { color: '#7c3aed', background: '#ede9fe' };
      case 'Negotiation':
        return { color: '#f59e0b', background: '#fef3c7' };
      case 'Closed Won':
        return { color: '#166534', background: '#dcfce7' };
      case 'Closed Lost':
        return { color: '#dc2626', background: '#fee2e2' };
      default:
        return { color: '#64748b', background: '#f8fafc' };
    }
  };

  // Skeleton loading state
  if (loading) {
    return (
      <div
        className="page-container"
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: "24px",
          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
        }}
      >
        <style>{`
          @keyframes deals-skeleton-shimmer {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
          }

          .deals-skeleton {
            background: linear-gradient(90deg, #eef2f7 25%, #f8fafc 37%, #eef2f7 63%);
            background-size: 400% 100%;
            animation: deals-skeleton-shimmer 1.4s ease infinite;
          }
        `}</style>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div className="deals-skeleton" style={{ width: 120, height: 34, borderRadius: 8, marginBottom: 8 }} />
            <div className="deals-skeleton" style={{ width: 320, height: 14, borderRadius: 6 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div className="deals-skeleton" style={{ width: 122, height: 38, borderRadius: 10 }} />
            <div className="deals-skeleton" style={{ width: 122, height: 38, borderRadius: 10 }} />
            <div className="deals-skeleton" style={{ width: 116, height: 38, borderRadius: 10 }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "22px" }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px" }}>
              <div className="deals-skeleton" style={{ width: "44%", height: 13, borderRadius: 6, marginBottom: 14 }} />
              <div className="deals-skeleton" style={{ width: "28%", height: 34, borderRadius: 8, marginBottom: 12 }} />
              <div className="deals-skeleton" style={{ width: 34, height: 3, borderRadius: 999 }} />
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
            <div className="deals-skeleton" style={{ width: 340, maxWidth: "100%", height: 40, borderRadius: 10 }} />
            <div className="deals-skeleton" style={{ width: 110, height: 14, borderRadius: 6 }} />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  {Array.from({ length: 9 }).map((_, index) => (
                    <th key={index} style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
                      <div className="deals-skeleton" style={{ width: `${60 + (index % 3) * 18}px`, height: 10, borderRadius: 5 }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <tr key={rowIndex} style={{ borderBottom: rowIndex < 5 ? "1px solid #f8fafc" : "none" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="deals-skeleton" style={{ width: "65%", height: 13, borderRadius: 6, marginBottom: 8 }} />
                      <div className="deals-skeleton" style={{ width: "82%", height: 11, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="deals-skeleton" style={{ width: "58%", height: 12, borderRadius: 6, marginBottom: 8 }} />
                      <div className="deals-skeleton" style={{ width: "78%", height: 11, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="deals-skeleton" style={{ width: "88%", height: 12, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="deals-skeleton" style={{ width: 90, height: 13, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="deals-skeleton" style={{ width: 100, maxWidth: "100%", height: 24, borderRadius: 999 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="deals-skeleton" style={{ width: "68%", height: 12, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="deals-skeleton" style={{ width: 86, height: 12, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="deals-skeleton" style={{ width: 86, height: 24, borderRadius: 999 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <div className="deals-skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={csvInputRef}
        type="file"
        accept=".csv"
        onChange={handleCsvImport}
        style={{ display: 'none' }}
      />

      <style>{`
        /* Hide scrollbar but keep scrollable */
        .deals-modal-content::-webkit-scrollbar {
          display: none;
        }
        .deals-modal-content {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Export/Import button hover effects - Liquid fill animation */
        .deals-export-btn,
        .deals-import-btn {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition: color 0.35s ease, border-color 0.35s ease;
        }

        .deals-export-btn::before,
        .deals-import-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }

        .deals-export-btn::after,
        .deals-import-btn::after {
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

        .deals-export-btn:hover,
        .deals-import-btn:hover {
          color: #1f2937 !important;
          border-color: transparent !important;
        }

        .deals-export-btn:hover::before,
        .deals-import-btn:hover::before {
          transform: translateX(0%);
        }

        .deals-export-btn:hover::after,
        .deals-import-btn:hover::after {
          transform: translateX(255%) rotate(8deg);
        }

        @keyframes deals-bubble-float-large {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(5px, -8px) scale(1.08); }
        }

        @keyframes deals-bubble-float-small {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-4px, 6px) scale(0.92); }
        }

        .deals-metrics-grid > div::before {
          content: '';
          position: absolute;
          z-index: 0;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #667eea;
          opacity: 0.06;
          top: -14px;
          left: -18px;
          pointer-events: none;
          animation: deals-bubble-float-large 5.5s ease-in-out infinite;
        }

        .deals-metrics-grid > div::after {
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
          animation: deals-bubble-float-small 4.2s ease-in-out infinite;
        }

        .deals-metrics-grid > div:nth-child(1)::before,
        .deals-metrics-grid > div:nth-child(1)::after {
          background: #667eea;
        }

        .deals-metrics-grid > div:nth-child(2)::before,
        .deals-metrics-grid > div:nth-child(2)::after {
          background: #7c3aed;
        }

        .deals-metrics-grid > div:nth-child(3)::before,
        .deals-metrics-grid > div:nth-child(3)::after {
          background: #f59e0b;
        }

        .deals-metrics-grid > div:nth-child(4)::before,
        .deals-metrics-grid > div:nth-child(4)::after {
          background: #10b981;
        }

        .deals-metrics-grid > div:nth-child(5)::before,
        .deals-metrics-grid > div:nth-child(5)::after {
          background: #8b5cf6;
        }

        .deals-metrics-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
        .deals-metrics-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
        .deals-metrics-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
        .deals-metrics-grid > div:nth-child(5)::before { animation-delay: 0.3s; }
        .deals-metrics-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
        .deals-metrics-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
        .deals-metrics-grid > div:nth-child(4)::after { animation-delay: 1.8s; }
        .deals-metrics-grid > div:nth-child(5)::after { animation-delay: 0.9s; }

        /* Cancel button animated hover effect */
        .deals-cancel-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }

        .deals-cancel-btn::after {
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

        .deals-cancel-btn:hover {
          color: #1f2937 !important;
          border-color: transparent !important;
        }

        .deals-cancel-btn:hover::before {
          transform: translateX(0%);
        }

        .deals-cancel-btn:hover::after {
          transform: translateX(255%) rotate(8deg);
        }

        /* Action button styling */
        .ist-action-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          border: none;
          background: transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .15s;
        }
        @media (max-width: 768px) {
          .deals-form-grid {
            grid-template-columns: 1fr !important;
          }
          .deals-info-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div className="page-container" style={{ fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", background: "#f8fafc", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", padding: "16px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
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
              Deals Managment
            </h1>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>
              Manage converted leads through deal stages and track progress to client conversion.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {hasFullAccess && (
              <button
                onClick={handleExportCsv}
                className="deals-export-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  background: "#fff",
                  color: "#475569",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <svg style={{ position: "relative", zIndex: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span style={{ position: "relative", zIndex: 1 }}>Export CSV</span>
              </button>
            )}

            {hasFullAccess && (
              <button
                onClick={handleImportClick}
                disabled={importingCsv}
                className="deals-import-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  background: "#fff",
                  color: "#475569",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: importingCsv ? "not-allowed" : "pointer",
                  opacity: importingCsv ? 0.6 : 1,
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                  pointerEvents: importingCsv ? "none" : "auto",
                }}
              >
                <svg style={{ position: "relative", zIndex: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span style={{ position: "relative", zIndex: 1 }}>{importingCsv ? "Importing..." : "Import CSV"}</span>
              </button>
            )}

            {canCreateDeals && (
              <button
                onClick={openAddDealModal}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 14px",
                  border: "none",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add Deal
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div
          className="deals-metrics-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          {[
            { label: "Total Deals", value: stats.total || 0, color: "#667eea", trend: totalChange, isUp: totalTrend },
            { label: "Proposal", value: stats.proposal || 0, color: "#7c3aed", trend: proposalChange, isUp: proposalTrend },
            { label: "Negotiation", value: stats.negotiation || 0, color: "#f59e0b", trend: negotiationChange, isUp: negotiationTrend },
            { label: "Closed Won", value: stats.closedWon || 0, color: "#10b981", trend: wonChange, isUp: wonTrend },
            { label: "Won Value", value: `₹${(stats.wonValue || 0).toLocaleString()}`, color: "#8b5cf6", trend: valueChange, isUp: valueTrend },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px 14px",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginBottom: "10px" }}>
                  {item.label}
                </div>
                <div style={{ fontSize: "28px", fontWeight: 300, color: "#0f172a", lineHeight: 1, marginBottom: "8px" }}>
                  {item.value}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: item.isUp ? "#a8e63d" : "#ef4444", display: "flex", alignItems: "center", gap: "2px" }}>
                    {item.isUp ? <TrendUpIcon /> : <TrendDownIcon />}
                    <span style={{ fontSize: "12px", fontWeight: 600 }}>{item.trend}</span>
                  </span>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>from last month</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Table Container */}
        <div
          style={{
            background: "#fff",
            borderRadius: "14px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0
          }}
        >
          {/* Search and Filters Bar */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fafafa",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "8px 12px",
                minWidth: "240px",
                maxWidth: "340px",
                flex: 1,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search deals by name, client, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  width: "100%",
                  fontSize: "12px",
                  color: "#0f172a",
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  padding: "7px 10px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#475569",
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <option value="all">All Stages</option>
                <option value="Qualification">Qualification</option>
                <option value="Proposal">Proposal</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Closed Won">Closed Won</option>
                <option value="Closed Lost">Closed Lost</option>
              </select>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                style={{
                  padding: "7px 10px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#475569",
                  background: "#fff",
                  cursor: "pointer",
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              >
                <option value="all">All Sources</option>
                <option value="Lead Conversion">Lead Conversion</option>
                <option value="Direct">Direct</option>
                <option value="Referral">Referral</option>
                <option value="Partner">Partner</option>
                <option value="Other">Other</option>
              </select>

              <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
                Showing {filteredDeals.length === 0 ? 0 : pageStartIndex + 1}-{Math.min(pageStartIndex + paginatedDeals.length, filteredDeals.length)} of {filteredDeals.length}
              </div>
            </div>
          </div>

          {/* Table or Empty State */}
          {filteredDeals.length === 0 ? (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "16px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
                No deals found
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                Add a deal or adjust your filters to see results.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0, scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr style={{ background: "#fafafa" }}>
                    {[
                      "Deal ID",
                      "Deal Name",
                      "Client",
                      "Company",
                      "Dealer Name",
                      "Stage",
                      "Probability",
                      "Expected Close",
                      "Source",
                      "Actions",
                    ].map((label, i) => (
                      <th
                        key={label}
                        style={{
                          padding: "7px 8px",
                          textAlign: "left",
                          fontSize: "9px",
                          fontWeight: 700,
                          color: "#94a3b8",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          borderBottom: "1px solid #f1f5f9",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedDeals.map((deal, index) => {
                    const stageBadgeStyle = getStageBadgeStyle(deal.stage);
                    // Hide sensitive details for non-admin users on Closed Won deals
                    const isWonHidden = deal.stage === 'Closed Won' && !hasFullAccess;
                    return (
                      <tr key={deal._id} style={{ borderBottom: index < paginatedDeals.length - 1 ? "1px solid #f8fafc" : "none" }}>
                        <td style={{ padding: "7px 8px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "#667eea", background: "#ede9fe", padding: "2px 7px", borderRadius: "5px", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", letterSpacing: "0.04em" }}>
                            {deal.dealId || '-'}
                          </span>
                        </td>
                        <td style={{ padding: "7px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                            <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#0f172a" }}>
                              {deal.dealName}
                            </span>
                            {(deal.recordType === 'crm' || deal.recordType === 'meta') && (
                              <span style={{
                                fontSize: "9px",
                                fontWeight: 700,
                                color: "#7c3aed",
                                background: "#f3f0ff",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                textTransform: "uppercase",
                                letterSpacing: "0.02em"
                              }}>
                                {deal.recordType === 'crm' ? 'CRM Lead' : 'Meta Lead'}
                              </span>
                            )}
                          </div>
                          {!isWonHidden && <div style={{ fontSize: "10px", color: "#94a3b8" }}>{deal.phone}</div>}
                        </td>
                        <td style={{ padding: "7px 8px" }}>
                          {isWonHidden ? (
                            <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>Hidden</span>
                          ) : (
                            <>
                              <div style={{ fontSize: "11px", color: "#475569", marginBottom: "2px" }}>{deal.clientName}</div>
                              <div style={{ fontSize: "10px", color: "#94a3b8" }}>{deal.email}</div>
                            </>
                          )}
                        </td>
                        <td style={{ padding: "7px 8px", fontSize: "11px", color: "#475569" }}>
                          {isWonHidden ? '—' : (deal.company || '—')}
                        </td>
                        <td style={{ padding: "7px 8px", fontSize: "11px", color: "#475569", fontWeight: 500 }}>
                          {deal.assignedTo ? `${deal.assignedTo.firstName || ''} ${deal.assignedTo.lastName || ''}`.trim() : 'Unassigned'}
                        </td>
                        <td style={{ padding: "7px 8px" }}>
                          <select
                            value={deal.stage || 'Qualification'}
                            onChange={(e) => handleStageChange(deal._id, e.target.value, deal.stage)}
                            disabled={deal.stage === 'Closed Won'}
                            style={{
                              padding: "4px 22px 4px 8px",
                              border: `1px solid ${stageBadgeStyle.color}`,
                              borderRadius: "999px",
                              fontSize: "10px",
                              color: stageBadgeStyle.color,
                              background: `${stageBadgeStyle.background} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 8px center`,
                              appearance: "none",
                              cursor: deal.stage === 'Closed Won' ? 'not-allowed' : 'pointer',
                              fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                              fontWeight: 700,
                              opacity: deal.stage === 'Closed Won' ? 0.7 : 1,
                              outline: "none"
                            }}
                          >
                            <option value="Qualification">Qualification</option>
                            <option value="Proposal">Proposal</option>
                            <option value="Negotiation">Negotiation</option>
                            <option value="Closed Won">Closed Won</option>
                            <option value="Closed Lost">Closed Lost</option>
                          </select>
                        </td>
                        <td style={{ padding: "7px 8px" }}>
                          {(() => {
                            const probability = deal.stage === 'Closed Won' ? 100 : (deal.probability || 10);
                            const probabilityBadgeStyle = getProbabilityBadgeStyle(probability);
                            return (
                              <select
                                value={probability}
                                onChange={(e) => handleProbabilityChange(deal._id, e.target.value)}
                                disabled={deal.stage === 'Closed Won'}
                                style={{
                                  padding: "4px 22px 4px 8px",
                                  border: `1px solid ${probabilityBadgeStyle.border}`,
                                  borderRadius: "999px",
                                  fontSize: "10px",
                                  color: probabilityBadgeStyle.color,
                                  background: `${probabilityBadgeStyle.bg} url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 8px center`,
                                  appearance: "none",
                                  cursor: deal.stage === 'Closed Won' ? 'not-allowed' : 'pointer',
                                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                                  fontWeight: 600,
                                  opacity: deal.stage === 'Closed Won' ? 0.7 : 1,
                                  outline: "none"
                                }}
                              >
                                <option value="0">0%</option>
                                <option value="10">10%</option>
                                <option value="25">25%</option>
                                <option value="50">50%</option>
                                <option value="75">75%</option>
                                <option value="90">90%</option>
                                <option value="100">100%</option>
                              </select>
                            );
                          })()}
                        </td>
                        <td style={{ padding: "7px 8px", fontSize: "10px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
                          {formatDate(deal.expectedCloseDate)}
                        </td>
                        <td style={{ padding: "7px 8px" }}>
                          {(() => {
                            let s = deal.source || "Manual";
                            if (s === "Meta") s = "Lead Conversion";

                            let bg = "#f1f5f9", text = "#475569";
                            if (s === "Manual") { bg = "#eff6ff"; text = "#2563eb"; }
                            else if (s === "Lead Conversion") { bg = "#f0fdf4"; text = "#16a34a"; }
                            else if (s.includes("Excel")) { bg = "#fff7ed"; text = "#ea580c"; }
                            else if (s === "Website") { bg = "#ecfeff"; text = "#0891b2"; }

                            return (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  padding: "3px 10px",
                                  borderRadius: "999px",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: text,
                                  background: bg,
                                  border: `1px solid ${text}20`,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {s}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: "7px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                            <button
                              className="ist-action-btn"
                              title="View details"
                              onClick={() => openEditDealModal(deal, true)}
                              style={{
                                display: "flex", alignItems: "center", justifyContent: "center",
                                width: "28px", height: "28px", borderRadius: "8px", border: "none",
                                background: "transparent", cursor: "pointer", transition: "all 0.2s"
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdf4'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>

                            {canUpdateDeals && (
                              <button
                                className="ist-action-btn"
                                title="Edit deal"
                                onClick={() => openEditDealModal(deal, false)}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  width: "28px", height: "28px", borderRadius: "8px", border: "none",
                                  background: "transparent", cursor: "pointer", transition: "all 0.2s"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}

                            {canDeleteDeals && (
                              <button
                                className="ist-action-btn"
                                title="Delete deal"
                                onClick={() => handleDeleteDeal(deal)}
                                style={{
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  width: "28px", height: "28px", borderRadius: "8px", border: "none",
                                  background: "transparent", cursor: "pointer", transition: "all 0.2s"
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredDeals.length > 0 && totalPages > 1 && (
            <div
              style={{
                padding: "12px 16px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                  style={{
                    minWidth: "64px",
                    height: "28px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    opacity: currentPage === 1 ? 0.45 : 1,
                  }}
                >
                  Prev
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                  let pageNumber;
                  if (totalPages <= 5) {
                    pageNumber = index + 1;
                  } else if (currentPage <= 3) {
                    pageNumber = index + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + index;
                  } else {
                    pageNumber = currentPage - 2 + index;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setCurrentPage(pageNumber)}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "8px",
                        border: pageNumber === currentPage ? "1px solid #a3e635" : "1px solid #e2e8f0",
                        background: pageNumber === currentPage ? "#a3e635" : "#fff",
                        color: pageNumber === currentPage ? "#fff" : "#64748b",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    minWidth: "64px",
                    height: "28px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    opacity: currentPage === totalPages ? 0.45 : 1,
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Menu */}
        {actionMenu && (() => {
          const activeDeal = allDeals.find((deal) => deal._id === actionMenu.id);
          if (!activeDeal) return null;

          const isConvertedLead = activeDeal.recordType === 'crm' || activeDeal.recordType === 'meta';
          const isClosedWon = activeDeal.stage === 'Closed Won';
          const isEditDisabled = isConvertedLead || isClosedWon;

          return (
            <div
              data-deal-action-menu
              style={{
                position: "fixed",
                top: actionMenu.top,
                left: actionMenu.left,
                width: "160px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
                padding: "6px",
                zIndex: 1200,
              }}
            >
              {isConvertedLead && (
                <div style={{
                  padding: "8px 10px",
                  fontSize: "9px",
                  color: "#7c3aed",
                  background: "#f3f0ff",
                  borderRadius: "6px",
                  marginBottom: "4px",
                  textAlign: "center",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em"
                }}>
                  {activeDeal.recordType === 'crm' ? 'CRM Lead' : 'Meta Lead'}
                </div>
              )}
              {hasPermission('proposals', 'create') && (
                <button
                  onClick={() => openProposalComposer(activeDeal)}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    borderRadius: "8px",
                    padding: "9px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#334155",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16v16H4z" />
                    <path d="M8 9h8" />
                    <path d="M8 13h8" />
                    <path d="M8 17h5" />
                  </svg>
                  Send Quotation
                </button>
              )}
              {canUpdateDeals && <button
                onClick={() => {
                  setActionMenu(null);
                  openEditDealModal(activeDeal);
                }}
                disabled={isEditDisabled}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  borderRadius: "8px",
                  padding: "9px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: isEditDisabled ? "#94a3b8" : "#334155",
                  cursor: isEditDisabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                  opacity: isEditDisabled ? 0.5 : 1,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isEditDisabled ? "#94a3b8" : "#2563eb"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
                {isEditDisabled ? "Cannot Edit" : "Edit deal"}
              </button>}
              {canDeleteDeals && (
                <button
                  onClick={() => {
                    setActionMenu(null);
                    handleDeleteDeal(activeDeal);
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    background: "transparent",
                    borderRadius: "8px",
                    padding: "9px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#dc2626",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                  {isConvertedLead ? "Remove" : "Delete deal"}
                </button>
              )}
            </div>
          );
        })()}

        {/* Conversion Confirmation Modal */}
        {showConversionModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2100,
              padding: "20px",
            }}
            onClick={cancelConversion}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "14px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
                width: "100%",
                maxWidth: "340px",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "20px 20px 14px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: "0 0 4px", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                    Convert Deal to Client
                  </h2>
                  <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 6px", lineHeight: 1.5, fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                    This deal will be marked as <strong>Closed Won</strong> and a new client record will be created.
                  </p>
                  <p style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 4, fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Stage cannot be changed after conversion.
                  </p>
                </div>
              </div>
              <div style={{ padding: "12px 20px 16px", display: "flex", gap: "8px", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9" }}>
                <button
                  onClick={cancelConversion}
                  className="deals-cancel-btn"
                  style={{
                    position: "relative",
                    isolation: "isolate",
                    overflow: "hidden",
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: "1.5px solid #e5e7eb",
                    background: "#fff",
                    color: "#6b7280",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  }}
                >
                  <span style={{ position: "relative", zIndex: 1 }}>Cancel</span>
                </button>
                <button
                  onClick={confirmConversion}
                  style={{
                    padding: "7px 14px",
                    borderRadius: "8px",
                    border: "none",
                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  }}
                >
                  Yes, Convert
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Deal Modal */}
        {showModal && (
          <div className="is-modal-overlay" onClick={() => { setShowModal(false); setFormErrors({}); }}>
            <div className={`is-modal ${editingDeal ? '' : 'is-modal-wide'}`} onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="is-modal-header" style={{ padding: editingDeal ? '14px 18px' : '18px 22px' }}>
                {editingDeal ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
                      color: '#fff',
                      fontSize: '15px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {((editingDeal.clientName || editingDeal.dealName || '?')[0]).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {editingDeal.dealName || '—'}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                        <span style={{
                          background: getSourceBadgeStyle(editingDeal.source).bg,
                          color: getSourceBadgeStyle(editingDeal.source).color,
                          border: `1px solid ${getSourceBadgeStyle(editingDeal.source).border}`,
                          padding: '2px 6px',
                          borderRadius: '999px',
                          fontSize: '9px',
                          fontWeight: 600
                        }}>
                          {editingDeal.source || 'Manual'}
                        </span>
                        <span style={{
                          background: getStageBadgeStyle(editingDeal.stage).background,
                          color: getStageBadgeStyle(editingDeal.stage).color,
                          padding: '2px 6px',
                          borderRadius: '999px',
                          fontSize: '9px',
                          fontWeight: 600
                        }}>
                          {editingDeal.stage || 'Qualification'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <h2>Add New Deal</h2>
                )}
                <button className="is-modal-close" onClick={() => { setShowModal(false); setFormErrors({}); }}>×</button>
              </div>

              <div className="is-modal-body" style={{ padding: (editingDeal && isViewOnly) ? '16px 18px' : '20px 22px' }}>
                {editingDeal && isViewOnly ? (
                  <div>
                    {/* Deal Information */}
                    <div style={{ marginBottom: '16px' }}>
                      <p style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px 0', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0' }}>
                        Deal Information
                      </p>
                      <div className="deals-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Deal ID</span>
                          <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 600 }}>{editingDeal.dealId || '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Deal Value</span>
                          <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 600 }}>{(editingDeal.stage === 'Closed Won' && !hasFullAccess) ? '—' : `₹${editingDeal.dealValue || '0'}`}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Client</span>
                          <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>{(editingDeal.stage === 'Closed Won' && !hasFullAccess) ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Hidden</span> : (editingDeal.clientName || '—')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Probability</span>
                          <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 600 }}>{editingDeal.probability || '10'}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Email</span>
                          <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(editingDeal.stage === 'Closed Won' && !hasFullAccess) ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Hidden</span> : (editingDeal.email || '—')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Expected Close</span>
                          <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>{editingDeal.expectedCloseDate ? formatDate(editingDeal.expectedCloseDate) : '—'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Phone</span>
                          <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>{(editingDeal.stage === 'Closed Won' && !hasFullAccess) ? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Hidden</span> : (editingDeal.phone || '—')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Dealer</span>
                          <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>
                            {editingDeal.assignedTo
                              ? `${editingDeal.assignedTo.firstName || ''} ${editingDeal.assignedTo.lastName || ''}`.trim()
                              : 'Unassigned'}
                          </span>
                        </div>
                        {!(editingDeal.stage === 'Closed Won' && !hasFullAccess) && editingDeal.company && editingDeal.company !== '—' && editingDeal.company !== '-' && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Company</span>
                              <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>{editingDeal.company}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc' }}>
                              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Created</span>
                              <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>{editingDeal.createdAt ? formatDate(editingDeal.createdAt) : '—'}</span>
                            </div>
                          </>
                        )}
                        {((editingDeal.stage === 'Closed Won' && !hasFullAccess) || !editingDeal.company || editingDeal.company === '—' || editingDeal.company === '-') && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc', gridColumn: '1 / -1' }}>
                            <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500 }}>Created</span>
                            <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 500 }}>{editingDeal.createdAt ? formatDate(editingDeal.createdAt) : '—'}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    {editingDeal.stage === 'Closed Won' && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          background: '#dcfce7',
                          border: '1px solid #bbf7d0',
                          borderRadius: '6px',
                          padding: '10px 12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#166534' }}>✓ Deal Successfully Closed</div>
                        </div>
                      </div>
                    )}

                    {/* Description/Requirements */}
                    {(editingDeal.description || editingDeal.requirements) && (
                      <div style={{ marginBottom: '16px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px 0', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0' }}>
                          Details
                        </p>
                        {!((editingDeal.stage === 'Closed Won' && !hasFullAccess)) && editingDeal.description && (
                          <div style={{ marginBottom: editingDeal.requirements ? '10px' : '0' }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '3px' }}>Description</div>
                            <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>{editingDeal.description}</div>
                          </div>
                        )}
                        {!((editingDeal.stage === 'Closed Won' && !hasFullAccess)) && editingDeal.requirements && (
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#64748b', marginBottom: '3px' }}>Requirements</div>
                            <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>{editingDeal.requirements}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes */}
                    {!((editingDeal.stage === 'Closed Won' && !hasFullAccess)) && editingDeal.notes && (
                      <div>
                        <p style={{ fontSize: '9px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px 0', paddingBottom: '6px', borderBottom: '1px solid #e2e8f0' }}>
                          Notes
                        </p>
                        <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>{editingDeal.notes}</div>
                      </div>
                    )}

                  </div>
                ) : (
                  /* Add New Deal Form */
                  <form onSubmit={handleSubmit}>
                    <div className="deals-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Deal Name *
                        </label>
                        <input
                          type="text"
                          name="dealName"
                          value={formData.dealName}
                          onChange={handleInputChange}
                          placeholder="e.g., Website Development Project"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: formErrors.dealName ? "1px solid #ef4444" : "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                            outline: "none",
                          }}
                        />
                        {formErrors.dealName && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.dealName}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Client Name *
                        </label>
                        <input
                          type="text"
                          name="clientName"
                          value={formData.clientName}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: formErrors.clientName ? "1px solid #ef4444" : "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                            outline: "none",
                          }}
                        />
                        {formErrors.clientName && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.clientName}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Email *
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: formErrors.email ? "1px solid #ef4444" : "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                            outline: "none",
                          }}
                        />
                        {formErrors.email && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.email}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Phone *
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          placeholder="10-digit phone number"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: formErrors.phone ? "1px solid #ef4444" : "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                            outline: "none",
                          }}
                        />
                        {formErrors.phone && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.phone}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Company
                        </label>
                        <input
                          type="text"
                          name="company"
                          value={formData.company}
                          onChange={handleInputChange}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: formErrors.company ? "1px solid #ef4444" : "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                            outline: "none",
                          }}
                        />
                        {formErrors.company && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.company}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Deal Value (₹) *
                        </label>
                        <input
                          type="number"
                          name="dealValue"
                          value={formData.dealValue}
                          onChange={handleInputChange}
                          min="0"
                          placeholder="Enter deal value"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: formErrors.dealValue ? "1px solid #ef4444" : "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                            outline: "none",
                          }}
                        />
                        {formErrors.dealValue && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.dealValue}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Expected Close Date *
                        </label>
                        <input
                          type="date"
                          name="expectedCloseDate"
                          value={formData.expectedCloseDate}
                          onChange={handleInputChange}
                          min={new Date().toISOString().split('T')[0]}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: formErrors.expectedCloseDate ? "1px solid #ef4444" : "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                            outline: "none",
                          }}
                        />
                        {formErrors.expectedCloseDate && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.expectedCloseDate}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Probability (%)
                        </label>
                        <input
                          type="number"
                          name="probability"
                          value={formData.probability}
                          onChange={handleInputChange}
                          min="0"
                          max="100"
                          placeholder="0-100"
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: formErrors.probability ? "1px solid #ef4444" : "1px solid #e2e8f0",
                            borderRadius: "8px",
                            fontSize: "12px",
                            color: "#0f172a",
                            fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                            outline: "none",
                          }}
                        />
                        {formErrors.probability && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.probability}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                          Source *
                        </label>
                        {!editingDeal ? (
                          <div
                            style={{
                              width: "100%",
                              padding: "9px 12px",
                              border: "1px solid #e2e8f0",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#64748b",
                              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                              background: "#f8fafc",
                              boxSizing: "border-box",
                            }}
                          >
                            Manual
                          </div>
                        ) : (
                          <select
                            name="source"
                            value={formData.source}
                            onChange={handleInputChange}
                            style={{
                              width: "100%",
                              padding: "9px 12px",
                              border: formErrors.source ? "1px solid #ef4444" : "1px solid #e2e8f0",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "#0f172a",
                              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                              outline: "none",
                              background: "#fff",
                              cursor: "pointer",
                            }}
                          >
                            <option value="Manual">Manual</option>
                            <option value="Lead Conversion">Lead Conversion</option>
                            <option value="Direct">Direct</option>
                            <option value="Referral">Referral</option>
                            <option value="Partner">Partner</option>
                            <option value="Other">Other</option>
                          </select>
                        )}
                        {formErrors.source && (
                          <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                            {formErrors.source}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: "16px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows="3"
                        placeholder="Brief description of the deal..."
                        maxLength="500"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          border: formErrors.description ? "1px solid #ef4444" : "1px solid #e2e8f0",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#0f172a",
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                      {formErrors.description && (
                        <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                          {formErrors.description}
                        </div>
                      )}
                      <div style={{ marginTop: "2px", fontSize: "10px", color: "#94a3b8", textAlign: "right" }}>
                        {formData.description.length}/500
                      </div>
                    </div>

                    <div style={{ marginTop: "16px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                        Requirements
                      </label>
                      <textarea
                        name="requirements"
                        value={formData.requirements}
                        onChange={handleInputChange}
                        rows="3"
                        placeholder="Client requirements and expectations..."
                        maxLength="1000"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          border: formErrors.requirements ? "1px solid #ef4444" : "1px solid #e2e8f0",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#0f172a",
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                      {formErrors.requirements && (
                        <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                          {formErrors.requirements}
                        </div>
                      )}
                      <div style={{ marginTop: "2px", fontSize: "10px", color: "#94a3b8", textAlign: "right" }}>
                        {formData.requirements.length}/1000
                      </div>
                    </div>

                    <div style={{ marginTop: "16px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                        Additional Notes
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows="2"
                        maxLength="500"
                        style={{
                          width: "100%",
                          padding: "9px 12px",
                          border: formErrors.notes ? "1px solid #ef4444" : "1px solid #e2e8f0",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "#0f172a",
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                      {formErrors.notes && (
                        <div style={{ marginTop: "4px", fontSize: "11px", color: "#ef4444", fontWeight: 500 }}>
                          {formErrors.notes}
                        </div>
                      )}
                      <div style={{ marginTop: "2px", fontSize: "10px", color: "#94a3b8", textAlign: "right" }}>
                        {formData.notes.length}/500
                      </div>
                    </div>

                    <div style={{ marginTop: "24px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setShowModal(false);
                          setFormErrors({});
                        }}
                        className="deals-cancel-btn"
                        style={{
                          position: "relative",
                          isolation: "isolate",
                          padding: "10px 20px",
                          border: "1.5px solid #e5e7eb",
                          borderRadius: "10px",
                          background: "#fff",
                          color: "#6b7280",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                          overflow: "hidden",
                          transition: "color 0.35s ease, border-color 0.35s ease",
                        }}
                      >
                        <span style={{ position: "relative", zIndex: 1 }}>Cancel</span>
                      </button>
                      <button
                        type="submit"
                        style={{
                          padding: "10px 18px",
                          border: "none",
                          borderRadius: "10px",
                          background: "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                        }}
                      >
                        Create Deal
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Deals;
