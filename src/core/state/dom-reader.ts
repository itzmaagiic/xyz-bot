/** Read-only DOM parsing helpers (language independent). Used as fallback and for cross-checking bridge data. */
import type { Mon, Move } from '../types';

const TYPE_CLASS = /\btype-([a-z]+)\b/;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function speciesFromSprite(src: string | null | undefined): { id: number; shiny: boolean } | null {
  if (!src) return null;
  const m = src.match(/pokemon\/(shiny\/|aurora\/)?(\d+)(?:[-_][\w-]+)?\.(?:png|gif|webp)/);
  if (!m) return null;
  return { id: Number(m[2]), shiny: !!m[1] };
}

export function itemIdFromCard(card: Element): string | null {
  const img = card.querySelector('img');
  const src = img?.getAttribute('src') ?? '';
  const m = src.match(/items\/([\w-]+)\.png/);
  return m ? m[1]! : null;
}

function int(text: string | null | undefined): number {
  const m = (text ?? '').match(/-?\d+/);
  return m ? Number(m[0]) : 0;
}

const STAT_CLASS: Record<string, keyof Mon['baseStats']> = {
  'stat-hp': 'hp',
  'stat-atk': 'atk',
  'stat-def': 'def',
  'stat-spa': 'special',
  'stat-spd': 'spdef',
  'stat-spe': 'speed',
};

/** Parses a `.poke-card` (catch/swap/shiny/starter). Stats are the card's displayed values, not base stats. */
export function parsePokeCard(card: Element): Mon | null {
  const img = card.querySelector('img.poke-sprite, .poke-sprite-wrap img');
  const sp = speciesFromSprite(img?.getAttribute('src'));
  if (!sp) return null;
  const types = Array.from(card.querySelectorAll('.poke-types .type-badge'))
    .map((b) => (b.className.match(TYPE_CLASS)?.[1] ?? ''))
    .filter(Boolean)
    .map(cap);
  const stats = { hp: 0, atk: 0, def: 0, speed: 0, special: 0, spdef: 0 };
  for (const row of Array.from(card.querySelectorAll('.stat-row'))) {
    const fill = row.querySelector('.stat-bar-fill');
    const cls = Array.from(fill?.classList ?? []).find((c) => c in STAT_CLASS);
    if (cls) stats[STAT_CLASS[cls]!] = int(row.querySelector('.stat-val')?.textContent);
  }
  const hpText = card.querySelector('.hp-text')?.textContent ?? '';
  const [cur, max] = hpText.split('/').map((x) => int(x));
  let move: Move | null = null;
  const mv = card.querySelector('.poke-move');
  if (mv) {
    const mt = mv.querySelector('.move-type-badge')?.className.match(TYPE_CLASS)?.[1];
    move = {
      name: mv.querySelector('.move-name')?.getAttribute('title') ?? '',
      power: int(mv.querySelector('.move-power-badge')?.textContent),
      type: mt ? cap(mt) : types[0] ?? 'Normal',
      isSpecial: /special/.test(mv.querySelector('.move-cat-icon')?.getAttribute('src') ?? ''),
    };
  }
  return {
    speciesId: sp.id,
    name: img?.getAttribute('alt') ?? `#${sp.id}`,
    level: int(card.querySelector('.poke-level')?.textContent) || 1,
    currentHp: cur ?? 0,
    maxHp: max ?? (cur || 1),
    isShiny: sp.shiny || card.classList.contains('card-shiny'),
    types,
    baseStats: stats,
    heldItem: null,
    moveTier: 0,
    move,
  };
}

export function readCards(root: ParentNode, selector: string): Mon[] {
  return Array.from(root.querySelectorAll(selector))
    .map(parsePokeCard)
    .filter((m): m is Mon => !!m);
}

export function readClickableMapNodes(doc: Document): string[] {
  return Array.from(doc.querySelectorAll('#map-screen .map-node--clickable'))
    .map((e) => e.getAttribute('data-node-id') ?? '')
    .filter(Boolean);
}
