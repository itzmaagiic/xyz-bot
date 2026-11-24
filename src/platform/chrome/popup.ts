/** Chrome popup: quick access (start/pause/step/status). Settings live in the overlay and options page. */
import type { ContentRequest, StatusReply } from './messages';

const $ = (id: string) => document.getElementById(id)!;

async function send(type: ContentRequest['type']): Promise<StatusReply | null> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !/^https:\/\/(www\.)?pokelike\.xyz\//.test(tab.url ?? '')) return null;
  try {
    return (await chrome.tabs.sendMessage(tab.id, { type })) as StatusReply;
  } catch {
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

$('toggle').addEventListener('click', async () => show(await send('pkbot:toggle')));
$('step').addEventListener('click', async () => show(await send('pkbot:step')));
$('overlay').addEventListener('click', async () => show(await send('pkbot:overlay')));
$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('open').addEventListener('click', () => chrome.tabs.create({ url: 'https://pokelike.xyz/' }));

void send('pkbot:status').then(show);
setInterval(() => void send('pkbot:status').then(show), 1000);
