/** P3c T3 (R-259, D-039): a storage that does not persist is shown permanently, in plain words, with a next step. */
import { describe, expect, it } from 'vitest';
import { BotController } from '../../src/core/bot';
import type { Platform, PlatformStorage } from '../../src/platform/types';
import { reportSave, storageProblemText } from '../../src/ui/storage-problem';
import { loadFixture } from './helpers';

function botWith(storage: PlatformStorage) {
  const platform: Platform = {
    name: 'chrome',
    storage,
    copyText: async () => true,
    notify: async () => false,
    registerShortcuts: () => undefined,
    ensureBridge: async () => false,
  };
  return new BotController(platform, null, loadFixture('title'));
}

describe('storageProblemText (R-259)', () => {
  it('Chrome after an extension update: reload the page', () => {
    const t = storageProblemText(new Error('Extension context invalidated.'));
    expect(t).toMatch(/Verbindung zur Erweiterung ist abgerissen/);
    expect(t).toMatch(/Seite neu laden/);
  });

  it('memory only (private browsing): settings last until the reload', () => {
    const t = storageProblemText('volatile');
    expect(t).toMatch(/privates Surfen/);
    expect(t).toMatch(/nur bis zum Neuladen/);
  });

  it('anything else names the reason and what it means', () => {
    expect(storageProblemText(new Error('QUOTA_BYTES quota exceeded'))).toBe(
      'Einstellungen konnten nicht gespeichert werden: QUOTA_BYTES quota exceeded. Sie gelten bis zum Neuladen.',
    );
  });
});

describe('bot shows storage problems (R-259)', () => {
  it('updateSettings with a throwing storage keeps the setting and shows the problem', async () => {
    const bot = botWith({
      get: async () => undefined,
      set: async () => {
        throw new Error('Extension context invalidated.');
      },
    });
    await expect(bot.updateSettings({ actionDelayMs: 900 })).resolves.toBeUndefined();
    expect(bot.view.settings.actionDelayMs).toBe(900);
    expect(bot.view.storageProblem).toMatch(/Seite neu laden/);
  });

  it("a 'volatile' write shows the private-browsing hint; a later successful save clears the problem", async () => {
    let mode: 'volatile' | 'ok' = 'volatile';
    const bot = botWith({
      get: async () => undefined,
      set: async () => (mode === 'volatile' ? 'volatile' : undefined),
    });
    await bot.updateSettings({ actionDelayMs: 500 });
    expect(bot.view.storageProblem).toMatch(/nur bis zum Neuladen/);
    mode = 'ok';
    await bot.updateSettings({ actionDelayMs: 600 });
    expect(bot.view.storageProblem).toBeNull();
  });

  it('the hint stays while one key still fails, even if another key saves fine (review P3c M5)', async () => {
    const bot = botWith({
      get: async () => undefined,
      set: async (key: string) => {
        if (key === 'pkbot.settings') throw new Error('QuotaExceededError');
      },
    });
    await bot.updateSettings({ actionDelayMs: 700 }); // settings fail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (bot as any).persist('pkbot.stats', { runs: 1 }); // stats succeed
    expect(bot.view.storageProblem).toMatch(/konnten nicht gespeichert werden/);
  });

  it('saving the stats after a run end uses the same path', async () => {
    const bot = botWith({
      get: async () => undefined,
      set: async () => {
        throw new Error('Extension context invalidated.');
      },
    });
    bot.view.status = 'running';
    const doc = loadFixture('gameover');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bot as any).doc = doc;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (bot as any).reader.doc = doc;
    await bot.tick(); // game over → stop → stats are saved
    expect(bot.view.stats.losses).toBe(1);
    expect(bot.view.storageProblem).toMatch(/Seite neu laden/);
  });
});

describe('reportSave (options page, R-259)', () => {
  it('writes the problem text on a rejected save and the OK text on success', async () => {
    const el = loadFixture('title').createElement('span');
    await reportSave(Promise.reject(new Error('Extension context invalidated.')), el, 'Gespeichert ✓');
    expect(el.textContent).toMatch(/Seite neu laden/);
    await reportSave(Promise.resolve(), el, 'Gespeichert ✓');
    expect(el.textContent).toBe('Gespeichert ✓');
  });
});
