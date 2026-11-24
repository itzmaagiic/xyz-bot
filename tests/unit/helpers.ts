import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Window } from 'happy-dom';
import type { Mon } from '../../src/core/types';

/** Loads a real DOM snapshot (scripts stripped) into an isolated happy-dom document. */
export function loadFixture(name: string): Document {
  const html = readFileSync(join(__dirname, '..', 'fixtures', 'dom', `${name}.html`), 'utf8');
  const win = new Window({
    url: 'https://pokelike.xyz/',
    settings: { disableJavaScriptEvaluation: true, disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
  });
  win.document.write(html);
  return win.document as unknown as Document;
}

export function mon(p: Partial<Mon> & { speciesId: number }): Mon {
  return {
    name: `#${p.speciesId}`,
    level: 10,
    currentHp: 30,
    maxHp: 30,
    isShiny: false,
    types: ['Normal'],
    baseStats: { hp: 50, atk: 50, def: 50, speed: 50, special: 50, spdef: 50 },
    heldItem: null,
    moveTier: 0,
    move: null,
    ...p,
  };
}
