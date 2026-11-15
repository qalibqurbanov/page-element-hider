import { h } from '../../shared/dom-helpers.js';

const VIEWPORT_MARGIN_PX = 4;
const TOOLTIP_GAP_PX = 6;
const FALLBACK_TOOLTIP_HEIGHT_PX = 28;

/**
 * Draws the selection highlight and the "Click to hide" tooltip as fixed-position overlays
 * inside the extension's shadow root. The page's own elements are never touched, and because
 * positions come from getBoundingClientRect() it also works for fixed/sticky/transformed elements.
 */
export class Highlighter {
  #uiHost;
  #target = null;
  #box = null;
  #tooltip = null;
  #tooltipLabel = null;
  #similarElements = [];
  #similarBoxes = [];
  #frameRequest = 0;

  constructor(uiHost) {
    this.#uiHost = uiHost;
  }

  show(element, label) {
    this.#ensureNodes();
    this.#target = element;
    this.#tooltipLabel.textContent = label;
    this.#startTracking();
    this.#reposition();
  }

  /** Outlines look-alike elements that would be hidden together with the selected one. */
  showSimilar(elements) {
    this.#similarElements = elements;
    this.#startTracking();
    this.#reposition();
  }

  clear() {
    this.#target = null;
    this.#similarElements = [];
    this.#stopTracking();
    this.#box?.remove();
    this.#tooltip?.remove();
    this.#box = this.#tooltip = this.#tooltipLabel = null;
    for (const box of this.#similarBoxes) box.remove();
    this.#similarBoxes = [];
  }

  #ensureNodes() {
    const container = this.#uiHost.getContainer();
    if (this.#box?.isConnected) return;
    this.#tooltipLabel = h('span', { class: 'peh-tooltip-label' });
    this.#box = h('div', { class: 'peh-box' });
    this.#tooltip = h(
      'div',
      { class: 'peh-tooltip' },
      h('span', { class: 'peh-tooltip-action', text: 'Click to hide' }),
      this.#tooltipLabel,
      h('span', { class: 'peh-tooltip-hint', text: '↑ parent · Esc cancel' }),
    );
    container.append(this.#box, this.#tooltip);
  }

  #startTracking() {
    window.addEventListener('scroll', this.#scheduleReposition, true);
    window.addEventListener('resize', this.#scheduleReposition);
  }

  #stopTracking() {
    window.removeEventListener('scroll', this.#scheduleReposition, true);
    window.removeEventListener('resize', this.#scheduleReposition);
    cancelAnimationFrame(this.#frameRequest);
    this.#frameRequest = 0;
  }

  #scheduleReposition = () => {
    if (this.#frameRequest) return;
    this.#frameRequest = requestAnimationFrame(() => {
      this.#frameRequest = 0;
      this.#reposition();
    });
  };

  #reposition() {
    if (this.#target && this.#box) this.#positionTarget();
    this.#positionSimilar();
  }

  #positionTarget() {
    const rect = this.#target.getBoundingClientRect();
    const visible = this.#target.isConnected && (rect.width > 0 || rect.height > 0);
    this.#box.style.display = this.#tooltip.style.display = visible ? '' : 'none';
    if (!visible) return;

    placeBox(this.#box, rect);

    const tooltipHeight = this.#tooltip.offsetHeight || FALLBACK_TOOLTIP_HEIGHT_PX;
    const tooltipWidth = this.#tooltip.offsetWidth;
    const above = rect.top - tooltipHeight - TOOLTIP_GAP_PX;
    const top = above >= VIEWPORT_MARGIN_PX ? above : Math.min(rect.bottom + TOOLTIP_GAP_PX, window.innerHeight - tooltipHeight - VIEWPORT_MARGIN_PX);
    const left = Math.max(VIEWPORT_MARGIN_PX, Math.min(rect.left, window.innerWidth - tooltipWidth - VIEWPORT_MARGIN_PX));
    this.#tooltip.style.top = `${Math.max(VIEWPORT_MARGIN_PX, top)}px`;
    this.#tooltip.style.left = `${left}px`;
  }

  #positionSimilar() {
    const container = this.#uiHost.getContainer();
    while (this.#similarBoxes.length < this.#similarElements.length) {
      const box = h('div', { class: 'peh-box peh-similar' });
      container.appendChild(box);
      this.#similarBoxes.push(box);
    }
    while (this.#similarBoxes.length > this.#similarElements.length) this.#similarBoxes.pop().remove();

    this.#similarElements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const box = this.#similarBoxes[index];
      box.style.display = element.isConnected && rect.width > 0 ? '' : 'none';
      placeBox(box, rect);
    });
  }
}

function placeBox(box, rect) {
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}
