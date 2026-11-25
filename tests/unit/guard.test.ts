import { describe, expect, it } from 'vitest';
import { Actor } from '../../src/core/actions/actor';
import { ForbiddenActionError, isForbiddenTarget, isKeyAllowed } from '../../src/core/actions/guard';
import { loadFixture } from './helpers';

// R-147 (D-025): the bot never triggers "Reset Run", account/logout or the Reset shortcut "R".
describe('actor guard (R-147)', () => {
  const doc = loadFixture('map');
  const reset = doc.querySelector('[data-menu="reset"]') as Element;
  const account = doc.querySelector('[data-menu="account"]') as Element;

  it('fixture contains the run menu', () => {
    expect(reset).toBeTruthy();
    expect(account).toBeTruthy();
  });

  it('flags reset/account targets, including their children', () => {
    expect(isForbiddenTarget(reset)).toBe('[data-menu="reset"]');
    const child = doc.createElement('span');
    reset.appendChild(child);
    expect(isForbiddenTarget(child)).toBe('[data-menu="reset"]');
    expect(isForbiddenTarget(account)).toBe('[data-menu="account"]');
  });

  it('flags share, shop/Pokédollar, app install and the second reset button (R-053, R-237)', () => {
    const q = (sel: string) => doc.querySelector(sel) as Element;
    expect(isForbiddenTarget(q('[onclick="shareRun()"]'))).not.toBeNull();
    expect(isForbiddenTarget(q('#btn-mart-nav'))).not.toBeNull();
    expect(isForbiddenTarget(q('#btn-install-app'))).not.toBeNull();
    const resets = Array.from(doc.querySelectorAll('[onclick*="confirmResetRun"]'));
    expect(resets.length).toBeGreaterThanOrEqual(1);
    for (const r of resets) expect(isForbiddenTarget(r)).not.toBeNull();
    const vitamin = doc.createElement('button');
    vitamin.setAttribute('onclick', 'buyVitamin(1, "atk")');
    doc.body.appendChild(vitamin);
    expect(isForbiddenTarget(vitamin)).not.toBeNull();
  });

  it('keeps navigation allowed: home and map buttons', () => {
    expect(isForbiddenTarget(doc.querySelector('[data-menu="home"]') as Element)).toBeNull();
    expect(isForbiddenTarget(doc.querySelector('[onclick="showLeagueModal()"]') as Element)).toBeNull();
  });

  it('allows normal game controls', () => {
    expect(isForbiddenTarget(doc.querySelector('#run-menu-toggle') as Element)).toBeNull();
    const node = doc.querySelector('g.map-node, .map-node');
    expect(node).toBeTruthy();
    expect(isForbiddenTarget(node as Element)).toBeNull();
  });

  it('allows only Shift+Digit1..6 as keys', () => {
    expect(isKeyAllowed('KeyR', 'r', {})).toBe(false);
    expect(isKeyAllowed('KeyR', 'R', { shift: true })).toBe(false);
    expect(isKeyAllowed('Digit3', '3', {})).toBe(false);
    expect(isKeyAllowed('Digit3', '3', { shift: true })).toBe(true);
    expect(isKeyAllowed('Digit6', '6', { shift: true })).toBe(true);
    expect(isKeyAllowed('Digit7', '7', { shift: true })).toBe(false);
    expect(isKeyAllowed('Digit3', '3', { shift: true, alt: true })).toBe(false);
  });

  it('Actor.click on Reset Run rejects before any event is fired', async () => {
    let events = 0;
    for (const t of ['pointerdown', 'mousedown', 'click']) reset.addEventListener(t, () => events++);
    await expect(new Actor({ microDelay: 0 }).click(reset)).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(events).toBe(0);
  });

  it('Actor.drag onto or from a forbidden target rejects', async () => {
    const node = doc.querySelector('g.map-node, .map-node') as Element;
    await expect(new Actor({ microDelay: 0 }).drag(node, reset)).rejects.toBeInstanceOf(ForbiddenActionError);
    await expect(new Actor({ microDelay: 0 }).drag(account, node)).rejects.toBeInstanceOf(ForbiddenActionError);
  });

  it('Actor.pressKey("R") rejects and dispatches nothing', async () => {
    let keys = 0;
    doc.addEventListener('keydown', () => keys++);
    await expect(new Actor({ microDelay: 0 }).pressKey(doc, 'KeyR', 'r')).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(keys).toBe(0);
  });
});
