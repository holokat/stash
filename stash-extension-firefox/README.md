# STASH — Tab Vault (Firefox Extension)

A local-first Firefox extension that stashes any tab in one click and keeps it
searchable in a vault. No account, no cloud — everything lives in your browser
via `browser.storage.local`.

## Load it (unpacked)

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on...**
3. Select `manifest.json` inside this `stash-extension-firefox/` folder
4. Pin the STASH icon to your toolbar

## Use it

- **Click the toolbar icon** → the tab is stashed instantly, then a popup lets you add **multiple tags** and a **note** before hitting *Done* (or *Copy URL* / *Open Vault*). The popup also shows the save/open-vault shortcuts.
- **⌥⇧S / Alt+Shift+S** → stash the current tab with no popup (a ✓ badge flashes). Firefox uses Cmd/Ctrl+Shift+S for screenshots, so the Firefox build uses Alt/Option instead.
- **⌘⇧K / Ctrl+Shift+K** → open the full vault.
- In the vault: search, filter by tag, sort, switch **Columns / Grid / List** views, toggle **System / Light / Dark**, add links manually with the **+** button, hover a card to **open** or **delete** (with undo). The vault header shows quick shortcut hints.
  - **Full-width, responsive** layout — the grid scales up to **6 columns** on wide screens and collapses to a single column on mobile.
  - **⌘K / Ctrl-K** (or **/**) jumps to search; the shortcut is shown as a hint inside the search field.

> Shortcuts can be remapped at `about:addons` → gear menu → **Manage Extension Shortcuts**.

## Files

| File | Role |
|---|---|
| `manifest.json` | Firefox MV3 manifest — action popup, background script, commands, permissions, Gecko settings |
| `background.js` | Event page: keyboard commands, quick-save logic, open/focus vault, first-run seed |
| `popup.html` / `popup.js` | Quick-save popup — stashes on open, then adds tags + a note |
| `vault.html` / `vault.css` / `vault.js` | The full vault UI (vanilla JS, full-width + responsive) |
| `icons/` | Toolbar icons (16/48/128px) |

## How it works

- **Storage**: bookmarks live under `browser.storage.local` key `bookmarks`; view/sort/theme under `settings`. The vault also falls back to `localStorage` if opened outside the extension, so the page renders standalone for previewing.
- **Sync across surfaces**: saving from the popup or a shortcut writes to storage; an open vault tab listens via `browser.storage.onChanged` and updates live.
- **Favicons**: uses the tab's own `favIconUrl` when Firefox provides one; otherwise the vault shows a text fallback.
- **Permissions**: `tabs` (read the active tab's title/url/favicon, open/focus tabs) and `storage` (save bookmarks/settings locally). No host permissions, no remote scripts, and no extension-initiated network calls.
- **Firefox manifest**: uses `background.scripts` instead of Chrome's `background.service_worker`, and declares `browser_specific_settings.gecko.data_collection_permissions.required: ["none"]`.

## Notes / possible next steps

- Data is per-browser-profile and not synced. Swap `browser.storage.local` for `browser.storage.sync` (with quota limits in mind) if you want cross-device sync.
- Import/export (JSON) and an "edit bookmark" flow are natural additions.
- To publish on addons.mozilla.org, zip the folder contents (not the parent folder) and submit through the AMO Developer Hub. Replace the Gecko ID if you want it tied to your own domain/namespace.
