import { db, queueMovement } from '../../infra/sync-engine.js';

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

  const opId = await queueMovement({
    operation_type: data.operation_type,
    reason_code: data.reason_code || '',
    lines: [line],
  });
  return { queued: true, operation_key: opId, opId };
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
