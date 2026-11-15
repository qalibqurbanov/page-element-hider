import { DEFAULT_SETTINGS, STORAGE_KEYS } from '../shared/constants.js';
import { normalizeHostname } from '../shared/url-matcher.js';
import { readValue, subscribeToKeys, writeValues } from './storage-area.js';

/**
 * Global switches:
 *  - `enabled`: master switch ("temporarily disable all hiding rules")
 *  - `pausedHostnames`: websites where hiding is paused (rules are kept, just not applied)
 */
export class SettingsStore {
  async get() {
    const stored = await readValue(STORAGE_KEYS.SETTINGS, {});
    return {
      enabled: stored.enabled !== false,
      pausedHostnames: Array.isArray(stored.pausedHostnames)
        ? [...new Set(stored.pausedHostnames.map(normalizeHostname).filter(Boolean))]
        : [...DEFAULT_SETTINGS.pausedHostnames],
    };
  }

  async setEnabled(enabled) {
    const settings = await this.get();
    await this.#save({ ...settings, enabled });
  }

  async setSitePaused(hostname, paused) {
    const target = normalizeHostname(hostname);
    const settings = await this.get();
    const others = settings.pausedHostnames.filter((name) => name !== target);
    await this.#save({ ...settings, pausedHostnames: paused ? [...others, target] : others });
  }

  /** True when hiding should be applied on `hostname` right now. */
  static isActiveFor(settings, hostname) {
    return settings.enabled && !settings.pausedHostnames.includes(normalizeHostname(hostname));
  }

  /** @returns {() => void} unsubscribe */
  onChange(callback) {
    return subscribeToKeys([STORAGE_KEYS.SETTINGS], callback);
  }

  #save(settings) {
    return writeValues({ [STORAGE_KEYS.SETTINGS]: settings });
  }
}
