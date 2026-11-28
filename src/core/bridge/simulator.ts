/**
 * Battle simulator – runs in the page's MAIN world and uses the game's own battle engine (`runBattle`).
 *
 * Side-effect free by construction (D-019):
 *  - every input team is deep-cloned before it reaches the engine
 *  - simulations temporarily set the global RNG seed (seedRng) and the instance-id counter (_pokeUidCounter);
 *    both are saved before and restored after every simulation, so the real run continues exactly as if nothing
 *    had happened
 *  - simulation seeds come from the VISIBLE state (simBase, sim-seed.ts), never from the game's hidden RNG:
 *    getRngSeed() is used only to save/restore (R-239, R-248, D-025)
 *  - runBattle itself only reads `state` (verified in docs/GAME_RECON.md §8)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FLAGS } from '../flags';
import { simBase } from './sim-seed';
import { noteError } from '../log/note';
import { arenaLeagueSpecs } from './league';
declare const state: any;
declare function runBattle(p: any[], e: any[], items: any[], eItems: any[], log: any, cfg: any, passives: any[]): any;
declare function getRngSeed(): number;
declare function seedRng(s: number): void;
declare let _pokeUidCounter: number;
declare function campaignGymTeam(i: number): Promise<{ leader: any; enemyTeam: any[] }>;
declare function createInstance(m: any, lvl: number, shiny: boolean, tier: number): any;
declare function slEnemyLevel(l: number): number;
declare function resolveTrainerTeamEvolutions(t: any[]): Promise<any[]>;
declare function calcHp(base: number, lvl: number): number;
declare function mutPct(m: any): number;
declare function augMult(m: any): number;
declare function applyMegaEvolution(m: any): void;
declare function buildGen3AbilityConfig(): any;
declare function buildTraitsConfig(a: any, b: any, p: any[]): any;
declare function mergeBattleConfigs(a: any, b: any): any;
declare const JOHTO_GYM_LEADERS: any[];
declare const ELITE_4: any[];
declare const HOENN_ELITE_4: any[];
declare const SINNOH_ELITE_4: any[];
declare const UNOVA_ELITE_4: any[];

export interface BossInfo {
  name: string;
  type: string | null;
  team: { speciesId: number; name: string; level: number; types: string[]; heldItem: string | null }[];
}

export interface SimRequest {
  /** level boosts to evaluate (e.g. projected +2 per won fight on a route) */
  boosts?: number[];
  /** battle orders to evaluate (indices into state.team); default: current order */
  orders?: number[][];
  /** simulations per scenario */
  n?: number;
  /** assume a full heal before the boss (Pokécenter on the route) */
  heal?: boolean;
  /** 0 = boss of this map, 1 = the next one */
  ahead?: number;
}

export interface SimResult {
  boss: BossInfo | null;
  scenarios: {
    boost: number;
    order: number[];
    heal: boolean;
    winRate: number;
    avgAlive: number;
    /** share of the boss chain won on average (0..1) */
    progress?: number;
  }[];
  /** proof that the simulation did not disturb the run */
  restored: boolean;
}

const clone = <T>(v: T): T =>
  typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));

function gen(s: any): number {
  return s.gen6Mode ? 6 : s.gen5Mode ? 5 : s.gen4Mode ? 4 : s.gen3Mode ? 3 : s.gen2Mode ? 2 : 1;
}

/**
 * Builds a boss exactly like doBossNode / doElite4 do (story mode only).
 * `ahead` = 0 → the boss of the current map, 1 → the boss after it (lookahead for levelling decisions).
 */
async function bossTeamRaw(ahead = 0): Promise<{ name: string; type: string | null; team: any[] } | null> {
  const s = state;
  if (!s) return null;
  if (s.currentMap >= 8) return bossAt(8, s.eliteIndex + ahead);
  return s.currentMap + ahead >= 8 ? bossAt(8, 0) : bossAt(s.currentMap + ahead, 0);
}

async function bossAt(
  mapIdx: number,
  eliteIdx: number,
): Promise<{ name: string; type: string | null; team: any[] } | null> {
  const s = state;
  if (!s || s.isEndlessMode || s.inSubMap || s.rankedMode) return null;
  const g = gen(s);
  const mult = s.challengeLevelMult || 1;
  if (mapIdx >= 8) {
    if (g === 2 || g === 6) return null; // separate gauntlet implementations – not simulated (yet)
    const list = g === 5 ? UNOVA_ELITE_4 : g === 4 ? SINNOH_ELITE_4 : g === 3 ? HOENN_ELITE_4 : ELITE_4;
    const e = list?.[eliteIdx];
    if (!e) return null;
    const team = (await resolveTrainerTeamEvolutions(e.team)).map((m: any) => ({
      ...createInstance(m, slEnemyLevel(Math.max(1, Math.round(m.level * mult))), false, 2),
      heldItem: m.heldItem || null,
      ...(m.hiddenAbility ? { _hiddenAbility: true } : {}),
    }));
    return { name: e.name, type: e.type ?? null, team };
  }
  if (g === 2) {
    const L = JOHTO_GYM_LEADERS?.[mapIdx];
    if (!L) return null;
    const team = (await resolveTrainerTeamEvolutions(L.team)).map((m: any) => ({
      ...createInstance(m, slEnemyLevel(m.level), false, L.moveTier ?? 1),
      heldItem: m.heldItem || null,
    }));
    return { name: L.name, type: L.type ?? null, team };
  }
  const { leader, enemyTeam } = await campaignGymTeam(mapIdx);
  return { name: leader?.name ?? '?', type: leader?.type ?? null, team: enemyTeam };
}

declare const endlessState: any;
declare function computeTraitTiers(team: any[], bonus: number, passives?: any[], enemy?: any[]): Record<string, number>;
declare function computeMirroredTraits(player: any, enemy: any, bonus: number): Record<string, number>;
declare function chalBadgeRule(n: number): boolean;
declare function buildEndlessExtraConfig(team: any[], enemy: any[]): any;
declare function fetchSpeciesForLevel(id: number, lvl: number, keepForm: boolean): Promise<any>;
declare function makeMegaStoneItem(m: any): any;
declare function syncMegaForm(m: any): void;
declare function erModeLevel(l: number): number;
declare const MEGA_STONE_BY_ID: Record<string, any>;
declare const ITEM_POOL: any[];
declare const TRAIT_DESCRIPTIONS: Record<string, unknown>;
declare const ENDLESS_TEAM_SIZES: number[];

/** What kind of opponent a simulated fight is against (decides the trait setup, like runBattleScreen does). */
export interface FightMeta {
  kind: 'wild' | 'trainer' | 'boss';
  /** enemy trait tiers for bosses (computed like runEndlessTrainerFight) */
  tiers?: Record<string, number> | null;
}

/**
 * Battle config of one fight. Story: Gen-3+ abilities (+ relic-free traits) as before.
 * Challenge/endless: trait tiers of both sides + relics (passives, run buffs) exactly like runBattleScreen /
 * runEndlessTrainerFight, so relics and traits change the simulated outcome like they change the real one.
 */
/** Relic set used by simulated fights (null = the real one); lets the bot try out relic offers. */
let passivesOverride: any[] | null = null;
const curPassives = (): any[] => passivesOverride ?? state?.passives ?? [];

function fightConfig(team: any[], enemy: any[], meta?: FightMeta): any {
  const s = state;
  if (!s?.isEndlessMode) return battleConfig();
  try {
    const passives = curPassives();
    const playerTiers = computeTraitTiers(team, 0, passives, enemy);
    let enemyTiers: Record<string, number> | null = null;
    if (meta?.kind === 'boss') enemyTiers = meta.tiers ?? computeTraitTiers(enemy, 0);
    else if (meta?.kind === 'trainer' && typeof chalBadgeRule === 'function' && chalBadgeRule(1))
      enemyTiers = computeTraitTiers(enemy, 0);
    let cfg = buildTraitsConfig(
      playerTiers,
      enemyTiers || {},
      meta?.kind === 'boss' ? [...passives, ...(s.runBuffs || [])] : passives,
    );
    if (
      (s.challengeGen3 || s.challengeGen4 || s.challengeGen5 || s.challengeGen6) &&
      typeof buildGen3AbilityConfig === 'function'
    )
      cfg = mergeBattleConfigs(cfg, buildGen3AbilityConfig());
    if (meta?.kind !== 'boss' && s.challengeEndless2 && typeof buildEndlessExtraConfig === 'function') {
      const extra = buildEndlessExtraConfig(team, enemy);
      if (extra) cfg = mergeBattleConfigs(cfg, extra);
    }
    return cfg;
  } catch (e) {
    noteError('simulator:battle-config', e);
    return null;
  }
}

/** Challenge/endless boss team built like runEndlessTrainerFight (fusions/mutations/pre-fusion are skipped). */
async function buildEndlessTrainer(SE: any): Promise<{ team: any[]; tiers: Record<string, number> | null } | null> {
  const s = state;
  const base = s.challengeOnlyFight ? Math.round(SE.level * 1.5) : SE.level;
  const lv = (o: number) =>
    s.challengeEndless2 && typeof erModeLevel === 'function' ? erModeLevel(base + o) : base + o;
  const ids: any[] = SE.fetchIds || SE.speciesIds || [];
  const offs: number[] | null = SE.levelOffsets ?? null;
  const sps = await Promise.all(
    ids.map((id: any, i: number) =>
      SE.fixedForms ? fetchPokemonById(id) : fetchSpeciesForLevel(id, lv(offs?.[i] ?? i), !SE.allowDevolve),
    ),
  );
  const team: any[] = [];
  sps.forEach((sp: any, i: number) => {
    if (!sp) return;
    const shiny = Array.isArray(SE.shinySlots) && SE.shinySlots.includes(i);
    const m = createInstance(sp, lv(offs?.[i] ?? i), shiny, Math.min(2, SE.moveTier ?? 1));
    if (Array.isArray(SE.hiddenSlots) && SE.hiddenSlots.includes(i)) m._hiddenAbility = true;
    const held = SE.heldItems?.[i];
    if (held && Array.isArray(ITEM_POOL)) {
      const it = ITEM_POOL.find((x: any) => x.id === held);
      if (it) m.heldItem = { ...it };
    }
    const mega = SE.megaSlots?.[i];
    if (
      mega &&
      typeof MEGA_STONE_BY_ID !== 'undefined' &&
      MEGA_STONE_BY_ID[mega] &&
      typeof makeMegaStoneItem === 'function'
    ) {
      m.heldItem = makeMegaStoneItem(MEGA_STONE_BY_ID[mega]);
      if (typeof syncMegaForm === 'function') syncMegaForm(m);
    }
    team.push(m);
  });
  if (!team.length) return null;
  let tiers: Record<string, number> | null = null;
  try {
    tiers =
      SE.allTraits != null
        ? Object.fromEntries(Object.keys(TRAIT_DESCRIPTIONS).map((t) => [t, SE.allTraits]))
        : SE.specificTraits
          ? { ...SE.specificTraits }
          : SE.copyPlayerTraits
            ? computeMirroredTraits(endlessState.traitTiers, computeTraitTiers(team, 0), SE.copyPlayerTraitsBonus ?? 1)
            : computeTraitTiers(team, SE.traitBonus ?? 0);
    if (SE.traitOverrides) {
      tiers = { ...tiers, ...SE.traitOverrides };
      for (const [k, v] of Object.entries(SE.traitOverrides)) if (!v) delete tiers![k];
    }
    if (SE.maxTraitTier) for (const k of Object.keys(tiers!)) tiers![k] = Math.min(tiers![k]!, SE.maxTraitTier);
  } catch (e) {
    noteError('simulator:trait-tiers', e);
    tiers = null;
  }
  return { team, tiers };
}

/** Boss (or gauntlet) of the current/next challenge map from endlessState.currentRegion.trainers. */
/**
 * League members still to fight (D-043). The game plays a gauntlet member by member and stores its position in
 * `state._erGauntlet = { nodeId: bossPrepKey('gauntlet'), idx }` right before each fight (also across reloads).
 * Members already beaten are not fought again, so the simulation must not replay them either.
 */
export function remainingGauntlet<T>(list: readonly T[], erGauntlet: unknown, ahead: number, key: string | null): T[] {
  if (ahead !== 0 || list.length <= 1 || !erGauntlet || typeof erGauntlet !== 'object') return [...list];
  const g = erGauntlet as { nodeId?: unknown; idx?: unknown };
  if (key != null && g.nodeId !== key) return [...list];
  const idx = typeof g.idx === 'number' && Number.isInteger(g.idx) ? g.idx : 0;
  return list.slice(Math.min(Math.max(0, idx), list.length - 1));
}

declare function bossPrepKey(suffix?: string): string;

function gauntletKey(): string | null {
  try {
    return typeof bossPrepKey === 'function' ? bossPrepKey('gauntlet') : null;
  } catch (e) {
    noteError('simulator:gauntlet-key', e);
    return null;
  }
}

async function endlessBossChain(ahead: number): Promise<{ name: string; teams: any[][]; metas: FightMeta[] } | null> {
  const es = typeof endlessState !== 'undefined' ? endlessState : null;
  const sp = es?.currentRegion?.trainers?.[(es.mapIndexInRegion ?? 0) + ahead];
  if (!sp) return null;
  const list: any[] = sp.gauntlet?.length
    ? remainingGauntlet(sp.gauntlet, state?._erGauntlet ?? null, ahead, gauntletKey())
    : [sp];
  const teams: any[][] = [];
  const metas: FightMeta[] = [];
  for (const spec of list) {
    const b = await buildEndlessTrainer(spec);
    if (!b) continue;
    teams.push(b.team);
    metas.push({ kind: 'boss', tiers: b.tiers });
  }
  if (!teams.length) return null;
  const name = String(sp.archetype?.name ?? 'Boss');
  return { name: teams.length > 1 ? `${name} +${teams.length - 1}` : name, teams, metas };
}

// ---------------------------------------------------------------------------------------------------------------
// The league of the arena challenge as a second target (D-044): fixed at the start of the run, much stronger than
// any gym. While every gym looks safe, catches and relics are also judged by how far the team would get there.
// ---------------------------------------------------------------------------------------------------------------
declare const WT_GAUNTLETS: any[];
declare const WT_BOSS_LEVELS: number[];
declare function buildWtTrainer(def: any, level: number, moveTier: number, size?: number): any;
declare function chalBadgeBossMult(): number;
declare function treatBossLevelBonus(i: number): number;
declare function treatGauntletBonus(i: number): number;

type Chain = { name: string; teams: any[][]; metas: FightMeta[] };
let leagueCache: { key: string; chain: Chain | null } | null = null;

/** Specs of the league fights: the real ones once the last region is rolled, else rebuilt like the game does. */
export function leagueSpecs(): { name: string; specs: any[] } | null {
  const s = state;
  const es = typeof endlessState !== 'undefined' ? endlessState : null;
  if (!s?.isEndlessMode || !es || es.wtGauntletPick == null || !Array.isArray(es.wtTrainerPicks)) return null;
  const real = es.regionNumber === 3 ? es.currentRegion?.trainers?.[2] : null;
  if (real?.gauntlet?.length) return { name: String(real.archetype?.name ?? 'League'), specs: real.gauntlet };
  if (typeof WT_GAUNTLETS === 'undefined' || typeof buildWtTrainer !== 'function') return null;
  const g = WT_GAUNTLETS[es.wtGauntletPick];
  if (!g?.members || !g.champion) return null;
  const num = (f: () => number, d: number) => {
    try {
      const v = f();
      return Number.isFinite(v) ? v : d;
    } catch (e) {
      noteError('simulator:league-param', e);
      return d;
    }
  };
  const rule7 = typeof chalBadgeRule === 'function' && num(() => (chalBadgeRule(7) ? 1 : 0), 0) === 1;
  const second = rule7 && es.wtSecondChampPick != null ? WT_GAUNTLETS[es.wtSecondChampPick]?.champion : null;
  const specs = arenaLeagueSpecs(g, {
    bossLevels: typeof WT_BOSS_LEVELS !== 'undefined' ? WT_BOSS_LEVELS : [],
    levelMult: Number(s.challengeLevelMult) || 1,
    badgeMult: typeof chalBadgeBossMult === 'function' ? num(() => chalBadgeBossMult(), 1) : 1,
    bossLevelBonus: typeof treatBossLevelBonus === 'function' ? num(() => treatBossLevelBonus(8), 0) : 0,
    gauntletBonus: (i) => (typeof treatGauntletBonus === 'function' ? num(() => treatGauntletBonus(i), 0) : 0),
    eliteMod: s.challengeId ? Number(s.challengeEliteLevelMod) || 0 : null,
    secondChampion: second ?? null,
  }).map((x) => buildWtTrainer(x.def, x.level, x.moveTier));
  return { name: String(g.name ?? 'League'), specs };
}

async function arenaLeague(): Promise<Chain | null> {
  const s = state;
  const es = typeof endlessState !== 'undefined' ? endlessState : null;
  if (!s?.isEndlessMode || !es) return null;
  const key = [
    s.runSeed,
    es.wtGauntletPick,
    es.wtSecondChampPick,
    s.challengeLevelMult,
    s.challengeBadge,
    es.regionNumber === 3 ? 'real' : 'built',
  ].join('|');
  if (leagueCache?.key === key) return leagueCache.chain;
  let chain: Chain | null = null;
  const ls = leagueSpecs();
  if (ls) {
    const teams: any[][] = [];
    const metas: FightMeta[] = [];
    for (const spec of ls.specs) {
      const b = await buildEndlessTrainer(spec);
      if (!b) continue;
      teams.push(b.team);
      metas.push({ kind: 'boss', tiers: b.tiers });
    }
    if (teams.length) chain = { name: ls.name, teams, metas };
  }
  leagueCache = { key, chain };
  return chain;
}

/** Level the team typically has when it reaches the league: a few below the last gym (chal3: Lv 91–100 vs 102). */
function leagueArrivalLevel(): number {
  const s = state;
  const gym8 = typeof WT_BOSS_LEVELS !== 'undefined' ? (WT_BOSS_LEVELS[7] ?? 102) : 102;
  return Math.round(gym8 * (Number(s?.challengeLevelMult) || 1)) - 6;
}

/** The team as it would look on arrival at the league: core (best three) at the arrival level, full HP. */
function towardLeague(team: any[]): any[] {
  const core = team
    .map((m: any) => m.level)
    .sort((a: number, b: number) => b - a)
    .slice(0, 3);
  const avg = core.reduce((a: number, b: number) => a + b, 0) / Math.max(1, core.length);
  return projectTeam(team, Math.max(0, Math.round(leagueArrivalLevel() - avg)), true);
}

/** Average share of the league won (0..1) – smooth even when a full clear is out of reach. */
function leagueProgress(sb: number, team: any[], league: Chain, n: number, salt: number): number {
  let won = 0;
  for (let k = 0; k < n; k++) {
    seedRng((sb ^ Math.imul(k + salt, 0x85ebca6b)) >>> 0);
    won += fightChainCount(clone(team), league.teams, league.metas);
  }
  return won / n / league.teams.length;
}

/** Weight of the league share next to the gym win rates: decides near-ties, never outweighs real gym risk. */
const LEAGUE_WEIGHT = 0.25;

function battleConfig(): any {
  const s = state;
  if (s.isEndlessMode || gen(s) < 3 || typeof buildGen3AbilityConfig !== 'function') return null;
  let cfg = buildGen3AbilityConfig();
  if (typeof buildTraitsConfig === 'function')
    cfg = mergeBattleConfigs(cfg, buildTraitsConfig({}, {}, s.passives || []));
  return cfg;
}

/**
 * The fights that must be won in a row: a single gym leader, or – on the last map – every remaining Elite Four
 * member plus the champion (doElite4 runs them back to back without healing).
 */
async function bossChain(ahead = 0): Promise<{ name: string; teams: any[][]; metas?: FightMeta[] } | null> {
  const s = state;
  if (!s) return null;
  if (s.isEndlessMode) return endlessBossChain(ahead);
  const g = gen(s);
  const gauntlet = g !== 2 && g !== 6;
  if (s.currentMap < 8 && s.currentMap + ahead < 8) {
    const b = await bossAt(s.currentMap + ahead, 0);
    return b ? { name: b.name, teams: [b.team] } : null;
  }
  if (!gauntlet || (s.currentMap >= 8 && ahead > 0)) return null;
  const start = s.currentMap >= 8 ? s.eliteIndex : 0;
  const teams: any[][] = [];
  let name: string | null = null;
  for (let i = start; i < start + 8; i++) {
    const b = await bossAt(8, i);
    if (!b) break;
    teams.push(b.team);
    name ??= b.name;
  }
  if (!teams.length) return null;
  return { name: teams.length > 1 ? `${name} +${teams.length - 1}` : String(name), teams };
}

/** Team as it would look after `boost` more levels (only living members level up – like applyLevelGain). */
export function projectTeam(team: any[], boost: number, heal: boolean): any[] {
  return clone(team).map((m: any) => {
    const alive = m.currentHp > 0;
    if (heal) m.currentHp = m.maxHp;
    if (boost > 0 && (alive || heal)) {
      const ratio = m.maxHp > 0 ? m.currentHp / m.maxHp : 1;
      m.level = Math.min(100, m.level + boost);
      const hpBuff = m.statBuffs?.hp ?? 0;
      const maxHp = Math.floor(calcHp(m.baseStats.hp, m.level) * (1 + 0.05 * hpBuff + mutPct(m)) * augMult(m));
      m.maxHp = maxHp;
      m.currentHp = Math.max(1, Math.round(maxHp * ratio));
    }
    return m;
  });
}

export async function simulateBoss(req: SimRequest): Promise<SimResult> {
  const seed0 = getRngSeed();
  const sb = simBase(typeof state !== 'undefined' ? state : null);
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch (e) {
    noteError('simulator:uid-read', e);
    uid0 = null;
  }
  const out: SimResult = { boss: null, scenarios: [], restored: false };
  try {
    const chain = await bossChain(req.ahead ?? 0);
    const raw =
      (await bossTeamRaw(req.ahead ?? 0)) ??
      (chain ? { name: chain.name, type: null, team: chain.teams[0] ?? [] } : null);
    if (!raw || !chain) return out;
    out.boss = {
      name: chain.name,
      type: raw.type,
      team: raw.team.map((m: any) => ({
        speciesId: m.speciesId,
        name: m.name,
        level: m.level,
        types: m.types,
        heldItem: m.heldItem?.id ?? null,
      })),
    };
    const team: any[] = state.team ?? [];
    const orders = req.orders?.length ? req.orders : [team.map((_: any, i: number) => i)];
    const boosts = req.boosts?.length ? req.boosts : [0];
    const n = Math.max(1, Math.min(200, req.n ?? 24));
    for (const boost of boosts) {
      const projected = projectTeam(team, boost, !!req.heal);
      for (const order of orders) {
        const ordered = order.map((i) => projected[i]).filter(Boolean);
        let wins = 0;
        let alive = 0;
        let fights = 0;
        for (let k = 0; k < n; k++) {
          seedRng((sb ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0);
          const p = clone(ordered);
          const won = fightChainCount(p, chain.teams, chain.metas);
          if (won === chain.teams.length) wins++;
          fights += won;
          alive += p.filter((m: any) => m.currentHp > 0).length;
        }
        out.scenarios.push({
          boost,
          order,
          heal: !!req.heal,
          winRate: wins / n,
          avgAlive: alive / n,
          // share of the chain won on average – separates orders when a full clear is out of reach (D-043)
          progress: fights / n / chain.teams.length,
        });
      }
    }
    return out;
  } finally {
    seedRng(seed0);
    if (uid0 !== null) {
      try {
        _pokeUidCounter = uid0;
      } catch (e) {
        noteError('simulator:uid-restore', e); // binding not writable – ids only grow, harmless
      }
    }
    out.restored = getRngSeed() === seed0 && (uid0 === null || _pokeUidCounter === uid0);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Map node risk: sample enemies exactly like doBattleNode / doTrainerNode would (with independent seeds – this
// estimates the *distribution*, it never predicts the real upcoming encounter).
// ---------------------------------------------------------------------------------------------------------------
declare function getLevelForNode(n: any): number;
declare function getCatchChoices(...a: any[]): Promise<any[]>;
declare function getEncounterMapIndex(): number;
declare function getCatchGenRange(): { minGenId: number; maxGenId: number };
declare function chalBadgeWildLevel(l: number): number;
declare function encounterLevelGateApplies(): boolean;
declare function minLevelForSpecies(id: number): number;
declare function resolveEvoForLevel(id: number, lvl: number): number;
declare function fetchPokemonById(id: number): Promise<any>;
declare function trainerFightLevel(n: any): number;
declare function trainerTeamSpecies(sprite: string, cfg: any, lvl: number, size: number): Promise<any[]>;
declare const TRAINER_BATTLE_CONFIG: Record<string, any>;
declare const NEVER_WILD_IDS: Set<number>;

declare function rng(): number;

// the game names this function with a Cyrillic "Т" (U+0422) – look it up dynamically
const moveTierForMap = (map: number): number => {
  const f = (globalThis as any)['getMoveТierForMap'] ?? (globalThis as any).getMoveTierForMap;
  try {
    return typeof f === 'function' ? f(map) : map <= 1 ? 0 : map <= 6 ? 1 : 2;
  } catch (e) {
    noteError('simulator:move-tier', e);
    return 1;
  }
};

async function wildEnemy(node: any): Promise<any[] | null> {
  const s = state;
  const off =
    s.gen2Mode || s.gen3Mode
      ? Math.min(4, Math.floor((s.currentMap + 1) / 2))
      : !s.isEndlessMode && s.currentMap >= 1
        ? 1
        : 0;
  const lvl = chalBadgeWildLevel(slEnemyLevel(Math.max(1, getLevelForNode(node) - off)));
  const range = getCatchGenRange();
  let pool = await getCatchChoices(getEncounterMapIndex(), 3, range.maxGenId, !s.isEndlessMode, range.minGenId);
  const gated = encounterLevelGateApplies()
    ? pool.filter((p: any) => minLevelForSpecies(p.id ?? p.speciesId) <= lvl)
    : pool;
  if (gated.length) pool = gated;
  const notNever = pool.filter((p: any) => !(NEVER_WILD_IDS as any)?.has?.(p.id ?? p.speciesId));
  if (notNever.length) pool = notNever;
  const pick = pool[Math.floor(rng() * pool.length)];
  if (!pick) return null;
  const id = pick.id ?? pick.speciesId;
  const evo = resolveEvoForLevel(id, lvl);
  const species = (evo !== id && (await fetchPokemonById(evo))) || pick;
  return [createInstance(species, lvl, false, moveTierForMap(s.currentMap))];
}

async function trainerEnemies(node: any): Promise<any[] | null> {
  const s = state;
  const sprite = node.trainerSprite || 'aceTrainer';
  const cfg = TRAINER_BATTLE_CONFIG?.[sprite] || TRAINER_BATTLE_CONFIG?.aceTrainer;
  if (!cfg) return null;
  let size = s.currentMap === 0 ? 1 : s.currentMap <= 2 ? 2 : 3;
  if (s.isEndlessMode && typeof endlessState !== 'undefined' && typeof ENDLESS_TEAM_SIZES !== 'undefined') {
    // doTrainerNode: endless trainers use ENDLESS_TEAM_SIZES of the stage minus one
    const idx = (endlessState.regionNumber - 1) * 3 + endlessState.mapIndexInRegion;
    size = Math.max(1, (ENDLESS_TEAM_SIZES[idx] ?? 4) - 1);
  }
  const lvl = trainerFightLevel(node);
  const species = await trainerTeamSpecies(sprite, cfg, lvl, size);
  if (!species?.length) return null;
  const tier = moveTierForMap(s.currentMap);
  return species.map((x: any) => createInstance(x, lvl, false, tier));
}

export interface NodeSimRequest {
  nodes: string[];
  boosts?: number[];
  n?: number;
}

export interface NodeSimResult {
  /** nodeId → boost → win rate */
  rates: Record<string, Record<number, number>>;
  restored: boolean;
}

export async function simulateNodes(req: NodeSimRequest): Promise<NodeSimResult> {
  const seed0 = getRngSeed();
  const sb = simBase(typeof state !== 'undefined' ? state : null);
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch (e) {
    noteError('simulator:uid-read', e);
    uid0 = null;
  }
  const out: NodeSimResult = { rates: {}, restored: false };
  try {
    const s = state;
    if (!s?.map?.nodes) return out;
    const boosts = req.boosts?.length ? req.boosts : [0];
    const n = Math.max(1, Math.min(60, req.n ?? 12));
    const items = s.items || [];
    const passives = s.passives || [];
    for (const id of req.nodes) {
      const node = s.map.nodes[id];
      if (!node) continue;
      const kind = node.type;
      if (kind !== 'battle' && kind !== 'trainer' && kind !== 'question') continue;
      out.rates[id] = {};
      for (const boost of boosts) {
        const team = projectTeam(s.team ?? [], boost, false);
        let wins = 0;
        let done = 0;
        for (let k = 0; k < n; k++) {
          seedRng((sb ^ Math.imul(k + 7, 0x85ebca6b) ^ (boost * 0x27d4eb2d)) >>> 0);
          // a "?" is 22 % wild / 20 % trainer / otherwise no fight – sample only the fights here
          const asTrainer = kind === 'trainer' || (kind === 'question' && k % 2 === 1);
          const enemy = asTrainer ? await trainerEnemies(node) : await wildEnemy(node);
          if (!enemy?.length) continue;
          const p = clone(team);
          if (typeof applyMegaEvolution === 'function') p.forEach((m: any) => applyMegaEvolution(m));
          const e = clone(enemy);
          const cfg = fightConfig(p, e, { kind: asTrainer ? 'trainer' : 'wild' });
          const r = runBattle(p, e, clone(items), [], null, cfg, clone(passives));
          done++;
          if (r?.playerWon) wins++;
        }
        out.rates[id]![boost] = done ? wins / done : 1;
      }
    }
    return out;
  } finally {
    seedRng(seed0);
    if (uid0 !== null) {
      try {
        _pokeUidCounter = uid0;
      } catch (e) {
        noteError('simulator:uid-restore', e); // ids only grow, harmless
      }
    }
    out.restored = getRngSeed() === seed0 && (uid0 === null || _pokeUidCounter === uid0);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Catch evaluation: which offered Pokémon (or none) gives the best chances against the next two bosses?
// ---------------------------------------------------------------------------------------------------------------
export interface CatchSimRequest {
  /** levels the team is expected to gain before the current boss */
  boost?: number;
  n?: number;
}

export interface CatchSimResult {
  /** index -1 = skip; value = win(current boss) + 0.6·win(next boss) + 0.25·league share (D-044) */
  options: { index: number; current: number; next: number; league?: number | null; value: number }[];
  /** league of the arena challenge used as second target, null outside */
  leagueName?: string | null;
  restored: boolean;
}

function chainRate(sb: number, team: any[], teams: any[][], n: number, salt: number, metas?: FightMeta[]): number {
  let wins = 0;
  for (let k = 0; k < n; k++) {
    seedRng((sb ^ Math.imul(k + salt, 0xc2b2ae35)) >>> 0);
    if (fightChain(clone(team), teams, metas)) wins++;
  }
  return wins / n;
}

export async function simulateCatch(req: CatchSimRequest): Promise<CatchSimResult> {
  const seed0 = getRngSeed();
  const sb = simBase(typeof state !== 'undefined' ? state : null);
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch (e) {
    noteError('simulator:uid-read', e);
    uid0 = null;
  }
  const out: CatchSimResult = { options: [], restored: false };
  try {
    const offer: any[] = state.savedCatch?.instances ?? [];
    const cur = await bossChain(0);
    const next = await bossChain(1);
    if (!offer.length || !cur) return out;
    const boost = req.boost ?? 4;
    const n = Math.max(4, Math.min(60, req.n ?? 20));
    const team: any[] = state.team ?? [];
    const league = await arenaLeague(); // D-044
    out.leagueName = league?.name ?? null;
    for (let c = -1; c < offer.length; c++) {
      let t = clone(team);
      if (c >= 0) {
        const mon = clone(offer[c]);
        if (t.length < 6) t.push(mon);
        else {
          // full team: the newcomer replaces the lowest-level member (what the swap screen would do)
          let lo = 0;
          t.forEach((m: any, i: number) => (m.level < t[lo].level ? (lo = i) : 0));
          t[lo] = mon;
        }
      }
      const curRate = chainRate(sb, projectTeam(t, boost, false), cur.teams, n, 11 + c, cur.metas);
      const nextRate = next ? chainRate(sb, projectTeam(t, boost + 8, true), next.teams, n, 101 + c, next.metas) : 0;
      const lg = league ? leagueProgress(sb, towardLeague(t), league, Math.max(6, Math.round(n / 2)), 201 + c) : null;
      t = [];
      out.options.push({
        index: c,
        current: curRate,
        next: nextRate,
        league: lg,
        value: curRate + 0.6 * nextRate + LEAGUE_WEIGHT * (lg ?? 0),
      });
    }
    return out;
  } finally {
    seedRng(seed0);
    if (uid0 !== null) {
      try {
        _pokeUidCounter = uid0;
      } catch (e) {
        noteError('simulator:uid-restore', e); // ids only grow, harmless
      }
    }
    out.restored = getRngSeed() === seed0 && (uid0 === null || _pokeUidCounter === uid0);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Whole-path simulation: carries HP, faints, level-ups (+2 for the living after each win), catches and heals from
// node to node, then fights the boss. Answers "P(survive the route AND beat the boss)".
// ---------------------------------------------------------------------------------------------------------------
export interface PathSimRequest {
  paths: string[][];
  /** battle order to start with (indices into state.team); default: current order */
  order?: number[];
  n?: number;
  /** levels the team is assumed to gain on the next map before the next boss */
  nextGain?: number;
}

export interface PathSimResult {
  results: { path: string[]; success: number; next: number; avgLevel: number; avgAlive: number; progress: number }[];
  /** level the core should reach on this map: max wild level of the next map (champion level on the last map) */
  targetLevel: number | null;
  restored: boolean;
}

function levelUp(m: any, by: number, participated = false): void {
  // applyLevelGain: living members AND everyone who was sent out (even if they fainted) gain the levels
  if ((m.currentHp <= 0 && !participated) || by <= 0) return;
  const oldMax = m.maxHp;
  m.level = Math.min(100, m.level + by);
  const hpBuff = m.statBuffs?.hp ?? 0;
  const newMax = Math.floor(calcHp(m.baseStats.hp, m.level) * (1 + 0.05 * hpBuff + mutPct(m)) * augMult(m));
  m.maxHp = newMax;
  if (m.currentHp > 0) m.currentHp = Math.min(newMax, m.currentHp + (newMax - oldMax));
}

/** One fight; copies HP back onto the persistent team. Returns true on a win. */
function fightInto(team: any[], enemy: any[], meta?: FightMeta): boolean {
  const p = clone(team);
  if (typeof applyMegaEvolution === 'function') p.forEach((m: any) => applyMegaEvolution(m));
  const e = clone(enemy);
  const cfg = fightConfig(p, e, meta);
  const r = runBattle(p, e, clone(state.items || []), [], null, cfg, clone(curPassives()));
  const after: any[] = r?.pTeam ?? [];
  team.forEach((m, i) => {
    const a = after[i];
    if (a) m.currentHp = Math.max(0, Math.min(m.maxHp, a.currentHp));
  });
  if (!r?.playerWon) return false;
  const sent: Set<number> | null = r?.playerParticipants instanceof Set ? r.playerParticipants : null;
  team.forEach((m, i) => levelUp(m, 2, !!sent?.has(i)));
  return true;
}

declare const LEGENDARY_IDS: number[];
declare const MAP_LEVEL_RANGES: number[][];
declare const GEN2_MAP_LEVEL_RANGES: number[][];
declare const GEN3_MAP_LEVEL_RANGES: number[][];
declare const GEN4_MAP_LEVEL_RANGES: number[][];
declare const GEN5_MAP_LEVEL_RANGES: number[][];
declare const GEN6_MAP_LEVEL_RANGES: number[][];

const GEN_ID_RANGE: Record<number, [number, number]> = {
  1: [1, 151],
  2: [152, 251],
  3: [252, 386],
  4: [387, 493],
  5: [494, 649],
  6: [650, 721],
};

/** Legendary node like doLegendaryNode: a legendary of this generation not in the team, max map level, move tier 2. */
async function legendaryEnemy(node: any, team: any[]): Promise<any | null> {
  const s = state;
  const g = gen(s);
  const [lo, hi] = GEN_ID_RANGE[g]!;
  const have = new Set(team.map((m: any) => m.speciesId));
  const ids = (LEGENDARY_IDS ?? []).filter((id) => id >= lo && id <= hi && !have.has(id));
  if (!ids.length) return null;
  const id =
    node.legendarySpeciesId && ids.includes(node.legendarySpeciesId)
      ? node.legendarySpeciesId
      : ids[Math.floor(rng() * ids.length)];
  const sp = await fetchPokemonById(id);
  if (!sp) return null;
  const table =
    g === 6
      ? GEN6_MAP_LEVEL_RANGES
      : g === 5
        ? GEN5_MAP_LEVEL_RANGES
        : g === 4
          ? GEN4_MAP_LEVEL_RANGES
          : g === 3
            ? GEN3_MAP_LEVEL_RANGES
            : g === 2
              ? GEN2_MAP_LEVEL_RANGES
              : MAP_LEVEL_RANGES;
  const lvl = table?.[s.currentMap]?.[1] ?? 50;
  return createInstance(sp, lvl, false, 2);
}

/** Fights a chain in a row (no healing in between); true only if every fight is won. */
function fightChain(team: any[], teams: any[][], metas?: FightMeta[]): boolean {
  return fightChainCount(team, teams, metas) === teams.length;
}

/** Number of chain fights won before the first loss. */
function fightChainCount(team: any[], teams: any[][], metas?: FightMeta[]): number {
  let won = 0;
  for (let i = 0; i < teams.length; i++) {
    if (!fightInto(team, teams[i]!, metas?.[i] ?? { kind: 'boss' })) return won;
    won++;
  }
  return won;
}

async function sampleCatch(node: any): Promise<any | null> {
  const s = state;
  const lvl = s.currentMap === 0 ? Math.max(4, getLevelForNode(node)) : getLevelForNode(node);
  const range = getCatchGenRange();
  const pool = await getCatchChoices(getEncounterMapIndex(), 3, range.maxGenId, !s.isEndlessMode, range.minGenId);
  const gated = pool.filter((p: any) => minLevelForSpecies(p.id ?? p.speciesId) <= lvl);
  const opts = gated.length ? gated : pool;
  if (!opts.length) return null;
  // the bot takes the strongest of the offered options – approximate with the highest base-stat total
  const bst = (p: any) => Object.values(p.baseStats ?? {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
  const best = [...opts].sort((a, b) => bst(b) - bst(a))[0];
  return createInstance(best, lvl, false, moveTierForMap(s.currentMap));
}

/** Enemy of map `mapIdx` at `layer`, generated like getLevelForNode/doBattleNode/doTrainerNode for that map. */
async function enemyOnMap(mapIdx: number, layer: number, trainer: boolean): Promise<any[] | null> {
  const s = state;
  const g = gen(s);
  const table =
    g === 6
      ? GEN6_MAP_LEVEL_RANGES
      : g === 5
        ? GEN5_MAP_LEVEL_RANGES
        : g === 4
          ? GEN4_MAP_LEVEL_RANGES
          : g === 3
            ? GEN3_MAP_LEVEL_RANGES
            : g === 2
              ? GEN2_MAP_LEVEL_RANGES
              : MAP_LEVEL_RANGES;
  const range = table?.[mapIdx];
  if (!range) return null;
  const [lo, hi] = range as [number, number];
  const t = Math.min(1, Math.max(0, (layer - 1) / 6));
  const lvl0 = Math.min(
    hi,
    Math.max(lo, Math.round(lo + t * (hi - lo)) + Math.floor(rng() * Math.max(1, Math.round((hi - lo) / 8)))),
  );
  const tier = moveTierForMap(mapIdx);
  if (trainer) {
    const keys = Object.keys(TRAINER_BATTLE_CONFIG ?? {}).filter(
      (k) => !/rocket|boss|leader|elite|champion|rival/i.test(k),
    );
    const sprite = keys[Math.floor(rng() * keys.length)] ?? 'aceTrainer';
    const size = mapIdx === 0 ? 1 : mapIdx <= 2 ? 2 : 3;
    const species = await trainerTeamSpecies(sprite, TRAINER_BATTLE_CONFIG[sprite], lvl0, size);
    return species?.length ? species.map((x: any) => createInstance(x, lvl0, false, tier)) : null;
  }
  const off = g === 2 || g === 3 ? Math.min(4, Math.floor((mapIdx + 1) / 2)) : mapIdx >= 1 ? 1 : 0;
  const lvl = Math.max(1, lvl0 - off);
  const r = getCatchGenRange();
  let pool = await getCatchChoices(mapIdx, 3, r.maxGenId, true, r.minGenId);
  const gated = pool.filter((p: any) => minLevelForSpecies(p.id ?? p.speciesId) <= lvl);
  if (gated.length) pool = gated;
  const pick = pool[Math.floor(rng() * pool.length)];
  if (!pick) return null;
  const id = pick.id ?? pick.speciesId;
  const evo = resolveEvoForLevel(id, lvl);
  const sp = (evo !== id && (await fetchPokemonById(evo))) || pick;
  return [createInstance(sp, lvl, false, tier)];
}

/** A typical next map: wild, trainer, wild, "?"-fight, trainer, then a Pokécenter (most maps have one late). */
async function playNextMap(team: any[], mapIdx: number): Promise<boolean> {
  const plan: [number, boolean][] = [
    [1, false],
    [2, true],
    [3, false],
    [4, false],
    [5, true],
  ];
  for (const [layer, trainer] of plan) {
    const enemy = await enemyOnMap(mapIdx, layer, trainer).catch((e: unknown) => {
      noteError('simulator:enemy-on-map', e);
      return null;
    });
    if (enemy?.length && !fightInto(team, enemy, { kind: trainer ? 'trainer' : 'wild' })) return false;
  }
  team.forEach((m) => (m.currentHp = m.maxHp));
  return true;
}

export async function simulatePaths(req: PathSimRequest): Promise<PathSimResult> {
  const seed0 = getRngSeed();
  const sb = simBase(typeof state !== 'undefined' ? state : null);
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch (e) {
    noteError('simulator:uid-read', e);
    uid0 = null;
  }
  const out: PathSimResult = { results: [], targetLevel: null, restored: false };
  try {
    const s = state;
    if (!s?.map?.nodes) return out;
    const boss = await bossChain(0);
    const next = await bossChain(1);
    {
      const g = gen(s);
      const table =
        g === 6
          ? GEN6_MAP_LEVEL_RANGES
          : g === 5
            ? GEN5_MAP_LEVEL_RANGES
            : g === 4
              ? GEN4_MAP_LEVEL_RANGES
              : g === 3
                ? GEN3_MAP_LEVEL_RANGES
                : g === 2
                  ? GEN2_MAP_LEVEL_RANGES
                  : MAP_LEVEL_RANGES;
      const nextMax = table?.[s.currentMap + 1]?.[1];
      const lastBoss = boss?.teams[boss.teams.length - 1] ?? [];
      const bossMax = Math.max(0, ...lastBoss.map((m: any) => m.level || 0));
      out.targetLevel = Math.max(nextMax ?? 0, bossMax) || null;
    }
    const n = Math.max(2, Math.min(40, req.n ?? 12));
    const nextGain = req.nextGain ?? 6;
    for (let pi = 0; pi < req.paths.length; pi++) {
      const path = req.paths[pi]!;
      let ok = 0;
      let nextWins = 0;
      let lvlSum = 0;
      let aliveSum = 0;
      let progSum = 0;
      for (let k = 0; k < n; k++) {
        seedRng((sb ^ Math.imul(k + 1, 0x27d4eb2f) ^ Math.imul(pi + 1, 0x165667b1)) >>> 0);
        const base: any[] = s.team ?? [];
        const team: any[] = clone(req.order?.length ? req.order.map((i) => base[i]).filter(Boolean) : base);
        const startLen = team.length;
        let alive = true;
        for (const id of path) {
          const node = s.map.nodes[id];
          if (!node) continue;
          let kind: string = node.type;
          if (kind === 'question') {
            const r = rng();
            kind =
              r < 0.22 ? 'battle' : r < 0.42 ? 'trainer' : r < 0.52 ? (s.nuzlockeMode ? 'battle' : 'catch') : 'none';
          }
          if (kind === 'battle' || kind === 'trainer') {
            const enemy = kind === 'trainer' ? await trainerEnemies(node) : await wildEnemy(node);
            if (enemy?.length && !fightInto(team, enemy, { kind: kind === 'trainer' ? 'trainer' : 'wild' })) {
              alive = false;
              break;
            }
          } else if (kind === 'catch' && team.length < 6) {
            const mon = await sampleCatch(node);
            if (mon) team.push(mon);
          } else if (kind === 'legendary') {
            const leg = await legendaryEnemy(node, team).catch((e: unknown) => {
              noteError('simulator:legendary', e);
              return null;
            });
            if (leg) {
              if (!fightInto(team, [leg], { kind: 'wild' })) {
                alive = false;
                break;
              }
              // beaten legendaries join the team (full HP)
              const m = clone(leg);
              m.currentHp = m.maxHp;
              if (team.length < 6) team.push(m);
              else {
                let lo = 0;
                team.forEach((x: any, i: number) => (x.level < team[lo].level ? (lo = i) : 0));
                team[lo] = m;
              }
            }
          } else if (kind === 'pokecenter') {
            team.forEach((m) => (m.currentHp = m.maxHp));
          } else if (kind === 'boss') {
            if (!boss) break;
            const won = fightChainCount(team, boss.teams, boss.metas);
            progSum += won / boss.teams.length;
            if (won < boss.teams.length) {
              alive = false;
              break;
            }
          }
        }
        if (!alive) continue;
        ok++;
        // strength of the core: levels of the members the route starts with – a fresh catch must not drag the
        // average down (D-047, its value is the member itself, see teamBuildValue); top3 flag: only the best three
        const top = team
          .slice(0, Math.max(1, startLen))
          .map((m) => m.level)
          .sort((a, b) => b - a)
          .slice(0, FLAGS.top3 ? 3 : team.length);
        lvlSum += top.reduce((a, b) => a + b, 0) / Math.max(1, top.length);
        aliveSum += team.filter((m) => m.currentHp > 0).length;
        if (next) {
          if (FLAGS.nextMapRoute && s.currentMap < 8 && !s.isEndlessMode) {
            // two-map horizon: play a typical NEXT map from the real end state (HP, faints, levels) – wild and
            // trainer fights of the next map's level table, one Pokécenter, then the next boss
            const t2 = team.map((m) => ({ ...m }));
            // smooth signal: share of the next boss chain won (a full E4 clear is rare, partial progress still counts)
            if (await playNextMap(t2, s.currentMap + 1))
              nextWins += fightChainCount(t2, next.teams, next.metas) / next.teams.length;
          } else {
            // legacy: heal + `nextGain` levels, then the next boss
            const t2 = team.map((m) => ({ ...m, currentHp: m.maxHp }));
            t2.forEach((m) => levelUp(m, nextGain));
            nextWins += fightChainCount(t2, next.teams, next.metas) / next.teams.length;
          }
        }
      }
      out.results.push({
        path,
        success: ok / n,
        next: ok ? nextWins / ok : 0,
        avgLevel: ok ? lvlSum / ok : 0,
        avgAlive: ok ? aliveSum / ok : 0,
        // share of the boss chain won on average (incl. failed runs): separates routes when a full clear is unlikely
        progress: progSum / n,
      });
    }
    return out;
  } finally {
    seedRng(seed0);
    if (uid0 !== null) {
      try {
        _pokeUidCounter = uid0;
      } catch (e) {
        noteError('simulator:uid-restore', e); // ids only grow, harmless
      }
    }
    out.restored = getRngSeed() === seed0 && (uid0 === null || _pokeUidCounter === uid0);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Relic evaluation: try each offered relic (or each replacement) in simulated boss fights.
// ---------------------------------------------------------------------------------------------------------------
declare const PASSIVE_ITEM_POOL: any[];

export interface RelicSimRequest {
  /** icon paths of the offered relic cards (img src), as shown in the dialog */
  icons: string[];
  /** replace dialog: also try dropping each owned relic */
  replace?: boolean;
  n?: number;
}

export interface RelicSimResult {
  baseline: number;
  /** per offered card: id found in PASSIVE_ITEM_POOL and simulated value (current + 0.6·next + 0.25·league) */
  offers: { id: string | null; value: number; combat: boolean; league?: number | null }[];
  /** league share with the owned relics (D-044), null outside the arena challenge */
  league?: number | null;
  leagueName?: string | null;
  /** replace mode: value when dropping owned relic i for the (single) new one */
  replace: number[];
  restored: boolean;
}

function relicByIcon(icon: string): any | null {
  const base = icon.split('/').pop() ?? '';
  const cands = (typeof PASSIVE_ITEM_POOL !== 'undefined' ? PASSIVE_ITEM_POOL : []).filter((r: any) =>
    (r.iconUrl ?? '').endsWith('/' + base),
  );
  return cands.find((r: any) => !r.retired) ?? cands[0] ?? null;
}

export async function simulateRelics(req: RelicSimRequest): Promise<RelicSimResult> {
  const seed0 = getRngSeed();
  const sb = simBase(typeof state !== 'undefined' ? state : null);
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch (e) {
    noteError('simulator:uid-read', e);
    uid0 = null;
  }
  const out: RelicSimResult = { baseline: 0, offers: [], replace: [], restored: false };
  try {
    const cur = await bossChain(0);
    const next = await bossChain(1);
    if (!cur) return out;
    const n = Math.max(6, Math.min(60, req.n ?? 24));
    const team: any[] = state.team ?? [];
    const own: any[] = state.passives ?? [];
    // D-044: the league is the real test of a relic – judged with the team projected to its arrival level
    const league = await arenaLeague();
    const atLeague = league ? towardLeague(team) : null;
    const nl = Math.max(6, Math.round(n / 2));
    let lastLeague: number | null = null;
    const value = (passives: any[]): number => {
      passivesOverride = passives;
      try {
        const c = chainRate(sb, projectTeam(team, 2, false), cur.teams, n, 31, cur.metas);
        const x = next ? chainRate(sb, projectTeam(team, 8, true), next.teams, n, 131, next.metas) : 0;
        lastLeague = league && atLeague ? leagueProgress(sb, atLeague, league, nl, 231) : null;
        return c + 0.6 * x + LEAGUE_WEIGHT * (lastLeague ?? 0);
      } finally {
        passivesOverride = null;
      }
    };
    out.baseline = value(own);
    out.league = lastLeague;
    out.leagueName = league?.name ?? null;
    for (const icon of req.icons) {
      const r = relicByIcon(icon);
      if (!r) {
        out.offers.push({ id: null, value: out.baseline, combat: false, league: out.league });
        continue;
      }
      const v = value([...own, clone(r)]);
      out.offers.push({ id: r.id, value: v, combat: Math.abs(v - out.baseline) > 1e-9, league: lastLeague });
    }
    if (req.replace && req.icons.length) {
      const r = relicByIcon(req.icons[req.icons.length - 1]!);
      if (r)
        for (let i = 0; i < own.length; i++)
          out.replace.push(value([...own.slice(0, i), ...own.slice(i + 1), clone(r)]));
    }
    return out;
  } finally {
    passivesOverride = null;
    seedRng(seed0);
    if (uid0 !== null) {
      try {
        _pokeUidCounter = uid0;
      } catch (e) {
        noteError('simulator:uid-restore', e); // ids only grow, harmless
      }
    }
    out.restored = getRngSeed() === seed0 && (uid0 === null || _pokeUidCounter === uid0);
  }
}
