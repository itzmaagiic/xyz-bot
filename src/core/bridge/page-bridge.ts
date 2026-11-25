/**
 * Runs in the PAGE's main world (Chrome: content script with world "MAIN"; userscript: injected <script>).
 * Reads the game's lexical globals (`state`, `TYPE_CHART`, `PATCH_NOTES`, …) and answers requests from the
 * isolated world with plain JSON strings. It never mutates game state; the only write is `saveSettings`
 * restricted to WRITABLE_SETTINGS.
 */
import {
  simulateBoss,
  simulateCatch,
  simulateNodes,
  simulatePaths,
  simulateRelics,
  type CatchSimRequest,
  type NodeSimRequest,
  type PathSimRequest,
  type RelicSimRequest,
  type SimRequest,
} from './simulator';
import type { BridgeSnapshot, Mon, RunState, GameMap, MapNode } from '../types';
import {
  BRIDGE_VERSION,
  READY_ATTR,
  REQ_EVENT,
  RES_EVENT,
  WRITABLE_SETTINGS,
  type BridgeRequest,
  type BridgeResponse,
} from './protocol';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const state: any;
declare const TYPE_CHART: any;
declare const PATCH_NOTES: any;
declare function getSettings(): any;
declare function saveSettings(s: any): void;
declare function getBestMove(types: string[], baseStats: any, tier: number): any;
declare function applyDarkMode(...a: any[]): void;

function g<T>(read: () => T): T | null {
  try {
    const v = read();
    return v === undefined ? null : v;
  } catch {
    return null;
  }
}

function num(v: unknown, d = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

const TEAM_CAP = 6;

export function serializeMon(m: any): Mon | null {
  if (!m || typeof m !== 'object') return null;
  const bs = m.baseStats ?? {};
  const types: string[] = Array.isArray(m.types) ? m.types.map(String) : [];
  const moveTier = num(m.moveTier);
  const move = g(() => {
    const mv = typeof getBestMove === 'function' ? getBestMove(types, bs, moveTier) : null;
    return mv
      ? { name: String(mv.name), power: num(mv.power), type: String(mv.type), isSpecial: !!mv.isSpecial }
      : null;
  });
  return {
    uid: num(m._uid, undefined as unknown as number),
    speciesId: num(m.speciesId ?? m.id),
    name: String(m.name ?? ''),
    level: num(m.level, 1),
    currentHp: num(m.currentHp),
    maxHp: num(m.maxHp, 1),
    isShiny: !!m.isShiny,
    types,
    baseStats: {
      hp: num(bs.hp),
      atk: num(bs.atk),
      def: num(bs.def),
      speed: num(bs.speed),
      special: num(bs.special),
      spdef: num(bs.spdef),
    },
    heldItem:
      m.heldItem == null
        ? null
        : typeof m.heldItem === 'string'
          ? m.heldItem
          : String(m.heldItem.id ?? m.heldItem.name ?? 'item'),
    moveTier,
    move,
    isStarter: !!m._isStarter,
  };
}

function serializeMap(map: any): GameMap | null {
  if (!map || typeof map !== 'object' || !map.nodes) return null;
  const nodes: Record<string, MapNode> = {};
  for (const [id, n] of Object.entries<any>(map.nodes)) {
    nodes[id] = {
      id,
      type: String(n.type),
      layer: num(n.layer),
      col: num(n.col),
      visited: !!n.visited,
      accessible: !!n.accessible,
    };
  }
  const edges = Array.isArray(map.edges) ? map.edges.map((e: any) => ({ from: String(e.from), to: String(e.to) })) : [];
  return { nodes, edges, mapIndex: num(map.mapIndex) };
}

function itemId(it: any): string {
  if (typeof it === 'string') return it;
  return String(it?.id ?? it?.key ?? it?.name ?? 'unknown');
}

export function readRun(s: any): RunState | null {
  if (!s || typeof s !== 'object') return null;
  const team = Array.isArray(s.team) ? (s.team.map(serializeMon).filter(Boolean) as Mon[]) : [];
  const gen = s.gen6Mode ? 6 : s.gen5Mode ? 5 : s.gen4Mode ? 4 : s.gen3Mode ? 3 : s.gen2Mode ? 2 : 1;
  const challenge = Object.keys(s).some((k) => k.startsWith('challenge') && s[k] && k !== 'challengeGenRange');
  const mode = s.challengeId || challenge ? 'challenge' : s.isEndlessMode ? 'tower' : team.length ? 'story' : 'none';
  const cur = s.currentNode;
  const sc = s.savedCatch;
  return {
    team,
    items: Array.isArray(s.items) ? s.items.map(itemId) : [],
    bag: Array.isArray(s.items) ? s.items.map((it: any) => ({ id: itemId(it), usable: !!it?.usable })) : [],
    badges: num(s.badges),
    // NOTE: state.maxTeamSize is the largest team size reached so far (starts at 1), NOT the cap.
    // The cap is 6: catching with 6 members opens the swap ("Team full") screen.
    maxTeamSize: TEAM_CAP,
    currentMap: num(s.currentMap),
    eliteIndex: num(s.eliteIndex),
    nuzlocke: !!s.nuzlockeMode,
    mode,
    gen,
    map: serializeMap(s.map),
    currentNodeId:
      cur && typeof cur === 'object' ? String(cur.id) : typeof s.currentNodeId === 'string' ? s.currentNodeId : null,
    catchOffer: sc && Array.isArray(sc.instances) ? (sc.instances.map(serializeMon).filter(Boolean) as Mon[]) : null,
  };
}

export function snapshot(includeTypeChart: boolean): BridgeSnapshot {
  const version =
    g(() => (Array.isArray(PATCH_NOTES) && PATCH_NOTES[0] ? String(PATCH_NOTES[0].version) : null)) ??
    g(() => document.querySelector('.title-version')?.textContent?.replace(/^v/i, '').trim() ?? null);
  return {
    ok: true,
    version,
    screenId: g(() => (window as any)._currentScreenId ?? null),
    run: g(() => readRun(typeof state !== 'undefined' ? state : null)),
    settings: g(() => (typeof getSettings === 'function' ? { ...getSettings() } : null)),
    typeChart: includeTypeChart
      ? g(() => (typeof TYPE_CHART !== 'undefined' ? JSON.parse(JSON.stringify(TYPE_CHART)) : null))
      : null,
  };
}

function doSaveSettings(patch: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set<string>(WRITABLE_SETTINGS);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (allowed.has(k) && typeof v === 'boolean') clean[k] = v;
  if (!Object.keys(clean).length) throw new Error('no writable settings in patch');
  const before = getSettings();
  saveSettings({ ...before, ...clean });
  if ('darkMode' in clean && typeof applyDarkMode === 'function') g(() => applyDarkMode());
  return { ...getSettings() };
}

declare function openUsableItemModal(item: any, idx: number, cb?: any): void;
declare function openItemEquipModal(item: any, opts: any): void;

/**
 * Opens a bag item exactly like a tap on its badge would. The badge only reacts to a pointer gesture that calls
 * setPointerCapture, which synthetic events cannot satisfy – so this is the one UI opener the bot calls directly.
 * It does not change any game data by itself; the choice is then clicked in the dialog like a human would.
 */
declare const __POKEDEX__: Record<string, any>;

/** Base stat totals and types from the game's own Pokédex table (for the PC starter choice). */
function speciesStats(ids: number[]): Record<number, { bst: number; types: string[] }> {
  const out: Record<number, { bst: number; types: string[] }> = {};
  for (const id of ids.slice(0, 1000)) {
    const e = (typeof __POKEDEX__ !== 'undefined' && __POKEDEX__?.[id]) || null;
    if (!e?.baseStats) continue;
    const b = e.baseStats;
    out[id] = {
      bst: num(b.hp) + num(b.atk) + num(b.def) + num(b.speed) + num(b.special) + num(b.spdef),
      types: (e.types ?? []).map(String),
    };
  }
  return out;
}

function openBagItem(index: number, expectId: string): boolean {
  const it = state?.items?.[index];
  if (!it || (expectId && itemId(it) !== expectId)) throw new Error('bag item changed');
  if (it.usable) openUsableItemModal(it, index);
  else openItemEquipModal(it, { fromBagIdx: index });
  return true;
}

export async function handle(req: BridgeRequest): Promise<BridgeResponse> {
  try {
    switch (req.cmd) {
      case 'simulateRelics':
        return { id: req.id, ok: true, result: await simulateRelics((req.args ?? {}) as unknown as RelicSimRequest) };
      case 'simulatePaths':
        return { id: req.id, ok: true, result: await simulatePaths((req.args ?? {}) as unknown as PathSimRequest) };
      case 'simulateCatch':
        return { id: req.id, ok: true, result: await simulateCatch((req.args ?? {}) as CatchSimRequest) };
      case 'simulateNodes':
        return { id: req.id, ok: true, result: await simulateNodes((req.args ?? {}) as unknown as NodeSimRequest) };
      case 'simulateBoss':
        return { id: req.id, ok: true, result: await simulateBoss((req.args ?? {}) as SimRequest) };
      case 'ping':
        return { id: req.id, ok: true, result: BRIDGE_VERSION };
      case 'snapshot':
        return { id: req.id, ok: true, result: snapshot(!!req.args?.typeChart) };
      case 'speciesStats':
        return { id: req.id, ok: true, result: speciesStats((req.args?.ids as number[]) ?? []) };
      case 'openBagItem':
        return { id: req.id, ok: true, result: openBagItem(Number(req.args?.index), String(req.args?.itemId ?? '')) };
      case 'saveSettings':
        return { id: req.id, ok: true, result: doSaveSettings((req.args?.patch as Record<string, unknown>) ?? {}) };
      default:
        return { id: req.id, ok: false, error: 'unknown command' };
    }
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function installBridge(): void {
  const root = document.documentElement;
  if (root.getAttribute(READY_ATTR)) return;
  document.addEventListener(REQ_EVENT, (ev) => {
    const detail = (ev as CustomEvent).detail;
    if (typeof detail !== 'string') return;
    let req: BridgeRequest;
    try {
      req = JSON.parse(detail);
    } catch {
      return;
    }
    void handle(req).then((res) => document.dispatchEvent(new CustomEvent(RES_EVENT, { detail: JSON.stringify(res) })));
  });
  root.setAttribute(READY_ATTR, BRIDGE_VERSION);
}
