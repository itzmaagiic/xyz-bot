#!/usr/bin/env node
/**
 * Read-only recon of https://pokelike.xyz (Phase 1, R-067…R-073, R-077; GAME_RECON §10.5/§10.7).
 * Fresh, logged-out browser profile; cloud-save endpoints and trackers are blocked.
 * It only READS lexical globals in the page's main world – it never calls game functions that change
 * state and never writes to the game's storage. The CSP probe sets only `window.__pkCspTest`.
 *
 *   node scripts/recon/read-game.mjs [outDir=artifacts/recon]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? join('artifacts', 'recon');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.route(/googletagmanager|cloudflareinsights|fuseplatform|inmobi|quantcast|doubleclick/, (r) => r.abort());
await ctx.route(/pokelike\.xyz\/(api|sync|save|auth)/, (r) => r.abort());
const page = await ctx.newPage();
const resp = await page.goto('https://pokelike.xyz/', { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(1500);

const headers = resp ? resp.headers() : {};
const facts = await page.evaluate(() => {
  const g = (name) => {
    try {
      return (0, eval)(`typeof ${name} !== "undefined" ? ${name} : undefined`);
    } catch {
      return undefined;
    }
  };
  const src = (name) => {
    const f = g(name);
    return typeof f === 'function' ? String(f).slice(0, 6000) : null;
  };
  // CSP probe: does an injected <script> element execute?
  const s = document.createElement('script');
  s.textContent = 'window.__pkCspTest = 1;';
  document.head.appendChild(s);
  s.remove();
  const scriptElementRuns = window.__pkCspTest === 1;

  const pool = (name) => {
    const p = g(name);
    if (!p) return null;
    const arr = Array.isArray(p) ? p : Object.values(p);
    return arr.map((i) => ({ id: i?.id ?? null, name: i?.name ?? null, desc: i?.desc ?? null }));
  };
  const fnNames = Object.getOwnPropertyNames(window).filter((k) => {
    try {
      return typeof window[k] === 'function' && /^[a-z]/.test(k) && k.length > 3;
    } catch {
      return false;
    }
  });
  const grepNames = (re) => fnNames.filter((n) => re.test(n));
  return {
    version: g('PATCH_NOTES')?.[0]?.version ?? null,
    patchDate: g('PATCH_NOTES')?.[0]?.date ?? null,
    titleVersion: document.querySelector('.title-version')?.textContent?.trim() ?? null,
    metaCsp: Array.from(document.querySelectorAll('meta[http-equiv]')).map((m) => `${m.httpEquiv}=${m.content}`),
    scriptElementRuns,
    stateIsGlobalLexical: g('state') !== undefined && !('state' in window),
    windowGlobals: ['_currentScreenId', 'TYPE_CHART', '__POKEDEX__', 'PATCH_NOTES', 'endlessState'].map((n) => [
      n,
      g(n) !== undefined,
    ]),
    screens: Array.from(document.querySelectorAll('div.screen[id]')).map((d) => d.id),
    settings: typeof g('getSettings') === 'function' ? g('getSettings')() : null,
    itemPool: pool('ITEM_POOL'),
    usablePool: pool('USABLE_ITEM_POOL'),
    passivePool: pool('PASSIVE_ITEM_POOL'),
    fnCount: fnNames.length,
    fnNuzlocke: grepNames(/nuzlocke/i),
    fnShop: grepNames(/shop|mart|buy|price/i),
    fnSave: grepNames(/save|persist|storage/i),
    fnTrait: grepNames(/trait/i),
    fnBoss: grepNames(/boss|preview/i),
    fnStarter: grepNames(/starter/i),
    src: {
      computeTraitTiers: src('computeTraitTiers'),
      getBestMove: src('getBestMove'),
      calcDamage: src('calcDamage'),
      nuzlockeCatchLevel: src('nuzlockeCatchLevel'),
      hasNuzlockeModeWin: src('hasNuzlockeModeWin'),
      doCatchNode: src('doCatchNode'),
      doPokeMartNode: src('doPokeMartNode'),
      buyVitamin: src('buyVitamin'),
      refreshShopBalance: src('refreshShopBalance'),
      saveRun: src('saveRun'),
      bossPreviewMon: src('bossPreviewMon'),
      selectStarter: src('selectStarter'),
    },
  };
});
await browser.close();

const out = {
  fetchedAt: new Date().toISOString(),
  csp: headers['content-security-policy'] ?? null,
  xfo: headers['x-frame-options'] ?? null,
  ...facts,
};
writeFileSync(join(OUT, 'read-game.json'), JSON.stringify(out, null, 2));
console.log(
  JSON.stringify(
    {
      version: out.version,
      patchDate: out.patchDate,
      titleVersion: out.titleVersion,
      csp: out.csp,
      metaCsp: out.metaCsp,
      scriptElementRuns: out.scriptElementRuns,
      stateIsGlobalLexical: out.stateIsGlobalLexical,
      screens: out.screens.length,
      items: [out.itemPool?.length, out.usablePool?.length, out.passivePool?.length],
      fnCount: out.fnCount,
    },
    null,
    1,
  ),
);
