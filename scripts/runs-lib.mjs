// Run logs into the repository (R-007, D-038): a pkbot-runs/1 export becomes runs/<YYYY-MM-DD>-<HHMMSS>-<rand4>/
// with decisions.jsonl and summary.json – only if the secret scan finds nothing (R-148, R-210). Errors name the
// pattern and the file, never the matched value.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** What must never land in runs/: personal data, tokens and the game's sensitive storage keys. */
export const SECRET_PATTERNS = [
  ['email', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ['uuid', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g],
  ['hex32', /\b[0-9a-f]{32,}\b/gi],
  ['game-key', /\b(?:poke_(?:save_token(?:_exp)?|save_owner|username|soul_link_live|run_sync)|pkrl_\w+)/g],
  ['json-secret-key', /"(?:token|username|owner|password|email)"\s*:/gi],
];

/** @returns {{ pattern: string, index: number }[]} */
export function scanSecrets(text) {
  const hits = [];
  for (const [pattern, re] of SECRET_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) hits.push({ pattern, index: m.index ?? 0 });
  }
  return hits;
}

/** `20261126-201530-k3f9` → `2026-11-26-201530-k3f9`; anything else is refused (no paths from a crafted export). */
export function runDirName(runId) {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{6})-([0-9a-z]{4})$/.exec(String(runId));
  if (!m) throw new Error(`invalid run_id: not of the form YYYYMMDD-HHMMSS-xxxx`);
  return `${m[1]}-${m[2]}-${m[3]}-${m[4]}-${m[5]}`;
}

/** Scans every file first and writes only when all are clean. @returns {string[]} the written directories */
export function writeRunDirs(bundle, root) {
  if (!bundle || bundle.format !== 'pkbot-runs/1' || !Array.isArray(bundle.runs))
    throw new Error('not a pkbot-runs/1 export');
  const plan = bundle.runs.map((r) => {
    const name = runDirName(r?.summary?.run_id);
    const decisions = Array.isArray(r.decisions) ? r.decisions : [];
    const files = {
      'decisions.jsonl': decisions.map((l) => JSON.stringify(l)).join('\n') + (decisions.length ? '\n' : ''),
      'summary.json': JSON.stringify(r.summary, null, 2) + '\n',
    };
    for (const [file, text] of Object.entries(files)) {
      const hits = scanSecrets(text);
      if (hits.length)
        throw new Error(
          `secret scan failed: ${[...new Set(hits.map((h) => h.pattern))].join(', ')} in ${name}/${file}`,
        );
    }
    return { dir: join(root, name), files };
  });
  for (const p of plan) {
    mkdirSync(p.dir, { recursive: true });
    for (const [file, text] of Object.entries(p.files)) writeFileSync(join(p.dir, file), text);
  }
  return plan.map((p) => p.dir);
}
