import { describe, expect, it } from 'vitest';
import { isLocalPhotoUrl, localPhotoUrl } from './photo-store.js';

describe('photo-store helpers', () => {
  it('marks local photo urls', () => {
    expect(isLocalPhotoUrl('local:sku-1')).toBe(true);
    expect(isLocalPhotoUrl('/api/v1/media/sku-1.jpg')).toBe(false);
  });

  it('builds local photo url from sku id', () => {
    expect(localPhotoUrl('sku-1')).toBe('local:sku-1');
  });
});
