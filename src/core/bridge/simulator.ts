/**
 * Battle simulator – runs in the page's MAIN world and uses the game's own battle engine (`runBattle`).
 *
 * Side-effect free by construction:
 *  - every input team is deep-cloned before it reaches the engine
 *  - the global RNG seed (getRngSeed/seedRng) and the instance-id counter (_pokeUidCounter) are saved before and
 *    restored after every simulation, so the real run continues exactly as if nothing had happened
 *  - runBattle itself only reads `state` (verified in docs/GAME_RECON.md §8)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
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
  scenarios: { boost: number; order: number[]; heal: boolean; winRate: number; avgAlive: number }[];
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
  if (!s || s.isEndlessMode || s.inSubMap || s.rankedMode) return null;
  const g = gen(s);
  const mult = s.challengeLevelMult || 1;
  let mapIdx = s.currentMap + ahead;
  let eliteIdx = s.eliteIndex;
  if (s.currentMap >= 8) {
    eliteIdx = s.eliteIndex + ahead;
    mapIdx = 8;
  } else if (mapIdx >= 8) {
    eliteIdx = 0;
  }
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

function battleConfig(): any {
  const s = state;
  if (s.isEndlessMode || gen(s) < 3 || typeof buildGen3AbilityConfig !== 'function') return null;
  let cfg = buildGen3AbilityConfig();
  if (typeof buildTraitsConfig === 'function')
    cfg = mergeBattleConfigs(cfg, buildTraitsConfig({}, {}, s.passives || []));
  return cfg;
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
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch {
    uid0 = null;
  }
  const out: SimResult = { boss: null, scenarios: [], restored: false };
  try {
    const raw = await bossTeamRaw(req.ahead ?? 0);
    if (!raw) return out;
    out.boss = {
      name: String(raw.name),
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
    const cfg = battleConfig();
    const items = state.items || [];
    const passives = state.passives || [];
    for (const boost of boosts) {
      const projected = projectTeam(team, boost, !!req.heal);
      for (const order of orders) {
        const ordered = order.map((i) => projected[i]).filter(Boolean);
        let wins = 0;
        let alive = 0;
        for (let k = 0; k < n; k++) {
          seedRng((seed0 ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0);
          const p = clone(ordered);
          if (typeof applyMegaEvolution === 'function') p.forEach((m: any) => applyMegaEvolution(m));
          const r = runBattle(p, clone(raw.team), clone(items), [], null, cfg, clone(passives));
          if (r?.playerWon) wins++;
          alive += (r?.pTeam ?? []).filter((m: any) => m.currentHp > 0).length;
        }
        out.scenarios.push({ boost, order, heal: !!req.heal, winRate: wins / n, avgAlive: alive / n });
      }
    }
    return out;
  } finally {
    seedRng(seed0);
    if (uid0 !== null) {
      try {
        _pokeUidCounter = uid0;
      } catch {
        /* binding not writable – ids only grow, harmless */
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
  } catch {
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
  const size = s.currentMap === 0 ? 1 : s.currentMap <= 2 ? 2 : 3;
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
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch {
    uid0 = null;
  }
  const out: NodeSimResult = { rates: {}, restored: false };
  try {
    const s = state;
    if (!s?.map?.nodes || s.isEndlessMode) return out;
    const boosts = req.boosts?.length ? req.boosts : [0];
    const n = Math.max(1, Math.min(60, req.n ?? 12));
    const cfg = battleConfig();
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
          seedRng((seed0 ^ Math.imul(k + 7, 0x85ebca6b) ^ (boost * 0x27d4eb2d)) >>> 0);
          // a "?" is 22 % wild / 20 % trainer / otherwise no fight – sample only the fights here
          const asTrainer = kind === 'trainer' || (kind === 'question' && k % 2 === 1);
          const enemy = asTrainer ? await trainerEnemies(node) : await wildEnemy(node);
          if (!enemy?.length) continue;
          const p = clone(team);
          if (typeof applyMegaEvolution === 'function') p.forEach((m: any) => applyMegaEvolution(m));
          const r = runBattle(p, clone(enemy), clone(items), [], null, cfg, clone(passives));
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
      } catch {
        /* ignore */
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
  /** index -1 = skip; value = win(current boss) + 0.6·win(next boss) */
  options: { index: number; current: number; next: number; value: number }[];
  restored: boolean;
}

async function winRateVs(team: any[], enemy: any[], n: number, salt: number): Promise<number> {
  const cfg = battleConfig();
  const items = state.items || [];
  const passives = state.passives || [];
  const base = getRngSeed();
  let wins = 0;
  for (let k = 0; k < n; k++) {
    seedRng((base ^ Math.imul(k + salt, 0xc2b2ae35)) >>> 0);
    const p = clone(team);
    if (typeof applyMegaEvolution === 'function') p.forEach((m: any) => applyMegaEvolution(m));
    const r = runBattle(p, clone(enemy), clone(items), [], null, cfg, clone(passives));
    if (r?.playerWon) wins++;
  }
  return wins / n;
}

export async function simulateCatch(req: CatchSimRequest): Promise<CatchSimResult> {
  const seed0 = getRngSeed();
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch {
    uid0 = null;
  }
  const out: CatchSimResult = { options: [], restored: false };
  try {
    const offer: any[] = state.savedCatch?.instances ?? [];
    const cur = await bossTeamRaw(0);
    const next = await bossTeamRaw(1);
    if (!offer.length || !cur) return out;
    const boost = req.boost ?? 4;
    const n = Math.max(4, Math.min(60, req.n ?? 20));
    const team: any[] = state.team ?? [];
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
      const curRate = await winRateVs(projectTeam(t, boost, false), cur.team, n, 11 + c);
      const nextRate = next ? await winRateVs(projectTeam(t, boost + 8, true), next.team, n, 101 + c) : 0;
      t = [];
      out.options.push({ index: c, current: curRate, next: nextRate, value: curRate + 0.6 * nextRate });
    }
    return out;
  } finally {
    seedRng(seed0);
    if (uid0 !== null) {
      try {
        _pokeUidCounter = uid0;
      } catch {
        /* ignore */
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
  n?: number;
  /** levels the team is assumed to gain on the next map before the next boss */
  nextGain?: number;
}

export interface PathSimResult {
  results: { path: string[]; success: number; next: number; avgLevel: number; avgAlive: number }[];
  restored: boolean;
}

function levelUp(m: any, by: number): void {
  if (m.currentHp <= 0 || by <= 0) return;
  const oldMax = m.maxHp;
  m.level = Math.min(100, m.level + by);
  const hpBuff = m.statBuffs?.hp ?? 0;
  const newMax = Math.floor(calcHp(m.baseStats.hp, m.level) * (1 + 0.05 * hpBuff + mutPct(m)) * augMult(m));
  m.maxHp = newMax;
  m.currentHp = Math.min(newMax, m.currentHp + (newMax - oldMax));
}

/** One fight; copies HP back onto the persistent team. Returns true on a win. */
function fightInto(team: any[], enemy: any[]): boolean {
  const p = clone(team);
  if (typeof applyMegaEvolution === 'function') p.forEach((m: any) => applyMegaEvolution(m));
  const r = runBattle(p, clone(enemy), clone(state.items || []), [], null, battleConfig(), clone(state.passives || []));
  const after: any[] = r?.pTeam ?? [];
  team.forEach((m, i) => {
    const a = after[i];
    if (a) m.currentHp = Math.max(0, Math.min(m.maxHp, a.currentHp));
  });
  if (!r?.playerWon) return false;
  team.forEach((m) => levelUp(m, 2));
  return true;
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

export async function simulatePaths(req: PathSimRequest): Promise<PathSimResult> {
  const seed0 = getRngSeed();
  let uid0: number | null = null;
  try {
    uid0 = _pokeUidCounter;
  } catch {
    uid0 = null;
  }
  const out: PathSimResult = { results: [], restored: false };
  try {
    const s = state;
    if (!s?.map?.nodes || s.isEndlessMode) return out;
    const boss = await bossTeamRaw(0);
    const next = await bossTeamRaw(1);
    const n = Math.max(2, Math.min(40, req.n ?? 12));
    const nextGain = req.nextGain ?? 6;
    for (let pi = 0; pi < req.paths.length; pi++) {
      const path = req.paths[pi]!;
      let ok = 0;
      let nextWins = 0;
      let lvlSum = 0;
      let aliveSum = 0;
      for (let k = 0; k < n; k++) {
        seedRng((seed0 ^ Math.imul(k + 1, 0x27d4eb2f) ^ Math.imul(pi + 1, 0x165667b1)) >>> 0);
        const team: any[] = clone(s.team ?? []);
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
            if (enemy?.length && !fightInto(team, enemy)) {
              alive = false;
              break;
            }
          } else if (kind === 'catch' && team.length < 6) {
            const mon = await sampleCatch(node);
            if (mon) team.push(mon);
          } else if (kind === 'pokecenter') {
            team.forEach((m) => (m.currentHp = m.maxHp));
          } else if (kind === 'boss') {
            if (!boss || !fightInto(team, boss.team)) {
              alive = !boss;
              break;
            }
          }
        }
        if (!alive) continue;
        ok++;
        lvlSum += team.reduce((a, m) => a + m.level, 0) / Math.max(1, team.length);
        aliveSum += team.filter((m) => m.currentHp > 0).length;
        if (next) {
          // next map: assume a heal at some point and `nextGain` levels for everyone still standing
          const t2 = team.map((m) => ({ ...m, currentHp: m.maxHp }));
          t2.forEach((m) => levelUp(m, nextGain));
          if (fightInto(t2, next.team)) nextWins++;
        }
      }
      out.results.push({
        path,
        success: ok / n,
        next: ok ? nextWins / ok : 0,
        avgLevel: ok ? lvlSum / ok : 0,
        avgAlive: ok ? aliveSum / ok : 0,
      });
    }
    return out;
  } finally {
    seedRng(seed0);
    if (uid0 !== null) {
      try {
        _pokeUidCounter = uid0;
      } catch {
        /* ignore */
      }
    }
    out.restored = getRngSeed() === seed0 && (uid0 === null || _pokeUidCounter === uid0);
  }
}
