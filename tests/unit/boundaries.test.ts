import { ESLint } from 'eslint';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// R-032: core/ and ui/ must not reach into platform-specific code or platform globals.
// The repo config, minus type information: lintText() checks virtual files that are not part of the TS project.
// The import-boundary rules under test come unchanged from eslint.config.js.
const eslint = new ESLint({
  cwd: join(__dirname, '..', '..'),
  overrideConfig: [
    {
      files: ['src/**/*.ts'],
      languageOptions: { parserOptions: { projectService: false } },
      rules: { '@typescript-eslint/no-floating-promises': 'off', '@typescript-eslint/no-misused-promises': 'off' },
    },
  ],
});

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath });
  return (res?.messages ?? []).map((m) => m.ruleId ?? 'fatal');
}

describe('import boundaries (R-032)', () => {
  it('core may not import platform/chrome', async () => {
    const ids = await ruleIds(
      "import { a } from '../platform/chrome/content';\nexport const b = a;\n",
      'src/core/x.ts',
    );
    expect(ids).toContain('no-restricted-imports');
  });

  it('ui may not import platform/userscript or the platform clipboard helper', async () => {
    const ids = await ruleIds(
      "import { a } from '../platform/userscript/main';\nimport { copyViaDom } from '../platform/clipboard';\nexport const b = [a, copyViaDom];\n",
      'src/ui/x.ts',
    );
    expect(ids.filter((i) => i === 'no-restricted-imports')).toHaveLength(2);
  });

  it('ui may not use the chrome global', async () => {
    const ids = await ruleIds("export const p = chrome.storage.local.get('a');\n", 'src/ui/x.ts');
    expect(ids).toContain('no-restricted-globals');
  });

  it('core may not use the GM global', async () => {
    const ids = await ruleIds("export const p = GM.getValue('a');\n", 'src/core/x.ts');
    expect(ids).toContain('no-restricted-globals');
  });

  it('core may use the platform-neutral contract platform/types', async () => {
    const ids = await ruleIds(
      "import type { Platform } from '../platform/types';\nexport type P = Platform;\n",
      'src/core/x.ts',
    );
    expect(ids).toEqual([]);
  });

  it('platform/chrome may use chrome', async () => {
    const ids = await ruleIds("export const p = chrome.storage.local.get('a');\n", 'src/platform/chrome/x.ts');
    expect(ids).not.toContain('no-restricted-globals');
    expect(ids).not.toContain('no-restricted-imports');
  });

  it.each([
    ['globalThis.chrome', 'export const p = globalThis.chrome;\n'],
    ['window.GM', 'export const p = window.GM;\n'],
    ['self.browser', 'export const p = self.browser;\n'],
  ])('core may not reach platform APIs via %s', async (_n, code) => {
    expect(await ruleIds(code, 'src/core/x.ts')).toContain('no-restricted-properties');
  });

  it('core may not load platform code with a dynamic import()', async () => {
    const ids = await ruleIds("export const m = () => import('../platform/chrome/content');\n", 'src/core/x.ts');
    expect(ids).toContain('no-restricted-syntax');
  });

  it('the shared bootstrap src/app.ts follows the same boundaries', async () => {
    const ids = await ruleIds(
      "import { a } from './platform/userscript/main';\nexport const p = [a, chrome.runtime];\n",
      'src/app.ts',
    );
    expect(ids).toContain('no-restricted-imports');
    expect(ids).toContain('no-restricted-globals');
  });

  it.each([
    ['a cast', 'export const p = (globalThis as unknown as { GM: unknown }).GM;\n'],
    ['document.defaultView', 'export const p = document.defaultView?.chrome;\n'],
    ['an alias', 'const g = globalThis;\nexport const p = g.chrome;\n'],
    ['window.window', 'export const p = window.window.chrome;\n'],
    ['a computed key', "export const p = window['GM_setValue'];\n"],
  ])('core may not reach platform APIs through %s', async (_n, code) => {
    const ids = await ruleIds(code, 'src/core/x.ts');
    expect(ids.some((i) => i === 'no-restricted-syntax' || i === 'no-restricted-properties')).toBe(true);
  });

  it('core may not use a computed import() (could hide a platform path)', async () => {
    const ids = await ruleIds("export const m = () => import('../platform/' + 'chrome/content');\n", 'src/core/x.ts');
    expect(ids).toContain('no-restricted-syntax');
  });

  it('the type-aware promise rules are active for src/ (R-199: no floating promises)', async () => {
    const real = new ESLint({ cwd: join(__dirname, '..', '..') });
    const cfg = await real.calculateConfigForFile('src/core/bot.ts');
    expect(cfg.rules['@typescript-eslint/no-floating-promises']).toEqual([2, { ignoreVoid: false }]);
    expect(cfg.rules['@typescript-eslint/no-misused-promises']?.[0]).toBe(2);
  });
});
