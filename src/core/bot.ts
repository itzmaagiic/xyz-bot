/** BotController: read → detect → decide → act → verify, with backoff and pause-on-unknown. */
import { ForbiddenActionError } from './actions/guard';
import { Actor, humanDelay, resolve, sleep } from './actions/actor';
import { clickPrecheck, waitForEffect } from './actions/effect';
import type { BridgeClient } from './bridge/client';
import type { WritableSetting } from './bridge/protocol';
import { Logger } from './log/logger';
import { detectScreen } from './screens/detector';
import { DEFAULT_SETTINGS, normalizeSettings, SETTINGS_KEY, type BotSettings } from './settings';
import { StateReader } from './state/reader';
import { decide, newMemory, type EngineMemory } from './strategy/engine';
import { enumeratePaths, evaluatePath } from './strategy/sim-route';
import { FLAGS } from './flags';
import { readPcCards } from './strategy/challenge';
import type { Decision, GameState } from './types';
import type { Platform } from '../platform/types';
import { type NotedError, noteError, noteRejection, onNotedError, recentErrors } from './log/note';
import { errorPause, type PauseKind } from './pause-reason';
import { Watchdog } from './watchdog';
import { BOT_VERSION } from './version';
import { RunRecorder, type DecisionLine, type RecordableDecision, type RunContext } from './log/run-log';

export type BotStatus = 'idle' | 'running' | 'paused';

export interface BotStats {
  runs: number;
  wins: number;
  losses: number;
  actions: number;
}

export interface BotView {
  status: BotStatus;
  pauseReason: string | null;
  /** typed pause (R-254): the live verdict reads this, never the translatable text */
  pauseKind: PauseKind | null;
  screen: string;
  lastDecision: string;
  bridge: boolean;
  version: string | null;
  versionWarning: string | null;
  stats: BotStats;
  settings: BotSettings;
  /** game settings the bot recommends turning on (requires explicit user confirmation) */
  speedSuggestions: WritableSetting[];
}

const STATS_KEY = 'pkbot.stats';
const SPEED_SETTINGS: WritableSetting[] = ['autoSkipBattles', 'autoSkipAllBattles', 'autoSkipEvolve'];
const VERIFY_TIMEOUT = 4000;
const MAX_ATTEMPTS = 3;

export class BotController {
  readonly log = new Logger();
  /** structured run logs (R-006, R-009, D-005, D-038) – exported from the overlay */
  readonly runs = new RunRecorder({ context: () => this.runContext(), botVersion: BOT_VERSION ?? undefined });
  private readonly watchdog = new Watchdog();
  private reader: StateReader;
  private actor: Actor;
  private mem: EngineMemory = newMemory();
  private loopRunning = false;
  private listeners = new Set<(v: BotView) => void>();
  private failKey: string | null = null;
  private failCount = 0;
  private pendingPause: string | null = null;
  private lastState: GameState | null = null;

  view: BotView = {
    status: 'idle',
    pauseReason: null,
    pauseKind: null,
    screen: '-',
    lastDecision: '-',
    bridge: false,
    version: null,
    versionWarning: null,
    stats: { runs: 0, wins: 0, losses: 0, actions: 0 },
    settings: { ...DEFAULT_SETTINGS },
    speedSuggestions: [],
  };

  constructor(
    private readonly platform: Platform,
    private readonly bridge: BridgeClient | null,
    private readonly doc: Document = document,
  ) {
    this.reader = new StateReader(bridge, doc);
    this.actor = new Actor();
    // R-199: handled errors are visible in the overlay log and the log export – also those noted before start-up
    // muted level: a handled error is information, not an alarm (UI review P2); real problems stay warn/error
    const show = (e: NotedError) => {
      this.log.debug(`handled: ${e.where} – ${e.msg}`);
      this.runs.error(e, 'bot');
    };
    for (const e of recentErrors()) show(e);
    onNotedError(show);
    // R-253: errors noted in the page's main world (bridge, simulator) – muted, with their own time stamp
    this.reader.onPageErrors((errs) => {
      for (const e of errs) {
        this.log.log('debug', `handled (page): ${e.where} – ${e.msg}`, undefined, e.t);
        this.runs.error(e, 'main');
      }
    });
  }

  async init(): Promise<void> {
    this.view.settings = normalizeSettings(await this.platform.storage.get(SETTINGS_KEY));
    const st = await this.platform.storage.get<BotStats>(STATS_KEY);
    if (st && typeof st === 'object') this.view.stats = { ...this.view.stats, ...st };
    this.platform.storage.onChange?.(SETTINGS_KEY, (v) => {
      this.view.settings = normalizeSettings(v);
      this.emit();
    });
    await this.refresh();
    // keep the status display fresh while the bot is not running (cheap read-only snapshot)
    setInterval(() => {
      if (this.view.status !== 'running') void this.refresh().catch((e: unknown) => noteError('bot:idle-refresh', e));
    }, 1500);
  }

  onChange(fn: (v: BotView) => void): () => void {
    this.listeners.add(fn);
    fn(this.view);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const l of this.listeners) l(this.view);
  }

  async updateSettings(patch: Partial<BotSettings>): Promise<void> {
    this.view.settings = normalizeSettings({ ...this.view.settings, ...patch });
    await this.platform.storage.set(SETTINGS_KEY, this.view.settings);
    this.emit();
  }

  /** Reads state without acting (used for the status display). */
  async refresh(): Promise<GameState> {
    const st = await this.reader.read();
    this.lastState = st;
    this.view.bridge = st.bridge;
    this.view.version = st.version;
    this.view.screen = st.screen.overlay ? `${st.screen.kind} + ${st.screen.overlayId}` : st.screen.kind;
    const known = this.view.settings.knownGameVersion;
    this.view.versionWarning =
      st.version && known && st.version !== known
        ? `Game version changed: ${known} → ${st.version}. The bot runs in careful mode (pauses on the first failure).`
        : null;
    const gs = st.settings;
    this.view.speedSuggestions = gs ? SPEED_SETTINGS.filter((k) => gs[k] === false) : [];
    this.emit();
    return st;
  }

  async acknowledgeVersion(): Promise<void> {
    if (this.view.version) await this.updateSettings({ knownGameVersion: this.view.version });
    await this.refresh();
  }

  /** Changes game settings – only ever called from an explicit user confirmation in the UI. */
  async applyGameSettings(keys: WritableSetting[]): Promise<boolean> {
    if (!this.bridge || !keys.length) return false;
    const patch = Object.fromEntries(keys.map((k) => [k, true]));
    try {
      await this.bridge.request('saveSettings', { patch });
      this.log.info(`game settings changed by user confirmation: ${keys.join(', ')}`);
      await this.refresh();
      return true;
    } catch (e) {
      this.log.error('could not change game settings', String(e));
      return false;
    }
  }

  start(): void {
    if (this.view.status === 'running') return;
    this.view.status = 'running';
    this.view.pauseReason = null;
    this.view.pauseKind = null;
    this.watchdog.reset();
    this.failCount = 0;
    this.failKey = null;
    this.pendingPause = null;
    this.log.info('bot started');
    this.emit();
    noteRejection('bot:loop', this.loop());
  }

  pause(reason: string | null = null, notify = false, kind: PauseKind = 'user'): void {
    const wasRunning = this.view.status === 'running';
    this.view.status = 'paused';
    this.watchdog.reset();
    this.view.pauseReason = reason;
    this.view.pauseKind = reason ? kind : null;
    if (reason) {
      this.log.warn(`paused: ${reason}`);
      this.runs.pause(kind, reason);
    }
    this.emit();
    if (notify && wasRunning && reason) noteRejection('bot:notify', this.notify('Pokelike bot paused', reason));
  }

  toggle(): void {
    if (this.view.status === 'running') this.pause('paused by user');
    else this.start();
  }

  /** One single tick (manual stepping). */
  async step(): Promise<void> {
    if (this.view.status === 'running') return;
    try {
      await this.tick();
      await this.refresh();
    } catch (e) {
      this.crashed(e, 'step crashed'); // same handling as the loop – never a silent rejection (R-147, R-199)
    }
  }

  private async loop(): Promise<void> {
    if (this.loopRunning) return;
    this.loopRunning = true;
    try {
      while (this.view.status === 'running') {
        const d = await this.tick();
        if (this.view.status !== 'running') break;
        const base = d?.kind === 'wait' ? d.ms : this.view.settings.actionDelayMs;
        await sleep(humanDelay(base));
      }
    } catch (e) {
      this.crashed(e, 'bot loop crashed');
    } finally {
      this.loopRunning = false;
    }
  }

  /** An error that escaped a tick: log it, pause with an error reason and notify – never retry (R-147, R-199). */
  private crashed(e: unknown, what: string): void {
    if (e instanceof ForbiddenActionError) {
      // R-147: a forbidden action (Reset Run, account, key R …) was blocked – never retry, pause and tell the user
      this.log.error('forbidden action blocked', e.message);
      this.pause(errorPause('blocked', e.message), true, 'blocked');
      return;
    }
    this.log.error(what, String(e));
    this.pause(errorPause('internal', String(e)), true, 'internal');
  }

  /** strategy-relevant settings (profile) and the requested mode for the run logs */
  private runContext(): RunContext {
    const s = this.view.settings;
    return {
      profile: {
        chalKind: s.chalKind,
        chalLevel: s.chalLevel,
        trainer: s.trainer,
        preferredStarter: s.preferredStarter,
        chalStarter: s.chalStarter,
        resumeRuns: s.resumeRuns,
        actionDelayMs: s.actionDelayMs,
        watchdogSec: s.watchdogSec,
        takeShiny: s.takeShiny,
        reorderTeam: s.reorderTeam,
        flags: { ...FLAGS },
      },
      mode: { setting: s.mode, region: s.region, variant: s.storyVariant },
    };
  }

  /** Logs an executed decision and records it in the run log (one place for both, R-006). */
  private decided(d: RecordableDecision, st: GameState, data: unknown): DecisionLine {
    this.log.log('decision', d.why, data);
    return this.runs.record(d, st);
  }

  private async notify(title: string, body: string): Promise<void> {
    if (!this.view.settings.notifications) return;
    await this.platform.notify(title, body);
  }

  private simKey: string | null = null;
  private simCache: GameState['sim'] = null;
  private orderKey: string | null = null;
  private orderCache: GameState['orderSim'] = null;
  private catchKey: string | null = null;
  private catchCache: GameState['catchSim'] = null;

  /** Adds simulation data (game's own battle engine, sampled enemies) for map and boss-prep decisions. */
  private async attachSim(st: GameState): Promise<void> {
    const run = st.run;
    if (this.bridge && st.screen.kind === 'starter' && this.doc.querySelector('#starter-choices .dex-card')) {
      try {
        const ids = [...new Set(readPcCards(this.doc).map((c) => c.speciesId))];
        st.pcStats = await this.bridge.request('speciesStats', { ids }, 5000);
      } catch (e) {
        this.log.warn('PC stats unavailable', String(e));
      }
    }
    if (!this.bridge || !run || (run.mode !== 'story' && run.mode !== 'challenge')) return;
    const teamSig = run.team.map((m) => `${m.speciesId}:${m.level}:${m.currentHp}`).join(',');
    try {
      if (st.screen.kind === 'map' && !st.screen.overlay && run.map) {
        const key = `${run.gen}|${run.currentMap}|${run.currentNodeId}|${teamSig}`;
        if (key !== this.simKey) {
          const nodes = Object.values(run.map.nodes)
            .filter((n) => !n.visited && (n.type === 'battle' || n.type === 'trainer' || n.type === 'question'))
            .map((n) => n.id);
          const ns = await this.bridge.request<{ rates: Record<string, Record<number, number>> }>(
            'simulateNodes',
            { nodes, boosts: [0, 4, 8, 12], n: 14 },
            15000,
          );
          const boosts = [0, 2, 4, 6, 8, 10, 12, 14, 16];
          type BossRes = { boss: { name: string } | null; scenarios: { boost: number; winRate: number }[] };
          const b0 = await this.bridge.request<BossRes>('simulateBoss', { boosts, n: 24 }, 15000);
          const b1 = await this.bridge.request<BossRes>('simulateBoss', { boosts, n: 24, heal: true }, 15000);
          const b2 = await this.bridge.request<BossRes>(
            'simulateBoss',
            { boosts: [0, 4, 8, 12, 16, 20, 24, 28], n: 16, heal: true, ahead: 1 },
            15000,
          );
          const tbl = (r: BossRes) =>
            r.boss ? Object.fromEntries(r.scenarios.map((x) => [x.boost, x.winRate])) : { 0: 1 };
          this.simCache = {
            nodeRates: ns.rates,
            bossNoHeal: tbl(b0),
            bossHeal: tbl(b1),
            bossName: b0.boss?.name ?? null,
            ...(b2.boss ? { nextBoss: tbl(b2), nextBossName: b2.boss.name } : {}),
          };
          // whole-path simulation on the most promising routes
          const base = this.simCache!;
          const acc = Array.from(this.doc.querySelectorAll('#map-screen .map-node--clickable'))
            .map((e) => e.getAttribute('data-node-id') ?? '')
            .filter((id) => id && run.map!.nodes[id]);
          let paths = enumeratePaths(run.map, acc);
          if (paths.length > 36) {
            const ctxSim = { teamSize: run.team.length, maxTeamSize: run.maxTeamSize, nuzlocke: run.nuzlocke };
            paths = paths
              .map((p) => ({ p, v: evaluatePath(p, run.map!, ctxSim, base).value }))
              .sort((a, b) => b.v - a.v)
              .slice(0, 36)
              .map((x) => x.p);
          }
          if (paths.length) {
            const n = Math.max(10, Math.min(30, Math.floor(960 / paths.length)));
            const t0 = Date.now();
            const ps = await this.bridge.request<{
              results: {
                path: string[];
                success: number;
                next: number;
                avgLevel: number;
                avgAlive: number;
                progress: number;
              }[];
              targetLevel: number | null;
            }>('simulatePaths', { paths, n, nextGain: 6 }, 30000);
            base.pathSim = Object.fromEntries(ps.results.map((r) => [r.path.join('>'), r]));
            base.targetLevel = ps.targetLevel;
            // joint search: best routes again with alternative battle orders
            const ctxSim = { teamSize: run.team.length, maxTeamSize: run.maxTeamSize, nuzlocke: run.nuzlocke };
            const scoreOf = (sim: typeof base) => (p: string[]) => evaluatePath(p, run.map!, ctxSim, sim).value;
            const top = [...paths].sort((a, b) => scoreOf(base)(b) - scoreOf(base)(a)).slice(0, 6);
            const ident = run.team.map((_, i) => i);
            const alt = new Map<string, number[]>();
            const byLv = [...ident].sort((a, b) => run.team[b]!.level - run.team[a]!.level || a - b);
            alt.set(byLv.join(','), byLv);
            const fodder = [...ident].sort((a, b) => run.team[a]!.level - run.team[b]!.level || a - b);
            alt.set(fodder.join(','), fodder);
            alt.delete(ident.join(','));
            let bestOrder: number[] | null = null;
            let bestVal = Math.max(...top.map(scoreOf(base)));
            for (const order of FLAGS.jointOrder ? alt.values() : []) {
              if (run.team.length < 2 || !top.length) break;
              const r2 = await this.bridge.request<{
                results: { path: string[]; success: number; next: number; avgLevel: number }[];
              }>('simulatePaths', { paths: top, n: 20, nextGain: 6, order }, 30000);
              const sim2 = { ...base, pathSim: Object.fromEntries(r2.results.map((r) => [r.path.join('>'), r])) };
              const v = Math.max(...top.map(scoreOf(sim2)));
              if (v > bestVal * 1.04 + 1) {
                bestVal = v;
                bestOrder = order;
                base.pathSim = { ...base.pathSim, ...sim2.pathSim };
              }
            }
            base.mapOrder = bestOrder;
            this.log.debug(`path simulation: ${paths.length} routes × ${n} in ${Date.now() - t0} ms`);
          }
          this.simKey = key;
          this.log.debug('map simulation', { boss: this.simCache.bossName, noHeal: this.simCache.bossNoHeal });
        }
        st.sim = this.simCache;
      }
      if (st.screen.kind === 'passive') {
        const all = Array.from(this.doc.querySelectorAll('#passive-choices .item-card.passive-card'));
        const icons = all.map((c) => c.querySelector('img')?.getAttribute('src') ?? '');
        const replace = !!this.doc.querySelector('#passive-choices.is-replace-grid');
        if (icons.length) {
          st.relicSim = await this.bridge.request('simulateRelics', { icons, replace, n: 24 }, 30000);
          this.log.debug('relic simulation', st.relicSim);
        }
      }
      if (st.screen.kind === 'catch' && run.catchOffer?.length) {
        const key = `catch|${run.currentMap}|${run.currentNodeId}|${teamSig}|${run.catchOffer.map((m) => m.speciesId).join(',')}`;
        if (key !== this.catchKey) {
          const r = await this.bridge.request<{ options: NonNullable<GameState['catchSim']> }>(
            'simulateCatch',
            { boost: 4, n: 20 },
            20000,
          );
          this.catchCache = r.options;
          this.catchKey = key;
        }
        st.catchSim = this.catchCache;
      }
      if (st.screen.kind === 'elite-prep' && run.team.length > 1) {
        const key = `${run.currentMap}|${run.eliteIndex}|${teamSig}`;
        if (key !== this.orderKey) {
          const n = run.team.length;
          const ident = run.team.map((_, i) => i);
          const cands = new Map<string, number[]>();
          const add = (o: number[]) => cands.set(o.join(','), o);
          add(ident);
          for (let i = 1; i < n; i++) add([i, ...ident.filter((x) => x !== i)]);
          add([...ident].sort((a, b) => run.team[b]!.level - run.team[a]!.level));
          add([...ident].sort((a, b) => run.team[a]!.level - run.team[b]!.level));
          add([...ident].sort((a, b) => run.team[b]!.currentHp - run.team[a]!.currentHp));
          const r = await this.bridge.request<{ scenarios: { order: number[]; winRate: number; avgAlive: number }[] }>(
            'simulateBoss',
            { orders: [...cands.values()], n: 40 },
            20000,
          );
          this.orderCache = r.scenarios.map((x) => ({ order: x.order, winRate: x.winRate, avgAlive: x.avgAlive }));
          this.orderKey = key;
        }
        st.orderSim = this.orderCache;
      }
    } catch (e) {
      this.log.warn('simulation unavailable – using heuristics', String(e));
    }
  }

  async tick(): Promise<Decision | null> {
    let st = await this.refresh();
    this.runs.observe(st);
    // R-095 watchdog (D-037): the signature includes battle progress, so only a real standstill trips it
    if (this.view.status === 'running') {
      const sec = this.view.settings.watchdogSec;
      const wd = this.watchdog.observe(st.screen.signature, sec * 1000);
      if (wd === 'resumed') {
        this.log.info(`watchdog: resumed after ${Math.round(this.watchdog.gapMs / 1000)} s – timer restarted`);
      } else if (wd === 'reread') {
        this.log.warn(`watchdog: no change for ${sec} s on ${st.screen.kind} – re-reading the game state`);
        this.runs.count('watchdogRereads');
        st = await this.refresh();
        this.watchdog.observe(st.screen.signature, sec * 1000); // a changed state clears the alarm at once
      } else if (wd === 'stall') {
        const idle = Math.round(this.watchdog.idleMs() / 1000);
        const why = errorPause('stalled', `no change for ${idle} s on ${st.screen.kind}`);
        this.pause(why, true, 'stalled');
        return { kind: 'pause', why, cause: 'stalled' };
      }
    }
    await this.attachSim(st);
    const d = decide(st, this.doc, this.view.settings, this.mem);
    this.view.lastDecision = `${d.kind}: ${d.why}`;
    this.emit();

    if (d.kind !== 'pause') this.pendingPause = null;
    switch (d.kind) {
      case 'wait':
        return d;
      case 'pause': {
        // transitions can briefly show no/odd screen: only pause if it persists across two reads
        if (this.pendingPause !== d.why) {
          this.pendingPause = d.why;
          this.log.debug(`possible pause: ${d.why}`);
          return { kind: 'wait', ms: 900, why: 'confirming unknown state' };
        }
        this.runs.record(d, st);
        this.pause(d.why, true, d.cause);
        return d;
      }
      case 'stop': {
        this.runs.record(d, st);
        const s = this.view.stats;
        s.runs++;
        if (d.result === 'win') s.wins++;
        if (d.result === 'loss') s.losses++;
        await this.platform.storage.set(STATS_KEY, s);
        this.log.info(`run finished: ${d.why}`, s);
        noteRejection('bot:notify', this.notify('Pokelike run finished', `${d.why} (W ${s.wins} / L ${s.losses})`));
        const cfg = this.view.settings;
        if (!cfg.autoRestart || (cfg.maxRuns > 0 && s.runs >= cfg.maxRuns))
          this.pause(`run finished: ${d.why}`, false, 'finished');
        return d;
      }
      case 'click':
        await this.doClick(d, st);
        return d;
      case 'swapTeam':
        await this.doSwap(d, st);
        return d;
      case 'reorder':
        await this.doReorder(d, st);
        return d;
      case 'openBag':
        await this.doOpenBag(d, st);
        return d;
    }
    return d;
  }

  private async doOpenBag(d: Extract<Decision, { kind: 'openBag' }>, st: GameState): Promise<void> {
    this.decided(d, st, { bag: d.index, item: d.itemId });
    const block = (): void => {
      this.mem.bagBlocked.add(`${d.itemId}|${d.index}`);
    };
    if (!this.bridge) return block();
    try {
      await this.bridge.request('openBagItem', { index: d.index, itemId: d.itemId }, 3000);
    } catch (e) {
      this.log.warn('could not open bag item', String(e));
      return block();
    }
    for (let i = 0; i < 15; i++) {
      await sleep(120);
      const ov = detectScreen(this.doc).overlay;
      if (ov === 'usable-item' || ov === 'item-equip') return;
    }
    this.log.warn('bag dialog did not appear');
    block();
  }

  /** Realises a full battle order with the game's Shift+<slot> shortcut, verifying every single swap. */
  private async doReorder(d: Extract<Decision, { kind: 'reorder' }>, st: GameState): Promise<void> {
    this.decided(d, st, { swaps: d.swaps, target: d.target });
    (this.doc.activeElement as HTMLElement | null)?.blur?.();
    for (const k of d.swaps) {
      const before = this.teamOrder();
      await this.actor.pressKey(this.doc, `Digit${k + 1}`, String(k + 1), { shift: true });
      let ok = false;
      for (let i = 0; i < 10 && !ok; i++) {
        await sleep(120);
        await this.reader.read();
        ok = this.teamOrder() !== before;
      }
      if (!ok) {
        this.mem.reorderFailures++;
        this.log.warn(`reorder step Shift+${k + 1} had no effect – keeping current order`);
        return;
      }
      await sleep(humanDelay(200));
    }
    this.mem.reorderFailures = 0;
    this.log.info('battle order set by simulation');
  }

  private async doClick(d: Extract<Decision, { kind: 'click' }>, st: GameState): Promise<void> {
    const key = `${st.screen.signature}::${d.selector}#${d.index ?? 0}`;
    const el = resolve(this.doc, d.selector, d.index ?? 0);
    const pre = clickPrecheck(el);
    if (pre === 'missing') return this.failed(key, `target not found/visible: ${d.selector}[${d.index ?? 0}]`);
    if (pre === 'not-actionable' || !el) {
      // visible but disabled (e.g. SKIP after the click, §12.8): wait, never click it, never count a failure;
      // a target that stays disabled is caught by the watchdog (D-037)
      this.log.debug(`target not actionable yet: ${d.selector}[${d.index ?? 0}]`);
      return;
    }
    const line = this.decided(d, st, { click: d.selector, index: d.index ?? 0, screen: st.screen.kind });
    const before = st.screen.signature;
    await this.actor.click(el);
    this.view.stats.actions++;
    const changed = await waitForEffect(this.doc, el, before, () => detectScreen(this.doc).signature, VERIFY_TIMEOUT);
    this.runs.setOutcome(line, changed ? 'ok' : 'no-effect');
    if (changed) {
      this.failCount = 0;
      this.failKey = null;
    } else {
      await this.failed(key, `no effect after clicking ${d.selector}[${d.index ?? 0}]`);
    }
  }

  private async failed(key: string, why: string): Promise<void> {
    if (this.failKey === key) this.failCount++;
    else {
      this.failKey = key;
      this.failCount = 1;
    }
    const careful = !!this.view.versionWarning;
    const limit = careful ? 1 : MAX_ATTEMPTS;
    this.log.warn(`${why} (attempt ${this.failCount}/${limit})`);
    if (this.failCount >= limit) {
      this.pause(errorPause('failing', why), true, 'failing');
      return;
    }
    await sleep(600 * 2 ** (this.failCount - 1)); // backoff
  }

  private teamOrder(): string {
    return (this.reader.lastSnapshot?.run?.team ?? []).map((m) => m.uid ?? m.speciesId).join(',');
  }

  /**
   * Lead swap via the game's own keyboard shortcut Shift+<slot> (swapPartyLeadWith). Drag & drop cannot work with
   * synthetic events because the game calls setPointerCapture on pointerdown.
   */
  private async doSwap(d: Extract<Decision, { kind: 'swapTeam' }>, st: GameState): Promise<void> {
    this.decided(d, st, { swap: [d.from, d.to], where: d.where });
    if (d.to !== 0 || d.from < 1 || d.from > 8) {
      this.log.warn('only lead swaps are supported');
      return;
    }
    const before = this.teamOrder();
    // make sure no input inside our overlay has focus (the game ignores keys typed into inputs)
    (this.doc.activeElement as HTMLElement | null)?.blur?.();
    await this.actor.pressKey(this.doc, `Digit${d.from + 1}`, String(d.from + 1), { shift: true });
    for (let i = 0; i < 10; i++) {
      await sleep(150);
      await this.reader.read();
      if (this.teamOrder() !== before) {
        this.mem.reorderFailures = 0;
        return this.log.info('team reordered (Shift+' + (d.from + 1) + ')');
      }
    }
    this.mem.reorderFailures++;
    this.log.warn(`team reorder had no effect (${this.mem.reorderFailures}x) – continuing with current order`);
  }
}
