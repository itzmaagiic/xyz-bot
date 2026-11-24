/** Chrome options page: same settings + same form as the overlay, stored in chrome.storage.local. */
import { normalizeSettings, SETTINGS_KEY, type BotSettings } from '../../core/settings';
import { buildSettingsForm } from '../../ui/settings-form';

const root = document.getElementById('form')!;
const saved = document.getElementById('saved')!;
let current: BotSettings;

function render(): void {
  root.textContent = '';
  root.appendChild(
    buildSettingsForm(document, current, async (patch) => {
      current = normalizeSettings({ ...current, ...patch });
      await chrome.storage.local.set({ [SETTINGS_KEY]: current });
      saved.textContent = 'Gespeichert ✓';
      setTimeout(() => (saved.textContent = ''), 1500);
    }),
  );
}

void chrome.storage.local.get(SETTINGS_KEY).then((r) => {
  current = normalizeSettings(r[SETTINGS_KEY]);
  render();
});

chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'local' && c[SETTINGS_KEY]) {
    current = normalizeSettings(c[SETTINGS_KEY].newValue);
    if (!root.contains(document.activeElement)) render();
  }
});

document.getElementById('reset-stats')!.addEventListener('click', async () => {
  await chrome.storage.local.remove('pkbot.stats');
  saved.textContent = 'Statistik zurückgesetzt';
});
