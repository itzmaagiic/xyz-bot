/**
 * Runtime safety net for the bot's own world (R-200, D-036, D-039): `error` and `unhandledrejection` that no code
 * handled – e.g. the lint gaps of D-036 (a ternary async handler on addEventListener). Errors of the game's own
 * scripts (file or stack on the page origin) are not the bot's and are left alone.
 * Not installed in the MAIN world: there it would mostly see the game, and the userscript's inline bridge could not
 * be told apart from it.
 */
const MARK = '__pkbotGlobalErrors';

interface ErrorLike {
  filename?: unknown;
  reason?: unknown;
  error?: unknown;
}

/** true for an error of the game itself: thrown in a script of the page origin */
export function isGameError(win: Window, ev: ErrorLike): boolean {
  const origin = win.location?.origin;
  if (!origin || origin === 'null') return false;
  if (typeof ev.filename === 'string' && ev.filename.startsWith(origin + '/')) return true;
  const err = ev.reason ?? ev.error;
  const stack = err && typeof err === 'object' ? (err as { stack?: unknown }).stack : undefined;
  return typeof stack === 'string' && stack.includes(origin + '/');
}

/** @returns false when the handlers are already installed in this world */
export function installGlobalErrorHandlers(win: Window, onUnexpected: (where: string, err: unknown) => void): boolean {
  const w = win as Window & { [MARK]?: boolean };
  if (w[MARK]) return false;
  w[MARK] = true;
  win.addEventListener('error', (e) => {
    const ev = e as ErrorEvent;
    if (isGameError(win, ev)) return;
    onUnexpected('global:error', ev.error ?? ev.message);
  });
  win.addEventListener('unhandledrejection', (e) => {
    const ev = e as PromiseRejectionEvent;
    if (isGameError(win, ev)) return;
    onUnexpected('global:unhandledrejection', ev.reason);
  });
  return true;
}
