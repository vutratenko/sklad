import { describe, expect, it } from 'vitest';
import { scaleDimensions } from './photo-compress.js';

describe('scaleDimensions', () => {
  it('keeps small images unchanged', () => {
    expect(scaleDimensions(640, 480, 720)).toEqual({ width: 640, height: 480 });
  });

  it('scales down the longest edge to 720p', () => {
    expect(scaleDimensions(4000, 3000, 720)).toEqual({ width: 720, height: 540 });
  });

  it('handles portrait photos', () => {
    expect(scaleDimensions(3000, 4000, 720)).toEqual({ width: 540, height: 720 });
  });
});
