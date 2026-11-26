import { describe, expect, it } from 'vitest';
import { detectScreen } from '../../src/core/screens/detector';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { decide, newMemory } from '../../src/core/strategy/engine';
import type { Decision, GameState } from '../../src/core/types';
import { Watchdog } from '../../src/core/watchdog';
import { loadFixture } from './helpers';

/**
 * Replay of the live boss fight from GAME_RECON §12.8 (Erika, 2026-11-26): SKIP usable → disabled after the click
 * (0.6 s) → 17 HP changes over 16.7 s, gaps up to 2 s → SKIP hidden, CONTINUE shown. Before P3a the bot paused
 * with "action keeps failing … #btn-auto-battle" after ~15 s.
 */
describe('battle replay: 16.7 s boss fight (GAME_RECON §12.8)', () => {
  it('never pauses or stalls, waits while SKIP is disabled and ends with a click on CONTINUE', () => {
    const doc = loadFixture('battle-gym');
    const skip = doc.getElementById('btn-auto-battle')!;
    const cont = doc.getElementById('btn-continue-battle')!;
    const hp = Array.from(doc.querySelectorAll('#battle-screen .hp-text'));
    let now = 0;
    const wd = new Watchdog(() => now);
    const settings = { ...DEFAULT_SETTINGS, reorderTeam: false };
    const mem = newMemory();
    const state = (): GameState => ({
      screen: detectScreen(doc),
      run: null,
      version: '3.8',
      settings: null,
      bridge: false,
    });
    const step = (): Decision => {
      const st = state();
      expect(wd.observe(st.screen.signature, settings.watchdogSec * 1000)).not.toBe('stall');
      return decide(st, doc, settings, mem);
    };

    // t = 0: SKIP usable → click it; the game disables it in reaction
    expect(step()).toMatchObject({ kind: 'click', selector: '#btn-auto-battle' });
    skip.setAttribute('disabled', '');

    // 16.7 s of fighting: HP texts change 17 times, gaps up to 2 s; every tick (700 ms) must be a plain wait
    const decisions: Decision[] = [];
    for (let change = 0; change < 17; change++) {
      for (let tick = 0; tick < 3; tick++) {
        now += 700;
        decisions.push(step());
      }
      hp[change % hp.length]!.textContent = `${17 - change}/90`;
    }
    expect(decisions.every((d) => d.kind === 'wait')).toBe(true);
    expect(decisions.some((d) => d.kind === 'click' && d.selector === '#btn-auto-battle')).toBe(false);

    // fight over: SKIP hidden, CONTINUE shown → click CONTINUE
    skip.setAttribute('style', 'display:none');
    cont.setAttribute('style', 'display:block');
    now += 700;
    expect(step()).toMatchObject({ kind: 'click', selector: '#btn-continue-battle' });
  });
});
