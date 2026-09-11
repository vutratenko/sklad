<script lang="ts">
  let { kind = 'tomato', large = false }: { kind?: string; large?: boolean } = $props();
</script>

<div class="product-art" class:large aria-hidden="true">
  <svg viewBox="0 0 100 110" fill="none">
    <ellipse cx="50" cy="99" rx="29" ry="4" fill="#000" opacity=".07" />
    {#if kind === 'tomato'}
      <path
        d="M32 18h36v13c0 5 9 9 9 17v42c0 6-5 9-27 9s-27-3-27-9V48c0-8 9-12 9-17V18Z"
        fill="#bcb4a7"
        stroke="#918b81"
      />
      <path d="M26 49h48v39c0 5-48 5-48 0V49Z" fill="#9f6755" />
      <rect x="28" y="15" width="44" height="11" rx="3" fill="#73756c" />
      <path d="M32 18h36M32 22h36" stroke="#a6a79b" />
      <path d="M23 54h54v29H23z" fill="#eee9df" />
      <circle cx="50" cy="67" r="9" fill="#a85f49" /><path
        d="m45 60 5 3 4-5m-4 5v-7"
        stroke="#697460"
        stroke-width="2"
      />
      <path
        d="M30 43v7m0 37v3"
        stroke="#fff"
        stroke-opacity=".5"
        stroke-width="3"
        stroke-linecap="round"
      />
    {:else if kind === 'tin'}
      <rect x="19" y="38" width="62" height="55" rx="5" fill="#b7b9b5" stroke="#949790" />
      <ellipse cx="50" cy="39" rx="31" ry="7" fill="#d4d5ce" stroke="#949790" /><ellipse
        cx="50"
        cy="39"
        rx="25"
        ry="4"
        stroke="#b0b3a8"
      />
      <rect x="18" y="49" width="64" height="31" rx="1" fill="#dfdfd1" />
      <path d="M33 58h34M38 63h24M32 72h36" stroke="#7b816e" stroke-width="2" />
      <path d="M22 87h56M22 91h56" stroke="#8c9086" />
    {:else}
      <path
        d="m26 18 48 0-3 9 6 66-7 5H30l-7-5 6-66-3-9Z"
        fill={kind === 'pasta' ? '#ddd1ae' : '#c7b998'}
        stroke="#b5a98a"
      />
      <path d="M27 23h46M25 92h50" stroke="#a99e83" stroke-width="2" />
      <rect x="31" y="35" width="38" height="30" rx="1" fill="#f1ece0" />
      <path d="M39 44h22M42 49h16M38 57h24" stroke="#8c8976" stroke-width="2" />
      {#if kind === 'pasta'}<path
          d="m35 75 6 10m2-12 6 11m3-11 6 11m2-13 6 11"
          stroke="#ad9663"
          stroke-width="3"
          stroke-linecap="round"
        />{:else}<path
          d="m37 76 3 2m6-4 3 2m8 0 3 2m-25 6 3 2m7-4 3 2m8 2 3-2m-12 6 3 2"
          stroke="#8e7a57"
          stroke-width="3"
          stroke-linecap="round"
        />{/if}
    {/if}
  </svg>
</div>

<style>
  .product-art {
    width: 54px;
    height: 58px;
    display: grid;
    place-items: center;
    background: #f5f3ee;
    border-radius: 10px;
    flex-shrink: 0;
  }
  .product-art svg {
    width: 47px;
    height: 53px;
  }
  .large {
    width: 100%;
    height: 100%;
    min-height: 240px;
    background: transparent;
  }
  .large svg {
    width: 190px;
    height: 220px;
    filter: drop-shadow(6px 12px 10px #00000009);
  }
</style>
