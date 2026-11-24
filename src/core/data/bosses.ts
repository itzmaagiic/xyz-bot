/**
 * Boss type hints per region (gen) and map index, following the main games.
 * Source: main-series games / pokelike.wiki guides – treated as HINTS only. When the bridge can read the
 * actual boss team from the game, that data wins (see RunState / strategy).
 * Index 0..7 = gyms, 8..11 = Elite Four, 12 = Champion (mixed => []).
 */
export const BOSS_TYPES: Record<number, string[][]> = {
  1: [['Rock'], ['Water'], ['Electric'], ['Grass'], ['Poison'], ['Psychic'], ['Fire'], ['Ground'],
    ['Ice'], ['Fighting'], ['Ghost'], ['Dragon'], []],
  2: [['Flying'], ['Bug'], ['Normal'], ['Ghost'], ['Fighting'], ['Steel'], ['Ice'], ['Dragon'],
    ['Psychic'], ['Poison'], ['Fighting'], ['Dark'], ['Dragon']],
  3: [['Rock'], ['Fighting'], ['Electric'], ['Fire'], ['Normal'], ['Flying'], ['Psychic'], ['Water'],
    ['Dark'], ['Ghost'], ['Ice'], ['Dragon'], ['Steel']],
  4: [['Rock'], ['Grass'], ['Fighting'], ['Water'], ['Ghost'], ['Steel'], ['Ice'], ['Electric'],
    ['Bug'], ['Ground'], ['Fire'], ['Psychic'], []],
  5: [['Grass', 'Fire', 'Water'], ['Normal'], ['Bug'], ['Electric'], ['Ground'], ['Flying'], ['Ice'], ['Dragon'],
    ['Ghost'], ['Dark'], ['Psychic'], ['Fighting'], []],
  6: [['Bug'], ['Rock'], ['Fighting'], ['Grass'], ['Electric'], ['Fairy'], ['Psychic'], ['Ice'],
    ['Fire'], ['Water'], ['Steel'], ['Dragon'], []],
};

export function bossTypesFor(gen: number, index: number): string[] {
  return BOSS_TYPES[gen]?.[index] ?? [];
}
