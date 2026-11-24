/** Settings form shared by the in-game overlay and the Chrome options page. */
import type { BotSettings } from '../core/settings';

export const REGIONS = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos'];

export function buildSettingsForm(doc: Document, s: BotSettings, onChange: (patch: Partial<BotSettings>) => void): HTMLElement {
  const g = doc.createElement('div');
  g.className = 'grid';
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string>, text?: string) => {
    const e = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const sel = (id: string, label: string, value: string, opts: [string, string][], on: (v: string) => Partial<BotSettings>) => {
    const e = el('select', { id });
    for (const [v, t] of opts) {
      const o = el('option', { value: v }, t);
      if (v === value) o.selected = true;
      e.appendChild(o);
    }
    e.onchange = () => onChange(on(e.value));
    g.append(el('label', { for: id }, label), e);
  };
  const chk = (id: string, label: string, value: boolean, key: keyof BotSettings) => {
    const l = el('label', {});
    const e = el('input', { id, type: 'checkbox' });
    e.checked = value;
    e.onchange = () => onChange({ [key]: e.checked } as Partial<BotSettings>);
    l.append(e, doc.createTextNode(label));
    g.appendChild(l);
  };
  const num = (id: string, label: string, value: number, key: keyof BotSettings, min: number, max: number, step: number) => {
    const e = el('input', { id, type: 'number', min: String(min), max: String(max), step: String(step), value: String(value) });
    e.onchange = () => onChange({ [key]: Number(e.value) } as Partial<BotSettings>);
    g.append(el('label', { for: id }, label), e);
  };
  sel('pk-mode', 'Modus', s.mode, [['story', 'Story'], ['tower', 'Battle Tower (exp.)']], (v) => ({ mode: v as BotSettings['mode'] }));
  sel('pk-variant', 'Variante', s.storyVariant, [['classic', 'Classic'], ['nuzlocke', 'Nuzlocke']], (v) => ({
    storyVariant: v as BotSettings['storyVariant'],
  }));
  sel('pk-region', 'Region', String(s.region), REGIONS.map((r, i) => [String(i + 1), r]), (v) => ({ region: Number(v) }));
  sel('pk-trainer', 'Charakter', s.trainer, [['boy', 'Junge'], ['girl', 'Mädchen']], (v) => ({ trainer: v as BotSettings['trainer'] }));
  num('pk-delay', 'Tempo (ms)', s.actionDelayMs, 'actionDelayMs', 150, 5000, 50);
  num('pk-maxruns', 'Max. Runs (0=∞)', s.maxRuns, 'maxRuns', 0, 999, 1);
  chk('pk-resume', 'Runs fortsetzen', s.resumeRuns, 'resumeRuns');
  chk('pk-restart', 'Auto-Neustart', s.autoRestart, 'autoRestart');
  chk('pk-shiny', 'Shinys nehmen', s.takeShiny, 'takeShiny');
  chk('pk-reorder', 'Reihenfolge optimieren', s.reorderTeam, 'reorderTeam');
  chk('pk-notify', 'Benachrichtigungen', s.notifications, 'notifications');
  return g;
}
