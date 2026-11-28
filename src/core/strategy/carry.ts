/**
 * Carry build (D-049): one Pokémon carries the run. Community meta (pokelike-guide.fr "Challenge Mode Strategy",
 * summarising YouTube runs): "Slaking carries a whole run alone … max HP and crit passives first; Speed
 * secondary". The carry gets the levels and the relics that keep it alive and hitting; relics of its own type
 * count, other type relics do not. Pure functions – ids are the game's relic ids (PASSIVE_ITEM_POOL, v3.8).
 */
import type { Mon } from '../types';

/** The carry: the starter (bridge `_isStarter`), else the highest level. -1 for an empty team. */
export function carryIndex(team: readonly Mon[]): number {
  if (!team.length) return -1;
  const s = team.findIndex((m) => m.isStarter);
  if (s >= 0) return s;
  return team.reduce((b, m, i) => (m.level > team[b]!.level ? i : b), 0);
}

export function carryTypes(team: readonly Mon[]): string[] {
  const i = carryIndex(team);
  return i >= 0 ? [...team[i]!.types] : [];
}

/**
 * Generic relics by value for a carry (v3.8 effects, GAME_RECON / STRATEGY "Meta"):
 * 5 = keeps it alive through a gauntlet or multiplies its damage, 3 = clearly useful, 1 = small, <0 = works against
 * a single carry.
 */
const GENERIC: Record<string, number> = {
  sturdy: 5, // Focus Sash: survives one KO per fight – every fight of the league
  crit_overflow: 5, // Razor Claw +35 % crit
  power_bracer: 4, // +20 % damage
  crit_lifesteal: 4, // Oran Berry: crits heal 100 % of the damage
  lifesteal: 4, // Big Root: heal 20 % of damage dealt – sustain without Pokécenter
  ko_maxhp: 4, // HP Up: +2 max HP per KO for the rest of the run
  post_combat_lvl: 4, // Stardust: extra levels – "levels are the strongest resource"
  crit_boost: 3, // Muscle Band
  dark_splash: 3, // crits ignore 50 % DEF
  execute_dmg: 3, // Ring Target +35 % vs damaged targets
  onhit_ramp: 3, // Power Herb +5 % per hit, no cap
  shield_guard: 3, // Kee Berry
  clear_amulet: 3, // −25 % neutral damage
  def_onhit_all: 2, // Hard Stone
  enemy_recoil: 2, // Jaboca Berry
  booster_energy: 2,
  berry_juice: 2,
  crit_flinch: 2,
  heal_boost: 1,
  slow_armor: 1,
  exp_share: 1, // helps the rest of the team, not the carry
  // against a single carry
  no_item_buff: -2, // needs empty held-item slots
  all_half: -2, // Lax Incense: −50 % damage dealt
  dmg_cap: -1, // Prism Scale wants many different types
  team_damage_spread: -1, // Eject Pack spreads the carry's damage onto the weak bench
  eject_pack: -1,
};

/** Relics tied to a type (by id: st_<type>_…, <type>_…, z_<type>, <type>_seed); count only for the carry's types. */
const TYPE_IDS: Record<string, RegExp> = {
  Normal: /^(st_)?normal_|^z_normal$|^st_poke_doll$/,
  Psychic: /^(st_)?psychic_|^z_psychic$|^splash_(more|crit)$/,
  Fire: /^(st_)?fire_|^z_fire$/,
  Water: /^(st_)?water_|^z_water$|^st_fresh_water$/,
  Grass: /^(st_)?grass_|^z_grass$/,
  Electric: /^(st_)?elec(tric)?_|^z_electric$/,
  Ice: /^(st_)?ice_|^z_ice$/,
  Fighting: /^(st_)?fight(ing)?_|^z_fighting$/,
  Poison: /^(st_)?poison_|^z_poison$/,
  Ground: /^(st_)?ground_|^z_ground$/,
  Flying: /^(st_)?flying_|^z_flying$/,
  Bug: /^(st_)?bug_|^z_bug$/,
  Rock: /^(st_)?rock_|^z_rock$/,
  Ghost: /^(st_)?ghost_|^z_ghost$/,
  Dragon: /^(st_)?dragon_|^z_dragon$/,
  Dark: /^(st_)?dark_(?!splash)|^z_dark$/,
  Steel: /^(st_)?steel_|^z_steel$/,
  Fairy: /^(st_)?fairy_|^z_fairy$/,
};
const TYPE_RELIC = 4;

/**
 * Priority of a relic for the carry build. Type relics (D-051): base 4 for the carry's type, +0.5 for every other
 * member sharing it (a Ghost relic on a Ghost team beats a Dragon relic only Giratina uses); a type the carry lacks
 * counts 0.5 per member from two members on.
 */
export function carryRelicPriority(
  id: string | null | undefined,
  carry: Mon | undefined,
  opts: { legendary?: boolean; team?: readonly Mon[] } = {},
): number {
  if (!id || !carry) return 0;
  if (id in GENERIC) return GENERIC[id]!;
  if (/^legend_/.test(id)) return (opts.legendary ?? carry.legendary) ? 3 : 0;
  if (/^shiny_(dmg|def)$/.test(id)) return carry.isShiny ? 3 : 0;
  for (const [type, re] of Object.entries(TYPE_IDS)) {
    if (!re.test(id)) continue;
    const n = opts.team ? opts.team.filter((m) => m.types.includes(type)).length : carry.types.includes(type) ? 1 : 0;
    if (carry.types.includes(type)) return Math.min(6, TYPE_RELIC + 0.5 * Math.max(0, n - 1));
    return n >= 2 ? Math.min(3, 0.5 * n) : 0;
  }
  return 0;
}
