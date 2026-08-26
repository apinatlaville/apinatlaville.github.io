# AGENTS.md

## Cursor Cloud specific instructions

### What this is
"Mes Cours - PC* Edition" is a **fully static, client-side single-page web app** (French). It is plain HTML/CSS/JS with no build step, no package manager, no bundler, and no automated tests/lint configs. Third-party libraries are either vendored in the repo root (`fuse.js`, `JsBarcode.js`, `jsQR.js`, `html5-qrcode.js`) or loaded from CDNs (Firebase, Google Identity Services, Google Fonts). App logic is split across `app.js` (core/Firebase/state, loaded as an ES module), `data.js`, `cloud.js`, `scanner.js`, and the `anki-*.js` files; `index.html` injects these dynamically.

### Running it (dev)
- Serve the repo root over HTTP from the workspace root — do **not** open `index.html` via `file://`, because `app.js` is an ES module and the page dynamically loads sibling scripts, which require an HTTP origin.
- Command: `python3 -m http.server 8000` (run from `/workspace`), then open `http://localhost:8000/`.
- There is no build/test/lint tooling in this repo; "running" the app is the only check.

### Testing without Google login (important, non-obvious)
- The app opens to a login overlay requiring Google Sign-In + Firebase Auth, which needs real credentials/network and is not usable in CI.
- Use the **"🌸 Continuer en mode local (Test)"** button on the login overlay to enter "Mode Local" (`window.startLocalMode()` in `cloud.js`). This bypasses Google/Firebase, loads sample data, and lets you exercise core features (courses, classeurs, matières, flashcards). Local mode persists via `localStorage` (`active_mode=local`), so subsequent loads auto-resume it.

### Gotchas
- The browser needs outbound internet for the CDN modules (Firebase from `gstatic.com`, Google Fonts, Google Identity); without it the page may not fully initialize even in local mode.
- A red error toast at the top of the page surfaces runtime JS errors; the "🐛 Logs" tab also lists captured errors — useful for debugging.
