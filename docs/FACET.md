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

1. `node test/run.js` in the Facet repo (the core's own cases, 62 as of
   Basilisk Hide's evolution).
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
| `tests/zenkai.test.ts`, `tests/littleMoons.test.ts`, `tests/bramble.test.ts`, `tests/basiliskHide.test.ts`, `tests/basiliskEvolve.test.ts` | Each bank ability in this game: its rules, then a hunt in the real game loop. |

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
| What the sidebar shows | Only what acts on you now: a cell with a `show` hint whose carrier status has modifiers (`acts` in `facetReadouts`), while its value is not zero. Sunpower always, Zenkai once earned, Thorns and Standing statues during a fight. Counters (Fights fought, Boss kills, Statues), banks (Solar Charge) and `reading.inputs` stay off it; each line's tooltip lists them. Every shown cell's status is left out of the status chips. |
| The ✦ Ability tab | `AbilityPanel.svelte`, on the tab bar while `state.facets` holds a document. From `facetReadouts`: the document's `reading.desc`, every cell with a `show` hint and its status text, the inputs, the conditions its `status` effects apply (an inline `def`, or a host status by `defId`) with the condition each escalates into, and its evolution (a clause on `cell:<key>:cap` that emits `evolve`: the cell, its cap and the branches). A document saved before its bank entry had a `desc` takes the description of the bank entry with the same name. |
| Evolving | The core's `evolve` effect writes the offer (bank keys) onto the document, so it is saved with it. While a document holds one, play holds as it does for the keeper's dare (`Game.tick`, `pendingEvolution` in host.ts) and the held time is banked as bonus time. `EvolveModal.svelte` shows the branches from their `reading`; `chooseEvolution` asks the core for the branch (`Facet.evolve`: a copy of the bank entry with every cell the two share carried over) and puts it in the old one's place. |

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
that deals their sum ×2 (two moons) or ×5 (three). They cost nothing: the
approved entry charged 2 mana a second, and the user removed it on 2026-11-03
("feels unfun to use"; a mana drain may come back as an evolution). They run
only in fights and start each fight from zero. The user approved it with "might
need to tweak numbers" (team ability R3-SKY-19, 2026-11-01); the readings taken
where the entry is silent are written above the document in the Facet bank. Its counting
cells say `carrier: false`, so they hold no status and never move the derived
stat cache, which would otherwise rebuild on every combat tick. To try it:
Grant 🌙 Little Moons and hunt; the feed shows one running line of strikes
per fight. A document granted before 2026-11-03 still carries the mana cost
(a held ability is a copy of the bank entry taken at grant): grant it again.

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

**Basilisk Hide** is the fifth, and the first that puts a condition on an
enemy. Each enemy blow puts Stone on its attacker: 6 + CON / 10 a hit, a
flat 1.5 on the spot's boss. Stone is Earth, so the enemy's Earth resistance
cuts it, and it names a CON contest (`StatusDef.contest`): an enemy with more
CON than you takes it × yours ÷ its, never below the application floor.
Stone slows the enemy 0.5% a point (half the approved "same percent"; the
user halved it 2026-11-02) and at 100 escalates into `petrified`, this
game's statue (statuses.data.ts). A statue does nothing (combat.ts
`isStatue` skips its turn). Left alone, its Petrified runs out after 3
seconds and it crumbles away; broken before then (killed while Petrified),
it throws its max HP as rocks at the living enemies behind it, half
Piercing and half Slashing (`throwRubble`), and `onKill` sweeps what the
rocks killed before it looks for survivors. Either way it pays Stone Chunks
worth half its gold and half its XP, and drops nothing else. The user
approved it as team ability ENM-18 with a note (resistance, the lingering
statue, the rocks); the readings are written above the document in the
Facet bank.

Basilisk Hide is also the first ability that **evolves**. A dose that turns
an enemy to stone raises `statue` (host.ts `applyStatus`), and the document
counts it when the enemy stood at 85% of your level or 85% of your attribute
total or more. At 100 (a placeholder) play holds on a pick of three branches,
final for the run; each keeps the count:

- **Gorgon's Gaze**: each second of a fight the front enemy gains 2 + CON / 50
  Stone, a quarter on the spot's boss (the dose reads `fighter.boss` on its
  target). Blows add half the base dose. When an enemy turns to stone, the
  next front enemy takes 25 (a quarter on a boss).
- **Rubble**: rocks raise `rocks` for each enemy they hit, and the document
  puts 15 Stone on it. Its statue is `petrified_rubble`: left alone it bursts
  for half the rocks when it would crumble, and it pays no Stone Chunks.
- **Stoneskin**: its statue is `petrified_standing`. It stays until the fight
  ends and never holds the centre slot (combat.ts `standAside` trades it for a
  fighting enemy), so your blows pass it by; it throws no rocks. When only
  standing statues remain the fight is won and they crumble, paying Chunks.
  Each statue in the fight (`world.statues`) raises your armour 10%.

A branch picks its statue through Stone's `escalatesTo`; how each statue
leaves is its `StatusDef.statue` rule (rocks, burst, chunks, xp, stands),
which combat.ts `onKill` reads. Statues are not targets for abilities
(`resolve` skips them). Measured at floor 17 over 10 minutes, every statue
counted: standing still at attributes 30, 10; CON 60 with the other
attributes at 5, fighting, 10; CON 60 with the rest at 10, 2; even builds,
none. At 100 a CON build evolves after about 100 minutes there. To try it:
Grant 🗿 Basilisk Hide, press Statues to 99, and let an enemy near your level
hit you until it turns to stone. The debug panel also grants each branch.

**Weakest Weapon Master** is the sixth, and the user's own (2026-09-26 card,
docs/plans/ability-weakest-weapon-master.md; choices taken 2026-11-03: all
four stances at once, ceiling 20, XP past it priced like real levels, rungs
past 10,000 give power and cooldown only). Most of it is game rules the
document switches on through its carriers' status fields:

| Piece | Where |
|---|---|
| The ceiling | Cell `ceiling` (20) carries `attrCeiling`. attributes.ts `formulaAttrFrom` holds every formula read at the ceiling: computeDerivedStats, statBreakdown, unarmed damage, telekinesis grip, the fast's hunger, bestiary insight, activity factors, mutagen scaling. Gates, item requirements, contests and dynamic monster levels read the real value (`attrValue`, `finalAttributes`). Trained-rank perks still read trained levels. The sidebar shows a capped attribute as the ceiling alone (`20`, accent colour); its hover adds the real value gates read (format.ts `attrTipLines`, user 2026-11-03: too many numbers on the row). |
| XP past the ceiling | The ceiling also carries `routeExcess`. host.ts `routeAttrXp`, registered with attributes.ts `setXpRouter`, takes any grant for an attribute whose real value is at or above the ceiling: the XP goes to the document's `past_<attr>` cell and the attribute does not train. Cell `hidden` is set to the levels that XP buys from the ceiling up on the attribute curve (`levelsPast`). |
| Reps | Cell `reps` carries `repMult` and `drillsAll`. martial.ts `recordExecution` adds round(reps) per execution, at least 1, for every slotted technique; the drill slots are not used. 2 x 32^min(1, combat skill levels / 600): x2 at 0, x64 at 600. Written at execution, so rungs stay when the ability goes. |
| Rungs past 10,000 | Every build, not only this ability: martial.ts `rungThreshold`, `masteryTier` up to `MAX_MASTERY_TIER` (15, 10^15 reps). Each rung past Perfected doubles damageMult and preventedMult (a defensive form's buff duration instead) and takes the cooldown x0.9, floor 10 ticks. Named Beyond I, Beyond II and so on. |
| Power | 0.4 x `ksg.martialTotal` + 0.0005 x `ksg.techniqueTotal` + 2 x hidden levels, set on every combat tick and game minute. |
| Stances | `reading.choice`: the Combat tab draws a four-button row under the stance grid (CombatPanel.svelte); `chooseFacetOption` writes cell `want`, and the document copies it into `stance` at the player's next bar fill (event `barFill`), or at once out of a fight. Cells `power`, `flowing`, `heavy`, `empty` hold Power while that stance is in effect and `ksg.melee` is 1, else 0. |
| Power stance | Carrier mod `fighter.damage` add 1 x Power. |
| Flowing | Carrier `parryContest` { per 2, answer 0.6 }. combat.ts parry: chance max(standing parry capped at 50%, Power / (2 x the blow's weight)), up to 100%; the answer is 0.6 x Power instead of the riposte. |
| Heavy | Carrier `blowCut` { rattle 2/3 }. combat.ts cuts each enemy hit by Power after any counter and before armour. A hit cut to 0 lands nothing; when all are, the exchange is not a hit (no hitTaken, no on-hit effects). The attacker gets `rattled` (statuses.data.ts): speed x(1 - intensity), intensity = share cut x 2/3, removed at its bar fill. |
| Empty | Carrier mod `fighter.damage` add 0.6 x Power, and `pureBlows`. combat.ts: a weapon blow (not a spell or gene active) cannot be dodged and lands at its raw size, past armour, resistance and weakness. |

Monster workings bypass parry and counters already, and they bypass Flowing
and Heavy too. Power's weights, the x2..x64 curve and the ceiling are
placeholders. To try it: Grant 🥋 Weakest Weapon Master, then pick a stance on
the Combat tab.

**Calorie Burn** is the seventh, also the user's (2026-09-26 card,
docs/plans/ability-calorie-burn.md; choices taken 2026-11-03: peak bonus
+100% growing with the store, full-store penalty -10%, calories from Well Fed,
running dry at a 0% cutoff is a knockout). The document holds the rules; the
game supplies calories, the trained body and the defeat.

| Piece | Where |
|---|---|
| Calories | consumables.ts `dishCalories`: 400 per point of Well Fed a dish grants, 100 for a dish with none, times the grade; a spoiled grade and non-food give 0. `useConsumable` raises `eat` with them, so queued eating counts too. |
| The store | Cell `kcal`, cap 400 + 30 x `ksg.trainedBody` (trained CON + STR, no bonuses). |
| Too full | Cell `sated` in percent points, 0 at 70% full to 10 at 100%; carrier: every attribute x(1 - 1% per point). |
| The burn | Only once the fight turns dangerous (user 2026-11-03): HP at 67% of max or less, or 20 s of fight time; cell `danger` holds it for the rest of the fight. Then per combat tick while the store is above the cutoff: 0.25 + 0.015 per second since the burn started (cell `bticks`), at most 4. Cell `fburn` counts this fight's burn. |
| The bonus | Cell `burning` in percent points: 0 below 30% of the cap burned this fight, then (e^5x - 1)/(e^5 - 1) to the peak at 100%. The peak is +100% at a cap of 400, x1.25 each time the cap doubles. Carrier: every attribute x(1 + 1% per point). Resets with the fight. |
| The cutoff | `reading.choice` (0%, 10% default, 25%), drawn on the Combat tab under the stance grid. Applies at once. |
| Max HP | After 90 s of fight time, cell `debt` grows 0.4 a tick; carrier: max HP -1 per point. Out of a fight it returns 0.05 a game minute, 25 while the store is full; the store digests 0.5 a minute only while nothing is owed. |
| The collapse | When `debt` reaches 9 x the max HP left (90% burned), the document emits `defeat` with outcome `knocked_out` (user 2026-11-03: "Make it a knockout"; it had been a death). host.ts marks the fight (`CombatState.fallen`); combat.ts settles it after the ability's tick with `onDefeat(state, bus, outcome, cause)`, and the defeat window shows the cause (`FightLedger.cause`). `defeat` can also end a fight as `dead`, a death with knockout consequences; nothing uses that yet. |
| Running dry | At the 0% cutoff, once this fight's burn has emptied the store, max HP burns 2 more a tick (5 times the long-fight rate) until the collapse (user 2026-11-03: no knockout at 0%). An empty store at a fight's start burns nothing, so it never runs dry. |

The numbers are placeholders. To try it: Grant 🔥 Calorie Burn, eat a few
dishes, and fight something that lasts.

**Shadow Clone** is the eighth (team ability GEN-18, the user's note:
"absolutely. no question asked. killer ability."), and the first that works
outside a fight. Rebuilt the same day on the user's redesign: clones are
deployed. Each works one task until a new clone replaces it (the oldest goes
when every clone is out), it is recalled, the player stands more than
max(0, floor((level - 10) / 5)) floors away (Threshold and the base are floor
0, the ascent's first floor 1), or the player is knocked out by anything.
Hits do not end them.

| Piece | Where |
|---|---|
| The clones | The game's, not the document's: `GameState.clones` (`CloneJob`: spot, an activity or a bench layout, progress, order), worked by systems/clones.ts `tickClones` each game tick, travel included. Older saves have none (deserialize backfills it). |
| The numbers | The document's one cell, `clones`: its cap is the most out at once (1 + 1 per 10 character levels, max 5), its status's `cloneYield` (0.4) and `cloneXp` (0.25) the shares, its value the count the game writes, which the carrier turns into max mana -5% per clone. host.ts `cloneRulesOf` and `syncCloneCount`, registered through `setCloneHost`. |
| Jobs and gathering | `sendCloneToActivity` (a "👥 Clone: <task>" button beside each job and gathering activity). The clone keeps the player's pace (activityFillRate) and yields 40% of the materials or pay, with 25% of the skill XP and no attribute XP. |
| Benches | `sendCloneToBench` ("👥 Send a clone" on the bench and anvil panels) copies the layout. Each pass takes the bench's time divided by 0.4 and makes whole crafts from the player's stock (benchwork.ts `cloneCraft`), at 25% skill XP (skills.ts `scaledSkillXp`). Short of stock it waits for the next pass. |
| The end rules | `tickClones`: no ability, all go; `state.recovering` (every knockout sets it), all go; more out than the cap, the oldest go; too many floors away (`floorOfSpot`, `cloneReach`), that clone goes; an activity that no longer exists, that clone goes. |
| Recall | The Ability tab lists the clones at work with Recall per clone and Recall all. |

To try it: Grant 👥 Shadow Clone, go to a job (The Alembics: Wash Out the
Retorts) and press 👥 Clone: Wash Out the Retorts.

### Enemies as refs

A document aims at enemies through scopes, and the adapter names each enemy
by its slot: `foe:0` is the front enemy, `foe:1` the next. A ref lives for one
call, because slots move when the front enemy dies. `resolve` answers
`side: 'enemy'` (living enemies, front first, so `n: 1` is the front enemy) and
`side: 'arena'` (the player and every enemy). The status members reach the
enemy a ref names, so a document can put a condition on one. Statues are left
out of `resolve`. An enemy's numbers are not quantities until K4: `readQ` on a
`foe:` ref answers `fighter.boss` (1 for the spot's boss) and `fighter.level`,
and 0 for anything else. A status dose is read per target, so
`{ q: 'fighter.boss', on: 'target' }` in its intensity reads the enemy it lands on.

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
| `hitTaken` | health.ts `damagePlayer`, the one door every blow uses | `amount` (what reached HP), `blow` (the blow as thrown, before armour, resistance and ward; `amount` when nothing was thrown), `type` (`'none'` when untyped), `attacker` (the enemy's ref, `''` for a condition, a trap or your own backlash), `self` (1 for a spell you cast on yourself), `boss` (1 when the attacker is the spot's boss) |
| `hit`, `crit`, `dodge`, `parry`, `graze`, `enemyCast` | combat.ts `markCombatEvent` | |
| `flaskUsed` | `Game.useFlask` | |
| `itemUsed` | `Game.useConsumable` | |
| `miracleCast` | combat.ts, when a miracle is cast | |
| `statue` | host.ts `applyStatus`, when an ability's dose turns an enemy to stone | `target` (its ref), `level`, `levelShare` (its level ÷ yours), `attrShare` (its attribute total ÷ yours), `boss` |
| `rocks` | combat.ts `throwRubble`, once per enemy the rocks hit | `target` (its ref), `amount` |
| `barFill` | combat.ts, when the player's action bar fills, before the action | |
| `eat` | consumables.ts `useConsumable`, for food | `calories` (`dishCalories`) |

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
when an attacker is named. This game always sends `type`, `attacker`,
`self` and `boss`.

A document may define a condition (`emit: 'status'` with a `def`). The
fields this game accepts are host.ts `STATUS_SCHEMA`: `mods`, `duration`,
`hidden`, `stacking`, `desc`, `overrideRes`, and since Basilisk Hide
`element`, `contest` and `escalatesTo`. Anything else is dropped at compile.

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
| `world.statues` | statues in the player's fight (Stoneskin); 0 out of one |
| `ksg.martialTotal` | the summed level of every combat skill |
| `ksg.techniqueTotal` | reps recorded across every technique |
| `ksg.melee` | 1 unless an item tagged `ranged` is equipped |
| `ksg.trainedBody` | trained CON + STR levels, without bonuses (Calorie Burn's store) |
| `fighter.level` | character level; on an enemy, its level |
| `fighter.boss` | 0 for the player; on an enemy, 1 for the spot's boss |
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
