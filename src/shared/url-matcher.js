import { PATH_MODES, SUPPORTED_PROTOCOLS } from './constants.js';
import { t } from './i18n.js';

/**
 * Hostname / path scoping helpers. Pure functions, no DOM or extension APIs,
 * so they work in the content script, popup, options page and service worker.
 */

const HOSTNAME_PATTERN =
  /^(\[[0-9a-f:.]+\]|[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?(\.[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?)*)$/;

/** "WWW.Example.com." -> "example.com". `www.` is ignored so both spellings share rules. */
export function normalizeHostname(hostname) {
  return String(hostname ?? '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
}

export function isValidHostname(hostname) {
  return HOSTNAME_PATTERN.test(hostname);
}

/** "/a/b/" -> "/a/b"; "" -> "/". Query string and hash are never part of a path. */
export function normalizePath(pathname) {
  const path = pathname || '/';
  return path.length > 1 ? path.replace(/\/+$/, '') || '/' : path;
}

/** Returns { hostname, path } for http(s) URLs and null for everything else. */
export function parsePageUrl(href) {
  try {
    const url = new URL(href);
    if (!SUPPORTED_PROTOCOLS.includes(url.protocol)) return null;
    const hostname = normalizeHostname(url.hostname);
    return hostname ? { hostname, path: normalizePath(url.pathname) } : null;
  } catch {
    return null;
  }
}

/** The scope key of the page a content script is running in. */
export function getPageContext(location = globalThis.location) {
  return parsePageUrl(location.href);
}

/**
 * Glob matching for PATTERN rules. `*` matches any characters (including "/").
 * "/blog/*" also matches "/blog" itself, which is what people expect.
 */
export function globToRegExp(pattern) {
  const hasTrailingWildcardSegment = pattern.endsWith('/*');
  const body = hasTrailingWildcardSegment ? pattern.slice(0, -2) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}${hasTrailingWildcardSegment ? '(?:/.*)?' : ''}$`);
}

export function pathContextMatches(pathContext, path) {
  switch (pathContext.mode) {
    case PATH_MODES.EXACT:
      return normalizePath(pathContext.value) === normalizePath(path);
    case PATH_MODES.PATTERN:
      return globToRegExp(pathContext.value).test(normalizePath(path));
    case PATH_MODES.SITE:
    default:
      return true;
  }
}

/** Exact hostname match, plus subdomains when the rule explicitly opts in. */
export function hostnameMatches(rule, hostname) {
  const target = normalizeHostname(hostname);
  if (!rule.hostname || !target) return false;
  if (target === rule.hostname) return true;
  return rule.includeSubdomains === true && target.endsWith(`.${rule.hostname}`);
}

/**
 * The one gate every rule passes before it is applied.
 * A rule never applies unless the hostname matches - this is what guarantees that
 * ".sidebar" saved on example.com can never hide anything on another-site.com.
 */
export function ruleAppliesTo(rule, page) {
  return hostnameMatches(rule, page.hostname) && pathContextMatches(rule.pathContext, page.path);
}

export function describePathContext(pathContext) {
  switch (pathContext.mode) {
    case PATH_MODES.EXACT:
      return t('pathOnly', pathContext.value);
    case PATH_MODES.PATTERN:
      return t('pathPattern', pathContext.value);
    case PATH_MODES.SITE:
    default:
      return t('pathWhole');
  }
}
