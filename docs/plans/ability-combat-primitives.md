---
id: ability-combat-primitives
title: Combat primitives under the abilities — contest, turned aside, rattle, typed power, attribute ceiling
kind: story
status: draft
system: combat
parent: unique-abilities
save: ''
updated: 2026-09-26
invariants:
  - completability
  - modFingerprint
  - two-validation-layers
  - player-only-carve-out
done:
  - A condition carrying contest.turn parries in a lane beside PARRY_CAP, certain once the defender's force is twice the blow's
  - A condition carrying contest.deflect shaves each hit by its share, and at share 1 the blow is turned aside with none of the hit bookkeeping run
  - A turned-aside blow still rattles the attacker, and a turned-aside or contest-parried blow still spends the monster's committed technique
  - tests/incoming.test.ts's 1-damage-floor tests are unchanged and green, and the turned-aside branch has its own tests
  - intensityCap is enforced after the amplifier, and a rattle clears at the attacker's next bar fill and at combat end
  - unguardable reaches weapon swings and techniques only, and lands as pure damage — skipping monster dodge, armor, resistance and weakness (a test covers a resistant and a vulnerable monster)
  - spellPower heat, lightning and light are read after the strike's type resolves, and damage technique is read at the technique damage site and the counter answer
  - attrCeiling lowers attributes where formulas and screens use them as numbers and never where gates read them (a test asserts attrValue is unchanged)
  - Both validation layers restrict contest, unguardable, attrCeiling and the damage technique scope to projected statuses, and reject spellPower type scopes on gene-conferred and monster-worn statuses
  - StatusDef.projected, the melee pseudo-tag and ModOriginKind ability exist
  - The PARRY_CAP comment and the untouchable law each record their written exemption, in the same commit as the lane and the branch
  - MARTIAL.md records the contest lane, the turned-aside branch and both exemptions, and PSIONIC.md states that psionic strikes gain nothing from typed spell power
  - No save change, no content uses any of it yet, npm run verify green
---

# Why this ships first

Half of what the three abilities ask for is combat law. Built here as
StatusDef fields, dormant and test-locked, before any ability content exists —
so each rule is judged on its own, and the chassis ([parent](unique-abilities.md))
only switches them on. **Player-side readers only** (the carve-out in the
parent). This card owns the first part of the parent's canonical list:
`contest`, `unguardable`, `attrCeiling` and the `damage:technique` scope are
projected-only; `intensityCap` is not (the rattle is inflicted on monsters);
`spellPower:<type>` is legal on gear but rejected on gene-conferred and
monster-worn status defs, where nothing reads it. The WWM story adds its four
fields to the same list.

# The fields

## `contest` — Power against the blow

The defender's force is `forcePer × the status's intensity`. The incoming
force is the blow's own size in damage units: `es.damage × mod.damage ×
position × looming × bully × the technique multiplier`, the technique
multiplier read from `action.tech`. (The existing onParry stamp at
combat.ts:3856 omits it; the contest must not.) `R = defender ÷ incoming`.
Guards: defender force 0 gives share 0; incoming force 0 gives share 1.

**`turn: { from, full, answer }`** — a parry.

- Chance = `max(min(PARRY_CAP, parry + guard.parry), clamp((R − from) ÷ (full − from)))`.
  At a share of 1 there is no roll. Below it, a plain `chance()` like parry
  today — no mercy counter, so the "a proc must be capped" rule has nothing to
  buy.
- A success runs the existing parry branch (combat.ts:3839-3878); the riposte
  is `defender force × answer`.
- Endpoints approved by the user: proportional, `from 0, full 2` — half the
  blows of an even opponent, every blow of one half your strength.

**`deflect: { from, full, rattle? }`** — a guard.

- Share = `clamp((R − from) ÷ (full − from))`, approved endpoints `from 0,
  full 1`: the blow is reduced by your force, gone once your force matches it.
- Below 1, each hit's raw is multiplied by `1 − share`, beside the counter's
  `reduce` (combat.ts ≈3957-3968). The per-hit floor of 1 stays (3983).
- At 1, the blow is **turned aside** (below).
- `rattle` names a status applied to the attacker at `share × 2/3`.

## The turned-aside branch

A `continue`, placed **after** the monster's technique bookkeeping
(combat.ts:3895-3907 — the committed technique is spent: cooldown, uses,
exit position) and **before** the counter pick (3928). The rattle is applied
**before** the `continue`, so a turned-aside blow rattles its attacker at the
2/3 cap. Everything else a landed blow does is skipped: prevented.onHit,
noteAbsorbed, damagePlayer, onHit, hitsTaken, onContact, riders, CON and
resist XP, the counter answer (3991-4077). The blow never happened, for every
other purpose.

**Ordering fix from the adversarial pass.** A contest parry that fires
before the bookkeeping leaves the monster's technique unspent, so the monster
picks it again every swing — the Death Knight would repeat Gather forever and
never cast. The contest's outcomes (turn or turned aside) therefore run after
the bookkeeping. The looming, bully and position reads they need (3909-3928)
are pure and move up with them. Ordinary dodge and the stat parry keep today's
order; changing what a plain parry costs a monster is a separate call.

## `intensityCap` and the rattle

`StatusDef.intensityCap`, enforced inside `inflict` after the amplifier and
resistance factor (statuses.ts:211) — a caller-side clamp can be exceeded
today. The rattle status is native (never `weight_of_hunger`: no borrowed
signature conditions): a `speed` mult of −1 × intensity, cap 2/3 so the bar
never runs below a third. It has no timer and is removed on the attacker's
next `barFill` (which fires before its swing, ≈combat.ts:3748) and on
`combatEnd`. `speed` compounds ×(1+v) on the monster side
(monsterStats.ts:475-477); the base carries its own cap at
`MONSTER_ACTION_BAR/6` (386), and the ×1/3 holds on top of it.

## `unguardable` — pure damage

The player's blow skips the monster's dodge and lands as **pure damage**
(user, 2026-09-26): not affected by the monster's armor, resistance or
weakness. It lands at exactly its raw size whatever the target is.

- Joins the single `sure` flag (combat.ts:3207-3210) **only** for weapon
  swings and techniques — not crafted spells, not gene actives (the
  adversarial pass: otherwise every grimoire spell turns undodgeable).
- One `pure` parameter through `monsterSlice` (combat.ts:1207-1262). With it
  set, `worn` is 0 (armor, ≈1240) and `resistance` is 0 (≈1226-1232), which
  drops the typed resistance, a negative resistance (weakness),
  `resElemental`, `resRanged` and penetration's say together. The slice
  reports `resistance: 0, pierced: 0`, so the combat log reads it honestly.
- Armor was the reading of Empty's "ignores deflection" (monsters have no
  parry and no deflection); the user confirmed it and widened it to pure.
- **Kept, by default** (flag for veto): `damageTaken` and `ward`. The code
  treats `damageTaken` as the body, not a barrier ("a slime does not turn a
  sword aside, it simply minds it less", ≈1242-1244), and a ward is a flat
  shield on top. The alternative skips both, so a pure blow's dealt figure
  equals its raw figure exactly.

## Typed spell power

`spellPower:heat`, `spellPower:lightning`, `spellPower:light` (the code's
names for fire, electric, light). The linter accepts them today but nothing
reads them. Made live:

- castCraftedAttack: the per-strike raw is computed before the `orType` pick
  (2549-2556); reorder so the scoped multiplier applies to the resolved type.
- the skill `spell` active (≈3363).
- **Not** castCraftedSelf — it damages the caster.
- Monster casting is out of scope (carve-out).
- `modTargetValid` (tests/content.test.ts:125-130) and `targetOk`
  (forge/lib/validate.ts:589-594) admit only scopes something reads.

Psionic strikes are always physical (psionic.ts:466) and gain nothing — stated
in PSIONIC.md, not patched.

`damage:technique` — the same lane at the technique damage site (3268) and
the counter answer (1797-1801). Projected-only (both layers): a standing
technique-only multiplier on gear would buy technique power for nothing,
against MARTIAL.md's "techniques buy their power with position and stamina".

## `attrCeiling`

The ceiling is the status's intensity, applied **after fusion**. Every place
an attribute is used as a NUMBER reads `min(value, ceiling)`:

- the baseStats accessor (derived.ts:451-452)
- actions.ts:220, bestiary.ts:152, combat.ts:313, combat.ts:898,
  derived.ts:369, mutagens.ts:477
- screens, so no screen prints a number the formula does not use: the
  stat-breakdown tooltip base (derived.ts:796-797), the gene card
  (ui/lib/format.ts:583), the efficiency tooltip (Sidebar.svelte:155-161,
  effBreakdown) and the fused-attribute value (Sidebar.svelte:252, 388)

Gates keep the real value: conditions.ts:17 and 40, achievements.ts:57, item
requirements, peaks. **Do not** cap inside collectBaseMods's training-rank
lookup (attributes.ts:252-262): its milestones target the attribute itself
(+1 at levels ending in 5, +1% at levels ending in 0), and capping them lowers
the value gates read — STR trained 37 reads 42.2 uncapped and 39.8 capped,
which fails a STR-40 school. A test asserts attrValue is identical with and
without the ceiling held.

Why numbers only: 41 live attribute gates, including every martial school at
20-40. A ceiling on gates would confiscate, and taking the ability off must
restore everything at once.

## Small pieces

- `melee` pseudo-tag beside `unarmed` (attributes.ts:69-78): set when no held
  item is ranged.
- `ModOriginKind` gains `'ability'` (types.ts:606-617): no damping, no fast
  ward (attributes.ts:300-304).
- `StatusDef.projected?: true` is declared here, so the projected-only lint
  has something to check. The chassis is what writes projected statuses;
  until it ships, the fields are exercised by tests alone.

# The two written exemptions

Record both where the laws live, in the same commit as the lane and the
branch:

- **PARRY_CAP** (derived.ts:311-312): "No amount of gear turns every blow
  aside." The contest lane is not gear and cannot be bought; the cap itself is
  untouched and still clamps the stat parry.
- **"Nothing makes you untouchable"** (types.ts:126-133;
  tests/incoming.test.ts:82-85, 446-452): a landed blow still deals at least
  1. A turned-aside blow is not a landed blow — it is a branch, like parry and
  dodge. The floor tests stay as they are.
