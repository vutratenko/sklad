import { beforeEach, describe, expect, it } from 'vitest';
import {
  configureAuthStorageForTests,
  callbackRedirectUri,
  getAccessToken,
  hasOAuthCallback,
  selectAuthToken,
  setAccessToken,
  tokenEndpoint,
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
  it('prefers access_token because Nextcloud validates it through the OCS user endpoint', () => {
    expect(selectAuthToken({ access_token: 'opaque-access', id_token: 'jwt-id' })).toBe('opaque-access');
  });

  it('falls back to id_token for providers that do not return an access token', () => {
    expect(selectAuthToken({ id_token: 'jwt-id' })).toBe('jwt-id');
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

describe('OAuth callback helpers', () => {
  it('detects authorization code on any route', () => {
    expect(hasOAuthCallback('?state=&code=abc')).toBe(true);
    expect(hasOAuthCallback('?state=abc')).toBe(false);
  });

  it('falls back to current callback URL when stored redirect is missing', () => {
    expect(callbackRedirectUri(
      { redirect_uri: 'https://sklad.example.com/oauth/callback' },
      { origin: 'https://sklad.example.com', pathname: '/' },
    )).toBe('https://sklad.example.com/');
  });
});

describe('tokenEndpoint', () => {
  it('keeps token exchange same-origin even when a cached config has the old provider URL', () => {
    expect(tokenEndpoint(
      { token_endpoint: 'https://cloud.sion2k.ru/apps/oauth2/api/v1/token' },
      { origin: 'https://sklad.sion2k.ru' },
    )).toBe('/api/v1/auth/oidc/token');
  });

  it('uses local API token endpoint from backend config', () => {
    expect(tokenEndpoint(
      { token_endpoint: '/api/v1/auth/oidc/token' },
      { origin: 'https://sklad.sion2k.ru' },
    )).toBe('/api/v1/auth/oidc/token');
  });
});
