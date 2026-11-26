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

  it('only allow-listed files may disable local/no-silent-catch', () => {
    const allowed = ['src/core/log/note.ts'];
    const found: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/eslint-disable[^\n]*no-silent-catch/.test(readFileSync(p, 'utf8'))) found.push(relative(root, p));
      }
    };
    walk(join(root, 'src'));
    expect(found.sort()).toEqual(allowed);
  });
});
