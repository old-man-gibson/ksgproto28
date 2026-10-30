import type { StatusDef, TitleDef } from '../types';

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
 *  - `resistanceProblems` (below, linted in both validation layers) demands that
 *    every harmful condition says what resists it: an `element`, or
 *    `unresistable`.
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

/** One problem `resistanceProblems` found, for the test and for the forge's issue list. */
export interface ResistanceProblem {
  kind: 'status' | 'title';
  id: string;
  message: string;
  /** Where in the entry, for the forge's deep link. */
  path?: string[];
}

/**
 * Problems with who can resist what, as plain sentences. Shared by
 * `tests/content.test.ts` and `forge/lib/validate.ts` like `foodProblems`, so
 * it takes the registries it checks. It lives beside `harmOf` because it reads
 * harm from it.
 *
 *  - Totality: every harmful condition has an `element` (resistance in that
 *    element answers it) or `unresistable` (nothing does, and why), never
 *    both. "Can this be resisted?" always has an answer.
 *  - `unresistable` is a reason in words, and means nothing on a condition that
 *    harms no one.
 *  - Nothing can switch an unresistable condition off: no `immune.ids`, on a
 *    condition or on a title, may name one (a boss phase stays a boss phase).
 *    An `immune.elements` entry cannot reach it, since it has no element.
 *  - A title's `immune` names something and every id in it is a real
 *    condition (a typo would refuse nothing, silently). A condition's own
 *    `immune` gets those two checks in the status lint of each layer.
 */
export function resistanceProblems(
  statuses: Record<string, StatusDef>,
  titles: Record<string, Pick<TitleDef, 'id' | 'immune'>> = {},
): ResistanceProblem[] {
  const problems: ResistanceProblem[] = [];
  const say = (kind: ResistanceProblem['kind'], id: string, message: string, path?: string[]) =>
    problems.push({ kind, id, message, ...(path ? { path } : {}) });

  for (const def of Object.values(statuses)) {
    const harm = harmOf(def);
    if (def.unresistable !== undefined && def.unresistable.trim() === '') {
      say('status', def.id, `'${def.id}' has an empty unresistable: give the reason in a few words`, ['unresistable']);
    } else if (def.element && def.unresistable) {
      say(
        'status',
        def.id,
        `'${def.id}' has both an element (${def.element}) and unresistable ('${def.unresistable}'): it is resisted or it is not`,
        ['unresistable'],
      );
    } else if (harm && !def.element && !def.unresistable) {
      say(
        'status',
        def.id,
        `'${def.id}' harms its bearer (${harm}) but has neither an element to be resisted by nor unresistable: say which`,
      );
    } else if (!harm && def.unresistable) {
      say('status', def.id, `'${def.id}' is marked unresistable but harms no one: remove the mark`, ['unresistable']);
    }
  }

  const unresistable = (id: string) => !!statuses[id]?.unresistable;
  for (const def of Object.values(statuses)) {
    for (const id of def.immune?.ids ?? []) {
      if (unresistable(id)) {
        say('status', def.id, `immune names '${id}', which is unresistable: nothing may switch it off`, ['immune', 'ids']);
      }
    }
  }
  // A title's immunity is checked like a condition's own: it names something,
  // every id is a real condition, and none is unresistable. (The status layers
  // check a condition's `immune` for the first two themselves.)
  for (const title of Object.values(titles)) {
    const immune = title.immune;
    if (!immune) continue;
    if (!immune.ids?.length && !immune.elements?.length) {
      say('title', title.id, 'immune names no condition and no element — it protects against nothing', ['immune']);
    }
    for (const id of immune.ids ?? []) {
      if (!statuses[id]) {
        say('title', title.id, `immune names unknown condition '${id}'`, ['immune', 'ids']);
      } else if (unresistable(id)) {
        say('title', title.id, `immune names '${id}', which is unresistable: nothing may switch it off`, ['immune', 'ids']);
      }
    }
  }
  return problems;
}
