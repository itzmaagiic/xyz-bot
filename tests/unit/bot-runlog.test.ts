/** P3b T4 (R-006, R-009): the BotController feeds the RunRecorder – decisions, outcomes, pauses, errors. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Actor } from '../../src/core/actions/actor';
import { BotController } from '../../src/core/bot';
import { clearNotedErrors, noteError } from '../../src/core/log/note';
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
  b.view.settings = { ...DEFAULT_SETTINGS, reorderTeam: false, actionDelayMs: 0 };
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
    click.mockImplementation(async (el: Element) => el.remove()); // the game reacts: the button goes away
    await b.tick();
    const [run] = b.runs.exportBundle().runs;
    expect(run!.decisions).toHaveLength(1);
    expect(run!.decisions[0]).toMatchObject({ screen: 'title', chosen: 'click #btn-history-run[0]', outcome: 'ok' });
    expect(run!.summary.counts).toMatchObject({ decisions: 1, clicks: 1, noEffect: 0 });
  });

  it('a click without effect is recorded with outcome no-effect', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { b, click } = bot('title');
    click.mockImplementation(async () => undefined); // nothing happens
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
    click.mockImplementation(async (el: Element) => el.remove());
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
});
