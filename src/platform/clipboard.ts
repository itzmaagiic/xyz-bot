import { noteError } from '../core/log/note';
/** Clipboard helper used by both adapters as last resort. */
export async function copyViaDom(text: string, doc: Document = document): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    noteError('clipboard:writeText', e); // fall through to execCommand
  }
  try {
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    doc.body.appendChild(ta);
    ta.select();
    const ok = doc.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) {
    noteError('clipboard:execCommand', e);
    return false;
  }
}
