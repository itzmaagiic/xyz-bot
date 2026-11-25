/**
 * Userscript entry (Userscripts for iOS/iPadOS Safari, Tampermonkey, Violentmonkey).
 * Only the GM.* API intersection is used (R-099, docs/USERSCRIPT_API.md); everything else is feature-detected.
 * Bridge: injected <script> element into the page (CustomEvent protocol); DOM fallback if that fails.
 */
import { startApp } from '../../app';
import { READY_ATTR } from '../../core/bridge/protocol';
import { noteError } from '../../core/log/note';
import { copyViaDom } from '../clipboard';
import { bindPageShortcuts, type Platform } from '../types';
import { makeStorage, type StorageEnv } from './storage';

declare const __BRIDGE_CODE__: string;
declare const GM:
  (NonNullable<StorageEnv['gm']> & { setClipboard?: (data: string, type?: string) => Promise<unknown> }) | undefined;

const gm = typeof GM !== 'undefined' ? GM : undefined;

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
  storage: makeStorage({ gm: gm ?? null, local: safeLocalStorage() }),
  async copyText(text) {
    if (gm?.setClipboard) {
      try {
        const ok = await gm.setClipboard(text, 'text/plain');
        if (ok !== false) return true; // Userscripts resolves a boolean, TM/VM resolve undefined
      } catch (e) {
        noteError('userscript:clipboard', e);
      }
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
