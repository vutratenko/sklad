import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  queueSkuCreate: vi.fn(async () => 'op-create-1'),
  queueSkuUpdate: vi.fn(async () => 'op-update-1'),
  queuePhotoUpload: vi.fn(async () => 'op-photo-1'),
  db: {
    getCachedSKUs: vi.fn(async () => []),
    putSKU: vi.fn(async () => undefined),
  },
}));

vi.mock('../../infra/sync-engine.js', () => ({
  apiFetch: vi.fn(),
  apiUpload: vi.fn(),
  db: mocks.db,
  queueSkuCreate: mocks.queueSkuCreate,
  queueSkuUpdate: mocks.queueSkuUpdate,
  queuePhotoUpload: mocks.queuePhotoUpload,
}));

vi.mock('../photo-compress.js', () => ({
  compressPhotoForUpload: vi.fn(async (file) => file),
}));

vi.mock('../photo-store.js', () => ({
  saveLocalPhoto: vi.fn(async () => 'blob:preview'),
  localPhotoUrl: (skuId) => `local:${skuId}`,
  enrichSkuPhoto: vi.fn(async (sku) => sku),
  enrichSkusPhotos: vi.fn(async (skus) => skus),
  cacheServerPhoto: vi.fn(),
}));

describe('catalog SKU queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.db.getCachedSKUs.mockResolvedValue([]);
  });

  it('createSKU enqueues optimistic sku create', async () => {
    const { createSKU } = await import('./catalog.js');
    mocks.db.getCachedSKUs.mockImplementation(async () => {
      const id = mocks.queueSkuCreate.mock.calls[0]?.[0]?.id || 'sku-local-1';
      return [{ id, name: 'Tomato', pending: true }];
    });

    const sku = await createSKU({
      name: 'Tomato',
      category: 'консервы',
      unit: 'шт',
      description: '400g',
    });

    expect(mocks.queueSkuCreate).toHaveBeenCalledTimes(1);
    expect(mocks.queueSkuCreate.mock.calls[0][0]).toMatchObject({
      name: 'Tomato',
      category: 'консервы',
      unit: 'шт',
      description: '400g',
    });
    const createdId = mocks.queueSkuCreate.mock.calls[0][0].id;
    expect(typeof createdId).toBe('string');
    expect(sku).toMatchObject({ id: createdId, name: 'Tomato', pending: true });
  });

  it('createSKUWithPhoto stores local photo and queues upload', async () => {
    const { createSKUWithPhoto } = await import('./catalog.js');
    const { saveLocalPhoto } = await import('../photo-store.js');

    const file = new File(['x'], 'jam.jpg', { type: 'image/jpeg' });
    mocks.db.getCachedSKUs.mockImplementation(async () => {
      const createdId = mocks.queueSkuCreate.mock.calls[0]?.[0]?.id || 'sku-local-2';
      return [{ id: createdId, name: 'Jam', pending: true, photo_pending: true }];
    });

    const sku = await createSKUWithPhoto({ name: 'Jam' }, file);
    const createdId = mocks.queueSkuCreate.mock.calls[0][0].id;

    expect(mocks.queueSkuCreate).toHaveBeenCalledTimes(1);
    expect(saveLocalPhoto).toHaveBeenCalledTimes(1);
    expect(mocks.queuePhotoUpload).toHaveBeenCalledWith(createdId);
    expect(mocks.db.putSKU).toHaveBeenCalledWith(expect.objectContaining({
      id: createdId,
      photo_url: `local:${createdId}`,
      photo_pending: true,
    }));
    expect(sku).toMatchObject({ id: createdId, name: 'Jam' });
  });

  it('updateSKU enqueues sku update', async () => {
    const { updateSKU } = await import('./catalog.js');
    mocks.db.getCachedSKUs.mockResolvedValueOnce([
      { id: 'sku-1', name: 'New', category: 'консервы' },
    ]);

    await updateSKU('sku-1', { name: 'New', category: 'консервы' });

    expect(mocks.queueSkuUpdate).toHaveBeenCalledWith('sku-1', { name: 'New', category: 'консервы' });
  });
});
