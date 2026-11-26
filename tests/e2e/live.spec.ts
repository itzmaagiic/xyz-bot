/**
 * LIVE run against the real https://pokelike.xyz with the unpacked extension loaded.
 *   LIVE=1 [LIVE_MINUTES=5] [LIVE_SAVE_RUNS=1] [PKBOT_SAVE=/path/to/sanitized-save.json] npx playwright test
 * The run logs are exported through the overlay ("Runs exportieren") into PKBOT_OUT/runs-export.json; with
 * LIVE_SAVE_RUNS=1 they also go to runs/ after the secret scan (R-007, R-148, R-210).
 * PKBOT_SAVE (optional) is a localStorage export WITHOUT cloud tokens; it is only loaded into this throwaway
 * browser profile. Never commit it.
 */
import { chromium, expect, test } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PauseKind } from '../../src/core/pause-reason';
import { writeRunDirs } from '../../scripts/runs-lib.mjs';
import { ProgressTracker, type Sample } from './live-progress';
import { STALL_MS, liveVerdict } from './live-verdict';

const EXT = process.env.PKBOT_EXT ?? join(import.meta.dirname, '..', '..', 'dist', 'chrome');
const OUT = process.env.PKBOT_OUT ?? join(import.meta.dirname, '..', '..', 'test-results');
const MINUTES = Number(process.env.LIVE_MINUTES ?? 5);

test('bot plays the real game without getting stuck', async () => {
  const ctx = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: { width: 1440, height: 900 }, // docs/UI.md §1 desktop
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
  if (process.env.LIVE_MODE) await page.locator('#pk-mode').selectOption(process.env.LIVE_MODE);
  if (process.env.LIVE_CHAL) await page.locator('#pk-chalkind').selectOption(process.env.LIVE_CHAL);

  const screens = new Map<string, number>();
  const saveChangesByScreen = new Map<string, number>();
  const start = Date.now();
  const readState = () =>
    page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (0, eval)('typeof state !== "undefined" ? state : null') as any;
      return {
        screen: (window as unknown as { _currentScreenId?: string })._currentScreenId ?? '?',
        // recon (GAME_RECON §10.7): when does the game write its run save? length+checksum only, never the content
        saveSig: (() => {
          const v = localStorage.getItem('poke_current_run') ?? '';
          let h = 0;
          for (let i = 0; i < v.length; i += 7) h = (h * 31 + v.charCodeAt(i)) | 0;
          return `${v.length}:${h}`;
        })(),
        badges: s?.badges ?? 0,
        map: s?.currentMap ?? 0,
        node: s?.currentNode?.id ?? null,
        eliteIndex: s?.eliteIndex ?? 0,
        // species + level only: a change is progress (catch, level up, evolution), HP alone is not
        teamSig: (s?.team ?? [])
          .map((m: { speciesId?: number; id?: number; level: number }) => `${m.speciesId ?? m.id}:${m.level}`)
          .join(','),
        team: (s?.team ?? [])
          .map(
            (m: { name: string; level: number; currentHp: number; maxHp: number }) =>
              `${m.name}${m.level}${m.currentHp <= 0 ? '✝' : m.currentHp < m.maxHp / 3 ? '!' : ''}`,
          )
          .join(' '),
      };
    });
  const first = await readState();
  // recon (GAME_RECON §12.8, R-087/R-094/R-254): record every change of SKIP/CONTINUE in battles with time stamps –
  // attributes, classes, computed pointer-events/opacity and a progress signal (HP texts). Read-only observation.
  await page.evaluate(() => {
    const w = window as unknown as { __pkBattleLog?: unknown[] };
    w.__pkBattleLog = [];
    const t0 = performance.now();
    const snap = (why: string) => {
      const b = (id: string) => {
        const e = document.getElementById(id);
        if (!e) return null;
        const cs = getComputedStyle(e);
        return {
          disabled: (e as HTMLButtonElement).disabled,
          aria: e.getAttribute('aria-disabled'),
          cls: e.className,
          style: e.getAttribute('style'),
          display: cs.display,
          pe: cs.pointerEvents,
          op: cs.opacity,
          text: (e.textContent ?? '').trim().slice(0, 20),
        };
      };
      const active = document.querySelector('div.screen.active')?.id ?? null;
      if (active !== 'battle-screen' && why !== 'screen') return;
      const hp = Array.from(document.querySelectorAll('#battle-screen .hp-text'))
        .map((e) => (e.textContent ?? '').trim())
        .join('|');
      w.__pkBattleLog!.push({
        t: Math.round(performance.now() - t0),
        why,
        active,
        skip: b('btn-auto-battle'),
        cont: b('btn-continue-battle'),
        hp,
      });
    };
    const mo = new MutationObserver((recs) => {
      for (const r of recs) {
        const id = (r.target as Element).id;
        if (id === 'btn-auto-battle' || id === 'btn-continue-battle') snap(`${id}:${r.attributeName ?? r.type}`);
        else if ((r.target as Element).classList?.contains('screen')) snap('screen');
      }
    });
    mo.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class', 'style', 'disabled', 'aria-disabled'],
    });
    setInterval(() => snap('tick'), 1000);
  });
  await page.locator('#pk-toggle').click();

  let last = first;
  const sample = (st: typeof first): Sample => ({
    screen: st.screen,
    node: st.node,
    map: st.map,
    badges: st.badges,
    eliteIndex: st.eliteIndex,
    teamSig: st.teamSig,
  });
  // R-254: progress incl. eliteIndex and team, budgets per screen, and an overtime after LIVE_MINUTES so a hang in
  // the last minutes is judged as well (until the next progress or the screen budget, at most STALL_MS)
  const tracker = new ProgressTracker(Date.now());
  tracker.observe(sample(first), Date.now());
  const endAt = start + MINUTES * 60_000;
  let overtime = false;
  for (;;) {
    await page.waitForTimeout(2000);
    const st = await readState().catch(() => last);
    const now = Date.now();
    screens.set(st.screen, (screens.get(st.screen) ?? 0) + 1);
    const progressed = tracker.observe(sample(st), now);
    if (st.saveSig !== last.saveSig) saveChangesByScreen.set(st.screen, (saveChangesByScreen.get(st.screen) ?? 0) + 1);
    last = st;
    console.log(
      `[live] ${Math.round((now - start) / 1000)}s screen=${st.screen} map=${st.map} node=${st.node} badges=${st.badges} elite=${st.eliteIndex} team=${st.team}`,
    );
    console.log(`[live]    decision: ${await page.locator('#pk-decision').textContent()}`);
    // persistent win/loss counter of the overlay – a champion win can't slip through the 2 s sampling
    const statsRow = await page
      .locator('#pkbot-root')
      .evaluate((h) =>
        Array.from(h.shadowRoot?.querySelectorAll('.kv span') ?? [])
          .map((e) => e.textContent)
          .join('|'),
      )
      .catch(() => '');
    const runsTxt = statsRow.match(/Runs\|([^|]+)/)?.[1];
    if (runsTxt) console.log(`[live]    stats: ${runsTxt}`);
    const status = await page.locator('#pk-toggle').textContent();
    if (status === 'Start') break; // paused → stop observing
    if (tracker.stalledOn(now) || tracker.msSinceProgress(now) > STALL_MS) break; // judged by liveVerdict below
    if (now >= endAt) {
      if (!overtime) {
        overtime = true;
        console.log('[live] time is up – observing until the next progress or the screen budget');
      } else if (progressed || now >= endAt + STALL_MS) break;
    }
  }
  // #pk-pause only exists while paused – never wait for it (a still-running bot is not a failure by itself)
  const pauseEl = page.locator('#pk-pause');
  const paused = (await pauseEl.count()) > 0;
  const pauseReason = paused ? await pauseEl.textContent({ timeout: 2000 }) : null;
  const pauseKind = (paused ? await pauseEl.getAttribute('data-kind', { timeout: 2000 }) : null) as PauseKind | null;
  const running = (await page.locator('#pk-toggle').textContent({ timeout: 2000 })) !== 'Start';
  const endNow = Date.now();
  const progressEvents = tracker.events;
  const verdict = liveVerdict({
    progressEvents,
    pauseKind,
    pauseReason,
    running,
    msSinceProgress: tracker.msSinceProgress(endNow),
    stalled: running ? tracker.stalledOn(endNow) : null,
  });
  const log = await page.evaluate(async () => {
    // overlay log is the source of truth
    const host = document.getElementById('pkbot-root');
    return host?.shadowRoot?.getElementById('pk-log')?.textContent ?? '';
  });
  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    join(OUT, 'live-run.json'),
    JSON.stringify(
      {
        minutes: MINUTES,
        first,
        last,
        progressEvents,
        screens: Object.fromEntries(screens),
        saveChangesByScreen: Object.fromEntries(saveChangesByScreen),
        pauseReason,
        pauseKind,
        running,
        overtime,
        verdict,
      },
      null,
      2,
    ),
  );
  writeFileSync(join(OUT, 'live-run.log'), log);
  const battleLog = await page.evaluate(() => (window as unknown as { __pkBattleLog?: unknown[] }).__pkBattleLog ?? []);
  writeFileSync(join(OUT, 'battle-buttons.json'), JSON.stringify(battleLog, null, 1));
  // R-006/R-007: the structured run logs through the overlay's own export (the same path a user takes)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#pk-export-runs').click()]);
  const bundle = JSON.parse(readFileSync(await dl.path(), 'utf8'));
  writeFileSync(join(OUT, 'runs-export.json'), JSON.stringify(bundle));
  console.log(`[live] run logs: ${bundle.runs.length} runs → ${join(OUT, 'runs-export.json')}`);
  if (process.env.LIVE_SAVE_RUNS === '1') {
    for (const d of writeRunDirs(bundle, join(import.meta.dirname, '..', '..', 'runs')))
      console.log(`[live]    → ${d}`);
  }
  await page.screenshot({ path: join(OUT, 'live-run.png') });
  await ctx.close();
  // R-082/R-190: no progress, an error pause or a hang while running are failures (D-027: 0 hangs)
  expect(verdict, verdict.join(' | ')).toEqual([]);
});
