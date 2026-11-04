# Display themes

*How the game's look is switched, and how to keep a theme working as panels are added.*

Prototype added 2026-10-20 on branch `theme-gothic`. Two themes exist:
**Gothic** (dark brown stone, bone text, brass accent, Cinzel titles, EB Garamond
body) and **Default** (the plain tokens in `app.css`). Gothic is what a browser
gets until its player picks one (user, 2026-11-03). The Menu window in the top bar
holds the theme control; it switches between Gothic and Default.

Files:

- `src/app.css` — the Default tokens (`--bg`, `--bg-panel`, `--accent`, the
  resource colours …) and the shared shapes: `.panel`, `button`, `.bar`
- `src/themes/gothic.css` — the Gothic overrides, all under
  `:root[data-theme='gothic']`
- `src/ui/lib/theme.ts` — the list of themes, `DEFAULT_THEME`, the stored pick,
  `applyTheme` (page only) and `chooseTheme` (page and storage)
- `src/main.ts` — imports the fonts and the theme CSS, applies the theme before
  the first paint
- `src/ui/SystemMenu.svelte` — the theme control

## 1. How it works

A theme is plain CSS keyed on `data-theme` on `<html>`. The Default theme has no
attribute. The choice is a **browser preference, not game state**: it lives under
the localStorage key `ksgproto28-theme-choice`, outside the save's
`ksgproto28:save` prefix, so no save carries it and a hard reset keeps it.

Only a pick is stored. `loadTheme()` returns the stored pick, or `DEFAULT_THEME`
(`gothic`) when there is none. Applying the theme at boot stores nothing, so a
browser that never used the theme control follows `DEFAULT_THEME`, and changing
`DEFAULT_THEME` later moves those browsers with it. The first prototype stored
its theme at every boot under `ksgproto28-theme`; that key shows no choice was
made and is no longer read. A player who picked Default under it gets Gothic once
and can pick Default again.

Most of the UI already reads its colours from the tokens in `app.css`
(about 680 `var(--…)` uses against about 200 hard-coded colours on 2026-10-20),
so overriding the tokens restyles most screens at once. The theme file then
changes the few shared shapes every panel is built from: panel frames, buttons,
bars, headings, form controls, and corner rounding (Gothic squares everything
except the battle stage's ellipses and status dots).

Fonts come from the `@fontsource/cinzel` and `@fontsource/eb-garamond` packages,
bundled by Vite, so the game needs no network for them. A font is only
downloaded by the browser when a rule actually uses it.

## 2. Rules

- **Tokens, not overrides.** When a component hard-codes a colour that looks wrong
  in a theme, give the colour a token in `app.css` (with the old value as the
  default) and override the token in the theme file. Do not add a per-component
  rule to the theme. Examples: `--bg-sunken` (bar tracks, the map's ground),
  `--skill` (skill XP bars), the `--log-*` colours in `LogFeed.svelte`, which are
  written as `var(--log-combat, #e0a1a1)` so the default needs no entry.
- **Colour is data here.** HP, stamina, mana, spirit and focus are told apart by
  hue, and so are rarity and elements. A theme may shift them but must keep them
  distinguishable.
- **Cinzel is capitals only.** Keep it on short titles (h1–h3, the tab rows inside
  panels, the screen list's group captions). Instruction lines (h4, helper text)
  stay in the body font. The captions read the `--font-caps` token as
  `var(--font-caps, inherit)`; Gothic sets it, Default leaves it unset.
- **Numbers stay lining.** Garamond's default figures are old-style; the theme sets
  `font-variant-numeric: lining-nums tabular-nums` so stat columns line up.

## 3. Adding a theme

1. Add its id to `THEMES` and a name to `THEME_NAMES` in `theme.ts`. Change
   `DEFAULT_THEME` only to change what a browser with no pick gets.
2. Create `src/themes/<id>.css` with every rule under `:root[data-theme='<id>']`,
   and import it in `main.ts`.
3. Check the busy screens, not just the opening: the city map, inventory,
   spellcrafting table, martial position planner, bestiary, Wuxin, skills.
   The developer panel's **Record every creature** and **Open locked systems**
   fill a test save fast.

## 4. Open

- Pixel icons replace the emoji one group at a time, in both themes
  ([plans/pixel-icons.md](plans/pixel-icons.md)). Story 1 (2026-10-22) did the
  sidebar: attributes, superattributes and the resource bars. Everything else
  still shows its emoji.
- Gothic is still a prototype in its details. It became the default theme on
  2026-11-03; Default stays selectable.
