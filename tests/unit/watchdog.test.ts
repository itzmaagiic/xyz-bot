import { describe, expect, it } from 'vitest';
import { isErrorPause, errorPause } from '../../src/core/pause-reason';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../src/core/settings';
import { Watchdog } from '../../src/core/watchdog';

// R-095 (D-037): no change for X → re-read once; still none after 1.5·X → pause "stalled"
function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('Watchdog (R-095)', () => {
  it('stays ok while the signature changes', () => {
    const c = clock();
    const w = new Watchdog(c.now);
    for (let i = 0; i < 20; i++) {
      c.advance(10_000);
      expect(w.observe(`sig${i}`, 60_000)).toBe('ok');
    }
  });

  it('asks for one re-read after the limit, then reports a stall after 1.5 × limit', () => {
    const c = clock();
    const w = new Watchdog(c.now);
    expect(w.observe('a', 60_000)).toBe('ok');
    c.advance(59_000);
    expect(w.observe('a', 60_000)).toBe('ok');
    c.advance(2_000);
    expect(w.observe('a', 60_000)).toBe('reread');
    c.advance(10_000);
    expect(w.observe('a', 60_000)).toBe('ok'); // re-read already done, not yet 1.5 × limit
    c.advance(20_000);
    expect(w.observe('a', 60_000)).toBe('stall');
  });

  it('a change after the re-read clears the alarm', () => {
    const c = clock();
    const w = new Watchdog(c.now);
    w.observe('a', 60_000);
    c.advance(59_000);
    w.observe('a', 60_000);
    c.advance(2_000);
    expect(w.observe('a', 60_000)).toBe('reread');
    c.advance(1_000);
    expect(w.observe('b', 60_000)).toBe('ok');
    c.advance(59_000);
    w.observe('b', 60_000);
    c.advance(2_000); // ticks come every few seconds; one jump ≥ limit would be a 'resumed' gap
    expect(w.observe('b', 60_000)).toBe('reread');
  });

  it('a gap of at least the limit between two observations (device asleep) restarts the timer, no stall', () => {
    const c = clock();
    const w = new Watchdog(c.now);
    expect(w.observe('a', 60_000)).toBe('ok');
    c.advance(5 * 60_000); // iPhone auto-lock in the middle of a fight: JS frozen, Date.now keeps running
    expect(w.observe('a', 60_000)).toBe('resumed');
    expect(w.gapMs).toBe(5 * 60_000);
    c.advance(59_000);
    expect(w.observe('a', 60_000)).toBe('ok');
    c.advance(2_000);
    expect(w.observe('a', 60_000)).toBe('reread');
  });

  it('never reports a stall without a re-read first; the stall comes limit/2 after the re-read', () => {
    const c = clock();
    const w = new Watchdog(c.now);
    w.observe('a', 60_000);
    c.advance(59_000);
    expect(w.observe('a', 60_000)).toBe('ok');
    c.advance(59_000); // idle 118 s > 1.5 × limit, but no re-read yet
    expect(w.observe('a', 60_000)).toBe('reread');
    c.advance(29_000);
    expect(w.observe('a', 60_000)).toBe('ok');
    c.advance(1_000);
    expect(w.observe('a', 60_000)).toBe('stall');
    expect(w.idleMs()).toBe(148_000); // the real duration, for the pause message
  });

  it('reset (start/pause) prevents an immediate stall after a long pause', () => {
    const c = clock();
    const w = new Watchdog(c.now);
    w.observe('a', 60_000);
    c.advance(10 * 60_000); // user paused for 10 minutes
    w.reset();
    expect(w.observe('a', 60_000)).toBe('ok');
  });
});

describe('challenge focus (D-040)', () => {
  it('the bot plays challenges: default and every stored mode become challenge', () => {
    expect(DEFAULT_SETTINGS.mode).toBe('challenge');
    expect(normalizeSettings({ mode: 'story' }).mode).toBe('challenge');
    expect(normalizeSettings({ mode: 'tower' }).mode).toBe('challenge');
  });
});

describe('watchdog settings and pause reason', () => {
  it('watchdogSec defaults to 60 and is clamped to 15–600', () => {
    expect(DEFAULT_SETTINGS.watchdogSec).toBe(60);
    expect(normalizeSettings({ watchdogSec: 5 }).watchdogSec).toBe(15);
    expect(normalizeSettings({ watchdogSec: 9999 }).watchdogSec).toBe(600);
    expect(normalizeSettings({ watchdogSec: 90.4 }).watchdogSec).toBe(90);
  });

  it('stalled is an error pause', () => {
    expect(errorPause('stalled', 'no change for 90 s on battle')).toBe('stalled: no change for 90 s on battle');
    expect(isErrorPause('⏸ stalled: no change for 90 s on battle')).toBe(true);
  });
});
