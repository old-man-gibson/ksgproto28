# Navigation

*Moving around the world, and what the game does so walking is not dead time.
Built 2026-09-13 (save v53): `systems/locations.ts`, `systems/actions.ts`
(`settleArrival`, `trainingSpots`), `systems/bonustime.ts`, `ui/MapCard.svelte`,
`ui/panels/DestinationPreview.svelte`, `ui/lib/navigation.ts`,
`ui/lib/GoButton.svelte`. Ride edges added 2026-11-04 (§2.6, `systems/towers.ts`).
Surveyed plan and route line added 2026-11-04 (§3.2, §3.3: `ui/MapPlan.svelte`,
`ui/lib/map.ts`, `ui/lib/mapPlan.ts`). Tower section added 2026-11-04 (§3.5:
`ui/TowerSection.svelte`, `ui/StopDetail.svelte`, `ui/lib/ladderView.ts`,
`ui/lib/rideArm.svelte.ts`, `ui/lib/viewport.svelte.ts`).*

## 1. Why

The user's complaint (2026-09-13): the clicking did not feel pleasant, though
it is standard for the genre. What made it unpleasant, found in the code:

1. Travel cleared the activity, so every errand ended with re-selecting work.
2. The location tab showed only a progress bar while walking.
3. Two travel controls that disagreed: the map routed anywhere but said
   little; a Travel list at the bottom of the page said everything but only
   reached neighbours.
4. Navigation asked "where" when the player thinks "what".

Travel itself stays. Forced fights, one-way roads, approaches, hidden paths
and Scouting XP all live on roads, so the fix removes the friction, not the
walking.

## 2. The rules

### 2.1 Arrival (`settleArrival`, actions.ts)

Called by every arrival path after its ambush check: the end of a walked
journey (`tickTravel`, which also covers tower climbs and ladder ride legs) and
the caravan (`fastTravelTo`, core only: no UI calls it since 2026-11-04). An ambushed arrival never settles; the forced fight owns it.
An intermediate halt of a multi-leg journey never settles either.

On a peaceful final arrival, in order:

1. **Intent.** `state.travelIntent = { spot, activity }`, set by "go and do".
   If its spot is where you arrived, that activity starts.
2. **Resume.** Otherwise `state.resumeActivity[spot]`, the last activity
   chosen there, restarts.

Either is skipped if the activity cannot start now (`canStartActivity`: it
exists at the spot; a craft is unlocked and affordable; a search has a reward
left to pay, `searchSpent`).

`resumeActivity` is written by `selectActivity`: choosing an activity records
it, and deselecting by hand deletes the entry, so a spot left idle on purpose
stays idle.

`travelIntent` is cleared by everything that changes the plan: a plain
walk (`startTravel` unplanned, `travelPlanTo`), `selectActivity`,
`cancelTravelPlan`, the caravan, a climb, a performance, the defeat retreat,
an ambush and a blocked route. It is consumed on arrival. It survives a save.

**Knockout return** (`systems/knockoutReturn.ts`, plan:
`docs/plans/knockout-return.md`, 2026-11-04, save v63). The defeat retreat
still moves the character to a haven and clears the journey and the activity.
It is no longer where the character stops. The knockout records the work it
interrupted (`state.pendingReturn`), recovery runs to 95% (or the hunt's rest
target, when higher; 60% if HP cannot recover), and the tick walks back with
`goAndDo`, or with `climbTo` to the target's floor and then `goAndDo` when no
road crosses floors. The activity starts on arrival.

- The return's arrival goes through `startActivity`, which does not clear the
  return. `selectActivity` is the player's pick and does clear it, as do the
  player's accepted travel, climb and caravan commands (`Game`) and a prestige.
  A win at the target also ends it.
- It never walks into a forced fight: not a forced spot, not a forced last
  road, not a spot reachable only through a forced spot, not `f11_wall`, not a
  festival floor. Those, and 5 knockouts in a row at one spot, fall back to the
  `proven` hunt (the last spot where 10 fights were won in a row), retried
  after 200 wins or 2 h; with no usable proven hunt the character waits at the
  haven and probes the target after 10, 20, 40, then 80 minutes. A target whose
  route is shut at the probe (or whose activity cannot start) is kept: the
  character hunts the proven spot for 200 wins or 2 h and tries again, or with
  no proven hunt holds again with the doubled wait. Only a spot the return
  never walks into loses its target.
- With no usable proven hunt, a spot with a fight budget stands in as the
  fallback if it was won at, not lost at since, and has fights left (the most
  recent win first; the proven hunt always wins over it). When its budget is
  spent the pick is made again, then the hold, or with no target the return
  ends.
- A knockout with no activity running and no forced fight (an idle character
  finished by a condition) sends the character nowhere. A forced fight lost
  with no activity selected is the ambush the player walked into, and counts
  as work: it falls back like any forced-spot loss.

### 2.2 Go and do (`goAndDo`, `setJourneyIntent`, locations.ts)

- `goAndDo(spot, activity)`: standing there, start it; otherwise
  `travelPlanTo(spot)` and set the intent. The activity must exist at the
  spot now; affordability is checked on arrival, so planning a craft while
  its materials are still being bought is a valid plan.
- `setJourneyIntent(activity | null)`: change what the journey in progress
  ends in (`journeyEnd` = last planned hop, else the current leg's target).
- Benches are UI, not state: "Go & open" sets `ui.benchOnArrival`, and
  LocationPanel opens the bench once standing still at that spot (any other
  stop drops it). A reload mid-walk loses it; that costs one click.

### 2.3 Unknown destinations (`findPath` `unknownDest`)

The map's `?` places, one visible road past known ground, are walkable.
`findPath(..., { unknownDest: true })` lets only the final hop be
undiscovered. Without the option `findPath` still refuses unknown
destinations (tests/map.test.ts), which is what the caravan price
(`fastTravelCost`, core only) uses.
Unknown names stay hidden everywhere: the card, the travel header, the
journey line and the log say "Unknown place".

### 2.4 The city has no fog (`systems/mapped.ts`, 2026-10-18)

User's call: Threshold is a directory, not a place to scout. The tower is
where scouting happens.

- `RegionDef.mapped: true` on `threshold`. Discovering any spot in a mapped
  region discovers all of them (`revealMapped`). One log line:
  `🗺️ Threshold mapped: 26 places added to the map.`
- Called on arrival (`tickTravel` → `logMapped`), on load (`deserialize`,
  which also covers saves from before the flag and town spots added later),
  and wherever a spot is discovered without a walk: tutorial skip, a new run
  (`prestigeNow`), the haven carry (`retreatToSafety`), a rumor find.
- Not at `createInitialState`: a new game starts in the holding cell with no
  town spot known. Revealing at creation would also have finished the
  tutorial's `leave` step (stood at the Foot = discovered) before the cell.
- Town roads are ×0.2 of their old length: Foot ↔ district gate 12 ticks
  (1 s), gate ↔ gate 18, gate ↔ room 8. The doors out of town keep theirs
  (floor 0 → Foot 30, the hold → Foot 90, one-way since the hold's door
  moved to floor 11 on 2026-10-30). Walking in town pays
  proportionally less Scouting XP (`t.total × 0.08`).
- NPC lines and spot texts that quote town road seconds say 1 s (2 s for two
  hops); retune them with the ticks.

### 2.5 Bonus time (`systems/bonustime.ts`)

User's choices (2026-09-13): banked 1:1, cap 8 hours (the offline catch-up
cap), spent only while the player toggles it on.

- **Idle** (`isIdle`): no activity, no travel, no bench run, no performance,
  no combat, not knocked out. Knocked out is not idle; banking it would pay
  the player for losing.
- **Accrual**: `accrueBonusTime` at the top of every `advance`, before
  anything moves. A paused world does not tick, so it banks nothing. Offline
  catch-up ticks, so time away idle banks.
- **Spending**: in `Game.tick`, after the normal advance, if spending is on,
  the bank holds a tick and the player is not idle, one tick is taken from
  the bank and a whole second `advance` runs. The clock, weather and
  statuses run double too: double speed means the world runs double. An
  idle tick is never doubled. `step()` (the debug crank) never spends.
- Offline catch-up with spending on simulates up to twice the ticks, so it
  also costs up to twice the CPU.
- UI: the ⏩ button in the top bar shows the bank and toggles spending.

### 2.6 Ride edges (`rideEdges`, `routableStops`, `rideLeg`; towers.ts)

Added 2026-11-04 (docs/plans/navigation-alternatives.md N1). No save change.
Before this, `findPath` walked roads only: standing on a floor, every
Threshold pin read "No open route from here", and the ladder's buttons were a
second travel control. The router now crosses the ladder.

- **Edges.** `rideEdges(state, from)` is derived on every call and never
  stored. From any spot where `towerAtSpot` holds (the hub, a band hub, any
  spot of a banded floor) it leads to each routable stop of that tower: the
  hub, each opened band hub, each unlocked floor's landing. Not to the spot
  itself, and not to the landing of the floor the spot is on (the ladder
  offers no ride to the floor you stand on).
- **Price.** `max(1, |rung difference|) × CLIMB_TICKS_PER_FLOOR / travelSpeed`,
  the price `climbTo` charges. Labels: "Ladder: climb", "Ladder: descend",
  "Ladder: cross".
- **Routable stop** (`routableStops`): the spot is discovered, the stop's own
  terms hold (`floorUnlocked`, `bandOpen`), and `festivalLadder` has no
  verdict. Never routed:
  - a landing of the Vermin Festival band (floors 15 and 16);
  - a floor that is not unlocked;
  - an undiscovered landing, hub or band hub, so no ride names a place the
    player has not been and the first ride onto a floor stays a ladder click;
  - any ride while a festival attempt is live.
- **Readers.** `findPath`, `startTravel`, `pathTicks` and `routeInfo`
  (`hopEdge`) read roads plus ride edges. `travelPlan` stays a list of spot
  ids; a hop between two spots with no road is a ride. A road to a place wins
  over a ride to it, so a shut road is not routed around through the ladder.
  `findPath` still never routes through an unfleeable fight.
- **Planned legs.** `rideLeg` runs a ride as one leg of a journey. It keeps
  `travelPlan` and `travelIntent` and logs nothing; a lone ride (`climbTo`,
  `startTravel` unplanned) clears both, as a climb always did. The leg is
  judged by `rideEdges` at the moment it starts, so a floor that shut after
  the plan was made stops the journey at the halt with
  `locations.route_blocked`, like a road that shut. `climbTo` and
  `climbToHub` reach the same terms through `rideGate`.
- **Festival door.** `festival:door` resets to 0 when an attempt ends, won or
  lost, as well as when one starts (festival.ts), so the dark room's road to
  the hall is shut whenever no attempt is live. Before, a won or lost attempt
  left it at 1 until the next attempt began.

## 3. The map (`MapCard.svelte`, `MapPlan.svelte`, `lib/map.ts`, `lib/mapPlan.ts`, `lib/navigation.ts`)

The map is the one travel control, and in a tower region it carries the
ladder's ride buttons too (§3.5). The old Travel list is gone; everything it
said moved onto the map:

| The list said | The map says it as |
|---|---|
| destination name / "Unknown place" | pin label ("???" for an unvisited place), card header |
| road label and walk time | route line above the map (§3.3: every leg and its time); card route line (`routeInfo`: legs, time at current travel speed) |
| one-way | arrowhead into the pin the road leads to; card warning |
| no retreat | red road, red ring on the pin it leads into, ⚔️ on a forced place; card warning |
| shut, with terms | gap in the road with a bar across it (tooltip "Shut: terms"); card "Shut: terms", Walk disabled |
| roads into another region | the `→ Region` exit label: one click walks, no card |

`MapCard` holds the state (which region and floor, the click card, the
journey). `lib/mapPlan.ts` `buildPlan` works out everything drawn, in pixels,
from game state and a width; `MapPlan.svelte` only draws it. Nothing in
`buildPlan` reads the DOM, so `tests/mapplan.test.ts` checks it directly and
`tests/mapcard.test.ts` renders the whole card on the server.

### 3.1 The Location screen, top to bottom (`LocationPanel.svelte`)

Changed 2026-11-03 (UI proposal C3, docs/plans/ui-proposals.md). No save change.

1. **Strip** (class `act-strip`). Standing still: the spot's activity buttons,
   the Next bar (only while an activity with a cycle runs) and the exploration
   bar with its find ticks and "Found n of m". Walking: the travel bar and its
   remaining time. A spot with no activities and no exploration shows one dim
   line, "No activities here." The strip is always drawn and at least
   `STRIP_MIN` (62 px) tall, and the travel strip is at least as tall as the
   standing strip it replaced, so starting or ending a walk, arriving and
   starting an activity do not move the map (2026-11-04, the user's no-shift
   rule; `tests/locationstrip.test.ts`). A strip that wraps to a second row
   (narrow column, many buttons) is taller than the minimum and keeps that
   height for the walk.
   The activity buttons keep `.tutorial-target` (TUTORIAL.md §5).
2. **Map** (`MapCard.svelte`, §3): the route line, then the surveyed plan.
   The click card (§3.3) replaced the hover card. In a tower region the tower
   section stands beside the plan and the stop's detail under it (§3.5); the
   floor tabs are gone.
3. **Festival panel**, while an attempt holds the player.
4. **Walking:** the destination preview (§4). **Standing still:** the place
   panel (banner, description, key items, sea panel), People and shops,
   Workbenches, Crafting, then the ladder (`AscentPanel.svelte`) where a stack
   is reachable: its terms, and its ride buttons only under 600 px (§3.5).

**Ladder bands** are `<details>` at every width (`lib/ladderView.ts`,
`lib/ladderFold.svelte.ts`). A band folds only when every floor in it is
cleared (a band pass counts), the player is not standing in it, and no card in
it (floor or hub) has a term that is not dim (`bandFoldable`). A cleared floor
can still carry one: floors 15 and 16 read cleared under a festival lockout,
and a band hub can be gated while its floors are cleared. A band that may not
fold stays open and its header does not toggle, so no gate or lockout term is
hidden. A folded band is one line: name, floor
range, "n of m cleared". The next band, shown by name only, is a plain header.
A foldable band is folded by default; the player's choice to open or fold it
lives in module memory and resets on reload. Opening and folding that the
panel does itself (walking into or out of a band) is not recorded as a choice.
The map's tower section (§3.5) folds by the same functions and the same store,
so a band folded in one place is folded in the other.

**Rung terms.** `rungTerms(gs, floor)` and `hubTerms(gs, band)` hold the
ladder's term selection for every state: `locked` (floors 15 and 16 after a
lost festival attempt), `closed` (floor 16 outside an attempt), `shut` (floor
16 while the dark room fights), `gated`, `sealed`, `open`, `cleared`. A hub has
terms only while gated. Each term keeps the condition it was built from
(`cond`). AscentPanel draws them; a later next-step line calls the same
functions so the two cannot disagree.

**Stop views.** `rungView(state, floor)`, `bandHubView(state, band)` and
`towerHubView(state, tower)` (`lib/ladderView.ts`) give one stop of the ladder
as the panel and the section both draw it: the mark, the terms (`rungTerms`,
`hubTerms`), "you are here" and the ride. The ride is the core's own gate: it
is offered when `rideGate` says `open`, `royale` or `forfeit`, and priced by
`rideTicks`, the figure `climbTo` charges. `tests/towersection.test.ts` checks
that a button is offered exactly where `climbTo` / `climbToHub` take the ride,
in ten states including the festival's, and that the price equals the ride's
`travel.total`.

### 3.2 The surveyed plan (N3)

Built 2026-11-04 (docs/plans/navigation-alternatives.md N3). No save change.

- **Frame.** One SVG unit is one CSS pixel. `MapCard` measures the width of
  the map's wrapper (`bind:clientWidth`); until the first measurement the plan
  uses 788 px, the column at a 1094 px window.
  - A **diagram region** is drawn at that width and 340 px high. The two
    axes scale apart, x at most 8.1 px per map unit and y at most 5.6, and the
    drawing is centred (`diagramFrame`). Pins are 30 px, names 12 px. A frame
    under 560 px takes 22 px pins and 11 px names, and names only the place
    underfoot and its neighbours (the place the map is about, while walking).
  - A **tiled region** (floor 0; docs/TILEMAPS.md) keeps its picture's
    proportions: at most 560 px wide, 100 × 84 map units on one scale, six
    units of headroom above the picture (`tiledFrame`). Pins and names scale
    with it. It has no districts, no ground and no road lines: the picture is
    the ground.
  - The frame's height does not depend on what is selected, walked or fought.
    It depends on the layout only: after the tutorial, at 600 px and wider, a
    diagram region with no tower section is 446 px high (340 plus the detail
    slot and its gap, §3.5), so the pane is as tall in the city as in the tower.
    A tower region's plan, beside the section, is 581 px wide at a 1094 px
    window and 565 px at 1440 with the log open (the column less 192 px); the
    label sweep in `tests/towersection.test.ts` covers every floor from 300 to
    700 px.
- **Names** (`placeLabels`): under the pin unless that lands on another pin,
  its chips or a name; then over it, to either side, the ends of the under and
  over rows, the corners and the rows slid sideways. The whole list is tried
  again at 6, 14, 24 and 36 px from the pin before a name may touch anything;
  a name that still touches slides a few pixels, then takes the free spot
  nearest its pin on a 6 × 4 px grid. Touching its own pin costs more than
  anything else. `tests/map.test.ts` checks every region and every floor with
  all its places discovered, at 680 to 1300 px in 20 px steps and at 703, 757,
  773 and 1237 px (the `.map-wrap` widths the browser gave at windows of 1024,
  1440 with the log column open, 1094 and 1920 px): no name on another name,
  on a pin or on a chip, and none outside the frame. It also holds Threshold's
  pins at least a pin's width apart at those four widths. A map the data
  crowds beyond what the search finds would still need its pins spread.
- **Districts.** Where the known places of a region span more than one area
  (Threshold), each known pin gets a Voronoi cell, no further than 130 px from
  it, tinted by its area (`districtTint`: nine theme tokens, taken in the order
  the region lists its areas, drawn at 20% opacity) and named in capitals. A name sits inside its own
  district's cells, clear of pins and names, on one line or two
  (`placeDistrictName`); an area with one known pin is named by that pin. A
  "?" pin adds no cell. A floor is one area and draws none.
- **Roads** are drawn from `visibleEdges` only.
  - Width by class (`roadClasses`, from the roads drawn): `main` leaves a
    junction of six or more roads (4 px), `road` joins two junctions of three
    (3 px), anything else is a `path` (2 px). A road to a "?" pin is dashed.
  - A road with no visible road back carries an arrowhead at the pin it leads
    into.
  - A road that walks into a fight with no way out, from either end, is red,
    and the pin it leads into wears a red ring (a forced place also wears ⚔️).
    A cleared place forces nothing, so its ring and red go.
  - A shut road is two pieces of road with a gap between them and a bar across
    the gap. The bar's tooltip reads "Shut: terms".
- **Region exit labels** (`→ Threshold`) keep their rendering and their
  tutorial classes (`tutorial-target`, `beacon-text`, `beacon-arrow`). On
  floor 0 the exit at the gate is the only way out. It sits right of its pin,
  or left when it would not fit. One click, Enter or Space walks; an exit has
  no card (it is not a spot). `tests/mapcard.test.ts` renders the card on the
  tutorial's last step and checks the exit and its classes.
- **Feature chips** are static: one 16 px chip per feature of a known place,
  from `spotFeatures`, up to four and then a `+n`. Each chip's tooltip is the
  feature's label. The badge no longer cycles.
- **Threat text.** A known place prints "· L7-9" after its name (`spotThreat`):
  the levels of the lines a fight there can draw now (`eligibleEncounters`: a
  slain `once` line is gone, a gated line waits for its terms), minus ambush
  windows (`SpotEncounter.window`), which are meant to be met. The level is
  the one `spawnMonster` gives: the line's rise, the band's step, then the
  band's dynamic levels (never on a `once` line). A place with nothing to
  fight, nothing left to fight (`spotCleared`) or only gated lines prints
  nothing. A "?" pin has none.
- **Ground** is drawn in code (SVG patterns, tokens from `app.css`) under a
  diagram: `groundFor` takes the area's ground, else the scene `sceneFor`
  gives (town cobbles, hall flagstones, crypt cracks, cistern water, webs).
  `AREA_GROUND` in `lib/mapPlan.ts` holds the areas whose ground is not the
  one their scene gives (floor 4, grass). It is the seam for an
  `AreaDef.ground` field, which the core data does not have yet.
- **The ⚡ waypoint mark** is gone from pins. `waypoint: true` stays in the
  data: the "every spot can get home" lint anchors on it.
- **What the plan may say** follows the secret-content law: a place is named,
  tinted, given a level or counted into a district only once discovered. A
  "?" pin is a pin, a road and a ring where its arrival is a forced fight.

### 3.3 The click card and the route line (N5)

Built 2026-11-04. No save change. The card replaced the hover card on the same
day (the user: the tooltip on hover is in the way). Nothing opens on hover: a
pin gets a pointer cursor and an accent outline, no more.

**The click card** (`lib/mapSelect.ts`; `MapCard.svelte` runs every event
through `selectionStep`):

- **First click** (or Enter or Space on a focused pin) on a pin, a "?" pin
  included, selects it and opens its card. The selected pin carries
  `aria-expanded="true"`, a filled accent-outlined dot and an accent name.
- **Second click** on the selected pin walks there (`walkTo`, the card's Walk
  here) and closes the card. On the pin underfoot, or while walking, it only
  closes the card. A click on another pin selects that pin and walks nowhere.
- **The card closes** on Escape, on a click outside the card and the pins, on
  switching the region or the floor shown (a row of the tower section), on
  folding the map, when the selected pin leaves the map, and when a card button
  walks (Walk here, Go, Go & open, Go & start). Start, Stop and On arrival leave
  it open.
- **Content**: route and warnings (one-way, no retreat, shut), Walk here,
  the features with Go / Go & open / Go & start, and every activity with Go &
  start. At the current spot the buttons are Start / Open / Stop. At the end of
  the journey in progress they become "On arrival" toggles.
- **Placement** (`placeCard`): right of the pin, else left of it, else under
  it, else over it, beside the pin's whole group (its name and chips too), so
  the card never covers the pin it describes and the second click lands on the
  pin. The card is a fixed overlay: opening or closing it moves nothing in the
  page. While it is open `MapCard` follows the pin one frame at a time, so it
  stays beside the pin when the page scrolls, the window resizes or the travel
  strip above the map appears. A pin that is gone, covered or scrolled out of
  reach of a click closes the card.
- **Keyboard** (`cardTab`). Enter or Space on a focused pin selects it, and
  focus stays on the pin; Enter again walks. The card is the last element of
  the page, so Tab on the selected pin enters the card's first button, Tab off
  its last button (or Shift+Tab off its first) returns to the pin, and
  Shift+Tab on the pin goes to the previous pin as the page orders them.
  Escape closes the card and, if focus was in it, puts focus back on the pin.
  Enter on a card button presses it. Measured with real key presses in a
  browser (Threshold, The Forges: 13 controls).
- **Region exit labels** are not spots and have no card: one click walks, as
  before.
- **Tutorial.** The steps that point at a spot pin (`cellblock`, `field`,
  `gate`) take two clicks, and their texts say so (TUTORIAL.md §5). The beacon
  stays on the pin through the first click.

**The route line** is one line above the map, always there at a fixed height
(22 px), so a route appearing or changing never moves the map or the page. A
route longer than the column is cut with an ellipsis; the tooltip holds all of
it. With nothing selected and no journey, it is empty. The journey line under
the map ("En route to X — 3s", Cancel journey) is a slot that is always there,
empty while standing, at least 2.5 em tall, so a walk starting or ending does
not move what is below the map.

- **Select a pin** and the route from where the player stands is drawn over
  the map, each leg with its time, and written above it: "Route to The Woods
  Edge: 3 legs, 21 s." then "The Granary Gate → The Foot of the Ascent 1.2 s →
  ride to Floor 4 18 s → The Woods Edge 2 s". A ride names its landing as
  "Floor n" once discovered, else "Unknown place". Times are at the current
  travel speed (`routeLegs`, `legTime`). The route follows the selected pin
  and goes with its card.
- **Cross-floor routes** draw only the legs whose two ends are on the map
  shown. A ride draws no line: the pin it leaves from, if on the map shown,
  carries a ladder mark.
- **Walking.** The line reads "Journey to …" and the route is the journey:
  legs walked are solid and dimmed, the leg under way is solid with a diamond
  marker at its progress, legs still planned are dashed. The save keeps the
  leg under way and the plan only, so `MapCard` remembers the legs behind it
  (`nextTrail`); a save loaded mid-walk draws from the leg under way. A ride
  leg's marker waits at its ladder mark. Selecting a pin while walking draws
  nothing more.
- **No route.** The line says "No open route to X." and then, by cause:
  - a hidden road: nothing more, and nothing is drawn. The card says "No open
    route from here" with no time either: `routeInfo` reads visible roads only,
    for the time and for a shut road's terms;
  - an uncleared forced place in the way (`findPath` never routes through
    one): nothing more;
  - a ride the ladder refuses (`routableStops` lacks the floor's landing or
    the band's hub): the terms the Ascent panel prints for that rung
    (`rungTerms`, `hubTerms`), only for a floor the ladder names
    (`floorReached`);
  - a road shut behind terms the player can see: "Shut: terms", as the card.

### 3.4 What else the map says

- **Folded map**: the roads out of here show as a row of buttons, so folding
  never hides the only way to travel.
- `visibleBenches` moved from LocationPanel to `lib/navigation.ts`, so the
  room and the map hide the same locked benches.
- **Region tabs** (2026-11-04) show only regions with a discovered spot, plus
  the region on show and the one the player stands in (or walks to), and the
  region of the tower whose ladder answers where the player stands (§3.5: the
  first ride onto a new tower starts from its section).
- **While walking**, the map shows the region and floor where the journey ends
  (`journeyEnd`). An undiscovered end is not shown: the map stays on the spot
  underfoot. Setting out, retargeting and arriving clear a tab the player had
  opened by hand.
- **Ladder rides** are routes like roads (§2.6). The card's route line reads
  "Ladder: descend · 18 s" for one ride, and "n legs" for a ride plus roads.
- **The Caravan row is gone** (2026-11-04). Its only stop was the Foot, so it
  never had a destination. `fastTravelTo` and `canFastTravel` stay in the core
  and the Foot keeps `waypoint: true`: the "every spot can get home" lint
  anchors on the flag. Pins no longer wear a ⚡ for it (2026-11-04, N3).

### 3.5 The tower section (N4)

Built 2026-11-04 (docs/plans/navigation-alternatives.md N4). No save change.
It replaced the per-floor tabs. A click selects a floor and shows it; the
button rides.

- **Where.** In a tower region (the Ascent's floors) the pane is two columns:
  the tower section (184 px) and the plan. The route line runs across the top,
  and the stop's detail (`StopDetail.svelte`, 100 px) sits under both. Floor 0
  is bandless and is not a rung: the tutorial's map has no section, no fold, no
  detail and no region tabs, as it had no floor tabs (`tests/towersection.test.ts`
  renders it). In Threshold, the Hold and the rest the section is not drawn.
- **Rows** (`towerSection`, `lib/ladderView.ts`). One row per card of
  `ladderBands`, so the section shows what the Ascent panel shows and no more:
  - highest band first, and inside a band the highest floor first with the
    band's hub last; the tower's hub (The Foot) closes the column;
  - a floor not reached is its number; a floor reached is its number and name;
  - the next band is a name and nothing else, and nothing is above it;
  - each row has a mark (the panel's: ✅ cleared, 🟢 open, 🔒 locked or shut,
    ⛔ sealed, 🚪 a door the festival closes), and its right cell says "here",
    the ride's time at the current travel speed, or "forfeit";
  - no level range: a range derived from a floor's spots would print rooms the
    player has not entered (plan §6 row 7).
- **Fold.** A band header folds by `bandFoldable` and the store in
  `lib/ladderFold.svelte.ts`, the same as the panel's. The progress is
  "cleared/total" of the floors shown. A band that may not fold is open and its
  header does nothing.
- **Height.** The column is exactly the plan's height (342 px with its border)
  and scrolls inside itself. Opening a fold or a ride starting moves nothing
  outside it. Arriving on a stop scrolls the column, not the page, to its row.
- **Click, not hover.** A row click picks the stop (`pickStop`, MapCard): the
  map shows its plan (`areaOverride`, and the region when it differs), the
  detail shows its terms and ride button. A click never rides, and nothing
  opens on hover (no tooltip on a row or on the detail). The row of the stop
  underfoot is marked and `aria-current="location"`; the row on show is
  `aria-pressed`.
  - The castle's hub shows its own plan once its row is picked (its area is a
    stack area). The Foot is in Threshold, so its row leaves the plan as it is.
  - A floor with no spot found shows an empty frame: "Nothing on this floor is
    on the map yet." Its title on the map toggle is "Floor n", not its name.
  - **Default stop** (`defaultStackArea`). Until a row is clicked the detail
    shows the stop of the plan on show, and the detail has a stop whenever the
    tower's tab is shown:
    - standing on a floor: that floor;
    - in the city, at the Foot or at a band hub: the highest floor with a place
      found (where the old floor tabs opened), so the hub's own plan is one row
      click away, not the default;
    - a new run with no place found on any floor (a new game after the
      tutorial, or after a prestige): the lowest open floor, the next climb;
    - no floor found and none open: no stop, and the detail says to pick a floor.
    From the city the ride is two clicks: the tower's tab, then the button.
  - The pick follows the plan on show until a row is clicked. It is dropped when
    the player arrives on another spot, and kept through a ride so the terms of
    the floor being ridden to stay up.
  - A walk or ride that ends in another region puts the plan on that region
    (§3.4), as it did.
- **The ride** is the detail's button (`pressRide`, `lib/rideArm.svelte.ts`):
  `climbTo(floor)`, `climbTo(null)` or `climbToHub(band)`. It is disabled while
  knocked out, in a forced fight or already riding. The festival's forfeit asks
  twice: the first press arms the button (its label becomes "Confirm: forfeit the
  festival"), the second runs it. The arm is one store shared by the section
  and the panel. It holds the stop's key, the spot the player stood on and the
  layout (600 px) that carried the button, and is void when any of them differs
  or a walk or ride is under way, so a press made at the hall does not forfeit
  from the stores (`armedKey`). An effect on the spot, the travel state and the
  width (`syncArm`) clears it, so walking away and back does not revive it. It is
  also dropped when another stop is picked and when the attempt ends. Off the
  ladder (standing in the city, not at the Foot or on a floor) a stop has no
  button and its detail says where rides start.
- **One set of ride buttons** (`lib/viewport.svelte.ts`, 600 px):
  - at 600 px and wider the section's detail carries the button and the Ascent
    panel prints terms only, with a "Show in map" button that opens the map on
    the tower's tab;
  - under 600 px the section is a fold ("🗼 The Ascent · floor", closed) in every
    region, with no button in its detail; the Ascent panel keeps its buttons.
  The flag is a `matchMedia` store, so a test sets it. A server render reads
  wide.
  - Narrow-width rule: the fold opens above the plan and pushes the page down.
    The player opens it, so the move is allowed; the fold's summary line is in
    the page in every region, so a ride that switches the map moves nothing.- **Tab for a tower not yet climbed.** The tower's region has a tab whenever the
  ladder answers where the player stands, before any of its floors is found. The
  first climb from the Foot is the tab, then Climb on floor 1 (the default stop).
  The panel's "Show in map" opens the same tab with the same default, so from the
  panel it is "Show in map", then the button.
- **No layout shift** (the user, 2026-11-04). The route line, the plan, the
  section and the detail have fixed heights. A ride that switches the map between
  the tower and the city moves nothing below the map: after the tutorial a region
  with no section draws its plan 106 px taller (`planHeight` in MapCard; the
  detail's 100 px and its 6 px gap), and the pane is a grid in both layouts so
  the route line's margin does not collapse in one. Measured at a 1094 px window
  in 384 samples over 19 s, every 50 ms, through a hunt, nine row picks, a fold
  opening, a climb to floor 5 with its arrival and a descent toward the Foot (the
  map switching to Threshold): the header, activity strip, route line, region
  tabs and journey line each kept one box; the plan kept its top edge, and the
  plan and detail together kept the bottom edge the city's taller plan has.
  The place panel and the Ascent panel below the map are swapped for the
  destination preview while a ride runs (`LocationPanel.svelte`, unchanged), so
  the page's height changes with a ride; at the foot of a scrolled page the
  browser then moves the scroll position and the map with it.

## 4. Destination preview (`DestinationPreview.svelte`)

Shown under the map while walking (the travel bar is in the strip above it).
It shows where the journey ends: the breadcrumb, description, what arrival
will do ("start" for an intent, "resume" for a resume entry, or nothing
queued), every activity as an arrival toggle, the features with "Open on
arrival" for benches, people and exploration. An unknown destination shows
nothing but that it is unknown.

## 5. Go links outside the map

### 5.1 Town places (no boon, 2026-10-18)

The Quests tab shows a Go button for any giver or objective whose spot is in
a mapped region (`inMappedRegion`), from the first run.

- Objective spot: `talk` → the NPC's spot; `reach` → its `spotId`; any
  other kind → its `at` hint (`QuestObjective.at`). `at` is display only;
  progress never reads it. A Taste of Everything sets it on all seven
  objectives (the Forges, the Granary Kitchens, the Alembics, the Cages ×2,
  the Reading Hall, the Nine Chapels).

### 5.2 Wayfinding (prestige boon)

User's call: go links to places outside town are a prestige unlock.
`wayfinding` (cost 2, one rank; PRESTIGE.md §4).

- **Quests tab**: the same Go buttons for givers and objectives outside
  mapped regions.
- **Skills tab**: "Trains at" under every expanded skill and attribute, with
  up to six known spots and Go & start (`trainingSpots`, actions.ts).
- `activityXpTags(act)` is the one list of tags an activity's cycle pays
  skill XP under. The tick branches and `trainingSpots` both read it, so
  "where does this train" cannot drift from what training pays. Hunting
  lists only `combat`/`hunt`: the fight adds loadout tags no spot can
  promise.

`GoButton.svelte` is the shared button: its tooltip carries the route time
and warnings, and it is disabled while travelling, knocked out, in a forced
fight, or with no open route.

## 6. Open

- The click card overlaps neighbouring pins on a narrow panel.
- A ride up from the city is two clicks, one more than the panel's button was:
  the tower's tab, then Climb on the default stop (§3.5). From the panel it is
  "Show in map", then Climb. A floor other than the default costs a row click.
- A floor's plan beside the section is under 560 px at windows narrower than
  about 1075 px (511 px at 1024), where the plan labels only the place underfoot
  and its neighbours. Floors have at most a few pins; the label sweep passes.
- Under 600 px the section is a closed fold above the plan and the page keeps
  the sidebar column (phone layout, UI proposal A3).
- The defeat retreat is not an arrival and does not resume the haven's
  activity. The knockout return (§2.1) walks back to the interrupted work
  instead. The character idles after a knockout only when the fall cannot be
  returned to and no proven hunt is usable.
