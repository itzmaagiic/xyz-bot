/**
 * Pause reasons that mean "something went wrong" (R-082, R-190, D-027: 0 hangs).
 * Wanted pauses – by the user, a stop condition, an unknown screen with a message – are not error pauses.
 * The bot builds its error reasons with errorPause(); the live E2E test fails on isErrorPause().
 */
const PREFIX = {
  failing: 'action keeps failing',
  internal: 'internal error',
  blocked: 'blocked',
} as const;

export type ErrorPauseKind = keyof typeof PREFIX;

export function errorPause(kind: ErrorPauseKind, detail: string): string {
  return `${PREFIX[kind]}: ${detail}`;
}

// optional leading "⏸ ": the overlay shows the reason with that symbol (#pk-pause), the live test reads it there
const ERROR_RE = new RegExp(`^(?:⏸\\s*)?(${Object.values(PREFIX).join('|')}): `);

export function isErrorPause(reason: string | null | undefined): boolean {
  return !!reason && ERROR_RE.test(reason);
}
