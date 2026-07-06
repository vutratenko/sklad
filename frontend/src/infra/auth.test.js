import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureAuthStorageForTests,
  getAccessToken,
  selectAuthToken,
  setAccessToken,
} from './auth.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('selectAuthToken', () => {
  it('prefers OIDC id_token because the API validates JWTs', () => {
    expect(selectAuthToken({ access_token: 'opaque-access', id_token: 'jwt-id' })).toBe('jwt-id');
  });

  it('falls back to access_token for providers that return JWT access tokens', () => {
    expect(selectAuthToken({ access_token: 'jwt-access' })).toBe('jwt-access');
  });
});

describe('access token storage', () => {
  let storage;
  let currentTime;

  beforeEach(() => {
    storage = memoryStorage();
    currentTime = Date.UTC(2026, 0, 1);
    configureAuthStorageForTests(storage, () => currentTime);
  });

  it('keeps tokens for up to 365 days', () => {
    setAccessToken('opaque-access');
    currentTime += 364 * 24 * 60 * 60 * 1000;

    expect(getAccessToken()).toBe('opaque-access');
  });

  it('removes locally expired tokens', () => {
    setAccessToken('opaque-access');
    currentTime += 366 * 24 * 60 * 60 * 1000;

    expect(getAccessToken()).toBeNull();
  });
});
