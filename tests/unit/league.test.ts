/**
 * Change 2 (D-043): the challenge league is a gauntlet of 5 trainers without healing. The bot must simulate only the
 * members still to fight and pick the lead order by expected progress when a full clear looks out of reach.
 */
import { describe, expect, it } from 'vitest';
import { arenaLeagueSpecs } from '../../src/core/bridge/league';
import { leagueSpecs, remainingGauntlet } from '../../src/core/bridge/simulator';
import { detectScreen } from '../../src/core/screens/detector';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { readRelicCards } from '../../src/core/strategy/challenge';
import { decide, newMemory } from '../../src/core/strategy/engine';
import { chooseCatchSim } from '../../src/core/strategy/sim-route';
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

describe('arenaLeagueSpecs: the league of the arena challenge, built like rollWorldTournamentRegion (D-044)', () => {
  const g = { members: ['lorelei', 'bruno', 'agatha', 'lance'], champion: 'blue' };
  const base = {
    bossLevels: [10, 18, 28, 40, 55, 70, 86, 102, 120],
    levelMult: 1,
    badgeMult: 1,
    bossLevelBonus: 0,
    gauntletBonus: () => 0,
    eliteMod: 0,
  };
  it('arena challenge: Top 4 at 106/112/118/124, champion at 130 with the stronger moves', () => {
    expect(arenaLeagueSpecs(g, base)).toEqual([
      { def: 'lorelei', level: 106, moveTier: 2, champion: false },
      { def: 'bruno', level: 112, moveTier: 2, champion: false },
      { def: 'agatha', level: 118, moveTier: 2, champion: false },
      { def: 'lance', level: 124, moveTier: 2, champion: false },
      { def: 'blue', level: 130, moveTier: 3, champion: true },
    ]);
  });
  it('outside a challenge id there is no +10; badge and level multipliers scale the champion level first', () => {
    expect(arenaLeagueSpecs(g, { ...base, eliteMod: null }).map((x) => x.level)).toEqual([96, 102, 108, 114, 120]);
    expect(arenaLeagueSpecs(g, { ...base, badgeMult: 1.1 }).map((x) => x.level)).toEqual([118, 124, 130, 136, 142]);
    expect(arenaLeagueSpecs(g, { ...base, eliteMod: -20 }).map((x) => x.level)).toEqual([96, 102, 108, 114, 120]);
  });
  it('treat bonuses: boss bonus on the base, gauntlet bonus per place; a known second champion fights last', () => {
    const specs = arenaLeagueSpecs(g, {
      ...base,
      bossLevelBonus: 3,
      gauntletBonus: (i) => Math.round(i * 0.5),
      secondChampion: 'cynthia',
    });
    expect(specs.map((x) => x.level)).toEqual([109, 116, 122, 129, 135, 133]);
    expect(specs[5]).toEqual({ def: 'cynthia', level: 133, moveTier: 3, champion: true });
  });
});

describe('the league decides when every gym looks safe (D-044)', () => {
  const s = { ...DEFAULT_SETTINGS, reorderTeam: true };
  it('catch: with gyms at 100 % for all options, the better league share beats the higher base stats', () => {
    const offer = [
      { name: 'Slaking', level: 40, baseStats: { hp: 150, atk: 160, def: 100, spa: 95, spd: 65, spe: 100 } },
      { name: 'Lucario', level: 40, baseStats: { hp: 70, atk: 110, def: 70, spa: 115, spd: 70, spe: 90 } },
    ];
    const opt = (index: number, league: number) => ({ index, current: 1, next: 1, league, value: 1.6 + 0.25 * league });
    const c = chooseCatchSim([opt(-1, 0.2), opt(0, 0.3), opt(1, 0.7)], offer, 3, 6);
    expect(c.index).toBe(1);
    expect(c.why).toMatch(/league 70 %/);
  });

  it('relic: same gym odds for every card, the card that helps most in the league is taken', () => {
    const doc = loadFixture('chal-relic-1');
    const n = readRelicCards(doc).length;
    const offers = Array.from({ length: n }, (_, i) => ({
      id: `r${i}`,
      value: 1.6 + 0.25 * (i === 1 ? 0.6 : 0.4),
      combat: true,
      league: i === 1 ? 0.6 : 0.4,
    }));
    const st: GameState = {
      screen: detectScreen(doc),
      run: null,
      version: '3.8',
      settings: null,
      bridge: true,
      relicSim: { baseline: 1.7, offers, replace: [], league: 0.4, leagueName: 'Kanto League' },
    };
    const d = decide(st, doc, s, newMemory());
    expect(d).toMatchObject({ kind: 'click', index: 1 });
    expect(d.why).toMatch(/Kanto League: 40 % → 60 % of the fights/);
  });
});

describe('leagueSpecs: reads the game state like rollWorldTournamentRegion, without changing it (D-044)', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const calls: unknown[][] = [];
  const setup = (over: { state?: object; endless?: object; rule7?: boolean } = {}) => {
    calls.length = 0;
    g.state = { isEndlessMode: true, challengeId: 'intro', challengeLevelMult: 1, ...over.state };
    g.endlessState = { wtGauntletPick: 1, wtTrainerPicks: [0, 0, 0, 0, 0, 0, 0, 0], regionNumber: 1, ...over.endless };
    g.WT_GAUNTLETS = [
      { name: 'Kanto League', members: ['a', 'b', 'c', 'd'], champion: 'blue' },
      { name: 'Johto League', members: ['will', 'koga', 'bruno', 'karen'], champion: 'lance' },
    ];
    g.WT_BOSS_LEVELS = [10, 18, 28, 40, 55, 70, 86, 102, 120];
    g.buildWtTrainer = (...a: unknown[]) => {
      calls.push(a);
      return { built: a[0] };
    };
    g.chalBadgeRule = (n: number) => (n === 7 ? !!over.rule7 : false);
    g.chalBadgeBossMult = () => 1;
    g.treatBossLevelBonus = () => 0;
    g.treatGauntletBonus = () => 0;
  };
  const cleanup = () => {
    for (const k of [
      'state',
      'endlessState',
      'WT_GAUNTLETS',
      'WT_BOSS_LEVELS',
      'buildWtTrainer',
      'chalBadgeRule',
      'chalBadgeBossMult',
      'treatBossLevelBonus',
      'treatGauntletBonus',
    ])
      delete g[k];
  };

  it('builds the picked league from the start of the run with the game levels', () => {
    setup();
    try {
      const r = leagueSpecs();
      expect(r?.name).toBe('Johto League');
      expect(calls).toEqual([
        ['will', 106, 2],
        ['koga', 112, 2],
        ['bruno', 118, 2],
        ['karen', 124, 2],
        ['lance', 130, 3],
      ]);
    } finally {
      cleanup();
    }
  });

  it('in the last region the real league of the map is used as is', () => {
    const real = { archetype: { name: 'Johto League' }, gauntlet: [{ x: 1 }, { x: 2 }] };
    setup({ endless: { regionNumber: 3, currentRegion: { trainers: [{}, {}, real] } } });
    try {
      expect(leagueSpecs()).toEqual({ name: 'Johto League', specs: real.gauntlet });
      expect(calls).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it('second champion only once the game picked it; nothing outside the tournament; the state stays untouched', () => {
    setup({ rule7: true });
    try {
      leagueSpecs();
      expect(calls).toHaveLength(5); // rule 7 but no pick yet: the bot never rolls it
      const es = g.endlessState as Record<string, unknown>;
      expect(es.wtSecondChampPick).toBeUndefined();
      es.wtSecondChampPick = 0;
      leagueSpecs();
      expect(calls.at(-1)).toEqual(['blue', 130, 3]);
    } finally {
      cleanup();
    }
    setup({ endless: { wtTrainerPicks: undefined } });
    try {
      expect(leagueSpecs()).toBeNull();
    } finally {
      cleanup();
    }
  });
});
