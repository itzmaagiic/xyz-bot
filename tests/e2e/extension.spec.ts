import { chromium, expect, test, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveFixture } from './game-stub';

const EXT = join(import.meta.dirname, '..', '..', 'dist', 'chrome');

async function launch(): Promise<{ ctx: BrowserContext; extId: string }> {
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium', // full Chromium in new headless mode – required for extensions
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  return { ctx, extId: new URL(sw.url()).host };
}

test.describe('Chrome extension (MV3, unpacked)', () => {
  let ctx: BrowserContext;
  let extId: string;
  test.beforeEach(async () => ({ ctx, extId } = await launch()));
  test.afterEach(async () => ctx.close());

  test('overlay mounts, MAIN-world bridge reads lexical `state`', async () => {
    await serveFixture(ctx, 'title');
    const page = await ctx.newPage();
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await expect(page.locator('#pk-screen')).toHaveText('title');
    await expect(page.locator('#pk-version')).toHaveCount(0);
  });

  test('step performs exactly one verified click', async () => {
    await serveFixture(ctx, 'title');
    const page = await ctx.newPage();
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await page.locator('#pk-step').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks))
      .toEqual(['btn-challenges-run']);
    await expect(page.locator('#pk-screen')).toHaveText('trainer', { timeout: 5000 });
  });

  test('Runs exportieren downloads a pkbot-runs/1 file from the content script (R-006)', async () => {
    await serveFixture(ctx, 'title');
    const page = await ctx.newPage();
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await page.locator('#pk-step').click();
    await expect(page.locator('#pk-screen')).toHaveText('trainer', { timeout: 5000 });
    await page.locator('summary', { hasText: 'Mehr' }).click();
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#pk-export-runs').click()]);
    const json = JSON.parse(readFileSync(await dl.path(), 'utf8'));
    expect(json).toMatchObject({ format: 'pkbot-runs/1' });
    expect(json.runs[0].decisions[0]).toMatchObject({ chosen: 'click #btn-challenges-run[0]', outcome: 'ok' });
    expect(json.bot_version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('map: route planner clicks the SVG node (catch beats battle with room in team)', async () => {
    await serveFixture(ctx, 'map');
    const page = await ctx.newPage();
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await page.locator('#pk-step').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks))
      .toContain('n1_0');
  });

  test('game settings change only after explicit two-step confirmation', async () => {
    await serveFixture(ctx, 'title');
    const page = await ctx.newPage();
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pk-speed-ask')).toBeVisible({ timeout: 10_000 });
    expect(
      await page.evaluate(() => (window as unknown as { __savedSettings?: number }).__savedSettings),
    ).toBeUndefined();
    await page.locator('#pk-speed-ask').click();
    await page.locator('#pk-speed-no').click();
    expect(
      await page.evaluate(() => (window as unknown as { __savedSettings?: number }).__savedSettings),
    ).toBeUndefined();
    await page.locator('#pk-speed-ask').click();
    await page.locator('#pk-speed-yes').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __savedSettings?: number }).__savedSettings))
      .toBe(1);
    await expect(page.locator('#pk-speed')).toHaveCount(0);
  });

  test('options page shares settings with the overlay', async () => {
    await serveFixture(ctx, 'title');
    const page = await ctx.newPage();
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    const opts = await ctx.newPage();
    await opts.goto(`chrome-extension://${extId}/options.html`);
    await opts.locator('#pk-chalkind').selectOption('weekly');
    await expect(opts.locator('#saved')).toHaveText(/Gespeichert/);
    await page.locator('summary', { hasText: 'Einstellungen' }).click();
    await expect(page.locator('#pk-chalkind')).toHaveValue('weekly');
  });

  test('popup renders and offers to open the game', async () => {
    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await expect(popup.locator('#open')).toBeVisible();
    await expect(popup.locator('#options')).toBeVisible();
  });
});
