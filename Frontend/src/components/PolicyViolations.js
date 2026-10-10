import React, { useState, useEffect } from 'react';
import { ShieldAlert, Globe, Monitor, Filter, RefreshCw, Clock, User } from 'lucide-react';
import api from '../api/axios';

const PolicyViolations = () => {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchViolations();
  }, [typeFilter, page]);

  const fetchViolations = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (typeFilter) params.type = typeFilter;

      const res = await api.get('/access-policies/violations', { params });
      setViolations(res.data.violations || []);
      setTotalPages(res.data.pagination?.pages || 1);
      setTotalCount(res.data.pagination?.total || 0);
    } catch (err) {
      console.error('Error fetching violations:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ap-container">
      <div className="ap-header">
        <div className="ap-header-title">
          <h3>Access Policy Violations</h3>
          <p>Real-time audit log of blocked application and website access attempts on managed devices.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            <option value="">All Violation Types</option>
            <option value="WEBSITE">Websites Only</option>
            <option value="APPLICATION">Applications Only</option>
          </select>

          <button type="button" className="ap-btn-secondary" onClick={fetchViolations}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="ap-table-wrap">
        <table className="ap-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Employee</th>
              <th>Type</th>
              <th>Target</th>
              <th>Action</th>
              <th>Policy / Version</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading violations...
                </td>
              </tr>
            ) : violations.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No policy violations recorded.
                </td>
              </tr>
            ) : (
              violations.map((v) => (
                <tr key={v._id}>
                  <td style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                    <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    {new Date(v.timestamp).toLocaleString()}
                  </td>
                  <td>
                    <strong>{v.employee ? `${v.employee.firstName} ${v.employee.lastName}` : 'Unknown Employee'}</strong>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      {v.employee?.employeeId || v.employee?.email}
                    </div>
                  </td>
                  <td>
                    {v.type === 'WEBSITE' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#2563eb', fontWeight: '600', fontSize: '12px' }}>
                        <Globe size={13} /> WEBSITE
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#d97706', fontWeight: '600', fontSize: '12px' }}>
                        <Monitor size={13} /> APPLICATION
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: '600', color: '#dc2626' }}>
                      {v.target}
                    </span>
                  </td>
                  <td>
                    <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '12px' }}>
                      {v.action || 'BLOCKED'}
                    </span>
                  </td>
                  <td>
                    {v.policy?.name || 'Default Policy'} <span style={{ color: '#64748b', fontSize: '11px' }}>(v{v.policyVersion})</span>
                  </td>
                  <td style={{ fontSize: '11px', color: '#64748b' }}>
                    {v.device}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Showing page {page} of {totalPages} ({totalCount} total events)
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="ap-btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="ap-btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyViolations;
