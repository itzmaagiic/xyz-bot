/** The in-game overlay – main control surface on both platforms. Shadow DOM keeps game CSS out. */
import type { BotController, BotView } from '../core/bot';
import type { WritableSetting } from '../core/bridge/protocol';
import type { LogEntry } from '../core/log/logger';
import type { BotSettings } from '../core/settings';
import type { Platform } from '../platform/types';
import { PAGE_SHORTCUTS } from '../platform/types';
import { buildSettingsForm } from './settings-form';
import { toast } from './toast';
import { noteRejection } from '../core/log/note';

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.panel { position: fixed; left: 12px; bottom: 12px; z-index: 2147483645; width: min(330px, calc(100vw - 32px));
  max-height: calc(100vh - 24px); overflow: auto; background: var(--bg); color: var(--fg); border: 1px solid var(--line);
  border-radius: 10px; box-shadow: 0 6px 24px rgba(0,0,0,.4); font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; }
.panel { --bg:#151a28; --fg:#eef1fa; --muted:#9aa4c2; --line:#34405f; --acc:#38d6e6; --warn:#ffb347; --bad:#ff6b6b; --ok:#5be37d; }
@media (prefers-color-scheme: light) { .panel { --bg:#f7f8fc; --fg:#1b2133; --muted:#5b6585; --line:#c9d0e4; --acc:#0b8fa0; --warn:#b26a00; --bad:#c62828; --ok:#1b8a3a; } }
header { display:flex; align-items:center; gap:8px; padding:8px 10px; cursor:move; border-bottom:1px solid var(--line); user-select:none; touch-action:none; }
header b { flex:1; font-size:13px; }
.dot { width:10px; height:10px; border-radius:50%; background:var(--muted); }
.dot.running { background:var(--ok); } .dot.paused { background:var(--warn); }
button, select, input { font: inherit; color: inherit; }
button { background: transparent; border:1px solid var(--line); border-radius:6px; padding:6px 10px; cursor:pointer; min-height:32px; }
button.primary { background: var(--acc); color:#04121a; border-color: var(--acc); font-weight:600; }
button:focus-visible, select:focus-visible, input:focus-visible { outline:2px solid var(--acc); outline-offset:1px; }
.body { padding:8px 10px; display:flex; flex-direction:column; gap:8px; }
.row { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.kv { display:grid; grid-template-columns: auto 1fr; gap:2px 8px; }
.kv span:nth-child(odd) { color:var(--muted); }
.why { word-break: break-word; }
.warn { border:1px solid var(--warn); color:var(--fg); border-radius:6px; padding:6px 8px; }
.warn.bad { border-color: var(--bad); }
details { border-top:1px solid var(--line); padding-top:6px; }
summary { cursor:pointer; color:var(--muted); }
label { display:flex; align-items:center; gap:6px; }
select, input[type=number] { background: var(--bg); border:1px solid var(--line); border-radius:6px; padding:4px 6px; min-height:30px; }
input[type=number] { width: 80px; }
.grid { display:grid; grid-template-columns: 1fr 1fr; gap:6px; }
.log { font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; max-height: 160px; overflow:auto; white-space:pre-wrap; color: var(--muted); }
.log .decision { color: var(--fg); } .log .warn { color: var(--warn); border:0; padding:0; } .log .error { color: var(--bad); }
.hint { color: var(--muted); font-size: 11px; }
.collapsed .body { display:none; }
`;

export class Overlay {
  private root!: ShadowRoot;
  private panel!: HTMLElement;
  private confirmKeys: WritableSetting[] | null = null;
  private hidden = false;
  private lastSettingsJson = '';
  private host!: HTMLElement;

  constructor(
    private readonly bot: BotController,
    private readonly platform: Platform,
    private readonly doc: Document = document,
  ) {}

  mount(): void {
    this.host = this.doc.createElement('div');
    this.host.id = 'pkbot-root';
    this.doc.body.appendChild(this.host);
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = this.doc.createElement('style');
    style.textContent = CSS;
    this.root.appendChild(style);
    this.panel = this.doc.createElement('section');
    this.panel.className = 'panel';
    this.panel.setAttribute('aria-label', 'Pokelike bot');
    this.root.appendChild(this.panel);
    this.bot.onChange((v) => this.render(v));
    this.bot.log.subscribe((e) => this.appendLog(e));
  }

  toggleVisible(): void {
    this.hidden = !this.hidden;
    this.host.style.display = this.hidden ? 'none' : '';
  }

  private h<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {},
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const el = this.doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== undefined) el.textContent = text;
    return el;
  }

  private render(v: BotView): void {
    const focusedId = (this.root.activeElement as HTMLElement | null)?.id;
    const logOpen = (this.root.querySelector('details.logbox') as HTMLDetailsElement | null)?.open ?? false;
    const oldSet = this.root.querySelector('details.setbox') as HTMLDetailsElement | null;
    const setOpen = oldSet?.open ?? false;
    const setJson = JSON.stringify(v.settings);
    const p = this.panel;
    p.textContent = '';
    p.classList.toggle('collapsed', v.settings.overlayCollapsed);

    const header = this.h('header');
    const dot = this.h('span', { class: `dot ${v.status}`, 'aria-hidden': 'true' });
    const title = this.h(
      'b',
      {},
      `Pokelike Bot · ${v.status === 'running' ? 'läuft' : v.status === 'paused' ? 'pausiert' : 'bereit'}`,
    );
    const collapse = this.h(
      'button',
      { id: 'pk-collapse', 'aria-label': 'Ein-/ausklappen' },
      v.settings.overlayCollapsed ? '▢' : '–',
    );
    collapse.onclick = () =>
      noteRejection('overlay:collapse', this.bot.updateSettings({ overlayCollapsed: !v.settings.overlayCollapsed }));
    header.append(dot, title, collapse);
    this.makeDraggable(header);
    p.appendChild(header);

    const body = this.h('div', { class: 'body' });
    p.appendChild(body);

    const ctr = this.h('div', { class: 'row' });
    const start = this.h('button', { id: 'pk-toggle', class: 'primary' }, v.status === 'running' ? 'Pause' : 'Start');
    start.onclick = () => this.bot.toggle();
    const step = this.h('button', { id: 'pk-step' }, 'Schritt');
    step.onclick = () => noteRejection('overlay:step', this.bot.step());
    const copy = this.h('button', { id: 'pk-copy' }, 'Log kopieren');
    copy.onclick = async () =>
      toast(
        (await this.platform.copyText(this.bot.log.toText())) ? 'Log kopiert' : 'Kopieren nicht möglich',
        2500,
        this.doc,
      );
    ctr.append(start, step, copy);
    body.appendChild(ctr);

    if (v.pauseReason && v.status !== 'running')
      body.appendChild(this.h('div', { class: 'warn', id: 'pk-pause' }, `⏸ ${v.pauseReason}`));
    if (v.versionWarning) {
      const w = this.h('div', { class: 'warn bad', id: 'pk-version' }, v.versionWarning + ' ');
      const ack = this.h('button', { id: 'pk-ack-version' }, 'Version bestätigen');
      ack.onclick = () => noteRejection('overlay:ack-version', this.bot.acknowledgeVersion());
      w.appendChild(ack);
      body.appendChild(w);
    }
    if (v.speedSuggestions.length) body.appendChild(this.speedBox(v.speedSuggestions));

    const kv = this.h('div', { class: 'kv' });
    const add = (k: string, val: string, id?: string) => {
      kv.append(this.h('span', {}, k), this.h('span', id ? { id, class: 'why' } : { class: 'why' }, val));
    };
    add('Bildschirm', v.screen, 'pk-screen');
    add('Entscheidung', v.lastDecision, 'pk-decision');
    add('Daten', v.bridge ? 'Spielzustand (Bridge)' : 'nur DOM (Fallback)', 'pk-bridge');
    add('Version', v.version ? `v${v.version}` : '?');
    add('Runs', `${v.stats.runs} · ${v.stats.wins} Siege · ${v.stats.losses} Niederlagen`);
    body.appendChild(kv);

    // keep the settings block (and anything typed into it) unless the settings themselves changed
    body.appendChild(oldSet && this.lastSettingsJson === setJson ? oldSet : this.settingsBox(v.settings, setOpen));
    this.lastSettingsJson = setJson;

    const logBox = this.h('details', { class: 'logbox' });
    logBox.open = logOpen;
    logBox.appendChild(this.h('summary', {}, 'Log'));
    const log = this.h('div', { class: 'log', id: 'pk-log', role: 'log' });
    for (const e of this.bot.log.entries().slice(-60)) log.appendChild(this.logLine(e));
    logBox.appendChild(log);
    body.appendChild(logBox);
    body.appendChild(
      this.h(
        'div',
        { class: 'hint' },
        `Tasten: ${PAGE_SHORTCUTS.toggle.label} Start/Pause · ${PAGE_SHORTCUTS.step.label} Schritt · ${PAGE_SHORTCUTS.toggleOverlay.label} Overlay`,
      ),
    );
    if (focusedId) (this.root.getElementById(focusedId) as HTMLElement | null)?.focus();
  }

  private speedBox(keys: WritableSetting[]): HTMLElement {
    const box = this.h('div', { class: 'warn', id: 'pk-speed' });
    if (this.confirmKeys) {
      box.append(this.h('div', {}, `Wirklich diese Spieleinstellungen einschalten? ${this.confirmKeys.join(', ')}`));
      const row = this.h('div', { class: 'row' });
      const yes = this.h('button', { id: 'pk-speed-yes', class: 'primary' }, 'Ja, ändern');
      yes.onclick = async () => {
        const k = this.confirmKeys ?? [];
        this.confirmKeys = null;
        toast(
          (await this.bot.applyGameSettings(k)) ? 'Spieleinstellungen geändert' : 'Ändern fehlgeschlagen',
          3000,
          this.doc,
        );
      };
      const no = this.h('button', { id: 'pk-speed-no' }, 'Abbrechen');
      no.onclick = () => {
        this.confirmKeys = null;
        noteRejection('overlay:refresh', this.bot.refresh());
      };
      row.append(yes, no);
      box.appendChild(row);
    } else {
      box.append(
        this.h(
          'div',
          {},
          `Schneller spielen: Spieloptionen ${keys.join(', ')} sind aus. Der Bot ändert sie nur mit deiner Bestätigung.`,
        ),
      );
      const b = this.h('button', { id: 'pk-speed-ask' }, 'Einschalten …');
      b.onclick = () => {
        this.confirmKeys = keys;
        noteRejection('overlay:refresh', this.bot.refresh());
      };
      box.appendChild(b);
    }
    return box;
  }

  private settingsBox(s: BotSettings, open: boolean): HTMLElement {
    const d = this.h('details', { class: 'setbox' });
    d.open = open;
    d.appendChild(this.h('summary', {}, 'Einstellungen'));
    d.appendChild(
      buildSettingsForm(this.doc, s, (patch) => noteRejection('overlay:settings', this.bot.updateSettings(patch))),
    );
    return d;
  }

  private logLine(e: LogEntry): HTMLElement {
    const t = new Date(e.t).toLocaleTimeString();
    return this.h('div', { class: e.level }, `${t} ${e.msg}`);
  }

  private appendLog(e: LogEntry): void {
    const log = this.root?.getElementById('pk-log');
    if (!log) return;
    log.appendChild(this.logLine(e));
    while (log.childElementCount > 60) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  }

  private makeDraggable(handle: HTMLElement): void {
    handle.addEventListener('pointerdown', (ev) => {
      if ((ev.target as HTMLElement).closest('button')) return;
      const r = this.panel.getBoundingClientRect();
      const dx = ev.clientX - r.left;
      const dy = ev.clientY - r.top;
      const move = (e: PointerEvent) => {
        const view = this.doc.defaultView!;
        const x = Math.min(Math.max(0, e.clientX - dx), view.innerWidth - 60);
        const y = Math.min(Math.max(0, e.clientY - dy), view.innerHeight - 40);
        Object.assign(this.panel.style, { left: `${x}px`, top: `${y}px`, bottom: 'auto' });
      };
      const up = () => {
        this.doc.removeEventListener('pointermove', move);
        this.doc.removeEventListener('pointerup', up);
      };
      this.doc.addEventListener('pointermove', move);
      this.doc.addEventListener('pointerup', up);
    });
  }
}
