/**
 * DecisionEngine: GameState + DOM (read-only) + settings → exactly one Decision.
 * Never guesses: unrecognised screens/modals or inconsistent data → { kind: 'pause' }.
 */
import { bossTypesFor } from '../data/bosses';
import type { BotSettings } from '../settings';
import { isShown } from '../screens/detector';
import { itemIdFromCard, parsePokeCard, readCards, readClickableMapNodes } from '../state/dom-reader';
import type { Decision, GameState, Mon, RunState } from '../types';
import {
  chooseCatch,
  chooseHolder,
  chooseItem,
  chooseRelease,
  chooseStarter,
  leadSwap,
  nextBossTypes,
  teamWeakness,
} from './choices';
import { hpRatio, monScore } from './evaluate';
import { chooseRoute, xpNeed } from './map';
import { chooseCatchSim, chooseRouteSim, starSwaps } from './sim-route';
import { chooseBagUse, chooseEquipHolder, chooseUsableTarget } from './items';
import { normalizeItemId } from './choices';

export interface EngineMemory {
  /** signature on which a team reorder was already attempted (avoid loops) */
  reorderTried: Set<string>;
  /** signature of the end screen whose result was already reported */
  endReported: string | null;
  /** consecutive failed reorders – after 2 the bot stops trying for this run */
  reorderFailures: number;
  /** bag item the bot just opened */
  pendingBag: { index: number; itemId: string } | null;
  /** "itemId|bagIndex" with no valid target on this map */
  bagBlocked: Set<string>;
  /** map index the blocked list belongs to */
  bagMap: number;
}

export function newMemory(): EngineMemory {
  return {
    reorderTried: new Set(),
    endReported: null,
    reorderFailures: 0,
    pendingBag: null,
    bagBlocked: new Set(),
    bagMap: -1,
  };
}

const shown = (doc: Document, sel: string) => isShown(doc.querySelector(sel));
const pct = (x: number) => `${Math.round(x * 100)} %`;

/** True when bridge data and DOM cards describe the same species in the same order. */
export function sameSpecies(a: readonly Mon[], b: readonly Mon[]): boolean {
  return a.length === b.length && a.every((m, i) => m.speciesId === b[i]!.speciesId);
}

function vsTypes(run: RunState | null): string[] {
  if (!run || run.mode !== 'story') return [];
  return nextBossTypes(run.gen, run.badges, run.eliteIndex);
}

export function decide(state: GameState, doc: Document, s: BotSettings, mem: EngineMemory): Decision {
  const { screen, run } = state;

  // ---- blocking overlays first -------------------------------------------------------------
  if (screen.overlay) {
    switch (screen.overlay) {
      case 'tutorial':
        return { kind: 'click', selector: '#tutorial-overlay', why: 'dismiss tutorial hint' };
      case 'move-tutor':
      case 'item-equip':
        return decideEquip(doc, run, screen.overlay);
      case 'usable-item':
        return decideUsable(doc, run, mem);
      case 'evolution':
        return decideEvolution(doc, run);
      default:
        return { kind: 'pause', why: `unrecognised dialog "${screen.overlayId}" – please handle it manually` };
    }
  }

  switch (screen.kind) {
    case 'title': {
      if (s.mode === 'story') {
        if (s.resumeRuns && shown(doc, '#btn-continue-run'))
          return { kind: 'click', selector: '#btn-continue-run', why: 'resume story run' };
        return { kind: 'click', selector: '#btn-history-run', why: 'start story' };
      }
      if (s.resumeRuns && shown(doc, '#btn-continue-endless'))
        return { kind: 'click', selector: '#btn-continue-endless', why: 'resume tower run' };
      return { kind: 'click', selector: '#btn-endless-run', why: 'enter battle tower' };
    }
    case 'region-select': {
      const variantBtn = s.storyVariant === 'nuzlocke' ? '#btn-history-nuzlocke' : '#btn-history-classic';
      const vb = doc.querySelector(variantBtn);
      if (vb && !/--selected/.test(vb.className))
        return { kind: 'click', selector: variantBtn, why: `select ${s.storyVariant}` };
      const regions = Array.from(doc.querySelectorAll('#history-region-select .history-region-btn'));
      const r = regions[s.region - 1];
      if (!r) return { kind: 'pause', why: `region ${s.region} not found` };
      if (r.classList.contains('history-region-btn--locked'))
        return { kind: 'pause', why: `region ${s.region} is locked in your save` };
      return {
        kind: 'click',
        selector: '#history-region-select .history-region-btn',
        index: s.region - 1,
        why: `start region ${s.region}`,
      };
    }
    case 'tower-select': {
      const regions = Array.from(doc.querySelectorAll('#endless-stage-select .history-region-btn'));
      const r = regions[s.region - 1];
      if (!r || r.classList.contains('history-region-btn--locked'))
        return { kind: 'pause', why: `tower region ${s.region} unavailable` };
      return {
        kind: 'click',
        selector: '#endless-stage-select .history-region-btn',
        index: s.region - 1,
        why: `tower region ${s.region}`,
      };
    }
    case 'trainer':
      mem.reorderFailures = 0;
      mem.reorderTried.clear();
      return {
        kind: 'click',
        selector: s.trainer === 'girl' ? '#trainer-girl' : '#trainer-boy',
        why: `trainer ${s.trainer}`,
      };
    case 'starter': {
      const cards = readCards(doc, '#starter-choices .poke-card');
      if (!cards.length) return { kind: 'wait', ms: 500, why: 'starters loading' };
      const gen = state.run?.gen && state.run.gen > 1 ? state.run.gen : s.region;
      const early = s.mode === 'story' ? [bossTypesFor(gen, 0), bossTypesFor(gen, 1)].filter((t) => t.length) : [];
      const c = chooseStarter(cards, s.preferredStarter, early);
      return { kind: 'click', selector: '#starter-choices .poke-card', index: c.index, why: c.why };
    }
    case 'map':
      return decideMap(state, doc, s, mem);
    case 'battle': {
      if (shown(doc, '#btn-continue-battle'))
        return { kind: 'click', selector: '#btn-continue-battle', why: 'battle finished – continue' };
      if (shown(doc, '#btn-auto-battle'))
        return { kind: 'click', selector: '#btn-auto-battle', why: 'skip battle animation' };
      return { kind: 'wait', ms: 700, why: 'battle running' };
    }
    case 'catch':
      return decideCatch(state, doc);
    case 'swap':
      return decideSwap(state, doc);
    case 'item': {
      const cards = Array.from(doc.querySelectorAll('#item-choices .item-card'));
      if (!cards.length) return { kind: 'wait', ms: 500, why: 'items loading' };
      const c = chooseItem(cards.map(itemIdFromCard), run?.team ?? []);
      if (c.index < 0) return { kind: 'click', selector: '#btn-skip-item', why: c.why };
      return { kind: 'click', selector: '#item-choices .item-card', index: c.index, why: c.why };
    }
    case 'shiny':
      return s.takeShiny
        ? { kind: 'click', selector: '#btn-take-shiny', why: 'take the shiny (2 trait points)' }
        : { kind: 'click', selector: '#btn-skip-shiny', why: 'shiny disabled in settings' };
    case 'trade':
      if (shown(doc, '#btn-trade-continue'))
        return { kind: 'click', selector: '#btn-trade-continue', why: 'trade finished' };
      return { kind: 'click', selector: '#btn-skip-trade', why: 'decline mystery trade (risky)' };
    case 'badge':
      return { kind: 'click', selector: '#btn-next-map', why: 'badge earned – next map' };
    case 'elite-prep': {
      const os = state.orderSim;
      if (s.reorderTeam && os?.length && run) {
        const ident = run.team.map((_, i) => i).join(',');
        const cur = os.find((o) => o.order.join(',') === ident);
        const best = [...os].sort((a, b) => b.winRate - a.winRate || b.avgAlive - a.avgAlive)[0]!;
        const key = `sim|${screen.signature}|${run.team.map((m) => `${m.speciesId}:${m.level}`).join(',')}`;
        const gain = best.winRate - (cur?.winRate ?? 0);
        if (best.order.join(',') !== ident && gain >= 0.04 && !mem.reorderTried.has(key) && mem.reorderFailures < 2) {
          mem.reorderTried.add(key);
          const swaps = starSwaps(
            run.team.map((_, i) => i),
            best.order,
          );
          const names = best.order.map((i) => run.team[i]?.name).join(' → ');
          return {
            kind: 'reorder',
            swaps,
            target: best.order,
            why: `boss sim: ${pct(cur?.winRate ?? 0)} → ${pct(best.winRate)} with order ${names}`,
          };
        }
        const wr = cur?.winRate ?? best.winRate;
        return { kind: 'click', selector: '#btn-elite-prep-continue', why: `FIGHT! (simulated win chance ${pct(wr)})` };
      }
      const sw = s.reorderTeam && run && mem.reorderFailures < 2 ? leadSwap(run.team, vsTypes(run)) : null;
      const key = `${screen.signature}|${run?.team.map((m) => m.speciesId).join(',')}`;
      if (sw && !mem.reorderTried.has(key)) {
        mem.reorderTried.add(key);
        return { kind: 'swapTeam', from: sw.from, to: sw.to, where: 'elite-prep', why: sw.why };
      }
      return { kind: 'click', selector: '#btn-elite-prep-continue', why: 'FIGHT!' };
    }
    case 'transition':
      return { kind: 'wait', ms: 600, why: 'transition' };
    case 'gameover':
      if (mem.endReported !== 'gameover') {
        mem.endReported = 'gameover';
        return { kind: 'stop', why: 'game over', result: 'loss' };
      }
      return { kind: 'click', selector: '#btn-gameover-menu', why: 'back to menu for the next run' };
    case 'win':
      if (mem.endReported !== 'win') {
        mem.endReported = 'win';
        return { kind: 'stop', why: 'champion defeated!', result: 'win' };
      }
      return { kind: 'click', selector: '#btn-win-home', why: 'back to menu for the next run' };
    case 'passive':
    case 'stat-buff':
    case 'stage-complete':
      return { kind: 'pause', why: `screen "${screen.screenId}" is not automated yet – please choose manually` };
    default:
      return { kind: 'pause', why: `unknown screen "${screen.screenId ?? 'none'}"` };
  }
}

function decideMap(state: GameState, doc: Document, s: BotSettings, mem: EngineMemory): Decision {
  const run = state.run;
  const clickable = readClickableMapNodes(doc);
  if (!clickable.length) return { kind: 'wait', ms: 600, why: 'no clickable node yet' };
  mem.endReported = null;
  if (run && s.reorderTeam && mem.reorderFailures < 2) {
    // on the map the overall strongest member leads (regular fights are not the boss type)
    const sw = leadSwap(run.team, []);
    const key = `map|${run.currentNodeId}|${run.team.map((m) => m.speciesId).join(',')}`;
    if (sw && !mem.reorderTried.has(key)) {
      mem.reorderTried.add(key);
      return { kind: 'swapTeam', from: sw.from, to: sw.to, where: 'map', why: sw.why };
    }
  }
  if (run?.bag?.length) {
    if (mem.bagMap !== run.currentMap) {
      mem.bagBlocked.clear();
      mem.bagMap = run.currentMap;
    }
    const use = chooseBagUse(run.bag, run.team, mem.bagBlocked);
    if (use) {
      mem.pendingBag = { index: use.index, itemId: use.itemId };
      return { kind: 'openBag', index: use.index, itemId: use.itemId, why: use.why };
    }
  }
  if (!run?.map) {
    return {
      kind: 'click',
      selector: `.map-node--clickable[data-node-id="${clickable[0]}"]`,
      why: 'no map data (DOM fallback) – first node',
    };
  }
  if (state.sim) {
    const acc = clickable.filter((id) => run.map!.nodes[id]);
    const ctxSim = { teamSize: run.team.length, maxTeamSize: run.maxTeamSize, nuzlocke: run.nuzlocke };
    const r = chooseRouteSim(run.map, acc, ctxSim, state.sim);
    if (r) {
      const types = r.path.map((id) => run.map!.nodes[id]?.type).join('→');
      return {
        kind: 'click',
        selector: `.map-node--clickable[data-node-id="${r.nodeId}"]`,
        why:
          (state.sim.pathSim
            ? `sim route ${types}: survive + beat ${state.sim.bossName ?? 'boss'} ${pct(r.boss)}, team Ø Lv ${r.boost.toFixed(0)}`
            : `sim route ${types}: survive ${pct(r.survive)}, ${state.sim.bossName ?? 'boss'} ${pct(r.boss)} at +${r.boost.toFixed(0)} lv`) +
          (state.sim.nextBossName ? `, then ${state.sim.nextBossName} ~${pct(r.next)}` : ''),
      };
    }
  }
  const ctx = {
    teamSize: run.team.length,
    maxTeamSize: run.maxTeamSize,
    hp: hpRatio(run.team),
    nuzlocke: run.nuzlocke,
    weakness: teamWeakness(run.team, run.maxTeamSize),
    xpNeed: xpNeed(
      run.team.map((m) => m.level),
      run.badges,
    ),
  };
  const pick = chooseRoute(
    run.map,
    clickable.filter((id) => run.map!.nodes[id]),
    ctx,
  );
  if (!pick) return { kind: 'pause', why: 'map nodes do not match game data' };
  const types =
    pick.path.map((id) => run.map!.nodes[id]?.type).join('→') + ` [xp need ${(ctx.xpNeed ?? 0).toFixed(1)}]`;
  return {
    kind: 'click',
    selector: `.map-node--clickable[data-node-id="${pick.nodeId}"]`,
    why: `route ${types} (value ${pick.value.toFixed(1)}, team HP ${(ctx.hp * 100).toFixed(0)}%)`,
  };
}

function decideCatch(state: GameState, doc: Document): Decision {
  const domCards = readCards(doc, '#catch-choices .poke-card');
  if (!domCards.length) {
    if (shown(doc, '#btn-skip-catch')) return { kind: 'wait', ms: 500, why: 'catch options loading' };
    return { kind: 'wait', ms: 500, why: 'catch screen loading' };
  }
  const run = state.run;
  const bridgeMatches = !!run?.catchOffer && sameSpecies(run.catchOffer, domCards);
  const offer = bridgeMatches ? run!.catchOffer! : domCards;
  const sim = bridgeMatches ? state.catchSim : null;
  if (sim?.length && run) {
    const pick = chooseCatchSim(sim, offer, run.team.length, run.maxTeamSize);
    if (pick.index < 0) return { kind: 'click', selector: '#btn-skip-catch', why: pick.why };
    return { kind: 'click', selector: '#catch-choices .poke-card', index: pick.index, why: pick.why };
  }
  const c = chooseCatch(offer, run?.team ?? [], run?.maxTeamSize ?? 6, vsTypes(run));
  if (c.index < 0) return { kind: 'click', selector: '#btn-skip-catch', why: c.why };
  return { kind: 'click', selector: '#catch-choices .poke-card', index: c.index, why: c.why };
}

function decideSwap(state: GameState, doc: Document): Decision {
  const incomingEl = doc.querySelector('#swap-incoming .poke-card');
  const incoming = incomingEl ? parsePokeCard(incomingEl) : null;
  const domTeam = readCards(doc, '#swap-choices .poke-card');
  if (!domTeam.length) return { kind: 'wait', ms: 500, why: 'swap screen loading' };
  const team = state.run && sameSpecies(state.run.team, domTeam) ? state.run.team : domTeam;
  const c = chooseRelease(incoming, team);
  if (c.index < 0) {
    if (shown(doc, '#btn-cancel-swap')) return { kind: 'click', selector: '#btn-cancel-swap', why: c.why };
    return { kind: 'pause', why: `${c.why}, but no keep button` };
  }
  return { kind: 'click', selector: '#swap-choices .poke-card', index: c.index, why: c.why };
}

function decideEquip(doc: Document, run: RunState | null, kind: 'move-tutor' | 'item-equip'): Decision {
  // buttons carry the team index: data-tutor (move tutor) / data-idx (equip). data-unequip must never be clicked.
  const attr = kind === 'move-tutor' ? 'data-tutor' : 'data-idx';
  const btns = Array.from(doc.querySelectorAll(`#item-equip-modal button[${attr}]:not([disabled])`));
  const eligible = btns.map((b) => Number(b.getAttribute(attr))).filter((n) => Number.isInteger(n) && n >= 0);
  const skip = kind === 'move-tutor' ? '#btn-skip-tutor' : '#btn-equip-to-bag';
  if (!eligible.length) {
    return shown(doc, skip)
      ? { kind: 'click', selector: skip, why: `${kind}: nobody can use it` }
      : { kind: 'pause', why: `${kind}: no usable button` };
  }
  const team = run?.team ?? [];
  let pick = eligible[0]!;
  let why = `${kind}: first eligible member (no team data)`;
  if (team.length) {
    if (kind === 'move-tutor') {
      const mons = eligible.map((i) => team[i]).filter((m): m is Mon => !!m);
      if (mons.length === eligible.length) {
        const c = chooseHolder(mons, 'offense');
        pick = eligible[c.index]!;
        why = `move tutor: ${c.why}`;
      }
    } else {
      const header = doc.querySelector('#item-equip-modal .equip-item-header');
      const itemId = header ? itemIdFromCard(header) : null;
      const c = chooseEquipHolder(itemId ?? 'unknown', team, eligible);
      if (c) {
        pick = c.index;
        why = `equip: ${c.why}`;
      }
    }
  }
  return { kind: 'click', selector: `#item-equip-modal button[${attr}="${pick}"]`, why };
}

/** Evolution animation: let it evolve (Skip = skip the animation, NOT the "Stop" button). Branching: best card. */
function decideEvolution(doc: Document, run: RunState | null): Decision {
  const cards = Array.from(doc.querySelectorAll('#eevee-choice-overlay .evo-choice-card'));
  if (cards.length && isShown(doc.getElementById('eevee-choice-overlay'))) {
    const parsed = cards.map((c) => parsePokeCard(c));
    const vs = vsTypes(run);
    let best = 0;
    parsed.forEach((m, i) => {
      const cur = parsed[best];
      if (m && (!cur || monScore(m, vs) > monScore(cur, vs))) best = i;
    });
    const name = parsed[best]?.name ?? `option ${best + 1}`;
    return {
      kind: 'click',
      selector: '#eevee-choice-overlay .evo-choice-card',
      index: best,
      why: `branching evolution → ${name}`,
    };
  }
  if (shown(doc, '#evo-overlay .evo-skip-btn'))
    return { kind: 'click', selector: '#evo-overlay .evo-skip-btn', why: 'evolve (skip animation)' };
  return { kind: 'wait', ms: 400, why: 'evolution animation' };
}

function decideUsable(doc: Document, run: RunState | null, mem: EngineMemory): Decision {
  const rows = Array.from(doc.querySelectorAll('#usable-item-modal .equip-pokemon-row[data-idx]'));
  // the game marks valid targets with a keyboard shortcut attribute
  const targetable = rows.filter((r) => r.hasAttribute('data-shortcut')).map((r) => Number(r.getAttribute('data-idx')));
  const header = doc.querySelector('#usable-item-modal .equip-item-header');
  const itemId = (header && itemIdFromCard(header)) || mem.pendingBag?.itemId || 'unknown';
  const c = run ? chooseUsableTarget(itemId, run.team, targetable) : null;
  if (!c) {
    if (mem.pendingBag) mem.bagBlocked.add(`${normalizeItemId(mem.pendingBag.itemId)}|${mem.pendingBag.index}`);
    mem.pendingBag = null;
    return { kind: 'click', selector: '#btn-cancel-use', why: `${itemId}: no valid target right now` };
  }
  mem.pendingBag = null;
  return {
    kind: 'click',
    selector: `#usable-item-modal .equip-pokemon-row[data-idx="${c.index}"]`,
    why: `use ${c.why}`,
  };
}
