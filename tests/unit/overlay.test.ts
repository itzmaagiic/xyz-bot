/** Overlay and settings for the challenge (D-040): status first, then the run, settings only what a challenge needs. */
import { describe, expect, it } from 'vitest';
import { BotController } from '../../src/core/bot';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import type { Platform } from '../../src/platform/types';
import { Overlay } from '../../src/ui/overlay';
import { buildSettingsForm } from '../../src/ui/settings-form';
import { loadFixture } from './helpers';

const platform: Platform = {
  name: 'userscript',
  storage: { get: async () => undefined, set: async () => undefined },
  copyText: async () => true,
  notify: async () => false,
  registerShortcuts: () => undefined,
  ensureBridge: async () => false,
};

function mounted() {
  const doc = loadFixture('map');
  const bot = new BotController(platform, null, doc);
  const ov = new Overlay(bot, platform, doc);
  ov.mount();
  const root = doc.getElementById('pkbot-root')!.shadowRoot!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const emit = () => (bot as any).emit();
  return { doc, bot, root, emit };
}

describe('settings form: only what a challenge needs (D-040)', () => {
  it('challenge, badge level, starter and run end in front; tempo & co. under "Erweitert"; no story fields', () => {
    const doc = loadFixture('title');
    const f = buildSettingsForm(doc, DEFAULT_SETTINGS, () => undefined);
    for (const id of ['pk-chalkind', 'pk-challevel', 'pk-chalstarter', 'pk-restart', 'pk-maxruns'])
      expect(f.querySelector(`#${id}`), id).not.toBeNull();
    const adv = f.querySelector<HTMLDetailsElement>('details.adv')!;
    expect(adv.open).toBe(false);
    for (const id of ['pk-delay', 'pk-watchdog', 'pk-shiny', 'pk-reorder', 'pk-resume', 'pk-notify'])
      expect(adv.querySelector(`#${id}`), id).not.toBeNull();
    for (const id of ['pk-mode', 'pk-variant', 'pk-region', 'pk-trainer']) expect(f.querySelector(`#${id}`)).toBeNull();
  });

  it('the badge level only applies to the arena challenge', () => {
    const doc = loadFixture('title');
    const arena = buildSettingsForm(doc, DEFAULT_SETTINGS, () => undefined);
    expect((arena.querySelector('#pk-challevel') as HTMLSelectElement).disabled).toBe(false);
    const daily = buildSettingsForm(doc, { ...DEFAULT_SETTINGS, chalKind: 'daily' }, () => undefined);
    expect((daily.querySelector('#pk-challevel') as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('overlay (D-040)', () => {
  it('running: status in words, Pause as the primary action, the run with stage track, boss and odds', () => {
    const { bot, root, emit } = mounted();
    bot.view.status = 'running';
    bot.view.run = {
      title: 'Arena-Challenge · Stufe 4',
      stage: 5,
      stages: 9,
      boss: 'Pryce',
      odds: 0.87,
      relics: 2,
      team: [{ name: 'Mewtwo', level: 54, hp: 0.4 }],
    };
    emit();
    expect(root.querySelector('#pk-status')!.textContent).toBe('Läuft');
    expect(root.querySelector('#pk-toggle')!.textContent).toBe('Pause'); // exact: the live test reads it
    const pips = Array.from(root.querySelectorAll('.track .pip'));
    expect(pips).toHaveLength(9);
    expect(pips.filter((p) => p.classList.contains('done'))).toHaveLength(5);
    expect(pips[5]!.classList.contains('now')).toBe(true);
    expect(root.querySelector('.run')!.textContent).toMatch(/Etappe 6 von 9/);
    expect(root.querySelector('.run')!.textContent).toMatch(/Pryce/);
    expect(root.querySelector('.run')!.textContent).toMatch(/87 %/);
    expect(root.querySelector('.team')!.textContent).toMatch(/Mewtwo/);
  });

  it('without a run: an empty state that says what to do', () => {
    const { root, emit } = mounted();
    emit();
    expect(root.querySelector('#pk-status')!.textContent).toBe('Bereit');
    expect(root.querySelector('#pk-toggle')!.textContent).toBe('Start'); // icon is SVG, the text stays exact
    expect(root.querySelector('.run.empty')!.textContent).toMatch(/Start/);
  });

  it('an error pause is marked as a problem in text and colour, a user pause is not', () => {
    const { bot, root, emit } = mounted();
    bot.view.status = 'paused';
    bot.view.pauseReason = 'stalled: no change for 90 s on swap';
    bot.view.pauseKind = 'stalled';
    emit();
    const box = root.querySelector('#pk-pause')!;
    expect(box.getAttribute('data-kind')).toBe('stalled');
    expect(box.classList.contains('bad')).toBe(true);
    expect(box.textContent).toMatch(/Problem/);
    bot.view.pauseReason = 'paused by user';
    bot.view.pauseKind = 'user';
    emit();
    expect(root.querySelector('#pk-pause')!.classList.contains('bad')).toBe(false);
  });

  it('collapsed: a small pill with status and Start/Pause, nothing else', () => {
    const { bot, root, emit } = mounted();
    bot.view.status = 'running';
    bot.view.settings = { ...bot.view.settings, overlayCollapsed: true };
    emit();
    expect(root.querySelector('.panel')!.classList.contains('collapsed')).toBe(true);
    expect(root.querySelector('#pk-toggle')).not.toBeNull();
    expect(root.querySelector('.setbox')).toBeNull();
  });

  it('keeps the ids the tests and the popup rely on', () => {
    const { root, emit } = mounted();
    emit();
    for (const id of [
      'pk-toggle',
      'pk-step',
      'pk-copy',
      'pk-export-runs',
      'pk-screen',
      'pk-bridge',
      'pk-decision',
      'pk-log',
    ])
      expect(root.querySelector(`#${id}`), id).not.toBeNull();
    expect(
      Array.from(root.querySelectorAll('.kv span'))
        .map((e) => e.textContent)
        .join('|'),
    ).toMatch(/Runs\|0 · 0 Siege · 0 Niederlagen/);
  });
});
