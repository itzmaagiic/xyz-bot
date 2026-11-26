/** P3b T7 (R-254): progress and per-screen stall budgets of the live test – pure, so it is unit-tested. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BUDGET_MS, ProgressTracker, SCREEN_BUDGET_MS, type Sample } from '../e2e/live-progress';

const base: Sample = { screen: 'map-screen', node: 'n1', map: 0, badges: 0, eliteIndex: 0, teamSig: '1:5' };

describe('ProgressTracker (R-254)', () => {
  it('budgets come from the P3a measurements: battle 120 s, map 180 s, otherwise 90 s', () => {
    expect(SCREEN_BUDGET_MS).toEqual({ 'battle-screen': 120_000, 'map-screen': 180_000 });
    expect(DEFAULT_BUDGET_MS).toBe(90_000);
  });

  it('a change of node, map, badges, eliteIndex or team counts as progress', () => {
    const p = new ProgressTracker(0);
    p.observe(base, 0);
    expect(p.observe({ ...base, node: 'n2' }, 1)).toBe(true);
    expect(p.observe({ ...base, node: 'n2', teamSig: '1:6' }, 2)).toBe(true);
    expect(p.observe({ ...base, node: 'n2', teamSig: '1:6' }, 3)).toBe(false);
    expect(p.events).toBe(2);
  });

  it('A→B→A→B without a tuple change counts only the first visit of each screen (ping-pong guard)', () => {
    const p = new ProgressTracker(0);
    p.observe(base, 0); // map (baseline)
    const seq = ['battle-screen', 'map-screen', 'battle-screen', 'map-screen', 'battle-screen'];
    const got = seq.map((screen, i) => p.observe({ ...base, screen }, (i + 1) * 1000));
    expect(got).toEqual([true, false, false, false, false]);
    expect(p.msSinceProgress(5 * 60_000)).toBe(5 * 60_000 - 1000); // the overall budget still catches the loop
  });

  it('eliteIndex on the same node counts (Top-4 chain)', () => {
    const p = new ProgressTracker(0);
    p.observe({ ...base, screen: 'battle-screen' }, 0);
    expect(p.observe({ ...base, screen: 'battle-screen', eliteIndex: 1 }, 30_000)).toBe(true);
  });

  it('stalledOn: battle after 121 s (not 119 s), map after 181 s, other screens after 91 s', () => {
    const at = (screen: string, ms: number) => {
      const p = new ProgressTracker(0);
      p.observe({ ...base, screen }, 0);
      return p.stalledOn(ms);
    };
    expect(at('battle-screen', 119_000)).toBeNull();
    expect(at('battle-screen', 121_000)).toEqual({ screen: 'battle-screen', ms: 121_000, budget: 120_000 });
    expect(at('map-screen', 179_000)).toBeNull();
    expect(at('map-screen', 181_000)).toMatchObject({ screen: 'map-screen', budget: 180_000 });
    expect(at('catch-screen', 89_000)).toBeNull();
    expect(at('catch-screen', 91_000)).toMatchObject({ screen: 'catch-screen', budget: 90_000 });
  });

  it('the screen clock restarts on progress and on every screen change', () => {
    const p = new ProgressTracker(0);
    p.observe({ ...base, screen: 'battle-screen' }, 0);
    p.observe({ ...base, screen: 'battle-screen', teamSig: '1:6' }, 100_000); // progress inside the fight
    expect(p.stalledOn(200_000)).toBeNull(); // 100 s since the last progress
    p.observe({ ...base, screen: 'map-screen', teamSig: '1:6' }, 200_000);
    expect(p.stalledOn(370_000)).toBeNull(); // 170 s on the map
  });
});
