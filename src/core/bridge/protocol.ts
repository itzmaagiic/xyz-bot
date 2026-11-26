/** Wire protocol between the isolated world (bot) and the page's main world (bridge). */
export const REQ_EVENT = 'pkbot:request';
export const RES_EVENT = 'pkbot:response';
export const READY_ATTR = 'data-pkbot-bridge';
export const BRIDGE_VERSION = '1';

export type BridgeCommand =
  | 'ping'
  | 'snapshot'
  /** errors noted in the page's main world since a sequence number (R-253) */
  | 'errors'
  | 'saveSettings'
  | 'simulateBoss'
  | 'simulateNodes'
  | 'simulateCatch'
  | 'simulatePaths'
  | 'openBagItem'
  | 'speciesStats'
  | 'simulateRelics';

export interface BridgeRequest {
  id: number;
  cmd: BridgeCommand;
  args?: Record<string, unknown>;
}

export interface BridgeResponse {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

/** Only these game settings may ever be changed by the bot (and only after user confirmation). */
export const WRITABLE_SETTINGS = [
  'autoSkipBattles',
  'autoSkipAllBattles',
  'autoSkipEvolve',
  'skipTraitFx',
  'darkMode',
  'hideBossPreview',
  'showShortcuts',
] as const;
export type WritableSetting = (typeof WRITABLE_SETTINGS)[number];
