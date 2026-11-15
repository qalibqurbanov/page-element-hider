import { DEFAULT_PATH_CONTEXT, PATH_MODES, SELECTOR_LIMITS } from '../shared/constants.js';
import { t } from '../shared/i18n.js';
import { buildDescription, buildFingerprint, buildLabel } from '../selectors/element-description.js';
import { generateSelectors } from '../selectors/selector-generator.js';
import { queryAllBySelector } from '../selectors/selector-resolver.js';
import { createRule } from '../storage/rule-model.js';

export const HIDE_OUTCOME = Object.freeze({ HIDDEN: 'hidden', CANCELLED: 'cancelled', FAILED: 'failed' });

function describeScope({ hostname, isStructuralOnly, hasSimilar }) {
  if (!isStructuralOnly) return t('hideScopeSite', hostname);
  return hasSimilar ? t('hideScopeMixed', hostname) : t('hideScopePage');
}

/**
 * What happens after the user clicks an element: build a rule, ask for confirmation,
 * save it, and tell the user. Knows nothing about events or rendering.
 */
export class HideFlow {
  #page;
  #ruleStore;
  #highlighter;
  #bridge;

  constructor({ page, ruleStore, highlighter, bridge }) {
    this.#page = page;
    this.#ruleStore = ruleStore;
    this.#highlighter = highlighter;
    this.#bridge = bridge;
  }

  /** Called when an SPA navigation changes the page path. */
  setPage(page) {
    this.#page = page;
  }

  async run(element) {
    try {
      const { candidates, group } = generateSelectors(element);
      if (candidates.length === 0 && !group) throw new Error('No selector could be generated.');

      const similar = group ? queryAllBySelector(group.selector, document).filter((match) => match !== element) : [];
      this.#highlighter.showSimilar(similar);

      const answer = await this.#bridge.requestConfirmation({
        label: buildLabel(element),
        hostname: this.#page.hostname,
        scopeNote: describeScope({
          hostname: this.#page.hostname,
          isStructuralOnly: candidates[0]?.strong === false,
          hasSimilar: similar.length > 0,
        }),
        similarCount: similar.length,
        // Big groups (e.g. every ".btn") are offered but not pre-selected, to avoid surprises.
        similarPrechecked: similar.length <= SELECTOR_LIMITS.MAX_GROUP_PRECHECKED,
      });
      this.#highlighter.clear();
      if (!answer.confirmed) return HIDE_OUTCOME.CANCELLED;

      const rule = this.#buildRule(element, candidates, group, answer.hideSimilar && similar.length > 0);
      await this.#ruleStore.add(rule);
      this.#bridge.showToast({ message: t('hideToastHidden'), withUndo: true });
      return HIDE_OUTCOME.HIDDEN;
    } catch (error) {
      console.error('[Page Element Hider] could not hide element', error);
      this.#highlighter.clear();
      this.#bridge.showToast({ message: t('hideToastFailed'), withUndo: false });
      return HIDE_OUTCOME.FAILED;
    }
  }

  #buildRule(element, candidates, group, hideSimilar) {
    const uniqueSelectors = candidates.map((candidate) => candidate.selector);
    const [selector, ...fallbackSelectors] = hideSimilar ? [group.selector, ...uniqueSelectors] : uniqueSelectors;

    // A purely structural selector may point at something else on other pages of the site,
    // so such rules are limited to the page they were created on.
    const isStructuralOnly = !hideSimilar && candidates[0]?.strong === false;
    const pathContext = isStructuralOnly ? { mode: PATH_MODES.EXACT, value: this.#page.path } : DEFAULT_PATH_CONTEXT;

    return createRule({
      hostname: this.#page.hostname,
      pathContext,
      createdOnPath: this.#page.path,
      selector,
      fallbackSelectors,
      fingerprint: buildFingerprint(element),
      description: buildDescription(element),
    });
  }
}
