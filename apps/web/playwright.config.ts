/**
 * Playwright end-to-end configuration (scaffold).
 *
 * This file is wired for F16 — the actual browser install and the first
 * editor E2E spec are added there. The config compiles today so CI and
 * editor tooling recognize the shape of Playwright tests, but no browsers
 * are downloaded until someone runs `pnpm exec playwright install`.
 *
 * When F16 lands, the `test:e2e` script in package.json should be switched
 * from its current echo stub to `playwright test`.
 */
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'corepack pnpm exec next dev --port 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
};

export default config;
