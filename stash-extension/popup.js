/* STASH — quick-save popup (dark). Stashes the tab on open, then lets you
   enrich it with tags + a note. Writes straight to chrome.storage.local
   (with a localStorage fallback so the popup also renders standalone). */
(function () {
  'use strict';

  const ACCENT = '#F2742B', ACCENT2 = '#FF9D5C', ON = '#1a0f0a';
  const PRESET_TAGS = ['design', 'dev', 'ai', 'reading', 'docs', 'tools', 'finance', 'social', 'hosting', '3d'];
  const root = document.getElementById('root');
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  let tab = null;
  let savedId = null;
  let blocked = false;
  let selected = new Set();
  let suggestions = [];
  let noteText = '';
  let copied = false;

  // ---------- storage ----------
  function getLocal(key) {
    return new Promise(res => {
      if (hasChrome) { chrome.storage.local.get(key, r => res(r || {})); return; }
      const all = JSON.parse(localStorage.getItem('stash-ext') || '{}');
      const o = {}; o[key] = all[key]; res(o);
    });
  }
  function setLocal(obj) {
    return new Promise(res => {
      if (hasChrome) { chrome.storage.local.set(obj, res); return; }
      const all = JSON.parse(localStorage.getItem('stash-ext') || '{}');
      Object.assign(all, obj); localStorage.setItem('stash-ext', JSON.stringify(all)); res();
    });
  }

  // ---------- helpers ----------
  function parseDomain(u) {
    let s = String(u || '').trim(); if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try { return new URL(s).hostname.replace(/^www\./, ''); } catch (e) { return s.replace(/^https?:\/\//i, '').split('/')[0]; }
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function guessTag(domain) {
    const d = domain.toLowerCase();
    const map = [[/(github|gitlab|vercel|netlify|npmjs|stackoverflow)/, 'dev'], [/(figma|dribbble|behance|mobbin|framer)/, 'design'], [/(openai|anthropic|claude|perplexity|midjourney|gemini|aistudio)/, 'ai'], [/(stripe|mercury|ramp|polar)/, 'finance'], [/(x\.com|twitter|linkedin|threads|bsky|reddit)/, 'social'], [/(notion|docs\.|developer\.|mdn)/, 'docs']];
    for (const [re, t] of map) if (re.test(d)) return t;
    return 'reading';
  }

  // ---------- save / update ----------
  async function stashCurrent() {
    const { bookmarks } = await getLocal('bookmarks');
    const list = Array.isArray(bookmarks) ? bookmarks : [];
    const idx = list.findIndex(b => b.url === tab.url);
    if (idx >= 0) {
      const [b] = list.splice(idx, 1);
      b.savedAt = Date.now(); list.unshift(b);
      savedId = b.id;
      selected = new Set(b.tags && b.tags.length ? b.tags : (b.tag ? [b.tag] : []));
      noteText = b.note || '';
    } else {
      const domain = parseDomain(tab.url);
      const g = guessTag(domain);
      const id = list.reduce((m, b) => Math.max(m, b.id || 0), 0) + 1;
      const b = { id, title: (tab.title && tab.title.trim()) || domain, domain, tag: g, tags: [g], note: '', url: tab.url, favIconUrl: tab.favIconUrl || '', savedAt: Date.now() };
      list.unshift(b);
      savedId = id; selected = new Set([g]); noteText = '';
    }
    await setLocal({ bookmarks: list });
    // build suggestions from the rest of the vault, then presets
    const counts = {};
    list.forEach(b => (b.tags || (b.tag ? [b.tag] : [])).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    const fromVault = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const pool = []; fromVault.concat(PRESET_TAGS).forEach(t => { if (pool.indexOf(t) < 0) pool.push(t); });
    suggestions = pool;
  }

  async function persist() {
    if (savedId == null) return;
    const { bookmarks } = await getLocal('bookmarks');
    const list = Array.isArray(bookmarks) ? bookmarks : [];
    const b = list.find(x => x.id === savedId);
    if (!b) return;
    b.tags = Array.from(selected);
    b.tag = b.tags[0] || b.tag || 'reading';
    b.note = noteText;
    await setLocal({ bookmarks: list });
  }

  // ---------- UI pieces ----------
  function logo(size) {
    const s = size || 44;
    return '<div style="position:relative;width:' + s + 'px;height:' + s + 'px;flex:none;">' +
      '<div style="position:absolute;inset:0;border-radius:' + (s * 0.3) + 'px;background:linear-gradient(135deg,' + ACCENT2 + ',' + ACCENT + ');box-shadow:0 0 22px rgba(242,116,43,.55);"></div>' +
      '<div style="position:absolute;inset:0;border-radius:' + (s * 0.3) + 'px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 6px rgba(0,0,0,.2);"></div>' +
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 34 34" fill="none" style="position:absolute;inset:0;"><circle cx="17" cy="17" r="11" stroke="' + ON + '" stroke-width="1.4" opacity=".4"/><circle cx="17" cy="17" r="9" stroke="' + ON + '" stroke-width="1.7"/><g stroke="' + ON + '" stroke-width="1.8" stroke-linecap="round"><path d="M19 19 22.7 22.7"/><path d="M15 19 11.3 22.7"/><path d="M15 15 11.3 11.3"/><path d="M19 15 22.7 11.3"/></g><circle cx="17" cy="17" r="2.6" fill="' + ON + '"/></svg>' +
    '</div>';
  }

  const card = 'background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);border-radius:18px;';
  const label = 'font-family:\'JetBrains Mono\',monospace;font-size:11px;font-weight:600;letter-spacing:.22em;color:' + ACCENT2 + ';';

  function selChip(t) {
    return '<span class="chip" data-act="untag" data-k="' + esc(t) + '" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:' + ON + ';background:linear-gradient(135deg,' + ACCENT2 + ',' + ACCENT + ');border-radius:999px;padding:6px 9px 6px 12px;cursor:pointer;white-space:nowrap;">' + esc(t) + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="' + ON + '" stroke-width="2.6" stroke-linecap="round"/></svg></span>';
  }
  function sugChip(t) {
    return '<span class="chip" data-act="tag" data-k="' + esc(t) + '" style="font-size:12.5px;color:#b6b6be;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);border-radius:999px;padding:6px 13px;cursor:pointer;white-space:nowrap;">' + esc(t) + '</span>';
  }

  function render() {
    const domain = tab ? parseDomain(tab.url) : '';
    const fav = tab && (tab.favIconUrl || (domain ? 'https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(domain) : ''));

    if (!tab) { root.innerHTML = '<div style="padding:28px;color:#9a9aa2;font-size:13px;">No active tab.</div>'; return; }

    // header
    const titleText = blocked ? 'Can’t stash this page' : 'Saved to your stash';
    const header =
      '<div style="position:relative;padding:22px 22px 18px;overflow:hidden;">' +
        '<div style="position:absolute;left:-40px;top:-60px;width:320px;height:200px;pointer-events:none;background:radial-gradient(closest-side, rgba(242,116,43,.28), transparent 72%);animation:glow 4s ease-in-out infinite;"></div>' +
        '<div style="position:relative;display:flex;align-items:center;gap:15px;">' + logo(46) +
          '<div style="min-width:0;">' +
            '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10.5px;letter-spacing:.26em;color:#8a8a92;margin-bottom:3px;">STASH</div>' +
            '<div style="font-size:21px;font-weight:700;letter-spacing:-.01em;line-height:1.05;color:#fff;">' + titleText + '</div>' +
            '<div style="display:flex;align-items:center;gap:7px;margin-top:6px;min-width:0;">' +
              (fav ? '<img src="' + esc(fav) + '" width="15" height="15" style="border-radius:4px;display:block;flex:none;" onerror="this.style.display=\'none\'">' : '') +
              '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11.5px;color:#9a9aa2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(domain || tab.url) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    let middle = '';
    if (!blocked) {
      const sel = Array.from(selected);
      const sugs = suggestions.filter(t => !selected.has(t)).slice(0, 9);
      const tagsCard =
        '<div style="' + card + 'padding:16px 16px 17px;margin:0 16px 12px;">' +
          '<div style="' + label + 'margin-bottom:12px;">TAGS</div>' +
          (sel.length ? '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px;">' + sel.map(selChip).join('') + '</div>' : '') +
          '<div style="display:flex;align-items:center;gap:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:11px 14px;margin-bottom:13px;">' +
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="' + ACCENT2 + '" stroke-width="2.2" stroke-linecap="round"/></svg>' +
            '<input type="text" data-focus-id="taginput" placeholder="Add a tag, press Enter" style="flex:1;font-size:13.5px;color:#fff;">' +
          '</div>' +
          (sugs.length ? '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + sugs.map(sugChip).join('') + '</div>' : '') +
        '</div>';

      const noteCard =
        '<div style="' + card + 'padding:16px;margin:0 16px 16px;">' +
          '<div style="' + label + 'margin-bottom:12px;">NOTE</div>' +
          '<textarea data-focus-id="note" placeholder="Add a quick thought, context, or why this matters." style="width:100%;min-height:86px;font-size:13.5px;line-height:1.5;color:#e8e8ec;">' + esc(noteText) + '</textarea>' +
        '</div>';
      middle = tagsCard + noteCard;
    } else {
      middle = '<div style="' + card + 'padding:18px;margin:0 16px 16px;color:#9a9aa2;font-size:13px;line-height:1.55;">Browser and extension pages can’t be saved. Open the vault to browse everything you’ve already stashed.</div>';
    }

    // footer
    const ghost = 'flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:#e8e8ec;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;';
    const doneBtn = 'flex:none;padding:11px 22px;border-radius:12px;background:linear-gradient(135deg,' + ACCENT2 + ',' + ACCENT + ');color:' + ON + ';font-size:13.5px;font-weight:700;cursor:pointer;box-shadow:0 8px 22px -6px rgba(242,116,43,.6);';
    const footer =
      '<div style="display:flex;align-items:center;gap:9px;padding:4px 16px 18px;">' +
        (blocked ? '' :
          '<div class="btn btnG vsi" data-act="copy" style="' + ghost + '">' +
            (copied
              ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="' + ACCENT2 + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Copied'
              : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="9" width="11" height="11" rx="2.4" stroke="currentColor" stroke-width="1.8"/><path d="M5 15V5a2 2 0 0 1 2-2h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>Copy URL') +
          '</div>') +
        '<div class="btn btnG vsi" data-act="vault" style="' + ghost + '">Open Vault</div>' +
        '<div class="btn btnP vsi" data-act="done" style="' + doneBtn + '">Done</div>' +
      '</div>';

    root.innerHTML = header + middle + footer;
  }

  // ---------- focus-preserving re-render ----------
  function rerender() {
    const a = document.activeElement;
    const id = a && a.getAttribute && a.getAttribute('data-focus-id');
    const pos = a ? a.selectionStart : null;
    render();
    if (id) { const el = root.querySelector('[data-focus-id="' + id + '"]'); if (el) { el.focus(); try { const p = pos == null ? el.value.length : pos; el.setSelectionRange(p, p); } catch (e) {} } }
  }

  function addTag(raw) {
    const t = String(raw || '').trim().toLowerCase().replace(/[, ]+$/, '');
    if (!t) return;
    selected.add(t); persist(); rerender();
  }

  // ---------- events ----------
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.getAttribute('data-act');
    const k = t.getAttribute('data-k');
    if (act === 'tag') { selected.add(k); persist(); rerender(); }
    else if (act === 'untag') { selected.delete(k); persist(); rerender(); }
    else if (act === 'vault') { if (hasChrome) chrome.runtime.sendMessage({ type: 'open-vault' }); window.close(); }
    else if (act === 'done') { persist().then(() => window.close()); }
    else if (act === 'copy') {
      const text = tab ? tab.url : '';
      const ok = () => { copied = true; rerender(); setTimeout(() => { copied = false; rerender(); }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, ok);
      else ok();
    }
  });

  root.addEventListener('keydown', (e) => {
    const id = e.target.getAttribute && e.target.getAttribute('data-focus-id');
    if (id === 'taginput' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); addTag(e.target.value); }
  });
  root.addEventListener('input', (e) => {
    const id = e.target.getAttribute && e.target.getAttribute('data-focus-id');
    if (id === 'note') { noteText = e.target.value; clearTimeout(window.__noteT); window.__noteT = setTimeout(persist, 350); }
  });

  // ---------- boot ----------
  async function boot() {
    blocked = !tab || !tab.url || /^(chrome|edge|about|chrome-extension|view-source):/i.test(tab.url);
    if (!blocked) { try { await stashCurrent(); } catch (e) { blocked = true; } }
    else {
      const { bookmarks } = await getLocal('bookmarks');
      const counts = {};
      (bookmarks || []).forEach(b => (b.tags || (b.tag ? [b.tag] : [])).forEach(x => counts[x] = (counts[x] || 0) + 1));
      suggestions = Object.keys(counts).concat(PRESET_TAGS);
    }
    render();
    const ti = root.querySelector('[data-focus-id="taginput"]');
    if (ti) ti.focus();
  }

  if (hasChrome && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { tab = tabs && tabs[0]; boot(); });
  } else {
    tab = { url: 'https://claude.ai/chat', title: 'Claude', favIconUrl: '' };
    boot();
  }
})();
