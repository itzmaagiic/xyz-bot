/** Carry build (D-049): one Pokémon carries the run – it gets the levels, the relics that keep it alive and hitting. */
import { describe, expect, it } from 'vitest';
import { carryIndex, carryRelicPriority, carryTypes } from '../../src/core/strategy/carry';
import { mon } from './helpers';

const mmy = mon({ speciesId: 150, name: 'Mega Mewtwo Y', level: 40, types: ['Psychic'], isStarter: true });
const slaking = mon({ speciesId: 289, name: 'Slaking', level: 30, types: ['Normal'], isStarter: true });
const other = mon({ speciesId: 18, name: 'Pidgeot', level: 45, types: ['Normal', 'Flying'] });

describe('carryIndex / carryTypes', () => {
  it('the starter is the carry, even when another member is higher', () => {
    expect(carryIndex([other, slaking])).toBe(1);
    expect(carryTypes([other, slaking])).toEqual(['Normal']);
  });
  it('without a starter flag the highest level carries', () => {
    expect(carryIndex([{ ...slaking, isStarter: false }, other])).toBe(1);
    expect(carryIndex([])).toBe(-1);
  });
});

describe('carryRelicPriority: what keeps the carry alive and hitting (guide: max HP and crit first)', () => {
  it('survival and crit beat plain stat relics; neutral is 0; type relics count only for the carry type', () => {
    expect(carryRelicPriority('sturdy', mmy)).toBeGreaterThan(carryRelicPriority('def_onhit_all', mmy));
    expect(carryRelicPriority('crit_overflow', mmy)).toBeGreaterThan(0);
    expect(carryRelicPriority('power_bracer', mmy)).toBeGreaterThan(0);
    expect(carryRelicPriority('no_item_buff', mmy)).toBeLessThan(0);
    expect(carryRelicPriority('st_psychic_tera', mmy)).toBeGreaterThan(0);
    expect(carryRelicPriority('st_psychic_tera', slaking)).toBe(0);
    expect(carryRelicPriority('normal_recoil', slaking)).toBeGreaterThan(0); // Life Orb: +50 % for Normal
    expect(carryRelicPriority('fight_dmg', mmy)).toBe(0);
    expect(carryRelicPriority(null, mmy)).toBe(0);
    expect(carryRelicPriority('unknown_relic', mmy)).toBe(0);
  });
  it('legendary and shiny relics count when the carry is one', () => {
    expect(carryRelicPriority('legend_dmg', { ...mmy, isShiny: true }, { legendary: true })).toBeGreaterThan(0);
    expect(carryRelicPriority('legend_dmg', slaking)).toBe(0);
    expect(carryRelicPriority('shiny_dmg', { ...slaking, isShiny: true })).toBeGreaterThan(0);
  });
});

import { FLAGS } from '../../src/core/flags';
import { detectScreen } from '../../src/core/screens/detector';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { readRelicCards, relicScore } from '../../src/core/strategy/challenge';
import { decide, newMemory } from '../../src/core/strategy/engine';
import { chooseUsableTarget, chooseEquipHolder } from '../../src/core/strategy/items';
import { chooseCatchSim } from '../../src/core/strategy/sim-route';
import type { GameState, RunState } from '../../src/core/types';
import { loadFixture } from './helpers';

const runOf = (team: RunState['team']): RunState => ({
  team,
  items: [],
  bag: [],
  badges: 0,
  maxTeamSize: 6,
  currentMap: 3,
  eliteIndex: 0,
  nuzlocke: false,
  mode: 'challenge',
  gen: 1,
  map: null,
  currentNodeId: null,
  catchOffer: null,
});
const withCarry = (on: boolean, f: () => void) => {
  const before = FLAGS.carry;
  FLAGS.carry = on;
  try {
    f();
  } finally {
    FLAGS.carry = before;
  }
};

describe('carry build in the decisions (D-049)', () => {
  const s = { ...DEFAULT_SETTINGS, reorderTeam: true };

  it('relic: with flat simulated values the carry takes Focus Sash over Hard Stone', () => {
    const doc = loadFixture('chal-relic-1');
    const cards = readRelicCards(doc);
    const team = [mmy, other];
    // Focus Sash on the card the type heuristic likes least, Hard Stone on the one it likes most
    const syn = cards.map((c) => relicScore(c, team));
    const worst = syn.indexOf(Math.min(...syn));
    const best = syn.indexOf(Math.max(...syn));
    expect(worst).not.toBe(best);
    const ids = cards.map((_, i) => (i === worst ? 'sturdy' : i === best ? 'def_onhit_all' : 'fight_dmg'));
    const offers = ids.map((id) => ({ id, value: 1.6, combat: false }));
    const st: GameState = {
      screen: detectScreen(doc),
      run: runOf(team),
      version: '3.8',
      settings: null,
      bridge: true,
      relicSim: { baseline: 1.6, offers, replace: [] },
    };
    withCarry(true, () => expect(decide(st, doc, s, newMemory())).toMatchObject({ kind: 'click', index: worst }));
  });

  it('catch: near-tie goes to the carry type, even against higher base stats', () => {
    const offer = [
      {
        name: 'Snorlax',
        level: 30,
        types: ['Normal'],
        baseStats: { hp: 160, atk: 110, def: 65, spa: 65, spd: 110, spe: 30 },
      },
      {
        name: 'Kadabra',
        level: 30,
        types: ['Psychic'],
        baseStats: { hp: 40, atk: 35, def: 30, spa: 120, spd: 70, spe: 105 },
      },
    ];
    const opt = (index: number) => ({ index, current: 1, next: 1, value: 1.6 });
    expect(chooseCatchSim([opt(-1), opt(0), opt(1)], offer, 2, 6, [], ['Psychic']).index).toBe(1);
    expect(chooseCatchSim([opt(-1), opt(0), opt(1)], offer, 2, 6, [], []).index).toBe(0);
  });

  it('rare candy, Lucky Egg and the move tutor go to the carry; off, the strongest/lowest gets them', () => {
    const slakoth = mon({ speciesId: 287, name: 'Slakoth', level: 12, types: ['Normal'], isStarter: true });
    const team = [other, slakoth];
    withCarry(true, () => {
      expect(chooseUsableTarget('rare_candy', team, [0, 1])).toMatchObject({ index: 1 });
      expect(chooseUsableTarget('moon_stone', team, [0, 1])).toMatchObject({ index: 1 });
      expect(
        chooseEquipHolder(
          'lucky_egg',
          [
            { ...other, level: 5 },
            { ...slakoth, level: 30 },
          ],
          [0, 1],
        ),
      ).toMatchObject({ index: 1 });
    });
    withCarry(false, () => {
      expect(chooseUsableTarget('rare_candy', team, [0, 1])).toMatchObject({ index: 0 });
      expect(
        chooseEquipHolder(
          'lucky_egg',
          [
            { ...other, level: 5 },
            { ...slakoth, level: 30 },
          ],
          [0, 1],
        ),
      ).toMatchObject({ index: 0 });
    });
  });

  it('move tutor: the carry learns first', () => {
    const doc = loadFixture('map-move-tutor');
    const n = doc.querySelectorAll('#item-equip-modal [data-tutor]:not([disabled])').length;
    if (n < 2) return; // fixture offers a single learner – nothing to choose
    const idx = Array.from(doc.querySelectorAll('#item-equip-modal [data-tutor]:not([disabled])')).map((b) =>
      Number(b.getAttribute('data-tutor')),
    );
    const team = Array.from({ length: Math.max(...idx) + 1 }, (_, i) =>
      mon({ speciesId: 10 + i, level: 50, types: ['Normal'] }),
    );
    const carryAt = idx[idx.length - 1]!;
    team[carryAt] = { ...team[carryAt]!, level: 20, isStarter: true };
    const st: GameState = { screen: detectScreen(doc), run: runOf(team), version: '3.8', settings: null, bridge: true };
    withCarry(true, () =>
      expect(decide(st, doc, s, newMemory())).toMatchObject({
        selector: `#item-equip-modal button[data-tutor="${carryAt}"]`,
      }),
    );
  });
});

describe('lead on the map with the carry build (D-049, chal10b)', () => {
  const s = { ...DEFAULT_SETTINGS, reorderTeam: true };
  const st = (team: RunState['team']): GameState => {
    const doc = loadFixture('map');
    return {
      screen: detectScreen(doc),
      run: { ...runOf(team), map: null },
      version: '3.8',
      settings: null,
      bridge: true,
      // a simulation is available – before, the lead was never corrected then
      sim: { nodeRates: {}, bossNoHeal: {}, bossHeal: {}, bossName: 'X' },
    };
  };
  const strong = mon({ speciesId: 178, name: 'Xatu', level: 40, types: ['Psychic', 'Flying'] });
  const slakoth = mon({ speciesId: 287, name: 'Slakoth', level: 15, types: ['Normal'], isStarter: true });
  it('a weak carry in front gets a stronger shield; the carry is not dragged to the front', () => {
    const doc = loadFixture('map');
    withCarry(true, () => {
      expect(decide(st([slakoth, strong]), doc, s, newMemory())).toMatchObject({ kind: 'swapTeam', from: 1, to: 0 });
      const d = decide(st([strong, slakoth]), doc, s, newMemory());
      expect(d.kind === 'swapTeam' && d.from === 1).toBe(false);
    });
  });
  it('a carry that is the strongest comes back to the front after a boss prep moved someone else there', () => {
    const doc = loadFixture('map');
    const weak = mon({ speciesId: 25, name: 'Pikachu', level: 30, types: ['Electric'] });
    withCarry(true, () =>
      expect(decide(st([weak, { ...mmy, level: 45 }]), doc, s, newMemory())).toMatchObject({
        kind: 'swapTeam',
        from: 1,
        to: 0,
      }),
    );
  });
});

import { choosePcStarter, carryPotential, readPcCards } from '../../src/core/strategy/challenge';

describe('PC starter: the best carry by its final form (D-050)', () => {
  // real base stats (v3.8 dex): Slaking, Mewtwo, Arceus, Snorlax; roots as the PC shows them
  const SLAKING = { hp: 150, atk: 160, def: 100, speed: 100, special: 95, spdef: 65 };
  const MEWTWO = { hp: 106, atk: 110, def: 90, speed: 130, special: 154, spdef: 90 };
  const ARCEUS = { hp: 120, atk: 120, def: 120, speed: 120, special: 120, spdef: 120 };
  const SLAKOTH = { hp: 60, atk: 60, def: 60, speed: 30, special: 35, spdef: 35 };
  const stats = {
    287: {
      bst: 280,
      types: ['Normal'],
      stats: SLAKOTH,
      final: { id: 289, bst: 670, types: ['Normal'], stats: SLAKING },
    },
    150: { bst: 680, types: ['Psychic'], stats: MEWTWO },
    493: { bst: 720, types: ['Normal'], stats: ARCEUS },
  };
  const card = (speciesId: number, o: Partial<{ shiny: boolean; buff: number; mega: boolean }> = {}) => ({
    speciesId,
    shiny: false,
    aurora: false,
    buff: 0,
    mega: false,
    ...o,
  });

  it('an offensive tank in its final form beats a higher base stat total (guide: "Slaking carries a run")', () => {
    expect(carryPotential(SLAKING)).toBeGreaterThan(carryPotential(MEWTWO));
    expect(carryPotential(SLAKING)).toBeGreaterThan(carryPotential(ARCEUS));
    const c = choosePcStarter([card(150), card(493), card(287)], stats);
    expect(c.index).toBe(2);
    expect(c.why).toMatch(/Slakoth|#287/);
    expect(c.why).toMatch(/289|Slaking/);
  });

  it('only what the game shows counts (daily monotype: the PC lists one type) – the best of those', () => {
    const c = choosePcStarter([card(150, { shiny: true, buff: 50, mega: true })], stats);
    expect(c.index).toBe(0);
  });

  it('without final-form data (or evolution forbidden) the current form is judged', () => {
    const noFinal = { ...stats, 287: { bst: 280, types: ['Normal'], stats: SLAKOTH } };
    expect(choosePcStarter([card(150), card(287)], noFinal).index).toBe(0);
  });

  it('shiny, vitamins and a mega stone still lift a carry, and a chosen species is respected', () => {
    expect(choosePcStarter([card(150), card(150, { shiny: true, buff: 50 })], stats).index).toBe(1);
    expect(choosePcStarter([card(287), card(150)], stats, 150).index).toBe(1);
  });

  it('the real PC grid parses and every card gets a score', () => {
    const cards = readPcCards(loadFixture('chal-starter-pc'));
    const c = choosePcStarter(cards, stats);
    expect(c.options).toHaveLength(cards.length);
    expect(cards[c.index]!.speciesId).toBe(287);
  });
});
