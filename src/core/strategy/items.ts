/** Pure item logic: when to use bag items, who gets them, who should hold what. Ids = game ids (underscores). */
import { FLAGS } from '../flags';
import type { Mon } from '../types';
import { carryIndex } from './carry';
import { itemValue, normalizeItemId, TYPE_BOOST_ITEMS } from './choices';
import { bulk, effStats, monScore, moveOf, offense } from './evaluate';

export interface BagEntry {
  id: string;
  usable: boolean;
}

const alive = (m: Mon) => m.currentHp > 0;

/**
 * Which bag item to open now (or null). Usable items: candy/TM/stone right away, Sacred Ash only when somebody
 * is down or badly hurt. Held items left in the bag: equip when someone has a free hand.
 * `blocked` = "id|index" keys that already turned out to have no valid target on this map.
 */
export function chooseBagUse(
  bag: readonly BagEntry[],
  team: readonly Mon[],
  blocked: ReadonlySet<string>,
  /** keep revives for the boss-prep screen (between Elite Four fights there is no healing) */
  saveRevives = false,
): { index: number; itemId: string; why: string } | null {
  for (let i = 0; i < bag.length; i++) {
    const id = normalizeItemId(bag[i]!.id);
    if (blocked.has(`${id}|${i}`)) continue;
    if (bag[i]!.usable) {
      if (id === 'sacred_ash') {
        if (saveRevives) continue;
        const down = team.find((m) => !alive(m));
        const hurt = team.find((m) => alive(m) && m.currentHp / m.maxHp < 0.35);
        if (down || hurt) return { index: i, itemId: id, why: `Sacred Ash: ${(down ?? hurt)!.name} needs it` };
        continue;
      }
      if (id === 'tm_normal' && !team.some((m) => alive(m) && m.moveTier < 2)) continue;
      if (id === 'rare_candy' || id === 'tm_normal' || id === 'moon_stone')
        return { index: i, itemId: id, why: `use ${id} now` };
      continue; // unknown usable item: keep it
    }
    // only open a held item when someone should really hold it – otherwise the equip dialog would put it back
    if (
      chooseEquipHolder(
        id,
        team,
        team.map((_, k) => k),
      )
    )
      return { index: i, itemId: id, why: `equip ${id} from the bag` };
  }
  return null;
}

/** Target for a usable item among the rows the game allows (`targetable` = team indices). */
export function chooseUsableTarget(
  itemId: string,
  team: readonly Mon[],
  targetable: readonly number[],
): { index: number; why: string } | null {
  const id = normalizeItemId(itemId);
  const cands = targetable.filter((i) => team[i]);
  if (!cands.length) return null;
  const by = (f: (m: Mon) => number) => cands.reduce((a, b) => (f(team[b]!) > f(team[a]!) ? b : a));
  // carry build (D-049): levels, move tiers and the forced evolution go to the carry whenever the game allows it
  const carry = carryIndex(team);
  if (FLAGS.carry && carry >= 0 && cands.includes(carry) && ['rare_candy', 'tm_normal', 'moon_stone'].includes(id))
    return { index: carry, why: `${id} → ${team[carry]!.name} (carry)` };
  let idx: number;
  switch (id) {
    case 'sacred_ash': {
      const down = cands.filter((i) => !alive(team[i]!));
      idx = down.length
        ? down.reduce((a, b) => (team[b]!.level > team[a]!.level ? b : a))
        : by((m) => (1 - m.currentHp / m.maxHp) * m.level);
      break;
    }
    case 'tm_normal':
      idx = by((m) => offense(m) * (m.moveTier < 2 ? 1 : 0.5));
      break;
    case 'moon_stone':
      idx = by((m) => m.level);
      break;
    default:
      // rare candy and anything else: strengthen the carry (all living members level together anyway)
      idx = by((m) => (alive(m) ? monScore(m) : -1));
  }
  return { index: idx, why: `${id} → ${team[idx]!.name}` };
}

/** Mega Stones by id (`charizardite_x`, `kangaskhanite` …); `eviolite` is the one ordinary item with that ending. */
export function isMegaStoneId(itemId: string): boolean {
  const id = normalizeItemId(itemId);
  return id !== 'eviolite' && /ite(_[xyz])?$/.test(id);
}

const letters = (s: string) =>
  s
    .toLowerCase()
    .replace(/^mega\s+/, '')
    .replace(/[^a-z]/g, '');

/**
 * Does the stone belong to this species? Stone ids are the species name plus "ite"/"inite"/"onite" (abomasite →
 * Abomasnow, sablenite → Sableye), so a common prefix of at least 5 letters identifies the species.
 */
export function megaStoneFits(stoneId: string, m: Mon): boolean {
  const a = letters(normalizeItemId(stoneId).replace(/_[xyz]$/, ''));
  const b = letters(m.name);
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n >= Math.min(5, b.length);
}

const holdsMega = (m: Mon) => !!m.heldMega || (!!m.heldItem && isMegaStoneId(m.heldItem));

/** A held item is only given up for a clearly better one (and a Mega Stone never). */
const REPLACE_MARGIN = 1;

/**
 * Best holder for a held item among eligible team indices, or null = keep it in the bag.
 * Live finding (chal5, 2026-11-27): the bot swapped the PC starter's Mega Stone for an Expert Belt and gave a
 * Kangaskhanite to Electivire – the starter lost its Mega form for the whole run.
 */
export function chooseEquipHolder(
  itemId: string,
  team: readonly Mon[],
  eligible: readonly number[],
): { index: number; why: string } | null {
  const id = normalizeItemId(itemId);
  const stone = isMegaStoneId(id);
  const fits = eligible.filter((i) => team[i] && !holdsMega(team[i]!) && (!stone || megaStoneFits(id, team[i]!)));
  const free = fits.filter((i) => !team[i]!.heldItem);
  const worth = itemValue(id, team);
  const cands = free.length
    ? free
    : stone
      ? fits
      : fits.filter((i) => worth > itemValue(team[i]!.heldItem!, team) + REPLACE_MARGIN);
  if (!cands.length) return null;
  const by = (f: (m: Mon) => number) => cands.reduce((a, b) => (f(team[b]!) > f(team[a]!) ? b : a));
  const boostType = TYPE_BOOST_ITEMS[id];
  let idx: number;
  if (boostType) idx = by((m) => (moveOf(m).type === boostType ? offense(m) : offense(m) * 0.1));
  else if (id === 'choice_band') idx = by((m) => (moveOf(m).isSpecial ? 0.1 : 1) * offense(m));
  else if (id === 'choice_specs') idx = by((m) => (moveOf(m).isSpecial ? 1 : 0.1) * offense(m));
  else if (['leftovers', 'assault_vest', 'red_card', 'rocky_helmet', 'shell_bell'].includes(id))
    idx = by((m) => bulk(m));
  else if (id === 'eviolite') idx = by((m) => bulk(m) * (m.level < 30 ? 1 : 0.5));
  else if (id === 'lucky_egg')
    idx =
      FLAGS.carry && cands.includes(carryIndex(team))
        ? carryIndex(team) // D-049: extra levels for the carry
        : by((m) => -m.level); // help the lowest catch up
  else if (id === 'choice_scarf' || id === 'quick_claw') idx = by((m) => offense(m) / Math.max(1, effStats(m).spe));
  else idx = by((m) => offense(m));
  return { index: idx, why: `${id} → ${team[idx]!.name}` };
}
