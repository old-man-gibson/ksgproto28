import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { FLOORS, SPOTS, TITLES, TOWERS } from '../src/core/registry';
import {
  ARENA,
  CACHE_WEAPONS,
  DARK_FLOOR,
  DARK_ROOM,
  DARK_ROOM_WAVES,
  DEFAULT_ROYALE_PLAN,
  FESTIVAL_DOOR_KEY,
  FESTIVAL_REWARD,
  FESTIVAL_SWIFT_KEY,
  FESTIVAL_WINS_KEY,
  LOCKOUT_TICKS,
  PREP_TICKS,
  ROYALE_CACHES,
  ROYALE_DENS,
  ROYALE_FIELD,
  ROYALE_FLOOR,
  ROYALE_LAYOUT_VERSION,
  ROYALE_SECTIONS,
  SURVIVOR_LEVELS,
  SWIFT_ENTRY_TICKS,
  TOKEN_BONUS,
  TOKEN_REGALIA,
  TOKEN_TECHNIQUES,
  weaponKillsKey,
} from '../src/core/data/festival.data';
import { stashItem, stashToken, tokenTechniques } from '../src/core/systems/stash';
import { royaleFightWon, royalePlan } from '../src/core/systems/royale';
import { sectionIdOf, type RoyaleMap } from '../src/core/systems/royaleMap';
import { mapOf } from '../src/core/systems/royaleTerrain';
import { EventBus } from '../src/core/engine/events';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import {
  festivalHolds,
  festivalLadder,
  festivalLocked,
  festivalRun,
  lockoutLeft,
  survivorLevel,
} from '../src/core/systems/festivalRules';
import { issuedWeapon } from '../src/core/systems/festival';
import { floorCleared, floorUnlocked } from '../src/core/systems/ladder';
import { prestigeNow } from '../src/core/systems/prestige';
import { getDerivedStats } from '../src/core/systems/derived';
import { createItem } from '../src/core/systems/runes';
import { OFFLINE_CAP_MS, catchUpTicks, runOfflineProgress } from '../src/core/save/offline';
import { deserialize, serialize } from '../src/core/save/save';
import { BONUS_CAP_TICKS } from '../src/core/systems/bonustime';
import { MS_PER_TICK } from '../src/core/engine/loop';
import type { FestivalRun, GameState, RoyaleField } from '../src/core/types';
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
    // The held set, plus the first win's reward in the pack.
    const after = [...(Object.values(s.equipment) as { uid: number; defId: string }[]), ...s.inventory];
    expect(uids(after.filter((i) => i.defId !== FESTIVAL_REWARD))).toEqual(before);
    expect(s.equipment.weapon?.defId).toBe('iron_sword');
  });

  it('holds flasks and provisions, leaves cards, and adds the held ones to what the attempt left', () => {
    const s = atFourteen();
    s.flasks = [{ steps: [] }, { steps: [] }];
    s.stock.travelers_ration = { c: 4, b: 1 };
    s.materials.healing_salve = 2; // a plain count is held as well as graded stock
    s.materials.recipe_herb_rubbed_meat = 1;
    const game = new Game(s);
    climb(game, DARK_FLOOR);
    const held = festivalRun(s)!.held;
    expect(held.flasks).toHaveLength(2);
    expect(held.provisions!.stock.travelers_ration).toEqual({ c: 4, b: 1 });
    expect(held.provisions!.materials.healing_salve).toBe(2);
    expect(s.flasks).toEqual([]);
    expect(s.stock.travelers_ration).toBeUndefined();
    expect(s.materials.healing_salve).toBeUndefined();
    expect(s.materials.recipe_herb_rubbed_meat).toBe(1);
    // The stores' rations, found during the attempt, are kept on top.
    s.stock.travelers_ration = { c: 2 };
    climb(game, 'ascent_f14');
    expect(s.flasks).toHaveLength(2);
    expect(s.stock.travelers_ration).toEqual({ c: 6, b: 1 });
    expect(s.materials.healing_salve).toBe(2);
  });

  it('a find worn at the end stays worn; the held piece for that slot goes to the pack', () => {
    const s = geared(atFourteen());
    const heldVest = s.equipment.chest!.uid;
    const game = new Game(s);
    climb(game, DARK_FLOOR);
    const found = createItem(s, 'leather_vest');
    s.equipment.chest = found;
    climb(game, 'ascent_f14');
    expect(s.equipment.chest!.uid).toBe(found.uid);
    expect(s.inventory.some((i) => i.uid === heldVest)).toBe(true);
    // The issued weapon was taken back, so the held sword's slot was free.
    expect(s.equipment.weapon?.defId).toBe('iron_sword');
  });

  it('a held piece never goes back into a hand the body lost during the attempt', () => {
    const s = atFourteen();
    s.mutagens.chromosome.main = { id: 'dvibahu', quality: 'c' };
    const shield = createItem(s, 'wooden_shield');
    const dagger = createItem(s, 'iron_dagger');
    s.equipment.offhand = shield;
    s.equipment.hand3 = dagger;
    const game = new Game(s);
    climb(game, DARK_FLOOR);
    s.mutagens.chromosome.main = null; // the third arm is gone
    climb(game, 'ascent_f14');
    expect(s.equipment.offhand?.uid).toBe(shield.uid);
    expect(s.equipment.hand3).toBeUndefined();
    expect(s.inventory.some((i) => i.uid === dagger.uid)).toBe(true);
  });

  it('an attempt started before the door took flasks returns its gear all the same', () => {
    const s = geared(atFourteen());
    s.flasks = [{ steps: [] }];
    const game = new Game(s);
    climb(game, DARK_FLOOR);
    const held = festivalRun(s)!.held;
    delete held.flasks;
    delete held.provisions;
    climb(game, 'ascent_f14');
    expect(s.equipment.weapon?.defId).toBe('iron_sword');
    expect(s.flasks).toEqual([]);
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

  it('cannot be sold: it is lent for the attempt', () => {
    const game = new Game(strong(atFourteen()));
    const s = game.state;
    climb(game, DARK_FLOOR);
    const issued = festivalRun(s)!.issued!;
    game.unequip('weapon');
    expect(s.inventory.some((i) => i.uid === issued)).toBe(true);
    const gold = s.gold;
    game.sell(issued);
    game.sellMany([issued]);
    expect(s.gold).toBe(gold);
    expect(s.inventory.some((i) => i.uid === issued)).toBe(true);
    // Anything else still sells.
    const other = createItem(s, 'iron_sword');
    s.inventory.push(other);
    game.sellMany([issued, other.uid]);
    expect(s.inventory.some((i) => i.uid === other.uid)).toBe(false);
    expect(s.inventory.some((i) => i.uid === issued)).toBe(true);
    expect(s.gold).toBeGreaterThan(gold);
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

  it('floor 16 has no door of its own: with no attempt the ladder refuses it, though floor 15 reads cleared', () => {
    // A room emptied, then the attempt lost from the hall: the dark room's
    // latch stays, so the ladder reads floor 15 cleared and floor 16 open.
    const game = new Game(strong(atFourteen()));
    const s = game.state;
    climb(game, DARK_FLOOR);
    tickUntil(game, () => festivalRun(s)?.phase === 'prep');
    climb(game, null); // the forfeit
    s.totalTicks += LOCKOUT_TICKS;
    expect(floorCleared(s, FLOORS[DARK_FLOOR])).toBe(true);
    expect(floorUnlocked(s, FLOORS[ROYALE_FLOOR])).toBe(true);
    expect(festivalLadder(s, ROYALE_FLOOR)).toBe('closed');
    expect(game.climbTo(ROYALE_FLOOR)).toBe(false);
    expect(s.travel).toBeNull();
    expect(s.spot).toBe(FOOT);
    // The log is capped, so the refusal is read off its newest line.
    expect(s.log[s.log.length - 1].msg).toContain('Floor 16');
    // The way in is still the dark room.
    expect(game.climbTo(DARK_FLOOR)).toBe(true);
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

  it('banks at most the cap, and a short gap banks too (the quiet path, catchUpTicks)', () => {
    const game = inHall();
    const s = game.state;
    s.bonusTime.banked = 0;
    // Under a minute the summary path declines and the UI's quiet path ticks
    // the gap through catchUpTicks, which banks it instead.
    expect(runOfflineProgress(game, 30 * 1000)).toBeNull();
    const quiet = catchUpTicks(game, 300);
    expect(quiet).toEqual({ simulated: 0, skipped: 300, banked: 300 });
    expect(s.bonusTime.banked).toBe(300);
    runOfflineProgress(game, 24 * 60 * 60 * 1000);
    expect(s.bonusTime.banked).toBe(BONUS_CAP_TICKS);
  });

  it('the summary reports what the bank took, not the time skipped', () => {
    const game = inHall();
    const s = game.state;
    s.bonusTime.banked = BONUS_CAP_TICKS - 100;
    const summary = runOfflineProgress(game, 2 * 60 * 60 * 1000)!;
    expect(summary.festivalSkipped).toBe((2 * 60 * 60 * 1000) / MS_PER_TICK);
    expect(summary.festivalBanked).toBe(100);
    expect(s.bonusTime.banked).toBe(BONUS_CAP_TICKS);
    // A full bank takes nothing, and the summary says so.
    expect(runOfflineProgress(game, 2 * 60 * 60 * 1000)!.festivalBanked).toBe(0);
  });

  it('a catch-up whose climb lands in the dark room stops at the door and banks the rest', () => {
    const s = strong(geared(atFourteen()));
    const game = new Game(s);
    expect(game.climbTo(DARK_FLOOR)).toBe(true); // the tab closes mid-ride
    s.bonusTime.banked = 0;
    const kills = s.stats['kills'] ?? 0;
    const summary = runOfflineProgress(game, OFFLINE_CAP_MS)!;
    // The ride landed and the attempt began, and nothing after it was simulated.
    expect(s.spot).toBe(DARK_ROOM);
    expect(festivalRun(s)?.phase).toBe('dark');
    expect(festivalRun(s)?.wave).toBe(0);
    expect(s.combat).toBeNull();
    expect(s.stats['kills'] ?? 0).toBe(kills);
    expect(s.stats[FESTIVAL_WINS_KEY] ?? 0).toBe(0);
    expect(lockoutLeft(s)).toBe(0);
    const all = OFFLINE_CAP_MS / MS_PER_TICK;
    expect(summary.ticks).toBeGreaterThan(0);
    expect(summary.ticks).toBeLessThan(200);
    expect(summary.festivalSkipped).toBe(all - summary.ticks);
    expect(summary.festivalBanked).toBe(all - summary.ticks);
    expect(s.bonusTime.banked).toBe(all - summary.ticks);
  });

  it('the quiet short-gap path stops at the door too', () => {
    const s = strong(atFourteen());
    const game = new Game(s);
    expect(game.climbTo(DARK_FLOOR)).toBe(true);
    s.bonusTime.banked = 0;
    const run = catchUpTicks(game, 550); // a 55-second gap, longer than the ride
    expect(run.simulated).toBeGreaterThan(0);
    expect(run.simulated).toBeLessThan(550);
    expect(run.skipped).toBe(550 - run.simulated);
    expect(run.banked).toBe(run.skipped);
    expect(s.spot).toBe(DARK_ROOM);
    expect(festivalRun(s)?.wave).toBe(0);
    expect(s.combat).toBeNull();
    expect(s.stats[FESTIVAL_WINS_KEY] ?? 0).toBe(0);
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
    expect(survivorLevel(PREP_TICKS, 0)).toBe(full);
    expect(survivorLevel(0, 0)).toBe(SURVIVOR_LEVELS.base);
    // The jump: whatever the clock read, the field opens at the full curve.
    const game = inHall();
    climb(game, ROYALE_FLOOR);
    // The first survivor fight (a den’s monsters are pinned at their own levels).
    tickUntil(game, () => !!game.state.combat?.enemies.some((e) => e?.defId.startsWith('ph_survivor')));
    const foe = game.state.combat!.enemies.find((e) => e?.defId.startsWith('ph_survivor'))!;
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

  it('Game.prestige ends the lockout too: the next run is assigned into the live state', () => {
    const game = new Game(atFourteen());
    const s = game.state;
    climb(game, DARK_FLOOR);
    climb(game, null);
    expect(lockoutLeft(s)).toBeGreaterThan(0);
    expect(game.prestige(1)).toBe(true);
    expect(s.festival).toBeUndefined();
    expect(lockoutLeft(s)).toBe(0);
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
  it('a plan alone wins the royale in the game, with no hand on the field', () => {
    const game = inHall();
    const s = game.state;
    game.setRoyalePlan(['lie_low', 'hunt_weakest']);
    climb(game, ROYALE_FLOOR);
    let hand = 0;
    tickUntil(game, () => {
      if (festivalRun(s)?.field?.player.target) hand += 1;
      return !festivalRun(s);
    });
    expect(hand).toBe(0);
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(1);
    expect(s.stats['boss:f16_arena']).toBe(1);
  });

  it('a click on the field walks the player there, and the plan takes over on arrival', () => {
    const game = inHall();
    const s = game.state;
    climb(game, ROYALE_FLOOR);
    game.tick();
    const field = festivalRun(s)!.field!;
    // Clear the way so no fight interrupts the walk.
    field.fighters = remote(mapOf(field), 3).map((p, i) => ({ id: i + 1, monsterId: 'ph_survivor_blade', x: p.x, y: p.y, hp: 1, wins: 0 }));
    const goal = { x: field.player.x - 12, y: field.player.y - 12 };
    expect(game.moveOnField(goal.x, goal.y)).toBe(true);
    expect(field.player.target).toEqual(goal);
    tickUntil(game, () => !festivalRun(s)!.field!.player.target, 4000);
    const p = festivalRun(s)!.field!.player;
    expect(Math.hypot(p.x - goal.x, p.y - goal.y)).toBeLessThan(0.5);
    expect(game.moveOnField(500, -3)).toBe(true);
    expect(festivalRun(s)!.field!.player.target).toEqual({ x: ROYALE_FIELD.size, y: 0 });
  });

  it('the plan is ranked, kept between attempts, and cleans up what it is given', () => {
    const game = inHall();
    game.setRoyalePlan(['keep_away', 'nonsense', 'keep_away', 'press_nearest', 'hold_centre', 'lie_low']);
    expect(royalePlan(game.state).map((s) => s.id)).toEqual(['keep_away', 'press_nearest', 'hold_centre']);
    climb(game, null); // a forfeit
    expect(game.state.festival?.plan).toEqual(['keep_away', 'press_nearest', 'hold_centre']);
    expect(royalePlan(createInitialState(0)).map((s) => s.id)).toEqual(DEFAULT_ROYALE_PLAN);
  });

  it('a knockout mid-royale loses the attempt even from a field fight against the champion', () => {
    // Covered by 'a knockout in the royale ejects too'; here the field is
    // down to its champion before the player is put down.
    const game = inHall();
    const s = game.state;
    climb(game, ROYALE_FLOOR);
    game.tick();
    const field = festivalRun(s)!.field!;
    field.fighters = field.fighters.slice(0, 1).map((f) => ({ ...f, x: field.player.x, y: field.player.y - 1 }));
    tickUntil(game, () => !!s.combat, 200);
    expect(s.combat!.enemies[0]!.defId).toBe('ph_survivor_champion');
    for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 1;
    s.resources.hp = 1;
    tickUntil(game, () => s.recovering, 5_000);
    expect(s.spot).toBe(FOOT);
    expect(s.stats['boss:f16_arena']).toBeUndefined();
    expect(floorCleared(s, FLOORS[ROYALE_FLOOR])).toBe(false);
  });

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

// ---------- The royale's terrain, caches and dens (systems/royale.ts) ----------

interface Spot {
  x: number;
  y: number;
}

/** Points far from the start, every den and every cache, and apart from each other: where a trimmed field keeps its survivors. */
function remote(map: RoyaleMap, count: number): Spot[] {
  const picks: Spot[] = [];
  const far = (p: Spot, q: Spot, d: number) => Math.hypot(p.x - q.x, p.y - q.y) >= d;
  for (let y = 6; y < map.size - 12; y += 6) {
    for (let x = 6; x < map.size - 6; x += 6) {
      const p = { x, y };
      if (!far(p, map.start, 100)) continue;
      if (ROYALE_DENS.some((d) => !far(p, map.dens[d.id], d.radius + 10))) continue;
      if (ROYALE_CACHES.some((c) => !far(p, map.caches[c.id], 10))) continue;
      if (picks.some((q) => !far(p, q, 30))) continue;
      picks.push(p);
      if (picks.length === count) return picks;
    }
  }
  throw new Error(`seed ${map.seed}: no ${count} remote spots`);
}

/** The cell of a section nearest the middle of its cells, so a step does not leave it. */
function heartOf(map: RoyaleMap, sectionId: string): Spot {
  const cells: Spot[] = [];
  for (let i = 0; i < map.cells.length; i++) {
    if (sectionIdOf(map.cells[i]) === sectionId) cells.push({ x: (i % map.size) + 0.5, y: Math.floor(i / map.size) + 0.5 });
  }
  if (!cells.length) throw new Error(`seed ${map.seed}: no ${sectionId} on the map`);
  const mid = { x: cells.reduce((a, c) => a + c.x, 0) / cells.length, y: cells.reduce((a, c) => a + c.y, 0) / cells.length };
  return cells.reduce((a, b) => (Math.hypot(a.x - mid.x, a.y - mid.y) <= Math.hypot(b.x - mid.x, b.y - mid.y) ? a : b));
}

/** Tick until the fight, if any, is over. */
function settle(game: Game): void {
  tickUntil(game, () => !game.state.combat, 5000);
}

interface Royale {
  game: Game;
  s: GameState;
  run: FestivalRun;
  field: RoyaleField;
  map: RoyaleMap;
}

/** In the royale with the board cleared: three survivors far from everything, nothing taken, cleared or seen, the player free. */
function inRoyale(): Royale {
  const game = inHall();
  climb(game, ROYALE_FLOOR);
  game.tick(); // the field opens
  const s = game.state;
  const run = festivalRun(s)!;
  const field = run.field!;
  const map = mapOf(field);
  field.fighters = remote(map, 3).map((p, i) => ({ id: i + 1, monsterId: 'ph_survivor_blade', x: p.x, y: p.y, hp: 1, wins: 0 }));
  field.taken = [];
  field.cleared = [];
  field.seen = [];
  return { game, s, run, field, map };
}

/** Put the player on a spot, the plan clear, and tick once. */
function standAt(game: Game, field: RoyaleField, p: Spot): void {
  field.player.x = p.x;
  field.player.y = p.y;
  delete field.player.target;
  delete field.player.goal;
  game.tick();
}

const everythingOwned = (s: GameState) => [...(Object.values(s.equipment) as { uid: number }[]), ...s.inventory, ...(s.sheathed ? [s.sheathed] : [])];

describe('the royale: the attempt’s field', () => {
  it('the attempt draws its field’s seed at the start and the field opens on it; one saved without a seed draws its own', () => {
    const game = inHall();
    const run = festivalRun(game.state)!;
    expect(Number.isInteger(run.fieldSeed)).toBe(true);
    climb(game, ROYALE_FLOOR);
    game.tick();
    expect(run.field!.seed).toBe(run.fieldSeed);
    expect(run.field!.layout).toBe(ROYALE_LAYOUT_VERSION);
    expect(run.field!.openedAt).toBeLessThanOrEqual(game.state.totalTicks);
    // On the map’s start (a tick of walking has passed).
    const start = mapOf(run.field!).start;
    expect(Math.hypot(run.field!.player.x - start.x, run.field!.player.y - start.y)).toBeLessThan(1);
    const old = inHall();
    const oldRun = festivalRun(old.state)!;
    delete oldRun.fieldSeed;
    climb(old, ROYALE_FLOOR);
    old.tick();
    expect(oldRun.field!.seed).toBeDefined();
    expect(oldRun.fieldSeed).toBe(oldRun.field!.seed);
  });

  it('a field from an older layout is replaced whole, but never during a fight', () => {
    const { game, s, run, field } = inRoyale();
    field.fighters[0].x = field.player.x;
    field.fighters[0].y = field.player.y - 1;
    tickUntil(game, () => !!s.combat, 50);
    delete field.layout;
    let during = 0;
    for (let i = 0; i < 30 && s.combat; i++) {
      game.tick();
      if (s.combat) {
        during += 1;
        expect(run.field).toBe(field);
        expect(field.layout).toBeUndefined();
      }
    }
    expect(during, 'the fight lasted at least a tick past the layout change').toBeGreaterThan(0);
    settle(game);
    game.tick();
    // The fight over: a new field on the attempt’s terrain.
    expect(run.field).not.toBe(field);
    expect(run.field!.layout).toBe(ROYALE_LAYOUT_VERSION);
    expect(run.field!.fighters).toHaveLength(99);
    expect(run.field!.seed).toBe(run.fieldSeed);
  });

  it('the champion’s fall is the win; a field emptied without it is not, and gets its champion back', () => {
    const { game, s, run, field } = inRoyale();
    const [a, b] = field.fighters;
    // Two survivors in one fight and no one else standing: a fight that did not hold the champion.
    a.engaged = true;
    b.engaged = true;
    field.fighters = [a, b];
    expect(royaleFightWon(s, new EventBus(), run)).toBe(false);
    expect(field.fighters).toHaveLength(0);
    expect(festivalRun(s)).toBeDefined();
    expect(s.stats[FESTIVAL_WINS_KEY]).toBeUndefined();
    game.tick();
    expect(field.fighters).toHaveLength(1);
    // That champion reaches the player: its fall is the win.
    const champion = field.fighters[0];
    champion.x = field.player.x;
    champion.y = field.player.y - 1;
    tickUntil(game, () => !festivalRun(s));
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(1);
    expect(s.stats['boss:f16_arena']).toBe(1);
  });

  it('a plan alone wins within a festival day with the default plan, and the field ran on its radar', () => {
    const game = inHall();
    const s = game.state;
    climb(game, ROYALE_FLOOR);
    const from = s.totalTicks;
    expect(royalePlan(s).map((p) => p.id)).toEqual(DEFAULT_ROYALE_PLAN);
    tickUntil(game, () => !festivalRun(s), 14_400);
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(1);
    expect(s.totalTicks - from).toBeLessThanOrEqual(14_400);
  });
});

describe('the royale: caches and lent gear', () => {
  it('a cache lends gear for the attempt: worn if its slot is free, in the pack if not, never sold, taken back when the attempt is lost', () => {
    const { game, s, run, field, map } = inRoyale();
    standAt(game, field, map.caches.woodcutter_hut);
    settle(game);
    expect(field.taken).toContain('woodcutter_hut');
    expect(s.equipment.chest?.defId).toBe('leather_vest');
    const vest = s.equipment.chest!;
    expect(run.lent).toContain(vest.uid);
    expect(vest.slots).toBe(0);
    // The weapon slot holds the issued weapon, so a found weapon goes to the pack.
    standAt(game, field, map.caches.ferry_shed);
    settle(game);
    const sword = s.inventory.find((i) => i.defId === 'iron_sword' && run.lent!.includes(i.uid))!;
    expect(sword).toBeDefined();
    expect(s.equipment.weapon?.uid).toBe(run.issued);
    // Lent: not for sale.
    const gold = s.gold;
    game.sell(sword.uid);
    game.sellMany([sword.uid, vest.uid]);
    expect(s.gold).toBe(gold);
    expect(s.inventory.some((i) => i.uid === sword.uid)).toBe(true);
    // Taken once: standing on it again gives nothing more.
    const lent = [...run.lent!];
    standAt(game, field, map.caches.ferry_shed);
    expect(run.lent).toEqual(lent);
    // A forfeit: everything lent goes back, wherever it is.
    climb(game, null);
    expect(festivalRun(s)).toBeUndefined();
    const owned = everythingOwned(s);
    for (const uid of lent) expect(owned.some((i) => i.uid === uid), `lent ${uid}`).toBe(false);
    expect(s.equipment.chest).toBeUndefined();
  });

  it('the lent gear is taken back when the royale is won, too', () => {
    const { game, s, run, field, map } = inRoyale();
    standAt(game, field, map.caches.woodcutter_hut);
    settle(game);
    standAt(game, field, map.caches.ferry_shed);
    settle(game);
    const lent = [...run.lent!];
    expect(lent.length).toBeGreaterThanOrEqual(2);
    // The last survivor reaches the player: the champion, fought alone.
    field.fighters = [{ ...field.fighters[0], x: field.player.x, y: field.player.y - 1 }];
    tickUntil(game, () => !festivalRun(s));
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(1);
    const owned = everythingOwned(s);
    for (const uid of lent) expect(owned.some((i) => i.uid === uid), `lent ${uid}`).toBe(false);
  });

  it('a weapon cache lends a weapon of the issued family; a heal cache restores health at once', () => {
    const { game, s, run, field, map } = inRoyale();
    // The door issued a rusty sword: the sword family.
    standAt(game, field, map.caches.smithy);
    settle(game);
    expect(field.taken).toContain('smithy');
    expect(s.inventory.some((i) => i.defId === CACHE_WEAPONS.sword && run.lent!.includes(i.uid))).toBe(true);
    const max = getDerivedStats(s).maxHp;
    s.resources.hp = max * 0.2;
    standAt(game, field, map.caches.fisher_hut);
    settle(game);
    const share = ROYALE_CACHES.find((c) => c.id === 'fisher_hut')!.heal!;
    expect(s.resources.hp - max * 0.2).toBeGreaterThanOrEqual(max * share * 0.9);
  });

  it('the glade’s spring heals the player while they stand in it', () => {
    const { game, s, field, map } = inRoyale();
    const max = getDerivedStats(s).maxHp;
    const gain = (p: Spot) => {
      s.resources.hp = max * 0.5;
      standAt(game, field, p);
      return s.resources.hp - max * 0.5;
    };
    const base = gain(map.start);
    const spring = gain(heartOf(map, 'glade'));
    expect(spring - base).toBeGreaterThanOrEqual(max * ROYALE_SECTIONS.glade.heal! * 0.9);
  });
});

describe('the royale: dens', () => {
  const serpent = ROYALE_DENS.find((d) => d.id === 'serpent_pool')!;

  it('walking into a den is a staged fight with its monsters at their pinned levels; won, the den is cleared and the royale goes on', () => {
    const { game, s, run, field, map } = inRoyale();
    const gold = s.gold;
    const standing = field.fighters.length;
    standAt(game, field, map.dens[serpent.id]);
    expect(s.combat).not.toBeNull();
    expect(field.denFight).toBe(serpent.id);
    const foes = s.combat!.enemies.filter((e) => !!e);
    expect(foes.map((e) => e!.defId).sort()).toEqual(serpent.foes.map((f) => f.monsterId).sort());
    expect(foes.map((e) => e!.level)).toEqual(serpent.foes.map((f) => f.level));
    settle(game);
    expect(field.denFight).toBeUndefined();
    expect(field.cleared).toContain(serpent.id);
    expect(field.player.lastFight).toBeDefined();
    // Not a royale fight: nothing leaves the field, nothing is won, and the den’s monsters pay nothing.
    expect(field.fighters).toHaveLength(standing);
    expect(festivalRun(s)).toBe(run);
    expect(s.stats[FESTIVAL_WINS_KEY]).toBeUndefined();
    expect(s.gold).toBe(gold);
    // The den stays cleared: standing in it starts nothing.
    for (let i = 0; i < 20; i++) game.tick();
    expect(s.combat).toBeNull();
    // What it guarded is open now.
    const guarded = ROYALE_CACHES.find((c) => c.den === serpent.id)!;
    standAt(game, field, map.caches[guarded.id]);
    settle(game);
    expect(field.taken).toContain(guarded.id);
  });

  it('a knockout in a den is a festival loss like any other on floor 16', () => {
    const { game, s, field, map } = inRoyale();
    standAt(game, field, map.dens[serpent.id]);
    expect(s.combat).not.toBeNull();
    for (const a of ATTRIBUTE_LIST) s.attrs[a.id].level = 1;
    s.resources.hp = 1;
    tickUntil(game, () => s.recovering, 5_000);
    expect(s.spot).toBe(FOOT);
    expect(festivalRun(s)).toBeUndefined();
    expect(lockoutLeft(s)).toBe(LOCKOUT_TICKS);
  });
});

// ---------- Rewards, the stash, the techniques, the hidden title ----------

/** Every copy of an item def the player owns: worn, carried, sheathed. */
function owned(s: GameState, defId: string): number {
  const all = [...s.inventory, ...(Object.values(s.equipment) as { defId: string }[]), ...(s.sheathed ? [s.sheathed] : [])];
  return all.filter((i) => i?.defId === defId).length;
}

/** From the hall, into the royale and through it. */
function winFromHall(game: Game): void {
  climb(game, ROYALE_FLOOR);
  tickUntil(game, () => !festivalRun(game.state));
  expect(game.state.stats['boss:f16_arena']).toBeGreaterThanOrEqual(1);
}

describe('rewards: the first win pays, reruns pay nothing', () => {
  it('the first win of a run pays the laurel; a rerun pays nothing at all', () => {
    const game = inHall();
    const s = game.state;
    winFromHall(game);
    expect(owned(s, FESTIVAL_REWARD)).toBe(1);
    const gold = s.gold;
    const items = s.inventory.length + Object.values(s.equipment).filter(Boolean).length;
    // A rerun from floor 16: the dark room again, the hall, the royale.
    climb(game, DARK_FLOOR);
    expect(festivalRun(s)?.phase).toBe('dark');
    tickUntil(game, () => festivalRun(s)?.phase === 'prep');
    winFromHall(game);
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(2);
    expect(owned(s, FESTIVAL_REWARD)).toBe(1);
    expect(s.gold).toBe(gold);
    expect(s.inventory.length + Object.values(s.equipment).filter(Boolean).length).toBe(items);
    expect(s.prestige.stash).toBeUndefined();
  });

  it('the win count restarts with every run', () => {
    const s = strong(atFourteen());
    s.stats[FESTIVAL_WINS_KEY] = 3;
    const next = prestigeNow(s, 1)!;
    expect(next.stats[FESTIVAL_WINS_KEY]).toBeUndefined();
  });
});

describe('the hundredth win and the stronghold stash', () => {
  it('the hundredth win of a run puts a token in the stash, which survives prestige', () => {
    const game = inHall();
    const s = game.state;
    s.stats[FESTIVAL_WINS_KEY] = 99;
    expect(s.prestige.stash).toBeUndefined();
    winFromHall(game);
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(100);
    expect(s.prestige.stash?.tokens).toHaveLength(1);
    const next = prestigeNow(s, 1)!;
    expect(next.prestige.stash?.tokens).toEqual(s.prestige.stash!.tokens);
    // The count restarts with the run; the token does not.
    expect(next.stats[FESTIVAL_WINS_KEY]).toBeUndefined();
    clearFloors(next.stats);
    const third = prestigeNow(next, 2)!;
    expect(third.prestige.stash?.tokens).toHaveLength(1);
  });

  it('two hundred earns two, one at each hundred, and nothing in between', () => {
    const game = inHall();
    const s = game.state;
    s.stats[FESTIVAL_WINS_KEY] = 150;
    winFromHall(game);
    expect(s.prestige.stash).toBeUndefined();
    s.stats[FESTIVAL_WINS_KEY] = 199;
    stashToken(s, 5); // the hundredth's, already held
    climb(game, DARK_FLOOR);
    tickUntil(game, () => festivalRun(s)?.phase === 'prep');
    winFromHall(game);
    expect(s.prestige.stash?.tokens).toHaveLength(2);
  });

  it('only keep-marked items enter the stash', () => {
    const s = createInitialState(0);
    expect(stashItem(s, createItem(s, 'iron_sword'))).toBe(false);
    expect(stashItem(s, createItem(s, TOKEN_REGALIA))).toBe(true);
    expect(s.prestige.stash?.items.map((i) => i.defId)).toEqual([TOKEN_REGALIA]);
  });
});

describe('a festival token', () => {
  it('buys a stack of the permanent bonus, capped, kept through prestige', () => {
    const game = new Game(createInitialState(0));
    const s = game.state;
    clearFloors(s.stats);
    for (let i = 0; i < TOKEN_BONUS.cap + 1; i++) stashToken(s, i);
    for (let i = 0; i < TOKEN_BONUS.cap; i++) expect(game.spendFestivalToken(0, { kind: 'bonus' })).toBe(true);
    expect(s.prestige.festivalBonus).toBe(TOKEN_BONUS.cap);
    // At the cap the bonus is shut; the token stays for another choice.
    expect(game.spendFestivalToken(0, { kind: 'bonus' })).toBe(false);
    expect(s.prestige.stash?.tokens).toHaveLength(1);
    const next = prestigeNow(s, 1)!;
    expect(next.prestige.festivalBonus).toBe(TOKEN_BONUS.cap);
  });

  it("offers three techniques from its seed; the one taken is known now and from every later run's start", () => {
    const game = new Game(createInitialState(0));
    const s = game.state;
    clearFloors(s.stats);
    stashToken(s, 12345);
    const token = s.prestige.stash!.tokens[0];
    const offers = tokenTechniques(s, token);
    expect(offers).toHaveLength(TOKEN_TECHNIQUES.offer);
    // The same token offers the same three every time it is opened.
    expect(tokenTechniques(s, token)).toEqual(offers);
    for (const id of offers) expect(TOKEN_TECHNIQUES.pool).toContain(id);
    // Not on offer: refused, and the token is kept.
    const other = TOKEN_TECHNIQUES.pool.find((id) => !offers.includes(id))!;
    expect(game.spendFestivalToken(0, { kind: 'technique', id: other })).toBe(false);
    expect(game.spendFestivalToken(0, { kind: 'technique', id: offers[1] })).toBe(true);
    expect(s.techniques[offers[1]]?.form).toBe('canonical');
    expect(s.prestige.festivalTechniques).toEqual([offers[1]]);
    const next = prestigeNow(s, 1)!;
    expect(next.techniques[offers[1]]?.form).toBe('canonical');
    expect(next.prestige.festivalTechniques).toEqual([offers[1]]);
    // A later token never offers what is already taken.
    stashToken(next, 12345);
    expect(tokenTechniques(next, next.prestige.stash!.tokens[0])).not.toContain(offers[1]);
  });

  it('buys the regalia, which every prestige returns to the stash from wherever it is', () => {
    const game = new Game(createInitialState(0));
    const s = game.state;
    clearFloors(s.stats);
    stashToken(s, 1);
    expect(game.spendFestivalToken(0, { kind: 'regalia' })).toBe(true);
    expect(s.prestige.stash?.items.map((i) => i.defId)).toEqual([TOKEN_REGALIA]);
    // Taken out and worn: it comes back at prestige.
    expect(game.takeFromStash(0)).toBe(true);
    expect(s.prestige.stash?.items).toEqual([]);
    const regalia = s.inventory.find((i) => i.defId === TOKEN_REGALIA)!;
    game.equip(regalia.uid);
    expect(s.equipment.accessory?.defId).toBe(TOKEN_REGALIA);
    const next = prestigeNow(s, 1)!;
    expect(next.prestige.stash?.items.map((i) => i.defId)).toEqual([TOKEN_REGALIA]);
    expect(owned(next, TOKEN_REGALIA)).toBe(0);
    // Taken out in the new run, it gets a uid of that run.
    const g2 = new Game(next);
    expect(g2.takeFromStash(0)).toBe(true);
    const taken = next.inventory.find((i) => i.defId === TOKEN_REGALIA)!;
    expect(next.inventory.filter((i) => i.uid === taken.uid)).toHaveLength(1);
  });

  it('hands out nothing inside a festival attempt: the door holds everything', () => {
    const s = strong(atFourteen());
    stashToken(s, 1);
    const game = new Game(s);
    game.spendFestivalToken(0, { kind: 'regalia' });
    climb(game, DARK_FLOOR);
    expect(game.takeFromStash(0)).toBe(false);
    expect(s.prestige.stash?.items).toHaveLength(1);
    climb(game, null); // out by the ladder: the attempt is over
    expect(game.takeFromStash(0)).toBe(true);
  });

  it('a regalia held at the festival door still goes back to the stash at prestige', () => {
    const s = strong(atFourteen());
    stashToken(s, 1);
    const game = new Game(s);
    game.spendFestivalToken(0, { kind: 'regalia' });
    game.takeFromStash(0);
    climb(game, DARK_FLOOR);
    expect(owned(s, TOKEN_REGALIA)).toBe(0);
    expect(festivalRun(s)!.held.inventory.some((i) => i.defId === TOKEN_REGALIA)).toBe(true);
    const next = prestigeNow(s, 1)!;
    expect(next.prestige.stash?.items.map((i) => i.defId)).toEqual([TOKEN_REGALIA]);
  });
});

describe('saving inside the festival', () => {
  it('a save mid-wave reloads into the same attempt, and the wave is fought again', () => {
    const game = new Game(strong(geared(atFourteen())));
    climb(game, DARK_FLOOR);
    tickUntil(game, () => !!game.state.combat);
    const loaded = new Game(deserialize(serialize(game.state)));
    const s = loaded.state;
    expect(s.combat).toBeNull();
    expect(festivalRun(s)?.phase).toBe('dark');
    expect(festivalRun(s)!.held.inventory.length).toBeGreaterThan(0);
    tickUntil(loaded, () => festivalRun(s)?.phase === 'prep');
    expect(s.stats['boss:f15_dark_room']).toBe(1);
  });

  it('a save mid-royale fight reloads with its survivors walking again, and the royale can still be won', () => {
    const game = inHall();
    climb(game, ROYALE_FLOOR);
    tickUntil(game, () => !!game.state.combat && festivalRun(game.state)!.field!.fighters.some((f) => f.engaged));
    const before = festivalRun(game.state)!.field!;
    expect(before.seed).toBe(festivalRun(game.state)!.fieldSeed);
    const loaded = new Game(deserialize(serialize(game.state)));
    const s = loaded.state;
    // Only the seed is saved; the terrain is rebuilt from it.
    expect(festivalRun(s)!.field!.seed).toBe(before.seed);
    expect(mapOf(festivalRun(s)!.field!).start).toEqual(mapOf(before).start);
    loaded.tick();
    expect(festivalRun(s)!.field!.fighters.some((f) => f.engaged && !s.combat)).toBe(false);
    tickUntil(loaded, () => !festivalRun(s));
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(1);
  });
});

describe('the hidden title', () => {
  const TITLE = 'first_through_the_door';

  it('fires for a win whose climb began within twelve festival hours of the door', () => {
    const game = inHall();
    const s = game.state;
    festivalRun(s)!.clock = SWIFT_ENTRY_TICKS - 1;
    expect(s.stats[FESTIVAL_SWIFT_KEY]).toBeUndefined();
    winFromHall(game);
    expect(s.stats[FESTIVAL_SWIFT_KEY]).toBe(1);
    expect(s.titles).toContain(TITLE);
  });

  it('a later climb wins without it, and leaves no trace of it', () => {
    const game = inHall();
    const s = game.state;
    festivalRun(s)!.clock = SWIFT_ENTRY_TICKS + 1;
    winFromHall(game);
    expect(s.stats[FESTIVAL_WINS_KEY]).toBe(1);
    expect(s.stats[FESTIVAL_SWIFT_KEY]).toBeUndefined();
    expect(s.titles).not.toContain(TITLE);
  });

  it('an early climb that is lost writes nothing: no counter, no title', () => {
    const game = inHall();
    const s = game.state;
    climb(game, ROYALE_FLOOR);
    expect(festivalRun(s)!.enteredAt).toBeLessThanOrEqual(SWIFT_ENTRY_TICKS);
    climb(game, null); // the forfeit
    expect(s.stats[FESTIVAL_SWIFT_KEY]).toBeUndefined();
    expect(s.titles).not.toContain(TITLE);
    // Secret: hidden from the UI until earned.
    expect(TITLES[TITLE].secret).toBe(true);
  });
});
