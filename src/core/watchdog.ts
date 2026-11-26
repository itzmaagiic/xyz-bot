/**
 * Global watchdog (R-095, D-037): if the screen signature – which includes battle progress – does not change for
 * `limitMs`, ask for one re-read; if it still has not changed after 1.5 × limitMs, report a stall. The clock is
 * injected so the state machine is testable. reset() on start/pause: a paused bot must not "stall" on resume.
 */
export type WatchdogVerdict = 'ok' | 'reread' | 'stall';

export class Watchdog {
  private sig: string | null = null;
  private since: number;
  private reread = false;

  constructor(private readonly now: () => number = Date.now) {
    this.since = now();
  }

  observe(signature: string, limitMs: number): WatchdogVerdict {
    const t = this.now();
    if (signature !== this.sig) {
      this.sig = signature;
      this.since = t;
      this.reread = false;
      return 'ok';
    }
    const idle = t - this.since;
    if (idle > limitMs * 1.5) return 'stall';
    if (idle > limitMs && !this.reread) {
      this.reread = true;
      return 'reread';
    }
    return 'ok';
  }

  reset(): void {
    this.since = this.now();
    this.reread = false;
  }
}
