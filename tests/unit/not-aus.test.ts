/** P3c T1 (R-011, D-039): a pause takes effect at once – no "last" click, key or bridge action after it. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Actor } from '../../src/core/actions/actor';
import { BotController } from '../../src/core/bot';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import type { Platform } from '../../src/platform/types';
import { loadFixture } from './helpers';

const platform: Platform = {
  name: 'userscript',
  storage: { get: async () => undefined, set: async () => undefined },
  copyText: async () => true,
  notify: async () => false,
  registerShortcuts: () => undefined,
  ensureBridge: async () => false,
};

function bot(fixture = 'title') {
  const doc = loadFixture(fixture);
  const b = new BotController(platform, null, doc);
  b.view.settings = {
    ...DEFAULT_SETTINGS,
    mode: 'story', // the title screen is just a convenient click target here
    reorderTeam: false,
    actionDelayMs: 0,
  };
  b.view.status = 'running';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const internals = b as any;
  return { b, doc, internals, click: vi.spyOn(internals.actor as Actor, 'click') };
}

describe('Not-Aus (R-011)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a pause during attachSim stops the tick before the click', async () => {
    const { b, internals, click } = bot();
    vi.spyOn(internals, 'attachSim').mockImplementation(async () => b.pause('paused by user'));
    await b.tick();
    expect(click).not.toHaveBeenCalled();
    expect(internals.failCount).toBe(0);
    expect(b.view.status).toBe('paused');
  });

  it("a pause during the actor's micro delay fires no pointerdown and returns false", async () => {
    const doc = loadFixture('title');
    const btn = doc.querySelector('#btn-history-run')!;
    const seen: string[] = [];
    for (const t of ['pointerover', 'pointerdown', 'click']) btn.addEventListener(t, () => seen.push(t));
    let calls = 0;
    const live = () => ++calls <= 1; // alive for the first check only: the pause comes during the hover delay
    const done = await new Actor({ microDelay: 5 }).click(btn, live);
    expect(done).toBe(false);
    expect(seen).not.toContain('pointerdown');
    expect(seen).not.toContain('click');
  });

  it('a click without a pause still runs completely and returns true', async () => {
    const doc = loadFixture('title');
    const btn = doc.querySelector('#btn-history-run')!;
    const seen: string[] = [];
    for (const t of ['pointerdown', 'pointerup', 'click']) btn.addEventListener(t, () => seen.push(t));
    expect(await new Actor({ microDelay: 5 }).click(btn, () => true)).toBe(true);
    expect(seen).toEqual(['pointerdown', 'pointerup', 'click']);
  });

  it('a pause between two reorder presses sends no second key', async () => {
    const { b, doc, internals } = bot('map');
    let order = 0;
    vi.spyOn(internals, 'teamOrder').mockImplementation(() => `order${order++}`); // every press "works"
    const keys: string[] = [];
    doc.addEventListener('keydown', (e) => {
      keys.push((e as KeyboardEvent).code);
      b.pause('paused by user'); // the user pauses right after the first press
    });
    const st = await b.refresh();
    const ep = internals.epoch;
    await internals.doReorder({ kind: 'reorder', swaps: [1, 2], target: [2, 0, 1], why: 'test' }, st, () => {
      return internals.epoch === ep;
    });
    expect(keys).toEqual(['Digit2']);
  });

  it('an aborted click is no failure and is logged with outcome aborted', async () => {
    const { b, internals, click } = bot();
    click.mockImplementation(async () => {
      b.pause('paused by user'); // the pause arrives while the actor is aiming
      return false;
    });
    await b.tick();
    const run = b.runs.exportBundle().runs[0]!;
    expect(run.decisions[0]!.outcome).toBe('aborted');
    expect(run.summary.counts.noEffect).toBe(0);
    expect(internals.failCount).toBe(0);
  });

  it('step() on a paused bot still performs exactly one action', async () => {
    const { b, click } = bot();
    click.mockImplementation(async (el: Element) => {
      el.remove();
      return true;
    });
    b.pause('paused by user');
    await b.step();
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('Schritt in flight, then Start: the step is abandoned, only one tick acts (review P3c I1)', async () => {
    const { b, internals, click } = bot();
    click.mockImplementation(async (el: Element) => (el.remove(), true));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    vi.spyOn(internals, 'attachSim').mockImplementation(() => gate);
    internals.loopRunning = true; // the loop's own tick is not part of this test
    b.view.status = 'paused';
    const step = b.step(); // the simulation takes long …
    b.start(); // … the user thinks it hangs and presses Start
    release();
    await step;
    expect(click).not.toHaveBeenCalled(); // the step's tick belongs to an older epoch
  });

  it('two quick Schritt clicks run one tick, not two (review P3c I1)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { b, internals, click } = bot();
      click.mockImplementation(async () => true); // the game reacts later than both ticks decide
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      vi.spyOn(internals, 'attachSim').mockImplementation(() => gate);
      b.view.status = 'paused';
      const one = b.step();
      const two = b.step();
      release();
      await vi.advanceTimersByTimeAsync(20_000);
      await Promise.all([one, two]);
      expect(click).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a pause during the effect check is never overwritten by a "failing" pause (review P3c I2)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { b, click } = bot();
      // careful mode (a changed game version): the first failure pauses
      b.view.settings = { ...b.view.settings, knownGameVersion: '0.1' };
      click.mockImplementation(async () => {
        setTimeout(() => b.pause('paused by user'), 100); // the user pauses while the bot waits for the effect
        return true;
      });
      const p = b.tick();
      await vi.advanceTimersByTimeAsync(10_000);
      await p;
      expect(b.view.pauseKind).toBe('user');
      expect(b.view.pauseReason).toBe('paused by user');
    } finally {
      vi.useRealTimers();
    }
  });

  it('an abandoned reorder is logged with outcome aborted; an aborted click is not counted as a click (review P3c M1)', async () => {
    const { b, doc, internals } = bot('map');
    vi.spyOn(internals, 'teamOrder').mockImplementation(() => 'same');
    const st = await b.refresh();
    b.runs.record({ kind: 'click', selector: '#x', why: 'open the run' }, st);
    doc.addEventListener('keydown', () => b.pause('paused by user'));
    const ep = internals.epoch;
    await internals.doReorder(
      { kind: 'reorder', swaps: [1, 2], target: [2, 0, 1], why: 'r' },
      st,
      () => internals.epoch === ep,
    );
    const lines = b.runs.exportBundle().runs[0]!.decisions;
    expect(lines.at(-1)).toMatchObject({ chosen: 'reorder 2,0,1', outcome: 'aborted' });
    const r = b.runs;
    const line = r.record({ kind: 'click', selector: '#y', why: 'x' }, st);
    const before = r.summaries()[0]!.counts.clicks;
    r.setOutcome(line, 'aborted');
    expect(r.summaries()[0]!.counts.clicks).toBe(before - 1);
  });

  it('after a pause, attachSim sends no further simulation requests (review P3c M2)', async () => {
    const doc = loadFixture('map');
    const sent: string[] = [];
    const holder: { bot?: BotController } = {};
    const bridge = {
      async request(cmd: string) {
        sent.push(cmd);
        if (cmd === 'simulateNodes') {
          holder.bot!.pause('paused by user'); // the user pauses during the first simulation
          return { rates: {} };
        }
        if (cmd === 'simulateBoss') return { boss: { name: 'Brock' }, scenarios: [{ boost: 0, winRate: 0.5 }] };
        return { results: [], targetLevel: null };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b = (holder.bot = new BotController(platform, bridge as any, doc));
    b.view.status = 'running';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internals = b as any;
    const map = {
      mapIndex: 0,
      nodes: { n1: { id: 'n1', type: 'battle', layer: 1, col: 0, visited: false, accessible: true } },
      edges: [],
    };
    const st = {
      screen: { kind: 'map', screenId: 'map-screen', overlay: null, overlayId: null, signature: 'm' },
      run: {
        team: [],
        items: [],
        bag: [],
        badges: 0,
        maxTeamSize: 6,
        currentMap: 0,
        eliteIndex: 0,
        nuzlocke: false,
        mode: 'story',
        gen: 1,
        map,
        currentNodeId: null,
        catchOffer: null,
      },
      version: '3.8',
      settings: null,
      bridge: true,
    };
    const ep = internals.epoch;
    await internals.attachSim(st, () => internals.epoch === ep);
    expect(sent).toEqual(['simulateNodes']);
  });
});
