import { api } from './browser-api.js';
import { STORAGE_KEYS } from './constants.js';

/**
 * Localisation with a user-selectable language.
 *
 * The browser's own `i18n.getMessage` is locked to the browser UI language, so the extension
 * loads `_locales/<lang>/messages.json` itself. The chosen language (`settings.language`, or
 * "auto" = follow the browser) is read from storage by `initI18n()`, which every entry point
 * (popup, settings page, content script, service worker) awaits once before showing text.
 *
 * Plural forms are stored as `<key>_one`, `_few`, `_many`, `_other` and picked with
 * Intl.PluralRules; `<key>_other` is the required fallback.
 */

export const AUTO_LANGUAGE = 'auto';
/** Endonyms are never translated, so a user can always find their own language. */
export const LANGUAGES = Object.freeze([
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'az', name: 'Azərbaycanca' },
]);
const DEFAULT_LANGUAGE = 'en';

const catalogCache = new Map();
let current = { language: DEFAULT_LANGUAGE, messages: {} };
let english = {};

const isSupported = (code) => LANGUAGES.some((language) => language.code === code);

/** "auto" / unknown -> the browser language if we have it, else English. */
export function resolveLanguage(preference) {
  if (isSupported(preference)) return preference;
  let ui = DEFAULT_LANGUAGE;
  try {
    ui = (api.i18n.getUILanguage() || DEFAULT_LANGUAGE).toLowerCase().split('-')[0];
  } catch {
    // fall through to English
  }
  return isSupported(ui) ? ui : DEFAULT_LANGUAGE;
}

function loadCatalog(language) {
  if (!catalogCache.has(language)) {
    const request = fetch(api.runtime.getURL(`_locales/${language}/messages.json`)).then((response) => {
      if (!response.ok) throw new Error(`Missing locale ${language}`);
      return response.json();
    });
    catalogCache.set(language, request);
    request.catch(() => catalogCache.delete(language)); // allow a retry later
  }
  return catalogCache.get(language);
}

async function readLanguagePreference() {
  try {
    const result = await api.storage.local.get(STORAGE_KEYS.SETTINGS);
    return result[STORAGE_KEYS.SETTINGS]?.language ?? AUTO_LANGUAGE;
  } catch {
    return AUTO_LANGUAGE;
  }
}

/** Loads the active language. Safe to call again after the language setting changed. */
export async function initI18n() {
  const language = resolveLanguage(await readLanguagePreference());
  try {
    const [messages, englishMessages] = await Promise.all([
      loadCatalog(language),
      language === DEFAULT_LANGUAGE ? null : loadCatalog(DEFAULT_LANGUAGE),
    ]);
    english = englishMessages ?? messages;
    current = { language, messages };
  } catch (error) {
    // Keep whatever was loaded before; t() then falls back to the browser's own catalogue.
    console.warn('[Page Element Hider] could not load language', language, error);
  }
  return current.language;
}

export function currentLanguage() {
  return current.language;
}

function format(entry, substitutions) {
  return entry.message.replace(/\$(\w+)\$/g, (whole, name) => {
    const content = entry.placeholders?.[name.toLowerCase()]?.content;
    const index = content ? Number(content.slice(1)) - 1 : Number.NaN;
    return Number.isInteger(index) && index >= 0 ? String(substitutions[index] ?? '') : whole;
  });
}

function lookup(key, substitutions) {
  const entry = current.messages[key] ?? english[key];
  if (entry) return format(entry, substitutions);
  try {
    return api.i18n.getMessage(key, substitutions.map(String)) || '';
  } catch {
    return '';
  }
}

/** Translated message for `key`; substitutions fill {1}..{9}. Falls back to the key itself. */
export function t(key, ...substitutions) {
  return lookup(key, substitutions) || key;
}

/** Plural-aware message: tn('listRuleCount', 3) picks listRuleCount_one/_few/_many/_other. */
export function tn(key, count, ...substitutions) {
  let category = count === 1 ? 'one' : 'other';
  try {
    category = new Intl.PluralRules(current.language).select(count);
  } catch {
    // keep the simple English rule
  }
  const args = [count, ...substitutions];
  return lookup(`${key}_${category}`, args) || t(`${key}_other`, ...args);
}

/**
 * Fills static HTML. Supported attributes:
 *   data-i18n="key"                 -> textContent
 *   data-i18n-placeholder="key"     -> placeholder
 *   data-i18n-aria-label="key"      -> aria-label
 *   data-i18n-title="key"           -> title (tooltip)
 * Also sets <html lang> and (<html data-i18n-doc-title>) the page title.
 */
export function localizeDocument(root = document) {
  root.documentElement.lang = current.language;

  for (const element of root.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of root.querySelectorAll('[data-i18n-placeholder]')) {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder));
  }
  for (const element of root.querySelectorAll('[data-i18n-aria-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel));
  }
  for (const element of root.querySelectorAll('[data-i18n-title]')) {
    element.setAttribute('title', t(element.dataset.i18nTitle));
  }
  const titleKey = root.documentElement.dataset.i18nDocTitle;
  if (titleKey) root.title = t(titleKey);
}
