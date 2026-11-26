import { beforeEach, describe, expect, it } from 'vitest';
import { clearNotedErrors, noteError, onNotedError, recentErrors } from '../../src/core/log/note';

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

  it('notifies subscribers once per distinct error and stops after unsubscribe', () => {
    const seen: string[] = [];
    const off = onNotedError((e) => seen.push(`${e.where}:${e.msg}`));
    noteError('a', new Error('x'));
    noteError('a', new Error('x'));
    noteError('b', new Error('y'));
    off();
    noteError('c', new Error('z'));
    expect(seen).toEqual(['a:x', 'b:y']);
  });

  it('a throwing subscriber does not break noteError or recurse', () => {
    const off = onNotedError(() => {
      throw new Error('sub');
    });
    expect(() => noteError('a', new Error('x'))).not.toThrow();
    off();
    expect(recentErrors().map((e) => e.where)).toContain('a');
  });
});
