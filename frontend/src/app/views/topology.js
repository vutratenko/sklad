import { apiFetch, db } from '../../infra/sync-engine.js';

export async function loadWarehouses(activeOnly = false) {
  const items = await db.getCachedWarehouses();
  return activeOnly ? items.filter((w) => w.is_active !== false) : items;
}

export async function createWarehouse(data) {
  const ws = await apiFetch('/warehouses', { method: 'POST', body: JSON.stringify(data) });
  await db.putWarehouse(ws);
  return ws;
}

export async function updateWarehouse(id, data) {
  const ws = await apiFetch(`/warehouses/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  await db.putWarehouse(ws);
  return ws;
}

export async function deleteWarehouse(id) {
  await apiFetch(`/warehouses/${id}`, { method: 'DELETE' });
  await db.removeWarehouse(id);
}

export async function loadLocations(warehouseId, activeOnly = false) {
  const items = await db.getCachedLocations(warehouseId);
  return activeOnly ? items.filter((l) => l.is_active !== false) : items;
}

export async function createLocation(warehouseId, data) {
  const loc = await apiFetch(`/warehouses/${warehouseId}/locations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  await db.putLocation(loc);
  return loc;
}

export async function updateLocation(id, data) {
  const loc = await apiFetch(`/locations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  await db.putLocation(loc);
  return loc;
}

export async function deleteLocation(id) {
  await apiFetch(`/locations/${id}`, { method: 'DELETE' });
  await db.removeLocation(id);
}
