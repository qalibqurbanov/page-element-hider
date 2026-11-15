import { ELEMENT_NODE } from '../shared/constants.js';
import { buildLabel } from '../selectors/element-description.js';

const STATE = Object.freeze({ IDLE: 'idle', HOVERING: 'hovering', CONFIRMING: 'confirming' });

/** Pointer/mouse events whose default action AND page handlers must be suppressed. */
const BLOCKED_ACTION_EVENTS = ['click', 'dblclick', 'auxclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'];
/** Hover chatter that would make page menus pop open under the picker; stopped but not prevented. */
const BLOCKED_HOVER_EVENTS = ['mouseover', 'mouseout', 'mouseenter', 'mouseleave', 'pointerover', 'pointerout', 'pointerenter', 'pointerleave'];
const TRACKED_EVENTS = ['mousemove'];
const ALL_POINTER_EVENTS = [...BLOCKED_ACTION_EVENTS, ...BLOCKED_HOVER_EVENTS, ...TRACKED_EVENTS];

const FRAME_TAGS = new Set(['iframe', 'frame']);

const KEYS = Object.freeze({ CANCEL: 'Escape', PARENT: 'ArrowUp', CHILD: 'ArrowDown', SELECT: 'Enter' });

/**
 * The element picker.
 *
 * While active it listens on `window` in the CAPTURE phase, so it sees every pointer event
 * before the page's own handlers. Clicks/presses are cancelled and stopped, which is what
 * prevents links from being followed, forms from being submitted and buttons from firing.
 * (Limitation: a page that registered its own window-level capture listener earlier can still
 * observe the event; default actions are prevented regardless.)
 *
 * States: HOVERING (highlighting under the cursor) -> CONFIRMING (an element was clicked and
 * the modal is open) -> back to HOVERING via `resume()` if the user cancels.
 */
export class SelectionMode {
  #state = STATE.IDLE;
  #current = null;
  /** Elements we climbed out of with ArrowUp, so ArrowDown can climb back. */
  #descendants = [];
  #pendingTarget = null;
  #frameRequest = 0;
  #hasRequestedFocus = false;

  #highlighter;
  #uiHost;
  #onSelect;
  #onExit;

  constructor({ highlighter, uiHost, onSelect, onExit }) {
    this.#highlighter = highlighter;
    this.#uiHost = uiHost;
    this.#onSelect = onSelect;
    this.#onExit = onExit;
  }

  get active() {
    return this.#state !== STATE.IDLE;
  }

  start() {
    if (this.active) return;
    this.#state = STATE.HOVERING;
    this.#hasRequestedFocus = false;
    for (const type of ALL_POINTER_EVENTS) window.addEventListener(type, this.#onPointerEvent, true);
    window.addEventListener('keydown', this.#onKeyDown, true);
  }

  stop() {
    if (!this.active) return;
    for (const type of ALL_POINTER_EVENTS) window.removeEventListener(type, this.#onPointerEvent, true);
    window.removeEventListener('keydown', this.#onKeyDown, true);
    cancelAnimationFrame(this.#frameRequest);
    this.#frameRequest = 0;
    this.#state = STATE.IDLE;
    this.#clearCurrent();
  }

  /** The user cancelled the confirmation: keep picking. */
  resume() {
    if (this.#state !== STATE.CONFIRMING) return;
    this.#state = STATE.HOVERING;
    this.#clearCurrent();
  }

  #onPointerEvent = (event) => {
    if (this.#uiHost.ownsEventPath(event.composedPath())) return; // let our own modal work

    if (event.type === 'mousemove') {
      this.#trackPointer(event);
      return;
    }

    event.stopImmediatePropagation();
    if (BLOCKED_ACTION_EVENTS.includes(event.type)) event.preventDefault();

    if (event.type === 'click') this.#handleClick(event);
    // The pointer left the frame/window: drop the highlight so it is not left dangling.
    if (event.type === 'mouseout' && event.relatedTarget === null && this.#state === STATE.HOVERING) {
      this.#clearCurrent();
    }
  };

  #trackPointer(event) {
    if (this.#state !== STATE.HOVERING) return;
    this.#requestFrameFocus();

    // composedPath() is only valid during dispatch, so resolve the target immediately.
    this.#pendingTarget = pickTarget(event);
    if (this.#frameRequest) return;
    this.#frameRequest = requestAnimationFrame(() => {
      this.#frameRequest = 0;
      if (this.#state === STATE.HOVERING) this.#setCurrent(this.#pendingTarget);
    });
  }

  /** Esc only reaches the focused frame, so an iframe asks for focus once the mouse enters it. */
  #requestFrameFocus() {
    if (this.#hasRequestedFocus || window === window.top) return;
    this.#hasRequestedFocus = true;
    if (!document.hasFocus()) window.focus();
  }

  #handleClick(event) {
    if (this.#state !== STATE.HOVERING || !event.isTrusted) return;

    // Keep a parent chosen with ArrowUp if the click landed inside it.
    const clicked = pickTarget(event);
    if (clicked && !(this.#current && containsComposed(this.#current, clicked))) this.#current = clicked;
    if (!this.#current) return;

    this.#state = STATE.CONFIRMING;
    this.#onSelect(this.#current);
  }

  #onKeyDown = (event) => {
    if (this.#uiHost.ownsEventPath(event.composedPath())) return; // the modal handles its own keys

    if (event.key === KEYS.CANCEL) {
      consume(event);
      this.#onExit();
      return;
    }
    if (this.#state !== STATE.HOVERING || !this.#current) return;

    switch (event.key) {
      case KEYS.PARENT: {
        const parent = getParent(this.#current);
        if (parent && isSelectable(parent)) {
          this.#descendants.push(this.#current);
          this.#showCurrent(parent);
        }
        consume(event);
        break;
      }
      case KEYS.CHILD: {
        const child = this.#descendants.pop();
        if (child) this.#showCurrent(child);
        consume(event);
        break;
      }
      case KEYS.SELECT:
        consume(event);
        this.#state = STATE.CONFIRMING;
        this.#onSelect(this.#current);
        break;
    }
  };

  #setCurrent(element) {
    if (element === this.#current) return;
    this.#descendants = [];
    if (element) this.#showCurrent(element);
    else this.#clearCurrent();
  }

  #showCurrent(element) {
    this.#current = element;
    this.#highlighter.show(element, buildLabel(element));
  }

  #clearCurrent() {
    this.#current = null;
    this.#descendants = [];
    this.#highlighter.clear();
  }
}

function consume(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

/** The element the user is actually pointing at (innermost, including open shadow DOM). */
function pickTarget(event) {
  const origin = event.composedPath().find((node) => node.nodeType === ELEMENT_NODE);
  if (!origin) return null;
  const element = outermostSvg(origin) ?? origin;
  return isSelectable(element) ? element : null;
}

/** Icons are made of many <path>s; the whole <svg> is the thing a person means. */
function outermostSvg(element) {
  let svg = element.closest?.('svg') ?? null;
  while (svg?.parentElement?.closest('svg')) svg = svg.parentElement.closest('svg');
  return svg;
}

/**
 * Not selectable:
 *  - <html>/<body>: hiding them would blank the page and trap the user;
 *  - <iframe>/<frame>: the pointer is over a different document, which has its own copy of
 *    the extension and handles that area (the parent never receives events there, so it
 *    could not even clear a highlight when the pointer moved on).
 */
function isSelectable(element) {
  return element !== document.documentElement && element !== document.body && !FRAME_TAGS.has(element.localName);
}

function getParent(element) {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

function containsComposed(ancestor, node) {
  for (let current = node; current; current = getParent(current)) {
    if (current === ancestor) return true;
  }
  return false;
}
