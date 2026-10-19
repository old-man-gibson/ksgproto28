import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { SPOTS } from '../src/core/registry';
import { getDerivedStats } from '../src/core/systems/derived';
import { applyStatus, hasStatus } from '../src/core/systems/statuses';
import { inForcedFight, liveEnemies, startStagedFight } from '../src/core/systems/combat';
import {
  HOLD_KEY,
  attrTotal,
  holdingForDare,
  keeperTends,
  pendingDare,
  winsUntilDare,
} from '../src/core/systems/training';
import { checkTitleUnlocks, hasTitle, setTitle } from '../src/core/systems/titles';

const CAGES = SPOTS.the_cages;
const EVERY = CAGES.dare!.every;
const CAP = CAGES.healBetweenBouts!.maxAttrTotal;

/** A beginner standing in the Cages, as the hunt leaves them after a win. */
function atTheCages(seed = 1) {
  const g = new Game(createInitialState(seed));
  g.state.spot = 'the_cages';
  return g;
}
const win = (g: Game, forced = false) => g.bus.emit({ type: 'fight:won', spot: 'the_cages', forced });

describe('the cage keeper patches up beginners', () => {
  it('a win heals to full and clears bleeding while the attributes are under the cap', () => {
    const g = atTheCages();
    expect(attrTotal(g.state)).toBeLessThanOrEqual(CAP);
    g.state.resources.hp = 5;
    applyStatus(g.state, g.state, { id: 'bleeding', intensity: 3 }, 'a goblin');
    expect(hasStatus(g.state, 'bleeding')).toBe(true);
    win(g);
    expect(g.state.resources.hp).toBeCloseTo(getDerivedStats(g.state).maxHp, 5);
    expect(hasStatus(g.state, 'bleeding')).toBe(false);
  });

  it('stops once the six attributes total more than the cap', () => {
    const g = atTheCages();
    g.state.attrs.str.level = CAP; // with five others at 1+, the total is past it
    expect(keeperTends(g.state, CAGES)).toBe(false);
    g.state.resources.hp = 5;
    win(g);
    expect(g.state.resources.hp).toBe(5);
  });

  it('only at the spot that has a keeper', () => {
    const g = new Game(createInitialState(1));
    g.state.spot = 'f0_field';
    g.state.resources.hp = 5;
    g.bus.emit({ type: 'fight:won', spot: 'f0_field', forced: false });
    expect(g.state.resources.hp).toBe(5);
  });
});

describe("the keeper's dare holds play", () => {
  it(`comes after ${EVERY} wins, and the dare's own forced fight never counts`, () => {
    const g = atTheCages();
    for (let i = 0; i < EVERY - 1; i++) win(g);
    win(g, true); // a forced win: not a cage bout
    expect(pendingDare(g.state)).toBeNull();
    expect(winsUntilDare(g.state, CAGES)).toBe(1);
    win(g);
    expect(pendingDare(g.state)?.id).toBe('the_cages');
  });

  it('while held, ticks bank bonus time and move nothing; the step buttons do nothing at all', () => {
    const g = atTheCages();
    for (let i = 0; i < EVERY; i++) win(g);
    const ticks = g.state.totalTicks;
    const banked = g.state.bonusTime.banked;
    for (let i = 0; i < 50; i++) g.tick();
    expect(g.state.totalTicks).toBe(ticks);
    expect(g.state.bonusTime.banked).toBe(banked + 50);
    g.step(50);
    g.stepToEvent();
    expect(g.state.totalTicks).toBe(ticks);
    expect(g.state.bonusTime.banked).toBe(banked + 50);
  });

  it('fleeing lifts the hold and the cages carry on', () => {
    const g = atTheCages();
    for (let i = 0; i < EVERY; i++) win(g);
    expect(g.answerDare(false)).toBe(true);
    expect(holdingForDare(g.state)).toBe(false);
    expect(g.state.combat).toBeNull();
    const ticks = g.state.totalTicks;
    g.tick();
    expect(g.state.totalTicks).toBe(ticks + 1);
    expect(winsUntilDare(g.state, CAGES)).toBe(EVERY);
  });

  it('fighting starts the staged slime: alone, plain, and unfleeable', () => {
    const g = atTheCages();
    for (let i = 0; i < EVERY; i++) win(g);
    g.answerDare(true);
    expect(inForcedFight(g.state)).toBe(true);
    const foes = liveEnemies(g.state.combat!);
    expect(foes.map((m) => m.defId)).toEqual(['suspiciously_large_slime']);
    expect(foes[0].level).toBe(CAGES.dare!.level);
    expect(foes[0].modifier).toBe('normal');
    expect(foes[0].rarity).toBe('common');
  });

  it('a stale hold with no dare behind it is dropped instead of freezing the game', () => {
    const g = atTheCages();
    g.state.stats[HOLD_KEY] = 1;
    const ticks = g.state.totalTicks;
    g.tick();
    expect(g.state.totalTicks).toBe(ticks + 1);
    expect(holdingForDare(g.state)).toBe(false);
  });

  it('stops asking once the slime is beaten, and never asks a player past the cap', () => {
    const beaten = atTheCages();
    beaten.state.stats['kills:suspiciously_large_slime'] = 1;
    for (let i = 0; i < EVERY * 2; i++) win(beaten);
    expect(pendingDare(beaten.state)).toBeNull();

    const grown = atTheCages();
    grown.state.attrs.con.level = CAP;
    for (let i = 0; i < EVERY * 2; i++) win(grown);
    expect(pendingDare(grown.state)).toBeNull();
  });
});

describe('David and Goslimath', () => {
  it('beating the slime earns the hidden title; it pays per size step against larger things', () => {
    const g = atTheCages();
    expect(hasTitle(g.state, 'david_and_goslimath')).toBe(false);
    g.state.stats['kills:suspiciously_large_slime'] = 1;
    checkTitleUnlocks(g.state, g.bus);
    expect(hasTitle(g.state, 'david_and_goslimath')).toBe(true);
    // Earned: the small part always applies. Worn: the large part on top.
    expect(getDerivedStats(g.state).vsLarger).toBeCloseTo(0.03, 6);
    setTitle(g.state, g.bus, 'david_and_goslimath');
    expect(getDerivedStats(g.state).vsLarger).toBeCloseTo(0.18, 6);
  });

  it('the bonus shows up in the blow against something one size step up', () => {
    const g = atTheCages(7);
    g.state.stats['kills:suspiciously_large_slime'] = 1;
    checkTitleUnlocks(g.state, g.bus);
    setTitle(g.state, g.bus, 'david_and_goslimath');
    // A rematch, staged directly: once beaten, the keeper no longer asks.
    startStagedFight(g.state, g.bus, CAGES, 'suspiciously_large_slime', CAGES.dare!.level);
    for (let i = 0; i < 600 && g.state.combat; i++) g.tick();
    const mine = g.state.combatFeed
      .map((l) => l.damage)
      .filter((d) => d !== undefined && !d.incoming);
    expect(mine.length).toBeGreaterThan(0);
    const step = mine[0]!.steps.find((s) => s.label === 'Under its guard');
    expect(step?.mult).toBeCloseTo(1.18, 6);
  });
});
