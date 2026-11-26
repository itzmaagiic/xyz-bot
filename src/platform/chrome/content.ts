/** Chrome content script (isolated world): platform adapter + shared app. */
import { reportStartFailure, startApp } from '../../app';
import { READY_ATTR } from '../../core/bridge/protocol';
import { copyViaDom } from '../clipboard';
import { bindPageShortcuts, type Platform } from '../types';
import type { ContentRequest, StatusReply } from './messages';
import { noteError } from '../../core/log/note';

const hasChrome = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

const platform: Platform = {
  name: 'chrome',
  storage: {
    async get<T>(key: string) {
      const r = await chrome.storage.local.get(key);
      return r[key] as T | undefined;
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    onChange(key, cb) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[key]) cb(changes[key].newValue);
      });
    },
  },
  copyText: (t) => copyViaDom(t),
  async notify(title, body) {
    if (!hasChrome) return false;
    try {
      const ok = await chrome.runtime.sendMessage({ type: 'pkbot:notify', title, body });
      return ok === true;
    } catch (e) {
      noteError('content:notify', e); // caller falls back to an in-page toast
      return false;
    }
  },
  registerShortcuts(h) {
    bindPageShortcuts(h);
    // chrome.commands arrive via the background worker
    chrome.runtime.onMessage.addListener((msg: ContentRequest) => {
      if (msg?.type === 'pkbot:toggle') h.toggle();
      if (msg?.type === 'pkbot:step') h.step();
      if (msg?.type === 'pkbot:overlay') h.toggleOverlay();
    });
  },
  async ensureBridge() {
    // injected by the manifest (world MAIN); just wait for its marker
    for (let i = 0; i < 40; i++) {
      if (document.documentElement.getAttribute(READY_ATTR)) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  },
};

startApp(platform)
  .then(({ bot }) => {
    chrome.runtime.onMessage.addListener((msg: ContentRequest, _sender, reply) => {
      switch (msg?.type) {
        case 'pkbot:start':
          bot.start();
          break;
        case 'pkbot:pause':
          bot.pause('paused from popup');
          break;
        case 'pkbot:status':
          break;
        case 'pkbot:toggle':
        case 'pkbot:step':
        case 'pkbot:overlay':
          // handled by the shortcut listener; still answer with the status below
          break;
        default:
          return false;
      }
      const v = bot.view;
      const r: StatusReply = {
        status: v.status,
        pauseReason: v.pauseReason,
        screen: v.screen,
        lastDecision: v.lastDecision,
        bridge: v.bridge,
        version: v.version,
        runs: v.stats.runs,
        wins: v.stats.wins,
        losses: v.stats.losses,
      };
      reply(r);
      return false;
    });
  })
  .catch((e: unknown) => reportStartFailure(e));
