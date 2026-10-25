import type { ActivityDef, ResourceDef, ResourceId } from '../types';
import { text } from '../text/log';

/**
 * The pools the player spends and recovers.
 *
 * Everything that touches a pool — regeneration, clamping, lockouts, the
 * sidebar bars, the trigger subjects an active skill can fire on — walks this
 * list instead of naming `state.stamina` and friends. Adding a resource is:
 *
 *   1. add its id to `ResourceId` in types.ts,
 *   2. add its `maxStat` (and any regen/efficiency stats) to `StatKey` and give
 *      them formulas in derived.ts `baseStats`,
 *   3. add an entry here.
 *
 * Nothing else needs to know it exists.
 */

/** Exhaustion drags every action bar down by this fraction. */
export const EXHAUSTED_SPEED_PENALTY = 0.15;

/** Spending stops once stamina falls to this share of its TRUE max. */
export const STAMINA_RESERVE = 0.2;

/**
 * How restful each activity is, as a multiplier on the `hpRegen` stat — health
 * is the one pool whose recovery is graded by what you are *doing* and not just
 * by whether you have sat down.
 *
 * `none` is standing about with nothing selected, and is the baseline the stat
 * is tuned against (×1 = HP_REGEN_SHARE per second). Everything above it is
 * ordinary work being quietly restorative; rest is the real recovery, and its
 * multiplier is the number worth turning when health comes back too fast or
 * too slowly.
 *
 * Hunting sits at the baseline like any other day's work — what suppresses
 * recovery is not the activity but an actual fight, which is IN_COMBAT_REGEN_MULT
 * below. So the lulls between encounters mend you at the ordinary rate.
 */
export const RECOVERY_MULT: Record<ActivityDef['kind'] | 'none', number> = {
  rest: 15,
  job: 4,
  train: 2,
  gather: 2,
  craft: 2,
  explore: 1,
  search: 1,
  hunt: 1,
  none: 1,
};

/**
 * What a live fight does to the health trickle, while stamina is below its
 * ceiling. Fighting does not stop you mending — STRAINING halves it, and
 * stamina off its maximum is the reading for "straining": one swing puts you
 * there and you stay there until the encounter lets up.
 *
 * Flat, deliberately. Being winded or exhausted does not take it lower, and
 * nothing here scales with how much stamina is left — half is half. (Nothing
 * else reduces the trickle either: the exhausted lockout's own regen penalty
 * belongs to pools with a reserve, which health has none of.)
 */
export const IN_COMBAT_REGEN_MULT = 0.5;

/** Sitting down recovers mana this much faster (see ResourceDef.restRegenMult). */
export const REST_MANA_MULT = 3;

export const RESOURCE_LIST: ResourceDef[] = [
  {
    id: 'hp',
    art: 'hp',
    name: 'HP',
    icon: '❤️',
    cssVar: '--hp',
    maxStat: 'maxHp',
    regenStat: 'hpRegen',
    // The trickle is real, but it is not applied here: health only ever moves
    // through heal(), so conditions see it (see systems/health.ts and
    // ResourceDef.viaHeal). How fast it runs depends on what you are doing —
    // RECOVERY_MULT above, not a flat rest multiplier.
    viaHeal: true,
  },
  {
    id: 'stamina',
    art: 'stamina',
    name: 'Stamina',
    icon: '💪',
    cssVar: '--stamina',
    maxStat: 'maxStamina',
    regenStat: 'staminaRegen',
    effStat: 'staminaEff',
    reserve: {
      share: STAMINA_RESERVE,
      lowName: 'Winded',
      emptyName: 'Exhausted',
      lowIcon: '😮‍💨',
      emptyIcon: '🥵',
      lowCssVar: '--stamina-winded',
      emptyCssVar: '--stamina-exhausted',
      lowMsg: text('resources.stamina_low'),
      emptyMsg: text('resources.stamina_empty'),
      clearedMsg: text('resources.stamina_recovered'),
      emptyRegenMult: 0.5,
      slowUntil: 0.5,
      emptyPenalty: [{ stat: 'speed', op: 'mult', value: -EXHAUSTED_SPEED_PENALTY }],
    },
  },
  {
    id: 'mana',
    art: 'mana',
    name: 'Mana',
    icon: '🔮',
    cssVar: '--mana',
    maxStat: 'maxMana',
    regenStat: 'manaRegen',
    effStat: 'manaEff',
    // Sitting quietly is how a caster gathers themselves back up, so rest
    // refills mana faster too — more modestly than health, which starts from a
    // far slower baseline and has further to climb.
    restRegenMult: REST_MANA_MULT,
    // No reserve yet — mana is spendable to the last point.
  },
  {
    id: 'spirit',
    art: 'spirit',
    name: 'Spirit',
    icon: '✨',
    cssVar: '--spirit',
    maxStat: 'maxSpirit',
    // A standing reserve for continuous spells and rituals rather than
    // something spent per action, so it simply sits at its maximum.
    static: true,
  },
  {
    id: 'focus',
    art: 'focus',
    name: 'Focus',
    icon: '🧠',
    cssVar: '--focus',
    maxStat: 'maxFocus',
    regenStat: 'focusRegen',
    /*
     * An ORDINARY pool — mana's shape, not spirit's: it is spent and it refills.
     * What makes psionics different is not how focus is spent but what attacks
     * it. Overload eats this pool's MAXIMUM for as long as a working is held
     * (a `ceilingPerTick` condition, the way rotting eats stamina's), and the
     * ceiling then has to grow back. Losing capacity is the mechanic; spending
     * the pool is unremarkable.
     *
     * No `reserve`: running dry is not a lockout, it is simply the point at
     * which nothing more can be held.
     */
  },
];

export const RESOURCES: Record<ResourceId, ResourceDef> = Object.fromEntries(
  RESOURCE_LIST.map((r) => [r.id, r]),
) as Record<ResourceId, ResourceDef>;
