// STASH — Firefox background event page (Manifest V3)
// Handles keyboard shortcuts, the quick-save flow, opening the vault, and first-run seeding.

const ext = typeof browser !== 'undefined' ? browser : chrome;
const VAULT_URL = ext.runtime.getURL('vault.html');

function parseDomain(u) {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { return new URL(s).hostname.replace(/^www\./, ''); }
  catch (e) { return s.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0]; }
}

function cleanTag(t) {
  return String(t || '').trim().toLowerCase();
}

function uniqTags(tags) {
  const out = [];
  (tags || []).forEach(t => {
    const clean = cleanTag(t);
    if (clean && out.indexOf(clean) < 0) out.push(clean);
  });
  return out;
}

function bookmarkTags(b) {
  return uniqTags(Array.isArray(b && b.tags) ? b.tags : (b && b.tag ? [b.tag] : []));
}

function guessTag(domain) {
  const d = domain.toLowerCase();
  const map = [
    [/(github|gitlab|vercel|netlify|railway|render|npmjs|stackoverflow)/, 'dev'],
    [/(figma|dribbble|behance|mobbin|framer|coolors|fonts\.google)/, 'design'],
    [/(openai|anthropic|perplexity|midjourney|huggingface|elevenlabs|gemini|aistudio)/, 'ai'],
    [/(stripe|mercury|ramp|polar|brex|wise)/, 'finance'],
    [/(x\.com|twitter|linkedin|threads|bsky|instagram|facebook|reddit)/, 'social'],
    [/(notion|docs\.|developer\.|mdn|caniuse|readme)/, 'docs'],
    [/(youtube|medium|substack|news\.|are\.na|cosmos)/, 'reading'],
    [/(cloudflare|aws|gcp|cloudinary|supabase)/, 'hosting']
  ];
  for (const [re, t] of map) if (re.test(d)) return t;
  return '';
}

async function getBookmarks() {
  const { bookmarks } = await ext.storage.local.get('bookmarks');
  return Array.isArray(bookmarks) ? bookmarks : [];
}

async function saveBookmark({ url, title, favIconUrl, tag }) {
  if (!url || /^(chrome|edge|about|chrome-extension|moz-extension):/i.test(url)) {
    flashBadge('—');
    return null;
  }
  const domain = parseDomain(url);
  const bookmarks = await getBookmarks();
  // de-dupe: if same url already saved, bump it to top
  const existingIdx = bookmarks.findIndex(b => b.url === url);
  if (existingIdx >= 0) {
    const [b] = bookmarks.splice(existingIdx, 1);
    b.savedAt = Date.now();
    b.tags = bookmarkTags(b);
    b.tag = b.tags[0] || '';
    bookmarks.unshift(b);
    await ext.storage.local.set({ bookmarks });
    flashBadge('✓');
    return b;
  }
  const id = bookmarks.reduce((m, b) => Math.max(m, b.id || 0), 0) + 1;
  const guessed = cleanTag(tag) || guessTag(domain);
  const tags = guessed ? [guessed] : [];
  const nb = {
    id,
    title: (title && title.trim()) || domain,
    domain,
    tag: tags[0] || '',
    tags,
    note: '',
    url,
    favIconUrl: favIconUrl || '',
    savedAt: Date.now()
  };
  bookmarks.unshift(nb);
  await ext.storage.local.set({ bookmarks });
  flashBadge('✓');
  return nb;
}

let badgeTimer = null;
function flashBadge(text) {
  try {
    ext.action.setBadgeBackgroundColor({ color: '#F2742B' });
    ext.action.setBadgeText({ text });
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => ext.action.setBadgeText({ text: '' }), 1400);
  } catch (e) {}
}

async function saveActiveTab() {
  const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await saveBookmark({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
}

async function openVault() {
  const tabs = await ext.tabs.query({});
  const existing = tabs.find(t => t.url && t.url.startsWith(VAULT_URL));
  if (existing) {
    ext.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) ext.windows.update(existing.windowId, { focused: true });
  } else {
    ext.tabs.create({ url: VAULT_URL });
  }
}

// keyboard shortcuts
ext.commands.onCommand.addListener((command) => {
  if (command === 'save-tab') saveActiveTab();
  else if (command === 'open-vault') openVault();
});

// messages from popup
ext.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'save-bookmark') {
    return saveBookmark(msg.payload).then(b => ({ ok: true, bookmark: b }));
  }
  if (msg && msg.type === 'open-vault') return openVault().then(() => ({ ok: true }));
  if (msg && msg.type === 'save-active-tab') return saveActiveTab().then(() => ({ ok: true }));
});

// New installs start with an empty stash — no seeded bookmarks.
