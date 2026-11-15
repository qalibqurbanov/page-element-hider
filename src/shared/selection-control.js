import { MESSAGE_TYPES, TOP_FRAME_ID } from './constants.js';
import { trySendToTab } from './messaging.js';

/**
 * Starting/stopping element selection mode in a tab. Shared by the popup and the
 * keyboard-shortcut handler in the service worker.
 */

/** `available` is false when the tab has no content script (restricted page / needs reload). */
export async function getSelectionState(tabId) {
  const { delivered, response } = await trySendToTab(
    tabId,
    { type: MESSAGE_TYPES.GET_SELECTION_STATE },
    { frameId: TOP_FRAME_ID },
  );
  return { available: delivered && Boolean(response), selecting: Boolean(response?.selecting) };
}

/** Tells every frame of the tab to enter/leave selection mode. Returns whether anyone listened. */
export async function setSelectionMode(tabId, active) {
  const { delivered } = await trySendToTab(tabId, { type: MESSAGE_TYPES.SET_SELECTION_MODE, active });
  return delivered;
}

export async function toggleSelectionMode(tabId) {
  const { available, selecting } = await getSelectionState(tabId);
  if (!available) return false;
  return setSelectionMode(tabId, !selecting);
}
