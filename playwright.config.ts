import { defineConfig, devices } from '@playwright/test';

const live = !!process.env.LIVE;
const DESKTOP = { width: 1440, height: 900 };

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: live ? /live\.spec\.ts/ : /(extension|userscript)\.spec\.ts/,
  timeout: live ? (Number(process.env.LIVE_MINUTES ?? 5) * 60 + 900) * 1000 : 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { trace: 'off' },
  projects: live
    ? [{ name: 'live-chrome-extension', use: { browserName: 'chromium', viewport: DESKTOP } }]
    : [
        // viewports per docs/UI.md §1 (R-005, R-033, R-082)
        {
          name: 'chrome-extension',
          testMatch: /extension\.spec\.ts/,
          use: { browserName: 'chromium', viewport: DESKTOP },
        },
        {
          name: 'userscript-desktop',
          testMatch: /userscript\.spec\.ts/,
          use: { browserName: 'chromium', viewport: DESKTOP },
        },
        {
          name: 'userscript-iphone',
          testMatch: /userscript\.spec\.ts/,
          use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } },
        },
        { name: 'userscript-iphone-safari', testMatch: /userscript\.spec\.ts/, use: { ...devices['iPhone 13'] } },
        { name: 'userscript-iphone-se', testMatch: /userscript\.spec\.ts/, use: { ...devices['iPhone SE (3rd gen)'] } },
      ],
});
