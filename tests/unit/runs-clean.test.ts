/** R-007, R-148, R-210: everything committed under runs/ passes the secret scan and has the D-005 / R-009 shape. */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanSecrets } from '../../scripts/runs-lib.mjs';

const ROOT = join(import.meta.dirname, '..', '..', 'runs');
const D005 = ['ts', 'run_id', 'step', 'game_version', 'screen', 'state', 'options', 'scores', 'chosen', 'reason'];
const D005_MORE = ['confidence', 'profile', 'mode', 'outcome'];
const SUMMARY = ['result', 'progress', 'durationMs', 'game_version', 'mode', 'profile', 'cause'];

function files(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('runs/ in the repository (R-007, R-148, R-210)', () => {
  const all = files(ROOT);

  it('every file passes the secret scan', () => {
    for (const f of all) expect(scanSecrets(readFileSync(f, 'utf8')), f).toEqual([]);
  });

  it('every decisions.jsonl line has the D-005 fields', () => {
    for (const f of all.filter((p) => p.endsWith('decisions.jsonl'))) {
      for (const line of readFileSync(f, 'utf8').trim().split('\n').filter(Boolean)) {
        const o = JSON.parse(line) as Record<string, unknown>;
        for (const k of [...D005, ...D005_MORE]) expect(o, `${f}: ${k}`).toHaveProperty(k);
      }
    }
  });

  it('every summary.json has the R-009 fields', () => {
    for (const f of all.filter((p) => p.endsWith('summary.json'))) {
      const o = JSON.parse(readFileSync(f, 'utf8')) as Record<string, unknown>;
      for (const k of SUMMARY) expect(o, `${f}: ${k}`).toHaveProperty(k);
    }
  });
});
