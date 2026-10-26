# Prestige

*The harvest re-climb. Built 2026-09-12 (save v50): `systems/prestige.ts`,
`systems/legacy.ts`, `data/prestige.data.ts`, the Prestige tab and the
post-prestige overlay.*

## 1. What it is

A run ends by choice once bands 1 and 2 of the Ascent are cleared (floor 6, since 2026-10-25). The **harvest**
measures how far the run went along several axes and pays whole **points**;
the next run starts fresh with only the **legacy block** (`state.prestige`)
carried over. Points buy **boons**, which hold across every later run.

This is the alpha's shape of the prestige economy settled 2026-07-31
(memory / base-building notes): meta-currency earned from progress depth,
most things reset, persistence is bought. The base itself does not exist
yet, so the boons are the small set of hooks that already do — see §4.

## 2. The three tables (`data/prestige.data.ts`)

All declarative, so the preview can be computed from them.

- **`PRESTIGE_UNLOCK`** — what lights the button. The goblin warchief
  (`slain:f6_great_hall:goblin_warchief ≥ 1`), the same latch floor 6's
  clear reads, so the two can never disagree. It was floor 3's boss until
  2026-10-25 (docs/plans/bands-2-3.md R1).
- **`PRESTIGE_SOURCES`** — what the harvest measures. Each has a `measure`
  (a `stats` counter, cleared ladder floors across all towers, the sum of
  skill levels, or achievement tiers claimed) and `per`, the units per point.
  Whole points only; the remainder is the forecast. A source with `growth`
  pays **geometrically**: point n needs `per × growth^(n−1)` units in total.
  Gold is the one such source (user, 2026-09-12: linear gold "can end up
  granting too many points") — 1 point at 10,000, 2 at 100,000, 3 at
  1,000,000. `pointsFor` / `nextThreshold` (prestige.ts) are the one place
  both shapes are computed; the harvest, the forecast and the readout all go
  through them.
- **`PRESTIGE_BOONS`** — what points buy. `cost[r-1]` is rank r's price and
  `cost.length` the max rank. Effects are one of three kinds, §4.

## 3. The rules the code enforces

- **The preview IS the harvest.** `harvest(state)` is the one function. The
  pre-prestige tab shows its output; `prestigeNow` banks the same output.
  `forecast(state)` is the same arithmetic one step ahead ("+1 at 3 more
  quests"). This is the house rule from the base-building notes — a preview
  can never disagree with what it previews — implemented as there being
  nothing else to disagree with.
- **Every source accrues from acting at all** (floors, quests, bestiary,
  skill levels, achievements, gold), the same rule the tower's gates follow.
  A player who engaged with no subsystem on its own terms still harvests.
- **The post-prestige overlay is save state.** `prestige.review` is set by
  `prestigeNow` and cleared only by `leaveReview`. It survives a reload; the
  UI shows it whenever the flag is up, with no backdrop click and no Escape.
  Leaving requires either `spentThisReview ≥ 1` or a two-step confirmation.
- **What carries.** `prestige` and `createdAt` (the world seed — same
  world, same weather). Everything else is the run's and resets. The reset
  is `createInitialState`, so a new run is exactly a new save plus legacy —
  there is no second "fresh state" to drift.
- **`stats['prestige:count']`** mirrors `prestige.count`, so content gates
  read it like any counter. The hold's door at the Foot is the first
  (`requires: prestige:count ≥ 1`).

## 4. Boon effects (`PrestigeBoonEffect`)

Never a `Modifier` — every kind is a one-shot grant or a read at its use
site. Only `startLevel` reaches the stat block, through the character level,
which is in `modFingerprint` (LEVELS.md §2.3).

| kind | applied | read by |
|---|---|---|
| `startGold` | `applyRunStart` on every new run; and at purchase, for the run in progress | — |
| `skillCap` | — | `skillCap` (skills.ts), alongside the run's own `capRaised` |
| `preparedPages` | — | `preparedCap` (spellcraft.ts) |
| `talent` | — | `collectBaseMods` (attributes.ts): a skill's effects × `1 + rate × rank × peakLevel × prestiges` |
| `endowment` | — | `effectiveAttrsFrom` (attributes.ts), last pass: an attribute's effective value × `1 + rate × rank × peakAttr × prestiges` |
| `foresight` | — | `skillRevealed` (skills.ts) and the Skills panel's milestone line: locked skills and the next milestone show at any progress instead of only at 90% of the threshold (`REVEAL_FRACTION`) |
| `wayfinding` | — | `hasWayfinding` (legacy.ts), read by the Quests and Skills panels: go links to quest givers and objectives outside town (town places have them without the boon), and to every known spot that trains a skill or attribute (`trainingSpots`, actions.ts). See NAVIGATION.md §5 |
| `startLevel` | `applyRunStart` on every new run; and at purchase, for the run in progress (`applyStartingLevel`, levels.ts: raises the level to 1 + levels × rank, never lowers) | `startingLevel` (legacy.ts). See LEVELS.md §2.4 |

**Endowment** (user, 2026-09-12) is talent's twin for attributes, the
second `auto` boon: same product, the peak being the TRAINED level recorded
into `prestige.peakAttrs` at each prestige. It scales the effective value
after every other modifier, so it reaches every formula an attribute feeds
(and `attr` unlock conditions, which read effective values by design). The
name: "aptitude" belongs to the creature table in base building; an
endowment is what a body is born with. Shown as a second bar and a byline
on the attribute rows of the Skills tab, and as a factor in the attribute
breakdown (`AttrBreakdown.endowment`).

**Talent** (user, 2026-09-12) is the one `auto` boon: rank 1 is granted by
the first prestige, free (`cost[0] === 0`, linted). `prestigeNow` records
every skill's level into `prestige.peakLevels` (a max, never lowered), so
the product is constant within a run: the count and the peaks only move at
a prestige, the rank only at the boon list. It is the one legacy that
touches the stat block, so the rank and count sit in `modFingerprint`
(derived.ts). At `rate = 0.0001`: a modest run (peak 30, one prestige) is
+0.3%; rank 5, peak 300, ten prestiges is +150%. A skill no finished run
carried has no peak and no bonus.

`systems/legacy.ts` holds the reads (`legacyCapRaise`, `legacyPreparedPages`,
`boonRank`) apart from the harvest, because skills.ts and spellcraft.ts
import them and the harvest imports the tower runtime, which imports combat,
which imports them. Add a kind: extend the union, add its read or its
run-start grant, and the boon list needs nothing else.

The three ceilings are the first consumers of the cap-raise lane WEATHER.md
noted was unwired. They apply whether or not the skill has manifested — a
bought ceiling is a legacy, not a reward the run has to have seen.

## 5. The UI

- **Tab** (`panels/PrestigePanel.svelte`): visible once the run could
  prestige OR once any run has (`prestigeVisible`). Shows the harvest now,
  the forecast per source, the two-step Prestige button (or the lock terms),
  and — after the first prestige — unspent points, what was bought, and the
  boon list, so points left unspent in the overlay are never stranded.
- **Overlay** (`PrestigeModal.svelte`): the harvest that just paid, the
  boon list, and Leave. `lib/PrestigeBoons.svelte` is the one boon list both
  views render.
- The Game exposes `prestige()`, `buyBoon(id)`, `leavePrestigeReview()`.
  `prestige()` assigns the next run INTO the state object (as `hardReset`
  does), so listeners registered against it keep working.

## 6. Open

- Numbers are first guesses: `per` on every source, every cost.
- The boon list is a placeholder set of what already had a hook. The
  designed set (structure permanence, plot unlocks, persistent storage,
  aptitude ranks) waits on base building.
- Whether the tab should also hide again after a prestige until the queen
  falls anew (currently it stays, so the spend list is reachable).
- The goldfish never prestiges; a prestige mid-walk would restart its run.
