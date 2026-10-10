/**
 * Domain Normalization Utility for Bhoomi HRMS Access Policies.
 * Ensures consistent domain formatting and prevents false-positive matching.
 */

function normalizeDomain(rawDomain) {
  if (!rawDomain || typeof rawDomain !== 'string') {
    return '';
  }

  let domain = rawDomain.trim().toLowerCase();

  // Strip protocol (http://, https://, ftp://, etc.)
  domain = domain.replace(/^[a-zA-Z]+:\/\//, '');

  // Strip user authentication (e.g. user:pass@)
  if (domain.includes('@')) {
    domain = domain.split('@').pop();
  }

  // Strip port, path, query strings, and hashes
  domain = domain.split('/')[0];
  domain = domain.split('?')[0];
  domain = domain.split('#')[0];
  domain = domain.split(':')[0];

  // Strip leading/trailing dots and whitespace
  domain = domain.replace(/^\.+|\.+$/g, '');

  // Strip leading www. if present
  if (domain.startsWith('www.')) {
    domain = domain.slice(4);
  }

  return domain;
}

/**
 * Checks whether a given request hostname matches a blocked domain rule.
 * Strict suffix matching with dot boundary:
 * e.g., 'youtube.com' matches 'youtube.com', 'www.youtube.com', 'm.youtube.com'
 * but does NOT match 'notyoutube.com' or 'myoutube.com'.
 */
function isDomainMatch(requestHost, blockedDomain) {
  const normHost = normalizeDomain(requestHost);
  const normBlocked = normalizeDomain(blockedDomain);

  if (!normHost || !normBlocked) return false;

  if (normHost === normBlocked) {
    return true;
  }

  // Check dot-boundary subdomain match
  if (normHost.endsWith('.' + normBlocked)) {
    return true;
  }

  return false;
}

module.exports = {
  normalizeDomain,
  isDomainMatch
};
