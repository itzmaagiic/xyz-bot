/** Shared, platform-independent types. */
import type { PauseKind } from './pause-reason';

export type PokeType =
  | 'Normal'
  | 'Fire'
  | 'Water'
  | 'Electric'
  | 'Grass'
  | 'Ice'
  | 'Fighting'
  | 'Poison'
  | 'Ground'
  | 'Flying'
  | 'Psychic'
  | 'Bug'
  | 'Rock'
  | 'Ghost'
  | 'Dragon'
  | 'Dark'
  | 'Steel'
  | 'Fairy';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  speed: number;
  /** special attack */
  special: number;
  spdef: number;
}

export interface Move {
  name: string;
  power: number;
  type: string;
  isSpecial: boolean;
}

export interface Mon {
  uid?: number;
  speciesId: number;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  isShiny: boolean;
  types: string[];
  baseStats: BaseStats;
  heldItem: string | null;
  moveTier: number;
  /** best move as computed by the game itself (bridge) – optional in DOM fallback */
  move?: Move | null;
  isStarter?: boolean;
  /** true when baseStats hold the displayed (level-adjusted) stats from a DOM card, not base stats */
  actualStats?: boolean;
}

export type NodeType =
  | 'start'
  | 'catch'
  | 'battle'
  | 'trainer'
  | 'question'
  | 'item'
  | 'trade'
  | 'pokecenter'
  | 'move_tutor'
  | 'boss'
  | 'legendary'
  | 'shiny'
  | 'poke_mart'
  | string;

export interface MapNode {
  id: string;
  type: NodeType;
  layer: number;
  col: number;
  visited: boolean;
  accessible: boolean;
}

export interface GameMap {
  nodes: Record<string, MapNode>;
  edges: { from: string; to: string }[];
  mapIndex: number;
}

export type RunMode = 'story' | 'tower' | 'challenge' | 'none';

export interface RunState {
  team: Mon[];
  items: string[];
  /** bag contents in order (index = bag index) */
  bag: { id: string; usable: boolean }[];
  badges: number;
  maxTeamSize: number;
  currentMap: number;
  eliteIndex: number;
  nuzlocke: boolean;
  mode: RunMode;
  /** 1 = Kanto … 6 = Kalos */
  gen: number;
  map: GameMap | null;
  currentNodeId: string | null;
  catchOffer: Mon[] | null;
  /** challenge relics (state.passives), ids – empty outside challenges (D-040) */
  relics?: string[];
  /** which challenge and badge level is played (state.challengeId / challengeBadge); null outside challenges */
  challenge?: { id: string | null; badge: number | null } | null;
}

/** Raw JSON delivered by the page bridge (main world). */
export interface BridgeSnapshot {
  ok: true;
  version: string | null;
  screenId: string | null;
  run: RunState | null;
  settings: Record<string, unknown> | null;
  typeChart: Record<string, Record<string, number>> | null;
  /** how many distinct errors the page world has noted (R-253): the reader fetches new ones with 'errors' */
  errSeq?: number;
}

export type ScreenKind =
  | 'title'
  | 'region-select'
  | 'tower-select'
  | 'trainer'
  | 'starter'
  | 'map'
  | 'battle'
  | 'catch'
  | 'item'
  | 'passive'
  | 'swap'
  | 'trade'
  | 'shiny'
  | 'badge'
  | 'transition'
  | 'elite-prep'
  | 'gameover'
  | 'win'
  | 'stat-buff'
  | 'stage-complete'
  | 'challenge-select'
  | 'challenge-level'
  | 'unknown';

export type OverlayKind =
  'tutorial' | 'move-tutor' | 'item-equip' | 'usable-item' | 'evolution' | 'misclick-confirm' | 'unknown-modal' | null;

export interface ScreenInfo {
  kind: ScreenKind;
  /** raw id of the active .screen element */
  screenId: string | null;
  overlay: OverlayKind;
  /** raw id/class of the blocking overlay, if any */
  overlayId: string | null;
  /** stable signature used to verify that an action had an effect */
  signature: string;
}

export interface GameState {
  screen: ScreenInfo;
  run: RunState | null;
  version: string | null;
  settings: Record<string, unknown> | null;
  /** true when the page bridge answered; false = DOM-only fallback */
  bridge: boolean;
  /** simulation results from the game's own battle engine (map screen) */
  sim?: import('./strategy/sim-route').SimData | null;
  /** evaluated battle orders for the upcoming boss (elite-prep screen) */
  orderSim?: { order: number[]; winRate: number; avgAlive: number }[] | null;
  /** simulated relic offers (challenge relic screen) */
  relicSim?: {
    baseline: number;
    offers: { id: string | null; value: number; combat: boolean }[];
    replace: number[];
  } | null;
  /** species stats for the PC starter grid (challenge starter screen) */
  pcStats?: Record<number, { bst: number; types: string[] }> | null;
  /** simulated value of each catch option (index -1 = skip) */
  catchSim?: { index: number; current: number; next: number; value: number }[] | null;
}

/** One alternative the strategy weighed (run logs, D-005/R-006). */
export interface DecisionOption {
  id: string;
  label: string;
  score: number | null;
  factors?: Record<string, number>;
}

/** All options of a decision with their scores, the chosen option id and a confidence (e.g. simulated odds). */
export interface DecisionTrace {
  options: DecisionOption[];
  chosen: string | null;
  confidence: number | null;
}

/** What the bot decided to do. */
export type Decision =
  | { kind: 'click'; selector: string; index?: number; why: string; trace?: DecisionTrace }
  | { kind: 'swapTeam'; from: number; to: number; where: 'map' | 'elite-prep'; why: string; trace?: DecisionTrace }
  /** sequence of "swap lead with slot k" presses (Shift+k) realising a full battle order */
  | { kind: 'reorder'; swaps: number[]; target: number[]; why: string; trace?: DecisionTrace }
  /** open a bag item (use/equip dialog) – the game only opens it via a pointer-capture gesture */
  | { kind: 'openBag'; index: number; itemId: string; why: string; trace?: DecisionTrace }
  | { kind: 'wait'; ms: number; why: string }
  | { kind: 'pause'; why: string; cause: PauseKind; trace?: DecisionTrace }
  | { kind: 'stop'; why: string; result?: 'win' | 'loss'; trace?: DecisionTrace };
