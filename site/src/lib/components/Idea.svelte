<script lang="ts">
  import Icon from './Icon.svelte';
  import ProductArt from './ProductArt.svelte';
</script>

<section class="section idea container" id="features" aria-labelledby="idea-heading">
  <div class="intro">
    <div>
      <p class="eyebrow">ПОРЯДОК БЕЗ ЛИШНЕГО</p>
      <h2 id="idea-heading">Не ERP.<br /><span>Просто ваш склад.</span></h2>
    </div>
    <p class="lead">
      Банки в кладовке. Крупы в шкафу.<br />Расходники на дальней полке.<br />Небольшая система для
      обычных вещей,<br class="desktop-break" /> которые легко потерять из виду.
    </p>
  </div>
  <div class="idea-grid">
    <article>
      <div class="mini-visual">
        <div class="mini-stock">
          <ProductArt /><span>Томаты<small>Консервы · 400 г</small></span><b>12<small>шт.</small></b
          >
        </div>
      </div>
      <span class="number">01</span>
      <h3>Что есть</h3>
      <p>Каталог и остатки.<br />Вместо списка по памяти.</p>
    </article>
    <article>
      <div class="mini-visual">
        <div class="mini-place">
          <span><Icon name="box" size={16} /> Кладовка</span><span
            ><i></i><Icon name="shelf" size={15} /> Верхняя полка</span
          >
        </div>
      </div>
      <span class="number">02</span>
      <h3>Где лежит</h3>
      <p>Склады и места хранения.<br />У каждой вещи — свой адрес.</p>
    </article>
    <article>
      <div class="mini-visual">
        <div class="mini-history">
          <span class="plus">+</span><span>Приход<small>Томаты · Верхняя полка</small></span><b
            >4 шт.</b
          >
        </div>
      </div>
      <span class="number">03</span>
      <h3>Что изменилось</h3>
      <p>Все движения в журнале.<br />От покупки до последней банки.</p>
    </article>
  </div>
</section>

<style>
  .intro {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 50px;
    margin-bottom: 48px;
  }
  .intro h2 {
    margin-bottom: 0;
  }
  .intro .lead {
    font-size: 16px;
    padding-top: 20px;
  }
  .idea-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 22px;
  }
  .idea-grid article {
    padding: 20px 24px 30px;
    background: #f5f5f7;
    border-radius: 16px;
  }
  .mini-visual {
    height: 144px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
  }
  .mini-stock,
  .mini-history {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 16px 12px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 9px;
    box-shadow: 0 8px 20px #00000004;
  }
  .mini-stock > span,
  .mini-history > span {
    font-size: 11px;
    font-weight: 550;
  }
  .mini-stock small,
  .mini-history small {
    display: block;
    font-size: 8px;
    color: var(--muted);
    margin-top: 6px;
    font-weight: 400;
  }
  .mini-stock b,
  .mini-history b {
    margin-left: auto;
    font-size: 20px;
    text-align: right;
    font-weight: 550;
  }
  .mini-stock b small {
    margin-top: 1px;
  }
  .mini-stock :global(.product-art) {
    width: 40px;
    height: 45px;
  }
  .mini-stock :global(svg) {
    width: 36px;
    height: 40px;
  }
  .mini-place {
    width: 100%;
    padding: 18px 12px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 9px;
    font-size: 11px;
  }
  .mini-place span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mini-place span + span {
    padding-top: 22px;
    padding-left: 9px;
    color: var(--muted);
  }
  .mini-place i {
    width: 15px;
    height: 20px;
    border-left: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
    transform: translateY(-10px);
  }
  .mini-history .plus {
    background: #f4f4f5;
    border-radius: 50%;
    width: 29px;
    height: 29px;
    display: grid;
    place-items: center;
    font-size: 21px;
  }
  .mini-history b {
    font-size: 13px;
  }
  .number {
    font-family: var(--mono);
    color: var(--muted);
    font-size: 10px;
  }
  h3 {
    font-size: 21px;
    letter-spacing: -0.6px;
    margin: 12px 0 9px;
  }
  article p {
    font-size: 13px;
    color: var(--muted);
    margin: 0;
    line-height: 1.7;
  }
  @media (max-width: 1000px) {
    .idea-grid {
      gap: 14px;
    }
    .idea-grid article {
      padding: 14px 17px 24px;
    }
    .mini-history {
      gap: 6px;
      padding: 14px 9px;
    }
    .mini-history small {
      font-size: 7px;
    }
  }
  @media (max-width: 760px) {
    .intro {
      display: block;
    }
    .intro .lead {
      padding-top: 7px;
      margin-top: 24px;
    }
    .idea-grid {
      grid-template-columns: 1fr;
    }
    .idea-grid article {
      padding: 22px 24px;
      display: grid;
      grid-template-columns: 1fr 1.15fr;
      column-gap: 18px;
    }
    .mini-visual {
      grid-column: 2;
      grid-row: 1/4;
      margin: 0;
      height: auto;
    }
    .number {
      align-self: end;
    }
    h3 {
      font-size: 19px;
      margin-top: 9px;
    }
    article p {
      font-size: 11px;
    }
    .mini-stock,
    .mini-place,
    .mini-history {
      padding: 12px 8px;
    }
    .mini-stock > span,
    .mini-history > span,
    .mini-place {
      font-size: 9px;
    }
    .mini-stock small,
    .mini-history small {
      font-size: 7px;
    }
    .mini-stock {
      gap: 6px;
    }
    .mini-stock :global(.product-art) {
      width: 28px;
      height: 34px;
    }
    .mini-stock b {
      font-size: 17px;
    }
    .mini-history b {
      font-size: 10px;
    }
    .mini-history .plus {
      width: 21px;
      height: 21px;
      font-size: 17px;
    }
    .mini-history small {
      max-width: 72px;
    }
    .desktop-break {
      display: none;
    }
  }
  @media (max-width: 390px) {
    .idea-grid article {
      padding: 20px 17px;
      column-gap: 10px;
    }
    .mini-stock small {
      max-width: 60px;
    }
    .mini-place {
      font-size: 8px;
    }
  }
</style>
