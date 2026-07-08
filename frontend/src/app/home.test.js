import { describe, expect, it } from 'vitest';
import { stockedCategories, stockedWarehouses } from './home.js';

describe('home warehouse chips', () => {
  it('returns warehouses that have at least one stock unit', () => {
    const stocks = [
      { sku_id: 'sku-a', warehouse_id: 'wh-2', warehouse: 'Архив', quantity: 3 },
      { sku_id: 'sku-b', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 0 },
      { sku_id: 'sku-c', warehouse_id: 'wh-3', warehouse: 'Запасной', quantity: 1 },
    ];
    const warehouses = [
      { id: 'wh-1', name: 'Кухня' },
      { id: 'wh-2', name: 'Архив' },
    ];

    expect(stockedWarehouses(stocks, warehouses)).toEqual([
      { id: 'wh-2', name: 'Архив', skuCount: 1, unitCount: 3 },
      { id: 'wh-3', name: 'Запасной', skuCount: 1, unitCount: 1 },
    ]);
  });

  it('deduplicates warehouses with multiple stock rows', () => {
    const stocks = [
      { sku_id: 'sku-1', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 1 },
      { sku_id: 'sku-1', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 5 },
    ];

    expect(stockedWarehouses(stocks, [{ id: 'wh-1', name: 'Кухня' }])).toEqual([
      { id: 'wh-1', name: 'Кухня', skuCount: 1, unitCount: 6 },
    ]);
  });

  it('counts distinct SKUs per warehouse', () => {
    const stocks = [
      { sku_id: 'sku-1', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 2 },
      { sku_id: 'sku-2', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 4 },
      { sku_id: 'sku-3', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 0 },
    ];

    expect(stockedWarehouses(stocks, [{ id: 'wh-1', name: 'Кухня' }])).toEqual([
      { id: 'wh-1', name: 'Кухня', skuCount: 2, unitCount: 6 },
    ]);
  });
});

describe('home category chips', () => {
  it('returns categories with sku and unit counts', () => {
    const stocks = [
      { sku_id: 'sku-1', quantity: 2 },
      { sku_id: 'sku-1', quantity: 3 },
      { sku_id: 'sku-2', quantity: 4 },
      { sku_id: 'sku-3', quantity: 0 },
    ];
    const skus = [
      { id: 'sku-1', category: 'бакалея' },
      { id: 'sku-2', category: 'бакалея' },
      { id: 'sku-3', category: 'прочее' },
    ];

    expect(stockedCategories(stocks, skus)).toEqual([
      { name: 'бакалея', skuCount: 2, unitCount: 9 },
    ]);
  });

  it('groups uncategorized skus', () => {
    const stocks = [
      { sku_id: 'sku-1', quantity: 1 },
      { sku_id: 'sku-2', quantity: 2 },
    ];
    const skus = [
      { id: 'sku-1', category: '' },
      { id: 'sku-2', category: 'консервы' },
    ];

    expect(stockedCategories(stocks, skus)).toEqual([
      { name: 'Без категории', skuCount: 1, unitCount: 1 },
      { name: 'консервы', skuCount: 1, unitCount: 2 },
    ]);
  });
});
