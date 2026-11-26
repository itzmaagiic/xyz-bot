import { describe, expect, it } from 'vitest';
import { detectScreen, isActionable } from '../../src/core/screens/detector';
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

  // P3a (GAME_RECON §12.8): visible is not the same as usable
  it('isActionable is false for disabled, aria-disabled, pointer-events:none and hidden buttons; true for a normal one', () => {
    const doc = loadFixture('battle-gym');
    const mk = (attrs: Record<string, string>) => {
      const b = doc.createElement('button');
      for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
      doc.body.appendChild(b);
      return b;
    };
    expect(isActionable(mk({}))).toBe(true);
    expect(isActionable(mk({ disabled: '' }))).toBe(false);
    expect(isActionable(mk({ 'aria-disabled': 'true' }))).toBe(false);
    expect(isActionable(mk({ style: 'pointer-events:none' }))).toBe(false);
    expect(isActionable(mk({ style: 'display:none' }))).toBe(false);
    expect(isActionable(null)).toBe(false);
  });

  it('battle signature: skip when SKIP is usable, skip-off when it is disabled', () => {
    const doc = loadFixture('battle-gym');
    expect(detectScreen(doc).signature).toMatch(/\|skip(?!-off)/);
    doc.getElementById('btn-auto-battle')!.setAttribute('disabled', '');
    expect(detectScreen(doc).signature).toMatch(/\|skip-off/);
  });

  it('battle signature changes when an HP text changes (battle progress)', () => {
    const doc = loadFixture('battle-gym');
    const before = detectScreen(doc).signature;
    doc.querySelector('#battle-screen .hp-text')!.textContent = '1/71';
    expect(detectScreen(doc).signature).not.toBe(before);
  });
});
