/**
 * Single access point for the WebExtension API.
 * Firefox exposes a promise-based `browser` namespace; Chromium exposes `chrome`
 * (promise-based in Manifest V3). Every other module imports `api` from here.
 */
export const api = globalThis.browser ?? globalThis.chrome;
