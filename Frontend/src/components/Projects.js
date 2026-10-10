import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useContextualQueryState } from "../utils/routeUtils";
import NotificationBell from './NotificationBell';
import { COUNTRIES } from "../utils/countries";

const emptyProjectForm = {
  name: "",
  selectedClientId: "",
  clientName: "",
  clientCompany: "",
  clientEmail: "",
  clientPhone: "",
  description: "",
  projectTypes: [],
  assignedEmployees: [],
  startDate: "",
  deadline: "",
  status: "active",
  projectValue: "",
  priority: "medium",
  country: "",
  currency: "",
};

const CustomStatusSelect = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const options = [
    { value: "active", label: "Progress" },
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
    { value: "on-hold", label: "On Hold" },
  ];
  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{ height: "42px", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: "#0f172a", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
      >
        {selectedOption.label}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      {isOpen && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 25px rgba(15,23,42,0.1)", padding: "6px", zIndex: 1000, display: "flex", flexDirection: "column", gap: "2px" }}>
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setIsOpen(false); }}
              style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: value === opt.value ? "#15803d" : "#475569", background: value === opt.value ? "#f0fdf4" : "transparent", fontWeight: value === opt.value ? 600 : 500, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => { if (value !== opt.value) e.currentTarget.style.background = "#f1f5f9"; }}
              onMouseLeave={(e) => { if (value !== opt.value) e.currentTarget.style.background = "transparent"; }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SearchableSelect = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => { setIsOpen(!isOpen); setSearch(""); }}
        style={{ height: "42px", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: value ? "#0f172a" : "#94a3b8", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      {isOpen && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 25px rgba(15,23,42,0.1)", padding: "6px", zIndex: 1000, display: "flex", flexDirection: "column", maxHeight: "200px" }}>
          <input 
            type="text" 
            placeholder="Search..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", marginBottom: "6px", outline: "none", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "8px 12px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>No results found</div>
            ) : (
              filtered.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: value === opt.value ? "#15803d" : "#475569", background: value === opt.value ? "#f0fdf4" : "transparent", fontWeight: value === opt.value ? 600 : 500, cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={(e) => { if (value !== opt.value) e.currentTarget.style.background = "#f1f5f9"; }}
                  onMouseLeave={(e) => { if (value !== opt.value) e.currentTarget.style.background = "transparent"; }}
                >
                  {opt.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const getTypeColor = (type) => {
  const colors = [
    { bg: "#dbeafe", color: "#1e40af", border: "#bfdbfe" }, // blue
    { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" }, // green
    { bg: "#f3e8ff", color: "#6b21a8", border: "#e9d5ff" }, // purple
    { bg: "#ffedd5", color: "#9a3412", border: "#fed7aa" }, // orange
    { bg: "#fce7f3", color: "#9d174d", border: "#fbcfe8" }, // pink
    { bg: "#e0e7ff", color: "#3730a3", border: "#c7d2fe" }, // indigo
    { bg: "#ecfccb", color: "#3f6212", border: "#d9f99d" }, // lime
    { bg: "#fef08a", color: "#854d0e", border: "#fde047" }, // yellow
  ];
  let hash = 0;
  for (let i = 0; i < type.length; i++) {
    hash = type.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const SearchableMultiSelect = ({ values = [], onChange, options, placeholder, allowAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const showAdd = allowAdd && search.trim() !== "" && !options.some(o => o.label.toLowerCase() === search.trim().toLowerCase());

  const toggleOption = (val) => {
    if (values.includes(val)) {
      onChange(values.filter(v => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        onClick={() => { setIsOpen(!isOpen); setSearch(""); }}
        style={{ minHeight: "42px", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "6px 12px", fontSize: "12px", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", flexWrap: "wrap", gap: "6px" }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", flex: 1 }}>
          {values.length === 0 ? (
            <span style={{ color: "#94a3b8", padding: "4px 0" }}>{placeholder}</span>
          ) : (
            values.map(val => {
              const opt = options.find(o => o.value === val) || { label: val };
              return (
                <div key={val} style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px", color: "#334155", fontWeight: 500 }}>
                  {opt.label}
                  <div onClick={(e) => { e.stopPropagation(); toggleOption(val); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "14px", height: "14px", borderRadius: "50%", background: "#cbd5e1", color: "#fff", fontSize: "10px", cursor: "pointer" }}>x</div>
                </div>
              );
            })
          )}
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="6 9 12 15 18 9" /></svg>
      </div>
      {isOpen && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 25px rgba(15,23,42,0.1)", padding: "6px", zIndex: 1000, display: "flex", flexDirection: "column", maxHeight: "200px" }}>
          <input 
            type="text" 
            placeholder="Search or add new..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px", marginBottom: "6px", outline: "none", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
            {filtered.length === 0 && !showAdd ? (
              <div style={{ padding: "8px 12px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>No results found</div>
            ) : (
              filtered.map((opt) => {
                const isSelected = values.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: isSelected ? "#15803d" : "#475569", background: isSelected ? "#dcfce7" : "transparent", fontWeight: isSelected ? 600 : 500, cursor: "pointer", transition: "background 0.15s", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#f1f5f9"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                  >
                    {opt.label}
                    {isSelected && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                );
              })
            )}
            {showAdd && (
              <div
                onClick={() => { toggleOption(search.trim()); setSearch(""); }}
                style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: "#2563eb", background: "#eff6ff", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add "{search.trim()}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StatusDropdownCell = ({ project, onStatusChange, isOverdue, statusStyle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const overdue = isOverdue(project);
  const displayLabel = project.status === 'active' ? 'Progress'
    : project.status === 'pending' ? 'Pending'
    : project.status === 'on-hold' ? 'On Hold'
    : project.status === 'completed' ? 'Completed'
    : project.status;

  const statuses = [
    { value: 'active', label: 'Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'on-hold', label: 'On Hold' },
    { value: 'review', label: 'Review' },
    { value: 'canceled', label: 'Canceled' }
  ];

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}
      >
        <span
          className={overdue ? 'proj-overdue-badge' : ''}
          style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, ...(overdue ? {} : statusStyle(project.status)) }}
        >
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor" }} />
          {displayLabel}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "2px", opacity: 0.6 }}><polyline points="6 9 12 15 18 9" /></svg>
        </span>
        {overdue && (
          <span className="proj-overdue-clock" style={{ display: 'inline-flex', alignItems: 'center', color: '#dc2626', flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="proj-overdue-tip">Overdue</span>
          </span>
        )}
      </div>

      {isOpen && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 10px 25px rgba(15,23,42,0.1)", padding: "4px", zIndex: 1000, display: "flex", flexDirection: "column", minWidth: "120px" }}>
          {statuses.map(s => (
            <div
              key={s.value}
              onClick={() => {
                setIsOpen(false);
                if (s.value !== project.status) onStatusChange(project._id, s.value);
              }}
              style={{ padding: "6px 12px", fontSize: "11px", fontWeight: 600, color: project.status === s.value ? "#15803d" : "#475569", background: project.status === s.value ? "#f0fdf4" : "transparent", borderRadius: "6px", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={(e) => { if (project.status !== s.value) e.currentTarget.style.background = "#f1f5f9"; }}
              onMouseLeave={(e) => { if (project.status !== s.value) e.currentTarget.style.background = "transparent"; }}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function Projects() {
  const { user, hasPermission } = useAuth();

  const [{ search: searchTerm, status: filterStatus, page: currentPage }, setQueryState] = useContextualQueryState({
    ref: 'sidebar',
    tab: 'all',
    status: '',
    search: '',
    page: 1,
  });

  const setSearchTerm = useCallback((search) => setQueryState({ search, page: 1 }), [setQueryState]);
  const setFilterStatus = useCallback((status) => setQueryState({ status, page: 1 }), [setQueryState]);
  const setCurrentPage = useCallback((page) => setQueryState((prev) => ({ page: typeof page === 'function' ? page(prev.page || 1) : page })), [setQueryState]);

  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [clients, setClients] = useState([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOldRecords, setShowOldRecords] = useState(false);
  const [openFilterDrop, setOpenFilterDrop] = useState(null);
  const filterDropRef = useRef(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [viewProject, setViewProject] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [addForm, setAddForm] = useState(emptyProjectForm);
  const [editForm, setEditForm] = useState(emptyProjectForm);
  const [addFormErrors, setAddFormErrors] = useState({});
  const [editFormErrors, setEditFormErrors] = useState({});
  const [savingAdd, setSavingAdd] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [actionMenu, setActionMenu] = useState(null);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [projectTypesList, setProjectTypesList] = useState([]);
  const clientDropdownRef = useRef(null);

  const PROJECTS_PER_PAGE = 10;
  const isAdmin = user?.role?.name === 'Admin';
  const canCreate = hasPermission?.("projects", "create");
  const canUpdate = hasPermission?.("projects", "update");
  const canDelete = hasPermission?.("projects", "delete");

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/projects");
      setProjects(res.data || []);
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get("/employees");
      setEmployees(res.data || []);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const [leadsRes, metaRes, clientsRes] = await Promise.allSettled([
        api.get("/leads", { params: { status: "Client" } }),
        api.get("/meta-leads", { params: { status: "Client", limit: 1000 } }),
        api.get("/clients"),
      ]);
      const crm = leadsRes.status === "fulfilled"
        ? (leadsRes.value.data || []).map((l) => ({
          id: l._id, name: l.name || l.company || "Untitled",
          company: l.company || "", email: l.email || "", phone: l.phone || "",
        }))
        : [];
      const meta = metaRes.status === "fulfilled"
        ? (metaRes.value.data?.leads || []).map((l) => ({
          id: l._id, name: l.name || l.businessCategory || "Untitled",
          company: l.businessCategory || l.pageName || "", email: l.email || "", phone: l.phone || "",
        }))
        : [];
      const clientsData = clientsRes.status === "fulfilled"
        ? (clientsRes.value.data || []).map((c) => ({
          id: c._id, name: c.name || c.company || "Untitled",
          company: c.company || "", email: c.email || "", phone: c.phone || "",
        }))
        : [];
      setClients([...crm, ...meta, ...clientsData]);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchEmployees();
    fetchClients();
  }, [fetchProjects, fetchEmployees, fetchClients]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    if (viewId && projects.length > 0) {
      const proj = projects.find(p => p._id === viewId);
      if (proj && !viewProject) {
        setViewProject(proj);
      }
    }
  }, [projects]);

  const isOverdue = (p) => p.deadline && p.status === "active" && new Date(p.deadline) < new Date();

  const formatDate = (v) => {
    if (!v) return "-";
    return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const generateProjectId = (projectName, projectId) => {
    if (!projectName) return projectId ? projectId.substring(0, 6).toUpperCase() : "PROJ";
    const letters = String(projectName).replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase();
    const prefix = letters.padEnd(3, "X"); // Pad with X if less than 3 letters

    // Find the index of this project in the complete list
    const projectIndex = projects.findIndex(p => p._id === projectId);
    const number = (projectIndex + 1).toString().padStart(3, "0");

    return `${prefix}${number}`;
  };

  const visibleProjects = useMemo(() => {
    const cutoffDate = new Date('2026-05-01T00:00:00');
    return projects.filter((p) => {
      const projDate = new Date(p.createdAt || p.startDate || 0);
      if (showOldRecords) {
        return projDate < cutoffDate;
      }
      return projDate >= cutoffDate;
    });
  }, [projects, showOldRecords]);

  const stats = useMemo(() => {
    const total = visibleProjects.length;
    const active = visibleProjects.filter((p) => p.status === "active").length;
    const completed = visibleProjects.filter((p) => p.status === "completed").length;
    const overdue = visibleProjects.filter((p) => isOverdue(p)).length;
    return { total, active, completed, overdue };
  }, [visibleProjects]);

  const prevMonthStats = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const prev = visibleProjects.filter((p) => {
      const d = new Date(p.createdAt);
      return d >= start && d <= end;
    });
    return {
      total: prev.length,
      active: prev.filter((p) => p.status === "active").length,
      completed: prev.filter((p) => p.status === "completed").length,
      overdue: prev.filter((p) => isOverdue(p)).length,
    };
  }, [visibleProjects]);

  const calcChange = (cur, prev) => {
    if (prev === 0) return cur > 0 ? "+100%" : "0%";
    const pct = ((cur - prev) / prev) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
  };
  const isUp = (cur, prev) => cur >= prev;

  const filteredProjects = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return visibleProjects.filter((p) => {
      // Status filter
      if (filterStatus === 'overdue') {
        if (!isOverdue(p)) return false;
      } else if (filterStatus) {
        if (p.status !== filterStatus) return false;
      }
      // Search filter: project id (generated), name, clientName, clientEmail, clientCompany
      if (term) {
        // Generate project id for searching
        const letters = (p.name || "").replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase().padEnd(3, "X");
        const projIndex = projects.findIndex(pr => pr._id === p._id);
        const generatedId = `${letters}${String(projIndex + 1).padStart(3, "0")}`;
        const searchables = [generatedId, p.name, p.clientName, p.clientEmail, p.clientCompany];
        if (!searchables.filter(Boolean).some((v) => String(v).toLowerCase().includes(term))) return false;
      }
      return true;
    });
  }, [visibleProjects, projects, searchTerm, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE));
  const pageStart = (currentPage - 1) * PROJECTS_PER_PAGE;
  const paginated = filteredProjects.slice(pageStart, pageStart + PROJECTS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filterStatus, visibleProjects.length]);
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  // Close filter dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (filterDropRef.current && !filterDropRef.current.contains(e.target)) {
        setOpenFilterDrop(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!actionMenu) return;
    const handleClick = (e) => {
      if (!e.target.closest("[data-proj-action-menu]")) setActionMenu(null);
    };
    const handleKey = (e) => { if (e.key === "Escape") setActionMenu(null); };
    const handleResize = () => setActionMenu(null);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [actionMenu]);

  const toggleActionMenu = (e, projId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const menuH = 100;
    const menuW = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < menuH + 8 && rect.top > menuH + 8;
    setActionMenu((prev) => {
      if (prev?.id === projId) return null;
      return {
        id: projId,
        top: openAbove ? rect.top - menuH - 8 : rect.bottom + 8,
        left: Math.min(Math.max(12, rect.right - menuW), window.innerWidth - menuW - 12),
      };
    });
  };

  const updateField = (setForm, setErrors, key, value) => {
    let finalValue = value;
    if (key === "clientPhone") {
      finalValue = value.replace(/[^\d+]/g, "");
    }
    setForm((prev) => ({ ...prev, [key]: finalValue }));

    let error = "";
    if (key === "clientEmail" && finalValue.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalValue.trim())) error = "Invalid email";
    }

    setErrors((prev) => {
      if (error) return { ...prev, [key]: error };
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateForm = (data, setErrors, isEdit = false) => {
    const errors = {};
    if (!data.name.trim()) errors.name = "Project name is required.";

    if (data.clientEmail && data.clientEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.clientEmail.trim())) {
        errors.clientEmail = "Invalid email format.";
      }
    }

    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleClientSelect = (clientId, setForm) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setForm((prev) => ({
        ...prev,
        selectedClientId: clientId,
        clientName: client.name,
        clientCompany: client.company,
        clientEmail: client.email,
        clientPhone: client.phone,
      }));
    } else {
      // Reset to empty when no client selected
      setForm((prev) => ({
        ...prev,
        selectedClientId: "",
        clientName: "",
        clientCompany: "",
        clientEmail: "",
        clientPhone: "",
      }));
    }
  };

  const toggleEmployee = (setForm, empId) => {
    setForm((prev) => ({
      ...prev,
      assignedEmployees: prev.assignedEmployees.includes(empId)
        ? prev.assignedEmployees.filter((id) => id !== empId)
        : [...prev.assignedEmployees, empId],
    }));
  };

  const filteredClients = clients.filter((c) =>
    [c.name, c.company, c.email].filter(Boolean).some((v) =>
      String(v).toLowerCase().includes(clientSearchTerm.toLowerCase())
    )
  );
  const filteredEmployees = employees.filter((e) =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(employeeSearchTerm.toLowerCase()) ||
    String(e.employeeId).toLowerCase().includes(employeeSearchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setAddForm({ ...emptyProjectForm });
    setAddFormErrors({});
    setEmployeeSearchTerm("");
    setClientSearchTerm("");
    setShowClientDropdown(false);
    setShowAddModal(true);
  };
  const closeAddModal = () => {
    if (savingAdd) return;
    setAddForm({ ...emptyProjectForm });
    setAddFormErrors({});
    setShowAddModal(false);
  };
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!validateForm(addForm, setAddFormErrors, false)) return;
    setSavingAdd(true);
    try {
      const formData = new FormData();
      formData.append('name', addForm.name);
      formData.append('clientName', addForm.clientName.trim() || 'Unknown');
      formData.append('clientCompany', addForm.clientCompany.trim() || 'Do not know');
      formData.append('clientEmail', addForm.clientEmail.trim() || 'Not provided');
      formData.append('clientPhone', addForm.clientPhone.trim() || 'Not provided');
      formData.append('description', addForm.description || '');
      formData.append('projectValue', addForm.projectValue || 0);
      formData.append('priority', addForm.priority);
      formData.append('status', addForm.status);
      formData.append('country', addForm.country || '');
      formData.append('currency', addForm.currency || '');
      // Dates are optional for add, will be set from assignments
      if (addForm.startDate) formData.append('startDate', addForm.startDate);
      if (addForm.deadline) formData.append('deadline', addForm.deadline);
      formData.append('assignedEmployees', JSON.stringify(addForm.assignedEmployees || []));
      formData.append('projectTypes', JSON.stringify(addForm.projectTypes || []));

      await api.post("/projects", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      closeAddModal();
      await fetchProjects();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to create project.");
    } finally {
      setSavingAdd(false);
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    try {
      const formData = new FormData();
      formData.append('status', newStatus);
      await api.put(`/projects/${projectId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchProjects();
    } catch (err) {
      console.error("Failed to change status:", err);
      alert("Failed to change status");
    }
  };

  const openEditModal = (project) => {
    setEditingProject(project);
    // Try to find matching client
    const matchingClient = clients.find(
      (c) => c.name === project.clientName || c.email === project.clientEmail
    );
    setEditForm({
      name: project.name || "",
      selectedClientId: matchingClient?.id || "",
      clientName: project.clientName === "Unknown" ? "" : (project.clientName || ""),
      clientCompany: project.clientCompany === "Do not know" ? "" : (project.clientCompany || ""),
      clientEmail: project.clientEmail === "Not provided" ? "" : (project.clientEmail || ""),
      clientPhone: project.clientPhone === "Not provided" ? "" : (project.clientPhone || ""),
      description: project.description || "",
      assignedEmployees: project.assignedEmployees?.map((e) => e._id || e) || [],
      startDate: project.startDate ? new Date(project.startDate).toISOString().split("T")[0] : "",
      deadline: project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "",
      status: project.status || 'active',
      projectValue: project.projectValue || "",
      priority: project.priority || "medium",
      country: project.country || "",
      currency: project.currency || "",
      projectTypes: project.projectTypes || [],
    });
    setEditFormErrors({});
    setEmployeeSearchTerm("");
    setClientSearchTerm("");
    setShowClientDropdown(false);
    setShowEditModal(true);
    setActionMenu(null);
  };
  const closeEditModal = () => {
    if (savingEdit) return;
    setEditingProject(null);
    setEditForm({ ...emptyProjectForm });
    setEditFormErrors({});
    setShowEditModal(false);
  };
  const handleEdit = async (e) => {
    e.preventDefault();
    if (!validateForm(editForm, setEditFormErrors, true)) return;
    setSavingEdit(true);
    try {
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('clientName', editForm.clientName);
      formData.append('clientCompany', editForm.clientCompany || '');
      formData.append('clientEmail', editForm.clientEmail || '');
      formData.append('clientPhone', editForm.clientPhone || '');
      formData.append('description', editForm.description || '');
      formData.append('projectValue', editForm.projectValue || 0);
      formData.append('priority', editForm.priority);
      formData.append('status', editForm.status);
      formData.append('country', editForm.country || '');
      formData.append('currency', editForm.currency || '');
      formData.append('startDate', editForm.startDate);
      formData.append('deadline', editForm.deadline);
      formData.append('assignedEmployees', JSON.stringify(editForm.assignedEmployees || []));
      formData.append('projectTypes', JSON.stringify(editForm.projectTypes || []));

      await api.put(`/projects/${editingProject._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      closeEditModal();
      await fetchProjects();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to update project.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (project) => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${project._id}`);
      await fetchProjects();
    } catch (err) {
      alert(err.response?.data?.message || err.message || "Failed to delete project.");
    }
    setActionMenu(null);
  };

  const statusStyle = (status) => {
    switch (status) {
      case "active":
      case "in-progress": return { color: "#0369a1", background: "#e0f2fe" };
      case "pending": return { color: "#7c3aed", background: "#ede9fe" };
      case "completed": return { color: "#1e40af", background: "#dbeafe" };
      case "on-hold": return { color: "#92400e", background: "#fef3c7" };
      case "overdue": return { color: "#991b1b", background: "#fee2e2" };
      default: return { color: "#475569", background: "#f1f5f9" };
    }
  };
  const priorityStyle = (priority) => {
    switch (priority) {
      case "high": return { color: "#991b1b", background: "#fee2e2" };
      case "medium": return { color: "#92400e", background: "#fef3c7" };
      case "low": return { color: "#166534", background: "#dcfce7" };
      default: return { color: "#475569", background: "#f1f5f9" };
    }
  };

  const getCurrencySymbol = (currencyCode) => {
    if (!currencyCode) return "₹";
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode }).formatToParts(0).find(x => x.type === 'currency').value;
    } catch (e) {
      return currencyCode;
    }
  };

  const renderForm = (form, setForm, errors, setErrors, onSubmit, saving, isEdit) => (
    <form onSubmit={onSubmit}>
      <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px", maxHeight: "75vh", overflowY: "auto" }}>
        <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Project Name *
          <input type="text" value={form.name} onChange={(e) => updateField(setForm, setErrors, "name", e.target.value)} placeholder="Enter project name"
            style={{ height: "42px", borderRadius: "10px", border: errors.name ? "1px solid #ef4444" : "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none" }} />
          {errors.name && <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>{errors.name}</span>}
        </label>

        <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Project Type
          <SearchableMultiSelect
            values={form.projectTypes || []}
            onChange={(vals) => updateField(setForm, setErrors, "projectTypes", vals)}
            options={projectTypesList.map(t => ({ label: t, value: t }))}
            placeholder="Select project types..."
            allowAdd={true}
          />
        </label>

        <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Select Client <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "11px" }}>(optional — or fill details below manually)</span>
          <select value={form.selectedClientId} onChange={(e) => { handleClientSelect(e.target.value, setForm); setErrors((prev) => { const next = { ...prev }; delete next.clientName; return next; }); }}
            style={{ height: "42px", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none", background: "#fff" }}>
            <option value="">-- Select a client --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company ? `(${c.company})` : ""}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Client Name
          <input type="text" value={form.clientName} readOnly={!!form.selectedClientId}
            onChange={(e) => updateField(setForm, setErrors, "clientName", e.target.value)}
            placeholder="Client name"
            style={{ height: "42px", borderRadius: "10px", border: errors.clientName ? "1px solid #ef4444" : "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none", background: form.selectedClientId ? "#f8fafc" : "#fff", cursor: form.selectedClientId ? "not-allowed" : "text" }} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Client Company
          <input type="text" value={form.clientCompany} readOnly={!!form.selectedClientId}
            onChange={(e) => updateField(setForm, setErrors, "clientCompany", e.target.value)} placeholder="Company name"
            style={{ height: "42px", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none", background: form.selectedClientId ? "#f8fafc" : "#fff", cursor: form.selectedClientId ? "not-allowed" : "text" }} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Client Email
          <input type="email" value={form.clientEmail} readOnly={!!form.selectedClientId}
            onChange={(e) => updateField(setForm, setErrors, "clientEmail", e.target.value)} placeholder="Client Email"
            style={{ height: "42px", borderRadius: "10px", border: errors.clientEmail ? "1px solid #ef4444" : "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none", background: form.selectedClientId ? "#f8fafc" : "#fff", cursor: form.selectedClientId ? "not-allowed" : "text" }} />
          {errors.clientEmail && <span style={{ color: "#ef4444", fontSize: "10px", fontWeight: "500", marginTop: "-2px" }}>{errors.clientEmail}</span>}
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Client Phone
          <input type="tel" value={form.clientPhone} readOnly={!!form.selectedClientId}
            onChange={(e) => updateField(setForm, setErrors, "clientPhone", e.target.value)} placeholder="Enter Phone Number"
            style={{ height: "42px", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none", background: form.selectedClientId ? "#f8fafc" : "#fff", cursor: form.selectedClientId ? "not-allowed" : "text" }} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Status
          <CustomStatusSelect value={form.status} onChange={(val) => updateField(setForm, setErrors, "status", val)} />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Priority
          <select value={form.priority} onChange={(e) => updateField(setForm, setErrors, "priority", e.target.value)}
            style={{ height: "42px", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "0 12px", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none", background: "#fff" }}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Country
          <SearchableSelect
            value={form.country}
            onChange={(val) => {
              updateField(setForm, setErrors, "country", val);
              const selectedCountry = COUNTRIES.find(c => c.name === val);
              if (selectedCountry) {
                updateField(setForm, setErrors, "currency", selectedCountry.currency);
              }
            }}
            options={COUNTRIES.map(c => ({ label: c.name, value: c.name }))}
            placeholder="Select Country"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Currency
          <SearchableSelect
            value={form.currency}
            onChange={(val) => {
              updateField(setForm, setErrors, "currency", val);
              const selectedCountry = COUNTRIES.find(c => c.currency === val);
              if (selectedCountry) {
                updateField(setForm, setErrors, "country", selectedCountry.name);
              }
            }}
            options={Array.from(new Set(COUNTRIES.map(c => c.currency))).sort().map(cur => ({ label: cur, value: cur }))}
            placeholder="Select Currency"
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Project Value
          <div style={{ display: "flex", alignItems: "center", width: "100%", height: "42px", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "0 12px", background: "#fff", overflow: "hidden" }}>
            <span style={{ color: "#64748b", fontSize: "13px", fontWeight: 600, marginRight: "8px", whiteSpace: "nowrap" }}>{getCurrencySymbol(form.currency)}</span>
            <input type="number" value={form.projectValue} onChange={(e) => updateField(setForm, setErrors, "projectValue", e.target.value)} placeholder="0" min="0"
              style={{ flex: 1, border: "none", outline: "none", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", background: "transparent", minWidth: 0 }} />
          </div>
        </label>

        <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
          Description
          <textarea rows={3} value={form.description} onChange={(e) => updateField(setForm, setErrors, "description", e.target.value)} placeholder="Project scope and requirements"
            style={{ borderRadius: "12px", border: "1px solid #e2e8f0", padding: "10px 12px", fontSize: "12px", color: "#0f172a", resize: "vertical", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none" }} />
        </label>
      </div>

      <div style={{ padding: "16px 22px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
        <button type="button" onClick={isEdit ? closeEditModal : closeAddModal}
          style={{ padding: "9px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
          Cancel
        </button>
        <button type="submit" disabled={saving}
          style={{ padding: "9px 14px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
          {saving ? "Saving..." : isEdit ? "Save Changes" : "Create Project"}
        </button>
      </div>
    </form>
  );

  if (loading) {
    return (
      <div className="page-container" style={{ minHeight: "100vh", background: "#f8fafc", padding: "28px 28px 40px", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
        <style>{`
          @keyframes proj-skeleton-shimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
          .proj-skeleton { background: linear-gradient(90deg, #eef2f7 25%, #f8fafc 37%, #eef2f7 63%); background-size: 400% 100%; animation: proj-skeleton-shimmer 1.4s ease infinite; }
        `}</style>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div className="proj-skeleton" style={{ width: 140, height: 34, borderRadius: 8, marginBottom: 8 }} />
            <div className="proj-skeleton" style={{ width: 300, height: 14, borderRadius: 6 }} />
          </div>
          <div className="proj-skeleton" style={{ width: 116, height: 38, borderRadius: 10 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "22px" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px" }}>
              <div className="proj-skeleton" style={{ width: "44%", height: 13, borderRadius: 6, marginBottom: 14 }} />
              <div className="proj-skeleton" style={{ width: "28%", height: 34, borderRadius: 8, marginBottom: 12 }} />
              <div className="proj-skeleton" style={{ width: 34, height: 3, borderRadius: 999 }} />
            </div>
          ))}
        </div>
        <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", background: "#fafafa" }}>
            <div className="proj-skeleton" style={{ width: 340, height: 40, borderRadius: 10 }} />
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f8fafc" }}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} style={{ padding: "11px 14px" }}>
                      <div className="proj-skeleton" style={{ width: `${50 + (j % 3) * 20}%`, height: 12, borderRadius: 6 }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const metricsData = [
    { label: "Total Projects", filterValue: "", value: stats.total, color: "#667eea", trend: calcChange(stats.total, prevMonthStats.total), up: isUp(stats.total, prevMonthStats.total) },
    { label: "In Progress", filterValue: "active", value: stats.active, color: "#10b981", trend: calcChange(stats.active, prevMonthStats.active), up: isUp(stats.active, prevMonthStats.active) },
    { label: "Completed", filterValue: "completed", value: stats.completed, color: "#8b5cf6", trend: calcChange(stats.completed, prevMonthStats.completed), up: isUp(stats.completed, prevMonthStats.completed) },
    { label: "Overdue", filterValue: "overdue", value: stats.overdue, color: "#ef4444", trend: calcChange(stats.overdue, prevMonthStats.overdue), up: !isUp(stats.overdue, prevMonthStats.overdue) },
  ];
  const handleExportCSV = () => {
    const headers = ["Project ID", "Project Name", "Client Name", "Email", "Company", "Start Date", "Deadline", "Status", "Value"];
    const csvRows = [headers.join(",")];

    filteredProjects.forEach((p) => {
      const generatedId = generateProjectId(p.name, p._id);
      const displayStatus = isOverdue(p) ? 'overdue' : p.status;
      const row = [
        `"${generatedId}"`,
        `"${p.name || ''}"`,
        `"${p.clientName || ''}"`,
        `"${p.clientEmail || ''}"`,
        `"${p.clientCompany || ''}"`,
        `"${formatDate(p.startDate)}"`,
        `"${formatDate(p.deadline)}"`,
        `"${displayStatus}"`,
        `"${p.projectValue || ''}"`
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "projects_export.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container" style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f8fafc", padding: "28px 28px 40px", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
      <style>{`
        @keyframes proj-bubble-float-large {
          0% { transform: translate(0px, 0px) scale(1); }
          30% { transform: translate(-5px, -7px) scale(1.04); }
          60% { transform: translate(4px, -4px) scale(0.97); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes proj-bubble-float-small {
          0% { transform: translate(0px, 0px) scale(1); }
          35% { transform: translate(6px, -9px) scale(1.06); }
          65% { transform: translate(-4px, -3px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes proj-overdue-wave {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes proj-clock-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.65; transform: scale(1.18); }
        }
        .proj-overdue-badge {
          background: linear-gradient(90deg, #fee2e2 0%, #fca5a5 30%, #fee2e2 55%, #fecaca 75%, #fee2e2 100%) !important;
          background-size: 300% 100% !important;
          animation: proj-overdue-wave 2.4s ease-in-out infinite !important;
          color: #991b1b !important;
        }
        .proj-overdue-clock {
          animation: proj-clock-pulse 1.8s ease-in-out infinite;
          cursor: default;
          position: relative;
        }
        .proj-overdue-clock .proj-overdue-tip {
          display: none;
          position: absolute;
          bottom: calc(100% + 5px);
          left: 50%;
          transform: translateX(-50%);
          background: #1e293b;
          color: #fff;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          padding: 3px 8px;
          border-radius: 6px;
          pointer-events: none;
          z-index: 9999;
          font-family: 'Inter','Poppins','Segoe UI',sans-serif;
          letter-spacing: 0.03em;
          box-shadow: 0 4px 12px rgba(0,0,0,0.18);
        }
        .proj-overdue-clock .proj-overdue-tip::after {
          content: '';
          position: absolute;
          top: 100%; left: 50%; transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: #1e293b;
        }
        .proj-overdue-clock:hover .proj-overdue-tip { display: block; }
        .proj-metrics-grid > div { position: relative; overflow: hidden; isolation: isolate; }
        .proj-metrics-grid > div::before {
          content: ""; position: absolute; z-index: 0; width: 90px; height: 90px;
          border-radius: 50%; opacity: 0.06; right: -26px; bottom: -26px;
          pointer-events: none; animation: proj-bubble-float-large 5.5s ease-in-out infinite;
        }
        .proj-metrics-grid > div::after {
          content: ""; position: absolute; z-index: 0; width: 54px; height: 54px;
          border-radius: 50%; opacity: 0.04; right: 36px; bottom: -20px;
          pointer-events: none; animation: proj-bubble-float-small 4.2s ease-in-out infinite;
        }
        .proj-metrics-grid > div:nth-child(1)::before, .proj-metrics-grid > div:nth-child(1)::after { background: #667eea; }
        .proj-metrics-grid > div:nth-child(2)::before, .proj-metrics-grid > div:nth-child(2)::after { background: #10b981; }
        .proj-metrics-grid > div:nth-child(3)::before, .proj-metrics-grid > div:nth-child(3)::after { background: #8b5cf6; }
        .proj-metrics-grid > div:nth-child(4)::before, .proj-metrics-grid > div:nth-child(4)::after { background: #ef4444; }
        .proj-metrics-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
        .proj-metrics-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
        .proj-metrics-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
        .proj-metrics-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
        .proj-metrics-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
        .proj-metrics-grid > div:nth-child(4)::after { animation-delay: 1.8s; }

        .proj-status-active-green { background: #f0fdf4; color: #15803d; font-weight: 600; }
        .proj-status-active-red { background: #fff5f5; color: #dc2626; font-weight: 600; }
        .proj-status-inactive { background: transparent; color: #475569; font-weight: 400; }
        .proj-status-inactive:hover { background: #f1f5f9; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 600, color: "#0f172a", margin: 0, letterSpacing: "-0.025em" }}>Projects Management</h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>Create and manage client projects and team assignments.</p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <NotificationBell filterType="Project" />
          <button onClick={handleExportCSV}
            style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 14px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#fff", color: "#475569", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", transition: "all 0.2s" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          {canCreate && (
            <button onClick={openAddModal}
              style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 14px", border: "none", borderRadius: "10px", background: "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)", color: "#fff", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Project
            </button>
          )}
        </div>
      </div>

      <div className="proj-metrics-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "22px" }}>
        {metricsData.map((item) => (
          <div key={item.label} onClick={() => { setFilterStatus(item.filterValue); setCurrentPage(1); }} style={{ background: filterStatus === item.filterValue ? "#f8fafc" : "#fff", border: `1px solid ${filterStatus === item.filterValue ? item.color : '#e2e8f0'}`, borderRadius: "12px", padding: "16px 18px", cursor: "pointer", transition: "all 0.2s ease", boxShadow: filterStatus === item.filterValue ? `0 0 0 1px ${item.color}33` : "none" }}>
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, marginBottom: "10px" }}>{item.label}</div>
              <div style={{ fontSize: "28px", fontWeight: 300, color: "#0f172a", lineHeight: 1, marginBottom: "8px" }}>{item.value}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ color: item.up ? "#a8e63d" : "#ef4444", display: "flex", alignItems: "center", gap: "2px" }}>
                  {item.up ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" />
                    </svg>
                  )}
                  <span style={{ fontSize: "12px", fontWeight: 600 }}>{item.trend}</span>
                </span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>from last month</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", borderRadius: "14px 14px 0 0", position: "relative", zIndex: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: 1 }}>
            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "8px 12px", minWidth: "260px", maxWidth: "380px", flex: "1" }}
              onFocus={e => { e.currentTarget.style.borderColor = '#3b775e'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,119,94,0.08)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input type="text" placeholder="Search by ID, name, client, email, company..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                style={{ border: "none", outline: "none", background: "transparent", width: "100%", fontSize: "12px", color: "#0f172a", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500 }} />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0', display: 'flex', alignItems: 'center' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div ref={filterDropRef} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <button
                onClick={() => { setShowOldRecords(!showOldRecords); setCurrentPage(1); }}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', border: showOldRecords ? '1px solid #3b775e' : '1px solid #e2e8f0', borderRadius: '8px', fontSize: '11px', color: showOldRecords ? '#3b775e' : '#475569', background: showOldRecords ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
              >
                {showOldRecords ? 'See new records' : 'See old records'}
              </button>
              {/* Status Filter */}
              {(() => {
                const PROJECT_STATUS_OPTIONS = ['active', 'completed', 'on-hold', 'overdue'];
                const statusLabels = { 'active': 'Progress', 'pending': 'Pending', 'completed': 'Completed', 'on-hold': 'On Hold', 'overdue': 'Overdue' };
                const statusDotColors = { 'active': '#0369a1', 'pending': '#7c3aed', 'completed': '#2563eb', 'on-hold': '#d97706', 'overdue': '#dc2626' };
                const label = filterStatus ? statusLabels[filterStatus] : 'All Statuses';
                const isActive = !!filterStatus;
                const isOverdueFilter = filterStatus === 'overdue';
                return (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setOpenFilterDrop(p => p === 'status' ? null : 'status')}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', border: `1px solid ${isOverdueFilter ? '#dc2626' : isActive ? '#3b775e' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '11px', color: isOverdueFilter ? '#dc2626' : isActive ? '#3b775e' : '#475569', background: isOverdueFilter ? '#fff5f5' : isActive ? '#f0fdf4' : '#fff', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                    >
                      {label}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {openFilterDrop === 'status' && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', boxShadow: '0 8px 32px rgba(15,23,42,0.13)', padding: '10px', minWidth: '170px' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', padding: '0 4px' }}>Status</div>
                        <button
                          onClick={() => { setFilterStatus(''); setOpenFilterDrop(null); }}
                          className={!filterStatus ? "proj-status-active-green" : "proj-status-inactive"}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", transition: "background 0.15s" }}
                        >All Statuses</button>
                        {PROJECT_STATUS_OPTIONS.map(s => (
                          <button
                            key={s}
                            onClick={() => { setFilterStatus(s); setOpenFilterDrop(null); }}
                            className={filterStatus === s ? (s === 'overdue' ? "proj-status-active-red" : "proj-status-active-green") : "proj-status-inactive"}
                            style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none', fontSize: '12px', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", transition: "background 0.15s" }}
                          >
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusDotColors[s], flexShrink: 0 }} />
                            {statusLabels[s]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Clear all filters */}
              {(filterStatus || searchTerm) && (
                <button
                  onClick={() => { setFilterStatus(''); setSearchTerm(''); setOpenFilterDrop(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '11px', color: '#dc2626', background: '#fff5f5', cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", fontWeight: 500, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}>
            {`Showing ${filteredProjects.length === 0 ? 0 : pageStart + 1}–${Math.min(pageStart + paginated.length, filteredProjects.length)} of ${filteredProjects.length}`}
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>No projects found</div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>Click "Add Project" to create your first project.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ background: "#fafafa" }}>
                  <th style={{ padding: "9px 12px", textAlign: "left", fontSize: "9.5px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap", width: "40px" }}>#</th>
                  {["Project ID", "Project Name", "Project Type", "Client Name", "Email", "Company", "Start Date", "Deadline", "Status", "Country", "Value", "Actions"].map((label) => (
                    <th key={label} style={{ padding: "9px 12px", textAlign: "left", fontSize: "9.5px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #f1f5f9", whiteSpace: "nowrap" }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((project, index) => (
                  <tr key={project._id} style={{ borderBottom: index < paginated.length - 1 ? "1px solid #f8fafc" : "none" }}>
                    <td style={{ padding: "9px 12px", fontSize: "11px", color: "#94a3b8", fontWeight: 600, textAlign: "center" }}>
                      {pageStart + index + 1}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "10px", color: "#64748b", fontWeight: 600 }}>
                      {generateProjectId(project.name, project._id)}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#0f172a" }}>{project.name}</div>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", maxWidth: "120px" }}>
                        {project.projectTypes?.length > 0 ? project.projectTypes.map((t, i) => {
                          const { bg, color, border } = getTypeColor(t);
                          return (
                            <span key={i} style={{ background: bg, border: `1px solid ${border}`, padding: "2px 8px", borderRadius: "999px", fontSize: "9.5px", fontWeight: 700, color: color, whiteSpace: "nowrap" }}>{t}</span>
                          );
                        }) : <span style={{ color: "#94a3b8", fontSize: "11px" }}>-</span>}
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "11px", color: "#475569" }}>
                      {project.clientName || "-"}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "10px", color: "#94a3b8" }}>
                      {project.clientEmail || "-"}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "11px", color: "#475569" }}>
                      {project.clientCompany || "-"}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "10px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {formatDate(project.startDate)}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "10px", fontWeight: 600, whiteSpace: "nowrap", color: isOverdue(project) ? "#dc2626" : "#64748b" }}>
                      {formatDate(project.deadline)}
                    </td>
                    <td style={{ padding: "9px 12px", overflow: "visible" }}>
                      <StatusDropdownCell 
                        project={project} 
                        onStatusChange={handleStatusChange} 
                        isOverdue={isOverdue} 
                        statusStyle={statusStyle} 
                      />
                    </td>

                    <td style={{ padding: "9px 12px", fontSize: "11px", color: "#475569" }}>
                      {project.country || "-"}
                    </td>

                    <td style={{ padding: "9px 12px", fontSize: "11.5px", fontWeight: 700, color: "#0f172a" }}>
                      {project.projectValue ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: project.currency || 'INR', maximumFractionDigits: 0 }).format(project.projectValue) : "-"}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }} data-proj-action-menu>
                        <button onClick={() => setViewProject(project)} title="View Details"
                          style={{ width: "28px", height: "28px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#3b82f6", transition: "all 0.15s" }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                        </button>
                        {(canUpdate || canDelete) && (
                          <button onClick={(e) => toggleActionMenu(e, project._id)}
                            style={{ width: "28px", height: "28px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#475569" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredProjects.length > 0 && totalPages > 1 && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>Page {currentPage} of {totalPages}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                style={{ minWidth: "64px", height: "28px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: "11px", fontWeight: 700, cursor: currentPage === 1 ? "not-allowed" : "pointer", opacity: currentPage === 1 ? 0.45 : 1 }}>Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pg;
                if (totalPages <= 5) pg = i + 1;
                else if (currentPage <= 3) pg = i + 1;
                else if (currentPage >= totalPages - 2) pg = totalPages - 4 + i;
                else pg = currentPage - 2 + i;
                return (
                  <button key={pg} onClick={() => setCurrentPage(pg)}
                    style={{ width: "28px", height: "28px", borderRadius: "8px", border: pg === currentPage ? "1px solid #a3e635" : "1px solid #e2e8f0", background: pg === currentPage ? "#a3e635" : "#fff", color: pg === currentPage ? "#fff" : "#64748b", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>{pg}</button>
                );
              })}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                style={{ minWidth: "64px", height: "28px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontSize: "11px", fontWeight: 700, cursor: currentPage === totalPages ? "not-allowed" : "pointer", opacity: currentPage === totalPages ? 0.45 : 1 }}>Next</button>
            </div>
          </div>
        )}
      </div>

      {actionMenu && (() => {
        const proj = projects.find((p) => p._id === actionMenu.id);
        if (!proj) return null;
        return (
          <div data-proj-action-menu style={{ position: "fixed", top: actionMenu.top, left: actionMenu.left, width: "160px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 18px 40px rgba(15,23,42,0.12)", padding: "6px", zIndex: 1200 }}>
            {canUpdate && (
              <button onClick={() => openEditModal(proj)}
                style={{ width: "100%", border: "none", background: "transparent", borderRadius: "8px", padding: "9px 10px", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: 600, color: "#334155", cursor: "pointer", textAlign: "left" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                </svg>
                Edit project
              </button>
            )}
            {canDelete && (
              <button onClick={() => handleDelete(proj)}
                style={{ width: "100%", border: "none", background: "transparent", borderRadius: "8px", padding: "9px 10px", display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", fontWeight: 600, color: "#dc2626", cursor: "pointer", textAlign: "left" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete project
              </button>
            )}
          </div>
        );
      })()}

      {showAddModal && (
        <div onClick={closeAddModal} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "680px", background: "#fff", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 20px 40px rgba(15,23,42,0.18)", overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 600, color: "#0f172a" }}>Add Project</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Create a new project and assign it to a client and team.</div>
              </div>
              <button onClick={closeAddModal} style={{ background: "transparent", border: "none", fontSize: "24px", color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}>x</button>
            </div>
            {renderForm(addForm, setAddForm, addFormErrors, setAddFormErrors, handleAdd, savingAdd, false)}
          </div>
        </div>
      )}

      {showEditModal && editingProject && (
        <div onClick={closeEditModal} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "680px", background: "#fff", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 20px 40px rgba(15,23,42,0.18)", overflow: "hidden" }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Edit Project</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>Update project details, status, and team assignments.</div>
              </div>
              <button onClick={closeEditModal} style={{ background: "transparent", border: "none", fontSize: "24px", color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}>x</button>
            </div>
            {renderForm(editForm, setEditForm, editFormErrors, setEditFormErrors, handleEdit, savingEdit, true)}
          </div>
        </div>
      )}

      {viewProject && (
        <div onClick={() => { setViewProject(null); setIsFlipped(false); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000, perspective: "1200px" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "680px", position: "relative", transformStyle: "preserve-3d", transition: "transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)", display: "flex" }}>
            
            {/* Front Face (Details) */}
            <div style={{ width: "100%", flexShrink: 0, background: "#fff", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 20px 40px rgba(15,23,42,0.18)", display: "flex", flexDirection: "column", maxHeight: "85vh", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", position: isFlipped ? "absolute" : "relative", top: 0, left: 0, zIndex: isFlipped ? 0 : 1 }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Project Details</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{generateProjectId(viewProject.name, viewProject._id)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={() => setIsFlipped(true)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: "12px", color: "#1d4ed8", fontWeight: 700, padding: "6px 14px", borderRadius: "999px", cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 1px 2px rgba(37,99,235,0.05)" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#dbeafe"; e.currentTarget.style.borderColor = "#93c5fd"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#bfdbfe"; }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    View Timeline
                  </button>
                  <button onClick={() => { setViewProject(null); setIsFlipped(false); }} style={{ background: "transparent", border: "none", fontSize: "24px", color: "#94a3b8", cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>x</button>
                </div>
              </div>

              <div style={{ padding: "20px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "16px", color: "#0f172a", fontWeight: 700 }}>{viewProject.name}</h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>{viewProject.description || "No description provided."}</p>
                  {viewProject.projectTypes && viewProject.projectTypes.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                      {viewProject.projectTypes.map((t, i) => {
                        const { bg, color, border } = getTypeColor(t);
                        return (
                          <span key={i} style={{ background: bg, border: `1px solid ${border}`, padding: "4px 10px", borderRadius: "999px", color: color, fontSize: "11px", fontWeight: 700 }}>
                            {t}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", background: "#f8fafc", padding: "14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Client</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600 }}>{viewProject.clientName || "-"}</div>
                    {viewProject.clientCompany && <div style={{ fontSize: "12px", color: "#64748b" }}>{viewProject.clientCompany}</div>}
                    {viewProject.clientEmail && <div style={{ fontSize: "12px", color: "#64748b" }}>{viewProject.clientEmail}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Status & Value</div>
                    <div style={{ marginBottom: "6px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, ...statusStyle(isOverdue(viewProject) ? 'overdue' : viewProject.status) }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "currentColor" }} />
                        {isOverdue(viewProject) ? 'Overdue' : (viewProject.status === 'active' ? 'Progress' : viewProject.status?.replace("-", " "))}
                      </span>
                    </div>
                    <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600 }}>{viewProject.projectValue ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: viewProject.currency || 'INR', maximumFractionDigits: 0 }).format(viewProject.projectValue) : "-"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Timeline</div>
                    <div style={{ fontSize: "13px", color: "#475569" }}>
                      <span style={{ fontWeight: 600, color: "#0f172a" }}>Start:</span> {formatDate(viewProject.startDate)}
                    </div>
                    <div style={{ fontSize: "13px", color: "#475569" }}>
                      <span style={{ fontWeight: 600, color: isOverdue(viewProject) ? "#dc2626" : "#0f172a" }}>Deadline:</span> {formatDate(viewProject.deadline)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Priority</div>
                    <span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase", ...priorityStyle(viewProject.priority) }}>
                      {viewProject.priority}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Added By</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600 }}>
                      {(() => {
                        if (!viewProject.createdBy) return "Admin";
                        const creatorId = typeof viewProject.createdBy === 'object' ? viewProject.createdBy._id : viewProject.createdBy;
                        const creatorObj = typeof viewProject.createdBy === 'object' && (viewProject.createdBy.name || viewProject.createdBy.firstName) ? viewProject.createdBy : null;
                        const stateCreator = employees.find(e => e._id === creatorId);
                        const emp = creatorObj || stateCreator;
                        return emp ? (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || "Admin") : "Admin";
                      })()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>Added On</div>
                    <div style={{ fontSize: "13px", color: "#0f172a", fontWeight: 600 }}>
                      {viewProject.createdAt ? new Date(viewProject.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: "12px", color: "#0f172a", fontWeight: 700, marginBottom: "10px" }}>Assigned Team</div>
                  {viewProject.assignedEmployees && viewProject.assignedEmployees.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {viewProject.assignedEmployees.map((member) => {
                        const memberId = typeof member === 'object' ? member._id : member;
                        const empObj = typeof member === 'object' && (member.name || member.firstName) ? member : null;
                        const stateEmp = employees.find(e => e._id === memberId);
                        const emp = empObj || stateEmp;
                        const empName = emp ? (emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || "Unknown Employee") : "Unknown Employee";
                        const finalEmail = (emp && emp.email) ? emp.email : (stateEmp && stateEmp.email ? stateEmp.email : "");
                        const assignmentDate = viewProject.employeeAssignmentDates && viewProject.employeeAssignmentDates[memberId]
                          ? viewProject.employeeAssignmentDates[memberId]
                          : (viewProject.startDate || viewProject.createdAt);

                        return (
                          <div key={memberId} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", border: "1px solid #f1f5f9", borderRadius: "8px" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "#475569", flexShrink: 0 }}>
                              {empName !== "Unknown Employee" ? empName.charAt(0).toUpperCase() : "?"}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{empName}</div>
                              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                                {emp && emp.employeeId && (
                                  <span style={{ background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px", fontWeight: 600, color: "#475569" }}>
                                    {emp.employeeId}
                                  </span>
                                )}
                                {emp && emp.designation && <span>• {emp.designation}</span>}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
                              {finalEmail && (
                                <div style={{ fontSize: "11px", color: "#64748b", textAlign: "right" }}>{finalEmail}</div>
                              )}
                              <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "4px", fontWeight: 500 }}>
                                Assigned on {formatDate(assignmentDate)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: "13px", color: "#94a3b8", padding: "10px", border: "1px dashed #e2e8f0", borderRadius: "8px", textAlign: "center" }}>No team members assigned.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Back Face (Timeline) */}
            <div style={{ width: "100%", flexShrink: 0, background: "#fff", borderRadius: "18px", border: "1px solid #e2e8f0", boxShadow: "0 20px 40px rgba(15,23,42,0.18)", display: "flex", flexDirection: "column", maxHeight: "85vh", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", position: !isFlipped ? "absolute" : "relative", top: 0, left: 0, zIndex: !isFlipped ? 0 : 1 }}>
              <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Project Timeline</div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{generateProjectId(viewProject.name, viewProject._id)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={() => setIsFlipped(false)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f1f5f9", border: "none", fontSize: "12px", color: "#475569", fontWeight: 600, padding: "6px 14px", borderRadius: "8px", cursor: "pointer", transition: "all 0.2s ease", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }} onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#0f172a"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#475569"; }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                    Back to Details
                  </button>
                  <button onClick={() => { setViewProject(null); setIsFlipped(false); }} style={{ background: "transparent", border: "none", fontSize: "24px", color: "#94a3b8", cursor: "pointer", lineHeight: 1, padding: "0 4px" }}>x</button>
                </div>
              </div>

              <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1, minHeight: 0, maxHeight: "60vh" }}>
                {!viewProject.activities || viewProject.activities.length === 0 ? (
                  <div style={{ padding: "40px 20px", textAlign: "center", background: "#f8fafc", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                    <div style={{ fontSize: "14px", color: "#475569", fontWeight: "600", marginBottom: "4px" }}>No Activity History</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>No activities recorded yet.</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {viewProject.activities.map((activity, idx) => {
                      const isLast = idx === viewProject.activities.length - 1;
                      const isAssigned = activity.action === 'Assigned';
                      
                      let title = activity.action;
                      if (isAssigned && activity.targetUser) {
                        const targetId = activity.targetUser._id || activity.targetUser;
                        const hasPriorHistory = viewProject.activities.slice(0, idx).some(a => 
                          (a.action === 'Assigned' || a.action === 'Unassigned') && 
                          a.targetUser && (a.targetUser._id === targetId || a.targetUser === targetId)
                        );
                        if (hasPriorHistory) title = `Reassigned to ${activity.targetUser.firstName || ''} ${activity.targetUser.lastName || ''}`;
                        else title = `Assigned to ${activity.targetUser.firstName || ''} ${activity.targetUser.lastName || ''}`;
                      } else if (activity.action === 'Unassigned' && activity.targetUser) {
                        title = `Unassigned from ${activity.targetUser.firstName || ''} ${activity.targetUser.lastName || ''}`;
                      }

                      return (
                        <div key={idx} style={{ display: "flex", gap: "16px" }}>
                          {/* Timeline node & line */}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: "12px", height: "12px", borderRadius: "50%", border: isAssigned ? "2px solid #10b981" : "2px solid #3b82f6", background: "#fff", zIndex: 2, marginTop: "4px" }}></div>
                            {!isLast && <div style={{ width: "2px", flex: 1, background: "#e5e7eb", margin: "4px 0", minHeight: "30px" }}></div>}
                          </div>

                          {/* Timeline content */}
                          <div style={{ flex: 1, paddingBottom: isLast ? "0" : "20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div style={{ fontSize: "13px", fontWeight: "600", color: "#111827", display: "flex", alignItems: "center", gap: "6px" }}>
                                {title}
                                {isLast && (
                                  <span title="New Activity" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#a8e63d', color: '#111827', borderRadius: '50%', width: '14px', height: '14px' }}>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: "11px", color: "#9ca3af", whiteSpace: "nowrap", marginLeft: "12px" }}>
                                {new Date(activity.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                              </div>
                            </div>

                            {activity.message && (
                              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: "8px", marginTop: "8px", fontSize: "12px" }}>
                                <div style={{ color: "#9ca3af" }}>Message</div>
                                <div style={{ color: "#4b5563" }}>{activity.message}</div>
                              </div>
                            )}

                            <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                              By: <span style={{ fontWeight: 500, color: "#374151" }}>{activity.performedBy ? `${activity.performedBy.firstName || ''} ${activity.performedBy.lastName || ''}` : "System"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}

export default Projects;
