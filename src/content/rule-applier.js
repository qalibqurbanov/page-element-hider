import { ruleAppliesTo } from '../shared/url-matcher.js';
import { resolveRuleTargets } from '../selectors/selector-resolver.js';
import { StyleHost } from './style-host.js';

/**
 * Applies the rules of the current website to the page.
 *
 * Cost model (this is what keeps heavy pages fast):
 *  - A rule whose primary selector matched is `settled`: the browser keeps hiding new matches
 *    through CSS and we never touch it again until a full refresh (navigation, load, rule edit).
 *  - Only unresolved rules (nothing matched yet) and shadow-DOM rules are re-resolved when the
 *    DOM mutates.
 *
 * The applier has no knowledge of storage or observers; the caller drives it.
 */
export class RuleApplier {
  #document;
  #styleHost;
  #rules = [];
  #page = null;
  #active = false;
  /** @type {Map<string, { targets: object[], settled: boolean }>} */
  #results = new Map();

  constructor(document) {
    this.#document = document;
    this.#styleHost = new StyleHost(document);
  }

  setState({ rules, page, active }) {
    this.#rules = rules;
    this.#page = page;
    this.#active = active;
  }

  /**
   * Re-evaluates rules and updates the stylesheets.
   * @param {{ full?: boolean }} options `full` re-resolves every rule instead of only unsettled ones
   * @returns {Set<ShadowRoot>} shadow roots that now contain rules (the caller should observe them)
   */
  refresh({ full = true } = {}) {
    if (!this.#active || !this.#page) {
      this.clear();
      return new Set();
    }

    const nextResults = new Map();
    const selectorsByRoot = new Map();

    for (const rule of this.#applicableRules()) {
      let result = this.#results.get(rule.id);
      if (full || !result || !result.settled) result = resolveRuleTargets(rule, this.#document);
      nextResults.set(rule.id, result);

      for (const { root, selector } of result.targets) {
        if (!selectorsByRoot.has(root)) selectorsByRoot.set(root, []);
        selectorsByRoot.get(root).push(selector);
      }
    }

    this.#results = nextResults;
    for (const [root, selectors] of selectorsByRoot) this.#styleHost.apply(root, selectors);
    this.#styleHost.releaseExcept(new Set(selectorsByRoot.keys()));

    return new Set([...selectorsByRoot.keys()].filter((root) => root !== this.#document));
  }

  /** Removes all hiding from the page. */
  clear() {
    this.#results = new Map();
    this.#styleHost.clear();
  }

  #applicableRules() {
    // Defense in depth: even though only this site's rules are loaded, every rule is
    // checked against the current hostname and path again before it can hide anything.
    return this.#rules.filter((rule) => rule.enabled && ruleAppliesTo(rule, this.#page));
  }
}
