# REST API v1

Базовый путь: `/api/v1`

## Формат ошибок

```json
{
  "error_code": "INSUFFICIENT_STOCK",
  "message": "human readable",
  "details": {},
  "request_id": "uuid",
  "timestamp": "RFC3339"
}
```

## Endpoints

### Auth
| Method | Path | Описание |
|--------|------|----------|
| GET | `/auth/me` | Текущий пользователь |
| GET | `/auth/oidc/config` | OIDC/dev bypass конфигурация (public) |

### Topology
| Method | Path | Описание |
|--------|------|----------|
| GET | `/warehouses` | Список складов (`?active_only=true`) |
| POST | `/warehouses` | Создать склад |
| GET | `/warehouses/{id}` | Карточка склада |
| PATCH | `/warehouses/{id}` | Обновить склад |
| DELETE | `/warehouses/{id}` | Soft-delete склада |
| GET | `/warehouses/{id}/locations` | Места склада |
| POST | `/warehouses/{id}/locations` | Создать место |
| GET | `/locations/{id}` | Карточка места |
| PATCH | `/locations/{id}` | Обновить место |
| DELETE | `/locations/{id}` | Soft-delete места |

### SKU
| Method | Path | Описание |
|--------|------|----------|
| GET | `/skus` | Список SKU (`?q=`, `?active_only=true`) |
| POST | `/skus` | Создать SKU |
| GET | `/skus/{id}` | Карточка SKU |
| PATCH | `/skus/{id}` | Обновить SKU |
| DELETE | `/skus/{id}` | Soft-delete SKU |
| POST | `/skus/{id}/barcodes` | Добавить штрихкод (`{"barcode":"..."}`) |
| DELETE | `/skus/{id}/barcodes/{barcode}` | Удалить штрихкод |
| POST | `/skus/{id}/photo` | Загрузить фото (multipart, поле `photo`, jpeg/png/webp, до 5MB) |
| GET | `/media/{filename}` | Публичная раздача фото SKU |
| GET | `/barcodes/{barcode}` | Поиск по штрихкоду (ответ: `{ barcode, sku, stocks }`) |

Клиент (ADR-003): offline lookup по `skus.barcodes[]` + `stocks` в IndexedDB; online — refresh кэша из API.

### Inventory
| Method | Path | Описание |
|--------|------|----------|
| GET | `/stocks` | Текущие остатки (`?q=`, `?sku_id=`, `?warehouse_id=`, `?location_id=`) |
| POST | `/movements` | Провести движение (receipt/issue/transfer/adjustment) |
| GET | `/movements` | История движений (`?sku_id=`, `?operation_type=`, `?limit=`) |

**POST /movements** body:
```json
{
  "operation_type": "receipt",
  "reason_code": "used",
  "device_id": "uuid",
  "operation_key": "uuid",
  "lines": [{
    "sku_id": "uuid",
    "quantity": 5,
    "from_location_id": null,
    "to_location_id": "uuid"
  }]
}
```

### Lots
| Method | Path | Описание |
|--------|------|----------|
| GET | `/lots` | Список партий |
| POST | `/lots` | Создать партию |

### Sync
| Method | Path | Описание |
|--------|------|----------|
| POST | `/sync/push` | Batch offline-операций (movement/create) |
| GET | `/sync/pull` | Изменения по курсору (`cursor`, `limit`, `has_more`) |

**Push result statuses:** `applied`, `duplicate_replayed`, `rejected` (с `error_code`: `INSUFFICIENT_STOCK`, `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`).

**Клиент (ADR-003/005):** offline-очередь в IndexedDB; optimistic update остатков; при `rejected` — pull серверного состояния, статус `conflict`, ручной retry/discard.

## Коды ошибок

| Code | HTTP | Описание |
|------|------|----------|
| INSUFFICIENT_STOCK | 409 | Недостаток остатка |
| IDEMPOTENCY_KEY_PAYLOAD_MISMATCH | 409 | Тот же key, другой payload |
| DUPLICATE_BARCODE | 409 | Barcode занят |
| VALIDATION_ERROR | 422 | Невалидные данные |

См. OpenAPI: [openapi.yaml](openapi.yaml)
