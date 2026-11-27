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
  /** the run's last event was a pause (no decision after it): its abort reason (R-009) */
  endedOnPause: boolean;
  errors: ErrorBook;
  progress: RunSummary['progress'];
  lastBattle: { node: string | null; map: number; boss: string | null; team: ShortMon[] } | null;
  version: string | null;
  mode: RunMode;
  profile: Record<string, unknown>;
}

const MAX_ERRORS = 50;

/** errors of one run (or of the time before a run): entries plus the global count seen last, per key */
interface ErrorBook {
  list: RunError[];
  base: Map<string, number>;
}
const newBook = (): ErrorBook => ({ list: [], base: new Map() });
const iso = (t: number) => new Date(t).toISOString();
const hp = (m: Mon) => `${m.currentHp}/${m.maxHp}`;

export class RunRecorder {
  private readonly now: () => number;
  private readonly rand: () => number;
  private readonly maxRuns: number;
  private readonly maxLines: number;
  private runs: RunRecord[] = [];
  private open: RunRecord | null = null;
  private pendingErrors: ErrorBook = newBook();
  private screen: string | null = null;
  private screenSince = 0;
  /** boss of the last map simulation – valid only for that map and eliteIndex (Top-4 chain, failed sims) */
  private bossAt: { name: string; map: number; elite: number } | null = null;

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
      this.closeDwell(t);
      this.screen = kind;
      this.screenSince = t;
    }
    this.noteBoss(st);
    if (!this.open) return;
    this.track(this.open, st);
    const run = st.run;
    if (kind === 'battle' && run) {
      const nodeType = run.currentNodeId ? (run.map?.nodes[run.currentNodeId]?.type ?? null) : null;
      this.open.lastBattle = {
        node: nodeType,
        map: run.currentMap,
        boss: nodeType === 'boss' ? this.bossFor(st) : null,
        team: run.team.map((m) => ({ name: m.name, level: m.level, hp: hp(m) })),
      };
    }
  }

  record(d: RecordableDecision, st: GameState): DecisionLine {
    const t = this.now();
    const r = this.open ?? this.openRun(t, st);
    // the bot attaches the map simulation after observe(): the boss name reaches the recorder here
    this.noteBoss(st);
    this.track(r, st);
    const ctx = this.o.context();
    const tr = d.trace;
    const line: DecisionLine = {
      ts: iso(t),
      run_id: r.id,
      step: ++r.step,
      game_version: st.version,
      screen: st.screen.kind,
      state: compact(st, this.bossFor(st)),
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
    r.endedOnPause = false;
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

  setOutcome(line: DecisionLine, outcome: 'ok' | 'no-effect' | 'aborted'): void {
    line.outcome = outcome;
    const r = this.runs.find((x) => x.id === line.run_id);
    if (r && outcome === 'no-effect') r.counts.noEffect++;
  }

  pause(kind: PauseKind, reason: string): void {
    const r = this.open;
    if (!r) return;
    r.pauses.push({ kind, reason, t: this.now() });
    r.counts.pauses++;
    r.endedOnPause = true;
  }

  /** The bot paused: close the current screen's dwell time – paused minutes are no screen time (R-254 budgets). */
  suspend(): void {
    this.closeDwell(this.now());
    this.screen = null;
  }

  /**
   * A noted error (every occurrence for the bot world, changed entries for the page world). Per run, an error
   * counts its own occurrences: the difference of the global count to the last one seen (first sighting = 1).
   */
  error(e: NotedError, world: 'bot' | 'main'): void {
    const book = this.open ? this.open.errors : this.pendingErrors;
    const key = `${world}|${e.where}|${e.msg}`;
    const hit = book.list.find((x) => x.world === world && x.where === e.where && x.msg === e.msg);
    if (!hit) {
      if (book.list.length >= MAX_ERRORS) return;
      book.list.push({ world, where: e.where, msg: e.msg, count: 1, t: e.t });
      book.base.set(key, e.count);
      return;
    }
    const delta = e.count - (book.base.get(key) ?? e.count);
    if (delta <= 0) return; // the same report delivered again
    hit.count += delta;
    hit.t = e.t;
    book.base.set(key, e.count);
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

  private closeDwell(t: number): void {
    if (this.screen === null || !this.open) return;
    const s = this.open.screenTimes[this.screen] ?? { n: 0, totalMs: 0, maxMs: 0 };
    this.open.screenTimes[this.screen] = s;
    const ms = t - this.screenSince;
    s.n++;
    s.totalMs += ms;
    s.maxMs = Math.max(s.maxMs, ms);
  }

  private noteBoss(st: GameState): void {
    if (st.sim?.bossName && st.run)
      this.bossAt = { name: st.sim.bossName, map: st.run.currentMap, elite: st.run.eliteIndex };
  }

  private bossFor(st: GameState): string | null {
    const b = this.bossAt;
    return b && st.run && b.map === st.run.currentMap && b.elite === st.run.eliteIndex ? b.name : null;
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
      endedOnPause: false,
      errors: this.pendingErrors,
      progress: { badges: 0, map: 0, eliteIndex: 0, maxLevel: 0, teamSize: 0 },
      lastBattle: null,
      version: st.version,
      mode: { ...ctx.mode, run: null, gen: null },
      profile: ctx.profile,
    };
    this.pendingErrors = newBook();
    this.bossAt = null; // never name the boss of the previous run
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
    const trailing = r.endedOnPause && r.result === null ? last : undefined;
    const result = r.result ?? (trailing && isErrorKind(trailing.kind) ? 'aborted' : 'open');
    const cause: RunCause =
      result === 'loss'
        ? {
            kind: 'loss',
            node: r.lastBattle?.node ?? null,
            map: r.lastBattle?.map ?? null,
            boss: r.lastBattle?.boss ?? null,
            team: r.lastBattle?.team ?? [],
          }
        : trailing
          ? { kind: 'pause', pauseKind: trailing.kind, reason: trailing.reason }
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
      errors: r.errors.list.map((e) => ({ ...e })),
      optionCoverage: r.actions ? r.withOptions / r.actions : 0,
      dropped: r.dropped,
    };
  }
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
