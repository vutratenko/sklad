import { describe, expect, it } from 'vitest';
import { parseQrScanValue } from './views/scan.js';

describe('parseQrScanValue', () => {
  it('returns plain uuid as-is', () => {
    const id = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';
    expect(parseQrScanValue(id)).toBe(id);
  });

  it('extracts sku id from url path', () => {
    expect(parseQrScanValue('https://sklad.sion2k.ru/skus/a1b2c3d4-e5f6-4789-a012-3456789abcde'))
      .toBe('a1b2c3d4-e5f6-4789-a012-3456789abcde');
  });

  it('extracts sku id from url query', () => {
    expect(parseQrScanValue('https://example.com/scan?sku_id=a1b2c3d4-e5f6-4789-a012-3456789abcde'))
      .toBe('a1b2c3d4-e5f6-4789-a012-3456789abcde');
  });

  it('extracts id from json payload', () => {
    expect(parseQrScanValue('{"sku_id":"a1b2c3d4-e5f6-4789-a012-3456789abcde"}'))
      .toBe('a1b2c3d4-e5f6-4789-a012-3456789abcde');
  });

  it('returns barcode text unchanged', () => {
    expect(parseQrScanValue('4601234567890')).toBe('4601234567890');
  });
});
