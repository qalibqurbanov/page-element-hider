import { api } from './browser-api.js';

/**
 * Localisation helpers on top of the WebExtension i18n API (`_locales/<lang>/messages.json`).
 * The language follows the browser's UI language; English is the fallback (`default_locale`).
 *
 * Plural forms are stored as `<key>_one`, `<key>_few`, `<key>_many`, `<key>_other` and picked
 * with Intl.PluralRules for the active language; `<key>_other` is the required fallback.
 */

function uiLanguage() {
  try {
    return api.i18n.getUILanguage() || 'en';
  } catch {
    return 'en';
  }
}

/** Translated message for `key`; substitutions fill $1..$9. Falls back to the key itself. */
export function t(key, ...substitutions) {
  try {
    const message = api.i18n.getMessage(key, substitutions.map(String));
    return message || key;
  } catch {
    return key;
  }
}

let pluralRules = null;
function pluralCategory(count) {
  try {
    pluralRules ??= new Intl.PluralRules(uiLanguage());
    return pluralRules.select(count);
  } catch {
    return count === 1 ? 'one' : 'other';
  }
}

/** Plural-aware message: tn('listRuleCount', 3) picks listRuleCount_one/_few/_many/_other. */
export function tn(key, count, ...substitutions) {
  const args = [count, ...substitutions];
  const specific = api.i18n.getMessage(`${key}_${pluralCategory(count)}`, args.map(String));
  return specific || t(`${key}_other`, ...args);
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
  root.documentElement.lang = uiLanguage();

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
