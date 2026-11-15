/**
 * Content scripts cannot be declared as ES modules in the manifest, so this tiny classic script
 * is what the manifest injects. It dynamically imports the real module graph (src/content/main.js),
 * which is why those files are listed under `web_accessible_resources`.
 */
(async () => {
  const GUARD = Symbol.for('page-element-hider.started');
  if (globalThis[GUARD]) return; // never run twice in the same frame
  globalThis[GUARD] = true;

  try {
    const api = globalThis.browser ?? globalThis.chrome;
    const { start } = await import(api.runtime.getURL('src/content/main.js'));
    start();
  } catch (error) {
    console.error('[Page Element Hider] could not load content script', error);
  }
})();
