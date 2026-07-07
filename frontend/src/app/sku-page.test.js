import { beforeEach, describe, expect, it } from 'vitest';
import { renderSkuPage, resetSkuPageStateForTests } from './sku-page.js';

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
];

describe('sku page', () => {
  beforeEach(() => {
    resetSkuPageStateForTests();
  });

  it('renders collapsible new SKU and QR print panels', () => {
    const html = renderSkuPage(sampleSkus);
    expect(html).toContain('sku-new-panel');
    expect(html).toContain('sku-qr-panel');
    expect(html).toContain('Печать QR кодов');
    expect(html).toContain('hidden');
  });

  it('renders clickable SKU cards without inline action buttons', () => {
    const html = renderSkuPage(sampleSkus);
    expect(html).toContain('data-action="open-sku"');
    expect(html).not.toContain('data-action="print-sku-qr"');
    expect(html).not.toContain('>PDF QR<');
  });
});
