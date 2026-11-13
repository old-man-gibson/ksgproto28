# Phone and tablet shell

> The shell (header, left column, log, windows) on a 360 to 430 px phone and a
> 700 to 1280 px tablet. Built 2026-11-12 from
> [plans/ui-proposals.md](plans/ui-proposals.md) A3. The panels inside the tab
> body are not covered here: they get their own pass.

## 1. Two layouts, one flag

`viewport.phone` (`src/ui/lib/viewport.svelte.ts`) is true below 700 px
(`PHONE_BELOW`). `App.svelte` reads it once and everything else follows: the
`.layout.phone` class, the components it renders, `Modal`, `LogTicker`,
`LogDrawer`, `SystemMenu`. No shell stylesheet repeats the number, so there is
one place to change it (`tests/phone.test.ts` fails if one does).

Above 700 px the desktop layout is unchanged except where section 4 says.

| | phone (under 700 px) | 700 px and wider |
|---|---|---|
| top | `Dock.svelte`, sticky | `<header>` in `App.svelte` |
| screen list | `BottomBar.svelte`, sticky, scrolls sideways | `NavIndex.svelte` in the left column |
| pool bars | in the dock (`ResourceBars` mode `dock`) | in the left column (mode `panel`) |
| conditions, dishes, level bar | under the screen (mode `extras`) | in the left column (mode `panel`) |
| Attributes, Combat Stats | under the screen | in the left column |
| log | one row above the bottom bar; a tap opens a sheet | right column or the folded row (`shell.ts`) |
| `Modal` | a sheet over the whole screen, 44 px close button | a floating window |
| Menu | also holds +1, +1s and Next; no key list | key list |

The page scrolls. `.layout.phone` is a flex column, not a grid: a sticky child of
a grid cell cannot leave its cell. `main`, the sidebar and the bottom bar are
placed with `order`, so the markup keeps the desktop's order.

## 2. The dock

`header.dock`. It is a `header` and a direct child of `.layout`, so the themes'
`.layout > header` rules frame it. The class is `dock`, never `bar`
([PITFALLS §8](PITFALLS.md)). Rows, all of fixed height:

1. Pause, the bonus toggle, the job block, Menu. The job block (`JobStrip`
   `compact`) is three lines: the job and its detail, the cycle's bar, then the
   gold and the gold per minute. The `2×` of the header's bonus chip is the
   button's accent border here.
2. HP, with the conditions as marks inside the bar (`ResourceBars`).
3. Stamina, mana, spirit and focus, thin bars. Numbers and breakdowns are in the
   tap cards.
4. The sky line (`SkyStrip.svelte`): the clock chip, the moons, the weather and
   the dark. Absent while none of them has anything to say; the dark's slot is
   reserved whenever the line is drawn.

The dock publishes its height as `--dock-h` on `<html>`; `BottomBar` publishes
`--bottombar-h`. They are read by the tutorial card (`top: calc(var(--dock-h) +
4px)`), the log sheet, and `html { scroll-padding-top / -bottom }`, so a target
scrolled into view stops short of both.

Floor 0 follows `tutorialScreen` (`dockParts` in `shell.ts`): the job block
alone, then the bars from step 4, the gold from step 5, and Menu, Pause, bonus
and the rate after the tutorial. `tests/phone.test.ts` walks the steps.

Height, measured at 375 px in a development build (the developer button adds a
44 px control to the first row): 100 px on floor 0 step 4, 125 to 132 px after the
tutorial with the sky line, in all eleven themes. It did not change over 16 s of
the page running, nor with a condition on the HP bar: every row is a fixed height
and every changing figure sits in a slot or at the end of its line. The job
detail ("Foe HP 60%") shows from a block 170 px wide; at 360 to 375 px the block
is 107 to 122 px wide in a development build, so the detail is in the tap card.

## 3. Touch

- **Tap cards.** `Tip.svelte` (from commit 02c7dd8, with its card fitted to the
  window): a tap on plain content opens its card, a tap on a control presses it,
  and a long press (450 ms) on a control opens the card without pressing. The
  card is full width under the target, or over it when it does not fit, and
  scrolls inside itself when taller than the window (`cardTop` in
  `lib/tipPlace.ts`). One card at a time; a tap elsewhere or a scroll outside it
  closes it. Hover cards are unchanged for a mouse.
- **No hover-only information in the shell.** The text the dock would have kept in
  a `title=` is a `Tip`: the job and the rate, Pause, the bonus bank, the sky
  chips, the worn title (now a `Tip` at every width). The desktop header keeps
  its `title=` text; the Menu button's `title=` only repeats its label.
- **Hit height.** Under `(pointer: coarse)` a button, select, summary or tab is
  at least 44 px tall (`app.css`, `:where()`, so a component's own height wins).
  The dock and the bottom bar set 44 px at every width.
- **Double-tap zoom and selection.** `touch-action: manipulation` on the page's
  controls; `user-select: none` and no callout on controls and tap targets under
  a coarse pointer. Text outside the controls stays selectable.
- **Hover paint.** The global button hover and the screen list's hover paint only
  under `(hover: hover)`, so a tapped button does not stay lit. The themes' own
  button hover rules are not wrapped.

## 4. Safe areas, tablets, windows

- `index.html` sets `viewport-fit=cover`. `app.css` defines `--safe-top`,
  `--safe-right`, `--safe-bottom`, `--safe-left` as the larger of `env(safe-area-
  inset-*)` and `--safe-area-inset-*`: a host that cannot give `env()` (an
  Android WebView) sets the second on the page. They pad the dock, the bottom
  bar, `.layout` on a wider screen (12 px, or the inset where that is more),
  `Modal`'s sheet, the log sheet, the tap card and the other windows (offline,
  defeat, prestige, dare, evolve, catch-up). Checked by setting
  `--safe-area-inset-top`, `-bottom` and `-left` on the page at 375 px: the dock,
  the bottom bar, the sheet's header and body padded by them, and `--dock-h` and
  `--bottombar-h` followed.
- **Header under 1180 px** is two rows (it was 1024): the job strip and the rate
  chip start the second. At 1024 px with the clock, moons, weather, dark slot,
  gold and Menu all showing, one row left the strip 16 px and the job's name was
  gone. From 1180 px it is one row, as before.
- **Tab body.** `container: tab / inline-size` on `.tab-body`. A panel can ask for
  `@container tab (max-width: ...)` and gets the width its column gave it, not the
  window's. In Chrome the container does not become the containing block of
  `position: fixed` descendants (checked on 156); `Modal` and the map card stay
  fixed to the window. On the phone the tab body scrolls sideways inside itself
  when a panel is wider than the screen, so the page never does.
- Storage. `browserStorage` (`save.ts`) falls back to memory where the browser
  refuses `localStorage`, so the game boots and does not save. `musicAudio.ts`
  reads its two preferences through it.

## 5. Checking it

The locks that run: `tests/phone.test.ts` (the dock on floor 0, card placement,
the markup rules), `tests/nav.test.ts`, `tests/themes.test.ts`.

By hand, with `npm run dev` on a port other than 5173 and a throwaway save:

1. 375 x 812, 414 x 896: every screen. `document.documentElement.scrollWidth`
   equals `innerWidth`; the dock stays on top and the bottom bar at the foot
   through a scroll; the open screen is in view in the bottom row.
2. 768 x 1024, 1024 x 768, 800 x 1280, 1280 x 800: no horizontal scroll, the job's
   name visible in the header, the tab body at least 464 px.
3. Tap a pool bar, the job block and a long press on Pause: a card each, one at a
   time.
4. Floor 0: the dock follows the step; the tutorial card sticks under it.

The Browser pane's mobile preset (and any width under 768) reports
`pointer: coarse` and `hover: none`; a wider window does not, so the 44 px rule is
checked at 740 px. Its clicks are mouse clicks: to test the touch path, dispatch
`pointerdown` and `pointerup` with `pointerType: 'touch'`, then `click`.

## 6. Not done

- The panels. Measured at 375, 414 and 360 px on 2026-11-12, every screen leaves
  the page exactly as wide as the window. The tab body scrolls sideways by 7 px on
  Skills at 375 px (22 px at 360): the skill rows' 64 px XP bar (`span.xp`,
  `span.bar`) and the "Collapse all" button. The Location ladder and the Combat
  stage clip inside their own boxes, by design. Touch drag-reorder in
  `CombatPanel`, `MartialPlanner` and `SpellcraftPanel` is still HTML5 drag
  ([ENGINEERING §2.3](ENGINEERING.md)). Tutorial and panel text that says
  "hover" is unchanged.
- A tablet header in portrait is three rows (113 to 149 px). The step buttons are
  in the header there, not in the Menu.
