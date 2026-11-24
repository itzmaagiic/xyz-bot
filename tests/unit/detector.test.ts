import { describe, expect, it } from 'vitest';
import { detectScreen } from '../../src/core/screens/detector';
import { loadFixture } from './helpers';

const cases: [string, string, string | null][] = [
  ['title', 'title', null],
  ['title-with-modal', 'title', 'move-tutor'],
  ['region-select', 'region-select', null],
  ['trainer', 'trainer', null],
  ['starter-en', 'starter', null],
  ['starter-de', 'starter', null],
  ['map', 'map', null],
  ['map-tutorial', 'map', 'tutorial'],
  ['map-move-tutor', 'map', 'move-tutor'],
  ['map-achx-banner', 'map', null],
  ['catch-en', 'catch', null],
  ['catch-de', 'catch', null],
  ['battle-wild', 'battle', null],
  ['battle-trainer', 'battle', null],
  ['battle-gym', 'battle', null],
  ['elite-prep', 'elite-prep', null],
  ['badge', 'badge', null],
  ['shiny', 'shiny', null],
  ['item', 'item', null],
  ['swap-de', 'swap', null],
  ['trade', 'trade', null],
  ['gameover', 'gameover', null],
  ['settings-modal', 'title', 'unknown-modal'],
  ['tower-select', 'tower-select', null],
];

describe('ScreenDetector on real DOM snapshots', () => {
  for (const [fixture, kind, overlay] of cases) {
    it(`${fixture} → ${kind}${overlay ? ' + ' + overlay : ''}`, () => {
      const doc = loadFixture(fixture);
      const s = detectScreen(doc);
      expect(s.kind).toBe(kind);
      expect(s.overlay).toBe(overlay);
    });
  }

  it('unknown screen id → unknown (never guesses)', () => {
    const doc = loadFixture('title');
    const act = doc.querySelector('.screen.active')!;
    act.classList.remove('active');
    const div = doc.createElement('div');
    div.id = 'brand-new-screen';
    div.className = 'screen active';
    doc.body.appendChild(div);
    expect(detectScreen(doc).kind).toBe('unknown');
  });

  it('two active screens → unknown', () => {
    const doc = loadFixture('map');
    doc.getElementById('catch-screen')!.classList.add('active');
    expect(detectScreen(doc).kind).toBe('unknown');
  });

  it('map signature lists clickable nodes', () => {
    const s = detectScreen(loadFixture('map'));
    expect(s.signature).toMatch(/^map-screen\|-\|n1_0,n1_1$/);
  });
});
