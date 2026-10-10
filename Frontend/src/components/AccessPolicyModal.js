import React, { useState } from 'react';
import { X, Globe, Shield, Users, Plus, Trash2 } from 'lucide-react';
import api from '../api/axios';

const AccessPolicyModal = ({ policy, employees = [], onClose, onSaved }) => {
  const isEdit = !!policy?._id;
  const [formData, setFormData] = useState({
    name: policy?.name || '',
    description: policy?.description || '',
    status: policy?.status || 'active',
  });

  const [websites, setWebsites] = useState(
    policy?.blockedWebsites?.map(w => (typeof w === 'string' ? w : w.domain)) || []
  );
  const [newWebsite, setNewWebsite] = useState('');

  const [applications, setApplications] = useState(
    policy?.blockedApplications?.map(a => ({
      name: a.name || a.executable,
      executable: a.executable
    })) || []
  );
  const [newAppName, setNewAppName] = useState('');
  const [newAppExec, setNewAppExec] = useState('');

  const [selectedEmployees, setSelectedEmployees] = useState(
    policy?.assignedEmployees?.map(e => e._id || e) || []
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddWebsite = (e) => {
    e.preventDefault();
    if (!newWebsite.trim()) return;
    const cleanDomain = newWebsite.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!websites.includes(cleanDomain)) {
      setWebsites([...websites, cleanDomain]);
    }
    setNewWebsite('');
  };

  const handleRemoveWebsite = (domain) => {
    setWebsites(websites.filter(w => w !== domain));
  };

  const handleAddApp = (e) => {
    e.preventDefault();
    if (!newAppExec.trim()) return;
    const cleanExec = newAppExec.trim().toLowerCase();
    const cleanName = (newAppName || cleanExec).trim();
    if (!applications.some(a => a.executable === cleanExec)) {
      setApplications([...applications, { name: cleanName, executable: cleanExec }]);
    }
    setNewAppName('');
    setNewAppExec('');
  };

  const handleRemoveApp = (executable) => {
    setApplications(applications.filter(a => a.executable !== executable));
  };

  const handleToggleEmployee = (empId) => {
    if (selectedEmployees.includes(empId)) {
      setSelectedEmployees(selectedEmployees.filter(id => id !== empId));
    } else {
      setSelectedEmployees([...selectedEmployees, empId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Policy Name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let savedPolicyId = policy?._id;

      if (isEdit) {
        // Update basic policy details
        await api.put(`/access-policies/${savedPolicyId}`, formData);

        // Update Websites (Synchronize diff)
        const currentDomains = (policy.blockedWebsites || []).map(w => w.domain);
        // Add new
        for (const w of websites) {
          if (!currentDomains.includes(w)) {
            await api.post(`/access-policies/${savedPolicyId}/websites`, { domain: w });
          }
        }
        // Remove old
        for (const wObj of (policy.blockedWebsites || [])) {
          if (!websites.includes(wObj.domain)) {
            await api.delete(`/access-policies/${savedPolicyId}/websites/${wObj._id}`);
          }
        }

        // Update Apps
        const currentExecs = (policy.blockedApplications || []).map(a => a.executable);
        // Add new
        for (const a of applications) {
          if (!currentExecs.includes(a.executable)) {
            await api.post(`/access-policies/${savedPolicyId}/applications`, a);
          }
        }
        // Remove old
        for (const aObj of (policy.blockedApplications || [])) {
          if (!applications.some(a => a.executable === aObj.executable)) {
            await api.delete(`/access-policies/${savedPolicyId}/applications/${aObj._id}`);
          }
        }
      } else {
        // Create new Policy
        const res = await api.post('/access-policies', {
          name: formData.name,
          description: formData.description,
          blockedWebsites: websites.map(domain => ({ domain })),
          blockedApplications: applications
        });
        savedPolicyId = res.data._id;
      }

      // Assign employees
      if (selectedEmployees.length > 0) {
        await api.post(`/access-policies/${savedPolicyId}/employees`, {
          employeeIds: selectedEmployees
        });
      }

      onSaved();
    } catch (err) {
      console.error('Error saving policy:', err);
      setError(err.response?.data?.message || 'Failed to save access policy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ap-modal-overlay" onClick={onClose}>
      <div className="ap-modal-content" onClick={e => e.stopPropagation()}>
        <div className="ap-modal-header">
          <h3>{isEdit ? `Edit Policy: ${policy.name}` : 'Create Access Policy'}</h3>
          <button className="ap-chip-remove" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="ap-modal-body">
            {error && (
              <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            {/* Basic Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Policy Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Standard Employee Policy"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                Description
              </label>
              <textarea
                rows={2}
                placeholder="Brief description of this restriction policy..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            {/* Blocked Websites */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Globe size={14} style={{ color: '#2563eb' }} /> Blocked Websites ({websites.length})
                </label>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter domain (e.g. facebook.com, youtube.com)"
                  value={newWebsite}
                  onChange={e => setNewWebsite(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddWebsite(e); }}
                  style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <button type="button" onClick={handleAddWebsite} className="ap-btn-secondary">
                  <Plus size={14} /> Add
                </button>
              </div>

              <div className="ap-chip-list">
                {websites.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>No blocked websites specified.</span>
                ) : (
                  websites.map(domain => (
                    <span key={domain} className="ap-chip">
                      <Globe size={12} style={{ color: '#64748b' }} />
                      {domain}
                      <button type="button" className="ap-chip-remove" onClick={() => handleRemoveWebsite(domain)}>
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Blocked Applications */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Shield size={14} style={{ color: '#d97706' }} /> Blocked Windows Applications ({applications.length})
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="App Name (e.g. Discord)"
                  value={newAppName}
                  onChange={e => setNewAppName(e.target.value)}
                  style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <input
                  type="text"
                  placeholder="Executable (e.g. discord.exe)"
                  value={newAppExec}
                  onChange={e => setNewAppExec(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddApp(e); }}
                  style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                />
                <button type="button" onClick={handleAddApp} className="ap-btn-secondary">
                  <Plus size={14} /> Add
                </button>
              </div>

              <div className="ap-chip-list">
                {applications.length === 0 ? (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>No blocked applications specified.</span>
                ) : (
                  applications.map(app => (
                    <span key={app.executable} className="ap-chip">
                      <Shield size={12} style={{ color: '#64748b' }} />
                      <strong>{app.name}</strong> ({app.executable})
                      <button type="button" className="ap-chip-remove" onClick={() => handleRemoveApp(app.executable)}>
                        <X size={12} />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Employee Assignment */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                <Users size={14} style={{ color: '#16a34a' }} /> Assign to Employees ({selectedEmployees.length} selected)
              </label>

              <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                {employees.map(emp => {
                  const isChecked = selectedEmployees.includes(emp._id);
                  return (
                    <label
                      key={emp._id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isChecked ? '#f0fdf4' : 'transparent',
                        fontSize: '12px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleEmployee(emp._id)}
                      />
                      <span>
                        <strong>{emp.firstName} {emp.lastName}</strong> ({emp.employeeId || emp.email})
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="ap-modal-footer">
            <button type="button" className="ap-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="ap-btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AccessPolicyModal;
