/**
 * Central sink for errors that are handled by a fallback (R-199: no silent errors).
 * Every catch block either rethrows, logs through a Logger, or calls noteError, so nothing is swallowed unseen.
 * Ring buffer of the last 50 distinct errors (same where+msg is counted, not repeated) plus one console.debug
 * line per distinct error.
 */
export interface NotedError {
  where: string;
  msg: string;
  count: number;
  t: number;
}

const MAX = 50;
let buf: NotedError[] = [];

function message(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err) ?? String(err);
    // eslint-disable-next-line local/no-silent-catch -- the error sink itself: the failure is folded into the message
  } catch (e) {
    return `${String(err)} (unserializable: ${String(e)})`;
  }
}

export function noteError(where: string, err: unknown): void {
  const msg = message(err);
  const hit = buf.find((e) => e.where === where && e.msg === msg);
  if (hit) {
    hit.count++;
    hit.t = Date.now();
    return;
  }
  buf.push({ where, msg, count: 1, t: Date.now() });
  if (buf.length > MAX) buf = buf.slice(buf.length - MAX);
  if (typeof console !== 'undefined') console.debug('[pkbot]', where, msg);
}

export function recentErrors(): readonly NotedError[] {
  return buf;
}

export function clearNotedErrors(): void {
  buf = [];
}
