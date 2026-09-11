# Sklad — промо-сайт

Самостоятельный русскоязычный лендинг на Svelte 5, SvelteKit, TypeScript и
обычном CSS. `adapter-static` предварительно рендерит весь контент и SEO
в HTML. Production-сервер, внешние шрифты, UI-библиотеки, аналитика и
сторонние запросы для работы страницы не нужны.

## Разработка

Node.js 22.12+:

```bash
cd site
npm ci
npm run dev
```

Откройте <http://localhost:5173/sklad/>. Base path включён и в development,
чтобы ошибки путей обнаруживались до публикации.

```bash
npm run format   # Prettier, включая Svelte и CSS
npm run lint     # форматирование, TypeScript, Svelte, a11y diagnostics
npm run build    # полностью статический build/
npm run preview  # http://localhost:4173/sklad/
```

## Структура

```text
site/
  src/
    app.css                 Общие токены, типографика, адаптивность, focus
    lib/
      project.ts            Ссылки upstream и явно демонстрационные данные
      components/           Header, Hero, ProductMockup, Idea, FeatureShowcase,
                            ScannerDemo, OfflineDiagram, TerminalDemo,
                            Architecture, OpenSourceCTA, Footer, SVG-компоненты
    routes/
      +page.svelte          Композиция страницы и SEO
      +layout.server.ts    URL сайта и год на этапе сборки
      robots.txt/+server.ts Статически сгенерированный robots.txt
      sitemap.xml/+server.ts Статически сгенерированный sitemap.xml
  static/                   Favicon, исходник OG в SVG и OG-превью PNG
  tests/site.spec.ts        Браузерные сценарии и axe
  site.config.js            Единая настройка URL и base path
  svelte.config.js          adapter-static, strict prerender
  playwright.config.ts     Проверки production-сборки
```

## Достоверность контента

Перед реализацией изучены README, docs/architecture, ADR-001…009,
frontend/src, Docker Compose и Helm chart. Основные источники:

- [Навигация настоящего PWA](../frontend/index.html): Запасы, SKU, Склады, Движения.
- [Каталог и карточка SKU](../frontend/src/app/sku-page.js): категория, фото,
  единица измерения, штрихкоды и печать QR.
- [Места хранения](../frontend/src/app/views/topology.js): склад → место.
  Произвольная многоуровневая иерархия не заявлена.
- [Сканер](../frontend/src/app/views/scan.js) и
  [поиск в локальном каталоге](../frontend/src/app/views/catalog.js).
- [Offline-first](../docs/adr/ADR-003-offline-first-client.md) и
  [обработка конфликтов](../docs/adr/ADR-005-conflict-resolution.md).
- [Фактическая архитектура](../docs/architecture/overview.md): PWA на
  JavaScript + Vite, Go, PostgreSQL. SvelteKit используется только для лендинга.
- [Локальный стек](../infra/docker/docker-compose.yml) и
  [Helm deployment](../infra/helm/sklad/README.md).

В исходном репозитории нет скриншотов экранов. Визуалы — адаптированные
HTML/CSS-схемы реальных функций в светлом оформлении, с собственными SVG
иллюстрациями товаров. Это не скриншоты: настоящее PWA использует тёмную тему.
Все количества, товары и операции явно обозначены как демонстрационные.
Камера, API и IndexedDB на лендинге не вызываются; интерактивные примеры
живут только в памяти страницы. Offline-блок описывает возможности PWA,
сам лендинг не регистрирует Service Worker.

Файл LICENSE в изученном репозитории отсутствует. Поэтому обозначение MIT
или другой конкретной лицензии не добавлено.

## Проверки

```bash
npm run build
npx playwright install chromium
npm test
```

Можно использовать установленный Microsoft Edge:

```bash
PLAYWRIGHT_CHANNEL=msedge npm test
```

Проверки охватывают ширины 1440, 1280, 1024, 768, 390 и 375 px, переполнение,
WCAG A/AA через axe, ошибки браузера, поиск и фильтр каталога, разделы демо,
сканер, offline-очередь, меню и Escape, clipboard и его отказ,
prefers-reduced-motion, статический контент без JS, canonical, OG и sitemap.
Скриншоты сохраняются в игнорируемый `test-results/`; trace сохраняется при
ошибке. Автоматическая проверка доступности дополняет ручной просмотр.

В `package.json` зафиксирован override `cookie` до исправленной ветки 0.7:
транзитивная зависимость SvelteKit 0.6 отмечалась GHSA-pxg6-pf52-xh8x.
У лендинга нет cookie-функций или серверного runtime.

## GitHub Pages

Workflow: [../.github/workflows/pages.yml](../.github/workflows/pages.yml).
Нужно один раз выбрать **Settings → Pages → Source → GitHub Actions**.
Изменения сайта в `main` запускают `npm ci`, lint, static build и браузерные
тесты. `upload-pages-artifact` загружает только `site/build`, а
`deploy-pages` публикует его в environment `github-pages`.
На pull request выполняются только проверки.

Конфигурация соответствует [документации adapter-static](https://svelte.dev/docs/kit/adapter-static)
и [официальному workflow GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

По умолчанию локальная сборка использует <https://vutratenko.github.io/sklad/>.
В Actions `GITHUB_REPOSITORY` задаёт владельца и имя: в `opsmon/sklad`
будет <https://opsmon.github.io/sklad/>. Ссылки на код продукта при этом
ведут на upstream `vutratenko/sklad`.

Для проверки форка локально:

```bash
GITHUB_REPOSITORY=opsmon/sklad npm run build
GITHUB_REPOSITORY=opsmon/sklad npm test
```

Для другого адреса:

```bash
SITE_URL=https://inventory.example.com/ npm run build
SITE_URL=https://inventory.example.com/ npm run preview
```

В Actions аналогичный URL задаётся через repository variable `SITE_URL`.
Для пользовательского домена настройте также **Pages → Custom domain** и DNS.
Конфигурация получает base path из URL; один и тот же адрес используется
для ассетов, canonical, OpenGraph и sitemap. Переменные передаются одинаково
при build, preview и test. Статические endpoints генерируются при сборке.

`robots.txt` публикуется под base path проекта. На общем `github.io`-домене
корневой robots.txt контролируется сайтом владельца, а не project Pages.
Sitemap проекта доступен напрямую по `/sklad/sitemap.xml`.

OG-превью: `static/og.svg` — редактируемый исходник, `static/og.png` —
готовая картинка 1200 × 630 для социальных сетей. После изменения SVG
обновите PNG, например браузерным рендером исходника:

```bash
npx playwright screenshot --viewport-size=1200,630 http://localhost:5173/sklad/og.svg static/og.png
```
