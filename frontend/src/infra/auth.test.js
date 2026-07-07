import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cacheUser,
  ensureAuth,
  configureAuthStorageForTests,
  callbackRedirectUri,
  getAccessToken,
  getCachedUser,
  handleOAuthCallback,
  hasOAuthCallback,
  loadAuthConfig,
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

describe('session auth flow', () => {
  let storage;
  let fetchCalls;
  let originalFetch;
  let originalWindow;
  let originalSessionStorage;

  beforeEach(() => {
    storage = memoryStorage();
    configureAuthStorageForTests(storage);
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    originalWindow = globalThis.window;
    originalSessionStorage = globalThis.sessionStorage;
    globalThis.sessionStorage = memoryStorage();
    globalThis.window = {
      location: { origin: 'https://sklad.sion2k.ru', pathname: '/' },
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    globalThis.sessionStorage = originalSessionStorage;
  });

  it('creates an app session on callback without storing provider tokens', async () => {
    sessionStorage.setItem('sklad_auth_config', JSON.stringify({
      client_id: 'sklad-client',
      token_endpoint: '/api/v1/auth/oidc/token',
      redirect_uri: 'https://sklad.sion2k.ru/oauth/callback',
    }));
    sessionStorage.setItem('pkce_verifier', 'pkce-verifier');
    setAccessToken('old-provider-token');
    globalThis.fetch = async (url, options) => {
      fetchCalls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          user: { id: 'user-42' },
          expires_at: '2027-01-01T00:00:00Z',
        }),
      };
    };

    const data = await handleOAuthCallback('auth-code');

    expect(data.user.id).toBe('user-42');
    expect(getAccessToken()).toBeNull();
    expect(fetchCalls[0].url).toBe('/api/v1/auth/oidc/token');
  });

  it('checks the cookie-backed session even without a stored access token', async () => {
    sessionStorage.setItem('sklad_auth_config', JSON.stringify({
      dev_bypass: false,
      token_endpoint: '/api/v1/auth/oidc/token',
    }));
    globalThis.fetch = async (url) => {
      fetchCalls.push({ url });
      return {
        ok: true,
        json: async () => ({ id: 'user-42' }),
      };
    };

    const user = await ensureAuth();

    expect(user.id).toBe('user-42');
    expect(fetchCalls.map((call) => call.url)).toEqual(['/api/v1/auth/me']);
    expect(getCachedUser()?.id).toBe('user-42');
  });

  it('restores cached user when offline', async () => {
    sessionStorage.setItem('sklad_auth_config', JSON.stringify({
      dev_bypass: false,
      token_endpoint: '/api/v1/auth/oidc/token',
    }));
    cacheUser({ id: 'user-offline', name: 'Offline User' });
    globalThis.navigator = { onLine: false };
    globalThis.fetch = async () => {
      throw new Error('network unavailable');
    };

    const user = await ensureAuth();

    expect(user).toEqual({ id: 'user-offline', name: 'Offline User' });
    globalThis.navigator = { onLine: true };
  });

  it('loads auth config from local storage when offline', async () => {
    storage.setItem('sklad_auth_config_local', JSON.stringify({
      client_id: 'sklad-client',
      dev_bypass: false,
    }));
    globalThis.navigator = { onLine: false };
    globalThis.fetch = async () => {
      throw new Error('network unavailable');
    };

    const config = await loadAuthConfig();

    expect(config.client_id).toBe('sklad-client');
    globalThis.navigator = { onLine: true };
  });
});
