/**
 * Progress and stall budgets of the live run (R-254, D-038). Pure, so it is unit-tested
 * (tests/unit/live-progress.test.ts).
 * - Progress: a change of node, map, badges, eliteIndex or team signature – and a screen change, but only when the
 *   combination screen + progress tuple is new since the last tuple change (a ping-pong between two screens is no
 *   progress; the overall STALL_MS budget catches such a loop).
 * - Budget per screen: how long the run may stay on one screen without progress. Derived from the P3a live run
 *   (78 fights: median 3.0 s, max 33.4 s; map simulations up to ~135 s of timeouts). The run logs (screenTimes)
 *   sharpen them later.
 */
export const SCREEN_BUDGET_MS: Record<string, number> = { 'battle-screen': 120_000, 'map-screen': 180_000 };
export const DEFAULT_BUDGET_MS = 90_000;

export interface Sample {
  screen: string;
  node: string | null;
  map: number;
  badges: number;
  eliteIndex: number;
  teamSig: string;
}

export interface Stall {
  screen: string;
  ms: number;
  budget: number;
}

export class ProgressTracker {
  events = 0;
  private tuple: string | null = null;
  private seen = new Set<string>();
  private screen: string | null = null;
  private lastProgress: number;
  /** budget clock: since the last progress or screen change */
  private screenSince: number;

  constructor(now: number) {
    this.lastProgress = this.screenSince = now;
  }

  /** @returns true when this sample is progress */
  observe(s: Sample, now: number): boolean {
    const tuple = JSON.stringify([s.node, s.map, s.badges, s.eliteIndex, s.teamSig]);
    const key = `${s.screen}|${tuple}`;
    if (this.tuple === null) {
      // the first sample is the baseline, not progress
      this.tuple = tuple;
      this.seen = new Set([key]);
      this.screen = s.screen;
      this.screenSince = now;
      return false;
    }
    let progress = false;
    if (tuple !== this.tuple) {
      this.tuple = tuple;
      this.seen = new Set();
      progress = true;
    }
    if (s.screen !== this.screen) {
      if (!this.seen.has(key)) progress = true;
      this.screen = s.screen;
      this.screenSince = now;
    }
    this.seen.add(key);
    if (progress) {
      this.events++;
      this.lastProgress = now;
      this.screenSince = now;
    }
    return progress;
  }

  msSinceProgress(now: number): number {
    return now - this.lastProgress;
  }

  /** the current screen exceeded its budget without progress */
  stalledOn(now: number): Stall | null {
    if (this.screen === null) return null;
    const budget = SCREEN_BUDGET_MS[this.screen] ?? DEFAULT_BUDGET_MS;
    const ms = now - this.screenSince;
    return ms > budget ? { screen: this.screen, ms, budget } : null;
  }
}
