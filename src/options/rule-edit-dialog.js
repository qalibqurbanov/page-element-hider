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
 * Dialog for editing a rule, or (with `create: true`) for writing a new one by hand.
 * Resolves with the changed fields, or null if cancelled. Selectors are validated against
 * the browser's own CSS parser before saving.
 *
 * @param {object} rule the rule to edit, or a blank template (with a fresh id) when creating
 * @param {{ create?: boolean }} [options]
 * @returns {Promise<object|null>}
 */
export function editRule(rule, { create = false } = {}) {
  return new Promise((resolve) => {
    const fields = {
      description: h('input', { class: 'input', id: 'edit-description', value: rule.description }),
      hostname: h('input', { class: 'input', id: 'edit-hostname', value: rule.hostname, placeholder: 'example.com', required: true, autocomplete: 'off' }),
      includeSubdomains: h('input', { type: 'checkbox', id: 'edit-subdomains', checked: rule.includeSubdomains }),
      pathMode: h(
        'select',
        { class: 'input', id: 'edit-path-mode' },
        Object.entries(pathModeLabels()).map(([mode, label]) => h('option', { value: mode, text: label, selected: mode === rule.pathContext.mode })),
      ),
      pathValue: h('input', { class: 'input mono', id: 'edit-path-value', value: rule.pathContext.value, autocomplete: 'off' }),
      selector: h('input', { class: 'input mono', id: 'edit-selector', value: rule.selector, placeholder: '.cookie-banner', required: true, autocomplete: 'off', spellcheck: 'false' }),
      fallbacks: h('textarea', { class: 'input mono', id: 'edit-fallbacks', rows: '2', value: rule.fallbackSelectors.join('\n'), spellcheck: 'false' }),
      enabled: h('input', { type: 'checkbox', id: 'edit-enabled', checked: rule.enabled }),
    };

    const pathValueField = field(t('editPath'), fields.pathValue, 'edit-path-value');
    const pathHint = pathValueField.querySelector('.hint');
    const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const cancelButton = h('button', { class: 'button', type: 'button', text: t('dialogCancel') });
    const saveButton = h('button', { class: 'button button-primary', type: 'submit', text: create ? t('editAdd') : t('editSave') });
    const title = create ? t('editAddTitle') : t('editTitle');

    // novalidate: validation (including friendlier messages) is done in collectErrors().
    const form = h(
      'form',
      { method: 'dialog', novalidate: true },
      h('h2', { text: title }),
      field(t('editHostname'), fields.hostname, 'edit-hostname', t('editHostnameTip')),
      field(t('editSelector'), fields.selector, 'edit-selector', t('editSelectorTip')),
      field(t('editDescription'), fields.description, 'edit-description', t('editDescriptionTip')),
      h(
        'div',
        { class: 'form-row' },
        field(t('editAppliesTo'), fields.pathMode, 'edit-path-mode', t('editAppliesToTip')),
        pathValueField,
      ),
      field(t('editFallbacks'), fields.fallbacks, 'edit-fallbacks', t('editFallbacksTip')),
      h(
        'div',
        { class: 'form-checks' },
        h('label', { class: 'form-inline', title: t('editSubdomainsTip') }, fields.includeSubdomains, t('editSubdomains')),
        h('label', { class: 'form-inline' }, fields.enabled, t('editEnabled')),
      ),
      errorBox,
      h('div', { class: 'dialog-actions' }, cancelButton, saveButton),
    );
    const dialog = h('dialog', { 'aria-label': title }, form);

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
    (create ? fields.hostname : fields.description).focus();
  });
}

/** A labelled form row; `tooltip` adds a small "?" that explains the field on hover/focus. */
function field(labelText, control, id, tooltip) {
  const info = tooltip ? h('span', { class: 'info', title: tooltip, tabindex: '0', 'aria-label': tooltip, text: '?' }) : null;
  return h('div', { class: 'form-field' }, h('label', { for: id }, labelText, info), control, h('span', { class: 'hint' }));
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

/** Model validation (site required, path format...) plus CSS selector syntax. */
function collectErrors(rule, changes) {
  const candidate = normalizeRule({ ...rule, ...changes });
  const errors = validateRule(candidate);
  for (const selector of [candidate.selector, ...candidate.fallbackSelectors]) {
    if (selector && !isValidSelector(selector)) errors.push(t('editInvalidSelector', selector));
  }
  return errors;
}
