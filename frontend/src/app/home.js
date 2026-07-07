export function stockedWarehouses(stocks, warehouses) {
  const stockedIds = new Set(
    stocks
      .filter((stock) => Number(stock.quantity || 0) > 0 && stock.warehouse_id)
      .map((stock) => stock.warehouse_id)
  );
  const listedIds = new Set();
  const listed = warehouses
    .filter((warehouse) => stockedIds.has(warehouse.id))
    .map((warehouse) => {
      listedIds.add(warehouse.id);
      return { id: warehouse.id, name: warehouse.name };
    });
  const fallback = [];
  for (const stock of stocks) {
    if (!stockedIds.has(stock.warehouse_id) || listedIds.has(stock.warehouse_id)) continue;
    listedIds.add(stock.warehouse_id);
    fallback.push({ id: stock.warehouse_id, name: stock.warehouse || stock.warehouse_id });
  }

  return [...listed, ...fallback];
}
