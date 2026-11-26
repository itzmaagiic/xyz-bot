/** Shared bootstrap used by both targets. */
import { BotController } from './core/bot';
import { BridgeClient } from './core/bridge/client';
import { noteError, noteRejection } from './core/log/note';
import type { Platform } from './platform/types';
import { Overlay } from './ui/overlay';
import { toast } from './ui/toast';

export interface App {
  bot: BotController;
  overlay: Overlay;
}

/**
 * A failed start must not vanish as an unhandled rejection (R-199): note it, log it to the console and tell the user
 * with a toast – the overlay may not exist yet.
 */
export function reportStartFailure(e: unknown, doc: Document = document): void {
  noteError('app:start', e);
  const msg = e instanceof Error ? e.message : String(e);
  console.error('[pkbot] start failed', e);
  toast(`Pokelike Bot konnte nicht starten: ${msg}`, 8000, doc);
}

/** Debounce so a key that reaches both chrome.commands and the page only acts once. */
function once(fn: () => void, ms = 350): () => void {
  let last = 0;
  return () => {
    const now = Date.now();
    if (now - last < ms) return;
    last = now;
    fn();
  };
}

export async function startApp(platform: Platform, doc: Document = document): Promise<App> {
  const w = doc.defaultView as (Window & { __pkbotApp?: Promise<App> }) | null;
  if (w?.__pkbotApp) return w.__pkbotApp; // never start twice (e.g. extension + userscript installed)
  const p = (async () => {
    const bridgeOk = await platform.ensureBridge();
    const client = new BridgeClient(doc);
    const ready = bridgeOk && (await client.waitReady(4000));
    const bot = new BotController(
      {
        ...platform,
        notify: async (title, body) => {
          const sys = await platform.notify(title, body);
          if (!sys) toast(`${title}: ${body}`, 6000, doc);
          return true;
        },
      },
      ready ? client : null,
      doc,
    );
    const overlay = new Overlay(bot, platform, doc);
    overlay.mount();
    await bot.init();
    bot.log.info(`pokelike bot ready (${platform.name}, ${ready ? 'bridge' : 'DOM fallback'})`);
    if (!ready) bot.log.warn('page bridge unavailable – running on DOM data only (weaker decisions)');
    platform.registerShortcuts({
      toggle: once(() => bot.toggle()),
      step: once(() => noteRejection('app:step', bot.step())),
      toggleOverlay: once(() => overlay.toggleVisible()),
    });
    return { bot, overlay };
  })();
  if (w) w.__pkbotApp = p;
  return p;
}
