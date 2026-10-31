# The Vermin Festival

*Floors 15–16. Built 2026-10-30 at placeholder fidelity, no save version
change: `data/festival.data.ts`, `systems/festival.ts` (the attempt),
`systems/festivalRules.ts` (pure reads, the lockout, the ladder rules),
`systems/royaleField.ts` (the field simulation), `systems/royale.ts` (the field
and the battle stage), `systems/stash.ts` (the stronghold stash),
`systems/festivalValidation.ts` (content contracts), `ui/panels/FestivalPanel.svelte`,
`ui/lib/RoyaleField.svelte`, `ui/panels/StashPanel.svelte`,
`tests/festival.test.ts`. The rulings are docs/FLOOR_IDEAS.md §5.3 items 6,
10–20, 23–25 and §5.4 Q4–Q8.*

## 1. What it is

Ten rooms of ten, one survivor from each, then one of a hundred. The player
wakes in one of the rooms. An attempt runs from floor 15's dark room to the
end of floor 16's royale. Winning clears floor 16 and pays a reward the first
time in a run; losing shuts both floors for three days.

| | |
|---|---|
| Starts | arriving in `f15_dark_room`, floor 15's landing (the `arrive` event) |
| The door | holds everything worn and carried, flasks and provisions too; issues one plain weapon |
| Floor 15's clear | `boss:f15_dark_room`: the room's last fighter, fought alone |
| The hub | `f15_hall` and `f15_stores`: ten festival days, no fights |
| Floor 16's clear | `boss:f16_arena`: the field's champion, fought alone and last |
| A loss | ejected to the tower's hub; floors 15–16 shut 3 days or to the next prestige |
| State | `state.festival` (run state, optional) and legacy fields on `state.prestige` |

## 2. The door (`startFestival`, `returnGear`)

- **Held**: `inventory`, `equipment`, `sheathed`, `coating` and `flasks`,
  and the provisions: every consumable material that is not a card (food and
  potions; `run.held.provisions`, plain counts and graded stock both), as
  plain copies in `run.held`. Cards, other materials, runes and gold stay
  with the player. An attempt saved before the door took flasks and
  provisions has neither field and returns without them (FLOOR_IDEAS §5.3
  item 26).
- **Issued**: the family whose weapon skill level is highest, ties broken by
  `kills:weapon:<family>` (counted on every kill from now on), then by
  `ISSUED_WEAPONS` order. The family's starter item with no affix and no rune
  slots; `unarmed` issues nothing. It is lent, so `sellItems` refuses it.
- **Returned** when the attempt ends, won or lost: the issued weapon is taken
  back wherever it is, and whatever else the attempt put in the player's
  hands stays where it is, so a find worn at the end stays on. Each held piece
  goes back into its slot if the slot is empty and it fits (`wearIfFree`:
  requirements and the arms budget), otherwise into the pack, with a log line
  counting the pieces that were turned away. The held oil comes back unless
  the weapon left in hand carries one of its own. Held flasks and provisions
  are added to what the attempt left, so the stores' rations are kept.

## 3. The festival's clock (`run.clock`)

- Starts at 0 when the dark room's door opens. Moves one tick per `advance`
  while an attempt holds the player (`festivalHolds`: a live attempt and the
  player on floors 15–16), travel between its floors included.
- **Offline**: every catch-up tick goes through `catchUpTicks`
  (save/offline.ts), which stops the moment the festival holds the player,
  from the first tick or from the tick a climb lands them in the dark room,
  and puts the rest of the absence in `state.bonusTime.banked`, 1:1 up to its
  cap. The summary reports the ticks skipped (`festivalSkipped`) and what the
  bank took of them (`festivalBanked`). Both catch-up paths, the summarised
  one and the UI's quiet short-gap one, go through it. A gap under a minute
  at boot runs through neither and is not banked, inside the festival or out.
- **Day ten** (`PREP_TICKS`): the player is walked up to floor 16 by the
  ladder. **Entering early** is the same climb: `beginRoyale` sets the clock
  to `PREP_TICKS` and keeps the old value in `run.enteredAt`. Nothing else
  reads this clock, so the jump touches nothing outside the festival.
- The survivors' preparation is `SURVIVOR_LEVELS.growth` levels over the ten
  days; the royale always opens at the end of it, waited out or jumped.

## 4. Leaving

- **Knockouts** on floors 15–16 land at the tower's hub (`retreatSpot` asks
  `ejectionSpot` first). Festival spots are never recorded as havens.
- **The ladder** (`climbTo`, `climbToHub`): from inside an attempt, every
  climb except floor 15 → floor 16 after the door opens is a forfeit, the same
  ejection. Floor 15 → 16 before the door opens is refused. A climb during a
  forced fight is refused as everywhere.
- **Floor 16 has no door of its own.** Outside an attempt's hall the ladder
  refuses it (`festivalLadder` → `closed`), even when floor 15 reads cleared
  from an earlier, lost attempt; the Ascent panel shows the rung with no
  button and says it is entered from floor 15's hall.
- **Any exit** ends the attempt as a loss (`settleExit`, on `arrive` and on
  every tick): gear returned, `state.festival.lockedUntil` set three days of
  the world clock ahead. `floorUnlocked` refuses floors 15–16 until then. A
  prestige replaces the run state, which ends the lockout.

## 5. Rewards and the stronghold stash

- **A win**: `festival:wins` + 1. The first win of a run pays
  `FESTIVAL_REWARD` (the laurel, a placeholder accessory). Reruns pay
  nothing: the festival's monsters drop nothing and carry no gold.
- **Every hundredth win of a run** puts a festival token in the stash
  (`TOKEN_EVERY_WINS`). Nothing shows before the hundredth.
- **The stash** (`state.prestige.stash`): tokens and keep-marked items only.
  `prestigeNow` copies it, and every keep-marked item goes back into it from
  wherever it is (worn, carried, sheathed, in a fight, held at the festival's
  door). Taken out, an item gets a fresh uid. Nothing comes out inside an
  attempt. The UI is a section of the Prestige tab.
- **A token** is spent on one of three, each kept through prestige:
  - the permanent bonus: one stack of `TOKEN_BONUS.mods`, up to `cap` stacks
    (`prestige.festivalBonus`, read by `collectBaseMods`, in `modFingerprint`);
  - a technique: one of three from `TOKEN_TECHNIQUES.pool`, drawn with the
    token's seed (the same three every time it is opened, less those already
    taken), learned canonically now and at every run start
    (`prestige.festivalTechniques`). The pool is a placeholder of existing
    techniques;
  - the regalia (`TOKEN_REGALIA`, keep-marked), into the stash.
- **The hidden title** `first_through_the_door`: a win whose `enteredAt` is at
  most `SWIFT_ENTRY_TICKS` (twelve festival hours after the door opened)
  bumps `festival:swift_wins`, which the title reads. Nothing is written
  before that win.

## 6. The royale's field (`royaleField.ts`)

- A square `ROYALE_FIELD.size` across. Ninety-nine survivors scattered over it
  in the species of `SURVIVOR_SPECIES`; the player on the near edge.
- **Walking**: every fighter walks `speed` a tick toward a goal its strategy
  picks every `thinkTicks`. A strategy (`ROYALE_STRATEGIES`, a registry with a
  forge catalog entry) is a move — `nearest`, `weakest` (within `sight`),
  `centre`, `away`, `edge`, `hold` — and an optional condition on the
  bearer's health share and the field's count. The first strategy in a list
  whose condition holds decides; none holding means `nearest`. The player
  ranks up to three (`state.festival.plan`, kept between attempts); each
  species fights with its own list from the same registry.
- **By hand**: a click on the ground or the arrow keys set
  `field.player.target`; the player walks there and the plan resumes on
  arrival. The player walks only between fights.
- **Survivors' duels**: two free survivors closer than `engageRadius` duel for
  `duelTicks`; one weighted roll on their strength picks the loser, who
  falls. The winner gains a win (a level, up to `winCap`, when it meets the
  player) and a wound that heals at `healPerTick`.
- **The player's fights**: free survivors within `engageRadius` of a free
  player become a staged fight at the arena, up to `maxGroup`, at their own
  levels and wounds. Won, they leave the field.
- **The champion**: the last survivor, always fought alone. A fight never
  takes every survivor left, duels need a third standing, and with two left
  both walk at the player. Its def is `SURVIVOR_CHAMPION`, the arena's boss
  line, so its fall is the win and floor 16's clear.
- A fight dropped without an ending (a reload mid-fight) releases its
  survivors to walk again.

## 7. Dials and what was not measured

| Dial | Where | Today |
|---|---|---|
| Dark room waves and levels | `DARK_ROOM_WAVES` | 2, 3, 3, then 1; levels 32–35 |
| Survivor levels | `SURVIVOR_LEVELS` | 34 + 3 over ten days + up to 2 for wins; champion + 1 |
| Field pace | `ROYALE_FIELD` | size 60, speed 0.2, duels 100 ticks |
| Lockout | `LOCKOUT_TICKS` | 3 world days |
| Token bonus | `TOKEN_BONUS` | +3% damage and max HP a stack, cap 5 |

Not measured: whether a floor-15 build wins the dark room with a starter
weapon and no armour (a probe with every attribute at 40 lost it; at 60 it
won), and how long the royale lasts for a real build (about 70–120 seconds of
play in probes with strong fighters). John stops at floor 6.

## 8. Open

- The festival's own monsters, the technique pool and the rewards are
  placeholders.
- The stash's UI sits on the Prestige tab, not in the hold.

## 9. Rework: the prep hub and the royale's field (user, 2026-10-30)

**As posted.** *"Prep stage: there's too little to do after the dark room.
It's practically impossible to fill the 10 days meaningfully."* *"The arena
needs to be bigger, like a forest with several different sections to explore
and fight in: forest, river and bank, a glade, a deserted village with various
houses and shops like a smithy, baker, guard post, a waterfall, a cave, a
cliff. All of those either feature other fighters, monsters, equipment, etc.
It's basically a miniature stage, and fighters will always get a 'radar' to
the closest enemy direction after 1 hour without fighting. The battle royale
goes on until there is one winner."*

### 9.1 The prep hub: ten days as a budget

**The gap in numbers.** Ten festival days are 144,000 ticks: four hours of
play, two on bonus time. The hub holds seven finds in the stores (about 14
minutes of searching), a cooking bench, a rest and two training activities.
Everything after the first quarter hour is training STR or DEX.

**The rule.** Every hub activity turns festival time into something the
royale reads, and the hub's stock is finite, so the ten days are a set of
choices. Doing all of it takes about eight to ten days; a rerun that skips
what it already knows enters early.

| Spot | Activities | System | Stock | Time | What the royale gets |
|---|---|---|---|---|---|
| `f15_hall` (kept) | rest, drill STR, spar DEX, cooking bench | cooking, attributes | — | open-ended | meals that last into the royale (cooking: long, out of combat) |
| `f15_stores` (kept, more) | search: rations, meat, salve, onions, salt, mushrooms, honey | cooking | 12 finds an attempt | 4 h a find | ingredients |
| `f15_survey` (new) | search: one find per royale section; each sets `flag:festival:scouted:<section>` | — | 8 finds an attempt | 12 h a find (4 days for all 8) | a scouted section shows its caches and dens on this attempt's royale map before you walk in |
| `f15_herb_yard` (new) | search: spring water, mendroot, emberbloom, frostmoss, bloodwort, nightcap | alchemy | 8 finds an attempt | 4 h a find | ingredients for the workshop's alembic |
| `f15_workshop` (new) | alchemy bench, forging bench, the iron ingot recipe; search: iron scrap, hardwood, leather, grain spirit | alchemy, smithing | 6 finds an attempt | 4 h a find | flasks for the fights; plain pieces forged from scrap |
| `f15_gallery` (new) | train CON, INT and WIS at once (watching the others drill), rest; a one-way stair down to the dark room (the floor rules' wing loop) | attributes | — | open-ended | attributes |

- **Restock.** Every search in `FESTIVAL_RESTOCK` (stores, herb yard,
  workshop, survey) resets its limits when an attempt starts, as the stores
  do today. Each attempt draws its field's seed at the start
  (`FestivalRun.fieldSeed`), so the survey scouts the field this attempt's
  royale will open on, and its flags are cleared with the next attempt.
- **Kept.** What the hub's searches and benches put in the player's hands
  stays theirs after the attempt (§2's rule; the stores' rations already
  do). A farm loop is an attempt, a forfeit and a three-day lockout per
  restock.
- No new activity kind: search, train, rest and benches only. The survey is
  a search whose rewards set flags; it scouts sections in a random order.
  Every hub search runs on fixed time (`staticTime`), so speed does not
  shorten the ten days.
- **As built** (festival-hub, 285e902): searches total 120,000 ticks (8.33
  days: stores 28,800, herb yard 19,200, workshop 14,400, survey 57,600) plus
  about 4,000 of bench work, about 8.6 of the 10 days. After a search's last
  find the running search spends one more cycle finding nothing before it
  stops (`tests/searchspent.test.ts`).

### 9.2 The royale's field: a miniature stage

The isometric field stays (§5.3 item 13). It grows from 60 to 180 units
across (nine times the area; user, 2026-10-30) and gets terrain: named
**sections**. The terrain is **generated per attempt from a seed**, after
InfiniteGacha's `mapgen.js` (user's pointer, 2026-10-30): a grid of one cell
per field unit, each cell holding a section; fixed rules say where each
section lies, the seed decides its shape. Only the seed is saved
(`RoyaleField.seed`); the map is rebuilt from it (`systems/royaleMap.ts`).
What carries over from InfiniteGacha: one seeded random source drives the
whole build; organic regions from a cellular-automaton pass; a river as a
random walk with banks around it (its `genRoute`); a village as a cluster of
walled buildings (its `genSettlement`); features placed by rule inside their
region rather than by hand; monsters placed as packs; only the seed in the
save. What does not: walls that block walking and line of sight. Every cell
stays walkable, so walking stays a straight line and needs no pathfinding;
terrain only changes pace and sight.

| Section | Where (generation rule) | Pace | Sight | Features |
|---|---|---|---|---|
| Cliff | a ridge of uneven depth along the far edge | 0.6 | 1.6 | a harpy nest (den) |
| Waterfall | the river's head, below the cliff | 0.6 | 0.8 | a serpent den guarding a cache |
| River | a random walk from the waterfall to the near edge, 5–8 wide | 0.4 | 1.0 | — (crossing is slow) |
| Bank | a strip either side of the river | 1.0 | 1.0 | a fisher's cache |
| Forest | a cellular blob over most of the west half | 0.8 | 0.5 | a wolf den guarding the hunter's cache |
| Glade | a round clearing inside the forest | 1.0 | 1.2 | a spring: heals while standing in it |
| Cave | a blob in one far corner, on the side away from the forest | 0.7 | 0.3 | a bear den guarding the deep cache |
| Village | a cluster of buildings in the east half, off the river | 1.0 | 0.7 | the smithy (weapon), the guard post (armour, a hound den), the baker (food), three houses (small finds) |
| Meadow | everything else | 1.0 | 1.0 | — |

- **As built** (festival-mapgen, 843d963): one mulberry32 stream from the
  hashed seed; the cliff 8–18 deep; the waterfall's centre at x 64–100; the
  river drifting inside x 62–102 so the east holds a large village; the bank
  every cell within 3 of the river; forest and cave from a cellular pass; the
  village sized from the buildings and caches the data asks for (at least
  six buildings, two to four spare houses); dens at least 31 from the start;
  caches at least 6 apart and 15 from the start. A step with no room retries
  the build on the same stream, and the twelfth build keeps what it has, so
  `royaleMap` never throws (never seen to fire in 3,003 seeds). About 5 ms a
  map. No east-west mirror: the forest stays west, the cave and village east.
  A den guards at most one cache that names a village building.
- **Pace** multiplies a fighter's walking speed while it stands in the
  section. **Sight** multiplies how far a fighter standing there sees
  (`ROYALE_FIELD.sight`, 20 units). A fighter in a section with cover
  (forest, cave) is seen at half range.
- **Fog.** The player sees the fighters within their sight, and no others.
  A section's features show once it is scouted (9.1), once the player has
  stood in it this attempt, or while they are in sight.
- **Caches.** A point; the first fighter to reach it takes it, once an
  attempt. The player gets a piece of equipment lent for the attempt (worn
  if the slot is free, taken back at the end with the issued weapon) or an
  instant effect (a share of health back). A survivor that takes one gains a
  level, as a win does, under its own cap.
- **Dens.** Monsters that stay inside a radius, some guarding a cache. A
  survivor that walks in fights the den as a duel (one weighted roll) and may
  fall to it, which thins the field. The player walking in gets a staged
  fight with the den's monsters at their pinned levels; won, the den is
  cleared and its cache opens. Den monsters drop nothing (§5's reruns rule).
  A knockout there is a festival loss like any other on floor 16.
- **Radar.** Every fighter, the player included, that has not fought for one
  festival hour (`RADAR_TICKS`, 600 ticks: a duel, a fight with the player or
  with a den) knows the direction and distance to the nearest enemy, sight or
  no sight. Survivors walk at it; the player's plan reads it as in sight; the
  map draws an arrow, and a countdown until it switches on.
- **New moves.** `loot` (the nearest known open cache), `roam` (the fallback
  when nobody is in sight and there is no radar: walk to a point in another
  section), `cover` (the nearest section with cover). The default plans gain
  `loot` while the field is crowded.
- **The end** is unchanged: the last survivor is the champion, fought alone,
  and the royale runs until one stands.
- **The map.** The view follows the player at 60 units across, with a
  minimap of the whole field, its sections and what is known of it; a toggle
  shows the whole field.

### 9.2a Rules from the design review (2026-10-30, all accepted)

1. **A den never fells the last survivor**, nor the last free one while the
   player's fight holds the others: a den fells a survivor only while at
   least three stand and at least one free survivor would remain. The field
   still empties only through the champion.
2. **The champion's fall is the win.** `royaleFightWon` wins on a fight that
   held `SURVIVOR_CHAMPION`, never on an empty field alone.
3. **A field is never replaced during a fight.** The layout-marker check
   waits for a tick with no fight.
4. **The radar overrides the plan for survivors**: after `RADAR_TICKS` a
   survivor's goal is the radar's target whatever its move, and with two or
   fewer left every survivor walks at the player whatever its move.
5. **The generator is tested over many seeds**: every section's pace above
   0, the start outside every den's radius, every den and cache inside its
   section, every village cache inside a building of its kind, every guarded
   cache inside its den's radius. `ROYALE_LAYOUT_VERSION` goes up whenever
   `generate` changes, since a saved seed would rebuild a different map.
6. **Small contracts**: the validation's list of moves knows `loot`, `roam`
   and `cover`; `createField` sets `openedAt` (the radar's clock); a den's
   power is above 0; a cache has exactly one of item, weapon and heal; lent
   gear is taken back on both endings and refused by `sellItems`.

### 9.3 State and save

- `run.field` gains optional fields: caches taken, dens cleared, sections
  the player has stood in, each fighter's and the player's last fight tick,
  a survivor's cache levels. A field without the new layout marker is
  replaced whole on the next tick (the existing rule for the old counter
  field), so a save taken mid-royale before the rework restarts its field.
  No save version change.
- `run.lent`: uids of royale finds, taken back when the attempt ends, as the
  issued weapon is.

### 9.4 Build split

| Who | Files |
|---|---|
| Manager (base commit) | types; the section, cache and den data in festival.data.ts; the map interface with a stand-in generator (royaleMap.ts); the terrain reads (royaleTerrain.ts); `FESTIVAL_RESTOCK` and the restock loop |
| Builder D, the map generator | royaleMap.ts's `generate`: the seeded generator, and its tests |
| Builder A, the field engine | royaleField.ts, royale.ts, the lent-gear return in festival.ts, the den monsters (monsters data and text), tests, a probe of how long a plan-only royale lasts |
| Builder B, the field UI | RoyaleField.svelte (sections, features, fog, radar arrow and countdown, camera and minimap) and a read-only preview of the scouted field in the hub |
| Builder C, the prep hub | the f15 spots, activities and text in locations data and text, the hub's materials or recipes if any are missing |

### 9.5 Questions (defaults built)

| # | Question | Default |
|---|---|---|
| F1 | Royale finds: lent for the attempt, or kept | Lent: taken back at the end |
| F2 | The hub's stock | Restocked each attempt, the survey included (each attempt has its own field) |
| F3 | Fog on fighters | On: only fighters in sight show; the radar finds the rest |
| F4 | Can den monsters kill survivors | Yes, a survivor can fall to a den |
| F5 | Field size | 180 units across (user, 2026-10-30), generated per attempt from a seed |
| F6 | How long a plan-only royale should last | About 2 to 4 festival hours (12 to 24 minutes of play) |
| F7 | Hub budget | Doing everything takes about 8 to 10 of the 10 days |
| F8 | What the hub's searches and benches give | Kept after the attempt, as the stores' rations are today |
| F9 | The survey's order | Random: one search that runs four days unattended (user, 2026-10-30: "keep it random") |

### 9.6 Survivors as fighters (user, 2026-10-30)

**As posted.** *"Distribute the various fighters randomly but somewhat spread
out. Grant more caches and let all the fighters pick up various tools to help
them as well. The player is after all allowed to lose. Also, try building an
'enemy generator' that'll populate their skillsets as well, to make them
proper enemies and not just stat sticks with some numbers."*

- **Spread.** Survivors start at random places with a minimum spacing
  between any two (InfiniteGacha's `scatter` with `minDist`), outside the
  start's radius and every den's.
- **More caches.** About 35 instead of 10: several in every section, more
  houses in the village. Weapons, armour, accessories and healing, from
  existing items.
- **Tools for everyone.** A survivor that takes a cache keeps the item as a
  tool (`FieldFighter.tools`): it counts in the survivor's duels, and it joins
  the survivor's kit when it fights the player. The field can grow stronger
  than the player; losing is allowed (a loss is the festival's lockout, and
  the next attempt is a new field).
- **The enemy generator** (`systems/survivorGen.ts`, `data/survivors.data.ts`).
  A survivor's build is rebuilt from the field's seed, its id and its species,
  so nothing but the tools is saved: a generated name; an archetype (duelist,
  brawler, spearman, archer, knight, assassin, caster, priest and so on); a
  weapon of the archetype's family, whose damage type and reach it fights
  with; two to four techniques of that family from the martial registry; a
  working (spell or miracle) for the casters and priests; worn armour as an
  armour value; an attribute emphasis. Tools taken on the field merge in (a
  better weapon, armour, a healing flask as a one-use rotation entry). In a
  fight with the player the survivor is its species' monster at its level,
  carrying that build as `MonsterInstance.kit`, which combat reads before the
  def (`kitOf`).
- **The map** shows a seen survivor's name, archetype and weapon on hover.
