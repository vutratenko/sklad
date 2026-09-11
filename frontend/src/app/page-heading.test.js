import { describe, expect, it } from 'vitest';
import { renderPageHeading } from './page-heading.js';

describe('page-heading', () => {
  it('renders eyebrow and title', () => {
    const html = renderPageHeading({ eyebrow: 'КАТАЛОГ', title: 'Товары и этикетки.' });
    expect(html).toContain('page-heading-eyebrow');
    expect(html).toContain('КАТАЛОГ');
    expect(html).toContain('page-heading-title');
    expect(html).toContain('Товары и этикетки.');
  });
});
