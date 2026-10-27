import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from "react-router-dom";
import Assets from "./components/Assets";
import Attendance from "./components/Attendance";
import Broadcasts from "./components/Broadcasts";
import Dashboard from "./components/Dashboard";
import AdminDashboard from "./components/AdminDashboard";
import HRDashboard from "./components/HRDashboard";
import MarketingDashboard from "./components/MarketingDashboard";
import SalesDashboard from "./components/SalesDashboard";
import Employees from "./components/Employees";
import Goals from "./components/Goals";
import MyCalendar from "./components/MyCalendar";
import Leaves from "./components/Leaves";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import Payroll from "./components/Payroll";
import MyPayslip from "./components/MyPayslip";
import Profile from "./components/Profile";
import UserProfile from "./components/UserProfile";
import Projects from "./components/Projects";
import Assignments from "./components/Assignments";
import Clients from "./components/Clients";
import Notifications from "./components/Notifications";
import Toast from "./components/Toast";
import Deals from "./components/Deals";
import Pipeline from "./components/Pipeline";
import ClientPayments from "./components/ClientPayments";
import Roles from "./components/Roles";
import RecruitmentDashboard from "./components/RecruitmentDashboard";
import JobsList from "./components/JobsList";
import PostJob from "./components/AddJob";
import AddCandidate from "./components/AddCandidate";
import ScheduleInterview from "./components/ScheduleInterview";
import RecruitmentPipeline from "./components/RecruitmentPipeline";
import CareersApply from "./components/CareersApply";
import CareersPortal from "./components/CareersPortal";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Devices from "./components/biometric/Devices";
import BiometricAttendance from "./components/biometric/Attendance";
import Documents from "./components/Documents";
import MyDocuments from "./components/MyDocuments";
import DocumentGenerator from "./components/DocumentGenerator";
import Proposals from "./components/Proposals";
import Templates from "./components/Templates";
import Letters from "./components/Letters";
import Settings from "./components/Settings";
import MyLeads from "./components/MyLeads";
import MarketingLeads from "./components/MarketingLeads";
import Activities from "./components/Activities";
import VendorManagement from "./components/VendorManagement";
import { ROUTES } from "./utils/routeUtils";

// Wrapper component to show correct leads page based on role
function LeadsWrapper() {
  const { user, hasPermission } = useAuth();
  const roleName = (user?.role?.name || user?.role || '').toString().toLowerCase().trim();
  const designation = (user?.designation || '').toString().toLowerCase().trim();
  const department = (user?.department || '').toString().toLowerCase().trim();
  const isMarketing = roleName.includes('marketing');
  const isSalesOrLeadUser =
    roleName.includes('sales') ||
    roleName.includes('executive') ||
    roleName.includes('telecaller') ||
    roleName.includes('bde') ||
    roleName.includes('admin') ||
    roleName.includes('director') ||
    designation.includes('sales') ||
    designation.includes('telecaller') ||
    designation.includes('bde') ||
    department.includes('sales');

  const canRead = hasPermission('leads', 'read') || isSalesOrLeadUser;

  // Marketing role sees Marketing Leads page
  if (isMarketing) {
    return <MarketingLeads />;
  }

  // All other roles with READ permission see My Leads page
  if (canRead) {
    return <MyLeads />;
  }

  // No permission - redirect to dashboard
  return <Navigate to={ROUTES.DASHBOARD.OVERVIEW} replace />;
}

// Render dynamic dashboard according to active role
function DynamicDashboard() {
  const { user } = useAuth();
  const roleName = user?.role?.name?.toLowerCase().trim() || '';

  if (roleName === 'admin' || user?.role?.name === 'Admin') return <AdminDashboard />;
  if (roleName === 'sales head' || roleName === 'saleshead' || roleName === 'head of sales' || roleName === 'sales') return <SalesDashboard />;
  if (roleName.includes('marketing')) return <MarketingDashboard />;
  if (roleName === 'hr' || user?.role?.name === 'HR') return <HRDashboard />;
  return <Dashboard />;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f4f7f0", padding: "20px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ height: 58, background: "#ffffff", borderRadius: 12, border: "1px solid #eef2f3", marginBottom: 14 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{ height: 110, background: "#ffffff", borderRadius: 12, border: "1px solid #eef2f3" }} />
            ))}
          </div>
          <div style={{ height: 340, background: "#ffffff", borderRadius: 12, border: "1px solid #eef2f3", marginBottom: 14 }} />
          <div style={{ height: 240, background: "#ffffff", borderRadius: 12, border: "1px solid #eef2f3" }} />
        </div>
      </div>
    );
  }
  return user ? children : <Navigate to={ROUTES.AUTH.LOGIN} />;
}

// Redirects to Dashboard if user doesn't have read permission for given module
function PermissionRoute({ module, adminOnly, children }) {
  const { user, hasPermission } = useAuth();
  if (!user) return <Navigate to={ROUTES.AUTH.LOGIN} />;
  if (adminOnly) {
    if (user?.role?.name !== 'Admin') return <Navigate to={ROUTES.DASHBOARD.OVERVIEW} />;
    return children;
  }
  const hasRead = hasPermission(module, 'read');
  if (!hasRead) return <Navigate to={ROUTES.DASHBOARD.OVERVIEW} />;
  return children;
}

function AppContent() {
  const { user, activeToast, setActiveToast } = useAuth();
  const location = useLocation();
  const isCareersPage = location.pathname.startsWith('/careers');

  return (
    <>
      {user && !isCareersPage && <Navbar />}
      <Toast notification={activeToast} onClose={() => setActiveToast(null)} />
      <Routes>
        {/* Authentication */}
        <Route path="/login" element={user ? <Navigate to={ROUTES.DASHBOARD.OVERVIEW} replace /> : <Login />} />

        {/* Public Careers & Job Application Portal (No Login Required) */}
        <Route path="/careers" element={<CareersPortal />} />
        <Route path="/careers/jobs" element={<CareersPortal />} />
        <Route path="/careers/jobs/:id" element={<CareersPortal />} />
        <Route path="/careers/portal" element={<CareersPortal />} />
        <Route path="/careers/apply" element={<CareersApply />} />
        <Route path="/careers/jobs/:id/apply" element={<CareersApply />} />

        {/* Root Redirect to Canonical Semantic Dashboard */}
        <Route
          path="/"
          element={
            <PrivateRoute>
              <DynamicDashboard />
            </PrivateRoute>
          }
        />

        {/* ==================================================================== */}
        {/* CANONICAL HIERARCHICAL SEMANTIC RESTFUL ROUTES                      */}
        {/* ==================================================================== */}

        {/* Dashboards */}
        <Route
          path="/dashboard/analytics/overview"
          element={
            <PrivateRoute>
              <DynamicDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/admin/overview"
          element={
            <PermissionRoute adminOnly>
              <AdminDashboard />
            </PermissionRoute>
          }
        />
        <Route
          path="/dashboard/sales/overview"
          element={
            <PrivateRoute>
              <SalesDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/marketing/overview"
          element={
            <PrivateRoute>
              <MarketingDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/hr/overview"
          element={
            <PrivateRoute>
              <HRDashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/dashboard/employee/overview"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        {/* Recruitment */}
        <Route
          path="/recruitment/dashboard/overview"
          element={
            <PermissionRoute module="recruitment">
              <RecruitmentDashboard />
            </PermissionRoute>
          }
        />
        <Route
          path="/recruitment/jobs/list"
          element={
            <PermissionRoute module="recruitment">
              <JobsList />
            </PermissionRoute>
          }
        />
        <Route
          path="/recruitment/jobs/create"
          element={
            <PermissionRoute module="recruitment">
              <PostJob />
            </PermissionRoute>
          }
        />
        <Route
          path="/recruitment/applications/pipeline"
          element={
            <PermissionRoute module="recruitment">
              <RecruitmentPipeline />
            </PermissionRoute>
          }
        />
        <Route
          path="/recruitment/interviews/schedule"
          element={
            <PermissionRoute module="recruitment">
              <ScheduleInterview />
            </PermissionRoute>
          }
        />
        <Route
          path="/recruitment/candidates/database"
          element={
            <PermissionRoute module="recruitment">
              <AddCandidate />
            </PermissionRoute>
          }
        />

        {/* Operations & Workspace */}
        <Route
          path="/operations/calendar/overview"
          element={
            <PermissionRoute module="calendar">
              <MyCalendar />
            </PermissionRoute>
          }
        />
        <Route
          path="/operations/broadcasts/overview"
          element={
            <PermissionRoute module="broadcasts">
              <Broadcasts />
            </PermissionRoute>
          }
        />
        <Route
          path="/operations/assets/overview"
          element={
            <PermissionRoute module="assets">
              <Assets />
            </PermissionRoute>
          }
        />
        <Route
          path="/operations/activities/overview"
          element={
            <PermissionRoute module="activities">
              <Activities />
            </PermissionRoute>
          }
        />
        <Route
          path="/operations/vendor-management/overview"
          element={
            <PermissionRoute module="vendor-management">
              <VendorManagement />
            </PermissionRoute>
          }
        />

        {/* Projects & Tasks */}
        <Route
          path="/projects/all/overview"
          element={
            <PermissionRoute module="projects">
              <Projects />
            </PermissionRoute>
          }
        />
        <Route
          path="/projects/:slug/overview"
          element={
            <PermissionRoute module="projects">
              <Projects />
            </PermissionRoute>
          }
        />
        <Route
          path="/assignments/work/overview"
          element={
            <PermissionRoute module="assignments">
              <Assignments />
            </PermissionRoute>
          }
        />
        <Route
          path="/tasks/goals/overview"
          element={
            <PermissionRoute module="goals">
              <Goals />
            </PermissionRoute>
          }
        />

        {/* CRM & Sales */}
        <Route
          path="/clients/accounts/overview"
          element={
            <PermissionRoute module="clients">
              <Clients />
            </PermissionRoute>
          }
        />
        <Route
          path="/deals/pipeline/overview"
          element={
            <PermissionRoute module="deals">
              <Deals />
            </PermissionRoute>
          }
        />
        <Route
          path="/deals/:slug/overview"
          element={
            <PermissionRoute module="deals">
              <Deals />
            </PermissionRoute>
          }
        />
        <Route
          path="/pipeline/crm/overview"
          element={
            <PermissionRoute module="pipeline">
              <Pipeline />
            </PermissionRoute>
          }
        />
        <Route
          path="/leads/management/overview"
          element={
            <PrivateRoute>
              <LeadsWrapper />
            </PrivateRoute>
          }
        />
        <Route
          path="/leads/marketing/overview"
          element={
            <PrivateRoute>
              <MarketingLeads />
            </PrivateRoute>
          }
        />

        {/* Workforce & HR */}
        <Route
          path="/employees/directory/overview"
          element={
            <PermissionRoute module="employees">
              <Employees />
            </PermissionRoute>
          }
        />
        <Route
          path="/organization/roles/overview"
          element={
            <PermissionRoute module="roles">
              <Roles />
            </PermissionRoute>
          }
        />
        <Route
          path="/leaves/requests/overview"
          element={
            <PermissionRoute module="leaves">
              <Leaves />
            </PermissionRoute>
          }
        />
        <Route
          path="/attendance/records/overview"
          element={
            <PermissionRoute module="attendance">
              <Attendance />
            </PermissionRoute>
          }
        />
        <Route
          path="/attendance/biometric/logs"
          element={
            <PermissionRoute module="biometric-logs">
              <BiometricAttendance />
            </PermissionRoute>
          }
        />
        <Route
          path="/attendance/biometric/devices"
          element={
            <PermissionRoute module="devices">
              <Devices />
            </PermissionRoute>
          }
        />

        {/* Finance & Accounts */}
        <Route
          path="/finance/payroll/overview"
          element={
            <PermissionRoute module="payroll">
              <Payroll />
            </PermissionRoute>
          }
        />
        <Route
          path="/finance/payslips/overview"
          element={
            <PermissionRoute module="my-payslips">
              <MyPayslip />
            </PermissionRoute>
          }
        />
        <Route
          path="/finance/payments/overview"
          element={
            <PermissionRoute module="accounts">
              <ClientPayments />
            </PermissionRoute>
          }
        />

        {/* Documents & Legal */}
        <Route
          path="/documents/repository/overview"
          element={
            <PermissionRoute module="documents">
              <Documents />
            </PermissionRoute>
          }
        />
        <Route
          path="/documents/personal/overview"
          element={
            <PermissionRoute module="my-documents">
              <MyDocuments />
            </PermissionRoute>
          }
        />
        <Route
          path="/documents/generator/create"
          element={
            <PermissionRoute module="documents">
              <DocumentGenerator />
            </PermissionRoute>
          }
        />
        <Route
          path="/proposals/templates/overview"
          element={
            <PermissionRoute module="proposals">
              <Proposals />
            </PermissionRoute>
          }
        />
        <Route
          path="/proposals/documents/overview"
          element={
            <PermissionRoute module="proposals">
              <Templates />
            </PermissionRoute>
          }
        />
        <Route
          path="/letters/communications/overview"
          element={
            <PermissionRoute module="letters">
              <Letters />
            </PermissionRoute>
          }
        />

        {/* System & Account */}
        <Route
          path="/settings/system/general"
          element={
            <PermissionRoute adminOnly>
              <Settings />
            </PermissionRoute>
          }
        />
        <Route
          path="/profile/account/overview"
          element={
            <PrivateRoute>
              {user?.role?.name === 'Admin' ? <Profile /> : <UserProfile />}
            </PrivateRoute>
          }
        />
        <Route
          path="/notifications/inbox/overview"
          element={
            <PrivateRoute>
              <Notifications />
            </PrivateRoute>
          }
        />

        {/* ==================================================================== */}
        {/* CANONICAL NORMALIZATION: AUTOMATIC LEGACY REDIRECTS                  */}
        {/* ==================================================================== */}
        <Route path="/dashboard" element={<Navigate to={ROUTES.DASHBOARD.OVERVIEW} replace />} />
        <Route path="/recruitment" element={<Navigate to={ROUTES.RECRUITMENT.DASHBOARD} replace />} />
        <Route path="/recruitment/dashboard" element={<Navigate to={ROUTES.RECRUITMENT.DASHBOARD} replace />} />
        <Route path="/recruitment/jobs" element={<Navigate to={ROUTES.RECRUITMENT.JOBS} replace />} />
        <Route path="/recruitment/add-job" element={<Navigate to={ROUTES.RECRUITMENT.JOBS} replace />} />
        <Route path="/recruitment/create-job" element={<Navigate to={ROUTES.RECRUITMENT.CREATE_JOB} replace />} />
        <Route path="/recruitment/job-applications" element={<Navigate to={ROUTES.RECRUITMENT.APPLICATIONS} replace />} />
        <Route path="/recruitment/pipeline" element={<Navigate to={ROUTES.RECRUITMENT.APPLICATIONS} replace />} />
        <Route path="/recruitment/schedule-interview" element={<Navigate to={ROUTES.RECRUITMENT.INTERVIEWS} replace />} />
        <Route path="/recruitment/interview-schedule" element={<Navigate to={ROUTES.RECRUITMENT.INTERVIEWS} replace />} />
        <Route path="/recruitment/add-candidate" element={<Navigate to={ROUTES.RECRUITMENT.CANDIDATES} replace />} />
        <Route path="/recruitment/candidate-database" element={<Navigate to={ROUTES.RECRUITMENT.CANDIDATES} replace />} />

        <Route path="/calendar" element={<Navigate to={ROUTES.OPERATIONS.CALENDAR} replace />} />
        <Route path="/broadcasts" element={<Navigate to={ROUTES.OPERATIONS.BROADCASTS} replace />} />
        <Route path="/assets" element={<Navigate to={ROUTES.OPERATIONS.ASSETS} replace />} />
        <Route path="/activities" element={<Navigate to={ROUTES.OPERATIONS.ACTIVITIES} replace />} />
        <Route path="/vendor-management" element={<Navigate to={ROUTES.OPERATIONS.VENDOR_MANAGEMENT} replace />} />
        <Route path="/vendors" element={<Navigate to={ROUTES.OPERATIONS.VENDOR_MANAGEMENT} replace />} />

        <Route path="/projects" element={<Navigate to={ROUTES.PROJECTS.OVERVIEW} replace />} />
        <Route path="/assignments" element={<Navigate to={ROUTES.ASSIGNMENTS.OVERVIEW} replace />} />
        <Route path="/goals" element={<Navigate to={ROUTES.TASKS.GOALS} replace />} />

        <Route path="/clients" element={<Navigate to={ROUTES.CRM.CLIENTS} replace />} />
        <Route path="/deals" element={<Navigate to={ROUTES.CRM.DEALS} replace />} />
        <Route path="/pipeline" element={<Navigate to={ROUTES.CRM.PIPELINE} replace />} />
        <Route path="/leads" element={<Navigate to={ROUTES.CRM.LEADS} replace />} />

        <Route path="/employees" element={<Navigate to={ROUTES.WORKFORCE.EMPLOYEES} replace />} />
        <Route path="/roles" element={<Navigate to={ROUTES.WORKFORCE.ROLES} replace />} />
        <Route path="/leaves" element={<Navigate to={ROUTES.WORKFORCE.LEAVES} replace />} />
        <Route path="/attendance" element={<Navigate to={ROUTES.WORKFORCE.ATTENDANCE} replace />} />
        <Route path="/devices" element={<Navigate to={ROUTES.WORKFORCE.BIOMETRIC_DEVICES} replace />} />
        <Route path="/biometric-attendance" element={<Navigate to={ROUTES.WORKFORCE.BIOMETRIC_LOGS} replace />} />

        <Route path="/payroll" element={<Navigate to={ROUTES.FINANCE.PAYROLL} replace />} />
        <Route path="/my-payroll" element={<Navigate to={ROUTES.FINANCE.MY_PAYSLIPS} replace />} />
        <Route path="/finance" element={<Navigate to={ROUTES.FINANCE.MY_PAYSLIPS} replace />} />
        <Route path="/client-payments" element={<Navigate to={ROUTES.FINANCE.PAYMENTS} replace />} />

        <Route path="/documents" element={<Navigate to={ROUTES.DOCUMENTS.REPOSITORY} replace />} />
        <Route path="/my-documents" element={<Navigate to={ROUTES.DOCUMENTS.PERSONAL} replace />} />
        <Route path="/document-generator" element={<Navigate to={ROUTES.DOCUMENTS.GENERATOR} replace />} />
        <Route path="/proposals" element={<Navigate to={ROUTES.DOCUMENTS.PROPOSALS} replace />} />
        <Route path="/templates" element={<Navigate to={ROUTES.DOCUMENTS.TEMPLATES} replace />} />
        <Route path="/letters" element={<Navigate to={ROUTES.DOCUMENTS.LETTERS} replace />} />

        <Route path="/settings" element={<Navigate to={ROUTES.SYSTEM.SETTINGS} replace />} />
        <Route path="/profile" element={<Navigate to={ROUTES.SYSTEM.PROFILE} replace />} />
        <Route path="/notifications" element={<Navigate to={ROUTES.SYSTEM.NOTIFICATIONS} replace />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD.OVERVIEW} replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
