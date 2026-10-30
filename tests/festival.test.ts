import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { FLOORS, SPOTS, TOWERS } from '../src/core/registry';
import {
  ARENA,
  DARK_FLOOR,
  DARK_ROOM,
  DARK_ROOM_WAVES,
  FESTIVAL_DOOR_KEY,
  FESTIVAL_WINS_KEY,
  LOCKOUT_TICKS,
  PREP_TICKS,
  ROYALE_FLOOR,
  SURVIVOR_LEVELS,
  weaponKillsKey,
} from '../src/core/data/festival.data';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { festivalHolds, festivalLocked, festivalRun, lockoutLeft, survivorLevel } from '../src/core/systems/festivalRules';
import { issuedWeapon } from '../src/core/systems/festival';
import { floorCleared, floorUnlocked } from '../src/core/systems/ladder';
import { prestigeNow } from '../src/core/systems/prestige';
import { getDerivedStats } from '../src/core/systems/derived';
import { createItem } from '../src/core/systems/runes';
import { runOfflineProgress } from '../src/core/save/offline';
import { BONUS_CAP_TICKS } from '../src/core/systems/bonustime';
import { MS_PER_TICK } from '../src/core/engine/loop';
import type { GameState } from '../src/core/types';
import { clearFloors } from './fixtures/floors';

/**
 * The Vermin Festival, floors 15–16 (docs/FLOOR_IDEAS.md §5.3 items 6,
 * 10–20, 23–25; systems/festival.ts).
 */

const FOOT = TOWERS.the_ascent.hubSpot;
const BELOW = Object.values(FLOORS)
  .filter((f) => f.bandId !== undefined && f.index < 15)
  .map((f) => f.id);

/** A save on floor 14's landing with every floor below the festival cleared. */
function atFourteen(): GameState {
  const s = createInitialState(0);
  clearFloors(s.stats, BELOW);
  s.spot = FLOORS.ascent_f14.landing!;
  s.discovered.push(s.spot);
  return s;
}

/** Far past anything on floors 15–16, so a test of the flow is not a test of the balance. */
function strong(s: GameState): GameState {
  for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 400;
  s.resources.hp = getDerivedStats(s).maxHp;
  return s;
}

/** Wear and carry a few pieces, so the hold has something to hold. */
function geared(s: GameState): GameState {
  const sword = createItem(s, 'iron_sword');
  const vest = createItem(s, 'leather_vest');
  s.equipment.weapon = sword;
  s.equipment.chest = vest;
  s.inventory.push(createItem(s, 'old_spear'));
  return s;
}

/** Ride the ladder and tick until the ride lands. */
function climb(game: Game, floorId: string | null): void {
  expect(game.climbTo(floorId), `climb to ${floorId}`).toBe(true);
  for (let i = 0; i < 2000 && game.state.travel; i++) game.tick();
  expect(game.state.travel).toBeNull();
}

/** Tick until `done` holds, at most `max` ticks. */
function tickUntil(game: Game, done: () => boolean, max = 50_000): void {
  for (let i = 0; i < max && !done(); i++) game.tick();
  expect(done(), 'condition never held').toBe(true);
}

/** A festival attempt with the dark room emptied: standing in the hall, the clock at the door. */
function inHall(s = strong(atFourteen())): Game {
  const game = new Game(s);
  climb(game, DARK_FLOOR);
  tickUntil(game, () => festivalRun(game.state)?.phase === 'prep');
  game.travelTo('f15_hall');
  for (let i = 0; i < 200 && game.state.travel; i++) game.tick();
  expect(game.state.spot).toBe('f15_hall');
  return game;
}

const uids = (items: { uid: number }[]) => items.map((i) => i.uid).sort((a, b) => a - b);

describe('the door: gear held and returned', () => {
  it('holds everything worn and carried, and issues one plain weapon', () => {
    const s = geared(atFourteen());
    const worn = uids(Object.values(s.equipment).filter((i) => !!i) as { uid: number }[]);
    const carried = uids(s.inventory);
    const game = new Game(s);
    climb(game, DARK_FLOOR);
    expect(s.spot).toBe(DARK_ROOM);
    const run = festivalRun(s)!;
    expect(run.phase).toBe('dark');
    expect(uids(Object.values(run.held.equipment) as { uid: number }[])).toEqual(worn);
    expect(uids(run.held.inventory)).toEqual(carried);
    // On the player: the issued weapon and nothing else.
    expect(s.inventory).toEqual([]);
    expect(Object.keys(s.equipment)).toEqual(['weapon']);
    expect(s.equipment.weapon!.uid).toBe(run.issued);
    expect(s.equipment.weapon!.slots).toBe(0);
    expect(s.equipment.weapon!.affix).toBeUndefined();
  });

  it('returns the held set and takes the issued weapon back when the attempt is lost', () => {
    const s = geared(atFourteen());
    const before = uids([...(Object.values(s.equipment) as { uid: number }[]), ...s.inventory]);
    const game = new Game(s);
    climb(game, DARK_FLOOR);
    const issued = festivalRun(s)!.issued!;
    climb(game, 'ascent_f14'); // the ladder out: a forfeit
    const after = [...(Object.values(s.equipment) as { uid: number }[]), ...s.inventory];
    expect(uids(after)).toEqual(before);
    expect(after.some((i) => i.uid === issued)).toBe(false);
    expect(s.equipment.weapon?.defId).toBe('iron_sword');
    expect(s.equipment.chest?.defId).toBe('leather_vest');
  });

  it('returns the held set when the royale is won', () => {
    const s = strong(geared(atFourteen()));
    const before = uids([...(Object.values(s.equipment) as { uid: number }[]), ...s.inventory]);
    const game = inHall(s);
    climb(game, ROYALE_FLOOR);
    tickUntil(game, () => !festivalRun(game.state));
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(1);
    expect(uids([...(Object.values(s.equipment) as { uid: number }[]), ...s.inventory])).toEqual(before);
    expect(s.equipment.weapon?.defId).toBe('iron_sword');
  });
});

describe('the issued weapon', () => {
  it('is the family with the highest weapon skill', () => {
    const s = createInitialState(0);
    s.skills.spear_combat = { level: 12, xp: 0 };
    s.skills.swordsmanship = { level: 9, xp: 0 };
    s.stats[weaponKillsKey('sword')] = 500;
    expect(issuedWeapon(s).item).toBe('old_spear');
  });

  it('breaks a tie on skill by kills with the family', () => {
    const s = createInitialState(0);
    s.skills.dagger_combat = { level: 10, xp: 0 };
    s.skills.club_combat = { level: 10, xp: 0 };
    s.stats[weaponKillsKey('dagger')] = 3;
    s.stats[weaponKillsKey('blunt')] = 7;
    expect(issuedWeapon(s).item).toBe('old_hammer');
  });

  it('is the rusty sword with no weapon skill, and bare hands for an unarmed fighter', () => {
    expect(issuedWeapon(createInitialState(0)).item).toBe('rusty_sword');
    const s = createInitialState(0);
    s.skills.unarmed_combat = { level: 20, xp: 0 };
    expect(issuedWeapon(s).item).toBeNull();
  });

  it('kills are counted by the family in hand', () => {
    const game = inHall();
    // The dark room's nine fell to the issued rusty sword.
    expect(game.state.stats[weaponKillsKey('sword')]).toBe(DARK_ROOM_WAVES.flat().length);
  });
});

describe('the dark room', () => {
  it('fights its nine in waves; the door opens when the room is empty', () => {
    const game = new Game(strong(atFourteen()));
    climb(game, DARK_FLOOR);
    const s = game.state;
    expect(s.stats[FESTIVAL_DOOR_KEY]).toBe(0);
    // The way to the hall is shut while the room fights.
    expect(game.travelTo('f15_hall')).toBe(false);
    tickUntil(game, () => festivalRun(s)?.phase === 'prep');
    expect(s.stats[FESTIVAL_DOOR_KEY]).toBe(1);
    expect(s.stats['boss:f15_dark_room']).toBe(1);
    expect(floorCleared(s, FLOORS[DARK_FLOOR])).toBe(true);
    expect(s.stats['kills']).toBe(DARK_ROOM_WAVES.flat().length);
  });

  it('the climb to floor 16 is shut until the room is empty', () => {
    const s = strong(atFourteen());
    s.stats['boss:f15_dark_room'] = 1; // a room emptied in an earlier attempt
    const game = new Game(s);
    climb(game, DARK_FLOOR);
    expect(game.climbTo(ROYALE_FLOOR)).toBe(false);
    expect(festivalRun(s)?.phase).toBe('dark');
  });
});

describe('the festival clock', () => {
  it('starts at the door and runs while the game runs on its floors', () => {
    const game = inHall();
    const run = festivalRun(game.state)!;
    const at = run.clock;
    for (let i = 0; i < 100; i++) game.tick();
    expect(festivalRun(game.state)!.clock).toBe(at + 100);
  });

  it('pauses offline: nothing is simulated, and the time away is banked 1:1', () => {
    const game = inHall();
    const s = game.state;
    const clock = festivalRun(s)!.clock;
    const ticks = s.totalTicks;
    const banked = s.bonusTime.banked;
    const kills = s.stats['kills'];
    expect(festivalHolds(s)).toBe(true);
    const summary = runOfflineProgress(game, 2 * 60 * 60 * 1000)!;
    expect(s.totalTicks).toBe(ticks);
    expect(festivalRun(s)!.clock).toBe(clock);
    expect(s.stats['kills']).toBe(kills);
    expect(s.bonusTime.banked - banked).toBe((2 * 60 * 60 * 1000) / MS_PER_TICK);
    expect(summary.festivalBanked).toBe((2 * 60 * 60 * 1000) / MS_PER_TICK);
    expect(summary.ticks).toBe(0);
  });

  it('banks at most the cap, and a short gap banks too', () => {
    const game = inHall();
    const s = game.state;
    s.bonusTime.banked = 0;
    expect(runOfflineProgress(game, 30 * 1000)).toBeNull();
    expect(s.bonusTime.banked).toBe((30 * 1000) / MS_PER_TICK);
    runOfflineProgress(game, 24 * 60 * 60 * 1000);
    expect(s.bonusTime.banked).toBe(BONUS_CAP_TICKS);
  });

  it('runs no catch-up for the world outside either', () => {
    const s = atFourteen();
    // Outside the festival, offline time is simulated as before.
    const game = new Game(s);
    const ticks = s.totalTicks;
    runOfflineProgress(game, 5 * 60 * 1000);
    expect(s.totalTicks).toBeGreaterThan(ticks);
  });
});

describe('the time jump', () => {
  it('climbing into the royale early sets the clock to day ten and keeps the entry time', () => {
    const game = inHall();
    const s = game.state;
    for (let i = 0; i < 300; i++) game.tick();
    const at = festivalRun(s)!.clock;
    expect(at).toBeLessThan(PREP_TICKS);
    expect(game.climbTo(ROYALE_FLOOR)).toBe(true);
    const run = festivalRun(s)!;
    expect(run.phase).toBe('royale');
    expect(run.enteredAt).toBe(at);
    expect(run.clock).toBe(PREP_TICKS);
  });

  it('the survivors get the rest of their preparation either way', () => {
    const full = SURVIVOR_LEVELS.base + SURVIVOR_LEVELS.growth;
    expect(survivorLevel(PREP_TICKS, 99)).toBe(full);
    expect(survivorLevel(0, 99)).toBe(SURVIVOR_LEVELS.base);
    // The jump: whatever the clock read, the field opens at the full curve.
    const game = inHall();
    climb(game, ROYALE_FLOOR);
    tickUntil(game, () => !!game.state.combat);
    const foe = game.state.combat!.enemies[0]!;
    expect(foe.level).toBeGreaterThanOrEqual(full);
  });

  it('day ten walks the player up to floor 16 on its own', () => {
    const game = inHall();
    festivalRun(game.state)!.clock = PREP_TICKS - 1;
    tickUntil(game, () => game.state.spot === ARENA, 500);
    expect(festivalRun(game.state)!.phase).toBe('royale');
    expect(festivalRun(game.state)!.enteredAt).toBe(PREP_TICKS);
  });
});

describe('losing: ejection and the lockout', () => {
  it('a knockout in the dark room lands outside the tower and shuts both floors', () => {
    const game = new Game(geared(atFourteen()));
    const s = game.state;
    climb(game, DARK_FLOOR);
    // A level-one fighter against the room: the first wave puts them down.
    tickUntil(game, () => s.recovering, 20_000);
    expect(s.spot).toBe(FOOT);
    expect(festivalRun(s)).toBeUndefined();
    expect(lockoutLeft(s)).toBe(LOCKOUT_TICKS);
    expect(floorUnlocked(s, FLOORS[DARK_FLOOR])).toBe(false);
    expect(festivalLocked(s, FLOORS[ROYALE_FLOOR])).toBe(true);
    // The floors above are untouched: the lock shuts, it does not un-clear.
    expect(floorCleared(s, FLOORS.ascent_f14)).toBe(true);
  });

  it('a knockout in the royale ejects too', () => {
    const s = atFourteen();
    s.stats['boss:f15_dark_room'] = 1;
    const game = new Game(strong(s));
    climb(game, DARK_FLOOR);
    tickUntil(game, () => festivalRun(s)?.phase === 'prep');
    climb(game, ROYALE_FLOOR);
    tickUntil(game, () => !!s.combat);
    // Down in one blow: hp to the floor, and the field's next swing finishes it.
    for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 1;
    s.resources.hp = 1;
    tickUntil(game, () => s.recovering, 5_000);
    expect(s.spot).toBe(FOOT);
    expect(festivalRun(s)).toBeUndefined();
    expect(lockoutLeft(s)).toBe(LOCKOUT_TICKS);
  });

  it('the lockout ends after three days of the world clock', () => {
    const game = new Game(geared(atFourteen()));
    const s = game.state;
    climb(game, DARK_FLOOR);
    climb(game, 'ascent_f14');
    expect(floorUnlocked(s, FLOORS[DARK_FLOOR])).toBe(false);
    s.totalTicks += LOCKOUT_TICKS - 1;
    expect(floorUnlocked(s, FLOORS[DARK_FLOOR])).toBe(false);
    s.totalTicks += 1;
    expect(floorUnlocked(s, FLOORS[DARK_FLOOR])).toBe(true);
    expect(game.climbTo(DARK_FLOOR)).toBe(true);
  });

  it('the lockout ends at the next prestige', () => {
    const game = new Game(atFourteen());
    const s = game.state;
    climb(game, DARK_FLOOR);
    climb(game, null);
    expect(lockoutLeft(s)).toBeGreaterThan(0);
    const next = prestigeNow(s, 1)!;
    expect(next).not.toBeNull();
    expect(lockoutLeft(next)).toBe(0);
    clearFloors(next.stats, BELOW);
    expect(floorUnlocked(next, FLOORS[DARK_FLOOR])).toBe(true);
  });

  it('a festival floor is never a haven: a later knockout elsewhere does not land inside it', () => {
    const game = inHall();
    expect(game.state.safeSpots.nearest).not.toBe('f15_hall');
    expect(SPOTS.f15_hall.activities.some((a) => a.kind === 'rest')).toBe(true);
  });
});

describe('the ladder out is a forfeit', () => {
  it('from the dark room between waves: ejected, gear back, both floors shut', () => {
    const game = new Game(geared(atFourteen()));
    const s = game.state;
    climb(game, DARK_FLOOR);
    expect(s.combat).toBeNull();
    expect(game.climbTo('ascent_f12')).toBe(true);
    expect(s.spot).toBe(FOOT);
    expect(s.travel).toBeNull();
    expect(festivalRun(s)).toBeUndefined();
    expect(lockoutLeft(s)).toBe(LOCKOUT_TICKS);
    expect(s.equipment.weapon?.defId).toBe('iron_sword');
  });

  it('from the hall, to the hub, and from the royale back down', () => {
    for (const leave of [(g: Game) => g.climbTo(null), (g: Game) => g.climbTo('ascent_f14')]) {
      const game = inHall();
      expect(leave(game)).toBe(true);
      expect(game.state.spot).toBe(FOOT);
      expect(lockoutLeft(game.state)).toBe(LOCKOUT_TICKS);
    }
    const game = inHall();
    climb(game, ROYALE_FLOOR);
    expect(game.state.combat).toBeNull();
    expect(game.climbTo(DARK_FLOOR)).toBe(true);
    expect(game.state.spot).toBe(FOOT);
    expect(lockoutLeft(game.state)).toBe(LOCKOUT_TICKS);
  });

  it('refuses during a fight, as every climb does', () => {
    const game = new Game(strong(atFourteen()));
    climb(game, DARK_FLOOR);
    tickUntil(game, () => !!game.state.combat);
    expect(game.climbTo('ascent_f14')).toBe(false);
    expect(festivalRun(game.state)).toBeDefined();
  });

  it('walking within a floor is not leaving it', () => {
    const game = inHall();
    climb(game, DARK_FLOOR); // the hall back to the landing: a crossing
    expect(game.state.spot).toBe(DARK_ROOM);
    expect(festivalRun(game.state)?.phase).toBe('prep');
  });
});

describe('the royale', () => {
  it('a win clears floor 16 and counts the run\'s win; the field is empty after', () => {
    const game = inHall();
    const s = game.state;
    climb(game, ROYALE_FLOOR);
    tickUntil(game, () => !festivalRun(s));
    expect(s.stats['boss:f16_arena']).toBe(1);
    expect(floorCleared(s, FLOORS[ROYALE_FLOOR])).toBe(true);
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(1);
    expect(lockoutLeft(s)).toBe(0);
    // Nothing fights on an empty field.
    for (let i = 0; i < 500; i++) game.tick();
    expect(s.combat).toBeNull();
    expect(s.spot).toBe(ARENA);
  });
});
