/** Pure decisions for challenge runs (Arena-Challenge, daily, weekly). */
import { TYPES } from '../data/typechart';
import type { DecisionOption, Mon } from '../types';
import { noteError } from '../log/note';

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
): { index: number; why: string; options?: DecisionOption[] } {
  if (!cards.length) return { index: -1, why: 'no PC Pokémon', options: [] };
  const options: DecisionOption[] = cards.map((c, i) => ({
    id: `starter:${i}`,
    label: `#${c.speciesId}`,
    score: pcStarterScore(c, stats[c.speciesId]),
  }));
  let best = -1;
  const better = (i: number) =>
    best < 0 ||
    pcStarterScore(cards[i]!, stats[cards[i]!.speciesId]) > pcStarterScore(cards[best]!, stats[cards[best]!.speciesId]);
  // preferred species: the strongest copy of it (shiny / buffed / mega) if the PC has it, else the overall best
  if (preferred != null) cards.forEach((c, i) => c.speciesId === preferred && better(i) && (best = i));
  const isPreferred = best >= 0;
  if (!isPreferred) cards.forEach((_, i) => better(i) && (best = i));
  const c = cards[best]!;
  const tags = [c.shiny ? 'shiny' : '', c.aurora ? 'aurora' : '', c.mega ? 'mega' : '', c.buff ? `${c.buff} buff` : '']
    .filter(Boolean)
    .join(', ');
  return {
    index: best,
    why: `${isPreferred ? 'chosen' : 'PC'} starter #${c.speciesId} (BST ${stats[c.speciesId]?.bst ?? '?'}${tags ? ', ' + tags : ''})`,
    options,
  };
}

export interface PcRosterEntry {
  id: number;
  name: string;
  bst: number;
  shiny: boolean;
  aurora: boolean;
}

/**
 * The PC (challenge starter pool) from the game's own save – read only. The grid lists exactly the evolution-line
 * roots of poke_hof_index; names and BST come from the cached dex entries (pkrl_poke_<id>). Sorted by BST.
 */
export function readPcRoster(get: (key: string) => string | null): PcRosterEntry[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped save JSON
  const json = (k: string): any => {
    try {
      return JSON.parse(get(k) ?? 'null');
    } catch (e) {
      noteError('challenge:json', e);
      return null;
    }
  };
  const hof = json('poke_hof_index');
  const roots: unknown[] = Array.isArray(hof?.evoLineRoots) ? hof.evoLineRoots : [];
  const shiny = new Set<number>((hof?.shinySpecies ?? []).map(Number));
  const aurora = new Set<number>((hof?.auroraSpecies ?? []).map(Number));
  const names = new Map<number, string>();
  const list = json('pkrl_species_list');
  if (Array.isArray(list)) for (const e of list) names.set(Number(e?.id), String(e?.name ?? ''));
  const out: PcRosterEntry[] = [];
  for (const r of roots) {
    const id = Number(r);
    if (!Number.isInteger(id) || id <= 0) continue;
    const e = json(`pkrl_poke_${id}`);
    const name = String(e?.name ?? names.get(id) ?? `#${id}`);
    out.push({
      id,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      bst: Number(e?.bst) || 0,
      shiny: shiny.has(id),
      aurora: aurora.has(id),
    });
  }
  return out.sort((a, b) => b.bst - a.bst || a.name.localeCompare(b.name));
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
