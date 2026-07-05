import { describe, expect, it } from 'vitest';
import { backoffMs, isConflictCode, isOpReadyForPush } from './sync-utils.js';

describe('isConflictCode', () => {
  it('recognizes ADR-005 conflict codes', () => {
    expect(isConflictCode('INSUFFICIENT_STOCK')).toBe(true);
    expect(isConflictCode('IDEMPOTENCY_KEY_PAYLOAD_MISMATCH')).toBe(true);
    expect(isConflictCode('VALIDATION_ERROR')).toBe(false);
  });
});

describe('isOpReadyForPush', () => {
  it('allows pending ops immediately', () => {
    expect(isOpReadyForPush({ status: 'pending' })).toBe(true);
  });

  it('respects retry backoff window', () => {
    const now = Date.parse('2026-07-06T10:00:00Z');
    expect(
      isOpReadyForPush(
        { status: 'retry_wait', nextRetryAt: '2026-07-06T10:05:00Z' },
        now
      )
    ).toBe(false);
    expect(
      isOpReadyForPush(
        { status: 'retry_wait', nextRetryAt: '2026-07-06T09:55:00Z' },
        now
      )
    ).toBe(true);
  });
});

describe('backoffMs', () => {
  it('grows exponentially with cap', () => {
    expect(backoffMs(1)).toBe(4000);
    expect(backoffMs(10)).toBe(300000);
  });
});
