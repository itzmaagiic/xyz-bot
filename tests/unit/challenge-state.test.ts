/** D-040: the run state and the run logs know the challenge – relics, challenge id and badge level. */
import { describe, expect, it } from 'vitest';
import { readRun } from '../../src/core/bridge/page-bridge';
import { RunRecorder } from '../../src/core/log/run-log';
import type { GameState } from '../../src/core/types';

const raw = {
  team: [],
  items: [{ id: 'sitrus_berry', usable: true }],
  passives: [{ id: 'life_orb' }, 'expert_belt'],
  challengeId: 'intro',
  challengeBadge: 3,
  isEndlessMode: true,
  badges: 2,
  currentMap: 2,
};

describe('challenge state (D-040)', () => {
  it('readRun reports relics and the challenge (id, badge level)', () => {
    const r = readRun(raw)!;
    expect(r.mode).toBe('challenge');
    expect(r.relics).toEqual(['life_orb', 'expert_belt']);
    expect(r.challenge).toEqual({ id: 'intro', badge: 3 });
  });

  it('a story run has no challenge and no relics', () => {
    const r = readRun({ team: [], items: [], badges: 0, currentMap: 0 })!;
    expect(r.challenge).toBeNull();
    expect(r.relics).toEqual([]);
  });

  it('the run log state and the summary carry relics and the challenge', () => {
    const run = readRun(raw)!;
    const st: GameState = {
      screen: { kind: 'map', screenId: 'map-screen', overlay: null, overlayId: null, signature: 'm' },
      run,
      version: '3.8',
      settings: null,
      bridge: true,
    };
    const r = new RunRecorder({
      context: () => ({ profile: {}, mode: { setting: 'challenge', region: 1, variant: 'classic' } }),
    });
    const line = r.record({ kind: 'click', selector: '#a', why: 'x' }, st);
    expect(line.state).toMatchObject({ relics: ['life_orb', 'expert_belt'], challenge: { id: 'intro', badge: 3 } });
    expect(r.summaries()[0]!.mode).toMatchObject({ challenge: { id: 'intro', badge: 3 } });
  });
});
