import { localizeDocument, t, tn } from '../shared/i18n.js';
import { isValidSelector } from '../selectors/selector-resolver.js';
import { RuleStore } from '../storage/rule-store.js';
import { MAX_IMPORT_BYTES, buildExport, exportFileName, parseImport } from '../storage/rule-transfer.js';
import { SettingsStore } from '../storage/settings-store.js';
import { confirmAction } from './confirm-dialog.js';
import { editRule } from './rule-edit-dialog.js';
import { RuleListView } from './rule-list-view.js';

/**
 * Settings page controller: loads data, applies the search filter, and turns user actions
 * into store calls. Rendering lives in rule-list-view.js, persistence in the stores.
 */

localizeDocument();

const ruleStore = new RuleStore();
const settingsStore = new SettingsStore();

const elements = {
  summary: document.getElementById('summary'),
  globalToggle: document.getElementById('global-toggle'),
  search: document.getElementById('search'),
  deleteAll: document.getElementById('delete-all'),
  exportRules: document.getElementById('export-rules'),
  importRules: document.getElementById('import-rules'),
  importFile: document.getElementById('import-file'),
  disabledBanner: document.getElementById('disabled-banner'),
  list: document.getElementById('rule-list'),
};

const state = { rules: [], settings: { enabled: true, pausedHostnames: [] }, query: '' };

const view = new RuleListView(elements.list, {
  onToggleRule: (rule, enabled) => run(() => ruleStore.setEnabled(rule.id, enabled)),
  onEditRule: async (rule) => {
    const changes = await editRule(rule);
    if (changes) await run(() => ruleStore.update(rule.id, changes));
  },
  onDeleteRule: async (rule) => {
    const confirmed = await confirmAction({
      title: t('deleteRuleTitle'),
      message: t('deleteRuleMessage', rule.description || rule.selector, rule.hostname),
      confirmLabel: t('deleteRuleConfirm'),
      danger: true,
    });
    if (confirmed) await run(() => ruleStore.remove(rule.id));
  },
  onToggleSite: (hostname, active) => run(() => settingsStore.setSitePaused(hostname, !active)),
  onDeleteSite: async (hostname, count) => {
    const confirmed = await confirmAction({
      title: t('deleteSiteTitle', hostname),
      message: tn('deleteSiteMessage', count, hostname),
      warning: t('deleteSiteWarning'),
      confirmLabel: tn('deleteSiteConfirm', count),
      danger: true,
    });
    if (confirmed) await run(() => ruleStore.removeForHostname(hostname));
  },
});

elements.globalToggle.addEventListener('change', () => run(() => settingsStore.setEnabled(elements.globalToggle.checked)));
elements.search.addEventListener('input', () => {
  state.query = elements.search.value;
  render();
});
elements.deleteAll.addEventListener('click', async () => {
  if (state.rules.length === 0) return;
  const siteCount = new Set(state.rules.map((rule) => rule.hostname)).size;
  const confirmed = await confirmAction({
    title: t('deleteAllTitle'),
    message: t('deleteAllMessage', state.rules.length, siteCount),
    warning: t('deleteAllWarning', t('optionsHidingOn')),
    confirmLabel: t('deleteAllConfirm'),
    danger: true,
  });
  if (confirmed) await run(() => ruleStore.removeAll());
});

elements.exportRules.addEventListener('click', async () => {
  const rules = await ruleStore.getAll();
  if (rules.length === 0) {
    await confirmAction({ title: t('transferExportFailedTitle'), message: t('transferNothingToExport'), confirmLabel: t('dialogOk') });
    return;
  }
  const blob = new Blob([JSON.stringify(buildExport(rules), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

elements.importRules.addEventListener('click', () => elements.importFile.click());
elements.importFile.addEventListener('change', async () => {
  const [file] = elements.importFile.files;
  elements.importFile.value = ''; // allow picking the same file again
  if (file) await importFromFile(file);
});

async function importFromFile(file) {
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error(t('transferTooLarge'));
    const { rules, invalidCount } = parseImport(await file.text(), { isSelectorValid: isValidSelector });
    const { added, duplicates } = await ruleStore.addMany(rules);
    await confirmAction({
      title: t('transferImportTitle'),
      message: t('transferImportResult', added, duplicates, invalidCount),
      confirmLabel: t('dialogOk'),
    });
  } catch (error) {
    await confirmAction({ title: t('transferImportFailedTitle'), message: String(error.message ?? error), confirmLabel: t('dialogOk') });
  }
  await refresh();
}

ruleStore.onChange(refresh);
settingsStore.onChange(refresh);

/** Runs a store action, then reloads; failures are reported instead of silently ignored. */
async function run(action) {
  try {
    await action();
  } catch (error) {
    console.error('[Page Element Hider] action failed', error);
    await confirmAction({ title: t('dialogErrorTitle'), message: String(error.message ?? error), confirmLabel: t('dialogOk') });
  }
  await refresh();
}

async function refresh() {
  [state.rules, state.settings] = await Promise.all([ruleStore.getAll(), settingsStore.get()]);
  render();
}

function render() {
  const visibleRules = filterRules(state.rules, state.query);
  const siteCount = new Set(state.rules.map((rule) => rule.hostname)).size;

  elements.summary.textContent = t('optionsSummary', state.rules.length, siteCount);
  elements.globalToggle.checked = state.settings.enabled;
  elements.disabledBanner.hidden = state.settings.enabled;
  elements.deleteAll.disabled = state.rules.length === 0;
  elements.exportRules.disabled = state.rules.length === 0;

  view.render({ rules: visibleRules, totalCount: state.rules.length, pausedHostnames: state.settings.pausedHostnames });
}

/** Case-insensitive match against everything a user might remember about a rule. */
function filterRules(rules, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rules;
  return rules.filter((rule) =>
    [rule.hostname, rule.description, rule.selector, ...rule.fallbackSelectors, rule.createdOnPath]
      .join('\n')
      .toLowerCase()
      .includes(needle),
  );
}

refresh();
