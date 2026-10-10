import React, { useState, useEffect } from 'react';
import { X, History, RotateCcw, Clock, ShieldAlert } from 'lucide-react';
import api from '../api/axios';

const PolicyHistoryModal = ({ policy, onClose, onRollbackComplete }) => {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchRevisions();
  }, [policy._id]);

  const fetchRevisions = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/access-policies/${policy._id}/revisions`);
      setRevisions(res.data);
    } catch (err) {
      console.error('Error fetching revisions:', err);
      setError('Failed to load policy revision history');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (targetVersion) => {
    if (!window.confirm(`Are you sure you want to rollback to v${targetVersion}? This will create a new non-destructive revision snapshot.`)) {
      return;
    }

    setRollbackLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.post(`/access-policies/${policy._id}/rollback`, { targetVersion });
      setSuccess(res.data.message);
      setTimeout(() => {
        onRollbackComplete();
      }, 1500);
    } catch (err) {
      console.error('Error during rollback:', err);
      setError(err.response?.data?.message || 'Rollback failed');
    } finally {
      setRollbackLoading(false);
    }
  };

  return (
    <div className="ap-modal-overlay" onClick={onClose}>
      <div className="ap-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '720px' }}>
        <div className="ap-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} style={{ color: '#3b775e' }} />
            <h3 style={{ margin: 0 }}>Revision History: {policy.name}</h3>
          </div>
          <button className="ap-chip-remove" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="ap-modal-body">
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', borderRadius: '8px', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', color: '#16a34a', borderRadius: '8px', fontSize: '13px' }}>
              {success}
            </div>
          )}

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              Loading revision timeline...
            </div>
          ) : revisions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
              No revisions recorded yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {revisions.map((rev) => {
                const isCurrent = rev.version === policy.version;
                const websites = rev.snapshot?.blockedWebsites || [];
                const apps = rev.snapshot?.blockedApplications || [];

                return (
                  <div
                    key={rev._id}
                    style={{
                      border: isCurrent ? '2px solid #3b775e' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      background: isCurrent ? '#f8fdfb' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>
                          Version {rev.version}
                        </span>
                        {isCurrent && (
                          <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '12px' }}>
                            CURRENT
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {new Date(rev.createdAt).toLocaleString()}
                        </span>
                      </div>

                      {!isCurrent && (
                        <button
                          type="button"
                          className="ap-btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '11px', color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }}
                          disabled={rollbackLoading}
                          onClick={() => handleRollback(rev.version)}
                        >
                          <RotateCcw size={12} /> Rollback to v{rev.version}
                        </button>
                      )}
                    </div>

                    <div style={{ fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                      {rev.changeSummary || rev.changeType}
                      {rev.changedBy && ` by ${rev.changedBy.firstName} ${rev.changedBy.lastName}`}
                    </div>

                    {/* Snapshot Summary */}
                    <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                      <span>🌐 {websites.length} Blocked Websites</span>
                      <span>🛡️ {apps.length} Blocked Apps</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="ap-modal-footer">
          <button type="button" className="ap-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolicyHistoryModal;
