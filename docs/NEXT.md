# In flight — handoff

Live scratchpad for work that is designed but not finished. Delete a section
once it ships and the real docs cover it. Everything here was agreed in
conversation; the specs are the user's, written down so they survive a new chat.

Current save version: **48** (v41 added music: `compositions` +
`performance`; v42 stamped meters onto sheets — the grid also went 48 → 240
units/bar, save-transparently, since notes store duration ids; v43 added
repeat spans; v44 added tempo; v45 added the pedal tone; v46 added `mercy`,
the drought ledger; v47 and v48 add no fields at all — v47 stamps the five
`flag:unlock_*` subsystem shutters open on older saves, v48 the full arcane
lexicon and pantheon; see plans/alpha-scope-locks.md).
`npm run verify` must be green before anything here is called done.

---

## Shipped recently (context, not TODO)

- **Shops (2026-09-12, no save change) — `systems/shops.ts`, CONTENT_GUIDE §4
  "NPC + quest" → Shop.** A vendor is an NPC with `shop.lines`; stock is
  data, prices derive from `value` × `BUY_MARKUP` (2), strangers pay
  `STRANGER_MARKUP` (×1.5) more until `talkTo` stamps `met:` — the hello IS
  the discount. Law, test-locked (tests/shops.test.ts): **no arbitrage** —
  buy price is never below the best possible resale + 1, at any charisma,
  with rune slots priced at their best roll and `price` overrides floored
  the same way. Six counters in Threshold: the smith, alchemist and chef
  sell their bench's INPUTS; three new gate NPCs (outfitter, apothecary,
  provisioner — placeholder prose) sell gear, healing and dishes. Gated
  lines (`requires`) put the outfitter's second rack out on
  `boss:f1_toll_hall`. Counters: `gold:spent`, `shop:buys`,
  `shop:buys:<npcId>`. Open: the forge NpcInspector does not edit `shop`
  yet (data survives its writes); stock limits/restock deliberately absent.

- **Prestige (save v50, 2026-09-12) — docs/PRESTIGE.md.** The harvest
  re-climb: band 1 cleared opens the tab; `harvest` is the one function the
  preview and the reset both read; the post-prestige overlay is save state
  (`prestige.review`) and closes only once a point is spent or leaving is
  confirmed. Boons are the three hooks that already existed (start gold,
  skill ceilings, grimoire pages). Numbers are first guesses; the designed
  boon set waits on base building. The countryside was SHELVED the same
  day (save v49, LONGTERM.md) and the hold moved to its own map behind
  `prestige:count ≥ 1`.

- **Droughts are over** (`engine/mercy.ts`, save v46). Any roll under 15% —
  drop-table entries, rare encounter lines, monster modifier, monster rarity,
  and the gene/mutagen/nuclease harvest — climbs with every miss and resets on
  a hit, with `base` and `slope` SOLVED per rate so the authored weight still
  means exactly what it says. The wolf fang blade's worst run over 400k kills
  falls from 870 kills to 360; its rate stays 1%. Silent by design: no UI, no
  counter, no hint. Two things to know before touching it — the median wait
  gets *longer* (the mean is pinned, so the tail has to come from somewhere)
  and a drop listed twice in one table would escalate twice, which both
  validation layers now reject. Numbers and the dial: **ENGINEERING.md §3**.
- **Crits too, mirrored** (`procChance`, both sides of the swing). Dota's PRD
  is a proc system first, so crit rolls run through the same solver — but the
  threshold **inverts**: a proc is smoothed only at 15% and UP, because a
  fight is a dozen swings and below that rate the cold start makes short dry
  spells *worse*, not better (at 5% crit, an 8-swing drought goes 66% → 84%).
  The 5%-floor player is untouched; smoothing arrives around DEX 67. The
  counter persists (per-fight would silently cut a 20% crit to 17% over
  ten-swing fights) and is capped at `min(3× rate, 75%)` so it cannot be
  bought by warming up on the training dummy. Dodge, parry and the miss roll
  are the same lane and one line each, deliberately not wired yet.
- **Every arcane word is a skill** (`data/wordskills.data.ts`, generated —
  never hand-write one; adding a word adds its skill). Practice is a separate
  axis from mastery: mastery says what you may *fold*, practice says how hard
  the word *lands*. +1.5%/level, compounding across a clause's noun/verb/
  adverbs; milestones at 10/25/45 give the word's own nature back
  (spark → speed, stone → armor, gust → dodge…). XP is logarithmic in what
  the working cost. Levels enter via `resolveSpellFor` and `checkSentence`,
  never the cache. Full spec: **ARCANE.md §4a**, including the parent-chain
  wiring trap.
- **The grimoire grew.** `MAX_PREPARED` → `BASE_PREPARED = 3` plus
  `preparedCap(state)`: one more page per `PREPARED_PER_LEVELS = 20` levels of
  *each* school skill (Arcana / Psionics / Devotion, counted separately; their
  shared `magic` parent is deliberately not counted, or the same study would
  pay twice). Quests and skills are meant to add to this too.

- **Approach bonuses + surprised's teeth.** `Connection.approach`
  (`{ requires?, enemies?, self? }`, directional, never mirrored) stamps
  `state.pendingApproach` on arrival; the first encounter at that spot
  consumes it before anyone swings. `surprised` now works:
  `StatusDef.incomingBite` (+30%/intensity on the next blow, spent by the
  existing `damageTaken` removal, applied exactly where `damageTaken` events
  fire) and `StatusDef.opensTempo` (fight opening on surprised enemies starts
  the player's bar one tick short of full). Both are declarative StatusDef
  fields — any status can carry them. See CONTENT_GUIDE.
- **Finite fights.** `SpotEncounter.requires` / `.once`
  (`slain:<spot>:<monster>` counters, recorded at the kill, filtered at roll
  time including escort fills) and `SpotDef.fightLimit` (wins counted under
  `fights:<spot>`; at the limit the spot is CLEARED — hunts find no one, a
  forced spot stops forcing, warnings drop, the auto-router reopens).
- **Flags.** `SpotFind.stat` — `{ key: 'flag:x' }` bumps, `{ key, set }`
  overwrites; `set` may target `slain:*`/`fights:*`, which is how content
  resets a once-boss or restocks a cleared spot. Namespace linted in both
  validation layers.
- **Forced, unfleeable fights.** `SpotDef.forced` / `Connection.forced`.
  Fight spawns on arrival, ticks regardless of activity, refuses every way
  out; losing calls `retreatToSafety`; ambushed arrivals never register the
  ambush site as a haven. Warned on map edges + travel buttons. **2026-09-12:
  EVERY knockout now retreats to the last haven stood in** (forced or not),
  each tower landing carries a camp so a fall on a floor lands on that
  floor, and the never-nowhere fallback is the start (the Foot) rather than
  data order. **Still open:** does losing cost anything beyond the retreat
  (knocked-out/dead failure states, `[[project-planned-systems]]`)? Reload-mid-fight skips it —
  accepted; a `fightLimit` guardian den closes the loop for spots that matter.
- **Havens.** `rest` + `requires`; `state.safeSpots`; `systems/safety.ts`.
- **Forge rename**, gated exploration (`SpotFind.requires`, `exploreGates`),
  scoped stats, recipe `alts`, `Connection.returnLabel`.
- **World Atlas** (forge): drag-to-pin regions writes `RegionDef.world`;
  amber warnings when pins disagree with cross-region travel edges or overlap.
  See FORGE.md §The world atlas and section 2 below.
- **Being out cold is time passing.** Status clocks run at
  `UNCONSCIOUS_CLOCK_RATE` (5×, actions.ts) while `recovering` — clocks only,
  the damage stays at its per-tick rate. You wake at 60% health, so at 1× a rot
  with most of its 45s left just floored you again on the way up, repeatedly,
  until it expired. Measured at the light end (intensity 5): rose at tick 176
  with 274 ticks of rot still owed and went straight back down; now rises at 109
  with it gone. Heavy doses cut time on the floor from ~487 ticks to ~127.
- **A knockout is a floor** (`stillOnTheFloor`, actions.ts). A condition that
  finishes someone already down now only pins them at 1 hp. It used to re-run
  the whole knockout every tick: a wall of "finishes you" lines, health stuck at
  1 (the caller's `return` skipped the recovery regen), and — worst — a fresh
  `ensureLedger` tally promoted over `lastFight` each tick, so the defeat window
  showed one tick of rot instead of the fight that actually felled you.
- **Every fight ends through `closeCombat`** (combat.ts). `combatEnd` used to
  fire only from `abandonCombat`, so winning or being knocked out left a
  `dazed`/`shocked` on you permanently — their only exits, `barFill` and
  `barDeplete`, fire nowhere but `tickCombat`. Both now also exit on
  `combatEnd`, and a linter rule (both layers) rejects any timerless condition
  whose every exit is combat-only. `closeCombat` runs *before* `endFight` so
  the ledger's "Still on you" list is what you actually walk away carrying.

**First real consumers landed 2026-09-06** — band 1 of the tower uses a
`forced` spot (the Broken Cistern), two `once` bosses (the toll collector,
the brood queen) and a `fightLimit` budget that doubles as a floor clear.
Approaches and encounter `requires` still have no consumer; the Malgeri stubs
remain the natural place once the world reopens. Forge support:
forced/fightLimit/once have inspector UI; `approach` and encounter `requires`
are displayed and validated but edited in the data file.

---

## 0. The tower — chassis SHIPPED 2026-08-10, content open  ← start here

> **The alpha push lives in [plans/alpha-band-one.md](plans/alpha-band-one.md)**
> and its four story cards. As of 2026-09-06 the tower RUNTIME, three band-1
> floors, and the alpha scope locks are BUILT (save v47, verify green, in
> review); the district quest chains wait on the user's list. The ascent went
> **sequential** — see the epic for the three answers that reshaped this
> section's rules.

Vertical content, and the reason it exists: **authoring atomicity.** A floor
declares one required connection and nothing else, so adding one never means
reasoning about the world in total. That was the whole motivation — the
kitchen sink's standing problem is making wildly disparate areas cohere, and a
tower's answer is that they don't have to. Floor 30 a drowned city and floor 31
a library is not a contradiction; it is a tower.

### What shipped

- **Registry** — `TowerDef` / `BandDef` / `FloorDef` in types.ts,
  `data/towers.data.ts`, re-exported from registry.ts, three entries in the
  forge catalog, `KEY_ORDER` in print.ts, `gate` in `LIST_TEMPLATES`.
  Helpers: `FLOOR_BY_AREA`, `floorsInBand`, `bandsOf`.
- **A floor IS an area.** `FloorDef.areaId` names the AreaDef whose spots make
  it up, so travel, exploration, encounters, benches, the forge map editor and
  every existing world lint work on floors with no new machinery. This is the
  single decision that made the rest cheap.
- **Threshold** — the starting city. One region, eight districts in a ring,
  25 spots, each district with its own labelled road to `ascent_foot` at the
  centre and joined to its two neighbours. Districts carry **signature**
  subsystems, never monopolies: scholars/arcane, temple/divine,
  ironyard/martial (wuxia later), alembic row/alchemy+mutagens, chancery,
  assize/law, wrights/crafting, granaries/resources.
- **`STARTING_SPOT = 'ascent_foot'`.** The countryside the old `my_home`
  start sat in is SHELVED (2026-09-12, LONGTERM.md §"The countryside"); saves
  standing out there wake at the Foot (save v49).
- **The player base is its own map.** `player_base_v1_area` lives in the
  `the_hold` region (name and atlas pin are placeholders), reached through
  the door at the Foot, which carries `requires: [prestige:count ≥ 1]` —
  shut until the first prestige, outbound-only like every `requires`. It was
  a floor of the tower (`ascent_hold`) from 2026-08-10 to 2026-09-12; the
  user moved it out. `FloorDef.personal` / `.persists` remain as declarations
  for the prestige system to honour.
- **Eight lints** (`content.test.ts`, mutation-tested): hub/band/area
  referential integrity, contiguous band indexes, one floor per area, personal
  floors off the ladder, no band asking more clears than it has floors, and
  **no band entirely gated on named disciplines**.

### The rules the structure rests on

- **The band is the disjunction.** `conditionsMet` is a pure AND with no `any`,
  so alternatives live in the topology — several floors per band, each with a
  flat gate, `clearsToAdvance` of them opening the next. Do NOT grow the
  predicate language to fix this; the band already is the fix.
- **Stacks are a second disjunction.** Bands are per-stack, so a player walled
  on one ladder always has another open. Several stacks may share a hub.
- **Gate taxonomy.** Prefer accumulation — gold, quest counts, discovery
  counts, skill totals. Those accrue from acting at all. A gate naming one
  discipline is legal only beside a band sibling that names none. ⚠️ Quest
  gates are the one kind that strains the inattentive player: they require
  intention where everything else accrues.
- **Visibility, not difficulty, is the tower/dungeon split.** `foreknown` says
  whether floors ahead are visible before they open. A tower is a goalpost; a
  dungeon is a discovery. `direction` is only the word for it.
- **Three closure rules** (they compose — see the header comment in
  towers.data.ts): hidden *access* is never on a critical path though hidden
  *contents* are always fine; every lateral edge must be legal to delete;
  optional is computed from the critical-path closure, never declared.

### Open

- ~~No floors on the ladder~~ **Band 1 has three floors (2026-09-06,
  plans/alpha-band-one-floors.md)** — sequential ascent, `FloorDef.clear`,
  `climbTo`, the AscentPanel ladder. The runtime the registry waited for is
  `systems/towers.ts`. Bands 2–3 are still empty scaffolding, and
  `clearsToAdvance` is now UNREAD (the sequential decision retired it —
  fate undecided, flagged in types.ts).
- ~~Two lints cannot be written~~ **Landed in sequential form**: "hidden
  access never on a critical path" became *banded floor areas are closed*
  (the ladder is the only door), in both validation layers.
- **Cleared floors as idle nodes.** The agreed answer to the active-clear vs
  idle-loop conflict: a cleared floor becomes assignable and feeds the idle
  loop, which is also the scaling gold source base-building sinks want.
  Accumulation gates already make the tower advance offline; this makes it
  *pay* offline. Not built.
- **Threshold speaks with nine voices (2026-09-06,
  plans/alpha-threshold-quests.md).** The user's first quest list is built:
  the Warden's talk-chain (meet the nine trades — `talk` objectives on the
  new `met:*` counters) and the seven-system familiarization quest (`stat` +
  discipline-`craft` objectives, the caged menagerie, the starter lexicon and
  the two known gods). All prose is placeholder awaiting recaption; the
  goldfish closes the chain on seed 42 inside Threshold. Future district
  chains land in the same card.
- **The hold's weather question is still open.** The old SPEC ("exposed at
  first, upgradeable to fully sheltered"); `sheltered: true` carried over
  unchanged to the `the_hold` region so nothing shifted silently — TODO on
  the region entry.
- **Names are placeholders.** Threshold, The Ascent, and all eight district
  names rename cleanly in the forge (id rename rewrites every reference).

---

## 2. Time & weather (steps 1–3 SHIPPED; events/UI remain)

**Shipped 2026-08-04** — see **docs/WEATHER.md** for the full spec of what
exists. In brief: the calendar (13 × 28 + 4 holy days outside the week,
seasons centred on them, `clockOf(state.totalTicks)` in systems/clock.ts);
climate baselines (`RegionDef.terrain` + `sheltered`, latitude from the atlas
pin, knobs in data/climate.data.ts); the unit-variance anomaly field and
`weatherAt(seed, region, ticks)` with classification (systems/weather.ts);
and the atlas **Sky** overlay (day/hour scrubber against the real functions).
No save change: seed = hash(createdAt), clock = totalTicks. Tests:
tests/clock.test.ts, tests/weather.test.ts.

**Still open, deliberately:**

- **Month/weekday names** are scaffolding in climate.data.ts (TODO-marked) —
  lore is the user's.
- **Terrain calls to confirm** (TODO notes on the region entries): westlands,
  stillail_hamlet, and whether the player base yard feels weather.
- ~~Player-facing clock~~ **Chronosense shipped** (skill + header chip, see
  WEATHER.md), including its **level-20 ceiling** (XP discarded at MAX) and
  the time-resistance curve for raised levels (`timePenaltyMult`, 67% at
  100). The WEATHER-reading UI is still open. The user's stated purpose:
  after the first two or three prestiges, **time-gated events** arrive,
  surfaced through the player base's **hint system** (not yet built) — hints
  will name dates, and Chronosense is what makes dates readable.
- **Cap-raise sources are not wired**: `raiseSkillCap(state, bus, id, by)`
  exists and is tested, but no quest reward kind, event, or prestige effect
  calls it yet — that's content plumbing for when those systems land. Nothing
  consumes `timePenaltyMult` yet either; it is the mandatory hook for any
  future time-based penalty.
- **Weather as a mod source** — gameplay hooks (travel tick multipliers
  first). RULE: modifiers key on the bucket (`kind` + temperature `band`),
  and the bucket joins the derived-stats `modFingerprint`. NOTE: exposure XP
  and the darkness combat penalty (shipped — see WEATHER.md §Exposure) stay
  OUTSIDE the derived-stats block on purpose (XP grants + roll-time factors,
  same lane as `requiresMonsterTag`), so no fingerprint change was needed.
- The Azgaar **cells GeoJSON** (user's Downloads) still waits on the map
  being final — then derive terrain/baselines from cells under each pin.

**Named events: detected, not rolled — NOT built yet.** A named event is a
connected blob in (space × time) where |anomaly| ≥ threshold. Rules agreed:

- **Threshold from incidence, not σ.** Target ≤1% incidence; bake the 99th
  percentile per phenomenon at build time from a few sampled centuries (summed
  noise octaves are not Gaussian in the tails — don't use σ tables). Retune
  the field ⇒ re-bake, still 1%.
- The 1% arrives in **clumps** sized by the top octave's time wavelength —
  slow field + high threshold = rare-and-sustained. Hysteresis (enter high,
  exit lower) so events don't flicker.
- **Integrated severity** (accumulated excess over threshold × duration ×
  extent) ranks events; only the top tier earns a name. This is the
  "how mythic is the world" knob.
- **Names are deterministic**: hash (seed, start tick, origin region,
  phenomenon) → picks from a name-parts registry (catalog.ts + registry.ts
  re-export; `ARCANE_WORDS` is the shape to copy). Calendar surname for free:
  "the Howling of Late Embermonth" is also a timestamp.
- **Generator vs chronicle.** Everything derived rewrites history if the field
  is ever retuned — so *witnessed* events freeze a small record into the save
  (name, dates, regions, peak). Future weather stays derived; experienced
  weather becomes history. Almanac UI + "vintage" hooks (brews bottled during
  a named event) fall out of this.
- **Honest forecasting**: the field's future is computable, so
  divination/deity weather prophecy is a real mechanic, not flavor.
- Both tails are content: −2.5σ is as rare as +2.5σ — name the good weather
  too, and the same event can be bane in one system and boon in another.

**Engineering cautions.** Weather affecting stats = a **new mod source ⇒ add
to the derived-stats `modFingerprint`**, and quantize weather into buckets
(fingerprint the bucket, not the float) or the memo thrashes every game
minute. Cheapest felt hook: weather multiplies travel edge ticks.

**Build order:** (2) climate baselines + seasonal shading overlay on the
World Atlas (month scrubber — the forge's `ssrLoadModule` design means the
atlas can call the real climate function); (3) anomaly field + time scrubber;
then the tick-ratio constant + calendar function; events/naming/chronicle
last.

---

## Parked: blueprint weaponsmithing (idea, not scheduled)

Weapon crafting as a **shape grammar**: nobody selects "dagger" from a menu.
A blueprint fixes the general shape (sword, polearm), the *dimensions* of the
parts you fit determine what the thing IS — tiny blade on a sword frame → a
dagger, short → shortsword, medium → longsword, large → two-hander; long stick
+ short blade → spear, + medium blade → glaive, short stick + long blade →
lance. Materials keep doing what they do everywhere else (stats/quality);
dimensions do the new work (taxonomy). Distinct crafting identity from the
existing set — sum (cooking), when (stove), sequence (alchemy), topology
(mutagens), breadth (runecarving) — this one is *the proportions name the
product*.

Rules agreed when parking it:

- **The resolution function must be total.** Every dimension combo yields
  *something*, degenerate combos included (long stick + no blade = quarterstaff;
  the game dryly names the cursed ones). If bad combos just fail, it collapses
  into hidden recipes, i.e. runecarving-with-metal, and isn't worth building.
- **Discovery replaces unlocks.** No pattern-knowledge gate; the archetype
  chart fills in as combos are tried — a free collection layer.
- **Reuse the disciplines chassis** (slots/placements/tool/quality — same
  framework as runecarving): blueprint where the slab goes, parts where
  patterns go. The chassis is shared; the identity is not.
- **Economy (partly settled).** Weapons today come from drops and from basic
  forge recipes. The basic recipes get absorbed: a basic recipe is just a
  blueprint with fixed proportions, i.e. the tutorial tier of this system.
- **Materials carry tactical tags, not just stats.** Iron haft instead of wood
  → quarterstaff good against armored/inorganic targets. Not a new system —
  an affinity field on the material definition, same lane as stats.
- **Process layer (idea on the idea): repeated verbs as a new identity —
  *count*.** "Keep hammering" → serrated edge (bonus vs living scaled by how
  little armor), "keep sharpening" → razor edge (heavy bleed). A finishing
  stage after assembly that accumulates a verb counter map
  (`hammer: n, sharpen: m`) resolved at completion. Two rules keep it a
  distinct identity: **order-insensitive** (or it poaches alchemy's sequence)
  and **verbs antagonistic** (hammering coarsens what sharpening polished, so
  the ratio is the decision and "more of everything" is never optimal).
  Count fills an empty slot in the identity table: sum / when / sequence /
  topology / breadth / proportion / count. UI prior art: cooking's stove
  timeline (count-driven here, not timing-driven, so no overlap with "when").
  **Lane refinement so the drops rule survives:** process verbs grant a small
  closed set of *generic conditional finishes*; drops remain the only source
  of *named, unique* effects. Finishes are spice; souls are loot.
- **Prototype sketch (no blueprints — rework established weapons).** The eight
  verbs pair into four signed axes, and the counters ARE the state:
  hammer↔sharpen = **Edge** (serrated↔razor), fill↔hollow = **Heft**
  (weighted↔light), bend↔straighten = **Line** (curved↔true),
  segment↔fuse = **Body** (jointed↔solid). Net ±3 → finish tier 1, ±6 →
  tier 2. **Temper** = total verb applications a piece tolerates (~6 at C,
  scales with quality) — this is what makes antagonism cost: canceling burns
  temper, and quality buys breadth of finishing. Axis effects, all on
  existing hooks: serrated = bonus vs living scaled by *missing* armor;
  razor = inflicts `bleeding`; weighted = +damage/−speed/ignores armor;
  light = +speed +Deflection/riposte; curved = counter/riposte bonus;
  true = opening-blow bonus; jointed = harder to parry; solid = disarm
  resist (`ground` verb) + small armor. Materials are reachable regions:
  bronze loves hammer/bend/fuse, razor capped, refunds wasted temper
  (recast); iron does everything moderately (hollowing iron = cutting a
  fuller); wood can't be hammered, and *filling wood consumes a second
  material and inherits its tag* (the iron-cored quarterstaff); bone can't
  be hammered or bent (Line locked — it grew that shape), hollows at half
  cost, best bleed; crystal shatters if hammered (one blow destroys it —
  keep that), best razor, segments perfectly. Families don't gate axes —
  the same axis *expresses* differently (segmented blunt = flail, segmented
  staff = three-section, segmented sword = urumi; katana starts Curved +2;
  bow locks Line). Mechanically: a forge-bench job on an owned instance,
  verbs queued over idle ticks, net vector resolves to **affixes stamped on
  the instance uid** (coatings already target `weaponUid`; display/stat
  plumbing exists). Engineering: new mod source ⇒ add to derived-stats
  `modFingerprint`; verb/material matrix is a data table with the rule
  mirrored in both validation layers.
- **Open question, settle before building: bespoke weapons with special
  effects.** Leading candidate: *effects are transplantable parts* — breaking
  down a named weapon yields its effect as a component that can be slotted
  into a blueprint (re-house the effect, re-choose the form). Drops stay the
  only source of permanent effects (alchemy oils already own temporary ones),
  so the generator never obsoletes loot. Rejected: effects-from-exotic-
  materials (generator could reproduce named drops, killing their uniqueness)
  and sealed-bespoke (generator becomes a mid-game dead end). Not decided.

---

## Parked: the aberrant god of arcane magic (designed, not scheduled)

An aberrant deity in Ik'Thel'the's register — one the player must *set out to
find*, not one the pantheon hands over. **It grants no spells.** Its entire
scripture is two passive miracles, both of them edits to the grammar itself,
and they are mutually exclusive.

Arcana's ladder — practise a word, master it, fold it — is the *middle*. This
god's two answers both reject that middle: say a word once and mean it, or say
it until it stops being a word. It is not the god *of* arcane magic; it is the
god arcane magic is uneasy about.

### Identity (the user's, verbatim)

> **name:** yShicna'
> **title:** Logic Purified
> **description:** An aberrant god fascinated with the weight of words. It has
> no form and yet its words are spoken absolute. It offers the return of
> Meaning to its basic state but also desires to elevate the Sound of words
> that have become integral to one's soul.
> **tags:** aberrant, atomic, arcane, curious, warping, outer

The description is canonical and already encodes both gates: *"the return of
Meaning to its basic state"* is the atomic aura, *"words that have become
integral to one's soul"* is the 1000-utterance Sound. `offers` / `desires`
match the two entries exactly (see below — the verbs are load-bearing).

- Suggested id `yshicna` (the leading lowercase and trailing apostrophe are
  stylistic, and the display name carries them).
- **`atomic` is a NEW tag**; every tag a deity carries must be registered in
  `DEITY_TAGS`. It belongs in **temperament**, beside `zero` and `infinite` —
  which lands it in Ik'Thel'the's register of quantities-as-personality. Every
  other tag here already exists (`arcane` is a domain tag).
- **Relations: fully neutral against all seven current deities** — checked
  against every synergy and hostility rule; none names a tag yShicna' carries.

### Rule: outer gods are neutral wherever possible

Not a property of this god — a property of the group. **The outer gods do not
interface with other gods**, so they declare no synergies and no hostilities,
and any new one should default to the same. Ik'Thel'the already reads this way
("merely watching"). Cuixtli's synergy excludes `aberrant` outright, which is
all the distaste the mortal-facing gods need; nobody has to write a hostility
to say the world finds them unwholesome.

Two consequences already true in the code:

- **They render as a group by being ungrouped.** `deityGroups` collects
  pantheon-less deities into a trailing `pantheon: null` cluster, and `outer`
  is a *scope* tag, not a membership one. The "non-existent pantheon of outer
  gods" is literally how the data comes out today.
- **Neutrality is mechanically permissive.** The grimoire's hostility veto
  never fires for them, so an outer god's miracle pages beside anything.
  Accepted asymmetry: silence is a small advantage. If it ever needs a brake,
  the lever is not a hostility rule.

**Long-term endgame development (flagged, not scheduled): this changes.**
`deityRelation` is symmetric — `declares(a.hostilities, b) || declares(b.hostilities, a)`
— so the change is authored **entirely on the mortal gods' side** and the
outer gods are never edited. That is also the right direction narratively: not
yShicna' forming views about a hunting god, but the hunting gods noticing that
something has been editing the grammar.

### The seam that makes this safe

**Legality is state-dependent; the reading is not.** `checkSentence` already
decides what you may say (level gates, length caps, mastery) while
`composeArcane` stays pure — that is why the bench can parse a sentence you
cannot speak. Both miracles live *entirely* on the legality side. A fourth
fire reads identically for anyone who ever spoke one; you merely needed the
god's leave to get it out. Determinism, purity and the `SPELL_CACHE` key are
untouched. **Nothing here may move into the reading.**

### Miracle A — Excess (the fourth utterance)

Permission to speak a word a **fourth** time. Four is a hard ceiling, not a
rung: there is no escalation of "catastrophic", and nothing past four because
nothing is left to break.

- **The fourth is NOT on the stack curve.** `STACK_POWER` / `STACK_MANA` still
  stop at three. A fourth utterance *replaces* the working rather than
  multiplying it — fire ×4 is not 6× damage, it is "the field is burning now".
  There is therefore no superlinear curve to outrun the mana pool, and each
  fourth is costed by hand.
- **Every fourth is hand-authored per word**, like a miracle. An earlier idea
  of generating tier-4 names from a pattern is REJECTED — a fourth fire and a
  fourth crush have nothing mechanically in common. A word with no authored
  fourth simply cannot be overspoken, so the god's roster *is* the list of
  words it has opinions about, and the feature ships incrementally (three
  words is a real release).
- **Past three, a working stops being an effect and becomes a standing
  condition on the world.** It is no longer a thing you cast; it is a thing
  that is now true.
- **Each fourth breaks the invariant of the system it touches.** That is the
  authoring test for every new one: *what invariant does this word live
  inside, and what does it look like broken?*
- **The hazard is never self-damage.** It is loss of control and loss of
  spoils — burned loot, wounds that outlive the fight, spells you did not
  authorise. A splash tax is something the player routes around; this is not.

**Authored fourths (the user's, verbatim in intent):**

- **fire ×4** — burn everything: every combatant takes fire damage every tick,
  and loot has a chance of burning away. Sears become near-permanent, curable
  only by a long slow ritual. *(Breaks: statuses are temporary.)*
- **twice ×4** — repeated casting that begins hitting every fighter
  indiscriminately and intermittently, the player included, over time spilling
  into randomly casting spells from the grimoire without consuming mana.
  *(Breaks: casting requires mana, and requires you.)* It should absolutely be
  able to fire the *other* excess workings — that is the moment the god stops
  being a bargain and becomes a problem.
- **crush ×4** — everyone takes damage on taking any action, slowly incurring
  `concussed` stacks; armor is crushed inward, reducing existing armor and
  dropping into the negatives until it becomes its inverse. *(Breaks: armor
  has a floor.)*

**Four more, added 2026-08-13. Full design for these lives in
[docs/plans/excess-fourths.md](plans/excess-fourths.md), not here** — new work
goes in the card per the migrate-next-into-cards story. Summarised only:

- **light ×4** (`noon`) — the world bleaches: all elemental damage converts to
  its physical variant, then armor is stripped and everyone's max HP burns off.
  *(Breaks: a blow's damage type is a property of its source.)*
- **venom ×4** (`miasma`) — a rotting swamp: flat damage becomes damage over
  time on everything, scaled by the PEAK "swampness" the fight has reached, and
  the swamp itself pulses poison on everyone every two-thirds of a second until
  the fight drowns in it. Plus a `disease` condition that spreads the attacker's
  own DoTs on melee contact.
  *(Breaks: a hit is a discrete thing that resolves now.)*
- **ice ×4** (`winter`) — the fight cools: speed and cooldowns degrade,
  physical ranged attacks freeze mid-air, everyone is continuously chilled, and
  casting fire inflicts `wet` instead of removing it.
  *(Breaks: fire dries you.)*
- **gloom ×4** (`midnight`) — outside factors (area, weather, environment) fade
  to nothing, and anything under the darkvision threshold is maximally blind
  regardless of how far under it sits.
  *(Breaks: darkness is a slope you can climb out of.)*

**Two rules settled the same day, and they govern all seven:**

- **A fourth saturates the SPOT it is spoken in.** No radius, no field —
  weather's model cannot be borrowed because weather is *derived* and a
  player-caused stain is stateful. Two different fourths in one spot do not
  stack; they make a **broken area** ([plans/broken-areas.md](plans/broken-areas.md)).
- **Monsters may speak fourths on principle and will not, in practice.** The
  absence is content, not a rule: nothing in the implementation may gate a
  fourth to the player.

**Taxonomy by word kind** (the first three above are a noun, an adverb and a
verb, and they break three different layers — use this to author the rest):

- **Excess noun** → the substance stops being an event and becomes permanent
  scenery.
- **Excess verb** → the mechanic escapes its trigger and starts applying to
  actions it was never about.
- **Excess adverb** → the manner detaches from the sentence and modifies *your
  casting itself* rather than the spell. (Adverbs are already "how it is
  spoken"; overspeak one and you break speech.)
- **Excess target / conjunction** — cannot stack today. If ever opened: an
  excess conjunction is a sentence whose clauses start relating to *other
  spells in the grimoire* instead of to each other. Filed, not opened.

### The sacrifice — this god's currency is vocabulary

The miracle is the *permission*; each fourth is a **transaction** under it,
"purchased and spent in a single action":

- **The god does not sell. It desires.** There is no shop and no browsing: a
  new entry simply appears in its miracle list, reading
  **"[name] desires the Sound of [word]"**, once the word has been **spoken
  1000 times in its tier-3 form** (blaze, not fire — so full mastery is
  implied by the gate rather than checked beside it). Entries accrete: the god
  may desire several sounds at once, and the player chooses among them.
- **That needs a SECOND counter, farmable on purpose.** `wordUses` counts
  *distinct inscribed sentences* and is deliberately unfarmable — the mastery
  ladder rewards breadth, and re-inscribing one sentence forever must never
  pay. The god's counter is the opposite: raw utterances of the tier-3 form,
  the same sentence a thousand times if you like. Grinding it out **is** the
  behaviour it is watching for. Two counters, opposite philosophies, both
  correct — do not "fix" the farmable one.
- This is why there is no arbitrage. A list to browse would let the player
  sacrifice something peripheral and keep the vocabulary that matters; a list
  the god writes contains only words already leaned on and already finished.
  Every option is expensive by construction, so the choice is real without
  ever being cheap. A god panel is a portrait of how its worshipper has been
  playing, computed from data that already exists.
- **"the Sound of"** is deliberate: not the word, not the meaning, the noise.
  A god with an appetite, not a merchant with stock — and it names what is
  actually lost. The player keeps knowing what fire *is*; they can no longer
  make the sound. That is the same loss *died in your throat* describes.
- The word is then **consumed**: it leaves the player's lexicon entirely,
  leaving only its fourth form.
- This is the god's "alternate favor". It **cannot be accumulated, farmed or
  ground toward** — you pay in the only thing it wants. Self-limiting with
  zero balance tuning: do it four times and your vocabulary has holes in it.
  The cost *is* the cap.
- The god refuses words it has no authored fourth for.
- It **forecloses futures**: sacrificing *fire* also precludes ever learning
  the deferred compound words built from it (magma, LONGTERM.md). Do not
  warn about this. Aberrant gods do not disclose.

### Dead Spells

Every grimoire spell that used a sacrificed word is **silenced but intact**.

> **Dead Spell.** *A faded sentence that once manifested itself in the world
> when spoken. Now it has died in your throat.*

- **Distinct from *Faded Inscription***, do not reuse that path. They are
  opposite failures: a Faded Inscription is the world forgetting a thing; a
  Dead Spell is you having given it away. "Died in your throat" locates the
  death in the speaker — the sentence is still true, another mage could say
  it. Same greyed page, different sentence underneath.
- The page **keeps its words, legible, forever** — a monument, not a
  tombstone with the name worn off. You can always read what you traded.
- It **keeps the player's own name** for it if one was given. "Snowdart —
  Dead Spell" is worse than the generated name, and it should be.
- It **costs no prepared slot** (it cannot be prepared) but stays in the book
  until deliberately forgotten. Forgetting it is the only part of this the
  game lets you take back — the erasure of the evidence, not the loss.
- **The count is a real number.** Someone carrying six dead spells has a
  history; that is a title waiting to happen.
- **The confirmation screen carries the whole weight of the mechanic**:
  "Sacrificing *fire* will silence 4 workings", with the list, before
  confirming. Not discovered afterward.

### Miracle B — the lowest speaking

Offered, not sold, and gated on **breadth of mastery** where Excess wants depth
on a single word: **80% of words completely mastered.** The entry reads
**"[name] offers the atomic state of words."**

> **The denominator is FOLDABLE words only** (those with a `stacked` form).
> Today the lexicon is 40 words of which 9 — the six conjunctions and three
> targets — can never be mastered at all, so 80% of the whole lexicon is
> 32 of a possible 31: literally unreachable. Against foldable words the bar
> is 24.8 of 31, and it stays honest as words are added. Compute it as a share,
> not a stored count. *Atomic* as in indivisible:
words at their irreducible minimum, which cannot be built up or broken down.
(Aberrant gods share Ik'Thel'the's register of abstraction.)

The verbs are load-bearing and must not be swapped. It **desires** a Sound — it
wants something, and the player feeds it. It **offers** the atomic state —
nothing is consumed. The gift is the more sinister of the two, because it
silently costs everything the player built: you master many words to earn the
right to be told that mastery never mattered. Cruelty the player walked into
by themselves.

Not a penance: an **aura**. Everyone in the encounter is held to the lowest
speaking, the player included. The cost to you is the delivery mechanism for
the cost to them — it is a weapon that guts enemy casters. The god's second
answer is **anti-magic**.

> **Only arcane magic becomes atomic. Nothing else is touched.**

**Scope, corrected and load-bearing — do NOT widen this:**

- **Affected:** folding, and only folding. No stacked tokens, for anyone
  speaking sentences. Everyone is held to the lowest speaking.
- **NOT affected:** statuses escalate normally. Multi-strike specs land in
  full. Miracles and psionics are untouched. It is not anti-magic in general,
  it is **anti-grammar**.

An earlier draft generalised this to "nothing may deepen by being repeated"
(no escalation, first strike only). That is wrong and would have eaten bleed,
poison and half the martial content along with it.

**A folded token DEGRADES to tier 1, it does not fail.** Not one step down —
straight to the bottom, whatever depth it was spoken at. Blazes are reduced to
fires, *fourfold* becomes *twice*, *instantly* merely becomes *quickly*. The
working still goes off, atomically. Refusing to cast a folded sentence outright
would hard-lock any monster built on stacking, which is both far stronger and
much less interesting than crippling it.

**The cost degrades with the token** (decided alongside): you said *fire*, not
*blaze*, so charging `STACK_MANA[2]` for a tier-1 working would bill you for
words the god took out of your mouth. This is also what makes shallow-but-smart
a build rather than a handicap — under the aura everything is weaker *and*
cheaper, which hurts a monster leaning on one big folded blast far more than a
player running many cheap clever sentences. Note the adverb dials degrade too,
so a caster who bought speed with *instantly* loses the cooldown as well.

**Why it is a weapon: monsters use arcane magic, increasingly so as the game
goes on.** Arcane is the school monsters reach first — it needs no devotion
and no trained mind, only repetition, and even idiot goblins can work out that
*fire fire fire* is very big fire. Slimes, goblins and golems all fundamentally
can. So the aura cripples anyone leaning on depth, on either side of the fight,
and its strength is content the author controls: it sharpens every time a
monster is given a folded sentence.

**The counterplay is the skill ceiling that already exists.** Word order,
adverb position, clause structure and conjunctions all work unchanged under
the aura — only depth is gone. "Shallow but smart" is a real build, not a
consolation prize, and it is the one the aura's owner is choosing.

### How the two relate

- **Mutually exclusive**, and the exclusion is *within one god*, not between
  gods — the existing hostility machinery is deity-vs-deity and does not
  cover this. Cleanest as a single irreversible choice: the god asks which way
  you would like to be wrong, and does not take the question back.
- **Both entries are usually visible at once.** Mastering broadly tends to
  produce at least one heavily-used word, so a Sound and the atomic state will
  sit in the same panel — which is the design working, not a bug. **The god's
  panel is the fork**, and accepting either must visibly delete the other.
- **Asymmetric entry.** Excess demands you *walked* the ladder. Purity demands
  you abandon it — every mastery you own becomes dead weight. The
  completionist's damnation and the ascetic's.

### Prerequisite: deities must be MET before they grant favor

Independent of this god, and required for "hard to find" to mean anything.
Today `grantFavorAll` pays the entire pantheon for every deed, so standing
accrues with gods the player has never heard of.

- Per-deity known/unknown state; deeds pay only known gods.
- Each deity needs an authored way to be found — a condition met, a temple
  discovered, a thing learned. The two aberrants should be genuinely obscure:
  not a location you walk to, but a condition you satisfy without knowing you
  are satisfying it. Ik'Thel'the *noticing you* is a different event from
  finding a temple.
- The divine tab is already a portrait grid — unlit silhouettes do the
  bestiary thing where empty slots advertise that there is something to find.
- Migration: anyone the save already holds favor with is someone you have met.

### Engineering flags, in cost order

- **crush ×4 is the expensive one.** Negative armor that inverts means the
  damage pipeline stops clamping at zero, and that clamp is load-bearing in
  every damage path, not just spells. Negative armor must also survive
  `getDerivedStats` and the modifier cache. Check what clamps before
  committing to "drops into the negatives until it becomes its inverse".
- **Burned loot must be visible or it is not a punishment.** If drops are
  rolled at kill time and something burns silently, the player sees fewer
  items and feels nothing. It has to name what it destroyed — "the ash of a
  steel gauntlet".
- **"Only healed through a long, slow ritual" has no home yet.** Natural
  candidates already exist: alchemy's alembic (a slow ordinal sequence, ideal
  for a cure that takes real work) or a chapel pedestal once base building
  lands. Decide which — "permanent until cured" with no cure authored is just
  "permanent".
- **`MiracleDef` cannot express a passive.** It is `spec` → always a castable
  spell that enters the grimoire and gets prepared. Both of this god's
  miracles are permissions with no spec at all. The gap is roughly one field
  wide — but note **titles already do "a thing you wear that changes a rule"**
  (`dogmaDefied`, the iconoclast waiver), so "passive miracle" and
  "title granted by a god" may be the same feature in different clothes.
  Decide before writing.
- `maxStack` becomes state-dependent (`checkSentence` and the bench's
  `mergeInto` read it); `MAX_STACK` stays the constant behind it.

### Still open

- **Every one of this god's entries is state-derived, and the divine tab is
  not.** It maps over a deity's authored miracle list today; both scriptures
  here appear only once earned — one per qualifying word, plus the atomic
  state at enough breadth. `miraclesOf` (or the panel) has to become
  state-aware. This god has no fixed entries at all: an unqualified worshipper
  sees an empty scripture, which is itself the right first impression.
- **Monster sentences: the plumbing is already there, the content is not.**
  Checked 2026-08-04. `MonsterAction = { cast: SpellSource } | { technique }`,
  and a `cast` resolves through `specForSource` → `composeArcane` — the bare
  reading. Folded tokens work with no support work at all, because mastery is
  gated in `checkSentence`, which only the player goes through: a goblin may
  say `fire:3` without having earned it, which is exactly the fiction (it did
  not learn fifteen sentences, it noticed one thing). `dread_shade` already
  casts `gloom cut` / `viciously gloom pierce` (monsters.data.ts). What is
  missing is bestiary content, not systems. **The aura is worth nothing until
  that content exists** — against a bestiary with no folded sentences it costs
  the player their depth and takes nothing back.
- **Monsters never pay mana** (`castMonsterWorking` sets a cooldown and
  resolves; there is no mana check on that path). So `STACK_MANA` is not a
  brake on them, and a folded *noun* — which does not touch `cooldownMult`
  either — is free in every sense: `fire:3` is strictly better than `fire` for
  a monster, always. Nothing in the system will stop it; restraint is
  authorial. **This is also what gives the atomic state its value**: monsters
  lose power with no compensating cheapness, while the player who does pay
  gets weaker *and* cheaper. The asymmetry is structural, not tuned.
- **An offer, once made, should probably never be withdrawn.** The 80% gate is
  a share, so shipping new foldable words can drop a qualifying player back
  under the bar and make the atomic state vanish from the panel. The god has
  noticed; it should not un-notice. Latch it in the save on first offer.
- Both thresholds (1000 / 80%) are placeholders the user set to stop the
  design stalling on numbers. Tune against how the ladder actually plays.

---

## Parked: four subsystem seeds (user, 2026-08-05 — unshaped)

Stated goal for all four: **chassis in place and functional; dormant is fine** —
raw content gets added later as the itch strikes. None of these is designed yet;
this records the seeds so they survive a new chat.

- **Magical music (bardlike) — CHASSIS SHIPPED 2026-08-05 (save v41), see
  docs/MUSIC.md.** Sheet-music composer (4→8 bars, whole/half at first,
  finer notes + tuplets + scales + tuning up the Musicianship ladder), the
  full classifier stack (Krumhansl-Schmuckler, contour, motion, interval
  content, LHL syncopation, Shannon entropy), total nearest-centroid
  archetype reading, coda reprise/turn, performance loop with XP. Still
  open, deliberately: **effects** (the point — a new mod source ⇒
  `modFingerprint`, keyed on the archetype bucket), performance setup
  (instruments/venues), tab gating, ties across barlines, balance. Open
  items list: MUSIC.md §Open.

- **Classes.** Exclusive like titles — one at a time; **prestige systems may
  open gestalt tracks**. Classes level up and reshape the playstyle:
  *barbarian* — a rage resource bar that fills on taking damage, granting
  bonus attack damage and lifesteal; *rogue* — leans on flat-footed/surprised
  through techniques for bonus precision damage (surprised's new teeth,
  `incomingBite`/`opensTempo`, are exactly this class's food); *wizard* —
  limits the technique pool in exchange for arcane bonuses and learning to
  **write scrolls**. Rides existing machinery: titles (exclusivity plus the
  "thing you wear that changes a rule" precedent, `dogmaDefied`), the skill
  chassis (leveling), the roll-time conditional lane (precision damage vs
  statuses). Genuinely new: **event-filled resource bars** (rage fills where
  `damageTaken` fires — a small chassis over the existing bus) and formal
  grant-plus-constraint class definitions. Settle first: what staying
  classless means — the game's identity is breadth, so a class must be an
  opt-in sharpening, never a mandatory funnel. Natural piecemeal-unlock
  candidate.

- **Wuxia/xianxia layer.** Cultivation tiers, **three stages each**; each
  breakthrough to the next tier is an escalating quest/task **that can be
  failed**. Allegiances: daoists, orthodox, unorthodox, demonic cult,
  solitary. Dantian types. The five energies (fire/water/earth/metal/wood),
  with the player able to **break the rules by substituting** elements they
  have access to and rewiring their personal wuxing relations. Hunting great
  elemental beasts for their cores. Hooks already waiting: **`raiseSkillCap`
  is tested and unwired — breakthroughs are the authored caller it has been
  waiting for**; the ten elemental resist skills give substitution something
  to grab; allegiance standing can copy the deity-favor pattern (including
  met-before-favor). Genuinely new: a failable-attempt framework (probably
  the thing that finally forces a real quest chassis into existence) and the
  per-save wuxing relation graph (a mod source ⇒ fingerprint).

- **The demon lord's army.** Start as the lowest-rung member, conquer
  territories, climb by fighting the rest of the world; different constraints
  but also bonuses, magic and techniques not normally accessible. Inverse
  cost profile from the others — system-light, content-heavy: the conquest
  substrate already shipped (`fightLimit` clears spots, `slain:*`/`fights:*`/
  `flag:*` counters, forced fights, restock via `set`), and exclusive kit is
  ordinary `requires` gating. Genuinely new: an origin/path choice, and the
  world fighting back — reconquest pressure is a natural first consumer of
  the planned post-prestige **time-gated events**. Settle first: run-type
  chosen at new game vs. defection in play.

---

## Parked: conditions should be resisted on APPLICATION, not only on damage (user, 2026-08-07)

> ✅ **BUILT 2026-08-14 — in review, not parked.** The prose below describes the
> gap as it stood and is kept for the reasoning; what actually shipped, the six
> call sites it touched, the one number to tune, and two findings that revise
> the design are in
> [plans/condition-resistance-on-application.md](plans/condition-resistance-on-application.md).
> Delete this section when that card reaches `complete`.

A gap in the shared status system, found while designing the mutagen condition
branch. Not a mutagen problem — it touches every status application in the game.

**What is already true.** A condition's tick damage IS resisted. `statuses.ts`
routes every dot through `bearerResistance(bearer, dot.type, …)` (~:1100, helper
at ~:1025), which reads the player's resistance stat or the monster's innate
one. Slashing resistance already softens a bleed, poison resistance already
softens a poison tick, on both sides of a fight.

**What is missing.** `applyStatus` (~:97) never consults a resistance. It checks
`blockedBy`, rolls `chance`, multiplies by `amplifierFor`, and lands at full
intensity. **An ice-immune monster takes `chilled` at full strength** and merely
shrugs off the ticks afterward.

**The hook exists and is inert.** `StatusDef.element` (types.ts:1064, *"the
damage type that most commonly inflicts it"*) is a `DamageType` read by nothing.
Do not confuse it with the `element` on arcane nouns (types.ts:3059) or the five
phases in `wuxin.ts` — different fields, same word.

**Proposed rule, two levels rather than one:**

- `StatusDot.type` gates the **tick damage** — already true, leave it alone.
- `StatusDef.element` gates the **application**, scaling landed intensity.

The split matters because they are genuinely different types on some conditions,
and because **not every condition has a dot**. `seeded` has no damage at all —
it is a grow-and-escalate mechanic — so under damage-only resistance it is
unresistable by construction. Its own comment already anticipates this: *"a noun
can own a condition without owning a damage type."*

**Scale intensity, do not gate landing.** Conditions have different goals and are
all valuable; a chill landing at 0.4 still chills, it just needs more
applications to escalate. That gives resistance a grip on the number a stacking
build actually plays toward — **applications-to-escalation**, since escalation
caps are integers (`bleeding` 5, `seeded` 6) — while preserving what each
condition is for. A binary land/don't would erase the distinctions instead.

**Why it matters beyond flavour.** Under the planned mutagen condition branch
(condition mutations bought with payload displacement, MUTAGENS.md §7a), this is
what gives that branch *fights it loses*. The governing law wants every
persistent alteration to be as true against what counters it as what it counters;
without resistance on application, a condition build has no counter at all.

**⚠️ Blast radius.** Wiring `element` changes every existing status application
at once — monster attacks, weapon oils, techniques, spells, cooking. Almost
certainly correct, and it makes resistances meaningfully better across the board,
but do it as **its own change with its own before/after**, never folded into
chromosome work.

**Open tuning.** What curve maps resistance to landed intensity. A straight
`× (1 − res)` may bite too hard at high resist; a floor probably wants to exist
so nothing is ever fully immune to *being* afflicted, only to the consequences.

---

## Invariants worth not breaking

- **The game stays FINISHABLE by three archetypes** — the inattentive player,
  the longsword-only player, and the troll hunting degenerate loops.
  **Revised 2026-08-10:** the inattentive player is no longer required to
  *complete* the game, only never to become *unable* to. Three invariants now,
  not two: no reachable state is terminal; **critical-path knowledge is
  transferable, never derivable-only** (this replaced the old
  "zero-authorship on-ramp"); and arithmetic and structure hold. The critical
  path is still tuned to the floor build, and a comprehension floor is
  permitted in the **final band only**. All four seeds above are places this
  gets violated by default — see **[COMPLETABILITY.md](COMPLETABILITY.md)**,
  which is the law they answer to.
- **Writes are AST-surgical.** Never reprint a file or an untouched entry —
  hand-written comments in the data files are load-bearing documentation.
  `tests/forge.test.ts` asserts comments survive every edit.
- **No git in this repo.** The forge backs up to `.forge-backups/` and always
  shows a diff before writing. Don't remove that gate.
- **Two validation layers.** A rule added to `tests/content.test.ts` should be
  mirrored in `forge/lib/validate.ts` for live feedback. The test suite is the
  authority.
- **New registry = two steps:** an entry in `forge/server/catalog.ts` *and* a
  re-export from `src/core/registry.ts`.
- **Never use the value of `state.x ??= []`** — it is the raw object, not the
  UI's `$state` proxy copy. Linted in `tests/content.test.ts`.
- Scoped mods and `requiresMonsterTag` mods deliberately **never enter the flat
  stat block**; they resolve where the tags are known.
- **Flag namespace.** Content-writable counters live under `flag:*` (plus
  `slain:*`/`fights:*` via `set` resets). Nothing else in `state.stats` may be
  touched by content — achievements key on those counters.
