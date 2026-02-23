import {
  SORT_OPTIONS,
  bookmarkSearchText,
  collectTags,
  createExportFilename,
  deleteBookmarks,
  downloadJson,
  exportPayload,
  getBookmarks,
  getSettings,
  mergeImportedBookmarks,
  normalizeTag,
  setSettings,
  updateBookmark,
} from '../shared/storage.js';
import { iconSvg } from '../shared/icons.js';
import { applyThemeWithPalette } from '../shared/theme.js';

const ui = {
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  themeButtons: [...document.querySelectorAll('.theme-btn')],
  layoutButtons: [...document.querySelectorAll('.layout-btn')],
  settingsBtn: document.getElementById('settingsBtn'),
  bulkToggleBtn: document.getElementById('bulkToggleBtn'),
  exportAllBtn: document.getElementById('exportAllBtn'),
  importBtn: document.getElementById('importBtn'),
  importFileInput: document.getElementById('importFileInput'),
  tagList: document.getElementById('tagList'),
  bulkBar: document.getElementById('bulkBar'),
  bulkCount: document.getElementById('bulkCount'),
  selectVisibleBtn: document.getElementById('selectVisibleBtn'),
  clearSelectionBtn: document.getElementById('clearSelectionBtn'),
  bulkAddTagBtn: document.getElementById('bulkAddTagBtn'),
  bulkCopyUrlsBtn: document.getElementById('bulkCopyUrlsBtn'),
  bulkExportBtn: document.getElementById('bulkExportBtn'),
  bulkDeleteBtn: document.getElementById('bulkDeleteBtn'),
  bookmarkContainer: document.getElementById('bookmarkContainer'),
  emptyState: document.getElementById('emptyState'),
  editDialog: document.getElementById('editDialog'),
  editForm: document.getElementById('editForm'),
  editTitleInput: document.getElementById('editTitleInput'),
  editUrlInput: document.getElementById('editUrlInput'),
  editDescriptionInput: document.getElementById('editDescriptionInput'),
  editNoteInput: document.getElementById('editNoteInput'),
  editTagsInput: document.getElementById('editTagsInput'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  masonryColumnsInput: document.getElementById('masonryColumnsInput'),
  masonryColumnsValue: document.getElementById('masonryColumnsValue'),
  cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
  uiFontSelect: document.getElementById('uiFontSelect'),
  lightPaletteSelect: document.getElementById('lightPaletteSelect'),
  darkPaletteSelect: document.getElementById('darkPaletteSelect'),
};

const state = {
  bookmarks: [],
  layout: 'masonry',
  sort: 'recent',
  themeMode: 'auto',
  uiFont: 'default',
  lightPalette: 'default',
  darkPalette: 'default',
  masonryColumns: 4,
  query: '',
  activeTag: null,
  bulkMode: false,
  selectedIds: new Set(),
  editingId: null,
  metadataAttempted: new Set(),
  metadataInFlight: new Set(),
};

async function init() {
  hydrateSortOptions();
  hydrateControlIcons();
  hydrateThemeIcons();
  bindEvents();

  const settings = await getSettings();
  state.layout = settings.layout;
  state.sort = settings.sort;
  state.themeMode = settings.themeMode || 'auto';
  state.uiFont = sanitizeFontValue(settings.uiFont || 'default');
  state.lightPalette = settings.lightPalette || 'default';
  state.darkPalette = settings.darkPalette || 'default';
  state.masonryColumns = clampMasonryColumns(settings.masonryColumns ?? 4);
  state.bulkMode = false;
  state.selectedIds.clear();

  ui.sortSelect.value = state.sort;
  setLayoutButtons();
  setThemeButtons();
  applyCurrentTheme();
  applyMasonryColumns();

  await refreshBookmarks();
  render();

  requestAnimationFrame(() => {
    ui.searchInput.focus();
    ui.searchInput.select();
  });

  setInterval(() => {
    if (state.themeMode === 'auto') {
      applyCurrentTheme();
    }
  }, 60_000);

  window.addEventListener('resize', debounce(() => {
    applyMasonryColumns();
  }, 120));
}

function hydrateSortOptions() {
  ui.sortSelect.innerHTML = SORT_OPTIONS
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('');
}

function hydrateControlIcons() {
  const layoutIconByMode = {
    masonry: 'columns3',
    grid: 'grid2x2',
    list: 'list',
  };

  for (const button of ui.layoutButtons) {
    const mode = button.dataset.layout;
    const icon = layoutIconByMode[mode] || 'grid2x2';
    button.innerHTML = iconSvg(icon, { size: 14 });
  }

  ui.bulkToggleBtn.innerHTML = iconSvg('layers', { size: 15 });
  ui.exportAllBtn.innerHTML = iconSvg('download', { size: 15 });
  ui.importBtn.innerHTML = iconSvg('upload', { size: 15 });
  ui.settingsBtn.innerHTML = iconSvg('settings', { size: 15 });
}

function hydrateThemeIcons() {
  for (const button of ui.themeButtons) {
    const mode = button.dataset.themeMode;
    if (mode === 'auto') {
      button.innerHTML = iconSvg('monitor', { size: 14 });
      continue;
    }

    if (mode === 'light') {
      button.innerHTML = iconSvg('sun', { size: 14 });
      continue;
    }

    button.innerHTML = iconSvg('moon', { size: 14 });
  }
}

function bindEvents() {
  ui.searchInput.addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  ui.sortSelect.addEventListener('change', async (event) => {
    state.sort = event.target.value;
    await setSettings({ sort: state.sort });
    await refreshBookmarks();
    render();
  });

  for (const button of ui.layoutButtons) {
    button.addEventListener('click', async () => {
      state.layout = button.dataset.layout;
      setLayoutButtons();
      await setSettings({ layout: state.layout });
      render();
    });
  }

  for (const button of ui.themeButtons) {
    button.addEventListener('click', async () => {
      state.themeMode = button.dataset.themeMode || 'auto';
      setThemeButtons();
      applyCurrentTheme();
      await setSettings({ themeMode: state.themeMode });
    });
  }

  ui.bulkToggleBtn.addEventListener('click', () => {
    state.bulkMode = !state.bulkMode;
    if (!state.bulkMode) state.selectedIds.clear();
    render();
  });

  ui.settingsBtn.addEventListener('click', () => {
    ui.masonryColumnsInput.value = String(state.masonryColumns);
    ui.masonryColumnsValue.textContent = String(state.masonryColumns);
    ui.uiFontSelect.value = state.uiFont;
    ui.lightPaletteSelect.value = state.lightPalette;
    ui.darkPaletteSelect.value = state.darkPalette;
    ui.settingsDialog.showModal();
  });

  ui.uiFontSelect.addEventListener('change', (event) => {
    state.uiFont = sanitizeFontValue(event.target.value);
    applyCurrentTheme();
  });

  ui.masonryColumnsInput.addEventListener('input', (event) => {
    const value = clampMasonryColumns(Number(event.target.value));
    ui.masonryColumnsValue.textContent = String(value);
  });

  ui.lightPaletteSelect.addEventListener('change', (event) => {
    state.lightPalette = sanitizePaletteValue(event.target.value, 'light');
    applyCurrentTheme();
  });

  ui.darkPaletteSelect.addEventListener('change', (event) => {
    state.darkPalette = sanitizePaletteValue(event.target.value, 'dark');
    applyCurrentTheme();
  });

  ui.cancelSettingsBtn.addEventListener('click', () => {
    ui.settingsDialog.close();
  });

  ui.settingsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const next = clampMasonryColumns(Number(ui.masonryColumnsInput.value));
    const nextUiFont = sanitizeFontValue(ui.uiFontSelect.value);
    const nextLightPalette = sanitizePaletteValue(ui.lightPaletteSelect.value, 'light');
    const nextDarkPalette = sanitizePaletteValue(ui.darkPaletteSelect.value, 'dark');
    state.masonryColumns = next;
    state.uiFont = nextUiFont;
    state.lightPalette = nextLightPalette;
    state.darkPalette = nextDarkPalette;
    applyMasonryColumns();
    applyCurrentTheme();
    await setSettings({
      masonryColumns: next,
      uiFont: nextUiFont,
      lightPalette: nextLightPalette,
      darkPalette: nextDarkPalette,
    });
    ui.settingsDialog.close();
  });

  ui.exportAllBtn.addEventListener('click', () => {
    downloadJson(createExportFilename(), exportPayload(state.bookmarks));
  });

  ui.importBtn.addEventListener('click', () => {
    ui.importFileInput.click();
  });

  ui.importFileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const importedBookmarks = Array.isArray(parsed) ? parsed : parsed?.bookmarks;
      if (!Array.isArray(importedBookmarks)) {
        throw new Error('Expected a JSON array or { bookmarks: [] }.');
      }

      await mergeImportedBookmarks(importedBookmarks);
      await refreshBookmarks();
      render();
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    } finally {
      event.target.value = '';
    }
  });

  ui.selectVisibleBtn.addEventListener('click', () => {
    const visible = getFilteredBookmarks();
    for (const bookmark of visible) {
      state.selectedIds.add(bookmark.id);
    }
    render();
  });

  ui.clearSelectionBtn.addEventListener('click', () => {
    state.selectedIds.clear();
    render();
  });

  ui.bulkAddTagBtn.addEventListener('click', async () => {
    if (!state.selectedIds.size) return;
    const value = prompt('Tag to add to selected bookmarks:');
    const tag = value ? normalizeTag(value) : '';
    if (!tag) return;

    const selected = state.bookmarks.filter((bookmark) => state.selectedIds.has(bookmark.id));

    await Promise.all(
      selected.map((bookmark) => {
        const tags = bookmark.tags.includes(tag) ? bookmark.tags : [...bookmark.tags, tag];
        return updateBookmark(bookmark.id, { tags });
      })
    );

    await refreshBookmarks();
    render();
  });

  ui.bulkCopyUrlsBtn.addEventListener('click', async () => {
    const selected = state.bookmarks.filter((bookmark) => state.selectedIds.has(bookmark.id));
    const text = selected.map((bookmark) => bookmark.url).join('\n');
    if (!text) return;
    await navigator.clipboard.writeText(text);
    flashButton(ui.bulkCopyUrlsBtn, 'Copied');
  });

  ui.bulkExportBtn.addEventListener('click', () => {
    const selected = state.bookmarks.filter((bookmark) => state.selectedIds.has(bookmark.id));
    downloadJson(createExportFilename('stash-selected'), exportPayload(selected));
  });

  ui.bulkDeleteBtn.addEventListener('click', async () => {
    if (!state.selectedIds.size) return;

    const proceed = confirm(`Delete ${state.selectedIds.size} selected bookmarks?`);
    if (!proceed) return;

    await deleteBookmarks([...state.selectedIds]);
    state.selectedIds.clear();
    await refreshBookmarks();
    render();
  });

  ui.tagList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tag-filter]');
    if (!button) return;

    const tag = button.dataset.tagFilter;
    state.activeTag = tag === '__all__' ? null : tag;
    render();
  });

  ui.bookmarkContainer.addEventListener('click', onBookmarkContainerClick);

  ui.cancelEditBtn.addEventListener('click', () => {
    ui.editDialog.close();
  });

  ui.editForm.addEventListener('submit', onEditSubmit);

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !isTypingTarget(event.target)) {
      event.preventDefault();
      ui.searchInput.focus();
      ui.searchInput.select();
      return;
    }

    if (event.key === 'Escape' && document.activeElement === ui.searchInput && ui.searchInput.value) {
      ui.searchInput.value = '';
      state.query = '';
      render();
    }
  });
}

async function onBookmarkContainerClick(event) {
  const actionTarget = event.target.closest('[data-action]');
  const card = event.target.closest('.card[data-id]');
  if (!card) return;
  const anchor = event.target.closest('a[href]');

  // Never hijack normal bookmark opening behavior.
  if (anchor && !actionTarget) return;

  const id = card.dataset.id;
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) return;

  if (!actionTarget) {
    if (state.bulkMode && !isTypingTarget(event.target)) {
      event.preventDefault();
      toggleSelection(id);
      render();
    }
    return;
  }

  const action = actionTarget.dataset.action;

  if (action === 'toggle-select') {
    toggleSelection(id);
    render();
    return;
  }

  if (action === 'copy-url') {
    await navigator.clipboard.writeText(bookmark.url);
    flashButton(actionTarget, 'Copied');
    return;
  }

  if (action === 'delete') {
    const proceed = confirm(`Delete "${bookmark.title}"?`);
    if (!proceed) return;

    await deleteBookmarks([id]);
    state.selectedIds.delete(id);
    await refreshBookmarks();
    render();
    return;
  }

  if (action === 'edit') {
    openEditDialog(bookmark);
    return;
  }

  if (action === 'tag-filter') {
    const tag = actionTarget.dataset.tag;
    state.activeTag = tag;
    render();
    return;
  }
}

async function onEditSubmit(event) {
  event.preventDefault();
  if (!state.editingId) return;

  const tags = ui.editTagsInput.value
    .split(',')
    .map((part) => normalizeTag(part))
    .filter(Boolean);

  await updateBookmark(state.editingId, {
    title: ui.editTitleInput.value.trim(),
    description: ui.editDescriptionInput.value.trim(),
    note: ui.editNoteInput.value.trim(),
    tags,
  });

  ui.editDialog.close();
  state.editingId = null;

  await refreshBookmarks();
  render();
}

function openEditDialog(bookmark) {
  state.editingId = bookmark.id;
  ui.editTitleInput.value = bookmark.title;
  ui.editUrlInput.value = bookmark.url;
  ui.editDescriptionInput.value = bookmark.description || '';
  ui.editNoteInput.value = bookmark.note || '';
  ui.editTagsInput.value = (bookmark.tags || []).join(', ');
  ui.editDialog.showModal();
}

async function refreshBookmarks() {
  state.bookmarks = await getBookmarks({ sort: state.sort });
  const validIds = new Set(state.bookmarks.map((bookmark) => bookmark.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
}

function getFilteredBookmarks() {
  return state.bookmarks.filter((bookmark) => {
    if (state.activeTag && !bookmark.tags.includes(state.activeTag)) {
      return false;
    }

    if (!state.query) return true;
    return bookmarkSearchText(bookmark).includes(state.query);
  });
}

function render() {
  renderTagList();
  renderBulkBar();
  renderCards();
}

function renderTagList() {
  const tags = collectTags(state.bookmarks);
  const html = [
    tagFilterMarkup('All bookmarks', state.bookmarks.length, '__all__', !state.activeTag),
    ...tags.map((tag) => tagFilterMarkup(tag.name, tag.count, tag.name, state.activeTag === tag.name)),
  ];

  ui.tagList.innerHTML = html.join('');
}

function tagFilterMarkup(label, count, tag, active) {
  return `
    <button type="button" class="tag-filter ${active ? 'active' : ''}" data-tag-filter="${escapeAttr(tag)}">
      <span>${escapeHtml(label)}</span>
      <span class="tag-count">${count}</span>
    </button>
  `;
}

function renderBulkBar() {
  const showBar = state.bulkMode && state.selectedIds.size > 0;
  ui.bulkBar.hidden = !showBar;
  ui.bulkBar.style.display = showBar ? 'flex' : 'none';
  document.body.classList.toggle('bulk-mode', state.bulkMode);
  ui.bulkToggleBtn.classList.toggle('active', state.bulkMode);
  ui.bulkToggleBtn.setAttribute('title', state.bulkMode ? 'Exit bulk mode' : 'Bulk mode');
  ui.bulkToggleBtn.setAttribute('aria-label', state.bulkMode ? 'Exit bulk mode' : 'Bulk mode');
  ui.bulkCount.textContent = `${state.selectedIds.size} selected`;
}

function renderCards() {
  const filtered = getFilteredBookmarks();

  ui.bookmarkContainer.className = `bookmarks view-${state.layout}`;
  ui.emptyState.hidden = filtered.length > 0;

  if (!filtered.length) {
    ui.bookmarkContainer.innerHTML = '';
    return;
  }

  ui.bookmarkContainer.innerHTML = filtered.map((bookmark) => cardMarkup(bookmark)).join('');
  wireImageFallbacks();
  void enrichMissingMetadata(filtered);
}

function cardMarkup(bookmark) {
  const preview = bookmark.note || bookmark.description || 'No note yet.';
  const isSelected = state.selectedIds.has(bookmark.id);

  return `
    <article class="card" data-id="${bookmark.id}">
      ${previewMarkup(bookmark)}
      <div class="card-main">
        <div class="card-top">
          <input class="card-check" type="checkbox" data-action="toggle-select" ${isSelected ? 'checked' : ''} aria-label="Select bookmark" />
          <div class="favicon">${faviconMarkup(bookmark)}</div>
          <div class="card-title-wrap">
            <h3 class="card-title">
              <a href="${escapeAttr(bookmark.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(bookmark.title)}</a>
            </h3>
            <p class="card-url">${escapeHtml(bookmark.hostname || bookmark.url)}</p>
          </div>
        </div>

        <div class="card-body">${escapeHtml(preview)}</div>

        <div class="card-tags">
          ${(bookmark.tags || [])
            .map(
              (tag) =>
                `<button type="button" class="tag-chip-btn" data-action="tag-filter" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)}</button>`
            )
            .join('')}
        </div>

        <div class="card-actions">
          <button type="button" class="card-action icon-btn" title="Copy URL" aria-label="Copy URL" data-action="copy-url">${iconSvg('copy', { size: 15 })}</button>
          <button type="button" class="card-action icon-btn" title="Edit bookmark" aria-label="Edit bookmark" data-action="edit">${iconSvg('pencil', { size: 15 })}</button>
          <button type="button" class="card-action icon-btn danger" title="Delete bookmark" aria-label="Delete bookmark" data-action="delete">${iconSvg('trash2', { size: 15 })}</button>
        </div>
      </div>
    </article>
  `;
}

function previewMarkup(bookmark) {
  const fallbackText = bookmark.hostname || 'Open';
  if (bookmark.previewImage) {
    return `<a class="card-preview" data-fallback="${escapeAttr(fallbackText)}" href="${escapeAttr(
      bookmark.url
    )}" target="_blank" rel="noreferrer noopener"><img src="${escapeAttr(bookmark.previewImage)}" alt="Preview image for ${escapeAttr(
      bookmark.title
    )}" loading="lazy" /></a>`;
  }

  return `<a class="card-preview is-fallback" data-fallback="${escapeAttr(fallbackText)}" href="${escapeAttr(
    bookmark.url
  )}" target="_blank" rel="noreferrer noopener"></a>`;
}

function faviconMarkup(bookmark) {
  const seed = (bookmark.hostname || bookmark.title || '?').charAt(0).toUpperCase();
  if (bookmark.favicon) {
    return `<span class="favicon-fallback">${escapeHtml(seed)}</span><img src="${escapeAttr(
      bookmark.favicon
    )}" alt="" loading="lazy" />`;
  }

  return `<span class="favicon-fallback">${escapeHtml(seed)}</span>`;
}

function toggleSelection(id) {
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
    return;
  }

  state.selectedIds.add(id);
}

function setLayoutButtons() {
  for (const button of ui.layoutButtons) {
    button.classList.toggle('active', button.dataset.layout === state.layout);
  }
}

function setThemeButtons() {
  for (const button of ui.themeButtons) {
    button.classList.toggle('active', button.dataset.themeMode === state.themeMode);
  }
}

function applyCurrentTheme() {
  applyThemeWithPalette(state.themeMode, {
    uiFont: state.uiFont,
    lightPalette: state.lightPalette,
    darkPalette: state.darkPalette,
  });
}

function applyMasonryColumns() {
  const baseColumns = clampMasonryColumns(state.masonryColumns);
  const effectiveColumns = Math.max(1, Math.min(8, baseColumns + masonryColumnAdjustment(window.innerWidth)));
  ui.bookmarkContainer.style.setProperty('--masonry-columns', String(effectiveColumns));
}

function masonryColumnAdjustment(width) {
  if (width >= 3000) return 1;
  if (width >= 1200) return 0;
  if (width >= 800) return -1;
  if (width >= 560) return -2;
  return -3;
}

function clampMasonryColumns(value) {
  if (!Number.isFinite(value)) return 4;
  return Math.max(2, Math.min(8, Math.round(value)));
}

function sanitizePaletteValue(value, theme) {
  if (theme === 'light') {
    return value === 'default' ? 'default' : 'default';
  }

  return value === 'neutral' ? 'neutral' : 'default';
}

function sanitizeFontValue(value) {
  if (value === 'geist') return 'geist';
  if (value === 'inter') return 'inter';
  if (value === 'lato') return 'lato';
  return 'default';
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, textarea, select, [contenteditable="true"]');
}

function flashButton(button, text) {
  const originalHtml = button.innerHTML;
  const originalTitle = button.getAttribute('title');

  if (button.classList.contains('icon-btn')) {
    const originalLabel = button.getAttribute('aria-label');
    button.setAttribute('title', text);
    button.setAttribute('aria-label', text);
    button.classList.add('is-flash');
    setTimeout(() => {
      if (originalTitle) button.setAttribute('title', originalTitle);
      if (originalLabel) button.setAttribute('aria-label', originalLabel);
      button.classList.remove('is-flash');
    }, 1100);
    return;
  }

  button.textContent = text;
  setTimeout(() => {
    button.innerHTML = originalHtml;
    if (originalTitle) button.setAttribute('title', originalTitle);
  }, 1100);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function wireImageFallbacks() {
  for (const image of ui.bookmarkContainer.querySelectorAll('.card-preview img')) {
    image.addEventListener(
      'error',
      () => {
        const preview = image.closest('.card-preview');
        if (!preview) return;
        preview.classList.add('is-fallback');
        image.remove();
      },
      { once: true }
    );
  }

  for (const image of ui.bookmarkContainer.querySelectorAll('.favicon img')) {
    image.addEventListener(
      'error',
      () => {
        image.remove();
      },
      { once: true }
    );
  }
}

async function enrichMissingMetadata(filteredBookmarks) {
  const candidates = filteredBookmarks
    .filter((bookmark) => !bookmark.previewImage)
    .filter((bookmark) => isMetadataFetchAllowed(bookmark.url))
    .filter((bookmark) => !state.metadataAttempted.has(bookmark.id))
    .filter((bookmark) => !state.metadataInFlight.has(bookmark.id))
    .slice(0, 3);

  for (const bookmark of candidates) {
    state.metadataInFlight.add(bookmark.id);
    void enrichBookmarkMetadata(bookmark);
  }
}

async function enrichBookmarkMetadata(bookmark) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(bookmark.url, {
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'follow',
      cache: 'no-store',
    });
    if (!response.ok) return;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('text/html')) return;

    const html = await response.text();
    const metadata = extractMetadataFromHtml(html.slice(0, 750000), bookmark.url);

    const updates = {};
    if (metadata.previewImage && !bookmark.previewImage) updates.previewImage = metadata.previewImage;
    if (metadata.description && !bookmark.description) updates.description = metadata.description;
    if (metadata.favicon && !bookmark.favicon) updates.favicon = metadata.favicon;

    if (Object.keys(updates).length === 0) return;

    const updated = await updateBookmark(bookmark.id, updates);
    if (!updated) return;

    state.bookmarks = state.bookmarks.map((item) => (item.id === updated.id ? updated : item));
    render();
  } catch {
    // Keep fallback preview when metadata cannot be fetched.
  } finally {
    clearTimeout(timeout);
    state.metadataInFlight.delete(bookmark.id);
    state.metadataAttempted.add(bookmark.id);
  }
}

function extractMetadataFromHtml(html, pageUrl) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const getMeta = (selector) => doc.querySelector(selector)?.getAttribute('content')?.trim() || '';
  const toAbsolute = (value) => {
    if (!value) return '';
    try {
      return new URL(value, pageUrl).href;
    } catch {
      return '';
    }
  };

  const previewImage = toAbsolute(
    getMeta('meta[property="og:image:secure_url"]') ||
      getMeta('meta[property="og:image:url"]') ||
      getMeta('meta[property="og:image"]') ||
      getMeta('meta[name="twitter:image:src"]') ||
      getMeta('meta[name="twitter:image"]') ||
      doc.querySelector('link[rel="image_src"]')?.getAttribute('href')
  );

  const description =
    getMeta('meta[property="og:description"]') ||
    getMeta('meta[name="twitter:description"]') ||
    getMeta('meta[name="description"]');

  const favicon = toAbsolute(
    doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ||
      doc.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
      doc.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
      '/favicon.ico'
  );

  return { previewImage, description, favicon };
}

function isMetadataFetchAllowed(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
    if (isPrivateIp(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function isPrivateIp(host) {
  const ipv4 = host.match(/^(\\d{1,3}\\.){3}\\d{1,3}$/);
  if (ipv4) {
    const parts = host.split('.').map(Number);
    if (parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (host.includes(':')) {
    const compact = host.toLowerCase();
    if (compact === '::1') return true;
    if (compact.startsWith('fc') || compact.startsWith('fd')) return true;
    if (compact.startsWith('fe80')) return true;
  }

  return false;
}

init();
