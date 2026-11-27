/**
 * Userscript storage (R-099, R-100, R-102, D-031).
 * Order per operation: GM.getValue/GM.setValue (the API intersection of Userscripts for iOS, Tampermonkey and
 * Violentmonkey) → localStorage under our own prefix `pkbot.` → memory. Values are stored as JSON strings.
 * The game's own keys (`poke_*`, `pkrl_*`) are never touched: every localStorage key is prefixed, and the game's
 * anti-tamper digest only covers `poke_*` keys (GAME_RECON §12.9).
 * No onChange: a userscript runs in one context per tab and the GM intersection has no change-listener API.
 */
import { noteError } from '../../core/log/note';
import type { PlatformStorage } from '../types';

export const LOCAL_PREFIX = 'pkbot.';

export interface StorageEnv {
  gm?: {
    getValue?: (key: string) => Promise<unknown>;
    setValue?: (key: string, value: string) => Promise<void>;
  } | null;
  local?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}

const WHERE = 'userscript/storage';

/** our own localStorage key; keys that already carry the prefix (e.g. `pkbot.settings`) are not prefixed twice */
const localKey = (key: string) => (key.startsWith(LOCAL_PREFIX) ? key : LOCAL_PREFIX + key);

/**
 * The GM storage if the caller detected GM.getValue/GM.setValue (detection stays in main.ts, where GM is used
 * literally so @grant can be derived), otherwise null – and the fallback is noted once (R-100, D-031).
 */
export function gmOrNote(detected: boolean, make: () => NonNullable<StorageEnv['gm']>): StorageEnv['gm'] {
  if (detected) return make();
  noteError(
    `${WHERE}:gm-missing`,
    'GM.getValue/GM.setValue not available – settings are kept in localStorage (pkbot.*)',
  );
  return null;
}

function parse<T>(raw: unknown, key: string): T | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string') return raw as T; // a manager that stored the value structurally
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    noteError(`${WHERE}:parse:${key}`, e);
    return undefined;
  }
}

export function makeStorage(env: StorageEnv): PlatformStorage {
  const { gm, local } = env;
  const mem = new Map<string, string>();

  // A `pkbot.` copy exists only while GM is missing or the last GM write failed (successful GM writes remove it),
  // so it is the newest value and wins over GM – otherwise a quota error would silently revert the user's change.
  async function readRaw(key: string): Promise<unknown> {
    if (local) {
      try {
        const v = local.getItem(localKey(key));
        if (v !== null) return v;
      } catch (e) {
        noteError(`${WHERE}:local-get`, e);
      }
    }
    if (gm?.getValue) {
      try {
        const v = await gm.getValue(key);
        if (v !== undefined) return v;
      } catch (e) {
        noteError(`${WHERE}:gm-get`, e);
      }
    }
    return mem.get(key);
  }

  return {
    async get<T>(key: string): Promise<T | undefined> {
      return parse<T>(await readRaw(key), key);
    },
    async set(key: string, value: unknown): Promise<void | 'volatile'> {
      const s = JSON.stringify(value);
      if (gm?.setValue) {
        try {
          await gm.setValue(key, s);
          if (local) {
            try {
              // drop the fallback copy of an earlier failed GM write – only if there is one
              if (local.getItem(localKey(key)) !== null) local.removeItem(localKey(key));
            } catch (e) {
              noteError(`${WHERE}:local-remove`, e);
            }
          }
          return;
        } catch (e) {
          noteError(`${WHERE}:gm-set`, e);
        }
      }
      if (local) {
        try {
          local.setItem(localKey(key), s);
          return;
        } catch (e) {
          noteError(`${WHERE}:local-set`, e);
        }
      }
      mem.set(key, s);
      return 'volatile'; // only in memory: the overlay tells the user (R-259)
    },
  };
}
