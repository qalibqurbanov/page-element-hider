import { h } from '../shared/dom-helpers.js';
import { t } from '../shared/i18n.js';

/**
 * Modal confirmation built on the native <dialog> element (focus trap and Esc come for free).
 * Resolves true only when the confirm button is pressed.
 *
 * @param {{ title: string, message: string, warning?: string, confirmLabel: string, danger?: boolean }} options
 * @returns {Promise<boolean>}
 */
export function confirmAction({ title, message, warning, confirmLabel, danger = false }) {
  return new Promise((resolve) => {
    const cancelButton = h('button', { class: 'button', type: 'button', text: t('dialogCancel') });
    const confirmButton = h('button', {
      class: danger ? 'button button-danger is-solid' : 'button button-primary',
      type: 'button',
      text: confirmLabel,
    });

    const dialog = h(
      'dialog',
      { 'aria-labelledby': 'confirm-title' },
      h('h2', { id: 'confirm-title', text: title }),
      h('p', { text: message }),
      warning && h('p', { class: 'warning', text: warning }),
      h('div', { class: 'dialog-actions' }, cancelButton, confirmButton),
    );

    let confirmed = false;
    confirmButton.addEventListener('click', () => {
      confirmed = true;
      dialog.close();
    });
    cancelButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(confirmed);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    cancelButton.focus(); // the safe choice is focused by default
  });
}
