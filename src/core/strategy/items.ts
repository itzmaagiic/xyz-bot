/** Pure item logic: when to use bag items, who gets them, who should hold what. Ids = game ids (underscores). */
import type { Mon } from '../types';
import { normalizeItemId, TYPE_BOOST_ITEMS } from './choices';
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
    if (team.some((m) => !m.heldItem)) return { index: i, itemId: id, why: `equip ${id} from the bag` };
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

/** Best holder for a held item among eligible team indices. */
export function chooseEquipHolder(
  itemId: string,
  team: readonly Mon[],
  eligible: readonly number[],
): { index: number; why: string } | null {
  const id = normalizeItemId(itemId);
  const free = eligible.filter((i) => team[i] && !team[i]!.heldItem);
  const cands = free.length ? free : eligible.filter((i) => team[i]);
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
    idx = by((m) => -m.level); // help the lowest catch up
  else if (id === 'choice_scarf' || id === 'quick_claw') idx = by((m) => offense(m) / Math.max(1, effStats(m).spe));
  else idx = by((m) => offense(m));
  return { index: idx, why: `${id} → ${team[idx]!.name}` };
}
