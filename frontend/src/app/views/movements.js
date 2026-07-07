import { apiFetch, db, getDeviceId, queueMovement } from '../../infra/sync-engine.js';

export async function loadMovements(filters = {}) {
  let items = await db.getCachedMovements();
  if (filters.sku_id) {
    items = items.filter((m) => m.sku_id === filters.sku_id);
  }
  if (filters.operation_type) {
    items = items.filter((m) => m.operation_type === filters.operation_type);
  }
  return items;
}

export async function submitMovement(data) {
  const line = {
    sku_id: data.sku_id,
    quantity: data.quantity,
    from_location_id: data.from_location_id || null,
    to_location_id: data.to_location_id || null,
  };
  const operationKey = crypto.randomUUID();

  if (navigator.onLine) {
    const payload = {
      operation_type: data.operation_type,
      reason_code: data.reason_code || '',
      device_id: getDeviceId(),
      operation_key: operationKey,
      lines: [line],
    };
    const res = await apiFetch('/movements', { method: 'POST', body: JSON.stringify(payload) });
    try {
      const stocks = await apiFetch('/stocks');
      await db.cacheStocks(stocks.items || []);
      const movements = await apiFetch('/movements');
      await db.cacheMovements(movements.items || []);
    } catch {
      // ignore refresh errors
    }
    return res;
  }

  await queueMovement({
    operation_type: data.operation_type,
    reason_code: data.reason_code || '',
    lines: [line],
  });
  return { queued: true, operation_key: operationKey };
}

export const OPERATION_TYPES = [
  { value: 'receipt', label: 'Приход' },
  { value: 'issue', label: 'Расход' },
  { value: 'transfer', label: 'Перемещение' },
  { value: 'adjustment', label: 'Корректировка' },
];

export const ISSUE_REASONS = [
  { value: 'used', label: 'Использовано' },
  { value: 'spoiled', label: 'Испортилось' },
  { value: 'gifted', label: 'Подарено' },
  { value: 'lost', label: 'Потеряно' },
  { value: 'other', label: 'Другое' },
];
