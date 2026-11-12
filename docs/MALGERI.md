# The Malgeri Crossing (floor 17)

*Built 2026-11-11: spots `f17_*` in `data/locations.data.ts`, monsters
`malgeri_*` in `data/monsters.data.ts`, the hamlet's two people in
`data/npcs.data.ts`, `MonsterDef.veil` and `NpcDef.lore` (types.ts), the veil in
`systems/bestiary.ts`, `tests/malgeri.test.ts`. The weather it stands on is in
WEATHER.md ("Region skies: the Malgeri Mountains").*

Floor 17 is the band "The Malgeri Mountains" (`ascent_aberrant`), one floor,
"The Malgeri Crossing" (`ascent_f17`, area `ascent_f17_area`). It replaced a
two-spot placeholder. It is a walk over a mountain in four maps, on a sky table
(fronts) with a calm that the game does not name until the player has stood
under it.

| | |
|---|---|
| Floor | `ascent_f17`, landing `f17_landing`, clear `boss:f17_keeper` (the Slime Regent's kill), 900 clear XP |
| Region and sky | area `regionId: 'the_ascent'`, `skyRegionId: 'malgeri_range'` (sky table `malgeri`); the area stays in the Ascent so the stack map and the tower section still count 20 floors |
| Spots | 18, four maps |
| Levels | plain 40 to 42, queen 43, peak boss 44, gate boss 45, calm lines 46 to 48 |
| People | Thora Ironbrand (hamlet forge), Captain Bren (hamlet square); no quests |
| Save | v65 (migration 64 in `save/migrations.ts`, section 2 "Old saves"); the first-calm flag is a plain `stats` counter (`flag:malgeri_calm_seen`) |

## 1. The four maps

Map coordinates are the diagram's, 0 to 100. Roof = the `indoor` tag (no
weather); the caves are also `dark`. Open = under the range's sky.

**Map 1, the cave out of the Vermin Festival (roofed, dark).**

| Spot | Name | Map | Does | Lines (weight, level) |
|---|---|---|---|---|
| `f17_landing` | The Cave Exit | 40, 69 | camp (rest, haven), hunt | goblin 40, deep spider 30, scree slime 30; L40-41 |
| `f17_cave_hub` | The Hub Cavern | 54, 67 | hunt; roads to the crack, the nest, the central caves | deep spider 40, scree slime 30, goblin 20, chief 10; L40-41 |
| `f17_cave_crack` | The Crack | 47, 56 | explore (200 ticks): 5 iron scrap, 4 rock salt, 60 to 120 gold | none |
| `f17_nest` | The Brood Nest | 61, 56 | one fight (`fightLimit` 1): the Brood Queen, L43, boss line, optional | queen 1, L43 |
| `f17_central_caves` | The Central Caves | 68, 68 | hunt | deep spider 30, downpour slime 25, scree slime 25, chief 20; L40-41 |

**Map 2, the eastern ascent (out of the cave).**

| Spot | Name | Map | Does | Lines |
|---|---|---|---|---|
| `f17_east_mouth` | The East Mouth | 84, 67 | roof, not dark; camp (haven), hunt | scree 35, goblin 35, spider 20, chief 10; L41-42 |
| `f17_east_ascent` | The Eastern Ascent | 90, 54 | open; hunt | plain 70 + sky + calm (section 3) |
| `f17_east_peak` | The East Peak | 88, 40 | open; hunt | plain 70 + sky + calm |

**Map 3, the ridge and the peak (the desert of floors 18 to 20 is in view).**

| Spot | Name | Map | Does | Lines |
|---|---|---|---|---|
| `f17_east_ridge` | The East Ridge | 74, 28 | open; hunt | plain 70 + sky + calm |
| `f17_west_ridge` | The West Ridge | 58, 20 | open; hunt; explore (200 ticks): the view of the desert, 3 thunderbloom, 40 to 90 gold | plain 70 + sky + calm |
| `f17_west_peak` | The West Peak | 42, 12 | roof; camp (haven), hunt | scree 35, goblin 30, spider 20, chief 15; L41-42 |
| `f17_peak` | Malgeri Peak | 18, 7 | open; boss only; gathers thunderbloom and green vitriol | Peak Guardian L44, weight 1, boss |

**Map 4, the western descent, ending at a hamlet before the desert.**

| Spot | Name | Map | Does | Lines |
|---|---|---|---|---|
| `f17_base` | The Mountain Base | 8, 18 | roof; camp (haven), hunt; six gathers (iron scrap, rock salt, quicksilver, fixing salt, bone ash, brimstone) | scree 35, goblin 25, spider 20, chief 20; L42 |
| `f17_path` | The Mountain Path | 22, 26 | open; hunt | plain 70 + sky + calm, L42 |
| `f17_old_path` | The Old Path | 10, 36 | open; hunt | plain 70 + sky + calm, L42 |
| `f17_hamlet_square` | Hamlet Square | 22, 46 | roof; haven (rest at the well); Stand Guard (30 gold per 200 ticks), Participate in Debates (trains Charisma), Turn the Handmill (rough flour); Captain Bren | none |
| `f17_hamlet_forge` | Kystel's Anvil | 8, 54 | roof, `heat`; Work the Bellows (30 gold per 250 ticks), Swing Practice Hammers (trains Strength); 15 recipes; Thora Ironbrand | none |
| `f17_keeper` | The Hamlet Gates | 24, 60 | open; boss | Slime Regent L45 weight 100 (boss), Regent's Legionary L42-43 weight 6 |

Roads: landing to hub (30 ticks); hub to central caves (40), crack (25), nest
(30); central caves to east mouth (55); east mouth to ascent (60) to east peak
(60) to east ridge (60) to west ridge (50) to west peak (60) to peak (60); peak
to base (120, gated); base to path (50) to old path (50) to hamlet square (40);
square to forge (20) and to the gates (30). Every road mirrors back; only the
peak to base road carries a condition, and the mirror drops it.

Content is copied from the shelf (`data/shelved/locations.shelved.ts`,
`npcs.shelved.ts`) under `f17_*` ids: the hamlet (without its two quest
chains), the base's gathers, the peak's gathers and the crack. The shelf is
untouched. Nakano Angou stays shelved. The hamlet's two jobs pay 30 gold (the
shelf paid 10 to 16).

## 2. Gates, the clear and the floor rules

- **The peak gate.** `f17_peak` to `f17_base` requires `boss:f17_peak` 1, the
  first kill of the Peak Guardian. The road is open both ways after. The
  hamlet side is reachable no other way: no `waypoint` on any spot of map 4, so
  fast travel cannot skip the gate.
- **Arrival at floor 18** is on foot from the hamlet's side (`f18_well_head`
  says so; there is no shaft). The clear is what opens floor 18.
- **The clear** is `boss:f17_keeper` 1. The regent's row has no `fightLimit`,
  so the counter latches on the regent's kill and a fight of legionaries alone
  (weight 6 against 100) clears nothing. A `fights:` clear would have counted
  the legionary fight.
- **The nest is optional.** No gate and no clear reads `f17_nest`. The
  queen's drops include boss tokens, spider silk garb, lucky charms and 60 to
  120 gold.
- **The boss fights are under open sky.** The peak and the gates take the
  range's weather statuses like any open spot.
- **No forced spot on the spine.** Every zone has a camp (roofed) and at
  least two non-forced endless hunts, one of them roofed where the zone has a
  roof.
- Bosses and the clear spot keep a line with no `sky` and no `daypart`.
  Boss and queen spots set `modifierWeights: { normal: 100 }`.
- `floorStructureIssues`, `exploreIssues` and the content lints pass
  (tests/malgeri.test.ts runs the first two on this floor).
- Fixed levels everywhere; no `dynamicLevel` anywhere on the floor.

**Old saves (save v65).** The placeholder floor cleared on
`fights:f17_keeper` (one fight at a spot the landing connected to). Migration
64 carries that over:
- `fights:f17_keeper >= 1` sets `boss:f17_keeper` and `boss:f17_peak` to at
  least 1. Floors 18 to 20 stay open; the clear XP stays latched.
- A save standing at `f17_keeper` without `boss:f17_peak` is on the far side of
  a gate it never opened. It wakes at `f17_landing` with its activity, journey,
  approach, resume entry and any pending return or proven hunt that names the
  spot cleared, and the spot is dropped from `discovered`.
- Idempotent: it only raises counters, and only moves a save that is still
  standing there. Test: tests/malgeriSave.test.ts.

## 3. Sky lines

Every open hunt spot (`east_ascent`, `east_peak`, `east_ridge`, `west_ridge`,
`path`, `old_path`) carries, beside its plain lines (weights sum to 70):

| Front | Line (weight 25, level of the zone) | Element |
|---|---|---|
| snow | Rime Slime | ice: Chilled 40% a hit; cold 0.8 resist, takes 60% more heat |
| heatwave | Cinder Slime | fire: On Fire 40%; ranged; takes 70% more cold |
| gale | Squall Slime | wind: ranged; takes 50% more lightning |
| storm | Storm Slime | thunder: Jolted 35%; ranged; lightning 0.9 resist |
| rain | Downpour Slime | water (my pick for rain): Wet 40%; takes 70% more lightning |

A sky line rolls only while the spot's sky is its front (`SpotEncounter.sky`).
Roofed spots carry no sky line (a lint rejects one). Each sky slime has its own
art key from the shelf's slime sheet. The five lines always sit beside plain
lines, so a front never empties a table.

## 4. The calm

**What it is.** One spell of `CALM_HOURS` = 8 game hours in each window of
`CALM_PERIOD_DAYS` = 12 game days (WEATHER.md). At 1 real second = 1 game
minute that is 8 real minutes in 4.8 real hours, 2.8% of the time. It is not a
front: no status comes with it. It is dangerous only through its monsters.

**The calm lines.** Each of the six open hunt spots carries three more lines,
all `sky: ['calm']`, levels 46 to 48:

| Line | Weight | Monster |
|---|---|---|
| calm | 100 | Ridge Wolf: elite beast, piercing, Bleeding 30%, Lunge, Hamstring, Gather |
| calm | 100 | Cairn Brute: elite construct, bludgeoning, Concussed 30%, resists slashing and piercing 60%, Heavy Blow |
| calm | 80 | Hollow Seer: elite caster, ranged dark, resists dark 50%, casts Gloom and Cut |

The calm weights sum to 280, four times the plain 70
(tests/malgeri.test.ts asserts the ratio). Under calm a spot draws a calm
leader about 80% of the time. Each of the three has `group: { min: 2, max: 3,
weights: { 2: 55, 3: 45 } }` and `escorts` among the trio, so a calm fight is 2
or 3 of the three kinds. The calm trio drops Ridge Amber (30 to 35 weight,
sells 70 gold, no use yet) and nothing else drops it.

Spawn mercy (`engine/mercy.ts`) suppresses a line under 15% of the table in a
fresh state, so the first draws of a calm are plain-weighted more than the
long-run 80%; the long-run mix is exact.

**Measured** (John saved at floor 17's door, one fight per trial from full
HP, 60 trials a cell, seed 42): against L41 John a plain day hunt wins 95 to
100% (4 s a fight, 140 to 175 of 810 HP lost). A forced calm at the east ridge
wins 32% of fights, 28% of the fights that include a calm line, at 9.6 s and
about 500 HP lost on a win. At L44 (841 HP) the calm wins 33% and 35% at the
ridge and the path. The calm kills a L41 to L45 climber more often than not.

**Knockouts in a calm.** Five knockouts in a row at one open spot send the
knockout return to a fallback hunt (docs/plans/knockout-return.md, 2.3). With no
proven hunt and no won-at budgeted hunt, the fallback is a roofed hunt: a
discovered `indoor` spot of this floor with no `fightLimit`, the lowest level
first, then the one found first (the cave mouth, 40 to 41). A roof takes the
spot out of the sky, so the calm lines never roll there. Without this pick the
return held at the haven for 10 to 80 minutes, which the knockout rule forbids
(a knockout must not leave the character idle). The pick applies on every floor,
and a knockout at it follows the proven fallback's rule: back to it, and a hold
only after five in a row there.

## 5. The disclosure rule

Calm is quasi-hidden. Until `flag:malgeri_calm_seen` (`CALM_SEEN_KEY`) is set,
no text names calm, its monsters or Ridge Amber, and no number gives them away.

| Where | Until the flag | After |
|---|---|---|
| Spot, find, band, floor text of floor 17; `f16_arena`; `f18_well_head` | never names calm | unchanged |
| Hamlet NPC lines | base dialogue never names it | Captain Bren (`f17_bren`) gains one `lore` line: the mountain goes still 8 hours in 12 days, who comes out and at what levels, roofed places are not reached |
| Plain Malgeri monsters' text | never names it | unchanged |
| The log | `exposure.calm_first` fires once, at the first minute under a calm open sky (live or catch-up; the offline summary carries it when the log is suppressed); it is the only calm text | unchanged |
| Bestiary | the trio are veiled: kills count; no entry, no first-kill line, no discovery XP, no facts, not in the book's total | the entries of species already killed open when the flag is stamped; others open on their first kill |
| Map badge (`spotThreat`) | plain levels only (L41-42) | the calm levels join the range under a calm sky (L41-48) |
| Weather chip and forecast | show the kind like any kind; the rough read says "plain skies" | unchanged |
| Ridge Amber's text | names no calm | unchanged |
| Spot encounter lines | the player UI reads them only through the badge (row above) and the spawn; the forge shows all | unchanged |

The tests: `tests/malgeri.test.ts` scans the floor's text for `calm`, the three
monster names, Ridge Amber, and the words wolves, brutes and seers;
`tests/sky.test.ts` asserts no other log or status text names calm.

**Mechanisms added for it.**

- `MonsterDef.veil?: UnlockCondition[]` (types.ts). While any condition is
  unmet the species is veiled: `isVeiled(state, id)` in `systems/bestiary.ts`.
  `isDiscovered` and `bestiaryProgress` leave veiled species out. `recordKill`
  counts the kill and returns early. When the veil lifts, the entry opens
  (`openLiftedEntries` at the flag's stamp, or the next kill while `firstKill`
  is still 0), and the kills made under the veil count toward the facts' kill
  thresholds. `spotThreat` skips veiled lines.
  Content lint: a veil is non-empty and its skills and quests exist
  (tests/content.test.ts, mirrored in forge/lib/validate.ts).
- `NpcDef.lore?: { requires: UnlockCondition[]; dialogue: string[] }[]`. The
  lines of an entry join the NPC's rotation once every condition holds.
  `npcDialogue(state, npc)` in `systems/quests.ts` builds the list;
  `LocationPanel.svelte` reads it. Text key `f17_bren.lore.0.dialogue`. Same
  lint.
- `CALM_SEEN_KEY` is listed as a valid counter in tests/content.test.ts
  (`statCounterValid`), so conditions may read it.

**Offline catch-up.** `tickSky` stamps the flag in catch-up exactly as in live
play, so the same ticks leave the same state (flag, `bestiary:entries`, the
trio's kills). Floor 17's calm lines roll during catch-up (`eligibleEncounters`
reads the sky from the clock), so a character left hunting an open spot fights
them offline; the stamp lands on the first calm minute, before any calm spawn
can be killed. The log line is emitted whenever the log is live. The
summarised catch-up (`runOfflineProgress`) suppresses the log, so the summary
carries the line instead (`OfflineSummary.firstCalm`, shown by
`OfflineModal.svelte`); the quiet short-gap catch-up logs it normally. Test:
tests/malgeriCatchup.test.ts runs 288,000 ticks live and offline from the same
state and compares the flag and the entry count.

**The veil lifts at the stamp.** `tickSky` calls `openLiftedEntries`
(`systems/bestiary.ts`) right after it sets the flag: a species killed under
the veil gets its entry, discovery XP, `bestiary:entries` count and log line at
that moment, not on its next kill. `recordKill` still opens an entry on the
first kill after a veil lifts by another route (a carried flag, a loaded
save). Facts roll from the next kill.

## 6. Monsters

`monsters.data.ts`, 16 `malgeri_*` species. Stats are `attrs` and `growth`
(per level) on each. The shelf slimes they descend from are at far lower
levels; these were scaled to a climber of about 800 HP and 640 damage a blow.

| Species | Tier | Used at | Notes |
|---|---|---|---|
| Scree Slime | elite | every hunt spot of maps 1 to 4 | plain slime; resists slashing 40% |
| Rime / Cinder / Squall / Storm / Downpour Slime | elite | the sky lines | section 3 |
| Ridge Goblin | basic | plain lines | |
| Ridge Goblin Chief | veteran | plain lines | `group` 3 to 5, escorts goblins |
| Deep Spider | veteran | plain lines | Poison 35% |
| Brood Queen | elite | nest, L43 | alone; Poison 60%; resists slashing 40%, weak to piercing |
| Peak Guardian | ancient | peak, L44 | alone; resists slashing and piercing 80%; arcane 60% weak |
| Slime Regent | legendary | gates, L45 | `group` 3 to 3, no `escorts`: the spot's own lines fill the slots, so the legionaries sit at L42 to 43 |
| Regent's Legionary | veteran | gates, L42-43 | |
| Ridge Wolf / Cairn Brute / Hollow Seer | elite | calm lines, L46-48 | veiled; emoji icons, no art |

Level ranges by zone: caves 40 to 41; east slope, ridge and west peak 41 to 42;
the descent 42. Reused art (`art` in monsters.data.ts):
`slime_earth_elite.png`, `slime_ice_elite.png`, `slime_fire_elite.png`,
`slime_wind_advanced.png`, `slime_thunder_elite.png`,
`slime_water_advanced.png`, `boss_slime_guardian.png`, `slime_rpg_King.png`,
`slime_soldier_spear.png`.

## 7. John and the numbers

John's floor 17 path is `desertFloors[17]` in `tests/john.ts`: cave hub,
central caves, east mouth, the slope, the ridge, then a keeper-loop at the
west peak against the peak guardian; after the first kill the descent through
base, path and old path to the square, then a keeper-loop at the base against
the regent. He skips the nest.

`npm run pacing -- --through 20 --seeds 42,7 --weapons skip` (2026-11-11):

| | seed 42 | seed 7 |
|---|---|---|
| Floor 17 clear time | 20:42 | 20:54 |
| Knockouts on the floor | 20 | 18 |
| Peak guardian tries / lost | 2 / 1 | 1 / 0 |
| Slime regent tries / lost | 3 / 2 | 4 / 3 |
| Nest | not fought | not fought |
| Level at clear | 46 | 46 |
| Calm inside his stay | none (0 minutes) | none (0 minutes) |

The floor costs 18 to 20 knockouts and 2 to 3 lost boss fights. A calm falls in
a 21-minute stay about one run in ten (8 minutes in a 288-minute window).
Floors 18 to 20 are unchanged and play without a debug skip now that floor 17
clears.

**The arranged calm climb** (`--malgeri-calm`, `ClimbOptions.calmAtMalgeri`):
the clock jumps once to the start of a calm spell, and John hunts the east
ridge instead of the west peak.

| | seed 42 | seed 7 |
|---|---|---|
| Floor 17 time | 27:27 | 14:07 |
| Knockouts | 32 | 20 |
| Fights against calm lines, won | 18, 7 | 17, 5 |

That is 29 to 39% won against calm lines, 28% in the duel above. The calm
keeps its teeth for a climber at level 41 to 46.

The pacing report prints a floor 17 detail line: peak and gate tries and losses
(split by foe, because a lost fight records the haven), minutes inside a calm
spell and under the open sky, and calm-line fights won.

## 8. Tunables

| To change | File | Name |
|---|---|---|
| How long and how often calm falls | `data/climate.data.ts` | `CALM_HOURS`, `CALM_PERIOD_DAYS` |
| Front mix, temperatures | `data/climate.data.ts` | `SKY_TABLES.malgeri` |
| What each front does to the player | `data/climate.data.ts` | `SKY_RULES` |
| Which monsters a front or calm brings | `data/locations.data.ts` | the `sky` lines of the six open hunt spots |
| Calm share of a draw | `data/locations.data.ts` | calm line weights (100, 100, 80); keep the sum at 4 times the plain 70 or edit the assertion in tests/malgeri.test.ts |
| Calm group size | `data/monsters.data.ts` | `group` on the trio |
| Calm levels | `data/locations.data.ts` | `level: [46, 48]` on the calm lines |
| A species' strength | `data/monsters.data.ts` | `attrs`, `growth` of each `malgeri_*` |
| Zone levels | `data/locations.data.ts` | `level` on each plain line |
| Boss levels | `data/locations.data.ts` | queen 43, guardian 44, regent 45, legionaries 42 to 43 |
| Regent against legionary-only fights | `data/locations.data.ts` | `f17_keeper` weights 100 and 6 |
| Ridge Amber's drop and price | `data/monsters.data.ts`, `data/materials.data.ts` | the trio's `loot`, `ridge_amber.value` |
| What lifts the veil | `data/monsters.data.ts` | `veil` on the trio |
| The captain's line and its condition | `data/npcs.data.ts`, `text/npcs.text.ts` | `f17_bren.lore`, `f17_bren.lore.0.dialogue` |
| Hamlet pay | `data/locations.data.ts` | `job_guard_f17`, `job_bellows_f17` `gold` |
| Where a spot sits on the diagram | `data/locations.data.ts` | `map` on each spot |
| John's route, the calm option | `tests/john.ts`, `scripts/pacing.ts` | `desertFloors[17]`, `BOSSES.floor17`, `calmAtMalgeri`, `--malgeri-calm` |

The `map` coordinates of `f17_landing`, `f17_cave_hub`, `f17_east_mouth` and
`f17_peak` were found by search so that no label, pin or chip overlaps at the
widths `tests/towersection.test.ts` draws (300 to 700). Renaming a spot or
changing a badge can break that test; move a pin a few units to fix it.

## 9. Decisions this build made

- `skyRegionId` on the area, not `regionId: 'malgeri_range'`: moving the area
  out of the Ascent dropped the floor from the stack map and the tower section.
- Clear on `boss:f17_keeper`, not `fights:`.
- The regent's spot has no `fightLimit`.
- The peak and the gates are open sky; their fights take weather statuses.
- The queen is optional.
- No `waypoint` on map 4.
- The hamlet jobs pay 30, not the shelf's 10 to 16.
- `tests/bestiary.test.ts`'s total test excludes veiled species.
- Weather statuses and the calm are not floor-specific code: another area
  opts in with `skyRegionId: 'malgeri_range'` and its own `sky` lines.
