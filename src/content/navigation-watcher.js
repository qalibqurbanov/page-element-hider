import { TIMING } from '../shared/constants.js';
import { getPageContext } from '../shared/url-matcher.js';

/**
 * Detects URL changes that happen without a page load (single-page apps).
 *
 * A content script lives in an isolated JavaScript world, so it cannot wrap the page's
 * history.pushState. Instead it combines three signals:
 *   - popstate / hashchange                 (back/forward, anchors)
 *   - Navigation API `currententrychange`   (pushState/replaceState, where supported)
 *   - a cheap URL poll                      (safety net for everything else)
 * Duplicate signals are harmless: the callback only fires when the path really changed.
 */
export class NavigationWatcher {
  #onPathChange;
  #lastPath;
  #pollTimer = null;
  #check = () => {
    const path = getPageContext()?.path;
    if (path === undefined || path === this.#lastPath) return;
    this.#lastPath = path;
    this.#onPathChange(path);
  };

  constructor(onPathChange) {
    this.#onPathChange = onPathChange;
    this.#lastPath = getPageContext()?.path;
  }

  start() {
    window.addEventListener('popstate', this.#check);
    window.addEventListener('hashchange', this.#check);
    globalThis.navigation?.addEventListener?.('currententrychange', this.#check);
    this.#pollTimer = setInterval(this.#check, TIMING.URL_POLL_INTERVAL_MS);
  }

  stop() {
    window.removeEventListener('popstate', this.#check);
    window.removeEventListener('hashchange', this.#check);
    globalThis.navigation?.removeEventListener?.('currententrychange', this.#check);
    clearInterval(this.#pollTimer);
  }

  /** Lets other triggers (e.g. DOM mutations) check for a navigation too. */
  check() {
    this.#check();
  }
}
