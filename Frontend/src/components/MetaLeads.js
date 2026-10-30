import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './MetaLeads.css';

const STATUS_OPTIONS = ['New', 'Contacted', 'Qualified', 'Interested', 'Follow-up', 'Converted', 'Not Interested', 'Closed', 'Invalid', 'International'];

const STATUS_COLORS = {
  New: '#3498db',
  Contacted: '#f39c12',
  Qualified: '#9b59b6',
  Interested: '#1abc9c',
  'Follow-up': '#e67e22',
  Converted: '#27ae60',
  'Not Interested': '#e74c3c',
  Closed: '#95a5a6',
  Invalid: '#dc2626',
  International: '#0891b2',
};

function MetaLeads() {
  const { user, hasPermission } = useAuth();
  const canUpdate = hasPermission('leads', 'update');
  const isAdmin = canUpdate;

  // List state
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const LIMIT = 20;

  // Modals
  const [selectedLead, setSelectedLead] = useState(null);   // detail / assign modal
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Edit form inside modal
  const [editForm, setEditForm] = useState({
    assignedTo: '',
    status: '',
    notes: '',
    followUpDate: '',
  });
  const [saving, setSaving] = useState(false);

  // ─── Fetch helpers ────────────────────────────────────────────────────────

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: LIMIT });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (assignedFilter) params.set('assignedTo', assignedFilter);

      const res = await axios.get(`/api/meta-leads?${params.toString()}`);
      setLeads(res.data.leads || []);
      setPagination(res.data.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching meta leads:', err);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, assignedFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get('/api/meta-leads/stats');
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await axios.get('/api/users?role=Sales&limit=200');
      // fallback: try /api/employees
      const list = res.data.users || res.data || [];
      setEmployees(list);
    } catch {
      try {
        const res2 = await axios.get('/api/employees');
        setEmployees(res2.data || []);
      } catch (err2) {
        console.error('Error fetching employees:', err2);
      }
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchStats();
    fetchEmployees();
  }, [fetchStats, fetchEmployees]);

  // Reset to page 1 on filter change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, assignedFilter]);

  // ─── Sync ─────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    if (!window.confirm('Meta se nayi leads sync karein?')) return;
    setSyncing(true);
    try {
      const res = await axios.post('/api/meta-leads/sync');
      alert(`Sync complete! ${res.data.totalNewLeads} nayi leads mili.`);
      fetchLeads();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ─── Modal helpers ────────────────────────────────────────────────────────

  const openLead = (lead) => {
    setSelectedLead(lead);
    setEditForm({
      assignedTo: lead.assignedTo?._id || lead.assignedTo || '',
      status: lead.status || 'New',
      notes: lead.notes || '',
      followUpDate: lead.followUpDate ? lead.followUpDate.split('T')[0] : '',
    });
    setShowDetailModal(true);
  };

  const closeModal = () => {
    setShowDetailModal(false);
    setSelectedLead(null);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveLead = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    setSaving(true);
    try {
      const payload = {
        status: editForm.status,
        assignedTo: editForm.assignedTo || null,
        notes: editForm.notes,
        followUpDate: editForm.followUpDate || null,
      };
      await axios.patch(`/api/meta-leads/${selectedLead._id}`, payload);
      alert('Lead update ho gaya!');
      closeModal();
      fetchLeads();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  // ─── Quick-assign from table row ──────────────────────────────────────────

  const handleQuickAssign = async (leadId, employeeId) => {
    try {
      await axios.patch(`/api/meta-leads/${leadId}`, { assignedTo: employeeId || null });
      fetchLeads();
    } catch (err) {
      alert(err.response?.data?.message || 'Assign failed');
    }
  };

  const handleQuickStatus = async (leadId, status) => {
    try {
      await axios.patch(`/api/meta-leads/${leadId}`, { status });
      fetchLeads();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Status update failed');
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const employeeName = (emp) => {
    if (!emp) return '—';
    return `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email || '—';
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const statCards = [
    { label: 'Total', value: stats.total || 0, color: '#3498db' },
    { label: 'New', value: stats.byStatus?.New || 0, color: '#e74c3c' },
    { label: 'Contacted', value: stats.byStatus?.Contacted || 0, color: '#f39c12' },
    { label: 'Qualified', value: stats.byStatus?.Qualified || 0, color: '#9b59b6' },
    { label: 'Converted', value: stats.byStatus?.Converted || 0, color: '#27ae60' },
  ];

  return (
    <div className="meta-leads-container">
      {/* ── Header ── */}
      <div className="meta-leads-header">
        <div>
          <h2>Meta Leads</h2>
          <p className="meta-leads-subtitle">Facebook / Instagram lead gen forms se aaye leads</p>
        </div>
        {isAdmin && (
          <button className="btn-sync" onClick={handleSync} disabled={syncing}>
            {syncing ? '⏳ Syncing...' : '🔄 Sync Leads'}
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="ml-stats-grid">
        {statCards.map(s => (
          <div className="ml-stat-card" key={s.label} style={{ borderLeftColor: s.color }}>
            <h3 style={{ color: s.color }}>{s.value}</h3>
            <p>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="ml-filters">
        <input
          type="text"
          placeholder="🔍 Search by name, email, phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-search"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="ml-select">
          <option value="">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {isAdmin && (
          <select value={assignedFilter} onChange={e => setAssignedFilter(e.target.value)} className="ml-select">
            <option value="">All Employees</option>
            <option value="unassigned">Unassigned</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>
                {employeeName(emp)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="ml-loading">Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="ml-empty">
          <p>Koi lead nahi mili. Pehle sync karein ya filter hata ke dekhein.</p>
        </div>
      ) : (
        <>
          <div className="ml-table-wrapper">
            <table className="ml-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead, idx) => (
                  <tr key={lead._id} className="ml-row">
                    <td>{(page - 1) * LIMIT + idx + 1}</td>
                    <td>
                      <div className="ml-name">{lead.name || '—'}</div>
                      {lead.city && <div className="ml-city">{lead.city}</div>}
                    </td>
                    <td>
                      <div>{lead.phone || '—'}</div>
                      <div className="ml-email">{lead.email || ''}</div>
                    </td>
                    <td>
                      <div className="ml-badge-page">{lead.pageName || '—'}</div>
                      <div className="ml-form-name">{lead.formName || ''}</div>
                    </td>
                    <td>
                      {isAdmin ? (
                        <select
                          className="ml-status-select"
                          value={lead.status}
                          style={{ borderColor: STATUS_COLORS[lead.status] || '#ccc', color: STATUS_COLORS[lead.status] }}
                          onChange={e => handleQuickStatus(lead._id, e.target.value)}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <span className="ml-status-badge" style={{ background: STATUS_COLORS[lead.status] || '#ccc' }}>
                          {lead.status}
                        </span>
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <select
                          className="ml-assign-select"
                          value={lead.assignedTo?._id || lead.assignedTo || ''}
                          onChange={e => handleQuickAssign(lead._id, e.target.value)}
                        >
                          <option value="">— Unassigned —</option>
                          {employees.map(emp => (
                            <option key={emp._id} value={emp._id}>{employeeName(emp)}</option>
                          ))}
                        </select>
                      ) : (
                        <span>{employeeName(lead.assignedTo)}</span>
                      )}
                    </td>
                    <td>{formatDate(lead.createdTime)}</td>
                    <td>
                      <button className="btn-detail" onClick={() => openLead(lead)}>
                        View / Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div className="ml-pagination">
            <span className="ml-page-info">
              Total: {pagination.total} leads &nbsp;|&nbsp; Page {page} of {pagination.totalPages}
            </span>
            <div className="ml-page-btns">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-page">← Prev</button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="btn-page">Next →</button>
            </div>
          </div>
        </>
      )}

      {/* ── Detail / Assign Modal ── */}
      {showDetailModal && selectedLead && (
        <div className="ml-modal-overlay" onClick={closeModal}>
          <div className="ml-modal" onClick={e => e.stopPropagation()}>
            <div className="ml-modal-header">
              <h3>Lead Details</h3>
              <button className="btn-close" onClick={closeModal}>✕</button>
            </div>

            <div className="ml-modal-body">
              {/* Lead info */}
              <div className="ml-info-grid">
                <div className="ml-info-item">
                  <label>Name</label>
                  <span>{selectedLead.name || '—'}</span>
                </div>
                <div className="ml-info-item">
                  <label>Phone</label>
                  <span>{selectedLead.phone || '—'}</span>
                </div>
                <div className="ml-info-item">
                  <label>Email</label>
                  <span>{selectedLead.email || '—'}</span>
                </div>
                <div className="ml-info-item">
                  <label>City</label>
                  <span>{selectedLead.city || '—'}</span>
                </div>
                <div className="ml-info-item">
                  <label>Business Category</label>
                  <span>{selectedLead.businessCategory || '—'}</span>
                </div>
                <div className="ml-info-item">
                  <label>Website Type</label>
                  <span>{selectedLead.websiteType || '—'}</span>
                </div>
                <div className="ml-info-item">
                  <label>Page</label>
                  <span>{selectedLead.pageName || '—'}</span>
                </div>
                <div className="ml-info-item">
                  <label>Form</label>
                  <span>{selectedLead.formName || '—'}</span>
                </div>
                <div className="ml-info-item">
                  <label>Lead Date</label>
                  <span>{formatDate(selectedLead.createdTime)}</span>
                </div>
              </div>

              {/* All raw field data */}
              {selectedLead.fieldData?.length > 0 && (
                <div className="ml-raw-fields">
                  <h4>All Form Fields</h4>
                  <table className="ml-field-table">
                    <tbody>
                      {selectedLead.fieldData.map((f, i) => (
                        <tr key={i}>
                          <td className="ml-field-name">{f.name}</td>
                          <td>{f.values?.join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Edit/Assign form */}
              <form onSubmit={handleSaveLead} className="ml-edit-form">
                <h4>Update Lead</h4>
                <div className="ml-form-row">
                  <div className="ml-form-group">
                    <label>Status</label>
                    <select name="status" value={editForm.status} onChange={handleEditFormChange} className="ml-input">
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {isAdmin && (
                    <div className="ml-form-group">
                      <label>Assign To</label>
                      <select name="assignedTo" value={editForm.assignedTo} onChange={handleEditFormChange} className="ml-input">
                        <option value="">— Unassigned —</option>
                        {employees.map(emp => (
                          <option key={emp._id} value={emp._id}>{employeeName(emp)}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div className="ml-form-row">
                  <div className="ml-form-group">
                    <label>Follow-up Date</label>
                    <input
                      type="date"
                      name="followUpDate"
                      value={editForm.followUpDate}
                      onChange={handleEditFormChange}
                      className="ml-input"
                    />
                  </div>
                </div>
                <div className="ml-form-group">
                  <label>Notes</label>
                  <textarea
                    name="notes"
                    value={editForm.notes}
                    onChange={handleEditFormChange}
                    rows={3}
                    className="ml-input"
                    placeholder="Meeting notes, requirements, etc..."
                  />
                </div>
                <div className="ml-modal-footer">
                  <button type="button" className="btn-cancel" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-save" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>

              {/* History */}
              {selectedLead.history?.length > 0 && (
                <div className="ml-history">
                  <h4>Activity History</h4>
                  <ul>
                    {selectedLead.history.slice().reverse().map((h, i) => (
                      <li key={i} className="ml-history-item">
                        <span className="ml-history-action">{h.action}</span>
                        <span className="ml-history-detail">{h.details}</span>
                        <span className="ml-history-date">{formatDate(h.date)}</span>
                        {h.by && (
                          <span className="ml-history-by">
                            by {h.by.firstName} {h.by.lastName}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MetaLeads;
