import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FLAGS } from '../../src/core/flags';
import {
  chooseCatchSim,
  levelFactor,
  chooseRouteSim,
  evaluatePath,
  rateAt,
  starSwaps,
  type SimData,
} from '../../src/core/strategy/sim-route';
import type { GameMap } from '../../src/core/types';

function permutations(n: number): number[][] {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of permutations(n - 1))
    for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}

function applySwaps(start: number[], swaps: number[]): number[] {
  const a = [...start];
  for (const k of swaps) [a[0], a[k]] = [a[k]!, a[0]!];
  return a;
}

describe('starSwaps (Shift+slot only swaps with the lead)', () => {
  it('reaches every permutation of up to 6 members', () => {
    for (let n = 1; n <= 6; n++) {
      const ident = [...Array(n).keys()];
      for (const target of permutations(n)) {
        const sw = starSwaps(ident, target);
        expect(applySwaps(ident, sw)).toEqual(target);
        expect(sw.every((k) => k >= 1 && k < n)).toBe(true);
        expect(sw.length).toBeLessThanOrEqual(Math.ceil(1.5 * n));
      }
    }
  });
  it('no presses for the identity', () => expect(starSwaps([0, 1, 2], [0, 1, 2])).toEqual([]));
});

describe('rateAt', () => {
  it('interpolates and clamps', () => {
    const t = { 0: 0, 4: 0.8, 8: 1 };
    expect(rateAt(t, 2)).toBeCloseTo(0.4);
    expect(rateAt(t, -1)).toBe(0);
    expect(rateAt(t, 20)).toBe(1);
    expect(rateAt(undefined, 3)).toBe(1);
  });
});

describe('simulation route', () => {
  // start → (wild | trainer) → (wild | pokecenter) → boss
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
  const ctx = { teamSize: 1, maxTeamSize: 6, nuzlocke: false };
  const sim: SimData = {
    nodeRates: { w1: { 0: 1, 4: 1 }, t1: { 0: 0, 4: 0.5, 8: 1 }, w2: { 0: 0.9, 4: 1 } },
    bossNoHeal: { 0: 0, 2: 0.5, 4: 0.9, 6: 1 },
    bossHeal: { 0: 0, 2: 0.6, 4: 1 },
    bossName: 'Brock',
  };

  it('avoids a trainer the team cannot beat (live finding: fireSpitter 0 %)', () => {
    const r = chooseRouteSim(map, ['w1', 't1'], ctx, sim)!;
    expect(r.nodeId).toBe('w1');
  });
  it('two safe wild fights before the boss beat one fight + catch when the boss needs the levels', () => {
    const fights = evaluatePath(['w1', 'w2', 'b'], map, ctx, sim);
    const withCatch = evaluatePath(['w1', 'c2', 'b'], map, ctx, sim);
    expect(fights.boost).toBe(4);
    expect(fights.boss).toBeCloseTo(0.9, 5);
    expect(fights.value).toBeGreaterThan(withCatch.value);
  });
  it('when the boss is already safe, catching wins (future value)', () => {
    const easy: SimData = { ...sim, bossNoHeal: { 0: 1 }, bossHeal: { 0: 1 } };
    const r = chooseRouteSim(map, ['w1'], ctx, easy)!;
    expect(r.path).toContain('c2');
  });
});

describe('catch by simulation', () => {
  const offer = [
    { name: 'Oddish', level: 6 },
    { name: 'Geodude', level: 5 },
  ];
  it('picks the option with the best boss odds', () => {
    const r = chooseCatchSim(
      [
        { index: -1, current: 0.3, next: 0, value: 0.3 },
        { index: 0, current: 0.8, next: 0.2, value: 0.92 },
        { index: 1, current: 0.4, next: 0, value: 0.4 },
      ],
      offer,
      2,
      6,
    );
    expect(r.index).toBe(0);
  });
  // live finding, arena challenge 2026-11-27: every gym at 100 % → no signal → Nuzleaf/Swadloon/Shellos were caught and
  // the team was far too weak for the final league. Saturated odds: the stronger species decides.
  const stats = (bst: number) => ({
    hp: bst / 6,
    atk: bst / 6,
    def: bst / 6,
    speed: bst / 6,
    special: bst / 6,
    spdef: bst / 6,
  });
  const strong = { name: 'Luxray', level: 16, baseStats: stats(523) };
  const weakMon = { name: 'Nuzleaf', level: 17, baseStats: stats(340) };

  it('saturated odds: the strongest species by base stats is caught, not the higher-level weak one', () => {
    const opts = [
      { index: -1, current: 1, next: 1, value: 2 },
      { index: 0, current: 1, next: 1, value: 2 },
      { index: 1, current: 1, next: 1, value: 2 },
    ];
    expect(chooseCatchSim(opts, [weakMon, strong], 3, 6).index).toBe(1);
  });

  it('full team: a clearly stronger species (≥ 15 % base stats over the weakest member) is caught to replace it', () => {
    const opts = [
      { index: -1, current: 1, next: 1, value: 2 },
      { index: 0, current: 1, next: 1, value: 2 },
    ];
    const team = [strong, strong, strong, strong, strong, weakMon];
    expect(chooseCatchSim(opts, [strong], 6, 6, team).index).toBe(0);
    const similar = { name: 'Linoone', level: 16, baseStats: stats(360) };
    expect(chooseCatchSim(opts, [similar], 6, 6, team).index).toBe(-1);
  });

  it('near-tie with room → catch (backup); full team near-tie → skip', () => {
    const opts = [
      { index: -1, current: 0.9, next: 0.5, value: 1.2 },
      { index: 1, current: 0.9, next: 0.48, value: 1.188 },
    ];
    expect(chooseCatchSim(opts, offer, 3, 6).index).toBe(1);
    expect(chooseCatchSim(opts, offer, 6, 6).index).toBe(-1);
  });
});

describe('multiplicative risk value (run success is a product over maps)', () => {
  beforeAll(() => {
    FLAGS.multiplicative = true;
  });
  afterAll(() => {
    FLAGS.multiplicative = false;
  });
  const map: GameMap = {
    mapIndex: 0,
    nodes: {
      a: { id: 'a', type: 'battle', layer: 1, col: 0, visited: false, accessible: true },
      b: { id: 'b', type: 'battle', layer: 1, col: 1, visited: false, accessible: true },
      x: { id: 'x', type: 'boss', layer: 2, col: 0, visited: false, accessible: false },
    },
    edges: [
      { from: 'a', to: 'x' },
      { from: 'b', to: 'x' },
    ],
  };
  const ctx = { teamSize: 4, maxTeamSize: 6, nuzlocke: false };
  const base = { nodeRates: {}, bossNoHeal: {}, bossHeal: {}, bossName: 'X' };
  it('level factor saturates above the target', () => {
    expect(levelFactor(15, 15)).toBeCloseTo(0.6);
    expect(levelFactor(60, 15)).toBe(1.3);
    expect(levelFactor(0, 30)).toBe(0.2);
  });
  it('under the curve a little risk for levels pays off', () => {
    const sim: SimData = {
      ...base,
      targetLevel: 20,
      pathSim: { 'a>x': { success: 1, next: 0, avgLevel: 14 }, 'b>x': { success: 0.95, next: 0, avgLevel: 18 } },
    };
    expect(chooseRouteSim(map, ['a', 'b'], ctx, sim)!.nodeId).toBe('b');
  });
  it('above the curve safety wins', () => {
    const sim: SimData = {
      ...base,
      targetLevel: 20,
      pathSim: { 'a>x': { success: 1, next: 0, avgLevel: 35 }, 'b>x': { success: 0.95, next: 0, avgLevel: 39 } },
    };
    expect(chooseRouteSim(map, ['a', 'b'], ctx, sim)!.nodeId).toBe('a');
  });
});

describe('hopeless chains', () => {
  it('with 0 % everywhere the route that gets furthest into the chain wins', () => {
    const map: GameMap = {
      mapIndex: 8,
      nodes: {
        t: { id: 't', type: 'trainer', layer: 1, col: 0, visited: false, accessible: true },
        c: { id: 'c', type: 'pokecenter', layer: 1, col: 1, visited: false, accessible: true },
        x: { id: 'x', type: 'boss', layer: 2, col: 0, visited: false, accessible: false },
      },
      edges: [
        { from: 't', to: 'x' },
        { from: 'c', to: 'x' },
      ],
    };
    const sim: SimData = {
      nodeRates: {},
      bossNoHeal: {},
      bossHeal: {},
      bossName: 'Lorelei +4',
      pathSim: {
        't>x': { success: 0, next: 0, avgLevel: 0, progress: 0.1 },
        'c>x': { success: 0, next: 0, avgLevel: 0, progress: 0.55 },
      },
    };
    expect(chooseRouteSim(map, ['t', 'c'], { teamSize: 6, maxTeamSize: 6, nuzlocke: false }, sim)!.nodeId).toBe('c');
  });
});

describe('team building (live finding chal6, 2026-11-27)', () => {
  // A strong lead (Mega Mewtwo Y) wins every simulated gym alone at 100 %, so catch nodes need their own value or the
  // team reaches the league with 2–3 members (chal6). The level term only counts the members the route starts with
  // (D-047), so the catch route is one won fight (2 levels) behind – a new member is worth about that much early.
  const map: GameMap = {
    mapIndex: 2,
    nodes: {
      t: { id: 't', type: 'trainer', layer: 1, col: 0, visited: false, accessible: true },
      c: { id: 'c', type: 'catch', layer: 1, col: 1, visited: false, accessible: true },
      l: { id: 'l', type: 'legendary', layer: 1, col: 2, visited: false, accessible: true },
      x: { id: 'x', type: 'boss', layer: 2, col: 0, visited: false, accessible: false },
    },
    edges: [
      { from: 't', to: 'x' },
      { from: 'c', to: 'x' },
      { from: 'l', to: 'x' },
    ],
  };
  const base = { nodeRates: {}, bossNoHeal: {}, bossHeal: {}, bossName: 'Chuck' };
  const sim: SimData = {
    ...base,
    pathSim: {
      't>x': { success: 1, next: 1, avgLevel: 20 },
      'c>x': { success: 1, next: 1, avgLevel: 18 },
    },
  };
  it('a lone carry still takes the catch while the gyms are safe', () => {
    expect(chooseRouteSim(map, ['t', 'c'], { teamSize: 1, maxTeamSize: 6, nuzlocke: false }, sim)!.nodeId).toBe('c');
  });
  it('a legendary node counts as a new member too', () => {
    const s2: SimData = {
      ...base,
      pathSim: { 't>x': { success: 1, next: 1, avgLevel: 20 }, 'l>x': { success: 1, next: 1, avgLevel: 18 } },
    };
    expect(chooseRouteSim(map, ['t', 'l'], { teamSize: 2, maxTeamSize: 6, nuzlocke: false }, s2)!.nodeId).toBe('l');
  });
  it('a new member is worth about one fight, not several: two fights more beat one catch (D-047, chal7)', () => {
    const s3: SimData = {
      ...base,
      pathSim: { 't>x': { success: 1, next: 1, avgLevel: 22 }, 'c>x': { success: 1, next: 1, avgLevel: 18 } },
    };
    expect(chooseRouteSim(map, ['t', 'c'], { teamSize: 2, maxTeamSize: 6, nuzlocke: false }, s3)!.nodeId).toBe('t');
  });
  it('with a full team the catch has no extra value; a risky catch route does not beat a safe one', () => {
    expect(chooseRouteSim(map, ['t', 'c'], { teamSize: 6, maxTeamSize: 6, nuzlocke: false }, sim)!.nodeId).toBe('t');
    const risky: SimData = {
      ...base,
      pathSim: { 't>x': { success: 1, next: 1, avgLevel: 20 }, 'c>x': { success: 0.8, next: 0.8, avgLevel: 18 } },
    };
    expect(chooseRouteSim(map, ['t', 'c'], { teamSize: 1, maxTeamSize: 6, nuzlocke: false }, risky)!.nodeId).toBe('t');
  });
});
