import { h, replaceChildren } from '../shared/dom-helpers.js';
import { currentLanguage, t, tn } from '../shared/i18n.js';
import { describePathContext } from '../shared/url-matcher.js';
import { icon } from './icons.js';

const NAME_SEPARATOR = ' — ';

/**
 * Rules created by picking an element are named "<element label> — <visible text>"
 * (see buildDescription). Show the visible text as the title and the element label as a
 * small code chip, instead of one string joined by a dash. Names without that shape
 * (typed by the user) are shown as they are.
 */
function renderTitle(rule) {
  const name = rule.description;
  const index = name.indexOf(NAME_SEPARATOR);
  const label = index > 0 ? name.slice(0, index).trim() : '';
  const content = index > 0 ? name.slice(index + NAME_SEPARATOR.length).trim() : '';

  if (label && content) {
    return h('p', { class: 'rule-title', title: name }, h('span', { class: 'rule-name', text: content }), h('code', { class: 'rule-tag', text: label }));
  }
  return h('p', { class: 'rule-title', title: name || undefined }, h('span', { class: 'rule-name', text: name || t('listNoDescription') }));
}

/** Icon-only button; the tooltip doubles as the accessible name. */
function iconButton(name, label, onClick, danger = false) {
  return h('button', { class: `icon-btn${danger ? ' icon-btn-danger' : ''}`, type: 'button', title: label, 'aria-label': label, onClick }, icon(name));
}

const DATE_SHORT = { dateStyle: 'medium' };
const DATE_LONG = { dateStyle: 'medium', timeStyle: 'short' };

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
            { class: 'switch-row', title: t('listSiteActiveTip') },
            h('input', {
              class: 'switch',
              type: 'checkbox',
              role: 'switch',
              'aria-label': t('listSiteActive'),
              checked: isActive,
              onChange: (event) => this.#handlers.onToggleSite(hostname, event.target.checked),
            }),
          ),
          iconButton('trash-stack', t('listRemoveAllTip'), () => this.#handlers.onDeleteSite(hostname, rules.length), true),
        ),
      ),
      rules.map((rule) => this.#renderRule(rule)),
    );
  }

  #renderRule(rule) {
    const createdShort = new Date(rule.createdAt).toLocaleDateString(currentLanguage(), DATE_SHORT);
    const createdLong = new Date(rule.createdAt).toLocaleString(currentLanguage(), DATE_LONG);
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
        renderTitle(rule),
        h('p', { class: 'rule-meta', text: t('listMeta', scope, createdShort), title: t('listMetaTip', createdLong, rule.createdOnPath) }),
        h('code', { class: 'rule-selector', text: rule.selector, title: rule.selector }),
        rule.fallbackSelectors.length > 0 &&
          h(
            'details',
            { class: 'rule-fallbacks' },
            h('summary', { text: t('listFallbacks', rule.fallbackSelectors.length), title: t('listFallbacksTip') }),
            rule.fallbackSelectors.map((selector) => h('code', { text: selector })),
          ),
      ),
      h(
        'div',
        { class: 'rule-actions' },
        iconButton('edit', t('listEdit'), () => this.#handlers.onEditRule(rule)),
        iconButton('trash', t('listDelete'), () => this.#handlers.onDeleteRule(rule), true),
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
