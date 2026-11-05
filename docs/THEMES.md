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

- OKLCH lightness `l` becomes `lmin + l * (lmax - lmin)`. Chroma and hue are kept. This is a **remap, not a clamp**: a clamp
  merges the dark colours (Refuse and Poor would become one grey); a remap keeps their order and spacing.
- `lmin` and `lmax` are `--ink-lmin` and `--ink-lmax`. Default is 0.48 and 1, Gothic 0.42 and 1: every dark theme lifts the
  dark colours until they pass 4.5:1 on its surfaces. A light theme lowers `lmax`. At 0 and 1 the result is the authored
  colour, pixel for pixel (checked on 44 colours in the browser).
- The CSS is `oklch(from <color> calc(var(--ink-lmin) + l * (var(--ink-lmax) - var(--ink-lmin))) c h)`. A browser without
  relative colour syntax gets the raw colour: `ink()` checks `CSS.supports` once.
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

One subsection per built theme after the foundation: concept, fonts, key tokens, decorations, known limits. Numbers are
measured with the test's own functions on the token values in the theme file (`tests/themeColor.ts`). "Worst" is the
minimum over panel, raised and hover unless a surface is named.

A rule that sets a default (a border width, a font weight) is written `:where(:root[data-theme='id']) <selector>`. `:where()`
adds no specificity, so the rule ties with the global one it replaces (`button`, `.panel` in `app.css`) and a component's own
single-class rule (`.map-toggle { border: none }`) still wins. A rule that must beat a component rule keeps the plain
`:root[data-theme='id']` prefix.

**Measure with the web fonts blocked as well as loaded.** A checkout whose `node_modules` is a junction (a worktree) serves no
font files from the dev server (Vite's `server.fs.allow`), so every face falls back: the page then shows `Segoe UI`, `Arial`
or `Georgia` in place of the theme's face, and a layout that fits only the real face breaks. Header chips, the bonus chip and
the 184px floor column are sized to hold in both cases. The bonus chip reserves its widest text; the clock chip reserves its
widest hour string; the tests for both are "set every possible text and measure the header" (movement 0), not a sample of real
fights. A theme declares a narrow system face after its own condensed face where the fallback would be wider (Signage's
`--font-caps`).

Scope: a class name that two components use for different things (`affliction` in the sidebar and in the Fight Feed, `drop` on
a family list and on a notebook button) is matched through its parent class (`.afflictions .affliction`, `.fam-wrap .drop`),
never bare (PITFALLS §8).

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
