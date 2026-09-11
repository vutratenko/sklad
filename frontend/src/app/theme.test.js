import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  getTheme,
  resolveInitialTheme,
  setTheme,
  THEME_COLORS,
  THEME_STORAGE_KEY,
  toggleTheme,
} from './theme.js';

function mockDom() {
  const root = { dataset: {} };
  const meta = {
    content: '#111317',
    setAttribute(key, value) {
      if (key === 'content') this.content = value;
    },
    getAttribute(key) {
      return key === 'content' ? this.content : undefined;
    },
  };
  const button = { textContent: '', attributes: {} };
  button.setAttribute = (key, value) => {
    button.attributes[key] = value;
  };
  button.getAttribute = (key) => button.attributes[key];
  globalThis.document = {
    documentElement: root,
    querySelector: (sel) => (sel.includes('theme-color') ? meta : null),
    getElementById: (id) => (id === 'theme-toggle' ? button : null),
  };
  globalThis.localStorage = {
    store: {},
    getItem(key) {
      return this.store[key] ?? null;
    },
    setItem(key, value) {
      this.store[key] = value;
    },
  };
  return { root, meta, button };
}

describe('theme', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    mockDom();
  });

  it('resolves stored theme preference', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(resolveInitialTheme()).toBe('light');
  });

  it('setTheme updates dataset and meta theme-color', () => {
    setTheme('light');
    expect(getTheme()).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe(THEME_COLORS.light);
  });

  it('toggleTheme switches between dark and light', () => {
    applyTheme('dark');
    toggleTheme();
    expect(getTheme()).toBe('light');
    toggleTheme();
    expect(getTheme()).toBe('dark');
  });
});
