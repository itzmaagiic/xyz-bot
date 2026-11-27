/** What the overlay shows about the current challenge run (D-040): plain data, no DOM. */
import type { BotSettings } from './settings';
import type { RunState } from './types';

export interface RunView {
  /** e.g. "Arena-Challenge · Stufe 4" */
  title: string;
  /** 0-based stage (8 gyms + the league = 9), null when the game does not tell */
  stage: number | null;
  stages: number;
  /** the next boss and the simulated odds against it (0..1), when known */
  boss: string | null;
  odds: number | null;
  relics: number;
  /** hp: share of max HP, 0..1 (rounded to 0.1) */
  team: { name: string; level: number; hp: number }[];
}

const KIND: Record<BotSettings['chalKind'], string> = {
  arena: 'Arena-Challenge',
  daily: 'Tages-Challenge',
  weekly: 'Wochen-Challenge',
};

export function runView(
  run: RunState | null,
  s: BotSettings,
  sim: { boss: string | null; odds: number | null },
): RunView | null {
  if (!run || !run.team.length) return null;
  const ch = run.challenge ?? null;
  const arena = ch?.id === 'intro';
  const name = arena ? KIND.arena : KIND[s.chalKind];
  const badge = ch?.badge;
  return {
    title: arena && badge != null ? `${name} · Stufe ${badge + 1}` : name,
    stage: ch?.stage ?? null,
    stages: 9,
    boss: sim.boss,
    odds: sim.odds,
    relics: run.relics?.length ?? 0,
    team: run.team.map((m) => ({
      name: m.name,
      level: m.level,
      hp: m.maxHp > 0 ? Math.round((Math.max(0, m.currentHp) / m.maxHp) * 10) / 10 : 0,
    })),
  };
}
