/**
 * Gen VI+ type chart (incl. Fairy). Used as fallback; at runtime the bot prefers the game's own
 * `TYPE_CHART` delivered by the bridge (see setRuntimeTypeChart), so game-specific changes win.
 */
export const TYPES = [
  'Normal',
  'Fire',
  'Water',
  'Electric',
  'Grass',
  'Ice',
  'Fighting',
  'Poison',
  'Ground',
  'Flying',
  'Psychic',
  'Bug',
  'Rock',
  'Ghost',
  'Dragon',
  'Dark',
  'Steel',
  'Fairy',
] as const;

type Chart = Record<string, Record<string, number>>;

// attacker -> [super effective], [not very effective], [no effect]
const RAW: Record<string, [string[], string[], string[]]> = {
  Normal: [[], ['Rock', 'Steel'], ['Ghost']],
  Fire: [['Grass', 'Ice', 'Bug', 'Steel'], ['Fire', 'Water', 'Rock', 'Dragon'], []],
  Water: [['Fire', 'Ground', 'Rock'], ['Water', 'Grass', 'Dragon'], []],
  Electric: [['Water', 'Flying'], ['Electric', 'Grass', 'Dragon'], ['Ground']],
  Grass: [['Water', 'Ground', 'Rock'], ['Fire', 'Grass', 'Poison', 'Flying', 'Bug', 'Dragon', 'Steel'], []],
  Ice: [['Grass', 'Ground', 'Flying', 'Dragon'], ['Fire', 'Water', 'Ice', 'Steel'], []],
  Fighting: [['Normal', 'Ice', 'Rock', 'Dark', 'Steel'], ['Poison', 'Flying', 'Psychic', 'Bug', 'Fairy'], ['Ghost']],
  Poison: [['Grass', 'Fairy'], ['Poison', 'Ground', 'Rock', 'Ghost'], ['Steel']],
  Ground: [['Fire', 'Electric', 'Poison', 'Rock', 'Steel'], ['Grass', 'Bug'], ['Flying']],
  Flying: [['Grass', 'Fighting', 'Bug'], ['Electric', 'Rock', 'Steel'], []],
  Psychic: [['Fighting', 'Poison'], ['Psychic', 'Steel'], ['Dark']],
  Bug: [['Grass', 'Psychic', 'Dark'], ['Fire', 'Fighting', 'Poison', 'Flying', 'Ghost', 'Steel', 'Fairy'], []],
  Rock: [['Fire', 'Ice', 'Flying', 'Bug'], ['Fighting', 'Ground', 'Steel'], []],
  Ghost: [['Psychic', 'Ghost'], ['Dark'], ['Normal']],
  Dragon: [['Dragon'], ['Steel'], ['Fairy']],
  Dark: [['Psychic', 'Ghost'], ['Fighting', 'Dark', 'Fairy'], []],
  Steel: [['Ice', 'Rock', 'Fairy'], ['Fire', 'Water', 'Electric', 'Steel'], []],
  Fairy: [['Fighting', 'Dragon', 'Dark'], ['Fire', 'Poison', 'Steel'], []],
};

function build(): Chart {
  const c: Chart = {};
  for (const a of TYPES) {
    const row: Record<string, number> = {};
    for (const d of TYPES) row[d] = 1;
    const [se, nve, imm] = RAW[a] ?? [[], [], []];
    for (const d of se) row[d] = 2;
    for (const d of nve) row[d] = 0.5;
    for (const d of imm) row[d] = 0;
    c[a] = row;
  }
  return c;
}

export const FALLBACK_CHART: Chart = build();
let runtimeChart: Chart | null = null;

/** Accept the game's own chart if it looks sane (18 attackers with numeric rows). */
export function setRuntimeTypeChart(chart: Chart | null | undefined): boolean {
  if (!chart || typeof chart !== 'object') return false;
  const keys = Object.keys(chart);
  if (keys.length < 18 || !keys.every((k) => typeof chart[k] === 'object')) return false;
  runtimeChart = chart;
  return true;
}

export function resetRuntimeTypeChart(): void {
  runtimeChart = null;
}

const norm = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : t);

export function effectiveness(attack: string, defend: readonly string[]): number {
  const chart = runtimeChart ?? FALLBACK_CHART;
  const row = chart[norm(attack)];
  if (!row) return 1;
  let m = 1;
  for (const d of defend) {
    const v = row[norm(d)];
    if (typeof v === 'number') m *= v;
  }
  return m;
}
