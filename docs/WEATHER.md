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
hour, holy day, season, phase); `formatDate`/`formatTime` render it. On a holy
day, `monthIndex`, `dayOfMonth` and `weekday` are all null — those days are
genuinely outside the system, which is what makes them holy.

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
A region with no atlas pin has **no weather at all** — `weatherAt` returns
null; place it in the forge first.

**Phenomena are classifications, not variables.** `classify()` reads the three
curves plus terrain: freezing rain is snow, a windy snow is a blizzard, a dry
desert gale is a sandstorm, a still sheltered room is 'still'. Kinds today:
still, clear, overcast, mist, rain, storm, snow, blizzard, gale, sandstorm.
Adding a phenomenon means adding a branch there — never a new simulated
variable.

**Sunlight is a classification too.** `sunlight(state)` (exposure.ts) is 0
under a roof (a sheltered region or an `indoor` tag) and on a `dark` tag, and
otherwise the sky's daylight (1 − `naturalDarkness(hour)`) times `SUN_SHARE`
for the weather kind: clear and still 1, gale 0.8, mist 0.5, overcast 0.4,
snow 0.3, rain and sandstorm 0.2, storm 0.1, blizzard 0.05 (placeholders). An
unplaced region reads as clear. Lamplight is not sun: a settlement street at
night reads 0. Solar Charge banks it (docs/FACET.md). A new weather kind needs
a share; `SUN_SHARE` is a `Record<WeatherKind, …>`, so it will not compile
without one.

## Rules for future work

- **Weather is not yet a mod source.** The day it modifies player stats, the
  modifier must key on the **bucket** — `kind` + `band` (the five temperature
  bands), never the raw floats — and that bucket must join the derived-stats
  `modFingerprint`, or the memo will thrash every game minute. See
  ENGINEERING.md.
- **Named events are step 3+** (see NEXT.md §2): detected as connected
  excursions of the anomaly field past a percentile-baked threshold, ranked by
  integrated severity, named from a word registry, frozen into a chronicle
  once witnessed. The field above was built for this — do not add a second
  randomness source for events.
- The player-facing clock is **Chronosense** (`systems/chronosense.ts`, skill
  `chronosense`): manifests after one lived day, gains XP passively per game
  minute (offline replay included — time away counts), and each precision
  tier widens the header chip — daypart (1), season (4), hour (8), weekday
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
  blizzard → wind; sandstorm → wind:earth 80:20; a clear daytime sky ≥ 6°
  over its seasonal baseline is glare → light.
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
`settlement` lamplight) grows **Darkvision** (`darkvision`, environmental,
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
  (kind + exact degrees) five levels on. The novelty spec's `discovery`
  value is reserved for the chronicle: witnessing a NAMED event will pay it
  outright. Divination/deity forecasting can still layer on top later.
- Changing `TICKS_PER_GAME_MINUTE` or the year's shape rewrites every save's
  current date (the tick count is the calendar). Fine before launch; a
  migration question after.
