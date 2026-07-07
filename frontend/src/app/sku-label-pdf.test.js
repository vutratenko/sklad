import { describe, expect, it, vi } from 'vitest';
import {
  buildA4QRLabelLayout,
  flattenLabelEntries,
  generateBatchSKUQRCodePDF,
  generateSKUQRCodePDF,
  primaryBarcode,
  skuLabelFileName,
} from './sku-label-pdf.js';

function fakeDoc() {
  return {
    images: [],
    pages: 1,
    savedAs: '',
    addImage(image, type, x, y, width, height) {
      this.images.push({ image, type, x, y, width, height });
    },
    addPage() {
      this.pages += 1;
    },
    save(fileName) {
      this.savedAs = fileName;
    },
  };
}

describe('SKU QR label PDF', () => {
  it('uses a single primary barcode from SKU', () => {
    expect(primaryBarcode({ barcodes: ['000042'] })).toBe('000042');
    expect(primaryBarcode({ barcodes: [] })).toBe('');
  });

  it('builds a compact A4 label grid with 2cm QR codes', () => {
    const labels = buildA4QRLabelLayout();
    expect(labels.length).toBeGreaterThan(40);
    expect(labels[0]).toMatchObject({ x: 10, y: 10, qrSize: 20 });
  });

  it('flattens selected SKU counts into printable labels', () => {
    const flat = flattenLabelEntries([
      { sku: { name: 'A', barcodes: ['1'] }, count: 2 },
      { sku: { name: 'B', barcodes: ['2'] }, count: 1 },
    ]);
    expect(flat).toHaveLength(3);
    expect(flat[0].code).toBe('1');
    expect(flat[2].sku.name).toBe('B');
  });

  it('generates batch PDF with QR and SKU name under each code', async () => {
    const doc = fakeDoc();
    const textImageFactory = vi.fn((text) => `data:image/png;base64,text-${text}`);
    const result = await generateBatchSKUQRCodePDF(
      [
        { sku: { name: 'Томатная паста', barcodes: ['000042'] }, count: 2 },
        { sku: { name: 'Сахар', barcodes: ['000007'] }, count: 1 },
      ],
      {
        doc,
        qrFactory: vi.fn(async (code) => `data:image/png;base64,${code}`),
        textImageFactory,
      },
    );

    expect(result.labels).toBe(3);
    expect(doc.images).toHaveLength(6);
    expect(doc.images[0]).toMatchObject({ width: 20, height: 20 });
    expect(doc.images[1].image).toBe('data:image/png;base64,text-Томатная паста');
    expect(doc.savedAs).toBe('sklad-qr-labels.pdf');
  });

  it('fills one A4 page when printing a single SKU without explicit count', async () => {
    const doc = fakeDoc();
    const result = await generateSKUQRCodePDF(
      { name: 'Томатная паста', barcodes: ['000042'] },
      {
        doc,
        qrFactory: vi.fn(async (code) => `data:image/png;base64,${code}`),
        textImageFactory: vi.fn((text) => `data:image/png;base64,text-${text}`),
      },
    );

    expect(result.labels).toBe(buildA4QRLabelLayout().length);
    expect(doc.savedAs).toBe('sklad-000042.pdf');
  });

  it('rejects SKU without barcode', async () => {
    await expect(generateBatchSKUQRCodePDF([{ sku: { name: 'Без кода', barcodes: [] }, count: 1 }], { doc: fakeDoc() }))
      .rejects.toThrow('нет штрихкода');
  });

  it('uses deterministic PDF file names', () => {
    expect(skuLabelFileName([{ sku: { barcodes: ['000007'] }, count: 1 }])).toBe('sklad-000007.pdf');
    expect(skuLabelFileName([])).toBe('sklad-qr-labels.pdf');
  });
});
