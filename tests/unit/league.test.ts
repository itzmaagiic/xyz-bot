/**
 * Change 2 (D-043): the challenge league is a gauntlet of 5 trainers without healing. The bot must simulate only the
 * members still to fight and pick the lead order by expected progress when a full clear looks out of reach.
 */
import { describe, expect, it } from 'vitest';
import { remainingGauntlet } from '../../src/core/bridge/simulator';
import { detectScreen } from '../../src/core/screens/detector';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { decide, newMemory } from '../../src/core/strategy/engine';
import type { GameState, RunState } from '../../src/core/types';
import { loadFixture, mon } from './helpers';

describe('remainingGauntlet: league members still to fight (state._erGauntlet)', () => {
  const league = ['e1', 'e2', 'e3', 'e4', 'champ'];
  it('starts at the member the game is on (idx set before each fight)', () => {
    expect(remainingGauntlet(league, { nodeId: 'k', idx: 4 }, 0, 'k')).toEqual(['champ']);
    expect(remainingGauntlet(league, { nodeId: 'k', idx: 2 }, 0, 'k')).toEqual(['e3', 'e4', 'champ']);
  });
  it('whole league before it starts, for a look-ahead, or when the progress belongs to another node', () => {
    expect(remainingGauntlet(league, null, 0, 'k')).toEqual(league);
    expect(remainingGauntlet(league, { nodeId: 'k', idx: 3 }, 1, 'k')).toEqual(league);
    expect(remainingGauntlet(league, { nodeId: 'old', idx: 3 }, 0, 'k')).toEqual(league);
  });
  it('without a key to compare (older game) it trusts idx; nonsense idx is ignored or clamped', () => {
    expect(remainingGauntlet(league, { idx: 1 }, 0, null)).toEqual(league.slice(1));
    expect(remainingGauntlet(league, { nodeId: 'k', idx: 'x' }, 0, 'k')).toEqual(league);
    expect(remainingGauntlet(league, { nodeId: 'k', idx: 9 }, 0, 'k')).toEqual(['champ']);
    expect(remainingGauntlet(league, { nodeId: 'k', idx: -2 }, 0, 'k')).toEqual(league);
  });
});

describe('elite prep: lead order by win chance, then by expected progress (D-043)', () => {
  const s = { ...DEFAULT_SETTINGS, reorderTeam: true };
  const run: RunState = {
    team: [
      mon({ speciesId: 150, name: 'Mewtwo', level: 109, currentHp: 58, maxHp: 525 }),
      mon({ speciesId: 289, name: 'Slaking', level: 99 }),
      mon({ speciesId: 381, name: 'Latios', level: 101 }),
    ],
    items: [],
    bag: [],
    badges: 0,
    maxTeamSize: 6,
    currentMap: 7,
    eliteIndex: 0,
    nuzlocke: false,
    mode: 'challenge',
    gen: 1,
    map: null,
    currentNodeId: 'n8_0',
    catchOffer: null,
  };
  const gs = (orderSim: GameState['orderSim']): GameState => {
    const doc = loadFixture('elite-prep');
    return { screen: detectScreen(doc), run, version: '3.8', settings: null, bridge: true, orderSim };
  };
  const doc = loadFixture('elite-prep');

  it('no order wins the whole rest, but one gets clearly further → reorder (lead with a healthy member)', () => {
    const d = decide(
      gs([
        { order: [0, 1, 2], winRate: 0, avgAlive: 0, progress: 0.2 },
        { order: [1, 0, 2], winRate: 0, avgAlive: 0.4, progress: 0.6 },
      ]),
      doc,
      s,
      newMemory(),
    );
    expect(d).toMatchObject({ kind: 'reorder', target: [1, 0, 2] });
  });

  it('a better win chance still comes first, even with less progress on average', () => {
    const d = decide(
      gs([
        { order: [0, 1, 2], winRate: 0.1, avgAlive: 1, progress: 0.9 },
        { order: [2, 1, 0], winRate: 0.3, avgAlive: 1, progress: 0.5 },
      ]),
      doc,
      s,
      newMemory(),
    );
    expect(d).toMatchObject({ kind: 'reorder', target: [2, 1, 0] });
  });

  it('noise-sized differences do not reorder; the fight starts and says how far the sim gets', () => {
    const d = decide(
      gs([
        { order: [0, 1, 2], winRate: 0, avgAlive: 0, progress: 0.6 },
        { order: [1, 0, 2], winRate: 0, avgAlive: 0, progress: 0.62 },
      ]),
      doc,
      s,
      newMemory(),
    );
    expect(d).toMatchObject({ kind: 'click', selector: '#btn-elite-prep-continue' });
    expect(d.why).toMatch(/60 %/);
  });
});
