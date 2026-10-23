# The floor standard: what every floor holds

*Proposal, 2026-10-23, not built. Piloted on floor 2 (the Long Hall). Written
by the team loop (.claude/TEAM.md): three brainstorms, one design attack, the
rulings in §6. All names and prose are placeholders for you to recaption.*

Your direction, verbatim: "if a floor doesn't have enough areas to go around, a
3-4 spot floor is easily finished. there needs to be something to do per
floor, including actions, activities, npcs, unlockables and also secrets that
need to be discoverable (such as hidden floors, new instructor type NPCs,
unique items etc.), even if the conditions for doing so are byzantine.
expanding how long it takes for a floor to be conquered can be fun if the time
taken is meaningful and interesting in some fashion"

Where floors stand:

- Floor 1: 15 rooms, 7 of them empty decoy offices. Floor 2: 8 rooms, a
  corridor. Floor 3: 7 rooms, a stairwell.
- John clears each in about 3 minutes; band 1 in 10.7–18.5 (mean 13.9).
- Walking is not the cost. Landing to the far end of floor 2 is 11.5 s. The
  cost is clicks plus pins that do not say what is left in a room.

---

## 1. The rule in one line

**The clear stays short; conquest is long.** The critical path (the clear)
keeps its ~3 minutes and John's bounds. Everything added is optional,
optional is computed by a lint (§2.4), and a floor's full conquest takes
25–35 minutes of play that each open something.

## 2. Five layers per floor

### 2.1 Spine

The rooms, edges, fight limits, gate and `clear` a floor has today. Not
touched. `tests/john.test.ts` bounds hold.

### 2.2 Wings

Rooms off the spine behind one of five door kinds. All five use existing
fields:

| Door | Field | Opens when |
|---|---|---|
| Key | `requires: flag:key_item:<id>` | the key item is held |
| Lever | `revealWhen` + `requires` on a flag | a find in another room sets the flag |
| Skill | `requires: attr` or `skill` | the attribute or skill level is reached |
| Hidden | `Connection.hidden` | the source room is explored to 100% |
| Far side | `oneWay`, revealed by a flag | the wing's last find fires |

Rules, each linted in both validation layers:

- **No skips.** A wing never brings a player nearer the clear spot than the
  room it leaves. The lint runs over mirrored adjacency, because the registry
  mirrors every edge without its `requires` (src/core/registry.ts:127–129). A wing
  whose far end touches the spine near the landing exits by a `oneWay` edge.
- **Wings loop.** A wing's far end has a return edge toward the landing, so a
  wing costs one trip.
- **Three hops.** Every room is within 3 hops of the landing or of a shortcut
  end.
- **The clear spot keeps one plain line.** At least one encounter line with no
  `requires`, `statMax`, `daypart` or `window`, so no gauge can empty the
  table the clear counts on (generalizes the windowless-boss rule).

### 2.3 Floor work (chores)

Finite labour native to the floor's theme, as `search` activities.

- Each cycle draws from a weighted table, mostly gauge progress
  (`stat flag:<floor>_<gauge>`), sometimes coin or a material, and a few
  limited documents. **The documents carry the floor's clues** (§2.4), so
  working a chore is how a player reads the floor.
- Each gauge has a cap (`limit`). A spent chore refuses to start
  (`canStartActivity`), so resume-on-return does not restart it.
- Gauge thresholds are read by existing levers: room doors, shop lines,
  teacher lessons, quest requirements and `stat` objectives, encounter
  lines.
- Three gauges per floor with different unlocks, so the order is a choice:
  shields first, the resident's chain first, or the easier far end first.

### 2.4 Secrets

Optional by construction; byzantine allowed. A secret is an AND of facts
that are each clued separately.

Engine (about 60 lines plus the lint):

- **Three condition kinds**, pure reads of state:
  ```ts
  | { type: 'clock'; daypart?: Daypart[]; hours?: [number, number] } // hours wrap midnight
  | { type: 'title'; id: string; worn?: boolean }
  | { type: 'place'; spot: string; explored?: number }
  ```
- **One table of dayparts.** `daypartOf(hour)` in clock.ts is read by the
  Chronosense chip, by encounter spawning and by `clock`. Today the chip and
  combat disagree about when night starts (chip: Night 20–23, Deep night
  0–4; combat: darkness ≥ 0.5, 19–05). `SpotEncounter.daypart` becomes a
  `clock` condition.
- **Secret doors.** `Connection.secret?: string`. A secret door's terms sit
  in `revealWhen`, never `requires`: a `requires` door is drawn on the map
  with its terms (NAVIGATION.md §3), which would print the clues as a badge.
- **Hidden floors.** A bandless FloorDef (no `bandId`, `gate`, `clear` or
  `clearXp`) with `annexOf: <parent floor>`, 3–5 rooms, one haven, its own
  map tab. The banded-area-closed lint exempts a `secret` edge into it.
  Mirrors carry no conditions, so a player can always walk back out.
- **Clue rule.** Every secret has at least 2 clues in different channels:
  a chore document, a key-item description, an NPC line, an earned title's
  description, a bestiary fact, one sentence in a room description. A clue
  states a cause in plain words and never names the payoff or a count. At
  least one clue is readable before any choice that forecloses the secret
  for the run.
- **The secret set is derived, not declared.** Delete every `secret` edge and
  every edge whose conditions hold a `clock`, `title` or `place` kind. The
  rooms no longer reachable from the landing are the secret set, and
  everything in them (finds, searches, fights, NPCs, quest rewards, stamps)
  is a secret producer. The lint: with all producers deleted, every floor
  clear and `PRESTIGE_UNLOCK` is still reachable and every room still gets
  home. `stat.set` counts as a write. Secret condition kinds are banned in
  `gate`, `clear`, `PRESTIGE_UNLOCK` and quest requirements.

### 2.5 Survey

A computed record of what is left on a floor.

- **Marks:** seen (discovered), explored (100%), spent (fight limit reached),
  slain (each `once` line), met (each resident), reward (each limited search
  reward).
- **Only discovered, non-secret rooms count.** The total never grows from a
  room the player has not entered, so it never leaks a secret.
- **Shown:** the ladder row reads "Clear" and "Survey 11/15". A pin shows its
  marks left as a number; spent pins dim; the nearest pin with marks left
  gets a ring, and its map card offers Go & start (the map stays the only
  travel control; no Go link outside town without Wayfinding).
- **Pays:** a harvest source with a fixed rate (e.g. 15 marks per point), so
  discovering more never lowers points.

## 3. The pilot: floor 2, the Long Hall

8 rooms become about 15, plus a hidden floor of 5.

| Room | Door | What is there |
|---|---|---|
| Stairhead, Mail Carts, Filing Bays, Copy Room Row, Far End | spine | as today |
| Cleared Office | spine | Brannoc: Gather, Lunge, and **Heavy Blow** at `flag:f2_jams ≥ 20` (enters from coiled; reach rule holds) |
| Quartermaster's Cage | spine | Quartermaster Pell's rack gains warden_buckler at `flag:f2_filed ≥ 20`, tower_shield at 30. New search "Key Board": the pantry key (limit 1, guaranteed by the 3rd cycle) |
| Break Room | spine | as today; its explore stays unconditional (John explores it until every find is claimed, tests/john.ts:269) |
| Dead Letters Office | lever: `flag:f2_sorted ≥ 10`, off Mail Carts | **Orsolya Vane**, a resident with three quests reading the gauges; the third, "The Hall Restored", pays level XP and a title |
| Pantry | key, off the Stairhead | a mimic cabinet: one fight, its back-slot item paid by a find on the win (not a drop chance); a lever find setting `flag:f2_ladder` |
| Mezzanine | lever: `flag:f2_ladder`, off Filing Bays | a search room; **Night Clerk Vesper**, an instructor |
| Catwalk | skill: STR ≥ 7, off Copy Room Row | exits by a `oneWay` edge to the Stairhead (no skip of the first two stretches) |
| Boiler Room → Pump Closet | hidden: Break Room explored to 100% | the Pump Closet's last find opens a `oneWay` Service Stair to the Stairhead |
| **The Records Cellar** (hidden floor, 5 rooms) | secret, from the Boiler Room: `revealWhen` clock Night or Deep night + key item envelope | Cellar Landing (haven), Cold Store (search: one unique item from the unsourced list), Sump (two fights, monster definitions not used anywhere yet), Lamp Room, Night Desk |

Chores:

| Chore | Room | Cap | Time | Table |
|---|---|---|---|---|
| Sort the Mail | Mail Carts | 30 | ~5 min | sorted +1 (most), coin, one document per run: the envelope ("Deliver to the cellar") |
| Refile the Drawers | Filing Bays | 30 | ~5 min | filed +1 (most), iron scrap, one document: a page naming the Boiler Room |
| Clear the Jams | Copy Room Row | 20 | ~4 min | jams +1 (most), coin; at `jams ≥ 10` the Far End's table drops one level |

Secrets on floor 2:

| Secret | Conditions | Clues |
|---|---|---|
| The Records Cellar | night (Night or Deep night) + the envelope | the envelope's text; a Vesper line ("The cellar stair is unlocked at night.") |
| Vesper teaches Sidestep | `place`: stood in the Records Cellar | a Vesper line; a Night Desk ledger find |
| After hours | Quartermaster Pell sells one unsourced offhand item while the title Procedural Objection is worn and it is night | a floor 1 reception find, read before the collector fight ("The quartermaster above serves those who settled the toll without spells."); the title's description; a Pell line |

Time:

| Stretch | Minutes |
|---|---|
| Clear (John) | +0 |
| Chores | ~14 |
| Wings | ~5 |
| Records Cellar | ~8 |
| Quests and walking | ~3 |
| Conquest, a player who knows the order | ~30 |

## 4. Build order

One builder at a time, each attacked by `antagonist-code` before it lands.

1. **Rules.** The wing lints over mirrored adjacency (no skip, loop, three
   hops), the clear-spot-plain-line lint, every explore has a find (gives the
   Chalk Yard and Undercrofts one find each, as SLICE_REVIEW A3 planned), a
   spent search refuses to start. No content.
2. **Floor 2 wings, chores and residents.** Everything in §3 except the
   secrets. Existing machinery only. Rerun `npm run pacing`.
3. **Secrets engine, then floor 2's secrets.** `daypartOf`; the three
   condition kinds; `Connection.secret`; `annexOf` and the map tab name; the
   derived secret set and the closure lint. Then the Records Cellar, after
   hours, and Vesper's Sidestep.
4. **Survey.** Marks, the ladder row, pin numbers and rings, Go & start on
   the pin card, the harvest source. After step 3, so the secret set exists
   before anything counts rooms.
5. **Later, save v58.** A legacy record of found secrets: on later runs a
   found secret's door shows as a normal shut road with its terms.
6. **Floors 1 and 3**, then band 2 built to the standard from the start.
   Floor 1's seven empty offices get contents.

Relation to [SLICE_REVIEW.md](SLICE_REVIEW.md): its step 1 A2 (mimic
cabinets) and A3 (sources and explore lints) fold into this standard. A1
(floor 2–3 monster rules) fits into step 2 of this plan. Doors and work
ladders stay separate.

## 5. Fit with the floor ideas bank

The bank (docs/FLOOR_IDEAS.md, branch `docs/floor-ideas`) sets the target
for bands 2 and up from your answers of 2026-10-22: 2–4 hours hands-on per
band, where hands-on is discovery, reading, picking spots, planning and
crafting, and idle time does not count. For a three-floor band that is 40–80
minutes per floor in three layers: critical path, optional depth, and a loop
that stays after the clear.

| Bank layer | This standard | Floor 2 pilot |
|---|---|---|
| Critical path | spine | ~3 min (John), unchanged |
| Optional depth | wings, secrets, survey | ~16 min hands-on: wings 5, Records Cellar 8, quests and walking 3, plus clue reading |
| Chores | floor work | ~14 min, but mostly left running, so by your definition idle, not hands-on |
| The loop that stays | **missing** | every hunt is empty after the clear |

So the pilot reaches about 20 hands-on minutes, not 40–80. The gap is the
bank's third layer. It needs the held idle-combat decision
([SLICE_REVIEW.md](SLICE_REVIEW.md) §8 Q3: cleared hunts that refill, or
cleared floors as assignable idle nodes), plus the bank's finding that a
floor's next gate should read a counter the band's own loop produces. This
standard leaves a slot for it and does not decide it.

## 5a. Not in this plan

- Tile-painted floors. Floor maps stay node graphs; a hand-painted skin in
  Tiles mode is optional and never carries information (a fresh checkout
  has no art and draws nodes).
- A general "do X then Y" sequence engine. Floor 1's route stays bespoke.
  Build one only when a second ordered puzzle is wanted.
- Residents who move (`NpcDef.lodging`). No pilot secret needs it yet.
- A same-floor teleport to the landing. It would cost 4.5 s against 11.5 s of
  walking and make the wing-loop rule moot.
- Resetting a stretch's fight counter from a chore. The corridor's roads and
  the floor's clear read those counters live; a reset would close a road
  behind the player.

## 6. The attack and the rulings

`antagonist-design` read the draft plan only. Verdict: fix first. No reachable
terminal state.

| # | Objection | Ruling |
|---|---|---|
| 1 | The closure lint deleted producers by their own conditions: a plain find inside a night-only room survived; and "no producer writes into the critical set" failed the pilot itself (`gold:earned`) | Accepted. The secret set is derived by reachability; everything in it is a producer; the write clause is dropped (§2.4) |
| 2 | The Catwalk's mirrored edges let a player skip six of twelve fights; a lint over authored edges would not see it | Accepted. `oneWay` exit; the lint runs over mirrored adjacency (§2.2) |
| 3 | A `requires` door is drawn on the map with its terms, so the cellar's clues print as a badge | Accepted. Secret doors use `revealWhen` only (§2.4) |
| 4 | Survey points fell when a player discovered more (rate = total / 3) | Accepted. Fixed rate; only discovered rooms count (§2.5) |
| 5 | Three definitions of night (chip, combat, the plan) | Accepted. One `daypartOf`; `SpotEncounter.daypart` becomes a `clock` condition (§2.4) |
| 6 | 30 fixed cycles of one guaranteed reward is a timer, not meaningful time | Accepted in part. Chores draw from weighted tables that carry the floor's clues, and three gauges make order a choice. The suggested fix (a chore resets a stretch's fight counter) is rejected: it would close the corridor's roads behind the player (§5) |
| 7 | The after-hours clues were readable only after the collector fight that decides the title | Accepted. A floor 1 reception clue before the fight (§3) |
| 8 | A "Nearest unfinished" button is a Go link outside town on run 1 (Wayfinding boon's job) | Accepted. Go & start sits on the ringed pin's map card (§2.5) |
| 9 | A conditioned find in the Break Room would hold John there until his time budget fails | Accepted. Break Room finds stay unconditional (§3) |
| 10 | A gauge could empty the clear spot's encounter table for the run | Accepted. Clear-spot-plain-line lint (§2.2) |
| 11 | Build order and scope: survey before the secret marker leaks secrets; the explore lint fails today on two Threshold rooms; lodging had no consumer; the secrets index was a declared list; two NPCs named Pell; a chance drop behind a one-time fight forecloses the item; the landing button is a teleport; the spent-search fix belongs in `canStartActivity` | Accepted, all. Order changed (§4); lodging and the landing button cut (§5); index replaced by derivation; "Quartermaster Pell" named; the mimic pays by find |

## 7. Questions for you

Each has a default used if you skip it.

1. **Clear vs conquest.** Keep the clear at ~3 minutes per floor and put the
   added time in optional conquest? Default: yes.
2. **Chores.** Weighted tables that carry clues (this plan), or plain timers
   that only open things? Default: weighted tables.
3. **Clues.** At least two plain clues per secret, one readable before the
   choice that forecloses it, or fully unmarked like the district rare
   finds? Default: two clues.
4. **Survey.** Show "Survey n/m" and pin numbers for non-secret content, and
   pay prestige points for it? Default: show it, pay at 15 marks per point.
5. **Secrets across prestige.** On later runs, does a found secret's door
   show as a normal shut road with its terms (save v58)? Default: yes, after
   the pilot.
6. **Hidden floors.** One per floor where it fits, or rarer (one per band)?
   Default: one per floor, the Records Cellar first.
7. **Order against the review.** Build this before SLICE_REVIEW's Doors and
   work ladders? Default: yes; floor 2's monster rules ride along in step 2.
8. **The loop that stays (§5).** Decide SLICE_REVIEW §8 Q3 (refilling hunts
   or assignable idle floors) before band 2, so every floor built to this
   standard has one endless spot? Default: yes, decided after the floor 2
   pilot is played.
