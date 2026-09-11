import { beforeEach, describe, expect, it, vi } from 'vitest';

const queueMovement = vi.hoisted(() => vi.fn(async () => 'op-stable-1'));

vi.mock('../../infra/sync-engine.js', () => ({
  queueMovement,
}));

describe('submitMovement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('always enqueues movement with stable operation key from queue', async () => {
    const { submitMovement } = await import('./movements.js');
    const res = await submitMovement({
      operation_type: 'transfer',
      sku_id: 'sku-1',
      quantity: 2,
      from_location_id: 'loc-a',
      to_location_id: 'loc-b',
    });

    expect(queueMovement).toHaveBeenCalledTimes(1);
    expect(queueMovement.mock.calls[0][0]).toMatchObject({
      operation_type: 'transfer',
      lines: [
        {
          sku_id: 'sku-1',
          quantity: 2,
          from_location_id: 'loc-a',
          to_location_id: 'loc-b',
        },
      ],
    });
    expect(res).toEqual({ queued: true, operation_key: 'op-stable-1', opId: 'op-stable-1' });
  });
});
