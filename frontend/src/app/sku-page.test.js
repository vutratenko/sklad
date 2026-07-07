import { beforeEach, describe, expect, it } from 'vitest';
import { filterSkusForQrSearch, renderSkuPage, resetSkuPageStateForTests } from './sku-page.js';

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

  it('filters QR search suggestions by name and id', () => {
    expect(filterSkusForQrSearch(sampleSkus, 'томат')).toHaveLength(1);
    expect(filterSkusForQrSearch(sampleSkus, 'sku-2')[0].name).toBe('Сахар');
    expect(filterSkusForQrSearch(sampleSkus, 'sku-1', new Set(['sku-1']))).toHaveLength(0);
  });
});
