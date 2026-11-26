/**
 * local/no-adapter-import (R-032, D-036): code outside the platform adapters must not load adapter code.
 * Path-resolving, so it works from every directory – also from src/platform/types.ts or a new file next to it,
 * where the relative path is `./chrome/…` and contains no `platform/`. Covers import, export … from, import() and
 * `import x = require()`.
 */
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// repo root from the rule's own location – not context.cwd, so an IDE or `cd src` gives the same result
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ADAPTER = /^src\/platform\/(?:chrome|userscript)(?:\/|$)|^src\/platform\/clipboard(?:\.[cm]?[jt]s)?$/;
const ALIAS = /(^|\/)platform\/(?:chrome|userscript)(?:\/|$)|(^|\/)platform\/clipboard(?:\.[cm]?[jt]s)?$/;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow loading platform adapter code outside src/platform/{chrome,userscript} (R-032)' },
    schema: [],
    messages: { adapter: '"{{spec}}" is platform adapter code – go through the Platform contract (R-032).' },
  },
  create(context) {
    const here = dirname(context.filename);
    const isAdapter = (spec) => {
      if (spec.startsWith('.')) return ADAPTER.test(relative(ROOT, resolve(here, spec)).split('\\').join('/'));
      return ALIAS.test(spec); // path aliases such as '@/platform/chrome/…' or 'src/platform/userscript/…'
    };
    const check = (node, source) => {
      if (source?.type === 'Literal' && typeof source.value === 'string' && isAdapter(source.value))
        context.report({ node, messageId: 'adapter', data: { spec: source.value } });
    };
    return {
      ImportDeclaration: (n) => check(n, n.source),
      ExportAllDeclaration: (n) => check(n, n.source),
      ExportNamedDeclaration: (n) => check(n, n.source),
      ImportExpression: (n) => check(n, n.source),
      TSImportEqualsDeclaration: (n) => check(n, n.moduleReference?.expression),
    };
  },
};
