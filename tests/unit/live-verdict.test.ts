import { describe, expect, it } from 'vitest';
import { STALL_MS, liveVerdict } from '../e2e/live-verdict';

// R-082/R-190: the live test fails on error pauses AND on a bot that keeps "running" without progress (D-027: 0 hangs)
const ok = {
  progressEvents: 20,
  pauseKind: null,
  pauseReason: null,
  running: true,
  msSinceProgress: 10_000,
  stalled: null,
} as const;

describe('live test verdict', () => {
  it('passes a run that is still progressing when the time is up', () => {
    expect(liveVerdict(ok)).toEqual([]);
  });

  it('passes a wanted pause (run finished, by user)', () => {
    expect(liveVerdict({ ...ok, running: false, pauseKind: 'finished', pauseReason: '⏸ run finished: x' })).toEqual([]);
    expect(liveVerdict({ ...ok, running: false, pauseKind: 'user', pauseReason: '⏸ paused by user' })).toEqual([]);
  });

  it('fails without progress', () => {
    expect(liveVerdict({ ...ok, progressEvents: 2 }).join()).toMatch(/no progress/);
  });

  it('fails on an error pause shown in the overlay', () => {
    const v = liveVerdict({
      ...ok,
      running: false,
      pauseKind: 'failing',
      pauseReason: '⏸ action keeps failing: no effect after clicking #x',
    });
    expect(v.join()).toMatch(/error pause/);
  });

  it('judges the pause by its kind, not its text (R-254): inconsistent is an error', () => {
    const v = liveVerdict({ ...ok, running: false, pauseKind: 'inconsistent', pauseReason: '⏸ irgendein Text' });
    expect(v.join()).toMatch(/error pause \(inconsistent\)/);
  });

  it('an unsupported screen fails with its own message that points to the recon (R-224)', () => {
    const v = liveVerdict({
      ...ok,
      running: false,
      pauseKind: 'unsupported',
      pauseReason: '⏸ screen "mystery-screen" is not automated yet',
    });
    expect(v.join()).toMatch(/unsupported screen .*mystery-screen.*\(R-224\)/);
    expect(v.join()).not.toMatch(/error pause/);
  });

  it('a stall on one screen beyond its budget fails with screen, time and budget', () => {
    const v = liveVerdict({ ...ok, stalled: { screen: 'battle-screen', ms: 130_000, budget: 120_000 } });
    expect(v.join()).toMatch(/stalled on battle-screen for 130 s \(budget 120 s\)/);
  });

  it('fails when the bot keeps running but makes no progress for longer than the stall limit', () => {
    expect(STALL_MS).toBe(Number(process.env.LIVE_STALL_MIN ?? 4) * 60_000); // default 4 min, LIVE_STALL_MIN overrides
    expect(liveVerdict({ ...ok, msSinceProgress: STALL_MS + 1 }).join()).toMatch(/stalled/);
    expect(liveVerdict({ ...ok, msSinceProgress: STALL_MS - 1 })).toEqual([]);
  });

  it('a paused bot is judged by its pause reason, not by the stall clock', () => {
    expect(
      liveVerdict({
        ...ok,
        running: false,
        pauseKind: 'user',
        pauseReason: '⏸ paused by user',
        msSinceProgress: STALL_MS * 2,
        stalled: { screen: 'map-screen', ms: 999_000, budget: 180_000 },
      }),
    ).toEqual([]);
  });
});
