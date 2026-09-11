import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { base } from './site.config.js';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ strict: true }),
    paths: { base, relative: false },
    prerender: { entries: ['*'] }
  }
};
