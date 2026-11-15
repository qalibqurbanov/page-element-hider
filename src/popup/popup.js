import { api } from '../shared/browser-api.js';
import { getSelectionState, setSelectionMode } from '../shared/selection-control.js';
import { localizeDocument, t, tn } from '../shared/i18n.js';
import { parsePageUrl } from '../shared/url-matcher.js';
import { RuleStore } from '../storage/rule-store.js';
import { SettingsStore } from '../storage/settings-store.js';

const MESSAGES = Object.freeze({
  UNSUPPORTED_PAGE: t('popupUnsupported'),
  RELOAD_NEEDED: t('popupReload'),
});

const ruleStore = new RuleStore();
const settingsStore = new SettingsStore();

const elements = {
  enabledToggle: document.getElementById('enabled-toggle'),
  selectButton: document.getElementById('select-button'),
  siteToggle: document.getElementById('site-toggle'),
  siteName: document.getElementById('site-name'),
  siteTile: document.getElementById('site-tile'),
  selectLabel: document.getElementById('select-label'),
  siteMeta: document.getElementById('site-meta'),
  status: document.getElementById('status'),
  settingsButton: document.getElementById('settings-button'),
};

/** @type {{ tabId: number|undefined, page: {hostname: string, path: string}|null }} */
const context = { tabId: undefined, page: null };

async function init() {
  localizeDocument();
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  context.tabId = tab?.id;
  context.page = tab?.url ? parsePageUrl(tab.url) : null;

  bindEvents();
  await render();
}

function bindEvents() {
  elements.enabledToggle.addEventListener('change', async () => {
    await settingsStore.setEnabled(elements.enabledToggle.checked);
    await render();
  });
  elements.siteToggle.addEventListener('change', async () => {
    await settingsStore.setSitePaused(context.page.hostname, !elements.siteToggle.checked);
    await render();
  });
  elements.selectButton.addEventListener('click', handleSelectClick);
  elements.settingsButton.addEventListener('click', () => {
    api.runtime.openOptionsPage();
    window.close();
  });
}

async function handleSelectClick() {
  const { available, selecting } = await getSelectionState(context.tabId);
  if (!available) {
    showStatus(MESSAGES.RELOAD_NEEDED, true);
    return;
  }
  const delivered = await setSelectionMode(context.tabId, !selecting);
  if (!delivered) {
    showStatus(MESSAGES.RELOAD_NEEDED, true);
    return;
  }
  if (selecting) await render();
  else window.close(); // get out of the way so the user can pick an element
}

async function render() {
  const settings = await settingsStore.get();
  const page = context.page;

  elements.enabledToggle.checked = settings.enabled;
  elements.siteToggle.disabled = !page;
  elements.siteToggle.checked = page ? !settings.pausedHostnames.includes(page.hostname) : false;
  elements.siteName.textContent = page ? page.hostname : t('popupSiteActiveGeneric');
  elements.siteTile.textContent = page ? page.hostname[0].toUpperCase() : '–';

  const isActiveHere = Boolean(page) && SettingsStore.isActiveFor(settings, page.hostname);
  document.body.classList.toggle('is-off', !settings.enabled);
  document.body.classList.toggle('is-paused', settings.enabled && Boolean(page) && !isActiveHere);
  elements.selectButton.disabled = !isActiveHere;

  // Disabled and paused are shown visually (is-off / is-paused classes), not with text.
  showStatus(page ? '' : MESSAGES.UNSUPPORTED_PAGE);

  await renderSelectionState(isActiveHere);
  await renderCounts(page);
}

async function renderSelectionState(isActiveHere) {
  if (!isActiveHere || context.tabId === undefined) {
    elements.selectLabel.textContent = t('popupSelect');
    return;
  }
  const { selecting } = await getSelectionState(context.tabId);
  elements.selectLabel.textContent = selecting ? t('popupExitSelect') : t('popupSelect');
}

async function renderCounts(page) {
  const siteRules = page ? await ruleStore.getForHostname(page.hostname) : [];
  elements.siteMeta.textContent = page ? tn('listRuleCount', siteRules.length) : '';
}

function showStatus(text, isError = false) {
  elements.status.textContent = text;
  elements.status.hidden = !text;
  elements.status.classList.toggle('is-error', isError);
}

init().catch((error) => {
  console.error('[Page Element Hider] popup failed to initialise', error);
  showStatus(t('popupError'), true);
});
