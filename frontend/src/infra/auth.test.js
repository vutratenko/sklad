import { describe, expect, it } from 'vitest';
import { selectAuthToken } from './auth.js';

describe('selectAuthToken', () => {
  it('prefers OIDC id_token because the API validates JWTs', () => {
    expect(selectAuthToken({ access_token: 'opaque-access', id_token: 'jwt-id' })).toBe('jwt-id');
  });

  it('falls back to access_token for providers that return JWT access tokens', () => {
    expect(selectAuthToken({ access_token: 'jwt-access' })).toBe('jwt-access');
  });
});
