# Time & weather

The world clock and the sky. Everything here is **derived**: the calendar is a
pure function of `state.totalTicks` (which the game has always kept), and
weather is a pure function of (world seed, region, tick), where the seed is a
hash of the save's `createdAt`. Nothing was added to the save format; there is
no update loop; offline catch-up needs no special handling because there is
nothing to catch up.

Systems: `src/core/systems/clock.ts`, `src/core/systems/weather.ts`.
Every knob: `src/core/data/climate.data.ts`.
Preview: the forge's 🌍 World Atlas, **Sky** toggle — scrub the day and hour
sliders and watch the year happen to the real map. The atlas uses a fixed
preview seed; every save rolls its own sky.

## The calendar

- 60 minutes an hour, 24 hours a day, 7-day weeks, 28-day months,
  **13 months a year**, plus **four holy days that belong to no month** — the
  equinoxes and solstices — for **368 days**.
- One tick = 100 ms of game time and `TICKS_PER_GAME_MINUTE = 10`, so **one
  real second is one game minute**: a day is 24 real minutes, a year about six
  real days. The 8-hour offline cap spans 20 game days.
- Each quarter is 91 month-days — **exactly 13 weeks** — with its holy day
  after them. Holy days stand **outside the week**, so every month opens on
  the same weekday forever: the calendar is perpetual, and scheduled content
  ("market every Firstday") can never drift.
- The holy days interrupt months at a drifting anchor — after week 1 of month
  4, week 2 of month 7, week 3 of month 10, week 4 of month 13.
- Seasons are **centred** on their holy days: the Summer Solstice is
  midsummer's day, folk-style, not the first day of summer. The temperature
  phase (`WorldClock.seasonPhase`) is +1 exactly on the Summer Solstice, −1 on
  the Winter Solstice, 0 on both equinoxes — the calendar and the climate
  agree by construction.
- Month and weekday names are TODO scaffolding in climate.data.ts ("First
  Month", "Firstday") awaiting real lore. The holy-day names are canonical
  but re-flavourable.

`clockOf(totalTicks)` returns the whole picture (year, month, day, weekday,
hour, holy day, season, phase, moons); `formatDate`/`formatTime` render it. On a holy
day, `monthIndex`, `dayOfMonth` and `weekday` are all null — those days are
genuinely outside the system, which is what makes them holy.

## The moons

Three moons (user, 2026-10-29). Data: `MOONS` and `MOON_PHASES` in
climate.data.ts. State: `WorldClock.moons`, derived like the rest of the clock,
so there are no save fields and nothing to catch up.

| moon | cycle | size |
|---|---|---|
| Large Moon | 79 days | largest |
| Middle Moon | 28 days | medium |
| Small Moon | 37 days | smallest |

The names are scaffolding (TODO in the data file), like the months.

- **Moons count month-days.** On a holy day every moon holds the phase it had
  at the end of the day before, the same way holy days stand outside the week.
- **The 28-day moon is locked to the month.** Every month opens on its new
  moon, every year. The holy days land on its four principal phases: Vernal
  Equinox first quarter, Summer Solstice full, Autumnal Equinox last quarter,
  Winter Solstice new.
- **The 37- and 79-day moons drift** against the calendar. All three are new
  at the epoch (Firstday, 1st of First Month, Year 1) and are all new together
  again after 28 × 37 × 79 = 81,844 month-days, about 225 years.
- Each `MoonState` carries `phase` (0..1: 0 new, 0.25 first quarter, 0.5 full,
  0.75 last quarter, continuous through the day), `age` (whole days into the
  cycle), `illumination` (lit fraction, 0 at new, 1 at full), `phaseId` and
  `phaseName`.
- **Phase names**: new moon, waxing crescent, first quarter, waxing gibbous,
  full moon, waning gibbous, last quarter, waning crescent. A principal phase
  (new, the quarters, full) names the one day that starts at its exact
  moment; the crescents and gibbouses fill the days between. For the 28-day
  moon that is new on day 1 of the cycle, waxing crescent days 2–7, first
  quarter day 8, and so on.
- `cycleDays` is a knob. The month lock holds only while a cycle divides 28;
  any other value still works, it just drifts.
- **Where the player reads them**: the header clock chip, as three glyphs drawn
  at each moon's relative size, from Chronosense **season tier (4)**. Hover
  names each moon's phase; from **date tier (16)** the hover adds the day of
  the cycle ("day 12 of 79"). Season tier because moons and seasons are both
  read off the sky rather than counted; the date tier is the one that counts
  days. The forge's World Atlas Sky bar shows the same glyphs, with the full
  line on hover.
- **Moonlight** lowers the darkness of the open night sky (below).

### Moonlight (built 2026-10-29)

The user asked for moonlight to lighten the night and took the defaults of
the design (record at the end of this section).

**Where it applies.** Sky darkness only exists outdoors, away from lamplight.
The user's ruling (2026-10-29): floors 4 and 5 are open sky, floor 6 is in
part, and each band-3 direction (floors 7–10) has open-sky areas. Built:

| place | sky | how |
|---|---|---|
| floors 1–3 | roofed | the Ascent region is `sheltered` |
| floor 4, the Greenwood | open | `ascent_f4_area` sets `sheltered: false` |
| floor 5, the Mire | open, except the Hollows | `ascent_f5_area` sets `sheltered: false`; the Hollows carry `dark` and `indoor` |
| floor 6, the Warren | the Mouth, the Pens, the Shrine | `ascent_f6_area` sets `sheltered: false`; the Tunnels, Kitchens and Great Hall carry `indoor`, the Drop `dark` and `indoor` |
| floors 7–10 | open areas per direction | unbuilt; mark them when built (plans/bands-2-3.md) |
| Threshold, the Holding Level | lamplight | `settlement` |
| the Hold | roofed | `sheltered`; the yard is a TODO in locations.data.ts |

`AreaDef.sheltered` overrides the region's for one area. Every reader of the
sky goes through `skyRegionOf(spotId)` (registry.ts), which returns the region
with the area's override applied, so the open floors share one sky over the
Ascent's pin and 'plains' terrain. Open sky is the whole package, not
moonlight alone: weather in the header chip and the Weathersense forecast,
resist exposure from the weather, Weathersense watching XP, night darkness
(combat penalties and Darkvision training), and moonlight. Floor 6's split
is the user's (2026-10-29): the Pens and the Shrine are open, the Kitchens
are not.

**The rule.** Moonlight lowers the darkness of the open night sky:

```
moonlight   = Σ moon.illumination × MOONLIGHT_WEIGHT[moon.size]      0..1
through     = MOONLIGHT_THROUGH[weather.kind]                        0..1
skyDarkness = naturalDarkness(hour) × (1 − MOONLIGHT_MAX × moonlight × through)
```

| knob | value | where | meaning |
|---|---|---|---|
| `MOONLIGHT_WEIGHT` | large 0.5, medium 0.3, small 0.2 | climate.data.ts | share of the light per moon; sums to 1 |
| `MOONLIGHT_MAX` | 0.6 | exposure.ts | three full moons on a clear night remove 60% of the dark |
| `MOONLIGHT_THROUGH` | clear, still, heatwave and calm 1, mist and gale 0.5, others 0 | exposure.ts | how much moonlight each sky lets through; keyed on the weather `kind` (the bucket rule below), never the raw floats |

A region with no weather sample (no atlas pin) counts as cloudless. Every moon
lights the whole night by its phase; moons do not rise or set.

Code: `moonlight(moons)` in clock.ts; `moonlightThrough`, `skyDarkness`,
`placeDarkness` (its `lit` argument) and `moonlightOn` (the readout) in
exposure.ts. `placeDarkness` calls `lit` only outdoors at night, so daytime and
roofed places never sample the weather for it. One darkness number feeds both
the combat penalties (`darknessFactor`) and Darkvision training
(`tickExposure`), so a moonlit night also teaches less. Everything else stays
as it was:

- `dark`-tagged places stay at 1. Caves get no moonlight.
- Roofs, `indoor`, `sheltered` and `settlement` stay at 0.
- **Night stays night.** `naturalDarkness(hour)` is still the night boundary
  for `daypart: 'night'` encounters (`isNightNow` in combat.ts). Moonlight
  changes how dark the night is, not whether it is night.
- `eyeless` still zeroes the factor; monsters still pay nothing.
- Darkvision erodes what is left, as before: `darknessFactor = darkness ×
  (1 − level / 50)`.

**Numbers.** Simulated for an open-sky plains region at the Foot's pin, three
seeds, three years of nights each (hours 20–04, every 10 game minutes):

| measure | before moonlight | with moonlight |
|---|---|---|
| clear sky at night | — | 20–25% of samples |
| mean night darkness | 1.00 | 0.92 |
| darkest / brightest night | 1.00 / 1.00 | 1.00 / 0.41–0.44 |
| header chip, untrained: Blind dark (≥ 0.85) | 100% | 76–80% |
| header chip, untrained: Dark (0.4–0.85) | 0% | 20–24% |

One full Large Moon on a clear night alone gives darkness 0.70: an untrained
fighter loses 17.5% dodge instead of 25% and swings at shadows 10.5% of the
time instead of 15%. Darkvision training slows by the same 8% on average.

**What the player sees.** The header's dark chip bands the factor
(Blind dark / Dark / Gloom); on a moonlit night it can drop a band. Under the
open night sky its tooltip adds one line: "Moonlight: −30% darkness" or
"Moonlight: none (overcast)". In a `dark` place the line is absent.
No Chronosense gate: you see moonlight whether or not you can name the phase.
The Weathersense forecast already shows which coming hours are clear, so a
player who reads both chips can pick a moonlit night to hunt in. No new
system teaches this; it is not on the critical path.

**Laws.** Every factor is in 0..1, so darkness stays in 0.4..1 at night: no
new arithmetic edge (COMPLETABILITY C). No save field; offline replay gets the
same nights. Darkness is applied at roll time in combat, not through
`getDerivedStats`, so the derived-stats fingerprint is untouched.

**Cost.** `darknessFactor` runs per attack roll; under the open night sky it
now samples the weather each time, which floors 4–5 and floor 6's open spots
pay at night. Regions with a sky table (below) memoize their sample per game
minute; the noise path does not, because its anomaly moves every tick.

**Tests** (tests/exposure.test.ts, tests/keeper.test.ts): all moons new gives
the old darkness exactly; three full moons on a clear night give 0.4 at
midnight; overcast gives 1; `dark` gives 1; roofs and lamplight give 0 and
never sample the sky; a real clear night in the shelved woods is lighter and an
overcast one is not; a moonlit night teaches Darkvision less; a
`daypart: 'night'` encounter still rolls under a full moon. The tower's open
floors: band 1 keeps the roof and the open floors share the Ascent's pin;
floor 4 has weather and floor 1 is always 'still'; a night on floor 4 is dark
and moonlit while floor 1 is not; on floor 6 the Mouth, Pens and Shrine see
the night and the Tunnels, Kitchens and Great Hall do not;
rain on floor 5 trains the Bog but not the Hollows, the Tunnels or floor 1.

**Decisions (user, 2026-10-29, defaults taken):** build now, inert until an
open-sky region exists; no rise and set; `MOONLIGHT_MAX` 0.6 with weights
0.5 / 0.3 / 0.2; moonlight slows Darkvision training too. The rejected
options: build with the first open-sky region; moons that rise and set by
phase (a moon up for the 12 hours centred on 12:00 + phase × 24 h, so a first
quarter sets at midnight); Darkvision XP that ignores moonlight. Later the
same day the user ruled which floors are open sky (the table above); that is
what made moonlight live.

## The weather

Weather is **sampled, not simulated**. Two parts per variable (temperature °C,
precipitation 0–1, wind 0–1):

1. **Climate baseline** — deterministic from the region's atlas pin and the
   clock. Latitude (pin `y`; south = toward the equator) sets the annual mean
   between `polarTemp` and `equatorTemp`; the seasonal swing scales with
   latitude and terrain; a day/night swing peaks at 14:00. The terrain profile
   (`TERRAIN_PROFILES`) shifts temperature, scales precipitation and wind, and
   damps or exaggerates both swings — coasts are steady, deserts swing wild.
2. **Anomaly** — a smooth seeded noise field over (world x, y, game-hours),
   normalized to roughly unit variance (statistically enforced by
   tests/weather.test.ts). `ANOMALY_SCALE` says what one standard deviation
   does to each variable. The base octave spans ~8 atlas units — two or three
   region-spacings — so a big excursion is automatically a wide one: one storm
   covers neighbors, fading toward its edge, without ever being told to.

`RegionDef.terrain` picks the profile ('plains' when absent);
`RegionDef.sheltered` is for interiors — wind and precipitation zero out and
only a damped temperature leaks in (the cave system, the home base).
`AreaDef.sheltered` overrides it for one area (band 2's floors open the roofed
Ascent to the sky). `AreaDef.skyRegionId` names the region whose sky the area
stands under when that is not the region it is drawn in. Read the sky through
`skyRegionOf`, never `REGIONS[area.regionId]`: it applies both fields.
A region with no atlas pin has **no weather at all** — `weatherAt` returns
null; place it in the forge first.

**Phenomena are classifications, not variables.** `classify()` reads the three
curves plus terrain: freezing rain is snow, a windy snow is a blizzard, a dry
desert gale is a sandstorm, a still sheltered room is 'still'. Kinds today:
still, clear, overcast, mist, rain, storm, snow, blizzard, gale, sandstorm,
heatwave, calm. Heatwave and calm are table-only: `classify` returns them
only for a region sky table (its `extended` argument, below), so the noise
path never produces them. Adding a phenomenon means adding a branch there —
never a new simulated variable.

**Sunlight is a classification too.** `sunlight(state)` (exposure.ts) is 0
under a roof (a sheltered region or an `indoor` tag) and on a `dark` tag, and
otherwise the sky's daylight (1 − `naturalDarkness(hour)`) times `SUN_SHARE`
for the weather kind: clear and still 1, gale 0.8, mist 0.5, overcast 0.4,
snow 0.3, rain and sandstorm 0.2, storm 0.1, blizzard 0.05, heatwave and calm
1 (placeholders). An
unplaced region reads as clear. Lamplight is not sun: a settlement street at
night reads 0. Solar Charge banks it (docs/FACET.md). A new weather kind needs
a share; `SUN_SHARE` is a `Record<WeatherKind, …>`, so it will not compile
without one.

## Region skies: the Malgeri Mountains

User ruling, 2026-11-11: floor 17 becomes the Malgeri Mountains, a floor whose
mechanic is weather. This section is the engine; the floor built on it, with
its spots, monsters and the calm rule, is docs/MALGERI.md.
Data: `SKY_TABLES`, `SKY_RULES`, `SKY_THRESHOLDS` and the constants in
climate.data.ts. Code: the "region skies" half of weather.ts, `tickSky` in
exposure.ts, `skyContentIssues` in skyValidation.ts. Nothing is saved except
one `flag:` counter (see "The first calm"), so the engine needs no save field.
The floor built on it bumps the save to v65 for the placeholder floor's old
clear (docs/MALGERI.md, "Old saves").

**How an area opts in.** `RegionDef.sky` names a table in `SKY_TABLES`. The
region `malgeri_range` (locations.data.ts) carries `sky: 'malgeri'`, terrain
'mountains' and an atlas pin at (16, 29). An area opts in with
`skyRegionId: 'malgeri_range'`, or with `regionId: 'malgeri_range'` if it
belongs to that region outright. The two differ in what else reads
`regionId`: the stack map, the ladder and the tower section group floors by
it, one region per tower (`stackAreas`, `towerOfRegion`, `regionOfTower` in
ladderView.ts). An area of a banded tower that left its region would drop out
of its stack (tests/map.test.ts and tests/towersection.test.ts count 19 floors
instead of 20), so a tower floor uses `skyRegionId` and keeps `regionId`.
`weatherAt` takes the table path when
`region.sky` names a table, the region has a pin and it is not `sheltered`;
every other region takes the noise path above, unchanged. tests/sky.test.ts
pins that with digests of the noise samples of the regions without a table.

**Fronts.** The sky is a run of fronts, `FRONT_HOURS` = 6 game hours each,
cells aligned to tick 0 (four a day). Each cell draws one front by weight:

| front | weight | temp °C | precip | wind |
|---|---|---|---|---|
| gale | 24 | 5 | 0.30 | 0.80 |
| snow | 22 | −4 | 0.80 | 0.35 |
| rain | 20 | 7 | 0.80 | 0.35 |
| storm | 18 | 8 | 0.85 | 0.80 |
| heatwave | 14.5 | 38 | 0.05 | 0.20 |

Each season excludes one kind and the remaining weights renormalise (divided
by the remaining total): summer no snow, winter no heatwave, spring no storm,
autumn no rain. The season is `clockOf` at the cell's first tick. The draw is
`skyDraw(seed, region id, cell, salt)`: the FNV-1a hash of the region id mixed
with the world seed and the cell index through murmur3 fmix32, one number in
[0, 1). It is pure in (seed, region id, tick), so there is nothing to save and
offline catch-up replays the same sky. The values are absolute, not offsets
from the climate baseline, and `classify(front, terrain, false, true)` must
return the front's kind (asserted for every front).

**Calm.** One spell per window of `CALM_PERIOD_DAYS` = 12 game days, each
`CALM_HOURS` = 8 game hours long (2.8% of the time). `calmSpell(seed, region,
window)` hashes the start over every position that fits the whole spell in its
window, so a spell never straddles two windows and every window holds exactly
one. A calm spell replaces whatever front is running. Its values are
temp 14, precip 0.1, wind 0.02.

| knob | value | meaning |
|---|---|---|
| `FRONT_HOURS` | 6 | game hours per front |
| `CALM_PERIOD_DAYS` | 12 | one calm spell per window of this many game days |
| `CALM_HOURS` | 8 | game hours per calm spell |
| `SKY_THRESHOLDS.heatwaveTemp` | 35 | `classify` reads temp ≥ this, with a dry sky, as heatwave |
| `SKY_THRESHOLDS.calmWind` | 0.05 | wind ≤ this, with a dry sky, is calm |
| `SKY_THRESHOLDS.dryPrecip` | 0.18 | the dry-sky bound for both |

`classify`'s fourth argument, `extended`, enables heatwave and calm. Only the
table path passes it, which is why the noise path can never produce either.

**Measured shares** (three seeds, three years, one sample an hour): gale
29.1%, snow 20.1%, rain 18.0%, storm 16.6%, heatwave 13.4%, calm 2.8%.

**The sample memo.** The table path caches its `WeatherSample` per (seed,
region id, sky, terrain, game minute); a front changes only on a cell
boundary and calm on a whole minute, so nothing moves inside a minute. Ten
ticks of a minute cost one computation. The key uses ids, not object
identity, because `skyRegionOf` returns a fresh object per call. Samples are
frozen. The map clears at 4,096 entries. The noise path is not cached.

**What the open sky does: `SKY_RULES`.** `tickSky(state, bus, catchingUp)`
runs from `Game.advance` beside `tickExposure`. It returns at once unless the
spot's sky region has a sky table (`skyRegionOf(spot)?.sky`): the noise-field
weather of the rest of the world is cosmetic and applies no rule. Otherwise,
once per game minute, under an open sky (`skyKindAt` is non-null: no sheltered
region or area, no `indoor` tag at any level, an atlas pin), it applies
`SKY_RULES[kind]` on every minute `every` divides, through `applyStatus` with
the player's derived stats, so resistances thin the dose. The source string is `Weather: <kind>`. A rule's
`foes` (none shipped) land the same way on the enemies of a fight in
progress.

| sky | every | doses |
|---|---|---|
| gale | 3 min | buffeted 0.5 |
| rain | 3 min | wet 1 |
| snow | 3 min | chilled 0.15 |
| storm | 3 min | wet 1, jolted 0.5 |
| heatwave | 3 min | sweltering 0.5, dazzled 1 with chance 0.25 |
| calm, and every kind with no row | none | none |

Each status is an existing one and climbs its own ladder at the dose given
(wet to soaked, buffeted to unfooted, chilled to frozen, jolted to shocked,
dazzled to blinded). `dazzled` adds a stack per dose and blinds at four, so a
dose every 3 minutes would blind in 12; the 0.25 chance makes it one stack per
12 minutes on average. `sweltering` is new: icon 🥵, element heat, sum stacking
capped at 6, 30 s duration, maximum stamina −5% per point of intensity up to
−30% (`ceilings`, read outside the derived-stats cache). Its text is a
"Label: fact" block like the other statuses.

**The jolt from a storm never drops the weapon.** `jolted` carries
`dropWeaponBelow: 0.5` (a discharge under half health unequips the weapon).
Weather doses carry the source `Weather: <kind>` (`WEATHER_SOURCE_PREFIX`,
climate.data.ts). `statusBarDamage` leaves `dropWeaponBelow` off a condition
that is held under a weather source, so a character parked under an open sky
keeps the weapon through every storm. A dose from any other source takes the
held condition over (`inflict`, statuses.ts), so a Spark Slime's jolt keeps its
drop, even when a storm's jolt was there first. Test: tests/sky.test.ts, "a jolt
the storm applied never makes the bearer drop the weapon".

**Weather is still not a mod source.** `SKY_RULES` only applies statuses, and
the fingerprint includes every held status, so no new modifier source joins
`modFingerprint`. What changed is how a decaying status is keyed (below, "Cost").

**Encounter lines that wait on the sky.** `SpotEncounter.sky?: WeatherKind[]`:
the line rolls only while the spot's sky is one of the listed kinds.
`eligibleEncounters` (combat.ts) reads the sky through `skyKindAt`, and only
when some line has `sky`. Under no open sky (a roof, a sheltered area, an
`indoor` tag, no pin) a `sky` line never rolls and plain lines are unaffected.
The floor-standard clear-table rule (docs/FLOOR_STANDARD.md) treats a `sky`
line like a `daypart` line: it does not cover a gap. `skyContentIssues`
(skyValidation.ts) is the shared lint, called by tests/content.test.ts and by
`forge/lib/validate.ts`. It rejects: a region `sky` that is not in `SKY_TABLES`
or has no pin; a `sky` list that is empty or names a non-kind; heatwave or
calm in a region with no sky table; a `sky` line on a sheltered or `indoor`
spot; a `sky` line in an unpinned region; an area `skyRegionId` that names no
region. A spot's sky region for these checks is `skyRegionId ?? regionId`, as
`skyRegionOf` resolves it.

**The first calm.** Calm is dangerous only through which monsters its lines
bring, never through a status. Nothing may tell the player that before they
have met it. `tickSky` sets `flag:malgeri_calm_seen` (`CALM_SEEN_KEY`) and
logs one line, `exposure.calm_first`, the first minute the player stands under
a calm open sky. The flag is a plain `state.stats` counter, so there is no
save change. It is set during offline catch-up too, so the same ticks leave
the same state; the summarised catch-up suppresses the log, and the offline
summary carries the line (`OfflineSummary.firstCalm`) in its place.
`tickSky` also opens the bestiary entries of species killed under the veil
(`openLiftedEntries`). `prestigeNow` carries the flag over,
so the line fires once per save. Before the flag is set, that log entry is the
only text that names calm; floor 17's captain line and the calm species'
bestiary entries wait on the flag (MALGERI.md, "The disclosure rule"). The weather chip and the forecast show the kind like any other; the
forecast's rough read says "plain skies". Any future hint, tracker or tooltip
that would name calm reads `CALM_SEEN_KEY` first. tests/sky.test.ts asserts
that no other log text and no sky-rule status text contains the word.

**Rules apply only under a sky table.** `SKY_RULES` was first written to apply
wherever the sky is open. That reached about 14 Threshold outdoor spots, the
Foot of the Ascent, floor 0's field and gate, floor 4 (6 spots), floor 5 (5 of
6) and floor 6 (3 of 7), whose noise-field weather has a rule-bearing kind
(rain, snow, storm, gale) 41.3% (Ascent) and 42.1% (Threshold) of game time
(three seeds, three years). The restriction in `tickSky` removes that: those
places show weather and take no status from it. The tests that had imported
`tests/fixtures/fair-sky.ts` to empty `SKY_RULES` (alchemy, john, phase2,
proto26) no longer need it, and the fixture is deleted.

The map's threat badge (`spotThreat`, ui/lib/navigation.ts) reads
`eligibleEncounters`, so a spot whose `sky` lines have different levels shows
a range that moves with the sky. It skips the lines of a veiled species
(`MonsterDef.veil`, `isVeiled` in systems/bestiary.ts), so a calm line adds
its levels to the badge only after `flag:malgeri_calm_seen` is set.

**Cost** (8-hour offline catch-up, 288,000 ticks, hunting, level 30
attributes, one run each, wall time noisy):

| spot and sky | rules | derived-stats rebuild ticks | wall time |
|---|---|---|---|
| floor 4 woods edge (noise field) | off | 455 (0.95 a minute) | 3.6 s |
| floor 4 woods edge (noise field) | on | 4,988 (10.4 a minute) | 3.9–5.3 s |
| mountain spot, every front a gale | off | 7,016 (14.6 a minute) | 9.2–13.4 s |
| mountain spot, every front a gale | on | 88,320 (184 a minute, 31% of ticks) | 14.4–17.8 s |

The two noise-field rows were measured before `tickSky` was restricted to sky
tables; with the restriction a noise-field region costs the "off" row. About
99% of those rebuilds happened while `buffeted` is held. `buffeted` has
`decayWithDuration`, so its `effectiveIntensity` moves every tick, and
`modFingerprint` keyed `effectiveIntensity` for every held status, with or
without stat mods.

Applied: `modFingerprint` keys a held condition by `statBlockIntensity`
(statuses.ts). A `decayWithDuration` condition keeps its effective intensity in
the key only when its definition carries a field the stat block reads through
intensity: `mods`, `damp`, `resFloor` or `attrCeiling`. Every other condition
is keyed by its raw intensity, so `buffeted` (displacement only) no longer moves
the key as it fades. `tainted` has `mods` and keeps its decay. The audited field
list and the fields read by presence only are in the comment on
`statBlockIntensity`. Tests (tests/derivedcache.test.ts, "a decaying condition
and the cache"): the cached block equals a fresh compute on every tick of every
decaying condition's life; held `tainted` still follows its decay; a decaying
condition with no read field serves at most two distinct blocks across its
life; a 3,000-tick stay at the open east ridge from the start of a gale serves
a block equal to a fresh compute on every tick.

Measured after the change, same 8-hour catch-up on the open ridge (hp held so a
knockout does not end the stay; 19,693 kills in every run): live play from a
gale start rebuilt on 2,764 of 3,000 ticks before and 348 after. Catch-up wall
time, alternating old and new keys on one machine with noisy timing: old 48.3,
45.0, 31.4 and 31.1 s; new 35.3, 27.8, 27.4 and 26.5 s. The last two runs of
each average 31.2 s old against 26.9 s new, about 13% less. The rest of the
catch-up is the fight loop, not the stat block. The `weatherAt` memo itself
saves about 0.15 s per 8 hours (285 ms of misses against 130 ms of hits over
288,000 calls).

**Tests** (tests/sky.test.ts, fixtures in tests/fixtures/malgeri.ts):
table shape, front shares within 1% of the weights per season, the excluded
kinds, calm length, spacing and determinism, regions without a table
byte-identical, the sample memo, every `SKY_RULES` row (dose, period, none
under a roof or in calm, resistance thinning, the sweltering ceiling,
dazzle's chance, foes), the `sky` encounter filter, the first-calm line (once,
stamped in catch-up too, kept over a prestige), the secrecy checks on log and
status text, the forecast, and `skyContentIssues`.

## Rules for future work

- **Weather is not yet a mod source.** The day it modifies player stats, the
  modifier must key on the **bucket** — `kind` + `band` (the five temperature
  bands), never the raw floats — and that bucket must join the derived-stats
  `modFingerprint`, or the memo will thrash every game minute. See
  ENGINEERING.md. `SKY_RULES` is not that: it applies ordinary statuses, which
  the fingerprint already covers as held statuses, and `getDerivedStats` never
  reads the sky.
- **Named events are step 3+** (see NEXT.md §2): detected as connected
  excursions of the anomaly field past a percentile-baked threshold, ranked by
  integrated severity, named from a word registry, frozen into a chronicle
  once witnessed. The field above was built for this — do not add a second
  randomness source for events.
- The player-facing clock is **Chronosense** (`systems/chronosense.ts`, skill
  `chronosense`): manifests after one lived day, gains XP passively per game
  minute (offline replay included — time away counts), and each precision
  tier widens the header chip — daypart (1), season and moons (4), hour (8), weekday
  (12), full date (16), exact minute (25). A holy day is *felt* at
  season-tier, *named* at date-tier. Exists for time-gated content: post-
  prestige events and the base's hint system will point at dates, which only
  matter to a player who can read them.
- **The ceiling is 20** (`SkillDef.maxLevel`): the skill shows MAX there and
  further XP is *discarded*, not banked. Levels beyond come only from cap
  raises (`raiseSkillCap` / `SkillState.capRaised` — quests, events,
  prestige), which puts the exact-minute tier (25) on the far side of the
  wall by construction. Raised levels buy **time-resistance**:
  `timePenaltyMult(level)` shrinks time-imparted penalties ×0.99 per level
  from 21, ×0.97 on decade levels, an extra ×0.95 at 50/75/100 — the full
  ladder to 100 leaves 32.6% of a penalty (a 67% resistance). That function
  is the canonical hook: every future time-based penalty multiplies through
  it rather than inventing its own scaling. The cap machinery is generic —
  any skill may declare `maxLevel`.
- The player-facing **weather chip** sits beside the clock in the header
  (icon + temperature; hover for kind and band). It needs no skill — skin
  reads weather for free. The HP bar it replaced lives in the panels.

## Exposure — the world training the body

`systems/exposure.ts`. Three teachers, all feeding the same `resist:<type>`
skills that taking typed damage manifests and levels (every element now has
its skill: heat, cold, poison, water, wind, earth, lightning, light, dark,
arcane):

- **Weather**, per game minute, in the player's region, unless a roof (spot
  `indoor` tag or region `sheltered`) intervenes: temp ≥ 32° trains heat,
  ≤ −5° cold; rain → water; storm → wind:water:lightning 65:30:5; gale and
  blizzard → wind; sandstorm → wind:earth 80:20; heatwave → heat (paid once,
  not again for its temperature); a clear daytime sky ≥ 6° over its seasonal
  baseline is glare → light. Under the same open sky in a region with a sky
  table, `tickSky` also applies the sky's status doses (see "Region skies"
  below).
- **Places**: elemental tags seep a small trickle into whoever loiters —
  and they live at every level of the chain: a spot's effective tags are the
  UNION region ∪ area ∪ spot, so `'dark'` on the Malgeri Cave System region
  darkens every chamber, and one poisonous chamber bordered by magma just
  adds `'poison', 'heat'` on its own line. `'dark'` is a real condition, not
  just a resistance trickle: a dark-tagged place is black at ANY hour — it
  trains Darkvision and applies the night-fighting penalties regardless of
  the clock, overriding roofs and lamplight (you tagged it dark on purpose).
  Vocabulary in `ELEMENT_TAGS` + `PLACE_TAGS`, linted in both layers at all
  three levels, offered by the forge's tag editor on regions, areas and
  spots alike.
- **Work**: an activity or craft tagged with an element pays exposure per
  completed cycle, scaled by the cycle's base ticks — the smith is in the
  heat for the whole job, and a faster smith completes more jobs an hour.

**Darkness** trains a sense instead: true dark (night hours, outdoors, no
`settlement` lamplight, less under moonlight, see "Moonlight" above) grows
**Darkvision** (`darkvision`, environmental,
capped 50). Night fighting carries real penalties — a flat miss chance and a
dodge tax (`DARK_MISS_CHANCE`, `DARK_DODGE_PENALTY`), scaled by
`darknessFactor(state)` and eroded linearly to ZERO at Darkvision 50.
Monsters are of the dark and pay nothing. Because night is a mechanic, a new
save opens at **09:00** (at the Foot of the Ascent, `STARTING_SPOT`), not tick
zero's midnight. (The old "classic dev start" toggle went with the village it
started in when the countryside was shelved, 2026-09-12.)

- **Weathersense** (`systems/weathersense.ts`, skill `weathersense`,
  environmental, capped 30, very slow `esoteric` curve) reads the sky
  FORWARD — honestly, since weather is a pure function of the future. It
  manifests in the first severe weather that catches you outside, then grows
  semi-novelty style: a near-nothing watching trickle under any open sky,
  real lessons from severe weather (novel per KIND — `wx:storm`,
  `wx:sandstorm`… — the first is a curriculum, the tenth is Tuesday) and
  from travel (novel per region's skies). The forecast rows on the weather
  chip's hover: 2 h at level 1, 6 h at 2, 12 h at 3, the **area prognosis
  tooltip with the tomorrow row at 5**, then a new day every 4 levels out to
  7 days at 29–30. Each row arrives as a *rough guess* (vague words + "(?)"),
  turns *fair* (kind + temperature band) two levels later, and *precise*
  (kind + exact degrees) five levels on. A rough read of a calm sky, a
  heatwave or any dry sky says "plain skies"; the fair and precise reads name
  the kind, calm included. The forecast may show calm as weather; nothing in
  it says what calm does (see "The first calm"). The novelty spec's `discovery`
  value is reserved for the chronicle: witnessing a NAMED event will pay it
  outright. Divination/deity forecasting can still layer on top later.
- Changing `TICKS_PER_GAME_MINUTE` or the year's shape rewrites every save's
  current date (the tick count is the calendar). Fine before launch; a
  migration question after.
