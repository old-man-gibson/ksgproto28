---
id: unique-abilities
title: Unique abilities — one worn slot, a ledger, projected conditions
kind: epic
status: draft
system: abilities
parent: ''
save: ''
updated: 2026-09-26
invariants:
  - completability
  - no-terminal-states
  - modFingerprint
  - two-validation-layers
  - player-only-carve-out
done:
  - Calorie Burn, Solar Reactor and Weakest Weapon Master ship as data on one chassis, each earned by its own special quest
  - Wearing no ability is a complete build, and no critical-path gate can require an ability or an ability-granting quest (linted, both layers)
  - The chassis word lists are locked by an exhaustiveness test that asserts every word against ABILITIES; adding a word fails a test on purpose
  - The derived-stats cache sweep passes with each ability worn, and an 8-hour unattended catch-up per ability ends finite
  - docs/ABILITIES.md exists and is marked CLOSED with a date, and PITFALLS.md records the player-only carve-out
  - npm run verify green
---

# What this is

Three authored abilities (user, 2026-09-26), and the question of whether one
system can carry them. The answer: yes, with a split.

- **The chassis** (story [ability-chassis](ability-chassis.md)) is thin: one
  worn slot, a ledger, and a closed set of data parts. Its only **stat**
  output is hidden conditions; trips and bursts act through onDefeat and the
  rotation.
- **About half of what the three abilities ask for is combat law, not
  ability machinery**: a contested parry, a blow that never counts as a hit,
  a bar rattle, unguardable blows, typed spell power, an attribute ceiling.
  That half is built first, underneath, as condition fields
  ([ability-combat-primitives](ability-combat-primitives.md)); the chassis only
  switches it on.
- **Several clauses bend** to fit settled law. Each bend is listed in its
  ability's story, with the law that forces it.

**Not the 2026-07-30 system.** The nen-style design discarded that evening
(docs/AUTHORSHIP.md §"Knowing what not to build") was player-authored: a
clause grammar, vows as currency, a naming language, save-derived seeds.
Nothing here is composed by the player. Abilities are authored entries,
earned, worn one at a time. Keep it that way: no clauses, vows, naming, seeds.

**Not the classes seed.** Classes stay a separate system (user, 2026-09-26);
[classes.md](classes.md) is untouched. A future class would be a second slot,
not an entry in this one.

**Filed for now, under the user's direct ask** ("for now b", 2026-09-26),
while alpha-band-one is still `review`. The option offered was "a docs/plans
card now"; it is filed as one epic with five stories because the template
reserves epics for work with two or more stories — collapse it into one card
if preferred. Unlike floor-zero-tutorial, this is a separate epic, not a story
under alpha-band-one. Filing it makes alpha-band-one's done line "no new card
entered docs/plans/ while this one was open" false (it already was, after
floor-zero-tutorial and the forge-tilemaps cards); amending or dropping that
line is the user's call.

# Settled with the user (2026-09-26)

| Question | Answer |
|---|---|
| Where the design lives | docs/plans cards, now |
| Relation to classes | Separate systems |
| How an ability is earned | A special quest per ability, placed through the game |
| Calorie Burn's "instant death" | Collapse produces the `dead` fight outcome with knockout consequences; the stop-burning cutoff defaults to 10% |
| Flowing and Heavy | Both exemptions approved, proportional endpoints |
| WWM attribute ceiling | Fixed; attribute XP past the ceiling routes into Power |
| WWM growth | Option (a): real reps with a multiplier, every technique drilled, rungs earned that way kept. Added: new technique-use thresholds past 10,000 — "100k, 1m, 100m, 1b times (and all inbetween)", each "progressively more powerful, exceptional and destructive" (see the rungs row) |
| Rungs past 10,000 | **Every build**, not WWM only: "it just won't be feasible for most to achieve those thresholds". One rung per power of ten. The exact bonuses still need designing |
| Prestige | "The unique ability is new every prestige, but players can choose to later keep it on prestige and gain bonuses to efficiency, caps, power etc." Reset by default; a bought keep option carries one; carries scale it (chassis card) |
| Attributes | Solar Reactor CON + WIS; Calorie Burn CON + STR |
| Solar's buff | Automatic when the reactor is full and the player is in a sun area. What happens otherwise is open (Solar card) |
| Empty | Ignores armor, and deals **pure damage**: not affected by the enemy's weakness or resistance |
| Monsters | **Never wear unique abilities.** Genes are their equivalent, and unique monsters have their own special abilities. The player gets mutagens AND unique abilities. The user's words: "this is where I break my own rule" |

## The carve-out, stated as law

PITFALLS §7 says every player-facing subsystem stays data-expressible from
the monster side. **Unique abilities are the one exception** (user,
2026-09-26). Consequences, all deliberate:

- The ledger lives on `GameState` only. No `MonsterDef.ability`, no monster
  ledger, no `{ burst }` rotation entry.
- The player-side fields the abilities switch on are read only where the
  PLAYER defends, attacks, trains or practises. One canonical list, enforced
  in both validation layers:
  - **Projected-only**: `contest`, `unguardable`, `attrCeiling`,
    `routeExcess`, `repMult`, `drillsAll`, and the
    `damage:technique` mod scope.
  - **Not** `intensityCap` — `wwm_rattled` carries it while inflicted ON a
    monster, where it works both ways by construction (an ordinary `speed`
    modifier).
  - **Not** `spellPower:<type>` — gear may carry it — but it is rejected on
    gene-conferred and monster-worn status defs, where nothing reads it.
- Opening a field to monsters later — say for a unique monster's special —
  means building its monster-side reader in the same change.

Record this in PITFALLS §7 when the chassis ships.

# The shape, in one screen

| Part | What | Where |
|---|---|---|
| Slot | One worn id, the earned ids, one ledger per ability. `null` is a complete build. | `GameState.abilities` (save v55) |
| Ledger | Gauges, latches, pending latch changes, trip marks, attribute shadows. Saved. | `abilities.holds[id]` |
| Signal | Closed readings: trainedAttrs, engagedSeconds, gauge, gaugeShare, martialTotal, techniqueTotal (+ sunlight, added by the Solar story) | `readSignal` in systems/abilities.ts |
| Curve | const, linear, power, rampTo, sum | pure `evalCurve`, finite by construction |
| Flow | Change a gauge per game minute, per combat tick, or on an event (eat, technique, attrXp) | always-on block beside tickExposure; combat step; `noteAbilityEvent` |
| Latch | A player switch (stance, cutoff); some apply at the next bar fill | ability card |
| Projection | A hidden condition at an exact intensity, or an HP ceiling from a harm gauge | `syncWorn` beside syncGeneStatuses |
| Trip | A gauge crossing whose outcome is `knocked_out` or `dead` | combat step → onDefeat |
| Burst | Spend a gauge for a buff condition, a gauge fill, or an authored spell | rotation id `ability:<id>:<burst>` |

**Why a ledger and not a status or a pool.** clearField strips every status
on both sides (combat.ts:2238-2250); a `becomes` successor loses its `data`
(statuses.ts:486-493); statuses do not tick while travelling
(game.ts:192-198). Pools are a closed union (types.ts:988) and every pool's
trigger subject is offered to every player (triggers.ts:102-109).

**Why projections.** Statuses are already fingerprinted by effective
intensity (derived.ts:613), already tooltip-honest, already read by every stat
path. Inputs are snapped to a grid before a curve runs (shares to 1/20,
absolute gauges to quarter-steps of log2, levels are integers), so a
projection takes a bounded set of values and cached equals fresh exactly. The
chassis adds **no modFingerprint part and no StatKey**.

**Unworn means settle only.** Swapping is free outside combat and refused in
combat or while recovering. While an ability is not worn, only flows and
projections marked `settle` run: they move gauges toward rest (a bank drains,
a debt repays, a store digests) and keep a cost standing until its gauge is
at rest. Everything else freezes. This closes the swap exploits the
adversarial pass found (bank Solar outdoors, unwear for the roofed tower,
rewear at the boss; unwear to drop a penalty). Lint: every gauge that feeds a
non-settle projection has a settle flow toward rest, unless it is marked
`progress` (accumulated growth nothing reads while unworn — WWM's routed
levels) or `perFight` (zeroed when a fight starts and ends; swaps are refused
in combat).

# Closure

The chassis is content-hungry at the roster level and closable only by
declaration (the arcane lesson). **The roster is exactly three.** An
exhaustiveness test enumerates every word union (signals, events, curves,
conditions, trip kinds, outcomes, burst outputs) and asserts each member has a
reader and a consumer; a new word fails it on purpose, so reopening the
chassis is visible. When the three ship, docs/ABILITIES.md is marked CLOSED
with a date and new ability ideas go to LONGTERM.md, which owes nothing.

Generality, measured: seven unseen abilities were run against the design as
stress fixtures (not a roster). One was pure data (a glass cannon); three
needed one or two new words each (a `hurt` event, lifesteal, a gold signal);
one needs a moon the world does not have; one needed bespoke code. So each
new ability after these three is expected to reopen the chassis a little. That
is the price, stated.

# Stories, in build order

| Card | Save | What |
|---|---|---|
| [ability-combat-primitives](ability-combat-primitives.md) | none | contest, turned-aside branch, rattle cap, unguardable, typed spell power, attribute ceiling — dormant, test-locked |
| [ability-chassis](ability-chassis.md) | v55 | slot, ledger, the parts, the quest reward, forge registry, ability card |
| [ability-weakest-weapon-master](ability-weakest-weapon-master.md) | — | stances, ceiling, XP routing, reps, rungs past the summit |
| [ability-solar-reactor](ability-solar-reactor.md) | — | sunlight, bank, bursts, Disintegration Ray |
| [ability-calorie-burn](ability-calorie-burn.md) | — | calories on dishes, burn, max-HP debt, trips, the `dead` outcome |

Estimated size: about 2,700 lines of source and 1,100 of tests.

# Defaults taken — veto before execution

Each is built as written unless the user says otherwise.

- **Ability-granting quests do not bump `quests:completed`**, so no quest
  count gate on the critical path can come to require one.
- **Pure damage keeps `damageTaken` and `ward`** and skips armor, resistance
  and weakness (primitives card).

# Still open for the user

- **The bonus at each rung past 10,000** — the WWM card carries a strawman
  table only.
- **Prestige keep**: does the ledger carry, or only the earned status? Does
  "new every prestige" mean the same ability re-earned, or a different one
  offered each run? One boon rank, or one ability per rank? And the carry
  bonus rates (chassis card).
- **Solar out of full sun**: what buffs when the bank is not full or the
  player is in the dark. The draft is a discharge latch (Solar card).
- **Quest placement**: each special quest's giver, spot and band are
  suggested in its story, flagged for veto.
- **Burst ids** `prime` and `flare` are placeholders; every player-facing
  name is the user's.
