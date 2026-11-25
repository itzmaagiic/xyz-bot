/** StateReader: read-only; merges the bridge snapshot (preferred) with DOM detection into a typed GameState. */
import type { BridgeClient } from '../bridge/client';
import { setRuntimeTypeChart } from '../data/typechart';
import { detectScreen } from '../screens/detector';
import type { BridgeSnapshot, GameState } from '../types';
import { noteError } from '../log/note';

export class StateReader {
  private chartLoaded = false;
  lastSnapshot: BridgeSnapshot | null = null;

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
}
