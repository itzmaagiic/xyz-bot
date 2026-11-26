/**
 * Userscript entry (Userscripts for iOS/iPadOS Safari, Tampermonkey, Violentmonkey).
 * Only the GM.* API intersection is used (R-099, docs/USERSCRIPT_API.md); everything else is feature-detected.
 * GM functions are always called literally as `GM.<name>` so the build can derive @grant from the bundle (R-104).
 * Bridge: injected <script> element into the page (CustomEvent protocol); DOM fallback if that fails.
 */
import { reportStartFailure, startApp } from '../../app';
import { READY_ATTR } from '../../core/bridge/protocol';
import { noteError } from '../../core/log/note';
import { copyViaDom } from '../clipboard';
import { bindPageShortcuts, type Platform } from '../types';
import { copyWithFallback } from './copy';
import { makeStorage, type StorageEnv } from './storage';

declare const __BRIDGE_CODE__: string;
declare const GM: {
  getValue?: (key: string) => Promise<unknown>;
  setValue?: (key: string, value: string) => Promise<void>;
  setClipboard?: (data: string, type?: string) => Promise<unknown>;
};

const hasGM = typeof GM !== 'undefined';

function gmStorage(): StorageEnv['gm'] {
  if (!hasGM || typeof GM.getValue !== 'function' || typeof GM.setValue !== 'function') return null;
  return { getValue: (k) => GM.getValue!(k), setValue: (k, v) => GM.setValue!(k, v) };
}

function safeLocalStorage(): StorageEnv['local'] {
  try {
    return window.localStorage ?? null;
  } catch (e) {
    noteError('userscript:localStorage', e); // blocked (private mode, sandbox) → memory only
    return null;
  }
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
  storage: makeStorage({ gm: gmStorage(), local: safeLocalStorage() }),
  async copyText(text) {
    const gmCopy =
      hasGM && typeof GM.setClipboard === 'function' ? (d: string, t?: string) => GM.setClipboard!(d, t) : null;
    return copyWithFallback(gmCopy, text, (t) => copyViaDom(t));
  },
  async notify() {
    return false; // userscript → in-page toast
  },
  registerShortcuts: (h) => bindPageShortcuts(h),
  async ensureBridge() {
    return injectBridge();
  },
};

startApp(platform).catch((e: unknown) => reportStartFailure(e));
