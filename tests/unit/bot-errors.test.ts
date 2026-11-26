import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenActionError } from '../../src/core/actions/guard';
import { BotController } from '../../src/core/bot';
import { clearNotedErrors, noteError } from '../../src/core/log/note';
import type { Platform } from '../../src/platform/types';

// R-199: handled errors are not silent – they reach the bot log (overlay log + log export).
const platform: Platform = {
  name: 'userscript',
  storage: { get: async () => undefined, set: async () => undefined },
  copyText: async () => true,
  notify: async () => false,
  registerShortcuts: () => undefined,
  ensureBridge: async () => false,
};

describe('noted errors reach the bot log (R-199)', () => {
  beforeEach(() => clearNotedErrors());

  it('replays errors noted before the bot existed and logs new ones once', () => {
    noteError('userscript:localStorage', new Error('blocked'));
    const bot = new BotController(platform, null, document);
    noteError('reader:snapshot', new Error('timeout'));
    noteError('reader:snapshot', new Error('timeout'));
    const lines = bot.log.toText();
    // muted level, not the orange warning colour of real problems (UI review P2): visible in overlay log and export
    expect(lines).toMatch(/\[debug\] handled: userscript:localStorage – blocked/);
    expect(lines).not.toMatch(/\[warn\] .*handled/);
    expect(lines.match(/reader:snapshot/g)).toHaveLength(1);
  });

  it('a single step that hits a forbidden action pauses with "blocked:" and logs it, like the loop (R-147, R-199)', async () => {
    const bot = new BotController(platform, null, document);
    vi.spyOn(bot as unknown as { tick: () => Promise<void> }, 'tick').mockRejectedValue(
      new ForbiddenActionError('reset-run', 'click on [data-menu="reset"]'),
    );
    await expect(bot.step()).resolves.toBeUndefined();
    expect(bot.view.status).toBe('paused');
    expect(bot.view.pauseReason).toMatch(/^blocked: /);
    expect(bot.log.toText()).toMatch(/\[error\] forbidden action blocked/);
  });

  it('a single step that crashes pauses with "internal error:" instead of rejecting silently (R-199)', async () => {
    const bot = new BotController(platform, null, document);
    vi.spyOn(bot as unknown as { tick: () => Promise<void> }, 'tick').mockRejectedValue(new Error('kaputt'));
    await expect(bot.step()).resolves.toBeUndefined();
    expect(bot.view.pauseReason).toMatch(/^internal error: .*kaputt/);
  });
});
