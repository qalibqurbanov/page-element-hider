import { createManagedSheet } from '../managed-sheet.js';
import { UI_CSS } from './ui-styles.js';

const HOST_TAG = 'page-element-hider-ui';
const MAX_Z_INDEX = '2147483647';

/**
 * The inline styles are marked !important so no page stylesheet can move, hide or restyle the host;
 * `all: initial` stops inherited properties (fonts, colors...) leaking into the shadow tree.
 * Set through the CSSOM (not a style attribute) so strict CSPs do not block them.
 */
const HOST_STYLES = [
  ['all', 'initial'],
  ['display', 'block'],
  ['position', 'fixed'],
  ['top', '0'],
  ['left', '0'],
  ['width', '0'],
  ['height', '0'],
  ['overflow', 'visible'],
  ['z-index', MAX_Z_INDEX],
  ['pointer-events', 'none'],
];

/**
 * One isolated container (closed shadow root) shared by every in-page widget
 * (highlight, modal, toast, banner). Created lazily and recreated if a page removes it.
 */
export class UiHost {
  #document;
  #host = null;
  #container = null;

  constructor(document) {
    this.#document = document;
  }

  /** Mount point inside the shadow root. */
  getContainer() {
    if (!this.#host?.isConnected) this.#build();
    return this.#container;
  }

  /** True if an event path passes through our UI (so selection mode must not swallow it). */
  ownsEventPath(path) {
    return this.#host !== null && path.includes(this.#host);
  }

  #build() {
    const host = this.#document.createElement(HOST_TAG);
    for (const [property, value] of HOST_STYLES) host.style.setProperty(property, value, 'important');

    const shadowRoot = host.attachShadow({ mode: 'closed' });
    createManagedSheet(shadowRoot, this.#document).write(UI_CSS);

    const container = this.#document.createElement('div');
    container.className = 'peh-root';
    shadowRoot.appendChild(container);

    this.#document.documentElement.appendChild(host);
    this.#host = host;
    this.#container = container;
  }
}
