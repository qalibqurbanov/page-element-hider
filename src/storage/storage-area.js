import { api } from '../shared/browser-api.js';

/**
 * The only module that talks to chrome.storage directly.
 *
 * chrome.storage.local is used (not localStorage, which is per-origin and invisible to
 * the popup/options pages, and not storage.sync, which caps items at 8 KB).
 */

export async function readValue(key, fallback) {
  const result = await api.storage.local.get(key);
  return result[key] ?? fallback;
}

export async function writeValues(values) {
  await api.storage.local.set(values);
}

/** Calls `callback(changedKeys)` whenever one of `keys` changes in storage.local. */
export function subscribeToKeys(keys, callback) {
  const listener = (changes, areaName) => {
    if (areaName !== 'local') return;
    const changedKeys = keys.filter((key) => key in changes);
    if (changedKeys.length > 0) callback(changedKeys);
  };
  api.storage.onChanged.addListener(listener);
  return () => api.storage.onChanged.removeListener(listener);
}
