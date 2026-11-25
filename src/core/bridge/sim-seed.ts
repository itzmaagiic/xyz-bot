/**
 * Seeds for simulations (R-248, R-239, R-030, D-025).
 *
 * Simulations must never be derived from the game's hidden RNG (getRngSeed): that would mean
 * using knowledge no human player has. Instead the seed base is a hash of the VISIBLE game state
 * (map, node, team species/level/HP). Same visible state → same seeds → same decision (R-030).
 */
export interface VisibleState {
  currentMap?: unknown;
  currentNodeId?: unknown;
  isEndlessMode?: unknown;
  team?: ({ speciesId?: number; level?: number; currentHp?: number } | null | undefined)[] | null;
}

/** 32-bit FNV-1a over the UTF-16 code units of `s`, as an unsigned integer. */
export function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Canonical string of the visible state; hidden fields (runSeed, rngSeed, …) are ignored on purpose. */
export function visibleKey(st: VisibleState | null | undefined): string {
  const team = Array.isArray(st?.team) ? st.team : [];
  return JSON.stringify([
    st?.currentMap ?? null,
    st?.currentNodeId ?? null,
    !!st?.isEndlessMode,
    team.map((m) => (m ? [m.speciesId ?? null, m.level ?? null, m.currentHp ?? null] : null)),
  ]);
}

/** Seed base for all simulations of one decision. */
export function simBase(st: VisibleState | null | undefined): number {
  return fnv1a32(visibleKey(st));
}
