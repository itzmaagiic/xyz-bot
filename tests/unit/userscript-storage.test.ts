import { beforeEach, describe, expect, it } from 'vitest';
import { clearNotedErrors, recentErrors } from '../../src/core/log/note';
import { LOCAL_PREFIX, makeStorage } from '../../src/platform/userscript/storage';

/** in-memory stand-in for window.localStorage that records every write */
function fakeLocal() {
  const m = new Map<string, string>();
  const writes: string[] = [];
  return {
    writes,
    m,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => {
      writes.push(k);
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
  };
}

function fakeGm() {
  const m = new Map<string, unknown>();
  return {
    m,
    getValue: async (k: string) => m.get(k),
    setValue: async (k: string, v: string) => void m.set(k, v),
  };
}

describe('userscript storage (R-099, R-100, R-102)', () => {
  beforeEach(() => clearNotedErrors());

  it('uses GM when present and leaves localStorage alone', async () => {
    const gm = fakeGm();
    const local = fakeLocal();
    const s = makeStorage({ gm, local });
    await s.set('s', { a: 1 });
    expect(gm.m.get('s')).toBe('{"a":1}');
    expect(await s.get('s')).toEqual({ a: 1 });
    expect(local.writes).toEqual([]);
  });

  it('falls back to localStorage with the pkbot. prefix when GM is missing, and survives a reload', async () => {
    expect(LOCAL_PREFIX).toBe('pkbot.');
    const local = fakeLocal();
    await makeStorage({ gm: null, local }).set('s', { a: 1 });
    expect(local.getItem('pkbot.s')).toBe('{"a":1}');
    expect(await makeStorage({ gm: null, local }).get('s')).toEqual({ a: 1 });
  });

  it('falls back when GM throws and notes the error', async () => {
    const local = fakeLocal();
    const gm = {
      getValue: async () => {
        throw new Error('quota');
      },
      setValue: async () => {
        throw new Error('quota');
      },
    };
    const s = makeStorage({ gm, local });
    await s.set('s', 5);
    expect(local.getItem('pkbot.s')).toBe('5');
    expect(await s.get('s')).toBe(5);
    expect(recentErrors().some((e) => /userscript\/storage/.test(e.where) && e.msg === 'quota')).toBe(true);
  });

  it('never writes game keys – every localStorage write is under pkbot.', async () => {
    const local = fakeLocal();
    const s = makeStorage({ gm: null, local });
    await s.set('poke_x', 1);
    await s.set('pkrl_y', 2);
    expect(local.writes).toEqual(['pkbot.poke_x', 'pkbot.pkrl_y']);
  });

  it('keeps working in memory when neither GM nor localStorage is available', async () => {
    const s = makeStorage({ gm: null, local: null });
    await s.set('k', [1, 2]);
    expect(await s.get('k')).toEqual([1, 2]);
    expect(await s.get('missing')).toBeUndefined();
  });

  it('returns undefined and notes the error for a corrupt stored value', async () => {
    const gm = fakeGm();
    gm.m.set('s', '{kaputt');
    expect(await makeStorage({ gm, local: fakeLocal() }).get('s')).toBeUndefined();
    expect(recentErrors().some((e) => /userscript\/storage/.test(e.where))).toBe(true);
  });

  it('a later successful GM write removes the stale localStorage fallback copy', async () => {
    const local = fakeLocal();
    let fail = true;
    const gm = fakeGm();
    const flaky = {
      getValue: gm.getValue,
      setValue: async (k: string, v: string) => {
        if (fail) throw new Error('busy');
        await gm.setValue(k, v);
      },
    };
    const s = makeStorage({ gm: flaky, local });
    await s.set('s', 1);
    fail = false;
    await s.set('s', 2);
    expect(local.getItem('pkbot.s')).toBeNull();
    expect(await s.get('s')).toBe(2);
  });

  it('a failed GM write wins over the older GM value after a reload (GM read still works)', async () => {
    const local = fakeLocal();
    const gm = fakeGm();
    let fail = false;
    const quota = {
      getValue: gm.getValue,
      setValue: async (k: string, v: string) => {
        if (fail) throw new Error('quota');
        await gm.setValue(k, v);
      },
    };
    await makeStorage({ gm: quota, local }).set('s', { speed: 1 });
    fail = true;
    await makeStorage({ gm: quota, local }).set('s', { speed: 3 });
    expect(await makeStorage({ gm: quota, local }).get('s')).toEqual({ speed: 3 });
  });

  it('a successful GM write touches localStorage only to remove an existing fallback copy', async () => {
    const local = fakeLocal();
    const removed: string[] = [];
    const spy = { ...local, removeItem: (k: string) => (removed.push(k), local.removeItem(k)) };
    await makeStorage({ gm: fakeGm(), local: spy }).set('s', 1);
    expect(removed).toEqual([]);
  });

  it('offers no onChange (one context per tab; no listener API in the GM intersection)', () => {
    expect(makeStorage({ gm: fakeGm(), local: null }).onChange).toBeUndefined();
  });
});
