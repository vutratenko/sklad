<script lang="ts">
  import { movements } from '$lib/project';
  import Icon from './Icon.svelte';
  import ProductArt from './ProductArt.svelte';
</script>

<section class="showcase" aria-label="Возможности Sklad в деталях">
  <div class="container">
    <article class="feature">
      <div class="feature-copy">
        <p class="eyebrow">01 / КАТАЛОГ И ОСТАТКИ</p>
        <h2>Знает, что<br />у вас есть.</h2>
        <p class="lead">
          Название, фото, категория и штрихкод — в карточке SKU. Количество и распределение по
          складам — в запасах.
        </p>
        <div class="feature-details">
          <span>Фото товаров</span><span>Поиск по штрихкоду</span><span>QR-этикетки для печати</span
          >
        </div>
      </div>
      <figure class="catalog-visual">
        <div class="catalog-top"><span>КАТАЛОГ SKU</span><Icon name="box" size={18} /></div>
        <div class="product-scene"><ProductArt large /></div>
        <div class="catalog-detail">
          <span class="category">КОНСЕРВЫ · 400 Г</span>
          <h3>Томаты в собственном соку</h3>
          <div class="detail-row"><span>Единица измерения</span><b>шт.</b></div>
          <div class="detail-row"><span>Статус</span><b>Активен</b></div>
          <div class="barcode">
            <div class="barcode-lines" aria-hidden="true"></div>
            <span>4 600000 000015</span>
          </div>
        </div>
        <figcaption>Пример карточки SKU · иллюстрация товара</figcaption>
      </figure>
    </article>
    <article class="feature reverse">
      <div class="feature-copy">
        <p class="eyebrow">02 / СКЛАДЫ И МЕСТА</p>
        <h2>И где<br />это лежит.</h2>
        <p class="lead">
          Кладовка — склад. Верхняя полка — место хранения. Добавьте кухню, гараж или другой склад и
          распределите запасы по местам.
        </p>
        <div class="feature-details">
          <span>Несколько складов</span><span>Места внутри склада</span>
        </div>
      </div>
      <figure class="topology-visual">
        <div class="warehouse-heading">
          <span class="warehouse-icon"><Icon name="box" size={29} /></span>
          <div>
            <span class="category">СКЛАД</span>
            <h3>Кладовка</h3>
          </div>
          <span class="location-count">2 места</span>
        </div>
        <div class="shelf-tree">
          <div class="shelf-node">
            <Icon name="shelf" size={20} /><span>Верхняя полка<small>Консервы</small></span>
            <div class="shelf-products"><ProductArt /><ProductArt kind="tin" /></div>
          </div>
          <div class="shelf-node">
            <Icon name="shelf" size={20} /><span>Нижняя полка<small>Бакалея</small></span>
            <div class="shelf-products"><ProductArt kind="pasta" /><ProductArt kind="grain" /></div>
          </div>
        </div>
        <div class="other-warehouse">
          <Icon name="box" size={20} /><span>Кухня</span><span>Другой склад</span>
        </div>
        <figcaption>Пример структуры: склад → место хранения</figcaption>
      </figure>
    </article>
    <article class="feature">
      <div class="feature-copy">
        <p class="eyebrow">03 / ЖУРНАЛ ДВИЖЕНИЙ</p>
        <h2>Каждое движение —<br />в истории.</h2>
        <p class="lead">
          Пополнение, расход, перенос на другую полку или корректировка после пересчёта. Остатки
          меняются, запись остаётся.
        </p>
        <div class="feature-details">
          <span>Приход и расход</span><span>Перемещение и корректировка</span>
        </div>
      </div>
      <figure class="history-visual">
        <div class="history-heading">
          <Icon name="history" size={21} />
          <h3>Движения</h3>
          <span>Пример журнала</span>
        </div>
        {#each movements as movement}<div class="history-row">
            <span class="operation">{movement.symbol}</span>
            <div>
              <strong>{movement.name}</strong>
              <p>{movement.product}</p>
              <small>{movement.detail}</small>
            </div>
            <b>{movement.quantity}</b>
          </div>{/each}
      </figure>
    </article>
  </div>
</section>

<style>
  .showcase {
    background: #fafafa;
    border-block: 1px solid #00000004;
  }
  .feature {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 100px;
    align-items: center;
    padding: 100px 0;
  }
  .feature + .feature {
    border-top: 1px solid var(--border);
  }
  .feature.reverse .feature-copy {
    order: 2;
  }
  .feature.reverse figure {
    order: 1;
  }
  .feature h2 {
    font-size: 48px;
    letter-spacing: -2.3px;
  }
  .feature .lead {
    font-size: 16px;
  }
  .feature-details {
    margin-top: 29px;
    display: flex;
    flex-wrap: wrap;
    gap: 11px 18px;
  }
  .feature-details span {
    font-size: 11px;
    color: #57575c;
    padding-bottom: 8px;
    border-bottom: 1px solid #dcdcdf;
  }
  figure {
    position: relative;
  }
  figcaption {
    font-size: 10px;
    color: var(--muted);
    text-align: center;
    margin-top: 16px;
  }
  .catalog-visual {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: 0 14px 45px #00000005;
    overflow: hidden;
  }
  .catalog-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    font-size: 9px;
    letter-spacing: 1.5px;
    color: var(--muted);
  }
  .product-scene {
    background: #f2f0eb;
    margin: 0 18px;
    border-radius: 9px;
  }
  .catalog-detail {
    padding: 26px 30px 12px;
  }
  .category {
    font-size: 9px;
    letter-spacing: 1.3px;
    color: var(--muted);
  }
  .catalog-detail h3 {
    font-size: 20px;
    letter-spacing: -0.5px;
    margin: 9px 0 22px;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    padding: 11px 0;
    font-size: 11px;
    color: var(--muted);
  }
  .detail-row b {
    color: var(--ink);
    font-weight: 450;
  }
  .barcode {
    padding-top: 25px;
    width: 140px;
    margin: auto;
    text-align: center;
  }
  .barcode-lines {
    height: 31px;
    background: repeating-linear-gradient(
      90deg,
      #333 0 1px,
      transparent 1px 3px,
      #333 3px 5px,
      transparent 5px 6px,
      #333 6px 7px,
      transparent 7px 11px,
      #333 11px 14px,
      transparent 14px 17px,
      #333 17px 18px,
      transparent 18px 20px
    );
    border-inline: 3px solid #333;
  }
  .barcode span {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 2px;
    display: block;
    margin-top: 5px;
  }
  .catalog-visual figcaption {
    background: #fafafa;
    border-top: 1px solid var(--border);
    padding: 11px;
    margin-top: 10px;
  }
  .topology-visual {
    padding: 32px;
    background: #f5f5f7;
    border-radius: 20px;
  }
  .warehouse-heading {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-bottom: 26px;
  }
  .warehouse-icon {
    width: 57px;
    height: 57px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 13px;
    display: grid;
    place-items: center;
  }
  .warehouse-heading h3 {
    font-size: 20px;
    margin: 6px 0 0;
  }
  .location-count {
    margin-left: auto;
    font-size: 10px;
    color: var(--muted);
  }
  .shelf-tree {
    margin-left: 28px;
    border-left: 1px solid #cdcdd0;
    padding: 0 0 0 25px;
  }
  .shelf-node {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    background: #fff;
    border: 1px solid var(--border);
    padding: 20px 16px;
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .shelf-node::before {
    content: '';
    position: absolute;
    width: 25px;
    height: 1px;
    background: #cdcdd0;
    left: -26px;
    top: 50%;
  }
  .shelf-node > span {
    font-size: 12px;
    white-space: nowrap;
  }
  .shelf-node small {
    display: block;
    margin-top: 6px;
    font-size: 10px;
    color: var(--muted);
  }
  .shelf-products {
    margin-left: auto;
    display: flex;
    gap: 3px;
  }
  .shelf-products :global(.product-art) {
    width: 28px;
    height: 35px;
    background: transparent;
  }
  .shelf-products :global(svg) {
    width: 28px;
    height: 33px;
  }
  .other-warehouse {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid #d9d9dc;
    border-radius: 10px;
    padding: 20px;
    margin-top: 30px;
    font-size: 13px;
  }
  .other-warehouse > span:last-child {
    margin-left: auto;
    font-size: 10px;
    color: var(--muted);
  }
  .topology-visual figcaption {
    margin-top: 24px;
  }
  .history-visual {
    padding: 27px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 18px;
    box-shadow: 0 14px 45px #00000004;
  }
  .history-heading {
    display: flex;
    gap: 9px;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-bottom: 21px;
  }
  .history-heading h3 {
    font-size: 16px;
    margin: 0;
  }
  .history-heading > span {
    margin-left: auto;
    font-size: 9px;
    color: var(--muted);
  }
  .history-row {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 23px 0;
    border-bottom: 1px solid var(--border);
  }
  .history-row:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
  .operation {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    background: #f3f3f5;
    border-radius: 50%;
    font-size: 21px;
    flex-shrink: 0;
  }
  .history-row strong {
    font-size: 12px;
    font-weight: 550;
  }
  .history-row p {
    font-size: 11px;
    margin: 5px 0 3px;
  }
  .history-row small {
    font-size: 9px;
    color: var(--muted);
  }
  .history-row b {
    font-size: 12px;
    font-weight: 550;
    white-space: nowrap;
    margin-left: auto;
    padding-top: 8px;
  }
  @media (max-width: 1100px) {
    .feature {
      gap: 50px;
    }
    .feature h2 {
      font-size: 42px;
    }
    .topology-visual {
      padding: 24px;
    }
    .shelf-node {
      padding: 20px 12px;
      gap: 8px;
    }
    .shelf-products :global(.product-art):last-child {
      display: none;
    }
  }
  @media (max-width: 760px) {
    .feature {
      grid-template-columns: 1fr;
      gap: 38px;
      padding: 70px 0;
    }
    .feature h2 {
      font-size: 38px;
      letter-spacing: -1.7px;
    }
    .feature.reverse .feature-copy,
    .feature.reverse figure {
      order: initial;
    }
    .feature .lead {
      font-size: 15px;
    }
    .feature-details {
      margin-top: 22px;
    }
    .feature figure {
      max-width: 480px;
      width: 100%;
      margin: auto;
    }
    .shelf-products :global(.product-art):last-child {
      display: grid;
    }
    .catalog-detail {
      padding: 23px 25px 12px;
    }
    .catalog-detail h3 {
      font-size: 18px;
    }
    .history-visual {
      padding: 23px 20px;
    }
    .history-row {
      gap: 10px;
    }
    .history-row small {
      font-size: 8px;
    }
    .topology-visual {
      padding: 25px 18px;
    }
    .shelf-tree {
      padding-left: 20px;
      margin-left: 19px;
    }
    .shelf-node::before {
      width: 20px;
      left: -21px;
    }
    .shelf-node > span {
      font-size: 11px;
    }
  }
</style>
