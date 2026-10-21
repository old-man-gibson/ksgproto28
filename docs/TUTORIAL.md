# Floor 0 — the tutorial

*What a new life sees first, how the panels are driven, and how to change any of it.*

Shipped 2026-09-15 (save v54). Plan card: [plans/floor-zero-tutorial.md](plans/floor-zero-tutorial.md).

Files:

- `src/core/data/tutorial.data.ts` — the steps, the flags, the rack, the spell list
- `src/core/text/tutorial.text.ts` — every word the panels say
- `src/core/systems/tutorial.ts` — current step, the three choices, skip, the finish
- `src/core/data/locations.data.ts` — region `holding_level`, area `ascent_f0_area`, spots `f0_*`
- `src/core/data/towers.data.ts` — floor `ascent_f0` (bandless, index 0)
- `src/core/data/monsters.data.ts` — `slime_cell`; `MonsterDef.fixedDamage`
- `src/ui/TutorialCard.svelte` — the card above the tabs; `QuestsPanel` holds the Guide
- `src/ui/lib/tutorialFocus.ts` — what each step shows, hides and points at (§5)
- `src/ui/lib/tilemaps/holding_level.map.json` — the drawn map (docs/TILEMAPS.md)
- `tests/tutorial.test.ts`, `tests/tutorialfocus.test.ts`

---

## 1. What the player gets

A new save opens in **The Holding Cell** on floor 0 of the tower. Four spots in a
line, each road 2–3 s: cell → cellblock → field → gate. The gate's road into
Threshold is **one-way** and lands at the Foot of the Ascent, where the game used
to open; floor 0 closes behind the player and the Foot never lists a road back.

A card above the tabs walks nine steps, and the screen around it shows only what
the current step uses (§5):

| # | id | done when | choice |
|---|---|---|---|
| 1 | `arm` | `flag:tutorial_weapon` ≥ 1 | the rack: spear / sword / dagger / hammer / unarmed, shield beside a one-handed pick |
| 2 | `stance` | `flag:tutorial_stance` ≥ 1 | any unlocked stance, through `setStyle` |
| 3 | `cellblock` | stood in `f0_cellblock` | |
| 4 | `fight` | `slain:f0_cellblock:slime_cell` ≥ 1 | |
| 5 | `field` | stood in `f0_field` | |
| 6 | `spell` | `flag:tutorial_spell` ≥ 1 | fire / ice / spark as a one-word prepared sentence, plus Intelligence 2 |
| 7 | `cast` | `fights:f0_field` ≥ 1 | |
| 8 | `gate` | stood in `f0_gate` | |
| 9 | `leave` | stood at `ascent_foot` | |

**Skip floor 0** is offered once, on the first step only, as "Played before?
Skip floor 0" at the foot of the card; it disappears with the first pick from the
rack. It takes two clicks (the second names what the player gets) and calls
`game.skipTutorial()`, which settles every unmade choice the way the game used
to open — rusty sword in the pack, Neutral, no spell — stamps every flag, and
stands the player at the Foot. The tutorial ends (`flag:tutorial_done` = 1) the
moment the player arrives at the Foot by any means; prestige stamps it on the
next run, and the v53→v54 migration stamps it on every older save.

The panels stay readable afterwards on the Quests tab under **Guide**
(COMPLETABILITY §3: a one-time tutorial is not an explanation).

**After the tutorial: tower first** (user, 2026-10-18). The `leave` panel and
the finish line (`tutorial.done`) both name the next step: floor 1, the
Warden's quest The First Ascent. The Warden offers it from the start and
lists it first; The Faces of Threshold and A Taste of Everything are offered
beside it and are optional before the climb. The whole city is on the map on
arrival (NAVIGATION.md §2.4), 1 s per road, so going to town first costs
nothing but the choice.

## 2. The rules that make it safe

- **The step is derived, never saved.** `tutorialStep` returns the first step
  whose `done(state)` is false. A player who picks the spell before the weapon
  sees the weapon panel; nothing is ever stale, and no step index can desync
  from a save.
- **Nothing gates on a choice.** The roads and fights on floor 0 work with every
  panel ignored. The tutorial is a commentary track over ordinary content; a
  player who clicks the map straight to the gate leaves with the rusty sword
  still in the pack and the flags stamped by the finish.
- **Choices go through the real controls.** The stance pick calls `setStyle`;
  the rack calls `equipItem`; the spell is `addSpell` + `prepared`. The only
  thing the tutorial owns is the stamp.
- **The spell is granted, not inscribed.** `inscribeArcane` would refuse
  `spark` (Arcana 3) to a fresh speaker, and bumping `spells:inscribed` would
  pre-pay A Taste of Everything. So the grimoire entry is written directly
  and that counter is left alone. A one-word sentence costs 2 mana; mana is
  1 × INT; the pick trains INT to exactly 2 (never lowering a level already
  earned), which is what makes the spell castable in the very next fight.
- **The slime is training equipment.** `MonsterDef.fixedDamage: 1` pins every
  landed blow at 1 — after the crit roll, before armour, resistance and
  counters. Dodges and parries resolve normally. `armor: 0` and explicit zero
  resistances override what `inorganic` and `slime` would otherwise imply, so
  every rack weapon lands for its listed number. HP is `12 + 7 × CON` at CON
  1.5, jittered: three to five hits from a rusty sword, two to three from the
  spear, six to eight unarmed. `groupWeights: { 1: 100 }` and
  `modifierWeights: { normal: 100 }` keep it one plain slime.
- **The floor is off the ladder.** `ascent_f0` has no `bandId`, so it opens
  nothing, gates nothing, and is exempt from the closed-area rule (the gate is
  an authored one-way edge). The ladder panel does not list it.
- **The cell is a haven and the safety fallback.** `STARTING_SPOT` is
  `f0_cell`; `retreatSpot` falls back to it when a save has stood nowhere
  restful yet. Once the player has stood at the Foot, that is the nearest
  haven and floor 0 is never returned to.

## 3. Changing it

- **Words**: `tutorial.text.ts`. One or two sentences per step, about the game,
  never about the tutorial: the screen already points at the control, so the
  text does not say where it is. Every number quoted there is a number in a
  data file — road ticks, the slime's `fixedDamage`, the word's `mana`. Change
  both.
- **A step**: add an entry to `TUTORIAL_STEPS` with a `done` predicate that
  reads the save (counters, position). Order is declaration order. A step with
  `choice` needs a widget in `TutorialCard.svelte`. Every step also needs an
  entry in `SCREENS` in `tutorialFocus.ts` (what it points at, what it adds);
  `tests/tutorialfocus.test.ts` fails until it has one.
- **The rack**: `TUTORIAL_RACK` maps a pick to an item id and how many hands
  it takes; the shield offer follows `hands === 'one'`.
- **The spells**: `TUTORIAL_SPELLS`; `TUTORIAL_SPELL_INT` is the level the pick
  trains to.
- **Retiring it**: point `STARTING_SPOT` back at `ascent_foot` and the panel
  never shows (the finish listener fires on arrival). The floor stays authored.

## 4. The tile map

Floor 0 is the first region drawn from tiles instead of the node diagram —
`src/ui/lib/tilemaps/holding_level.map.json`, painted in the forge's Tiles
mode. How drawn maps work, how they are edited and why the art is not in the
repo is all in **[TILEMAPS.md](TILEMAPS.md)**. The one fact that matters here:
spot `map` coordinates land on the picture as `x = tile / 32 × 100`,
`y = tile / 24 × 75`, so moving a spot in the forge snaps it to a tile.

## 5. The screen

Built 2026-10-20 after the user said the card "can be too easily skipped or just
ignored since it's at the top of the screen". The tutorial now drives the screen
instead of sitting above it. All of it is presentation: `tutorialScreen(state)`
in `src/ui/lib/tutorialFocus.ts` reads the current step (itself read off the
save) and returns what to draw. Nothing is stored, a reload lands on the same
screen, and nothing the player can do is removed — a hidden tab or button only
waits.

**What the screen hides until the tutorial ends**

| | arrives |
|---|---|
| Combat tab | step 4 (`fight`) |
| Equipment tab | step 5 (`field`) |
| every other tab | the Foot |
| the sidebar (bars, level, attributes) | step 4 |
| Combat Stats (sidebar) | the Foot |
| gold readout | step 5 |
| pause / step / bonus-time buttons, weather | the Foot (Space, P, →, N still work) |
| Save / Export / Import / Reset | the Foot (Import is on the step 1 offer) |
| other map regions, the Caravan row, the map fold | the Foot |

A tab arrives with the step whose text first names it. With one tab the tab bar
is not drawn at all. Autosave runs throughout.

**What each step points at**

| step | target | drawn as |
|---|---|---|
| `arm`, `stance`, `spell` | `choice` — the widget on the card | steady accent outline with a widening ring (`.tutorial-glow`, app.css) |
| `cellblock`, `field`, `gate` | `spot:<id>` — the next map pin | full-opacity pin, accent ring that widens, bobbing ▼ above |
| `fight`, `cast` | `activity:hunt` — the button under Activities | `.tutorial-glow` |
| `fight`, `cast` once the hunt is chosen | `stage` — the battle stage | the Combat tab opens on it; no glow over a running fight |
| `leave` | `exit:ascent_foot` — the → Threshold label | accent, bold, pulsing, ▼ above |

A fight step whose player stands somewhere else points at the step's spot
instead (the button is not on screen there).

**Following the target.** When the target changes, `App.svelte` opens the tab it
is drawn on (`targetTab`) and scrolls `.tutorial-target` to the middle of the
view. It fires on a change only, so a player who clicks to another tab is not
dragged back until the next step. At 800 × 600 the activity buttons sit below the
map; this is what brings them up.

**The card.** Heavier frame, tinted ground, the step number in a solid badge,
one or two sentences. It is `position: sticky`: in the narrow layout (≤ 1100 px)
the page scrolls rather than the tab body, so `main` uses `overflow: clip visible`
there (clip is not a scroll container, so the card can stick to the window). In
the wide layout only the tab body scrolls and the card never leaves the top.
Colours are `app.css` tokens, so the display themes (THEMES.md) restyle it.

**Open (asked 2026-10-20):** step 2 still offers every unlocked stance (nine on a
new save). Cutting that down, or changing which are shown, is the user's call.

