/**
 * DecisionEngine: GameState + DOM (read-only) + settings → exactly one Decision.
 * Never guesses: unrecognised screens/modals or inconsistent data → { kind: 'pause' }.
 */
import { bossTypesFor } from '../data/bosses';
import type { BotSettings } from '../settings';
import { isActionable, isShown } from '../screens/detector';
import { itemIdFromCard, parsePokeCard, readCards, readClickableMapNodes, typeFromClasses } from '../state/dom-reader';
import type { Decision, DecisionOption, GameState, Mon, RunState } from '../types';
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
import { hpRatio, monScore, weakestIndex } from './evaluate';
import { effectiveness } from '../data/typechart';
import { chooseRoute, xpNeed } from './map';
import { chooseCatchSim, chooseRouteSim, starSwaps } from './sim-route';
import { chooseBagUse, chooseEquipHolder, chooseUsableTarget } from './items';
import {
  choosePcStarter,
  chooseRelic,
  chooseRelicReplace,
  isPokeMart,
  readPcCards,
  readRelicCards,
  relicScore,
} from './challenge';
import { normalizeItemId } from './choices';
import { FLAGS } from '../flags';

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
        return {
          kind: 'pause',
          why: `unrecognised dialog "${screen.overlayId}" – please handle it manually`,
          cause: 'unsupported',
        };
    }
  }

  switch (screen.kind) {
    case 'title': {
      if (s.mode === 'challenge') {
        if (s.resumeRuns && shown(doc, '#btn-continue-challenge'))
          return { kind: 'click', selector: '#btn-continue-challenge', why: 'resume challenge run' };
        const btn = doc.querySelector('#btn-challenges-run');
        if (btn && (btn.hasAttribute('disabled') || btn.classList.contains('title-mode-card--locked')))
          return {
            kind: 'pause',
            why: 'Challenges sind in diesem Spielstand noch gesperrt – im Spiel erst freischalten (Story-Sieg)',
            cause: 'config',
          };
        return { kind: 'click', selector: '#btn-challenges-run', why: 'open challenges' };
      }
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
      if (!r) return { kind: 'pause', why: `region ${s.region} not found`, cause: 'config' };
      if (r.classList.contains('history-region-btn--locked'))
        return { kind: 'pause', why: `region ${s.region} is locked in your save`, cause: 'config' };
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
        return { kind: 'pause', why: `tower region ${s.region} unavailable`, cause: 'config' };
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
    case 'challenge-select': {
      const sel = s.chalKind === 'daily' ? '#chal-daily' : s.chalKind === 'weekly' ? '#chal-weekly' : '#chal-intro';
      if (!doc.querySelector(sel))
        return { kind: 'pause', why: `challenge "${s.chalKind}" not offered`, cause: 'config' };
      return { kind: 'click', selector: sel, why: `start ${s.chalKind} challenge` };
    }
    case 'challenge-level': {
      const picks = Array.from(doc.querySelectorAll('#weekly-select .gym-pick'));
      if (s.chalLevel != null && picks.length) {
        const p = picks.find((e) => e.getAttribute('data-level') === String(s.chalLevel));
        if (!p) return { kind: 'pause', why: `badge level ${s.chalLevel} not found`, cause: 'config' };
        if (p.classList.contains('is-locked'))
          return { kind: 'pause', why: `badge level ${s.chalLevel + 1} is locked in your save`, cause: 'config' };
        if (!p.classList.contains('is-sel'))
          return {
            kind: 'click',
            selector: `#weekly-select .gym-pick[data-level="${s.chalLevel}"]`,
            why: `select badge level ${s.chalLevel + 1}`,
          };
      }
      if (shown(doc, '#weekly-select .gym-play'))
        return { kind: 'click', selector: '#weekly-select .gym-play', why: 'play' };
      return {
        kind: 'pause',
        why: 'challenge setup screen without a play button (not automated yet)',
        cause: 'unsupported',
      };
    }
    case 'starter': {
      if (doc.querySelector('#starter-choices .dex-card')) {
        const cards = readPcCards(doc);
        const c = choosePcStarter(cards, state.pcStats ?? {}, s.chalStarter ?? s.preferredStarter);
        if (c.index < 0) return { kind: 'pause', why: c.why, cause: 'config' };
        return {
          kind: 'click',
          selector: '#starter-choices .dex-card',
          index: c.index,
          why: c.why,
          trace: trace(c.options, `starter:${c.index}`),
        };
      }
      const cards = readCards(doc, '#starter-choices .poke-card');
      if (!cards.length) return { kind: 'wait', ms: 500, why: 'starters loading' };
      const gen = state.run?.gen && state.run.gen > 1 ? state.run.gen : s.region;
      const early = s.mode === 'story' ? [bossTypesFor(gen, 0), bossTypesFor(gen, 1)].filter((t) => t.length) : [];
      const c = chooseStarter(cards, s.preferredStarter, early);
      return {
        kind: 'click',
        selector: '#starter-choices .poke-card',
        index: c.index,
        why: c.why,
        trace: trace(c.options, `starter:${c.index}`),
      };
    }
    case 'map':
      return decideMap(state, doc, s, mem);
    case 'battle': {
      // usable, not just visible: the game disables SKIP after the click while the fight goes on (§12.8, D-037)
      if (isActionable(doc.querySelector('#btn-continue-battle')))
        return { kind: 'click', selector: '#btn-continue-battle', why: 'battle finished – continue' };
      if (isActionable(doc.querySelector('#btn-auto-battle')))
        return { kind: 'click', selector: '#btn-auto-battle', why: 'skip battle animation' };
      if (shown(doc, '#btn-auto-battle')) return { kind: 'wait', ms: 700, why: 'battle running (skip pressed)' };
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
      if (c.index < 0)
        return { kind: 'click', selector: '#btn-skip-item', why: c.why, trace: trace(c.options, 'item:skip') };
      return {
        kind: 'click',
        selector: '#item-choices .item-card',
        index: c.index,
        why: c.why,
        trace: trace(c.options, `item:${c.index}`),
      };
    }
    case 'shiny':
      return s.takeShiny
        ? { kind: 'click', selector: '#btn-take-shiny', why: 'take the shiny (2 trait points)' }
        : { kind: 'click', selector: '#btn-skip-shiny', why: 'shiny disabled in settings' };
    case 'trade':
      return decideTrade(doc, run);
    case 'badge':
      return { kind: 'click', selector: '#btn-next-map', why: 'badge earned – next map' };
    case 'elite-prep': {
      // the boss-prep screen has its own bag: last chance to revive / level up before the fight (no healing in the E4)
      const bagUse = bagDecision(run, mem, true);
      if (bagUse) return bagUse;
      const os = state.orderSim;
      if (s.reorderTeam && os?.length && run) {
        const ident = run.team.map((_, i) => i).join(',');
        const cur = os.find((o) => o.order.join(',') === ident);
        // D-043: a full clear of the league is often out of reach – then the order that gets furthest still counts
        // (winning more members keeps the run going longer and is what a full clear is made of)
        const value = (o: (typeof os)[number]) => o.winRate + 0.25 * (o.progress ?? o.winRate);
        const best = [...os].sort((a, b) => value(b) - value(a) || b.avgAlive - a.avgAlive)[0]!;
        const key = `sim|${screen.signature}|${run.team.map((m) => `${m.speciesId}:${m.level}:${m.currentHp}`).join(',')}`;
        const gain = value(best) - (cur ? value(cur) : 0);
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
        const at = cur ?? best;
        const prog = at.progress != null && at.progress < 1 ? `, ${pct(at.progress)} of the chain on average` : '';
        return {
          kind: 'click',
          selector: '#btn-elite-prep-continue',
          why: `FIGHT! (simulated win chance ${pct(at.winRate)}${prog})`,
        };
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
    case 'passive': {
      // D-042: the Poké Mart looks like a relic choice, but its cards sell bag items – leave, sell nothing
      if (isPokeMart(run))
        return shown(doc, '#btn-skip-passive')
          ? { kind: 'click', selector: '#btn-skip-passive', why: 'Poké Mart: leave without selling items (D-042)' }
          : { kind: 'wait', ms: 500, why: 'Poké Mart loading' };
      if (doc.querySelector('#passive-choices.is-replace-grid')) {
        // owned relics are clickable cards, the new one is the non-clickable card before the skip button
        const all = Array.from(doc.querySelectorAll('#passive-choices .item-card.passive-card'));
        const isNew = (e: Element) => /cursor:\s*default/.test(e.getAttribute('style') ?? '');
        const parsed = readRelicCards(doc);
        const owned = parsed.filter((_, i) => !isNew(all[i]!));
        const incoming = parsed.find((_, i) => isNew(all[i]!));
        if (!incoming)
          return { kind: 'pause', why: 'relic replace dialog without the new relic', cause: 'inconsistent' };
        const rs = state.relicSim;
        if (rs?.replace.length && rs.replace.length === owned.length) {
          const bestI = rs.replace.reduce((b, v, i) => (v > rs.replace[b]! ? i : b), 0);
          const options = [
            ...rs.replace.map((v, i) => ({
              id: `replace:${i}`,
              label: `owned ${i + 1}${owned[i]?.types.length ? ` (${owned[i]!.types.join('/')})` : ''}`,
              score: v,
            })),
            { id: 'relic:skip', label: 'keep all', score: rs.baseline },
          ];
          if (rs.replace[bestI]! > rs.baseline + 0.02) {
            const ownedIdx = all.map((e, i) => (isNew(e) ? -1 : i)).filter((i) => i >= 0)[bestI]!;
            return {
              kind: 'click',
              selector: '#passive-choices .item-card.passive-card',
              index: ownedIdx,
              why: `sim: swap relic ${bestI + 1} for the new one (${rs.baseline.toFixed(2)} → ${rs.replace[bestI]!.toFixed(2)})`,
              trace: trace(options, `replace:${bestI}`, rs.replace[bestI]!),
            };
          }
          if (rs.replace.some((v) => Math.abs(v - rs.baseline) > 1e-9))
            return {
              kind: 'click',
              selector: '#btn-skip-passive',
              why: `sim: no swap improves the boss odds (${rs.baseline.toFixed(2)})`,
              trace: trace(options, 'relic:skip', rs.baseline),
            };
        }
        const c = chooseRelicReplace(owned, incoming, run?.team ?? []);
        if (c.index < 0) return { kind: 'click', selector: '#btn-skip-passive', why: c.why };
        const ownedIdx = all.map((e, i) => (isNew(e) ? -1 : i)).filter((i) => i >= 0)[c.index]!;
        return { kind: 'click', selector: '#passive-choices .item-card.passive-card', index: ownedIdx, why: c.why };
      }
      const cards = readRelicCards(doc);
      if (!cards.length) return { kind: 'wait', ms: 500, why: 'relics loading' };
      const rs = state.relicSim;
      if (rs && rs.offers.length === cards.length && rs.offers.some((o) => o.combat)) {
        // simulated value first; team-type synergy only breaks near-ties (relics without combat effect)
        const team = run?.team ?? [];
        const score = (i: number) => rs.offers[i]!.value + 0.004 * relicScore(cards[i]!, team);
        const best = cards.map((_, i) => i).reduce((b, i) => (score(i) > score(b) ? i : b), 0);
        const options = [
          ...cards.map((c, i) => ({
            id: `relic:${i}`,
            label: rs.offers[i]!.id ?? (c.types.join('/') || `relic ${i + 1}`),
            score: rs.offers[i]!.value,
            factors: { synergy: relicScore(c, team) },
          })),
          { id: 'relic:skip', label: 'skip', score: rs.baseline },
        ];
        return {
          kind: 'click',
          selector: '#passive-choices .item-card.passive-card',
          index: best,
          why: `sim: relic ${rs.offers[best]!.id ?? '?'} → boss odds ${rs.baseline.toFixed(2)} → ${rs.offers[best]!.value.toFixed(2)}`,
          trace: trace(options, `relic:${best}`, rs.offers[best]!.value),
        };
      }
      const team = run?.team ?? [];
      const c = chooseRelic(cards, team);
      const options = cards.map((card, i) => ({
        id: `relic:${i}`,
        label: card.types.join('/') || `relic ${i + 1}`,
        score: relicScore(card, team),
      }));
      return {
        kind: 'click',
        selector: '#passive-choices .item-card.passive-card',
        index: c.index,
        why: c.why,
        trace: trace(options, `relic:${c.index}`),
      };
    }
    case 'stage-complete': {
      // challenge level cleared (badge earned) or tower stage cleared
      if (s.mode === 'tower' && shown(doc, '#btn-stage-continue'))
        return { kind: 'click', selector: '#btn-stage-continue', why: 'tower stage cleared – next stage' };
      if (mem.endReported !== 'win') {
        mem.endReported = 'win';
        return { kind: 'stop', why: 'challenge level cleared!', result: 'win' };
      }
      for (const sel of ['#btn-stage-home', '#btn-stage-again'])
        if (shown(doc, sel)) return { kind: 'click', selector: sel, why: 'back to the challenges for the next run' };
      return { kind: 'pause', why: 'stage complete without a known button', cause: 'inconsistent' };
    }
    case 'stat-buff':
      return {
        kind: 'pause',
        why: `screen "${screen.screenId}" is not automated yet – please choose manually`,
        cause: 'unsupported',
      };
    default:
      return { kind: 'pause', why: `unknown screen "${screen.screenId ?? 'none'}"`, cause: 'unsupported' };
  }
}

/** Trace for the run logs (R-006, D-038): never influences the decision itself. */
function trace(options: DecisionOption[] | undefined, chosen: string, confidence: number | null = null) {
  return options ? { options, chosen, confidence } : undefined;
}

function decideMap(state: GameState, doc: Document, s: BotSettings, mem: EngineMemory): Decision {
  const run = state.run;
  const clickable = readClickableMapNodes(doc);
  if (!clickable.length) return { kind: 'wait', ms: 600, why: 'no clickable node yet' };
  mem.endReported = null;
  // simulation-backed order for the coming route (joint route/order search) beats the simple heuristic
  const mo = state.sim?.mapOrder;
  if (run && s.reorderTeam && mo && mo.length === run.team.length && mem.reorderFailures < 2) {
    const key = `maporder|${run.currentNodeId}|${run.team.map((m) => `${m.speciesId}:${m.level}`).join(',')}`;
    if (!mem.reorderTried.has(key)) {
      mem.reorderTried.add(key);
      const swaps = starSwaps(
        run.team.map((_, i) => i),
        mo,
      );
      if (swaps.length)
        return {
          kind: 'reorder',
          swaps,
          target: mo,
          why: `sim: route odds better with order ${mo.map((i) => run.team[i]?.name).join(' → ')}`,
        };
    }
  } else if (run && s.reorderTeam && !state.sim && mem.reorderFailures < 2) {
    // on the map the overall strongest member leads (regular fights are not the boss type)
    const sw = leadSwap(run.team, []);
    const key = `map|${run.currentNodeId}|${run.team.map((m) => m.speciesId).join(',')}`;
    if (sw && !mem.reorderTried.has(key)) {
      mem.reorderTried.add(key);
      return { kind: 'swapTeam', from: sw.from, to: sw.to, where: 'map', why: sw.why };
    }
  }
  const bagUse = bagDecision(run, mem);
  if (bagUse) return bagUse;
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
      const options = (r.alternatives ?? []).map((a) => ({
        id: `node:${a.nodeId}`,
        label: a.path.map((id) => run.map!.nodes[id]?.type).join('→'),
        score: a.value,
        factors: { boss: a.boss, survive: a.survive, next: a.next },
      }));
      return {
        kind: 'click',
        selector: `.map-node--clickable[data-node-id="${r.nodeId}"]`,
        trace: trace(options, `node:${r.nodeId}`, r.boss),
        why:
          (state.sim.pathSim
            ? `sim route ${types}: survive + beat ${state.sim.bossName ?? 'boss'} ${pct(r.boss)}, team Ø Lv ${r.boost.toFixed(0)}`
            : `sim route ${types}: survive ${pct(r.survive)}, ${state.sim.bossName ?? 'boss'} ${pct(r.boss)} at +${r.boost.toFixed(0)} lv`) +
          (state.sim.nextBossName
            ? `, then ${state.sim.nextBossName} ~${pct(r.next)}${/ \+\d+$/.test(state.sim.nextBossName) ? ' of the fights' : ''}`
            : ''),
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
  if (!pick) return { kind: 'pause', why: 'map nodes do not match game data', cause: 'inconsistent' };
  const types =
    pick.path.map((id) => run.map!.nodes[id]?.type).join('→') + ` [xp need ${(ctx.xpNeed ?? 0).toFixed(1)}]`;
  const options = (pick.alternatives ?? []).map((a) => ({
    id: `node:${a.nodeId}`,
    label: a.path.map((id) => run.map!.nodes[id]?.type).join('→'),
    score: a.value,
  }));
  return {
    kind: 'click',
    selector: `.map-node--clickable[data-node-id="${pick.nodeId}"]`,
    trace: trace(options, `node:${pick.nodeId}`),
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
    const pick = chooseCatchSim(sim, offer, run.team.length, run.maxTeamSize, run.team);
    const id = (i: number) => (i < 0 ? 'catch:skip' : `catch:${i}`);
    const options = sim.map((o) => ({
      id: id(o.index),
      label: o.index < 0 ? 'skip' : (offer[o.index]?.name ?? '?'),
      score: o.value,
      factors: { current: o.current, next: o.next },
    }));
    const t = trace(options, id(pick.index), sim.find((o) => o.index === pick.index)?.current ?? null);
    if (pick.index < 0) return { kind: 'click', selector: '#btn-skip-catch', why: pick.why, trace: t };
    return { kind: 'click', selector: '#catch-choices .poke-card', index: pick.index, why: pick.why, trace: t };
  }
  const c = chooseCatch(offer, run?.team ?? [], run?.maxTeamSize ?? 6, vsTypes(run));
  if (c.index < 0)
    return { kind: 'click', selector: '#btn-skip-catch', why: c.why, trace: trace(c.options, 'catch:skip') };
  return {
    kind: 'click',
    selector: '#catch-choices .poke-card',
    index: c.index,
    why: c.why,
    trace: trace(c.options, `catch:${c.index}`),
  };
}

function decideSwap(state: GameState, doc: Document): Decision {
  const incomingEl = doc.querySelector('#swap-incoming .poke-card');
  const incoming = incomingEl ? parsePokeCard(incomingEl) : null;
  const domTeam = readCards(doc, '#swap-choices .poke-card');
  // "Neues Pokémon!" (legendary/gift node): with room in the team the game lists no team, only the newcomer and
  // "Team behalten" – adding it is free (live finding, arena challenge 2026-11-27)
  const room = !!state.run && state.run.team.length > 0 && state.run.team.length < state.run.maxTeamSize;
  if (!domTeam.length && incomingEl && room && shown(doc, '#btn-cancel-swap'))
    return {
      kind: 'click',
      selector: '#swap-incoming .poke-card',
      why: `team has room: add ${incoming?.name ?? 'the new Pokémon'}`,
    };
  if (!domTeam.length) return { kind: 'wait', ms: 500, why: 'swap screen loading' };
  const team = state.run && sameSpecies(state.run.team, domTeam) ? state.run.team : domTeam;
  const c = chooseRelease(incoming, team);
  if (c.index < 0) {
    if (shown(doc, '#btn-cancel-swap')) return { kind: 'click', selector: '#btn-cancel-swap', why: c.why };
    return { kind: 'pause', why: `${c.why}, but no keep button`, cause: 'inconsistent' };
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
      : { kind: 'pause', why: `${kind}: no usable button`, cause: 'inconsistent' };
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

/**
 * Mystery trade: only what a human sees is used (one revealed type + level per offer; the hidden species in
 * state.savedTrade are deliberately ignored). Trade only a member that fell far behind – all members gain the same
 * levels per win, so a laggard never catches up.
 */
function decideTrade(doc: Document, run: RunState | null): Decision {
  if (shown(doc, '#btn-trade-continue'))
    return { kind: 'click', selector: '#btn-trade-continue', why: 'trade finished' };
  const offers = Array.from(doc.querySelectorAll('#trade-choices .trade-mystery-card'));
  if (offers.length && shown(doc, '#trade-choices')) {
    const vs = vsTypes(run);
    const scored = offers.map((c, i) => {
      const t = Array.from(c.querySelectorAll('[class*="type-"]'))
        .map((e) => typeFromClasses(e))
        .find(Boolean);
      const lvl = Number((c.textContent ?? '').match(/(\d+)\s*$/)?.[1] ?? (c.textContent ?? '').match(/\d+/)?.[0] ?? 0);
      const eff = t && vs.length ? effectiveness(t, vs) : 1;
      return { i, score: lvl * (0.8 + 0.2 * eff), t, lvl };
    });
    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    const best = scored[0]!;
    return {
      kind: 'click',
      selector: '#trade-choices .trade-mystery-card',
      index: best.i,
      why: `trade offer ${best.t ?? '?'} Lv ${best.lvl}`,
    };
  }
  const rows = Array.from(doc.querySelectorAll('#trade-team-list .trade-member-row'));
  const team = run?.team ?? [];
  if (rows.length && team.length >= 3 && rows.length === team.length) {
    const avg = team.reduce((a, m) => a + m.level, 0) / team.length;
    const wi = weakestIndex(team);
    const weak = team[wi]!;
    if (FLAGS.trade && weak.level <= avg - 6) {
      return {
        kind: 'click',
        selector: '#trade-team-list .trade-member-row',
        index: wi,
        why: `trade laggard ${weak.name} Lv ${weak.level} (team Ø ${avg.toFixed(0)})`,
      };
    }
  }
  return { kind: 'click', selector: '#btn-skip-trade', why: 'no laggard worth trading' };
}

function bagDecision(run: RunState | null, mem: EngineMemory, onBossPrep = false): Decision | null {
  if (!run?.bag?.length) return null;
  const key = run.currentMap * 10 + run.eliteIndex;
  if (mem.bagMap !== key) {
    mem.bagBlocked.clear();
    mem.bagMap = key;
  }
  // from the map before the Elite Four on, revives are saved for the boss-prep screens
  const use = chooseBagUse(run.bag, run.team, mem.bagBlocked, run.currentMap >= 7 && !onBossPrep);
  if (!use) return null;
  mem.pendingBag = { index: use.index, itemId: use.itemId };
  return { kind: 'openBag', index: use.index, itemId: use.itemId, why: use.why };
}

function decideUsable(doc: Document, run: RunState | null, mem: EngineMemory): Decision {
  const rows = Array.from(doc.querySelectorAll('#usable-item-modal .equip-pokemon-row[data-idx]'));
  // valid targets are clickable rows; invalid ones get "pointer-events:none" (live-verified markup)
  const targetable = rows
    .filter((r) => !/pointer-events\s*:\s*none/i.test(r.getAttribute('style') ?? ''))
    .map((r) => Number(r.getAttribute('data-idx')));
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
