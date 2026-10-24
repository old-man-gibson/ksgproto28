import type { StatusDef } from '../types';

/**
 * Whether a condition HURTS its bearer, read from the condition's own data.
 *
 * There is no `harmful` flag on `StatusDef` and no id list: a condition is
 * harmful if its definition says it damages, drains, seals off, forbids or
 * worsens something. Two readers need the answer and must agree, so it lives
 * here, a leaf that imports only types:
 *
 *  - `eatenApplication` (consumables.ts) never lets the cook's `foodPotency` or
 *    `foodDuration` amplify a harmful condition a dish carries.
 *  - `foodProblems` (disciplines.ts, linted in both validation layers) refuses
 *    a harmful condition on any dish except the bench's failure dish.
 *
 * What counts, and why these fields:
 *
 *  - It hurts: `dot`, `drains`, `detonate`, `expireDamage`, `fatalOnEmpty`,
 *    `bar` (a jolt that discharges or empties, a reversed or skipped bar),
 *    `surplus` (a swelling that bursts), `magnetism`, `incomingBite`,
 *    `negativeHeadroom` (a pool allowed into debt that detonates), `tends` and
 *    `grafts` (a growing or spreading seed), `displaces`.
 *  - It takes away: `ceilings`, `ceilingFromSpend`, `ceilingPerTick` (seal a
 *    pool), `blocksRegen`, `missChance`, `disadvantage`, `costMult`, `healCap`,
 *    `damp` (dulls modifiers), `resFloor` (lets resistance fall further).
 *  - It forbids: `blocks`, `forceStyle`.
 *  - It is marked as an affliction: `element` (the established flag — see
 *    `applicationMult`: every element-bearing condition is an affliction),
 *    `escalatesTo` (it turns into something worse), `expiresTo` (it leaves a
 *    successor behind).
 *  - A modifier that makes the bearer worse: a negative value on a stat where
 *    higher is better, or a positive one where lower is better
 *    (`LOWER_IS_BETTER`). One such modifier is enough; a condition with a
 *    penalty is not nourishment.
 *
 * Not marked, on purpose: `restores`, `immune`, `retaliate`, `invertsDots`,
 * `blocksRanged`, `incomingMissChance`, `pacifiesFlankers`, `opensTempo` (they
 * help the bearer), and `amplifies`, `capOverrides`, `converts`, `blockedBy`
 * (they change other conditions, for better or worse).
 */

/** Stats whose smaller value is the better one: damage taken, costs, bar size. */
const LOWER_IS_BETTER = new Set<string>([
  'damageTaken',
  'critTaken',
  'stumbleTaken',
  'staminaEff',
  'manaEff',
  'actionBar',
]);

/** The first field that marks this condition harmful, or null if none does. */
export function harmOf(def: StatusDef): string | null {
  const fields: [string, unknown][] = [
    ['dot', def.dot],
    ['drains', def.drains],
    ['detonate', def.detonate],
    ['expireDamage', def.expireDamage],
    ['fatalOnEmpty', def.fatalOnEmpty],
    ['bar', def.bar],
    ['surplus', def.surplus],
    ['magnetism', def.magnetism],
    ['incomingBite', def.incomingBite],
    ['negativeHeadroom', def.negativeHeadroom],
    ['tends', def.tends],
    ['grafts', def.grafts],
    ['displaces', def.displaces],
    ['ceilings', def.ceilings?.length ? def.ceilings : undefined],
    ['ceilingFromSpend', def.ceilingFromSpend],
    ['ceilingPerTick', def.ceilingPerTick],
    ['blocksRegen', def.blocksRegen?.length ? def.blocksRegen : undefined],
    ['missChance', def.missChance],
    ['disadvantage', def.disadvantage],
    ['costMult', def.costMult],
    ['healCap', def.healCap],
    ['damp', def.damp],
    ['resFloor', def.resFloor],
    ['blocks', def.blocks?.length ? def.blocks : undefined],
    ['forceStyle', def.forceStyle],
    ['element', def.element],
    ['escalatesTo', def.escalatesTo],
    ['expiresTo', def.expiresTo],
  ];
  for (const [name, value] of fields) if (value !== undefined && value !== false) return name;
  for (const mod of def.mods ?? []) {
    const stat = String(mod.stat).split(':')[0];
    const worse = LOWER_IS_BETTER.has(stat) ? mod.value > 0 : mod.value < 0;
    if (worse) return `mods (${mod.stat} ${mod.value})`;
  }
  return null;
}

export function isHarmful(def: StatusDef): boolean {
  return harmOf(def) !== null;
}
