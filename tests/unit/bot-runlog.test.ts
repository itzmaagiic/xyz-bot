/** P3b T4 (R-006, R-009): the BotController feeds the RunRecorder – decisions, outcomes, pauses, errors. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/core/actions/actor';
import { BotController } from '../../src/core/bot';
import { clearNotedErrors, noteError, recentErrors } from '../../src/core/log/note';
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

function bot(fixture: string) {
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

describe('bot → run log wiring (R-006, R-009)', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a click decision is recorded with outcome ok when the effect is seen', async () => {
    const { b, click } = bot('title');
    click.mockImplementation(async (el: Element) => (el.remove(), true)); // the game reacts: the button goes away
    await b.tick();
    const [run] = b.runs.exportBundle().runs;
    expect(run!.decisions).toHaveLength(1);
    expect(run!.decisions[0]).toMatchObject({ screen: 'title', chosen: 'click #btn-history-run[0]', outcome: 'ok' });
    expect(run!.summary.counts).toMatchObject({ decisions: 1, clicks: 1, noEffect: 0 });
  });

  it('a click without effect is recorded with outcome no-effect', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { b, click } = bot('title');
    click.mockImplementation(async () => true); // pressed, but nothing happens
    const p = b.tick();
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    const [run] = b.runs.exportBundle().runs;
    expect(run!.decisions[0]!.outcome).toBe('no-effect');
    expect(run!.summary.counts.noEffect).toBe(1);
  });

  it('wait decisions are not recorded, but every tick is observed', async () => {
    const { b, doc } = bot('battle-gym');
    doc.getElementById('btn-auto-battle')!.setAttribute('disabled', ''); // fight running → wait
    const observe = vi.spyOn(b.runs, 'observe');
    await b.tick();
    await b.tick();
    expect(observe).toHaveBeenCalledTimes(2);
    expect(b.runs.exportBundle().runs).toEqual([]);
  });

  it('game over: the stop decision closes the run with result loss', async () => {
    const { b, doc, click } = bot('title');
    click.mockImplementation(async (el: Element) => (el.remove(), true));
    await b.tick(); // opens the run
    doc.documentElement.innerHTML = loadFixture('gameover').documentElement.innerHTML; // the run is lost
    await b.tick();
    const [run] = b.runs.summaries();
    expect(run!.result).toBe('loss');
    expect(b.runs.exportBundle().runs[0]!.decisions.at(-1)).toMatchObject({ outcome: 'loss' });
  });

  it('pauses (with kind), watchdog re-reads and noted bot errors land in the open run', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    clearNotedErrors();
    const { b, doc, click } = bot('title');
    click.mockImplementation(async (el: Element) => {
      (el as HTMLButtonElement).disabled = true; // effect seen, and from now on nothing is clickable
      return true;
    });
    b.view.settings = { ...b.view.settings, watchdogSec: 20 };
    await b.tick(); // records the click → run open
    expect(doc.querySelector<HTMLButtonElement>('#btn-history-run')!.disabled).toBe(true);
    noteError('test:where', new Error('boom'));
    for (const t of [10_000, 19_000, 21_000]) {
      vi.setSystemTime(t);
      await b.tick();
    }
    vi.setSystemTime(31_000);
    await b.tick(); // stalled
    const s = b.runs.summaries()[0]!;
    expect(s.counts.watchdogRereads).toBe(1);
    expect(s.pauses.map((p) => p.kind)).toEqual(['stalled']);
    expect(s.result).toBe('aborted');
    expect(s.errors).toContainEqual(expect.objectContaining({ world: 'bot', where: 'test:where', msg: 'boom' }));
  });

  it('an error noted before the bot starts keeps its own time stamp in the log (P2 finding)', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    clearNotedErrors();
    vi.setSystemTime(5_000);
    noteError('early:where', new Error('before start'));
    vi.setSystemTime(90_000);
    const { b } = bot('title');
    expect(b.log.entries().find((e) => e.msg === 'handled: early:where – before start')!.t).toBe(5_000);
  });

  it('pause() suspends the dwell clock: the paused minutes are not counted for the screen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const { b, click } = bot('title');
    click.mockImplementation(async (el: Element) => {
      (el as HTMLButtonElement).disabled = true;
      return true;
    });
    await b.tick(); // run open, screen title observed at t = 0
    vi.setSystemTime(1_000);
    b.pause('paused by user');
    vi.setSystemTime(600_000);
    b.view.status = 'running';
    await b.tick(); // title again – the 10 paused minutes are not title dwell time
    expect(b.runs.summaries()[0]!.screenTimes.title ?? { maxMs: 0 }).toMatchObject({ maxMs: 1_000 });
  });

  it('a repeated bot-world error reaches the run it happens in (count per run)', async () => {
    clearNotedErrors();
    const { b, click } = bot('title');
    click.mockImplementation(async (el: Element) => (el.remove(), true));
    await b.tick(); // run 1 open
    noteError('sim:x', new Error('fallback'));
    b.runs.record({ kind: 'stop', why: 'game over', result: 'loss' }, await b.refresh());
    b.runs.record({ kind: 'click', selector: '#a', why: 'next run' }, await b.refresh());
    noteError('sim:x', new Error('fallback')); // the same error again, in run 2
    const [one, two] = b.runs.summaries();
    expect(one!.errors).toContainEqual(expect.objectContaining({ where: 'sim:x', count: 1 }));
    expect(two!.errors).toContainEqual(expect.objectContaining({ where: 'sim:x', count: 1 }));
  });

  it('a broken run recorder never stops the bot: the error is noted, the tick goes on', async () => {
    clearNotedErrors();
    const { b, click } = bot('title');
    click.mockImplementation(async (el: Element) => (el.remove(), true));
    vi.spyOn(b.runs, 'observe').mockImplementation(() => {
      throw new Error('recorder bug');
    });
    await expect(b.tick()).resolves.toMatchObject({ kind: 'click' });
    expect(b.view.status).toBe('running');
    expect(recentErrors().some((e) => e.where === 'bot:runlog' && e.msg === 'recorder bug')).toBe(true);
  });
});
