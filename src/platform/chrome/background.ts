/** Chrome service worker: keyboard commands and system notifications (both feature-detected). */
import { COMMAND_TO_MESSAGE, type BackgroundRequest } from './messages';
import { noteRejection } from '../../core/log/note';

const GAME_URLS = ['https://pokelike.xyz/*', 'https://www.pokelike.xyz/*'];

async function gameTab(): Promise<chrome.tabs.Tab | undefined> {
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true, url: GAME_URLS });
  if (active) return active;
  const all = await chrome.tabs.query({ url: GAME_URLS });
  return all[0];
}

if (chrome.commands?.onCommand) {
  chrome.commands.onCommand.addListener((command) => {
    const type = COMMAND_TO_MESSAGE[command];
    if (!type) return;
    noteRejection(
      'background:command',
      gameTab().then((tab) => (tab?.id != null ? chrome.tabs.sendMessage(tab.id, { type }) : undefined)),
    ); // e.g. no content script in that tab yet
  });
}

chrome.runtime.onMessage.addListener((msg: BackgroundRequest, _sender, reply) => {
  if (msg?.type !== 'pkbot:notify') return false;
  if (!chrome.notifications?.create) {
    reply(false);
    return false;
  }
  chrome.notifications.create(
    {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: String(msg.title).slice(0, 80),
      message: String(msg.body).slice(0, 300),
    },
    () => reply(!chrome.runtime.lastError),
  );
  return true; // async reply
});
