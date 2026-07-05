# Документация Sklad WMS

| Раздел | Описание |
|--------|----------|
| [architecture/overview.md](architecture/overview.md) | Модульный монолит, offline-first, sync |
| [adr/README.md](adr/README.md) | ADR-001…009 (архитектурные решения) |
| [api/README.md](api/README.md) | REST API v1 — полный список endpoints |
| [api/openapi.yaml](api/openapi.yaml) | OpenAPI: sync + общие схемы ошибок |
| [../infra/helm/sklad/README.md](../infra/helm/sklad/README.md) | Helm chart: установка из GHCR, values, migrate hook |

## Итерации MVP (завершены)

1. Каркас, health, миграции, PWA shell
2. Auth OIDC + dev bypass
3. Топология (склады / места)
4. SKU CRUD, штрихкоды, фото
5. Остатки и движения
6. Поиск, фильтры, offline scan
7. Sync push/pull, conflicts, optimistic UI
8. Тесты, CI, документация
