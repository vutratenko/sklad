const TOKEN_KEY = 'sklad_access_token';
const AUTH_CONFIG_KEY = 'sklad_auth_config';
const REDIRECT_URI_KEY = 'sklad_oauth_redirect_uri';
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

let tokenStorage = globalThis.localStorage;
let now = () => Date.now();

export function configureAuthStorageForTests(storage, clock = () => Date.now()) {
  tokenStorage = storage;
  now = clock;
}

export async function loadAuthConfig() {
  const cached = sessionStorage.getItem(AUTH_CONFIG_KEY);
  if (cached) {
    return JSON.parse(cached);
  }
  const res = await fetch('/api/v1/auth/oidc/config');
  if (!res.ok) {
    throw new Error('failed to load auth config');
  }
  const config = await res.json();
  sessionStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify(config));
  return config;
}

export function getAccessToken() {
  const stored = tokenStorage?.getItem(TOKEN_KEY);
  if (!stored) {
    return null;
  }
  try {
    const parsed = JSON.parse(stored);
    if (parsed.expires_at <= now()) {
      tokenStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return parsed.token || null;
  } catch {
    tokenStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

export function setAccessToken(token) {
  if (token) {
    tokenStorage?.setItem(TOKEN_KEY, JSON.stringify({
      token,
      expires_at: now() + TOKEN_TTL_MS,
    }));
  } else {
    tokenStorage?.removeItem(TOKEN_KEY);
  }
}

export function selectAuthToken(tokenResponse) {
  return tokenResponse?.access_token || tokenResponse?.id_token || '';
}

export function hasOAuthCallback(search = window.location.search) {
  return Boolean(new URLSearchParams(search).get('code'));
}

export function callbackRedirectUri(config, location = window.location) {
  const stored = globalThis.sessionStorage?.getItem(REDIRECT_URI_KEY);
  if (stored) {
    return stored;
  }
  if (location?.origin && location?.pathname) {
    return `${location.origin}${location.pathname}`;
  }
  return config.redirect_uri || `${window.location.origin}/oauth/callback`;
}

export function logout() {
  setAccessToken(null);
  sessionStorage.removeItem(AUTH_CONFIG_KEY);
  sessionStorage.removeItem(REDIRECT_URI_KEY);
}

function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Base64Url(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function startLogin() {
  const config = await loadAuthConfig();
  if (config.dev_bypass) {
    return { devBypass: true };
  }

  const verifier = randomString(32);
  sessionStorage.setItem('pkce_verifier', verifier);
  const challenge = await sha256Base64Url(verifier);
  const redirectUri = config.redirect_uri || `${window.location.origin}/oauth/callback`;
  sessionStorage.setItem(REDIRECT_URI_KEY, redirectUri);
  const params = new URLSearchParams({
    client_id: config.client_id,
    response_type: 'code',
    scope: config.scope || 'openid profile email',
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  window.location.href = `${config.authorization_endpoint}?${params}`;
  return { devBypass: false };
}

export async function handleOAuthCallback(code) {
  if (!code) {
    throw new Error('missing authorization code');
  }
  const config = await loadAuthConfig();
  const verifier = sessionStorage.getItem('pkce_verifier');
  if (!verifier) {
    throw new Error('missing PKCE verifier');
  }
  const redirectUri = callbackRedirectUri(config);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.client_id,
    code_verifier: verifier,
  });
  const res = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error('token exchange failed');
  }
  const data = await res.json();
  setAccessToken(selectAuthToken(data));
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem(REDIRECT_URI_KEY);
  return data;
}

export async function fetchCurrentUser() {
  const headers = {};
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch('/api/v1/auth/me', { headers });
  if (!res.ok) {
    throw new Error('not authenticated');
  }
  return res.json();
}

export async function ensureAuth() {
  const config = await loadAuthConfig();
  if (config.dev_bypass) {
    return fetchCurrentUser();
  }
  if (!getAccessToken()) {
    return null;
  }
  return fetchCurrentUser();
}

export function authHeaders() {
  const token = getAccessToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
