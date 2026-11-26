import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearNotedErrors,
  errorsSince,
  noteError,
  noteRejection,
  noteSeq,
  onEveryNote,
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

  it('seq counts every note, also repeats; errorsSince returns the entries changed since then (R-253)', () => {
    const s0 = noteSeq();
    noteError('a', new Error('x'));
    noteError('b', new Error('y'));
    noteError('a', new Error('x')); // a repeat: count 2, and it is "new" again for whoever fetched up to s0 + 2
    expect(noteSeq()).toBe(s0 + 3);
    expect(recentErrors().map((e) => [e.where, e.count, e.seq])).toEqual([
      ['a', 2, s0 + 3],
      ['b', 1, s0 + 2],
    ]);
    expect(errorsSince(s0 + 2).map((e) => [e.where, e.count])).toEqual([['a', 2]]);
    expect(errorsSince(s0 + 3)).toEqual([]);
  });

  it('onEveryNote sees every occurrence, onNotedError only the first (R-253: per-run counts, quiet log)', () => {
    const every: number[] = [];
    const first: number[] = [];
    const off1 = onEveryNote((e) => every.push(e.count));
    const off2 = onNotedError((e) => first.push(e.count));
    noteError('r', new Error('again'));
    noteError('r', new Error('again'));
    off1();
    off2();
    expect(every).toEqual([1, 2]);
    expect(first).toEqual([1]);
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
