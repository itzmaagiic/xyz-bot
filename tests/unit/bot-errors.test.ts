import { beforeEach, describe, expect, it } from 'vitest';
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
    expect(lines).toMatch(/\[warn\] .*userscript:localStorage.*blocked/);
    expect(lines.match(/reader:snapshot/g)).toHaveLength(1);
  });
});
