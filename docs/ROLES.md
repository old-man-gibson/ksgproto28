# Roles — what each core system can do on the climb

*The role table that COMPLETABILITY.md §6a's cover rule reads. Surveyed
2026-10-23 on main (merge of #12), run 1 of a fresh save, basic use only.
Re-survey a system's row whenever its content changes.*

Sources: four read-only surveys, one per pair of systems, with headless engine
runs for arcane, divine and the baseline (rusty sword, character level 3, the
Mail Carts on floor 2, 3 fights, 8 seeds). Numbers marked *model* are
arithmetic from data constants, not engine runs. File references are as of the
survey date.

---

## 1. The roles

From COMPLETABILITY.md §6a (a proposal, §6a Q5):

| Role | Filled when the system |
|---|---|
| Damage | kills an enemy faster than a plain rusty-sword swing |
| Sustain | keeps the player alive through a fight or a stretch: healing, mitigation, regeneration, avoidance |
| Condition defence | resists or clears a named condition: poison, burning, bleeding |
| Access | opens a way on the map: a door, a road, a lock |

"Basic use" (§6a Q1): the system's own verbs at their simplest, following what
the game hands over. Buying or looting a system's output does not count.

## 2. The table

✔ fills · ◐ partial · ✖ no

| System | Damage | Sustain | Condition defence | Access | Open in run 1 |
|---|---|---|---|---|---|
| Arcane | ✔ at INT 10; ◐ as the tutorial hands it | ✔ `ward me`, `mend me` | ◐ bleeding only (`mend`) | ✖ | yes |
| Divine | ✔ Holy Fire, once 6 favor and 6 mana are held | ◐ weak (Veil of Misdirection) | ✖ | ✖ | yes |
| Martial | ◐ about neutral | ✖ | ✖ | ✖ | from floor 2 (the tutor) |
| Psionics | ✖ (would fill if opened) | ✖ | ✖ | ✖ | **shut** |
| Cooking | ✖ | ✔ Hearty Stew, Herb-Rubbed Meat | ◐ bleeding only | ✖ | yes |
| Smithing | ✔ iron sword | ✖ no armour recipe listed | ✖ | ✖ | yes |
| Mutagens | ◐ +8.4% | ◐ +13.5% max HP | ✖ | ✖ | **shut** (drops still accrue) |
| Alchemy | ✖ | ◐ weak salve and elixir | ◐ bleeding only | ✖ | brews yes; the skill cannot manifest |

## 3. Coverage today

From floor 2 a fresh save has five core systems open (arcane, divine,
cooking, smithing, martial). With two expected picks, the cover rule asks
5 − 2 + 1 = **4 systems per role**.

| Role | Fills | Partial | Meets the cover |
|---|---|---|---|
| Damage | smithing, arcane (at INT 10), divine (after 6 favor) | martial, mutagens | no: 3 of 4, and two of the three need an untold step |
| Sustain | arcane, cooking | divine, mutagens, alchemy | no: 2 of 4 |
| Condition defence | none | arcane, cooking, alchemy (bleeding only) | no: 0 |
| Access | none | none | no: 0 |

Band 1 names no role, so nothing is broken today. Band 2 cannot ask for a
role until its row reaches the cover.

## 4. Per system

### Arcane

- **Damage.** `fire` is power 0.8 × spell power, 2 mana, 90-tick cooldown,
  35% burning (`spellcraft.data.ts:26`). Spell power is 2 + 1.5 × INT
  (`derived.ts:208`), max mana is INT.
  - At the tutorial's INT 2 (`TUTORIAL_SPELL_INT`, `tutorial.data.ts:67`) a
    cast hits for 4.0, under the sword's 6.2, about once per 29 s.
  - At INT 10 it hits for 17.4, 2.8× a swing. "Read Until It Sticks" at the
    Reading Hall reaches INT 10 in about 19 s.
  - Engine run, ticks per fight: 162 sword only, 135 with fire at INT 2, 83 at
    INT 10.
- **Sustain.** One inscription at INT 10 takes arcana to 8, which makes
  `ward`, `mend` and `me` legal at once. `ward me` gives +3.9 armour for 30 s
  (2 mana, 9 s cooldown); `mend me` heals about 9 HP (3 mana). Engine run,
  knockouts per 3 fights: 1.0 sword only, 0.00 with `ward me`, 0.38 with
  `mend me`.
- **Condition defence.** `mend` heals as a spell, which removes bleeding and
  Seared and eases lacerated (`statuses.data.ts:265, 320, 341`). Nothing for
  poison or burning.
- **Gap.** No NPC, bench hint or bestiary entry says `ward me` or `mend me`,
  or that the handed spell is starved at INT 2.

### Divine

- **Damage.** Holy Fire: 2.0 × spell power (43.6 at INT 10), 6 mana, 14 s
  cooldown, 30% burning (`spellcraft.data.ts:720`). Engine run: 48 ticks per
  fight. It costs **6 favor**; quest 1 pays 5 to each starter god. The
  quest 2 turn-in or the floor 1 clear pays the sixth.
- **Mana.** Miracles spend mana, and max mana is INT. A player who only prays
  (INT 1–3) cannot cast a 5-mana miracle. Nothing links the Divine tab to INT
  training.
- **Sustain.** Veil of Misdirection (12% incoming miss, 30 s) showed no effect
  over noise in the engine run. The six starter-god miracles hold no heal;
  `litany_mending` belongs to Xima, who is not a starter god.
- **Condition defence.** None of the six touches a condition.

### Martial

- The tutor teaches Gather (0.6×, 30-tick cooldown) and Lunge (1.3×, 40-tick
  cooldown, 3% stamina) (`martial.data.ts:217–242`). The loop is Gather, Lunge,
  plain swing.
- **Damage**, per swing against a plain swing (*model*): 0.967× untrained,
  0.998× at 10 repetitions, 1.043× at 100 (about 10 minutes of fighting),
  1.093× at 1,000. At a swing interval of 12 ticks or less it is 0.917×. Every
  fight opens with Gather at 0.6×.
- No technique the tutor teaches carries a buff, a heal or a resistance.

### Psionics

- **Shut.** The tab is hidden, `NpcDef.teaches` takes techniques only, and
  `learnPsiAxis` is called only from the DebugPanel. The Psionics Lab is in
  the hold, behind the first prestige.
- If opened: force 3 is 2.76 × spell power, about 1.56× a swing at INT 1
  (*model*). Sustain needs the vitality axis, which is not a starting axis.

### Cooking

- **Sustain.** Hearty Stew (any meat + any vegetable,
  `disciplines.data.ts:281`): Well Fed for 600 s, +8 max HP and 0.06% of max
  HP per tick, about 0.6% per second, in combat too. Herb-Rubbed Meat heals
  15% max HP at once and adds Well Fed.
- **Reach.** The stove at the Granary Kitchens is open; the Larder Door sells
  the ingredients and two recipe cards; the Warden's quest 1 crate holds 4
  raw meat and 4 herbs. 8–16 s per dish.
- **Damage.** No dish touches damage. Steady Hand is +3% crit
  (`statuses.data.ts:943`).
- **Condition defence.** Herb-Rubbed Meat heals as a salve, which closes a
  bleed (*inferred* from the two rules). No dish has `cures`.
- Food is eaten by hand from the Equipment tab.

### Smithing

- **Damage.** The iron sword (smithing 3) is +7 damage and +2% crit against
  the rusty sword's +3: about 6.2 → 10.2 per swing at STR 1, +65% (*model*).
  Two iron ingots take smithing to 3 and then go into the sword; the Warden's
  crate holds the 6 scrap, hardwood is bought. About 54 s of crafting.
- **Sustain.** The Forges list seven recipes and none is armour
  (`locations.data.ts:817`). `iron_breastplate` exists as a recipe but was
  listed only at the shelved hamlet forge; `soldier_greaves` (armour 10,
  +10 max HP) and `iron_gauntlets` (armour 4) exist as items with no recipe
  at a spot.
- No smithable item carries a resistance.

### Mutagens

- **Shut.** The Chromosome tab and the Vivarium need `flag:unlock_genes`,
  which no content writes. A fresh save is otherwise unlocked, and drops
  accrue unseen: 3% per eligible mutagen per kill.
- With a bare gene in the attacks socket (C grade, weight 2.25): Umbral Edge
  (dolls, floors 2–3) +8.4% damage; Elastic (slimes) +5.1 crit and ignores
  dodge; Vigorous (rats) +13.5% max HP.
- **Condition defence.** The wards for poison, burning and cold drop from
  `toxic`, `fire` and `ice` monsters; none is on the climb.

### Alchemy

- **Run 1.** Brewing works at alchemy level 0 with two-step sequences, but the
  `alchemy` skill cannot manifest (it needs herbalism 3, trained only at the
  hold). Under §6a rule 5, run-1 alchemy cannot count.
- **Damage.** Every bomb and oil needs Quicksilver, which has no live source,
  and a third step (level 5).
- **Sustain.** Pressed Oil → Mendroot is a salve of about 8.3 HP; Spring Water
  → Mendroot is an elixir, Well Fed ×0.65 for 45 s. The bought Healing Salve
  is 25 + 10% max HP.
- **Condition defence.** The salve closes a bleed (*inferred*). Mendroot's
  `cures: ['poison', 'bleed']` (`alchemy.data.ts:120`) is inert, because no
  status removes itself on a `poison` cure tag.

## 5. Baseline: no system

What anyone gets, from swinging, levels, stances, rest and shops:

| Role | Baseline |
|---|---|
| Damage | rusty sword 6.2 at STR 1, +1.2 per character level; Frenzy +10% damage and +15% speed, Crush +40% and −25% speed; **an iron sword bought for about 80 gold**; the oak club found on floor 3 |
| Sustain | rest at a haven (×15 regeneration, about a full heal in 7 s); **bought armour**: shield +4 armour and +8 HP, jerkin +6, greaves +10, breastplate +14; bought salves (25 + 10% max HP); Brace stance (+15% max HP, armour ×1.5) |
| Condition defence | not needed: no monster on floors 1–3 inflicts a condition |
| Access | every door on floors 1–3 reads a fight count, a search flag or a key item |

## 6. Findings

1. **Gold buys the damage and sustain roles.** A bought iron sword equals
   smithing's answer, and bought armour beats every system's sustain at basic
   use. While shops sell system outputs at the tier a hurdle tests, a player
   with no system passes it by buying, which §6a rules out. Either hurdles are
   tuned above what gold buys at that point, or shops stop selling the outputs
   a hurdle tests (Q1 below).
2. **Condition defence has no hurdle and no answer.** No floor 1–3 monster
   inflicts a condition, and no status removes itself on a `poison` cure.
   Mendroot's poison cure is a broken promise today.
3. **Access has no tenant and no hook.** No system's use satisfies any door.
   Making it a role needs a use counter per system (only `spells:inscribed`
   and `miracles:learned` exist) and one parallel door per system, because
   conditions are AND only. §6a rule 1 binds the critical path only, so doors
   that name a system are already legal in optional content (FLOOR_STANDARD.md's
   skill doors).
4. **Untold steps (Invariant B).** Arcane damage needs INT 10, divine needs
   INT for mana and WIS 10 for devotion, `ward me` and `mend me` are written
   nowhere a player looks, and Holy Fire costs one favor more than a fresh save
   holds.
5. **Martial cannot carry a build.** Its taught loop is about neutral and
   fills no other role.
6. **Two of the eight are shut and one is half-shut.** Psionics and mutagens
   need a lift each; alchemy needs herbalism in Threshold (already
   SLICE_REVIEW.md step 1 A4) and an agitator on the shelf.
7. **John never eats or throws.** Nothing in the engine or `tests/john.ts`
   uses food or flasks, so cooking and alchemy cell tests need a driver that
   does.
8. **Doc drift.** BREWING.md's "five starting sequences" need alchemy 5 (three
   of them) or 12 (two).

## 7. Cheapest changes, by roles gained

Proposals, not built. Each names the cell it moves.

| Change | Size | Cells moved |
|---|---|---|
| `poison` gains two removal rules: on a `poison` cure tag (as `cleansing` at `statuses.data.ts:895`) and on a spell heal (as concussed at `:359`) | 2 lines | alchemy condition ◐→✔ (mendroot); arcane `mend` answers poison too; any dish given `cures` |
| An armour recipe at the Forges (`soldier_greaves` or `iron_gauntlets`), one with a resistance | 2–3 lines | smithing sustain ✖→✔, condition ✖→◐ |
| Holy Fire `favorCost` 6 → 5, or quest 1 pays 6 | 1 line | divine damage reachable on the first visit |
| `TUTORIAL_SPELL_INT` 2 → 5, plus a Docent line naming INT training, `ward me` and `mend me` | 2 lines | arcane damage and sustain become told |
| Xima a starter god (`litany_mending`, 3 favor) | 1 line + prose | divine sustain ◐→✔ |
| Lunge 1.3 → about 1.85, or the tutor also teaches Sidestep | 1 line | martial damage ◐→✔ (spacing-dependent), or sustain ✖→◐ |
| A `flag:unlock_genes` find or card | 2 lines | mutagens open: damage ◐, sustain ◐ |
| A `flag:unlock_psionics` find, plus vitality as a starting axis and a teacher | engine (teaching) | psionics open: damage ✔, sustain ◐ |
| Herbalism activity in Threshold; Quicksilver on the Reagent Shelf | 2–3 lines | alchemy countable in run 1; damage reachable at level 5 |
| A cooking damage buff (e.g. damage on Steady Hand) | 1 line | cooking damage ✖→◐ |

## 8. The example builds, today

- **Cooking + divine + smithing.** Damage ✔ (iron sword; Holy Fire after the
  sixth favor), sustain ✔ (stew and meat), condition defence ◐ (bleeding),
  access ✖. Enough for band 1 as built, once the favor and mana steps are
  told.
- **Alchemy as a contender** against martial, mutagens or arcane: not yet.
  Damage ✖, sustain ◐, and its skill cannot count in run 1.

## 9. Questions

Each has a default, used if skipped.

1. **Shops against systems** (finding 1). Default: hurdles are tuned above
   what gold buys at that point of the climb; shops keep selling.
2. **Access as a role** (finding 3). Default: drop it from the critical-path
   roles (three roles: damage, sustain, condition defence); system doors stay
   in optional content.
3. **Which fixes, in what order** (§7). Default: the poison cure line, the
   Forges armour recipe and the Holy Fire cost first, as data-only fixes under
   SLICE_REVIEW.md step 1; the unlocks wait on the Doors step.
