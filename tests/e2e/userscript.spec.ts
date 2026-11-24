import { expect, test } from '@playwright/test';
import { serveFixture } from './game-stub';
import { injectUserscript } from './userscript-host';

test.describe('Userscript (GM shim)', () => {
  test('overlay + bridge via injected <script> element', async ({ page, browserName }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    const world = await injectUserscript(page, browserName);
    test.info().annotations.push({ type: 'world', description: world });
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await expect(page.locator('#pk-screen')).toHaveText('title');
  });

  test('step clicks and verifies', async ({ page, browserName }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await page.locator('#pk-step').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks)).toEqual(['btn-history-run']);
  });

  test('map node click on SVG', async ({ page, browserName }) => {
    await serveFixture(page, 'map');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await page.locator('#pk-step').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks)).toContain('n1_0');
  });

  test('confirmation flow, toast and clipboard', async ({ page, browserName }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await page.locator('#pk-speed-ask').click();
    await page.locator('#pk-speed-yes').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __savedSettings?: number }).__savedSettings)).toBe(1);
    await page.locator('#pk-copy').click();
    await expect(page.locator('#pkbot-toasts')).toContainText('Log kopiert');
  });

  test('keyboard shortcut Alt+Shift+O toggles the overlay', async ({ page, browserName, isMobile }) => {
    test.skip(isMobile, 'no hardware keyboard on the phone profile');
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-bridge')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Alt+Shift+KeyO');
    await expect(page.locator('#pk-bridge')).toBeHidden();
  });

  test('overlay fits the viewport (phone width, no horizontal scroll)', async ({ page, browserName }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-bridge')).toBeVisible({ timeout: 10_000 });
    const box = await page.locator('#pkbot-root').evaluate((h) => {
      const r = (h.shadowRoot!.querySelector('.panel') as HTMLElement).getBoundingClientRect();
      return { left: r.left, right: r.right, vw: window.innerWidth };
    });
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(box.vw);
  });
});
