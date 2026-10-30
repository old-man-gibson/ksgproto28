import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/core/state';
import { Game } from '../src/core/game';
import { FLOORS, SPOTS, TITLES, TOWERS } from '../src/core/registry';
import {
  ARENA,
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
  ROYALE_FIELD,
  ROYALE_FLOOR,
  ROYALE_STRATEGIES,
  SURVIVORS,
  SURVIVOR_LEVELS,
  SURVIVOR_SPECIES,
  SWIFT_ENTRY_TICKS,
  TOKEN_BONUS,
  TOKEN_REGALIA,
  TOKEN_TECHNIQUES,
  weaponKillsKey,
} from '../src/core/data/festival.data';
import { stashItem, stashToken, tokenTechniques } from '../src/core/systems/stash';
import {
  activeStrategy,
  clearEngaged,
  createField,
  goalFor,
  stepField,
  type FieldStep,
} from '../src/core/systems/royaleField';
import { royalePlan } from '../src/core/systems/royale';
import { ATTRIBUTE_LIST } from '../src/core/data/attributes.data';
import { festivalHolds, festivalLocked, festivalRun, lockoutLeft, survivorLevel } from '../src/core/systems/festivalRules';
import { issuedWeapon } from '../src/core/systems/festival';
import { floorCleared, floorUnlocked } from '../src/core/systems/ladder';
import { prestigeNow } from '../src/core/systems/prestige';
import { getDerivedStats } from '../src/core/systems/derived';
import { createItem } from '../src/core/systems/runes';
import { runOfflineProgress } from '../src/core/save/offline';
import { deserialize, serialize } from '../src/core/save/save';
import { BONUS_CAP_TICKS } from '../src/core/systems/bonustime';
import { MS_PER_TICK } from '../src/core/engine/loop';
import type { FieldFighter, GameState, RoyaleField } from '../src/core/types';
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
    expect(survivorLevel(PREP_TICKS, 0)).toBe(full);
    expect(survivorLevel(0, 0)).toBe(SURVIVOR_LEVELS.base);
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

describe('the royale field (the pure simulation)', () => {
  /** A seeded stand-in for the save's rng. */
  function seeded(seed = 7): () => number {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const plans = new Map(SURVIVOR_SPECIES.map((s) => [s.monsterId, s.plan.map((id) => ROYALE_STRATEGIES[id])]));
  const step = (now: number, rng: () => number, plan = DEFAULT_ROYALE_PLAN, playerFree = true): FieldStep => ({
    now,
    rng,
    playerFree,
    playerHp: 1,
    playerPower: 40,
    playerSpeed: 1,
    plan: plan.map((id) => ROYALE_STRATEGIES[id]),
    planOf: (id) => plans.get(id) ?? [],
  });
  const fighter = (id: number, x: number, y: number, extra: Partial<FieldFighter> = {}): FieldFighter => ({
    id,
    monsterId: 'ph_survivor_blade',
    x,
    y,
    hp: 1,
    wins: 0,
    ...extra,
  });
  const fieldOf = (fighters: FieldFighter[], px = 30, py = 58): RoyaleField => ({
    size: ROYALE_FIELD.size,
    fighters,
    player: { x: px, y: py },
    fallen: 0,
  });

  it('opens with ninety-nine survivors on the field and the player on its near edge', () => {
    const field = createField(seeded());
    expect(field.fighters).toHaveLength(SURVIVORS);
    for (const f of field.fighters) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.x).toBeLessThanOrEqual(field.size);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(field.size);
    }
    expect(field.player.y).toBeGreaterThan(field.size - 5);
  });

  it('the first strategy whose condition holds decides', () => {
    const plan = ['fall_back_hurt', 'lie_low', 'press_nearest'].map((id) => ROYALE_STRATEGIES[id]);
    expect(activeStrategy(plan, 0.3, 80)?.id).toBe('fall_back_hurt');
    expect(activeStrategy(plan, 0.9, 80)?.id).toBe('lie_low');
    expect(activeStrategy(plan, 0.9, 10)?.id).toBe('press_nearest');
    expect(activeStrategy([ROYALE_STRATEGIES.fall_back_hurt], 0.9, 10)).toBeNull();
  });

  it('every move sends its fighter somewhere sensible', () => {
    const others = [{ id: 1, x: 10, y: 10, power: 30 }, { id: 2, x: 40, y: 40, power: 5 }];
    const at = { x: 12, y: 12 };
    expect(goalFor('nearest', at, others, 60)).toEqual({ x: 10, y: 10 });
    expect(goalFor('weakest', at, others, 60)).toEqual({ x: 10, y: 10 }); // the weak one is out of sight
    expect(goalFor('weakest', { x: 35, y: 35 }, others, 60)).toEqual({ x: 40, y: 40 });
    expect(goalFor('centre', at, others, 60)).toEqual({ x: 30, y: 30 });
    expect(goalFor('hold', at, others, 60)).toEqual(at);
    const away = goalFor('away', at, others, 60);
    expect(away.x).toBeGreaterThan(at.x);
    expect(away.y).toBeGreaterThan(at.y);
    const edge = goalFor('edge', { x: 3, y: 30 }, others, 60);
    expect(edge).toEqual({ x: 1, y: 30 });
  });

  it('two survivors who meet duel; when it ends the loser falls and the winner is wounded', () => {
    const rng = seeded(3);
    const field = fieldOf([fighter(1, 10, 10), fighter(2, 11, 10), fighter(3, 50, 10)]);
    stepField(field, step(0, rng), 34);
    const a = field.fighters.find((f) => f.id === 1)!;
    expect(a.duel?.foe).toBe(2);
    let fallen = 0;
    for (let t = 1; t <= ROYALE_FIELD.duelTicks; t++) fallen += stepField(field, step(t, rng), 34).fallen;
    expect(fallen).toBe(1);
    expect(field.fallen).toBe(1);
    const winner = field.fighters.find((f) => f.id === 1 || f.id === 2)!;
    expect(winner.wins).toBe(1);
    expect(winner.hp).toBeLessThan(1);
    expect(winner.duel).toBeUndefined();
  });

  it('survivors who reach a free player are the player\'s next fight; a busy player is left alone', () => {
    const rng = seeded(5);
    const busy = fieldOf([fighter(1, 30, 57), fighter(2, 5, 5), fighter(3, 55, 5)]);
    expect(stepField(busy, step(0, rng, DEFAULT_ROYALE_PLAN, false), 34).engaged).toEqual([]);
    const free = fieldOf([fighter(1, 30, 57), fighter(2, 5, 5), fighter(3, 55, 5)]);
    const engaged = stepField(free, step(0, rng), 34).engaged;
    expect(engaged.map((f) => f.id)).toEqual([1]);
    expect(free.fighters.find((f) => f.id === 1)!.engaged).toBe(true);
    expect(clearEngaged(free)).toBe(1);
    expect(free.fighters.map((f) => f.id)).toEqual([2, 3]);
  });

  it('never puts every survivor left into one fight: the last is fought alone', () => {
    const rng = seeded(9);
    const field = fieldOf([fighter(1, 30, 57), fighter(2, 31, 57)], 30, 58);
    const engaged = stepField(field, step(0, rng), 34).engaged;
    expect(engaged).toHaveLength(1);
    clearEngaged(field);
    for (let t = 1; t < 2000 && !field.fighters.some((f) => f.engaged); t++) stepField(field, step(t, rng), 34);
    expect(field.fighters).toHaveLength(1);
    expect(field.fighters[0].engaged).toBe(true);
  });

  it('two survivors left never duel each other: both walk at the player', () => {
    const rng = seeded(11);
    const field = fieldOf([fighter(1, 10, 10), fighter(2, 10.5, 10)], 50, 50);
    for (let t = 0; t < 600 && !field.fighters.some((f) => f.engaged); t++) stepField(field, step(t, rng), 34);
    expect(field.fighters).toHaveLength(2);
    expect(field.fighters.some((f) => f.duel)).toBe(false);
    expect(field.fighters.some((f) => f.engaged)).toBe(true);
  });

  it('a plan alone empties the field: every engagement won, the last one alone', () => {
    for (const plan of [DEFAULT_ROYALE_PLAN, ['keep_away'], ['wait_at_edge'], ['hold_centre'], ['lie_low', 'hunt_weakest']]) {
      const rng = seeded(21);
      const field = createField(rng);
      let lastFight = 0;
      let t = 0;
      for (; t < 30_000 && field.fighters.length > 0; t++) {
        const result = stepField(field, step(t, rng, plan), 37);
        if (result.engaged.length) {
          lastFight = result.engaged.length;
          // The player wins every fight at once.
          clearEngaged(field);
        }
      }
      expect(field.fighters, `plan ${plan.join(', ')}`).toHaveLength(0);
      expect(lastFight, `plan ${plan.join(', ')}: the champion is fought alone`).toBe(1);
    }
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
    field.fighters = field.fighters.slice(0, 3).map((f, i) => ({ ...f, x: 1 + i, y: 1 }));
    expect(game.moveOnField(55, 55)).toBe(true);
    expect(field.player.target).toEqual({ x: 55, y: 55 });
    tickUntil(game, () => !festivalRun(s)!.field!.player.target, 2000);
    const p = festivalRun(s)!.field!.player;
    expect(Math.hypot(p.x - 55, p.y - 55)).toBeLessThan(0.5);
    expect(game.moveOnField(500, -3)).toBe(true);
    expect(festivalRun(s)!.field!.player.target).toEqual({ x: 60, y: 0 });
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
    tickUntil(game, () => !!game.state.combat);
    expect(festivalRun(game.state)!.field!.fighters.some((f) => f.engaged)).toBe(true);
    const loaded = new Game(deserialize(serialize(game.state)));
    const s = loaded.state;
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
