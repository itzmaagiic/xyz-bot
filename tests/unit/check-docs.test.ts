import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkDocs } from '../../scripts/check-docs.mjs';

const REQ = [
  '- Nächste freie ID: **R-004**',
  '- ✅ **R-001** [P0] a — Quelle: x — Nachweis: Test',
  '- 🟡 **R-002** [P1] b, siehe D-001 — Quelle: x — Nachweis: y. **Lücke:** z',
  '- ❌ **R-003** [P1] c — Quelle: x — Nachweis: —',
].join('\n');
const PLAN = ['## Phase 0 – A', '**R-IDs:** R-001', '## Phase 1 – B', '**R-IDs:** R-002 bis R-003'].join('\n');
const DEC = '**D-001 – x** (2026-11-25)\n';

function run(over: Partial<Parameters<typeof checkDocs>[0]> = {}) {
  return checkDocs({ requirements: REQ, plan: PLAN, decisions: DEC, others: [], ...over });
}
const has = (errs: string[], re: RegExp) => errs.some((e) => re.test(e));

describe('check:docs (R-246)', () => {
  it('ok case', () => {
    expect(run({ others: [{ name: 'CLAUDE.md', text: 'see R-002 and D-001' }], previousRequirements: REQ })).toEqual(
      [],
    );
  });

  it('duplicate id', () => {
    expect(
      has(
        run({ requirements: REQ + '\n- ❌ **R-003** [P1] dup — Quelle: x — Nachweis: —' }),
        /R-003.*(twice|duplicate)/,
      ),
    ).toBe(true);
  });

  it('gap', () => {
    const req = REQ.replace('**R-002** [P1]', '**R-005** [P1]').replace('R-004**', 'R-006**');
    expect(
      has(run({ requirements: req, plan: PLAN.replace('R-002 bis R-003', 'R-003, R-005') }), /gap|missing.*R-002/i),
    ).toBe(true);
  });

  it('wrong next id', () => {
    expect(has(run({ requirements: REQ.replace('R-004**', 'R-009**') }), /Nächste freie ID/)).toBe(true);
  });

  it('tag not in plan (both directions)', () => {
    const errs = run({ plan: PLAN.replace('R-002 bis R-003', 'R-002') });
    expect(has(errs, /R-003.*\[P1\].*PLAN/)).toBe(true);
    const errs2 = run({ plan: PLAN.replace('**R-IDs:** R-001', '**R-IDs:** R-001, R-003') });
    expect(has(errs2, /R-003.*Phase 0/)).toBe(true);
  });

  it('a done item may be listed again in a later phase', () => {
    expect(run({ plan: PLAN + ', R-001' })).toEqual([]);
  });

  it('unknown R ref in another doc', () => {
    expect(has(run({ others: [{ name: 'docs/X.md', text: 'see R-077' }] }), /docs\/X\.md.*R-077/)).toBe(true);
  });

  it('unknown D ref', () => {
    expect(has(run({ others: [{ name: 'src/a.ts', text: '// D-009' }] }), /src\/a\.ts.*D-009/)).toBe(true);
  });

  it('✅ with Lücke', () => {
    expect(
      has(run({ requirements: REQ.replace('Nachweis: Test', 'Nachweis: Test. **Lücke:** x') }), /R-001.*Lücke/),
    ).toBe(true);
  });

  it('✅ without evidence', () => {
    expect(has(run({ requirements: REQ.replace('Nachweis: Test', 'Nachweis: —') }), /R-001.*Nachweis/)).toBe(true);
  });

  it('a strikethrough in REQUIREMENTS must name its D-entry', () => {
    const req = REQ.replace('c — Quelle', '~~c~~ → d — Quelle');
    expect(has(run({ requirements: req }), /R-003.*durchgestrichen.*D-/)).toBe(true);
    expect(run({ requirements: REQ.replace('c — Quelle', '~~c~~ → d (D-001) — Quelle') })).toEqual([]);
  });

  it('id removed vs any previous version (HEAD or origin/main)', () => {
    const prev = REQ.replace('R-004**', 'R-005**') + '\n- ❌ **R-004** [P1] d — Quelle: x — Nachweis: —';
    expect(has(run({ previousRequirements: [REQ, prev] }), /R-004.*removed/)).toBe(true);
  });

  it('id removed vs previous version (memory protection)', () => {
    const prev = REQ.replace('R-004**', 'R-005**') + '\n- ❌ **R-004** [P1] d — Quelle: x — Nachweis: —';
    expect(has(run({ previousRequirements: prev }), /R-004.*removed/)).toBe(true);
  });

  it('the real memory documents pass (npm run check:docs)', () => {
    const out = execFileSync('node', ['scripts/check-docs.mjs'], {
      cwd: join(__dirname, '..', '..'),
      encoding: 'utf8',
    });
    expect(out).toMatch(/check:docs OK/);
  });
});
