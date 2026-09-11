<script lang="ts">
  import { products, movements } from '$lib/project';
  import Icon from './Icon.svelte';
  import ProductArt from './ProductArt.svelte';
  let active = $state('Запасы');
  let query = $state('');
  let shelf = $state('Все места');
  const tabs = ['Запасы', 'SKU', 'Склады', 'Движения'];
  const filtered = $derived(
    products.filter(
      (product) =>
        `${product.name} ${product.category} ${product.barcode}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()) &&
        (shelf === 'Все места' || product.location === shelf)
    )
  );
</script>

<figure class="product-window" aria-label="Интерактивная схема интерфейса Sklad">
  <div class="window-bar">
    <span class="window-brand"><Icon name="box" size={20} /> Sklad</span><span
      class="window-address"><Icon name="server" size={12} /> Ваш сервер</span
    ><span class="online"><span></span> online <span class="sync">· sync: 0</span></span>
  </div>
  <div class="window-tabs" role="group" aria-label="Разделы демонстрации">
    {#each tabs as tab}<button
        class:active={active === tab}
        aria-pressed={active === tab}
        onclick={() => {
          active = tab;
          query = '';
          shelf = 'Все места';
        }}>{tab}</button
      >{/each}
    <span class="demo-badge">ДЕМО</span>
  </div>
  <div class="window-content">
    <div class="view-heading">
      <div>
        <p class="small-label">МОЙ ДОМАШНИЙ СКЛАД</p>
        <p class="view-title">
          {active === 'Запасы'
            ? 'Всё под рукой.'
            : active === 'SKU'
              ? 'Каталог товаров.'
              : active === 'Склады'
                ? 'У каждого — своё место.'
                : 'История в деталях.'}
        </p>
      </div>
      <span class="view-icon"
        ><Icon name={active === 'Движения' ? 'history' : 'box'} size={24} /></span
      >
    </div>
    {#if active === 'Запасы' || active === 'SKU'}
      <div class="filters">
        <label class="search"
          ><Icon name="search" size={16} /><input
            type="search"
            aria-label="Поиск по демонстрационному каталогу"
            placeholder="Найти в запасах"
            bind:value={query}
          /></label
        ><label class="location-filter"
          ><Icon name="shelf" size={16} /><select
            aria-label="Место хранения в демонстрации"
            bind:value={shelf}
            ><option>Все места</option><option>Верхняя полка</option><option>Нижняя полка</option
            ></select
          ></label
        >
      </div>
      <div class="table-heading" aria-hidden="true">
        <span>ТОВАР</span><span>{active === 'SKU' ? 'ШТРИХКОД' : 'МЕСТО ХРАНЕНИЯ'}</span><span
          >ОСТАТОК</span
        >
      </div>
      <div class="product-list" aria-live="polite">
        {#each filtered as product}
          <div class="product-row">
            <div class="product-name">
              <ProductArt kind={product.kind} />
              <div>
                <strong>{product.name}</strong><small
                  >{product.category} <span>· {product.description}</span></small
                >
              </div>
            </div>
            <div class="product-location">
              {#if active === 'SKU'}<span class="code">{product.barcode}</span>{:else}Кладовка<small
                  >{product.location}</small
                >{/if}
            </div>
            <div class="quantity">{product.quantity}<span>{product.unit}</span></div>
          </div>
        {:else}<p class="empty">
            Ничего не найдено. Попробуйте «томаты» или другое место хранения.
          </p>{/each}
      </div>
    {:else if active === 'Склады'}
      <div class="warehouse-demo">
        {#each ['Кладовка', 'Кухня'] as warehouse}<div class="warehouse">
            <Icon name="shelf" size={28} /><strong>{warehouse}</strong><span>Склад</span>
            <div>{warehouse === 'Кладовка' ? 'Верхняя полка' : 'Шкаф у окна'}</div>
            <div>{warehouse === 'Кладовка' ? 'Нижняя полка' : 'Нижний ящик'}</div>
          </div>{/each}
      </div>
    {:else}
      <div class="movement-list">
        {#each movements as movement}<div class="movement-row">
            <span class="movement-symbol">{movement.symbol}</span>
            <div>
              <strong>{movement.name}</strong><small>{movement.product} · {movement.detail}</small>
            </div>
            <span class="movement-quantity">{movement.quantity}</span>
          </div>{/each}
      </div>
    {/if}
    <div class="window-footer">
      <span><Icon name="database" size={13} /> Данные на устройстве</span><span>IndexedDB</span>
    </div>
  </div>
  <figcaption>
    Интерактивная схема по экранам Sklad. Пример запасов и иллюстрации товаров.
  </figcaption>
</figure>

<style>
  .product-window {
    max-width: 980px;
    margin: 0 auto;
    position: relative;
    border: 1px solid #00000012;
    border-radius: 18px;
    background: white;
    box-shadow:
      0 4px 8px #00000002,
      0 24px 70px -24px #00000025;
    text-align: left;
  }
  .window-bar {
    height: 54px;
    border-bottom: 1px solid var(--border);
    padding: 0 26px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #fafafa;
    border-radius: 18px 18px 0 0;
    font-size: 11px;
    color: var(--muted);
  }
  .window-brand {
    display: flex;
    align-items: center;
    gap: 7px;
    font-weight: 700;
    font-size: 16px;
    color: var(--ink);
  }
  .window-address,
  .online {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .online > span:first-child {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #728377;
  }
  .sync {
    color: var(--muted);
  }
  .window-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 12px 25px;
    border-bottom: 1px solid var(--border);
  }
  .window-tabs button {
    background: transparent;
    border: 0;
    padding: 9px 14px;
    font-size: 12px;
    border-radius: 6px;
    color: var(--muted);
  }
  .window-tabs button:hover {
    background: #f5f5f7;
  }
  .window-tabs button.active {
    background: #eeeef0;
    color: var(--ink);
    font-weight: 600;
  }
  .demo-badge {
    margin-left: auto;
    font-size: 9px;
    letter-spacing: 1.6px;
    color: var(--muted);
    border: 1px solid var(--border);
    padding: 4px 6px;
    border-radius: 4px;
  }
  .window-content {
    padding: 26px 32px 0;
    min-height: 471px;
  }
  .view-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 22px;
  }
  .small-label {
    font-size: 9px;
    letter-spacing: 1.7px;
    margin: 0 0 7px;
    color: var(--muted);
  }
  .view-title {
    font-size: 25px;
    letter-spacing: -0.9px;
    margin: 0;
    font-weight: 650;
  }
  .view-icon {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 12px;
    color: #858587;
  }
  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 9px;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 0 11px;
    color: var(--muted);
    flex: 1;
    min-width: 0;
  }
  .search input {
    border: 0;
    background: transparent;
    min-width: 0;
    width: 100%;
    height: 36px;
    font-size: 12px;
    color: var(--ink);
    outline-offset: 3px;
  }
  .search input::placeholder {
    color: var(--muted);
  }
  .location-filter {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--border);
    border-radius: 7px;
    padding: 0 8px;
    color: #666;
  }
  .location-filter select {
    border: 0;
    background: transparent;
    color: var(--ink);
    font-size: 11px;
    max-width: 160px;
    padding: 8px 0;
  }
  .table-heading,
  .product-row {
    display: grid;
    grid-template-columns: minmax(0, 1.8fr) minmax(0, 1fr) 80px;
    gap: 16px;
    align-items: center;
  }
  .table-heading {
    font-size: 9px;
    letter-spacing: 1px;
    color: var(--muted);
    padding: 0 0 10px;
    border-bottom: 1px solid var(--border);
  }
  .table-heading span:last-child {
    text-align: right;
  }
  .product-row {
    padding: 11px 0;
    border-bottom: 1px solid var(--border);
  }
  .product-name {
    display: flex;
    gap: 13px;
    align-items: center;
    min-width: 0;
  }
  .product-name strong {
    font-size: 13px;
    font-weight: 550;
    display: block;
  }
  .product-name small,
  .product-location small {
    display: block;
    color: var(--muted);
    font-size: 10px;
    margin-top: 5px;
  }
  .product-location {
    font-size: 11px;
  }
  .code {
    font-family: var(--mono);
    font-size: 10px;
  }
  .quantity {
    text-align: right;
    font-weight: 600;
    font-size: 19px;
  }
  .quantity span {
    font-weight: 400;
    font-size: 10px;
    color: var(--muted);
    margin-left: 6px;
  }
  .window-footer {
    display: flex;
    justify-content: space-between;
    font-size: 10px;
    color: var(--muted);
    padding: 15px 0;
  }
  .window-footer > span:first-child {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  figcaption {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    text-align: center;
    margin-top: 20px;
    font-size: 11px;
    color: var(--muted);
    line-height: 1.5;
  }
  .empty {
    min-height: 262px;
    display: grid;
    place-items: center;
    color: var(--muted);
    font-size: 14px;
    text-align: center;
  }
  .warehouse-demo {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    min-height: 316px;
  }
  .warehouse {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    align-self: start;
  }
  .warehouse strong {
    display: block;
    margin: 15px 0 5px;
  }
  .warehouse > span {
    font-size: 11px;
    color: var(--muted);
  }
  .warehouse > div {
    border-left: 1px solid #ddd;
    padding: 16px 0 0 16px;
    margin-left: 12px;
    font-size: 12px;
  }
  .movement-list {
    min-height: 316px;
  }
  .movement-row {
    display: flex;
    gap: 16px;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding: 19px 0;
  }
  .movement-symbol {
    display: grid;
    place-items: center;
    width: 35px;
    height: 35px;
    background: #f5f5f7;
    border-radius: 50%;
    font-size: 20px;
    flex-shrink: 0;
  }
  .movement-row strong {
    font-size: 12px;
  }
  .movement-row small {
    display: block;
    font-size: 10px;
    color: var(--muted);
    margin-top: 4px;
  }
  .movement-quantity {
    margin-left: auto;
    white-space: nowrap;
    font-size: 13px;
  }
  @media (max-width: 600px) {
    .product-window {
      border-radius: 14px;
    }
    .window-bar {
      padding: 0 16px;
      height: 48px;
      border-radius: 14px 14px 0 0;
    }
    .window-address,
    .sync {
      display: none;
    }
    .window-tabs {
      padding: 9px 10px;
      gap: 1px;
    }
    .window-tabs button {
      padding: 11px 10px;
      font-size: 11px;
    }
    .demo-badge {
      font-size: 8px;
      padding: 3px 4px;
      letter-spacing: 1px;
    }
    .window-content {
      padding: 22px 16px 0;
      min-height: 452px;
    }
    .view-heading {
      margin-bottom: 18px;
    }
    .view-title {
      font-size: 23px;
    }
    .view-icon {
      display: none;
    }
    .filters {
      gap: 7px;
      flex-direction: column;
      margin-bottom: 16px;
    }
    .search input {
      height: 36px;
      font-size: 12px;
    }
    .location-filter {
      align-self: flex-start;
      border: 0;
      padding: 0;
    }
    .location-filter select {
      padding: 5px 0;
    }
    .table-heading,
    .product-row {
      grid-template-columns: minmax(0, 1fr) 54px;
      gap: 9px;
    }
    .table-heading > span:nth-child(2),
    .product-location {
      display: none;
    }
    .product-name {
      gap: 9px;
    }
    .product-name strong {
      font-size: 11px;
    }
    .product-name small {
      font-size: 9px;
    }
    .product-name small span {
      display: none;
    }
    .product-name :global(.product-art) {
      width: 40px;
      height: 45px;
      border-radius: 7px;
    }
    .product-name :global(svg) {
      width: 36px;
      height: 41px;
    }
    .product-row {
      padding: 11px 0;
    }
    .quantity {
      font-size: 17px;
    }
    .quantity span {
      font-size: 9px;
      margin-left: 3px;
    }
    .window-footer {
      font-size: 9px;
    }
    .window-footer > span:last-child {
      display: none;
    }
    figcaption {
      font-size: 10px;
      padding: 0 8px;
    }
    .warehouse-demo {
      gap: 10px;
      min-height: 322px;
    }
    .warehouse {
      padding: 16px 10px;
    }
    .warehouse strong {
      font-size: 14px;
    }
    .warehouse > div {
      font-size: 10px;
      padding-left: 10px;
    }
    .movement-list {
      min-height: 322px;
    }
    .movement-row {
      gap: 10px;
    }
    .movement-row small {
      max-width: 160px;
      line-height: 1.5;
    }
    .movement-quantity {
      font-size: 11px;
    }
  }
</style>
