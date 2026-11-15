import { t } from '../shared/i18n.js';
import { normalizeRule, validateRule } from './rule-model.js';

/**
 * Backup / sharing format for rules.
 *
 *   { format: "page-element-hider-rules", version: 1, exportedAt: ISO date, rules: HiddenRule[] }
 *
 * Imported files are untrusted: every rule is rebuilt through `normalizeRule`, validated like a
 * rule created in the UI, gets a NEW id, and only known fingerprint fields survive.
 */

export const EXPORT_FORMAT = 'page-element-hider-rules';
export const EXPORT_VERSION = 1;
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_RULES = 10000;

export function buildExport(rules) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    rules,
  };
}

export function exportFileName(date = new Date()) {
  return `page-element-hider-rules-${date.toISOString().slice(0, 10)}.json`;
}

function sanitizeFingerprint(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = (value) => (typeof value === 'string' ? value.slice(0, 200) : '');
  return {
    tag: text(raw.tag),
    id: text(raw.id),
    classes: Array.isArray(raw.classes) ? raw.classes.filter((c) => typeof c === 'string').slice(0, 10).map((c) => c.slice(0, 100)) : [],
    text: text(raw.text),
  };
}

/**
 * @param {string} text file contents
 * @param {{ isSelectorValid?: (selector: string) => boolean }} [options]
 * @returns {{ rules: object[], invalidCount: number }}
 * @throws {Error} with a localised message when the file is not a usable export
 */
export function parseImport(text, { isSelectorValid = () => true } = {}) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(t('transferInvalidFile'));
  }

  const isExport = data && typeof data === 'object' && data.format === EXPORT_FORMAT && Array.isArray(data.rules);
  if (!isExport || !(data.version >= 1 && data.version <= EXPORT_VERSION)) throw new Error(t('transferInvalidFile'));
  if (data.rules.length === 0) throw new Error(t('transferNoRulesInFile'));
  if (data.rules.length > MAX_IMPORT_RULES) throw new Error(t('transferTooLarge'));

  const rules = [];
  let invalidCount = 0;
  for (const raw of data.rules) {
    const rule = raw && typeof raw === 'object' ? normalizeRule({ ...raw, id: crypto.randomUUID() }) : null;
    if (!rule || validateRule(rule).length > 0 || !isSelectorValid(rule.selector)) {
      invalidCount++;
      continue;
    }
    rule.fallbackSelectors = rule.fallbackSelectors.filter(isSelectorValid);
    rule.fingerprint = sanitizeFingerprint(rule.fingerprint);
    rules.push(rule);
  }
  return { rules, invalidCount };
}

/** Two rules are duplicates when they would hide the same thing in the same place. */
export function ruleKey(rule) {
  const { mode, value } = rule.pathContext;
  return [rule.hostname, rule.includeSubdomains, mode, value, rule.selector].join('\u0000');
}
