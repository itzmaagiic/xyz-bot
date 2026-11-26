/**
 * Structured run logs (R-006, R-009, R-091, D-005, D-038). Pure and platform-free: the BotController feeds it with
 * every executed decision, the observed state, pauses and noted errors. It never reads localStorage – only GameState –
 * so a run log cannot carry tokens or account data (R-145, R-148).
 * Limits: at most `maxRuns` runs (oldest out) and `maxLines` lines per run (oldest out, counted in `dropped`).
 */
import type { NotedError } from './note';
import { isErrorKind, type PauseKind } from '../pause-reason';
import type { Decision, GameState, Mon } from '../types';

export interface RunContext {
  /** bot settings that shape the strategy, plus the experiment flags */
  profile: Record<string, unknown>;
  mode: { setting: string; region: number; variant: string };
}

export interface CompactMon {
  name: string;
  level: number;
  hp: string;
  types: string[];
  item: string | null;
}

export interface CompactState {
  team: CompactMon[];
  items: string[];
  bag: string[];
  badges: number;
  map: number;
  node: string | null;
  nodeType: string | null;
  eliteIndex: number;
  gen: number;
  nuzlocke: boolean;
  nextBoss: string | null;
}

export type RunMode = RunContext['mode'] & { run: string | null; gen: number | null };

/** One line of decisions.jsonl – exactly the D-005 fields. */
export interface DecisionLine {
  ts: string;
  run_id: string;
  step: number;
  game_version: string | null;
  screen: string;
  state: CompactState | null;
  options: { id: string; label: string }[];
  scores: Record<string, Record<string, number | null>>;
  chosen: string;
  reason: string;
  confidence: number | null;
  profile: Record<string, unknown>;
  mode: RunMode;
  outcome: string | null;
}

export type RecordableDecision = Exclude<Decision, { kind: 'wait' }>;

interface ScreenTime {
  n: number;
  totalMs: number;
  maxMs: number;
}

interface RunError {
  world: 'bot' | 'main';
  where: string;
  msg: string;
  count: number;
  t: number;
}

type ShortMon = Pick<CompactMon, 'name' | 'level' | 'hp'>;

export type RunCause =
  | { kind: 'loss'; node: string | null; map: number | null; boss: string | null; team: ShortMon[] }
  | { kind: 'pause'; pauseKind: PauseKind; reason: string }
  | null;

export interface RunSummary {
  run_id: string;
  started: string;
  ended: string | null;
  durationMs: number;
  result: 'win' | 'loss' | 'open' | 'aborted';
  progress: { badges: number; map: number; eliteIndex: number; maxLevel: number; teamSize: number };
  game_version: string | null;
  mode: RunMode;
  profile: Record<string, unknown>;
  cause: RunCause;
  counts: { decisions: number; clicks: number; noEffect: number; watchdogRereads: number; pauses: number };
  screenTimes: Record<string, ScreenTime>;
  pauses: { kind: PauseKind; reason: string; t: string }[];
  errors: RunError[];
  /** share of action decisions (not pause/stop) that carried their options (R-116 grows this to 1 in P4) */
  optionCoverage: number;
  dropped: number;
}

export interface RunExport {
  format: 'pkbot-runs/1';
  exported: string;
  bot_version: string | null;
  runs: { summary: RunSummary; decisions: DecisionLine[] }[];
}

interface RunRecord {
  id: string;
  started: number;
  ended: number | null;
  result: 'win' | 'loss' | null;
  lines: DecisionLine[];
  dropped: number;
  step: number;
  actions: number;
  withOptions: number;
  counts: RunSummary['counts'];
  screenTimes: Record<string, ScreenTime>;
  pauses: { kind: PauseKind; reason: string; t: number }[];
  /** the run's last event was an error pause (no decision after it) */
  endedOnError: boolean;
  errors: RunError[];
  progress: RunSummary['progress'];
  lastBattle: { node: string | null; map: number; boss: string | null; team: ShortMon[] } | null;
  version: string | null;
  mode: RunMode;
  profile: Record<string, unknown>;
}

const MAX_ERRORS = 50;
const iso = (t: number) => new Date(t).toISOString();
const hp = (m: Mon) => `${m.currentHp}/${m.maxHp}`;

export class RunRecorder {
  private readonly now: () => number;
  private readonly rand: () => number;
  private readonly maxRuns: number;
  private readonly maxLines: number;
  private runs: RunRecord[] = [];
  private open: RunRecord | null = null;
  private pendingErrors: RunError[] = [];
  private screen: string | null = null;
  private screenSince = 0;
  private lastBoss: string | null = null;

  constructor(
    private readonly o: {
      context: () => RunContext;
      now?: () => number;
      rand?: () => number;
      maxRuns?: number;
      maxLines?: number;
      botVersion?: string;
    },
  ) {
    this.now = o.now ?? Date.now;
    this.rand = o.rand ?? Math.random;
    this.maxRuns = o.maxRuns ?? 10;
    this.maxLines = o.maxLines ?? 3000;
  }

  /** Called on every tick: dwell time per screen, progress and the context of the last battle. */
  observe(st: GameState): void {
    const t = this.now();
    const kind = st.screen.kind;
    if (kind !== this.screen) {
      if (this.screen !== null && this.open) {
        const s = this.open.screenTimes[this.screen] ?? { n: 0, totalMs: 0, maxMs: 0 };
        this.open.screenTimes[this.screen] = s;
        const ms = t - this.screenSince;
        s.n++;
        s.totalMs += ms;
        s.maxMs = Math.max(s.maxMs, ms);
      }
      this.screen = kind;
      this.screenSince = t;
    }
    if (st.sim?.bossName) this.lastBoss = st.sim.bossName;
    if (!this.open) return;
    this.track(this.open, st);
    const run = st.run;
    if (kind === 'battle' && run) {
      const nodeType = run.currentNodeId ? (run.map?.nodes[run.currentNodeId]?.type ?? null) : null;
      this.open.lastBattle = {
        node: nodeType,
        map: run.currentMap,
        boss: nodeType === 'boss' ? this.lastBoss : null,
        team: run.team.map((m) => ({ name: m.name, level: m.level, hp: hp(m) })),
      };
    }
  }

  record(d: RecordableDecision, st: GameState): DecisionLine {
    const t = this.now();
    const r = this.open ?? this.openRun(t, st);
    this.track(r, st);
    const ctx = this.o.context();
    const tr = d.trace;
    const line: DecisionLine = {
      ts: iso(t),
      run_id: r.id,
      step: ++r.step,
      game_version: st.version,
      screen: st.screen.kind,
      state: compact(st, this.lastBoss),
      options: (tr?.options ?? []).map((x) => ({ id: x.id, label: x.label })),
      scores: Object.fromEntries((tr?.options ?? []).map((x) => [x.id, { score: x.score, ...(x.factors ?? {}) }])),
      chosen: tr?.chosen ?? describe(d),
      reason: d.why,
      confidence: tr?.confidence ?? null,
      profile: ctx.profile,
      mode: { ...ctx.mode, run: st.run?.mode ?? null, gen: st.run?.gen ?? null },
      outcome: d.kind === 'stop' ? (d.result ?? null) : null,
    };
    r.lines.push(line);
    if (r.lines.length > this.maxLines) {
      r.lines.shift();
      r.dropped++;
    }
    r.counts.decisions++;
    r.endedOnError = false;
    if (d.kind === 'click') r.counts.clicks++;
    if (d.kind !== 'pause' && d.kind !== 'stop') {
      r.actions++;
      if (line.options.length) r.withOptions++;
    }
    if (d.kind === 'stop') {
      r.ended = t;
      r.result = d.result ?? null;
      this.open = null;
    }
    return line;
  }

  setOutcome(line: DecisionLine, outcome: 'ok' | 'no-effect'): void {
    line.outcome = outcome;
    const r = this.runs.find((x) => x.id === line.run_id);
    if (r && outcome === 'no-effect') r.counts.noEffect++;
  }

  pause(kind: PauseKind, reason: string): void {
    const r = this.open;
    if (!r) return;
    r.pauses.push({ kind, reason, t: this.now() });
    r.counts.pauses++;
    r.endedOnError = isErrorKind(kind);
  }

  error(e: NotedError, world: 'bot' | 'main'): void {
    const entry: RunError = { world, where: e.where, msg: e.msg, count: e.count, t: e.t };
    addError(this.open ? this.open.errors : this.pendingErrors, entry);
  }

  count(key: 'watchdogRereads'): void {
    if (this.open) this.open.counts[key]++;
  }

  summaries(): RunSummary[] {
    return this.runs.map((r) => this.summary(r));
  }

  exportBundle(): RunExport {
    return {
      format: 'pkbot-runs/1',
      exported: iso(this.now()),
      bot_version: this.o.botVersion ?? null,
      runs: this.runs.map((r) => ({ summary: this.summary(r), decisions: [...r.lines] })),
    };
  }

  private openRun(t: number, st: GameState): RunRecord {
    const ctx = this.o.context();
    const r: RunRecord = {
      id: runId(t, this.rand()),
      started: t,
      ended: null,
      result: null,
      lines: [],
      dropped: 0,
      step: 0,
      actions: 0,
      withOptions: 0,
      counts: { decisions: 0, clicks: 0, noEffect: 0, watchdogRereads: 0, pauses: 0 },
      screenTimes: {},
      pauses: [],
      endedOnError: false,
      errors: [],
      progress: { badges: 0, map: 0, eliteIndex: 0, maxLevel: 0, teamSize: 0 },
      lastBattle: null,
      version: st.version,
      mode: { ...ctx.mode, run: null, gen: null },
      profile: ctx.profile,
    };
    for (const e of this.pendingErrors) addError(r.errors, e);
    this.pendingErrors = [];
    this.runs.push(r);
    if (this.runs.length > this.maxRuns) this.runs.shift();
    this.open = r;
    return r;
  }

  private track(r: RunRecord, st: GameState): void {
    if (st.version) r.version = st.version;
    const run = st.run;
    if (!run) return;
    const p = r.progress;
    p.badges = Math.max(p.badges, run.badges);
    p.map = Math.max(p.map, run.currentMap);
    p.eliteIndex = Math.max(p.eliteIndex, run.eliteIndex);
    p.maxLevel = Math.max(p.maxLevel, ...run.team.map((m) => m.level));
    if (run.team.length) p.teamSize = run.team.length;
    r.mode = { ...r.mode, run: run.mode, gen: run.gen };
  }

  private summary(r: RunRecord): RunSummary {
    const last = r.pauses[r.pauses.length - 1]; // no .at(): Safari 15.0 (R-107)
    const result = r.result ?? (r.endedOnError ? 'aborted' : 'open');
    const cause: RunCause =
      result === 'loss'
        ? {
            kind: 'loss',
            node: r.lastBattle?.node ?? null,
            map: r.lastBattle?.map ?? null,
            boss: r.lastBattle?.boss ?? null,
            team: r.lastBattle?.team ?? [],
          }
        : result === 'aborted' && last
          ? { kind: 'pause', pauseKind: last.kind, reason: last.reason }
          : null;
    return {
      run_id: r.id,
      started: iso(r.started),
      ended: r.ended === null ? null : iso(r.ended),
      durationMs: (r.ended ?? this.now()) - r.started,
      result,
      progress: { ...r.progress },
      game_version: r.version,
      mode: r.mode,
      profile: r.profile,
      cause,
      counts: { ...r.counts },
      screenTimes: structuredCopy(r.screenTimes),
      pauses: r.pauses.map((p) => ({ kind: p.kind, reason: p.reason, t: iso(p.t) })),
      errors: r.errors.map((e) => ({ ...e })),
      optionCoverage: r.actions ? r.withOptions / r.actions : 0,
      dropped: r.dropped,
    };
  }
}

function addError(list: RunError[], e: RunError): void {
  const hit = list.find((x) => x.world === e.world && x.where === e.where && x.msg === e.msg);
  if (hit) {
    hit.count = Math.max(hit.count, e.count);
    hit.t = e.t;
    return;
  }
  if (list.length < MAX_ERRORS) list.push({ ...e });
}

function structuredCopy(o: Record<string, ScreenTime>): Record<string, ScreenTime> {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v }]));
}

/** File name of an export: `pkbot-runs-YYYYMMDD-HHMMSS.json` (UTC). */
export function exportFileName(t: number): string {
  const d = iso(t);
  return `pkbot-runs-${d.slice(0, 10).replace(/-/g, '')}-${d.slice(11, 19).replace(/:/g, '')}.json`;
}

/** `YYYYMMDD-HHMMSS-xxxx` (UTC, 4 base-36 characters). */
function runId(t: number, rand: number): string {
  const d = iso(t);
  const suffix = Math.floor(rand * 36 ** 4)
    .toString(36)
    .padStart(4, '0');
  return `${d.slice(0, 10).replace(/-/g, '')}-${d.slice(11, 19).replace(/:/g, '')}-${suffix}`;
}

function describe(d: RecordableDecision): string {
  switch (d.kind) {
    case 'click':
      return `click ${d.selector}[${d.index ?? 0}]`;
    case 'swapTeam':
      return `swap ${d.from}→${d.to}`;
    case 'reorder':
      return `reorder ${d.target.join(',')}`;
    case 'openBag':
      return `bag ${d.index}:${d.itemId}`;
    case 'pause':
      return `pause (${d.cause})`;
    case 'stop':
      return `stop${d.result ? ` (${d.result})` : ''}`;
  }
}

function compact(st: GameState, nextBoss: string | null): CompactState | null {
  const run = st.run;
  if (!run) return null;
  return {
    team: run.team.map((m) => ({ name: m.name, level: m.level, hp: hp(m), types: [...m.types], item: m.heldItem })),
    items: [...run.items],
    bag: run.bag.map((b) => b.id),
    badges: run.badges,
    map: run.currentMap,
    node: run.currentNodeId,
    nodeType: run.currentNodeId ? (run.map?.nodes[run.currentNodeId]?.type ?? null) : null,
    eliteIndex: run.eliteIndex,
    gen: run.gen,
    nuzlocke: run.nuzlocke,
    nextBoss: st.sim?.bossName ?? nextBoss,
  };
}
