# Navigation

*Moving around the world, and what the game does so walking is not dead time.
Built 2026-09-13 (save v53): `systems/locations.ts`, `systems/actions.ts`
(`settleArrival`, `trainingSpots`), `systems/bonustime.ts`, `ui/MapCard.svelte`,
`ui/panels/DestinationPreview.svelte`, `ui/lib/navigation.ts`,
`ui/lib/GoButton.svelte`.*

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
journey (`tickTravel`, which also covers tower climbs) and the caravan
(`fastTravelTo`). An ambushed arrival never settles; the forced fight owns it.
An intermediate halt of a multi-leg journey never settles either.

On a peaceful final arrival, in order:

1. **Intent.** `state.travelIntent = { spot, activity }`, set by "go and do".
   If its spot is where you arrived, that activity starts.
2. **Resume.** Otherwise `state.resumeActivity[spot]`, the last activity
   chosen there, restarts.

Either is skipped if the activity cannot start now (`canStartActivity`: it
exists at the spot; a craft is unlocked and affordable).

`resumeActivity` is written by `selectActivity`: choosing an activity records
it, and deselecting by hand deletes the entry, so a spot left idle on purpose
stays idle.

`travelIntent` is cleared by everything that changes the plan: a plain
walk (`startTravel` unplanned, `travelPlanTo`), `selectActivity`,
`cancelTravelPlan`, the caravan, a climb, a performance, the defeat retreat,
an ambush and a blocked route. It is consumed on arrival. It survives a save.

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
destinations (tests/map.test.ts), which is what the caravan price uses.
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
  (floor 0 → Foot 30, Foot → the hold 90). Walking in town pays
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

## 4. Destination preview (`DestinationPreview.svelte`)

Shown under the travel bar while walking. It shows where the journey ends: the
breadcrumb, description, what arrival will do ("start" for an intent,
"resume" for a resume entry, or nothing queued), every activity as an
arrival toggle, the features with "Open on arrival" for benches, people and
exploration. An unknown destination shows nothing but that it is unknown.

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

- Tower floors are reached by `climbTo`, not roads, so `findPath` cannot
  route onto a floor; go links to floor spots from Threshold are disabled.
  Routing through the ladder (hub ↔ landing as priced edges) would fix it.
- The hover card overlaps neighbouring nodes on a narrow panel.
- The defeat retreat does not resume the haven's activity (retreat is not an
  arrival; the defeat rule of 2026-09-12 accepted idling there).
