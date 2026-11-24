/** Pure evaluation helpers. All numbers are heuristics; documented in docs/STRATEGY.md. */
import { effectiveness } from '../data/typechart';
import type { Mon, Move } from '../types';

/** Gen-3+ stat formula with neutral nature, 31 IV, 0 EV. */
export function statAt(base: number, level: number, isHp = false): number {
  const core = Math.floor(((2 * base + 31) * level) / 100);
  return isHp ? core + level + 10 : core + 5;
}

export interface EffStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export function effStats(m: Mon): EffStats {
  const b = m.baseStats;
  return {
    hp: statAt(b.hp, m.level, true),
    atk: statAt(b.atk, m.level),
    def: statAt(b.def, m.level),
    spa: statAt(b.special, m.level),
    spd: statAt(b.spdef, m.level),
    spe: statAt(b.speed, m.level),
  };
}

/** Fallback move when the bridge could not compute the game's own best move. */
export function guessMove(m: Mon): Move {
  const b = m.baseStats;
  const special = b.special >= b.atk;
  return { name: '?', power: 40 + 20 * Math.min(3, m.moveTier), type: m.types[0] ?? 'Normal', isSpecial: special };
}

export function moveOf(m: Mon): Move {
  return m.move && m.move.power > 0 ? m.move : guessMove(m);
}

/** Expected damage output per turn, relative units. `vs` = defending types (empty = neutral). */
export function offense(m: Mon, vs: readonly string[] = []): number {
  const s = effStats(m);
  const mv = moveOf(m);
  const stat = mv.isSpecial ? s.spa : s.atk;
  const stab = m.types.includes(mv.type) ? 1.5 : 1;
  // type multipliers are damped (sqrt): in an autobattler levels/stats matter at least as much as matchups
  const eff = vs.length ? Math.sqrt(Math.max(0.0625, effectiveness(mv.type, vs))) : 1;
  return (stat * mv.power * stab * eff) / 100;
}

/** Survivability against attackers of the given types (empty = neutral). `useCurrentHp` for battle order. */
export function bulk(m: Mon, attackerTypes: readonly string[] = [], useCurrentHp = false): number {
  const s = effStats(m);
  const hp = useCurrentHp ? Math.max(0, Math.min(m.currentHp, m.maxHp)) * (s.hp / Math.max(1, m.maxHp)) : s.hp;
  let taken = 1;
  if (attackerTypes.length) {
    taken = attackerTypes.reduce((acc, t) => acc + effectiveness(t, m.types), 0) / attackerTypes.length;
    taken = Math.sqrt(Math.max(0.0625, taken));
  }
  return (hp * ((s.def + s.spd) / 2)) / 100 / Math.max(0.25, taken);
}

/** Overall strength. Shinies are worth a little more (2 trait points instead of 1). */
export function monScore(m: Mon, vs: readonly string[] = [], useCurrentHp = false): number {
  const s = effStats(m);
  const speedFactor = 1 + s.spe / 250;
  const core = Math.sqrt(Math.max(0.01, offense(m, vs)) * Math.max(0.01, bulk(m, vs, useCurrentHp)));
  return core * speedFactor * (m.isShiny ? 1.1 : 1);
}

export function hpRatio(team: readonly Mon[]): number {
  const alive = team.filter((m) => m.maxHp > 0);
  if (!alive.length) return 1;
  return alive.reduce((a, m) => a + Math.max(0, m.currentHp) / m.maxHp, 0) / alive.length;
}

export function isFainted(m: Mon): boolean {
  return m.currentHp <= 0;
}

/** Index of the weakest member (lowest score; fainted counts as weakest in Nuzlocke-irrelevant cases). */
export function weakestIndex(team: readonly Mon[]): number {
  let best = -1;
  let bestScore = Infinity;
  team.forEach((m, i) => {
    const sc = monScore(m);
    if (sc < bestScore) {
      bestScore = sc;
      best = i;
    }
  });
  return best;
}
