import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotController } from '../../src/core/bot';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import type { Platform } from '../../src/platform/types';
import { loadFixture } from './helpers';

// R-095 wiring (D-037): a screen that never changes → re-read after watchdogSec, pause "stalled" after 1.5 ×
const platform: Platform = {
  name: 'userscript',
  storage: { get: async () => undefined, set: async () => undefined },
  copyText: async () => true,
  notify: async () => false,
  registerShortcuts: () => undefined,
  ensureBridge: async () => false,
};

describe('bot watchdog wiring (R-095)', () => {
  afterEach(() => vi.useRealTimers());

  it('re-reads after watchdogSec without change, then pauses with "stalled" – never earlier', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const doc = loadFixture('battle-gym');
    doc.getElementById('btn-auto-battle')!.setAttribute('disabled', ''); // fight running, nothing to click
    const bot = new BotController(platform, null, doc);
    bot.view.settings = { ...DEFAULT_SETTINGS, watchdogSec: 20, reorderTeam: false };
    bot.view.status = 'running';
    const refresh = vi.spyOn(bot, 'refresh');

    await bot.tick(); // t = 0: first observation
    vi.setSystemTime(19_000);
    await bot.tick();
    expect(bot.view.status).toBe('running');
    const before = refresh.mock.calls.length;

    vi.setSystemTime(21_000); // > 20 s: one extra re-read, still running
    await bot.tick();
    expect(refresh.mock.calls.length).toBe(before + 2);
    expect(bot.log.toText()).toMatch(/watchdog: no change for 20 s/);
    expect(bot.view.status).toBe('running');

    vi.setSystemTime(31_000); // > 30 s (1.5 × 20): pause "stalled"
    await bot.tick();
    expect(bot.view.status).toBe('paused');
    expect(bot.view.pauseReason).toMatch(/^stalled: no change for 31 s on battle/); // the real idle time
    expect(bot.view.pauseKind).toBe('stalled'); // typed pause (R-254)
  });

  it('iPhone auto-lock in the middle of a fight: after 5 min the bot resumes instead of an error pause', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const doc = loadFixture('battle-gym');
    doc.getElementById('btn-auto-battle')!.setAttribute('disabled', '');
    const bot = new BotController(platform, null, doc);
    bot.view.settings = { ...DEFAULT_SETTINGS, watchdogSec: 60, reorderTeam: false };
    bot.view.status = 'running';
    await bot.tick();
    vi.setSystemTime(300_000);
    await bot.tick();
    expect(bot.view.status).toBe('running');
    expect(bot.log.toText()).toMatch(/watchdog: resumed after 300 s/);
  });

  it('a visible but disabled click target is never clicked and never counted as a failure (D-037)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const doc = loadFixture('title');
    const btn = doc.querySelector<HTMLButtonElement>('#btn-history-run')!;
    btn.disabled = true; // the engine decides to click it, the bot must not
    const bot = new BotController(platform, null, doc);
    bot.view.settings = { ...DEFAULT_SETTINGS, mode: 'story', watchdogSec: 20 };
    bot.view.status = 'running';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internals = bot as any;
    const click = vi.spyOn(internals.actor, 'click');
    for (let t = 0; t <= 19_000; t += 1_000) {
      vi.setSystemTime(t);
      await bot.tick();
    }
    expect(click).not.toHaveBeenCalled();
    expect(internals.failCount).toBe(0);
    expect(bot.view.status).toBe('running');
    for (let t = 20_000; t <= 31_000; t += 1_000) {
      vi.setSystemTime(t);
      await bot.tick();
    }
    expect(click).not.toHaveBeenCalled();
    expect(bot.view.pauseReason).toMatch(/^stalled:/); // caught by the watchdog, not by "action keeps failing"
  });

  it('start() after a pause restarts the watchdog: no stall shortly after resuming', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(0);
    const doc = loadFixture('battle-gym');
    doc.getElementById('btn-auto-battle')!.setAttribute('disabled', '');
    const bot = new BotController(platform, null, doc);
    bot.view.settings = { ...DEFAULT_SETTINGS, watchdogSec: 60, reorderTeam: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bot as any).loopRunning = true; // drive the ticks by hand: start() must not spawn the real loop
    bot.start();
    await bot.tick();
    vi.setSystemTime(50_000);
    await bot.tick();
    bot.pause('paused by user');
    vi.setSystemTime(80_000);
    bot.start();
    vi.setSystemTime(81_000);
    await bot.tick();
    vi.setSystemTime(111_000);
    await bot.tick();
    vi.setSystemTime(141_000); // 61 s after start(): at most a re-read; measured from the pause it would be a stall
    await bot.tick();
    expect(bot.view.status).toBe('running');
  });

  it('pause kinds in the view: user on toggle, none while running (R-254)', () => {
    const bot = new BotController(platform, null, loadFixture('title'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bot as any).loopRunning = true;
    bot.start();
    expect(bot.view.pauseKind).toBeNull();
    bot.toggle();
    expect(bot.view.pauseKind).toBe('user');
    bot.start();
    expect(bot.view.pauseKind).toBeNull();
  });
});
