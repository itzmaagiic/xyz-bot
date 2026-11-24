/** Route planning on the node map: enumerate all paths from the accessible nodes and pick the best first step. */
import type { GameMap, NodeType } from '../types';

export interface RouteContext {
  teamSize: number;
  maxTeamSize: number;
  /** average current-HP ratio of the team 0..1 */
  hp: number;
  nuzlocke: boolean;
  /** relative team weakness 0 (strong) .. 1 (weak) – raises the value of catching / XP */
  weakness: number;
}

/** Expected HP loss of a fight node (fraction of the team bar). */
const FIGHT_COST: Partial<Record<NodeType, number>> = { battle: 0.08, trainer: 0.14, legendary: 0.2, boss: 0 };

export function nodeValue(type: NodeType, ctx: RouteContext, projectedHp: number, projectedTeam = ctx.teamSize): number {
  const lowHp = projectedHp < 0.45;
  const roomInTeam = projectedTeam < ctx.maxTeamSize;
  switch (type) {
    case 'catch':
      // a bigger team is the strongest lever early on: value falls as the team fills up
      return roomInTeam ? 8 + 14 * (1 - projectedTeam / Math.max(1, ctx.maxTeamSize)) : 2.5 + 2 * ctx.weakness;
    case 'shiny':
      return 7;
    case 'legendary':
      return lowHp ? 2 : 8;
    case 'item':
      return 5;
    case 'move_tutor':
      return 4.5;
    case 'question':
      return 3.5;
    case 'pokecenter':
      return projectedHp < 0.6 ? 9 : projectedHp < 0.85 ? 3 : 0.5;
    case 'battle':
      return lowHp ? (ctx.nuzlocke ? -3 : 1) : 3;
    case 'trainer':
      return lowHp ? (ctx.nuzlocke ? -6 : 0) : ctx.nuzlocke ? 3 : 4;
    case 'trade':
      return 1.5;
    case 'poke_mart':
      return 2.5;
    case 'boss':
    case 'start':
      return 0;
    default:
      return 2;
  }
}

export interface RouteChoice {
  nodeId: string;
  value: number;
  path: string[];
}

/** Returns the best accessible node (or null). Pure; deterministic tie-break by node id. */
export function chooseRoute(map: GameMap, accessible: readonly string[], ctx: RouteContext, maxPaths = 5000): RouteChoice | null {
  const children = new Map<string, string[]>();
  for (const e of map.edges) {
    const arr = children.get(e.from) ?? [];
    arr.push(e.to);
    children.set(e.from, arr);
  }
  let budget = maxPaths;
  let best: RouteChoice | null = null;

  const walk = (id: string, hp: number, size: number, value: number, path: string[], first: string) => {
    if (budget <= 0) return;
    const node = map.nodes[id];
    if (!node) return;
    const v = value + nodeValue(node.type, ctx, hp, size);
    const nextSize = node.type === 'catch' || node.type === 'shiny' ? Math.min(ctx.maxTeamSize, size + 1) : size;
    let nextHp = hp - (FIGHT_COST[node.type] ?? 0);
    if (node.type === 'pokecenter') nextHp = 1;
    nextHp = Math.max(0, Math.min(1, nextHp));
    const kids = children.get(id) ?? [];
    const p = [...path, id];
    if (!kids.length) {
      budget--;
      if (!best || v > best.value + 1e-9 || (Math.abs(v - best.value) < 1e-9 && first < best.nodeId)) {
        best = { nodeId: first, value: v, path: p };
      }
      return;
    }
    for (const k of kids) walk(k, nextHp, nextSize, v, p, first);
  };

  for (const id of [...accessible].sort()) walk(id, ctx.hp, ctx.teamSize, 0, [], id);
  return best;
}
