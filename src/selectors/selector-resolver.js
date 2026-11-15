import { SHADOW_SEPARATOR } from '../shared/constants.js';

/**
 * Turns stored selectors back into DOM lookups.
 *
 * A selector may contain ' >>> ' separators for open shadow roots:
 *   "my-app >>> .sidebar"  =  find <my-app>, enter its shadowRoot, find .sidebar
 * Plain CSS cannot cross shadow boundaries, so for such selectors we resolve the
 * shadow roots ourselves and apply the final segment as CSS *inside* each root.
 *
 * All functions are pure (they take the document as an argument and keep no state).
 */

export function splitSelector(selector) {
  return selector
    .split(SHADOW_SEPARATOR)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function isShadowSelector(selector) {
  return selector.includes(SHADOW_SEPARATOR);
}

/** True when every segment parses as a CSS selector. */
export function isValidSelector(selector) {
  const segments = splitSelector(selector);
  if (segments.length === 0) return false;
  const probe = document.createDocumentFragment();
  return segments.every((segment) => {
    try {
      probe.querySelector(segment);
      return true;
    } catch {
      return false;
    }
  });
}

function queryAll(root, selector) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

/** The roots (document or shadow roots) in which the last segment has to be looked up. */
function resolveScopeRoots(segments, document) {
  let roots = [document];
  for (const segment of segments.slice(0, -1)) {
    roots = roots.flatMap((root) => queryAll(root, segment)).flatMap((host) => (host.shadowRoot ? [host.shadowRoot] : []));
  }
  return roots;
}

/**
 * @returns {{ targets: {root: Document|ShadowRoot, selector: string}[], firstMatch: Element|null }}
 *   `targets` is where the CSS must be applied; it is non-empty even if nothing matches yet,
 *   so late-arriving elements are hidden by CSS without any JavaScript.
 */
export function resolveSelector(selector, document) {
  const segments = splitSelector(selector);
  if (segments.length === 0) return { targets: [], firstMatch: null };

  const innerSelector = segments[segments.length - 1];
  const targets = [];
  let firstMatch = null;

  for (const root of resolveScopeRoots(segments, document)) {
    try {
      firstMatch ??= root.querySelector(innerSelector);
    } catch {
      return { targets: [], firstMatch: null }; // invalid selector: ignore the whole thing
    }
    targets.push({ root, selector: innerSelector });
  }
  return { targets, firstMatch };
}

/** Every element a selector currently matches (across shadow roots). */
export function queryAllBySelector(selector, document) {
  const { targets } = resolveSelector(selector, document);
  return targets.flatMap(({ root, selector: inner }) => queryAll(root, inner));
}

function fallbackLooksRight(element, fingerprint) {
  // A structural fallback that now points at a different kind of element is a wrong match.
  return !fingerprint?.tag || element.localName === fingerprint.tag;
}

/**
 * Decides where CSS has to be applied for a rule right now.
 *
 * The primary selector is always armed. Fallbacks are only used while the primary
 * selector matches nothing, and only if they land on the same kind of element.
 *
 * `settled` means "nothing else can change for this rule", so later DOM mutations
 * can skip it entirely (CSS keeps hiding new matches by itself).
 */
export function resolveRuleTargets(rule, document) {
  const primary = resolveSelector(rule.selector, document);
  const targets = [...primary.targets];
  const primaryMatched = primary.firstMatch !== null;

  if (!primaryMatched) {
    for (const fallbackSelector of rule.fallbackSelectors) {
      const fallback = resolveSelector(fallbackSelector, document);
      if (fallback.firstMatch && fallbackLooksRight(fallback.firstMatch, rule.fingerprint)) {
        targets.push(...fallback.targets);
        break;
      }
    }
  }

  return { targets, settled: primaryMatched && !isShadowSelector(rule.selector) };
}
