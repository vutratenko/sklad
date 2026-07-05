# ADR-007: Nextcloud OIDC + dev bypass guardrails

## Status

Accepted

## Context

Production требует единый вход через Nextcloud OIDC. Локальная разработка должна быть быстрой без настройки IdP.

## Decision

- **Production/stage:** JWT validation через Nextcloud OIDC (issuer, audience, JWKS).
- **Development:** dev bypass включается только при `APP_ENV=development` **и** `AUTH_DEV_BYPASS=true`.
- В production конфигурации dev bypass **невозможен** (fail-closed при старте, если оба флага активны в prod).
- Middleware проверяет токен на каждом защищённом endpoint.

## Consequences

**Плюсы:** единый вход + быстрый локальный цикл.

**Минусы:** риск утечки bypass при плохой конфиг-дисциплине (смягчается fail-closed guard).

## Rejected Alternatives

- Самописная auth-система
- Постоянный bypass во всех окружениях
