<script lang="ts">
  import { repository } from '$lib/project';
  import Icon from './Icon.svelte';
  import ProductMockup from './ProductMockup.svelte';
</script>

<section class="hero" aria-labelledby="hero-heading">
  <div class="hero-copy container">
    <p class="eyebrow"><span class="eyebrow-dot"></span> МАЛЕНЬКАЯ СИСТЕМА. ДОМАШНИЙ ПОРЯДОК.</p>
    <h1 id="hero-heading">Всё на своих<br /><span>местах.</span></h1>
    <p class="hero-description">
      Помнит, что у вас есть. И где это лежит.{' '}<br />Домашние запасы под контролем — на вашем
      сервере.
    </p>
    <div class="hero-actions">
      <a class="button primary" href={repository}
        >Открыть на GitHub <Icon name="arrow" size={17} /></a
      ><a class="text-link" href="#self-hosted">Как запустить <span aria-hidden="true">↗</span></a>
    </div>
    <p class="hero-meta">Open Source <span>·</span> Offline-first <span>·</span> Self-hosted</p>
  </div>
  <div class="product-stage container"><ProductMockup /></div>
  <div class="hero-bottom container">
    <span>ДЛЯ ТОГО, ЧТО УЖЕ ЕСТЬ ДОМА</span>
    <p>Кладовка <span>／</span> Кухня <span>／</span> Продукты <span>／</span> Расходники</p>
  </div>
</section>

<style>
  .hero {
    background: linear-gradient(#fff 35%, #f5f5f7 78%);
    padding-top: 76px;
    overflow: clip;
  }
  .hero-copy {
    text-align: center;
  }
  .hero .eyebrow {
    font-size: 10px;
    letter-spacing: 1.8px;
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
  }
  .eyebrow-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #727a72;
  }
  h1 {
    font-size: clamp(58px, 6.3vw, 84px);
    line-height: 1.02;
    letter-spacing: -5px;
    font-weight: 740;
    margin: 27px 0 23px;
  }
  h1 span {
    color: #858589;
  }
  .hero-description {
    font-size: 17px;
    line-height: 1.65;
    color: var(--muted);
    margin: 0;
  }
  .hero-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 28px;
    margin-top: 29px;
  }
  .hero-meta {
    font-size: 10px;
    color: var(--muted);
    margin: 25px 0 0;
    letter-spacing: 0.3px;
  }
  .hero-meta span {
    padding: 0 8px;
    color: #97979b;
  }
  .product-stage {
    margin-top: 58px;
    padding-bottom: 65px;
  }
  .hero-bottom {
    padding-top: 36px;
    padding-bottom: 44px;
    text-align: center;
  }
  .hero-bottom > span {
    font-size: 9px;
    letter-spacing: 1.8px;
    color: var(--muted);
  }
  .hero-bottom p {
    font-size: 14px;
    color: #636367;
    margin: 17px 0 0;
  }
  .hero-bottom p span {
    color: #c0c0c3;
    margin: 0 20px;
  }
  @media (min-width: 1440px) {
    .hero {
      padding-top: 92px;
    }
    .product-stage {
      margin-top: 64px;
    }
  }
  @media (max-width: 600px) {
    .hero {
      padding-top: 53px;
    }
    .hero .eyebrow {
      font-size: 8px;
      letter-spacing: 1.2px;
    }
    h1 {
      font-size: 58px;
      letter-spacing: -3.6px;
      margin: 24px 0 21px;
    }
    .hero-description {
      font-size: 14px;
      line-height: 1.7;
      max-width: 320px;
      margin: auto;
    }
    .hero-description br {
      display: none;
    }
    .hero-actions {
      gap: 19px;
      margin-top: 25px;
    }
    .hero-actions .primary {
      font-size: 12px;
      padding: 13px 15px;
    }
    .hero-actions .text-link {
      font-size: 12px;
    }
    .hero-meta {
      font-size: 9px;
      margin-top: 22px;
    }
    .product-stage {
      margin-top: 40px;
      padding-bottom: 66px;
    }
    .hero-bottom {
      padding-top: 22px;
      padding-bottom: 32px;
    }
    .hero-bottom p {
      font-size: 11px;
    }
    .hero-bottom p span {
      margin: 0 5px;
    }
    .hero-bottom > span {
      font-size: 8px;
    }
  }
</style>
