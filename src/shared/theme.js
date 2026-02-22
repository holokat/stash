const AUTO_LIGHT_HOUR_START = 7;
const AUTO_LIGHT_HOUR_END = 19;

export function resolveTheme(themeMode) {
  if (themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';

  const hour = new Date().getHours();
  return hour >= AUTO_LIGHT_HOUR_START && hour < AUTO_LIGHT_HOUR_END ? 'light' : 'dark';
}

export function applyTheme(themeMode) {
  const effectiveTheme = resolveTheme(themeMode);
  document.documentElement.setAttribute('data-theme', effectiveTheme);
}
