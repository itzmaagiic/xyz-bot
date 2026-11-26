import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import noSilentCatch from './eslint-rules/no-silent-catch.mjs';

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
    // R-199: no silent errors – every catch rethrows, logs, or calls noteError
    files: ['src/**/*.ts'],
    plugins: { local: { rules: { 'no-silent-catch': noSilentCatch } } },
    rules: { 'local/no-silent-catch': ['error', { reporters: ['noteError', 'reportStartFailure'] }] },
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
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint-rules/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly' } },
  },
);
