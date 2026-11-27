/** Storage problems in the UI (R-259): the shared text and the save feedback of the Chrome options page. */
import { noteError } from '../core/log/note';
import { storageProblemText } from '../core/storage-problem';

export { storageProblemText };

/** Shows `okText` after a successful save, otherwise the plain-language problem with the next step. */
export async function reportSave(p: Promise<unknown>, el: HTMLElement, okText: string): Promise<void> {
  try {
    await p;
    el.textContent = okText;
    el.classList.remove('bad');
  } catch (e) {
    noteError('ui:save', e);
    el.textContent = storageProblemText(e);
    el.classList.add('bad');
  }
}
