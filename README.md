# Page Element Hider

A Manifest V3 browser extension that lets you **pick any element on a webpage and hide it permanently on that website**. Rules are stored locally, survive reloads and browser restarts, and are re-applied automatically to elements that appear later (single-page apps, lazy-loaded content).

> The goal is *"hide this element on the website I'm using"* – never *"hide everything that matches `.sidebar` everywhere"*. Every rule is bound to the website it was created on.

## Features

- **Element picker** – highlight follows the cursor, tooltip says "Click to hide", `↑`/`↓` move to the parent/child, `Enter` selects, `Esc` cancels.
- **Safe picking** – while the picker is on, clicks, presses and hover handlers are intercepted, so links are not followed, forms are not submitted and buttons do not fire.
- **Confirmation** – "Hide this element?" dialog (Yes / Cancel). Clicking outside the dialog cancels. Cancel changes nothing.
- **Undo** – a toast with **Undo** after every hide, plus "Undo last hide" in the popup.
- **Automatic website scope** – no domain/URL questions during normal use (see [Rule scope](#rule-scope)).
- **Robust selectors** – stable ids/attributes/classes first, fallbacks stored, generated class names ignored (see [How elements are identified](#how-elements-are-identified)).
- **Dynamic pages** – CSS-driven hiding plus a throttled `MutationObserver`; SPA navigation is detected.
- **Duplicates** – repeated elements (e.g. 4 identical ads) can be hidden together ("Also hide N similar elements").
- **Shadow DOM** (open roots) and **iframes** (every frame runs its own copy; the dialog always appears in the top window).
- **Settings page** – every rule grouped by website with description, selector, scope, creation date and an on/off switch; edit, delete, delete per website, delete all (with a warning), search, and a master switch to temporarily disable all hiding.
- **Popup** – enable/disable, enter/exit selection mode, pause on the current website, undo, open settings.
- **Isolated UI** – all in-page UI lives in a closed shadow root with `!important` host styles, so it survives hostile site CSS and never changes the site's own styles.
- **Keyboard shortcut** – `Alt+Shift+H` toggles selection mode (change it at `chrome://extensions/shortcuts`).

## Installation (Chrome / Edge)

1. Download or clone this folder (the one that contains `manifest.json`).
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the `page-element-hider` folder.
5. Pin the extension from the puzzle-piece menu if you like.
6. **Reload tabs that were already open** – extensions only attach to pages loaded after they were installed.

### Firefox (temporary install, best effort)

`about:debugging#/runtime/this-firefox` → **Load Temporary Add-on…** → pick `manifest.json`. Firefox 121+ is required. It is declared compatible but has not been tested as thoroughly as Chromium.

## How to use

1. Open any website, click the extension icon, press **Select element to hide** (or press `Alt+Shift+H`).
2. Move the mouse – the element under the cursor is outlined. Use `↑` / `↓` to pick a parent or child.
3. Click it → **Yes, hide it**. A toast appears with **Undo**.
4. Manage everything later via **Open settings** in the popup (or the extension's *Options*).

Temporarily show everything again: popup → turn **Enabled** off, or **Active on this site** off for one website. Rules are kept either way.

## How element rules work

### Rule scope

A rule always belongs to the **hostname** it was created on (`www.` is ignored). It is applied only if the page's hostname matches, so a rule saved on `example.com` can never affect `another-site.com`, even with an identical selector. This is enforced in three places: the rule model refuses a rule without a hostname, storage drops invalid rules when loading, and the applier re-checks the hostname before touching the page.

Within the hostname, the **path context** decides which pages:

| Mode | Example | Used when |
|---|---|---|
| `site` (default) | all pages of `example.com` | the selector is stable (id, attribute, stable class) |
| `exact` | only `/products/shoes` | the only selector available is purely structural (tags/positions) – such a selector could match something unrelated on other pages |
| `pattern` | `/blog/*` | chosen manually in settings |

Subdomains (`blog.example.com`) are separate websites unless you tick *Also apply on its subdomains* when editing a rule.

URL changes are handled for normal navigation, refresh and browser restart (rules are read from storage on every page load) and for SPAs (the path is re-evaluated on `popstate`, `hashchange`, the Navigation API and a cheap poll; query string and `#hash` are not part of a path).

### How elements are identified

For the clicked element the generator builds candidates, verifies each one against the live DOM (it must match **exactly** that element), and ranks them:

1. a single stable identifier – `#id`, `tag[data-testid="x"]`, `tag.stable-class`
2. stable ancestor + descendant – `#main .promo` (survives wrapper changes)
3. shortest unique ancestor chain – `nav.top > ul > li.item`
4. a `:nth-of-type` chain – **only if nothing else is unique** (and then limited to the current page)

Ignored as unstable: generated ids (`widget-84921`, UUIDs, `:r1:`), CSS-in-JS/CSS-module classes (`css-1x2y3z`, `Header_title__a8Fk2`, `sc-…`), and state classes (`active`, `is-open`, `ng-…`). Elements inside open shadow roots use `host >>> inner` paths.

The rule stores a **primary selector**, up to 3 **fallback selectors**, and a **fingerprint** (tag, stable id/classes, text snippet). A fallback is used only while the primary matches nothing, and only if it lands on the same tag. Weak candidates (bare tags, positions) are never stored as fallbacks next to strong ones.

### Dynamic websites

Hiding is a stylesheet (`display: none !important`), so the browser hides elements as soon as they are inserted – no JavaScript runs for the common case. A `MutationObserver` only re-resolves rules that have not matched yet (fallback / shadow-DOM rules); it ignores attribute and text mutations, skips records that added no elements, and throttles to one pass per 150 ms. Elements that disappear and reappear are hidden again by the same stylesheet.

### Storage behavior

Rules and settings are stored in `chrome.storage.local` (not `localStorage`; not `storage.sync`, which caps items at 8 KB). They persist across refreshes and restarts and are shared by all tabs and the popup/settings pages. They are **not synced between devices**, and they are deleted if you remove the extension or clear its data.

```text
HiddenRule
├── id, hostname (required), includeSubdomains
├── pathContext { mode, value }, createdOnPath
├── selector, fallbackSelectors[], fingerprint
├── description, enabled
└── createdAt, updatedAt
```

## Supported browsers

| Browser | Status |
|---|---|
| Chrome 121+ | Primary target |
| Edge (Chromium) 121+ | Same engine, same manifest |
| Firefox 121+ | Declared compatible (`background.scripts` + `browser_specific_settings`); less tested |

## Known limitations

- **Closed shadow roots** cannot be inspected by any extension; only their host element can be hidden. Elements added to an *already existing* open shadow root without a light-DOM change are picked up on the next DOM change or navigation.
- **The `<iframe>` element itself cannot be picked while the pointer is over a frame the extension runs in** (the parent never receives events there). Pick the content inside the frame, or hover the frame's surroundings to select its wrapper. Frames that never get a content script (`about:blank`, `srcdoc`, some sandboxed frames) are not covered.
- **Restricted pages**: `chrome://`, the Chrome Web Store, the built-in PDF viewer, `view-source:`, other extensions' pages and (by default) `file://` URLs.
- **Pages open before installing** need one reload.
- **A short flash is possible** on very fast pages: the content script loads asynchronously (module import + storage read) before the first rule is applied.
- **Inline `display: … !important`** set on an element by the page beats the extension's stylesheet.
- **Hash-only SPA routes** (`/#/page`) share one path, so `exact`/`pattern` scopes cannot tell them apart.
- **Page capture handlers**: a site that registered its own *window-level capturing* listener before selection started can still observe the click. Default actions are still prevented.
- **Fallback re-evaluation** happens on DOM insertions, navigation and page load – not on pure attribute changes (the primary selector, being CSS, does react to those).
- **Selector drift**: if a site renames the identifiers the rule relies on, the rule stops matching; edit it in settings or hide the element again.
- **Detectability**: content-script modules are web-accessible, so a website could detect that the extension is installed.
- **Strict CSP**: hiding uses constructed stylesheets, which CSP does not block. If a browser refuses them, a `<style>` fallback is used, which a very strict `style-src` could block in some browsers.

## Development

No build step and no dependencies – edit the files and press the reload icon on the extension card (reload open tabs too).

```text
page-element-hider/
├── manifest.json
├── assets/icons/
├── src/
│   ├── shared/      constants, browser-api wrapper, messaging, url-matcher, dom-helpers
│   ├── storage/     storage-area (the only chrome.storage access), rule-model, rule-store, settings-store
│   ├── selectors/   stability-heuristics, selector-generator, selector-resolver, element-description
│   ├── background/  service-worker (message relay between frames, shortcut, badge)
│   ├── content/     loader → main → content-app (composition root)
│   │   │            selection-mode, hide-flow, frame-bridge, rule-applier, style-host,
│   │   │            managed-sheet, dom-watcher, navigation-watcher
│   │   └── ui/      ui-host (shadow root), highlighter, confirm-modal, toast, selection-banner, ui-styles
│   ├── popup/
│   └── options/     options (controller), rule-list-view, rule-edit-dialog, confirm-dialog
└── test/            manual test pages
```

Responsibilities are separated so that UI, business logic and storage never mix: only `storage-area.js` touches `chrome.storage`; stores know nothing about the DOM; `rule-applier` knows nothing about storage; views receive data and callbacks.

### Manual testing

Content scripts run on `http(s)` pages, so serve the test pages over HTTP from this folder:

```bash
python -m http.server 8080
```

Then open:

- `http://localhost:8080/test/manual-test-page.html` – interactive elements (the counter must not move while picking), duplicates, generated ids/classes, delayed/dynamic elements, a fake SPA router (`pushState`), open and closed shadow DOM, same-origin and cross-origin iframes (the page points the second frame at `127.0.0.1`), fixed/sticky elements, a card with interactive children.
- `http://localhost:8080/test/csp-page.html` – a page with a strict Content-Security-Policy (no inline styles or scripts).

Cross-frame behaviour: pick the ad inside an iframe – the confirmation must appear in the top window and the rule is saved under the iframe's own hostname.

## Languages

English, Russian and Azerbaijani. Pick one in **Settings → Language** (or leave it on *Auto* to follow the browser).
Strings live in `_locales/<lang>/messages.json` and are loaded by `src/shared/i18n.js`; plural forms use
`<key>_one/_few/_many/_other`. To add a language, copy `_locales/en`, translate it, and add it to `LANGUAGES` in `i18n.js`.

## Rules by hand, backup and sharing

In Settings, **Add rule** lets you create a rule yourself (site + CSS selector). The **Backup** tab exports all rules
to a JSON file and imports one back; imported rules are validated, get new ids, and duplicates are skipped.
