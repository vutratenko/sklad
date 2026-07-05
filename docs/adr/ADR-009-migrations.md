# ADR-009: Миграции PostgreSQL и версия IndexedDB

## Status

Accepted

## Context

Изменения схемы БД и клиентского хранилища неизбежны. Нужна предсказуемая политика без ручных правок.

## Decision

- PostgreSQL: forward-only SQL в `backend/migrations/`, нумерация `NNN_description.sql`.
- Применение: отдельная команда `make migrate` (`cmd/migrate`).
- API при старте также применяет миграции (dev convenience).
- IndexedDB: версия схемы в store `sync_meta` (`schema_version`).
- Sync payload содержит `schema_version` (см. ADR-008).

## Consequences

**Плюсы:** контролируемые релизы, совместимость клиентов.

**Минусы:** поддержка совместимости 1–2 версий протокола.

## Rejected Alternatives

- Ручные ad-hoc SQL правки
- Breaking releases без миграционной стратегии
