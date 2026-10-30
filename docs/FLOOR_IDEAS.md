# Floor ideas — the bank

*Ideas for future floors and floor groups, as the user posts them, with a
review of each. Started 2026-10-22.*

A bank, not a plan. The freeze rule in
[plans/alpha-band-one.md](plans/alpha-band-one.md) still holds, so nothing
here is a plan card, and [SLICE_REVIEW.md](SLICE_REVIEW.md) §8 Q7 puts band 2
after its steps 1–3. An idea leaves this file by becoming a card once band 1's
epic closes. An idea the user drops moves to [LONGTERM.md](LONGTERM.md).

Every idea gets the same review (§3), so ideas posted on different days can be
compared. §1 and §2 are the frame the review reads against. The band 1 numbers
come from SLICE_REVIEW.md (2026-10-22), which was uncommitted when this file
started; they are copied here so this file stands alone.

---

## 1. What a floor group has to do

"Floor group" here means a **band**: floors linked by a theme, usually one
site, cleared in order (`BandDef` in `towers.data.ts`). A band holds one
floor, three (the default), or about ten as a megastructure (§5.1); the
2026-10-29 ladder adds a four-floor and a two-floor piece (§1.5). The tower
is open-ended. Three bands are defined today: band 1, the Lower Reaches,
holds floors 1–3; band 2 (the Middle Galleries) and band 3 (the Upper
Reaches) are empty scaffolding.

### 1.1 Band 1 today, as the yardstick

| Measure | Band 1 |
|---|---|
| Hands-on time, first run | ~40 min (estimate, SLICE_REVIEW.md §2) |
| John's critical path | 10.1–13.7 min |
| Floor 1, hands-on | ~7 min |
| Build cost | ~1 session per floor |
| After the clear | every tower hunt empty; the Cages are the only repeatable fight |
| Run 2 | the same climb on the same clock (11.8 vs 12.3 min) |

### 1.2 The target

**2–4 hours hands-on per band** (§5.1): discovery, reading, picking spots to
explore and fight at, planning, crafting. Idle and offline time does not
count. That is 3–6× band 1.

The arithmetic decides the design:

- At today's rate a floor's authored path gives 7–15 hands-on minutes. Three
  floors give 20–45 minutes.
- The other 2–3 hours cannot come from a longer authored path. Authored
  linearly, a 3-hour band costs about 20 floors of build sessions.
- So the hours come from what a band **leaves running**: loops that stay open
  after the clear, optional depth off the path, and materials that feed the
  systems already shipped.

Proposed budget per band (engaged first-timer, three floors):

| Layer | Minutes | Made of |
|---|---|---|
| Critical path | 45–60 | three floors, one idea each, a boss with preparation |
| Optional depth | 45–60 | side rooms, mimics, a hidden off-ladder floor, chase items, bestiary facts, titles |
| The band's loop | 60+ | choices that repeat: which den for which drop, crafting with band materials, preparing for the boss |
| Gate waits | inside the loop | the next gate reads a counter the band's loop produces |

Because idle time does not count, the loop counts only where the player is
choosing. An endless den left running is a bonus; picking which den to hunt
for which material, then crafting with it, is the hours.

Floor count changes the split, not the total:

| Band size | Per floor | Shape |
|---|---|---|
| 1 floor | 2–4 h | a hub-sized floor; the loop and the optional depth sit on one map |
| 3 floors | 40–80 min | the budget above |
| ~10 floors (megastructure) | 12–24 min | floors as short as band 1's; the loop is band-wide, fed by every floor |

John's critical-path number is set at build time and checked with
`npm run pacing`, as for band 1.

### 1.3 Five findings from band 1

1. **Band 1 passes the narrative half and fails the hours half.** §2 runs it
   through the review. Ideas for bands 2+ are judged mostly on hours.
2. **Gates should be paid inside the band.** Floor 3's gate (600 gold earned)
   is waited out at a town job: 4.2 of John's ~14 minutes, on no floor. A gate
   reading a band counter (kills at the band's dens, a band material, band
   species in the bestiary) puts the wait on the floors. COMPLETABILITY §2:
   that source must be endless, never a `fightLimit` or `once` spot.
3. **The post-clear problem is the band problem.** A band with no endless spot
   per floor is empty the minute it is cleared. This touches the held
   idle-combat decision (SLICE_REVIEW.md §8 Q3: refill or idle nodes).
4. **The tower has no climb premise.** `the_ascent.desc` says only that floors
   are cleared in order. A band's story stands alone, which is the design
   (NEXT.md §0: "Floor 30 a drowned city and floor 31 a library is not a
   contradiction; it is a tower").
5. **Band 1 has a reusable shape.** An institution still running its
   procedures with no one left to serve: a toll stamp still in use,
   automatons still filing, a puppet still holding hearings. Each floor is one
   procedure; the boss owns the process; the player's preparation is reading
   the procedure. That is VOICE.md §4 (explain a place by its incentive
   structure) as level design. Ideas do not have to use it; it is the
   default when an idea has no frame yet.

### 1.4 Constraints every idea meets

| Constraint | Source |
|---|---|
| The climb requires basic use of roughly half the eight core systems (arcane, divine, martial, psionics, cooking, smithing, mutagens, alchemy), the player's pick, and any half covers every hurdle. Hurdles name roles (damage, sustain, condition defence, access), never systems; each role needs n − k + 1 systems behind it. Mastery of a generative grammar (arcane sentences, mutagen topology, alchemy sequence, the martial graph) gates optional content only | COMPLETABILITY §6a (2026-10-23), §5 |
| Gates on accumulation; a power check sits at John's floor | COMPLETABILITY §6 |
| Shut in alpha: runecarving, music, genes, psionics, wuxin; martial except the floor 2 tutor. An idea that needs one names how it opens (a Doors boon, a teacher on the floor) | plans/alpha-scope-locks.md, SLICE_REVIEW.md §6 step 2 |
| Shelved, not re-pitched: the countryside, tile autotile / generator / fake doors, arcane compound words | LONGTERM.md |
| Monsters never get unique abilities | plans/unique-abilities.md |
| Art is not the limit: 2,169 enemy sheets on disk, 79 monster definitions, 51 unplaced. The Ækashics art is never redistributed | README.md (art), PITFALLS.md |
| Progress on floors 11+ coarsens for offline: kills, searches, resource thresholds, room rates. No continuous fronts or multi-faction routing that only a full tick sim can resolve | §1.5 (2026-10-29) |
| Each band's last floor leads into the next band's first (a soft transition). Seams are prose and an optional climb verb, never an authored edge across floors | §1.5 (2026-10-29) |

### 1.5 The ladder, floors 11–30 (user, 2026-10-29)

**As posted.** *"Floor band restructure summary."* Context, decisions and
constraints, condensed from the post:

- **Context.** *"Offline catch-up is the real bottleneck."* Prefer themes
  whose progress can be coarsened (kills, searches, resource thresholds, room
  rates) over continuous fronts or multi-faction routing. The completability
  law still binds: no terminal states, the critical path is usable by a narrow
  build (John), knowledge transfers (consume output, never invent a grammar).
  Do not repeat bands 2–3's "clear the map, kill the boss" shape a third time.
- **Floor 11** is a one-time aberrant player stronghold. After the required
  prestige it is replaced by a normal floor, and the base becomes its own
  optional para-floor (room rates and building that feed existing systems,
  off the critical path).
- **The Great Island at War** (idea 2) moves to floors 21–30.
- **Between them:** 11–14 a band of its own; 15–16 the Vermin Festival, a
  horror double floor built on the Gu ritual; 17 a special, aberrant floor;
  18–20 a band of its own.
- **Why.** The large continuous-state band goes later; smaller self-contained
  pieces in front of it are easier to finish, to measure (extend John) and to
  coarsen; the stronghold is a one-time event plus an optional para-floor, not
  another repeating dungeon band; the earlier bands ship and test before the
  island's content volume arrives.
- **Constraints kept.** The replacement floor 11 and every later
  critical-path floor are clearable by a narrow build. Base output stays
  optional. The offline path is coarsened (memoize derived stats, chunk, rate
  and phase approximation) before 11–30's content makes the hang the default.

**The ladder.**

| Floors | Piece | Shape | Status |
|---|---|---|---|
| 1–3 | band 1, the Lower Reaches | sequential | shipped |
| 4–6 | band 2, the Wilds | sequential, goblin camp; prestige at 6 | PR #26 merged |
| 7–10 | band 3, the castle | hub, four wards any order | skeleton on `band3-machinery` |
| 11 | the stronghold | take it, fix it up, make workers, hold a monster wave; normal floor from the next prestige on (§5.3) | unwritten |
| 11–14 | band 4, the harbor band | harbor side pick, two sea floors, four final missions (idea 3) | banked |
| 15–16 | the Vermin Festival | dark room of 10, a 10-day prep hub on its own clock, an isometric free-movement battle royale of 100 (§5.3) | unwritten |
| 17 | special floor | aberrant, one floor | unwritten |
| 18–20 | band 5, the desert band | necropolis road, the pyramid (the Weighing), the delta port to the island (idea 4) | banked |
| 21–30 | the Great Island at War | idea 2 | banked |
| — | the base | optional para-floor, room rates feeding shipped systems | unwritten |

**What it changes in this doc.**
- §5.1 Q1 (band size 1, 3 or ~10) no longer limits: 11–14 holds four floors,
  15–16 two.
- Idea 2 moves to floors 21–30 and is no longer how the player first gains a
  base; its floor-12 hold ruling (Q9) is dropped for access to the
  factions' war room (§5.3 Q7).
- The offline row in §1.4 applies to every idea from here on. Idea 2's
  presence clock already fits it (absent floors do not advance); its fronts
  must resolve as per-turn counters, which they already are.

**Soft transitions (user, 2026-10-29).** *"All floor have this sort of soft
transition"*: each band's last floor leads into the next band's first. The
data model, after the antagonist's review of idea 4:
- **Seams are prose.** No authored edge may cross a banded floor boundary
  (lint, `content.test.ts:2171`), so a seam lives in the last floor's final
  spots and the next floor's landing description.
- **One optional field:** `FloorDef.seam = { verb?: string }`, the climb
  log's word for the step into the next floor (default "Climbing"; 20 → 21
  "Sailing"). `climbTo` reads it only when `toIndex === fromIndex + 1`, since
  a climb can skip rungs. The verb is a literal in `towers.data.ts`: the text
  split accepts only `desc`, `dialogue` and `hint`.
- Nothing moves the player on a clear (clearing is derived), so a seam has
  no exit field. A seam reads and writes no flag.

| Seam | State |
|---|---|
| 3 → 4 | one side written: `f4_treeline` says the tower opens onto woodland; floor 3's end says nothing |
| 6 → 7 | planned (the warren threatens band 3's city), unwritten |
| 10 → 11 | proposed: the castle safe, a steward deeds the derelict stronghold; after the swap, floor 11's landing describes the road to the harbor |
| 14 → 15 | proposed: the final mission's feast ends in a drugged cup; the dark room is the cut |
| 16 → 17 | unwritten. The ladder works on 15–16 like any floor; climbing out before the royale ends is a loss (§5.3 item 25) |
| 17 → 18 | proposed: floor 17's clear opens a shaft; floor 18's landing is a well-head in full sun. Floor 17 owes floor 18 only "ends underground" |
| 20 → 21 | idea 4: the ferry; the roadstead fight is the crossing; verb "Sailing" |

**Checks against the code and the laws.**
- **Offline, the state of the three fixes** (ENGINEERING.md §1.4).
  Memoizing `getDerivedStats` is **done**: `modFingerprint` in
  `systems/derived.ts`, with a cache-consistency test. ENGINEERING.md §1.2–1.4
  had said "nothing is memoized". Re-measured 2026-10-29 with the memo in:
  8 h of catch-up still takes 17.6–28.6 s of wall clock on a developed save,
  because a cache hit still pays for building the fingerprint string
  (ENGINEERING.md §1.2 has the profile).
  Chunking is **not done**: `save/offline.ts:47` is still one synchronous
  loop of up to 288,000 ticks. Coarsening is a design call about what offline
  progress means (ENGINEERING.md says so) and has no card.
- **Floor 11 swap.** Floors are found by index (`systems/ladder.ts`); a floor
  whose content depends on a legacy flag is new machinery: two `FloorDef`s
  for one rung, picked by a `state.prestige` key. The run that clears the
  stronghold has to keep a clearable floor 11 until it prestiges.
- **The base today** is the hold: region `the_hold`, 25 `base_*` rooms, a
  door at the Foot that opens at `prestige:count` 1, which band 2 now reaches
  at floor 6. A para-floor base reached from floor 11 overlaps it; ruled
  in §5.3 items 3 and 9 (one base; the hold door moves to floor 11).
- **Narrow build.** COMPLETABILITY §6a requires basic use of about half the
  eight core systems; "narrow" is read as the narrowest legal pick, which is
  what John measures. A narrower John would contradict §6a.

## 2. Calibration: band 1 through the review

| Check | Band 1 | Result |
|---|---|---|
| N1 Who runs it | an office still collecting tolls and holding hearings, staff gone (implied, never stated in prose) | pass |
| N2 One idea per floor | the remembered route (1), the corridor with a teacher (2), exploration weakens the boss (3) | pass |
| N3 One theme | one building, three maps | pass |
| N5 Boss preparation | collector: spell conditions; bureaucrat: strings and the oak club | pass |
| N6 Someone proposes terms | floor 2 has the tutor and the quartermaster; floors 1 and 3 have no NPCs | partial |
| H1 The loop that stays | none; every hunt empty after the clear | fail |
| H2 Gate paid inside | gold earned, waited at a town job | fail |
| H3 Optional depth | mimics designed (SLICE_REVIEW.md step 1 A2), none shipped | thin |
| H4 What it feeds | goblin furs, slime gel, ledger leather: no consumer | fail |
| H5 Novelty | 12 species; floors 2–3 run on 4 definitions | thin |
| H6 Re-climb | run 2 is run 1 | fail |
| H7 Idle form | floor 1 searches are safe to leave; hunts are not | partial |

---

## 3. The review

Each posted idea is filed in §4 with these checks answered. A check the idea
does not touch is left out of its entry.

Per floor, an idea is also read against FLOOR_STANDARD.md (proposal,
2026-10-23, uncommitted when this line was written): spine, wings, floor
work, secrets, survey. That standard covers a floor's optional depth (H3);
this review adds the band-wide checks it leaves open, chiefly H1, the loop
that stays.

### 3.1 Narrative viability

- **N1 Who runs it.** One sentence naming who profits from the place and who
  pays. If it cannot be written, the place has no incentive structure yet.
- **N2 One idea per floor.** The floor's mechanic as a verb on existing
  machinery: search, a room route, `fightLimit` stretches, a forced fight, a
  preparation flag, a teacher, a shop, a work site.
- **N3 One theme per band.** The floors share a theme at the least, and
  usually read as one site with different maps, as band 1 does.
- **N4 Panels.** Each spot drawable in one sentence; the spot graph is the
  zoom (VOICE.md §5).
- **N5 The boss and its preparation.** What exploring finds that weakens it;
  winnable without any of it.
- **N6 Someone proposes terms.** A quest giver, vendor or teacher on the band.
  A quest is a deal (VOICE.md §8).
- **N7 Lore stays subordinate.** The backstory fits in dependent clauses. No
  exposition.

### 3.2 Hours

- **H1 The loop that stays.** What is still worth doing after the band's
  clear, and for how long.
- **H2 The gate paid inside.** What counter the next floor's gate reads, and
  that its source is endless.
- **H3 Optional depth.** Skill-locked content off the path (allowed,
  COMPLETABILITY §5): a hidden off-ladder floor (no `bandId`), mimics, chase
  items, titles, bestiary facts.
- **H4 What it feeds.** Which shipped system consumes the band's drops:
  smithing, cooking, alchemy reagents, benches. A material with no consumer is
  a dead end.
- **H5 Novelty.** Species count and facts to pin; the bestiary domain pays
  discovery XP for each new species (NOVELTY_DOMAINS.md).
- **H6 Re-climb.** What differs on run 2+: a Doors payoff, a route only a
  returning player knows, a hidden floor behind `prestige:count`.
- **H7 Idle form.** What the band pays while the player is away, and that it
  is safe to leave running.
- **H8 A use for each system.** What each open core system does on this band:
  the roles it fills on the band's hurdles (as floor 1's spells answer the
  collector; today's fills are in ROLES.md), a material it consumes, a
  teacher. Picking which systems to
  focus on is planning, and planning counts as hands-on time; a band where
  only one system helps removes the choice and fails L7.

### 3.3 Laws

- **L1 No stranding.** Every spot gets home; one-way edges listed.
- **L2 No exhaustion on the path.** No `once` or `fightLimit` source under a
  gate or clear that needs more than it holds.
- **L3 Failure is recoverable.** A loss costs time, never a path.
- **L4 Usage, not invention** on the critical path. Mastery gates optional
  content only (§5.1 Q6).
- **L5 No power gates.** Every critical-path fight is winnable by grinding
  inside the systems the player picked (§5.1 Q7).
- **L7 Roles, never systems.** Each hurdle (boss, stretch, inflicted
  condition, shut way) names the roles it asks for, and each role is filled
  by at least n − k + 1 systems open to a fresh save and taught below it
  (COMPLETABILITY §6a). No gate, clear or hurdle names a system.
- **L6 Shelf and shutters** (§1.4).

### 3.4 Verdicts

| Verdict | Means |
|---|---|
| Build next | passes N and L; has answers for H1 and H2 |
| Bank | viable; the missing answer is named in the entry |
| Rework | breaks a law; the break and a fix are named |
| Shelf | the user's call only; moves to LONGTERM.md |

### 3.5 How a post is handled

1. The user posts ideas, in any form. Fragments are fine.
2. The manager files each idea in §4, keeping the user's words under
   *As posted*.
3. Two `brainstormer` agents in parallel: one on the narrative (the place,
   its procedures, the boss and its preparation), one on the hours (the loop
   that stays, the gate paid inside, what it feeds).
4. `antagonist-design` attacks the merged review, given the entry only.
5. The manager writes the verdict, the checks, the rulings on objections and
   the open questions into the entry, commits, and reports in chat.

---

## 4. Ideas

| # | Posted | Name | Band | Verdict |
|---|---|---|---|---|
| 1 | 2026-10-28 | The Five Moons | off-ladder, band 2's goblins, entered from band 3 | Bank |
| 2 | 2026-10-29 | The warring states band | floors 21–30 (moved from 11–20, §1.5) | Bank |
| 3 | 2026-10-29 | The harbor band | band 4, floors 11–14 | Bank |
| 4 | 2026-10-29 | The desert band | band 5, floors 18–20 | Bank |

### Entry template

```
### N. <name> (posted YYYY-MM-DD)

Band: · Floors: · Verdict:

**As posted.** <the user's words, unedited>

**The place in one line.** <who profits, who pays>

| Floor | One idea (mechanism) | Boss / preparation | Spots |
|---|---|---|---|

**Hours.** H1–H7, the ones it touches.

**Laws.** L1–L6, the ones it touches.

**Feedback.** label: fact lines.

**Objections and rulings.** from antagonist-design.

**Open questions.** each with a default.
```

### 1. The Five Moons (posted 2026-10-28)

Band: none (off-ladder, no `bandId`); band 2's goblins, entered from band 3 ·
Floors: one map, about 10 spots · Verdict: **Bank**.

It waits on:
- band 3 ([plans/bands-2-3.md](plans/bands-2-3.md) build order step 6: the M3
  key boon, M4, M5 and the direction floors)
- goblin gods 4 and 5

The escape streak can be built and tested on a band 2 spot before either.

**As posted (2026-10-28).** *"a subfloor to floors 4-6. can only be accessed
on the forest-facing section of band 3 (floors 7-10) by fighting a goblin and
escaping the fight 5 times in a row. this unlocks an exploration activity
that lets the player access the goblin five moons festival, where five
tribes, each aligned with one of the goblin gods, are vying for who gets to be
the new head tribe. the player can either align with one of the goblin tribes
as a mercenary, fight them all, or become a mediator to help them unite as
one. each of those endings should set a flag that can become relevant later
on"*

**Rulings (user, 2026-10-29).**

- No tracker, counter or log line for the escape streak until the whole
  requirement is met. It is a secret floor, so there is no hint either.
- A player who is too strong cannot meet the streak as first drafted. The
  goblins at that spot scale with the player, up to a cap (Q1, answered).
- An eighth ending: the player unites the tribes under the player.
- The world has a moon, as part of the time and weather system. The festival
  does not depend on it (Q2, answered). The smithing card's "the world has no
  moon" was an over-reading of a code comment.

**The place in one line.** The thief tribe hosts the festival and takes 10%
of every bet and contract. The other four tribes pay it. The winning tribe
becomes head tribe and taxes the city's outlying farms. The seat is open
because the warchief died on floor 6.

**Contest rules.** They are posted at the festival entrance for the player to
read.

- Each tribe has a camp, a champion and a speaker. The champion is a one-time
  fight (`fightLimit` 1); the speaker gives a quest.
- A tribe with three wins becomes head tribe. That is the mercenary ending.
- An outsider who beats all five champions ends the contest with no head
  tribe. That is the fight-them-all ending.
- If every tribe agrees to terms, the five tribes form a council. That is the
  mediator ending.
- An outsider who has every tribe's terms and then beats every champion
  becomes head. That is the ruler ending (proposal, Q7).

Wins are read from existing state rather than counted separately. The
conditions do not depend on order:

- **Mercenary for tribe T:** T's contract quest turned in. Its objectives
  are three rival `slain:<camp>:<champion>` keys.
- **Fight them all:** all five champion `slain:` keys, plus `statMax` 0 on
  every contract's accepted stamp.
- **Mediator:** all five terms quests turned in. A terms quest requires
  `statMax` 0 on its tribe's champion `slain:` key, so a tribe whose champion
  died gives no terms this run, and the rules say so.
- **Ruler:** all five terms quests turned in, then all five champion
  `slain:` keys.

New code: `acceptQuest` stamps `flag:quest:<id>:accepted`, about 3 lines.
Today accepting a quest writes no stat, so "took a contract" cannot be read.

| Tribe | God | Champion's fight | Role it asks for |
|---|---|---|---|
| Fire | `goblin_fire` | on burning ground; the warchief's tribe | condition defence (burning) |
| Mud | `goblin_mud` | with healers | damage (outpace the heals) |
| Hunt | `goblin_hunt` | with a rat, bird and worm swarm | sustain |
| Thief | thievery (planned, unshipped) | the host; its champion sits behind a locked strongroom (`ExploreGate`) | access |
| Witch | witch magic (planned, unshipped) | casts curses | condition defence (curse) |

**The way in: five escapes.**

- **Rule.** At one spot of the forest-facing direction, walk away from a
  fight with a goblin five times in a row.
- **What the player sees.** Nothing until the fifth escape. Then one log line
  appears, and so does the new path.
- **Data.** `SpotDef.escape?: { tag: 'goblin'; streak: 5; opens:
  'flag:fest_open'; scaleCap: number }`.
- **Scaling.** The goblins at that spot spawn scaled to the player, up to
  `scaleCap` (Q1). This needs new code in `spawnMonster`, a spot-level
  override like M5's direction step.
- **What counts.** The player leaves a live, non-forced fight that still has
  a living enemy with the tag. Leaving means travel, caravan, an activity
  switch or a climb.
- **Hook.** At the decision points (`locations.ts:49`, `:345`,
  `actions.ts:95`, `towers.ts:122`), not inside `abandonCombat`. The
  condition-fatal path (`actions.ts:687`) calls `abandonCombat` without
  `endFight`, so a hook there would count a knockout as an escape.
- **Reset.** A fight at that spot that ends `won` or `knocked_out` sets the
  streak to 0.
- **Storage.** `stats['escape:streak:goblin']`. At 5 it sets
  `flag:fest_open`, which stays set.
- **After.** A hidden `Connection` (`revealWhen` the flag) opens to a new
  spot. That spot's explore activity is the post's exploration activity; at
  100% it reveals the edge to the festival map. All edges are two-way.
  `explore` activities take no `requires` (types.ts:4295), which is why the
  gate is on the edge.
- **Cost.** No save change. About 40 lines, plus a lint: the escape spot is
  never `forced`, and no `Connection.forced` leads into it (precedent
  `tests/content.test.ts:318-345`).

**Endings: eight flags.**

| Ending | The player | Final fight (forced, `once`) | Flag |
|---|---|---|---|
| Mercenary (one per tribe, ×5) | takes tribe T's contract and beats three rival champions | the fourth rival champion with two escorts, level −1 per rival already beaten | `flag:fest_end_merc_<T>` |
| Fight them all | takes no contract and beats all five champions | all five tribes' regular goblins at once | `flag:fest_end_conquest` |
| Mediator | turns in all five terms quests | the goblins who reject the deal, level −2 per tribe that agreed | `flag:fest_end_mediator` |
| Ruler | turns in all five terms quests, then beats all five champions | the host tribe's guards (Q7) | `flag:fest_end_ruler` |

- The ending is set by **winning** the final fight, not by reaching it.
  - A find reveals the path to the final fight's spot. A find cannot start a
    fight (`SpotFind` payloads, types.ts:4317-4360).
  - The ending flag is stamped by a find on that spot that `requires` the
    final fight's `slain:` key.
  - Each final fight's encounter `requires` `statMax` 0 on the other final
    fights' `slain:` keys, so the first win closes the others for the run.
  - A player who keeps losing a final fight has no ending.
- The five mercenary endings are five rows `{ tribe, god, champion, rewards
  }` on one template.
- Readers (proposal, off-ladder only):
  - mercenary: that tribe's god is met (`meetDeity`), and the tribe has a
    shop and a technique teacher
  - fight them all: no goblin shops
  - mediator: a goblin quarter at the castle, a shop with all five tribes'
    goods, all five gods met
  - ruler: Q7
- The festival requires nothing about floor 6. With a band 2 pass, the
  warchief is alive in that run.

**Hours.**

- **H1 What stays after the ending.**
  - Mercenary: four rival camps, each dropping a different material. The
    patron tribe's shop sells for gold.
  - Fight them all: each camp keeps an endless hunt, its monster level
    stepped by tribes beaten (the M5 table).
  - Mediator: five `gather` activities feeding festival benches (cooking,
    alchemy).
- **H4 What it feeds.**
  - Champion drops feed smithing parts.
  - Terms quests consume cooking, alchemy and smithing output.
  - Gods are met through `meetDeity`, which has no caller today.
- **H5 Novelty.** Five champions plus the tribes' goblins. The thief and
  witch tribes add species.
- **H6 Re-climb.** Flags reset at prestige, so each run picks an ending again
  (Q3).
- **H7 Idle form.** Mercenary has a camp-watch `job`; mediator has the
  `gather` activities. Fight them all has none, because hunts are not safe to
  leave running.
- **H8 Systems.**
  - Arcane: burning and damage.
  - Divine: the gods.
  - Martial: the champions, plus techniques learned by watching.
  - Cooking, smithing and alchemy: the terms quests and benches.
  - Psionics, mutagens and runecarving stay shut (§1.4).

**Laws.**

- **L1.** Every festival edge is two-way. The entrance is a hidden edge that
  stays revealed once found.
- **L2.** Champions have `fightLimit` 1 and sit under no ladder gate. The
  camps' hunts are endless.
- **L3.** A knockout resets the streak and nothing else. `flag:fest_open`
  stays set. A lost festival fight costs time.
- **L4.** The whole map is optional content, so it may be secret and may be
  hard.
- **L7.** No reader of a `flag:fest_*` key may be on a ladder floor (Q4).
  Lint: every `flag:fest_end_*` has at least one reader, and none of those
  readers has a `bandId`.

**Build cost** (estimate, nothing measured): about 7 sessions.

1. The streak, the hook, the lint and the tests.
2. The festival map, the final-fight finds and `SpotFind.meet`.
3. Mercenary.
4. Fight them all.
5. Mediator (1.5 sessions).
6. Ruler.
7. Tribes 4 and 5 and their gods.

The first slice is session 1, tested on a band 2 goblin spot, and it stays on
a branch.

**Objections and rulings.** From antagonist-design, 2026-10-28, verdict *fix
first*.

1. **The escape bar was unreachable by fighting.**
   - Probe: John through floor 6, seeds 42, 7 and 1234, 90 goblin fights.
     Median fight 27–69 ticks; none lasted 150 ticks with 30% of max HP
     taken.
   - First fix: a lower time bar, a damage bar, and a log line per
     walk-away. The user's rulings of 2026-10-29 replaced it: no log line,
     and the strong-player gap is Q1.
2. **"Took a contract" could not be read.** *Taken:* the accepted stamp, and
   conditions that do not depend on order.
3. **A find cannot start a fight.** *Taken:* the ending is set by the final
   fight's win.
4. **Readers on later goblin fights leaked onto the ladder.** *Taken:*
   readers are off-ladder only (Q4).
5. **`explore` takes no `requires`.** *Taken:* the gate is on a hidden edge.

Also taken: nothing reads the warchief's kill, and slice 1 stays on a branch.

Clean:
- invariant A: return edges carry no `revealWhen`, a knockout goes to a
  haven, and flags reset at prestige
- invariant C: the counters are integers
- troll: the streak pays out once

**Open questions.**

1. **Strong players.** *Answered (user, 2026-10-29): "the goblins scale to
   some point."*
   - The goblins at the escape spot scale with the player up to a cap, so
     the fight lasts long enough to leave.
   - Scaling: level or HP set from the player's damage.
   - The cap is a dial, set at build time.
   - There is no damage bar and no time bar.
   - Above the cap, a strong enough player can still end the fight before
     leaving. The user accepts this.
2. **The moon.** *Answered (user, 2026-10-29): "the moon doesn't matter in
   this case, it just matters that the moon exists and is part of the time
   and weather system."*
   - The moon is world work in `clock.ts`, `weather.ts`, `exposure.ts` and
     `WEATHER.md`, not part of this entry.
   - The "no moon" line came from `exposure.ts:126` ("Moonless on purpose,
     for now", in the darkness model since the prototype import). The
     smithing card (c5c69fb) turned that into a world rule; it is corrected.
3. **Flag lifetime.** Every `flag:` resets at prestige today.
   - *Default:* the ending flags are per run, so each run picks again.
   - Plus a carried `flag:keep_fest_<ending>`: `prestigeNow` copies
     `flag:keep_` keys (about 10 lines, no migration). It skips the streak
     on later runs.
4. **What the flags may change.** *Default:* off-ladder content only. An
   ending that changes a band 3 floor needs the critical-path lint
   (COMPLETABILITY §8) first.
5. **Which direction faces the forest.** *Default:* West (floor 8), with a
   forest as its outside map.
6. **Gods 4 and 5** (thievery, witch magic). *Default:* placeholders as in
   M7; the user writes them later.
7. **The ruler ending.**
   - *Default:* all five terms quests, then all five champions, then a final
     fight against the host tribe's guards.
   - Readers: open.

### 2. The warring states band (posted 2026-10-29)

Band: band 4, floors 11–20 · Floors: 10, a megastructure
(§1.2: 12–24 hands-on minutes a floor, the loop band-wide) · Verdict: **Bank**.

It waits on:
- band 3 (floors 7–10, [plans/bands-2-3.md](plans/bands-2-3.md)) and its M5
  spawn-level offset, which this band reuses
- the first slice of base building (the run/legacy state split)
- condition defence and access getting system answers
  ([ROLES.md](ROLES.md): 0 systems fill either today), since the rosters
  below name those roles
- for the hidden paths only: worker creation from base building, since there
  the player creates soldiers (it needs mutagens, shut in alpha)

The presence clock and the battle counter can be built and tested on a band 2
floor before any of these.

**As posted (2026-10-29).** *"Idea for a 10 floor band (it will be a large
one timewise): The player is thrown in a Japanese warring states situation
where they have the choice to side with either of three groups to either
conquer the island, overthrow the shōgun or break free as part of the free
states. A hidden fourth and fifth option exists, where they can either
becoming a warlord themselves and conquer the island for themselves or become
a destroyer who fights against all three sides at once. This band is how the
player gains their own base. The band should feature base management and also
strategy features where the player can direct resources and soldiers, but also
give them the ability to interfere in each floor directly by fighting enemies.
The player will get a title after the 5th and 9th floor from their allies
based on how they perform and how they win battles for their side. It has a
quasi-realtime function where the player can gather resources and all from
other floors, but "time" in those floors advances only if the player is
present."*

**Rulings (user, 2026-10-29).** Answers to Q1–Q11, in the user's words where
quoted.

- **Leaders.** The conquerors are led by the Shōgun. The usurpers are led by
  their strategist; *"their warlord is a figurehead"*. The freedom fighters
  are the free states, led by a triumvirate, *"three warriors of great
  renown"*.
- **Bases.** *"Each faction has their own base. The player base is only the
  base in either of the hidden paths."*
- **Soldiers.** *"Provided by the factions, separate from the player's
  workers. In the hidden paths, the player will have to create soldiers
  using their own resources."*
- **Presence.** Resting at a haven on the floor counts.
- **Titles.** *"Probably a good amount, depending on loadout, fighting
  style, how the player wins combats."*
- **Hidden triggers.** *"Very difficult, needs to be tuned."*
- **Routes.** Three per floor, one per side.
- **Placement.** Band 4, floors 11–20, after band 3. **Superseded
  2026-10-29:** floors 21–30, after band 5 (§1.5). Floor numbers below are
  the original 11–20; add 10.
- **The hold** (Q9): *"No matter how the player clears floor 12, the player
  gains a base."* **Superseded 2026-10-29:** the base comes from the floor
  11 stronghold; floor 12 (now 22) gives access to the factions' war room
  instead (§5.3 Q7).
- **Finales** (Q10): a visible side fights the other two sides' leaders on
  floor 20; the hidden paths fight all three.
- **Titles' first rows** (Q11): six baselines (3 sides × 2 ranks) plus one
  row per win mode; loadout and style rows are added as the user names them.

**The place in one line.** Each side takes soldiers and supplies from the
floors it holds; the towns and farms on contested floors pay. The player's
side pays the player in titles and a base to run.

**Two facts from the code that shape it.**
- The player's base already exists as the hold: the `the_hold` region, 25
  rooms (`base_*`), behind a door at the Foot that opens at `prestige:count`
  1 (`locations.data.ts:483`). Prestige now comes at floor 6, before this
  band. The door stays where it is. Per the ruling, the hold is the war base
  only on the hidden paths; a visible side fights from its own base. Every
  path gains building in the hold at floor 12 (Q9).
- `GameState.prestige` is already the legacy block (types.ts:5602) and v58
  grew it with the cookbook lists, so the hold's legacy ledger is the same
  move, not a new split.

**Sides.** All war counters are `state.stats` keys, per run, no save change.
Keys that content writes (finds, quests) are `flag:war:*`, because a find may
only write `flag:` keys (`tests/content.test.ts:553-557`). Keys the engine
writes (`presence`, `turn`, `front`, `broken`, `win`, `ko`) are `war:*` and
get one branch in the lint's `realStat` (`content.test.ts:105-142`).

- **Sides:**
  - the conquerors (conquer the island), led by the Shōgun
  - the usurpers (overthrow the Shōgun), led by their strategist; their
    warlord is a figurehead
  - the freedom fighters (the free states break free), led by a triumvirate
    of three warriors
  - hidden: warlord, destroyer
- **Picking.** Floor 11 has one camp spot per visible side. The pick is
  accepting that side's join quest, given by its leader (the strategist, not
  the figurehead, for the usurpers), so the quest text is the confirm and
  nothing is picked by exploring a camp. The record is idea 1's accept stamp
  (`acceptQuest` writes `flag:quest:<id>:accepted`, about 3 lines, shared).
  Each visible join quest requires `statMax 0` on the other two stamps.
- **No switching** between the three visible sides within a run. The hidden
  options are the only way to leave a side. A new run picks again (H6).
- **Sides not picked** are hostile: encounter lines are gated on the stamps
  (a hidden stamp beats a visible one). No computer-run side ever wins a
  floor, so a floor can swing back and forth but nothing is lost (L3).
- **One map set.** Ten maps for all sides. Per floor, each spot type (keep,
  depot, town) ends one side's route (ruling: three routes): the conquerors
  kill the keep's commander, the usurpers sabotage the depot (explore gates),
  the freedom fighters turn in the town's terms quest. Each route stamps
  `flag:war:<floor>:done`; each floor's `clear` reads it.
- **Rosters.** 3 rosters × 3 tiers = 9 ordinary `MonsterDef`s, plus bosses.
  No unique abilities.
- **Test.** For every side, the closure of `done` stamps reaches the band's
  clear.

**A battle.** One per floor.

- **Data.** `FrontDef { floorId; need; turnTicks; rows: Record<side,
  { pressure; levyPerTurn }> }`. Counter `war:<floor>:front`, rising to
  `need`.
- **What raises it.**
  - Each kill at the floor's spots: +1.
  - Each turn the player is present (below), soldiers add `max(0,
    sum(power × fed) − pressure)`.
  - Scouting and sabotage finds add fixed amounts (floor 3's pattern).
- **At `need`** it stamps `war:<floor>:broken` and emits an event the title
  checks listen to (one line in `registerTitleListeners`, `titles.ts:48-58`;
  a break on a soldier turn emits nothing today). The floor's boss encounter
  requires it. Preparation flags lower the boss's level or escorts (the floor
  6 sabotage pattern, `SpotDef.preparation`, on branch band2-floors, unmerged).
- **With no soldiers**, kills alone reach `need` (L5).
- **A loss** never lowers `front`. Soldiers are never deleted: a lost turn
  marks them wounded, and they recover on the world clock (L3).
- **Example** (dials, not measured): need 200, turn 600 ticks, pressure 20.
  30 fed soldiers give +10 a turn and 6 kills give +6, so about 13 turns, 13
  minutes present, 75 food.

**Soldiers and supply.**

- **Soldiers on a visible side** are provided by the faction, separate from
  the player's workers (ruling). They are numbers per troop type, never
  individuals: no familiarity, no gold upkeep, nothing but fed turns. The
  faction base's barracks caps the pool and does nothing else to them.
- **Soldiers on a hidden path** are created by the player from their own
  resources (ruling), in the hold. Default: base building's worker creation
  (a body from the culture cellars, alchemy, a blessing), with the result
  assigned to war. That needs mutagens, which are shut in alpha, so the
  hidden paths wait on worker creation. Kills alone still clear (L5), so a
  player with no soldiers is slower, not stuck.
- **Data.** `TroopDef { id; power; counters?: tag[]; food: materials }`;
  `state.war { pool; wounded; focus }` (save v60), or all of it in `stats`.
- **Supply** is existing materials: food, arms, salves. No new currency.
  Cooking, smithing, alchemy, gathers and shops all supply it.
- **What the player directs:** troop mix against the floor's enemy tags, how
  much stock to bring (fed turns), and, in slice 2, garrisons: capture points
  that pay a gather at ×2 and a haven while troops are locked there.
- **One body.** Only the floor the player stands on runs, so there is no
  "send troops to floor 14 while I stand on 13". The choices are stock, mix,
  garrisons and focus.
- The orders panel previews with the resolver itself, so the preview cannot
  disagree with the result.

**The presence clock.**

- **Data.** `stats['war:<floor>:presence']` and `war:<floor>:turn`, written
  in `advance()`'s non-travel branch (`game.ts:231`, beside `tickAction`).
  Written raw, not through `bumpStat`, which scans achievements on every call.
- **What counts:** a tick on a floor with a `FrontDef` while the player is
  not idle (`isIdle`, `bonustime.ts:20`) and not recovering.
- **`rest` counts** (ruling). Resting is an activity (`actions.ts:349`), so
  a player resting at a haven on the floor is not idle: the soldiers fight,
  supply pays, the player risks nothing.
- **Offline on the floor.** Catch-up replays the ticks (8 hours at most,
  `offline.ts:8`). Turns stop when supply hits 0, when `front` reaches
  `need`, or when a turn would add 0 (soldiers too weak for the pressure), so
  an idle army cannot eat the stock for nothing. A knockout retreats to a
  haven, the player goes idle, and the count stops. Supply raids happen only
  on presence turns, never while the player is away.
- **Gathering elsewhere.** `climbTo` costs 45 ticks a rung, both ways
  (`towers.ts:28`, `:130-132`). Gathers pay into the shared materials. The
  cost of gathering on another floor is that the front is frozen.
- **Two clocks.** Bases run on the world clock: build jobs, upkeep, wounded
  recovery. The floors run on presence. Staying at the front draws on the
  base's stock; going back to the base freezes the front.
- **Tests.** The sum of all `presence` keys never exceeds `totalTicks`. A
  288,000-tick replay stays finite, conserves troops, and stops at 0 supply.

**The bases.**

- **Faction bases** (ruling). Each visible side has its own base on the
  island: its floor 11 camp area, with plots. On a visible side the player
  runs that base. It is run-scoped: the side changes each run, so it resets
  at prestige and needs no legacy ledger. Floor 12's `done` opens its plots.
- **The player's base** (ruling): the hold. Floor 12's `done`, however it is
  stamped (any side's route or either hidden path), opens building in the
  hold for good: the opening is written to the legacy block, so later runs
  build from the start. The hold is the war base only on the hidden paths;
  there the player creates soldiers in it. It persists across prestige by
  base building's settled rules (below).
- **First structures, no workers.** The same set in both kinds of base.
  - Storehouse: caps the stock a front can draw.
  - Barracks: soldier pool cap and wounded recovery.
  - Kitchen: a cooked dish sets fed turns.
- Each structure is a lens on an existing system, with no math of its own.
  Bases refine; the floors supply.
- **Data.** `StructureDef { id; tiers: { cost; upkeepGoldPerDay; effect }[];
  essential }`, one registry for both kinds. Run: `state.base.built[spotId]
  = { id; tier; paidThrough; dormant }`. Legacy, for the hold only:
  `state.prestige.base = { tier; plots }`. Save v60 and one migration.
- **The hold across prestige** (base building's settled rules): essential
  structures fall to tier 1 unless a higher tier was bought permanent with
  prestige points; non-essential structures fall to tier 1 and their plots
  re-lock; unpaid upkeep makes a structure dormant, never removed.
- Builds are world-clock jobs that train a construction skill.
- No structure grants a `Modifier`, so `modFingerprint` is untouched. A later
  structure that does must join it.
- Because every path gains the hold at floor 12, the hold's legacy ledger
  ships with the first visible side, not with the hidden paths.

**Titles after floors 15 and 19** (the band's 5th and 9th).

The ruling asks for "a good amount" of titles, picked by loadout, fighting
style and how the player wins. A grid of `TitleDef` conditions multiplies
past what anyone can name, so the pick is a table with fallbacks.

- **What each half records** (floors 11–15 for rank 1, 16–19 for rank 2):
  - **Loadout:** the main-hand weapon family on each kill at the band's
    spots (`war:r1:weapon:<family>`).
  - **Fighting style:** the source of each killing blow: weapon, technique,
    spell, miracle, thrown flask (`war:r1:src:<kind>`). The kill event
    carries only the monster and XP today (`types.ts:6248`, emitted at
    `combat.ts:1564`), so the killing blow's source has to be added.
  - **How battles are won:** each battle's mode, the largest share of `front`
    among kills, soldiers and finds; ties go kills, then finds, then
    soldiers (`war:win:r1:<mode>`).
  - **Performance:** knockouts in the half (`war:ko:r1`).
- **The pick.** At the anchor (`war:15:broken`, `war:19:broken`) a function
  takes the largest count on each axis and matches it against a table:
  `WarTitleRow { side?; rank; weapon?; src?; mode?; clean?; title }`. The
  row matching the most fields wins; ties go by table order. Every side has
  a baseline row with no fields, so the pick always returns exactly one. It
  stamps `flag:war:title:r1:<id>`, and each `TitleDef.unlock` reads its
  stamp.
- **Why a pick and not conditions.** Titles latch for good once their
  conditions hold (`types.ts:4996`). Conditions alone latched the baseline
  before any battle and two titles on a tie (antagonist objections 1–2). The
  pick runs once per rank, at the anchor.
- **Count.** As many rows as the user names. The table can start with the
  six baselines and grow a row at a time; mods can be shared across rows.
- **Code.** The pick (about 40 lines), the kill-source field, and the break
  event. A test: random counter states give exactly one stamp per rank, and
  only at the anchor.
- The hidden options have no allies, so no rank titles. Each gets one
  `secret` title from its finale.

**Hidden warlord and destroyer.**

- **Rules.** Nothing shows until the whole condition is met: no tracker,
  counter, log line or hint. The conditions read accumulation only: no
  `statMax` on a counter a visible route moves, no time bar, no power bar, no
  `once` or `fightLimit` source. So they stay meetable at any strength. A lint
  checks this.
- **Shape.** Two hidden `Connection`s (`revealWhen` the condition) from
  floor 11's camp area, each to a camp with a join quest like the visible
  ones. The hidden join quests do not require `statMax 0` on the visible
  stamps, since they are taken from a side. They can be taken at any point
  after floor 11. Floors already `done` stay done.
- **Difficulty** (ruling): very difficult, tuned at build time. Difficult
  here means a large N on an endless source, never a bar a strong or weak
  player cannot reach.
- **Warlord trigger:** 5 floors done, and N turns present on floors already
  done (`war:held_turns`). Turns there keep ticking after the break, so the
  source is endless, and it is time, not power.
- **Destroyer trigger:** N kills of each of the three rosters at the road
  spots. Each floor has one endless road spot where all three
  rosters spawn. The road spot also feeds the H2 gates, so N must sit well
  above a third of the gate kills, or routine grinding trips the secret.
- **What they change.**
  - Both: the base is the hold; soldiers are created there, and the faction
    soldiers are gone.
  - Warlord: all three rosters are hostile on floors not yet done. Route:
    the keep. Finale: all three leaderships.
  - Destroyer: mixed three-roster groups. Route: the depot. Finale: all
    three leaderships at once.
  - Kills alone still reach `need` on both (L5).
- Both stamp the band's clear.

| Floor | One idea (mechanism) | Boss / preparation |
|---|---|---|
| 11 | Pick a side: three join quests from the leaders, two hidden edges. One small battle (low `need`) teaches the counter. | none |
| 12 | Take a castle: a `fightLimit` stretch to its commander. `done` opens the faction base's plots and, on every path, building in the hold. | commander; scouting finds lower its escorts |
| 13 | Supply: `gather` and `job` sites fill the stock. Floor 14's gate reads a band material from an endless source (H2). | none |
| 14 | Scouting: explore gates; finds add to the next battle's `front`. | none |
| 15 | First full battle. Clear → rank 1 title. | commander, requires `broken` |
| 16 | Night: `daypart` encounter lines. Finds are cheaper at night and fights harder. | none |
| 17 | Siege: three walls, each a `fightLimit` spot, each drawing stock. | gate commander |
| 18 | Counterattack: a camp spot spawns waves; each wave won adds to `front`. | none |
| 19 | A duel with a champion (alone, unfleeable, the `SpotDare` shape) plus sabotage finds. Clear → rank 2 title. | champion |
| 20 | Finale, one per side: the other sides' leaders. Preparation flags remove escorts. | the Shōgun; the strategist and the figurehead; the triumvirate |

**Hours.**

- **H1 The loop that stays.** Floors that are done keep their gather yields
  and garrisons. The road spots stay endless. The base keeps its gold sink.
  Five sides over five runs.
- **H2 The gate paid inside.** Gates read `kills:tag:soldier` (a tag on every
  roster) or a band material from an endless gather. Only boss rooms and the
  siege walls use `fightLimit`.
- **H4 What it feeds.** Supply consumes food (cooking), arms (smithing) and
  salves (alchemy). Captured gear feeds smithing parts.
- **H5 Novelty.** 9 roster species plus the commanders and the champion.
- **H6 Re-climb.** A different side each run, with that side's base and
  leaders; the hold persists for the hidden paths.
- **H7 Idle form.** Gathers and jobs at a done floor are safe to leave; base
  jobs run on the world clock. Hunts at the front are not safe. Offline gains
  are bounded by supply. `OfflineSummary` gains a line for turns advanced per
  floor.
- **H8 Systems.**
  - Arcane, divine and martial answer the boss roles.
  - Cooking feeds soldiers; smithing arms them; alchemy salves and wounded
    recovery.
  - Each supply type has at least three sources: a system, a drop, a shop.
    No gate names a system.
  - Mutagens: soldier bodies on the hidden paths, once worker creation and
    mutagens open. Psionics stays shut. Chapel pedestals are a later slice.

**Laws.**

- **L1.** Every edge two-way; hidden edges stay revealed once found.
- **L2.** `front` sources are endless (kills at endless spots, turns).
  `fightLimit` only on boss rooms and walls, each needed once.
- **L3.** A loss never lowers `front`; soldiers are wounded, never deleted; a
  supply raid costs a share of supply, only on a presence turn, never a
  path.
- **L5.** Zero soldiers still clears by kills, on every side and path.
- **L7.** Rosters name roles: the conquerors' asks for damage, the
  usurpers' for condition defence (bleeding, poison), the freedom fighters'
  for sustain; the depot strongroom asks for access. Condition defence
  and access have no system answer yet (ROLES.md), so this band waits on
  them.
- **COMPLETABILITY §7.** No fork at new game. Leaving a side happens in play
  (this answers demon-lord-army.md's "settle first" for this band).

**Overlaps.** Idea 1 has the same ending shape (one side, all sides, unite).
It is off-ladder; this band is on the ladder, so every side must clear it.
[plans/demon-lord-army.md](plans/demon-lord-army.md) has the same conquest
substrate.

**Build cost** (estimate, nothing measured): about 17 sessions for one
visible side, then about 1 session of data per further side, then about 2
more for the hidden paths.

1. Presence clock, the resolver and a test front on a band 2 floor. Stats
   only, no save change, on a branch (1.5).
2. `state.war`, troops, supply, the orders panel (v60) (1.5).
3. Structures for the faction base and the hold, and the hold's legacy
   ledger (3).
4. Floors 11–20 for one side, as the template (about 10, at band 1's rate of
   one session a floor).
5. Title pick and kill-source field, then John through floor 20 on default
   orders (1.5).
6. Hidden paths: the triggers and soldier creation (about 2, after worker
   creation exists).

**Objections and rulings.** From antagonist-design, 2026-10-29, verdict *fix
first, then bank*. No reachable terminal state found.

1. **Titles latched early.** The baseline title held before any battle, and a
   rank title latched at its third win whatever came after (confirmed with
   the live condition check). *Taken:* the `broken` anchors, the break
   event, and KO counters that stop at the anchor.
2. **A tie credited two modes,** so two titles held at once (confirmed).
   *Taken:* one mode per battle, ties kills > finds > soldiers.
3. **`war:*` keys failed two shipped lints:** finds may only write `flag:`
   keys, and condition keys must be known stats. *Taken:* the `flag:war:` /
   `war:` split and one `realStat` branch.
4. **The warlord trigger read a counter nothing produced** ("soldiers raised
   from the barracks", while the barracks only caps). *Taken:* turns present
   on done floors.
5. **A find picked the side,** silently, for whichever camp was explored
   first. *Taken:* a join quest and the accept stamp.
6. **Soldiers drifted into a second worker system** with their own upkeep;
   the prestige tier rule drifted from the settled one. *Taken:* soldiers are
   numbers with fed turns only; the settled tier-1 rule.
7. **Offline could burn the stock** when soldiers add 0 a turn, and raids
   were undefined while away. *Taken:* turns stop at net 0; raids only on
   presence turns.
8. **Code and cost.** Descent is not free (`towers.ts:130-132`); ten floors
   is about ten sessions, not two; the destroyer's N must clear the H2 gate
   kills; coined mode names replaced by kills, soldiers, finds. *Taken.*

Clean:
- invariant A: every side's closure is testable; kills alone clear with no
  soldiers, no gold and no supply; a knockout goes to a haven and the count
  stops; the hold door is open, because band 3 needs a prestige boon
- invariant C: no division, integers, presence never exceeds `totalTicks`
  even under bonus spending
- troll: no buy-sell loop; garrison ×2 is a rate; titles reset with the run
- secrecy: unmet `revealWhen` edges are invisible; `TitleDef.secret` exists

**Open questions.** None. Q1–Q11 are answered (Rulings, above).

### 3. The harbor band (posted 2026-10-29)

Band: band 4, floors 11–14 · Floors: 4 · Verdict: **Bank** (antagonist fixes
taken).

It waits on:
- the floor 11 swap (§1.5), with the stronghold flag carried through
  `prestigeNow` (objection 3)
- `SpotDef.preparation` (`escortsLost`, leader statuses), which is on branch
  `band2-floors` at a22c94a and **not on main**: it landed after PR #26
  merged, and `band3-machinery` lacks it too
- band 3 (floors 7–10) shipping, since floor 11 opens on floor 10's clear

**As posted (2026-10-29).** *"alright, floors 11-14 are an adventure floor,
but of the pirate variety. once floor 10 is cleared, and the player has done
the personal base siege previously (otherwise doing the siege prestiges
automatically), the player enters floor 11 and begins it at a harbor, where
they can talk to people and choose who to go with. for the time being, the
player can pick between merchants, pirates, privateers or the navy. then
floors 12 and 13 are sea battles and floor 14 is each group's "final
mission""*

Later the same day: *"privateers actively attack pirates, while the navy
escorts the convoy and protects it against monsters"*, and on the merchants:
*"meet the convoy and do social rolls/dialogue?"* (a question; answered in Rulings below).

**What the post changes.** §5.3 item 1 said the floor 11 swap happens at the
next prestige after the stronghold clear. Per this post, clearing the siege
**is** a prestige: the run that holds the wave ends there, and the next run's
floor 11 is the harbor. Not a one-liner: objections 2, 3 and 6.

**The place in one line.** The port takes 5% duty per landing and a fifth of
each prize: merchants pay the duty, the navy lives on it, pirates fence below
it, privateers pay the fifth to keep their letter. Merchants fund the navy,
the navy keeps the monsters off the convoys, pirates raid the convoys,
privateers hunt the pirates.

| Floor | One idea (mechanism) | Boss / preparation | Spots |
|---|---|---|---|
| 11 | The harbor. A quay (haven), four berths with a recruiter each, and a roadstead (open water with its own convoy). Accepting a berth's join quest picks the side for the run. Clear: `sea:crates:won` 8 and `fights:<roadstead>` 1 | none; the join quests are the deals | ~6 |
| 12 | Crossings. Ports are spots, the sea is edges: sailing into open water is a `forced` edge (a boarding), the way back is free. The side decides which lanes exist (`revealWhen` on the accept stamp): trade lanes, hidden coves, patrol lanes, hunting grounds. Route choice: long and weak, short and strong, hidden and cheap. Clear: `sea:crates:won` 40 and `fights:<the farthest water>` 1 | named ships sighted and sunk here are escorts missing on floor 14 | ~8 |
| 13 | The blockade. What was done in port (a pilot hired, a signal book bought) sets the approach (`ApproachSpec`: enemies surprised, or the player flat-footed). Clear: `sea:crates:won` 160 and `fights:<the blockade water>` 1 | more named ships; the approach | ~8 |
| 14 | The final mission. One `FloorDef`, four wings, one per side; each wing stamps `flag:sea:14:done`, which the floor `clear` reads | the side's boss with four escort slots, one per named ship | ~5 a wing |

**Sides.** One row each: `SeaSideDef { id; giver; joinQuest; prey: string[];
mission }`. A fifth side is a row. Pick = the join quest's accept stamp
(`flag:quest:<id>:accepted`); each side's content also reads `statMax 0` on
the other three sides' stamps; per run, as idea 2. Relations are a table read
by encounter `requires`: pirates prey on convoys; privateers prey on pirates;
the navy fights sea monsters; merchants fight whatever boards their convoy.
A taboo is absence from your table, never a penalty counter (counters cannot
be reset, L3).

| Side | Floor 14 mission | Weakened by 12–13 |
|---|---|---|
| Merchants | land the charter cargo past a closed port | harbor master bribed (a gold sink), escort hired, raiders sunk |
| Pirates | board the treasure galleon | named escorts sunk, a forged signal |
| Privateers | take the pirate king's flagship as a prize | his captains sunk or taken, the letter renewed |
| Navy | kill the sea beast that closes the lanes | its brood culled, a lure baited |

The privateer and navy missions changed with the user's later message: the
pirate king is now the privateers' quarry, and the navy's enemy is monsters.

**The loop that stays: the convoy table.** Each sea floor's open water runs a
schedule derived from the clock, not stored: convoy index =
`floor(totalTicks / 3600)`; 8 crates; 4 legs of 300 ticks. Each leg rolls its
threat: pirate raiders and sea monsters. Each side is one end of the flow,
with one formula per end:

| Side | Per leg | A kill subtracts | Credit |
|---|---|---|---|
| Merchants | crates lost = `clamp(threat − escort, 0, crates)`; the rest are sold at port | one boarder of either kind | crates sold |
| Navy | crates lost = `clamp(monsters − escort, 0, crates)` | one sea monster | crates kept |
| Pirates | crates seized = `clamp(raid − guard, 0, crates)` | one guard | crates seized |
| Privateers | crates recovered = `clamp(raid − pirate crew, 0, carried)` from the pirate ships on the lane, which carry what they seized | one pirate | crates recovered |

`escort` and `raid` are the same number, the battery rating, named for which
end of the flow the player is on. A crate credited **while present**
(`!isIdle` at the water spot, idea 2's definition, so a tick either banks
bonus time or counts, never both) adds to `sea:crates:won`.

**The battery** (user, 2026-10-29: any of three skills contributes):
`rating = volleys × hit + morale`, per leg, integers.
- The side's ship supplies the base: volleys 1, hit 1, morale 0. A player
  with no crafts still fires, so no system is required.
- **Smithing: how quickly and often the guns fire.** Cannons fitted in the
  hold (kept, never spent) and cannonballs (spent per leg) raise `volleys`.
- **Alchemy: how efficiently and hard the shots hit.** Powder charges (spent
  per leg) raise `hit`.
- **Cooking: morale.** Rations (spent per leg) raise `morale`, which adds to
  the rating; further indirect effects of morale are left for a later round.
- Salves are drunk in the boardings, as usual.
- **Combat: the fourth way in** (user, 2026-10-29). A player who uses none
  of the three crafting systems contributes by fighting: repelling
  boarders, boarding the enemy themselves, or joining any fight on the
  water. Every kill subtracts from the leg's threat (or guard, or pirate
  crew) per the side table, so kills and the battery add up to the same
  result. Kills alone clear every floor (the antagonist's check), so a pure
  combat character is a full build here, not a fallback.
- Example (merchants): threat [3, 3, 4, 4]. Base battery (rating 1) alone
  loses 2 + 2 + 3 + 3, clamped to all 8 crates. Two cannons and a cannonball
  per leg (volleys 3) with base powder (hit 1) and one ration (morale 1):
  rating 4, loses 0 + 0 + 0 + 0. Kills subtract threat on top.
- Offline legs fire the base battery plus whatever the hold still holds, at
  25% credit paid as cargo, never to `sea:crates:won`. This replaces the
  earlier rule "no hold burned means 0": the base battery now pays a small
  idle income, like an idle hunt, and the clears stay presence-only.

**Hours.**
- H1: the convoy table never empties; cleared water still runs every 3,600
  ticks.
- H2: one endless key, read by the clears (gates stay empty): floor 11
  `sea:crates:won` 8 (one convoy), 12: 40, 13: 160 (about 20 convoys, ~2 h of
  play). `sea:*` and the accept stamp are engine-written: two `realStat` lint
  branches.
- H3: named ships (`once`, optional) and the four missions' prep.
- H4: the cargo row sets the drop: rock salt, rough flour, wild honey
  (cooking); iron, copper, tin, bronze ingots (smithing); grain spirit,
  brimstone, pressed oil (alchemy). Sea monsters add their own parts.
- H5: four rosters × three tiers = 12 `MonsterDef`s, a sea-monster line, and
  4 bosses. No ship sheets on disk, so a ship is its crew on a deck: one new
  `SceneId`.
- H6: a re-climb picks another side: other lanes, another end of the flow,
  another enemy, another mission.
- H7: offline, legs resolve by formula (the battery, no kills) at 25%
  credit, paid as cargo and never to `sea:crates:won`, so a night away cannot
  pass a gate. The convoy is integers derived from `totalTicks`; it never
  enters `modFingerprint`.
- H8: hurdles ask damage (boarders, monsters) and sustain. Burning is damage
  over time for now (user, 2026-10-29), so it asks sustain only. Smithing,
  alchemy and cooking each raise the battery. Access fills nothing.
  Mutagens and psionics stay shut.

**Laws.**
- L1: a haven at every port; every `forced` edge has a free return.
- L2: the waters are endless; named ships are `once` and only ever remove
  escorts, so no clear reads them.
- L3: a knockout goes to the last port.
- L5: the unprepared mission boss is winnable; preparation only removes
  escorts or adds statuses (band 2's rule).
- L7: no hurdle names a system. Burning asks sustain (damage over time).

**Cost.** No save change for the harbor, crossings or convoys (`sea:*`
stats, accept stamps). Registries: `SEA_SIDES`, `CONVOYS`. Engine: the
convoy resolver, two `realStat` branches, the pending auto-prestige (and
`canPrestige` reading the stronghold clear), the floor 11 swap. Content:
about one floor's work per side (a wing of ~5 spots, 3 quests, 1 boss) plus
floors 11–13 shared.

**Parked from the brainstorms.** A player ship with classes and broadside
duels (needs a save bump and a ship stat block outside the fingerprint), and
banners as disguise items (`colors:*` tags read by `equippedTag`). Both
compose with this shape later.

**Objections and rulings.** From antagonist-design, 2026-10-29, verdict *fix
first*; no redesign needed. All taken.

1. **Floors 11–13 had no `clear`, and floor 11 had no water,** so the first
   counter had no source and the band sealed (`floorCleared` is false with no
   clear, `towers.ts:62`; the non-empty-clear lint, `content.test.ts:2091`).
   *Taken:* the roadstead on floor 11; clears 8 / 40 / 160 and
   `flag:sea:14:done`; gates empty. A crate clear names no spot, so floors
   11–14 need the spine lint's exemption (Q2).
2. **Auto-prestige is a silent no-op after a band pass** (confirmed by
   probe). `PRESTIGE_UNLOCK` reads the floor 6 warchief kill, and
   `pass_wilds` (on `band3-machinery`) skips floor 6 without writing it, so
   `prestigeNow` returns null and nothing is logged. *Taken:* `canPrestige`
   is also true when the stronghold clear holds.
3. **The stronghold flag would not survive prestige,** and two banded
   `FloorDef`s at index 11 fail the unique-index lint
   (`content.test.ts:2105`). `prestigeNow` copies `state.prestige` field by
   field (`prestige.ts:206-218`). *Taken, as waits on the swap card:*
   `prestigeNow` carries `legacy.stronghold`; the swap is one `FloorDef`
   whose area, landing and clear read the flag.
4. **The convoy formula covered one end of the flow; "present" was
   undefined.** An idle pirate would have seized crates for nothing, and a
   tick spent from the bonus bank would count twice. *Taken:* the per-side
   table (no hold burned, no crates, on every side) and present = `!isIdle`
   at the water spot.
5. **Condition defence has no system fill** (ROLES.md: 0 systems; the
   burning ward drops only from mutagens, shut in alpha). *Taken:* fire
   ships and bilge rot are sustain hurdles until the ROLES row fills, and the
   band waits on it like idea 2.
6. **An auto-prestige inside offline catch-up fires unseen** (confirmed: the
   clear at tick 5,487 of 18,000 reset the run, the other 17,913 ticks ran on
   the new run idle, the summary read nothing). *Taken:* the clear stamps the
   legacy flag and a pending marker; the prestige runs at the top of the next
   tick; catch-up stops on a pending prestige so the player sees the harvest
   (Q1).
7. **Wording and lints.** The other three sides' stamps read `statMax 0`, not
   each side's own; the accept stamp needs its own `realStat` branch beside
   `sea:*`. *Taken.*
8. **Identity (taste).** Salves are drunk in the boardings, so alchemy keeps
   its in-combat row. Shot makes smithing a consumable producer against its
   passive-gear row (Q3). Idea 2's fed soldiers and this fed escort share a
   shape; if both ship, bands 4 and 6 share a loop.

Clean: every `forced` boarding has a free return by construction (edges are
directional, never mirrored); hidden lanes cannot be routed through
(`findPath` walks visible edges); kills alone win crates with zero gold and
an empty hold, so the narrow build clears; crates conserve, integers only,
at most 80 convoys per 8 h catch-up; the festival's time jump pays nothing
(no "last seen"); an accept stamp cannot be doubled (`quests.ts:76`); cargo
is sold, never bought, so no harbor shop mints; every H4 material exists
except the battery's new items (cannons, cannonballs, powder charges).

**Open questions.** None.

**Rulings (user, 2026-10-29).**
- **Offline time after a siege clear** (Q1): catch-up stops at the clear,
  the harvest and review overlay show on return, and the rest of the
  offline time goes to the banked-time pool. Later waves against the base
  are §5.3 item 21.
- **The spine lint** (Q2): floors 11–13 need no exemption; each clear adds
  `fights:<a water spot>` 1, which the crates already require, so the spine
  rules keep running. Floor 14 is exempt (its clear is any one of four
  wings, stamped as a flag), with that reason written beside the exemption.
  Supersedes objection 1's "floors 11–14 need the exemption".
- **The battery** (Q3): *"the player can contribute with any of those three
  skills."* Alchemy: how efficiently and hard the shots hit. Smithing: how
  quickly and often the guns fire (better cannons and cannonballs). Rations:
  sailor morale, with indirect bonuses. Written up under the convoy table.
  Supersedes objection 4's "no hold burned, no crates" and objection 8's
  shot question.
- **Switching sides** (Q4): locked, one side per run, for now.
- **Burning** (Q5): damage over time for the time being, asking sustain.
  Keep it simple this round: no fire-ship special cases and no wait on
  condition defence. Supersedes objection 5's wait.
- **The merchants' role** (was Q6): approved as proposed. The other three
  each have an enemy; merchants own the convoy. They run it end to end:
  pack the hold, pick the route, defend their own cargo when it is boarded
  (pirates and monsters both), and sell at each port of call. The port sale
  is the dialogue: a speechcraft-driven negotiation (duty, buyer, price)
  that sets the **payout per crate**, never the crate count, so
  `sea:crates:won` still comes from delivery and no clear rests on one skill
  (L7). A failed negotiation costs price, not progress (L3). The checks are
  thresholds on speechcraft level against the deal, not dice, so a player
  can see why a deal went the way it did.

### 4. The desert band (posted 2026-10-29)

Band: band 5, floors 18–20 · Floors: 3 · Verdict: **Bank** (antagonist fixes
taken).

It waits on:
- open sky on tower floors: the Ascent region is `sheltered` on main; open
  sky (`AreaDef.sheltered`, `skyRegionOf`) is on the unpushed branch
  `moon-phase`
- a per-area climate pin: at the tower's pin a desert floor peaks at
  28.5 °C (0 hours a year at heat's 32 °C training line) and bottoms at
  −13.5 °C (1,287 hours a year at or below −5, so it trains cold). Terrain
  alone does not fix it; the area needs its own latitude
- the killing blow's damage type on each monster (shared with idea 2's
  kill-source field), for method drops

**As posted (2026-10-29).** *"the 18-20 band could be a desert theme with
the classic pyramids and obelisks. it should lead at floor 20 back towards a
harbor to move to floor 21-30, as all floor have this sort of soft
transition"*

**The place in one line.** A dead dynasty bills every piece carried out of
its tombs against the carrier; the port house at the delta licenses digs
for a fifth and buys the rest; diggers pay at the tomb door, in the judge's
strength.

| Floor | One idea (mechanism) | Boss / preparation | Spots |
|---|---|---|---|
| 18 | The Necropolis Road. Open desert between obelisks. Obelisks are havens on open sky; reading one is a find that adds to `flag:chart` (five obelisks, three reads matter). Dens of desert monsters along the road. Clear: `boss:<forecourt>` 1 | the forecourt guardian, repeatable; no preparation | ~8 |
| 19 | The Pyramid: the Weighing. Grave goods are optional finds in a treasury off the burial chamber, each adding to `flag:tomb:taken`. The judge, Sabaket, the Weigher at the Door, waits at the door; each piece taken raises its level by a share of the player's character level, up to a ceiling. The chamber-to-door edge is `forced`. Clear: `boss:<door>` 1 | restraint is the preparation: take nothing, fight the base judge; take everything, fight it near your own level (or at the ceiling) and leave rich | ~8 |
| 20 | The Delta Port, the seam to the island. Idea 3's quay and roadstead pair, no convoy table: a quay (haven), a broker who buys dig goods, warehouses (`job`, `gather`), a notice wall naming floor 21's camps, and a roadstead (`fightLimit` 1) behind a `forced` edge. The roadstead fight is the crossing. Clear: `fights:<roadstead>` 1 | three obelisk reads (`flag:chart` ≥ 3) leave the roadstead's crew surprised (`ApproachSpec`) | ~5 |

Gates: floor 19 `kills:tag:desert` 60, floor 20 `kills:tag:desert` 150
(band 2's `kills:tag:goblin` precedent). The tag needs a `MONSTER_TAGS`
entry and its text. Every clear names a spot, so the spine lint runs on all
three floors. Floor 20's harbor wing joins the spine twice or leaves by a
one-way edge (wing-loop lint).

**The Weighing.**
- **The tomb seals when the judge falls.** Each grave-good find carries
  `requires: [{ type: 'statMax', key: 'boss:<door>', value: 0 }]`, so
  goods can only be taken before the clear, and `taken` always prices the
  judge the clear is paid with. Leaving by the ladder does not dodge it:
  `taken` stays for the run, and floor 19 still clears only at the door.
- **Taking is going to the treasury.** There is no "take" verb: finds fire
  as a spot is explored. The goods sit in their own spot off the chamber,
  so exploring the chamber takes nothing; standing in the treasury and
  exploring it, idle or offline included, takes them all (ruled, Q1).
- **The judge's level (user, 2026-10-30).** *"It should increase the level
  bonus to the judge in relation to the player character's level/attribute
  total, up to a certain ceiling. If the player is too strong, the judge
  cannot match the player, if the player is too weak, being greedy should
  punish them on the first attempt."*
  - Read at spawn, with k = `flag:tomb:taken`, P = character level
    (`state.level`), B = the judge's base level:
    **level = min(C, B + max(k, round(k × r × P)))**.
  - Dials: r, the share of the character level each piece adds; C, the
    ceiling. The `max(k, …)` floor makes every piece cost at least one
    level, so a weak player's greed always shows. The total is rounded once
    rather than per piece, so a level gained never jumps the judge by k.
  - **Keep 6r < 1.** Then each level the player gains raises a full-greed
    judge by 6r < 1, so levelling always closes the gap: greed bites
    hardest on the first attempt, and every rematch is easier than the last.
  - P is the character level, not an attribute total: equipment can be
    swapped mid-fight (`equipItem` has no fight guard, `equipment.ts:90`),
    so a total that counts gear could be stripped before the door and worn
    again inside the fight. The character level only rises within a run.
  - **Example, B = 30, r = 0.1, C = 45**, six pieces taken: P = 20 fights
    level 42 (22 above); P = 30 fights 45 (15 above, at the ceiling);
    P = 40 fights 45 (5 above); P = 50 out-levels the ceiling and greed is
    free. Three pieces at P = 30: level 39. The loot is roughly 6 × 80–140
    gold and twelve ingots, resin or linen.
  - Scale check: floor 1's boss is level 4 and band 1 ends near character
    level 5 (`levels.data.ts`), and `levelGapXpMult` compares the two
    levels directly, so P and monster levels share one scale.
  - **C stays at or under the top of band 5's monster levels.** A greedy
    judge pays full kill XP (`levelGapXpMult` gives 1 at or above the
    player's level) and is repeatable, so a ceiling above the band would
    make the door the best XP farm on the floor.
  - The treasury's description states the rule in one plain line (each
    piece taken raises the judge); the number shows only in the fight.
- **One row.** `{ monsterId: judge; boss: true; level: [B, B]; levelRise:
  { stat: 'flag:tomb:taken', share: r, ceiling: C } }`. `boss: true`
  latches `boss:<door>` on every kill and stays repeatable. With no
  `requires`, the clear-table lint finds the row at every sampled value.
- It is band 1 floor 3's rule reversed: there, what you find makes the boss
  weaker; here, what you take makes it stronger.

**The broker** buys at the global sell price (`shop.lines: []`); "posted
rates" is the list the sell UI already shows. A premium above the global
price would mint against the no-arbitrage floor (`resaleCeiling` reads the
global formula), since rock salt is sold elsewhere.

**The loop that stays: method drops.** A drop row may require the killing
blow's damage type (`DropEntry.killedBy?: DamageType[]`; damage over time
counts, via `StatusDef.element`). Gates count every kill, so any method
clears; the method only picks the loot.
- Engine: `MonsterInstance.lastHit?: DamageType`, set beside each HP
  decrement (about 21 sites; `monsterSlice` is pure and used for previews,
  so not there). Rows whose `killedBy` does not match are filtered out
  **before** the mercy pick, or the drought ledger banks misses on sword
  kills and pays out on the next fire kill (PITFALLS §7). Budget 30–40
  lines, shared with idea 2.
- Example: mummy `{ rolls: 2, entries: [bone_ash w6 killedBy heat,
  bone_dust w6 killedBy bludgeoning, nothing w18] }`. 100 kills by fire ≈ 40
  bone ash, no dust. Mummies take −50% from heat, so the keyed method is
  also the fast one, and the bestiary shows the plan.
- The sand colossus resists heat (0.9), so its row wants bludgeoning.
- `bone_ash` and `bone_dust` have consumers and no source today; this band
  is their source.

**Heat.** Trains, never taxes. Weather is not a modifier source (WEATHER.md),
so a desert floor makes no stat worse. With the area's own pin, heat trains
`heat_resistance` on open sky; spots tagged `heat` train it under roof too.
Its only uses here: an optional skill door (`{type: 'skill', id:
'heat_resistance', level: 15}`: 483 XP, about 80 real minutes of continuous
exposure, 54 with a heat-tagged spot) to a side tomb, and mitigation
against monsters that deal heat damage. No thirst, no heat meter (either
would join `modFingerprint`).

**Hours.**
- H1: method drops, two or three methods per den, on every visit after the
  clear.
- H2: `kills:tag:desert`, endless and cumulative: 150 kills in all, about
  15–20 minutes of fights by the pace model (median fight 27–69 ticks); the
  rest comes from the dens and the tombs.
- H3: the side tomb behind the heat door; the grave goods; the obelisks
  past the three that matter.
- H4: cooking (rock salt, rough flour, wild honey, wild onion, river fish,
  bird egg feed shipped dishes), smithing (copper and tin ore to bronze;
  bone dust), alchemy (bone ash, brimstone, green vitriol, fixing salt,
  quicksilver, which has no live source today).
- H5: about 46 desert and Egypt sheets on disk: mummies, scarabs, sphinxes,
  cobras, scorpions, sand snakes, a sand colossus, two Anubis bosses, a
  Crocopharaoh, an obelisk.
- H6: run 2 brings the other half of the systems, so other methods and
  other drops; prestige resets stats and finds, so the Weighing re-arms.
- H7: an idle hunt uses the equipped method only; nothing new accrues
  offline beyond an ordinary hunt. No timers, so no bank or offline loop.
- H8: heat from arcane fire, divine Holy Fire, alchemy flasks; bludgeoning
  from smithing's maces and martial; cooking and alchemy consume the drops.
  Cobra and scorpion poison is damage over time and asks sustain
  (condition defence has no system fill).

**Laws.**
- L1: havens at the obelisks and the quay; the ladder works from any spot,
  so the forced chamber edge is pressure, not a trap; either way the clear
  is paid at the door.
- L2: grave goods and obelisk reads are `once` and optional; no clear or gate
  reads them. The forecourt guardian and the judge are repeatable; the
  roadstead's `fightLimit` 1 holds the 1 its clear needs.
- L3: a knockout goes to the last obelisk or the quay, goods kept.
- L4: an obelisk read is a find, not a puzzle.
- L5: the judge at +0 is winnable without preparation.
- L7: hurdles ask damage and sustain only. ROLES.md counts sustain filled
  by 2 of the 4 systems open in run 1 today; the cover rule needs more by
  band 5. Ladder-wide, as ideas 2–3.

**Cost.** No save change. Content: areas with their own climate pin, ~21
spots, a desert roster with tag `desert`, one judge row with `levelRise`,
method-drop rows. Engine: `killedBy` and `lastHit` (30–40 lines, shared
with idea 2); `SpotEncounter.levelRise?: { stat: string; share: number;
ceiling: number }`, applied in `spawnMonster` after the level roll (not to
`override` spawns) through one helper `encounterLevel(state, e)` that the
bestiary's level range also reads, plus a validation rule (share > 0,
ceiling ≥ `level[1]`); about 20 lines. The first live use of `Connection.forced`: author only the
chamber-to-door edge with `forced: true` and let the mirror be the free way
in, because `buildAdjacency` dedupes by destination and drops a declared
forced edge when the other spot is listed first.

**Parked from the brainstorms.** The Omen (one of three judges per run,
named by the lit obelisk; a variant-boss lever for re-climbs), the
Offering (gifts of crafted goods remove the judge's escorts; needs
`SpotDef.preparation`, which is not on main), a variety tithe (keepers
take materials for points), and an obelisk clock (dens open by game hour).

**Objections and rulings.** From antagonist-design, 2026-10-30, verdict *fix
first*; no redesign. All taken; the entry above already reads fixed.

1. **The Weighing was bankable** (confirmed by probe): take the goods after
   the clear, or leave by the ladder, which works from any spot on a banded
   floor (`towers.ts:37-47, 106-125`). *Taken:* the tomb seals when the judge
   falls; L1 rewritten.
2. **`slain:` cannot latch on a repeatable judge** (`slain:` bumps only on a
   `once` entry). *Taken:* clear = `boss:<door>`.
3. **Seven bounded rows leave `taken = 7` uncovered** (clear-table lint,
   confirmed). *Taken:* row 6 is `stat ≥ 6` alone. Superseded 2026-10-30
   by the Q3 ruling: one row with `levelRise`, no `requires`.
4. **`Connection.forced` is order-dependent and has no live precedent**
   (confirmed). *Taken:* author one edge; listed in Cost.
5. **The broker's "posted rates" were a mint or flavour.** *Taken:* global
   sell price, no shop lines.
6. **The heat-door time was off by about two** and terrain alone gives a
   desert that trains cold. *Taken:* 80 minutes; the area needs its own pin.
7. **`killedBy` is more than 15 lines,** and unmatched rows must leave the
   mercy pick. *Taken.*
8. **The seam data model** (see §1.5, the soft transitions). *Taken there.*
Minor, taken: the H2 count is cumulative; the `desert` tag needs a
`MONSTER_TAGS` entry; the roadstead needs `fightLimit` 1; the +6 step is
cheap for the loot (Q3; superseded, the rise now scales with the player).

Clean: no terminal state; an empty encounter table at a forced edge is free
passage, never a strand; prestige re-arms the floor; band passes read and
write no band 5 counter, and nothing above band 5 reads one; `kills:tag:`
counts damage-over-time kills; row picks are deterministic, so no reset
scumming.

**Rulings (user, 2026-10-30).**

1. **Grave goods and idle play.** Approved: the treasury is its own spot,
   so the choice is walking in; no confirm dialog.
2. **The judge.** The Boss Anubis, God of Death sheet, *"except a
   different name for this game, as all other gods have their own names"*.
   The Goddess Anubis and the Crocopharaoh stay kept for the parked Omen.
   Named in item 4.
3. **The step per grave good.** Scales with the player's character level,
   up to a ceiling: the formula under the Weighing, above.
4. **The judge's name: Sabaket, the Weigher at the Door** (user,
   2026-10-30). The other gods have invented names with a language flavour
   per pantheon (Xima and Cuixtli for the Yolixoch, Kenese Paea and
   Tuigamala for the Foai) and an epithet; *sab* is Egyptian for jackal.
   The name lives in the monster's text. A `DeityDef` (a desert pantheon a
   player can pray to) is a later divine step, not part of this band.
5. **The judge's base level** (user, 2026-10-30, after the build). Built
   at base 33, ceiling 45, share 0.1. Kept *"for now"*; the user expects
   it may be low. The first dial to read when John reaches floor 19.

**Open questions.** None.

---

## 5. Questions

### 5.1 Answered (user, 2026-10-22)

1. **Band size.** One floor, three, or ten as a "megastructure". Default 3.
2. **"A few hours".** 2–4 hours hands-on: discovery, reading, picking spots
   to explore and fight at, planning, crafting.
3. **One place per band.** Usually; always linked by a theme at the least.
4. **Tower length.** Open-ended, in theory and as a goal.
5. **Team per post.** Yes.
6. **Grammar on the ladder.** *"A mediocre player can 'win' if they spend
   enough time grinding, mastery of systems is required for optional content
   clearing."* No floor on the ladder requires a generative grammar; every
   critical-path fight is winnable by grinding. Mastery gates optional
   content: off-ladder floors, side stacks, chase items, hidden rooms.
   COMPLETABILITY.md §6 revised to match.
7. **Core systems are required (2026-10-23).** *"I have discarded the notion
   that the player can grind it out without touching subsystems, there will
   be requirements to learn how to use them to some degree, optimal play will
   simply accelerate the player and their experience. Not every system will
   be required, but the player will have to touch and involve themselves with
   roughly half of the core systems (magic, martial, psionics, cooking,
   smithing, mutagens, possibly one or two others), but it'll be up to them
   which ones they pick and focus on."* Divine magic and alchemy are also
   core: eight systems. *"The idea is that using about half those systems
   should cover enough of the game's hurdles to progress,"* which asks for
   each system to be a viable build (alchemy against martial, mutagens or
   arcane; cooking, miracles and smithing as a build of their own). Narrows
   Q6: grinding wins inside the picked systems. COMPLETABILITY.md §6a holds
   the rule, the cover arithmetic and its open questions.

### 5.2 Open

None. Parked by the user, to be decided later:
- worker creation (§5.3 item 8), a later part of base building
- the theme of floor 17 (§5.3 item 5; 11–14 became idea 3 and 18–20
  idea 4)

### 5.3 Answered (user, 2026-10-29, the ladder)

1. **The required prestige.** The next prestige after the stronghold clear.
2. **The stronghold.** *"You take it, spruce it up a little, then the player
   has to defend against a monster wave."* Before the wave triggers, the
   player creates some workers as part of the tutorial.
3. **One base.** *"Once the player stronghold is unlocked, it remains
   unlocked on all subsequent prestiges."*
4. **The para-floor's output.** Materials only, for now.
5. **Themes.** Floors 11–14, 17 and 18–20 are undefined; they come later.
6. **The Vermin Festival.**
   - The player wakes in a dark room with no equipment but a simple weapon
     of their preferred type (from skill level and usage).
   - Nine other enemies, *"decently strong but manageable"*. When only the
     player remains, the door opens.
   - The next room holds 99 more survivors, much stronger. Nobody fights
     yet: everyone gets 10 in-game days to prepare, in a small hub like the
     Foot of the Ascent but with limited resources.
   - When the player is ready, or the 10 days pass, they move to floor 16.
     Entering early is a time jump. The battle royale begins.
   - Defeat ejects the player out of the floors; floors 15 and 16 lock for
     some time or until the prestige.
   - A win rewards powerful equipment.
   - The arithmetic is the Gu ritual's: ten rooms of ten, one survivor each,
     then one of a hundred.
   - Defeat here is an exception to the defeat rule (every knockout
     retreats to the last haven): the player lands outside the tower.
7. **Idea 2's base ruling** is dropped. It becomes access to the factions'
   war room.

Round 2, answering the questions kept in §5.4:

8. **Worker creation** (§5.4 Q1): a later part of base building.
9. **The hold door** (Q2): moves to floor 11. Saves that already opened the
   hold lose access until they clear the stronghold.
10. **Workers in the wave** (Q3): *"Workers help in various ways, depending
    on their own skills."*
11. **Gear held at the door, issued weapon** (Q4): approved.
12. **Losing in the dark room** (Q5): approved, same as losing the royale.
13. **The royale's shape** (Q6): *"This is the one place where I think a
    free movement, isometric 2.5d system could be useful,"* so the player
    and enemies move around the field and fight each other, with the fights
    in the normal side view. Read as: an isometric movement layer for floor
    16 only; an engagement on it drops into the existing battle stage.
14. **The others prepare too** (Q7): yes. A hidden title: enter floor 16
    within 12 in-game hours of leaving the dark room, then win. Secret
    content rules apply (nothing shows until met).
15. **The clock** (Q8): floors 15–16 run on their own clock, because the
    band is cut off from the other floors and outside the tower. There is
    no simulation of the skipped time.
16. **The lockout** (Q9): approved, 3 in-game days or the next prestige.
17. **Reruns** (Q10): approved, and the player can attempt the festival
    again for no reward. The sole exception: *"if the player somehow
    manages to do it over and over again, like 100 festivals in a single
    run."*

Round 3:

18. **Who moves in the royale.** *"It's not entirely idle, as the player
    has to move a good bit to gain resources before the stronghold."* The
    player sets a strategy, or a set of strategies, and lets the whole
    thing run on its own, and can also move the character directly at any
    time. Both modes are first-class: a strategy set alone must be able to
    win, so the critical path never needs hands on the keys.
19. **Being away during the festival.** The festival clock advances only
    while the game is open; offline catch-up skips floors 15–16. Time away
    while inside the festival goes into the banked-time pool
    ([NAVIGATION.md](NAVIGATION.md): banked 1:1, capped at 8 hours) instead
    of being simulated.
20. **The hundred-festival reward.** Not yet decided; the user will set it
    later. Set in item 23.

Round 4 (with idea 3's rulings):

21. **Later waves against the base.** After the stronghold, the player is
    told when another wave threatens the base. A later wave never triggers
    a prestige, and the player starts it when they choose. Because the
    player starts it, a later wave never begins during offline catch-up.
22. **A later wave left unstarted.** *"You gain nothing, and you lose
    nothing."* The warning stays and the base keeps producing; no decay,
    no reward for waiting.
23. **The hundred-festival reward.** A consumable. Using it offers one of:
    - a permanent bonus that persists through prestige
    - a special technique of the player's choice, picked from three offered
    - a piece of equipment that exceeds the normal festival reward

    Code facts: `prestigeNow` keeps only an explicit field list (count,
    points, purchases, peaks, cookbook, last harvest, review flag), so the
    permanent bonus needs a new legacy field, and as a new modifier source
    it must join `modFingerprint` or the stats cache serves stale numbers.
    Learned techniques are run state today and reset at prestige. Martial
    is shut in alpha outside the floor 2 tutor, so the technique option
    assumes martial is open by floor 16. Secret-content rules hold: no
    counter or hint until the hundredth win.
24. **The reward's details** (answers to the four questions asked on item
    23):
    - **Across prestige.** *"Normally consumables don't carry over."* This
      one is stored in the player's stronghold and is not lost. Since the
      stronghold stays unlocked across prestiges (item 3), its store is a
      legacy field: a stronghold stash in `state.prestige`, copied by
      `prestigeNow`, holding only items marked to keep. Every other
      consumable still resets with the run.
    - **The equipment piece persists too** (user, same day): it is kept in
      the stronghold stash. Read as: at prestige it returns to the stash
      from wherever it is (worn or carried), and the next run takes it out
      again.
    - **The technique persists** through prestige: a legacy list of
      festival techniques, so all three options are permanent.
    - **Repeats.** One consumable per 100 festival wins in a run (200 earns
      two); the count restarts each run. Permanent bonuses stack, with a
      cap held as a dial.
    - **The three techniques** are drawn from a small pool of festival
      techniques, seeded per award; the pool's contents come later.
25. **The ladder inside the Vermin Festival** (user, 2026-10-30; found
    reviewing idea 4's seams). Floors 15–16 have to be banded rungs (the
    index lint), and `climbTo` works from any spot on a banded floor (it
    refuses only during a forced fight), so a player could climb out of
    the dark room or the prep hub between fights. Ruled: climbing out of
    floors 15–16 before the royale ends counts as a loss, with the same
    ejection and lock as a defeat (items 6, 16). The ladder stays open
    there; leaving is the forfeit.
26. **What the door holds, and how it comes back** (user, 2026-10-30,
    after the build). The door also holds flasks and provisions: food and
    potions, every consumable that is not a card (cards are read, not
    carried into a fight). On the way back, *"the stash should be returned
    to the player on exiting the floors in their inventory or reequipped
    when slots are empty"*: each held piece goes back into its slot if the
    slot is empty, otherwise into the pack, so a find worn at the end stays
    on. Held flasks and provisions are added to whatever the attempt left
    (the stores' rations are kept). Read as the door's hold; the stronghold
    stash (item 24) is asked separately.

### 5.4 Asked in round 2 (kept for the record)

The defaults that round 2 asked about; the rulings are §5.3 items 8–17.

1. **Worker creation in the stronghold tutorial.** No worker code exists
   (no `worker` anywhere in `src/core`), and base building's settled recipe
   makes workers from mutagens + alchemy + divine, which a narrow build may
   not have picked (mutagens are also shut in alpha). *Default:* the
   tutorial's first workers come from a plain recipe any build can pay
   (gold and floor materials); the mutagen/alchemy/divine route makes
   better workers later.
2. **The prestige-1 hold door.** The hold opens at prestige 1 today, which
   band 2 reaches at floor 6. With one base that is the stronghold,
   *default:* the Foot door goes; there is no base between floor 6 and
   floor 11 on a first climb. Saves that already opened the hold keep it
   (stamped as the stronghold unlocked).
3. **The wave.** *Default:* a fixed count of monsters in rounds; the
   workers and fixes the player made shave rounds or escorts, the way band
   2's sabotages do (`SpotDef.preparation`). Losing it is an ordinary
   knockout: the player retries the wave, the fixes stay.
4. **Gear in the Vermin Festival.** *Default:* everything equipped and
   carried is held at the door and returned when the player leaves floor
   16, won or lost. The issued weapon is the weapon type with the highest
   skill, ties broken by kills with it, at a plain grade.
5. **Losing in the dark room (floor 15's first fight).** *Default:* the
   same as losing the royale: ejected, both floors locked.
6. **The royale's shape.** The combat engine fights one target and a small
   squad (escorts), not 99 bodies at once. *Default:* the field is a
   counter. It thins by itself every tick (the others kill each other) and
   the player fights a chain of encounters drawn from it, stronger as it
   shrinks; the last encounter is the strongest survivor. This coarsens for
   offline as a rate.
7. **The others prepare too.** *Default:* the 99 grow stronger over the 10
   days on a fixed curve, so entering early trades the player's prep for a
   weaker field. The time jump spends the rest of the curve, so entering
   early does not freeze them.
8. **The time jump.** The clock is `state.totalTicks` (clock.ts), 14,400
   ticks a day, so 10 days is 4 real hours of ticks. *Default:* a jump adds
   the skipped ticks to the clock without simulating them; anything that
   runs on elapsed ticks (buffs, cooking timers, upkeep) is checked for
   what a jump does to it before this is built.
9. **The lockout.** *Default:* 3 in-game days (72 real minutes) or the next
   prestige, whichever comes first. Floors 15–16 are on the critical path,
   so the lock must always expire; COMPLETABILITY's no-terminal-state rule
   is met by the timer.
10. **After a win.** *Default:* the reward is once per run; floor 16 reads
    cleared, the hub stays visitable, and a new run fights the festival
    again.
