/**
 * Userscript entry (Userscripts for iOS/iPadOS Safari, Tampermonkey, Violentmonkey).
 * Bridge: injected <script> element into the page (CustomEvent protocol); DOM fallback if that fails.
 */
import { startApp } from '../../app';
import { READY_ATTR } from '../../core/bridge/protocol';
import { copyViaDom } from '../clipboard';
import { bindPageShortcuts, type Platform, type PlatformStorage } from '../types';
import { noteError } from '../../core/log/note';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const __BRIDGE_CODE__: string;
declare const GM: any;
declare const GM_getValue: any;
declare const GM_setValue: any;
declare const GM_setClipboard: any;
declare const GM_addValueChangeListener: any;

function makeStorage(): PlatformStorage {
  // Last resort is memory only: never write into the game's own localStorage (save integrity).
  const mem = new Map<string, string>();
  return {
    async get<T>(key: string): Promise<T | undefined> {
      try {
        if (typeof GM !== 'undefined' && GM?.getValue) {
          const v = await GM.getValue(key);
          return (typeof v === 'string' ? JSON.parse(v) : v) as T | undefined;
        }
        if (typeof GM_getValue === 'function') {
          const v = GM_getValue(key);
          return (typeof v === 'string' ? JSON.parse(v) : v) as T | undefined;
        }
      } catch (e) {
        noteError('userscript:storage', e);
      }
      const v = mem.get(key);
      return v == null ? undefined : (JSON.parse(v) as T);
    },
    async set(key, value) {
      const s = JSON.stringify(value);
      try {
        if (typeof GM !== 'undefined' && GM?.setValue) return void (await GM.setValue(key, s));
        if (typeof GM_setValue === 'function') return void GM_setValue(key, s);
      } catch (e) {
        noteError('userscript:storage', e);
      }
      mem.set(key, s);
    },
    onChange(key, cb) {
      if (typeof GM_addValueChangeListener === 'function') {
        try {
          GM_addValueChangeListener(key, (_k: string, _o: unknown, n: unknown, remote: boolean) => {
            if (remote) cb(typeof n === 'string' ? JSON.parse(n) : n);
          });
        } catch (e) {
          noteError('userscript:onChange', e);
        }
      }
    },
  };
}

function injectBridge(): boolean {
  if (document.documentElement.getAttribute(READY_ATTR)) return true;
  try {
    const s = document.createElement('script');
    s.textContent = __BRIDGE_CODE__;
    (document.head || document.documentElement).appendChild(s);
    s.remove();
  } catch (e) {
    noteError('userscript:inject-bridge', e);
    return false;
  }
  return !!document.documentElement.getAttribute(READY_ATTR);
}

const platform: Platform = {
  name: 'userscript',
  storage: makeStorage(),
  async copyText(text) {
    try {
      if (typeof GM !== 'undefined' && GM?.setClipboard) {
        await GM.setClipboard(text);
        return true;
      }
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text);
        return true;
      }
    } catch (e) {
      noteError('userscript:clipboard', e);
    }
    return copyViaDom(text);
  },
  async notify() {
    return false; // userscript → in-page toast
  },
  registerShortcuts: (h) => bindPageShortcuts(h),
  async ensureBridge() {
    return injectBridge();
  },
};

void startApp(platform);
