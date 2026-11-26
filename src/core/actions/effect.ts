/**
 * Click pre-check and effect verification (P3a, R-087, R-094, D-037).
 * - Only usable targets are clicked: the game disables SKIP after the click while the fight goes on (§12.8).
 * - An effect is: the target is detached, hidden or no longer usable, or the screen signature changed.
 * - Waiting is event-driven (MutationObserver on the document) instead of fixed polling.
 */
import { noteError } from '../log/note';
import { isActionable, isShown } from '../screens/detector';

export type Precheck = 'ok' | 'missing' | 'not-actionable';

export function clickPrecheck(el: Element | null): Precheck {
  if (!el || !isShown(el)) return 'missing';
  return isActionable(el) ? 'ok' : 'not-actionable';
}

export function waitForEffect(
  doc: Document,
  el: Element,
  before: string,
  signatureOf: () => string,
  timeoutMs: number,
): Promise<boolean> {
  const effect = () => !el.isConnected || !isActionable(el) || signatureOf() !== before;
  if (effect()) return Promise.resolve(true);
  const MO = (doc.defaultView as (Window & typeof globalThis) | null)?.MutationObserver ?? MutationObserver;
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      observer.disconnect();
      resolve(v);
    };
    // a check that throws must settle the wait (false = no effect seen) instead of leaving it pending forever
    const check = (): boolean | null => {
      try {
        return effect();
      } catch (e) {
        noteError('effect:check', e);
        return null;
      }
    };
    const observer = new MO(() => {
      const r = check();
      if (r !== false) finish(r === true);
    });
    observer.observe(doc.documentElement, { attributes: true, childList: true, characterData: true, subtree: true });
    const timer = setTimeout(() => finish(check() === true), timeoutMs);
  });
}
