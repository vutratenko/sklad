<script lang="ts">
  import { repository, docs } from '$lib/project';
  import Icon from './Icon.svelte';
</script>

<section class="open-source section" aria-labelledby="open-source-heading">
  <div class="container">
    <span class="open-mark"><Icon name="box" size={35} /></span>
    <p class="eyebrow">НЕБОЛЬШОЙ ПРОЕКТ. ВСЁ НА ВИДУ.</p>
    <h2 id="open-source-heading">Open source.<br /><span>Без скрытой магии.</span></h2>
    <p>
      Код, архитектура и инфраструктура — на GitHub.<br />Изучайте, запускайте, предлагайте
      улучшения.
    </p>
    <div class="cta-actions">
      <a class="button primary" href={repository}
        ><Icon name="github" size={18} /> Открыть на GitHub <span aria-hidden="true">↗</span></a
      ><a class="text-link" href={docs}>Документация <Icon name="arrow" size={16} /></a>
    </div>
  </div>
</section>

<style>
  .open-source {
    background: #f5f5f7;
    text-align: center;
  }
  .open-mark {
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border: 1px solid #d9d9de;
    background: #fff;
    border-radius: 19px;
    margin: 0 auto 33px;
    box-shadow: 0 4px 12px #00000003;
  }
  .open-source .eyebrow {
    font-size: 9px;
  }
  .open-source h2 {
    font-size: 60px;
    letter-spacing: -2.8px;
    line-height: 1.1;
  }
  .open-source p:not(.eyebrow) {
    font-size: 15px;
    color: var(--muted);
    line-height: 1.8;
  }
  .cta-actions .text-link {
    color: #0068d1;
  }
  .cta-actions {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 30px;
    margin-top: 30px;
  }
  @media (max-width: 600px) {
    .open-source h2 {
      font-size: 39px;
      letter-spacing: -1.7px;
    }
    .open-source p:not(.eyebrow) {
      font-size: 12px;
    }
    .open-source .eyebrow {
      font-size: 8px;
      letter-spacing: 1.3px;
    }
    .open-mark {
      width: 62px;
      height: 62px;
      border-radius: 16px;
      margin-bottom: 28px;
    }
    .cta-actions {
      flex-direction: column;
      gap: 23px;
    }
  }
</style>
