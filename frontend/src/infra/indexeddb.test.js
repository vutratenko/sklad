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
      const tx = {};
      tx.objectStore = () => ({
        put: (value) => {
          storeData.set(value.id || value.key || value.opId, value);
        },
        get: (key) => {
          const req = {};
          queueMicrotask(() => {
            req.result = storeData.get(key);
            req.onsuccess?.();
          });
          return req;
        },
        getAll: () => {
          const req = {};
          queueMicrotask(() => {
            req.result = Array.from(storeData.values());
            req.onsuccess?.();
          });
          return req;
        },
        delete: (key) => {
          storeData.delete(key);
        },
      });
      queueMicrotask(() => tx.oncomplete?.());
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
});
