# FACET in this game

FACET is the ability engine shared with InfiniteGacha (user, 2026-10-29: one
ability system for both games, with the same ability bank in both). The engine
core, its spec and the ability bank live in their own repo:

`C:\Users\mersi\Documents\Facet` (local, no remote; its README is the rule book)

This game carries a **copy** of the core in `src/core/facet/` and its own
adapter beside it. The port plan, with every step and what each one adds, is
[plans/universal-abilities.md](plans/universal-abilities.md).

## The one rule

**Never edit a `facet.*.js` file here.** Edit the master in the Facet repo,
then:

1. `node test/run.js` in the Facet repo (the core's own 41 cases).
2. `node tools/sync.mjs` there. It writes every game's copy listed in
   `tools/targets.json`. For a copy in a worktree of this repo, name it:
   `node tools/sync.mjs --to D:/ksgproto28/.claude/worktrees/<name>/src/core/facet`.
3. `npm run verify` here, and InfiniteGacha's facet tests there.

`tests/facet.test.ts` fails when a copied file no longer matches the
`MANIFEST.json` beside it, so an edit made here by mistake is caught even on a
machine without the Facet repo. `node tools/sync.mjs --check` in the Facet repo
reports a copy that has drifted from the master.

## Files

| File | What it is |
|---|---|
| `src/core/facet/facet.*.js`, `MANIFEST.json` | The copy. Plain JS, no imports or exports; each file publishes into `globalThis.Facet`. |
| `src/core/facet/load.ts` | Loads the core with one bare side-effect import per file. |
| `src/core/facet/facet.d.ts` | Types for the members this game calls. Add a line when you call a new one. |
| `src/core/facet/host.ts` | The adapter: every member `Facet.install` requires, read off the player. |
| `src/core/facet/quantities.ts` | Every number a document may read, with its id. |
| `tests/facet.test.ts` | The manifest check, the core's corpus run through this game's loader, and the adapter. |

The adapter is installed once at boot in `src/ui/state.svelte.ts`, after the
save loads, and bound to the loaded state before anything renders.

## The run's ability

`state.facets` holds the run's unique ability as FACET documents (save v61; at
most one, one ability per run). A document carries its cells' values, so
saving the state saves the ability; the statuses those cells ride on are
saved too, but their definitions are rebuilt when the document is attached.
Prestige starts a fresh state, so the ability goes with the run.

| Piece | Where |
|---|---|
| Granting one (a copy of a bank template, replacing the held one) | `grantFacet` in `host.ts`. For now only the debug panel's Unique ability row calls it: the discovery moment is undecided. |
| Its time outside a fight: one `Facet.minute` per game minute, travel and fights included | `tickFacets`, called from `Game.advance` beside `tickExposure` |
| Which state the core writes into | `bindFacets`. Offline catch-up ticks a detached copy of the state; the binding follows whichever state advances, and `Game.resyncAnnouncers` re-attaches after the contents are replaced (catch-up landing, import, reset, prestige). |
| What the sidebar shows | `facetReadouts`: every cell whose document gives it a `show` hint, plus the document's `reading.inputs`. Those cells' statuses are left out of the status chips. |

**Solar Charge** is the first ability (`core/facet.bank.js` in the Facet repo,
where its numbers and formulas are written out). It reads `world.sunlight`
(exposure.ts `sunlight`, see WEATHER.md), `stat.eff.con` and `stat.eff.wis`.
Its power cell is a status whose two modifiers name `fighter.damage` and
`fighter.magicDamage`; this game turns those into `damage` and `spellPower`.
To try it: open the debug panel (🐞), Grant ☀️ Solar Charge, then stand under
open sky by day. The Charge buttons there set the bank to a share of its cap.

**Why only bare imports.** The core files have no exports. A named import
(`import { x } from './facet.core.js'`) passes vitest and fails `vite build`
and the dev server, and TypeScript does not check that a side-effect import's
path exists. That is why `npm run verify` ends with `vite build`: it is the only
check on a mistyped path in `load.ts`.

## Quantity ids

A document names numbers by id, and the same document must run in both games,
so ids are shared with InfiniteGacha wherever both games have the number:

| Id | Here |
|---|---|
| `stat.eff.<str…cha>` | the attribute with every modifier counted (`effectiveAttr`) |
| `fighter.hp` | current HP; never written, never severed |
| `fighter.maxHpAbs` | max HP (`maxHp`); never severed |
| `fighter.damage`, `.magicDamage`, `.speed`, `.dodge`, `.parry`, `.armor`, `.crit`, `.critDamage`, `.penetration`, `.splash`, `.ward`, `.resistCap` | the derived stat of the same meaning (`.magicDamage` is `spellPower`) |
| `res.<type>` | the resistance to that damage type (the same fourteen types in both games) |
| `pool.<stamina\|mana\|spirit\|focus>.cur` / `.max` | the pool and its maximum; spirit exists only here |
| `world.sunlight` | sunlight on the player, 0..1 (exposure.ts `sunlight`); IG has none yet |
| `ksg.<stat>` | every other derived stat, by its `StatKey` |

A document that reads a `ksg.*` id runs only in this game until InfiniteGacha
supplies that number under a shared id. InfiniteGacha's `fighter.maxHp` is a
max-HP multiplier slot this game does not have, so it is not registered here.

`quantities.ts` holds one row per `StatKey` in a `Record<StatKey, …>`, so a new
derived stat fails `svelte-check` until it is given a row.

## What is off, and which step turns it on

Members the core requires but this game does not support yet are present and
inert, or refuse loudly; `host.ts` says which for each.

| Off | Arrives with |
|---|---|
| The mortality proof (`probeSlice`, `probeNative`); damage stages | K2, the staged damage path |
| Quantity overrides (`overrideQ` throws); the action gate; arena laws | K3 |
| Overrides on monsters | K4 (monsters never wear an ability, but an ability can act on one) |
| Allies, summons, revives, the calendar, the pricing oracle | not planned here (`caps` in `host.ts`) |

## Core gaps found during K1, fixed for Solar Charge (2026-10-30)

- A cell's carrier status was never applied, so a cell's value never reached
  the stat block in either game. The core now applies it at attach and
  whenever it is missing (`Facet.carrierSync`).
- `{ q: …, of: 'frac' }` defaulted its maximum to `fighter.maxHp`; it now reads
  `fighter.maxHpAbs`.

Also added then: a cell may describe its carrier (`status: { mods, desc }`),
and a modifier may name a shared quantity id (`q`) that each game maps to its
own stat name.
