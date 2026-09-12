---
id: alpha-band-one-floors
title: Three floors on band 1
kind: story
status: review
system: meta
parent: alpha-band-one
save: ''
updated: 2026-09-06
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
| 2 · The Flooded Stair | `gold:earned` ≥ 150 | spend the cistern's **fightLimit: 8** | water slimes 4–8; the cistern is **forced** (first real consumer) |
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
