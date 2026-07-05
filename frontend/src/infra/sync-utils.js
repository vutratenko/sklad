export const CONFLICT_CODES = new Set(['INSUFFICIENT_STOCK', 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH']);

export function isConflictCode(code) {
  return CONFLICT_CODES.has(code);
}

export function isOpReadyForPush(op, nowMs = Date.now()) {
  if (!op) return false;
  if (op.status === 'pending') return true;
  if (op.status === 'retry_wait') {
    if (!op.nextRetryAt) return true;
    return new Date(op.nextRetryAt).getTime() <= nowMs;
  }
  return false;
}

export function backoffMs(attempt) {
  return Math.min(300000, 2000 * 2 ** attempt);
}
