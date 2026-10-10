import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Enterprise Route Configuration & Hierarchy
 * Follows Tier-1 Semantic RESTful URL design: /:module/:subDomain/:resourceAction
 */
export const ROUTES = {
  // Core & Auth
  AUTH: {
    LOGIN: '/login',
  },
  DASHBOARD: {
    ROOT: '/dashboard',
    OVERVIEW: '/dashboard/analytics/overview',
    ADMIN: '/dashboard/admin/overview',
    SALES: '/dashboard/sales/overview',
    MARKETING: '/dashboard/marketing/overview',
    HR: '/dashboard/hr/overview',
    GENERAL: '/dashboard/employee/overview',
  },

  // Recruitment
  RECRUITMENT: {
    ROOT: '/recruitment',
    DASHBOARD: '/recruitment/dashboard/overview',
    JOBS: '/recruitment/jobs/list',
    CREATE_JOB: '/recruitment/jobs/create',
    APPLICATIONS: '/recruitment/applications/pipeline',
    INTERVIEWS: '/recruitment/interviews/schedule',
    CANDIDATES: '/recruitment/candidates/database',
  },

  // Public Careers & Job Application Portal
  CAREERS: {
    ROOT: '/careers',
    PORTAL: '/careers/portal',
    JOBS: '/careers/jobs',
    APPLY: '/careers/apply',
    JOB_APPLY: '/careers/jobs/:id/apply',
  },

  // Operations & Workspace
  OPERATIONS: {
    CALENDAR: '/operations/calendar/overview',
    BROADCASTS: '/operations/broadcasts/overview',
    ASSETS: '/operations/assets/overview',
    ACTIVITIES: '/operations/activities/overview',
    VENDOR_MANAGEMENT: '/operations/vendor-management/overview',
  },

  // Projects & Tasks
  PROJECTS: {
    ROOT: '/projects',
    OVERVIEW: '/projects/all/overview',
    DETAIL: '/projects/:slug/overview',
  },
  ASSIGNMENTS: {
    ROOT: '/assignments',
    OVERVIEW: '/assignments/work/overview',
  },
  TASKS: {
    ROOT: '/tasks',
    GOALS: '/tasks/goals/overview',
  },

  // CRM & Sales
  CRM: {
    CLIENTS: '/clients/accounts/overview',
    DEALS: '/deals/pipeline/overview',
    PIPELINE: '/pipeline/crm/overview',
    LEADS: '/leads/management/overview',
    MARKETING_LEADS: '/leads/marketing/overview',
  },

  // Workforce & HR
  WORKFORCE: {
    EMPLOYEES: '/employees/directory/overview',
    ROLES: '/organization/roles/overview',
    LEAVES: '/leaves/requests/overview',
    ATTENDANCE: '/attendance/records/overview',
    BIOMETRIC_LOGS: '/attendance/biometric/logs',
    BIOMETRIC_DEVICES: '/attendance/biometric/devices',
  },

  // Finance & Accounts
  FINANCE: {
    ROOT: '/finance',
    PAYROLL: '/finance/payroll/overview',
    MY_PAYSLIPS: '/finance/payslips/overview',
    PAYMENTS: '/finance/payments/overview',
  },

  // Documents & Legal
  DOCUMENTS: {
    ROOT: '/documents',
    REPOSITORY: '/documents/repository/overview',
    PERSONAL: '/documents/personal/overview',
    GENERATOR: '/documents/generator/create',
    PROPOSALS: '/proposals/templates/overview',
    TEMPLATES: '/proposals/documents/overview',
    LETTERS: '/letters/communications/overview',
  },

  // System & Account
  SYSTEM: {
    SETTINGS: '/settings/system/general',
    PROFILE: '/profile/account/overview',
    NOTIFICATIONS: '/notifications/inbox/overview',
  },
};

/**
 * Standard Contextual Query Defaults for Tier-1 Navigation
 */
export const NAV_ROUTE_QUERIES = {
  [ROUTES.DASHBOARD.OVERVIEW]: { ref: 'sidebar', tab: 'analytics', period: 'month' },
  [ROUTES.DOCUMENTS.REPOSITORY]: { ref: 'sidebar', tab: 'employee', view: 'list', filter: 'all' },
  [ROUTES.DOCUMENTS.PERSONAL]: { ref: 'sidebar', tab: 'personal', view: 'list' },
  [ROUTES.DOCUMENTS.GENERATOR]: { ref: 'sidebar', tab: 'generator' },
  [ROUTES.DOCUMENTS.PROPOSALS]: { ref: 'sidebar', tab: 'all', filter: 'all' },
  [ROUTES.DOCUMENTS.TEMPLATES]: { ref: 'sidebar', tab: 'templates', view: 'grid' },
  [ROUTES.DOCUMENTS.LETTERS]: { ref: 'sidebar', tab: 'all', filter: 'all', view: 'list' },
  [ROUTES.WORKFORCE.EMPLOYEES]: { ref: 'sidebar', tab: 'all', view: 'grid' },
  [ROUTES.WORKFORCE.ROLES]: { ref: 'sidebar', tab: 'roles' },
  [ROUTES.WORKFORCE.LEAVES]: { ref: 'sidebar', tab: 'all' },
  [ROUTES.WORKFORCE.ATTENDANCE]: { ref: 'sidebar', tab: 'daily', view: 'table' },
  [ROUTES.WORKFORCE.BIOMETRIC_LOGS]: { ref: 'sidebar', tab: 'logs', view: 'table' },
  [ROUTES.WORKFORCE.BIOMETRIC_DEVICES]: { ref: 'sidebar', tab: 'devices' },
  [ROUTES.PROJECTS.OVERVIEW]: { ref: 'sidebar', tab: 'all', view: 'grid', status: 'active' },
  [ROUTES.ASSIGNMENTS.OVERVIEW]: { ref: 'sidebar', tab: 'active', filter: 'all' },
  [ROUTES.TASKS.GOALS]: { ref: 'sidebar', tab: 'active', filter: 'all' },
  [ROUTES.CRM.CLIENTS]: { ref: 'sidebar', tab: 'all', filter: 'active' },
  [ROUTES.CRM.DEALS]: { ref: 'sidebar', tab: 'deals', view: 'kanban' },
  [ROUTES.CRM.PIPELINE]: { ref: 'sidebar', tab: 'deals', view: 'kanban' },
  [ROUTES.CRM.LEADS]: { ref: 'sidebar', tab: 'all', status: 'new' },
  [ROUTES.FINANCE.PAYROLL]: { ref: 'sidebar', tab: 'all', status: 'processed' },
  [ROUTES.FINANCE.MY_PAYSLIPS]: { ref: 'sidebar', tab: 'my-payslips' },
  [ROUTES.FINANCE.PAYMENTS]: { ref: 'sidebar', tab: 'payments' },
  [ROUTES.OPERATIONS.CALENDAR]: { ref: 'sidebar', view: 'month' },
  [ROUTES.OPERATIONS.BROADCASTS]: { ref: 'sidebar', tab: 'announcements' },
  [ROUTES.OPERATIONS.ASSETS]: { ref: 'sidebar', tab: 'assigned', view: 'table' },
  [ROUTES.OPERATIONS.ACTIVITIES]: { ref: 'sidebar', tab: 'timeline', filter: 'all' },
  [ROUTES.OPERATIONS.VENDOR_MANAGEMENT]: { ref: 'sidebar', tab: 'all' },
  [ROUTES.SYSTEM.SETTINGS]: { ref: 'sidebar', tab: 'company' },
  [ROUTES.SYSTEM.PROFILE]: { ref: 'sidebar', tab: 'account' },
  [ROUTES.SYSTEM.NOTIFICATIONS]: { ref: 'sidebar', tab: 'inbox', filter: 'unread' },
  [ROUTES.RECRUITMENT.DASHBOARD]: { ref: 'sidebar', tab: 'overview', period: 'month' },
  [ROUTES.RECRUITMENT.JOBS]: { ref: 'sidebar', tab: 'active', view: 'list' },
  [ROUTES.RECRUITMENT.CREATE_JOB]: { ref: 'sidebar', tab: 'create' },
  [ROUTES.RECRUITMENT.APPLICATIONS]: { ref: 'sidebar', tab: 'pipeline', view: 'kanban' },
  [ROUTES.RECRUITMENT.INTERVIEWS]: { ref: 'sidebar', tab: 'upcoming' },
  [ROUTES.RECRUITMENT.CANDIDATES]: { ref: 'sidebar', tab: 'all', filter: 'active' },

  // Public Careers Portal Defaults
  [ROUTES.CAREERS.APPLY]: { ref: 'portal', source: 'career_board', mode: 'apply' },
  [ROUTES.CAREERS.PORTAL]: { ref: 'direct', tab: 'openings', view: 'list' },
  [ROUTES.CAREERS.JOB_APPLY]: { ref: 'job_board', mode: 'apply' },
};

/**
 * Sensitive parameter keys that must never be leaked into or persisted from URLs
 */
const SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'jwt',
  'auth',
  'authorization',
  'password',
  'pass',
  'secret',
  'apikey',
  'api_key',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'creditcard',
  'cvv',
  'ssn',
]);

/**
 * Sanitizes an object of query parameters, stripping null/undefined and sensitive keys
 */
export function sanitizeQueryParams(params = {}) {
  if (!params || typeof params !== 'object') return {};
  const cleaned = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_QUERY_KEYS.has(lowerKey)) {
      console.warn(`[Security Alert] Stripped sensitive query parameter '${key}' from URL generation.`);
      continue;
    }
    cleaned[key] = String(value);
  }
  return cleaned;
}

/**
 * Slugifies a given human-readable string for semantic URL paths
 * Example: "Q3 Financial Summary!" -> "q3-financial-summary"
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Reverse humanizes a slug
 * Example: "q3-financial-summary" -> "Q3 Financial Summary"
 */
export function unslugify(slug) {
  if (!slug) return '';
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Builds a composite human-readable slug with optional ID fallback
 */
export function buildResourceSlug(title, id) {
  const cleanTitle = slugify(title);
  if (!cleanTitle && !id) return 'item';
  if (!cleanTitle) return `item-${id}`;
  return cleanTitle;
}

/**
 * Resolves resource ID from either URL query param or composite slug
 */
export function extractEntityId(slug, queryId) {
  if (queryId) return queryId;
  if (!slug) return null;
  if (/^[0-9a-fA-F]{24}$/.test(slug) || /^[0-9]+$/.test(slug)) {
    return slug;
  }
  const match = slug.match(/-([0-9a-fA-F]{24}|[0-9]+)$/);
  return match ? match[1] : null;
}

/**
 * Constructs a fully qualified semantic URL with optional slug interpolation and sanitized query params
 * @param {string} routePattern - e.g. "/documents/repository/overview"
 * @param {object} options - { params: { slug: 'acme' }, query: { ref: 'sidebar', tab: 'all', view: 'list' } }
 */
export function buildSemanticUrl(routePattern, options = {}) {
  let url = routePattern || '/';
  const { params = {}, query = {} } = options;

  // Replace route params (e.g. :slug, :id)
  for (const [key, val] of Object.entries(params)) {
    url = url.replace(`:${key}`, encodeURIComponent(slugify(String(val))));
  }

  // Merge default queries if exists for this route pattern
  const defaultNavQuery = NAV_ROUTE_QUERIES[routePattern] || {};
  const mergedQuery = { ...defaultNavQuery, ...query };

  // Sanitize and append query string
  const cleanQuery = sanitizeQueryParams(mergedQuery);
  const searchParams = new URLSearchParams(cleanQuery);
  const queryString = searchParams.toString();

  return queryString ? `${url}?${queryString}` : url;
}

/**
 * Parses current route and search params into structured semantic tokens
 */
export function parseCurrentRoute(pathname, searchParams = new URLSearchParams()) {
  const segments = pathname.split('/').filter(Boolean);
  const module = segments[0] || 'dashboard';
  const subDomain = segments[1] || 'overview';
  const action = segments[2] || 'view';

  const query = {};
  for (const [key, value] of searchParams.entries()) {
    if (!SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      query[key] = value;
    }
  }

  return {
    module,
    subDomain,
    action,
    segments,
    query,
    tab: query.tab || null,
    view: query.view || 'list',
    filter: query.filter || 'all',
    page: query.page ? parseInt(query.page, 10) : 1,
    ref: query.ref || null,
    id: query.id || null,
  };
}

/**
 * Custom React Hook: useContextualQueryState
 * Provides seamless bidirectional synchronization between component state and URL query parameters.
 * Automatically synchronizes professional query parameters (ref, tab, filter, view, page) to URL.
 *
 * @param {object} defaultState - Initial fallback values (e.g. { tab: 'company', page: 1, view: 'grid', ref: 'sidebar' })
 * @param {object} options - Configuration options { historyMode: 'replace', autoSync: true }
 * @returns {[object, (updater: object | ((prev: object) => object), navOptions?: object) => void]}
 */
export function useContextualQueryState(defaultState = {}, options = {}) {
  const { historyMode = 'replace', autoSync = true } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const defaultStateRef = useRef(defaultState);

  // Auto-synchronize missing contextual defaults to URL on mount for clean professional links
  useEffect(() => {
    if (!autoSync) return;
    let needsUpdate = false;
    const current = new URLSearchParams(searchParams);

    for (const [key, val] of Object.entries(defaultStateRef.current)) {
      if (!current.has(key) && val !== null && val !== undefined && val !== '') {
        current.set(key, String(val));
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      setSearchParams(current, { replace: true });
    }
  }, [autoSync, searchParams, setSearchParams]);

  // Parse current query state combined with defaults
  const queryState = useMemo(() => {
    const result = { ...defaultStateRef.current };

    for (const [key, defVal] of Object.entries(defaultStateRef.current)) {
      if (searchParams.has(key)) {
        const rawVal = searchParams.get(key);
        if (typeof defVal === 'number') {
          const num = Number(rawVal);
          result[key] = isNaN(num) ? defVal : num;
        } else if (typeof defVal === 'boolean') {
          result[key] = rawVal === 'true' || rawVal === '1';
        } else {
          result[key] = rawVal;
        }
      }
    }

    // Also pick up any additional query params (e.g. ref, id, search, filter, view)
    for (const [key, value] of searchParams.entries()) {
      if (!SENSITIVE_QUERY_KEYS.has(key.toLowerCase()) && !(key in result)) {
        result[key] = value;
      }
    }

    return result;
  }, [searchParams]);

  // Update query state function
  const setQueryState = useCallback(
    (updater, navOptions = {}) => {
      const mode = navOptions.historyMode || historyMode;
      const currentParams = new URLSearchParams(searchParams);

      const nextValues = typeof updater === 'function' ? updater(queryState) : updater;

      if (!nextValues || typeof nextValues !== 'object') return;

      for (const [key, val] of Object.entries(nextValues)) {
        if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
          console.warn(`[Security Alert] Disallowed setting sensitive parameter '${key}' in URL query.`);
          continue;
        }

        if (val === null || val === undefined || val === '') {
          currentParams.delete(key);
        } else {
          currentParams.set(key, String(val));
        }
      }

      setSearchParams(currentParams, { replace: mode === 'replace' });
    },
    [historyMode, queryState, searchParams, setSearchParams]
  );

  return [queryState, setQueryState];
}

/**
 * Custom React Hook: useSemanticNavigation
 * Provides navigation helper that retains contextual state (e.g., Back navigation with preserved filters)
 */
export function useSemanticNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const goBackToModule = useCallback(
    (fallbackPath = ROUTES.DASHBOARD.OVERVIEW) => {
      const searchParams = new URLSearchParams(location.search);
      const ref = searchParams.get('ref');

      if (ref && ref.startsWith('/')) {
        navigate(ref);
      } else if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(buildSemanticUrl(fallbackPath));
      }
    },
    [location.search, navigate]
  );

  const navigateWithContext = useCallback(
    (targetPath, extraQuery = {}, options = {}) => {
      const currentRef = `${location.pathname}${location.search}`;
      const query = {
        ref: options.includeRef !== false ? currentRef : undefined,
        ...extraQuery,
      };

      const finalUrl = buildSemanticUrl(targetPath, { query });
      navigate(finalUrl, { replace: options.replace || false });
    },
    [location.pathname, location.search, navigate]
  );

  return {
    goBackToModule,
    navigateWithContext,
    buildSemanticUrl,
  };
}
