import { describe, expect, it } from 'vitest';
import { STALL_MS, liveVerdict } from '../e2e/live-verdict';

// R-082/R-190: the live test fails on error pauses AND on a bot that keeps "running" without progress (D-027: 0 hangs)
const ok = { progressEvents: 20, pauseReason: null, running: true, msSinceProgress: 10_000 };

describe('live test verdict', () => {
  it('passes a run that is still progressing when the time is up', () => {
    expect(liveVerdict(ok)).toEqual([]);
  });

  it('passes a wanted pause (run finished, by user)', () => {
    expect(liveVerdict({ ...ok, running: false, pauseReason: '⏸ run finished: champion' })).toEqual([]);
  });

  it('fails without progress', () => {
    expect(liveVerdict({ ...ok, progressEvents: 2 }).join()).toMatch(/no progress/);
  });

  it('fails on an error pause shown in the overlay', () => {
    const v = liveVerdict({
      ...ok,
      running: false,
      pauseReason: '⏸ action keeps failing: no effect after clicking #x',
    });
    expect(v.join()).toMatch(/error pause/);
  });

  it('fails when the bot keeps running but makes no progress for longer than the stall limit', () => {
    expect(STALL_MS).toBe(4 * 60_000);
    expect(liveVerdict({ ...ok, msSinceProgress: STALL_MS + 1 }).join()).toMatch(/stalled/);
    expect(liveVerdict({ ...ok, msSinceProgress: STALL_MS - 1 })).toEqual([]);
  });

  it('a paused bot is judged by its pause reason, not by the stall clock', () => {
    expect(
      liveVerdict({ ...ok, running: false, pauseReason: '⏸ paused by user', msSinceProgress: STALL_MS * 2 }),
    ).toEqual([]);
  });
});
