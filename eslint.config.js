import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import noSilentCatch from './eslint-rules/no-silent-catch.mjs';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
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
    rules: { 'local/no-silent-catch': 'error' },
  },
  {
    // R-032: one codebase – core/ and ui/ stay platform-neutral; only platform/types (the adapter contract) is shared
    files: ['src/core/**/*.ts', 'src/ui/**/*.ts'],
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
        ...['chrome', 'browser', 'GM', 'GM_info', 'GM_getValue', 'GM_setValue', 'GM_setClipboard', 'unsafeWindow'].map(
          (name) => ({ name, message: 'Platform API – only allowed in src/platform/* (R-032).' }),
        ),
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint-rules/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', Buffer: 'readonly' } },
  },
);
