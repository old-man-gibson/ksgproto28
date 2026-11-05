---
id: display-themes
title: Display themes — a shared cue system, Gothic fixed, and new themes to pick from
kind: epic
status: building
system: ui
parent: ''
save: ''
updated: 2026-11-04
invariants:
  - no-layout-shift
  - click-not-hover
  - no-bought-art-in-git
  - semantic-colours-keep-meaning
done:
  - The user has picked which themes to build
  - Every built theme passes tests/themes.test.ts (contrast, contract tokens, literal allowlist)
---

# Display themes

User, 2026-11-04:
- "can you task the team to brainstorm themes? gothic is nice but I would like to check out a few more ideas"
- "really work on the themes. it needs to be readable, aesthetic, and navigatable"

Made by three brainstormers:
- the game's world and periods;
- materials and print media;
- readability and navigation first.

Each built its themes as real CSS and rendered them in headless Edge, on a hand-written page that loads the real
app.css and the real `<style>` blocks of 11–12 components. Contrast was computed by script (WCAG 2.x), and
colour-vision deficiency was checked with the Machado 2009 matrices and CIEDE2000. The renders are not the running
app. Scratch: the session scratchpad folders `ksg-world-themes`, `materials-print` and `rd`.

## 1. What is wrong today (measured)

| Check (target) | Default | Gothic |
|---|---|---|
| `--text-dim` on `--bg-hover` (4.5) | 4.1 | 4.46 |
| `--danger` as text on panel / raised / hover (4.5) | 6.0 / 5.2 / 4.5 | 3.9 / 3.5 / 3.1 |
| Worst log colour on panel (4.5) | 6.0 | 4.47 (danger) |
| White bar label on bar fills (4.5) | 9 of 10 fail, min 2.4 | 7 of 10 fail, min 3.0 |
| Button border on panel (3) | 1.4 | 2.1 |
| Pin outline on map ground (3) | 1.7 | 1.9 |
| Disabled (`opacity .45`) text on raised (4.5) | 3.4 | 3.3 |
| Stamina vs XP bar, normal vision (ΔE00, 12 = clearly different) | 7.3 | 1.7 |
| Mana vs spirit under deuteranopia (ΔE00) | 1.6 | 1.8 |
| Data colours (rarity, grade, status, …) under 4.5 on panel | 12 of 40 | 12 of 40 |

Also measured:
- **Focus.** There is no global keyboard focus style. MapPlan exits set `outline: none` with no replacement.
- **Log kinds.** All 10 log kinds are told apart by colour alone.
- **Pin states.** Hover, selected and tutorial-pointed pins all draw the same accent stroke.
- **Accent overload.** `--accent` carries current, selected, route, nav, gold, tutorial and focus (237 uses).
- **`--bg-deep`.** It is used in ChromosomePanel but defined nowhere.
- **Gothic type size.** Gothic's EB Garamond has a 0.40 em x-height, so `.small` 12.5 px text has a 5.0 px
  x-height (Default: 6.25 px).

## 2. Shared foundation (needed by every theme, Gothic and Default included)

**F1. Tokens and cue rules** (app.css plus a small `src/themes/cues.css`). Every new token defaults to today's
value.
- **New tokens:**
  - `--edge`: interactive border, at least 3:1 on every surface.
  - `--ring` and `--ring-w`: focus ring.
  - `--here`: the you-are-here ring.
  - `--sel-bg` and `--sel-ink`: selected pair.
  - `--text-off`: disabled text.
  - `--warn`: caution, a second tier below `--danger`; one-way today uses `--danger`.
  - `--buff`: teal, also the exploration fill.
  - `--night`: Gloom chip.
  - `--bar-ink`, `--bar-halo` and `--bar-track`.
  - `--road`.
  - `--district-a` … `--district-i`: map tints become tokens.
  - `--scrim` and `--lift`: modal backdrop and floating shadow.
  - `--hatch-lock`: locked pattern.
  - `--tint-mix`.
  - `--bg-deep`: an alias.
  - Fixed in every theme: `--tile-halo`, `--art-ink`, `--art-halo`. Text on painted art never reads `--text`.
- **Cue rules.** Every cue has a shape or text channel as well as a colour. State changes colour, border style,
  inset shadow, a marker or fill. It never changes padding, border width, font weight or size (no layout shift).
  Hover is an underline or background step only. Click, not hover.

| Cue | Shape / text channel | Colour |
|---|---|---|
| Current location | pin ring beyond the dot (no pulse under reduced motion); rows: bar + "HERE" | `--here` / `--accent` |
| Selected pin | fill `--sel-bg`, 3.5 px stroke, underlined label, `aria-expanded` | `--accent` |
| Clickable vs plain | `--edge` border at least 3:1; links underlined | `--edge` |
| Disabled | dashed border, transparent fill, `--text-off`, `not-allowed`; the reason as text where one exists | `--text-off` |
| Locked / unknown | hatch + 🔒 + terms as text; unknown pin dashed + "?" | `--text-dim` |
| Danger (forced fight, no retreat) | ⚔ + the words + the theme's danger mark | `--danger` |
| Caution (one-way, short supply) | ⤵ / ⚠ + words | `--warn` |
| Keyboard focus | global `:focus-visible` outline, 2 px offset; SVG pin ring; never `outline: none` without a replacement | `--ring` |
| Current nav item | a reserved marker slot `▸` (always laid out), left bar, `aria-current` | `--accent` |
| Active tab | plate, underline bar or connected tab, per theme | `--accent` |
| Log kind | a 1-character glyph gutter: `!` danger, `×` combat, `+` loot, `↑` skill, `★` achievement, `≈` fusion, `?` quest, `→` travel, `◦` explore, `·` info | `--log-*` |

**F2. Hard-coded colours** (62 lines in 29 files, outside SceneBackdrop and BattleStage):
- `--scrim` (10 lines) and `--lift` (9).
- `--night` (App.svelte 665–667), `--buff` (3) and `--warn` (2).
- Danger-derived borders (6).
- 15 dead fallbacks deleted.
- `--bg-deep` defined.
- Gothic's `#5a4a36` / `#7a6448` move to `--edge`.

Fixed by design (8): the royale map shade, RaidTrack over banner art, tile labels, and the talent-lap identity
colours.

**F3. Data colours.**
- Authored colours (rarity, quality tiers, statuses, schools, positions, talent laps) pass through an `ink()`
  helper: `oklch(from c clamp(var(--ink-lmin), l, var(--ink-lmax)) c h)`, behind `@supports`, at about 45 sites.
- Dark themes clamp only the lightness floor; a light theme clamps the ceiling.
- Measured after the clamp: 0 of 40 fail 4.5:1 on panel or raised in every candidate.
- Without it, a light theme fails 36–46 of 40–50.

**F4. Markup cues:**
- the log glyph gutter (LogFeed, LogTicker, `logGlyph(kind)` in logKinds.ts);
- the nav marker slot (NavIndex);
- the unknown pin dashed;
- the "here" second ring;
- exit focus (MapPlan);
- bar labels: ink plus a halo, or an off-fill rail per theme.

**F5. `tests/themes.test.ts`.** It parses `src/themes/*.css` and app.css, and asserts that every theme:
- defines every contract token;
- meets the contrast thresholds (text at least 7, dim, accent, danger and log at least 4.5, edge and ring at least 3,
  bar fill at least 3 on its track);
- keeps hue drift from Default at 25° or less;
- passes 4.5 on data colours after the clamp;
- has no colour literal in `.svelte` outside an allowlist.

**F6. Menu.** A theme select replaces the cycle button. SystemMenu's "switches between Default and Gothic" text is
updated.

Cost: about 40 lines of shared CSS, 62 audit lines, about 45 `ink()` sites, 4 markup changes and 1 test file. No
save change.

## 3. Gothic+ (Gothic with its failures fixed)

Same identity: brown, brass, Garamond, double frame. Changes:
- `--text-dim` raised.
- `--danger` raised (#e8695b).
- Bar fills moved into the window where a white label passes 4.5 and the fill passes 3 on the track.
- XP moved to hue 160, so it separates from stamina.
- The 10 log colours re-spaced. The colour-vision worst pair rises from 1.7–1.8 to 8.6 (bars) and 11.2 (logs).
- Optional: `font-size-adjust: .44` renders Garamond about 10% larger. It costs header width at 1024–1470 px.

## 4. Candidates

All of them:
- are CSS only, with fonts from OFL `@fontsource` packages;
- need no save change and no bought art;
- are about 110–205 lines each, after the foundation.

Renders: the session scratchpad. The numbers come from each brainstormer's script, on its own token table.

| # | Name | Ground | Concept | Type | Text / dim on panel | Danger on panel | Bars, worst colour-blind pair (ΔE00) | Extra cost / risk |
|---|---|---|---|---|---|---|---|---|
| T1 | Registry | dark grey-green | band 1 offices and the Chancery: filing-cabinet green, manila selection blocks, mono-caps section titles with a trailing rule, boxed stamp warnings, graph-paper map | IBM Plex Sans + Plex Mono | 12.6 / 7.2 | 6.8 | 9.8 | coloured children inside a manila selected block need a pass |
| T2 | Quayside | dark teal-black | harbor band: planking, sailcloth text, brass, a rope stripe on panel tops, the map as a chart | Libre Caslon Text | 13.4 / 8.0 | 6.8 | 8.3 | brass close to Gothic's gold; Caslon is small at 11–13 px |
| T3 | Enamel | dark bottle green | enamel signage: green plates, cream rim, cream inverse plate for selected, hazard stripe on warnings, rivets in padding | Barlow Semi Condensed | 14.4 / 9.0 | 7.1 | not run | many cream plates at once glare |
| T4 | Signage | black (high contrast) | wayfinding signs: signal-yellow plates, hazard stripes, black and white | Barlow + Barlow Condensed | 18.3 / 11.8 | 5.7 | 9.0 | brightest; header width +5% at 16 px |
| T5 | Cockpit | dark (quiet) | dark-cockpit rule: dim at rest, filled tiles only for exceptions, amber current | B612 | 14.6 / 7.6 | 6.0 | 8.6 | closest to a generic dark dashboard |
| T6 | Linocut | black | relief print: black key, bone ink, one saffron block, hatch on disabled and locked | Bitter + Alfa Slab One | 14.2 / 7.6 | 7.3 | not run | palette near Gothic's |
| T7 | Castle | light plaster | warring-states castle: white plaster, black timber beams, black inverse selection, a solid red warning tag, a lattice map | Spectral + Shippori Mincho | 13.7 / 7.5 | 6.2 | 4.4 | light pipeline (F3 and art ink); inverse selection needs a coloured-child pass |
| T8 | Ledger | light cream | account book: cream paper, iron-gall ink, double rules, an ink plate for selected, bars as a rule plus a thin rail | Source Serif 4 + Old Standard TT | 15.2 / 8.1 | 6.6 | not run | light pipeline; rails thin the bars |
| T9 | Sandstone | light limestone | desert band: limestone, kohl ink, bronze, a lapis focus ring, a stepped-pyramid frieze | Alegreya Sans + Marcellus | 13.8 / 7.7 | 6.4 | 3.6 | light pipeline; lowest colour-blind margin |
| T10 | Survey | light paper | drafting sheet: line weight and hatch, rust for current, folder tabs | IBM Plex Sans + Plex Sans Condensed | 15.8 / 6.9 | 5.5 | 9.8 | light pipeline; accent rust close to the focus bar |

Dropped:
- **Console.** Monospace and bracket glyphs: text runs 110–123% wider and breaks the one-row header budgets.
- **Blueprint and cyanotype.** The blue ground collides with the blue arc (PITFALLS §7).
- **Stained glass.** It reads as glow.
- **Slate and chalk.** Handwriting faces have proportional figures.
- **Lacquer.** Its palette is Gothic's.
- **Cast-iron plaque.** Bevels read as cards.

## 5. Manager recommendation

1. F1–F6 and Gothic+ first. They fix today's failures for every player, whatever theme is picked.
2. Build three new themes for the user to try in the Menu: Registry (T1), Enamel (T3) and Castle (T7), the light
   one. Castle brings in the light pipeline; the other light themes then cost only their own CSS.
3. Build the rest only on the user's pick.

## 6. Questions for the user

1. Which themes to build: mark each one in §4.
2. Gothic+: change the default theme's colours to fix the failures in §1, or keep Gothic as it is and offer Gothic+
   as a separate entry?
3. Default theme: stays Gothic(+), or switch to one of the new ones after trying them?

## 7. Antagonist rulings (antagonist-design, verdict FIX FIRST; all accepted)

| # | Objection | Evidence | Ruling (the plan changes) |
|---|---|---|---|
| 1 | Gothic+ darkens 8 bar tokens that 41 sites use as text (`.xp.maxed` 5.6 → 2.8) | measured | Gothic+ keeps the fill values. Bar labels get legible through `--bar-ink` + `--bar-halo` (F4). Only `--text-dim`, `--danger` and the XP/stamina separation change, each still at least 4.5 as text |
| 2 | The `ink()` clamp merges authored colours (Refuse = Poor, 4 greys merge under Castle) | measured | Remap, not clamp: `l' = lmin + l × (lmax − lmin)`, so order and separation are kept. F5 adds a minimum pairwise ΔE00 among same-family data colours after the remap |
| 3 | Solid inverse selected blocks hide coloured children (rarity chips 1.0–2.4) | measured | A theme may use a solid `--sel-bg` only where every coloured child passes 4.5 on it (an ink scope inside `.selected`). Otherwise selection is a border, inset bar or underline. F5 tests data colours on `--sel-bg`. The 9 components with selected + coloured children are in the cost |
| 4 | Registry and Castle change font weight or border width on engine-driven state (`.selected`, `.nav-on`, `.here`) | code | A lint in F5 forbids `font-weight`, `font-size`, `padding` and `border-width` inside state rules (`.selected`, `.nav-on`, `.here`, `:disabled`, `.picked`) |
| 5 | BattleStage reads `--text` over the dark stage (Castle: near-black on black) | code | BattleStage's three `--text` reads move to `--art-ink` / `--art-halo` (added to F2) |
| 6 | F5 rejects the candidates as mocked; no candidate file meets the F1 contract; numbers were taken on three token tables | measured | Write F5 first. Hue drift in OKLCH, at most 30°. `--ink-lmin` / `--ink-lmax` join the contract with defaults in app.css. Each theme is ported onto the contract before it is judged |
| 7 | Enamel mana/spirit deuteranopia 2.5; Enamel `--ring` = `--accent`; Registry `--ring` = `--here` | measured | F5 asserts ΔE00 at least 12 between `--ring`, `--here` and `--accent`, and the colour-vision minimum on the five resource bars. Enamel re-spaces mana/spirit |
| 8 | The mock's cues.css styles bare generic classes (`.ring`, `.node`, `.dot`, `.warn` exist in other components); some styled classes do not exist | grep | cues.css holds tokens, `:focus-visible` and `button:disabled` only. Every other cue is edited into its component (F4), including a locked-row class in TowerSection |
| 9 | Gothic+ was never rendered | file check | Render Gothic+ before asking the user |
| 10a | The global `button:disabled` falls through into 4 scoped disabled styles (empty equipment cell, grade buttons, cast, perform) | code | Audit the four. `--text-off` joins F5 (at least 4.5 on raised) |
| 10b | Castle's `filter: brightness()` on every bar fill | code | Bake the values into tokens |
| 10c | Registry defines no `--bar-halo`; 9 of 11 labels fail | measured | Every theme defines `--bar-ink` / `--bar-halo` (contract) |
| 10d | Shippori Mincho `400.css` pulls the Japanese slices | package | Import `latin-<weight>.css` for every font |
| 10e | The cue table codifies a hover tooltip | code | Removed from the table. Tip.svelte's hover opening is out of scope here and noted for the click-not-hover rule |
| 10f | Gothic+ `--log-quest` too close to `--text` | measured | Re-space it; the log glyph carries the kind as well |

Recommendation after the rulings: the same three (Registry, Enamel, Castle) as the user's picks allow. Survey (T10)
is a cheaper light representative than Castle: lower colour-vision risk, no stage ink beyond F2. The user picks.

## 8. Build log

- 2026-11-04, branch `theme-foundation`: F1–F6 and Gothic+ built with the rulings of §7 applied. The user approved the
  foundation and Gothic+ (Gothic's colours are replaced; no separate entry; the default stays Gothic). The contract, the
  cue table, `ink()` and the test are written up in [../THEMES.md](../THEMES.md). Candidates T1–T10 are not built.
  - Test first: `tests/themes.test.ts` failed 35 of 41 assertions on the old tree. The source lints found 62 colour
    literals, 1 state-rule hit (AscentPanel `.here { font-size }`) and 5 `outline: none` rules.
  - Deviations from §2: `--scrim-deep`, `--night-edge` added (the 70% scrims and the Gloom border had no other token);
    `--lift` is a shadow colour, not a whole shadow, so each component keeps its geometry; `--tint-mix` is the 16% the
    position pills already used; `--bg-deep` aliases `--bg-sunken` (two ChromosomePanel reads moved from fallbacks).
  - The selected-scope remap (ruling 3) is set on `button.selected` and on the marked cells of CollectionSection and
    EquipmentPanel. A search of every selected-like rule found no other state that holds authored colours; the plan's count
    of 9 is not reproduced.
  - Default colour-vision exceptions are mana/spirit, stamina/xp, hp/stamina and hp/focus, Gothic's are mana/spirit and
    stamina/focus (THEMES.md §7).
  - Default `--text-dim` and `--danger` moved by about 1% (4.13 and 4.46 on `--bg-hover`, now 4.51 and 4.60).
  - Marked cells (CollectionSection, EquipmentPanel) fill `--sel-bg`, which is the accent at 12% over raised in Default; they
    were 18%. The test checks authored colours against `--sel-bg`, so the cells must use it.
- 2026-11-04, fix round 1 (same branch):
  - Default lifts authored colours like every theme: `--ink-lmin` 0.48, `--sel-ink-lmin` 0.58 (the smallest that pass; 0.42 and
    0.48 do not on Default's lighter surfaces). The pinned exception is gone; the family spacing floor is 40% of Default's
    unlifted minimum, because Default's selected floor compresses more than Gothic's.
  - A bar token used as text reads `--<bar>-ink` (11 tokens, the fill through the same remap under `@supports`). 42 `color:`
    reads moved. The test finds text reads from source and checks them in every theme. Worst text read before: 2.42
    (`--stamina-winded`, Default) and 2.38 (`--hp`, Gothic); after: 5.60 and 5.46.
  - The map focus ring has its own radius (+15) outside the here rings (+6, +10) and is painted after them. `--road` is read
    by `.road` and `.head`.
  - The global disabled rule adds `filter: grayscale(1)`, so an emoji or a coloured delta inside a disabled button reads as
    disabled without opacity.
