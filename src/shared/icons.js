const ICONS = {
  copy: [
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>',
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
  ],
  pencil: [
    '<path d="M12 20h9"></path>',
    '<path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z"></path>',
  ],
  trash2: [
    '<path d="M3 6h18"></path>',
    '<path d="M8 6V4h8v2"></path>',
    '<path d="M19 6l-1 14H6L5 6"></path>',
    '<path d="M10 11v6"></path>',
    '<path d="M14 11v6"></path>',
  ],
  moon: ['<path d="M12 3a6 6 0 1 0 9 9 9 9 0 1 1-9-9Z"></path>'],
  sun: [
    '<circle cx="12" cy="12" r="4"></circle>',
    '<path d="M12 2v2"></path>',
    '<path d="M12 20v2"></path>',
    '<path d="m4.93 4.93 1.41 1.41"></path>',
    '<path d="m17.66 17.66 1.41 1.41"></path>',
    '<path d="M2 12h2"></path>',
    '<path d="M20 12h2"></path>',
    '<path d="m6.34 17.66-1.41 1.41"></path>',
    '<path d="m19.07 4.93-1.41 1.41"></path>',
  ],
  monitor: [
    '<rect x="2" y="3" width="20" height="14" rx="2"></rect>',
    '<path d="M8 21h8"></path>',
    '<path d="M12 17v4"></path>',
  ],
  columns3: [
    '<rect x="3" y="4" width="5" height="16" rx="1"></rect>',
    '<rect x="10" y="4" width="4" height="16" rx="1"></rect>',
    '<rect x="16" y="4" width="5" height="16" rx="1"></rect>',
  ],
  grid2x2: [
    '<rect x="3" y="3" width="8" height="8" rx="1"></rect>',
    '<rect x="13" y="3" width="8" height="8" rx="1"></rect>',
    '<rect x="3" y="13" width="8" height="8" rx="1"></rect>',
    '<rect x="13" y="13" width="8" height="8" rx="1"></rect>',
  ],
  list: [
    '<path d="M8 6h13"></path>',
    '<path d="M8 12h13"></path>',
    '<path d="M8 18h13"></path>',
    '<circle cx="4" cy="6" r="1.2"></circle>',
    '<circle cx="4" cy="12" r="1.2"></circle>',
    '<circle cx="4" cy="18" r="1.2"></circle>',
  ],
  layers: [
    '<path d="m12 2 9 5-9 5-9-5 9-5Z"></path>',
    '<path d="m3 12 9 5 9-5"></path>',
    '<path d="m3 17 9 5 9-5"></path>',
  ],
  download: [
    '<path d="M12 3v12"></path>',
    '<path d="m7 10 5 5 5-5"></path>',
    '<path d="M5 21h14"></path>',
  ],
  upload: [
    '<path d="M12 21V9"></path>',
    '<path d="m7 14 5-5 5 5"></path>',
    '<path d="M5 3h14"></path>',
  ],
  settings: [
    '<circle cx="12" cy="12" r="3"></circle>',
    '<path d="M12 2v2.5"></path>',
    '<path d="M12 19.5V22"></path>',
    '<path d="m4.93 4.93 1.77 1.77"></path>',
    '<path d="m17.3 17.3 1.77 1.77"></path>',
    '<path d="M2 12h2.5"></path>',
    '<path d="M19.5 12H22"></path>',
    '<path d="m6.7 17.3-1.77 1.77"></path>',
    '<path d="m19.07 4.93-1.77 1.77"></path>',
  ],
};

export function iconSvg(name, { size = 16, cls = '' } = {}) {
  const shapes = ICONS[name] || [];
  return `<svg class="lucide lucide-${name} ${cls}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes.join('')}</svg>`;
}
