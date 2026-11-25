/** Isolated-world side of the bridge: request/response over CustomEvents carrying JSON strings. */
import { READY_ATTR, REQ_EVENT, RES_EVENT, type BridgeCommand, type BridgeResponse } from './protocol';

export class BridgeClient {
  private nextId = 1;
  private pending = new Map<number, (r: BridgeResponse) => void>();

  constructor(private readonly doc: Document = document) {
    doc.addEventListener(RES_EVENT, (ev) => {
      const detail = (ev as CustomEvent).detail;
      if (typeof detail !== 'string') return;
      let res: BridgeResponse;
      try {
        res = JSON.parse(detail);
      } catch {
        return;
      }
      const cb = this.pending.get(res.id);
      if (cb) {
        this.pending.delete(res.id);
        cb(res);
      }
    });
  }

  get installed(): boolean {
    return !!this.doc.documentElement.getAttribute(READY_ATTR);
  }

  request<T = unknown>(cmd: BridgeCommand, args?: Record<string, unknown>, timeoutMs = 1500): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`bridge timeout (${cmd})`));
      }, timeoutMs);
      this.pending.set(id, (res) => {
        clearTimeout(timer);
        if (res.ok) resolve(res.result as T);
        else reject(new Error(res.error ?? 'bridge error'));
      });
      this.doc.dispatchEvent(new CustomEvent(REQ_EVENT, { detail: JSON.stringify({ id, cmd, args }) }));
    });
  }

  /** Waits until the bridge answers a ping (or gives up). */
  async waitReady(totalMs = 5000): Promise<boolean> {
    const until = Date.now() + totalMs;
    while (Date.now() < until) {
      try {
        await this.request('ping', undefined, 400);
        return true;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    return false;
  }
}
