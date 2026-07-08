import { db } from '../../infra/sync-engine.js';

export function groupStocksBySku(stocks, skus = []) {
  const skuById = Object.fromEntries(skus.map((sku) => [sku.id, sku]));
  const grouped = new Map();

  for (const stock of stocks) {
    const qty = Number(stock.quantity || 0);
    if (qty <= 0 || !stock.sku_id) continue;

    let entry = grouped.get(stock.sku_id);
    if (!entry) {
      const sku = skuById[stock.sku_id];
      entry = {
        sku_id: stock.sku_id,
        sku_name: stock.sku_name || sku?.name || 'SKU',
        unit: stock.unit || sku?.unit || 'шт',
        warehouses: new Map(),
        totalQty: 0,
      };
      grouped.set(stock.sku_id, entry);
    }

    const warehouseId = stock.warehouse_id || '';
    const warehouseName = stock.warehouse || warehouseId || 'Склад';
    const warehouseKey = warehouseId || warehouseName;
    const prev = entry.warehouses.get(warehouseKey) || {
      warehouse_id: warehouseId,
      name: warehouseName,
      quantity: 0,
    };
    prev.quantity += qty;
    entry.warehouses.set(warehouseKey, prev);
    entry.totalQty += qty;
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      warehouses: [...entry.warehouses.values()].filter((warehouse) => warehouse.quantity > 0),
    }))
    .sort((a, b) => a.sku_name.localeCompare(b.sku_name, 'ru', { sensitivity: 'base' }));
}

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
