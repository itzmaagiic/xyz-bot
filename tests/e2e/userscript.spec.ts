import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { serveFixture } from './game-stub';
import { evaluateInUserscriptWorld, injectUserscript } from './userscript-host';

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
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks))
      .toEqual(['btn-challenges-run']);
  });

  test('map node click on SVG', async ({ page, browserName }) => {
    await serveFixture(page, 'map');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await page.locator('#pk-step').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks))
      .toContain('n1_0');
  });

  test('confirmation flow, toast and clipboard', async ({ page, browserName }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await page.locator('#pk-speed-ask').click();
    await page.locator('#pk-speed-yes').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __savedSettings?: number }).__savedSettings))
      .toBe(1);
    await page.locator('summary', { hasText: 'Mehr' }).click();
    await page.locator('#pk-copy').click();
    await expect(page.locator('#pkbot-toasts')).toContainText('Log kopiert');
  });

  test('Runs exportieren: a pkbot-runs/1 file with the recorded decision (R-006)', async ({
    page,
    browserName,
    isMobile,
  }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await page.locator('#pk-step').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks))
      .toEqual(['btn-challenges-run']);
    if (isMobile) {
      await page.locator('summary', { hasText: 'Mehr' }).click();
      await page.locator('#pk-export-runs').click(); // iOS: download sheet or the copy fallback
    } else {
      await page.locator('summary', { hasText: 'Mehr' }).click();
      const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#pk-export-runs').click()]);
      expect(dl.suggestedFilename()).toMatch(/^pkbot-runs-\d{8}-\d{6}\.json$/);
      const json = JSON.parse(readFileSync(await dl.path(), 'utf8'));
      expect(json.format).toBe('pkbot-runs/1');
      expect(json.runs).toHaveLength(1);
      expect(json.runs[0].decisions[0].chosen).toBe('click #btn-challenges-run[0]');
    }
    await expect(page.locator('#pkbot-toasts')).toContainText(/Runs (exportiert|kopiert)/);
  });

  test('a pause shows its kind on #pk-pause[data-kind] (R-254)', async ({ page, browserName }) => {
    await serveFixture(page, 'settings-modal');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await page.locator('#pk-step').click(); // unknown dialog: first read only notes it
    await page.locator('#pk-step').click(); // second read confirms → pause
    await expect(page.locator('#pk-pause')).toHaveAttribute('data-kind', 'unsupported');
  });

  test('an unhandled rejection from a ternary async handler shows up in the overlay log (R-200)', async ({
    page,
    browserName,
  }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    // the lint gap of D-036, for real: a real button, a real click, a real unhandled rejection in the bot's world
    await evaluateInUserscriptWorld(
      page,
      `(() => {
        const b = document.createElement('button');
        const flag = document.body.childElementCount > 0;
        b.addEventListener('click', flag ? async () => { throw new Error('ternary handler rejection'); } : null);
        document.body.appendChild(b);
        b.click();
        b.remove();
      })()`,
    );
    const log = () =>
      page.locator('#pkbot-root').evaluate((h) => h.shadowRoot?.getElementById('pk-log')?.textContent ?? '');
    await expect.poll(log, { timeout: 5000 }).toContain('unexpected: ternary handler rejection');
    await expect(page.locator('#pkbot-toasts')).toContainText('Unerwarteter Fehler im Bot');
  });

  test('settings that cannot be stored show a lasting hint with the next step (R-259)', async ({
    page,
    browserName,
  }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName, 'volatile');
    await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 10_000 });
    await expect(page.locator('#pk-storage')).toHaveCount(0);
    await page.locator('summary', { hasText: 'Einstellungen' }).click();
    await page.locator('summary', { hasText: 'Erweitert' }).click();
    await page.locator('#pk-delay').fill('900');
    await page.locator('#pk-delay').dispatchEvent('change');
    await expect(page.locator('#pk-storage')).toContainText('nur bis zum Neuladen');
    await expect(page.locator('#pk-storage')).toContainText('privates Surfen');
  });

  test('keyboard shortcut Alt+Shift+O toggles the overlay', async ({ page, browserName, isMobile }) => {
    test.skip(isMobile, 'no hardware keyboard on the phone profile');
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-toggle')).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press('Alt+Shift+KeyO');
    await expect(page.locator('#pk-toggle')).toBeHidden();
  });

  test('overlay fits the viewport (phone width, no horizontal scroll)', async ({ page, browserName }) => {
    await serveFixture(page, 'title');
    await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
    await injectUserscript(page, browserName);
    await expect(page.locator('#pk-toggle')).toBeVisible({ timeout: 10_000 });
    const box = await page.locator('#pkbot-root').evaluate((h) => {
      const r = (h.shadowRoot!.querySelector('.panel') as HTMLElement).getBoundingClientRect();
      return { left: r.left, right: r.right, vw: window.innerWidth };
    });
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(box.vw);
  });

  // R-100/R-102: the real wiring in main.ts – without GM, or with failing GM writes, settings survive a reload
  for (const gm of ['none', 'throwing'] as const) {
    test(`settings survive a reload via localStorage pkbot.* (GM: ${gm})`, async ({ page, browserName }) => {
      await serveFixture(page, 'title');
      await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
      await injectUserscript(page, browserName, gm);
      await expect(page.locator('#pk-toggle')).toBeVisible({ timeout: 10_000 });
      await page.locator('summary', { hasText: 'Einstellungen' }).click();
      await page.locator('summary', { hasText: 'Erweitert' }).click();
      await page.locator('#pk-delay').fill('777');
      await page.locator('#pk-delay').dispatchEvent('change');
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem('pkbot.settings') ?? ''))
        .toContain('"actionDelayMs":777');
      expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /^(poke_|pkrl_)/.test(k)))).toEqual([]);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await injectUserscript(page, browserName, gm);
      await expect(page.locator('#pk-toggle')).toBeVisible({ timeout: 10_000 });
      await page.locator('summary', { hasText: 'Einstellungen' }).click();
      await page.locator('summary', { hasText: 'Erweitert' }).click();
      await expect(page.locator('#pk-delay')).toHaveValue('777');
    });
  }
});
