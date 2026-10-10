import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useContextualQueryState } from '../utils/routeUtils';
import api from '../api/axios';
import './Payroll.css';
import '../index.css';

// ── Sparkline Helper Component ──
const Sparkline = ({ data = [0, 0, 0, 0, 0, 0], color = '#6366f1' }) => {
  const w = 96, h = 34;
  const safeData = (data && data.length > 0) ? data : [0, 0, 0, 0, 0, 0];
  const allZero = safeData.every(v => v === 0);

  const padX = 3;
  const padY = 4;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;

  if (allZero) {
    const y = h - padY;
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
        <line x1={padX} y1={y} x2={w - padX} y2={y} stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <circle cx={w - padX} cy={y} r="2.5" fill={color} />
      </svg>
    );
  }

  const max = Math.max(...safeData, 1);
  const min = Math.min(...safeData);
  const range = (max - min) || 1;

  const points = safeData.map((v, i) => {
    const x = padX + (i / (safeData.length - 1)) * innerW;
    const y = padY + innerH - ((v - min) / range) * innerH;
    return { x, y };
  });

  const ptsString = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const firstPt = points[0];
  const lastPt = points[points.length - 1];

  const fillPts = `${firstPt.x.toFixed(1)},${h} ${ptsString} ${lastPt.x.toFixed(1)},${h}`;
  const gradId = `spk-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill={`url(#${gradId})`} />
      <polyline points={ptsString} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r="2.8" fill={color} />
    </svg>
  );
};

// ── Helper to calculate dynamic sparkline trend from documents list ──
const getDynamicSparklineData = (docsList = [], filterFn = null) => {
  const filtered = filterFn ? docsList.filter(filterFn) : docsList;
  if (!filtered || filtered.length === 0) {
    return [0, 0, 0, 0, 0, 0];
  }

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const counts = months.map(({ year, month }) => {
    return filtered.filter(doc => {
      const docDate = doc.createdAt ? new Date(doc.createdAt) : null;
      return docDate && docDate.getFullYear() === year && docDate.getMonth() === month;
    }).length;
  });

  const allZero = counts.every(c => c === 0);
  if (allZero) {
    const days = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toDateString());
    }
    const dayCounts = days.map(dayStr => {
      return filtered.filter(doc => {
        const docDate = doc.createdAt ? new Date(doc.createdAt).toDateString() : null;
        return docDate === dayStr;
      }).length;
    });

    const daysAllZero = dayCounts.every(c => c === 0);
    if (!daysAllZero) return dayCounts;

    const total = filtered.length;
    if (total === 1) return [0, 0, 0, 0, 0, 1];
    if (total === 2) return [0, 0, 0, 1, 1, 2];
    const step = total / 5;
    return Array.from({ length: 6 }, (_, i) => Math.round(step * i));
  }

  return counts;
};

// ── SVG Category Icons ──
const getCategoryIconSvg = (category) => {
  switch (category) {
    case 'Aadhar Card':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <circle cx="9" cy="10" r="2" />
          <path d="M15 8h2" />
          <path d="M15 12h2" />
          <path d="M7 16h10" />
        </svg>
      );
    case 'PAN Card':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
          <circle cx="6" cy="15" r="1.5" />
          <line x1="10" y1="15" x2="18" y2="15" />
        </svg>
      );
    case 'Agreement':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'Receipts':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z" />
          <line x1="8" y1="8" x2="16" y2="8" />
          <line x1="8" y1="12" x2="16" y2="12" />
          <line x1="8" y1="16" x2="12" y2="16" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </svg>
      );
  }
};

function Documents() {
  const { hasPermission } = useAuth();

  // Contextual Query State: URL as single source of truth (?ref=sidebar&tab=employee&filter=all&page=1)
  const [{ tab: queryTab, filter: statusFilter, search: searchTerm, page: employeeCurrentPage, clientPage: clientCurrentPage, clientFilter, clientSearch: clientSearchTerm }, setQueryState] = useContextualQueryState({
    ref: 'sidebar',
    tab: 'employee',
    filter: 'all',
    search: '',
    page: 1,
    clientPage: 1,
    clientFilter: 'all',
    clientSearch: '',
  });

  const activeTab = queryTab === 'client' ? 'client' : 'employee';

  const setActiveTab = useCallback((tab) => setQueryState({ tab }), [setQueryState]);
  const setStatusFilter = useCallback((filter) => setQueryState({ filter, page: 1 }), [setQueryState]);
  const setSearchTerm = useCallback((search) => setQueryState({ search, page: 1 }), [setQueryState]);
  const setEmployeeCurrentPage = useCallback((page) => setQueryState((prev) => ({ page: typeof page === 'function' ? page(prev.page || 1) : page })), [setQueryState]);
  const setClientCurrentPage = useCallback((clientPage) => setQueryState((prev) => ({ clientPage: typeof clientPage === 'function' ? clientPage(prev.clientPage || 1) : clientPage })), [setQueryState]);
  const setClientFilter = useCallback((clientFilter) => setQueryState({ clientFilter, clientPage: 1 }), [setQueryState]);
  const setClientSearchTerm = useCallback((clientSearch) => setQueryState({ clientSearch: clientSearch, clientPage: 1 }), [setQueryState]);

  // Pagination Constants & State
  const ITEMS_PER_PAGE = 8;

  // Employee Documents State
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [statusSearchText, setStatusSearchText] = useState('');
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employeeSearchText, setEmployeeSearchText] = useState('');
  const [showUploadEmployeeDropdown, setShowUploadEmployeeDropdown] = useState(false);
  const [uploadEmployeeSearchText, setUploadEmployeeSearchText] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchText, setCategorySearchText] = useState('');
  const [showSubCategoryDropdown, setShowSubCategoryDropdown] = useState(false);
  const [subCategorySearchText, setSubCategorySearchText] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeDocs, setSelectedEmployeeDocs] = useState([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [viewDocument, setViewDocument] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null);
  const [viewDocumentMime, setViewDocumentMime] = useState('');
  const [viewClientDocMime, setViewClientDocMime] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFormData, setUploadFormData] = useState({
    employeeId: '',
    title: '',
    description: '',
    category: 'Other',
    subCategory: '',
    file: null
  });
  const [uploading, setUploading] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    category: 'Other'
  });

  // Client Documents State
  const [clientDocuments, setClientDocuments] = useState([]);
  const [filteredClientDocuments, setFilteredClientDocuments] = useState([]);
  const [clients, setClients] = useState([]);
  const [clientLoading, setClientLoading] = useState(false);
  const [clientCategoryFilter, setClientCategoryFilter] = useState('all');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clientSearchText, setClientSearchText] = useState('');
  const [showClientCategoryDropdown, setShowClientCategoryDropdown] = useState(false);
  const [clientCategorySearchText, setClientCategorySearchText] = useState('');

  // Client Upload Modal State
  const [showClientUploadModal, setShowClientUploadModal] = useState(false);
  const [showUploadClientDropdown, setShowUploadClientDropdown] = useState(false);
  const [uploadClientSearchText, setUploadClientSearchText] = useState('');
  const [clientUploadFormData, setClientUploadFormData] = useState({
    clientId: '',
    category: 'Aadhar Card',
    title: '',
    description: '',
    file: null
  });
  const [uploadingClientDoc, setUploadingClientDoc] = useState(false);

  // Client View/Preview & Client Details Modal State
  const [viewClientDocument, setViewClientDocument] = useState(null);
  const [viewClientDocLoading, setViewClientDocLoading] = useState(false);
  const [viewClientDocUrl, setViewClientDocUrl] = useState(null);
  const [selectedClientDetails, setSelectedClientDetails] = useState(null);

  // Permissions
  const canUploadForEmployee = hasPermission('documents', 'create') || hasPermission('my-documents', 'create');
  const canCreate = hasPermission('documents', 'create');
  const canDelete = hasPermission('documents', 'delete');
  const canApprove = hasPermission('documents', 'update');

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const response = await api.get('/documents');
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchClientDocuments = async () => {
    setClientLoading(true);
    try {
      const response = await api.get('/client-documents');
      setClientDocuments(response.data || []);
    } catch (error) {
      console.error('Error fetching client documents:', error);
    } finally {
      setClientLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  useEffect(() => {
    fetchDocuments();
    fetchEmployees();
    fetchClientDocuments();
    fetchClients();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.custom-status-dropdown')) setShowStatusDropdown(false);
      if (!e.target.closest('.custom-employee-dropdown')) setShowEmployeeDropdown(false);
      if (!e.target.closest('.custom-upload-employee-dropdown')) setShowUploadEmployeeDropdown(false);
      if (!e.target.closest('.custom-category-dropdown')) setShowCategoryDropdown(false);
      if (!e.target.closest('.custom-subcategory-dropdown')) setShowSubCategoryDropdown(false);
      if (!e.target.closest('.custom-client-dropdown')) setShowClientDropdown(false);
      if (!e.target.closest('.custom-client-category-dropdown')) setShowClientCategoryDropdown(false);
      if (!e.target.closest('.custom-upload-client-dropdown')) setShowUploadClientDropdown(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Filter Employee Documents & reset page
  useEffect(() => {
    const filtered = documents.filter((doc) => {
      const matchesStatus = statusFilter === 'all' || doc.status === statusFilter;
      const targetUser = doc.user || doc.uploadedBy;
      const matchesEmployee = employeeFilter === 'all' || targetUser?._id === employeeFilter;
      const text = `${doc.title || ''} ${doc.description || ''} ${doc.category || ''}`.toLowerCase();
      const matchesSearch = !searchTerm || text.includes(searchTerm.toLowerCase());
      return matchesStatus && matchesEmployee && matchesSearch;
    });

    setFilteredDocuments(filtered);
    setEmployeeCurrentPage(1);
  }, [documents, statusFilter, searchTerm, employeeFilter]);

  // Filter Client Documents & reset page
  useEffect(() => {
    const filtered = clientDocuments.filter((doc) => {
      const matchesClient = clientFilter === 'all' || doc.client?._id === clientFilter;
      const matchesCategory = clientCategoryFilter === 'all' || doc.category === clientCategoryFilter;
      const clientName = `${doc.client?.name || ''} ${doc.client?.company || ''}`.toLowerCase();
      const text = `${doc.title || ''} ${doc.description || ''} ${doc.category || ''} ${doc.filename || ''} ${clientName}`.toLowerCase();
      const matchesSearch = !clientSearchTerm || text.includes(clientSearchTerm.toLowerCase());
      return matchesClient && matchesCategory && matchesSearch;
    });

    setFilteredClientDocuments(filtered);
    setClientCurrentPage(1);
  }, [clientDocuments, clientFilter, clientCategoryFilter, clientSearchTerm]);

  const handleDownload = async (id, filename) => {
    try {
      const response = await api.get(`/documents/${id}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Error downloading document');
      console.error('Download error:', error);
    }
  };

  const handleDownloadClientDoc = async (id, filename) => {
    try {
      const response = await api.get(`/client-documents/${id}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert('Error downloading client document');
      console.error('Download error:', error);
    }
  };

  const formatDocumentDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const closeViewDocument = () => {
    if (viewDocumentUrl) {
      URL.revokeObjectURL(viewDocumentUrl);
      setViewDocumentUrl(null);
    }
    setViewDocument(null);
    setViewDocumentMime('');
  };

  const closeViewClientDocument = () => {
    if (viewClientDocUrl) {
      URL.revokeObjectURL(viewClientDocUrl);
      setViewClientDocUrl(null);
    }
    setViewClientDocument(null);
    setViewClientDocMime('');
  };

  const handleView = async (doc) => {
    setViewDocument(doc);
    setViewLoading(true);

    if (viewDocumentUrl) {
      URL.revokeObjectURL(viewDocumentUrl);
      setViewDocumentUrl(null);
    }

    try {
      let response;
      try {
        response = await api.get(`/documents/${doc._id}/preview`, { responseType: 'blob' });
      } catch (previewErr) {
        response = await api.get(`/documents/${doc._id}/download`, { responseType: 'blob' });
      }

      // If backend returned JSON error disguised as a blob
      if (response.data && response.data.type === 'application/json') {
        const text = await response.data.text();
        try {
          const json = JSON.parse(text);
          throw new Error(json.message || 'Error loading preview');
        } catch (_) {
          throw new Error(text);
        }
      }

      const mimeType = response.headers['content-type'] || response.data?.type || doc.mimetype || 'application/octet-stream';
      setViewDocumentMime(mimeType);

      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      setViewDocumentUrl(blobUrl);
    } catch (error) {
      console.error('View document error:', error);
      setViewDocumentUrl(null);
      setViewDocumentMime('');
    } finally {
      setViewLoading(false);
    }
  };

  const handleViewClientDoc = async (doc) => {
    setViewClientDocument(doc);
    setViewClientDocLoading(true);

    if (viewClientDocUrl) {
      URL.revokeObjectURL(viewClientDocUrl);
      setViewClientDocUrl(null);
    }

    try {
      let response;
      try {
        response = await api.get(`/client-documents/${doc._id}/preview`, { responseType: 'blob' });
      } catch (previewErr) {
        response = await api.get(`/client-documents/${doc._id}/download`, { responseType: 'blob' });
      }

      if (response.data && response.data.type === 'application/json') {
        const text = await response.data.text();
        try {
          const json = JSON.parse(text);
          throw new Error(json.message || 'Error loading client document preview');
        } catch (_) {
          throw new Error(text);
        }
      }

      const mimeType = response.headers['content-type'] || response.data?.type || doc.mimetype || 'application/octet-stream';
      setViewClientDocMime(mimeType);

      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      setViewClientDocUrl(blobUrl);
    } catch (error) {
      console.error('View client doc error:', error);
      setViewClientDocUrl(null);
      setViewClientDocMime('');
    } finally {
      setViewClientDocLoading(false);
    }
  };

  const handleOpenClientDetails = async (clientObj) => {
    if (!clientObj) return;
    const clientId = typeof clientObj === 'object' ? clientObj._id : clientObj;

    // Set initial client data from state or passed object
    const clientFromState = clients.find(c => String(c._id) === String(clientId));
    setSelectedClientDetails(clientFromState || (typeof clientObj === 'object' ? clientObj : { _id: clientId }));

    // Fetch full complete client record from backend
    if (clientId) {
      try {
        const response = await api.get(`/clients/${clientId}`);
        if (response.data) {
          setSelectedClientDetails(response.data);
        }
      } catch (err) {
        console.error('Error fetching full client details:', err);
      }
    }
  };

  const handleViewEmployee = (employee, docs) => {
    setSelectedEmployee(employee);
    setSelectedEmployeeDocs(docs || []);
    setShowEmployeeModal(true);
  };

  const handleEdit = (doc) => {
    setEditingDocument(doc);
    setEditFormData({
      title: doc.title || '',
      description: doc.description || '',
      category: doc.category || 'Other'
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingDocument) return;

    try {
      await api.put(`/documents/my-documents/${editingDocument._id}`, editFormData);
      setShowEditModal(false);
      setEditingDocument(null);
      fetchDocuments();
      alert('Document updated successfully!');
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating document');
      console.error('Update error:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;

    try {
      await api.delete(`/documents/${id}`);
      alert('Document deleted successfully.');
      fetchDocuments();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting document');
      console.error('Delete error:', error);
    }
  };

  const handleDeleteClientDoc = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client document?')) return;

    try {
      await api.delete(`/client-documents/${id}`);
      alert('Client document deleted successfully.');
      fetchClientDocuments();
    } catch (error) {
      alert(error.response?.data?.message || 'Error deleting client document');
      console.error('Delete error:', error);
    }
  };

  const handleUpdateStatus = async (documentId, status) => {
    if (!canApprove) {
      alert('You do not have permission to approve or reject documents.');
      return;
    }

    let rejectionReason;
    if (status === 'rejected') {
      rejectionReason = window.prompt('Please provide a reason for rejection:');
      if (rejectionReason === null) {
        return;
      }
      if (!rejectionReason.trim()) {
        alert('Rejection reason is required.');
        return;
      }
    }

    try {
      const response = await api.put(`/documents/${documentId}/status`, {
        status,
        rejectionReason
      });
      const updatedDocument = response.data;
      fetchDocuments();
      setSelectedEmployeeDocs((prevDocs) => prevDocs.map((doc) =>
        doc._id === documentId ? { ...doc, status: updatedDocument.status, rejectionReason: updatedDocument.rejectionReason } : doc
      ));
      if (viewDocument && viewDocument._id === documentId) {
        setViewDocument((prev) => prev ? { ...prev, status: updatedDocument.status, rejectionReason: updatedDocument.rejectionReason } : prev);
      }
      alert(`Document ${status === 'approved' ? 'approved' : 'rejected'} successfully.`);
    } catch (error) {
      alert(error.response?.data?.message || 'Error updating document status');
      console.error('Status update error:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (viewDocumentUrl) URL.revokeObjectURL(viewDocumentUrl);
      if (viewClientDocUrl) URL.revokeObjectURL(viewClientDocUrl);
    };
  }, [viewDocumentUrl, viewClientDocUrl]);



  const handleUploadForEmployee = async (e) => {
    e.preventDefault();

    if (!uploadFormData.employeeId || !uploadFormData.file) {
      alert('Please select an employee and choose a file');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('document', uploadFormData.file);
      formData.append('employeeId', uploadFormData.employeeId);
      formData.append('title', uploadFormData.title || uploadFormData.file.name);
      formData.append('description', uploadFormData.description);
      formData.append('category', uploadFormData.category);
      if (uploadFormData.subCategory) formData.append('subCategory', uploadFormData.subCategory);

      await api.post('/documents/upload-for-employee', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Document uploaded successfully!');
      setShowUploadModal(false);
      setUploadFormData({
        employeeId: '',
        title: '',
        description: '',
        category: 'Other',
        subCategory: '',
        file: null
      });
      fetchDocuments();
    } catch (error) {
      alert(error.response?.data?.message || 'Error uploading document');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadForClient = async (e) => {
    e.preventDefault();

    if (!clientUploadFormData.clientId || !clientUploadFormData.file) {
      alert('Please select a client and choose a file');
      return;
    }

    setUploadingClientDoc(true);
    try {
      const formData = new FormData();
      formData.append('document', clientUploadFormData.file);
      formData.append('clientId', clientUploadFormData.clientId);
      formData.append('category', clientUploadFormData.category || 'Aadhar Card');
      formData.append('title', clientUploadFormData.title || `${clientUploadFormData.category} - ${clientUploadFormData.file.name}`);
      formData.append('description', clientUploadFormData.description || '');

      await api.post('/client-documents', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      alert('Client document uploaded successfully!');
      setShowClientUploadModal(false);
      setClientUploadFormData({
        clientId: '',
        category: 'Aadhar Card',
        title: '',
        description: '',
        file: null
      });
      fetchClientDocuments();
    } catch (error) {
      alert(error.response?.data?.message || 'Error uploading client document');
      console.error('Client upload error:', error);
    } finally {
      setUploadingClientDoc(false);
    }
  };

  const getCategoryBadgeStyle = (category) => {
    switch (category) {
      case 'Aadhar Card':
        return { background: 'rgba(59, 130, 246, 0.12)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '20px' };
      case 'PAN Card':
        return { background: 'rgba(147, 51, 234, 0.12)', color: '#6b21a8', border: '1px solid rgba(147, 51, 234, 0.25)', borderRadius: '20px' };
      case 'Agreement':
        return { background: 'rgba(16, 185, 129, 0.12)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: '20px' };
      case 'Receipts':
        return { background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '20px' };
      default:
        return { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '20px' };
    }
  };

  if (loading && clientLoading) {
    return <div className="container" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading documents...</div>;
  }

  // Employee Statistics
  const totalDocuments = documents.length;
  const pendingApproval = documents.filter(doc => doc.status === 'pending').length;
  const approvedDocuments = documents.filter(doc => doc.status === 'approved').length;
  const rejectedDocuments = documents.filter(doc => doc.status === 'rejected').length;

  // Client Statistics
  const totalClientDocs = clientDocuments.length;
  const aadharCount = clientDocuments.filter(doc => doc.category === 'Aadhar Card').length;
  const panCount = clientDocuments.filter(doc => doc.category === 'PAN Card').length;
  const agreementCount = clientDocuments.filter(doc => doc.category === 'Agreement').length;
  const receiptsCount = clientDocuments.filter(doc => doc.category === 'Receipts').length;

  return (
    <div className="page-container" style={{
      background: '#f8fafc',
      minHeight: '100vh',
      padding: '24px 28px',
      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
      boxSizing: 'border-box'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Document Management
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              {activeTab === 'employee'
                ? 'View, approve and manage all employee verification documents'
                : 'View, upload and organize all client identity & agreement documents'}
            </p>
          </div>
        </div>

        {/* ── Professional Payroll-style Tab Bar ── */}
        <div className="payroll-tabs" style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', width: '100%' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'employee' ? 'active' : ''}`}
            onClick={() => setActiveTab('employee')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: activeTab === 'employee' ? 600 : 500,
              color: activeTab === 'employee' ? '#1877f2' : '#64748b',
              borderBottom: activeTab === 'employee' ? '3px solid #1877f2' : '3px solid transparent',
              marginBottom: '-2px',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Employee Documents
            <span style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              background: activeTab === 'employee' ? 'rgba(24, 119, 242, 0.12)' : '#cbd5e1',
              color: activeTab === 'employee' ? '#1877f2' : '#475569'
            }}>
              {totalDocuments}
            </span>
          </button>

          <button
            type="button"
            className={`tab-btn ${activeTab === 'client' ? 'active' : ''}`}
            onClick={() => setActiveTab('client')}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'none',
              fontSize: '14px',
              fontWeight: activeTab === 'client' ? 600 : 500,
              color: activeTab === 'client' ? '#1877f2' : '#64748b',
              borderBottom: activeTab === 'client' ? '3px solid #1877f2' : '3px solid transparent',
              marginBottom: '-2px',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Client Documents
            <span style={{
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              background: activeTab === 'client' ? 'rgba(24, 119, 242, 0.12)' : '#cbd5e1',
              color: activeTab === 'client' ? '#1877f2' : '#475569'
            }}>
              {totalClientDocs}
            </span>
          </button>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* ── TAB 1: EMPLOYEE DOCUMENTS ─────────────────────────────── */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === 'employee' && (
          <>
            {/* Top Metric Cards — Dynamic Real-Time Sparklines */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              {/* Card 1: Total Documents */}
              <div
                onClick={() => setStatusFilter('all')}
                style={{
                  background: 'white',
                  padding: '16px 18px 12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  position: 'relative',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  position: 'absolute',
                  right: '-15px',
                  bottom: '-15px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Total Documents
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(99,102,241,0.12)', color: '#4f46e5' }}>
                    All Files
                  </span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                  {totalDocuments}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total employee records</span>
                  <Sparkline data={getDynamicSparklineData(documents)} color="#6366f1" />
                </div>
              </div>

              {/* Card 2: Pending Approval */}
              <div
                onClick={() => setStatusFilter('pending')}
                style={{
                  background: 'white',
                  padding: '16px 18px 12px',
                  borderRadius: '12px',
                  border: pendingApproval > 0 ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  position: 'relative',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  position: 'absolute',
                  right: '-15px',
                  bottom: '-15px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(245,158,11,0.14) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    Pending Approval
                  </div>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    background: pendingApproval > 0 ? 'rgba(245,158,11,0.18)' : '#f1f5f9',
                    color: pendingApproval > 0 ? '#b45309' : '#64748b'
                  }}>
                    {pendingApproval > 0 ? 'Requires Action' : 'Up to date'}
                  </span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#f59e0b', lineHeight: 1, marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                  {pendingApproval}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Awaiting review</span>
                  <Sparkline data={getDynamicSparklineData(documents, d => d.status === 'pending')} color="#f59e0b" />
                </div>
              </div>

              {/* Card 3: Approved Documents */}
              <div
                onClick={() => setStatusFilter('approved')}
                style={{
                  background: 'white',
                  padding: '16px 18px 12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  position: 'relative',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  position: 'absolute',
                  right: '-15px',
                  bottom: '-15px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Approved
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: '#047857' }}>
                    Verified
                  </span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#10b981', lineHeight: 1, marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                  {approvedDocuments}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Verified & accepted</span>
                  <Sparkline data={getDynamicSparklineData(documents, d => d.status === 'approved')} color="#10b981" />
                </div>
              </div>

              {/* Card 4: Rejected Documents */}
              <div
                onClick={() => setStatusFilter('rejected')}
                style={{
                  background: 'white',
                  padding: '16px 18px 12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  position: 'relative',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  position: 'absolute',
                  right: '-15px',
                  bottom: '-15px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                    Rejected
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(239,68,68,0.12)', color: '#b91c1c' }}>
                    Needs Revision
                  </span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#ef4444', lineHeight: 1, marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                  {rejectedDocuments}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Returned for revision</span>
                  <Sparkline data={getDynamicSparklineData(documents, d => d.status === 'rejected')} color="#ef4444" />
                </div>
              </div>
            </div>

            {/* Quick Status Buttons & Upload Button */}
            {canUploadForEmployee && (
              <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setStatusFilter('all')}
                    style={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: statusFilter === 'all' ? 'none' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: statusFilter === 'all' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
                      color: statusFilter === 'all' ? '#fff' : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    All ({totalDocuments})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    style={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: statusFilter === 'pending' ? 'none' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: statusFilter === 'pending' ? '#f59e0b' : '#fff',
                      color: statusFilter === 'pending' ? '#fff' : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Pending ({pendingApproval})
                  </button>
                  <button
                    onClick={() => setStatusFilter('approved')}
                    style={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: statusFilter === 'approved' ? 'none' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: statusFilter === 'approved' ? '#10b981' : '#fff',
                      color: statusFilter === 'approved' ? '#fff' : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Approved ({approvedDocuments})
                  </button>
                  <button
                    onClick={() => setStatusFilter('rejected')}
                    style={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: statusFilter === 'rejected' ? 'none' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: statusFilter === 'rejected' ? '#ef4444' : '#fff',
                      color: statusFilter === 'rejected' ? '#fff' : '#64748b',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Rejected ({rejectedDocuments})
                  </button>
                </div>
                {canCreate && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    style={{
                      padding: '9px 18px',
                      fontSize: '13px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      border: 'none',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                      color: '#fff',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(59,119,94,0.3)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Upload Document
                  </button>
                )}
              </div>
            )}

            {/* Filter & Search Panel */}
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12.5px', color: '#475569' }}>
                    Search Documents
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by title, description, or category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ borderRadius: '8px', padding: '9px 12px', fontSize: '13px' }}
                  />
                </div>

                <div className="custom-status-dropdown" style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12.5px', color: '#475569' }}>
                    Filter by Status
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowEmployeeDropdown(false); }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: showStatusDropdown ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#0f172a'
                    }}
                  >
                    <span>
                      {statusFilter === 'all' ? 'All Documents' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                    </span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showStatusDropdown ? 'rotate(180deg)' : 'none' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showStatusDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: '100%',
                      background: '#ffffff',
                      borderRadius: '10px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      zIndex: 300,
                      padding: '8px',
                      border: '1px solid #f1f5f9'
                    }}>
                      <input
                        type="text"
                        placeholder="Search status..."
                        value={statusSearchText}
                        onChange={(e) => setStatusSearchText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          background: '#f8fafc',
                          outline: 'none',
                          marginBottom: '6px'
                        }}
                      />
                      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {[{ value: 'all', label: 'All Documents' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]
                          .filter(s => s.label.toLowerCase().includes(statusSearchText.toLowerCase()))
                          .map(status => (
                            <div
                              key={status.value}
                              onClick={() => { setStatusFilter(status.value); setShowStatusDropdown(false); setStatusSearchText(''); }}
                              onMouseEnter={(e) => { if (statusFilter !== status.value) e.currentTarget.style.background = '#f1f5f9'; }}
                              onMouseLeave={(e) => { if (statusFilter !== status.value) e.currentTarget.style.background = 'transparent'; }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: statusFilter === status.value ? '600' : '400',
                                cursor: 'pointer',
                                color: statusFilter === status.value ? '#1877f2' : '#334155',
                                background: statusFilter === status.value ? '#eff6ff' : 'transparent',
                                marginBottom: '2px',
                                transition: 'background 0.15s'
                              }}
                            >
                              {status.label}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="custom-employee-dropdown" style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12.5px', color: '#475569' }}>
                    Filter by Employee
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowEmployeeDropdown(!showEmployeeDropdown); setShowStatusDropdown(false); }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: showEmployeeDropdown ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#0f172a'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                      {employeeFilter === 'all' ? 'All Employees' : (() => {
                        const emp = employees.find(e => e._id === employeeFilter);
                        return emp ? `${emp.firstName} ${emp.lastName}` : 'All Employees';
                      })()}
                    </span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showEmployeeDropdown ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showEmployeeDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: '100%',
                      background: '#ffffff',
                      borderRadius: '10px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      zIndex: 300,
                      padding: '8px',
                      border: '1px solid #f1f5f9'
                    }}>
                      <input
                        type="text"
                        placeholder="Search employees..."
                        value={employeeSearchText}
                        onChange={(e) => setEmployeeSearchText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          background: '#f8fafc',
                          outline: 'none',
                          marginBottom: '6px'
                        }}
                      />
                      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        <div
                          onClick={() => { setEmployeeFilter('all'); setShowEmployeeDropdown(false); setEmployeeSearchText(''); }}
                          onMouseEnter={(e) => { if (employeeFilter !== 'all') e.currentTarget.style.background = '#f1f5f9'; }}
                          onMouseLeave={(e) => { if (employeeFilter !== 'all') e.currentTarget.style.background = 'transparent'; }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: employeeFilter === 'all' ? '600' : '400',
                            cursor: 'pointer',
                            color: employeeFilter === 'all' ? '#1877f2' : '#334155',
                            background: employeeFilter === 'all' ? '#eff6ff' : 'transparent',
                            marginBottom: '2px',
                            transition: 'background 0.15s'
                          }}
                        >
                          All Employees
                        </div>
                        {employees
                          .filter(emp => `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(employeeSearchText.toLowerCase()))
                          .map(emp => (
                            <div
                              key={emp._id}
                              onClick={() => { setEmployeeFilter(emp._id); setShowEmployeeDropdown(false); setEmployeeSearchText(''); }}
                              onMouseEnter={(e) => { if (employeeFilter !== emp._id) e.currentTarget.style.background = '#f1f5f9'; }}
                              onMouseLeave={(e) => { if (employeeFilter !== emp._id) e.currentTarget.style.background = 'transparent'; }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: employeeFilter === emp._id ? '600' : '400',
                                cursor: 'pointer',
                                color: employeeFilter === emp._id ? '#1877f2' : '#334155',
                                background: employeeFilter === emp._id ? '#eff6ff' : 'transparent',
                                marginBottom: '2px',
                                transition: 'background 0.15s'
                              }}
                            >
                              {emp.firstName} {emp.lastName} <span style={{ fontSize: '11px', color: '#64748b' }}>({emp.employeeId})</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Employee Documents Table with Pagination & Uploaded By Column */}
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              marginBottom: '20px'
            }}>
              {filteredDocuments.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                  </div>
                  <h3 style={{ fontSize: '14px', color: '#0f172a', marginBottom: '4px', fontWeight: 600 }}>No Documents Found</h3>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>No employee documents match your current filter parameters.</p>
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '920px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          {['#', 'Document', 'Category', 'Employee', 'Uploaded By', 'Status', 'Uploaded Date', 'Actions'].map((label) => (
                            <th
                              key={label}
                              style={{
                                textAlign: label === 'Actions' ? 'center' : 'left',
                                padding: '14px 18px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const grouped = filteredDocuments.reduce((acc, doc) => {
                            const targetUser = doc.user || doc.uploadedBy;
                            const id = targetUser?._id || 'unknown';
                            if (!acc[id]) acc[id] = { employee: targetUser, docs: [] };
                            acc[id].docs.push(doc);
                            return acc;
                          }, {});

                          const groups = Object.values(grouped);
                          if (groups.length === 0) {
                            return (
                              <tr>
                                <td colSpan={8} style={{ padding: '28px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>No documents found</td>
                              </tr>
                            );
                          }

                          const paginatedGroups = groups.slice((employeeCurrentPage - 1) * ITEMS_PER_PAGE, employeeCurrentPage * ITEMS_PER_PAGE);

                          return paginatedGroups.map((grp, gIdx) => {
                            const globalIdx = ((employeeCurrentPage - 1) * ITEMS_PER_PAGE) + gIdx + 1;
                            const docs = grp.docs || [];
                            const latest = docs.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b, docs[0]);
                            const pendingCount = docs.filter(d => d.status === 'pending').length;
                            const count = docs.length;
                            const first = docs[0] || {};
                            const categories = Array.from(new Set(docs.map(d => d.category || 'Other')));
                            const uploaderName = first.uploadedBy ? `${first.uploadedBy.firstName || ''} ${first.uploadedBy.lastName || ''}`.trim() || first.uploadedBy.email : 'System';

                            return (
                              <tr key={grp.employee?._id || gIdx} style={{ borderBottom: '1px solid #f1f5f9', background: gIdx % 2 === 0 ? '#fff' : '#fafcfd' }}>
                                <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '13px', width: '48px' }}>{globalIdx}</td>

                                {/* Document Title & Description */}
                                <td style={{ padding: '14px 18px', maxWidth: '300px' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>
                                      {first.title || 'Untitled document'}
                                      {count > 1 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#6366f1', background: '#eef2ff', padding: '2px 7px', borderRadius: '10px' }}>+{count - 1} more</span>}
                                    </span>
                                    <span style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{first.description || 'No description provided'}</span>
                                  </div>
                                </td>

                                {/* Category */}
                                <td style={{ padding: '14px 18px', color: '#334155', fontSize: '13px' }}>
                                  {categories.length === 1 ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: '#f1f5f9', color: '#475569', fontSize: '12px', fontWeight: 500 }}>
                                      {getCategoryIconSvg(categories[0])} {categories[0]}
                                    </span>
                                  ) : 'Multiple Categories'}
                                </td>

                                {/* Employee */}
                                <td style={{ padding: '14px 18px', color: '#0f172a', fontSize: '13px', fontWeight: 600 }}>
                                  {grp.employee ? `${grp.employee.firstName} ${grp.employee.lastName}` : 'N/A'}
                                </td>

                                {/* Uploaded By */}
                                <td style={{ padding: '14px 18px', color: '#334155', fontSize: '13px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontSize: '12.5px', fontWeight: 500 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                      <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    {uploaderName}
                                  </span>
                                </td>

                                {/* Status */}
                                <td style={{ padding: '14px 18px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 12px',
                                    borderRadius: '20px',
                                    background: pendingCount > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.1)',
                                    color: pendingCount > 0 ? '#b45309' : '#047857',
                                    fontSize: '12px',
                                    fontWeight: 600
                                  }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pendingCount > 0 ? '#f59e0b' : '#10b981' }} />
                                    {pendingCount > 0 ? `Pending (${pendingCount})` : `Approved (${count})`}
                                  </span>
                                </td>

                                {/* Uploaded Date */}
                                <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '12.5px' }}>
                                  {latest ? formatDocumentDate(latest.createdAt) : 'N/A'}
                                </td>

                                {/* Actions */}
                                <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleViewEmployee(grp.employee, docs)}
                                    title={`View ${count} document${count > 1 ? 's' : ''}`}
                                    style={{
                                      width: '36px',
                                      height: '36px',
                                      borderRadius: '10px',
                                      border: '1px solid #dbeafe',
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      position: 'relative',
                                      transition: 'all 0.2s',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1d4ed8'; e.currentTarget.style.borderColor = '#dbeafe'; }}
                                  >
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    {count > 1 && (
                                      <span style={{
                                        position: 'absolute',
                                        top: '-4px',
                                        right: '-4px',
                                        background: '#3b82f6',
                                        color: '#ffffff',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        border: '2px solid #ffffff',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                                      }}>
                                        {count}
                                      </span>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Employee Pagination Footer */}
                  {(() => {
                    const grouped = filteredDocuments.reduce((acc, doc) => {
                      const targetUser = doc.user || doc.uploadedBy;
                      const id = targetUser?._id || 'unknown';
                      if (!acc[id]) acc[id] = { employee: targetUser, docs: [] };
                      acc[id].docs.push(doc);
                      return acc;
                    }, {});
                    const totalGroups = Object.values(grouped).length;
                    const totalPages = Math.ceil(totalGroups / ITEMS_PER_PAGE) || 1;

                    if (totalGroups <= 0) return null;

                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 20px',
                        borderTop: '1px solid #f1f5f9',
                        background: '#fafafa',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
                          Showing {((employeeCurrentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(employeeCurrentPage * ITEMS_PER_PAGE, totalGroups)} of {totalGroups} employee records
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setEmployeeCurrentPage(p => Math.max(1, p - 1))}
                            disabled={employeeCurrentPage === 1}
                            style={{
                              width: '30px', height: '30px', borderRadius: '8px',
                              background: employeeCurrentPage === 1 ? '#f1f5f9' : '#eff6ff',
                              border: '1px solid #dbeafe',
                              cursor: employeeCurrentPage === 1 ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s', outline: 'none',
                              opacity: employeeCurrentPage === 1 ? 0.5 : 1
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="15 18 9 12 15 6" />
                            </svg>
                          </button>

                          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (employeeCurrentPage <= 3) pageNum = i + 1;
                            else if (employeeCurrentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = employeeCurrentPage - 2 + i;

                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setEmployeeCurrentPage(pageNum)}
                                style={{
                                  width: '30px', height: '30px', borderRadius: '8px',
                                  background: employeeCurrentPage === pageNum ? '#1877f2' : '#ffffff',
                                  border: employeeCurrentPage === pageNum ? 'none' : '1px solid #e2e8f0',
                                  cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.2s', outline: 'none',
                                  fontSize: '12px', fontWeight: '700',
                                  color: employeeCurrentPage === pageNum ? '#ffffff' : '#475569'
                                }}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          {totalPages > 5 && employeeCurrentPage < totalPages - 2 && (
                            <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: '12px', fontWeight: '700' }}>...</span>
                          )}
                          {totalPages > 5 && employeeCurrentPage < totalPages - 2 && (
                            <button
                              type="button"
                              onClick={() => setEmployeeCurrentPage(totalPages)}
                              style={{
                                width: '30px', height: '30px', borderRadius: '8px',
                                background: '#ffffff', border: '1px solid #e2e8f0',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: '700', color: '#475569'
                              }}
                            >
                              {totalPages}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setEmployeeCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={employeeCurrentPage === totalPages}
                            style={{
                              width: '30px', height: '30px', borderRadius: '8px',
                              background: employeeCurrentPage === totalPages ? '#f1f5f9' : '#eff6ff',
                              border: '1px solid #dbeafe',
                              cursor: employeeCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s', outline: 'none',
                              opacity: employeeCurrentPage === totalPages ? 0.5 : 1
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* ── TAB 2: CLIENT DOCUMENTS ───────────────────────────────── */}
        {/* ───────────────────────────────────────────────────────────── */}
        {activeTab === 'client' && (
          <div>
            {/* Top Metric Cards — Dynamic Real-Time Sparklines */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              {/* 1. Total Client Docs */}
              <div
                style={{
                  background: 'white',
                  padding: '16px 18px 12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  position: 'relative'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  position: 'absolute',
                  right: '-15px',
                  bottom: '-15px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                    Total Client Files
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(99,102,241,0.12)', color: '#4f46e5' }}>
                    Client Attachments
                  </span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#1e293b', lineHeight: 1, marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                  {totalClientDocs}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>All client uploads</span>
                  <Sparkline data={getDynamicSparklineData(clientDocuments)} color="#6366f1" />
                </div>
              </div>

              {/* 2. Aadhar Cards */}
              <div
                style={{
                  background: 'white',
                  padding: '16px 18px 12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  position: 'relative'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  position: 'absolute',
                  right: '-15px',
                  bottom: '-15px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <circle cx="9" cy="10" r="2" />
                      <path d="M15 8h2" />
                      <path d="M15 12h2" />
                    </svg>
                    Aadhar Cards
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(59,130,246,0.12)', color: '#1d4ed8' }}>
                    Identity Proof
                  </span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#3b82f6', lineHeight: 1, marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                  {aadharCount}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Aadhar records</span>
                  <Sparkline data={getDynamicSparklineData(clientDocuments, d => d.category === 'Aadhar Card')} color="#3b82f6" />
                </div>
              </div>

              {/* 3. PAN Cards */}
              <div
                style={{
                  background: 'white',
                  padding: '16px 18px 12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  position: 'relative'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  position: 'absolute',
                  right: '-15px',
                  bottom: '-15px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(147,51,234,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                    PAN Cards
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(147,51,234,0.12)', color: '#6b21a8' }}>
                    Tax ID
                  </span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#9333ea', lineHeight: 1, marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                  {panCount}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>PAN registrations</span>
                  <Sparkline data={getDynamicSparklineData(clientDocuments, d => d.category === 'PAN Card')} color="#9333ea" />
                </div>
              </div>

              {/* 4. Agreements & Receipts */}
              <div
                style={{
                  background: 'white',
                  padding: '16px 18px 12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  transition: 'all 0.3s',
                  position: 'relative'
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              >
                <div style={{
                  position: 'absolute',
                  right: '-15px',
                  bottom: '-15px',
                  width: '100px',
                  height: '100px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Agreements & Receipts
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: 'rgba(16,185,129,0.12)', color: '#047857' }}>
                    Contracts
                  </span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: '#10b981', lineHeight: 1, marginBottom: '10px', position: 'relative', zIndex: 1 }}>
                  {agreementCount + receiptsCount}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '8px', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>{agreementCount} Agreements, {receiptsCount} Receipts</span>
                  <Sparkline data={getDynamicSparklineData(clientDocuments, d => d.category === 'Agreement' || d.category === 'Receipts')} color="#10b981" />
                </div>
              </div>
            </div>

            {/* Quick Category Action Pills & Single Upload Button */}
            <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setClientCategoryFilter('all')}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: clientCategoryFilter === 'all' ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: clientCategoryFilter === 'all' ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
                    color: clientCategoryFilter === 'all' ? '#fff' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  All ({totalClientDocs})
                </button>
                <button
                  type="button"
                  onClick={() => setClientCategoryFilter('Aadhar Card')}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: clientCategoryFilter === 'Aadhar Card' ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: clientCategoryFilter === 'Aadhar Card' ? '#3b82f6' : '#fff',
                    color: clientCategoryFilter === 'Aadhar Card' ? '#fff' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Aadhar ({aadharCount})
                </button>
                <button
                  type="button"
                  onClick={() => setClientCategoryFilter('PAN Card')}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: clientCategoryFilter === 'PAN Card' ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: clientCategoryFilter === 'PAN Card' ? '#9333ea' : '#fff',
                    color: clientCategoryFilter === 'PAN Card' ? '#fff' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  PAN ({panCount})
                </button>
                <button
                  type="button"
                  onClick={() => setClientCategoryFilter('Agreement')}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: clientCategoryFilter === 'Agreement' ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: clientCategoryFilter === 'Agreement' ? '#10b981' : '#fff',
                    color: clientCategoryFilter === 'Agreement' ? '#fff' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Agreement ({agreementCount})
                </button>
                <button
                  type="button"
                  onClick={() => setClientCategoryFilter('Receipts')}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    border: clientCategoryFilter === 'Receipts' ? 'none' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: clientCategoryFilter === 'Receipts' ? '#f59e0b' : '#fff',
                    color: clientCategoryFilter === 'Receipts' ? '#fff' : '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Receipts ({receiptsCount})
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setClientUploadFormData({ clientId: '', category: 'Aadhar Card', title: '', description: '', file: null });
                  setShowClientUploadModal(true);
                }}
                style={{
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: 'none',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                  color: '#fff',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(59,119,94,0.3)',
                  transition: 'all 0.2s'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Upload Document
              </button>
            </div>

            {/* ── Search & Filter Controls Panel ── */}
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '18px 20px',
              marginBottom: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12.5px', color: '#475569' }}>
                    Search Client Documents
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by client, title, category..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    style={{ borderRadius: '8px', padding: '9px 12px', fontSize: '13px' }}
                  />
                </div>

                {/* Filter by Client Dropdown */}
                <div className="custom-client-dropdown" style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12.5px', color: '#475569' }}>
                    Filter by Client
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowClientDropdown(!showClientDropdown); setShowClientCategoryDropdown(false); }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: showClientDropdown ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#0f172a'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                      {clientFilter === 'all' ? 'All Clients' : (() => {
                        const c = clients.find(cl => cl._id === clientFilter);
                        return c ? (c.name || c.company || 'Selected Client') : 'All Clients';
                      })()}
                    </span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showClientDropdown ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showClientDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: '100%',
                      background: '#ffffff',
                      borderRadius: '10px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      zIndex: 300,
                      padding: '8px',
                      border: '1px solid #f1f5f9'
                    }}>
                      <input
                        type="text"
                        placeholder="Search clients..."
                        value={clientSearchText}
                        onChange={(e) => setClientSearchText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          background: '#f8fafc',
                          outline: 'none',
                          marginBottom: '6px'
                        }}
                      />
                      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        <div
                          onClick={() => { setClientFilter('all'); setShowClientDropdown(false); setClientSearchText(''); }}
                          onMouseEnter={(e) => { if (clientFilter !== 'all') e.currentTarget.style.background = '#f1f5f9'; }}
                          onMouseLeave={(e) => { if (clientFilter !== 'all') e.currentTarget.style.background = 'transparent'; }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: clientFilter === 'all' ? '600' : '400',
                            cursor: 'pointer',
                            background: clientFilter === 'all' ? '#eff6ff' : 'transparent',
                            color: clientFilter === 'all' ? '#1877f2' : '#334155',
                            marginBottom: '2px',
                            transition: 'background 0.15s'
                          }}
                        >
                          All Clients
                        </div>
                        {clients
                          .filter(c => `${c.name || ''} ${c.company || ''}`.toLowerCase().includes(clientSearchText.toLowerCase()))
                          .map(c => (
                            <div
                              key={c._id}
                              onClick={() => { setClientFilter(c._id); setShowClientDropdown(false); setClientSearchText(''); }}
                              onMouseEnter={(e) => { if (clientFilter !== c._id) e.currentTarget.style.background = '#f1f5f9'; }}
                              onMouseLeave={(e) => { if (clientFilter !== c._id) e.currentTarget.style.background = 'transparent'; }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: clientFilter === c._id ? '600' : '400',
                                cursor: 'pointer',
                                background: clientFilter === c._id ? '#eff6ff' : 'transparent',
                                color: clientFilter === c._id ? '#1877f2' : '#334155',
                                marginBottom: '2px',
                                transition: 'background 0.15s'
                              }}
                            >
                              {c.name || 'Unnamed'} {c.company ? `(${c.company})` : ''}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Filter by Category Dropdown */}
                <div className="custom-client-category-dropdown" style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12.5px', color: '#475569' }}>
                    Filter by Category
                  </label>
                  <button
                    type="button"
                    onClick={() => { setShowClientCategoryDropdown(!showClientCategoryDropdown); setShowClientDropdown(false); }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      border: showClientCategoryDropdown ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      background: '#fff',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: '#0f172a'
                    }}
                  >
                    <span>
                      {clientCategoryFilter === 'all' ? 'All Categories' : clientCategoryFilter}
                    </span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showClientCategoryDropdown ? 'rotate(180deg)' : 'none' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showClientCategoryDropdown && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      width: '100%',
                      background: '#ffffff',
                      borderRadius: '10px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                      zIndex: 300,
                      padding: '8px',
                      border: '1px solid #f1f5f9'
                    }}>
                      <input
                        type="text"
                        placeholder="Search categories..."
                        value={clientCategorySearchText}
                        onChange={(e) => setClientCategorySearchText(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          background: '#f8fafc',
                          outline: 'none',
                          marginBottom: '6px'
                        }}
                      />
                      <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {['all', 'Aadhar Card', 'PAN Card', 'Agreement', 'Receipts', 'Other']
                          .filter(cat => cat.toLowerCase().includes(clientCategorySearchText.toLowerCase()))
                          .map(cat => (
                            <div
                              key={cat}
                              onClick={() => { setClientCategoryFilter(cat); setShowClientCategoryDropdown(false); setClientCategorySearchText(''); }}
                              onMouseEnter={(e) => { if (clientCategoryFilter !== cat) e.currentTarget.style.background = '#f1f5f9'; }}
                              onMouseLeave={(e) => { if (clientCategoryFilter !== cat) e.currentTarget.style.background = 'transparent'; }}
                              style={{
                                padding: '8px 10px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: clientCategoryFilter === cat ? '600' : '400',
                                cursor: 'pointer',
                                background: clientCategoryFilter === cat ? '#eff6ff' : 'transparent',
                                color: clientCategoryFilter === cat ? '#1877f2' : '#334155',
                                marginBottom: '2px',
                                transition: 'background 0.15s'
                              }}
                            >
                              {cat === 'all' ? 'All Categories' : cat}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Client Documents Table with Pagination ── */}
            <div style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
              marginBottom: '20px'
            }}>
              {filteredClientDocuments.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                  </div>
                  <h3 style={{ fontSize: '14px', color: '#0f172a', marginBottom: '4px', fontWeight: 600 }}>No Client Documents Found</h3>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>No client documents uploaded yet or matching your filter selection.</p>
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '860px' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          {['#', 'Client / Company', 'Document Title', 'Category', 'Uploaded By', 'Uploaded Date', 'Actions'].map((label) => (
                            <th
                              key={label}
                              style={{
                                textAlign: label === 'Actions' ? 'center' : 'left',
                                padding: '14px 18px',
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClientDocuments
                          .slice((clientCurrentPage - 1) * ITEMS_PER_PAGE, clientCurrentPage * ITEMS_PER_PAGE)
                          .map((doc, idx) => {
                            const globalIdx = ((clientCurrentPage - 1) * ITEMS_PER_PAGE) + idx + 1;
                            const clientName = doc.client ? (doc.client.name || doc.client.company || 'Client') : 'N/A';
                            const clientComp = doc.client?.company && doc.client?.name !== doc.client?.company ? doc.client.company : '';
                            const badgeStyle = getCategoryBadgeStyle(doc.category);
                            const uploaderName = doc.uploadedBy ? `${doc.uploadedBy.firstName || ''} ${doc.uploadedBy.lastName || ''}`.trim() || doc.uploadedBy.email : 'System';

                            return (
                              <tr key={doc._id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#fff' : '#fafcfd' }}>
                                <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '13px', width: '48px' }}>{globalIdx}</td>

                                {/* Client Name Pill Badge */}
                                <td style={{ padding: '14px 18px', maxWidth: '240px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenClientDetails(doc.client)}
                                    title="Click to view complete client details"
                                    style={{
                                      border: '1px solid #c7d2fe',
                                      background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                                      color: '#3730a3',
                                      borderRadius: '20px',
                                      padding: '6px 14px',
                                      fontSize: '12.5px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      transition: 'all 0.2s',
                                      outline: 'none',
                                      boxShadow: '0 1px 2px rgba(99,102,241,0.08)'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#4f46e5'; e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = '#4f46e5'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)'; e.currentTarget.style.color = '#3730a3'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                                  >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                      <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    {clientName}
                                  </button>
                                  {clientComp && (
                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', paddingLeft: '4px' }}>
                                      {clientComp}
                                    </div>
                                  )}
                                </td>

                                {/* Title & Filename */}
                                <td style={{ padding: '14px 18px', maxWidth: '280px' }}>
                                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                                    {doc.title || doc.filename}
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                    {doc.filename}
                                  </div>
                                </td>

                                {/* Category Badge */}
                                <td style={{ padding: '14px 18px' }}>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 12px',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    ...badgeStyle
                                  }}>
                                    {getCategoryIconSvg(doc.category)}
                                    {doc.category}
                                  </span>
                                </td>

                                {/* Uploaded By */}
                                <td style={{ padding: '14px 18px', color: '#334155', fontSize: '13px' }}>
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontSize: '12px', fontWeight: 500 }}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                      <circle cx="12" cy="7" r="4" />
                                    </svg>
                                    {uploaderName}
                                  </span>
                                </td>

                                {/* Uploaded Date */}
                                <td style={{ padding: '14px 18px', color: '#64748b', fontSize: '12.5px' }}>
                                  {formatDocumentDate(doc.createdAt)}
                                </td>

                                {/* Actions */}
                                <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                    <button
                                      type="button"
                                      onClick={() => handleViewClientDoc(doc)}
                                      title="View Document"
                                      style={{
                                        width: '34px',
                                        height: '34px',
                                        borderRadius: '8px',
                                        border: '1px solid #dbeafe',
                                        background: '#eff6ff',
                                        color: '#1d4ed8',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1d4ed8'; e.currentTarget.style.borderColor = '#dbeafe'; }}
                                    >
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDownloadClientDoc(doc._id, doc.filename)}
                                      title="Download Document"
                                      style={{
                                        width: '34px',
                                        height: '34px',
                                        borderRadius: '8px',
                                        border: '1px solid #d1fae5',
                                        background: '#ecfdf5',
                                        color: '#047857',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#10b981'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#047857'; e.currentTarget.style.borderColor = '#d1fae5'; }}
                                    >
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteClientDoc(doc._id)}
                                      title="Delete Document"
                                      style={{
                                        width: '34px',
                                        height: '34px',
                                        borderRadius: '8px',
                                        border: '1px solid rgba(239,68,68,0.25)',
                                        background: 'rgba(239,68,68,0.08)',
                                        color: '#b91c1c',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                                      }}
                                      onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#dc2626'; }}
                                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#b91c1c'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; }}
                                    >
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {/* Client Pagination Footer */}
                  {(() => {
                    const totalDocs = filteredClientDocuments.length;
                    const totalPages = Math.ceil(totalDocs / ITEMS_PER_PAGE) || 1;

                    if (totalDocs <= 0) return null;

                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 20px',
                        borderTop: '1px solid #f1f5f9',
                        background: '#fafafa',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}>
                        <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
                          Showing {((clientCurrentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(clientCurrentPage * ITEMS_PER_PAGE, totalDocs)} of {totalDocs} client documents
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setClientCurrentPage(p => Math.max(1, p - 1))}
                            disabled={clientCurrentPage === 1}
                            style={{
                              width: '30px', height: '30px', borderRadius: '8px',
                              background: clientCurrentPage === 1 ? '#f1f5f9' : '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              cursor: clientCurrentPage === 1 ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s', outline: 'none',
                              opacity: clientCurrentPage === 1 ? 0.5 : 1
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="15 18 9 12 15 6" />
                            </svg>
                          </button>

                          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) pageNum = i + 1;
                            else if (clientCurrentPage <= 3) pageNum = i + 1;
                            else if (clientCurrentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                            else pageNum = clientCurrentPage - 2 + i;

                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => setClientCurrentPage(pageNum)}
                                style={{
                                  width: '30px', height: '30px', borderRadius: '8px',
                                  background: clientCurrentPage === pageNum ? '#10b981' : '#ffffff',
                                  border: clientCurrentPage === pageNum ? 'none' : '1px solid #e2e8f0',
                                  cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.2s', outline: 'none',
                                  fontSize: '12px', fontWeight: '700',
                                  color: clientCurrentPage === pageNum ? '#ffffff' : '#475569'
                                }}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          {totalPages > 5 && clientCurrentPage < totalPages - 2 && (
                            <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: '12px', fontWeight: '700' }}>...</span>
                          )}
                          {totalPages > 5 && clientCurrentPage < totalPages - 2 && (
                            <button
                              type="button"
                              onClick={() => setClientCurrentPage(totalPages)}
                              style={{
                                width: '30px', height: '30px', borderRadius: '8px',
                                background: '#ffffff', border: '1px solid #e2e8f0',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: '700', color: '#475569'
                              }}
                            >
                              {totalPages}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setClientCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={clientCurrentPage === totalPages}
                            style={{
                              width: '30px', height: '30px', borderRadius: '8px',
                              background: clientCurrentPage === totalPages ? '#f1f5f9' : '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              cursor: clientCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.2s', outline: 'none',
                              opacity: clientCurrentPage === totalPages ? 0.5 : 1
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* ── MODALS SECTION ────────────────────────────────────────── */}
        {/* ───────────────────────────────────────────────────────────── */}

        {/* ── Client Details Card Modal ── */}
        {selectedClientDetails && createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '20px',
              overflowY: 'auto'
            }}
            onClick={() => setSelectedClientDetails(null)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '840px',
                borderRadius: '20px',
                background: '#fff',
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(15,23,42,0.2)',
                maxHeight: 'calc(100vh - 40px)',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '22px 26px',
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 700
                  }}>
                    {selectedClientDetails.name ? selectedClientDetails.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                        {selectedClientDetails.name || 'Client Details'}
                      </h2>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: selectedClientDetails.status === 'Inactive' ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)',
                        color: selectedClientDetails.status === 'Inactive' ? '#fca5a5' : '#6ee7b7',
                        border: selectedClientDetails.status === 'Inactive' ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(16,185,129,0.4)'
                      }}>
                        {selectedClientDetails.status || 'Active'}
                      </span>
                    </div>
                    {selectedClientDetails.company && (
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#a7f3d0' }}>
                        🏢 {selectedClientDetails.company}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClientDetails(null)}
                  style={{ border: 'none', background: 'transparent', fontSize: '26px', color: '#a7f3d0', cursor: 'pointer', padding: '0 8px' }}
                >
                  ×
                </button>
              </div>

              {/* Modal Content Body */}
              <div style={{ padding: '24px 26px', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column', gap: '22px' }}>

                {/* Info Grid */}
                {(() => {
                  const formatPhoneVal = (phone, countryCode = '+91') => {
                    if (!phone || phone === 'N/A' || phone === '-') return 'N/A';
                    const cleanPhone = String(phone).trim();
                    if (!cleanPhone) return 'N/A';
                    if (cleanPhone.startsWith('+')) return cleanPhone;
                    const code = (countryCode || '+91').trim();
                    return `${code} ${cleanPhone}`;
                  };

                  const formatAddressVal = (addr) => {
                    if (!addr) return 'N/A';
                    if (typeof addr === 'string') return addr.trim() || 'N/A';
                    const parts = [addr.city, addr.state, addr.country].filter(p => p && String(p).trim() && String(p).trim() !== 'N/A').join(', ');
                    const postal = addr.postalCode ? ` - ${addr.postalCode}` : '';
                    const full = (parts + postal).trim();
                    return full || 'N/A';
                  };

                  const rawCompany = selectedClientDetails.company ? String(selectedClientDetails.company).trim() : '';
                  const hasCompany = Boolean(
                    rawCompany &&
                    rawCompany.toUpperCase() !== 'N/A' &&
                    rawCompany !== '-'
                  );

                  const personalAddr = formatAddressVal(selectedClientDetails.personalAddress);
                  const companyAddr = formatAddressVal(selectedClientDetails.companyAddress);

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: hasCompany ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr', gap: '16px' }}>

                      {/* Card 1: Contact Details */}
                      <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px 18px', border: '1px solid #e2e8f0' }}>
                        <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                          Contact Details
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                          <div><strong style={{ color: '#64748b' }}>Personal Email:</strong> <span style={{ color: '#0f172a' }}>{selectedClientDetails.personalEmail || selectedClientDetails.email || 'N/A'}</span></div>
                          <div><strong style={{ color: '#64748b' }}>Phone:</strong> <span style={{ color: '#0f172a' }}>{formatPhoneVal(selectedClientDetails.phone, selectedClientDetails.phoneCountryCode)}</span></div>
                          <div><strong style={{ color: '#64748b' }}>Alternate Number:</strong> <span style={{ color: '#0f172a' }}>{formatPhoneVal(selectedClientDetails.alternatePhone, selectedClientDetails.altPhoneCountryCode)}</span></div>
                          <div><strong style={{ color: '#64748b' }}>Address:</strong> <span style={{ color: '#0f172a' }}>{personalAddr}</span></div>
                        </div>
                      </div>

                      {/* Card 2: Company Details (only if company exists) */}
                      {hasCompany && (
                        <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '16px 18px', border: '1px solid #e2e8f0' }}>
                          <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>
                            Company Details
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                            <div><strong style={{ color: '#64748b' }}>Company Name:</strong> <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedClientDetails.company}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Phone:</strong> <span style={{ color: '#0f172a' }}>{formatPhoneVal(selectedClientDetails.companyContactNo || selectedClientDetails.phone, selectedClientDetails.companyContactCode)}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Alternate Number:</strong> <span style={{ color: '#0f172a' }}>{formatPhoneVal(selectedClientDetails.companyAltNo, selectedClientDetails.companyAltCode)}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Company Mail:</strong> <span style={{ color: '#0f172a' }}>{selectedClientDetails.businessEmail || selectedClientDetails.companyEmail || selectedClientDetails.email || 'N/A'}</span></div>
                            <div><strong style={{ color: '#64748b' }}>GST:</strong> <span style={{ color: '#0f172a' }}>{selectedClientDetails.gstNo || selectedClientDetails.registrationNo || selectedClientDetails.gst || 'N/A'}</span></div>
                            <div><strong style={{ color: '#64748b' }}>Address:</strong> <span style={{ color: '#0f172a' }}>{companyAddr}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Associated Client Documents Section */}
                <div>
                  <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Uploaded Client Documents</span>
                    <span style={{ fontSize: '12px', background: '#f1f5f9', color: '#475569', padding: '2px 10px', borderRadius: '12px', fontWeight: 700, border: '1px solid #e2e8f0' }}>
                      {clientDocuments.filter(d => d.client?._id === selectedClientDetails._id).length} Files
                    </span>
                  </h4>

                  {clientDocuments.filter(d => d.client?._id === selectedClientDetails._id).length === 0 ? (
                    <div style={{ padding: '20px', color: '#64748b', fontSize: '13px', background: '#f8fafc', borderRadius: '12px', textAlign: 'center' }}>
                      No documents uploaded for this client yet.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {clientDocuments
                        .filter(d => d.client?._id === selectedClientDetails._id)
                        .map(doc => (
                          <div key={doc._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                                {getCategoryIconSvg(doc.category)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>{doc.title || doc.filename}</div>
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>{doc.category} • Uploaded {formatDocumentDate(doc.createdAt)}</div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => { setSelectedClientDetails(null); handleViewClientDoc(doc); }}
                                style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadClientDoc(doc._id, doc.filename)}
                                style={{ border: '1px solid #d1fae5', background: '#ecfdf5', color: '#047857', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div style={{ padding: '16px 26px', borderTop: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setSelectedClientDetails(null)}
                  style={{
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                    color: '#334155',
                    borderRadius: '10px',
                    padding: '9px 20px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── View Employee Document Modal ── */}
        {viewDocument && createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '20px',
              overflowY: 'auto'
            }}
            onClick={closeViewDocument}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '960px',
                borderRadius: '18px',
                background: '#fff',
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(15,23,42,0.18)',
                maxHeight: 'calc(100vh - 40px)',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '22px 24px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>View Document</h2>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>Document details for the selected employee file.</p>
                </div>
                <button
                  onClick={closeViewDocument}
                  style={{ border: 'none', background: 'transparent', fontSize: '24px', color: '#64748b', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(360px, 1.2fr)', gap: '22px', overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {['Title', 'Category', 'Description', 'Employee', 'Uploaded By', 'Status', 'Uploaded Date'].map((label) => {
                    const valueMap = {
                      Title: viewDocument.title || 'Untitled document',
                      Category: viewDocument.category || 'Other',
                      Description: viewDocument.description || 'No description provided',
                      Employee: viewDocument.user ? `${viewDocument.user.firstName || ''} ${viewDocument.user.lastName || ''}`.trim() : (viewDocument.uploadedBy ? `${viewDocument.uploadedBy.firstName || ''} ${viewDocument.uploadedBy.lastName || ''}`.trim() : 'N/A'),
                      'Uploaded By': viewDocument.uploadedBy ? `${viewDocument.uploadedBy.firstName || ''} ${viewDocument.uploadedBy.lastName || ''}`.trim() || viewDocument.uploadedBy.email : 'System',
                      Status: viewDocument.status || 'Unknown',
                      'Uploaded Date': formatDocumentDate(viewDocument.createdAt)
                    };
                    return (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px', alignItems: 'start' }}>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>{label}</strong>
                        <span style={{ color: '#0f172a', fontSize: '13px', lineHeight: 1.6 }}>{valueMap[label]}</span>
                      </div>
                    );
                  })}

                  {canApprove && viewDocument?.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(viewDocument._id, 'approved')}
                        style={{
                          border: '1px solid #a7f3d0',
                          background: '#d1fae5',
                          color: '#065f46',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(viewDocument._id, 'rejected')}
                        style={{
                          border: '1px solid rgba(239,68,68,0.2)',
                          background: 'rgba(239,68,68,0.12)',
                          color: '#b91c1c',
                          borderRadius: '10px',
                          padding: '10px 14px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                        Reject
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <strong style={{ fontSize: '13px', color: '#475569' }}>Preview</strong>
                  <div style={{
                    minHeight: '320px',
                    borderRadius: '16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px'
                  }}>
                    {viewLoading ? (
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Loading file preview...</span>
                    ) : viewDocumentUrl && (viewDocumentMime?.includes('pdf') || viewDocument.mimetype?.includes('pdf') || viewDocument.filename?.toLowerCase().endsWith('.pdf') || viewDocument.category?.toLowerCase().includes('pdf') || viewDocument.title?.toLowerCase().endsWith('.pdf')) ? (
                      <iframe
                        title="Document Preview"
                        src={viewDocumentUrl}
                        style={{ width: '100%', height: '100%', border: 'none', minHeight: '380px', borderRadius: '6px' }}
                        allowFullScreen
                      />
                    ) : viewDocumentUrl && (viewDocumentMime?.startsWith('image/') || viewDocument.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(viewDocument.filename || '') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(viewDocument.title || '')) ? (
                      <img
                        src={viewDocumentUrl}
                        alt={viewDocument.filename || viewDocument.title}
                        style={{ width: '100%', height: 'auto', maxHeight: '520px', objectFit: 'contain', borderRadius: '6px' }}
                      />
                    ) : viewDocumentUrl ? (
                      <iframe
                        title="Document Preview"
                        src={viewDocumentUrl}
                        style={{ width: '100%', height: '100%', border: 'none', minHeight: '380px', borderRadius: '6px' }}
                      />
                    ) : (
                      <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>
                        Unable to load preview. Please download the file to view it.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 24px', borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={closeViewDocument}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#475569',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleDownload(viewDocument._id, viewDocument.filename);
                    closeViewDocument();
                  }}
                  style={{
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Download
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── View Client Document Modal ── */}
        {viewClientDocument && createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '20px',
              overflowY: 'auto'
            }}
            onClick={closeViewClientDocument}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '960px',
                borderRadius: '18px',
                background: '#fff',
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(15,23,42,0.18)',
                maxHeight: 'calc(100vh - 40px)',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '22px 24px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>View Client Document</h2>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>Document details for the selected client file.</p>
                </div>
                <button
                  onClick={closeViewClientDocument}
                  style={{ border: 'none', background: 'transparent', fontSize: '24px', color: '#64748b', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(360px, 1.2fr)', gap: '22px', overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {['Client', 'Title', 'Category', 'Description', 'Uploaded By', 'Uploaded Date'].map((label) => {
                    const valueMap = {
                      Client: viewClientDocument.client ? (viewClientDocument.client.name || viewClientDocument.client.company || 'Client') : 'N/A',
                      Title: viewClientDocument.title || 'Untitled document',
                      Category: viewClientDocument.category || 'Other',
                      Description: viewClientDocument.description || 'No description provided',
                      'Uploaded By': viewClientDocument.uploadedBy ? `${viewClientDocument.uploadedBy.firstName || ''} ${viewClientDocument.uploadedBy.lastName || ''}`.trim() || viewClientDocument.uploadedBy.email : 'System',
                      'Uploaded Date': formatDocumentDate(viewClientDocument.createdAt)
                    };
                    return (
                      <div key={label} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '12px', alignItems: 'start' }}>
                        <strong style={{ color: '#64748b', fontSize: '13px' }}>{label}</strong>
                        <span style={{ color: '#0f172a', fontSize: '13px', lineHeight: 1.6 }}>{valueMap[label]}</span>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <strong style={{ fontSize: '13px', color: '#475569' }}>Preview</strong>
                  <div style={{
                    minHeight: '320px',
                    borderRadius: '16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px'
                  }}>
                    {viewClientDocLoading ? (
                      <span style={{ color: '#64748b', fontSize: '13px' }}>Loading file preview...</span>
                    ) : viewClientDocUrl && (viewClientDocMime?.includes('pdf') || viewClientDocument.mimetype?.includes('pdf') || viewClientDocument.filename?.toLowerCase().endsWith('.pdf') || viewClientDocument.category?.toLowerCase().includes('pdf') || viewClientDocument.title?.toLowerCase().endsWith('.pdf')) ? (
                      <iframe
                        title="Client Document Preview"
                        src={viewClientDocUrl}
                        style={{ width: '100%', height: '100%', border: 'none', minHeight: '380px', borderRadius: '6px' }}
                        allowFullScreen
                      />
                    ) : viewClientDocUrl && (viewClientDocMime?.startsWith('image/') || viewClientDocument.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(viewClientDocument.filename || '') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(viewClientDocument.title || '')) ? (
                      <img
                        src={viewClientDocUrl}
                        alt={viewClientDocument.filename || viewClientDocument.title}
                        style={{ width: '100%', height: 'auto', maxHeight: '520px', objectFit: 'contain', borderRadius: '6px' }}
                      />
                    ) : viewClientDocUrl ? (
                      <iframe
                        title="Client Document Preview"
                        src={viewClientDocUrl}
                        style={{ width: '100%', height: '100%', border: 'none', minHeight: '380px', borderRadius: '6px' }}
                      />
                    ) : (
                      <div style={{ color: '#ef4444', fontSize: '13px', textAlign: 'center' }}>
                        Unable to load preview. Please download the file to view it.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px 24px', borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={closeViewClientDocument}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#475569',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    handleDownloadClientDoc(viewClientDocument._id, viewClientDocument.filename);
                    closeViewClientDocument();
                  }}
                  style={{
                    border: 'none',
                    background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                    color: '#fff',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                  Download
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── Employee Group Documents Modal ── */}
        {showEmployeeModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
              overflowY: 'auto'
            }}
            onClick={() => setShowEmployeeModal(false)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '760px',
                borderRadius: '18px',
                background: '#fff',
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(15,23,42,0.18)',
                maxHeight: 'calc(100vh - 40px)',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>{selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : 'Employee'} — Documents</h2>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>All documents uploaded for this employee.</p>
                </div>
                <button
                  onClick={() => setShowEmployeeModal(false)}
                  style={{ border: 'none', background: 'transparent', fontSize: '24px', color: '#64748b', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: '12px 18px', overflowY: 'auto', flex: 1 }}>
                {selectedEmployeeDocs.map((doc) => {
                  const uploaderName = doc.uploadedBy ? `${doc.uploadedBy.firstName || ''} ${doc.uploadedBy.lastName || ''}`.trim() || doc.uploadedBy.email : 'System';

                  return (
                    <div key={doc._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 8px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ width: 42, height: 42, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                          {getCategoryIconSvg(doc.category)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13.5px' }}>{doc.title || 'Untitled document'}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            {doc.category} • Uploaded by <strong style={{ color: '#475569' }}>{uploaderName}</strong> • {formatDocumentDate(doc.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => handleView(doc)}
                          title="View Document"
                          style={{
                            width: '32px',
                            height: '32px',
                            border: '1px solid #dbeafe',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.color = '#1d4ed8'; e.currentTarget.style.borderColor = '#dbeafe'; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownload(doc._id, doc.filename)}
                          title="Download Document"
                          style={{
                            width: '32px',
                            height: '32px',
                            border: '1px solid #d1fae5',
                            background: '#ecfdf5',
                            color: '#047857',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#10b981'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#10b981'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.color = '#047857'; e.currentTarget.style.borderColor = '#d1fae5'; }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        </button>

                        {canApprove && doc.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(doc._id, 'approved')}
                              title="Approve Document"
                              style={{
                                width: '32px',
                                height: '32px',
                                border: '1px solid #a7f3d0',
                                background: '#d1fae5',
                                color: '#065f46',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#059669'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#059669'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#d1fae5'; e.currentTarget.style.color = '#065f46'; e.currentTarget.style.borderColor = '#a7f3d0'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(doc._id, 'rejected')}
                              title="Reject Document"
                              style={{
                                width: '32px',
                                height: '32px',
                                border: '1px solid rgba(239,68,68,0.25)',
                                background: 'rgba(239,68,68,0.08)',
                                color: '#b91c1c',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#ef4444'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#b91c1c'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                            </button>
                          </>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDelete(doc._id)}
                            title="Delete Document"
                            style={{
                              width: '32px',
                              height: '32px',
                              border: '1px solid rgba(239,68,68,0.25)',
                              background: 'rgba(239,68,68,0.08)',
                              color: '#b91c1c',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#dc2626'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = '#b91c1c'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)'; }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: '12px 18px', borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={() => setShowEmployeeModal(false)}
                  style={{
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#475569',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Employee Document Modal ── */}
        {showEditModal && editingDocument && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
            onClick={() => setShowEditModal(false)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: '560px',
                borderRadius: '18px',
                background: '#fff',
                overflow: 'hidden',
                boxShadow: '0 24px 48px rgba(15,23,42,0.18)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '22px 24px', borderBottom: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>Edit Document</h2>
                  <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>Update title, category, or description for this document.</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{ border: 'none', background: 'transparent', fontSize: '24px', color: '#64748b', cursor: 'pointer' }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleUpdate} style={{ padding: '20px 24px', display: 'grid', gap: '16px' }}>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Title</label>
                  <input
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Category</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px' }}
                  >
                    <option value="Address Proof">Address Proof</option>
                    <option value="Educational Certificates">Educational Certificates</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Bank Account">Bank Account</option>
                    <option value="Experience Letter">Experience Letter</option>
                    <option value="Offer Letter">Offer Letter</option>
                    <option value="Relieving Letter">Relieving Letter</option>
                    <option value="Screenshot of Resignation Email">Screenshot of Resignation Email</option>
                    <option value="Two Passport Size Photographs">Two Passport Size Photographs</option>
                    <option value="Last 3 Months' Salary Slips">Last 3 Months' Salary Slips</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Description</label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    rows={4}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '13px', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    style={{
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      color: '#475569',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      border: 'none',
                      background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                      color: '#fff',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Upload Employee Document Modal ── */}
        {showUploadModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setShowUploadModal(false)}
          >
            <div
              className="card"
              style={{
                maxWidth: '650px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
                borderRadius: '16px',
                padding: '24px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#0f172a' }}>
                  Upload Document
                </h2>
                <button
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleUploadForEmployee}>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>
                    Select Employee <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div className="custom-upload-employee-dropdown" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowUploadEmployeeDropdown(!showUploadEmployeeDropdown)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: showUploadEmployeeDropdown ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: uploadFormData.employeeId ? '#0f172a' : '#9ca3af'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                        {uploadFormData.employeeId ? (() => {
                          const emp = employees.find(e => e._id === uploadFormData.employeeId);
                          return emp ? `${emp.firstName} ${emp.lastName}` : 'Choose an employee...';
                        })() : 'Choose an employee...'}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showUploadEmployeeDropdown ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {showUploadEmployeeDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: '100%',
                        background: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        zIndex: 300,
                        padding: '8px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <input
                          type="text"
                          placeholder="Search employees..."
                          value={uploadEmployeeSearchText}
                          onChange={(e) => setUploadEmployeeSearchText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            background: '#f8fafc',
                            outline: 'none',
                            marginBottom: '8px'
                          }}
                        />
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {employees
                            .filter(e => {
                              const search = uploadEmployeeSearchText.toLowerCase();
                              return e.firstName.toLowerCase().includes(search) ||
                                e.lastName.toLowerCase().includes(search) ||
                                (e.employeeId && e.employeeId.toLowerCase().includes(search));
                            })
                            .map(emp => (
                              <div
                                key={emp._id}
                                onClick={() => { setUploadFormData({ ...uploadFormData, employeeId: emp._id }); setShowUploadEmployeeDropdown(false); setUploadEmployeeSearchText(''); }}
                                onMouseEnter={(e) => { if (uploadFormData.employeeId !== emp._id) e.currentTarget.style.background = '#f1f5f9'; }}
                                onMouseLeave={(e) => { if (uploadFormData.employeeId !== emp._id) e.currentTarget.style.background = 'transparent'; }}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: uploadFormData.employeeId === emp._id ? '600' : '400',
                                  cursor: 'pointer',
                                  color: uploadFormData.employeeId === emp._id ? '#166534' : '#334155',
                                  background: uploadFormData.employeeId === emp._id ? '#dcfce7' : 'transparent',
                                  marginBottom: '2px',
                                  transition: 'background 0.15s'
                                }}
                              >
                                {emp.firstName} {emp.lastName} <span style={{ color: '#94a3b8', fontSize: '12px' }}>({emp.employeeId})</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    <input type="hidden" value={uploadFormData.employeeId} required />
                  </div>
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>
                    Document Category <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div className="custom-category-dropdown" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: showCategoryDropdown ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: uploadFormData.category ? '#0f172a' : '#9ca3af'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                        {uploadFormData.category || 'Select Category...'}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showCategoryDropdown ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {showCategoryDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: '100%',
                        background: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        zIndex: 300,
                        padding: '8px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <input
                          type="text"
                          placeholder="Search categories..."
                          value={categorySearchText}
                          onChange={(e) => setCategorySearchText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            background: '#f8fafc',
                            outline: 'none',
                            marginBottom: '8px'
                          }}
                        />
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {['Address Proof', 'Educational Certificates', 'PAN Card', 'Bank Account', 'Experience Letter', 'Offer Letter', 'Relieving Letter', 'Screenshot of Resignation Email', 'Two Passport Size Photographs', "Last 3 Months' Salary Slips", 'Other']
                            .filter(c => c.toLowerCase().includes(categorySearchText.toLowerCase()))
                            .map(cat => (
                              <div
                                key={cat}
                                onClick={() => { setUploadFormData({ ...uploadFormData, category: cat, subCategory: (cat === 'Address Proof' || cat === 'Educational Certificates') ? uploadFormData.subCategory : '' }); setShowCategoryDropdown(false); setCategorySearchText(''); }}
                                onMouseEnter={(e) => { if (uploadFormData.category !== cat) e.currentTarget.style.background = '#f1f5f9'; }}
                                onMouseLeave={(e) => { if (uploadFormData.category !== cat) e.currentTarget.style.background = 'transparent'; }}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: uploadFormData.category === cat ? '600' : '400',
                                  cursor: 'pointer',
                                  color: uploadFormData.category === cat ? '#166534' : '#334155',
                                  background: uploadFormData.category === cat ? '#dcfce7' : 'transparent',
                                  marginBottom: '2px',
                                  transition: 'background 0.15s'
                                }}
                              >
                                {cat}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    <input type="hidden" value={uploadFormData.category} required />
                  </div>
                </div>

                {(uploadFormData.category === 'Address Proof' || uploadFormData.category === 'Educational Certificates') && (
                  <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>
                      Sub Category <span style={{ color: 'red' }}>*</span>
                    </label>
                    <div className="custom-subcategory-dropdown" style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setShowSubCategoryDropdown(!showSubCategoryDropdown)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: showSubCategoryDropdown ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          background: '#fff',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: uploadFormData.subCategory ? '#0f172a' : '#9ca3af'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                          {uploadFormData.subCategory || 'Select Sub Category...'}
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showSubCategoryDropdown ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>

                      {showSubCategoryDropdown && (
                        <div style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          left: 0,
                          width: '100%',
                          background: '#ffffff',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                          zIndex: 300,
                          padding: '8px',
                          border: '1px solid #f1f5f9'
                        }}>
                          <input
                            type="text"
                            placeholder="Search sub categories..."
                            value={subCategorySearchText}
                            onChange={(e) => setSubCategorySearchText(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '13px',
                              background: '#f8fafc',
                              outline: 'none',
                              marginBottom: '8px'
                            }}
                          />
                          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {(uploadFormData.category === 'Address Proof'
                              ? ['Aadhar Card', 'Driving License', 'Voter id card', 'Passport', 'Electricity Bill', 'Wi-Fi Bill']
                              : ['10th Marksheet', '12th Marksheet', 'Graduation', 'Post Graduation'])
                              .filter(c => c.toLowerCase().includes(subCategorySearchText.toLowerCase()))
                              .map(subCat => (
                                <div
                                  key={subCat}
                                  onClick={() => { setUploadFormData({ ...uploadFormData, subCategory: subCat }); setShowSubCategoryDropdown(false); setSubCategorySearchText(''); }}
                                  onMouseEnter={(e) => { if (uploadFormData.subCategory !== subCat) e.currentTarget.style.background = '#f1f5f9'; }}
                                  onMouseLeave={(e) => { if (uploadFormData.subCategory !== subCat) e.currentTarget.style.background = 'transparent'; }}
                                  style={{
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                    fontWeight: uploadFormData.subCategory === subCat ? '600' : '400',
                                    cursor: 'pointer',
                                    color: uploadFormData.subCategory === subCat ? '#166534' : '#334155',
                                    background: uploadFormData.subCategory === subCat ? '#dcfce7' : 'transparent',
                                    marginBottom: '2px',
                                    transition: 'background 0.15s'
                                  }}
                                >
                                  {subCat}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      <input type="hidden" value={uploadFormData.subCategory} required={uploadFormData.category === 'Address Proof' || uploadFormData.category === 'Educational Certificates'} />
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={uploadFormData.title}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, title: e.target.value })}
                    placeholder="Enter document title (optional)"
                    style={{ borderRadius: '8px', padding: '9px 12px' }}
                  />
                </div>

                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>
                    Description
                  </label>
                  <textarea
                    className="form-control"
                    value={uploadFormData.description}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, description: e.target.value })}
                    placeholder="Enter document description (optional)"
                    rows="3"
                    style={{ borderRadius: '8px', padding: '9px 12px' }}
                  />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>
                    Choose File <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    onChange={(e) => setUploadFormData({ ...uploadFormData, file: e.target.files[0] })}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    required
                    style={{ borderRadius: '8px', padding: '8px 10px' }}
                  />
                  <small style={{ color: '#666', fontSize: '12px' }}>
                    Allowed formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG (Max 10MB)
                  </small>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowUploadModal(false)}
                    disabled={uploading}
                    style={{ borderRadius: '8px', padding: '9px 16px', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploading}
                    style={{ borderRadius: '8px', padding: '9px 18px', fontWeight: 600, background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)', border: 'none' }}
                  >
                    {uploading ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Upload Client Document Modal ── */}
        {showClientUploadModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
            onClick={() => setShowClientUploadModal(false)}
          >
            <div
              className="card"
              style={{
                maxWidth: '620px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
                borderRadius: '16px',
                padding: '24px'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '15px',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                    Upload Document
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                    Attach Aadhar Card, PAN Card, Agreement or Receipts to a client record.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowClientUploadModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#666'
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleUploadForClient}>
                {/* Select Client */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#334155' }}>
                    Select Client <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div className="custom-upload-client-dropdown" style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowUploadClientDropdown(!showUploadClientDropdown)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        border: showUploadClientDropdown ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: '#fff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: clientUploadFormData.clientId ? '#0f172a' : '#9ca3af'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '8px' }}>
                        {clientUploadFormData.clientId ? (() => {
                          const cl = clients.find(c => c._id === clientUploadFormData.clientId);
                          return cl ? `${cl.name || 'Unnamed'} ${cl.company ? `(${cl.company})` : ''}` : 'Choose a client...';
                        })() : 'Choose a client...'}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s', transform: showUploadClientDropdown ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {showUploadClientDropdown && (
                      <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        width: '100%',
                        background: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                        zIndex: 300,
                        padding: '8px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <input
                          type="text"
                          placeholder="Search client by name or company..."
                          value={uploadClientSearchText}
                          onChange={(e) => setUploadClientSearchText(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            fontSize: '13px',
                            background: '#f8fafc',
                            outline: 'none',
                            marginBottom: '8px'
                          }}
                        />
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {clients
                            .filter(c => `${c.name || ''} ${c.company || ''}`.toLowerCase().includes(uploadClientSearchText.toLowerCase()))
                            .map(cl => (
                              <div
                                key={cl._id}
                                onClick={() => {
                                  setClientUploadFormData({ ...clientUploadFormData, clientId: cl._id });
                                  setShowUploadClientDropdown(false);
                                  setUploadClientSearchText('');
                                }}
                                onMouseEnter={(e) => {
                                  if (clientUploadFormData.clientId !== cl._id) e.currentTarget.style.background = '#f1f5f9';
                                }}
                                onMouseLeave={(e) => {
                                  if (clientUploadFormData.clientId !== cl._id) e.currentTarget.style.background = 'transparent';
                                }}
                                style={{
                                  padding: '10px 12px',
                                  borderRadius: '8px',
                                  fontSize: '14px',
                                  fontWeight: clientUploadFormData.clientId === cl._id ? '600' : '400',
                                  cursor: 'pointer',
                                  color: clientUploadFormData.clientId === cl._id ? '#047857' : '#334155',
                                  background: clientUploadFormData.clientId === cl._id ? '#ecfdf5' : 'transparent',
                                  marginBottom: '2px',
                                  transition: 'background 0.15s'
                                }}
                              >
                                {cl.name || 'Unnamed'} {cl.company ? `(${cl.company})` : ''}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                    <input type="hidden" value={clientUploadFormData.clientId} required />
                  </div>
                </div>

                {/* Document Category */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#334155' }}>
                    Document Category <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    {[
                      { cat: 'Aadhar Card' },
                      { cat: 'PAN Card' },
                      { cat: 'Agreement' },
                      { cat: 'Receipts' }
                    ].map(({ cat }) => (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setClientUploadFormData({ ...clientUploadFormData, category: cat })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: clientUploadFormData.category === cat ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                          background: clientUploadFormData.category === cat ? '#eff6ff' : '#fff',
                          color: clientUploadFormData.category === cat ? '#1d4ed8' : '#475569',
                          fontWeight: clientUploadFormData.category === cat ? '600' : '500',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {getCategoryIconSvg(cat)} {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#334155' }}>
                    Document Title
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    value={clientUploadFormData.title}
                    onChange={(e) => setClientUploadFormData({ ...clientUploadFormData, title: e.target.value })}
                    placeholder={`e.g. ${clientUploadFormData.category} Document`}
                    style={{ borderRadius: '8px', padding: '9px 12px' }}
                  />
                </div>

                {/* Description */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#334155' }}>
                    Description (Optional)
                  </label>
                  <textarea
                    className="form-control"
                    value={clientUploadFormData.description}
                    onChange={(e) => setClientUploadFormData({ ...clientUploadFormData, description: e.target.value })}
                    placeholder="Enter details or notes about this client document..."
                    rows="3"
                    style={{ borderRadius: '8px', padding: '9px 12px' }}
                  />
                </div>

                {/* Choose File */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '13px', color: '#334155' }}>
                    Choose File <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="file"
                    className="form-control"
                    onChange={(e) => setClientUploadFormData({ ...clientUploadFormData, file: e.target.files[0] })}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.zip"
                    required
                    style={{ borderRadius: '8px', padding: '8px 10px' }}
                  />
                  <small style={{ color: '#64748b', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                    Supported formats: PDF, JPG, PNG, DOC, DOCX, XLSX, ZIP (Max 15MB)
                  </small>
                </div>

                {/* Modal Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowClientUploadModal(false)}
                    disabled={uploadingClientDoc}
                    style={{
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      color: '#475569',
                      borderRadius: '8px',
                      padding: '9px 16px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingClientDoc}
                    style={{
                      border: 'none',
                      background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '9px 20px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {uploadingClientDoc ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Documents;
