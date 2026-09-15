import { describe, expect, it } from 'vitest';
import { SHELVED_START } from './fixtures/shelved-world';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { deserialize, serialize } from '../src/core/save/save';
import { findPath, journeyEnd } from '../src/core/systems/locations';
import { BONUS_CAP_TICKS, isIdle } from '../src/core/systems/bonustime';
import { activityXpTags, spotActivities, trainingSpots } from '../src/core/systems/actions';
import { hasWayfinding } from '../src/core/systems/legacy';
import { skillTrainedBy } from '../src/core/systems/skills';
import { SKILLS, SPOTS } from '../src/core/registry';

// Written on the shelved countryside (tests/fixtures/shelved-world.ts):
// village_square (rest_inn, train_cha) ↔ training_grounds (train_str), 30 ticks.
const fresh = (seed: number) => new Game(createInitialState(seed, SHELVED_START));

function discovered(g: Game, ...spots: string[]): void {
  for (const s of spots) if (!g.state.discovered.includes(s)) g.state.discovered.push(s);
}

function walkUntilStill(g: Game, max = 2000): void {
  for (let i = 0; i < max && g.state.travel; i++) g.tick();
}

describe('resume on return', () => {
  it('restarts the last activity chosen at a spot on arrival', () => {
    const g = fresh(1);
    discovered(g, 'training_grounds');
    g.selectActivity('train_cha');
    g.travelTo('training_grounds');
    expect(g.state.activity).toBeNull();
    walkUntilStill(g);
    expect(g.state.spot).toBe('training_grounds');
    expect(g.state.activity).toBeNull(); // never chose anything here

    g.selectActivity('train_str');
    g.travelTo('village_square');
    walkUntilStill(g);
    expect(g.state.activity).toBe('train_cha');

    g.travelTo('training_grounds');
    walkUntilStill(g);
    expect(g.state.activity).toBe('train_str');
  });

  it('forgets a spot the player stopped working at by hand', () => {
    const g = fresh(2);
    discovered(g, 'training_grounds');
    g.selectActivity('train_cha');
    g.selectActivity(null);
    g.travelTo('training_grounds');
    walkUntilStill(g);
    g.travelTo('village_square');
    walkUntilStill(g);
    expect(g.state.activity).toBeNull();
  });

  it('does not resume at an intermediate halt of a longer journey', () => {
    const g = fresh(3);
    discovered(g, 'woods_edge', 'deep_woods');
    g.state.resumeActivity['woods_edge'] = 'rest_camp';
    g.travelPlanTo('deep_woods');
    for (let i = 0; i < 2000 && g.state.spot !== 'woods_edge'; i++) g.tick();
    expect(g.state.travel).not.toBeNull(); // straight on to the next leg
    expect(g.state.activity).toBeNull();
  });
});

describe('go and do', () => {
  it('walks there and starts the activity on arrival, over any resume entry', () => {
    const g = fresh(4);
    discovered(g, 'training_grounds');
    g.state.resumeActivity['training_grounds'] = 'train_dex';
    expect(g.goAndDo('training_grounds', 'train_str')).toBe(true);
    expect(g.state.travelIntent).toEqual({ spot: 'training_grounds', activity: 'train_str' });
    walkUntilStill(g);
    expect(g.state.activity).toBe('train_str');
    expect(g.state.travelIntent).toBeNull();
  });

  it('starts at once when already standing there', () => {
    const g = fresh(5);
    expect(g.goAndDo('village_square', 'train_cha')).toBe(true);
    expect(g.state.activity).toBe('train_cha');
    expect(g.state.travel).toBeNull();
  });

  it('refuses an activity the destination does not have', () => {
    const g = fresh(6);
    discovered(g, 'training_grounds');
    expect(g.goAndDo('training_grounds', 'train_cha')).toBe(false);
    expect(g.state.travel).toBeNull();
  });

  it('cancelling the journey drops the intent; a plain map walk carries none', () => {
    const g = fresh(7);
    discovered(g, 'woods_edge', 'deep_woods');
    g.goAndDo('deep_woods', 'rest_camp');
    g.cancelTravelPlan();
    expect(g.state.travelIntent).toBeNull();
    walkUntilStill(g);
    expect(g.state.activity).toBeNull();

    g.state.travelIntent = { spot: 'village_square', activity: 'train_cha' }; // stale
    g.travelPlanTo('village_square');
    expect(g.state.travelIntent).toBeNull();
  });

  it('the journey in progress can be given (or relieved of) a purpose', () => {
    const g = fresh(8);
    discovered(g, 'training_grounds');
    g.travelTo('training_grounds');
    expect(journeyEnd(g.state)).toBe('training_grounds');
    expect(g.setJourneyIntent('train_cha')).toBe(false); // not at that end
    expect(g.setJourneyIntent('train_con')).toBe(true);
    walkUntilStill(g);
    expect(g.state.activity).toBe('train_con');
  });

  it('routes to an unknown place one road past known ground', () => {
    const g = fresh(9);
    // training_grounds is undiscovered but a visible road away.
    expect(findPath(g.state, 'village_square', 'training_grounds')).toBeNull();
    expect(findPath(g.state, 'village_square', 'training_grounds', { unknownDest: true })).toEqual([
      'training_grounds',
    ]);
    expect(g.travelPlanTo('training_grounds')).toBe(true);
    walkUntilStill(g);
    expect(g.state.discovered).toContain('training_grounds');
  });

  it('the intent survives a save mid-journey', () => {
    const g = fresh(10);
    discovered(g, 'training_grounds');
    g.goAndDo('training_grounds', 'train_str');
    g.tick();
    const loaded = new Game(deserialize(serialize(g.state)));
    walkUntilStill(loaded);
    expect(loaded.state.activity).toBe('train_str');
  });
});

describe('banked idle time', () => {
  it('banks one tick per idle tick and nothing while working', () => {
    const g = fresh(11);
    expect(isIdle(g.state)).toBe(true);
    for (let i = 0; i < 50; i++) g.tick();
    expect(g.state.bonusTime.banked).toBe(50);
    g.selectActivity('train_cha');
    for (let i = 0; i < 50; i++) g.tick();
    expect(g.state.bonusTime.banked).toBe(50);
  });

  it('banks nothing while paused', () => {
    const g = fresh(12);
    g.setPaused(true);
    for (let i = 0; i < 50; i++) g.tick();
    expect(g.state.bonusTime.banked).toBe(0);
  });

  it('caps the bank', () => {
    const g = fresh(13);
    g.state.bonusTime.banked = BONUS_CAP_TICKS;
    g.tick();
    expect(g.state.bonusTime.banked).toBe(BONUS_CAP_TICKS);
  });

  it('spending doubles working ticks, one banked tick each, and never spends on idleness', () => {
    const g = fresh(14);
    g.state.bonusTime.banked = 10;
    g.setBonusSpending(true);
    const t0 = g.state.totalTicks;
    g.tick(); // idle: no double, banks one instead
    expect(g.state.totalTicks).toBe(t0 + 1);
    expect(g.state.bonusTime.banked).toBe(11);

    discovered(g, 'training_grounds');
    g.travelTo('training_grounds'); // 30 ticks
    let calls = 0;
    while (g.state.travel && calls < 100) {
      g.tick();
      calls++;
    }
    // 11 doubled calls cover 22 ticks of the walk, then 8 single ones.
    expect(calls).toBe(19);
    expect(g.state.bonusTime.banked).toBe(0);
  });

  it('is off by default and the choice survives a save', () => {
    const g = fresh(15);
    expect(g.state.bonusTime.spending).toBe(false);
    g.setBonusSpending(true);
    const loaded = deserialize(serialize(g.state));
    expect(loaded.bonusTime.spending).toBe(true);
  });
});

describe('wayfinding', () => {
  it('lists discovered spots whose activities train a skill or an attribute', () => {
    const g = fresh(16);
    // Strength trains at the grounds, but only once the grounds are known.
    expect(trainingSpots(g.state, { attr: 'str' })).toEqual([]);
    discovered(g, 'training_grounds');
    const str = trainingSpots(g.state, { attr: 'str' });
    expect(str).toContainEqual({ spot: 'training_grounds', activity: 'train_str' });
    expect(str.every((t) => t.spot === 'training_grounds')).toBe(true);
    expect(trainingSpots(g.state, { attr: 'cha' })).toContainEqual({ spot: 'village_square', activity: 'train_cha' });
  });

  it('a skill trains wherever an activity carries its tags — the same tags the tick pays', () => {
    const g = fresh(17);
    discovered(g, 'training_grounds', 'woods_edge');
    const def = Object.values(SKILLS).find((s) => s.tags.includes('explore'))!;
    const spots = trainingSpots(g.state, { skill: def.id });
    expect(spots).toContainEqual({ spot: 'woods_edge', activity: 'explore' });
    for (const t of spots) {
      const act = spotActivities(SPOTS[t.spot]).find((a) => a.id === t.activity)!;
      expect(skillTrainedBy(def, activityXpTags(act))).toBe(true);
    }
  });

  it('is a boon: off on a fresh save, on once bought', () => {
    const g = fresh(18);
    expect(hasWayfinding(g.state)).toBe(false);
    g.state.prestige.purchases.wayfinding = 1;
    expect(hasWayfinding(g.state)).toBe(true);
  });
});
