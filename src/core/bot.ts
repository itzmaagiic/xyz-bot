/** BotController: read → detect → decide → act → verify, with backoff and pause-on-unknown. */
import { Actor, humanDelay, resolve, sleep } from './actions/actor';
import type { BridgeClient } from './bridge/client';
import type { WritableSetting } from './bridge/protocol';
import { Logger } from './log/logger';
import { detectScreen, isShown } from './screens/detector';
import { DEFAULT_SETTINGS, normalizeSettings, SETTINGS_KEY, type BotSettings } from './settings';
import { StateReader } from './state/reader';
import { decide, newMemory, type EngineMemory } from './strategy/engine';
import { enumeratePaths, evaluatePath } from './strategy/sim-route';
import { FLAGS } from './flags';
import type { Decision, GameState } from './types';
import type { Platform } from '../platform/types';

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
      if (this.view.status !== 'running') void this.refresh().catch(() => undefined);
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
    this.failCount = 0;
    this.failKey = null;
    this.pendingPause = null;
    this.log.info('bot started');
    this.emit();
    void this.loop();
  }

  pause(reason: string | null = null, notify = false): void {
    const wasRunning = this.view.status === 'running';
    this.view.status = 'paused';
    this.view.pauseReason = reason;
    if (reason) this.log.warn(`paused: ${reason}`);
    this.emit();
    if (notify && wasRunning && reason) void this.notify('Pokelike bot paused', reason);
  }

  toggle(): void {
    if (this.view.status === 'running') this.pause('paused by user');
    else this.start();
  }

  /** One single tick (manual stepping). */
  async step(): Promise<void> {
    if (this.view.status === 'running') return;
    await this.tick();
    await this.refresh();
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
      this.log.error('bot loop crashed', String(e));
      this.pause(`internal error: ${String(e)}`, true);
    } finally {
      this.loopRunning = false;
    }
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
    if (!this.bridge || !run || run.mode !== 'story') return;
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
              results: { path: string[]; success: number; next: number; avgLevel: number; avgAlive: number }[];
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
    const st = await this.refresh();
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
        this.pause(d.why, true);
        return d;
      }
      case 'stop': {
        const s = this.view.stats;
        s.runs++;
        if (d.result === 'win') s.wins++;
        if (d.result === 'loss') s.losses++;
        await this.platform.storage.set(STATS_KEY, s);
        this.log.info(`run finished: ${d.why}`, s);
        void this.notify('Pokelike run finished', `${d.why} (W ${s.wins} / L ${s.losses})`);
        const cfg = this.view.settings;
        if (!cfg.autoRestart || (cfg.maxRuns > 0 && s.runs >= cfg.maxRuns)) this.pause(`run finished: ${d.why}`);
        return d;
      }
      case 'click':
        await this.doClick(d, st);
        return d;
      case 'swapTeam':
        await this.doSwap(d);
        return d;
      case 'reorder':
        await this.doReorder(d);
        return d;
      case 'openBag':
        await this.doOpenBag(d);
        return d;
    }
    return d;
  }

  private async doOpenBag(d: Extract<Decision, { kind: 'openBag' }>): Promise<void> {
    this.log.log('decision', d.why, { bag: d.index, item: d.itemId });
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
  private async doReorder(d: Extract<Decision, { kind: 'reorder' }>): Promise<void> {
    this.log.log('decision', d.why, { swaps: d.swaps, target: d.target });
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
    if (!el || !isShown(el)) {
      return this.failed(key, `target not found/visible: ${d.selector}[${d.index ?? 0}]`);
    }
    this.log.log('decision', d.why, { click: d.selector, index: d.index ?? 0, screen: st.screen.kind });
    const before = st.screen.signature;
    await this.actor.click(el);
    this.view.stats.actions++;
    const changed = await this.waitForChange(before, el);
    if (changed) {
      this.failCount = 0;
      this.failKey = null;
    } else {
      await this.failed(key, `no effect after clicking ${d.selector}[${d.index ?? 0}]`);
    }
  }

  private async waitForChange(before: string, el: Element): Promise<boolean> {
    const until = Date.now() + VERIFY_TIMEOUT;
    while (Date.now() < until) {
      await sleep(150);
      if (!el.isConnected || !isShown(el)) return true;
      if (detectScreen(this.doc).signature !== before) return true;
    }
    return false;
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
      this.pause(`action keeps failing: ${why}`, true);
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
  private async doSwap(d: Extract<Decision, { kind: 'swapTeam' }>): Promise<void> {
    this.log.log('decision', d.why, { swap: [d.from, d.to], where: d.where });
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
