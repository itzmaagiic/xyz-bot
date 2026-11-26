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
    expect(bot.view.pauseReason).toMatch(/^stalled: no change for 30 s on battle/);
  });
});
