/** Pure decision functions per decision type. Inputs are plain data; outputs carry a human-readable reason. */
import { bossTypesFor } from '../data/bosses';
import type { Mon } from '../types';
import { monScore, moveOf, offense, weakestIndex, isFainted } from './evaluate';

export interface Choice {
  index: number; // -1 = skip / keep
  why: string;
}

const fmt = (n: number) => n.toFixed(1);

/** Catch: best candidate by score; when the team is full only if it beats the weakest member by a margin. */
export function chooseCatch(
  offer: readonly Mon[],
  team: readonly Mon[],
  maxTeamSize: number,
  vs: readonly string[] = [],
): Choice {
  if (!offer.length) return { index: -1, why: 'no catch options' };
  const scored = offer.map((m, i) => ({ i, s: monScore(m, vs) + 0.15 * monScore(m) }));
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  const top = scored[0]!;
  const cand = offer[top.i]!;
  if (team.length < maxTeamSize)
    return { index: top.i, why: `team has room; best option ${cand.name} (score ${fmt(top.s)})` };
  const wi = weakestIndex(team);
  const weak = team[wi]!;
  const weakScore = monScore(weak, vs) + 0.15 * monScore(weak);
  if (top.s > weakScore * 1.1) {
    return { index: top.i, why: `${cand.name} (${fmt(top.s)}) beats weakest ${weak.name} (${fmt(weakScore)})` };
  }
  return { index: -1, why: `no option beats weakest ${weak.name} (${fmt(weakScore)}) by 10%` };
}

/** Team full: which member to release for `incoming`, or -1 to keep the team. */
export function chooseRelease(incoming: Mon | null, team: readonly Mon[]): Choice {
  if (!team.length) return { index: -1, why: 'empty team' };
  const wi = weakestIndex(team);
  const weak = team[wi]!;
  if (incoming && monScore(incoming) <= monScore(weak)) {
    return { index: -1, why: `${incoming.name} is weaker than every member – keep team` };
  }
  return { index: wi, why: `release weakest ${weak.name} (score ${fmt(monScore(weak))})` };
}

/**
 * Item values for the game's real item ids (ITEM_POOL / USABLE_ITEM_POOL of v3.8, see docs/GAME_RECON.md).
 * Sprite basenames use dashes ("expert-belt"), the game ids underscores – normalizeItemId maps both.
 */
export const ITEM_VALUES: Record<string, number> = {
  rare_candy: 8, // +3 levels right now
  tm_normal: 8, // move tier +1 (big damage jump) – only offered while someone is below tier 2
  sacred_ash: 6, // full heal + revive one member (raised below when someone is down)
  expert_belt: 7.5,
  choice_band: 7,
  wide_lens: 6.5,
  metronome: 6,
  leftovers: 6.5,
  choice_specs: 6.5,
  lucky_egg: 6,
  assault_vest: 5.5,
  shell_bell: 5,
  scope_lens: 5,
  quick_claw: 5,
  kings_rock: 5,
  choice_scarf: 5,
  moon_stone: 5,
  red_card: 4.5,
  loaded_dice: 4,
  rocky_helmet: 4,
  eviolite: 3.5, // stops evolutions
  lagging_tail: 3,
  amulet_coin: 1.5,
};

export const TYPE_BOOST_ITEMS: Record<string, string> = {
  charcoal: 'Fire',
  mystic_water: 'Water',
  miracle_seed: 'Grass',
  magnet: 'Electric',
  never_melt_ice: 'Ice',
  black_belt: 'Fighting',
  poison_barb: 'Poison',
  soft_sand: 'Ground',
  sharp_beak: 'Flying',
  twisted_spoon: 'Psychic',
  silver_powder: 'Bug',
  hard_stone: 'Rock',
  spell_tag: 'Ghost',
  dragon_fang: 'Dragon',
  black_glasses: 'Dark',
  metal_coat: 'Steel',
  silk_scarf: 'Normal',
  pixie_plate: 'Fairy',
};

export const normalizeItemId = (id: string): string => id.trim().toLowerCase().replace(/-/g, '_');

export function itemValue(rawId: string, team: readonly Mon[]): number {
  const id = normalizeItemId(rawId);
  const t = TYPE_BOOST_ITEMS[id];
  if (t) {
    const users = team.filter((m) => moveOf(m).type === t).length;
    return users ? 5 + users : 2;
  }
  if (id === 'sacred_ash' && team.some((m) => m.currentHp <= 0)) return 9;
  if (id === 'tm_normal' && !team.some((m) => m.moveTier < 2)) return 2;
  return ITEM_VALUES[id] ?? 3;
}

export function chooseItem(ids: readonly (string | null)[], team: readonly Mon[]): Choice {
  if (!ids.length) return { index: -1, why: 'no items offered' };
  let best = -1;
  let bestV = -Infinity;
  ids.forEach((id, i) => {
    const v = id ? itemValue(id, team) : 3;
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  });
  if (bestV <= 0) return { index: -1, why: 'all items worthless' };
  return { index: best, why: `take ${ids[best] ?? 'unknown item'} (value ${fmt(bestV)})` };
}

/** Which team member should hold / learn something: strongest attacker by default. */
export function chooseHolder(team: readonly Mon[], kind: 'offense' | 'bulk' = 'offense'): Choice {
  if (!team.length) return { index: -1, why: 'empty team' };
  let best = 0;
  team.forEach((m, i) => {
    const a = kind === 'offense' ? offense(m) : monScore(m);
    const b = kind === 'offense' ? offense(team[best]!) : monScore(team[best]!);
    if (a > b) best = i;
  });
  return { index: best, why: `${team[best]!.name} is the best ${kind === 'offense' ? 'attacker' : 'all-rounder'}` };
}

/** Starter: preferred id, else best average matchup against the first bosses (`early` = list of type lists). */
export function chooseStarter(
  options: readonly Mon[],
  preferred?: number | null,
  early: readonly string[][] = [],
): Choice {
  if (!options.length) return { index: -1, why: 'no starters' };
  if (preferred != null) {
    const i = options.findIndex((m) => m.speciesId === preferred);
    if (i >= 0) return { index: i, why: `preferred starter #${preferred}` };
  }
  const score = (m: Mon) =>
    early.length ? early.reduce((a, vs) => a + monScore(m, vs), 0) / early.length : monScore(m);
  let best = 0;
  options.forEach((m, i) => {
    if (score(m) > score(options[best]!)) best = i;
  });
  const vsTxt = early.length ? ` vs first bosses (${early.map((t) => t.join('/')).join(', ')})` : '';
  return { index: best, why: `best starter ${options[best]!.name}${vsTxt}` };
}

/**
 * Battle order: the first living member fights first. Returns the desired order (indices into team).
 * Best matchup against `vs` leads; fainted members go last.
 */
export function desiredOrder(team: readonly Mon[], vs: readonly string[] = []): number[] {
  return team
    .map((m, i) => ({ i, s: isFainted(m) ? -1 : monScore(m, vs, true) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.i);
}

/** Smallest useful reorder step: bring the desired lead to slot 0 (one swap) if it is clearly better. */
export function leadSwap(
  team: readonly Mon[],
  vs: readonly string[] = [],
): { from: number; to: number; why: string } | null {
  if (team.length < 2) return null;
  const order = desiredOrder(team, vs);
  const lead = order[0]!;
  if (lead === 0) return null;
  const cur = team[0]!;
  const cand = team[lead]!;
  const sCur = isFainted(cur) ? -1 : monScore(cur, vs, true);
  const sNew = monScore(cand, vs, true);
  if (sNew < sCur * 1.15 && !isFainted(cur)) return null;
  return { from: lead, to: 0, why: `${cand.name} (${fmt(sNew)}) leads instead of ${cur.name} (${fmt(sCur)})` };
}

export function nextBossTypes(gen: number, badges: number, eliteIndex: number): string[] {
  return badges >= 8 ? bossTypesFor(gen, 8 + eliteIndex) : bossTypesFor(gen, badges);
}

/** 0 (strong) .. 1 (weak): team strength relative to a level-appropriate reference. */
export function teamWeakness(team: readonly Mon[], maxTeamSize: number): number {
  if (!team.length) return 1;
  const fill = team.length / Math.max(1, maxTeamSize);
  return Math.max(0, Math.min(1, 1 - fill));
}
