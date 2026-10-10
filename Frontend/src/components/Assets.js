import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import AssetAcknowledgmentForm from './AssetAcknowledgmentForm';
import NEHA_MAM_SIGNATURE from '../constants_nehaSign';
import { Printer, Download, Eye, FileText } from 'lucide-react';

const ASSET_TYPES = ['Laptop', 'Desktop', 'Mobile', 'Tablet', 'SIM', 'Monitor', 'Keyboard', 'Mouse', 'Laptop charger', 'Other'];
const PAGE_SIZE = 10;

const emptyForm = {
  brandName: '',
  assetName: '',
  assetType: 'Laptop',
  deviceId: '',
  productId: '',
  model: '',
  colour: '',
  imei1: '',
  imei2: '',
  telecomProvider: '',
  simNumber: '',
  condition: 'Good',
  description: '',
};

const CONDITION_OPTIONS = ['Brand New', 'Like New', 'Good', 'Fair', 'Needs Repair', 'Active', 'Damaged'];

const STATUS_CONFIG = {
  available: { color: '#166534', bg: '#dcfce7', dot: '#22c55e', label: 'Available' },
  assigned: { color: '#1e40af', bg: '#dbeafe', dot: '#3b82f6', label: 'Assigned' },
  maintenance: { color: '#92400e', bg: '#fef3c7', dot: '#f59e0b', label: 'Maintenance' },
  retired: { color: '#991b1b', bg: '#fee2e2', dot: '#ef4444', label: 'Retired' },
};

const TYPE_CONFIG = {
  Laptop: { color: '#1e40af', bg: '#dbeafe', border: '#bfdbfe', dot: '#3b82f6' },
  Desktop: { color: '#4338ca', bg: '#e0e7ff', border: '#c7d2fe', dot: '#6366f1' },
  Mobile: { color: '#15803d', bg: '#dcfce7', border: '#bbf7d0', dot: '#22c55e' },
  Tablet: { color: '#7e22ce', bg: '#f3e8ff', border: '#e9d5ff', dot: '#a855f7' },
  SIM: { color: '#0369a1', bg: '#e0f2fe', border: '#bae6fd', dot: '#0ea5e9' },
  Monitor: { color: '#0f766e', bg: '#ccfbf1', border: '#99f6e4', dot: '#14b8a6' },
  Keyboard: { color: '#b45309', bg: '#fef3c7', border: '#fde68a', dot: '#d97706' },
  Mouse: { color: '#c2410c', bg: '#ffedd5', border: '#fed7aa', dot: '#f97316' },
  'Laptop charger': { color: '#854d0e', bg: '#fef9c3', border: '#fef08a', dot: '#eab308' },
  Other: { color: '#475569', bg: '#f1f5f9', border: '#e2e8f0', dot: '#94a3b8' }
};

const TYPE_ICONS = {
  Laptop: 'M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3',
  Desktop: 'M8 21h8M12 17v4M3 8h18M21 5H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  Mobile: 'M12 18h.01M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
  Tablet: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z',
  SIM: 'M4 4a2 2 0 0 1 2-2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4zm4 4v4h8V8H8zm0 6v2h8v-2H8z',
  Monitor: 'M8 21h8M12 17v4M3 3h18v14H3z',
  Keyboard: 'M9 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4M9 11h6',
  Mouse: 'M20 9V7a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 9h8M16 5V3',
  'Laptop charger': 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  Other: 'M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM12 12h.01',
};

const formatISTDateTime = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  try {
    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
    return `${formatted} IST`;
  } catch {
    return `${d.toLocaleString('en-IN')} IST`;
  }
};

const formatTimelineDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return d.toLocaleString('en-US');
  }
};

const getAssetTimelineEvents = (asset, allEmployees = [], currentUser = null) => {
  if (!asset) return [];
  const events = [];

  const getEmpName = (emp) => {
    if (!emp) return '';
    if (typeof emp === 'object') {
      const name = `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
      return name || emp.username || '';
    }
    const found = allEmployees.find(e => e._id === emp);
    if (found) {
      const name = `${found.firstName || ''} ${found.lastName || ''}`.trim();
      return name || found.username || '';
    }
    return '';
  };

  // 1. Asset Created / Added
  const creatorName = getEmpName(asset.assignedBy) || (currentUser?.firstName ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim() : 'Admin');
  events.push({
    id: 'evt-create',
    title: 'Asset Added to Inventory',
    by: creatorName,
    date: asset.createdAt || asset.assignedDate,
    type: 'blue',
    message: null
  });

  // 2. Process history entries
  const history = (asset.assignmentHistory && asset.assignmentHistory.length > 0)
    ? asset.assignmentHistory
    : (asset.assignedTo ? [{
        employee: asset.assignedTo,
        assignedBy: asset.assignedBy,
        assignedDate: asset.assignedDate || asset.createdAt,
        signature: asset.signature,
        acknowledgement: asset.acknowledgement,
        signedAt: asset.signedAt,
        returnedDate: null
      }] : []);

  history.forEach((item, idx) => {
    if (item.statusType === 'maintenance') {
      // Sent to maintenance
      events.push({
        id: `evt-maint-${idx}`,
        title: 'Sent to Maintenance',
        by: item.maintenanceDetails?.updatedBy || getEmpName(item.assignedBy) || 'Admin',
        date: item.assignedDate || item.maintenanceDetails?.sentOnDate,
        type: 'amber',
        message: item.maintenanceDetails?.issue ? `${item.maintenanceDetails.issue}${item.maintenanceDetails.shopName ? ` · Shop: ${item.maintenanceDetails.shopName}` : ''}` : 'Sent for diagnostics and repair'
      });

      // Returned from maintenance
      if (item.returnedDate) {
        events.push({
          id: `evt-maint-ret-${idx}`,
          title: 'Returned from Maintenance',
          by: 'Authorized Service',
          date: item.returnedDate,
          type: 'blue',
          message: 'Status changed to Available (Returned to Company Pool)'
        });
      }
    } else {
      const receiverName = getEmpName(item.employee) || 'Employee';
      const issuerName = getEmpName(item.assignedBy) || 'Admin';

      // Assignment
      events.push({
        id: `evt-assign-${idx}`,
        title: `Assigned to ${receiverName}`,
        by: issuerName,
        date: item.assignedDate,
        type: 'green',
        message: null
      });

      // Signature / Handover Acknowledged
      if (item.signature || item.acknowledgement) {
        events.push({
          id: `evt-ack-${idx}`,
          title: `Acknowledged & Signed by ${receiverName}`,
          by: receiverName,
          date: item.signedAt || item.assignedDate,
          type: 'green',
          signature: item.signature || null,
          message: null
        });
      }

      // Unassignment / Returned to pool
      if (item.returnedDate) {
        events.push({
          id: `evt-unassign-${idx}`,
          title: `Unassigned from ${receiverName}`,
          by: issuerName,
          date: item.returnedDate,
          type: 'blue',
          message: 'Status changed to Available (Returned to Company Pool)'
        });
      }
    }
  });

  // 3. Check for Retired status
  if (asset.status === 'retired') {
    events.push({
      id: 'evt-retired',
      title: 'Status Changed to Retired',
      by: 'Admin',
      date: asset.updatedAt || new Date(),
      type: 'amber',
      message: 'Asset marked as retired from active service'
    });
  }

  // Sort all events chronologically
  events.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

  return events;
};

function Assets() {
  const { hasPermission, user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Add modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedAdditionalAssets, setSelectedAdditionalAssets] = useState([]);
  const [showAssignMoreDropdown, setShowAssignMoreDropdown] = useState(false);
  const [assignMoreSearch, setAssignMoreSearch] = useState('');
  const [assignSignature, setAssignSignature] = useState('');
  const [assignSignatureFileName, setAssignSignatureFileName] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignTab, setAssignTab] = useState('form'); // 'form' | 'preview'

  // Document Acknowledgment Form Modal (Official / PDF)
  const [showDocModal, setShowDocModal] = useState(false);
  const [docModalAsset, setDocModalAsset] = useState(null);
  const [downloadingDoc, setDownloadingDoc] = useState(false);

  // Accept & Sign modal (Receiver)
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [acceptSignature, setAcceptSignature] = useState('');
  const [acceptSignatureFileName, setAcceptSignatureFileName] = useState('');
  const [savingAccept, setSavingAccept] = useState(false);

  // View Details modal
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsAsset, setDetailsAsset] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // View History modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewAsset, setViewAsset] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Full-size image / signature preview modal
  const [previewImage, setPreviewImage] = useState(null); // { url, title, subtitle }

  // Maintenance modal
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceTarget, setMaintenanceTarget] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    issue: '',
    shopName: '',
    contactPerson: '',
    phoneNumber: '',
    address: '',
    sentOnDate: new Date().toISOString().split('T')[0]
  });
  const [savingMaintenance, setSavingMaintenance] = useState(false);

  // Kebab action menu
  const [actionMenu, setActionMenu] = useState(null); // { id, top, left }
  const [statusDropdown, setStatusDropdown] = useState(null); // { id, top, left }

  // Custom asset types
  const [customTypes, setCustomTypes] = useState([]);
  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [addingTypeEdit, setAddingTypeEdit] = useState(false);
  const [newTypeNameEdit, setNewTypeNameEdit] = useState('');

  // Filters
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filterType, setFilterType] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [showTypeFilterDd, setShowTypeFilterDd] = useState(false);
  const [showEmpFilterDd, setShowEmpFilterDd] = useState(false);
  const [showStatusFilterDd, setShowStatusFilterDd] = useState(false);
  const [typeFilterSearch, setTypeFilterSearch] = useState("");
  const [empFilterSearch, setEmpFilterSearch] = useState("");

  const [showEmpDd, setShowEmpDd] = useState(false);
  const [empSearch, setEmpSearch] = useState("");

  const canCreate = hasPermission('assets', 'create');
  const canUpdate = hasPermission('assets', 'update');
  const canDelete = hasPermission('assets', 'delete');
  const userRoleName = (user?.role?.name || user?.role || '').toString().trim().toLowerCase();
  const isPrivilegedUser = ['admin', 'hr', 'hr manager', 'manager', 'director', 'super admin'].includes(userRoleName) || canCreate || canUpdate;

  useEffect(() => {
    fetchAssets();
    if (canUpdate || canCreate) {
      fetchEmployees();
      fetchRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('[data-asset-menu]')) setActionMenu(null);
      if (!e.target.closest('[data-status-dropdown]')) setStatusDropdown(null);
      if (!e.target.closest('[data-type-filter]')) setShowTypeFilterDd(false);
      if (!e.target.closest('[data-emp-filter]')) setShowEmpFilterDd(false);
      if (!e.target.closest('[data-status-filter]')) setShowStatusFilterDd(false);
      if (!e.target.closest('[data-emp-select]')) setShowEmpDd(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/assets');
      setAssets(res.data);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setLoading(false);
    }
  };

  const refetchAssets = async () => {
    setRefetching(true);
    try {
      const res = await api.get('assets');
      setAssets(res.data);
    } catch (err) {
      console.error('Error fetching assets:', err);
    } finally {
      setRefetching(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('employees');
      setEmployees(res.data);

      // Extract unique departments from employees
      const predefinedDepts = ["IT", "Sales", "HR/Manager"];
      const extractedDepts = res.data.map((emp) => emp.department).filter(Boolean);
      const uniqueDepts = [...new Set([...predefinedDepts, ...extractedDepts])];
      setDepartments(uniqueDepts.sort());
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('roles/list');
      setRoles(res.data);
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  // ---------- Search & Pagination ----------
  const filteredAssets = assets.filter((asset) => {
    const searchMatch = (
      (asset.brandName && asset.brandName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.assetName && asset.assetName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.assetId && asset.assetId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.assetType && asset.assetType.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.deviceId && asset.deviceId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.productId && asset.productId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.serialNumber && asset.serialNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.model && asset.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.assignedTo && (
        (asset.assignedTo.firstName + ' ' + asset.assignedTo.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.assignedTo.employeeId && asset.assignedTo.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.assignedTo.username && asset.assignedTo.username.toLowerCase().includes(searchTerm.toLowerCase()))
      )) ||
      (asset.assignedBy && (
        (asset.assignedBy.firstName + ' ' + asset.assignedBy.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.assignedBy.employeeId && asset.assignedBy.employeeId.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (asset.assignedBy.username && asset.assignedBy.username.toLowerCase().includes(searchTerm.toLowerCase()))
      ))
    );

    const typeMatch = filterType === "" || asset.assetType === filterType;
    const empMatch = filterEmployee === "" || (asset.assignedTo && asset.assignedTo._id === filterEmployee);
    const statusMatch = filterStatus === "" || asset.status === filterStatus;

    let dateMatch = true;
    if (filterDate) {
      if (!asset.assignedDate) {
        dateMatch = false;
      } else {
        const assigned = new Date(asset.assignedDate).setHours(0, 0, 0, 0);
        const filter = new Date(filterDate).setHours(0, 0, 0, 0);
        if (assigned !== filter) dateMatch = false;
      }
    }

    return searchMatch && typeMatch && empMatch && statusMatch && dateMatch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginated = filteredAssets.slice(pageStart, pageStart + PAGE_SIZE);

  // ---------- Stats ----------
  const stats = {
    total: assets.length,
    available: assets.filter((a) => a.status === 'available').length,
    assigned: assets.filter((a) => a.status === 'assigned').length,
    maintenance: assets.filter((a) => a.status === 'maintenance').length,
  };

  // ---------- Action menu ----------
  const toggleMenu = (e, id) => {
    e.stopPropagation();
    if (actionMenu?.id === id) { setActionMenu(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 240; // dropdown height with edit and delete options
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 6;
    setActionMenu({ id, top, left: rect.left - 130 });
  };

  const toggleStatusDropdown = (e, id) => {
    e.stopPropagation();
    if (statusDropdown?.id === id) { setStatusDropdown(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = 150;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 6;
    setStatusDropdown({ id, top, left: rect.left });
  };

  // ---------- Add ----------
  const generateAssetId = () => {
    let maxNum = 0;
    assets.forEach((a) => {
      if (a.assetId) {
        const match = a.assetId.match(/^AST(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    });
    const nextNum = maxNum > 0 ? maxNum + 1 : (assets.length + 1);
    return `AST${String(nextNum).padStart(3, '0')}`;
  };

  const getDisplayAssetCode = (asset, idx) => {
    if (asset?.assetId && /^AST\d{3,}$/i.test(asset.assetId)) {
      return asset.assetId.toUpperCase();
    }
    const overallIdx = assets.findIndex((a) => a._id === asset?._id);
    const num = overallIdx !== -1 ? (overallIdx + 1) : (pageStart + idx + 1);
    return `AST${String(num).padStart(3, '0')}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const brandVal = (formData.brandName || formData.assetName || '').trim();
      let derivedAssetName = brandVal;
      if (formData.assetType === 'SIM') {
        derivedAssetName = formData.telecomProvider ? `${formData.telecomProvider} SIM${formData.simNumber ? ` (${formData.simNumber})` : ''}` : 'SIM Card';
      } else if (formData.model) {
        derivedAssetName = `${brandVal} ${formData.model}`.trim();
      }

      const payload = {
        ...formData,
        assetId: generateAssetId(),
        assetName: derivedAssetName || brandVal || `${formData.assetType} Asset`,
        brandName: formData.assetType === 'SIM' ? formData.telecomProvider : brandVal
      };

      await api.post('assets', payload);
      setShowModal(false);
      setFormData(emptyForm);
      setAddingType(false);
      setNewTypeName('');
      refetchAssets();
    } catch {
      alert('Error creating asset');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Edit ----------
  const openEdit = (asset) => {
    setEditAsset(asset);
    setEditForm({
      brandName: asset.brandName || asset.assetName || '',
      assetName: asset.assetName || asset.brandName || '',
      assetType: asset.assetType || 'Laptop',
      deviceId: asset.deviceId || asset.serialNumber || '',
      productId: asset.productId || '',
      model: asset.model || '',
      colour: asset.colour || '',
      imei1: asset.imei1 || '',
      imei2: asset.imei2 || '',
      telecomProvider: asset.telecomProvider || '',
      simNumber: asset.simNumber || '',
      condition: asset.condition || 'Good',
      description: asset.description || '',
    });
    setAddingTypeEdit(false);
    setNewTypeNameEdit('');
    setShowEditModal(true);
    setActionMenu(null);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      const brandVal = (editForm.brandName || editForm.assetName || '').trim();
      let derivedAssetName = brandVal;
      if (editForm.assetType === 'SIM') {
        derivedAssetName = editForm.telecomProvider ? `${editForm.telecomProvider} SIM${editForm.simNumber ? ` (${editForm.simNumber})` : ''}` : 'SIM Card';
      } else if (editForm.model) {
        derivedAssetName = `${brandVal} ${editForm.model}`.trim();
      }

      const payload = {
        ...editForm,
        assetName: derivedAssetName || brandVal || `${editForm.assetType} Asset`,
        brandName: editForm.assetType === 'SIM' ? editForm.telecomProvider : brandVal
      };

      await api.put(`assets/${editAsset._id}`, payload);
      setShowEditModal(false);
      refetchAssets();
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating asset');
    } finally {
      setSavingEdit(false);
    }
  };

  // Helper: check if logged-in user is receiver of this asset
  const isReceiver = (asset) => {
    if (!asset || !asset.assignedTo || !user) return false;
    const targetObj = typeof asset.assignedTo === 'object' ? asset.assignedTo : null;
    const targetId = targetObj ? targetObj._id : asset.assignedTo;
    const currentUserId = user._id || user.id;
    const targetEmpId = targetObj?.employeeId;
    const userEmpId = user.employeeId;
    const targetUsername = targetObj?.username;
    const userUsername = user.username;

    if (targetId && currentUserId && String(targetId) === String(currentUserId)) return true;
    if (targetEmpId && userEmpId && String(targetEmpId).trim().toLowerCase() === String(userEmpId).trim().toLowerCase()) return true;
    if (targetUsername && userUsername && String(targetUsername).trim().toLowerCase() === String(userUsername).trim().toLowerCase()) return true;
    return false;
  };

  // ---------- Assign (Issuer) ----------
  const openAssign = (asset) => {
    setAssignTarget(asset);
    setSelectedEmployee(asset.assignedTo?._id || '');
    setSelectedAdditionalAssets([]);
    setShowAssignMoreDropdown(false);
    setAssignMoreSearch('');
    setAssignSignature(asset.issuerSignature || '/nehamam_sign.png');
    setAssignSignatureFileName(asset.issuerSignature ? 'Existing Issuer Signature' : 'Neha Mam Signature (Default)');
    setAssignTab('form');
    setEmpSearch('');
    setShowEmpDd(false);
    setShowAssignModal(true);
    setActionMenu(null);
  };

  const openDetails = async (asset) => {
    setActionMenu(null);
    setDetailsAsset(asset);
    setShowDetailsModal(true);
    setLoadingDetails(true);
    try {
      const res = await api.get(`assets/${asset._id}`);
      setDetailsAsset(res.data);
    } catch (err) {
      console.error('Error fetching asset details:', err);
      setDetailsAsset(asset);
    } finally {
      setLoadingDetails(false);
    }
  };

  const openDocModal = async (asset) => {
    setActionMenu(null);
    setShowDocModal(true);
    setDocModalAsset(asset);
    try {
      const res = await api.get(`assets/${asset._id}`);
      setDocModalAsset(res.data);
    } catch (err) {
      console.error('Error fetching asset details for form preview:', err);
    }
  };

  const openHistory = async (asset) => {
    setActionMenu(null);
    setViewAsset(asset);
    setShowViewModal(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`assets/${asset._id}`);
      setViewAsset(res.data);
    } catch (err) {
      console.error('Error fetching asset details for history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDownloadDocPDF = async (targetAsset = null) => {
    setDownloadingDoc(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const sheet = document.getElementById('asset-acknowledgement-sheet');
      if (!sheet) return;

      const canvas = await html2canvas(sheet, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
      const activeObj = targetAsset || docModalAsset || assignTarget;
      const filename = `Asset_Handover_${activeObj?.assetId || 'Form'}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF. Please try again.');
    } finally {
      setDownloadingDoc(false);
    }
  };

  const handlePrintDoc = () => {
    const sheet = document.getElementById('asset-acknowledgement-sheet');
    if (!sheet) return;
    const printWindow = window.open('', '', 'width=900,height=800');
    printWindow.document.write(`
      <html>
        <head>
          <title>Asset Handover Acknowledgement Form</title>
          <style>
            body { margin: 0; padding: 20px; font-family: 'Segoe UI', Roboto, sans-serif; background: #fff; }
            @page { size: A4; margin: 10mm; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${sheet.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper to auto-trim excess transparent/white padding from signature images
  const trimSignatureImage = (dataUrl) => {
    return new Promise((resolve) => {
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
        return resolve(dataUrl);
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;
          let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
          let found = false;

          for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
              const idx = (y * canvas.width + x) * 4;
              const alpha = data[idx + 3];
              const r = data[idx], g = data[idx + 1], b = data[idx + 2];
              const isWhite = r > 235 && g > 235 && b > 235;
              if (alpha > 20 && !isWhite) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
              }
            }
          }

          if (found && maxX > minX && maxY > minY) {
            const pad = 6;
            const cropX = Math.max(0, minX - pad);
            const cropY = Math.max(0, minY - pad);
            const cropW = Math.min(canvas.width - cropX, (maxX - minX) + pad * 2);
            const cropH = Math.min(canvas.height - cropY, (maxY - minY) + pad * 2);

            const trimmedCanvas = document.createElement('canvas');
            trimmedCanvas.width = cropW;
            trimmedCanvas.height = cropH;
            const trimmedCtx = trimmedCanvas.getContext('2d');
            trimmedCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            return resolve(trimmedCanvas.toDataURL('image/png'));
          }
        } catch (err) {
          console.warn('Trim signature error:', err);
        }
        resolve(dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleAssignSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WebP) for your signature.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert('Signature file size should be less than 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const rawData = reader.result;
      const trimmed = await trimSignatureImage(rawData);
      setAssignSignature(trimmed);
      setAssignSignatureFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) {
      alert('Please select an employee to assign this asset to.');
      return;
    }
    setSavingAssign(true);
    try {
      const allAssetIds = [assignTarget._id, ...selectedAdditionalAssets];
      await Promise.all(
        allAssetIds.map((id) =>
          api.put(`assets/${id}`, {
            assignedTo: selectedEmployee || null,
            issuerSignature: assignSignature || '',
            signature: '',
            acknowledgement: false,
            acknowledgementText: ''
          })
        )
      );
      setShowAssignModal(false);
      setSelectedAdditionalAssets([]);
      setAssignSignature('');
      setAssignSignatureFileName('');
      refetchAssets();
    } catch (err) {
      alert(err.response?.data?.message || 'Error assigning asset(s)');
    } finally {
      setSavingAssign(false);
    }
  };

  const openView = async (asset) => {
    setActionMenu(null);
    setShowViewModal(true);
    setLoadingHistory(true);
    try {
      const res = await api.get(`assets/${asset._id}`);
      setViewAsset(res.data);
    } catch (err) {
      console.error('Error fetching asset details:', err);
      setViewAsset(asset);
    } finally {
      setLoadingHistory(false);
    }
  };

  // ---------- Accept & Sign (Receiver) ----------
  const openAccept = (asset) => {
    setAcceptTarget(asset);
    setAcceptSignature(asset.signature || '');
    setAcceptSignatureFileName(asset.signature ? 'Existing Signature' : '');
    setShowAcceptModal(true);
    setActionMenu(null);
  };

  const handleAcceptSignatureUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (PNG, JPG, JPEG, WebP) for the signature.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert('Signature file size should be less than 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const rawData = reader.result;
      const trimmed = await trimSignatureImage(rawData);
      setAcceptSignature(trimmed);
      setAcceptSignatureFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleAcceptSubmit = async (e) => {
    e.preventDefault();
    if (!acceptSignature) {
      alert('Please upload your signature acknowledging receipt of this asset.');
      return;
    }
    setSavingAccept(true);
    try {
      const receiverEmp = acceptTarget?.assignedTo || user;
      const assigneeName = `${receiverEmp.firstName || ''} ${receiverEmp.lastName || ''}`.trim() || receiverEmp.username || 'Employee';
      const assigneeId = receiverEmp.employeeId ? `EMP ID: ${receiverEmp.employeeId}` : '';
      const assigneeRole = receiverEmp.designation || receiverEmp.department || (typeof receiverEmp.role === 'object' ? receiverEmp.role?.name : receiverEmp.role) || 'Employee';

      const receiverAckText = `I, ${assigneeName}${assigneeId ? ` (${assigneeId})` : ''}, working as ${assigneeRole}, acknowledge receipt of this asset (${acceptTarget?.assetName || ''}${acceptTarget?.deviceId ? `, Device ID: ${acceptTarget.deviceId}` : (acceptTarget?.serialNumber ? `, Serial No: ${acceptTarget.serialNumber}` : '')}${acceptTarget?.productId ? `, Product ID: ${acceptTarget.productId}` : ''}) in good working condition. I assume full responsibility for its safekeeping, proper usage, and adherence to company policies. I undertake to return it upon company request and agree to be held accountable for any damage, loss, theft, or unauthorized handling, and confirm this acknowledgement by uploading my signature.`;

      await api.post(`assets/${acceptTarget._id}/acknowledge`, {
        signature: acceptSignature,
        acknowledgementText: receiverAckText
      });
      setShowAcceptModal(false);
      setAcceptTarget(null);
      setAcceptSignature('');
      setAcceptSignatureFileName('');
      refetchAssets();
    } catch (err) {
      console.error('Error acknowledging asset:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error acknowledging asset';
      alert(msg);
    } finally {
      setSavingAccept(false);
    }
  };

  const handleUnassign = async (asset) => {
    setActionMenu(null);
    try {
      await api.put(`assets/${asset._id}`, { assignedTo: null });
      refetchAssets();
    } catch {
      alert('Error unassigning asset');
    }
  };

  const handleMaintenance = (asset) => {
    setActionMenu(null);
    setMaintenanceTarget(asset);
    setMaintenanceForm({
      issue: '',
      shopName: '',
      contactPerson: '',
      phoneNumber: '',
      address: '',
      sentOnDate: new Date().toISOString().split('T')[0]
    });
    setShowMaintenanceModal(true);
  };

  const handleMaintenanceSubmit = async (e) => {
    e.preventDefault();
    setSavingMaintenance(true);
    try {
      const dateString = new Date().toLocaleString();
      const updatedByName = user ? `${user.firstName} ${user.lastName} (${dateString})` : `Unknown (${dateString})`;
      const payload = {
        status: 'maintenance',
        assignedTo: null,
        maintenanceDetails: {
          ...maintenanceForm,
          updatedBy: updatedByName
        }
      };
      await api.put(`assets/${maintenanceTarget._id}`, payload);
      setShowMaintenanceModal(false);
      setMaintenanceTarget(null);
      refetchAssets();
    } catch {
      alert('Error saving maintenance details');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleStatusChange = async (asset, newStatus) => {
    try {
      const payload = { status: newStatus };
      if (newStatus !== 'assigned') payload.assignedTo = null;
      await api.put(`assets/${asset._id}`, payload);
      refetchAssets();
    } catch {
      alert('Error updating asset status');
    }
  };

  const handleStatusSelect = (asset, newStatus) => {
    setStatusDropdown(null);
    if (newStatus === 'assigned') {
      openAssign(asset);
    } else if (newStatus === 'maintenance') {
      handleMaintenance(asset);
    } else if (newStatus !== asset.status) {
      handleStatusChange(asset, newStatus);
    }
  };

  // ---------- Delete ----------
  const handleDelete = async (asset) => {
    setActionMenu(null);
    if (!window.confirm(`Delete asset "${asset.assetName}"?`)) return;
    try {
      await api.delete(`assets/${asset._id}`);
      refetchAssets();
    } catch {
      alert('Error deleting asset');
    }
  };

  // ---------- Skeleton ----------
  if (loading || refetching) {
    return (
      <div
        className="page-container"
        style={{
          minHeight: '100vh',
          background: '#f8fafc',
          padding: '28px 28px 40px',
          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
        }}
      >
        <style>{`
          @keyframes assets-shimmer {
            0% { background-position: -600px 0; }
            100% { background-position: 600px 0; }
          }
          .assets-skeleton {
            border-radius: 8px;
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 600px 100%;
            animation: assets-shimmer 1.4s infinite linear;
          }
        `}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px' }}>
          <div>
            <div className="assets-skeleton" style={{ width: 200, height: 28, marginBottom: 8 }} />
            <div className="assets-skeleton" style={{ width: 300, height: 16 }} />
          </div>
          <div className="assets-skeleton" style={{ width: 110, height: 36, borderRadius: 10 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 18px' }}>
              <div className="assets-skeleton" style={{ width: 80, height: 13, marginBottom: 10 }} />
              <div className="assets-skeleton" style={{ width: 48, height: 28, marginBottom: 12 }} />
              <div className="assets-skeleton" style={{ width: 34, height: 3 }} />
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
            <div className="assets-skeleton" style={{ width: 240, height: 36, borderRadius: 10 }} />
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
              <div className="assets-skeleton" style={{ width: 80, height: 14 }} />
              <div className="assets-skeleton" style={{ flex: 1, height: 14 }} />
              <div className="assets-skeleton" style={{ width: 70, height: 14 }} />
              <div className="assets-skeleton" style={{ width: 60, height: 20, borderRadius: 999 }} />
              <div className="assets-skeleton" style={{ width: 100, height: 14 }} />
              <div className="assets-skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Main UI ----------
  return (
    <div
      className="page-container"
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#f8fafc',
        padding: '24px 28px',
        boxSizing: 'border-box',
        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
      }}
    >
      <style>{`
        @keyframes assets-bubble-float-large {
          0% { transform: translate(0,0) scale(1); }
          30% { transform: translate(-5px,-7px) scale(1.04); }
          60% { transform: translate(4px,-4px) scale(0.97); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes assets-bubble-float-small {
          0% { transform: translate(0,0) scale(1); }
          35% { transform: translate(6px,-9px) scale(1.06); }
          65% { transform: translate(-4px,-3px) scale(0.95); }
          100% { transform: translate(0,0) scale(1); }
        }
        .assets-metrics-grid > div {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }
        .assets-metrics-grid > div::before {
          content: '';
          position: absolute;
          z-index: 0;
          width: 90px; height: 90px;
          border-radius: 50%;
          opacity: 0.06;
          right: -26px; bottom: -26px;
          pointer-events: none;
          animation: assets-bubble-float-large 5.5s ease-in-out infinite;
        }
        .assets-metrics-grid > div::after {
          content: '';
          position: absolute;
          z-index: 0;
          width: 54px; height: 54px;
          border-radius: 50%;
          opacity: 0.04;
          right: 36px; bottom: -20px;
          pointer-events: none;
          animation: assets-bubble-float-small 4.2s ease-in-out infinite;
        }
        .assets-metrics-grid > div:nth-child(1)::before,
        .assets-metrics-grid > div:nth-child(1)::after { background: #667eea; }
        .assets-metrics-grid > div:nth-child(2)::before,
        .assets-metrics-grid > div:nth-child(2)::after { background: #10b981; }
        .assets-metrics-grid > div:nth-child(3)::before,
        .assets-metrics-grid > div:nth-child(3)::after { background: #3b82f6; }
        .assets-metrics-grid > div:nth-child(4)::before,
        .assets-metrics-grid > div:nth-child(4)::after { background: #f59e0b; }
        .assets-metrics-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
        .assets-metrics-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
        .assets-metrics-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
        .assets-metrics-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
        .assets-metrics-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
        .assets-metrics-grid > div:nth-child(4)::after { animation-delay: 1.8s; }

        .assets-table-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f8fafc;
        }
        .assets-table-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .assets-table-scroll::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        .assets-table-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 999px;
        }
        .assets-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }

        .asset-menu-btn {
          transition: background 0.15s ease;
        }
        .asset-menu-btn:hover {
          background: #f8fafc !important;
        }
        .asset-menu-btn-danger:hover {
          background: #fff5f5 !important;
        }
        .asset-menu-btn-warn:hover {
          background: #fffbeb !important;
        }
        @media (max-width: 768px) {
          .asset-form-grid {
            grid-template-columns: 1fr !important;
          }
          @keyframes empDdIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>
            Asset Management
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0', fontWeight: 500 }}>
            {canUpdate || canCreate ? 'Manage and assign company assets to employees.' : 'Assets assigned to you are listed here.'}
          </p>
        </div>
        {(canCreate || canUpdate) && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 14px', border: 'none', borderRadius: 10,
              background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
              color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Asset
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      {(canUpdate || canCreate) && (
        <div
          className="assets-metrics-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18, flexShrink: 0 }}
        >
          {[
            { label: 'Total Assets', value: stats.total, color: '#667eea', filter: '' },
            { label: 'Available', value: stats.available, color: '#10b981', filter: 'available' },
            { label: 'Assigned', value: stats.assigned, color: '#3b82f6', filter: 'assigned' },
            { label: 'Under Maintenance', value: stats.maintenance, color: '#f59e0b', filter: 'maintenance' },
          ].map((item) => (
            <div
              key={item.label}
              onClick={() => { setFilterStatus(item.filter); setCurrentPage(1); }}
              style={{
                background: '#fff', border: filterStatus === item.filter ? `1.5px solid ${item.color}` : '1px solid #e2e8f0',
                borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                boxShadow: filterStatus === item.filter ? `0 4px 14px ${item.color}20` : 'none',
                transform: filterStatus === item.filter ? 'translateY(-2px)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 10 }}>{item.label}</div>
                <div style={{ fontSize: 28, fontWeight: 300, color: '#0f172a', lineHeight: 1 }}>{item.value}</div>
                <div style={{ width: 34, height: 3, borderRadius: 999, background: item.color, marginTop: 12, opacity: 0.8 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table card ── */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 2px rgba(15,23,42,0.04)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* search bar */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '8px 12px', minWidth: 240, maxWidth: 340, width: '100%' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search assets by name, ID, type..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 12, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif" }}
            />
          </div>

          {(canUpdate || canCreate) && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Type Filter */}
              <div style={{ position: 'relative' }} data-type-filter>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowTypeFilterDd(!showTypeFilterDd); setShowEmpFilterDd(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '999px',
                    fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                    background: showTypeFilterDd ? '#f0fdf4' : '#ffffff',
                    color: '#475569', outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{filterType === "" ? "All Types" : filterType}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showTypeFilterDd ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showTypeFilterDd && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                    background: '#ffffff', borderRadius: '14px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 300,
                    width: '240px', padding: '10px', overflow: 'hidden',
                    border: '1px solid #f1f5f9',
                    animation: 'empDdIn 0.2s ease'
                  }}>
                    <input
                      type="text"
                      placeholder="Search types..."
                      value={typeFilterSearch}
                      onChange={(e) => setTypeFilterSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '7px 10px', border: '1px solid #f1f5f9',
                        borderRadius: '8px', fontSize: '11px', background: '#f8fafc',
                        outline: 'none', marginBottom: '8px'
                      }}
                    />
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <div
                        onClick={() => { setFilterType(""); setShowTypeFilterDd(false); setTypeFilterSearch(""); setCurrentPage(1); }}
                        style={{
                          padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
                          fontWeight: filterType === "" ? '700' : '500',
                          cursor: 'pointer', color: filterType === "" ? '#15803d' : '#1e293b',
                          background: filterType === "" ? '#dcfce7' : 'transparent',
                          marginBottom: '2px'
                        }}
                      >All Types</div>
                      {Object.keys(TYPE_ICONS).filter(t => t.toLowerCase().includes(typeFilterSearch.toLowerCase())).map(type => (
                        <div
                          key={type}
                          onClick={() => { setFilterType(type); setShowTypeFilterDd(false); setTypeFilterSearch(""); setCurrentPage(1); }}
                          style={{
                            padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
                            fontWeight: filterType === type ? '700' : '500',
                            cursor: 'pointer', color: filterType === type ? '#15803d' : '#1e293b',
                            background: filterType === type ? '#dcfce7' : 'transparent',
                            marginBottom: '2px'
                          }}
                        >{type}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Employee Filter */}
              <div style={{ position: 'relative' }} data-emp-filter>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowEmpFilterDd(!showEmpFilterDd); setShowTypeFilterDd(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '999px',
                    fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                    background: showEmpFilterDd ? '#f0fdf4' : '#ffffff',
                    color: '#475569', outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{filterEmployee === "" ? "All Employees" : employees.find(e => e._id === filterEmployee)?.firstName + ' ' + employees.find(e => e._id === filterEmployee)?.lastName || "All Employees"}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEmpFilterDd ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showEmpFilterDd && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                    background: '#ffffff', borderRadius: '14px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 300,
                    width: '240px', padding: '10px', overflow: 'hidden',
                    border: '1px solid #f1f5f9',
                    animation: 'empDdIn 0.2s ease'
                  }}>
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={empFilterSearch}
                      onChange={(e) => setEmpFilterSearch(e.target.value)}
                      style={{
                        width: '100%', padding: '7px 10px', border: '1px solid #f1f5f9',
                        borderRadius: '8px', fontSize: '11px', background: '#f8fafc',
                        outline: 'none', marginBottom: '8px'
                      }}
                    />
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <div
                        onClick={() => { setFilterEmployee(""); setShowEmpFilterDd(false); setEmpFilterSearch(""); setCurrentPage(1); }}
                        style={{
                          padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
                          fontWeight: filterEmployee === "" ? '700' : '500',
                          cursor: 'pointer', color: filterEmployee === "" ? '#15803d' : '#1e293b',
                          background: filterEmployee === "" ? '#dcfce7' : 'transparent',
                          marginBottom: '2px'
                        }}
                      >All Employees</div>
                      {employees.filter(emp => (emp.firstName + ' ' + emp.lastName).toLowerCase().includes(empFilterSearch.toLowerCase())).map(emp => (
                        <div
                          key={emp._id}
                          onClick={() => { setFilterEmployee(emp._id); setShowEmpFilterDd(false); setEmpFilterSearch(""); setCurrentPage(1); }}
                          style={{
                            padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
                            fontWeight: filterEmployee === emp._id ? '700' : '500',
                            cursor: 'pointer', color: filterEmployee === emp._id ? '#15803d' : '#1e293b',
                            background: filterEmployee === emp._id ? '#dcfce7' : 'transparent',
                            marginBottom: '2px'
                          }}
                        >{emp.firstName} {emp.lastName}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Filter */}
              <div style={{ position: 'relative' }} data-status-filter>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowStatusFilterDd(!showStatusFilterDd); setShowTypeFilterDd(false); setShowEmpFilterDd(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '999px',
                    fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                    background: showStatusFilterDd ? '#f0fdf4' : '#ffffff',
                    color: '#475569', outline: 'none',
                    fontFamily: "'Inter', sans-serif",
                    transition: 'all 0.2s'
                  }}
                >
                  <span>{filterStatus === "" ? "All Status" : STATUS_CONFIG[filterStatus]?.label || "All Status"}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showStatusFilterDd ? 'rotate(180deg)' : 'none' }}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {showStatusFilterDd && (
                  <div onClick={e => e.stopPropagation()} style={{
                    position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                    background: '#ffffff', borderRadius: '14px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 300,
                    width: '180px', padding: '10px', overflow: 'hidden',
                    border: '1px solid #f1f5f9',
                    animation: 'empDdIn 0.2s ease'
                  }}>
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <div
                        onClick={() => { setFilterStatus(""); setShowStatusFilterDd(false); setCurrentPage(1); }}
                        style={{
                          padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
                          fontWeight: filterStatus === "" ? '700' : '500',
                          cursor: 'pointer', color: filterStatus === "" ? '#15803d' : '#1e293b',
                          background: filterStatus === "" ? '#dcfce7' : 'transparent',
                          marginBottom: '2px'
                        }}
                      >All Status</div>
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <div
                          key={key}
                          onClick={() => { setFilterStatus(key); setShowStatusFilterDd(false); setCurrentPage(1); }}
                          style={{
                            padding: '7px 10px', borderRadius: '6px', fontSize: '11px',
                            fontWeight: filterStatus === key ? '700' : '500',
                            cursor: 'pointer', color: filterStatus === key ? '#15803d' : '#1e293b',
                            background: filterStatus === key ? '#dcfce7' : 'transparent',
                            marginBottom: '2px',
                            display: 'flex', alignItems: 'center', gap: '6px'
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: config.dot, flexShrink: 0 }} />
                          {config.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Date Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '999px',
                      fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      background: filterDate ? '#f0fdf4' : '#ffffff',
                      color: filterDate ? '#15803d' : '#475569', outline: 'none',
                      fontFamily: "'Inter', sans-serif",
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>
                      {filterDate
                        ? new Date(filterDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : "Select Date"}
                    </span>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </button>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => { setFilterDate(e.target.value); setCurrentPage(1); }}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      opacity: 0, cursor: 'pointer'
                    }}
                    title="Select Date"
                  />
                </div>
                {filterDate && (
                  <button onClick={() => { setFilterDate(""); setCurrentPage(1); }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}

          <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginLeft: 'auto' }}>
            Showing {filteredAssets.length === 0 ? 0 : pageStart + 1}–{Math.min(pageStart + paginated.length, filteredAssets.length)} of {filteredAssets.length}
          </div>
        </div>

        <div className="assets-table-scroll" style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {/* empty state */}
          {filteredAssets.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>No assets found</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {canCreate || canUpdate ? 'Add your first asset using the button above.' : 'No assets have been assigned to you yet.'}
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ width: 54, padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>SRNO.</th>
                  <th style={{ minWidth: 160, padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ASSET NAME</th>
                  <th style={{ width: 110, padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ASSET CODE</th>
                  <th style={{ width: 120, padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ASSET TYPE</th>
                  <th style={{ width: 100, padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>STATUS</th>
                  <th style={{ minWidth: 135, padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ASSIGNED TO</th>
                  <th style={{ minWidth: 125, padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ASSIGNED BY</th>
                  <th style={{ width: 105, padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ASSIGNED DATE</th>
                  <th style={{ width: 125, padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ACKNOWLEDGEMENT</th>
                  <th style={{ width: 135, minWidth: 125, padding: '10px 12px', textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((asset, idx) => {
                  const sc = STATUS_CONFIG[asset.status] || STATUS_CONFIG.available;
                  const needsAcceptance = asset.status === 'assigned' && !asset.signature;
                  const canAccept = needsAcceptance && isReceiver(asset);

                  return (
                    <tr
                      key={asset._id}
                      style={{ borderBottom: idx < paginated.length - 1 ? '1px solid #f1f5f9' : 'none', transition: 'background 0.15s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* SRNO. */}
                      <td style={{ padding: '9px 12px', fontSize: '12px', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>
                        {pageStart + idx + 1}
                      </td>

                      {/* ASSET NAME (Brand Name display here) */}
                      <td style={{ padding: '9px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d={TYPE_ICONS[asset.assetType] || TYPE_ICONS.Other} />
                            </svg>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }} title={asset.brandName || asset.assetName}>
                              {asset.brandName || asset.assetName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ASSET CODE (Autogenerated text format like AST001) */}
                      <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#334155'
                        }}>
                          {getDisplayAssetCode(asset, idx)}
                        </span>
                      </td>

                      {/* ASSET TYPE */}
                      <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const tc = TYPE_CONFIG[asset.assetType] || TYPE_CONFIG.Other;
                          return (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4.5,
                              padding: '2.5px 8px',
                              borderRadius: 999,
                              fontSize: '10.5px',
                              fontWeight: 600,
                              color: tc.color,
                              background: tc.bg,
                              border: `1px solid ${tc.border}`
                            }}>
                              <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: tc.dot, flexShrink: 0 }} />
                              {asset.assetType}
                            </span>
                          );
                        })()}
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {canUpdate ? (
                          <button
                            onClick={(e) => toggleStatusDropdown(e, asset._id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2.5px 8px', borderRadius: 999, fontSize: '10.5px', fontWeight: 600, color: sc.color, background: sc.bg, border: `1px solid ${sc.color}40`, cursor: 'pointer', outline: 'none'
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                            {sc.label}
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                          </button>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2.5px 8px', borderRadius: 999, fontSize: '10.5px', fontWeight: 600, color: sc.color, background: sc.bg }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc.dot, flexShrink: 0 }} />
                            {sc.label}
                          </span>
                        )}
                      </td>

                      {/* ASSIGNED TO */}
                      <td style={{ padding: '9px 12px' }}>
                        {asset.assignedTo ? (
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                              {asset.assignedTo.firstName} {asset.assignedTo.lastName}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: 1, whiteSpace: 'nowrap' }}>{asset.assignedTo.employeeId || asset.assignedTo.username || ''}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* ASSIGNED BY */}
                      <td style={{ padding: '9px 12px' }}>
                        {asset.assignedBy ? (
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', lineHeight: 1.25, whiteSpace: 'nowrap' }}>
                              {asset.assignedBy.firstName} {asset.assignedBy.lastName}
                            </div>
                            <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: 1, whiteSpace: 'nowrap' }}>{asset.assignedBy.employeeId || asset.assignedBy.username || ''}</div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* ASSIGNED DATE */}
                      <td style={{ padding: '9px 12px', fontSize: '11px', color: '#475569', fontWeight: 500, textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {asset.assignedDate ? new Date(asset.assignedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>

                      {/* ACKNOWLEDGEMENT */}
                      <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {asset.status === 'assigned' ? (
                          asset.signature || asset.acknowledgement ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2.5px 8px', borderRadius: 999, fontSize: '10.5px', fontWeight: 600, color: '#15803d', background: '#dcfce7', border: '1px solid #bbf7d0' }}>
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Signed
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2.5px 8px', borderRadius: 999, fontSize: '10.5px', fontWeight: 600, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a' }}>
                              <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: '#d97706' }} />
                              Pending
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* ACTION */}
                      <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} data-asset-menu>
                          {/* Receiver Accept & Sign Button (only for assigned receiver) */}
                          {canAccept && (
                            <button
                              onClick={() => openAccept(asset)}
                              title="Accept Asset & Upload Signature"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                borderRadius: 6,
                                border: 'none',
                                background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                color: '#fff',
                                fontSize: '10px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                boxShadow: '0 1px 4px rgba(22,163,74,0.2)',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                              Accept & Sign
                            </button>
                          )}

                          {/* Direct View Button */}
                          <button
                            onClick={() => openDetails(asset)}
                            title="View Asset Details"
                            style={{
                              width: 27,
                              height: 27,
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                              background: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#4f46e5',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#eef2ff'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>

                          {/* Direct Edit Button */}
                          {canUpdate && (
                            <button
                              onClick={() => openEdit(asset)}
                              title="Edit Asset"
                              style={{
                                width: 27,
                                height: 27,
                                borderRadius: 6,
                                border: '1px solid #e2e8f0',
                                background: '#fff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#2563eb',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}

                          {/* Three dots / More actions */}
                          <button
                            onClick={(e) => toggleMenu(e, asset._id)}
                            title="More actions"
                            style={{
                              width: 27,
                              height: 27,
                              borderRadius: 6,
                              border: '1px solid #e2e8f0',
                              background: '#fff',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#475569',
                              boxShadow: actionMenu?.id === asset._id ? '0 6px 14px rgba(15,23,42,0.08)' : 'none',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filteredAssets.length > 0 && totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            padding: '12px 16px',
            borderTop: '1px solid #f1f5f9',
            background: '#fff',
            flexShrink: 0
          }}>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: safePage === 1 ? '#f0fdf4' : '#a3e635',
                border: 'none',
                cursor: safePage === 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                outline: 'none',
                opacity: safePage === 1 ? 0.4 : 1
              }}
              onMouseEnter={(e) => {
                if (safePage !== 1) {
                  e.currentTarget.style.background = '#84cc16';
                }
              }}
              onMouseLeave={(e) => {
                if (safePage !== 1) {
                  e.currentTarget.style.background = '#a3e635';
                }
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#365314" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Page Numbers */}
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (safePage <= 3) {
                pageNum = i + 1;
              } else if (safePage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = safePage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '7px',
                    background: safePage === pageNum ? '#a3e635' : '#f0fdf4',
                    border: safePage === pageNum ? 'none' : '1px solid #d9f99d',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: safePage === pageNum ? '#365314' : '#4d7c0f',
                    fontFamily: "'Inter', -apple-system, sans-serif"
                  }}
                  onMouseEnter={(e) => {
                    if (safePage !== pageNum) {
                      e.currentTarget.style.background = '#bef264';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (safePage !== pageNum) {
                      e.currentTarget.style.background = '#f0fdf4';
                    }
                  }}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Ellipsis if more pages */}
            {totalPages > 5 && safePage < totalPages - 2 && (
              <span style={{
                padding: '0 4px',
                color: '#84cc16',
                fontSize: '12px',
                fontWeight: '700',
                fontFamily: "'Inter', -apple-system, sans-serif"
              }}>...</span>
            )}

            {/* Last page if needed */}
            {totalPages > 5 && safePage < totalPages - 2 && (
              <button
                onClick={() => setCurrentPage(totalPages)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '7px',
                  background: '#f0fdf4',
                  border: '1px solid #d9f99d',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  fontSize: '11px',
                  fontWeight: '700',
                  color: '#4d7c0f',
                  fontFamily: "'Inter', -apple-system, sans-serif"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#bef264';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f0fdf4';
                }}
              >
                {totalPages}
              </button>
            )}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '7px',
                background: safePage === totalPages ? '#f0fdf4' : '#a3e635',
                border: 'none',
                cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                outline: 'none',
                opacity: safePage === totalPages ? 0.4 : 1
              }}
              onMouseEnter={(e) => {
                if (safePage !== totalPages) {
                  e.currentTarget.style.background = '#84cc16';
                }
              }}
              onMouseLeave={(e) => {
                if (safePage !== totalPages) {
                  e.currentTarget.style.background = '#a3e635';
                }
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#365314" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ── Kebab dropdown menu ── */}
      {actionMenu && (() => {
        const activeAsset = assets.find((a) => a._id === actionMenu.id);
        if (!activeAsset) return null;
        return (
          <div
            data-asset-menu
            style={{ position: 'fixed', top: actionMenu.top, left: actionMenu.left, width: 165, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 18px 40px rgba(15,23,42,0.14)', padding: 6, zIndex: 1200, fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", fontWeight: 400 }}
          >
            {activeAsset.status === 'assigned' && !activeAsset.signature && isReceiver(activeAsset) && (
              <button
                onClick={() => openAccept(activeAsset)}
                style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#16a34a', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
                Accept & Sign
              </button>
            )}

            <button
              onClick={() => openHistory(activeAsset)}
              style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 500, color: '#0284c7', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Asset History
            </button>
            <button
              onClick={() => openDocModal(activeAsset)}
              style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 500, color: '#0f766e', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdfa'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              {activeAsset.status === 'assigned' ? 'Handover Form' : 'Preview Form'}
            </button>
            {canUpdate && (
              <button
                onClick={() => openAssign(activeAsset)}
                style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 500, color: '#334155', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Assign
              </button>
            )}
            {canUpdate && activeAsset.status === 'assigned' && (
              <button
                onClick={() => handleUnassign(activeAsset)}
                style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 500, color: '#334155', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                </svg>
                Unassign
              </button>
            )}
            {canUpdate && activeAsset.status !== 'maintenance' && (
              <button
                onClick={() => handleMaintenance(activeAsset)}
                style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 500, color: '#d97706', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#fffbeb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M4.93 4.93a10 10 0 0 0 0 14.14" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M2 12h2" /><path d="M20 12h2" />
                </svg>
                Under Maintenance
              </button>
            )}
            {canDelete && (
              <>
                <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                <button
                  onClick={() => handleDelete(activeAsset)}
                  style={{ width: '100%', border: 'none', background: 'transparent', borderRadius: 8, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: '#ef4444', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  Delete Asset
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* ── Status Dropdown Menu ── */}
      {statusDropdown && (() => {
        const activeAsset = assets.find((a) => a._id === statusDropdown.id);
        if (!activeAsset) return null;
        return (
          <div
            data-status-dropdown
            style={{ position: 'fixed', top: statusDropdown.top, left: statusDropdown.left, width: 140, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 18px 40px rgba(15,23,42,0.12)', padding: 6, zIndex: 1200, fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", fontWeight: 400 }}
          >
            <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', padding: '6px 8px', fontStyle: 'italic', borderBottom: '1px solid #f1f5f9', marginBottom: 4 }}>Select Status</div>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => handleStatusSelect(activeAsset, key)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: activeAsset.status === key ? config.bg : 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: activeAsset.status === key ? 700 : 600, color: activeAsset.status === key ? config.color : '#475569', transition: 'background 0.2s', textAlign: 'left' }}
                onMouseEnter={(e) => { if (activeAsset.status !== key) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { if (activeAsset.status !== key) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: config.dot }} />
                {config.label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── Add Asset Modal ── */}
      {showModal && (
        <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(15,23,42,0.25)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 26px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>Add Asset</div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>Register a new company asset with type-specific details.</div>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 18, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '24px 26px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Top Row: Primary Identity (Brand Name / Telecom Provider & Asset Type) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                  {formData.assetType === 'SIM' ? (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Telecom Provider <span style={{ color: '#ef4444' }}>*</span></span>
                      <input
                        type="text"
                        required
                        placeholder="Enter telecom provider"
                        value={formData.telecomProvider}
                        onChange={(e) => setFormData({ ...formData, telecomProvider: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Brand Name <span style={{ color: '#ef4444' }}>*</span></span>
                      <input
                        type="text"
                        required
                        placeholder="Enter brand name"
                        value={formData.brandName || formData.assetName}
                        onChange={(e) => setFormData({ ...formData, brandName: e.target.value, assetName: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                  )}

                  {/* Asset Type */}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                    <span>Asset Type <span style={{ color: '#ef4444' }}>*</span></span>
                    {addingType ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          autoFocus
                          type="text"
                          value={newTypeName}
                          onChange={(e) => setNewTypeName(e.target.value)}
                          placeholder="Enter type name"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (newTypeName.trim()) {
                                setCustomTypes((p) => [...p, newTypeName.trim()]);
                                setFormData({ ...formData, assetType: newTypeName.trim() });
                                setNewTypeName('');
                                setAddingType(false);
                              }
                            }
                          }}
                          style={{ flex: 1, height: 40, borderRadius: 10, border: '1px solid #16a34a', padding: '0 12px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newTypeName.trim()) {
                              setCustomTypes((p) => [...p, newTypeName.trim()]);
                              setFormData({ ...formData, assetType: newTypeName.trim() });
                              setNewTypeName('');
                              setAddingType(false);
                            }
                          }}
                          style={{ height: 40, padding: '0 14px', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAddingType(false); setNewTypeName(''); }}
                          style={{ height: 40, padding: '0 14px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <select
                        value={formData.assetType}
                        onChange={(e) => {
                          if (e.target.value === '__add_new__') {
                            setAddingType(true);
                          } else {
                            setFormData({ ...formData, assetType: e.target.value });
                          }
                        }}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        {[...ASSET_TYPES, ...customTypes].map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                        <option value="__add_new__">＋ Add new type...</option>
                      </select>
                    )}
                  </label>
                </div>

                {/* Dynamic Fields per selected asset type */}
                {/* Case 1: Laptop or Desktop */}
                {(formData.assetType === 'Laptop' || formData.assetType === 'Desktop') && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Device ID</span>
                      <input
                        type="text"
                        placeholder="Enter device ID"
                        value={formData.deviceId}
                        onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Product ID</span>
                      <input
                        type="text"
                        placeholder="Enter product ID"
                        value={formData.productId}
                        onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                  </div>
                )}

                {/* Case 2: Mobile or Tablet */}
                {(formData.assetType === 'Mobile' || formData.assetType === 'Tablet') && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>Model</span>
                        <input
                          type="text"
                          placeholder="Enter model"
                          value={formData.model}
                          onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>Colour</span>
                        <input
                          type="text"
                          placeholder="Enter colour"
                          value={formData.colour}
                          onChange={(e) => setFormData({ ...formData, colour: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>IMEI 1</span>
                        <input
                          type="text"
                          placeholder="Enter IMEI 1"
                          value={formData.imei1}
                          onChange={(e) => setFormData({ ...formData, imei1: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>IMEI 2 <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>(Optional)</span></span>
                        <input
                          type="text"
                          placeholder="Enter IMEI 2 (optional)"
                          value={formData.imei2}
                          onChange={(e) => setFormData({ ...formData, imei2: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                    </div>
                  </>
                )}

                {/* Case 3: SIM */}
                {formData.assetType === 'SIM' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>SIM No. / Mobile No. <span style={{ color: '#ef4444' }}>*</span></span>
                      <input
                        type="text"
                        required
                        placeholder="Enter SIM / mobile number"
                        value={formData.simNumber}
                        onChange={(e) => setFormData({ ...formData, simNumber: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Condition / Status</span>
                      <select
                        value={formData.condition || 'Active'}
                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        <option value="Active">Active</option>
                        <option value="Brand New">Brand New</option>
                        <option value="Good">Good</option>
                        <option value="Deactivated">Deactivated</option>
                      </select>
                    </label>
                  </div>
                )}

                {/* Case 4 & 5: Condition for non-SIM and extra device fields for other/custom */}
                {formData.assetType !== 'SIM' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Condition</span>
                      <select
                        value={formData.condition || 'Good'}
                        onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        {CONDITION_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>

                    {!['Laptop', 'Desktop', 'Mobile', 'Tablet', 'SIM', 'Mouse', 'Keyboard', 'Laptop charger', 'Monitor'].includes(formData.assetType) && (
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>Device ID / Serial Number</span>
                        <input
                          type="text"
                          placeholder="Enter device ID or serial number"
                          value={formData.deviceId}
                          onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* Description */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    placeholder="Enter description or notes (optional)"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 12.5, color: '#0f172a', resize: 'vertical', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                  />
                </label>
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 26px', borderTop: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  className="emp-btn-ghost"
                  disabled={saving}
                  onClick={() => setShowModal(false)}
                  style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    minWidth: 125,
                    padding: '9px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: saving ? '#64748b' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#fff',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    opacity: saving ? 0.85 : 1,
                    pointerEvents: saving ? 'none' : 'auto',
                    boxShadow: saving ? 'none' : '0 2px 8px rgba(22,163,74,0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {saving ? (
                    <>
                      <svg
                        style={{ animation: 'assets-spin 0.8s linear infinite', width: 15, height: 15, flexShrink: 0 }}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="3" strokeOpacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <span>Adding Asset...</span>
                    </>
                  ) : (
                    <span>Add Asset</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Asset Modal ── */}
      {showEditModal && editAsset && (
        <div onClick={() => setShowEditModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(15,23,42,0.25)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 26px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafbfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>Edit Asset</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', background: '#e2e8f0', padding: '2px 8px', borderRadius: 6 }}>
                      {editAsset.assetId}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>Update asset specifications and parameters.</div>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 18, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '24px 26px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Top Row: Primary Identity */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                  {editForm.assetType === 'SIM' ? (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Telecom Provider <span style={{ color: '#ef4444' }}>*</span></span>
                      <input
                        type="text"
                        required
                        placeholder="Enter telecom provider"
                        value={editForm.telecomProvider}
                        onChange={(e) => setEditForm({ ...editForm, telecomProvider: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                  ) : (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Brand Name <span style={{ color: '#ef4444' }}>*</span></span>
                      <input
                        type="text"
                        required
                        placeholder="Enter brand name"
                        value={editForm.brandName || editForm.assetName}
                        onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value, assetName: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                  )}

                  {/* Asset Type (Read-only in Edit Mode) */}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                    <span>Asset Type</span>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={editForm.assetType || ''}
                      title="Asset Type cannot be modified after registration"
                      style={{
                        height: 40,
                        borderRadius: 10,
                        border: '1px solid #e2e8f0',
                        padding: '0 14px',
                        fontSize: 12.5,
                        color: '#475569',
                        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                        fontWeight: 600,
                        background: '#f8fafc',
                        cursor: 'not-allowed',
                        outline: 'none'
                      }}
                    />
                  </label>
                </div>

                {/* Dynamic Fields per selected asset type */}
                {/* Case 1: Laptop or Desktop */}
                {(editForm.assetType === 'Laptop' || editForm.assetType === 'Desktop') && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Device ID</span>
                      <input
                        type="text"
                        placeholder="Enter device ID"
                        value={editForm.deviceId}
                        onChange={(e) => setEditForm({ ...editForm, deviceId: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Product ID</span>
                      <input
                        type="text"
                        placeholder="Enter product ID"
                        value={editForm.productId}
                        onChange={(e) => setEditForm({ ...editForm, productId: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                  </div>
                )}

                {/* Case 2: Mobile or Tablet */}
                {(editForm.assetType === 'Mobile' || editForm.assetType === 'Tablet') && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>Model</span>
                        <input
                          type="text"
                          placeholder="Enter model"
                          value={editForm.model}
                          onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>Colour</span>
                        <input
                          type="text"
                          placeholder="Enter colour"
                          value={editForm.colour}
                          onChange={(e) => setEditForm({ ...editForm, colour: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>IMEI 1</span>
                        <input
                          type="text"
                          placeholder="Enter IMEI 1"
                          value={editForm.imei1}
                          onChange={(e) => setEditForm({ ...editForm, imei1: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>IMEI 2 <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>(Optional)</span></span>
                        <input
                          type="text"
                          placeholder="Enter IMEI 2 (optional)"
                          value={editForm.imei2}
                          onChange={(e) => setEditForm({ ...editForm, imei2: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                    </div>
                  </>
                )}

                {/* Case 3: SIM */}
                {editForm.assetType === 'SIM' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>SIM No. / Mobile No. <span style={{ color: '#ef4444' }}>*</span></span>
                      <input
                        type="text"
                        required
                        placeholder="Enter SIM / mobile number"
                        value={editForm.simNumber}
                        onChange={(e) => setEditForm({ ...editForm, simNumber: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Condition / Status</span>
                      <select
                        value={editForm.condition || 'Active'}
                        onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        <option value="Active">Active</option>
                        <option value="Brand New">Brand New</option>
                        <option value="Good">Good</option>
                        <option value="Deactivated">Deactivated</option>
                      </select>
                    </label>
                  </div>
                )}

                {/* Case 4 & 5: Condition for non-SIM and extra device fields for other/custom */}
                {editForm.assetType !== 'SIM' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      <span>Condition</span>
                      <select
                        value={editForm.condition || 'Good'}
                        onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                        style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 12px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                      >
                        {CONDITION_OPTIONS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </label>

                    {!['Laptop', 'Desktop', 'Mobile', 'Tablet', 'SIM', 'Mouse', 'Keyboard', 'Laptop charger', 'Monitor'].includes(editForm.assetType) && (
                      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        <span>Device ID / Serial Number</span>
                        <input
                          type="text"
                          placeholder="Enter device ID or serial number"
                          value={editForm.deviceId}
                          onChange={(e) => setEditForm({ ...editForm, deviceId: e.target.value })}
                          style={{ height: 40, borderRadius: 10, border: '1px solid #cbd5e1', padding: '0 14px', fontSize: 12.5, color: '#0f172a', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                        />
                      </label>
                    )}
                  </div>
                )}

                {/* Description */}
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                  <span>Description</span>
                  <textarea
                    rows={3}
                    placeholder="Enter description or notes (optional)"
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '10px 14px', fontSize: 12.5, color: '#0f172a', resize: 'vertical', fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif", outline: 'none', background: '#fff' }}
                  />
                </label>
              </div>

              {/* Footer */}
              <div style={{ padding: '16px 26px', borderTop: '1px solid #f1f5f9', background: '#fafbfc', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button
                  type="button"
                  className="emp-btn-ghost"
                  disabled={savingEdit}
                  onClick={() => setShowEditModal(false)}
                  style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12.5, fontWeight: 600, cursor: savingEdit ? 'not-allowed' : 'pointer', opacity: savingEdit ? 0.6 : 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    minWidth: 140,
                    padding: '9px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: savingEdit ? '#64748b' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    color: '#fff',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: savingEdit ? 'not-allowed' : 'pointer',
                    opacity: savingEdit ? 0.85 : 1,
                    pointerEvents: savingEdit ? 'none' : 'auto',
                    boxShadow: savingEdit ? 'none' : '0 2px 8px rgba(22,163,74,0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {savingEdit ? (
                    <>
                      <svg
                        style={{ animation: 'assets-spin 0.8s linear infinite', width: 15, height: 15, flexShrink: 0 }}
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="3" strokeOpacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Assign Modal with Live Acknowledgment Form Preview ── */}
      {/* ── Assign Modal with Multi-Asset Selection ── */}
      {showAssignModal && assignTarget && (
        <div onClick={() => setShowAssignModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 720, background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 25px 50px rgba(15,23,42,0.22)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Assign Asset</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{assignTarget.assetName} · {assignTarget.assetId}</div>
              </div>
              <button onClick={() => setShowAssignModal(false)} style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 20, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Select Employee */}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: '#334155' }}>
                    <span>Assign To Employee <span style={{ color: '#ef4444' }}>*</span></span>
                    <div style={{ position: 'relative' }} data-emp-select>
                      <div
                        onClick={() => setShowEmpDd(!showEmpDd)}
                        style={{
                          height: 42, borderRadius: 10, border: '1px solid #e2e8f0',
                          padding: '0 14px', fontSize: 13, color: '#0f172a',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          background: '#fff', cursor: 'pointer', transition: 'all 0.2s',
                          borderColor: showEmpDd ? '#3b82f6' : '#e2e8f0',
                          boxShadow: showEmpDd ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none'
                        }}
                      >
                        <span style={{ color: selectedEmployee ? '#0f172a' : '#94a3b8', fontWeight: selectedEmployee ? 600 : 400 }}>
                          {selectedEmployee
                            ? (() => {
                              const emp = employees.find(e => e._id === selectedEmployee);
                              return emp ? `${emp.firstName} ${emp.lastName} (${emp.employeeId || emp.username})` : 'Select Employee';
                            })()
                            : '— Select Employee —'}
                        </span>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEmpDd ? 'rotate(180deg)' : 'none' }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>

                      {showEmpDd && (
                        <div onClick={(e) => e.stopPropagation()} style={{
                          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                          background: '#fff', borderRadius: 12, border: '1px solid #cbd5e1',
                          boxShadow: '0 12px 30px rgba(15,23,42,0.16)', zIndex: 1100,
                          overflow: 'hidden', animation: 'empDdIn 0.2s ease'
                        }}>
                          <div style={{ padding: '8px', borderBottom: '1px solid #f1f5f9' }}>
                            <input
                              autoFocus
                              type="text"
                              placeholder="Search employees..."
                              value={empSearch}
                              onChange={(e) => setEmpSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                width: '100%', height: 34, borderRadius: 8, border: '1px solid #cbd5e1',
                                padding: '0 10px', fontSize: 12, background: '#f8fafc', outline: 'none'
                              }}
                            />
                          </div>
                          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                            <div
                              onClick={() => { setSelectedEmployee(""); setShowEmpDd(false); }}
                              style={{
                                padding: '10px 12px', fontSize: 12, cursor: 'pointer',
                                color: '#64748b', background: selectedEmployee === "" ? '#f1f5f9' : 'transparent',
                                fontWeight: selectedEmployee === "" ? 700 : 400
                              }}
                            >— Select Employee —</div>
                            {(() => {
                              const filtered = employees.filter(e => {
                                const q = empSearch.toLowerCase();
                                const matchesSearch = `${e.firstName} ${e.lastName} ${e.employeeId || ''}`.toLowerCase().includes(q);
                                return matchesSearch && e.isActive !== false;
                              });
                              if (filtered.length === 0) {
                                return (
                                  <div style={{ padding: '14px 12px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
                                    No employees found
                                  </div>
                                );
                              }
                              return filtered.map((emp) => (
                                <div
                                  key={emp._id}
                                  onClick={() => { setSelectedEmployee(emp._id); setShowEmpDd(false); }}
                                  onMouseEnter={(e) => { if (selectedEmployee !== emp._id) e.currentTarget.style.background = '#f8fafc'; }}
                                  onMouseLeave={(e) => { if (selectedEmployee !== emp._id) e.currentTarget.style.background = 'transparent'; }}
                                  style={{
                                    padding: '10px 12px', fontSize: 12, cursor: 'pointer',
                                    display: 'flex', flexDirection: 'column', gap: 2,
                                    color: selectedEmployee === emp._id ? '#1e293b' : '#334155',
                                    background: selectedEmployee === emp._id ? '#eff6ff' : 'transparent',
                                    borderLeft: selectedEmployee === emp._id ? '3px solid #3b82f6' : '3px solid transparent',
                                    transition: 'background 0.15s ease'
                                  }}
                                >
                                  <div style={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</div>
                                  <div style={{ fontSize: 10, color: '#94a3b8' }}>{emp.employeeId || emp.username}</div>
                                </div>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Selected Assets to Assign Section */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                          Assets to Assign ({1 + selectedAdditionalAssets.length})
                        </span>
                        {selectedAdditionalAssets.length > 0 && (
                          <span style={{ fontSize: 10.5, fontWeight: 700, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 7px', borderRadius: 999 }}>
                            +{selectedAdditionalAssets.length} Additional
                          </span>
                        )}
                      </div>

                      {/* Toggle Assign More Button */}
                      <button
                        type="button"
                        onClick={() => setShowAssignMoreDropdown(!showAssignMoreDropdown)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: showAssignMoreDropdown ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: showAssignMoreDropdown ? '#eff6ff' : '#ffffff',
                          color: showAssignMoreDropdown ? '#2563eb' : '#334155',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        {showAssignMoreDropdown ? 'Hide Available Assets' : 'Assign More Assets'}
                      </button>
                    </div>

                    {/* Primary Asset Card */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderRadius: 10,
                      border: '1px solid #e2e8f0',
                      gap: 12
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eff6ff', border: '1px solid #dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d={TYPE_ICONS[assignTarget.assetType] || TYPE_ICONS.Other} />
                          </svg>
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {assignTarget.brandName || assignTarget.assetName}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                            {assignTarget.assetId} · <span style={{ fontWeight: 600 }}>{assignTarget.assetType}</span> {assignTarget.deviceId ? `· ${assignTarget.deviceId}` : ''}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: '#166534', background: '#dcfce7', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
                        Primary Asset
                      </span>
                    </div>

                    {/* Additional Selected Assets List */}
                    {selectedAdditionalAssets.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {selectedAdditionalAssets.map((assetId) => {
                          const additional = assets.find((a) => a._id === assetId);
                          if (!additional) return null;
                          return (
                            <div
                              key={assetId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: '#ffffff',
                                borderRadius: 10,
                                border: '1px solid #bfdbfe',
                                gap: 10
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', flexShrink: 0 }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d={TYPE_ICONS[additional.assetType] || TYPE_ICONS.Other} />
                                  </svg>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {additional.brandName || additional.assetName}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: '#64748b' }}>
                                    {additional.assetId} · <span style={{ fontWeight: 600 }}>{additional.assetType}</span>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedAdditionalAssets((prev) => prev.filter((id) => id !== assetId))}
                                title="Remove from assignment"
                                style={{
                                  border: 'none',
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  lineHeight: 1,
                                  flexShrink: 0,
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#fecaca'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Available Assets Selector Drawer / Card */}
                    {showAssignMoreDropdown && (() => {
                      const availableList = assets.filter(
                        (a) => a._id !== assignTarget._id && a.status === 'available'
                      );
                      const filteredAvailable = availableList.filter((a) => {
                        const q = assignMoreSearch.toLowerCase();
                        return (
                          (a.brandName || '').toLowerCase().includes(q) ||
                          (a.assetName || '').toLowerCase().includes(q) ||
                          (a.assetId || '').toLowerCase().includes(q) ||
                          (a.assetType || '').toLowerCase().includes(q) ||
                          (a.deviceId || '').toLowerCase().includes(q)
                        );
                      });

                      return (
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: 12,
                          padding: 12,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                          marginTop: 4
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              Available Assets ({availableList.length} in inventory)
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>
                              {selectedAdditionalAssets.length} selected
                            </span>
                          </div>

                          <input
                            type="text"
                            placeholder="Search available assets by name, ID, type..."
                            value={assignMoreSearch}
                            onChange={(e) => setAssignMoreSearch(e.target.value)}
                            style={{
                              width: '100%',
                              height: 36,
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              padding: '0 12px',
                              fontSize: 12,
                              color: '#0f172a',
                              background: '#ffffff',
                              outline: 'none'
                            }}
                          />

                          <div style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }}>
                            {filteredAvailable.length === 0 ? (
                              <div style={{ padding: '16px 10px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
                                {availableList.length === 0 ? 'No other available assets in inventory.' : 'No matching available assets found.'}
                              </div>
                            ) : (
                              filteredAvailable.map((asset) => {
                                const isChecked = selectedAdditionalAssets.includes(asset._id);
                                return (
                                  <div
                                    key={asset._id}
                                    onClick={() => {
                                      if (isChecked) {
                                        setSelectedAdditionalAssets((prev) => prev.filter((id) => id !== asset._id));
                                      } else {
                                        setSelectedAdditionalAssets((prev) => [...prev, asset._id]);
                                      }
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '8px 12px',
                                      borderRadius: 8,
                                      border: isChecked ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                      background: isChecked ? '#eff6ff' : '#ffffff',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}}
                                        style={{ width: 15, height: 15, accentColor: '#2563eb', cursor: 'pointer', flexShrink: 0 }}
                                      />
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {asset.brandName || asset.assetName}
                                        </div>
                                        <div style={{ fontSize: 10.5, color: '#64748b' }}>
                                          {asset.assetId} · <span style={{ fontWeight: 600 }}>{asset.assetType}</span> {asset.deviceId ? `· ${asset.deviceId}` : ''}
                                        </div>
                                      </div>
                                    </div>
                                    <span style={{ fontSize: 10.5, fontWeight: 600, color: isChecked ? '#2563eb' : '#64748b', background: isChecked ? '#dbeafe' : '#f1f5f9', padding: '2px 7px', borderRadius: 6, flexShrink: 0 }}>
                                      {isChecked ? '✓ Selected' : '+ Add'}
                                    </span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </div>

                {/* Pinned Modal Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: '#fafafa', flexShrink: 0, gap: 10 }}>
                  <button type="button" className="emp-btn-ghost" disabled={savingAssign} onClick={() => setShowAssignModal(false)}><span>Cancel</span></button>
                  <button
                    type="submit"
                    disabled={savingAssign || !selectedEmployee}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      minWidth: 140,
                      padding: '9px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: savingAssign ? '#64748b' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: (savingAssign || !selectedEmployee) ? 'not-allowed' : 'pointer',
                      opacity: (savingAssign || !selectedEmployee) ? 0.65 : 1,
                      pointerEvents: savingAssign ? 'none' : 'auto',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {savingAssign ? (
                      <>
                        <svg
                          style={{ animation: 'assets-spin 0.8s linear infinite', width: 14, height: 14, flexShrink: 0 }}
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle cx="12" cy="12" r="10" stroke="#ffffff" strokeWidth="3" strokeOpacity="0.3" />
                          <path d="M12 2a10 10 0 0 1 10 10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                        <span>Assigning...</span>
                      </>
                    ) : (
                      <span>
                        {selectedAdditionalAssets.length > 0
                          ? `Assign ${1 + selectedAdditionalAssets.length} Assets`
                          : 'Assign Asset'}
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      {/* ── Accept & Sign Modal (Receiver) ── */}
      {showAcceptModal && acceptTarget && (() => {
        const receiverEmp = acceptTarget.assignedTo || user;
        const assigneeName = `${receiverEmp.firstName || ''} ${receiverEmp.lastName || ''}`.trim() || receiverEmp.username || 'Employee';
        const assigneeId = receiverEmp.employeeId ? `EMP ID: ${receiverEmp.employeeId}` : '';
        const assigneeRole = receiverEmp.designation || receiverEmp.department || (typeof receiverEmp.role === 'object' ? receiverEmp.role?.name : receiverEmp.role) || 'Employee';

        return (
          <div onClick={() => setShowAcceptModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1000 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 640, background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 25px 50px rgba(15,23,42,0.22)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
              {/* Modal Header */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexShrink: 0 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Accept Asset & Upload Signature</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                    {acceptTarget.assetName} · {acceptTarget.assetId}
                  </div>
                </div>
                <button onClick={() => setShowAcceptModal(false)} style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 20, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleAcceptSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Asset Overview Card */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, background: '#f8fafc', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Asset</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{acceptTarget.assetName}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Device ID</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginTop: 2 }}>{acceptTarget.deviceId || acceptTarget.serialNumber || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Assigned By</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginTop: 2 }}>
                        {acceptTarget.assignedBy ? `${acceptTarget.assignedBy.firstName} ${acceptTarget.assignedBy.lastName}` : 'Administrator'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Assigned Date</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginTop: 2 }}>
                        {acceptTarget.assignedDate ? new Date(acceptTarget.assignedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}
                      </div>
                    </div>
                  </div>



                  {/* Signature Upload Section */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        Upload Your Signature <span style={{ color: '#ef4444' }}>*</span>
                      </span>
                      {acceptSignature && (
                        <span style={{ fontSize: 10.5, color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Signature Ready
                        </span>
                      )}
                    </div>

                    <input
                      type="file"
                      id="accept-signature-file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleAcceptSignatureUpload}
                      style={{ display: 'none' }}
                    />

                    {acceptSignature ? (
                      <div style={{
                        padding: '10px 16px',
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            onClick={() => setPreviewImage({ url: acceptSignature, title: 'Receiver Signature Preview', subtitle: `${assigneeName} ${assigneeId ? `(${assigneeId})` : ''}` })}
                            style={{
                              background: '#fff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 8,
                              padding: '4px 8px',
                              height: 46,
                              width: 100,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title="Click to view full signature"
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.transform = 'scale(1.04)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'scale(1)'; }}
                          >
                            <img
                              src={acceptSignature}
                              alt="Signature Preview"
                              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                              {acceptSignatureFileName || 'Receiver Signature'}
                            </div>
                            <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 600, marginTop: 2 }}>
                              ✓ Signature Ready (Click image to view)
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <label
                            htmlFor="accept-signature-file"
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              background: '#fff',
                              border: '1px solid #e2e8f0',
                              color: '#2563eb',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Change
                          </label>
                          <button
                            type="button"
                            onClick={() => { setAcceptSignature(''); setAcceptSignatureFileName(''); }}
                            style={{
                              padding: '6px 12px',
                              borderRadius: 8,
                              background: '#fff',
                              border: '1px solid #fee2e2',
                              color: '#dc2626',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="accept-signature-file"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '20px 14px',
                          borderRadius: 12,
                          border: '2px dashed #86efac',
                          background: '#f0fdf4',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'center'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#16a34a'; e.currentTarget.style.background = '#dcfce7'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#86efac'; e.currentTarget.style.background = '#f0fdf4'; }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', marginBottom: 6 }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#15803d' }}>
                          Upload Receiver Signature
                        </span>
                        <span style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          Click to browse image (PNG, JPG, JPEG, WebP)
                        </span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Pinned Modal Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fafafa', flexShrink: 0 }}>
                  <button type="button" className="emp-btn-ghost" onClick={() => setShowAcceptModal(false)}><span>Cancel</span></button>
                  <button type="submit" disabled={savingAccept || !acceptSignature} style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: (savingAccept || !acceptSignature) ? 'not-allowed' : 'pointer', opacity: (savingAccept || !acceptSignature) ? 0.6 : 1, boxShadow: '0 2px 8px rgba(22,163,74,0.3)' }}>
                    {savingAccept ? 'Accepting…' : 'Accept & Sign Asset'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── Maintenance Details Modal ── */}
      {showMaintenanceModal && (
        <div onClick={() => setShowMaintenanceModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 540, background: '#fff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 25px 50px rgba(15,23,42,0.22)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a' }}>Maintenance Details</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Record details for asset {maintenanceTarget?.assetName}</div>
              </div>
              <button onClick={() => setShowMaintenanceModal(false)} style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 20, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <form onSubmit={handleMaintenanceSubmit}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Issue Details <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea required value={maintenanceForm.issue} onChange={e => setMaintenanceForm({ ...maintenanceForm, issue: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, minHeight: 80, outline: 'none', fontFamily: 'inherit' }} placeholder="Describe the problem..." />
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Shop Name</label>
                    <input type="text" required value={maintenanceForm.shopName} onChange={e => setMaintenanceForm({ ...maintenanceForm, shopName: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} placeholder="Enter Service Center" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Sent On Date</label>
                    <input type="date" required value={maintenanceForm.sentOnDate} onChange={e => setMaintenanceForm({ ...maintenanceForm, sentOnDate: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Contact Person</label>
                    <input type="text" value={maintenanceForm.contactPerson} onChange={e => setMaintenanceForm({ ...maintenanceForm, contactPerson: e.target.value })} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} placeholder="Enter Name" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Phone Number</label>
                    <input type="tel" value={maintenanceForm.phoneNumber} onChange={e => { const val = e.target.value.replace(/\D/g, ''); setMaintenanceForm({ ...maintenanceForm, phoneNumber: val }); }} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} placeholder="Enter Phone" />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, textTransform: 'uppercase' }}>Shop Address</label>
                  <textarea value={maintenanceForm.address} onChange={e => setMaintenanceForm({ ...maintenanceForm, address: e.target.value })} style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, minHeight: 60, outline: 'none', fontFamily: 'inherit' }} placeholder="Full address..." />
                </div>
              </div>
              <div style={{ padding: '16px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fafafa' }}>
                <button type="button" onClick={() => setShowMaintenanceModal(false)} style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={savingMaintenance} style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingMaintenance ? 'not-allowed' : 'pointer', opacity: savingMaintenance ? 0.6 : 1 }}>
                  {savingMaintenance ? 'Saving…' : 'Send to Maintenance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ── High-Resolution Image / Signature Preview Modal ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
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
              maxWidth: 620,
              width: '100%',
              overflow: 'hidden',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{previewImage.title || 'Signature Preview'}</div>
                {previewImage.subtitle && (
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{previewImage.subtitle}</div>
                )}
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  fontSize: 18,
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </div>

            {/* Image Canvas */}
            <div style={{
              padding: '30px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'radial-gradient(circle, #ffffff 0%, #f8fafc 100%)',
              minHeight: 220,
              maxHeight: '60vh',
              overflow: 'auto'
            }}>
              <div style={{
                background: '#ffffff',
                padding: '16px 24px',
                borderRadius: 14,
                border: '1px solid #e2e8f0',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                maxWidth: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <img
                  src={previewImage.url}
                  alt={previewImage.title || 'Signature Preview'}
                  style={{
                    maxHeight: '44vh',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a
                href={previewImage.url}
                download={`${(previewImage.title || 'signature').toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#2563eb',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download Signature
              </a>
              <button
                onClick={() => setPreviewImage(null)}
                style={{
                  padding: '7px 18px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12,
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
      {/* ── Asset History & Tracking Lifecycle Modal ── */}
      {showViewModal && viewAsset && (
        <div onClick={() => setShowViewModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 880, height: '82vh', maxHeight: '88vh', minHeight: 520, background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 25px 60px rgba(15,23,42,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
            {/* Modal Header */}
            <div style={{ padding: '18px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 8px rgba(2,132,199,0.25)' }}>
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: 16.5, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 9, letterSpacing: '-0.01em' }}>
                    <span>Asset Lifecycle & Tracking History</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', letterSpacing: '0.04em' }}>
                      {getDisplayAssetCode(viewAsset, 0)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2, fontWeight: 500 }}>
                    {viewAsset.brandName || viewAsset.assetName} · Type: {viewAsset.assetType} · Condition: {viewAsset.condition || 'Good'}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 18, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, transition: 'background 0.15s ease' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
              >
                ×
              </button>
            </div>

            {/* Quick Specs Ribbon */}
            <div style={{ padding: '14px 28px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, fontSize: 11.5, flexShrink: 0 }}>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600, display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Current Status</span>
                <span style={{ fontWeight: 700, color: (STATUS_CONFIG[viewAsset.status] || STATUS_CONFIG.available).color, fontSize: 12.5 }}>
                  {(STATUS_CONFIG[viewAsset.status] || STATUS_CONFIG.available).label}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600, display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Current Possession</span>
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 12.5 }}>
                  {viewAsset.assignedTo ? `${viewAsset.assignedTo.firstName} ${viewAsset.assignedTo.lastName}` : 'In Company Pool'}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600, display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Identifier / Device ID</span>
                <span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                  {viewAsset.deviceId || viewAsset.simNumber || viewAsset.serialNumber || viewAsset.imei1 || '—'}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontWeight: 600, display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Model / Version</span>
                <span style={{ fontWeight: 600, color: '#334155', fontSize: 12.5 }}>
                  {viewAsset.model || viewAsset.productId || (viewAsset.assetType === 'SIM' ? viewAsset.telecomProvider : '—')}
                </span>
              </div>
            </div>

            {/* Timeline Linking Body (Scrollable Track) */}
            <div style={{ padding: '30px 36px', overflowY: 'auto', flex: 1, minHeight: 0, background: '#ffffff' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <div style={{ display: 'inline-block', width: 30, height: 30, border: '3px solid #0284c7', borderTopColor: 'transparent', borderRadius: '50%', animation: 'assets-spin 0.8s linear infinite' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12, color: '#475569' }}>Loading tracking history...</div>
                </div>
              ) : (() => {
                const timelineEvents = getAssetTimelineEvents(viewAsset, employees, user);
                if (timelineEvents.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 13.5 }}>
                      No tracking history recorded for this asset.
                    </div>
                  );
                }

                return (
                  <div style={{ paddingLeft: 4, paddingRight: 4 }}>
                    {timelineEvents.map((evt, idx) => {
                      const isLast = idx === timelineEvents.length - 1;
                      const ringColor = evt.type === 'green' ? '#10b981' : (evt.type === 'amber' ? '#f59e0b' : '#3b82f6');

                      return (
                        <div key={evt.id || idx} style={{ display: 'flex', position: 'relative', paddingBottom: isLast ? 0 : 32 }}>
                          {/* Left Column: Hollow Ring & Vertical Connecting Line */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 18, position: 'relative', width: 16, flexShrink: 0 }}>
                            {/* Hollow Circular Ring Dot */}
                            <div style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: '#ffffff',
                              border: `2px solid ${ringColor}`,
                              boxSizing: 'border-box',
                              zIndex: 2,
                              marginTop: 3,
                              boxShadow: '0 0 0 2px #ffffff'
                            }} />

                            {/* Continuous Vertical Tracking Line */}
                            {!isLast && (
                              <div style={{
                                position: 'absolute',
                                top: 17,
                                bottom: -6,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                width: 1.5,
                                background: '#e2e8f0',
                                zIndex: 1
                              }} />
                            )}
                          </div>

                          {/* Center Content & Right-aligned Timestamp */}
                          <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
                            <div style={{ flex: 1 }}>
                              {/* Event Title */}
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.35, letterSpacing: '-0.01em' }}>
                                {evt.title}
                              </div>

                              {/* Message line (if note / details provided) */}
                              {evt.message && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 5, fontSize: 12.5 }}>
                                  <span style={{ color: '#94a3b8', fontWeight: 600, flexShrink: 0 }}>Message</span>
                                  <span style={{ color: '#334155', lineHeight: 1.5 }}>{evt.message}</span>
                                </div>
                              )}

                              {/* Subtitle with dot: • By [Name] */}
                              {evt.by && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 12.5, color: '#64748b' }}>
                                  <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />
                                  <span>By {evt.by}</span>
                                </div>
                              )}

                              {/* Signature Preview button if available */}
                              {evt.signature && (
                                <div style={{ marginTop: 8 }}>
                                  <button
                                    onClick={() => setPreviewImage({ url: evt.signature, title: `Signature: ${evt.title}`, subtitle: `Asset: ${viewAsset.brandName || viewAsset.assetName}` })}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '4px 10px',
                                      borderRadius: 7,
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      color: '#2563eb',
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#f0f9ff'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#ffffff'; }}
                                  >
                                    <Eye size={12} />
                                    View Signature
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Right Timestamp */}
                            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap', marginTop: 1 }}>
                              {formatTimelineDate(evt.date)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '14px 28px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Total lifecycle recorded events: <strong style={{ color: '#0f172a' }}>{(viewAsset.assignmentHistory?.length || 0) + 1}</strong>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => openDocModal(viewAsset)}
                  style={{
                    padding: '7px 15px',
                    borderRadius: 9,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f766e',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdfa'; e.currentTarget.style.borderColor = '#99f6e4'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                >
                  <FileText size={14} />
                  Handover Form
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  style={{
                    padding: '7px 18px',
                    borderRadius: 9,
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Complete Asset Details & Specifications Modal ── */}
      {showDetailsModal && detailsAsset && (
        <div
          onClick={() => setShowDetailsModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1150,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 880,
              maxHeight: '90vh',
              background: '#ffffff',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 60px rgba(15,23,42,0.25)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: '20px 28px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fafbfc',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#eff6ff',
                  border: '1px solid #dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#2563eb',
                  flexShrink: 0
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={TYPE_ICONS[detailsAsset.assetType] || TYPE_ICONS.Other} />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                      {detailsAsset.brandName || detailsAsset.assetName || 'Asset Information'}
                    </h3>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#f1f5f9',
                      padding: '2px 8px',
                      borderRadius: 6,
                      border: '1px solid #e2e8f0',
                      letterSpacing: '0.04em'
                    }}>
                      {detailsAsset.assetId}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, fontWeight: 500 }}>
                    Type: <strong style={{ color: '#334155' }}>{detailsAsset.assetType}</strong> · Added on {formatTimelineDate(detailsAsset.createdAt || detailsAsset.assignedDate)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Status Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Status Pill */}
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'capitalize',
                    background: (STATUS_CONFIG[detailsAsset.status] || STATUS_CONFIG.available).bg,
                    color: (STATUS_CONFIG[detailsAsset.status] || STATUS_CONFIG.available).color,
                    border: `1px solid ${(STATUS_CONFIG[detailsAsset.status] || STATUS_CONFIG.available).border}`
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: (STATUS_CONFIG[detailsAsset.status] || STATUS_CONFIG.available).color }} />
                    {(STATUS_CONFIG[detailsAsset.status] || STATUS_CONFIG.available).label}
                  </span>

                  {/* Acknowledgement Pill (if assigned) */}
                  {detailsAsset.status === 'assigned' && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: (detailsAsset.signature || detailsAsset.acknowledgement) ? '#dcfce7' : '#fef3c7',
                      color: (detailsAsset.signature || detailsAsset.acknowledgement) ? '#15803d' : '#b45309',
                      border: `1px solid ${(detailsAsset.signature || detailsAsset.acknowledgement) ? '#bbf7d0' : '#fde68a'}`
                    }}>
                      {(detailsAsset.signature || detailsAsset.acknowledgement) ? '✓ Signed' : '• Pending'}
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setShowDetailsModal(false)}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    fontSize: 18,
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Body (Scrollable Cards) */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 18, background: '#f8fafc' }}>
              {loadingDetails ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
                  <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'assets-spin 0.8s linear infinite' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12, color: '#475569' }}>Loading asset information...</div>
                </div>
              ) : (
                <>
                  {/* Card 1: Asset Information & Specifications */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ width: 26, height: 26, borderRadius: 7, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      </div>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                        Asset Specification & Hardware Details
                      </h4>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px 20px' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Asset Code</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 3 }}>{getDisplayAssetCode(detailsAsset)}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Brand / Name</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{detailsAsset.brandName || detailsAsset.assetName || '—'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Asset Type</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{detailsAsset.assetType}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Condition</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>
                          <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 6, background: '#f1f5f9', color: '#334155', fontWeight: 600, fontSize: 12 }}>
                            {detailsAsset.condition || 'Good'}
                          </span>
                        </div>
                      </div>

                      {detailsAsset.deviceId && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Device ID</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3, fontFamily: 'monospace' }}>{detailsAsset.deviceId}</div>
                        </div>
                      )}

                      {detailsAsset.productId && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Product ID</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3, fontFamily: 'monospace' }}>{detailsAsset.productId}</div>
                        </div>
                      )}

                      {detailsAsset.serialNumber && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Serial Number</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3, fontFamily: 'monospace' }}>{detailsAsset.serialNumber}</div>
                        </div>
                      )}

                      {detailsAsset.model && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Model</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{detailsAsset.model}</div>
                        </div>
                      )}

                      {detailsAsset.colour && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Colour</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{detailsAsset.colour}</div>
                        </div>
                      )}

                      {detailsAsset.telecomProvider && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Telecom Provider</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>{detailsAsset.telecomProvider}</div>
                        </div>
                      )}

                      {detailsAsset.simNumber && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SIM / Mobile Number</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3, fontFamily: 'monospace' }}>{detailsAsset.simNumber}</div>
                        </div>
                      )}

                      {detailsAsset.imei1 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>IMEI 1</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3, fontFamily: 'monospace' }}>{detailsAsset.imei1}</div>
                        </div>
                      )}

                      {detailsAsset.imei2 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>IMEI 2</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3, fontFamily: 'monospace' }}>{detailsAsset.imei2}</div>
                        </div>
                      )}
                    </div>

                    {/* Description Notes */}
                    {detailsAsset.description && (
                      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Description / Notes</div>
                        <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                          {detailsAsset.description}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Current Custody & Assignment Details */}
                  <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                          Custody, Assignment & Acknowledgement
                        </h4>
                      </div>

                      {detailsAsset.assignedTo ? (
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: 6 }}>
                          Currently Assigned
                        </span>
                      ) : (
                        <span style={{ fontSize: 11.5, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 6 }}>
                          Not Assigned
                        </span>
                      )}
                    </div>

                    {detailsAsset.assignedTo ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px 20px' }}>
                          {/* Assigned To */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned Employee</div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                              {detailsAsset.assignedTo.firstName} {detailsAsset.assignedTo.lastName}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                              {detailsAsset.assignedTo.employeeId || detailsAsset.assignedTo.username || ''}
                              {detailsAsset.assignedTo.designation ? ` · ${detailsAsset.assignedTo.designation}` : ''}
                            </div>
                          </div>

                          {/* Assigned By */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assigned By (Issuer)</div>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginTop: 3 }}>
                              {detailsAsset.assignedBy ? `${detailsAsset.assignedBy.firstName} ${detailsAsset.assignedBy.lastName}` : 'Administrator'}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }}>
                              {detailsAsset.assignedBy?.employeeId || detailsAsset.assignedBy?.username || 'Admin'}
                            </div>
                          </div>

                          {/* Assigned Date */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Assignment Date</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 3 }}>
                              {detailsAsset.assignedDate ? new Date(detailsAsset.assignedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </div>
                          </div>

                          {/* Acknowledgement Status */}
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Acknowledgement Status</div>
                            <div style={{ marginTop: 3 }}>
                              {(detailsAsset.signature || detailsAsset.acknowledgement) ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2.5px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#15803d', background: '#dcfce7', border: '1px solid #bbf7d0' }}>
                                  ✓ Signed & Verified {detailsAsset.signedAt ? `(${new Date(detailsAsset.signedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})` : ''}
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2.5px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a' }}>
                                  • Pending Receiver Signature
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Signature Previews */}
                        {(detailsAsset.signature || detailsAsset.issuerSignature) && (
                          <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                            {detailsAsset.signature && (
                              <div style={{ flex: '1 1 240px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Receiver Signature</span>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage({ url: detailsAsset.signature, title: `Receiver Signature: ${detailsAsset.assignedTo?.firstName || ''} ${detailsAsset.assignedTo?.lastName || ''}`, subtitle: `Asset: ${detailsAsset.assetId} · ${detailsAsset.brandName || detailsAsset.assetName}` })}
                                    style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                  >
                                    Zoom Preview ↗
                                  </button>
                                </div>
                                <div
                                  onClick={() => setPreviewImage({ url: detailsAsset.signature, title: `Receiver Signature: ${detailsAsset.assignedTo?.firstName || ''} ${detailsAsset.assignedTo?.lastName || ''}`, subtitle: `Asset: ${detailsAsset.assetId} · ${detailsAsset.brandName || detailsAsset.assetName}` })}
                                  style={{ height: 60, background: '#fff', borderRadius: 6, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4 }}
                                >
                                  <img src={detailsAsset.signature} alt="Receiver Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                </div>
                              </div>
                            )}

                            {detailsAsset.issuerSignature && (
                              <div style={{ flex: '1 1 240px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', textTransform: 'uppercase' }}>Issuer Signature</span>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewImage({ url: detailsAsset.issuerSignature, title: `Issuer Signature: ${detailsAsset.assignedBy?.firstName || 'Admin'} ${detailsAsset.assignedBy?.lastName || ''}`, subtitle: `Asset: ${detailsAsset.assetId} · ${detailsAsset.brandName || detailsAsset.assetName}` })}
                                    style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                  >
                                    Zoom Preview ↗
                                  </button>
                                </div>
                                <div
                                  onClick={() => setPreviewImage({ url: detailsAsset.issuerSignature, title: `Issuer Signature: ${detailsAsset.assignedBy?.firstName || 'Admin'} ${detailsAsset.assignedBy?.lastName || ''}`, subtitle: `Asset: ${detailsAsset.assetId} · ${detailsAsset.brandName || detailsAsset.assetName}` })}
                                  style={{ height: 60, background: '#fff', borderRadius: 6, border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4 }}
                                >
                                  <img src={detailsAsset.issuerSignature} alt="Issuer Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: '16px 20px', background: '#f8fafc', borderRadius: 10, border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: 12.5 }}>
                        This asset is currently in inventory stock and not assigned to any employee.
                      </div>
                    )}
                  </div>

                  {/* Card 3: Maintenance Information (if applicable) */}
                  {detailsAsset.status === 'maintenance' && detailsAsset.maintenanceDetails && (
                    <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: 14, padding: '20px 22px', boxShadow: '0 1px 3px rgba(15,23,42,0.03)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #fef3c7' }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d97706' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                            <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
                          </svg>
                        </div>
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                          Maintenance & Service Center Details
                        </h4>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px 18px' }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Reported Issue</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{detailsAsset.maintenanceDetails.issue || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Service Center / Shop</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{detailsAsset.maintenanceDetails.shopName || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Contact Person</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{detailsAsset.maintenanceDetails.contactPerson || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Phone Number</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{detailsAsset.maintenanceDetails.phoneNumber || '—'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e', textTransform: 'uppercase' }}>Sent On Date</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>{detailsAsset.maintenanceDetails.sentOnDate ? new Date(detailsAsset.maintenanceDetails.sentOnDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '14px 28px',
              borderTop: '1px solid #e2e8f0',
              background: '#fafbfc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexShrink: 0,
              flexWrap: 'wrap',
              gap: 10
            }}>
              {/* Left Action Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailsModal(false);
                    openHistory(detailsAsset);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0284c7',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#bae6fd'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Timeline & History
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDetailsModal(false);
                    openDocModal(detailsAsset);
                  }}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 9,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f766e',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdfa'; e.currentTarget.style.borderColor = '#99f6e4'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                >
                  <FileText size={14} />
                  Handover Form
                </button>
              </div>

              {/* Right Action Buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDetailsModal(false);
                      openEdit(detailsAsset);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 9,
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#2563eb',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#dbeafe'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    Edit Asset
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 9,
                    border: 'none',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1e293b'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#0f172a'; }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Official Handover Form View / Print / PDF Modal ── */}
      {showDocModal && docModalAsset && (
        <div onClick={() => setShowDocModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 1200 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 880, background: '#f8fafc', borderRadius: 20, border: '1px solid #e2e8f0', boxShadow: '0 25px 60px rgba(0,0,0,0.3)', overflow: 'hidden', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff', flexShrink: 0, flexWrap: 'wrap', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Asset Handover Acknowledgement Form</div>
                  <div style={{ fontSize: 11.5, color: '#64748b' }}>
                    {docModalAsset.assetName} · {getDisplayAssetCode(docModalAsset)} · {docModalAsset.assignedTo ? `Assigned to ${docModalAsset.assignedTo.firstName} ${docModalAsset.assignedTo.lastName || ''}` : 'Unassigned / Draft'}
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDocModal(false)} style={{ background: '#f1f5f9', border: 'none', width: 32, height: 32, borderRadius: 10, fontSize: 20, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#f1f5f9', display: 'flex', justifyContent: 'center' }}>
              {(() => {
                const targetEmpId = docModalAsset.assignedTo
                  ? (docModalAsset.assignedTo._id || docModalAsset.assignedTo)
                  : null;
                const employeeAssignedAssets = targetEmpId
                  ? assets.filter(a => a.assignedTo && (a.assignedTo._id || a.assignedTo) === targetEmpId)
                  : [docModalAsset];

                // Ensure docModalAsset itself is in the list
                const allAssignedList = employeeAssignedAssets.some(a => a._id === docModalAsset._id)
                  ? employeeAssignedAssets
                  : [docModalAsset, ...employeeAssignedAssets];

                return (
                  <AssetAcknowledgmentForm
                    asset={docModalAsset}
                    assignedAssets={allAssignedList}
                    allAssets={assets}
                    employee={docModalAsset.assignedTo}
                    issuer={
                      docModalAsset.assignedBy
                        ? (employees.find(e => e._id === (docModalAsset.assignedBy?._id || docModalAsset.assignedBy)) || docModalAsset.assignedBy)
                        : (employees.find(e => e._id === (user?._id || user?.id)) || user)
                    }
                    issuerSignature={docModalAsset.issuerSignature || '/nehamam_sign.png'}
                    receiverSignature={docModalAsset.signature}
                    signedAt={docModalAsset.signedAt}
                    assignedDate={docModalAsset.assignedDate}
                    isDraft={!docModalAsset.assignedTo}
                    showActions={isPrivilegedUser}
                    currentUser={user}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

{/* Animation keyframes */ }
const style = document.createElement('style');
style.textContent = `
  @keyframes assets-spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

export default Assets;
