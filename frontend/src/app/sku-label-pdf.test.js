import { describe, expect, it, vi } from 'vitest';
import { buildA4QRLabelLayout, generateSKUQRCodePDF, primaryBarcode, skuLabelFileName } from './sku-label-pdf.js';

function fakeDoc() {
  return {
    images: [],
    savedAs: '',
    addImage(image, type, x, y, width, height) {
      this.images.push({ image, type, x, y, width, height });
    },
    text: vi.fn(),
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

  it('builds a compact A4 label grid', () => {
    const labels = buildA4QRLabelLayout();
    expect(labels.length).toBeGreaterThan(20);
    expect(labels[0]).toMatchObject({ x: 10, y: 10, qrSize: 30 });
  });

  it('generates one A4 PDF page filled with repeated SKU QR labels', async () => {
    const doc = fakeDoc();
    const textImageFactory = vi.fn((text) => `data:image/png;base64,text-${text}`);
    const result = await generateSKUQRCodePDF(
      { name: 'Томатная паста', barcodes: ['000042'] },
      {
        doc,
        qrFactory: vi.fn(async (code) => `data:image/png;base64,${code}`),
        textImageFactory,
      },
    );

    expect(result.code).toBe('000042');
    expect(doc.images).toHaveLength(result.labels * 2);
    expect(doc.images[1].image).toBe('data:image/png;base64,text-Томатная паста');
    expect(textImageFactory).toHaveBeenCalledWith('Томатная паста', { width: 256, height: 72 });
    expect(doc.text).not.toHaveBeenCalled();
    expect(doc.savedAs).toBe('sklad-000042.pdf');
  });

  it('rejects SKU without barcode', async () => {
    await expect(generateSKUQRCodePDF({ name: 'Без кода', barcodes: [] }, { doc: fakeDoc() }))
      .rejects.toThrow('У SKU нет штрихкода');
  });

  it('uses deterministic PDF file names', () => {
    expect(skuLabelFileName({ barcodes: ['000007'] })).toBe('sklad-000007.pdf');
  });
});
