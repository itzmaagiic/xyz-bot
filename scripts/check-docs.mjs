// npm run check:docs (R-246): consistency of the memory documents.
// - R-IDs unique and gap-free from R-001, "Nächste freie ID" = max + 1, every R-line tagged [P0]–[P7]
// - tags match docs/PLAN.md in both directions (a ✅ item may be listed again in a later phase)
// - every R-NNN / D-NNN referenced anywhere exists
// - ✅ only with evidence: a non-empty "Nachweis:" and no "**Lücke:**"
// - no R-ID of the committed version (git HEAD) has disappeared (memory protection, CLAUDE.md)
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINE = /^\s*- (✅|🟡|❌) \*\*R-(\d{3})\*\* \[P(\d)\]/;
const NEXT = /Nächste freie ID: \*\*R-(\d{3})\*\*/;
const pad = (n) => 'R-' + String(n).padStart(3, '0');

function parseRequirements(text) {
  const items = [];
  for (const line of text.split('\n')) {
    const m = LINE.exec(line);
    if (m) items.push({ st: m[1], id: Number(m[2]), phase: Number(m[3]), line });
  }
  return items;
}

/** Phase number → set of R numbers listed in its "**R-IDs:**" line ("R-a bis R-b" ranges resolved). */
function parsePlan(text) {
  const phases = new Map();
  let cur = null;
  for (const line of text.split('\n')) {
    const h = /^## Phase (\d+)/.exec(line);
    if (h) cur = Number(h[1]);
    if (cur === null || !line.startsWith('**R-IDs:**')) continue;
    const set = phases.get(cur) ?? new Set();
    const rest = line.replace(/R-(\d{3}) bis R-(\d{3})/g, (_m, a, b) => {
      for (let i = Number(a); i <= Number(b); i++) set.add(i);
      return '';
    });
    for (const m of rest.matchAll(/R-(\d{3})/g)) set.add(Number(m[1]));
    phases.set(cur, set);
  }
  return phases;
}

function refs(text) {
  const r = new Set();
  const d = new Set();
  for (const m of text.matchAll(/\b([RD])-(\d{3})\b/g)) (m[1] === 'R' ? r : d).add(Number(m[2]));
  return { r, d };
}

/**
 * @param {{ requirements: string, plan: string, decisions: string, others?: { name: string, text: string }[], previousRequirements?: string | string[] }} docs
 * @returns {string[]}
 */
export function checkDocs({ requirements, plan, decisions, others = [], previousRequirements }) {
  const errs = [];
  const items = parseRequirements(requirements);
  const ids = new Set();
  for (const it of items) {
    if (ids.has(it.id)) errs.push(`REQUIREMENTS: ${pad(it.id)} appears twice (duplicate ID)`);
    ids.add(it.id);
  }
  const max = Math.max(0, ...ids);
  for (let i = 1; i <= max; i++) if (!ids.has(i)) errs.push(`REQUIREMENTS: gap – ${pad(i)} is missing`);
  const next = NEXT.exec(requirements);
  if (!next) errs.push('REQUIREMENTS: line "Nächste freie ID: **R-NNN**" missing');
  else if (Number(next[1]) !== max + 1)
    errs.push(`REQUIREMENTS: Nächste freie ID is ${pad(Number(next[1]))}, expected ${pad(max + 1)}`);

  for (const it of items) {
    if (it.phase > 7) errs.push(`REQUIREMENTS: ${pad(it.id)} has tag [P${it.phase}], allowed are P0–P7`);
    if (it.line.includes('~~') && !/\bD-\d{3}\b/.test(it.line))
      errs.push(
        `REQUIREMENTS: ${pad(it.id)} has a durchgestrichen part without a D-entry (CLAUDE.md: Begründung und D-Verweis)`,
      );
    if (it.st === '✅') {
      if (it.line.includes('**Lücke:**')) errs.push(`REQUIREMENTS: ${pad(it.id)} is ✅ but still names a **Lücke:**`);
      const ev = (it.line.split('Nachweis:')[1] ?? '').trim();
      if (!ev || /^[—–-]$/.test(ev)) errs.push(`REQUIREMENTS: ${pad(it.id)} is ✅ without Nachweis`);
    }
  }

  const phases = parsePlan(plan);
  const byId = new Map(items.map((it) => [it.id, it]));
  for (const it of items) {
    if (!phases.get(it.phase)?.has(it.id))
      errs.push(`${pad(it.id)} is tagged [P${it.phase}] but not listed under Phase ${it.phase} in PLAN`);
  }
  for (const [ph, set] of phases) {
    for (const id of set) {
      const it = byId.get(id);
      if (!it) errs.push(`${pad(id)} is listed under PLAN Phase ${ph} but does not exist`);
      else if (it.phase !== ph && !(it.st === '✅' && ph > it.phase))
        errs.push(`${pad(id)} is listed under PLAN Phase ${ph} but tagged [P${it.phase}] in REQUIREMENTS`);
    }
  }

  const decIds = new Set([...decisions.matchAll(/^\*\*D-(\d{3}) /gm)].map((m) => Number(m[1])));
  const docs = [
    { name: 'docs/REQUIREMENTS.md', text: requirements.replace(NEXT, '') },
    { name: 'docs/PLAN.md', text: plan },
    { name: 'docs/DECISIONS.md', text: decisions },
    ...others,
  ];
  for (const { name, text } of docs) {
    const { r, d } = refs(text);
    for (const id of [...r].sort((a, b) => a - b)) if (!ids.has(id)) errs.push(`${name}: unknown ${pad(id)}`);
    for (const id of [...d].sort((a, b) => a - b))
      if (!decIds.has(id)) errs.push(`${name}: unknown D-${String(id).padStart(3, '0')}`);
  }

  const removed = new Set();
  for (const prev of [previousRequirements ?? []].flat())
    for (const it of parseRequirements(prev)) if (!ids.has(it.id)) removed.add(it.id);
  for (const id of [...removed].sort((a, b) => a - b))
    errs.push(
      `REQUIREMENTS: ${pad(id)} was removed compared to a committed version (git HEAD/origin/main) – never delete`,
    );
  return errs;
}

// ---------- CLI ----------
function walk(dir, exts, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f.startsWith('.git')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.some((e) => f.endsWith(e))) out.push(p);
  }
  return out;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const read = (p) => readFileSync(join(root, p), 'utf8');
  const core = new Set(['docs/REQUIREMENTS.md', 'docs/PLAN.md', 'docs/DECISIONS.md']);
  const files = [
    ...['CLAUDE.md', 'README.md', 'CHANGELOG.md'].map((f) => join(root, f)),
    ...walk(join(root, 'docs'), ['.md']),
    ...walk(join(root, '.claude'), ['.md', '.sh', '.json', '.txt']),
    ...['src', 'tests', 'scripts', 'eslint-rules'].flatMap((d) => walk(join(root, d), ['.ts', '.mjs', '.sh'])),
  ];
  const others = [];
  for (const f of files) {
    const name = relative(root, f);
    if (core.has(name) || name.startsWith('tests/fixtures')) continue;
    try {
      others.push({ name, text: readFileSync(f, 'utf8') });
    } catch (e) {
      if (e.code !== 'ENOENT') throw e; // optional files (e.g. CHANGELOG.md before it exists)
    }
  }
  // compare with every committed version we can see, so a committed deletion is still caught later
  const previousRequirements = [];
  for (const rev of ['HEAD', 'origin/main']) {
    try {
      const opts = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
      previousRequirements.push(execFileSync('git', ['show', `${rev}:docs/REQUIREMENTS.md`], opts));
    } catch (e) {
      console.warn(`check:docs: no ${rev} version to compare against (${e.message.split('\n')[0]})`);
    }
  }
  const errs = checkDocs({
    requirements: read('docs/REQUIREMENTS.md'),
    plan: read('docs/PLAN.md'),
    decisions: read('docs/DECISIONS.md'),
    others,
    previousRequirements,
  });
  if (errs.length) {
    console.error(`check:docs FAILED (${errs.length}):\n  - ` + errs.join('\n  - '));
    process.exit(1);
  }
  console.log(
    `check:docs OK (${parseRequirements(read('docs/REQUIREMENTS.md')).length} requirements, ${others.length + 3} files)`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
