---
id: bearer-seam
title: The mutagen resolvers take a bearer, not a GameState
kind: story
status: review
system: mutagens
parent: monster-genomes
save:
updated: 2026-08-13
invariants:
  - completability
  - modFingerprint
done:
  - Every read-side mutagen resolver takes (state, bearer) instead of (state)
  - resolveChromosome and the grants set are keyed memos, not single slots
  - Player behaviour is bit-identical — the existing suite passes unchanged
  - A monster with no genome resolves to bare and costs nothing to ask about
---

# The bearer seam

The first story of [monster-genomes](monster-genomes.md), and deliberately a
**pure refactor**: nothing a player can see changes. That is the acceptance
test, and it is why nothing else may ride along.

## The convention to copy, exactly

`statuses.ts` already settled this:

```
applyStatus(state: GameState, bearer: GameState | MonsterInstance, …)
```

**World first, wearer second.** `state` is the world — the RNG, `totalTicks`,
the event bus, the combat field. `bearer` is who is wearing the thing. The
player passes itself as both, which `syncGeneStatuses` already does today.

Do not collapse these into one parameter and do not invent a `Bearer` wrapper
object. The union plus a couple of small accessors is what the rest of the
codebase reads, and a third convention is worse than either.

## The accessor that does the work

```
genomeOf(bearer): Chromosome
```

- Player → `state.mutagens.chromosome`, unchanged.
- Monster → its def's genome (story 3). Until that exists, **every monster
  resolves to an empty chromosome**, which `expressedMain` already reads as
  `BARE` — a real body, not an absence. So this story can land and be correct
  before a single genome is authored.

`BARE` being a free floor rather than a manufactured item (MUTAGENS.md §8) is
what makes that true. A monster with nothing on is not a special case.

## What widens

**Most of them take a bearer INSTEAD of the world, not beside it** — and that
is what made this land with no call-site churn at all, because `GameState` is
a `Bearer`, so every existing `f(state)` still compiles and still means the
same thing.

Bearer-only: `expressedGene`, `expressedGeneBase`, `geneAbilityBase`,
`geneAbility`, `currentResolution`, `armGrants`, `liveGrants`, `routedType`,
`fastOf`, `fastRegenBonus`, `fastGuard`, and `playerGrants` → `bearerGrants`
(the one rename — one function, one name, and the equipment-layer constraint it
used to carry in its name is documented at `grantIsLive` instead).

`(state, bearer = state)` — they need the world as well: `syncGeneStatuses`
(the bus and the applier), `chromosomeMods` (`fieldHunger` is the FIELD's, read
off the world, while the fast answering to it is the bearer's), and
`refuteCast` (rng and `combat.sealed`; its bearer is last and defaulted rather
than second, against the convention, purely so its six call sites read
unchanged).

### Deliberately deferred, with reasons

- **`playerSizeRank` is untouched.** It reads the player's body for equipment
  rules, and monsters already have `monsterSizeRank(defId)`. Widening it now
  would put a second, half-wired size source on the monster side for no gain.
  It unifies in [monster-def-genome](monster-def-genome.md), where the genome
  supplies size with the authored tag as fallback — one story, one source.
- **`priceGeneAbility` keeps `stats: DerivedStats`.** Widening it needs the
  `statOf` reader, and `MonsterStats` is a genuinely narrower shape until
  [monster-stat-parity](monster-stat-parity.md) widens it. Nothing calls it
  with a monster yet, and adding a reader that answers 0 for half the stat
  vocabulary would bake in exactly the silent-drop behaviour parity exists to
  delete. It widens in [monster-gene-active](monster-gene-active.md), by which
  point there is a real caller and a real stat block.

**What does NOT widen, and must not:** `capacityLimit`, `capacityFree`,
`canSlotMain`, `slotMain`, `unslotMain`, `placeMutagen`, `removeMutagen`,
`establish`, `cutEdge`, `restoreEdge`, `refine`, `fuse`, `harvestKill`,
`settlingLeft`, `unlockMutagens`. Those are the player's crafting workflow —
capacity, settling, discovery, the drop roll. A monster does not shape its own
chromosome; it simply is one. `chromosomeOf` deliberately keeps its narrow name
on that narrow half, which is what stops a monster-side capacity pool from ever
looking like the obvious next step.

`isSealed` also stays: `combat.sealed` is a property of the fight, not of a
combatant.

## ⚠️ The memos, which is the part that actually bites

`resolveChromosome` and `playerGrants` held **one** cached entry each, keyed on
the chromosome. Sound while one chromosome exists; worthless the moment six do
— the player plus five enemies rotate through a single slot every tick and the
hit rate is zero. Grants are on the combat tick (`tickFloatingWeapons` asks
every tick, including all ~288k of an offline catch-up).

Both are now `Map<string, …>` keyed on `chromosomeKey`, capped at **8** — the
player plus a full formation with room to spare — with least-recently-used
eviction, so the player, asked far more often than any one specimen, is never
what a crowded fight throws out. An uncapped Map would be a leak across a long
session.

Two properties kept while doing it:

- `chromosomeKey` remains the single statement of what changes a resolution.
  A new field on `Chromosome` that affects routing must appear there — the same
  contract `modFingerprint` keeps for stats.
- The returned resolution and grants Set stay **shared and read-only**. Every
  caller copies before sorting; that did not change.

## How it was proved

The suite is the acceptance test, and it passed **unchanged in behaviour** —
1580 existing tests green, with the only edit to existing files being the
mechanical `playerGrants` → `bearerGrants` rename. `svelte-check` clean.

Six tests added, and one of them is the load-bearing one:

- A monster carrying no genome wears the bare sequence — `expressedGene` reads
  `bare`, and there is no null branch anywhere downstream.
- It answers for the monster and not for whoever is watching: a troll-bodied
  player and a bare specimen resolved side by side disagree about their gene,
  their ability and their grants.
- A bare bearer delivers a real shape that changes no number, which is the
  distinction between *wears nothing* and *is not wearing anything*.
- `fastOf`/`fastGuard` ask the bearer.
- **The cache keeps the player's entry alive through a five-monster
  formation.** Identity-checked, because a thrashing memo is a silent
  system-wide cost that no behavioural test would ever fail on.
  Mutation-tested: setting the cap back to 1 fails this test and nothing else.
- Every ungenomed bearer shares one frozen `NO_GENOME`, so a formation of five
  costs one resolution rather than five.
