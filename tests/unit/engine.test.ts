import { describe, expect, it } from 'vitest';
import { FLAGS } from '../../src/core/flags';
import { detectScreen } from '../../src/core/screens/detector';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/core/settings';
import { parsePokeCard, readCards, speciesFromSprite } from '../../src/core/state/dom-reader';
import { decide, newMemory } from '../../src/core/strategy/engine';
import type { GameState, RunState } from '../../src/core/types';
import { loadFixture, mon } from './helpers';

function gs(doc: Document, run: RunState | null = null): GameState {
  return { screen: detectScreen(doc), run, version: '3.8', settings: null, bridge: !!run };
}

const baseRun = (p: Partial<RunState> = {}): RunState => ({
  team: [mon({ speciesId: 1, types: ['Grass', 'Poison'] })],
  items: [],
  bag: [],
  badges: 0,
  maxTeamSize: 6,
  currentMap: 0,
  eliteIndex: 0,
  nuzlocke: false,
  mode: 'story',
  gen: 1,
  map: null,
  currentNodeId: null,
  catchOffer: null,
  ...p,
});

describe('DOM reader', () => {
  it('parses sprite paths', () => {
    expect(speciesFromSprite('img/sprites/pokemon/72.png')).toEqual({ id: 72, shiny: false });
    expect(speciesFromSprite('img/sprites/pokemon/shiny/32.png')).toEqual({ id: 32, shiny: true });
    expect(speciesFromSprite('img/sprites/items/x.png')).toBeNull();
  });
  it('parses catch cards language-independently (de)', () => {
    const cards = readCards(loadFixture('catch-de'), '#catch-choices .poke-card');
    expect(cards.length).toBe(3);
    for (const c of cards) {
      expect(c.speciesId).toBeGreaterThan(0);
      expect(c.types.length).toBeGreaterThan(0);
      expect(c.level).toBeGreaterThan(0);
    }
  });
  it('parses real type names (not the "type-badge" class) and picks Bulbasaur vs Brock/Misty', () => {
    const cards = readCards(loadFixture('starter-de'), '#starter-choices .poke-card');
    expect(cards.map((c) => c.types)).toEqual([['Grass', 'Poison'], ['Fire'], ['Water']]);
    expect(cards.map((c) => c.move?.type)).toEqual(['Grass', 'Fire', 'Water']);
    const doc = loadFixture('starter-de');
    expect(decide(gs(doc), doc, { ...DEFAULT_SETTINGS, mode: 'story' }, newMemory())).toMatchObject({
      kind: 'click',
      index: 0,
    });
  });
  it('parses the shiny card', () => {
    const m = parsePokeCard(loadFixture('shiny').querySelector('#btn-take-shiny')!)!;
    expect(m.isShiny).toBe(true);
    expect(m.speciesId).toBe(32);
  });
});

describe('DecisionEngine on real snapshots', () => {
  // story flows stay tested although the bot is focused on challenges (D-040)
  const s = { ...DEFAULT_SETTINGS, mode: 'story' as const };
  it('challenge mode on the title screen with challenges still locked → pause with a plain reason (R-227)', () => {
    const doc = loadFixture('title'); // fresh-profile snapshot: TAKE CHALLENGE is locked
    expect(decide(gs(doc), doc, { ...DEFAULT_SETTINGS, mode: 'challenge' }, newMemory())).toMatchObject({
      kind: 'pause',
      cause: 'config',
    });
  });
  it('challenge mode on the title screen → open the challenges', () => {
    const doc = loadFixture('title');
    const b = doc.querySelector('#btn-challenges-run')!;
    b.removeAttribute('disabled');
    b.classList.remove('title-mode-card--locked');
    expect(decide(gs(doc), doc, { ...DEFAULT_SETTINGS, mode: 'challenge' }, newMemory())).toMatchObject({
      kind: 'click',
      selector: '#btn-challenges-run',
    });
  });
  it('title → start story (no resume visible)', () => {
    const d = decide(gs(loadFixture('title')), loadFixture('title'), s, newMemory());
    expect(d).toMatchObject({ kind: 'click', selector: '#btn-history-run' });
  });
  it('region select → classic already selected → region 1', () => {
    const doc = loadFixture('region-select');
    expect(decide(gs(doc), doc, s, newMemory())).toMatchObject({ kind: 'click', index: 0 });
  });
  it('region select → nuzlocke requested → toggles mode first', () => {
    const doc = loadFixture('region-select');
    expect(decide(gs(doc), doc, { ...s, storyVariant: 'nuzlocke' }, newMemory())).toMatchObject({
      selector: '#btn-history-nuzlocke',
    });
  });
  it('locked region → pause instead of guessing', () => {
    const doc = loadFixture('region-select');
    expect(decide(gs(doc), doc, { ...s, region: 2 }, newMemory())).toMatchObject({ kind: 'pause', cause: 'config' });
  });
  it('tutorial overlay is dismissed', () => {
    const doc = loadFixture('map-tutorial');
    expect(decide(gs(doc), doc, s, newMemory())).toMatchObject({ kind: 'click', selector: '#tutorial-overlay' });
  });
  it('move tutor → teaches the best attacker', () => {
    const doc = loadFixture('map-move-tutor');
    const d = decide(gs(doc), doc, s, newMemory());
    expect(d.kind).toBe('click');
    expect((d as { selector: string }).selector).toMatch(/^#item-equip-modal button\[data-tutor="\d"\]$/);
  });
  it('move tutor where every member already knows the move → skip it (live finding, arena challenge 2026-11-27)', () => {
    const doc = loadFixture('map-move-tutor');
    // the game renders "Bereits gemeistert!" rows instead of buttons – no [data-tutor] left in the dialog
    for (const b of Array.from(doc.querySelectorAll('#item-equip-modal [data-tutor]'))) {
      const row = doc.createElement('div');
      row.className = 'equip-mon-row is-mastered';
      row.textContent = 'Mewtu Lv43 – Bereits gemeistert!';
      b.replaceWith(row);
    }
    expect(detectScreen(doc).overlay).toBe('move-tutor');
    expect(decide(gs(doc), doc, s, newMemory())).toMatchObject({ kind: 'click', selector: '#btn-skip-tutor' });
  });
  it('evolution overlay → Skip (evolve), never Stop', () => {
    const doc = loadFixture('map');
    const ov = doc.createElement('div');
    ov.id = 'evo-overlay';
    ov.setAttribute('style', 'display:flex');
    ov.innerHTML =
      '<img id="evo-sprite"><div id="evo-msg">…</div><button class="btn-run-panel btn-primary btn-md evo-skip-btn" data-shortcut="Space">Skip</button><button class="btn-run-panel btn-md evo-stop-btn" data-shortcut="B">Stop</button>';
    doc.body.appendChild(ov);
    const st = gs(doc);
    expect(st.screen.overlay).toBe('evolution');
    expect(decide(st, doc, s, newMemory())).toMatchObject({ kind: 'click', selector: '#evo-overlay .evo-skip-btn' });
  });
  it('usable item (live markup): only clickable rows are targets', () => {
    const doc = loadFixture('map');
    const m = doc.createElement('div');
    m.id = 'usable-item-modal';
    m.className = 'item-equip-overlay';
    m.innerHTML =
      '<div class="item-equip-box"><div class="equip-item-header"><span class="equip-item-icon"><img src="img/sprites/items/rare-candy.png"></span></div><div class="equip-pokemon-list">' +
      '<div class="equip-pokemon-row" data-idx="0" style="opacity:0.45;cursor:default;pointer-events:none;"><img src="img/sprites/pokemon/1.png"></div>' +
      '<div class="equip-pokemon-row" data-idx="1" style="cursor:pointer;"><img src="img/sprites/pokemon/4.png"></div>' +
      '</div><button id="btn-cancel-use">Cancel</button></div>';
    doc.body.appendChild(m);
    const run = baseRun({ team: [mon({ speciesId: 1, level: 30 }), mon({ speciesId: 4, level: 10 })] });
    const st = gs(doc, run);
    expect(st.screen.overlay).toBe('usable-item');
    expect(decide(st, doc, s, newMemory())).toMatchObject({
      kind: 'click',
      selector: '#usable-item-modal .equip-pokemon-row[data-idx="1"]',
    });
  });
  it('equip dialog: nobody should hold it (Mega Stone held) → to the bag, never onto the first member', () => {
    const doc = loadFixture('map');
    const m = doc.createElement('div');
    m.id = 'item-equip-modal';
    m.className = 'item-equip-overlay';
    m.innerHTML =
      '<div class="item-equip-box"><div class="equip-item-header"><span class="equip-item-icon"><img src="img/sprites/items/expert-belt.png"></span></div>' +
      '<button data-idx="0">Mewtwo</button><button id="btn-equip-to-bag">Bag</button></div>';
    doc.body.appendChild(m);
    const team = [mon({ speciesId: 150, name: 'Mega Mewtwo Y', heldItem: 'mewtwonite_y', heldMega: true })];
    const st = gs(doc, baseRun({ team }));
    expect(st.screen.overlay).toBe('item-equip');
    expect(decide(st, doc, s, newMemory())).toMatchObject({ kind: 'click', selector: '#btn-equip-to-bag' });
  });
  it('trade (flag): only a far-behind member is traded, otherwise skip', () => {
    FLAGS.trade = true;
    const doc = loadFixture('trade');
    const n = doc.querySelectorAll('#trade-team-list .trade-member-row').length;
    const team = Array.from({ length: n }, (_, i) => mon({ speciesId: 10 + i, level: 14 }));
    expect(decide(gs(doc, baseRun({ team })), doc, s, newMemory())).toMatchObject({ selector: '#btn-skip-trade' });
    team[2] = mon({ speciesId: 99, level: 4 });
    expect(decide(gs(doc, baseRun({ team })), doc, s, newMemory())).toMatchObject({
      selector: '#trade-team-list .trade-member-row',
      index: 2,
    });
    FLAGS.trade = false;
    expect(decide(gs(doc, baseRun({ team })), doc, s, newMemory())).toMatchObject({ selector: '#btn-skip-trade' });
  });
  it('unknown modal → pause', () => {
    const doc = loadFixture('settings-modal');
    expect(decide(gs(doc), doc, s, newMemory())).toMatchObject({ kind: 'pause', cause: 'unsupported' });
  });
  it('map nodes that do not match the game data → pause with cause inconsistent (R-254)', () => {
    const doc = loadFixture('map');
    const st = gs(doc, baseRun({ map: { mapIndex: 0, nodes: {}, edges: [] } }));
    expect(decide(st, doc, { ...s, reorderTeam: false }, newMemory())).toMatchObject({
      kind: 'pause',
      cause: 'inconsistent',
    });
  });
  it('a screen without automation → pause with cause unsupported and the screen id', () => {
    const doc = loadFixture('title');
    doc.querySelector('div.screen.active')!.id = 'mystery-screen';
    const d = decide(gs(doc), doc, s, newMemory());
    expect(d).toMatchObject({ kind: 'pause', cause: 'unsupported' });
    expect((d as { why: string }).why).toContain('mystery-screen');
  });
  it('map without bridge → first clickable node', () => {
    const doc = loadFixture('map');
    expect(decide(gs(doc), doc, s, newMemory())).toMatchObject({
      kind: 'click',
      selector: '.map-node--clickable[data-node-id="n1_0"]',
    });
  });
  it('catch with room → picks a card', () => {
    const doc = loadFixture('catch-en');
    const d = decide(gs(doc, baseRun()), doc, s, newMemory());
    expect(d).toMatchObject({ kind: 'click', selector: '#catch-choices .poke-card' });
  });
  it('item screen → takes Expert Belt', () => {
    const doc = loadFixture('item');
    expect(decide(gs(doc, baseRun()), doc, s, newMemory())).toMatchObject({ kind: 'click', index: 0 });
  });
  it('"Neues Pokémon!" with room in the team (legendary node): adds the newcomer instead of waiting forever', () => {
    // live finding (arena challenge 2026-11-27): team < 6 → the game lists no team, only the new card + "Team behalten"
    const doc = loadFixture('swap-de');
    for (const c of Array.from(doc.querySelectorAll('#swap-choices .poke-card'))) c.remove();
    const run = baseRun({ team: [mon({ speciesId: 150, level: 49 }), mon({ speciesId: 213, level: 47 })] });
    expect(decide(gs(doc, run), doc, s, newMemory())).toMatchObject({
      kind: 'click',
      selector: '#swap-incoming .poke-card',
    });
  });
  it('swap → releases someone or keeps', () => {
    const doc = loadFixture('swap-de');
    const d = decide(gs(doc), doc, s, newMemory());
    expect(['#swap-choices .poke-card', '#btn-cancel-swap']).toContain((d as { selector: string }).selector);
  });
  it('battle → skip; badge → next map; elite prep → fight; trade → decline; shiny → take', () => {
    for (const [f, sel] of [
      ['battle-wild', '#btn-auto-battle'],
      ['badge', '#btn-next-map'],
      ['elite-prep', '#btn-elite-prep-continue'],
      ['trade', '#btn-skip-trade'],
      ['shiny', '#btn-take-shiny'],
    ] as const) {
      const doc = loadFixture(f);
      expect(decide(gs(doc), doc, { ...s, reorderTeam: false }, newMemory())).toMatchObject({
        kind: 'click',
        selector: sel,
      });
    }
  });
  // P3a (GAME_RECON §12.8): the game disables SKIP after the click while the fight goes on
  it('battle with SKIP pressed (disabled) and no CONTINUE yet → wait, never click the disabled button', () => {
    const doc = loadFixture('battle-gym');
    doc.getElementById('btn-auto-battle')!.setAttribute('disabled', '');
    const d = decide(gs(doc), doc, { ...s, reorderTeam: false }, newMemory());
    expect(d).toMatchObject({ kind: 'wait' });
    expect((d as { why: string }).why).toMatch(/battle running/);
  });
  it('battle end: a usable CONTINUE is clicked even while the disabled SKIP is still in the DOM', () => {
    const doc = loadFixture('battle-gym');
    doc.getElementById('btn-auto-battle')!.setAttribute('disabled', '');
    doc.getElementById('btn-continue-battle')!.setAttribute('style', 'display:block');
    expect(decide(gs(doc), doc, { ...s, reorderTeam: false }, newMemory())).toMatchObject({
      kind: 'click',
      selector: '#btn-continue-battle',
    });
  });
  it('game over → report once, then back to menu', () => {
    const doc = loadFixture('gameover');
    const mem = newMemory();
    expect(decide(gs(doc), doc, s, mem)).toMatchObject({ kind: 'stop', result: 'loss' });
    expect(decide(gs(doc), doc, s, mem)).toMatchObject({ kind: 'click', selector: '#btn-gameover-menu' });
  });
});

describe('settings', () => {
  it('normalizes garbage and clamps', () => {
    const n = normalizeSettings({ region: 99, actionDelayMs: 1, mode: 'x', foo: 1, takeShiny: 'yes' });
    expect(n.region).toBe(6);
    expect(n.actionDelayMs).toBe(150);
    expect(n.mode).toBe('challenge'); // D-040: the mode is fixed to challenge
    expect(n.takeShiny).toBe(true);
    expect('foo' in n).toBe(false);
  });
});
