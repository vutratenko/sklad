import * as db from '../infra/indexeddb.js';

export const LOCAL_PHOTO_PREFIX = 'local:';

const objectUrlCache = new Map();

export function isLocalPhotoUrl(url) {
  return typeof url === 'string' && url.startsWith(LOCAL_PHOTO_PREFIX);
}

export function localPhotoUrl(skuId) {
  return `${LOCAL_PHOTO_PREFIX}${skuId}`;
}

function revokeObjectUrl(skuId) {
  const existing = objectUrlCache.get(skuId);
  if (existing) {
    URL.revokeObjectURL(existing);
    objectUrlCache.delete(skuId);
  }
}

function rememberObjectUrl(skuId, blob) {
  revokeObjectUrl(skuId);
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(skuId, url);
  return url;
}

export async function saveLocalPhoto(skuId, file, options = {}) {
  const blob = file instanceof Blob ? file : new Blob([file], { type: options.mimeType || 'image/jpeg' });
  await db.putLocalPhoto({
    skuId,
    blob,
    mimeType: blob.type || options.mimeType || 'image/jpeg',
    filename: options.filename || file.name || `${skuId}.jpg`,
    pendingUpload: options.pendingUpload !== false,
    sourceUrl: options.sourceUrl || null,
    updatedAt: new Date().toISOString(),
  });
  return rememberObjectUrl(skuId, blob);
}

export async function getLocalPhotoRecord(skuId) {
  return db.getLocalPhoto(skuId);
}

export async function hasPendingPhotoUpload(skuId) {
  const record = await getLocalPhotoRecord(skuId);
  return !!record?.pendingUpload;
}

export async function getSkuPhotoSrc(sku) {
  if (!sku?.id) return '';

  const local = await getLocalPhotoRecord(sku.id);
  if (local?.blob) {
    return rememberObjectUrl(sku.id, local.blob);
  }

  if (sku.photo_url && !isLocalPhotoUrl(sku.photo_url)) {
    return sku.photo_url;
  }

  return '';
}

export async function enrichSkuPhoto(sku) {
  if (!sku) return sku;
  const photo_src = await getSkuPhotoSrc(sku);
  return { ...sku, photo_src };
}

export async function enrichSkusPhotos(skus) {
  return Promise.all((skus || []).map((sku) => enrichSkuPhoto(sku)));
}

export async function markLocalPhotoSynced(skuId) {
  const record = await getLocalPhotoRecord(skuId);
  if (!record) return;
  await db.putLocalPhoto({ ...record, pendingUpload: false });
}

export async function removeLocalPhoto(skuId) {
  revokeObjectUrl(skuId);
  await db.removeLocalPhoto(skuId);
}

export async function cacheServerPhoto(skuId, photoUrl) {
  if (!photoUrl || isLocalPhotoUrl(photoUrl)) return;
  const existing = await getLocalPhotoRecord(skuId);
  if (existing?.pendingUpload) return;
  if (existing?.sourceUrl === photoUrl) return;

  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return;
    const blob = await res.blob();
    await saveLocalPhoto(skuId, blob, {
      pendingUpload: false,
      sourceUrl: photoUrl,
      filename: photoUrl.split('/').pop() || `${skuId}.jpg`,
      mimeType: blob.type || 'image/jpeg',
    });
  } catch {
    // offline or fetch failed — keep previous cache if any
  }
}

export async function prefetchSkuPhotos(skus) {
  await Promise.all(
    (skus || [])
      .filter((sku) => sku?.photo_url && !isLocalPhotoUrl(sku.photo_url))
      .map((sku) => cacheServerPhoto(sku.id, sku.photo_url)),
  );
}
