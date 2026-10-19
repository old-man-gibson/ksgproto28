import type {
  ActivityCycleTags,
  ActivityDef,
  ActivityFactor,
  AttributeId,
  DerivedStats,
  GameState,
  SpotDef,
  ExploreGate,
  SpotFind,
} from '../types';
import type { EventBus } from '../engine/events';
import { rollSearch } from './search';
import { grantKeyItem } from './keyitems';
import { TPS } from '../engine/loop';
import { chance, randInt } from '../engine/rng';
import { getSpot, ITEMS, MATERIALS, RECIPES, RUNES, SKILLS, SPOTS } from '../registry';
import { BASE_ACTION_BAR, BASE_SPEED, getDerivedStats, scopedMult } from './derived';
import { attrValue, grantAttrXpSplit } from './attributes';
import { checkDiscovery, grantSkillXp, skillTrainedBy } from './skills';
import { grantActivityExposure } from './exposure';
import { conditionsMet } from './conditions';
import { tickCombat, abandonCombat, inForcedFight, spotCleared, startForcedFight } from './combat';
import { retreatToSafety } from './safety';
import { tickResources } from './resources';
import { damagePlayer, heal, hpFraction, isAlive, type HealKind } from './health';
import { IN_COMBAT_REGEN_MULT, RECOVERY_MULT } from '../data/resources.data';
import { fieldHunger, resistBlock, statusesOf, tickStatuses } from './statuses';
import { fastGuard, fastOf } from './mutagens';
import { grantMaterial } from './disciplines';
import { restingForFight } from './huntrest';
import { rollActivityDrops } from './activitydrops';
import {
  availableMax,
  drainIntoDebt,
  poolSnapshots,
  resourceValue,
  restoreResource,
} from './resources';
import { STATUSES } from '../registry';
import { createItem, grantRune } from './runes';
import { bumpStat, setStat } from './achievements';
import { feedFloating, floatingRun, logRepeat, settleFloating } from './log';
import { endFight, noteConditionDamage } from './ledger';
import { revealMapped } from './mapped';
import {
  canAfford,
  consumeCost,
  routeYield,
  recipeResultIcon,
  recipeResultName,
  recipeUnlocked,
} from './crafting';
import { text } from '../text/log';

/** All activities available at a spot, including synthesized craft activities. */
export function spotActivities(spot: SpotDef): ActivityDef[] {
  const crafts: ActivityDef[] = (spot.recipes ?? [])
    .filter((rid) => RECIPES[rid])
    .map((rid) => ({
      id: `craft_${rid}`,
      kind: 'craft',
      recipe: rid,
      name: `Craft ${recipeResultName(RECIPES[rid])}`,
      icon: recipeResultIcon(RECIPES[rid]),
      // The recipe says what kind of work it is; the activity carries it, so
      // the craft branch grants skill XP under those tags for free.
      tags: RECIPES[rid].tags,
    }));
  return [...spot.activities, ...crafts];
}

export function currentActivity(state: GameState): ActivityDef | null {
  if (!state.activity) return null;
  const spot = getSpot(state.spot);
  return spotActivities(spot).find((a) => a.id === state.activity) ?? null;
}

export function selectActivity(state: GameState, bus: EventBus, activityId: string | null): void {
  if (state.activity === activityId) return;
  // Switching work is one of the two ways out of a fight, and a forced fight
  // closes both doors (travel is the other — see locations.ts).
  if (inForcedFight(state)) {
    bus.emit({ type: 'log', msg: text('common.no_leaving_fight'), kind: 'danger' });
    return;
  }
  if (activityId) {
    const act = spotActivities(getSpot(state.spot)).find((a) => a.id === activityId);
    if (act?.kind === 'craft' && !recipeUnlocked(state, RECIPES[act.recipe])) {
      bus.emit({ type: 'log', msg: text('actions.craft_locked'), kind: 'danger' });
      return;
    }
  }
  if (state.combat) abandonCombat(state);
  state.activity = activityId;
  state.activityProgress = 0;
  state.travelPlan = []; // picking work overrides any pending journey
  state.travelIntent = null; // and whatever that journey was for
  state.benchWork = null; // and steps away from any bench run
  state.performance = null; // and off any stage
  // Remember the choice for the next visit — and forget it when the player
  // stops by hand, so a spot left idle on purpose stays idle.
  if (activityId) state.resumeActivity[state.spot] = activityId;
  else delete state.resumeActivity[state.spot];

  const act = currentActivity(state);
  if (act) bus.emit({ type: 'log', msg: text('actions.started', { name: act.name }), kind: 'action' });
}

/**
 * Whether an activity id can be started here and now: it exists at the spot,
 * and a craft is unlocked and affordable (a starved craft would only log its
 * own stop on the next tick).
 */
export function canStartActivity(state: GameState, spotId: string, activityId: string): boolean {
  const act = spotActivities(getSpot(spotId)).find((a) => a.id === activityId);
  if (!act) return false;
  if (act.kind === 'craft') {
    const recipe = RECIPES[act.recipe];
    return !!recipe && recipeUnlocked(state, recipe) && canAfford(state, recipe);
  }
  return true;
}

/**
 * The end of a journey, peacefully reached: start what the journey was for,
 * else pick up whatever the player last did here. Called by every arrival
 * path AFTER its ambush check — a forced fight owns the arrival instead.
 */
export function settleArrival(state: GameState, bus: EventBus): void {
  const intent = state.travelIntent;
  state.travelIntent = null;
  if (state.travel || state.travelPlan.length > 0 || state.recovering || state.combat) return;
  const wanted =
    intent && intent.spot === state.spot ? intent.activity : state.resumeActivity[state.spot];
  if (wanted && canStartActivity(state, state.spot, wanted)) selectActivity(state, bus, wanted);
}

const RECOVER_THRESHOLD = 0.6;

/**
 * How fast an affliction's clock runs while you are out cold.
 *
 * You come round at RECOVER_THRESHOLD of your health, and at 1× a 45-second rot
 * simply picked up where it left off and put you straight back down — recover,
 * get floored, recover, for as long as it had left. Being unconscious is time
 * passing, so the clocks pass with it. Clocks only: the damage stays at its
 * per-tick rate, so this shortens an affliction rather than concentrating it.
 *
 * At 5×, a knockout that takes ~15 seconds to sleep off burns a bit over a
 * minute of fever — enough that the long ones (rot at 45s, queasy at 90s) are
 * gone or nearly gone when you sit up, without making them meaningless if you
 * are knocked out the instant they land.
 */
const UNCONSCIOUS_CLOCK_RATE = 5;

/**
 * The tags an activity's cycle grants skill XP under — how an activity reaches
 * a skill (skillTrainedBy). The tick branches read it, and so does
 * `trainingSpots`, so "where does this train" cannot drift from what training
 * actually pays. Hunting lists only its built-ins: the fight adds weapon and
 * style tags from the loadout (combat.ts), which no spot can promise.
 */
export function activityXpTags(act: ActivityDef): string[] {
  switch (act.kind) {
    case 'train':
      return ['training', ...Object.keys(attrXpWeights(act)), ...(act.tags ?? [])];
    case 'gather':
      return ['explore', 'gather', ...(act.tags ?? [])];
    case 'job':
      return ['job', ...(act.tags ?? [])];
    case 'craft':
      return ['craft', ...(act.tags ?? [])];
    case 'search':
    case 'explore':
      return ['explore', ...(act.tags ?? [])];
    case 'hunt':
      return ['combat', 'hunt'];
    default:
      return [];
  }
}

/**
 * Discovered spots with an activity that trains a skill or an attribute, as
 * go-and-do targets. Unlocked crafts only; a spot's activities in their own
 * order. An attribute is trained by a `train` activity that weights it.
 */
export function trainingSpots(
  state: GameState,
  target: { skill: string } | { attr: AttributeId },
): { spot: string; activity: string }[] {
  const def = 'skill' in target ? SKILLS[target.skill] : null;
  if ('skill' in target && !def) return [];
  const trains = (act: ActivityDef) =>
    def
      ? skillTrainedBy(def, activityXpTags(act))
      : act.kind === 'train' && 'attr' in target && (attrXpWeights(act)[target.attr] ?? 0) > 0;
  const out: { spot: string; activity: string }[] = [];
  for (const spotId of state.discovered) {
    const spot = SPOTS[spotId];
    if (!spot) continue;
    for (const act of spotActivities(spot)) {
      if (act.kind === 'craft' && !recipeUnlocked(state, RECIPES[act.recipe])) continue;
      if (trains(act)) out.push({ spot: spotId, activity: act.id });
    }
  }
  return out;
}

/** Baseline ticks per training rep — one chunked XP payout per completed rep. */
export const TRAIN_REP_TICKS = 20;

// ---------- Activity factors (speed / output tags) ----------

/** Cycle tags carried by train/gather/job/craft (undefined fields on other kinds). */
function tagsOf(act: ActivityDef): ActivityCycleTags {
  return act as unknown as ActivityCycleTags;
}

/** A factor's source value: fusion-aware attributes, derived stats, or skill level (missing = 0). */
function factorValue(state: GameState, stats: DerivedStats, f: ActivityFactor): number {
  if (f.attr) return attrValue(state, f.attr);
  if (f.stat) return stats[f.stat];
  if (f.skill) return state.skills[f.skill]?.level ?? 0;
  return 0;
}

/** Additive stack: Σ weight·(value − base). */
function factorSum(state: GameState, stats: DerivedStats, factors?: ActivityFactor[]): number {
  let sum = 0;
  for (const f of factors ?? []) sum += f.weight * (factorValue(state, stats, f) - (f.base ?? 0));
  return sum;
}

/** Hyperbolic soft cap: approaches `cap` as x grows; identity when cap is falsy. */
function softCap(x: number, cap?: number): number {
  return cap ? (cap * x) / (x + cap) : x;
}

/** Speed multiplier from speedFactors (floored so the bar never stalls). */
export function activitySpeedMult(state: GameState, stats: DerivedStats, act: ActivityDef): number {
  return Math.max(0.1, 1 + factorSum(state, stats, tagsOf(act).speedFactors));
}

/** Output multiplier from outputFactors (bonus soft-capped); 1 when none are tagged. */
export function activityOutputMult(state: GameState, stats: DerivedStats, act: ActivityDef): number {
  const tags = tagsOf(act);
  if (!tags.outputFactors?.length) return 1;
  return 1 + softCap(Math.max(0, factorSum(state, stats, tags.outputFactors)), tags.outputCap);
}

/**
 * The attribute XP split an activity actually pays, with the kind's default
 * filled in when content doesn't override it. Shared by the tick loop and the
 * UI so a tooltip can never disagree with what the payout does.
 */
export function attrXpWeights(act: ActivityDef): Partial<Record<AttributeId, number>> {
  const authored = tagsOf(act).attrXp;
  if (authored) return authored;
  switch (act.kind) {
    case 'train':
      return act.attr ? { [act.attr]: 1 } : {};
    case 'gather':
      return { wis: 1 };
    case 'job':
      return { cha: 1 };
    default:
      // Crafting (and the cycle-less kinds) train nothing until content says so.
      return {};
  }
}

/** Speed/output factor lists for an activity (empty for kinds/cases without tags). Used by the UI. */
export function activityFactorInfo(act: ActivityDef): {
  speed: ActivityFactor[];
  output: ActivityFactor[];
  staticTime: boolean;
} {
  const t = tagsOf(act);
  return { speed: t.speedFactors ?? [], output: t.outputFactors ?? [], staticTime: !!t.staticTime };
}

/** Integer yield from a (possibly fractional) expected amount: floor + probabilistic remainder. */
function integerYield(state: GameState, expected: number): number {
  const whole = Math.floor(expected);
  return whole + (chance(state, expected - whole) ? 1 : 0);
}

/**
 * Units the current activity's action bar needs before it completes. Costs are
 * the activity's baseline ticks at BASE_SPEED, scaled by the player's
 * action-bar size — a shrunken (superhuman) bar completes EVERY action sooner.
 * Static-time activities run on a fixed clock (no action-bar scaling).
 * Returns 0 for activities without a completion cycle (rest, explore, hunt).
 */
export function activityCost(act: ActivityDef, stats: DerivedStats): number {
  let baselineTicks = 0;
  switch (act.kind) {
    case 'train':
      baselineTicks = TRAIN_REP_TICKS;
      break;
    case 'gather':
    case 'job':
    case 'search':
      baselineTicks = act.ticksPer;
      break;
    case 'craft':
      baselineTicks = RECIPES[act.recipe]?.ticks ?? 50;
      break;
    default:
      return 0;
  }
  if (tagsOf(act).staticTime) return baselineTicks * BASE_SPEED;
  return baselineTicks * BASE_SPEED * (stats.actionBar / BASE_ACTION_BAR);
}

/**
 * Units the activity bar gains per tick. Static-time activities fill at a fixed
 * BASE_SPEED (so ETA == baseline ticks); otherwise the speed stat, scaled by
 * the activity's speedFactors (and craftSpeed for crafting).
 */
export function activityFillRate(act: ActivityDef, stats: DerivedStats, state: GameState): number {
  if (tagsOf(act).staticTime) return BASE_SPEED;
  const speed = stats.speed * activitySpeedMult(state, stats, act);
  if (act.kind !== 'craft') return speed;
  // Unconditional craftSpeed, then whatever applies only to THIS kind of work
  // — a leatherworking bonus speeds up hides and leaves the anvil alone.
  return speed * stats.craftSpeed * scopedMult(state, 'craftSpeed', tagsOf(act).tags ?? []);
}

/** Per-tick action processing. Called by the game loop when not traveling. */
export function tickAction(state: GameState, bus: EventBus): void {
  const stats = getDerivedStats(state);
  const act = currentActivity(state);
  // Coming round after a knockout is resting whether you chose it or not.
  const resting = state.recovering || act?.kind === 'rest';
  // Every pool is clamped to its current ceiling and topped up in one pass.
  tickResources(state, stats, TPS, resting);
  // Afflictions run whether or not you are fighting — that is rather the point
  // of a poison. They may also be what finally puts you down.
  if (tickPlayerStatuses(state, bus, stats)) return;

  // Knocked out: force rest until recovered, then resume whatever was selected.
  if (state.recovering) {
    regen(state, stats, RECOVERY_MULT.rest, 'rest');
    if (hpFraction(state, stats) >= RECOVER_THRESHOLD) {
      state.recovering = false;
      bus.emit({ type: 'log', msg: text('actions.recovered'), kind: 'action' });
    }
    return;
  }

  // The health trickle runs for whatever you are doing, so it is applied once
  // here rather than tucked into each case — including the ones that break out
  // early. A live fight halves it; the lulls between encounters do not.
  // A hunt holding its next fight back for the player's HP threshold is
  // resting in earnest (systems/huntrest.ts), at the rest rate.
  const restingForNext = act?.kind === 'hunt' && !state.combat && restingForFight(state);
  const restfulness = restingForNext
    ? RECOVERY_MULT.rest
    : RECOVERY_MULT[act?.kind ?? 'none'] * combatRegenMult(state, stats);
  regen(state, stats, restfulness, resting || restingForNext ? 'rest' : 'idle');

  const spot = getSpot(state.spot);

  // A forced fight started on arrival, not from an activity, so it ticks no
  // matter what is (or isn't) selected — you cannot put it down by having
  // nothing to do. Whatever work was picked resumes once the fight resolves.
  if (!state.combat && spot.forced && !spotCleared(state, spot)) startForcedFight(state, bus, spot);
  if (inForcedFight(state)) {
    tickCombat(state, bus, spot);
    return;
  }
  if (!act) return;

  switch (act.kind) {
    case 'train': {
      // Every trained attribute is a tag, so a split trains (and can manifest)
      // skills tagged for any of them, not just a nominated primary.
      const weights = attrXpWeights(act);
      const tags = activityXpTags(act);
      checkDiscovery(state, bus, tags);
      state.activityProgress += activityFillRate(act, stats, state);
      const cost = activityCost(act, stats);
      if (state.activityProgress >= cost) {
        state.activityProgress -= cost;
        // One rep's worth of XP lands as a single chunk on completion; output
        // factors (if any) scale the XP payout.
        const xpMult = activityOutputMult(state, stats, act);
        grantAttrXpSplit(state, bus, weights, TRAIN_REP_TICKS * stats.trainXp * xpMult);
        grantSkillXp(state, bus, tags, 0.25 * TRAIN_REP_TICKS);
        grantActivityExposure(state, bus, tags, TRAIN_REP_TICKS);
        rollActivityDrops(state, bus, act);
      }
      break;
    }
    case 'rest': {
      // Nothing to do but recover, which the trickle above already did.
      break;
    }
    case 'search': {
      state.activityProgress += activityFillRate(act, stats, state);
      const cost = activityCost(act, stats);
      if (state.activityProgress >= cost) {
        state.activityProgress -= cost;
        const reward = rollSearch(state, bus, spot.id, act);
        if (reward) grantFind(state, bus, spot, { ...reward, at: 1 }, false);
        else bus.emit({ type: 'log', kind: 'explore', msg: 'Nothing remains to be found in this search.' });
        checkDiscovery(state, bus, activityXpTags(act));
        grantSkillXp(state, bus, activityXpTags(act), 2);
      }
      break;
    }
    case 'explore': {
      const tags = act.tags ?? [];
      tickExplore(state, bus, spot, stats.loot * scopedMult(state, 'loot', tags), tags);
      break;
    }
    case 'hunt': {
      if (!spot.encounters?.length) return;
      checkDiscovery(state, bus, ['combat', 'hunt']);
      tickCombat(state, bus, spot);
      break;
    }
    case 'gather': {
      const tags = activityXpTags(act);
      checkDiscovery(state, bus, tags);
      state.activityProgress += activityFillRate(act, stats, state);
      const cost = activityCost(act, stats);
      if (state.activityProgress >= cost) {
        state.activityProgress -= cost;
        grantSkillXp(state, bus, tags, 0.25 * act.ticksPer);
        grantAttrXpSplit(state, bus, attrXpWeights(act), 0.5 * act.ticksPer * stats.trainXp);
        grantActivityExposure(state, bus, tags, act.ticksPer);
        // Output factors raise the amount (fractional expectation → integer roll).
        const amount = integerYield(state, activityOutputMult(state, stats, act));
        // Scoped loot narrows to the KIND OF WORK: `loot:herbalism` improves
        // the grade of what a herbalist picks and nothing else.
        grantMaterial(state, act.material, amount, stats.loot * scopedMult(state, 'loot', tags));
        // Achievements/conditions can watch per-material gather counters.
        bumpStat(state, bus, `gather:${act.material}`, amount);
        const mat = MATERIALS[act.material];
        logRepeat(bus, {
          group: `act:${act.id}`,
          prefix: '🧺 Gathered:',
          tally: [{ label: `${mat?.icon ?? '📦'} ${mat?.name ?? act.material}`, qty: amount }],
          kind: 'loot',
        });
        rollActivityDrops(state, bus, act);
      }
      break;
    }
    case 'job': {
      // Paid work teaches too: a shift at the coal face is Mining practice
      // that happens to come with wages. Same hook as gather/train/craft —
      // `tags` is how an activity reaches a skill — with 'job' as the built-in
      // so a future "day labour" skill can claim every shift at once.
      const tags = activityXpTags(act);
      checkDiscovery(state, bus, tags);
      state.activityProgress += activityFillRate(act, stats, state);
      const cost = activityCost(act, stats);
      if (state.activityProgress >= cost) {
        state.activityProgress -= cost;
        grantSkillXp(state, bus, tags, 0.25 * act.ticksPer);
        grantAttrXpSplit(state, bus, attrXpWeights(act), 0.6 * act.ticksPer * stats.trainXp);
        grantActivityExposure(state, bus, tags, act.ticksPer);
        // Output factors (if tagged) replace the default goldGain scaling.
        const rewardMult = act.outputFactors?.length
          ? activityOutputMult(state, stats, act)
          : stats.goldGain;
        const pay = Math.max(1, Math.round(act.gold * rewardMult));
        state.gold += pay;
        bumpStat(state, bus, 'gold:earned', pay);
        logRepeat(bus, {
          group: `act:${act.id}`,
          prefix: '💰 Shift pay:',
          tally: [{ label: 'gold', qty: pay, style: 'amount' }],
          kind: 'action',
        });
        rollActivityDrops(state, bus, act);
      }
      break;
    }
    case 'craft': {
      const recipe = RECIPES[act.recipe];
      if (!recipe) break;
      // Starved at the start of a cycle: stop instead of grinding a dead cycle.
      if (state.activityProgress === 0 && !canAfford(state, recipe)) {
        bus.emit({ type: 'log', msg: text('actions.out_of_materials', { name: act.name }), kind: 'action' });
        state.activity = null;
        break;
      }
      const tags = activityXpTags(act);
      checkDiscovery(state, bus, tags);
      state.activityProgress += activityFillRate(act, stats, state);
      if (state.activityProgress >= activityCost(act, stats)) {
        // Reset (not carry) so the start-of-cycle affordability guard holds.
        state.activityProgress = 0;
        if (!canAfford(state, recipe)) {
          bus.emit({ type: 'log', msg: text('actions.out_of_materials', { name: act.name }), kind: 'action' });
          state.activity = null;
          break;
        }
        // The route that actually paid decides the yield — a pristine hide
        // makes two leather where three torn ones make one.
        const route = consumeCost(state, recipe);
        const baseQty = routeYield(recipe, route);
        // Output factors (if tagged) raise the yield per craft.
        const qty = act.outputFactors?.length
          ? integerYield(state, baseQty * activityOutputMult(state, stats, act))
          : baseQty;
        if (recipe.result.kind === 'material') {
          state.materials[recipe.result.id] = (state.materials[recipe.result.id] ?? 0) + qty;
        } else if (recipe.result.kind === 'rune') {
          grantRune(state, bus, recipe.result.id, qty, true);
        } else {
          for (let i = 0; i < qty; i++) {
            state.inventory.push(createItem(state, recipe.result.id));
          }
        }
        grantSkillXp(state, bus, tags, recipe.xp + 0.2 * recipe.ticks);
        // No-op unless the craft activity opts in with `attrXp`.
        grantAttrXpSplit(state, bus, attrXpWeights(act), 0.5 * recipe.ticks * stats.trainXp);
        grantActivityExposure(state, bus, tags, recipe.ticks);
        bumpStat(state, bus, 'crafts');
        bus.emit({ type: 'craft', recipe: recipe.id });
        logRepeat(bus, {
          group: `act:${act.id}`,
          prefix: '🔨 Crafted',
          tally: [{ label: `${recipeResultIcon(recipe)} ${recipeResultName(recipe)}`, qty }],
          kind: 'item',
        });
      }
      break;
    }
  }
}

/**
 * A knockout is a floor, not a step you can fall through twice.
 *
 * A condition that finishes someone who is ALREADY down does nothing new: they
 * are held at the sliver of health the first knockout left them, the tick says
 * nothing about it, and no second outcome is recorded. Returns true when it has
 * taken care of things and the caller must not go down again.
 *
 * Without this, a rot that outlived the fight re-ran the entire knockout every
 * tick for as long as it had left to run. Three things came of that, in rising
 * order of harm: a wall of identical "finishes you" lines; health pinned at 1,
 * because the caller's `return` skips the recovery regen; and — worst — a fresh
 * ledger each time. `ensureLedger` makes one on demand for damage taken outside
 * an encounter, so every tick minted an empty tally and `endFight` promoted it
 * over `lastFight`, replacing the summary of the fight that actually put you
 * there with one recording no enemies, no blows and no damage dealt.
 */
function stillOnTheFloor(state: GameState): boolean {
  if (!state.recovering) return false;
  state.resources.hp = 1;
  return true;
}

/**
 * One tick of the player's conditions. Returns true when they proved fatal, so
 * the caller stops rather than acting out the rest of the tick.
 *
 * Bleeding out while chopping wood is a real outcome — this is deliberately
 * outside the combat path.
 */
function tickPlayerStatuses(state: GameState, bus: EventBus, stats: DerivedStats): boolean {
  if (statusesOf(state).length === 0) return false;
  // What a fast sheds off every wound. Computed inside the guard, never as an
  // eager argument — see resources.ts for what that costs.
  const fast = fastOf(state);
  const ward = fast ? fastGuard(state, fieldHunger(state)).ward : 0;
  const result = tickStatuses(state, state, {
    hp: resourceValue(state, 'hp'),
    maxHp: availableMax(state, stats, 'hp'),
    inCombat: state.combat !== null,
    resists: resistBlock(stats),
    pools: poolSnapshots(state, stats),
    clockRate: state.recovering ? UNCONSCIOUS_CLOCK_RATE : 1,
    ward,
  });

  // Pools a condition is eating. These may run past zero into debt — that is
  // the whole of manaburn's threat, and the overdraft is what goes off.
  for (const drain of result.drains) drainIntoDebt(state, stats, drain.resource, drain.amount);

  // ...and pools a condition is feeding back. Health goes through heal() so
  // that anything watching for treatment sees it; other pools simply refill.
  for (const give of result.restores) {
    if (give.resource === 'hp') heal(state, stats, give.amount, 'other');
    else restoreResource(state, stats, give.resource, give.amount);
  }

  // A debt that has bottomed out detonates: the overdraft comes back as damage
  // that most resistance cannot touch.
  for (const boom of result.detonations) {
    const res = resistBlock(stats)[boom.type] * (1 - boom.bypassRes);
    const dealt = Math.max(1, Math.round(boom.amount * (1 - res)));
    damagePlayer(state, dealt, boom.type, {
      key: `cond:${boom.id}`,
      label: boom.name,
      icon: boom.icon,
    });
    bus.emit({
      type: 'log',
      msg: text('actions.condition_detonates', { icon: boom.icon, name: boom.name, dealt, type: boom.type }),
      kind: 'danger',
    });
    // A detonation is perfectly capable of finishing you, and must put you
    // down the same way anything else that does would.
    if (!isAlive(state)) {
      if (stillOnTheFloor(state)) continue;
      bus.emit({
        type: 'log',
        msg: text('actions.condition_knocks_out', { name: boom.name }),
        kind: 'danger',
      });
      // Before abandonCombat, which drops the tally on the floor — walking away
      // is not an outcome, but being finished by a condition very much is.
      const wasForced = inForcedFight(state);
      endFight(state, 'knocked_out');
      if (state.combat) abandonCombat(state);
      state.resources.hp = 1;
      state.recovering = true;
      // Going down DURING a forced fight is losing it, whatever did the deed.
      retreatToSafety(
      state,
      bus,
      wasForced ? 'There was no fleeing that fight, and it finished you.' : 'Knocked out.',
    );
      return true;
    }
  }

  for (const id of result.expired) {
    const def = STATUSES[id];
    if (def && !def.hidden) {
      bus.emit({ type: 'log', msg: text('actions.condition_passed', { icon: def.icon, name: def.name }), kind: 'combat' });
    }
  }

  // A condition that has hollowed a pool out entirely takes the bearer down and
  // keeps part of its hold through whatever comes next — there is no cleansing
  // yet, so what it retains simply stays.
  //
  // The floor guard matters most here: this branch also nulls the clock of what
  // took you, so re-running it on someone already down would re-seize the pool
  // and wipe the clock again every tick — a condition that could never end.
  if (result.fatal && !stillOnTheFloor(state)) {
    const held = state.statuses.find((h) => h.id === result.fatal!.id);
    bus.emit({
      type: 'log',
      msg: text('actions.condition_fatal', { icon: result.fatal.icon, name: result.fatal.name }),
      kind: 'danger',
    });
    if (held) {
      held.intensity = Math.ceil(held.intensity * result.fatal.retains);
      held.peak = held.intensity;
      held.ticksLeft = null;
    }
    const wasForced = inForcedFight(state);
    if (state.combat) abandonCombat(state);
    state.resources.hp = 1;
    state.recovering = true;
    // Going down DURING a forced fight is losing it, whatever did the deed.
    retreatToSafety(
      state,
      bus,
      wasForced ? 'There was no fleeing that fight, and it finished you.' : 'Knocked out.',
    );
    return true;
  }

  if (result.damage > 0) {
    // Attributed per condition here rather than at the door, because the tick
    // resolves them together — see damagePlayer's `null` source.
    for (const h of result.hits) noteConditionDamage(state, h.id, h.amount);
    damagePlayer(state, result.damage, undefined, null);
    // Conditions used to eat the player's health in silence — the bar moved and
    // nothing said why. Floating rather than folded, so a long poison never
    // takes a line at all until it is over: see feedFloating.
    feedFloating(state, {
      group: 'cond:self',
      prefix: '🩸 You suffer:',
      tally: result.hits.map((h) => ({
        label: `${h.icon} ${h.name.toLowerCase()}`,
        qty: h.amount,
        style: 'amount' as const,
      })),
      ids: result.hits.map((h) => h.id),
    });
    if (!isAlive(state) && !stillOnTheFloor(state)) {
      const worst = result.hits[0];
      bus.emit({
        type: 'log',
        msg: text('actions.condition_knocks_out', { name: worst.name }),
        kind: 'danger',
      });
      // Before abandonCombat, which drops the tally on the floor — walking away
      // is not an outcome, but being finished by a condition very much is.
      const wasForced = inForcedFight(state);
      endFight(state, 'knocked_out');
      if (state.combat) abandonCombat(state);
      state.resources.hp = 1;
      state.recovering = true;
      // Going down DURING a forced fight is losing it, whatever did the deed.
      retreatToSafety(
      state,
      bus,
      wasForced ? 'There was no fleeing that fight, and it finished you.' : 'Knocked out.',
    );
      return true;
    }
  }
  // The run ends when nothing is still feeding it — checked every tick, not
  // only on a damaging one, because a condition that has stopped hurting has
  // stopped whether or not this particular tick had anything to say.
  const run = floatingRun(state, 'cond:self');
  if (run && !run.ids.some((id) => state.statuses.some((h) => h.id === id))) {
    settleFloating(state, 'cond:self');
  }
  return false;
}

/**
 * What being mid-fight does to the health trickle.
 *
 * Not a shutter: you mend at half pace through a fight rather than not at all.
 * The gate is stamina off its ceiling — the reading for "straining", which one
 * swing's upkeep is enough to produce and which clears again once an encounter
 * ends and the bar refills. So the lull between monsters heals you properly and
 * the fight itself does not.
 *
 * The ceiling is the AVAILABLE max, not the true one: a wound that seals off
 * part of the stamina pool must not also mean a bar that reads full is quietly
 * still counted as strained. Half is the whole of the penalty — being winded or
 * exhausted adds nothing on top.
 */
export function combatRegenMult(state: GameState, stats: DerivedStats): number {
  if (!state.combat) return 1;
  const full = availableMax(state, stats, 'stamina');
  return resourceValue(state, 'stamina') < full - 1e-6 ? IN_COMBAT_REGEN_MULT : 1;
}

/**
 * One tick of the health trickle: the `hpRegen` stat, multiplied by how
 * restful the activity is. Routed through heal() rather than the generic pool
 * regen so that conditions still get their say — a burn caps what may be
 * undone, a bleed closes on being tended to.
 *
 * The `kind` is recorded with it so those conditions can tell the difference
 * between sitting down to rest and quietly mending while you work.
 */
function regen(state: GameState, stats: DerivedStats, mult: number, kind: HealKind): void {
  if (mult <= 0) return;
  heal(state, stats, (stats.hpRegen * mult) / TPS, kind);
}

export function exploreProgress(state: GameState, spot: SpotDef): number {
  const needed = spot.exploreTicks ?? 100;
  return Math.min(1, (state.explored[spot.id] ?? 0) / needed);
}

export function isExplored(state: GameState, spotId: string): boolean {
  return exploreProgress(state, getSpot(spotId)) >= 1;
}

/** Find ids already turned up at a spot. */
export function claimedFinds(state: GameState, spotId: string): string[] {
  return state.finds[spotId] ?? [];
}

/**
 * Finds whose threshold the current progress has reached but which haven't
 * fired yet, shallowest first — so a backfill pays out in the order the spot
 * would have given them up.
 */
export function pendingFinds(state: GameState, spot: SpotDef): SpotFind[] {
  const claimed = claimedFinds(state, spot.id);
  const progress = exploreProgress(state, spot);
  return (spot.finds ?? [])
    .filter(
      (f) =>
        !claimed.includes(f.id) &&
        progress >= f.at &&
        // A find you aren't equipped for isn't skipped, it waits: unclaimed,
        // unlogged, and still there when you come back with the key.
        (!f.requires || conditionsMet(state, f.requires)),
    )
    .sort((a, b) => a.at - b.at);
}

/**
 * The gate currently holding the search up, if any — the shallowest one whose
 * depth has been reached and whose conditions have not been met.
 */
export function blockingGate(state: GameState, spot: SpotDef): ExploreGate | null {
  const progress = exploreProgress(state, spot);
  return (
    [...(spot.exploreGates ?? [])]
      .sort((a, b) => a.at - b.at)
      .find((g) => progress >= g.at && !conditionsMet(state, g.requires)) ?? null
  );
}

/**
 * Hidden connections out of a spot that a `path` find has already opened —
 * a back door found halfway through the search rather than at the end.
 */
export function foundPaths(state: GameState, spotId: string): Set<string> {
  const claimed = claimedFinds(state, spotId);
  const open = new Set<string>();
  for (const find of getSpot(spotId).finds ?? []) {
    if (find.path && claimed.includes(find.id)) open.add(find.path);
  }
  return open;
}

/** Hand over one find's payload and remember it as claimed. */
function grantFind(state: GameState, bus: EventBus, spot: SpotDef, find: SpotFind, remember = true): void {
  // Assign, THEN read back. The value of `x ??= []` is the raw array, but the
  // UI's deep $state proxy stores a proxied copy of it — pushing into the
  // expression's result writes to an array nothing will ever read. It only
  // misfires when the key was absent, which is every spot the first time.
  if (remember) {
    state.finds[spot.id] ??= [];
    state.finds[spot.id].push(find.id);
  }
  if (find.keyItem) grantKeyItem(state, bus, find.keyItem);

  const tally: { label: string; qty: number; style?: 'amount' }[] = [];

  if (find.gold) {
    const gold = randInt(state, find.gold[0], find.gold[1]);
    state.gold += gold;
    bumpStat(state, bus, 'gold:earned', gold);
    tally.push({ label: 'gold', qty: gold, style: 'amount' });
  }
  if (find.material) {
    const qty = find.material.qty ?? 1;
    // Raw find, not a worked yield: no loot multiplier — what is lying there
    // is what is lying there.
    grantMaterial(state, find.material.id, qty, 1);
    bumpStat(state, bus, `gather:${find.material.id}`, qty);
    const mat = MATERIALS[find.material.id];
    tally.push({ label: `${mat?.icon ?? '📦'} ${mat?.name ?? find.material.id}`, qty });
  }
  if (find.item) {
    state.inventory.push(createItem(state, find.item));
    const item = ITEMS[find.item];
    tally.push({ label: `${item?.icon ?? '📦'} ${item?.name ?? find.item}`, qty: 1 });
  }
  if (find.rune) {
    grantRune(state, bus, find.rune, 1, true);
    const rune = RUNES[find.rune];
    tally.push({ label: `${rune?.icon ?? '🔣'} ${rune?.name ?? find.rune}`, qty: 1 });
  }
  if (find.skillXp) {
    checkDiscovery(state, bus, find.skillXp.tags);
    grantSkillXp(state, bus, find.skillXp.tags, find.skillXp.xp);
  }
  // The cross-room wire: a lever pulled here is a counter something elsewhere
  // reads. `set` overwrites (how a reset works); `amount` bumps.
  if (find.stat) {
    if (find.stat.set !== undefined) setStat(state, bus, find.stat.key, find.stat.set);
    else bumpStat(state, bus, find.stat.key, find.stat.amount ?? 1);
  }

  const headline = find.desc ?? text('actions.find_generic', { spot: spot.name });
  bus.emit({ type: 'log', msg: headline, kind: 'explore' });
  if (tally.length > 0) {
    logRepeat(bus, { group: `find:${spot.id}:${find.id}`, prefix: '🎁 Found:', tally, kind: 'loot' });
  }

  // A rumor of somewhere else puts it on the map without walking there.
  if (find.spot && !state.discovered.includes(find.spot)) {
    state.discovered.push(find.spot);
    const target = getSpot(find.spot);
    bus.emit({ type: 'log', msg: text('actions.find_marks_spot', { icon: target.icon, name: target.name }), kind: 'explore' });
    revealMapped(state);
  }
  if (find.path) {
    const edge = spot.connections.find((c) => c.to === find.path);
    bus.emit({
      type: 'log',
      msg: text('actions.find_opens_path', { spot: spot.name, label: edge?.label ?? getSpot(find.path).name }),
      kind: 'explore',
    });
  }
}

function tickExplore(
  state: GameState,
  bus: EventBus,
  spot: SpotDef,
  lootLuck: number,
  extraTags: readonly string[] = [],
): void {
  // Whatever the activity says this place IS ('cave', 'ruins') rides along, so
  // a cave-delving skill can manifest and level from searching one.
  const tags = ['explore', ...extraTags];
  checkDiscovery(state, bus, tags);
  grantSkillXp(state, bus, tags, 0.3);

  // A gate stops the search dead rather than slowing it: the passage is
  // flooded, and no amount of looking changes that until you bring a light.
  const gate = blockingGate(state, spot);
  if (gate) {
    logRepeat(bus, {
      group: `gate:${spot.id}:${gate.at}`,
      prefix: gate.desc ?? text('actions.gate_generic', { percent: Math.round(gate.at * 100) }),
      tally: [],
      kind: 'explore',
    });
    return;
  }

  const before = isExplored(state, spot.id);
  state.explored[spot.id] = (state.explored[spot.id] ?? 0) + 1;

  // At most one find per tick: a spot that gained content after you had
  // already combed it gives it up over several ticks instead of in one wall
  // of log lines.
  const pending = pendingFinds(state, spot);
  if (pending.length > 0) grantFind(state, bus, spot, pending[0]);

  if (!before && isExplored(state, spot.id)) {
    const hidden = spot.connections.filter((c) => c.hidden);
    bus.emit({
      type: 'log',
      msg:
        hidden.length > 0
          ? text('actions.explored_paths', { spot: spot.name, paths: hidden.map((c) => c.label ?? c.to).join(', ') })
          : text('actions.explored', { spot: spot.name }),
      kind: 'explore',
    });
    return;
  }

  // Fully explored spots still yield the occasional find.
  if (chance(state, 0.008 * lootLuck)) {
    const gold = randInt(state, 1, 4 + Math.floor(lootLuck * 3));
    state.gold += gold;
    bumpStat(state, bus, 'gold:earned', gold);
    logRepeat(bus, {
      group: `explore:${spot.id}`,
      prefix: '🪙 Found while exploring:',
      tally: [{ label: 'gold', qty: gold, style: 'amount' }],
      kind: 'loot',
    });
  }
}
