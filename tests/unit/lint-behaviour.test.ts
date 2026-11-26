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

  // B5 (Runde 5): handlers with a union type (… | null) are judged like the handler itself
  it.each([
    [
      'a conditional handler',
      `${WORK}declare const on: boolean;\nconst b = document.createElement('button');\nb.onclick = on ? async () => { await work(); } : null;\n`,
    ],
    [
      'a nullable handler variable',
      `${WORK}declare const h: (() => Promise<void>) | null;\nconst b = document.createElement('button');\nb.onclick = h;\n`,
    ],
    [
      'an optional handler with ??',
      `${WORK}declare const o: { onClick?: () => Promise<void> };\nconst b = document.createElement('button');\nb.onclick = o.onClick ?? null;\n`,
    ],
  ])('flags %s that returns a promise', async (_n, code) => {
    expect(await ids(code, 'src/ui/toast.ts')).toContain('local/no-promise-handler');
  });

  // B7 (Runde 6): TypeScript's subtype reduction drops `() => Promise<void>` next to a `() => void` branch –
  // the rule checks every branch of ?:, ??, || and && on its own
  it.each([
    [
      'sync ? sync : async',
      `${WORK}declare const on: boolean;\ndeclare const s: () => void;\nconst b = document.createElement('button');\nb.onclick = on ? s : work;\n`,
    ],
    [
      'async ? … : sync',
      `${WORK}declare const on: boolean;\ndeclare const s: () => void;\nconst b = document.createElement('button');\nb.onclick = on ? work : s;\n`,
    ],
    [
      'optional ?? sync',
      `${WORK}declare const o: { onClick?: () => Promise<void> };\ndeclare const s: () => void;\nconst b = document.createElement('button');\nb.onclick = o.onClick ?? s;\n`,
    ],
    [
      'optional || sync',
      `${WORK}declare const o: { onClick?: () => Promise<void> };\ndeclare const s: () => void;\nconst b = document.createElement('button');\nb.onclick = o.onClick || s;\n`,
    ],
    [
      'a start/stop toggle',
      `${WORK}declare const running: boolean;\nfunction toggle(): void {}\nconst b = document.createElement('button');\nb.onclick = running ? () => toggle() : () => work();\n`,
    ],
  ])('flags a handler whose %s branch returns a promise', async (_n, code) => {
    expect(await ids(code, 'src/ui/toast.ts')).toContain('local/no-promise-handler');
  });

  it('allows ?: and ?? when every branch is sync', async () => {
    const code =
      'declare const on: boolean;\ndeclare const s: () => void;\ndeclare const o: { onClick?: () => void };\nexport function f(b: HTMLButtonElement): void {\n  b.onclick = on ? s : () => undefined;\n  b.onchange = o.onClick ?? s;\n}\n';
    expect(await ids(code, 'src/ui/toast.ts')).toEqual([]);
  });

  // V1: a `.js` suffix on the clipboard helper must not slip through
  it('core may not import the platform clipboard helper with a .js suffix', async () => {
    expect(
      await ids(
        "import { copyViaDom } from '../platform/clipboard.js';\nexport const f = copyViaDom;\n",
        'src/core/flags.ts',
      ),
    ).toContain('local/no-adapter-import');
  });

  // B6 (Runde 5): the import boundary resolves paths – from inside src/platform/ too (types.ts, new files)
  it.each([
    ['an import', "import { copyWithFallback } from './userscript/copy';\nexport const f = copyWithFallback;\n"],
    ['a re-export *', "export * from './chrome/messages';\n"],
    ['a named re-export', "export { makeStorage } from './userscript/storage';\n"],
    ['the clipboard helper', "import { copyViaDom } from './clipboard';\nexport const f = copyViaDom;\n"],
    ['a dynamic import()', "export const m = () => import('./userscript/copy');\n"],
  ])('src/platform/types.ts may not reach adapter code via %s', async (_n, code) => {
    expect(await ids(code, 'src/platform/types.ts')).toContain('local/no-adapter-import');
  });

  it('a new shared folder is checked by behaviour, not only by configuration', async () => {
    expect(
      await ids("import { x } from '../platform/chrome/messages';\nexport const y = x;\n", 'src/core/flags.ts'),
    ).toContain('local/no-adapter-import');
  });
});

describe('src/ contains only TypeScript and static assets (lint scope = build scope)', () => {
  it('no .js/.mjs/.cjs/.mts/.cts/.tsx under src/', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (!/\.ts$/.test(f) && !/\/static\/[^/]+\.(html|css)$/.test(p)) bad.push(p);
      }
    };
    walk(join(__dirname, '..', '..', 'src'));
    expect(bad).toEqual([]);
  });
});

// V2: the guard rails do not depend on the working directory (IDE, sub folder)
describe('lint guard rails independent of the working directory', () => {
  it('finds the same adapter import from cwd = src/', async () => {
    const inSrc = new ESLint({ cwd: join(__dirname, '..', '..', 'src') }); // finds eslint.config.js upwards, like an IDE;
    const [r] = await inSrc.lintText("export * from './chrome/messages';\n", {
      filePath: join(__dirname, '..', '..', 'src', 'platform', 'types.ts'),
    });
    expect((r?.messages ?? []).map((m) => m.ruleId)).toContain('local/no-adapter-import');
  });
});
