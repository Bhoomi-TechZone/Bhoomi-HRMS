import React, { useState, useEffect } from 'react';
import { Shield, Globe, Users, Plus, Edit2, History, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../api/axios';
import AccessPolicyModal from './AccessPolicyModal';
import PolicyHistoryModal from './PolicyHistoryModal';
import './AccessPolicies.css';

const AccessPolicies = () => {
  const [policies, setPolicies] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [policiesRes, employeesRes] = await Promise.all([
        api.get('/access-policies'),
        api.get('/employees')
      ]);
      setPolicies(policiesRes.data || []);
      setEmployees(employeesRes.data?.filter(e => e.isActive !== false) || []);
    } catch (err) {
      console.error('Error loading policies/employees:', err);
      setError('Failed to load access policies');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedPolicy(null);
    setShowEditorModal(true);
  };

  const handleEdit = async (policy) => {
    try {
      // Fetch fresh policy with assigned employees
      const res = await api.get(`/access-policies/${policy._id}`);
      setSelectedPolicy(res.data);
      setShowEditorModal(true);
    } catch (err) {
      console.error('Error fetching policy details:', err);
      setSelectedPolicy(policy);
      setShowEditorModal(true);
    }
  };

  const handleViewHistory = (policy) => {
    setSelectedPolicy(policy);
    setShowHistoryModal(true);
  };

  const handleDelete = async (policyId, policyName) => {
    if (!window.confirm(`Are you sure you want to delete access policy '${policyName}'?`)) {
      return;
    }
    try {
      await api.delete(`/access-policies/${policyId}`);
      fetchData();
    } catch (err) {
      console.error('Error deleting policy:', err);
      alert(err.response?.data?.message || 'Failed to delete policy');
    }
  };

  return (
    <div className="ap-container">
      <div className="ap-header">
        <div className="ap-header-title">
          <h3>Website & Application Access Policies</h3>
          <p>Configure blocklists for Windows applications and websites on employee devices.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="ap-btn-secondary" onClick={fetchData}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button type="button" className="ap-btn-primary" onClick={handleCreateNew}>
            <Plus size={16} /> Create Policy
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: '10px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
          Loading access policies...
        </div>
      ) : policies.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px dashed #cbd5e1' }}>
          <Shield size={36} style={{ color: '#94a3b8', marginBottom: '12px' }} />
          <h4 style={{ margin: '0 0 6px', color: '#0f172a' }}>No Access Policies Configured</h4>
          <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>
            Create your first blocklist policy to restrict distracting websites and non-work applications.
          </p>
          <button type="button" className="ap-btn-primary" onClick={handleCreateNew}>
            <Plus size={16} /> Create Initial Policy
          </button>
        </div>
      ) : (
        <div className="ap-grid">
          {policies.map(policy => (
            <div key={policy._id} className="ap-card">
              <div>
                <div className="ap-card-top">
                  <div>
                    <h4 className="ap-card-title">{policy.name}</h4>
                    <p className="ap-card-desc">{policy.description || 'No description provided.'}</p>
                  </div>
                  <span className="ap-badge-ver">v{policy.version}</span>
                </div>

                <div className="ap-stats-row">
                  <div className="ap-stat-box">
                    <span className="ap-stat-val" style={{ color: '#2563eb' }}>
                      {policy.blockedWebsites?.length || 0}
                    </span>
                    <span className="ap-stat-lbl">Websites</span>
                  </div>
                  <div className="ap-stat-box">
                    <span className="ap-stat-val" style={{ color: '#d97706' }}>
                      {policy.blockedApplications?.length || 0}
                    </span>
                    <span className="ap-stat-lbl">Apps</span>
                  </div>
                  <div className="ap-stat-box">
                    <span className="ap-stat-val" style={{ color: '#16a34a' }}>
                      {policy.assignedEmployeeCount || 0}
                    </span>
                    <span className="ap-stat-lbl">Employees</span>
                  </div>
                </div>
              </div>

              <div className="ap-card-actions">
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="ap-btn-secondary"
                    onClick={() => handleViewHistory(policy)}
                    title="View Revision History & Rollback"
                  >
                    <History size={13} /> History
                  </button>
                  <button
                    type="button"
                    className="ap-btn-secondary"
                    onClick={() => handleEdit(policy)}
                    title="Edit Policy"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(policy._id, policy.name)}
                  title="Delete Policy"
                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px', borderRadius: '6px' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {showEditorModal && (
        <AccessPolicyModal
          policy={selectedPolicy}
          employees={employees}
          onClose={() => { setShowEditorModal(false); setSelectedPolicy(null); }}
          onSaved={() => { setShowEditorModal(false); setSelectedPolicy(null); fetchData(); }}
        />
      )}

      {/* History & Rollback Modal */}
      {showHistoryModal && selectedPolicy && (
        <PolicyHistoryModal
          policy={selectedPolicy}
          onClose={() => { setShowHistoryModal(false); setSelectedPolicy(null); }}
          onRollbackComplete={() => { setShowHistoryModal(false); setSelectedPolicy(null); fetchData(); }}
        />
      )}
    </div>
  );
};

export default AccessPolicies;
