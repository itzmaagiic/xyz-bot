/** Bot settings – identical for overlay, Chrome popup/options and userscript. */
export interface BotSettings {
  mode: 'story' | 'tower' | 'challenge';
  /** which challenge to start from the challenge screen */
  chalKind: 'arena' | 'daily' | 'weekly';
  /** arena challenge badge level 0..7; null = the game's preselection (next badge to earn) */
  chalLevel: number | null;
  storyVariant: 'classic' | 'nuzlocke';
  /** 1 = Kanto … 6 = Kalos */
  region: number;
  trainer: 'boy' | 'girl';
  /** National dex id; null = strongest */
  preferredStarter: number | null;
  resumeRuns: boolean;
  /** after game over / champion: start the next run automatically */
  autoRestart: boolean;
  /** stop after this many finished runs (0 = unlimited) */
  maxRuns: number;
  /** base delay between actions in ms (randomised ±40 %) */
  actionDelayMs: number;
  takeShiny: boolean;
  /** reorder the team so the best matchup leads */
  reorderTeam: boolean;
  notifications: boolean;
  overlayCollapsed: boolean;
  /** last game version the user acknowledged */
  knownGameVersion: string | null;
}

export const DEFAULT_SETTINGS: BotSettings = {
  mode: 'story',
  chalKind: 'arena',
  chalLevel: null,
  storyVariant: 'classic',
  region: 1,
  trainer: 'boy',
  preferredStarter: null,
  resumeRuns: true,
  autoRestart: false,
  maxRuns: 0,
  actionDelayMs: 700,
  takeShiny: true,
  reorderTeam: true,
  notifications: true,
  overlayCollapsed: false,
  knownGameVersion: '3.8',
};

export const SETTINGS_KEY = 'pkbot.settings';

/** Defensive merge of persisted data with defaults (unknown keys dropped, wrong types replaced). */
export function normalizeSettings(raw: unknown): BotSettings {
  const out: BotSettings = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  const o = out as unknown as Record<string, unknown>;
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof BotSettings)[]) {
    const d = DEFAULT_SETTINGS[k];
    const v = r[k];
    if (v === undefined) continue;
    if (d === null ? v === null || typeof v === 'number' || typeof v === 'string' : typeof v === typeof d) o[k] = v;
  }
  if (out.mode !== 'story' && out.mode !== 'tower' && out.mode !== 'challenge') out.mode = 'story';
  if (!['arena', 'daily', 'weekly'].includes(out.chalKind)) out.chalKind = 'arena';
  if (out.chalLevel !== null) out.chalLevel = Math.min(7, Math.max(0, Math.round(Number(out.chalLevel) || 0)));
  if (out.storyVariant !== 'classic' && out.storyVariant !== 'nuzlocke') out.storyVariant = 'classic';
  out.region = Math.min(6, Math.max(1, Math.round(out.region)));
  out.actionDelayMs = Math.min(5000, Math.max(150, Math.round(out.actionDelayMs)));
  out.maxRuns = Math.max(0, Math.round(out.maxRuns));
  return out;
}
