import { PATH_MODES } from '../shared/constants.js';
import { h } from '../shared/dom-helpers.js';
import { t } from '../shared/i18n.js';
import { isValidSelector } from '../selectors/selector-resolver.js';
import { normalizeRule, validateRule } from '../storage/rule-model.js';

const pathModeLabels = () => ({
  [PATH_MODES.SITE]: t('editPathSite'),
  [PATH_MODES.EXACT]: t('editPathExact'),
  [PATH_MODES.PATTERN]: t('editPathPattern'),
});

const pathHints = () => ({
  [PATH_MODES.SITE]: '',
  [PATH_MODES.EXACT]: t('editPathHintExact'),
  [PATH_MODES.PATTERN]: t('editPathHintPattern'),
});

/**
 * Edit dialog for one rule. Resolves with the changed fields, or null if cancelled.
 * Selectors are validated against the browser's own CSS parser before saving.
 *
 * @returns {Promise<object|null>}
 */
export function editRule(rule) {
  return new Promise((resolve) => {
    const fields = {
      description: h('input', { class: 'input', id: 'edit-description', value: rule.description }),
      hostname: h('input', { class: 'input', id: 'edit-hostname', value: rule.hostname, required: true }),
      includeSubdomains: h('input', { type: 'checkbox', id: 'edit-subdomains', checked: rule.includeSubdomains }),
      pathMode: h(
        'select',
        { class: 'input', id: 'edit-path-mode' },
        Object.entries(pathModeLabels()).map(([mode, label]) => h('option', { value: mode, text: label, selected: mode === rule.pathContext.mode })),
      ),
      pathValue: h('input', { class: 'input mono', id: 'edit-path-value', value: rule.pathContext.value }),
      selector: h('input', { class: 'input mono', id: 'edit-selector', value: rule.selector, required: true }),
      fallbacks: h('textarea', { class: 'input mono', id: 'edit-fallbacks', rows: '3', value: rule.fallbackSelectors.join('\n') }),
      enabled: h('input', { type: 'checkbox', id: 'edit-enabled', checked: rule.enabled }),
    };

    const pathValueField = field(t('editPath'), fields.pathValue, 'edit-path-value');
    const pathHint = pathValueField.querySelector('.hint');
    const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const cancelButton = h('button', { class: 'button', type: 'button', text: t('dialogCancel') });
    const saveButton = h('button', { class: 'button button-primary', type: 'submit', text: t('editSave') });

    // novalidate: validation (including friendlier messages) is done in collectErrors().
    const form = h(
      'form',
      { method: 'dialog', novalidate: true },
      h('h2', { text: t('editTitle') }),
      field(t('editDescription'), fields.description, 'edit-description'),
      field(t('editHostname'), fields.hostname, 'edit-hostname', t('editHostnameHint')),
      h('div', { class: 'form-field' }, h('label', { class: 'form-inline' }, fields.includeSubdomains, t('editSubdomains'))),
      field(t('editAppliesTo'), fields.pathMode, 'edit-path-mode'),
      pathValueField,
      field(t('editSelector'), fields.selector, 'edit-selector', t('editSelectorHint')),
      field(t('editFallbacks'), fields.fallbacks, 'edit-fallbacks', t('editFallbacksHint')),
      h('div', { class: 'form-field' }, h('label', { class: 'form-inline' }, fields.enabled, t('editEnabled'))),
      errorBox,
      h('div', { class: 'dialog-actions' }, cancelButton, saveButton),
    );
    const dialog = h('dialog', { 'aria-label': t('editTitle') }, form);

    const syncPathField = () => {
      const needsPath = fields.pathMode.value !== PATH_MODES.SITE;
      pathValueField.hidden = !needsPath;
      pathHint.textContent = pathHints()[fields.pathMode.value];
    };
    fields.pathMode.addEventListener('change', syncPathField);
    syncPathField();

    let result = null;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const changes = readChanges(fields);
      const errors = collectErrors(rule, changes);
      if (errors.length > 0) {
        errorBox.textContent = errors.join(' ');
        errorBox.hidden = false;
        return;
      }
      result = changes;
      dialog.close();
    });
    cancelButton.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(result);
    });

    document.body.appendChild(dialog);
    dialog.showModal();
    fields.description.focus();
  });
}

function field(labelText, control, id, hint) {
  return h('div', { class: 'form-field' }, h('label', { for: id, text: labelText }), control, h('span', { class: 'hint', text: hint ?? '' }));
}

function readChanges(fields) {
  return {
    description: fields.description.value,
    hostname: fields.hostname.value,
    includeSubdomains: fields.includeSubdomains.checked,
    pathContext: { mode: fields.pathMode.value, value: fields.pathValue.value },
    selector: fields.selector.value,
    fallbackSelectors: fields.fallbacks.value.split('\n'),
    enabled: fields.enabled.checked,
  };
}

/** Model validation (hostname required, path format...) plus CSS selector syntax. */
function collectErrors(rule, changes) {
  const candidate = normalizeRule({ ...rule, ...changes });
  const errors = validateRule(candidate);
  for (const selector of [candidate.selector, ...candidate.fallbackSelectors]) {
    if (selector && !isValidSelector(selector)) errors.push(t('editInvalidSelector', selector));
  }
  return errors;
}
