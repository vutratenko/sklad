import { describe, expect, it } from 'vitest';
import { groupStocksBySku } from './stocks.js';

describe('groupStocksBySku', () => {
  const skus = [
    { id: 'sku-1', name: 'Сахар', unit: 'кг' },
    { id: 'sku-2', name: 'Соль', unit: 'шт' },
  ];

  it('groups stock rows by sku and aggregates warehouse quantities', () => {
    const stocks = [
      { sku_id: 'sku-1', sku_name: 'Сахар', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 2 },
      { sku_id: 'sku-1', sku_name: 'Сахар', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 3 },
      { sku_id: 'sku-1', sku_name: 'Сахар', warehouse_id: 'wh-2', warehouse: 'Архив', quantity: 1 },
      { sku_id: 'sku-2', sku_name: 'Соль', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 4 },
    ];

    expect(groupStocksBySku(stocks, skus)).toEqual([
      {
        sku_id: 'sku-1',
        sku_name: 'Сахар',
        unit: 'кг',
        totalQty: 6,
        warehouses: [
          { warehouse_id: 'wh-1', name: 'Кухня', quantity: 5 },
          { warehouse_id: 'wh-2', name: 'Архив', quantity: 1 },
        ],
      },
      {
        sku_id: 'sku-2',
        sku_name: 'Соль',
        unit: 'шт',
        totalQty: 4,
        warehouses: [
          { warehouse_id: 'wh-1', name: 'Кухня', quantity: 4 },
        ],
      },
    ]);
  });

  it('skips zero-quantity rows and warehouses', () => {
    const stocks = [
      { sku_id: 'sku-1', warehouse_id: 'wh-1', warehouse: 'Кухня', quantity: 0 },
      { sku_id: 'sku-1', warehouse_id: 'wh-2', warehouse: 'Архив', quantity: 2 },
    ];

    expect(groupStocksBySku(stocks, skus)).toEqual([
      {
        sku_id: 'sku-1',
        sku_name: 'Сахар',
        unit: 'кг',
        totalQty: 2,
        warehouses: [
          { warehouse_id: 'wh-2', name: 'Архив', quantity: 2 },
        ],
      },
    ]);
  });
});
