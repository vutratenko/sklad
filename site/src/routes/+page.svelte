<script lang="ts">
  import type { PageProps } from './$types';
  import Header from '$lib/components/Header.svelte';
  import Hero from '$lib/components/Hero.svelte';
  import Idea from '$lib/components/Idea.svelte';
  import FeatureShowcase from '$lib/components/FeatureShowcase.svelte';
  import ScannerDemo from '$lib/components/ScannerDemo.svelte';
  import OfflineDiagram from '$lib/components/OfflineDiagram.svelte';
  import TerminalDemo from '$lib/components/TerminalDemo.svelte';
  import Architecture from '$lib/components/Architecture.svelte';
  import OpenSourceCTA from '$lib/components/OpenSourceCTA.svelte';
  import Footer from '$lib/components/Footer.svelte';
  let { data }: PageProps = $props();
  const description =
    'Open-source self-hosted inventory system for keeping track of household supplies and storage locations.';
</script>

<svelte:head>
  <title>Sklad — self-hosted home inventory</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={data.siteUrl} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Sklad" />
  <meta property="og:locale" content="ru_RU" />
  <meta property="og:title" content="Sklad — всё на своих местах." />
  <meta
    property="og:description"
    content="Помнит, что у вас есть. И где это лежит. Маленькая self-hosted WMS для домашних запасов."
  />
  <meta property="og:url" content={data.siteUrl} />
  <meta property="og:image" content={`${data.siteUrl}og.png`} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta
    property="og:image:alt"
    content="Sklad — всё на своих местах. Open Source · Offline-first · Self-hosted."
  />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Sklad — всё на своих местах." />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={`${data.siteUrl}og.png`} />
</svelte:head>

<Header />
<main id="main" tabindex="-1">
  <Hero />
  <Idea />
  <FeatureShowcase />
  <ScannerDemo />
  <OfflineDiagram />
  <TerminalDemo />
  <Architecture />
  <OpenSourceCTA />
</main>
<Footer year={data.year} />
