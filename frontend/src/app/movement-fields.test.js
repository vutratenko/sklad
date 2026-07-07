import { describe, expect, it } from 'vitest';
import { movementFieldVisibility } from './movement-fields.js';

describe('movementFieldVisibility', () => {
  it('shows expense reason only for issue', () => {
    expect(movementFieldVisibility('issue').reason).toBe(true);
    expect(movementFieldVisibility('receipt').reason).toBe(false);
    expect(movementFieldVisibility('transfer').reason).toBe(false);
    expect(movementFieldVisibility('adjustment').reason).toBe(false);
  });

  it('shows from only for issue, transfer and adjustment', () => {
    expect(movementFieldVisibility('receipt').from).toBe(false);
    expect(movementFieldVisibility('issue').from).toBe(true);
    expect(movementFieldVisibility('transfer').from).toBe(true);
    expect(movementFieldVisibility('adjustment', 'increase').from).toBe(true);
    expect(movementFieldVisibility('adjustment', 'decrease').from).toBe(true);
  });

  it('shows adjustment direction only for adjustment', () => {
    expect(movementFieldVisibility('adjustment').adjustment).toBe(true);
    expect(movementFieldVisibility('issue').adjustment).toBe(false);
  });
});
