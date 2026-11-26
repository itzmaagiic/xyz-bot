/** P3b T6 (R-007, R-148, R-210): run exports go to runs/ only after a secret scan; values never appear in errors. */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runDirName, scanSecrets, writeRunDirs } from '../../scripts/runs-lib.mjs';
import { RunRecorder, exportFileName } from '../../src/core/log/run-log';

// invented sample values – never real ones
const SAMPLES: [string, string][] = [
  ['email', 'contact: someone@example.invalid'],
  ['uuid', 'id 123e4567-e89b-42d3-a456-426614174000'],
  ['jwt', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.sig'],
  ['hex32', 'deadbeefdeadbeefdeadbeefdeadbeef00'],
  ['game-key', 'poke_save_token=abc'],
  ['game-key', 'pkrl_session'],
  ['json-secret-key', '{"username": "x"}'],
];

function bundleWith(reason: string) {
  let t = Date.UTC(2026, 10, 26, 20, 15, 30);
  const r = new RunRecorder({
    context: () => ({ profile: {}, mode: { setting: 'story', region: 1, variant: 'classic' } }),
    now: () => t,
    rand: () => 0.5,
  });
  const st = {
    screen: { kind: 'map' as const, screenId: 'map-screen', overlay: null, overlayId: null, signature: 'm' },
    run: null,
    version: '3.8',
    settings: null,
    bridge: true,
  };
  r.record({ kind: 'click', selector: '#a', why: reason }, st);
  t += 1000;
  r.record({ kind: 'stop', why: 'game over', result: 'loss' }, st);
  return r.exportBundle();
}

let dir: string | null = null;
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});
const tmp = () => (dir = mkdtempSync(join(tmpdir(), 'pkbot-runs-')));

describe('scanSecrets', () => {
  it.each(SAMPLES)('finds %s', (pattern, text) => {
    expect(scanSecrets(text).map((h: { pattern: string }) => h.pattern)).toContain(pattern);
  });

  it('does not flag game words that only look like keys (poke_ball, pkbot.settings, sprite names)', () => {
    expect(scanSecrets('use poke_ball on Pidgey; pkbot.settings; sprites/poke-ball.png; hp:1z3k9')).toEqual([]);
  });
});

describe('writeRunDirs (R-007)', () => {
  it('writes runs/<YYYY-MM-DD>-<HHMMSS>-<rand4>/ with decisions.jsonl (one line per decision) and summary.json', () => {
    const root = tmp();
    const dirs = writeRunDirs(bundleWith('take the route'), root);
    expect(dirs).toEqual([join(root, '2026-11-26-201530-i000')]);
    const lines = readFileSync(join(dirs[0]!, 'decisions.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]!)).toMatchObject({ outcome: 'loss', step: 2 });
    expect(JSON.parse(readFileSync(join(dirs[0]!, 'summary.json'), 'utf8'))).toMatchObject({ result: 'loss' });
  });

  it('refuses a bundle with a secret, names pattern and file but never the value, and writes nothing', () => {
    const root = tmp();
    const secret = 'someone@example.invalid';
    let msg = '';
    try {
      writeRunDirs(bundleWith(`mail ${secret}`), root);
    } catch (e) {
      msg = (e as Error).message;
    }
    expect(msg).toMatch(/secret scan failed: email in 2026-11-26-201530-i000\/decisions\.jsonl/);
    expect(msg).not.toContain(secret);
    expect(readdirSync(root)).toEqual([]);
  });

  it('writes nothing for runs: [] and rejects a wrong format', () => {
    const root = tmp();
    expect(writeRunDirs({ format: 'pkbot-runs/1', exported: '', bot_version: null, runs: [] }, root)).toEqual([]);
    expect(readdirSync(root)).toEqual([]);
    expect(() => writeRunDirs({ format: 'other', runs: [] }, root)).toThrow(/pkbot-runs\/1/);
  });

  it('runDirName rejects anything that is not a run id (no path traversal from a crafted export)', () => {
    expect(runDirName('20261126-201530-i000')).toBe('2026-11-26-201530-i000');
    expect(() => runDirName('../../etc')).toThrow(/run_id/);
  });

  it('exportFileName is pkbot-runs-<YYYYMMDD-HHMMSS>.json', () => {
    expect(exportFileName(Date.UTC(2026, 10, 26, 20, 15, 30))).toBe('pkbot-runs-20261126-201530.json');
  });
});
