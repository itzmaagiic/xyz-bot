import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import noSilentCatch from './eslint-rules/no-silent-catch.mjs';

const PLATFORM_NAME_RE = '/^(chrome|browser|GM|GM_\\w+|unsafeWindow)$/';
const R032 = 'Platform API – only allowed in src/platform/* (R-032).';
// R-199: `el.onclick = async () => …` returns a promise nobody handles (onclick is typed `any`, so
// no-misused-promises cannot see it) – use a sync handler that passes the promise to noteRejection
const ASYNC_HANDLER = {
  selector: "AssignmentExpression[left.type='MemberExpression'] > :function[async=true].right",
  message:
    'Async function assigned as a handler is a floating promise – use a sync handler with noteRejection (R-199).',
};
const PLATFORM_GLOBALS = [
  'chrome',
  'browser',
  'GM',
  'GM_info',
  'GM_getValue',
  'GM_setValue',
  'GM_setClipboard',
  'unsafeWindow',
];

export default tseslint.config(
  // generated or local-only output (all gitignored) is never linted
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'artifacts/**',
      'coverage/**',
      '.superpowers/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // R-199: no floating promises – a rejected promise without handler is a silent error (type-aware rules)
    files: ['src/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: false }],
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    // R-199: no silent errors – every catch rethrows, logs, or calls noteError
    files: ['src/**/*.ts'],
    plugins: { local: { rules: { 'no-silent-catch': noSilentCatch } } },
    rules: {
      'local/no-silent-catch': [
        'error',
        { reporters: ['noteError', 'noteRejection', 'reportStartFailure', 'crashed'] },
      ],
      // flat config replaces (not merges) no-restricted-syntax options – the core/ui block repeats ASYNC_HANDLER
      'no-restricted-syntax': ['error', ASYNC_HANDLER],
    },
  },
  {
    // R-032: one codebase – core/ and ui/ stay platform-neutral; only platform/types (the adapter contract) is shared
    files: ['src/core/**/*.ts', 'src/ui/**/*.ts', 'src/app.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)platform/(chrome|userscript)(/|$)|(^|/)platform/clipboard$',
              message: 'core/ and ui/ must not import platform-specific code; go through the Platform adapter (R-032).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...PLATFORM_GLOBALS.map((name) => ({
          name,
          message: 'Platform API – only allowed in src/platform/* (R-032).',
        })),
      ],
      // the same APIs reached through a global object (globalThis.chrome, window.GM, self.browser …)
      'no-restricted-properties': [
        'error',
        ...['globalThis', 'window', 'self'].flatMap((object) =>
          PLATFORM_GLOBALS.map((property) => ({
            object,
            property,
            message: 'Platform API – only allowed in src/platform/* (R-032).',
          })),
        ),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/(^|\\/)platform\\/(chrome|userscript|clipboard)/]',
          message: 'core/ and ui/ must not load platform-specific code, not even with import() (R-032).',
        },
        {
          selector: "ImportExpression[source.type!='Literal']",
          message: 'No computed import() in core/ and ui/ – it could hide a platform path (R-032).',
        },
        // threat model D-036: platform API names as ANY identifier – member on any object (casts, aliases,
        // document.defaultView, window.window), `declare const GM`, destructuring keys …
        { selector: `Identifier[name=${PLATFORM_NAME_RE}]`, message: R032 },
        { selector: `MemberExpression[computed=true][property.value=${PLATFORM_NAME_RE}]`, message: R032 },
        {
          selector: 'MemberExpression[computed=true] > TemplateLiteral.property',
          message: 'No template-literal property keys in core/ and ui/ – they could hide a platform API (R-032).',
        },
        ASYNC_HANDLER,
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint-rules/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly' } },
  },
);
