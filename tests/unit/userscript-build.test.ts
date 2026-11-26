import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkUserscript } from '../../scripts/userscript-meta.mjs';

// R-034, R-192, R-193: the real build output passes the bundle check.
const root = join(__dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string };
let out = '';
let userJs = '';
let metaJs = '';

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'pkbot-dist-'));
  execFileSync('node', ['scripts/build.mjs', 'userscript'], {
    cwd: root,
    env: { ...process.env, PKBOT_DIST: out },
    timeout: 60_000,
    stdio: 'pipe',
  });
  userJs = readFileSync(join(out, 'pokelike-bot.user.js'), 'utf8');
  metaJs = readFileSync(join(out, 'pokelike-bot.meta.js'), 'utf8');
}, 90_000);

afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('userscript build output', () => {
  it('passes checkUserscript', () => {
    expect(checkUserscript({ userJs, metaJs, version: pkg.version })).toEqual([]);
  });

  it('embeds the bot version for the run logs (D-038)', () => {
    expect(userJs).toMatch(new RegExp(`BOT_VERSION = [^;]*"${pkg.version.replace(/\./g, '\\.')}"`));
  });

  it('carries the update URL', () => {
    expect(metaJs).toMatch(/@updateURL\s+https:\/\/raw\.githubusercontent\.com\//);
  });

  it('embeds the page bridge readable and multi-line, not minified (R-107)', () => {
    expect(userJs).toMatch(/^\s*function serializeMon\(/m);
    expect(userJs).not.toContain('__PKBOT_BRIDGE_SRC__');
  });
});
