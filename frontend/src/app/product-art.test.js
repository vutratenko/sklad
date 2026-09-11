import { describe, expect, it } from 'vitest';
import { categoryToArtKind, renderProductArt, renderSkuVisual } from './product-art.js';

describe('product-art', () => {
  it('maps categories to art kinds', () => {
    expect(categoryToArtKind('консервы')).toBe('tomato');
    expect(categoryToArtKind('бакалея')).toBe('grain');
    expect(categoryToArtKind('крупы')).toBe('pasta');
    expect(categoryToArtKind('')).toBe('tin');
  });

  it('renders svg markup', () => {
    expect(renderProductArt('tomato')).toContain('<svg');
    expect(renderProductArt('tomato')).toContain('product-art');
  });

  it('prefers photo over art fallback', () => {
    const html = renderSkuVisual({ photoSrc: '/photo.jpg', category: 'консервы' });
    expect(html).toContain('<img');
    expect(html).not.toContain('product-art');
  });

  it('uses art when photo is missing and category is known', () => {
    const html = renderSkuVisual({ category: 'консервы' });
    expect(html).toContain('product-art');
  });
});
