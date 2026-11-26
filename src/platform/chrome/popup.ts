/** Chrome popup: quick access (start/pause/step/status). Settings live in the overlay and options page. */
import type { ContentRequest, StatusReply } from './messages';
import { noteError, noteRejection } from '../../core/log/note';

const $ = (id: string) => document.getElementById(id)!;

async function send(type: ContentRequest['type']): Promise<StatusReply | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !/^https:\/\/(www\.)?pokelike\.xyz\//.test(tab.url ?? '')) return null;
  try {
    return (await chrome.tabs.sendMessage(tab.id, { type })) as StatusReply;
  } catch (e) {
    noteError('popup:send', e); // content script not (yet) injected → shown as "not connected"
    return null;
  }
}

function show(s: StatusReply | null): void {
  const on = !!s;
  $('nogame').hidden = on;
  $('game').hidden = !on;
  if (!s) return;
  $('status').textContent = s.status === 'running' ? 'läuft' : s.status === 'paused' ? 'pausiert' : 'bereit';
  $('toggle').textContent = s.status === 'running' ? 'Pause' : 'Start';
  $('screen').textContent = s.screen;
  $('decision').textContent = s.lastDecision;
  $('reason').textContent = s.pauseReason ?? '';
  $('data').textContent = s.bridge ? 'Bridge' : 'DOM-Fallback';
  $('version').textContent = s.version ? `v${s.version}` : '?';
  $('runs').textContent = `${s.runs} (${s.wins} S / ${s.losses} N)`;
}

// every promise is handled: a rejection is noted instead of vanishing (R-199)
const sendAndShow = (type: Parameters<typeof send>[0]) => noteRejection(`popup:${type}`, send(type).then(show));
$('toggle').addEventListener('click', () => sendAndShow('pkbot:toggle'));
$('step').addEventListener('click', () => sendAndShow('pkbot:step'));
$('overlay').addEventListener('click', () => sendAndShow('pkbot:overlay'));
$('options').addEventListener('click', () => noteRejection('popup:options', chrome.runtime.openOptionsPage()));
$('open').addEventListener('click', () =>
  noteRejection('popup:open', chrome.tabs.create({ url: 'https://pokelike.xyz/' })),
);

sendAndShow('pkbot:status');
setInterval(() => sendAndShow('pkbot:status'), 1000);
