import { SELECTOR_LIMITS } from '../shared/constants.js';
import { stableClasses, stableId } from './stability-heuristics.js';

/** Human-readable labels and the fingerprint stored next to a rule. */

const MAX_LABEL_CLASSES = 2;
const MAX_LABEL_LENGTH = 70;

function truncate(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

/** First visible words of the element, falling back to descriptive attributes. */
export function getTextSnippet(element) {
  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const fallback = element.getAttribute('aria-label') || element.getAttribute('alt') || element.getAttribute('title') || '';
  return truncate(text || fallback.trim(), SELECTOR_LIMITS.MAX_TEXT_SNIPPET_LENGTH);
}

/** Short CSS-like label such as "div#sidebar.widget.dark". Used for tooltips and the modal. */
export function buildLabel(element) {
  const id = element.id ? `#${element.id}` : '';
  const classes = Array.from(element.classList)
    .slice(0, MAX_LABEL_CLASSES)
    .map((name) => `.${name}`)
    .join('');
  return truncate(`${element.localName}${id}${classes}`, MAX_LABEL_LENGTH);
}

/** Label shown in the settings page: "div.sidebar — Related posts". */
export function buildDescription(element) {
  const snippet = getTextSnippet(element);
  return snippet ? `${buildLabel(element)} — ${snippet}` : buildLabel(element);
}

/** Facts about the element at creation time (informational + used to sanity-check fallbacks). */
export function buildFingerprint(element) {
  return {
    tag: element.localName,
    id: stableId(element),
    classes: stableClasses(element),
    text: getTextSnippet(element),
  };
}
