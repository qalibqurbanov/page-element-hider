/**
 * Central place for every configuration value, storage key and message name.
 * Nothing in here has behaviour; it only keeps magic numbers/strings out of the logic.
 */

export const EXTENSION_NAME = 'Page Element Hider';

/** Keys used in chrome.storage.local. */
export const STORAGE_KEYS = Object.freeze({
  /** Record<ruleId, HiddenRule> */
  RULES: 'rules',
  /** { enabled: boolean, pausedHostnames: string[] } */
  SETTINGS: 'settings',
  /** { ruleIds: string[], at: number } - what the "Undo" button removes */
  LAST_HIDE: 'lastHide',
});

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  pausedHostnames: [],
});

/**
 * How far along a website's URLs a rule applies.
 *
 * Design decision: every rule is ALWAYS bound to a hostname (see rule-model.js).
 * Within that hostname the default is SITE (all paths), because a selector that
 * was stable enough to be saved normally identifies the same component on every
 * page of the same website (header, cookie banner, sidebar...). When the only
 * selector we could build is purely structural (no id/attribute/class), the rule is
 * narrowed to EXACT so it cannot hit unrelated elements on other pages.
 */
export const PATH_MODES = Object.freeze({
  SITE: 'site',
  EXACT: 'exact',
  PATTERN: 'pattern',
});

export const DEFAULT_PATH_CONTEXT = Object.freeze({ mode: PATH_MODES.SITE, value: '' });

/** Separates selector segments that cross an (open) shadow root boundary. */
export const SHADOW_SEPARATOR = ' >>> ';

/** The single declaration that hides an element. */
export const HIDE_DECLARATION = 'display: none !important';

export const SELECTOR_LIMITS = Object.freeze({
  /** A repeated element (e.g. 5 identical ads) can be hidden as a group up to this size. */
  MAX_GROUP_MATCHES: 12,
  /** The "also hide similar elements" box starts checked only for groups up to this size. */
  MAX_GROUP_PRECHECKED: 5,
  /** Extra selectors stored next to the primary one. */
  MAX_FALLBACKS: 3,
  MAX_CLASSES_PER_COMPOUND: 3,
  MAX_ATTRIBUTE_CANDIDATES: 3,
  /** Depth of the structural (class/tag) ancestor chain. The :nth-of-type chain ignores this. */
  MAX_PATH_DEPTH: 8,
  /** How many ancestors are inspected when looking for a stable anchor. */
  MAX_ANCHOR_SEARCH_DEPTH: 12,
  MAX_ANCHORS: 2,
  MAX_CLASS_LENGTH: 40,
  MAX_ATTRIBUTE_VALUE_LENGTH: 80,
  MAX_HREF_LENGTH: 120,
  MAX_TEXT_SNIPPET_LENGTH: 60,
  MAX_STORED_CLASSES: 5,
});

export const TIMING = Object.freeze({
  /** Minimum gap between two rule re-evaluations triggered by DOM mutations. */
  MUTATION_MIN_INTERVAL_MS: 150,
  /** How often the URL is polled for SPA navigations that fire no event we can see. */
  URL_POLL_INTERVAL_MS: 750,
  TOAST_DURATION_MS: 7000,
});

export const MESSAGE_TYPES = Object.freeze({
  /** popup/background -> content: { active: boolean } */
  SET_SELECTION_MODE: 'peh:set-selection-mode',
  /** popup/background -> top frame: replies { selecting: boolean } */
  GET_SELECTION_STATE: 'peh:get-selection-state',
  /** content -> background: ask the background to forward `payload` to another frame */
  RELAY: 'peh:relay',
  /** relayed to the top frame so the modal is never squeezed into a tiny iframe */
  SHOW_CONFIRM: 'peh:show-confirm',
  /** relayed back to the frame that asked for the confirmation */
  CONFIRM_RESULT: 'peh:confirm-result',
  SHOW_TOAST: 'peh:show-toast',
});

export const RELAY_TARGETS = Object.freeze({
  TOP_FRAME: 'top',
  FRAME: 'frame',
  TAB: 'tab',
});

export const TOP_FRAME_ID = 0;
export const SUPPORTED_PROTOCOLS = Object.freeze(['http:', 'https:']);
export const ELEMENT_NODE = 1;
