/** Settings form shared by the in-game overlay and the Chrome options page. */
import type { BotSettings } from '../core/settings';
import { readPcRoster } from '../core/strategy/challenge';
import { noteError } from '../core/log/note';

export function buildSettingsForm(
  doc: Document,
  s: BotSettings,
  onChange: (patch: Partial<BotSettings>) => void,
): HTMLElement {
  // D-040: only what a challenge needs in front; everything else under "Erweitert" (collapsed). Story-only fields
  // (mode, variant, region, character) are gone from the form – the mode is fixed to challenge.
  const root = doc.createElement('div');
  root.className = 'form';
  const main = doc.createElement('div');
  main.className = 'grid';
  const advBox = doc.createElement('details');
  advBox.className = 'adv';
  const advSum = doc.createElement('summary');
  advSum.textContent = 'Erweitert';
  const adv = doc.createElement('div');
  adv.className = 'grid';
  advBox.append(advSum, adv);
  root.append(main, advBox);
  let g = main;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string>, text?: string) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const sel = (
    id: string,
    label: string,
    value: string,
    opts: [string, string][],
    on: (v: string) => Partial<BotSettings>,
  ): HTMLSelectElement => {
    const e = el('select', { id });
    for (const [v, t] of opts) {
      const o = el('option', { value: v }, t);
      if (v === value) o.selected = true;
      e.appendChild(o);
    }
    e.onchange = () => onChange(on(e.value));
    g.append(el('label', { for: id }, label), e);
    return e;
  };
  const chk = (id: string, label: string, value: boolean, key: keyof BotSettings) => {
    const l = el('label', { class: 'check' });
    const e = el('input', { id, type: 'checkbox' });
    e.checked = value;
    e.onchange = () => onChange({ [key]: e.checked } as Partial<BotSettings>);
    l.append(e, doc.createTextNode(label));
    g.appendChild(l);
  };
  const num = (
    id: string,
    label: string,
    value: number,
    key: keyof BotSettings,
    min: number,
    max: number,
    step: number,
  ) => {
    const e = el('input', {
      id,
      type: 'number',
      inputmode: 'numeric',
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value),
    });
    e.onchange = () => onChange({ [key]: Number(e.value) } as Partial<BotSettings>);
    g.append(el('label', { for: id }, label), e);
  };

  // --- in front: the challenge ---
  sel(
    'pk-chalkind',
    'Challenge',
    s.chalKind,
    [
      ['arena', 'Arena-Challenge'],
      ['daily', 'Tages-Challenge'],
      ['weekly', 'Wochen-Challenge'],
    ],
    (v) => ({ chalKind: v as BotSettings['chalKind'] }),
  );
  const level = sel(
    'pk-challevel',
    'Orden-Stufe',
    s.chalLevel == null ? 'auto' : String(s.chalLevel),
    [
      ['auto', 'Automatisch'],
      ...Array.from({ length: 8 }, (_, i) => [String(i), `Stufe ${i + 1}`] as [string, string]),
    ],
    (v) => ({ chalLevel: v === 'auto' ? null : Number(v) }),
  );
  level.disabled = s.chalKind !== 'arena'; // only the arena challenge has badge levels
  // Starter from the PC: the list is read (never written) from the game's save when the form lives on the game page;
  // the Chrome options page has no access to it and falls back to a dex number.
  let roster: ReturnType<typeof readPcRoster> = [];
  try {
    const ls = doc.defaultView?.localStorage;
    if (ls) roster = readPcRoster((k) => ls.getItem(k));
  } catch (e) {
    noteError('settings-form:roster', e); // storage blocked → dex-number input instead of the PC list
    roster = [];
  }
  if (roster.length) {
    const opts: [string, string][] = [['auto', 'Stärkster (automatisch)']];
    if (s.chalStarter != null && !roster.some((r) => r.id === s.chalStarter))
      opts.push([String(s.chalStarter), `#${s.chalStarter}`]);
    for (const r of roster)
      opts.push([String(r.id), `${r.name}${r.shiny ? ' ★' : ''}${r.aurora ? ' ✦' : ''} (BST ${r.bst || '?'})`]);
    sel('pk-chalstarter', 'Starter', s.chalStarter == null ? 'auto' : String(s.chalStarter), opts, (v) => ({
      chalStarter: v === 'auto' ? null : Number(v),
    }));
  } else {
    const e = el('input', {
      id: 'pk-chalstarter',
      type: 'number',
      inputmode: 'numeric',
      min: '0',
      max: '1100',
      step: '1',
      placeholder: 'leer = stärkster',
      value: s.chalStarter == null ? '' : String(s.chalStarter),
    });
    e.onchange = () => onChange({ chalStarter: Number(e.value) > 0 ? Number(e.value) : null });
    g.append(el('label', { for: 'pk-chalstarter' }, 'Starter (Dex-Nr.)'), e);
  }
  chk('pk-restart', 'Danach neuen Run starten', s.autoRestart, 'autoRestart');
  num('pk-maxruns', 'Anhalten nach … Runs (0 = nie)', s.maxRuns, 'maxRuns', 0, 999, 1);

  // --- "Erweitert": rarely needed ---
  g = adv;
  num('pk-delay', 'Pause zwischen Aktionen (ms)', s.actionDelayMs, 'actionDelayMs', 150, 5000, 50);
  num('pk-watchdog', 'Hänger erkennen nach (s)', s.watchdogSec, 'watchdogSec', 15, 600, 5);
  chk('pk-resume', 'Angefangenen Run fortsetzen', s.resumeRuns, 'resumeRuns');
  chk('pk-reorder', 'Team-Reihenfolge anpassen', s.reorderTeam, 'reorderTeam');
  chk('pk-shiny', 'Shinys mitnehmen', s.takeShiny, 'takeShiny');
  chk('pk-notify', 'Benachrichtigungen', s.notifications, 'notifications');
  return root;
}
