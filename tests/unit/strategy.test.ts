import { afterEach, describe, expect, it } from 'vitest';
import { effectiveness, resetRuntimeTypeChart, setRuntimeTypeChart, FALLBACK_CHART } from '../../src/core/data/typechart';
import {
  chooseCatch,
  chooseItem,
  chooseRelease,
  chooseStarter,
  desiredOrder,
  leadSwap,
} from '../../src/core/strategy/choices';
import { monScore, statAt } from '../../src/core/strategy/evaluate';
import { chooseRoute, nodeValue } from '../../src/core/strategy/map';
import type { GameMap } from '../../src/core/types';
import { mon } from './helpers';

afterEach(() => resetRuntimeTypeChart());

describe('type chart', () => {
  it('basic matchups incl. Fairy and immunities', () => {
    expect(effectiveness('Fire', ['Grass', 'Steel'])).toBe(4);
    expect(effectiveness('Normal', ['Ghost'])).toBe(0);
    expect(effectiveness('Dragon', ['Fairy'])).toBe(0);
    expect(effectiveness('Fairy', ['Dragon'])).toBe(2);
    expect(effectiveness('electric', ['ground'])).toBe(0);
  });
  it('prefers the game chart when it is sane, rejects garbage', () => {
    expect(setRuntimeTypeChart({ Fire: { Grass: 2 } })).toBe(false);
    const custom = JSON.parse(JSON.stringify(FALLBACK_CHART));
    custom.Fire.Grass = 3;
    expect(setRuntimeTypeChart(custom)).toBe(true);
    expect(effectiveness('Fire', ['Grass'])).toBe(3);
  });
});

describe('evaluation', () => {
  it('stat formula', () => {
    expect(statAt(100, 50)).toBe(120);
    expect(statAt(100, 50, true)).toBe(175);
  });
  it('higher level and super-effective moves score higher', () => {
    const a = mon({ speciesId: 1, level: 10 });
    const b = mon({ speciesId: 1, level: 20 });
    expect(monScore(b)).toBeGreaterThan(monScore(a));
    const water = mon({ speciesId: 7, types: ['Water'], move: { name: 'x', power: 60, type: 'Water', isSpecial: true } });
    const grass = mon({ speciesId: 1, types: ['Grass'], move: { name: 'x', power: 60, type: 'Grass', isSpecial: true } });
    expect(monScore(water, ['Rock'])).toBeGreaterThan(monScore(water));
    expect(monScore(water, ['Grass'])).toBeLessThan(monScore(grass, ['Water']) + 1e9);
  });
});

describe('catch / release / items / starter', () => {
  const weak = mon({ speciesId: 10, level: 3, baseStats: { hp: 45, atk: 30, def: 35, speed: 45, special: 20, spdef: 20 } });
  const strong = mon({ speciesId: 74, level: 12, baseStats: { hp: 40, atk: 80, def: 100, speed: 20, special: 30, spdef: 30 } });

  it('takes the best option when the team has room', () => {
    const c = chooseCatch([weak, strong], [weak], 6);
    expect(c.index).toBe(1);
  });
  it('skips when team is full and nothing is clearly better', () => {
    const team = Array.from({ length: 6 }, () => strong);
    expect(chooseCatch([weak], team, 6).index).toBe(-1);
  });
  it('releases the weakest or keeps the team', () => {
    expect(chooseRelease(strong, [strong, weak, strong]).index).toBe(1);
    expect(chooseRelease(weak, [strong, strong]).index).toBe(-1);
  });
  it('items: prefers known strong items, unknown = neutral', () => {
    expect(chooseItem(['lagging-tail', 'expert-belt', 'choice-specs'], []).index).toBe(1);
    expect(chooseItem([null, 'lagging-tail'], []).index).toBe(0);
    const fireUser = mon({ speciesId: 4, types: ['Fire'], move: { name: 'x', power: 40, type: 'Fire', isSpecial: true } });
    expect(chooseItem(['silk-scarf', 'charcoal'], [fireUser]).index).toBe(1);
  });
  it('starter: Kanto picks a counter to Brock/Misty, not the fire type', () => {
    const b = { hp: 45, atk: 49, def: 49, speed: 45, special: 65, spdef: 65 };
    const bulba = mon({ speciesId: 1, level: 5, types: ['Grass', 'Poison'], baseStats: b, move: { name: 'x', power: 40, type: 'Grass', isSpecial: true } });
    const charm = mon({ speciesId: 4, level: 5, types: ['Fire'], baseStats: { hp: 39, atk: 52, def: 43, speed: 65, special: 60, spdef: 50 }, move: { name: 'x', power: 40, type: 'Fire', isSpecial: true } });
    expect(chooseStarter([charm, bulba], null, [['Rock'], ['Water']]).index).toBe(1);
  });
  it('starter: preferred id wins, else strongest', () => {
    expect(chooseStarter([weak, strong], 10).index).toBe(0);
    expect(chooseStarter([weak, strong]).index).toBe(1);
  });
});

describe('team order', () => {
  it('fainted members go last, best matchup leads', () => {
    const fainted = mon({ speciesId: 1, currentHp: 0, level: 50 });
    const ok = mon({ speciesId: 2, level: 10 });
    expect(desiredOrder([fainted, ok])).toEqual([1, 0]);
    expect(leadSwap([fainted, ok])?.from).toBe(1);
  });
  it('no churn for marginal differences', () => {
    const a = mon({ speciesId: 1, level: 10 });
    const b = mon({ speciesId: 2, level: 10, baseStats: { hp: 52, atk: 50, def: 50, speed: 50, special: 50, spdef: 50 } });
    expect(leadSwap([a, b])).toBeNull();
  });
  it('regression (live run): a Lv4 type counter must not lead over a Lv11 starter', () => {
    const charmander = mon({ speciesId: 4, level: 11, types: ['Fire'], baseStats: { hp: 39, atk: 52, def: 43, speed: 65, special: 60, spdef: 50 }, move: { name: 'x', power: 40, type: 'Fire', isSpecial: true } });
    const machop = mon({ speciesId: 66, level: 4, types: ['Fighting'], baseStats: { hp: 70, atk: 80, def: 50, speed: 35, special: 35, spdef: 35 }, move: { name: 'x', power: 40, type: 'Fighting', isSpecial: false } });
    expect(leadSwap([charmander, machop], ['Rock'])).toBeNull();
  });
  it('picks the type counter for the boss', () => {
    const grass = mon({ speciesId: 1, types: ['Grass'], move: { name: 'x', power: 60, type: 'Grass', isSpecial: true } });
    const fire = mon({ speciesId: 4, types: ['Fire'], move: { name: 'x', power: 60, type: 'Fire', isSpecial: true } });
    expect(leadSwap([fire, grass], ['Rock'])?.from).toBe(1);
  });
});

describe('map routing', () => {
  const ctx = { teamSize: 2, maxTeamSize: 6, hp: 1, nuzlocke: false, weakness: 0.5 };
  const map: GameMap = {
    mapIndex: 0,
    nodes: {
      s: { id: 's', type: 'start', layer: 0, col: 0, visited: true, accessible: false },
      a: { id: 'a', type: 'battle', layer: 1, col: 0, visited: false, accessible: true },
      b: { id: 'b', type: 'trade', layer: 1, col: 1, visited: false, accessible: true },
      c: { id: 'c', type: 'catch', layer: 2, col: 0, visited: false, accessible: false },
      d: { id: 'd', type: 'item', layer: 2, col: 1, visited: false, accessible: false },
      boss: { id: 'boss', type: 'boss', layer: 3, col: 0, visited: false, accessible: false },
    },
    edges: [
      { from: 's', to: 'a' },
      { from: 's', to: 'b' },
      { from: 'a', to: 'c' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'boss' },
      { from: 'd', to: 'boss' },
    ],
  };
  it('looks ahead: battle→catch beats trade→item', () => {
    const r = chooseRoute(map, ['a', 'b'], ctx)!;
    expect(r.nodeId).toBe('a');
    expect(r.path).toEqual(['a', 'c', 'boss']);
  });
  it('low HP makes the pokecenter attractive and fights unattractive', () => {
    expect(nodeValue('pokecenter', ctx, 0.3)).toBeGreaterThan(nodeValue('trainer', ctx, 0.3));
    expect(nodeValue('trainer', { ...ctx, nuzlocke: true }, 0.3)).toBeLessThan(0);
  });
  it('returns null without accessible nodes', () => {
    expect(chooseRoute(map, [], ctx)).toBeNull();
  });
});
