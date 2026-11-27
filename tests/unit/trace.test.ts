/** P3b T1 (R-006, prep R-116): decisions carry their options, scores and confidence for the run logs (D-005, D-038). */
import { describe, expect, it } from 'vitest';
import { detectScreen } from '../../src/core/screens/detector';
import { readCards } from '../../src/core/state/dom-reader';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { chooseCatch, chooseItem, chooseStarter, itemValue } from '../../src/core/strategy/choices';
import { decide, newMemory } from '../../src/core/strategy/engine';
import { chooseRoute } from '../../src/core/strategy/map';
import { chooseRouteSim, type SimData } from '../../src/core/strategy/sim-route';
import type { Decision, GameMap, GameState, RunState } from '../../src/core/types';
import { loadFixture, mon } from './helpers';

const trace = (d: Decision) => (d as { trace?: import('../../src/core/types').DecisionTrace }).trace;

const map: GameMap = {
  mapIndex: 0,
  nodes: {
    s: { id: 's', type: 'start', layer: 0, col: 0, visited: true, accessible: false },
    w1: { id: 'w1', type: 'battle', layer: 1, col: 0, visited: false, accessible: true },
    t1: { id: 't1', type: 'trainer', layer: 1, col: 1, visited: false, accessible: true },
    w2: { id: 'w2', type: 'battle', layer: 2, col: 0, visited: false, accessible: false },
    c2: { id: 'c2', type: 'catch', layer: 2, col: 1, visited: false, accessible: false },
    b: { id: 'b', type: 'boss', layer: 3, col: 0, visited: false, accessible: false },
  },
  edges: [
    { from: 's', to: 'w1' },
    { from: 's', to: 't1' },
    { from: 'w1', to: 'w2' },
    { from: 'w1', to: 'c2' },
    { from: 't1', to: 'w2' },
    { from: 't1', to: 'c2' },
    { from: 'w2', to: 'b' },
    { from: 'c2', to: 'b' },
  ],
};
const sim: SimData = {
  nodeRates: { w1: { 0: 1, 4: 1 }, t1: { 0: 0, 4: 0.5, 8: 1 }, w2: { 0: 0.9, 4: 1 } },
  bossNoHeal: { 0: 0, 2: 0.5, 4: 0.9, 6: 1 },
  bossHeal: { 0: 0, 2: 0.6, 4: 1 },
  bossName: 'Brock',
};

const run = (p: Partial<RunState> = {}): RunState => ({
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
const gs = (doc: Document, r: RunState | null, extra: Partial<GameState> = {}): GameState => ({
  screen: detectScreen(doc),
  run: r,
  version: '3.8',
  settings: null,
  bridge: !!r,
  ...extra,
});

describe('choice functions return every option with its score (R-006)', () => {
  const weak = mon({ speciesId: 10, name: 'Caterpie', level: 3 });
  const strong = mon({ speciesId: 4, name: 'Charmander', level: 9, types: ['Fire'] });
  const mid = mon({ speciesId: 16, name: 'Pidgey', level: 6, types: ['Normal', 'Flying'] });

  it('chooseCatch scores each offer and the skip option; the pick is unchanged', () => {
    const before = chooseCatch([weak, strong, mid], [weak], 6);
    expect(before.options).toHaveLength(4);
    expect(before.options!.map((o) => o.id)).toEqual(['catch:0', 'catch:1', 'catch:2', 'catch:skip']);
    for (const o of before.options!.slice(0, 3)) expect(typeof o.score).toBe('number');
    expect(before.options![3]!.score).toBeNull(); // room in the team: skipping has no score to beat
    expect(before.index).toBe(1);
  });

  it('chooseCatch with a full team gives skip the bar to beat (weakest × 1.1)', () => {
    const team = Array.from({ length: 6 }, (_, i) => mon({ speciesId: 20 + i, level: 30 }));
    const c = chooseCatch([weak], team, 6);
    expect(c.index).toBe(-1);
    const skip = c.options!.find((o) => o.id === 'catch:skip')!;
    expect(skip.score).toBeGreaterThan(c.options![0]!.score!);
  });

  it('chooseItem scores every offer with itemValue', () => {
    const c = chooseItem(['lagging-tail', 'expert-belt'], []);
    expect(c.index).toBe(1);
    expect(c.options!.map((o) => [o.id, o.score])).toEqual([
      ['item:0', itemValue('lagging-tail', [])],
      ['item:1', itemValue('expert-belt', [])],
    ]);
  });

  it('chooseStarter scores every starter, also when a preferred one decides', () => {
    expect(chooseStarter([weak, strong]).options!.map((o) => o.id)).toEqual(['starter:0', 'starter:1']);
    const pref = chooseStarter([weak, strong], 10);
    expect(pref.index).toBe(0);
    expect(pref.options).toHaveLength(2);
    expect(typeof pref.options![1]!.score).toBe('number');
  });

  it('chooseRoute lists the best route per accessible first node; the pick has the highest value', () => {
    const ctx = { teamSize: 1, maxTeamSize: 6, hp: 1, nuzlocke: false, weakness: 0.5 };
    const r = chooseRoute(map, ['w1', 't1'], ctx)!;
    expect(r.alternatives!.map((a) => a.nodeId).sort()).toEqual(['t1', 'w1']);
    expect(Math.max(...r.alternatives!.map((a) => a.value))).toBe(r.value);
  });

  it('chooseRouteSim lists the best route per first node with boss/survive/next', () => {
    const r = chooseRouteSim(map, ['w1', 't1'], { teamSize: 1, maxTeamSize: 6, nuzlocke: false }, sim)!;
    expect(r.nodeId).toBe('w1');
    expect(r.alternatives!.map((a) => a.nodeId).sort()).toEqual(['t1', 'w1']);
    const t1 = r.alternatives!.find((a) => a.nodeId === 't1')!;
    expect(t1).toMatchObject({ boss: expect.any(Number), survive: expect.any(Number), next: expect.any(Number) });
    expect(Math.max(...r.alternatives!.map((a) => a.value))).toBe(r.value);
  });
});

describe('the engine attaches the trace to its decisions (R-006)', () => {
  const s = { ...DEFAULT_SETTINGS, reorderTeam: false };

  it('map with simulation: one option per clickable node, chosen node, confidence = boss odds', () => {
    const doc = loadFixture('map');
    const nodes = Array.from(doc.querySelectorAll('#map-screen [data-node-id]'));
    // make two nodes clickable and map them onto the test map
    const ids = ['w1', 't1'];
    nodes.slice(1, 3).forEach((n, i) => {
      n.setAttribute('data-node-id', ids[i]!);
      n.classList.add('map-node--clickable');
    });
    const d = decide(gs(doc, run({ map }), { sim }), doc, s, newMemory());
    expect(d).toMatchObject({ kind: 'click', selector: '.map-node--clickable[data-node-id="w1"]' });
    const t = trace(d)!;
    expect(t.options.map((o) => o.id).sort()).toEqual(['node:t1', 'node:w1']);
    expect(t.chosen).toBe('node:w1');
    expect(typeof t.confidence).toBe('number');
    expect(t.options.find((o) => o.id === 'node:w1')!.factors).toMatchObject({ boss: expect.any(Number) });
  });

  it('map without simulation: options with route values, no confidence', () => {
    const doc = loadFixture('map');
    const nodes = Array.from(doc.querySelectorAll('#map-screen [data-node-id]'));
    ['w1', 't1'].forEach((id, i) => {
      nodes[i + 1]!.setAttribute('data-node-id', id);
      nodes[i + 1]!.classList.add('map-node--clickable');
    });
    const t = trace(decide(gs(doc, run({ map })), doc, s, newMemory()))!;
    expect(t.options).toHaveLength(2);
    expect(t.chosen).toMatch(/^node:/);
    expect(t.confidence).toBeNull();
  });

  it('catch: options per card plus skip, chosen = catch:<index>', () => {
    const doc = loadFixture('catch-en');
    const d = decide(gs(doc, run()), doc, s, newMemory());
    const t = trace(d)!;
    expect(t.options.at(-1)!.id).toBe('catch:skip');
    expect(t.chosen).toBe(`catch:${(d as { index: number }).index}`);
  });

  it('catch with simulation: options from the sim, confidence = boss odds of the chosen option', () => {
    const doc = loadFixture('catch-en');
    const cards = readCards(doc, '#catch-choices .poke-card');
    expect(cards.length).toBeGreaterThan(1);
    const catchSim = [
      { index: -1, current: 0.2, next: 0, value: 0.2 },
      ...cards.map((_, i) => ({ index: i, current: 0.3 + 0.1 * i, next: 0.1, value: 0.3 + 0.1 * i })),
    ];
    const best = cards.length - 1;
    const d = decide(gs(doc, run({ catchOffer: cards }), { catchSim }), doc, s, newMemory());
    expect(d).toMatchObject({ kind: 'click', index: best });
    const t = trace(d)!;
    expect(t.options).toHaveLength(cards.length + 1);
    expect(t.chosen).toBe(`catch:${best}`);
    expect(t.confidence).toBeCloseTo(0.3 + 0.1 * best, 5);
  });

  it('item: options per card, chosen = item:<index>', () => {
    const doc = loadFixture('item');
    const t = trace(decide(gs(doc, run()), doc, s, newMemory()))!;
    expect(t.options.length).toBeGreaterThan(0);
    expect(t.chosen).toBe('item:0');
  });

  it('starter: options per card, chosen = starter:<index>', () => {
    const doc = loadFixture('starter-de');
    const t = trace(decide(gs(doc, null), doc, DEFAULT_SETTINGS, newMemory()))!;
    expect(t.options.length).toBeGreaterThan(1);
    expect(t.chosen).toBe('starter:0');
  });
});

describe('challenge decisions carry their trace too (D-040, R-006)', () => {
  const s = { ...DEFAULT_SETTINGS, mode: 'challenge' as const, reorderTeam: false };

  it('relic pick with simulation: one option per offer plus skip, chosen = relic:<best>, confidence = its value', () => {
    const doc = loadFixture('chal-relic-1');
    const relicSim = {
      baseline: 0.4,
      offers: [
        { id: 'sun_stone', value: 0.45, combat: true },
        { id: 'fire_tera_shard', value: 0.62, combat: true },
        { id: 'fire_gem', value: 0.5, combat: true },
      ],
      replace: [],
    };
    const d = decide(gs(doc, run({ mode: 'challenge' }), { relicSim }), doc, s, newMemory());
    expect(d).toMatchObject({ kind: 'click', index: 1 });
    const t = trace(d)!;
    expect(t.options.map((o) => o.id)).toEqual(['relic:0', 'relic:1', 'relic:2', 'relic:skip']);
    expect(t.options.find((o) => o.id === 'relic:skip')!.score).toBe(0.4);
    expect(t.chosen).toBe('relic:1');
    expect(t.confidence).toBeCloseTo(0.62, 5);
  });

  it('relic pick without simulation: options scored by team synergy', () => {
    const doc = loadFixture('chal-relic-1');
    const t = trace(decide(gs(doc, run({ mode: 'challenge' })), doc, s, newMemory()))!;
    expect(t.options.length).toBeGreaterThanOrEqual(3);
    expect(t.chosen).toMatch(/^relic:\d$/);
  });

  it('PC starter: one option per PC card with its score', () => {
    const doc = loadFixture('chal-starter-pc');
    const cards = doc.querySelectorAll('#starter-choices .dex-card').length;
    const t = trace(decide(gs(doc, null), doc, s, newMemory()))!;
    expect(t.options).toHaveLength(cards);
    expect(t.chosen).toMatch(/^starter:\d+$/);
  });
});
