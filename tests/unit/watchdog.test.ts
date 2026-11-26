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
    c.advance(61_000);
    expect(w.observe('a', 60_000)).toBe('reread');
    c.advance(1_000);
    expect(w.observe('b', 60_000)).toBe('ok');
    c.advance(61_000);
    expect(w.observe('b', 60_000)).toBe('reread');
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
