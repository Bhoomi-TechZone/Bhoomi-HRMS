import { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function MyDocuments() {
  const { user, hasPermission } = useAuth();
  const canUpload = hasPermission?.('my-documents', 'create') || hasPermission?.('documents', 'create');
  const canEdit = hasPermission?.('my-documents', 'update') || hasPermission?.('documents', 'update');
  const canDelete = hasPermission?.('my-documents', 'delete') || hasPermission?.('documents', 'delete');

  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const [documents, setDocuments] = useState([]);
  const [filteredDocuments, setFilteredDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [viewDocument, setViewDocument] = useState(null);
  const [viewDocumentUrl, setViewDocumentUrl] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedEditFileName, setSelectedEditFileName] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Aadhar Card',
    file: null
  });
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    category: 'Aadhar Card',
    file: null
  });

  useEffect(() => {
    fetchMyDocuments();
  }, []);

  useEffect(() => {
    return () => {
      if (viewDocumentUrl) URL.revokeObjectURL(viewDocumentUrl);
    };
  }, [viewDocumentUrl]);

  useEffect(() => {
    filterDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, statusFilter, searchTerm]);

  const fetchMyDocuments = async () => {
    try {
      const response = await api.get('/documents/my-documents');
      setDocuments(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setLoading(false);
    }
  };

  const filterDocuments = () => {
    let filtered = [...documents];

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(doc => doc.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredDocuments(filtered);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!formData.file) {
      alert('Please select a file to upload');
      return;
    }

    const uploadData = new FormData();
    uploadData.append('title', formData.title);
    uploadData.append('description', formData.description);
    uploadData.append('category', formData.category);
    uploadData.append('document', formData.file);

    try {
      await api.post('/documents', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setShowUploadModal(false);
      setFormData({
        title: '',
        description: '',
        category: 'Aadhar Card',
        file: null
      });
      setSelectedFileName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      fetchMyDocuments();
      alert('Document uploaded successfully!');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error uploading document';
      alert(errorMsg);
      console.error('Upload error:', error);
    }
  };

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

      const mimeType = response.headers['content-type'] || doc.mimetype || 'application/octet-stream';
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      setViewDocumentUrl(blobUrl);
    } catch (error) {
      console.error('View document error:', error);
      setViewDocumentUrl(null);
    } finally {
      setViewLoading(false);
    }
  };

  const closeViewDocument = () => {
    if (viewDocumentUrl) {
      URL.revokeObjectURL(viewDocumentUrl);
      setViewDocumentUrl(null);
    }
    setViewDocument(null);
  };

  const handleEdit = (doc) => {
    setEditingDocument(doc);
    setEditFormData({
      title: doc.title || '',
      description: doc.description || '',
      category: doc.category || 'Other',
      file: null
    });
    setSelectedEditFileName('');
    if (editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const updateData = new FormData();
      updateData.append('title', editFormData.title);
      updateData.append('description', editFormData.description || '');
      updateData.append('category', editFormData.category);
      if (editFormData.file) {
        updateData.append('document', editFormData.file);
      }

      await api.put(`/documents/my-documents/${editingDocument._id}`, updateData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setShowEditModal(false);
      setEditingDocument(null);
      setEditFormData({
        title: '',
        description: '',
        category: 'Aadhar Card',
        file: null
      });
      setSelectedEditFileName('');
      if (editFileInputRef.current) {
        editFileInputRef.current.value = '';
      }
      fetchMyDocuments();
      alert('Document updated successfully!');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error updating document';
      alert(errorMsg);
      console.error('Update error:', error);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/documents/my-documents/${id}`);
      fetchMyDocuments();
      alert('Document deleted successfully!');
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Error deleting document';
      alert(errorMsg);
      console.error('Delete error:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'badge-warning',
      approved: 'badge-success',
      rejected: 'badge-danger'
    };
    return badges[status] || 'badge-info';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      'Aadhar Card': '🆔',
      'PAN Card': '💳',
      'Bank Account': '🏦',
      'Passport': '🛂',
      'Driving License': '🚗',
      'Marksheet': '📜',
      'Degree Certificate': '🎓',
      'Experience Letter': '📋',
      'Offer Letter': '💼',
      'Appointment Letter': '📑',
      'Relieving Letter': '📄',
      'Policy': '📋',
      'Contract': '📝',
      'Report': '📊',
      'Other': '📄'
    };
    return icons[category] || '📄';
  };

  const getStatusMeta = (status) => {
    const statusMap = {
      pending: {
        label: 'Pending',
        background: 'rgba(245, 158, 11, 0.14)',
        color: '#b45309',
      },
      approved: {
        label: 'Approved',
        background: 'rgba(16, 185, 129, 0.14)',
        color: '#047857',
      },
      rejected: {
        label: 'Rejected',
        background: 'rgba(239, 68, 68, 0.14)',
        color: '#b91c1c',
      },
    };

    return statusMap[status] || {
      label: status || 'Unknown',
      background: 'rgba(148, 163, 184, 0.14)',
      color: '#475569',
    };
  };

  const formatDocumentDate = (value) => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const categoryGroups = [
    {
      label: 'Personal Documents',
      options: ['Aadhar Card', 'PAN Card', 'Address Proof', 'Bank Account', 'Passport', 'Driving License', 'Voter id card', 'Electricity Bill', 'Wi-Fi Bill', 'Two Passport Size Photographs'],
    },
    {
      label: 'Educational Documents',
      options: ['Marksheet', 'Degree Certificate', 'Educational Certificates'],
    },
    {
      label: 'Professional Documents',
      options: ['Experience Letter', 'Offer Letter', 'Appointment Letter', 'Relieving Letter', "Last 3 Months' Salary Slips", 'Screenshot of Resignation Email'],
    },
    {
      label: 'Company Documents',
      options: ['Policy', 'Contract', 'Report'],
    },
  ];

  const totalDocuments = documents.length;
  const approvedCount = documents.filter((doc) => doc.status === 'approved').length;
  const pendingCount = documents.filter((doc) => doc.status === 'pending').length;
  const rejectedCount = documents.filter((doc) => doc.status === 'rejected').length;

  if (loading) {
    return <div className="container">Loading...</div>;
  }

  return (
    <>
      <style>{`
        .docs-shell {
          min-height: 100vh;
          background: #f8fafc;
          padding: 28px 28px 40px;
          font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
        }
        .docs-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }
        .docs-hero-copy {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .docs-hero-icon {
          width: 44px;
          height: 44px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(59,119,94,0.14) 0%, rgba(86,160,122,0.24) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b775e;
          flex-shrink: 0;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45);
        }
        .docs-title {
          font-size: 24px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.025em;
        }
        .docs-subtitle {
          font-size: 13px;
          color: #94a3b8;
          margin: 4px 0 0;
          font-weight: 500;
        }
        .docs-btn-primary {
          padding: 10px 16px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(135deg, #3b775e 0%, #56a07a 100%);
          color: #fff;
          font-size: 12.5px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
          transition: opacity 0.15s, transform 0.12s;
        }
        .docs-btn-primary:hover {
          opacity: 0.94;
          transform: translateY(-1px);
        }
        .docs-btn-ghost {
          padding: 9px 20px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          border-radius: 9px;
          font-size: 12.5px;
          font-weight: 600;
          color: #6b7280;
          cursor: pointer;
          font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
          transition: border-color 0.15s, color 0.15s;
        }
        .docs-btn-ghost:hover {
          border-color: #9ca3af;
          color: #374151;
        }
        .docs-cancel-btn {
          position: relative;
          isolation: isolate;
          overflow: hidden;
        }
        .docs-cancel-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }
        .docs-cancel-btn::after {
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
        .docs-cancel-btn:hover {
          color: #1f2937;
          border-color: transparent;
        }
        .docs-cancel-btn:hover::before {
          transform: translateX(0%);
        }
        .docs-cancel-btn:hover::after {
          transform: translateX(255%) rotate(8deg);
        }
        .docs-panel {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(15,23,42,0.04);
        }
        .docs-filter-panel {
          padding: 16px;
          margin-bottom: 18px;
        }
        .docs-filter-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.5fr) minmax(220px, 0.9fr);
          gap: 14px;
        }
        .docs-label {
          display: block;
          font-size: 11.5px;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 6px;
          letter-spacing: 0.02em;
        }
        .docs-input {
          width: 100%;
          padding: 10px 13px;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 13px;
          color: #0f172a;
          background: #fff;
          font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .docs-input:focus {
          border-color: #3b775e;
          box-shadow: 0 0 0 3px rgba(59,119,94,0.09);
        }
        .docs-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }
        .docs-stat-card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 16px 18px;
        }
        .docs-stat-label {
          font-size: 11.5px;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .docs-stat-value {
          font-size: 28px;
          font-weight: 300;
          line-height: 1;
        }
        .docs-grid-wrap {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        }
        .docs-grid-head {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          background: #fafafa;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .docs-grid-title {
          font-size: 12px;
          color: #94a3b8;
          font-weight: 700;
        }
        .docs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
          padding: 16px;
        }
        .docs-card {
          border: 1px solid #e8edf3;
          border-radius: 16px;
          background: linear-gradient(180deg, #ffffff 0%, #fcfdfd 100%);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 260px;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
        }
        .docs-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 34px rgba(15,23,42,0.08);
          border-color: #dbe6df;
        }
        .docs-card-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .docs-card-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(59,119,94,0.12) 0%, rgba(86,160,122,0.22) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
        .docs-card-title {
          margin: 0 0 6px;
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.35;
        }
        .docs-status-pill {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .docs-category-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 999px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 11px;
          color: #475569;
          font-weight: 600;
        }
        .docs-desc {
          margin: 0;
          font-size: 12.5px;
          color: #64748b;
          line-height: 1.65;
          min-height: 42px;
        }
        .docs-meta {
          display: grid;
          gap: 8px;
        }
        .docs-meta-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          font-size: 11.5px;
        }
        .docs-meta-key {
          color: #94a3b8;
          font-weight: 700;
          min-width: 82px;
        }
        .docs-meta-value {
          color: #475569;
          font-weight: 600;
          text-align: right;
        }
        .docs-rejection {
          padding: 10px 12px;
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 10px;
          font-size: 11.5px;
          color: #b91c1c;
          line-height: 1.5;
        }
        .docs-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: auto;
          padding-top: 14px;
          border-top: 1px solid #eef2f7;
        }
        .docs-action-btn {
          flex: 1 1 110px;
          min-width: 110px;
          padding: 9px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: 'Inter', 'Poppins', 'Segoe UI', sans-serif;
          transition: transform 0.12s, opacity 0.15s, border-color 0.15s;
        }
        .docs-action-btn:hover {
          transform: translateY(-1px);
        }
        .docs-action-btn--preview {
          border: 1px solid #cbe4d7;
          background: #eaf6f0;
          color: #276249;
        }
        .docs-action-btn--preview:hover {
          background: #ddf0e6;
        }
        .docs-action-btn--download {
          border: 1px solid #d7e3da;
          background: #f8fffb;
          color: #2f6b53;
        }
        .docs-action-btn--edit {
          border: none;
          background: linear-gradient(135deg, #3b775e 0%, #56a07a 100%);
          color: #fff;
        }
        .docs-action-btn--delete {
          border: 1px solid rgba(239,68,68,0.18);
          background: rgba(239,68,68,0.08);
          color: #b91c1c;
        }
        .docs-empty {
          padding: 54px 20px 58px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .docs-empty-icon {
          width: 62px;
          height: 62px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(59,119,94,0.10) 0%, rgba(86,160,122,0.20) 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b775e;
        }
        .docs-empty-title {
          font-size: 19px;
          font-weight: 700;
          color: #334155;
          margin: 0;
        }
        .docs-empty-copy {
          font-size: 13px;
          color: #94a3b8;
          margin: 0;
        }
        .docs-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.42);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          z-index: 1100;
        }
        .docs-modal {
          background: #fff;
          border-radius: 18px;
          width: 100%;
          max-width: 760px;
          max-height: 88vh;
          overflow-y: auto;
          border: 1px solid #e8edf0;
          box-shadow: 0 8px 40px rgba(0,0,0,0.13);
          animation: docsModalIn 0.22s cubic-bezier(0.16,1,0.3,1);
          scrollbar-width: none;
        }
        .docs-modal::-webkit-scrollbar { display: none; }
        .docs-modal-hd {
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
        .docs-modal-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(59,119,94,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b775e;
          flex-shrink: 0;
        }
        .docs-modal-title {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        .docs-modal-sub {
          font-size: 11.5px;
          color: #9ca3af;
          margin-top: 2px;
          line-height: 1.3;
        }
        .docs-close-btn {
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
          transition: background 0.15s, color 0.15s;
        }
        .docs-close-btn:hover { background: #e5e7eb; color: #111827; }
        .docs-modal-body {
          padding: 20px;
        }
        .docs-form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .docs-form-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.9fr;
          gap: 12px;
        }
        .docs-form-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .docs-file-drop {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 22px 18px;
          border: 1.5px dashed #d1d5db;
          border-radius: 12px;
          cursor: pointer;
          background: #fafafa;
          transition: border-color 0.15s, background 0.15s;
          text-align: center;
        }
        .docs-file-drop:hover {
          border-color: #3b775e;
          background: #f0faf4;
        }
        .docs-file-main {
          font-size: 12.5px;
          color: #374151;
          font-weight: 700;
        }
        .docs-file-sub {
          font-size: 11px;
          color: #94a3b8;
        }
        .docs-file-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          background: #f0faf4;
          border: 1px solid #b7e4c7;
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11px;
          color: #2e7d32;
          font-weight: 600;
          max-width: 100%;
        }
        .docs-note {
          padding: 11px 12px;
          background: #fef3c7;
          border-radius: 10px;
          font-size: 11.5px;
          color: #92400e;
          line-height: 1.5;
          border: 1px solid rgba(245, 158, 11, 0.18);
        }
        .docs-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding-top: 16px;
          border-top: 1px solid #f1f3f5;
          margin-top: 4px;
        }
        @keyframes docsModalIn {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (max-width: 768px) {
          .docs-shell { padding: 20px 16px 32px; }
          .docs-filter-grid,
          .docs-form-grid,
          .docs-grid { grid-template-columns: 1fr; }
          .docs-grid { padding: 14px; }
          .docs-actions { flex-direction: column; }
          .docs-action-btn { width: 100%; }
          .docs-modal-overlay { padding: 12px; }
          .docs-modal-body { padding: 16px; }
        }
      `}</style>

      <div className="page-container docs-shell">
        <div className="docs-hero">
          <div className="docs-hero-copy">
            <div className="docs-hero-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
              </svg>
            </div>
            <div>
              <h1 className="docs-title">My Documents</h1>
              <p className="docs-subtitle">Store, track, and manage your submitted documents in one place.</p>
            </div>
          </div>

          {canUpload && (
            <button className="docs-btn-primary" onClick={() => setShowUploadModal(true)}>
              Upload Document
            </button>
          )}
        </div>

        <div className="docs-stats">
          <div className="docs-stat-card">
            <div className="docs-stat-label">Total Documents</div>
            <div className="docs-stat-value" style={{ color: '#0f172a' }}>{totalDocuments}</div>
          </div>
          <div className="docs-stat-card">
            <div className="docs-stat-label">Approved</div>
            <div className="docs-stat-value" style={{ color: '#10b981' }}>{approvedCount}</div>
          </div>
          <div className="docs-stat-card">
            <div className="docs-stat-label">Pending</div>
            <div className="docs-stat-value" style={{ color: '#f59e0b' }}>{pendingCount}</div>
          </div>
          <div className="docs-stat-card">
            <div className="docs-stat-label">Rejected</div>
            <div className="docs-stat-value" style={{ color: '#ef4444' }}>{rejectedCount}</div>
          </div>
        </div>

        <div className="docs-panel docs-filter-panel">
          <div className="docs-filter-grid">
            <div>
              <label className="docs-label">Search Documents</label>
              <input
                type="text"
                className="docs-input"
                placeholder="Search by title, description, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <label className="docs-label">Filter by Status</label>
              <select
                className="docs-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Documents</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        <div className="docs-grid-wrap">
          <div className="docs-grid-head">
            <div className="docs-grid-title">
              Showing {filteredDocuments.length} {filteredDocuments.length === 1 ? 'document' : 'documents'}
            </div>
          </div>

          {filteredDocuments.length === 0 ? (
            <div className="docs-empty">
              <div className="docs-empty-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                </svg>
              </div>
              <h3 className="docs-empty-title">No documents found</h3>
              <p className="docs-empty-copy">Upload your first document or adjust the search and status filters.</p>
            </div>
          ) : (
            <div className="docs-grid">
              {filteredDocuments.map((doc) => {
                const statusMeta = getStatusMeta(doc.status);

                return (
                  <div key={doc._id} className="docs-card">
                    <div className="docs-card-top">
                      <div className="docs-card-icon">{getCategoryIcon(doc.category)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 className="docs-card-title">{doc.title}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            className="docs-status-pill"
                            style={{ background: statusMeta.background, color: statusMeta.color }}
                          >
                            {statusMeta.label}
                          </span>
                          <span className="docs-category-chip">{doc.category}</span>
                        </div>
                      </div>
                    </div>

                    <p className="docs-desc">{doc.description || 'No description provided for this document.'}</p>

                    <div className="docs-meta">
                      <div className="docs-meta-row">
                        <span className="docs-meta-key">Uploaded</span>
                        <span className="docs-meta-value">{formatDocumentDate(doc.createdAt)}</span>
                      </div>

                      {doc.status === 'approved' && doc.approvedAt && (
                        <div className="docs-meta-row">
                          <span className="docs-meta-key">Approved</span>
                          <span className="docs-meta-value" style={{ color: '#10b981' }}>{formatDocumentDate(doc.approvedAt)}</span>
                        </div>
                      )}
                    </div>

                    {doc.rejectionReason && (
                      <div className="docs-rejection">
                        <strong>Rejection reason:</strong> {doc.rejectionReason}
                      </div>
                    )}

                    <div className="docs-actions">
                      <button
                        className="docs-action-btn docs-action-btn--preview"
                        onClick={() => handleView(doc)}
                      >
                        View
                      </button>
                      <button
                        className="docs-action-btn docs-action-btn--download"
                        onClick={() => handleDownload(doc._id, doc.filename)}
                      >
                        Download
                      </button>

                      {(doc.status === 'pending' || doc.status === 'rejected') && (
                        <>
                          {canEdit && (
                            <button
                              className="docs-action-btn docs-action-btn--edit"
                              onClick={() => handleEdit(doc)}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button
                              className="docs-action-btn docs-action-btn--delete"
                              onClick={() => handleDelete(doc._id, doc.title)}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showUploadModal && (
          <div className="docs-modal-overlay" onClick={() => setShowUploadModal(false)}>
            <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
              <div className="docs-modal-hd">
                <div className="docs-modal-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                </div>
                <div>
                  <div className="docs-modal-title">Upload Document</div>
                  <div className="docs-modal-sub">Submit a new document for review and approval.</div>
                </div>
                <button className="docs-close-btn" onClick={() => setShowUploadModal(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="docs-modal-body">
                <form onSubmit={handleUpload} className="docs-form">
                  <div className="docs-form-grid">
                    <div className="docs-form-field">
                      <label className="docs-label">Document Title</label>
                      <input
                        type="text"
                        className="docs-input"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        required
                        placeholder="Enter document title"
                      />
                    </div>

                    <div className="docs-form-field">
                      <label className="docs-label">Category</label>
                      <select
                        className="docs-input"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        required
                      >
                        {categoryGroups.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </optgroup>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="docs-form-field">
                    <label className="docs-label">Description</label>
                    <textarea
                      className="docs-input"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows="4"
                      placeholder="Brief description of the document"
                      style={{ resize: 'none', lineHeight: 1.55 }}
                    />
                  </div>

                  <div className="docs-form-field">
                    <label className="docs-label">Upload File</label>
                    <label className="docs-file-drop">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          setFormData({ ...formData, file });
                          setSelectedFileName(file ? file.name : '');
                        }}
                        required
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                      />
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <div className="docs-file-main">Click to choose a file</div>
                      <div className="docs-file-sub">PDF, DOC, DOCX, XLS, XLSX, JPG, PNG up to 10MB</div>
                    </label>

                    {selectedFileName && (
                      <div className="docs-file-chip">
                        <span>Selected</span>
                        <span>{selectedFileName}</span>
                      </div>
                    )}
                  </div>

                  <div className="docs-modal-footer">
                    <button type="button" className="docs-btn-ghost docs-cancel-btn" onClick={() => setShowUploadModal(false)}>
                      <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
                    </button>
                    <button type="submit" className="docs-btn-primary">
                      Upload Document
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showEditModal && editingDocument && (
          <div className="docs-modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="docs-modal" onClick={(e) => e.stopPropagation()}>
              <div className="docs-modal-hd">
                <div className="docs-modal-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </div>
                <div>
                  <div className="docs-modal-title">Edit Document</div>
                  <div className="docs-modal-sub">Update document details or replace the uploaded file.</div>
                </div>
                <button className="docs-close-btn" onClick={() => setShowEditModal(false)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="docs-modal-body">
                <form onSubmit={handleUpdate} className="docs-form">
                  <div className="docs-form-grid">
                    <div className="docs-form-field">
                      <label className="docs-label">Document Title</label>
                      <input
                        type="text"
                        className="docs-input"
                        value={editFormData.title}
                        onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                        required
                        placeholder="Enter document title"
                      />
                    </div>

                    <div className="docs-form-field">
                      <label className="docs-label">Category</label>
                      <select
                        className="docs-input"
                        value={editFormData.category}
                        onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                        required
                      >
                        {categoryGroups.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </optgroup>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="docs-form-field">
                    <label className="docs-label">Description</label>
                    <textarea
                      className="docs-input"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      rows="3"
                      placeholder="Brief description of the document"
                      style={{ resize: 'none', lineHeight: 1.55 }}
                    />
                  </div>

                  <div className="docs-form-field">
                    <label className="docs-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Replace Document File (Optional)</span>
                      {editingDocument?.filename && (
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                          Current: {editingDocument.filename}
                        </span>
                      )}
                    </label>
                    <label className="docs-file-drop">
                      <input
                        ref={editFileInputRef}
                        type="file"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          setEditFormData({ ...editFormData, file });
                          setSelectedEditFileName(file ? file.name : '');
                        }}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                      />
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3b775e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <div className="docs-file-main">Click to choose a new file to replace</div>
                      <div className="docs-file-sub">Leave empty to keep current file ({editingDocument?.filename || 'existing file'})</div>
                    </label>

                    {selectedEditFileName && (
                      <div className="docs-file-chip" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', marginRight: '6px' }}>New File</span>
                          <span>{selectedEditFileName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setEditFormData({ ...editFormData, file: null });
                            setSelectedEditFileName('');
                            if (editFileInputRef.current) editFileInputRef.current.value = '';
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="docs-note" style={{ background: 'rgba(24, 119, 242, 0.08)', borderColor: 'rgba(24, 119, 242, 0.2)', color: '#1e40af' }}>
                    You can edit pending or rejected documents. Selecting a new file will replace the previous upload and resubmit it for verification.
                  </div>

                  <div className="docs-modal-footer">
                    <button type="button" className="docs-btn-ghost docs-cancel-btn" onClick={() => setShowEditModal(false)}>
                      <span style={{ position: 'relative', zIndex: 1 }}>Cancel</span>
                    </button>
                    <button type="submit" className="docs-btn-primary">
                      Update Document
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Document Preview Modal */}
        {viewDocument && (
          <div className="docs-modal-overlay" onClick={closeViewDocument}>
            <div className="docs-modal" style={{ maxWidth: '920px', height: '88vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
              <div className="docs-modal-hd">
                <div className="docs-modal-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <div>
                  <div className="docs-modal-title">{viewDocument.title}</div>
                  <div className="docs-modal-sub">{viewDocument.filename} • {viewDocument.category}</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="docs-btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => handleDownload(viewDocument._id, viewDocument.filename)}
                  >
                    Download
                  </button>
                  <button className="docs-close-btn" onClick={closeViewDocument}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="docs-modal-body" style={{ flex: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', overflow: 'hidden' }}>
                {viewLoading ? (
                  <div style={{ color: '#fff', fontSize: '14px' }}>Loading document preview...</div>
                ) : viewDocumentUrl ? (
                  viewDocument.mimetype?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(viewDocument.filename) ? (
                    <img
                      src={viewDocumentUrl}
                      alt={viewDocument.title}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '16px' }}
                    />
                  ) : (
                    <iframe
                      src={viewDocumentUrl}
                      title={viewDocument.title}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  )
                ) : (
                  <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '14px' }}>Preview is not directly supported for this format.</p>
                    <button
                      className="docs-btn-primary"
                      onClick={() => handleDownload(viewDocument._id, viewDocument.filename)}
                    >
                      Download to View
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default MyDocuments;
