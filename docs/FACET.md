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

1. `node test/run.js` in the Facet repo (the core's own cases, 58 as of
   Bramble).
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
| `src/core/facet/host.ts` | The adapter: every member `Facet.install` requires, read off the player and the enemies in the fight. |
| `src/core/facet/signal.ts` | The fight events the ability hears, and which state the core is bound to. Imports nothing but types, so health.ts and combat.ts can call it. |
| `src/core/facet/quantities.ts` | Every number a document may read, with its id. |
| `tests/facet.test.ts` | The manifest check, the core's corpus run through this game's loader, and the adapter. |
| `tests/zenkai.test.ts`, `tests/littleMoons.test.ts`, `tests/bramble.test.ts` | Each bank ability in this game: its rules, then a hunt in the real game loop. |

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
| Its time in a fight: one `Facet.tick` per combat tick (`on: 'tick'` clauses) | `facetCombatTick` (signal.ts), called from combat.ts `tickCombat` after the enemies' conditions and before anyone swings; `sweepDead` runs right after it for whatever the ability killed |
| Damage it deals | host.ts `applyDamage` → combat.ts `abilityStrike`: resistance, the target's conditions and the on-damage hooks, never a dodge, crit or variance. One feed line per fight per ability (`ability:<name>`), settled when the fight ends. |
| Answering the enemy who hit you | health.ts `damagePlayer` names the attacker in `hitTaken` (`source.by`, set by combat.ts's three monster sites: the blow, the graze and an enemy's spell) and passes the blow as thrown (`source.thrown`); the document aims at it with `{ frame: 'attacker' }`. combat.ts `answeredToDeath` sweeps an attacker the answer killed before the enemy phase goes on, as a thorns ward's kill is swept. A spell you cast on yourself passes `source.self` (`castCraftedSelf`). |
| A pool cost it pays (the `spend` verb) | host.ts `spendPool` → `spendResource`; stamina, mana, spirit or focus, never HP |
| Which state the core writes into | `bindFacets`. Offline catch-up ticks a detached copy of the state; the binding follows whichever state advances, and `Game.resyncAnnouncers` re-attaches after the contents are replaced (catch-up landing, import, reset, prestige). |
| What the sidebar shows | `facetReadouts`: every cell whose document gives it a `show` hint, plus the document's `reading.inputs`. Those cells' statuses are left out of the status chips. |

**Solar Charge** is the first ability (`core/facet.bank.js` in the Facet repo,
where its numbers and formulas are written out). It reads `world.sunlight`
(exposure.ts `sunlight`, see WEATHER.md), `stat.eff.con` and `stat.eff.wis`.
Its power cell is a status whose two modifiers name `fighter.damage` and
`fighter.magicDamage`; this game turns those into `damage` and `spellPower`.
To try it: open the debug panel (🐞), Grant ☀️ Solar Charge, then stand under
open sky by day. The Charge buttons there set the bank to a share of its cap.

**Zenkai** is the second, and the first that listens to fight events: after a
win where HP fell to 20% or below, with no flask, consumable or miracle used,
all attributes gain 1.5% × (1 − lowest HP share) × min(1.5, enemy level / your
level), times 0.97 per Zenkai already gained. The user approved it as written
(team ability GEN-10, 2026-10-31). To try it: Grant 💥 Zenkai, press HP to 15%,
and win a fight against an enemy at least 70% of your level.

**Little Moons** is the third, and the first that acts on an enemy. Three moons
strike the front enemy every 2.8 s, 3.7 s and 7.9 s for 30% of weapon damage
(+5% per boss killed this run), as Light. Strikes within 0.3 s combine into one
that deals their sum ×2 (two moons) or ×5 (three). The moons cost 2 mana per
second and go dark for 10 s when the pool cannot pay. They run only in fights
and start each fight from zero. The user approved it with "might need to tweak
numbers" (team ability R3-SKY-19, 2026-11-01); the readings taken where the
entry is silent are written above the document in the Facet bank. Its counting
cells say `carrier: false`, so they hold no status and never move the derived
stat cache, which would otherwise rebuild on every combat tick. To try it:
Grant 🌙 Little Moons and hunt with mana in the pool; the feed shows one
running line of strikes per fight.

**Bramble** is the fourth, and the first that answers the enemy who hit you.
Each enemy blow raises a thorn level by 1 (cap 10, +1 per 200 fights this run,
at most 50), each second of fight time by floor(1 + 5% of the cap), and each
Poison spell you cast on yourself by floor(2 + 10% of the cap). Each level
returns 2% of the blow as thrown (before your armour) to its attacker as
Piercing and slows the action bar (`fighter.speed`) by 0.5%. A Heat blow burns
5 levels. Thorns clear when the fight ends. The user approved it without a
note (team ability FLD-04) and added the second and Poison growth on
2026-11-01; the readings are written above the document in the Facet bank. A condition ticking, a trap or your own backlash is not a blow:
it has no attacker, so it neither grows nor burns thorns. The thorn level
rides a status (Thorns), which is how the slow reaches the stat block. To try
it: Grant 🌿 Bramble and hunt; the feed shows one running line of thorns per
fight.

### Enemies as refs

A document aims at enemies through scopes, and the adapter names each enemy
by its slot: `foe:0` is the front enemy, `foe:1` the next. A ref lives for one
call, because slots move when the front enemy dies. `resolve` answers
`side: 'enemy'` (living enemies, front first, so `n: 1` is the front enemy) and
`side: 'arena'` (the player and every enemy). The status members reach the
enemy a ref names, so a document can put a condition on one. An enemy's
numbers are not quantities until K4: `readQ` on a `foe:` ref returns 0.

## Events

A document listens with `on: 'event:<id>'` and reads the event's detail with
`{ frame: '<field>' }`. Event ids are shared with InfiniteGacha, like quantity
ids. Where this game raises each one (`signal.ts` has the same table):

| id | Raised by | Detail |
|---|---|---|
| `fightStart` | bus `encounter` (host.ts `registerFacetListeners`) | `enemies`, `maxLevel` |
| `kill` | bus `kill` | `level`, `boss` (1 when the enemy is a boss of the spot, combat.ts `isSpotBoss`) |
| `fightWon` | bus `fight:won`, after the last `kill` | |
| `fightEnd` | bus `fight:closed`, however the fight ended | `won` (0 or 1) |
| `hitTaken` | health.ts `damagePlayer`, the one door every blow uses | `amount` (what reached HP), `blow` (the blow as thrown, before armour, resistance and ward; `amount` when nothing was thrown), `type` (`'none'` when untyped), `attacker` (the enemy's ref, `''` for a condition, a trap or your own backlash), `self` (1 for a spell you cast on yourself) |
| `hit`, `crit`, `dodge`, `parry`, `graze`, `enemyCast` | combat.ts `markCombatEvent` | |
| `flaskUsed` | `Game.useFlask` | |
| `itemUsed` | `Game.useConsumable` | |
| `miracleCast` | combat.ts, when a miracle is cast | |

A signal costs nothing when no ability is held: `facetSignal` returns before
anything else. Adding an event is a line in `signal.ts` and a call where it
happens. An ability may answer an event after it happens (damage the attacker
once a blow has landed, for example), but changing the blow itself (reduce it,
cancel it) needs the staged damage path (K2).

A frame guard (`when: { frame: 'boss', op: 'eq', v: 1 }`) passes when the
field is missing, so a document should not guard on a field one game might not
send. Little Moons adds the flag instead (`value: { frame: 'boss' }`), which
reads a missing field as 0. Bramble guards on strings through `not`, which
fails closed: `{ not: { frame: 'attacker', op: 'eq', v: '' } }` passes only
when an attacker is named. This game always sends `type`, `attacker` and
`self`.

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
| Overrides on monsters, and reading an enemy's quantities | K4 (monsters never wear an ability, but an ability can act on one) |
| Damage aimed at the player (`applyDamage` on the player returns 0) | the first bank ability that hurts its bearer; it needs `damagePlayer`'s knockout handling |
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

## Core additions for Little Moons (2026-11-01)

- `carrier: false` on a cell: no status rides on it. For counters and timers
  that no modifier reads.
- `{ seconds: x }` in an Expr is x seconds in the host's ticks, for a cell
  that counts ticks against a cap.
- The `spend` world verb (`{ emit: 'world', verb: 'spend', pool: 'mana',
  value }`) pays from a pool through the host's `spendPool`, up to what is
  held. A quantity write cannot do this: those are overrides on a reading.

## Core additions for Bramble (2026-11-01)

- `{ frame: 'attacker' }` as a scope targets the ref an event names in that
  field, and nothing when it is empty or dead (facet.compile.js
  `resolveScope`).
- `reading.hit`, a display hint: what the feed calls the ability's damage
  lines (`'thorns'`; `'strike'` when unset).
