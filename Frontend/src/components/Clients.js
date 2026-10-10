import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";

const emptyClientForm = {
  // Basic Details
  firstName: "",
  lastName: "",
  phoneCountryCode: "+91",
  phone: "",
  altPhoneCountryCode: "+91",
  alternatePhone: "",
  personalEmail: "",
  personalCountry: "",
  personalState: "",
  personalCity: "",
  personalPostalCode: "",
  // Company Details Toggle & Fields
  hasCompany: false,
  name: "",
  company: "",
  ownedBy: "",
  businessIdentifier: "GSTIN",
  registrationNo: "",
  gstNo: "",
  companyContactCode: "+91",
  companyContactNo: "",
  companyAltCode: "+91",
  companyAltNo: "",
  businessEmail: "",
  companyCountry: "India",
  companyState: "",
  companyCity: "",
  companyPostalCode: "",
  // Misc
  email: "",
  source: "Manual",
  requirement: "",
  assignedTo: "",
};

function parseCsvRow(row) {
  const values = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseCsvText(text) {
  const rows = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length < 2) {
    return [];
  }

  const headers = parseCsvRow(rows[0]).map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
  );

  return rows.slice(1).map((row) => {
    const values = parseCsvRow(row);
    return headers.reduce((acc, header, index) => {
      acc[header] = values[index] || "";
      return acc;
    }, {});
  });
}

function Clients() {
  const { user, hasPermission } = useAuth();

  // Check if user has full access to all clients (same logic as backend)
  // Only Admin, HR, Manager, HR Manager can see all clients
  // Regular employees with read permission can only see their assigned clients
  const hasFullAccess =
    user?.role?.name === 'Admin' ||
    user?.role?.name === 'HR' ||
    user?.role?.name === 'Manager' ||
    user?.role?.name === 'HR Manager';

  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [metaLeads, setMetaLeads] = useState([]);
  const [clientRecords, setClientRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [clientForm, setClientForm] = useState(emptyClientForm);
  const [clientFormErrors, setClientFormErrors] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingClient, setViewingClient] = useState(null);
  const [editForm, setEditForm] = useState(emptyClientForm);
  const [editFormErrors, setEditFormErrors] = useState({});
  const [savingClient, setSavingClient] = useState(false);
  const [savingEditClient, setSavingEditClient] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [actionMenu, setActionMenu] = useState(null);
  const [prevStats, setPrevStats] = useState({ total: 0, crm: 0, meta: 0, thisMonth: 0 });
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedClientForProjects, setSelectedClientForProjects] = useState(null);
  const [selectedProjectForAssignment, setSelectedProjectForAssignment] = useState(null);
  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [activeCardFilter, setActiveCardFilter] = useState("Total Clients");
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);
  const [showEditDealerDropdown, setShowEditDealerDropdown] = useState(false);
  const [dealerSearchTerm, setDealerSearchTerm] = useState("");
  // Country-code dropdown open states for Add modal
  const [openPhoneCode, setOpenPhoneCode] = useState(false);
  const [openAltCode, setOpenAltCode] = useState(false);
  const [openCompanyCode, setOpenCompanyCode] = useState(false);
  const [openCompanyAltCode, setOpenCompanyAltCode] = useState(false);
  // Country & State dropdown states for Add modal
  const [openPersonalCountry, setOpenPersonalCountry] = useState(false);
  const [openPersonalState, setOpenPersonalState] = useState(false);
  const [openCompanyCountry, setOpenCompanyCountry] = useState(false);
  const [openCompanyState, setOpenCompanyState] = useState(false);
  const [openIdentifierDropdown, setOpenIdentifierDropdown] = useState(false);
  const [countrySearchTerm, setCountrySearchTerm] = useState("");
  const [stateSearchTerm, setStateSearchTerm] = useState("");
  const [identifierSearchTerm, setIdentifierSearchTerm] = useState("");
  const [filterDealer, setFilterDealer] = useState("");
  const [openDealerFilter, setOpenDealerFilter] = useState(false);
  const dealerFilterRef = useRef(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [openDateFilter, setOpenDateFilter] = useState(false);
  const dateFilterRef = useRef(null);
  const fileInputRef = useRef(null);
  const CLIENTS_PER_PAGE = 10;

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, metaRes, clientsRes, employeesRes, projectsRes] = await Promise.allSettled([
        api.get("/leads", { params: { status: "Client" } }),
        api.get("/meta-leads", { params: { status: "Client", limit: 1000 } }),
        api.get("/clients"),
        api.get("/employees"),
        api.get("/projects"),
      ]);

      if (leadsRes.status === "fulfilled") {
        setLeads(leadsRes.value.data || []);
      }

      if (metaRes.status === "fulfilled") {
        setMetaLeads(metaRes.value.data?.leads || []);
      }

      if (clientsRes.status === "fulfilled") {
        setClientRecords(clientsRes.value.data || []);
      }

      if (employeesRes.status === "fulfilled") {
        setEmployees(employeesRes.value.data || []);
      }

      if (projectsRes.status === "fulfilled") {
        setProjects(projectsRes.value.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch clients:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    const handler = (e) => {
      if (dealerFilterRef.current && !dealerFilterRef.current.contains(e.target)) {
        setOpenDealerFilter(false);
      }
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target)) {
        setOpenDateFilter(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const clients = useMemo(() => {
    const getCreatorName = (creator) => {
      if (!creator) return 'System';
      if (typeof creator === 'object') return `${creator.firstName || ''} ${creator.lastName || ''}`.trim() || creator.username || 'System';
      const emp = employees.find(e => e._id === creator);
      return emp ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() : 'System';
    };

    // Map legacy leads with status=Client (backward compat)
    const crmClients = leads.map((lead) => {
      const parts = (lead.name || "").trim().split(" ");
      const fName = lead.firstName || parts[0] || "";
      const lName = lead.lastName || parts.slice(1).join(" ") || "";
      return {
        id: `crm-${lead._id}`,
        backendId: lead._id,
        recordType: "crm",
        clientType: "CRM Lead",
        name: lead.name || lead.company || "Untitled Client",
        firstName: fName,
        lastName: lName,
        company: lead.company && lead.company !== "-" ? lead.company : "",
        ownedBy: lead.ownedBy || "",
        phone: lead.phone || "-",
        alternatePhone: lead.alternatePhone || "",
        email: lead.email || lead.personalEmail || "",
        personalEmail: lead.personalEmail || lead.email || "",
        personalAddress: {
          country: lead.personalAddress?.country || lead.country || "",
          state: lead.personalAddress?.state || lead.state || "",
          city: lead.personalAddress?.city || lead.city || "",
          postalCode: lead.personalAddress?.postalCode || lead.postalCode || "",
        },
        companyAddress: lead.companyAddress || {},
        businessIdentifier: lead.businessIdentifier || "GSTIN",
        registrationNo: lead.registrationNo || lead.gstNo || "",
        gstNo: lead.gstNo || lead.registrationNo || "",
        companyContactNo: lead.companyContactNo || "",
        companyAltNo: lead.companyAltNo || "",
        businessEmail: lead.businessEmail || "",
        requirement: lead.requirements || lead.requirement || lead.notes || "",
        source: lead.source || "Manual",
        dealValue: lead.budget || lead.dealValue || 0,
        assignedTo: lead.assignedTo
          ? `${lead.assignedTo.firstName || ""} ${lead.assignedTo.lastName || ""}`.trim() || "Unassigned"
          : "Unassigned",
        assignedToUser: lead.assignedTo,
        convertedOn: lead.convertedDate || lead.updatedAt || lead.createdAt,
        createdAt: lead.createdAt,
        addedBy: getCreatorName(lead.createdBy),
        raw: lead,
      };
    });

    const metaClients = metaLeads.map((lead) => {
      const parts = (lead.name || "").trim().split(" ");
      const fName = lead.firstName || parts[0] || "";
      const lName = lead.lastName || parts.slice(1).join(" ") || "";
      return {
        id: `meta-${lead._id}`,
        backendId: lead._id,
        recordType: "meta",
        clientType: "Meta Lead",
        name: lead.name || lead.businessCategory || "Untitled Client",
        firstName: fName,
        lastName: lName,
        company: lead.businessCategory || lead.pageName || "",
        ownedBy: lead.ownedBy || "",
        phone: lead.phone || "-",
        alternatePhone: lead.alternatePhone || "",
        email: lead.email || lead.personalEmail || "",
        personalEmail: lead.personalEmail || lead.email || "",
        personalAddress: {
          country: lead.personalAddress?.country || lead.country || "",
          state: lead.personalAddress?.state || lead.state || "",
          city: lead.personalAddress?.city || lead.city || "",
          postalCode: lead.personalAddress?.postalCode || lead.postalCode || "",
        },
        companyAddress: lead.companyAddress || {},
        businessIdentifier: lead.businessIdentifier || "GSTIN",
        registrationNo: lead.registrationNo || lead.gstNo || "",
        gstNo: lead.gstNo || lead.registrationNo || "",
        companyContactNo: lead.companyContactNo || "",
        companyAltNo: lead.companyAltNo || "",
        businessEmail: lead.businessEmail || "",
        requirement: lead.notes || lead.websiteType || "",
        source: `Meta · ${lead.pageName || "Facebook"}`,
        assignedTo: lead.assignedTo
          ? `${lead.assignedTo.firstName || ""} ${lead.assignedTo.lastName || ""}`.trim() || "Unassigned"
          : "Unassigned",
        assignedToUser: lead.assignedTo,
        convertedOn: lead.updatedAt || lead.createdTime,
        createdAt: lead.createdTime,
        addedBy: getCreatorName(lead.createdBy),
        raw: lead,
      };
    });

    // Map proper Client collection records (new pipeline: lead → deal → client)
    const dealClients = clientRecords.map((c) => ({
      id: `client-${c._id}`,
      backendId: c._id,
      recordType: "client",
      clientType: c.relatedMetaLead ? "Meta Lead" : "CRM Lead",
      name: c.name || (c.firstName ? `${c.firstName} ${c.lastName || ""}`.trim() : "Untitled Client"),
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      company: c.company || "-",
      ownedBy: c.ownedBy || "-",
      phone: c.phone || "-",
      alternatePhone: c.alternatePhone || "-",
      email: c.email || c.personalEmail || "-",
      personalEmail: c.personalEmail || c.email || "-",
      personalAddress: c.personalAddress || {},
      companyAddress: c.companyAddress || {},
      businessIdentifier: c.businessIdentifier || "GSTIN",
      registrationNo: c.registrationNo || c.gstNo || "-",
      gstNo: c.gstNo || c.registrationNo || "-",
      companyContactNo: c.companyContactNo || "-",
      companyAltNo: c.companyAltNo || "-",
      businessEmail: c.businessEmail || "-",
      requirement: c.requirements || c.notes || "-",
      source: c.source || "Lead Conversion",
      dealValue: c.dealValue || 0,
      assignedTo: c.assignedTo
        ? `${c.assignedTo.firstName || ""} ${c.assignedTo.lastName || ""}`.trim() || "Unassigned"
        : "Unassigned",
      assignedToUser: c.assignedTo,
      convertedOn: c.convertedAt || c.createdAt,
      createdAt: c.createdAt,
      addedBy: getCreatorName(c.createdBy),
      raw: c,
    }));

    // Deduplicate: skip legacy leads that already have a proper Client record
    const clientLeadIds = new Set(clientRecords.map(c => c.relatedLead?.toString()).filter(Boolean));
    const clientMetaIds = new Set(clientRecords.map(c => c.relatedMetaLead?.toString()).filter(Boolean));
    const filteredCrm = crmClients.filter(c => !clientLeadIds.has(c.backendId));
    const filteredMeta = metaClients.filter(c => !clientMetaIds.has(c.backendId));

    const allClients = [...dealClients, ...filteredCrm, ...filteredMeta];

    // Apply role-based filtering
    const roleFilteredClients = allClients.filter(client => {
      // Regular employees (non-Admin/HR/Manager): only show clients assigned to this user
      // Backend already filters, but this is an additional safety check
      if (!hasFullAccess && user?._id) {
        // For client records, check assignedTo object
        if (client.recordType === "client") {
          const clientRec = clientRecords.find(c => c._id === client.backendId);
          const assignedId = clientRec?.assignedTo?._id || clientRec?.assignedTo;
          const createdById = clientRec?.createdBy?._id || clientRec?.createdBy;
          return assignedId === user._id || createdById === user._id;
        }
        // For CRM leads, check assignedTo object
        else if (client.recordType === "crm") {
          const lead = leads.find(l => l._id === client.backendId);
          const assignedId = lead?.assignedTo?._id || lead?.assignedTo;
          const createdById = lead?.createdBy?._id || lead?.createdBy;
          return assignedId === user._id || createdById === user._id;
        }
        // For Meta leads, check assignedTo object
        else if (client.recordType === "meta") {
          const metaLead = metaLeads.find(l => l._id === client.backendId);
          const assignedId = metaLead?.assignedTo?._id || metaLead?.assignedTo;
          return assignedId === user._id;
        }
      }
      return true;
    });

    return roleFilteredClients.sort(
      (a, b) => new Date(b.convertedOn) - new Date(a.convertedOn)
    );
  }, [leads, metaLeads, clientRecords, employees, hasFullAccess, user?._id]);

  const filteredClients = useMemo(() => {
    let result = clients;

    if (activeCardFilter === 'Manual Clients') {
      result = result.filter((client) => client.source === "Manual");
    } else if (activeCardFilter === 'Excel Imported') {
      result = result.filter((client) => client.source && client.source.includes("Excel"));
    } else if (activeCardFilter === 'Lead Converted') {
      result = result.filter((client) =>
        client.source && (client.source.includes("Meta") || client.source.includes("Lead Conversion") || client.source.includes("Website"))
      );
    }

    if (filterDealer) {
      result = result.filter((client) => client.assignedTo === filterDealer);
    }

    if (filterDate || filterEndDate) {
      result = result.filter(client => {
        const clientDateStr = new Date(client.convertedOn).toISOString().split('T')[0];
        
        if (filterDate && filterEndDate) {
          return clientDateStr >= filterDate && clientDateStr <= filterEndDate;
        } else if (filterDate) {
          return clientDateStr >= filterDate;
        } else if (filterEndDate) {
          return clientDateStr <= filterEndDate;
        }
        return true;
      });
    }

    const term = searchTerm.trim().toLowerCase();
    if (!term) return result;

    return result.filter((client) =>
      [
        client.name,
        client.company,
        client.phone,
        client.email,
        client.requirement,
        client.source,
        client.assignedTo,
        client.clientType,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [clients, searchTerm, activeCardFilter, filterDealer, filterDate, filterEndDate]);

  const uniqueDealers = useMemo(() => {
    const dealers = new Set(clients.map(c => c.assignedTo).filter(Boolean));
    return Array.from(dealers).sort();
  }, [clients]);

  const stats = useMemo(() => {
    const total = clients.length;
    const manual = clients.filter((client) => client.source === "Manual").length;
    const excel = clients.filter((client) => client.source && client.source.includes("Excel")).length;
    const leadConverted = clients.filter((client) =>
      client.source && (client.source.includes("Meta") || client.source.includes("Lead Conversion") || client.source.includes("Website"))
    ).length;

    return { total, manual, excel, leadConverted };
  }, [clients]);

  // Calculate previous month stats
  const prevMonthStats = useMemo(() => {
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);
    lastMonthStart.setHours(0, 0, 0, 0);

    const lastMonthEnd = new Date();
    lastMonthEnd.setDate(0);
    lastMonthEnd.setHours(23, 59, 59, 999);

    const lastMonthClients = clients.filter(
      (client) => {
        const convertedDate = new Date(client.convertedOn);
        return convertedDate >= lastMonthStart && convertedDate <= lastMonthEnd;
      }
    );

    const total = lastMonthClients.length;
    const manual = lastMonthClients.filter((client) => client.source === "Manual").length;
    const excel = lastMonthClients.filter((client) => client.source && client.source.includes("Excel")).length;
    const leadConverted = lastMonthClients.filter((client) =>
      client.source && (client.source.includes("Meta") || client.source.includes("Lead Conversion") || client.source.includes("Website"))
    ).length;

    return { total, manual, excel, leadConverted };
  }, [clients]);

  // Trend calculation functions
  const calculateChange = (current, previous) => {
    if (previous === 0 && current === 0) return "0%";
    if (previous === 0) return `+${current * 100}%`;
    const change = ((current - previous) / previous) * 100;
    const sign = change > 0 ? "+" : "";
    return `${sign}${Number.isInteger(change) ? change : change.toFixed(1)}%`;
  };

  const getTrendDirection = (current, previous) => {
    return current >= previous;
  };

  const totalChange = calculateChange(stats.total, prevMonthStats.total);
  const manualChange = calculateChange(stats.manual, prevMonthStats.manual);
  const excelChange = calculateChange(stats.excel, prevMonthStats.excel);
  const leadConvertedChange = calculateChange(stats.leadConverted, prevMonthStats.leadConverted);

  const totalTrend = getTrendDirection(stats.total, prevMonthStats.total);
  const manualTrend = getTrendDirection(stats.manual, prevMonthStats.manual);
  const excelTrend = getTrendDirection(stats.excel, prevMonthStats.excel);
  const leadConvertedTrend = getTrendDirection(stats.leadConverted, prevMonthStats.leadConverted);

  const sparklineData = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

    const countFor = (filterFn) =>
      months.map(({ year, month }) =>
        clients.filter((c) => {
          const d = new Date(c.convertedOn || c.createdAt);
          return d.getFullYear() === year && d.getMonth() === month && filterFn(c);
        }).length
      );

    return {
      total: countFor(() => true),
      manual: countFor((c) => c.source === "Manual"),
      excel: countFor((c) => c.source && c.source.includes("Excel")),
      leadConverted: countFor((c) => c.source && (c.source.includes("Meta") || c.source.includes("Lead Conversion") || c.source.includes("Website"))),
    };
  }, [clients]);

  const Sparkline = ({ data, color }) => {
    const w = 88, h = 36;
    const max = Math.max(...data, 1);
    const min = Math.min(...data);
    const range = max - min || 1;
    const pts = data
      .map((v, i) => {
        const x = (i / (data.length - 1)) * w;
        const y = h - 4 - ((v - min) / range) * (h - 10);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const fillPts = `0,${h} ` + pts + ` ${w},${h}`;
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={fillPts} fill={`url(#sg-${color.replace('#', '')})`} className="sparkline-fill" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" className="sparkline-line" />
        {data.map((v, i) => {
          const x = (i / (data.length - 1)) * w;
          const y = h - 4 - ((v - min) / range) * (h - 10);
          return i === data.length - 1 ? (
            <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" fill={color} className="sparkline-dot" />
          ) : null;
        })}
      </svg>
    );
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const totalPages = Math.max(1, Math.ceil(filteredClients.length / CLIENTS_PER_PAGE));
  const pageStartIndex = (currentPage - 1) * CLIENTS_PER_PAGE;
  const paginatedClients = filteredClients.slice(pageStartIndex, pageStartIndex + CLIENTS_PER_PAGE);
  const canCreateClients = hasPermission?.('clients', 'create');
  const canUpdateClients = hasPermission?.('clients', 'update');
  const canDeleteClients = hasPermission?.('clients', 'delete');
  const canReadClients = hasPermission?.('clients', 'read');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, clients.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!actionMenu) return undefined;

    const handleDocumentClick = (event) => {
      if (!event.target.closest("[data-client-action-menu]")) {
        setActionMenu(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setActionMenu(null);
      }
    };

    const handleViewportChange = () => {
      setActionMenu(null);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [actionMenu]);

  const createConvertedClient = useCallback(async (payload) => {
    // Use provided assignedTo or fallback to current user
    const assignedTo = payload.assignedTo || user?._id || user?.id;

    if (!assignedTo) {
      throw new Error("Your session is missing a user id. Please log in again.");
    }

    // Derive display name from firstName + lastName if available
    const derivedName = [payload.firstName, payload.lastName].filter(Boolean).join(" ").trim() || payload.name || "";

    const clientPayload = {
      name: derivedName || payload.name?.trim() || "",
      company: (payload.company || "").trim(),
      email: (payload.email || "").trim(),
      phone: payload.phone ? `${payload.phoneCountryCode || "+91"}${payload.phone}` : "",
      source: (payload.source || "Manual").trim(),
      assignedTo,
      requirements: (payload.requirement || "").trim(),
      notes: (payload.requirement || "").trim(),
      // Personal details
      firstName: (payload.firstName || "").trim(),
      lastName: (payload.lastName || "").trim(),
      phoneCountryCode: payload.phoneCountryCode || "+91",
      altPhoneCountryCode: payload.altPhoneCountryCode || "+91",
      alternatePhone: payload.alternatePhone ? `${payload.altPhoneCountryCode || "+91"}${payload.alternatePhone}` : "",
      personalEmail: (payload.personalEmail || "").trim(),
      personalAddress: {
        country:    (payload.personalCountry || "").trim(),
        state:      (payload.personalState || "").trim(),
        city:       (payload.personalCity || "").trim(),
        postalCode: (payload.personalPostalCode || "").trim(),
      },
      // Company details (only if hasCompany is checked)
      company:            payload.hasCompany ? (payload.company || "").trim() : "",
      ownedBy:            payload.hasCompany ? (payload.ownedBy || "").trim() : "",
      businessIdentifier: payload.hasCompany ? (payload.businessIdentifier || "GSTIN").trim() : "",
      registrationNo:     payload.hasCompany ? (payload.registrationNo || payload.gstNo || "").trim() : "",
      gstNo:              payload.hasCompany ? (payload.registrationNo || payload.gstNo || "").trim() : "",
      companyContactCode: payload.hasCompany ? (payload.companyContactCode || "+91") : "+91",
      companyContactNo:   payload.hasCompany && payload.companyContactNo ? `${payload.companyContactCode || "+91"}${payload.companyContactNo}` : "",
      companyAltCode:     payload.hasCompany ? (payload.companyAltCode || "+91") : "+91",
      companyAltNo:       payload.hasCompany && payload.companyAltNo ? `${payload.companyAltCode || "+91"}${payload.companyAltNo}` : "",
      businessEmail:      payload.hasCompany ? (payload.businessEmail || "").trim() : "",
      companyAddress: payload.hasCompany ? {
        country:    (payload.companyCountry || "").trim(),
        state:      (payload.companyState || "").trim(),
        city:       (payload.companyCity || "").trim(),
        postalCode: (payload.companyPostalCode || "").trim(),
      } : {},
    };

    await api.post("/clients", clientPayload);
  }, [user]);

  const handleExportCsv = () => {
    const headers = [
      "Name",
      "Company",
      "Phone",
      "Email",
      "Requirement",
      "Source",
      "Dealer",
      "Type",
      "Converted On",
    ];

    const escape = (value) => {
      const stringValue = String(value ?? "");
      // Clean up any extra spaces or newlines that might break CSV rows
      const cleanValue = stringValue.replace(/\s+/g, ' ').trim();
      return `"${cleanValue.replace(/"/g, '""')}"`;
    };

    const rows = filteredClients.map((client) => [
      client.name || "-",
      client.company || "-",
      client.phone && client.phone !== "-" ? `="\t${client.phone}"` : "-",
      client.email || "-",
      client.requirement || "-",
      client.source || "-",
      client.assignedTo || "Unassigned",
      client.clientType || "-",
      formatDate(client.convertedOn),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  // Country calling codes for phone inputs
  const COUNTRY_CODES = [
    { code: "+91", name: "India", digits: 10 },
    { code: "+1", name: "USA/Canada", digits: 10 },
    { code: "+44", name: "UK", digits: 10 },
    { code: "+61", name: "Australia", digits: 9 },
    { code: "+971", name: "UAE", digits: 9 },
    { code: "+966", name: "Saudi Arabia", digits: 9 },
    { code: "+65", name: "Singapore", digits: 8 },
    { code: "+60", name: "Malaysia", digits: 9 },
    { code: "+49", name: "Germany", digits: 10 },
    { code: "+33", name: "France", digits: 9 },
    { code: "+86", name: "China", digits: 11 },
    { code: "+81", name: "Japan", digits: 10 },
    { code: "+82", name: "South Korea", digits: 10 },
    { code: "+7", name: "Russia", digits: 10 },
    { code: "+55", name: "Brazil", digits: 11 },
    { code: "+27", name: "South Africa", digits: 9 },
    { code: "+234", name: "Nigeria", digits: 10 },
    { code: "+20", name: "Egypt", digits: 10 },
    { code: "+92", name: "Pakistan", digits: 10 },
    { code: "+880", name: "Bangladesh", digits: 10 },
    { code: "+94", name: "Sri Lanka", digits: 9 },
    { code: "+977", name: "Nepal", digits: 10 },
    { code: "+64", name: "New Zealand", digits: 9 },
    { code: "+39", name: "Italy", digits: 10 },
    { code: "+34", name: "Spain", digits: 9 },
    { code: "+31", name: "Netherlands", digits: 9 },
    { code: "+46", name: "Sweden", digits: 9 },
    { code: "+47", name: "Norway", digits: 8 },
    { code: "+45", name: "Denmark", digits: 8 },
    { code: "+41", name: "Switzerland", digits: 9 },
    { code: "+90", name: "Turkey", digits: 10 },
  ];

  const getDigitsForCode = (code) => {
    const found = COUNTRY_CODES.find(c => c.code === code);
    return found ? found.digits : 10;
  };

  // Comprehensive Country -> States mapping for dynamic dropdowns
  const COUNTRIES_STATES_DATA = {
    "India": [
      "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa",
      "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala",
      "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
      "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
      "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu and Kashmir",
      "Ladakh", "Puducherry", "Goa"
    ],
    "United States": [
      "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
      "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
      "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
      "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
      "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
      "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
      "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
      "Wisconsin", "Wyoming"
    ],
    "United Kingdom": [
      "England", "Scotland", "Wales", "Northern Ireland", "Greater London",
      "West Midlands", "Greater Manchester", "West Yorkshire"
    ],
    "Canada": [
      "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
      "Nova Scotia", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan",
      "Northwest Territories", "Nunavut", "Yukon"
    ],
    "Australia": [
      "New South Wales", "Queensland", "South Australia", "Tasmania", "Victoria",
      "Western Australia", "Australian Capital Territory", "Northern Territory"
    ],
    "United Arab Emirates": [
      "Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"
    ],
    "Saudi Arabia": [
      "Riyadh", "Makkah", "Madinah", "Eastern Province", "Asir", "Tabuk", "Hail",
      "Northern Borders", "Jazan", "Najran", "Al Bahah", "Al Jawf", "Al Qassim"
    ],
    "Singapore": ["Central", "East", "North", "North-East", "West"],
    "Malaysia": [
      "Johor", "Kedah", "Kelantan", "Malacca", "Negeri Sembilan", "Pahang", "Penang",
      "Perak", "Perlis", "Sabah", "Sarawak", "Selangor", "Terengganu", "Kuala Lumpur"
    ],
    "Germany": [
      "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg",
      "Hesse", "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia",
      "Rhineland-Palatinate", "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia"
    ],
    "France": [
      "Île-de-France", "Auvergne-Rhône-Alpes", "Nouvelle-Aquitaine", "Occitanie",
      "Hauts-de-France", "Provence-Alpes-Côte d'Azur", "Grand Est", "Pays de la Loire",
      "Brittany", "Normandy", "Bourgogne-Franche-Comté", "Centre-Val de Loire", "Corsica"
    ],
    "China": [
      "Beijing", "Shanghai", "Guangdong", "Zhejiang", "Jiangsu", "Shandong", "Sichuan",
      "Henan", "Hebei", "Hunan", "Hubei", "Fujian", "Anhui", "Shaanxi", "Chongqing"
    ],
    "Japan": [
      "Tokyo", "Osaka", "Kanagawa", "Aichi", "Hokkaido", "Fukuoka", "Hyogo", "Saitama",
      "Chiba", "Shizuoka", "Kyoto", "Hiroshima", "Miyagi"
    ],
    "South Korea": [
      "Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Ulsan", "Gyeonggi-do",
      "Gangwon-do", "Chungcheongbuk-do", "Chungcheongnam-do", "Jeollabuk-do", "Jeollanam-do",
      "Gyeongsangbuk-do", "Gyeongsangnam-do", "Jeju"
    ],
    "Brazil": [
      "São Paulo", "Rio de Janeiro", "Minas Gerais", "Bahia", "Paraná", "Rio Grande do Sul",
      "Pernambuco", "Ceará", "Pará", "Santa Catarina", "Goiás", "Maranhão", "Amazonas"
    ],
    "South Africa": [
      "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape", "Free State",
      "Limpopo", "Mpumalanga", "North West", "Northern Cape"
    ],
    "Nigeria": [
      "Lagos", "Kano", "Kaduna", "Oyo", "Rivers", "Bauchi", "Delta", "Edo", "Abuja FCT"
    ],
    "Egypt": [
      "Cairo", "Alexandria", "Giza", "Dakahlia", "Red Sea", "Sharqia", "Aswan", "Luxor"
    ],
    "Pakistan": [
      "Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan", "Islamabad Capital Territory",
      "Azad Jammu & Kashmir", "Gilgit-Baltistan"
    ],
    "Bangladesh": [
      "Dhaka", "Chittagong", "Rajshahi", "Khulna", "Barisal", "Sylhet", "Rangpur", "Mymensingh"
    ],
    "Sri Lanka": [
      "Western", "Central", "Southern", "North Western", "Sabaragamuwa", "Eastern", "Northern"
    ],
    "Nepal": [
      "Bagmati", "Gandaki", "Koshi", "Lumbini", "Madhesh", "Karnali", "Sudurpashchim"
    ],
    "New Zealand": [
      "Auckland", "Canterbury", "Wellington", "Waikato", "Bay of Plenty", "Otago", "Manawatu-Wanganui"
    ],
    "Italy": [
      "Lombardy", "Lazio", "Campania", "Sicily", "Veneto", "Piedmont", "Emilia-Romagna", "Tuscany"
    ],
    "Spain": [
      "Madrid", "Catalonia", "Andalusia", "Valencian Community", "Galicia", "Castile and León", "Basque Country"
    ],
    "Netherlands": [
      "North Holland", "South Holland", "North Brabant", "Gelderland", "Utrecht", "Overijssel", "Limburg"
    ],
    "Russia": [
      "Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan", "Nizhny Novgorod", "Chelyabinsk"
    ],
    "Turkey": [
      "Istanbul", "Ankara", "Izmir", "Bursa", "Antalya", "Adana", "Konya", "Gaziantep"
    ]
  };

  const COUNTRY_LIST = Object.keys(COUNTRIES_STATES_DATA).sort();

  // Comprehensive Business Identifier definitions per Country / System
  const BUSINESS_IDENTIFIERS = [
    { country: "India", id: "GSTIN", name: "Goods and Services Tax Identification Number", code: "GSTIN", placeholder: "Enter number", regex: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, maxLen: 15, hint: "15-character alphanumeric GSTIN" },
    { country: "India", id: "PAN", name: "Permanent Account Number", code: "PAN", placeholder: "Enter number", regex: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, maxLen: 10, hint: "10-character PAN" },
    { country: "India", id: "CIN", name: "Corporate Identification Number", code: "CIN", placeholder: "Enter number", regex: /^[L|U]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/, maxLen: 21, hint: "21-digit CIN" },
    { country: "United States", id: "EIN", name: "Employer Identification Number (EIN / FEIN)", code: "EIN", placeholder: "Enter number", regex: /^[0-9]{2}-?[0-9]{7}$/, maxLen: 10, hint: "9-digit EIN (XX-XXXXXXX)" },
    { country: "United States", id: "SSN", name: "Social Security Number (Sole Proprietor)", code: "SSN", placeholder: "Enter number", regex: /^[0-9]{3}-?[0-9]{2}-?[0-9]{4}$/, maxLen: 11, hint: "9-digit SSN" },
    { country: "United Kingdom", id: "GB_VAT", name: "VAT Registration Number", code: "VAT Number", placeholder: "Enter number", regex: /^(GB)?([0-9]{9}|[0-9]{12}|(GD|HA)[0-9]{3})$/i, maxLen: 14, hint: "9 or 12 digit UK VAT number" },
    { country: "United Kingdom", id: "CRN", name: "Company Registration Number (CRN)", code: "CRN", placeholder: "Enter number", regex: /^[A-Z0-9]{8}$/i, maxLen: 8, hint: "8-character Company Reg Number" },
    { country: "Canada", id: "CA_BN", name: "Business Number / GST / HST", code: "GST/HST Number", placeholder: "Enter number", regex: /^[0-9]{9}(RT[0-9]{4})?$/i, maxLen: 15, hint: "9-digit BN or 15-digit RT account" },
    { country: "Australia", id: "ABN", name: "Australian Business Number", code: "ABN", placeholder: "Enter number", regex: /^[0-9]{11}$/, maxLen: 14, hint: "11-digit ABN" },
    { country: "Australia", id: "ACN", name: "Australian Company Number", code: "ACN", placeholder: "Enter number", regex: /^[0-9]{9}$/, maxLen: 11, hint: "9-digit ACN" },
    { country: "United Arab Emirates", id: "TRN", name: "Tax Registration Number", code: "TRN", placeholder: "Enter number", regex: /^[0-9]{15}$/, maxLen: 15, hint: "15-digit TRN" },
    { country: "Saudi Arabia", id: "SA_VAT", name: "VAT Account Number / CR Number", code: "VAT / CR Number", placeholder: "Enter number", regex: /^[0-9]{10,15}$/, maxLen: 15, hint: "10-15 digit VAT / Commercial Reg" },
    { country: "Germany", id: "DE_VAT", name: "VAT ID (USt-IdNr.)", code: "VAT ID / USt-IdNr.", placeholder: "Enter number", regex: /^(DE)?[0-9]{9}$/i, maxLen: 11, hint: "DE + 9 digits" },
    { country: "France", id: "FR_VAT", name: "VAT Number (Numéro de TVA)", code: "VAT Number", placeholder: "Enter number", regex: /^(FR)?[A-Z0-9]{2}[0-9]{9}$/i, maxLen: 13, hint: "FR + 11 characters" },
    { country: "Singapore", id: "UEN", name: "Unique Entity Number", code: "UEN", placeholder: "Enter number", regex: /^[0-9]{8,10}[A-Z]{1}$/i, maxLen: 10, hint: "9-10 character UEN" },
    { country: "Malaysia", id: "SSM", name: "SSM Registration / SST Number", code: "SSM / SST Number", placeholder: "Enter number", regex: /^[A-Z0-9]{8,15}$/i, maxLen: 15, hint: "8-15 digit SSM Registration" },
    { country: "Other", id: "OTHER_TAX", name: "National Tax ID / Commercial Registration", code: "Tax ID / Reg No", placeholder: "Enter number", regex: /^.{3,30}$/, maxLen: 30, hint: "Tax ID or Registration Number" },
  ];

  const getIdentifierInfo = (identCodeOrId) => {
    if (!identCodeOrId) return BUSINESS_IDENTIFIERS[0];
    return BUSINESS_IDENTIFIERS.find(b => b.id === identCodeOrId || b.code === identCodeOrId) || BUSINESS_IDENTIFIERS[0];
  };

  const getStatesForCountry = (countryName) => {
    if (!countryName) return [];
    // Direct match
    if (COUNTRIES_STATES_DATA[countryName]) return COUNTRIES_STATES_DATA[countryName];
    // Case-insensitive match or partial match (e.g., "USA" -> "United States")
    const lower = countryName.toLowerCase().trim();
    if (lower === "usa" || lower === "us") return COUNTRIES_STATES_DATA["United States"];
    if (lower === "uk") return COUNTRIES_STATES_DATA["United Kingdom"];
    if (lower === "uae") return COUNTRIES_STATES_DATA["United Arab Emirates"];
    const foundKey = Object.keys(COUNTRIES_STATES_DATA).find(k => k.toLowerCase() === lower);
    return foundKey ? COUNTRIES_STATES_DATA[foundKey] : [];
  };

  const validateClientData = (formData, setErrors) => {
    const errors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // ══ Basic Details Mandatory Validations ══
    if (!formData.firstName || !formData.firstName.trim()) {
      errors.firstName = "First name is required.";
    }
    if (!formData.lastName || !formData.lastName.trim()) {
      errors.lastName = "Last name is required.";
    }
    if (!formData.phone || !formData.phone.trim()) {
      errors.phone = "Phone number is required.";
    } else {
      const required = getDigitsForCode(formData.phoneCountryCode || "+91");
      if (formData.phone.replace(/\D/g, "").length !== required) {
        errors.phone = `Enter a valid ${required}-digit phone number for the selected country.`;
      }
    }
    if (formData.alternatePhone && formData.alternatePhone.trim()) {
      const required = getDigitsForCode(formData.altPhoneCountryCode || "+91");
      if (formData.alternatePhone.replace(/\D/g, "").length !== required) {
        errors.alternatePhone = `Enter a valid ${required}-digit number for the selected country.`;
      }
    }
    if (!formData.personalEmail || !formData.personalEmail.trim()) {
      errors.personalEmail = "Personal email is required.";
    } else if (!emailPattern.test(formData.personalEmail.trim())) {
      errors.personalEmail = "Enter a valid personal email address.";
    }

    // Personal Address (Mandatory)
    if (!formData.personalCountry || !formData.personalCountry.trim()) {
      errors.personalCountry = "Personal country is required.";
    }
    if (!formData.personalState || !formData.personalState.trim()) {
      errors.personalState = "Personal state/region is required.";
    }
    if (!formData.personalCity || !formData.personalCity.trim()) {
      errors.personalCity = "Personal city is required.";
    }
    if (!formData.personalPostalCode || !formData.personalPostalCode.trim()) {
      errors.personalPostalCode = "Personal postal code is required.";
    }

    // ══ Company Details Validations (Mandatory ONLY when haveCompany is checked) ══
    if (formData.hasCompany) {
      if (!formData.company || !formData.company.trim()) {
        errors.company = "Company name is required.";
      }
      if (!formData.ownedBy || !formData.ownedBy.trim()) {
        errors.ownedBy = "Owner name is required.";
      }

      const regValue = (formData.registrationNo || formData.gstNo || "").trim();
      const identObj = getIdentifierInfo(formData.businessIdentifier);
      if (!regValue) {
        errors.registrationNo = `${identObj.code || "Registration"} number is required.`;
      } else if (identObj && identObj.regex && !identObj.regex.test(regValue.toUpperCase())) {
        errors.registrationNo = `Invalid ${identObj.code || identObj.id} format. ${identObj.hint || ""}`.trim();
      }

      if (!formData.businessEmail || !formData.businessEmail.trim()) {
        errors.businessEmail = "Business email is required.";
      } else if (!emailPattern.test(formData.businessEmail.trim())) {
        errors.businessEmail = "Enter a valid business email address.";
      }

      if (!formData.companyContactNo || !formData.companyContactNo.trim()) {
        errors.companyContactNo = "Company contact number is required.";
      } else {
        const required = getDigitsForCode(formData.companyContactCode || "+91");
        if (formData.companyContactNo.replace(/\D/g, "").length !== required) {
          errors.companyContactNo = `Enter a valid ${required}-digit number.`;
        }
      }

      if (!formData.companyAltNo || !formData.companyAltNo.trim()) {
        errors.companyAltNo = "Company alternate number is required.";
      } else {
        const required = getDigitsForCode(formData.companyAltCode || "+91");
        if (formData.companyAltNo.replace(/\D/g, "").length !== required) {
          errors.companyAltNo = `Enter a valid ${required}-digit number.`;
        }
      }

      // Company Address (All fields mandatory)
      if (!formData.companyCountry || !formData.companyCountry.trim()) {
        errors.companyCountry = "Company country is required.";
      }
      if (!formData.companyState || !formData.companyState.trim()) {
        errors.companyState = "Company region / state / province is required.";
      }
      if (!formData.companyCity || !formData.companyCity.trim()) {
        errors.companyCity = "Company city is required.";
      }
      if (!formData.companyPostalCode || !formData.companyPostalCode.trim()) {
        errors.companyPostalCode = "Company postal code is required.";
      }
    }

    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const updateFormField = (setForm, setErrors, key, value) => {
    // Numeric-only fields (phone digits only)
    const numericOnlyFields = ["phone", "alternatePhone", "companyContactNo", "companyAltNo", "personalPostalCode", "companyPostalCode"];
    let finalValue = value;
    if (numericOnlyFields.includes(key)) {
      finalValue = value.replace(/\D/g, "");
    }
    setForm((prev) => {
      const nextForm = { ...prev, [key]: finalValue };
      // Keep registrationNo and gstNo in sync
      if (key === "registrationNo") nextForm.gstNo = finalValue;
      if (key === "gstNo") nextForm.registrationNo = finalValue;
      // Auto-set companyCountry and reset companyState when Business Identifier changes
      if (key === "businessIdentifier") {
        const identObj = getIdentifierInfo(finalValue);
        if (identObj && identObj.country && identObj.country !== "Other") {
          nextForm.companyCountry = identObj.country;
          nextForm.companyState = "";
        }
      }
      return nextForm;
    });

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let error = "";

    if ((key === "personalEmail" || key === "businessEmail") && finalValue.trim()) {
      if (!emailPattern.test(finalValue.trim())) error = "Enter a valid email address.";
    }
    if (key === "firstName" && !finalValue.trim()) {
      error = "First name is required.";
    }
    if (key === "businessIdentifier") {
      // Revalidate registration number under new identifier
      const regVal = clientForm.registrationNo || clientForm.gstNo || "";
      if (regVal.trim()) {
        const identObj = getIdentifierInfo(finalValue);
        if (identObj && identObj.regex && !identObj.regex.test(regVal.trim().toUpperCase())) {
          error = `Invalid ${identObj.code || identObj.id} format. ${identObj.hint || ""}`.trim();
        }
      }
    }
    if ((key === "registrationNo" || key === "gstNo") && finalValue.trim()) {
      // Find current identifier
      const identObj = getIdentifierInfo(clientForm.businessIdentifier);
      if (identObj && identObj.regex) {
        if (!identObj.regex.test(finalValue.trim().toUpperCase())) {
          error = `Invalid ${identObj.code || identObj.id} format. ${identObj.hint || ""}`.trim();
        }
      }
    }

    setErrors((prev) => {
      const next = { ...prev };
      if (error) {
        next[key] = error;
        if (key === "registrationNo" || key === "gstNo") {
          next.registrationNo = error;
          next.gstNo = error;
        }
        if (key === "businessIdentifier") {
          next.registrationNo = error;
        }
      } else {
        delete next[key];
        if (key === "registrationNo" || key === "gstNo" || key === "businessIdentifier") {
          delete next.registrationNo;
          delete next.gstNo;
        }
      }
      return next;
    });
  };

  const closeAllAddDropdowns = () => {
    setOpenPhoneCode(false);
    setOpenAltCode(false);
    setOpenCompanyCode(false);
    setOpenCompanyAltCode(false);
    setOpenPersonalCountry(false);
    setOpenPersonalState(false);
    setOpenCompanyCountry(false);
    setOpenCompanyState(false);
    setOpenIdentifierDropdown(false);
    setShowDealerDropdown(false);
    setCountrySearchTerm("");
    setStateSearchTerm("");
    setIdentifierSearchTerm("");
  };

  const openAddClientModal = () => {
    setClientForm({ ...emptyClientForm });
    setClientFormErrors({});
    closeAllAddDropdowns();
    setShowAddModal(true);
  };

  const closeAddClientModal = () => {
    if (savingClient) return;
    setClientForm({ ...emptyClientForm });
    setClientFormErrors({});
    closeAllAddDropdowns();
    setShowAddModal(false);
  };

  const handleAddClient = async (event) => {
    event.preventDefault();
    if (!validateClientData(clientForm, setClientFormErrors)) return;
    setSavingClient(true);

    try {
      await createConvertedClient(clientForm);
      setClientForm({ ...emptyClientForm });
      setClientFormErrors({});
      closeAllAddDropdowns();
      setShowAddModal(false);
      await fetchClients();
      alert("Client added successfully.");
    } catch (error) {
      alert(error.response?.data?.message || error.message || "Failed to add client.");
    } finally {
      setSavingClient(false);
    }
  };

  const openEditClientModal = (client) => {
    setEditingClient(client);
    setEditForm({
      name: client.name === "Untitled Client" ? "" : client.name,
      company: client.company === "-" ? "" : client.company,
      phone: client.phone === "-" ? "" : client.phone,
      email: client.email === "-" ? "" : client.email,
      source: client.recordType === "meta" ? client.source : client.source === "-" ? "" : client.source,
      requirement: client.requirement === "-" ? "" : client.requirement,
      assignedTo: clientRecords.find(c => c._id === client.backendId)?.assignedTo?._id ||
        clientRecords.find(c => c._id === client.backendId)?.assignedTo ||
        leads.find(l => l._id === client.backendId)?.assignedTo?._id ||
        leads.find(l => l._id === client.backendId)?.assignedTo || "",
    });
    setEditFormErrors({});
    setShowEditModal(true);
  };

  const closeEditClientModal = () => {
    if (savingEditClient) return;
    setEditingClient(null);
    setEditForm({ ...emptyClientForm });
    setEditFormErrors({});
    setShowEditModal(false);
  };

  const handleEditClient = async (event) => {
    event.preventDefault();
    if (!editingClient) return;
    if (!validateClientData(editForm, setEditFormErrors)) return;

    setSavingEditClient(true);
    try {
      if (editingClient.recordType === "crm") {
        await api.put(`/leads/${editingClient.backendId}`, {
          name: editForm.name.trim(),
          company: editForm.company.trim(),
          phone: editForm.phone.trim(),
          email: editForm.email.trim(),
          source: editForm.source.trim(),
          requirements: editForm.requirement.trim(),
          notes: editForm.requirement.trim(),
          assignedTo: editForm.assignedTo,
          status: "Converted",
        });
      } else if (editingClient.recordType === "client") {
        await api.put(`/clients/${editingClient.backendId}`, {
          name: editForm.name.trim(),
          company: editForm.company.trim(),
          phone: editForm.phone.trim(),
          email: editForm.email.trim(),
          source: editForm.source.trim(),
          requirements: editForm.requirement.trim(),
          notes: editForm.requirement.trim(),
          assignedTo: editForm.assignedTo,
        });
      } else {
        await api.patch(`/meta-leads/${editingClient.backendId}`, {
          status: "Converted",
          notes: editForm.requirement.trim(),
        });
      }

      closeEditClientModal();
      await fetchClients();
      alert("Client updated successfully.");
    } catch (error) {
      alert(error.response?.data?.message || error.message || "Failed to update client.");
    } finally {
      setSavingEditClient(false);
    }
  };

  const handleDeleteClient = async (client) => {
    const clientName = client.name || "this client";
    if (!window.confirm(`Delete ${clientName}? This cannot be undone.`)) return;

    try {
      if (client.recordType === "crm") {
        await api.delete(`/leads/${client.backendId}`);
      } else if (client.recordType === "client") {
        await api.delete(`/clients/${client.backendId}`);
      } else {
        await api.delete(`/meta-leads/${client.backendId}`);
      }
      await fetchClients();
      alert("Client deleted successfully.");
    } catch (error) {
      alert(error.response?.data?.message || error.message || "Failed to delete client.");
    }
  };

  const openProposalComposer = (client) => {
    setActionMenu(null);
    navigate("/proposals", {
      state: {
        createProposal: true,
        clientDraft: {
          title: `${client.company && client.company !== "-" ? client.company : client.name} Proposal`,
          clientName: client.name === "Untitled Client" ? "" : client.name,
          clientEmail: client.email === "-" ? "" : client.email,
          clientPhone: client.phone === "-" ? "" : client.phone,
          clientAddress: client.company === "-" ? "" : client.company,
          contactName: client.name === "Untitled Client" ? "" : client.name,
          notes: client.requirement === "-" ? "" : client.requirement,
          projectScope: client.requirement === "-" ? "" : client.requirement,
        },
      },
    });
  };

  const toggleActionMenu = (event, clientId) => {
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 160;
    const menuHeight = 134;
    const viewportPadding = 12;
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    const shouldOpenAbove = spaceBelow < menuHeight + 8 && buttonRect.top > menuHeight + 8;

    setActionMenu((prev) => {
      if (prev?.id === clientId) {
        return null;
      }

      return {
        id: clientId,
        top: shouldOpenAbove ? buttonRect.top - menuHeight - 8 : buttonRect.bottom + 8,
        left: Math.min(
          Math.max(viewportPadding, buttonRect.right - menuWidth),
          window.innerWidth - menuWidth - viewportPadding
        ),
      };
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportCsv = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingCsv(true);

    try {
      const text = await file.text();
      const parsedRows = parseCsvText(text);

      if (!parsedRows.length) {
        throw new Error("CSV is empty or missing data rows.");
      }

      const normalizedRows = parsedRows.map((row) => ({
        name: row.name || row["client name"] || row.client || "",
        company: row.company || row.organization || "",
        phone: row.phone || row.mobile || row["contact number"] || row.contact || "",
        email: row.email || row["email address"] || "",
        source: "Excel Imported",
        requirement: row.requirement || row.requirements || row.notes || row.description || "",
      }));

      const validRows = normalizedRows.filter(
        (row) => row.name && row.phone && row.email && row.source
      );

      if (!validRows.length) {
        throw new Error("Each CSV row must include at least name, phone, email, and source columns.");
      }

      for (const row of validRows) {
        await createConvertedClient(row);
      }

      await fetchClients();
      alert(`${validRows.length} client${validRows.length > 1 ? "s" : ""} imported successfully.`);
    } catch (error) {
      alert(error.response?.data?.message || error.message || "CSV import failed.");
    } finally {
      event.target.value = "";
      setImportingCsv(false);
    }
  };

  if (loading) {
    return (
      <div
        className="page-container"
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: "28px 28px 40px",
          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
        }}
      >
        <style>{`
          @keyframes clients-skeleton-shimmer {
            0% { background-position: 100% 0; }
            100% { background-position: -100% 0; }
          }

          .clients-skeleton {
            background: linear-gradient(90deg, #eef2f7 25%, #f8fafc 37%, #eef2f7 63%);
            background-size: 400% 100%;
            animation: clients-skeleton-shimmer 1.4s ease infinite;
          }
        `}</style>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div className="clients-skeleton" style={{ width: 120, height: 34, borderRadius: 8, marginBottom: 8 }} />
            <div className="clients-skeleton" style={{ width: 320, height: 14, borderRadius: 6 }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <div className="clients-skeleton" style={{ width: 122, height: 38, borderRadius: 10 }} />
            <div className="clients-skeleton" style={{ width: 122, height: 38, borderRadius: 10 }} />
            <div className="clients-skeleton" style={{ width: 116, height: 38, borderRadius: 10 }} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "22px" }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px" }}>
              <div className="clients-skeleton" style={{ width: "44%", height: 13, borderRadius: 6, marginBottom: 14 }} />
              <div className="clients-skeleton" style={{ width: "28%", height: 34, borderRadius: 8, marginBottom: 12 }} />
              <div className="clients-skeleton" style={{ width: 34, height: 3, borderRadius: 999 }} />
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(15,23,42,0.04)" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
            <div className="clients-skeleton" style={{ width: 340, maxWidth: "100%", height: 40, borderRadius: 10 }} />
            <div className="clients-skeleton" style={{ width: 110, height: 14, borderRadius: 6 }} />
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <th key={index} style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9" }}>
                      <div className="clients-skeleton" style={{ width: `${60 + (index % 3) * 18}px`, height: 10, borderRadius: 5 }} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, rowIndex) => (
                  <tr key={rowIndex} style={{ borderBottom: rowIndex < 5 ? "1px solid #f8fafc" : "none" }}>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="clients-skeleton" style={{ width: "65%", height: 13, borderRadius: 6, marginBottom: 8 }} />
                      <div className="clients-skeleton" style={{ width: "82%", height: 11, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="clients-skeleton" style={{ width: "58%", height: 12, borderRadius: 6, marginBottom: 8 }} />
                      <div className="clients-skeleton" style={{ width: "78%", height: 11, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="clients-skeleton" style={{ width: "88%", height: 12, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="clients-skeleton" style={{ width: 180, maxWidth: "100%", height: 24, borderRadius: 999 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="clients-skeleton" style={{ width: "68%", height: 12, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="clients-skeleton" style={{ width: 86, height: 24, borderRadius: 999 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div className="clients-skeleton" style={{ width: "72%", height: 12, borderRadius: 6 }} />
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <div className="clients-skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
                        <div className="clients-skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="page-container"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#f8fafc",
        padding: "28px 28px 40px",
        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImportCsv}
        style={{ display: "none" }}
      />

      <style>{`
        /* Sparkline animations */
        @keyframes sparkline-draw {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes sparkline-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .sparkline-line {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: sparkline-draw 1.2s ease-out forwards;
        }
        .sparkline-fill {
          opacity: 0;
          animation: sparkline-fade-in 0.8s ease-out 0.3s forwards;
        }
        .sparkline-dot {
          opacity: 0;
          animation: sparkline-fade-in 0.4s ease-out 1s forwards;
        }

        /* Export/Import/Cancel button hover effects - Liquid fill animation */
        .clients-export-btn,
        .clients-import-btn,
        .clients-cancel-btn {
          position: relative;
          isolation: isolate;
          overflow: hidden;
          transition: color 0.35s ease, border-color 0.35s ease;
        }

        .clients-export-btn::before,
        .clients-import-btn::before,
        .clients-cancel-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a8e63d 0%, #9fdd39 52%, #94d82d 100%);
          transform: translateX(-110%);
          transition: transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1);
          z-index: 0;
          pointer-events: none;
        }

        .clients-export-btn::after,
        .clients-import-btn::after,
        .clients-cancel-btn::after {
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

        .clients-export-btn:hover,
        .clients-import-btn:hover,
        .clients-cancel-btn:hover {
          color: #1f2937 !important;
          border-color: transparent !important;
        }

        .clients-export-btn:hover::before,
        .clients-import-btn:hover::before,
        .clients-cancel-btn:hover::before {
          transform: translateX(0%);
        }

        .clients-export-btn:hover::after,
        .clients-import-btn:hover::after,
        .clients-cancel-btn:hover::after {
          transform: translateX(255%) rotate(8deg);
        }

        @keyframes clients-bubble-float-large {
          0% { transform: translate(0px, 0px) scale(1); }
          30% { transform: translate(-5px, -7px) scale(1.04); }
          60% { transform: translate(4px, -4px) scale(0.97); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        @keyframes clients-bubble-float-small {
          0% { transform: translate(0px, 0px) scale(1); }
          35% { transform: translate(6px, -9px) scale(1.06); }
          65% { transform: translate(-4px, -3px) scale(0.95); }
          100% { transform: translate(0px, 0px) scale(1); }
        }

        .clients-metrics-grid > div {
          position: relative;
          overflow: hidden;
          isolation: isolate;
        }

        .clients-metrics-grid > div::before {
          content: '';
          position: absolute;
          z-index: 0;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: #667eea;
          opacity: 0.06;
          right: -26px;
          bottom: -26px;
          pointer-events: none;
          animation: clients-bubble-float-large 5.5s ease-in-out infinite;
        }

        .clients-metrics-grid > div::after {
          content: '';
          position: absolute;
          z-index: 0;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: #667eea;
          opacity: 0.04;
          right: 36px;
          bottom: -20px;
          pointer-events: none;
          animation: clients-bubble-float-small 4.2s ease-in-out infinite;
        }

        .clients-metrics-grid > div:nth-child(1)::before,
        .clients-metrics-grid > div:nth-child(1)::after {
          background: #667eea;
        }

        .clients-metrics-grid > div:nth-child(2)::before,
        .clients-metrics-grid > div:nth-child(2)::after {
          background: #10b981;
        }

        .clients-metrics-grid > div:nth-child(3)::before,
        .clients-metrics-grid > div:nth-child(3)::after {
          background: #8b5cf6;
        }

        .clients-metrics-grid > div:nth-child(4)::before,
        .clients-metrics-grid > div:nth-child(4)::after {
          background: #f59e0b;
        }

        .clients-metrics-grid > div:nth-child(2)::before { animation-delay: 0.8s; }
        .clients-metrics-grid > div:nth-child(3)::before { animation-delay: 1.5s; }
        .clients-metrics-grid > div:nth-child(4)::before { animation-delay: 2.2s; }
        .clients-metrics-grid > div:nth-child(2)::after { animation-delay: 1.2s; }
        .clients-metrics-grid > div:nth-child(3)::after { animation-delay: 0.5s; }
        .clients-metrics-grid > div:nth-child(4)::after { animation-delay: 1.8s; }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "22px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "-0.025em",
            }}
          >
            Clients Management
          </h1>
          <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0", fontWeight: 500 }}>
            Converted leads from CRM and Meta are listed here automatically.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ position: 'relative' }}>
            <NotificationBell filterType="Client" />
          </div>

          {hasFullAccess && (
            <button
              onClick={handleExportCsv}
              className="clients-export-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                background: "#fff",
                color: "#475569",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
              }}
            >
              <svg style={{ position: "relative", zIndex: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span style={{ position: "relative", zIndex: 1 }}>Export CSV</span>
            </button>
          )}

          {hasFullAccess && (
            <button
              onClick={handleImportClick}
              disabled={importingCsv}
              className="clients-import-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                background: "#fff",
                color: "#475569",
                fontSize: "12px",
                fontWeight: 700,
                cursor: importingCsv ? "not-allowed" : "pointer",
                opacity: importingCsv ? 0.6 : 1,
                fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
              }}
            >
              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </span>
              <span style={{ position: "relative", zIndex: 1 }}>{importingCsv ? "Importing..." : "Import CSV"}</span>
            </button>
          )}

          {canCreateClients && <button
            onClick={openAddClientModal}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "8px 14px",
              border: "none",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Client
          </button>}
        </div>
      </div>

      <div
        className="clients-metrics-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
          marginBottom: "22px",
        }}
      >
        {[
          { label: "Total Clients", value: stats.total, color: "#667eea", trend: totalChange, isUp: totalTrend, spark: sparklineData.total },
          { label: "Manual Clients", value: stats.manual, color: "#10b981", trend: manualChange, isUp: manualTrend, spark: sparklineData.manual },
          { label: "Excel Imported", value: stats.excel, color: "#8b5cf6", trend: excelChange, isUp: excelTrend, spark: sparklineData.excel },
          { label: "Lead Converted", value: stats.leadConverted, color: "#f59e0b", trend: leadConvertedChange, isUp: leadConvertedTrend, spark: sparklineData.leadConverted },
        ].map((item) => (
          <div
            key={item.label}
            onClick={() => setActiveCardFilter(activeCardFilter === item.label ? 'Total Clients' : item.label)}
            style={{
              background: "#fff",
              border: activeCardFilter === item.label ? `2px solid ${item.color}` : "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: activeCardFilter === item.label ? "19px 21px 15px" : "20px 22px 16px",
              minHeight: "115px",
              overflow: "hidden",
              position: "relative",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: activeCardFilter === item.label ? `0 4px 12px ${item.color}20` : "none"
            }}
          >
            {/* Top row: label + trend badge */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "6px" }}>
              <div style={{ fontSize: "11.5px", color: "#64748b", fontWeight: 600, lineHeight: 1.3 }}>
                {item.label}
              </div>
              <span style={{
                fontSize: "10px", fontWeight: 700,
                padding: "2px 6px", borderRadius: "20px",
                background: item.isUp ? "rgba(168,230,61,0.15)" : "rgba(239,68,68,0.1)",
                color: item.isUp ? "#3d7c00" : "#dc2626",
                whiteSpace: "nowrap",
              }}>
                {item.isUp ? "▲" : "▼"} {item.trend}
              </span>
            </div>

            {/* Value */}
            <div style={{ fontSize: "28px", fontWeight: 300, color: "#0f172a", lineHeight: 1, marginBottom: "10px" }}>
              {item.value}
            </div>

            {/* Bottom row: sparkline + from last month */}
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: item.isUp ? "#16a34a" : "#ef4444", lineHeight: 1.2 }}>
                  {item.isUp ? "+" : ""}{item.trend}
                </span>
                <span style={{ fontSize: "10px", color: "#94a3b8", lineHeight: 1.4 }}>vs last month</span>
              </div>
              <Sparkline data={item.spark} color={item.color} />
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: "14px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #f1f5f9",
            background: "#fafafa",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "8px 12px",
                minWidth: "240px",
                maxWidth: "340px",
                width: "100%",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Search clients by name, company, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  width: "100%",
                  fontSize: "12px",
                  color: "#0f172a",
                  fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                }}
              />
            </div>

            <div ref={dealerFilterRef} style={{ position: "relative" }}>
              <div
                onClick={() => setOpenDealerFilter(!openDealerFilter)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 10px",
                  background: filterDealer ? "#f0fdf4" : "#fff",
                  border: `1px solid ${filterDealer ? "#3b775e" : "#e2e8f0"}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: filterDealer ? "#3b775e" : "#475569",
                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap"
                }}
              >
                {filterDealer ? filterDealer : "All Dealers"}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              {openDealerFilter && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 25px rgba(15,23,42,0.1)", padding: "8px", zIndex: 100, minWidth: "160px", display: "flex", flexDirection: "column", gap: "2px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "4px 8px 6px", borderBottom: "1px solid #f1f5f9", marginBottom: "4px" }}>Dealer</div>
                  <div
                    onClick={() => { setFilterDealer(""); setOpenDealerFilter(false); }}
                    style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: !filterDealer ? "#15803d" : "#475569", background: !filterDealer ? "#f0fdf4" : "transparent", fontWeight: !filterDealer ? 600 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                    onMouseEnter={(e) => { if (filterDealer) e.currentTarget.style.background = "#f1f5f9"; }}
                    onMouseLeave={(e) => { if (filterDealer) e.currentTarget.style.background = "transparent"; }}
                  >
                    All Dealers
                  </div>
                  {uniqueDealers.map((dlr) => (
                    <div
                      key={dlr}
                      onClick={() => { setFilterDealer(dlr); setOpenDealerFilter(false); }}
                      style={{ padding: "8px 12px", borderRadius: "8px", fontSize: "12px", color: filterDealer === dlr ? "#15803d" : "#475569", background: filterDealer === dlr ? "#f0fdf4" : "transparent", fontWeight: filterDealer === dlr ? 600 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
                      onMouseEnter={(e) => { if (filterDealer !== dlr) e.currentTarget.style.background = "#f1f5f9"; }}
                      onMouseLeave={(e) => { if (filterDealer !== dlr) e.currentTarget.style.background = "transparent"; }}
                    >
                      {dlr}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div ref={dateFilterRef} style={{ position: "relative" }}>
              <div
                onClick={() => setOpenDateFilter(!openDateFilter)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 10px",
                  background: (filterDate || filterEndDate) ? "#f0fdf4" : "#fff",
                  border: `1px solid ${(filterDate || filterEndDate) ? "#3b775e" : "#e2e8f0"}`,
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: (filterDate || filterEndDate) ? "#3b775e" : "#475569",
                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap"
                }}
              >
                {filterDate && filterEndDate ? `${new Date(filterDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(filterEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : filterDate ? `>= ${new Date(filterDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : filterEndDate ? `<= ${new Date(filterEndDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}` : "Any Date"}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
              {openDateFilter && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 25px rgba(15,23,42,0.1)", padding: "12px", zIndex: 100, minWidth: "200px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "0 2px" }}>Start Date</div>
                  <input
                    type="date"
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none", boxSizing: "border-box" }}
                  />
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", padding: "0 2px", marginTop: "4px" }}>End Date</div>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                    style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12px", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", outline: "none", boxSizing: "border-box", marginBottom: "4px" }}
                  />
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => setOpenDateFilter(false)} style={{ flex: 1, padding: "6px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#3b775e", color: "#fff", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Apply</button>
                    {(filterDate || filterEndDate) && (
                      <button onClick={() => { setFilterDate(""); setFilterEndDate(""); setOpenDateFilter(false); }} style={{ flex: 1, padding: "6px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc", color: "#dc2626", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>Clear</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
            Showing {filteredClients.length === 0 ? 0 : pageStartIndex + 1}-{Math.min(pageStartIndex + paginatedClients.length, filteredClients.length)} of {filteredClients.length}
          </div>
        </div>

        {filteredClients.length === 0 ? (
          <div style={{ padding: "64px 24px", textAlign: "center" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#0f172a", marginBottom: "6px" }}>
              No converted clients found
            </div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
              Leads with status Converted will appear here automatically.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", overflowY: "auto", flex: 1, minHeight: 0, scrollbarWidth: "thin", scrollbarColor: "#cbd5e1 transparent" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1000px" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ background: "#fafafa" }}>
                  {[
                    "#",
                    "Client",
                    "Contact",
                    "Requirement",
                    "Source",
                    "Dealer",
                    "Type",
                    "Converted On",
                    "Added By",
                    "Actions",
                  ].map((label) => (
                    <th
                      key={label}
                      style={{
                        padding: "9px 12px",
                        textAlign: "left",
                        fontSize: "9.5px",
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        borderBottom: "1px solid #f1f5f9",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedClients.map((client, index) => (
                  <tr
                    key={client.id}
                    onClick={() => setSelectedClientForProjects(client)}
                    style={{
                      borderBottom: index < paginatedClients.length - 1 ? "1px solid #f8fafc" : "none",
                      cursor: "pointer",
                      background: "transparent",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#f1f5f9";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td style={{ padding: "9px 12px", width: "40px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>
                        {String(pageStartIndex + index + 1).padStart(2, '0')}
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div>
                        <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#0f172a", marginBottom: "2px" }}>
                          {client.name}
                        </div>
                        <div style={{ fontSize: "10px", color: "#94a3b8" }}>{client.company}</div>
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ fontSize: "11px", color: "#475569", marginBottom: "2px" }}>{client.phone}</div>
                      <div style={{ fontSize: "10px", color: "#94a3b8" }}>{client.email}</div>
                    </td>
                    <td style={{ padding: "9px 12px", maxWidth: "170px" }}>
                      <div style={{ fontSize: "11px", color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {client.requirement}
                      </div>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      {(() => {
                        let s = client.source || "Manual";
                        // Rename Meta to Lead Conversion for display
                        if (s === "Meta") s = "Lead Conversion";

                        let bg = "#f1f5f9", text = "#475569";
                        if (s === "Manual") { bg = "#eff6ff"; text = "#2563eb"; }
                        else if (s === "Lead Conversion") { bg = "#f0fdf4"; text = "#16a34a"; }
                        else if (s.includes("Excel")) { bg = "#fff7ed"; text = "#ea580c"; }
                        else if (s === "Website") { bg = "#ecfeff"; text = "#0891b2"; }

                        return (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "3px 10px",
                              borderRadius: "999px",
                              fontSize: "10px",
                              fontWeight: 700,
                              color: text,
                              background: bg,
                              border: `1px solid ${text}20`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "11px", color: "#475569", fontWeight: 500 }}>
                      {client.assignedTo}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "3px 8px",
                          borderRadius: "999px",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "#166534",
                          background: "#dcfce7",
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e" }} />
                        {client.clientType}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "10px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {formatDate(client.convertedOn)}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          fontSize: "9.5px",
                          fontWeight: 700,
                          color: "#8b5cf6",
                          background: "#f3e8ff",
                          border: "1px solid #e9d5ff",
                          whiteSpace: "nowrap"
                        }}
                      >
                        {client.addedBy}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }} data-client-action-menu>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleActionMenu(event, client.id);
                          }}
                          title="Client actions"
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            background: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: "#475569",
                            boxShadow: actionMenu?.id === client.id ? "0 8px 18px rgba(15, 23, 42, 0.08)" : "none",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <circle cx="12" cy="5" r="1.8" />
                            <circle cx="12" cy="12" r="1.8" />
                            <circle cx="12" cy="19" r="1.8" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredClients.length > 0 && totalPages > 1 && (
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
              Page {currentPage} of {totalPages}
            </span>

            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                style={{
                  minWidth: "64px",
                  height: "28px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#64748b",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  opacity: currentPage === 1 ? 0.45 : 1,
                }}
              >
                Prev
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = index + 1;
                } else if (currentPage <= 3) {
                  pageNumber = index + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + index;
                } else {
                  pageNumber = currentPage - 2 + index;
                }

                return (
                  <button
                    key={pageNumber}
                    onClick={() => setCurrentPage(pageNumber)}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "8px",
                      border: pageNumber === currentPage ? "1px solid #a3e635" : "1px solid #e2e8f0",
                      background: pageNumber === currentPage ? "#a3e635" : "#fff",
                      color: pageNumber === currentPage ? "#fff" : "#64748b",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {pageNumber}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                style={{
                  minWidth: "64px",
                  height: "28px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#64748b",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  opacity: currentPage === totalPages ? 0.45 : 1,
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>


      {actionMenu && (() => {
        const activeClient = clients.find((client) => client.id === actionMenu.id);
        if (!activeClient) return null;

        return (
          <div
            data-client-action-menu
            style={{
              position: "fixed",
              top: actionMenu.top,
              left: actionMenu.left,
              width: "160px",
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
              padding: "6px",
              zIndex: 1200,
            }}
          >
            {canReadClients && (
              <button
                onClick={() => {
                  setActionMenu(null);
                  setViewingClient(activeClient);
                  setShowViewModal(true);
                }}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  borderRadius: "8px",
                  padding: "9px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                View details
              </button>
            )}
            {hasPermission('proposals', 'create') && (
              <button
                onClick={() => openProposalComposer(activeClient)}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  borderRadius: "8px",
                  padding: "9px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16v16H4z" />
                  <path d="M8 9h8" />
                  <path d="M8 13h8" />
                  <path d="M8 17h5" />
                </svg>
                Proposal
              </button>
            )}
            {canUpdateClients && <button
              onClick={() => {
                setActionMenu(null);
                openEditClientModal(activeClient);
              }}
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                borderRadius: "8px",
                padding: "9px 10px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#334155",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
              Edit client
            </button>}
            {canDeleteClients && (
              <button
                onClick={() => {
                  setActionMenu(null);
                  handleDeleteClient(activeClient);
                }}
                style={{
                  width: "100%",
                  border: "none",
                  background: "transparent",
                  borderRadius: "8px",
                  padding: "9px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#dc2626",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
                Delete client
              </button>
            )}
          </div>
        );
      })()}
      {showAddModal && (() => {
        /* ─ Style helpers ───────────────────────────────────────── */
        const IS = (err) => ({
          height: "40px",
          borderRadius: "8px",
          border: err ? "1.5px solid #ef4444" : "1.5px solid #e2e8f0",
          padding: "0 12px",
          fontSize: "13px",
          color: "#0f172a",
          fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
          width: "100%",
          boxSizing: "border-box",
          outline: "none",
          background: "#fff",
          transition: "all 0.15s ease",
        });
        const LS = {
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          fontSize: "12px",
          fontWeight: 600,
          color: "#334155",
        };
        const ERR = (msg) => msg ? <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 500, marginTop: "2px" }}>{msg}</span> : null;

        /* ─ Custom CodeDropdown (Country Calling Code) ───────────── */
        const CodeDropdown = ({ codeKey, isOpen, setOpen }) => {
          const val = clientForm[codeKey];
          const selected = COUNTRY_CODES.find(c => c.code === val) || COUNTRY_CODES[0];
          return (
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div onClick={(e) => { e.stopPropagation(); const next = !isOpen; closeAllAddDropdowns(); setOpen(next); }}
                style={{
                  height: "40px",
                  borderRadius: "8px",
                  border: "1.5px solid #e2e8f0",
                  padding: "0 10px",
                  background: "#f8fafc",
                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px",
                  cursor: "pointer",
                  minWidth: "85px",
                  boxSizing: "border-box",
                  userSelect: "none",
                }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>{selected.code}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              {isOpen && (
                <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, minWidth: "220px", background: "#fff", zIndex: 600, border: "1px solid #e2e8f0", borderRadius: "10px", boxShadow: "0 12px 28px rgba(15,23,42,0.14)", padding: "6px" }}>
                  <div style={{ maxHeight: "210px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
                    {COUNTRY_CODES.map(c => (
                      <div key={c.code} onClick={() => { updateFormField(setClientForm, setClientFormErrors, codeKey, c.code); setOpen(false); }}
                        style={{ padding: "8px 11px", fontSize: "12px", cursor: "pointer", borderRadius: "6px", display: "flex", alignItems: "center", gap: "8px", background: val === c.code ? "#dcfce7" : "transparent", color: val === c.code ? "#16a34a" : "#334155", fontWeight: val === c.code ? 600 : 400 }}
                        onMouseEnter={e => { if (val !== c.code) e.currentTarget.style.background = "#f1f5f9"; }}
                        onMouseLeave={e => { if (val !== c.code) e.currentTarget.style.background = "transparent"; }}>
                        <span style={{ fontWeight: 700, minWidth: 38, color: "#0f172a" }}>{c.code}</span>
                        <span style={{ color: "#64748b" }}>{c.name}</span>
                        {val === c.code && <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        };

        /* ─ PhoneRow ──────────────────────────────────────────── */
        const PhoneRow = ({ codeKey, numKey, isOpen, setOpen, placeholderText }) => (
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            <CodeDropdown codeKey={codeKey} isOpen={isOpen} setOpen={setOpen} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <input type="text" inputMode="numeric" value={clientForm[numKey]}
                onChange={(e) => updateFormField(setClientForm, setClientFormErrors, numKey, e.target.value)}
                placeholder={placeholderText || `Enter ${getDigitsForCode(clientForm[codeKey])} digit phone`}
                maxLength={getDigitsForCode(clientForm[codeKey])} style={IS(clientFormErrors[numKey])} />
              {ERR(clientFormErrors[numKey])}
            </div>
          </div>
        );

        /* ─ Searchable Country Dropdown ───────────────────────── */
        const CountrySelect = ({ countryKey, stateKey, isOpen, setOpen, restrictedCountry }) => {
          const currentCountry = clientForm[countryKey] || "";
          const availableCountryList = restrictedCountry ? [restrictedCountry] : COUNTRY_LIST;
          const filteredCountries = availableCountryList.filter(c =>
            c.toLowerCase().includes(countrySearchTerm.toLowerCase())
          );

          return (
            <div style={{ position: "relative", width: "100%" }}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  // If strictly locked to 1 country, no need to open dropdown
                  if (restrictedCountry) return;
                  const next = !isOpen;
                  closeAllAddDropdowns();
                  setOpen(next);
                }}
                style={{
                  height: "40px",
                  borderRadius: "8px",
                  border: "1.5px solid #e2e8f0",
                  padding: "0 12px",
                  fontSize: "13px",
                  color: currentCountry ? "#0f172a" : "#94a3b8",
                  background: restrictedCountry ? "#f8fafc" : "#fff",
                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: restrictedCountry ? "default" : "pointer",
                  userSelect: "none",
                  boxSizing: "border-box",
                }}
              >
                <span>{currentCountry || (restrictedCountry ? restrictedCountry : "Select country")}</span>
                {!restrictedCountry ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                ) : (
                  <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600, background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>
                    Locked to {restrictedCountry}
                  </span>
                )}
              </div>

              {isOpen && !restrictedCountry && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, width: "100%",
                    background: "#fff", zIndex: 600, border: "1px solid #e2e8f0",
                    borderRadius: "10px", boxShadow: "0 12px 28px rgba(15,23,42,0.14)", padding: "6px",
                    boxSizing: "border-box",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search country..."
                    value={countrySearchTerm}
                    onChange={(e) => setCountrySearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "100%", border: "none", background: "#f8fafc",
                      padding: "8px 12px", borderRadius: "6px", fontSize: "12px",
                      outline: "none", marginBottom: "4px",
                      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
                    {filteredCountries.length === 0 ? (
                      <div style={{ padding: "8px 11px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>No country found</div>
                    ) : (
                      filteredCountries.map(cnt => (
                        <div
                          key={cnt}
                          onClick={() => {
                            updateFormField(setClientForm, setClientFormErrors, countryKey, cnt);
                            updateFormField(setClientForm, setClientFormErrors, stateKey, "");
                            setOpen(false);
                            setCountrySearchTerm("");
                          }}
                          style={{
                            padding: "8px 11px", fontSize: "12px", cursor: "pointer",
                            borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "space-between",
                            background: currentCountry === cnt ? "#dcfce7" : "transparent",
                            color: currentCountry === cnt ? "#16a34a" : "#334155",
                            fontWeight: currentCountry === cnt ? 600 : 400,
                          }}
                          onMouseEnter={e => { if (currentCountry !== cnt) e.currentTarget.style.background = "#f1f5f9"; }}
                          onMouseLeave={e => { if (currentCountry !== cnt) e.currentTarget.style.background = "transparent"; }}
                        >
                          <span>{cnt}</span>
                          {currentCountry === cnt && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };

        /* ─ Searchable State Dropdown (Dependent on Country) ───── */
        const StateSelect = ({ countryKey, stateKey, isOpen, setOpen }) => {
          const selectedCountry = clientForm[countryKey] || "";
          const currentState = clientForm[stateKey] || "";
          const availableStates = getStatesForCountry(selectedCountry);
          const filteredStates = availableStates.filter(s =>
            s.toLowerCase().includes(stateSearchTerm.toLowerCase())
          );

          return (
            <div style={{ position: "relative", width: "100%" }}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (!selectedCountry) return;
                  const next = !isOpen;
                  closeAllAddDropdowns();
                  setOpen(next);
                }}
                style={{
                  height: "40px",
                  borderRadius: "8px",
                  border: "1.5px solid #e2e8f0",
                  padding: "0 12px",
                  fontSize: "13px",
                  color: currentState ? "#0f172a" : "#94a3b8",
                  background: selectedCountry ? "#fff" : "#f8fafc",
                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: selectedCountry ? "pointer" : "not-allowed",
                  userSelect: "none",
                  boxSizing: "border-box",
                  opacity: selectedCountry ? 1 : 0.7,
                }}
              >
                <span>{currentState || (selectedCountry ? "Select region / state / province" : "Select country first")}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </div>

              {isOpen && selectedCountry && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, width: "100%",
                    background: "#fff", zIndex: 600, border: "1px solid #e2e8f0",
                    borderRadius: "10px", boxShadow: "0 12px 28px rgba(15,23,42,0.14)", padding: "6px",
                    boxSizing: "border-box",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search region / state / province..."
                    value={stateSearchTerm}
                    onChange={(e) => setStateSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "100%", border: "none", background: "#f8fafc",
                      padding: "8px 12px", borderRadius: "6px", fontSize: "12px",
                      outline: "none", marginBottom: "4px",
                      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
                    {filteredStates.length === 0 ? (
                      <div style={{ padding: "8px 11px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>No regions available</div>
                    ) : (
                      filteredStates.map(st => (
                        <div
                          key={st}
                          onClick={() => {
                            updateFormField(setClientForm, setClientFormErrors, stateKey, st);
                            setOpen(false);
                            setStateSearchTerm("");
                          }}
                          style={{
                            padding: "8px 11px", fontSize: "12px", cursor: "pointer",
                            borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "space-between",
                            background: currentState === st ? "#dcfce7" : "transparent",
                            color: currentState === st ? "#16a34a" : "#334155",
                            fontWeight: currentState === st ? 600 : 400,
                          }}
                          onMouseEnter={e => { if (currentState !== st) e.currentTarget.style.background = "#f1f5f9"; }}
                          onMouseLeave={e => { if (currentState !== st) e.currentTarget.style.background = "transparent"; }}
                        >
                          <span>{st}</span>
                          {currentState === st && (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };

        /* ─ Searchable Business Identifier Dropdown ──────────── */
        const IdentifierSelect = () => {
          const currentIdentId = clientForm.businessIdentifier || "GSTIN";
          const currentInfo = getIdentifierInfo(currentIdentId);
          const filteredIdentifiers = BUSINESS_IDENTIFIERS.filter(b =>
            `${b.country} ${b.code} ${b.name}`.toLowerCase().includes(identifierSearchTerm.toLowerCase())
          );

          return (
            <div style={{ position: "relative", width: "100%" }}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !openIdentifierDropdown;
                  closeAllAddDropdowns();
                  setOpenIdentifierDropdown(next);
                }}
                style={{
                  height: "40px",
                  borderRadius: "8px",
                  border: "1.5px solid #e2e8f0",
                  padding: "0 12px",
                  fontSize: "13px",
                  color: "#0f172a",
                  background: "#fff",
                  fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  userSelect: "none",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                  <span style={{ fontWeight: 700, color: "#16a34a", fontSize: "12px", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>
                    {currentInfo.code || currentInfo.id}
                  </span>
                  <span style={{ fontSize: "12px", color: "#334155", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {currentInfo.name}
                  </span>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
              </div>

              {openIdentifierDropdown && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, width: "100%",
                    background: "#fff", zIndex: 650, border: "1px solid #e2e8f0",
                    borderRadius: "10px", boxShadow: "0 12px 28px rgba(15,23,42,0.14)", padding: "6px",
                    boxSizing: "border-box",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Search country / identifier (e.g. India, EIN, VAT, TRN)..."
                    value={identifierSearchTerm}
                    onChange={(e) => setIdentifierSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "100%", border: "none", background: "#f8fafc",
                      padding: "8px 12px", borderRadius: "6px", fontSize: "12px",
                      outline: "none", marginBottom: "4px",
                      fontFamily: "'Inter','Poppins','Segoe UI',sans-serif",
                      boxSizing: "border-box",
                    }}
                  />
                  <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
                    {filteredIdentifiers.length === 0 ? (
                      <div style={{ padding: "8px 11px", fontSize: "12px", color: "#94a3b8", textAlign: "center" }}>No identifiers found</div>
                    ) : (
                      filteredIdentifiers.map(b => {
                        const isSelected = (currentInfo.id === b.id || currentInfo.code === b.code);
                        return (
                          <div
                            key={`${b.country}-${b.id}`}
                            onClick={() => {
                              updateFormField(setClientForm, setClientFormErrors, "businessIdentifier", b.id);
                              setOpenIdentifierDropdown(false);
                              setIdentifierSearchTerm("");
                            }}
                            style={{
                              padding: "8px 11px", fontSize: "12px", cursor: "pointer",
                              borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "space-between",
                              background: isSelected ? "#dcfce7" : "transparent",
                              color: isSelected ? "#16a34a" : "#334155",
                              fontWeight: isSelected ? 600 : 400,
                            }}
                            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f1f5f9"; }}
                            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                              <span style={{ fontWeight: 700, minWidth: "55px", color: isSelected ? "#16a34a" : "#0f172a" }}>{b.code}</span>
                              <span style={{ color: "#64748b", fontSize: "11px" }}>({b.country}) {b.name}</span>
                            </div>
                            {isSelected && (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        };

        /* ─ Section header ──────────────────────────────────── */
        const SH = ({ icon, title, sub }) => (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 28px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: "linear-gradient(135deg,#3b775e 0%,#56a07a 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{title}</div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>{sub}</div>
            </div>
          </div>
        );

        const currentIdentifierObj = getIdentifierInfo(clientForm.businessIdentifier);
        const identCountryRestricted = currentIdentifierObj.country !== "Other" ? currentIdentifierObj.country : "";
        const currentRegValue = clientForm.registrationNo || clientForm.gstNo || "";
        const isRegValid = currentRegValue && currentIdentifierObj.regex && currentIdentifierObj.regex.test(currentRegValue.trim().toUpperCase());

        return (
          <div onClick={() => { closeAddClientModal(); closeAllAddDropdowns(); }}
            style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.52)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 1000 }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width: "100%", maxWidth: "880px", background: "#fff", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 24px 48px rgba(15,23,42,0.18)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
              
              {/* Header */}
              <div style={{ padding: "18px 28px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "linear-gradient(135deg,#3b775e 0%,#56a07a 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>Add New Client</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "1px" }}>Fill in both sections to create a complete client record.</div>
                  </div>
                </div>
                <button onClick={closeAddClientModal} style={{ width: 30, height: 30, borderRadius: "6px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
              </div>

              {/* Scrollable Form Body */}
              <div style={{ overflowY: "auto", flex: 1 }} onClick={closeAllAddDropdowns}>
                <form id="add-client-form" onSubmit={handleAddClient} onClick={(e) => e.stopPropagation()}>
                  
                  {/* ══ SECTION 1 : Basic Details ══ */}
                  <SH icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>} title="Basic Details" sub="Personal information of the client (Mandatory)" />
                  
                  <div style={{ padding: "18px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
                    <label style={LS}>
                      <span>First Name <span style={{ color: "#ef4444" }}>*</span></span>
                      <input type="text" value={clientForm.firstName} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "firstName", e.target.value)} placeholder="Enter first name" style={IS(clientFormErrors.firstName)} />
                      {ERR(clientFormErrors.firstName)}
                    </label>

                    <label style={LS}>
                      <span>Last Name <span style={{ color: "#ef4444" }}>*</span></span>
                      <input type="text" value={clientForm.lastName} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "lastName", e.target.value)} placeholder="Enter last name" style={IS(clientFormErrors.lastName)} />
                      {ERR(clientFormErrors.lastName)}
                    </label>

                    <label style={LS}>
                      <span>Phone Number <span style={{ color: "#ef4444" }}>*</span></span>
                      <PhoneRow codeKey="phoneCountryCode" numKey="phone" isOpen={openPhoneCode} setOpen={setOpenPhoneCode} placeholderText="Enter phone number" />
                    </label>

                    <label style={LS}>
                      <span>Alternate Number</span>
                      <PhoneRow codeKey="altPhoneCountryCode" numKey="alternatePhone" isOpen={openAltCode} setOpen={setOpenAltCode} placeholderText="Enter alternate number" />
                    </label>

                    <label style={{ ...LS, gridColumn: "1 / -1" }}>
                      <span>Personal Email <span style={{ color: "#ef4444" }}>*</span></span>
                      <input type="email" value={clientForm.personalEmail} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "personalEmail", e.target.value)} placeholder="Enter personal email" style={IS(clientFormErrors.personalEmail)} />
                      {ERR(clientFormErrors.personalEmail)}
                    </label>
                  </div>

                  {/* Personal Address Subcard */}
                  <div style={{ margin: "0 28px 18px", padding: "14px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Personal Address <span style={{ color: "#ef4444" }}>*</span></div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
                      <label style={LS}>
                        <span>Country <span style={{ color: "#ef4444" }}>*</span></span>
                        <CountrySelect countryKey="personalCountry" stateKey="personalState" isOpen={openPersonalCountry} setOpen={setOpenPersonalCountry} />
                        {ERR(clientFormErrors.personalCountry)}
                      </label>
                      <label style={LS}>
                        <span>Region / State / Province <span style={{ color: "#ef4444" }}>*</span></span>
                        <StateSelect countryKey="personalCountry" stateKey="personalState" isOpen={openPersonalState} setOpen={setOpenPersonalState} />
                        {ERR(clientFormErrors.personalState)}
                      </label>
                      <label style={LS}>
                        <span>City <span style={{ color: "#ef4444" }}>*</span></span>
                        <input type="text" value={clientForm.personalCity} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "personalCity", e.target.value)} placeholder="Enter city" style={IS(clientFormErrors.personalCity)} />
                        {ERR(clientFormErrors.personalCity)}
                      </label>
                      <label style={LS}>
                        <span>Postal Code <span style={{ color: "#ef4444" }}>*</span></span>
                        <input type="text" inputMode="numeric" value={clientForm.personalPostalCode} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "personalPostalCode", e.target.value)} placeholder="Enter postal code" maxLength={10} style={IS(clientFormErrors.personalPostalCode)} />
                        {ERR(clientFormErrors.personalPostalCode)}
                      </label>
                    </div>
                  </div>

                  {/* ══ "Have Company?" Checkbox Toggle ══ */}
                  <div style={{ margin: "0 28px 18px", padding: "14px 18px", background: clientForm.hasCompany ? "#f0fdf4" : "#f8fafc", borderRadius: "12px", border: clientForm.hasCompany ? "1.5px solid #86efac" : "1.5px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "all 0.2s ease" }}
                    onClick={() => updateFormField(setClientForm, setClientFormErrors, "hasCompany", !clientForm.hasCompany)}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input
                        type="checkbox"
                        checked={!!clientForm.hasCompany}
                        onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "hasCompany", e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: "18px", height: "18px", accentColor: "#16a34a", cursor: "pointer" }}
                      />
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Have Company?</div>
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>
                          {clientForm.hasCompany ? "Company details enabled. All company fields below are mandatory." : "Check this box if the client has registered business / company details."}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: clientForm.hasCompany ? "#16a34a" : "#64748b", background: clientForm.hasCompany ? "#dcfce7" : "#e2e8f0", padding: "3px 10px", borderRadius: "20px" }}>
                      {clientForm.hasCompany ? "Company Active" : "No Company"}
                    </span>
                  </div>

                  {/* ══ SECTION 2 : Company Details (Rendered ONLY when hasCompany is true) ══ */}
                  {clientForm.hasCompany && (
                    <div style={{ animation: "fadeIn 0.25s ease-in-out" }}>
                      <SH icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>} title="Company Details" sub="Business and company information (All fields mandatory)" />
                      
                      <div style={{ padding: "18px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
                        <label style={LS}>
                          <span>Company Name <span style={{ color: "#ef4444" }}>*</span></span>
                          <input type="text" value={clientForm.company} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "company", e.target.value)} placeholder="Enter company name" style={IS(clientFormErrors.company)} />
                          {ERR(clientFormErrors.company)}
                        </label>

                        <label style={LS}>
                          <span>Owned By <span style={{ color: "#ef4444" }}>*</span></span>
                          <input type="text" value={clientForm.ownedBy} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "ownedBy", e.target.value)} placeholder="Enter owner name" style={IS(clientFormErrors.ownedBy)} />
                          {ERR(clientFormErrors.ownedBy)}
                        </label>

                        {/* Business Identifier Selection */}
                        <label style={LS}>
                          <span>Business Identifier <span style={{ color: "#ef4444" }}>*</span></span>
                          <IdentifierSelect />
                        </label>

                        {/* Dynamic Registration / Tax Number */}
                        <label style={LS}>
                          <span>{currentIdentifierObj.code || "Registration"} Number <span style={{ color: "#ef4444" }}>*</span></span>
                          <input
                            type="text"
                            value={clientForm.registrationNo || clientForm.gstNo}
                            onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "registrationNo", e.target.value.toUpperCase())}
                            placeholder={currentIdentifierObj.placeholder || "Enter number"}
                            maxLength={currentIdentifierObj.maxLen || 30}
                            style={IS(clientFormErrors.registrationNo || clientFormErrors.gstNo)}
                          />
                          {ERR(clientFormErrors.registrationNo || clientFormErrors.gstNo)}
                          {isRegValid && !clientFormErrors.registrationNo && (
                            <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>
                              ✓ Valid {currentIdentifierObj.code || currentIdentifierObj.id} format
                            </span>
                          )}
                        </label>

                        <label style={LS}>
                          <span>Business Email <span style={{ color: "#ef4444" }}>*</span></span>
                          <input type="email" value={clientForm.businessEmail} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "businessEmail", e.target.value)} placeholder="Enter business email" style={IS(clientFormErrors.businessEmail)} />
                          {ERR(clientFormErrors.businessEmail)}
                        </label>

                        <label style={LS}>
                          <span>Contact Number <span style={{ color: "#ef4444" }}>*</span></span>
                          <PhoneRow codeKey="companyContactCode" numKey="companyContactNo" isOpen={openCompanyCode} setOpen={setOpenCompanyCode} placeholderText="Enter company contact number" />
                        </label>

                        <label style={LS}>
                          <span>Alternate Number <span style={{ color: "#ef4444" }}>*</span></span>
                          <PhoneRow codeKey="companyAltCode" numKey="companyAltNo" isOpen={openCompanyAltCode} setOpen={setOpenCompanyAltCode} placeholderText="Enter company alternate number" />
                        </label>
                      </div>

                      {/* Company Address Subcard */}
                      <div style={{ margin: "0 28px 18px", padding: "14px 16px", background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                          <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Company Address <span style={{ color: "#ef4444" }}>*</span></div>
                          {identCountryRestricted && (
                            <div style={{ fontSize: "11px", color: "#15803d", fontWeight: 600, background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "6px" }}>
                              Matches {currentIdentifierObj.code || currentIdentifierObj.id} ({identCountryRestricted})
                            </div>
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
                          <label style={LS}>
                            <span>Country <span style={{ color: "#ef4444" }}>*</span></span>
                            <CountrySelect countryKey="companyCountry" stateKey="companyState" isOpen={openCompanyCountry} setOpen={setOpenCompanyCountry} restrictedCountry={identCountryRestricted} />
                            {ERR(clientFormErrors.companyCountry)}
                          </label>
                          <label style={LS}>
                            <span>Region / State / Province <span style={{ color: "#ef4444" }}>*</span></span>
                            <StateSelect countryKey="companyCountry" stateKey="companyState" isOpen={openCompanyState} setOpen={setOpenCompanyState} />
                            {ERR(clientFormErrors.companyState)}
                          </label>
                          <label style={LS}>
                            <span>City <span style={{ color: "#ef4444" }}>*</span></span>
                            <input type="text" value={clientForm.companyCity} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "companyCity", e.target.value)} placeholder="Enter city" style={IS(clientFormErrors.companyCity)} />
                            {ERR(clientFormErrors.companyCity)}
                          </label>
                          <label style={LS}>
                            <span>Postal Code <span style={{ color: "#ef4444" }}>*</span></span>
                            <input type="text" inputMode="numeric" value={clientForm.companyPostalCode} onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "companyPostalCode", e.target.value)} placeholder="Enter postal code" maxLength={10} style={IS(clientFormErrors.companyPostalCode)} />
                            {ERR(clientFormErrors.companyPostalCode)}
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assignment & Notes */}
                  <div style={{ padding: "0 28px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
                    <label style={LS}>
                      <span>Dealer / Assigned To</span>
                      <div style={{ position: "relative" }}>
                        <div onClick={(e) => { e.stopPropagation(); const next = !showDealerDropdown; closeAllAddDropdowns(); setShowDealerDropdown(next); }}
                          style={{ height: "40px", borderRadius: "8px", border: clientFormErrors.assignedTo ? "1.5px solid #ef4444" : "1.5px solid #e2e8f0", padding: "0 12px", fontSize: "13px", color: clientForm.assignedTo ? "#0f172a" : "#94a3b8", background: "#fff", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", display: "flex", alignItems: "center", cursor: "pointer", justifyContent: "space-between", userSelect: "none" }}>
                          <span>{clientForm.assignedTo ? (() => { const emp = employees.find((e) => e._id === clientForm.assignedTo); return emp ? `${emp.firstName} ${emp.lastName}` : "Select dealer"; })() : "Select dealer"}</span>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        {showDealerDropdown && (
                          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, width: "100%", background: "#fff", zIndex: 300, border: "1px solid #e2e8f0", borderRadius: "10px", boxShadow: "0 12px 28px rgba(15,23,42,0.13)", padding: "6px" }}>
                            <input type="text" placeholder="Search dealers..." value={dealerSearchTerm} onChange={(e) => setDealerSearchTerm(e.target.value)} onClick={(e) => e.stopPropagation()}
                              style={{ width: "100%", border: "none", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", outline: "none", marginBottom: "6px", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", boxSizing: "border-box" }} />
                            <div style={{ maxHeight: "170px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1px" }}>
                              <div onClick={() => { updateFormField(setClientForm, setClientFormErrors, "assignedTo", ""); setShowDealerDropdown(false); setDealerSearchTerm(""); }}
                                style={{ padding: "8px 11px", fontSize: "12px", cursor: "pointer", borderRadius: "6px", background: !clientForm.assignedTo ? "#dcfce7" : "transparent", color: !clientForm.assignedTo ? "#16a34a" : "#334155", fontWeight: !clientForm.assignedTo ? 600 : 400 }}
                                onMouseEnter={e => { if (clientForm.assignedTo) e.currentTarget.style.background = "#f1f5f9"; }}
                                onMouseLeave={e => { if (clientForm.assignedTo) e.currentTarget.style.background = "transparent"; }}
                              >All Dealers</div>
                              {employees.filter(emp => ((emp.department && emp.department.toLowerCase().includes("sales")) || (emp.role && emp.role.name && emp.role.name.toLowerCase().includes("sales"))) && `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(dealerSearchTerm.toLowerCase()))
                                .map((emp) => (
                                  <div key={emp._id} onClick={() => { updateFormField(setClientForm, setClientFormErrors, "assignedTo", emp._id); setShowDealerDropdown(false); setDealerSearchTerm(""); }}
                                    style={{ padding: "8px 11px", fontSize: "12px", cursor: "pointer", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "space-between", background: clientForm.assignedTo === emp._id ? "#dcfce7" : "transparent", color: clientForm.assignedTo === emp._id ? "#16a34a" : "#334155", fontWeight: clientForm.assignedTo === emp._id ? 600 : 400 }}
                                    onMouseEnter={e => { if (clientForm.assignedTo !== emp._id) e.currentTarget.style.background = "#f1f5f9"; }}
                                    onMouseLeave={e => { if (clientForm.assignedTo !== emp._id) e.currentTarget.style.background = "transparent"; }}
                                  >{emp.firstName} {emp.lastName}{clientForm.assignedTo === emp._id && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}</div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </label>

                    <label style={LS}>
                      <span>Requirement / Notes</span>
                      <textarea
                        rows={3}
                        value={clientForm.requirement}
                        onChange={(e) => updateFormField(setClientForm, setClientFormErrors, "requirement", e.target.value)}
                        placeholder="Enter client requirement or notes..."
                        style={{ borderRadius: "8px", border: "1.5px solid #e2e8f0", padding: "10px 12px", fontSize: "13px", color: "#0f172a", resize: "vertical", fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", width: "100%", boxSizing: "border-box", outline: "none", lineHeight: 1.5 }}
                      />
                    </label>
                  </div>

                  {/* ── Footer ── */}
                  <div style={{ padding: "14px 28px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "10px", background: "#f8fafc" }}>
                    <button type="button" onClick={closeAddClientModal} className="clients-cancel-btn"
                      style={{ padding: "9px 18px", borderRadius: "8px", border: "1.5px solid #e2e8f0", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                      <span style={{ position: "relative", zIndex: 1 }}>Cancel</span>
                    </button>
                    <button type="submit" disabled={savingClient}
                      style={{ padding: "9px 22px", borderRadius: "8px", border: "none", background: "linear-gradient(135deg,#3b775e 0%,#56a07a 100%)", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: savingClient ? "not-allowed" : "pointer", opacity: savingClient ? 0.6 : 1, display: "flex", alignItems: "center", gap: "7px" }}>
                      {savingClient ? (<><svg style={{ animation: "spin 1s linear infinite" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>Saving...</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>Add Client</>)}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}


      {/* ── Enhanced View Client Modal (Complete Details & Projects) ── */}
      {showViewModal && viewingClient && (() => {
        // Find all projects associated with this client
        const clientProjects = projects.filter(p => {
          const clientName = (viewingClient.name || "").toLowerCase().trim();
          const companyName = (viewingClient.company || "").toLowerCase().trim();
          const pClient = (p.clientName || p.client || "").toLowerCase().trim();
          const pCompany = (p.company || "").toLowerCase().trim();
          return (clientName && pClient && (pClient.includes(clientName) || clientName.includes(pClient))) ||
                 (companyName && companyName !== "-" && pCompany && (pCompany.includes(companyName) || companyName.includes(pCompany))) ||
                 (p.clientId && String(p.clientId) === String(viewingClient.backendId));
        });

        const pAddr = viewingClient.personalAddress || viewingClient.raw?.personalAddress || {};
        const cAddr = viewingClient.companyAddress || viewingClient.raw?.companyAddress || {};
        
        const hasPersonalAddress = Boolean(pAddr.country || pAddr.state || pAddr.city || pAddr.postalCode);
        const hasCompanyAddress = Boolean(cAddr.country || cAddr.state || cAddr.city || cAddr.postalCode);
        
        const hasCompanyDetails = Boolean(
          (viewingClient.company && viewingClient.company !== "-" && viewingClient.company.trim()) ||
          (viewingClient.ownedBy && viewingClient.ownedBy !== "-" && viewingClient.ownedBy.trim()) ||
          (viewingClient.registrationNo && viewingClient.registrationNo !== "-" && viewingClient.registrationNo.trim()) ||
          (viewingClient.businessEmail && viewingClient.businessEmail !== "-" && viewingClient.businessEmail.trim()) ||
          (viewingClient.companyContactNo && viewingClient.companyContactNo !== "-" && viewingClient.companyContactNo.trim()) ||
          hasCompanyAddress
        );

        const SectionHeader = ({ icon, title, subtitle, badge }) => (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#3b775e 0%,#56a07a 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 4px 10px rgba(59,119,94,0.18)" }}>
                {icon}
              </div>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>{title}</div>
                {subtitle && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>{subtitle}</div>}
              </div>
            </div>
            {badge && (
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: badge === "Individual Client" ? "#64748b" : "#16a34a", background: badge === "Individual Client" ? "#f1f5f9" : "#dcfce7", padding: "4px 12px", borderRadius: "20px", border: badge === "Individual Client" ? "1px solid #e2e8f0" : "1px solid #bbf7d0" }}>
                {badge}
              </span>
            )}
          </div>
        );

        const InfoCard = ({ icon, label, value, isFullWidth, highlight }) => {
          const displayVal = (value && value !== "-" && value !== "—" && String(value).trim()) ? value : "—";
          const isFilled = displayVal !== "—";

          return (
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", gridColumn: isFullWidth ? "1 / -1" : "auto", background: isFilled ? "#ffffff" : "#fbfcfe", padding: "12px 14px", borderRadius: "10px", border: highlight ? "1.5px solid #86efac" : isFilled ? "1px solid #e2e8f0" : "1px dashed #e2e8f0", transition: "all 0.15s ease" }}>
              {icon && (
                <div style={{ width: 28, height: 28, borderRadius: 8, background: highlight ? "#dcfce7" : isFilled ? "#f1f5f9" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: highlight ? "#16a34a" : isFilled ? "#475569" : "#94a3b8", flexShrink: 0, marginTop: "1px" }}>
                  {icon}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden", flex: 1 }}>
                <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: isFilled ? "#0f172a" : "#94a3b8", wordBreak: "break-word" }}>
                  {displayVal}
                </span>
              </div>
            </div>
          );
        };

        return (
          <div onClick={() => { setShowViewModal(false); setViewingClient(null); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.58)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1300, padding: '24px' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '960px', background: '#fff', borderRadius: '22px', border: '1px solid #e2e8f0', boxShadow: '0 28px 56px rgba(15,23,42,0.24)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif" }}>
              
              {/* Header Banner */}
              <div style={{ padding: '22px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'linear-gradient(135deg, #3b775e 0%, #56a07a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 800, color: '#fff', flexShrink: 0, boxShadow: '0 8px 18px rgba(59,119,94,0.3)', border: '2px solid #fff' }}>
                    {(viewingClient.name || viewingClient.company || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>{viewingClient.name || '—'}</h2>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '16px', background: viewingClient.recordType === 'meta' ? '#eff6ff' : '#ecfdf5', color: viewingClient.recordType === 'meta' ? '#2563eb' : '#16a34a', border: viewingClient.recordType === 'meta' ? '1px solid #bfdbfe' : '1px solid #bbf7d0' }}>
                        {viewingClient.clientType || 'Client'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                      {viewingClient.company && viewingClient.company !== '-' && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#334155', fontWeight: 600 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                          {viewingClient.company}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Converted: {formatDate(viewingClient.convertedOn)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Dealer: <strong>{viewingClient.assignedTo || 'Unassigned'}</strong>
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setShowViewModal(false); setViewingClient(null); }}
                  style={{ width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, boxShadow: '0 2px 4px rgba(15,23,42,0.04)' }}>
                  ×
                </button>
              </div>

              {/* Scrollable Modal Content */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                
                {/* ══ SECTION 1 : Personal / Basic Details ══ */}
                <div>
                  <SectionHeader
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
                    title="Personal Details"
                    subtitle="Contact and personal information"
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                    <InfoCard
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/></svg>}
                      label="Full Name"
                      value={viewingClient.name}
                    />
                    <InfoCard
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                      label="Phone Number"
                      value={viewingClient.phone}
                    />
                    <InfoCard
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                      label="Alternate Phone"
                      value={viewingClient.alternatePhone || viewingClient.raw?.alternatePhone}
                    />
                    <InfoCard
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
                      label="Personal Email"
                      value={viewingClient.personalEmail || viewingClient.email || viewingClient.raw?.personalEmail}
                    />
                    <InfoCard
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>}
                      label="Lead Source"
                      value={viewingClient.source}
                    />
                    <InfoCard
                      icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>}
                      label="Added By"
                      value={viewingClient.addedBy || 'System'}
                    />

                    {/* Personal Address Subcard */}
                    {hasPersonalAddress && (
                      <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '2px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          Personal Address
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                          <InfoCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} label="Country" value={pAddr.country} />
                          <InfoCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>} label="Region / State" value={pAddr.state} />
                          <InfoCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} label="City" value={pAddr.city} />
                          <InfoCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>} label="Postal Code" value={pAddr.postalCode} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* ══ SECTION 2 : Company & Business Details ══ */}
                <div>
                  <SectionHeader
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
                    title="Company & Business Details"
                    subtitle="Registered business entity and tax identifier"
                    badge={hasCompanyDetails ? "Active Business" : "Individual Client"}
                  />
                  {hasCompanyDetails ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                      <InfoCard
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>}
                        label="Company Name"
                        value={viewingClient.company}
                      />
                      <InfoCard
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                        label="Owned By"
                        value={viewingClient.ownedBy || viewingClient.raw?.ownedBy}
                      />
                      <InfoCard
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>}
                        label={viewingClient.businessIdentifier ? `${viewingClient.businessIdentifier} Number` : "Registration Number"}
                        value={viewingClient.registrationNo || viewingClient.gstNo || viewingClient.raw?.registrationNo}
                        highlight={Boolean(viewingClient.registrationNo && viewingClient.registrationNo !== "-" || viewingClient.gstNo && viewingClient.gstNo !== "-")}
                      />
                      <InfoCard
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
                        label="Business Email"
                        value={viewingClient.businessEmail || viewingClient.raw?.businessEmail}
                      />
                      <InfoCard
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                        label="Company Contact"
                        value={viewingClient.companyContactNo || viewingClient.raw?.companyContactNo}
                      />
                      <InfoCard
                        icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>}
                        label="Company Alternate"
                        value={viewingClient.companyAltNo || viewingClient.raw?.companyAltNo}
                      />

                      {/* Company Registered Address Subcard */}
                      {hasCompanyAddress && (
                        <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '2px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            Company Registered Address
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                            <InfoCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>} label="Country" value={cAddr.country} />
                            <InfoCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>} label="Region / State" value={cAddr.state} />
                            <InfoCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} label="City" value={cAddr.city} />
                            <InfoCard icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>} label="Postal Code" value={cAddr.postalCode} />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#64748b', fontSize: '12.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                      No company details registered for this client record.
                    </div>
                  )}
                </div>

                {/* ══ SECTION 3 : Associated Projects & Deals ══ */}
                <div>
                  <SectionHeader
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>}
                    title={`Associated Projects (${clientProjects.length})`}
                    subtitle="Live projects and deals associated with this client"
                  />
                  {clientProjects.length > 0 ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                      {clientProjects.map((proj) => (
                        <div key={proj._id || proj.id} style={{ padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(15,23,42,0.03)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{proj.projectName || proj.name || 'Untitled Project'}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', background: proj.status === 'Completed' ? '#dcfce7' : proj.status === 'In Progress' ? '#dbeafe' : '#fef3c7', color: proj.status === 'Completed' ? '#16a34a' : proj.status === 'In Progress' ? '#2563eb' : '#d97706' }}>
                              {proj.status || 'Active'}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            {proj.projectType && <div>📂 <strong>Type:</strong> {proj.projectType}</div>}
                            {proj.dealValue ? <div>💰 <strong>Value:</strong> ₹{Number(proj.dealValue).toLocaleString('en-IN')}</div> : null}
                            {proj.deadline && <div style={{ gridColumn: '1 / -1' }}>⏱ <strong>Deadline:</strong> {formatDate(proj.deadline)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '16px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12.5px', color: '#64748b' }}>No active projects linked yet with this client name.</span>
                      {viewingClient.dealValue ? (
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#16a34a', background: '#dcfce7', padding: '4px 12px', borderRadius: '20px' }}>
                          Deal Value: ₹{Number(viewingClient.dealValue).toLocaleString('en-IN')}
                        </span>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* ══ Requirements / Notes ══ */}
                {viewingClient.requirement && viewingClient.requirement !== '-' && viewingClient.requirement !== '—' && (
                  <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      Requirement & Notes
                    </div>
                    <p style={{ fontSize: '12.5px', color: '#334155', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {viewingClient.requirement}
                    </p>
                  </div>
                )}

              </div>

              {/* Footer */}
              <div style={{ padding: '16px 32px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc', flexShrink: 0 }}>
                <button onClick={() => { setShowViewModal(false); setViewingClient(null); }}
                  style={{ padding: '10px 28px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#fff', color: '#334155', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter','Poppins','Segoe UI',sans-serif", boxShadow: '0 2px 4px rgba(15,23,42,0.04)' }}>
                  Close
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {showEditModal && editingClient && (
        <div
          onClick={closeEditClientModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "680px",
              background: "#fff",
              borderRadius: "18px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 20px 40px rgba(15,23,42,0.18)",
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "18px 22px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a" }}>Edit Client</div>
                <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>
                  {editingClient.recordType === "meta"
                    ? "Meta client core fields are read-only here. You can update notes."
                    : "Update client details and keep it in the converted list."}
                </div>
              </div>
              <button
                onClick={closeEditClientModal}
                style={{ background: "transparent", border: "none", fontSize: "24px", color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditClient}>
              <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "18px" }}>
                {[
                  { label: "Client Name", key: "name", required: true, placeholder: "Enter client name", type: "text" },
                  { label: "Company", key: "company", required: false, placeholder: "Enter company name", type: "text" },
                  { label: "Phone", key: "phone", required: false, placeholder: "Enter phone number", type: "tel" },
                  { label: "Email", key: "email", required: false, placeholder: "Enter email address", type: "email" },
                  { label: "Source", key: "source", required: false, placeholder: "Manual", type: "text" },
                ].map((field) => {
                  const isReadOnly = editingClient.recordType === "meta";
                  return (
                    <label key={field.key} style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                      <span>{field.label} {field.required && <span style={{ color: "#ef4444" }}>*</span>}</span>
                      <input
                        type={field.type}
                        required={field.required}
                        value={editForm[field.key]}
                        readOnly={isReadOnly}
                        onChange={(event) => updateFormField(setEditForm, setEditFormErrors, field.key, event.target.value)}
                        placeholder={field.placeholder}
                        aria-invalid={Boolean(editFormErrors[field.key])}
                        style={{
                          height: "42px",
                          borderRadius: "10px",
                          border: editFormErrors[field.key] ? "1px solid #ef4444" : "1px solid #e2e8f0",
                          padding: "0 14px",
                          fontSize: "13px",
                          color: isReadOnly ? "#64748b" : "#0f172a",
                          background: isReadOnly ? "#f8fafc" : "#fff",
                          fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                        }}
                      />
                      {editFormErrors[field.key] && (
                        <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>
                          {editFormErrors[field.key]}
                        </span>
                      )}
                    </label>
                  );
                })}

                <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                  Dealer
                  <div style={{ position: "relative" }}>
                    <div
                      onClick={() => setShowEditDealerDropdown(!showEditDealerDropdown)}
                      style={{
                        height: "42px",
                        borderRadius: "10px",
                        border: editFormErrors.assignedTo ? "1px solid #ef4444" : "1px solid #e2e8f0",
                        padding: "0 14px",
                        fontSize: "13px",
                        color: "#0f172a",
                        background: "#fff",
                        fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                        justifyContent: "space-between"
                      }}
                    >
                      <span>
                        {editForm.assignedTo
                          ? (() => {
                            const emp = employees.find((e) => e._id === editForm.assignedTo);
                            return emp ? `${emp.firstName} ${emp.lastName}` : "Select Dealer";
                          })()
                          : "Select Dealer"}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>

                    {showEditDealerDropdown && (
                      <div style={{ position: "absolute", top: "100%", left: 0, width: "100%", background: "#fff", zIndex: 100, border: "1px solid #e2e8f0", borderRadius: "10px", marginTop: "4px", boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)", padding: "6px" }}>
                        <div style={{ marginBottom: "6px" }}>
                          <input
                            type="text"
                            placeholder="Search dealers..."
                            value={dealerSearchTerm}
                            onChange={e => setDealerSearchTerm(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            style={{ width: "100%", border: "none", background: "#f8fafc", padding: "8px 12px", borderRadius: "8px", fontSize: "12px", outline: "none", fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif" }}
                          />
                        </div>
                        <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div
                            onClick={() => { updateFormField(setEditForm, setEditFormErrors, "assignedTo", ""); setShowEditDealerDropdown(false); setDealerSearchTerm(""); }}
                            style={{ padding: "8px 12px", fontSize: "12px", cursor: "pointer", background: !editForm.assignedTo ? "#dcfce7" : "transparent", color: !editForm.assignedTo ? "#16a34a" : "#334155", fontWeight: !editForm.assignedTo ? 600 : 500, borderRadius: "6px", transition: "all 0.2s" }}
                            onMouseEnter={e => { if (editForm.assignedTo) e.currentTarget.style.background = "#f1f5f9" }}
                            onMouseLeave={e => { if (editForm.assignedTo) e.currentTarget.style.background = "transparent" }}
                          >
                            All Dealers
                          </div>
                          {employees
                            .filter(emp =>
                              ((emp.department && emp.department.toLowerCase().includes('sales')) ||
                                (emp.role && emp.role.name && emp.role.name.toLowerCase().includes('sales'))) &&
                              (`${emp.firstName} ${emp.lastName}`.toLowerCase().includes(dealerSearchTerm.toLowerCase()))
                            )
                            .map((emp) => (
                              <div
                                key={emp._id}
                                onClick={() => { updateFormField(setEditForm, setEditFormErrors, "assignedTo", emp._id); setShowEditDealerDropdown(false); setDealerSearchTerm(""); }}
                                style={{ padding: "8px 12px", fontSize: "12px", cursor: "pointer", background: editForm.assignedTo === emp._id ? "#dcfce7" : "transparent", color: editForm.assignedTo === emp._id ? "#16a34a" : "#334155", fontWeight: editForm.assignedTo === emp._id ? 600 : 500, borderRadius: "6px", transition: "all 0.2s" }}
                                onMouseEnter={e => { if (editForm.assignedTo !== emp._id) e.currentTarget.style.background = "#f1f5f9" }}
                                onMouseLeave={e => { if (editForm.assignedTo !== emp._id) e.currentTarget.style.background = "transparent" }}
                              >
                                {emp.firstName} {emp.lastName}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </label>

                <label style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                  Requirement / Notes
                  <textarea
                    rows={5}
                    value={editForm.requirement}
                    onChange={(event) => updateFormField(setEditForm, setEditFormErrors, "requirement", event.target.value)}
                    placeholder="Describe the client requirement"
                    aria-invalid={Boolean(editFormErrors.requirement)}
                    style={{
                      borderRadius: "12px",
                      border: editFormErrors.requirement ? "1px solid #ef4444" : "1px solid #e2e8f0",
                      padding: "12px 14px",
                      fontSize: "13px",
                      color: "#0f172a",
                      resize: "vertical",
                      fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif",
                    }}
                  />
                  {editFormErrors.requirement && (
                    <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>
                      {editFormErrors.requirement}
                    </span>
                  )}
                </label>
              </div>

              <div style={{ padding: "16px 22px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={closeEditClientModal}
                  className="clients-cancel-btn"
                  style={{
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#475569",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ position: "relative", zIndex: 1 }}>Cancel</span>
                </button>
                <button
                  type="submit"
                  disabled={savingEditClient}
                  style={{
                    padding: "9px 14px",
                    borderRadius: "10px",
                    border: "none",
                    background: "linear-gradient(135deg, #3b775e 0%, #56a07a 100%)",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: savingEditClient ? "not-allowed" : "pointer",
                    opacity: savingEditClient ? 0.6 : 1,
                  }}
                >
                  {savingEditClient ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Projects Modal */}
      {selectedClientForProjects && (() => {
        const clientProjs = projects.filter(
          (p) =>
            (p.clientName && selectedClientForProjects.name && p.clientName.toLowerCase() === selectedClientForProjects.name.toLowerCase()) ||
            (p.clientEmail && selectedClientForProjects.email && p.clientEmail.toLowerCase() === selectedClientForProjects.email.toLowerCase()) ||
            (p.clientPhone && selectedClientForProjects.phone && p.clientPhone === selectedClientForProjects.phone)
        );

        return (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.4)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1300,
              padding: "20px",
              fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
            }}
            onClick={() => setSelectedClientForProjects(null)}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "16px",
                width: "100%",
                maxWidth: "800px",
                maxHeight: "85vh",
                minHeight: "300px",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                overflow: "hidden"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: "1px solid #f1f5f9",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                    Projects for {selectedClientForProjects.name}
                  </h2>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
                    {selectedClientForProjects.company}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedClientForProjects(null)}
                  style={{
                    border: "none",
                    background: "#f1f5f9",
                    borderRadius: "50%",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#64748b",
                    transition: "background 0.2s, color 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#0f172a"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div style={{ padding: "12px", overflowY: "auto", flex: 1, background: "#ffffff" }}>
                {clientProjs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "20px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 500, color: "#111827", marginBottom: "2px" }}>No projects found</div>
                    <div style={{ fontSize: "11px", color: "#6b7280" }}>This client doesn't have any active or past projects yet.</div>
                  </div>
                ) : (
                  <div style={{ background: "#ffffff", borderRadius: "4px", border: "1px solid #e2e8f0", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "6px 10px", color: "#475569", fontSize: "10px", fontWeight: 600, borderBottom: "1px solid #e2e8f0", width: "30px" }}>#</th>
                          <th style={{ padding: "6px 10px", color: "#475569", fontSize: "10px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Project ID</th>
                          <th style={{ padding: "6px 10px", color: "#475569", fontSize: "10px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Project Name</th>
                          <th style={{ padding: "6px 10px", color: "#475569", fontSize: "10px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Project Value</th>
                          <th style={{ padding: "6px 10px", color: "#475569", fontSize: "10px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Deadline</th>
                          <th style={{ padding: "6px 10px", color: "#475569", fontSize: "10px", fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientProjs.map((proj, index) => (
                          <tr key={proj._id}
                            onClick={() => setSelectedProjectForAssignment(proj)}
                            style={{ borderBottom: index === clientProjs.length - 1 ? 'none' : '1px solid #f1f5f9', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                          >
                            <td style={{ padding: "6px 10px", verticalAlign: "middle", width: "30px" }}>
                              <div style={{ fontSize: "11px", fontWeight: 600, color: "#94a3b8" }}>{String(index + 1).padStart(2, '0')}</div>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle" }}>
                              <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>{proj.projectId || '-'}</div>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle" }}>
                              <div style={{ fontSize: "11px", fontWeight: 500, color: "#1e293b" }}>{proj.name}</div>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle" }}>
                              <div style={{ fontSize: "11px", fontWeight: 500, color: "#1e293b" }}>
                                {proj.projectValue ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: proj.currency || 'INR', maximumFractionDigits: 0 }).format(proj.projectValue) : '-'}
                              </div>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle" }}>
                              <div style={{ fontSize: "11px", fontWeight: 500, color: "#1e293b" }}>
                                {proj.deadline ? new Date(proj.deadline).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                              </div>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle" }}>
                              {(() => {
                                const st = (proj.status || '').toLowerCase();
                                let colors = { bg: '#f3f4f6', border: '#e5e7eb', text: '#4b5563' }; // default grey

                                if (st === 'completed') colors = { bg: '#dcfce7', border: '#bbf7d0', text: '#16a34a' }; // green
                                else if (st === 'cancelled') colors = { bg: '#fee2e2', border: '#fecaca', text: '#dc2626' }; // red
                                else if (st === 'on-hold' || st === 'on hold') colors = { bg: '#fef9c3', border: '#fef08a', text: '#ca8a04' }; // yellow
                                else if (st === 'progress' || st === 'active') colors = { bg: '#dbeafe', border: '#bfdbfe', text: '#2563eb' }; // blue

                                return (
                                  <div style={{
                                    display: "inline-flex", alignItems: "center", gap: "4px",
                                    background: colors.bg, padding: "2px 6px", borderRadius: "4px", border: `1px solid ${colors.border}`
                                  }}>
                                    <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: colors.text }} />
                                    <span style={{ fontSize: "9px", color: colors.text, fontWeight: 600, letterSpacing: "0.2px", textTransform: "uppercase" }}>
                                      {st === 'active' ? 'PROGRESS' : (proj.status || 'PROGRESS')}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {/* Assignment Details Modal */}
      {selectedProjectForAssignment && (() => {
        // Find assigned employees full objects based on assignedEmployees array
        const assignedEmployeesInfo = selectedProjectForAssignment.assignedEmployees
          ? employees.filter(emp => selectedProjectForAssignment.assignedEmployees.some(
            assigned => (typeof assigned === 'object' && assigned._id ? assigned._id : assigned) === emp._id
          ))
          : [];

        return (
          <div
            style={{
              position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
              background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 1400, padding: "20px", fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
            }}
            onClick={() => setSelectedProjectForAssignment(null)}
          >
            <div
              style={{
                background: "#fff", borderRadius: "8px", width: "100%", maxWidth: "540px", maxHeight: "85vh",
                display: "flex", flexDirection: "column", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                overflow: "hidden"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827", letterSpacing: "-0.5px" }}>Working Details</h2>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>{selectedProjectForAssignment.name}</p>
                </div>
                <button
                  onClick={() => setSelectedProjectForAssignment(null)}
                  style={{
                    border: "none", background: "#f3f4f6", borderRadius: "50%", width: "28px", height: "28px",
                    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b7280",
                    transition: "background 0.2s, color 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#e5e7eb"; e.currentTarget.style.color = "#111827"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#6b7280"; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div style={{ padding: "0 16px 16px", overflowY: "auto", flex: 1, background: "#ffffff" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ background: "#ffffff", borderRadius: "6px", padding: "12px 16px", border: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Assigned Employees</div>
                    {assignedEmployeesInfo.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {assignedEmployeesInfo.map((emp, index) => {
                          const assignmentDate = selectedProjectForAssignment.employeeAssignmentDates?.[emp._id];
                          return (
                            <div key={emp._id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: index === assignedEmployeesInfo.length - 1 ? 'none' : '1px solid #f3f4f6' }}>
                              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 600, color: "#475569" }}>
                                {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                              </div>
                              <div>
                                <div style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{emp.firstName} {emp.lastName}</div>
                                <div style={{ fontSize: "11px", color: "#6b7280" }}>{emp.designation || emp.role?.name || 'Employee'}</div>
                              </div>
                              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                                <div style={{ fontSize: "9px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Assigned On</div>
                                <div style={{ fontSize: "11px", color: "#4b5563", fontWeight: 500 }}>
                                  {assignmentDate ? new Date(assignmentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ fontSize: "12px", color: "#6b7280", fontStyle: "italic" }}>No employees assigned yet.</div>
                    )}
                  </div>

                  <div
                    onClick={() => setShowRequirementModal(true)}
                    style={{
                      background: "#ffffff", borderRadius: "6px", padding: "12px 16px", border: "1px solid #e5e7eb",
                      cursor: "pointer", transition: "all 0.2s"
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.boxShadow = "0 2px 4px rgba(0,0,0,0.02)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Project Requirement / Notes</div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                      </svg>
                    </div>
                    <div style={{ fontSize: "13px", color: "#374151", lineHeight: 1.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedProjectForAssignment.description || selectedProjectForAssignment.requirement || "No notes available."}
                    </div>
                  </div>

                  <div style={{ background: "#ffffff", borderRadius: "6px", padding: "12px 16px", border: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Start Date</div>
                      <div style={{ fontSize: "13px", color: "#111827", fontWeight: 500 }}>{selectedProjectForAssignment.startDate ? new Date(selectedProjectForAssignment.startDate).toLocaleDateString('en-IN') : 'N/A'}</div>
                    </div>

                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 30px" }}>
                      <style>
                        {`
                          @keyframes pulseRight {
                            0% { transform: translateX(-4px); opacity: 0.5; }
                            50% { transform: translateX(4px); opacity: 1; }
                            100% { transform: translateX(-4px); opacity: 0.5; }
                          }
                        `}
                      </style>
                      <div style={{ flex: 1, height: "1px", background: "linear-gradient(90deg, transparent, #e2e8f0, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg
                          style={{ animation: "pulseRight 2s infinite ease-in-out", color: "#94a3b8", background: "#fff", padding: "0 8px" }}
                          width="30" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                          <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Deadline</div>
                      <div style={{ fontSize: "13px", color: "#111827", fontWeight: 500 }}>{selectedProjectForAssignment.deadline ? new Date(selectedProjectForAssignment.deadline).toLocaleDateString('en-IN') : 'N/A'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* Requirement Full Text Modal */}
      {showRequirementModal && selectedProjectForAssignment && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1500, padding: "20px", fontFamily: "'Inter', 'Poppins', 'Segoe UI', sans-serif"
          }}
          onClick={() => setShowRequirementModal(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: "8px", width: "100%", maxWidth: "600px", maxHeight: "85vh",
              display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc" }}>
              <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#0f172a" }}>Project Requirement</h2>
              <button
                onClick={() => setShowRequirementModal(false)}
                style={{
                  border: "none", background: "transparent", width: "28px", height: "28px",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748b",
                  borderRadius: "4px"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#e2e8f0"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div style={{ padding: "24px", overflowY: "auto", fontSize: "14px", color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {selectedProjectForAssignment.description || selectedProjectForAssignment.requirement || "No notes available."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clients;
