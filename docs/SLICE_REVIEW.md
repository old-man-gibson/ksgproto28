# Band 1 slice review: fun, idle, content depth

*2026-10-22. What the alpha slice (floor 0 → Threshold → floors 1–3 →
prestige) gives a player today, where it is thinnest, and a plan to thicken
it. A review, not a plan card: the freeze rule in
[plans/alpha-band-one.md](plans/alpha-band-one.md) still holds, so every
package below names the existing card or doc it would land under.*

Sources:

- A fresh-save playthrough on the dev-test server (`[::1]:5599`, its own
  storage): tutorial, Threshold, floor 1 to the Toll Collector and the
  quest turn-in.
- A content census: every reachable spot, monster, NPC, quest, item, recipe,
  skill, title and boon, with headless engine runs for the loops.
- `npm run pacing` and `-- --attentive` (18 climbs each).
- Three brainstorms (idle loop, run-2+ horizon, content density) and one
  design attack ([§7](#7-the-attack-and-the-rulings)).

---

## 1. Verdict

- Adventure: works. The tutorial and floor 1 are the best minutes in the
  game. It is short: about 17 minutes of authored first-run content.
- Incremental: the engine is deep, the horizon is one prestige long. The
  boons worth buying cost 11 points; the first prestige pays 9–12. Run 2 is
  the same climb on the same clock.
- Idle: everything non-combat runs unattended and pays. After the first night
  it pays toward nothing: gold has one sink (1,060), the harvest flattens, and
  combat has no idle form once the floors are cleared.
- Thinnest, in order: the post-clear loop, the reason to re-climb, monster
  variety on floors 2–3, loot, quests.
- Content that already exists but cannot be reached is the cheapest content
  available: 7 shuttered systems, 19 unsourced items, 13 unplaced recipes,
  51 unplaced monster definitions.

## 2. What a new player gets, by the minute

| Stretch | John (pacing) | Hands-on | What happens |
|---|---|---|---|
| Floor 0 | 0.6–0.9 min | ~2 min | Weapon, stance, spell picks; 4 slime fights. Every click is explained. |
| Threshold | — | optional | 27 spots, 14 NPCs, 3 quests. Town quests: 2.2 min when played directly. |
| Floor 1 | 2.8 min | ~7 min | 6 vermin fights, 3 search rooms, the daybook route, the Toll Collector. |
| Floor 2 | 3.0 min | — | 4 corridor stretches of 3 fights, the tutor (Gather, Lunge), quartermaster, break room. |
| Gate 3 wait | 4.2 min | ~0 | John works a job to reach 600 gold earned; a quest-taker already has it (First Ascent pays 350). |
| Floor 3 | 3.0–3.4 min | — | Three side rooms for plans and string anchors, the puppet bureaucrat. |
| Band 1 total | 10.7–18.5 min (mean 13.9) | ~40 min est. | First boss lost 7/18. Knockouts per climb: 4.7 plain, 2.3 attentive. |

After the clear:

- Every tower hunt is empty ("Nothing here fights any more").
- The only repeatable fight is the Cages: levels 1–3, three species, about
  82 gold/min, no level XP past level 6.
- Jobs pay 50–90 gold/min. 8 offline hours at the Weighbridge: +41,341 gold,
  CHA +25.
- Prestige: run 2 for John averages 11.8 min against 12.3 on run 1. Same
  fights, same gate wait.

## 3. The three halves

### 3.1 Adventure: works, short

What lands:

- Each floor has one idea: floor 1 a remembered route plus a boss whose
  conditions answer the tutorial spell; floor 2 a corridor with a teacher;
  floor 3 exploration that weakens the boss.
- Bosses have preparation. Strings cut and the oak club move the bureaucrat
  from level 12 to 9; spell choice moves the collector's win rate.
- The tutorial drives the screen and hands over three real choices.

What is thin (counts from the census):

| Measure | Count |
|---|---|
| Monster species met | 12; 8 of them finite only |
| Floor 2–3 non-boss fights | 16, against 4 definitions with no rotation, regen or inflicts |
| Spell weakness coverage on floor 2 | fire ~3 of 16 fights, spark ~7.5, ice 0 |
| Quests | 3; none past band 1; the two town quests take 132 s |
| NPCs | 14; 5 are talk-only with 3 lines each; floors 1 and 3 have none |
| Equipment obtainable | 20 of 39 definitions; weapon damage steps 3 → 5 → 7 |
| Empty slots | back 0 sourced of 2, offhand 1 of 4, accessory 1 (a 3% boss drop) of 5 |
| Recipes at a spot | 7 of 20, all at the Forges |
| Dead explores | Chalk Yard and Undercrofts: an explore bar with no finds and no hidden road |
| Dead-end materials | goblin furs, slime gel, ledger leather |

### 3.2 Incremental: one prestige of horizon

- Harvest: John's first prestige pays 9–12 points (floors 3, skill levels
  3–5, achievements 2–3, bestiary 1). A completionist adds 1–2.
- The boon list totals 84 points. The boons that change a run (Head Start
  1–3, wayfinding, foresight) cost 11, so one prestige buys the useful part.
  The rest are ceiling ranks; darkvision_ceiling (6 points) raises a skill no
  slice spot can train.
- Every in-run latch resets at prestige: `stats`, titles, quests,
  achievements. A shutter lifted by a find closes again at the next run, so
  the alpha-scope-locks done-line "each latch is liftable by content" holds
  only inside one run.
- 37 of 94 skills can gain XP in run 1. Alchemy cannot manifest until run 2
  (it needs herbalism 3, which only the hold's farm trains), so 4 of the 9
  reagents on the shelf are refused in run 1.

### 3.3 Idle: runs, pays toward nothing after night one

- Offline catch-up (8 h) and the bonus bank (1:1, 8 h, spent at double speed)
  both work.
- Safe to leave running: jobs, training, floor 1 searches, the hold farm,
  bench runs until stock ends.
- Not safe: hunts. A Cages night ends at the first knockout (the player
  wakes at the Foot with no activity) or at the dare, which holds the world.
- Harvest from one job left running: 2 points at 1 h, 4 at 8 h, 5 at 16 h,
  8 at 72 h. Exposure skills cap (chronosense at 20) and gold is geometric
  (10k, 100k, 1M), so night two is worth almost nothing.
- Gold sink: the Rack at 1,060 met price, about 15–20 minutes of a job.

## 4. Where content is thinnest

| # | Gap | Evidence | Cheapest fix |
|---|---|---|---|
| 1 | Post-clear loop | 0 kills in 2 min at 5 cleared hunts; Cages only, L1–3 | Package C |
| 2 | Reason to re-climb | Run 2 mean 11.8 vs 12.3 min; useful boons cost 11 | Package B |
| 3 | Floor 2–3 monster variety | 4 definitions, identical automaton resistances, ice has no target | A1 |
| 4 | Loot and slots | 19 unsourced items; back/offhand/accessory empty | A2, A3 |
| 5 | Quests | 3 total; district chains never written | user's objectives list (§8) |
| 6 | Broken promises | Alchemy half-shut, darkvision boon, dead explores, unreachable titles | A4 |

## 5. How much is needed

Targets (proposed):

- First run: keep the critical path where it is (John ~14 min is tuned and
  test-locked). Thicken it with optional content a player can see from the
  path: +3–5 minutes.
- After the clear: one combat loop and one goal ladder a player can leave
  running for a night and see paid.
- Runs 2–5: each run opens something run 1 did not have.

Sizes, from the brainstorm estimates:

| Package | Engine | Data | Build |
|---|---|---|---|
| A climb density | `SpotDef.rarityWeights`, feed text fixes | monsters, spots, finds, lints | ~1.5 sessions |
| B doors | one boon effect kind, two call sites | 5 boons, 1 payoff line per door | ~1 session + payoff passes |
| C2 work ladders | one counter bump per game minute (~40 lines) | 4 harvest sources, optional standing-order quests | ~0.5 session |
| C1 refill (held, §6) | `SpotDef.refill` (~170 lines, combat hot path) | 6 spot lines | ~1 session |
| Band 2 floors | none expected | 3 floors, each a user-directed design | ~1 session per floor, after A–C |

## 6. The plan

> **2026-10-23:** after your direction on floors, A2 (mimic cabinets) and A3
> (sources and explore lints) fold into [FLOOR_STANDARD.md](FLOOR_STANDARD.md),
> and A1 rides along in its floor 2 pilot. Steps 2 and 3 below are unchanged.

Three steps in order, then two items held for your call. Each step is one
builder in its own worktree, attacked by `antagonist-code` before it lands
(.claude/TEAM.md). One builder at a time: steps 2 and 3 both touch
`prestige.data.ts`, and step 1's rarity field and step 2's boon kind both
touch `types.ts`.

### Step 1: climb density (Package A), under plans/alpha-band-one-floors.md

A1. Floor 2–3 monster rules. Every stranger meets these; data only.

- `filing_automaton`: rotation gather → heavy blow (0.6×, 2.0×, then a plain
  swing at 1.0×). STR 5 → 3.5 so mean damage stays within 4% over L3–8.
  Defensive stance and dodge now matter against the 2.0× blow.
- `sorting_automaton`: regenerates 0.1% of max HP per tick (about 10% longer
  fights), suppressed while burning; cold resistance −0.3. Ice gets a target
  (0 → ~2.3 of 16 fights) and fire gets a second use.
- `ledger_tome` (heat) and `living_doll` (no answer but a blade) unchanged.
- Lock: no two hall monsters share a resistance + rotation + regen signature;
  each tutorial element has a ≥ 25% weakness among floor 2 monsters. Rerun
  `npm run pacing`; `tests/john.test.ts` bounds hold.

A2. Three mimic cabinets. Optional, once per run, +~3.5 min for a player who
finds them.

- A search find in `f1_lockers`, `f2_break_room` and `f3_annex` sets a flag
  that reveals a one-fight cabinet spot (`fightLimit: 1`, normal modifier,
  group of 1, `once`).
- Each holds one veteran-tier mimic at about the floor's top level, ~140 HP
  at L6. Its loot table is item-only and lists one empty slot's unsourced
  items: back (spellwoven_cloak, wolf_cloak), offhand (tower_shield,
  warden_buckler, parrying_dagger), accessory (pilgrim_amulet,
  apprentice_ring, hawk_feather_band).
- Uses the `mimic` trait, registered in bestiary.data.ts and read by nothing.
- A loss does not record `once`; the cabinet can be retried.

A3. Sources lint, both validation layers.

- Every ItemDef has a live source (shop line, drop, find, recipe at a spot)
  or sits on an allowlist (tutorial grants; chase items such as
  moonlit_katana and jotunshamarr).
- Every explore activity has a find or a hidden road. The Chalk Yard and the
  Undercrofts get one find each.

A4. Defects from §9 that need code: `SpotDef.rarityWeights` set on the three
boss spots and floor 0; the doubled article; unrounded status damage; a
herbalism-training activity in Threshold so alchemy can manifest in run 1;
darkvision_ceiling made unbuyable (kept in the table, so bought ranks are not
orphaned); doc drift.

Done when: verify green, pacing rerun with bounds held, a screenshot of a
mimic fight and of the automaton's heavy blow in the feed on port 5599.

### Step 2: Doors (Package B), under plans/alpha-scope-locks.md

- A boon effect kind `unlock`. `applyRunStart` and `buyBoon` write
  `stats['flag:unlock_<sys>'] = 1` for each system the boon names. Every
  reader sees the system open, in the run where it was bought and every run
  after.
- Five doors, one rank each: prep 2, runecarving 4, martial 4, genes 5,
  psionics 5 points (20 in all, about two more prestiges). Music and wuxin
  stay shut: music has no effects and wuxin has no engine consumer.
- Each door ships with one payoff line in band 1: a rune loot line on
  `living_doll` (no floor 1–3 species drops a rune today); genes already have
  a source (`slime_base_basic`); Ilex teaches psionics; martial reopens the
  planner over Gather and Lunge.
- Lints: no `FloorDef.gate`, `FloorDef.clear`, `PRESTIGE_UNLOCK` or `once`
  line may read `flag:unlock_*`. The boon table counts as a writer of those
  flags in `contentFlags()` and its forge mirror, or a payoff line gated on
  one fails the condition-key lint.
- If §8 Q4 says old saves keep their systems: the migration stamps the door
  purchase on any save with the flag set and `prestige.count === 0`.

Done when: a bought door is open in the run in progress and after a reset
(test), and a run-2 save shows the opened bench or tab with its payoff line.

### Step 3: work-time ladders (Package C2, C3), under PRESTIGE.md

- Each full game minute in a job, train, gather, search or craft activity
  adds 1 to `work:<group>` (labour, study, forage, craft). One line in
  `tickAction`; bench runs need a second bump in benchwork.ts.
- Four harvest sources, geometric: per 120 minutes, growth 3 (points at 120,
  360, 1,080 minutes).
- Effect on a night: one 8 h job night harvests 4 points today, 6 with the
  ladder. Three nights rotating job, drills and search pay +6 from the
  ladders instead of +3 from one group.
- C3, optional: Warden "standing orders", quests whose objectives read the
  counters (e.g. 240 minutes of paid work) so a night has a named goal. Add
  `work:` to the condition-key whitelist in content.test.ts and the forge
  mirror. Objectives arrays go to you for captions.

Done when: 600 ticks of a job add exactly 1 at any DEX (test); the Prestige
tab lists the four sources with their next threshold.

### Held: idle combat (C1), your call (§8 Q3)

Refill: a cleared hunt yields one fight per `every` ticks, only to a player
whose power ratio clears `minRatio`; the clear counter is never reset. The
attack showed the proposed `minRatio: 1.25` is below the spawn roll's noise
floor (a rare, epic or boss roll, or a pair, drops a 1.25 build to 0.13–0.73,
and mercy guarantees those rolls over a 480-fight night). If built: refills
spawn through the existing `plain` path (no modifier or rarity roll), the
ratio is priced at the top tier roll × the spot's largest group, and the
knockout rate is measured at the lowest level that passes the gate. It is
also not the agreed "cleared floors as idle nodes" (assign a floor, it pays
while you do something else), which plans/alpha-band-one.md lists as out of
alpha.

### Later: band 2

Three floors, each a design you direct, as floors 1–3 were. About one build
session per floor. After steps 1–3, so band 1 holds for several runs first.

## 7. The attack and the rulings

`antagonist-design` read the plan text only. Verdict: fix first. No reachable
terminal state; A, B and C2 hold; C1's safety number is wrong.

| # | Objection | Ruling |
|---|---|---|
| 1 | Refill's `minRatio: 1.25` sits below the spawn roll's noise floor; measured at level 6 only | Accepted. Plain spawns, ratio priced at top roll × largest group, re-measure at the lowest passing level (§6 Held) |
| 2 | Refill is not "cleared floors as idle nodes", and that item is listed out of alpha | Accepted. Work ladders move ahead of it; refill goes to you (§8 Q3) |
| 3 | No content writes `flag:unlock_*`, so a door's payoff line gated on it fails the condition-key lint | Accepted. The boon table becomes a flag writer in both layers (§6 step 2) |
| 4 | Saves stamped open by v47/v55 lose martial and prep at their first prestige under Doors | Accepted as a finding, re-scoped: it happens today, with or without Doors, for all seven systems (prestige rebuilds from `createInitialState`). Sent to you (§8 Q4) |
| 5a | Work ladder arithmetic: three nights on one group pay +3, not +2 | Accepted; corrected in §6 |
| 5b | `work:` keys fail the condition-key whitelist | Accepted; in step 3 |
| 5c | Deleting the darkvision boon orphans bought ranks | Accepted; made unbuyable instead |
| 5d | Every refill win re-logs "cleared. No encounters remain." | Accepted; applies if refill is built |

Checked clean by the attack: refill + bonus time + offline catch-up nets the
same kills as two plain nights (bank is 1:1, offline caps at 8 h); the work
ladder terminates (growth > 1); Doors need no `modFingerprint` change (no
modifier source reads the shutter); mimic items reset at prestige; no new
one-way edge.

## 8. Questions for you

Answer in fragments; each has a default that is used if you skip it.

1. **Freeze.** May steps 1–3 land under the existing cards while the epic's
   done-list waits on your recaptions? None adds a system; steps 2 and 3
   extend prestige. Default: yes.
2. **Doors.** Which systems, at what prices? Martial: you said nothing lifts
   it in alpha yet. Default: prep 2, runecarving 4, genes 5, psionics 5;
   martial held.
3. **Idle combat.** Refill (stand and hunt on a clock, plain spawns, power
   gate) or the agreed idle node (assign a cleared floor; it pays while you
   do something else)? Both are out of alpha today. Default: neither until
   step 3 has shipped.
4. **Old saves at prestige.** Today a save whose systems were stamped open by
   the v47/v55 migrations loses all seven at its first prestige, because the
   flags live in `stats`. Intended? Default: intended (prestige resets the
   run), and Doors buy them back.
5. **Unsourced items.** Some of the 19 may be parked for the countryside on
   purpose. May the mimics carry the eight listed in step 1? Default: yes;
   moonlit_katana and jotunshamarr stay out.
6. **District quests.** Want one objectives array per district (eight short
   chains, 2–3 quests each, built from the verbs already in each district)
   to caption? Default: yes, drafted after step 1.
7. **Band 2.** After steps 1–3, or sooner? Default: after.

## 9. Defects seen in play (no design needed)

| Defect | Where | Evidence |
|---|---|---|
| Rarity is not pinned by `modifierWeights`; it rolls from the global table (23% non-common). The floor 0 slime spawned "Uncommon"; the collector and bureaucrat can roll Rare (×1.35 stats) or Epic (×1.6) | combat.ts:830–845, monsters.data.ts:43–48 | Seen in play. TUTORIAL.md §2 and ONE_BUILDING.md §2 say the spots are pinned to plain |
| Fight feed reads "The The Toll Collector" | monsters.data.ts:122 (name carries "The") | Seen in play |
| Status damage printed unrounded: "discharges through The Toll Collector for 0.01875 lightning" | combat.ts:3201 | Seen in play |
| The top bar keeps "Drive Out the Vermin" after the hall is cleared | top bar activity label | Seen in play |
| Alchemy skill cannot manifest in run 1; 4 shelf reagents refused | skills.data.ts:855 (needs herbalism 3); herbalism trains only at locations.data.ts:249, 275 (the hold) | Census, headless run |
| Darkvision cannot train in the slice; the darkvision_ceiling boon sells 6 points of nothing | exposure.ts:159–160 (sheltered, indoor and settlement are dark-free); no spot is tagged `dark` | Code reading, grep |
| The dare (David and Goslimath) is offered only while attributes total ≤ 30; one attribute reaches 28 in ~10 min of training | training.ts:43 (`maxAttrTotal` on the Cages spot) | Census |
| Titles `first_blade` and `untouchable` key on `goblin_boss` (shelved); `iconoclast` needs 10 miracles, 6 exist for the known gods | titles.data.ts:84–112 | Census |
| Achievement `miner` unreachable; questmaster tiers 2–3 need 6 and 12 quests, 3 exist | achievements.data.ts | Census |
| Old saves lose stamped-open systems at their first prestige | prestige.ts (rebuilds from `createInitialState`; flags live in `stats`) | Code reading; §8 Q4 |
| Doc drift: PRESTIGE.md §2 names the brood queen; tests/john.ts says John swings a sword, but Skip leaves it in the pack and he fights unarmed | PRESTIGE.md, tests/john.ts, tutorial.ts:165–172 | Census |
