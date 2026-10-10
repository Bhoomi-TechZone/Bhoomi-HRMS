import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, Mail, Building2, Globe, Briefcase, 
  Tag, FileText, StickyNote, CheckCircle2, X,
  Upload, Search, ChevronLeft, ChevronRight,
  TrendingUp, Sparkles, Phone
} from 'lucide-react';
import './MarketingLeads.css';

function MarketingLeads() {
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission('leads', 'create');
  const canRead = hasPermission('leads', 'read');
  const canViewAddedLeads = canCreate && canRead;

  // Import fields for template generation
  const IMPORT_FIELDS = [
    { key: 'date', label: 'Date' },
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'company', label: 'Company' },
    { key: 'country', label: 'Country' },
    { key: 'industry', label: 'Industry' },
    { key: 'source', label: 'Source' },
    { key: 'leadType', label: 'Lead Type' },
    { key: 'requirement', label: 'Requirement' },
    { key: 'notes', label: 'Notes' }
  ];

  // Stats
  const [stats, setStats] = useState({ totalAdded: 0, todayAdded: 0 });
  const [loading, setLoading] = useState(true);

  // Manual add form
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    email: '',
    phone: '',
    company: '',
    country: '',
    industry: '',
    source: 'Email Marketing',
    leadType: '',
    requirement: '',
    notes: ''
  });
  const [showPreview, setShowPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Excel import
  const [showImportModal, setShowImportModal] = useState(false);
  const [excelData, setExcelData] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // My added leads (if canRead)
  const [myLeads, setMyLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 10;

  // Fetch stats
  const fetchStats = async () => {
    try {
      const res = await api.get('/marketing-leads/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Fetch my added leads (only if user has read permission)
  const fetchMyLeads = async () => {
    if (!canViewAddedLeads) return;
    
    setLeadsLoading(true);
    try {
      const res = await api.get('/marketing-leads/my-added-leads');
      setMyLeads(res.data || []);
    } catch (err) {
      console.error('Error fetching my leads:', err);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    if (canCreate) {
      fetchStats();
    }
    if (canViewAddedLeads) {
      fetchMyLeads();
    }
    setLoading(false);
  }, [canCreate, canViewAddedLeads]);

  // Handle manual form input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle Done button - show preview
  const handleDone = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      alert('Name and Email are required');
      return;
    }

    setShowPreview(true);
  };

  // Handle final submit after preview
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setSuccessMessage('');

    try {
      await api.post('/marketing-leads/add-manual', formData);
      
      // Success
      setSuccessMessage('✅ Lead added successfully!');
      
      // Refresh stats
      await fetchStats();
      if (canViewAddedLeads) {
        await fetchMyLeads();
      }

      // Close preview and clear form
      setShowPreview(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        name: '',
        email: '',
        phone: '',
        company: '',
        country: '',
        industry: '',
        source: 'Email Marketing',
        leadType: '',
        requirement: '',
        notes: ''
      });

      // Hide success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error adding lead:', err);
      alert(err.response?.data?.message || 'Failed to add lead');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit from preview
  const handleEditFromPreview = () => {
    setShowPreview(false);
  };

  // Handle file selection for Excel import
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Map Excel columns to our fields
        const mapped = jsonData.map(row => ({
          date: row.Date || row.date || new Date().toISOString().split('T')[0],
          name: row.Name || row.name || '',
          email: row.Email || row.email || '',
          phone: row.Phone || row.phone || row.Mobile || row.mobile || '',
          company: row.Company || row.company || '',
          country: row.Country || row.country || '',
          industry: row.Industry || row.industry || '',
          source: row.Source || row.source || 'Email Marketing',
          leadType: row['Lead Type'] || row.leadType || row.LeadType || row.leadtype || '',
          requirement: row.Requirement || row.requirement || '',
          notes: row.Notes || row.notes || ''
        }));

        setExcelData(mapped);
        setShowImportModal(true);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        alert('Failed to parse Excel file. Please check the format.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Handle Excel import
  const handleImport = async () => {
    if (excelData.length === 0) {
      alert('No data to import');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const res = await api.post('/marketing-leads/import-excel', { leads: excelData });
      setImportResult(res.data);

      // Refresh stats
      await fetchStats();
      if (canViewAddedLeads) {
        await fetchMyLeads();
      }

      // Close modal after 3 seconds if no errors
      if (res.data.failed === 0) {
        setTimeout(() => {
          setShowImportModal(false);
          setExcelData([]);
          setImportResult(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }, 3000);
      }
    } catch (err) {
      console.error('Error importing leads:', err);
      alert(err.response?.data?.message || 'Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  // Filter leads based on search
  const filteredLeads = myLeads.filter(lead =>
    lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.phone?.includes(searchTerm) ||
    lead.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE);
  const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
  const paginatedLeads = filteredLeads.slice(startIndex, startIndex + LEADS_PER_PAGE);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Download Excel template
  const handleDownloadTemplate = () => {
    const headers = IMPORT_FIELDS.map(f => f.label);
    const example = [
      '2024-01-15',
      'John Smith',
      'john@example.com',
      '+1-234-567-8900',
      'Acme Corporation',
      'USA',
      'Technology',
      'Email Marketing',
      'Hot',
      'Looking for CRM solution',
      'Follow up next week'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Marketing Leads Template');
    XLSX.writeFile(wb, 'marketing_leads_template.xlsx');
  };

  if (loading) {
    return (
      <div className="ml-container">
        <div className="ml-loading">Loading...</div>
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="ml-container">
        <div className="ml-no-permission">
          <p>⚠️ You don't have permission to access this page.</p>
          <p>Contact your administrator to request access.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-container">
      {/* Header */}
      <div className="ml-header">
        <div>
          <h1 className="ml-title">Marketing Leads</h1>
          <p className="ml-subtitle">Add and manage your marketing leads</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="ml-stats-grid">
        <div className="ml-stat-card ml-stat-blue">
          <TrendingUp size={36} className="ml-stat-icon" />
          <div className="ml-stat-content">
            <p className="ml-stat-label">Total Added</p>
            <h2 className="ml-stat-value">{stats.totalAdded}</h2>
          </div>
        </div>

        <div className="ml-stat-card ml-stat-green">
          <Sparkles size={36} className="ml-stat-icon" />
          <div className="ml-stat-content">
            <p className="ml-stat-label">Today Added</p>
            <h2 className="ml-stat-value">{stats.todayAdded}</h2>
          </div>
        </div>
      </div>

      {/* Manual Add Form */}
      <div className="ml-card">
        <div className="ml-card-header">
          <h2 className="ml-card-title">➕ Add Lead Manually</h2>
        </div>
        
        <form onSubmit={handleDone} className="ml-form">
          <div className="ml-form-row">
            <div className="ml-form-group">
              <label className="ml-label">
                <Calendar size={14} className="ml-label-icon" />
                Date
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className="ml-input"
              />
            </div>

            <div className="ml-form-group">
              <label className="ml-label">
                <Mail size={14} className="ml-label-icon" />
                Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="ml-input"
                required
                placeholder="John Doe"
              />
            </div>

            <div className="ml-form-group">
              <label className="ml-label">
                <Mail size={14} className="ml-label-icon" />
                Email *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="ml-input"
                required
                placeholder="john@example.com"
              />
            </div>
          </div>

          <div className="ml-form-row">
            <div className="ml-form-group">
              <label className="ml-label">
                <Phone size={14} className="ml-label-icon" />
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="ml-input"
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="ml-form-group">
              <label className="ml-label">
                <Building2 size={14} className="ml-label-icon" />
                Company
              </label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                className="ml-input"
                placeholder="Acme Corporation"
              />
            </div>

            <div className="ml-form-group">
              <label className="ml-label">
                <Globe size={14} className="ml-label-icon" />
                Country
              </label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className="ml-input"
                placeholder="USA"
              />
            </div>
          </div>

          <div className="ml-form-row">
            <div className="ml-form-group">
              <label className="ml-label">
                <Briefcase size={14} className="ml-label-icon" />
                Industry
              </label>
              <input
                type="text"
                name="industry"
                value={formData.industry}
                onChange={handleInputChange}
                className="ml-input"
                placeholder="Technology"
              />
            </div>

            <div className="ml-form-group">
              <label className="ml-label">
                <Tag size={14} className="ml-label-icon" />
                Source
              </label>
              <select
                name="source"
                value={formData.source}
                onChange={handleInputChange}
                className="ml-input"
              >
                <option value="Email Marketing">Email Marketing</option>
                <option value="LinkedIn Campaign">LinkedIn Campaign</option>
                <option value="Newsletter">Newsletter</option>
                <option value="Webinar">Webinar</option>
                <option value="Social Media">Social Media</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="ml-form-group">
              <label className="ml-label">
                <Tag size={14} className="ml-label-icon" />
                Lead Type
              </label>
              <select
                name="leadType"
                value={formData.leadType}
                onChange={handleInputChange}
                className="ml-input"
              >
                <option value="">-- Select Type --</option>
                <option value="Hot">Hot</option>
                <option value="Warm">Warm</option>
                <option value="Cold">Cold</option>
              </select>
            </div>

            <div className="ml-form-group ml-form-group-full">
              <label className="ml-label">
                <FileText size={14} className="ml-label-icon" />
                Requirement
              </label>
              <textarea
                name="requirement"
                value={formData.requirement}
                onChange={handleInputChange}
                className="ml-textarea"
                rows="2"
                placeholder="What is the lead looking for?"
              />
            </div>
          </div>

          <div className="ml-form-row">
            <div className="ml-form-group ml-form-group-full">
              <label className="ml-label">
                <StickyNote size={14} className="ml-label-icon" />
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                className="ml-textarea"
                rows="2"
                placeholder="Additional notes about the lead"
              />
            </div>
          </div>

          <div className="ml-form-actions">
            {successMessage && (
              <div className="ml-success-message">{successMessage}</div>
            )}
            <button
              type="submit"
              className="ml-btn ml-btn-primary"
            >
              <CheckCircle2 size={16} />
              Done
            </button>
          </div>
        </form>
      </div>

      {/* Excel Import */}
      <div className="ml-card">
        <div className="ml-card-header">
          <h2 className="ml-card-title">
            <Upload size={18} className="ml-title-icon" />
            Import Leads from Excel
          </h2>
        </div>
        
        <div className="ml-import-section">
          <p className="ml-import-description">
            Upload an Excel file with columns: Date, Name, Email, Phone, Company, Country, Industry, Source, Lead Type, Requirement, Notes
          </p>
          
          <div className="ml-import-actions">
            <button
              onClick={handleDownloadTemplate}
              className="ml-btn ml-btn-outline"
              style={{ marginRight: '10px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Template
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx,.xls"
              className="ml-file-input"
              id="excel-upload"
            />
            <label htmlFor="excel-upload" className="ml-btn ml-btn-secondary">
              <Upload size={16} />
              Choose Excel File
            </label>
          </div>
        </div>
      </div>

      {/* My Added Leads Table (only if canRead) */}
      {canViewAddedLeads && (
        <div className="ml-card">
          <div className="ml-card-header">
            <h2 className="ml-card-title">
              <FileText size={18} className="ml-title-icon" />
              My Added Leads
            </h2>
            <div className="ml-search-box">
              <Search size={16} className="ml-search-icon" />
              <input
                type="text"
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ml-search-input"
              />
            </div>
          </div>

          {leadsLoading ? (
            <div className="ml-loading">Loading leads...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="ml-empty-state">
              <p>No leads found</p>
            </div>
          ) : (
            <>
              <div className="ml-table-wrapper">
                <table className="ml-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Added On</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Company</th>
                      <th>Country</th>
                      <th>Industry</th>
                      <th>Source</th>
                      <th>Lead Type</th>
                      <th>Requirement</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedLeads.map((lead) => (
                      <tr key={lead._id}>
                        <td>{formatDate(lead.date)}</td>
                        <td>{formatDate(lead.addedOn)}</td>
                        <td>{lead.name}</td>
                        <td>{lead.email}</td>
                        <td>{lead.phone || '-'}</td>
                        <td>{lead.company || '-'}</td>
                        <td>{lead.country || '-'}</td>
                        <td>{lead.industry || '-'}</td>
                        <td>
                          <span className={`ml-source-badge ml-source-${(lead.source || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{lead.source}</span>
                        </td>
                        <td>
                          {lead.leadType ? (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '3px 11px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
                              background: lead.leadType === 'Hot' ? '#fef2f2' : lead.leadType === 'Warm' ? '#fff7ed' : '#e0f2fe',
                              color: lead.leadType === 'Hot' ? '#dc2626' : lead.leadType === 'Warm' ? '#ea580c' : '#0284c7',
                              border: `1px solid ${lead.leadType === 'Hot' ? '#fecaca' : lead.leadType === 'Warm' ? '#fed7aa' : '#bae6fd'}`,
                            }}>
                              {lead.leadType}
                            </span>
                          ) : '-'}
                        </td>
                        <td>
                          <div className="ml-requirement-cell">
                            {lead.requirement ? (
                              <span className="ml-requirement-text" title={lead.requirement}>
                                {lead.requirement.length > 50 
                                  ? `${lead.requirement.substring(0, 50)}...` 
                                  : lead.requirement}
                              </span>
                            ) : '-'}
                          </div>
                        </td>
                        <td>
                          <span className="ml-status-badge ml-status-new">
                            {lead.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="ml-pagination">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="ml-pagination-btn"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>
                  <span className="ml-pagination-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="ml-pagination-btn"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="ml-modal-overlay" onClick={() => !submitting && setShowPreview(false)}>
          <div className="ml-modal ml-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ml-modal-header">
              <h2>Preview Lead Details</h2>
              <button
                onClick={() => setShowPreview(false)}
                disabled={submitting}
                className="ml-modal-close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="ml-modal-body">
              <div className="ml-preview-grid">
                <div className="ml-preview-item">
                  <div className="ml-preview-label">
                    <Calendar size={16} className="ml-preview-icon" />
                    Date
                  </div>
                  <div className="ml-preview-value">
                    {new Date(formData.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>

                <div className="ml-preview-item">
                  <div className="ml-preview-label">
                    <Mail size={16} className="ml-preview-icon" />
                    Name
                  </div>
                  <div className="ml-preview-value">{formData.name}</div>
                </div>

                <div className="ml-preview-item">
                  <div className="ml-preview-label">
                    <Mail size={16} className="ml-preview-icon" />
                    Email
                  </div>
                  <div className="ml-preview-value">{formData.email}</div>
                </div>

                <div className="ml-preview-item">
                  <div className="ml-preview-label">
                    <Phone size={16} className="ml-preview-icon" />
                    Phone
                  </div>
                  <div className="ml-preview-value">{formData.phone || '-'}</div>
                </div>

                <div className="ml-preview-item">
                  <div className="ml-preview-label">
                    <Building2 size={16} className="ml-preview-icon" />
                    Company
                  </div>
                  <div className="ml-preview-value">{formData.company || '-'}</div>
                </div>

                <div className="ml-preview-item">
                  <div className="ml-preview-label">
                    <Globe size={16} className="ml-preview-icon" />
                    Country
                  </div>
                  <div className="ml-preview-value">{formData.country || '-'}</div>
                </div>

                <div className="ml-preview-item">
                  <div className="ml-preview-label">
                    <Briefcase size={16} className="ml-preview-icon" />
                    Industry
                  </div>
                  <div className="ml-preview-value">{formData.industry || '-'}</div>
                </div>

                <div className="ml-preview-item">
                  <div className="ml-preview-label">
                    <Tag size={16} className="ml-preview-icon" />
                    Source
                  </div>
                  <div className="ml-preview-value">
                    <span className={`ml-preview-badge ml-source-${(formData.source || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{formData.source}</span>
                  </div>
                </div>

                {formData.leadType && (
                  <div className="ml-preview-item">
                    <div className="ml-preview-label">
                      <Tag size={16} className="ml-preview-icon" />
                      Lead Type
                    </div>
                    <div className="ml-preview-value">
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        padding: '3px 11px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                        background: formData.leadType === 'Hot' ? '#fef2f2' : formData.leadType === 'Warm' ? '#fff7ed' : '#e0f2fe',
                        color: formData.leadType === 'Hot' ? '#dc2626' : formData.leadType === 'Warm' ? '#ea580c' : '#0284c7',
                        border: `1px solid ${formData.leadType === 'Hot' ? '#fecaca' : formData.leadType === 'Warm' ? '#fed7aa' : '#bae6fd'}`,
                      }}>
                        {formData.leadType}
                      </span>
                    </div>
                  </div>
                )}

                {formData.requirement && (
                  <div className="ml-preview-item ml-preview-full">
                    <div className="ml-preview-label">
                      <FileText size={16} className="ml-preview-icon" />
                      Requirement
                    </div>
                    <div className="ml-preview-value">{formData.requirement}</div>
                  </div>
                )}

                {formData.notes && (
                  <div className="ml-preview-item ml-preview-full">
                    <div className="ml-preview-label">
                      <StickyNote size={16} className="ml-preview-icon" />
                      Notes
                    </div>
                    <div className="ml-preview-value">{formData.notes}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="ml-modal-footer">
              <button
                onClick={handleEditFromPreview}
                disabled={submitting}
                className="ml-btn ml-btn-outline"
              >
                Edit
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="ml-btn ml-btn-primary"
              >
                {submitting ? 'Submitting...' : 'Submit Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="ml-modal-overlay" onClick={() => !importing && setShowImportModal(false)}>
          <div className="ml-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ml-modal-header">
              <h2>Import Leads from Excel</h2>
              <button
                onClick={() => setShowImportModal(false)}
                disabled={importing}
                className="ml-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="ml-modal-body">
              {importResult ? (
                <div className="ml-import-result">
                  <div className={`ml-import-status ${importResult.failed === 0 ? 'ml-import-success' : 'ml-import-partial'}`}>
                    <h3>
                      {importResult.failed === 0 ? '✅ Import Successful!' : '⚠️ Import Completed with Errors'}
                    </h3>
                    <p>
                      <strong>{importResult.imported}</strong> leads imported successfully
                    </p>
                    {importResult.failed > 0 && (
                      <p className="ml-import-failed">
                        <strong>{importResult.failed}</strong> leads failed to import
                      </p>
                    )}
                  </div>

                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="ml-import-errors">
                      <h4>Error Details:</h4>
                      <ul>
                        {importResult.errors.map((error, idx) => (
                          <li key={idx}>
                            Row {error.row}: {error.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="ml-import-preview-text">
                    <strong>{excelData.length}</strong> leads ready to import
                  </p>

                  <div className="ml-import-preview">
                    <table className="ml-preview-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Phone</th>
                          <th>Company</th>
                          <th>Source</th>
                          <th>Lead Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {excelData.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.name}</td>
                            <td>{row.email}</td>
                            <td>{row.phone || '-'}</td>
                            <td>{row.company || '-'}</td>
                            <td>{row.source}</td>
                            <td>{row.leadType || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {excelData.length > 5 && (
                      <p className="ml-preview-more">...and {excelData.length - 5} more</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="ml-modal-footer">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setExcelData([]);
                  setImportResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                disabled={importing}
                className="ml-btn ml-btn-outline"
              >
                {importResult ? 'Close' : 'Cancel'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="ml-btn ml-btn-primary"
                >
                  {importing ? 'Importing...' : 'Import Leads'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarketingLeads;
