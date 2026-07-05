# AGENTS — Sklad WMS

## Сборка и тесты

```bash
make test-all          # unit + integration + frontend (рекомендуется перед PR)
make test-unit         # backend unit (-short)
make test-integration  # requires DATABASE_URL + PostgreSQL
make up                # docker compose (local stack)
make frontend-build
```

Integration tests используют `internal/testutil` для миграций (`MIGRATIONS_DIR` optional).

## Миграции

```bash
make migrate   # cmd/migrate, таблица schema_migrations
```

SQL в `backend/migrations/NNN_*.sql`, forward-only (ADR-009). IndexedDB `schema_version` — во frontend.

## Auth

- Dev bypass: `APP_ENV=development` + `AUTH_DEV_BYPASS=true` (ADR-007)
- Production: Nextcloud OIDC JWT validation via JWKS
- Public: `GET /api/v1/auth/oidc/config`, health endpoints

## Health

- `GET /health` — liveness (без auth)
- `GET /api/v1/health` — readiness с ping PostgreSQL

## Frontend

- PWA: `frontend/` (Vite + vite-plugin-pwa)
- IndexedDB: `frontend/src/infra/indexeddb.js`
- Sync: `frontend/src/infra/sync-engine.js`, `sync-utils.js`
- Offline barcode lookup: `catalog.lookupBarcode()` (ADR-003)

## ADR

Must-read before architectural changes: `docs/adr/ADR-001` through `ADR-009`.
