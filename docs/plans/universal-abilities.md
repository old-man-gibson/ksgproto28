---
id: universal-abilities
title: One ability system for both games — FACET as the shared core
kind: epic
status: draft
system: abilities
parent: ''
save: ''
updated: 2026-10-30
invariants:
  - completability
  - no-terminal-states
  - modFingerprint
  - two-validation-layers
  - player-only-carve-out
done:
  - The FACET core lives in its own repo (C:\Users\mersi\Documents\Facet), and node tools/sync.mjs --check there reports both games' copies identical
  - Every user entry in the Facet repo's docs/ABILITY_IDEAS.md runs as a FACET document in both games, or the card names the game-side supply still missing
  - Generated abilities pass the mortality proof; a hand-written ability may carry a written exemption, and each exemption states its reason on the document
  - Every core change passes both games' test suites (KSG npm run verify, IG node test/facet.*.js)
  - Old KSG saves load at the version step 2 introduces, with no ability attached
  - npm run verify green
---

# What this is

The user, 2026-10-29: "Generally I want a 'universal system' that works in
both games." The two games are ksgproto28 (this repo) and InfiniteGacha
(`C:\Users\mersi\Documents\InfiniteGacha`).

FACET is the engine written for that: one core, plain JS with no imports,
copied byte for byte into each game, and one adapter per game that declares
what the game exposes (quantities, damage stages, events, vocabulary). The
master copy, the spec (`docs/FACET-SPEC.md`) and the ability bank live in
`C:\Users\mersi\Documents\Facet`; its README says how to change the core. This card makes FACET the runtime for
unique abilities in KSG, in place of the chassis.

How the decision was reached: the user ran the rolled-abilities design past
Grok, which proposed keeping the FACET kernel, the mortality invariant and the
adapter boundary, with a generator working only inside a fixed set of ability
patterns. That layering is adopted. Its claim that FACET was already KSG's
kernel was wrong: KSG has none of it yet (see below).

# What exists (checked 2026-10-29)

**InfiniteGacha.** Core in `facet/` (core, cells, registry, pipeline, gate,
mortal, forge, oracle, compile, data, cases, relations). Tests:
`test/facet.node.js` 41/41, `test/facet.integration.js` 34/34,
`test/facet.pipeline.js` compares 20,000 blows against the frozen old damage
path and matches on every field. **Shelved since 2026-10-24**: the script
tags were taken out of `game.html` and `field.html`, so the browser game loads
no facet code. The hooks in `combat.js` (status emission, the staged damage
pipeline, events) and the tests stay. Declared off in `facet.host.ig.js`
`caps`: `laws` (the action gate), `summon`, `revive`, `calendar`, `simulate`
(the pricing oracle). IG's own condition for bringing it back: a deep dive on
making abilities interesting first, then three hook fixes its team found (the
mission-tier reset after a sortie has no caller, `townTierEnd` does not attach
the person record, combat never calls `FacetHostIG.detach`).

**KSG.** Nothing before K1 (merged 2026-10-30; see step 1).
FACET-SPEC §13 "Commits K1–K4" is the port plan, written against
`SAVE_VERSION` 48 and old `combat.ts` line numbers; main is at 60 on
2026-10-30. Re-verify every line reference in K2–K4 before building the step.

# The user's rulings (2026-10-29)

| Question | Answer |
|---|---|
| Who the mortality rule binds | **Generated abilities.** A hand-written ability may carry a written exemption, the way WWM's Flowing and Heavy do ([ability-combat-primitives](ability-combat-primitives.md), "The two written exemptions"). |
| Ability content | **The same bank in both games.** Each game supplies every quantity, event and system the bank reads. |
| First ability through the port | **Solar Charge.** |
| Where the core lives | **Its own repo**, holding the core, the spec and the ability bank. Both games copy from it. |

The mortality rule (FACET-SPEC §7): with facets live, no bearer may take more
than 6× as long to kill as with them suspended, at least 35% of one damage
type an opponent can deliver must get through, and facet-added dodge and parry
stop at 50%. An exemption switches named checks off for one document; it is
never inherited by a fusion or a generated variant.

# What this supersedes

**[ability-chassis](ability-chassis.md): the runtime.** Its parts map onto
FACET:

| Chassis | FACET |
|---|---|
| gauge | cell with `level` (fill rides on the carrier status's `intensity`, FACET-SPEC §3.1, so `modFingerprint` sees it) |
| latch | cell with `hold:'one', exclusive:true`, set by a player control (core addition 3) |
| flow | clause on `tick`, `minute` (core addition 1) or an event hook |
| projection | `emit:'status'` |
| trip | clause emitting a fight outcome (core addition 2) |
| burst | an action offered through the gate (`gate.offer`, needs K3) |

The chassis rulings stay, as KSG adapter policy: the forge's plain-literal
rule, the max-HP law, prestige resetting the run's ability, the keep boon
(still open).

**[rolled-abilities](rolled-abilities.md): the generator.** The slot grammar
becomes the generator layer over FACET: verbs become FACET sugar templates
(FACET-SPEC §4.4: sugar is a compile-time expansion; a verb is a primitive
only when it is the sole route to an adapter member), sources become game
events and quantities, bindings become game vocabulary. It stays parked until
the bank exists as FACET documents.

**Unchanged:** one ability per run, monsters never wear abilities, Overforge's
upgrade lives in the item, The Deck is a game mode rather than a generated
ability, lies are player-only and the target saves. In KSG these are adapter
policy; what they become in IG is open (see the last section).

# What the core lacks

Each of these is a core change, so it lands in both copies and passes both
test suites.

1. **Time outside combat.** `Facet.tick` is called only from combat.
   Solar banks in the sun between fights; Calorie burns between meals. Add a
   `minute` hook, plus a bulk entry point for offline catch-up (KSG runs
   catch-up detached from the proxy, so it must not step 480 times through
   reactive state).
2. **Ending a fight with an outcome.** Calorie's collapse produces the `dead`
   outcome with knockout consequences. Add a world verb that hands
   `{ outcome, cause }` to the host.
3. **Player controls.** Only an ability's own clauses can set a cell today;
   IG fights on its own and never needed more. A control is a cell declared
   settable by the player, with its options. KSG applies a change at the next
   bar fill (the chassis `atBarFill` rule).
4. **A run-long tier.** FACET stores per `tick`, `encounter`, `mission`,
   `calendar`. KSG's ability state lasts the run and resets on prestige.

Later, KSG only: a forge editor for FACET documents (recursive `Expr` and
`Guard` trees). Until then documents are hand-written plain literals.

# Supply per game

"The same bank in both" means each game supplies what each entry reads. First
read, not an audit: the IG column is confirmed only where it says so.

| Entry | Reads | KSG | IG |
|---|---|---|---|
| Solar Charge | sunlight 0–1, time outside combat | day clock exists; `sheltered` on locations; a sunlight read is to be added | no day phase or sunlight read (checked: no `isDay`, `daylight`, `sunlight`, `timeOfDay`) |
| Calorie Burn | calories, eating, seconds in a fight, fight outcome | eating exists; calorie gauge new | no calories or hunger (checked) |
| Weakest Weapon Master | stances, technique uses, attribute ceiling and attribute XP, `contest`/`unguardable` | techniques count executions; primitives drafted | no stances in `combat.js`/`martial.js` (checked) |
| Salt Zone | unarmed hits, marks on enemies, the kill path | `onKill` is the one kill path | to audit |
| The Deck | a combat mode over every action system | game mode, own epic | game mode, own epic |
| Ghosts | summons, the player's spells and techniques as payload | `CombatState.allies` new | `summon` cap off |
| Stat Breaker | overrides on enemy quantities | needs K4 | `overrideQ` member exists |
| Amalgam | summons, a death charge, a stat vector | after Ghosts | after Ghosts |
| Overforge | item upgrade with a break chance | smithing, state in the item | to audit |
| Coin Flips | outcome table, a hidden luck skew | `procRate` under the proc cap (mercy.ts) | `mercy.js`; FACET-SPEC E12 is this idea |
| Lies | rule patches with a target save, a daily charge | gate (K3), game-day rollover | `laws` cap off; needs a day clock |

# Build order

Each step ships alone and is verified before the next.

0. **The FACET repo. Done 2026-10-29.** `C:\Users\mersi\Documents\Facet`
   (local, no remote), commit 233a2e8. `core/` is IG's `facet/` at b9c1178,
   stored LF; `docs/` holds the spec files from IG's root and the ability
   bank from this repo. `node test/run.js` runs the core corpus against its
   fake host (41/41). `node tools/sync.mjs` writes the copies listed in
   `tools/targets.json`; `--check` writes nothing and exits 1 on drift.
   Hashes and comparisons fold CRLF to LF, because IG's working tree mixes
   both under `core.autocrlf=true` and raw-byte hashes break on a fresh
   clone. The drift check lives in the Facet repo; the games' test drivers do
   not check hashes. IG's side is on its branch `facet-repo` (7411e41,
   unmerged): the spec files move out, `FACET.md` points here, and
   `facet/MANIFEST.json` takes the master's note and hashes. This repo's
   `docs/ABILITY_IDEAS.md` is now a pointer.
1. **K1. Done 2026-10-30: branch `facet-k1`, merged into main as df377a4;
   the Facet repo's drift check now covers this copy.** The copy in
   `src/core/facet/` (written by the Facet repo's `node tools/sync.mjs --to
   <dir>`, an option added for worktree copies), `facet.d.ts`, `load.ts`
   (bare side-effect imports), `host.ts` (player only), `quantities.ts`,
   `tests/facet.test.ts` (manifest check, the 41 core cases, the adapter,
   and a status a document emits reaching `getDerivedStats`). Installed at
   boot in `ui/state.svelte.ts`. `npm run verify` now ends with `vite build`.
   `docs/FACET.md` is the maintenance page. Quantity ids are InfiniteGacha's
   wherever both games have the number (`fighter.*`, `stat.eff.*`, `res.*`,
   `pool.*`); the rest are `ksg.<StatKey>`.
   **Moved to step 2: `GameState` fields and the save bump.** Their shape is
   the run-long tier (core addition 4), which step 2 designs, and a field
   nothing writes would only need renumbering each time another branch bumps
   the save first. Step 2 takes the next free version, with its migration in
   the same commit (PITFALLS §2; split assignment, PITFALLS §1).
   Found while building, all core-side, so fixed in the Facet repo for both
   games: nothing applies a cell's carrier status (the cells only set the
   intensity of one already held), so a cell's fill never reaches the stat
   block in either game; `{ of: 'frac' }` defaults its maximum to
   `fighter.maxHp`, which in IG is a multiplier slot and in KSG is
   unregistered, where `fighter.maxHpAbs` is the maximum. And in KSG the
   mortality proof is inert until K2 supplies `probeSlice`/`probeNative`.
2. **Solar Charge in KSG. Done 2026-10-31: branch `solar-charge`, merged
   into main as c00261f.** Core (Facet dc9e80b, bea3ffa): carriers applied at
   attach and whenever missing (`carrierSync`); a cell may describe its
   carrier (`status: { mods, desc }`); a modifier may name a shared quantity
   id (`q`) that each host maps to its own stat; `Facet.minute(ref)`; the
   `frac` default reads `fighter.maxHpAbs`; `facet.bank.js` holds the bank as
   documents. The run tier needed no core code: cell values live in the
   document, and the document in `state.facets` (save v61, `MIGRATIONS[60]`).
   KSG: `world.sunlight` (exposure.ts `sunlight`), `tickFacets` in
   `Game.advance`, `bindFacets` following whichever state advances (offline
   catch-up ticks a detached copy), a sidebar readout, and debug-panel grant,
   charge and teleport buttons. IG's branch `facet-repo` carries the same
   core (0f32ce2; its tests pass).
   The document reads the user's 2026-10-29 prose: power follows the charge,
   +20% from half charge up, a straight line down to −30% at empty, on damage
   and spell power. Placeholders the user has not set: the +20% peak, the 50%
   knee, the fill and drain rates (from the 2026-09-26 card), MAIN = CON + WIS
   with gear counted, starting empty (a fresh grant opens at −30%), and the
   discovery moment (debug grant only). Seen in play: with CON and WIS near
   157, the fill beats the drain only above about 23% sunlight, so rain by
   day drains the bank.
3. **Solar Charge in IG.** A day clock and sunlight read in IG; the same
   document runs unchanged.
4. **Calorie Burn.** Core addition 2. KSG first, then IG's calories and
   eating.
5. **K2 (staged damage path in KSG) and core addition 3**, then **WWM**, with
   its written exemption on the document.
6. **K3 (the action gate in KSG) and IG's `laws` cap**, then Stat Breaker
   (needs K4), Lies, bursts.
7. **Summons in both games** (IG commit 6; KSG `CombatState.allies`), then
   Ghosts and Amalgam.
8. Salt Zone, Coin Flips, Overforge, The Deck, each with its game-side supply.
9. **The generator** (`Facet.forge.generate`), once the bank exists as
   documents. Everything it emits must pass the proof.

# Open

- Merging IG's branch `facet-repo`. Another session edits IG's checkout, so
  the branch was built without touching it.
- In IG: do monsters wear bank abilities? In KSG they never do.
- In IG: what "one ability per run" becomes. IG has a roster, not runs.
- In IG: what the run-long tier maps to.
- FACET-SPEC §14's weaknesses carry over: dodge and parry are bounded by
  declaration, not measured; no UI is designed; the generator has no taste
  (the reason it is parked in KSG).
