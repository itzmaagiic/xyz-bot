import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// R-232/D-015: what the SessionStart hook shows from REQUIREMENTS and PROGRESS
const HOOK = join(__dirname, '..', '..', '.claude', 'hooks', 'session-start.sh');
let dir = '';
let out = '';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'pkbot-hookout-'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(
    join(dir, 'docs', 'REQUIREMENTS.md'),
    [
      '## A. Test',
      '- 🟡 **R-001** [P3] ~~Alter überholter Text~~ → Neuer gültiger Text (D-001) — Quelle: x — Nachweis: y',
      '- ❌ **R-002** [P3] Zweiter Punkt — Quelle: x — Nachweis: —',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(dir, 'docs', 'PROGRESS.md'),
    [
      '# Fortschritt',
      '**Aktuelle Phase:** P3',
      '## In Arbeit',
      '- nichts',
      '## Nächster Schritt',
      '1. weiter',
      '## Entscheidungen',
      '- keine',
      '## Erledigt (neueste oben)',
      '- 2026-11-26 · Eintrag mit Unterpunkten:',
      '  - **Unterpunkt eins** sichtbar',
      '  - Unterpunkt zwei sichtbar',
      '- 2026-11-25 · zweiter',
      '- 2026-11-24 · dritter',
      '- 2026-11-23 · vierter',
      '  - Unterpunkt des vierten (ausgeblendet)',
      '',
    ].join('\n'),
  );
  out = spawnSync('bash', [HOOK], { env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, encoding: 'utf8' }).stdout;
}, 20_000);

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('SessionStart hook output', () => {
  it('shows the sub-points of the newest "Erledigt" entries, not of older ones', () => {
    expect(out).toMatch(/Unterpunkt eins/);
    expect(out).toMatch(/Unterpunkt zwei/);
    expect(out).not.toMatch(/Unterpunkt des vierten/);
    expect(out).toMatch(/ältere Einträge siehe docs\/PROGRESS\.md/);
  });

  it('the short form shows the current text of a requirement, not its struck-out old text', () => {
    const detail = out.slice(out.indexOf('im Detail'));
    expect(detail).toMatch(/R-001 .*Neuer gültiger Text/);
    expect(detail).not.toMatch(/Alter überholter Text/);
  });
});
