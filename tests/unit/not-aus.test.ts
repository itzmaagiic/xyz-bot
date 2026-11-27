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
  b.view.settings = { ...DEFAULT_SETTINGS, reorderTeam: false, actionDelayMs: 0 };
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
});
