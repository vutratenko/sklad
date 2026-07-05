import * as db from './indexeddb.js';
import { authHeaders } from './auth.js';
import { backoffMs, isConflictCode, isOpReadyForPush } from './sync-utils.js';

const API_BASE = '/api/v1';
const DEVICE_ID_KEY = 'sklad_device_id';

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function uuid() {
  return crypto.randomUUID();
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-Request-ID': uuid(),
      ...authHeaders(),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export class SyncEngine {
  constructor(onStatusChange) {
    this.onStatusChange = onStatusChange || (() => {});
    this.running = false;
    window.addEventListener('online', () => this.sync());
  }

  async sync() {
    if (this.running || !navigator.onLine) return;
    this.running = true;
    try {
      await this.push();
      await this.pull();
    } finally {
      this.running = false;
      await this.notifyStatus();
    }
  }

  async push() {
    const pending = await db.getPendingOps();
    if (pending.length === 0) return;

    const operations = pending.map((op) => ({
      operation_id: op.opId,
      idempotency_key: op.idempotencyKey || op.opId,
      entity: op.entityType,
      action: op.action,
      payload: op.payload,
      client_ts: op.createdAt,
    }));

    let needsRefresh = false;

    try {
      const resp = await apiFetch('/sync/push', {
        method: 'POST',
        body: JSON.stringify({
          device_id: getDeviceId(),
          batch_id: uuid(),
          schema_version: 1,
          operations,
        }),
      });

      for (const result of resp.results) {
        const op = pending.find((p) => p.opId === result.operation_id);
        if (!op) continue;
        if (result.status === 'applied' || result.status === 'duplicate_replayed') {
          await db.removeOp(op.opId);
          continue;
        }
        if (result.status === 'rejected') {
          op.errorCode = result.error_code;
          op.lastError = result.message;
          if (isConflictCode(result.error_code)) {
            op.status = 'conflict';
            needsRefresh = true;
          } else {
            op.status = 'failed';
          }
          await db.updateOp(op);
        }
      }

      if (resp.server_cursor) {
        await db.setMeta('server_cursor', resp.server_cursor);
      }
    } catch (err) {
      for (const op of pending) {
        op.retryCount = (op.retryCount || 0) + 1;
        if (op.retryCount >= 10) {
          op.status = 'failed';
          op.lastError = err.message;
        } else {
          op.status = 'retry_wait';
          op.nextRetryAt = new Date(Date.now() + backoffMs(op.retryCount)).toISOString();
        }
        await db.updateOp(op);
      }
    }

    if (needsRefresh) {
      await this.refreshLocalData();
    }
  }

  async pull() {
    let cursor = (await db.getMeta('server_cursor')) || 0;
    let hasMore = true;
    while (hasMore && navigator.onLine) {
      const resp = await apiFetch(`/sync/pull?cursor=${cursor}&limit=100`);
      if (resp.to_cursor != null) {
        cursor = resp.to_cursor;
        await db.setMeta('server_cursor', cursor);
      }
      hasMore = !!resp.has_more;
    }
    await this.refreshLocalData();
  }

  async refreshLocalData() {
    if (!navigator.onLine) return;
    try {
      const stocks = await apiFetch('/stocks');
      await db.cacheStocks(stocks.items || []);
      const skus = await apiFetch('/skus');
      await db.cacheSKUs(skus.items || []);
      const movements = await apiFetch('/movements?limit=200');
      await db.cacheMovements(movements.items || []);
      const warehouses = await apiFetch('/warehouses?active_only=true');
      await db.cacheWarehouses(warehouses.items || []);
      for (const wh of warehouses.items || []) {
        const locs = await apiFetch(`/warehouses/${wh.id}/locations?active_only=true`);
        await db.cacheLocations(wh.id, locs.items || []);
      }
    } catch {
      // offline or server error — use cached data
    }
  }

  async notifyStatus() {
    const ops = await db.getSyncOps();
    const pending = ops.filter((o) => o.status === 'pending' || o.status === 'retry_wait').length;
    const conflicts = ops.filter((o) => o.status === 'conflict').length;
    this.onStatusChange({ pending, conflicts, total: ops.length });
  }
}

export async function queueMovement(payload) {
  const opId = uuid();
  await db.enqueueOp({
    opId,
    idempotencyKey: opId,
    entityType: 'movement',
    action: 'create',
    payload,
  });
  await db.applyOptimisticMovement(payload);
  return opId;
}

export async function retrySyncOp(opId) {
  const ops = await db.getSyncOps();
  const op = ops.find((o) => o.opId === opId);
  if (!op) return;
  await db.resetOpForRetry(op);
}

export async function discardSyncOp(opId, engine) {
  await db.removeOp(opId);
  if (engine && navigator.onLine) {
    await engine.refreshLocalData();
  }
}

export { apiFetch, getDeviceId, db };

export async function apiUpload(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'X-Request-ID': uuid(),
      ...authHeaders(),
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}
