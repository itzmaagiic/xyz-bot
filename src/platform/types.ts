/** Thin platform layer – everything else is shared. */
export interface PlatformStorage {
  get<T>(key: string): Promise<T | undefined>;
  /** 'volatile': the value could only be kept in memory and is lost on reload (R-259) */
  set(key: string, value: unknown): Promise<void | 'volatile'>;
  /** called when another context (popup/options/other tab) changed the key */
  onChange?(key: string, cb: (value: unknown) => void): void;
}

export interface ShortcutHandlers {
  toggle(): void;
  step(): void;
  toggleOverlay(): void;
}

export interface Platform {
  readonly name: 'chrome' | 'userscript';
  storage: PlatformStorage;
  copyText(text: string): Promise<boolean>;
  /** system notification where available; returns false if the caller should show an in-page toast instead */
  notify(title: string, body: string): Promise<boolean>;
  registerShortcuts(h: ShortcutHandlers): void;
  /** makes sure the main-world bridge is installed; resolves false if it cannot be (→ DOM fallback) */
  ensureBridge(): Promise<boolean>;
}

/** Default in-page keyboard shortcuts (both platforms; Chrome additionally maps `commands`). */
export const PAGE_SHORTCUTS = {
  toggle: { key: 'P', alt: true, shift: true, label: 'Alt+Shift+P' },
  step: { key: 'S', alt: true, shift: true, label: 'Alt+Shift+S' },
  toggleOverlay: { key: 'O', alt: true, shift: true, label: 'Alt+Shift+O' },
} as const;

export function bindPageShortcuts(h: ShortcutHandlers, target: Window = window): void {
  target.addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toUpperCase();
      const code = e.code; // Alt+Shift changes e.key on macOS – also accept the physical key
      const is = (letter: string) => k === letter || code === `Key${letter}`;
      if (is(PAGE_SHORTCUTS.toggle.key)) h.toggle();
      else if (is(PAGE_SHORTCUTS.step.key)) h.step();
      else if (is(PAGE_SHORTCUTS.toggleOverlay.key)) h.toggleOverlay();
      else return;
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );
}
