# Display themes

*How the game's look is switched, how a theme is written, and what keeps it working as panels are added.*

Two themes exist: **Default** (the plain tokens in `app.css`) and **Gothic** (dark brown stone, bone text, brass accent, Cinzel
titles, EB Garamond body). Gothic is what a browser gets until its player picks one (user, 2026-11-03). The Menu window holds
the theme select. A theme is CSS only: it needs no save change and no art.

The foundation (a shared cue system, a token contract and `tests/themes.test.ts`) was built on 2026-11-04 from
[plans/display-themes.md](plans/display-themes.md). A theme that passes the test meets the contract. Everything a person needs
to write or fix a theme is on this page.

Files:

- `src/app.css`: the Default tokens (`:root`, every contract token) and the shared shapes: `.panel`, `button`, `.bar`.
- `src/themes/cues.css`: the global keyboard focus ring and the disabled-button style. Both read tokens only.
- `src/themes/<id>.css`: one theme, every rule under `:root[data-theme='<id>']`.
- `src/ui/lib/theme.ts`: the list of themes, `DEFAULT_THEME`, the stored pick, `applyTheme` (page only), `chooseTheme` (page and storage).
- `src/ui/lib/ink.ts`: `ink()`, the remap for authored colours (§4).
- `src/ui/lib/logKinds.ts`: the colour token and the glyph of each log kind.
- `src/main.ts`: imports the fonts and the theme CSS, applies the theme before the first paint.
- `src/ui/SystemMenu.svelte`: the theme select.
- `tests/themes.test.ts`, `tests/themeColor.ts`, `tests/themeCss.ts`, `tests/themeAllowlist.ts`, `tests/themeCues.test.ts`: the checks (§7).

## 1. How it works

A theme is plain CSS keyed on `data-theme` on `<html>`. Default has no attribute. The choice is a **browser preference, not game
state**: it lives under the localStorage key `ksgproto28-theme-choice`, outside the save's `ksgproto28:save` prefix, so no save
carries it and a hard reset keeps it.

Only a pick is stored. `loadTheme()` returns the stored pick, or `DEFAULT_THEME` (`gothic`) when there is none. Applying the
theme at boot stores nothing, so a browser that never used the select follows `DEFAULT_THEME`, and changing `DEFAULT_THEME`
later moves those browsers with it. The first prototype stored its theme at every boot under `ksgproto28-theme`; that key shows
no choice was made and is no longer read.

Components read colours from tokens (`var(--accent)`). A theme redefines tokens, so most screens restyle at once. The theme file
then changes the few shapes every panel is built from: panel frames, buttons, bars, headings, form controls, corner rounding.

Two things are not themed. Painted art (the battle stage, scenes, tile maps) keeps its pixels, and text over it reads
`--art-ink` (§6). Authored data colours (rarity, grade, status, school, position, talent lap) keep their hue and are lifted for
the theme's surfaces by `ink()` (§4).

## 2. The token contract

`app.css :root` declares every token with its Default value. A theme file must declare the **per-theme** tokens; the rest fall
back to Default. A theme may override any shared token. The **fixed** tokens are the same in every theme: a theme file does not
declare them.

### Per-theme (the theme file declares these)

| Token | Meaning |
|---|---|
| `--bg`, `--bg-panel`, `--bg-raised`, `--bg-hover`, `--bg-sunken` | Surfaces: page, panel, button and raised cell, hover step, wells (bar track, map ground). |
| `--border` | A rule between things. Not an interactive edge. |
| `--text` | Body text. At least 7:1 on panel, raised and hover. |
| `--text-dim` | Secondary text. At least 4.5:1 on panel, raised and hover. |
| `--accent` | Current screen, selected, route, gold, tutorial. At least 4.5:1. |
| `--danger` | Harm and no-retreat. At least 4.5:1 as text. |
| `--warn` | Caution, one tier under danger (one-way roads, a short supply). At least 4.5:1. |
| `--log-combat`, `--log-danger`, `--log-loot`, `--log-skill`, `--log-achievement`, `--log-fusion`, `--log-quest`, `--log-travel`, `--log-explore`, `--log-plain` | Log line colours, one per kind. At least 4.5:1 on panel, raised and hover. |
| `--edge` | Border of anything clickable. At least 3:1 on panel and raised. |
| `--ring` | Keyboard focus ring. At least 3:1 on panel and raised. |
| `--here` | The you-are-here ring on the map. At least 12 ΔE00 from `--ring` and from `--accent`. |
| `--sel-bg`, `--sel-ink` | Fill and ink of a selected thing. `--sel-ink` at least 4.5:1 on `--sel-bg`. |
| `--text-off` | Disabled text. At least 4.5:1 on raised. |
| `--bar-ink`, `--bar-halo` | Bar label ink and its outline. `--bar-ink` is at least 4.5:1 on every fill, or on `--bar-halo`. |
| `--ink-lmin`, `--ink-lmax` | The `ink()` remap bounds (§4). Default is 0.48 and 1. |

### Shared (Default declares, a theme may override)

| Token | Meaning |
|---|---|
| `--frame` | Inner rule of a double frame. Default is `--border`. |
| `--bg-deep` | Alias of `--bg-sunken` (ChromosomePanel reads it). |
| `--hp`, `--xp`, `--skill`, `--stamina`, `--stamina-winded`, `--stamina-exhausted`, `--mana`, `--manaburn`, `--spirit`, `--focus`, `--action` | Bar fills. At least 3:1 on `--bar-track`. Hue stays within 30° (OKLCH) of Default, so a colour keeps its meaning. `--xp` is also text: at least 4.5:1. |
| `--bar-track` | Bar well. Default is `--bg-sunken`. |
| `--ring-w` | Focus ring width. Default 2px. |
| `--buff` | A gain in progress, and the exploration fill. |
| `--night`, `--night-edge` | The Gloom chip's ink, and its border and fill. |
| `--road` | Map road colour. |
| `--district-a` to `--district-i` | The nine map district tints, by the order the region lists its areas. Warm and neutral only: the blue arc (mana, spirit, stamina) belongs to the resource bars. |
| `--scrim`, `--scrim-deep` | The dim behind a window (60%, 70% black in Default). |
| `--lift` | Shadow colour of a floating panel. |
| `--hatch-lock` | Background image of a locked row. |
| `--tint-mix` | Share of an authored colour mixed into a chip that wears it (16% in Default). |
| `--sel-ink-lmin`, `--sel-ink-lmax` | The `ink()` bounds inside a selected thing (§4). Default is 0.58 and 1. |
| `--stage-ink`, `--stage-accent`, `--stage-ok`, `--stage-ok-text`, `--stage-danger` | Colours inside the painted battle stage, the place banner and the raid pill, which stay dark in every theme. Default aliases them to `--text`, `--accent`, `--xp`, `--xp-ink` and `--danger`, so Default and Gothic are unchanged. A light theme sets all five to colours that hold 4.5:1 on the stage's ground (`#0b0e12`). `--stage-ink` is the colour that text without a colour of its own inherits inside the stage. |
| `--badge-bg`, `--badge-ink`, `--badge-dim` | A count or tag drawn on an item cell (EquipmentPanel, CollectionSection): the chip's fill, its text and its secondary text. Default aliases them to `--scrim`, `--text` and `--text-dim`. A light theme makes the chip dark and the text light. |
| `--font-caps` | Face of letter-spaced capitals. Unset in Default (`var(--font-caps, inherit)`). |

### Fixed (the same in every theme)

| Token | Meaning |
|---|---|
| `--mat-iron`, `--mat-steel`, `--mat-bronze`, `--mat-metal`, `--mat-wood`, `--mat-leather` | Material identity colours: iron is grey wherever it is drawn. |
| `--art-ink`, `--art-halo` | Text and outline over painted art (§6). |
| `--tile-halo` | Outline of a label drawn over tile art. |

## 3. Cues

Every cue has a shape or a text channel as well as a colour, so a state reads without colour. State changes colour, border style,
an inset shadow, a marker or a fill. **It never changes padding, border width, font weight or font size**: size and position do
not depend on per-tick or per-fight state. Hover is an underline or a background step, never size. Click opens, hover does not
(Tip.svelte's hover opening is the one known exception; it is out of scope here).

| Cue | Shape or text channel | Colour token |
|---|---|---|
| Current place on the map | two rings beyond the pin (the inner one pulses; no pulse under reduced motion); a "you are here" label on rows | `--here`, `--accent` |
| Selected pin | `--sel-bg` fill, 3.5px outline, underlined label, `aria-expanded` | `--accent`, `--sel-bg` |
| Unvisited place | dashed outline and a "?" icon | `--edge` |
| Clickable | border of `--edge` | `--edge` |
| Disabled | dashed border, no fill, `--text-off`, `not-allowed`, grayscale on what the button holds; a reason as text where one exists | `--text-off` |
| Locked row | hatch (`--hatch-lock`), a lock mark and the status word | `--text-dim` |
| Danger (a fight with no way out) | dashed ring, a crossed-swords mark, the words | `--danger` |
| Caution (one-way) | a ⤵ mark and the words | `--warn` |
| Keyboard focus | global `:focus-visible` outline of `--ring-w`, 2px offset; map pins draw a ring circle outside the here rings and painted after them; map exits underline | `--ring` |
| Current screen in the nav | a `▸` marker slot (always laid out, visible on the open screen), a left bar, `aria-current` | `--accent` |
| Log kind | a one-character glyph in a fixed-width gutter: `!` danger, `×` combat, `+` loot and item, `↑` skill, `★` achievement, `≈` fusion, `?` quest, `→` travel, `◦` explore, `·` info and action | `--log-*` |
| Bar label | `--bar-ink` with a 1px `--bar-halo` outline | `--bar-ink`, `--bar-halo` |

`themes/cues.css` holds only the focus ring and the disabled style. Every other cue is written into its component, because a bare
class selector in a shared file would restyle every component that uses the same word (PITFALLS §8). The disabled rule is
`:root button:disabled`: the `:root` prefix lifts it over a component's own single-class button colours. A rule with two
classes and the scope class beats it; such a rule must not set `opacity` on text that has to stay readable.

A component that removes the browser outline (`outline: none`) draws its own ring on `:focus-visible`. The test lists the few
allowed cases, each with the replacement.

## 4. Authored colours: `ink()` and the selected scope

Rarity, quality tier, status, school, position and talent-lap colours are authored in data (`src/core/data/*.data.ts`,
`ui/lib/talentBar.ts`) for no particular ground. They are drawn through `ink(color)` (`ui/lib/ink.ts`):

- OKLCH lightness `l` becomes `lmin + l * (lmax - lmin)`, chroma `c` becomes `c * lmax` and hue is kept. This is a **remap, not
  a clamp**: a clamp merges the dark colours (Refuse and Poor would become one grey); a remap keeps their order and spacing. The
  chroma factor is 1 wherever `lmax` is 1, so every dark theme keeps chroma; a light theme needs it (§11).
- `lmin` and `lmax` are `--ink-lmin` and `--ink-lmax`. Default is 0.48 and 1, Gothic 0.42 and 1: every dark theme lifts the
  dark colours until they pass 4.5:1 on its surfaces. A light theme lowers `lmax`. At 0 and 1 the result is the authored
  colour, pixel for pixel (checked on 44 colours in the browser).
- The CSS is `oklch(from <color> calc(var(--ink-lmin) + l * (var(--ink-lmax) - var(--ink-lmin))) calc(c * var(--ink-lmax)) h)`.
  A browser without relative colour syntax gets the raw colour: `ink()` checks `CSS.supports` once.
- Only a literal hex colour is remapped. `var(--token)` passes through, because a theme token is already the theme's colour.

Use `ink()` wherever data supplies a colour to CSS: `style="--tint: {ink(c)}"`, `color: {ink(c)}`, SVG `fill={ink(c)}`,
a helper that returns a colour. A new colour source in `src/core/data` must also be added to `FAMILIES` in
`tests/themes.test.ts`; the test fails on a hex colour it does not know.

**Selected scope.** A selected thing has a different fill, `--sel-bg`, which is usually lighter than the panel. Its authored
children need a different floor. `button.selected` (app.css) and a component's own selected rule set
`--ink-lmin: var(--sel-ink-lmin); --ink-lmax: var(--sel-ink-lmax)` on the selected element. The `oklch(from ...)` in a child
resolves `var(--ink-lmin)` on the child, so it inherits the selected pair. Today this is set on `button.selected`, and on the
marked cells of CollectionSection and EquipmentPanel (the two selected states that hold authored colours: grade badges and
rarity icons). A new selected state that holds authored colours does the same and fills with `--sel-bg`. A theme with a solid
`--sel-bg` (a dark block on a light page) must pass the test's check of authored colours on `--sel-bg`.

Numbers (every authored colour, after the remap):

| Theme | `--ink-lmin` / `--sel-ink-lmin` | Worst on panel and raised | Worst on `--sel-bg` | Refuse / Poor ΔE00 (normal, selected) |
|---|---|---|---|---|
| Default | 0.48 / 0.58 | 4.64 | 4.62 | 13.7, 10.4 (29.9 unlifted) |
| Gothic | 0.42 / 0.48 | 4.63 | 4.74 | 15.6, 13.7 |

Default's `--sel-bg` (the accent at 12% over raised) is lighter than Gothic's, so Default's selected floor is higher and its
colours inside a selected thing are compressed more. The family spacing check allows for that (§7).

**Bar fills as text.** A bar fill has to hold 3:1 on its track; text has to hold 4.5:1 on panel, raised and hover. A bar
token used as text (`color: var(--focus)`, an SVG `<text>` fill) reads its **-ink token** instead: `--hp-ink`, `--xp-ink`,
`--skill-ink`, `--stamina-ink`, `--stamina-winded-ink`, `--stamina-exhausted-ink`, `--mana-ink`, `--manaburn-ink`,
`--spirit-ink`, `--focus-ink`, `--action-ink`. app.css defines each as the fill through the same lightness remap, inside
`@supports (color: oklch(from red l c h))` (the plain fill is the fallback in `:root`, because a bare `var()` fallback does not
cover a value the browser cannot parse). A theme may declare any -ink token itself. The -ink tokens resolve on `:root`, so a
selected thing does not re-ink them; the test checks them on `--sel-bg` too.

The test finds every text read of a bar token in the source (§7). A colour that reaches `color:` through a custom property
(`color: var(--c)`) is not found: feed the property an -ink token (HeatTrack's `--c-ink`).

Worst text read, `--hp-ink` in both themes: Default 5.60, Gothic 5.46 (panel, raised, hover). Before the change the worst
were `--stamina-winded` 2.42 in Default and `--hp` 2.38 in Gothic.

## 5. Art ink

Text drawn over painted art never reads `--text`: a light theme would put near-black on a dark stage. Text over the battle stage,
the scene header (`.place-title`) and the raid banner reads `--art-ink` with `--art-halo` behind it. Map tile labels are white
with a `--tile-halo` outline. These tokens are fixed, so the art reads the same in every theme. The literals that stay in
`.svelte` files (BattleStage, SceneBackdrop, the tile-label `#fff`) are listed with reasons in `tests/themeAllowlist.ts`.

## 6. Rules for components

- **Tokens, not literals.** A colour literal (hex, `rgb()`, `hsl()`, a named colour) in a `.svelte` file fails the test. Give the
  colour a token in `app.css` with the old value as the Default, and read the token.
- **No metric change in a state rule.** `.selected`, `.nav-on`, `.here`, `:disabled`, `.picked`, `.active` and `[aria-current]`
  rules do not set `font-weight`, `font-size`, `padding` or `border-width`. Use colour, an inset shadow, a border colour or
  style, or a reserved marker. This is the no-layout-shift rule; the test lints it in `app.css`, the theme files and every
  `<style>` block.
- **Domain class names.** Do not name a class `bar`, `panel`, `dim` or `small` (app.css styles them globally).
- **Colour is data here.** HP, stamina, mana, spirit and focus are told apart by hue, and so are rarity and elements. A theme
  may shift them but must keep them distinguishable (the hue-drift and colour-vision checks).
- **Cinzel is capitals only.** Keep it on short titles (h1–h3, the tab rows inside panels, the screen list's group captions).
  Instruction lines (h4, helper text) stay in the body font. The captions read `--font-caps` as `var(--font-caps, inherit)`.
- **Numbers stay lining.** Garamond's default figures are old-style; Gothic sets `font-variant-numeric: lining-nums tabular-nums`
  so stat columns line up.

## 7. What the test checks

`tests/themes.test.ts` parses `app.css :root` (Default) and every `src/themes/*.css` block `:root[data-theme='id']`, resolves
each token to a colour (hex, `rgb()`, `var()`, `color-mix(in srgb, ...)`) and checks every theme. A failure lists the token and
the measured value.

| Check | Threshold |
|---|---|
| Every contract token is declared in `app.css :root`; a theme file declares the per-theme tokens | exact |
| A theme file does not declare a fixed token | exact |
| `--text` on panel, raised, hover | 7:1 |
| `--text-dim`, `--accent`, `--danger`, `--warn`, `--xp`, every `--log-*` on panel, raised, hover | 4.5:1 |
| `--text-off` on raised | 4.5:1 |
| `--edge`, `--ring` on panel and raised | 3:1 |
| `--ring`, `--here`, `--accent` pairwise | 12 ΔE00 |
| Every bar fill on `--bar-track` | 3:1 |
| `--bar-ink` on every fill, or on `--bar-halo` | 4.5:1 |
| `--sel-ink` on `--sel-bg` | 4.5:1 |
| Semantic colours (bar fills, danger, action) vs Default | hue drift at most 30° (OKLCH) |
| Bars drawn together (hp, stamina, mana, spirit, focus, action, xp), protan and deutan (Machado 2009, severity 1) | 8 ΔE00 per pair, with a listed exception per theme |
| Every `-ink` token on panel, raised, hover and `--sel-bg` | 4.5:1 |
| Every text read of a bar token found in the source (`color:` in a stylesheet, `<style>` block, inline style or script string; `fill` on a text rule or `<text>`) | reads the `-ink` token; 4.5:1 on panel, raised, hover |
| A bar token written as a string literal | listed in `BAR_LITERALS` with what it paints |
| Authored colours after the `ink()` remap on panel and raised | 4.5:1 |
| Authored colours after the selected-scope remap on `--sel-bg` | 4.5:1 |
| Authored colours of one family after the remap | pairwise at least 40% of Default's unlifted minimum; Refuse and Poor at least 10 ΔE00 |
| Every hex in `src/core/data` is in a known family | exact |
| Bar label draws `--bar-ink` with a `--bar-halo` outline; the focus ring exists; the disabled style is dashed, grayscale, `--text-off`, full opacity | exact |
| No colour literal in a `.svelte` file outside `tests/themeAllowlist.ts` | exact |
| No `font-weight`, `font-size`, `padding` or `border-width` in a state rule | exact |
| No `outline: none` without a listed replacement | exact |

Exceptions are explicit and pinned:

- **Colour vision.** `VISION_EXCEPTIONS` lists the pairs a theme may leave under 8, with the measured value (it must match within
  0.15) and the reason. Default: mana/spirit (protan 6.4, deutan 1.6), stamina/xp (protan 7.6), hp/stamina (deutan 7.1),
  hp/focus (deutan 7.99). Gothic: mana/spirit (protan 4.0, deutan 1.8), stamina/focus (deutan 5.64). Both keep their bar fills
  (the bars carry a text label and an icon), so the pairs stay. A new theme gets no exceptions.
- **Authored colours have no exception.** Default lifts them like every theme (§4). Its selected floor (0.58) compresses the
  colours inside a selected thing, so the family spacing check is 40% of Default's unlifted minimum, not half: at 0.58 the
  tightest family (martial positions) keeps 5.8 ΔE00 against a floor of 5.7.
- **Statuses** are not compared pairwise: Default gives five statuses nearly the same red, and a status carries an icon and a
  name.

## 8. Adding a theme

1. Add its id to `THEMES` and a name to `THEME_NAMES` in `theme.ts`. The Menu select lists `THEMES` in order. Change
   `DEFAULT_THEME` only to change what a browser with no pick gets.
2. Create `src/themes/<id>.css`. Put every token under `:root[data-theme='<id>']` as the first block, at the top level (a token
   inside `@media` is not read by the test). Declare every per-theme token (§2). Put shape rules (panel frame, buttons, bars,
   headings) in later blocks under the same selector.
3. Import the CSS in `main.ts`, after `app.css` and `themes/cues.css`.
4. Fonts: install `@fontsource/<name>` (OFL faces only) and import `@fontsource/<name>/latin-<weight>.css` for each weight and
   style used. Do not import `<weight>.css`: it pulls every script's slice (Shippori Mincho's pulls the Japanese ones).
   Gothic's two older font imports predate this rule; the game text has seven characters outside the latin slice (`ā`, `ō`).
   A face is downloaded only when a rule uses it.
5. Run `npx vitest run tests/themes.test.ts` and tune from the failure text. Common fixes: raise `--text-dim` for the hover
   surface, give `--danger` and the log colours 4.5:1 on `--bg-hover`, pick `--edge` at 3:1 on raised, raise `--ink-lmin` until
   the authored colours pass.
6. Check the busy screens, not just the opening: the city map, inventory, spellcrafting table, martial position planner,
   bestiary, Wuxin, skills. The developer panel's **Record every creature** and **Open locked systems** fill a test save fast.
   Take screenshots at 1440 and 1094 px; rect math does not show clipping (PITFALLS §8).
7. A light theme also lowers `--ink-lmax`, and reads `--art-ink` for nothing: the art tokens are fixed. Its `--sel-bg` may be a
   solid block only where the test's check on `--sel-bg` passes.

Run the dev server on a throwaway port (never 5173, which holds the real save).

## 9. The frame

One header row, then three columns: the left column (bars, the screen list from `NAV` in `src/ui/lib/nav.ts`, attribute chips,
Combat Stats; it scrolls), the main column (the open screen) and the log. The log has two states. The choice is a browser
preference like the theme: field `logOpen` of the localStorage key `ksgproto28-shell`, next to the seen screen ids, outside the
save.

- **Open:** the log is the right grid column, 320 px. Its header has a Fold button.
- **Folded:** the right column is removed and main takes its width. The newest log line shows as one row at the foot of main,
  cut with an ellipsis (`LogTicker.svelte`), with a Log button. The button opens the full log as a 360 px panel from the right
  edge, below the header, over main (`LogDrawer.svelte`, z-index 9, under every window). Escape, the Log button or a click
  outside closes it. Dock in the panel's header returns the log to its column.
- **Default:** with no stored choice the log is open from 1420 px of viewport width and folded below (`logOpenDefault` in
  `src/ui/lib/shell.ts`). 1420 is where an open log still leaves the Combat screen 760 px, so its two panels sit side by side. A
  stored choice beats the width. Floor 0 always shows the column and offers no Fold.
- **At 1100 px and below** the page scrolls, so the folded row is sticky to the foot of the window; the overlay panel starts 12 px
  under the header, or 12 px from the top once the header has scrolled away. An open log is a 220 px row under the page.
- The overlay ignores Escape and outside presses while a window is up (a Modal or the defeat, offline, prestige, dare or evolve
  window).
- **Header under 1180 px:** one row holds down to 1024 px because the rate chip drops its kills figure (the title has both), the
  clock chip shows only the hour (`shortClock`; the title has the whole text) and the Gothic title shrinks.

A screen whose columns depend on room sizes them by its own width, not the window's, so the log's state does not break it: the
Combat screen's Combat Style and Active Skills panels stack when the screen is under 760 px wide (container query on
`.loadout-box`, `CombatPanel.svelte`).

The log lines and the folded row share a one-character glyph gutter of fixed width (`1.3em`), so a kind's glyph never moves a
line. The nav list keeps a `1em` marker slot on every row for the same reason.

## 10. Open

- Pixel icons replace the emoji one group at a time, in both themes ([plans/pixel-icons.md](plans/pixel-icons.md)). Story 1
  (2026-10-22) did the sidebar: attributes, superattributes and the resource bars. Everything else still shows its emoji.
- Candidate themes (Registry, Enamel, Castle and seven more) are in [plans/display-themes.md](plans/display-themes.md) §4. None
  is built; they are written against this contract.
- Tip.svelte opens on hover. The click-not-hover rule applies to it; the change is not made here.
- Default's selected floor is high (0.58) because its `--sel-bg` is lighter than Gothic's. A darker Default `--sel-bg` (the
  accent at 8% over panel is #2a2b2a) would pass at 0.48 and keep more colour inside selected things, at the cost of a weaker
  selected fill on every Default button.

## 11. Theme catalogue

Castle, Survey and Sandstone are the light themes (built 2026-11-05, branch `themes-light`). Each is one file, `src/themes/<id>.css`,
registered in `theme.ts`, with its fonts imported in `main.ts` (`latin-<weight>.css` only). They are the first themes whose page
is lighter than their text.

**Light themes.** A light theme needs a few things a dark one does not:

- **Authored colours** are drawn darker, not lifted: `--ink-lmin` 0 and `--ink-lmax` about 0.52 (§4). `ink()` also scales chroma
  by `lmax`. Without that a bright colour darkened with its chroma kept falls outside the sRGB gamut and the browser clips it
  channel by channel: at a ceiling of 0.52 the orange and the red of the talent laps were 4.1 ΔE00 apart (20.3 unlifted) and
  are 11.9 with the scale. A light theme's panel has to be very light for the family spacing check to hold: lightness about
  0.88 or more, since the lightest authored colour must reach 4.5:1 on it at a ceiling of 0.52.
- **The -ink tokens** are declared by the theme as hex (§4): each bar fill darkened uniformly in OKLab until it holds 4.7:1 on
  panel, raised, hover and `--sel-bg`. The app.css derivation is the same remap and would also work, but a light theme picks its
  own values.
- **Bar wells.** Castle and Sandstone keep near-black wells with bright fills (each at least 3:1 on the well). `--xp` is the
  one fill that is also tested as text (4.5:1 on panel, raised and hover), so it has to sit in a narrow lightness window
  (about 0.115 to 0.125) and `--bg-hover` has to be light enough (lightness 0.73 or more) for the window to exist. Talent-lap
  fills inside a dark well use the dark-ground ink range (`.bar { --ink-lmin: 0.5; --ink-lmax: 1 }`). Survey has paper-white
  wells and mid to dark fills; its label is white with a black outline.
- **Painted art** stays dark. Text over it reads `--art-ink` (§5) and, for the colours that were `--text`, `--accent`, `--xp` and
  `--danger` inside the stage, the five `--stage-*` tokens (§2). Each theme draws a hard frame between the page and the art:
  the battle stage, the place banner and tiled maps get a border in the theme's ink colour (Castle: black timber, Survey: ink and
  a hairline, Sandstone: kohl and a bronze line).
- **Count chips** on item cells read `--badge-*` (§2): a dark chip with light text.
- **Scrim, lift and hatch** are ink-coloured (not black) and lighter: `--scrim` 45–55%, `--lift` 25–35%.
- **Specificity.** A component's scoped rule has the scope class on every compound selector, so a theme rule of the same length
  loses. A theme rule that has to beat one writes `:root:root[data-theme='<id>']` (one more pseudo-class).
- **Layout.** No rule here changes padding, border width, font size or font weight in a state. A theme sets the same border width
  on all rows (`.nav-entry` 4px) and changes only colour in the state.

Shared limits of the three: text dimmed by `opacity` in a component (the next floor band's name, an inactive position chip, the
count on a spare stack) is 2.8 to 3.8:1, against 3.1 to 4.4 in Gothic; a light page loses more contrast to the same opacity.
Decorative glyphs (unearned achievement stars, empty slot icons) are under 3:1 in every theme, Default and Gothic included. The
Skills screen's XP bar spills 4 to 11 px past its row at 1094 px in Castle and in Gothic (wide bold names); Survey and Sandstone
do not.

### Castle

The warring-states band (floors 21 to 30). White plaster, black timber, vermilion, a gold hairline.

- **Fonts.** Spectral 400, 400 italic and 600 for text (16px, lining and tabular figures); Shippori Mincho 700 (`latin-700.css`
  only: the full file pulls the Japanese slices) for h1 to h3 and `--font-caps`.
- **Key tokens.** `--bg` #dddbd3, panel #f5f3ee, raised #fcfbf8, hover #e0ded5, text #1a1917, dim #4d4b43, accent #7a4a00
  (bronze), danger #a8220e (vermilion), warn #6c5800, edge #6a675d, ring #2a3f8f (indigo), here #1a1917. Bars: hp #e0615d,
  stamina #7bda8e, mana #1a67d1, spirit #a87ed2, focus #e46d02, action #d3bc3c, xp #056e39 on a #0b0a08 well. `--ink-lmax` 0.52.
- **Decoration.** A black beam (inset shadow) across the top of every top-level panel; a black lintel and a gold hairline on the
  header; a black diamond before each h3; a shoji lattice on the map ground; a solid vermilion tag with white text for a fight
  with no way out and a bar plus text for a one-way road; a 3px timber frame on the stage and tiled maps.
- **Selection.** Selected buttons and the open nav row are black blocks with a gold foot. They do not read `--sel-bg`: a bar colour
  read as text has to hold 4.5:1 on `--sel-bg` (the test), which no colour does on both plaster and black. `--sel-bg` is a light
  plaster tint (the marked cells and the selected pin read it). Inside a black block the colours a child reads from a token are
  re-pointed in CSS (`--text-dim`, `--accent`, `--xp-ink`, `--danger`, `--warn`, `--buff`, `--border`) and the authored colours
  use the range 0.5 to 1. The test does not see this; the DOM contrast audit of every screen found no text under 4.5:1 in a block.
- **Numbers.** Text 13.03, dim 6.48, danger 5.37, ring 8.58, edge 5.10 (on panel, raised, hover; ring and edge on panel and
  raised). Worst colour-vision pair: protan hp/xp 9.85, deutan hp/focus 10.84 (the mock had 4.4). Authored colours after the remap:
  5.42 on panel and raised, 5.34 on `--sel-bg`; 5.9 on the black block's #1a1917.
- **Known limits.** `--xp` is the dimmest fill (3.11:1 on its well). The header is 52px tall at every width, one row.

### Survey

A drafting sheet. White paper, ink lines, hatch for what is locked, brick rust for the current and the selected, folder tabs.

- **Fonts.** IBM Plex Sans 400, 400 italic and 600 (14.5px); IBM Plex Sans Condensed 600 for h1 to h3 and the nav captions, in
  capitals with letter spacing.
- **Key tokens.** `--bg` #e8e5da, panel #f7f5ed, raised #fdfcf8, hover #e4e1d3, sunken and bar well #fffdf8, text #1b1c1a, dim
  #55564f, accent #8c3516 (brick), danger #b3261e, warn #825400, edge #5f5e56, ring #1d3f9e (blue pencil), here #1b1c1a,
  `--sel-bg` #fdf3e4. Bars: hp #e14b5a, stamina #218849, mana #28569b, spirit #8c61c2, focus #d6761a, action #7a660e, xp #015415;
  label ink white, outline black (black ink read poorly on the dark `--xp`, `--mana` and `--stamina` fills). `--ink-lmax` 0.52.
- **Decoration.** A double rule across the top of every panel and the header; an h3 underline rule; a short L at each inner corner
  of a top-level panel; bars with a tick at every tenth; folder tabs for `.tabs` and the map's region switch (the open tab joins
  the sheet and has a rust top bar); a survey grid on the map ground; diagonal ink hatch on locked rows.
- **Selection.** A tinted fill and a 4px rust foot (inset shadow); the open nav row has a rust left bar. Nothing changes size.
- **Numbers.** Text 13.04, dim 5.66, danger 4.98, ring 8.52, edge 5.97. Worst colour-vision pair: protan stamina/focus 9.07,
  deutan stamina/action 9.90. Authored colours: 5.50 on panel and raised, 5.47 on `--sel-bg`.
- **Rust and the Focus bar.** The mock's accent and Focus fill were 11.6 ΔE00 apart. Here the accent is a dark brick and the fill
  is a lighter orange: 26.9 ΔE00 (11.3 against `--focus-ink`, which is text). The accent is 9.0 ΔE00 from `--danger`; both
  `danger` states carry a mark and words.
- **Known limits.** The header is 54px tall. The corner marks sit 4px inside the border, next to the first caption of a panel with
  a small padding (the nav list).

### Sandstone

The desert band (floors 18 to 20). Limestone, kohl ink, bronze, a lapis focus ring, a stepped-pyramid frieze.

- **Fonts.** Alegreya Sans 400, 400 italic and 700 (17px, lining and tabular figures); Marcellus 400 for h1 to h3 and
  `--font-caps`, in capitals with letter spacing.
- **Key tokens.** `--bg` #e7dcc0, panel #f7f1df, raised #fcf9ef, hover #e9deba, text #231a0e, dim #52432a, accent #744a14
  (bronze), danger #9c200d, warn #6a5a00, edge #6e5c38, ring #1d4b9c (lapis), here #231a0e, `--sel-bg` #fbf5e1. Bars: hp #f6797c,
  stamina #8be796, mana #418cea, spirit #874fcb, focus #d86918, action #fad841, xp #00713e on a #120d06 well. `--ink-lmax` 0.52.
- **Decoration.** A frieze of stepped pyramids over a 2px lapis rule along the top of every top-level panel, the header and the
  map card (an inline SVG data URI in the CSS); a kohl frame and a bronze line around the stage and tiled maps; an inner rule on
  the map.
- **Selection.** A cartouche: a tinted fill, a bronze border and a rule inside a rule (two inset shadows); the open nav row has a
  4px bronze left bar and a bronze tint.
- **Numbers.** Text 12.75, dim 7.12, danger 5.95, ring 7.33, edge 5.72. Worst colour-vision pair: deutan mana/spirit 9.58, protan
  stamina/action 11.77 (the mock had 3.6). Authored colours: 5.32 on panel and raised, 5.51 on `--sel-bg`.
- **Known limits.** `--xp` is 4.55:1 on hover (the test needs 4.5); a change to `--bg-hover` or `--xp` has to keep the window
  described under Bar wells above.
