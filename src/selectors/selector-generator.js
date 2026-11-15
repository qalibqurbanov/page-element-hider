import { ELEMENT_NODE, SELECTOR_LIMITS, SHADOW_SEPARATOR } from '../shared/constants.js';
import { stableAttributes, stableClasses, stableId } from './stability-heuristics.js';

/**
 * Builds selectors that identify one element as robustly as possible.
 *
 * Strategy, from most to least resilient:
 *   1. a single stable identifier   #id, tag[data-testid="x"], tag.stable-class
 *   2. stable ancestor + descendant  #main .promo   (survives wrappers being added/removed)
 *   3. shortest unique ancestor chain  nav.top > ul > li.item
 *   4. chain with :nth-of-type        LAST RESORT, only when nothing else is unique
 *
 * Every candidate is verified against the live DOM so it matches exactly the clicked element.
 * Candidates made only of bare tag names/positions are flagged `strong: false`; the caller
 * narrows such rules to the current page because they are unsafe to apply site-wide.
 *
 * Elements inside open shadow roots get a `hostSelector >>> innerSelector` path.
 */

const KIND = Object.freeze({ ID: 'id', ATTRIBUTE: 'attribute', CLASS: 'class', TAG: 'tag' });
const GROUPABLE_KINDS = new Set([KIND.ATTRIBUTE, KIND.CLASS]);

/**
 * @typedef {{ selector: string, strong: boolean }} Candidate
 * @typedef {{ selector: string, count: number }} Group
 */

function attributeSelector(name, value) {
  return `[${name}="${value.replace(/["\\]/g, '\\$&')}"]`;
}

/** Selectors that describe `element` on its own, most stable first. */
function compoundCandidates(element) {
  const tag = element.localName;
  const compounds = [];

  const id = stableId(element);
  if (id) compounds.push({ selector: `#${CSS.escape(id)}`, kind: KIND.ID });

  for (const { name, value } of stableAttributes(element).slice(0, SELECTOR_LIMITS.MAX_ATTRIBUTE_CANDIDATES)) {
    compounds.push({ selector: `${tag}${attributeSelector(name, value)}`, kind: KIND.ATTRIBUTE });
  }

  const classes = stableClasses(element).slice(0, SELECTOR_LIMITS.MAX_CLASSES_PER_COMPOUND);
  if (classes.length > 0) {
    const classSelector = (names) => tag + names.map((name) => `.${CSS.escape(name)}`).join('');
    compounds.push({ selector: classSelector(classes), kind: KIND.CLASS });
    if (classes.length > 1) {
      for (const name of classes) compounds.push({ selector: classSelector([name]), kind: KIND.CLASS });
    }
  }

  // Custom elements (<my-widget>) are as meaningful as a class name.
  compounds.push({ selector: tag, kind: tag.includes('-') ? KIND.ATTRIBUTE : KIND.TAG });
  return compounds;
}

function countMatches(root, selector) {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

function isOnlyMatch(root, selector, element) {
  try {
    const matches = root.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === element;
  } catch {
    return false;
  }
}

function matchesInclude(root, selector, element) {
  try {
    return Array.from(root.querySelectorAll(selector)).includes(element);
  } catch {
    return false;
  }
}

function indexAmongSameTag(element) {
  let index = 1;
  for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
    if (sibling.localName === element.localName) index++;
  }
  return index;
}

/** One path segment for `element`; adds :nth-of-type only if its siblings would be ambiguous. */
function pathSegment(element, usePosition) {
  const [best] = compoundCandidates(element);
  if (!usePosition || best.kind === KIND.ID) return best;

  const siblings = Array.from(element.parentNode?.children ?? []);
  const ambiguous = siblings.filter((sibling) => sibling.matches(best.selector)).length > 1;
  return ambiguous
    ? { selector: `${best.selector}:nth-of-type(${indexAmongSameTag(element)})`, kind: best.kind, positional: true }
    : best;
}

/**
 * Whether a chain is safe to apply on every page of a website. A chain anchored on an id or
 * attribute is. A chain that only has classes is, as long as it does not depend on positions
 * (".case" is generic, so ".case:nth-of-type(3)" would hit unrelated things on other pages).
 */
function isStrongChain(segments) {
  if (segments.some((segment) => segment.kind === KIND.ID || segment.kind === KIND.ATTRIBUTE)) return true;
  return !segments.some((segment) => segment.positional) && segments.some((segment) => segment.kind === KIND.CLASS);
}

/** Shortest "a > b > c" ancestor chain (ending at `element`) that matches only `element`. */
function findUniqueChain(element, root, usePosition) {
  const segments = [];
  const maxDepth = usePosition ? Infinity : SELECTOR_LIMITS.MAX_PATH_DEPTH;

  for (let node = element; node?.nodeType === ELEMENT_NODE && segments.length < maxDepth; node = node.parentElement) {
    segments.push(pathSegment(node, usePosition));
    const selector = segments.map((segment) => segment.selector).reverse().join(' > ');
    if (isOnlyMatch(root, selector, element)) return { selector, strong: isStrongChain(segments) };
  }
  return null;
}

/** "#main .promo": a stable ancestor followed by a descendant selector (any depth in between). */
function findAnchoredDescendant(element, root, ownCompounds) {
  let anchorsTried = 0;
  let node = element.parentElement;

  for (let depth = 0; node && depth < SELECTOR_LIMITS.MAX_ANCHOR_SEARCH_DEPTH; depth++, node = node.parentElement) {
    const anchor = compoundCandidates(node).find((compound) => compound.kind !== KIND.TAG);
    if (!anchor) continue;
    if (++anchorsTried > SELECTOR_LIMITS.MAX_ANCHORS) break;

    for (const own of ownCompounds) {
      const selector = `${anchor.selector} ${own.selector}`;
      if (isOnlyMatch(root, selector, element)) return { selector, strong: true };
    }
  }
  return null;
}

/** First stable selector that also matches a few look-alike elements (repeated ads, cards...). */
function findGroup(element, root, ownCompounds) {
  for (const compound of ownCompounds) {
    if (!GROUPABLE_KINDS.has(compound.kind)) continue;
    const count = countMatches(root, compound.selector);
    if (count > 1 && count <= SELECTOR_LIMITS.MAX_GROUP_MATCHES && matchesInclude(root, compound.selector, element)) {
      return { selector: compound.selector, count };
    }
  }
  return null;
}

/** @returns {{ candidates: Candidate[], group: Group | null }} candidates are unique, best first */
function generateWithinRoot(element, root) {
  const ownCompounds = compoundCandidates(element);
  const found = [];
  const add = (candidate) => {
    if (candidate && !found.some((existing) => existing.selector === candidate.selector)) found.push(candidate);
  };

  for (const compound of ownCompounds) {
    if (isOnlyMatch(root, compound.selector, element)) {
      add({ selector: compound.selector, strong: compound.kind !== KIND.TAG });
    }
  }
  add(findAnchoredDescendant(element, root, ownCompounds));
  add(findUniqueChain(element, root, false));
  // Positional selectors are brittle, so they are only produced when nothing else works.
  if (found.length === 0) add(findUniqueChain(element, root, true));

  // Weak candidates (bare tags, positions) are kept only when nothing stronger exists: as
  // fallbacks they could start matching an unrelated element once the primary selector breaks.
  const strong = found.filter((candidate) => candidate.strong);
  return {
    candidates: (strong.length > 0 ? strong : found).slice(0, SELECTOR_LIMITS.MAX_FALLBACKS + 1),
    group: findGroup(element, root, ownCompounds),
  };
}

/**
 * Entry point. Walks out of open shadow roots, prefixing the host's own selector.
 * @returns {{ candidates: Candidate[], group: Group | null }}
 */
export function generateSelectors(element) {
  const root = element.getRootNode();
  const local = generateWithinRoot(element, root);
  if (!(root instanceof ShadowRoot)) return local;

  const [host] = generateSelectors(root.host).candidates;
  if (!host) return { candidates: [], group: null };

  const prefix = (selector) => `${host.selector}${SHADOW_SEPARATOR}${selector}`;
  return {
    candidates: local.candidates.map((c) => ({ selector: prefix(c.selector), strong: c.strong && host.strong })),
    group: local.group ? { ...local.group, selector: prefix(local.group.selector) } : null,
  };
}
