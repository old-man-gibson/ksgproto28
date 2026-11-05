# Display themes

*How the game's look is switched, how a theme is written, and what keeps it working as panels are added.*

Two themes exist: **Default** (the plain tokens in `app.css`) and **Gothic** (dark brown stone, bone text, brass accent, Cinzel
titles, EB Garamond body). Gothic is what a browser gets until its player picks one (user, 2026-11-03). The Menu window holds
the theme select. A theme is CSS only: it needs no save change and no art.

The foundation (a shared cue system, a token contract and `tests/themes.test.ts`) was built on 2026-11-05 from
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
| `--ink-lmin`, `--ink-lmax` | The `ink()` remap bounds (§4). Default is 0 and 1. |

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
| `--sel-ink-lmin`, `--sel-ink-lmax` | The `ink()` bounds inside a selected thing (§4). Default is 0 and 1. |
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
| Disabled | dashed border, no fill, `--text-off`, `not-allowed`; a reason as text where one exists | `--text-off` |
| Locked row | hatch (`--hatch-lock`), a lock mark and the status word | `--text-dim` |
| Danger (a fight with no way out) | dashed ring, a crossed-swords mark, the words | `--danger` |
| Caution (one-way) | a ⤵ mark and the words | `--warn` |
| Keyboard focus | global `:focus-visible` outline of `--ring-w`, 2px offset; map pins draw a ring circle; map exits underline | `--ring` |
| Current screen in the nav | a `▸` marker slot (always laid out, visible on the open screen), a left bar, `aria-current` | `--accent` |
| Log kind | a one-character glyph in a fixed-width gutter: `!` danger, `×` combat, `+` loot and item, `↑` skill, `★` achievement, `≈` fusion, `?` quest, `→` travel, `◦` explore, `·` info and action | `--log-*` |
| Bar label | `--bar-ink` with a 1px `--bar-halo` outline | `--bar-ink`, `--bar-halo` |

`themes/cues.css` holds only the focus ring and the disabled style. Every other cue is written into its component, because a bare
class selector in a shared file would restyle every component that uses the same word (PITFALLS §8). The disabled rule is
`:root button:disabled`: the `:root` prefix lifts it over a component's own single-class button colours.

A component that removes the browser outline (`outline: none`) draws its own ring on `:focus-visible`. The test lists the few
allowed cases, each with the replacement.

## 4. Authored colours: `ink()` and the selected scope

Rarity, quality tier, status, school, position and talent-lap colours are authored in data (`src/core/data/*.data.ts`,
`ui/lib/talentBar.ts`) for no particular ground. They are drawn through `ink(color)` (`ui/lib/ink.ts`):

- OKLCH lightness `l` becomes `lmin + l * (lmax - lmin)`. Chroma and hue are kept. This is a **remap, not a clamp**: a clamp
  merges the dark colours (Refuse and Poor would become one grey); a remap keeps their order and spacing.
- `lmin` and `lmax` are `--ink-lmin` and `--ink-lmax`. Default is 0 and 1: the result is the authored colour, pixel for pixel
  (checked on 44 colours in the browser). A dark theme raises `lmin`; a light theme lowers `lmax`.
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

Numbers, Gothic (`--ink-lmin` 0.42, `--sel-ink-lmin` 0.48): every authored colour is at least 4.63:1 on panel and raised and
4.74:1 on `--sel-bg`. Refuse and Poor are 15.6 ΔE00 apart (29.9 in Default).

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
| Authored colours after the `ink()` remap on panel and raised | 4.5:1 |
| Authored colours after the selected-scope remap on `--sel-bg` | 4.5:1 |
| Authored colours of one family after the remap | pairwise at least half of Default's minimum; Refuse and Poor at least 10 ΔE00 |
| Every hex in `src/core/data` is in a known family | exact |
| Bar label draws `--bar-ink` with a `--bar-halo` outline; the focus ring and disabled style exist | exact |
| No colour literal in a `.svelte` file outside `tests/themeAllowlist.ts` | exact |
| No `font-weight`, `font-size`, `padding` or `border-width` in a state rule | exact |
| No `outline: none` without a listed replacement | exact |

Exceptions are explicit and pinned:

- **Colour vision.** `VISION_EXCEPTIONS` lists the pairs a theme may leave under 8, with the measured value (it must match within
  0.15) and the reason. Default: mana/spirit (protan 6.4, deutan 1.6), stamina/xp (protan 7.6), hp/stamina (deutan 7.1),
  hp/focus (deutan 7.99). Gothic: mana/spirit (protan 4.0, deutan 1.8), stamina/focus (deutan 5.64). Both keep their bar fills
  (the bars carry a text label and an icon), so the pairs stay. A new theme gets no exceptions.
- **Default's authored colours.** Default keeps `--ink-lmin` 0, so 22 of its 49 authored colours are under 4.5:1 on panel or
  raised (34 on `--sel-bg`). The count is pinned in `DEFAULT_LOW_CONTRAST_DATA`. To fix it, raise `--ink-lmin` and
  `--sel-ink-lmin` in `app.css` (about 0.42 and 0.48) and set both counts to 0; every authored colour in Default then renders
  lighter.
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
- Default's authored colours are under 4.5:1 in places (§7). The fix is two numbers in `app.css` and a visible change to
  every rarity and grade colour in Default.

## 11. Theme catalogue

One entry per built theme besides Default and Gothic: the concept, the fonts, the tokens that carry the look, the decorations,
and what it does not do. Numbers are the minimums `tests/themes.test.ts` computes on the token tables, over panel, raised and
hover. A theme file is `src/themes/<id>.css`; its CSS is the reference for everything not listed here.

### Registry

- **Concept:** the band 1 offices and the Chancery. Filing-cabinet grey-green, a manila accent, form headings, rubber stamps.
- **Fonts:** IBM Plex Sans (400, 400 italic, 600) for text; IBM Plex Mono (500, 600) for headings, the screen list's group
  captions, bar labels and warnings. Latin slices only.
- **Surfaces:** `--bg` `#151a18`, `--bg-panel` `#1c2320`, `--bg-raised` `#26302c`, `--bg-hover` `#323e39`, `--bg-sunken`
  `#0f1311`. `--accent` is manila `#d6bd7c`; `--ring` white; `--here` pink `#f08cc0`.
- **Measured:** text 8.7:1, dim 5.0:1, danger 4.7:1, worst log colour 4.7:1, edge 4.1:1, ring 13.6:1. Authored colours after the
  remap (`--ink-lmin` 0.5) are at least 4.6:1 on panel and 5.2:1 on `--sel-bg`.
- **Bars:** the bar fills are moved from the first design so the seven bars drawn together reach 9.3 ΔE00 under protan and
  deutan (worst pairs: stamina/xp 9.3 protan, focus/xp 9.3 deutan, mana/spirit 10.5 deutan). Stamina is `#3baf75` (emerald),
  xp `#96c671`, action `#ecdd31`. No exceptions in `VISION_EXCEPTIONS`.
- **Selection:** `--sel-bg` is a dark manila tint, darker than raised (manila 11% over sunken), and `button.selected` adds a 4 px
  manila bar on its left edge. Solid manila with dark ink is used only where no authored colour can sit inside: the open entry
  of the screen list, the tab rows (`.tabs`, `.region-switch`) and a selected button with no element carrying an inline
  `style`. Rarity and grade colours would fall under 4.5:1 on manila (plan ruling 3), so those keep the dark fill.
- **Decorations (CSS only):** square corners; h2 and h3 in mono capitals with a rule to the right edge; a 4 px spine on the
  left of every top-level panel; a dotted tear-off line under the header; field boxes with a heavier bottom line; bars with
  quarter marks in the empty part; a graph-paper map ground; the outer you-are-here ring dashed; the pin card's warnings as
  boxed mono capitals in the warning's own colour.
- **Limits:**
  - A long h3 (for example the Skills screen's attribute heading) prints in full capitals.
  - The solid manila rules use `:has()`. A browser without it shows the dark selected fill and the manila bar.
  - The clock chip's text is cut with an ellipsis at 1180 px, as it is in Default; the title is 15 px mono and fits at every
    width where it shows.
