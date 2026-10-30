---
id: rolled-abilities
title: Rolled unique abilities — a slot grammar over the chassis, verbs as cards
kind: epic
status: draft
system: abilities
parent: ''
save: ''
updated: 2026-10-27
invariants:
  - completability
  - no-terminal-states
  - modFingerprint
  - two-validation-layers
  - player-only-carve-out
  - proc-cap
done:
  - One ability per run is rolled at an early discovery moment and stored as a recipe plus its compiled AbilityDef; reloading rolls the same ability
  - Every recipe the tables can produce compiles and passes the chassis validators (an enumeration test over the finite recipe space), and deserialize re-validates stored defs
  - A source atom whose event or tag this save cannot produce rolls at weight 0
  - A payload that points at the player's own spell, flask or miracle pays that content's own price through the rotation's affordability gate, and falls back to a basic attack when unaffordable
  - Wearing no ability is a complete build; the Awakening quest is not on the critical path and does not bump quests:completed
  - The codex survives prestige and lists every atom the player has held
  - npm run verify green
---

# What this is

**Parked 2026-10-27.** The user was not convinced by the generated examples
("I see the logic you go for and I'm just not feeling it"). Abilities are
hand-authored in plain English first, in [ABILITY_IDEAS.md](../ABILITY_IDEAS.md);
a later system has to be able to build those entries. The rulings below still
hold for any system.

**2026-10-29: the runtime is FACET, not the chassis.** The user wants one
system for both games ([universal-abilities](universal-abilities.md)). This
grammar becomes the generator layer over FACET: verbs become FACET sugar
templates, sources become game events, bindings become game vocabulary.

The user's ask (2026-10-27): a unique-ability system that produces a large
range of abilities, mostly by luck, later also from the player's play, with
minimal authored content, so players discover an ability that is "quite unique"
to them. Ten target abilities were given (section 5). They are tests the
system must pass, not a roster.

**This reverses two earlier lines, at the user's request.** The 2026-07-30 nen
discard (docs/AUTHORSHIP.md §"Knowing what not to build") and
[unique-abilities](unique-abilities.md)'s "no clauses, vows, naming, seeds".
What this card keeps from the nen lesson: the system is closed by declared
tables and an enumeration test, and every verb is its own card with a line
estimate. It does not grow by vague additions.

**The runtime is the existing draft chassis**
([ability-chassis](ability-chassis.md)). A rolled ability is an `AbilityDef`
literal, compiled once from a recipe. Nothing in the chassis knows whether a
def was authored or rolled.

**Luck first** (user, 2026-10-27): "at the current state of the game it'll be
more reliant on the luck part; the save-derived personality one might have to
be derived later." v1 rolls with no save read. The read is phase 2 (section 7).

# The grammar: five slots

| Slot | Question | Authored as |
|---|---|---|
| **Source** | what fills the gauge | one table row + one emitter hook + one name word |
| **Verb** | what the ability does | a story card each (engine code) + a template `AbilityDef` with holes |
| **Trigger** | when the verb fires | one of four: passive curve, threshold, burst (rotation), on event |
| **Twist** | the cost that buys budget | one table row + its chassis expression |
| **Binding** | whose content the payload uses | one table row naming a pointer into player state |

**Where the range comes from.** Verbs give each ability its feel; sources and
twists give it a texture. Curve parameters do not count as variety ("Calorie
Burn with 0.023 instead of 0.02" is not a new ability). Felt variety is roughly
verbs × sources, and each verb card multiplies it.

**Bindings are what make two players' abilities differ.** A ghost casts one of
YOUR grimoire spells; a deck is built from YOUR techniques, spells, miracles
and flasks; an amalgam carries YOUR summons' stats. The player already wrote
that content. Two players with the same recipe get different abilities, and
no extra content is authored for it.

**Pricing law for bindings** (antagonist objection 1, accepted). A payload
taken from the player's content pays that content's own price: mana for a
spell, favor for a miracle, the flask itself for a flask. It goes through the
same affordability gate as the rotation (`pickActive`). An unaffordable or
empty pointer falls back to a basic attack. Without this, a ghost casts a
grimoire sentence too expensive to cast for 0 mana: `spendResource` clamps and
never refuses (resources.ts:171-173), and fold multipliers live in the spec
(arcane.ts:627), where the chassis's `power` does not reach.

**Chains: where "quite unique" comes from.** Every verb emits events
(`allyDeath`, `editLanded`, `coinWon`, `lieBelieved`, `markComplete`). At the
top tier a roll may chain two verbs: the first verb's event is the second's
source. The Amalgam (example 7) is summon → allyDeath → summon. Chains cost
nothing to author. They exist once two verbs exist.

## Recipe and storage

```ts
interface AbilityRecipe {
  id: string;                   // 'rolled:<createdAt>:<prestigeCount>:<n>'
  atomsVersion: number;
  tier: 'common' | 'uncommon' | 'rare' | 'singular';
  verbs: VerbAtomId[];          // 1, or 2 when chained (singular only)
  source: SourceAtomId;
  trigger: TriggerAtomId;
  twists: TwistAtomId[];        // 0..2
  binding?: BindingAtomId;
  params: Record<string, number>;   // snapped to the chassis grid
  name: string;                 // generated; the player may rename (open)
}
// GameState.abilities gains: rolled: Record<id, { recipe: AbilityRecipe; def: AbilityDef }>
```

- `compileRecipe(recipe): AbilityDef` is one pure function. Each verb atom
  names a template `AbilityDef` literal with `{ hole: 'source' }` markers,
  filled by one generic filler. There are no functions in the data, in line
  with the forge rule.
- **The compiled def is stored.** An atom-table edit never silently rewrites a
  player's ability. `atomsVersion` only flags it for a future remediation tool.
- **Seed**: a hash PRNG over `(createdAt, prestigeCount, awakeningIndex)`. Not
  `rand(state)`: that advances the world stream and can be scummed by timing
  (rng.ts:8). There is no `saveId`; `createdAt` is carried across prestige
  (PRESTIGE.md §3). Reloading shows the same draft.
- **Budget**: atoms cost points; twists refund points. Tier sets the budget
  (common 4, uncommon 6, rare 8, singular 10). Verb first (it fixes the
  template and the legal sources and triggers), then weighted draws that fit
  the remaining budget. Leftover budget scales params.
- **Feasibility** (objection 4, accepted): each source carries a static,
  linted predicate. A tag must be carried by a spawnable species; an event
  must have a live emitter (`allyDeath` needs a summon verb in the same
  recipe). A source this save cannot fire rolls at weight 0.
- **Validation** (objection 2, accepted): the recipe space is finite. A test
  enumerates every (verbs, source, trigger, twists ≤ 2, binding, tier) and
  runs the chassis validators on each compiled def. Content edits are linted
  in both layers as usual. `deserialize` re-validates stored defs, the same
  way it already drops dead ids.
- **Text**: names come from one authored word per atom (`<source word> <verb
  word>`). Card lines are generated from the def, the same way the chassis
  already computes trip and latch lines. Prose tests key by atom id, not
  by `rolled:*` id.

## Atom tables, v1

**Verbs** (each one is a story card, in build order):

| Verb | Does | New engine | Est. |
|---|---|---|---|
| empower | a projected condition at curve(gauge); a negative tail allowed (down to -30%) | none (chassis) | 0 |
| gamble | burst: draw N outcomes from a closed table of existing self-conditions, buffs and penalties | outcome table, draw | ~120 |
| edit | burst: reveal the front enemy's stats, then lower one attribute for the rest of the fight | burst output `edit { attr, by }`, floor 0 | ~70 |
| summon | an ally in a new player-side slot; policy random or fixed; lifetime counted in actions | `CombatState.allies` (no save change: combat is dropped on save) | ~280 |
| field | an encounter-scoped zone that adds an escalating mark to enemies per event; a full mark kills through `onKill` | `CombatState.field`; threshold scales with max HP | ~200 |
| lie | burst: a stated claim; the target makes a save; on a failure a native `lie:*` condition becomes real, on a success nothing happens | save roll, lie conditions | ~150 |
| overcap | the ability unlocks an overcap rite on equipment: rising cost, break chance rising with overshoot, a break destroys the item and all it consumed | item field + fingerprint entry, smithing hook | ~180 |
| mode: deck | replaces `pickActive` while worn: deck, hand, lands, graveyard | its own epic; singular tier only, from a closed list of authored modes | 600–900 |

**Sources**: engaged seconds, technique landed, unarmed hit (a new `bumpStat`
beside combat.ts:4081), crit, hurt, kill, kill of tag X (feasible tags only),
eat, calories (Calorie Burn story), sunlight (Solar story), minutes in a
weather bucket, gold spent, skill level (gamble's coin count), daily charge
(refills at game-day rollover), allyDeath (needs summon), verb events (chains).

**Triggers**: passive curve, threshold crossing, burst (a rotation entry;
daily-charge bursts default to a manual latch so offline catch-up does not
spend them on rats: one game day is 24 real minutes, clock.ts:25), on event.

**Twists**: overfull window (harm and lost power past 100% for too long),
environment dependency (negative tail at 0), high cost plus long cooldown,
self-harm per use, no feed-forward (the payoff does not refill the gauge),
perFight gauge, backfire on failure. "Decays while unworn" is dropped: it is
already the chassis default (unworn = settle only), so it would refund budget
for nothing.

**Bindings**: top-N techniques by executions, a grimoire spell, a toolbelt
flask, a miracle of the favoured deity, the dominant kill tag, the highest
attribute.

## Luck skew (example 9's hidden stat)

Objection 6, accepted. There is one RNG (engine/rng.ts) and no
"favourable" choke point. Crit is the only proc with a player-keyed lane
(`procChance(state, PLAYER_CRIT, …)`). So:

- The skew acts **only inside `procRate`** for player-keyed procs, under the
  existing cap (`min(0.75, 3 × rate)`, mercy.ts:97-109). It never touches
  `rand()` or the stat block.
- Dodge and parry move onto `procChance` with player keys (mercy.ts:247
  already anticipates this). That makes them skewable too.
- Hidden is lawful: mercy.ts:33-35 is the precedent, and the teachability
  invariant binds only the critical path. The card says the skew exists, not
  its size.
- Direness = 1 − hpShare, read at roll time, not in the stat block. Putting
  hpShare into the fingerprint would rebuild stats every tick (derived.ts:605).
  A player can hold HP low on purpose; the proc cap is what bounds that.

# The ten examples, as recipes

| # | Example | Verb(s) | Source | Trigger | Twists | Binding | Status |
|---|---|---|---|---|---|---|---|
| 1 | Calorie burn | empower | calories | passive | overfull window | — | chassis + Calorie story |
| 2 | Salt zone | field | unarmed hit | passive | — | — | field card |
| 3 | Cards | mode: deck | — | — | lands gate | all known actions | own epic |
| 4 | Ghosts | summon (1 action, random) | engaged seconds | burst | — | top spells and techniques, paying their price | summon card |
| 5 | Sun charge | empower | sunlight | passive | env dependency to −30% | — | chassis + Solar story |
| 6 | Stat Breaker | edit | engaged seconds | burst | high cost + long cooldown | — | edit card; "permanently" becomes "for this fight" (instances are per-fight) |
| 7 | Amalgam | summon → summon (chain) | allyDeath, stats as payload | threshold | no feed-forward | your summons | summon card + a vector gauge |
| 8 | Overforge | overcap | resources sunk | out-of-combat action | ruin on failure | equipped item | overcap card; state lives in the item |
| 9 | Coins | gamble + skew | skill level | burst | penalties are real | — | gamble card + skew |
| 10 | Lies | lie | daily charge | burst (manual) | very high cost; the target saves | — | lie card |

Honest count (objection 3, accepted): examples 1, 5 and 6 are table fills on
the chassis. The other seven each need a verb card. "Minimal authored content"
holds per ability (zero) and per atom (one row, one word), but **not per
verb**: every verb is engineering. The enumeration test is the cut line. A
verb exists when its card ships, never before.

# Mockups

The discovery (once per run, early; the ability is fixed for the run):

```
AWAKENING                                   run 3

    SALT FIELD                     uncommon   budget 6/6
    verb     field: enemies gain salt per unarmed hit
    source   unarmed hit
    fill     mark at 40% of max HP → killed (normal loot)
    twist    none

fixed for this run · reload rolls the same ability · [ rename ]
```

The ability card, once worn:

```
GRAVE CHOIR                         rare · rolled · atoms v1
  gauge    choir   ████████░░░░  8/12 s
  burst    ghost   ready at 12/12   → casts: Ember Lance (14 mana)
  binding  grimoire, 3 spells, cheapest 9 mana
  twist    −2% HP per ghost
  last     ghost cast Ember Lance · 312 dmg
           ghost cast Basic Attack (Frost Sentence: 220 mana, unaffordable)
```

Combat with an ally and a field:

```
Giant Spider Queen             HP ████████░░░░  62%
  salt    ▓▓▓▓▓▓░░░░  60% of threshold (+1 per unarmed hit)
You                            HP ██████████░░  85%
  ally    ghost · 1 action · casting
  field   Salt Field · 4 unarmed hits this fight
```

The codex (legacy; survives prestige):

```
CODEX            atoms held: 11 / 46     abilities rolled: 4
verbs     empower ✓  gamble ✓  edit ·  summon ✓  field ·  ???  ???
sources   sunlight ✓  unarmed hit ✓  crit ·  allyDeath ✓  ???  ???
twists    overfull ·  env dependency ✓  backfire ·  ???
chains    summon → summon ✓   ??? → ???
```

# Phase 2: the read (deferred)

From the brainstorm, kept so phase 2 starts from something:

- Inputs: the `state.stats` bag (kills by tag, crits, dodges, parries,
  hits taken, gold, crafts), skill levels by category, technique executions,
  attributes, favor, grimoire, flasks, huntRest. New counters are `bumpStat`
  keys, which need no migration. **They ship in v1** so that phase 2 has data:
  unarmed hits, damage taken by type, minutes per weather bucket, close-call
  wins, cumulative idle ticks.
- Normalize: bounded measures as `level / maxLevel`; unbounded ones as
  `min(1, log2(1+raw) / log2(10001))`; a share is the norm divided by the sum.
  Each axis has an absolute floor below which it does not vote.
- Bias, not choice: `w(atom) = (1 − β)·base + β·read`. The die is still
  rolled. The draft mixes two read-weighted picks with one wild one.
- Shown as evidence lines on the Awakening (`martial 0.70 — technique
  executions 8,412`).

# Expansion, ranked

- A hunted-species ledger: a per-`defId` debuff that persists. It turns
  edit's "for this fight" into "for every wolf". It needs its own save field
  and a fingerprint entry.
- Bearer-agnostic summons: the monster side spawns into a free formation
  slot. That would retire the slime-gene TODO (mutagens.data.ts:569). It is
  required before any gene uses summons (objection 8: parity).
- More modes beyond the deck.
- Weather and time-of-day signals, and a graveyard/exhaust list for
  spend-and-recover verbs.
- **Refused**: permanent free-form stat editing across saves; player-written
  clauses.

# Rulings on the design attack (2026-10-27)

| # | Objection | Ruling |
|---|---|---|
| 1 | Pointer payloads cast free | Accepted: the pricing law for bindings |
| 2 | Rolled defs skip both validation layers | Accepted: enumeration test + re-validate on load |
| 3 | The grammar is a label; seven bespoke runtimes | Accepted: verbs are cards, and the enumeration test is the cut line |
| 4 | A roll can land on a source the save never fires | Accepted: feasibility predicate, weight 0 |
| 5 | Overforge is permanent item state outside the slot | User: the upgrade lives in the item; stacking accepted (one ability per run removes swapping) |
| 6 | No favourability choke point; direness is player-held | Accepted: skew inside `procRate`, under the cap |
| 7 | Lies duplicate divine | User: lies are player-exclusive abilities; the target saves or the lie becomes real |
| 8 | Allies leave the carve-out when a gene uses them | Accepted: summon is ability-only until it is built bearer-agnostic |

Also verified by the attack: no terminal states; `onKill` is the one kill
path (combat.ts:1525-1600), so a salt kill pays loot as normal; instance edits
floor at 1 HP, and rewards stay on the instance. The chassis card's "save v55"
is stale: `SAVE_VERSION` is 57.

# Settled with the user (2026-10-27)

| Question | Answer |
|---|---|
| Overforge | **Lives in the item itself; the ability only makes it possible.** The upgrade is permanent item state, the item can break past its bounds and every resource sunk is lost. Consequence: the item field enters `modFingerprint` (PITFALLS §4), and the overcap rite sits next to temper in smithing (blueprint-weaponsmithing.md) and is gated on the ability. |
| Lies | **Exclusive to the player.** The target makes a save; on a failure the lie becomes real, on a success nothing happens. No backfire, not divine content. Native `lie:*` conditions. |
| Allies | **Enemies can hit them.** |
| How many | **One ability per run, a single roll, discovered early.** The player is stuck with it for the run. There is no draft, no swap and no unworn state, so the chassis's settle-only rules and swap refusals have nothing to guard within a run. |
| Calorie, Solar, WWM | **Acceptance tests**: the grammar must be able to build them. They are not separate quest rewards in this model. |
| Renaming | Yes, cosmetic. |
| Awakenings per run | One. |
| Build order | Manager's call: chassis (trimmed for one fixed ability per run) → generator core with empower, gamble, edit → summon → field → lie → overcap → deck epic → the read. |

Open after this round: whether the prestige keep boon (unique-abilities.md, user 2026-09-26) survives "one per run, stuck with it"; when "early" is (the discovery moment); the rarity odds.
