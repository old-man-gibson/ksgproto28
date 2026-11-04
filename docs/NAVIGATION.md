# Navigation

*Moving around the world, and what the game does so walking is not dead time.
Built 2026-09-13 (save v53): `systems/locations.ts`, `systems/actions.ts`
(`settleArrival`, `trainingSpots`), `systems/bonustime.ts`, `ui/MapCard.svelte`,
`ui/panels/DestinationPreview.svelte`, `ui/lib/navigation.ts`,
`ui/lib/GoButton.svelte`. Ride edges added 2026-11-04 (§2.6, `systems/towers.ts`).*

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

## 3. The map (`MapCard.svelte`, `lib/navigation.ts`)

The map is the one travel control. The old Travel list is gone; everything
it said moved onto the map:

| The list said | The map says it as |
|---|---|
| destination name / "Unknown place" | node label, card header |
| road label and walk time | card route line (`routeInfo`: legs, time at current travel speed) |
| one-way | dashed line; card warning |
| no retreat | red line, ⚔️ on the node; card warning |
| shut, with terms | dotted line with 🔒 at its midpoint; card "Shut: terms", Walk disabled |
| roads into another region | the `→ Region` exit label, now clickable with its own card |

- **Node labels** go under the pin unless that lands on another pin, badge,
  exit or label; then above, right, left or a diagonal (`placeLabels` in
  `lib/map.ts`). A crowded corner still needs its pins spread in the data:
  `tests/map.test.ts` holds Threshold to zero overlaps. A drawn region
  (docs/TILEMAPS.md §1) shows no road lines; its picture shows the way.
- **Feature badge**: an icon above each known node for what stands there,
  cycling every 1.5 s, with a `+` when there are several (`spotFeatures`).
  Order: quests ready to turn in ✅, quests available 📜, shops 🪙, benches
  (their own icon), rest (its own icon, "(your haven)" when it is one).
- **Hover card** (also opened on keyboard focus): route and warnings, Walk
  here, the features with Go / Go & open / Go & start, and every activity
  with Go & start. At the current spot the buttons are Start / Open. At the
  end of the journey in progress they become "On arrival" toggles.
- **Folded map**: the roads out of here show as a row of buttons, so folding
  never hides the only way to travel.
- `visibleBenches` moved from LocationPanel to `lib/navigation.ts`, so the
  room and the map hide the same locked benches.
- **Region tabs** (2026-11-04) show only regions with a discovered spot, plus
  the region on show and the one the player stands in (or walks to).
- **While walking**, the map shows the region and floor where the journey ends
  (`journeyEnd`). An undiscovered end is not shown: the map stays on the spot
  underfoot. Setting out, retargeting and arriving clear a tab the player had
  opened by hand.
- **Ladder rides** are routes like roads (§2.6). The card's route line reads
  "Ladder: descend · 18 s" for one ride, and "n legs" for a ride plus roads.
- **The Caravan row is gone** (2026-11-04). Its only stop was the Foot, so it
  never had a destination. `fastTravelTo` and `canFastTravel` stay in the core
  and the Foot keeps `waypoint: true`: the "every spot can get home" lint
  anchors on the flag. A pin still wears the ⚡ for a waypoint.

### 3.1 The Location screen, top to bottom (`LocationPanel.svelte`)

Changed 2026-11-03 (UI proposal C3, docs/plans/ui-proposals.md). No save change.

1. **Strip** (class `act-strip`). Standing still: the spot's activity buttons,
   the Next bar (only while an activity with a cycle runs) and the exploration
   bar with its find ticks and "Found n of m". Walking: the travel bar and its
   remaining time. A spot with no activities and no exploration draws no strip.
   The activity buttons keep `.tutorial-target` (TUTORIAL.md §5).
2. **Map** (`MapCard.svelte`). Unchanged, hover cards included.
3. **Festival panel**, while an attempt holds the player.
4. **Walking:** the destination preview (§4). **Standing still:** the place
   panel (banner, description, key items, sea panel), People and shops,
   Workbenches, Crafting, then the ladder (`AscentPanel.svelte`) where a stack
   is reachable.

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

**Rung terms.** `rungTerms(gs, floor)` and `hubTerms(gs, band)` hold the
ladder's term selection for every state: `locked` (floors 15 and 16 after a
lost festival attempt), `closed` (floor 16 outside an attempt), `shut` (floor
16 while the dark room fights), `gated`, `sealed`, `open`, `cleared`. A hub has
terms only while gated. Each term keeps the condition it was built from
(`cond`). AscentPanel draws them; a later next-step line calls the same
functions so the two cannot disagree.

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

- The hover card overlaps neighbouring nodes on a narrow panel.
- The defeat retreat is not an arrival and does not resume the haven's
  activity. The knockout return (§2.1) walks back to the interrupted work
  instead. The character idles after a knockout only when the fall cannot be
  returned to and no proven hunt is usable.
