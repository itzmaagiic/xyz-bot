/** Pure decisions for challenge runs (Arena-Challenge, daily, weekly). */
import { TYPES } from '../data/typechart';
import type { Mon } from '../types';

export interface PcCard {
  speciesId: number;
  shiny: boolean;
  aurora: boolean;
  /** buff points from vitamins (title "50 Buff-Punkte") */
  buff: number;
  mega: boolean;
}

export interface SpeciesStats {
  bst: number;
  types: string[];
}

/** Parses the PC starter grid (challenge starter screen). Language independent: sprite path, number, badge. */
export function readPcCards(doc: Document): PcCard[] {
  return Array.from(doc.querySelectorAll('#starter-choices .dex-card')).map((c) => {
    const src = c.querySelector('img')?.getAttribute('src') ?? '';
    const m = src.match(/pokemon\/(?:(shiny|aurora)\/)?(\d+)/);
    const stars = c.querySelector('.pc-buff-stars')?.getAttribute('title') ?? '';
    return {
      speciesId: m ? Number(m[2]) : 0,
      shiny: m?.[1] === 'shiny' || c.className.includes('shiny'),
      aurora: m?.[1] === 'aurora' || c.className.includes('aurora'),
      buff: Number(stars.match(/\d+/)?.[0] ?? 0),
      mega: !!c.querySelector('.pc-mega-badge'),
    };
  });
}

/**
 * Starter value: base stat total dominates (a legendary at Lv 5 still out-scales everything), then vitamins
 * (each buff point ≈ +0.5 % stats), shiny (2 trait points) / aurora, and a mega stone that starts equipped.
 */
export function pcStarterScore(c: PcCard, stats: SpeciesStats | undefined): number {
  const bst = stats?.bst ?? 300;
  return bst * (1 + c.buff / 200) * (c.shiny || c.aurora ? 1.08 : 1) * (c.mega ? 1.12 : 1);
}

export function choosePcStarter(
  cards: readonly PcCard[],
  stats: Record<number, SpeciesStats>,
  preferred?: number | null,
): { index: number; why: string } {
  if (!cards.length) return { index: -1, why: 'no PC Pokémon' };
  if (preferred != null) {
    const i = cards.findIndex((c) => c.speciesId === preferred);
    if (i >= 0) return { index: i, why: `preferred starter #${preferred}` };
  }
  let best = 0;
  cards.forEach((c, i) => {
    if (pcStarterScore(c, stats[c.speciesId]) > pcStarterScore(cards[best]!, stats[cards[best]!.speciesId])) best = i;
  });
  const c = cards[best]!;
  const tags = [c.shiny ? 'shiny' : '', c.aurora ? 'aurora' : '', c.mega ? 'mega' : '', c.buff ? `${c.buff} buff` : '']
    .filter(Boolean)
    .join(', ');
  return {
    index: best,
    why: `PC starter #${c.speciesId} (BST ${stats[c.speciesId]?.bst ?? '?'}${tags ? ', ' + tags : ''})`,
  };
}

export interface RelicCard {
  /** types the relic refers to (from kw-<Type> classes, English) */
  types: string[];
  starter: boolean;
}

const TYPE_SET = new Set<string>(TYPES);

export function readRelicCards(doc: Document): RelicCard[] {
  return Array.from(doc.querySelectorAll('#passive-choices .item-card.passive-card')).map((c) => {
    const types = new Set<string>();
    for (const e of Array.from(c.querySelectorAll('[class*="kw-"]'))) {
      for (const cls of Array.from(e.classList)) {
        const t = cls.startsWith('kw-') ? cls.slice(3) : '';
        if (TYPE_SET.has(t)) types.add(t);
      }
    }
    return { types: [...types], starter: !!c.querySelector('.item-tag--starter') };
  });
}

/**
 * Relics boost a type (trait synergy) or are neutral. Prefer relics for types the team actually has (counted per
 * member – traits scale with how many members share a type); neutral relics are a solid middle.
 */
/** Team synergy of one relic (same scale as chooseRelic). */
export function relicScore(c: RelicCard, team: readonly Mon[]): number {
  const count: Record<string, number> = {};
  for (const m of team) for (const t of m.types) count[t] = (count[t] ?? 0) + (m.isShiny ? 2 : 1);
  return c.types.length
    ? Math.max(...c.types.map((t) => count[t] ?? 0)) * 3 + (c.types.some((t) => count[t]) ? 2 : -1)
    : 3.5;
}

/**
 * Relic slots full: the dialog lists the owned relics (click = drop it for the new one), then the new relic, then
 * skip. Replace the weakest owned relic only if the new one fits the current team clearly better.
 */
export function chooseRelicReplace(
  owned: readonly RelicCard[],
  incoming: RelicCard,
  team: readonly Mon[],
): { index: number; why: string } {
  if (!owned.length) return { index: -1, why: 'no relic to replace' };
  let worst = 0;
  owned.forEach((c, i) => {
    if (relicScore(c, team) < relicScore(owned[worst]!, team)) worst = i;
  });
  const gain = relicScore(incoming, team) - relicScore(owned[worst]!, team);
  if (gain >= 2)
    return {
      index: worst,
      why: `replace relic for ${owned[worst]!.types.join('/') || 'any'} (synergy +${gain.toFixed(1)})`,
    };
  return { index: -1, why: 'new relic is not better than the owned ones' };
}

export function chooseRelic(cards: readonly RelicCard[], team: readonly Mon[]): { index: number; why: string } {
  if (!cards.length) return { index: -1, why: 'no relic offered' };
  const count: Record<string, number> = {};
  for (const m of team) for (const t of m.types) count[t] = (count[t] ?? 0) + (m.isShiny ? 2 : 1);
  const score = (c: RelicCard) =>
    c.types.length
      ? Math.max(...c.types.map((t) => count[t] ?? 0)) * 3 + (c.types.some((t) => count[t]) ? 2 : -1)
      : 3.5;
  let best = 0;
  cards.forEach((c, i) => {
    if (score(c) > score(cards[best]!)) best = i;
  });
  const c = cards[best]!;
  return { index: best, why: `relic for ${c.types.join('/') || 'any type'} (team synergy ${score(c).toFixed(1)})` };
}
