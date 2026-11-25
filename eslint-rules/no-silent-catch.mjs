/**
 * local/no-silent-catch (R-199): a catch block or a promise .catch handler must make the error visible:
 * rethrow it, call noteError(...), or log it via <x>.error(...) / <x>.warn(...).
 * Calls inside nested functions do not count (they may never run).
 */
const LOG_METHODS = new Set(['error', 'warn']);
const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function isReportCall(node) {
  if (node.type !== 'CallExpression') return false;
  const c = node.callee;
  if (c.type === 'Identifier') return c.name === 'noteError';
  return (
    c.type === 'MemberExpression' && !c.computed && c.property.type === 'Identifier' && LOG_METHODS.has(c.property.name)
  );
}

/** true if `node` (not descending into nested functions) contains a throw or a report call */
function reports(node, root = true) {
  if (!node || typeof node.type !== 'string') return false;
  if (!root && FN_TYPES.has(node.type)) return false;
  if (node.type === 'ThrowStatement' || isReportCall(node)) return true;
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const v = node[key];
    if (Array.isArray(v)) {
      if (v.some((c) => c && typeof c.type === 'string' && reports(c, false))) return true;
    } else if (v && typeof v.type === 'string' && reports(v, false)) return true;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow catch blocks and .catch handlers that swallow errors silently (R-199)' },
    schema: [],
    messages: {
      silent: 'Silent error: rethrow, call noteError(where, e) or log it with .error/.warn (R-199).',
    },
  },
  create(context) {
    return {
      CatchClause(node) {
        if (!reports(node.body)) context.report({ node, messageId: 'silent' });
      },
      CallExpression(node) {
        const c = node.callee;
        if (
          c.type !== 'MemberExpression' ||
          c.computed ||
          c.property.type !== 'Identifier' ||
          c.property.name !== 'catch'
        )
          return;
        const fn = node.arguments[0];
        if (!fn || !FN_TYPES.has(fn.type)) return;
        if (!reports(fn.body)) context.report({ node: fn, messageId: 'silent' });
      },
    };
  },
};
