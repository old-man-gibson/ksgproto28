# Survivors: the enemy generator

> The royale's 99 survivors are people with kits, not stat blocks with a
> species' name (docs/FESTIVAL.md §9.6). This is how a build is made, what it
> holds, and where to change it. Code: `systems/survivorGen.ts`; tables:
> `data/survivors.data.ts`; the engine side: `kitOf` in `systems/monsterStats.ts`
> and `startStagedGroup` in `systems/combat.ts`. Tests: `tests/survivorGen.test.ts`,
> `tests/monsterKit.test.ts`.

## 1. The two halves

**The kit (engine).** `MonsterInstance.kit` (`MonsterKit`) holds a specimen's own
rotation, damage type, reach, resistances, armour and riders. `kitOf(e)` returns
the def's fields with the kit's laid over them, field by field (a field the kit
holds replaces the def's whole; `inflicts: []` removes the def's riders).
Combat reads these six only through `kitOf`: the rotation (`pickMonsterAction`,
`answerPlayerWorking`), the damage type and reach of a blow, the riders it
applies, the trigger subject `enemy.damageType`. Stats read the kit through
`innateArmor(defId, kit)` and `innateResistances(defId, kit)`; both are
recomputed on every read, there is no monster-stat cache to go stale. Loot,
gold, wounds kept, escorts, group, passive and identity stay on the def. A
specimen with no kit is the species as before.

`kit.armor` is a **level-1** figure, like `MonsterDef.armor`: it grows 5% a level,
so a level-36 survivor wears 2.75 times what the kit says.

**The generator (pure).** `survivorBuild(fieldSeed, { id, monsterId, tools })`
returns `{ name, given, archetype, family, weapon, kit, attrBias, power }`. It
keeps its own random streams (never the game's `rand`), one per concern (name,
archetype and weapon, techniques, workings, body), so editing one table moves
only what it feeds. Nothing but `FieldFighter.tools` is saved: the same inputs
always give the same build, and a build is never stored.

## 2. What a build holds

| Part | How |
|---|---|
| Archetype | Weighted by species (`SurvivorArchetype.species`); a species not listed draws at 1. |
| Weapon | One of the archetype's `weapons` (none for the brawler). Its family gives the damage type and reach. |
| Techniques | Two to four from the family's pool. The first is enterable from neutral; each next from where the drawn ones leave a fighter, so none is unreachable. Signature techniques draw three times as often. |
| Rotation order | Workings first, then techniques deepest position first (so a chain runs: thrust is tried before lunge before gather), then mendings. |
| Workings | Casters draw arcane sentences, priests miracles, from distinct `group`s. A priest also keeps a mending with `mending` uses. |
| Armour | A range per archetype (level-1 units), plus resistances. |
| Riders | The archetype's `inflicts` plus the weapon's (`SURVIVOR_WEAPON_INFLICTS`). |
| Emphasis | `attrBias`: the archetype's multipliers, jittered a tenth either way, scaled so the species' attribute total at the royale's starting level is kept. `biasAttrs` re-applies that exactly where the bias is used. |
| Power | `power`: bonus levels for duels between survivors: the archetype's, the wielded weapon's quality, each worn piece, accessory and healing tool. Held to `SURVIVOR_TOOLS.power.cap`. |
| Name | Three syllable lists (`SURVIVOR_NAME_*`) walked in a per-field stride, so no two survivors on a field share a name. The display name is the archetype as a title before the given name, "Spearman Tamsin", so combat's "The <name> hits you" lines read as English; the champion is "Champion <given>". |

A **monster rotation** reads a technique's entry positions, its cooldown and its
move's damage, type, hits and riders, and nothing else: no triggers, no weapon
family, no buffs, no counters. A family's pool therefore holds only damaging
moves with a way in; the tests check every pool entry (`allReachable`, no
buff-only, no counter, no gear-bound move such as `weapon_drop`).

## 3. Tools

`FieldFighter.tools` are ItemDef ids (or a consumable that restores health). They
merge in at build time:

- **Weapon.** The best weapon replaces the one in hand if its quality is higher
  (`weaponQuality`: damage over speed, crit, a staff's spell power). The damage
  type and reach follow it, and the techniques are drawn again from its family on
  the same stream. A `keepsFocus` archetype (archer, mage, priest) keeps its own
  family.
- **Worn pieces.** The best piece of each body slot adds its `armor` mod, divided
  by the armour growth at the survivors' level, to the kit's armour (held to
  `SURVIVOR_TOOLS.armorCap`) and its `res*` mods to the resistances. At most two
  accessories add `SURVIVOR_TOOLS.accessoryArmor` each, and their resistances.
- **Healing.** A consumable restoring health becomes one more `litany_mending`
  entry with `uses: 1`, at the end of the rotation, up to `SURVIVOR_TOOLS.heals`.
  A rotation has no health condition, so a mending fires at its first opening.
  Not reached from the field today: a heal cache heals a survivor on the spot
  and puts nothing in its tools. The branch is a hook for a cache that hands
  out a healing consumable.
- Ids nothing knows are ignored.

## 4. The call site

```ts
import { survivorMember } from './survivorGen';

startStagedGroup(state, bus, SPOTS[ARENA],
  result.engaged.map((f) =>
    survivorMember(field.seed ?? 0, f, survivorLevel(run.clock, f.wins, last), f.hp, last)));
```

`survivorMember(fieldSeed, fighter, level, hpShare, champion)` returns the
`StagedMember` (`monsterId`, `level`, `hpShare`, `kit`, `name`, `attrBias`). For
the champion the monster is `SURVIVOR_CHAMPION` and the name is the given name
plus the champion def's own name. A duel between survivors reads `power` from
`survivorBuild(...)`. Build once per engagement or per hover: it is cheap, not
free.

## 5. Changing it

- **A new archetype:** one entry in `SURVIVOR_ARCHETYPES`. Its family must exist
  in `SURVIVOR_FAMILIES`, its weapons must be ItemDefs of that family, its
  species weights must name real monsters. `tests/survivorGen.test.ts` checks all
  of it, and that every archetype appears among 200 survivors.
- **A new family:** an entry in `SURVIVOR_FAMILIES` and its id in
  `SURVIVOR_FAMILY_ORDER` (tag resolution order: a katana is also a sword, so
  katana comes first).
- **A new species:** add its id to each archetype's `species` weights; a species
  left out draws every archetype at 1.
- **Numbers:** the archetypes' `power` and `attrs` are first guesses, ordered by
  a staged-fight sample of damage dealt to a level-30 build times effective
  health. The mage and the assassin sat at the bottom, the knight at the top.
