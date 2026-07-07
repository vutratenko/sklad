import { describe, expect, it } from 'vitest';
import { isNavViewVisible, visibleNavViews } from './navigation.js';

describe('navigation visibility', () => {
  const views = ['home', 'stocks', 'movements', 'warehouses', 'skus', 'scan', 'sync', 'login'];

  it('hides login when user is authenticated', () => {
    expect(isNavViewVisible('login', true)).toBe(false);
    expect(visibleNavViews(views, true)).toEqual([
      'home',
      'stocks',
      'movements',
      'warehouses',
      'skus',
      'scan',
      'sync',
    ]);
  });

  it('shows only login when user is not authenticated', () => {
    expect(isNavViewVisible('stocks', false)).toBe(false);
    expect(visibleNavViews(views, false)).toEqual(['login']);
  });
});
