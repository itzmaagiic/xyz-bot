/**
 * LIVE run against the real https://pokelike.xyz with the unpacked extension loaded.
 *   LIVE=1 [LIVE_MINUTES=5] [PKBOT_SAVE=/path/to/sanitized-save.json] npx playwright test
 * PKBOT_SAVE (optional) is a localStorage export WITHOUT cloud tokens; it is only loaded into this throwaway
 * browser profile. Never commit it.
 */
import { chromium, expect, test } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EXT = join(import.meta.dirname, '..', '..', 'dist', 'chrome');
const OUT = join(import.meta.dirname, '..', '..', 'test-results');
const MINUTES = Number(process.env.LIVE_MINUTES ?? 5);

test('bot plays the real game without getting stuck', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  await ctx.route(/googletagmanager|cloudflareinsights|fuseplatform|inmobi|quantcast|doubleclick/, (r) => r.abort());
  // safety: never talk to any cloud-save endpoint from the test profile
  await ctx.route(/pokelike\.xyz\/(api|sync|save|auth)/, (r) => r.abort());
  const page = await ctx.newPage();
  const save = process.env.PKBOT_SAVE;
  if (save && existsSync(save)) {
    const data = JSON.parse(readFileSync(save, 'utf8')) as Record<string, string>;
    await page.goto('https://pokelike.xyz/privacy.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((d) => {
      localStorage.clear();
      for (const [k, v] of Object.entries(d)) if (!/token|owner|username|run_sync/.test(k)) localStorage.setItem(k, v);
    }, data);
  }
  await page.goto('https://pokelike.xyz/', { waitUntil: 'domcontentloaded' });
  console.log('[live] page loaded');
  await expect(page.locator('#pk-bridge')).toHaveText(/Bridge/, { timeout: 20_000 });
  console.log('[live] bridge ok');

  // bot settings through the overlay itself
  await page.locator('summary', { hasText: 'Einstellungen' }).click();
  await page.locator('#pk-delay').fill('300');
  await page.locator('#pk-delay').dispatchEvent('change');
  await page.locator('#pk-restart').check();

  const screens = new Map<string, number>();
  const start = Date.now();
  const readState = () =>
    page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (0, eval)('typeof state !== "undefined" ? state : null') as any;
      return {
        screen: (window as unknown as { _currentScreenId?: string })._currentScreenId ?? '?',
        badges: s?.badges ?? 0,
        map: s?.currentMap ?? 0,
        node: s?.currentNode?.id ?? null,
        team: (s?.team ?? []).map((m: { name: string; level: number }) => `${m.name}${m.level}`).join(' '),
      };
    });
  const first = await readState();
  await page.locator('#pk-toggle').click();

  let last = first;
  let progressEvents = 0;
  while (Date.now() - start < MINUTES * 60_000) {
    await page.waitForTimeout(2000);
    const st = await readState().catch(() => last);
    screens.set(st.screen, (screens.get(st.screen) ?? 0) + 1);
    if (st.node !== last.node || st.map !== last.map || st.badges !== last.badges) progressEvents++;
    last = st;
    console.log(`[live] ${Math.round((Date.now() - start) / 1000)}s screen=${st.screen} map=${st.map} node=${st.node} badges=${st.badges} team=${st.team}`);
    console.log(`[live]    decision: ${await page.locator('#pk-decision').textContent()}`);
    const status = await page.locator('#pk-toggle').textContent();
    if (status === 'Start') break; // paused → stop observing
  }
  const pauseReason = (await page.locator('#pk-pause').textContent().catch(() => null)) ?? null;
  const log = await page.evaluate(async () => {
    // overlay log is the source of truth
    const host = document.getElementById('pkbot-root');
    return host?.shadowRoot?.getElementById('pk-log')?.textContent ?? '';
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, 'live-run.json'),
    JSON.stringify({ minutes: MINUTES, first, last, progressEvents, screens: Object.fromEntries(screens), pauseReason }, null, 2),
  );
  writeFileSync(join(OUT, 'live-run.log'), log);
  await page.screenshot({ path: join(OUT, 'live-run.png') });
  await ctx.close();
  expect(progressEvents, `no progress; pause: ${pauseReason}`).toBeGreaterThan(3);
});
