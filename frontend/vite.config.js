import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'sklad-icon.png', 'sklad-wordmark.png'],
      manifest: {
        name: 'Sklad WMS',
        short_name: 'Sklad',
        description: 'Домашняя WMS',
        theme_color: '#111317',
        background_color: '#111317',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'sklad-icon.png', sizes: '1536x1024', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        runtimeCaching: [
          {
            urlPattern: /\/api\/v1\/media\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sku-media',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
});
