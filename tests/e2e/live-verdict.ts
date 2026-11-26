/**
 * Verdict of the live run (R-082, R-190, D-027: 0 hangs). Pure, so it is unit-tested (tests/unit/live-verdict.test.ts).
 * Fails on: too little progress, an error pause (action keeps failing / internal error / blocked), and a bot that
 * keeps "running" without any progress for longer than STALL_MS (a hang that never turns into a pause).
 */
import { isErrorPause } from '../../src/core/pause-reason';

/** longer than the longest boss fight seen so far (~1–2 min with SKIP disabled, GAME_RECON §12.8) */
export const STALL_MS = Number(process.env.LIVE_STALL_MIN ?? 4) * 60_000;

export interface LiveObservation {
  progressEvents: number;
  pauseReason: string | null;
  running: boolean;
  msSinceProgress: number;
}

export function liveVerdict(o: LiveObservation): string[] {
  const fails: string[] = [];
  if (o.progressEvents <= 3) fails.push(`no progress (${o.progressEvents} events); pause: ${o.pauseReason}`);
  if (isErrorPause(o.pauseReason)) fails.push(`error pause: ${o.pauseReason}`);
  if (o.running && o.msSinceProgress > STALL_MS)
    fails.push(`stalled: running without progress for ${Math.round(o.msSinceProgress / 1000)} s`);
  return fails;
}
