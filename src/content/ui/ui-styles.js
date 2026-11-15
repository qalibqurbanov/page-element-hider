/**
 * Styles for all in-page extension UI. They live inside a closed shadow root, so website CSS
 * cannot leak in and these rules cannot leak out. They are shipped as a JS string (not a CSS
 * file) so no extra request is needed and no page CSP can block them.
 */
export const UI_CSS = `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }

.peh-root {
  font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #1f2430;
  --peh-accent: #e11d48;
  --peh-surface: #ffffff;
  --peh-text: #1f2430;
  --peh-muted: #5b6475;
  --peh-border: #d8dce5;
  --peh-code-bg: #f1f3f7;
}
@media (prefers-color-scheme: dark) {
  .peh-root {
    color: #e8eaf0;
    --peh-surface: #1e2230;
    --peh-text: #e8eaf0;
    --peh-muted: #a3abbd;
    --peh-border: #394055;
    --peh-code-bg: #2a3044;
  }
}

button { font: inherit; cursor: pointer; }
button:focus-visible, input:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }

/* ---- highlight ---- */
.peh-box {
  position: fixed;
  pointer-events: none;
  border: 2px solid var(--peh-accent);
  background: rgba(225, 29, 72, 0.16);
  box-shadow: 0 0 0 1px #ffffff, 0 0 0 3px rgba(225, 29, 72, 0.35);
  border-radius: 2px;
}
.peh-box.peh-similar {
  border-style: dashed;
  background: rgba(225, 29, 72, 0.08);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
}
.peh-tooltip {
  position: fixed;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 8px);
  padding: 5px 9px;
  border-radius: 6px;
  background: #111827;
  color: #ffffff;
  font-size: 12px;
  line-height: 1.3;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
}
.peh-tooltip-action { color: #fda4af; font-weight: 600; }
.peh-tooltip-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  opacity: 0.9;
}
.peh-tooltip-hint { opacity: 0.6; }

/* ---- confirmation modal ---- */
.peh-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 18, 28, 0.55);
  pointer-events: auto;
}
.peh-dialog {
  width: min(440px, 100%);
  padding: 22px 22px 18px;
  border-radius: 12px;
  background: var(--peh-surface);
  color: var(--peh-text);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}
.peh-title { margin: 0 0 6px; font-size: 18px; font-weight: 650; line-height: 1.3; }
.peh-text { margin: 0 0 12px; color: var(--peh-muted); }
.peh-element {
  margin: 0 0 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--peh-code-bg);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12.5px;
  word-break: break-word;
}
.peh-note { margin: 0 0 12px; font-size: 13px; color: var(--peh-muted); }
.peh-checkbox { display: flex; gap: 8px; align-items: flex-start; margin: 0 0 14px; font-size: 13.5px; cursor: pointer; }
.peh-checkbox input { margin: 3px 0 0; }
.peh-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
.peh-button {
  padding: 8px 16px;
  border: 1px solid var(--peh-border);
  border-radius: 8px;
  background: transparent;
  color: var(--peh-text);
  font-weight: 550;
}
.peh-button:hover { background: var(--peh-code-bg); }
.peh-button-primary { border-color: var(--peh-accent); background: var(--peh-accent); color: #ffffff; }
.peh-button-primary:hover { background: #be123c; }

/* ---- toast + banner ---- */
.peh-toast, .peh-banner {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  /* max-content: with left: 50% the shrink-to-fit width would otherwise be capped at half the viewport */
  width: max-content;
  max-width: calc(100vw - 24px);
  padding: 10px 14px;
  border-radius: 999px;
  background: #111827;
  color: #ffffff;
  font-size: 13.5px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4);
  pointer-events: auto;
}
.peh-toast { bottom: 24px; }
.peh-banner { top: 14px; }
.peh-link-button {
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: #fda4af;
  font-weight: 650;
  white-space: nowrap;
  flex: none;
}
.peh-link-button:hover { text-decoration: underline; }
.peh-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--peh-accent); flex: none; }

@media (prefers-reduced-motion: no-preference) {
  .peh-dialog { animation: peh-pop 120ms ease-out; }
  .peh-toast { animation: peh-rise 160ms ease-out; }
}
@keyframes peh-pop { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }
@keyframes peh-rise { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
`;
