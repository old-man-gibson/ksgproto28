# Cooking and Hunting Review

*2026-10-23. A design review, not a spec: nothing here is built. Run as a
`team:` task: three brainstormers (kitchen depth, hunting into the kitchen,
presentation), one design antagonist, rulings by the manager (§6). The same
review as a page with six working mockups:
[cooking-review/review.html](cooking-review/review.html), published privately
as https://claude.ai/artifact/T7dMezzkmjuLohn368PZNZ. Open the file from disk,
or serve the repo root with the `docs-static` launch config.*

The ask, in three lines: make cooking more visually appealing and more
rewarding to master past its current scope; keep its identity while making it
distinct; make cooking and hunting a diverse system worth mastering.

---

## 1. What exists

| Part | Today | Where |
|---|---|---|
| Benches | Stove (timed), oven, grill, cold counter, cutting board, all on the one `cooking` skill | `data/disciplines.data.ts` 165–760 |
| Alpha kitchen | **The stove only.** Board and counter sit behind the `prep` shutter; oven and grill are in the hold, which opens after the first prestige | `systems/unlocks.ts`, `locations.data.ts` (`granary_kitchens`, `base_kitchen`) |
| Grade | mean of part contributions + level/15 + bench-fit (≤ 0.6) | `systems/cooking.ts` 199–258 |
| Timing | Stove only: 8/12/16 units, slots enter at 0 / 0.33 / 0.66 / 0.9; each cut has an exposure band | `cooking.ts` 78–124 |
| Cuts | Grade = uniformity; mid grades roll widest | `data/preps.data.ts` |
| Dishes | 15 dishes grant three statuses: `well_fed`, `steady_hand`, `clear_headed` (all `stacking: highest`), plus `queasy` from the mess | `materials.data.ts` 196–520, `statuses.data.ts` ~920 |
| Recipes | Recipe cards teach gated outcomes (Larder Door sells two, the Reading Hall drops one) | `CraftOutcomeDef.recipe` |
| Hunting | A passive skill: bestiary novelty (first of a species pays 10×), loot ×0.4% and gold ×0.3% per level | `skills.data.ts` ~84, `bestiary.data.ts` |
| Meat | One generic `raw_meat` for every beast | `materials.data.ts` 93 |

## 2. Identity

Cooking's guard is **WHEN** (cardinal: durations matter). Runecarving is the
sum, alchemy the sequence (ordinal), mutagens the interaction topology. The
proposal keeps that and pushes it one step further:

- **Today:** WHEN decides how GOOD a dish is (exposure fit).
- **Proposed:** WHEN also decides WHAT the dish is (heat windows, §4.1).
- **Later:** the quarry decides WHEN each part goes in (carcass parts carry
  their own windows, §4.5); the Cook's Book remembers every dish and grade
  (§4.4).

Nothing below adds a pair synergy, an order dependence or a sum-of-effects
dish. Every effect is a status, so monsters can wear it.

## 3. Findings

Each one was checked against the code on 2026-10-23.

- **F1. Hunting feeds no pot in the alpha.** `raw_meat` drops from
  young_wolf, wolf, boar and cliff_hawk. All four spawn only in
  `data/shelved/locations.shelved.ts`. Live living quarry is forest_rat (the
  Cages, f1 storerooms) and goblin (the Cages); every tower floor otherwise
  spawns slimes and constructs. The Larder Door is the alpha's food source.
- **F2. Timing is inert in the alpha.** Whole food uses the `whole` band
  [3, 16] at peak 1, and the board is shut, so no alpha player can cook with
  prepped food. Below Cooking 8 every stove layout lands in band, so duration
  and slot choice change nothing. From 8, the late slot at Quick simmer falls
  short (2.7 units, ×0.95); the fourth slot (Cooking 20) lands at 0.8–1.6
  units. Both can only lower the grade.
- **F3. Fifteen dishes, three effects.** Every dish grants some mix of
  `well_fed`, `steady_hand` and `clear_headed`, all `stacking: highest`.
  Cooking fills one role (weak sustain) under COMPLETABILITY §6a, which counts
  it as one of the eight core systems.
- **F4. Mastery stops at Cooking 45.** Judgement is level/15, uncapped: two
  Fair whole ingredients make Fine at 9, Superb at 23, Divine at 45. The skill's
  only other effect is craftSpeed, which the stove ignores
  (`work.skillScaled: false`). No milestones.
- **F5. The stove mints gold.** Fair meat and onion cost about 10 gold at the
  Larder after the hello. A Hearty Stew sells for value 14 × grade multiplier
  (`gradedUnitPrice`, `systems/equipment.ts` 223): Fair 14, Fine 22, Superb 35,
  Divine 56. A stew takes 12 s. Bench runs repeat a layout, and offline
  catch-up runs ordinary ticks for up to 8 h (`save/offline.ts`), about 2400
  stews a night: about +29k gold at Cooking 15, +110k at 45. The band-1
  economy holds about 1k gold at the end of the band. The shop no-arbitrage law
  does not cover this; it is crafting value-add.
- **F6. The stove hides its own rules.** Seen on the live stove (port 5599,
  gothic theme) during the review:
  - The exposure band appears only in the tooltip of a filled cell
    (`ui/panels/BenchPanel.svelte` 291–298); `exposureInfo` does not return it
    (`cooking.ts` 127–141).
  - The slots are laid out out of time order: the midway slot sits above the
    first one, slots 3 and 4 sit in the corners.
  - The dish preview is one line with no tooltip (BenchPanel 643–647). It sets
    `--tint` to the grade colour, but `.preview` (BenchPanel ~1104) never reads
    it. Same for the brew and culture previews.
  - The picker shows every grade of an ingredient as the same icon with no
    grade mark; the review run put a Refuse onion in a stew by accident.
  - Cookware's grade is averaged into the dish like an ingredient
    (`cooking.ts` 170–177) and nothing says so.
  - Reopening the stove mid-cook shows an empty slab beside a running bar:
    `bench` is local state (BenchPanel 80) and is never seeded from
    `gs.benchWork.placement`.
  - A finished cook shows nothing at the bench; the result is one log line.
- **F7. Hunting's knowledge has no use.** Bestiary facts are read, never
  acted on. Hunting levels buy small loot and gold multipliers.

## 4. Proposed changes

Round 1 is §4.0–§4.2 plus the UI in §5.1–§5.2. Everything after that waits on
the questions in §8 or on content that does not exist yet.

### 4.0 Fix first (no design question)

- Cap the judgement nudge (§4.2). This is the mint fix.
- Windowed dishes keep `value` at or below Hearty Stew's.
- UI: `.preview` reads `--tint`; seed `bench` from `job.placement` and keep
  the last layout per bench in UI state; show the grade on picker cells and
  stock on placed cells.

### 4.1 Heat windows: the clock picks the dish (round 1)

- **Rule.** A stove outcome may declare half-open exposure windows on a tag:
  `CraftOutcomeDef.heat?: { tag: string; from?: number; to?: number }[]`. It
  matches only when the mean exposure (duration × (1 − slot.at)) of the
  placed parts carrying that tag lies inside. `matchOutcome` and `checkCraft`
  take the duration.
- **Fallback (antagonist objection 2).** The window-less dish stays the
  fallback for its tag set at its old priority; windowed dishes sit one
  priority above. A player without a card, or outside every window, cooks
  exactly what they cook today.
- **First set** (numbers are first guesses):

  | Dish | Needs | Window | Grants |
  |---|---|---|---|
  | Seared Stew | meat + vegetable | meat < 6 | new `stoked`: damage +5% and crit damage +5% per intensity, 5 min |
  | Hearty Stew | meat + vegetable | fallback | `well_fed` (unchanged) |
  | Braised Meat | meat + vegetable | meat ≥ 14 | `well_fed` ×1.5 for 15 min |
  | Steeped Broth | mushroom + herb | herb ≥ 8 | new `steeped`: poison and acid resistance (strength: Q2) |
  | Mushroom Broth | mushroom + herb | fallback | `clear_headed` (unchanged) |

- **Reachable at Cooking 1 with two slots, on whole food.** Seared: meat
  midway at Quick simmer (5.4 units). Braised: meat first at Long braise (16).
  Steady stew with meat first stays a Hearty Stew (12). The mockup's section A
  plays this.
- **Teaching (Invariant B).** Recipe cards at the Larder name the window
  ("meat in late, short simmer"); the Cook's Book lists it once learned.
- **Lint.** Per tag set, the fallback outcome matches at every duration × slot
  layout; every window is reachable from some legal layout. Both validation
  layers (`tests/content.test.ts`, `forge/lib/validate.ts`).
- **Cost.** No save change if shipped without a novelty domain. Files:
  `types.ts`, `systems/disciplines.ts`, `systems/cooking.ts`,
  `disciplines.data.ts`, `materials.data.ts`, `statuses.data.ts`, text.
- **Novelty (objection 7).** A `cookery` novelty domain keyed by dish id
  would pay discovery per new dish. Cooking exists in live saves, so it needs
  a seeding migration like v14→v15 (`NOVELTY_DOMAINS.md`), which is a save
  bump. Ship windows first, the domain separately.

### 4.2 Judgement capped (round 1)

- **Rule.** `judgement = min(2, min(L, 15)/15 + max(0, L − 15)/45)`. It is
  +1.00 at Cooking 15, reaches the +2.00 cap at 60, and stays there.
- **Effect.** Fair ingredients top out at Superb (1 + 2 = 3.0 < 4.0). Divine
  needs Superb inputs. Levels 15–60 still pay, 0.022 a level. Section B of the
  mockup shows today's and the proposed number side by side.
- **Who loses.** A save above Cooking 15 cooks lower grades than today. The
  alpha's players sit below 15.
- **Mint after the cap.** Fair inputs at Cooking 60 make Superb (35 gold from
  10). That is still a margin; whether cooking may be a gold source at all is
  Q1.

### 4.3 Mastery that lingers (round 2)

- **Milestones.** Every 10 Cooking levels: `foodDuration` +6%; every 20:
  `foodPotency` +5%. Both read when anything is eaten, both capped at ×1.5
  (objection 4: cooking has no `maxLevel`, so an uncapped multiplier rides an
  uncapped skill). Both stat blocks get the stats so monsters can carry them.
- **Reps.** `stats['dish:<id>']` counts cooks per dish. 25 pins the dish's
  window in the Cook's Book; 100 makes it a Signature: eating it also grants
  a second, smaller status (`ConsumableSpec.signature`, e.g. Hearty Stew →
  `stoked` ×0.5). About 5 h of stove for the whole first set.
- **Cost.** No save change (stats map). `derived.ts` base values,
  `consumables.ts`, `skills.data.ts`, `materials.data.ts`. Test: the
  derived-stats cache sees the new stats.

### 4.4 Cook's Book (round 2, with §5.3)

- One row per dish, read from outcome data: a square per grade made, count,
  best, the window once pinned, the Signature once earned. Dishes not yet made
  show as a silhouette with no gate printed, so the stove keeps its discovery.
- Counters `cooked:<outcome>` and `cooked:g:<outcome>:<tier>` through
  `bumpStat` in `cook()`; a `cooked` event for the plate card.
- Prestige rebuilds state, so the Book resets each run like `recipe:*`
  (Q5).

### 4.5 Carcass parts and the Palate fact (deferred)

The hunting half. Deferred because the tower has almost no living quarry
(objection 3, F1).

- **Rule.** A kill listener rolls tag-derived rows instead of per-monster
  meat lines (`TAG_CARCASS`; precedent: `TAG_ARMOR`, `TAG_RESISTANCES`).
  Zero authoring per monster; an optional `MonsterDef.carcass` override wins.
- **Parts carry their own windows** (`MaterialDef.exposure`, read first by
  `exposureProfile`): tender cut [3, 9], sinew [12, 16], offal [2, 5], marrow
  [10, 16]. The quarry tells the cook where each part goes.
- **Glands.** A species with innate non-physical resistance ≥ 0.25 also drops
  a gland of that element; gland + herb makes a broth granting resistance to
  it. The status must not be called `ward_*` (objection 6: `ward` is arcane's
  verb and a StatKey).
- **Palate.** A new bestiary fact (minKills 4, sure at 40): parts, windows,
  glands, and a Load Pot button that fills the stove with a layout that lands
  every part in band. The Cages teach it at kill 4. Mockup section E.
- **Why deferred.** No live living species is large (no marrow) and none has
  resistance ≥ 0.25 (no glands). Of the three roles this was meant to fill,
  only damage (rat tender cut) has a source, and that source is the Cages.
  Unblocks when a living, large or resistant species spawns on a live floor,
  or by Q3 (slimes as food).
- **Lint.** Every `living` species yields at least one part; no construct
  does; every part's window is reachable from a legal layout.

### 4.6 Appetite: the kitchen feeds the hunt (later)

- Each species has a diet derived from tags (`TAG_DIET`, declaration wins).
  A worn bait status (`scent: ['sweet']`) multiplies the encounter weight of
  species whose diet overlaps: w × min(3, 1 + overlap × (0.5 + hunting/40)),
  applied in `eligibleEncounters` before `mercyPick`.
- `SpotEncounter.drawnBy` lines roll only under a matching scent, from Hunting
  40: rare and named quarry, optional content only.
- Offering food to the front enemy applies `sated` (blocks attack, ends on
  damage). It must also carry a timer (antagonist: two sated sides never end a
  fight, Invariant C). A fed guard is a skipped fight, optional only.
- This is the monster-side use of cooking: a monster has a diet, can be
  baited, can eat the offering, and a carrion species can bait the player.

### 4.7 Crocks: time at rest (after base building)

- A bench on the world clock. Starting spends the basket; collecting pays a
  dish graded by `fitOf(elapsed minutes, ripe band)`, the stove's math at a
  larger scale. Early or late lowers the grade; nothing is destroyed.
- `state.crocks: { spot, disc, placement, startedTick }[]`: a save bump.
  Elapsed is `totalTicks − startedTick`, so offline time ages it without a
  tick loop.
- Crock count is the base-building "actions between meals" hook. Output never
  exceeds input grade.

### 4.8 Dressing (later, low priority)

The corpse's statuses at the kill shift the grade of its parts (bleeding +1,
poison −2, clamped ±2). An optional toggle trades respawn time for a second
part roll on large kills. Few real decisions, since the kill method is mostly
set by the build; it needs §4.5 first.

### What hunting becomes

| Hunting level | Today | With §4.5–§4.8 |
|---|---|---|
| 1 | novelty XP, +0.4% loot | Palate learned in ~17 kills; parts by tag |
| 25 | +10% loot | Palate in ~9 kills; part yield on `living`; stronger bait |
| 40 | +16% loot | `drawnBy` quarry answers bait |
| 60 | +24% loot | bait at the ×3 cap; dressing costs 1 tick a part |

Hunting moves from a passive multiplier to knowledge (what a species is for),
then selection (what comes to you), then yield (how well you take it).

## 5. UI

Mockups: [cooking-review/review.html](cooking-review/review.html), in the
gothic palette. The game version reads app.css tokens; no new colour token, no
bought pixels.

### 5.1 Heat track (round 1; mockup A)

- A timed bench draws its slots as lanes on a time axis. A filled lane is a
  bar from the slot's entry unit to the end of the cook, split by the part's
  band into raw (hatched), ready (filled) and burnt (red hatch).
- Under each windowed tag, a strip shows the dish windows and a marker where
  that tag's parts land. Changing the duration moves every bar and the marker
  at once.
- One hint line names what is off and the entry unit that would fix it.
- While cooking, the job bar becomes a playhead on the track.
- Seasoning and cookware move to an "outside time" row.
- Core change: `exposureInfo` also returns `band`, `peak` and the entry
  window. New `HeatTrack.svelte`; BenchPanel branches on `disc.timeline`.

### 5.2 Grade ledger (round 1; mockup B)

- The dish preview opens to the tier ladder at true scale, a bracket where the
  score lands, the gap to the next tier, and one row per part: grade, fit,
  contribution, then judgement, bench fit, score. Last line: what the dish
  does when eaten at that grade.
- Collapsed by default to one line (`Fine · 2.11 · Superb 0.39 short`) so it
  does not read as a dashboard.
- Core change: `cookLedger()` returns the rows; `dishQualityRange` is rebuilt
  on it. Test: the ledger's sum equals the range for seeded random layouts.

### 5.3 Plate card and Cook's Book (round 2; mockups C, D)

- On completion the bench shows a plate card: grade stamp in the tier colour,
  the roll against the range, count and best from the Book.
- The Book opens from the bench header. Rows per §4.4.

### 5.4 Kitchen scene (last)

The kitchen banner becomes a counter with each bench as a code-drawn sprite
that shows idle or running n/N s, and a rail of the last four plates. Highest
art risk: hand-written sprites may read amateur. Build after the rest, show it
next to the real screens before keeping it.

## 6. Antagonist objections and rulings

| # | Objection | Ruling |
|---|---|---|
| 1 | The re-based judgement was still uncapped: Fair reached Divine at Cooking 105, so the mint survived | **Accepted.** Capped at +2.00 (§4.2); windowed dish value ≤ Hearty's |
| 2 | Recipe and level filters run before `requires`, so a windowed set without the card fell through to Traveler's Ration where today it makes a stew | **Accepted.** The window-less dish stays the fallback (§4.1); lint per tag set |
| 3 | Carcass parts claimed three roles; on a fresh save only damage has a source | **Accepted.** §4.5 deferred; roles not claimed |
| 4 | `foodPotency` uncapped on an uncapped skill | **Accepted.** Capped ×1.5 like duration |
| 5 | `steeped` at Fair is −8% poison: no cell test would credit it as condition defence | **Accepted.** Role unclaimed until a cell test passes; strength is Q2 |
| 6 | `ward_<element>` collides with arcane's ward | **Accepted.** Renamed at build time |
| 7 | A `cookery` novelty domain needs a seeding migration | **Accepted.** Domain ships separately with its migration |
| — | Later: `sated` on both sides never ends a fight | **Accepted.** `sated` gets a timer (§4.6) |

The antagonist found no terminal state: no critical path touches parts or
windows, every source (Larder, Cages, base farm) is endless, prestige
re-earns per run, and the identity guards hold.

## 7. Roles under §6a

What cooking would fill at basic use (follow a recipe card) on a fresh save:

| Role | Delivered by | Status |
|---|---|---|
| Sustain | Hearty Stew, Braised Meat (`well_fed`) | exists; Braised is stronger |
| Damage | Seared Stew (`stoked`) | new; needs a cell test (base John + Fair Seared Stew) |
| Condition defence | Steeped Broth (`steeped`) | **unproven**; Q2 |
| Access | none | bait and `sated` are optional content only |

## 8. Open questions

Each has a default, used until answered.

1. **Is cooking a gold source?** After the cap, Fair inputs still make Superb
   stews worth 3.5× their cost, and bench runs replay offline. Default: cap
   only (§4.2) and keep window dish values at Hearty's. Alternative: dish
   resale stops scaling with grade past Fair; a dish's worth is eating it.
2. **How strong may a cooking status be against poison?** (a) a resistance a
   cell test passes, e.g. +0.25 at Fair; (b) `blockedBy`: poison cannot land
   while `steeped` is held, for its duration (monsters can wear it too);
   (c) cooking does not claim condition defence. Default: (a), tested.
3. **Are slimes food?** 37 of 64 species are slimes and they are the tower's
   main quarry. Yes would make slime jelly the alpha's hunt-to-pot link (its
   band retuned to fit a two-slot stove). Default: no until you say; §4.5
   waits for living quarry.
4. **Are goblins (humanoids) food?** Default: no (`not: ['humanoid']`).
5. **Does the Cook's Book survive prestige?** Default: resets per run like
   recipe cards; a prestige boon may carry it later.
6. **Is a 100-cook Signature grind wanted?** Default: yes; the numbers are
   data.
7. **Round 1 scope.** Default: §4.0, §4.1, §4.2, §5.1, §5.2.

## 9. Weighed and dropped

- Dish effects derived from ingredient tags: that is a sum (runecarving's
  identity) and needs per-basket stored effects.
- Several concurrent meal slots gated by cooking level: punishes bought food;
  eating is not cooking.
- Meat freshness decaying on the way home: needs timestamped stock (save
  change) and punishes the idle player.
- A material per species: about 49 edible species × parts of authoring and
  stock bloat; tag rows do the same.
- Oven and grill timelines now: they sit behind the first prestige. One data
  block each, plus windows (rare / medium / well), when the hold opens.
