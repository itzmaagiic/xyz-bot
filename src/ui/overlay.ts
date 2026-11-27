/** The in-game overlay – main control surface on both platforms. Shadow DOM keeps game CSS out. */
import type { BotController, BotView } from '../core/bot';
import type { WritableSetting } from '../core/bridge/protocol';
import type { LogEntry } from '../core/log/logger';
import type { BotSettings } from '../core/settings';
import type { Platform } from '../platform/types';
import { PAGE_SHORTCUTS } from '../platform/types';
import { buildSettingsForm } from './settings-form';
import { toast } from './toast';
import { downloadText } from './download';
import { exportFileName } from '../core/log/run-log';
import { noteRejection } from '../core/log/note';
import { isErrorKind, type PauseKind } from '../core/pause-reason';

/** German headline for a pause, by its kind (R-254): problems say so, wanted pauses don't */
function pauseHeadline(kind: PauseKind | null): string {
  switch (kind) {
    case 'user':
      return 'Von dir pausiert';
    case 'finished':
      return 'Run beendet';
    case 'config':
      return 'Einstellung passt nicht zum Spielstand';
    case 'unsupported':
      return 'Unbekannter Bildschirm – bitte selbst weiterklicken, dann Start';
    case null:
      return 'Pausiert';
    default:
      return 'Problem – der Bot hat angehalten. Details im Log.';
  }
}

const SVG = (body: string) =>
  `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">${body}</svg>`;
const ICON_PLAY = SVG('<path d="M4 2.5v11l9.5-5.5z" fill="currentColor"/>');
const ICON_PAUSE = SVG(
  '<rect x="3" y="2.5" width="3.5" height="11" rx="1" fill="currentColor"/>' +
    '<rect x="9.5" y="2.5" width="3.5" height="11" rx="1" fill="currentColor"/>',
);

/** the game's own option names in plain German (R-174) */
function gameSettingName(k: WritableSetting): string {
  const names: Partial<Record<WritableSetting, string>> = {
    autoSkipBattles: 'Kämpfe überspringen',
    autoSkipAllBattles: 'alle Kämpfe überspringen',
    autoSkipEvolve: 'Entwicklungen überspringen',
  };
  return names[k] ?? k;
}

function challengeTitle(s: BotSettings): string {
  return s.chalKind === 'daily' ? 'Tages-Challenge' : s.chalKind === 'weekly' ? 'Wochen-Challenge' : 'Arena-Challenge';
}

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
/* D-040 design: night-blue like the game's pixel sky, one accent = badge gold; state always in colour AND words */
.panel { --bg:#141a33; --surface:#1c2347; --line:#2f3a6b; --fg:#eef1fb; --muted:#a8b1d6; --gold:#f4c542;
  --gold-ink:#231a00; --run:#4ade80; --pause:#ffa94d; --bad:#ff8a8a;
  color-scheme: dark; position: fixed; left: 16px; bottom: 16px; z-index: 2147483645;
  width: min(340px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
  background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 12px;
  box-shadow: 0 8px 24px rgba(4,8,24,.55); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
header { display:flex; align-items:center; gap:8px; padding:8px 8px 8px 16px; cursor:move; user-select:none;
  touch-action:none; }
.dot { width:12px; height:12px; border-radius:3px; background:var(--muted); flex:none; }
.dot.running { background:var(--run); } .dot.paused { background:var(--pause); } .dot.problem { background:var(--bad); }
.who { flex:1; min-width:0; display:flex; flex-direction:column; }
#pk-status { font-size:18px; font-weight:700; line-height:1.2; }
.sub { font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
button, select, input { font: inherit; color: inherit; }
button { min-height:44px; min-width:44px; padding:8px 16px; border-radius:8px; border:1px solid var(--line);
  background: var(--surface); cursor:pointer; }
button.primary { background: var(--gold); border-color: var(--gold); color: var(--gold-ink); font-weight:700; flex:1; }
button.icon { padding:8px; background:transparent; border-color:transparent; font-size:18px; }
button:focus-visible, select:focus-visible, input:focus-visible, summary:focus-visible {
  outline:2px solid var(--gold); outline-offset:2px; }
.body { padding:0 16px 16px; display:flex; flex-direction:column; gap:12px; }
.row { display:flex; gap:8px; flex-wrap:wrap; }
.alert { border-radius:8px; padding:8px 12px; background: var(--surface); border-left:4px solid var(--pause); }
.alert.bad { border-left-color: var(--bad); }
.alert b { display:block; }
.alert .detail { font-size:12px; color: var(--muted); word-break: break-word; }
.run { background: var(--surface); border-radius:8px; padding:12px; display:flex; flex-direction:column; gap:8px; }
.run.empty { color: var(--muted); }
.run-head { display:flex; justify-content:space-between; gap:8px; font-weight:600; }
.run-head .relics { font-weight:400; font-size:12px; color: var(--muted); }
.track { display:grid; grid-template-columns: repeat(8, 1fr) 1.6fr; gap:4px; }
.pip { height:12px; border-radius:2px; background: var(--line); }
.pip.done { background: var(--gold); }
.pip.now { background: transparent; box-shadow: inset 0 0 0 2px var(--gold); }
.pip.league { border-radius:2px 6px 6px 2px; }
.odds { font-weight:700; }
.odds.good { color: var(--run); } .odds.mid { color: var(--gold); } .odds.low { color: var(--bad); }
.team { list-style:none; margin:0; padding:0; display:grid; grid-template-columns: 1fr auto 64px; gap:4px 8px;
  font-size:12px; align-items:center; }
.team li { display:contents; }
.hp { height:6px; border-radius:3px; background: var(--line); overflow:hidden; }
.hp i { display:block; height:100%; background: var(--run); }
.hp i.mid { background: var(--gold); } .hp i.low { background: var(--bad); }
.now { margin:0; word-break: break-word; }
.lbl { color: var(--muted); }
.kv { display:grid; grid-template-columns: auto 1fr; gap:4px 12px; font-size:12px; }
.kv span:nth-child(odd) { color:var(--muted); }
details { border-top:1px solid var(--line); padding-top:8px; }
summary { cursor:pointer; min-height:44px; display:flex; align-items:center; gap:12px; font-weight:600;
  list-style:none; }
summary::-webkit-details-marker { display:none; }
summary::before { content:''; width:8px; height:8px; flex:none; border-right:2px solid var(--muted);
  border-bottom:2px solid var(--muted); transform: rotate(-45deg); }
details[open] > summary::before { transform: rotate(45deg); }
button svg { vertical-align: -3px; margin-right: 8px; }
details.adv { margin-top:8px; }
details.adv summary { font-weight:400; color: var(--muted); }
.form .grid { display:grid; grid-template-columns: 1fr minmax(0, 1.2fr); gap:8px 12px; align-items:center; }
.form label.check { grid-column: 1 / -1; display:flex; align-items:center; gap:12px; min-height:44px; }
input[type=checkbox] { width:20px; height:20px; accent-color: var(--gold); }
select, input[type=number] { min-height:44px; width:100%; background: var(--bg); border:1px solid var(--line);
  border-radius:8px; padding:8px; }
select:disabled { opacity:.5; }
.log { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; max-height: 160px; overflow:auto;
  white-space:pre-wrap; color: var(--muted); }
.log .decision { color: var(--fg); } .log .warn { color: var(--pause); } .log .error { color: var(--bad); }
.hint { color: var(--muted); font-size: 12px; }
.collapsed { width:auto; }
.collapsed header { padding:8px; gap:8px; }
.collapsed #pk-toggle { flex:none; min-width:96px; }
@media (max-width: 520px) {
  .panel { left:8px; right:8px; width:auto; bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    max-height: 60vh; font-size:16px; }
  .panel.collapsed { right:auto; }
  .hint { display:none; }
}
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
    const moreOpen = (this.root.querySelector('details.morebox') as HTMLDetailsElement | null)?.open ?? false;
    const oldSet = this.root.querySelector('details.setbox') as HTMLDetailsElement | null;
    const setOpen = oldSet?.open ?? false;
    const setJson = JSON.stringify(v.settings);
    const p = this.panel;
    p.textContent = '';
    const collapsed = v.settings.overlayCollapsed;
    p.classList.toggle('collapsed', collapsed);
    const problem = v.status === 'paused' && isErrorKind(v.pauseKind);

    // header: state in words + colour, the challenge underneath, collapse
    const header = this.h('header');
    const dot = this.h('span', { class: `dot ${problem ? 'problem' : v.status}`, 'aria-hidden': 'true' });
    const who = this.h('div', { class: 'who' });
    who.append(
      this.h(
        'span',
        { id: 'pk-status' },
        v.status === 'running' ? 'Läuft' : v.status === 'paused' ? 'Pausiert' : 'Bereit',
      ),
    );
    if (!collapsed) who.append(this.h('span', { class: 'sub' }, v.run?.title ?? challengeTitle(v.settings)));
    header.append(dot, who);
    // icon as inline SVG, the text stays exactly "Start"/"Pause" (the live test reads it)
    const toggle = this.h('button', { id: 'pk-toggle', class: 'primary' });
    toggle.innerHTML = v.status === 'running' ? ICON_PAUSE : ICON_PLAY;
    toggle.appendChild(this.doc.createTextNode(v.status === 'running' ? 'Pause' : 'Start'));
    toggle.onclick = () => this.bot.toggle();
    if (collapsed) header.append(toggle);
    const collapse = this.h(
      'button',
      { id: 'pk-collapse', class: 'icon', 'aria-label': collapsed ? 'Overlay ausklappen' : 'Overlay einklappen' },
      collapsed ? '▴' : '▾',
    );
    collapse.onclick = () =>
      noteRejection('overlay:collapse', this.bot.updateSettings({ overlayCollapsed: !v.settings.overlayCollapsed }));
    header.append(collapse);
    this.makeDraggable(header);
    p.appendChild(header);
    if (collapsed) {
      if (focusedId) (this.root.getElementById(focusedId) as HTMLElement | null)?.focus();
      return;
    }

    const body = this.h('div', { class: 'body' });
    p.appendChild(body);

    // the one primary action, plus a single step
    const ctr = this.h('div', { class: 'row' });
    const step = this.h('button', { id: 'pk-step' }, 'Schritt');
    step.onclick = () => noteRejection('overlay:step', this.bot.step());
    ctr.append(toggle, step);
    body.appendChild(ctr);

    // what needs attention
    if (v.pauseReason && v.status !== 'running') body.appendChild(this.pauseBox(v));
    if (v.storageProblem)
      body.appendChild(this.h('div', { class: 'alert bad', id: 'pk-storage', role: 'status' }, v.storageProblem));
    if (v.versionWarning) {
      const w = this.h('div', { class: 'alert bad', id: 'pk-version' }, v.versionWarning + ' ');
      const ack = this.h('button', { id: 'pk-ack-version' }, 'Version bestätigen');
      ack.onclick = () => noteRejection('overlay:ack-version', this.bot.acknowledgeVersion());
      w.appendChild(ack);
      body.appendChild(w);
    }
    if (v.speedSuggestions.length) body.appendChild(this.speedBox(v.speedSuggestions));

    // the run: how far, who is next, how likely
    body.appendChild(this.runBox(v));
    const now = this.h('p', { class: 'now' });
    now.append(
      this.h('span', { class: 'lbl' }, 'Zuletzt: '),
      this.h('span', { id: 'pk-decision' }, v.lastDecision.replace(/^[a-zA-Z]+: /, '')),
    );
    body.appendChild(now);
    const kv = this.h('div', { class: 'kv' });
    kv.append(
      this.h('span', {}, 'Runs'),
      this.h('span', {}, `${v.stats.runs} · ${v.stats.wins} Siege · ${v.stats.losses} Niederlagen`),
    );
    body.appendChild(kv);

    // keep the settings block (and anything typed into it) unless the settings themselves changed
    body.appendChild(oldSet && this.lastSettingsJson === setJson ? oldSet : this.settingsBox(v.settings, setOpen));
    this.lastSettingsJson = setJson;

    // everything else: tools, technical details, log
    const more = this.h('details', { class: 'morebox' });
    more.open = moreOpen;
    more.appendChild(this.h('summary', {}, 'Mehr: Log, Export, Technik'));
    const tools = this.h('div', { class: 'row' });
    const copy = this.h('button', { id: 'pk-copy' }, 'Log kopieren');
    copy.onclick = () =>
      noteRejection(
        'overlay:copy',
        this.platform
          .copyText(this.bot.log.toText())
          .then((ok) => toast(ok ? 'Log kopiert' : 'Kopieren nicht möglich', 2500, this.doc)),
      );
    const exp = this.h('button', { id: 'pk-export-runs' }, 'Runs exportieren');
    exp.onclick = () => noteRejection('overlay:export-runs', this.exportRuns());
    tools.append(copy, exp);
    const tech = this.h('div', { class: 'kv' });
    tech.append(
      this.h('span', {}, 'Bildschirm'),
      this.h('span', { id: 'pk-screen' }, v.screen),
      this.h('span', {}, 'Daten'),
      this.h('span', { id: 'pk-bridge' }, v.bridge ? 'Spielzustand (Bridge)' : 'nur DOM (Fallback)'),
      this.h('span', {}, 'Version'),
      this.h('span', {}, v.version ? `Spiel v${v.version}` : 'Spiel ?'),
    );
    const log = this.h('div', { class: 'log', id: 'pk-log', role: 'log' });
    for (const e of this.bot.log.entries().slice(-60)) log.appendChild(this.logLine(e));
    more.append(
      tools,
      tech,
      log,
      this.h(
        'div',
        { class: 'hint' },
        `Tasten: ${PAGE_SHORTCUTS.toggle.label} Start/Pause · ${PAGE_SHORTCUTS.step.label} Schritt · ${PAGE_SHORTCUTS.toggleOverlay.label} Overlay`,
      ),
    );
    body.appendChild(more);
    if (focusedId) (this.root.getElementById(focusedId) as HTMLElement | null)?.focus();
  }

  /** Why the bot stopped: a German headline by kind (problem or not), the raw reason as detail (R-254, R-172). */
  private pauseBox(v: BotView): HTMLElement {
    const bad = isErrorKind(v.pauseKind);
    const box = this.h('div', {
      class: bad ? 'alert bad' : 'alert',
      id: 'pk-pause',
      role: 'status',
      ...(v.pauseKind ? { 'data-kind': v.pauseKind } : {}),
    });
    box.append(this.h('b', {}, pauseHeadline(v.pauseKind)), this.h('span', { class: 'detail' }, v.pauseReason ?? ''));
    return box;
  }

  private runBox(v: BotView): HTMLElement {
    const r = v.run;
    if (!r)
      return this.h(
        'div',
        { class: 'run empty' },
        'Noch kein Run. Start drücken – der Bot öffnet die Challenge und wählt den Starter selbst.',
      );
    const box = this.h('div', { class: 'run' });
    const head = this.h('div', { class: 'run-head' });
    head.append(
      this.h('span', {}, r.title),
      this.h('span', { class: 'relics' }, r.relics === 1 ? '1 Relikt' : `${r.relics} Relikte`),
    );
    box.appendChild(head);
    if (r.stage != null) {
      const track = this.h('div', {
        class: 'track',
        role: 'img',
        'aria-label': `Etappe ${r.stage + 1} von ${r.stages}`,
      });
      for (let i = 0; i < r.stages; i++) {
        const cls = ['pip', i < r.stage ? 'done' : i === r.stage ? 'now' : '', i === r.stages - 1 ? 'league' : '']
          .filter(Boolean)
          .join(' ');
        track.appendChild(this.h('span', { class: cls }));
      }
      box.appendChild(track);
    }
    const line = this.h('div', {});
    const parts: (string | HTMLElement)[] = [];
    if (r.stage != null) parts.push(`Etappe ${r.stage + 1} von ${r.stages}`);
    if (r.boss) parts.push(`Nächster Boss: ${r.boss}`);
    line.append(parts.join(' · '));
    if (r.odds != null) {
      const pct = Math.round(r.odds * 100);
      line.append(r.boss ? ' · Chance ' : 'Chance ');
      line.append(this.h('span', { class: `odds ${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'}` }, `${pct} %`));
    }
    box.appendChild(line);
    const team = this.h('ul', { class: 'team', 'aria-label': 'Team' });
    for (const m of r.team) {
      const li = this.h('li');
      const bar = this.h('span', { class: 'hp', 'aria-label': `KP ${Math.round(m.hp * 100)} %` });
      const fill = this.h('i', { class: m.hp >= 0.5 ? '' : m.hp >= 0.25 ? 'mid' : 'low' });
      fill.style.width = `${Math.round(m.hp * 100)}%`;
      bar.appendChild(fill);
      li.append(this.h('span', {}, m.name), this.h('span', { class: 'lbl' }, `Lv ${m.level}`), bar);
      team.appendChild(li);
    }
    box.appendChild(team);
    return box;
  }

  /** R-006: run logs as a file (D-005 export); where downloads are blocked, copy the JSON instead */
  private async exportRuns(): Promise<void> {
    const text = JSON.stringify(this.bot.runs.exportBundle());
    if (downloadText(this.doc, exportFileName(Date.now()), text)) {
      toast('Runs exportiert', 2500, this.doc);
      return;
    }
    const ok = await this.platform.copyText(text);
    toast(ok ? 'Runs kopiert' : 'Export nicht möglich', 2500, this.doc);
  }

  private speedBox(keys: WritableSetting[]): HTMLElement {
    const box = this.h('div', { class: 'alert', id: 'pk-speed' });
    if (this.confirmKeys) {
      box.append(
        this.h('div', {}, `Wirklich im Spiel einschalten: ${this.confirmKeys.map(gameSettingName).join(', ')}?`),
      );
      const row = this.h('div', { class: 'row' });
      const yes = this.h('button', { id: 'pk-speed-yes', class: 'primary' }, 'Ja, ändern');
      yes.onclick = () => {
        const k = this.confirmKeys ?? [];
        this.confirmKeys = null;
        noteRejection(
          'overlay:apply-game-settings',
          this.bot
            .applyGameSettings(k)
            .then((ok) => toast(ok ? 'Spieleinstellungen geändert' : 'Ändern fehlgeschlagen', 3000, this.doc)),
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
          `Tipp: Im Spiel ${keys.length > 1 ? 'sind' : 'ist'} ${keys.map(gameSettingName).join(', ')} aus. Eingeschaltet spielt der Bot schneller.`,
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
