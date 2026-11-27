import { describe, expect, it } from 'vitest';
import { chooseItem, normalizeItemId } from '../../src/core/strategy/choices';
import {
  chooseBagUse,
  chooseEquipHolder,
  chooseUsableTarget,
  isMegaStoneId,
  megaStoneFits,
} from '../../src/core/strategy/items';
import { mon } from './helpers';

const phys = mon({
  speciesId: 66,
  name: 'Machop',
  level: 20,
  types: ['Fighting'],
  baseStats: { hp: 70, atk: 80, def: 50, speed: 35, special: 35, spdef: 35 },
  move: { name: 'x', power: 60, type: 'Fighting', isSpecial: false },
});
const spec = mon({
  speciesId: 63,
  name: 'Abra',
  level: 20,
  types: ['Psychic'],
  baseStats: { hp: 25, atk: 20, def: 15, speed: 90, special: 105, spdef: 55 },
  move: { name: 'x', power: 60, type: 'Psychic', isSpecial: true },
});
const tank = mon({
  speciesId: 95,
  name: 'Onix',
  level: 20,
  types: ['Rock'],
  baseStats: { hp: 35, atk: 45, def: 160, speed: 70, special: 30, spdef: 45 },
  move: { name: 'x', power: 40, type: 'Rock', isSpecial: false },
});

describe('item ids', () => {
  it('sprite names and game ids are the same item', () => {
    expect(normalizeItemId('expert-belt')).toBe('expert_belt');
    expect(chooseItem(['lagging-tail', 'expert-belt', 'choice-specs'], []).index).toBe(1);
  });
  it('Sacred Ash jumps to the top when someone is down', () => {
    const down = { ...phys, currentHp: 0 };
    expect(chooseItem(['expert_belt', 'sacred_ash'], [down, spec]).index).toBe(1);
    expect(chooseItem(['expert_belt', 'sacred_ash'], [phys, spec]).index).toBe(0);
  });
});

describe('bag use', () => {
  it('uses candy/TM immediately, keeps Sacred Ash for emergencies', () => {
    expect(chooseBagUse([{ id: 'sacred_ash', usable: true }], [phys], new Set())).toBeNull();
    expect(
      chooseBagUse([{ id: 'sacred_ash', usable: true }], [{ ...phys, currentHp: 0 }, spec], new Set())?.index,
    ).toBe(0);
    expect(chooseBagUse([{ id: 'rare_candy', usable: true }], [phys], new Set())?.itemId).toBe('rare_candy');
    expect(chooseBagUse([{ id: 'tm_normal', usable: true }], [{ ...phys, moveTier: 2 }], new Set())).toBeNull();
  });
  it('saves Sacred Ash for the boss-prep screen when asked', () => {
    const team = [{ ...phys, currentHp: 0 }, spec];
    expect(chooseBagUse([{ id: 'sacred_ash', usable: true }], team, new Set(), true)).toBeNull();
    expect(chooseBagUse([{ id: 'sacred_ash', usable: true }], team, new Set(), false)?.index).toBe(0);
  });
  it('respects blocked entries and equips bag items only when a hand is free or the swap is clearly better', () => {
    expect(chooseBagUse([{ id: 'rare_candy', usable: true }], [phys], new Set(['rare_candy|0']))).toBeNull();
    expect(
      chooseBagUse([{ id: 'leftovers', usable: false }], [{ ...phys, heldItem: 'expert_belt' }], new Set()),
    ).toBeNull();
    expect(
      chooseBagUse([{ id: 'leftovers', usable: false }], [{ ...phys, heldItem: 'amulet_coin' }], new Set()),
    ).toMatchObject({ index: 0 });
    expect(chooseBagUse([{ id: 'leftovers', usable: false }], [phys], new Set())?.index).toBe(0);
  });
});

describe('targets and holders', () => {
  const team = [phys, spec, tank];
  it('Sacred Ash revives the highest fainted member', () => {
    const t = [phys, { ...spec, currentHp: 0, level: 25 }, { ...tank, currentHp: 0, level: 18 }];
    expect(chooseUsableTarget('sacred_ash', t, [0, 1, 2])?.index).toBe(1);
  });
  it('only targets rows the game allows', () => {
    expect(chooseUsableTarget('rare_candy', team, [2])?.index).toBe(2);
    expect(chooseUsableTarget('rare_candy', team, [])).toBeNull();
  });
  it('choice band → physical, choice specs → special, leftovers → tank, type booster → matching move', () => {
    expect(chooseEquipHolder('choice_band', team, [0, 1, 2])?.index).toBe(0);
    expect(chooseEquipHolder('choice-specs', team, [0, 1, 2])?.index).toBe(1);
    expect(chooseEquipHolder('leftovers', team, [0, 1, 2])?.index).toBe(2);
    expect(chooseEquipHolder('twisted_spoon', team, [0, 1, 2])?.index).toBe(1);
  });
  it('prefers members without an item', () => {
    expect(chooseEquipHolder('choice_band', [{ ...phys, heldItem: 'x' }, spec], [0, 1])?.index).toBe(1);
  });
});

describe('held items never cost a Mega Stone (live finding chal5, 2026-11-27)', () => {
  const megaMewtwo = mon({ speciesId: 150, name: 'Mega Mewtwo Y', heldItem: 'mewtwonite_y', heldMega: true });
  it('a held Mega Stone is never replaced – the new item goes to the bag', () => {
    expect(chooseEquipHolder('expert_belt', [megaMewtwo], [0])).toBeNull();
    // even when the game reports the stone only by id
    expect(chooseEquipHolder('expert_belt', [{ ...megaMewtwo, heldMega: undefined }], [0])).toBeNull();
    const free = mon({ speciesId: 6, name: 'Charizard' });
    expect(chooseEquipHolder('expert_belt', [megaMewtwo, free], [0, 1])).toMatchObject({ index: 1 });
  });
  it('a held item is only replaced by a clearly better one', () => {
    const belt = mon({ speciesId: 150, name: 'Mewtwo', heldItem: 'expert_belt' });
    expect(chooseEquipHolder('choice_band', [belt], [0])).toBeNull();
    const coin = mon({ speciesId: 150, name: 'Mewtwo', heldItem: 'amulet_coin' });
    expect(chooseEquipHolder('leftovers', [coin], [0])).toMatchObject({ index: 0 });
  });
  it('a Mega Stone only goes to its own species', () => {
    const electivire = mon({ speciesId: 466, name: 'Electivire' });
    const kangaskhan = mon({ speciesId: 115, name: 'Kangaskhan' });
    expect(chooseEquipHolder('kangaskhanite', [electivire, kangaskhan], [0, 1])).toMatchObject({ index: 1 });
    expect(chooseEquipHolder('kangaskhanite', [electivire], [0])).toBeNull();
    expect(megaStoneFits('abomasite', mon({ speciesId: 460, name: 'Abomasnow' }))).toBe(true);
    expect(megaStoneFits('latiosite', mon({ speciesId: 380, name: 'Latias' }))).toBe(false);
    expect(isMegaStoneId('eviolite')).toBe(false);
    expect(isMegaStoneId('charizardite_x')).toBe(true);
  });
  it('the bag does not offer an item nobody should hold (no open-and-put-back loop)', () => {
    const team = [mon({ speciesId: 466, name: 'Electivire' }), megaMewtwo];
    expect(chooseBagUse([{ id: 'kangaskhanite', usable: false }], team, new Set())).toBeNull();
    expect(chooseBagUse([{ id: 'leftovers', usable: false }], team, new Set())).toMatchObject({ index: 0 });
  });
});
