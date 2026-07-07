<p align="center">
  <img src="docs/sklad-logo.png" alt="Sklad" width="420" />
</p>

Self-hosted система складского учёта для домашних запасов (консервы, кладовка, кухня).

## Возможности

- Каталог SKU с фото, штрихкодами и печатью QR-этикеток
- Топология: склады и места хранения
- Остатки и журнал движений (приход / расход / перемещение / корректировка)
- Offline-first PWA с IndexedDB, очередью синхронизации и кэшем фото
- Сканирование QR/штрихкодов с камеры
- Nextcloud OIDC (prod) или dev bypass (локально)

## Быстрый старт

```bash
# 1. Поднять PostgreSQL + API + frontend
make up

# 2. Проверить health
make health

# 3. Frontend
open http://localhost:3000

# 4. Тесты (unit + integration требует DATABASE_URL)
make test-all
```

Integration tests локально:

```bash
export DATABASE_URL=postgres://sklad:sklad@localhost:5432/sklad?sslmode=disable
make test-integration
```

## Локальная разработка без Docker

```bash
export DATABASE_URL=postgres://sklad:sklad@localhost:5432/sklad?sslmode=disable
export AUTH_DEV_BYPASS=true
export APP_ENV=development
export MEDIA_DIR=./data/media

make migrate
cd backend && go run ./cmd/api

# В другом терминале
cd frontend && npm run dev
```

OIDC (без dev bypass):

```bash
export AUTH_DEV_BYPASS=false
export APP_ENV=staging
export OIDC_ISSUER=https://nextcloud.example.com
export OIDC_CLIENT_ID=sklad
export OIDC_REDIRECT_URI=http://localhost:3000/oauth/callback
export SESSION_SECRET=replace-with-random-32-byte-secret
```

## Структура

```
backend/     Go модульный монолит
frontend/    PWA (Vite + IndexedDB + Service Worker)
infra/       Docker, Helm, K8s, ArgoCD
docs/        Архитектура, ADR, API
```

## Deploy (Kubernetes / Helm)

Образы и Helm chart публикуются в GHCR при git tag `v*` (например `v0.1.34`).

```bash
# 1. Создать Secret с credentials (PostgreSQL + OIDC)
kubectl create namespace sklad
kubectl create secret generic sklad-api-secrets \
  --namespace sklad \
  --from-literal=DATABASE_URL='postgres://user:pass@postgres:5432/sklad?sslmode=disable' \
  --from-literal=OIDC_ISSUER='https://nextcloud.example.com' \
  --from-literal=OIDC_CLIENT_ID='sklad' \
  --from-literal=OIDC_CLIENT_SECRET='...' \
  --from-literal=SESSION_SECRET='replace-with-random-32-byte-secret'

# 2. Установить chart из GHCR
helm install sklad oci://ghcr.io/vutratenko/charts/sklad --version 0.1.34 \
  --namespace sklad \
  --set api.existingSecret=sklad-api-secrets
```

Подробнее: [infra/helm/sklad/README.md](infra/helm/sklad/README.md)

### Первый релиз (maintainer)

1. GitHub → Settings → Actions → **Workflow permissions: Read and write**
2. Создать tag: `git tag v0.1.34 && git push origin v0.1.34`
3. Проверить packages: https://github.com/vutratenko/sklad/pkgs

CI на PR/main: `.github/workflows/ci.yml` (build, tests, docker build без push).  
Release на tag: `.github/workflows/release.yml` → GHCR images + Helm OCI chart.

## Документация

- [Обзор документации](docs/README.md)
- [Архитектура](docs/architecture/overview.md)
- [ADR](docs/adr/README.md)
- [REST API](docs/api/README.md)
- [OpenAPI (sync + схемы ошибок)](docs/api/openapi.yaml)

## Make targets

| Target | Описание |
|--------|----------|
| `make up` / `down` | Docker Compose stack |
| `make test-all` | unit + integration + frontend tests |
| `make test-unit` | Go unit tests (`-short`) |
| `make test-integration` | Go integration tests (нужен PostgreSQL) |
| `make test-frontend` | Vitest |
| `make build` | api + migrate binaries |
| `make migrate` | применить SQL миграции |
| `make frontend-build` | production PWA build |
