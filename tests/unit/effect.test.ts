import { afterEach, describe, expect, it, vi } from 'vitest';
import { clickPrecheck, waitForEffect } from '../../src/core/actions/effect';
import { clearNotedErrors, recentErrors } from '../../src/core/log/note';
import { loadFixture } from './helpers';

// P3a (R-087, R-094): click only usable targets; an effect is a disabled/removed target or a new signature
function setup() {
  const doc = loadFixture('battle-gym');
  const btn = doc.getElementById('btn-auto-battle')!;
  let sig = 'a';
  return { doc, btn, sigOf: () => sig, setSig: (v: string) => (sig = v) };
}

describe('clickPrecheck', () => {
  it('missing for null, not-actionable for a disabled button, ok for an enabled one', () => {
    const { btn } = setup();
    expect(clickPrecheck(null)).toBe('missing');
    expect(clickPrecheck(btn)).toBe('ok');
    btn.setAttribute('disabled', '');
    expect(clickPrecheck(btn)).toBe('not-actionable');
  });
});

describe('waitForEffect (MutationObserver)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resolves true when the clicked button becomes disabled (the game disables SKIP after the click)', async () => {
    const { doc, btn, sigOf } = setup();
    setTimeout(() => btn.setAttribute('disabled', ''), 50);
    await expect(waitForEffect(doc, btn, 'a', sigOf, 1000)).resolves.toBe(true);
  });

  it('resolves true when the button is removed', async () => {
    const { doc, btn, sigOf } = setup();
    setTimeout(() => btn.remove(), 50);
    await expect(waitForEffect(doc, btn, 'a', sigOf, 1000)).resolves.toBe(true);
  });

  it('resolves true when the screen signature changes', async () => {
    const { doc, btn, sigOf, setSig } = setup();
    setTimeout(() => {
      setSig('b');
      doc.body.setAttribute('data-x', '1'); // any DOM mutation triggers a re-check
    }, 50);
    await expect(waitForEffect(doc, btn, 'a', sigOf, 1000)).resolves.toBe(true);
  });

  it('resolves false after the timeout when nothing changes', async () => {
    const { doc, btn, sigOf } = setup();
    await expect(waitForEffect(doc, btn, 'a', sigOf, 100)).resolves.toBe(false);
  });

  it('disconnects its observer in every outcome', async () => {
    const { doc, btn, sigOf } = setup();
    const view = doc.defaultView as unknown as { MutationObserver: typeof MutationObserver };
    const spy = vi.spyOn(view.MutationObserver.prototype, 'disconnect');
    await waitForEffect(doc, btn, 'a', sigOf, 50);
    setTimeout(() => btn.setAttribute('disabled', ''), 10);
    await waitForEffect(doc, btn, 'a', sigOf, 1000);
    expect(spy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('a check that throws during the wait settles with false and is noted – never a promise that hangs forever', async () => {
    clearNotedErrors();
    const { doc, btn } = setup();
    let calls = 0;
    const sigOf = () => {
      if (++calls > 1) throw new Error('detector broke');
      return 'a';
    };
    setTimeout(() => btn.setAttribute('data-x', '1'), 20); // a mutation → the observer re-checks → throws
    await expect(waitForEffect(doc, btn, 'a', sigOf, 300)).resolves.toBe(false);
    expect(recentErrors().some((e) => e.where === 'effect:check' && /detector broke/.test(e.msg))).toBe(true);
  });
});
