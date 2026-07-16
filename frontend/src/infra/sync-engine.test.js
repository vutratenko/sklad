import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({
  cacheStocks: vi.fn(),
  cacheSKUs: vi.fn(),
  cacheMovements: vi.fn(),
  cacheWarehouses: vi.fn(),
  cacheLocations: vi.fn(),
  getSyncOps: vi.fn(async () => []),
}));

vi.mock('./indexeddb.js', () => dbMock);
vi.mock('./auth.js', () => ({ authHeaders: () => ({}) }));
vi.mock('../app/photo-store.js', () => ({ prefetchSkuPhotos: vi.fn() }));

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
});
