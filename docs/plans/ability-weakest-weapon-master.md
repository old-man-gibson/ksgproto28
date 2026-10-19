---
id: ability-weakest-weapon-master
title: Weakest Weapon Master — four stances, a fixed ceiling, techniques past the summit
kind: story
status: draft
system: abilities
parent: unique-abilities
save: ''
updated: 2026-09-26
invariants:
  - completability
  - modFingerprint
  - two-validation-layers
  - player-only-carve-out
done:
  - While worn, formulas and screens read every attribute at no more than the ceiling, and gates, item requirements and trained levels are untouched
  - While worn, attribute XP for an attribute already reading the ceiling goes to the routed gauge as virtual levels, which Power reads, instead of training it
  - While worn, every executed technique records reps with no drill-slot refusal, multiplied at write time, and rungs I-IV earned this way are kept when the ability is taken off
  - For every build, worn or not, rungs continue past 10,000 at every power of ten, each stronger than the last for strikes, counters and defensive forms, with a bounded tier count and bonuses the user has designed
  - resolvedMove stays finite for every tier from 0 to MAX_BEYOND_TIER for a strike, a counter and a defensive form
  - Power, Flowing, Heavy and Empty are a stance row under the 3x3 grid, change at the next bar fill, and switch off while a ranged weapon is held
  - The sidebar and skills panel show a capped attribute as its real value and the value formulas use (for example 45 to 20), and rep readouts are formatted
  - Both validation layers restrict routeExcess, repMult and drillsAll to projected statuses, and routeExcess to a status that also carries attrCeiling
  - MARTIAL.md documents rungs past IV and their generic bonuses as part of the one ladder every build climbs
  - The earning quest exists with the user's captions
  - npm run verify green
---

# The ability, as the user wrote it

Attributes capped relatively low; technique usage grows exponentially faster;
martial skills lose their caps and gain WWM-only bonuses. Four melee stances
(unarmed included): **Power** (damage ∝ total skill level and technique
usages), **Flowing** (parry ∝ Power against the blow, up to 100%, striking
back), **Heavy** (damage reduced by Power against the blow, down to 0, where
the blow never counts as a hit; rattles the attacker, never below 1/3 speed),
**Empty** (less damage than Power, proportional to it, ignores dodge,
deflection and parry).

User's additions (2026-09-26): the ceiling **stays fixed**, and attribute XP
past it **routes into Power**; reps are real and multiplied, every technique
drilled; and **new technique-use thresholds past 10,000** — "a single
technique becoming impossibly powerful once the player manages to use it
100k, 1m, 100m, 1b times (and all inbetween)".

Settled 2026-09-26: **one rung per power of ten** (10m included), and the
rungs **apply to every build**, not only while WWM is worn — "it just won't
be feasible for most to achieve those thresholds". WWM's rep multiplier is
what makes them reachable. The exact bonus per rung is still to be designed.

# Power

Power (`P`) is in damage units, one number read by all four stances:

```ts
const POWER = { curve: 'sum', of: [
  { curve: 'linear', of: { signal: 'martialTotal' },   base: 0, per: 0.4 },    // total skill level
  { curve: 'linear', of: { signal: 'techniqueTotal' }, base: 0, per: 0.0005 }, // technique usages
  { curve: 'linear', of: { signal: 'gauge', gauge: 'routed' }, base: 0, per: 2 }, // virtual attribute levels past the ceiling
] };
```

All three terms linear and in levels or counts, so one set of weights holds
early and late; all three steerable (the escalation preference: steer, don't
flatten). `martialTotal` sums the 24 combat-category skill levels.
`techniqueTotal` already carries the rep multiplier, which is why its weight
is small. The numbers are first guesses.

# The def

```ts
weakest_weapon_master: {
  gauges: [{ id: 'routed', cap: { curve: 'const', value: 1e9 }, progress: true }],
  latches: [{ id: 'stance', options: ['power', 'flowing', 'heavy', 'empty'], initial: 'power', atBarFill: true }],
  flows: [{ gauge: 'routed', every: { event: 'attrXp' }, amount: { curve: 'const', value: 1 } }], // × virtual levels
  projections: [
    { status: 'wwm_ceiling', cost: true, intensity: { curve: 'const', value: 20 } },
    { status: 'wwm_practice', intensity: { curve: 'rampTo', of: { signal: 'martialTotal' },
                                           over: [0, 600], from: 2, to: 64, k: 4 } },
    ...['power', 'flowing', 'heavy', 'empty'].map((s) => ({
      status: `wwm_${s}`, intensity: POWER, when: [{ latch: 'stance', is: s }, { wielding: 'melee' }] })),
  ] }
// wwm_ceiling  attrCeiling, routeExcess
// wwm_practice repMult (intensity, rounded, at least 1), drillsAll
// wwm_power    mods: damage add 1 (× P)
// wwm_flowing  contest { forcePer: 1, turn: { from: 0, full: 2, answer: 0.6 } }
// wwm_heavy    contest { forcePer: 1, deflect: { from: 0, full: 1, rattle: 'wwm_rattled' } }
// wwm_empty    mods: damage add 0.6 (× P); unguardable
// wwm_rattled  speed mult -1, intensityCap 2/3, removal barFill + combatEnd
```

The consts and the spread are for reading; the authored entry is a plain
literal (the chassis card's forge rule). `routed` is marked `progress` (the
chassis flag): accumulated, never drained, exempt from the settle lint.
`wwm_ceiling` is marked `cost` (the chassis flag): a clearField erasure does
not lift it for the rest of the fight.

## New StatusDef fields (declared by this card)

Projected-only, both validation layers — the parent's canonical list:

- `routeExcess?: true` — compares against the `attrCeiling` held on the same
  status; legal only beside `attrCeiling`.
- `repMult?: true` — the status's intensity is the write-time rep multiplier.
- `drillsAll?: true` — recordExecution skips the drill-slot refusal.

(An earlier draft had a fourth, `beyondSummit`, gating the rungs past IV on
WWM. The rungs are universal now, so it is gone.)

# The ceiling, and where the excess goes

- **The ceiling** is [attrCeiling](ability-combat-primitives.md) at a fixed
  20: formulas and screens read `min(value, 20)` after fusion; gates read the
  real value.
- **Routing** (`routeExcess`, read in grantAttrXp, attributes.ts:42-49 — the
  one function every attribute XP grant passes: actions ×4 through the split,
  combat ×13, alchemy.ts:578, tutorial.ts:132). While a projected status
  carries it:
  - **attribute already reading the ceiling** — its real value, `attrValue`
    (uncapped, fusion-aware, gear included), is at or above 20 → the whole
    grant goes to `noteAbilityEvent('attrXp', amount, { attr })`, and the
    attribute does not train and announces no level. `attrValue` is read once
    per grant and memoized on the derived-stats fingerprint, since combat
    grants arrive per swing.
  - **below it** → it trains normally; one grant may overshoot by at most its
    own size.
  - The chassis turns routed XP into **virtual levels** on the attribute
    progression starting at the ceiling (the `shadow` in the ledger), so
    Power's routed term is priced like real levels. Measured order of feed:
    training first (a training rep pays about 16 attribute XP per second at
    capped WIS and DEX), then combat (about 3-4 per second).
  - Checking the real value rather than the trained level matters for fused
    pairs: formulas read the pair's sum, so it reaches the ceiling with each
    component near 10, and XP past that is excess for every formula.
  - Trained levels are never lowered. A WWM earned late, with STR 45, keeps
    STR 45 trained and routes every new STR point.
  - tutorial.ts:132 grants exactly enough INT for the tutorial spell; no
    ability can be worn in the tutorial, so routing cannot starve it.
- **Gates.** Gates read the real value, which stops rising once an attribute
  reads the ceiling. A gate above it — STR 30 and 40, DEX 30-40, CON 25-40,
  and higher — is reached by taking WWM off to train; levels already reached
  are never taken away. The ability card says so beside the capped readout.
- **Visible.** While worn, the sidebar (Sidebar.svelte:388, 392-410, 419-437 —
  the fused, component and single-attribute rows) and the skills panel
  (SkillsPanel.svelte:518, 556) show both numbers, e.g. `45 → 20`. Both
  already print effective against trained; the capped value comes from the
  ceiling read, not from effectiveAttrs. "Weakest" is judged by what the
  screen shows.

# Reps, drill slots, and the rungs past the summit

**"Martial skills lose their caps"** read against what exists: no combat
skill declares `maxLevel` (skills.ts:98-103 returns Infinity). The caps a
martial player can see are the three drill slots (`MAX_DRILLED`,
martial.data.ts:107) and the 10,000-rep summit (`MASTERY_LADDER`,
martial.data.ts:115). WWM lifts the drill slots; the summit is lifted for
everyone (below), and WWM's multiplier is what gets a player there.

In `recordExecution` (martial.ts:769-785), while a projected status carries:

- `drillsAll` — skip the drill-slot refusal: every executed technique counts.
  The drilling list is left as it is.
- `repMult` — `held.executions += max(1, round(intensity))` instead of `+= 1`:
  2 per execution at a martial total of 0, rising to 64 by 600. Executions
  stay whole numbers.
- Write-side, so a rung is never demoted when WWM comes off (MARTIAL.md:
  re-learning never downgrades). Taking WWM on and off to farm mastery for
  another build is a trick of the "know the system to game it" kind the
  exploit policy keeps; the ladder's own payoff tops out at ×1.3.
- Do not copy line 773's `const drilling = (state.drilling ??= [])` — the
  proxy trap (PITFALLS §1).

**Rungs past the summit — universal.** Past Perfected, a rung at every
power of ten (settled). They extend `MASTERY_LADDER` for every build; WWM
does not gate them, it only reaches them faster. This part reads no ability
state, so it can ship with or before the chassis.

⚠️ **The bonuses are not designed yet** (user, 2026-09-26: "the exact bonuses
need to be designed"). The table below is a strawman to react to, not a
decision. Constraints any design must keep: every kind (strike, counter,
defensive form) gains at every rung, and the numbers stay finite through
`MAX_BEYOND_TIER`.

| Rung | Reps | Strawman bonus on top of Perfected |
|---|---|---|
| V | 100,000 | power ×2; cooldown ×0.9; +0.2 penetration |
| VI | 1,000,000 | power ×4; cooldown ×0.81; splash 0.5 to every other enemy |
| VII | 10,000,000 | power ×8; cooldown ×0.73; one more hit |
| VIII | 100,000,000 | power ×16; cooldown ×0.66; pure damage (as Empty: skips dodge, armor, resistance and weakness) |
| IX | 1,000,000,000 | power ×32; cooldown ×0.59; the full blow to every enemy |
| X and on | 10^t | power doubles and cooldown ×0.9 per rung |

- **Power** means `damageMult` and `preventedMult`, the pair the ladder
  already scales; defensive forms, which have neither (types.ts:1745), scale
  `buff.duration` by the same factor. Cooldown shrinks at every rung from V
  and keeps its floor of 10 ticks. So every kind gains at every rung.
- **Counters** take the power factor and the cooldown only: fireCounter always
  lands one hit and rolls no dodge (combat.ts:1790-1812).
- **Splash to every enemy** is a code-side `splashAll` flag on the resolved
  move, used only by this schedule — `TechniqueMove.splash` spills onto one
  random flanker, and only gene specs carry `splashAll` today
  (combat.ts:3638-3639).
- **No NaN.** resolvedMove indexes `MASTERY_POWER[tier - 1]` and
  `MASTERY_COOLDOWN[tier - 1]` directly (martial.ts:319-323), four entries
  each. It reads them at `min(tier, 4) − 1` and applies this schedule as a
  separate step for tiers 5 to `MAX_BEYOND_TIER`. `masteryTierName`
  (`MASTERY_NAMES[tier - 1]`, martial.ts:178) returns "Beyond N" from tier 5,
  and techniqueEntries' `tier as 1|2|3|4` cast (martial.ts:221-225) is
  widened. A test walks every tier for a strike, a counter and a defensive
  form and asserts finite numbers.
- **Uniform ladder law** (MARTIAL.md): thresholds and generic bonuses live in
  code; data may only annotate a rung (a name). `TechniqueDef.mastery` notes
  widen from tiers 1-4 to any tier; unnamed rungs read "Beyond I", "Beyond
  II"… until the user names them.
- **Bounded**: the tier count stops at `MAX_BEYOND_TIER` (placeholder 15 —
  10^15 reps). Invariant C bounds the exponent, not the result.
- `masteryTier` and `repsToNextTier` (martial.ts:153-188) read past IV for
  every build. A rung reached is held like I-IV: taking WWM off never hides
  or demotes it.
- **Existing saves.** A technique already past 100,000 reps gains rung V on
  load with no migration (tiers are derived from executions). Check live
  saves for any before shipping, so the jump is not a surprise.
- **Readouts.** SkillsPanel.svelte:416, EntryConfigModal.svelte:130 and
  CombatPanel.svelte:790 print `{techniqueExecutions(...)} reps` raw; with
  counts running to sixteen digits they go through `fmt`, as the rotation row
  already does (CombatPanel.svelte:136).
- Reachability, stated honestly: at 64 reps per execution, a billion is
  about 15.6 million executions of one technique. Without WWM (1 rep per
  execution, and only for the three drilled techniques), rung V is 100,000
  executions of one technique: reachable over a long idle, the rest are not.
  That is the intended "not feasible for most".

# The stances

- A latch on the ability, rendered as a fourth row under the 3×3 stance grid
  (CombatPanel.svelte:350-354) while WWM is worn, labelled as a layer over the
  grid's stance — the two combine. Making the four stances ordinary styles
  would compete with the weapon schools for the grid's slots (styles.ts:31-34).
- `atBarFill`: a change made in a fight takes effect at the player's next bar
  fill. Otherwise pausing lets a player hold Heavy while the monster swings
  and Power for their own swing, and the price of Flowing and Heavy —
  withholding P from your blows — is never paid.
- `wielding: 'melee'`: the stance statuses drop while a ranged weapon is held.
  The ceiling applies whatever is held.
- **Flowing** — parries half an even opponent's blows, every blow at twice
  your Power; the answer is 0.6 P through the existing riposte.
- **Heavy** — each blow reduced by your Power; gone once Power matches it,
  and then never a hit. Rattle at `share × 2/3`, a turned-aside blow
  included.
- **Empty** — 0.6 P of **pure damage** (user, 2026-09-26): skips monster
  dodge and armor, and the monster's typed resistance **and** weakness, so the
  blow lands at exactly its size whatever the target is. Monsters have no
  parry or deflection; armor was their deflection. See `unguardable` in
  [ability-combat-primitives](ability-combat-primitives.md).
- Stance defences answer monster **swings**. Monster workings bypass parry,
  counters and bracing today (combat.ts:3754-3786); they bypass the contest
  too. Stated, not patched.

# Earning quest (suggested placement, flagged for veto; the user captions)

Giver: `militia_captain` (Threshold). Offered once band 1's first floor is
cleared. The kill objective's filter — unarmed, or a named floor — is the
user's call.

```ts
{
  id: 'weakest_weapon_master_trial', giver: 'militia_captain',
  objectives: [
    { type: 'stat', key: 'combat:parries', value: 200, desc: '…' },
    { type: 'kill', count: 50, desc: '…' },
  ],
  rewards: { ability: 'weakest_weapon_master' },
}
```
