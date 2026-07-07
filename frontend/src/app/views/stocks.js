import { db } from '../../infra/sync-engine.js';

export async function loadStocks(filters = {}) {
  let items = await db.getCachedStocks();
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    items = items.filter((s) => (s.sku_name || '').toLowerCase().includes(needle));
  }
  if (filters.sku_id) {
    items = items.filter((s) => s.sku_id === filters.sku_id);
  }
  if (filters.warehouse_id) {
    items = items.filter((s) => s.warehouse_id === filters.warehouse_id);
  }
  if (filters.location_id) {
    items = items.filter((s) => s.location_id === filters.location_id);
  }
  return items;
}
