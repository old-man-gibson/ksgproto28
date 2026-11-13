# Display themes

*How the game's look is switched, how a theme is written, and what keeps it working as panels are added.*

Eleven themes exist:
- **Default:** the plain tokens in `app.css`.
- **Gothic:** dark brown stone, bone text, brass accent, Cinzel titles, EB Garamond body. Its colours have been Gothic+'s since 2026-11-04.
- Six dark themes: Registry, Enamel, Quayside, Signage, Cockpit, Linocut.
- Three light themes: Castle, Survey, Sandstone.

§11 describes each. Gothic is what a browser gets until its player picks one (user, 2026-11-03; kept 2026-11-04). The Menu window
holds the theme select. A theme is CSS only: it needs no save change and no art.

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
| `--here` | The you-are-here ring on the map. At least 12 ΔE00 from `--ring` and from `--accent`, and at least 3:1 on `--bg-sunken` (the map ground) and on `#0b0e12` (tile art and the stage). A light theme needs a mid-tone colour: lightness 0.11 to 0.18 holds 3:1 on both. |
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
| `--badge-bg`, `--badge-ink`, `--badge-dim` | A count or tag drawn on an item cell (EquipmentPanel, CollectionSection): the chip's fill, its text and its secondary text. Default aliases them to `--scrim`, `--text` and `--text-dim`. A light theme makes the chip dark and the text light. The text is at least 4.5:1 on the chip composited over `--bg-raised`. |
| `--accent-fill`, `--buff-fill`, `--warn-fill` | A colour drawn as a bar FILL inside the global `.bar` (well `--bar-track`): the quest, achievement, ability and bench bars (`--accent-fill`), the exploration bar (`--buff-fill`) and its find ticks (`--warn-fill`). `--accent`, `--buff` and `--warn` are text and border colours, and a light theme makes them dark, which vanishes on a dark well. Default aliases each to its text colour. At least 3:1 on `--bar-track`; the test finds every fill site in the source and checks the tokens it reads. |
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
- **Domain class names.** Do not name a class `bar`, `panel`, `dim` or `small` (app.css styles them globally). A theme that
  decorates the global `.bar` writes `.bar:has(> .fill)`: DefeatModal's share bars are a `.bar` with nothing in them, and a bare
  `.bar` rule drew the theme's outline and ticks on them.
- **Dim with a colour, not with `opacity`.** Text that must stay readable is dimmed with `--text-dim`. Opacity .55 to .65 took a
  position chip, a "still running" label and a tower band's name under 4.5:1 (2.8 to 4.4 on a light page). An opacity on a thing
  with no text, or on a state the text does not carry (a disabled cell), is fine.
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
| `--here` on `--bg-sunken` and on `#0b0e12` (tile art, the stage) | 3:1 |
| Every bar fill on `--bar-track` | 3:1 |
| `--accent-fill`, `--buff-fill`, `--warn-fill` on `--bar-track` | 3:1 |
| Every token a bar-fill site reads (an element with class `fill` and an inline `background`, or a rule ending in `.fill`), found in the source | 3:1 on `--bar-track` |
| The five `--stage-*` tokens on `#0b0e12` | 4.5:1 |
| `--badge-ink` and `--badge-dim` on `--badge-bg` composited over `--bg-raised` | 4.5:1 |
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
- **Header under 1180 px:** two rows since 2026-11-12 (it held one row down to 1024 px before). The job strip and the rate chip
  start the second row; the first row holds the transport buttons, the chips, the gold and the Menu. The rate chip drops its kills
  figure (the title has both), the clock chip shows only the hour (`shortClock`; the title has the whole text) and the Gothic title
  shrinks. The per-theme "one row at 1024 and 1094 px" measurements below were taken before the change. From 1180 px it is one row.
- **Under 700 px** the shell is the phone layout (PHONE.md): the dock is a `header` child of `.layout`, so every theme's
  `.layout > header` rule frames it, and its Pause and bonus chips use the header's `clock`, `pause` and `bonus` class names. The
  bottom row's entries use the screen list's `nav-list`, `nav-entry` and `nav-on`, so each theme's open-screen colours apply; the
  left border the themes draw is switched off there and the entry's top bar marks it. Checked in all eleven themes at 375 px: no
  horizontal scroll, dock height 125 to 132 px.

A screen whose columns depend on room sizes them by its own width, not the window's, so the log's state does not break it: the
Combat screen's Combat Style and Active Skills panels stack when the screen is under 760 px wide (container query on
`.loadout-box`, `CombatPanel.svelte`).

The log lines and the folded row share a one-character glyph gutter of fixed width (`1.3em`), so a kind's glyph never moves a
line. The nav list keeps a `1em` marker slot on every row for the same reason.

## 10. Open

- Pixel icons replace the emoji one group at a time, in both themes ([plans/pixel-icons.md](plans/pixel-icons.md)). Story 1
  (2026-10-22) did the sidebar: attributes, superattributes and the resource bars. Everything else still shows its emoji.
- Ledger (T8 in [plans/display-themes.md](plans/display-themes.md) §4: cream paper, iron-gall ink, bars as a rule plus a thin
  rail) is not built: the user left it unmarked on 2026-11-04. The other nine candidates are built (§11).
- Tip.svelte opens on hover. The click-not-hover rule applies to it; the change is not made here.
- Default's selected floor is high (0.58) because its `--sel-bg` is lighter than Gothic's. A darker Default `--sel-bg` (the
  accent at 8% over panel is #2a2b2a) would pass at 0.48 and keep more colour inside selected things, at the cost of a weaker
  selected fill on every Default button.

## 11. Theme catalogue

One subsection per built theme after the foundation: concept, fonts, key tokens, decorations, known limits. Numbers are
measured with the test's own functions on the token values in the theme file (`tests/themeColor.ts`). "Worst" is the
minimum over panel, raised and hover unless a surface is named.

A rule that sets a default (a border width, a font weight) is written `:where(:root[data-theme='id']) <selector>`. `:where()`
adds no specificity, so the rule ties with the global one it replaces (`button`, `.panel` in `app.css`) and a component's own
single-class rule (`.map-toggle { border: none }`) still wins. A rule that must beat a component rule keeps the plain
`:root[data-theme='id']` prefix.

**Measure with the web fonts blocked as well as loaded.** A player whose fonts fail to load sees the fallback: `Segoe UI`,
`Arial` or `Georgia` in place of the theme's face, and a layout that fits only the real face breaks. Before 2026-11-05 a
worktree's dev server showed the fallback too: its `node_modules` is a junction whose real path Vite's `server.fs.allow`
refused. `vite.config.ts` now allows the real paths of the linked folders. Header chips, the bonus chip and
the 184px floor column are sized to hold in both cases. The bonus chip reserves its widest text; the clock chip reserves its
widest hour string; the tests for both are "set every possible text and measure the header" (movement 0), not a sample of real
fights. A theme declares a narrow system face after its own condensed face where the fallback would be wider (Signage's
`--font-caps`).

Scope: a class name that two components use for different things (`affliction` in the sidebar and in the Fight Feed, `drop` on
a family list and on a notebook button) is matched through its parent class (`.afflictions .affliction`, `.fam-wrap .drop`),
never bare (PITFALLS §8).

### Registry

- **Concept:** the band 1 offices and the Chancery. Filing-cabinet grey-green, a manila accent, form headings, rubber stamps.
- **Fonts:** IBM Plex Sans (400, 400 italic, 600) for text; IBM Plex Mono (500, 600) for headings, the screen list's group
  captions, bar labels and warnings. Latin slices only.
- **Surfaces:** `--bg` `#151a18`, `--bg-panel` `#1c2320`, `--bg-raised` `#26302c`, `--bg-hover` `#323e39`, `--bg-sunken`
  `#0f1311`. `--accent` is manila `#d6bd7c`; `--ring` white; `--here` pink `#f08cc0`.
- **Measured:** text 8.7:1, dim 5.0:1, danger 4.7:1, worst log colour 4.7:1, edge 4.1:1, ring 13.6:1. Bar fills read as text
  (`-ink` tokens) are at least 4.9:1. Authored colours after the remap (`--ink-lmin` 0.5) are at least 4.6:1 on panel and 5.2:1
  on `--sel-bg`.
- **Bars:** the bar fills are moved from the first design so the seven bars drawn together reach 9.3 ΔE00 under protan and
  deutan (worst pairs: stamina/xp 9.3 protan, focus/xp 9.3 deutan, mana/spirit 10.5 deutan). Stamina is `#3baf75` (emerald),
  xp `#96c671`, action `#ecdd31`. No exceptions in `VISION_EXCEPTIONS`.
- **Selection:** `--sel-bg` is a dark manila tint, darker than raised (manila 11% over sunken), and `button.selected` adds a 4 px
  manila bar on its left edge. Solid manila with dark ink is used only where no authored colour can sit inside: the open entry
  of the screen list (kept under the pointer), the tab rows (`.tabs`, `.region-switch`) and a selected button that is not
  disabled, has no inline `style` on it and has no child whose inline style holds a colour (`oklch`, a hex, a custom
  property, `color`, `background`). Rarity and grade colours would fall under 4.5:1 on manila (plan ruling 3), so those keep
  the dark fill: a rarity chip and a forced stance carry the style on the button itself (the four buttons of that kind are
  CollectionSection.svelte:205, EquipmentPanel.svelte:1119 and :1431, CombatPanel.svelte:466). The Icon component's own
  style (width, font-size) is not a colour and exists only while the pixel art is missing, so it does not count. A selected
  and disabled button keeps the disabled look (dashed, no fill, `--text-off`).
- **Decorations (CSS only):** square corners; h2 and h3 in mono capitals with a rule to the right edge; a 4 px spine on the
  left of every top-level panel; a dotted tear-off line under the header; field boxes with a heavier bottom line; bars with
  quarter marks in the empty part; a graph-paper map ground; the outer you-are-here ring dashed; the pin card's warnings as
  boxed mono capitals in the warning's own colour.
- **Limits:**
  - A long h3 (for example the Skills screen's attribute heading) prints in full capitals.
  - The solid manila rules use `:has()`. A browser without it shows the dark selected fill and the manila bar.
  - Header chips (rate, clock, weather) are 12.5px. The clock chip's slot is `7.4em` (93 px, its text is 89 px) and the bonus
    chip's slot is `8.2em` (98.4 px); its widest text, "⏩ 2× 1h 10m", is 96.3 px and the component's `7.9em` is 94.8 px. Clock
    text cut at 1370 to 1470 px: 0 px (Default 0 px); at 1920 px (full date text, slot capped at 230 px): 91 px (Default 98 px).
  - The tower column (184 px) is 12.5px for rows and 11px for band captions. Rows are cut by 3, 14 and 5 px (Default 6, 17, 8).
  - A heading with a control on its right (`.fold-all`) keeps the control on the right edge: the trailing rule is `order: 0`
    and the control `order: 1`.
  - The enemy name plate is 11px (132 px wide): "Aberrant Forest Rat Lv 15" is 129 px (Default 130 px).

### Enamel

- **Concept:** vitreous-enamel signage. Bottle-green plates with a green rim, cream plates for the open screen, a hazard stripe
  beside warnings, rivets in the corners.
- **Font:** Barlow Semi Condensed (400, 400 italic, 600, 700), latin slice. Headings are 700 capitals; buttons are 600.
- **Surfaces:** `--bg` `#07120d`, `--bg-panel` `#0d1f17`, `--bg-raised` `#153427`, `--bg-hover` `#1c4434`, `--bg-sunken`
  `#050d09`. `--edge` `#6aa98c` is the rim of panels and buttons. `--accent` is signal amber `#f4b52a`. Theme-local tokens:
  `--rim` `#e4dcc2` (the cream rim), `--plate` `#e6dec4` and `--plate-ink` `#07120d` (a cream plate and its ink),
  `--stripe-a`, `--stripe-b` (the hazard stripe).
- **Focus and here:** `--ring` is cream-white `#fffdf2`, `--here` is pink `#ff8fb8`, `--accent` is amber. The first design used
  the accent as the ring (plan ruling 7); the three are now 28.6 ΔE00 or more apart.
- **Measured:** text 9.2:1, dim 5.7:1, danger 4.7:1, worst log colour 4.7:1, edge 4.9:1, ring 13.3:1, disabled 5.3:1. Bar fills
  read as text (`-ink` tokens) are at least 5.1:1. Authored colours after the remap (`--ink-lmin` 0.5) are at least 4.6:1 on panel
  and 5.2:1 on `--sel-bg`.
- **Bars:** the first design had mana/spirit 2.5 ΔE00 under deutan. Mana is `#6eaaed` and spirit `#9078ff`; the seven bars drawn
  together reach 9.3 ΔE00 under protan (action/xp) and 9.35 under deutan (hp/focus, hp/stamina); mana/spirit is 9.4. No
  exceptions in `VISION_EXCEPTIONS`.
- **Selection:** `--sel-bg` is dark (`#0a2a1d`), so a marked inventory cell is a dark cell with the component's amber border,
  and a wall of marked cells does not glare. A cream plate with dark ink is used only where no authored colour can sit inside:
  the open entry of the screen list (kept under the pointer), the tab rows, the stop underfoot in the tower list, the pin
  card's title strip and a selected button that is not disabled, has no inline `style` on it and has no child whose inline
  style holds a colour (the Icon component's width and font-size style does not count). Every other selected button (a
  rarity chip, a forced stance) gets the dark fill and a cream inset rim. A selected and disabled button keeps the disabled
  look. The focus ring on the cream stop row is the plate's ink (14:1), because the component draws that ring inside the row.
  At most four cream plates show together on the Location screen at 1440 px.
- **Decorations (CSS only):** 2px rims on panels, buttons and fields (a button with `border: 0` stays borderless, because only
  `border-width` is set); a rivet in each corner of a top-level panel and of the header (a cream head in a dark ring); a cream
  header rim, amber while the world is paused; a cream-rimmed pin card with a cream title strip; a red and cream stripe at the
  left of each warning line; dotted underline on clickable map text.
- **Limits:**
  - The cream rules use `:has()`. A browser without it shows the dark selected fill and the cream rim.
  - The header is 56 px tall (Default 52 px) because of the 2px rims; it does not change with state.
  - At 1024 px the strip is wide enough to show its bar, so the job name slot is 97 px (Default 169 px, which hides the bar). The
    name ends in an ellipsis when longer.
  - Rivets are drawn at 7 px from each corner of a top-level panel, so a panel padded under 8 px would have them over its
    content. The Menu window (padding 0, header padded 10 px) was checked; no other zero-padding panel was.

### Quayside

- **Concept:** the harbor band (floors 11 to 14). Teal-black planking, sailcloth text, a rope stripe along the top of each panel,
  the map framed as a chart.
- **Font:** Libre Caslon Text (400, 400 italic, 700), latin slice. Caslon is the widest face of the set, so the header gives up
  size: the header is 14px, its chips (rate, clock, weather) 12px, the title 15px with 0.08em tracking.
- **Surfaces:** `--bg` `#0b1316`, `--bg-panel` `#111c20`, `--bg-raised` `#192a2f`, `--bg-hover` `#24383e`, `--bg-sunken`
  `#070d0f`. `--text` is sailcloth `#e8e2d0`.
- **Accent:** lantern amber `#f0a24d`, hue about 65 in OKLCH. The first design used brass `#e2b04a` (hue about 85), which sits
  next to Gothic's `#c9a45c`. Brass stays in the rope stripe (`--rope-a` `#a8946a`, `--rope-b` `#4d432c`, theme-local).
  `--ring` is sailcloth `#f6f1e3`, `--here` pink `#ff9ccf`; the three are 26.6 ΔE00 or more apart.
- **Measured:** text 9.5:1, dim 5.7:1, danger 4.8:1, worst log colour 4.8:1, edge 4.4:1, ring 13.2:1, disabled 5.4:1. Bar fills
  read as text (`-ink` tokens) are at least 5.6:1. Authored colours after the remap (`--ink-lmin` 0.5) are at least 5.0:1 on
  panel and 5.7:1 on `--sel-bg`.
- **Bars:** the seven bars drawn together reach 9.35 ΔE00 under deutan (stamina/xp) and 9.7 under protan (focus/xp). Stamina is
  `#69e98c` and xp `#89b66d`; they are told apart by lightness and chroma. No exceptions in `VISION_EXCEPTIONS`.
- **Selection:** `--sel-bg` is dark (amber 11% over sunken). A selected button gets an amber bar along its top edge (a sign hung
  from its hooks); the open screen in the list gets a bar on the left. No solid light plate: Caslon rows carry rarity and
  grade colours that need the dark fill.
- **Decorations (CSS only):** a rope stripe (a 135 degree repeating gradient, 5 px) on the top edge of every top-level panel,
  the header and the pin card; h3 with a hairline and a short amber tab; a double rule under the screen list captions; bars
  marked in quarters like a gauge; a neatline inside the map frame; a double rule round the pin card; a bar on the left of
  each warning in the warning's own colour.
- **Limits:**
  - Header budgets, measured against Default at 1024, 1094, 1180 and 1440 px: the job name slot is 159, 141, 135 and 224 px
    (Default 169, 151, 153 and 240). The clock chip shows its whole hour at every width; its slot is `7.6em` of 12px (the
    component's `6.5em` is too narrow for Caslon). The bonus chip's slot is `8.4em` (100.8 px); its widest text, "⏩ 2× 1h 10m",
    is 98.6 px and the component's `7.9em` is 94.8 px. Clock text cut at 1370 to 1470 px: 0 px; at 1920 px: 98 px (Default 98 px).
  - A skill row (`.skill-block .row`) is 12px with a 5px gap; at 13.5px and the 7px gap its bar overran the row. After the
    change no row runs past its content box at 1440 px (log open) or 1094 px.
  - The tower column (184 px): rows are 12px with -0.02em tracking and a narrower number column; band captions are italic, mixed
    case, 12px, no tracking. Rows are cut by 5, 9 and 2 px (Default 6, 17, 8) and no band caption is cut.
  - The enemy name plate is 10.5px regular weight (132 px wide): "Aberrant Forest Rat Lv 15" is 128 px (Default 130 px).
    At 11.5px and bold it is 151 px.
  - The rope is a background image on the panel, so a panel with its own `background-image` would lose it. None was found on
    the 12 screens of the screen list at 1440 px (Default theme).

### Signage

- **Concept:** wayfinding signs. Black ground, white type, signal-yellow plates, hazard stripes. A state is a fill, a stripe
  or a glyph; there is no glow and no gradient other than the stripes and the bar ticks.
- **Fonts:** Barlow 400 and 600 (text), Barlow Condensed 600 and 700 (headings, captions, bar labels, tower rows). Imports:
  `@fontsource/barlow/latin-{400,600}.css`, `@fontsource/barlow-condensed/latin-{600,700}.css`. Root size 16px, tabular figures.
  `--font-caps` is `'Barlow Condensed', 'Arial Narrow', 'Barlow', sans-serif`: the narrow system face keeps the tower rows and
  captions inside their budgets when the web face is missing. Radius 3px on everything except the round parts
  (`.shadow .ring .aura .dot .pip`).
- **Tokens:**
  - Surfaces: bg `#0b0b0b`, panel `#141414`, raised `#1f1f1f`, hover `#333333`, sunken `#000000`; border `#8a8a8a`, frame `#3a3a3a`.
  - Ink: text `#ffffff` (12.6:1 worst), dim `#bcbcbc` (6.65), accent `#ffd400` (8.83), danger `#ff7a6c` (4.97 on hover),
    warn `#ffa726` (6.50). Log colours: worst `--log-skill` 4.95.
  - Cues: edge `#e6e6e6` (13.2:1 worst of panel and raised), ring `#ffffff` 3px (16.5), here `#ff5cc4`, text-off `#8d8d8d` (4.97 on raised).
  - Selected: `--sel-bg` `#000000`, `--sel-ink` `#ffffff` (21:1). Authored colours: `--ink-lmin` 0.43 (worst 4.71 on panel and
    raised, Refuse and Poor 15.2 ΔE00 apart), `--sel-ink-lmin` 0.36 (worst 4.96 on `--sel-bg`). Bar fills read as text through the
    `-ink` tokens (the fill remapped with `--ink-lmin`): worst `--spirit-ink` 4.79 on panel, raised, hover and `--sel-bg`.
  - Bars: saturated mid-dark fills, white label with a black halo. Worst colour-vision pair: protan hp/stamina 9.40; deutan
    focus/action 12.50. No `VISION_EXCEPTIONS` entry.
- **Decorations (CSS only):**
  - A solid `--accent` plate with black ink marks the open screen (nav entry), the tower floor underfoot (`.ts-row.here`), the
    newest station (`.station.back`) and a map card's head. Nothing else is filled yellow. TowerSection draws its focus ring
    inside the row, so the ring on the floor plate is black (14.7:1 on `#ffd400`; white was 1.43:1). The other plates are
    rung from outside, on the panel (18.4:1).
  - A selected control (`button.selected`) is a black plate with a yellow border and a 4px yellow bar under the label.
  - Header: 2px white edge, 4px yellow bottom rule. While the game is paused a yellow and black hazard stripe covers the rule
    (`.layout.paused > header::after`).
  - `h2` carries a 4px yellow rule; `h3` is a raised label strip with a 6px white block at its left end; the nav captions use the
    same strip.
  - Bars: 1px white edge and gauge ticks at 25, 50 and 75% (`.bar::after`, drawn above the fill, no pointer events).
  - Hazard stripes (`--stripe-warn`, `--stripe-danger`, 135 degrees, 6px bands) mark a one-way line and a no-retreat line in a
    map card, and the left end of an affliction chip. They exist only while such a line is shown.
  - Locked rows: white 24% hatch (`--hatch-lock`). Floating cards have no shadow (`--lift` is transparent); a 2px yellow border
    separates them from what is under them.
- **Header budget:** one row (58px) at 1024, 1094, 1180, 1370, 1440 and 1920 px, no overflow. Job strip width at 1024, 1094, 1180,
  1440 and 1920 px: 222, 292, 378, 478 and 783 with the web fonts, 207, 277, 363, 462 and 750 without (Default 195, 265, 359, 461,
  749). The 2px button edge and the face cost room, so: transport buttons take 6px side padding, the header's column gap is
  8px, the title is 17px. The bonus chip (`.clock .bonus`) reserves 96px: its widest text, "⏩ 2× 1h 10m" (digits are
  tabular), measures 87.2px with Barlow and 95.0px in the fallback. The clock chip (`.timesense`) keeps 96px at every width.
  Measured movement of the header over every bonus text (0s to 8h 59m) and every clock hour: 0.00px, both font modes. Clock chip
  whole at every measured width, with the widest bonus text in place (Default cuts 4px at 1180). At 1024 the strip is under
  210px with the web fonts, so its bar is hidden, as in Default.
- **Known limits:**
  - Selected controls are black, not yellow. A solid yellow `--sel-bg` cannot pass the authored-colour check: the authored
    colours inside it would have to stay under OKLCH lightness 0.5, which leaves quality tiers 8 ΔE00 apart against a floor of
    12 (best margin -4.0 on `#ffd400`, -0.6 on white; measured with `tests/themeColor.ts`).
  - Brightest of the dark themes: white text on near-black. The yellow plates are limited to the four places above.
  - Barlow is the Latin slice only; `ā` and `ō` fall back to the system face.
  - `.map-card .warn` and `.afflictions .affliction` rules name component classes; a renamed class loses its stripe and keeps working.
  - Tower floor names: with the web fonts none is cut; without them "4 The Greenwood" is cut by 4px (Default 6), "1 The Flooded
    Offices" by 13 (Default 17), "The Foot of the Ascent" by 1 (Default 8), and no band caption is cut.

### Cockpit

- **Concept:** a flight-deck panel. Mid-dark grey slabs on a darker ground, white engraved legends, numbers and the log in
  recessed near-black display windows, bars drawn as gauge tapes, amber for the current item. A filled tile is lit only for an
  exception (a one-way line, a no-retreat line, an affliction, a frozen world). Flat surfaces and hard 1px lines: no gradient,
  no blur, no glow; radius 0. No rivets or screws.
- **Font:** B612 400 and 700 (`@fontsource/b612/latin-{400,700}.css`). Root size 13.5px. B612 digits are tabular without a
  feature flag (checked: ten digits measure the same), so the header's clock chip holds one width for all 24 hours.
- **Tokens:**
  - Surfaces: bg `#171918` (the ground between slabs), panel `#292d2b`, raised `#323734`, hover `#3a3f3c`, sunken `#0e100f`
    (display windows); border `#565d58`, frame `#1b1e1c` (the groove around a slab or window).
  - Ink: text `#f2f4f0` (9.70:1 worst), dim `#bdc4be` (6.03), accent amber `#f2b84b` (6.00), danger `#ff9b8f` (5.28),
    warn `#ffd24d` (7.45). Log colours: worst `--log-skill` 5.31.
  - Cues: edge `#a3aca6` (5.20:1 worst of panel and raised), ring `#ffffff` 2px (12.1), here `#e879b9`, text-off `#a3aca6` (5.20).
  - Selected: `--sel-bg` `#1c1709` (a dark amber well, darker than the slab), `--sel-ink` `#f2f4f0` (16.1). Authored colours:
    `--ink-lmin` 0.56 (worst 4.75), `--sel-ink-lmin` 0.5 (worst 6.04 on `--sel-bg`); Refuse and Poor 10.9 ΔE00 apart (floor 10).
    Worst bar `-ink` token: `--hp-ink` 4.69 (panel, raised, hover and `--sel-bg`). The lighter slab is why `--ink-lmin` is
    0.56 here against 0.43 to 0.44 on the near-black themes; the family spacing margin is 1 ΔE00 on quality tiers and 0.3 on
    martial positions.
  - Bars: hp `#b8322e`, stamina `#86ab72`, mana `#5aa0ee`, spirit `#7d63b5`, focus `#da6600`, action `#e8cf4a`, xp `#86dcb8`. Chosen by
    lightness steps so the confusable hues (red, green, orange, yellow) stay apart for protan and deutan viewers: worst pair
    protan stamina/xp 14.45, deutan mana/spirit 14.39. No `VISION_EXCEPTIONS` entry.
- **Decorations (CSS only):**
  - Slabs: every `.panel` and the header have a 1px dark groove (`--frame`) and a 1px light edge along the top
    (`inset 0 1px 0 rgb(255 255 255 / 8%)`).
  - Display windows: `--bg-sunken` with a 2px dark lip along the top and a 1px light lip along the bottom. They hold the
    attribute readouts (`.attr-chip`), the gold chip, the log entries (`.log .entries`) and every bar.
  - Legends: `h1` to `h3` and the nav captions are white spaced capitals with a 1px dark cast line under the letters
    (`text-shadow: 0 1px 0`, no blur). `h3` trails a groove (a dark line over a light line). `h2` is 15px.
  - Keys: a button has a darker lower edge (`inset 0 -2px 0`); selected replaces it with a 3px amber bar on the amber well;
    disabled has none. A selected tab is a 3px amber rule under flat text.
  - Gauge tapes: each bar has a 1px frame, a tick every tenth and a long tick at half, in 40 to 55% white
    (`.bar::after`, above the fill, no pointer events).
  - Annunciator tiles, filled, for exceptions only: a one-way line (`--warn`) and a no-retreat line (`--danger`) in a map card,
    an affliction chip (`.afflictions .affliction`, the sidebar's only), and the Pause button while the world is frozen
    (`.clock .pause.on`, amber). The nav mark "ready" is a boxed amber caption; "new" is plain text so a column of them stays quiet.
  - The open screen is amber text on `--sel-bg` with a 3px amber bar at the left (`.nav-on`), as is the floor underfoot.
  - Map card: grey frame with a 3px amber top bar. Locked rows: white 13% hatch. No shadow under floating cards (`--lift` is
    transparent).
- **Header budget:** one row (52 to 53px) at 1024, 1094, 1180, 1370, 1440 and 1920 px, no overflow. Job strip width at 1024, 1094,
  1180, 1440 and 1920 px: 194, 264, 350, 463 and 735 with B612, 221, 291, 377, 477 and 782 without (Default 195, 265, 359, 461, 749).
  The strip is 12px narrower than Default at 1180 and keeps the 330px its detail text needs. B612 is wide, so the transport
  buttons use 11px and 6px side padding, the column gap is 8px, the title 12px, and the gold chip's window costs 14px. The bonus chip
  reserves 96px (widest text 94.6px with B612, 85.1px in the fallback). The clock chip keeps 104px at every width (B612's
  "about 00:00" is 100px; the 6.5em slot Default uses cut it by 15px at 1180 and by 2px at 1370). Measured movement of the header
  over every bonus text and every clock hour: 0.00px, both font modes. The clock chip is whole at every measured width.
- **Known limits:**
  - B612 is wide. Tower floor names use 11.5px and a tighter letter-spacing to fit the 184px column; "The Flooded Offices" is still
    cut by 8px with the web face (0 without it), as it is in Default.
  - The slab is lighter than the other dark themes, so the authored colours are lifted more (`--ink-lmin` 0.56) and a rarity
    colour sits closer to its neighbours; the spacing check passes with a margin of 0.3 to 1 ΔE00.
  - The unlit tiles are not drawn: a screen with no exception shows no tile at all.
  - B612 is the Latin slice only; `ā` and `ō` fall back to the system face.

### Linocut

- **Concept:** a relief print. A black key block, bone ink and one spot colour, saffron. Hatching carries the tone: disabled
  and locked things are hatched, the unfilled part of a bar is hatched. A selected control and a floating card are printed with
  a hard offset block of saffron behind them. Neutrals are pure grey; there is no brown.
- **Fonts:** Bitter 400, 600 and 700 (text), Alfa Slab One 400 (h1 to h3 only). Imports:
  `@fontsource/bitter/latin-{400,600,700}.css`, `@fontsource/alfa-slab-one/latin-400.css`. Root size 14.5px, `lining-nums
  tabular-nums`. Bitter's ten digits measure the same width (checked): the chip text "🕰️ about HH:00" is 93.44px for all 24
  hours, against a 92.3px slot in Default's rule. The fallback face (Georgia) has proportional digits: the same text runs
  88.1 to 92.9px. So no width here relies on the digits being tabular: the clock chip keeps 96px and the bonus chip 104px. A control inside a title (Expand all,
  Collapse all) is reset to Bitter 12px. Radius 0.
- **Tokens:**
  - Surfaces: bg `#0a0a0a`, panel `#121212`, raised `#1c1c1c`, hover `#292929`, sunken `#050505`; border `#8a877d`, frame (bone) `#ece7d8`.
  - Ink: text `#ece7d8` (11.8:1 worst), dim `#aba79a` (6.04), accent saffron `#f2a20c` (6.89), danger `#ff7b6b` (5.75),
    warn `#f7c948` (9.29). Log colours: worst `--log-plain` 6.04.
  - Cues: edge `#8a877d` (4.74:1 worst of panel and raised), ring `#fffaf0` 3px dashed (16.4), here `#ee7fc0`, text-off `#8c897f` (4.87).
  - Selected: `--sel-bg` `#000000`, `--sel-ink` `#ece7d8` (17.0). Authored colours: `--ink-lmin` 0.43 (worst 4.87), `--sel-ink-lmin` 0.36
    (worst 4.96 on `--sel-bg`); Refuse and Poor 15.2 ΔE00 apart. Worst bar `-ink` token: `--hp-ink` 5.89 (panel, raised, hover and
    `--sel-bg`).
  - Bars: hp `#e5483a`, stamina `#4fae6a`, mana `#3b82f0`, spirit `#c8a4f0`, focus `#f08c2e`, action `#f2d024`, xp `#86f0c4`. Worst
    colour-vision pair: protan stamina/focus 9.34; deutan hp/stamina 10.10. No `VISION_EXCEPTIONS` entry. The bar label is bone
    `#fffaf0` with a black halo.
- **Decorations (CSS only):**
  - A block: 2px grey outline and a 5px bone bar across the top, on every `.panel` and the header.
  - The open screen is reversed type: a bone plate with black ink and a 6px saffron block at its left edge (`.nav-on`); the
    tower floor underfoot is the same plate (`.ts-row.here`).
  - A selected control has a bone edge and a 3px saffron block offset down and right (`box-shadow: 3px 3px 0`). The newest station
    has the same block in saffron on a saffron edge.
  - Floating cards (`.map-card .tip-pop .log-drawer .tutorial .fam-wrap .drop`, `.overlay > .window.panel`) have a 6px saffron
    offset block (`--block`). `--lift` is transparent, so no blur shadow is drawn. CombatPanel's notebook button is also
    classed `drop`, so the family list is matched through `.fam-wrap`. The selected pin keeps MapPlan's 3.5px outline
    (`.plan .node:not(.selected) .dot` sets the others to 2.5px). The floor underfoot draws its focus ring inside the row, so the
    ring on the bone plate is black (17.0:1; bone on bone was 1.19:1).
  - Hatch (`--hatch`, `--hatch-lock`): 135 degrees, 1px bone lines at 14 to 16% every 5px. It fills a disabled button (with the
    dashed edge and the grayscale from `cues.css`), a locked row, the next band's name and the empty part of every bar. A
    no-retreat line in a map card and a sidebar affliction chip (`.afflictions .affliction`) carry a red hatch.
  - A one-way line has a 5px `--warn` bar at its left; a no-retreat line the same in `--danger`.
- **Header budget:** one row (59px) at 1024, 1094, 1180, 1370, 1440 and 1920 px, no overflow. Job strip width at 1024, 1094, 1180,
  1440 and 1920 px: 195, 265, 351, 461 and 740 with the web fonts, 179, 249, 335, 461 and 740 without (Default 195, 265, 359, 461,
  749). Alfa Slab One and Bitter are wide, so: transport buttons take 6px side padding, the header's column gap is 8px, the title
  is 15px. The bonus chip reserves 104px (widest text 94.5px with Bitter, 102.3px in the fallback, where "8h 40m" is the widest).
  The clock chip keeps 96px at every width. Measured movement of the header over every bonus text and every clock hour: 0.00px,
  both font modes. The clock chip is whole at every measured width. Without the web fonts the strip has 5px over the 330px the
  detail text needs at 1180.
- **Known limits:**
  - Selected controls are black with a bone edge, not a bone plate: a bone `--sel-bg` cannot pass the authored-colour check (best
    margin -0.6 on white).
  - The palette shares bone and a warm accent with Gothic. What separates them: neutral black surfaces, saffron at higher chroma
    than brass, slab type, hatching and offset blocks.
  - Tower floor names use 11.5px at weight 400 to fit the 184px column; "The Flooded Offices" is cut by 4px with the web fonts (0
    without them), as in Default (17px).
  - The hatch under a bar label lowers the label's local contrast; the 1px black halo carries it (bone on black halo 20:1).
  - Bitter and Alfa Slab One are the Latin slice only; `ā` and `ō` fall back to the system face.

### Light themes

Castle, Survey and Sandstone are the light themes (built 2026-11-04 to 2026-11-05, branch `themes-light`). Each is one file, `src/themes/<id>.css`,
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
  fills inside a dark well use the dark-ground ink range (`.bar:has(> .fill) { --ink-lmin: 0.5; --ink-lmax: 1 }`). The Skills
  screen's XP bar reads `--bar-track` too (it was `--bg-sunken`, light here, where the skill fill was 2.3:1 and the talent laps
  1.1 to 1.5:1). Survey has paper-white wells and mid to dark fills; its label is white with a black outline.
- **Fills read their own tokens.** `--accent`, `--buff` and `--warn` are text colours, so a dark well loses them (2.5 to 2.9:1).
  A fill site reads `--accent-fill`, `--buff-fill` or `--warn-fill` (§2). On a dark well they are a mid amber (4.1 to 4.2:1; also
  3.4:1 on the page, where the bench's own bar sits), a teal and a bright amber. On Survey's white wells they are the text colours.
- **The you-are-here ring** (`--here`) is a mid-tone colour (Castle raspberry, Survey magenta, Sandstone madder), 3.9 to 5.9:1 on
  the map ground and 3.2 to 3.3:1 on dark tile art. It had been the text colour, which is 1.1:1 on art.
- **Tiled maps** get a dark mat (`#0b0e12`) behind the picture: the strip above and below it holds labels, which are white.
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
- **Header slots.** A longer title leaves the clock chip less room: at 1370px the title is 37 to 55px wider than Default's and the
  component's 6.5em (84.5px) cut "about 00:00" (Default's slot is 95.7px there). Each light theme sets `.timesense` to 7.4em
  (96.2px). The bonus chip's slot is 8em (96px) in the component; Survey's widest text is 96.27px ("⏩ 2× 1h 10m", Plex Sans) and
  Castle's 96.44px in its fallback face (Georgia), so both set 8.1em. Measured over every text from 0s to 8h 59m and every hour,
  with the web fonts loaded and blocked: the header's children move 0px.
- **A selected, disabled button** keeps the plain disabled look (dashed, grey, no fill): a theme whose selected fill is solid
  scopes it with `:not(:disabled)` and leaves the button to cues.css. Castle did not at first, and the dashed edge was black on
  black.
- **The picked row** of the tower section is a focusable button; a theme draws its cue with an inset `box-shadow`, never `outline`,
  which would replace the global focus ring.

Shared limits of the three: the count on a spare stack (a cell dimmed to 0.42 by its component) is 2.9 to 3.0:1. Decorative
glyphs (unearned achievement stars, empty slot icons) are under 3:1 in every theme, Default and Gothic included. The Skills
screen's XP bar spills 4 to 11 px past its row at 1094 px in Castle and in Gothic (wide bold names); Survey and Sandstone do not.

### Castle

The warring-states band (floors 21 to 30). White plaster, black timber, vermilion, a gold hairline.

- **Fonts.** Spectral 400, 400 italic and 600 for text (16px, lining and tabular figures); Shippori Mincho 700 (`latin-700.css`
  only: the full file pulls the Japanese slices) for h1 to h3 and `--font-caps`.
- **Key tokens.** `--bg` #dddbd3, panel #f5f3ee, raised #fcfbf8, hover #e0ded5, text #1a1917, dim #4d4b43, accent #7a4a00
  (bronze), danger #a8220e (vermilion), warn #6c5800, edge #6a675d, ring #2a3f8f (indigo), here #c2185b (raspberry). Bars: hp
  #e0615d, stamina #7bda8e, mana #1a67d1, spirit #a87ed2, focus #e46d02, action #d3bc3c, xp #056e39 on a #0b0a08 well; fills
  `--accent-fill` #9c6a14, `--buff-fill` #1f9e86, `--warn-fill` #e3c457. `--ink-lmax` 0.52.
- **Decoration.** A black beam (inset shadow) across the top of every top-level panel; a black lintel and a gold hairline on the
  header; a black diamond before each h3; a shoji lattice on the map ground; a solid vermilion tag with white text for a fight
  with no way out and a bar plus text for a one-way road; a 3px timber frame on the stage and tiled maps.
- **Selection.** Selected buttons and the open nav row are black blocks with a gold foot. They do not read `--sel-bg`: a bar colour
  read as text has to hold 4.5:1 on `--sel-bg` (the test), which no colour does on both plaster and black. `--sel-bg` is a light
  plaster tint (the marked cells and the selected pin read it). Inside a black block every colour token a child can read as text
  or as an interactive edge is re-pointed in CSS to a value that holds on #1a1917 and on the hover black #35322d: `--text`,
  `--text-dim`, `--text-off`, `--edge`, `--accent`, `--danger`, `--warn`, `--buff`, the eleven `-ink` tokens and the ten `--log-*`
  tokens (4.7:1 or more on both; the edge 3.5:1); `--border` and `--frame` are decorative rules (2.5:1). The authored colours use
  the range 0.5 to 1. The test does not see this. A page script read every colour token declared on `:root` as a child of a
  selected button and of the open nav row: what is left under 4.5:1 is a surface, a halo, a scrim, a map tint or a bar fill
  (`--sel-ink`, `--scrim*`, `--timber`, `--bar-track`, `--district-*`, `--mat-*`, `--road`, `--night`, `--ring`, `--here`,
  `--xp`, `--mana`, `--manaburn`, `--accent-fill`), none of which a component draws as text. The bar fills cannot be text:
  the test makes every text read a `-ink` token. A selected, disabled button is not a block (`:not(:disabled)`).
- **Numbers.** Text 13.03, dim 6.48, danger 5.37, ring 8.58, edge 5.10 (on panel, raised, hover; ring and edge on panel and
  raised). Worst colour-vision pair: protan hp/xp 9.85, deutan hp/focus 10.84 (the mock had 4.4). Authored colours after the remap:
  5.42 on panel and raised, 5.34 on `--sel-bg`; 5.9 on the black block's #1a1917.
- **Known limits.** `--xp` is the dimmest fill (3.11:1 on its well). The header is 52px tall at every width, one row.

### Survey

A drafting sheet. White paper, ink lines, hatch for what is locked, brick rust for the current and the selected, folder tabs.

- **Fonts.** IBM Plex Sans 400, 400 italic and 600 (14.5px); IBM Plex Sans Condensed 600 for h1 to h3 and the nav captions, in
  capitals with letter spacing.
- **Key tokens.** `--bg` #e8e5da, panel #f7f5ed, raised #fdfcf8, hover #e4e1d3, sunken and bar well #fffdf8, text #1b1c1a, dim
  #55564f, accent #8c3516 (brick), danger #b3261e, warn #825400, edge #5f5e56, ring #1d3f9e (blue pencil), here #b3208a
  (magenta pencil), `--sel-bg` #fdf3e4. Bars: hp #e14b5a, stamina #218849, mana #28569b, spirit #8c61c2, focus #d6761a, action #7a660e, xp #015415;
  label ink white, outline black (black ink read poorly on the dark `--xp`, `--mana` and `--stamina` fills). `--ink-lmax` 0.52.
- **Decoration.** A double rule across the top of every panel and the header; an h3 underline rule; a short L at each inner corner
  of a top-level panel; bars with a tick at every tenth; folder tabs for `.tabs` and the map's region switch (the open tab joins
  the sheet and has a rust top bar); a survey grid on the map ground; diagonal ink hatch on locked rows.
- **Selection.** A tinted fill and a 4px rust foot (inset shadow); the open nav row has a rust left bar. Nothing changes size.
  The picked stop of the tower section is a raised fill and an inset ink line (box-shadow, not outline: the row's keyboard ring
  stays the global blue outline).
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
  (bronze), danger #9c200d, warn #6a5a00, edge #6e5c38, ring #1d4b9c (lapis), here #b02a82 (madder), `--sel-bg` #fbf5e1. Bars: hp
  #f6797c, stamina #8be796, mana #418cea, spirit #874fcb, focus #d86918, action #fad841, xp #00713e on a #120d06 well; fills
  `--accent-fill` #9a6a22, `--buff-fill` #1f9e86, `--warn-fill` #e3c457. `--ink-lmax` 0.52.
- **Decoration.** A frieze of stepped pyramids over a 2px lapis rule along the top of every top-level panel, the header and the
  map card (an inline SVG data URI in the CSS); a kohl frame and a bronze line around the stage and tiled maps; an inner rule on
  the map.
- **Selection.** A cartouche: a tinted fill, a bronze border and a rule inside a rule (two inset shadows); the open nav row has a
  4px bronze left bar and a bronze tint.
- **Numbers.** Text 12.75, dim 7.12, danger 5.95, ring 7.33, edge 5.72. Worst colour-vision pair: deutan mana/spirit 9.58, protan
  stamina/action 11.77 (the mock had 3.6). Authored colours: 5.32 on panel and raised, 5.51 on `--sel-bg`.
- **Known limits.** `--xp` is 4.55:1 on hover (the test needs 4.5); a change to `--bg-hover` or `--xp` has to keep the window
  described under Bar wells above.
