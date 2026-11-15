import { TIMING } from '../../shared/constants.js';
import { h } from '../../shared/dom-helpers.js';

/** Small bottom-center notification with an optional action button (used for "Undo"). */
export class Toast {
  #uiHost;
  #element = null;
  #timer = null;

  constructor(uiHost) {
    this.#uiHost = uiHost;
  }

  /** @param {{ message: string, actionLabel?: string, onAction?: () => void }} options */
  show({ message, actionLabel, onAction }) {
    this.hide();

    const actionButton =
      actionLabel &&
      h('button', {
        class: 'peh-link-button',
        type: 'button',
        text: actionLabel,
        onClick: () => {
          this.hide();
          onAction?.();
        },
      });

    this.#element = h('div', { class: 'peh-toast', role: 'status', 'aria-live': 'polite' }, h('span', { text: message }), actionButton);
    this.#uiHost.getContainer().appendChild(this.#element);
    this.#timer = setTimeout(() => this.hide(), TIMING.TOAST_DURATION_MS);
  }

  hide() {
    clearTimeout(this.#timer);
    this.#element?.remove();
    this.#element = null;
  }
}
