import { h } from '../../shared/dom-helpers.js';
import { t } from '../../shared/i18n.js';

/** Persistent "selection mode is on" pill with a clickable Cancel (the top frame shows it). */
export class SelectionBanner {
  #uiHost;
  #element = null;

  constructor(uiHost) {
    this.#uiHost = uiHost;
  }

  show(onCancel) {
    this.hide();
    this.#element = h(
      'div',
      { class: 'peh-banner', role: 'status' },
      h('span', { class: 'peh-dot' }),
      h('span', { text: t('bannerText') }),
      h('button', { class: 'peh-link-button', type: 'button', text: t('bannerCancel'), onClick: onCancel }),
    );
    this.#uiHost.getContainer().appendChild(this.#element);
  }

  hide() {
    this.#element?.remove();
    this.#element = null;
  }
}
