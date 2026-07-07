function warehouseStats(stocks) {
  const statsByWarehouse = new Map();
  for (const stock of stocks) {
    const qty = Number(stock.quantity || 0);
    if (qty <= 0 || !stock.warehouse_id) continue;

    let stats = statsByWarehouse.get(stock.warehouse_id);
    if (!stats) {
      stats = { skuIds: new Set(), units: 0 };
      statsByWarehouse.set(stock.warehouse_id, stats);
    }
    stats.units += qty;
    if (stock.sku_id) stats.skuIds.add(stock.sku_id);
  }
  return statsByWarehouse;
}

export function stockedWarehouses(stocks, warehouses) {
  const statsByWarehouse = warehouseStats(stocks);
  const listedIds = new Set();
  const listed = warehouses
    .filter((warehouse) => statsByWarehouse.has(warehouse.id))
    .map((warehouse) => {
      listedIds.add(warehouse.id);
      const stats = statsByWarehouse.get(warehouse.id);
      return {
        id: warehouse.id,
        name: warehouse.name,
        skuCount: stats.skuIds.size,
        unitCount: stats.units,
      };
    });
  const fallback = [];
  for (const [warehouseId, stats] of statsByWarehouse) {
    if (listedIds.has(warehouseId)) continue;
    const stock = stocks.find((item) => item.warehouse_id === warehouseId);
    fallback.push({
      id: warehouseId,
      name: stock?.warehouse || warehouseId,
      skuCount: stats.skuIds.size,
      unitCount: stats.units,
    });
  }

  return [...listed, ...fallback];
}
