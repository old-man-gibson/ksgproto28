---
id: ability-calorie-burn
title: Calorie Burn — eat, burn, and the fight that runs too long
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
  - player-only-carve-out
done:
  - Dishes carry calories, and eating while worn fills a store whose cap grows with the body's trained attributes, and a Refuse-grade dish adds nothing
  - A full store penalises every attribute a little and the penalty fades as the store burns
  - While burning in a fight, a bonus rises exponentially with the calories burned in that fight and holds until the fight ends, and snacking or digestion buy nothing
  - Burning happens only in a fight, faster the longer it runs, and stops at the player's cutoff (default 10%)
  - Past the burn-time line in a fight, max HP is sealed away in absolute HP, and the collapse at 90% of the reference max produces the dead outcome with knockout consequences
  - At cutoff 0 the store can run dry mid-burn, which knocks the player out
  - Sealed max HP always recovers, fast out of a fight once the store is eaten back to full and slowly otherwise, worn or not
  - The collapse's dead outcome shows its own cause line and the existing You died window, and the FightOutcome comment at types.ts names the collapse as a producer
  - The eat event enters the chassis word lists with its reader and consumer
  - COMPLETABILITY.md names Calorie's collapse as the first producer of the dead outcome, with knockout consequences
  - The earning quest exists with the user's captions
  - npm run verify green
---

# The ability, as the user wrote it

Eat a lot to bank excess calories; higher stats store more. Full, the player
takes a small penalty to all stats that slowly shrinks and turns into bonuses
as calories burn. The longer a fight lasts, the higher the burn rate — but
burn more than you can and you "run out of control": unconscious, or even
dead. The power increase grows exponentially toward 100% burned. If the fight
has not ended after X seconds, max HP burns; below 10% of its normal total,
no save, instant death. It recovers over time if the player eats back to 0%
burned.

User's rulings (2026-09-26): the collapse is a **death that is a setback** —
the `dead` fight outcome with knockout consequences; the stop-burning
**cutoff defaults to 10%**. Running dry at cutoff 0 is a knockout: that is the
proposal's reading, which the user did not object to but did not rule on.

# The def

```ts
const BODY = { signal: 'trainedAttrs', attrs: ['con', 'str'] };   // settled 2026-09-26
const STORE_CAP = { curve: 'linear', of: BODY, base: 400, per: 30 };
const SHARE = { signal: 'gaugeShare', gauge: 'kcal' };            // 1 = full, 0 = 100% burned
const BURNING = [{ engaged: true }, { signal: SHARE, gt: { latch: 'cutoff' } }];
const DEBT = { signal: 'ofRefMax', gauge: 'hpDebt', pool: 'hp' };
const OWED = { signal: { signal: 'gauge', gauge: 'hpDebt' }, gt: 0 };
calorie_burn: {
  gauges: [
    { id: 'kcal',      cap: STORE_CAP },
    { id: 'fightBurn', cap: STORE_CAP, perFight: true },      // calories burned in this fight
    { id: 'hpDebt',    cap: { curve: 'const', value: 1e9 }, harm: true },   // absolute HP
  ],
  latches: [{ id: 'cutoff', options: [0, 0.1, 0.25], initial: 0.1 }],
  flows: [
    { gauge: 'kcal', every: { event: 'eat' }, amount: { curve: 'const', value: 1 } },  // × dish calories × grade
    // the burn: absolute, rising with fight length, clamped
    { gauge: 'kcal',      every: 'combatTick', when: BURNING,
      amount: { curve: 'linear', of: { signal: 'engagedSeconds' }, base: -0.25, per: -0.015, clamp: [-4, -0.25] } },
    { gauge: 'fightBurn', every: 'combatTick', when: BURNING,
      amount: { curve: 'linear', of: { signal: 'engagedSeconds' }, base: 0.25, per: 0.015, clamp: [0.25, 4] } },
    // digestion between fights, paused while max HP is owed — worn or not
    { gauge: 'kcal', every: 'minute', settle: true,
      when: [{ engaged: false }, { signal: { signal: 'gauge', gauge: 'hpDebt' }, lte: 0 }],
      amount: { curve: 'const', value: -0.5 } },
    // X seconds: max HP burns, independent of the cutoff
    { gauge: 'hpDebt', every: 'combatTick', amount: { curve: 'const', value: 0.4 },
      when: [{ engaged: true }, { signal: { signal: 'engagedSeconds' }, gte: 90 }, { signal: DEBT, lt: 0.9 }] },
    // recovery: fast once fed back to full, slow always — both out of a fight, both worn or not
    { gauge: 'hpDebt', every: 'minute', settle: true, when: [{ engaged: false }, OWED, { signal: SHARE, gte: 1 }],
      amount: { curve: 'const', value: -25 } },
    { gauge: 'hpDebt', every: 'minute', settle: true, when: [{ engaged: false }, OWED],
      amount: { curve: 'const', value: -0.05 } },
  ],
  projections: [
    { status: 'calorie_sated', settle: true,                                   // the full-store penalty
      intensity: { curve: 'linear', of: SHARE, base: -2.333, per: 3.333, clamp: [0, 1] } },
    { status: 'calorie_burning', when: [{ engaged: true }],                    // the bonus
      intensity: { curve: 'rampTo', of: { signal: 'gaugeShare', gauge: 'fightBurn' },
                   over: [0.3, 1], from: 0, to: 1, k: 5 } },
    { status: 'calorie_wasting', settle: true, ceiling: { pool: 'hp', fromGauge: 'hpDebt' } },
  ],
  trips: [
    { id: 'overrun',  gauge: 'kcal',   on: 'flowEmpties',    once: 'perFight',    outcome: 'knocked_out',
      when: [{ engaged: true }, { latch: 'cutoff', is: 0 }] },
    { id: 'collapse', gauge: 'hpDebt', on: 'accrualCrosses', once: 'perCrossing', outcome: 'dead',
      when: [{ engaged: true }, { signal: DEBT, gte: 0.9 }] },
  ] }
// calorie_sated   mods: all six attributes mult, small negative (× intensity)
// calorie_burning mods: all six attributes mult, positive (× intensity)
// calorie_wasting the max-HP ceiling; no mods
```

Placeholders throughout; the consts are for reading and the authored entry is
a plain literal. Two statuses, not one whose intensity turns negative: removal
paths treat intensity ≤ 0.01 as gone (statuses.ts:504, 908), statusMods would
flip every mod's sign (statuses.ts:541-557), and the fast ward treats any
negative value as a penalty to dull (attributes.ts:300-304).

# How the pieces meet the clauses

| Clause | Mechanism | Fidelity |
|---|---|---|
| eat to bank excess calories | `calories` on dishes × grade, into `kcal` | exact; eating stays manual (game.ts:446) |
| higher stats store more | cap over trained BODY attributes | exact (CON + STR, settled 2026-09-26) |
| full: a small penalty to all stats | `calorie_sated`, 0 at 70% full, whole at 100% | exact |
| the penalty shrinks and turns into bonuses as calories burn | Sated fades from 100% to 70%; Burning rises with the calories burned this fight | changed: the bonus exists while burning in a fight and holds at the level reached until the fight ends |
| exponentially more power toward 100% burned | rampTo, k 5, over the share of the store's capacity burned this fight | exact at cutoff 0 from a full store; at the default 10% it tops out at about half the peak |
| the longer a fight lasts, the higher the burn rate | combat-tick burn, linear in fight seconds, clamped, absolute | exact |
| burn more than you can: out of control, unconscious | at cutoff 0 the store runs dry mid-burn → knockout | changed: the danger is opt-in through the cutoff |
| or even die | collapse → the dead outcome | changed: a death that is a setback |
| after X seconds, max HP burns | hpDebt from 90 s, absolute HP, projected as a ceiling | exact; independent of the cutoff |
| below 10% of normal max HP: no save, instant death | collapse when the debt crosses 90% of the reference max; no roll | changed: dead with knockout consequences |
| recovers if the player eats back to 0% burned | fast recovery at a full store (digestion pauses while HP is owed, so a full store stays full); a slow base that always runs | changed: the slow base keeps a player with no food from being stuck (Invariant A) |

# Why each bend

- **Death as a setback.** COMPLETABILITY.md:82-86: "A death must be a
  setback." `FightOutcome` already has `'dead'`, reserved for the spirit walk
  and produced by nothing (types.ts:4702-4709); the defeat window already
  titles it "💀 You died" (DefeatModal.svelte:40-46). The collapse trip calls
  onDefeat with `'dead'` and its own cause line (the chassis adds both
  parameters): today that is a knockout (hp 1, recovering, retreat to the last
  haven) plus the debt, which stays sealed until it recovers. When the spirit
  walk ships, the collapse inherits it. Update the comment at types.ts:4702 in
  the same change.
- **The cutoff.** Eating is manual only, and offline catch-up runs up to eight
  hours of fights with nobody at the keyboard (offline.ts:46-48). The cutoff
  is the "watch not to exceed" lever, automated. Consumable automation (a
  planned system) is what would make cutoff 0 comfortable.
- **The bonus prices calories burned in this fight.** Reading the store level
  would pay the most to a wearer who never eats, or who snacks to just above
  the cutoff; `fightBurn` (the store's capacity, zeroed when a fight starts
  and ends) pays only for burning. A big store burned in a long fight buys the
  peak, and the long fight also crosses the max-HP line — the trade the user
  described.
- **Recovery that works.** Digestion pauses while max HP is owed, so a store
  eaten back to full stays full and the fast recovery runs until the debt
  clears. Otherwise digestion takes the store below full at the next game
  minute and only the slow path is left.
- **Absolute amounts** (PITFALLS §7): the burn, the debt's accrual and both
  recoveries are absolute; only the 90% line scales with max HP.
- **The reference max** (the chassis card): the debt share and the ceiling
  are both measured against the max HP the body would have with no ability
  projection held, which removes Sated, Burning and the WWM ceiling from the
  denominator. Gear still moves it, which is harmless: collapse fires only
  when accrual crosses the line. (This replaces the "trained constitution"
  wording in the first proposal.)
- **Unworn**: digestion, both recoveries, Sated and the ceiling are `settle` —
  a debt keeps repaying and a full store keeps weighing until it digests.
  Eating, burning, the bonus and the debt's accrual freeze.
- **clearField** removes the bonus for the rest of that fight; the ceiling and
  Sated come back on the next sync (settle projections survive quiet).

Recovery clears `recovering` at 60% of the AVAILABLE max (actions.ts:136,
344-345), so a 90% seal cannot pin a player on the floor.

# Calories on dishes

`ConsumableSpec.calories?: number` (types.ts:2374-2385). After the grants
block in useConsumable (consumables.ts:156-175),
`noteAbilityEvent('eat', max(0, calories × scale))` — the same grade `scale`
the grants use. This story adds the `eat` event to the chassis unions. Refuse
grade gives 0: its negative quality swaps the grants for `queasy`
(consumables.ts:156-164) and must not unbank calories. Calories belong to the
dish × grade, never to the ingredients summed at cook time (dishes stack as
id + grade and forget the basket; summing would also borrow runecarving's
"sum" identity).

Seed values from each dish's existing `well_fed` intensity
(materials.data.ts:265-422): about 400 calories per point of intensity, so a
feast is 800, a stew 400, a loaf 240, a ration 200. Broth and skewered fish
grant no well_fed and get an authored small value. Placeholders.

# Earning quest (suggested placement, flagged for veto; the user captions)

Giver: `head_chef` (Threshold, who already sells raw food). Offered from the
start of band 1.

```ts
{
  id: 'calorie_burn_feast', giver: 'head_chef',
  objectives: [
    { type: 'craft', discipline: 'cooking', count: 20, desc: '…' },
    { type: 'kill', count: 40, desc: '…' },
  ],
  rewards: { ability: 'calorie_burn' },
}
```
