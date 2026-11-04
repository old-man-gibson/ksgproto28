# Practice targets

*Built 2026-11-03: `data/practice.data.ts`, `systems/practice.ts`, the hooks in
`grantAttrXp` (attributes.ts) and `addSkillXp` (skills.ts), the scope in
`tickCombat` (combat.ts), the level-XP skip in `registerLevelListeners`
(levels.ts), The Sand's hunt (locations.data.ts), `tests/practice.test.ts`.*

## 1. What it is

Training equipment: a monster that cannot hurt you. A fight against one still
trains what you use (weapon family, stance school, techniques, dodge, parry,
spells), but it pays a fraction of what a real target pays. User's brief
(2026-11-03): "extremely reduced skill and attribute xp, grows diminishingly
with skill and attribute level, minimum 1 xp per second". The floor is per
skill and per attribute (user, same day).

| | |
|---|---|
| Practice target | any monster with `passive: true` |
| Practice fight | every enemy still standing is a practice target |
| Where | The Sand (Threshold, the Ironyard): hunt "Beat the Post", `benchmark_dummy`. The player base's Training Area: `training_dummy` |
| Skill and attribute XP | cut, falling with level, floored per second (§2) |
| Character-level XP | none from a practice kill |
| Hunting XP | none: a practice fight drops the `hunt` tag |
| Unchanged | technique mastery reps, self-learning counters, ambient XP (weather, darkness, chronosense), a flask used from the panel |

## 2. The rule

Every skill or attribute payout P to something at level L, made inside a
practice fight's tick, lands as

```
max( P × CUT × F / (F + L − 1),   min( P, FLOOR × gap ) )
```

- `gap` is the seconds since this fight last paid that skill or attribute,
  capped at `GAP`. The first payout of a fight counts one second. Each skill
  and each attribute keeps its own clock (`CombatState.practiceAt`, keyed
  `skill:<id>` / `attr:<id>`, transient like the rest of the fight).
- The left term is the cut, falling with level. The right term is the floor:
  every skill and attribute the fight exercises earns at least `FLOOR` XP per
  second it is exercised.
- `min(P, …)`: the floor never pays more than the uncut payout, so a post
  never out-trains a real target. On a fresh save DEX is paid 1 a swing and
  about 0.6 XP/s in total; an uncapped floor would raise it to 1 XP/s, above
  what a real fight pays.
- Several payouts to the same skill in one tick: the first takes the floor
  for the gap, the rest have no gap and pay the cut only.

### Constants (`data/practice.data.ts`)

| constant | value | meaning |
|---|---|---|
| `PRACTICE_XP_CUT` | 0.1 | share of a payout at level 1 |
| `PRACTICE_XP_FALLOFF` | 10 | the share halves at level 11, a third at 21, a sixth at 51 |
| `PRACTICE_XP_FLOOR` | 1 | XP per second, per skill and per attribute |
| `PRACTICE_FLOOR_GAP` | 5 | seconds; a longer pause between payouts credits 5 |

## 3. What it pays (measured 2026-11-03, fresh save, seed 7, 600 s)

| | before the rule | with the rule |
|---|---|---|
| swings | 321 (0.53/s) | 292 |
| STR | 1 → 16 (≈ 1.07 XP/s) | 1 → 15 (≈ 0.9 XP/s) |
| DEX | 1 → 13 (≈ 0.6 XP/s) | 1 → 12 |
| Fighting | 20 (≈ 2.4 XP/s) | 16 (≈ 1 XP/s) |
| Unarmed Combat | 22 | 17 |
| Hunting | 14 | 0 XP |
| character level | 1 | 1 |

For a build like this one the cut payout is under the floor from level 1
(Fighting is paid 4.5 a swing, cut to 0.45), so the floor is the rate: about
1 XP per second for each combat skill, and the uncut rate for anything paid
less than that. The cut and the falloff show on builds that land several
payouts a second, and grow as the level rises. For scale: Spar on the same
spot pays about 10 STR XP per second, and a real fight pays 4 + 0.5 × the
monster's level per swing to every skill it trains, plus kill XP.

At 1 XP/s a skill or attribute reaches about 16–17 in ten minutes and about
35–38 in eight hours; past that the level costs (progression.data.ts) leave
the post behind.

## 4. How it is wired

- `tickCombat` checks `isPracticeFight(state.combat)` at the start of the
  tick and runs the tick inside `practising(state, …)` when it holds.
  `practising` sets a module-level scope and restores the outer value.
- `grantAttrXp` and `addSkillXp` pass every amount through `practiceXp`.
  Outside the scope it returns the amount unchanged. Every payout made by
  the fight goes through those two (swings, techniques, counters, dodges,
  parries, spells, arcane word XP via `grantSkillXpDirect`, gene actives,
  telekinetic blades, kill XP, bestiary discovery XP), so a new combat payout
  is covered without touching this rule.
- XP paid outside the tick is not shaped, even while a practice fight is
  open: activities' weather exposure, darkness, chronosense, and a flask used
  from the equipment panel (a click, and it consumes the flask).
- `combatTags` drops `hunt` in a practice fight, so Hunting (tagged `hunt`)
  is not paid. Hunting still manifests on selecting any hunt
  (`checkDiscovery` in actions.ts), with no XP.
- The levels `'kill'` listener skips practice targets. The `'kill'` event
  still fires: kill counters, achievements, titles and the bestiary count a
  practice kill as before. `benchmark_dummy` does not die within a session,
  so on The Sand none of that runs.

## 5. Changing it

- A weaker or stronger post: the four constants. The floor is the number
  that decides the rate for most builds.
- A new piece of training equipment: author it `passive: true`. Nothing else.
- To exempt a passive monster from the rule, it needs a flag of its own;
  today `passive` and practice target are the same thing.

## 6. Open

- Technique mastery reps (10 / 100 / 1,000 / 10,000, docs/MARTIAL.md §6)
  and self-learning counters (`combat:attacks`, `combat:dodges`) count in
  full on a post. An idle night on a post can take a technique a tier or two
  up the ladder.
