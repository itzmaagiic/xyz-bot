/**
 * ScreenDetector: maps the live DOM to a ScreenInfo. Uses only ids/classes/data attributes – never translated text.
 * Rule: anything not recognised yields kind 'unknown' (screen) or overlay 'unknown-modal'; the bot pauses on both.
 */
import type { OverlayKind, ScreenInfo, ScreenKind } from '../types';

export const SCREEN_IDS: Record<string, ScreenKind> = {
  'title-screen': 'title',
  'history-region-select': 'region-select',
  'endless-stage-select': 'tower-select',
  'trainer-screen': 'trainer',
  'starter-screen': 'starter',
  'map-screen': 'map',
  'battle-screen': 'battle',
  'catch-screen': 'catch',
  'item-screen': 'item',
  'passive-screen': 'passive',
  'swap-screen': 'swap',
  'trade-screen': 'trade',
  'shiny-screen': 'shiny',
  'badge-screen': 'badge',
  'transition-screen': 'transition',
  'elite-prep-screen': 'elite-prep',
  'gameover-screen': 'gameover',
  'win-screen': 'win',
  'stat-buff-screen': 'stat-buff',
  'endless-stage-complete': 'stage-complete',
};

/** Fixed-position UI that never blocks the game flow. */
const HARMLESS = new Set([
  'team-hover-card',
  'map-node-tooltip',
  'battle-weather-overlay',
  'achx-banner',
  'dk-banner',
  'overtime-banner',
  'crit-popup',
  'dmg-popup',
  'stat-change-popup',
  'perf-rig-overlay',
  'pkbot-root',
]);

/** Known blocking overlays → kind. */
const KNOWN_OVERLAYS: { match: (el: Element) => boolean; kind: Exclude<OverlayKind, null> }[] = [
  { match: (el) => el.id === 'tutorial-overlay', kind: 'tutorial' },
  { match: (el) => el.id === 'item-equip-modal' && !!el.querySelector('[data-tutor]'), kind: 'move-tutor' },
  { match: (el) => el.id === 'item-equip-modal', kind: 'item-equip' },
  { match: (el) => el.id === 'evo-overlay' || el.id === 'eevee-choice-overlay', kind: 'evolution' },
  { match: (el) => el.id === 'misclick-confirm-modal', kind: 'misclick-confirm' },
];

const OVERLAY_LIKE = /(modal|overlay|dialog|popup|qc-cmp|cmp-container)/i;

export function isShown(el: Element | null | undefined): el is HTMLElement {
  if (!el || !(el as HTMLElement).isConnected) return false;
  const h = el as HTMLElement;
  if (h.hidden) return false;
  if (h.style?.display === 'none' || h.style?.visibility === 'hidden') return false;
  const view = h.ownerDocument?.defaultView;
  if (view?.getComputedStyle) {
    const cs = view.getComputedStyle(h);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  // a parent with display:none hides us as well
  let p = h.parentElement;
  while (p && p !== h.ownerDocument.body) {
    if (p.style?.display === 'none') return false;
    p = p.parentElement;
  }
  return true;
}

function overlayName(el: Element): string {
  return el.id || String(el.className || el.tagName).split(' ')[0] || el.tagName;
}

/** Finds a blocking overlay among direct body children (and known ids anywhere). */
export function detectOverlay(doc: Document): { kind: OverlayKind; id: string | null } {
  if (isShown(doc.getElementById('poke-maint-overlay')) && doc.documentElement.classList.contains('poke-maint-on')) {
    return { kind: 'unknown-modal', id: 'poke-maint-overlay' };
  }
  const candidates: Element[] = [];
  for (const el of Array.from(doc.body?.children ?? [])) {
    if (el.classList.contains('screen') || HARMLESS.has(el.id)) continue;
    const name = `${el.id} ${typeof el.className === 'string' ? el.className : ''} ${el.getAttribute('role') ?? ''}`;
    if (!OVERLAY_LIKE.test(name)) continue;
    if (el.id === 'poke-maint-overlay') continue;
    if (!isShown(el)) continue;
    candidates.push(el);
  }
  for (const id of ['tutorial-overlay', 'item-equip-modal', 'evo-overlay', 'eevee-choice-overlay', 'misclick-confirm-modal']) {
    const el = doc.getElementById(id);
    if (el && isShown(el) && !candidates.includes(el)) candidates.push(el);
  }
  // static overlays without visible content (empty containers) do not block
  const blocking = candidates.filter((el) => el.children.length > 0);
  if (!blocking.length) return { kind: null, id: null };
  const el = blocking[blocking.length - 1]!; // last in DOM order is on top for equal z-index
  for (const k of KNOWN_OVERLAYS) if (k.match(el)) return { kind: k.kind, id: overlayName(el) };
  return { kind: 'unknown-modal', id: overlayName(el) };
}

export function activeScreenElement(doc: Document): HTMLElement | null {
  const act = Array.from(doc.querySelectorAll<HTMLElement>('.screen.active'));
  return act.length === 1 ? act[0]! : null;
}

function extraSignature(doc: Document, kind: ScreenKind, scr: HTMLElement | null): string {
  if (!scr) return '';
  switch (kind) {
    case 'map':
      return Array.from(scr.querySelectorAll('.map-node--clickable'))
        .map((e) => (e as HTMLElement).dataset.nodeId ?? (e.getAttribute('data-node-id') || ''))
        .join(',');
    case 'battle':
      return [
        isShown(doc.getElementById('btn-auto-battle')) ? 'skip' : '',
        isShown(doc.getElementById('btn-continue-battle')) ? 'cont' : '',
      ].join('');
    default:
      return String(scr.querySelectorAll('.poke-card,.item-card,button').length);
  }
}

export function detectScreen(doc: Document = document): ScreenInfo {
  const scr = activeScreenElement(doc);
  const screenId = scr?.id ?? null;
  const kind: ScreenKind = (screenId && SCREEN_IDS[screenId]) || 'unknown';
  const ov = detectOverlay(doc);
  const signature = `${screenId ?? '-'}|${ov.id ?? '-'}|${extraSignature(doc, kind, scr)}`;
  return { kind, screenId, overlay: ov.kind, overlayId: ov.id, signature };
}
