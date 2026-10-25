# Character level

*General strength. Built 2026-10-18 (save v56): `data/levels.data.ts`,
`systems/levels.ts`, the bonus in `systems/attributes.ts` (`collectBaseMods`),
the sidebar bar in `ui/panels/Sidebar.svelte`, `tests/levels.test.ts`.*

## 1. What it is

One XP track for the whole character, next to the per-skill and
per-attribute XP. User's brief (2026-10-18): growing stronger is both a
matter of fighting and completing quests in general, and of specialised XP
for specific tasks. Later it is the track classes hang off.

| | |
|---|---|
| Starts at | level 1, 0 XP (`createInitialState`) |
| Pays | +1 to all six attributes per level above 1 (`LEVEL_ATTR_BONUS`) |
| XP from | kills, quest turn-ins, a floor's first clear in the run |
| Resets | with the run (prestige builds the next run from `createInitialState`) |
| Prestige | Head Start boon: a run starts 1 level higher per rank |
| Target | band 1 (floors 1–3) ends at about level 5 |

## 2. The rules

### 2.1 The curve (`xpToNext`)

XP from level L to L + 1 = `LEVEL_XP_BASE × L^LEVEL_XP_EXP`, rounded.
Today 110 × L^1.5:

| level | to next | total to reach |
|---|---|---|
| 1 | 110 | 0 |
| 2 | 311 | 110 |
| 3 | 572 | 421 |
| 4 | 880 | 993 |
| 5 | 1230 | 1873 |
| 6 | 1617 | 3103 |

`state.levelXp` is the XP banked toward the next level, fractional (kill XP
is). `grantLevelXp` takes every level a grant pays for and logs one line
per level: `⬆️ Level N: +1 to every attribute.`

### 2.2 Sources

| source | amount | where |
|---|---|---|
| kill | the kill's earned XP (`killXp`, below) × `KILL_LEVEL_XP_RATE` (1). The monster's `xp` is already level- and tier-scaled (`def.xp × (1 + 0.35 × (level − 1)) × rewardMult`, combat.ts) | `'kill'` listener, `ev.xp` |
| quest turn-in | `rewards.levelXp`, else `DEFAULT_QUEST_LEVEL_XP` (50). Listed in the turn-in log line | `turnInQuest` (quests.ts) |
| floor first clear | `FloorDef.clearXp`, once per run, stamped `level:floor:<id>` | `checkFloorClears` |

- Kill XP ignores `xpGain` and every other multiplier on purpose: the
  level is the one track whose pace is set only by these three numbers.
- **Level gap (user, 2026-10-22).** A kill earns the monster's `xp` ×
  `levelGapXpMult(player level, monster level)`: all of it when the monster
  is at or above the player's level, `1 / gap` when the player is `gap`
  levels above (one above is 1/1, two is half, three a third), and never
  less than `MIN_KILL_XP` (1). `killXp` (levels.ts) computes it once per
  kill in combat; the same number pays skill XP (`grantSkillXp`) and level
  XP (carried on the `'kill'` event as `xp`). Measured the same day: band 1's
  climb barely changes, because its fights are at or near the climber's
  level; the cut bites on farming far below.
- `checkFloorClears` runs after `'kill'`, `'fight:won'`, `'quest:complete'`
  and `'arrive'`: the events that move a clear counter today. A clear met
  any other way pays on the next of those.
- Band 1 values: floors 100 / 150 / 200; quests The First Ascent 100, The
  Faces of Threshold 50, A Taste of Everything 75.

### 2.3 The bonus

`collectBaseMods` pushes `{ stat: <attr>, op: 'add', value: (level − 1) ×
LEVEL_ATTR_BONUS }` for all six, source `Level N`, origin `{ kind: 'level' }`.
So it shows in every attribute tooltip, feeds every formula an attribute
feeds, and is scaled by Endowment like any other add.

- **Not trained level.** Training ranks, milestones and the Cages keeper's
  beginner check (`attrTotal`, training.ts) read `state.attrs[*].level` and
  never see it.
- **Cache.** `modFingerprint` (derived.ts) carries `L<level>`; a level-up
  rebuilds the stat block.

### 2.4 Prestige: Head Start

`head_start`, cost 1 / 2 / 3 / 4 / 5, effect `{ kind: 'startLevel', levels: 1 }`.

- `startingLevel(state)` (legacy.ts) = 1 + levels × rank.
- `applyStartingLevel` raises `level` to it and zeroes `levelXp`; it never
  lowers a level already reached. Called by `applyRunStart` (every new run)
  and by `buyBoon` (a rank bought in review applies to the run in progress).
- The `level:floor:<id>` stamps are counters, so they reset with the run and
  each run pays the floor XP again.

### 2.5 Save (v55 → v56)

The migration back-pays from the record: every `kills:<id>` at the
monster's base `xp` (the level each kill was at is not on record, so this
undercounts), each completed quest's level XP, each cleared floor's
`clearXp` with its stamp. `levelFromXp` turns the total into a level and a
remainder.

## 3. Calibration (2026-10-18, `npm run pacing`, 18 climbs)

John (tests/john.ts) takes no quests, so his XP is kills plus the three
floor clears (450 of it). A quest-taker gets +225 from the Warden's three.

| | bonus off (`LEVEL_ATTR_BONUS = 0`) | bonus on |
|---|---|---|
| lifetime XP at band-1 clear | 2417–3472 | 2409–3126 |
| level at floor-1 clear / floor-2 clear | 2 / 3 | 2 / 3 |
| level at band-1 clear (base 110) | 5 (16), 6 (2) | 5 (17), 6 (1) |
| band 1 | 12.3–16.8 min | 9.4–15.0 min |
| knockouts: floor 2 / gallery / den | 37 / 39 / 8 | 31 / 18 / 5 |
| first boss lost | 7 / 18 | 7 / 18 |

The level makes floor 3 noticeably easier (gallery knockouts halve) and
leaves floor 1 alone (level 2 at the collector). Every john.test bound
holds.

## 4. Changing it

- Pace: `LEVEL_XP_BASE` first (it moves every level the same proportion);
  `LEVEL_XP_EXP` changes how fast later levels slow down.
- Size of a level: `LEVEL_ATTR_BONUS`. Re-run `npm run pacing` after either;
  the floor-3 knockout counts move most.
- A new quest pays `DEFAULT_QUEST_LEVEL_XP` unless it sets `rewards.levelXp`.
- A new ladder floor: give it `clearXp` (tests/levels.test.ts checks band 1).
- A new XP source: call `grantLevelXp`; add it to the table in §2.2.

## 5. Open

- Classes: the reason the track exists; nothing reads the level yet besides
  the attribute bonus.
- The Cages heal cap reads the trained attribute total. Switching it to
  "character level ≤ N" is a one-line change in `keeperTends` if wanted.
- No level cap. The curve slows growth; nothing stops it.
