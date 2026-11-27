/** Chrome options page: same settings + same form as the overlay, stored in chrome.storage.local. */
import { normalizeSettings, SETTINGS_KEY, type BotSettings } from '../../core/settings';
import { noteRejection } from '../../core/log/note';
import { buildSettingsForm } from '../../ui/settings-form';
import { reportSave } from '../../ui/storage-problem';

const root = document.getElementById('form')!;
const saved = document.getElementById('saved')!;
let current: BotSettings;

function render(): void {
  root.textContent = '';
  root.appendChild(
    buildSettingsForm(document, current, (patch) => {
      current = normalizeSettings({ ...current, ...patch });
      // R-259: a failed save (e.g. "Extension context invalidated") is shown in plain words with the next step
      noteRejection(
        'options:save',
        reportSave(chrome.storage.local.set({ [SETTINGS_KEY]: current }), saved, 'Gespeichert ✓').then(() => {
          if (!saved.classList.contains('bad')) setTimeout(() => (saved.textContent = ''), 1500);
        }),
      );
    }),
  );
}

noteRejection(
  'options:load',
  chrome.storage.local.get(SETTINGS_KEY).then((r) => {
    current = normalizeSettings(r[SETTINGS_KEY]);
    render();
  }),
);

chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'local' && c[SETTINGS_KEY]) {
    current = normalizeSettings(c[SETTINGS_KEY].newValue);
    if (!root.contains(document.activeElement)) render();
  }
});

document.getElementById('reset-stats')!.addEventListener('click', () =>
  noteRejection(
    'options:reset-stats',
    chrome.storage.local.remove('pkbot.stats').then(() => {
      saved.textContent = 'Statistik zurückgesetzt';
    }),
  ),
);
