/** P3b T5 (R-253): errors noted in the page's main world reach the bot log (muted) and the run logs. */
import { afterEach, describe, expect, it } from 'vitest';
import { BotController } from '../../src/core/bot';
import type { BridgeClient } from '../../src/core/bridge/client';
import { handle } from '../../src/core/bridge/page-bridge';
import { clearNotedErrors, noteError, noteSeq, type NotedError } from '../../src/core/log/note';
import { StateReader } from '../../src/core/state/reader';
import type { Platform } from '../../src/platform/types';
import { loadFixture } from './helpers';

const err = (seq: number, where = 'sim', msg = 'boom', t = 1_000): NotedError => ({ where, msg, count: 1, t, seq });

/** A fake bridge whose page world has noted `page` errors so far. */
function fakeBridge(page: NotedError[]) {
  const calls: { cmd: string; args?: Record<string, unknown> }[] = [];
  const bridge = {
    page,
    calls,
    async request(cmd: string, args?: Record<string, unknown>) {
      calls.push({ cmd, args });
      if (cmd === 'snapshot')
        return {
          ok: true,
          version: '3.8',
          screenId: null,
          run: null,
          settings: null,
          typeChart: null,
          errSeq: page.length,
        };
      if (cmd === 'errors') {
        const since = Number(args?.since ?? 0);
        return { seq: page.length, errors: page.filter((e) => e.seq > since) };
      }
      throw new Error(`unexpected ${cmd}`);
    },
  };
  return bridge;
}
const asClient = (b: ReturnType<typeof fakeBridge>) => b as unknown as BridgeClient;
const flush = () => new Promise((r) => setTimeout(r, 0));
const errorCalls = (b: ReturnType<typeof fakeBridge>) => b.calls.filter((c) => c.cmd === 'errors');

const platform: Platform = {
  name: 'userscript',
  storage: { get: async () => undefined, set: async () => undefined },
  copyText: async () => true,
  notify: async () => false,
  registerShortcuts: () => undefined,
  ensureBridge: async () => true,
};

describe('page-world errors (R-253)', () => {
  afterEach(() => clearNotedErrors());

  it('the reader fetches new page errors only when errSeq grows', async () => {
    const b = fakeBridge([]);
    const reader = new StateReader(asClient(b), loadFixture('title'));
    const got: NotedError[] = [];
    reader.onPageErrors((errs) => got.push(...errs));
    await reader.read();
    await flush();
    expect(errorCalls(b)).toHaveLength(0);
    b.page.push(err(1), err(2, 'snapshot', 'x'));
    await reader.read();
    await flush();
    expect(errorCalls(b)).toEqual([{ cmd: 'errors', args: { since: 0 } }]);
    expect(got.map((e) => e.seq)).toEqual([1, 2]);
    await reader.read();
    await flush();
    expect(errorCalls(b)).toHaveLength(1);
  });

  it('a bridge restart (errSeq smaller than before, page reloaded) fetches again from 0', async () => {
    const b = fakeBridge([err(1), err(2)]);
    const reader = new StateReader(asClient(b), loadFixture('title'));
    const got: NotedError[] = [];
    reader.onPageErrors((errs) => got.push(...errs));
    await reader.read();
    await flush();
    b.page.splice(0, 2, err(1, 'after-reload', 'y')); // new page world: its counter starts again
    await reader.read();
    await flush();
    expect(errorCalls(b).at(-1)).toEqual({ cmd: 'errors', args: { since: 0 } });
    expect(got.at(-1)).toMatchObject({ where: 'after-reload' });
  });

  it('the bot logs page errors muted, with their own timestamp, and records them in the run (world main)', async () => {
    const b = fakeBridge([]);
    const bot = new BotController(platform, asClient(b), loadFixture('title'));
    bot.runs.record({ kind: 'click', selector: '#x', why: 'open a run' }, await bot.refresh());
    b.page.push(err(1, 'page-bridge:simulateBoss', 'state missing', 42_000));
    await bot.refresh();
    await flush();
    const line = bot.log.entries().find((e) => e.msg === 'handled (page): page-bridge:simulateBoss – state missing');
    expect(line).toMatchObject({ level: 'debug', t: 42_000 });
    expect(bot.runs.summaries()[0]!.errors).toContainEqual(
      expect.objectContaining({ world: 'main', where: 'page-bridge:simulateBoss', msg: 'state missing' }),
    );
  });

  it('the bridge answers "errors" with the errors noted on its side and its counter', async () => {
    noteError('page-bridge:test', new Error('noted in the page'));
    const res = await handle({ id: 7, cmd: 'errors', args: { since: 0 } });
    expect(res.ok).toBe(true);
    const r = res.result as { seq: number; errors: NotedError[] };
    expect(r.errors.some((e) => e.where === 'page-bridge:test' && e.msg === 'noted in the page')).toBe(true);
    expect(r.seq).toBeGreaterThanOrEqual(r.errors.at(-1)!.seq);
    const snap = await handle({ id: 8, cmd: 'snapshot' });
    // reading the snapshot outside the game notes its own fallbacks, so the counter is the one after that read
    expect((snap.result as { errSeq: number }).errSeq).toBe(noteSeq());
    expect(noteSeq()).toBeGreaterThanOrEqual(r.seq);
  });
});
