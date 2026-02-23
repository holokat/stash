import {
  collectTags,
  getBookmarks,
  getSettings,
  isSupportedBookmarkUrl,
  normalizeTag,
  updateBookmark,
  upsertBookmarkFromTab,
} from '../shared/storage.js';
import { getTabPageMetadata } from '../shared/page-metadata.js';
import { applyThemeWithPalette } from '../shared/theme.js';

const ui = {
  statusTitle: document.getElementById('statusTitle'),
  pageMeta: document.getElementById('pageMeta'),
  tagChips: document.getElementById('tagChips'),
  tagInput: document.getElementById('tagInput'),
  tagSuggestions: document.getElementById('tagSuggestions'),
  noteInput: document.getElementById('noteInput'),
  doneBtn: document.getElementById('doneBtn'),
  copyBtn: document.getElementById('copyBtn'),
  openLibraryBtn: document.getElementById('openLibraryBtn'),
};

const state = {
  bookmark: null,
  allTags: [],
};

const debouncedSaveNote = debounce(async (note) => {
  if (!state.bookmark) return;
  const updated = await updateBookmark(state.bookmark.id, { note });
  if (updated) state.bookmark = updated;
}, 240);

async function init() {
  bindEvents();
  const settings = await getSettings();
  applyThemeWithPalette(settings.themeMode || 'auto', {
    uiFont: settings.uiFont || 'default',
    lightPalette: settings.lightPalette || 'default',
    darkPalette: settings.darkPalette || 'default',
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !isSupportedBookmarkUrl(tab.url)) {
    ui.statusTitle.textContent = 'Cannot stash this page';
    ui.pageMeta.textContent = 'Use Stash on regular web pages (http/https).';
    ui.tagInput.disabled = true;
    ui.noteInput.disabled = true;
    return;
  }

  const existing = await getBookmarks();
  state.allTags = collectTags(existing).map((entry) => entry.name);

  try {
    const metadata = await getTabPageMetadata(tab.id);
    state.bookmark = await upsertBookmarkFromTab(tab, bookmarkPatchFromMetadata(tab, metadata));
    ui.statusTitle.textContent = 'Saved to your stash';
    ui.pageMeta.textContent = `${state.bookmark.title} · ${state.bookmark.hostname}`;
    ui.noteInput.value = state.bookmark.note || '';
    renderTags();
    renderSuggestions();
    ui.tagInput.focus();
  } catch (error) {
    ui.statusTitle.textContent = 'Could not save this page';
    ui.pageMeta.textContent = error.message;
  }
}

function bindEvents() {
  ui.tagInput.addEventListener('keydown', onTagInputKeyDown);
  ui.tagInput.addEventListener('input', renderSuggestions);
  ui.tagInput.addEventListener('blur', () => {
    addTag(ui.tagInput.value);
  });

  ui.noteInput.addEventListener('input', (event) => {
    debouncedSaveNote(event.target.value.trim());
  });

  ui.doneBtn.addEventListener('click', () => {
    window.close();
  });

  ui.copyBtn.addEventListener('click', async () => {
    if (!state.bookmark?.url) return;
    await navigator.clipboard.writeText(state.bookmark.url);
    ui.copyBtn.textContent = 'Copied';
    setTimeout(() => {
      ui.copyBtn.textContent = 'Copy URL';
    }, 1200);
  });

  ui.openLibraryBtn.addEventListener('click', async () => {
    const url = chrome.runtime.getURL('src/manager/manager.html');
    await chrome.tabs.create({ url });
    window.close();
  });
}

function onTagInputKeyDown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    addTag(ui.tagInput.value);
    return;
  }

  if (event.key === 'Backspace' && !ui.tagInput.value.trim() && state.bookmark?.tags?.length) {
    event.preventDefault();
    const nextTags = state.bookmark.tags.slice(0, -1);
    persistTags(nextTags);
  }
}

function addTag(rawTag) {
  if (!state.bookmark) return;
  const tag = normalizeTag(rawTag);
  if (!tag) {
    ui.tagInput.value = '';
    renderSuggestions();
    return;
  }

  if (state.bookmark.tags.includes(tag)) {
    ui.tagInput.value = '';
    renderSuggestions();
    return;
  }

  const nextTags = [...state.bookmark.tags, tag];
  persistTags(nextTags);
  ui.tagInput.value = '';
  renderSuggestions();
}

async function persistTags(nextTags) {
  if (!state.bookmark) return;
  const updated = await updateBookmark(state.bookmark.id, { tags: nextTags });
  if (!updated) return;

  state.bookmark = updated;
  state.allTags = [...new Set([...state.allTags, ...nextTags])].sort();

  renderTags();
  renderSuggestions();
}

function removeTag(tagToRemove) {
  if (!state.bookmark) return;
  const nextTags = state.bookmark.tags.filter((tag) => tag !== tagToRemove);
  persistTags(nextTags);
}

function renderTags() {
  ui.tagChips.textContent = '';
  const tags = state.bookmark?.tags || [];

  for (const tag of tags) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `<span>${tag}</span>`;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove tag ${tag}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeTag(tag));

    chip.append(removeBtn);
    ui.tagChips.append(chip);
  }
}

function renderSuggestions() {
  ui.tagSuggestions.textContent = '';

  if (!state.bookmark) return;
  const currentTags = new Set(state.bookmark.tags || []);
  const input = normalizeTag(ui.tagInput.value || '');

  const suggestions = state.allTags
    .filter((tag) => !currentTags.has(tag))
    .filter((tag) => !input || tag.includes(input))
    .slice(0, 8);

  for (const suggestion of suggestions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = suggestion;
    button.addEventListener('click', () => {
      addTag(suggestion);
      ui.tagInput.focus();
    });

    ui.tagSuggestions.append(button);
  }
}

function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function bookmarkPatchFromMetadata(tab, metadata) {
  const patch = {};

  if (metadata.title) patch.title = metadata.title;
  if (metadata.description) patch.description = metadata.description;
  if (metadata.previewImage) patch.previewImage = metadata.previewImage;
  if (metadata.favicon) patch.favicon = metadata.favicon;
  if (!patch.favicon && tab.favIconUrl) patch.favicon = tab.favIconUrl;

  return patch;
}

init();
