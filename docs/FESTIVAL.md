# The Vermin Festival

*Floors 15–16. Built 2026-10-30 at placeholder fidelity, no save version
change: `data/festival.data.ts`, `systems/festival.ts` (the attempt),
`systems/festivalRules.ts` (pure reads, the lockout, the ladder rules),
`systems/royaleField.ts` (the field simulation), `systems/royale.ts` (the field
and the battle stage), `systems/stash.ts` (the stronghold stash),
`systems/festivalValidation.ts` (content contracts), `ui/panels/FestivalPanel.svelte`,
`ui/lib/RoyaleField.svelte`, `ui/panels/StashPanel.svelte`,
`tests/festival.test.ts`. The rulings are docs/FLOOR_IDEAS.md §5.3 items 6,
10–20, 23–25 and §5.4 Q4–Q8.*

## 1. What it is

Ten rooms of ten, one survivor from each, then one of a hundred. The player
wakes in one of the rooms. An attempt runs from floor 15's dark room to the
end of floor 16's royale. Winning clears floor 16 and pays a reward the first
time in a run; losing shuts both floors for three days.

| | |
|---|---|
| Starts | arriving in `f15_dark_room`, floor 15's landing (the `arrive` event) |
| The door | holds everything worn and carried; issues one plain weapon |
| Floor 15's clear | `boss:f15_dark_room`: the room's last fighter, fought alone |
| The hub | `f15_hall` and `f15_stores`: ten festival days, no fights |
| Floor 16's clear | `boss:f16_arena`: the field's champion, fought alone and last |
| A loss | ejected to the tower's hub; floors 15–16 shut 3 days or to the next prestige |
| State | `state.festival` (run state, optional) and legacy fields on `state.prestige` |

## 2. The door (`startFestival`, `returnGear`)

- **Held**: `inventory`, `equipment`, `sheathed` and `coating`, as plain
  copies in `run.held`. Materials, provisions, flasks, runes and gold stay
  with the player.
- **Issued**: the family whose weapon skill level is highest, ties broken by
  `kills:weapon:<family>` (counted on every kill from now on), then by
  `ISSUED_WEAPONS` order. The family's starter item with no affix and no rune
  slots; `unarmed` issues nothing. It is lent, so `sellItems` refuses it.
- **Returned** when the attempt ends, won or lost: the issued weapon is taken
  back wherever it is, anything else the attempt put in the player's hands
  goes to the pack, and the held set goes back on whole.

## 3. The festival's clock (`run.clock`)

- Starts at 0 when the dark room's door opens. Moves one tick per `advance`
  while an attempt holds the player (`festivalHolds`: a live attempt and the
  player on floors 15–16), travel between its floors included.
- **Offline**: every catch-up tick goes through `catchUpTicks`
  (save/offline.ts), which stops the moment the festival holds the player,
  from the first tick or from the tick a climb lands them in the dark room,
  and puts the rest of the absence in `state.bonusTime.banked`, 1:1 up to its
  cap. The summary reports the ticks skipped (`festivalSkipped`) and what the
  bank took of them (`festivalBanked`). Both catch-up paths, the summarised
  one and the UI's quiet short-gap one, go through it. A gap under a minute
  at boot runs through neither and is not banked, inside the festival or out.
- **Day ten** (`PREP_TICKS`): the player is walked up to floor 16 by the
  ladder. **Entering early** is the same climb: `beginRoyale` sets the clock
  to `PREP_TICKS` and keeps the old value in `run.enteredAt`. Nothing else
  reads this clock, so the jump touches nothing outside the festival.
- The survivors' preparation is `SURVIVOR_LEVELS.growth` levels over the ten
  days; the royale always opens at the end of it, waited out or jumped.

## 4. Leaving

- **Knockouts** on floors 15–16 land at the tower's hub (`retreatSpot` asks
  `ejectionSpot` first). Festival spots are never recorded as havens.
- **The ladder** (`climbTo`, `climbToHub`): from inside an attempt, every
  climb except floor 15 → floor 16 after the door opens is a forfeit, the same
  ejection. Floor 15 → 16 before the door opens is refused. A climb during a
  forced fight is refused as everywhere.
- **Floor 16 has no door of its own.** Outside an attempt's hall the ladder
  refuses it (`festivalLadder` → `closed`), even when floor 15 reads cleared
  from an earlier, lost attempt; the Ascent panel shows the rung with no
  button and says it is entered from floor 15's hall.
- **Any exit** ends the attempt as a loss (`settleExit`, on `arrive` and on
  every tick): gear returned, `state.festival.lockedUntil` set three days of
  the world clock ahead. `floorUnlocked` refuses floors 15–16 until then. A
  prestige replaces the run state, which ends the lockout.

## 5. Rewards and the stronghold stash

- **A win**: `festival:wins` + 1. The first win of a run pays
  `FESTIVAL_REWARD` (the laurel, a placeholder accessory). Reruns pay
  nothing: the festival's monsters drop nothing and carry no gold.
- **Every hundredth win of a run** puts a festival token in the stash
  (`TOKEN_EVERY_WINS`). Nothing shows before the hundredth.
- **The stash** (`state.prestige.stash`): tokens and keep-marked items only.
  `prestigeNow` copies it, and every keep-marked item goes back into it from
  wherever it is (worn, carried, sheathed, in a fight, held at the festival's
  door). Taken out, an item gets a fresh uid. Nothing comes out inside an
  attempt. The UI is a section of the Prestige tab.
- **A token** is spent on one of three, each kept through prestige:
  - the permanent bonus: one stack of `TOKEN_BONUS.mods`, up to `cap` stacks
    (`prestige.festivalBonus`, read by `collectBaseMods`, in `modFingerprint`);
  - a technique: one of three from `TOKEN_TECHNIQUES.pool`, drawn with the
    token's seed (the same three every time it is opened, less those already
    taken), learned canonically now and at every run start
    (`prestige.festivalTechniques`). The pool is a placeholder of existing
    techniques;
  - the regalia (`TOKEN_REGALIA`, keep-marked), into the stash.
- **The hidden title** `first_through_the_door`: a win whose `enteredAt` is at
  most `SWIFT_ENTRY_TICKS` (twelve festival hours after the door opened)
  bumps `festival:swift_wins`, which the title reads. Nothing is written
  before that win.

## 6. The royale's field (`royaleField.ts`)

- A square `ROYALE_FIELD.size` across. Ninety-nine survivors scattered over it
  in the species of `SURVIVOR_SPECIES`; the player on the near edge.
- **Walking**: every fighter walks `speed` a tick toward a goal its strategy
  picks every `thinkTicks`. A strategy (`ROYALE_STRATEGIES`, a registry with a
  forge catalog entry) is a move — `nearest`, `weakest` (within `sight`),
  `centre`, `away`, `edge`, `hold` — and an optional condition on the
  bearer's health share and the field's count. The first strategy in a list
  whose condition holds decides; none holding means `nearest`. The player
  ranks up to three (`state.festival.plan`, kept between attempts); each
  species fights with its own list from the same registry.
- **By hand**: a click on the ground or the arrow keys set
  `field.player.target`; the player walks there and the plan resumes on
  arrival. The player walks only between fights.
- **Survivors' duels**: two free survivors closer than `engageRadius` duel for
  `duelTicks`; one weighted roll on their strength picks the loser, who
  falls. The winner gains a win (a level, up to `winCap`, when it meets the
  player) and a wound that heals at `healPerTick`.
- **The player's fights**: free survivors within `engageRadius` of a free
  player become a staged fight at the arena, up to `maxGroup`, at their own
  levels and wounds. Won, they leave the field.
- **The champion**: the last survivor, always fought alone. A fight never
  takes every survivor left, duels need a third standing, and with two left
  both walk at the player. Its def is `SURVIVOR_CHAMPION`, the arena's boss
  line, so its fall is the win and floor 16's clear.
- A fight dropped without an ending (a reload mid-fight) releases its
  survivors to walk again.

## 7. Dials and what was not measured

| Dial | Where | Today |
|---|---|---|
| Dark room waves and levels | `DARK_ROOM_WAVES` | 2, 3, 3, then 1; levels 32–35 |
| Survivor levels | `SURVIVOR_LEVELS` | 34 + 3 over ten days + up to 2 for wins; champion + 1 |
| Field pace | `ROYALE_FIELD` | size 60, speed 0.2, duels 100 ticks |
| Lockout | `LOCKOUT_TICKS` | 3 world days |
| Token bonus | `TOKEN_BONUS` | +3% damage and max HP a stack, cap 5 |

Not measured: whether a floor-15 build wins the dark room with a starter
weapon and no armour (a probe with every attribute at 40 lost it; at 60 it
won), and how long the royale lasts for a real build (about 70–120 seconds of
play in probes with strong fighters). John stops at floor 6.

## 8. Open

- The festival's own monsters, the technique pool and the rewards are
  placeholders.
- Whether "carried" should also take provisions and flasks at the door.
- The stash's UI sits on the Prestige tab, not in the hold.
