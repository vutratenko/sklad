import { defineConfig } from '@playwright/test';
import { base } from './site.config.js';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: `http://127.0.0.1:4183${base}/`,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run preview -- --port 4183 --strictPort',
    url: `http://127.0.0.1:4183${base}/`,
    reuseExistingServer: !process.env.CI
  }
});
