import { ESLint } from 'eslint';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// R-260 / D-036: behaviour of the lint guard rails WITH type information. lintText() uses the full repo config and
// an existing file path, so the TS project service knows the file; the given text replaces its content in memory.
const eslint = new ESLint({ cwd: join(__dirname, '..', '..') });
const ids = async (code: string, filePath: string) =>
  ((await eslint.lintText(code, { filePath }))[0]?.messages ?? []).map((m) => m.ruleId ?? `fatal: ${m.message}`);

const WORK = 'async function work(): Promise<void> {}\n';

describe('lint guard rails with type information (R-199, R-032, D-036)', () => {
  it.each([
    ['a floating promise', `${WORK}work();\n`, '@typescript-eslint/no-floating-promises'],
    ['void p', `${WORK}void work();\n`, '@typescript-eslint/no-floating-promises'],
    [
      'an async callback where void is expected',
      `${WORK}document.addEventListener('click', async () => { await work(); });\n`,
      '@typescript-eslint/no-misused-promises',
    ],
    [
      'el.onclick = async …',
      `${WORK}const b = document.createElement('button');\nb.onclick = async () => { await work(); };\n`,
      'local/no-promise-handler',
    ],
    [
      'el.onclick = () => promise',
      `${WORK}const b = document.createElement('button');\nb.onclick = () => work();\n`,
      'local/no-promise-handler',
    ],
    [
      'el.onclick = asyncRef',
      `${WORK}const b = document.createElement('button');\nb.onclick = work;\n`,
      'local/no-promise-handler',
    ],
  ])('flags %s in src/ui', async (_n, code, rule) => {
    expect(await ids(code, 'src/ui/toast.ts')).toContain(rule);
  });

  it('allows a sync on* handler and a promise handed to noteRejection', async () => {
    const code = `import { noteRejection } from '../core/log/note';\n${WORK}export function f(b: HTMLButtonElement): void {\n  b.onclick = () => noteRejection('x', work());\n  b.onchange = () => undefined;\n}\n`;
    expect(await ids(code, 'src/ui/toast.ts')).toEqual([]);
  });

  it.each(['src/platform/chrome/popup.ts', 'src/core/flags.ts'])(
    'flags on* promise handlers in %s too',
    async (file) => {
      const code = `${WORK}const b = document.createElement('button');\nb.onclick = () => work();\n`;
      expect(await ids(code, file)).toContain('local/no-promise-handler');
    },
  );

  it.each([
    [
      'a string key in destructuring',
      "export const { ['chrome']: c } = globalThis as unknown as Record<string, unknown>;\n",
    ],
    ['a template key in destructuring', 'export const { [`GM`]: g } = window as unknown as Record<string, unknown>;\n'],
    ['a key wrapped in as', "export const c = globalThis['chrome' as keyof typeof globalThis];\n"],
    [
      'a key wrapped in satisfies',
      "export const g = (window as unknown as Record<string, unknown>)['GM' satisfies string];\n",
    ],
  ])('R-032: core blocks %s', async (_n, code) => {
    expect(await ids(code, 'src/core/flags.ts')).toContain('no-restricted-syntax');
  });

  it('R-032 also covers the shared contract src/platform/types.ts and any new folder under src/', async () => {
    expect(await ids('export const s = chrome.storage.local;\n', 'src/platform/types.ts')).toContain(
      'no-restricted-globals',
    );
    const [r] = await eslint.lintText('export const s = 1;\n', { filePath: 'src/shared/x.ts' });
    const cfg = await eslint.calculateConfigForFile('src/shared/x.ts');
    expect(r).toBeDefined();
    expect(cfg.rules['no-restricted-globals']?.[0]).toBe(2);
  });

  it('R-032 allows a platform name as a TS literal type (no runtime access), e.g. the adapter contract', async () => {
    const code = "export interface P {\n  readonly name: 'chrome' | 'userscript';\n}\n";
    expect(await ids(code, 'src/platform/types.ts')).toEqual([]);
  });
});
