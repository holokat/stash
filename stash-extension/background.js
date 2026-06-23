// STASH — background service worker (Manifest V3)
// Handles keyboard shortcuts, the quick-save flow, opening the vault, and first-run seeding.

const VAULT_URL = chrome.runtime.getURL('vault.html');

function parseDomain(u) {
  let s = String(u || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { return new URL(s).hostname.replace(/^www\./, ''); }
  catch (e) { return s.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0]; }
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
  return 'reading';
}

async function getBookmarks() {
  const { bookmarks } = await chrome.storage.local.get('bookmarks');
  return Array.isArray(bookmarks) ? bookmarks : [];
}

async function saveBookmark({ url, title, favIconUrl, tag }) {
  if (!url || /^chrome:\/\//i.test(url) || /^chrome-extension:\/\//i.test(url) || /^about:/i.test(url) || /^edge:\/\//i.test(url)) {
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
    bookmarks.unshift(b);
    await chrome.storage.local.set({ bookmarks });
    flashBadge('✓');
    return b;
  }
  const id = bookmarks.reduce((m, b) => Math.max(m, b.id || 0), 0) + 1;
  const nb = {
    id,
    title: (title && title.trim()) || domain,
    domain,
    tag: (tag && String(tag).trim()) || guessTag(domain),
    note: '',
    url,
    favIconUrl: favIconUrl || '',
    savedAt: Date.now()
  };
  bookmarks.unshift(nb);
  await chrome.storage.local.set({ bookmarks });
  flashBadge('✓');
  return nb;
}

let badgeTimer = null;
function flashBadge(text) {
  try {
    chrome.action.setBadgeBackgroundColor({ color: '#F2742B' });
    chrome.action.setBadgeText({ text });
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(() => chrome.action.setBadgeText({ text: '' }), 1400);
  } catch (e) {}
}

async function saveActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  await saveBookmark({ url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl });
}

async function openVault() {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(t => t.url && t.url.startsWith(VAULT_URL));
  if (existing) {
    chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId != null) chrome.windows.update(existing.windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: VAULT_URL });
  }
}

// keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-tab') saveActiveTab();
  else if (command === 'open-vault') openVault();
});

// messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'save-bookmark') {
    saveBookmark(msg.payload).then(b => sendResponse({ ok: true, bookmark: b }));
    return true; // async
  }
  if (msg && msg.type === 'open-vault') { openVault(); sendResponse({ ok: true }); return false; }
  if (msg && msg.type === 'save-active-tab') { saveActiveTab().then(() => sendResponse({ ok: true })); return true; }
});

// first-run welcome set
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason !== 'install') return;
  const existing = await getBookmarks();
  if (existing.length) return;
  const now = Date.now();
  const day = 86400000;
  const seed = [
    ['Welcome to STASH', 'github.com/holokat/stash', 'docs', 'Press ⌘⇧S on any tab to stash it. ⌘⇧K opens this vault.', 0],
    ['Figma', 'figma.com', 'design', 'Your design files.', 2],
    ['GitHub', 'github.com', 'dev', 'Repos, issues and pull requests.', 3],
    ['Anthropic Console', 'console.anthropic.com', 'ai', 'Claude API keys, usage and logs.', 5],
    ['Linear', 'linear.app', 'tools', 'Issue tracking and planning.', 6],
    ['Hacker News', 'news.ycombinator.com', 'reading', 'Tech news and discussion.', 9]
  ].map((d, i) => ({
    id: i + 1,
    title: d[0],
    domain: parseDomain(d[1]),
    tag: d[2],
    note: d[3],
    url: 'https://' + d[1],
    favIconUrl: '',
    savedAt: now - d[4] * day
  }));
  await chrome.storage.local.set({ bookmarks: seed });
});
