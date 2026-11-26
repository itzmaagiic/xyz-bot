/** Offers text as a file download (R-006: run export). DOM only – Blob + <a download>, no extension permission. */
import { noteError } from '../core/log/note';

/** @returns false when the browser cannot create a blob download – the caller falls back to copying. */
export function downloadText(doc: Document, filename: string, text: string, type = 'application/json'): boolean {
  const view = doc.defaultView as (Window & typeof globalThis) | null;
  const U = view?.URL;
  const B = view?.Blob;
  if (!U || typeof U.createObjectURL !== 'function' || !B) return false;
  try {
    const url = U.createObjectURL(new B([text], { type }));
    const a = doc.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    (doc.body ?? doc.documentElement).appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => U.revokeObjectURL(url), 30_000); // after the browser has picked the file up
    return true;
  } catch (e) {
    noteError('ui:download', e);
    return false;
  }
}
