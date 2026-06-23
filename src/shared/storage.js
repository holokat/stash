export const DEFAULT_SETTINGS = {
  layout: 'masonry',
  sort: 'recent',
  themeMode: 'dark',
  lightPalette: 'default',
  darkPalette: 'default',
  uiFont: 'default',
  masonryColumns: 4,
  compactCards: false,
};

const DB_NAME = 'stash-db';
const DB_VERSION = 1;
const BOOKMARK_STORE = 'bookmarks';
const SETTINGS_STORE = 'settings';
const SETTINGS_DOC_KEY = 'ui';
const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);
let dbPromise = null;

function now() {
  return Date.now();
}

function makeId() {
  return crypto.randomUUID();
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
  });
}

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(BOOKMARK_STORE)) {
        const bookmarks = db.createObjectStore(BOOKMARK_STORE, { keyPath: 'id' });
        bookmarks.createIndex('url', 'url', { unique: true });
        bookmarks.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Unable to open IndexedDB'));
    };
  });

  return dbPromise;
}

function safeUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isSupportedBookmarkUrl(url) {
  const parsed = safeUrl(url);
  return !!parsed && SUPPORTED_PROTOCOLS.has(parsed.protocol);
}

export function normalizeTag(tag) {
  return tag.replace(/^#+/, '').trim().toLowerCase();
}

function uniqTags(tags = []) {
  const normalized = tags
    .map((tag) => normalizeTag(tag))
    .filter(Boolean);
  return [...new Set(normalized)];
}

function deriveTitle(url) {
  const parsed = safeUrl(url);
  if (!parsed) return 'Untitled';
  return parsed.hostname.replace(/^www\./, '') || 'Untitled';
}

function getDomain(url) {
  const parsed = safeUrl(url);
  if (!parsed) return '';
  return parsed.hostname.replace(/^www\./, '');
}

function defaultFaviconForUrl(url) {
  const parsed = safeUrl(url);
  if (!parsed) return '';
  return `${parsed.origin}/favicon.ico`;
}

export function buildBookmarkFromTab(tab) {
  return {
    id: makeId(),
    url: tab.url,
    title: (tab.title || '').trim() || deriveTitle(tab.url),
    description: '',
    note: '',
    tags: [],
    hostname: getDomain(tab.url),
    favicon: tab.favIconUrl || defaultFaviconForUrl(tab.url),
    previewImage: '',
    createdAt: now(),
    updatedAt: now(),
  };
}

function sortByMode(bookmarks, sort) {
  const ranked = [...bookmarks];

  const compare = {
    recent: (a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt,
    oldest: (a, b) => a.updatedAt - b.updatedAt || a.createdAt - b.createdAt,
    title_asc: (a, b) => a.title.localeCompare(b.title),
    title_desc: (a, b) => b.title.localeCompare(a.title),
    domain: (a, b) => a.hostname.localeCompare(b.hostname) || b.updatedAt - a.updatedAt,
  }[sort] || compareRecent;

  ranked.sort(compare);
  return ranked;
}

function compareRecent(a, b) {
  return b.updatedAt - a.updatedAt || b.createdAt - a.createdAt;
}

export async function getBookmarks({ sort = 'recent' } = {}) {
  const db = await openDb();
  const tx = db.transaction(BOOKMARK_STORE, 'readonly');
  const store = tx.objectStore(BOOKMARK_STORE);
  const bookmarks = await requestToPromise(store.getAll());
  await txDone(tx);
  return sortByMode(bookmarks, sort);
}

async function getBookmarkByUrl(url, tx) {
  const index = tx.objectStore(BOOKMARK_STORE).index('url');
  return requestToPromise(index.get(url));
}

export async function getSettings() {
  const db = await openDb();
  const tx = db.transaction(SETTINGS_STORE, 'readonly');
  const store = tx.objectStore(SETTINGS_STORE);
  const settingsDoc = await requestToPromise(store.get(SETTINGS_DOC_KEY));
  await txDone(tx);
  return { ...DEFAULT_SETTINGS, ...(settingsDoc?.value || {}) };
}

export async function setSettings(partialSettings) {
  const current = await getSettings();
  const next = { ...current, ...partialSettings };

  const db = await openDb();
  const tx = db.transaction(SETTINGS_STORE, 'readwrite');
  tx.objectStore(SETTINGS_STORE).put({ key: SETTINGS_DOC_KEY, value: next });
  await txDone(tx);
  return next;
}

export async function upsertBookmarkFromTab(tab, partial = {}) {
  if (!tab?.url || !isSupportedBookmarkUrl(tab.url)) {
    throw new Error('Unsupported page. Open a regular website to stash it.');
  }

  const db = await openDb();
  const tx = db.transaction(BOOKMARK_STORE, 'readwrite');

  const existing = await getBookmarkByUrl(tab.url, tx);

  if (!existing) {
    const bookmark = {
      ...buildBookmarkFromTab(tab),
      ...partial,
      tags: uniqTags(partial.tags || []),
      description: partial.description || '',
      previewImage: partial.previewImage || '',
      favicon: partial.favicon || tab.favIconUrl || defaultFaviconForUrl(tab.url),
      updatedAt: now(),
    };

    tx.objectStore(BOOKMARK_STORE).put(bookmark);
    await txDone(tx);
    return bookmark;
  }

  const next = {
    ...existing,
    ...partial,
    title: (partial.title || existing.title || '').trim() || deriveTitle(existing.url),
    description: partial.description ?? existing.description ?? '',
    previewImage: partial.previewImage || existing.previewImage || '',
    favicon: partial.favicon || existing.favicon || tab.favIconUrl || defaultFaviconForUrl(existing.url),
    tags: partial.tags ? uniqTags(partial.tags) : existing.tags,
    hostname: getDomain(existing.url),
    updatedAt: now(),
  };

  tx.objectStore(BOOKMARK_STORE).put(next);
  await txDone(tx);
  return next;
}

export async function updateBookmark(id, updates) {
  const db = await openDb();
  const tx = db.transaction(BOOKMARK_STORE, 'readwrite');
  const store = tx.objectStore(BOOKMARK_STORE);
  const current = await requestToPromise(store.get(id));

  if (!current) {
    await txDone(tx);
    return null;
  }

  const next = {
    ...current,
    ...updates,
    title: (updates.title || current.title || '').trim() || deriveTitle(current.url),
    tags: updates.tags ? uniqTags(updates.tags) : current.tags,
    hostname: getDomain(current.url),
    previewImage: updates.previewImage ?? current.previewImage ?? '',
    favicon: updates.favicon ?? current.favicon ?? defaultFaviconForUrl(current.url),
    updatedAt: now(),
  };

  store.put(next);
  await txDone(tx);
  return next;
}

export async function deleteBookmarks(ids) {
  const idSet = new Set(ids);
  const db = await openDb();
  const tx = db.transaction(BOOKMARK_STORE, 'readwrite');
  const store = tx.objectStore(BOOKMARK_STORE);

  for (const id of idSet) {
    store.delete(id);
  }

  await txDone(tx);
  return getBookmarks({ sort: 'recent' });
}

export async function mergeImportedBookmarks(importedBookmarks) {
  const db = await openDb();
  const tx = db.transaction(BOOKMARK_STORE, 'readwrite');
  const store = tx.objectStore(BOOKMARK_STORE);
  const existing = await requestToPromise(store.getAll());
  const byUrl = new Map(existing.map((bookmark) => [bookmark.url, bookmark]));

  for (const incoming of importedBookmarks) {
    if (!incoming?.url || !isSupportedBookmarkUrl(incoming.url)) continue;

    const base = byUrl.get(incoming.url) || {
      id: makeId(),
      createdAt: now(),
      url: incoming.url,
    };

    const merged = {
      ...base,
      ...incoming,
      id: base.id,
      url: incoming.url,
      title: (incoming.title || base.title || '').trim() || deriveTitle(incoming.url),
      description: incoming.description || base.description || '',
      note: incoming.note || base.note || '',
      tags: uniqTags(incoming.tags || base.tags || []),
      hostname: getDomain(incoming.url),
      favicon: incoming.favicon || base.favicon || defaultFaviconForUrl(incoming.url),
      previewImage: incoming.previewImage || base.previewImage || '',
      createdAt: base.createdAt || now(),
      updatedAt: now(),
    };

    byUrl.set(incoming.url, merged);
    store.put(merged);
  }

  await txDone(tx);
  return sortByMode([...byUrl.values()], 'recent');
}

export function collectTags(bookmarks) {
  const counts = new Map();
  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function bookmarkSearchText(bookmark) {
  const values = [
    bookmark.title,
    bookmark.url,
    bookmark.hostname,
    bookmark.description,
    bookmark.note,
    ...(bookmark.tags || []),
  ];

  return values
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function exportPayload(bookmarks) {
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    app: 'Stash',
    bookmarks,
  };
}

export function createExportFilename(prefix = 'stash-bookmarks') {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}-${timestamp}.json`;
}

export function downloadJson(filename, payloadObject) {
  const data = JSON.stringify(payloadObject, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const SORT_OPTIONS = [
  { value: 'recent', label: 'Most recent' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title_asc', label: 'Title A-Z' },
  { value: 'title_desc', label: 'Title Z-A' },
  { value: 'domain', label: 'Domain' },
];
