import { SELECTOR_LIMITS, SHADOW_SEPARATOR } from '../shared/constants.js';

/**
 * Decides which identifiers of an element are worth putting in a selector.
 *
 * Modern sites generate class names and ids at build/run time ("css-1x2y3z",
 * "Header_title__a8Fk2", ":r1:"). Those change between deployments or page loads,
 * so a selector built from them would silently stop working. The heuristics are
 * deliberately conservative: rejecting a good identifier only costs us a slightly
 * longer selector, accepting a bad one costs us a rule that breaks.
 */

/** Attributes that usually carry a stable meaning, strongest first. */
export const STABLE_ATTRIBUTES = Object.freeze([
  'data-testid',
  'data-test',
  'data-test-id',
  'data-qa',
  'data-cy',
  'data-automation-id',
  'data-component',
  'data-section',
  'data-role',
  'role',
  'aria-label',
  'itemprop',
  'name',
  'title',
  'alt',
  'placeholder',
]);

const SIMPLE_CSS_TOKEN = /^-?[A-Za-z_][\w-]*$/;
const MIN_HASH_WORD_LENGTH = 5;
const MAX_RANDOM_CASE_WORD_LENGTH = 8;
const MIN_RANDOM_CASE_FLIPS = 3;
const LONG_DIGIT_RUN = /\d{4,}/;

// Prefixes emitted by CSS-in-JS libraries and frameworks.
const GENERATED_PREFIX =
  /^(css-|sc-|jsx-|svelte-|emotion-|styled-|ember\d|ng-tns-|ng-c\d|_ngcontent|_nghost|radix-|headlessui-|react-aria|:r)/i;

// State/utility classes that toggle at runtime and therefore must not identify an element.
const STATE_CLASS =
  /^(is|has)-|^ng-|^(active|open|opened|closed|show|shown|hide|hidden|visible|selected|current|focus|focused|hover|hovered|disabled|loading|loaded|expanded|collapsed|checked|sticky|stuck|scrolled|animating|fade|in|out)$/i;

function countCaseFlips(word) {
  let flips = 0;
  for (let i = 1; i < word.length; i++) {
    const previousIsUpper = word[i - 1] === word[i - 1].toUpperCase();
    const currentIsUpper = word[i] === word[i].toUpperCase();
    if (previousIsUpper !== currentIsUpper) flips++;
  }
  return flips;
}

/** A word that looks like a hash: letters mixed with digits, or random-looking casing. */
function isHashLikeWord(word) {
  if (word.length < MIN_HASH_WORD_LENGTH) return false;
  const hasDigit = /\d/.test(word);
  const hasLetter = /[a-z]/i.test(word);
  if (hasDigit && hasLetter) return true;
  if (/^[A-Za-z]+$/.test(word) && word.length <= MAX_RANDOM_CASE_WORD_LENGTH) {
    return countCaseFlips(word) >= MIN_RANDOM_CASE_FLIPS;
  }
  return false;
}

/** True for tokens such as "css-1x2y3z" or "Header_title__a8Fk2". */
export function looksGenerated(token) {
  if (GENERATED_PREFIX.test(token)) return true;
  return token.split(/[-_]+/).filter(Boolean).some(isHashLikeWord);
}

export function isStableClass(className) {
  return (
    SIMPLE_CSS_TOKEN.test(className) &&
    className.length <= SELECTOR_LIMITS.MAX_CLASS_LENGTH &&
    !looksGenerated(className) &&
    !STATE_CLASS.test(className)
  );
}

export function isStableId(id) {
  return (
    id.length > 0 &&
    id.length <= SELECTOR_LIMITS.MAX_CLASS_LENGTH &&
    !/^\d+$/.test(id) &&
    !LONG_DIGIT_RUN.test(id) &&
    !/[0-9a-f]{8}-[0-9a-f]{4}/i.test(id) && // UUID
    !looksGenerated(id)
  );
}

function isStableAttributeValue(value) {
  if (!value || value.length > SELECTOR_LIMITS.MAX_ATTRIBUTE_VALUE_LENGTH) return false;
  if (/[\r\n]/.test(value) || value.includes(SHADOW_SEPARATOR) || LONG_DIGIT_RUN.test(value)) return false;
  // Free text ("Close dialog") is fine; a single opaque token must not look generated.
  return /\s/.test(value) || !looksGenerated(value);
}

/** Links keep their destination across page loads; skip tracking-style query strings. */
function isStableHref(href) {
  return (
    href.length > 0 &&
    href.length <= SELECTOR_LIMITS.MAX_HREF_LENGTH &&
    !/[?#\r\n]/.test(href) &&
    !href.includes(SHADOW_SEPARATOR)
  );
}

export function stableClasses(element) {
  return Array.from(element.classList).filter(isStableClass).slice(0, SELECTOR_LIMITS.MAX_STORED_CLASSES);
}

/** Returns the element's id if it is stable, otherwise ''. */
export function stableId(element) {
  return isStableId(element.id ?? '') ? element.id : '';
}

/** Stable attribute/value pairs of an element, strongest first. */
export function stableAttributes(element) {
  const pairs = [];
  for (const name of STABLE_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value !== null && isStableAttributeValue(value.trim())) pairs.push({ name, value: value.trim() });
  }
  if (element.localName === 'a') {
    const href = element.getAttribute('href');
    if (href !== null && isStableHref(href.trim())) pairs.push({ name: 'href', value: href.trim() });
  }
  return pairs;
}
