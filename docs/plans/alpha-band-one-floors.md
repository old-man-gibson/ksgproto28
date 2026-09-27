---
id: alpha-band-one-floors
title: Three floors on band 1
kind: story
status: review
system: meta
parent: alpha-band-one
save: ''
updated: 2026-09-27
invariants:
- completability
- no-terminal-states
done:
- Band 1 holds three floors, each with a landing, a clear, and its own area
- All three clearing flavors are demonstrated on shipped counters
- A fresh save can climb floor 1 immediately; floors 2–3 gate on pure accumulation
- Encounter levels and gate numbers reviewed and tuned by the user
- Names and descs recaptioned by the user (all placeholders)
---

# What was authored (2026-09-06)

Three areas × three spots on one pattern — landing / working spot / den — in
`locations.data.ts`, with floors in `towers.data.ts`. **Every name and desc is
placeholder prose**; ids rename cleanly in the forge.

| Floor | Gate | Clear | Teeth |
|---|---|---|---|
| 1 · The Old Toll Level | none | **`boss:f1_toll_hall`** — the clock-keeper or the ambush, whichever pays it (REVISED by quest 3, see [alpha-threshold-quests](alpha-threshold-quests.md); slime_coin stays as a `once` treasure spawn) | rats/basic slimes 1–4, goblins 2–5; keepers 6–7; ambush 11–12; the hidden Bonded Deep 8–11 |
| 2 · ~~The Flooded Stair~~ **The Wildwood** (REVISED 2026-09-26, below) | `gold:earned` ≥ 150 | ~~spend the cistern's fightLimit: 8~~ the four nests spent **and** the Grand Elevator woken | forest roamers 3–8; four nests; the goblin king (8) |
| 3 · The Silk Gallery | `gold:earned` ≥ 600 | slay the `once` **giant_spider_queen** (lv 12) in the brood den | spiders 7–11 |

- The three clears demonstrate the three flavors from the parent card: named
  kill (`slain:*`), fight budget (`fights:*`), and — once quests exist — a
  `{ type: 'quest' }` clear works with zero new machinery.
- The cistern doubles as content and mechanism: at its limit it is CLEARED,
  stops forcing, and the floor above opens — "the flooded stair goes quiet".
- Explore finds on each floor pay gold and herbs; the storerooms are the
  fresh character's on-ramp (level 1–3), the toll hall the boss room —
  verified live: a naked level-1 who walks straight into the hall is knocked
  out and thrown back to the haven at the foot, exactly as intended.

# Review notes (the numbers are yours)

- Gates 150 / 600 gold assume Threshold job income (11–14 gold/shift) plus
  floor loot. Roughly a dozen shifts to floor 2.
- fightLimit 8 = clear bar 8, linted to agree — retune both together.
- The queen at level 12 may want escort spiders tuned once someone actually
  fights her with a band-1 build.
- Floor spots share the_ascent's region map with the hold (corners chosen to
  avoid overlap). Fine at three floors; a map view per floor is a later
  problem.

# REVISED 2026-09-26: floor 2 is the Wildwood

The user's brief: floor 2 is a forest of low-level creatures, and the first
floor with a **prestige** behind it. Its quest is to find and activate the
**Grand Elevator** — "not a literal elevator but a symbolic entity" that
carries a player to floors 3 and up — by raiding four monster nests, each a
different question. The Flooded Stair (sluice + forced cistern) is gone; save
v54 prunes anyone standing in it back to the Foot (`pruneToRegistry`, the v48
rule, now shared).

## The floor

| Spot | What it is |
|---|---|
| Treeline Camp (landing) | haven; **Oda Thornfell, Pathwarden** (placeholder) gives *The Grand Elevator* |
| Wildwood Edge | hunt rats, young wolves, goblins, boars (3–6); explore; roads to the Warren, the Runs, the deep wood |
| Deep Wildwood | hunt (5–8, goblin archers join); **combing it finds** the crypt's stair at 35% and the Elevator's path at 80% (`flag:elevator_found`); road to the Hive |
| **Goblin Warren** | `fightLimit: 7`; five fixed warband formations; fight 7 is always the **Goblin King** |
| **Sunken Crypt** | `fightLimit: 6`, dark; skeletons (weak to blunt) and haunts (weak to light/arcane/heat, half off physical) |
| **Wolf Runs** | `fightLimit: 6`; packs of 3–5 only; **pack tactics** |
| **Hive Mound** | `fightLimit: 5`, **`streak`**: armoured ants, won in one unbroken push |
| **Grand Elevator** (hidden glade) | *Wake the Grand Elevator*: an explore-kind activity (30 s) gated at 10% on all four nests; its last find writes `flag:grand_elevator` |

**Clear** = the four `fights:` counters **and** `flag:grand_elevator`, all
counters a win or a search writes. The quest is the guide and the purse, never
the gate: every objective reads live, and the floor clears whether or not it
was accepted (COMPLETABILITY §6 — a quest clear strains the non-reader).
`PRESTIGE_UNLOCK` **is** `FLOORS.ascent_f2.clear` (the same array), so the
first prestige opens exactly when the floor does. The Warden's chain gained
*Into the Wildwood* (meet the Pathwarden) so the hand-off is told, not found.

## Four mechanisms, one per nest (all linted, both layers)

- **`SpotEncounter.party`** — a fixed formation beside the rolled body, at its
  level. The Warren's archers and shamans stand behind spears and shields
  where only the front slot can be hit: kill order, and anything that
  reaches past the front, matter.
- **`SpotEncounter.finale`** — rolls on the last budgeted fight and only then.
  Lints: needs a `fightLimit`, an ordinary line before it, and one finale
  nothing can gate away.
- **`MonsterDef.pack`** — `perMate` damage per living packmate, `flanks` (no
  back-row penalty). Derives the `pack` trait tag. Measured: at attribute 6
  the Runs are won 25% of the time with pack tactics and 80% without.
- **`SpotDef.streak`** — the budget resets to 0 whenever the player stops
  pushing (read once a tick from where the player is, so no exit path can
  forget it); waves come a third sooner. A cleared spot stays cleared; a
  streak spot may not offer a rest.

## Balance probe (the numbers are yours)

The longsword floor build — iron sword, Outfitter leather, iron gauntlets, no
actives, no food, no potions — at a given level for every attribute (INT/WIS
half, CHA 0.6), 20–40 seeded fights per cell, healed between fights except
the Hive, which is run as the whole five-fight push:

| Attr | Warren | **King** | Crypt | Runs | **Hive push** | (floor 1 keeper) |
|---|---|---|---|---|---|---|
| 6 | 75% | 0% | 50% | 25% | 10% | 100% |
| 8 | 80% | 0% | 90% | 63% | 30% | 100% |
| 10 | 90% | 13% | 90% | 82% | 60% | 100% |
| 12 | 100% | 53% | 95% | 95% | 50% | 100% |
| 14 | 100% | 90% | 95% | 95% | 85% | 100% |

So: a player fresh off floor 1 (~6) can hunt the wood and chip at the Warren;
the Crypt and the Runs want ~8–10; the King and the Hive are the floor's wall
at ~12–14. `tests/wildwood.test.ts` walks John through the whole floor at 16
— every nest to its end, the King down, the Elevator woken — as the standing
proof the road exists. Real builds (actives, stances, food, a club for the
bones, a spell for the haunts, anything that splashes for the packs) go
faster; that is the point of the nests.

## Review notes

- Every name and line is placeholder prose (the Pathwarden, the nest names,
  the Elevator's text).
- Floor 3 was NOT retuned. Its spiders (7–11) and queen (12) now sit at or
  below floor 2's top end, and the queen was already harsh: 45–50% at
  attribute 10–14 on the same probe, because her 85% heavy poison ignores
  armour. Worth a pass now that it is post-prestige content.
- Party members share the leader's level; a level offset per member would
  let the King bring a lower-level guard. Not needed yet.
- The Elevator is an `explore` activity wearing a costume — its bar says
  "Exploration" and its log says "fully explored". A dedicated activity kind
  would read better; it would also be the first new kind since crafting.
