<script lang="ts">
  import { repository, helm, installation } from '$lib/project';
  import Icon from './Icon.svelte';
</script>

<section class="section architecture container" aria-labelledby="architecture-heading">
  <div class="architecture-copy">
    <p class="eyebrow">ДЛЯ ТЕХ, КОМУ ИНТЕРЕСНО ВНУТРИ</p>
    <h2 id="architecture-heading">Простой внутри.</h2>
    <p class="lead">
      Один Go-сервис, PostgreSQL и PWA.<br />Модульный монолит с REST API.<br />Архитектурные
      решения — в репозитории.
    </p>
    <a class="text-link" href={`${repository}/blob/main/docs/architecture/overview.md`}
      >Посмотреть архитектуру <Icon name="arrow" size={16} /></a
    >
  </div>
  <div
    class="architecture-diagram"
    aria-label="PWA на JavaScript и Vite соединяется с Go REST API, API работает с PostgreSQL"
  >
    <div class="arch-node">
      <Icon name="browser" size={23} />
      <div><strong>PWA frontend</strong><span>JavaScript · Vite</span></div>
      <small>IndexedDB<br />Service Worker</small>
    </div>
    <div class="arch-connector" aria-hidden="true">↓ <span>HTTPS / REST</span></div>
    <div class="arch-node">
      <Icon name="server" size={23} />
      <div><strong>Go API</strong><span>Модульный монолит</span></div>
      <small>Nextcloud OIDC<br />Media storage</small>
    </div>
    <div class="arch-connector" aria-hidden="true">↓ <span>SQL / транзакции</span></div>
    <div class="arch-node">
      <Icon name="database" size={23} />
      <div><strong>PostgreSQL</strong><span>Остатки и журнал движений</span></div>
    </div>
  </div>
</section>

<section class="deployment container" aria-labelledby="deployment-heading">
  <div class="deployment-heading">
    <h2 id="deployment-heading">Запускайте как удобно.</h2>
    <p>От локальной разработки до своего кластера.</p>
  </div>
  <div class="deployment-grid">
    <a href={`${repository}#локальная-разработка-без-docker`}
      ><span class="deploy-number">01 / LOCAL</span>
      <h3>На компьютере</h3>
      <p>Go + Vite и PostgreSQL.<br />Для разработки без Docker.</p>
      <span class="deploy-bottom"><code>go run ./cmd/api</code><Icon name="arrow" size={18} /></span
      ></a
    ><a href={installation}
      ><span class="deploy-number">02 / DOCKER</span>
      <h3>Одной командой</h3>
      <p>API, PWA и база данных.<br />Всё в Docker Compose.</p>
      <span class="deploy-bottom"><code>make up</code><Icon name="arrow" size={18} /></span></a
    ><a href={helm}
      ><span class="deploy-number">03 / KUBERNETES</span>
      <h3>В вашем кластере</h3>
      <p>Helm chart и образы в GHCR.<br />Манифесты для Argo CD.</p>
      <span class="deploy-bottom"><code>Helm / GHCR</code><Icon name="arrow" size={18} /></span></a
    >
  </div>
</section>

<style>
  .architecture {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 100px;
    align-items: center;
  }
  .architecture h2 {
    font-size: 48px;
  }
  .architecture .lead {
    font-size: 15px;
  }
  .architecture .text-link {
    margin-top: 25px;
  }
  .architecture-diagram {
    padding: 7px 0;
  }
  .arch-node {
    display: flex;
    align-items: center;
    gap: 17px;
    background: #fafafa;
    border: 1px solid var(--border);
    border-radius: 11px;
    padding: 23px;
  }
  .arch-node strong {
    display: block;
    font-size: 15px;
    font-weight: 550;
  }
  .arch-node span {
    display: block;
    font-size: 10px;
    color: var(--muted);
    margin-top: 6px;
  }
  .arch-node small {
    margin-left: auto;
    font-size: 9px;
    color: var(--muted);
    line-height: 1.8;
  }
  .arch-connector {
    height: 42px;
    display: flex;
    gap: 15px;
    align-items: center;
    padding-left: 34px;
    color: #a0a0a5;
    font-size: 23px;
  }
  .arch-connector span {
    font-family: var(--mono);
    font-size: 8px;
    letter-spacing: 0.5px;
    color: var(--muted);
  }
  .deployment {
    padding-bottom: 110px;
  }
  .deployment-heading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 20px;
  }
  .deployment-heading h2 {
    font-size: 30px;
    letter-spacing: -1px;
  }
  .deployment-heading p {
    font-size: 12px;
    color: var(--muted);
    margin: 0;
  }
  .deployment-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    margin-top: 17px;
  }
  .deployment-grid > a {
    display: block;
    border-top: 1px solid #d8d8dc;
    padding: 26px 0 0;
  }
  .deployment-grid > a:hover .deploy-bottom {
    color: var(--blue);
  }
  .deployment-grid > a:hover .deploy-bottom :global(svg) {
    transform: translateX(4px);
  }
  .deploy-number {
    font-size: 9px;
    letter-spacing: 1.3px;
    color: var(--muted);
  }
  .deployment-grid h3 {
    font-size: 20px;
    letter-spacing: -0.6px;
    margin: 19px 0 12px;
  }
  .deployment-grid p {
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    margin: 0;
  }
  .deploy-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 29px;
    padding-right: 20px;
  }
  .deploy-bottom code {
    font-family: var(--mono);
    font-size: 11px;
  }
  .deploy-bottom :global(svg) {
    transition: transform 0.2s;
  }
  @media (max-width: 1000px) {
    .architecture {
      gap: 50px;
    }
    .architecture h2 {
      font-size: 40px;
    }
    .arch-node {
      padding: 18px 16px;
      gap: 11px;
    }
    .arch-node strong {
      font-size: 13px;
    }
    .arch-node small {
      font-size: 8px;
    }
    .deployment-heading {
      display: block;
    }
    .deployment-heading p {
      margin-bottom: 25px;
    }
    .deployment-grid {
      gap: 18px;
    }
    .deployment-grid h3 {
      font-size: 18px;
    }
  }
  @media (max-width: 760px) {
    .architecture {
      grid-template-columns: 1fr;
      gap: 38px;
    }
    .architecture h2 {
      font-size: 38px;
    }
    .arch-node {
      padding: 22px 18px;
    }
    .arch-node strong {
      font-size: 14px;
    }
    .deployment {
      padding-bottom: 72px;
    }
    .deployment-heading h2 {
      font-size: 29px;
      letter-spacing: -1.2px;
    }
    .deployment-grid {
      grid-template-columns: 1fr;
      gap: 28px;
    }
    .deployment-grid > a {
      padding-top: 23px;
    }
    .deployment-grid h3 {
      font-size: 21px;
      margin: 13px 0 9px;
    }
    .deployment-grid p {
      font-size: 13px;
    }
    .deploy-bottom {
      margin-top: 21px;
    }
  }
</style>
