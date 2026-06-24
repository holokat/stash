# STASH — Tab Vault (Chrome Extension)

A local-first Chrome extension that stashes any tab in one click and keeps it
searchable in a vault. No account, no cloud — everything lives in your browser
via `chrome.storage.local`.

## Load it (unpacked)

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top-right)
3. Click **Load unpacked** and select this `stash-extension/` folder
4. Pin the STASH icon to your toolbar

## Use it

- **Click the toolbar icon** → the tab is stashed instantly, then a popup lets you add **multiple tags** and a **note** before hitting *Done* (or *Copy URL* / *Open Vault*). The popup also shows the save/open-vault shortcuts.
- **⌘⇧S / Ctrl+Shift+S** → stash the current tab with no popup (a ✓ badge flashes).
- **⌘⇧K / Ctrl+Shift+K** → open the full vault.
- In the vault: search, filter by tag, sort, switch **Columns / Grid / List** views, toggle **System / Light / Dark**, add links manually with the **+** button, hover a card to **open** or **delete** (with undo). The vault header shows quick shortcut hints.
  - **Full-width, responsive** layout — the grid scales up to **6 columns** on wide screens and collapses to a single column on mobile.
  - **⌘K / Ctrl-K** (or **/**) jumps to search; the shortcut is shown as a hint inside the search field.

> Shortcuts can be remapped at `chrome://extensions/shortcuts`.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest — action popup, background worker, commands, permissions |
| `background.js` | Service worker: keyboard commands, quick-save logic, open/focus vault, first-run seed |
| `popup.html` / `popup.js` | Quick-save popup — stashes on open, then adds tags + a note |
| `vault.html` / `vault.css` / `vault.js` | The full vault UI (vanilla JS, full-width + responsive) |
| `icons/` | Toolbar icons (16/48/128px) |

## How it works

- **Storage**: bookmarks live under `chrome.storage.local` key `bookmarks`; view/sort/theme under `settings`. The vault also falls back to `localStorage` if opened outside the extension, so the page renders standalone for previewing.
- **Sync across surfaces**: saving from the popup or a shortcut writes to storage; an open vault tab listens via `chrome.storage.onChanged` and updates live.
- **Favicons**: uses the tab's own `favIconUrl` when Chrome provides one; otherwise the vault shows a text fallback.
- **Permissions**: `tabs` (read the active tab's title/url/favicon, open/focus tabs) and `storage` (save bookmarks/settings locally). No host permissions, no remote scripts, and no extension-initiated network calls.

## Notes / possible next steps

- Data is per-browser-profile and not synced. Swap `chrome.storage.local` for `chrome.storage.sync` (with the 8KB-per-item quota in mind) if you want cross-device sync.
- Import/export (JSON) and an "edit bookmark" flow are natural additions.
- To publish on the Chrome Web Store, zip the folder contents (not the parent folder) and submit via the Developer Dashboard.
