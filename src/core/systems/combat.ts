import { TOLL_GOLEM, TOLL_SPELL_FLAG, noteTollSpell, reactTollGolem, rewardTollGolem } from './floodedFloor';
import type {
  ActiveSpec,
  CombatState,
  DamageReport,
  DamageSlice,
  DamageStep,
  DamageType,
  DerivedStats,
  DropEntry,
  DropTable,
  FloatingAffliction,
  GameState,
  ItemInstance,
  LogTally,
  ModifierTierId,
  MonsterDef,
  MonsterInstance,
  MonsterRange,
  RarityId,
  ResourceId,
  SpellSource,
  SpellSpec,
  SpellStrike,
  SlotId,
  Bearer,
  SpotDef,
  SpotEncounter,
  StatusApplication,
  TechniqueDef,
  TechniqueMove,
} from '../types';
import { ENCOUNTER_SLOTS, PHYSICAL_TYPES, RES_STAT_BY_TYPE } from '../types';
import type { EventBus } from '../engine/events';
import { mercyPick, mercyTracked, procChance } from '../engine/mercy';
import { chance, rand, randInt, weightedPick } from '../engine/rng';
import {
  AFFIXES,
  ITEMS,
  MATERIALS,
  MODIFIER_TIERS,
  MODIFIER_WEIGHTS,
  MONSTERS,
  RARITIES,
  RARITY_WEIGHTS,
  SKILLS,
  SPOTS,
  STATUSES,
  TIERS,
} from '../registry';
import { conditionsMet } from './conditions';
import { PARRY_CAP, actionTicks, attackFillRate, getDerivedStats, scopedMult } from './derived';
import { TPS } from '../engine/loop';
import { attrValue, grantAttrXp } from './attributes';
import { checkDiscovery, grantSkillXp, isUnlocked } from './skills';
import { DARK_DODGE_PENALTY, DARK_MISS_CHANCE, darknessFactor } from './exposure';
import { itemName, unequipSlot } from './equipment';
import { effectiveStyleDef, effectiveStyleId } from './styles';
import { bumpStat } from './achievements';
import { monsterTagSet } from './bestiary';
import { createItem, grantRune, weaponRuneBonuses } from './runes';
// Mutual with alchemy.ts, which needs this module's feed/monsterSlice/sweepDead
// to resolve a thrown flask. Safe both ways: neither side reads the other at
// module-evaluation time, only inside functions.
import { spendCoating } from './alchemy';
import { evaluateTrigger } from './triggers';
import { grantMaterial } from './disciplines';
import { QUALITY_TIERS } from '../data/quality.data';
import { ELEMENTAL_TYPES, SIZE_LADDER, sizeRank } from '../types';
import { monsterSizeRank } from './bestiary';
import { holdNextFight } from './huntrest';
import { subsystemUnlocked } from './unlocks';
import {
  GENE_ACTIVE,
  SPLIT_SPLASH,
  armGrants,
  atGrade,
  chromosomeOf,
  expressedGene,
  expressedMain,
  geneAbility,
  geneAbilityBase,
  playerSizeRank,
  isSealed,
  bearerGrants,
  perTargetInflictIntensity,
  priceGeneAbility,
  type GeneSpec,
  refuteCast,
  routedType,
  spokenAs,
} from './mutagens';

/**
 * How many size steps `defId` is BELOW the player, floored at zero.
 *
 * Floored, deliberately: `vsSmaller` and `fromSmaller` describe being the
 * bigger thing in the room, and nothing gets anything from them against
 * something its own size or larger. The FLOOR is the rule — which is why there
 * has to be a second function rather than a signed one.
 */
function stepsSmaller(state: GameState, defId: string): number {
  return Math.max(0, playerSizeRank(state) - monsterSizeRank(defId));
}

/**
 * The same gap read from the monster's side: how many steps the PLAYER is below
 * it, floored at zero.
 *
 * The pair used to run one direction only, because only the player could be the
 * bigger thing — a monster's `vsSmaller` and `fromSmaller` had nowhere to be
 * read, so a gene that made its bearer loom over small things did so only while
 * a player wore it (docs/plans/monster-stat-parity.md).
 *
 * Both floors are independent on purpose: at equal size both answer 0, so
 * neither side bullies the other and there is no discontinuity at the crossover.
 */
function stepsLarger(state: GameState, defId: string): number {
  return Math.max(0, monsterSizeRank(defId) - playerSizeRank(state));
}

/**
 * Give back a share of every technique's REMAINING cooldown, because the swing
 * missed.
 *
 * A share rather than flat ticks, so it is worth the same to a long cooldown as
 * a short one and cannot be farmed by stacking cheap techniques. Only what is
 * still ticking is touched — a technique already available gains nothing, and
 * nothing is ever pushed below zero.
 */
/**
 * A swing that missed, landing anyway for a share of itself.
 *
 * A miss produced no damage path at all before this — it fed a line and the
 * exchange was over — so this grows one rather than extending anything. Three
 * things come out of it beyond the damage, and they are the point:
 *
 *  - `onGraze` is stamped as its own trigger event, so a technique can be built
 *    to MISS on purpose and chain off it. Not a flavour of `onHit`: a build
 *    that never misses should never see it.
 *  - `combat:grazes` counts every one.
 *  - `kills:graze` counts the ones that finished the job, so an achievement can
 *    ask for kills that never landed cleanly.
 *
 * Returns true when the graze killed, in which case the caller must stop —
 * `onKill` has already cleared the slot.
 */
export function landGraze(
  state: GameState,
  bus: EventBus,
  monster: MonsterInstance,
  active: ReturnType<typeof pickActive>,
  /**
   * What share of the body's damage went past — 1 for a swing of the hands.
   * A floating blade carries only its own share (see `handSwingShare`), and a
   * graze that ignored it had one blade of six going wide for the whole body's
   * worth, which is more than the same blade would have landed for on a hit.
   */
  share = 1,
): boolean {
  const vs = getDerivedStats(state, monsterTagSet(monster.defId));
  if (vs.graze <= 0 || monster.hp <= 0) return false;

  // The technique's own multiplier rides along: a heavy swing grazes heavily.
  // That is what "the bonus damage lands as a graze" means for the genes that
  // ask for it.
  const move = active?.technique ? resolvedMove(state, active.technique) : null;
  const raw = vs.damage * share * (move?.damageMult ?? 1) * vs.graze;
  if (raw <= 0) return false;

  const type = playerDamageType(state);
  const slice = monsterSlice(monster, type, 'Graze', raw, vs.penetration);
  const dealt = Math.max(1, Math.round(slice.dealt));
  monster.hp -= dealt;
  noteOutgoing(state, dealt);
  // A graft harvest is damage the blow EARNED; `enemyTookDamage` reports it and
  // hands it back for the caller to apply. Discarding the return emptied the
  // ledger and burned nothing — three callers applied it and this one did not.
  const harvested = enemyTookDamage(state, monster, new Map([[type, dealt]]));
  if (harvested > 0) {
    const burned = Math.max(1, Math.round(harvested));
    monster.hp -= burned;
    noteOutgoing(state, burned);
  }

  markCombatEvent(state, 'onGraze');
  bumpStat(state, bus, 'combat:grazes');
  feed(state, `💢 Your swing goes wide but the edge still tells — ${dealt} ${type}.`);
  /*
   * A GRAZE DOES NOT SPEND THE COATING, and does not carry its riders.
   * Decided 2026-08-10, having been true by omission until then.
   *
   * The case for spending is that the edge demonstrably touched — a graze deals
   * real damage and fires `enemyTookDamage` like any hit. The case against wins
   * on what it feels like to own the resource: a coating is 5 blows at C grade,
   * and burning one on the swing that missed is the worst moment the system can
   * hand you. An oil is delivered by a strike that lands; a graze is precisely
   * the blow that did not. Nothing to change here — this comment IS the
   * decision, so the next reader does not have to guess whether it was one.
   */

  if (monster.hp <= 0) {
    bumpStat(state, bus, 'kills:graze');
    onKill(state, bus, 0);
    return true;
  }
  return false;
}

export function shedCooldownsOnMiss(state: GameState): void {
  const share = getDerivedStats(state).missRefund;
  const c = state.combat;
  if (share <= 0 || !c) return;
  for (const [id, left] of Object.entries(c.cooldowns)) {
    if (left > 0) c.cooldowns[id] = Math.max(0, left - left * share);
  }
}

/**
 * A MONSTER's swing that was dodged, landing anyway for a share of itself —
 * the mirror of `landGraze` (docs/plans/monster-stat-parity.md).
 *
 * Returns what it dealt, or 0. The caller owns the feed line, because the
 * message has to change: "you dodge" and "you dodge, and it still tells" are
 * different sentences and the second must not be a second line under the first.
 *
 * ⚠️ Three deliberate differences from the player's:
 *
 *  - **No trigger event.** The player's stamps `onGraze` so a technique can be
 *    built to miss on purpose. Nothing consumes a "you were grazed" event, and
 *    stamping one nothing reads is the legible lie docs/MUTAGENS.md §11 warns
 *    about. Add the event when something wants it.
 *  - **No technique multiplier.** The specimen's move is resolved further down,
 *    after the blow survives dodge and parry, so at this point there is no
 *    move to read. A graze is the plain body.
 *  - **`onDodge` has already fired**, and stays fired. The footwork DID work;
 *    what got through went past it.
 */
function landMonsterGraze(
  state: GameState,
  e: MonsterInstance,
  es: ReturnType<typeof monsterStats>,
  positionMult: number,
): number {
  if (es.graze <= 0) return 0;
  const raw = es.damage * positionMult * es.graze;
  if (raw <= 0) return 0;
  const type = MONSTERS[e.defId]?.damageType ?? 'bludgeoning';
  const slice = incomingSlice(
    getDerivedStats(state),
    type,
    e.name,
    raw,
    0,
    MONSTERS[e.defId]?.range === 'ranged',
  );
  const dealt = Math.max(1, Math.round(slice.dealt));
  damagePlayer(state, dealt, type, { key: `monster:${e.defId}`, label: e.name, icon: e.icon });
  return dealt;
}

// ---------- Weapons the mind holds ----------

/**
 * The share of your weapon damage that is out there floating rather than in
 * your hands — the exact complement of `handSwingShare`, so the two clocks
 * between them pay out one body's worth of damage and never one and a half.
 */
function floatShare(state: GameState): number {
  const grants = bearerGrants(state);
  const held = heldGrips(state, grants);
  return held === 0 ? 0 : floatingSlots(state, grants).length / held;
}

/**
 * The most Wisdom can add to the mind's grip, however deep it runs.
 *
 * ⚠️ THIS MUST STAY BOUNDED. It shipped as a flat `1 + wis × 0.01` and that was
 * a mistake of exactly the kind docs/MUTAGENS.md §7 names: an uncapped MAGNITUDE.
 * Damage is not a number, it is a product — a real six-armed build was running
 * base 233 through twenty-two multiplier sources for ×92.7 — so anything that
 * multiplies the whole stat compounds with all of it. At Wisdom 193 the linear
 * version was handing out ×2.93 on top of that, and Wisdom has no ceiling.
 *
 * The two constants are the steering: CAP is how much it is ever worth, HALF is
 * how much Wisdom buys half of that. Raise either to make the mind matter more
 * without ever making it matter without limit.
 */
export const TELEKINETIC_GRIP_CAP = 0.5;
/** Wisdom at which the grip has reached half of `TELEKINETIC_GRIP_CAP`. */
export const TELEKINETIC_GRIP_HALF = 120;

/**
 * The floating run's synthetic id. The blades are not a status, so there is
 * nothing to watch expire — the run is closed on a completed ROTATION instead
 * (`settleBladeRun`), which is what makes a settled line mean "every blade took
 * a swing, and here is what that cost" rather than an arbitrary stretch of fight.
 */
const BLADE_RUN = 'blades';

/**
 * HOW HARD THE MIND HOLDS, as a multiplier on what a floating blade lands.
 *
 * Wisdom AMPLIFIES rather than replaces, and the distinction is the whole
 * identity: a floating strike is still an ordinary swing of whatever that grip
 * is holding, so its edge, its enchant, its runes and its oil all go on
 * mattering. What Wisdom buys is the grip itself — which is why it belongs to
 * `telekinetic:N` rather than to any one gene, and why a fighting style that
 * lifts a blade with the mind gets exactly the same term.
 */
export function telekineticGrip(state: GameState): number {
  // Saturating, not linear: every point of Wisdom still buys something, and no
  // amount of it ever buys more than the cap. The curve is the shape the
  // "incremental escalation" the game wants asks for — slow compounding that
  // stays steerable — rather than a flat rate that eventually eats the game.
  const wis = Math.max(0, attrValue(state, 'wis'));
  return 1 + TELEKINETIC_GRIP_CAP * (wis / (wis + TELEKINETIC_GRIP_HALF));
}

/**
 * One strike from a floating grip.
 *
 * Everything the hands' swing gets is deliberately absent: no exertion, no
 * stamina, no position, no riposte, no technique, no parry to answer. A weapon
 * held by the mind is not fencing — it rolls to hit, and it lands. What it does
 * keep is what belongs to the EDGE rather than to the fencer: the graze, the
 * crit, its own enchant, its own runes, and the oil wiped along it.
 *
 * Returns true when the fight ended here.
 */
function floatingSwing(state: GameState, bus: EventBus): boolean {
  const c = state.combat;
  if (!c) return false;
  const monster = c.enemies[0];
  if (!monster || monster.hp <= 0) return false;
  const slots = floatingSlots(state, bearerGrants(state));
  if (!slots.length) return false;

  // The blades take turns, so a mixed rack cycles through every edge it has
  // instead of favouring whichever slot happens to sort first.
  if (!c.floating) c.floating = { bar: 0, nth: 0, run: 0 };
  const slot = slots[c.floating.nth % slots.length];
  const item = state.equipment[slot];
  const def = item ? ITEMS[item.defId] : undefined;
  if (!item || !def) return false;

  /*
   * Which line this strike folds into.
   *
   * The fold window is ONE FULL ROTATION of the rack: a line accumulates until
   * every blade has struck once, then closes and a fresh one opens. That makes
   * the unit of the feed a thing the player can reason about — "my four blades
   * each took a swing, and here is what that cost the wolf" — instead of an
   * arbitrary stretch of fight that happened not to be interrupted.
   *
   * A volley is announced, so the strikes it fires fold UNDER that announcement
   * rather than into the background tally the blades keep between volleys —
   * otherwise the ability says it fired and the damage turns up somewhere else,
   * credited to nobody.
   */
  const run = {
    group: bladeGroup(c, !!c.volley),
    prefix: c.volley
      ? `🗡️ ${c.volley.name} — the blades fall on the ${monster.name}:`
      : `🌀 Your floating arms work the ${monster.name}:`,
  };
  // Advance the rack now that this strike's line is settled — the group string
  // above is already captured, so every exit path below leaves the next blade
  // queued, and a wrap opens the next line.
  c.floating.nth = (c.floating.nth + 1) % slots.length;
  if (c.floating.nth === 0) c.floating.run += 1;

  const vs = getDerivedStats(state, monsterTagSet(monster.defId));
  const dmgType = playerDamageType(state, slot);
  const blind = statusDisadvantage(state);
  const dark = darknessFactor(state);
  const sure =
    armGrants(state, 'attacks', 'ignores_dodge') || magnetBypassesDodge(state, monster, dmgType);
  const evaded = !sure && rollAgainst(state, monsterStats(monster).dodge, blind);
  const fumbled =
    !evaded && rollAgainst(state, statusMissChance(state) + DARK_MISS_CHANCE * dark, blind);
  if (evaded || fumbled) {
    // An edge that went past can still open something up — the same graze the
    // hands get, because the edge does not know who was holding it. It carries
    // this blade's share and the mind's grip, exactly as a hit would.
    if (landGraze(state, bus, monster, null, floatShare(state) * telekineticGrip(state))) {
      return true;
    }
    feedFloating(state, {
      group: run.group,
      prefix: run.prefix,
      tally: [{ label: 'wide', qty: 1 }],
      ids: [BLADE_RUN],
    });
    return false;
  }

  const penetration = vs.penetration;
  const share = floatShare(state);
  const grip = telekineticGrip(state);
  let hit = vs.damage * share * grip;
  const crit = procChance(state, PLAYER_CRIT, vs.crit);
  if (crit) hit *= vs.critDamage;
  hit *= 0.9 + rand(state) * 0.2;
  const raw = hit;
  const slices = new Map<string, DamageSlice>();
  const landed = monsterSlice(monster, dmgType, itemName(item), raw, penetration);
  addSlice(slices, landed);
  let total = landed.dealt;

  // This blade's own riders, read off THIS slot — the enchant on the sword out
  // to your left is not the enchant on the axe out to your right.
  const typed: { type: DamageType; value: number; source: string }[] = [];
  if (def.bonusDamage) typed.push({ ...def.bonusDamage, source: def.name });
  const runeBonus = weaponRuneBonuses(state, slot);
  for (const b of runeBonus.flat) typed.push(b as { type: DamageType; value: number; source: string });
  for (const b of runeBonus.pct) {
    typed.push({ type: b.type as DamageType, value: raw * b.value, source: b.source });
  }
  for (const b of typed) {
    const extra = monsterSlice(monster, b.type, b.source, b.value, penetration);
    addSlice(slices, extra);
    total += extra.dealt;
  }
  // One blow of oil per blow struck. Safe to spend here precisely BECAUSE the
  // floating grips share a clock: a rack of six lands one blow per period, the
  // same as a fist would, so a coating drains at the rate it was priced for.
  const oil = spendCoating(state);
  if (oil) {
    for (const b of oil.typed) {
      const extra = monsterSlice(
        monster,
        b.type,
        b.source,
        b.value,
        Math.min(0.95, penetration + (b.penetration ?? 0)),
      );
      addSlice(slices, extra);
      total += extra.dealt;
    }
  }

  const bite = statusIncomingDamageMult(monster);
  const dmg = Math.max(1, Math.round(total * bite));
  monster.hp -= dmg;
  noteOutgoing(state, dmg);
  // By TYPE, not by the blade's own type: this blow carried its enchant, its
  // runes and its oil, and the on-damage hooks are owed what actually landed.
  const harvested = enemyTookDamage(state, monster, dealtByType(slices));
  if (harvested > 0) {
    const burned = Math.max(1, Math.round(harvested));
    monster.hp -= burned;
    noteOutgoing(state, burned);
  }
  bumpStat(state, bus, 'combat:attacks');
  if (crit) {
    onCritLanded(state, monster, itemName(item));
    markCombatEvent(state, 'onCrit');
    bumpStat(state, bus, 'combat:crits');
  }
  if (oil?.inflicts && monster.hp > 0) {
    for (const app of oil.inflicts) applyStatus(state, monster, app, oil.name);
  }
  if (oil?.exhausted) feed(state, `🛢️ The last of the ${oil.name} wipes off your edge.`);

  /*
   * THE BLADES DO NOT GET LINES OF THEIR OWN.
   *
   * Folding was the first answer and it does not work here: `fold` only reaches
   * the NEWEST entry, and under Vashkara the bar reports "you are concentrating"
   * between one strike and the next, so every run was broken before it could
   * accumulate — one line per strike, exactly the spam folding was meant to
   * stop. A floating run is drawn against whatever line is newest instead, so
   * nothing interleaving can break it, and it settles when the rack completes a
   * rotation (see `tickFloatingWeapons`).
   *
   * It carries its working with it: `slices` names every edge, enchant, rune
   * and oil that landed, accumulated across the run by `mergeReport`.
   */
  const steps: DamageStep[] = [{ label: 'Damage', value: vs.damage }];
  // The same sentence the hands' swing pushes, so the two lines read as the two
  // halves of one split rather than as two unrelated penalties.
  if (share !== 1) steps.push({ label: 'Held by the mind, not the hand', mult: share });
  if (grip !== 1) steps.push({ label: 'How hard the mind holds', mult: grip });
  if (crit) steps.push({ label: 'Critical hit', mult: vs.critDamage });
  steps.push({ label: 'Swing variance ±10%' });
  if (bite !== 1) steps.push({ label: 'Caught off guard', mult: bite });
  feedFloating(state, {
    group: run.group,
    prefix: run.prefix,
    tally: [
      { label: 'damage', qty: dmg, style: 'amount' },
      ...(crit ? [{ label: 'crit', qty: 1 }] : []),
    ],
    ids: [BLADE_RUN],
    damage: {
      label: c.volley?.name ?? 'Your floating arms',
      target: monster.name,
      steps,
      slices: [...slices.values()],
      hits: 1,
      crit,
      total: dmg,
    },
  });

  grantAttrXp(state, bus, 'wis', 1);
  grantSkillXp(state, bus, ['combat', 'geneshaping'], 2 + monster.level * 0.25);
  if (monster.hp <= 0) {
    onKill(state, bus, 0);
    return true;
  }
  return false;
}

/**
 * The floating grips' turn, every tick. Returns true when the fight ended.
 *
 * A volley in flight jumps the queue: it is the same strike, fired `left` times
 * over its window, so nothing about a volley needs its own damage rule.
 */
function tickFloatingWeapons(state: GameState, bus: EventBus, stats: DerivedStats): boolean {
  const c = state.combat;
  if (!c) return false;
  if (!floatingSlots(state, bearerGrants(state)).length) {
    // Whatever was floating is not floating now — a swapped centromere, a
    // dropped blade. Drop the clock with it rather than banking its progress,
    // and settle whatever the blades had already run up.
    settleBladeRun(state, c);
    c.floating = undefined;
    c.volley = undefined;
    return false;
  }
  if (c.volley) {
    c.volley.acc += c.volley.rate;
    while (c.volley && c.volley.acc >= 1 && c.volley.left > 0) {
      c.volley.acc -= 1;
      c.volley.left -= 1;
      if (floatingSwing(state, bus)) return true;
      settleBladeRun(state, c);
    }
    if (c.volley && c.volley.left <= 0) {
      c.volley = undefined;
      // The volley's own line closes with the volley, whatever the rack was
      // mid-way through — it was announced as one event and reads as one.
      settleFloating(state, bladeGroup(c, true));
    }
  }
  if (!c.floating) c.floating = { bar: 0, nth: 0, run: 0 };
  c.floating.bar += attackFillRate(stats);
  if (c.floating.bar >= stats.actionBar) {
    c.floating.bar -= stats.actionBar;
    if (floatingSwing(state, bus)) return true;
    settleBladeRun(state, c);
  }
  return false;
}

/** Which run this strike belongs to — the volley's, or the background rack's. */
function bladeGroup(c: CombatState, volleying: boolean): string {
  return volleying ? `telekinesis:volley:${c.floating?.run ?? 0}` : `telekinesis:${c.floating?.run ?? 0}`;
}

/**
 * Close the blades' line once the rack has come all the way round.
 *
 * `floatingSwing` advances `nth` and bumps `run` on the wrap, so a run number
 * that has moved on is the signal that the previous one is finished — every
 * blade in the rack took its swing and the line can be frozen where it stands.
 */
function settleBladeRun(state: GameState, c: CombatState): void {
  const run = c.floating?.run ?? 0;
  for (const group of state.floatingFeed?.map((f) => f.group) ?? []) {
    if (!group.startsWith('telekinesis:')) continue;
    const n = Number(group.slice(group.lastIndexOf(':') + 1));
    if (Number.isFinite(n) && n < run) settleFloating(state, group);
  }
}
import { NO_EXERTION, attackUpkeep, drawStamina, exert, rollExtraHits } from './stamina';
import { floatingSlots, handSwingShare, heldGrips } from './wield';
import {
  MONSTER_ACTION_BAR,
  MONSTER_RESIST_CAP,
  type MonsterStats,
  innateArmor,
  mindInDebt,
  monsterMind,
  monsterStats,
  rollMonsterAttrs,
  scaledMonsterAttrs,
  statsFromAttrs,
} from './monsterStats';
import { clockOf } from './clock';
import { naturalDarkness } from './exposure';
import { DOUSING_TYPES, damagePlayer, heal, isAlive, setHpAfterDefeat } from './health';
import { availableMax, resourceValue, spendResource } from './resources';
import {
  findSpell,
  grantCastWordXp,
  leadingElement,
  preparedSpells,
  resolveSpellFor,
  specForSource,
  undoWorking,
  workingSignature,
} from './spellcraft';
import {
  applyTechniqueEquipment,
  checkTechniqueLearning,
  knownTechniques,
  declaredPositions,
  openEntry,
  positionDodgeMult,
  positionIncomingMult,
  readyableSpell,
  releaseReadiedSpell,
  setPosition,
  spellIsHeld,
  recordExecution,
  recoverGroundedWeapon,
  resolvedMove,
  techniqueArmed,
  techniqueExit,
  weaponStateGate,
} from './martial';
import { NEUTRAL_POSITION, POSITIONS, TECHNIQUES } from '../data/martial.data';
import { OTHERS_POWER, composeArcane, counterEfficiency } from './arcane';
import { HUNGER_PER_WISDOM } from '../data/statuses.data';
import {
  amplifyStatuses,
  applyStatus,
  consumeMagnetCharge,
  magnetBypassesDodge,
  magnetCritChance,
  applyStatuses,
  consumeSkippedAction,
  dueGraftSpread,
  findStatus,
  fireStatusEvent,
  graftHarvest,
  hasStatus,
  removeStatus,
  statusDisplacedExit,
  tendOnDamage,
  statusBarDamage,
  statusBlocks,
  statusBlocksRangedType,
  statusDisadvantage,
  statusIncomingDamageMult,
  statusIncomingMissChance,
  statusMissChance,
  statusPacifiesFlankers,
  statusRetaliation,
  statusReversesBar,
  statusesOf,
  statusNegativeHeadroom,
  stripStatuses,
  tickStatuses,
} from './statuses';
import { deityRelation } from './deities';
import { appendFeed, feedFloating, feedRepeat, floatingRun, settleFloating } from './log';
import { retreatToSafety } from './safety';
import {
  beginFight,
  endFight,
  noteAbsorbed,
  noteDodge,
  noteOutgoing,
  noteParry,
} from './ledger';
import { killXp } from './levels';
import { text } from '../text/log';

const RESPAWN_DELAY = 15;

export { MONSTER_ACTION_BAR };

/**
 * Position × reach. Melee belong up front; ranged belong at the back. Being out
 * of place costs you: melee swinging from the back rows land slower and softer,
 * while a ranged attacker jammed into the front is repeatedly jostled (its bar
 * progress shaved, capped per fill). All values are tunable knobs.
 */
export const POSITION_MODS: Record<
  'front' | 'back',
  Record<MonsterRange, { damage: number; fill: number; stunPerTick: number; stunCap: number }>
> = {
  front: {
    melee: { damage: 1, fill: 1, stunPerTick: 0, stunCap: 0 },
    ranged: { damage: 1, fill: 1, stunPerTick: 12, stunCap: 300 },
  },
  back: {
    melee: { damage: 0.6, fill: 0.6, stunPerTick: 0, stunCap: 0 },
    ranged: { damage: 1, fill: 1, stunPerTick: 0, stunCap: 0 },
  },
};

/**
 * Push a line to the rolling fight log. It lives on the state (not the
 * encounter) so recent lines stay readable while hunting for the next monster.
 * A line about a damage number carries the maths behind it, for its tooltip.
 */
export function feed(state: GameState, line: string, damage?: DamageReport): void {
  appendFeed(state, damage ? { text: line, damage } : { text: line });
}

/**
 * Roll a chance of something going wrong. With `disadvantage` it is rolled
 * twice and the worse outcome kept — the standard "roll twice, take the lower"
 * shape, expressed as failing if EITHER roll fails.
 */
function rollAgainst(state: GameState, badChance: number, disadvantage: boolean): boolean {
  if (badChance <= 0) return false;
  const first = chance(state, badChance);
  if (!disadvantage) return first;
  return first || chance(state, badChance);
}

/** Stamp a trigger event so `event`-gated skills can react to it. */
export function markCombatEvent(state: GameState, event: string): void {
  if (state.combat) state.combat.events[event] = state.totalTicks;
}

// ---------- Monster generation ----------

/** Roll a value uniformly within an inclusive range. */
function rollRange(state: GameState, range: [number, number]): number {
  return range[0] + rand(state) * (range[1] - range[0]);
}

/** Where a spot remembers a `once` kill (see SpotEncounter.once). */
export const slainKey = (spotId: string, monsterId: string): string =>
  `slain:${spotId}:${monsterId}`;

/** Where a spot with a `fightLimit` counts its wins. */
export const fightsKey = (spotId: string): string => `fights:${spotId}`;

/**
 * Where a spot remembers its BOSS going down (see SpotEncounter.boss). One
 * latch shared by every variant boss the spot rolls — the clock's keeper, the
 * ambush champion — so a floor clear or quest reads a single counter and the
 * AND-only condition language never needs an OR.
 */
export const bossKey = (spotId: string): string => `boss:${spotId}`;

/** Night as the darkness system already defines it: dusk through dawn. */
function isNightNow(state: GameState): boolean {
  return naturalDarkness(clockOf(state.totalTicks).hour) >= 0.5;
}

/**
 * Player power against this spawn's own, priced the way the bestiary prices a
 * specimen: the entry's level-band midpoint, a plain roll of its tier. The
 * scalar is damage × max HP on both sides — crude on purpose; it is a spawn
 * gate, not a balance oracle, and the window it feeds is wide.
 */
export function encounterPowerRatio(state: GameState, e: SpotEncounter): number {
  const def = MONSTERS[e.monsterId];
  if (!def) return 0;
  const tier = TIERS[def.tier];
  const mult = (tier.multiplierRange[0] + tier.multiplierRange[1]) / 2;
  const level = (e.level[0] + e.level[1]) / 2;
  const theirs = statsFromAttrs(
    scaledMonsterAttrs(def, level, mult),
    undefined,
    innateArmor(e.monsterId),
    def.regen ?? 0,
    level,
  );
  const mine = getDerivedStats(state);
  const power = (s: { damage: number; maxHp: number }) => Math.max(1, s.damage * s.maxHp);
  return power(mine) / power(theirs);
}

/**
 * The encounter-table lines the spot can still roll, given what has happened:
 * `once` entries whose kill is on record are gone, and gated entries wait for
 * their conditions. This — not `spot.encounters` — is what spawning reads.
 */
export function eligibleEncounters(state: GameState, spot: SpotDef): SpotEncounter[] {
  const night = isNightNow(state);
  return (spot.encounters ?? []).filter((e) => {
    if (e.once && (state.stats[slainKey(spot.id, e.monsterId)] ?? 0) > 0) return false;
    // The clock decides which keeper holds the floor tonight.
    if (e.daypart && (e.daypart === 'night') !== night) return false;
    // The ambush window: an overtuned spawn that appears only while the fight
    // would be tough-but-possible, and vanishes once outgrown — it can never
    // be farmed from above, and never flattens someone it would simply kill.
    if (e.window) {
      const ratio = encounterPowerRatio(state, e);
      if (ratio < e.window.min || ratio > e.window.max) return false;
    }
    return !e.requires || conditionsMet(state, e.requires);
  });
}

/**
 * True when the spot's fight budget is spent. A cleared spot spawns nothing
 * and — the point of clearing it — stops forcing fights on arrival.
 */
export function spotCleared(state: GameState, spot: SpotDef): boolean {
  return !!spot.fightLimit && (state.stats[fightsKey(spot.id)] ?? 0) >= spot.fightLimit;
}

export function spawnMonster(
  state: GameState,
  spot: SpotDef,
  /**
   * Mint a specific monster (escorts) instead of rolling the spot table.
   * `plain` also skips the modifier and rarity rolls — a staged fight is the
   * one the keeper described, not a champion that happened to roll.
   */
  override?: { monsterId: string; level: number; plain?: boolean },
): MonsterInstance {
  const table = eligibleEncounters(state, spot);
  // A rare thing that lives here is a drop like any other — "I have hunted this
  // ravine for an hour and never seen the hawk" is the same complaint as a fang
  // blade that will not fall. Keyed per spot: the ravine's hawk is not the
  // moor's. Escorts (`override`) roll nothing, so they pay nothing.
  const pick = override
    ? { monsterId: override.monsterId, level: [override.level, override.level] as [number, number] }
    : mercyPick(state, table, (e, rate) => (mercyTracked(rate) ? `spawn:${spot.id}:${e.monsterId}` : null));
  const def = MONSTERS[pick.monsterId];
  const level = randInt(state, pick.level[0], pick.level[1]);

  // Three classification axes: intrinsic tier (rolled multiplier within the
  // def's tier range), rolled modifier (demiboss/boss/aberrant), rolled rarity.
  const tier = TIERS[def.tier];
  const tierMult = rollRange(state, tier.multiplierRange);
  const modifierWeights = spot.modifierWeights
    ? Object.entries(spot.modifierWeights).map(([id, weight]) => ({ id, weight: weight! }))
    : MODIFIER_WEIGHTS;
  // Both classification rolls drought too, and both are protected — but on
  // different keys, because they are different complaints. A boss is something
  // this SPOT is refusing to hand over; an epic is the world at large refusing,
  // since the rarity weights are global and every fight anywhere rolls them.
  const modifier = override?.plain
    ? MODIFIER_TIERS.normal
    : MODIFIER_TIERS[
        mercyPick(state, modifierWeights, (e, rate) => (mercyTracked(rate) ? `mod:${spot.id}:${e.id}` : null)).id
      ];
  const modifierMult = rollRange(state, modifier.multiplierRange);
  const rarity = override?.plain
    ? RARITIES.common
    : RARITIES[mercyPick(state, RARITY_WEIGHTS, (e, rate) => (mercyTracked(rate) ? `rarity:${e.id}` : null)).id];

  const statMult = tierMult * modifierMult * rarity.statMult;
  const rewardMult = tier.rewardMult * modifier.rewardMult * rarity.statMult;

  const nameParts = [rarity.name, modifier.name, def.name].filter(Boolean);
  // Everything the thing can do is derived from these; the only combat number
  // it stores is the HP it has left (see systems/monsterStats.ts).
  const attrs = rollMonsterAttrs(state, def, level, statMult);
  const spawned: MonsterInstance = {
    defId: def.id,
    name: nameParts.join(' '),
    icon: def.icon,
    level,
    tier: def.tier,
    modifier: modifier.id as ModifierTierId,
    rarity: rarity.id as RarityId,
    mutation: null, // milestone 2
    attrs,
    hp: statsFromAttrs(attrs).maxHp,
    statuses: [],
    range: def.range ?? 'melee',
    bar: 0,
    stunSpent: 0,
    xp: def.xp * (1 + 0.35 * (level - 1)) * rewardMult,
    gold: def.gold
      ? Math.round(randInt(state, def.gold[0], def.gold[1]) * level * tier.rewardMult * modifier.rewardMult)
      : 0,
  };
  // What it IS, as opposed to what it does to you. See MonsterDef.wears — the
  // monster-side mirror of a gene's `confers`, which only ever dresses the
  // player. Applied here so a body's rule is on it before its first tick.
  for (const app of def.wears ?? []) applyStatus(state, spawned, app, def.name);
  return spawned;
}

// ---------- Group composition ----------

/** Fallback distribution: most encounters are still a lone monster. */
const DEFAULT_GROUP_WEIGHTS: Partial<Record<number, number>> = { 1: 70, 2: 18, 3: 8, 4: 3, 5: 1 };

/**
 * Feed whatever is fasting in this fight.
 *
 * Called where a hostile action is TAKEN, not where one connects: the design's
 * wording is "attacks or casts", not "hits", and a swing that finds nothing was
 * still an appetite. An action refused outright — a held bar, a fast declining
 * its own swing — is not an appetite, so both gates sit ahead of this.
 *
 * Intensity carries the IMPARTER's wisdom, which is what makes Anupama's own
 * fast bite harder than one a player hands out, with no second condition and
 * nothing here having to know which side it is looking at.
 *
 * THE BITE LANDS NEXT TICK, not inside the action. `tickPlayerStatuses` runs
 * ahead of `tickCombat` (actions.ts), and reordering that to save 100ms would
 * cost the tick loop more than it is worth. One visible consequence, accepted
 * when this was decided: a blow that ends the fight is never paid for, because
 * winning clears the hunger with it.
 */
function feedTheFast(state: GameState, actor: GameState | MonsterInstance): void {
  const combat = state.combat;
  if (!combat) return;
  // Every fasting body present takes its due. Two of them is two applications,
  // not a contest — hunger sums, so nothing here has to rule on whose fast is
  // the real one.
  if (hasStatus(state, 'fasting')) {
    applyStatus(
      state,
      actor,
      { id: 'hunger_anupama', intensity: attrValue(state, 'wis') * HUNGER_PER_WISDOM },
      'your fast',
    );
  }
  for (const e of liveEnemies(combat)) {
    if (!hasStatus(e, 'fasting')) continue;
    applyStatus(
      state,
      actor,
      { id: 'hunger_anupama', intensity: e.attrs.wis * HUNGER_PER_WISDOM },
      e.name,
    );
  }
}

/** The live enemy in the centre slot — the only one the player can hit. */
export function frontEnemy(combat: CombatState): MonsterInstance | null {
  return combat.enemies[0];
}

/** Enemies still standing, in slot order. */
export function liveEnemies(combat: CombatState): MonsterInstance[] {
  return combat.enemies.filter((e): e is MonsterInstance => e !== null);
}

/**
 * How many show up: the leader's own rule wins, then the area's distribution,
 * then the global default. min/max clamp whatever the weights produce.
 */
function rollGroupSize(state: GameState, spot: SpotDef, leader: MonsterDef): number {
  const spec = leader.group;
  const weights = spec?.weights ?? spot.groupWeights ?? DEFAULT_GROUP_WEIGHTS;
  const entries = Object.entries(weights)
    .map(([size, weight]) => ({ size: Number(size), weight: weight ?? 0 }))
    .filter((e) => e.weight > 0);
  const rolled = entries.length ? weightedPick(state, entries).size : 1;
  const min = spec?.min ?? 1;
  const max = spec?.max ?? ENCOUNTER_SLOTS;
  return Math.max(1, Math.min(ENCOUNTER_SLOTS, Math.max(min, Math.min(max, rolled))));
}

/**
 * Roll a full formation. The leader comes from the spot table; the rest are its
 * declared escorts (at the leader's level) or fresh rolls from the spot table.
 * Melee take the front slot where possible — ranged fight better from the back.
 */
export function spawnGroup(state: GameState, spot: SpotDef): (MonsterInstance | null)[] {
  const leader = spawnMonster(state, spot);
  const size = rollGroupSize(state, spot, MONSTERS[leader.defId]);
  const escorts = MONSTERS[leader.defId].escorts;

  // Who may fill the remaining slots: not encounter LEADERS (they demand a
  // minimum squad of their own) and not SOLITARY monsters (max 1 means it never
  // travels with company — as a follower or otherwise). Drawn from the
  // ELIGIBLE table, so a slain `once` boss cannot ride back in as an escort.
  const filler = eligibleEncounters(state, spot).filter((e) => {
    const spec = MONSTERS[e.monsterId].group;
    return (spec?.min ?? 1) <= 1 && (spec?.max ?? ENCOUNTER_SLOTS) > 1;
  });

  const members: MonsterInstance[] = [leader];
  for (let i = 1; i < size; i++) {
    if (escorts?.length) {
      members.push(
        spawnMonster(state, spot, {
          monsterId: escorts[randInt(state, 0, escorts.length - 1)],
          level: leader.level,
        }),
      );
    } else if (filler.length) {
      const pick = weightedPick(state, filler);
      members.push(
        spawnMonster(state, spot, {
          monsterId: pick.monsterId,
          level: randInt(state, pick.level[0], pick.level[1]),
        }),
      );
    } else {
      members.push(spawnMonster(state, spot));
    }
  }

  // Formation pass: put a melee up front if the group has one.
  const frontIndex = members.findIndex((m) => m.range === 'melee');
  if (frontIndex > 0) {
    [members[0], members[frontIndex]] = [members[frontIndex], members[0]];
  }

  const slots: (MonsterInstance | null)[] = Array(ENCOUNTER_SLOTS).fill(null);
  members.forEach((m, i) => (slots[i] = m));
  return slots;
}

function startEncounter(
  state: GameState,
  bus: EventBus,
  spot: SpotDef,
  forced = false,
  enemies: (MonsterInstance | null)[] = spawnGroup(state, spot),
): void {
  state.combat = {
    enemies,
    ...(enemies.some((e) => e?.defId === TOLL_GOLEM) ? { introTicks: 30 } : {}),
    playerBar: 0,
    momentum: 0,
    position: NEUTRAL_POSITION,
    cooldowns: {},
    buffs: [],
    events: {},
    ...(forced ? { forced: true } : {}),
  };

  // The road in spends its opening on this first meeting (see ApproachSpec):
  // conditions laid on the formation — and on you — before anyone has swung.
  const opening = state.pendingApproach;
  if (opening?.spot === spot.id) {
    state.pendingApproach = null;
    let told = false;
    for (const e of liveEnemies(state.combat)) {
      for (const app of opening.enemies) told = !!applyStatus(state, e, app, 'your approach') || told;
    }
    if (told) feed(state, `🥷 Your approach catches them cold!`);
    // What the road did to YOU is still something done to you — wading in wet
    // answers to water resistance the same as a spell would.
    for (const inst of applyStatuses(
      state,
      state,
      opening.self,
      'the way in',
      getDerivedStats(state),
    )) {
      const sdef = STATUSES[inst.id];
      if (sdef && !sdef.hidden) feed(state, `${sdef.icon} You arrive ${sdef.name.toLowerCase()}!`);
    }
  }

  // Opening tempo: a fight that begins on enemies who have not registered it
  // hands you the first move — your bar starts one tick short of full.
  if (
    liveEnemies(state.combat).some((e) =>
      statusesOf(e).some((s) => STATUSES[s.id]?.opensTempo),
    )
  ) {
    const stats = getDerivedStats(state);
    state.combat.playerBar = Math.max(0, stats.actionBar - attackFillRate(stats));
  }

  markCombatEvent(state, 'onEncounterStart');
  beginFight(state, enemies);
  const group = liveEnemies(state.combat);
  // The bestiary counts sightings per location — seeing is not killing.
  bus.emit({ type: 'encounter', spot: spot.id, monsterIds: group.map((m) => m.defId) });
  const lead = group[0];
  const notable = group.some((m) => m.modifier !== 'normal' || m.rarity !== 'common');
  if (notable || group.length > 1) {
    const what = group.length > 1 ? `${lead.name} and ${group.length - 1} more` : lead.name;
    bus.emit({
      type: 'log',
      msg: text(group.length > 1 ? 'combat.appear_group' : 'combat.appears', { what, level: lead.level }),
      kind: 'combat',
    });
  }
  feed(
    state,
    group.length > 1
      ? `${lead.icon} ${lead.name} (Lv ${lead.level}) and ${group.length - 1} others attack!`
      : `${lead.icon} ${lead.name} (Lv ${lead.level}) attacks!`,
  );
}

/** True while the live fight is one that refuses to be walked away from. */
export function inForcedFight(state: GameState): boolean {
  return !!state.combat?.forced;
}

/**
 * The unfleeable fight a spot (or the road into it) declares. Fired on
 * arrival by the travel code, never by the hunt loop — which is why it ticks
 * regardless of the selected activity (see tickAction) and why travel and
 * activity switches check `inForcedFight` before calling abandonCombat.
 */
export function startForcedFight(state: GameState, bus: EventBus, spot: SpotDef): void {
  // A cleared spot has nobody left to force anything; an all-gated table has
  // nobody yet. Either way arrival is just arrival.
  if (state.combat || spotCleared(state, spot) || !eligibleEncounters(state, spot).length) return;
  startEncounter(state, bus, spot, true);
  bus.emit({ type: 'log', msg: text('combat.ambushed'), kind: 'danger' });
  feed(state, `⚔️ No retreat — this fight ends on its feet or on yours.`);
}

/**
 * One named monster, alone, and no way out: the keeper's dare
 * (systems/training.ts). Pinned like an escort, with no rolled modifier or
 * rarity, so the fight is the one the player was warned about.
 */
export function startStagedFight(
  state: GameState,
  bus: EventBus,
  spot: SpotDef,
  monsterId: string,
  level: number,
): void {
  if (state.combat) abandonCombat(state);
  const slots: (MonsterInstance | null)[] = Array(ENCOUNTER_SLOTS).fill(null);
  slots[0] = spawnMonster(state, spot, { monsterId, level, plain: true });
  startEncounter(state, bus, spot, true, slots);
  feed(state, `⚔️ No retreat — this fight ends on its feet or on yours.`);
}

// ---------- Combat tags & rewards ----------

function combatTags(state: GameState): string[] {
  // Hunts start most fights; a forced arrival rides the same tags — an ambush
  // survived teaches the same craft as a fight sought out.
  const tags = ['combat', 'hunt'];
  const weapon = state.equipment.weapon;
  if (weapon) for (const t of ITEMS[weapon.defId]?.tags ?? []) tags.push(t);
  else tags.push('unarmed');
  // A shield is fought with too, so its family trains alongside the weapon's.
  const offhand = state.equipment.offhand;
  if (offhand) for (const t of ITEMS[offhand.defId]?.tags ?? []) tags.push(t);
  // Fighting in a stance is how its school skills manifest and level.
  tags.push(`style:${effectiveStyleId(state)}`);
  return tags;
}

// ---------- Typed damage ----------

const WEAPON_DAMAGE_TYPES: Record<string, DamageType> = {
  sword: 'slashing',
  greatsword: 'slashing',
  dagger: 'piercing',
  bow: 'piercing',
  spear: 'piercing',
  blunt: 'bludgeoning',
  staff: 'bludgeoning',
};

/**
 * Record which weapon family the player attacks with, once per family:
 * `used:<family>` flags and the `weapon:families` distinct count (purity
 * conditions like "only your first weapon" read the latter via statMax).
 * Bare-handed strikes are not a "weapon family" and don't count.
 */
function trackWeaponFamily(state: GameState, bus: EventBus): void {
  const weapon = state.equipment.weapon;
  if (!weapon) return;
  const tags = ITEMS[weapon.defId]?.tags ?? [];
  const family = tags.find((t) => t in WEAPON_DAMAGE_TYPES) ?? tags[0];
  if (!family || state.stats[`used:${family}`]) return;
  bumpStat(state, bus, `used:${family}`);
  bumpStat(state, bus, 'weapon:families');
}

/** The damage type of the player's weapon attacks (bare fists bludgeon). */
export function playerDamageType(state: GameState, slot: SlotId = 'weapon'): DamageType {
  /*
   * WHAT THE CHROMOSOME MADE OF YOUR SWING, before what is in your hand.
   *
   * The Attacks arm's heaviest arriving type REPLACES the weapon's own — a
   * rimed body swings cold whatever the blade is made of. Replacement rather
   * than addition is §7a's ruling: additive re-typing widens your coverage for
   * free, while replacement costs you against everything that resists the new
   * type, permanently and with no opt-out.
   *
   * This is the single seam the whole thing needed. Every ordinary blow, every
   * technique without a declared type, and the magnetism/dodge check all read
   * this one function, so re-routing a swing re-routes all of them at once.
   */
  const routed = routedType(state, 'attacks');
  if (routed) return routed;
  const weapon = state.equipment[slot];
  if (!weapon) return 'bludgeoning';
  for (const t of ITEMS[weapon.defId]?.tags ?? []) {
    const type = WEAPON_DAMAGE_TYPES[t];
    if (type) return type;
  }
  return 'bludgeoning';
}

/**
 * A SPECIES' fractional resistance to a damage type, clamped. This is the base
 * layer only — the bestiary's field notes and content tests want it, but a
 * blow landing on a live monster asks that monster (see `resistanceOf`), whose
 * conditions may have made it brittle since.
 */
export function monsterResistance(defId: string, type: DamageType): number {
  const res = MONSTERS[defId]?.resistances?.[type] ?? 0;
  return Math.max(-1, Math.min(MONSTER_RESIST_CAP, res));
}

/** A LIVE monster's resistance, species innate plus whatever is afflicting it. */
export function resistanceOf(target: MonsterInstance, type: DamageType): number {
  return monsterStats(target).resistances[type];
}

/**
 * A resistance as the blow actually meets it. Penetration erodes positive
 * resistance toward 0 but never deepens a vulnerability.
 */
export function afterPenetration(res: number, penetration = 0): number {
  return res > 0 ? Math.max(0, res - penetration) : res;
}

/** A species' resistance as a blow meets it — def-level, for the bestiary. */
export function effectiveResistance(defId: string, type: DamageType, penetration = 0): number {
  return afterPenetration(monsterResistance(defId, type), penetration);
}

/** Damage a SPECIES takes after its typed resistance (def-level). */
export function damageVsMonster(
  defId: string,
  type: DamageType,
  dmg: number,
  penetration = 0,
): number {
  return dmg * (1 - effectiveResistance(defId, type, penetration));
}

/**
 * One typed slice of a blow landing on a live monster, itemised for the tooltip.
 *
 * The mirror of `incomingSlice`, and as of docs/plans/monster-stat-parity.md it
 * reads every dial that one does. They were the same function written twice and
 * had quietly drifted: a monster answered a type and nothing else, so a
 * `damageTaken` or a `ward` on an enemy was carried faithfully all the way here
 * and then dropped without a word.
 *
 * ⚠️ Two differences from the player's that are DELIBERATE and must survive any
 * future tidying:
 *
 *  - **Penetration exists here and not there.** A player's blow can erode a
 *    resistance; nothing erodes the player's.
 *  - **The floor is 0, not 1.** Every blow the player takes deals at least one
 *    point; a monster may genuinely take nothing. Raising this to match would
 *    change every fight in the game and is not what parity means.
 */
export function monsterSlice(
  target: MonsterInstance,
  type: DamageType,
  source: string,
  raw: number,
  penetration = 0,
  /**
   * Set when the blow came from range — `resRanged` only answers those. Nothing
   * passes it yet (the player has no range flag on a swing the way a monster's
   * def does), so it reads as false and the dial is reachable rather than live.
   */
  ranged = false,
): DamageSlice {
  const stats = monsterStats(target);
  // Three things answer a type, stacked into one figure BEFORE the cap so no
  // single source can be spent past it: the type's own resistance, a general
  // elemental hardness, and a distance-specific one. Same order, same reason,
  // same clamp as the player's — with the body's own ceiling rather than the
  // global constant, or the stacking clamp would undo what it bought.
  const before = Math.min(
    Math.max(0, stats.resistCap),
    stats.resistances[type] +
      (ELEMENTAL_TYPES.has(type) ? stats.resElemental : 0) +
      (ranged ? stats.resRanged : 0),
  );
  const resistance = afterPenetration(before, penetration);
  // Armour first, then resistance on what got through — the same order the
  // player's blows are resolved in, and physical-only for the same reason: a
  // harness spreads a blow, it does not argue with fire.
  //
  // The soft-target falloff the acid line wants is implicit right here. There
  // is no rule reducing corrosion against something soft; something soft simply
  // has nothing to corrode.
  const worn = PHYSICAL_TYPES.has(type) ? Math.min(raw, stats.armor) : 0;
  const afterArmor = raw - worn;
  // `damageTaken` comes last and multiplies what survived everything else. It
  // is the body rather than the barrier — a slime does not turn a sword aside,
  // it simply minds it less — so it must not be inside the resistance cap.
  const afterRes = Math.max(0, afterArmor * (1 - resistance) * Math.max(0, stats.damageTaken));
  // The ward eats a flat amount of whatever is left, and never more than there
  // was: a 40-point ward against a 6-damage tap absorbs 6, so it cannot bank
  // the surplus.
  const warded = Math.max(0, Math.min(afterRes, stats.ward));
  const dealt = Math.max(0, afterRes - warded);
  return {
    type,
    source,
    raw,
    armor: worn,
    resisted: afterArmor - afterRes,
    resistance,
    pierced: before - resistance,
    warded,
    dealt,
  };
}

/**
 * A blow landing on the player, itemised: flat armor first (physical only),
 * then % resistance, then the floor of 1 every blow at least deals.
 * `bonusArmor` is the extra guard a bracing stance bought with stamina for
 * this one blow.
 */
export function incomingSlice(
  stats: DerivedStats,
  type: DamageType,
  source: string,
  raw: number,
  bonusArmor = 0,
  /** Set when the blow came from range — `resRanged` only answers those. */
  ranged = false,
): DamageSlice {
  // Armor never absorbs more than the blow carried — a 30-armor guard against a
  // 5-damage tap blocks 5, not 30 (the floor below decides what still gets in).
  const armor = PHYSICAL_TYPES.has(type) ? Math.min(raw, stats.armor + bonusArmor) : 0;
  // Three things can answer a type, and they stack into one figure before the
  // cap so no single source can be spent past it: the type's own resistance,
  // a general elemental hardness, and a distance-specific one.
  const resistance = Math.min(
    // The player's own ceiling, not the global one — a body built to hold more
    // holds more here too, or the stacking clamp would undo what it bought.
    Math.max(0, stats.resistCap),
    stats[RES_STAT_BY_TYPE[type]] +
      (ELEMENTAL_TYPES.has(type) ? stats.resElemental : 0) +
      (ranged ? stats.resRanged : 0),
  );
  const afterArmor = raw - armor;
  // `damageTaken` comes last and multiplies what survived everything else. It
  // is the body rather than the barrier — a slime does not turn a sword aside,
  // it simply minds it less — so it must not be inside the resistance cap.
  const afterRes = afterArmor * (1 - resistance) * Math.max(0, stats.damageTaken);
  // The ward eats a flat amount of whatever is left, and never more than there
  // was: a 40-point ward against a 6-damage tap absorbs 6, so it cannot bank
  // the surplus. The floor below still lets a single point through.
  const warded = Math.max(0, Math.min(afterRes, stats.ward));
  const dealt = Math.max(1, Math.round(afterRes - warded));
  return {
    type,
    source,
    raw,
    armor,
    resisted: afterArmor * resistance,
    resistance,
    pierced: 0,
    warded,
    dealt,
  };
}

/** Damage the player takes from one blow (see incomingSlice for the parts). */
export function incomingDamage(
  stats: DerivedStats,
  type: DamageType,
  raw: number,
  bonusArmor = 0,
): number {
  return incomingSlice(stats, type, '', raw, bonusArmor).dealt;
}

/** Merge a slice into a report, one row per (type, source). */
function addSlice(into: Map<string, DamageSlice>, slice: DamageSlice): void {
  const key = `${slice.type}|${slice.source}`;
  const prev = into.get(key);
  if (!prev) into.set(key, { ...slice });
  else {
    prev.raw += slice.raw;
    prev.armor += slice.armor;
    prev.resisted += slice.resisted;
    prev.dealt += slice.dealt;
  }
}

/**
 * The player's crit ledger (engine/mercy.ts) — ONE key across blows, blades
 * and workings, because crit is one stat here rather than a proc per item.
 * A constant, not a template: this is read on every blow of every swing.
 *
 * Only rolls pass through it. A technique that NAMES its crit
 * (`TechniqueMove.crit`) is certain by authorship, so it neither clears the
 * ledger nor adds to it — otherwise a build with a forced crit in its rotation
 * would keep resetting a debt it never actually incurred.
 */
const PLAYER_CRIT = 'proc:crit';

/**
 * The monster side, per species. An individual is gone at the end of the
 * fight, but the wolves are not — and a counter that reset with every corpse
 * would spend most of its life cold, which quietly hands the player a fight
 * against softer crits than the bestiary claims.
 */
function monsterCritKey(defId: string): string {
  return `proc:crit:${defId}`;
}

/** What the player's weapon damage is credited to in a tooltip. */
function weaponSource(state: GameState): string {
  return ITEMS[state.equipment.weapon?.defId ?? '']?.name ?? 'Bare hands';
}

function resNote(res: number): string {
  if (res >= 0.15) return ' (resisted)';
  if (res <= -0.15) return ' (vulnerable!)';
  return '';
}

/**
 * What a drop entry's drought counter is called.
 *
 * Per monster AND per entry: the wolf owing you a fang blade is a different
 * debt from the boar owing you one, because hunting wolves is the thing the
 * player is actually doing. Keyed on kind+id rather than position so that
 * re-authoring a table around an entry does not reset the debt — which is why
 * both validation layers forbid a table from listing the same drop twice.
 */
function dropKey(defId: string, entry: DropEntry): string {
  return `loot:${defId}:${entry.kind}:${entry.id ?? ''}`;
}

/**
 * Roll a weighted drop table. Loot luck (player stat × monster rarity/modifier)
 * shrinks the weight of 'nothing' entries rather than inflating everything else.
 *
 * Rare entries roll under drought protection (engine/mercy.ts) — their odds
 * climb with every kill that stiffs them and reset when they land, without
 * moving the authored rate. `nothing` absorbs the difference, which is the
 * same seam loot luck already works through.
 */
function rollDropTable(state: GameState, bus: EventBus, table: DropTable, monster: MonsterInstance): void {
  const stats = getDerivedStats(state);
  // Scoped loot narrows to WHAT WAS KILLED: `loot:beast` is a hunter who knows
  // which parts of a beast are worth taking, and finds nothing extra on a
  // golem. The unscoped `loot` still applies to everything.
  const tags = [...monsterTagSet(monster.defId)];
  const luck =
    stats.loot *
    scopedMult(state, 'loot', tags) *
    RARITIES[monster.rarity].lootMult *
    MODIFIER_TIERS[monster.modifier].rewardMult;

  // Whether an entry is rare enough to protect is read off the AUTHORED share,
  // never the luck-adjusted one — a change of hat must not move an entry on or
  // off its counter. The rate it escalates around is still the adjusted one.
  const authored = table.entries.reduce((s, e) => s + e.weight, 0);

  for (let roll = 0; roll < table.rolls; roll++) {
    const entries = table.entries.map((e) =>
      e.kind === 'nothing' ? { ...e, weight: e.weight / Math.max(1, luck) } : e,
    );
    const pick = mercyPick(state, entries, (e) =>
      e.kind !== 'nothing' && mercyTracked(e.weight / authored) ? dropKey(monster.defId, e) : null,
    );
    const qty = pick.qty ? randInt(state, pick.qty[0], pick.qty[1]) : 1;

    switch (pick.kind) {
      case 'nothing':
        break;
      case 'gold': {
        const gold = Math.round(qty * monster.level * getDerivedStats(state).goldGain);
        state.gold += gold;
        bumpStat(state, bus, 'gold:earned', gold);
        bus.emit({ type: 'log', msg: text('combat.scavenged_gold', { gold }), kind: 'loot' });
        break;
      }
      case 'material': {
        // Graded materials roll a grade as they drop; loot luck tilts it.
        const got = grantMaterial(state, pick.id!, qty, luck);
        const mat = MATERIALS[pick.id!];
        const grade = got.quality ? ` (${QUALITY_TIERS[got.quality].name})` : '';
        bus.emit({
          type: 'log',
          msg: text('combat.loot_material', { icon: mat?.icon ?? '', name: mat?.name ?? pick.id, grade, qty }),
          kind: 'loot',
        });
        break;
      }
      case 'rune': {
        // Runes ride the runecarving shutter: while it is shut, a rune line
        // that comes up pays nothing (every other line's odds are untouched).
        if (subsystemUnlocked(state, 'runecarving')) grantRune(state, bus, pick.id!, qty);
        break;
      }
      case 'item': {
        const item: ItemInstance = createItem(state, pick.id!);
        // Gear is made for the thing that carried it. A jötunn's hammer comes
        // off a jötunn gargantuan, and swinging it is a different proposition
        // from swinging a bandit's — see OVERSIZE_SPEED_PER_STEP. Left absent
        // at person-sized so the overwhelming majority of loot is unchanged.
        const wornBy = monsterSizeRank(monster.defId);
        if (wornBy !== sizeRank('medium')) item.size = SIZE_LADDER[wornBy];
        // Affix chance scales with monster rarity.
        const affixChance = { common: 0.08, uncommon: 0.25, rare: 0.5, epic: 0.9 }[monster.rarity];
        if (chance(state, affixChance)) {
          item.affix = AFFIXES[randInt(state, 0, AFFIXES.length - 1)];
        }
        state.inventory.push(item);
        bus.emit({ type: 'loot', item });
        bus.emit({
          type: 'log',
          msg: text('combat.loot_item', { icon: ITEMS[pick.id!]?.icon ?? '', item: itemName(item) }),
          kind: 'loot',
        });
        break;
      }
    }
  }
}

function onKill(state: GameState, bus: EventBus, index: number): void {
  const c = state.combat!;
  const monster = c.enemies[index]!;
  const tags = combatTags(state);
  const spot = SPOTS[state.spot];
  if (monster.defId === TOLL_GOLEM) rewardTollGolem(state, bus);

  // A `once` kill goes on the spot's record the moment it happens — not at
  // the end of the fight, so a knockout after the deed still keeps the deed.
  if (spot?.encounters?.some((e) => e.once && e.monsterId === monster.defId)) {
    bumpStat(state, bus, slainKey(spot.id, monster.defId));
    bus.emit({ type: 'log', msg: text('combat.unique_slain', { name: monster.name }), kind: 'combat' });
  }
  // A BOSS kill latches the spot's boss counter the same eager way. Announced
  // only the first time — variant keepers keep spawning, and a hunter farming
  // the ambush window does not need telling on every rematch.
  if (spot?.encounters?.some((e) => e.boss && e.monsterId === monster.defId)) {
    const first = (state.stats[bossKey(spot.id)] ?? 0) === 0;
    bumpStat(state, bus, bossKey(spot.id));
    if (first) {
      bus.emit({ type: 'log', msg: text('combat.keeper_slain', { spot: spot.name }), kind: 'combat' });
    }
  }

  const gold = Math.round(monster.gold * getDerivedStats(state).goldGain);
  state.gold += gold;
  bumpStat(state, bus, 'gold:earned', gold);
  // The species is the input a hunter learns from — the hundredth wolf teaches
  // less than the first, while a new one is worth going out of your way for.
  // The XP itself is cut by how far the fighter has outgrown the monster
  // (killXp, levels.ts); the same number pays level XP through the event.
  const xp = killXp(state, monster);
  grantSkillXp(state, bus, tags, xp, monster.defId);
  rollDropTable(state, bus, MONSTERS[monster.defId].loot, monster);
  bus.emit({ type: 'kill', monster, xp });
  bus.emit({
    type: 'log',
    // Slimes and slime spiders carry no coin; "+0 gold" on most of the first
    // kills a new life makes read as a fault, so a coinless kill says nothing.
    msg:
      gold > 0
        ? text('combat.defeated', { name: monster.name, level: monster.level, gold })
        : text('combat.defeated_no_gold', { name: monster.name, level: monster.level }),
    kind: 'combat',
  });

  c.enemies[index] = null;

  // A random survivor steps into the centre; the two trade places, so the slot
  // it came from is the one left empty.
  const survivors = c.enemies
    .map((e, i) => (e ? i : -1))
    .filter((i) => i >= 0);
  if (survivors.length === 0) {
    // A finite spot counts the win against its budget; the last one clears it.
    if (spot?.fightLimit) {
      bumpStat(state, bus, fightsKey(spot.id));
      if (spotCleared(state, spot)) {
        if (spot.id === 'f1_storerooms') bus.emit({ type: 'log', kind: 'explore', msg: 'The remaining vermin scurry beneath a fallen shelf. Their retreat reveals a passage to the records rooms.' });
        bus.emit({ type: 'log', msg: text('combat.spot_cleared', { spot: spot.name }), kind: 'combat' });
      }
    }
    const forcedWin = !!c.forced;
    closeCombat(state);
    endFight(state, 'won');
    state.respawnTimer = RESPAWN_DELAY;
    if (spot) bus.emit({ type: 'fight:won', spot: spot.id, forced: forcedWin });
    return;
  }
  if (index === 0) {
    const pick = survivors[randInt(state, 0, survivors.length - 1)];
    c.enemies[0] = c.enemies[pick];
    c.enemies[pick] = null;
    feed(state, `↔️ ${c.enemies[0]!.icon} ${c.enemies[0]!.name} steps forward!`);
  }
}

/**
 * The player goes down.
 *
 * The `defeat` event still carries the specimen that was standing in front of
 * you, because achievements and titles have always keyed on it. It is NOT
 * necessarily what killed you — a rot stack from something you already killed
 * can put you on the floor while a goblin takes the credit — which is exactly
 * why the ledger exists and why the window reads from that instead.
 */
function onDefeat(state: GameState, bus: EventBus): void {
  const forced = state.combat!.forced;
  const monster = frontEnemy(state.combat!)!;
  bus.emit({ type: 'defeat', monster });
  bus.emit({
    type: 'log',
    msg: forced
      ? text('combat.knocked_out_forced', { name: monster.name })
      : text('combat.knocked_out', { name: monster.name }),
    kind: 'danger',
  });
  closeCombat(state);
  setHpAfterDefeat(state);
  state.recovering = true;
  state.respawnTimer = RESPAWN_DELAY * 2;
  endFight(state, 'knocked_out');
  // You do not come round where you fell — something dragged you clear, and
  // the havens the save has been tracking decide where (systems/safety.ts).
  // Every knockout, not only a forced fight's (user, 2026-09-12): the last
  // camp you stood in is where a defeat returns you. Whether the loss costs
  // anything beyond the retreat is deliberately still open.
  retreatToSafety(
    state,
    bus,
    forced ? 'There was no fleeing that fight, and you lost it.' : 'Knocked out.',
  );
}

// ---------- Active skills ----------

/**
 * The order actives are considered in: the player's explicit rotation first,
 * then any other known active, then known martial techniques, then any
 * prepared grimoire spell not yet placed. A player who has ordered nothing
 * therefore behaves exactly as before.
 *
 * Prepared spells (`grimoire:<uid>`) and techniques (`technique:<id>`) ride
 * the SAME list as skills, so the rotation UI can order them, gate them on
 * triggers, and switch them off exactly like a skill — no separate black box
 * that fires on cooldown.
 */
export function activeRotation(state: GameState): string[] {
  const out: string[] = [];
  const prepared = new Set(preparedSpells(state).map((s) => `grimoire:${s.uid}`));
  const known = new Set(knownTechniques(state).map((t) => `technique:${t.id}`));
  const add = (id: string) => {
    if (out.includes(id)) return;
    if (id.startsWith('grimoire:')) {
      // Only spells still prepared count; stale uids in skillOrder are inert.
      if (prepared.has(id)) out.push(id);
      return;
    }
    if (id.startsWith('technique:')) {
      if (known.has(id)) out.push(id);
      return;
    }
    // The body's own tool is one more active, not a special case — so it can
    // be ordered, triggered and put on cooldown like everything else.
    if (id === GENE_ACTIVE) {
      // The BASE ability, deliberately: this only asks whether the body has a
      // tool at all, and resolving the graph to answer that would put the whole
      // chromosome on the rotation's hot path for nothing.
      if (geneAbilityBase(state)) out.push(id);
      return;
    }
    if (SKILLS[id]?.kind !== 'active' || !isUnlocked(state, id)) return;
    out.push(id);
  };
  for (const id of state.skillOrder ?? []) add(id);
  add(GENE_ACTIVE);
  for (const id of Object.keys(SKILLS)) add(id);
  for (const id of known) add(id);
  for (const id of prepared) add(id);
  return out;
}

/** What the rotation offered: a skill's active, a technique, or a crafted spell. */
type PickedActive =
  | { id: string; spec: ActiveSpec; crafted?: undefined; technique?: undefined }
  | { id: string; spec?: undefined; crafted: SpellSpec; technique?: undefined }
  | { id: string; spec?: undefined; crafted?: undefined; technique: TechniqueDef };

/** First known, off-cooldown active of `kind` whose trigger conditions hold. */
export function pickActive(
  state: GameState,
  kind: 'attack' | 'buff',
  stats: DerivedStats,
): PickedActive | null {
  const c = state.combat!;
  const ctx = { state, combat: c, stats };
  for (const id of activeRotation(state)) {
    if (id.startsWith('grimoire:')) {
      const spell = findSpell(state, Number(id.slice('grimoire:'.length)));
      if (!spell) continue;
      if ((c.cooldowns[id] ?? 0) > 0) continue;
      // Refused once too often, and the words will not come again this fight.
      if (isSealed(state, id)) continue;
      // A working being HELD does not also go off by itself.
      if (spellIsHeld(state, spell.uid)) continue;
      // Matter argues with a psionic working, so resolve it in the hands that
      // are holding it — the one place combat reads a crafted spell.
      const spec = resolveSpellFor(state, spell);
      // A counterspell is a trap: it never goes off on its own, on the bar or
      // from the buff slot. Somebody else's casting springs it (pickCounterspell).
      if (spec.counter) continue;
      // Offensive spells swing on the action bar; wards, mendings and whatever
      // the grammar sent at its own speaker fire as soon as ready, like buffs.
      // Healing an ENEMY is offensive — kindness, weaponized.
      const offensive =
        spec.target !== 'self' && (spec.strikes.length > 0 || spec.healsEnemy === true);
      if ((kind === 'attack') !== offensive) continue;
      // A rattled head cannot hold a spell together.
      if (statusBlocks(state, 'spell')) continue;
      // Not enough of what it costs is not a refusal — just not yet. A working
      // pays out of its own school's pool, so both are checked.
      if (resourceValue(state, 'mana') < spec.manaCost * stats.manaEff) continue;
      if (spec.focusCost && resourceValue(state, 'focus') < spec.focusCost) continue;
      if (!evaluateTrigger(ctx, state.skillTriggers?.[id])) continue;
      return { id, crafted: spec };
    }
    if (id.startsWith('technique:')) {
      const def = TECHNIQUES[id.slice('technique:'.length)];
      if (!def) continue;
      if ((c.cooldowns[id] ?? 0) > 0) continue;
      // A striking technique swings on the action bar; a defensive form fires
      // from the buff slot as soon as its moment comes. A COUNTER does
      // neither — it lives inside the enemy's attack (see pickCounter), so it
      // must never be picked up by either ordinary path.
      if (def.move.counter) continue;
      const offensive = def.move.damageMult !== undefined;
      if ((kind === 'attack') !== offensive) continue;
      // The body remembers, but only with the right weapon in hand (or in the
      // right STATE — grounded, sheathed) and only from where the last
      // exchange actually left you.
      if (!techniqueArmed(state, def)) continue;
      if (weaponStateGate(state, def)) continue;
      // The baked reflex gates every way in; then at least one way must be
      // open — the right footing AND whatever that way itself wants to have
      // just happened. Finally, whatever the player layered on top.
      if (!evaluateTrigger(ctx, def.trigger)) continue;
      if (!openEntry(state, def, c.position, ctx)) continue;
      if (!evaluateTrigger(ctx, state.skillTriggers?.[id])) continue;
      return { id, technique: def };
    }
    const spec = id === GENE_ACTIVE ? geneAbility(state)?.spec : SKILLS[id]?.active;
    if (!spec) continue;
    if ((c.cooldowns[id] ?? 0) > 0) continue;
    // A gene's tool swings on the action bar like any other attack — leave it
    // out of this list and the whole ability path is unreachable in play.
    const isAttack = spec.type === 'strike' || spec.type === 'spell' || spec.type === 'gene';
    if (kind === 'attack' ? !isAttack : spec.type !== 'buff') continue;
    // A rattled head cannot hold a spell together.
    if (spec.type === 'spell' && statusBlocks(state, 'spell')) continue;
    if (!evaluateTrigger(ctx, state.skillTriggers?.[id])) continue;
    return { id, spec };
  }
  return null;
}

// ---------- Counters: techniques that live inside the enemy's attack ----------

/** A counter that has passed every gate and is waiting on the blow itself. */
interface ArmedCounter {
  id: string;
  def: TechniqueDef;
  move: TechniqueMove;
}

/**
 * The counter form ready to intercept `event` right now. A strike is chosen on
 * the action bar and a buff from the buff slot; a counter is offered by the
 * ENEMY's swing, so this runs inside the incoming-damage path instead.
 *
 * Every ordinary gate still applies — rotation order, the player's bench,
 * cooldown, weapon and weapon-state, entry position — except the baked
 * trigger: its event is happening now, not being remembered from a stamp.
 */
function pickCounter(state: GameState, stats: DerivedStats, event: string): ArmedCounter | null {
  const c = state.combat!;
  const ctx = { state, combat: c, stats };
  for (const id of activeRotation(state)) {
    if (!id.startsWith('technique:')) continue;
    const def = TECHNIQUES[id.slice('technique:'.length)];
    if (!def?.move.counter) continue;
    if ((def.trigger?.event ?? 'onHit') !== event) continue;
    if ((c.cooldowns[id] ?? 0) > 0) continue;
    if (!techniqueArmed(state, def)) continue;
    if (weaponStateGate(state, def)) continue;
    // Its own event is happening NOW rather than being remembered, so the
    // technique-wide trigger is not re-evaluated — but a way in may still
    // carry conditions of its own, and those are read normally.
    if (!openEntry(state, def, c.position, ctx)) continue;
    // Benching a counter switches the reflex off like anything else.
    if (!evaluateTrigger(ctx, state.skillTriggers?.[id])) continue;
    const move = resolvedMove(state, def);
    const spec = move.counter!;
    // An empty pool is not a refusal — just not this blow.
    if (spec.pool && spec.cost && counterPrice(state, stats, spec.pool, spec.cost) > resourceValue(state, spec.pool)) {
      continue;
    }
    return { id, def, move };
  }
  return null;
}

/** What one interception costs: a share of the pool's max, trimmed by its efficiency. */
function counterPrice(state: GameState, stats: DerivedStats, pool: ResourceId, cost: number): number {
  const eff = pool === 'stamina' ? stats.staminaEff : pool === 'mana' ? stats.manaEff : 1;
  return availableMax(state, stats, pool) * cost * eff;
}

/**
 * The answer, on the spot. Free of the action bar — like a parry riposte, your
 * own swing still lands when it was going to — and delivered in two slices:
 * your damage in your weapon's type, and what you just took off theirs in the
 * type the technique names. Whoever threw the blow is who it answers, which
 * for a flanker is the only way they are ever reachable.
 */
function fireCounter(
  state: GameState,
  bus: EventBus,
  stats: DerivedStats,
  armed: ArmedCounter,
  e: MonsterInstance,
  index: number,
): void {
  const c = state.combat!;
  const { def, move } = armed;
  const spec = move.counter!;
  if (spec.pool && spec.cost) spendResource(state, spec.pool, counterPrice(state, stats, spec.pool, spec.cost));

  // The magiknight seam: the technique chose WHEN and FROM WHERE, the grimoire
  // decides what lands. The held working replaces the weapon answer entirely.
  if (move.deliversSpell) {
    const held = c.readiedSpell ? findSpell(state, c.readiedSpell) : null;
    releaseReadiedSpell(state);
    c.cooldowns[armed.id] = move.cooldown;
    setPosition(state, displacedExit(state, techniqueExit(state, def)));
    const reachedSpell = recordExecution(state, def);
    if (reachedSpell) feed(state, `🎓 ${def.name} — ${reachedSpell.name}.`);
    grantAttrXp(state, bus, 'int', 3);
    grantSkillXp(state, bus, ['combat', 'magic'], 3);
    if (held) {
      feed(state, `${def.icon} ${def.name} — the working answers in the blade's place.`);
      castCraftedAttack(state, bus, `technique:${def.id}`, resolveSpellFor(state, held));
    }
    return;
  }

  const source = weaponSource(state);
  const slices = [];
  const steps: DamageStep[] = [];
  if (move.damageMult) {
    slices.push(monsterSlice(e, playerDamageType(state), source, stats.damage * move.damageMult, stats.penetration));
    steps.push({ label: 'Damage', value: stats.damage });
    if (move.damageMult !== 1) steps.push({ label: def.name, mult: move.damageMult });
  }
  const stopped = c.prevented?.onHit ?? 0;
  if (move.preventedMult && stopped > 0) {
    slices.push(
      monsterSlice(e, move.damageType ?? playerDamageType(state), source, stopped * move.preventedMult, stats.penetration),
    );
    steps.push({ label: 'Damage blocked', value: stopped * move.preventedMult });
    c.prevented = { ...c.prevented, onHit: undefined };
  }
  const total = Math.max(1, Math.round(slices.reduce((sum, s) => sum + s.dealt, 0)));
  e.hp -= total;
  noteOutgoing(state, total);
  feed(state, `${def.icon} ${def.name} answers the ${e.name} for ${total}`, {
    label: def.name,
    target: e.name,
    steps,
    slices,
    hits: 1,
    crit: false,
    total,
  });

  c.cooldowns[armed.id] = move.cooldown;
  setPosition(state, displacedExit(state, techniqueExit(state, def)));
  const reached = recordExecution(state, def);
  if (reached) feed(state, `🎓 ${def.name} — ${reached.name}.`);
  grantAttrXp(state, bus, 'dex', 2);
  grantSkillXp(state, bus, ['combat', ...(def.family ? [def.family] : [])], 3);
  if (e.hp <= 0) onKill(state, bus, index);
}

// ---------- Casting crafted spells ----------

/** How long one miracle's echo lasts for the next to resonate with. */
const MIRACLE_SYNERGY_WINDOW = 100;
/** What resonating is worth: strikes and healing, multiplied. */
const MIRACLE_SYNERGY_MULT = 1.25;

/**
 * Succession synergy: a miracle cast soon after a FRIENDLY deity's miracle
 * resonates with it. Records this cast either way, so hostile pairs (which
 * only an iconoclast can even prepare) simply break each other's chains.
 */
function miracleSynergy(state: GameState, c: CombatState, spec: SpellSpec): number {
  if (spec.school !== 'divine' || !spec.deity) return 1;
  const last = c.lastMiracle;
  c.lastMiracle = { deity: spec.deity, tick: state.totalTicks };
  if (!last || state.totalTicks - last.tick > MIRACLE_SYNERGY_WINDOW) return 1;
  return deityRelation(last.deity, spec.deity) === 'synergy' ? MIRACLE_SYNERGY_MULT : 1;
}

/** Whether any combatant — caster included — carries one of these conditions. */
function anyAfflicted(state: GameState, c: CombatState, ids: string[]): boolean {
  if (statusesOf(state).some((s) => ids.includes(s.id))) return true;
  return c.enemies.some((e) => e && statusesOf(e).some((s) => ids.includes(s.id)));
}

/** Everything a spell does to its own caster besides damage: blessings and buffs. */
function applySelfRiders(state: GameState, c: CombatState, spec: SpellSpec): void {
  for (const app of spec.grants ?? []) applyStatus(state, state, app, spec.name);
  if (spec.buff) {
    c.buffs.push({ name: spec.buff.name, mods: spec.buff.mods, ticksLeft: spec.buff.duration });
  }
}

/**
 * Cast a prepared spell that lands on its own caster — wards, mendings, and
 * anything the grammar was told to send to "me". Fires from the buff slot: as
 * soon as it is ready rather than on the action bar. Returns true if it proved
 * fatal, because "fire pierce me" is perfectly valid grammar and the grammar
 * does not check for wisdom — or if the fight ended under it, so the caller
 * stops either way.
 *
 * `prepaid` is a counterspell's payload: already paid, clocked and trained by
 * the spring that carries it, and not itself answerable — an undoing's own
 * words cannot be undone.
 */
function castCraftedSelf(
  state: GameState,
  bus: EventBus,
  id: string,
  spec: SpellSpec,
  stats: DerivedStats,
  prepaid = false,
): boolean {
  const c = state.combat!;
  // Any working that lands in the toll office counts against the spell-free
  // title, a counterspell's prepaid payload included.
  noteTollSpell(state, bus);
  if (!prepaid) {
    spendResource(state, 'mana', spec.manaCost * stats.manaEff);
    // A psionic working is paid for out of the mind's own pool, not the arcane
    // one. Instant workings SPEND focus; sustained ones will hold it instead.
    if (spec.focusCost) spendResource(state, 'focus', spec.focusCost);
    if (spec.staminaCost) drawStamina(state, stats, spec.staminaCost);
    c.cooldowns[id] = spec.cooldown;
    feed(state, `${spec.icon} You cast ${spec.name}.`);

    // An enemy's undoing may be waiting for exactly this. What it leaves is
    // what lands; what it costs you, you have already paid.
    const answer = answerPlayerWorking(state, bus, spec);
    if (answer.fatal || !state.combat) return true;
    // A refused undoing's backlash can drop the one who spoke it.
    if (c.enemies.some((e) => e && e.hp <= 0)) {
      sweepDead(state, bus);
      if (!state.combat) return true;
    }
    if (answer.remaining <= 0) {
      feed(state, `↩️ ${spec.name} comes apart before it can take hold.`);
      selfCastXp(state, bus, id, spec);
      return false;
    }
    if (answer.remaining < 1) spec = undoWorking(spec, answer.remaining);
  }

  const synergy = miracleSynergy(state, c, spec);
  if (synergy > 1) feed(state, `✨ ${spec.name} resonates with the miracle before it.`);

  if (spec.heal) {
    const healed = heal(state, stats, spec.heal * stats.spellPower * synergy, 'spell');
    if (healed > 0) feed(state, `💚 ${spec.name} knits ${Math.round(healed)} health back.`);
  }
  applySelfRiders(state, c, spec);
  for (const strike of spec.strikes) {
    for (let h = 0; h < (strike.hits ?? 1); h++) {
      const raw = stats.spellPower * strike.power * synergy * (0.9 + rand(state) * 0.2);
      // "Zero me": the grammar does not check for wisdom, and your own
      // resistances have nothing to say to nothing either.
      const dealt = strike.untyped
        ? Math.max(1, Math.round(raw))
        : incomingSlice(stats, strike.type, spec.name, raw).dealt;
      damagePlayer(state, dealt, strike.type);
      feed(state, `${spec.icon} ${spec.name} turns on you for ${dealt} ${strike.untyped ? 'untyped' : strike.type}.`);
      for (const app of strike.inflicts ?? []) applyStatus(state, state, app, spec.name, stats);
      if (!isAlive(state)) {
        onDefeat(state, bus);
        return true;
      }
    }
  }
  if (!prepaid) selfCastXp(state, bus, id, spec);
  return false;
}

/** What casting on yourself teaches — whether or not anything survived to land. */
function selfCastXp(state: GameState, bus: EventBus, id: string, spec: SpellSpec): void {
  grantAttrXp(state, bus, 'int', 2);
  const tags = ['magic', spec.school];
  checkDiscovery(state, bus, tags);
  grantSkillXp(state, bus, tags, 3);
  // Saying a sentence is how its words are worn in (see grantWordXp).
  if (id.startsWith('grimoire:')) grantCastWordXp(state, bus, Number(id.slice(9)));
}

/**
 * The share of a mending that an overgrowth swallows before any of it can
 * close a wound. Each point swallowed undoes three of the surplus — so the
 * ledger falls by the FULL amount healed, and the target gets two thirds.
 */
export const OVERGROWTH_HEAL_TAX = 1 / 3;

/**
 * Heal a monster — the grammar allows it, and the body keeps the books.
 *
 * Healing up to full is just healing (kindness the fight rarely thanks you
 * for). OVERFLOW has nowhere to go: it feeds an overgrowth ledger — the
 * instance's `data.surplus`, in absolute HP — whose thresholds are declared
 * on the status defs (StatusDef.surplus). Enough surplus and the growth
 * escalates, carrying its ledger; feed the escalation far enough and the
 * body bursts, the bearer taking the whole ledger and everything fighting
 * BESIDE it a share. Manaburn's mirror, in flesh.
 *
 * Detonation only deals the damage; the CALLER sweeps the corpses.
 */
/**
 * A monster spends its action on a working instead of a swing.
 *
 * The whole point of this function's smallness: it does not know or care which
 * school it is casting. `specForSource` composes an arcane sentence, a miracle
 * or a psionic shape into the same `SpellSpec`, and everything below reads
 * that — so a Death Knight's sentence and a Psionic Slime's shape arrive
 * through one path, and any school the player gains, monsters gain too.
 *
 * A monster pays no pool (it has none) and never learns: its list is authored,
 * and the spec's own cooldown is the whole governor.
 *
 * Returns true when the field changed under the enemy phase — a counterspell's
 * answer killed something, or the fight ended — and the phase must stop
 * rather than keep walking a formation whose slots have moved.
 */
export function castMonsterWorking(
  state: GameState,
  bus: EventBus,
  e: MonsterInstance,
  es: MonsterStats,
  source: SpellSource,
  index: number,
): boolean {
  const spec = specForSource(source);
  e.cooldowns ??= {};
  e.cooldowns[index] = state.totalTicks + spec.cooldown;
  spendMonsterAction(e, index);
  const c = state.combat!;
  const slot = c.enemies.indexOf(e);

  // The same argument, from the other side. Keyed per specimen so two of the
  // same monster seal their own workings rather than sharing one.
  const refusal = refuteCast(state, `${e.defId}:${index}:${slot}`, spec.manaCost);
  if (refusal.negated) {
    if (refusal.backlash > 0) {
      e.hp -= Math.max(1, Math.round(refusal.backlash));
      noteOutgoing(state, Math.max(1, Math.round(refusal.backlash)));
    }
    feed(
      state,
      refusal.sealed
        ? `🚫 The ${e.name}'s ${spec.name} is refused — it will not find the words again.`
        : `🚫 The ${e.name} reaches for ${spec.name} and the world declines.`,
    );
    return false;
  }

  /*
   * The casting is VISIBLE before it resolves: stamped for triggers (with
   * what is being cast, so a trigger can ask), and offered to whatever
   * undoing the player has lying in wait. The answer lands inside the
   * casting, the way a counter technique lands inside the swing — so what
   * resolves afterwards is what the undoing left of it.
   */
  c.casting = {
    index: slot,
    name: spec.name,
    school: spec.school,
    element: leadingElement(spec),
    tick: state.totalTicks,
  };
  markCombatEvent(state, 'onEnemyCast');
  let working = spec;
  let remaining = 1;
  const stats = getDerivedStats(state);
  const armed = pickCounterspell(state, stats);
  if (armed) {
    const standing = livingEnemies(c);
    remaining = springCounterspell(state, bus, stats, armed, e, spec);
    if (!state.combat || !isAlive(state)) return true;
    // Its own answer may have reached the caster, or anyone else: a working
    // whose speaker has fallen goes with them.
    const fell = livingEnemies(state.combat) !== standing;
    if (e.hp <= 0 || !state.combat.enemies.includes(e)) return true;
    if (remaining <= 0) {
      feed(state, `↩️ The ${e.name}'s ${spec.name} comes apart before it can land.`);
      return fell;
    }
    working = undoWorking(spec, remaining);
    if (fell) {
      feed(state, `${spec.icon} The ${e.name} works what is left of ${spec.name}.`);
      resolveMonsterWorking(state, bus, e, es, working, stats);
      return true;
    }
  }

  feed(
    state,
    remaining < 1
      ? `${spec.icon} The ${e.name} works what is left of ${spec.name}.`
      : `${spec.icon} The ${e.name} works ${spec.name}.`,
  );
  resolveMonsterWorking(state, bus, e, es, working, stats);
  return !state.combat || !isAlive(state);
}

/** How many enemies are still standing — the cheap way to notice a death. */
function livingEnemies(c: CombatState): number {
  return c.enemies.filter((e) => e && e.hp > 0).length;
}

/**
 * What a monster's working DOES, once it is decided that it happens — shared
 * by an ordinary cast and by a counterspell's payload. Returns true when it
 * proved fatal to the player.
 *
 * What it does to ITSELF: a mending closes its own wounds, and every inward
 * face it shaped is worn by it (applyStatus already takes a monster, and
 * statusMods keeps whichever stats a monster actually has — so a psionic
 * haste really does quicken its bar, while a face targeting a stat monsters
 * lack is ignored).
 *
 * `spec.buff` is deliberately NOT read: buffs fill the player's own slot on
 * CombatState. A monster wears conditions instead, which is what `grants`
 * already is.
 */
function resolveMonsterWorking(
  state: GameState,
  bus: EventBus,
  e: MonsterInstance,
  es: MonsterStats,
  spec: SpellSpec,
  stats: DerivedStats,
): boolean {
  if (spec.heal && !spec.healsEnemy) {
    const i = state.combat!.enemies.indexOf(e);
    if (i >= 0) healEnemy(state, i, spec.heal * es.spellPower, spec.name, false);
  }
  for (const app of spec.grants ?? []) applyStatus(state, e, app, spec.name);

  // What it does to YOU. Strikes arrive as any incoming damage does, so armor,
  // resistances and bracing all still have their say.
  for (const strike of spec.strikes) {
    for (let h = 0; h < (strike.hits ?? 1); h++) {
      const raw = es.spellPower * strike.power * (0.9 + rand(state) * 0.2);
      const landed = strike.untyped
        ? Math.max(1, Math.round(raw))
        : incomingSlice(stats, strike.type, spec.name, raw).dealt;
      damagePlayer(state, landed, strike.type);
      feed(state, `${spec.icon} ${spec.name} hits you for ${landed} ${strike.type}.`);
      if (landed > 0) applyStatuses(state, state, strike.inflicts, spec.name, stats);
      if (!isAlive(state)) {
        onDefeat(state, bus);
        return true;
      }
    }
  }
  // The working itself arriving, blow or no blow (see SpellSpec.afflicts).
  applyStatuses(state, state, spec.afflicts, spec.name, stats);
  return false;
}

// ---------- Anti-magic: counterspells ----------
//
// A counterspell is any working with an undoing in it (SpellSpec.counter). It
// is never cast on its own: prepared, it lies in the rotation like a trap, and
// an enemy's casting springs it — the same way a counter technique lives
// inside the enemy's swing rather than on either of the ordinary paths. The
// monster side is the mirror: a counterspell in a monster's rotation is never
// its turn's action, and YOUR casting springs it.
//
// Springing reads the undoing against the working it met (arcane.ts
// `counterEfficiency`). The working loses that share of itself — all of it at
// 100% or more — and whoever the undoing is addressed to takes manaburn at
// efficiency × burn × the undoer's spell power. The burn is never capped:
// efficiency past 100% has nothing left to take apart, and burns harder.
// Anything else the sentence carries (a blow, a ward, a mending) goes off
// with it, aimed at the caster whose working it answered.

/** A prepared counterspell that has passed every gate and waits for a working. */
interface ArmedCounterspell {
  id: string;
  spec: SpellSpec;
}

/**
 * The player's counterspell ready to answer a working right now: the first
 * prepared one in rotation order that is off its clock, not sealed, not being
 * held in the spellblade seat, affordable, and whose firing conditions hold.
 * The casting has already been stamped (`onEnemyCast`, `CombatState.casting`),
 * so a condition can ask what is being cast — that is how several traps tuned
 * for different elements are routed.
 */
function pickCounterspell(state: GameState, stats: DerivedStats): ArmedCounterspell | null {
  const c = state.combat!;
  const ctx = { state, combat: c, stats };
  for (const id of activeRotation(state)) {
    if (!id.startsWith('grimoire:')) continue;
    const spell = findSpell(state, Number(id.slice('grimoire:'.length)));
    if (!spell) continue;
    if ((c.cooldowns[id] ?? 0) > 0) continue;
    if (isSealed(state, id)) continue;
    if (spellIsHeld(state, spell.uid)) continue;
    const spec = resolveSpellFor(state, spell);
    if (!spec.counter) continue;
    // A rattled head cannot hold a spell together — an undoing included.
    if (statusBlocks(state, 'spell')) continue;
    if (resourceValue(state, 'mana') < spec.manaCost * stats.manaEff) continue;
    if (spec.focusCost && resourceValue(state, 'focus') < spec.focusCost) continue;
    if (!evaluateTrigger(ctx, state.skillTriggers?.[id])) continue;
    return { id, spec };
  }
  return null;
}

/** Everything a counterspell carries besides the undoing, or null when that is all it is. */
function counterPayload(spec: SpellSpec): SpellSpec | null {
  const carries =
    spec.strikes.length > 0 ||
    !!spec.heal ||
    !!spec.buff ||
    (spec.grants?.length ?? 0) > 0 ||
    (spec.afflicts?.length ?? 0) > 0;
  if (!carries) return null;
  const rest: SpellSpec = { ...spec };
  delete rest.counter;
  return rest;
}

/** Lay an undoing's burn on each bearer, once per application it was spoken with. */
function layBurn(
  state: GameState,
  bearers: Bearer[],
  intensity: number,
  times: number,
  source: string,
  playerStats?: DerivedStats,
): void {
  if (intensity <= 0) return;
  for (const bearer of bearers) {
    for (let n = 0; n < times; n++) {
      applyStatus(
        state,
        bearer,
        { id: 'manaburn', intensity },
        source,
        // The player's arcane resistance thins a burn on arrival; a monster's
        // is read off the monster by applyStatus itself.
        bearer === state ? playerStats : undefined,
      );
    }
  }
}

/** A share, the way the feed states one. */
const pctOf = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Spring the player's counterspell on a monster's working. Pays, clocks and
 * trains like a cast (it is one), then returns what is left of the working:
 * 1 untouched, 0 undone entirely.
 */
function springCounterspell(
  state: GameState,
  bus: EventBus,
  stats: DerivedStats,
  armed: ArmedCounterspell,
  caster: MonsterInstance,
  working: SpellSpec,
): number {
  const c = state.combat!;
  const { id, spec } = armed;
  const counter = spec.counter!;
  const cost = spec.manaCost * stats.manaEff;
  // A refuting body argues with its own undoings too (see castCraftedAttack),
  // and a refused one still costs what it cost.
  const refusal = refuteCast(state, id, cost);
  spendResource(state, 'mana', cost);
  if (spec.focusCost) spendResource(state, 'focus', spec.focusCost);
  if (spec.staminaCost) drawStamina(state, stats, spec.staminaCost);
  c.cooldowns[id] = spec.cooldown;
  if (refusal.negated) {
    if (refusal.backlash > 0) damagePlayer(state, refusal.backlash, 'arcane');
    feed(state, `🚫 ${spec.name} is refused before it can spring.`);
    return 1;
  }

  const reading = counterEfficiency(counter, workingSignature(working));
  const burn = reading.efficiency * counter.burn * stats.spellPower;
  // The address decides who burns: the caster it answered by default, every
  // enemy thinned for a broadside, and — the grammar does not check for
  // wisdom — the speaker, for "undo me".
  if (spec.target === 'self') layBurn(state, [state], burn, counter.burns ?? 1, spec.name, stats);
  else if (spec.target === 'others') {
    const all = c.enemies.filter((m): m is MonsterInstance => !!m && m.hp > 0);
    layBurn(state, all, burn * OTHERS_POWER, counter.burns ?? 1, spec.name);
  } else layBurn(state, [caster], burn, counter.burns ?? 1, spec.name);

  const undone = reading.efficiency >= 1 ? 'undone entirely' : `${pctOf(reading.efficiency)} of it undone`;
  feed(
    state,
    `🪤 ${spec.name} springs on the ${caster.name}'s ${working.name}: ${pctOf(reading.efficiency)} efficiency, ${undone}, manaburn ${Math.round(burn)}.`,
  );

  grantAttrXp(state, bus, 'int', 3);
  const tags = ['combat', 'magic', spec.school];
  checkDiscovery(state, bus, tags);
  grantSkillXp(state, bus, tags, 4);
  if (id.startsWith('grimoire:')) grantCastWordXp(state, bus, Number(id.slice(9)));

  // Whatever else the sentence carries goes off with it, at the caster.
  const payload = counterPayload(spec);
  if (payload) {
    if (payload.target === 'self') castCraftedSelf(state, bus, id, payload, stats, true);
    else if (caster.hp > 0 && c.enemies.includes(caster)) {
      castCraftedAttack(state, bus, id, payload, { spring: { aimAt: c.enemies.indexOf(caster) } });
    }
  }
  return Math.max(0, 1 - reading.efficiency);
}

/**
 * An enemy's undoing, answering YOUR working. The first enemy holding a
 * counterspell that is ready springs it — the front first, then the flanks,
 * each reading its own rotation top-down — and only one answers any one
 * working: a coven does not take the same sentence apart five times over.
 *
 * A mind in debt cannot shape an undoing any more than a working; a refuting
 * body (yours) argues with it like any other.
 *
 * Returns what is left of your working (1 untouched, 0 undone), and whether
 * the answer finished you.
 */
function answerPlayerWorking(
  state: GameState,
  bus: EventBus,
  working: SpellSpec,
): { remaining: number; fatal: boolean } {
  const c = state.combat!;
  for (let slot = 0; slot < c.enemies.length; slot++) {
    const e = c.enemies[slot];
    if (!e || e.hp <= 0 || mindInDebt(e)) continue;
    // The terms of an honorable duel: everyone but the front can only watch.
    if (slot > 0 && statusPacifiesFlankers(state)) continue;
    const rotation = MONSTERS[e.defId]?.rotation ?? [];
    for (let index = 0; index < rotation.length; index++) {
      const entry = rotation[index];
      if (!('cast' in entry)) continue;
      if ((e.cooldowns?.[index] ?? 0) > state.totalTicks) continue;
      if (entry.uses !== undefined && (e.spent?.[index] ?? 0) >= entry.uses) continue;
      const spec = specForSource(entry.cast);
      if (!spec.counter) continue;
      const key = `${e.defId}:${index}:${slot}`;
      if (isSealed(state, key)) continue;
      return springEnemyCounter(state, bus, e, index, key, spec, working);
    }
  }
  return { remaining: 1, fatal: false };
}

/** A monster's counterspell, sprung on your working. See answerPlayerWorking. */
function springEnemyCounter(
  state: GameState,
  bus: EventBus,
  e: MonsterInstance,
  index: number,
  key: string,
  spec: SpellSpec,
  working: SpellSpec,
): { remaining: number; fatal: boolean } {
  e.cooldowns ??= {};
  e.cooldowns[index] = state.totalTicks + spec.cooldown;
  spendMonsterAction(e, index);

  const refusal = refuteCast(state, key, spec.manaCost);
  if (refusal.negated) {
    if (refusal.backlash > 0) {
      e.hp -= Math.max(1, Math.round(refusal.backlash));
      noteOutgoing(state, Math.max(1, Math.round(refusal.backlash)));
    }
    feed(state, `🚫 The ${e.name} reaches to undo your ${working.name} and the world declines.`);
    return { remaining: 1, fatal: false };
  }

  const counter = spec.counter!;
  const es = monsterStats(e);
  const stats = getDerivedStats(state);
  const reading = counterEfficiency(counter, workingSignature(working));
  const burn = reading.efficiency * counter.burn * es.spellPower;
  // "Undo me" in a monster's mouth burns the monster. The grammar is the
  // grammar, whoever speaks it.
  layBurn(state, spec.target === 'self' ? [e] : [state], burn, counter.burns ?? 1, spec.name, stats);
  const undone = reading.efficiency >= 1 ? 'undone entirely' : `${pctOf(reading.efficiency)} of it undone`;
  feed(
    state,
    `🪤 The ${e.name}'s ${spec.name} springs on your ${working.name}: ${pctOf(reading.efficiency)} efficiency, ${undone}, manaburn ${Math.round(burn)}.`,
  );

  const payload = counterPayload(spec);
  const fatal = payload ? resolveMonsterWorking(state, bus, e, es, payload, stats) : false;
  return { remaining: Math.max(0, 1 - reading.efficiency), fatal };
}

/**
 * What this specimen does with its turn: the first rotation entry that is
 * ready and open from where it stands, read top-down. Its Active Skills.
 *
 * Only two of `TechniqueDef`'s gates apply to a monster — where it can be
 * entered `from`, and its cooldown. Everything else models LEARNING (the
 * ledger, mastery, forks) or the player's kit (weapon family, wielded,
 * sheathed): a monster is authored with its techniques and carries no
 * equipment, so its tags stand in for what it fights with.
 */
function pickMonsterAction(
  state: GameState,
  e: MonsterInstance,
): { index: number; cast?: SpellSource; tech?: TechniqueDef } | null {
  const rotation = MONSTERS[e.defId]?.rotation;
  if (!rotation?.length || MONSTERS[e.defId]?.passive) return null;
  const here = e.position ?? NEUTRAL_POSITION;
  for (let index = 0; index < rotation.length; index++) {
    // One clock for the whole rotation, keyed by position in it.
    if ((e.cooldowns?.[index] ?? 0) > state.totalTicks) continue;
    const entry = rotation[index];
    // ...and, for anything it brought a finite supply of, one counter beside
    // the clock. An empty satchel falls through to whatever it can still do.
    if (entry.uses !== undefined && (e.spent?.[index] ?? 0) >= entry.uses) continue;
    if ('cast' in entry) {
      // An undoing is never its own turn's action: it waits in the rotation
      // for YOUR casting to spring it (answerPlayerWorking).
      if (specForSource(entry.cast).counter) continue;
      // A mind burned past empty cannot shape a working until it recovers —
      // it falls through to whatever else it can still do, or a plain swing.
      if (mindInDebt(e)) continue;
      return { index, cast: entry.cast };
    }
    const tech = TECHNIQUES[entry.technique];
    if (!tech) continue;
    // A monster has no ledger, so it reads the DECLARED ways only — practice
    // is a thing that happens to players.
    const from = declaredPositions(tech);
    if (from !== 'any' && !from.includes(here)) continue;
    return { index, tech };
  }
  return null;
}

/** What the action bar fills at while an incantation runs. 1 when none is. */
function incantFillMult(state: GameState): number {
  const spec = geneAbility(state)?.spec;
  return spec?.type === 'gene' && spec.incant ? spec.incant.fillMult : 1;
}

/**
 * THE END OF AN INCANTATION.
 *
 * The wind-up is not "a turn" — the bar keeps filling at `fillMult` throughout,
 * so what you actually pay is everything else you would have done in that
 * window. What lands is the ability's own spec, certain to crit.
 *
 * Reads the gene fresh rather than remembering what started it: swapping the
 * centromere mid-incantation stops it, which is the honest outcome for a thing
 * being spoken by a body that no longer exists.
 */
function landIncantation(state: GameState, bus: EventBus): void {
  const c = state.combat!;
  if (c.incantAt === undefined) return;
  const ability = geneAbility(state);
  const spec = ability?.spec.type === 'gene' ? ability.spec : null;
  if (!spec?.incant) {
    c.incantAt = undefined;
    return;
  }
  if (state.totalTicks < c.incantAt) return;
  c.incantAt = undefined;

  const monster = frontEnemy(c);
  if (!monster) return;
  const stats = getDerivedStats(state);
  const vs = getDerivedStats(state, monsterTagSet(monster.defId));
  const priced = priceGeneAbility(state, spec, vs, ability!.name, monster);
  // Certain, and then some: crit chance past 1 rolls AGAIN for a second
  // multiplier — which is what "can super-crit" has to mean in a system where
  // a crit is one boolean. Nobody reaches it without building for it.
  let mult = Math.max(1, vs.critDamage);
  const excess = vs.crit + spec.incant.critBonus - 1;
  if (excess > 0 && chance(state, Math.min(1, excess))) mult *= Math.max(1, vs.critDamage);

  const raw = priced.damage * mult;
  // The same `?? 'bludgeoning'` every other gene blow defaults to. It read
  // 'arcane' here alone, which meant an untyped wind-up landed as one thing and
  // was advertised as another.
  const type = spec.damageType ?? 'bludgeoning';
  const slice = monsterSlice(monster, type, ability!.name, raw, vs.penetration);
  const dealt = Math.max(1, Math.round(slice.dealt));
  monster.hp -= dealt;
  noteOutgoing(state, dealt);
  feed(state, `${ability!.icon} The incantation finishes, and ${ability!.name} arrives — ${dealt}.`, {
    label: ability!.name,
    target: monster.name,
    steps: [...priced.steps, { label: 'A crit it cannot miss', mult }],
    slices: [slice],
    hits: 1,
    crit: true,
    total: dealt,
  });
  // …and the same here: the harvest has to land, not merely be announced.
  const harvested = enemyTookDamage(state, monster, new Map([[type, dealt]]));
  if (harvested > 0) {
    const burned = Math.max(1, Math.round(harvested));
    monster.hp -= burned;
    noteOutgoing(state, burned);
  }
  applyStatuses(state, monster, geneInflicts(state, spec, monster), ability!.name);
  onCritLanded(state, monster, ability!.name);
  if (monster.hp <= 0) {
    const at = c.enemies.indexOf(monster);
    if (at >= 0) onKill(state, bus, at);
  }
  void stats;
}

/**
 * A COMMAND IS NOT A SWING.
 *
 * A wind-up BEGINS and a volley POINTS. Neither is aimed at anything yet, so
 * neither belongs in the to-hit sequence — resolved here, before it, rather
 * than exempted inside it, because "the wolf evades your incantation" is not a
 * sentence this fight should be able to produce. An evaded volley also swallowed
 * the whole ability: the branch that arms the blades sat past the dodge roll, so
 * a bad roll ate the action and left the cooldown unstamped.
 *
 * Returns true when it took the action.
 */
function beginUnaimed(
  state: GameState,
  active: ReturnType<typeof pickActive>,
  monster: MonsterInstance,
): boolean {
  const c = state.combat;
  const spec = active?.spec?.type === 'gene' ? active.spec : null;
  if (!c || !spec || (!spec.incant && !spec.volley)) return false;
  const ability = geneAbility(state);
  if (!ability) return false;
  const grade = expressedMain(chromosomeOf(state));

  if (spec.incant) {
    c.incantAt =
      state.totalTicks + Math.max(1, Math.round(atGrade(spec.incant.ticks, grade)));
    c.cooldowns[active!.id] = spec.cooldown;
    feed(state, `${ability.icon} You begin ${ability.name}. The world slows around it.`);
    // The wind-up eats what was left on the bar as well as the action that
    // started it — that is the "most of several turns" the cost is priced at.
    c.playerBar = 0;
    return true;
  }

  const slots = floatingSlots(state, bearerGrants(state));
  if (!slots.length) {
    feed(state, `${ability.icon} ${ability.name} — nothing is aloft to answer it.`);
  } else {
    const hits = Math.max(1, Math.round(atGrade(spec.volley!.hits, grade)));
    // Every blade turns AT ONCE, so the volley starts the rack over rather than
    // picking up wherever the background rotation happened to be — its first
    // folded line then covers a whole rotation, like any other.
    c.floating = { bar: 0, nth: 0, run: (c.floating?.run ?? 0) + 1 };
    // The name rides with the volley rather than being looked up as each strike
    // lands, so a centromere swapped mid-burst does not rename a volley already
    // in the air.
    c.volley = {
      left: hits,
      acc: 0,
      rate: hits / Math.max(1, spec.volley!.ticks),
      name: ability.name,
    };
    feed(state, `${ability.icon} ${ability.name} — every blade turns on the ${monster.name} at once.`);
  }
  c.cooldowns[active!.id] = spec.cooldown;
  return true;
}

/**
 * A gene ability's conditions, with their intensity re-read off THIS target
 * when the ability is target-priced.
 *
 * Asked per target rather than once per blow: a splash reaching four enemies
 * owes four different answers, because each of them has been feeding the fast
 * at their own rate. An ability with no `inflictRoot` gets its authored
 * intensities back untouched, so nothing existing changes shape.
 */
function geneInflicts(
  state: GameState,
  spec: GeneSpec,
  target: MonsterInstance,
): StatusApplication[] | undefined {
  const apps = spec.inflicts;
  if (!apps?.length) return apps;
  const at = perTargetInflictIntensity(spec, expressedMain(chromosomeOf(state)), target);
  return at === undefined ? apps : apps.map((a) => ({ ...a, intensity: at }));
}

/**
 * What a CRITICAL hit leaves behind beyond the blow, per the expressed gene.
 * Read off the gene rather than named in combat, so a second body wanting a
 * different on-crit rider needs nothing here.
 */
function onCritLanded(state: GameState, target: MonsterInstance, source: string): void {
  for (const app of expressedGene(state)?.onCrit ?? []) {
    applyStatus(state, target, app, source);
  }
}

/**
 * Strip every condition off everyone in the fight and report how many came
 * off. Counts INSTANCES, not stacks: three separate afflictions are three,
 * however deep any one of them ran.
 *
 * Deliberately indiscriminate — the player's own buffs and afflictions go with
 * everything else. A blow whose whole idea is erasure cannot be choosy about
 * what it erases without becoming a different, tamer ability.
 */
function clearField(state: GameState): number {
  const c = state.combat;
  if (!c) return 0;
  let torn = 0;
  for (const bearer of [state, ...c.enemies] as (GameState | MonsterInstance)[]) {
    if (!bearer) continue;
    for (const held of [...statusesOf(bearer)]) {
      removeStatus(bearer, held.id);
      torn += 1;
    }
  }
  return torn;
}

/**
 * ONE WORD, SPOKEN BY ITSELF, on the body's own clock.
 *
 * Beside the action bar rather than on it — a `tongues` body is saying things
 * while it does whatever else it was going to do, which is the whole difference
 * between this and an `ability`. It spends no mana: the words are not being
 * cast so much as leaking out.
 *
 * The rung climbs per WORD per FIGHT (`c.spoken`), so a mouth warms up over an
 * encounter and starts the next one quiet. `stacked` on the word already holds
 * the ladder, so escalating is a lookup and never a rule.
 */
function speakTongue(state: GameState, bus: EventBus): void {
  const c = state.combat!;
  const gene = expressedGene(state);
  const tongues = gene?.tongues;
  if (!tongues?.words.length) return;
  const held = expressedMain(chromosomeOf(state));
  const every = Math.max(1, Math.round(atGrade(tongues.everyTicks, held)));
  if ((c.tongueAt ?? 0) > state.totalTicks) return;
  // First tick in a fight arms the clock rather than firing, so an encounter
  // does not open with a free word before anyone has moved.
  if (c.tongueAt === undefined) {
    c.tongueAt = state.totalTicks + every;
    return;
  }
  c.tongueAt = state.totalTicks + every;
  if (!frontEnemy(c)) return;

  const word = tongues.words[randInt(state, 0, tongues.words.length - 1)];
  if (!c.spoken) c.spoken = {};
  c.spoken[word] = (c.spoken[word] ?? 0) + 1;
  const spoken = spokenAs(word, c.spoken[word]);
  const composed = composeArcane([spoken]);
  if (!composed) return;

  // Scaled where the strikes are read rather than by touching spell power, so
  // nothing else the body does is altered by how loudly it happens to be
  // talking. Costless on purpose — see above.
  const share = atGrade(tongues.power, held);
  const spec: SpellSpec = {
    ...composed,
    manaCost: 0,
    focusCost: 0,
    staminaCost: 0,
    cooldown: every,
    strikes: composed.strikes.map((strike) => ({ ...strike, power: strike.power * share })),
  };
  castCraftedAttack(state, bus, 'tongue', spec);
}

/**
 * Ticks before a monster may repeat a technique that declares no cooldown of
 * its own. A technique costs the PLAYER stamina and momentum, neither of which
 * a monster has, so a clock is the only thing stopping it spamming.
 */
const TECHNIQUE_MONSTER_COOLDOWN = 60;

/**
 * Mark one rotation entry as fired. Called wherever the entry's clock is
 * stamped, so a `uses` count and a cooldown always agree about what counts as
 * having used something.
 */
function spendMonsterAction(e: MonsterInstance, index: number): void {
  // NOT `(e.spent ??= {})[index]` — under Svelte's proxy that expression hands
  // back the RAW object and the write goes unseen.
  if (!e.spent) e.spent = {};
  e.spent[index] = (e.spent[index] ?? 0) + 1;
}

export function healEnemy(
  state: GameState,
  index: number,
  amount: number,
  source: string,
  /**
   * Life FORCED into them by a working aimed at them (the default), as
   * against kindness from their own side. The difference is the whole
   * mechanic: forced life accrues, kindness settles.
   */
  hostile = true,
): void {
  const c = state.combat;
  const target = c?.enemies[index];
  if (!c || !target || amount <= 0) return;
  const maxHp = monsterStats(target).maxHp;
  // Only what has somewhere to GO closes a wound; the rest simply arrives.
  const room = Math.max(0, maxHp - target.hp);
  let mending = Math.min(amount, room);

  /*
   * KINDNESS (from their own side) settles what is there: a third of it is
   * spent on the growth, and every point spent that way undoes three of the
   * surplus. Healing an overgrown creature is worse healing AND the fastest
   * cure for it — the tension the mechanic runs on. Nothing in the game
   * heals monsters this way yet; the path exists for enemy healers.
   */
  const swollen = findStatus(target, 'proliferating') ?? findStatus(target, 'overgrowth');
  if (!hostile) {
    if (mending > 0 && swollen?.data?.surplus) {
      const withheld = mending * OVERGROWTH_HEAL_TAX;
      mending -= withheld;
      swollen.data.surplus = Math.max(0, swollen.data.surplus - withheld / OVERGROWTH_HEAL_TAX);
      if (swollen.data.surplus <= 0) {
        removeStatus(target, swollen.id);
        feed(state, `🌿 The growth in the ${target.name} subsides.`);
      }
    }
    if (mending > 0) target.hp += mending;
    feed(state, `💚 ${source} knits the ${target.name} back together.`);
    return;
  }

  /*
   * FORCED LIFE accrues in FULL, whether it found a wound or not. A body can
   * only take so much life pushed into it, and closing a wound on the way is
   * the price you pay rather than a discount — which is what makes the
   * working worth speaking at a target that is not already whole.
   */
  if (mending > 0) target.hp += mending;

  // The ledger rides whichever rung of the ladder is already held.
  let held = swollen;
  held ??= applyStatus(state, target, { id: 'overgrowth', intensity: 1 }, source) ?? undefined;
  if (!held) return;
  held.data = held.data ?? {};
  held.data.surplus = (held.data.surplus ?? 0) + amount;
  // Feeding it keeps the clock wound.
  const def = STATUSES[held.id];
  if (held.ticksLeft !== null && def?.duration) held.ticksLeft = def.duration;

  const surplus = held.data.surplus;
  const cfg = def?.surplus;
  if (cfg?.escalateAt !== undefined && def?.escalatesTo && surplus >= maxHp * cfg.escalateAt) {
    removeStatus(target, held.id);
    const next = applyStatus(state, target, { id: def.escalatesTo, intensity: held.intensity }, source);
    if (next) (next.data ??= {}).surplus = surplus;
    feed(state, `🧬 The growth inside the ${target.name} takes on a will of its own!`);
    return;
  }
  if (cfg?.detonateAt !== undefined && surplus >= maxHp * cfg.detonateAt) {
    // The body cannot hold it: the bearer takes the whole ledger...
    removeStatus(target, held.id);
    target.hp -= surplus;
    feed(state, `💥 The ${target.name} bursts under its own abundance!`);
    // ...and everything fighting beside it is showered.
    const type = cfg.detonateType ?? 'poison';
    for (let i = 0; i < c.enemies.length; i++) {
      const other = c.enemies[i];
      if (!other || i === index) continue;
      const slice = monsterSlice(other, type, source, surplus * (cfg.detonateShare ?? 0.5));
      const dealt = Math.max(1, Math.round(slice.dealt));
      other.hp -= dealt;
      feed(state, `💥 The burst showers the ${other.name} for ${dealt} ${type}.`);
    }
    return;
  }
  feed(state, `🌿 The ${target.name} swells with unwanted life.`);
}

/** How a crafted attack is being delivered, when it is not an ordinary cast. */
export interface CastOptions {
  /**
   * A counterspell's payload, sprung inside somebody else's casting: already
   * paid for, clocked, argued with and trained by the spring, not itself
   * answerable (an undoing's own words cannot be undone), and aimed at the
   * caster whose working it answered — for a flanker, the only way it is
   * ever reached.
   */
  spring?: { aimAt: number };
}

/**
 * Cast a prepared offensive spell on the player's swing. This is what the
 * weapon path cannot express: several typed strikes per cast, a clause landing
 * twice, a broadside across the whole formation, conditions riding each
 * strike. Returns true when the player phase should end — the front slot was
 * killed, or the fight is over.
 */
export function castCraftedAttack(
  state: GameState,
  bus: EventBus,
  id: string,
  spec: SpellSpec,
  opts: CastOptions = {},
): boolean {
  const c = state.combat!;
  noteTollSpell(state, bus);
  const stats = getDerivedStats(state);
  if (!opts.spring) {
    /*
     * A refuting body argues with EVERY working in the fight, and its own hands
     * are not exempt — that is the cost of wearing it. Rolled before anything
     * resolves but after the price is known, because a refused working still
     * costs what it cost: the argument is the expensive part.
     */
    const refusal = refuteCast(state, id, spec.manaCost * stats.manaEff);
    if (refusal.negated) {
      spendResource(state, 'mana', spec.manaCost * stats.manaEff);
      c.cooldowns[id] = spec.cooldown;
      if (refusal.backlash > 0) damagePlayer(state, refusal.backlash, 'arcane');
      feed(
        state,
        refusal.sealed
          ? `🚫 ${spec.name} is refused, and will not be spoken again this fight.`
          : `🚫 ${spec.name} is refused before it can finish.`,
      );
      return !isAlive(state);
    }
    spendResource(state, 'mana', spec.manaCost * stats.manaEff);
    // A psionic working is paid for out of the mind's own pool (see castSpell).
    if (spec.focusCost) spendResource(state, 'focus', spec.focusCost);
    // Some miracles are paid for in breath as well as mana (Redouble Venom).
    if (spec.staminaCost) drawStamina(state, stats, spec.staminaCost);
    c.cooldowns[id] = spec.cooldown;

    // An enemy's undoing may be lying in wait for exactly this. What it leaves
    // is what lands; what it costs you, you have already paid.
    const answer = answerPlayerWorking(state, bus, spec);
    if (answer.fatal || !state.combat) return true;
    if (answer.remaining <= 0) {
      feed(state, `↩️ ${spec.name} comes apart before it can land.`);
      attackCastXp(state, bus, id, spec);
      return sweepDead(state, bus);
    }
    if (answer.remaining < 1) spec = undoWorking(spec, answer.remaining);
  }
  /** Who the working is aimed at: the front, or the caster a spring answered. */
  const aim = opts.spring?.aimAt ?? 0;

  // Divine resonance and affliction-feeding, resolved once per cast.
  const synergy = miracleSynergy(state, c, spec);
  if (synergy > 1) feed(state, `✨ ${spec.name} resonates with the miracle before it.`);
  const empowered =
    spec.empowered && anyAfflicted(state, c, spec.empowered.statuses) ? spec.empowered.mult : 1;
  if (empowered > 1) feed(state, `${spec.icon} ${spec.name} feeds on the poison in the air.`);
  const castMult = synergy * empowered;

  // Strip the caster's own afflictions and deliver them to the front enemy,
  // with interest — Venom Feast's whole idea.
  if (spec.transfers && c.enemies[aim]) {
    const taken = stripStatuses(state, spec.transfers.statuses);
    if (taken.length) {
      for (const t of taken) {
        applyStatus(
          state,
          c.enemies[aim]!,
          { id: t.id, intensity: t.intensity * spec.transfers.mult },
          spec.name,
        );
      }
      feed(state, `${spec.icon} ${spec.name} strips your affliction and delivers it, sharpened.`);
    }
  }

  const targets =
    spec.target === 'others'
      ? c.enemies.map((e, i) => (e ? i : -1)).filter((i) => i >= 0)
      : [aim];
  // A broadside thins the working across everyone it addresses.
  const share = spec.target === 'others' ? OTHERS_POWER : 1;

  // "or": one alternative per group is rolled for the whole cast, so a
  // broadside speaks the same word to everyone it addresses.
  let rolledOut: Set<SpellStrike> | null = null;
  {
    const groups = new Map<number, SpellStrike[]>();
    for (const s of spec.strikes) {
      if (s.altGroup === undefined) continue;
      (groups.get(s.altGroup) ?? groups.set(s.altGroup, []).get(s.altGroup)!).push(s);
    }
    for (const members of groups.values()) {
      const kept = members[randInt(state, 0, members.length - 1)];
      for (const m of members) {
        if (m === kept) continue;
        (rolledOut ??= new Set()).add(m);
      }
    }
  }

  let mainRaw = 0;
  for (const idx of targets) {
    const target = c.enemies[idx];
    if (!target) continue;
    // Hunter bonuses resolve against each victim separately, like weapon blows.
    const vs = getDerivedStats(state, monsterTagSet(target.defId));
    const slices = new Map<string, DamageSlice>();
    const steps: DamageStep[] = [{ label: 'Spell Power', value: vs.spellPower }];
    const powerMult =
      spec.strikes.reduce((s, st) => s + st.power * (st.hits ?? 1), 0) * share * castMult;
    if (powerMult !== 1) steps.push({ label: spec.name, mult: powerMult });
    steps.push({ label: 'Variance ±10%' });

    let total = 0;
    let anyCrit = false;
    // "Then" bookkeeping: a follow-up strike hits harder only if the strike
    // before it in the volley actually landed on THIS target.
    let prevLanded = false;
    for (const strike of spec.strikes) {
      // An alternative the roll passed over this cast.
      if (rolledOut?.has(strike)) continue;
      // A conditioned strike fires only while the target bears the named
      // affliction; unmet, it simply is not spoken — and breaks any chain.
      if (
        strike.onlyIf &&
        !strike.onlyIf.some((id) => statusesOf(target).some((s) => s.id === id))
      ) {
        prevLanded = false;
        continue;
      }
      const follow = strike.followUp && prevLanded ? strike.followUp : 1;
      let landedAny = false;
      for (let h = 0; h < (strike.hits ?? 1); h++) {
        // Spells crit like blows do — and iron already in the target makes
        // a piercing working far likelier to find the seam. A lock holding
        // a charge discharges the whole of it into whichever blow crits.
        const critChance = Math.max(
          0,
          vs.crit + (strike.critBonus ?? 0) + magnetCritChance(target, strike.type),
        );
        const critted = procChance(state, PLAYER_CRIT, critChance);
        let critMult = 1;
        if (critted) {
          anyCrit = true;
          // A crit is never worse than an ordinary blow, however gently spoken.
          critMult = Math.max(
            1,
            vs.critDamage + (strike.critDamageBonus ?? 0) + consumeMagnetCharge(target),
          );
        }
        const raw =
          vs.spellPower * strike.power * share * castMult * follow * critMult * (0.9 + rand(state) * 0.2);
        if (idx === aim) mainRaw += raw;
        // A twin-natured strike lands as whichever type the target guards worse.
        const type =
          strike.orType && resistanceOf(target, strike.orType) < resistanceOf(target, strike.type)
            ? strike.orType
            : strike.type;
        // Untyped is nothing in particular: resistance and weakness alike
        // have nothing to say to it. The raw number simply lands.
        const landed: DamageSlice = strike.untyped
          ? { type, source: spec.name, raw, armor: 0, resisted: 0, resistance: 0, pierced: 0, dealt: raw }
          : monsterSlice(
              target,
              type,
              spec.name,
              raw,
              Math.min(0.95, vs.penetration + (strike.penetration ?? 0)),
            );
        addSlice(slices, landed);
        total += landed.dealt;
        if (landed.dealt > 0) {
          landedAny = true;
          const reacted = reactTollGolem(state, target, type);
          if (reacted && h === 0) feed(state, type === 'heat'
            ? '♨️ Water bursts into steam. The collector stamps blindly through the cloud.'
            : type === 'cold' ? '🧊 Ice locks the collector in place and prises its armor apart.'
            : '⚡ The collector stamps faster. Each stroke tears through its own mechanism.');
          for (const app of strike.inflicts ?? []) applyStatus(state, target, app, spec.name);
        }
      }
      prevLanded = landedAny;
    }
    // The working itself arriving, as opposed to a rider on a blow: these land
    // whether or not anything was struck, which is the whole point of them
    // (see SpellSpec.afflicts). A shape that only exposes someone has no hit
    // to hang them on.
    for (const app of spec.afflicts ?? []) applyStatus(state, target, app, spec.name);
    // A working with nothing to land — a mending poured into an enemy, or a
    // sentence whose every strike was conditioned out this cast — deals no
    // damage and says nothing. Its own machinery does the talking.
    if (slices.size > 0) {
      // An ambushed target takes the working harder (StatusDef.incomingBite);
      // the damageTaken event just below is what spends the surprise.
      const bite = statusIncomingDamageMult(target);
      if (bite !== 1) steps.push({ label: 'Caught off guard', mult: bite });
      const dmg = Math.max(1, Math.round(total * bite));
      target.hp -= dmg;
      // A working can land several types at once; each one gets its own say.
      const harvested = enemyTookDamage(state, target, dealtByType(slices));
      if (harvested > 0) {
        const burned = Math.max(1, Math.round(harvested));
        target.hp -= burned;
        noteOutgoing(state, burned);
      }
      if (anyCrit) {
        markCombatEvent(state, 'onCrit');
        onCritLanded(state, target, spec.name);
      }
      feed(
        state,
        `${spec.icon} ${spec.name} strikes the ${target.name} for ${dmg}${anyCrit ? ' — CRIT!' : ''}.`,
        {
          label: spec.name,
          target: target.name,
          steps,
          slices: [...slices.values()],
          hits: 1,
          crit: anyCrit,
          total: dmg,
        },
      );
    }
  }

  // Spill from a single-target working that was told to be bigger ("expand").
  if (spec.target !== 'others' && (spec.splash ?? 0) > 0) {
    const flanks = c.enemies.map((e, i) => (e && i !== aim ? i : -1)).filter((i) => i >= 0);
    if (flanks.length > 0) {
      const idx = flanks[randInt(state, 0, flanks.length - 1)];
      const other = c.enemies[idx]!;
      const slice = monsterSlice(other, spec.strikes[0]?.type ?? 'arcane', spec.name, mainRaw * (spec.splash ?? 0));
      const spill = Math.max(1, Math.round(slice.dealt));
      other.hp -= spill;
      feed(state, `↯ ${spec.name} spills into the ${other.name} for ${spill}`);
    }
  }

  // A venom already at work on the front enemy is redoubled and refreshed —
  // after the strike, so the miracle's own fresh poison counts too.
  const aimed = c.enemies[aim];
  if (spec.amplify && aimed) {
    const touched = amplifyStatuses(aimed, spec.amplify.statuses, spec.amplify.mult);
    if (touched > 0) {
      feed(state, `${spec.icon} The venom in the ${aimed.name} redoubles.`);
    }
  }

  // Riders on a spell that also tends its caster (a mending clause mid-volley)
  // — unless the mending was ADDRESSED: then it pours into the enemy, and a
  // body already whole has nowhere to put it.
  if (spec.heal && spec.healsEnemy) {
    for (const idx of targets) {
      healEnemy(state, idx, spec.heal * stats.spellPower * castMult * share, spec.name);
    }
  } else if (spec.heal) {
    const healed = heal(state, stats, spec.heal * stats.spellPower * castMult, 'spell');
    if (healed > 0) feed(state, `💚 ${spec.name} knits ${Math.round(healed)} health back.`);
  }
  applySelfRiders(state, c, spec);

  if (applyRetaliation(state, bus, 'onAttack')) return true;

  // A spring's payload was trained by the spring that carried it.
  if (!opts.spring) attackCastXp(state, bus, id, spec);

  return sweepDead(state, bus);
}

/** What an offensive cast teaches — whether or not anything survived to land. */
function attackCastXp(state: GameState, bus: EventBus, id: string, spec: SpellSpec): void {
  grantAttrXp(state, bus, 'int', 3);
  const tags = ['combat', 'magic', spec.school];
  checkDiscovery(state, bus, tags);
  grantSkillXp(state, bus, tags, 4);
  if (id.startsWith('grimoire:')) grantCastWordXp(state, bus, Number(id.slice(9)));
  bus.emit({ type: 'tick:action', tags, skillXp: 0 });
}

/**
 * Clear the corpses after something struck several enemies at once. Worked from
 * the flanks inward, so the survivor swapped into a killed front slot can never
 * be skipped or counted twice. Returns true when the player's phase should end —
 * the front slot died, or the fight did.
 */
export function sweepDead(state: GameState, bus: EventBus): boolean {
  const c = state.combat;
  if (!c) return true;
  let frontDied = false;
  for (let i = c.enemies.length - 1; i >= 0; i--) {
    const e = c.enemies[i];
    if (!e || e.hp > 0) continue;
    if (i === 0) frontDied = true;
    onKill(state, bus, i);
    if (!state.combat) return true;
  }
  return frontDied;
}

/**
 * Damage a condition deals as the player's action bar fills or bottoms out —
 * a jolt discharging, a shock landing. Returns true if it proved fatal.
 *
 * A jolt that drives you under half your health also makes you drop what you
 * are holding; that is the whole point of being jolted.
 */
function applyBarDamage(state: GameState, bus: EventBus, when: 'onFill' | 'onDeplete'): boolean {
  const stats = getDerivedStats(state);
  for (const hit of statusBarDamage(state, when)) {
    const slice = incomingSlice(stats, hit.type, hit.name, hit.amount);
    const dealt = slice.dealt;
    damagePlayer(state, dealt);
    feed(state, `${hit.icon} ${hit.name} discharges for ${dealt} ${hit.type}.`, {
      label: hit.name,
      target: 'You',
      steps: [{ label: hit.name, value: hit.amount }],
      slices: [slice],
      hits: 1,
      crit: false,
      incoming: true,
      total: dealt,
    });
    if (!isAlive(state)) {
      onDefeat(state, bus);
      return true;
    }
    // Convulsing that hard loses you your grip.
    if (
      hit.dropWeaponBelow !== undefined &&
      state.equipment.weapon &&
      resourceValue(state, 'hp') < availableMax(state, stats, 'hp') * hit.dropWeaponBelow
    ) {
      const name = ITEMS[state.equipment.weapon.defId]?.name ?? 'your weapon';
      unequipSlot(state, 'weapon');
      bus.emit({ type: 'log', msg: text('combat.weapon_dropped', { name }), kind: 'danger' });
      feed(state, `⚡ You drop ${name}!`);
    }
  }
  return false;
}

/**
 * The same discharge, on the other side of the fight. Returns true if it killed
 * the monster.
 *
 * This existed for the player alone for a long time, and the omission was
 * quiet in the worst way: `StatusDef.bar` is the whole reason `jolted` and
 * `shocked` are interesting, and on a monster none of it ran. A jolt never
 * discharged its 1.2, a shock never reversed the bar, never bottomed out and so
 * never fired its 2.5 — and since `barDeplete` is one of only two exits shocked
 * has, shocking something did nothing at all except pile up on it until the
 * fight ended. Anything reading `bar` must be mirrored here, both ways.
 */
function applyMonsterBarDamage(
  state: GameState,
  e: MonsterInstance,
  when: 'onFill' | 'onDeplete',
): boolean {
  for (const hit of statusBarDamage(e, when)) {
    const slice = monsterSlice(e, hit.type, hit.name, hit.amount, 0);
    e.hp -= slice.dealt;
    feed(state, `${hit.icon} ${hit.name} discharges through the ${e.name} for ${slice.dealt} ${hit.type}.`);
    if (e.hp <= 0) return true;
  }
  return false;
}

/**
 * Conditions that strike back at their own bearer when they act or are struck.
 * Returns true if the recoil proved fatal.
 */
function applyRetaliation(state: GameState, bus: EventBus, when: 'onAttack' | 'onContact'): boolean {
  const back = statusRetaliation(state, when);
  if (back.length === 0) return false;
  const stats = getDerivedStats(state);
  for (const r of back) {
    const dealt = incomingSlice(stats, r.type, r.name, r.amount).dealt;
    damagePlayer(state, dealt);
    feed(state, `${r.icon} ${r.name} tears at you for ${dealt} ${r.type}.`);
    for (const app of r.inflicts ?? []) applyStatus(state, state, app, r.name, stats);
    if (!isAlive(state)) {
      onDefeat(state, bus);
      return true;
    }
  }
  return false;
}

/**
 * One tick of every enemy's conditions. Damage is applied here rather than
 * inside statuses.ts, which reports what it wants to deal and leaves the
 * applying to whoever owns the target (see the note atop that module).
 */
/**
 * Where the player's motion actually ends. A technique names its exit; the
 * wind may take it. Legal under MARTIAL.md §9 — a single node's exit rewritten,
 * never an edge list — and deliberately NOT applied to a plain swing's recovery,
 * which stays the way out.
 *
 * Never routed through `techniqueExit` itself: that is a pure query the planner
 * draws the graph from, and a displaced answer there would make the graph lie.
 */
function displacedExit(state: GameState, to: string): string {
  return statusDisplacedExit(state, state) ?? to;
}

/**
 * A blow has landed on an enemy: tell its conditions, in the damage's own type.
 *
 * Typed rules could not fire on a monster before this. Both enemy damage sites
 * announced `damageTaken` with no detail, so every rule carrying `damageTypes`
 * — fire driving off a soaking, fire burning off a seed — silently failed its
 * check and did nothing. Elemental relations only mean anything if the event
 * says which element it was.
 *
 * Returns the damage a burned-off graft ledger paid out, for the caller to
 * apply. Read before the event, because the removal the event triggers is what
 * empties the ledger.
 */
function enemyTookDamage(
  state: GameState,
  monster: MonsterInstance,
  dealt: Map<DamageType, number>,
): number {
  if (dealt.size === 0) {
    fireStatusEvent(state, monster, 'damageTaken');
    return 0;
  }
  let harvested = 0;
  for (const [type, amount] of dealt) {
    for (const h of graftHarvest(monster, type)) {
      harvested += h.amount;
      feed(
        state,
        `${h.icon} What took root in the ${monster.name} goes up with it — ${Math.round(h.amount)} ${h.type}.`,
      );
    }
    // Water feeds a seed, metal cuts it, everything else prunes it back.
    tendOnDamage(monster, type);
    // The AMOUNT rides along too, for rules that answer to how hard rather
    // than how often (StatusRemoval.afterDamage).
    fireStatusEvent(state, monster, 'damageTaken', { damageType: type, amount });
  }
  return harvested;
}

/**
 * Damage dealt per TYPE, folded out of a slice map.
 *
 * ⚠️ `addSlice` keys its map by `type|source`, not by type — so reading the
 * keys as damage types yields "cold|Frost Bolt" and every `damageTypes` rule
 * downstream silently fails to match. That was live on the crafted-spell path,
 * which is precisely the failure `enemyTookDamage` was written to end.
 */
function dealtByType(slices: Map<string, DamageSlice>): Map<DamageType, number> {
  const out = new Map<DamageType, number>();
  for (const slice of slices.values()) {
    out.set(slice.type, (out.get(slice.type) ?? 0) + slice.dealt);
  }
  return out;
}

/**
 * Whether something burning or dissolving is stopping this thing knitting.
 *
 * The monster-side mirror of health.ts's `dousesRegen`, and deliberately the
 * same two elements: a wound that is still being worked on does not close. It
 * reads the CONDITIONS rather than the last blow because a monster has no
 * damage-taken hook to hang a `doused` status on — being on fire IS the state.
 */
function regenDoused(e: MonsterInstance): boolean {
  return statusesOf(e).some((s) => {
    const element = STATUSES[s.id]?.element;
    return !!element && DOUSING_TYPES.has(element);
  });
}

function tickEnemyRegen(state: GameState, c: CombatState): void {
  const tally: LogTally[] = [];
  for (const e of c.enemies) {
    if (!e || e.hp <= 0) continue;
    const stats = monsterStats(e);
    if (stats.hpRegen <= 0 || regenDoused(e)) continue;
    const before = e.hp;
    e.hp = Math.min(stats.maxHp, e.hp + stats.maxHp * stats.hpRegen);
    // Only worth a line when it actually undid something — a thing already at
    // full health quietly regenerating is not news.
    if (e.hp - before >= 1) {
      tally.push({ label: e.name, qty: Math.round(e.hp - before), style: 'amount' });
    }
  }
  // Floating for the whole line-up, the same way afflictions report — a thing
  // that knits itself shut every tick fills a ten-line feed exactly as fast as
  // a poison does, and for the same reason.
  if (tally.length > 0) {
    feedFloating(state, {
      group: 'regen:foes',
      prefix: '🌿 Knitting shut:',
      tally,
      // Regeneration is not a status, so there is no id to watch. The run is
      // keyed on the fight itself and ends when nothing can still knit.
      ids: ['regen'],
    });
  }
  // Ends when nobody left standing is able to heal — a property of the fight
  // rather than of this tick, so a full-health moment does not close it.
  settleWhen(state, 'regen:foes', () =>
    c.enemies.some((e) => e && e.hp > 0 && monsterStats(e).hpRegen > 0 && !regenDoused(e)),
  );
}

function tickEnemyStatuses(state: GameState, bus: EventBus, c: CombatState): void {
  for (let i = 0; i < c.enemies.length; i++) {
    const e = c.enemies[i];
    if (!e || statusesOf(e).length === 0) continue;

    // A matured root network carries what it learned to everything else in the
    // fight. Distribution belongs here rather than in statuses.ts, which never
    // sees the enemy line-up — the same division of labour a surplus
    // detonation already uses.
    const carried = dueGraftSpread(state, e);
    if (carried) {
      let reached = 0;
      for (let j = 0; j < c.enemies.length; j++) {
        const other = c.enemies[j];
        if (!other || j === i || other.hp <= 0) continue;
        for (const graft of carried) {
          applyStatus(state, other, { id: graft.id, intensity: graft.intensity }, 'rootbound');
        }
        reached += 1;
      }
      if (reached > 0) {
        feed(state, `🌳 The roots under the ${e.name} carry what is in it to ${reached} more.`);
      }
    }

    const mind = monsterMind(e);
    const result = tickStatuses(state, e, {
      hp: e.hp,
      maxHp: monsterStats(e).maxHp,
      inCombat: true,
      // The one pool a monster has for a condition to eat (see monsterMind).
      pools: { mana: { current: mind.current, trueMax: mind.max } },
    });
    const detonated = burnMind(state, e, mind, result);
    if (result.damage <= 0) {
      if (detonated && e.hp <= 0) {
        onKill(state, bus, i);
        if (!state.combat) return;
      }
      continue;
    }
    const dealt = Math.max(1, Math.round(result.damage));
    e.hp -= dealt;
    // A bleed you put on it is damage you dealt — it just arrives on its own
    // schedule. Counting it keeps "what you did" honest for condition builds.
    noteOutgoing(state, dealt);
    // Every condition that landed, not just the worst of them, into ONE
    // floating run for the whole enemy line-up — never a line of its own. One
    // group rather than one per specimen on purpose: two enemies bleeding on
    // alternating keys would otherwise each end the other's run.
    feedFloating(state, {
      group: 'cond:foes',
      prefix: '🩸 Afflictions:',
      tally: result.hits.map((h) => ({
        label: `${h.icon} ${e.name} ${h.name.toLowerCase()}`,
        qty: h.amount,
        style: 'amount' as const,
      })),
      ids: result.hits.map((h) => h.id),
    });
    if (e.hp <= 0) {
      onKill(state, bus, i);
      if (!state.combat) return;
    }
  }
  settleWhen(state, 'cond:foes', (run) =>
    run.ids.some((id: string) => c.enemies.some((e) => e && e.hp > 0 && statusesOf(e).some((s) => s.id === id))),
  );
}

/**
 * What a condition ate out of a monster's MIND this tick, and what went off.
 *
 * The drain comes off the notional pool, into debt as far as the burn's own
 * headroom allows — exactly `drainIntoDebt`'s rule for the player. A debt
 * that bottoms out detonates as the player's does: arcane, most resistance no
 * help, because it was already inside them. Returns whether anything went off.
 */
function burnMind(
  state: GameState,
  e: MonsterInstance,
  mind: ReturnType<typeof monsterMind>,
  result: ReturnType<typeof tickStatuses>,
): boolean {
  let mana = mind.current;
  for (const drain of result.drains) {
    if (drain.resource !== 'mana') continue;
    mana = Math.max(-statusNegativeHeadroom(e, 'mana', mind.max), mana - drain.amount);
  }
  if (mana !== mind.current) e.mana = mana;
  for (const boom of result.detonations) {
    const res = Math.max(-1, Math.min(0.9, monsterStats(e).resistances[boom.type] ?? 0)) * (1 - boom.bypassRes);
    const dealt = Math.max(1, Math.round(boom.amount * (1 - res)));
    e.hp -= dealt;
    noteOutgoing(state, dealt);
    feed(state, `${boom.icon} The ${boom.name.toLowerCase()} in the ${e.name} goes off for ${dealt} ${boom.type}.`);
  }
  return result.detonations.length > 0;
}

/**
 * A burned mind recovering at the player's own rate (monsterMind). Only a
 * mind something has touched is tracked at all; back at full, it forgets.
 */
function tickEnemyMinds(c: CombatState): void {
  for (const e of c.enemies) {
    if (!e || e.mana === undefined) continue;
    const mind = monsterMind(e);
    const next = e.mana + mind.regen / TPS;
    if (next >= mind.max) delete e.mana;
    else e.mana = next;
  }
}

/**
 * End a floating run once nothing is feeding it any more.
 *
 * `stillGoing` asks about the FIGHT, not about this tick. Conditions and
 * regeneration both run on their own clocks, so "nothing happened this tick" is
 * the normal case mid-poison and would settle the line over and over — one
 * stuck line per quiet tick, which is the spam this replaced.
 */
function settleWhen(
  state: GameState,
  group: string,
  stillGoing: (run: FloatingAffliction) => boolean,
): void {
  const run = floatingRun(state, group);
  if (run && !stillGoing(run)) settleFloating(state, group);
}

// ---------- Per-tick combat resolution ----------

export function tickCombat(state: GameState, bus: EventBus, spot: SpotDef): void {
  if (!state.combat) {
    // The fight is over however it ended, so anything still floating belongs to
    // it and settles now. Here rather than in each of the ways a fight can end
    // — won, fled, abandoned, knocked out — because this runs after all of them
    // and a run carried into the next encounter would tally two fights as one.
    settleFloating(state, 'cond:foes');
    settleFloating(state, 'regen:foes');
    // …and whatever the blades were mid-rotation on. Every run, not just the
    // newest: a fight that ended during a volley leaves two open at once.
    for (const g of (state.floatingFeed ?? []).map((f) => f.group)) {
      if (g.startsWith('telekinesis:')) settleFloating(state, g);
    }
    if (state.respawnTimer > 0) {
      state.respawnTimer -= 1;
      return;
    }
    // A cleared spot spawns nothing, and neither does a table whose every
    // line is gated or already slain — the hunt simply finds no one.
    if (spotCleared(state, spot) || !eligibleEncounters(state, spot).length) return;
    // The player's own rule: below the threshold, rest before the next one.
    if (holdNextFight(state, bus)) return;
    startEncounter(state, bus, spot);
    return;
  }

  const c = state.combat;

  if (c.introTicks && c.introTicks > 0) {
    if (c.introTicks === 30 || c.introTicks === 20) feed(state, '“Please provide documents.”');
    if (c.introTicks === 10) feed(state, '“Procedural flow is being impaired. Removing interrupting entity.”');
    c.introTicks -= 1;
    return;
  }

  for (const id of Object.keys(c.cooldowns)) {
    if (c.cooldowns[id] > 0) c.cooldowns[id] -= 1;
  }
  c.buffs = c.buffs.filter((b) => (b.ticksLeft -= 1) > 0);

  // The fight's own counters may have crossed a self-learn threshold last
  // tick — rough techniques crystallize here, where the practice happened.
  checkTechniqueLearning(state, bus);

  const stats = getDerivedStats(state);

  // Afflictions burn down first, and can finish a fight on their own — a
  // monster that bleeds out before you swing is still a kill.
  tickEnemyStatuses(state, bus, c);
  if (!state.combat) return;
  // Then whatever knits itself back up, AFTER the conditions have bitten — so
  // a burn that suppresses regeneration gets to land its tick first, and a
  // regenerating thing can never out-heal the very damage that stops it.
  tickEnemyRegen(state, c);
  tickEnemyMinds(c);

  speakTongue(state, bus);
  if (!state.combat) return;
  landIncantation(state, bus);
  if (!state.combat) return;

  const front = frontEnemy(c);
  if (!front) {
    // Every slot emptied (shouldn't happen — onKill ends the encounter first).
    closeCombat(state);
    state.respawnTimer = RESPAWN_DELAY;
    return;
  }
  const monster = front;
  const tags = combatTags(state);
  // The stance's stamina bargain: struck on your swing, or on theirs.
  const exertion = effectiveStyleDef(state).exertion;
  const attackExertion = exertion?.on === 'attack' ? exertion : undefined;
  const defendExertion = exertion?.on === 'defend' ? exertion : undefined;

  // Buff-type actives fire as soon as available.
  const buffSkill = pickActive(state, 'buff', stats);
  if (buffSkill?.crafted) {
    // A crafted spell aimed at its own caster. May be the last thing they do.
    if (castCraftedSelf(state, bus, buffSkill.id, buffSkill.crafted, stats)) return;
  } else if (buffSkill?.technique) {
    // A defensive form: the reflex answers, the body moves, the guard holds.
    const def = buffSkill.technique;
    const move = resolvedMove(state, def);
    // Readying a working pays its mana NOW — carrying it is the commitment,
    // and a plain swing that dumps you out of the seat wastes it.
    const readied = move.readiesSpell ? readyableSpell(state, stats) : null;
    if (move.readiesSpell && !readied) {
      // Nothing prepared that can be paid for: the form simply does not come.
    } else {
      if (readied) {
        spendResource(state, 'mana', readied.cost);
        c.readiedSpell = readied.uid;
      }
      if (move.buff) {
        c.buffs.push({ name: def.name, mods: move.buff.mods, ticksLeft: move.buff.duration });
      }
      if (move.staminaCost) drawStamina(state, stats, stats.maxStamina * move.staminaCost * stats.staminaEff);
      c.cooldowns[buffSkill.id] = move.cooldown;
      const exit = techniqueExit(state, def);
      setPosition(state, exit);
      if (readied) {
        const held = findSpell(state, readied.uid);
        feed(
          state,
          `🔮 ${def.name} — ${held ? resolveSpellFor(state, held).name : 'a working'} waits at your fingertips.`,
        );
      } else {
        feed(state, `${def.icon} ${def.name} — you settle ${POSITIONS[exit]?.name ?? exit}.`);
      }
      const reached = recordExecution(state, def);
      if (reached) feed(state, `🎓 ${def.name} — ${reached.name}.`);
      grantAttrXp(state, bus, 'dex', 2);
      grantSkillXp(state, bus, ['combat', ...(def.family ? [def.family] : [])], 3);
    }
  } else if (buffSkill?.spec?.type === 'buff') {
    // A gene's buff has no skill behind it — the body itself is the source —
    // so name, icon and the tags it pays XP to come from the ability.
    const gene = buffSkill.id === GENE_ACTIVE ? geneAbility(state) : undefined;
    const def = gene
      ? { name: gene.name, icon: gene.icon, tags: ['combat', 'geneshaping'] }
      : SKILLS[buffSkill.id];
    c.buffs.push({ name: def.name, mods: buffSkill.spec.mods, ticksLeft: buffSkill.spec.duration });
    c.cooldowns[buffSkill.id] = buffSkill.spec.cooldown;
    feed(state, `${def.icon} You use ${def.name}!`);
    grantSkillXp(state, bus, def.tags, 3);
  }

  // --- Weapons the mind holds: their own clock, before yours ---
  if (tickFloatingWeapons(state, bus, stats)) return;

  // --- Player attack (yellow action bar fills at speed × attackSpeed) ---
  // A shock runs the bar BACKWARDS at the same rate it would have filled.
  const reversed = statusReversesBar(state);
  // An incantation does not stop the bar, it drags on it — which is what makes
  // the wind-up cost "most of several turns" rather than one, and what stops it
  // being a free action with a delay bolted on.
  const dragging = c.incantAt !== undefined ? incantFillMult(state) : 1;
  c.playerBar += (reversed ? -attackFillRate(stats) : attackFillRate(stats)) * dragging;

  if (reversed && c.playerBar <= 0) {
    c.playerBar = 0;
    if (applyBarDamage(state, bus, 'onDeplete')) return;
    fireStatusEvent(state, state, 'barDeplete');
  }

  if (!reversed && c.playerBar >= stats.actionBar) {
    c.playerBar -= stats.actionBar;
    // Whatever is riding the bar discharges as it completes, before the swing.
    if (applyBarDamage(state, bus, 'onFill')) return;
    const skipped = consumeSkippedAction(state);
    fireStatusEvent(state, state, 'barFill');
    if (skipped || statusBlocks(state, 'attack')) {
      feed(state, `😵 You cannot bring yourself to act.`);
      return;
    }
    trackWeaponFamily(state, bus);
    const active = pickActive(state, 'attack', stats);

    /*
     * A FAST REFUSES THE EASY BLOW, NOT THE FIGHT.
     *
     * `blocks: ['swing']` is narrower than `blocks: ['attack']` on purpose —
     * the broad one returns above, before anything has been chosen, and would
     * take the workings with it. A fasting body must still be able to cast,
     * because casting is precisely what feeds the hunger it hands out.
     *
     * The fill is already spent by the time we get here, exactly as it is for
     * Vashkāra below — the action is withheld, not the bar, and losing the fill
     * IS the cost. A body that will not swing expects you to have brought
     * something else.
     */
    if (!active && statusBlocks(state, 'swing')) {
      feedRepeat(state, {
        group: 'fasting',
        prefix: '🕳️ You do not reach for it —',
        tally: [{ label: 'blow refused', qty: 1 }],
      });
      return;
    }

    /*
     * HANDS YOU DO NOT HAVE CANNOT PUNCH.
     *
     * Spells and the body's own abilities are still yours to spend the bar on;
     * a technique, a strike and the plain swing all want a hand holding a
     * weapon. With every grip floating there is no hand, and no unarmed
     * fallback either — so a bar that fills with nothing legal on it is HELD.
     * That is a real cost and it is the player's to avoid, which is the point:
     * a body that fights by itself still expects you to be doing something.
     */
    const usesHands =
      !active?.crafted && active?.spec?.type !== 'gene' && active?.spec?.type !== 'spell';
    if (usesHands && handSwingShare(state, bearerGrants(state)) === 0) {
      feedRepeat(state, {
        group: 'concentrating',
        prefix: '🧘 You are concentrating —',
        tally: [{ label: 'action held', qty: 1 }],
      });
      return;
    }

    // Past both gates, so this is a real action however it resolves. Everything
    // that could still refuse it has already returned above.
    feedTheFast(state, state);

    // A wind-up and a volley are commands, not blows — resolved before anything
    // is aimed, so nothing rolls to hit and nothing can evade them.
    if (beginUnaimed(state, active, monster)) return;

    // Blind fighting rolls the whole to-hit sequence twice and keeps the worse
    // of the two — you cannot see well enough to pick your moment. A SURE
    // working rolls nothing: it already saw where the target will be.
    const blind = statusDisadvantage(state);
    // Iron already in the target drags what is aimed at it: some share of
    // their footwork stops applying, and lightning does not miss magnetized
    // flesh at all. Resolved against what is actually coming at them.
    const approach = active?.crafted?.strikes[0]?.type ?? playerDamageType(state);
    const pulled = magnetBypassesDodge(state, monster, approach);
    // Night fighting: outdoors after dark, some swings simply find nothing —
    // eroded to zero by Darkvision (see exposure.ts). The monsters, being of
    // the dark, are not extended the same courtesy.
    const dark = darknessFactor(state);
    // A blow can be made unmissable three ways, and they all land here so that
    // there is still exactly one dodge roll: a working that declares itself
    // `sure`, `ignores_dodge` routed into ACTIVE (which sets `sure` on the
    // resolved gene spec), and `ignores_dodge` routed into ATTACKS — which
    // says it about your ordinary swing rather than about one ability.
    const sure =
      active?.crafted?.sure ||
      (active?.spec?.type === 'gene' && active.spec.sure) ||
      armGrants(state, 'attacks', 'ignores_dodge');
    const evaded =
      !sure &&
      !pulled &&
      monster.hp > 0 &&
      rollAgainst(state, monsterStats(monster).dodge, blind);
    const fumbled =
      !evaded && rollAgainst(state, statusMissChance(state) + DARK_MISS_CHANCE * dark, blind);

    // A swing that found nothing still moved the hands. Bodies built to keep
    // swinging get part of that back — see `missRefund`. Deliberately before
    // the branches rather than inside each: a miss is a miss, whether footwork
    // or the dark took it.
    if (evaded || fumbled) shedCooldownsOnMiss(state);
    // ...and an edge that went past can still open something up. Returns true
    // when the graze finished the job, in which case the fight is over here.
    if ((evaded || fumbled) && landGraze(state, bus, monster, active)) return;

    if (evaded) {
      feed(state, `${monster.icon} The ${monster.name} evades your attack.`);
    } else if (fumbled) {
      feed(
        state,
        blind
          ? `🙈 Blind, you swing at where it was.`
          : dark > 0
            ? `🌑 The dark swallows your swing.`
            : `😵‍💫 Your head swims and the blow goes wide.`,
      );
    } else if (active?.crafted) {
      // A crafted spell takes the swing's place entirely; its own machinery
      // handles broadsides, riders and any kills it caused.
      if (castCraftedAttack(state, bus, active.id, active.crafted)) return;
    } else {
      // In this branch the active, if any, came from a skill or a technique
      // (crafted spells took the branch above).
      const skillActive = active?.spec ? { id: active.id, spec: active.spec } : null;
      const technique = active?.technique ?? null;
      // Draw/recover verbs reclaim the weapon BEFORE the numbers are read, so
      // the strike is made with the blade that just arrived in the hand.
      if (technique) applyTechniqueEquipment(state, technique, 'pre');
      // Hunter bonuses (slime hunter, goblin hunter…) are gated on what you are
      // fighting, so the offensive half of the stat block is resolved against
      // THIS target's tags. A monster carrying several hunted tags takes every
      // matching bonus at once.
      const vs = getDerivedStats(state, monsterTagSet(monster.defId));
      let dmg: number;
      let dmgType = playerDamageType(state);
      let isWeaponHit = true;
      let label = 'You hit';
      let usedTags = tags;
      // Tooltip bookkeeping: what to call the blow, what to credit its damage
      // to, and how the swing was assembled before it met the monster.
      let hitLabel = 'Your attack';
      let hitSource = weaponSource(state);
      const steps: DamageStep[] = [];
      const move: TechniqueMove | null = technique ? resolvedMove(state, technique) : null;
      if (technique && move) {
        dmg = vs.damage * (move.damageMult ?? 1);
        label = `${technique.icon} ${technique.name} strikes`;
        hitLabel = technique.name;
        steps.push({ label: 'Damage', value: vs.damage });
        if (move.damageMult !== undefined && move.damageMult !== 1) {
          steps.push({ label: technique.name, mult: move.damageMult });
        }
        // A deflection answers with what it stopped — reading the defence its
        // own trigger fired on, so a parry counter answers the parry and a
        // block counter answers the block. Spent on use, so one defence buys
        // one answer and a stale reading can never be cashed twice.
        const stoppedBy = technique.trigger?.event === 'onParry' ? 'onParry' : 'onHit';
        const stopped = move.preventedMult ? c.prevented?.[stoppedBy] : undefined;
        if (move.preventedMult && stopped) {
          const returned = stopped * move.preventedMult;
          dmg += returned;
          steps.push({
            label: stoppedBy === 'onParry' ? 'Force turned aside' : 'Damage blocked',
            value: returned,
          });
          c.prevented = { ...c.prevented, [stoppedBy]: undefined };
        }
        c.cooldowns[active!.id] = move.cooldown;
      } else if (skillActive && skillActive.spec.type === 'gene') {
        // The body's own tool. Its damage is read off whatever that body is
        // good at — armour for a slime bounce, heat resistance for a flaming
        // one — which is what turns a defensive build into an offensive plan
        // rather than just a survivable one.
        // Wind-ups and volleys never reach here: `beginUnaimed` took them
        // before anything was aimed. What is left is a blow.
        const spec = skillActive.spec;
        const ability = geneAbility(state)!;
        dmgType = spec.damageType ?? 'bludgeoning';
        isWeaponHit = false;
        label = `${ability.icon} ${ability.name} lands`;
        hitLabel = hitSource = ability.name;
        // Through `priceGeneAbility`, which is also what every readout prints —
        // the card and the blow cannot state different numbers because there is
        // only one place that works them out.
        const priced = priceGeneAbility(state, spec, vs, ability.name, monster);
        dmg = priced.damage;
        steps.push(...priced.steps);
        /*
         * THE UNSAYING: the blow IS the erasure, so what it is worth is how
         * much there was to erase. Everything comes off everyone — you
         * included, which is the cost, because a body running on its own
         * afflictions unsays those too.
         */
        // What the user puts on THEMSELVES — a ward, a stance. Duration reads
        // off the grade, so a better body holds its shield longer.
        for (const app of spec.grants ?? []) {
          applyStatus(
            state,
            state,
            spec.grantDuration
              ? { ...app, duration: Math.round(atGrade(spec.grantDuration, expressedMain(chromosomeOf(state)))) }
              : app,
            ability.name,
          );
        }
        if (spec.clearsField) {
          const torn = clearField(state);
          if (torn > 0) {
            dmg *= torn;
            steps.push({ label: `${torn} condition${torn === 1 ? '' : 's'} unsaid`, mult: torn });
          }
          feed(
            state,
            torn > 0
              ? `🌀 ${ability.name} — ${torn} affliction${torn === 1 ? '' : 's'} torn out of the air.`
              : `🌀 ${ability.name} finds nothing in the air to unsay.`,
          );
        }
        // Doubling per size gap, where `vsSmaller` is linear — the difference
        // between hitting something small and throwing a mountain at it.
        if (spec.sizeDouble) {
          const doublings = Math.floor(stepsSmaller(state, monster.defId) / spec.sizeDouble);
          if (doublings > 0) {
            const scale = 2 ** doublings;
            dmg *= scale;
            steps.push({ label: 'Sheer scale', mult: scale });
          }
        }
        c.cooldowns[skillActive.id] = spec.cooldown;
        usedTags = ['combat', 'geneshaping'];
        grantAttrXp(state, bus, 'con', 3);
        // A mini-stun is time taken off the target's own swing, which is a
        // cleaner statement than a condition: it cannot be resisted, cured or
        // stacked, it just costs them the ticks.
        if (spec.stun) monster.bar = Math.max(0, monster.bar - spec.stun);
        // ...and the same coin spent on yourself: a body that throws its whole
        // weight is slow to gather it again.
        if (spec.selfDelay) c.playerBar = Math.max(0, c.playerBar - spec.selfDelay);
      } else if (skillActive && skillActive.spec.type === 'spell') {
        noteTollSpell(state, bus);
        dmg = vs.spellPower * skillActive.spec.power;
        dmgType = skillActive.spec.damageType ?? 'arcane';
        reactTollGolem(state, monster, dmgType);
        isWeaponHit = false;
        label = `${SKILLS[skillActive.id].icon} ${SKILLS[skillActive.id].name} scorches`;
        hitLabel = hitSource = SKILLS[skillActive.id].name;
        steps.push({ label: 'Spell Power', value: vs.spellPower });
        if (skillActive.spec.power !== 1) {
          steps.push({ label: SKILLS[skillActive.id].name, mult: skillActive.spec.power });
        }
        c.cooldowns[skillActive.id] = skillActive.spec.cooldown;
        usedTags = SKILLS[skillActive.id].tags;
        grantAttrXp(state, bus, 'int', 3);
      } else if (skillActive && skillActive.spec.type === 'strike') {
        dmg = vs.damage * skillActive.spec.damageMult;
        label = `${SKILLS[skillActive.id].icon} ${SKILLS[skillActive.id].name} crushes`;
        hitLabel = SKILLS[skillActive.id].name;
        steps.push({ label: 'Damage', value: vs.damage });
        if (skillActive.spec.damageMult !== 1) {
          steps.push({ label: SKILLS[skillActive.id].name, mult: skillActive.spec.damageMult });
        }
        c.cooldowns[skillActive.id] = skillActive.spec.cooldown;
      } else {
        dmg = vs.damage;
        steps.push({ label: 'Damage', value: vs.damage });
      }
      // Weapons the mind is holding are not in this swing — they are on their
      // own clock, and the share of your damage they carry went with them.
      // Scaled here, once, so techniques and plain swings both pay it and
      // neither can bill for a blade that is out fighting on its own.
      const handShare = isWeaponHit ? handSwingShare(state, bearerGrants(state)) : 1;
      if (handShare < 1) {
        dmg *= handShare;
        steps.push({ label: 'Held by the mind, not the hand', mult: handShare });
      }
      // Spells cost mana, not sweat — only physical blows burn stamina. Every
      // swing pays its upkeep; the style's bargain costs extra, and only if
      // the player has opted in to it.
      if (isWeaponHit) {
        drawStamina(
          state,
          stats,
          attackUpkeep(stats, actionTicks(stats.actionBar, attackFillRate(stats)) / TPS),
        );
      }
      // A technique's own price and momentum, on top of the swing's upkeep.
      if (move?.staminaCost) {
        drawStamina(state, stats, stats.maxStamina * move.staminaCost * stats.staminaEff);
      }
      const ex = isWeaponHit ? exert(state, stats, attackExertion) : NO_EXERTION;
      if (attackExertion?.ramp) {
        const built = (ex.spent > 0 ? attackExertion.ramp.per * ex.ratio : 0) + (move?.momentum ?? 0);
        if (built > 0) c.momentum = Math.min(attackExertion.ramp.cap, c.momentum + built);
      }
      const penetration = Math.min(0.95, vs.penetration + ex.penetration + (move?.penetration ?? 0));
      if (ex.damage > 0) steps.push({ label: 'Exertion', mult: 1 + ex.damage });
      // Flurry-style exertions land several blows in the space of one; each
      // rolls its own crit and variance. Speed past the attack-time floor
      // arrives here too (extraSwings), and a Split technique brings its own
      // base count (move.hits).
      const hits =
        (move?.hits ?? 1) + rollExtraHits(state, ex.extraHits + (isWeaponHit ? vs.extraSwings : 0));
      const swing = dmg * (1 + ex.damage);
      const slices = new Map<string, DamageSlice>();
      let total = 0;
      let raw = 0;
      let isCrit = false;
      let crits = 0;
      // An oil on the blade rides the swing: a typed bite per hit, and the
      // substance's riders left on whatever the blow landed on. Collected here
      // and applied with the rest of the blow's leavings, so a flurry pays a
      // blow of oil per hit but only afflicts once.
      let oilRiders: StatusApplication[] | null = null;
      let oilName = '';
      let oilSpent = false;
      let oilExhausted = false;
      // A blade already inside them does not need to find an opening: the
      // technique names the crit outright, at a share of what your crits are
      // normally worth (floored, so an untrained crit build still gains).
      const forced = move?.crit;
      const forcedCritDamage = forced
        ? Math.max(forced.floor ?? 1, vs.critDamage * (forced.damageMult ?? 1))
        : 0;
      // Being the bigger thing in the room, per step of the gap. Outside the
      // per-hit loop: size does not change between swings.
      const smallerBy = stepsSmaller(state, monster.defId);
      const bully = 1 + vs.vsSmaller * smallerBy;
      if (bully !== 1) steps.push({ label: 'Looming over it', mult: bully });
      // Being the SMALLER thing, for a body built for it (`vsLarger`).
      const underdog = 1 + vs.vsLarger * stepsLarger(state, monster.defId);
      if (underdog !== 1) steps.push({ label: 'Under its guard', mult: underdog });
      // …and the same gap read from ITS side. A thing far above you struggles
      // to be reached by you, exactly as the mirror rule already did to your
      // blows from something small. Floored at zero — never a heal.
      const theirs = monsterStats(monster);
      const looming = Math.max(0, 1 - theirs.fromSmaller * stepsLarger(state, monster.defId));
      if (looming !== 1) steps.push({ label: 'It looms over you', mult: looming });
      for (let h = 0; h < hits; h++) {
        let hit = swing * bully * underdog * looming;
        // A named crit is not luck, so it neither pays the ledger nor is paid
        // by it — it skips the roll entirely (see PLAYER_CRIT).
        const crit = forced ? true : procChance(state, PLAYER_CRIT, vs.crit);
        if (crit) {
          // `critTaken` scales only the SURPLUS, so a body hardened against
          // crits flattens the spike into an ordinary blow and never below it
          // — the same rule its own crits already answered to on your side.
          const critDamage = forced ? forcedCritDamage : vs.critDamage;
          hit *= 1 + (critDamage - 1) * Math.max(0, theirs.critTaken);
          isCrit = true;
          crits++;
        }
        hit *= 0.9 + rand(state) * 0.2;
        const rawHit = hit;
        raw += rawHit;
        const landed = monsterSlice(monster, dmgType, hitSource, rawHit, penetration);
        addSlice(slices, landed);
        hit = landed.dealt;
        // Weapon enchants and socketed runes add their own typed damage per hit.
        if (isWeaponHit) {
          const typed: { type: DamageType; value: number; source: string }[] = [];
          const wdef = ITEMS[state.equipment.weapon?.defId ?? ''];
          if (wdef?.bonusDamage) typed.push({ ...wdef.bonusDamage, source: wdef.name });
          const runeBonus = weaponRuneBonuses(state);
          for (const b of runeBonus.flat) typed.push(b as { type: DamageType; value: number; source: string });
          for (const b of runeBonus.pct) {
            typed.push({ type: b.type as DamageType, value: rawHit * b.value, source: b.source });
          }
          for (const b of typed) {
            const extra = monsterSlice(monster, b.type, b.source, b.value, penetration);
            addSlice(slices, extra);
            hit += extra.dealt;
          }
          // The coating is spent per HIT, because it is paid out per hit.
          const oil = spendCoating(state);
          if (oil) {
            oilSpent = true;
            oilName = oil.name;
            oilRiders = oil.inflicts;
            oilExhausted ||= oil.exhausted;
            for (const b of oil.typed) {
              const extra = monsterSlice(
                monster,
                b.type,
                b.source,
                b.value,
                Math.min(0.95, penetration + (b.penetration ?? 0)),
              );
              addSlice(slices, extra);
              hit += extra.dealt;
            }
          }
        }
        // A gene's own riders: a jötunn's crusher is earth and ice as much as
        // it is weight, and each element answers a different resistance.
        if (skillActive?.spec.type === 'gene') {
          for (const b of skillActive.spec.riders ?? []) {
            const extra = monsterSlice(monster, b.type, hitSource, b.value, penetration);
            addSlice(slices, extra);
            hit += extra.dealt;
          }
        }
        total += hit;
      }
      if (hits > 1) steps.push({ label: `${hits} simultaneous hits`, mult: hits });
      if (crits > 0) {
        steps.push({
          label: forced
            ? 'Critical hit — the blade was already in'
            : crits === hits
              ? 'Critical hit'
              : `Critical hit (${crits} of ${hits})`,
          mult: forced ? forcedCritDamage : vs.critDamage,
        });
      }
      steps.push({ label: 'Swing variance ±10%' });
      // An ambushed target takes the blow harder (StatusDef.incomingBite);
      // the damageTaken event just below is what spends the surprise.
      const bite = statusIncomingDamageMult(monster);
      if (bite !== 1) steps.push({ label: 'Caught off guard', mult: bite });
      dmg = Math.max(1, Math.round(total * bite));
      monster.hp -= dmg;
      noteOutgoing(state, dmg);
      const harvested = enemyTookDamage(state, monster, new Map([[dmgType, dmg]]));
      if (harvested > 0) {
        const burned = Math.max(1, Math.round(harvested));
        monster.hp -= burned;
        noteOutgoing(state, burned);
      }
      const note = resNote(resistanceOf(monster, dmgType));
      // The fight's ledger: what your body has done, for reflexes to learn from.
      if (isWeaponHit) bumpStat(state, bus, 'combat:attacks');
      if (isCrit) {
        onCritLanded(state, monster, hitLabel);
        markCombatEvent(state, 'onCrit');
        bumpStat(state, bus, 'combat:crits');
      }
      feed(
        state,
        `⚔️ ${label} the ${monster.name} for ${dmg}${hits > 1 ? ` (×${hits} hits)` : ''}${
          isCrit ? ' — CRIT!' : ''
        }${note}`,
        {
          label: hitLabel,
          target: monster.name,
          steps,
          slices: [...slices.values()],
          hits,
          crit: isCrit,
          total: dmg,
        },
      );

      // What the blow leaves behind, and where it leaves you: a technique
      // inflicts its riders and exits into its position; a plain swing
      // recovers to neutral. Spells move the mind, not the feet.
      if (move?.inflicts && monster.hp > 0) {
        for (const app of move.inflicts) applyStatus(state, monster, app, technique!.name);
      }
      if (skillActive?.spec.type === 'gene' && monster.hp > 0) {
        const gspec = skillActive.spec;
        for (const app of geneInflicts(state, gspec, monster) ?? []) {
          applyStatus(state, monster, app, hitLabel);
        }
        // "Slays significantly weaker creatures outright" — measured against the
        // blow that just landed rather than against level, so an execute keeps
        // pace with the build instead of expiring the moment you out-level it.
        if (gspec.execute && monster.hp <= dmg * gspec.execute) {
          feed(state, `☠️ ${hitLabel} finishes the ${monster.name} outright.`);
          monster.hp = 0;
        }
      }
      if (oilSpent) {
        if (oilRiders && monster.hp > 0) {
          for (const app of oilRiders) applyStatus(state, monster, app, oilName);
        }
        if (oilExhausted) feed(state, `🛢️ The last of the ${oilName} wipes off your edge.`);
      }
      // A plain swing recovers to neutral — and if that walks you out of the
      // spell-ready seat, the working you were holding is simply gone.
      if (isWeaponHit) {
        // A plain swing's recovery is NOT displaced: it is the escape hatch the
        // wind conditions are balanced around (MARTIAL.md §2). Spend a swing and
        // you are back at neutral however hard the air is pushing.
        setPosition(
          state,
          technique ? displacedExit(state, techniqueExit(state, technique)) : NEUTRAL_POSITION,
        );
      }
      if (technique) {
        // The drop is the follow-through: the blade leaves the hand AFTER the blow.
        applyTechniqueEquipment(state, technique, 'post');
        if (technique.move.equipment === 'ground' && c.grounded) {
          feed(state, `🤲 Your ${itemName(c.grounded)} lies in the dirt — you fight on bare-handed.`);
        } else if (technique.move.equipment === 'impale' && c.impaled) {
          feed(
            state,
            `🗡 Your ${itemName(c.impaled)} stays buried in the ${monster.name} — you fight on bare-handed.`,
          );
        }
        const reached = recordExecution(state, technique);
        if (reached) feed(state, `🎓 ${technique.name} — ${reached.name}.`);
      }

      // Cleave-style spill: part of the blow carries past its target into a
      // random flanker — the only way to hurt anything but the centre slot.
      const geneSpec = skillActive?.spec.type === 'gene' ? skillActive.spec : null;
      // `splits_target` routed into ATTACKS says the same thing about every
      // ordinary swing that the Active arm's copy says about the ability.
      const splitsAll = armGrants(state, 'attacks', 'splits_target');
      const splash =
        vs.splash + ex.splash + (move?.splash ?? 0) + (geneSpec?.splash ?? 0) +
        (splitsAll ? SPLIT_SPLASH : 0);
      const flanks = c.enemies.map((e, i) => (e && i > 0 ? i : -1)).filter((i) => i >= 0);
      if (splash > 0 && flanks.length > 0) {
        // One at random, or all of them: a blow that carries PAST its target
        // reaches whatever happened to be beside it, while a blow thrown at
        // the room reaches the room. That is the whole difference between a
        // cleave and an area attack, and it costs one flag to say.
        const spilled =
          geneSpec?.splashAll || splitsAll ? flanks : [flanks[randInt(state, 0, flanks.length - 1)]];
        for (const idx of spilled) {
          const other = c.enemies[idx];
          if (!other) continue;
          const slice = monsterSlice(other, dmgType, hitSource, raw * splash, penetration);
          const spill = Math.max(1, Math.round(slice.dealt));
          other.hp -= spill;
          feed(state, `↯ The blow carries into the ${other.name} for ${spill}`, {
            label: 'Spill from your blow',
            target: other.name,
            steps: [
              { label: 'Blow before defences', value: raw },
              { label: 'Splash', mult: splash },
            ],
            slices: [slice],
            hits: 1,
            crit: false,
            total: spill,
          });
          // Whatever the blow does, it does to everything it reached — the
          // chill and the execute travel with the spill, not just the damage.
          if (geneSpec && other.hp > 0) {
            // `other`, not `monster` — this is the splash, and the whole point
            // of asking per target is that each flank has its own count.
            for (const app of geneInflicts(state, geneSpec, other) ?? []) {
              applyStatus(state, other, app, hitLabel);
            }
            if (geneSpec.execute && other.hp <= spill * geneSpec.execute) {
              feed(state, `☠️ ${hitLabel} finishes the ${other.name} outright.`);
              other.hp = 0;
            }
          }
          if (other.hp <= 0) onKill(state, bus, idx);
        }
      }

      // Some conditions cost you every time you swing.
      if (applyRetaliation(state, bus, 'onAttack')) return;

      grantAttrXp(state, bus, 'str', 2);
      grantAttrXp(state, bus, 'dex', 1);
      grantSkillXp(state, bus, usedTags, 4 + monster.level * 0.5);
      // Full-tag discovery: weapon families and stance schools manifest here
      // (tags carry the weapon and the active style).
      checkDiscovery(state, bus, tags);
      bus.emit({ type: 'tick:action', tags: usedTags, skillXp: 0 });
    }

    if (monster.hp <= 0) {
      onKill(state, bus, 0);
      return;
    }
  }

  // --- Enemy attacks: everyone acts, but position vs reach decides how well ---
  for (let i = 0; i < c.enemies.length; i++) {
    const e = c.enemies[i];
    if (!e) continue;
    // The terms of an honorable duel: everyone but the front can only watch.
    if (i > 0 && statusPacifiesFlankers(state)) continue;
    const mod = POSITION_MODS[i === 0 ? 'front' : 'back'][e.range];
    const es = monsterStats(e);

    // A shock runs the bar BACKWARDS at the rate it would have filled — the
    // player's rule (see the yellow bar above), finally on this side too.
    const reversed = statusReversesBar(e);
    // `speed × attackSpeed × position`, which is the player's own bar rule with
    // a third term. `attackSpeed` was a dial nothing on this side could reach:
    // a haste or a slow authored as one simply never arrived, and every such
    // effect had to be written twice as a `speed` mod to work on both sides.
    const fill = es.speed * es.attackSpeed * mod.fill;
    e.bar += reversed ? -fill : fill;

    if (reversed) {
      // Deliberately ahead of the jostle: shaving a reversed bar would only
      // hurry the discharge along, which would make crowding a shocked enemy
      // a way to HELP it. A shocked thing does not act, whatever else is true.
      if (e.bar <= 0) {
        e.bar = 0;
        const died = applyMonsterBarDamage(state, e, 'onDeplete');
        fireStatusEvent(state, e, 'barDeplete');
        // Sweeping splices `c.enemies`, so the index this loop is holding stops
        // meaning what it meant. Ending the enemy phase here is the safe read
        // and costs the survivors one tick on the rare turn an ally detonates.
        if (died) {
          sweepDead(state, bus);
          return;
        }
      }
      continue;
    }

    // A ranged attacker shoved to the front keeps getting jostled: its progress
    // is shaved, but only up to a cap per fill — never a permanent lockout.
    if (mod.stunPerTick > 0 && e.stunSpent < mod.stunCap) {
      const shave = Math.min(mod.stunPerTick, mod.stunCap - e.stunSpent, Math.max(0, e.bar));
      e.bar -= shave;
      e.stunSpent += shave;
    }
    if (e.bar < MONSTER_ACTION_BAR) continue;
    e.bar -= MONSTER_ACTION_BAR;
    e.stunSpent = 0; // a fresh fill cycle gets a fresh stun allowance
    // Whatever rides the bar discharges as it completes, before the swing —
    // the player's order, mirrored. This is what makes a jolt on an enemy cost
    // it something every time it acts, rather than being decoration.
    if (applyMonsterBarDamage(state, e, 'onFill')) {
      sweepDead(state, bus);
      return;
    }
    fireStatusEvent(state, e, 'barFill');
    if (consumeSkippedAction(e)) {
      feed(state, `😵 The ${e.name} cannot bring itself to act.`);
      continue;
    }

    /*
     * What it means to do this turn, chosen once from its rotation. A working
     * replaces the swing outright; a technique SHAPES the swing further down.
     *
     * The cast is resolved here, ahead of the guard block, because a sentence,
     * a miracle and a shape are none of them blows: footwork does not evade
     * one, a parry cannot answer one, and a kinetic bulwark — which stops
     * things THROWN — has nothing to stop. What turns a working aside is what
     * the working itself allows: `sure`, resistances, and the target's own
     * conditions.
     */
    const action = pickMonsterAction(state, e);

    // The fast cuts both ways. Same gate as the player's, one predicate, and
    // combat never learns whether it is looking at a worn condition that came
    // from a gene or from a MonsterDef — which is the whole reason `fasting`
    // is a condition rather than a flag on either def.
    //
    // Ahead of the cast branch on purpose: it only fires when nothing was
    // chosen, so it can never intercept a working, and putting it here means
    // the appetite below is only ever fed by an action actually taken.
    if (!action && statusBlocks(e, 'swing')) {
      feed(state, `🕳️ The ${e.name} does not reach for you.`);
      continue;
    }

    feedTheFast(state, e);

    if (action?.cast) {
      // A counterspell's answer can kill mid-cast, and sweeping moves the
      // formation under this loop — the same reason bar damage ends the phase.
      if (castMonsterWorking(state, bus, e, es, action.cast, action.index)) return;
      if (!state.combat || !isAlive(state)) return;
      continue;
    }

    // Guarding stances pay stamina per incoming blow — footwork or set hips.
    const guard = exert(state, stats, defendExertion);
    // Your footing scales what evasion is even available: a position taken
    // deliberately wide open dodges nothing, however quick you are. Footwork
    // needs eyes: the dark taxes it too, until Darkvision pays that off.
    const darkMult = 1 - DARK_DODGE_PENALTY * darknessFactor(state);
    if (chance(state, Math.min(0.9, (stats.dodge + guard.dodge) * positionDodgeMult(state) * darkMult))) {
      // Something big enough still catches you on the way past — see
      // `landMonsterGraze`. Rolled before the feed so the line can say so.
      const grazed = landMonsterGraze(
        state,
        e,
        es,
        mod.damage * positionIncomingMult(state, stats.stumbleTaken),
      );
      feed(
        state,
        grazed > 0
          ? `💢 You slip the ${e.name}'s attack, but it still tells for ${grazed}.`
          : guard.dodge > 0
            ? `💨 A burst of footwork and the ${e.name}'s attack finds nothing.`
            : `💨 You dodge the ${e.name}'s attack.`,
      );
      markCombatEvent(state, 'onDodge');
      bumpStat(state, bus, 'combat:dodges');
      if (!isAlive(state)) return;
      // Nothing landed, so nothing was resolved — what the swing was WORTH is
      // the honest measure of what the footwork saved.
      noteDodge(state, es.damage * mod.damage * positionIncomingMult(state, stats.stumbleTaken));
      grantAttrXp(state, bus, 'dex', 2);
      continue;
    }
    // A shroud on top of footwork: veils and night-shrouds are rolled after
    // dodge has already failed, so they stack with it rather than replacing it.
    if (chance(state, statusIncomingMissChance(state))) {
      feed(state, `🌑 The ${e.name}'s blow finds only shadow.`);
      continue;
    }
    // A standing wall stops anything THROWN — melee walks around it.
    if (e.range === 'ranged' && statusBlocksRangedType(state, MONSTERS[e.defId].damageType)) {
      feed(state, `🛡️ The ${e.name}'s shot stops dead against the bulwark.`);
      continue;
    }
    // A parry turns the blow aside and answers it on the spot. The riposte is
    // free: it never touches your action bar, so your own swing still lands
    // when it was going to. Checked before the harmless-target shortcut, so a
    // training dummy is a place to watch a parry build work.
    //
    // A fencing stance can BUY parry per incoming blow the way Evasive buys
    // dodge — the bought chance sits on top of the standing one and is held to
    // the same cap, so exertion can reach the ceiling but never past it.
    const parryChance = Math.min(PARRY_CAP, stats.parry + guard.parry);
    if (parryChance > 0 && chance(state, parryChance)) {
      const slice = monsterSlice(
        e,
        playerDamageType(state),
        weaponSource(state),
        stats.damage * stats.riposte,
        stats.penetration,
      );
      const riposte = Math.max(1, Math.round(slice.dealt));
      e.hp -= riposte;
      // Remember how hard that blow was coming in, for a deflection technique
      // to answer with (see TechniqueMove.preventedMult). No variance roll:
      // the blow never landed, so there is nothing to roll — this is the
      // weight of the swing, not a wound. Armor and resistance are left out
      // deliberately; a parry stopped ALL of it, so what you prevented is what
      // THEY put into it.
      c.prevented = { ...c.prevented, onParry: es.damage * mod.damage * positionIncomingMult(state) };
      markCombatEvent(state, 'onParry');
      bumpStat(state, bus, 'combat:parries');
      noteParry(state, es.damage * mod.damage * positionIncomingMult(state), riposte);
      feed(state, `🛡️ You parry the ${e.name} and cut back for ${riposte}`, {
        label: 'Riposte',
        target: e.name,
        steps: [
          { label: 'Damage', value: stats.damage },
          { label: 'Riposte share of it', mult: stats.riposte },
        ],
        slices: [slice],
        hits: 1,
        crit: false,
        total: riposte,
      });
      grantAttrXp(state, bus, 'dex', 2);
      if (e.hp <= 0) {
        onKill(state, bus, i);
        if (!state.combat) return;
      }
      continue;
    }
    // Training equipment swings, but nothing it does can hurt you — no damage,
    // and none of the exposure XP a real blow would teach.
    if (MONSTERS[e.defId]?.passive) {
      feed(state, `🎯 The ${e.name} thumps against your guard — no harm done.`);
      continue;
    }
    /*
     * A technique, if one is open from where this specimen stands. It does not
     * replace the swing — it SHAPES it: the move's multiplier, its damage type
     * and its riders ride the ordinary blow below, so armour, bracing, counters
     * and the breakdown all keep working untouched.
     *
     * Then it walks: `to` is where the exchange leaves it, which is what makes
     * the next technique's `from` mean something. A plain swing resets to
     * neutral, exactly as the player's does.
     */
    const tech = action?.tech;
    const move = tech?.move;
    if (tech) {
      e.cooldowns ??= {};
      e.cooldowns[action!.index] =
        state.totalTicks + (move?.cooldown ?? TECHNIQUE_MONSTER_COOLDOWN);
      spendMonsterAction(e, action!.index);
      e.position = statusDisplacedExit(state, e) ?? tech.to;
      feed(state, `${tech.icon} The ${e.name} moves into ${tech.name}.`);
    } else {
      // As for the player: a plain swing always recovers, whatever is pushing.
      e.position = NEUTRAL_POSITION;
    }

    const type = move?.damageType ?? MONSTERS[e.defId]?.damageType ?? 'bludgeoning';
    // Positions are felt: stumbling takes blows harder, a set guard softer.
    const posMult = positionIncomingMult(state, stats.stumbleTaken);
    // Everything that swings can crit. `critTaken` scales only the SURPLUS, so
    // a body hardened against crits flattens the spike into an ordinary blow
    // and never below it — the hit still lands, it just stops being special.
    // The same gap, read the other way: a thing far below you struggles to
    // reach anywhere that matters. Floored at zero — never a heal.
    const looming = Math.max(0, 1 - stats.fromSmaller * stepsSmaller(state, e.defId));
    // The mirror: what IT gets for being the bigger thing in the room. Read off
    // the specimen rather than the player, so a genome that looms works for
    // whoever is wearing it (docs/plans/monster-stat-parity.md).
    const bully = 1 + es.vsSmaller * stepsLarger(state, e.defId);
    // …and its `vsLarger`, when the player is the bigger one.
    const underdog = 1 + es.vsLarger * stepsSmaller(state, e.defId);
    // A counter form gets between you and the blow: it comes off BEFORE armor,
    // so what the reflex took and what the harness took are one block, and a
    // `preventedMult` on the same move answers with all of it.
    //
    // Picked ONCE for the exchange rather than per hit: a reflex gets between
    // you and the attack, not between you and each blow of it.
    const counter = pickCounter(state, stats, 'onHit');
    const braced = stats.armor * guard.armor;
    // Surprise cuts both ways: a player who blundered in takes this blow
    // harder, and damagePlayer's damageTaken event spends the condition.
    const bite = statusIncomingDamageMult(state);
    /*
     * ONE SWING OR SEVERAL. Was hardcoded to one, which made two things inert:
     * `extraSwings` on the monster's side of the block, and `move.hits` — the
     * latter a gap this file already admitted to in a comment further down
     * ("a multi-hit monster technique will simply land as one ordinary blow").
     * They are the same loop, so wiring one wired the other.
     *
     * Each hit rolls its OWN crit and its own variance, exactly as the player's
     * flurry does. Everything the exchange decides once — the counter, the
     * brace, the surprise, the size gaps — stays outside.
     */
    const hits = (move?.hits ?? 1) + rollExtraHits(state, es.extraSwings);
    const slices = new Map<string, DamageSlice>();
    const ranged = MONSTERS[e.defId]?.range === 'ranged';
    let thrown = 0;
    let dmg = 0;
    let critted = false;
    for (let h = 0; h < hits; h++) {
      // Everything that swings can crit. `critTaken` scales only the SURPLUS,
      // so a body hardened against crits flattens the spike into an ordinary
      // blow and never below it — the hit still lands, it just stops being
      // special.
      const hitCrit = procChance(state, monsterCritKey(e.defId), es.crit);
      if (hitCrit) critted = true;
      const critMult = hitCrit ? 1 + (es.critDamage - 1) * Math.max(0, stats.critTaken) : 1;
      const one =
        es.damage *
        mod.damage *
        posMult *
        (move?.damageMult ?? 1) *
        critMult *
        looming *
        bully *
        underdog *
        (0.9 + rand(state) * 0.2);
      thrown += one;
      const raw = counter ? one * (1 - counter.move.counter!.reduce) : one;
      const slice = incomingSlice(stats, type, e.name, raw, braced, ranged);
      // Training equipment (MonsterDef.fixedDamage): the number that reaches
      // the bar is pinned, whatever the roll, the armour or the counter did.
      const fixed = MONSTERS[e.defId]?.fixedDamage;
      if (fixed !== undefined) {
        slice.raw = fixed;
        slice.armor = 0;
        slice.resisted = 0;
        slice.dealt = fixed;
        addSlice(slices, slice);
        dmg += fixed;
        continue;
      }
      addSlice(slices, slice);
      dmg += Math.max(1, Math.round(slice.dealt * bite));
    }
    // A blow that LANDS still leaves a reading: what your armor, bracing,
    // resistances and any intercepting counter took off it. Same field a parry
    // stamps, under its own key (see TechniqueMove.preventedMult) — a parry
    // stopped the whole blow, a block stopped a share, and either is something
    // to answer with. Measured against what was THROWN, not what survived the
    // interception, so a counter's own reduction counts toward its answer.
    c.prevented = { ...c.prevented, onHit: Math.max(0, thrown - dmg) };
    // What armour, bracing, resistance and any intercepting counter took off it
    // — the left-hand column of the defeat window, and a figure the engine was
    // already computing here and throwing away a line later. Clamped: a bite
    // amplifying past what was thrown is extra hurt, not negative absorption.
    noteAbsorbed(state, Math.max(0, thrown - dmg));
    damagePlayer(state, dmg, type, { key: `monster:${e.defId}`, label: e.name, icon: e.icon });
    const res = stats[RES_STAT_BY_TYPE[type]];
    markCombatEvent(state, 'onHit');
    bumpStat(state, bus, 'combat:hitsTaken');
    feed(
      state,
      `🩸 The ${e.name} ${critted ? 'CRITS you' : 'hits you'} for ${dmg} ${type}${
        guard.armor > 0 ? ' — braced' : ''
      }${res >= 0.1 ? ' (resisted)' : ''}${
        // Say so when the body ate the spike, or a crit that landed soft reads
        // like the roll simply failed.
        critted && stats.critTaken < 1 ? ' (blunted)' : ''
      }.`,
      {
        label: `The ${e.name}`,
        target: 'You',
        steps: [
          { label: 'Its damage', value: es.damage },
          ...(mod.damage !== 1 ? [{ label: 'Out of position', mult: mod.damage }] : []),
          ...(posMult !== 1
            ? [{ label: posMult > 1 ? 'You are off balance' : 'You are guarded', mult: posMult }]
            : []),
          { label: 'Swing variance ±10%' },
          ...(bite !== 1 ? [{ label: 'Caught off guard', mult: bite }] : []),
          // The interception names itself. A counter takes its share BEFORE
          // armor, so without this line the blow just arrives smaller than the
          // numbers above it say — the one thing a breakdown must never do.
          ...(counter
            ? [{ label: `${counter.def.name} intercepts`, mult: 1 - counter.move.counter!.reduce }]
            : []),
          ...(braced > 0 ? [{ label: 'Braced — extra armor', value: braced }] : []),
        ],
        slices: [...slices.values()],
        hits,
        crit: false,
        incoming: true,
        total: dmg,
      },
    );
    // Contact cuts both ways: a shard-bound body answers whatever touched it.
    if (e.range === 'melee' && applyRetaliation(state, bus, 'onContact')) return;

    // What its blows leave behind: venom, burns, the cut that keeps bleeding.
    // Rolled per landed hit, so a fight with a swarm compounds.
    // Its own riders, plus whatever the technique it just used carries.
    //
    // `move.hits` IS read now — the swing above is a loop, so a multi-hit
    // monster technique lands as the several blows it says it is. Riders are
    // still rolled ONCE for the exchange rather than per hit, matching the
    // player's flurry: a blow of oil per hit, but afflicted only once.
    //
    // `move.penetration` is still NOT read: `incomingSlice` takes no
    // penetration argument, because nothing has ever eroded the PLAYER's
    // resistances. That one is a real gap rather than a decision, and it wants
    // the stat before it wants a caller.
    const inflicted = applyStatuses(
      state,
      state,
      [...(MONSTERS[e.defId]?.inflicts ?? []), ...(move?.inflicts ?? [])],
      e.name,
      // Resistance answers the affliction on the way IN, not merely its ticks
      // afterwards: a cold-armoured body registers a shallower chill and needs
      // more bites to freeze. See `applicationMult`.
      stats,
    );
    for (const inst of inflicted) {
      const sdef = STATUSES[inst.id];
      if (sdef && !sdef.hidden) feed(state, `${sdef.icon} You are ${sdef.name.toLowerCase()}!`);
    }

    grantAttrXp(state, bus, 'con', 2);
    // Exposure: taking typed damage can manifest and level the matching
    // resistance skill (compound tag so heat exposure never levels cold).
    checkDiscovery(state, bus, [`resist:${type}`]);
    grantSkillXp(state, bus, [`resist:${type}`], Math.min(6, 1 + dmg * 0.1));
    if (!isAlive(state)) {
      onDefeat(state, bus);
      return;
    }
    // Still standing, so the reflex completes: soften, then answer.
    if (counter) {
      fireCounter(state, bus, stats, counter, e, i);
      if (!state.combat) return;
    }
  }
}

/**
 * The bookkeeping EVERY ending shares: the weapon picked back up, `combatEnd`
 * fired, the enemies dropped.
 *
 * This exists because the middle one used to happen only when you walked away.
 * Winning and being knocked out both nulled `state.combat` directly, so a
 * condition whose only exit is a combat event — a daze that unstacks on your
 * turn, a shock that discharges when your bar empties — outlived the fight and
 * was still on you in the next one, forever. Anything that ends a fight goes
 * through here.
 *
 * Callers fire this BEFORE `endFight`, so the ledger's "Still on you" list is
 * what you actually walk away carrying rather than what the fight was holding.
 */
function closeCombat(state: GameState): void {
  delete state.stats[TOLL_SPELL_FLAG];
  recoverGroundedWeapon(state);
  // A working held at the edge of release does not survive the fight it was
  // being held for. Its mana was spent when it was taken up; that is the cost.
  releaseReadiedSpell(state);
  fireStatusEvent(state, state, 'combatEnd');
  state.combat = null;
}

/**
 * Called when the player leaves combat (travel, switching activity). Never
 * refuses: the choice not to allow leaving belongs at the decision points —
 * travel and activity selection check `inForcedFight` before getting here,
 * while the loss paths (conditions finishing you mid-fight) go through
 * regardless, because losing is not walking away.
 */
export function abandonCombat(state: GameState): void {
  closeCombat(state);
  // Walking away is not an outcome worth a window, so the tally is dropped
  // rather than committed. Anything that ends a fight for a reason the player
  // should read — a knockout, conditions finishing you — calls endFight FIRST.
  state.fight = null;
  state.respawnTimer = RESPAWN_DELAY;
}
