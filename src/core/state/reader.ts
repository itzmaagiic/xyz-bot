/** StateReader: read-only; merges the bridge snapshot (preferred) with DOM detection into a typed GameState. */
import type { BridgeClient } from '../bridge/client';
import { setRuntimeTypeChart } from '../data/typechart';
import { detectScreen } from '../screens/detector';
import type { BridgeSnapshot, GameState } from '../types';
import { noteError, noteRejection, type NotedError } from '../log/note';

export class StateReader {
  private chartLoaded = false;
  lastSnapshot: BridgeSnapshot | null = null;
  /** page-world errors already fetched (R-253) */
  private errSeq = 0;
  private pageErrors: ((errs: NotedError[]) => void) | null = null;

  constructor(
    private readonly bridge: BridgeClient | null,
    private readonly doc: Document = document,
  ) {}

  async read(): Promise<GameState> {
    let snap: BridgeSnapshot | null = null;
    if (this.bridge) {
      try {
        snap = await this.bridge.request<BridgeSnapshot>('snapshot', { typeChart: !this.chartLoaded });
        if (!this.chartLoaded && snap.typeChart) this.chartLoaded = setRuntimeTypeChart(snap.typeChart);
      } catch (e) {
        noteError('reader:snapshot', e); // fall back to the DOM-only view
        snap = null;
      }
    }
    this.lastSnapshot = snap;
    if (snap && typeof snap.errSeq === 'number') this.checkPageErrors(snap.errSeq);
    const screen = detectScreen(this.doc);
    const version =
      snap?.version ?? this.doc.querySelector('.title-version')?.textContent?.replace(/^v/i, '').trim() ?? null;
    return {
      screen,
      run: snap?.run ?? null,
      version,
      settings: snap?.settings ?? null,
      bridge: !!snap,
    };
  }

  /** Called with each batch of new errors noted in the page's main world (bridge, simulator; R-253). */
  onPageErrors(fn: (errs: NotedError[]) => void): void {
    this.pageErrors = fn;
  }

  private checkPageErrors(pageSeq: number): void {
    if (!this.bridge || !this.pageErrors) return;
    if (pageSeq < this.errSeq) this.errSeq = 0; // the page was reloaded: its counter started again
    if (pageSeq <= this.errSeq) return;
    const since = this.errSeq;
    this.errSeq = pageSeq;
    // fire-and-forget: read() never waits for the error list
    noteRejection('reader:page-errors', this.fetchPageErrors(since));
  }

  private async fetchPageErrors(since: number): Promise<void> {
    try {
      const r = await this.bridge!.request<{ seq: number; errors: NotedError[] }>('errors', { since });
      this.errSeq = Math.max(this.errSeq, r.seq); // the answer may already hold notes made after the snapshot
      this.pageErrors?.(r.errors);
    } catch (e) {
      this.errSeq = Math.min(this.errSeq, since); // fetch again on the next read
      throw e;
    }
  }
}
