import { apiFetch, apiUpload, db } from '../../infra/sync-engine.js';
import { compressPhotoForUpload } from '../photo-compress.js';

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
  const prepared = await compressPhotoForUpload(file);
  const form = new FormData();
  form.append('photo', prepared, prepared.name);
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
      sku,
      stocks,
      source: 'cache',
    };
  }

  if (navigator.onLine) {
    try {
      const sku = await apiFetch(`/skus/${id}`);
      await db.putSKU(sku);
      const stocksResp = await apiFetch(`/stocks?sku_id=${encodeURIComponent(id)}`);
      const stocks = stocksResp.items || [];
      if (stocks.length) await db.cacheStocks(stocks);
      return {
        barcode: (sku.barcodes || [])[0] || id,
        sku,
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
