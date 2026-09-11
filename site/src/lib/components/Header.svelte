<script lang="ts">
  import { base } from '$app/paths';
  import { repository } from '$lib/project';
  import Icon from './Icon.svelte';
  let open = $state(false);
  let toggle: HTMLButtonElement;
  const links = [
    { href: '#features', label: 'Возможности' },
    { href: '#how-it-works', label: 'Как работает' },
    { href: '#self-hosted', label: 'Self-hosted' }
  ];

  function closeOnEscape(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      open = false;
      toggle?.focus();
    }
  }
</script>

<svelte:window onkeydown={closeOnEscape} />
<a class="skip-link" href="#main">Перейти к содержимому</a>
<header>
  <div class="header-inner container">
    <a class="brand" href={`${base}/`} aria-label="Sklad — главная"
      ><Icon name="box" size={27} /><span>Sklad</span></a
    >
    <nav class:open aria-label="Основная навигация" id="site-navigation">
      {#each links as link}<a href={link.href} onclick={() => (open = false)}>{link.label}</a
        >{/each}
    </nav>
    <a class="github-link" href={repository}
      ><Icon name="github" size={17} /><span>GitHub</span><span aria-hidden="true">↗</span></a
    >
    <button
      bind:this={toggle}
      class="menu-toggle"
      aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
      aria-expanded={open}
      aria-controls="site-navigation"
      onclick={() => (open = !open)}><Icon name={open ? 'close' : 'menu'} /></button
    >
  </div>
</header>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 30;
    background: rgb(255 255 255 / 0.88);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border);
  }
  .header-inner {
    height: 72px;
    display: flex;
    align-items: center;
    gap: 36px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 23px;
    font-weight: 730;
    letter-spacing: -1px;
    margin-right: auto;
  }
  nav {
    display: flex;
    gap: 30px;
    align-items: center;
  }
  nav a {
    font-size: 13px;
    color: #515155;
    padding: 12px 0;
  }
  nav a:hover {
    color: var(--ink);
  }
  .github-link {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    background: var(--ink);
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
  }
  .github-link:hover {
    background: #38383a;
  }
  .menu-toggle {
    display: none;
    width: 44px;
    height: 44px;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 0;
  }
  @media (max-width: 760px) {
    .header-inner {
      height: 64px;
      gap: 14px;
    }
    .brand {
      font-size: 22px;
    }
    .github-link {
      padding: 9px 12px;
    }
    .github-link > span:last-child {
      display: none;
    }
    .menu-toggle {
      display: flex;
    }
    nav {
      display: none;
      position: absolute;
      left: 0;
      right: 0;
      top: 64px;
      padding: 16px 24px 24px;
      background: #fff;
      border-bottom: 1px solid var(--border);
      box-shadow: 0 16px 24px #00000008;
    }
    nav.open {
      display: flex;
      flex-direction: column;
      gap: 0;
      align-items: stretch;
    }
    nav a {
      font-size: 16px;
      padding: 15px 0;
    }
  }
</style>
