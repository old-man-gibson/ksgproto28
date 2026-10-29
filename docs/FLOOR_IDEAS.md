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
floor, three (the default), or about ten as a megastructure (§5.1). The tower
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

---

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
Floors: one map, about 10 spots · Verdict: **Bank**. It waits on band 3
([plans/bands-2-3.md](plans/bands-2-3.md) build order step 6: M3 key boon,
M4, M5, the direction floors) and on goblin gods 4 and 5. The escape streak
can be built and tested on a band 2 spot before either.

**As posted.** *"a subfloor to floors 4-6. can only be accessed on the
forest-facing section of band 3 (floors 7-10) by fighting a goblin and
escaping the fight 5 times in a row. this unlocks an exploration activity
that lets the player access the goblin five moons festival, where five
tribes, each aligned with one of the goblin gods, are vying for who gets to be
the new head tribe. the player can either align with one of the goblin tribes
as a mercenary, fight them all, or become a mediator to help them unite as
one. each of those endings should set a flag that can become relevant later
on"*

**The place in one line.** The thief tribe hosts the Moot on neutral ground
and takes a tenth of every wager and contract. The other four tribes pay it,
and whichever tribe takes the head fire levies the city's outlying farms. The
seat is empty because the player killed the warchief on floor 6.

**The procedure: the Count.** This is band 1's shape (§1.3 finding 5): an
institution running a procedure, and the player's preparation is reading it.
The rule is written at the Moot gate:

- Five moons, one per tribe. "Moon" is the goblin count-word for one tribe's
  turn at the head fire. The world has no moon
  ([plans/blueprint-weaponsmithing.md](plans/blueprint-weaponsmithing.md),
  `night_anneal`), so no sky object is added.
- Each tribe has a ground, a champion and a speaker. The champion is a staged
  fight with `fightLimit` 1; the speaker gives a terms quest.
- When one tribe holds three marks, it takes the head fire. That reading is
  **Hired**.
- When an outsider beats all five champions, the fire goes out. That reading
  is **Ash**.
- When each of the five tribes holds one mark, the Long Table is seated. That
  reading is **Table**.

Marks are read from state; they are not a counter of their own. The
conditions are order-free:

- Hired for T requires T's contract quest turned in. The contract's
  objectives are three rival `slain:<ground>:<champion>` keys.
- Ash requires all five `slain:` keys, plus `statMax` 0 on every contract's
  accepted stamp.
- A tribe's terms quest requires `statMax` 0 on that tribe's champion
  `slain:` key. A tribe whose champion fell gives no terms this run, and the
  Count says so.

New code: `acceptQuest` stamps `flag:quest:<id>:accepted` (generic, about
3 lines). Today it writes no stat, so "took a contract" cannot be read.

| Tribe | God | At the Moot | Role it asks for |
|---|---|---|---|
| Fire | `goblin_fire` | pyre trial; the ground burns. The warchief's tribe, now leaderless | condition defence (burning) |
| Mud | `goblin_mud` | mire trial; the champion fights with healers | damage (outpace the heals) |
| Hunt | `goblin_hunt` | the drive; the champion fights with a rat, bird and worm swarm | sustain |
| Thief | thievery (planned 4th, unshipped) | hosts the Moot and keeps the Count; strongroom behind an `ExploreGate` | access |
| Witch | witch magic (planned 5th, unshipped) | hex trial; the champion curses | condition defence (curse) |

**The way in: five escapes.** The thief tribe hosts, so it gates the way in.
Its god's creed prizes the one who gets away. Its wardens watch the forest
road and admit anyone who has walked away from a goblin fight alive five
times running.

- Data: `SpotDef.escape?: { tag: 'goblin'; minTicks: 30; minTaken: 0.3;
  streak: 5; opens: 'flag:fest_open' }`, on one spot of the forest-facing
  direction. `minTicks` and `minTaken` are dials, set at build time against
  measured band 3 goblin fights. The test: John meets the bar in an ordinary
  fight without unequipping.
- What counts: the player walks away (travel, caravan, activity switch,
  climb) from a live, non-forced fight. The fight must be at least
  `minTicks` old, have a living enemy with the tag, and have dealt damage of
  at least 30% of max HP, summed from `state.fight.incoming`. Because it is a
  sum, a potion drunk mid-fight does not refund it. Walking off instantly does
  not count. The damage bar is what stops free clicks; `minTicks` is a small
  floor.
- Feedback: every walk-away at the spot writes a log line, "the wardens mark
  your going: 3 of 5" or "the wardens do not count that". Without it, a walk
  below the bar is silent.
- Where the hook goes: at the decision points (`locations.ts:49`, `:345`,
  `actions.ts:95`, `towers.ts:122`), not inside `abandonCombat`. The
  condition-fatal path (`actions.ts:687`) calls `abandonCombat` without
  `endFight`, so a hook there would count a knockout as an escape.
- What breaks it: a fight at that spot that ends `won` or `knocked_out` sets
  the streak to 0. A walk below the bar neither counts nor breaks it.
- Stored as `stats['escape:streak:goblin']`. At 5 it latches
  `flag:fest_open`, which never re-locks.
- After the latch: a hidden `Connection` (`revealWhen` the latch) opens to a
  new spot, the wardens' road. Its explore activity is the "exploration
  activity" of the post. Searching it to 100% reveals the edge to the
  off-ladder Moot map. Every edge is two-way. `explore` activities take no
  `requires` (types.ts:4295), so the gate is on the edge, not the activity.
- Hint: a bestiary fact on that goblin at 3 kills, plus one line from a
  castle NPC. Without them the way in cannot be found.
- Cost: no save change, since `stats` is an open map. About 40 lines, plus a
  lint that an escape spot is never `forced` and no `Connection.forced` leads
  into it (precedent: `tests/content.test.ts:318-345`).

| Path | The player | Climax (forced, `once`) | Flag | Read later by (proposal, off-ladder only) |
|---|---|---|---|---|
| Hired (tribe T) | takes T's contract and beats three rival champions in T's name | the fourth rival champion with two escorts, level −1 per rival already beaten (the floor 6 sabotage pattern) | `flag:fest_end_hired` + `flag:fest_patron_<T>` | T's god met (`meetDeity`), T's shop lines, T's champion teaches goblin techniques |
| Ash | takes no contract and beats all five champions | a ring of all five tribes' rank-and-file | `flag:fest_end_ash` | no goblin trade at the Moot or the castle; the levy grounds (H1) |
| Table | delivers five terms quests, one per speaker, each paying one tribe's price | forced fight against the dissenters, level −2 per consent | `flag:fest_end_table` | a goblin quarter at the castle, a five-tribe shop, all five gods met |

- The five Hired variants are five rows `{ tribe, god, champion, rewards }`
  on one template.
- Commitment happens on the climax **win**, not on reaching it.
  - A find reveals the `path` to the climax spot. A find cannot start a
    fight (`SpotFind` payloads, types.ts:4317-4360).
  - The ending is the climax kill, `slain:<ring>:<boss>`. Its `flag:fest_end_*`
    is stamped by a find on the ring that `requires` that kill.
  - Each climax encounter `requires` `statMax` 0 on the other two climax
    kills, so the first win shuts the other two for the run.
  - A player who reaches a climax and keeps losing holds no ending.
- Readers add content off the ladder only: the Moot, the castle quarter,
  shops, gods and techniques. None changes a ladder floor's encounter table
  (L7).
- The Moot requires nothing about floor 6. With a band 2 pass the warchief
  is alive in that run, and the vacancy is lore.

**Hours.**

- **H1 The loop that stays.**
  - Hired: four rival border grounds, each dropping a different material
    (the pick-a-den loop). The patron's quartermaster sells for gold.
  - Ash: endless levy grounds per tribe, level stepped by tribes beaten (the
    M5 table reused).
  - Table: five `gather` activities feeding Moot benches (a cooking bench
    for the feast, an alchemy bench for the poultice).
- **H4 What it feeds.**
  - Champion trophies feed smithing parts.
  - Terms quests consume cooking, alchemy and smithing output.
  - Patron gods become prayable (`meetDeity`, which has no caller today).
  - The festival is the first use of the goblin pantheon by the player.
- **H5 Novelty.** Five champions plus tribal rank-and-file. The witch and
  thief tribes add species of their own.
- **H6 Re-climb.** Run flags reset at prestige, so every run picks an ending
  again. A carried record (see the questions below) skips the streak on
  later runs.
- **H7 Idle form.**
  - Hired: a camp-watch `job` that is safe to leave running.
  - Table: the `gather` activities.
  - Ash: none, because hunts are not safe to leave.
- **H8 A use for each system.**
  - Arcane: burning and damage in the trials.
  - Divine: the gods.
  - Martial: the champions, and techniques learned by watching.
  - Cooking, smithing and alchemy: the terms quests and benches.
  - Psionics, mutagens and runecarving stay shut (§1.4) and get no use here.

**Laws.**

- **L1.** Every Moot edge is two-way. The entrance is a hidden edge, revealed
  once and kept.
- **L2.** Champions have `fightLimit` 1 and sit under no ladder gate. The
  grounds' hunts are endless.
- **L3.** A knockout resets the streak and nothing else. The latch holds.
  Festival losses cost time.
- **L4.** The whole map is optional content, so mastery may gate it. The way
  in is secret but hinted.
- **L7.** No reader of a `flag:fest_*` key may sit in the critical-path
  closure, and both states of every flag must leave the ladder completable.
  Lint: every `flag:fest_end_*` has at least one reader, and none of those
  readers is on a ladder floor. Until the closure exists (COMPLETABILITY
  §8), "off-ladder" means no `bandId` on the reader's spot.

**Build cost** (estimate, nothing measured): about 6 sessions.

1. The streak, the hook, the lint and the tests.
2. The Moot map, the climax finds and `SpotFind.meet`.
3. Hired.
4. Ash.
5. Table (1.5 sessions).
6. Tribes 4 and 5 and their gods.

The first slice is session 1 tested on a band 2 goblin spot (band 3 does not
exist yet), plus a stub with one tribe camp that writes
`flag:fest_end_hired`. It stays on a branch: on main it would leave a hidden
edge to a half-built camp. The streak moves to the forest direction when band
3 lands.

**Objections and rulings.** antagonist-design, 2026-10-28, verdict *fix
first*. All five fixes are taken into the entry above.

1. **The escape bar was unreachable by fighting.** Probe: John through floor
   6, seeds 42, 7 and 1234, 90 goblin fights on floors 4–5.
   - Median fight length was 27–69 ticks.
   - One fight reached 150 ticks; 16 took 30% of max HP; none did both.
   - Only a player who unequips could age a fight to 150 ticks, and a walk
     below the bar gave no feedback.
   - *Taken:* `minTicks` 30 as a floor, damage taken as the real bar, a log
     line per walk-away, and both dials set against measured band 3 fights.
2. **Derived marks could not tell "took a contract" apart.** `acceptQuest`
   writes no stat, and quests cannot be abandoned. *Taken:* the accepted
   stamp, plus order-free conditions.
3. **A climax find cannot start a fight.** A find-set flag would fire before
   the win, so a player could hold an ending while losing forever. *Taken:*
   commitment reads the climax kill.
4. **Readers on later goblin tables leaked onto the ladder.** *Taken:*
   readers are off-ladder only.
5. **`explore` takes no `requires`.** *Taken:* the gate moved to a hidden
   edge into a new spot.

Low-rated, also taken: nothing on the Moot reads the warchief's kill; the
quartermaster's currency is gold, so it does not collide with the Count's
marks; slice 1 stays on a branch.

Clean: invariant A (return edges carry no `revealWhen`; a knockout goes to a
haven; the run's flags reset at prestige), invariant C (integer counters,
the latch is a marker), no troll arbitrage (the streak pays a one-time latch,
and the `incoming` sum is unrefundable).

**Open questions.**

1. **Flag lifetime.** Today every `flag:` dies at prestige
   (`prestigeNow` keeps only the `prestige` block).
   - *Default:* run-scoped `flag:fest_end_*`, so each run picks an ending
     again.
   - Plus a carried `flag:keep_fest_<ending>`: `prestigeNow` copies every
     `flag:keep_` key (about 10 lines, no migration).
   - The carried key skips the streak on later runs and grants a title per
     ending. The same prefix serves the Reruns ruling (knowledge carries).
2. **What "relevant later on" may touch.** *Default:* off-ladder content
   only (the castle quarter, shops, gods, techniques). An ending that
   changes a band 3 direction floor is possible, but both states must then
   stay completable, and it needs the critical-path closure lint first.
3. **"Five moons".** The smithing card ruled that the world has no moon.
   *Default:* a goblin count-word, with no sky object.
4. **Which direction faces the forest.** *Default:* West (floor 8), with a
   forest as its outside map. This settles one quarter of bands-2-3 Q9.
5. **Gods 4 and 5** (thievery, witch magic): R11 says the user writes the
   gods. *Default:* placeholders as in M7, captioned by the user later.
6. **Disarming as the puzzle.** *Default:* no. The bar is met in an ordinary
   fight, and the castle NPC's hint says "walk away hurt".

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

None.
