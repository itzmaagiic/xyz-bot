import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import rule from '../../eslint-rules/no-silent-catch.mjs';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: 'module' },
});

describe('local/no-silent-catch (R-199)', () => {
  tester.run('no-silent-catch', rule, {
    valid: [
      "try { f(); } catch (e) { noteError('x', e); }",
      'try { f(); } catch (e) { throw e; }',
      "class A { m() { try { f(); } catch (e) { this.log.warn('x', e); } } }",
      "try { f(); } catch (e) { log.error('x', e); return null; }",
      "p.catch((e) => noteError('x', e));",
      "p.catch(function (e) { noteError('x', e); });",
      'p.then(() => 1);',
    ],
    invalid: [
      { code: 'try { f(); } catch { /* c */ }', errors: [{ messageId: 'silent' }] },
      { code: 'try { f(); } catch (e) { return null; }', errors: [{ messageId: 'silent' }] },
      {
        code: "try { f(); } catch (e) { const g = () => noteError('x', e); }",
        errors: [{ messageId: 'silent' }],
      },
      { code: 'p.catch(() => undefined);', errors: [{ messageId: 'silent' }] },
      { code: 'p.catch(() => null);', errors: [{ messageId: 'silent' }] },
      { code: 'p.catch((e) => { return e && null; });', errors: [{ messageId: 'silent' }] },
    ],
  });
});
