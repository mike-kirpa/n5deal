import { defineConfig, devices } from '@playwright/test';
import { environment, runDirectory } from './helpers/environment';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: `${runDirectory}/runner`,
  reporter: [['./helpers/safe-reporter.ts']],
  use: {
    baseURL: environment.webURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'api', testMatch: '**/api/**/*.spec.ts' },
    { name: 'chromium', testMatch: '**/e2e/**/*.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'known-api', testMatch: '**/regressions/*.api.spec.ts' },
    { name: 'known-chromium', testMatch: '**/regressions/*.e2e.spec.ts' },
    { name: 'characterization', testMatch: '**/characterization/**/*.spec.ts' },
    ...(process.env.QA_RUN_EXPIRATION === '1'
      ? [{ name: 'extended', testMatch: '**/extended/**/*.spec.ts' }]
      : []),
  ],
});
