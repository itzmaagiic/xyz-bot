#!/usr/bin/env node
/* global localStorage -- used inside page.evaluate (browser context) */
/**
 * Recon for D-031 / GAME_RECON §12.9 / §13 Nr. 11: does the game's anti-tamper object `pk` react to the bot's own
 * fallback key `pkbot.*`? Fresh, logged-out throwaway profile; cloud-save endpoints and trackers are blocked.
 * Reads `pk` (lexical global) before and after setting ONE key `pkbot.recon` (never a game key) and after a reload.
 *
 *   node scripts/recon/pk-tamper.mjs [outDir=artifacts/recon]
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

const readPk = () =>
  page.evaluate(() => {
    const pk = (0, eval)('typeof pk !== "undefined" ? pk : null');
    if (!pk) return null;
    const out = { keys: Object.keys(pk).sort() };
    for (const k of out.keys) {
      const v = pk[k];
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v;
    }
    if (typeof pk.keyClass === 'function')
      out.keyClass = { pkbot: pk.keyClass('pkbot.recon'), poke: pk.keyClass('poke_current_run') };
    out.lsKeys = Object.keys(localStorage).sort();
    return out;
  });

await page.goto('https://pokelike.xyz/', { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(1500);
const before = await readPk();
await page.evaluate(() => localStorage.setItem('pkbot.recon', '"1"'));
await page.waitForTimeout(1500);
const afterSet = await readPk();
await page.reload({ waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(1500);
const afterReload = await readPk();
const result = { date: new Date().toISOString(), before, afterSet, afterReload };
writeFileSync(join(OUT, 'pk-tamper.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
