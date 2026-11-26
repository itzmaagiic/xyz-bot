/**
 * Verdict of the live run (R-082, R-190, R-254, D-027: 0 hangs). Pure, so it is unit-tested
 * (tests/unit/live-verdict.test.ts). Fails on:
 * - too little progress
 * - an error pause, judged by its kind (#pk-pause[data-kind], D-038) – never by translatable text
 * - an unsupported screen (own message: a case for the recon R-224, not for debugging)
 * - a stall on one screen beyond its budget (live-progress.ts) or no progress at all for longer than STALL_MS
 */
import { isErrorKind, isErrorPause, type PauseKind } from '../../src/core/pause-reason';
import type { Stall } from './live-progress';

/** overall budget without any progress (a ping-pong between screens ends here) */
export const STALL_MS = Number(process.env.LIVE_STALL_MIN ?? 4) * 60_000;

export interface LiveObservation {
  progressEvents: number;
  pauseKind: PauseKind | null;
  pauseReason: string | null;
  running: boolean;
  msSinceProgress: number;
  stalled: Stall | null;
}

export function liveVerdict(o: LiveObservation): string[] {
  const fails: string[] = [];
  if (o.progressEvents <= 3) fails.push(`no progress (${o.progressEvents} events); pause: ${o.pauseReason}`);
  // an overlay without data-kind (older build) falls back to the text prefixes
  if (isErrorKind(o.pauseKind) || (!o.pauseKind && isErrorPause(o.pauseReason)))
    fails.push(`error pause (${o.pauseKind ?? 'text'}): ${o.pauseReason}`);
  if (o.pauseKind === 'unsupported') fails.push(`unsupported screen – ${o.pauseReason} (R-224)`);
  if (o.running && o.stalled)
    fails.push(
      `stalled on ${o.stalled.screen} for ${Math.round(o.stalled.ms / 1000)} s (budget ${Math.round(o.stalled.budget / 1000)} s)`,
    );
  if (o.running && o.msSinceProgress > STALL_MS)
    fails.push(`stalled: running without progress for ${Math.round(o.msSinceProgress / 1000)} s`);
  return fails;
}
