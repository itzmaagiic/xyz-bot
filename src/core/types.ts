/** Shared, platform-independent types. */

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
}

/** Raw JSON delivered by the page bridge (main world). */
export interface BridgeSnapshot {
  ok: true;
  version: string | null;
  screenId: string | null;
  run: RunState | null;
  settings: Record<string, unknown> | null;
  typeChart: Record<string, Record<string, number>> | null;
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
  | 'unknown';

export type OverlayKind =
  'tutorial' | 'move-tutor' | 'item-equip' | 'evolution' | 'misclick-confirm' | 'unknown-modal' | null;

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
}

/** What the bot decided to do. */
export type Decision =
  | { kind: 'click'; selector: string; index?: number; why: string }
  | { kind: 'swapTeam'; from: number; to: number; where: 'map' | 'elite-prep'; why: string }
  | { kind: 'wait'; ms: number; why: string }
  | { kind: 'pause'; why: string }
  | { kind: 'stop'; why: string; result?: 'win' | 'loss' };
