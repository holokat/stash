/* STASH — Vault page logic (vanilla JS port of the prototype).
   build: full-width + responsive columns + Cmd/Ctrl-K search.
   Persists to chrome.storage.local when running as an extension,
   and falls back to localStorage so the page also renders standalone. */

(function () {
  'use strict';

  // ---------- constants ----------
  const ACCENT = '#F2742B';
  const ACCENT2 = '#FF9D5C';
  const ON_ACCENT = '#1a0f0a';
  const SURFACE = '#0B0B0D';

  const PRESET_TAGS = ['design', 'dev', 'ai', 'reading', 'docs', 'tools', 'finance', 'social', 'hosting', '3d', 'email', 'keys'];

  const tagColors = { design:'#1b6fd6', dev:'#16a34a', '3d':'#7C3AED', hosting:'#F6821F', email:'#e0457b', keys:'#4285F4', finance:'#635BFF', social:'#111111', components:'#8B5CF6', admin:'#0EA5E9', reading:'#0d9488', ai:'#10A37F', docs:'#EA4335', tools:'#F59E0B' };

  const heroes = [
    'radial-gradient(120% 100% at 72% 26%, #2bd3ff 0%, #1577d6 36%, #0a2a6b 74%, #04102f 100%)',
    'radial-gradient(circle at 32% 22%,#FF9D5C,#F2742B 38%,#7a2d12 82%,#1a0f0a)',
    'linear-gradient(135deg,#a855f7,#7c3aed 60%,#4c1d95)',
    'radial-gradient(120% 100% at 30% 20%,#34d399,#059669 52%,#064e3b)',
    'linear-gradient(135deg,#fb7185,#e11d48 60%,#4c0519)',
    'radial-gradient(120% 100% at 70% 30%,#fbbf24,#f59e0b 48%,#7c2d12)',
    'linear-gradient(135deg,#38bdf8,#0ea5e9 55%,#0c4a6e)',
    'radial-gradient(120% 100% at 40% 30%,#c084fc,#7c3aed 52%,#2e1065)'
  ];

  const sortMap = { recent: 'Most recent', oldest: 'Oldest first', az: 'Title A–Z', domain: 'Domain', tag: 'By tag' };

  // ---------- storage abstraction ----------
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  const store = {
    get(keys) {
      return new Promise(res => {
        if (hasChrome) { chrome.storage.local.get(keys, res); return; }
        const all = JSON.parse(localStorage.getItem('stash-ext') || '{}');
        const out = {}; (keys || Object.keys(all)).forEach(k => out[k] = all[k]); res(out);
      });
    },
    set(obj) {
      return new Promise(res => {
        if (hasChrome) { chrome.storage.local.set(obj, res); return; }
        const all = JSON.parse(localStorage.getItem('stash-ext') || '{}');
        Object.assign(all, obj); localStorage.setItem('stash-ext', JSON.stringify(all)); res();
      });
    }
  };

  // ---------- state ----------
  const sysDark = !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  const state = {
    bookmarks: [], query: '', tag: 'all', sort: 'recent', view: 'grid',
    theme: 'dark', sortOpen: false, toast: null, addOpen: false,
    draftUrl: '', draftTitle: '', draftTags: [], removing: {}
  };
  let toastTimer = null;
  const app = document.getElementById('app');

  // ---------- helpers ----------
  function hex2rgb(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgba(hex, a) { const c = hex2rgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix(h1, h2, t) { const a = hex2rgb(h1), b = hex2rgb(h2), c = a.map((v, i) => Math.round(v + (b[i] - v) * t)); return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
  function lift(t) { return mix(SURFACE, '#ffffff', t); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function parseDomain(u) {
    let s = String(u || '').trim(); if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try { return new URL(s).hostname.replace(/^www\./, ''); }
    catch (e) { return String(u).replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0]; }
  }
  function daysAgoOf(b) { const ms = Date.now() - (b.savedAt || Date.now()); return Math.max(0, Math.floor(ms / 86400000)); }
  function age(d) { if (d < 1) return 'now'; if (d < 7) return d + 'd'; if (d < 30) return Math.round(d / 7) + 'w'; return Math.round(d / 30) + 'mo'; }
  const IS_MAC = /Mac|iPhone|iPod|iPad/i.test(navigator.platform || navigator.userAgent || '');
  function colsFor(view) {
    const w = window.innerWidth || 1280;
    const padOuter = Math.min(34, Math.max(12, w * 0.026));
    const inner = w - padOuter * 2 - 68; // minus panel inner padding
    const min = view === 'columns' ? 168 : 210;
    const gap = 16;
    let n = Math.floor((inner + gap) / (min + gap));
    const cap = 6;
    return Math.max(1, Math.min(cap, n));
  }

  // ---------- init ----------
  function demoSeed() {
    const now = Date.now(), day = 86400000;
    return [
      ['holokat (Holokat)', 'github.com', 'dev', 'Product designer in Japan — 20 repositories to follow.', 1],
      ['Figma — Stash', 'figma.com', 'design', 'Working files for the Stash brand.', 2],
      ['Anthropic Console', 'console.anthropic.com', 'ai', 'Claude API keys, usage and logs.', 4],
      ['Linear', 'linear.app', 'tools', 'Issue tracking and project planning.', 5],
      ['Vercel Dashboard', 'vercel.com', 'hosting', 'Deployments and edge functions.', 6],
      ['Stripe Atlas', 'dashboard.stripe.com', 'finance', 'Incorporation, banking and cap table.', 8],
      ['Hacker News', 'news.ycombinator.com', 'reading', 'Tech news, Show HN and discussion.', 9],
      ['Dribbble — Saved', 'dribbble.com', 'design', 'Inspiration shots and palettes.', 11],
      ['Notion — Wiki', 'notion.so', 'docs', 'Team wiki, docs and roadmaps.', 12],
      ['Supabase', 'supabase.com', 'dev', 'Postgres, auth, storage and edge functions.', 14],
      ['Perplexity', 'perplexity.ai', 'ai', 'Conversational answer engine.', 16],
      ['Mobbin', 'mobbin.com', 'design', 'Mobile and web UI pattern library.', 18]
    ].map((d, i) => ({ id: i + 1, title: d[0], domain: d[1], tag: d[2], note: d[3], url: 'https://' + d[1], favIconUrl: '', savedAt: now - d[4] * day }));
  }

  async function init() {
    let { bookmarks, settings } = await store.get(['bookmarks', 'settings']);
    // standalone preview only (never runs inside the extension — chrome.storage is present there)
    if (!hasChrome && !Array.isArray(bookmarks)) { bookmarks = demoSeed(); store.set({ bookmarks }); }
    state.bookmarks = Array.isArray(bookmarks) ? bookmarks : [];
    if (settings) { if (settings.view) state.view = settings.view; if (settings.sort) state.sort = settings.sort; if (settings.theme) state.theme = settings.theme; }
    setupDelegation();
    render();
    if (hasChrome && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === 'local' && ch.bookmarks) { state.bookmarks = ch.bookmarks.newValue || []; render(); }
      });
    }
  }
  function persist() { store.set({ bookmarks: state.bookmarks }); }
  function persistSettings() { store.set({ settings: { view: state.view, sort: state.sort, theme: state.theme } }); }

  // ---------- mutations ----------
  function setState(patch) { Object.assign(state, patch); render(); }

  function remove(id) {
    const idx = state.bookmarks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const item = state.bookmarks[idx];
    state.removing[id] = true; render();
    setTimeout(() => {
      state.bookmarks = state.bookmarks.filter(b => b.id !== id);
      delete state.removing[id];
      state.toast = { title: item.title, item, index: idx };
      persist(); render();
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { state.toast = null; render(); }, 5000);
    }, 300);
  }
  function undo() {
    const t = state.toast; if (!t) return;
    clearTimeout(toastTimer);
    const bm = state.bookmarks.slice();
    bm.splice(Math.min(t.index, bm.length), 0, t.item);
    state.bookmarks = bm; state.toast = null; persist(); render();
  }
  function saveDraft() {
    const raw = (state.draftUrl || '').trim();
    if (raw.length < 3) return;
    let url = raw; if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const domain = parseDomain(url);
    const title = (state.draftTitle || '').trim() || domain;
    const tags = (state.draftTags && state.draftTags.length) ? state.draftTags.slice() : ['reading'];
    const tag = tags[0];
    const id = state.bookmarks.reduce((m, b) => Math.max(m, b.id || 0), 0) + 1;
    state.bookmarks.unshift({ id, title, domain, tag, tags, note: '', url, favIconUrl: '', savedAt: Date.now() });
    state.addOpen = false; state.draftUrl = ''; state.draftTitle = ''; state.draftTags = []; state.sort = 'recent';
    persist(); persistSettings(); render();
  }

  // ---------- view-model + html ----------
  function theme() {
    const dark = state.theme === 'dark' || (state.theme === 'system' && sysDark);
    if (dark) return { dark, panel: SURFACE, shadow: '0 30px 70px -28px rgba(0,0,0,.7)', border: '',
      brand: '#fff', sub: '#9a9aa2', chromeBg: 'rgba(255,255,255,.06)', chromeBorder: 'rgba(255,255,255,.1)', input: '#fff',
      toolBg: 'rgba(255,255,255,.06)', toolBorder: 'rgba(255,255,255,.09)', segActive: '#fff', segActiveFg: '#15161A', iconMuted: '#8a8a92',
      card: lift(0.05), cardBorder: 'rgba(255,255,255,.07)', title: '#fff', note: '#9a9aa2', meta: '#6b6b72',
      tagBg: 'rgba(255,255,255,.06)', tagText: '#9a9aa2', actBg: 'rgba(255,255,255,.12)', actIcon: '#fff',
      rowHover: 'rgba(255,255,255,.05)', divider: 'rgba(255,255,255,.08)', count: '#6b6b72',
      menuBg: lift(0.1), menuBorder: 'rgba(255,255,255,.12)', menuText: '#e8e8ec', menuActive: 'rgba(255,255,255,.07)',
      toastBg: lift(0.1), toastBorder: 'rgba(255,255,255,.12)', toastText: '#e8e8ec', pageBg: '#050507' };
    return { dark, panel: '#FAF9F6', shadow: '0 30px 70px -32px rgba(40,40,50,.24)', border: '1px solid #ECEAE3',
      brand: '#15151a', sub: '#5b5b62', chromeBg: '#FFFFFF', chromeBorder: '#E7E5DE', input: '#15151a',
      toolBg: '#EFEDE6', toolBorder: '#E2DFD6', segActive: '#fff', segActiveFg: '#15151a', iconMuted: '#a0a09a',
      card: '#FFFFFF', cardBorder: '#EAE8E1', title: '#15151a', note: '#5b5b62', meta: '#a0a09a',
      tagBg: '#EFEDE6', tagText: '#6b6b66', actBg: '#EEEDE7', actIcon: '#55555c',
      rowHover: 'rgba(0,0,0,.035)', divider: '#EAE8E1', count: '#a0a09a',
      menuBg: '#fff', menuBorder: '#E7E5DE', menuText: '#2a2a2e', menuActive: '#F2F0E9',
      toastBg: '#fff', toastBorder: '#E7E5DE', toastText: '#2a2a2e', pageBg: '#e7e5df' };
  }

  function favicon(b) {
    if (b.favIconUrl) return b.favIconUrl;
    return '';
  }

  function vm(b, th, isList) {
    const rm = !!state.removing[b.id];
    const hi = heroes[(b.id || 0) % heroes.length];
    const fade = rm ? 'opacity:0;transform:scale(.96);pointer-events:none;' : 'opacity:1;';
    const fadeRow = rm ? 'opacity:0;transform:translateX(-10px);pointer-events:none;' : 'opacity:1;';
    const chip = 'font-size:10.5px;color:var(--ac);background:var(--acSoft);border-radius:999px;padding:3px 9px;white-space:nowrap;';
    const rowChip = 'font-size:11.5px;color:' + th.tagText + ';background:' + th.tagBg + ';border-radius:999px;padding:4px 11px;white-space:nowrap;';
    const actBtn = 'width:30px;height:30px;border-radius:50%;background:' + th.actBg + ';color:' + th.actIcon + ';display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;';
    const fav = favicon(b);
    return {
      id: b.id, title: b.title, domain: b.domain, tag: b.tag, note: b.note || '', ageLabel: age(daysAgoOf(b)),
      initial: (b.title || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '•',
      faviconStyle: fav ? 'position:absolute;inset:0;border-radius:8px;background-image:url(' + fav + ');background-size:contain;background-position:center;background-repeat:no-repeat;' : 'display:none;',
      iconFg: th.meta, heroBg: hi, titleColor: th.title, noteColor: th.note, metaColor: th.meta,
      chipStyle: isList ? rowChip : chip, actBtnStyle: actBtn,
      style: 'position:relative;background:' + th.card + ';border:1px solid ' + th.cardBorder + ';border-radius:18px;overflow:hidden;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s,border-color .35s,opacity .3s;' + fade,
      rowStyle: 'position:relative;display:flex;align-items:center;gap:15px;padding:13px 14px;border-radius:13px;transition:background .25s,opacity .3s,transform .3s;' + fadeRow
    };
  }

  const ICON_OPEN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_DEL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function cardHTML(c) {
    return '<div class="vcard" style="' + c.style + '">' +
      '<div style="padding:16px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">' +
          '<div style="position:relative;width:38px;height:38px;color:' + c.iconFg + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;">' + esc(c.initial) + '<div style="' + c.faviconStyle + '"></div></div>' +
          '<span style="' + c.chipStyle + '">' + esc(c.tag) + '</span>' +
        '</div>' +
        '<div style="font-size:16px;font-weight:600;color:' + c.titleColor + ';margin-bottom:6px;letter-spacing:-.01em;line-height:1.22;">' + esc(c.title) + '</div>' +
        (c.note ? '<p style="font-size:12.5px;line-height:1.5;color:' + c.noteColor + ';margin:0 0 11px;">' + esc(c.note) + '</p>' : '<div style="height:5px;"></div>') +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:10.5px;color:' + c.metaColor + ';">' + esc(c.domain) + '</div>' +
      '</div>' +
      '<div class="vact" style="position:absolute;top:11px;right:11px;display:flex;gap:7px;opacity:0;transform:translateY(-6px);transition:all .35s;">' +
        '<div class="vactBtn" data-act="open" data-id="' + c.id + '" style="' + c.actBtnStyle + '">' + ICON_OPEN + '</div>' +
        '<div class="vactBtn" data-act="del" data-id="' + c.id + '" style="' + c.actBtnStyle + '">' + ICON_DEL + '</div>' +
      '</div>' +
    '</div>';
  }

  function rowHTML(c) {
    return '<div class="vrow" style="' + c.rowStyle + '">' +
      '<div style="position:relative;width:38px;height:38px;color:' + c.iconFg + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex:none;">' + esc(c.initial) + '<div style="' + c.faviconStyle + '"></div></div>' +
      '<div style="min-width:0;flex:1;">' +
        '<div style="font-size:15px;font-weight:600;color:' + c.titleColor + ';letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(c.title) + '</div>' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11.5px;color:' + c.metaColor + ';margin-top:2px;">' + esc(c.domain) + '</div>' +
      '</div>' +
      '<span style="' + c.chipStyle + '">' + esc(c.tag) + '</span>' +
      '<span style="font-family:\'JetBrains Mono\',monospace;font-size:11.5px;color:' + c.metaColor + ';width:42px;text-align:right;">' + esc(c.ageLabel) + '</span>' +
      '<div class="vact" style="display:flex;gap:7px;opacity:0;transform:translateX(6px);transition:all .3s;margin-left:6px;">' +
        '<div class="vactBtn" data-act="open" data-id="' + c.id + '" style="' + c.actBtnStyle + '">' + ICON_OPEN + '</div>' +
        '<div class="vactBtn" data-act="del" data-id="' + c.id + '" style="' + c.actBtnStyle + '">' + ICON_DEL + '</div>' +
      '</div>' +
    '</div>';
  }

  function featuredHTML(f) {
    return '<div class="vfeat" style="' + f.style + '">' +
      '<div class="vfeatHero" style="position:absolute;inset:0;transition:transform .7s cubic-bezier(.2,.8,.2,1);background:' + f.heroBg + ';"></div>' +
      '<div style="position:absolute;inset:0;background:linear-gradient(180deg,transparent 28%, rgba(4,8,20,.86) 100%);"></div>' +
      '<div style="position:absolute;left:28px;right:28px;bottom:24px;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;">' +
        '<div style="min-width:0;">' +
          '<div style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:rgba(255,255,255,.72);margin-bottom:10px;letter-spacing:.02em;">' + esc(f.domain) + ' · ' + esc(f.tag) + '</div>' +
          '<div style="font-size:31px;font-weight:700;color:#fff;letter-spacing:-.01em;line-height:1.04;margin-bottom:9px;">' + esc(f.title) + '</div>' +
          (f.note ? '<p style="font-size:14px;color:rgba(255,255,255,.78);margin:0;max-width:520px;line-height:1.5;">' + esc(f.note) + '</p>' : '') +
        '</div>' +
        '<div data-act="open" data-id="' + f.id + '" style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.95);color:#0B0B0D;border-radius:999px;padding:11px 20px;font-size:14px;font-weight:600;white-space:nowrap;cursor:pointer;">Open <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M7 17 17 7M9 7h8v8" stroke="#0B0B0D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '</div>' +
      '<div class="vfeatAct" style="position:absolute;top:16px;right:16px;display:flex;gap:8px;opacity:0;transform:translateY(-6px);transition:all .35s;">' +
        '<div data-act="del" data-id="' + f.id + '" class="vactBtn" style="width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.5);color:#fff;border:1px solid rgba(255,255,255,.18);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '</div>' +
    '</div>';
  }

  function pill(label, on, dataAttrs, th) {
    const style = on
      ? 'font-size:12.5px;font-weight:600;color:var(--on);background:linear-gradient(135deg,var(--ac2),var(--ac));border-radius:999px;padding:6px 13px;cursor:pointer;transition:all .25s;white-space:nowrap;'
      : 'font-size:12.5px;color:' + th.tagText + ';background:' + th.tagBg + ';border-radius:999px;padding:6px 13px;cursor:pointer;transition:all .25s;white-space:nowrap;';
    return '<span class="vtag" ' + dataAttrs + ' style="' + style + '">' + esc(label) + '</span>';
  }

  function seg(on, th, dark) {
    return 'width:38px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;' +
      (on ? 'background:' + th.segActive + ';box-shadow:0 2px 6px rgba(0,0,0,' + (dark ? '.32' : '.12') + ');color:' + th.segActiveFg + ';' : 'background:transparent;color:' + th.iconMuted + ';');
  }

  function buildHTML() {
    const th = theme();
    const dark = th.dark;
    const vars = '--ac:' + ACCENT + ';--ac2:' + ACCENT2 + ';--on:' + ON_ACCENT + ';--acSoft:' + rgba(ACCENT, 0.15) + ';--acB:' + rgba(ACCENT, 0.30) + ';--acSh:' + rgba(ACCENT, 0.32) + ';--acGlow:' + rgba(ACCENT, 0.55) + ';--acDim:' + rgba(ACCENT, 0.10) + ';--wash:' + rgba(ACCENT, dark ? 0.20 : 0.12) + ';--rowHover:' + th.rowHover + ';';

    document.body.style.background = th.pageBg;

    // tags
    const counts = {};
    state.bookmarks.forEach(b => { counts[b.tag] = (counts[b.tag] || 0) + 1; });
    const tagNames = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    let tagsHTML = pill('All · ' + state.bookmarks.length, state.tag === 'all', 'data-act="tag" data-k="all"', th);
    tagNames.forEach(n => { tagsHTML += pill(n + ' ' + counts[n], state.tag === n, 'data-act="tag" data-k="' + esc(n) + '"', th); });

    // list
    let list = state.bookmarks.filter(b => {
      const btags = (b.tags && b.tags.length) ? b.tags : (b.tag ? [b.tag] : []);
      if (state.tag !== 'all' && btags.indexOf(state.tag) < 0) return false;
      if (state.query) { const hay = (b.title + ' ' + b.domain + ' ' + btags.join(' ') + ' ' + (b.note || '')).toLowerCase(); if (!hay.includes(state.query)) return false; }
      return true;
    });
    const cmp = {
      recent: (a, b) => daysAgoOf(a) - daysAgoOf(b),
      oldest: (a, b) => daysAgoOf(b) - daysAgoOf(a),
      az: (a, b) => a.title.localeCompare(b.title),
      domain: (a, b) => a.domain.localeCompare(b.domain),
      tag: (a, b) => a.tag.localeCompare(b.tag) || a.title.localeCompare(b.title)
    };
    list = list.slice().sort(cmp[state.sort] || cmp.recent);

    const isList = state.view === 'list';
    const showFeatured = !isList && list.length > 0;

    // body region
    let bodyHTML = '';
    if (showFeatured) {
      const f = vm(list[0], th, false);
      f.style = 'position:relative;height:268px;border-radius:22px;overflow:hidden;margin-bottom:18px;transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s,opacity .3s;' + (state.removing[list[0].id] ? 'opacity:0;transform:scale(.97);pointer-events:none;' : 'opacity:1;');
      bodyHTML += featuredHTML(f);
    }
    if (list.length === 0) {
      let emptyTitle = 'Nothing here yet', emptySub = 'Saved links will appear in this vault. Press the + button or ⌘⇧S on any tab.';
      if (state.query) { emptyTitle = 'No matches for “' + state.query + '”'; emptySub = 'Try a different word, or clear the search.'; }
      else if (state.tag !== 'all') { emptyTitle = 'No “' + state.tag + '” bookmarks'; emptySub = 'Pick another tag, or save something here.'; }
      bodyHTML += '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:90px 0;text-align:center;">' +
        '<div style="width:64px;height:64px;border-radius:18px;background:var(--acDim);display:flex;align-items:center;justify-content:center;margin-bottom:20px;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="var(--ac)" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="var(--ac)" stroke-width="2" stroke-linecap="round"/></svg></div>' +
        '<div style="font-size:18px;font-weight:600;color:' + th.brand + ';margin-bottom:6px;">' + esc(emptyTitle) + '</div>' +
        '<p style="font-size:13.5px;color:' + th.sub + ';margin:0;max-width:340px;line-height:1.5;">' + esc(emptySub) + '</p>' +
      '</div>';
    } else if (isList) {
      bodyHTML += '<div style="display:flex;flex-direction:column;">' + list.map(b => rowHTML(vm(b, th, true))).join('') + '</div>';
    } else {
      const cards = list.slice(showFeatured ? 1 : 0);
      const ncols = colsFor(state.view);
      bodyHTML += '<div style="display:grid;grid-template-columns:repeat(' + ncols + ',minmax(0,1fr));gap:16px;">' + cards.map(b => cardHTML(vm(b, th, false))).join('') + '</div>';
    }

    // background pattern (aurora)
    const patternStyle = 'position:absolute;left:0;right:0;top:0;pointer-events:none;z-index:1;height:600px;background-image:radial-gradient(640px 340px at 14% -90px,' + rgba(ACCENT, 0.22) + ', transparent 62%),radial-gradient(560px 320px at 86% -70px,' + rgba(ACCENT2, 0.16) + ', transparent 60%),radial-gradient(760px 380px at 50% -150px,' + rgba(ACCENT, 0.10) + ', transparent 66%);';

    // toolbar
    const segWrap = 'display:flex;gap:4px;background:' + th.toolBg + ';border:1px solid ' + th.toolBorder + ';border-radius:13px;padding:4px;';
    const countLabel = (state.tag === 'all' && !state.query) ? state.bookmarks.length + ' saved' : list.length + ' of ' + state.bookmarks.length;

    let sortMenu = '';
    if (state.sortOpen) {
      let items = '';
      Object.keys(sortMap).forEach(k => {
        const activeMark = state.sort === k ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="m5 13 4 4L19 7" stroke="var(--ac)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
        items += '<div class="vsi" data-act="sort-set" data-k="' + k + '" style="display:flex;align-items:center;justify-content:space-between;gap:14px;font-size:13px;padding:9px 12px;border-radius:9px;cursor:pointer;color:' + th.menuText + ';background:' + (state.sort === k ? th.menuActive : 'transparent') + ';transition:background .2s;"><span>' + sortMap[k] + '</span>' + activeMark + '</div>';
      });
      sortMenu = '<div style="position:absolute;top:48px;left:0;min-width:196px;background:' + th.menuBg + ';border:1px solid ' + th.menuBorder + ';border-radius:14px;padding:6px;box-shadow:0 18px 44px -14px rgba(0,0,0,.5);z-index:60;">' + items + '</div>';
    }

    const header =
      '<div style="position:relative;padding:clamp(18px,2.5vw,28px) clamp(16px,2.6vw,34px) 0;z-index:5;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:22px;">' +
          '<div style="display:flex;align-items:center;gap:11px;">' +
            '<div style="position:relative;width:34px;height:34px;">' +
              '<div style="position:absolute;inset:0;border-radius:10px;background:linear-gradient(135deg,var(--ac2),var(--ac));box-shadow:0 0 18px var(--acGlow);"></div>' +
              '<div style="position:absolute;inset:0;border-radius:10px;box-shadow:inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 5px rgba(0,0,0,.18);"></div>' +
              '<svg width="34" height="34" viewBox="0 0 34 34" fill="none" style="position:absolute;inset:0;"><circle cx="17" cy="17" r="11" stroke="var(--on)" stroke-width="1.4" opacity=".4"/><circle cx="17" cy="17" r="9" stroke="var(--on)" stroke-width="1.7"/><g stroke="var(--on)" stroke-width="1.8" stroke-linecap="round"><path d="M19 19 22.7 22.7"/><path d="M15 19 11.3 22.7"/><path d="M15 15 11.3 11.3"/><path d="M19 15 22.7 11.3"/></g><circle cx="17" cy="17" r="2.6" fill="var(--on)"/></svg>' +
            '</div>' +
            '<span style="font-size:22px;font-weight:700;letter-spacing:.22em;color:' + th.brand + ';">STASH</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:10px;flex:1 1 260px;justify-content:flex-end;min-width:220px;">' +
            '<div style="display:flex;align-items:center;gap:9px;background:' + th.chromeBg + ';border:1px solid ' + th.chromeBorder + ';border-radius:999px;padding:10px 16px;flex:1;min-width:0;max-width:380px;">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#8a8a90" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="#8a8a90" stroke-width="2" stroke-linecap="round"/></svg>' +
              '<input type="text" class="vsearch" data-focus-id="search" placeholder="Search the vault…" value="' + esc(state.query) + '" style="flex:1;min-width:0;color:' + th.input + ';font-size:13.5px;">' +
              (state.query
                ? '<span data-act="clear-search" style="cursor:pointer;color:#8a8a90;font-size:16px;line-height:1;">×</span>'
                : '<kbd style="font-family:\'JetBrains Mono\',monospace;font-size:10.5px;color:' + th.iconMuted + ';background:' + (dark ? 'rgba(255,255,255,.06)' : '#fff') + ';border:1px solid ' + th.chromeBorder + ';border-radius:6px;padding:3px 6px;line-height:1;white-space:nowrap;flex:none;">' + (IS_MAC ? '⌘K' : 'Ctrl K') + '</kbd>') +
            '</div>' +
            '<div class="vbig" data-act="add-open" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--ac2),var(--ac));color:var(--on);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px -4px var(--acGlow);cursor:pointer;transition:all .2s;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--on)" stroke-width="2.4" stroke-linecap="round"/></svg></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;align-items:center;padding-bottom:16px;flex-wrap:wrap;">' + tagsHTML + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 0 22px;border-top:1px solid ' + th.divider + ';">' +
          '<div data-sortroot style="position:relative;">' +
            '<div class="vsi" data-act="sort-toggle" style="display:flex;align-items:center;gap:8px;background:' + th.chromeBg + ';border:1px solid ' + th.chromeBorder + ';border-radius:999px;padding:9px 16px;cursor:pointer;color:' + th.title + ';font-size:13.5px;transition:all .25s;"><span style="opacity:.5;font-weight:500;">Sort</span><span style="font-weight:600;">' + sortMap[state.sort] + '</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style="opacity:.7;"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
            sortMenu +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end;">' +
            '<span style="font-size:12px;color:' + th.count + ';font-family:\'JetBrains Mono\',monospace;white-space:nowrap;margin-right:4px;">' + countLabel + '</span>' +
            '<div style="' + segWrap + '">' +
              '<div class="vsi" data-act="view" data-v="columns" style="' + seg(state.view === 'columns', th, dark) + '" title="Columns"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="4" height="16" rx="1.4" fill="currentColor"/><rect x="10" y="4" width="4" height="16" rx="1.4" fill="currentColor"/><rect x="16" y="4" width="4" height="16" rx="1.4" fill="currentColor"/></svg></div>' +
              '<div class="vsi" data-act="view" data-v="grid" style="' + seg(state.view === 'grid', th, dark) + '" title="Grid"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.8" fill="currentColor"/><rect x="13" y="4" width="7" height="7" rx="1.8" fill="currentColor"/><rect x="4" y="13" width="7" height="7" rx="1.8" fill="currentColor"/><rect x="13" y="13" width="7" height="7" rx="1.8" fill="currentColor"/></svg></div>' +
              '<div class="vsi" data-act="view" data-v="list" style="' + seg(state.view === 'list', th, dark) + '" title="List"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="6" r="1.6" fill="currentColor"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="5" cy="18" r="1.6" fill="currentColor"/><rect x="9" y="5" width="11" height="2" rx="1" fill="currentColor"/><rect x="9" y="11" width="11" height="2" rx="1" fill="currentColor"/><rect x="9" y="17" width="11" height="2" rx="1" fill="currentColor"/></svg></div>' +
            '</div>' +
            '<div style="' + segWrap + '">' +
              '<div class="vsi" data-act="theme" data-t="system" style="' + seg(state.theme === 'system', th, dark) + '" title="System"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
              '<div class="vsi" data-act="theme" data-t="light" style="' + seg(state.theme === 'light', th, dark) + '" title="Light"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>' +
              '<div class="vsi" data-act="theme" data-t="dark" style="' + seg(state.theme === 'dark', th, dark) + '" title="Dark"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    let toastHTML = '';
    if (state.toast) {
      toastHTML = '<div style="position:absolute;left:50%;bottom:26px;transform:translateX(-50%);display:flex;align-items:center;gap:16px;background:' + th.toastBg + ';border:1px solid ' + th.toastBorder + ';border-radius:12px;padding:13px 18px;box-shadow:0 16px 40px -12px rgba(0,0,0,.5);animation:toastUp .3s cubic-bezier(.2,.9,.3,1);z-index:50;color:' + th.toastText + ';">' +
        '<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-.7 12a2 2 0 0 1-2 1.9H8.7a2 2 0 0 1-2-1.9L6 7" stroke="var(--ac)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '<span style="font-size:13.5px;">Deleted <b style="color:' + th.brand + ';">' + esc(state.toast.title) + '</b></span>' +
        '<span data-act="undo" class="vundo" style="font-size:13.5px;font-weight:600;color:var(--ac);cursor:pointer;">Undo</span>' +
      '</div>';
    }

    let modalHTML = '';
    if (state.addOpen) {
      const tagSel = state.draftTags || [];
      const selChipHtml = (t) => '<span class="vtag" data-act="modal-untag" data-k="' + esc(t) + '" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--on);background:linear-gradient(135deg,var(--ac2),var(--ac));border-radius:999px;padding:6px 9px 6px 12px;cursor:pointer;white-space:nowrap;">' + esc(t) + '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="var(--on)" stroke-width="2.6" stroke-linecap="round"/></svg></span>';
      const recChipHtml = (t) => '<span class="vtag" data-act="modal-tag" data-k="' + esc(t) + '" style="font-size:12.5px;color:' + th.tagText + ';background:' + th.tagBg + ';border:1px solid ' + th.cardBorder + ';border-radius:999px;padding:6px 13px;cursor:pointer;white-space:nowrap;">' + esc(t) + '</span>';
      const recommended = tagNames.filter(n => tagSel.indexOf(n) < 0);
      const tagInputWrap = 'display:flex;align-items:center;gap:10px;background:' + th.chromeBg + ';border:1px solid ' + th.chromeBorder + ';border-radius:12px;padding:12px 14px;margin-bottom:' + (recommended.length ? '14px' : '24px') + ';';
      const draftDomain = parseDomain(state.draftUrl);
      const canSave = (state.draftUrl || '').trim().length > 2;
      const saveBtnStyle = canSave
        ? 'padding:11px 20px;border-radius:11px;background:linear-gradient(135deg,var(--ac2),var(--ac));color:var(--on);font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 6px 18px -6px var(--acGlow);transition:all .2s;'
        : 'padding:11px 20px;border-radius:11px;background:' + th.tagBg + ';color:' + th.meta + ';font-size:14px;font-weight:700;cursor:not-allowed;';
      const inputWrap = 'display:flex;align-items:center;gap:10px;background:' + th.chromeBg + ';border:1px solid ' + th.chromeBorder + ';border-radius:12px;padding:12px 14px;margin-bottom:16px;';
      modalHTML = '<div data-act="overlay-close" style="position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(8,8,12,' + (dark ? '.66' : '.42') + ');backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:vFadeIn .2s ease;' + vars + '">' +
        '<div style="width:440px;max-width:100%;background:' + th.menuBg + ';border:1px solid ' + th.menuBorder + ';border-radius:20px;padding:26px;box-shadow:0 40px 90px -24px rgba(0,0,0,.65);animation:vModalIn .26s cubic-bezier(.2,.9,.3,1);">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:22px;">' +
            '<div><div style="font-size:19px;font-weight:700;color:' + th.title + ';letter-spacing:-.01em;">Save to stash</div><div style="font-size:13px;color:' + th.sub + ';margin-top:3px;">Paste a link and we\'ll stash it.</div></div>' +
            '<div data-act="add-close" class="vsi" style="width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;cursor:pointer;background:' + th.tagBg + ';color:' + th.sub + ';"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>' +
          '</div>' +
          '<div style="font-size:12px;font-weight:600;letter-spacing:.02em;color:' + th.meta + ';margin-bottom:8px;">URL</div>' +
          '<div style="' + inputWrap + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="var(--ac)" stroke-width="1.8"/><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" stroke="var(--ac)" stroke-width="1.8"/></svg><input type="text" class="vsearch" data-focus-id="url" placeholder="figma.com/file/…" value="' + esc(state.draftUrl) + '" style="flex:1;color:' + th.input + ';font-size:14px;"></div>' +
          (state.draftUrl.trim() ? '<div style="font-family:\'JetBrains Mono\',monospace;font-size:11.5px;color:' + th.sub + ';margin:-8px 0 16px 2px;">→ ' + esc(draftDomain) + ' · saved as most recent</div>' : '') +
          '<div style="font-size:12px;font-weight:600;letter-spacing:.02em;color:' + th.meta + ';margin-bottom:8px;">Title <span style="font-weight:400;opacity:.7;">— optional</span></div>' +
          '<div style="' + inputWrap + '"><input type="text" class="vsearch" data-focus-id="title" placeholder="Leave blank to use the domain" value="' + esc(state.draftTitle) + '" style="flex:1;color:' + th.input + ';font-size:14px;"></div>' +
          '<div style="font-size:12px;font-weight:600;letter-spacing:.02em;color:' + th.meta + ';margin-bottom:10px;">Tags</div>' +
          (tagSel.length ? '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:11px;">' + tagSel.map(selChipHtml).join('') + '</div>' : '') +
          '<div style="' + tagInputWrap + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--ac)" stroke-width="2.2" stroke-linecap="round"/></svg><input type="text" class="vsearch" data-focus-id="modaltag" placeholder="Type a tag, press Enter" style="flex:1;min-width:0;color:' + th.input + ';font-size:14px;"></div>' +
          (recommended.length ? '<div style="font-size:11px;font-weight:600;letter-spacing:.06em;color:' + th.meta + ';margin-bottom:9px;">RECOMMENDED</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;">' + recommended.map(recChipHtml).join('') + '</div>' : '') +
          '<div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;">' +
            '<div data-act="add-close" class="vsi" style="padding:11px 18px;border-radius:11px;background:transparent;color:' + th.sub + ';font-size:14px;font-weight:600;cursor:pointer;">Cancel</div>' +
            '<div data-act="save" class="vbig" style="' + saveBtnStyle + '">Stash away</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return '<div style="width:100%;min-height:100vh;box-sizing:border-box;padding:clamp(12px,2.6vw,34px);background:' + th.pageBg + ';display:flex;flex-direction:column;align-items:stretch;font-family:\'Space Grotesk\',sans-serif;">' +
      '<div style="width:100%;">' +
        '<div style="position:relative;background:' + th.panel + ';border-radius:16px;box-shadow:' + th.shadow + ';' + (th.border ? 'border:' + th.border + ';' : '') + 'overflow:hidden;font-family:\'Space Grotesk\',sans-serif;' + vars + '">' +
          '<div style="' + patternStyle + '"></div>' +
          header +
          '<div style="position:relative;padding:4px clamp(16px,2.6vw,34px) clamp(20px,2.6vw,34px);min-height:520px;z-index:2;">' + bodyHTML + '</div>' +
          toastHTML +
        '</div>' +
      '</div>' +
      modalHTML +
    '</div>';
  }

  // ---------- render with focus preservation ----------
  function render() {
    const activeId = document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute('data-focus-id');
    const selStart = document.activeElement ? document.activeElement.selectionStart : null;
    app.innerHTML = buildHTML();
    if (activeId) {
      const el = app.querySelector('[data-focus-id="' + activeId + '"]');
      if (el) {
        el.focus();
        try { const p = selStart == null ? el.value.length : selStart; el.setSelectionRange(p, p); } catch (e) {}
      }
    }
  }

  // ---------- events (delegation, attached once) ----------
  function openUrl(id) {
    const b = state.bookmarks.find(x => x.id === id);
    if (b) window.open(b.url, '_blank', 'noopener');
  }

  function setupDelegation() {
    app.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act]');
      // close sort menu when clicking outside it
      if (state.sortOpen && !(e.target.closest('[data-sortroot]'))) { state.sortOpen = false; render(); if (!t) return; }
      if (!t) return;
      const act = t.getAttribute('data-act');
      const id = t.getAttribute('data-id');
      const k = t.getAttribute('data-k');
      switch (act) {
        case 'tag': setState({ tag: k }); break;
        case 'open': openUrl(parseInt(id, 10)); break;
        case 'del': remove(parseInt(id, 10)); break;
        case 'clear-search': setState({ query: '' }); break;
        case 'sort-toggle': setState({ sortOpen: !state.sortOpen }); break;
        case 'sort-set': state.sort = k; state.sortOpen = false; persistSettings(); render(); break;
        case 'view': state.view = k === undefined ? state.view : t.getAttribute('data-v'); persistSettings(); render(); break;
        case 'theme': state.theme = t.getAttribute('data-t'); persistSettings(); render(); break;
        case 'undo': undo(); break;
        case 'add-open': setState({ addOpen: true, draftUrl: '', draftTitle: '', draftTag: '' }); break;
        case 'add-close': setState({ addOpen: false }); break;
        case 'overlay-close': if (e.target === t) setState({ addOpen: false }); break;
        case 'modal-tag': { const arr = (state.draftTags || []).slice(); if (arr.indexOf(k) < 0) arr.push(k); setState({ draftTags: arr }); break; }
        case 'modal-untag': setState({ draftTags: (state.draftTags || []).filter(x => x !== k) }); break;
        case 'save': saveDraft(); break;
      }
    });

    app.addEventListener('input', (e) => {
      const id = e.target.getAttribute && e.target.getAttribute('data-focus-id');
      if (id === 'search') { state.query = String(e.target.value || '').toLowerCase().trim(); render(); }
      else if (id === 'url') { state.draftUrl = e.target.value; render(); }
      else if (id === 'title') { state.draftTitle = e.target.value; }
    });

    app.addEventListener('keydown', (e) => {
      const id = e.target.getAttribute && e.target.getAttribute('data-focus-id');
      if (id === 'url' && e.key === 'Enter') { e.preventDefault(); saveDraft(); }
      if (id === 'modaltag' && (e.key === 'Enter' || e.key === ',')) { e.preventDefault(); const v = String(e.target.value || '').trim().toLowerCase().replace(/[, ]+$/, ''); if (v) { const arr = (state.draftTags || []).slice(); if (arr.indexOf(v) < 0) arr.push(v); setState({ draftTags: arr }); } }
      if (e.key === 'Escape') { if (state.addOpen) setState({ addOpen: false }); else if (state.sortOpen) setState({ sortOpen: false }); }
    });

    // global "/" focuses search, Cmd/Ctrl+K focuses search
    document.addEventListener('keydown', (e) => {
      const inSearch = document.activeElement && document.activeElement.getAttribute('data-focus-id') === 'search';
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        const s = app.querySelector('[data-focus-id="search"]');
        if (s) { e.preventDefault(); s.focus(); s.select(); }
        return;
      }
      if (e.key === '/' && !state.addOpen && !inSearch) {
        const s = app.querySelector('[data-focus-id="search"]');
        if (s) { e.preventDefault(); s.focus(); }
      }
    });

    // re-render on resize so the column count adapts
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 120); });
  }

  init();
})();
