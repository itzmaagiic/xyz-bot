/** Overlay data for the challenge (D-040): which challenge, how far, the next boss and the odds, the team. */
import { describe, expect, it } from 'vitest';
import { runView } from '../../src/core/run-view';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import type { RunState } from '../../src/core/types';
import { mon } from './helpers';

const run = (p: Partial<RunState> = {}): RunState => ({
  team: [mon({ speciesId: 150, name: 'Mewtwo', level: 54, currentHp: 106, maxHp: 267 })],
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
  currentNodeId: null,
  catchOffer: null,
  relics: ['life_orb'],
  challenge: { id: 'intro', badge: 3, stage: 5 },
  ...p,
});

describe('runView (overlay, D-040)', () => {
  it('arena challenge: label with badge level, stage of 9, boss, odds and team HP', () => {
    const v = runView(run(), DEFAULT_SETTINGS, { boss: 'Pryce', odds: 0.87 })!;
    expect(v).toEqual({
      title: 'Arena-Challenge · Stufe 4',
      stage: 5,
      stages: 9,
      boss: 'Pryce',
      odds: 0.87,
      relics: 1,
      team: [{ name: 'Mewtwo', level: 54, hp: 0.4 }],
    });
  });

  it('daily and weekly challenges are named by the setting; no stage known → null', () => {
    const v = runView(
      run({ challenge: { id: 'mega-johto', badge: null, stage: null } }),
      {
        ...DEFAULT_SETTINGS,
        chalKind: 'weekly',
      },
      { boss: null, odds: null },
    )!;
    expect(v.title).toBe('Wochen-Challenge');
    expect(v.stage).toBeNull();
  });

  it('no run (title screen) → null', () => {
    expect(runView(null, DEFAULT_SETTINGS, { boss: null, odds: null })).toBeNull();
  });
});

describe('bot keeps the overlay run view (D-040)', () => {
  it('the last map decision sets boss and odds; the view follows the run state', async () => {
    const { BotController } = await import('../../src/core/bot');
    const { loadFixture } = await import('./helpers');
    const platform = {
      name: 'userscript' as const,
      storage: { get: async () => undefined, set: async () => undefined },
      copyText: async () => true,
      notify: async () => false,
      registerShortcuts: () => undefined,
      ensureBridge: async () => false,
    };
    const bot = new BotController(platform, null, loadFixture('map'));
    const st = {
      screen: { kind: 'map' as const, screenId: 'map-screen', overlay: null, overlayId: null, signature: 'm' },
      run: run(),
      version: '3.8',
      settings: null,
      bridge: true,
      sim: { nodeRates: {}, bossNoHeal: {}, bossHeal: {}, bossName: 'Pryce' },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bot as any).trackRun(st, {
      kind: 'click',
      selector: '#n',
      why: 'route',
      trace: { options: [], chosen: 'node:n', confidence: 0.87 },
    });
    expect(bot.view.run).toMatchObject({ title: 'Arena-Challenge · Stufe 4', stage: 5, boss: 'Pryce', odds: 0.87 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bot as any).trackRun({ ...st, run: null, sim: undefined }, null);
    expect(bot.view.run).toBeNull();
  });
});
