import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { ROUTES, buildSemanticUrl } from "../utils/routeUtils";
import "./Navbar.css";
import {
  LayoutDashboard, Calendar, Megaphone,
  Briefcase, Target, Package, Umbrella,
  Clock, UserCog, Users, FolderOpen,
  FileText, Shield, Wallet,
  Fingerprint, Landmark, Settings, Building2,
  LogOut, User, Menu, X, Handshake, Mail, TrendingUp, Activity, Bell, GitBranch,
  ChevronsLeft, ChevronsRight, Store
} from "lucide-react";

function Navbar() {
  const { user, logout, hasPermission, unreadNotificationsCount, notifications } = useAuth();
  const unreadTaskNotificationsCount = notifications?.filter(n => !n.isRead && n.type === 'Task').length || 0;
  const unreadAnnouncementNotificationsCount = notifications?.filter(n => !n.isRead && n.type === 'Announcement').length || 0;
  const unreadAssignmentNotificationsCount = notifications?.filter(n => !n.isRead && n.type === 'Project').length || 0;
  const unreadLeaveNotificationsCount = notifications?.filter(n => !n.isRead && n.type === 'Leave').length || 0;
  const unreadClientNotificationsCount = notifications?.filter(n => !n.isRead && n.type === 'Client').length || 0;
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [unviewedBroadcasts, setUnviewedBroadcasts] = useState(0);

  const isRouteActive = (canonicalPath, legacyPaths = []) => {
    if (location.pathname === canonicalPath) return "nav-item-active";
    if (canonicalPath === ROUTES.DASHBOARD.OVERVIEW && (location.pathname === "/" || location.pathname === "/dashboard" || location.pathname.startsWith("/dashboard"))) {
      return "nav-item-active";
    }
    if (canonicalPath !== "/" && canonicalPath !== ROUTES.DASHBOARD.OVERVIEW && location.pathname.startsWith(canonicalPath)) {
      return "nav-item-active";
    }
    if (legacyPaths.some((lp) => location.pathname === lp || (lp !== "/" && location.pathname.startsWith(lp)))) {
      return "nav-item-active";
    }
    return "";
  };

  const isAdmin = user?.role?.name === 'Admin';

  // Sync body class so all page containers adjust their margin
  useEffect(() => {
    if (sidebarExpanded) {
      document.body.classList.add("sidebar-expanded");
    } else {
      document.body.classList.remove("sidebar-expanded");
    }
    return () => document.body.classList.remove("sidebar-expanded");
  }, [sidebarExpanded]);

  useEffect(() => {
    fetchUnviewedCounts();
    const interval = setInterval(fetchUnviewedCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUnviewedCounts = async () => {
    try {
      const broadcastsRes = await api.get("/broadcasts/unviewed/count");
      setUnviewedBroadcasts(broadcastsRes.data.count);
    } catch (error) {
      console.error("Error fetching unviewed counts:", error);
    }
  };

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  const recruitmentLinks = [
    {
      to: buildSemanticUrl(ROUTES.RECRUITMENT.DASHBOARD),
      rawPath: ROUTES.RECRUITMENT.DASHBOARD,
      label: "Dashboard",
      icon: <LayoutDashboard size={15} />,
      activePaths: [ROUTES.RECRUITMENT.DASHBOARD, "/recruitment/dashboard"]
    },
    {
      to: buildSemanticUrl(ROUTES.RECRUITMENT.JOBS),
      rawPath: ROUTES.RECRUITMENT.JOBS,
      label: "Job Listings",
      icon: <Briefcase size={15} />,
      activePaths: [ROUTES.RECRUITMENT.JOBS, ROUTES.RECRUITMENT.CREATE_JOB, "/recruitment/jobs", "/recruitment/add-job", "/recruitment/create-job"]
    },
    {
      to: buildSemanticUrl(ROUTES.RECRUITMENT.APPLICATIONS),
      rawPath: ROUTES.RECRUITMENT.APPLICATIONS,
      label: "Job Applications",
      icon: <Users size={15} />,
      activePaths: [ROUTES.RECRUITMENT.APPLICATIONS, "/recruitment/job-applications", "/recruitment/pipeline"]
    },
    {
      to: buildSemanticUrl(ROUTES.RECRUITMENT.INTERVIEWS),
      rawPath: ROUTES.RECRUITMENT.INTERVIEWS,
      label: "Interview Schedule",
      icon: <Calendar size={15} />,
      activePaths: [ROUTES.RECRUITMENT.INTERVIEWS, "/recruitment/interview-schedule", "/recruitment/schedule-interview"]
    },
    {
      to: buildSemanticUrl(ROUTES.RECRUITMENT.CANDIDATES),
      rawPath: ROUTES.RECRUITMENT.CANDIDATES,
      label: "Candidate Database",
      icon: <UserCog size={15} />,
      activePaths: [ROUTES.RECRUITMENT.CANDIDATES, "/recruitment/candidate-database", "/recruitment/add-candidate"]
    },
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="mobile-header">
        <h2>HRMS</h2>
        <button className="hamburger" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <div
        className={`mobile-overlay ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(false)}
      />

      <nav className={`navbar ${sidebarExpanded ? "expanded" : ""} ${isOpen ? "open" : ""}`}>
        <div className="navbar-container">

          {/* Logo + desktop toggle */}
          <div className="navbar-brand">
            <Link to={buildSemanticUrl(ROUTES.DASHBOARD.OVERVIEW)} onClick={handleLinkClick} className="brand-link">
              <div
                className="brand-text-icon"
                onClick={(e) => { e.preventDefault(); if (!sidebarExpanded) setSidebarExpanded(true); }}
                title={!sidebarExpanded ? "Expand sidebar" : undefined}
                style={!sidebarExpanded ? { cursor: 'pointer' } : {}}
              >
                <img src="/favicon.webp" alt="Bhoomi Techzone" className="brand-logo-image" />
              </div>
              <span className="brand-text-full">
                <span className="brand-text-main">Bhoomi</span>
                <span className="brand-text-sub">Techzone</span>
              </span>
            </Link>
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarExpanded((e) => !e)}
              title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarExpanded ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
            </button>
          </div>

          {/* Nav Items */}
          <div className="navbar-menu">

            <Link
              to={buildSemanticUrl(ROUTES.DASHBOARD.OVERVIEW)}
              onClick={handleLinkClick}
              className={`nav-item ${isRouteActive(ROUTES.DASHBOARD.OVERVIEW, ["/"])}`}
              title="Dashboard"
            >
              <LayoutDashboard size={20} /><span className="nav-label">Dashboard</span>
            </Link>

            {hasPermission('calendar', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.OPERATIONS.CALENDAR)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.OPERATIONS.CALENDAR, ["/calendar"])}`}
                title="Calendar"
              >
                <Calendar size={20} /><span className="nav-label">Calendar</span>
              </Link>
            )}

            {hasPermission('broadcasts', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.OPERATIONS.BROADCASTS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.OPERATIONS.BROADCASTS, ["/broadcasts"])}`}
                title="Broadcasts"
              >
                <Megaphone size={20} />
                {unreadAnnouncementNotificationsCount > 0 && <span className="nav-badge">{unreadAnnouncementNotificationsCount}</span>}
                <span className="nav-label">Announcement</span>
              </Link>
            )}

            {hasPermission('assignments', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.ASSIGNMENTS.OVERVIEW)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.ASSIGNMENTS.OVERVIEW, ["/assignments"])}`}
                title="Assignments"
              >
                <Briefcase size={20} />
                {unreadAssignmentNotificationsCount > 0 && <span className="nav-badge">{unreadAssignmentNotificationsCount}</span>}
                <span className="nav-label">Assignments</span>
              </Link>
            )}

            {hasPermission('clients', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.CRM.CLIENTS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.CRM.CLIENTS, ["/clients"])}`}
                title="Clients"
              >
                <Handshake size={20} />
                {unreadClientNotificationsCount > 0 && <span className="nav-badge">{unreadClientNotificationsCount}</span>}
                <span className="nav-label">Clients</span>
              </Link>
            )}

            {hasPermission('projects', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.PROJECTS.OVERVIEW)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.PROJECTS.OVERVIEW, ["/projects"])}`}
                title="Projects"
              >
                <Package size={20} /><span className="nav-label">Projects</span>
              </Link>
            )}

            {hasPermission('deals', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.CRM.DEALS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.CRM.DEALS, ["/deals"])}`}
                title="Deals"
              >
                <TrendingUp size={20} /><span className="nav-label">Deals</span>
              </Link>
            )}

            {hasPermission('pipeline', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.CRM.PIPELINE)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.CRM.PIPELINE, ["/pipeline"])}`}
                title="Pipeline"
              >
                <GitBranch size={20} /><span className="nav-label">Pipeline</span>
              </Link>
            )}

            {hasPermission('accounts', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.FINANCE.PAYMENTS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.FINANCE.PAYMENTS, ["/client-payments"])}`}
                title="Client Payments"
              >
                <Wallet size={20} /><span className="nav-label">Accounts</span>
              </Link>
            )}

            {hasPermission('proposals', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.DOCUMENTS.PROPOSALS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.DOCUMENTS.PROPOSALS, ["/proposals"])}`}
                title="Proposals"
              >
                <FileText size={20} /><span className="nav-label">Proposals</span>
              </Link>
            )}

            {hasPermission('letters', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.DOCUMENTS.LETTERS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.DOCUMENTS.LETTERS, ["/letters"])}`}
                title="Letters"
              >
                <Mail size={20} /><span className="nav-label">Letters</span>
              </Link>
            )}

            {hasPermission('goals', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.TASKS.GOALS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.TASKS.GOALS, ["/goals"])}`}
                title="Goals"
              >
                <Target size={20} />
                {unreadTaskNotificationsCount > 0 && <span className="nav-badge">{unreadTaskNotificationsCount}</span>}
                <span className="nav-label">Tasks</span>
              </Link>
            )}

            {hasPermission('assets', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.OPERATIONS.ASSETS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.OPERATIONS.ASSETS, ["/assets"])}`}
                title="Assets"
              >
                <Package size={20} /><span className="nav-label">Assets</span>
              </Link>
            )}

            {hasPermission('vendor-management', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.OPERATIONS.VENDOR_MANAGEMENT)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.OPERATIONS.VENDOR_MANAGEMENT, ["/vendor-management", "/vendors", "/operations/vendor-management"])}`}
                title="Vendors"
              >
                <Store size={20} /><span className="nav-label">Vendors</span>
              </Link>
            )}

            {hasPermission('leaves', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.WORKFORCE.LEAVES)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.WORKFORCE.LEAVES, ["/leaves"])}`}
                title="Leaves"
              >
                <Umbrella size={20} />
                {unreadLeaveNotificationsCount > 0 && <span className="nav-badge">{unreadLeaveNotificationsCount}</span>}
                <span className="nav-label">Leaves</span>
              </Link>
            )}

            {hasPermission('attendance', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.WORKFORCE.ATTENDANCE)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.WORKFORCE.ATTENDANCE, ["/attendance"])}`}
                title="Attendance"
              >
                <Clock size={20} /><span className="nav-label">Attendance</span>
              </Link>
            )}

            {hasPermission('activities', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.OPERATIONS.ACTIVITIES)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.OPERATIONS.ACTIVITIES, ["/activities"])}`}
                title="Activities"
              >
                <Activity size={20} /><span className="nav-label">Activities</span>
              </Link>
            )}

            {(hasPermission('leads', 'read') || hasPermission('leads', 'create')) && (
              <Link
                to={buildSemanticUrl(ROUTES.CRM.LEADS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.CRM.LEADS, ["/leads"])}`}
                title="My Leads"
              >
                <UserCog size={20} /><span className="nav-label">Leads</span>
              </Link>
            )}

            {hasPermission('employees', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.WORKFORCE.EMPLOYEES)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.WORKFORCE.EMPLOYEES, ["/employees"])}`}
                title="Employees"
              >
                <Users size={20} /><span className="nav-label">Employees</span>
              </Link>
            )}

            {hasPermission('documents', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.DOCUMENTS.REPOSITORY)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.DOCUMENTS.REPOSITORY, ["/documents"])}`}
                title="Documents"
              >
                <FolderOpen size={20} /><span className="nav-label">Documents</span>
              </Link>
            )}

            {hasPermission('my-documents', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.DOCUMENTS.PERSONAL)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.DOCUMENTS.PERSONAL, ["/my-documents"])}`}
                title="My Documents"
              >
                <FileText size={20} /><span className="nav-label">My Documents</span>
              </Link>
            )}

            {hasPermission('roles', 'read') && (
              <Link
                to={buildSemanticUrl(ROUTES.WORKFORCE.ROLES)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.WORKFORCE.ROLES, ["/roles"])}`}
                title="Roles"
              >
                <Shield size={20} /><span className="nav-label">User & Roles</span>
              </Link>
            )}

            {hasPermission("payroll", "read") && (
              <Link
                to={buildSemanticUrl(ROUTES.FINANCE.PAYROLL)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.FINANCE.PAYROLL, ["/payroll"])}`}
                title="Payroll"
              >
                <Wallet size={20} /><span className="nav-label">Payroll</span>
              </Link>
            )}

            {hasPermission("biometric-logs", "read") && (
              <Link
                to={buildSemanticUrl(ROUTES.WORKFORCE.BIOMETRIC_LOGS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.WORKFORCE.BIOMETRIC_LOGS, ["/biometric-attendance"])}`}
                title="Biometric"
              >
                <Fingerprint size={20} /><span className="nav-label">Biometric Logs</span>
              </Link>
            )}

            {hasPermission("my-payslips", "read") && (
              <Link
                to={buildSemanticUrl(ROUTES.FINANCE.MY_PAYSLIPS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.FINANCE.MY_PAYSLIPS, ["/finance", "/my-payroll"])}`}
                title="Finance"
              >
                <Landmark size={20} /><span className="nav-label">Finance</span>
              </Link>
            )}

            {isAdmin && (
              <Link
                to={buildSemanticUrl(ROUTES.SYSTEM.SETTINGS)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.SYSTEM.SETTINGS, ["/settings"])}`}
                title="Settings"
              >
                <Settings size={20} /><span className="nav-label">Settings</span>
              </Link>
            )}

            {/* Recruitment Section */}
            {hasPermission('recruitment', 'read') && (
              <div className="recruit-section">
                <div className="recruit-section-label" title="Recruit">
                  <Building2 size={15} />
                  <span className="nav-label">Recruitment</span>
                </div>
                {recruitmentLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={handleLinkClick}
                    className={`nav-item recruit-nav-item ${link.activePaths.some(p => location.pathname === p || location.pathname.startsWith(p)) ? "nav-item-active" : ""}`}
                    title={link.label}
                  >
                    {link.icon}
                    <span className="nav-label">{link.label}</span>
                  </Link>
                ))}
              </div>
            )}

            <Link
              to={buildSemanticUrl(ROUTES.SYSTEM.NOTIFICATIONS)}
              onClick={handleLinkClick}
              className={`nav-item ${isRouteActive(ROUTES.SYSTEM.NOTIFICATIONS, ["/notifications"])}`}
              title="Notifications"
            >
              <Bell size={20} />
              {unreadNotificationsCount > 0 && <span className="nav-badge">{unreadNotificationsCount}</span>}
              <span className="nav-label">Notifications</span>
            </Link>

            {!isAdmin && (
              <Link
                to={buildSemanticUrl(ROUTES.SYSTEM.PROFILE)}
                onClick={handleLinkClick}
                className={`nav-item ${isRouteActive(ROUTES.SYSTEM.PROFILE, ["/profile"])}`}
                title="Profile"
              >
                <User size={20} />
                <span className="nav-label">Profile</span>
              </Link>
            )}
          </div>

          {/* User / Logout */}
          <div className="navbar-user">
            {!isAdmin && (
              <Link
                to={buildSemanticUrl(ROUTES.SYSTEM.PROFILE)}
                onClick={handleLinkClick}
                className="nav-item nav-user-avatar"
                title={`${user?.firstName || ""} ${user?.lastName || ""}`}
              >
                <User size={20} />
                <span className="nav-label">{user?.firstName} {user?.lastName}</span>
              </Link>
            )}
            <div className="nav-role-badge">{user?.role?.name}</div>
            <button onClick={() => { logout(); setIsOpen(false); }} className="nav-item nav-logout" title="Logout">
              <LogOut size={20} />
              <span className="nav-label">Logout</span>
            </button>
          </div>

        </div>
      </nav>
    </>
  );
}

export default Navbar;
