import type {
  DamageType,
  GameState,
  Modifier,
  ModOrigin,
  ModTarget,
  MonsterInstance,
  ResourceId,
  StatusApplication,
  StatusDef,
  StatusInstance,
  StatusRemoval,
} from '../types';
import { ELEMENTAL_TYPES, RES_STAT_BY_TYPE, isMonsterBearer } from '../types';
import { STATUSES } from '../data/statuses.data';
import { MONSTERS } from '../data/monsters.data';
import { TITLES } from '../data/titles.data';
import { chance } from '../engine/rng';

/**
 * Status conditions — poison, burns, chills, wounds.
 *
 * Three ideas do most of the work here:
 *
 *  - **Intensity, not instances.** A condition is one entry with a magnitude,
 *    and `stacking` decides what a second application does to it: keep the
 *    stronger, fold part of the newcomer in, add up, or count them separately.
 *    Everything content wants to express has turned out to be one of those.
 *
 *  - **Escalation.** Most conditions have a worse form waiting behind them.
 *    Chill enough and you freeze; a bleed left alone becomes a laceration. The
 *    base names its `escalatesTo`, the worse one names its `baseForm`, and
 *    healing can walk you back down the ladder as readily as damage walked you
 *    up it.
 *
 *  - **Removal belongs to the source, not the condition.** The same burn is a
 *    passing nuisance from a torch and a permanent curse from something worse,
 *    so a `StatusApplication` may carry its own `duration` and `removal` rules,
 *    and the definition's are only the default.
 *
 * This module deliberately imports almost nothing: the registries, the RNG, and
 * types. It never touches resources.ts or health.ts, because both of those need
 * to ask it questions (what is my pool's ceiling? may this heal land?). Ticking
 * therefore *reports* the damage a condition wants to deal and lets the caller
 * apply it, rather than reaching for the health system itself.
 */

export function statusDef(id: string): StatusDef | undefined {
  return STATUSES[id];
}

// ---------- Reading what is held ----------

/** The conditions on a bearer; the player and a monster are read the same way. */
export function statusesOf(bearer: GameState | MonsterInstance): StatusInstance[] {
  return bearer.statuses ?? [];
}

export function findStatus(
  bearer: GameState | MonsterInstance,
  id: string,
): StatusInstance | undefined {
  return statusesOf(bearer).find((s) => s.id === id);
}

export function hasStatus(bearer: GameState | MonsterInstance, id: string): boolean {
  return findStatus(bearer, id) !== undefined;
}

/** Total intensity of a condition, 0 when it is absent. */
export function statusIntensity(bearer: GameState | MonsterInstance, id: string): number {
  return findStatus(bearer, id)?.intensity ?? 0;
}

/** Everything worth showing in the UI, worst first. */
export function visibleStatuses(bearer: GameState | MonsterInstance): StatusInstance[] {
  return statusesOf(bearer)
    .filter((s) => !STATUSES[s.id]?.hidden)
    .sort((a, b) => b.intensity - a.intensity);
}

// ---------- Applying ----------

function list(bearer: GameState | MonsterInstance): StatusInstance[] {
  return (bearer.statuses ??= []);
}

function durationOf(def: StatusDef, app: StatusApplication): number | null {
  if (app.duration === 'permanent') return null;
  return app.duration ?? def.duration;
}

/**
 * The share of a condition that lands however well the body is armoured against
 * it. Resistance buys you the CONSEQUENCES, never the immunity: a creature made
 * of ice still registers a chill, it simply needs four times the doses to freeze.
 *
 * Without a floor a 0.9-resistant target needs fifty applications to escalate a
 * bleed that costs five — indistinguishable from immune, and it would quietly
 * delete condition builds from every fight against a resistant species. The
 * floor is what keeps `applications-to-escalation` a number the player can still
 * play toward.
 */
export const APPLICATION_FLOOR = 0.25;

/**
 * Resistance at or above this, after the applier's penetration, is IMMUNITY: the
 * condition does not land at all. Below it the floor above still applies.
 */
export const IMMUNITY_RESISTANCE = 1;

/**
 * The player's resistances that sat ABOVE their cap before `computeDerivedStats`
 * clamped them, keyed by stat key (`resPoison`), attached to the stat block that
 * was returned. Only entries that exceeded the cap are stored.
 *
 * The immunity test needs the number before the cap: `resistCap` (0.75 by
 * default) exists to limit damage reduction, and a cap under 1 would make the
 * player unable to reach `IMMUNITY_RESISTANCE` however much they stacked. It is
 * a side table rather than a stat because `DerivedStats` is `Record<StatKey,
 * number>` and a new key would spread through every stat list, tooltip and
 * test. A copy of the block (`{ ...stats }`) loses the entry, and the lookup
 * then falls back to the capped value: immunity fails closed, never open.
 */
const UNCAPPED_RESISTANCE = new WeakMap<object, Record<string, number>>();

/** Called by `computeDerivedStats` with the resistances it is about to clamp. */
export function noteUncappedResistance(stats: object, over: Record<string, number>): void {
  UNCAPPED_RESISTANCE.set(stats, over);
}

/**
 * A live monster's resistance to a type, as its damage pipeline stacks it
 * before the body's clamp: the species' innate value (declared, else from its
 * tags), its conditions' mods, derived mods, overrides and floors, plus
 * `resElemental` for the elemental types.
 *
 * Registered by `monsterStats.ts` when it loads. This module is a near-leaf and
 * `monsterStats.ts` imports it, so it cannot import that pipeline back; the
 * reader is handed over instead. Until it is registered the monster branch
 * falls back to the narrower declared-plus-mods reading, so a test or tool that
 * never loads `monsterStats.ts` still runs.
 */
type MonsterResistanceReader = (monster: MonsterInstance, type: DamageType) => number;
let monsterResistanceReader: MonsterResistanceReader | undefined;

export function setMonsterResistanceReader(reader: MonsterResistanceReader): void {
  monsterResistanceReader = reader;
}

/**
 * A live monster's resistance to a type as its DAMAGE path applies it: the same
 * pipeline as above (innate from the species and its tags, conditions' mods,
 * derived mods, overrides and floors, plus `resElemental` for the elemental
 * types), held at the body's own cap. It is the figure `monsterSlice` stacks, so
 * a condition's damage ticks (a dot, a parting blow) shed what a blow of the
 * same type would. Registered by `monsterStats.ts` for the same reason as the
 * reader above.
 *
 * Two readers because the two questions differ: the immunity test asks how far
 * resistance reaches (a body at 1.2 is immune), so it wants the number before
 * the cap; damage asks how much is shed (the cap holds it under 1), so it wants
 * the number after.
 */
let monsterDamageResistanceReader: MonsterResistanceReader | undefined;

export function setMonsterDamageResistanceReader(reader: MonsterResistanceReader): void {
  monsterDamageResistanceReader = reader;
}

/**
 * The player's resistance to an element as conditions read it: the figure the
 * damage pipeline stacks BEFORE its cap (the pre-cap record
 * `computeDerivedStats` leaves on the block), plus `resElemental` for the
 * elemental types. Undefined when no block was passed.
 */
function playerConditionResistance(
  stats: Record<string, number> | undefined,
  element: DamageType,
): number | undefined {
  const key = RES_STAT_BY_TYPE[element];
  const own = stats?.[key];
  if (own === undefined) return undefined;
  return (
    (UNCAPPED_RESISTANCE.get(stats!)?.[key] ?? own) +
    (ELEMENTAL_TYPES.has(element) ? (stats!.resElemental ?? 0) : 0)
  );
}

/** A monster's resistance to an element as conditions read it (see the reader above). */
function monsterConditionResistance(monster: MonsterInstance, element: DamageType): number {
  return (monsterResistanceReader ?? monsterResistanceUncapped)(monster, element);
}

/** What a condition's resistance line says, for a readout. See `conditionResistance`. */
export type ConditionResistance =
  /** No element and not marked: a buff or a bookkeeping condition. Nothing to say. */
  | { kind: 'none' }
  /** `StatusDef.unresistable`: no stat of the bearer's changes the dose. */
  | { kind: 'unresistable'; reason: string }
  /**
   * Resisted by `element`. `total` is the figure the immunity test reads (before
   * any cap, so it may be above 1) and `immune` is whether new doses are refused:
   * that figure at 1 or more, or an `immune` rule (a held condition, an earned
   * title) naming the condition. The applier's penetration is not known to a
   * readout and is not counted.
   */
  | { kind: 'resisted'; element: DamageType; total: number; immune: boolean };

/**
 * How the bearer stands against a condition, for tooltips: the same figures
 * `applyStatus` reads, so a readout cannot say something the game does not do.
 * Pass the stat block `getDerivedStats` returned for the player (a copy loses
 * the pre-cap record); a monster needs nothing.
 */
export function conditionResistance(
  bearer: GameState | MonsterInstance,
  def: StatusDef,
  stats?: Record<string, number>,
): ConditionResistance {
  if (def.unresistable) return { kind: 'unresistable', reason: def.unresistable };
  if (!def.element) return { kind: 'none' };
  const total =
    (isMonsterBearer(bearer)
      ? monsterConditionResistance(bearer, def.element)
      : playerConditionResistance(stats, def.element)) ?? 0;
  return {
    kind: 'resisted',
    element: def.element,
    total,
    immune: total >= IMMUNITY_RESISTANCE - 1e-9 || wearsImmunityTo(bearer, def),
  };
}

/**
 * How much of an incoming dose survives the bearer's resistance to it; 0 when
 * the bearer cannot be affected by it at all.
 *
 * Reads `StatusDef.element` — the damage type that most commonly inflicts this
 * condition — which is a DIFFERENT field from `StatusDot.type` (what its ticks
 * hurt with) and from the `element` on arcane nouns. A condition with no
 * `element` is not an elemental affliction and is never resisted on
 * application: that is every self-granted buff in the game, and the absence is
 * the authoring, not an omission.
 *
 * ONE figure answers both questions, for both bearers: the resistance the
 * damage pipeline stacks for that element BEFORE its cap (the type's own
 * resistance, plus `resElemental` for the elemental types; for a monster also
 * its tag-derived innate value, derived mods, overrides and floors). Minus the
 * applier's `penetration`, at or above `IMMUNITY_RESISTANCE` means nothing
 * lands. Penetration enters only that test; the share that lands below it reads
 * the same figure, unchanged.
 *
 * The player's stat block is passed in, because this module cannot reach
 * derived.ts — the same contract `tickStatuses` already works under. Passing it
 * is ALWAYS safe: it is consulted only when the bearer really is the player, so
 * a call site whose target varies can hand it over without checking.
 */
function applicationMult(
  state: GameState,
  bearer: GameState | MonsterInstance,
  def: StatusDef,
  stats?: Record<string, number>,
  penetration = 0,
): number {
  // Exempt by design (`StatusDef.unresistable`): nothing about the bearer is
  // read, so no stat, element or penetration can change the dose.
  if (def.unresistable) return 1;
  if (!def.element) return 1;
  // No block passed means the caller cannot see one, not that the player is
  // unarmoured — leave the dose alone rather than inventing a resistance.
  const res =
    bearer === state
      ? playerConditionResistance(stats, def.element)
      : monsterConditionResistance(bearer as MonsterInstance, def.element);
  if (res === undefined) return 1;
  // The epsilon is for sums that are 1 on paper: 0.7 + 3 × 0.1 is a hair under.
  if (res - penetration >= IMMUNITY_RESISTANCE - 1e-9) return 0;
  // Vulnerability amplifies by the same arithmetic it resists by; the clamp is
  // the one `bearerResistance` applies to monsters, extended to the player so
  // equipment cannot stack its way past the floor.
  return Math.max(APPLICATION_FLOOR, 1 - Math.max(-1, Math.min(0.9, res)));
}

/**
 * Whether something the bearer holds makes it immune to this condition, by id
 * or by element (`StatusDef.immune`). Checked beside `blockedBy`: the
 * difference is the direction. `blockedBy` is written on the condition that
 * would land, `immune` on the one that protects, so a status worn by a monster
 * or granted by food can shield without the shielded conditions knowing. The
 * player's earned titles count too (`TitleDef.immune`).
 */
function wearsImmunityTo(bearer: GameState | MonsterInstance, def: StatusDef): boolean {
  for (const held of statusesOf(bearer)) {
    if (refuses(STATUSES[held.id]?.immune, def)) return true;
  }
  // An earned title confers the same refusal on the player (`TitleDef.immune`).
  // Always on, like its `passive` bonuses. A monster has no titles.
  if (!isMonsterBearer(bearer)) {
    for (const id of bearer.titles ?? []) {
      if (refuses(TITLES[id]?.immune, def)) return true;
    }
  }
  return false;
}

/** Whether an `immune` rule (a condition's or a title's) names this condition, by id or element. */
function refuses(immune: StatusDef['immune'], def: StatusDef): boolean {
  if (!immune) return false;
  if (immune.ids?.includes(def.id)) return true;
  return !!def.element && !!immune.elements?.includes(def.element);
}

/**
 * Inflict a condition. Returns the instance actually held afterwards, or null
 * if nothing landed — the roll failed, the id is unknown, or something already
 * held blocks it (you cannot be chilled while you are frozen solid).
 *
 * `stats` is the player's stat block, and what it buys is resistance on
 * APPLICATION: an ice-immune body takes a weaker chill rather than taking a
 * full one and shrugging off the ticks afterwards. See `applicationMult`.
 *
 * **Pass it when something is done TO the player** — a monster's bite, an enemy
 * working, a backlash, a retaliation, the road in. **Do not pass it for what the
 * player does to themselves** — `spec.grants`, a gene's `confers`, a
 * performance's own conditions — because resisting your own doing is backwards.
 *
 * Today the distinction costs nothing either way: every element-bearing
 * condition is an affliction and every self-granted one is elementless, so a
 * grant is unresisted by its own data. ⚠️ **The day a beneficial condition wants
 * an `element` is the day that stops being true**, and the fix is to split the
 * grant sites out rather than to weaken this rule.
 *
 * The one place a grant IS an affliction is spoiled food: `queasy` carries the
 * poison element, and eating a refuse-grade dish or the Scorched Mess grants it.
 * That is something done TO the eater, so `useConsumable` passes the stat block
 * for a harmful condition (and only for one), and poison resistance thins it
 * like a bite's venom. A dish's other grants stay unresisted.
 *
 * `penetration` is the APPLIER's penetration, 0 when the applier is unknown or
 * has none: the player's stat when the player inflicts on a monster, the
 * species' (`monsterPenetration`, monsterStats.ts) when a monster inflicts on
 * the player. It erodes the bearer's resistance in the immunity test only — a
 * condition lands nothing at all once resistance minus penetration reaches 1 —
 * and never thins the dose that lands below it.
 */
export function applyStatus(
  state: GameState,
  bearer: GameState | MonsterInstance,
  app: StatusApplication,
  source?: string,
  stats?: Record<string, number>,
  penetration = 0,
): StatusInstance | null {
  const def = STATUSES[app.id];
  if (!def) return null;
  const resisted = applicationMult(state, bearer, def, stats, penetration);
  if (resisted <= 0) return null;
  return inflict(state, bearer, app, source, resisted);
}

/**
 * A condition BECOMING another one — escalating past its cap, souring in water,
 * or leaving a successor behind when it expires.
 *
 * Never resisted. Resistance answers the incoming dose, and the dose that
 * produced this was already answered when it landed; taxing the transformation
 * too would bill a resistant body twice for one application. Symmetric for both
 * bearers, which is why it is a separate door rather than an omitted argument.
 *
 * Exported for the one transformation that happens outside this module: forced
 * healing swelling an overgrowth into a proliferation (`healEnemy`, combat.ts).
 * Immunity still refuses a transformation (`inflict` checks it), as it should.
 */
export function reform(
  state: GameState,
  bearer: GameState | MonsterInstance,
  app: StatusApplication,
  source?: string,
): StatusInstance | null {
  if (!STATUSES[app.id]) return null;
  return inflict(state, bearer, app, source, 1);
}

function inflict(
  state: GameState,
  bearer: GameState | MonsterInstance,
  app: StatusApplication,
  source: string | undefined,
  resisted: number,
): StatusInstance | null {
  const def = STATUSES[app.id];
  if (!def) return null;
  if (app.chance !== undefined && !chance(state, app.chance)) return null;
  for (const blocker of def.blockedBy ?? []) {
    if (hasStatus(bearer, blocker)) return null;
  }
  if (wearsImmunityTo(bearer, def)) return null;

  // Another condition may make this one land harder — a soaking carries a
  // chill far deeper than dry skin does — and the body's own armour against
  // the element takes its share back off again.
  let intensity = (app.intensity ?? 1) * amplifierFor(bearer, app.id) * resisted;
  // Anything keeping a graft ledger takes note of what else is landing in this
  // body. The seed does not act on what it learns — it just remembers.
  recordGraft(bearer, def.id, intensity);
  const held = findStatus(bearer, app.id);
  const removal = app.removal ?? def.removal;

  if (!held) {
    const fresh: StatusInstance = {
      id: def.id,
      intensity,
      peak: intensity,
      stacks: 1,
      ticksLeft: durationOf(def, app),
      ...(removal ? { removal } : {}),
      ...(source ? { source } : {}),
      data: {},
    };
    list(bearer).push(fresh);
    // Landing can sour what was already there (poison going septic in water).
    convertHeld(state, bearer, def);
    return fresh;
  }

  // Already afflicted: the stacking rule decides what a fresh dose does.
  // The worst single dose is tracked whatever the rule is — see StatusDot.fromPeak.
  held.peak = Math.max(held.peak ?? held.intensity, intensity);
  const stacking = def.stacking;
  switch (stacking.mode) {
    case 'highest':
      // A weaker dose of the same poison teaches the body nothing new.
      if (intensity > held.intensity) {
        held.intensity = intensity;
        held.ticksLeft = durationOf(def, app);
      }
      break;
    case 'absorb':
      // Part of the new flame feeds the old one. The clock is NOT reset —
      // stacking a burn makes it fiercer, not longer.
      held.intensity += intensity * (stacking.absorb ?? 1);
      held.stacks += 1;
      break;
    case 'sum':
      held.intensity += intensity;
      held.stacks += 1;
      held.ticksLeft = durationOf(def, app);
      break;
    case 'count':
      held.stacks += 1;
      held.intensity += intensity;
      held.ticksLeft = durationOf(def, app);
      break;
    case 'extend': {
      // Longer, not worse: the clock adds, the magnitude does not.
      const added = durationOf(def, app);
      if (added !== null) held.ticksLeft = (held.ticksLeft ?? 0) + added;
      held.stacks += 1;
      break;
    }
  }

  if (stacking.refreshDuration) held.ticksLeft = durationOf(def, app);

  // Pushed past its ceiling, a condition either clamps or gives way to
  // something worse (a chill that reaches 100% is no longer a chill).
  const cap = capOverrideFor(bearer, def.id) ?? stacking.cap;
  if (cap !== undefined) {
    const byStacks = stacking.mode === 'count' || stacking.mode === 'extend';
    const measure = byStacks ? held.stacks : held.intensity;
    const turns = stacking.onCap === 'escalate' && !!def.escalatesTo;
    const clamp = () => {
      if (measure < cap) return;
      if (byStacks) held.stacks = cap;
      else held.intensity = cap;
    };
    // A charge that MIGHT go off: past the threshold every dose rolls, and the
    // odds ride the charge itself, so escalation is felt coming and never
    // scheduled. A cap override (a soaking halves jolted's) tightens the whole
    // curve, not just its end, because it is the denominator.
    if (turns && stacking.escalateFrom !== undefined && measure > stacking.escalateFrom) {
      const span = Math.max(cap - stacking.escalateFrom, 1e-9);
      if (chance(state, Math.min(1, (measure - stacking.escalateFrom) / span))) {
        return escalate(state, bearer, held, source);
      }
      clamp();
      return held;
    }
    if (measure >= cap) {
      if (turns) return escalate(state, bearer, held, source);
      clamp();
    }
  }
  return held;
}

/** Apply a whole list of applications (a monster's bite, a rune's rider). */
export function applyStatuses(
  state: GameState,
  bearer: GameState | MonsterInstance,
  apps: StatusApplication[] | undefined,
  source?: string,
  stats?: Record<string, number>,
  penetration = 0,
): StatusInstance[] {
  const landed: StatusInstance[] = [];
  for (const app of apps ?? []) {
    const inst = applyStatus(state, bearer, app, source, stats, penetration);
    if (inst) landed.push(inst);
  }
  return landed;
}

/** How much harder something else the bearer holds makes `id` land. */
function amplifierFor(bearer: GameState | MonsterInstance, id: string): number {
  let mult = 1;
  for (const other of statusesOf(bearer)) {
    for (const amp of STATUSES[other.id]?.amplifies ?? []) {
      if (amp.id === id) mult *= amp.mult;
    }
  }
  return mult;
}

/** An escalation threshold something else the bearer holds has changed. */
function capOverrideFor(bearer: GameState | MonsterInstance, id: string): number | undefined {
  for (const other of statusesOf(bearer)) {
    for (const o of STATUSES[other.id]?.capOverrides ?? []) {
      if (o.id === id) return o.cap;
    }
  }
  return undefined;
}

/** Transmute what the bearer already holds, at the moment `def` lands. */
function convertHeld(
  state: GameState,
  bearer: GameState | MonsterInstance,
  def: StatusDef,
): void {
  for (const rule of def.converts ?? []) {
    const from = findStatus(bearer, rule.from);
    if (!from) continue;
    removeStatus(bearer, rule.from);
    reform(state, bearer, { id: rule.to, intensity: from.intensity * rule.ratio }, from.source);
  }
}

/**
 * Whether the next application of this condition, however slight, could give
 * way to the worse thing behind it.
 *
 * A capped condition looks stable from the outside (poison ×4 ticking along
 * exactly as before), which is precisely why it needs saying out loud: it is
 * a false equilibrium, one dose from turning. Escalation deliberately never
 * happens on a FIRST application — see applyStatus — so this is the only
 * warning there is.
 *
 * Under `escalateFrom` the warning starts EARLIER and means something weaker —
 * "this may turn" rather than "this turns". That is the correct trade: a
 * chance-based escalation the player only hears about at the cap would be a
 * surprise every time, and the whole point of rolling is that it is felt
 * coming. Ask `escalationChance` for how close it actually is.
 */
export function escalationPrimed(
  bearer: GameState | MonsterInstance,
  held: StatusInstance,
): boolean {
  return escalationChance(bearer, held) > 0;
}

/**
 * How likely the next application is to turn this condition — 0 when it cannot,
 * 1 when it certainly will. The readout's number, and the single seam that
 * knows the curve, so nothing can drift from what `applyStatus` actually rolls.
 */
export function escalationChance(
  bearer: GameState | MonsterInstance,
  held: StatusInstance,
): number {
  const def = STATUSES[held.id];
  if (!def?.escalatesTo || def.stacking.onCap !== 'escalate') return 0;
  const cap = capOverrideFor(bearer, def.id) ?? def.stacking.cap;
  if (cap === undefined) return 0;
  const byStacks = def.stacking.mode === 'count' || def.stacking.mode === 'extend';
  const measure = byStacks ? held.stacks : held.intensity;
  const from = def.stacking.escalateFrom;
  if (from === undefined) return measure >= cap ? 1 : 0;
  if (measure <= from) return 0;
  return Math.min(1, (measure - from) / Math.max(cap - from, 1e-9));
}

/** Replace a condition with the worse one it escalates into. */
function escalate(
  state: GameState,
  bearer: GameState | MonsterInstance,
  held: StatusInstance,
  source?: string,
): StatusInstance | null {
  const def = STATUSES[held.id];
  if (!def?.escalatesTo) return held;
  removeStatus(bearer, held.id);
  const next = reform(
    state,
    bearer,
    { id: def.escalatesTo, intensity: held.intensity * (def.stacking.escalateMult ?? 1) },
    source,
  );
  if (next) {
    next.peak = Math.max(next.peak, held.peak ?? held.intensity);
    // The successor inherits the bookkeeping. A seed that matures must carry
    // its graft ledger across, or maturing would throw away the whole point of
    // having been patient.
    next.data = { ...held.data, ...next.data };
  }
  return next;
}

export function removeStatus(bearer: GameState | MonsterInstance, id: string): void {
  const arr = statusesOf(bearer);
  const i = arr.findIndex((s) => s.id === id);
  if (i >= 0) arr.splice(i, 1);
}

export function clearStatuses(bearer: GameState | MonsterInstance): void {
  if (bearer.statuses) bearer.statuses.length = 0;
}

// ---------- Removal events ----------

/**
 * Tell the conditions that something happened to their bearer. Each one checks
 * the rules it is actually holding (its source's, or its definition's) and
 * resolves however those rules say: gone, knocked back down to its milder form,
 * or merely weakened.
 *
 * Returns the ids that changed, so the caller can say so in the log.
 */
export function fireStatusEvent(
  state: GameState,
  bearer: GameState | MonsterInstance,
  event: StatusRemoval['on'],
  detail?: { healKind?: string; tag?: string; damageType?: DamageType; amount?: number },
): string[] {
  const changed: string[] = [];
  for (const held of [...statusesOf(bearer)]) {
    const def = STATUSES[held.id];
    if (!def) continue;
    const rules = held.removal ?? def.removal ?? [];
    for (const rule of rules) {
      if (rule.on !== event) continue;
      if (rule.healKinds && !rule.healKinds.includes(detail?.healKind ?? '')) continue;
      if (rule.tag && rule.tag !== detail?.tag) continue;
      if (rule.damageTypes && !rule.damageTypes.includes(detail?.damageType as never)) continue;
      // Some things take more than one of whatever this is. Progress is kept
      // on the instance so it survives between fights.
      if (rule.after && rule.after > 1) {
        held.data = held.data ?? {};
        const key = `charge:${rule.on}`;
        const seen = (held.data[key] ?? 0) + 1;
        held.data[key] = seen;
        if (seen < rule.after) break;
        held.data[key] = 0;
      }
      // ...and the same again by MAGNITUDE, for the things that should answer
      // to how hard they were hit rather than how often. Kept separate from
      // `after` so a rule may ask for both — three hits AND enough of them.
      if (rule.afterDamage) {
        held.data = held.data ?? {};
        const key = `soak:${rule.on}`;
        const soaked = (held.data[key] ?? 0) + Math.max(0, detail?.amount ?? 0);
        held.data[key] = soaked;
        if (soaked < rule.afterDamage) break;
        held.data[key] = 0;
      }

      switch (rule.effect ?? 'remove') {
        case 'remove':
          removeStatus(bearer, held.id);
          // ...and what stands in its place, if the rule names a successor.
          // Applied AFTER the removal so a pair that blocks each other (a body
          // that cannot be knitting and doused at once) resolves cleanly.
          if (rule.becomes) {
            reform(state, bearer, { id: rule.becomes, intensity: held.intensity }, held.source);
          }
          break;
        case 'deescalate': {
          removeStatus(bearer, held.id);
          if (def.baseForm) {
            reform(state, bearer, { id: def.baseForm, intensity: held.intensity }, held.source);
          }
          break;
        }
        case 'reduce': {
          held.intensity *= 1 - (rule.amount ?? 0.5);
          if (held.intensity <= 0.01) removeStatus(bearer, held.id);
          break;
        }
        case 'unstack': {
          // One instance resolved, the rest still pending.
          const per = held.stacks > 0 ? held.intensity / held.stacks : held.intensity;
          held.stacks -= 1;
          held.intensity = Math.max(0, held.intensity - per);
          if (held.stacks <= 0) removeStatus(bearer, held.id);
          break;
        }
      }
      changed.push(held.id);
      break; // one rule per condition per event
    }
  }
  return changed;
}

// ---------- Contributions to the rest of the game ----------

const STATUS_ORIGIN: ModOrigin = { kind: 'status' };

/**
 * The intensity a condition is actually biting with right now. Usually just
 * what it holds — but a condition that fades as its clock runs down is weaker
 * at the end than it was at the start.
 */
export function effectiveIntensity(held: StatusInstance): number {
  const def = STATUSES[held.id];
  if (!def?.decayWithDuration || held.ticksLeft === null) return held.intensity;
  const full = def.duration ?? held.ticksLeft;
  if (!full) return held.intensity;
  return held.intensity * Math.max(0, Math.min(1, held.ticksLeft / full));
}

/** Stat modifiers from every held condition, scaled by intensity. */
export function statusMods(
  bearer: GameState | MonsterInstance,
): { mod: Modifier; source: string; origin: ModOrigin }[] {
  const out: { mod: Modifier; source: string; origin: ModOrigin }[] = [];
  for (const held of statusesOf(bearer)) {
    const def = STATUSES[held.id];
    const power = effectiveIntensity(held);
    for (const mod of def?.mods ?? []) {
      out.push({
        mod: { ...mod, value: mod.value * power },
        source: def!.name,
        origin: STATUS_ORIGIN,
      });
    }
  }
  return out;
}

/**
 * Resistances a condition dictates outright, rather than nudging. Returns the
 * absolute values to force, already resolved against what the bearer had.
 */
export function statusResOverrides(
  bearer: GameState | MonsterInstance,
  current: (type: DamageType) => number,
): Partial<Record<DamageType, number>> {
  const out: Partial<Record<DamageType, number>> = {};
  for (const held of statusesOf(bearer)) {
    const overrides = STATUSES[held.id]?.overrideRes;
    if (!overrides) continue;
    for (const [type, spec] of Object.entries(overrides) as [DamageType, { to: number; bonusIfMet?: number }][]) {
      const now = out[type] ?? current(type);
      // `bonusIfMet` is what makes an override generous: with it, someone
      // already past the number is topped up instead of dragged down to it.
      // Without it the condition simply dictates the value — which is the
      // whole point of a penalty, and 0 must not read as "already better
      // than -50%".
      out[type] =
        spec.bonusIfMet !== undefined && now >= spec.to ? now + spec.bonusIfMet : spec.to;
    }
  }
  return out;
}

/**
 * The deepest this bearer's conditions may push a resistance. Stacks widen the
 * hole without each one having to hurt more.
 */
export function statusResFloor(bearer: GameState | MonsterInstance): number | undefined {
  let floor: number | undefined;
  for (const held of statusesOf(bearer)) {
    const spec = STATUSES[held.id]?.resFloor;
    if (!spec) continue;
    const own = spec.base - spec.perStack * Math.max(0, held.stacks - 1);
    floor = floor === undefined ? own : Math.min(floor, own);
  }
  return floor;
}

/**
 * How much of a pool the bearer's conditions have sealed off, as a multiplier
 * on its true maximum. Several wounds compound rather than overwrite.
 */
export function statusCeiling(bearer: GameState | MonsterInstance, resource: ResourceId): number {
  let mult = 1;
  for (const held of statusesOf(bearer)) {
    const def = STATUSES[held.id];
    for (const c of def?.ceilings ?? []) {
      if (c.resource !== resource) continue;
      mult *= 1 - Math.min(c.max ?? 1, c.per * effectiveIntensity(held));
    }
    // Debt this condition ate out of the pool as it was being spent — and that
    // a recovery condition inherited from it, still owed until it decays away.
    // `debtPool` travels with the debt so the successor knows which pool it is
    // holding down without needing the config that created it.
    const debt = held.data?.debt ?? 0;
    if (debt > 0 && (held.debtPool ?? def?.ceilingFromSpend?.resource) === resource) {
      mult *= 1 - Math.min(0.95, debt);
    }
  }
  return Math.max(0, mult);
}

/**
 * Tell any condition that eats what you spend that you have just spent some.
 * Rot takes a share of every effort and does not give it straight back, so the
 * debt is stored as a share of the pool's TRUE max and outlives the rot itself.
 */
export function noteResourceSpent(
  bearer: GameState | MonsterInstance,
  resource: ResourceId,
  spent: number,
  trueMax: number,
): void {
  if (spent <= 0 || trueMax <= 0) return;
  for (const held of statusesOf(bearer)) {
    const spec = STATUSES[held.id]?.ceilingFromSpend;
    if (!spec || spec.resource !== resource) continue;
    held.data = held.data ?? {};
    held.data.debt = Math.min(spec.max ?? 1, (held.data.debt ?? 0) + (spent * spec.share) / trueMax);
    held.debtPool = spec.resource;
  }
}

/**
 * How much a condition dulls a modifier that came from `origin`. Returns the
 * share to KEEP, so 1 means untouched.
 */
export function statusDampingFor(
  bearer: GameState | MonsterInstance,
  origin?: ModOrigin,
  stat?: ModTarget,
): number {
  if (!origin) return 1;
  let keep = 1;
  for (const held of statusesOf(bearer)) {
    const damp = STATUSES[held.id]?.damp;
    if (!damp) continue;
    if (damp.kinds && !damp.kinds.includes(origin.kind)) continue;
    if (damp.stats && (stat === undefined || !damp.stats.includes(stat))) continue;
    if (damp.slot && damp.slot !== origin.slot) continue;
    keep *= 1 - Math.min(damp.max ?? 1, damp.per * effectiveIntensity(held));
  }
  return Math.max(0, keep);
}

/** Whether any held condition dulls modifiers at all (cheap early-out). */
export function hasDamping(bearer: GameState | MonsterInstance): boolean {
  return statusesOf(bearer).some((s) => STATUSES[s.id]?.damp);
}

/**
 * The most healing the bearer's conditions will currently allow. A blaze lets
 * you undo only a share of what it has burned, and remembers what it has
 * already let through. `Infinity` when nothing is capping.
 */
export function healAllowance(bearer: GameState | MonsterInstance): number {
  let allowance = Infinity;
  for (const held of statusesOf(bearer)) {
    const cap = STATUSES[held.id]?.healCap;
    if (cap === undefined) continue;
    const dealt = held.data?.dealt ?? 0;
    const already = held.data?.healed ?? 0;
    allowance = Math.min(allowance, Math.max(0, dealt * cap - already));
  }
  return allowance;
}

/** Record healing against every condition that is rationing it. */
export function noteHealed(bearer: GameState | MonsterInstance, amount: number): void {
  for (const held of statusesOf(bearer)) {
    if (STATUSES[held.id]?.healCap === undefined) continue;
    held.data = held.data ?? {};
    held.data.healed = (held.data.healed ?? 0) + amount;
  }
}

/**
 * Every stack of hunger standing on the field, both sides counted.
 *
 * STACKS and not intensity: the defence arm is paid for how many appetites are
 * loose in the fight, not for how hard each one bites. Those are two different
 * numbers on purpose (see `hunger_anupama`), and this is the one that reads as
 * "how much hunger is there".
 *
 * Lives here rather than in combat.ts so that `modFingerprint` can reach it
 * without derived.ts learning about fights.
 */
export function fieldHunger(state: GameState): number {
  let total = findStatus(state, 'hunger_anupama')?.stacks ?? 0;
  for (const e of state.combat?.enemies ?? []) {
    if (e) total += findStatus(e, 'hunger_anupama')?.stacks ?? 0;
  }
  return total;
}

/**
 * The bucket `fieldHunger` is fingerprinted as.
 *
 * The defence arm is logarithmic, so quantizing the log rather than the count
 * costs nothing real and keeps the derived-stats memo alive: enemy hunger moves
 * on every action any of them takes, and fingerprinting the raw total would
 * recompute the player's whole stat block nearly every tick of every fight.
 *
 * Same rule the weather work settled on — fingerprint the bucket, not the float.
 */
export function fieldHungerBucket(state: GameState): number {
  return Math.round(Math.log(1 + fieldHunger(state)) * 4);
}

// ---------- Behavioural gates ----------

/** Whether any held condition forbids an action outright. */
export function statusBlocks(
  bearer: GameState | MonsterInstance,
  action: 'spell' | 'attack' | 'swing',
): boolean {
  return statusesOf(bearer).some((s) => STATUSES[s.id]?.blocks?.includes(action));
}

/**
 * Multiplier on damage ARRIVING at the bearer, from held conditions with an
 * `incomingBite`. Compounds across conditions. Whether a blow spends the
 * condition is the removal rules' business, not this reader's.
 */
export function statusIncomingDamageMult(bearer: GameState | MonsterInstance): number {
  let mult = 1;
  for (const held of statusesOf(bearer)) {
    const per = STATUSES[held.id]?.incomingBite;
    if (per) mult *= 1 + per * effectiveIntensity(held);
  }
  return mult;
}

/** Combined chance the bearer's attack simply misses. Compounds, never certain. */
export function statusMissChance(bearer: GameState | MonsterInstance): number {
  let hit = 1;
  for (const held of statusesOf(bearer)) {
    const per = STATUSES[held.id]?.missChance;
    if (per) hit *= 1 - Math.min(0.95, per * effectiveIntensity(held));
  }
  return 1 - hit;
}

/** Whether a held blessing turns this condition's dot into healing. */
function dotInverted(bearer: GameState | MonsterInstance, id: string): boolean {
  return statusesOf(bearer).some((s) => STATUSES[s.id]?.invertsDots?.includes(id));
}

/** Whether a held wall stops a RANGED blow of the given type outright. */
export function statusBlocksRangedType(
  bearer: GameState | MonsterInstance,
  type: DamageType,
): boolean {
  return statusesOf(bearer).some((s) => {
    const wall = STATUSES[s.id]?.blocksRanged;
    return wall && !(wall.except ?? []).includes(type);
  });
}

// ---------- Magnetism (what a bearer's iron does to blows aimed at it) ----------

/**
 * Whether a blow of `type` bypasses the bearer's evasion outright — either
 * because the pull has closed entirely, because this element cannot miss a
 * magnetized target, or because the roll went that way.
 */
export function magnetBypassesDodge(
  state: GameState,
  bearer: GameState | MonsterInstance,
  type: DamageType,
): boolean {
  for (const held of statusesOf(bearer)) {
    const m = STATUSES[held.id]?.magnetism;
    if (!m) continue;
    if (m.nullifyDodge) return true;
    if (m.alwaysHit?.includes(type)) return true;
    if (m.dodgeIgnore && chance(state, Math.min(0.95, m.dodgeIgnore * effectiveIntensity(held)))) {
      return true;
    }
  }
  return false;
}

/** Extra crit chance a blow of `type` gets against this bearer's iron. */
export function magnetCritChance(bearer: GameState | MonsterInstance, type: DamageType): number {
  let bonus = 0;
  for (const held of statusesOf(bearer)) {
    const m = STATUSES[held.id]?.magnetism;
    if (m?.critChancePer && m.critTypes?.includes(type)) {
      bonus += m.critChancePer * effectiveIntensity(held);
    }
  }
  return bonus;
}

/**
 * Spend whatever charge the bearer's lock was holding: returns the extra
 * crit damage it discharges, and consumes the condition that held it. Called
 * only when a blow has actually critted.
 */
export function consumeMagnetCharge(bearer: GameState | MonsterInstance): number {
  for (const held of [...statusesOf(bearer)]) {
    const per = STATUSES[held.id]?.magnetism?.critDamagePerStack;
    if (!per) continue;
    const bonus = per * Math.max(1, held.stacks);
    removeStatus(bearer, held.id);
    return bonus;
  }
  return 0;
}

/** A duel's terms are in force: enemies off the front slot cannot act. */
// ---------- Wind: displacement ----------

/**
 * Where the wind actually leaves them, if it has taken this exchange. Returns
 * undefined when nothing is displacing them — the technique's own `to` stands.
 *
 * Rolled once per exchange by the caller, at the one place position moves.
 * Legal under MARTIAL.md §9: this rewrites a single node's exit, which is
 * named there as a sanctioned rewrite. It never writes an edge list, and the
 * guardrail on `displaces.to` (dead ends only) is what keeps it that way.
 */
export function statusDisplacedExit(
  state: GameState,
  bearer: GameState | MonsterInstance,
): string | undefined {
  for (const held of statusesOf(bearer)) {
    const cfg = STATUSES[held.id]?.displaces;
    if (!cfg) continue;
    if (cfg.always) return cfg.to;
    const p = (cfg.chancePer ?? 0) * effectiveIntensity(held);
    if (p > 0 && chance(state, Math.min(1, p))) return cfg.to;
  }
  return undefined;
}

// ---------- Wood: tending, grafts and the harvest ----------

const GRAFT_PREFIX = 'graft:';

/**
 * Note a condition into every graft ledger this bearer is carrying. Called as
 * things land, so the ledger is a record of what the body went through while
 * the seed was in it.
 */
function recordGraft(bearer: GameState | MonsterInstance, id: string, intensity: number): void {
  for (const held of statusesOf(bearer)) {
    const cfg = STATUSES[held.id]?.grafts;
    if (!cfg) continue;
    if (held.id === id) continue;
    if (cfg.except?.includes(id)) continue;
    held.data = held.data ?? {};
    const key = `${GRAFT_PREFIX}${id}`;
    const next = (held.data[key] ?? 0) + intensity;
    held.data[key] = cfg.cap !== undefined ? Math.min(cfg.cap, next) : next;
  }
}

/** What one graft-keeping condition has learned, as applications. */
export function graftLedger(held: StatusInstance): { id: string; intensity: number }[] {
  const out: { id: string; intensity: number }[] = [];
  for (const [key, value] of Object.entries(held.data ?? {})) {
    if (!key.startsWith(GRAFT_PREFIX) || value <= 0) continue;
    out.push({ id: key.slice(GRAFT_PREFIX.length), intensity: value });
  }
  return out;
}

/**
 * A blow has landed on someone carrying a tended condition. Water feeds it,
 * metal cuts it, everything else prunes it a little. Called wherever
 * `damageTaken` is announced, so what prunes a seed and what fires a removal
 * rule are the same set of blows.
 */
export function tendOnDamage(bearer: GameState | MonsterInstance, type: DamageType): void {
  for (const held of [...statusesOf(bearer)]) {
    const cfg = STATUSES[held.id]?.tends;
    if (!cfg) continue;
    if (cfg.fedBy?.includes(type)) {
      held.intensity += cfg.feedPerHit ?? 0;
      continue;
    }
    const cut = (cfg.prunePerHit ?? 0) * (cfg.prunedBy?.includes(type) ? 2 : 1);
    if (cut <= 0) continue;
    held.intensity -= cut;
    if (held.intensity <= 0.01) removeStatus(bearer, held.id);
  }
}

/**
 * What burning it off pays. Fire ends a seeded body's condition (its removal
 * rule), and the ledger it had accumulated comes back as heat — wood feeding
 * fire, at the combat layer. Read BEFORE the removal event fires, since after
 * it there is nothing left to harvest.
 */
export function graftHarvest(
  bearer: GameState | MonsterInstance,
  type: DamageType,
): { id: string; name: string; icon: string; type: DamageType; amount: number }[] {
  const out: { id: string; name: string; icon: string; type: DamageType; amount: number }[] = [];
  for (const held of statusesOf(bearer)) {
    const def = STATUSES[held.id];
    const harvest = def?.grafts?.harvest;
    if (!def || !harvest || !harvest.on.includes(type)) continue;
    const total = graftLedger(held).reduce((sum, g) => sum + g.intensity, 0);
    if (total <= 0) continue;
    out.push({
      id: def.id,
      name: def.name,
      icon: def.icon,
      type: harvest.type,
      amount: total * harvest.perIntensity,
    });
  }
  return out;
}

/**
 * The conditions a matured root network is ready to carry to everything else
 * in the fight this tick, or null if it is not due. The caller owns the enemy
 * list, so distribution belongs there (the same division of labour a surplus
 * detonation already uses).
 */
export function dueGraftSpread(
  state: GameState,
  bearer: GameState | MonsterInstance,
): { id: string; intensity: number }[] | null {
  for (const held of statusesOf(bearer)) {
    const cfg = STATUSES[held.id]?.grafts;
    if (!cfg?.spreadShare || !cfg.spreadEvery) continue;
    held.data = held.data ?? {};
    const next = (held.data.spreadAt ?? 0) - 1;
    if (next > 0) {
      held.data.spreadAt = next;
      continue;
    }
    held.data.spreadAt = cfg.spreadEvery;
    const carried = graftLedger(held)
      .map((g) => ({ id: g.id, intensity: g.intensity * cfg.spreadShare! }))
      .filter((g) => g.intensity > 0.01);
    if (carried.length) return carried;
  }
  return null;
}

export function statusPacifiesFlankers(bearer: GameState | MonsterInstance): boolean {
  return statusesOf(bearer).some((s) => STATUSES[s.id]?.pacifiesFlankers);
}

/**
 * Chance an enemy blow on the bearer misses outright, rolled AFTER dodge —
 * a shroud on top of footwork. Compounds like miss chance: layered shrouds
 * never add up to certainty.
 */
export function statusIncomingMissChance(bearer: GameState | MonsterInstance): number {
  let hit = 1;
  for (const held of statusesOf(bearer)) {
    const per = STATUSES[held.id]?.incomingMissChance;
    if (per) hit *= 1 - Math.min(0.9, per * effectiveIntensity(held));
  }
  return 1 - hit;
}

/**
 * Intensify matching conditions ×mult and wind their clocks back up
 * (Redouble Venom). Deliberately bypasses stacking caps — that is the
 * miracle's whole privilege. Returns how many conditions were touched.
 */
export function amplifyStatuses(
  bearer: GameState | MonsterInstance,
  ids: string[],
  mult: number,
): number {
  let touched = 0;
  for (const held of statusesOf(bearer)) {
    if (!ids.includes(held.id)) continue;
    held.intensity *= mult;
    held.peak = Math.max(held.peak ?? 0, held.intensity);
    const full = STATUSES[held.id]?.duration;
    if (held.ticksLeft !== null && full) held.ticksLeft = full;
    touched++;
  }
  return touched;
}

/**
 * Remove matching conditions outright, returning what was taken so the
 * caller can send it somewhere else (Venom Feast strips the caster's poison
 * and delivers it). Not a cure — nothing fires, nothing de-escalates.
 */
export function stripStatuses(
  bearer: GameState | MonsterInstance,
  ids: string[],
): { id: string; intensity: number }[] {
  const list = statusesOf(bearer);
  const taken: { id: string; intensity: number }[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (!ids.includes(list[i].id)) continue;
    taken.push({ id: list[i].id, intensity: list[i].intensity });
    list.splice(i, 1);
  }
  return taken;
}

/** A pool held conditions have stopped recovering. */
export function statusBlocksRegen(bearer: GameState | MonsterInstance, id: ResourceId): boolean {
  return statusesOf(bearer).some((s) => STATUSES[s.id]?.blocksRegen?.includes(id));
}

/** The condition currently dictating the bearer's stance, if any. */
export function statusForcingStyle(
  bearer: GameState | MonsterInstance,
): { def: StatusDef; style: string } | undefined {
  for (const held of statusesOf(bearer)) {
    const def = STATUSES[held.id];
    if (def?.forceStyle) return { def, style: def.forceStyle };
  }
  return undefined;
}

/** The style a condition is forcing on the bearer, if any. */
export function statusForcedStyle(bearer: GameState | MonsterInstance): string | undefined {
  return statusForcingStyle(bearer)?.style;
}

/** Multiplier on what spending a pool costs. 1 when nothing is making it worse. */
export function statusCostMult(bearer: GameState | MonsterInstance, id: ResourceId): number {
  let mult = 1;
  for (const held of statusesOf(bearer)) {
    const spec = STATUSES[held.id]?.costMult;
    if (spec?.resource !== id) continue;
    mult *= 1 + Math.min(spec.max ?? Infinity, spec.per * held.intensity);
  }
  return mult;
}

/** True while the bearer cannot see well enough to pick their shot. */
export function statusDisadvantage(bearer: GameState | MonsterInstance): boolean {
  return statusesOf(bearer).some((s) => STATUSES[s.id]?.disadvantage);
}

/**
 * How far past zero a pool may currently be driven, as an absolute amount.
 * Zero when nothing is letting the bearer run a debt.
 */
export function statusNegativeHeadroom(
  bearer: GameState | MonsterInstance,
  id: ResourceId,
  trueMax: number,
): number {
  let room = 0;
  for (const held of statusesOf(bearer)) {
    const spec = STATUSES[held.id]?.negativeHeadroom;
    if (spec?.resource !== id) continue;
    room = Math.max(room, trueMax * (spec.base + spec.perStack * Math.max(0, held.stacks - 1)));
  }
  return room;
}

/** True while a condition is dragging the bearer's action bar backwards. */
export function statusReversesBar(bearer: GameState | MonsterInstance): boolean {
  return statusesOf(bearer).some((s) => STATUSES[s.id]?.bar?.reverse);
}

/**
 * Spend one queued skipped action, if any condition is holding one. Returns
 * true when the bearer loses this action — a daze costs one per instance.
 */
export function consumeSkippedAction(bearer: GameState | MonsterInstance): boolean {
  for (const held of statusesOf(bearer)) {
    if (!STATUSES[held.id]?.bar?.skip) continue;
    return true;
  }
  return false;
}

export interface BarDamage {
  type: DamageType;
  amount: number;
  id: string;
  name: string;
  icon: string;
  /** The bearer drops what they are holding under this share of health. */
  dropWeaponBelow?: number;
}

/** Damage owed by held conditions when the bar fills or bottoms out. */
export function statusBarDamage(
  bearer: GameState | MonsterInstance,
  when: 'onFill' | 'onDeplete',
): BarDamage[] {
  const out: BarDamage[] = [];
  for (const held of statusesOf(bearer)) {
    const def = STATUSES[held.id];
    const spec = def?.bar?.[when];
    if (!spec) continue;
    out.push({
      type: spec.type,
      amount: spec.flat * held.intensity,
      id: def!.id,
      name: def!.name,
      icon: def!.icon,
      dropWeaponBelow: def!.dropWeaponBelow,
    });
    held.data = held.data ?? {};
    held.data.dealt = (held.data.dealt ?? 0) + spec.flat * held.intensity;
  }
  return out;
}

/** What the bearer's conditions strike back with, and what that costs them. */
export function statusRetaliation(
  bearer: GameState | MonsterInstance,
  when: 'onAttack' | 'onContact',
): { type: DamageType; amount: number; name: string; icon: string; inflicts?: StatusApplication[] }[] {
  const out = [];
  for (const held of statusesOf(bearer)) {
    const def = STATUSES[held.id];
    const spec = def?.retaliate;
    if (!spec || !spec[when]) continue;
    out.push({
      type: spec.type,
      amount: spec.flat * held.intensity,
      name: def!.name,
      icon: def!.icon,
      inflicts: spec.inflicts,
    });
  }
  return out;
}

// ---------- Ticking ----------

export interface StatusTickResult {
  /** Damage to apply, already reduced by the bearer's resistances. */
  damage: number;
  /** One entry per condition that dealt something, for the fight feed. */
  hits: { id: string; name: string; icon: string; type: DamageType; amount: number }[];
  /** Conditions that ran out this tick. */
  expired: string[];
  /** Pools to draw down, possibly into debt (see negativeHeadroom). */
  drains: { resource: ResourceId; amount: number; id: string }[];
  /**
   * Pools to give back — a dish feeding you over its duration. Reported rather
   * than applied for the same reason damage is: this module cannot reach the
   * resource or health systems without a cycle.
   */
  restores: { resource: ResourceId; amount: number; id: string; name: string; icon: string }[];
  /**
   * Conditions whose debt has bottomed out and gone off. The damage is raw —
   * the caller applies it, honouring `bypassRes`.
   */
  detonations: {
    id: string;
    name: string;
    icon: string;
    type: DamageType;
    amount: number;
    bypassRes: number;
  }[];
  /** The bearer was brought down by a condition emptying a pool entirely. */
  fatal?: { id: string; name: string; icon: string; retains: number };
}

/**
 * The sliver of a surplus ledger not worth tracking. ABSOLUTE, deliberately:
 * a ledger is measured in the same units whatever it is riding, so scaling
 * this by the bearer's max health would make a few hundred points of forced
 * life "negligible" on something enormous and throw the swelling away the
 * instant it appeared. What the ledger means relative to the body is the
 * THRESHOLDS' business (escalateAt/detonateAt); getting rid of it is not.
 */
export const SURPLUS_FLOOR = 1;

/** Ticks per second, for conditions whose data is authored in seconds. */
const TICKS_PER_SECOND = 10;

/** What tickStatuses needs to know about a pool to drain or detonate it. */
export interface PoolSnapshot {
  current: number;
  trueMax: number;
}

/**
 * Fractional resistance the bearer has against a damage type.
 *
 * The player's block is passed in (this module cannot reach derived.ts); the
 * caller builds it with `resistBlock`, which stacks the type's resistance with
 * `resElemental` and holds it at the body's cap, as a blow of that type would
 * be. A monster's is the damage path's own figure for it
 * (`setMonsterDamageResistanceReader`): its tags' innate value, its conditions'
 * mods, overrides, floors and `resElemental` — deliberately NOT a raw def
 * lookup, so a chill that makes something brittle also makes the burn on it bite
 * harder, and a stone-tagged body sheds a bleed's ticks for the reason it sheds
 * a blade.
 */
function bearerResistance(
  bearer: GameState | MonsterInstance,
  type: DamageType,
  playerRes?: number,
): number {
  if (playerRes !== undefined) return playerRes;
  if (monsterDamageResistanceReader && isMonsterBearer(bearer)) {
    return monsterDamageResistanceReader(bearer, type);
  }
  return Math.max(-1, Math.min(0.9, monsterResistanceUncapped(bearer, type)));
}

/**
 * A monster's resistance before the [-1, 0.9] clamp, in the narrow reading: the
 * species' DECLARED value plus what its conditions add. It does not see tag-
 * derived innate resistance, overrides, floors or `resElemental`, which is why
 * neither application nor damage ticks use it any more (see
 * `setMonsterResistanceReader` and `setMonsterDamageResistanceReader`). It is
 * only the fallback while the full pipeline is not registered (a tool that never
 * loads `monsterStats.ts`), and what a bearer with no stat block of its own
 * reads.
 */
function monsterResistanceUncapped(bearer: GameState | MonsterInstance, type: DamageType): number {
  const inst = bearer as MonsterInstance;
  let res = MONSTERS[inst.defId]?.resistances?.[type] ?? 0;
  for (const held of statusesOf(bearer)) {
    for (const mod of STATUSES[held.id]?.mods ?? []) {
      if (mod.stat !== RES_STAT_BY_TYPE[type]) continue;
      const value = mod.value * held.intensity;
      res = mod.op === 'add' ? res + value : res * (1 + value);
    }
  }
  return res;
}

/**
 * Advance every condition on a bearer by one tick: deal its damage, run its
 * clock down, and hand anything that expired to whatever it becomes next.
 *
 * `hp`/`maxHp` are the bearer's current and maximum health, since a bleed is
 * priced off one and a laceration off the other. `resists` is the player's
 * resistance block; monsters are looked up from their def instead.
 */
export function tickStatuses(
  state: GameState,
  bearer: GameState | MonsterInstance,
  ctx: {
    hp: number;
    maxHp: number;
    inCombat: boolean;
    resists?: Record<DamageType, number>;
    /** Live pool readings, for conditions that drain or run a debt. */
    pools?: Partial<Record<ResourceId, PoolSnapshot>>;
    /**
     * Ticks the clocks advance per tick. Above 1 while the bearer is out cold:
     * being knocked unconscious is time passing, and a fever that would have
     * run 45 seconds does not politely wait for you to sit up before starting.
     * Clocks only — the damage stays at its per-tick rate, so what this buys is
     * a shorter affliction rather than a concentrated one.
     */
    clockRate?: number;
    /**
     * Share of condition DAMAGE the bearer sheds, 0–1. A fast's defence arm is
     * the only source today (see `fastGuard`).
     *
     * Passed in rather than read here on purpose: what supplies it lives in
     * mutagens.ts, which already reads this file, and a condition system that
     * imported the gene system to find out how hard a wound bites would be the
     * wrong way round. The caller knows; this only applies.
     */
    ward?: number;
  },
): StatusTickResult {
  const result: StatusTickResult = {
    damage: 0,
    hits: [],
    expired: [],
    drains: [],
    restores: [],
    detonations: [],
  };
  if (statusesOf(bearer).length === 0) return result;

  for (const held of [...statusesOf(bearer)]) {
    const def = STATUSES[held.id];
    if (!def) continue;

    const dot = def.dot;
    if (dot) {
      // Parts named in `fromPeak` are set by the deepest single wound; the rest
      // scale with the accumulated total.
      const peak = held.peak ?? held.intensity;
      const scale = (part: 'flat' | 'currentHp' | 'maxHp') =>
        dot.fromPeak?.includes(part) ? peak : held.intensity;
      let raw =
        (dot.flat ?? 0) * scale('flat') +
        (dot.currentHp ?? 0) * scale('currentHp') * ctx.hp +
        (dot.maxHp ?? 0) * scale('maxHp') * ctx.maxHp;
      // A wound left alone bleeds gentler than one being reopened every swing.
      if (!ctx.inCombat && dot.outOfCombat !== undefined) raw *= dot.outOfCombat;
      if (raw > 0) {
        const res = bearerResistance(bearer, dot.type, ctx.resists?.[dot.type]);
        // A pierced share skips the resistance multiply entirely. The resisted
        // remainder is floored on its own rather than the total being clamped
        // at the end — otherwise a large enough resistance would drag the
        // pierced share down with it, and "bypasses immunities" would quietly
        // stop being true exactly where it matters.
        const pierce = Math.min(1, Math.max(0, dot.pierce ?? 0));
        // The ward comes off AFTER the pierce, not instead of it: piercing says
        // resistance does not apply, warding says the bearer sheds part of what
        // does apply. A pierced tick is unresistable, never unwardable.
        const shed = 1 - Math.min(1, Math.max(0, ctx.ward ?? 0));
        const dealt = raw * (pierce + (1 - pierce) * Math.max(0, 1 - res)) * shed;
        if (dealt > 0) {
          if (dotInverted(bearer, held.id)) {
            // A blessing has claimed this wound: what it would have drained
            // lands as healing instead (Xima's communion). The wound itself
            // ticks on — it is the DAMAGE that is channelled, not the cut.
            result.restores.push({
              resource: 'hp',
              amount: dealt,
              id: def.id,
              name: def.name,
              icon: def.icon,
            });
          } else {
            result.damage += dealt;
            result.hits.push({
              id: def.id,
              name: def.name,
              icon: def.icon,
              type: dot.type,
              amount: dealt,
            });
            // Remembered so a heal cap knows how much there is to forgive.
            held.data = held.data ?? {};
            held.data.dealt = (held.data.dealt ?? 0) + dealt;
          }
        }
      }
    }

    // Pools this condition hands back a little at a time. The mirror of a DoT:
    // this is what makes a cooked dish a sustained effect rather than an
    // instant one.
    for (const r of def.restores ?? []) {
      const pool = ctx.pools?.[r.resource];
      const amount =
        (r.flat ?? 0) * effectiveIntensity(held) +
        (r.ofMax ?? 0) * (pool?.trueMax ?? 0) * effectiveIntensity(held);
      if (amount > 0) {
        result.restores.push({
          resource: r.resource,
          amount,
          id: def.id,
          name: def.name,
          icon: def.icon,
        });
      }
    }

    // Pools this condition eats every tick, and what happens when it has eaten
    // more than there was. Manaburn is the case in mind: it drives mana into
    // debt, and when the debt reaches its limit the whole overdraft goes off.
    const drain = def.drains;
    const pool = drain ? ctx.pools?.[drain.resource] : undefined;
    if (drain && pool) {
      // A burn is a QUANTITY, not a rate: `intensity` is how much is left to
      // take, and every point drained spends a point of it. Drain the last of
      // it without ever reaching the debt limit and it simply gutters out.
      const wanted = (drain.flat ?? 0) * held.intensity + (drain.ofMax ?? 0) * pool.trueMax;
      const amount = Math.min(wanted, held.intensity);
      if (amount > 0) {
        result.drains.push({ resource: drain.resource, amount, id: def.id });
        held.data = held.data ?? {};
        held.data[`lost:${drain.resource}`] = (held.data[`lost:${drain.resource}`] ?? 0) + amount;
        held.intensity -= amount;
      }
      const debtLimit = statusNegativeHeadroom(bearer, drain.resource, pool.trueMax);
      if (def.detonate && debtLimit > 0 && pool.current - amount <= -debtLimit) {
        const overdraft = Math.abs(Math.min(0, pool.current - amount));
        result.detonations.push({
          id: def.id,
          name: def.name,
          icon: def.icon,
          type: def.detonate.type,
          amount: overdraft * def.detonate.ofDebt,
          bypassRes: def.detonate.bypassRes ?? 0,
        });
        removeStatus(bearer, held.id);
        result.expired.push(held.id);
        continue;
      }
      // Spent itself without ever reaching the limit: nothing to go off.
      if (held.intensity <= 0) {
        removeStatus(bearer, held.id);
        result.expired.push(held.id);
        continue;
      }
    }

    // A condition that eats a pool outright can finish its bearer that way.
    const fatal = def.fatalOnEmpty;
    const fatalPool = fatal ? ctx.pools?.[fatal.resource] : undefined;
    if (fatal && fatalPool && fatalPool.current <= 0) {
      result.fatal = { id: def.id, name: def.name, icon: def.icon, retains: fatal.retains };
    }

    // A puncture keeps weeping: its ceiling creeps up for as long as it is held.
    if (def.ceilingPerTick) {
      held.data = held.data ?? {};
      held.data.debt = Math.min(
        def.ceilingPerTick.max,
        (held.data.debt ?? 0) + def.ceilingPerTick.per,
      );
      held.debtPool = def.ceilingPerTick.resource;
    }

    // A condition that is paying a debt back ends when it has paid it all.
    if (def.ceilingDecay) {
      held.data = held.data ?? {};
      held.data.debt = Math.max(0, (held.data.debt ?? 0) - def.ceilingDecay);
      if (held.data.debt <= 0) {
        removeStatus(bearer, held.id);
        result.expired.push(held.id);
        continue;
      }
      // Spent itself without ever reaching the limit: nothing to go off.
      if (held.intensity <= 0) {
        removeStatus(bearer, held.id);
        result.expired.push(held.id);
        continue;
      }
    }

    // A surplus ledger sheds a share of ITSELF every tick — the body making
    // peace with what was forced into it, fastest when there is most to make
    // peace with. Relative to the ledger rather than to max health, so a big
    // body cannot shed a swelling faster than any working could build one.
    // Pure bookkeeping on the instance, so it belongs here rather than with
    // whatever owns the bearer. A proportional shed never quite reaches zero,
    // so the last sliver is simply let go: empty the ledger and the condition
    // has nothing left to be.
    const shed = def.surplus?.decayShare;
    if (shed && held.data?.surplus) {
      const left = held.data.surplus * (1 - shed);
      held.data.surplus = left;
      if (left <= SURPLUS_FLOOR) {
        removeStatus(bearer, held.id);
        result.expired.push(held.id);
        continue;
      }
    }

    // A tended condition thickens while nobody sees to it — the clock's
    // opposite number. Pruning is what answers it (see tendOnDamage), which is
    // why growth is gated on being IN a fight: a seed carried out of an
    // encounter would climb toward maturity with nothing able to cut it back,
    // and a condition you cannot answer is not a condition, it is a trap.
    const tends = def.tends;
    if (tends && ctx.inCombat) {
      held.intensity += tends.growPerSecond / TICKS_PER_SECOND;
      if (escalationPrimed(bearer, held)) {
        escalate(state, bearer, held, held.source);
        continue;
      }
    }

    if (held.ticksLeft !== null) {
      held.ticksLeft -= ctx.clockRate ?? 1;
      if (held.ticksLeft <= 0) {
        removeStatus(bearer, held.id);
        result.expired.push(held.id);
        // A parting blow, for conditions that end by working themselves loose
        // rather than by being dealt with. Reported through the ordinary
        // damage channel so both sides of a fight already know how to apply
        // it. Only the CLOCK pays this: cured or torn free early, nothing.
        const parting = def.expireDamage;
        if (parting) {
          const raw =
            (parting.flat ?? 0) * held.intensity +
            (parting.maxHp ?? 0) * held.intensity * ctx.maxHp;
          const res = bearerResistance(bearer, parting.type, ctx.resists?.[parting.type]);
          const dealt = Math.max(0, raw * (1 - res));
          if (dealt > 0) {
            result.damage += dealt;
            result.hits.push({
              id: def.id,
              name: def.name,
              icon: def.icon,
              type: parting.type,
              amount: dealt,
            });
          }
        }
        // Some conditions do not simply end — rot leaves you weakened behind it,
        // and a blaze leaves a burn. The successor inherits the bookkeeping, so
        // a debt or a heal cap survives the thing that created it.
        if (def.expiresTo) {
          const next = reform(
            state,
            bearer,
            { id: def.expiresTo, intensity: held.intensity },
            def.name,
          );
          if (next) {
            next.data = { ...held.data };
            if (held.debtPool) next.debtPool = held.debtPool;
          }
        }
      }
    }
  }
  return result;
}

/**
 * The player's resistance block, in the shape tickStatuses wants: what a blow of
 * each type would shed. `incomingSlice` stacks the type's own resistance with
 * `resElemental` (elemental types only) and holds the sum at the body's own
 * cap, and a condition's damage reads the same figure.
 */
export function resistBlock(stats: Record<string, number>): Record<DamageType, number> {
  const out = {} as Record<DamageType, number>;
  const cap = stats.resistCap === undefined ? Infinity : Math.max(0, stats.resistCap);
  for (const [type, key] of Object.entries(RES_STAT_BY_TYPE) as [DamageType, string][]) {
    out[type] = Math.min(
      cap,
      (stats[key] ?? 0) + (ELEMENTAL_TYPES.has(type) ? (stats.resElemental ?? 0) : 0),
    );
  }
  return out;
}
