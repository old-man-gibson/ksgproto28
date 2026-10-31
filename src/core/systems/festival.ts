import type { EventBus } from '../engine/events';
import type { FestivalRun, FestivalState, GameState, HeldGear, ItemInstance, MaterialDef, QualityTier, SlotId } from '../types';
import { ITEMS, MATERIALS, SPOTS } from '../registry';
import {
  ARENA,
  DARK_ROOM,
  DARK_ROOM_WAVES,
  FESTIVAL_DOOR_KEY,
  FESTIVAL_REWARD,
  FESTIVAL_RESTOCK,
  ROYALE_SECTIONS,
  scoutedKey,
  FESTIVAL_SWIFT_KEY,
  FESTIVAL_TOKEN,
  FESTIVAL_WINS_KEY,
  ISSUED_WEAPONS,
  PREP_TICKS,
  ROYALE_FLOOR,
  SWIFT_ENTRY_TICKS,
  TOKEN_EVERY_WINS,
  WAVE_PAUSE_TICKS,
  weaponKillsKey,
} from '../data/festival.data';
import { rand } from '../engine/rng';
import { bumpStat, setStat } from './achievements';
import { itemDefOf } from './assembly';
import { startStagedGroup } from './combat';
import { isCard } from './consumables';
import { grantGraded } from './disciplines';
import { equipItem, wearIfFree } from './equipment';
import { festivalRun, lockoutEnd, onFestivalFloor } from './festivalRules';
import { royaleFightWon, tickRoyale } from './royale';
import { createItem } from './runes';
import { searchKey } from './search';
import { stashToken } from './stash';
import { checkTitleUnlocks } from './titles';
import { climbTo } from './towers';
import { text } from '../text/log';

/**
 * The Vermin Festival, floors 15–16 (docs/FLOOR_IDEAS.md §5.3 items 6, 10–20,
 * 23–25). One attempt runs from the dark room to the royale's end:
 *
 * - **The door.** Arriving in the dark room (floor 15's landing) starts an
 *   attempt: everything worn and carried is held, flasks and provisions
 *   too, and one plain weapon of the player's family is issued. It all
 *   comes back when the attempt ends, won or lost: into its slot if the
 *   slot is empty, otherwise into the pack.
 * - **The dark room.** Nine others, in four waves; the last fights alone and
 *   is floor 15's boss line. The room emptied, its door opens onto the hub.
 * - **The hub.** Ten festival days to prepare. The festival keeps its own
 *   clock: it runs only while the game does with the player on its floors,
 *   and offline catch-up banks the time instead (save/offline.ts).
 * - **The royale.** Floor 16, entered by the ladder (a time jump to the end
 *   of the ten days) or on its own at day ten. systems/royale.ts runs it.
 * - **The loss.** A knockout on either floor, or the ladder to anywhere but
 *   the royale, lands the player outside the tower (systems/safety.ts,
 *   systems/towers.ts) and shuts both floors for three days or until the
 *   next prestige (systems/festivalRules.ts).
 *
 * Fights are ordinary fights in the battle stage, staged at the festival's
 * spots, so the spots' encounter tables are what the bestiary and the lints
 * read; nothing rolls them.
 */

/** The festival block, created on first use. Assigned, then read back through the state. */
function festivalOf(state: GameState): FestivalState {
  if (!state.festival) state.festival = {};
  return state.festival;
}

// ---------- The issued weapon ----------

/**
 * The weapon family the door issues (§5.4 Q4, approved): the family whose
 * skill level is highest, ties broken by kills with that family, then by
 * ISSUED_WEAPONS order. A save with no weapon skill gets the table's first.
 */
export function issuedWeapon(state: GameState): (typeof ISSUED_WEAPONS)[number] {
  let best = ISSUED_WEAPONS[0];
  let bestLevel = -1;
  let bestKills = -1;
  for (const w of ISSUED_WEAPONS) {
    const level = state.skills[w.skill]?.level ?? 0;
    const kills = state.stats[weaponKillsKey(w.family)] ?? 0;
    if (level > bestLevel || (level === bestLevel && kills > bestKills)) {
      best = w;
      bestLevel = level;
      bestKills = kills;
    }
  }
  return best;
}

/** The family of the weapon in hand, as ISSUED_WEAPONS names it: `unarmed` with none, '' for a family it does not list. */
export function weaponFamilyInHand(state: GameState): string {
  const weapon = state.equipment.weapon;
  if (!weapon) return 'unarmed';
  const tags = itemDefOf(weapon)?.tags ?? [];
  return ISSUED_WEAPONS.find((w) => tags.includes(w.family))?.family ?? '';
}

// ---------- The door: holding and returning gear ----------

/** A plain copy of save data, so the held set shares nothing with live state. */
function plainCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Food and potions: a consumable that is eaten or drunk. Cards are read, not carried into a fight. */
function isProvision(def: MaterialDef): boolean {
  return !!def.consumable && !isCard(def.consumable);
}

/** Take the provisions out of the pouch, plain counts and graded stock both. */
function holdProvisions(state: GameState): NonNullable<HeldGear['provisions']> {
  const held: NonNullable<HeldGear['provisions']> = { materials: {}, stock: {} };
  for (const def of Object.values(MATERIALS)) {
    if (!isProvision(def)) continue;
    const count = state.materials[def.id];
    if (count) held.materials[def.id] = count;
    delete state.materials[def.id];
    const grades = state.stock?.[def.id];
    if (grades && Object.values(grades).some((n) => (n ?? 0) > 0)) held.stock[def.id] = plainCopy(grades);
    if (state.stock) delete state.stock[def.id];
  }
  return held;
}

/** Take everything worn and carried off the player, as the door holds it. */
function holdGear(state: GameState): HeldGear {
  const held: HeldGear = plainCopy({
    equipment: state.equipment,
    inventory: state.inventory,
    sheathed: state.sheathed,
    coating: state.coating,
    flasks: state.flasks ?? [],
  });
  held.provisions = holdProvisions(state);
  state.equipment = {};
  state.inventory = [];
  state.sheathed = null;
  state.coating = null;
  state.flasks = [];
  return held;
}

/**
 * Give the held set back (ruling 2026-10-30). The issued weapon and the
 * royale's lent finds (`run.lent`) are taken back wherever they are. Whatever
 * else the attempt put in the player's hands stays where it is: a find from
 * the hub worn stays worn. Each held piece goes back into its
 * slot if the slot is empty and the piece fits, otherwise into the pack.
 * Flasks and provisions are added to what the attempt left. Returns how many
 * held pieces went to the pack for want of a slot.
 */
function returnGear(state: GameState, run: FestivalRun): number {
  // The issued weapon and the royale's finds are lent: all taken back, wherever they are.
  const lent = new Set<number>(run.lent ?? []);
  if (run.issued !== undefined) lent.add(run.issued);
  for (const [slot, item] of Object.entries(state.equipment) as [SlotId, ItemInstance | undefined][]) {
    if (item && lent.has(item.uid)) delete state.equipment[slot];
  }
  if (state.sheathed && lent.has(state.sheathed.uid)) state.sheathed = null;
  const gained = state.inventory.filter((i) => !lent.has(i.uid));
  const held = plainCopy(run.held);
  const bumped: ItemInstance[] = [];
  for (const [slot, item] of Object.entries(held.equipment) as [SlotId, ItemInstance | undefined][]) {
    if (item && !wearIfFree(state, slot, item)) bumped.push(item);
  }
  if (held.sheathed) {
    if (state.sheathed) bumped.push(held.sheathed);
    else state.sheathed = held.sheathed;
  }
  state.inventory = [...held.inventory, ...bumped, ...gained];
  // The oil stays on a blade the attempt left in hand; otherwise the held oil
  // comes back, live again whenever its own weapon is.
  const weapon = state.equipment.weapon;
  if (!state.coating || state.coating.weaponUid !== weapon?.uid) state.coating = held.coating;
  state.flasks = [...(held.flasks ?? []), ...(state.flasks ?? [])];
  for (const [id, count] of Object.entries(held.provisions?.materials ?? {})) {
    state.materials[id] = (state.materials[id] ?? 0) + count;
  }
  for (const [id, grades] of Object.entries(held.provisions?.stock ?? {})) {
    for (const [quality, count] of Object.entries(grades) as [QualityTier, number | undefined][]) {
      if (count) grantGraded(state, id, quality, count);
    }
  }
  return bumped.length;
}

/** The log line for held pieces that went to the pack because their slot was taken. */
function reportBumped(bus: EventBus, count: number): void {
  if (count > 0) bus.emit({ type: 'log', msg: text('festival.bumped', { count, plural: count === 1 ? '' : 's' }), kind: 'item' });
}

/** Every attempt opens on a full store: the stores' search limits restart. */
function restockStores(state: GameState, bus: EventBus): void {
  for (const spotId of FESTIVAL_RESTOCK) {
    const spot = SPOTS[spotId];
    for (const act of spot?.activities ?? []) {
      if (act.kind !== 'search') continue;
      const key = searchKey(spot.id, act.id);
      for (const k of [key, ...act.rewards.map((r) => `${key}:${r.id}`)]) {
        if ((state.stats[k] ?? 0) !== 0) setStat(state, bus, k, 0);
      }
    }
  }
  // The last attempt's survey scouted the last attempt's field.
  for (const id of Object.keys(ROYALE_SECTIONS)) {
    const k = scoutedKey(id);
    if ((state.stats[k] ?? 0) !== 0) setStat(state, bus, k, 0);
  }
}

/**
 * An attempt begins: the door takes the gear, issues the weapon, shuts the
 * dark room's door and restocks the hub. No-op while one is in progress.
 */
export function startFestival(state: GameState, bus: EventBus): void {
  const fest = festivalOf(state);
  if (fest.run) return;
  const held = holdGear(state);
  const pick = issuedWeapon(state);
  let issued: number | undefined;
  if (pick.item && ITEMS[pick.item]) {
    // A plain issue: no affix, no rune slots, whatever the def could roll.
    const item: ItemInstance = { ...createItem(state, pick.item), slots: 0, runes: [] };
    state.inventory.push(item);
    issued = item.uid;
    equipItem(state, bus, item.uid);
  }
  setStat(state, bus, FESTIVAL_DOOR_KEY, 0);
  restockStores(state, bus);
  fest.run = {
    phase: 'dark',
    wave: 0,
    nextAt: state.totalTicks + WAVE_PAUSE_TICKS,
    clock: 0,
    held,
    ...(issued !== undefined ? { issued } : {}),
    // This attempt's royale terrain, fixed now so the hub's survey scouts the field it will open on.
    fieldSeed: Math.floor(rand(state) * 0x100000000),
  };
  const pieces = held.inventory.length + Object.values(held.equipment).filter(Boolean).length + (held.sheathed ? 1 : 0);
  bus.emit({
    type: 'log',
    msg: text('festival.door_held', {
      pieces,
      plural: pieces === 1 ? '' : 's',
      issued: pick.item && ITEMS[pick.item] ? `${ITEMS[pick.item].icon} ${ITEMS[pick.item].name}` : 'bare hands',
    }),
    kind: 'danger',
  });
}

// ---------- The tick ----------

/**
 * Once per advance, after the activity has ticked (game.ts). Ends an attempt
 * the player has left, runs the festival's clock, and starts what is due:
 * the next dark room wave, the royale at day ten, the next engagement.
 */
export function tickFestival(state: GameState, bus: EventBus): void {
  settleExit(state, bus);
  const run = festivalRun(state);
  if (!run) return;
  // The clock starts at the door's opening. settleExit has just checked the
  // player is on the festival's floors, the only place it runs.
  if (run.phase !== 'dark') run.clock += 1;
  if (state.travel || state.recovering) return;
  if (run.phase === 'dark') tickDarkRoom(state, bus, run);
  else if (run.phase === 'prep') {
    // Day ten: the survivors are walked up to floor 16, ready or not.
    if (run.clock >= PREP_TICKS && !state.combat) climbTo(state, bus, ROYALE_FLOOR);
  } else if (state.spot === ARENA) tickRoyale(state, bus, run);
}

/** The next wave steps up once the last has fallen and the pause is over. */
function tickDarkRoom(state: GameState, bus: EventBus, run: FestivalRun): void {
  if (state.spot !== DARK_ROOM || state.combat || state.totalTicks < run.nextAt) return;
  const wave = DARK_ROOM_WAVES[run.wave];
  if (wave) startStagedGroup(state, bus, SPOTS[DARK_ROOM], wave);
}

/**
 * A live attempt whose player is no longer on its floors is lost: a
 * knockout's ejection, the ladder's forfeit, or anything else that moved
 * them. The win ends the attempt on floor 16 before this can see it.
 */
function settleExit(state: GameState, bus: EventBus): void {
  if (!festivalRun(state) || onFestivalFloor(state)) return;
  loseFestival(state, bus);
}

// ---------- Endings ----------

function openDoor(state: GameState, bus: EventBus, run: FestivalRun): void {
  run.phase = 'prep';
  run.clock = 0;
  setStat(state, bus, FESTIVAL_DOOR_KEY, 1);
  bus.emit({ type: 'log', msg: text('festival.door_open'), kind: 'quest' });
}

/** The gear comes back, the attempt is gone and floors 15–16 are shut (§5.3 item 16). */
function loseFestival(state: GameState, bus: EventBus): void {
  const fest = festivalOf(state);
  const run = fest.run;
  if (!run) return;
  const bumped = returnGear(state, run);
  delete fest.run;
  fest.lockedUntil = lockoutEnd(state);
  bus.emit({ type: 'log', msg: text('festival.lost'), kind: 'danger' });
  reportBumped(bus, bumped);
}

/**
 * The royale is won: the gear comes back and the run's win is counted. The
 * first win of a run pays the festival's reward; every later one pays
 * nothing (§5.3 item 17), except that each hundredth win of the run puts a
 * token in the stronghold stash (items 23–24). A win whose climb began
 * within twelve festival hours of the door opening also earns the hidden
 * title; its counter is written here and nowhere else (item 14).
 */
function winFestival(state: GameState, bus: EventBus): void {
  const fest = festivalOf(state);
  const run = fest.run;
  if (!run) return;
  const swift = run.enteredAt !== undefined && run.enteredAt <= SWIFT_ENTRY_TICKS;
  const bumped = returnGear(state, run);
  delete fest.run;
  const first = (state.stats[FESTIVAL_WINS_KEY] ?? 0) === 0;
  bumpStat(state, bus, FESTIVAL_WINS_KEY);
  bus.emit({ type: 'log', msg: text('festival.won'), kind: 'quest' });
  reportBumped(bus, bumped);
  if (first && ITEMS[FESTIVAL_REWARD]) {
    const reward = createItem(state, FESTIVAL_REWARD);
    state.inventory.push(reward);
    bus.emit({ type: 'loot', item: reward });
    const def = ITEMS[FESTIVAL_REWARD];
    bus.emit({ type: 'log', msg: text('festival.reward', { icon: def.icon, name: def.name }), kind: 'loot' });
  }
  if ((state.stats[FESTIVAL_WINS_KEY] ?? 0) % TOKEN_EVERY_WINS === 0) {
    stashToken(state, Math.floor(rand(state) * 0x100000000));
    bus.emit({
      type: 'log',
      msg: text('festival.token', { icon: FESTIVAL_TOKEN.icon, name: FESTIVAL_TOKEN.name, wins: state.stats[FESTIVAL_WINS_KEY] }),
      kind: 'achievement',
    });
  }
  if (swift) {
    bumpStat(state, bus, FESTIVAL_SWIFT_KEY);
    checkTitleUnlocks(state, bus);
  }
}

/** A won fight at a festival spot: the dark room's next wave, or the royale's field. */
function festivalFightWon(state: GameState, bus: EventBus, spotId: string): void {
  const run = festivalRun(state);
  if (!run) return;
  if (run.phase === 'dark' && spotId === DARK_ROOM) {
    run.wave += 1;
    if (run.wave >= DARK_ROOM_WAVES.length) openDoor(state, bus, run);
    else run.nextAt = state.totalTicks + WAVE_PAUSE_TICKS;
  } else if (run.phase === 'royale' && spotId === ARENA) {
    if (royaleFightWon(state, bus, run)) winFestival(state, bus);
  }
}

/**
 * The festival's listeners (game.ts, after the levels'): kills counted by
 * weapon family (the issued weapon's tie-break), an attempt started by
 * arriving in the dark room, its fights, and its exits.
 */
export function registerFestivalListeners(state: GameState, bus: EventBus): void {
  bus.on('kill', () => {
    const family = weaponFamilyInHand(state);
    if (family) bumpStat(state, bus, weaponKillsKey(family));
  });
  bus.on('fight:won', (ev) => festivalFightWon(state, bus, ev.spot));
  bus.on('arrive', (ev) => {
    if (ev.spot === DARK_ROOM && !festivalRun(state)) startFestival(state, bus);
    settleExit(state, bus);
  });
}
