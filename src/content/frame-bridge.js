import { MESSAGE_TYPES, RELAY_TARGETS } from '../shared/constants.js';
import { t } from '../shared/i18n.js';
import { sendToBackground } from '../shared/messaging.js';

/**
 * Makes the confirmation modal and toast appear in the TOP frame even when the clicked element
 * lives in an iframe (a 300x250 ad frame has no room for a dialog).
 *
 *   iframe ──SHOW_CONFIRM──▶ service worker ──▶ top frame (modal) ──CONFIRM_RESULT──▶ iframe
 *
 * Content scripts cannot message each other directly, so the service worker relays.
 * If the top frame cannot be reached, the UI falls back to the frame the click happened in.
 */
export class FrameBridge {
  #isTopFrame;
  #modal;
  #toast;
  #onUndo;
  /** @type {Map<string, (result: object) => void>} */
  #pendingConfirmations = new Map();

  constructor({ isTopFrame, modal, toast, onUndo }) {
    this.#isTopFrame = isTopFrame;
    this.#modal = modal;
    this.#toast = toast;
    this.#onUndo = onUndo;
  }

  /** @returns {Promise<{ confirmed: boolean, hideSimilar: boolean }>} */
  async requestConfirmation(request) {
    if (this.#isTopFrame) return this.#modal.open(request);

    const requestId = crypto.randomUUID();
    const answer = new Promise((resolve) => this.#pendingConfirmations.set(requestId, resolve));
    const relayed = await this.#relayToTop({ type: MESSAGE_TYPES.SHOW_CONFIRM, requestId, request });

    if (!relayed?.delivered) {
      this.#pendingConfirmations.delete(requestId);
      return this.#modal.open(request);
    }
    return answer;
  }

  /** @param {{ message: string, withUndo: boolean }} options */
  async showToast(options) {
    if (this.#isTopFrame) {
      this.#renderToast(options);
      return;
    }
    const relayed = await this.#relayToTop({ type: MESSAGE_TYPES.SHOW_TOAST, ...options });
    if (!relayed?.delivered) this.#renderToast(options);
  }

  /** Handles relayed messages. Returns true if the message was one of ours. */
  handleMessage(message) {
    switch (message.type) {
      case MESSAGE_TYPES.SHOW_CONFIRM:
        if (this.#isTopFrame) this.#answerConfirmation(message);
        return true;
      case MESSAGE_TYPES.CONFIRM_RESULT:
        this.#pendingConfirmations.get(message.requestId)?.(message.result);
        this.#pendingConfirmations.delete(message.requestId);
        return true;
      case MESSAGE_TYPES.SHOW_TOAST:
        if (this.#isTopFrame) this.#renderToast(message);
        return true;
      default:
        return false;
    }
  }

  async #answerConfirmation({ requestId, request, sourceFrameId }) {
    const result = await this.#modal.open(request);
    await sendToBackground({
      type: MESSAGE_TYPES.RELAY,
      target: RELAY_TARGETS.FRAME,
      frameId: sourceFrameId,
      payload: { type: MESSAGE_TYPES.CONFIRM_RESULT, requestId, result },
    });
  }

  #renderToast({ message, withUndo }) {
    this.#toast.show({
      message,
      actionLabel: withUndo ? t('toastUndo') : undefined,
      onAction: withUndo ? this.#onUndo : undefined,
    });
  }

  #relayToTop(payload) {
    return sendToBackground({ type: MESSAGE_TYPES.RELAY, target: RELAY_TARGETS.TOP_FRAME, payload });
  }
}
