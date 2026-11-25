import { noteError } from '../log/note';
/**
 * Safety guard for all input the bot sends (R-147, D-025).
 *
 * The bot never triggers "Reset Run", account actions (login/logout) or the reset shortcut "R".
 * Every click/drag target and every key press is checked here BEFORE any event is dispatched.
 * Allowing such actions explicitly via a setting is R-165 (phase 5); until then they are always blocked.
 */

/** Elements the bot must never interact with (matched via `closest`, so children count too). */
export const FORBIDDEN_TARGETS: readonly string[] = [
  '[data-menu="reset"]',
  '[data-menu="account"]',
  '[onclick*="confirmResetRun"]',
  '#reset-run-modal',
  '.reset-run-modal',
  // never share a run, never open the Poké Mart / spend Pokédollar, never install the app (R-053, R-237)
  '[onclick*="shareRun"]',
  '[onclick*="openShopModal"]',
  '#btn-mart-nav',
  '[onclick*="buyVitamin"]',
  '[onclick*="installApp"]',
  '#btn-install-app',
];

/** The only key presses the bot may send: Shift+1…6 (swap the lead, see bot.ts). */
const ALLOWED_KEY_CODES = new Set(['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6']);

export class ForbiddenActionError extends Error {
  readonly rule: string;
  constructor(rule: string, what: string) {
    super(`blocked ${what} (${rule})`);
    this.name = 'ForbiddenActionError';
    this.rule = rule;
  }
}

/** Returns the matching rule if `el` (or one of its ancestors) is forbidden, otherwise null. */
export function isForbiddenTarget(el: Element | null | undefined): string | null {
  if (!el || typeof el.closest !== 'function') return null;
  for (const sel of FORBIDDEN_TARGETS) {
    try {
      if (el.closest(sel)) return sel;
    } catch (e) {
      // an unsupported selector in some DOM implementation must not disable the other rules
      noteError('guard:closest', e);
      continue;
    }
  }
  return null;
}

export function isKeyAllowed(code: string, key: string, mods: { shift?: boolean; alt?: boolean } = {}): boolean {
  return ALLOWED_KEY_CODES.has(code) && key === code.slice(5) && !!mods.shift && !mods.alt;
}

/** Throws ForbiddenActionError if any of the elements is forbidden. */
export function assertAllowedTargets(what: string, ...els: (Element | null | undefined)[]): void {
  for (const el of els) {
    const rule = isForbiddenTarget(el);
    if (rule) throw new ForbiddenActionError(rule, what);
  }
}
