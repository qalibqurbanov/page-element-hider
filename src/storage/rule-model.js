import { DEFAULT_PATH_CONTEXT, PATH_MODES } from '../shared/constants.js';
import { t } from '../shared/i18n.js';
import { isValidHostname, normalizeHostname, normalizePath } from '../shared/url-matcher.js';

/**
 * Data model for a saved hiding rule.
 *
 * HiddenRule
 * ├── id                 uuid
 * ├── hostname           REQUIRED, normalized ("example.com"); the website the rule belongs to
 * ├── includeSubdomains  false by default; opt-in via the settings page
 * ├── pathContext        { mode: 'site' | 'exact' | 'pattern', value }  - see PATH_MODES
 * ├── createdOnPath      page path the element was hidden on (informational)
 * ├── selector           primary selector; ' >>> ' separates shadow-root segments
 * ├── fallbackSelectors  tried in order when the primary selector matches nothing
 * ├── fingerprint        { tag, id, classes, text } captured at creation time
 * ├── description        human readable label shown in the settings page
 * ├── enabled
 * ├── createdAt / updatedAt   epoch milliseconds
 *
 * A rule without a hostname is invalid and can never be stored, so a bare selector such
 * as ".sidebar" can never apply to every website.
 *
 * Migrations: `normalizeRule` is the single place where older stored shapes would be
 * upgraded when the model changes.
 */

const MAX_DESCRIPTION_LENGTH = 300;

function asString(value) {
  return typeof value === 'string' ? value : '';
}

function normalizePathContext(raw) {
  const mode = Object.values(PATH_MODES).includes(raw?.mode) ? raw.mode : PATH_MODES.SITE;
  if (mode === PATH_MODES.SITE) return { ...DEFAULT_PATH_CONTEXT };
  const value = asString(raw?.value).trim();
  return { mode, value: mode === PATH_MODES.EXACT ? normalizePath(value) : value };
}

function normalizeFallbacks(raw, primary) {
  if (!Array.isArray(raw)) return [];
  const cleaned = raw.map((entry) => asString(entry).trim()).filter(Boolean);
  return [...new Set(cleaned)].filter((entry) => entry !== primary);
}

/** Coerces any stored/edited value into a well-formed (not necessarily valid) rule. */
export function normalizeRule(raw) {
  const now = Date.now();
  const selector = asString(raw?.selector).trim();
  return {
    id: asString(raw?.id),
    hostname: normalizeHostname(raw?.hostname),
    includeSubdomains: raw?.includeSubdomains === true,
    pathContext: normalizePathContext(raw?.pathContext),
    createdOnPath: normalizePath(asString(raw?.createdOnPath)),
    selector,
    fallbackSelectors: normalizeFallbacks(raw?.fallbackSelectors, selector),
    fingerprint: raw?.fingerprint && typeof raw.fingerprint === 'object' ? raw.fingerprint : null,
    description: asString(raw?.description).trim().slice(0, MAX_DESCRIPTION_LENGTH),
    enabled: raw?.enabled !== false,
    createdAt: Number.isFinite(raw?.createdAt) ? raw.createdAt : now,
    updatedAt: Number.isFinite(raw?.updatedAt) ? raw.updatedAt : now,
  };
}

/** Returns a list of human-readable problems; empty when the rule is valid. */
export function validateRule(rule) {
  const errors = [];
  if (!rule.id) errors.push(t('ruleErrNoId'));
  if (!rule.hostname) errors.push(t('ruleErrNoHostname'));
  else if (!isValidHostname(rule.hostname)) errors.push(t('ruleErrBadHostname', rule.hostname));
  if (!rule.selector) errors.push(t('ruleErrNoSelector'));

  const { mode, value } = rule.pathContext;
  if (mode !== PATH_MODES.SITE && !value.startsWith('/')) {
    errors.push(t('ruleErrPathSlash'));
  }
  return errors;
}

function assertValid(rule) {
  const errors = validateRule(rule);
  if (errors.length > 0) throw new Error(errors.join(' '));
  return rule;
}

export function createRule(input) {
  const now = Date.now();
  return assertValid(
    normalizeRule({
      pathContext: DEFAULT_PATH_CONTEXT,
      ...input,
      id: crypto.randomUUID(),
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }),
  );
}

/** Applies user edits to an existing rule; id and createdAt are immutable. */
export function updateRule(rule, changes) {
  return assertValid(
    normalizeRule({
      ...rule,
      ...changes,
      id: rule.id,
      createdAt: rule.createdAt,
      updatedAt: Date.now(),
    }),
  );
}

/** Reads a stored rule, dropping it (null) if it is corrupt or invalid. */
export function sanitizeRule(raw) {
  const rule = normalizeRule(raw);
  return validateRule(rule).length === 0 ? rule : null;
}
