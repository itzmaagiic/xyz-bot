import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// R-232: the SessionStart hook shows, for every phase, all open IDs, the next step and the current phase's short form
describe('SessionStart hook budget (R-232)', () => {
  it('scripts/check-hook-budget.sh passes for P0–P7', () => {
    const root = join(__dirname, '..', '..');
    const r = spawnSync('bash', [join(root, 'scripts', 'check-hook-budget.sh')], { encoding: 'utf8', timeout: 60_000 });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });
});
