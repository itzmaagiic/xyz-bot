/**
 * Simulation-backed route planning (pure). Inputs come from the page bridge, which runs the game's own battle
 * engine on sampled enemies (never on the real upcoming encounter).
 */
import { FLAGS } from '../flags';
import type { GameMap, NodeType } from '../types';

export interface SimData {
  /** nodeId → level boost → win rate of the current team (sampled enemies of that node) */
  nodeRates: Record<string, Record<number, number>>;
  /** level boost → boss win rate, without / with a full heal before the boss */
  bossNoHeal: Record<number, number>;
  bossHeal: Record<number, number>;
  bossName: string | null;
  /** level boost → win rate vs the boss AFTER this one (full heal assumed; lookahead for levelling) */
  nextBoss?: Record<number, number>;
  nextBossName?: string | null;
  /** battle order (team indices) that the joint route/order search found better than the current one */
  mapOrder?: number[] | null;
  /** core level this map should end at (from the game's level tables) */
  targetLevel?: number | null;
  /** whole-path simulations, keyed by path.join('>') */
  pathSim?: Record<string, { success: number; next: number; avgLevel: number; avgAlive?: number; progress?: number }>;
}

/** All paths from the accessible nodes to the end (boss), capped. */
export function enumeratePaths(map: GameMap, accessible: readonly string[], cap = 400): string[][] {
  const children = new Map<string, string[]>();
  for (const e of map.edges) children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
  const out: string[][] = [];
  const walk = (id: string, path: string[]) => {
    if (out.length >= cap) return;
    const p = [...path, id];
    const kids = children.get(id) ?? [];
    if (!kids.length || map.nodes[id]?.type === 'boss') {
      out.push(p);
      return;
    }
    for (const k of kids) walk(k, p);
  };
  for (const id of [...accessible].sort()) walk(id, []);
  return out;
}

/** Linear interpolation over the sampled boosts (clamped). */
export function rateAt(table: Record<number, number> | undefined, boost: number): number {
  if (!table) return 1;
  const keys = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  if (!keys.length) return 1;
  if (boost <= keys[0]!) return table[keys[0]!]!;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1]!;
    const b = keys[i]!;
    if (boost <= b) return table[a]! + ((table[b]! - table[a]!) * (boost - a)) / (b - a);
  }
  return table[keys[keys.length - 1]!]!;
}

export interface SimRouteContext {
  teamSize: number;
  maxTeamSize: number;
  nuzlocke: boolean;
}

/** Chance that a "?" node turns into a fight (22 % wild + 20 % trainer, from resolveQuestionMark). */
export const QUESTION_FIGHT = 0.42;
const BONUS: Partial<Record<NodeType, number>> = {
  item: 4,
  move_tutor: 5,
  question: 2,
  shiny: 6,
  legendary: 6,
  pokemart: 0, // D-042: the bot leaves the Mart without selling
  trade: 0.5,
};
/** Each extra member that joins on the way roughly halves the chance that a lost exchange ends the run. */
const BACKUP = 0.55;
/** Small tie-breaker per level gained. */
const FUTURE_LEVEL = 2.5;
/** Levels a run typically still gains on the next map before its boss (≈ 4 won fights). */
export const NEXT_MAP_GAIN = 8;
/** Weight of beating the next boss relative to the current one. */
/** Surviving the next map + its boss matters as much as this one (run success is a product over maps). */
const NEXT_WEIGHT = 100;
/** Value of the share of the boss chain that is won on average. */
const PROGRESS_WEIGHT = 40;

/**
 * Value of a new member while the team is not full (live finding chal6, D-046): with a lead that wins every gym
 * alone, catch nodes had no value and the team reached the league with 2–3 members. Sized like one won fight
 * (+2 levels × FUTURE_LEVEL = 5) early and less later (D-047): at 20/12 (chal7) the bot skipped so many fights
 * that the team reached the league ~25 levels lower. The route's level term counts only the members it starts
 * with, so a fresh catch no longer drags the average down.
 */
const NEW_MEMBER_EARLY = 6;
const NEW_MEMBER_LATE = 3;
const JOINS: ReadonlySet<string> = new Set(['catch', 'legendary', 'shiny']);

/** Team-building value of the catch-type nodes on a path, capped by the free slots. */
export function teamBuildValue(path: readonly string[], map: GameMap, ctx: SimRouteContext): number {
  const joins = path.filter((id) => JOINS.has(map.nodes[id]?.type ?? '')).length;
  const added = Math.min(joins, Math.max(0, ctx.maxTeamSize - ctx.teamSize));
  let v = 0;
  for (let k = 1; k <= added; k++) v += ctx.teamSize + k <= 3 ? NEW_MEMBER_EARLY : NEW_MEMBER_LATE;
  return v;
}

/**
 * Readiness for what comes next: 0.6 at the target level, +1/15 per level above/below, clamped to [0.2, 1.3].
 * Saturation keeps the bot from taking risks for levels it does not need.
 */
export function levelFactor(coreLevel: number, target: number | null): number {
  if (!target) return 1;
  return Math.max(0.2, Math.min(1.3, 0.6 + (coreLevel - target) / 15));
}

export interface SimRouteChoice {
  nodeId: string;
  value: number;
  path: string[];
  survive: number;
  boss: number;
  boost: number;
  /** estimated chance vs the boss after this one */
  next: number;
  /** best route per accessible first node (run logs, R-006) */
  alternatives?: { nodeId: string; value: number; boss: number; survive: number; next: number; path: string[] }[];
}

export function evaluatePath(
  path: readonly string[],
  map: GameMap,
  ctx: SimRouteContext,
  sim: SimData,
): Omit<SimRouteChoice, 'nodeId'> {
  const ps = sim.pathSim?.[path.join('>')];
  if (ps) {
    // Full sequential simulation available. Winning the run is a PRODUCT over all maps, so risk must be
    // multiplicative: value = P(survive route AND beat boss) × F(core level vs the level curve ahead).
    let bonus = 0;
    for (const id of path) bonus += BONUS[map.nodes[id]?.type ?? ''] ?? 0;
    const f = levelFactor(ps.avgLevel, sim.targetLevel ?? null);
    // the next map starts with whatever is still standing (no automatic heal after the boss)
    const standing =
      ps.avgAlive === undefined ? 1 : 0.8 + 0.2 * Math.min(1, ps.avgAlive / Math.max(1, Math.min(6, ctx.teamSize + 1)));
    // live A/B (see docs/STRATEGY.md): the additive form (variant A) beat the multiplicative one so far
    const value = FLAGS.multiplicative
      ? ps.success * (100 * f * standing + bonus + 10 * ps.next)
      : 100 * ps.success +
        NEXT_WEIGHT * ps.success * ps.next +
        bonus * ps.success +
        teamBuildValue(path, map, ctx) * ps.success +
        FUTURE_LEVEL * ps.avgLevel * ps.success +
        // when a full clear is unlikely (e.g. the Elite Four chain), get as far as possible instead of choosing blindly
        PROGRESS_WEIGHT * (ps.progress ?? ps.success);
    return { value, path: [...path], survive: ps.success, boss: ps.success, boost: ps.avgLevel, next: ps.next };
  }
  let boost = 0;
  let survive = 1;
  let added = 0;
  let heal = false;
  let bonus = 0;
  for (const id of path) {
    const node = map.nodes[id];
    if (!node) continue;
    switch (node.type) {
      case 'battle':
      case 'trainer':
      case 'question': {
        const fightChance = node.type === 'question' ? QUESTION_FIGHT : 1;
        const p = rateAt(sim.nodeRates[id], boost);
        const fail = (1 - p) * fightChance * BACKUP ** added;
        survive *= 1 - Math.min(1, fail);
        boost += 2 * fightChance;
        break;
      }
      case 'catch':
        if (ctx.teamSize + added < ctx.maxTeamSize) added++;
        break;
      case 'pokecenter':
        heal = true;
        break;
      default:
        break;
    }
    bonus += BONUS[node.type] ?? 0;
  }
  const table = heal ? sim.bossHeal : sim.bossNoHeal;
  const pBoss = 1 - (1 - rateAt(table, boost)) * BACKUP ** added;
  const catchValue = added * (ctx.teamSize + added <= 3 ? 6 : 3);
  const pNext = sim.nextBoss ? 1 - (1 - rateAt(sim.nextBoss, boost + NEXT_MAP_GAIN)) * BACKUP ** added : 0;
  const value = survive * (100 * pBoss + NEXT_WEIGHT * pBoss * pNext + FUTURE_LEVEL * boost + bonus + catchValue);
  return { value, path: [...path], survive, boss: pBoss, boost, next: pNext };
}

export function chooseRouteSim(
  map: GameMap,
  accessible: readonly string[],
  ctx: SimRouteContext,
  sim: SimData,
  maxPaths = 5000,
): SimRouteChoice | null {
  const children = new Map<string, string[]>();
  for (const e of map.edges) children.set(e.from, [...(children.get(e.from) ?? []), e.to]);
  let budget = maxPaths;
  let best: SimRouteChoice | null = null;
  const perFirst = new Map<string, NonNullable<SimRouteChoice['alternatives']>[number]>();
  const walk = (id: string, path: string[], first: string) => {
    if (budget <= 0) return;
    const p = [...path, id];
    const kids = children.get(id) ?? [];
    if (!kids.length || map.nodes[id]?.type === 'boss') {
      budget--;
      if (sim.pathSim && !sim.pathSim[p.join('>')]) return;
      const r = evaluatePath(p, map, ctx, sim);
      const alt = perFirst.get(first);
      if (!alt || r.value > alt.value + 1e-9)
        perFirst.set(first, { nodeId: first, value: r.value, boss: r.boss, survive: r.survive, next: r.next, path: p });
      if (!best || r.value > best.value + 1e-9 || (Math.abs(r.value - best.value) < 1e-9 && first < best.nodeId))
        best = { nodeId: first, ...r };
      return;
    }
    for (const k of kids) walk(k, p, first);
  };
  for (const id of [...accessible].sort()) walk(id, [], id);
  const res = best as SimRouteChoice | null;
  return res ? { ...res, alternatives: [...perFirst.values()] } : null;
}

/**
 * The game only offers "swap lead with slot k" (Shift+k). Any permutation is reachable with such star
 * transpositions; returns the slot indices to press, in order.
 */
export function starSwaps(current: readonly number[], target: readonly number[]): number[] {
  const cur = [...current];
  const out: number[] = [];
  for (let guard = 0; guard < 3 * cur.length && cur.join() !== target.join(); guard++) {
    const head = cur[0]!;
    const want = target.indexOf(head);
    let k: number;
    if (want > 0) k = want;
    else k = cur.findIndex((v, i) => i > 0 && v !== target[i]);
    if (k <= 0) break;
    [cur[0], cur[k]] = [cur[k]!, cur[0]!];
    out.push(k);
  }
  return out;
}

/**
 * Catch choice from simulation (index -1 = skip). Near-ties (≤ 0.03) are broken towards catching while the team
 * has room (an extra member is a backup the boss simulation barely sees early on) and then by offer level.
 */
type Offer = { name: string; level: number; baseStats?: object };

/** species strength: sum of the base stats (0 when unknown, e.g. a DOM-only card) */
export function baseStatTotal(m: { baseStats?: object } | undefined): number {
  return m?.baseStats ? Object.values(m.baseStats).reduce((a, b) => a + (Number(b) || 0), 0) : 0;
}

/** with a full team, a catch must be clearly stronger than the weakest member to be worth the swap */
const UPGRADE = 1.15;

export function chooseCatchSim(
  options: readonly { index: number; current: number; next: number; league?: number | null; value: number }[],
  offer: readonly Offer[],
  teamSize: number,
  maxTeamSize: number,
  team: readonly Offer[] = [],
): { index: number; why: string } {
  if (!options.length) return { index: -1, why: 'no simulation' };
  const best = Math.max(...options.map((o) => o.value));
  const near = options.filter((o) => o.value >= best - 0.03);
  const room = teamSize < maxTeamSize;
  // live finding (arena challenge, 2026-11-27): when every boss is already ~100 %, the simulation gives no signal and
  // weak species were caught – the team was far too weak for the final league. Near-ties go to the stronger species.
  const weakest = team.length ? Math.min(...team.map(baseStatTotal)) : 0;
  const upgrade = (i: number) => weakest > 0 && baseStatTotal(offer[i]) >= weakest * UPGRADE;
  near.sort((a, b) => {
    const skipA = a.index < 0;
    const skipB = b.index < 0;
    if (skipA !== skipB) {
      const take = skipA ? b.index : a.index;
      const catchFirst = room || upgrade(take);
      return skipA === catchFirst ? 1 : -1;
    }
    return (
      baseStatTotal(offer[b.index]) - baseStatTotal(offer[a.index]) ||
      b.value - a.value ||
      (offer[b.index]?.level ?? 0) - (offer[a.index]?.level ?? 0)
    );
  });
  const o = near[0]!;
  const f = (x: number) => `${Math.round(x * 100)} %`;
  const lg = o.league != null ? `, league ${f(o.league)} of the fights` : '';
  if (o.index < 0)
    return { index: -1, why: `sim: no option improves the boss odds (${f(o.current)} / next ${f(o.next)}${lg})` };
  return { index: o.index, why: `sim: ${offer[o.index]?.name} → boss ${f(o.current)}, next boss ${f(o.next)}${lg}` };
}
