import { beforeEach, describe, expect, it } from 'vitest';
import {
  filterSkusForQrSearch,
  renderSkuPage,
  renderSkuResults,
  resetSkuPageStateForTests,
  setSelectedSkuIdForTests,
} from './sku-page.js';

const sampleSkus = [
  {
    id: 'sku-1',
    name: 'Томатная паста',
    category: 'консервы',
    unit: 'шт',
    is_active: true,
    barcodes: ['4601'],
    photo_src: '',
  },
  {
    id: 'sku-2',
    name: 'Сахар',
    category: 'бакалея',
    unit: 'кг',
    is_active: true,
    barcodes: ['0002'],
    photo_src: '',
  },
];

describe('sku page', () => {
  beforeEach(() => {
    resetSkuPageStateForTests();
  });

  it('renders collapsible new SKU and QR print panels', () => {
    const html = renderSkuPage(sampleSkus, { allSkus: sampleSkus });
    expect(html).toContain('sku-new-panel');
    expect(html).toContain('sku-qr-panel');
    expect(html).toContain('Печать QR кодов');
    expect(html).toContain('sku-qr-search');
  });

  it('renders clickable SKU cards without inline action buttons', () => {
    const html = renderSkuPage(sampleSkus, { allSkus: sampleSkus });
    expect(html).toContain('data-action="open-sku"');
    expect(html).not.toContain('data-action="print-sku-qr"');
    expect(html).not.toContain('data-action="qr-toggle"');
  });

  it('filters QR search suggestions by name and QR code', () => {
    expect(filterSkusForQrSearch(sampleSkus, 'томат')).toHaveLength(1);
    expect(filterSkusForQrSearch(sampleSkus, '0002')[0].name).toBe('Сахар');
    expect(filterSkusForQrSearch(sampleSkus, 'sku-2')).toHaveLength(0);
    expect(filterSkusForQrSearch(sampleSkus, '4601', new Set(['sku-1']))).toHaveLength(0);
  });

  it('keeps create form and list containers separate for lazy refresh', () => {
    const html = renderSkuPage(sampleSkus, { allSkus: sampleSkus });
    expect(html).toContain('id="sku-results"');
    expect(html).toContain('sku-new-panel');
  });

  it('renders new SKU photo input and category datalist', () => {
    const html = renderSkuPage(sampleSkus, { allSkus: sampleSkus });
    expect(html).toContain('id="sku-photo"');
    expect(html).toContain('list="sku-category-options"');
    expect(html).toContain('<datalist id="sku-category-options">');
    expect(html).toContain('value="консервы"');
    expect(html).toContain('value="бакалея"');
  });

  it('renders selected SKU detail after its card, not before the list', () => {
    setSelectedSkuIdForTests('sku-1');
    const html = renderSkuResults(sampleSkus);
    const firstCard = html.indexOf('data-id="sku-1"');
    const detail = html.indexOf('id="sku-detail-sku-1"');
    const secondCard = html.indexOf('data-id="sku-2"');
    expect(firstCard).toBeGreaterThan(-1);
    expect(detail).toBeGreaterThan(firstCard);
    expect(secondCard).toBeGreaterThan(detail);
  });

  it('renders inline edit fields with category input in detail panel', () => {
    setSelectedSkuIdForTests('sku-1');
    const html = renderSkuResults(sampleSkus);
    expect(html).toContain('id="sku-edit-category-sku-1"');
    expect(html).toContain('data-action="save-sku"');
    expect(html).not.toContain('data-action="edit-sku"');
  });
});
