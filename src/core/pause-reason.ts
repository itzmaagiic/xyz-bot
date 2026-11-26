/**
 * Pause reasons that mean "something went wrong" (R-082, R-190, D-027: 0 hangs).
 * Wanted pauses – by the user, a stop condition, an unknown screen with a message – are not error pauses.
 * The bot builds its error reasons with errorPause(); the live E2E test fails on isErrorPause().
 */
const PREFIX = {
  failing: 'action keeps failing',
  internal: 'internal error',
  blocked: 'blocked',
  stalled: 'stalled',
} as const;

export type ErrorPauseKind = keyof typeof PREFIX;

/**
 * Typed pause (R-254, D-038): travels next to the display text (BotView.pauseKind, #pk-pause[data-kind]) so the live
 * verdict never depends on translatable text.
 * - user: paused by the user · finished: a stop condition (run finished) · config: the bot settings do not fit the
 *   save (locked region, challenge not offered) · unsupported: a screen/dialog the bot does not automate yet
 * - errors: inconsistent (game data and DOM disagree), failing, internal, blocked, stalled
 */
export type PauseKind = 'user' | 'finished' | 'config' | 'unsupported' | 'inconsistent' | ErrorPauseKind;

const ERROR_KINDS: readonly PauseKind[] = ['inconsistent', 'failing', 'internal', 'blocked', 'stalled'];

export function isErrorKind(kind: PauseKind | null | undefined): boolean {
  return !!kind && ERROR_KINDS.includes(kind);
}

export function errorPause(kind: ErrorPauseKind, detail: string): string {
  return `${PREFIX[kind]}: ${detail}`;
}

// optional leading "⏸ ": the overlay shows the reason with that symbol (#pk-pause), the live test reads it there
const ERROR_RE = new RegExp(`^(?:⏸\\s*)?(${Object.values(PREFIX).join('|')}): `);

export function isErrorPause(reason: string | null | undefined): boolean {
  return !!reason && ERROR_RE.test(reason);
}
