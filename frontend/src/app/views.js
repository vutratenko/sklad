import { db } from '../infra/sync-engine.js';
import { loadStocks } from './views/stocks.js';
import { loadMovements } from './views/movements.js';
import { loadSKUs, lookupBarcode } from './views/catalog.js';

/** ADR-003: IndexedDB is the UI source; API updates cache in background. */
export async function loadSKUsView(q = '') {
  return loadSKUs(q);
}

export async function loadStocksView(filters = {}) {
  return loadStocks(filters);
}

export async function loadMovementsView(filters = {}) {
  return loadMovements(filters);
}

export { lookupBarcode };

export async function loadSyncQueue() {
  const ops = await db.getSyncOps();
  const cursor = (await db.getMeta('server_cursor')) || 0;
  return { ops, cursor };
}
