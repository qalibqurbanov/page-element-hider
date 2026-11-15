/**
 * A stylesheet attached to a document or shadow root.
 *
 * Preferred: a constructed stylesheet in `adoptedStyleSheets`. It adds no DOM nodes and is
 * not subject to the page's Content-Security-Policy (`style-src`).
 * Fallback: a <style> element, for browsers that refuse adopting sheets created in the
 * content-script world. Extension-injected <style> elements are exempt from page CSP in
 * Chromium; where a browser still blocks them, hiding degrades gracefully (documented in the README).
 */

function createAdoptedSheet(root) {
  if (!('adoptedStyleSheets' in root) || typeof CSSStyleSheet !== 'function') return null;
  try {
    const sheet = new CSSStyleSheet();
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return {
      write: (css) => sheet.replaceSync(css),
      // Pages occasionally reassign adoptedStyleSheets; re-attach if our sheet was dropped.
      ensureAttached() {
        if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      },
      remove() {
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter((candidate) => candidate !== sheet);
      },
    };
  } catch {
    return null;
  }
}

function createStyleElementSheet(root, ownerDocument) {
  const style = ownerDocument.createElement('style');
  style.setAttribute('data-page-element-hider', '');
  const parent = () => (root === ownerDocument ? ownerDocument.documentElement : root);

  const ensureAttached = () => {
    const container = parent();
    if (container && !style.isConnected) container.appendChild(style);
  };
  ensureAttached();

  return {
    write: (css) => {
      style.textContent = css;
    },
    ensureAttached,
    remove: () => style.remove(),
  };
}

/** @returns {{ write(css: string): void, ensureAttached(): void, remove(): void }} */
export function createManagedSheet(root, ownerDocument) {
  return createAdoptedSheet(root) ?? createStyleElementSheet(root, ownerDocument);
}
