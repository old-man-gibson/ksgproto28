---
id: bands-2-3
title: Bands 2 and 3, the wilds and the city (floors 4-10)
kind: epic
status: draft
system: world
parent: ''
save: ''
updated: 2026-10-24
invariants:
  - completability
  - save-migration
  - no-terminal-states
  - two-validation-layers
done:
  - The prestige unlock is the floor 6 boss, and floor 0 is shut to prestiged runs
  - Floors 4-6 are playable at sketch fidelity, ending in the two-map goblin warren
  - Goblin firetongues cast fire, witch doctors pray to goblin gods, hobgoblins fight with techniques the player can learn by watching
  - One key boon opens band 3; expensive band passes open bands 1 and 2 on a new run
  - Band 3 is a castle hub with four any-order direction floors whose monsters level up with each direction cleared
  - Clearing all four directions sets the castle safe
  - John clears floors 1-6, prestiges, and clears floors 7-10
---

# Bands 2 and 3: the wilds and the city

Floors 0-3 are too short to judge progression: about 17 minutes of authored
first run, and run 2 is run 1 (SLICE_REVIEW.md §2). This card adds seven
floors so a run has a curve. It replaces FLOOR_STANDARD step 2 (deepening
floor 2) as the next floor work.

The alpha freeze rule (no new cards until band 1's done-list is true) is
lifted for this card by the user's direction of 2026-10-24.

## 1. The user's rulings (2026-10-24)

| # | Ruling |
|---|---|
| R1 | Prestige unlocks around floor 6, not floor 3 |
| R2 | Floors 7-10 require prestige boons. One key boon opens all four |
| R3 | Floor 0, the prison, is locked on prestiged runs and cannot normally be visited again |
| R4 | A boon can unlock whole bands on a new run; those boons are expensive |
| R5 | Band 2 (floors 4-6): a proper nature setting — forest, hills, swamp, cave and the like — ending in a two-map dungeon descent that clears the goblin encampment threatening the city of band 3 |
| R6 | Band 3 (floors 7-10): a new city (not Threshold). The castle is a hub "elevator floor" connecting south, west, north, east = floors 7, 8, 9, 10. Any order |
| R7 | The four directions start at one threat level. Each direction cleared raises the monster level of the ones left by +N, and N grows slightly faster than linear |
| R8 | All four cleared: the castle is safe and becomes a future hub node (how it integrates is undecided) |
| R9 | Reuse the shelved countryside content for band 2 and expand it |
| R10 | Tune for a player who uses two systems decently often. Most encounters are simple: plain conditions, few special features |
| R11 | Goblin firetongues are mages and cast fire. Hobgoblins use basic martial techniques, general ones and goblin-specific ones. Goblin witch doctors use miracles from one or two goblin deities (to be written) |
| R12 | A player with martial unlocked who has watched a hobgoblin use a technique enough times (25 or 50 views) learns it, as autodidact |

## 2. What the code has today

| Need | State on main (5e52077) |
|---|---|
| Prestige trigger | `PRESTIGE_UNLOCK` in prestige.data.ts reads `slain:f3_hearing_room:puppet_bureaucrat` |
| Prestiged start | `prestigeNow` stamps the tutorial done and starts at `TUTORIAL_EXIT` (`ascent_foot`). Floor 0 is skipped but its door is not shut |
| Floor order | `floorUnlocked` (systems/towers.ts) is strictly sequential: every floor with a lower index must be cleared. Band 3's any-order needs a change here and in `rungStatus` |
| Boons as keys | None. Boon effects are startGold, startLevel, ceilings, talent, endowment, foresight, wayfinding. The SLICE_REVIEW "Doors" step (boons that re-stamp `flag:unlock_*`) is unbuilt |
| Level scaling | `spawnMonster` (combat.ts) rolls a level from the encounter's `[min, max]`; `baseMonsterAttrs(def, level)` scales from it. An offset can be added at the roll |
| Monster casting | `MonsterAction = { cast: SpellSource } \| { technique }` — monsters already cast arcane sentences and miracles and use techniques, with `uses` per fight |
| Learning a technique | `learn.self = { stat, count }` crystallizes a ROUGH form from a stat counter once the technique is reachable; off while the martial shutter is shut (martial.ts `checkTechniqueLearning`) |
| Goblins | `goblin`, `goblin_boss`, `hobgoblin`, `hobgoblin_champion` defined. Hobgoblin stats are placeholders awaiting the user's numbers |
| Gods | Eight deities in deities.data.ts, none goblin |
| Shelf | data/shelved/: Malgeri cave system (21 spots), Malgeri mountains (12 + 3), Whispering Woods, Woods Edge, Deep Woods with an Old Camp, Hometown Forest and River, Cragfall ravine (rim, floor), Stillail hills, Western Swamp (2 placeholder spots + a peninsula). Encounters there use wolves, forest rats, many slime variants, a stone golem, goblins |

## 3. Shape

### Band 2, the Wilds (floors 4-6)

Proposed split; Q1 asks.

| Floor | Biomes | One idea (mechanism) | Boss / preparation | Shelf source |
|---|---|---|---|---|
| 4 | forest, hills, ravine | Goblin raiding parties roam the trails: hunts can roll a party (goblin + scout) instead of wildlife. Trail signs found by searching point to floor 5 | A raid leader at the ravine; clearing it is the floor clear | Woods Edge, Deep Woods, Whispering Woods, Cragfall, Stillail |
| 5 | swamp, caves | First firetongues and hobgoblins. The swamp has few safe spots; the caves are dark (`tags: ['dark']`, darkvision matters). Finding the warren's back entrance clears the floor | None; the clear is the entrance found | Western Swamp (expanded), Malgeri caves (trimmed to ~8 spots) |
| 6 | the warren, two maps | Map A, the outer warren: pens, kitchens, the shrine. Map B, the deep encampment. Sabotage on map A (douse the fire pits, foul the shrine, free the pens) each weaken the warchief, the floor 3 pattern | Goblin warchief (`goblin_boss` reworked) with a witch doctor and a firetongue. Its kill clears floor 6 and is `PRESTIGE_UNLOCK` | Old Camp as the seed; new |

Gate paid inside the band (FLOOR_IDEAS §1.3 finding 2): floor 5's gate reads
kills at floor 4's dens, floor 6's gate reads goblin kills on floors 4-5.
Both sources are endless spots.

Materials feed shipped systems: herbs (alchemy), game meat (cooking), hides
and ore from the hills and caves (smithing). Exact drops at build.

### Band 3, the City (floors 7-10)

| Piece | Shape |
|---|---|
| Entry | The band 3 gate is the key boon (R2) and band 2 cleared this run (Q4). The climb lands at the castle |
| The castle | The band's hub: a set of spots off the ladder (no `bandId`), with four doors. Each door is a direction floor's landing edge. It holds residents and a haven |
| Directions | South 7, West 8, North 9, East 10. All four open together once band 3 is open. Each direction floor is a city district that leads out into a thematic map beyond the walls (user, Q2): district first, the outside map past it, the floor's clear at the far end. Themes per direction: open |
| Scaling | Monster level on direction floors = rolled level + `DIRECTION_LEVEL_STEP[k]`, k = directions cleared. Default table `[0, 2, 5, 9]` (steps 2, 3, 4: slightly faster than linear). A data table, so it is one dial |
| Castle safe | A counter or flag set when all four floors are cleared; it reads as the band's clear. Nothing else hangs on it yet (R8) |

### The spine, floors 1-10 (user, 2026-10-25)

Band 1 measured against "interesting": few rewards change how the next floor
plays (Lunge, the oak club; the rest is gold and salves), few decisions (floor
2 is a corridor of set fights, the gates are waited out), and every retry is
the same climb. The rule for every new floor: **one new threat, one reward
that changes the next floor, one decision.**

| Floor | New threat | Reward that changes the next floor | Decision |
|---|---|---|---|
| 1-3 | as built | Lunge, the oak club | which strings to cut |
| 4 | roaming goblin raid parties, rolled | herbs open alchemy, game meat feeds cooking | which den to hunt for which material |
| 5 | firetongues (burning), hobgoblins (techniques), darkness | ore for the anvil; the first technique learned by watching | which system answers burning |
| 6 | the witch doctor heals its allies | prestige | which sabotages: each weakens a different part of the warchief's fight |
| 7-10 | each direction cleared levels up the rest | each direction's reward answers another direction's main threat | the order, which this makes a real choice |

### Reruns (user, 2026-10-25)

1. **Knowledge carries.** What the player learned about a floor's layout
   survives prestige: floor 1's remembered route, floor 3's stair plans
   (`flag:f3_stairs_*`). Re-climbing band 1 gets faster without being
   skipped. Band passes (M3) remain the way to skip.
2. **Variant bosses.** The bosses of floors 1, 3 and 6 roll one of two or
   three variants per run. The `boss:<spot>` latch already counts any variant
   as the kill.
3. **Rolled events.** Raid parties on band 2 are rolled, so two runs through
   floors 4-6 differ.

## 4. Machinery (each a separate build)

**M1. Prestige moves to floor 6.** `PRESTIGE_UNLOCK` reads the warchief kill.
The puppet bureaucrat still clears floor 3. A save that killed the bureaucrat
but never prestiged loses the tab until floor 6 (Q7). PRESTIGE.md updated.

**M2. Floor 0 shut to prestiged runs.** The floor 0 exit door gains
`requires: prestige:count = 0` on the inbound side. Completability: a
prestiged run starts at the Foot, so nothing is stranded behind the door.

**M3. Key and band boons.** A new unlock condition `{ type: 'boon', id }`
(rank ≥ 1). Band 3's gate reads the key boon. Band passes are boons whose
effect stamps a band's floors cleared at the start of a run (the same stamp
the floor clear writes, so rungs read `cleared`). Pass for band 1 and band 2,
priced above every current boon (Q5). The Doors step in SLICE_REVIEW can
ride the same effect kind later.

**M4. Any-order band.** `BandDef.order: 'sequence' | 'any'` (default
`sequence`). For an `any` band, `floorUnlocked` checks the floors of lower
bands only, plus the floor's own gate. `rungStatus` and the ladder UI show
the four as siblings. Climb price uses the band's lowest index. The no-skip
lint (floor-rules) needs the same exemption.

**M5. Direction scaling.** `DIRECTION_LEVEL_STEP` table in towers.data.ts,
read in `spawnMonster` for spots on an `any`-band floor, k = cleared floors in
that band. The bestiary shows the scaled range. Kill XP already falls off by
level gap (kill-xp-level-gap), so the last direction pays better per kill.

**M6. Learning by watching.** A counter `seen:technique:<id>` bumped when a
monster executes a technique in a fight the player is in. Techniques that can
be watched get `learn.watch = { count }`, 50 for every technique (user, Q3).
Rides `checkTechniqueLearning`: needs the martial
shutter open, needs the technique reachable (MARTIAL.md §6 "Reach"), counts
from when it became reachable, and lands as a ROUGH form. The bestiary entry
shows "seen N / 50" once martial is open.

**Built 2026-10-25 (branch `band2-goblins`): M6 and M7**, with these
differences from the text below: the firetongue speaks `quickly fire pierce`
and `fire pierce`; the gods are three (fire, mud, hunt) with two miracles
each — Cinder Curse, Kindling; Mud Poultice, Sucking Mire; Vermin Swarm,
Pack Scent; a monster's `others` working (heal, grants) lands on its own side,
and a working only for its side is skipped when nobody else stands. Nothing
is placed on a floor yet; band 1 pacing is unchanged.

**M7. Goblin casters and gods.**

- Firetongue: a goblin with a rotation of one or two arcane fire sentences
  from the starter lexicon (burning is the condition it brings).
- Witch doctor: a goblin with `{ cast: miracle }` from a goblin deity, `uses: 1`
  or `2` per fight (a heal on its allies, a curse on the player).
- Goblin deities in deities.data.ts (user, Q6). First: a god of **fire**, a
  god of **mud**, a god of **hunting** (rats, birds and worms). Later, lower
  priority: **thievery** and **witch magic**. Placeholder names and text, two
  miracles each. Witch doctors draw on them; the fire god also suits
  firetongue shrines. Not meetable by the player in this card.
- Hobgoblins: rotations of general techniques (the Lunge family) and two or
  three goblin-specific ones, authored in martial data as normal
  TechniqueDefs so M6 can teach them.

## 5. Tuning

Critical path tuned for John plus two systems used regularly (R10), not John
alone. The cover rule in COMPLETABILITY §6a still applies at a basic level:
the hurdles bands 2-3 add are burning (firetongues), ally healing (witch
doctors) and technique pressure (hobgoblins). Each must have an answer in at
least two of the systems open on a fresh save: e.g. burning answered by a
cooking dish or an alchemy draught or a miracle. A sketch-pass floor names its
hurdle's role in a comment; the role lint comes after.

John needs two changes: he must prestige at floor 6 and buy the key boon, and
he must use two systems. `npm run pacing` gets floors 4-10 as it got 1-3.

## 6. Build order

One builder at a time; each step merges before the next starts.

0. Merge the triage picks, floor-rules first (its floor lints check the new
   floors), then trial-merge (cooking is a consumer for band 2 meat).
1. M1 + M2. Small.
2. M7 monsters and M6 watching. Testable in the Cages before any floor exists.
3. Floors 4-6, sketch fidelity: spots, encounters, clears, gates, the warren's
   two maps, placeholder text (author-mechanism-first: the user captions).
4. M3 boons.
5. M4 + M5.
6. Band 3: the castle and four direction floors, sketch fidelity.
7. John through floor 10.

Done so far: 0 (PRs #15–#21; trial-merge still held), 2 (#22), and 1 + 3
below.

### Floors 4–6 as built (2026-10-25, branch `band2-floors`)

Band `ascent_middle`, renamed "The Wilds". Every hunt is endless; only the
three boss rooms have a `fightLimit` (1). Gates read `kills:tag:goblin`.

| Floor | Spots (landing first) | Gate | Clear |
|---|---|---|---|
| 4 Greenwood | treeline, woods edge, deep woods, barrow hills (wing joining the edge and the rim), ravine rim, raid camp | — | `slain:f4_ravine_floor:goblin_raid_leader` (new veteran, L9, two goblins) |
| 5 Mire | causeway, bog, drowned village (wing joining the bog and the cave mouth), cave mouth, the Hollows (dark), back door | 12 goblins | `slain:f5_back_door:hobgoblin_champion` (now elite, L8, one hobgoblin) |
| 6 Warren | mouth, tunnels, pens, kitchens, shrine; down the drop (dark, a haven): the great hall | 40 goblins | `slain:f6_great_hall:goblin_warchief` (new elite, two escorts, L11 down to L8 by sabotage) |

- **M1:** `PRESTIGE_UNLOCK` is the warchief's kill. The harvest's floors source
  now pays 6 points for a first run instead of 3.
- **M2 needed no code:** floor 0's road out is one-way and it is off the
  ladder, so a run that starts at the Foot cannot reach it. `tests/band2.test.ts`
  asserts it.
- **Materials:** herbs and berries (floor 4 foraging, the bog), game meat
  (wildlife drops, the pens), copper ore (the barrows, the Hollows), iron scrap.
- **John** climbs through floor 6 with `through: 6` (`tests/john.ts`), walking
  each new floor in order because floors start fogged. Measured on four climbs
  after tuning: floor 6 cleared 19–28 minutes into the run; most bosses
  beaten first try; the weak case is a plain hammer against the unsabotaged
  warchief (13 losses). The first draft (legendary bosses at L13 and L18 with
  full squads) took 29–171 losses against the champion and 45–184 against
  the warchief.
- **Not built yet from the spine:** the sabotages only take levels off; each
  weakening a different part of the fight is open. Variant bosses, rolled
  raid parties as their own encounter, and knowledge carrying across prestige
  are open. There is no forest scene: floor 4's banner falls back to the town.
- **Tuning note (user, 2026-10-25):** smithing XP is too fast (one iron
  nodachi is about seven Smithing levels), and the Growth panel can show skill
  XP ×2.5 on a modest save. Tuning later, not part of this card.

## 7. Questions

### Answered (user, 2026-10-24)

| # | Question | Answer |
|---|---|---|
| Q1 | Biome split across floors 4-6 | As proposed: 4 = forest, hills, ravine; 5 = swamp, caves; 6 = the warren, two maps |
| Q2 | What is in each direction of the city | Districts that lead into further thematic maps outside the city |
| Q3 | Watch counts | 50 for every technique |
| Q4 | Does band 3 need band 2 cleared in the same run | Yes, unless the band 2 pass is owned |
| Q5 | Band pass prices | "Expensive enough." Set at build against the floor 6 harvest: the band 1 pass above every current boon, the band 2 pass well above that |
| Q6 | Goblin deities | Fire, mud, hunting (rats, birds, worms) first; thievery and witch magic later |
| Q7 | Bureaucrat killed, never prestiged: tab gone until floor 6 | Accepted |
| Q8 | Direction level steps | `[0, 2, 5, 9]` |

### Open

| # | Question | Default |
|---|---|---|
| Q9 | Theme of each direction's district and the map beyond it | Placeholders at sketch fidelity; the user captions them |
| Q10 | What threatens the city once the goblins are gone | Each district has its own problem; no band-wide villain |
