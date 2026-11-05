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

### Signage

- **Concept:** wayfinding signs. Black ground, white type, signal-yellow plates, hazard stripes. A state is a fill, a stripe
  or a glyph; there is no glow and no gradient other than the stripes and the bar ticks.
- **Fonts:** Barlow 400 and 600 (text), Barlow Condensed 600 and 700 (headings, captions, bar labels, tower rows). Imports:
  `@fontsource/barlow/latin-{400,600}.css`, `@fontsource/barlow-condensed/latin-{600,700}.css`. Root size 16px, tabular figures.
  Radius 3px on everything except the round parts (`.shadow .ring .aura .dot .pip`).
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
    newest station (`.station.back`) and a map card's head. Nothing else is filled yellow.
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
- **Header budget:** one row at 1024, 1094, 1180, 1440 and 1920 px, no overflow. Job strip width at those widths is 191, 261,
  355, 441 and 709 px (Default 198, 268, 362, 462, 752; Gothic 221, 291, 385, 433, 703). At 1024 the strip is under 210px,
  so its bar is hidden, as in Default. The transport buttons are 311px wide (Default 307).
- **Known limits:**
  - Selected controls are black, not yellow. A solid yellow `--sel-bg` cannot pass the authored-colour check: the authored
    colours inside it would have to stay under OKLCH lightness 0.5, which leaves quality tiers 8 ΔE00 apart against a floor of
    12 (best margin -4.0 on `#ffd400`, -0.6 on white; measured with `tests/themeColor.ts`).
  - Brightest of the dark themes: white text on near-black. The yellow plates are limited to the four places above.
  - Barlow is the Latin slice only; `ā` and `ō` fall back to the system face.
  - `.map-card .warn` and `.affliction` rules name component classes; a renamed class loses its stripe and keeps working.

### Cockpit

- **Concept:** a dark-cockpit panel. Dim grey-green at rest; a filled tile appears only for an exception; amber marks the
  current item. Flat surfaces, 1px rules, no gradient and no glow; radius 0.
- **Font:** B612 400 and 700 (`@fontsource/b612/latin-{400,700}.css`). Root size 13.5px. B612 digits are tabular without a
  feature flag (checked: ten digits measure the same), so the header's clock slot holds one width for all 24 hours.
- **Tokens:**
  - Surfaces: bg `#0e100f`, panel `#161917`, raised `#1f2321`, hover `#2c312e`, sunken `#090b0a`; border `#3b423e`, frame `#252a27`.
  - Ink: text `#e6eae4` (10.9:1 worst), dim `#a3aca5` (5.68), accent amber `#f2b84b` (7.40), danger `#ff7566` (5.04),
    warn `#ffd24d` (9.19). Log colours: worst `--log-skill` 5.08.
  - Cues: edge `#8f9891` (5.35:1 worst of panel and raised), ring `#f4f6f2` 2px (14.6), here `#e879b9`, text-off `#89938c` (5.01).
  - Selected: `--sel-bg` `#2b2412` (a dark amber well), `--sel-ink` `#e6eae4` (12.65). Authored colours: `--ink-lmin` 0.44 (worst 4.67),
    `--sel-ink-lmin` 0.47 (worst 4.82 on `--sel-bg`); Refuse and Poor 14.7 ΔE00 apart. Worst bar `-ink` token: `--hp-ink` 5.11
    (panel, raised, hover and `--sel-bg`).
  - Bars: hp `#b8322e`, stamina `#86ab72`, mana `#5aa0ee`, spirit `#7d63b5`, focus `#da6600`, action `#e8cf4a`, xp `#86dcb8`. Chosen by
    lightness steps so the confusable hues (red, green, orange, yellow) stay apart for protan and deutan viewers: worst pair
    protan stamina/xp 14.45, deutan mana/spirit 14.39. No `VISION_EXCEPTIONS` entry.
- **Decorations (CSS only):**
  - Annunciator tiles, filled, for exceptions only: a one-way line (`--warn`) and a no-retreat line (`--danger`) in a map card,
    an affliction chip, and the Pause button while the world is frozen (`.clock .pause.on`, amber).
  - The open screen is amber text on `--sel-bg` with a 3px amber bar at the left (`.nav-on`); a selected control is the same well with
    a 3px amber bar under it; a selected tab is a 3px amber rule under flat text. Every other row and tab is dim.
  - Placards: `h3` is 11.5px dim spaced capitals with a trailing 1px rule; `h2` is 15px, the one bright heading. The nav mark
    "ready" is a boxed amber caption; "new" is plain text so a column of them stays quiet.
  - Bars: a 1px frame and a tick every tenth along the bottom edge (`.bar::after`).
  - Map card: grey frame with a 3px amber top bar. Locked rows: white 11% hatch. No shadow under floating cards (`--lift` is transparent).
- **Header budget:** one row at 1024, 1094, 1180, 1440 and 1920 px, no overflow. Job strip width at those widths is 167, 237, 338,
  441 and 691 px (Default 198, 268, 362, 462, 752): B612 is wide, so the strip is 24 to 31px narrower than Default at the
  four narrower widths. The detail text (330px) and the bar (210px) drop at the same widths as in Default: the bar at 1024 only.
- **Known limits:**
  - B612 is wide. Tower floor names use 11.5px and a tighter letter-spacing to fit the 184px column; "The Flooded Offices" is still
    cut by 8px, as it is in Default.
  - Closest of the dark themes to a plain dark UI. What marks it as a panel: the face, the tiles, the placards and the tick scale.
    A screen with no exception on it shows no filled tile.
  - B612 is the Latin slice only; `ā` and `ō` fall back to the system face.
