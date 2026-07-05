const DB_NAME = 'sklad-wms';
const DB_VERSION = 3;
const SCHEMA_VERSION = 3;

const STORES = {
  skus: { keyPath: 'id' },
  stocks: { keyPath: 'id' },
  movements: { keyPath: 'id' },
  warehouses: { keyPath: 'id' },
  locations: { keyPath: 'id' },
  op_queue: { keyPath: 'opId' },
  sync_meta: { keyPath: 'key' },
};

let dbPromise = null;

export async function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, opts] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, opts);
          }
        }
      };
      req.onsuccess = async () => {
        await setMeta('schema_version', SCHEMA_VERSION);
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const result = fn(s);
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
  });
}

export async function getAll(store) {
  return tx(store, 'readonly', (s) => {
    return new Promise((res, rej) => {
      const req = s.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  });
}

export async function put(store, value) {
  return tx(store, 'readwrite', (s) => {
    s.put(value);
  });
}

export async function getMeta(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('sync_meta', 'readonly');
    const req = t.objectStore('sync_meta').get(key);
    req.onsuccess = () => resolve(req.result?.value);
    req.onerror = () => reject(req.error);
  });
}

export async function setMeta(key, value) {
  await put('sync_meta', { key, value });
}

export async function enqueueOp(op) {
  await put('op_queue', {
    ...op,
    status: 'pending',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function updateOp(op) {
  await put('op_queue', op);
}

import { isOpReadyForPush } from './sync-utils.js';

export async function getPendingOps() {
  const all = await getAll('op_queue');
  return all.filter((o) => isOpReadyForPush(o));
}

export async function getSyncOps() {
  const all = await getAll('op_queue');
  return all
    .filter((o) => o.status !== 'applied')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function removeOp(opId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('op_queue', 'readwrite');
    t.objectStore('op_queue').delete(opId);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function resetOpForRetry(op) {
  await updateOp({
    ...op,
    status: 'pending',
    retryCount: 0,
    lastError: undefined,
    errorCode: undefined,
    nextRetryAt: undefined,
  });
}

export async function applyOptimisticMovement(payload) {
  const line = payload.lines?.[0];
  if (!line) return;

  const qty = line.quantity;
  const skuId = line.sku_id;
  const type = payload.operation_type;
  const skus = await getCachedSKUs();
  const sku = skus.find((s) => s.id === skuId);
  const locations = await getAll('locations');
  const warehouses = await getAll('warehouses');

  function locMeta(locId) {
    const loc = locations.find((l) => l.id === locId);
    if (!loc) return {};
    const wh = warehouses.find((w) => w.id === loc.warehouse_id);
    return {
      location: loc.name,
      location_id: locId,
      warehouse: wh?.name || '',
      warehouse_id: loc.warehouse_id,
    };
  }

  async function adjustStock(locationId, delta) {
    if (!locationId || !delta) return;
    const all = await getCachedStocks();
    const meta = locMeta(locationId);
    const existing = all.find((s) => s.sku_id === skuId && s.location_id === locationId);
    if (existing) {
      existing.quantity = Math.max(0, (existing.quantity || 0) + delta);
      await put('stocks', existing);
      return;
    }
    if (delta <= 0) return;
    await put('stocks', {
      id: `local-${skuId}-${locationId}`,
      sku_id: skuId,
      sku_name: sku?.name || 'SKU',
      photo_url: sku?.photo_url || '',
      unit: sku?.unit || 'шт',
      quantity: delta,
      updated_at: new Date().toISOString(),
      ...meta,
    });
  }

  switch (type) {
    case 'receipt':
      await adjustStock(line.to_location_id, qty);
      break;
    case 'issue':
      await adjustStock(line.from_location_id, -qty);
      break;
    case 'transfer':
      await adjustStock(line.from_location_id, -qty);
      await adjustStock(line.to_location_id, qty);
      break;
    case 'adjustment':
      if (line.to_location_id) await adjustStock(line.to_location_id, qty);
      if (line.from_location_id) await adjustStock(line.from_location_id, -qty);
      break;
    default:
      break;
  }

  await put('movements', {
    id: `pending-${crypto.randomUUID()}`,
    operation_type: type,
    sku_id: skuId,
    sku_name: sku?.name || 'SKU',
    quantity: qty,
    from_location_id: line.from_location_id || null,
    to_location_id: line.to_location_id || null,
    reason_code: payload.reason_code || null,
    occurred_at: new Date().toISOString(),
    pending: true,
  });
}

export async function cacheStocks(items) {
  for (const item of items) {
    await put('stocks', { ...item, id: item.id || `${item.sku_id}-${item.location_id}` });
  }
}

export async function cacheSKUs(items) {
  for (const item of items) {
    await put('skus', item);
  }
}

export async function putSKU(item) {
  await put('skus', item);
}

export async function removeSKU(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('skus', 'readwrite');
    t.objectStore('skus').delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getCachedStocks() {
  return getAll('stocks');
}

export async function cacheMovements(items) {
  for (const item of items) {
    await put('movements', item);
  }
}

export async function getCachedMovements() {
  const items = await getAll('movements');
  return items.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
}

export async function getCachedSKUs() {
  return getAll('skus');
}

export async function findSKUByBarcode(barcode) {
  const code = String(barcode || '').trim();
  if (!code) return null;
  const items = await getCachedSKUs();
  return items.find((s) => (s.barcodes || []).includes(code)) || null;
}

export async function getStocksBySKUID(skuId) {
  const all = await getCachedStocks();
  return all.filter((s) => s.sku_id === skuId);
}

export async function cacheWarehouses(items) {
  for (const item of items) {
    await put('warehouses', item);
  }
}

export async function putWarehouse(item) {
  await put('warehouses', item);
}

export async function removeWarehouse(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('warehouses', 'readwrite');
    t.objectStore('warehouses').delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getCachedWarehouses() {
  return getAll('warehouses');
}

export async function cacheLocations(warehouseId, items) {
  for (const item of items) {
    await put('locations', { ...item, warehouse_id: item.warehouse_id || warehouseId });
  }
}

export async function putLocation(item) {
  await put('locations', item);
}

export async function removeLocation(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction('locations', 'readwrite');
    t.objectStore('locations').delete(id);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getCachedLocations(warehouseId) {
  const all = await getAll('locations');
  return all.filter((l) => l.warehouse_id === warehouseId);
}
