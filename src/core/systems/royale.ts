import type { EventBus } from '../engine/events';
import type { FestivalRun, GameState, ItemDef, ItemInstance, RoyaleCacheDef, RoyaleDenDef, RoyaleStrategyDef } from '../types';
import { ITEMS, ROYALE_STRATEGIES, SPOTS } from '../registry';
import {
  ARENA,
  CACHE_WEAPONS,
  DEFAULT_ROYALE_PLAN,
  ISSUED_WEAPONS,
  ROYALE_DENS,
  ROYALE_LAYOUT_VERSION,
  ROYALE_PLAN_SLOTS,
  SURVIVOR_LEVELS,
  SURVIVOR_SPECIES,
} from '../data/festival.data';
import { rand } from '../engine/rng';
import { startStagedGroup } from './combat';
import { getDerivedStats } from './derived';
import { wearIfFree } from './equipment';
import { prepShare, survivorLevel } from './festivalRules';
import { heal, hpFraction } from './health';
import { availableMax } from './resources';
import { championFight, clearEngaged, createField, restoreChampion, stepField } from './royaleField';
import { sectionKnown } from './royaleTerrain';
import { survivorMember } from './survivorGen';
import { createItem } from './runes';
import { text } from '../text/log';

/**
 * The royale on floor 16 (docs/FLOOR_IDEAS.md §5.3 items 13 and 18,
 * docs/FESTIVAL.md §9.2): the isometric field (systems/royaleField.ts, drawn
 * by ui/lib/RoyaleField.svelte) with its engagements fought in the battle
 * stage. The player moves by a ranked plan of strategies, or by hand at any
 * time; a plan alone can win.
 *
 * The survivors who reach the player become an ordinary staged fight at the
 * arena, at their own levels and with the wounds they carry. Won, they leave
 * the field. A den the player walks into is a staged fight too, with the den's
 * monsters at their pinned levels; won, the den is cleared and its cache
 * opens, and the field does not change. The last survivor is the champion,
 * fought alone: floor 16's boss line, so its fall is the win and nothing else
 * is (systems/festival.ts counts it).
 */

/** The player's ranked strategies: their own, or the default plan. Unknown ids are skipped. */
export function royalePlan(state: GameState): RoyaleStrategyDef[] {
  const ids = state.festival?.plan?.length ? state.festival.plan : DEFAULT_ROYALE_PLAN;
  return ids.map((id) => ROYALE_STRATEGIES[id]).filter((s): s is RoyaleStrategyDef => !!s);
}

/** Rank the player's strategies (at most ROYALE_PLAN_SLOTS, known ids only, no repeats). */
export function setRoyalePlan(state: GameState, ids: string[]): void {
  const plan = [...new Set(ids)].filter((id) => !!ROYALE_STRATEGIES[id]).slice(0, ROYALE_PLAN_SLOTS);
  if (!state.festival) state.festival = {};
  state.festival.plan = plan;
}

/**
 * Send the player to a point on the field by hand (§5.3 item 18). The plan
 * takes over again on arrival. Ignored off the field.
 */
export function moveOnField(state: GameState, x: number, y: number): boolean {
  const field = state.festival?.run?.field;
  if (!field || state.spot !== ARENA || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const size = field.size;
  field.player.target = { x: Math.max(0, Math.min(size, x)), y: Math.max(0, Math.min(size, y)) };
  return true;
}

/** Clear a hand-set destination: the plan decides again. */
export function clearFieldTarget(state: GameState): void {
  const field = state.festival?.run?.field;
  if (field?.player.target) delete field.player.target;
}

/** Every species' plan, resolved once. */
const SPECIES_PLANS = new Map(
  SURVIVOR_SPECIES.map((s) => [
    s.monsterId,
    s.plan.map((id) => ROYALE_STRATEGIES[id]).filter((d): d is RoyaleStrategyDef => !!d),
  ]),
);

const DENS = new Map(ROYALE_DENS.map((d) => [d.id, d]));

/** One tick of the field while the player stands on it. */
export function tickRoyale(state: GameState, bus: EventBus, run: FestivalRun): void {
  const now = state.totalTicks;
  // A field from before the current layout (a counter, the first isometric
  // field) is replaced whole, but never during a fight: its survivors are in
  // it (docs/FESTIVAL.md §9.2a rule 3).
  if (!run.field?.fighters || run.field.layout !== ROYALE_LAYOUT_VERSION) {
    if (state.combat) return;
    run.field = createField(() => rand(state), run.fieldSeed, now);
    // An attempt saved without a seed keeps the one its field drew.
    if (run.fieldSeed === undefined) run.fieldSeed = run.field.seed;
  }
  const field = run.field;
  if (!field) return;
  // A fight is staged the tick its survivors are engaged, and a won one takes
  // them off the field, so engaged survivors (or a den fight) with no fight
  // are left over from a fight dropped without an ending (a reload
  // mid-fight): they walk again.
  if (!state.combat) {
    for (const f of field.fighters) if (f.engaged) delete f.engaged;
    if (field.denFight) delete field.denFight;
  }
  // The royale must be able to end: a field with no one on it gets its champion back.
  restoreChampion(field);
  const stats = getDerivedStats(state);
  const hp = hpFraction(state, stats);
  const baseLevel = SURVIVOR_LEVELS.base + Math.round(SURVIVOR_LEVELS.growth * prepShare(run.clock));
  const result = stepField(
    field,
    {
      now,
      rng: () => rand(state),
      playerFree: !state.combat,
      playerHp: hp,
      playerPower: state.level,
      playerSpeed: stats.travelSpeed,
      plan: royalePlan(state),
      planOf: (id) => SPECIES_PLANS.get(id) ?? [],
      knows: (section) => sectionKnown(state, field, section),
    },
    baseLevel,
  );
  // The spring heals the player out of combat only (the step reports it only then), and only a wound.
  if (result.playerHeal > 0 && hp < 1) {
    const max = availableMax(state, stats, 'hp');
    heal(state, stats, max * result.playerHeal, 'idle');
  }
  for (const cache of result.playerCaches) takeCache(state, bus, run, cache);
  if (result.den) {
    startDenFight(state, bus, field, result.den);
    return;
  }
  if (result.engaged.length === 0) return;
  // The last survivor is the champion, whatever it walked the field as.
  const last = field.fighters.length === 1;
  startStagedGroup(
    state,
    bus,
    SPOTS[ARENA],
    // Each survivor fights as its generated build: name, kit, attribute
    // emphasis (systems/survivorGen.ts, docs/FESTIVAL.md §9.6).
    result.engaged.map((f) => survivorMember(field.seed ?? 0, f, survivorLevel(run.clock, f.wins, last), f.hp, last)),
  );
}

// ---------- Caches and dens ----------

/** The weapon family the door issued: that of the issued item, 'unarmed' with bare hands. */
function issuedFamily(state: GameState, run: FestivalRun): string {
  if (run.issued === undefined) return 'unarmed';
  const carried = [...Object.values(state.equipment), ...state.inventory, ...(state.sheathed ? [state.sheathed] : [])];
  const item = carried.find((i): i is ItemInstance => i?.uid === run.issued);
  return ISSUED_WEAPONS.find((w) => w.item === item?.defId)?.family ?? 'unarmed';
}

/**
 * The player reaches an open cache (the field has already marked it taken).
 * An item or weapon is lent for the attempt: a plain copy (no affix, no rune
 * slots), worn if its slot is free and otherwise in the pack, its uid
 * recorded in `run.lent` for the attempt's end. A weapon cache lends the
 * weapon of the issued family (CACHE_WEAPONS; bare hands get gauntlets). A lent weapon of the issued family takes the hand from the issued
 * weapon, which goes to the pack (`takesTheHand`), so a plan alone fights with
 * what the field gave it. A heal cache restores a share of max health at once.
 */
function takeCache(state: GameState, bus: EventBus, run: FestivalRun, cache: RoyaleCacheDef): void {
  const name = `${cache.icon} ${cache.name}`;
  if (cache.heal !== undefined) {
    const stats = getDerivedStats(state);
    const healed = Math.round(heal(state, stats, availableMax(state, stats, 'hp') * cache.heal, 'other'));
    bus.emit({ type: 'log', msg: text('festival.cache_heal', { cache: name, healed }), kind: 'item' });
    return;
  }
  const defId = cache.item ?? (cache.weapon ? CACHE_WEAPONS[issuedFamily(state, run)] : undefined);
  const def = defId ? ITEMS[defId] : undefined;
  if (!def) {
    bus.emit({ type: 'log', msg: text('festival.cache_empty', { cache: name }), kind: 'item' });
    return;
  }
  const item: ItemInstance = { ...createItem(state, def.id), slots: 0, runes: [] };
  run.lent ??= [];
  run.lent.push(item.uid);
  const swapped = takesTheHand(state, run, def, item);
  const worn = swapped || wearIfFree(state, def.slot, item);
  if (!worn) state.inventory.push(item);
  // Literal keys at each call: the log-template lint finds a template by its call site.
  const vars = { cache: name, icon: def.icon, item: def.name };
  const msg = swapped
    ? text('festival.cache_swapped', vars)
    : worn
      ? text('festival.cache_worn', vars)
      : text('festival.cache_packed', vars);
  bus.emit({ type: 'log', msg, kind: 'loot' });
}

/**
 * A lent weapon of the issued weapon's family goes into the hand in its place
 * (the issued weapon moves to the pack) when the hand still holds the issued
 * weapon and the lent one is a different item. There is no ranking of weapons
 * in the code, so a different item of the same family always counts as the
 * step up: the field's weapons are placed above the starters (CACHE_WEAPONS).
 * Returns true when the lent weapon is now in the hand; the issued weapon
 * stays put if the lent one cannot be wielded in its place.
 */
function takesTheHand(state: GameState, run: FestivalRun, def: ItemDef, item: ItemInstance): boolean {
  const held = state.equipment.weapon;
  if (def.slot !== 'weapon' || !held || held.uid !== run.issued || held.defId === def.id) return false;
  if (ISSUED_WEAPONS.find((w) => def.tags.includes(w.family))?.family !== issuedFamily(state, run)) return false;
  delete state.equipment.weapon;
  if (!wearIfFree(state, 'weapon', item)) {
    state.equipment.weapon = held;
    return false;
  }
  state.inventory.push(held);
  return true;
}

/** The player walks into a den: its monsters at their pinned levels, a staged fight at the arena. */
function startDenFight(state: GameState, bus: EventBus, field: NonNullable<FestivalRun['field']>, den: RoyaleDenDef): void {
  field.denFight = den.id;
  bus.emit({ type: 'log', msg: text('festival.den_enter', { den: `${den.icon} ${den.name}` }), kind: 'danger' });
  startStagedGroup(state, bus, SPOTS[ARENA], den.foes);
}

/**
 * A fight on the field was won. Returns true only when it held the champion,
 * the last survivor: that is the royale won (docs/FESTIVAL.md §9.2a rule 2).
 * A den fight clears its den and opens its cache and changes nothing else:
 * no survivor leaves, nothing is counted, the royale goes on. A fight with
 * survivors takes them off the field. Both reset the player's radar clock.
 */
export function royaleFightWon(state: GameState, bus: EventBus, run: FestivalRun): boolean {
  const field = run.field;
  if (!field?.fighters) return false;
  field.player.lastFight = state.totalTicks;
  const denId = field.denFight;
  if (denId) {
    delete field.denFight;
    const den = DENS.get(denId);
    field.cleared ??= [];
    if (den && !field.cleared.includes(den.id)) {
      field.cleared.push(den.id);
      bus.emit({ type: 'log', msg: text('festival.den_cleared', { den: `${den.icon} ${den.name}` }), kind: 'combat' });
    }
    return false;
  }
  const champion = championFight(field);
  clearEngaged(field);
  const left = field.fighters.length;
  if (left > 0) bus.emit({ type: 'log', msg: text('festival.field_left', { alive: left }), kind: 'combat' });
  return champion;
}
