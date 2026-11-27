/**
 * Emulates a userscript manager: GM.* shim + the built .user.js.
 * Chromium: runs inside a real isolated world (CDP Page.createIsolatedWorld) like Tampermonkey/Userscripts' content
 * world. WebKit has no CDP → main world (documented limitation of the test, not of the script).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CDPSession, Page } from '@playwright/test';

const USER_JS = join(import.meta.dirname, '..', '..', 'dist', 'pokelike-bot.user.js');

const GM_SHIM = `
(() => {
  const store = new Map();
  globalThis.GM = {
    getValue: async (k, d) => (store.has(k) ? store.get(k) : d),
    setValue: async (k, v) => { store.set(k, v); },
    setClipboard: async (t) => { globalThis.__gmClipboard = t; },
    info: { script: { name: 'Pokelike Bot' }, scriptHandler: 'test-shim' },
  };
})();
`;

/** a manager whose GM.setValue fails (e.g. quota) and that has nothing stored */
const GM_THROWING = `
(() => {
  globalThis.GM = {
    getValue: async (k, d) => d,
    setValue: async () => { throw new Error('quota exceeded'); },
    setClipboard: async (t) => { globalThis.__gmClipboard = t; },
  };
})();
`;

/** private browsing on the iPhone, emulated: GM writes fail and localStorage refuses every write (R-259) */
const VOLATILE =
  GM_THROWING +
  `
(() => {
  Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };
})();
`;

/**
 * which storage the emulated manager offers: the normal GM shim, none at all, one whose writes fail (R-100, R-102),
 * or nothing that persists at all (R-259)
 */
export type GmMode = 'shim' | 'none' | 'throwing' | 'volatile';

export async function injectUserscript(
  page: Page,
  browserName: string,
  gm: GmMode = 'shim',
): Promise<'isolated' | 'main'> {
  const prelude = { shim: GM_SHIM, throwing: GM_THROWING, volatile: VOLATILE, none: '' }[gm];
  const code = prelude + '\n' + readFileSync(USER_JS, 'utf8');
  if (browserName === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const { frameTree } = await cdp.send('Page.getFrameTree');
    const { executionContextId } = await cdp.send('Page.createIsolatedWorld', {
      frameId: frameTree.frame.id,
      worldName: 'userscript-test',
      grantUniveralAccess: true,
    });
    const r = await cdp.send('Runtime.evaluate', { expression: code, contextId: executionContextId });
    if (r.exceptionDetails) throw new Error('userscript threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 500));
    worlds.set(page, { cdp, contextId: executionContextId });
    return 'isolated';
  }
  await page.evaluate(code);
  return 'main';
}

const worlds = new WeakMap<Page, { cdp: CDPSession; contextId: number }>();

/** Runs code in the world the userscript runs in (Chromium: its isolated world, WebKit: the main world). */
export async function evaluateInUserscriptWorld(page: Page, code: string): Promise<void> {
  const w = worlds.get(page);
  if (!w) {
    await page.evaluate(code);
    return;
  }
  const r = await w.cdp.send('Runtime.evaluate', { expression: code, contextId: w.contextId });
  if (r.exceptionDetails) throw new Error('evaluate threw: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
}
