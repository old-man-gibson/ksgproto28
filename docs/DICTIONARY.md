# Content dictionary

Every identifier you can reference when authoring content — anything a
condition, trigger, modifier, tag or counter can target — grouped by the
surface that consumes it. Closed vocabularies are enumerated in full; open
ones (statuses, items, monsters) get their shape and their data file.

Conventions: ids are `snake_case`; namespaced keys use `:` (`kills:tag:slime`,
`technique:<id>`); a `<...>` marks a family of keys.

---

## 1. Modifier targets (`Modifier.stat`)

Used by: equipment/affixes, skill `effects`, style `mods`, exertion `mods`,
achievements/titles/milestones, buffs, rune effects. `op: 'add'` adds;
`op: 'mult'` multiplies by (1 + value); `perLevel` scales value with the
source's level.

**Attributes** (feed base formulas; styles may NOT target these):
`str` `dex` `con` `int` `wis` `cha`

**Derived stats** (`StatKey`):

| key | meaning / notes |
| --- | --- |
| `maxHp` `damage` `armor` | core combat block |
| `hpRegen` | HP/s (1% of Max HP + 0.01×CON). Applied through `heal()`, not the generic pool regen, and multiplied by how restful the activity is — `RECOVERY_MULT` in resources.data.ts (rest ×15, job ×4, everything else ×1). A live fight halves it while stamina is off its ceiling (`IN_COMBAT_REGEN_MULT`); lulls between encounters do not, and winded/exhausted takes it no lower |
| `speed` | action-bar fill for EVERYTHING (combat + activities) |
| `actionBar` | bar size in units (base 1000, floor 100) |
| `attackSpeed` | ⚠ CONVERGING: each mult source multiplies remaining attack TIME by (1 − v), per-source cap ±half/double, 0.5 s interval floor → overflow becomes `extraSwings` |
| `extraSwings` | extra hits per swing (fraction = chance); mostly derived, but moddable |
| `dodge` `crit` `critDamage` `parry` `penetration` `splash` | caps: dodge 0.75, crit 0.9, pen 0.6, splash 1, parry 0.5 |
| `riposte` | share of your damage a parry answers with (base 0.3, UNCAPPED — parry's frequency is capped, its force is not) |
| `spellPower` | magic's damage stat |
| `skillXp` `trainXp` `loot` `goldGain` `travelSpeed` `craftSpeed` | economy multipliers |
| `maxStamina` `staminaRegen` `staminaEff` `staminaPower` | staminaEff floors at 0.5; power = 2 − eff |
| `maxMana` `manaRegen` `manaEff` `maxSpirit` | resource pools; resting multiplies manaRegen by `ResourceDef.restRegenMult` (×3) |
| `resSlashing` `resPiercing` `resBludgeoning` `resHeat` `resCold` `resPoison` `resArcane` `resLightning` `resEarth` `resWind` `resWater` `resLight` `resDark` | capped 0.75; statuses may override/floor |

**Conditional fields on a modifier**: `requiresTag` (an equipped-item tag —
mastery you cannot use pays nothing), `requiresStyle` (only while fighting in
that style id), `requiresMonsterTag` (only vs monsters carrying the tag).

## 2. Damage types (`DamageType`)

`slashing` `piercing` `bludgeoning` `heat` `cold` `poison` `arcane`
`lightning` `earth` `wind` `water` `light` `dark`

Weapon family → type: sword/greatsword → slashing; dagger/bow/spear →
piercing; blunt/staff/bare fists → bludgeoning (`WEAPON_DAMAGE_TYPES`,
combat.ts). Exposure to a type trains `resist:<type>` skills.

## 3. Trigger events (`SkillTrigger.event`)

Stamped by combat onto `combat.events`; a gated trigger passes while the stamp
is ≤ `window` ticks old (default `EVENT_WINDOW = 2`; reactive techniques carry
`window: 20`).

| event | fires when |
| --- | --- |
| `onHit` | an enemy blow lands on you |
| `onCrit` | you land a critical hit |
| `onParry` | you parry |
| `onDodge` | you dodge an enemy attack |
| `onEncounterStart` | the formation spawns |

Planned (§10 MARTIAL.md): `onTechnique:<id>` follow-ups (one deep, never
chained).

## 4. Trigger subjects (`TriggerCondition.subject`)

Used by: player-authored skill/spell/technique triggers AND baked technique
triggers. Ops — numeric: `>=` `<=` `>` `<` `==`; enum: `is` `isNot`.
Conditions AND together. Percentage subjects read 0–100.

| subject | kind | reads |
| --- | --- | --- |
| `player.hpPct` `player.staminaPct` `player.manaPct` `player.spiritPct` | number % | pool vs usable ceiling (one per entry in resources.data) |
| `player.status` | enum | first visible condition on you (status ids) |
| `player.statusCount` | number | how many afflict you |
| `enemy.status` / `enemy.statusCount` | enum / number | same, for the centre enemy |
| `enemy.hpPct` | number % | centre enemy HP |
| `enemy.level` | number | centre enemy level |
| `enemy.count` | number | live enemies in the formation |
| `enemy.tier` | enum | `basic` `veteran` `elite` `ancient` `legendary` `mythic` `divine` |
| `enemy.rarity` | enum | `common` `uncommon` `rare` `epic` |
| `enemy.damageType` | enum | its attack's DamageType |
| `enemy.range` | enum | `melee` / `ranged` |
| `combat.position` | enum | your micro-position (see §8) |
| `enemy.bar` | number % | how close the centre enemy is to acting (≥ 65 ≈ mid-windup — the anticipation read) |
| `technique.<id>` | enum | one per technique: `ready` / `cooling`. Reads COOLDOWN only, so a plan can refuse to start a chain whose exits are unavailable. Hidden from the picker until learned (`TriggerSubjectDef.visible`) |
| `style.active` | enum | the style actually fighting (school or stance id) |
| `style.selected` | enum | the stance you picked |

## 5. Unlock conditions (`UnlockCondition`)

Used by: skills, styles, super-attributes, technique eligibility, (future)
teacher lessons and deep-exploration gates.

| type | shape | notes |
| --- | --- | --- |
| `skill` | `{ id, level }` | state.skills level |
| `attr` | `{ attr, level }` | fusion-aware (a fused super-attr satisfies either component) |
| `stat` | `{ key, value }` | any §6 counter ≥ value |
| `statMax` | `{ key, value }` | counter ≤ value — purity/restraint gates |
| `equippedTag` | `{ tag }` | any equipped item's tag; bare hands count as `unarmed` |
| `quest` | `{ id }` | quest turned in |

## 6. Stats counters (`state.stats` keys)

Bumped via `bumpStat`/`raiseStat`; readable by `stat`/`statMax` conditions and
achievement `statKey`s. Current families:

| key | counts |
| --- | --- |
| `kills` / `kills:<monsterId>` / `kills:tag:<tag>` | kills total / per species / per monster tag (authored + derived tags) |
| `defeats` | your knockouts |
| `combat:attacks` | landed weapon swings |
| `combat:crits` `combat:dodges` `combat:parries` `combat:hitsTaken` | the martial self-learn counters |
| `combat:grazes` `kills:graze` | swings that missed but told anyway, and the ones that finished the job (see `graze`) |
| `used:<family>` | first attack with each weapon family (flag) |
| `weapon:families` | distinct families ever attacked with |
| `attr:<id>` | highest attribute value reached (raiseStat) |
| `skill:levels` | total skill level-ups |
| `gather:<materialId>` | materials gathered |
| `crafts` | crafting completions |
| `gold:earned` | lifetime gold income (all sources) |
| `travel:trips` | arrivals |
| `quests:completed` | turn-ins |
| `miracles:learned` | divine repertoire size |

Adding a counter = one `bumpStat` call; it is instantly targetable by
achievements and `stat` conditions. Martial rep counters are NOT stats yet
(planned: expose as `technique:<id>:reps` for deep-exploration gates).

## 7. Tags

**Action/combat tags** (skill XP routing + discovery — a skill trains when its
`tags` intersect the action's): `combat` `hunt` `magic` `social` `explore`
`travel` plus craft/bench tags (see disciplines.data), school tags
(`arcane` `psionic` `divine`, `spellcraft`), `style:<styleId>`, and
`resist:<damageType>` (compound, from taking typed damage).

**Item/equipment tags** (equippedTag conditions, `requiresTag`, family
gating): weapon families `sword` `greatsword` `dagger` `spear` `bow` `blunt`
`staff` `shield` `unarmed` (pseudo-tag when bare-handed); subgroups like
`katana` (katana are `sword` + `katana`); materials like `metal`. Full list
per item in items.data.ts.

**Monster tags** (hunter achievements, `requiresMonsterTag`, `kills:tag:<t>`):
authored per species plus derived (`swarm`, `non_elemental`, tier tags) — see
bestiary.data.ts `MONSTER_TAGS`.

## 8. Martial vocabulary

**Positions** (`POSITIONS`, each with an identity `color` worn by pills/chips/
card tints): `neutral` ⚖️ #9aa5b1 · `coiled` 🌀 #b58fe0 · `extended` 🫱
#e0a855 · `off_balance` 💫 #e05555 (takes blows ×1.15) · `guarded` 🛡️ #5b9bd5
(takes blows ×0.9). Positions may carry `effects.incomingMult`. `'any'` entry
renders gray (#6b7280). Plain swings reset to neutral; spells don't move you.

Positions carry `effects.incomingMult` and `effects.dodgeMult` (0 is legal and
meaningful — read with `??`, never `||`). A position is SHOWN once a known
technique enters or leaves it (`positionKnown`); optional `PositionDef.unlock`
hides one even then. `spell_ready` 🔮 #7de0c3 (incoming ×1.1) is the spellblade
seat; `SPELL_READY_POSITION` names it, and `setPosition()` is the single place
position changes so that leaving the seat drops the held working.

**Weapon states**: a weapon is wielded | grounded (`combat.grounded`, in the
dirt) | **impaled** (`combat.impaled`, left in a target) | sheathed
(`state.sheathed`, daggers only, toggled on the Combat panel). All three
non-wielded states leave you genuinely unarmed, and the two mid-fight ones are
auto-recovered when the fight ends. Grounded and impaled are deliberately
separate slots — one shared slot would let Ground Draw pull a sword out of an
enemy. A spell may likewise be held: `combat.readiedSpell` (a grimoire uid,
mana paid at ready time, transient). Technique verbs: `move.equipment:
'ground' | 'recover' | 'impale' | 'wrench' | 'draw'`, `move.readiesSpell`,
`move.deliversSpell`; gates: `requiresWielded` / `requiresGrounded` /
`requiresImpaled` / `requiresSheathed: <tag>` / `requiresReadiedSpell`.

**Forced crits**: `move.crit: { always: true, damageMult?, floor? }` — the
technique names the crit instead of rolling for it, at a share of your usual
crit damage, never below `floor`. What a blade already inside them buys.

**Technique forms** (`TechniqueForm`): `rough` (self-learned; +25% stamina
until Perfected, reps ×2) · `canonical` (taught) · `syncretic` (blend; whole
fork vocabulary — debug-only until teachers).

**Mastery ladder**: 10 / 100 / 1,000 / 10,000 reps → Practiced / Drilled /
Honed / Perfected (generic ×1.05/×1.12/×1.20/×1.30 dmg, cd ×1/0.92/0.85/0.75;
data `mastery` notes may rename a rung or `addFrom` entries). Fork at Honed.

**Fork archetypes** (`FORK_ARCHETYPES`): strike — `split` (2 hits × 0.65),
`overwhelm` (×1.6, exits off_balance), `economy` (cd ×0.6, ×0.9), `sweep`
(+0.35 splash, ×0.9), `flowing` (exit → extended; only offered where the exit
actually changes); buff — `lasting` (duration ×1.6), `sudden` (cd ×0.65).

**Entry ways** (`TechniqueDef.from`) — three forms, shortest first:
`'any'` · `['coiled']` · `[{ at, trigger? }, …]`. The long form gives one
motion several ways in, each with its own read: a normal entry and an
opportunistic one ("out of a coil, or out of trouble if they just missed").
A technique fires if **any** way is open — right footing *and* that way's own
trigger — with `TechniqueDef.trigger` gating every way. Practice (`addFrom`)
appends a PLAIN way: repetition opens the motion, it does not add a new read.
Readers: `declaredEntries`/`declaredPositions` (state-free — monsters, content
tests), `techniqueEntries`/`entryPositions` (ledger-aware), `openEntry` (which
way is open right now).

**TechniqueDef fields**: `family` `skill` `trigger` `from`/`to` `move`
(`damageMult` `hits` `penetration` `splash` `inflicts` `buff` `staminaCost`
`momentum` `cooldown`) `unlock` `learn.self` (`{ stat, count }` from §6)
`mastery` `forks`. See MARTIAL.md §1 and §11.

**Rotation-card glyphs** (Combat panel, two-line cards): school marks `🥋`
technique · `📖` arcane · `⛩️` divine · `🧠` psionic; `💧` mana · `🫁` stamina;
**`⟳` cadence** (live countdown, else base cooldown) vs **`⌛` duration** —
never interchangeable, and `⌛` appears only in tooltips/config, never on a
card. `⚡` marks an entry the player has set conditions on; `⏳` prefixes a
blocked status.

**Weapon families** (`WEAPON_FAMILIES`, martial.data.ts — the planner's filter
vocabulary; ids double as `ItemDef.tags` and `TechniqueDef.family`): `sword`
`katana` `unarmed` `dagger` `blunt` `spear` `bow` `greatsword` `staff`
`shield`. A technique with no `family` is **universal** and always on the
graph. Purely a grouping label — selecting one grants and equips nothing.

**Position graph** (`positionGraph(state, defs)` → `PositionEdge[]`): one edge
per entry position, `from: null` for an `'any'`-entry reflex. Live-derived
(mastery `addFrom`, forks, rune surgery already folded in). A MAP, never a
script — see MARTIAL.md §9 and §12. `techniqueBenched(state, id)` reads the
bench, which IS the player's trigger switch (`skillTriggers`).

**Loadout** (`state.loadouts`, a whole fighting identity under one name):
`order` (rotation) · `benched` (ids switched off — legacy, superseded by
`triggers`) · `drilling` · `triggers` (id → `SkillTrigger`, deep-copied both
ways; **authoritative** when present, so applying clears unmentioned ordered
entries) · `spells` (grimoire uids to prepare) · `equipment` (`SlotId` → item
uid). Applying is **grant-free**: unknown ids stay inert, spells re-prepare
only if still in the book and under the prepared cap, a slot re-equips only if
its uid is still in the pack and still passes `canEquip`. The last three are
optional — a plan saved before them falls back to `benched` alone.

## 9. Statuses & their hooks

Status ids and mechanics live in statuses.data.ts (open vocabulary — `poison`,
`bleeding`, `dazed`, `chilled`, burns, shrouds, wards…). Content references
them via `StatusApplication`: `{ id, intensity, chance?, duration?… }` — used
by monster `inflicts`, spell strike `inflicts`, technique `move.inflicts`,
miracle `grants` (blessings ARE statuses).

Status-side hooks a condition can declare (consumed by combat): bar events
(`barFill`, `barDeplete`), `damageTaken`, `combatEnd`, retaliation
(`onAttack`, `onContact`), forced styles, blocked actions (`spell`/`attack`),
disadvantage, damping by modifier origin, resistance overrides/floors,
escalation (`escalatesTo`), succession (`expiresTo`), stacking modes, and
`expireDamage: { type, flat?, maxHp? }` — a parting blow paid ONLY when the
clock runs out, so a condition torn off early (cured, or ripped free by a
technique) deals nothing. Reported through the ordinary damage channel, so
both sides of a fight apply it without new plumbing.

## 10. Resources & pools

`hp` `stamina` `mana` `spirit` (registry: resources.data.ts — new pools get
`player.<id>Pct` trigger subjects automatically). Stamina locks: `low`
(winded, 20% reserve) / `empty` (exhausted). Exertion draws its style's pool:
`ExertionSpec.pool` (default `'stamina'`; the Magic Combat school burns
`'mana'` — the magiknight seam, live).

## 11. Spellcraft vocabularies (for cross-system content)

Arcane word kinds: `noun` `verb` `adverb` `target` `conjunction`
(then/and/but/or/if); words in spellcraft.data.ts. Psi axes: `force` `reach`
`grip` `speed` `clairvoyance` `space` `mass` `vitality`. Deity relations:
`synergy` / `hostility` (hostility wins); miracles cost `favor[deityId]`.
Novelty domains: `bestiary` `library` `dialogue` `arcana`.

## 12. The fight ledger (`FightLedger`, systems/ledger.ts)

What one encounter came to, summed as it happens and committed on the way out.
Read by the defeat window and the combat notebook.

| Field | Meaning |
| --- | --- |
| `outcome` | `won` \| `knocked_out` \| `dead` — **`dead` is the spirit-walk hook and nothing produces it yet** |
| `ticks` | Duration. Stamped as the negated start tick, resolved in `endFight` |
| `endedAt` | Absolute tick it finished on; doubles as the notebook's entry id |
| `foes` | The cast, deduplicated by def, `count`ed, at the highest level met |
| `incoming` | `LedgerSource[]`, worst first — `monster:<defId>`, `cond:<statusId>`, `unknown` |
| `stopped` | `absorbed` / `parried` / `riposted` / `dodged` plus `parries` / `dodges` counts |
| `healed` | Totals keyed by `HealKind`; `healRefused` is what a condition would not let land |
| `outgoing` | `damage` / `hits` / `kills` |
| `afflictions` | Conditions still on you when it ended |
| `transcript` | The fight's folded feed, capped at `TRANSCRIPT_MAX` (30) |

**The size rule.** A ledger is O(distinct sources), never O(ticks) — that is why
it is cheap enough to save (~1.2 KB for a busy five-enemy fight). Every field
except `transcript` must SUM; `transcript` is the one bounded list, capped
rather than grown. Adding a per-event field breaks the invariant and the test
in `tests/ledger.test.ts` that guards it.

**Attribution** happens in `damagePlayer`, the one door HP loss goes through.
Pass a `source`; pass `null` only when the caller has already attributed the
damage itself (condition ticks, which resolve several afflictions as one sum).

**Notebook**: `state.notebook` is `NotebookEntry[]`, newest first, capped at
`NOTEBOOK_MAX` (20). `keepFight` returns whatever it evicted so the caller can
announce it — eviction is never silent.

## 13. Misc registries (open — see their data files)

Items/affixes (items.data), monsters + tiers/modifiers/rarities
(monsters.data), runes: catalogue + patterns/adornments/named combinations
(runes.data) — weapon-context runes may carry `techniqueMods`
(`RuneTechniqueMod`: `rename` / `damageMult` / `cooldownMult` /
`penetrationAdd` / `splashAdd` / `exitTo` / `grantsFork` — graph surgery on
one technique; demo runes `gale_rune`, `earthbind_rune`, `umbral_rune`),
materials + quality grades F–S (materials.data, quality.data),
recipes, NPCs, quests, locations (spots/areas/regions, hidden connections),
achievements, titles, super-attributes, disciplines/benches, styles
(9 stances + schools), skills.

---

*Keep this file honest: when you add an event, subject, counter, tag family,
position or archetype, add its row here in the same commit.*
