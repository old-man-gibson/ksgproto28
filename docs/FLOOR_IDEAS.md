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
| The climb requires basic use of roughly half the core systems (arcane, divine, martial, psionics, cooking, smithing, mutagens), the player's pick. A requirement counts systems or offers a route per system; it never names one. Mastery of a generative grammar (arcane sentences, mutagen topology, alchemy sequence, the martial graph) gates optional content only | COMPLETABILITY §6a (2026-10-23), §5 |
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
  a boss answer (as floor 1's spells answer the collector), a material it
  consumes, a teacher. Picking which systems to focus on is planning, and
  planning counts as hands-on time; a band where only one system helps
  removes the choice.

### 3.3 Laws

- **L1 No stranding.** Every spot gets home; one-way edges listed.
- **L2 No exhaustion on the path.** No `once` or `fightLimit` source under a
  gate or clear that needs more than it holds.
- **L3 Failure is recoverable.** A loss costs time, never a path.
- **L4 Usage, not invention** on the critical path. Mastery gates optional
  content only (§5.1 Q6).
- **L5 No power gates.** Every critical-path fight is winnable by grinding
  inside the systems the player picked (§5.1 Q7).
- **L7 Count, never name.** A system requirement counts core systems or
  offers one route per open core system; it never names one
  (COMPLETABILITY §6a rule 1). More systems are open and taught before the
  gate than it counts (rule 2).
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
| — | — | none yet | — | — |

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
   which ones they pick and focus on."* Divine magic is also core. Narrows Q6:
   grinding wins inside the picked systems. COMPLETABILITY.md §6a holds the
   rule and its open questions.

### 5.2 Open

None.
