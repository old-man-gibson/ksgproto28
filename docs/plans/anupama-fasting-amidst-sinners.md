---
id: anupama-fasting-amidst-sinners
title: Anupama, Fasting Amidst Sinners
kind: story
status: review
system: monster
parent:
save:
updated: 2026-08-09
invariants:
  - completability
  - no-terminal-states
done:
  - The rule it breaks is named explicitly in a comment on the entry
  - It is beatable by the longsword-only player
---

# Anupama, Fasting Amidst Sinners

## note:
this is both for the mutagen as well as for the monster and its actual combat behavior.

Tier 5 asuroid. The tier's law, from the asurendra block in
`mutagens.data.ts`: **each one breaks a rule of the game rather than bending
a number.**

Precedents to sit beside:

- **Tarunavāk, of Sixteen Tongues** — one word of the sixteen at a time,
  spoken for free, each louder than the last.
- **Vashkāra of the Unheld Blades** — six grips, and not one of them a hand.

## The design (author's, verbatim — this is the intent, and it wins)

### Special 
the player/monster cannot attack normally. 
imparts a hunger condition to to any combatant that attacks or casts a spell/miracle/psionic working (no cap on stacks). the order is as follows:
- hostile effect is initiated and resolves
- hunger is applied or increased by 1
- hunger deals a small amount of dark damage, half of it bypasses resistances and immunities, keyed off the imparter's wisdom (anupama when fighting it or the player when mutagen is slotted) and based on total stacks.

### Active ability
The Weight Of Hunger: Deals half untyped, half dark damage to all creatures in combat based on their current hunger, then inflicts a penalty to action bar speed based on the nth root (whichever is the optimium between punishing and justifiable, max of 3x slower but no longer than 3 seconds) of hunger. this penalty is removed once the bar fills and the creatures continue filling the bar as normal (an action completed after the slowdown from weight of hunger can impart a stack of hunger if hostile).

### Attack Arm
Has uniquely no bonus to damage and instead grants a bonus to all regeneration based on the nth root of unarmed attack damage, experimentally try between 4th root on f to a 2.5th root at s.	

### Defense Arm
bonus to armor and reduces condition penalties and damage based on how many stacks of hunger exist on the field (stack-based scaling is logarithmic)

## Notes:
the condition ids should be called `hunger_anupama`and `weight_of_hunger`

---

## Where it stands (2026-08-10)

**Built and green at `npm run verify` — 1543 tests.** Six systems changes and
the gene itself:

| | |
| --- | --- |
| `StatusDot.pierce` | a share of a dot that ignores resistance *and* immunity |
| `MonsterDef.wears` | the monster-side mirror of a gene's `confers` |
| `blocks: ['swing']` | narrower than `attack` — refuses the plain blow, not the deliberate act |
| `feedTheFast` | hunger lands on whoever ACTED, both sides, behind both refusal gates |
| `fasts` + the two arms | regeneration in place of damage; armour and warding paid by field hunger |
| `perTargetStacks` | the first `ActiveSpec` pricing field that reads the target |
| `asurendra_anupama` | the gene, in mutagens.data.ts |

**Two things deliberately NOT done, neither of them quietly:**

1. **The monster does not exist.** Neither does Tarunavāk's or Vashkāra's —
   the whole tier is gene-only today, and `MainGeneDef.from` is not linted
   against `MONSTERS`, which is why that has gone unnoticed. Authoring one also
   needs something that does not exist: `MonsterAction` is
   `{ cast } | { technique }`, so a monster has no way to use a gene ability.
   Tracked separately.
2. **The Active is wholly dark, where the design asks for half of it to bypass
   resistance.** `StatusDot.pierce` does exactly this for the condition, but a
   gene ability has no equivalent share and `riders` are typed. TODO-marked on
   the entry itself.

**Every number in `fasts` and the ability is a placeholder.** The shapes are
settled; the values are not. That is what `review` is for, and
[balance-harness](balance-harness.md) is the tool.

## Build

Translation of the sections above into shapes that already exist. Where it
invents something it says so, and says why nothing existing would do. Line
numbers were true at save v45.

### It is two entries, not one

An asurendra is authored twice and linked: the **fight** in `monsters.data.ts`,
the **gene** in `mutagens.data.ts`, joined by `MainGeneDef.from` (the species
that drops it). The note at the top of this card is therefore literal — the
build touches both files, and **the numbers are not shared**. `flatBase` and
`ceiling` govern the gene; the monster's stats derive from its attributes
through `monsterStats.ts`, as everything else in the bestiary does.

Match the existing pair for scale: `tier: 5`, `genus: 'asuroid'`,
`flatBase: 1400`, `ceiling: 4.8`.

### The four sections ARE the four arms

`MutagenArm = 'attacks' | 'defenses' | 'active' | 'special'`
([types.ts:4449](../../src/core/types.ts)). Special / Active / Attack Arm /
Defense Arm map one-to-one onto it, so nothing here needs a new taxonomy:
`base?: Partial<Record<MutagenArm, Modifier[]>>` carries three of them and
`ability` carries the active.

### Precedent: a rule-break earns its own field

`MainGeneDef` already carries `tongues` (Tarunavāk) and `refutes` — **one
bespoke optional field per asurendra whose break no general mechanism
expresses.** That is the established shape, and it is why the tier does not
generalise. Anupama gets `fasts`, holding the Special, both arm formulas, and
the ability's coefficients.

### `hunger_anupama`

A stacking condition, `dot: { type: 'dark', … }`.

- **No cap, deliberately.** `bleeding` caps at 5 and `seeded` at 6; this one
  simply omits the escalation cap. That omission *is* the rule it breaks, and
  it should carry a comment saying so — `done` criterion 1.
- **Magnitude is keyed off the IMPARTER's wisdom, so it is fixed at application
  time.** It cannot be read when the dot ticks: by then Anupama may be dead, or
  the gene unslotted, and the number would change or vanish underneath a
  condition already on you.

  > **Correction, made while building.** An earlier revision of this section
  > said to stamp the wisdom into `StatusInstance.data`. That is unnecessary.
  > `intensity` and `stacks` are already two separate fields doing two separate
  > jobs: intensity is *magnitude*, stacks is *count*. So hunger is applied with
  > `intensity: wisdom × HUNGER_PER_WISDOM` under `stacking: { mode: 'sum' }`,
  > and the sum is automatically both linear in applications and scaled by who
  > made each one. Anupama's hunger bites harder than a player's without either
  > needing a second condition. `data` stays free for what it is for.
- **Ordering.** The hostile effect resolves, *then* hunger is applied or
  incremented, *then* it deals its damage.

  > **Decided while building.** The third step lands **one tick later**, not
  > inside the action. `tickPlayerStatuses` runs ahead of `tickCombat`
  > (actions.ts), so an immediate bite would have meant lifting the dot
  > arithmetic — the pierce maths, the blessing heal-redirect, the `data.dealt`
  > bookkeeping — out of the tick loop so the two could not drift. That is a
  > refactor of a hot path bought for 100ms, and it was judged not worth it.
  >
  > **One consequence, accepted rather than overlooked: a blow that ends the
  > fight is never paid for**, because winning clears the hunger with it. If
  > that ever reads wrong in play, the fix is the extraction above, not a
  > special case at the kill.

  What the hook DOES honour strictly: hunger is fed by an action *taken*, not
  one that connects — "attacks or casts", not "hits" — and an action refused
  (a held bar, a fast declining its own swing) is not an appetite. Both gates
  sit ahead of `feedTheFast` for that reason.

### Systems change 1 — a pierce share on `StatusDot`

"Half of it bypasses resistances and immunities" has no home today.
`bearerResistance` resists the whole dot:
`dealt = raw * (1 - res)` ([statuses.ts:1118](../../src/core/systems/statuses.ts)).

Add `StatusDot.pierce?: number` — the share that skips the multiply, default 0:

    dealt = raw * (p + (1 - p) * (1 - res))

Immunity (`res ≥ 1`) still lets the pierced half through, which is precisely
what the design asks for. This is a much smaller change than putting `untyped`
on dots would have been: `dark` resistance keeps meaning something for the
other half, and the type system is not escaped.

> ⚠️ **This is the same function [condition-resistance-on-application](condition-resistance-on-application.md)
> rewires.** Two cards, one code path. Do not fold them together — each wants
> its own before/after, and whichever lands second inherits the other's.

Decide once: `pierce` applies to the dot path only. The parting-blow path
([statuses.ts:1288](../../src/core/systems/statuses.ts)) resists the same way,
but hunger has no parting blow, so leave it untouched until something needs it.

### Systems change 2 — hunger lands on the ACTOR

Every existing status field describes what happens to the **bearer**. This one
applies to whoever acted, after their action resolved. There is precedent for
adding a declarative reactive field rather than special-casing in combat:
`StatusDef.incomingBite` and `opensTempo` were both added this way and applied
exactly where their triggering events already fire.

The rule belongs to the **gene**, not to a status — so it lives on `fasts` and
is evaluated where hostile actions resolve, for both sides.

### "Cannot attack normally"

Not a `grant`. `grants` is for things a body *can do*; this is a prohibition,
and putting it there would make the field mean two opposite things.

`confers` is the right home — "conditions this body simply WEARS while the gene
is expressed — usually hidden ones, standing for a rule rather than announcing
themselves." A hidden `fasting` condition, kept in step by `syncGeneStatuses`.
Same shape as the troll knitting itself shut.

> **Three corrections, found while building slice 3.** The paragraph above is
> right for the player and wrong everywhere else.
>
> 1. **`StatusDef.blocks: ['attack']` already exists, and is too coarse.**
>    `statusBlocks(state, 'attack')` gates the whole bar-fill at
>    [combat.ts:2764](../../src/core/systems/combat.ts) and returns before
>    anything is chosen — spells included. Anupama must not block casting: the
>    Special explicitly says casting a spell/miracle/working *imparts hunger*,
>    so casting has to remain possible. **Only the plain swing is refused.**
>
> 2. **The precedent to copy is Vashkāra's, not the troll's.** At
>    [combat.ts:2781](../../src/core/systems/combat.ts) the bar fills, an action
>    is chosen, and if it `usesHands` while no hand is free the action is
>    **held** — "a body that fights by itself still expects you to be doing
>    something." Anupama wants that exact shape one step later: choose the
>    action, refuse it if it is the plain swing, hold the bar. Spells,
>    techniques and the gene's own ability all still spend it.
>
> 3. **`confers` is player-only.** `syncGeneStatuses` reads
>    `expressedGene(state)` and only ever touches the player
>    ([mutagens.ts:429](../../src/core/systems/mutagens.ts)); `MonsterDef` has
>    no equivalent field at all. Since this card covers the monster as well, the
>    monster half needs a **new `MonsterDef.wears?: StatusApplication[]`**,
>    applied at spawn — the mirror of `confers`, and general enough that it is
>    not an Anupama special case. Without it the fight version simply does not
>    fast.

**Completability is already satisfied and needs no work.** Reverting to bare
costs no material ([MUTAGENS.md](../MUTAGENS.md), "a free floor… Same intent,
no softlock"), so a player wearing this with nothing else to swing is never
stranded. Reverting still has to settle, so the worst case is the rest of the
current fight — and a `forced` fight ends through `retreatToSafety` regardless.

### Both arms are formulas, not Modifiers

`base` takes `Modifier[]`, which is static. Neither arm here is:

- **attacks** — regeneration from the nth root of unarmed attack damage.
- **defenses** — armor and condition reduction from the **field-wide** hunger
  total, logarithmically.

So both live on `fasts` and resolve where their inputs are known.

> ⚠️ **Field-wide stacks is a new aggregate.** Every condition in the game today
> reads per-bearer. This needs a sum across all combatants, computed once per
> tick and passed down — not recomputed per read.

> ⚠️ **`modFingerprint`.** If either arm enters the flat stat block it is a new
> mod source and must join the fingerprint. But the field-wide hunger sum
> changes almost every tick, which would thrash the memo. Prefer keeping both
> arms **out** of the block, in the scoped / roll-time lane where
> `requiresMonsterTag` already lives. Decide this before writing either arm.

### The ability: what `ActiveSpec` can and cannot say

Scoped 2026-08-10, against the `gene` variant of `ActiveSpec` (types.ts:691).

**Already expressible, no work needed:**

- *"all creatures in combat"* — `splash: 1` with `splashAll: true`, which is
  documented as exactly this distinction: "a blow that carries past its target
  and one thrown at the room."
- *the slow it leaves behind* — `inflicts: [{ id: 'weight_of_hunger' }]`,
  which lands "on everything it reached".
- *half dark* — `damageType: 'dark'` plus a `rider` for the other half,
  resisted separately.

**NOT expressible, and this is the fourth systems change:**

> Every pricing field on `ActiveSpec` — `power`/`fromStat`, `fromAttr`,
> `amplifiedBy`, `scalesWithSpeed`, `flat` — reads **the caster**. Nothing reads
> the target. The Weight of Hunger needs the target twice over: its damage is
> "based on their current hunger", and the slow it inflicts is scaled by the
> nth root of that same number, per target.

Both gaps are one addition, not two — a field that prices a blow off a
condition the TARGET is carrying, and lets the inflicted intensity read the
same count:

    perTargetStacks?: { status: string; power: number; root?: [number, number] }

Authoring note: `StatusApplication.intensity` is a static number today, so the
per-target intensity has to be computed where the ability resolves rather than
declared on the application.

> **SHIPPED 2026-08-10.** `perTargetStacks` exists on the `gene` variant, with
> `{ status, power, inflictRoot? }`. `priceGeneAbility` takes an optional
> `target` and adds `power × stacks` beside `flat`; `perTargetInflictIntensity`
> answers the inflicted intensity, and is asked **per target** rather than once
> per blow, so a splash across four enemies owes four different answers. An
> ability with no `inflictRoot` keeps its authored intensities, so nothing
> existing changed shape.
>
> The panel prices with no target in front of it and reads as the blow's floor,
> which is why `target` is optional rather than required.

**No systems changes remain.** Everything the design needs now exists; what is
left is authoring the two entries.

### The quality ladder

`n` runs 4.0 at F to 2.5 at S. Write it as `[4, 2.5]` and interpolate by
quality — that is already the convention on this type (`tongues.everyTicks`,
`tongues.power`, `refutes.negate` are all `[worst, best]` pairs). The active's
envelope clamps *after* interpolation: at most 3× slower, never longer than 3
seconds.

### Left to tune, not to decide

`n` for the active's root; the coefficient behind "a small amount" of dark
damage; the log base on the defense arm. All three are numbers inside settled
shapes — [balance-harness](balance-harness.md) is the tool that answers them,
and none of them blocks a build.
