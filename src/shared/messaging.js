import { api } from './browser-api.js';

/** Thin promise helpers around runtime/tabs messaging. */

/**
 * Registers a message handler. The handler may return a value (sent back as the
 * response) or a promise of one. Returning undefined sends no response.
 */
export function listenForMessages(handler) {
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let result;
    try {
      result = handler(message, sender);
    } catch (error) {
      console.error('[Page Element Hider] message handler failed', error);
      return false;
    }

    if (result && typeof result.then === 'function') {
      result.then(sendResponse, (error) => {
        console.error('[Page Element Hider] async message handler failed', error);
        sendResponse(undefined);
      });
      return true; // keep the channel open for the async response
    }

    if (result !== undefined) sendResponse(result);
    return false;
  });
}

/** Sends to the service worker. Resolves undefined if nobody answered. */
export async function sendToBackground(message) {
  try {
    return await api.runtime.sendMessage(message);
  } catch {
    return undefined;
  }
}

/**
 * Sends to the content scripts of a tab (all frames, or one via `options.frameId`).
 * Never throws: `delivered` is false when no content script was listening
 * (restricted page, or the tab was opened before the extension was installed).
 */
export async function trySendToTab(tabId, message, options) {
  try {
    const response = options
      ? await api.tabs.sendMessage(tabId, message, options)
      : await api.tabs.sendMessage(tabId, message);
    return { delivered: true, response };
  } catch {
    return { delivered: false, response: undefined };
  }
}
