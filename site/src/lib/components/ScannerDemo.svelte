<script lang="ts">
  import Icon from './Icon.svelte';
  import ProductArt from './ProductArt.svelte';
  let scanned = $state(false);
</script>

<section
  class="scanner-section section container"
  id="how-it-works"
  aria-labelledby="scanner-heading"
>
  <div class="phone-stage">
    <div class="phone">
      <div class="phone-top">
        <span>9:41</span><span class="speaker"></span><Icon name="wifi" size={14} />
      </div>
      <div class="scanner-header">
        <Icon name="box" size={19} /><strong>Sklad</strong><span>Скан</span>
      </div>
      <div class="camera-view" class:scanned>
        <div class="background-shelf"></div>
        <div class="camera-product"><ProductArt large /></div>
        <div class="camera-barcode" aria-hidden="true"></div>
        <div class="scan-frame">
          <i></i><i></i><i></i><i></i>{#if !scanned}<span class="scan-line"></span>{:else}<span
              class="scan-check"><Icon name="check" size={22} /></span
            >{/if}
        </div>
        <span class="camera-caption">{scanned ? 'Товар найден' : 'QR-код или штрихкод'}</span>
      </div>
      <div class="scanner-result" aria-live="polite">
        {#if scanned}<div class="result-label">
            <Icon name="check" size={13} /> Найдено в каталоге
          </div>
          <strong>Томаты в собственном соку</strong>
          <p>Кладовка · Верхняя полка</p>
          <span class="result-quantity">12 <small>шт.</small></span>{:else}<div
            class="result-label"
          >
            <Icon name="scan" size={14} /> Сканирование
          </div>
          <strong>Наведите камеру на код</strong>
          <p>Найдите товар в вашем каталоге</p>{/if}
      </div>
      <div class="phone-bottom"></div>
    </div>
    <p class="note">Схема сканера · демонстрационный товар</p>
  </div>
  <div class="scanner-copy">
    <p class="eyebrow">МЕНЬШЕ НАБИРАТЬ. БОЛЬШЕ НАХОДИТЬ.</p>
    <h2 id="scanner-heading">Наведи камеру.<br /><span>Остальное — Sklad.</span></h2>
    <p class="lead">
      Отсканируйте QR-этикетку или штрихкод прямо в PWA. Sklad найдёт товар в каталоге и покажет его
      остатки.
    </p>
    <p class="scanner-extra">
      Без сети поиск работает по загруженному каталогу. Для камеры нужны HTTPS и разрешение
      браузера.
    </p>
    <button class="text-link demo-control" onclick={() => (scanned = !scanned)}
      >{scanned ? 'Повторить демонстрацию' : 'Посмотреть, как это работает'}
      <Icon name={scanned ? 'history' : 'arrow'} size={17} /></button
    >
    <p class="note">Интерактивный пример, без доступа к камере.</p>
  </div>
</section>

<style>
  .scanner-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 100px;
    align-items: center;
  }
  .phone-stage {
    text-align: center;
    position: relative;
  }
  .phone-stage::before {
    content: '';
    width: 340px;
    height: 340px;
    background: #f5f5f7;
    border-radius: 50%;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: -1;
  }
  .phone {
    width: 260px;
    height: 523px;
    background: white;
    border: 5px solid #55565a;
    border-radius: 39px;
    box-shadow:
      inset 0 0 0 2px #e1e1e3,
      0 22px 50px -15px #00000026;
    overflow: hidden;
    position: relative;
    margin: 0 auto;
    text-align: left;
  }
  .phone-top {
    height: 45px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 22px;
    font-size: 10px;
    font-weight: 600;
    position: relative;
  }
  .speaker {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 61px;
    height: 13px;
    background: #444549;
    border-radius: 20px;
  }
  .scanner-header {
    height: 43px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 16px;
    border-bottom: 1px solid var(--border);
  }
  .scanner-header strong {
    font-size: 14px;
  }
  .scanner-header > span {
    font-size: 11px;
    color: var(--muted);
    margin-left: auto;
  }
  .camera-view {
    height: 250px;
    position: relative;
    background: #e3e0d9;
    overflow: hidden;
  }
  .background-shelf {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      0deg,
      #d0ccc3 0 12%,
      #c1bcb1 12% 14%,
      #e3e0d9 14% 89%,
      #d3cec4 89% 92%,
      #e9e5dd 92%
    );
  }
  .camera-product {
    position: absolute;
    left: 50%;
    top: 46%;
    transform: translate(-50%, -50%);
    width: 160px;
  }
  .camera-product :global(.large) {
    min-height: 210px;
  }
  .camera-product :global(svg) {
    width: 147px;
    height: 180px;
  }
  .camera-barcode {
    position: absolute;
    width: 45px;
    height: 23px;
    left: 50%;
    top: 53%;
    transform: translate(-50%, -50%);
    border: 4px solid #f6f3eb;
    background: repeating-linear-gradient(
      90deg,
      #45433e 0 1px,
      #f6f3eb 1px 3px,
      #45433e 3px 5px,
      #f6f3eb 5px 6px,
      #45433e 6px 7px,
      #f6f3eb 7px 10px
    );
  }
  .scan-frame {
    position: absolute;
    inset: 47px 54px 50px;
  }
  .scan-frame i {
    position: absolute;
    width: 20px;
    height: 20px;
    border: 2px solid #fff;
  }
  .scan-frame i:nth-child(1) {
    top: 0;
    left: 0;
    border-right: 0;
    border-bottom: 0;
    border-radius: 7px 0 0;
  }
  .scan-frame i:nth-child(2) {
    top: 0;
    right: 0;
    border-left: 0;
    border-bottom: 0;
    border-radius: 0 7px 0 0;
  }
  .scan-frame i:nth-child(3) {
    bottom: 0;
    left: 0;
    border-right: 0;
    border-top: 0;
    border-radius: 0 0 0 7px;
  }
  .scan-frame i:nth-child(4) {
    bottom: 0;
    right: 0;
    border-left: 0;
    border-top: 0;
    border-radius: 0 0 7px;
  }
  .scan-line {
    position: absolute;
    left: 5px;
    right: 5px;
    height: 1px;
    background: #fff;
    top: 10%;
    box-shadow: 0 1px 9px #fff;
    animation: scan 3.5s ease-in-out infinite;
  }
  .scan-check {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #fff;
  }
  .scan-check :global(svg) {
    background: #666f62;
    border-radius: 50%;
    width: 36px;
    height: 36px;
    padding: 7px;
  }
  .camera-caption {
    position: absolute;
    bottom: 16px;
    left: 0;
    right: 0;
    text-align: center;
    font-size: 9px;
    color: #575650;
  }
  .scanner-result {
    padding: 20px 17px;
    position: relative;
    min-height: 137px;
  }
  .result-label {
    display: flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
    font-size: 9px;
    margin-bottom: 11px;
  }
  .scanner-result > strong {
    display: block;
    font-size: 12px;
    max-width: 170px;
    line-height: 1.45;
  }
  .scanner-result p {
    font-size: 9px;
    color: var(--muted);
    margin: 7px 0;
  }
  .result-quantity {
    position: absolute;
    right: 17px;
    top: 43px;
    font-size: 21px;
    font-weight: 600;
  }
  .result-quantity small {
    display: block;
    font-size: 9px;
    font-weight: 400;
    text-align: center;
  }
  .phone-bottom {
    position: absolute;
    bottom: 10px;
    width: 85px;
    height: 4px;
    background: #4f4f51;
    border-radius: 10px;
    left: 50%;
    transform: translateX(-50%);
  }
  .phone-stage > .note {
    margin-top: 23px;
    font-size: 10px;
  }
  .scanner-copy h2 {
    font-size: 48px;
    letter-spacing: -2.4px;
  }
  .scanner-extra {
    font-size: 12px;
    line-height: 1.8;
    color: var(--muted);
    max-width: 370px;
    margin-top: 23px;
  }
  .demo-control {
    background: transparent;
    border: 0;
    padding: 0;
    margin-top: 17px;
    min-height: 36px;
  }
  .scanner-copy > .note {
    font-size: 10px;
    margin-top: 7px;
  }
  @keyframes scan {
    0%,
    100% {
      top: 10%;
    }
    50% {
      top: 85%;
    }
  }
  @media (max-width: 1000px) {
    .scanner-section {
      gap: 55px;
    }
    .scanner-copy h2 {
      font-size: 40px;
    }
    .phone-stage::before {
      width: 300px;
      height: 300px;
    }
  }
  @media (max-width: 760px) {
    .scanner-section {
      grid-template-columns: 1fr;
      gap: 45px;
    }
    .scanner-copy {
      grid-row: 1;
    }
    .scanner-copy h2 {
      font-size: 38px;
      letter-spacing: -1.8px;
    }
    .phone {
      width: 250px;
      height: 510px;
    }
    .phone-stage > .note {
      margin-bottom: 0;
    }
  }
</style>
