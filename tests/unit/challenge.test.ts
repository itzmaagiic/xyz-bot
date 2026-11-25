import { describe, expect, it } from 'vitest';
import { detectScreen } from '../../src/core/screens/detector';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import {
  choosePcStarter,
  chooseRelic,
  chooseRelicReplace,
  readPcCards,
  readPcRoster,
  readRelicCards,
} from '../../src/core/strategy/challenge';
import { decide, newMemory } from '../../src/core/strategy/engine';
import type { GameState } from '../../src/core/types';
import { loadFixture, mon } from './helpers';

const s = { ...DEFAULT_SETTINGS, mode: 'challenge' as const };
const gs = (doc: Document, extra: Partial<GameState> = {}): GameState => ({
  screen: detectScreen(doc),
  run: null,
  version: '3.8',
  settings: null,
  bridge: true,
  ...extra,
});

describe('challenge screens (real snapshots)', () => {
  it('detects challenge-select and the badge-level screen', () => {
    expect(detectScreen(loadFixture('chal-select')).kind).toBe('challenge-select');
    expect(detectScreen(loadFixture('chal-level')).kind).toBe('challenge-level');
    expect(detectScreen(loadFixture('chal-starter-pc')).kind).toBe('starter');
    expect(detectScreen(loadFixture('chal-relic-0')).kind).toBe('passive');
  });

  it('title → challenges; challenge-select → arena / daily / weekly', () => {
    const title = loadFixture('title');
    expect(decide(gs(title), title, s, newMemory())).toMatchObject({ selector: '#btn-challenges-run' });
    const doc = loadFixture('chal-select');
    expect(decide(gs(doc), doc, s, newMemory())).toMatchObject({ selector: '#chal-intro' });
    expect(decide(gs(doc), doc, { ...s, chalKind: 'daily' }, newMemory())).toMatchObject({ selector: '#chal-daily' });
  });

  it('badge level: auto plays the preselection, explicit level selects first, locked → pause', () => {
    const doc = loadFixture('chal-level');
    expect(decide(gs(doc), doc, s, newMemory())).toMatchObject({ selector: '#weekly-select .gym-play' });
    expect(decide(gs(doc), doc, { ...s, chalLevel: 0 }, newMemory())).toMatchObject({
      selector: '#weekly-select .gym-pick[data-level="0"]',
    });
    expect(decide(gs(doc), doc, { ...s, chalLevel: 6 }, newMemory()).kind).toBe('pause');
  });

  it('PC starter grid is parsed (324 cards, shiny/buff/mega) and the strongest is picked', () => {
    const doc = loadFixture('chal-starter-pc');
    const cards = readPcCards(doc);
    expect(cards.length).toBe(324);
    expect(cards[0]).toMatchObject({ speciesId: 4, shiny: true, buff: 50, mega: true });
    const stats = { 4: { bst: 309, types: ['Fire'] }, 150: { bst: 680, types: ['Psychic'] } };
    const c = choosePcStarter(cards, stats);
    expect(cards[c.index]!.speciesId).toBe(150);
    const d = decide(gs(doc, { pcStats: stats }), doc, s, newMemory());
    expect(d).toMatchObject({ kind: 'click', selector: '#starter-choices .dex-card', index: c.index });
  });

  it('relic cards are read language-independently and matched to the team', () => {
    const cards = readRelicCards(loadFixture('chal-relic-1'));
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((c) => c.starter)).toBe(true);
    expect(cards.some((c) => c.types.length > 0)).toBe(true);
    expect(cards.flatMap((c) => c.types).every((t) => /^[A-Z][a-z]+$/.test(t))).toBe(true);
    const team = [mon({ speciesId: 4, types: ['Fire'] })];
    expect(chooseRelic(cards, team).index).toBeGreaterThanOrEqual(0);
    expect(
      chooseRelic(
        [
          { types: ['Water'], starter: false },
          { types: ['Fire'], starter: false },
        ],
        team,
      ).index,
    ).toBe(1);
    expect(
      chooseRelic(
        [
          { types: ['Water'], starter: false },
          { types: [], starter: false },
        ],
        team,
      ).index,
    ).toBe(1);
  });
});

describe('relic replace', () => {
  const team = [mon({ speciesId: 4, types: ['Fire'] }), mon({ speciesId: 6, types: ['Fire', 'Flying'] })];
  it('drops the least fitting owned relic when the new one fits clearly better', () => {
    const owned = [
      { types: ['Fire'], starter: false },
      { types: ['Water'], starter: false },
    ];
    expect(chooseRelicReplace(owned, { types: ['Flying'], starter: false }, team).index).toBe(1);
  });
  it('skips when the new relic is not better', () => {
    const owned = [
      { types: ['Fire'], starter: false },
      { types: ['Flying'], starter: false },
    ];
    expect(chooseRelicReplace(owned, { types: ['Water'], starter: false }, team).index).toBe(-1);
  });
});

describe('challenge starter pre-selection', () => {
  const save: Record<string, string> = {
    poke_hof_index: JSON.stringify({ evoLineRoots: [4, 150, 129], shinySpecies: [4], auroraSpecies: [] }),
    pkrl_species_list: JSON.stringify([{ name: 'magikarp', id: 129 }]),
    pkrl_poke_4: JSON.stringify({ id: 4, name: 'Charmander', bst: 309 }),
    pkrl_poke_150: JSON.stringify({ id: 150, name: 'Mewtwo', bst: 680 }),
    pkrl_poke_129: 'not json',
  };
  it('reads the PC roster read-only from the save, strongest first', () => {
    const r = readPcRoster((k) => save[k] ?? null);
    expect(r.map((e) => e.id)).toEqual([150, 4, 129]);
    expect(r[1]).toMatchObject({ name: 'Charmander', shiny: true });
    expect(r[2]!.name).toBe('Magikarp');
    expect(readPcRoster(() => null)).toEqual([]);
  });
  it('picks the strongest copy of the chosen species, falls back to auto when missing', () => {
    const cards = [
      { speciesId: 4, shiny: false, aurora: false, buff: 0, mega: false },
      { speciesId: 150, shiny: false, aurora: false, buff: 0, mega: false },
      { speciesId: 4, shiny: true, aurora: false, buff: 50, mega: true },
    ];
    const stats = { 4: { bst: 309, types: ['Fire'] }, 150: { bst: 680, types: ['Psychic'] } };
    expect(choosePcStarter(cards, stats, 4).index).toBe(2);
    expect(choosePcStarter(cards, stats, 999).index).toBe(1);
    const doc = loadFixture('chal-starter-pc');
    const d = decide(gs(doc, { pcStats: stats }), doc, { ...s, chalStarter: 4 }, newMemory());
    expect(d).toMatchObject({ kind: 'click', index: 0 });
  });
});

describe('relic choice by simulation', () => {
  it('takes the relic with the best simulated boss odds, heuristic when sims are flat', () => {
    const doc = loadFixture('chal-relic-1');
    const n = readRelicCards(doc).length;
    const offers = Array.from({ length: n }, (_, i) => ({ id: `r${i}`, value: 0.5, combat: false }));
    offers[n - 1] = { id: 'best', value: 0.8, combat: true };
    const d = decide(gs(doc, { relicSim: { baseline: 0.5, offers, replace: [] } }), doc, s, newMemory());
    expect(d).toMatchObject({ kind: 'click', index: n - 1 });
    const flat = offers.map((o) => ({ ...o, value: 0.5, combat: false }));
    const h = decide(gs(doc, { relicSim: { baseline: 0.5, offers: flat, replace: [] } }), doc, s, newMemory());
    expect(h.kind).toBe('click');
    expect(h.why).not.toMatch(/^sim/);
  });
});
