import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSKUs } from './views/catalog.js';
import { loadMovements } from './views/movements.js';
import { loadStocks } from './views/stocks.js';
import { loadLocations, loadWarehouses } from './views/topology.js';
import { apiFetch } from '../infra/sync-engine.js';

const state = {
  skus: [],
  stocks: [],
  movements: [],
  warehouses: [],
  locations: [],
};

vi.mock('./photo-store.js', () => ({
  enrichSkusPhotos: vi.fn(async (skus) => skus.map((sku) => ({ ...sku, photo_src: sku.photo_url || '' }))),
  enrichSkuPhoto: vi.fn(async (sku) => ({ ...sku, photo_src: sku?.photo_url || '' })),
  cacheServerPhoto: vi.fn(async () => {}),
  localPhotoUrl: vi.fn((id) => `local:${id}`),
  saveLocalPhoto: vi.fn(async () => 'blob:local'),
}));

vi.mock('../infra/sync-engine.js', () => ({
  apiFetch: vi.fn(async () => {
    throw new Error('network should not be used for tab loading');
  }),
  apiUpload: vi.fn(),
  getDeviceId: vi.fn(() => 'device-1'),
  queueMovement: vi.fn(),
  db: {
    getCachedSKUs: vi.fn(async () => state.skus),
    getCachedStocks: vi.fn(async () => state.stocks),
    getCachedMovements: vi.fn(async () => state.movements),
    getCachedWarehouses: vi.fn(async () => state.warehouses),
    getCachedLocations: vi.fn(async (warehouseId) => state.locations.filter((l) => l.warehouse_id === warehouseId)),
  },
  queuePhotoUpload: vi.fn(),
}));

describe('tab data loaders', () => {
  beforeEach(() => {
    apiFetch.mockClear();
    state.skus = [
      { id: 'sku-1', name: 'Томатная паста', category: 'консервы', unit: 'шт', is_active: true, barcodes: ['4601'] },
      { id: 'sku-2', name: 'Сахар', category: 'бакалея', unit: 'кг', is_active: false, barcodes: [] },
    ];
    state.stocks = [
      { id: 'stock-1', sku_id: 'sku-1', sku_name: 'Томатная паста', warehouse_id: 'wh-1', location_id: 'loc-1' },
      { id: 'stock-2', sku_id: 'sku-2', sku_name: 'Сахар', warehouse_id: 'wh-2', location_id: 'loc-2' },
    ];
    state.movements = [
      { id: 'mv-1', sku_id: 'sku-1', operation_type: 'receipt', occurred_at: '2026-01-02T00:00:00Z' },
      { id: 'mv-2', sku_id: 'sku-2', operation_type: 'issue', occurred_at: '2026-01-01T00:00:00Z' },
    ];
    state.warehouses = [
      { id: 'wh-1', name: 'Кухня', is_active: true },
      { id: 'wh-2', name: 'Архив', is_active: false },
    ];
    state.locations = [
      { id: 'loc-1', warehouse_id: 'wh-1', name: 'Полка 1', is_active: true },
      { id: 'loc-2', warehouse_id: 'wh-1', name: 'Полка 2', is_active: false },
    ];
  });

  it('loads SKU tab from cache without waiting for API', async () => {
    await expect(loadSKUs('томат', true)).resolves.toEqual([{ ...state.skus[0], photo_src: '' }]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('loads stocks tab from cache and applies filters locally', async () => {
    await expect(loadStocks({ warehouse_id: 'wh-1' })).resolves.toEqual([state.stocks[0]]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('loads movements tab from cache and applies filters locally', async () => {
    await expect(loadMovements({ operation_type: 'issue' })).resolves.toEqual([state.movements[1]]);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('loads topology tab from cache and applies active filters locally', async () => {
    await expect(loadWarehouses(true)).resolves.toEqual([state.warehouses[0]]);
    await expect(loadLocations('wh-1', true)).resolves.toEqual([state.locations[0]]);
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
