import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Store, Plus, Search, Filter, MoreVertical, Eye, Pencil, Trash2,
  Download, FileText, Phone, Mail, MapPin, Building, CreditCard,
  Package, DollarSign, Calendar, Sparkles, X, Check, RefreshCw,
  Paperclip, ExternalLink, ChevronLeft, ChevronRight, Hash, Layers,
  CheckCircle2, Clock, AlertCircle, FileSpreadsheet
} from 'lucide-react';

const UNIT_OPTIONS = [
  'Pcs',
  'Kg',
  'Boxes',
  'Hours',
  'Days',
  'Months',
  'Service',
  'Litres',
  'Meters',
  'Units',
  'Packets',
  'Other'
];

const PAYMENT_MODES = [
  'Bank Transfer / NEFT',
  'UPI',
  'Cheque',
  'Cash',
  'Credit Card',
  'Net Banking',
  'Other'
];

const PAYMENT_MODE_CONFIG = {
  'Bank Transfer / NEFT': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'UPI': { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'Cheque': { bg: '#fefce8', color: '#a16207', border: '#fef08a' },
  'Cash': { bg: '#f8fafc', color: '#334155', border: '#e2e8f0' },
  'Credit Card': { bg: '#faf5ff', color: '#7e22ce', border: '#e9d5ff' },
  'Net Banking': { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' },
  'Other': { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' }
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ITEMS_PER_PAGE = 10;

// Sparkline SVG component matching reference UI
const Sparkline = ({ data = [10, 20, 15, 30, 25, 40], color = '#3b82f6' }) => {
  const w = 80, h = 32;
  const safeData = data.length > 1 ? data : [0, data[0] || 1];
  const max = Math.max(...safeData, 1);
  const min = Math.min(...safeData);
  const range = max - min || 1;
  const pts = safeData.map((v, i) => {
    const x = (i / (safeData.length - 1)) * w;
    const y = h - 4 - ((v - min) / range) * (h - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  const gradId = `spark-grad-${color.replace('#', '')}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {safeData.map((v, i) => {
        const x = (i / (safeData.length - 1)) * w;
        const y = h - 4 - ((v - min) / range) * (h - 10);
        return i === safeData.length - 1 ? <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="2.5" fill={color} /> : null;
      })}
    </svg>
  );
};

function VendorManagement() {
  const { hasPermission, user } = useAuth();
  const canCreate = hasPermission('vendor-management', 'create') || user?.role?.name === 'Admin';
  const canUpdate = hasPermission('vendor-management', 'update') || user?.role?.name === 'Admin';
  const canDelete = hasPermission('vendor-management', 'delete') || user?.role?.name === 'Admin';

  // Active Tab: 'vendors' or 'orders'
  const [activeTab, setActiveTab] = useState('vendors');

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);

  // Month & Year Filter
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [secondaryFilter, setSecondaryFilter] = useState('All'); // Vendor filter or Payment Mode filter
  const [currentPage, setCurrentPage] = useState(1);

  // Dropdowns in Filter bar
  const [showStatusDd, setShowStatusDd] = useState(false);
  const [showSecondaryDd, setShowSecondaryDd] = useState(false);

  // Selection for bulk action
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);

  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [isCustomVendor, setIsCustomVendor] = useState(false);

  // Vendor Details Modal (Popup on vendor pill click)
  const [selectedVendorDetails, setSelectedVendorDetails] = useState(null);

  // Attachment Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState(null);

  // Action Menu Dropdown
  const [actionMenu, setActionMenu] = useState(null);

  // Form Validation Errors
  const [formErrors, setFormErrors] = useState({});

  const validateEmail = (email) => {
    if (!email || !email.trim()) return '';
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      return 'Please enter a valid email address (e.g. name@domain.com)';
    }
    return '';
  };

  const validatePhone = (phone, isRequired = true) => {
    if (!phone || !phone.trim()) {
      return isRequired ? 'Phone number is required' : '';
    }
    const cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    if (!phoneRegex.test(cleaned)) {
      return 'Please enter a valid 10 to 15-digit phone number';
    }
    return '';
  };

  // Form State
  const initialForm = {
    vendorName: '',
    email: '',
    phone: '',
    alternatePhone: '',
    location: '',
    productName: '',
    amount: '',
    unit: 'Pcs',
    quantity: 1,
    paymentMode: 'Bank Transfer / NEFT',
    paymentStatus: 'Paid',
    invoiceNumber: '',
    notes: '',
    attachment: '',
    attachmentName: ''
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    fetchVendors();
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-vendor-menu]')) setActionMenu(null);
      if (!e.target.closest('[data-status-filter]')) setShowStatusDd(false);
      if (!e.target.closest('[data-secondary-filter]')) setShowSecondaryDd(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchVendors = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefetching(true);
    try {
      const res = await api.get('/vendors');
      setVendors(res.data || []);
    } catch (err) {
      console.error('Error fetching vendors:', err);
    } finally {
      if (!silent) setLoading(false);
      else setRefetching(false);
    }
  };

  // Group Vendors for Vendors Directory Tab
  const groupedVendors = useMemo(() => {
    const map = {};
    vendors.forEach(item => {
      const key = (item.vendorName || '').trim().toLowerCase();
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          vendorName: item.vendorName,
          email: item.email,
          phone: item.phone,
          alternatePhone: item.alternatePhone,
          location: item.location,
          notes: item.notes,
          orders: [],
          totalSpent: 0,
          pendingAmount: 0,
          firstCreatedAt: item.createdAt,
          lastOrderDate: item.createdAt,
          paymentStatuses: new Set(),
          createdBy: item.createdBy,
          rawSample: item
        };
      }

      const isActualOrder = !item.isProfileOnly && Boolean(item.productName && item.productName.trim() && item.productName !== 'General Supply / Service');
      if (isActualOrder) {
        map[key].orders.push(item);
        const amt = Number(item.amount) || 0;
        map[key].totalSpent += amt;
        if (item.paymentStatus === 'Pending') {
          map[key].pendingAmount += amt;
        }
        map[key].paymentStatuses.add(item.paymentStatus || 'Paid');
      }

      if (new Date(item.createdAt) > new Date(map[key].lastOrderDate)) {
        map[key].lastOrderDate = item.createdAt;
      }
      if (new Date(item.createdAt) < new Date(map[key].firstCreatedAt)) {
        map[key].firstCreatedAt = item.createdAt;
        if (item.createdBy) map[key].createdBy = item.createdBy;
      }
      if (!map[key].email && item.email) map[key].email = item.email;
      if (!map[key].phone && item.phone) map[key].phone = item.phone;
      if (!map[key].location && item.location) map[key].location = item.location;
    });
    return Object.values(map);
  }, [vendors]);

  // Unique vendor names list for dropdown
  const uniqueVendorNames = useMemo(() => {
    return Array.from(new Set(vendors.map(v => v.vendorName?.trim()).filter(Boolean)));
  }, [vendors]);

  // Filtered Orders (Only actual purchase orders, excluding profile-only vendor records)
  const filteredOrders = useMemo(() => {
    return vendors.filter(v => {
      const isActualOrder = !v.isProfileOnly && Boolean(v.productName && v.productName.trim() && v.productName !== 'General Supply / Service');
      if (!isActualOrder) return false;

      const q = searchTerm.toLowerCase().trim();
      const matchSearch = (
        !q ||
        (v.vendorName && v.vendorName.toLowerCase().includes(q)) ||
        (v.productName && v.productName.toLowerCase().includes(q)) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q)) ||
        (v.alternatePhone && v.alternatePhone.toLowerCase().includes(q)) ||
        (v.location && v.location.toLowerCase().includes(q)) ||
        (v.invoiceNumber && v.invoiceNumber.toLowerCase().includes(q)) ||
        (v.paymentMode && v.paymentMode.toLowerCase().includes(q))
      );

      const matchStatus = statusFilter === 'All' || (v.paymentStatus || 'Paid') === statusFilter;
      const matchSecondary = secondaryFilter === 'All' || v.vendorName === secondaryFilter || v.paymentMode === secondaryFilter;

      return matchSearch && matchStatus && matchSecondary;
    });
  }, [vendors, searchTerm, statusFilter, secondaryFilter]);

  // Filtered Vendors Directory
  const filteredVendorsList = useMemo(() => {
    return groupedVendors.filter(v => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = (
        !q ||
        (v.vendorName && v.vendorName.toLowerCase().includes(q)) ||
        (v.email && v.email.toLowerCase().includes(q)) ||
        (v.phone && v.phone.toLowerCase().includes(q)) ||
        (v.location && v.location.toLowerCase().includes(q))
      );

      const matchStatus = statusFilter === 'All' ||
        (statusFilter === 'Paid' && v.pendingAmount === 0) ||
        (statusFilter === 'Pending' && v.pendingAmount > 0);

      return matchSearch && matchStatus;
    });
  }, [groupedVendors, searchTerm, statusFilter]);

  // Statistics KPI calculations
  const stats = useMemo(() => {
    const actualOrders = vendors.filter(v => !v.isProfileOnly && Boolean(v.productName && v.productName.trim() && v.productName !== 'General Supply / Service'));
    const totalOrders = actualOrders.length;
    const uniqueVendorsCount = groupedVendors.length;
    const totalAmount = actualOrders.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const paidAmount = actualOrders
      .filter(v => (v.paymentStatus || 'Paid') === 'Paid')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const pendingAmount = actualOrders
      .filter(v => v.paymentStatus === 'Pending')
      .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

    return {
      totalOrders,
      uniqueVendorsCount,
      totalAmount,
      paidAmount,
      pendingAmount
    };
  }, [vendors, groupedVendors]);

  // Pagination Logic
  const activeDataset = activeTab === 'vendors' ? filteredVendorsList : filteredOrders;
  const totalPages = Math.max(1, Math.ceil(activeDataset.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const paginatedData = activeDataset.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedOrderIds([]);
  }, [searchTerm, statusFilter, secondaryFilter, activeTab]);

  const formatCurrency = (amt) => {
    const num = Number(amt) || 0;
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '—';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return '—';
    }
  };

  const isAttachmentImage = (attachmentStr) => {
    if (!attachmentStr) return false;
    return attachmentStr.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(attachmentStr);
  };

  const getCreatedByName = (createdBy) => {
    if (!createdBy) return { name: 'Admin', empId: '' };
    if (typeof createdBy === 'string') return { name: createdBy, empId: '' };
    let name = '';
    if (createdBy.firstName || createdBy.lastName) {
      name = `${createdBy.firstName || ''} ${createdBy.lastName || ''}`.trim();
    } else {
      name = createdBy.username || 'Admin';
    }
    const empId = createdBy.employeeId || '';
    return { name, empId };
  };

  // Form Handling
  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentId(null);
    setIsCustomVendor(false);
    setFormData(initialForm);
    setFormErrors({});
    setShowFormModal(true);
    setActionMenu(null);
  };

  const handleOpenEdit = (vendor) => {
    setIsEditing(true);
    setCurrentId(vendor._id);
    setIsCustomVendor(false);
    setFormErrors({});
    setFormData({
      vendorName: vendor.vendorName || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      alternatePhone: vendor.alternatePhone || '',
      location: vendor.location || '',
      productName: vendor.productName || '',
      amount: vendor.amount !== undefined ? vendor.amount : '',
      unit: vendor.unit || 'Pcs',
      quantity: vendor.quantity !== undefined ? vendor.quantity : 1,
      paymentMode: vendor.paymentMode || 'Bank Transfer / NEFT',
      paymentStatus: vendor.paymentStatus || 'Paid',
      invoiceNumber: vendor.invoiceNumber || '',
      notes: vendor.notes || '',
      attachment: vendor.attachment || '',
      attachmentName: vendor.attachmentName || ''
    });
    setShowFormModal(true);
    setActionMenu(null);
  };

  const handleSelectVendorForOrder = (selectedName) => {
    if (selectedName === '__NEW__') {
      setIsCustomVendor(true);
      setFormData(prev => ({
        ...prev,
        vendorName: '',
        email: '',
        phone: '',
        alternatePhone: '',
        location: ''
      }));
      return;
    }
    setIsCustomVendor(false);
    const found = groupedVendors.find(g => g.vendorName === selectedName);
    if (found) {
      setFormData(prev => ({
        ...prev,
        vendorName: found.vendorName,
        email: found.email || '',
        phone: found.phone || '',
        alternatePhone: found.alternatePhone || '',
        location: found.location || ''
      }));
      if (formErrors.vendorName) {
        setFormErrors(prev => ({ ...prev, vendorName: '' }));
      }
    } else {
      setFormData(prev => ({
        ...prev,
        vendorName: selectedName
      }));
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Attachment size must be under 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        attachment: reader.result,
        attachmentName: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setFormData(prev => ({
      ...prev,
      attachment: '',
      attachmentName: ''
    }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    const emailErr = validateEmail(formData.email);
    const phoneErr = validatePhone(formData.phone, activeTab === 'vendors');
    const altPhoneErr = validatePhone(formData.alternatePhone, false);

    const errors = {};
    if (!formData.vendorName || !formData.vendorName.trim()) {
      errors.vendorName = 'Please enter or select a Vendor Name';
    }

    if (activeTab === 'vendors') {
      if (phoneErr) errors.phone = phoneErr;
      if (emailErr) errors.email = emailErr;
      if (altPhoneErr) errors.alternatePhone = altPhoneErr;
    } else {
      // Order validation
      if (formData.phone && phoneErr) errors.phone = phoneErr;
      if (formData.email && emailErr) errors.email = emailErr;
      if (formData.alternatePhone && altPhoneErr) errors.alternatePhone = altPhoneErr;
      if (!formData.productName || !formData.productName.trim()) {
        errors.productName = 'Please enter Product / Service Name';
      }
      if (formData.amount === '' || isNaN(formData.amount) || Number(formData.amount) < 0) {
        errors.amount = 'Please enter a valid positive Amount';
      }
      if (formData.quantity === '' || isNaN(formData.quantity) || Number(formData.quantity) < 1) {
        errors.quantity = 'Quantity must be at least 1';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      let payload;
      if (activeTab === 'vendors') {
        payload = {
          vendorName: formData.vendorName.trim(),
          email: formData.email ? formData.email.trim() : '',
          phone: formData.phone ? formData.phone.trim() : '',
          alternatePhone: formData.alternatePhone ? formData.alternatePhone.trim() : '',
          location: formData.location ? formData.location.trim() : '',
          notes: formData.notes ? formData.notes.trim() : '',
          isProfileOnly: true,
          productName: '',
          amount: 0,
          unit: 'Pcs',
          quantity: 1,
          paymentMode: 'Bank Transfer / NEFT',
          paymentStatus: 'Paid'
        };
      } else {
        payload = {
          ...formData,
          isProfileOnly: false,
          vendorName: formData.vendorName.trim(),
          email: formData.email ? formData.email.trim() : '',
          phone: formData.phone ? formData.phone.trim() : '',
          alternatePhone: formData.alternatePhone ? formData.alternatePhone.trim() : '',
          location: formData.location ? formData.location.trim() : '',
          productName: formData.productName.trim(),
          amount: Number(formData.amount),
          quantity: Number(formData.quantity) || 1
        };
      }

      if (isEditing) {
        await api.put(`/vendors/${currentId}`, payload);
      } else {
        await api.post('/vendors', payload);
      }

      setShowFormModal(false);
      setFormData(initialForm);
      setFormErrors({});
      fetchVendors(true);
    } catch (err) {
      console.error('Error saving vendor record:', err);
      alert(err.response?.data?.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vendor) => {
    setActionMenu(null);
    if (!window.confirm(`Are you sure you want to delete order for vendor "${vendor.vendorName}"?`)) {
      return;
    }
    try {
      await api.delete(`/vendors/${vendor._id}`);
      fetchVendors(true);
    } catch (err) {
      console.error('Error deleting vendor record:', err);
      alert(err.response?.data?.message || 'Failed to delete record');
    }
  };

  const handleMarkSelectedPaid = async () => {
    if (selectedOrderIds.length === 0) {
      alert('Please select at least one order to mark as Paid.');
      return;
    }
    try {
      await Promise.all(
        selectedOrderIds.map(id => api.put(`/vendors/${id}`, { paymentStatus: 'Paid' }))
      );
      setSelectedOrderIds([]);
      fetchVendors(true);
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status for selected orders.');
    }
  };

  const toggleSelectOrder = (id) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.length === paginatedData.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(paginatedData.map(item => item._id));
    }
  };

  const toggleActionMenu = (e, id) => {
    e.stopPropagation();
    if (actionMenu?.id === id) {
      setActionMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 140;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 6;
    setActionMenu({ id, top, left: rect.left - 130 });
  };

  // Export to Excel
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    if (activeTab === 'vendors') {
      const data = filteredVendorsList.map((v, idx) => ({
        'SR NO': idx + 1,
        'VENDOR NAME': v.vendorName,
        'EMAIL': v.email || '—',
        'PHONE': v.phone || '—',
        'ALTERNATE PHONE': v.alternatePhone || '—',
        'LOCATION': v.location || '—',
        'TOTAL ORDERS': v.orders.length,
        'TOTAL SPENT (INR)': v.totalSpent,
        'PENDING AMOUNT (INR)': v.pendingAmount,
        'STATUS': v.pendingAmount > 0 ? 'Pending' : 'Active'
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Vendors Directory');
      XLSX.writeFile(wb, `Vendors_Directory_${selectedMonth + 1}_${selectedYear}.xlsx`);
    } else {
      const data = filteredOrders.map((o, idx) => ({
        'SR NO': idx + 1,
        'DATE': formatDate(o.createdAt),
        'VENDOR NAME': o.vendorName,
        'PRODUCT / ITEM': o.productName,
        'AMOUNT (INR)': o.amount,
        'UNIT': o.unit || 'Pcs',
        'QUANTITY': o.quantity || 1,
        'PAYMENT MODE': o.paymentMode || '—',
        'PAYMENT STATUS': o.paymentStatus || 'Paid',
        'INVOICE NO': o.invoiceNumber || '—',
        'LOCATION': o.location || '—',
        'NOTES': o.notes || '—'
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Vendor Orders');
      XLSX.writeFile(wb, `Vendor_Orders_${selectedMonth + 1}_${selectedYear}.xlsx`);
    }
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    const title = activeTab === 'vendors' ? 'Vendor Directory Report' : 'Vendor Purchase Orders Report';
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-GB')} | Total Records: ${activeDataset.length}`, 14, 22);

    if (activeTab === 'vendors') {
      const head = [['SR NO', 'VENDOR NAME', 'EMAIL', 'PHONE', 'LOCATION', 'ORDERS', 'TOTAL SPENT', 'STATUS']];
      const body = filteredVendorsList.map((v, idx) => [
        idx + 1,
        v.vendorName,
        v.email || '—',
        v.phone || '—',
        v.location || '—',
        v.orders.length,
        formatCurrency(v.totalSpent),
        v.pendingAmount > 0 ? 'Pending' : 'Active'
      ]);
      autoTable(doc, {
        head,
        body,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [29, 91, 64], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });
      doc.save(`Vendor_Directory_${selectedMonth + 1}_${selectedYear}.pdf`);
    } else {
      const head = [['SR NO', 'DATE', 'VENDOR', 'PRODUCT / ITEM', 'AMOUNT', 'UNIT', 'QTY', 'PAYMENT MODE', 'STATUS']];
      const body = filteredOrders.map((o, idx) => [
        idx + 1,
        formatDate(o.createdAt),
        o.vendorName,
        o.productName,
        formatCurrency(o.amount),
        o.unit || 'Pcs',
        o.quantity || 1,
        o.paymentMode || '—',
        o.paymentStatus || 'Paid'
      ]);
      autoTable(doc, {
        head,
        body,
        startY: 28,
        theme: 'grid',
        headStyles: { fillColor: [29, 91, 64], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9 }
      });
      doc.save(`Vendor_Orders_${selectedMonth + 1}_${selectedYear}.pdf`);
    }
  };

  return (
    <div
      className="page-container"
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '24px 32px 48px',
        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
      }}
    >
      {/* ── Keyframe Animations & Common Styles ── */}
      <style>{`
        @keyframes pay-bubble-large {
          0%   { transform: translate(0px, 0px) scale(1); }
          30%  { transform: translate(-5px, -7px) scale(1.04); }
          60%  { transform: translate(4px, -4px) scale(0.97); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes pay-bubble-small {
          0%   { transform: translate(0px, 0px) scale(1); }
          35%  { transform: translate(6px, -9px) scale(1.06); }
          65%  { transform: translate(-4px, -3px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .vendor-kpi-grid > div { position: relative; overflow: hidden; isolation: isolate; }
        .vendor-kpi-grid > div::before {
          content: ''; position: absolute; z-index: 0;
          width: 90px; height: 90px; border-radius: 50%;
          opacity: 0.06; right: -26px; bottom: -26px;
          pointer-events: none;
          animation: pay-bubble-large 5.5s ease-in-out infinite;
        }
        .vendor-kpi-grid > div::after {
          content: ''; position: absolute; z-index: 0;
          width: 54px; height: 54px; border-radius: 50%;
          opacity: 0.04; right: 36px; bottom: -20px;
          pointer-events: none;
          animation: pay-bubble-small 4.2s ease-in-out infinite;
        }
        .vendor-kpi-grid > div:nth-child(1)::before, .vendor-kpi-grid > div:nth-child(1)::after { background: #3b82f6; }
        .vendor-kpi-grid > div:nth-child(2)::before, .vendor-kpi-grid > div:nth-child(2)::after { background: #22c55e; }
        .vendor-kpi-grid > div:nth-child(3)::before, .vendor-kpi-grid > div:nth-child(3)::after { background: #ef4444; }
        .vendor-kpi-grid > div:nth-child(4)::after { animation-delay: 1.8s; }

        .payroll-tabs {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 50px !important;
          padding: 4px !important;
          gap: 6px !important;
          display: flex !important;
          width: 100% !important;
          align-items: center !important;
          box-sizing: border-box !important;
          margin-bottom: 20px !important;
        }

        .tab-btn {
          background: transparent !important;
          color: #64748b !important;
          border: none !important;
          border-radius: 50px !important;
          padding: 7px 18px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          box-shadow: none !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          white-space: nowrap !important;
        }

        .tab-btn.active {
          background: #0596691A !important;
          color: #059669 !important;
          box-shadow: none !important;
        }

        .tab-btn:hover:not(.active) {
          background: #f1f5f9 !important;
          color: #334155 !important;
        }

        .vendor-tbl { font-family: 'Inter','Poppins','Segoe UI',sans-serif; width: 100%; border-collapse: collapse; }
        .vendor-tbl thead tr { background: #fafafa; border-bottom: 1px solid #f1f5f9; }
        .vendor-tbl thead th { font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .05em; padding: 12px 14px; text-align: left; white-space: nowrap; }
        .vendor-tbl tbody tr { border-bottom: 1px solid #f1f5f9; transition: background .15s; }
        .vendor-tbl tbody tr:hover { background: #fafffe; }
        .vendor-tbl tbody td { font-size: 11.5px; color: #475569; padding: 12px 14px; vertical-align: middle; }
        .vendor-tbl tbody tr:last-child { border-bottom: none; }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* ── Page Header (Matching Reference UI) ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 18
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Vendor Management
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            Calculate monthly procurement and manage vendor details
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            <span>Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12.5,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            <span>Year:</span>
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                width: 76,
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12.5,
                fontWeight: 600,
                outline: 'none'
              }}
            />
          </div>

          {/* Calculate & Generate / Add Record Action Button */}
          {canCreate && (
            <button
              onClick={handleOpenAdd}
              className="calculate-btn"
              style={{
                height: 38,
                padding: '0 20px',
                borderRadius: 8,
                border: 'none',
                background: '#3b775e',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(59, 119, 94, 0.18)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2e5f4b'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#3b775e'}
            >
              <Plus size={16} />
              <span>{activeTab === 'vendors' ? 'Add Vendor' : 'Add Order'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs (Matching Payroll full-width pill track & compact buttons) ── */}
      <div className="payroll-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'vendors' ? 'active' : ''}`}
          onClick={() => setActiveTab('vendors')}
        >
          Vendors
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </button>
      </div>

      {/* ── 4 KPI Summary Cards with Sparklines & Bubble Animation ── */}
      <div
        className="vendor-kpi-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 20
        }}
      >
        {/* Card 1: Vendors */}
        <div
          style={{
            background: 'white',
            padding: '14px 16px 10px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s',
            overflow: 'hidden',
            position: 'relative'
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>Vendors</div>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(168,230,61,0.15)', color: '#3d7c00', whiteSpace: 'nowrap' }}>
              ▲ +100%
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: 8 }}>
            {stats.uniqueVendorsCount}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', lineHeight: 1.2 }}>+active vendors</span>
              <span style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.4 }}>In this registry</span>
            </div>
            <Sparkline data={[1, 2, 2, 3, 3, stats.uniqueVendorsCount]} color="#3b82f6" />
          </div>
        </div>

        {/* Card 2: Total Gross Purchases */}
        <div
          style={{
            background: 'white',
            padding: '14px 16px 10px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s',
            overflow: 'hidden',
            position: 'relative'
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>Total Purchases</div>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(168,230,61,0.15)', color: '#3d7c00', whiteSpace: 'nowrap' }}>
              ▲ +100%
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: 8 }}>
            {formatCurrency(stats.totalAmount)}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', lineHeight: 1.2 }}>+gross procurement</span>
              <span style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.4 }}>In this month</span>
            </div>
            <Sparkline data={[0, 1000, 2500, 8000, 15000, stats.totalAmount]} color="#22c55e" />
          </div>
        </div>

        {/* Card 3: Pending Invoices */}
        <div
          style={{
            background: 'white',
            padding: '14px 16px 10px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s',
            overflow: 'hidden',
            position: 'relative'
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>Pending Invoices</div>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(168,230,61,0.15)', color: '#3d7c00', whiteSpace: 'nowrap' }}>
              ▲ +100%
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: 8 }}>
            {formatCurrency(stats.pendingAmount)}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', lineHeight: 1.2 }}>+pending payments</span>
              <span style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.4 }}>Awaiting clearance</span>
            </div>
            <Sparkline data={[0, 0, 500, 200, 100, stats.pendingAmount]} color="#ef4444" />
          </div>
        </div>

        {/* Card 4: Disbursed / Paid Amount */}
        <div
          style={{
            background: 'white',
            padding: '14px 16px 10px',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            transition: 'all 0.3s',
            overflow: 'hidden',
            position: 'relative'
          }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
          onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600, lineHeight: 1.3 }}>Paid / Settled</div>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: 'rgba(168,230,61,0.15)', color: '#3d7c00', whiteSpace: 'nowrap' }}>
              ▲ +100%
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: 8 }}>
            {formatCurrency(stats.paidAmount)}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', lineHeight: 1.2 }}>+cleared disbursement</span>
              <span style={{ fontSize: 9.5, color: '#94a3b8', lineHeight: 1.4 }}>In this month</span>
            </div>
            <Sparkline data={[0, 800, 2000, 7500, 14000, stats.paidAmount]} color="#8b5cf6" />
          </div>
        </div>
      </div>

      {/* ── Table Card with Header Toolbar (Matching Screenshot Layout) ── */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          overflow: 'hidden'
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            background: '#fafafa',
            borderRadius: '14px 14px 0 0',
            justifyContent: 'space-between'
          }}
        >
          {/* Left: Search & Filter Dropdowns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', flex: 1 }}>
            {/* Search Box */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '7px 12px',
                minWidth: 240,
                maxWidth: 320,
                transition: 'all 0.2s'
              }}
            >
              <Search size={15} color="#9ca3af" />
              <input
                type="text"
                placeholder={activeTab === 'vendors' ? 'Search by name, email, location...' : 'Search by name, email, product...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  width: '100%',
                  background: 'transparent',
                  color: '#1e293b'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Dropdown */}
            <div style={{ position: 'relative' }} data-status-filter>
              <button
                type="button"
                onClick={() => setShowStatusDd(!showStatusDd)}
                style={{
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid #e2e8f0',
                  background: statusFilter !== 'All' ? '#eff6ff' : '#ffffff',
                  color: statusFilter !== 'All' ? '#1d4ed8' : '#475569',
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer'
                }}
              >
                <span>{statusFilter === 'All' ? 'All Statuses' : statusFilter}</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>
              </button>
              {showStatusDd && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 160,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    padding: 6,
                    zIndex: 100
                  }}
                >
                  {['All', 'Paid', 'Pending', 'Draft'].map(st => (
                    <button
                      key={st}
                      onClick={() => { setStatusFilter(st); setShowStatusDd(false); }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        border: 'none',
                        background: statusFilter === st ? '#f1f5f9' : 'transparent',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: statusFilter === st ? 700 : 500,
                        color: '#1e293b',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      {st === 'All' ? 'All Statuses' : st}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Secondary Filter (All Vendors or Payment Modes) */}
            {activeTab === 'orders' && (
              <div style={{ position: 'relative' }} data-secondary-filter>
                <button
                  type="button"
                  onClick={() => setShowSecondaryDd(!showSecondaryDd)}
                  style={{
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: secondaryFilter !== 'All' ? '#eff6ff' : '#ffffff',
                    color: secondaryFilter !== 'All' ? '#1d4ed8' : '#475569',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  <span>{secondaryFilter === 'All' ? 'All Vendors' : secondaryFilter}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>▼</span>
                </button>
                {showSecondaryDd && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: 200,
                      maxHeight: 220,
                      overflowY: 'auto',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      padding: 6,
                      zIndex: 100
                    }}
                  >
                    <button
                      onClick={() => { setSecondaryFilter('All'); setShowSecondaryDd(false); }}
                      style={{ width: '100%', padding: '7px 10px', border: 'none', background: secondaryFilter === 'All' ? '#f1f5f9' : 'transparent', borderRadius: 6, fontSize: 12, fontWeight: secondaryFilter === 'All' ? 700 : 500, color: '#1e293b', textAlign: 'left', cursor: 'pointer' }}
                    >
                      All Vendors
                    </button>
                    {uniqueVendorNames.map(vName => (
                      <button
                        key={vName}
                        onClick={() => { setSecondaryFilter(vName); setShowSecondaryDd(false); }}
                        style={{ width: '100%', padding: '7px 10px', border: 'none', background: secondaryFilter === vName ? '#f1f5f9' : 'transparent', borderRadius: 6, fontSize: 12, fontWeight: secondaryFilter === vName ? 700 : 500, color: '#1e293b', textAlign: 'left', cursor: 'pointer' }}
                      >
                        {vName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Quick Action Buttons matching Screenshot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {activeTab === 'orders' && (
              <>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  style={{
                    height: 34,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    background: selectedOrderIds.length > 0 ? '#eff6ff' : '#ffffff',
                    color: selectedOrderIds.length > 0 ? '#1d4ed8' : '#475569',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer'
                  }}
                >
                  <span>☑</span>
                  <span>{selectedOrderIds.length > 0 ? `Selected (${selectedOrderIds.length})` : 'Select'}</span>
                </button>

                {selectedOrderIds.length > 0 && canUpdate && (
                  <button
                    type="button"
                    onClick={handleMarkSelectedPaid}
                    style={{
                      height: 34,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px solid #bbf7d0',
                      background: '#f0fdf4',
                      color: '#15803d',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer'
                    }}
                  >
                    <CheckCircle2 size={13} />
                    <span>Mark Paid</span>
                  </button>
                )}
              </>
            )}

            {/* Export Excel */}
            <button
              type="button"
              onClick={exportToExcel}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer'
              }}
            >
              <Download size={13} color="#16a34a" />
              <span>Export Excel</span>
            </button>

            {/* Export PDF */}
            <button
              type="button"
              onClick={exportToPDF}
              style={{
                height: 34,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer'
              }}
            >
              <FileText size={13} color="#ef4444" />
              <span>Export PDF</span>
            </button>
          </div>
        </div>

        {/* ── Table Content ── */}
        <div style={{ overflowX: 'auto' }}>
          {activeTab === 'vendors' ? (
            /* ──── VENDORS DIRECTORY TABLE ──── */
            <table className="vendor-tbl">
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>SR NO</th>
                  <th style={{ minWidth: 200 }}>VENDOR NAME</th>
                  <th style={{ minWidth: 120, textAlign: 'center' }}>TOTAL ORDERS</th>
                  <th style={{ minWidth: 130 }}>TOTAL SPENT</th>
                  <th style={{ minWidth: 140 }}>ADDED BY</th>
                  <th style={{ minWidth: 110 }}>ADDED ON</th>
                  <th style={{ minWidth: 100 }}>STATUS</th>
                  <th style={{ width: 110, textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '50px 0', textAlign: 'center', color: '#94a3b8' }}>
                      <RefreshCw size={24} className="assets-spin" style={{ display: 'inline-block', marginBottom: 8 }} />
                      <div>Loading vendor registry...</div>
                    </td>
                  </tr>
                ) : filteredVendorsList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '50px 0', textAlign: 'center' }}>
                      <Store size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>No vendors found</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Add a new vendor or modify your search query.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((vendorGroup, idx) => {
                    const sNo = startIndex + idx + 1;
                    const isPending = vendorGroup.pendingAmount > 0;
                    return (
                      <tr key={vendorGroup.vendorName}>
                        {/* SR NO */}
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#94a3b8' }}>{sNo}</td>

                        {/* VENDOR NAME (Pill Button -> opens details modal) */}
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedVendorDetails(vendorGroup.rawSample)}
                            style={{
                              border: 'none',
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '5px 16px',
                              borderRadius: 999,
                              fontSize: 12.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#bae6fd'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#e0f2fe'; }}
                          >
                            <span>{vendorGroup.vendorName}</span>
                          </button>
                        </td>

                        {/* TOTAL ORDERS */}
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ padding: '3px 10px', borderRadius: 999, background: '#f1f5f9', color: '#334155', fontWeight: 700, fontSize: 11 }}>
                            {vendorGroup.orders.length} orders
                          </span>
                        </td>

                        {/* TOTAL SPENT */}
                        <td style={{ fontWeight: 800, color: '#0f172a' }}>
                          {formatCurrency(vendorGroup.totalSpent)}
                        </td>

                        {/* ADDED BY */}
                        <td>
                          {(() => {
                            const creator = getCreatedByName(vendorGroup.createdBy || vendorGroup.rawSample?.createdBy);
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>
                                  {creator.name}
                                </span>
                                {creator.empId ? (
                                  <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600, marginTop: 1 }}>
                                    {creator.empId}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 10.5, color: '#94a3b8' }}>Admin</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* ADDED ON */}
                        <td style={{ color: '#64748b', fontSize: 11.5 }}>
                          {formatDate(vendorGroup.firstCreatedAt || vendorGroup.rawSample?.createdAt)}
                        </td>

                        {/* STATUS */}
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: isPending ? '#d97706' : '#16a34a' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isPending ? '#d97706' : '#16a34a' }} />
                            <span>{isPending ? 'Pending' : 'Active'}</span>
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setSelectedVendorDetails(vendorGroup.rawSample)}
                              style={{
                                border: 'none',
                                background: '#f1f5f9',
                                color: '#0284c7',
                                padding: '4px 10px',
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                            >
                              <Eye size={12} />
                              <span>View</span>
                            </button>
                            {canUpdate && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(vendorGroup.rawSample)}
                                style={{
                                  border: 'none',
                                  background: '#f0fdf4',
                                  color: '#16a34a',
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Pencil size={12} />
                                <span>Edit</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            /* ──── ORDERS TABLE (Matching Screenshot UI & Column Requests) ──── */
            <table className="vendor-tbl">
              <thead>
                <tr>
                  <th style={{ width: 40, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.length > 0 && selectedOrderIds.length === paginatedData.length}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ width: 55, textAlign: 'center' }}>SR NO</th>
                  <th style={{ minWidth: 105 }}>DATE</th>
                  <th style={{ minWidth: 150 }}>VENDOR</th>
                  <th style={{ minWidth: 160 }}>PRODUCT</th>
                  <th style={{ minWidth: 110 }}>AMOUNT</th>
                  <th style={{ minWidth: 80 }}>UNIT</th>
                  <th style={{ minWidth: 75 }}>QUANTITY</th>
                  <th style={{ minWidth: 140 }}>PAYMENT MODE</th>
                  <th style={{ minWidth: 100, textAlign: 'center' }}>ATTACHMENT</th>
                  <th style={{ minWidth: 90 }}>STATUS</th>
                  <th style={{ width: 50, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} style={{ padding: '50px 0', textAlign: 'center', color: '#94a3b8' }}>
                      <RefreshCw size={24} className="assets-spin" style={{ display: 'inline-block', marginBottom: 8 }} />
                      <div>Loading vendor orders...</div>
                    </td>
                  </tr>
                ) : paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ padding: '50px 0', textAlign: 'center' }}>
                      <Package size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>No orders recorded</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Add a purchase order to start tracking procurement.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((order, idx) => {
                    const sNo = startIndex + idx + 1;
                    const modeStyle = PAYMENT_MODE_CONFIG[order.paymentMode] || PAYMENT_MODE_CONFIG['Other'];
                    const isPaid = (order.paymentStatus || 'Paid') === 'Paid';
                    const isDraft = order.paymentStatus === 'Draft';
                    const isSelected = selectedOrderIds.includes(order._id);

                    return (
                      <tr
                        key={order._id}
                        style={{ background: isSelected ? '#f0fdf4' : 'transparent' }}
                      >
                        {/* Checkbox */}
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOrder(order._id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {/* SR NO */}
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#94a3b8' }}>{sNo}</td>

                        {/* DATE */}
                        <td style={{ color: '#64748b', fontSize: 11.5 }}>
                          {formatDate(order.createdAt)}
                        </td>

                        {/* VENDOR (Pill Badge -> Click to open Vendor Details) */}
                        <td>
                          <button
                            type="button"
                            onClick={() => setSelectedVendorDetails(order)}
                            style={{
                              border: 'none',
                              background: '#e0f2fe',
                              color: '#0369a1',
                              padding: '4px 14px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#bae6fd'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#e0f2fe'; }}
                          >
                            <span>{order.vendorName}</span>
                          </button>
                        </td>

                        {/* PRODUCT / ITEM */}
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{order.productName}</div>
                          {order.invoiceNumber && (
                            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>
                              Inv: {order.invoiceNumber}
                            </div>
                          )}
                        </td>

                        {/* AMOUNT */}
                        <td style={{ fontWeight: 800, color: '#0f172a' }}>
                          {formatCurrency(order.amount)}
                        </td>

                        {/* UNIT */}
                        <td>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: '#f1f5f9',
                              color: '#475569',
                              fontSize: 11,
                              fontWeight: 700,
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            {order.unit || 'Pcs'}
                          </span>
                        </td>

                        {/* QUANTITY */}
                        <td style={{ fontWeight: 700, color: '#334155' }}>
                          {order.quantity || 1}
                        </td>

                        {/* PAYMENT MODE */}
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '3px 10px',
                              borderRadius: 999,
                              background: modeStyle.bg,
                              color: modeStyle.color,
                              border: `1px solid ${modeStyle.border}`,
                              fontSize: 11,
                              fontWeight: 700
                            }}
                          >
                            {order.paymentMode || 'Bank Transfer'}
                          </span>
                        </td>

                        {/* ATTACHMENT (Green Pill View Button) */}
                        <td style={{ textAlign: 'center' }}>
                          {order.attachment ? (
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment({
                                url: order.attachment,
                                name: order.attachmentName || `${order.vendorName}_Attachment`,
                                isImage: isAttachmentImage(order.attachment)
                              })}
                              style={{
                                border: '1px solid #bbf7d0',
                                background: '#f0fdf4',
                                color: '#166534',
                                padding: '3px 10px',
                                borderRadius: 999,
                                fontSize: 11,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; }}
                            >
                              <Eye size={12} color="#166534" />
                              <span>View</span>
                            </button>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>—</span>
                          )}
                        </td>

                        {/* STATUS */}
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: isPaid ? '#16a34a' : (isDraft ? '#ca8a04' : '#d97706')
                          }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: isPaid ? '#16a34a' : (isDraft ? '#ca8a04' : '#d97706')
                            }} />
                            <span>{order.paymentStatus || 'Paid'}</span>
                          </span>
                        </td>

                        {/* ACTIONS (3 Dots) */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => toggleActionMenu(e, order._id)}
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              border: 'none',
                              background: 'transparent',
                              color: '#64748b',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Table Pagination & Info Footer ── */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid #f1f5f9',
            background: '#fafafa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Showing <strong>{paginatedData.length}</strong> of <strong>{activeDataset.length}</strong> {activeTab === 'vendors' ? 'vendors' : 'orders'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: safePage <= 1 ? '#cbd5e1' : '#475569',
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ChevronLeft size={15} />
            </button>

            <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
              Page {safePage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: safePage >= totalPages ? '#cbd5e1' : '#475569',
                cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Action Menu Dropdown Portal ── */}
      {actionMenu && (() => {
        const activeOrder = vendors.find(v => v._id === actionMenu.id);
        if (!activeOrder) return null;

        return (
          <div
            data-vendor-menu
            style={{
              position: 'fixed',
              top: actionMenu.top,
              left: actionMenu.left,
              width: 160,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              boxShadow: '0 16px 36px rgba(15,23,42,0.16)',
              padding: 6,
              zIndex: 1200
            }}
          >
            <button
              onClick={() => { setSelectedVendorDetails(activeOrder); setActionMenu(null); }}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: 'none',
                background: 'transparent',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                fontWeight: 600,
                color: '#334155',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Eye size={14} color="#0284c7" />
              <span>Vendor Profile</span>
            </button>

            {canUpdate && (
              <button
                onClick={() => handleOpenEdit(activeOrder)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Pencil size={14} color="#16a34a" />
                <span>Edit Order</span>
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => handleDelete(activeOrder)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#ef4444',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 size={14} color="#ef4444" />
                <span>Delete Order</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* ── Vendor Details Modal (Popup on Vendor Name Pill Click) ── */}
      {selectedVendorDetails && (
        <div
          onClick={() => setSelectedVendorDetails(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1500,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#ffffff',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building size={22} />
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{selectedVendorDetails.vendorName}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Vendor Contact & Profile Directory</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedVendorDetails(null)}
                style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 18, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Only Vendor Name, Email, Phone, Location */}
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Vendor Name */}
                <div style={{ borderBottom: '1px solid #edf2f7', paddingBottom: 12 }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Building size={13} color="#0284c7" />
                    Vendor Name
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                    {selectedVendorDetails.vendorName}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {/* Email Address */}
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={13} color="#0284c7" />
                      Email Address
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
                      {selectedVendorDetails.email ? (
                        <a href={`mailto:${selectedVendorDetails.email}`} style={{ color: '#0284c7', textDecoration: 'none' }}>
                          {selectedVendorDetails.email}
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Not Provided</span>
                      )}
                    </div>
                  </div>

                  {/* Primary Phone */}
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Phone size={13} color="#16a34a" />
                      Phone Number
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginTop: 4 }}>
                      {selectedVendorDetails.phone ? (
                        <a href={`tel:${selectedVendorDetails.phone}`} style={{ color: '#15803d', textDecoration: 'none' }}>
                          {selectedVendorDetails.phone}
                        </a>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </div>
                  </div>

                  {/* Alternate Phone */}
                  {selectedVendorDetails.alternatePhone && (
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={13} color="#a16207" />
                        Alternate Phone
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 4 }}>
                        <a href={`tel:${selectedVendorDetails.alternatePhone}`} style={{ color: '#334155', textDecoration: 'none' }}>
                          {selectedVendorDetails.alternatePhone}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Location / City */}
                  <div style={{ gridColumn: selectedVendorDetails.alternatePhone ? 'auto' : '1 / -1' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={13} color="#dc2626" />
                      Location / Address
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 4 }}>
                      {selectedVendorDetails.location || <span style={{ color: '#94a3b8' }}>Not Specified</span>}
                    </div>
                  </div>
                </div>

                {/* Profile Notes if present */}
                {selectedVendorDetails.notes && (
                  <div style={{ borderTop: '1px solid #edf2f7', paddingTop: 12 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Notes / Remarks
                    </div>
                    <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, fontStyle: 'italic' }}>
                      "{selectedVendorDetails.notes}"
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={() => setSelectedVendorDetails(null)}
                style={{
                  padding: '8px 24px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal (Conditional by activeTab: Vendor Profile vs Order) ── */}
      {showFormModal && (
        <div
          onClick={() => setShowFormModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1500,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 820,
              maxHeight: '92vh',
              background: '#ffffff',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 60px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {activeTab === 'vendors'
                    ? (isEditing ? 'Edit Vendor Profile' : 'Add New Vendor')
                    : (isEditing ? 'Edit Order' : 'Add Order')}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {activeTab === 'vendors'
                    ? 'Enter vendor profile details, contact information, and address.'
                    : 'Select a vendor and enter product items, amount, and payment details.'}
                </div>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 18, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>

                {/* ══════════════════════════════════════════════════════════════
                    MODE 1: VENDORS TAB (Show ONLY Vendor Related Details)
                   ══════════════════════════════════════════════════════════════ */}
                {activeTab === 'vendors' && (
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Building size={15} />
                      <span>Vendor Profile Details</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Vendor Name <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Enter vendor name"
                          value={formData.vendorName}
                          onChange={(e) => {
                            setFormData({ ...formData, vendorName: e.target.value });
                            if (formErrors.vendorName) setFormErrors(prev => ({ ...prev, vendorName: '' }));
                          }}
                          style={{
                            width: '100%',
                            height: 38,
                            borderRadius: 10,
                            border: `1px solid ${formErrors.vendorName ? '#ef4444' : '#e2e8f0'}`,
                            padding: '0 12px',
                            fontSize: 12.5,
                            outline: 'none'
                          }}
                        />
                        {formErrors.vendorName && (
                          <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' }}>{formErrors.vendorName}</span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="Enter email address"
                          value={formData.email}
                          onChange={(e) => {
                            setFormData({ ...formData, email: e.target.value });
                            if (formErrors.email) setFormErrors(prev => ({ ...prev, email: '' }));
                          }}
                          onBlur={(e) => {
                            const err = validateEmail(e.target.value);
                            if (err) setFormErrors(prev => ({ ...prev, email: err }));
                          }}
                          style={{
                            width: '100%',
                            height: 38,
                            borderRadius: 10,
                            border: `1px solid ${formErrors.email ? '#ef4444' : '#e2e8f0'}`,
                            padding: '0 12px',
                            fontSize: 12.5,
                            outline: 'none'
                          }}
                        />
                        {formErrors.email && (
                          <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' }}>{formErrors.email}</span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Primary Phone <span style={{ color: '#ef4444' }}>*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="Enter primary phone number"
                          value={formData.phone}
                          onChange={(e) => {
                            setFormData({ ...formData, phone: e.target.value });
                            if (formErrors.phone) setFormErrors(prev => ({ ...prev, phone: '' }));
                          }}
                          onBlur={(e) => {
                            const err = validatePhone(e.target.value, true);
                            if (err) setFormErrors(prev => ({ ...prev, phone: err }));
                          }}
                          style={{
                            width: '100%',
                            height: 38,
                            borderRadius: 10,
                            border: `1px solid ${formErrors.phone ? '#ef4444' : '#e2e8f0'}`,
                            padding: '0 12px',
                            fontSize: 12.5,
                            outline: 'none'
                          }}
                        />
                        {formErrors.phone && (
                          <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' }}>{formErrors.phone}</span>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Alternate Phone
                        </label>
                        <input
                          type="tel"
                          placeholder="Enter alternate phone number"
                          value={formData.alternatePhone}
                          onChange={(e) => {
                            setFormData({ ...formData, alternatePhone: e.target.value });
                            if (formErrors.alternatePhone) setFormErrors(prev => ({ ...prev, alternatePhone: '' }));
                          }}
                          onBlur={(e) => {
                            const err = validatePhone(e.target.value, false);
                            if (err) setFormErrors(prev => ({ ...prev, alternatePhone: err }));
                          }}
                          style={{
                            width: '100%',
                            height: 38,
                            borderRadius: 10,
                            border: `1px solid ${formErrors.alternatePhone ? '#ef4444' : '#e2e8f0'}`,
                            padding: '0 12px',
                            fontSize: 12.5,
                            outline: 'none'
                          }}
                        />
                        {formErrors.alternatePhone && (
                          <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' }}>{formErrors.alternatePhone}</span>
                        )}
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Location / Address
                        </label>
                        <input
                          type="text"
                          placeholder="Enter location or address"
                          value={formData.location}
                          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                          style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 12.5, outline: 'none' }}
                        />
                      </div>

                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                          Notes / Remarks (Optional)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Enter remarks or vendor profile notes"
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          style={{ width: '100%', borderRadius: 10, border: '1px solid #e2e8f0', padding: '8px 12px', fontSize: 12.5, outline: 'none', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    MODE 2: ORDERS TAB (Select Vendor + Product Item Details)
                   ══════════════════════════════════════════════════════════════ */}
                {activeTab === 'orders' && (
                  <>
                    {/* Step 1: Select Vendor */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px' }}>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Building size={15} />
                        <span>1. Vendor Selection</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isCustomVendor ? 'repeat(2, 1fr)' : '1fr', gap: 12 }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            Select Existing Vendor or Add New <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={isCustomVendor ? '__NEW__' : (formData.vendorName || '')}
                            onChange={(e) => handleSelectVendorForOrder(e.target.value)}
                            style={{
                              width: '100%',
                              height: 38,
                              borderRadius: 10,
                              border: `1px solid ${formErrors.vendorName ? '#ef4444' : '#e2e8f0'}`,
                              padding: '0 12px',
                              fontSize: 12.5,
                              background: '#ffffff',
                              outline: 'none',
                              cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            <option value="">-- Choose Vendor from Registry --</option>
                            {groupedVendors.map(v => (
                              <option key={v.vendorName} value={v.vendorName}>
                                {v.vendorName} {v.phone ? `(${v.phone})` : ''}
                              </option>
                            ))}
                            <option value="__NEW__">+ Enter New / Custom Vendor</option>
                          </select>
                          {formErrors.vendorName && (
                            <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' }}>{formErrors.vendorName}</span>
                          )}
                        </div>

                        {/* Selected Vendor Quick Info Preview Card */}
                        {!isCustomVendor && formData.vendorName && (
                          <div style={{ padding: '10px 14px', background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontWeight: 800, color: '#0369a1', fontSize: 13 }}>{formData.vendorName}</span>
                              {formData.phone && (
                                <span style={{ fontSize: 11.5, color: '#475569', background: '#fff', padding: '2px 8px', borderRadius: 6, border: '1px solid #e0f2fe' }}>
                                  📞 {formData.phone}
                                </span>
                              )}
                              {formData.email && (
                                <span style={{ fontSize: 11.5, color: '#475569', background: '#fff', padding: '2px 8px', borderRadius: 6, border: '1px solid #e0f2fe' }}>
                                  ✉️ {formData.email}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsCustomVendor(true)}
                              style={{ background: 'transparent', border: 'none', color: '#0284c7', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Edit details
                            </button>
                          </div>
                        )}

                        {/* Custom / New Vendor Input Fields */}
                        {isCustomVendor && (
                          <>
                            <div>
                              <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                Vendor Name <span style={{ color: '#ef4444' }}>*</span>
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Enter vendor name"
                                value={formData.vendorName}
                                onChange={(e) => {
                                  setFormData({ ...formData, vendorName: e.target.value });
                                  if (formErrors.vendorName) setFormErrors(prev => ({ ...prev, vendorName: '' }));
                                }}
                                style={{ width: '100%', height: 38, borderRadius: 10, border: `1px solid ${formErrors.vendorName ? '#ef4444' : '#e2e8f0'}`, padding: '0 12px', fontSize: 12.5, outline: 'none' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                Primary Phone
                              </label>
                              <input
                                type="tel"
                                placeholder="Enter primary phone number"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 12.5, outline: 'none' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                Email Address
                              </label>
                              <input
                                type="email"
                                placeholder="Enter email address"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 12.5, outline: 'none' }}
                              />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                Location / Address
                              </label>
                              <input
                                type="text"
                                placeholder="Enter location or address"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 12.5, outline: 'none' }}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Step 2: Product & Order Details */}
                    <div>
                      <div style={{ fontSize: 11.5, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Package size={15} />
                        <span>2. Product & Order Item Details</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                        <div style={{ gridColumn: '1 / 3' }}>
                          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            Product / Service Name <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Enter product or service name"
                            value={formData.productName}
                            onChange={(e) => {
                              setFormData({ ...formData, productName: e.target.value });
                              if (formErrors.productName) setFormErrors(prev => ({ ...prev, productName: '' }));
                            }}
                            style={{
                              width: '100%',
                              height: 38,
                              borderRadius: 10,
                              border: `1px solid ${formErrors.productName ? '#ef4444' : '#e2e8f0'}`,
                              padding: '0 12px',
                              fontSize: 12.5,
                              outline: 'none'
                            }}
                          />
                          {formErrors.productName && (
                            <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' }}>{formErrors.productName}</span>
                          )}
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            placeholder="Enter amount"
                            value={formData.amount}
                            onChange={(e) => {
                              setFormData({ ...formData, amount: e.target.value });
                              if (formErrors.amount) setFormErrors(prev => ({ ...prev, amount: '' }));
                            }}
                            style={{
                              width: '100%',
                              height: 38,
                              borderRadius: 10,
                              border: `1px solid ${formErrors.amount ? '#ef4444' : '#e2e8f0'}`,
                              padding: '0 12px',
                              fontSize: 12.5,
                              outline: 'none'
                            }}
                          />
                          {formErrors.amount && (
                            <span style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'block' }}>{formErrors.amount}</span>
                          )}
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            Unit <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={formData.unit}
                            onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                            style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 10px', fontSize: 12.5, background: '#fff', outline: 'none' }}
                          >
                            {UNIT_OPTIONS.map(u => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            Quantity <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            placeholder="Enter quantity"
                            value={formData.quantity}
                            onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                            style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 12.5, outline: 'none' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            Payment Mode <span style={{ color: '#ef4444' }}>*</span>
                          </label>
                          <select
                            value={formData.paymentMode}
                            onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                            style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 10px', fontSize: 12.5, background: '#fff', outline: 'none' }}
                          >
                            {PAYMENT_MODES.map(m => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            Invoice / Bill No.
                          </label>
                          <input
                            type="text"
                            placeholder="Enter invoice or bill number"
                            value={formData.invoiceNumber}
                            onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                            style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 12.5, outline: 'none' }}
                          />
                        </div>

                        <div style={{ gridColumn: '2 / -1' }}>
                          <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                            Payment Status
                          </label>
                          <select
                            value={formData.paymentStatus}
                            onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                            style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 10px', fontSize: 12.5, background: '#fff', outline: 'none' }}
                          >
                            <option value="Paid">Paid</option>
                            <option value="Pending">Pending</option>
                            <option value="Draft">Draft</option>
                            <option value="Partially Paid">Partially Paid</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Attachment Uploader */}
                    <div>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        Attachment / Bill Receipt (Optional)
                      </label>

                      {formData.attachment ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Paperclip size={16} color="#16a34a" />
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>{formData.attachmentName || 'Attachment Uploaded'}</div>
                              <div style={{ fontSize: 10.5, color: '#15803d' }}>Ready to save</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveAttachment}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '16px',
                            border: '2px dashed #cbd5e1',
                            borderRadius: 12,
                            cursor: 'pointer',
                            background: '#f8fafc',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.background = '#f0f9ff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                        >
                          <Paperclip size={20} color="#64748b" style={{ marginBottom: 4 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>Upload Invoice / Receipt Document (PNG, JPG, PDF, max 5MB)</span>
                          <span style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>Click to browse file</span>
                          <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload} style={{ display: 'none' }} />
                        </label>
                      )}
                    </div>

                    {/* Step 4: Notes */}
                    <div>
                      <label style={{ display: 'block', marginBottom: 5, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        Order Notes / Remarks (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Enter order remarks or notes"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        style={{ width: '100%', height: 38, borderRadius: 10, border: '1px solid #e2e8f0', padding: '0 12px', fontSize: 12.5, outline: 'none' }}
                      />
                    </div>
                  </>
                )}

              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: '8px 24px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#3b775e',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.65 : 1,
                    boxShadow: '0 2px 6px rgba(59, 119, 94, 0.25)'
                  }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#2e5f4b'; }}
                  onMouseLeave={(e) => { if (!saving) e.currentTarget.style.background = '#3b775e'; }}
                >
                  {saving
                    ? 'Saving…'
                    : isEditing
                    ? 'Save Changes'
                    : activeTab === 'vendors'
                    ? 'Create Vendor'
                    : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── High-Resolution Attachment Preview Lightbox ── */}
      {previewAttachment && (
        <div
          onClick={() => setPreviewAttachment(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 2000,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 20,
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
              maxWidth: 640,
              width: '100%',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{previewAttachment.name}</div>
                <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Vendor Invoice / Receipt Document</div>
              </div>
              <button
                onClick={() => setPreviewAttachment(null)}
                style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 18, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', minHeight: 240, maxHeight: '65vh', overflow: 'auto' }}>
              {previewAttachment.isImage ? (
                <img
                  src={previewAttachment.url}
                  alt={previewAttachment.name}
                  style={{ maxHeight: '50vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <FileText size={48} color="#0284c7" style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Document Attached</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>You can download the original document below</div>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={previewAttachment.url}
                download={previewAttachment.name || 'Vendor_Document'}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#0284c7',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Download size={14} />
                <span>Download Attachment</span>
              </a>
              <button
                onClick={() => setPreviewAttachment(null)}
                style={{ padding: '7px 18px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#ffffff', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorManagement;
