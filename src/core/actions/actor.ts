/** Actor: performs human-like DOM input. It does not decide anything and never touches game variables. */

export type Rng = () => number;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Delay randomised ±40 % around `base`. */
export function humanDelay(base: number, rng: Rng = Math.random): number {
  return Math.round(base * (0.6 + 0.8 * rng()));
}

function point(el: Element, rng: Rng): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  // stay in the inner 50 % of the element
  const x = r.left + r.width * (0.25 + 0.5 * rng());
  const y = r.top + r.height * (0.25 + 0.5 * rng());
  return { x: Math.round(x), y: Math.round(y) };
}

function fire(el: Element, type: string, x: number, y: number, extra: Partial<PointerEventInit> = {}) {
  const view = el.ownerDocument.defaultView ?? window;
  const base: MouseEventInit = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, view };
  const isPointer = type.startsWith('pointer');
  const Ctor: typeof MouseEvent = isPointer && typeof view.PointerEvent === 'function' ? view.PointerEvent : view.MouseEvent;
  const init = isPointer ? { pointerId: 1, pointerType: 'mouse', isPrimary: true, ...base, ...extra } : { ...base, ...extra };
  el.dispatchEvent(new Ctor(type, init));
}

export function resolve(doc: Document, selector: string, index = 0): Element | null {
  try {
    return doc.querySelectorAll(selector)[index] ?? null;
  } catch {
    return null;
  }
}

export interface ActorOptions {
  rng?: Rng;
  /** short pauses inside one gesture */
  microDelay?: number;
}

export class Actor {
  private rng: Rng;
  private micro: number;

  constructor(opts: ActorOptions = {}) {
    this.rng = opts.rng ?? Math.random;
    this.micro = opts.microDelay ?? 40;
  }

  async click(el: Element): Promise<void> {
    if ((el as HTMLElement).scrollIntoView && !inViewport(el)) {
      (el as HTMLElement).scrollIntoView({ block: 'center', inline: 'center' });
      await sleep(120);
    }
    const { x, y } = point(el, this.rng);
    const target = topmostAt(el, x, y);
    fire(target, 'pointerover', x, y);
    fire(target, 'mouseover', x, y);
    fire(target, 'pointermove', x, y);
    fire(target, 'mousemove', x, y);
    await sleep(humanDelay(this.micro, this.rng));
    fire(target, 'pointerdown', x, y, { buttons: 1 });
    fire(target, 'mousedown', x, y, { buttons: 1 });
    if ((target as HTMLElement).focus) (target as HTMLElement).focus({ preventScroll: true });
    await sleep(humanDelay(this.micro * 2, this.rng));
    fire(target, 'pointerup', x, y);
    fire(target, 'mouseup', x, y);
    fire(target, 'click', x, y);
  }

  /** Key press like a hardware keyboard: keydown → keyup on the focused element (or body). */
  async pressKey(doc: Document, code: string, key: string, mods: { shift?: boolean; alt?: boolean } = {}): Promise<void> {
    const target = (doc.activeElement && doc.activeElement !== doc.documentElement ? doc.activeElement : doc.body) as Element;
    const view = doc.defaultView ?? window;
    const init: KeyboardEventInit = { code, key, bubbles: true, cancelable: true, composed: true, shiftKey: !!mods.shift, altKey: !!mods.alt, view };
    target.dispatchEvent(new view.KeyboardEvent('keydown', init));
    await sleep(humanDelay(this.micro * 2, this.rng));
    target.dispatchEvent(new view.KeyboardEvent('keyup', init));
  }

  /** Pointer drag from one element to another in small steps. */
  async drag(from: Element, to: Element, steps = 8): Promise<void> {
    const a = point(from, this.rng);
    const b = point(to, this.rng);
    fire(from, 'pointerdown', a.x, a.y, { buttons: 1 });
    fire(from, 'mousedown', a.x, a.y, { buttons: 1 });
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(a.x + ((b.x - a.x) * i) / steps);
      const y = Math.round(a.y + ((b.y - a.y) * i) / steps);
      const over = from.ownerDocument.elementFromPoint?.(x, y) ?? to;
      fire(over, 'pointermove', x, y, { buttons: 1 });
      fire(over, 'mousemove', x, y, { buttons: 1 });
      await sleep(humanDelay(this.micro / 2, this.rng));
    }
    const end = from.ownerDocument.elementFromPoint?.(b.x, b.y) ?? to;
    fire(end, 'pointerup', b.x, b.y);
    fire(end, 'mouseup', b.x, b.y);
  }
}

function inViewport(el: Element): boolean {
  const r = el.getBoundingClientRect();
  const view = el.ownerDocument.defaultView;
  if (!view || (r.width === 0 && r.height === 0)) return true; // headless test DOMs have no layout
  return r.bottom > 0 && r.right > 0 && r.top < view.innerHeight && r.left < view.innerWidth;
}

/** Prefer the element itself or its descendant actually under the cursor (like a real click). */
function topmostAt(el: Element, x: number, y: number): Element {
  const hit = el.ownerDocument.elementFromPoint?.(x, y);
  return hit && (hit === el || el.contains(hit)) ? hit : el;
}
