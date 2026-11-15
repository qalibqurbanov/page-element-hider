import { STORAGE_KEYS } from '../shared/constants.js';
import { hostnameMatches, normalizeHostname } from '../shared/url-matcher.js';
import { sanitizeRule, updateRule } from './rule-model.js';
import { ruleKey } from './rule-transfer.js';
import { readValue, subscribeToKeys, writeValues } from './storage-area.js';

/**
 * Persistence for hiding rules (CRUD + undo bookkeeping).
 *
 * Rules live in one object keyed by id. Writes within one JS context are serialized
 * through a promise queue so two quick edits cannot overwrite each other.
 * (Two *different* contexts writing in the same millisecond is theoretically possible,
 * but only user clicks write, so it is not worth a cross-context lock.)
 */
export class RuleStore {
  #writeQueue = Promise.resolve();

  /** @returns {Promise<object[]>} all valid rules, oldest first */
  async getAll() {
    const map = await this.#readMap();
    return Object.values(map).sort((a, b) => a.createdAt - b.createdAt);
  }

  /** Rules that belong to the website `hostname` (incl. opted-in subdomain rules). */
  async getForHostname(hostname) {
    const rules = await this.getAll();
    return rules.filter((rule) => hostnameMatches(rule, hostname));
  }

  /** Saves a new rule and remembers it as the target of "Undo". */
  add(rule) {
    return this.#mutate(
      (map) => {
        map[rule.id] = rule;
      },
      { [STORAGE_KEYS.LAST_HIDE]: { ruleIds: [rule.id], at: Date.now() } },
    );
  }

  /**
   * Adds already-validated rules (import), skipping ones that duplicate an existing rule.
   * Does not touch the "Undo" bookkeeping.
   * @returns {Promise<{ added: number, duplicates: number }>}
   */
  async addMany(rules) {
    let added = 0;
    let duplicates = 0;
    await this.#mutate((map) => {
      const known = new Set(Object.values(map).map(ruleKey));
      for (const rule of rules) {
        const key = ruleKey(rule);
        if (known.has(key)) {
          duplicates++;
          continue;
        }
        known.add(key);
        map[rule.id] = rule;
        added++;
      }
    });
    return { added, duplicates };
  }

  update(id, changes) {
    return this.#mutate((map) => {
      if (map[id]) map[id] = updateRule(map[id], changes);
    });
  }

  setEnabled(id, enabled) {
    return this.update(id, { enabled });
  }

  remove(id) {
    return this.#mutate((map) => {
      delete map[id];
    });
  }

  /** Deletes every rule whose own hostname is exactly `hostname`. */
  removeForHostname(hostname) {
    const target = normalizeHostname(hostname);
    return this.#mutate((map) => {
      for (const rule of Object.values(map)) {
        if (rule.hostname === target) delete map[rule.id];
      }
    });
  }

  removeAll() {
    return this.#mutate((map) => {
      for (const id of Object.keys(map)) delete map[id];
    });
  }

  async getLastHide() {
    const lastHide = await readValue(STORAGE_KEYS.LAST_HIDE, null);
    if (!lastHide || !Array.isArray(lastHide.ruleIds)) return null;
    const map = await this.#readMap();
    const ruleIds = lastHide.ruleIds.filter((id) => map[id]);
    return ruleIds.length > 0 ? { ...lastHide, ruleIds } : null;
  }

  /** Removes the most recently created rule(s). Returns true if something was undone. */
  async undoLastHide() {
    const lastHide = await this.getLastHide();
    if (!lastHide) return false;
    await this.#mutate(
      (map) => {
        for (const id of lastHide.ruleIds) delete map[id];
      },
      { [STORAGE_KEYS.LAST_HIDE]: null },
    );
    return true;
  }

  /** @returns {() => void} unsubscribe */
  onChange(callback) {
    return subscribeToKeys([STORAGE_KEYS.RULES, STORAGE_KEYS.LAST_HIDE], callback);
  }

  async #readMap() {
    const stored = await readValue(STORAGE_KEYS.RULES, {});
    const map = {};
    for (const raw of Object.values(stored)) {
      const rule = sanitizeRule(raw);
      if (rule) map[rule.id] = rule;
    }
    return map;
  }

  #mutate(change, extraValues = {}) {
    const run = async () => {
      const map = await this.#readMap();
      change(map);
      await writeValues({ [STORAGE_KEYS.RULES]: map, ...extraValues });
    };
    // Keep the queue alive after a failure, but still surface the error to the caller.
    const result = this.#writeQueue.then(run);
    this.#writeQueue = result.catch(() => {});
    return result;
  }
}
