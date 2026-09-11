import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../index.html'),
  'utf8',
);

describe('viewport', () => {
  it('blocks pinch zoom in index.html', () => {
    expect(indexHtml).toContain('user-scalable=no');
    expect(indexHtml).toContain('maximum-scale=1');
    expect(indexHtml).toContain('minimum-scale=1');
  });
});
