/**
 * Central sink for errors that are handled by a fallback (R-199: no silent errors).
 * Every catch block either rethrows, logs through a Logger, or calls noteError, so nothing is swallowed unseen.
 * Ring buffer of the last 50 distinct errors (same where+msg is counted, not repeated) plus one console.debug
 * line per distinct error. Subscribers (onNotedError) – the bot logs each distinct error (muted, level debug), so it
 * shows in the overlay log and the log export.
 */
export interface NotedError {
  where: string;
  msg: string;
  count: number;
  t: number;
  /** running number of this distinct error in its world (the page bridge reports it, R-253) */
  seq: number;
}

const MAX = 50;
let buf: NotedError[] = [];
let seq = 0;
const subs = new Set<(e: NotedError) => void>();

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
  const entry: NotedError = { where, msg, count: 1, t: Date.now(), seq: ++seq };
  buf.push(entry);
  if (buf.length > MAX) buf = buf.slice(buf.length - MAX);
  if (typeof console !== 'undefined') console.debug('[pkbot]', where, msg);
  for (const fn of subs) {
    try {
      fn(entry);
    } catch (e) {
      // a broken subscriber is itself noted; the dedupe above stops any recursion after one round
      noteError('note:subscriber', e);
    }
  }
}

/** For fire-and-forget promises (event handlers, timers): a rejection is noted instead of vanishing (R-199). */
export function noteRejection(where: string, p: PromiseLike<unknown>): void {
  Promise.resolve(p).catch((e: unknown) => noteError(where, e));
}

/** Called once per distinct error (first occurrence), e.g. to show it in the bot log. Returns the unsubscribe. */
export function onNotedError(fn: (e: NotedError) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function recentErrors(): readonly NotedError[] {
  return buf;
}

/** Number of distinct errors noted so far (monotonic, survives clearNotedErrors; a page reload starts at 0). */
export function noteSeq(): number {
  return seq;
}

/** The noted errors newer than `since` (by seq) – what the page bridge hands to the bot (R-253). */
export function errorsSince(since: number): NotedError[] {
  return buf.filter((e) => e.seq > since);
}

export function clearNotedErrors(): void {
  buf = [];
}
