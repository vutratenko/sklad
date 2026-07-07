import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  collectCategories,
  filterSkusByCategory,
  searchSkus,
} from './movement-wizard.js';

const skus = [
  { id: 'sku-1', name: 'Томатная паста', category: 'консервы', is_active: true, barcodes: ['4601'] },
  { id: 'sku-2', name: 'Сахар', category: 'бакалея', is_active: true, barcodes: [] },
  { id: 'sku-3', name: 'Соль', category: '', is_active: true, barcodes: [] },
  { id: 'sku-4', name: 'Архивный товар', category: 'прочее', is_active: false, barcodes: [] },
];

describe('movement wizard helpers', () => {
  it('normalizes empty category label', () => {
    expect(categoryLabel('')).toBe('Без категории');
    expect(categoryLabel('бакалея')).toBe('бакалея');
  });

  it('collects active categories sorted', () => {
    expect(collectCategories(skus)).toEqual(['Без категории', 'бакалея', 'консервы']);
  });

  it('filters skus by category', () => {
    expect(filterSkusByCategory(skus, 'бакалея')).toEqual([skus[1]]);
    expect(filterSkusByCategory(skus, 'Без категории')).toEqual([skus[2]]);
  });

  it('searches skus by name, category and barcode', () => {
    expect(searchSkus(skus, 'томат').map((s) => s.id)).toEqual(['sku-1']);
    expect(searchSkus(skus, 'бакалея').map((s) => s.id)).toEqual(['sku-2']);
    expect(searchSkus(skus, '4601').map((s) => s.id)).toEqual(['sku-1']);
    expect(searchSkus(skus, 'архив')).toEqual([]);
  });
});
