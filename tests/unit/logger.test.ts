/** R-091: the bot log is a ring buffer with a size limit; P3b T2: explicit timestamps (R-253). */
import { describe, expect, it } from 'vitest';
import { Logger } from '../../src/core/log/logger';

describe('Logger ring buffer (R-091)', () => {
  it('keeps at most max entries, oldest first out', () => {
    const log = new Logger(3);
    for (let i = 0; i < 5; i++) log.info(`m${i}`);
    expect(log.entries().map((e) => e.msg)).toEqual(['m2', 'm3', 'm4']);
  });

  it('log() takes an explicit timestamp (an error noted earlier keeps its own time)', () => {
    const log = new Logger();
    log.log('debug', 'handled (page): sim – boom', undefined, 1_000);
    expect(log.entries()[0]!.t).toBe(1_000);
    expect(log.toText()).toContain('1970-01-01T00:00:01.000Z [debug] handled (page): sim – boom');
  });
});
