import { beforeEach, describe, expect, it } from 'vitest';
import { clearNotedErrors, recentErrors } from '../../src/core/log/note';
import { copyWithFallback } from '../../src/platform/userscript/copy';

// R-100: GM.setClipboard only with feature detection and a fallback
describe('userscript clipboard (R-100)', () => {
  beforeEach(() => clearNotedErrors());
  const fallback = (log: string[]) => async (t: string) => (log.push('dom:' + t), true);

  it('uses GM.setClipboard when present', async () => {
    const log: string[] = [];
    const ok = await copyWithFallback(async (t) => void log.push('gm:' + t), 'x', fallback(log));
    expect(ok).toBe(true);
    expect(log).toEqual(['gm:x']);
  });

  it('falls back to the DOM copy when GM.setClipboard is missing', async () => {
    const log: string[] = [];
    expect(await copyWithFallback(null, 'x', fallback(log))).toBe(true);
    expect(log).toEqual(['dom:x']);
  });

  it('falls back and notes the error when GM.setClipboard throws', async () => {
    const log: string[] = [];
    const ok = await copyWithFallback(
      async () => {
        throw new Error('denied');
      },
      'x',
      fallback(log),
    );
    expect(ok).toBe(true);
    expect(log).toEqual(['dom:x']);
    expect(recentErrors().some((e) => e.where === 'userscript:clipboard' && e.msg === 'denied')).toBe(true);
  });

  it('falls back when GM.setClipboard reports false (Userscripts resolves a boolean)', async () => {
    const log: string[] = [];
    await copyWithFallback(async () => false, 'x', fallback(log));
    expect(log).toEqual(['dom:x']);
  });
});
