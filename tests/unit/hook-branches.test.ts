import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// R-247: the SessionStart hook warns about origin branches whose state is not contained in HEAD (D-016).
const HOOK = join(__dirname, '..', '..', '.claude', 'hooks', 'session-start.sh');
const ID = ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'init.defaultBranch=main'];
let tmp = '';
let clone = '';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', [...ID, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function commit(cwd: string, file: string) {
  writeFileSync(join(cwd, file), file);
  git(cwd, 'add', file);
  git(cwd, 'commit', '-q', '-m', file);
}

function runHook(dir: string) {
  const r = spawnSync('bash', [HOOK], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    encoding: 'utf8',
    timeout: 20_000,
  });
  return { code: r.status, out: r.stdout };
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'pkbot-hook-'));
  const remote = join(tmp, 'remote.git');
  git(tmp, 'init', '-q', '--bare', remote);
  clone = join(tmp, 'clone');
  git(tmp, 'clone', '-q', remote, clone);
  commit(clone, 'a');
  git(clone, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  git(clone, 'push', '-q', 'origin', 'HEAD:refs/heads/old'); // merged: ancestor of HEAD
  git(clone, 'checkout', '-q', '-b', 'feature');
  commit(clone, 'b');
  git(clone, 'push', '-q', 'origin', 'HEAD:refs/heads/feature'); // not in main's HEAD
  git(clone, 'checkout', '-q', 'main');
  git(clone, 'branch', '-q', '-D', 'feature');
  git(clone, 'update-ref', '-d', 'refs/remotes/origin/feature'); // as in a fresh clone that never fetched it
  git(clone, 'gc', '-q', '--prune=now'); // drop the commit object locally
});

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('SessionStart hook: remote branch warning (R-247)', () => {
  it('warns about a remote branch that is not contained in HEAD', () => {
    const { code, out } = runHook(clone);
    expect(code).toBe(0);
    expect(out).toMatch(/⚠️ Remote-Branches mit Stand, der nicht in HEAD enthalten ist:.*feature \(/);
  });

  it('stays quiet about merged branches', () => {
    const { out } = runHook(clone);
    expect(out).not.toMatch(/\bold \(/);
    expect(out).not.toMatch(/\bmain \(/);
  });

  it('prints a notice, not a failure, when origin is unreachable', () => {
    git(clone, 'remote', 'set-url', 'origin', join(tmp, 'does-not-exist.git'));
    const { code, out } = runHook(clone);
    git(clone, 'remote', 'set-url', 'origin', join(tmp, 'remote.git'));
    expect(code).toBe(0);
    expect(out).toMatch(/Remote-Branches nicht geprüft/);
  });

  it('lists handled branches from .claude/hooks/branches-handled.txt as "nicht mergen" instead of warning', () => {
    const dir = join(clone, '.claude', 'hooks');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'branches-handled.txt'),
      '# name  reason\nfeature  enthält alten Verlauf, Nutzer löscht ihn (D-024)\n',
    );
    const { code, out } = runHook(clone);
    rmSync(join(dir, 'branches-handled.txt'));
    expect(code).toBe(0);
    expect(out).not.toMatch(/⚠️ Remote-Branches/);
    expect(out).toMatch(/nicht mergen.*feature \(.*D-024/);
  });
});
