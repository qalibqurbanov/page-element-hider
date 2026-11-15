import { h, replaceChildren } from '../shared/dom-helpers.js';
import { t, tn } from '../shared/i18n.js';
import { describePathContext } from '../shared/url-matcher.js';

const DATE_FORMAT = { dateStyle: 'medium', timeStyle: 'short' };

/**
 * Renders the rules grouped by website. Pure view: it receives data and callbacks and
 * never talks to storage.
 *
 * @typedef {{
 *   onToggleRule: (rule: object, enabled: boolean) => void,
 *   onEditRule: (rule: object) => void,
 *   onDeleteRule: (rule: object) => void,
 *   onToggleSite: (hostname: string, active: boolean) => void,
 *   onDeleteSite: (hostname: string, count: number) => void,
 * }} Handlers
 */
export class RuleListView {
  #container;
  #handlers;

  /** @param {HTMLElement} container @param {Handlers} handlers */
  constructor(container, handlers) {
    this.#container = container;
    this.#handlers = handlers;
  }

  /**
   * @param {{ rules: object[], totalCount: number, pausedHostnames: string[] }} data
   *   `rules` are the already-filtered rules, `totalCount` is the unfiltered number.
   */
  render({ rules, totalCount, pausedHostnames }) {
    if (totalCount === 0) {
      replaceChildren(this.#container, emptyState(t('listEmptyTitle'), t('listEmptyText')));
      return;
    }
    if (rules.length === 0) {
      replaceChildren(this.#container, emptyState(t('listNoMatchTitle'), t('listNoMatchText')));
      return;
    }

    const groups = groupByHostname(rules);
    replaceChildren(
      this.#container,
      groups.map(([hostname, siteRules]) => this.#renderSite(hostname, siteRules, !pausedHostnames.includes(hostname))),
    );
  }

  #renderSite(hostname, rules, isActive) {
    return h(
      'section',
      { class: 'site-group' },
      h(
        'header',
        { class: 'site-header' },
        h('h2', { class: 'site-title' }, hostname, h('span', { class: 'muted', text: tn('listRuleCount', rules.length) })),
        h(
          'div',
          { class: 'site-controls' },
          h(
            'label',
            { class: 'switch-row' },
            h('input', {
              class: 'switch',
              type: 'checkbox',
              role: 'switch',
              checked: isActive,
              onChange: (event) => this.#handlers.onToggleSite(hostname, event.target.checked),
            }),
            h('span', { text: t('listSiteActive') }),
          ),
          h('button', { class: 'button button-small button-danger', type: 'button', text: t('listRemoveAll'), onClick: () => this.#handlers.onDeleteSite(hostname, rules.length) }),
        ),
      ),
      rules.map((rule) => this.#renderRule(rule)),
    );
  }

  #renderRule(rule) {
    const created = new Date(rule.createdAt).toLocaleString(undefined, DATE_FORMAT);
    const scope = `${describePathContext(rule.pathContext)}${rule.includeSubdomains ? t('listSubdomainsSuffix') : ''}`;

    return h(
      'article',
      { class: `rule${rule.enabled ? '' : ' is-disabled'}` },
      h('input', {
        class: 'switch',
        type: 'checkbox',
        role: 'switch',
        'aria-label': t('listRuleEnabled'),
        checked: rule.enabled,
        onChange: (event) => this.#handlers.onToggleRule(rule, event.target.checked),
      }),
      h(
        'div',
        { class: 'rule-body' },
        h('p', { class: 'rule-title', text: rule.description || t('listNoDescription') }),
        h('p', { class: 'rule-meta', text: t('listMeta', scope, created, rule.createdOnPath) }),
        h('code', { class: 'rule-selector', text: rule.selector }),
        rule.fallbackSelectors.length > 0 &&
          h(
            'details',
            { class: 'rule-fallbacks' },
            h('summary', { text: tn('listFallbacks', rule.fallbackSelectors.length) }),
            rule.fallbackSelectors.map((selector) => h('code', { text: selector })),
          ),
      ),
      h(
        'div',
        { class: 'rule-actions' },
        h('button', { class: 'button button-small', type: 'button', text: t('listEdit'), onClick: () => this.#handlers.onEditRule(rule) }),
        h('button', { class: 'button button-small button-danger', type: 'button', text: t('listDelete'), onClick: () => this.#handlers.onDeleteRule(rule) }),
      ),
    );
  }
}

function emptyState(title, text) {
  return h('div', { class: 'empty' }, h('strong', { text: title }), h('p', { text }));
}

/** @returns {[string, object[]][]} sorted by hostname */
function groupByHostname(rules) {
  const groups = new Map();
  for (const rule of rules) {
    if (!groups.has(rule.hostname)) groups.set(rule.hostname, []);
    groups.get(rule.hostname).push(rule);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
