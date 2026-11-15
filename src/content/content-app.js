import { MESSAGE_TYPES, RELAY_TARGETS, TIMING } from '../shared/constants.js';
import { listenForMessages, sendToBackground } from '../shared/messaging.js';
import { initI18n, t } from '../shared/i18n.js';
import { getPageContext } from '../shared/url-matcher.js';
import { RuleStore } from '../storage/rule-store.js';
import { SettingsStore } from '../storage/settings-store.js';
import { DomWatcher } from './dom-watcher.js';
import { FrameBridge } from './frame-bridge.js';
import { HIDE_OUTCOME, HideFlow } from './hide-flow.js';
import { NavigationWatcher } from './navigation-watcher.js';
import { RuleApplier } from './rule-applier.js';
import { SelectionMode } from './selection-mode.js';
import { ConfirmModal } from './ui/confirm-modal.js';
import { Highlighter } from './ui/highlighter.js';
import { SelectionBanner } from './ui/selection-banner.js';
import { Toast } from './ui/toast.js';
import { UiHost } from './ui/ui-host.js';

/**
 * Per-frame composition root. One instance runs in every frame (the main page and each iframe),
 * because every frame has its own DOM and therefore needs its own rules applied.
 *
 * Responsibilities: load rules/settings for this frame's website, keep the page in sync with
 * storage, DOM mutations and SPA navigation, and wire up element selection.
 */
export class ContentApp {
  #page = getPageContext();
  #isTopFrame = window === window.top;

  #ruleStore = new RuleStore();
  #settingsStore = new SettingsStore();
  #applier = new RuleApplier(document);
  #domWatcher = new DomWatcher(() => this.#onDomChange(), { minIntervalMs: TIMING.MUTATION_MIN_INTERVAL_MS });
  #navigationWatcher = new NavigationWatcher((path) => this.#onPathChange(path));

  #uiHost = new UiHost(document);
  #highlighter = new Highlighter(this.#uiHost);
  #modal = new ConfirmModal(this.#uiHost);
  #toast = new Toast(this.#uiHost);
  #banner = new SelectionBanner(this.#uiHost);
  #bridge = new FrameBridge({
    isTopFrame: this.#isTopFrame,
    modal: this.#modal,
    toast: this.#toast,
    onUndo: () => this.#undoLastHide(),
  });
  #hideFlow = new HideFlow({
    page: this.#page,
    ruleStore: this.#ruleStore,
    highlighter: this.#highlighter,
    bridge: this.#bridge,
  });
  #selection = new SelectionMode({
    highlighter: this.#highlighter,
    uiHost: this.#uiHost,
    onSelect: (element) => this.#handleSelection(element),
    onExit: () => this.#exitSelectionEverywhere(),
  });

  #rules = [];
  #settings = null;
  #isActive = false;

  async start() {
    if (!this.#page) return; // not a normal website (e.g. about:blank frame) - nothing to scope rules to

    // Listen first so popup messages that arrive during the async storage read are not lost.
    listenForMessages((message) => this.#handleMessage(message));

    await initI18n();
    await this.#reload();
    this.#ruleStore.onChange(() => this.#reload());
    this.#settingsStore.onChange(() => this.#reload());
    this.#navigationWatcher.start();

    // Full re-resolution once the document is parsed/loaded catches elements that only
    // fallback selectors can find.
    document.addEventListener('DOMContentLoaded', () => this.#refresh(true), { once: true });
    window.addEventListener('load', () => this.#refresh(true), { once: true });
  }

  // ---- rule application -------------------------------------------------------------

  async #reload() {
    const [rules, settings] = await Promise.all([
      this.#ruleStore.getForHostname(this.#page.hostname),
      this.#settingsStore.get(),
      initI18n(), // picks up a language change made in Settings
    ]);
    this.#rules = rules;
    this.#settings = settings;
    this.#isActive = SettingsStore.isActiveFor(settings, this.#page.hostname);

    if (!this.#isActive) this.#leaveSelection();
    this.#refresh(true);
  }

  #refresh(full) {
    this.#applier.setState({ rules: this.#rules, page: this.#page, active: this.#isActive });

    if (!this.#isActive) {
      this.#domWatcher.disconnect();
      this.#applier.clear();
      return;
    }
    this.#domWatcher.observe(document);
    for (const shadowRoot of this.#applier.refresh({ full })) this.#domWatcher.observe(shadowRoot);
  }

  #onDomChange() {
    this.#navigationWatcher.check();
    this.#refresh(false);
  }

  #onPathChange(path) {
    this.#page = { ...this.#page, path };
    this.#hideFlow.setPage(this.#page);
    this.#refresh(true);
  }

  // ---- messages -----------------------------------------------------------------------

  #handleMessage(message) {
    switch (message.type) {
      case MESSAGE_TYPES.SET_SELECTION_MODE:
        if (message.active) this.#enterSelection();
        else this.#leaveSelection();
        return { ok: true };
      case MESSAGE_TYPES.GET_SELECTION_STATE:
        return { selecting: this.#selection.active };
      default:
        return this.#bridge.handleMessage(message) ? { ok: true } : undefined;
    }
  }

  // ---- selection ----------------------------------------------------------------------

  #enterSelection() {
    if (!this.#isActive) return; // paused/disabled: a rule saved now would not apply
    this.#selection.start();
    if (this.#isTopFrame) this.#banner.show(() => this.#exitSelectionEverywhere());
  }

  #leaveSelection() {
    this.#selection.stop();
    this.#banner.hide();
    this.#modal.close();
    this.#highlighter.clear();
  }

  /** Selection mode spans all frames, so leaving it must too. */
  #exitSelectionEverywhere() {
    this.#leaveSelection();
    sendToBackground({
      type: MESSAGE_TYPES.RELAY,
      target: RELAY_TARGETS.TAB,
      payload: { type: MESSAGE_TYPES.SET_SELECTION_MODE, active: false },
    });
  }

  async #handleSelection(element) {
    const outcome = await this.#hideFlow.run(element);
    if (outcome === HIDE_OUTCOME.CANCELLED) {
      this.#selection.resume(); // keep picking; Esc exits
      return;
    }
    this.#exitSelectionEverywhere();
    await this.#reload(); // apply immediately instead of waiting for the storage event
  }

  async #undoLastHide() {
    const undone = await this.#ruleStore.undoLastHide();
    this.#toast.show({ message: undone ? t('toastRestored') : t('toastNothingToUndo') });
  }
}
