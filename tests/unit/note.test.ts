import { beforeEach, describe, expect, it } from 'vitest';
import { clearNotedErrors, noteError, recentErrors } from '../../src/core/log/note';

describe('noteError (R-199)', () => {
  beforeEach(() => clearNotedErrors());

  it('dedupes same where+msg and counts', () => {
    noteError('a', new Error('x'));
    noteError('a', new Error('x'));
    expect(recentErrors()).toHaveLength(1);
    expect(recentErrors()[0]).toMatchObject({ where: 'a', msg: 'x', count: 2 });
  });

  it('keeps at most 50 entries, dropping the oldest', () => {
    for (let i = 0; i < 60; i++) noteError('w', new Error(`e${i}`));
    const list = recentErrors();
    expect(list).toHaveLength(50);
    expect(list[0]!.msg).toBe('e10');
    expect(list[49]!.msg).toBe('e59');
  });

  it('accepts non-Error values', () => {
    noteError('b', 'str');
    noteError('c', { code: 7 });
    expect(recentErrors().map((e) => e.msg)).toEqual(['str', '{"code":7}']);
  });
});
