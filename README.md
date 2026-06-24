# STASH

STASH is a local-first tab vault for Chrome and Firefox. It saves the current tab, lets you add tags and notes, and keeps everything searchable in a private browser-local vault.

No account. No cloud sync. No tracker.

## Downloads

- [Stash for Chrome](https://github.com/karnagebitcoin/stash/releases/download/v1.0.2/stash-extension-1.0.2-chrome-store.zip)
- [Stash for Firefox](https://github.com/karnagebitcoin/stash/releases/download/v1.0.2/stash-extension-firefox-1.0.2.zip)

## What Is In This Repo

- `index.html`, `landing.css`, `landing.js`: the public site.
- `privacy/`: privacy policy page.
- `stash-extension/`: Chrome extension source.
- `stash-extension-firefox/`: Firefox extension source.

## Shortcuts

- Chrome quick-save: `Cmd+Shift+S` on macOS, `Ctrl+Shift+S` elsewhere.
- Firefox quick-save: `Option+Shift+S` on macOS, `Alt+Shift+S` elsewhere.
- Open vault: `Cmd+Shift+K` on macOS, `Ctrl+Shift+K` elsewhere.
- Search vault: `Cmd+K` on macOS, `Ctrl+K` elsewhere.

## Load Locally

Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select `stash-extension/`.

Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `stash-extension-firefox/manifest.json`.

## Privacy

Bookmarks and settings are stored in the browser profile. STASH does not use host permissions, remote scripts, accounts, analytics, or extension-initiated network calls.
