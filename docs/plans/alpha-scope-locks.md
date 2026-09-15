---
id: alpha-scope-locks
title: Alpha shutters — systems, words, gods, and the world outside
kind: story
status: review
system: meta
parent: alpha-band-one
save: '48'
updated: 2026-09-06
invariants:
- completability
- no-terminal-states
done:
- Runecarving, Music, Genes, Psionics, Wuxin render nothing to a fresh save
- Saves from before v47 keep all five (migration stamps the flags)
- The world outside Threshold is shelved (was: shut outbound-only); old saves out there wake at the Foot
- Each latch is liftable by content with no code change
---

# What was built (2026-09-06, save v47)

**`src/core/systems/unlocks.ts`** — piecemeal subsystem unlocking, alpha
shape. Five systems the user named inaccessible for the alpha (2026-09-06):
Runecarving, Music, Genes, Psionics, Wuxin. Each is open when
`flag:unlock_<id>` ≥ 1 — an ordinary content-writable counter, so
`SpotFind.stat` can lift one today and a quest-reward stat kind can later.

- **UI shutters only, never engine gates**: skills, statuses and saved work
  behind a locked system keep functioning. Locking is about what a NEW player
  is invited into, never about confiscating state.
- Tabs (App.svelte): Chromosome / Music / Wuxin hidden while locked.
- Benches (LocationPanel): `runecarving` hidden; `mutagens` now needs the
  genes flag AND its own `gs.mutagens.unlocked`.
- Spelltable (SpellcraftPanel): the Psionic school tab hidden; the bench
  label reads "Arcane · Divine" while locked.
- **Migration v46→47** stamps all five flags = 1 on any older save — a save
  from before the shutters has seen them all, and hiding a tab that holds the
  player's own compositions would be a regression, not a lock.

**The world lock** (superseded 2026-09-12): the Hamlet Road out of the
Weighbridge carried `requires: [flag:world_open ≥ 1]`, directional by
construction (the registry mirror never carries `requires`). The user then
shelved the countryside outright — road, flag and all sit verbatim in
`src/core/data/shelved/` (LONGTERM.md §"The countryside"), and a fresh save
lives in Threshold + the Ascent with nothing to open. The same `requires`
shape now guards the hold's door at the Foot (`prestige:count ≥ 1`), with
the same outbound-only guarantee, verified in tests/towers.test.ts. Saves
standing in the countryside wake at the Foot (migration v48→49).

# Grown with the quest list (2026-09-06, save v48)

Two more shutters from the user's onboarding spec, same flag philosophy:

- **The starter lexicon** — `STARTER_LEXICON` (unlocks.ts): fire, ice, spark
  (= Lightning), pierce, ward, mend, quickly, slowly, one, me, others. Locked
  words are neither speakable (`checkSentence` refuses them as UNKNOWN,
  before any level talk) nor visible (the bench palette filters; an empty
  word-kind row vanishes — no conjunctions row at the start, so single-clause
  speech is the opening game). The reading stays pure: `composeArcane` never
  hears about it, monsters speak freely, the yShicna' seam is untouched.
  Latch: `flag:word:<id>`.
- **The known gods** — `STARTER_DEITIES` (unlocks.ts): denjalle, usvylgr.
  Unknown gods are absent from the divine tab (not silhouetted — that
  treatment belongs to deities-must-be-met when it lands) and `grantFavorAll`
  pays only known gods, which retires the "standing accrues with gods never
  heard of" smell for new saves. Latch: `met:deity:<id>` — the exact counter
  the future authored meetings will stamp.
- **Migration v47→48** stamps the full lexicon and pantheon onto older saves
  — same confiscation rule as v47.

# Review notes

- Lifting a latch is one authored find or (future) quest reward:
  `{ key: 'flag:unlock_music', set: 1 }`. Nothing else to build.
- DEV saves: the DebugPanel can already poke stats if you want a lever there;
  none was added.
- Fast travel ignores road locks between discovered waypoints — irrelevant to
  fresh saves (nothing outside is discovered), noted for the reopening.
