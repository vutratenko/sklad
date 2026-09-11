export const THEME_STORAGE_KEY = 'sklad_theme';

export const THEME_COLORS = {
  dark: '#111317',
  light: '#ffffff',
};

export function resolveInitialTheme() {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  }
  if (typeof globalThis.matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function getTheme(root = globalThis.document?.documentElement) {
  if (!root?.dataset) return 'dark';
  return root.dataset.theme === 'light' ? 'light' : 'dark';
}

export function applyTheme(theme, root = globalThis.document?.documentElement) {
  const next = theme === 'light' ? 'light' : 'dark';
  if (root?.dataset) {
    root.dataset.theme = next;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  }
  const meta = globalThis.document?.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[next]);
  }
  updateThemeToggle(next);
  return next;
}

export function setTheme(theme) {
  return applyTheme(theme);
}

export function toggleTheme() {
  return applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  return applyTheme(resolveInitialTheme());
}

export function updateThemeToggle(theme = getTheme()) {
  const btn = globalThis.document?.getElementById('theme-toggle');
  if (!btn) return;
  const isLight = theme === 'light';
  btn.textContent = isLight ? '☀' : '☾';
  btn.setAttribute('aria-label', isLight ? 'Светлая тема, переключить на тёмную' : 'Тёмная тема, переключить на светлую');
  btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
}
