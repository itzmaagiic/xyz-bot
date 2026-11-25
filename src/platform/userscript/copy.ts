/** Clipboard for the userscript (R-100): GM.setClipboard if available, otherwise / on failure the DOM fallback. */
import { noteError } from '../../core/log/note';

export async function copyWithFallback(
  setClipboard: ((data: string, type?: string) => Promise<unknown>) | null,
  text: string,
  fallback: (text: string) => Promise<boolean>,
): Promise<boolean> {
  if (setClipboard) {
    try {
      const ok = await setClipboard(text, 'text/plain');
      if (ok !== false) return true; // Userscripts resolves a boolean, Tampermonkey/Violentmonkey resolve nothing
    } catch (e) {
      noteError('userscript:clipboard', e);
    }
  }
  return fallback(text);
}
