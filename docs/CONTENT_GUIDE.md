# Frontier Idle — Content Creator's Guide

Everything in the game — items, monsters, skills, quests, whole regions — is **data**
in `src/core/data/*.data.ts`. Adding content means adding an entry to a table and
running one command. This guide covers how the engine thinks, the rules that keep
saves safe, a copy-paste template for every content type, and the reference tables
for all the "magic strings".

> **The one command:** after every change, run
> ```
> npm run verify
> ```
> It typechecks (catches typos, wrong fields, duplicate keys) and runs the test
> suite (catches broken references and behavior). If it's green, your content is
> structurally sound.

---

## 1. How the engine thinks (5 minutes)

- **Core vs UI.** `src/core/` is the whole game (pure TypeScript, no browser
  stuff); `src/ui/` only displays it. You will almost never touch `src/ui/` or
  `src/core/systems/` for content — just `src/core/data/`.
- **Registries.** Each data file exports a `Record<string, SomeDef>` keyed by a
  string **id**. `src/core/registry.ts` re-exports them all. Systems look things
  up by id at runtime — which is why every id you reference must exist.
- **The Modifier pipeline.** One shape powers every bonus in the game:
  ```ts
  { stat: 'damage', op: 'add', value: 3 }          // +3 damage
  { stat: 'str', op: 'add', value: 2 }             // +2 STRENGTH — attributes are targets too!
  { stat: 'attackSpeed', op: 'mult', value: 0.1 }  // +10% attack speed
  { stat: 'crit', op: 'add', value: 0.05, perLevel: 0.002 }  // scales with source level
  { stat: 'damage', op: 'mult', value: 0.02, requiresTag: 'sword' } // only while a sword is equipped
  { stat: 'craftSpeed:leatherwork', op: 'mult', value: 0, perLevel: 0.01 } // only that kind of work
  ```

  **Scoped stats (`stat:tag`).** Any stat key may carry a `:tag` suffix, which
  narrows it to work carrying that tag — `craftSpeed:leatherwork` speeds up
  leatherworking and leaves the anvil alone, while plain `craftSpeed` is
  unconditional. What the scope is matched against depends on where the stat is
  read, and each place has an obvious answer:

  | stat | scope matches | example |
  |---|---|---|
  | `craftSpeed:tag` | the recipe's `tags` | `craftSpeed:leatherwork` |
  | `loot:tag` (gathering) | the gather activity's `tags` | `loot:herbalism` |
  | `loot:tag` (exploring) | the explore activity's `tags` | `loot:cave` |
  | `loot:tag` (a kill) | the **monster's** tags, derived ones included | `loot:beast` |

  So a hunter with `loot:beast` finds more on wolves and nothing extra on a
  golem, and a herbalist with `loot:herbalism` picks better herbs without
  improving their mining. Like
  `requiresMonsterTag`, scoped mods never enter the flat stat block — a bonus
  that applies *sometimes* cannot be one number — so they are resolved when the
  tagged work is done. The stat before the colon must be real; `npm run verify`
  rejects a typo there, because a scope nothing matches is invisible at
  runtime rather than an error.
  Items, achievements, styles, passive skills, and buffs all feed this same
  pipeline. Math: all `add`s sum onto the base, then each `mult` multiplies the
  total by `(1 + value)`. `perLevel` scales `value` by the source's level (skill
  level, school level). Negative values are penalties.

  Three optional gates narrow when a modifier counts:

  | gate | holds while | resolved |
  |---|---|---|
  | `requiresTag: 'sword'` | that tag is on equipped gear (`unarmed` = empty hands) | globally |
  | `requiresStyle: 'jigen_ryu'` | that style is the effective one | globally |
  | `requiresMonsterTag: 'slime'` | the monster being struck carries that tag | per target |

  The first two are part of the global stat block. `requiresMonsterTag` is
  **not** — it is left out of `getDerivedStats(state)` entirely and resolved at
  the moment of a blow against that target's tags, so it never shows in the
  sidebar. See "hunter bonuses" under Achievements in §4.
  An `op: 'add'` on a ×multiplier stat (craftSpeed, attackSpeed — base 1) is a
  legitimate, deliberate move: adds land before mults, so a base modifier is
  amplified by everything above it. That is the shape for a growing curve.
- **Where attributes live in the UI:** the sidebar shows *effective* values
  (with green/red bonus deltas); training progress renders in the **Skills tab**
  as attribute-training skills (names/tier titles from `ATTRIBUTE_TRAINING` in
  `data/attributes.data.ts` — edit that table to rename tiers).
- **Training ranks & milestones grant bonuses.** Each `ATTRIBUTE_TRAINING` tier
  can carry a `bonus: Modifier[]`, and each attribute can also list
  `milestones` — smaller `{ level, bonus }` entries between the named ranks
  (default: `standardMilestones()` = +1 attr at levels ending in 5, +1% at
  levels ending in 0). Both apply permanently and cumulatively, and both key
  off the **trained** level (bonuses and buffs can't fast-track a threshold) —
  which is why they may safely target the attribute itself. Keep both lists
  sorted by level. To customize one attribute, replace its `milestones:` line
  with a literal array, e.g.
  ```ts
  milestones: [
    { level: 5, bonus: [{ stat: 'str', op: 'add', value: 1 }] },
    { level: 10, bonus: [{ stat: 'str', op: 'mult', value: 0.01 }] },
  ],
  ```
- **Action bars.** Every timed action fills a bar at `speed` units per tick and
  fires when it reaches the bar size (`actionBar`, baseline 1000 units; combat
  attacks also scale with `attackSpeed`, crafts with `craftSpeed`). Activities
  (train/gather/job/craft) pay ALL their XP and yields in one chunk when the
  bar completes — their unit cost is `baselineTicks × 50 × actionBar/1000`.
  Modifiers that shrink `actionBar` (e.g. `{ stat: 'actionBar', op: 'mult',
  value: -0.1 }`) make *everything* — attacks and activities — complete sooner:
  the "superhuman" lever.
- **Attributes have two layers.** The *trained* level is skill-like (raised by
  XP, shown on the XP bar); the *effective* attribute is trained + every
  attribute-targeted modifier (equipment, skills, achievements, buffs — and
  titles, when they arrive, will ride the same pipeline). Every formula and
  unlock check reads the effective value — so a +3 STR greatsword really does
  let you meet a STR requirement, and fused super-attributes sum the effective
  components. **Exception: combat styles may only target derived stats, never
  attributes** (a content test enforces this; it prevents a resolution cycle).
- **UnlockCondition grammar.** Anything gated (skills, styles, recipes, item
  requirements, quest chains) uses the same condition list — ALL must hold:
  ```ts
  { type: 'skill', id: 'fighting', level: 10 }
  { type: 'attr', attr: 'str', level: 30 }        // sees fused super-attributes!
  { type: 'stat', key: 'kills', value: 500 }      // any counter (see §5)
  { type: 'statMax', key: 'weapon:families', value: 1 }  // counter must be AT OR BELOW — restraint/purity checks
  { type: 'equippedTag', tag: 'sword' }           // 'unarmed' = no weapon held
  { type: 'quest', id: 'first_posting' }          // quest turned in
  ```
- **Tags drive discovery, and practice flows UP the tree.** An action trains a
  skill when it matches that skill's OWN tags (the ones its `parent` doesn't
  already declare — ANY one match) *and* trains its parent, recursively. So
  Swordsmanship declares `['combat', 'sword']` but owns only `sword`: clubbing
  a wolf trains Club Combat and Fighting, never Swordsmanship, even though both
  carry `combat`. A skill that owns no new tags (Ittou-ryu under Swordsmanship)
  trains whenever its parent does. The same rule decides discovery, alongside
  the `unlock` conditions. Choose the parent and the extra tag carefully —
  together they control discovery *and* XP flow.
- **A tag only exists if something emits it.** Each activity kind emits a fixed
  set (train → `training` + every attribute it trains, gather → `explore`,
  `gather`, craft → `craft`, hunt → `combat`, `hunt` + weapon/style tags), and
  content adds to it with `tags: [...]` on the activity. Tagging a Mining skill
  `['craft']` is the classic mistake: crafting emits `craft`, mining doesn't, so
  the skill manifests at a forge and never at a rock face. `npm run verify`
  fails on any skill tag nothing emits.
- **The event bus.** Systems talk through events (`kill`, `arrive`, `craft`,
  `quest:complete`, …). Quests and achievements are pure listeners — new content
  hooks into play without touching combat code.

## 2. Golden rules (save-safety)

1. **Ids are forever.** Player saves store your ids (`state.skills['smithing']`,
   equipped `defId`s, quest ids). *Adding* content is always save-safe.
   *Renaming or deleting* an id breaks existing saves — if you must, add a
   migration (§7) or, for activity ids, an entry in `LEGACY_ACTIVITY_RENAMES`
   in [save.ts](../src/core/save/save.ts).
2. **Every string reference must resolve.** Recipe costs, drop-table ids,
   encounter `monsterId`s, quest givers… `tests/content.test.ts` checks all of
   them; `npm run verify` is your linter.
3. **Never duplicate an object key.** JavaScript silently keeps only the *last*
   duplicate — the game runs, tests may even pass, and content quietly vanishes.
   (Real incident: a copy-pasted `uchigatana:` block and a Miner achievement
   still keyed `fortune_seeker:` overwrote their originals.) Only the
   *typecheck* catches this — which is why `verify` runs it first.
4. **Counters must be bumped by something.** A `{ type: 'stat', key: ... }`
   condition or achievement `statKey` only works if some system increments that
   counter. Stick to the documented counters (§5) — an invented key like
   `'iron_scrap:mined'` sits at zero forever.
5. **Export your save before risky experiments.** Header → Export. The engine
   has recovery rails (corrupt loads are stashed, migrations are backed up,
   fresher recovery copies auto-restore), but a file on disk beats all of them.

## 3. The workflow

**Where the words live.** The data files hold mechanics. Every player-facing
string — `desc`, `dialogue`, `hint` — lives in `src/core/text/<name>.text.ts`,
one text file per data file, as a flat table keyed by dotted path:

```ts
// src/core/text/npcs.text.ts
export const NPCS_TEXT: ProseTable = {
  'master_smith.desc': 'Runs the third forge from the chimney end.',
  'master_smith.dialogue': [
    'Scrap costs nothing and teaches everything. Start there.',
  ],
  // nested prose: array elements by id when they have one, else by index
  'f1_storerooms.finds.strongbox.desc': 'A strongbox. Uncollected.',
  'faces_of_threshold.objectives.0.desc': 'Meet the smith at the Forges',
};
```

The data file declares its registry through `prose()`, which stitches the
table onto the entries at load time, so `entry.desc` still reads the same
everywhere:

```ts
export const NPCS = prose<NpcDef>('NPCS', NPCS_TEXT, { master_smith: { id: ..., } });
```

The examples below still show `desc:` inline for brevity. When you add the
entry, the `desc` goes in the text file under `'<id>.desc'`; the typecheck will
not stop you from writing it inline (the field is optional in the literal), but
the forge only ever writes it to the text file. `tests/prose.test.ts` fails on
a text key that names no entry and on a registry that lost a description.
Register rules for the words themselves are in `VOICE.md` §3.

Runtime lines — what the log prints when something happens, and the refusal
text a bench or spell hands back — live in `src/core/text/log.text.ts`, keyed
by the system that fires them (`combat.appears`, `alchemy.reason.no_target`).
`{name}`-style placeholders are filled by the call site through `text()` in
`src/core/text/log.ts`; a placeholder the code never supplies prints as
written, so it is visible. `tests/logtext.test.ts` fails on a template nothing
fires and on a call site that passes a parameter the template does not print.

1. Edit a file in `src/core/data/` (numbers) or `src/core/text/` (words).
2. `npm run verify` — fix anything red.
   - *Typecheck errors* point at the exact file:line (wrong field name, bad
     enum value, duplicate key).
   - *Test failures* name the broken reference: `"my_new_spot spawns ghost_wolf"
     → expected undefined to be defined` means `ghost_wolf` isn't in MONSTERS.
3. `npm run dev` — the dev server hot-reloads; your content is live immediately.
4. Balance-check in play (or write a 10-line simulation — §8).

---

## 4. "How do I add a …"

### Item (`items.data.ts`)

```ts
frost_brand: {
  id: 'frost_brand',                    // = the key. snake_case. Forever.
  name: 'Frost Brand',
  icon: '❄️',
  slot: 'weapon',   // weapon|offhand|head|chest|hands|legs|feet|back|accessory
  wield: 'one_handed',  // hand gear only: light|one_handed|two_handed|offhand
  tags: ['sword', 'katana', 'metal'],   // supergroup first, then subgroup (§5)
  mods: [
    { stat: 'dex', op: 'add', value: 2 },        // attribute bonus (effective DEX)
    { stat: 'damage', op: 'add', value: 12 },
    { stat: 'crit', op: 'add', value: 0.05 },
  ],
  value: 250,                           // base gold value (sell price × goldGain)
  desc: 'Cold enough to burn.',
  requirements: [{ type: 'attr', attr: 'dex', level: 15 }],  // optional equip gate
  bonusDamage: { type: 'cold', value: 5 },                   // optional on-hit enchant
},
```
- Weapon `tags` decide the damage type (§5) and which mastery skill levels.
- To make it obtainable: add it to a monster drop table, a recipe, or a quest reward.

**Wielding.** `wield` says which hands a piece can fill, and what it costs to
hold it somewhere it wasn't made for. Everything the piece contributes (mods,
affix, socketed runes) is scaled by that fit:

| `wield` | main hand | off hand |
|---|---|---|
| `light` (daggers, knives) | 100% | 100% |
| `one_handed` (swords, clubs) | 100% | 60% |
| `two_handed` (bows, staves, greatswords) | 100%, fills the off hand too | ✗ |
| `offhand` (shields, focuses, parrying blades) | 75%, or 100% with a `mainHand` bonus | 100% |

Omit it and a weapon-slot item is one-handed, an off-hand-slot item is
`offhand`. Drawing a two-hander turns the off hand out; equipping anything
off-hand turns a two-hander out. Both go back to the pack, never vanish.

**Hand bonuses.** Extra effects that only exist in one hand, and may demand a
partner — never scaled down, because they describe the item used as intended.
Declaring a `mainHand` bonus is also what marks an off-hand piece as built to
be used forward, waiving its main-hand penalty.
```ts
offHand: {
  pairedWith: 'rapier',                  // tag the OTHER hand must carry; omit = any
  desc: 'Paired with a rapier: +5% Parry',   // shown verbatim in the tooltip
  mods: [{ stat: 'parry', op: 'add', value: 0.05 }],
},
```
- Drops can roll a random **affix** (Sharp/Sturdy/…, defined in `AFFIXES` in the
  same file) — you don't need to do anything for that.

### Material (`materials.data.ts`)

```ts
frost_shard: { id: 'frost_shard', name: 'Frost Shard', icon: '🧊', value: 6,
  desc: 'Cold that forgot how to melt.' },
```
Sources: drop-table `{ kind: 'material', id: 'frost_shard', weight: 20 }` entries
and/or a `gather` activity on a spot.

### Crafting recipe (`recipes.data.ts` + a spot)

```ts
frost_brand: {
  id: 'frost_brand',
  result: { kind: 'item', id: 'frost_brand' },     // or kind: 'material'
  cost: [ { id: 'iron_ingot', qty: 3 }, { id: 'frost_shard', qty: 5 } ],
  ticks: 400,                                      // at craftSpeed ×1 (10 ticks = 1s)
  xp: 18,                                          // Smithing XP per craft
  unlock: [{ type: 'skill', id: 'smithing', level: 12 }],   // optional gate
},
```
Then list it where it's craftable: add `'frost_brand'` to that spot's
`recipes: [...]` array in `locations.data.ts` (currently Kystel's Anvil).
**Your katana is the worked example:** item + recipe + forge listing, three edits,
all tests green on the first run.

**Several routes to one product (`alts`).** `cost` is an AND-list — every line
is consumed. When the same product can be made *different ways*, add `alts`
instead of writing a recipe per route, which would fill the bench with four
entries that make one thing:

```ts
leather: {
  id: 'leather',
  name: 'Leather',                                   // optional label for the craft
  ticks: 90,
  xp: 2,
  cost: [{ id: 'ruined_fur', qty: 4 }],              // route 0
  alts: [
    { id: 'torn', cost: [{ id: 'torn_fur', qty: 3 }] },
    { id: 'pristine', cost: [{ id: 'pristine_fur', qty: 1 }], qty: 2 },  // pays double
  ],
  result: { id: 'leather', kind: 'material' },
},
```

A craft takes the **earliest route it can afford**, so declaration order is
preference order: put the junk first and an idle run burns that while it lasts,
reaching for the pristine pelt only when nothing worse remains. `qty` on a route
overrides `result.qty`, which is how a better input yields more — the reason to
have saved the pelt at all. The cost line in game reads
`🧶×4 → ×1 or 🧵×3 → ×1 or ▸✨×1 → ×2`, with `▸` marking the route the next
craft would take. Yields are only shown when the routes disagree.

### Monster (`monsters.data.ts` + an encounter)

```ts
frost_wraith: {
  id: 'frost_wraith',
  name: 'Frost Wraith',
  icon: '👻',
  tags: ['incorporeal', 'undead', 'ice'],  // bestiary tags — see §4a
  art: 'frost_wraith.png',  // optional: a file in src/assets/enemies
  desc: 'Field-notes flavour, revealed by the bestiary’s Field Notes fact.',
  tier: 'elite',            // basic|veteran|elite|ancient|legendary|mythic|divine
                            // → stat multiplier ROLLED in the tier's range + reward mult
  damageType: 'cold',       // what its attacks count as (player resistances apply)
  passive: true,            // optional: harmless — it swings, you can dodge and
                            // brace, but nothing it does lands (training dummy)
  resistances: { cold: 0.7, piercing: 0.3, heat: -0.5 },  // -x = vulnerable
  attrs: { str: 10, dex: 12, con: 9, int: 6, wis: 4 },    // at level 1
  growth: { str: 1.2, dex: 1.4, con: 1.1 },               // per level above 1
  xp: 24,
  gold: [5, 12],            // optional direct gold; omit and use drop-table 'gold'
  loot: {
    rolls: 1,               // how many table rolls per kill
    entries: [
      { kind: 'material', id: 'frost_shard', weight: 30, qty: [1, 2] },
      { kind: 'item', id: 'frost_brand', weight: 2 },
      { kind: 'gold', weight: 15, qty: [4, 10] },   // qty × level × goldGain
      { kind: 'nothing', weight: 53 },              // loot luck shrinks this one
    ],
  },
},
```
**A weight still means what it says.** Anything under 15% of a table rolls
under drought protection (`engine/mercy.ts`): its odds climb with every kill
that stiffs it and reset when it lands, so `weight: 2` out of 100 is still a 2%
drop over any long run — it just stops arriving in clumps. Two rules follow:

- **Never list the same drop twice in one table.** The counter is keyed on
  kind+id, so a duplicated line escalates twice per kill and lands above its
  authored share. Widen `qty` instead. Both validation layers reject it.
- **Author the rate you mean.** Nothing needs a "pity" entry, a duplicate rare
  line, or a padded weight to be reachable — the tail is already handled, and
  padding now overshoots.

Place it in a spot's `encounters` list: `{ monsterId: 'frost_wraith', weight: 40,
level: [8, 12] }`. Spawns also roll a **modifier** (Demiboss/Boss/Aberrant —
override odds per spot with `modifierWeights`) and a **rarity** on top. All
three of those are drought-protected too, on the same 15% rule: a rare
encounter line per spot, a modifier per spot, a rarity globally.
Rough player-facing math: HP ≈ `(12 + con×7) × multipliers`, damage ≈
`(1.5 + str×1.1) × multipliers` — see §6. That formula is linear in CON, so a
target meant to survive indefinitely needs CON in the tens of thousands, not the
hundreds.

**The two practice targets.** Training Grounds hosts `training_dummy` — plated,
`passive`, and deliberately breakable (~2.5k HP) so kills, the bestiary and drop
plumbing can be exercised without leaving the yard. The Post
(`benchmark_post`, one hop away) hosts `benchmark_dummy`: identical shape, CON
143,000, past a million HP. Nothing kills it, which is the point — it is the
fixture for measuring sustained damage. They are separate spots because a hunt
draws from its spot's `encounters` table, so one table per kind of practice.

### 4a. Bestiary tags & knowledge (`bestiary.data.ts`)

Every monster tag must be registered in `MONSTER_TAGS`, and each tag belongs to
exactly one **category** — that's what groups the filter chips, and filtering
ORs within a category while ANDing across them ("Living AND Slime AND (Fire OR
Ice)"). Categories: `material` (living / inorganic / incorporeal — exactly one
per monster), `taxon` (at least one), `element`, `trait`, `size`, and `tier`.

**Never hand-write derived tags.** `monsterTags()` adds them from the stats, so
the book can't contradict the monster: the `tier` tag, `ranged` (from `range`),
`leader` (from `escorts`), `solitary` / `swarm` (from `group`), and
`non_elemental` when nothing else claims an element. A content test enforces
this — declare only the intrinsic tags.

Art is optional and resolved by filename: drop a PNG in `src/assets/enemies/`
and name it in `art:`. No file, no problem — the entry falls back to the emoji
`icon`. A test fails if a declared file is missing.

What the player has to earn is in `BESTIARY_FACTS`. The first kill opens the
entry; each fact then needs `minKills` before it can roll at all, rolls once per
kill at `insight × difficulty`, and is granted outright at `sureKills`. Insight
is `base + hunting×perHuntingLevel + (INT+WIS)×perMind`, capped at `maxChance`
— all in `BESTIARY_TUNING`, along with the habitat rule (`habitatBase`
sightings at one spot, −1 per `habitatPerHunting` Hunting levels, floored at
`habitatFloor`). Adding a fact means adding an entry there **and** a branch in
`BestiaryPanel.svelte` that renders it; adding one to a save-file-old game just
means it unlocks on the next kill.

### Spot / area / region (`locations.data.ts`)

Region → Area → Spot. New spot template:
```ts
frozen_hollow: {
  id: 'frozen_hollow',
  name: 'Frozen Hollow',
  icon: '🥶',
  areaId: 'cragfall',                    // must exist in AREAS (which needs a REGION)
  map: { x: 30, y: 70 },                 // 0–100 × 0–75 canvas, per region
  waypoint: false,                       // true = ⚡ fast-travel caravan stop
  desc: 'The wind stopped moving here years ago.',
  activities: [
    { id: 'hunt', kind: 'hunt', name: 'Hunt', icon: '🏹' },
    { id: 'gather_shards', kind: 'gather', material: 'frost_shard', ticksPer: 160,
      name: 'Chip Frost Shards', icon: '⛏️',
      tags: ['mining'],                    // extra skill tags this work emits
      attrXp: { str: 0.4, con: 0.2 } },    // who trains, and how hard
    // other kinds: train (attr), rest, explore, job (gold + cha)
  ],
  encounters: [{ monsterId: 'frost_wraith', weight: 100, level: [8, 12] }],
  exploreTicks: 200,                     // exploring reveals `hidden` connections
  finds: [                               // …and turns things up along the way
    { id: 'ice_cache', at: 0.4, desc: '🧊 A cache under the ice.',
      material: { id: 'frost_shard', qty: 3 }, gold: [10, 25] },
    { id: 'ice_chute', at: 0.7, desc: '🕳️ The floor gives way.', path: 'deep_woods' },
  ],
  connections: [
    { to: 'ravine_floor', ticks: 120 },                       // bidirectional by default
    { to: 'deep_woods', ticks: 30, oneWay: true, hidden: true,
      label: 'Ice chute' },                                   // drops/slides
  ],
},
```
Connections are declared once on either side; the registry mirrors them unless
`oneWay`. Every spot must be reachable from Village Square (a test checks).

Regions, areas and spots may all carry `tags` (see WEATHER.md §Exposure); a
spot's effective set is the union down the chain, so 'dark' on a cave-system
REGION darkens every chamber without tagging each one. Elemental tags
('heat', 'poison'…) seep passive resist XP into loiterers; `dark` is
darkness at any hour (trains Darkvision, applies night-fighting penalties,
beats roofs and lamplight); `indoor` roofs out the weather; `settlement`
means lamplight. The same elemental tags on an *activity* pay resist XP per
completed cycle. Both linter layers check the vocabulary at all three levels
(`ELEMENT_TAGS`/`PLACE_TAGS` in systems/exposure.ts).

A region may also carry `world: { x, y }` — its pin on the **World Atlas**
(same 0–100 × 0–75 canvas, but one for the whole world). Author it by dragging
pins in the forge's 🌍 World Atlas rather than by hand; regions without one
are "unplaced", and systems that need world geometry (inter-region distance,
climate) must treat them as such rather than invent a position.

Two more region fields feed the climate (see WEATHER.md): `terrain` picks a
profile from `TERRAIN_PROFILES` in climate.data.ts ('plains' when absent; the
linter checks the value in both layers), and `sheltered: true` marks
interiors — weather stops at the door. An unpinned region has no weather at
all.

`mapped: true` removes a region's fog: standing in (discovering) any of its
spots discovers all of them, on arrival and on load (NAVIGATION.md §2.4). Set
on Threshold only. A spot added to a mapped region later is revealed on the
next load with no migration.

**Labels read per direction.** `label` is the way out; `returnLabel` is what the
mirrored edge wears when the trip home is its own act rather than the same one
backwards:

```ts
{ to: 'ravine_floor', ticks: 250, label: 'Steep Descent', returnLabel: 'Steep Climb' },
{ to: 'ravine_rim', ticks: 150, label: 'Old Road' },   // a road is a road either way
```

Omit `returnLabel` and the mirror keeps `label`, which is right for most roads.
It is meaningless on a `oneWay` edge (there is no mirror) and pointless without
a `label` to override — `npm run verify` rejects both.

**Exploration finds (`finds`)** turn a spot's search into a reward curve instead
of one payout at the end. Each entry sits at `at` — a **share of `exploreTicks`,
not a tick count** — so retuning `exploreTicks` moves every find with it. A find
fires **once per save** (remembered in `state.finds`), and at most **one per
tick**, so a spot that gained finds after a player had already combed it hands
them over a few at a time rather than in one wall of log lines.

The payload fields stack — one find is naturally *"a pouch: 12 gold and a rusty
key"*:

| field | yields |
|---|---|
| `material: { id, qty }` | materials (graded ones roll a quality per unit) |
| `item: 'iron_dagger'` | one item instance into the inventory |
| `rune: 'gale_rune'` | one catalogue rune |
| `gold: [min, max]` | an inclusive gold roll |
| `spot: 'ravine_floor'` | marks that spot **discovered** — a rumor, not a trip |
| `path: 'ravine_floor'` | opens ONE `hidden` connection out of this spot **early** |
| `skillXp: { tags, xp }` | skill XP, and can manifest the skill |
| `desc` | the log line (any find may be pure flavor) |

`path` is the interesting one: without it, hidden edges only appear at 100%
explored. With it, the shortcut becomes a reward for *looking* rather than a
consolation prize for finishing — `deep_woods` finds its mossy chute at 55%.
The target must be a connection declared on this spot **and marked `hidden`**,
or the find opens nothing; `npm run verify` catches both mistakes.

`skillXp.tags` are **tags, not skill ids** — Runecarving claims `'craft'`, so
`tags: ['runecarving']` would train nothing at all. The linter rejects a tag no
skill claims.

**Gating a search.** Depth says *when* something could be found; conditions say
whether you are equipped to. Two knobs, both taking `UnlockCondition[]`:

```ts
finds: [
  { id: 'sealed_vault', at: 0.4, desc: 'A door with no handle.',
    requires: [{ type: 'quest', id: 'the_locksmith' }] },   // waits until you can
],
exploreGates: [
  { at: 0.5, desc: '🌊 The passage is flooded — you need a light and a free hand.',
    requires: [{ type: 'equippedTag', tag: 'lantern' }] },   // the search stops dead
],
```

**Havens and the fall-back.** A `rest` activity may carry `requires`, which
makes it a *conditional* haven — a cave you can only camp in with a lantern:

```ts
{ id: 'shelter', kind: 'rest', name: 'Shelter in the Cave', icon: '🔥',
  requires: [{ type: 'equippedTag', tag: 'lantern' }] },
```

The save tracks two havens as you travel (`state.safeSpots`): the most recent
one you *could* use, and the most recent one that asks nothing of anybody. A
fight you cannot flee throws you to the first, re-checked against your gear and
skills at that moment, and to the second when that check fails — which is the
entire reason there are two. Every world needs at least one unconditional
haven; without one the world's first is used, and failing that the starting
spot, because being deposited nowhere is a bug rather than a failure state.

A find whose `requires` are unmet is **not skipped** — it stays unclaimed and
unlogged, and turns up on a later visit once the conditions hold, so arriving
early costs nothing. An `exploreGate` is stronger: progress stops at `at`
entirely, so everything deeper waits on real preparation rather than on
patience. A gate needs at least one condition (one with none would block
forever) and `at` must sit inside `(0, 1]`; `npm run verify` checks both.

**Forced, unfleeable fights.** `forced: true` on a spot means arriving — by
road, caravan, or auto-route — starts a fight from its encounter table on the
spot, with every way out shut: travel, fast travel and activity switches are
refused until the fight resolves. The same flag on a *connection* forces only
that approach, and only in the declared direction — the mirrored way home
stays an ordinary road:

```ts
guardian_hollow: {
  // ...
  forced: true,                          // every arrival is an ambush
  encounters: [{ monsterId: 'stone_golem', weight: 100, level: [12, 14] }],
},
// or, on one road only:
{ to: 'guardian_hollow', ticks: 90, forced: true, label: 'The Sealed Stair' },
```

Winning frees you where you stand. Losing is a knockout that throws you to a
haven — the `safeSpots` machinery above, which is much of the reason it
exists. Since 2026-09-12 EVERY knockout retreats, forced fight or not: you
come round at the last camp you stood in (each tower landing is one), never
where you fell. The player is warned at the door: the world map draws the road red
with a ⚔️ badge, and the travel button says *no retreat* (even toward an
undiscovered `❓` destination — the danger is knowable before the first step,
which is the point). The auto-router never paths THROUGH a forced spot,
though ending a journey on one is allowed: that click was the choice. `npm
run verify` demands the fight has someone to start it — a forced spot (or a
forced edge's destination) with no `encounters` is an error.

**Approach bonuses.** A connection may carry an `approach`: statuses laid on
the FIRST encounter at its destination after arriving along it, before anyone
has swung. Directional like `forced`, never mirrored, and optionally gated:

```ts
{ to: 'spider_nest', ticks: 60, label: 'The Quiet Tunnel',
  approach: {
    requires: [{ type: 'stat', key: 'flag:explosives_set', value: 1 }], // optional
    enemies: [{ id: 'surprised' }],       // laid on every spawned enemy
    self:    [{ id: 'flat_footed' }],     // ...or what the way in costs YOU
  } },
```

The two intended payloads both have teeth: `surprised` makes the next blow
against its bearer land 30% harder per intensity (spent on that blow), and a
fight that OPENS on surprised enemies hands the player the first move — the
action bar starts one tick short of full. `flat_footed` strips worn and
conjured dodge/parry for two of the victim's turns. Any status in the
registry works here — a `burning` approach is the "explosives already set"
case. The stamp is spent by the first encounter, wiped by the next arrival
anywhere, and survives a save. Unknown status ids and empty approaches are
caught by `npm run verify`.

**Finite fights and once-bosses.** Encounter-table lines take two new knobs,
and spots take a budget:

```ts
fightLimit: 3,                            // wins here before the spot is CLEARED
encounters: [
  { monsterId: 'nest_spider', weight: 80, level: [8, 11] },
  { monsterId: 'broodmother', weight: 20, level: [14, 16], once: true },
  { monsterId: 'sealed_horror', weight: 10, level: [18, 20],
    requires: [{ type: 'stat', key: 'flag:seal_broken', value: 1 }] },
],
```

`once` records the kill under `slain:<spotId>:<monsterId>` the moment it
happens and never rolls that line again (nor as an escort filler).
`requires` holds a line off the table until its conditions are met.
`fightLimit` counts WINS under `fights:<spotId>` — knockouts spend nothing —
and at the limit the spot is **cleared**: hunts find no one, and a `forced`
spot stops forcing, so a guardian den is fight-your-way-in-once, pass freely
after. Cleared forced spots also reopen to the auto-router and drop their ⚔️
warnings. The budget is drawn as a row of pips in the spot's Location header
and on the battle stage (`ui/lib/RaidTrack.svelte`).

**How a place is drawn — `scene`.** The Location header and the Combat tab's
battle stage paint the same backdrop behind a place. `scene` on an AREA sets
it for every spot in the area; `scene` on a SPOT overrides its area's:

```ts
ascent_f2_area: { id: 'ascent_f2_area', name: 'The Flooded Stair', regionId: 'the_ascent', scene: 'cistern' },
```

The choices are `SceneId` in `types.ts`: `town` (the city under the tower),
`hall` (torch-lit stone and banners), `crypt` (arches, cold candles, fog),
`cistern` (arches over standing water) and `webs` (silk and cocoons). With no
`scene` anywhere up the chain, `ui/lib/scenes.ts` picks from the place tags:
`dark` → crypt, `indoor` → hall, anything else → town. The field is
presentation only; nothing in the core reads it. A new backdrop is a new
`SceneId` member plus a branch in `ui/lib/SceneBackdrop.svelte` (an 800×240
SVG; keep the ground line near y=200 so combatants stand on it).

**Training spots — a keeper and a dare** (`systems/training.ts`; the Cages
are the first). Two spot fields:

```ts
healBetweenBouts: { maxAttrTotal: 30 },   // after every WIN here, while the six
                                          // attribute levels total <= 30: HP full,
                                          // damage-over-time conditions cleared
dare: { monsterId: 'suspiciously_large_slime', level: 16, every: 8 },
```

The heal removes the chain that knocks newcomers out (a hunt rolls the next
bout with no recovery); each bout keeps its own risk, and outgrowing the cap
ends it. The dare needs `healBetweenBouts`: every `every` wins while the
keeper still tends you, play **holds** on a popup. Answering **Fight** starts
`monsterId` at `level`, alone, plain (no rolled modifier or rarity) and
unfleeable. Answering **Flee** returns you to the ordinary cages. While it waits,
`Game.tick` advances nothing and banks every tick as bonus time; the step
buttons do nothing. Offers stop once that monster has a kill on record. The
keeper's line is prose: `<spot>.dare.desc` in the text table. The pending
question is a stat (`dare:<spot>:pending`, plus the global `hold:dare` the
tick reads), so it survives a reload with no save change. Both validation
layers check that the monster exists, `every` is a positive whole number, the
spot has encounters and a keeper, and the line is written.

**Flags — the cross-room wire.** A find may touch a persistent counter, and
`UnlockCondition`s anywhere may read it — that is the whole mechanism for
"the lever in room A opens the fight in room B":

```ts
finds: [
  { id: 'lever', at: 0.6, desc: '🎚️ A rusted lever. You pull it.',
    stat: { key: 'flag:explosives_set' } },              // bump (default +1)
  { id: 'nest_regrows', at: 1, desc: '🕸️ Fresh silk over the old bones...',
    stat: { key: 'slain:spider_nest:broodmother', set: 0 } }, // a RESET
],
```

Keys must live in the `flag:` namespace — bumping `kills` or `gather:`
counters from a find would corrupt achievements — except that `set` may
target `slain:*` and `fights:*`, which is exactly how content resurrects a
once-boss or restocks a cleared spot. `npm run verify` enforces the
namespace. Quest turn-ins need no flag: `{ type: 'quest', id }` conditions
read them directly.

**Cycle activities (train/gather/job/craft) share two extra knobs:**

- `tags: [...]` — skill tags this activity emits on top of its kind's built-ins.
  This is how a skill becomes reachable from the work that should teach it (see
  §1) — and the ONLY way; there is no `skillXp` field on an activity. Every
  cycle kind honors it, jobs included:
  ```ts
  { id: 'mine_coal', kind: 'job', gold: 10, ticksPer: 300,
    name: 'Mine for Coal', icon: '⛏️', tags: ['mining'] },   // pays wages AND Mining XP
  ```
  Built-ins per kind: train → `training` + each trained attribute, gather →
  `explore`/`gather`, craft → `craft`, job → `job`.
- `attrXp: { cha: 0.5, str: 0.25 }` — the attribute XP split for one completed
  cycle. Weights **multiply** the kind's base payout rather than dividing a
  fixed pool, so they may sum past 1: a punishing task can legitimately total
  ×1.5, and you normalize by hand when you want a true split. Omit it to keep
  the kind's default — train → its own `attr`, gather → Wisdom, job → Charisma,
  craft → nothing (crafting pays no attribute XP until a `attrXp` says so).
- `drops: [{ material: 'recipe_lectory_porridge', chance: 0.0008 }]` — rare
  finds rolled once per completed cycle of a train/gather/job activity
  (`systems/activitydrops.ts`). Rolls under 15% use the shared drought curve,
  keyed per activity and material, so the average holds and the worst run is
  bounded. Optional fields: `qty`, `quality` (pin a graded drop's grade),
  `rarer: 2` (each previous find, counted under `found:<material>`, halves the
  chance), `unique` (not rolled while one is held). A card whose effect has
  already happened, or one that is held, is not rolled. **House rate:** about
  one find per 40 minutes of the activity, so chance = base cycle ticks /
  24,000 (a train rep is 20 ticks). **Unmarked by design (user, 2026-10-17):**
  no badge, and no spot or NPC text names a find; players discover them.

**The rare finds, for maintainers** (players are told nothing):

| District | Activity | Find | Effect |
|---|---|---|---|
| Scholars' Quarter | Read Until It Sticks (Reading Hall) | Recipe: Lectory Porridge | cooking recipe (the user's library exception) |
| Scholars' Quarter | Copy Out a Proof (Chalk Yard) | Word Slip: Stone | lifts the word `stone` |
| Temple Rise | Keep a Vigil (Nine Chapels) | Votive Token (`rarer: 2`) | first: +2 favor with every known god and +2 starting favor for gods met later (`votive:baseline`, paid by `meetDeity`); later: 1 floating favor (`favor:floating`), placed on the Divine tab |
| The Ironyard | Spar (the Sand) | Drill Manual: Riposte | Riposte in canonical form |
| Alembic Row | Wash Out the Retorts (the Alembics, job) | Emberbloom ×3 | a reagent the shelf does not sell |
| The Chancery | Copy Out Writs (the Rolls) | Chancery Price Seal | `flag:chancery_seal`: 10% off at every counter, above the no-arbitrage floor (shops.ts) |
| The Assize | Stand the Night Watch (the Holding) | Unclaimed Case File | `flag:assize_case_file`: hidden title Friend of the Court |
| Wrights' Ward | Work the Bellows (the Forges) | Smith's Pattern: Bronze | `flag:pattern_bronze`: the secret copper/tin/bronze ingot and bronze dagger recipes appear at the Forges |
| The Granaries | Scrub the Pans (Granary Kitchens) | Iron Pot (grade B, `unique`) | cookware for the stove's tool slot |

**Card effects** (`ConsumableSpec`; ungraded; refused once spent): `teaches`
(a recipe), `unlocksWord`, `teachesTechnique` (canonical form), `stamps` (a
`flag:` counter, then titles are re-checked), `votive` (above). Every card must
be sold or dropped somewhere, and its target must exist (both layers).

**Secret recipes** (`RecipeDef.secret`): not listed anywhere — Crafting panel,
map card, destination preview — until `unlock` is met. A secret recipe must
have an `unlock`.

**Recipe cards and learned dishes.** A bench outcome with `recipe: 'id'`
matches only once that recipe is known (`recipe:<id>`). A material whose
consumable says `teaches: 'id'` is the card: using it (verb "Read") stamps the
recipe and is consumed, and it is refused once the recipe is known. The bench
window lists known recipes with the tags each one takes. The lints require
every learned dish to have a card, every card to teach a real dish, and every
card to be sold at a counter or dropped by an activity. Learned dishes take a
priority above the generic outcome their tags would otherwise hit (fish + onion
is a stew without the card).

A `train` activity is `attr: 'str'` for the simple case, or `attrXp` alone when
several attributes are the point — `attr` is optional, and the split then *is*
the definition. It needs one or the other; `npm run verify` catches an activity
that trains nothing. Each trained attribute also becomes one of the emitted
tags, so a str+dex drill can manifest skills tagged for either.
```ts
{ id: 'circuit_training', kind: 'train', name: 'Circuit Training', icon: '🏃',
  attrXp: { str: 0.5, dex: 0.5, con: 0.5 } },   // ×1.5 a normal rep, spread three ways
```

### NPC + quest (`npcs.data.ts`, `quests.data.ts`)

```ts
// NPC — stands at a spot, offers quests in order
hermit_ysolde: {
  id: 'hermit_ysolde', name: 'Hermit Ysolde', icon: '🧙‍♀️',
  spotId: 'frozen_hollow',
  desc: 'She was here before the cold. Possibly the cause of it.',
  dialogue: ['The wraiths hum when snow is coming.', 'You again. Good.'],
  quests: ['wraith_hunt', 'the_source_of_winter'],
},

// Quest
wraith_hunt: {
  id: 'wraith_hunt', name: 'Wraith Hunt',
  desc: 'Thin the wraiths so travellers stop freezing solid.',
  giver: 'hermit_ysolde',
  objectives: [
    { type: 'kill', monsterId: 'frost_wraith', count: 12, desc: 'Slay Frost Wraiths' },
    // { type: 'kill', count: 20, ... }                 // any monster if no monsterId
    // { type: 'craft', recipeId: 'iron_ingot', count: 3, ... }
    // { type: 'collect', materialId: 'frost_shard', qty: 8, ... } // consumed at turn-in!
    // { type: 'reach', spotId: 'malgeri_peak', ... }
    // { type: 'stat', key: 'kills', value: 5, at: 'the_cages', ... }
    //   `at`: where it is usually done, for the Quests tab's Go link (any kind
    //   that names no place itself). Display only; progress never reads it.
  ],
  rewards: { gold: 250, items: ['frost_brand'],
    levelXp: 80,                                  // absent: DEFAULT_QUEST_LEVEL_XP (50)
    materials: [{ id: 'iron_ingot', qty: 2 }],
    skillXp: [{ id: 'fighting', xp: 30 }] },     // no-op if skill not yet known
},
// Chain: the follow-up simply requires the first quest
the_source_of_winter: {
  ..., giver: 'hermit_ysolde',
  requirements: [{ type: 'quest', id: 'wraith_hunt' }],
},
```
Progress tracks automatically via events. Turn-in requires standing at the
giver's spot. Completing bumps the `quests:completed` counter and pays
character-level XP (LEVELS.md). A Go link appears beside the giver and each
unfinished objective with a place when that place is in town (or anywhere,
with the Wayfinding boon).

A ladder floor (`towers.data.ts`) pays `clearXp` level XP the first time
its `clear` holds in a run. Band 1: 100 / 150 / 200.

### Shop (a `shop` on an `NpcDef`)

A vendor is an NPC with wares. Nothing about a shop is saved: stock is
data, prices are derived, the discount is a counter that already exists.

```ts
master_smith: {
  ..., quests: [],
  shop: {
    name: 'The Scrap Bin',                       // the counter's heading in the panel
    lines: [
      { kind: 'material', id: 'iron_scrap' },    // price = value × BUY_MARKUP (2)
      { kind: 'material', id: 'healing_salve', quality: 'b' },  // graded wares sell at ONE grade (default 'c')
      { kind: 'item', id: 'iron_sword' },        // minted through createItem — rune slots roll on purchase
      { kind: 'item', id: 'rapier', price: 300 }, // flat asking price (still floored — see below)
      { kind: 'item', id: 'iron_breastplate',    // off the shelf until the counter is stamped
        requires: [{ type: 'stat', key: 'boss:f1_toll_hall', value: 1 }] },
    ],
  },
},
```

Rules the engine holds (`systems/shops.ts`, locked by `tests/shops.test.ts`):

- **No arbitrage.** The price paid is `max(asking, best possible resale + 1)`,
  at any charisma. `goldGain` raises what selling pays and never lowers what
  buying costs; an item is floored at its best rune-slot roll. A `price`
  override is floored the same way — a bargain is never a mint.
- **The hello is the discount.** A stranger pays `STRANGER_MARKUP` (×1.5) on
  top; `talkTo` stamps `met:<npcId>` and the markup drops. No other state.
- **Bench NPCs sell INPUTS, gate NPCs sell PRODUCTS.** The smith stocks
  scrap, never blades; the outfitter at the district gate stocks the blades.
  Keeps the bench worth using — see "home refines, the world supplies".
- Unlimited stock, no restock timer, by design. Gate scarcity with
  `requires`, not counts.
- Buying bumps `gold:spent`, `shop:buys` and `shop:buys:<npcId>` — all
  targetable by `stat` conditions and quest objectives.
- Both linters check every line: the id resolves, `quality` only on a
  graded ware, `price` positive, asking price above the ware's `value`.

### Skill (`skills.data.ts`)

```ts
herbalism: {
  id: 'herbalism', name: 'Herbalism', icon: '🌿',
  desc: 'Know which green things help and which bite back.',
  kind: 'passive',                       // or 'active' (needs `active` spec)
  category: 'general',                   // combat|magic|resistance|craft|general
  tags: ['herbalism'],                   // SOMETHING must emit this — tag the herb
                                         // activities to match (see §1)
  parent: 'scouting',                    // optional: nests in the tree, shows as ??? hint
  unlock: [{ type: 'attr', attr: 'wis', level: 10 }],
  effects: [{ stat: 'loot', op: 'mult', value: 0, perLevel: 0.008 }],
  tierNames: [ { level: 1, name: 'Weed Puller' }, { level: 40, name: 'Green Sage' } ],
  milestones: [                          // unscaled step-ups, sorted by level
    { level: 5,  bonus: [{ stat: 'loot', op: 'add', value: 0.01 }] },
    { level: 10, bonus: [{ stat: 'loot', op: 'add', value: 0.02 }] },
  ],
},
```
- **Milestones** work exactly like the attribute-training ones (§1): granted
  whole at each threshold, cumulative, permanent, and *not* scaled by level —
  the smooth part of a skill is `effects` + `perLevel`, the steps are these.
  Both lists must stay sorted by level.
- **Discovery** = doing something that trains the skill (own tags + the whole
  parent chain, see §1) while `unlock` holds. Locked skills are invisible unless
  their `parent` is known AND every threshold in `unlock` (skill level,
  attribute level, counter) is at 90% or better — `REVEAL_FRACTION` in
  skills.ts — at which point the "???" hint appears with its requirements.
  Quest, equipped-tag and counter-ceiling conditions are not thresholds and
  never hide a skill on their own. The same 90% rule hides the *next milestone*
  line in the Skills panel. The Foresight prestige boon lifts both.
- Actives: `active: { type: 'strike', damageMult: 2.2, cooldown: 80 }` or
  `{ type: 'spell', power: 3, cooldown: 100, damageType: 'heat' }` or
  `{ type: 'buff', mods: [...], duration: 30, cooldown: 120 }` — fired by the
  rotation (`activeRotation`), ordered and trigger-gated by the player. NOTE:
  martial actives should usually be **techniques** (§below), not active skills.
- **Conditional bonuses (required, not optional).** A weapon family's `effects`
  must carry `requiresTag: 'dagger'` — mastery you cannot use pays nothing. A
  school's `effects` use `requiresStyle: 'jigen_ryu'` instead: its bonus applies
  only while you actually fight in that art (narrower, since a school needs its
  weapon to take over the stance at all). `tests/content.test.ts` enforces this.

### Combat stance vs weapon school (`styles.data.ts`)

Generic stances have no `unlock` and no `replaces`. A **school** transforms a
stance: it's a *skill* (see school_ entries — tags `['style:<stanceId>',
'style:<ownStyleId>']` so it manifests by fighting in the stance it upgrades)
plus a *style* entry:
```ts
tiger_style: {
  id: 'tiger_style', name: 'Tiger Style', icon: '🐅',
  desc: 'Frenzy, but with intent.',
  mods: [ { stat: 'damage', op: 'mult', value: 0.3, perLevel: 0.004 }, ... ],
  unlock: [ { type: 'skill', id: 'school_tiger', level: 1 },
            { type: 'equippedTag', tag: 'unarmed' } ],
  replaces: 'aggressive',                // hides Frenzy while unlocked + weapon held
  skill: 'school_tiger',                 // mods' perLevel scales with this skill
},
```
Unequipping the weapon falls back to the generic stance automatically.

**Exertion — the stamina a style burns.** Every style should declare one
(`exertion`), because that is where its personality lives:
```ts
exertion: {
  on: 'attack',            // 'attack' = your swings, 'defend' = each incoming blow
  cost: 0.1,               // fraction of MAX stamina per event (before efficiency)
  drain: true,             // (optional) spend the WHOLE bar instead — straight to exhaustion
  note: 'Everything behind the swing',      // one flavour line in the tooltip
  mods: [ … ],             // stats granted only while stamina is still spendable
  hit: { damage: 0.5, penetration: 0.15,    // on the blow
         splash: 0.25, extraHits: 1,        // onto a flanker / extra simultaneous swings
         dodge: 0.2, armor: 0.6,            // 'defend' only, vs that one attack
         parry: 0.18 },                     // 'defend' only — bought chance rides on
                                            // top of standing parry, same 50% cap
  ramp: { stat: 'attackSpeed', per: 0.03, cap: 0.45 },  // momentum, resets each fight
},
```
Exertion is **opt-in**: it costs nothing and grants nothing unless the player
has switched Exert on (`state.exerting`). Balance each style's `cost` as a
deliberate purchase, not as background drain — cost bands: ~2–3% cheap, ~5–8%
middling, ~10–15% burst, `drain` all-in.

Two levels of spending, and two floors:
- **Upkeep** — every physical attack costs `0.9 × stamina regen × seconds per
  attack`, whatever the style, exerting or not. Priced per second of wind-up, so
  fast and slow weapons drain alike, and always under what you recover: plain
  fighting is sustainable and tops back up between fights. Not authorable.
- **Exertion** — the style's `cost`, only while exerting.
- Spending stops at the **20% reserve** (`winded`) or at zero (`exhausted`:
  −15% to every action bar and half regen until the pool is back over half);
  both clear only on a full bar.

Everything in `hit` (and `ramp`) scales with the share of the cost actually
paid — a nearly empty bar buys a nearly worthless bonus — and is then
multiplied by **Stamina Power** (`staminaPower`, base `2 − staminaEff`). Cost
efficiency and payoff are two sides of one coin: a fighter who has trained
exertion 10% cheaper also gets ~10% more out of every point spent. Milestones,
titles and feats can raise `staminaPower` further with an ordinary modifier.
`staminaEff` itself decays toward a **50% floor**, so late-game training never
makes exertion free.

### Martial technique (`martial.data.ts`)

> Full system documentation — runtime resolution, position graph, mastery,
> economy, tuning bands — lives in **`docs/MARTIAL.md`**. This section is the
> authoring quick-reference.

The martial identity is **response** — where magic is composed before the fight
and played back, a technique is composed BY the fight. Its trigger is baked into
what it is (the player authors only rotation order), and sequencing is never
scripted: a technique fires only from its entry `from` positions, exits into
`to`, a plain swing recovers to `neutral`, and chains emerge from whichever
exits feed whichever entries the fight offers (Gather → Heavy Blow; dodge →
Riposte → Thrust).

```ts
riposte: {
  id: 'riposte', name: 'Riposte', icon: '⚡',
  desc: 'The answer to an attack that found nothing.',
  family: 'sword',                        // (optional) weapon tag that must be held
  trigger: { conditions: [], event: 'onDodge', window: 20 },  // the baked reflex
  from: 'any',                            // entry positions, or a list of POSITIONS ids
  to: 'extended',                         // where executing it leaves you
  move: { damageMult: 1.4, cooldown: 40 },// + penetration/splash/inflicts/buff/
                                          //   staminaCost (fraction of max)/momentum/
                                          //   preventedMult (see below)
  unlock: [ { type: 'skill', id: 'fighting', level: 12 } ],   // ELIGIBILITY to learn
  learn: { self: { stat: 'combat:dodges', count: 50 } },      // self-learn counter
  mastery: { 3: { name: 'Instinct' } },   // ladder ANNOTATIONS: name/addFrom per rung
},
```
- Techniques ride the rotation as `technique:<id>` — ordered, trigger-gated and
  toggled exactly like skills and prepared spells. A `damageMult` move swings on
  the action bar; a `buff`-only move fires from the buff slot.
- **Reactive triggers reuse SkillTrigger** and should carry `window: 20` (~2s):
  a reflex answers on the next swing, not inside the 2-tick default window.
- **`preventedMult` answers with what you STOPPED.** A move may add a share of
  the damage the last defensive event prevented (`combat.prevented`, spent on
  use, keyed by event so a bystander cannot overwrite it). Two flavors, one
  field: under `onParry` it reads the whole blow, so the answer scales with
  *their* swing; under `onHit` it reads what your armor, resistances and any
  counter took off it, so the answer scales with *your* guard. A dodge stops
  nothing and stamps nothing. Either way it is the one damage source that grows
  with the danger rather than with you — pair it with a real gate (Flowing
  Shield wants a buckler *and* the `guarded` position) or it is free power.
  `damageType` retypes the returned share only, so a counter lands as two
  slices: your own blow in your own type, theirs in the type you name.
- **`counter` is the third execution kind.** A strike swings on the action bar,
  a buff fires from the buff slot, and a counter fires *inside the enemy's
  attack*: `{ reduce, pool?, cost? }` takes `reduce` off the incoming blow
  before armor, then answers immediately without touching your action bar —
  the parry riposte, made authorable. `trigger.event` names what it intercepts.
  An empty pool skips that blow rather than disabling the technique. Because it
  bypasses the action bar entirely, give it a real position gate and a cooldown
  or it is a free extra attack every time anything swings at you.
- **Knowledge is a ledger** (`state.techniques`): `unlock` only gates learning.
  `learn.self` crystallizes the ROUGH form (+25% stamina until Perfected, reps
  count double) from combat counters (`combat:attacks/crits/dodges/hitsTaken`);
  teachers (future) grant CANONICAL. Give every technique a self-learn path
  until teacher content exists — a content test enforces this.
- **Progression is repetition** on the standard powers-of-ten ladder
  (10/100/1,000/10,000 — thresholds and generic bonuses in code; data only
  names rungs or opens entries via `addFrom`). Executions count only while the
  technique occupies one of the `MAX_DRILLED` drill slots.
- Positions are the per-weapon vocabulary hook: keep universal techniques on
  the shared POSITIONS; a family's techniques may use family positions once
  those exist. Runes will later modify triggers and transitions (graph surgery).

```ts
miner: {
  id: 'miner', name: 'Miner', icon: '⛏️',
  statKey: 'gather:iron_scrap',          // MUST be a real counter — see §5
  descTemplate: 'Mine {n} iron scrap in total',
  tiers: [
    { threshold: 5,  bonus: [{ stat: 'loot', op: 'mult', value: 0.03 }] },
    { threshold: 10, bonus: [{ stat: 'loot', op: 'mult', value: 0.05 }] },
  ],
},
```
Tier bonuses are permanent and stack through the Modifier pipeline.

**Hunter achievements (count a tag, reward against that tag).** Every kill bumps
`kills:tag:<t>` for each tag the corpse carried — authored *and* derived (tier,
`swarm`, `non_elemental`) — so one counter spans a whole family instead of a
single species. Pair it with `requiresMonsterTag` and the reward points back at
the same quarry:
```ts
slime_kills: {
  id: 'slime_kills', name: 'Slime Hunter', icon: '🫧',
  statKey: 'kills:tag:slime',            // every slime, not one species
  descTemplate: 'Kill {n} slimes of any kind',
  tiers: [
    { threshold: 5,  bonus: [{ stat: 'damage', op: 'mult', value: 0.03, requiresMonsterTag: 'slime' }] },
    { threshold: 50, bonus: [{ stat: 'damage', op: 'mult', value: 0.1,  requiresMonsterTag: 'slime' }] },
  ],
},
```
These stack by construction: a basic Slime is `inorganic + slime + small`, so a
player holding both Slime Hunter and Breaker (`kills:tag:inorganic`) applies
both lines to it and neither to a wolf. Any stat can be gated this way, not just
damage — `penetration`, `crit`, `splash` and the rest all resolve per target.
Because these never enter the global block, they do not appear in the sidebar
Damage tooltip; that number is what you hit a *generic* monster for.

### Rune (`runes.data.ts`)

```ts
minor_rune_might: {
  id: 'minor_rune_might',
  name: 'Minor Rune of Might',
  icon: '🔺',
  value: 25,                                   // sell value (future shops)
  effects: {                                   // ONE rune, per-context effects —
    weapon:    { mods: [{ stat: 'damage', op: 'add', value: 4 }] },   // in a weapon
    armor:     { mods: [{ stat: 'armor', op: 'add', value: 2 }] },    // in any armor (incl. offhand)
    accessory: { mods: [{ stat: 'damage', op: 'mult', value: 0.02 }] }, // in an accessory
  },
},
```

Weapon-context effects can also carry typed on-hit damage:
`bonusDamage: { type: 'lightning', value: 3 }` (flat per hit) or
`bonusDamagePct: { type: 'lightning', value: 0.12 }` (12% of each hit dealt
again as that type). A context without an entry is inert (socketable, does
nothing). Runes drop via `{ kind: 'rune', id, weight }` drop-table entries and
can be recipe results (`result: { kind: 'rune', ... }`). They stack in
`state.runes` and socket via the Equipment tab.

**Rune slots** are rolled when an item is GENERATED (drop/craft/quest reward):
0–4, weighted by size class — `small` (daggers, accessories) averages ~0.7,
`medium` ~1.3, `large` (chest, legs, greatswords) ~1.9. Override per item with
`runeClass: 'small' | 'medium' | 'large'` on the ItemDef. Existing saved items
got their class's median (1/1/2) in the v8 migration.

### Title (`titles.data.ts`)

```ts
first_blade: {
  id: 'first_blade',
  name: 'Devotee of the First Blade',
  icon: '⚜️',
  desc: 'Defeat the Goblin Warchief having never raised any weapon family but your first.',
  unlock: [
    { type: 'stat', key: 'kills:goblin_boss', value: 1 },      // the trigger deed
    { type: 'statMax', key: 'weapon:families', value: 1 },     // the restraint
  ],
  passive: [{ stat: 'damage', op: 'mult', value: 0.03 }],      // forever, once earned
  equipped: [{ stat: 'damage', op: 'mult', value: 0.08 }],     // only while worn
  // secret: true,  → hidden from the Titles list until earned
},
```

Titles are checked on every progress event and **latch**: the moment ALL
conditions hold, the title is earned permanently — breaking a `statMax`
restraint afterwards never revokes it. That's how "do X while never having
done Y" deeds work: pair the trigger stat with the restraint. One title may be
worn at a time (Achievements tab → Wear); `passive` applies always, `equipped`
only while worn. Simple thresholds ("Strength 100", "500 kills") are just a
single `attr`/`stat`/`skill` condition.

### Super-attribute (`superattrs.data.ts`)

`{ id, name, icon, desc, components: [attrA, attrB], unlock: [...] }` — once the
conditions hold, both components read as their live sum everywhere. Edit the
`unlock` lists to design the "convoluted" endgame paths.

### Crafting discipline (`disciplines.data.ts`)

A discipline is a bench. Its **slots** say what can go where, its **outcomes**
say what combinations produce, and its `skill` is what gates and scales it —
the discipline is content, the skill is progression, and the only link between
them is that one field.

```ts
my_bench: {
  id: 'alchemy', name: 'Alchemy', icon: '⚗️', desc: '…',
  skill: 'alchemy',        // a SkillDef id — gates slots, gates outcomes
  tag: 'alchemy',          // emitted while working, so the skill trains on it
  ticks: 60, xp: 12,
  slots: [ /* see below */ ],
  outcomes: [ /* matched by TAG over what was placed */ ],
}
```

**Slots.** `accepts` is a list of tags; where those tags come from depends on
`picks`:

| `picks` | draws from | consumed? |
| --- | --- | --- |
| `'material'` (default) | graded stock, filtered by `craftTags` | yes |
| `'design'` | the discipline's own catalogue — patterns, techniques. A thing you *know*, not a thing you own | no |
| `'tool'` | implements you work *with* | no (`consumed: false`) |

`unlockLevel` is the whole of "this discipline widens as the skill grows" —
runecarving's second cut at 10 and third at 25 are one number each. `station`
tells the bench UI where to draw the slot (`centre`, `topLeft`, `topRight`,
`bottomLeft`, `bottomRight`).

**Outcomes** may be gated by `minQuality` (an S-tier-only result) and by
`maxQuality` — how a discipline says "this is what you get when the basket is
genuinely awful" as a *different result* rather than merely a poor grade of the
good one. Cooking's Scorched Mess uses the latter, at high `priority`, so
rubbish in means rubbish out whatever else the tags would have matched.

**Materials** join a discipline by declaring `craftTags`, and `graded: true`
opts them into per-quality stock. Anything graded is stocked and spent at a
specific tier, and F-tier is genuinely harmful — see the quality table in
`quality.data.ts`.

> **Watch reachability.** If a recipe needs two things that can only go in the
> same one-of-a-kind station, it can never be made. `content.test.ts` checks
> this for named runes; do the same for any new discipline.

**The kitchen** (`cooking` skill) is several benches on one skill: stove, clay
oven, grill, cold counter and cutting board. Two tags divide the pantry — `raw`
is food as found (all the hot benches accept), `cooked` marks a finished dish
that is also an ingredient (`bread`, `filling`; only the cold counter takes
them). The cutting board turns a `whole`-tagged ingredient plus a technique
(`preps.data.ts`, a design catalogue) into a prepped variant whose stored grade
is the CUT — grade means uniformity, and uniformity is predictability: a dish's
contribution from a prepped part is rolled inside the cut grade's `UNIFORMITY`
band (S is exact, C the widest gamble). Each bench may name a `favoredPrep` tag
worth up to ~a grade across a matched basket.

**Timed benches.** A discipline with `timeline` runs for a chosen number of
units, and each slot's `at` (fraction of the cook already gone) sets what it
holds on the heat for `duration × (1 − at)` units. Cuts have exposure bands
(`EXPOSURE` in `systems/cooking.ts`): julienne wants a short flash, dice wants
the full simmer, whole food is forgiving and never bonused. Slots without `at`
(seasoning, cookware) stand outside time. The stove is the reference
implementation.

**Bench runs** (`systems/benchwork.ts`) repeat one layout on the clock —
`craftSpeed` compresses the interval to a floor, and speed past the floor
resolves several crafts per completion. Exclusive with activities, bound to
the spot, abandoned by combat or travel.

**Repeating a design.** Runecarving lets the same pattern be cut more than once,
which *concentrates* a rune rather than broadening it. Distinct patterns share
the slab at a diminishing rate (`1/(1+i·0.6)`), but copies of one pattern add up
and reinforce each other by `RESONANCE` (0.25) on top — so two of a figure beat
two different figures, and beat a single cut by more than double. The cost is
the slab: `REPEAT_MIN_QUALITY` in `runecarving.ts` demands Fine for a double and
Superb for a triple. Both constants are the tuning dials.

### Consumable (a `MaterialDef` with a `consumable` spec)

Food, potions and salves are graded materials that can be used. They stack,
sell and sit in stock like anything else, and a dish cooked from better
ingredients is simply a better **grade** of the same dish.

```ts
hearty_stew: {
  id: 'hearty_stew', name: 'Hearty Stew', icon: '🍲', value: 14,
  graded: true,
  consumable: {
    useVerb: 'Ate',
    restore: [{ resource: 'hp', ofMax: 0.25 }],   // INSTANT — all of it, now
    grants:  [{ id: 'well_fed', intensity: 1 }],  // SUSTAINED — over its life
    cures:   ['cleansing'],                       // fires a cure at your conditions
    cooldown: 100,                                // ticks
  },
}
```

**Instant vs sustained** is the whole distinction, and it needs no duration
system of its own:

| | field | example |
| --- | --- | --- |
| Instant | `restore` | a potion: the full amount the moment you drink it |
| Sustained | `grants` → a status with `restores` | a dish: fed to you across its duration |

Because a sustained effect *is* a status, consumables inherit all three
lifetimes for free — a **set duration**, one that runs **until a trigger**
(the status's `removal`), or **permanent** (`duration: null`).

> **Grade matters, and F-tier bites.** Everything is scaled by the tier
> multiplier, and a Refuse-grade consumable has a NEGATIVE one — so eating
> something spoiled grants `queasy` instead of whatever it meant to do, rather
> than quietly doing nothing. That substitution lives in `consumables.ts`.

### Status condition (`statuses.data.ts`)

A condition is one entry with an **intensity**; everything it does scales off
that. Sources declare how hard they hit, so the same poison is a nuisance from a
rat and a crisis from a wyrm without needing two definitions.

```ts
my_condition: {
  id: 'my_condition', name: 'Blighted', icon: '☠️',
  desc: 'What it feels like, in one line.',
  element: 'poison',              // the damage type that usually inflicts it
  stacking: { mode: 'highest' },  // what a second dose does — see below
  duration: 30 * SECOND,          // ticks; null = only a removal rule ends it
  dot: { type: 'poison', flat: 0.05, outOfCombat: 0.3 },
  mods: [{ stat: 'staminaRegen', op: 'mult', value: -0.2 }],
}
```

**`element` is what the condition is resisted BY, and it is also the flag that
says this is an affliction.** Two different resistances are in play and they are
not the same field:

| field | gates | so… |
| --- | --- | --- |
| `element` | the **application** — how much intensity lands | an ice-armoured body registers a shallower chill |
| `dot.type` | the **tick damage** the condition deals | …and sheds more of what that chill costs per tick |

They are genuinely different on some conditions, and **not every condition has a
dot** — `seeded` deals no damage at all, so before `element` was wired it was
unresistable by construction.

The landed share is `max(APPLICATION_FLOOR, 1 − resistance)`, and the floor
(`systems/statuses.ts`) is load-bearing: without it a 0.9-resistant target needs
fifty doses to escalate a bleed that costs five, which is immunity wearing a
number. **Resistance buys the consequences, never the immunity.** Negative
resistance runs the same arithmetic the other way, so a vulnerability deepens
the dose.

Where escalation is measured in **depth** (`sum`, `highest`, `absorb` — 14 of
the 16 element-bearing conditions) resistance raises applications-to-escalation
directly. Where it is measured in **count** (`bleeding`) or **duration**
(`dazzled`) it deliberately does not: the number of applications IS the mechanic
in those two, so scaling depth must not move it.

⚠️ **Omit `element` for anything a body does to itself.** All 37 conditions
carrying one today are afflictions, and every self-granted buff is elementless —
that absence is the authoring, not an oversight. You do not resist your own
steadying hand. The day a *beneficial* condition wants an `element`, the fix is
to stop passing the player's stat block at `spec.grants` sites, not to weaken
the rule; see the note on `applyStatus`.

**A `duration` is wall-clock time, not screen time.** While the bearer is out
cold the clock runs at `UNCONSCIOUS_CLOCK_RATE` (5×, in `systems/actions.ts`),
because being knocked unconscious is time passing — a 45-second rot does not
wait for you to sit up before it starts. Only the clock accelerates; the damage
stays at its per-tick rate, so a knockout SHORTENS an affliction rather than
concentrating it. Write durations as what they should feel like on your feet,
and expect a long one to be mostly spent by the time you come round.

The reason it works this way: you wake at 60% health, so at 1× a fever with most
of its clock left simply put you straight back down, over and over, until it
ran out.

**Timerless conditions need a way out that fires where the bearer is.** With
`duration: null` something else has to end it, and `barFill`/`barDeplete` come
only from `tickCombat` — a condition resting on those alone survives a knockout
and rides into the next fight forever. Pair them with `{ on: 'combatEnd' }`, or
give the condition a `ceilingDecay`/`detonate`/`drains`/`surplus` exit. Both
validation layers reject the combat-only case.

**Stacking modes.** Pick the one that matches how the condition should feel:

| mode | a second dose… | used by |
| --- | --- | --- |
| `highest` | is ignored unless it is stronger | poison, rot |
| `absorb` | folds `absorb` × its intensity in; the clock is NOT reset | burns |
| `sum` | simply adds | chill, wet, taint |
| `count` | is its own wound, counted in `stacks` | bleeds |
| `extend` | adds DURATION instead of magnitude | dazzle |

Add `cap` plus `onCap: 'escalate'` and the condition gives way to its
`escalatesTo` when it reaches that ceiling. The worse form names `baseForm` to
be talked back down to.

**Removal belongs to the source, not the condition.** A `StatusApplication` may
override `duration` (including `'permanent'`) and `removal` wholesale:

```ts
inflicts: [{ id: 'on_fire', intensity: 2, chance: 0.3 }],
// ...or a curse that only water puts out:
inflicts: [{ id: 'on_fire', intensity: 3, duration: 'permanent',
            removal: [{ on: 'cure', tag: 'water', effect: 'remove' }] }],
```

Removal events are `heal` (narrow it with `healKinds`), `damageTaken`,
`damageDealt`, `barFill`, `barDeplete`, `combatEnd` and `cure`. The effect is
`remove`, `deescalate` (drop to `baseForm`), `reduce` (lose `amount` of
intensity) or `unstack` (one instance at a time).

Damage removals can also name `damageTypes` (fire drives off a drenching and
nothing else does) and `after: n` (it takes three hits, and partial progress is
remembered between fights).

> **Watch the heal kinds.** A bare `{ on: 'heal' }` fires on the passive trickle
> the player gets from working quietly, so a wound would close itself one tick
> after a fight. If it should need real treatment, say
> `healKinds: ['rest', 'salve', 'spell']`.

**Other fields:** `ceilings` seal off part of a pool; `ceilingFromSpend` eats a
share of what you spend from one; `ceilingPerTick` widens a wound for as long as
it is held; `damp` dulls modifiers by where they came from (`{ slot: 'weapon' }`
= your weapon's bonuses); `healCap` rations how much of the condition's own
damage healing may undo; `expiresTo` is what it becomes when the timer runs out,
inheriting its bookkeeping; `blockedBy` prevents it applying at all; `hidden`
keeps it off the status bar.

**Behavioural gates** — what a condition stops you *doing*, all declarative:

| field | effect |
| --- | --- |
| `blocks: ['spell','attack']` | those actions simply cannot be taken |
| `missChance` | per intensity; compounds, so it never reaches certainty |
| `blocksRegen: ['stamina']` | that pool stops recovering entirely |
| `forceStyle` | overrides the stance, leaving the player's *selection* intact |
| `costMult` | spending that pool costs more without buying more |
| `bar.onFill` / `bar.onDeplete` | damage as the action bar completes or empties |
| `bar.reverse` | the bar drains instead of filling |
| `bar.skip` | costs the completed action (pair with an `unstack` removal) |
| `retaliate` | damage back when the bearer attacks or is struck in melee |
| `dropWeaponBelow` | the bearer loses their grip under that share of health |

**Conditions that act on other conditions.** These are what make an element
feel like an element rather than a list:

| field | effect |
| --- | --- |
| `amplifies` | multiplies another condition's intensity as it lands (water carries a chill three times as deep) |
| `capOverrides` | changes what it takes for another condition to escalate |
| `converts` | transmutes something already held the moment this lands (venom souring into rot) |
| `overrideRes` | DICTATES a resistance instead of nudging it; add `bonusIfMet` to top up someone already past it rather than dragging them down |
| `resFloor` | how far this condition's own penalties may reach, deepened per stack independently of the penalty |
| `decayWithDuration` | its bite fades as its clock runs down |
| `disadvantage` | attack rolls take the worse of two |
| `drains` | eats a pool every tick; `intensity` is the TOTAL left to take, `ofMax` the rate |
| `negativeHeadroom` | lets that pool be driven past zero into debt, deeper per stack |
| `detonate` | what the overdraft does when the debt bottoms out (`bypassRes` ignores that share of resistance) |
| `fatalOnEmpty` | emptying the named pool brings the bearer down; `retains` is the share of the condition that survives |

**Splitting a DoT's stacking.** `dot.fromPeak` lists the parts scaled by the
*worst single* application rather than the accumulated total. A bleed uses
`fromPeak: ['currentHp']`: several cuts lose you more blood (the flat part adds
up) but do not open you any wider (the proportional part tracks the deepest cut).

Conditions apply to monsters and the player alike. On a monster, `mods` that
target attributes or `maxHp`/`damage`/`speed`/`dodge` take effect; anything else
is ignored.

---

## 5. Reference tables

**StatKeys** (`Modifier.stat`) — base formulas live in `baseStats()` in
[derived.ts](../src/core/systems/derived.ts):

| key | meaning | base |
|---|---|---|
| maxHp | hit points | 40 + 10×CON |
| hpRegen | HP/s — multiplied by how restful the activity is (`RECOVERY_MULT`: rest ×15, job ×4, work ×2, hunt/explore ×1); halved in a live fight while stamina is off its ceiling | 1% of maxHp + 0.01×CON |
| damage | weapon hit | 2 + 1.2×STR |
| speed | action-bar fill per tick — governs ALL actions | 50 × (1 + 0.015×DEX) |
| actionBar | action-bar size in units (min 100) — shrink it to act sooner | 1000 |
| attackSpeed | combat-only mult on attack fill rate | 1 |
| dodge | avoid chance (cap 75%) | 0.02 + 0.004×DEX |
| crit | crit chance (cap 90%) — at 15% and above it rolls smoothed on both sides of the swing, see ENGINEERING.md §3.4; the long-run rate is unchanged | 0.05 + 0.0015×DEX |
| critDamage | crit multiplier (min ×1) | 2.0 |
| armor | flat physical reduction | 0.3×CON |
| penetration | erodes positive monster resistance (cap 60%) | 0 |
| splash | share of a landed hit that carries into a random flanker (cap 100%) | 0 |
| parry | chance to turn a blow aside and riposte, free (cap 50%) | 0 |
| riposte | share of your damage that parry answers with — **uncapped**, the axis a parry build keeps growing on | 0.3 |
| staminaEff / staminaPower | exertion cost multiplier (floor 50%) / payoff multiplier | 50% + 50% × 0.999^STR × 0.9985^DEX / 2 − staminaEff |
| spellPower | spell damage base | 2 + 1.5×INT |
| skillXp / trainXp | skill / attribute XP mults | 1 + 0.01×INT / 1 + 0.012×WIS |
| loot / goldGain | drop luck / gold mult | 1 + 0.005×WIS / 1 + 0.012×CHA |
| travelSpeed / craftSpeed | walking / crafting speed | 1 |
| resSlashing … resArcane | % damage reduction per type (cap 75%) | 0 |

**Damage types**: slashing, piercing, bludgeoning (physical → reduced by armor
*then* resistance), heat, cold, poison, arcane, lightning (elemental →
resistance only).
Weapon tag → type: sword/greatsword=slashing, dagger/bow/spear=piercing,
blunt/staff/fists=bludgeoning. Taking elemental damage levels the matching
resistance skill (`resist:<type>` tags). Resistance skills scale by
`levelCurve: 'resistTiered'` instead of `perLevel`: each level compounds
damage TAKEN by (1 − step) — 1% ordinarily, 3% every 5th level, 5% every
10th, 10% every 25th (biggest applicable step wins) — so the resistance is
1 − Π(1 − stepᵢ). It crosses the 75% cap around level 75; the cap clamps.

**Tag conventions**:
- Weapon supergroups (mastery skills key on these): `sword`, `greatsword`,
  `dagger`, `bow`, `blunt`, `staff`, `shield`, `unarmed` (pseudo-tag when no weapon).
- Subgroups (flavor/refinement): `katana`, `rapier`, `buckler`, … — always
  alongside their supergroup.
- `parrying` — a ROLE tag, not a family: worn by anything built to catch someone
  else's edge (parrying dagger, buckler, rapier), whichever hand it is in. It is
  what Deflection trains from, so adding it to an item makes that item a parry
  build's entry point.
- Mechanics: `style:<styleId>` (active stance during combat), `resist:<type>`,
  `combat`, `hunt`, `magic`, `explore`, `gather`, `craft`, `travel`, `training`,
  plus every attribute id (emitted by the training that raises it).
- Anything else — `mining`, `herbalism`, … — exists only because an activity
  lists it in `tags`. Add the tag to the work and the skill together, or the
  skill is unreachable.
- **Monster** tags are a separate vocabulary (`bestiary.data.ts`): they classify
  quarry, not actions, and are what `kills:tag:` and `requiresMonsterTag` read.

**Counters** (for achievement `statKey` / `{type:'stat'}` conditions):
`kills`, `kills:<monsterId>`, `kills:tag:<monsterTag>` (bumped for every tag the
kill carried, derived ones included), `gold:earned`, `crafts`, `gather:<materialId>`,
`quests:completed`, `travel:trips`, `skill:levels`, `attr:<attrId>` (highest
level reached; sees fusion), `defeats` (times knocked out), `used:<family>` /
`weapon:families` (distinct weapon families ever attacked with — unarmed
doesn't count; for statMax purity conditions). Want a new counter? It needs one `bumpStat` call in
a system — ask, or copy how `gather:` is bumped in
[actions.ts](../src/core/systems/actions.ts).

**Events** (quest objectives / future listeners): `kill`, `arrive`, `craft`,
`loot`, `skill:unlock`, `skill:levelup`, `attr:levelup`, `superattr:unlock`,
`achievement`, `quest:accept`, `quest:complete`, `defeat`, `log`.

## 6. Balancing cheat-sheet

- **Time**: 10 ticks = 1 second. Offline progress simulates up to 8 h.
- **XP curves**: attribute level-up needs `20 × 1.15^(level−1)` XP (training
  gives ~1×trainXp/tick); skills need `15 × 1.13^(level−1)` (combat hits give
  `4 + 0.5×monsterLevel`, actions give 0.2–0.3/tick).
- **Monster multipliers**: tier ranges Basic 0.8–1.1 ×1 rewards → Divine 4–5 ×8;
  modifiers Demiboss ×1.2–1.4 (×2 rewards), Boss ×1.5–1.8 (×3.5), Aberrant
  ×0.2–2.0 wildcard; rarity Uncommon ×1.15 → Epic ×1.6 (loot ×1.5→×4).
- **Player damage sanity check**: `(2 + 1.2×STR + weapon) × skill mults × stance
  × (1 − monster resistance)`. A stance is ±15–50% on one axis with a real cost.
- **Gold**: flows in from kills/jobs/selling (all ×goldGain); flows out through
  fast travel. Price items so the *next* tier costs ~10–20 minutes of play.

## 7. Save compatibility

Bump `SAVE_VERSION` in [state.ts](../src/core/state.ts) and add a migration in
[migrations.ts](../src/core/save/migrations.ts) **only** when you change the
*shape* of `GameState` or rename stored ids:
```ts
5: (raw) => {          // keyed by the OLD version
  raw.myNewTopLevelField = raw.myNewTopLevelField ?? {};
  raw.version = 6;
},
```
Pure content additions never need this. Don't touch the recovery/backup/auto-heal
code in save.ts — it has earned its keep three times.

## 8. Testing your content

`tests/content.test.ts` automatically validates every cross-reference in the
registries — run `npm run verify` and read the failure message; it names the
offending id. Beyond "does this id resolve", it catches the silent-failure
cases that cost the most time:

| rule | what it saves you from |
|---|---|
| registry key must equal `def.id` | a def invisible to every `{type:'skill', id}` reference — lookups go through the key |
| every skill tag must be emitted by something | a skill that can never manifest (typo'd or wrong-vocabulary tag) |
| a train activity must have `attr` or `attrXp` | an activity that trains nothing |
| weapon-family bonuses must be gated on that family (or a sub-family, or a style) | mastery paying out while the weapon is in the bank |
| exactly one material tag per monster | a bestiary entry that contradicts itself |

For balance, a simulation test takes ~10 lines:

```ts
it('frozen hollow is survivable around level-ready gear', () => {
  const g = new Game(createInitialState(42));
  g.state.spot = 'frozen_hollow';
  g.state.attrs.str.level = 30; g.state.attrs.con.level = 25;
  g.state.hp = 300;
  g.selectActivity('hunt');
  for (let i = 0; i < 6000; i++) g.tick();          // 10 minutes of play
  expect(g.state.stats['kills']).toBeGreaterThan(15); // tune to taste
});
```
Drop it in any test file, `npx vitest run`, and you have a repeatable pacing probe.

For the tower as a whole there is already one: **John** (`tests/john.ts`,
COMPLETABILITY §8) plays band 1 by the obvious road with every rack weapon,
and `npm run pacing` prints when each stretch ended, where the knockouts were
and what the climb held at the top. Touching a band-1 floor, monster or gate?
Run it before and after; `tests/john.test.ts` holds the curve's bounds.

## 9. Spellcraft content (words, miracles, psionic recognitions)

Three schools, three registries, one shared idea: a spell stores **what made
it** and resolves deterministically on read. All three write into
`state.grimoire`; the content linter (`tests/spellcraft.test.ts`, "spellcraft
content") validates every cross-reference below, so `npm run verify` catches a
typo before a player does.

### 9a. Arcane words — `data/spellcraft.data.ts` → `ARCANE_WORDS`

The full grammar — clauses, word order, stacking, adverb position,
conjunctions, resolution — is specified in [ARCANE.md](ARCANE.md). This
section is only what an author declares. A word has a `kind` and exactly
that kind's payload:

```ts
frost_example: {
  id: 'brine', word: 'brine',
  stacked: ['spume', 'maelstrom'],     // REQUIRED for every non-target word:
  kind: 'noun',                        // the ×2 and ×3 names (fire→flame→blaze)
  icon: '🌊',
  desc: 'One line of flavour.',
  minLevel: 6,                         // Arcana level to know it
  mana: 2,                             // its share of the spell's cost
  element: 'water',                    // noun: DamageType
  power: 0.9,                          // noun: damage in spell-power multiples
  inflicts: [{ id: 'wet', intensity: 1, chance: 0.5 }],  // must be real STATUSES ids
},
```

* **Verbs** carry `verb: ArcaneVerbSpec` — all declarative: `powerMult`,
  `barePower` (cast with no noun), `penetration`, `gripMult` (status intensity),
  `cooldownMult`, `splash`, `restore` (heals the caster), `ward` (resistance
  coat), `undo` (makes the working a counterspell; `burn` is its manaburn in
  spell-power multiples — ARCANE.md §14). No code changes, ever.
* **Adverbs** carry `adverb:` with `powerMult` / `cooldownMult` / `manaMult`
  (compound per repetition) and `hits` (additive: twice×2 = thrice).
* **Targets** carry `target:` and must NOT have `stacked` (linted).
* **Conjunctions** carry `conjunction: ArcaneConjunctionSpec` and relate the
  clause before them to the clause after: `inheritPenetration` (the follow-up
  rides the opening) and `followThrough` (x mult when the previous strike
  LANDED, resolved per cast), `fuse` (and), `transmute` (but), `alternate`
  (or), `condition` (if) and `accompany` (with — lends a noun-only clause's
  substance to the clause before). A linked clause escapes the breadth tax -
  chains are depth, not breadth. Conjunctions never stack (linted), must sit
  between clauses, and cost their `mana` like any word.
* Word order matters on its own — the composer handles verb-led vs noun-led,
  clause shares, stacking curves. You only declare what the word IS.
* Mastery is automatic: tier words (flame, blaze) become directly speakable
  after `WORD_MASTERY = [5, 15]` inscriptions using the base word. Nothing to
  declare — the arcana novelty ledger is the counter.

### 9b. Deities & miracles — `data/deities.data.ts`, `MIRACLES`

A deity is tags + relation rules; every tag (even ones used only in rules)
must be registered in `DEITY_TAGS`. Rules read naturally:

```ts
synergies: [{ anyOf: ['bestial', 'tribal'], unless: ['fire'] }],
hostilities: [{ anyOf: ['honorable'] }],
// waiver: ['honorable'] — un-does an `unless` ("...unless also honorable")
```

Resolution is pairwise and **hostility always beats synergy**. Hostile
deities' miracles refuse to be *prepared* together (learning is free); a worn
title with `defiesDogma: true` waives that.

A miracle is a whole `SpellSpec` plus `deity` and `favorCost`. The spec may
use every primitive: `strikes` (with `orType` for take-the-lower-resistance),
`grants` (statuses worn by the caster — blessings ARE statuses, so put the
actual behaviour in `statuses.data.ts`), `transfers` (strip own statuses →
inflict on target), `amplify` (intensify + refresh target's statuses),
`empowered` (mult while anyone carries a status), `heal`, `buff`,
`staminaCost`. A deity with zero miracles fails the linter.

### 9c. Psionic recognitions — `PSI_RECOGNITIONS`

**Adding one of these cannot change what any shape does.** A psionic working is
computed entirely from seven derived quantities (`deriveShape` — see
[PSIONIC.md](PSIONIC.md)); a recognition only puts a NAME on a region of that
space, exactly the way `NAMED_RUNES` names a carving. It carries no mechanics
beyond the one flat `PSIONIC.recognitionBonus` every recognition shares.

```ts
example_recognition: {
  id: 'example_recognition', name: 'Example', icon: '🧠',
  desc: 'What this region of the space feels like.',
  region: {
    inertia: { min: 3 },       // bands are over DERIVED quantities, not axes
    coherence: { min: 0.4 },   // pressure momentum inertia acuity awareness
    momentum: { max: 0 },      // coherence inward
  },
  tier: 4,                     // teacher tier before the name comes (omit = untaught OK)
},
```

Raw axes are allowed in a `region` for the rare case where the axis *is* the
statement (Still Mind wants `vitality`, not a ratio) — but reaching for one
usually means the space is missing a quantity, so prefer adding the quantity.

Overlaps resolve deterministically: explicit `priority` first, then NESTING (a
region demanding everything another does, and at least as much of it, is the
more particular claim and wins) — never declaration order. Two linter tests
apply: no two regions may be identical, and every region must be reachable by
some shape.

Axis caps are 3 + Psionics level/8 (max 10 from skill); `state.psi.axes` /
`state.psi.tier` gate axes and tiers — teachers will write those via
`learnPsiAxis` / `raisePsiTier` (the debug panel already does).

**Real depth goes in the quantities, not here.** If a new idea cannot be
expressed as a product or ratio of the axes, it does not belong in psionics —
that is the guard that keeps this school from decaying back into a lookup table.

### 9d. Balancing anchors

* Arcane baseline: a bare noun ≈ fireball-per-mana at C-grade effort; stacking
  pays `STACK_POWER [1, 2.3, 3.9]` but costs `STACK_MANA [1, 3, 6]` — keep new
  words' `power`/`mana` near 1.0/2 so the curves stay meaningful.
* Miracles: `favorCost` 3–8 (favor arrives ~1/quest, to every deity);
  cooldowns long — divine is received, not spammed.
* Psionics is the aggressive school: output = points^1.25 within an axis, and
  the per-axis cap is what forces breadth. Tune the *quantities* in `PSIONIC`
  (`data/spellcraft.data.ts`), never a recognition — `sure` and `penetration`
  are earned by `acuity`, so raising their cost means changing what acuity costs.
