/**
 * Emulates a userscript manager: GM.* shim + the built .user.js.
 * Chromium: runs inside a real isolated world (CDP Page.createIsolatedWorld) like Tampermonkey/Userscripts' content
 * world. WebKit has no CDP → main world (documented limitation of the test, not of the script).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';

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

export async function injectUserscript(page: Page, browserName: string): Promise<'isolated' | 'main'> {
  const code = GM_SHIM + '\n' + readFileSync(USER_JS, 'utf8');
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
    return 'isolated';
  }
  await page.evaluate(code);
  return 'main';
}
