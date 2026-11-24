import { defineConfig, devices } from '@playwright/test';

const live = !!process.env.LIVE;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: live ? /live\.spec\.ts/ : /(extension|userscript)\.spec\.ts/,
  timeout: live ? 600_000 : 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'off' },
  projects: live
    ? [{ name: 'live-chrome-extension', use: { browserName: 'chromium' } }]
    : [
        { name: 'chrome-extension', testMatch: /extension\.spec\.ts/, use: { browserName: 'chromium' } },
        { name: 'userscript-chromium', testMatch: /userscript\.spec\.ts/, use: { browserName: 'chromium' } },
        { name: 'userscript-webkit-iphone', testMatch: /userscript\.spec\.ts/, use: { ...devices['iPhone 13'] } },
      ],
});
