/**
 * local/no-silent-catch (R-199): a catch block or a promise .catch handler must make the error visible:
 * rethrow it, call a reporter (noteError by default, option `reporters`), or log it via <x>.error(...) / <x>.warn(...).
 * Calls inside nested functions do not count (they may never run).
 */
const LOG_METHODS = new Set(['error', 'warn']);
const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function isReportCall(node, reporters) {
  if (node.type !== 'CallExpression') return false;
  const c = node.callee;
  if (c.type === 'Identifier') return reporters.has(c.name);
  // <x>.error(…) / <x>.warn(…), or a configured reporter called as a method (e.g. this.crashed(e))
  return (
    c.type === 'MemberExpression' &&
    !c.computed &&
    c.property.type === 'Identifier' &&
    (LOG_METHODS.has(c.property.name) || reporters.has(c.property.name))
  );
}

/** true if `node` (not descending into nested functions) contains a throw or a report call */
function reports(node, reporters, root = true) {
  if (!node || typeof node.type !== 'string') return false;
  if (!root && FN_TYPES.has(node.type)) return false;
  if (node.type === 'ThrowStatement' || isReportCall(node, reporters)) return true;
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    const v = node[key];
    if (Array.isArray(v)) {
      if (v.some((c) => c && typeof c.type === 'string' && reports(c, reporters, false))) return true;
    } else if (v && typeof v.type === 'string' && reports(v, reporters, false)) return true;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow catch blocks and .catch handlers that swallow errors silently (R-199)' },
    schema: [
      {
        type: 'object',
        properties: { reporters: { type: 'array', items: { type: 'string' } } },
        additionalProperties: false,
      },
    ],
    messages: {
      silent: 'Silent error: rethrow, call noteError(where, e) or log it with .error/.warn (R-199).',
    },
  },
  create(context) {
    // functions that make an error visible (default: noteError); configured in eslint.config.js
    const reporters = new Set(context.options[0]?.reporters ?? ['noteError']);
    return {
      CatchClause(node) {
        if (!reports(node.body, reporters)) context.report({ node, messageId: 'silent' });
      },
      CallExpression(node) {
        const c = node.callee;
        if (c.type !== 'MemberExpression' || c.computed || c.property.type !== 'Identifier') return;
        // the rejection handler: .catch(handler) or .then(onFulfilled, handler)
        const handler =
          c.property.name === 'catch' ? node.arguments[0] : c.property.name === 'then' ? node.arguments[1] : undefined;
        if (!handler) return;
        if (FN_TYPES.has(handler.type)) {
          if (!reports(handler.body, reporters)) context.report({ node: handler, messageId: 'silent' });
          return;
        }
        // a handler passed by reference (noop, String, this.ignore …) cannot be checked – write it inline
        if (handler.type === 'Identifier' && handler.name === 'undefined') return;
        context.report({ node: handler, messageId: 'silent' });
      },
    };
  },
};
