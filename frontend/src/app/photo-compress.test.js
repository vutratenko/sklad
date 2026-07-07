import { describe, expect, it } from 'vitest';
import { scaleDimensions } from './photo-compress.js';

describe('scaleDimensions', () => {
  it('keeps small images unchanged', () => {
    expect(scaleDimensions(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });

  it('scales down the longest edge', () => {
    expect(scaleDimensions(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('handles portrait photos', () => {
    expect(scaleDimensions(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });
});
