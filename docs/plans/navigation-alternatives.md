---
id: navigation-alternatives
title: Navigation alternatives — how the player moves, and how the map looks
kind: epic
status: execution
system: navigation
parent: ''
save: ''
updated: 2026-11-04
invariants:
  - completability
  - no-terminal-states
  - forced-roads-are-chosen
  - secret-content-silent
  - wayfinding-sells-go-links
  - tutorial-focus
done:
  - N1 and N2 built, attacked by antagonist-code, merged
  - N3 and N5 built, attacked, merged, screenshots at 1094 and 1440 px
  - N4 built, attacked, merged; the Ascent panel has no buttons above 600 px
  - N7 built after knockout-return, attacked, merged; Wayfinding text matches §9
---

# Navigation alternatives

User, 2026-11-04: "Has the team discussed the movement/navigation? I feel it looks lackluster and
might not be the best way of handling it. Discuss alternatives, go deep."

Made by a survey of the build, three brainstormers (rules of moving, the map as a picture, other
games and the Location screen) and one antagonist-design pass (verdict FIX FIRST, all 13 objections
accepted, §6). Mockups: [navigation/mockup.html](navigation/mockup.html), drawn from live data.

## 1. What was discussed before

- **2026-09-13, navigation rework (save v53, commit 4a138f4).**
  - Resume on return, go-and-do, the idle bonus bank.
  - The Travel list removed; the map made the one travel control.
  - The Wayfinding boon.
  - The user: map clicking was "unpleasant but standard for the genre".
  - Walking stayed, because roads carry forced fights, one-way roads, approaches and Scouting XP.
- **2026-10-18 (commit c26ffb5).**
  - Threshold has no fog: "a directory, not a place to scout".
  - Town roads ×0.2.
  - Tower-first start.
  - The user did not want the map hover cards changed.
- **2026-10-20.**
  - Per-floor map tabs.
  - Floor 0 painted in tiles.
- **2026-11-03, UI proposals round 1.** It left the map out on purpose: C3 moved the activity buttons
  above it and kept the map and cards unchanged.

The map's look and the travel model have not had a team review until this one.

## 2. What the survey found

Measured on branch `ui-integration`, test save on port 5599: level 24, floors 1–6 cleared, at The
Woods Edge on floor 4.

### 2.1 The map is small and reads as a diagram

- The frame is capped at 560 × 340 px (MapCard.svelte:653-661), and the 100 × 84 viewBox keeps its
  proportions. So the drawing is about 405 × 340 px inside a 788 px usable row: 51%.
- Labels are about 9.7 px and pins are 25 px. Threshold packs 27 pins and 34 roads into that box.
- Raising the font alone does not work. At 12 px, Threshold labels overlap in 8 places in today's
  frame. At the full 788 px width they overlap in 0–1 places.
- Only floor 0 is drawn with tiles. The other regions are pins on a black field.
- 8 floors have no scene tag, so the place header shows the town skyline on them: f4, f7, f12, f13,
  f14, f17, f18 and f20.

### 2.2 Travel is split between two controls

- Floors are joined only by the ladder ride (towers.ts:55, 196-199): 45 ticks per rung, from any spot
  of a banded floor. Only 2 authored roads leave a floor area.
- `findPath` walks roads only (locations.ts:193). Standing on floor 4, every Threshold pin's card
  reads "No open route from here".
- The ladder's Climb and Descend buttons sit at the bottom of the Location tab. Bands of cleared floors
  fold there unless you stand in them.

### 2.3 What travel costs is attention, not seconds

- The biggest time cost is the ride: floor 4 to the Foot takes 18 s.
- Town walks are 1–2 s. The ⏩ bonus toggle halves all travel.
- The baseline errand on this save is "buy at The Cart (Orrin Tallow, The Granary Gate), use the
  Forges, return to the hunt". Today it takes:
  - 7 clicks;
  - 2 scrolls to the ladder;
  - 1 unfold;
  - 3 stops that wait for a click;
  - 43.8 s.

### 2.4 Other findings

- **The caravan has no destination.** `waypoint: true` exists only on the Foot
  (locations.data.ts:510). `canFastTravel` needs both ends to be waypoints (locations.ts:320-329). The
  row on the map is dead.
- **Selling needs no trip** (equipment.ts sells in place). Buying, benches, quests, training and jobs
  do.
- **Road counts.** 434 directed road links:
  - 15 forced, all on floors 12–14, 19 and 20;
  - 12 with no road back, which the map draws as one-way;
  - 79 gated;
  - 7 with an approach;
  - 30 with `revealWhen`;
  - 1 hidden.
  - Correction to an earlier survey line: "92 one-way" was a raw flag count.
- **Roads offer no real choice.** 23 of 32 areas are trees, so route choice barely exists in the data.
- **Region tabs leak.** They draw all four regions with no discovery check (MapCard.svelte:30, 298-309).
  "Your Hold" shows on a floor-4 save before the hold can be reached.

## 3. How other games do it

Each row was checked against a fetched source by the references brainstormer; the URLs are in its
report. Rows marked "not verified" are excluded.

| Game | Player clicks | Travel cost | What fits here |
|---|---|---|---|
| Melvor Idle, combat areas | a location in a list | none | level range per row; no place model |
| Melvor Idle, Cartography | queue hex surveys, then travel | gold per hex, shown before the move | the cost shown before the click |
| IdleOn | MAP button, double-click a location | a daily teleport counter | a list, not a diagram |
| NGU Idle, ITOPOD | a start floor and an end floor | none | a tower as a number range |
| Torn, travel | ticket, destination, pay | money and flight time | an errand is a priced round trip |
| Fallen London | a place on the map | free; some places cost items | terms printed on every gated place |
| Cultist Simulator, Mansus | a Way in order | time and cash for far places | a reward table per place |
| RuneScape 3, lodestones | Home Teleport, a list | free, or runes for quick | unlock a jump by arriving there |
| Guild Wars 2, waypoints | a waypoint on the map | coin by distance | the caravan's shape, with destinations |
| Slay the Spire | a node on the act map | none | one icon per node type |
| FTL | a beacon one jump away | fuel; the fleet advances | visibility limited to neighbours |
| Darkest Dungeon | rooms and corridors | light per corridor | full layout, contents unknown until scouted |
| Binding of Isaac | doors; Tab for the big map | none | a local map always on, the big one on demand |
| Tiny Tower | the elevator, up or down | elevator speed | a tower as a cross-section of rows |

Conclusions the team drew:

- Games built for absent players make movement a list or a jump. Movement is a cost shown before the
  click, not a walk the player watches.
- Games where the map is the game need the player present. That fits the tower's scouting, not the
  errands.
- A tower reads best as a vertical section (Tiny Tower), with the open floor drawn in detail.

## 4. The core problem

Three problems, each with its own fix:

1. **Look.** The map is half-size and bare, so it reads as a diagram (N3, N4, N9).
2. **Split controls.** Roads and the ladder are separate systems, so the map cannot route across the
   door and the ladder sits at the bottom of the page (N1, N4).
3. **The verb.** The player thinks "what" (buy food, train Dexterity, go back to the hunt) and the game
   asks "where" (NAVIGATION.md §1 item 4). Go-and-do answered half of it (N7, N8).

## 5. The options

### 5.1 Foundation (needed by every direction)

**N1. Ride edges: the router crosses the ladder.**

- `rideEdges(state, from)` are derived and never stored. From any spot where `towerAt` holds, they
  lead to:
  - each discovered, unlocked landing;
  - the hub;
  - each opened band hub.
- They are priced by the `ride` formula.
- `findPath`, `startTravel`, `pathTicks` and `routeInfo` read roads plus ride edges.
- `travelPlan` stays a list of spot ids.
- A planned ride leg goes through the same gate as `climbTo`: `floorUnlocked`, `festivalLadder` and
  `towerAt`. A leg refused at execution falls to `route_blocked`.
- Never routed:
  - any landing of the Vermin Festival band (floors 15–16 stay ladder clicks);
  - a floor not unlocked;
  - an undiscovered landing;
  - any ride while inside a festival attempt.
- The first ride onto a new floor stays a ladder click.
- Separate fix: `festival:door` resets to 0 in `loseFestival` and `winFestival`. Today the reset happens
  only at `startFestival`.
- Effect on the errand:
  - 6 clicks (was 7);
  - 0 scrolls, 0 stops;
  - "No open route from here" goes away.
- Save change: no.
- Reverses nothing. Closes NAVIGATION.md §6 bullet 1.

**N2. Corrections.**

- While travelling, the map shows the destination's region and floor.
- Region tabs show only regions with a discovered spot.
- The dead caravan row is removed. The Foot keeps `waypoint: true`, because the "every spot can get
  home" lint anchors on it.
- docs/TUTORIAL.md §5 drops its caravan row.

### 5.2 Direction A: a better map, same model (map first)

**N3. Surveyed plan.**

- **Size.**
  - Diagram regions draw at the column's width and 340 px high, in pixel space.
  - The two axes scale separately, capped at 8.1 px per unit across and 5.6 down.
  - Pins are 30 px and labels 12 px.
  - `placeLabels` is ported to pixels, with its viewBox re-derived. The zero-overlap test for
    Threshold is ported too.
- **Tiled regions** (floor 0) keep today's letterbox, so the pixel art is never stretched.
- **Districts.** District areas are tinted (a cell per known pin, coloured by its area) and named.
  Ghost pins add no cell.
- **Roads**, from `visibleEdges` only:
  - width by road class;
  - an arrowhead where there is no road back;
  - forced roads red, with a ring on the receiving pin;
  - shut roads shown as a gap with a bar.
- **Region exit labels keep their rendering and their tutorial classes** (`tutorial-target`,
  `beacon-text`, `beacon-arrow`). On floor 0 they are the only way out. A DOM test checks
  `exit:ascent_foot` at the gate.
- **Feature chips** are static, from `spotFeatures`, with no cycling.
- **Threat text** ("L7-9") comes from `eligibleEncounters` of discovered spots: public lines only, slain
  `once` lines excluded.
- **Ground** comes from `AreaDef.ground` (default from `sceneFor`) and is drawn by code. No painting.
- **At 1094 px** (main column 818 px) the map keeps full labels. Below 560 px it labels only here and
  the neighbours.
- **Save change:** no. The hover card is replaced by a click card (§9, 2026-11-04).

**N4. Tower section.**

- **Placement.** A column left of the floor plan, replacing the floor tabs.
- **Rows** come from `ladderBands`, bottom to top:
  - status per row;
  - number and name;
  - an unreached floor by number only;
  - the next band by name only.
- **No level ranges.** A range derived from a floor's spots would print rooms the player has not
  entered.
- **Climbing.** A row click shows that floor and its terms and Climb button. The Ascent panel keeps
  its terms but loses its buttons above 600 px, so the page has one travel control.
- **Shared source.** `rungView(state, floor)` feeds both the section and the Ascent panel, including
  the festival forfeit arming.

**N5. Route line.**

- Select a pin (a click opens its card) to draw the route with each leg's time. The route follows the
  selected pin and goes when the card closes. Hover draws nothing.
- While travelling, done legs are solid, remaining legs dashed, and a marker sits on the current leg.
- No route has three causes:
  - a hidden road: nothing is drawn;
  - an uncleared forced spot in the way: no terms are shown;
  - a ride the ladder refuses: its `rungTerms` are shown.
- The card's content is the old hover card's. It opens on a click, not on hover (§9).

**N9. Painted ground plates (optional, user-painted).**

- A tiled map with a code-roads flag draws code roads over a ground-and-props picture: 48 × 21 tiles
  shown at 16 px per tile (768 × 336).
- The user paints about 0.5 h per floor, 8–16 h for 20 floors plus Threshold (estimate).
- Without the packs, N3's code ground shows.
- The map format gains a field, and tests/tilemaps.test.ts and the forge printer learn it.
- It re-pitches none of the shelved stories (autotile, generator, glitch doors).

### 5.3 Direction B: the place first, the map in a window

**N6. Place and Exits, with an Atlas window.**

- **The page shows:**
  - the scene art at 160 px;
  - the activity strip;
  - an Exits block;
  - then description, People, Workbenches and Crafting.
- **Exits** list this spot's roads, then the ladder moves down and up, each with its time and terms.
- **In Threshold**, Exits is a directory of the 27 places by district.
- **The map and the ladder** move into an Atlas window, unchanged inside.
- **Floor 0** keeps the inline map, for the tutorial.
- **Reverses** two past calls:
  - "the map is the one travel control" (2026-09-13);
  - the removal of the Travel list (2026-09-13): the Threshold directory is a list of places.
- **Changes** the C3 layout (2026-11-03).
- **Do not combine with N4.** The section lives in the map panel, which N6 moves into the Atlas, and
  Exits already shows the ladder moves.

### 5.4 The verb: pick work, not a place

**N7. Stations row.**

- **What a station is:** a spot whose `resumeActivity` key exists, newest first, up to 5, excluding
  where you stand. The first row reads "Back".
- **Eligibility** uses the knockout-return K1 list. A station is never offered when:
  - it is a forced spot;
  - its route's last hop is a forced road;
  - it is on a festival floor;
  - it is the stronghold wall;
  - it is undiscovered;
  - its floor is not unlocked;
  - it has no route;
  - `canStartActivity` is false.
- **Rows** use GoButton, so the "no retreat" warning shows where it applies.
- **Overlap with the knockout plan.** After a knockout, the fall spot is the newest station, so "Back"
  is the manual form of K1's automatic return. Docs/plans/knockout-return.md §5 rejected a "Back to
  work" button as a go link. One owner must be chosen before either ships (question 3).
- **Wayfinding.** Stations outside town are go links. Wayfinding then sells only:
  - quest go links outside town;
  - "Trains at" to discovered places not yet worked.
- **Effect on the errand:** 4 clicks, 0 scrolls, 0 stops.
- **Save change:** no.

**N8. Errands view (alternative to N7).**

- **Placement.** An Errands | Map toggle in the map panel.
- **Rows** are grouped by purpose: shop, bench, rest, hunt (public levels only), floors. Each row shows
  its route time and Go / Go & open / Go & start.
- **"Go & return"** stores `returnTo` in UI memory, so it is lost on reload.
- **Reverses** the removal of the Travel list.
- **Collides** with K1's `pendingReturn`.
- **Effect on the errand:** 3 clicks.
- **Recommendation:** hold until the knockout plan is decided.

### 5.5 Not taken

- **A work queue that auto-starts stations.** It overlaps the knockout plan.
- **Priced portals or skips.** Seconds are not the cost the player feels.
- **Content on the walk.** The data has almost no route choice.
- **Reviving the caravan by making landings waypoints.** CONFIRMED to skip the festival lockout and
  the royale door: `fastTravelTo` has none of `climbTo`'s checks.
- **A command palette.** Ruled out 2026-11-03.

## 6. Antagonist objections and rulings

All accepted. The fixes are written into §5.

| # | Item | Objection | Evidence | Ruling |
|---|---|---|---|---|
| 1 | N3 | The redraw omitted region exit labels, the only way off floor 0 | code, argued | Exits and their tutorial classes kept, plus a DOM test |
| 2 | N2 | Landings as waypoints skip the festival lockout and the royale door | probe, confirmed | Revive dropped; caravan row removed |
| 3 | N1 | A planned route into floor 15's hall starts a festival attempt | probe, confirmed | Festival landings not routed; `festival:door` reset on win and loss |
| 4 | N7 | Wrong statement of what Wayfinding keeps; not priced | probe, confirmed | Corrected; put to the user |
| 5 | N7 | "Back" is the rejected knockout "Back to work" button | probe, confirmed | Named; one owner (question 3) |
| 6 | N7 | A station behind a forced last road walks into a fight | data, confirmed | K1 eligibility list, GoButton warnings |
| 7 | N4 | Derived floor level ranges print unentered rooms | probe, confirmed | No level ranges in the section |
| 8 | N6 | The Threshold directory is the removed Travel list | text | Flagged as a reversal |
| 9 | N8 | `returnTo` has no store and collides with K1 | text | UI memory; hold until K1 is decided |
| 10 | N3 | Stretching would distort drawn floor 0 | code | Tiled regions keep the letterbox |
| 11 | N4 | Three travel controls on one page | text | Ascent panel loses its buttons above 600 px |
| 12 | N1 | Planned ride legs need an execution-time gate | code | Same gate as `climbTo`; blocked-leg test |
| 13 | N5 | Three no-route causes have no road to draw | code | Enumerated in the spec |

Notes taken:

- Threat labels read `eligibleEncounters`. 16 spots have every line gated and correctly print nothing.
- A ghost pin can sit on another area's tint. This is a false hint, not a leak.
- N9's `meta` is reserved for the generator, so the new field needs the printer and the format test.
- The antagonist did not verify the "0–1 overlaps at 788 px" figure. The ported `placeLabels` test
  decides it.

## 7. Recommendation

1. **N1 + N2 now.** They fix the split controls and the dead row, reverse nothing, and need no save
   change.
2. **Direction A for the look:** N3 and N5 first, then N4. This answers "looks lackluster" on every
   screen with no painting. It keeps the map, the cards and every past call except the badge cycling.
3. **N7 Stations for the verb**, if the user accepts its Wayfinding and knockout trade-offs
   (questions 2 and 3). Otherwise neither N7 nor N8.
4. **N6 only if** the user prefers a page that leads with the place over a better map. It is the larger
   change, and it reverses two past calls.
5. **N9 later, as the user's painting time allows.**

## 8. Questions for the user

1. **Map first or place first?** Direction A keeps the map on the page, larger and clearer. Direction B
   (N6) puts the place and its exits first and the map in a window.
2. **Stations outside town.** May places already worked get free go links? Wayfinding would keep quest
   links and "Trains at" to places not yet worked. Or should stations outside town need Wayfinding?
3. **After a knockout: one owner.** The knockout plan's automatic return (K1), or a manual "Back" row
   (N7), or both?
4. **Stretch.** May diagram maps stretch to the column's width? x can be up to 1.9× y. The forge's
   map editor still shows 4:3.
5. **Level ranges.** Should pins show monster level ranges ("L7-9") for discovered places?

## 9. Decisions (user, 2026-11-04)

Marked on the decision page. Every mark matches the recommendation in §7.

| Item | Decision | Effect |
|---|---|---|
| N1 Ride edges | Approved | Build |
| N2 Corrections | Approved | Build |
| N3 Surveyed plan | Approved | Build |
| N4 Tower section | Approved | Build |
| N5 Route line | Approved | Build |
| N6 Place and Exits | Rejected | Direction A: the map stays on the page |
| N7 Stations | Approved | Build, after knockout-return |
| N8 Errands | Hold | Not built |
| N9 Painted plates | Hold | Not built; the user paints when time allows |
| Q2 Stations outside town | Free | Worked places get free go links. Wayfinding keeps quest go links outside town and "Trains at" to discovered places not yet worked |
| Q3 Knockout owner | Automatic return | knockout-return K1 owns knockouts. While `pendingReturn` is set, Stations does not offer the fall spot |
| Q4 Stretch | Approved | Diagram maps stretch to the column's width, capped at 8.1 px per unit across and 5.6 down |
| Q5 Level ranges | Approved | Discovered pins print "L7-9" from public encounter lines (§5.2 N3) |
| Hover card (user, 2026-11-04, during N3 + N5) | Replaced by a click card | A click on a pin selects it and opens its card; a second click on it walks; Escape, a click outside, a tab switch or folding the map closes it. Hover opens nothing. Region exit labels stay one click with no card. The route line follows the selected pin. Reverses "the user did not want the map hover cards changed" (2026-10-18, §1). The floor 0 tutorial's pin steps (`cellblock`, `field`, `gate`) take two clicks and say so |

## 10. Build order

All branches stack on `ui-integration` until that lands on main.

1. **Wave 1, in parallel.**
   - N1 + N2, one builder. Owns `locations.ts`, `towers.ts`, `festival.ts`, `src/ui/lib/navigation.ts`,
     `MapCard.svelte`, `tutorialFocus.ts` and docs/TUTORIAL.md.
   - knockout-return (its own card), one builder. It does not edit the files above.
2. **Wave 2.** N3 + N5, one builder (both redraw `MapCard.svelte`).
3. **Wave 3.** N4 (the map panel and `AscentPanel.svelte`), then N7. N7 needs N1's ride edges and
   knockout-return's `pendingReturn`.

## 11. Build log

**N1 + N2:** branch `nav-ride-edges` ebd0d66, merged into `ui-integration` 6aefa44.
`npm run verify` passed with 3,300 tests. Antagonist-code verdict: SHIP.

Builder decisions kept:
- Hub and band-hub ride edges also need the stop's spot discovered (secret content).
- A road to a place wins over a ride to it, so the ladder does not bypass a shut road.
- `startTravel` rides when no road leads to the target.
- The map focuses the journey end only when that spot is discovered.
- Region tabs always include the region on show.

Finding ruled against:
- **Finding.** Ride edges exclude the landing of the floor underfoot. From the floor-1 office
  rooms (one-way pocket, no road back) the route to `f1_landing` goes via the Foot, 90 ticks,
  while core `climbTo` to the own floor would ride 45.
- **Ruling: kept.** The Ascent panel never offers the current floor's rung
  (AscentPanel.svelte:147). An own-floor edge would add a 45-tick jump to the landing from any
  spot on any floor.

John's pacing table moved by one cell (dagger, seed 7, floor 2: 6.4 to 6.3 min). The cause is the
intended route from `f1_reception` by the ladder. No expectation was edited.

Left for later:
- The ⚡ waypoint mark on pins no longer has a function; it goes in N3.
- Stale caravan text in README.md, docs/CONTENT_GUIDE.md and docs/NAVIGATION.md §2.1/§2.3 is fixed
  after knockout-return merges.
  Done: ⚡ removed in N3; caravan text fixed on `ui-integration` 395e152 and docs/FORGE.md in
  nav-plan.

**N3 + N5 + click-to-open pin card:** branch `nav-plan` 2e26d4c, nine fix commits (tip 7778379),
merged into `ui-integration` 35f6992.
- **Checks.** `npm run verify` on the merged tree passed with 3,454 tests.
- **Scope added by the user (§9).** No hover card. The first click opens the pin's card; a
  second click walks. Region exits stay one click.
- **Antagonist-code: FIX FIRST.** All findings accepted and fixed:
  - the threat map rebuilt the plan per tick (now a stable Map);
  - the gate card covered the tutorial's "→ Threshold" exit (the card now keeps clear of exit
    labels);
  - the journey line named an undiscovered destination;
  - label overlaps at the real column widths of 703 and 757 px (`placeLabels` reworked; the test
    sweeps 680–1100 px and the measured widths);
  - blue-arc district tints (now warm and neutral tokens);
  - two older layout jumps: the journey line slot and the strip height are now fixed.
- **Manager additions:**
  - `routeInfo` no longer prints a time for a hidden road;
  - Tab moves from the selected pin into its card, and Escape returns focus to the pin;
  - docs/FORGE.md waypoint text.
- **After the merge.** At 1094 px the header clock's hour text changed width by 7 px (this face
  has no tabular figures). Fixed with a fixed slot (`.timesense` min-width 7.1em under 1180 px).
- **Kept in the UI:** `AREA_GROUND` (src/ui/lib/mapPlan.ts) holds ground per area. No core
  `AreaDef.ground` field yet.
- **Open:**
  - phone width (part of A3);
  - forced-road rendering on floors 12–14 and 19–20 checked in tests only;
  - the strip can still grow if its activity buttons wrap to a second row.

**N4 tower section:** branch `nav-section` (stacked on `ui-integration` 836da70). The rules are
docs/NAVIGATION.md §3.5. `npm run verify` passed with 3,506 tests (2 icon tests skip without the
packs). Antagonist-code: not yet run.

Built:
- `ui/TowerSection.svelte` (the column), `ui/StopDetail.svelte` (terms and button under the map),
  `rungView` / `bandHubView` / `towerHubView` / `towerSection` in `ui/lib/ladderView.ts`,
  `ui/lib/rideArm.svelte.ts` (the shared forfeit arming), `ui/lib/viewport.svelte.ts` (600 px).
- The floor tabs are gone. The Ascent panel prints terms only at 600 px and wider, and keeps its
  buttons under it.
- `tests/towersection.test.ts`: a button is offered exactly where `climbTo` / `climbToHub` take the
  ride, in ten states including the festival's; the price equals `travel.total`; no name for a floor
  not reached; the 600 px rule; floor 0 draws no section.

Builder decisions kept (the brief did not cover them):
- The detail (terms and button) sits under the plan, as in the mockup, in a 100 px slot, not in the
  184 px column. The column is 184 px so a floor's plan stays 581 px at a 1094 px window.
- The 600 px rule: at 600 px and wider the detail has the button and the panel prints terms and a
  "Show in map" button. Under 600 px the section is a closed fold in every region with no button, and
  the panel keeps its buttons. One set of ride buttons at every width.
- A tab for the tower's region whenever the ladder answers where the player stands, before any floor
  is found. Without it the first ride onto floor 1 had no button at 600 px and wider.
- A ride from the city is two clicks: the tab, then Climb on the default stop (fix round 1). The
  default is the floor underfoot; from the city, the Foot or a band hub the highest floor with a place
  found (the old floor tabs' choice); on a new run the lowest open floor. "Show in map" opens the
  same tab and default.
- A region with no section draws its plan 106 px taller after the tutorial, so a ride that switches
  the map between the city and the tower moves nothing below it (`PlanOptions.height`, a one-line
  addition to `lib/mapPlan.ts`). The pane is a grid in both layouts: the route line's margin no
  longer collapses into the region tabs' (4 px more gap than before, in every region).
- A button is offered only where the core's gate (`rideGate`) says so. The panel showed one on a
  floor that was cleared and not unlocked; `climbTo` refused it.
- The ride's time is at the current travel speed (`climbTo`'s figure). The panel printed base ticks.
- Ride buttons are disabled while a ride runs, as well as when knocked out or in a forced fight.
- The Foot's row leaves the plan as it is (it is in Threshold); the castle's hub shows its own plan
  when its row is picked.
- A floor with no spot found shows an empty frame and "Floor n" on the map toggle, not its name.

Fix round 1 (manager's rulings; separate commits on `nav-section`):
- **Forfeit arm.** The arm was module state cleared only by a row click or the end of the attempt:
  arm the hub in the hall, walk to the stores, press once, and the attempt ended. The arm now holds
  the stop's key, the spot and the layout; it reads null when any differs or a walk is under way, and
  an effect (`syncArm`) clears it so walking away and back does not revive it. Test: the
  hall-stores sequence through the real `Game`.
- **Default stop.** The detail always has a stop when the tower's tab is shown (above). The click
  count of the ride from the city is two. Test: the default per standing place, a new game after the
  tutorial and a run after a prestige.
- **Narrow width.** Under 600 px the fold opens above the plan and pushes the page down; the player
  opens it, so it is allowed (NAVIGATION.md §3.5). Documentation only.
Not changed, seen while measuring: `LocationPanel.svelte` swaps the place panel and the Ascent
panel for the destination preview while a ride runs. The page height went from 1,771 to 1,055 px
at the start of a ride (1,094 px window). With the page scrolled past the new maximum the browser
clamps the scroll position and the map moves on screen by the difference (10 px measured). Nothing
above the swap changes its box. Fixing it means keeping the swapped block's height, in
`LocationPanel.svelte`.
