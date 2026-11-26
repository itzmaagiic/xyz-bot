/**
 * local/no-promise-handler (R-199, D-036): a function assigned to an `on*` property (el.onclick = …) must not return a
 * promise – nobody handles it, so a rejection would be silent. `on*` handlers are typed loosely (`… => any`), so
 * @typescript-eslint/no-misused-promises cannot see this. Type-aware: catches `async () => …`, `() => work()` and a
 * reference to an async function alike. Use a sync handler that hands the promise to noteRejection.
 */
/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow on* handlers that return a promise (R-199)' },
    schema: [],
    messages: {
      promise: 'Handler for {{name}} returns a promise nobody handles – use a sync handler with noteRejection (R-199).',
    },
  },
  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program || !services.esTreeNodeToTSNodeMap) return {}; // no type information → nothing to check
    const checker = services.program.getTypeChecker();
    const thenable = (t) =>
      t.isUnion() ? t.types.some(thenable) : !!checker.getPropertyOfType(checker.getApparentType(t), 'then');
    // a handler of union type (`cond ? async () => … : null`, `h: (() => Promise<void>) | null`) counts like the handler
    const returnsThenable = (node) => {
      const type = checker.getNonNullableType(checker.getTypeAtLocation(services.esTreeNodeToTSNodeMap.get(node)));
      const parts = type.isUnion() ? type.types : [type];
      return parts.some((t) => t.getCallSignatures().some((sig) => thenable(sig.getReturnType())));
    };
    // TypeScript reduces `cond ? () => void : () => Promise<void>` to `() => void` (subtype reduction), so every
    // branch of ?:, ??, ||, && (and the last expression of a sequence) is typed on its own
    const branches = (n) =>
      n.type === 'ConditionalExpression'
        ? [...branches(n.consequent), ...branches(n.alternate)]
        : n.type === 'LogicalExpression'
          ? [...branches(n.left), ...branches(n.right)]
          : n.type === 'SequenceExpression'
            ? branches(n.expressions[n.expressions.length - 1])
            : [n];
    return {
      AssignmentExpression(node) {
        const l = node.left;
        if (l.type !== 'MemberExpression' || l.computed || l.property.type !== 'Identifier') return;
        if (!/^on[a-z]+$/.test(l.property.name)) return;
        if (branches(node.right).some(returnsThenable))
          context.report({ node: node.right, messageId: 'promise', data: { name: l.property.name } });
      },
    };
  },
};
