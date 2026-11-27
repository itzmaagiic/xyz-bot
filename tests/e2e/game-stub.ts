/**
 * Offline test harness: serves a real DOM snapshot at https://pokelike.xyz/ plus a tiny stand-in for the game
 * script. Like the real game it declares `state` as a top-level `const` (lexical global, NOT on window) so the
 * bridge's main-world access path is exercised for real.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';

export const FIXTURES = join(import.meta.dirname, '..', 'fixtures', 'dom');

const STUB = `
const state = {
  currentMap: 0, currentNode: { id: 'n0_0' }, badges: 0, eliteIndex: 0, maxTeamSize: 6, nuzlockeMode: false,
  items: [], savedCatch: null,
  team: [{ _uid: 1, speciesId: 1, name: 'Bulbasaur', level: 5, currentHp: 19, maxHp: 19, isShiny: false,
           types: ['Grass','Poison'], baseStats: {hp:45,atk:49,def:49,speed:45,special:65,spdef:65}, heldItem: null, moveTier: 0 }],
  map: { mapIndex: 0, nodes: {
    n0_0: { id:'n0_0', type:'start', layer:0, col:0, visited:true, accessible:false },
    n1_0: { id:'n1_0', type:'catch', layer:1, col:0, visited:false, accessible:true },
    n1_1: { id:'n1_1', type:'battle', layer:1, col:1, visited:false, accessible:true },
    n2_0: { id:'n2_0', type:'boss', layer:2, col:0, visited:false, accessible:false } },
    edges: [{from:'n0_0',to:'n1_0'},{from:'n0_0',to:'n1_1'},{from:'n1_0',to:'n2_0'},{from:'n1_1',to:'n2_0'}] }
};
const PATCH_NOTES = [{ version: '3.8' }];
const TYPE_CHART = { Normal: {} };
let __settings = { autoSkipBattles: false, autoSkipAllBattles: false, autoSkipEvolve: false, darkMode: false };
function getSettings() { return { ...__settings }; }
function saveSettings(s) { __settings = { ...s }; window.__savedSettings = (window.__savedSettings || 0) + 1; }
function getBestMove(types) { return { name: 'Vine Whip', power: 45, type: types[0], isSpecial: false }; }
window._currentScreenId = document.querySelector('.screen.active') && document.querySelector('.screen.active').id;
// the snapshot is from a fresh profile (challenges locked); the bot plays challenges (D-040) → unlock like a real save
(() => { const b = document.getElementById('btn-challenges-run'); if (b) { b.removeAttribute('disabled'); b.classList.remove('title-mode-card--locked'); } })();
window.__clicks = [];
function __show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); window._currentScreenId = id; }
document.addEventListener('click', (e) => {
  const t = e.target.closest && e.target.closest('button,[role=button],.map-node--clickable');
  if (!t) return;
  window.__clicks.push(t.id || t.getAttribute('data-node-id') || t.className);
  if (t.id === 'btn-history-run' || t.id === 'btn-challenges-run') __show('trainer-screen'); // any new screen will do
  if (t.classList && t.classList.contains('map-node--clickable')) { t.classList.remove('map-node--clickable'); }
});
`;

const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export function fixtureHtml(name: string): string {
  const html = readFileSync(join(FIXTURES, `${name}.html`), 'utf8');
  return html.replace('</body>', `<script>${STUB}</script></body>`);
}

/** Serves fixture `name` for the game URL and 404s everything else on that origin (fully offline). */
export async function serveFixture(target: BrowserContext | Page, name: string): Promise<void> {
  await target.route(/^https:\/\/(www\.)?pokelike\.xyz\//, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixtureHtml(name) });
    }
    if (/\.(png|jpe?g|gif|webp)$/i.test(url.pathname))
      return route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL });
    return route.fulfill({ status: 404, body: '' });
  });
  await target.route(/^https:\/\/(?!(www\.)?pokelike\.xyz)/, (route) => route.abort());
}
