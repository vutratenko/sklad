import { apiFetch, apiUpload, db } from '../../infra/sync-engine.js';

export async function loadSKUs(q = '', activeOnly = false) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (activeOnly) params.set('active_only', 'true');
  const query = params.toString() ? `?${params}` : '';
  if (navigator.onLine) {
    try {
      const resp = await apiFetch(`/skus${query}`);
      await db.cacheSKUs(resp.items || []);
    } catch {
      // use cache
    }
  }
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
  return filtered;
}

export async function createSKU(data) {
  const sku = await apiFetch('/skus', { method: 'POST', body: JSON.stringify(data) });
  await db.putSKU(sku);
  return sku;
}

export async function updateSKU(id, data) {
  const sku = await apiFetch(`/skus/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  await db.putSKU(sku);
  return sku;
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
  return sku;
}

export async function removeBarcode(skuId, barcode) {
  const sku = await apiFetch(`/skus/${skuId}/barcodes/${encodeURIComponent(barcode)}`, {
    method: 'DELETE',
  });
  await db.putSKU(sku);
  return sku;
}

export async function uploadPhoto(skuId, file) {
  const form = new FormData();
  form.append('photo', file);
  const sku = await apiUpload(`/skus/${skuId}/photo`, form);
  await db.putSKU(sku);
  return sku;
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
    return { barcode: code, sku, stocks, source: 'cache' };
  }

  if (navigator.onLine) {
    try {
      const resp = await apiFetch(`/barcodes/${encodeURIComponent(code)}`);
      if (resp.sku) await db.putSKU(resp.sku);
      if (resp.stocks?.length) await db.cacheStocks(resp.stocks);
      return { ...resp, source: 'server' };
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
