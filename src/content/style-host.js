import { HIDE_DECLARATION } from '../shared/constants.js';
import { createManagedSheet } from './managed-sheet.js';

/**
 * Owns one hiding stylesheet per root (the document and any shadow roots with rules).
 *
 * Hiding is pure CSS (`display: none !important`): the DOM is never modified or removed, so
 * the site's own scripts keep working, and elements inserted later are hidden by the browser's
 * style engine immediately - before first paint - with no JavaScript involved.
 */
export class StyleHost {
  #ownerDocument;
  /** @type {Map<Document|ShadowRoot, { sheet: ReturnType<typeof createManagedSheet>, css: string|null }>} */
  #entries = new Map();

  constructor(ownerDocument) {
    this.#ownerDocument = ownerDocument;
  }

  /** Makes `root` hide exactly the elements matching `selectors`. */
  apply(root, selectors) {
    const css = buildCss(selectors);
    let entry = this.#entries.get(root);
    if (!entry) {
      entry = { sheet: createManagedSheet(root, this.#ownerDocument), css: null };
      this.#entries.set(root, entry);
    }
    entry.sheet.ensureAttached();
    if (entry.css !== css) {
      entry.sheet.write(css);
      entry.css = css;
    }
  }

  /** Removes the stylesheets of every root that is not in `activeRoots`. */
  releaseExcept(activeRoots) {
    for (const [root, entry] of this.#entries) {
      if (!activeRoots.has(root)) {
        entry.sheet.remove();
        this.#entries.delete(root);
      }
    }
  }

  clear() {
    this.releaseExcept(new Set());
  }
}

/** One CSS rule per selector so a single bad selector can never invalidate the others. */
function buildCss(selectors) {
  return [...new Set(selectors)]
    .sort()
    .map((selector) => `${selector} { ${HIDE_DECLARATION}; }`)
    .join('\n');
}
