#!/usr/bin/env node
/* global document -- used inside page.evaluate (browser context) */
/**
 * Renders pages of the unofficial guide https://pokelike-guide.fr (JS-rendered) and stores their visible text
 * in artifacts/recon/guide/*.txt (gitignored: third-party content) plus a small evidence summary
 * (title, headings, length, fetch time) that may be committed. Read-only, R-064.
 *
 *   node scripts/recon/read-guide.mjs [outDir=artifacts/recon/guide]
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.argv[2] ?? join('artifacts', 'recon', 'guide');
const PAGES = ['/en/', '/en/nuzlocke/', '/en/mechanics/', '/en/donnees/', '/en/battle-tower/', '/en/normal/'];
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
const summary = { fetchedAt: new Date().toISOString(), site: 'https://pokelike-guide.fr', pages: [] };
for (const path of PAGES) {
  const url = `https://pokelike-guide.fr${path}`;
  const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 }).catch(() => null);
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => ({
    title: document.title,
    text: document.body?.innerText ?? '',
    headings: Array.from(document.querySelectorAll('h1, h2, h3'))
      .map((h) => h.textContent?.trim() ?? '')
      .filter(Boolean)
      .slice(0, 40),
    tables: document.querySelectorAll('table').length,
  }));
  const file = path.replace(/\//g, '_').replace(/^_|_$/g, '') || 'root';
  writeFileSync(join(OUT, `${file}.txt`), data.text);
  summary.pages.push({
    url,
    status: resp ? resp.status() : null,
    title: data.title,
    textLength: data.text.length,
    tables: data.tables,
    headings: data.headings,
  });
  console.log(`${url} → ${resp ? resp.status() : 'ERR'} · ${data.text.length} chars · ${data.tables} tables`);
}
await browser.close();
writeFileSync(join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
