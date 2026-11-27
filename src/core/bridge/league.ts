/**
 * The league (map 9) of the arena challenge, built like the game's `rollWorldTournamentRegion` (v3.8) does – but
 * without touching the game: the game picks the league at the start of the run (`endlessState.wtGauntletPick`), so
 * the bot can evaluate catches and relics against the real final opponent long before it reaches the last region
 * (D-044). Pure: the bridge passes in the game data and turns each spec into a team with `buildWtTrainer`.
 */

export interface LeagueFightSpec<T> {
  /** trainer definition from WT_GAUNTLETS (members, champion) */
  def: T;
  level: number;
  moveTier: number;
  champion: boolean;
}

export interface LeagueParams<T> {
  /** WT_BOSS_LEVELS – index 8 is the league */
  bossLevels: readonly number[];
  /** state.challengeLevelMult || 1 */
  levelMult: number;
  /** chalBadgeBossMult() */
  badgeMult: number;
  /** treatBossLevelBonus(8) */
  bossLevelBonus: number;
  /** treatGauntletBonus(place) */
  gauntletBonus: (place: number) => number;
  /** state.challengeEliteLevelMod || 0 in a challenge (state.challengeId), null outside */
  eliteMod: number | null;
  /** champion of WT_GAUNTLETS[wtSecondChampPick] once badge rule 7 picked it – never rolled by the bot */
  secondChampion?: T | null;
}

export function arenaLeagueSpecs<T>(
  g: { members: readonly T[]; champion: T },
  p: LeagueParams<T>,
): LeagueFightSpec<T>[] {
  const champLevel = Math.round((p.bossLevels[8] ?? 120) * p.levelMult * p.badgeMult) + p.bossLevelBonus;
  const elite = p.eliteMod == null ? 0 : Math.max(0, 10 + p.eliteMod);
  const all = [...g.members, g.champion];
  const last = all.length - 1;
  const out = all.map((def, i) => ({
    def,
    level: (i < last ? Math.max(1, champLevel - (last - i) * 6) : champLevel) + elite + p.gauntletBonus(i),
    moveTier: i < last ? 2 : 3,
    champion: i === last,
  }));
  if (p.secondChampion != null)
    out.push({ def: p.secondChampion, level: champLevel + elite, moveTier: 3, champion: true });
  return out;
}
