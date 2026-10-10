import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function Roles() {
  const { user, refreshUser, hasPermission } = useAuth();
  const isAdmin = user?.role?.name === 'Admin';
  const canCreate = hasPermission?.('roles', 'create');
  const canUpdate = hasPermission?.('roles', 'update');
  const canDelete = hasPermission?.('roles', 'delete');
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRole, setExpandedRole] = useState(null);
  const [formData, setFormData] = useState({ name: '', permissions: [] });
  const [pendingChanges, setPendingChanges] = useState({}); // Track unsaved changes per role
  const [showRoleUsersModal, setShowRoleUsersModal] = useState(false);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState(null);
  const [roleUsers, setRoleUsers] = useState([]);
  const [loadingRoleUsers, setLoadingRoleUsers] = useState(false);

  const handleShowRoleUsers = async (role) => {
    setSelectedRoleForUsers(role);
    setRoleUsers([]);
    setLoadingRoleUsers(true);
    setShowRoleUsersModal(true);
    try {
      const response = await api.get('/employees');
      // The backend returns role populated, so emp.role._id
      const usersWithRole = response.data.filter(emp => emp.isActive !== false && emp.role && (emp.role._id === role._id || emp.role === role._id));
      setRoleUsers(usersWithRole);
    } catch (err) {
      console.error('Error fetching employees for role:', err);
    } finally {
      setLoadingRoleUsers(false);
    }
  };

  const modules = [
    'broadcasts', 'goals', 'projects', 'assignments', 'assets', 'vendor-management', 'leaves',
    'employees', 'roles', 'accounts', 'leads', 'clients', 'deals', 'pipeline',
    'payroll', 'attendance', 'activities',
    'biometric-logs', 'documents', 'my-payslips', 'my-documents',
    'proposals', 'recruitment', 'letters', 'calendar', 'access-policies'
  ];

  const moduleDisplayNames = {
    'broadcasts': 'Announcements',
    'assignments': 'Assignments',
    'goals': 'Tasks',
    'clients': 'Clients',
    'accounts': 'Accounts',
    'pipeline': 'Pipeline',
    'my-payslips': 'Finance',
    'my-documents': 'My Documents',
    'biometric-logs': 'Biometric Logs',
    'letters': 'Letters',
    'calendar': 'Calendar',
    'activities': 'Activities',
    'access-policies': 'Access Policies',
    'vendor-management': 'Vendor Management',
  };

  const getModuleLabel = (mod) =>
    moduleDisplayNames[mod] || (mod.charAt(0).toUpperCase() + mod.slice(1).replace(/-/g, ' '));

  const actions = ['create', 'read', 'update', 'delete'];

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handlePermissionToggle = (module, action) => {
    setFormData(prev => {
      const permissions = [...prev.permissions];
      const moduleIndex = permissions.findIndex(p => p.module === module);
      if (moduleIndex === -1) {
        permissions.push({ module, actions: [action] });
      } else {
        const acts = [...permissions[moduleIndex].actions];
        const actionIndex = acts.indexOf(action);
        if (actionIndex === -1) {
          acts.push(action);
          permissions[moduleIndex] = { ...permissions[moduleIndex], actions: acts };
        } else {
          acts.splice(actionIndex, 1);
          if (acts.length === 0) {
            permissions.splice(moduleIndex, 1);
          } else {
            permissions[moduleIndex] = { ...permissions[moduleIndex], actions: acts };
          }
        }
      }
      return { ...prev, permissions };
    });
  };

  const isPermissionChecked = (module, action) => {
    const modulePermission = formData.permissions.find(p => p.module === module);
    return modulePermission && modulePermission.actions.includes(action);
  };

  const handleSelectAll = (module) => {
    const modulePermission = formData.permissions.find(p => p.module === module);
    const allChecked = modulePermission && actions.every(a => modulePermission.actions.includes(a));
    setFormData(prev => {
      const permissions = prev.permissions.filter(p => p.module !== module);
      if (!allChecked) permissions.push({ module, actions: [...actions] });
      return { ...prev, permissions };
    });
  };

  const isAllChecked = (module) => {
    const modulePermission = formData.permissions.find(p => p.module === module);
    return modulePermission && actions.every(a => modulePermission.actions.includes(a));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editMode) {
        await api.put(`/roles/${editingRoleId}`, formData);
        // Clear pending changes for this role
        setPendingChanges(prev => {
          const updated = { ...prev };
          delete updated[editingRoleId];
          return updated;
        });
      } else {
        await api.post('/roles', formData);
      }
      handleCloseModal();
      fetchRoles(true);
    } catch (error) {
      alert(error.response?.data?.message || (editMode ? 'Error updating role' : 'Error creating role'));
    }
  };

  const handleEdit = (role) => {
    setEditMode(true);
    setEditingRoleId(role._id);
    setFormData({ name: role.name, permissions: role.permissions });
    setShowModal(true);
  };

  const handleDelete = async (roleId, isDefault) => {
    if (isDefault) { alert('Cannot delete default role'); return; }
    if (window.confirm('Are you sure you want to delete this role?')) {
      try {
        await api.delete(`/roles/${roleId}`);
        // Clear pending changes for this role
        setPendingChanges(prev => {
          const updated = { ...prev };
          delete updated[roleId];
          return updated;
        });
        fetchRoles(true);
      } catch (error) {
        alert(error.response?.data?.message || 'Error deleting role');
      }
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
    setEditingRoleId(null);
    setFormData({ name: '', permissions: [] });
  };

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Toggle component
  const Toggle = ({ checked, onChange, color, disabled }) => {
    const onColor = color || '#22c55e';
    return (
      <div
        onClick={disabled ? undefined : onChange}
        style={{
          width: '30px', height: '16px', borderRadius: '8px',
          background: checked ? (disabled ? '#a7f3d0' : onColor) : '#d1d5db',
          position: 'relative', cursor: disabled ? 'not-allowed' : (onChange ? 'pointer' : 'not-allowed'),
          transition: 'background 0.25s ease',
          flexShrink: 0,
          boxShadow: checked ? `0 0 0 1.5px ${onColor}30` : 'none',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <div style={{
          position: 'absolute', top: '2px',
          left: checked ? '16px' : '2px',
          width: '12px', height: '12px', borderRadius: '50%',
          background: 'white',
          transition: 'left 0.25s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
        }} />
      </div>
    );
  };

  const toggleColors = {
    create: '#a8e63d',
    read:   '#a8e63d',
    update: '#a8e63d',
    delete: '#a8e63d',
  };

  // Save inline permission changes for a role (batch mode)
  const handleInlineToggle = (role, module, action) => {
    const currentPermissions = pendingChanges[role._id]?.permissions || role.permissions;
    const permissions = currentPermissions.map(p => ({ ...p, actions: [...p.actions] }));
    const modIdx = permissions.findIndex(p => p.module === module);
    if (modIdx === -1) {
      permissions.push({ module, actions: [action] });
    } else {
      const acts = [...permissions[modIdx].actions];
      const aIdx = acts.indexOf(action);
      if (aIdx === -1) { acts.push(action); }
      else { acts.splice(aIdx, 1); }
      if (acts.length === 0) { permissions.splice(modIdx, 1); }
      else { permissions[modIdx] = { ...permissions[modIdx], actions: acts }; }
    }
    
    // Store pending changes
    setPendingChanges(prev => ({
      ...prev,
      [role._id]: { permissions }
    }));
  };

  // Apply pending changes for a role
  const handleSaveRole = async (roleId) => {
    const role = roles.find(r => r._id === roleId);
    const changes = pendingChanges[roleId];
    if (!role || !changes) return;

    try {
      await api.put(`/roles/${roleId}`, { name: role.name, permissions: changes.permissions });
      // Clear pending changes and refresh
      setPendingChanges(prev => {
        const updated = { ...prev };
        delete updated[roleId];
        return updated;
      });
      fetchRoles(true);
      // If the saved role matches the current user's role, refresh their session permissions
      if (user?.role?._id === roleId || user?.role === roleId) refreshUser();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving permissions');
    }
  };

  const hasAction = (role, module, action) => {
    // Check pending changes first, then fall back to saved permissions
    const permissions = pendingChanges[role._id]?.permissions || role.permissions;
    const perm = permissions.find(p => p.module === module);
    return !!(perm && perm.actions.includes(action));
  };

  return (
    <div className="page-container" style={{ padding: '20px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .roles-row:hover { background: #fafffe !important; }
        .roles-expand-row { animation: rolesSlideDown 0.2s ease; }
        @keyframes rolesSlideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .perm-module-row:hover { background: #f8fafc !important; }
        @media (max-width: 768px) {
          .roles-header-row {
            flex-wrap: wrap !important;
          }
          .roles-search-wrap {
            max-width: 100% !important;
            flex: 1 1 100% !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="roles-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div className="roles-search-wrap" style={{ position: 'relative', flex: '1', maxWidth: '360px' }}>
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search roles..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 16px 8px 38px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', background: '#fafafa', outline: 'none', color: '#111827', fontFamily: 'inherit' }}
            onFocus={e => { e.target.style.borderColor = '#9ca3af'; e.target.style.background = 'white'; }}
            onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#fafafa'; }}
          />
        </div>
        {canCreate && <button
          onClick={() => { setEditMode(false); setEditingRoleId(null); setFormData({ name: '', permissions: [] }); setShowModal(true); }}
          style={{ padding: '8px 16px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', background: '#3b775e', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', outline: 'none', transition: 'background 0.2s', fontFamily: 'inherit' }}
          onMouseEnter={e => e.currentTarget.style.background = '#2f6350'}
          onMouseLeave={e => e.currentTarget.style.background = '#3b775e'}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <line x1="7" y1="1" x2="7" y2="13" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
            <line x1="1" y1="7" x2="13" y2="7" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Create Role
        </button>}
      </div>

      {/* Main Table */}
      <div style={{ background: '#fff', borderRadius: '20px', overflowX: 'auto', boxShadow: '0 2px 16px rgba(0,0,0,0.06)' }}>
        {/* Header Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 90px 90px 90px 90px 85px 0.7fr 85px', padding: '0 12px', borderBottom: '1px solid #f1f5f9', background: '#fafafa', minWidth: '720px' }}>
          {[
            { label: 'Role Name' },
            { label: 'Create' },
            { label: 'Read' },
            { label: 'Update' },
            { label: 'Delete' },
            { label: 'Status', center: true },
            { label: 'Type', center: true },
            { label: 'Actions', right: true },
          ].map((col, i) => (
            <div key={i} style={{
              padding: '8px 0', paddingRight: i < 7 ? '8px' : '0',
              display: 'flex', alignItems: 'center', gap: '4px',
              fontSize: '10px', fontWeight: '600', letterSpacing: '0.03em',
              textTransform: 'uppercase', color: '#94a3b8',
              justifyContent: col.right ? 'flex-end' : col.center ? 'center' : 'flex-start'
            }}>
              {col.label}
            </div>
          ))}
        </div>

        {/* Loading Skeleton */}
        {loading && [1,2,3,4,5].map(i => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.8fr 90px 90px 90px 90px 85px 0.7fr 85px', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', gap: '0', minWidth: '720px' }}>
            <div style={{ height: '11px', background: '#f1f5f9', borderRadius: '4px', width: '45%' }}></div>
            {[1,2,3,4].map(j => <div key={j} style={{ height: '16px', width: '30px', background: '#f1f5f9', borderRadius: '8px' }}></div>)}
            <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ height: '18px', width: '54px', background: '#f1f5f9', borderRadius: '999px' }}></div></div>
            <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ height: '18px', width: '54px', background: '#f1f5f9', borderRadius: '999px' }}></div></div>
            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
              {[1,2].map(j => <div key={j} style={{ width: '24px', height: '24px', background: '#f1f5f9', borderRadius: '6px' }}></div>)}
            </div>
          </div>
        ))}

        {/* Empty */}
        {!loading && filteredRoles.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
              {searchTerm ? `No roles found matching "${searchTerm}"` : 'No roles found'}
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading && filteredRoles.map((role, index) => {
          const isExpanded = expandedRole === role._id;
          const allCreate = modules.every(m => hasAction(role, m, 'create'));
          const allRead   = modules.every(m => hasAction(role, m, 'read'));
          const allUpdate = modules.every(m => hasAction(role, m, 'update'));
          const allDelete = modules.every(m => hasAction(role, m, 'delete'));
          
          // Show active if ANY module has the permission
          const anyCreate = modules.some(m => hasAction(role, m, 'create'));
          const anyRead   = modules.some(m => hasAction(role, m, 'read'));
          const anyUpdate = modules.some(m => hasAction(role, m, 'update'));
          const anyDelete = modules.some(m => hasAction(role, m, 'delete'));

          // Count enabled per action
          const countCreate = modules.filter(m => hasAction(role, m, 'create')).length;
          const countRead   = modules.filter(m => hasAction(role, m, 'read')).length;
          const countUpdate = modules.filter(m => hasAction(role, m, 'update')).length;
          const countDelete = modules.filter(m => hasAction(role, m, 'delete')).length;

          return (
            <React.Fragment key={role._id}>
              {/* Role Row */}
              <div
                className="roles-row"
                style={{ display: 'grid', gridTemplateColumns: '1.8fr 90px 90px 90px 90px 85px 0.7fr 85px', padding: '0 12px', borderBottom: (!isExpanded && index < filteredRoles.length - 1) ? '1px solid #f8fafc' : isExpanded ? '1px solid #e5e7eb' : 'none', alignItems: 'center', transition: 'background 0.15s', background: isExpanded ? '#fafffe' : 'transparent', minWidth: '720px' }}
              >
                {/* Name + expand toggle */}
                <div 
                  onClick={() => setExpandedRole(isExpanded ? null : role._id)}
                  style={{ padding: '10px 8px 10px 0', display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer' }}
                >
                  <button
                    title={isExpanded ? 'Collapse' : 'Manage permissions'}
                    style={{ width: '20px', height: '20px', borderRadius: '5px', border: 'none', background: isExpanded ? '#e0f2fe' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, outline: 'none', transition: 'all 0.15s' }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={isExpanded ? '#0284c7' : '#64748b'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {isExpanded
                        ? <polyline points="18 15 12 9 6 15"/>
                        : <polyline points="6 9 12 15 18 9"/>}
                    </svg>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: '#0f172a', letterSpacing: '-0.01em' }}>{role.name}</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{role.permissions.length} module{role.permissions.length !== 1 ? 's' : ''}</div>
                    </div>
                    {/* Users Badge */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowRoleUsers(role);
                      }}
                      title="View users with this role"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '24px', height: '24px',
                        background: '#f1f5f9', color: '#64748b',
                        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#3b82f6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Create toggle (summary) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <Toggle disabled={!canUpdate} checked={anyCreate} color={toggleColors.create}
                    onChange={() => {
                      const currentPermissions = pendingChanges[role._id]?.permissions || role.permissions;
                      const newPerms = modules.map(m => {
                        const existing = currentPermissions.find(p => p.module === m);
                        const acts = existing ? [...existing.actions] : [];
                        // If all are on, turn all off; otherwise turn all on
                        if (allCreate) { const i = acts.indexOf('create'); if (i > -1) acts.splice(i,1); }
                        else { if (!acts.includes('create')) acts.push('create'); }
                        return { module: m, actions: acts };
                      }).filter(p => p.actions.length > 0);
                      setPendingChanges(prev => ({ ...prev, [role._id]: { permissions: newPerms } }));
                    }}
                  />
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '500' }}>{countCreate}/{modules.length}</span>
                </div>

                {/* Read toggle (summary) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <Toggle disabled={!canUpdate} checked={anyRead} color={toggleColors.read}
                    onChange={() => {
                      const currentPermissions = pendingChanges[role._id]?.permissions || role.permissions;
                      const newPerms = modules.map(m => {
                        const existing = currentPermissions.find(p => p.module === m);
                        const acts = existing ? [...existing.actions] : [];
                        // If all are on, turn all off; otherwise turn all on
                        if (allRead) { const i = acts.indexOf('read'); if (i > -1) acts.splice(i,1); }
                        else { if (!acts.includes('read')) acts.push('read'); }
                        return { module: m, actions: acts };
                      }).filter(p => p.actions.length > 0);
                      setPendingChanges(prev => ({ ...prev, [role._id]: { permissions: newPerms } }));
                    }}
                  />
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '500' }}>{countRead}/{modules.length}</span>
                </div>

                {/* Update toggle (summary) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <Toggle disabled={!canUpdate} checked={anyUpdate} color={toggleColors.update}
                    onChange={() => {
                      const currentPermissions = pendingChanges[role._id]?.permissions || role.permissions;
                      const newPerms = modules.map(m => {
                        const existing = currentPermissions.find(p => p.module === m);
                        const acts = existing ? [...existing.actions] : [];
                        // If all are on, turn all off; otherwise turn all on
                        if (allUpdate) { const i = acts.indexOf('update'); if (i > -1) acts.splice(i,1); }
                        else { if (!acts.includes('update')) acts.push('update'); }
                        return { module: m, actions: acts };
                      }).filter(p => p.actions.length > 0);
                      setPendingChanges(prev => ({ ...prev, [role._id]: { permissions: newPerms } }));
                    }}
                  />
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '500' }}>{countUpdate}/{modules.length}</span>
                </div>

                {/* Delete toggle (summary) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <Toggle disabled={!canUpdate} checked={anyDelete} color={toggleColors.delete}
                    onChange={() => {
                      const currentPermissions = pendingChanges[role._id]?.permissions || role.permissions;
                      const newPerms = modules.map(m => {
                        const existing = currentPermissions.find(p => p.module === m);
                        const acts = existing ? [...existing.actions] : [];
                        // If all are on, turn all off; otherwise turn all on
                        if (allDelete) { const i = acts.indexOf('delete'); if (i > -1) acts.splice(i,1); }
                        else { if (!acts.includes('delete')) acts.push('delete'); }
                        return { module: m, actions: acts };
                      }).filter(p => p.actions.length > 0);
                      setPendingChanges(prev => ({ ...prev, [role._id]: { permissions: newPerms } }));
                    }}
                  />
                  <span style={{ fontSize: '9px', color: '#94a3b8', fontWeight: '500' }}>{countDelete}/{modules.length}</span>
                </div>

                {/* Status - Save button */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {(canUpdate && pendingChanges[role._id]) ? (
                    <button
                      onClick={() => handleSaveRole(role._id)}
                      style={{ padding: '4px 9px', border: 'none', borderRadius: '5px', fontSize: '10px', fontWeight: '500', cursor: 'pointer', background: '#3b775e', color: 'white', outline: 'none', transition: 'background 0.2s', display: 'flex', alignItems: 'center', gap: '3px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#2f6350'}
                      onMouseLeave={e => e.currentTarget.style.background = '#3b775e'}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                        <polyline points="17 21 17 13 7 13 7 21"/>
                        <polyline points="7 3 7 8 15 8"/>
                      </svg>
                      Save
                    </button>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: '#f0fdf4', color: '#16a34a', fontSize: '10px', fontWeight: '500' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}></span>Saved
                    </span>
                  )}
                </div>

                {/* Type */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {role.isDefault
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: '#fffbeb', color: '#d97706', fontSize: '10px', fontWeight: '500' }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }}></span>Default
                      </span>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '999px', background: '#f0fdf4', color: '#16a34a', fontSize: '10px', fontWeight: '500' }}>
                        <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}></span>Custom
                      </span>
                  }
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', padding: '8px 0' }}>
                  {canUpdate && <button
                    onClick={() => { handleEdit(role); }}
                    title="Rename Role"
                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', transition: 'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fffbeb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>}
                  {canDelete && <button
                    onClick={() => handleDelete(role._id, role.isDefault)}
                    title="Delete Role"
                    disabled={role.isDefault}
                    style={{ width: '26px', height: '26px', borderRadius: '6px', border: 'none', background: 'transparent', cursor: role.isDefault ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none', transition: 'all 0.15s', opacity: role.isDefault ? 0.3 : 1 }}
                    onMouseEnter={e => { if (!role.isDefault) e.currentTarget.style.background = '#fff1f2'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>}
                </div>
              </div>

              {/* Expanded per-module permissions */}
              {isExpanded && (
                <div className="roles-expand-row" style={{ borderBottom: index < filteredRoles.length - 1 ? '1px solid #e5e7eb' : 'none', background: '#fafcff' }}>
                  {/* Sub-header */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 90px 90px 90px 90px 85px 0.7fr 85px', padding: '6px 12px', background: '#f1f5f9', borderBottom: '1px solid #e5e7eb', minWidth: '720px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', paddingLeft: '27px' }}>Module</div>
                    {['Create','Read','Update','Delete'].map((a) => (
                      <div key={a} style={{ fontSize: '11px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{a}</div>
                    ))}
                    <div></div><div></div><div></div>
                  </div>

                  {/* Module rows */}
                  <div className="custom-scrollbar" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
                    {modules.map((module, mIdx) => (
                      <div
                        key={module}
                        className="perm-module-row"
                        style={{ display: 'grid', gridTemplateColumns: '1.8fr 90px 90px 90px 90px 85px 0.7fr 85px', padding: '7px 12px', borderBottom: mIdx < modules.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'center', transition: 'background 0.12s', minWidth: '720px' }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827', paddingLeft: '27px' }}>
                          {getModuleLabel(module)}
                        </div>
                        {actions.map(action => (
                          <div key={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                            <Toggle
                              disabled={!canUpdate}
                              checked={hasAction(role, module, action)}
                              color={toggleColors[action]}
                              onChange={canUpdate ? () => handleInlineToggle(role, module, action) : undefined}
                            />
                          </div>
                        ))}
                        <div></div><div></div><div></div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Create / Rename Modal */}
      {showModal && (
        <div
          onClick={handleCloseModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', fontFamily: 'inherit', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>{editMode ? 'Rename Role' : 'Create Role'}</h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>{editMode ? 'Update the role name' : 'Set a name — configure permissions inline'}</p>
              </div>
              <button
                onClick={handleCloseModal}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#64748b', outline: 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >×</button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '20px 24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Role Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g. HR Manager"
                style={{ width: '100%', padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', outline: 'none', fontFamily: 'inherit', color: '#0f172a', background: '#fafafa' }}
                onFocus={e => { e.target.style.borderColor = '#3b775e'; e.target.style.background = 'white'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#fafafa'; }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button" onClick={handleCloseModal}
                  style={{ padding: '8px 20px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', background: 'white', color: '#374151', outline: 'none', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >Cancel</button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', background: '#3b775e', color: 'white', outline: 'none', fontFamily: 'inherit', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2f6350'}
                  onMouseLeave={e => e.currentTarget.style.background = '#3b775e'}
                >{editMode ? 'Save Changes' : 'Create Role'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Role Users Modal */}
      {showRoleUsersModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0f172a' }}>Users with {selectedRoleForUsers?.name} role</h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>{roleUsers.length} user{roleUsers.length !== 1 ? 's' : ''} found</p>
              </div>
              <button
                onClick={() => setShowRoleUsersModal(false)}
                style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: '#f1f5f9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#64748b', outline: 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'}
                onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}
              >x</button>
            </div>
            <div style={{ padding: '0', maxHeight: '350px', overflowY: 'auto' }}>
              {loadingRoleUsers ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>Loading users...</div>
              ) : roleUsers.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No users found with this role.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {roleUsers.map(emp => (
                    <div key={emp._id} style={{ display: 'flex', alignItems: 'center', padding: '12px 24px', borderBottom: '1px solid #f8fafc' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '12px', marginRight: '12px' }}>
                        {emp.firstName?.charAt(0) || ''}{emp.lastName?.charAt(0) || ''}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#0f172a' }}>{emp.firstName} {emp.lastName}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{emp.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Roles;
