# Stash Chrome Extension (Local-First)

Stash is a local-only bookmark extension inspired by MyMind patterns.

## Features

- One-click save from the extension popup.
- Lightweight popup editor for tags and notes.
- Automatic Open Graph/Twitter preview image capture when available.
- Favicon capture from page metadata (with `/favicon.ico` fallback).
- IndexedDB persistence (no login, no cloud dependency).
- Theme mode: `Auto` (time-based), `Light`, `Dark`.
- Appearance settings: UI font options and dark palette selection.
- Extension action context menu item: `Open Stash`.
- Settings modal with configurable masonry columns.
- Search bookmarks by title, URL, tag, description, and note.
- Layout modes: masonry (default), grid, list.
- Sort modes: most recent (default), oldest, title A-Z, title Z-A, domain.
- Tag navigation and quick tag filtering.
- Bookmark actions: copy URL, edit, delete.
- Bulk mode: select visible, clear, bulk add tag, bulk copy URLs, bulk export, bulk delete.
- Export all or selected bookmarks to JSON; import supported.
- Keyboard shortcuts:
  - `/` focuses search in library.
  - `Ctrl+Shift+K` (`Cmd+Shift+K` on Mac) opens the Stash library.
  - `Ctrl+Shift+S` (`Cmd+Shift+S` on Mac) quick-saves active tab.

## Project Structure

- `manifest.json`
- `src/background/service-worker.js`
- `src/shared/storage.js`
- `src/shared/page-metadata.js`
- `src/shared/theme.js`
- `src/shared/icons.js`
- `src/popup/*`
- `src/manager/*`

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click **Load unpacked**.
4. Select this folder: `/Users/k/code/stash`.

## Notes

- Data is stored in the extension's IndexedDB storage area only.
- Exported JSON includes tags, notes, and metadata.
