<script lang="ts">
  import Icon from './Icon.svelte';
  let offline = $state(false);
  let queued = $state(0);
  let synced = $state(0);
  let quantity = $state(12);
  function toggleNetwork() {
    offline = !offline;
    if (!offline) {
      synced += queued;
      queued = 0;
    }
  }
  function consume() {
    if (quantity > 0) {
      quantity -= 1;
      if (offline) queued += 1;
      else synced += 1;
    }
  }
</script>

<section class="offline-section section" aria-labelledby="offline-heading">
  <div class="container">
    <div class="offline-intro">
      <div>
        <p class="eyebrow">СЕТЬ ПРОПАЛА. ПОРЯДОК ОСТАЛСЯ.</p>
        <h2 id="offline-heading">Работает даже<br /><span>без сети.</span></h2>
      </div>
      <div>
        <p class="lead">
          Загруженные запасы доступны в PWA. Движения сохраняются на устройстве и уходят на сервер,
          когда соединение возвращается.
        </p>
        <p class="offline-detail">
          IndexedDB хранит данные, Service Worker — оболочку приложения. Фотографии кэшируются
          отдельно. Если операции конфликтуют, Sklad показывает ошибку синхронизации.
        </p>
      </div>
    </div>
    <div class="offline-demo">
      <div class="demo-top">
        <span>ПОПРОБУЙТЕ НА ПРИМЕРЕ</span><button
          role="switch"
          aria-checked={offline}
          aria-label="Режим без сети в демонстрации"
          class="network-switch"
          onclick={toggleNetwork}
          ><Icon name={offline ? 'offline' : 'wifi'} size={15} /><span
            >{offline ? 'Без сети' : 'Сеть есть'}</span
          ><span class="switch-track" class:on={offline}><i></i></span></button
        >
      </div>
      <ol class="flow" aria-label="Путь операции от браузера к серверу">
        <li>
          <span class="flow-icon"><Icon name="browser" size={25} /></span><strong>Браузер</strong
          ><small>PWA</small>
        </li>
        <li>
          <span class="flow-icon"><Icon name="database" size={25} /></span><strong>IndexedDB</strong
          ><small>Локальные данные</small>
        </li>
        <li class:waiting={queued > 0}>
          <span class="flow-icon"
            ><Icon name="history" size={25} />{#if queued > 0}<b>{queued}</b>{/if}</span
          ><strong>Очередь</strong><small>Sync Queue</small>
        </li>
        <li class:disconnected={offline}>
          <span class="flow-icon"><Icon name="server" size={25} /></span><strong>Sklad API</strong
          ><small>{offline ? 'Ждёт соединения' : 'На вашем сервере'}</small>
        </li>
      </ol>
      <div class="demo-operation">
        <div>
          <span class="demo-tomato">Томаты</span><strong>{quantity} <small>шт.</small></strong>
        </div>
        <button onclick={consume} disabled={quantity === 0}
          >Списать 1 шт. <span aria-hidden="true">−</span></button
        >
      </div>
      <p class="sync-status" aria-live="polite">
        <Icon name={queued > 0 ? 'history' : 'check'} size={14} />{queued > 0
          ? `Сохранено на устройстве. В очереди: ${queued}. Верните сеть, чтобы отправить.`
          : synced > 0
            ? `Все изменения отправлены на сервер. Операций: ${synced}.`
            : offline
              ? 'Сеть отключена. Попробуйте списать товар.'
              : 'Отключите сеть переключателем и попробуйте списать товар.'}
      </p>
    </div>
    <p class="note demo-note">
      Схема работы синхронизации. Данные примера сбрасываются при обновлении страницы.
    </p>
  </div>
</section>

<style>
  .offline-section {
    background: #f5f5f7;
  }
  .offline-intro {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 100px;
    align-items: center;
    margin-bottom: 50px;
  }
  .offline-intro h2 {
    margin: 0;
  }
  .offline-intro .lead {
    font-size: 16px;
  }
  .offline-detail {
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    margin: 18px 0 0;
    max-width: 455px;
  }
  .offline-demo {
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 19px;
    padding: 25px 36px 21px;
  }
  .demo-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .demo-top > span {
    font-size: 9px;
    letter-spacing: 1.5px;
    color: var(--muted);
  }
  .network-switch {
    display: flex;
    gap: 8px;
    align-items: center;
    border: 0;
    background: transparent;
    padding: 7px 0;
    font-size: 11px;
    min-height: 40px;
  }
  .switch-track {
    height: 19px;
    width: 32px;
    padding: 3px;
    background: #d3d3d6;
    border-radius: 20px;
    display: flex;
    align-items: center;
    margin-left: 5px;
  }
  .switch-track i {
    height: 13px;
    width: 13px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px #0002;
    transition: transform 0.2s;
  }
  .switch-track.on {
    background: #55555b;
  }
  .switch-track.on i {
    transform: translateX(13px);
  }
  .flow {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    list-style: none;
    margin: 38px 0 43px;
    padding: 0;
    gap: 30px;
  }
  .flow li {
    position: relative;
    text-align: center;
  }
  .flow li + li::before {
    content: '→';
    position: absolute;
    left: -29px;
    top: 26px;
    color: #b0b0b4;
    font-size: 21px;
  }
  .flow-icon {
    display: grid;
    place-items: center;
    width: 70px;
    height: 70px;
    border: 1px solid #dddddf;
    border-radius: 16px;
    margin: 0 auto 17px;
    position: relative;
    background: #fafafa;
  }
  .flow-icon b {
    position: absolute;
    top: -7px;
    right: -7px;
    background: #57575c;
    border: 3px solid white;
    border-radius: 50%;
    width: 25px;
    height: 25px;
    font-size: 10px;
    display: grid;
    place-items: center;
    color: #fff;
  }
  .flow strong {
    display: block;
    font-size: 14px;
    font-weight: 550;
  }
  .flow small {
    display: block;
    font-size: 10px;
    color: var(--muted);
    margin-top: 7px;
  }
  .disconnected .flow-icon {
    border-style: dashed;
    color: #94949b;
  }
  .disconnected::before {
    content: '⋯' !important;
  }
  .waiting .flow-icon {
    border-color: #8a8a90;
  }
  .demo-operation {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 17px 21px;
    background: #f7f7f8;
    border: 1px solid var(--border);
    border-radius: 9px;
    max-width: 420px;
    margin: auto;
  }
  .demo-operation > div {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .demo-tomato {
    font-size: 12px;
  }
  .demo-operation strong {
    font-size: 20px;
    font-weight: 550;
  }
  .demo-operation small {
    font-size: 10px;
    font-weight: 400;
    color: var(--muted);
  }
  .demo-operation button {
    display: flex;
    gap: 12px;
    border: 1px solid #d9d9dc;
    background: white;
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 10px;
  }
  .demo-operation button:hover {
    background: #ededf0;
  }
  .demo-operation button:disabled {
    opacity: 0.4;
  }
  .sync-status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    font-size: 10px;
    color: var(--muted);
    margin: 18px 0 0;
    min-height: 32px;
  }
  .demo-note {
    text-align: center;
    margin-bottom: 0;
  }
  @media (max-width: 1000px) {
    .offline-intro {
      gap: 50px;
    }
  }
  @media (max-width: 760px) {
    .offline-intro {
      grid-template-columns: 1fr;
      gap: 26px;
      margin-bottom: 32px;
    }
    .offline-intro .lead {
      font-size: 15px;
    }
    .offline-demo {
      padding: 20px 17px 16px;
    }
    .demo-top > span {
      font-size: 8px;
      max-width: 110px;
      line-height: 1.7;
    }
    .network-switch {
      font-size: 10px;
      gap: 5px;
    }
    .flow {
      grid-template-columns: 1fr 1fr;
      gap: 31px 20px;
      margin: 30px 0;
    }
    .flow li + li::before {
      left: -17px;
      top: 22px;
    }
    .flow li:nth-child(3)::before {
      display: none;
    }
    .flow li:nth-child(3)::after {
      content: '↓';
      position: absolute;
      right: -17px;
      top: -27px;
      color: #b0b0b4;
      transform: rotate(30deg);
    }
    .flow-icon {
      height: 58px;
      width: 58px;
      margin-bottom: 12px;
      border-radius: 13px;
    }
    .flow strong {
      font-size: 12px;
    }
    .flow small {
      font-size: 9px;
    }
    .demo-operation {
      padding: 14px 12px;
    }
    .demo-operation > div {
      gap: 12px;
    }
    .demo-operation button {
      padding: 10px 9px;
      font-size: 9px;
      gap: 8px;
    }
    .sync-status {
      font-size: 9px;
      align-items: flex-start;
      min-height: 42px;
      margin-top: 16px;
    }
    .sync-status :global(svg) {
      margin-top: 2px;
    }
    .demo-note {
      font-size: 9px;
    }
  }
</style>
