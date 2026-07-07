import { describe, expect, it } from 'vitest';
import { stockedWarehouses } from './home.js';

describe('home warehouse chips', () => {
  it('returns warehouses that have at least one stock unit', () => {
    const stocks = [
      { warehouse_id: 'wh-2', warehouse: 'Архив', quantity: 3 },
      { warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 0 },
      { warehouse_id: 'wh-3', warehouse: 'Запасной', quantity: 1 },
    ];
    const warehouses = [
      { id: 'wh-1', name: 'Кухня' },
      { id: 'wh-2', name: 'Архив' },
    ];

    expect(stockedWarehouses(stocks, warehouses)).toEqual([
      { id: 'wh-2', name: 'Архив' },
      { id: 'wh-3', name: 'Запасной' },
    ]);
  });

  it('deduplicates warehouses with multiple stock rows', () => {
    const stocks = [
      { warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 1 },
      { warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 5 },
    ];

    expect(stockedWarehouses(stocks, [{ id: 'wh-1', name: 'Кухня' }])).toEqual([
      { id: 'wh-1', name: 'Кухня' },
    ]);
  });
});
