import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import LeadDocuments from './LeadDocuments';
import './Leads.css';

function Leads() {
  const { user, hasPermission } = useAuth();
  
  // Import fields for template generation
  const IMPORT_FIELDS = [
    { key: 'LeadName', label: 'LeadName' },
    { key: 'ContactNumber', label: 'ContactNumber' },
    { key: 'Email', label: 'Email' },
    { key: 'Company', label: 'Company' },
    { key: 'Value', label: 'Value' },
    { key: 'Notes', label: 'Notes' }
  ];
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [salesEmployees, setSalesEmployees] = useState([]);
  const [selectedSalesEmployee, setSelectedSalesEmployee] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    source: 'Website',
    budget: '',
    requirements: '',
    notes: '',
    nextFollowUp: '',
    followUpNotes: '',
    assignedTo: user?._id || ''
  });

  useEffect(() => {
    if (user && user._id) {
      console.log('User loaded, fetching leads...');
      fetchLeads();
      fetchStats();
      fetchSalesEmployees();
    } else {
      console.log('Waiting for user to be loaded...');
    }
  }, [filter, sourceFilter, user]);

  const fetchLeads = async () => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    try {
      let url = '/api/leads';
      const params = [];
      
      if (filter !== 'all') {
        params.push(`status=${filter}`);
      }
      
      if (sourceFilter !== 'all') {
        params.push(`source=${sourceFilter}`);
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      
      console.log('Fetching leads from:', url);
      const response = await axios.get(url);
      setLeads(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching leads:', error.response?.data || error.message);
      setLeads([]);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!canRead) return;
    try {
      console.log('Fetching leads stats...');
      const response = await axios.get('/api/leads/stats/overview');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error.response?.data || error.message);
      // Set default stats if error occurs
      setStats({
        total: 0,
        new: 0,
        inProgress: 0,
        converted: 0,
        lost: 0,
        conversionRate: 0
      });
    }
  };

  const fetchSalesEmployees = async () => {
    if (!canRead) return;
    try {
      console.log('Fetching sales employees...');
      const response = await axios.get('/employees');
      console.log('All employees response:', response.data);
      // Filter only employees with Sales role
      const salesEmps = response.data.filter(emp => {
        console.log(`Checking employee: ${emp.firstName} ${emp.lastName}, Role:`, emp.role?.name);
        return emp.role?.name === 'Sales';
      });
      console.log('Filtered sales employees:', salesEmps);
      setSalesEmployees(salesEmps);
    } catch (error) {
      console.error('Error fetching sales employees:', error.response?.data || error.message);
      setSalesEmployees([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Validate user is logged in
      if (!user || !user._id) {
        alert('Error: User not logged in. Please refresh and try again.');
        return;
      }

      // Add assignedTo as current user's ID
      const submitData = {
        ...formData,
        assignedTo: user._id,
        budget: formData.budget ? parseFloat(formData.budget) : 0
      };

      console.log('Submitting lead data:', submitData);
      
      if (editingLead) {
        if (!canUpdate) return;
        // Update existing lead
        await axios.put(`/api/leads/${editingLead._id}`, submitData);
        alert('Lead updated successfully!');
      } else {
        if (!canCreate) return;
        // Create new lead
        const response = await axios.post('/api/leads', submitData);
        console.log('Lead created:', response.data);
        alert('Lead created successfully!');
      }
      
      setShowModal(false);
      resetForm();
      fetchLeads();
      fetchStats();
    } catch (error) {
      console.error('Error saving lead:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'Error saving lead');
    }
  };

  const handleEdit = (lead) => {
    if (!canUpdate && !canRead) return;
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company || '',
      source: lead.source,
      assignedTo: lead.assignedTo._id,
      budget: lead.budget || '',
      requirements: lead.requirements || '',
      notes: lead.notes || '',
      nextFollowUp: lead.nextFollowUp ? lead.nextFollowUp.split('T')[0] : '',
      followUpNotes: lead.followUpNotes || ''
    });
    setShowModal(true);
  };

  const handleStatusChange = async (leadId, newStatus) => {
    if (!canUpdate) return;
    try {
      let updateData = { status: newStatus };
      
      if (newStatus === 'Lost') {
        const reason = prompt('Please enter reason for losing this lead:');
        if (!reason) return;
        updateData.lostReason = reason;
      }
      
      await axios.put(`/api/leads/${leadId}`, updateData);
      alert('Lead status updated!');
      fetchLeads();
      fetchStats();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating lead status');
    }
  };

  const handleDelete = async (leadId) => {
    if (!canDelete) return;
    if (window.confirm('Are you sure you want to delete this lead?')) {
      try {
        await axios.delete(`/api/leads/${leadId}`);
        alert('Lead deleted successfully!');
        fetchLeads();
        fetchStats();
      } catch (error) {
        console.error('Error deleting lead:', error);
        alert(error.response?.data?.message || 'Error deleting lead');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      source: 'Website',
      budget: '',
      requirements: '',
      notes: '',
      nextFollowUp: '',
      followUpNotes: '',
      assignedTo: user?._id || ''
    });
    setEditingLead(null);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'New':
        return 'badge-new';
      case 'In Progress':
        return 'badge-progress';
      case 'Converted':
        return 'badge-converted';
      case 'Lost':
        return 'badge-lost';
      default:
        return '';
    }
  };

  const isFollowUpDue = (date) => {
    if (!date) return false;
    const followUpDate = new Date(date);
    const today = new Date();
    return followUpDate <= today;
  };

  // Download Excel template for leads import
  const handleDownloadTemplate = () => {
    const headers = IMPORT_FIELDS.map(f => f.label);
    const example = [
      'John Smith',
      '9876543210',
      'john@example.com',
      'Acme Corporation',
      '50000',
      'Interested in our CRM solution'
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    // Set column widths
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads Template');
    XLSX.writeFile(wb, 'leads_import_template.xlsx');
  };

  const canRead = hasPermission('leads', 'read');
  const canCreate = hasPermission('leads', 'create');
  const canUpdate = hasPermission('leads', 'update');
  const canDelete = hasPermission('leads', 'delete');
  const canImport = canCreate;

  const handleImportExcel = async () => {
    if (!canImport) return;
    if (!importFile) {
      alert('Please select a file first');
      return;
    }

    if (!selectedSalesEmployee) {
      alert('Please select a sales employee to assign leads to');
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('employeeId', selectedSalesEmployee);

      const response = await axios.post('/api/lead-assignments/import-excel', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setImportResult(response.data);
      setImportFile(null);
      
      if (response.data.count > 0) {
        alert(`✅ Successfully imported ${response.data.count} leads!\n${response.data.errors ? `⚠️ ${response.data.errors.length} rows had errors` : 'All leads imported successfully'}`);
        fetchLeads();
        fetchStats();
        setShowImportModal(false);
        setSelectedSalesEmployee('');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert(error.response?.data?.message || 'Error importing leads');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="leads-container">
        <div className="loading">
          <div style={{textAlign: 'center', padding: '50px'}}>
            <p>Loading leads...</p>
            <p style={{fontSize: '12px', color: '#666', marginTop: '20px'}}>If this takes too long, try refreshing the page.</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error if no user
  if (!user || !user._id) {
    return (
      <div className="leads-container">
        <div style={{textAlign: 'center', padding: '50px', color: 'red'}}>
          <p>⚠️ Error: User not logged in</p>
          <p>Please log in and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leads-container">
      {/* Lead Documents Section */}
      {canRead && <LeadDocuments />}

      {/* All Sales Employees Section */}
      {canRead && (
        <div className="sales-employees-section" style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '15px' }}>👥 Sales Team</h3>
          {salesEmployees.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
              {salesEmployees.map((employee) => (
                <div key={employee._id} style={{ 
                  padding: '15px', 
                  border: '1px solid #ddd', 
                  borderRadius: '8px',
                  backgroundColor: '#f9f9f9',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>
                    {employee.firstName} {employee.lastName}
                  </h4>
                  <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                    <strong>Email:</strong> {employee.email}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                    <strong>ID:</strong> {employee.employeeId}
                  </p>
                  <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>
                    <strong>Department:</strong> {employee.department || 'N/A'}
                  </p>
                  <span style={{ 
                    display: 'inline-block',
                    padding: '4px 8px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '12px',
                    marginTop: '8px'
                  }}>
                    {employee.role?.name || 'Sales'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#999', textAlign: 'center', padding: '20px' }}>No sales employees found</p>
          )}
        </div>
      )}

      <div className="leads-header">
        <h2>📊 Lead Management</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {canImport && (
            <button 
              className="btn-import-leads" 
              onClick={() => setShowImportModal(true)}
              style={{ backgroundColor: '#28a745' }}
            >
              📥 Import Excel
            </button>
          )}
          {canCreate && (
            <button 
              className="btn-add-lead" 
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              ➕ Add New Lead
            </button>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{stats.total || 0}</h3>
          <p>Total Leads</p>
        </div>
        <div className="stat-card stat-new">
          <h3>{stats.new || 0}</h3>
          <p>New Leads</p>
        </div>
        <div className="stat-card stat-progress">
          <h3>{stats.inProgress || 0}</h3>
          <p>In Progress</p>
        </div>
        <div className="stat-card stat-converted">
          <h3>{stats.converted || 0}</h3>
          <p>Converted</p>
        </div>
        <div className="stat-card stat-lost">
          <h3>{stats.lost || 0}</h3>
          <p>Lost</p>
        </div>
        <div className="stat-card stat-rate">
          <h3>{stats.conversionRate || 0}%</h3>
          <p>Conversion Rate</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-container">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="New">New</option>
            <option value="In Progress">In Progress</option>
            <option value="Converted">Converted</option>
            <option value="Lost">Lost</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Source:</label>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All Sources</option>
            <option value="Website">Website</option>
            <option value="Marketing">Marketing</option>
            <option value="Referral">Referral</option>
            <option value="Cold Call">Cold Call</option>
            <option value="Social Media">Social Media</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Leads Table */}
      <div className="leads-table-container">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Source</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Budget</th>
              <th>Next Follow-up</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center' }}>No leads found</td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead._id}>
                  <td>{lead.name}</td>
                  <td>{lead.company || '-'}</td>
                  <td>{lead.email}</td>
                  <td>
                    {lead.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <a 
                          href={`tel:${lead.phone}`} 
                          style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            color: '#667eea',
                            textDecoration: 'none',
                            fontWeight: '500'
                          }}
                          title="Click to call"
                        >
                          📞 {lead.phone}
                        </a>
                        <a 
                          href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            backgroundColor: '#25D366',
                            borderRadius: '50%',
                            textDecoration: 'none',
                            transition: 'transform 0.2s',
                            fontSize: '16px'
                          }}
                          title="WhatsApp"
                          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <svg viewBox="0 0 32 32" width="18" height="18" fill="white">
                            <path d="M16 0C7.164 0 0 7.164 0 16c0 2.777.709 5.39 1.955 7.665L.057 31.293l7.828-2.047A15.932 15.932 0 0016 32c8.836 0 16-7.164 16-16S24.836 0 16 0zm0 29.333c-2.496 0-4.87-.686-6.894-1.986l-.494-.3-5.13 1.342 1.37-4.998-.33-.513A13.288 13.288 0 012.667 16C2.667 8.636 8.636 2.667 16 2.667S29.333 8.636 29.333 16 23.364 29.333 16 29.333zm7.335-10.015c-.401-.201-2.379-1.174-2.748-1.308-.369-.134-.638-.201-.906.201-.268.401-1.04 1.308-1.275 1.577-.234.268-.469.302-.87.101-2.412-1.208-3.996-2.155-5.587-4.882-.42-.721.42-.67 1.202-2.231.134-.268.067-.502-.033-.703-.101-.201-.906-2.179-1.241-2.982-.335-.804-.67-.67-.906-.67-.234 0-.502-.033-.77-.033s-.703.1-1.072.502c-.369.401-1.408 1.375-1.408 3.353s1.442 3.888 1.643 4.156c.201.268 2.814 4.295 6.819 6.022 2.513 1.074 3.52 1.174 4.79.988.771-.117 2.379-.972 2.714-1.911.335-.939.335-1.744.234-1.911-.1-.168-.368-.268-.77-.469z"/>
                          </svg>
                        </a>
                      </div>
                    )}
                    {!lead.phone && '-'}
                  </td>
                  <td><span className="source-badge">{lead.source}</span></td>
                  <td>
                    <span className={`status-badge ${getStatusBadgeClass(lead.status)}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td>{lead.assignedTo?.firstName} {lead.assignedTo?.lastName}</td>
                  <td>₹{lead.budget ? lead.budget.toLocaleString() : 0}</td>
                  <td>
                    {lead.nextFollowUp ? (
                      <span className={isFollowUpDue(lead.nextFollowUp) ? 'followup-due' : ''}>
                        {new Date(lead.nextFollowUp).toLocaleDateString()}
                        {isFollowUpDue(lead.nextFollowUp) && ' ⚠️'}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="actions-cell">
                    <button 
                      className="btn-view" 
                      onClick={() => handleEdit(lead)}
                      title="View/Edit"
                    >
                      👁️
                    </button>
                    
                    {canUpdate && lead.status !== 'Converted' && lead.status !== 'Lost' && (
                      <select
                        className="status-select"
                        value={lead.status}
                        onChange={(e) => handleStatusChange(lead._id, e.target.value)}
                      >
                        <option value="New">New</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Converted">Converted</option>
                        <option value="Lost">Lost</option>
                      </select>
                    )}
                    
                    {canDelete && (
                      <button 
                        className="btn-delete" 
                        onClick={() => handleDelete(lead._id)}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Lead Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingLead ? 'Edit Lead' : 'Add New Lead'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="lead-form">
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="form-group">
                  <label>Source *</label>
                  <select
                    name="source"
                    value={formData.source}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="Website">Website</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Referral">Referral</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Budget (₹)</label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
                
                <div className="form-group">
                  <label>Next Follow-up Date</label>
                  <input
                    type="date"
                    name="nextFollowUp"
                    value={formData.nextFollowUp}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Requirements</label>
                <textarea
                  name="requirements"
                  value={formData.requirements}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label>Follow-up Notes</label>
                <textarea
                  name="followUpNotes"
                  value={formData.followUpNotes}
                  onChange={handleInputChange}
                  rows="2"
                />
              </div>
              
              <div className="form-group">
                <label>Additional Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>
              
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingLead ? 'Update Lead' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📥 Import Leads from Excel</h3>
              <button className="close-btn" onClick={() => setShowImportModal(false)}>✕</button>
            </div>
            
            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <h4>📋 Excel Format Required:</h4>
                <ul style={{ fontSize: '13px', color: '#666', marginLeft: '20px' }}>
                  <li><strong>LeadName</strong> (Required) - Name of the lead</li>
                  <li><strong>ContactNumber</strong> (Required) - Phone number</li>
                  <li><strong>Email</strong> (Optional) - Email address</li>
                  <li><strong>Company</strong> (Optional) - Company name</li>
                  <li><strong>Value</strong> (Optional) - Lead value amount</li>
                  <li><strong>Notes</strong> (Optional) - Additional notes</li>
                </ul>
                
                <div style={{ marginTop: '15px' }}>
                  <button
                    onClick={handleDownloadTemplate}
                    disabled={importing}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      backgroundColor: '#f0fdf4',
                      color: '#15803d',
                      border: '1px solid #bbf7d0',
                      borderRadius: '5px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      textDecoration: 'none'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download Template
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '5px', borderLeft: '4px solid #2196F3' }}>
                <p style={{ margin: '0', fontSize: '13px', color: '#1976D2' }}>
                  ℹ️ Select a sales employee below to assign these leads to them.
                </p>
              </div>

              <div className="form-group">
                <label>Select Sales Employee *</label>
                <select
                  value={selectedSalesEmployee}
                  onChange={(e) => setSelectedSalesEmployee(e.target.value)}
                  disabled={importing}
                  style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '5px', width: '100%' }}
                >
                  <option value="">-- Choose a Sales Employee --</option>
                  {salesEmployees.map((employee) => (
                    <option key={employee._id} value={employee._id}>
                      {employee.firstName} {employee.lastName} ({employee.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Select Excel File *</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  disabled={importing}
                  style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '5px', width: '100%' }}
                />
              </div>

              {importFile && (
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
                  Selected file: <strong>{importFile.name}</strong> ({(importFile.size / 1024).toFixed(2)} KB)
                </div>
              )}

              {importResult && (
                <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '5px', maxHeight: '150px', overflowY: 'auto' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px' }}>📊 Import Results:</h4>
                  <p style={{ margin: '5px 0', fontSize: '12px' }}>✅ Imported: <strong>{importResult.count}</strong> leads</p>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <>
                      <p style={{ margin: '5px 0', fontSize: '12px' }}>⚠️ Errors: <strong>{importResult.errors.length}</strong></p>
                      <details style={{ fontSize: '11px' }}>
                        <summary>Show Errors</summary>
                        <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
                          {importResult.errors.map((err, idx) => (
                            <li key={idx} style={{ color: '#d32f2f' }}>{err}</li>
                          ))}
                        </ul>
                      </details>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="btn-cancel" 
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
                disabled={importing}
              >
                Close
              </button>
              <button 
                className="btn-submit" 
                onClick={handleImportExcel}
                disabled={!importFile || !selectedSalesEmployee || importing}
                style={{ opacity: (!importFile || !selectedSalesEmployee || importing) ? 0.6 : 1 }}
              >
                {importing ? '⏳ Importing...' : '✅ Import Leads'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Leads;
