---
id: alpha-band-one-floors
title: Three floors on band 1
kind: story
status: review
system: meta
parent: alpha-band-one
save: ''
updated: 2026-10-17
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
| 2 · The Flooded Stair | `gold:earned` ≥ 150 | spend the cistern's **fightLimit: 8** | water slimes 4–6, slimers 5–7, pairs at most; the cistern is **forced** (first real consumer); the sluice hands over a club, and its wheel drains the cistern (two levels down, a surprised back door) |
| 3 · The Silk Gallery | `gold:earned` ≥ 600 | slay the `once` **giant_spider_queen** (lv 9, solitary) in the brood den | the gallery's brood (spiders 4–7, **fightLimit: 4**) opens the den road; den spiders 6–8; three burned egg sacs bring the queen out; the gallery hands over a spear |

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
- ~~The queen at level 12 may want escort spiders tuned once someone actually
  fights her with a band-1 build.~~ Someone did — see below.
- Floor spots share the_ascent's region map with the hold (corners chosen to
  avoid overlap). Fine at three floors; a map view per floor is a later
  problem.

# Tuned against John (2026-10-10)

`tests/john.ts` is COMPLETABILITY §8's John, built for band 1: Skip tutorial
(rusty sword, Neutral, no spell) walking the floors by the obvious road, plus
the same walk for every rack pick. `npm run pacing` prints the table;
`tests/john.test.ts` holds the bounds. **The numbers are still yours** — the
bounds say what shape the band should have, not that these values are final.

| | Before | After |
|---|---|---|
| Band 1, every build | 25 min – 2 h | 13–19 min (John ~16) |
| Floor-3 knockouts | 14–110 | 3–9 |
| Gold earned at the top | 6k–90k | ~0.8–1.4k |
| Toll collector, first attempt | 10–22 s, never lost | 20–35 s, lost ~1 in 4 |
| Vermin hall, first fights | a rusty sword or dagger lost ~1 run in 3 | rack picks ~1 in 40; John (no tutorial XP) can still go down once |

What changed, and why:

- **Floor 1.** Rats only for the hall's first four wins, slimes level 1 after.
  The collector went STR 4 / CON 10 / armour 4 → 6 / 16 / 8, so its spell
  reactions finally matter (FLOODED_FLOOR.md has the per-spell numbers).
- **Floor 2.** Cistern levels down one at the top, pairs at most
  (`groupWeights`), and the slimes pay a little coin so the floor contributes
  to the next gate. The sluice's explore track now holds an **oak club** at
  20%, ahead of the purse: the cistern's answer, found by looking around first.
- **Floor 3.** The gallery is now the brood: a `fightLimit: 6` whose spending
  reveals the road to the den (`requires` + `revealWhen`, the Records Passage
  shape). Den groups are pairs at most. The queen: legendary → elite, level
  12 → 9, `group: { max: 1 }` (she was being drafted as her own escort — four
  queens in one fight), attributes reshaped toward slow and durable, slashing
  resistance 0.67 → 0.4, piercing −0.67 → −0.5, and venom 50 → 3. Anything at
  or over poison's escalation cap (4) turns septic on the second bite, and the
  rot finished most winners on the floor after she died. The gallery's explore
  track holds an **old spear** at 25%. Spiders' kill gold 6–14 → 1–3 (kill
  gold scales by level × tier).

Duels from equal footing (20 each, `john.test.ts`): water slime at 6 — sword
11, club 20; slimer at 6 — sword 0, club 10; queen at 12 — sword 1, spear 20;
queen at 16 — sword 17. In the real climb John's sword carries floor 1's
Swordsmanship and roughly breaks even with the club in the cistern: switching
to the floor's answer or staying with the trained weapon is a real choice.

~~Still open: the gallery is now the steepest step (3–6 knockouts for every
build, arriving from floor 2)~~ — see below. Still open: floor-3 spots sit in
one corner of the shared Ascent map and the den's node lands under the
landing's label.

# Floors 2 and 3 get a second verb (2026-10-17, no save change)

Floor 1 is fight → search → read → route → boss; floors 2 and 3 were "fight
until the counter fills". The user picked three changes from a list. All are
data on existing machinery; the flags reset with the run like every counter.

- **Drain the cistern (floor 2).** The Sluice Gallery gains *Turn the Sluice
  Wheel*, a search whose fourth result requires the first three, so it always
  takes exactly four turns. It sets `flag:f2_cistern_drained`, which (a)
  swaps the cistern's table to the same slimes two levels down (encounter
  `requires` / `statMax` — the first consumer of encounter requires), and
  (b) reveals *Down the Dry Channel*, a one-way road from the sluice into the
  cistern whose `approach` lays `surprised` on the first slimes (the first
  consumer of approaches). The front door stays forced; draining makes the
  gauntlet easier, it does not remove it.
- **Burn the egg sacs (floor 3).** The queen is drawn out, not rolled. The
  den gains *Burn the Egg Sacs*, three chained search results bumping
  `flag:f3_sacs_burned`; at three, the den's table is the queen alone (she
  used to be a 30% line beside the spiders). Before that it is the brood,
  after her death the brood again, so the den stays a hunting spot.
- **Softer gallery.** Spider levels one down (gallery 4–6 / 5–7, den 6–8),
  cave spider STR 8 → 6, and the brood's budget 6 → 4 (the den road's
  `requires` / `revealWhen` move with it). Measured with a knockout tracer:
  most falls were on the 2nd or 3rd fight in a row — a won spider fight costs
  about half a climber's health and the hunt rolls the next straight away —
  so the fight count was the lever; levels, strength, poison chance and
  dexterity each moved the count only a few knockouts. Poison chance and DEX
  were tried and left as they were.

| | 2026-10-10 | 2026-10-17 |
|---|---|---|
| Gallery knockouts, 18 climbs | 79 (3–6 each) | 41 (1–4 each) |
| Den knockouts, 18 climbs | 29 | 14 |
| Floor-2 knockouts, plain / attentive | 37 / — | 37 / 19 (drained) |
| Band 1, every build | 13–19 min | 13–18 min |

A trade-off worth knowing: the attentive John who drains the cistern meets
floor 3 a little weaker (stranded slimes pay less XP and coin), 48 gallery
knockouts against the plain climb's 41. Draining is easier now and costs a
little later, which is a choice, not a free win.
