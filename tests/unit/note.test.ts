import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearNotedErrors,
  errorsSince,
  noteError,
  noteRejection,
  noteSeq,
  onNotedError,
  recentErrors,
} from '../../src/core/log/note';

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

  it('numbers each distinct error (seq); a repeat only counts up; errorsSince returns the newer ones (R-253)', () => {
    const s0 = noteSeq();
    noteError('a', new Error('x'));
    noteError('a', new Error('x'));
    noteError('b', new Error('y'));
    expect(noteSeq()).toBe(s0 + 2);
    expect(recentErrors().map((e) => e.seq)).toEqual([s0 + 1, s0 + 2]);
    expect(errorsSince(s0 + 1).map((e) => e.where)).toEqual(['b']);
    expect(errorsSince(s0 + 2)).toEqual([]);
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

  it('noteRejection notes a rejected fire-and-forget promise and ignores a fulfilled one', async () => {
    noteRejection('ui:step', Promise.reject(new Error('boom')));
    noteRejection('ui:ok', Promise.resolve(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(recentErrors().map((e) => `${e.where}:${e.msg}`)).toEqual(['ui:step:boom']);
  });
});
