<script lang="ts">
  import { base } from '$app/paths';
  import { repository, docs } from '$lib/project';
  import Icon from './Icon.svelte';
  let { year }: { year: number } = $props();
</script>

<footer class="container">
  <div class="footer-top">
    <div>
      <a class="footer-brand" href={`${base}/`}><Icon name="box" size={23} /> Sklad</a>
      <p>Tiny home WMS.</p>
    </div>
    <nav aria-label="Ссылки в подвале">
      <a href={repository}>GitHub <span aria-hidden="true">↗</span></a><a href={docs}
        >Документация <span aria-hidden="true">↗</span></a
      ><a href={`${repository}/issues`}>Обратная связь <span aria-hidden="true">↗</span></a>
    </nav>
  </div>
  <div class="footer-bottom">
    <span>Sklad · {year}</span><span>Built in the open. Храните с порядком.</span>
  </div>
</footer>

<style>
  footer {
    padding-top: 43px;
    padding-bottom: 25px;
  }
  .footer-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 31px;
  }
  .footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 21px;
    letter-spacing: -0.7px;
    font-weight: 650;
  }
  .footer-top p {
    font-size: 11px;
    color: var(--muted);
    margin: 10px 0 0;
  }
  nav {
    display: flex;
    gap: 26px;
    padding-top: 8px;
  }
  nav a {
    font-size: 11px;
    color: var(--muted);
  }
  nav a:hover {
    color: var(--ink);
  }
  nav span {
    margin-left: 4px;
  }
  .footer-bottom {
    display: flex;
    justify-content: space-between;
    border-top: 1px solid var(--border);
    padding-top: 22px;
    color: var(--muted);
    font-size: 9px;
  }
  @media (max-width: 600px) {
    .footer-top {
      gap: 28px;
    }
    nav {
      flex-direction: column;
      gap: 18px;
    }
    nav a {
      font-size: 10px;
    }
    .footer-bottom {
      gap: 20px;
      font-size: 8px;
    }
    .footer-bottom > span:last-child {
      text-align: right;
    }
  }
</style>
