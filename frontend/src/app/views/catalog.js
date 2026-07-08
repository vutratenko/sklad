import { apiFetch, apiUpload, db, queuePhotoUpload } from '../../infra/sync-engine.js';
import { compressPhotoForUpload } from '../photo-compress.js';
import {
  cacheServerPhoto,
  enrichSkuPhoto,
  enrichSkusPhotos,
  localPhotoUrl,
  saveLocalPhoto,
} from '../photo-store.js';

function isNetworkError(err) {
  if (!err) return false;
  if (err instanceof TypeError || err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  return /network|fetch|failed to fetch/i.test(String(err.message || ''));
}

function backendOnline() {
  if (typeof globalThis.__skladBackendOnline === 'boolean') {
    return globalThis.__skladBackendOnline;
  }
  return !!navigator.onLine;
}

export async function loadSKUs(q = '', activeOnly = false) {
  const items = await db.getCachedSKUs();
  let filtered = activeOnly ? items.filter((s) => s.is_active !== false) : items;
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        (s.name || '').toLowerCase().includes(needle) ||
        (s.category || '').toLowerCase().includes(needle) ||
        (s.barcodes || []).some((b) => b.includes(needle))
    );
  }
  return enrichSkusPhotos(filtered);
}

export async function createSKU(data) {
  const sku = await apiFetch('/skus', { method: 'POST', body: JSON.stringify(data) });
  await db.putSKU(sku);
  return enrichSkuPhoto(sku);
}

export async function updateSKU(id, data) {
  const sku = await apiFetch(`/skus/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  await db.putSKU(sku);
  return enrichSkuPhoto(sku);
}

export async function deleteSKU(id) {
  await apiFetch(`/skus/${id}`, { method: 'DELETE' });
  await db.removeSKU(id);
}

export async function addBarcode(skuId, barcode) {
  const sku = await apiFetch(`/skus/${skuId}/barcodes`, {
    method: 'POST',
    body: JSON.stringify({ barcode }),
  });
  await db.putSKU(sku);
  return enrichSkuPhoto(sku);
}

export async function removeBarcode(skuId, barcode) {
  const sku = await apiFetch(`/skus/${skuId}/barcodes/${encodeURIComponent(barcode)}`, {
    method: 'DELETE',
  });
  await db.putSKU(sku);
  return enrichSkuPhoto(sku);
}

async function uploadPhotoOnline(skuId, file) {
  const form = new FormData();
  form.append('photo', file, file.name);
  const sku = await apiUpload(`/skus/${skuId}/photo`, form);
  await cacheServerPhoto(skuId, sku.photo_url);
  await db.putSKU(sku);
  return enrichSkuPhoto(sku);
}

async function queuePhotoOffline(skuId, file) {
  await saveLocalPhoto(skuId, file, {
    pendingUpload: true,
    filename: file.name,
    mimeType: file.type,
  });
  await queuePhotoUpload(skuId);

  const items = await db.getCachedSKUs();
  const existing = items.find((item) => item.id === skuId) || { id: skuId, name: 'SKU' };
  const updated = {
    ...existing,
    photo_url: localPhotoUrl(skuId),
    photo_pending: true,
  };
  await db.putSKU(updated);
  return enrichSkuPhoto(updated);
}

export async function uploadPhoto(skuId, file) {
  const prepared = await compressPhotoForUpload(file);

  if (navigator.onLine) {
    try {
      return await uploadPhotoOnline(skuId, prepared);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  return queuePhotoOffline(skuId, prepared);
}

export async function lookupBarcode(barcode) {
  const code = String(barcode || '').trim();
  if (!code) {
    throw new Error('Укажите штрихкод');
  }

  async function lookupLocal() {
    const sku = await db.findSKUByBarcode(code);
    if (!sku) return null;
    const stocks = await db.getStocksBySKUID(sku.id);
    return { barcode: code, sku: await enrichSkuPhoto(sku), stocks, source: 'cache' };
  }

  if (backendOnline()) {
    try {
      const resp = await apiFetch(`/barcodes/${encodeURIComponent(code)}`, { timeoutMs: 2000 });
      if (resp.sku) await db.putSKU(resp.sku);
      if (resp.stocks?.length) await db.cacheStocks(resp.stocks);
      if (resp.sku?.photo_url) await cacheServerPhoto(resp.sku.id, resp.sku.photo_url);
      return {
        ...resp,
        sku: resp.sku ? await enrichSkuPhoto(resp.sku) : resp.sku,
        source: 'server',
      };
    } catch (err) {
      const local = await lookupLocal();
      if (local) return local;
      throw err;
    }
  }

  const local = await lookupLocal();
  if (!local) {
    throw new Error('Штрихкод не найден в локальном кэше');
  }
  return local;
}

export async function lookupSKU(skuId) {
  const id = String(skuId || '').trim();
  if (!id) {
    throw new Error('Укажите ID SKU');
  }

  async function lookupLocal() {
    const items = await db.getCachedSKUs();
    const sku = items.find((item) => item.id === id);
    if (!sku) return null;
    const stocks = await db.getStocksBySKUID(sku.id);
    return {
      barcode: (sku.barcodes || [])[0] || id,
      sku: await enrichSkuPhoto(sku),
      stocks,
      source: 'cache',
    };
  }

  if (navigator.onLine) {
    try {
      const sku = await apiFetch(`/skus/${id}`, { timeoutMs: 2000 });
      await db.putSKU(sku);
      if (sku.photo_url) await cacheServerPhoto(sku.id, sku.photo_url);
      const stocksResp = await apiFetch(`/stocks?sku_id=${encodeURIComponent(id)}`, { timeoutMs: 2000 });
      const stocks = stocksResp.items || [];
      if (stocks.length) await db.cacheStocks(stocks);
      return {
        barcode: (sku.barcodes || [])[0] || id,
        sku: await enrichSkuPhoto(sku),
        stocks,
        source: 'server',
      };
    } catch (err) {
      const local = await lookupLocal();
      if (local) return local;
      throw err;
    }
  }

  const local = await lookupLocal();
  if (!local) {
    throw new Error('SKU не найден в локальном кэше');
  }
  return local;
}

export async function lookupScanCode(code) {
  const trimmed = String(code || '').trim();
  if (!trimmed) {
    throw new Error('Укажите код');
  }

  try {
    return await lookupBarcode(trimmed);
  } catch (barcodeErr) {
    try {
      return await lookupSKU(trimmed);
    } catch {
      throw barcodeErr;
    }
  }
}
