import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { simBase, visibleKey } from '../../src/core/bridge/sim-seed';

// R-248 / R-239 / R-030: simulation seeds come from the VISIBLE game state only,
// never from the game's hidden RNG (getRngSeed), and are deterministic for the same visible state.
const base = {
  currentMap: 3,
  currentNodeId: 'n4_1',
  isEndlessMode: false,
  team: [
    { speciesId: 7, level: 22, currentHp: 41, maxHp: 60 },
    { speciesId: 25, level: 18, currentHp: 0, maxHp: 44 },
  ],
};

describe('sim-seed (R-248)', () => {
  it('ignores hidden RNG fields: same visible state → same base', () => {
    const a = simBase({ ...base, runSeed: 1, rngSeed: 2 } as never);
    const b = simBase({ ...base, runSeed: 999, rngSeed: 123456 } as never);
    expect(a).toBe(b);
  });

  it('changes when the visible state changes', () => {
    const s0 = simBase(base);
    expect(simBase({ ...base, currentNodeId: 'n4_2' })).not.toBe(s0);
    expect(simBase({ ...base, team: [{ ...base.team[0], level: 23 }, base.team[1]] })).not.toBe(s0);
    expect(simBase({ ...base, team: [{ ...base.team[0], currentHp: 40 }, base.team[1]] })).not.toBe(s0);
  });

  it('is robust against null slots, missing fields and null state', () => {
    for (const s of [{ team: [null, { speciesId: 1 }] }, null, undefined, {}]) {
      const v = simBase(s as never);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(2 ** 32);
    }
    expect(visibleKey({ team: [null] })).toBe(visibleKey({ team: [null] }));
  });

  it('simulator.ts derives seeds only from simBase, getRngSeed() only for save/restore', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'src', 'core', 'bridge', 'simulator.ts'), 'utf8');
    expect(src).not.toMatch(/seedRng\(\(\s*seed0/);
    expect(src).not.toMatch(/getRngSeed\(\)\s*\^/);
    const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l));
    const calls = code.filter((l) => /getRngSeed\(\)/.test(l) && !/declare function/.test(l));
    for (const l of calls) {
      expect(l).toMatch(/const seed0 = getRngSeed\(\);|out\.restored = getRngSeed\(\) === seed0/);
    }
    const derivations = code.filter((l) => /seedRng\(\(/.test(l));
    expect(derivations.length).toBeGreaterThanOrEqual(4);
    for (const l of derivations) expect(l).toMatch(/seedRng\(\(sb \^/);
  });
});
