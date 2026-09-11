<script lang="ts">
  export type IconName =
    | 'box'
    | 'arrow'
    | 'github'
    | 'search'
    | 'scan'
    | 'check'
    | 'shelf'
    | 'history'
    | 'wifi'
    | 'offline'
    | 'copy'
    | 'close'
    | 'menu'
    | 'database'
    | 'server'
    | 'browser'
    | 'plus'
    | 'chevron';
  let { name, size = 20 }: { name: IconName; size?: number } = $props();
  const paths: Record<IconName, string> = {
    box: 'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3ZM3 7.5l9 4.5 9-4.5M12 12v9M7.5 5.25l9 4.5v4.5',
    arrow: 'M4 12h15m-6-6 6 6-6 6',
    github:
      'M9 19c-4.3 1.3-4.3-2.2-6-2.7m12 5v-3.4c0-1 .1-1.4-.5-2 3.4-.4 7-1.7 7-7.6a6 6 0 0 0-1.6-4.2 5.5 5.5 0 0 0-.2-4.1s-1.3-.4-4.4 1.6a15 15 0 0 0-8 0C4.2-.4 2.9 0 2.9 0a5.5 5.5 0 0 0-.2 4.1A6 6 0 0 0 1.1 8.3c0 5.9 3.6 7.2 7 7.6-.5.5-.7 1.1-.6 2v3.4',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    scan: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M7 7v10m3-10v10m4-10v10m3-10v10',
    check: 'm5 12 4 4L19 6',
    shelf: 'M4 3v18M20 3v18M4 10h16M4 18h16M7 5h5v5M14 4h3v6M7 13h4v5m3-4h3v4',
    history: 'M3 11a9 9 0 1 1 2.5 7M3 4v7h7m2-4v5l3 2',
    wifi: 'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-10 4a5 5 0 0 1 6 0m-3 4h.01',
    offline:
      'm3 3 18 18M2 8a16 16 0 0 1 4-2m4-1a16 16 0 0 1 12 3M5 12a11 11 0 0 1 5-2m5 1 4 1m-10 4a5 5 0 0 1 6 0m-3 4h.01',
    copy: 'M8 8h12v13H8zM16 8V3H3v13h5',
    close: 'm6 6 12 12M6 18 18 6',
    menu: 'M4 8h16M4 16h16',
    database:
      'M20 5c0 2-3.6 3-8 3S4 7 4 5s3.6-3 8-3 8 1 8 3ZM4 5v14c0 2 3.6 3 8 3s8-1 8-3V5M4 12c0 2 3.6 3 8 3s8-1 8-3',
    server: 'M3 3h18v7H3zM3 14h18v7H3zM7 6.5h.01M7 17.5h.01m5-11h5m-5 11h5',
    browser: 'M3 4h18v16H3zM3 9h18M7 6.5h.01m3 0h.01',
    plus: 'M12 5v14M5 12h14',
    chevron: 'm9 5 7 7-7 7'
  };
</script>

<svg
  width={size}
  height={size}
  viewBox={name === 'github' ? '-2 -2 26 26' : '0 0 24 24'}
  fill="none"
  stroke="currentColor"
  stroke-width="1.6"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={paths[name]} /></svg
>
