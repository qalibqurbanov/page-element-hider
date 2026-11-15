import { ELEMENT_NODE } from '../shared/constants.js';

/**
 * Calls `onChange` when elements are added to the document (or to observed shadow roots).
 *
 * Performance: only `childList` mutations are observed (no attribute or text noise), records
 * that added no elements are ignored, and calls are throttled. The first call after a quiet
 * period runs synchronously inside the observer callback, i.e. before the browser paints.
 * Bursts are coalesced into one trailing call.
 */
export class DomWatcher {
  #observer;
  #observedRoots = new WeakSet();
  #minIntervalMs;
  #onChange;
  #lastRunAt = 0;
  #timer = null;

  constructor(onChange, { minIntervalMs }) {
    this.#onChange = onChange;
    this.#minIntervalMs = minIntervalMs;
    this.#observer = new MutationObserver((records) => this.#handleRecords(records));
  }

  /** Starts observing a document or open shadow root (idempotent). */
  observe(root) {
    if (this.#observedRoots.has(root)) return;
    this.#observedRoots.add(root);
    this.#observer.observe(root, { childList: true, subtree: true });
  }

  disconnect() {
    this.#observer.disconnect();
    this.#observedRoots = new WeakSet();
    clearTimeout(this.#timer);
    this.#timer = null;
  }

  #handleRecords(records) {
    const addedElements = records.some((record) =>
      Array.from(record.addedNodes).some((node) => node.nodeType === ELEMENT_NODE),
    );
    if (!addedElements) return;

    const waitMs = this.#minIntervalMs - (Date.now() - this.#lastRunAt);
    if (waitMs <= 0) {
      this.#run();
    } else if (this.#timer === null) {
      this.#timer = setTimeout(() => {
        this.#timer = null;
        this.#run();
      }, waitMs);
    }
  }

  #run() {
    this.#lastRunAt = Date.now();
    try {
      this.#onChange();
    } catch (error) {
      console.error('[Page Element Hider] failed to re-apply rules', error);
    }
  }
}
