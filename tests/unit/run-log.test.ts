/** P3b T2 (R-006, R-009, R-091, D-005, D-038): structured run logs, run summaries and ring limits. */
import { describe, expect, it } from 'vitest';
import { RunRecorder, type RecordableDecision, type RunContext } from '../../src/core/log/run-log';
import type { NotedError } from '../../src/core/log/note';
import type { DecisionTrace, GameState, RunState, ScreenKind } from '../../src/core/types';
import { mon } from './helpers';

const D005 = [
  'ts',
  'run_id',
  'step',
  'game_version',
  'screen',
  'state',
  'options',
  'scores',
  'chosen',
  'reason',
  'confidence',
  'profile',
  'mode',
  'outcome',
];

function clock(start = Date.UTC(2026, 10, 26, 20, 15, 30)) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

const ctx = (): RunContext => ({
  profile: { reorderTeam: true, flags: { jointOrder: false } },
  mode: { setting: 'story', region: 1, variant: 'classic' },
});

function run(p: Partial<RunState> = {}): RunState {
  return {
    team: [mon({ speciesId: 1, name: 'Bulbasaur', types: ['Grass', 'Poison'] })],
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
  };
}

function st(kind: ScreenKind, r: RunState | null = run(), extra: Partial<GameState> = {}): GameState {
  return {
    screen: { kind, screenId: `${kind}-screen`, overlay: null, overlayId: null, signature: kind },
    run: r,
    version: '3.8',
    settings: null,
    bridge: true,
    ...extra,
  };
}

const click = (why = 'x', trace?: DecisionTrace): RecordableDecision => ({
  kind: 'click',
  selector: '#a',
  index: 1,
  why,
  trace,
});
const stop = (result: 'win' | 'loss'): RecordableDecision => ({
  kind: 'stop',
  why: result === 'win' ? 'champion' : 'game over',
  result,
});
const rid = (c: { now: () => number }) => {
  const d = new Date(c.now()).toISOString(); // 2026-11-26T20:15:30.000Z
  return `${d.slice(0, 10).replace(/-/g, '')}-${d.slice(11, 19).replace(/:/g, '')}-${Math.floor(0.5 * 36 ** 4).toString(36)}`;
};
const recorder = (c: ReturnType<typeof clock>, o: { maxRuns?: number; maxLines?: number } = {}) =>
  new RunRecorder({ context: ctx, now: c.now, rand: () => 0.5, botVersion: '0.1.0', ...o });
const noted = (where: string, msg: string, count = 1): NotedError => ({ where, msg, count, t: 1, seq: 0 });

describe('RunRecorder: D-005 lines (R-006)', () => {
  it('record opens a run lazily and writes a D-005 line', () => {
    const c = clock();
    const r = recorder(c);
    const t: DecisionTrace = {
      options: [
        { id: 'item:0', label: 'expert_belt', score: 3, factors: { users: 1 } },
        { id: 'item:1', label: 'lagging_tail', score: null },
      ],
      chosen: 'item:0',
      confidence: 0.7,
    };
    const l = r.record(click('take it', t), st('item'));
    expect(Object.keys(l).sort()).toEqual([...D005].sort());
    expect(l.run_id).toBe(rid(c));
    expect(l.ts).toBe('2026-11-26T20:15:30.000Z');
    expect(l.step).toBe(1);
    expect(l.game_version).toBe('3.8');
    expect(l.screen).toBe('item');
    expect(l.options).toEqual([
      { id: 'item:0', label: 'expert_belt' },
      { id: 'item:1', label: 'lagging_tail' },
    ]);
    expect(l.scores).toEqual({ 'item:0': { score: 3, users: 1 }, 'item:1': { score: null } });
    expect(l.chosen).toBe('item:0');
    expect(l.reason).toBe('take it');
    expect(l.confidence).toBe(0.7);
    expect(l.outcome).toBeNull();
    expect(l.profile).toEqual(ctx().profile);
    expect(l.mode).toMatchObject({ setting: 'story', region: 1, variant: 'classic', run: 'story', gen: 1 });
    expect(l.state!.team[0]).toEqual({
      name: 'Bulbasaur',
      level: 10,
      hp: '30/30',
      types: ['Grass', 'Poison'],
      item: null,
    });
    const l2 = r.record(click('y'), st('item'));
    expect(l2.step).toBe(2);
    expect(l2.chosen).toBe('click #a[1]');
    expect(l2.options).toEqual([]);
    expect(l2.confidence).toBeNull();
  });

  it('setOutcome marks a line ok / no-effect and counts no-effect clicks', () => {
    const r = recorder(clock());
    const l = r.record(click(), st('map'));
    r.setOutcome(l, 'no-effect');
    expect(l.outcome).toBe('no-effect');
    expect(r.summaries()[0]!.counts).toMatchObject({ decisions: 1, clicks: 1, noEffect: 1 });
  });

  it('stop closes the run with outcome win/loss; the next record opens a new run_id', () => {
    const c = clock();
    const r = recorder(c);
    r.record(click(), st('map'));
    c.advance(60_000);
    const end = r.record(stop('loss'), st('gameover'));
    expect(end.outcome).toBe('loss');
    c.advance(1_000);
    const next = r.record(click(), st('title', null));
    expect(next.run_id).not.toBe(end.run_id);
    expect(next.step).toBe(1);
    const [first, second] = r.summaries();
    expect(first).toMatchObject({ result: 'loss', durationMs: 60_000 });
    expect(second!.result).toBe('open');
  });

  it('a pause keeps the run open; resuming continues the same run', () => {
    const r = recorder(clock());
    r.record(click(), st('map'));
    r.pause('user', 'paused by user');
    r.record(click(), st('map'));
    r.pause('stalled', 'stalled: no change for 91 s on battle');
    r.record(click(), st('map'));
    const all = r.summaries();
    expect(all).toHaveLength(1);
    expect(all[0]!.pauses.map((p) => p.kind)).toEqual(['user', 'stalled']);
    expect(all[0]!.counts).toMatchObject({ decisions: 3, pauses: 2 });
    expect(all[0]!.result).toBe('open'); // it went on after the error pause
  });

  it('result is aborted when the run ends on an error pause, open after a wanted pause', () => {
    const r = recorder(clock());
    r.record(click(), st('map'));
    r.pause('failing', 'action keeps failing: no effect after clicking #x');
    expect(r.summaries()[0]).toMatchObject({
      result: 'aborted',
      cause: { kind: 'pause', pauseKind: 'failing', reason: 'action keeps failing: no effect after clicking #x' },
    });
    const r2 = recorder(clock());
    r2.record(click(), st('map'));
    r2.pause('user', 'paused by user');
    expect(r2.summaries()[0]).toMatchObject({ result: 'open', cause: { kind: 'pause', pauseKind: 'user' } });
    r2.record(click(), st('map')); // resumed: the pause is history, no cause any more
    expect(r2.summaries()[0]).toMatchObject({ result: 'open', cause: null });
  });

  it('the cause of a loss names the last battle: node type, map, boss from the last map sim, team at the end', () => {
    const c = clock();
    const r = recorder(c);
    const map = {
      mapIndex: 1,
      nodes: { b: { id: 'b', type: 'boss', layer: 5, col: 0, visited: false, accessible: true } },
      edges: [],
    };
    r.record(click(), st('map', run({ currentMap: 1, map })));
    const sim = { nodeRates: {}, bossNoHeal: { 0: 0.4 }, bossHeal: { 0: 0.5 }, bossName: 'Misty' };
    r.observe(st('map', run({ currentMap: 1, map }), { sim }));
    const dead = mon({ speciesId: 1, name: 'Bulbasaur', currentHp: 0, level: 14 });
    r.observe(st('battle', run({ currentMap: 1, map, currentNodeId: 'b', badges: 1, team: [dead] })));
    r.record(stop('loss'), st('gameover', run({ currentMap: 1, badges: 1 })));
    expect(r.summaries()[0]!.cause).toEqual({
      kind: 'loss',
      node: 'boss',
      map: 1,
      boss: 'Misty',
      team: [{ name: 'Bulbasaur', level: 14, hp: '0/30' }],
    });
    expect(r.summaries()[0]!.progress).toMatchObject({ badges: 1, map: 1, maxLevel: 14, teamSize: 1 });
  });

  it('the boss name of the cause also comes from a recorded map decision (the bot attaches the sim after observe)', () => {
    // live finding P3b: observe() runs before attachSim, so only record() sees st.sim – the cause said boss: null
    const r = recorder(clock());
    const map = {
      mapIndex: 2,
      nodes: { b: { id: 'b', type: 'boss', layer: 5, col: 0, visited: false, accessible: true } },
      edges: [],
    };
    const sim = { nodeRates: {}, bossNoHeal: { 0: 0.4 }, bossHeal: { 0: 0.5 }, bossName: 'Misty' };
    r.observe(st('map', run({ currentMap: 2, map }))); // no sim yet
    r.record(click(), st('map', run({ currentMap: 2, map }), { sim }));
    r.observe(st('battle', run({ currentMap: 2, map, currentNodeId: 'b' })));
    r.record(stop('loss'), st('gameover', run({ currentMap: 2 })));
    expect(r.summaries()[0]!.cause).toMatchObject({ kind: 'loss', node: 'boss', boss: 'Misty' });
  });

  it('the boss name is only used for the same map and eliteIndex (Top-4 chain) and never carried into a new run', () => {
    const c = clock();
    const r = recorder(c);
    const map = {
      mapIndex: 8,
      nodes: { b: { id: 'b', type: 'boss', layer: 5, col: 0, visited: false, accessible: true } },
      edges: [],
    };
    const sim = { nodeRates: {}, bossNoHeal: { 0: 0.4 }, bossHeal: { 0: 0.5 }, bossName: 'Lorelei' };
    r.record(click(), st('map', run({ currentMap: 8, map, eliteIndex: 0 }), { sim }));
    // the gauntlet goes on without a map screen: Bruno, Agatha … – Lorelei must not be named for them
    r.observe(st('battle', run({ currentMap: 8, map, currentNodeId: 'b', eliteIndex: 2 })));
    const end = r.record(stop('loss'), st('gameover', run({ currentMap: 8, eliteIndex: 2 })));
    expect(r.summaries()[0]!.cause).toMatchObject({ kind: 'loss', node: 'boss', boss: null });
    expect(end.state!.nextBoss).toBeNull();
    // next run: a boss loss without any (successful) simulation names no boss from the previous run
    c.advance(1_000);
    const m1 = { ...map, mapIndex: 1 };
    r.record(click(), st('map', run({ currentMap: 8, map: m1, eliteIndex: 0 })));
    r.observe(st('battle', run({ currentMap: 8, map: m1, currentNodeId: 'b', eliteIndex: 0 })));
    r.record(stop('loss'), st('gameover', run({ currentMap: 8 })));
    expect(r.summaries()[1]!.cause).toMatchObject({ kind: 'loss', boss: null });
  });

  it('paused time is no dwell time: suspend() closes the current screen until the next observation', () => {
    const c = clock();
    const r = recorder(c);
    r.record(click(), st('map'));
    r.observe(st('map'));
    c.advance(1_000);
    r.suspend(); // the bot pauses on the map
    c.advance(600_000); // the user plays by hand for 10 minutes
    r.observe(st('battle'));
    c.advance(2_000);
    r.observe(st('map'));
    expect(r.summaries()[0]!.screenTimes).toEqual({
      map: { n: 1, totalMs: 1_000, maxMs: 1_000 },
      battle: { n: 1, totalMs: 2_000, maxMs: 2_000 },
    });
  });

  it('a run that ends on a wanted pause names it as the cause (R-009: Abbruchgrund), result stays open', () => {
    const r = recorder(clock());
    r.record(click(), st('map'));
    r.pause('unsupported', 'screen "mystery-screen" is not automated yet');
    expect(r.summaries()[0]).toMatchObject({
      result: 'open',
      cause: { kind: 'pause', pauseKind: 'unsupported', reason: 'screen "mystery-screen" is not automated yet' },
    });
  });

  it('observe accumulates the dwell time per screen kind (n, totalMs, maxMs)', () => {
    const c = clock();
    const r = recorder(c);
    r.record(click(), st('title', null));
    const seq: [ScreenKind, number][] = [
      ['map', 2_000],
      ['battle', 3_000],
      ['battle', 2_000],
      ['map', 1_000],
      ['battle', 1_000],
      ['map', 0],
    ];
    for (const [kind, ms] of seq) {
      r.observe(st(kind));
      c.advance(ms);
    }
    expect(r.summaries()[0]!.screenTimes).toEqual({
      map: { n: 2, totalMs: 3_000, maxMs: 2_000 },
      battle: { n: 2, totalMs: 6_000, maxMs: 5_000 },
    });
  });

  it('counts watchdog re-reads and the option coverage of action decisions', () => {
    const r = recorder(clock());
    r.record(click('a', { options: [{ id: 'x', label: 'x', score: 1 }], chosen: 'x', confidence: null }), st('map'));
    r.record(click('b'), st('map'));
    r.record({ kind: 'pause', why: 'unknown screen', cause: 'unsupported' }, st('unknown'));
    r.count('watchdogRereads');
    const s = r.summaries()[0]!;
    expect(s.counts.watchdogRereads).toBe(1);
    expect(s.optionCoverage).toBe(0.5); // the pause line is no action decision
  });
});

describe('RunRecorder: limits, errors and export (R-091, R-253)', () => {
  it('an 11th run drops the oldest run; line 3001 drops the oldest line and counts dropped', () => {
    const c = clock();
    const r = recorder(c);
    const ids: string[] = [];
    for (let i = 0; i < 11; i++) {
      ids.push(r.record(click(), st('map')).run_id);
      r.record(stop('loss'), st('gameover'));
      c.advance(1_000);
    }
    expect(r.summaries()).toHaveLength(10);
    expect(r.summaries()[0]!.run_id).toBe(ids[1]);
    const r2 = recorder(clock(), { maxLines: 3 });
    for (let i = 0; i < 4; i++) r2.record(click(`d${i}`), st('map'));
    const b = r2.exportBundle().runs[0]!;
    expect(b.decisions.map((l) => l.step)).toEqual([2, 3, 4]);
    expect(b.summary.dropped).toBe(1);
    expect(b.summary.counts.decisions).toBe(4);
  });

  it('errors are deduplicated per world+where+msg, keep the latest count and are capped at 50 per run', () => {
    const r = recorder(clock());
    r.error(noted('sim', 'boom'), 'main'); // before the run: kept for the next run
    r.record(click(), st('map'));
    r.error(noted('sim', 'boom', 3), 'main');
    r.error(noted('sim', 'boom'), 'bot');
    for (let i = 0; i < 60; i++) r.error(noted('x', `e${i}`), 'bot');
    const errs = r.summaries()[0]!.errors;
    expect(errs).toHaveLength(50);
    expect(errs[0]).toMatchObject({ world: 'main', where: 'sim', msg: 'boom', count: 3 });
    expect(errs[1]).toMatchObject({ world: 'bot', where: 'sim', msg: 'boom', count: 1 });
  });

  it('per run, an error counts its own occurrences: a repeat in the next run appears there with count 1', () => {
    const c = clock();
    const r = recorder(c);
    r.record(click(), st('map'));
    r.error({ ...noted('sim', 'fallback', 1), seq: 1 }, 'main');
    r.error({ ...noted('sim', 'fallback', 3), seq: 2 }, 'main'); // the page noted it twice more
    r.record(stop('loss'), st('gameover'));
    c.advance(1_000);
    r.record(click(), st('map'));
    r.error({ ...noted('sim', 'fallback', 4), seq: 3 }, 'main'); // one more time, now in run 2
    r.error({ ...noted('sim', 'fallback', 4), seq: 3 }, 'main'); // the same report delivered twice: no new occurrence
    const [one, two] = r.summaries();
    expect(one!.errors).toEqual([expect.objectContaining({ where: 'sim', count: 3 })]);
    expect(two!.errors).toEqual([expect.objectContaining({ where: 'sim', count: 1 })]);
  });

  it('exportBundle without any run is valid with runs: []', () => {
    const c = clock();
    expect(recorder(c).exportBundle()).toEqual({
      format: 'pkbot-runs/1',
      exported: '2026-11-26T20:15:30.000Z',
      bot_version: '0.1.0',
      runs: [],
    });
  });

  it('the export holds runs oldest first with summary and decisions and nothing from localStorage', () => {
    const c = clock();
    const r = recorder(c);
    r.record(click(), st('map'));
    r.record(stop('win'), st('win'));
    r.record(click(), st('title', null));
    const b = r.exportBundle();
    expect(b.runs.map((x) => x.summary.result)).toEqual(['win', 'open']);
    expect(b.runs[0]!.decisions).toHaveLength(2);
    const text = JSON.stringify(b);
    expect(text).not.toMatch(/poke_|pkrl_|token|username/i);
  });
});
