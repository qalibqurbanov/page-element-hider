import { api } from '../shared/browser-api.js';
import { MESSAGE_TYPES, RELAY_TARGETS, TOP_FRAME_ID } from '../shared/constants.js';
import { listenForMessages, trySendToTab } from '../shared/messaging.js';
import { toggleSelectionMode } from '../shared/selection-control.js';
import { t } from '../shared/i18n.js';
import { SettingsStore } from '../storage/settings-store.js';

/**
 * Background service worker. It is intentionally thin and stateless (MV3 workers are
 * suspended at any time):
 *   1. relays messages between frames of a tab (content scripts cannot reach each other),
 *   2. handles the keyboard shortcut,
 *   3. shows an "OFF" badge while hiding is globally disabled.
 * All listeners are registered synchronously at top level, as MV3 requires.
 */

const COMMANDS = Object.freeze({ TOGGLE_SELECTION: 'toggle-selection-mode' });
const BADGE_OFF_COLOR = '#6b7280';

const settingsStore = new SettingsStore();

listenForMessages((message, sender) => {
  if (message.type === MESSAGE_TYPES.RELAY) return relayMessage(message, sender);
  return undefined;
});

api.commands.onCommand.addListener(async (command, tab) => {
  if (command !== COMMANDS.TOGGLE_SELECTION) return;
  const tabId = tab?.id ?? (await getActiveTabId());
  if (tabId !== undefined) await toggleSelectionMode(tabId);
});

settingsStore.onChange(updateBadge);
updateBadge(); // runs whenever the worker (re)starts, so the badge is always correct

/**
 * Forwards `message.payload` to the top frame, one specific frame, or every frame of the
 * sender's tab. Top-frame messages are stamped with the sender's frame id so the answer
 * can be routed back.
 */
async function relayMessage(message, sender) {
  const tabId = sender.tab?.id;
  if (tabId === undefined) return { delivered: false };

  switch (message.target) {
    case RELAY_TARGETS.TOP_FRAME:
      return deliver(tabId, { ...message.payload, sourceFrameId: sender.frameId }, { frameId: TOP_FRAME_ID });
    case RELAY_TARGETS.FRAME:
      return deliver(tabId, message.payload, { frameId: message.frameId });
    case RELAY_TARGETS.TAB:
      return deliver(tabId, message.payload);
    default:
      return { delivered: false };
  }
}

async function deliver(tabId, payload, options) {
  const { delivered } = await trySendToTab(tabId, payload, options);
  return { delivered };
}

async function getActiveTabId() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function updateBadge() {
  try {
    const { enabled } = await settingsStore.get();
    await api.action.setBadgeText({ text: enabled ? '' : t('badgeOff') });
    if (!enabled) await api.action.setBadgeBackgroundColor({ color: BADGE_OFF_COLOR });
  } catch (error) {
    console.error('[Page Element Hider] could not update badge', error);
  }
}
