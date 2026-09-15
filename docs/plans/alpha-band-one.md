---
id: alpha-band-one
title: Alpha — a stranger clears band 1
kind: epic
status: review
parent: ''
system: meta
save: ''
updated: 2026-09-06
invariants:
- completability
- no-terminal-states
- two-validation-layers
- ast-surgical
done:
- A fresh save can go from ascent_foot through band 1 (all three floors, sequentially) with no author in the room
- Threshold quest chains (the user's list) are authored; the goldfish closes one on seed 42
- All prose placeholders (floors, warden) recaptioned by the user; numbers tuned
- npm run verify green, and no new card entered docs/plans/ while this one was open
---

# What "alpha" means here

**A stranger starts at `ascent_foot` and plays through band 1 of the Ascent
without the author in the room.** COMPLETABILITY's floor build given a finish
line; the tower is the delivery vehicle. The alpha adds no new system — it
spends the ones already shipped.

**The freeze rule**: nothing new enters `docs/plans/` until the done-list is
true. Closing by subtraction, same as the arcane push. (LONGTERM.md stays
open as the shelf.)

# The three answers (user, 2026-09-06) — now the rules

1. **Clearing is finishing the floor's quest/conditions.** `FloorDef.clear:
   UnlockCondition[]` — extermination (`slain:*` / `fights:*` counters),
   bespoke ( `{ type: 'quest' }` ), or a plain threshold, all derived from
   counters that already persist. No save state.
2. **No fixed stairs; sequential ascent.** `climbTo` moves freely between the
   hub and any unlocked floor; you always may go down, and may not pass a
   rung until it is cleared. Fixed transition spots are reserved for future
   hidden/special floors (bandless, off the critical path by construction).
   **Consequence, flagged for veto:** `clearsToAdvance` is now unread; the
   band-disjunction rule it encoded is retired, and its completability duty
   moved onto each floor's clear ("no rung names a discipline", linted both
   layers).
3. **Scope**: most systems accessible; Runecarving, Music, Genes, Psionics,
   Wuxin shuttered; the world outside Threshold shut (outbound-only lock on
   the Hamlet Road). Tower climb first; the district quest list is the
   user's and comes later. **Revised 2026-09-12:** the countryside is
   SHELVED outright (LONGTERM.md §"The countryside", `src/core/data/shelved/`)
   and the hold left the tower for its own map behind the first prestige
   (`prestige:count`, a counter nothing writes until prestige is built).

# Stories

| Card | Status | What |
|---|---|---|
| [alpha-tower-runtime](alpha-tower-runtime.md) | review | `systems/towers.ts`, `Connection.requires`, ladder UI, lints ×2, unit tests |
| [alpha-band-one-floors](alpha-band-one-floors.md) | review | Three floors, three clear flavors, first `forced` + `once` + `fightLimit` consumers |
| [alpha-scope-locks](alpha-scope-locks.md) | review | `systems/unlocks.ts` flags, save v47 migration, tab/bench/school shutters, world lock |
| [alpha-threshold-quests](alpha-threshold-quests.md) | review | The user's first quest list BUILT (save v48): meet the nine, try the systems; talk/stat objectives, the Cages, starter lexicon + known gods |

Built 2026-09-06, `npm run verify` green (1628 tests), walked live in the
dev-test preview twice: the tower loop (fresh save → climb → floor-1 hunt →
knockout → haven) and the onboarding loop (greet the Warden → accept →
greet the docent → spelltable shows eleven words and two gods). The goldfish
closes the Warden's chain on seed 42 without the Hamlet Road.

# Out of alpha (filed, not forgotten)

Cleared-floors-as-idle-nodes; music effects; mutagen unlock quest; weather as
a mod source; deities-must-be-met; every parked seed in NEXT.md. Each has a
card or a NEXT.md section already.
