import { apiFetch, db } from '../../infra/sync-engine.js';

export async function loadStocks(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.sku_id) params.set('sku_id', filters.sku_id);
  if (filters.warehouse_id) params.set('warehouse_id', filters.warehouse_id);
  if (filters.location_id) params.set('location_id', filters.location_id);
  const query = params.toString() ? `?${params}` : '';
  if (navigator.onLine) {
    try {
      const resp = await apiFetch(`/stocks${query}`);
      await db.cacheStocks(resp.items || []);
    } catch {
      // use cache
    }
  }
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
