---
id: ability-chassis
title: The ability chassis — slot, ledger, flows, projections, trips, bursts
kind: story
status: draft
system: abilities
parent: unique-abilities
save: ''
updated: 2026-09-26
invariants:
  - completability
  - no-terminal-states
  - modFingerprint
  - two-validation-layers
  - ast-surgical
  - player-only-carve-out
done:
  - GameState.abilities exists (save v55), and an old save loads with nothing earned and nothing worn
  - An ability is earned by a quest reward, worn one at a time, swapped freely outside combat, and refused in combat or while recovering
  - Every part in the type sketch reads data, and systems/abilities.ts owns the ledger and nothing else writes it
  - Projections are written at exact intensities from gridded inputs, and the derived-stats cache sweep passes with a fixture ability worn
  - Unworn abilities run only their settle flows and settle projections
  - An atBarFill latch changed mid-fight takes effect at the player's next bar fill, never between
  - Trips call onDefeat with their outcome and cause line, and fire only during a live fight
  - Per-fight marks, perFight gauges, pending latches and quiet reset when a fight starts and when it ends, so a reload mid-fight carries none of them into the next fight
  - The ability card shows once anything is earned, with gauges, latch controls, and trip and latch lines computed from the def
  - Ability gauge trigger subjects are registered permanently and hidden while unworn, and OfflineSummary carries a trip tally
  - Prestige resets GameState.abilities by default; a player who has bought the keep option carries one earned ability into the next run, and each carry raises that ability's caps, efficiency and power
  - The forge browses and edits ABILITIES (catalog entry, registry re-export, prose registration), and every entry in abilities.data.ts is a plain literal
  - The exhaustiveness test fails when any word in a union has no reader or no consumer (fixture consumers until the three abilities ship)
  - Both validation layers reject a critical-path gate that can require an ability quest (directly or through quest requirements), a curve parameter outside its range, a gauge feeding a non-settle projection with no settle flow unless progress or perFight, and ofRefMax outside a condition
  - npm run verify green
---

# What it is

The thin layer the [parent](unique-abilities.md) describes. It owns one
ledger per ability and turns that ledger into projected conditions. It owns
no combat rule — those are [ability-combat-primitives](ability-combat-primitives.md).

# State

```ts
// GameState.abilities (save v55)
interface AbilitiesState { worn: string | null; earned: string[]; holds: Record<string, AbilityHold> }
interface AbilityHold {
  gauges: Record<string, number>;
  latches: Record<string, string | number>;
  pending?: Record<string, string | number>;   // atBarFill latch choices made mid-fight
  marks: Record<string, number>;               // trips already fired
  quiet?: true;                                // set by clearField for the rest of that fight
  shadow?: Partial<Record<AttributeId, { level: number; xp: number }>>; // attrXp's virtual levels
}
```

- Migration v55 seeds `{ worn: null, earned: [], holds: {} }` with a split
  assignment — never the value of `x ??= …` (PITFALLS §1).
- **Being in a fight is read live**: `{ engaged }` is `state.combat` being
  present, and `engagedSeconds` is `(totalTicks − combat.events.onEncounterStart)`
  in seconds (the stamp at combat.ts:1040), 0 with no fight. No saved counter.
- **Fight-scoped state resets twice**: in `closeCombat` (combat.ts:4098-4106,
  the one path every fight end goes through — onKill, onDefeat,
  abandonCombat, the status knockouts) and at `startEncounter`, as the reload
  guard. Reset = per-fight marks, `perFight` gauges, `pending`, `quiet`.
  Combat state is dropped on save (save.ts:35), so a reload mid-fight lands
  with no fight and the next start clears the rest.
- `serialize` strips `quiet` and `pending`. `deserialize` drops a `worn` or
  `earned` id that no longer exists and snaps each latch to its declared
  options (a load bypasses `setLatch`).
- **Prestige** (user, 2026-09-26): "the unique ability is new every prestige
  but players can choose to later keep it on prestige and gain bonuses to
  efficiency, caps, power etc."
  - Default: the block resets with the run (it is the run's state;
    `createInitialState` rebuilds it), and the special quests are there to
    redo.
  - **Keeping** is bought later: a `PrestigeBoonEffect` kind, `keepAbility`
    (PRESTIGE.md §4 — "extend the union, add its read"). With it, the player
    names one earned ability at the prestige screen, and it starts the next
    run already earned.
  - The legacy block gains `abilities: { carries: Record<id, number> }`: how
    many prestiges each ability has been carried through. It is legacy, not
    run state, so it lives in `state.prestige`, not in `GameState.abilities`.
  - **Carry bonuses** are applied by the chassis, not authored per ability:
    gauge caps × (1 + a·n) for caps, flow gains × (1 + b·n) for efficiency, and
    non-settle projection intensities × (1 + c·n) for power, where n is the
    carry count. Costs, drains and trips are never scaled. The rates are to
    be designed. It adds no `modFingerprint` part: the scaled intensity is
    written onto the projected status, and statuses are already fingerprinted
    by effective intensity.
  - Open, for the user: whether the ledger carries too (a full Solar bank, WWM's
    routed levels) or only the earned status; whether "new every prestige"
    means the same ability re-earned or a different one offered each run; and
    whether keeping is one boon rank or several (one ability per rank).

# The def

```ts
type AbilitySignal =
  | { signal: 'trainedAttrs'; attrs: AttributeId[] }  // sum of TRAINED levels (no feedback loop)
  | { signal: 'engagedSeconds' }                       // live fight, 0 outside one
  | { signal: 'gauge' | 'gaugeShare'; gauge: string }  // share = 0 when cap <= 0
  | { signal: 'martialTotal' }                         // sum of combat-category skill levels
  | { signal: 'techniqueTotal' }                       // sum of state.techniques[*].executions
  | { signal: 'sunlight' };                            // 0..1 — added by the Solar story
type ThresholdSignal = { signal: 'ofRefMax'; gauge: string; pool: 'hp' }; // conditions ONLY (max-HP law)
type AbilityCurve =
  | { curve: 'const'; value: number }
  | { curve: 'linear'; of: AbilitySignal; base: number; per: number; clamp?: [number, number] }
  | { curve: 'power'; of: AbilitySignal; scale: number; exp: number }            // 0 < exp <= 1
  | { curve: 'rampTo'; of: AbilitySignal; over: [number, number]; from: number; to: number; k: number } // 0 < k <= 8, over[0] != over[1]
  | { curve: 'sum'; of: AbilityCurve[] };
type Num = number | { latch: string };
type AbilityCond =
  | { latch: string; is: string | number }
  | { signal: AbilitySignal | ThresholdSignal; gt?: Num; gte?: Num; lt?: Num; lte?: Num }
  | { engaged: boolean } | { wielding: 'melee' };
type AbilityEvent = 'eat' | 'technique' | 'attrXp';   // each added by the story that consumes it
interface AbilityDef {
  id: string; name: string; icon: string;             // words in text/abilities.text.ts
  gauges?: { id: string; cap: AbilityCurve; harm?: true; perFight?: true; progress?: true }[];
  latches?: { id: string; options: (string | number)[]; initial: string | number; atBarFill?: true }[];
  flows?: { gauge: string; every: 'minute' | 'combatTick' | { event: AbilityEvent };
            amount: AbilityCurve; scaleBy?: AbilitySignal; when?: AbilityCond[]; settle?: true }[];
  projections: { status: string; when?: AbilityCond[]; intensity?: AbilityCurve;
                 ceiling?: { pool: 'hp'; fromGauge: string }; settle?: true; cost?: true }[];
  trips?: { id: string; gauge: string; on: 'accrualCrosses' | 'flowEmpties'; when: AbilityCond[];
            once: 'perFight' | 'perCrossing'; outcome: Exclude<FightOutcome, 'won'> }[];
  bursts?: { id: string; cost: { gauge: string; share?: number; all?: true; atLeast?: number /* share of cap */ };
             cooldown: number; requires?: AbilityCond[];
             self?: StatusApplication; fill?: { gauge: string; amount: number };
             spell?: SpellSpec; power?: AbilityCurve }[];
}
```

The sketches in the ability cards use shared consts for readability. **When
authored, every entry in `abilities.data.ts` is a plain literal** — no shared
consts, no spreads — because the forge's path walker steps only through
object and array literals (forge/server/edit.ts:176-187) and a const makes
that field read-only in the forge.

# How the parts behave

**Grid.** Before a curve runs, its input is snapped: shares to 1/20,
absolute gauges to quarter-steps of log2, levels and counts are integers
already. `evalCurve` returns a finite number (0 for any non-finite result).
Every gauge write is clamped finite to `[0, cap]` — serialize does not clamp
(save.ts:25-56), and `null * 5 === 0` after a round trip. Conditions read the
raw ledger.

**Flows** run at three cadences.

- Minute flows run in Game.advance's always-on block beside tickExposure
  (game.ts:199-202), so they tick while travelling and during offline
  catch-up, minute-gated like exposure (cheap across 288k ticks).
- Combat-tick flows run in tickCombat after the one stat read
  (combat.ts:3024).
- Event flows fire from `noteAbilityEvent(state, kind, amount, detail?)` in a
  leaf module (no import cycle). **An event flow adds `amount curve × the
  event amount`.** The events:
  - `eat` — after the grants block in useConsumable (consumables.ts:156-175);
    amount = `max(0, calories × grade scale)`.
  - `technique` — at the top of recordExecution (martial.ts:769), amount 1,
    only when the move deals damage: `def.move.damageMult !== undefined ||
    (def.move.counter && !def.move.deliversSpell)`. Defensive forms also pass
    through recordExecution (combat.ts:3089), and Spell Parry's damage comes
    from its spell, not the technique lane.
  - `attrXp` — inside grantAttrXp (attributes.ts:42-49), fired only for the
    XP a held `routeExcess` diverts (the WWM story); with none held it never
    fires. The chassis converts that XP into **virtual levels** on
    `ATTRIBUTE_PROGRESSION` starting at the ceiling, keeping the remainder in
    `hold.shadow[attr]`; the amount the flow sees is levels completed. So
    routed growth is priced like real levels, not like raw XP.
- After an event flow moves a gauge, `noteAbilityEvent` re-syncs the worn
  ability's projections, so a charge spent mid-tick stops boosting at once.

**Latches.** `setLatch` rejects undeclared options. A latch marked
`atBarFill`, changed during a fight, is stored in `hold.pending` and applied
at the player's next bar fill (the player bar, combat.ts:3110-3134), then
synced; outside a fight it applies at once. Other latches and `setAbility`
sync immediately.

**Projections** are the only stat output.

- Written by `syncWorn`, beside syncGeneStatuses (game.ts:191), at the minute
  gate, in the combat step, after event flows, on setAbility and on applied
  latches. No extra stat read per tick.
- Absent → apply through `reform`, then set the intensity. `reform` is
  module-private (statuses.ts:184): export it, or add an exported projection
  writer beside it. Present → set `held.intensity` directly on the instance
  from `findStatus` (statuses.ts:58; precedent actions.ts:649). `highest`
  stacking alone can only raise (statuses.ts:240-246), and going through
  `inflict` on every sync triggers its side effects.
- Projected defs declare no stacking cap (a later ordinary application would
  clamp a written value down, statuses.ts:276-284) and are removed by source
  `ability:<id>`, which is their exit for the timerless-condition lint.
- Origin `{ kind: 'ability' }`. Excluded from `player.status` and
  `statusCount` (triggers.ts:146-156), from clearField's torn count
  (combat.ts:3328-3333), and from `recordGraft`, `convertHeld`, the graft
  spread and transfers (statuses.ts:214, 868-879) — the adversarial pass found
  ability conditions leaking through graft ledgers.
- A `ceiling` projection sets `held.debtPool = 'hp'` and `data.debt = gauge ÷
  reference max`. statusCeiling reads debt only with a matching debtPool
  (statuses.ts:616-618).

**Reference max** — the max HP the body would have with no ability
projection held: ability-origin mods removed AND the attribute accessor run
without `attrCeiling` (the ceiling is read in the accessor, not as a mod, so
filtering mods alone would keep WWM's ceiling after a swap). Memoized on
`modFingerprint`: recomputed only when the stat inputs change, computed on
demand when absent (a first read, after a load). The same denominator serves
`ofRefMax`, which reads 0 when the denominator is not positive. Gear still
moves it; that is harmless, because a collapse fires only on accrual.

**Unworn = settle only.** While an ability is not worn, only `settle: true`
flows and projections run. Settle flows move a gauge toward rest (a bank
drains, a debt repays, a store digests); settle projections keep a cost
standing until its gauge is at rest. Lints: every gauge feeding a
non-settle projection has a settle flow toward 0, unless it is marked
`progress` (accumulated growth, never drained — WWM's routed levels; nothing
reads it while unworn, so it cannot be banked across a swap) or `perFight`
(reset when a fight starts and ends, and swaps are refused in combat);
`harm` gauges' projections are settle.

**clearField** sets `hold.quiet` for the rest of that fight: projections that
are neither `settle` nor `cost` are removed and not re-applied; `settle` and
`cost` projections come back on the next sync. `cost` marks a worn-only
drawback that must survive an erasure — WWM's attribute ceiling, which cannot
be `settle` because settle runs unworn. The ledger survives — it is not a
status.

**Trips** are evaluated in the combat step, only while a fight is live.

- `on: 'accrualCrosses'` — a flow's step on `gauge` moves the condition's
  line. A denominator moving never fires it.
- `on: 'flowEmpties'` — a draining flow clamps `gauge` to 0 on a tick where it
  ran.
- A trip calls `onDefeat(state, bus, outcome, causeLine)`. onDefeat gains two
  parameters (combat.ts:1548-1574 hard-codes `endFight(state, 'knocked_out')`
  at 1563 and always logs the front monster as the cause): the outcome, and a
  cause line that replaces the monster line when given. The `defeat` bus emit
  stays (achievements count it). The fight notebook shows 💀 for a `dead`
  outcome (CombatPanel.svelte:999 marks every non-win 💫 today).
- Marks are saved, so catch-up never announces a phantom crossing.

**Bursts** are rotation ids `ability:<id>:<burst>`, handled in activeRotation
and pickActive (combat.ts:1589-1700) on their own branch — not through the
`SKILLS[id]` lookup, which a non-skill id would crash (3367-3374).

- At the execution site the order is: check `requires` and `atLeast` (a share
  of the gauge's cap), evaluate `power` against the ledger as it stands, then
  deduct the cost.
- Never spent in resolvedMove (martial.ts:311), which the tooltips re-read on
  every render (ui/lib/format.ts:98, CombatPanel.svelte:129) and combat
  re-reads outside execution (combat.ts:164); techniqueExit follows the same
  rule (combat.ts:2791).
- `self` fires from the buff slot; `fill` adds to a gauge; `spell` goes
  through castCraftedAttack with two new options: `power` (replaces
  `vs.spellPower` for this cast, so an ability's spell is priced by the
  ability) and `xpTags` (so it does not train INT and arcane skills,
  2661-2665).
- `requires` gates the burst ("as the player grows in power").

# Earning and wearing

- **Earned by quest.** `QuestRewards.ability?: string` (types.ts:4380-4391),
  applied in the turn-in beside the other rewards (quests.ts:148-167) and
  named in the rewards line. An ability-granting quest does **not** bump
  `quests:completed` (quests.ts:171), so no quest-count gate can come to
  require one; it therefore also pays no points to the prestige source that
  counts quests (a default the parent lists for veto). The special quests
  themselves are the user's content; each ability card suggests a giver, a
  place and objectives to caption.
- `setAbility(id | null)` mirrors setTitle (titles.ts:37-45): earned ids and
  null only; refused in combat and while recovering.
- **Completability.** Structural: no `UnlockCondition` variant reads ability
  state. Linted, both layers: build the **tainted set** — every quest whose
  rewards include `ability`, plus, transitively, every quest whose
  `requirements` name a tainted one — and reject a tainted `{ type: 'quest' }`
  in a banded FloorDef's gate or clear, and in the connection, encounter and
  explore-gate `requires` of spots in banded areas. Wearing nothing is
  complete by construction — an empty slot projects nothing.

# Surfaces

- **Forge.** A CATALOG entry (kind `ability`, file
  `src/core/data/abilities.data.ts`, root `ABILITIES`), the
  `src/core/registry.ts` re-export (a missing one browses as `{}` — the
  mutagen incident), and a `prose()` registration so the forge can write
  `src/core/text/abilities.text.ts`.
- **Text.** Trip cause lines are prose on the entry
  (`calorie_burn.trips.collapse`), read through the def —
  `tests/logtext.test.ts` only accepts literal `text()` keys, and
  `tests/prose.test.ts` wants the entry id as the key's prefix. Every
  projected status gets a description (STATUSES is fully described): engineer
  register, no numbers.
- **The ability card.** A new panel, shown once anything is earned. Gauges in
  warm hues (the blue arc is full). Latch controls. Each trip's line and each
  latch's effect computed from the def, like the STAT_CAPS table
  (derived.ts:759-778), so no tuned number lives in prose — that card is the
  in-game reference Invariant B asks for.
- **Triggers.** One subject per gauge, `ability.<id>.<gauge>Pct`, registered
  permanently and hidden with `visible()` while not worn (an unknown subject
  evaluates true, triggers.ts:214-218).
- **Offline.** OfflineSummary (offline.ts:12-21) gains a trip tally; the log
  is suppressed during catch-up.

# Tests

- Exhaustiveness: every member of each word union has a reader and a
  consumer. A word enters the unions in the story that first consumes it
  (sunlight and technique in Solar, eat in Calorie, attrXp in WWM); until the three
  abilities ship, consumers are asserted against fixture abilities, and the
  parent's done-list asserts them against ABILITIES. Adding a word later
  fails this test on purpose.
- derivedcache: the 4,000-tick sweep with a fixture ability worn.
- 8-hour unattended catch-up per ability ends finite.
- Swap: settle flows run unworn; nothing else does.
- Fight edges: marks, perFight gauges, pending and quiet reset at close and
  at start; a reload mid-fight carries none of them forward; a trip never
  fires with no fight.
- clearField: cost and settle projections return on the next sync.
