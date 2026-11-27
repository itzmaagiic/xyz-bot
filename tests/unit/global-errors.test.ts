/** P3c T2 (R-200, D-039): unexpected errors of the bot's world are logged and reported; the game's are not. */
import { afterEach, describe, expect, it } from 'vitest';
import { BotController } from '../../src/core/bot';
import { installGlobalErrorHandlers, isGameError } from '../../src/core/log/global-errors';
import { clearNotedErrors, recentErrors } from '../../src/core/log/note';
import type { Platform } from '../../src/platform/types';
import { loadFixture } from './helpers';

/** what the browser dispatches for an unhandled rejection / an uncaught error */
function dispatch(win: Window, type: 'unhandledrejection' | 'error', props: Record<string, unknown>): void {
  const ev = new (win as unknown as { Event: typeof Event }).Event(type);
  for (const [k, v] of Object.entries(props)) Object.defineProperty(ev, k, { value: v });
  win.dispatchEvent(ev);
}

const platform: Platform = {
  name: 'userscript',
  storage: { get: async () => undefined, set: async () => undefined },
  copyText: async () => true,
  notify: async () => false,
  registerShortcuts: () => undefined,
  ensureBridge: async () => false,
};

describe('global error handlers (R-200)', () => {
  afterEach(() => clearNotedErrors());

  it('a rejection from a ternary async handler on addEventListener is reported', async () => {
    const doc = loadFixture('title');
    const win = doc.defaultView as unknown as Window;
    const seen: [string, unknown][] = [];
    installGlobalErrorHandlers(win, (where, err) => seen.push([where, err]));
    const flag = doc.body.childElementCount > 0;
    const handler = flag
      ? async () => {
          throw new Error('ternary handler rejection');
        }
      : null;
    // the lint gap of D-036: such a handler's rejection is not caught by the rules – the browser reports it
    const reason = await handler!().catch((e: unknown) => e);
    dispatch(win, 'unhandledrejection', { reason });
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]).toBe('global:unhandledrejection');
    expect((seen[0]![1] as Error).message).toBe('ternary handler rejection');
  });

  it('an ErrorEvent from a pokelike.xyz script is the game’s, one from the extension is ours', () => {
    const doc = loadFixture('title');
    const win = doc.defaultView as unknown as Window;
    const seen: string[] = [];
    installGlobalErrorHandlers(win, (where) => seen.push(where));
    dispatch(win, 'error', { filename: 'https://pokelike.xyz/js/game.js', error: new Error('game bug') });
    expect(seen).toEqual([]);
    dispatch(win, 'error', { filename: 'chrome-extension://abc/content.js', error: new Error('bot bug') });
    expect(seen).toEqual(['global:error']);
  });

  it('a rejection whose stack points to the game origin is the game’s', () => {
    const doc = loadFixture('title');
    const win = doc.defaultView as unknown as Window;
    const err = new Error('game promise');
    err.stack = 'Error: game promise\n    at load (https://pokelike.xyz/js/save.js:10:5)';
    expect(isGameError(win, { reason: err })).toBe(true);
    expect(isGameError(win, { reason: new Error('ours') })).toBe(false);
  });

  it('installing twice in the same world reports once', () => {
    const doc = loadFixture('title');
    const win = doc.defaultView as unknown as Window;
    const seen: string[] = [];
    expect(installGlobalErrorHandlers(win, (w) => seen.push(w))).toBe(true);
    expect(installGlobalErrorHandlers(win, (w) => seen.push(w))).toBe(false);
    dispatch(win, 'unhandledrejection', { reason: new Error('x') });
    expect(seen).toHaveLength(1);
  });

  it('reportUnexpected logs an error line every time but toasts only the first time per text', () => {
    const bot = new BotController(platform, null, loadFixture('title'));
    const toasts: string[] = [];
    bot.onUnexpectedToast = (t) => toasts.push(t);
    for (let i = 0; i < 3; i++) bot.reportUnexpected('global:unhandledrejection', new Error('loop bug'));
    bot.reportUnexpected('global:error', new Error('other bug'));
    const lines = bot.log
      .entries()
      .filter((e) => e.level === 'error')
      .map((e) => e.msg);
    expect(lines).toEqual([
      'unexpected: loop bug',
      'unexpected: loop bug',
      'unexpected: loop bug',
      'unexpected: other bug',
    ]);
    expect(toasts).toHaveLength(2);
    expect(toasts[0]).toMatch(/Unerwarteter Fehler im Bot/);
    expect(recentErrors().some((e) => e.where === 'global:unhandledrejection' && e.msg === 'loop bug')).toBe(true);
    // no extra muted "handled:" line for it – the error line already says it
    expect(bot.log.entries().some((e) => e.msg.startsWith('handled: global:'))).toBe(false);
  });

  it('a muted cross-origin "Script error." (ads, consent manager) is not a bot error (review P3c M4)', () => {
    const doc = loadFixture('title');
    const win = doc.defaultView as unknown as Window;
    expect(isGameError(win, { filename: '', error: null, message: 'Script error.' })).toBe(true);
  });

  it('only the top stack frame decides: our error that passed through a game callback is ours (review P3c M4)', () => {
    const doc = loadFixture('title');
    const win = doc.defaultView as unknown as Window;
    const err = new Error('ours');
    err.stack =
      'Error: ours\n    at read (chrome-extension://abc/content.js:1:2)\n    at cb (https://pokelike.xyz/js/game.js:9:1)';
    expect(isGameError(win, { reason: err })).toBe(false);
  });
});
