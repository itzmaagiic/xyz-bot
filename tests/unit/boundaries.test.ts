import { ESLint } from 'eslint';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// R-032: core/ and ui/ must not reach into platform-specific code or platform globals.
const eslint = new ESLint({ cwd: join(__dirname, '..', '..') });

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [res] = await eslint.lintText(code, { filePath });
  return (res?.messages ?? []).map((m) => m.ruleId ?? 'fatal');
}

describe('import boundaries (R-032)', () => {
  it('core may not import platform/chrome', async () => {
    const ids = await ruleIds("import { a } from '../platform/chrome/content';\nexport const b = a;\n", 'src/core/x.ts');
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
});
