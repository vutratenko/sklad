import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  cacheStocks: vi.fn(),
  cacheSKUs: vi.fn(),
  cacheMovements: vi.fn(),
  cacheWarehouses: vi.fn(),
  cacheLocations: vi.fn(),
  getSyncOps: vi.fn(async () => []),
  getPendingOps: vi.fn(async () => []),
  enqueueOp: vi.fn(),
  applyOptimisticMovement: vi.fn(),
  applyOptimisticSku: vi.fn(),
  applyOptimisticSkuUpdate: vi.fn(),
  removeOp: vi.fn(),
  updateOp: vi.fn(),
  setMeta: vi.fn(),
  getMeta: vi.fn(async () => 0),
  getLocalPhoto: vi.fn(async () => null),
}));

vi.mock('./indexeddb.js', () => dbMock);
vi.mock('./auth.js', () => ({ authHeaders: () => ({}) }));
vi.mock('../app/photo-store.js', () => ({
  prefetchSkuPhotos: vi.fn(),
  getLocalPhotoRecord: vi.fn(async () => null),
  cacheServerPhoto: vi.fn(),
  markLocalPhotoSynced: vi.fn(),
}));

function okJson(body, { status = 200 } = {}) {
  const text = body == null ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 204 ? 'No Content' : 'OK',
    text: async () => text,
    json: async () => {
      if (!text) throw new SyntaxError('Unexpected end of JSON input');
      return JSON.parse(text);
    },
  };
}

describe('SyncEngine', () => {
  let target;

  beforeEach(() => {
    vi.clearAllMocks();
    target = new EventTarget();
    vi.stubGlobal('window', {
      addEventListener: target.addEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    });
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (url.endsWith('/stocks')) return okJson({ items: [] });
      if (url.endsWith('/skus')) return okJson({ items: [] });
      if (url.endsWith('/movements?limit=200')) return okJson({ items: [] });
      if (url.endsWith('/warehouses?active_only=true')) return okJson({ items: [{ id: 'wh-1' }] });
      if (url.endsWith('/warehouses/wh-1/locations?active_only=true')) return okJson({ items: [] });
      return okJson({});
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('notifies the app when local cached data was refreshed', async () => {
    const { SyncEngine } = await import('./sync-engine.js');
    const engine = new SyncEngine();
    const listener = vi.fn();
    window.addEventListener('sklad:data-updated', listener);

    await engine.refreshLocalData();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toEqual({ source: 'sync' });
  });

  it('treats DELETE 204 responses as success without parsing JSON', async () => {
    const { apiFetch } = await import('./sync-engine.js');
    fetch.mockResolvedValueOnce(okJson(null, { status: 204 }));

    await expect(apiFetch('/locations/loc-1', { method: 'DELETE' })).resolves.toBeNull();
  });

  it('sync pushes sku ops before photos', async () => {
    const pushSpy = vi.fn();
    const pushPhotosSpy = vi.fn();
    const { SyncEngine } = await import('./sync-engine.js');
    const engine = new SyncEngine();
    engine.push = pushSpy;
    engine.pushPhotos = pushPhotosSpy;
    engine.pull = vi.fn();

    await engine.sync();

    expect(pushSpy.mock.invocationCallOrder[0]).toBeLessThan(pushPhotosSpy.mock.invocationCallOrder[0]);
  });

  it('pushPhotos skips photo upload while sku create is pending', async () => {
    dbMock.getSyncOps.mockResolvedValueOnce([
      {
        opId: 'sku-op',
        entityType: 'sku',
        action: 'create',
        status: 'pending',
        payload: { id: 'sku-1' },
      },
      {
        opId: 'photo-op',
        entityType: 'sku_photo',
        action: 'upload',
        status: 'pending',
        payload: { sku_id: 'sku-1' },
      },
    ]);
    const { getLocalPhotoRecord } = await import('../app/photo-store.js');
    getLocalPhotoRecord.mockResolvedValue({
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      pendingUpload: true,
      filename: 'sku-1.jpg',
      mimeType: 'image/jpeg',
    });

    const { SyncEngine } = await import('./sync-engine.js');
    const engine = new SyncEngine();
    await engine.pushPhotos();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('queueSkuCreate enqueues sku create and applies optimistic cache', async () => {
    const { queueSkuCreate } = await import('./sync-engine.js');
    await queueSkuCreate({ id: 'sku-1', name: 'Tomato' });
    expect(dbMock.enqueueOp).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'sku',
      action: 'create',
      payload: { id: 'sku-1', name: 'Tomato' },
    }));
    expect(dbMock.applyOptimisticSku).toHaveBeenCalledWith({ id: 'sku-1', name: 'Tomato' });
  });

  it('queueMovement uses opId as idempotency key and applies optimistic update once', async () => {
    const { queueMovement } = await import('./sync-engine.js');
    dbMock.enqueueOp.mockResolvedValue(undefined);
    dbMock.applyOptimisticMovement.mockResolvedValue(undefined);

    const opId = await queueMovement({
      operation_type: 'transfer',
      lines: [{ sku_id: 'sku-1', quantity: 1, from_location_id: 'a', to_location_id: 'b' }],
    });

    expect(typeof opId).toBe('string');
    expect(dbMock.enqueueOp).toHaveBeenCalledTimes(1);
    const enqueued = dbMock.enqueueOp.mock.calls[0][0];
    expect(enqueued.idempotencyKey).toBe(enqueued.opId);
    expect(dbMock.applyOptimisticMovement).toHaveBeenCalledWith(
      expect.objectContaining({ operation_type: 'transfer' }),
      enqueued.opId,
    );
  });
});
