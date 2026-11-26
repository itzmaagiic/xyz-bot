import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { reportStartFailure } from '../../src/app';
import { clearNotedErrors, recentErrors } from '../../src/core/log/note';

const root = join(__dirname, '..', '..');

describe('no silent failures outside catch blocks (R-199)', () => {
  beforeEach(() => clearNotedErrors());

  it('a failed start is noted and shown to the user as a toast', () => {
    reportStartFailure(new Error('bridge exploded'), document);
    expect(recentErrors().some((e) => e.where === 'app:start' && e.msg === 'bridge exploded')).toBe(true);
    expect(document.body.textContent).toMatch(/Pokelike Bot.*bridge exploded/);
  });

  it('the platform entry points never leave the start promise floating', () => {
    for (const f of ['src/platform/userscript/main.ts', 'src/platform/chrome/content.ts']) {
      const src = readFileSync(join(root, f), 'utf8');
      expect(src, f).toMatch(/\.catch\(\(e(: unknown)?\) => reportStartFailure\(e\)\)/);
    }
  });

  it('eslint-disable in src/ only per rule and only from the allowlist – never blanket, never inline config', () => {
    // file → rules that may be disabled there (each with a reason in the comment)
    const allowed: Record<string, string[]> = {
      'src/core/log/note.ts': ['local/no-silent-catch'],
      'src/core/strategy/challenge.ts': ['@typescript-eslint/no-explicit-any'],
      'src/core/bridge/page-bridge.ts': ['@typescript-eslint/no-explicit-any'],
      'src/core/bridge/simulator.ts': ['@typescript-eslint/no-explicit-any'],
    };
    const bad: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else {
          const text = readFileSync(p, 'utf8');
          // inline rule configuration (/* eslint some/rule: "off" */) would switch rules off unnoticed (D-036)
          if (/\/\*\s*eslint\s+[^*]*:/.test(text)) bad.push(`${relative(root, p)}: inline eslint rule configuration`);
          for (const m of text.matchAll(/eslint-disable(?:-next-line|-line)?([^\n*]*)/g)) {
            const rules = (m[1] ?? '')
              .split('--')[0]!
              .split(',')
              .map((r) => r.trim())
              .filter(Boolean);
            const file = relative(root, p);
            if (!rules.length) bad.push(`${file}: blanket eslint-disable`);
            for (const r of rules) if (!(allowed[file] ?? []).includes(r)) bad.push(`${file}: ${r}`);
          }
        }
      }
    };
    walk(join(root, 'src'));
    expect(bad).toEqual([]);
  });
});
