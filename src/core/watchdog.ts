/**
 * Global watchdog (R-095, D-037): if the screen signature – which includes battle progress – does not change for
 * `limitMs`, ask for one re-read; if it still has not changed `limitMs / 2` after that re-read, report a stall.
 * A stall is never reported without a re-read first.
 * A gap of at least `limitMs` between two observations (iPhone auto-lock, app switch, a long blocking step) means
 * the watchdog was blind: it restarts its timer ('resumed') instead of calling the frozen time a stall.
 * The clock is injected so the state machine is testable. reset() on start/pause: a paused bot must not "stall" on
 * resume.
 */
export type WatchdogVerdict = 'ok' | 'reread' | 'stall' | 'resumed';

export class Watchdog {
  private sig: string | null = null;
  private since: number;
  private last: number;
  private rereadAt: number | null = null;
  /** gap between the last two observations (for the "resumed after N s" log line) */
  gapMs = 0;

  constructor(private readonly now: () => number = Date.now) {
    this.since = this.last = now();
  }

  observe(signature: string, limitMs: number): WatchdogVerdict {
    const t = this.now();
    this.gapMs = t - this.last;
    this.last = t;
    if (signature !== this.sig) {
      this.sig = signature;
      this.restart(t);
      return 'ok';
    }
    if (this.gapMs >= limitMs) {
      this.restart(t);
      return 'resumed';
    }
    if (this.rereadAt === null) {
      if (t - this.since <= limitMs) return 'ok';
      this.rereadAt = t;
      return 'reread';
    }
    return t - this.rereadAt >= limitMs / 2 ? 'stall' : 'ok';
  }

  /** time since the signature last changed (the real duration for the pause message) */
  idleMs(): number {
    return this.now() - this.since;
  }

  reset(): void {
    this.restart(this.now());
  }

  private restart(t: number): void {
    this.since = this.last = t;
    this.rereadAt = null;
  }
}
