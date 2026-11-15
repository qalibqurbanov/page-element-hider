import { ContentApp } from './content-app.js';

/** Entry point of the content script modules (loaded by loader.js). */
export function start() {
  new ContentApp().start().catch((error) => {
    console.error('[Page Element Hider] failed to start', error);
  });
}
