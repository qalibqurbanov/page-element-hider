import { h } from '../../shared/dom-helpers.js';
import { t, tn } from '../../shared/i18n.js';

const KEY_EVENTS = ['keydown', 'keyup', 'keypress'];

/**
 * "Hide this element?" dialog.
 *
 * Behaviour contract:
 *  - Yes      -> resolves { confirmed: true, hideSimilar }
 *  - Cancel, Esc, or a click on the dimmed backdrop -> resolves { confirmed: false }
 *    (clicking outside never confirms: the destructive-looking action needs an explicit button)
 *  - Keyboard events stop at the dialog so page hotkeys cannot fire while it is open.
 */
export class ConfirmModal {
  #uiHost;
  #close = null;

  constructor(uiHost) {
    this.#uiHost = uiHost;
  }

  get isOpen() {
    return this.#close !== null;
  }

  /**
   * @param {{ label: string, hostname: string, scopeNote: string, similarCount: number, similarPrechecked: boolean }} request
   * @returns {Promise<{ confirmed: boolean, hideSimilar: boolean }>}
   */
  open(request) {
    this.close(); // never stack two dialogs

    return new Promise((resolve) => {
      const previouslyFocused = document.activeElement;
      const hideSimilarInput = h('input', { type: 'checkbox', checked: request.similarPrechecked });
      const cancelButton = h('button', { class: 'peh-button', type: 'button', text: t('dialogCancel') });
      const confirmButton = h('button', { class: 'peh-button peh-button-primary', type: 'button', text: t('modalConfirm') });

      const backdrop = h(
        'div',
        { class: 'peh-backdrop' },
        h(
          'div',
          { class: 'peh-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'peh-title' },
          h('h2', { class: 'peh-title', id: 'peh-title', text: t('modalTitle') }),
          h('p', { class: 'peh-text', text: t('modalText', request.hostname) }),
          h('p', { class: 'peh-element', text: request.label }),
          h('p', { class: 'peh-note', text: request.scopeNote }),
          request.similarCount > 0 &&
            h(
              'label',
              { class: 'peh-checkbox' },
              hideSimilarInput,
              h('span', { text: tn('modalSimilar', request.similarCount) }),
            ),
          h('div', { class: 'peh-actions' }, cancelButton, confirmButton),
        ),
      );
      const dialog = backdrop.firstElementChild;

      const finish = (confirmed) => {
        if (this.#close === null) return;
        this.#close = null;
        backdrop.remove();
        if (previouslyFocused?.isConnected) previouslyFocused.focus?.({ preventScroll: true });
        resolve({ confirmed, hideSimilar: confirmed && request.similarCount > 0 && hideSimilarInput.checked });
      };
      this.#close = () => finish(false);

      cancelButton.addEventListener('click', () => finish(false));
      confirmButton.addEventListener('click', () => finish(true));
      backdrop.addEventListener('click', (event) => {
        if (event.target === backdrop) finish(false);
      });

      for (const type of KEY_EVENTS) {
        dialog.addEventListener(type, (event) => {
          event.stopPropagation();
          if (type !== 'keydown') return;
          if (event.key === 'Escape') {
            event.preventDefault();
            finish(false);
          } else if (event.key === 'Tab') {
            trapFocus(event, dialog);
          }
        });
      }

      this.#uiHost.getContainer().appendChild(backdrop);
      confirmButton.focus({ preventScroll: true });
    });
  }

  /** Cancels the dialog if it is open (e.g. selection mode was left in another frame). */
  close() {
    this.#close?.();
  }
}

function trapFocus(event, dialog) {
  const focusable = Array.from(dialog.querySelectorAll('button, input'));
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = dialog.getRootNode().activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}
