# ADR-008: Версионирование REST и формат ошибок

## Status

Accepted

## Context

Offline-очередь чувствительна к стабильности API и предсказуемости ошибок при retry.

## Decision

- Базовый путь: `/api/v1/...`.
- Единый формат ошибок:

```json
{
  "error_code": "INSUFFICIENT_STOCK",
  "message": "Not enough stock at location",
  "details": {},
  "request_id": "uuid",
  "timestamp": "2026-07-05T12:00:00Z"
}
```

- В рамках v1: только additive-изменения (новые optional поля, новые endpoints).
- Breaking changes → `/api/v2`.
- Обязательный заголовок `X-Request-ID` (генерируется клиентом или сервером).
- Sync payload содержит `schema_version` для совместимости клиентов.

## Consequences

**Плюсы:** предсказуемая интеграция PWA, упрощённый дебаг.

**Минусы:** жёсткая контрактная дисциплина.

## Rejected Alternatives

- Breaking changes без версии
- Разношёрстные форматы ошибок по endpoint
