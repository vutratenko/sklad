<script lang="ts">
  import { installation } from '$lib/project';
  import Icon from './Icon.svelte';
  let copyStatus = $state('');
  const commands = 'git clone https://github.com/vutratenko/sklad.git\ncd sklad\nmake up';
  async function copy() {
    try {
      await navigator.clipboard.writeText(commands);
      copyStatus = 'Команды скопированы';
    } catch {
      copyStatus = 'Выделите и скопируйте команды вручную';
    }
  }
</script>

<section class="self-hosted section" id="self-hosted" aria-labelledby="self-heading">
  <div class="container self-grid">
    <div>
      <p class="eyebrow">SELF-HOSTED ПО СВОЕЙ ПРИРОДЕ</p>
      <h2 id="self-heading">Ваш склад.<br />Ваш сервер.<br /><span>Ваши данные.</span></h2>
      <p class="lead">
        Запустите Sklad дома или на своём сервере. Приложение, база и фотографии остаются в вашей
        инфраструктуре.
      </p>
      <a class="install-link" href={installation}
        >Руководство по установке <Icon name="arrow" size={17} /></a
      >
    </div>
    <div>
      <div class="terminal">
        <div class="terminal-bar">
          <span class="terminal-dots" aria-hidden="true"><i></i><i></i><i></i></span><span
            >Быстрый старт · Docker Compose</span
          ><button onclick={copy} aria-label="Скопировать команды запуска"
            ><Icon
              name={copyStatus === 'Команды скопированы' ? 'check' : 'copy'}
              size={15}
            /></button
          >
        </div>
        <div class="terminal-body">
          <p class="terminal-comment"># Нужны Git, Make и Docker с Compose</p>
          <pre><code
              ><span class="prompt" aria-hidden="true"
                >$ </span>git clone https://github.com/vutratenko/sklad.git
<span class="prompt" aria-hidden="true">$ </span>cd sklad
<span class="prompt" aria-hidden="true">$ </span>make up</code
            ></pre>
          <div class="services">
            <span><Icon name="check" size={14} /> PostgreSQL</span><span
              ><Icon name="check" size={14} /> Go API</span
            ><span><Icon name="check" size={14} /> PWA frontend</span>
          </div>
          <div class="localhost">
            <span>Откройте в браузере</span><code>http://localhost:3000</code><Icon
              name="arrow"
              size={16}
            />
          </div>
        </div>
      </div>
      <p class="copy-status" aria-live="polite">
        {copyStatus || 'Пример запуска локального стека. Для production настройте OIDC и HTTPS.'}
      </p>
    </div>
  </div>
</section>

<style>
  .self-hosted {
    background: #111;
    color: #f5f5f7;
  }
  .self-grid {
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: 90px;
    align-items: center;
  }
  .self-hosted .eyebrow {
    color: #949499;
  }
  .self-hosted h2 {
    font-size: 56px;
    letter-spacing: -2.6px;
    line-height: 1.1;
  }
  .self-hosted h2 span {
    color: #959599;
  }
  .self-hosted .lead {
    color: #a1a1a6;
    font-size: 15px;
    max-width: 350px;
  }
  .install-link {
    display: inline-flex;
    align-items: center;
    gap: 16px;
    border-bottom: 1px solid #5d5d60;
    padding-bottom: 9px;
    margin-top: 30px;
    font-size: 12px;
  }
  .install-link:hover {
    color: white;
    border-color: white;
  }
  .terminal {
    background: #1c1c1e;
    border: 1px solid #ffffff14;
    border-radius: 13px;
    overflow: hidden;
    box-shadow: 0 22px 65px #0003;
  }
  .terminal-bar {
    display: flex;
    align-items: center;
    gap: 17px;
    height: 50px;
    padding: 0 18px;
    border-bottom: 1px solid #ffffff0c;
    color: #adadb2;
    font-size: 9px;
  }
  .terminal-dots {
    display: flex;
    gap: 5px;
  }
  .terminal-dots i {
    height: 6px;
    width: 6px;
    border-radius: 50%;
    background: #515154;
  }
  .terminal-bar button {
    margin-left: auto;
    display: grid;
    place-items: center;
    background: transparent;
    border: 0;
    color: #a1a1a6;
    min-width: 32px;
    min-height: 32px;
    border-radius: 5px;
  }
  .terminal-bar button:hover {
    background: #333336;
    color: white;
  }
  .terminal-body {
    padding: 24px;
  }
  .terminal-comment {
    font-size: 9px;
    color: #a0a0a6;
    font-family: var(--mono);
    margin: 0 0 22px;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 2.5;
    font-size: 10px;
  }
  code {
    font-family: var(--mono);
  }
  .prompt {
    color: #898990;
    user-select: none;
  }
  .services {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 31px;
    color: #c2c2c7;
    font-family: var(--mono);
    font-size: 10px;
  }
  .services span {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .services :global(svg) {
    color: #a0ab9b;
  }
  .localhost {
    margin-top: 29px;
    border-top: 1px solid #ffffff12;
    padding-top: 21px;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 9px;
  }
  .localhost > span {
    color: #a0a0a6;
    font-size: 9px;
    grid-column: 1/-1;
  }
  .localhost code {
    font-size: 12px;
  }
  .localhost :global(svg) {
    color: #8c8c93;
  }
  .copy-status {
    font-size: 10px;
    line-height: 1.7;
    color: #a0a0a6;
    margin: 17px 5px 0;
    min-height: 34px;
  }
  @media (max-width: 1100px) {
    .self-grid {
      gap: 50px;
    }
    .self-hosted h2 {
      font-size: 49px;
    }
    .terminal-body {
      padding: 20px;
    }
    pre {
      font-size: 9px;
    }
    .terminal-bar {
      padding: 0 13px;
      gap: 12px;
      font-size: 8px;
    }
  }
  @media (max-width: 760px) {
    .self-grid {
      grid-template-columns: 1fr;
      gap: 36px;
    }
    .self-hosted h2 {
      font-size: 46px;
      letter-spacing: -2px;
    }
    .terminal-body {
      padding: 21px 18px;
    }
    .terminal-comment {
      font-size: 8px;
    }
    pre {
      font-size: 9px;
      line-height: 2.6;
    }
    .terminal-bar {
      font-size: 8px;
    }
    .copy-status {
      font-size: 9px;
    }
  }
</style>
