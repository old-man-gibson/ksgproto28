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
| 2 | 2026-10-29 | The warring states band | band 4, floors 11–20 | Bank |

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
- **Placement.** Band 4, floors 11–20, after band 3.
- **The hold** (Q9): *"No matter how the player clears floor 12, the player
  gains a base."*
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
