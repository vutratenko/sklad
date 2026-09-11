import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function fakeIndexedDB() {
  const data = new Map();
  const db = {
    objectStoreNames: {
      contains: () => false,
    },
    createObjectStore: (name) => {
      if (!data.has(name)) data.set(name, new Map());
    },
    transaction: (name) => {
      const storeData = data.get(name) || new Map();
      data.set(name, storeData);
      let asyncOps = 0;
      let txCompleteScheduled = false;
      const scheduleComplete = () => {
        if (asyncOps > 0 || txCompleteScheduled) return;
        txCompleteScheduled = true;
        queueMicrotask(() => tx.oncomplete?.());
      };
      const tx = {};
      tx.objectStore = () => ({
        put: (value) => {
          storeData.set(value.id || value.key || value.opId, value);
        },
        get: (key) => {
          asyncOps += 1;
          const req = {};
          queueMicrotask(() => {
            req.result = storeData.get(key);
            req.onsuccess?.();
            asyncOps -= 1;
            scheduleComplete();
          });
          return req;
        },
        getAll: () => {
          asyncOps += 1;
          const req = {};
          queueMicrotask(() => {
            req.result = Array.from(storeData.values());
            req.onsuccess?.();
            asyncOps -= 1;
            scheduleComplete();
          });
          return req;
        },
        delete: (key) => {
          storeData.delete(key);
        },
      });
      queueMicrotask(scheduleComplete);
      return tx;
    },
  };

  return {
    open: () => {
      const req = {};
      queueMicrotask(() => {
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
}

describe('openDB', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.indexedDB = fakeIndexedDB();
  });

  afterEach(() => {
    delete globalThis.indexedDB;
  });

  it('resolves initial open without waiting on metadata writes through itself', async () => {
    const { openDB } = await import('./indexeddb.js');
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('openDB timed out')), 100));

    await expect(Promise.race([openDB(), timeout])).resolves.toBeTruthy();
  });

  it('replaces cached locations for a warehouse during sync refresh', async () => {
    const { cacheLocations, getCachedLocations, putLocation } = await import('./indexeddb.js');
    await putLocation({ id: 'loc-old', warehouse_id: 'wh-1', name: 'Old', code: 'old' });
    await putLocation({ id: 'loc-keep', warehouse_id: 'wh-1', name: 'Keep', code: 'keep' });
    await putLocation({ id: 'loc-other', warehouse_id: 'wh-2', name: 'Other', code: 'other' });

    await cacheLocations('wh-1', [{ id: 'loc-keep', name: 'Keep updated', code: 'keep' }]);

    await expect(getCachedLocations('wh-1')).resolves.toEqual([
      { id: 'loc-keep', warehouse_id: 'wh-1', name: 'Keep updated', code: 'keep' },
    ]);
    await expect(getCachedLocations('wh-2')).resolves.toEqual([
      { id: 'loc-other', warehouse_id: 'wh-2', name: 'Other', code: 'other' },
    ]);
  });

  it('prunes depleted stock rows after full stocks refresh', async () => {
    const { cacheStocks, getCachedStocks } = await import('./indexeddb.js');
    await cacheStocks([
      {
        id: 'bal-a',
        sku_id: 'sku-1',
        location_id: 'loc-a',
        warehouse_id: 'wh-1',
        quantity: 10,
      },
      {
        id: 'bal-other',
        sku_id: 'sku-2',
        location_id: 'loc-x',
        warehouse_id: 'wh-1',
        quantity: 3,
      },
    ]);

    // After transfer of all sku-1 from A→B, API returns only B
    await cacheStocks([
      {
        id: 'bal-b',
        sku_id: 'sku-1',
        location_id: 'loc-b',
        warehouse_id: 'wh-2',
        quantity: 10,
      },
      {
        id: 'bal-other',
        sku_id: 'sku-2',
        location_id: 'loc-x',
        warehouse_id: 'wh-1',
        quantity: 3,
      },
    ]);

    const stocks = await getCachedStocks();
    expect(stocks.find((s) => s.id === 'bal-a')).toBeUndefined();
    expect(stocks.find((s) => s.id === 'bal-b')).toMatchObject({ quantity: 10 });
    expect(stocks.find((s) => s.id === 'bal-other')).toMatchObject({ quantity: 3 });
  });

  it('prunes only the given SKU when refreshing sku-scoped stocks', async () => {
    const { cacheStocks, getCachedStocks } = await import('./indexeddb.js');
    await cacheStocks([
      {
        id: 'bal-a',
        sku_id: 'sku-1',
        location_id: 'loc-a',
        quantity: 10,
      },
      {
        id: 'bal-keep',
        sku_id: 'sku-2',
        location_id: 'loc-x',
        quantity: 5,
      },
    ]);

    await cacheStocks(
      [{ id: 'bal-b', sku_id: 'sku-1', location_id: 'loc-b', quantity: 10 }],
      { skuId: 'sku-1' }
    );

    const stocks = await getCachedStocks();
    expect(stocks.find((s) => s.id === 'bal-a')).toBeUndefined();
    expect(stocks.find((s) => s.id === 'bal-b')).toMatchObject({ quantity: 10 });
    expect(stocks.find((s) => s.id === 'bal-keep')).toMatchObject({ quantity: 5 });
  });

  it('removes zero-qty stock after optimistic transfer depletes source', async () => {
    const {
      applyOptimisticMovement,
      cacheStocks,
      getCachedStocks,
      putLocation,
      putSKU,
      putWarehouse,
    } = await import('./indexeddb.js');
    await putSKU({ id: 'sku-1', name: 'Paint', unit: 'шт' });
    await putWarehouse({ id: 'wh-1', name: 'Main' });
    await putLocation({ id: 'loc-a', warehouse_id: 'wh-1', name: 'A' });
    await putLocation({ id: 'loc-b', warehouse_id: 'wh-1', name: 'B' });
    await cacheStocks([
      {
        id: 'bal-a',
        sku_id: 'sku-1',
        location_id: 'loc-a',
        warehouse_id: 'wh-1',
        quantity: 10,
      },
    ]);

    await applyOptimisticMovement({
      operation_type: 'transfer',
      lines: [
        {
          sku_id: 'sku-1',
          quantity: 10,
          from_location_id: 'loc-a',
          to_location_id: 'loc-b',
        },
      ],
    });

    const stocks = await getCachedStocks();
    expect(stocks.find((s) => s.id === 'bal-a')).toBeUndefined();
    expect(stocks.find((s) => s.location_id === 'loc-b')).toMatchObject({ quantity: 10 });
  });

  it('replaces local optimistic row with server balance for same sku and location', async () => {
    const { cacheStocks, getCachedStocks } = await import('./indexeddb.js');
    await cacheStocks([
      {
        id: 'local-sku-1-loc-b',
        sku_id: 'sku-1',
        location_id: 'loc-b',
        quantity: 10,
      },
    ]);

    await cacheStocks([
      {
        id: 'bal-b-server',
        sku_id: 'sku-1',
        location_id: 'loc-b',
        quantity: 10,
      },
    ]);

    const stocks = await getCachedStocks();
    expect(stocks).toHaveLength(1);
    expect(stocks[0].id).toBe('bal-b-server');
  });

  it('does not apply optimistic movement twice for the same opId', async () => {
    const {
      applyOptimisticMovement,
      cacheStocks,
      getCachedStocks,
      putLocation,
      putSKU,
      putWarehouse,
    } = await import('./indexeddb.js');
    await putSKU({ id: 'sku-1', name: 'Paint', unit: 'шт' });
    await putWarehouse({ id: 'wh-1', name: 'Main' });
    await putLocation({ id: 'loc-a', warehouse_id: 'wh-1', name: 'A' });
    await putLocation({ id: 'loc-b', warehouse_id: 'wh-1', name: 'B' });
    await cacheStocks([
      {
        id: 'bal-a',
        sku_id: 'sku-1',
        location_id: 'loc-a',
        warehouse_id: 'wh-1',
        quantity: 10,
      },
    ]);

    const payload = {
      operation_type: 'transfer',
      lines: [
        {
          sku_id: 'sku-1',
          quantity: 4,
          from_location_id: 'loc-a',
          to_location_id: 'loc-b',
        },
      ],
    };
    await applyOptimisticMovement(payload, 'op-1');
    await applyOptimisticMovement(payload, 'op-1');

    const stocks = await getCachedStocks();
    const dest = stocks.find((s) => s.location_id === 'loc-b');
    expect(dest?.quantity).toBe(4);
    const source = stocks.find((s) => s.location_id === 'loc-a');
    expect(source?.quantity).toBe(6);
  });
});
