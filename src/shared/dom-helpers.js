/**
 * Tiny hyperscript helper used by every UI (popup, options, in-page widgets).
 * Always uses textContent for strings - rule data originates from arbitrary web
 * pages, so it must never be interpreted as HTML.
 */

/** Keys that must be set as properties (not attributes) to behave correctly. */
const PROPERTY_KEYS = new Set(['value', 'checked', 'disabled', 'hidden', 'selected', 'open', 'indeterminate']);

export function h(tag, props, ...children) {
  const element = document.createElement(tag);

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === undefined || value === null) continue;
    if (key === 'class') {
      element.className = value;
    } else if (key === 'text') {
      element.textContent = value;
    } else if (key.startsWith('on') && typeof value === 'function') {
      element.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (PROPERTY_KEYS.has(key)) {
      element[key] = value;
    } else if (value !== false) {
      element.setAttribute(key, value === true ? '' : String(value));
    }
  }

  appendChildren(element, children);
  return element;
}

function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Removes all children of `element` and appends `children`. */
export function replaceChildren(element, ...children) {
  element.replaceChildren();
  appendChildren(element, children);
}
