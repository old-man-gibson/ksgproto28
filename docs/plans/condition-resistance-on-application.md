---
id: condition-resistance-on-application
title: Conditions resisted on APPLICATION, not only on damage
kind: story
status: review
system: statuses
parent:
save:
updated: 2026-08-14
invariants:
  - two-validation-layers
  - completability
done:
  - StatusDef.element gates the application, scaling landed intensity
  - StatusDot.type still gates the tick damage, unchanged
  - Resistance scales intensity, never gates landing — a chill at 0.4 still chills
  - Shipped as its own change with its own before/after, never folded into chromosome work
---

# Conditions should be resisted on application

**Amended 2026-10-23 (cooking round 1): resistance of 1 or more, after the
applier's penetration, is now immunity.** `applyStatus` returns null instead of
landing at the floor, for players and monsters; below 1 everything here still
holds. `StatusDef.immune` adds explicit immunity by element or id. See
CONTENT_GUIDE §"Status condition". The "never gates landing" line in the front
matter describes the 2026-08-14 build.

**Built 2026-08-14. `npm run verify` green: 1607 tests, 0 type errors.** No save
change — the whole thing is arithmetic at the point of application, so `save`
stays empty.

**Already true:** a condition's tick damage IS resisted. `statuses.ts` routes
every dot through `bearerResistance`.

**Was missing:** `applyStatus` never consulted a resistance. **An ice-immune
monster took `chilled` at full strength** and merely shrugged off the ticks
afterwards.

## What shipped

- **`applicationMult`** (`systems/statuses.ts`) reads `StatusDef.element` and
  returns the share of the dose that survives:
  `max(APPLICATION_FLOOR, 1 − clamp(res, −1, 0.9))`. `APPLICATION_FLOOR = 0.25`
  is exported and is the tuning dial.
- **`applyStatus` / `applyStatuses` take the player's stat block** as a trailing
  optional argument — the same contract `tickStatuses` already worked under,
  because this module cannot reach `derived.ts`. Monsters need nothing passed:
  they answer with their own innate + condition-modified resistances, so **every
  monster-targeted call site was already correct and none were touched.**
- **Passing the block is always safe.** It is consulted only when the bearer
  really is the player (`bearer === state`), so a call site whose target varies
  hands it over without checking.
- **Transformations go through a separate door, `reform`.** Escalating past a
  cap, souring in water, and leaving a successor behind on expiry are conditions
  BECOMING other conditions — the dose that produced them was already answered
  when it landed, and taxing the change too would bill a resistant body twice for
  one application. Symmetric for both bearers, which is why it is its own
  function rather than an omitted argument.

### The six call sites that changed

All of them are *something done to the player*; every one is in `combat.ts`.

| site | what arrives |
| --- | --- |
| monster attack riders | a bite's poison, a claw's bleed ← **the one that matters** |
| enemy working strikes | an enemy spell's `inflicts` |
| enemy working `afflicts` | the working arriving, blow or no blow |
| spell backlash | a working that turns on its caster |
| status retaliation | what your own afflictions tear back with |
| approach opening | what the road in did to you |

**Deliberately NOT changed:** `spec.grants`, gene `confers`, a performance's own
conditions. Resisting your own doing is backwards. It costs nothing either way
today — all 37 element-bearing conditions are afflictions and every self-granted
one is elementless — so a grant is unresisted by its own data.

## Two findings worth a look

- **The card's design target holds for 14 of 16 escalating conditions, not all
  16.** Escalation is measured in intensity for `sum`/`highest`/`absorb`, so
  resistance raises applications-to-escalation there as intended. `bleeding`
  (`count`, "every fresh cut is its own wound") and `dazzled` (`extend`,
  "longer, not worse") measure in stacks instead — resistance makes each dose
  shallower without changing how many it takes. That reads as correct rather
  than as a gap: the *number* of applications is the mechanic in both. Flagged
  because the card predicted otherwise.
- **`element` turned out to be the affliction marker**, not merely a hint. There
  is no `beneficial` flag on `StatusDef` and none is needed. That is what makes
  the grants/afflictions split cost nothing today, and it is the thing that
  would break first if a buff ever wanted an element.

## What to tune in review

**`APPLICATION_FLOOR = 0.25`** is the only number, and it is a placeholder
chosen to keep the arithmetic legible, not a measured one. At 0.9 resistance —
the clamp — a dose lands at the floor rather than at 0.1, so:

| resistance | lands | doses to escalate a cap-3 `punctured` |
| --- | --- | --- |
| 0.00 | 1.00× | 6 |
| 0.25 | 0.75× | 8 |
| 0.50 | 0.50× | 12 |
| 0.75 | 0.25× | 24 (floor binds from here up) |
| 0.90 | 0.25× | 24 |

Raise the floor and high resistance stops mattering; lower it and a resistant
species is effectively immune again. The question is whether 24 doses is a wall
or a build.

## Tests

`tests/statuses.test.ts`, eight cases: the ice slime that does not freeze,
vulnerability deepening by the same arithmetic, the floor, elementless
conditions never resisted, the player's block honoured only for the player,
transformations not billed twice, applications-to-escalation rising where depth
is measured, and staying put where count is.

## Docs

`CONTENT_GUIDE.md` §conditions now carries the `element` vs `dot.type` table,
the floor and why it exists, the depth-vs-count split, and the omit-for-buffs
rule.
