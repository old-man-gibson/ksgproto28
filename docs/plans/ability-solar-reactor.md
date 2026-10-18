---
id: ability-solar-reactor
title: Solar Reactor — bank sunlight, spend it in the dark
kind: story
status: draft
system: abilities
parent: unique-abilities
save: ''
updated: 2026-09-26
invariants:
  - completability
  - modFingerprint
  - two-validation-layers
  - player-only-carve-out
done:
  - sunlight() reads 0 under a roof or a dark tag and daylight times a per-weather sun share elsewhere, and settlement lamplight is not sun
  - The bank fills in sun, drains while charged, and keeps draining while the ability is not worn
  - The charged buff follows the same curve as consumption, and consumption grows slower than cap and absorption (content test over the attribute range)
  - Three bursts (a technique charge, a heat, lightning and light boost, and Disintegration Ray) are gated on the reactor's attributes
  - The Ray is priced by the energy in the bank before the spend, not by INT, and trains nothing
  - A technique charge is used only by the next technique that deals damage, and Spell Parry and defensive forms leave it unchanged (tested)
  - The sunlight signal and the technique event enter the chassis word lists with their readers and consumers
  - WEATHER.md lists sunShare as a classification by weather kind
  - The earning quest exists with the user's captions
  - npm run verify green
---

# The ability, as the user wrote it

Bank solar energy outside in the sun. While energy is available, the player
is empowered (stat bonuses). Where there is no sunlight — open fields at night
included — the bank is slowly consumed. Higher main attributes mean a higher
cap, higher consumption and so a higher buff, but consumption grows slower
than the cap and the absorption rate. As power grows: bursts that empower
techniques directly, boost fire/electric/light magic, or fire unique special
attacks like **Disintegration Ray**.

# Sunlight

`sunlight(state)`, beside placeDarkness (exposure.ts:154); `placeOf`
(exposure.ts:139) gets exported for it. This story adds the `sunlight` signal
to the chassis unions.

- **0** under a roof — `region.sheltered` or an `indoor` tag, the roof test
  tickExposure already uses (exposure.ts:198) — or on a `dark` tag.
- Otherwise `(1 − naturalDarkness(hour)) × sunShare(weather.kind)`, with a
  missing weather sample (an unpinned region) read as clear.
- **Not** `1 − placeDarkness`: that reads a settlement street at midnight as
  full sun, because lamplight cancels darkness (exposure.ts:159-161).
- `sunShare` is a table by weather kind — a classification, never a new
  simulated variable (WEATHER.md). Placeholders: clear 1, still 1, gale 0.8,
  mist 0.5, overcast 0.4, snow 0.3, rain 0.2, sandstorm 0.2, storm 0.1,
  blizzard 0.05.

Where the sun is, in the live world: every banded floor (f1-f3) is in
`the_ascent`, which is sheltered (locations.data.ts:7), so the ladder is
sunless. Threshold's outdoor spots — the Foot among them — are open sky; many
Threshold spots are tagged `indoor` and are not. Floor 0's field is open sky
too, but it sits behind a one-way gate (locations.data.ts:62) and is
unreachable after the tutorial. **The loop is: fill in Threshold's open
streets, spend on the ladder.** An `open_sky` tag that un-roofs chosen tower
spots is a possible later addition (both linter layers), not part of this
card.

A game minute is one real second (climate.data.ts:30), so a game day is 24
real minutes and eight offline hours are twenty game days of sun and dark.
Minute flows run while travelling, reading the departure spot's sky
(state.spot stays on the origin until arrival, locations.ts:60, 81-83).

# The def

```ts
const MAIN = { signal: 'trainedAttrs', attrs: ['con', 'wis'] };   // settled 2026-09-26
const CHARGED = { signal: { signal: 'gauge', gauge: 'energy' }, gt: 0 };
solar_reactor: {
  gauges: [
    { id: 'energy', cap: { curve: 'linear', of: MAIN, base: 60, per: 5 } },
    { id: 'primed', cap: { curve: 'const', value: 3 }, perFight: true },
  ],
  flows: [
    { gauge: 'energy', every: 'minute', scaleBy: { signal: 'sunlight' },          // absorption
      amount: { curve: 'linear', of: MAIN, base: 0.2, per: 0.02 } },
    { gauge: 'energy', every: 'minute', when: [CHARGED], settle: true,             // consumption
      amount: { curve: 'power', of: MAIN, scale: -0.02, exp: 0.75 } },
    { gauge: 'primed', every: { event: 'technique' }, amount: { curve: 'const', value: -1 } },
  ],
  projections: [
    { status: 'solar_charged', when: [CHARGED],
      intensity: { curve: 'power', of: MAIN, scale: 0.5, exp: 0.75 } },           // same curve as consumption
    { status: 'solar_primed', when: [{ signal: { signal: 'gauge', gauge: 'primed' }, gt: 0 }],
      intensity: { curve: 'const', value: 1 } },
  ],
  bursts: [
    { id: 'prime', cost: { gauge: 'energy', share: 0.25 }, cooldown: 300,
      requires: [{ signal: MAIN, gte: 40 }], fill: { gauge: 'primed', amount: 3 } },
    { id: 'flare', cost: { gauge: 'energy', share: 0.2 }, cooldown: 450,
      requires: [{ signal: MAIN, gte: 60 }], self: { id: 'solar_flare', duration: 100 } },
    { id: 'ray', cost: { gauge: 'energy', all: true, atLeast: 0.5 }, cooldown: 600,
      requires: [{ signal: MAIN, gte: 90 }],
      power: { curve: 'linear', of: { signal: 'gauge', gauge: 'energy' }, base: 0, per: 0.05 },
      spell: { name: 'Disintegration Ray', icon: '🔆', school: 'arcane', target: 'one',
               manaCost: 0, cooldown: 600, strikes: [{ type: 'light', power: 3.5 }] } },
  ] }
// solar_charged  mods: damage mult, spellPower mult (× intensity) — placeholders
// solar_primed   mods: damage:technique mult (the scoped lane, projected-only)
// solar_flare    mods: spellPower:heat, spellPower:lightning, spellPower:light mults
```

`prime` and `flare` are placeholder ids; every player-facing name is the
user's. The consts are for reading; the authored entry is a plain literal.
Numbers are placeholders. At MAIN 40 they fill the bank in about six game
hours of full sun and empty it in about fourteen dark ones. A content test
asserts that full-sun absorption exceeds consumption for MAIN from 2 to 2000
("consumption grows slower than the cap and absorption").

# How the pieces meet the clauses

| Clause | Mechanism | Fidelity |
|---|---|---|
| bank energy outside in the sun | minute flow × sunlight() | exact |
| empowered while energy is available | ⚠️ **being redrawn.** User, 2026-09-26: "if the reactor is full and the player is in a [sun] area, the buffs are automatically active." The def above still has the old `energy > 0` condition; see "The buff trigger" below | open |
| no sun, open night included: slowly consumed | consumption runs while charged; absorption is 0 in the dark | exact; it also runs in sun, where absorption outpaces it |
| higher main attributes: higher cap, consumption, buff | cap and absorption linear in MAIN; consumption and buff share one exponent-0.75 curve | exact ("main attributes" does not exist in the code — the ability names its own list) |
| consumption grows slower than cap and absorption | exponent 0.75 < 1, plus the content test | exact |
| as the player grows in power | each burst's `requires` on MAIN | approximated |
| empower techniques directly | three charges, each used by the next technique that deals damage | exact |
| boost fire/electric/light magic | `spellPower:heat/lightning/light`, read after the strike's type resolves | exact; psionic strikes are never typed and gain nothing |
| Disintegration Ray | an authored SpellSpec, priced by the energy in the bank when fired | exact |

# The buff trigger (open)

User, 2026-09-26: "if the player's solar reactor is full and is in a [sun]
area, the buffs are automatically active."

- **Automatic case, as read:** `gaugeShare(energy) ≥ 1` AND `sunlight > 0`.
  No `sun` tag exists in the data; "[sun] area" is read as sunlight() above 0
  (open sky, daytime, not under a roof or `dark` tag). A `sun` spot tag is the
  other reading.
- **Not answered yet:** what happens when the bank is not full, or the player
  is out of the sun (the tower is always sunless). Draft default, pending the
  user: a `discharge` latch the player turns on. While it is on and energy >
  0, the buff runs and consumption runs faster. Full-in-sun needs no latch,
  since absorption is already topping the bank up. Without some manual case,
  the bank would never buff anything in the tower, the place it is for.
- The automatic case costs nothing while the bank stays full. That makes the
  sun a free buff for a charged reactor, which is the reading of "automatic".

# Details that matter

- **Unworn**: consumption is `settle`, so the bank drains whether or not the
  ability is worn. Absorption and the buff freeze. This closes the swap loop
  the adversarial pass found (fill outdoors, take it off for the roofed tower,
  put it back on at the boss with a full bank).
- **The technique charge** spends at the burst and is used up by the
  `technique` event (this story adds it to the chassis unions), which fires
  only for moves that deal damage — `damageMult` set, or a counter that does
  not deliver a spell. Defensive forms and Spell Parry (whose damage comes
  from its spell, martial.data.ts:549-553) must not eat a charge; a test
  asserts both. The chassis re-syncs projections after the event flow, so the
  third charge spent on the player's blow stops boosting before an enemy's
  swing in the same tick can fire a counter. `primed` is per-fight: charges
  left at the end of a fight are gone.
- **The Ray**: the chassis reads `requires`, `atLeast` and `power` before it
  deducts the cost, so the Ray is priced by the bank as it stood. `power`
  replaces `vs.spellPower` for this cast (otherwise the ray is priced by INT,
  2 + 1.5 × INT, derived.ts:208, and a CON + WIS reactor fires a weak one).
  No XP tail (castCraftedAttack's tail trains INT and arcane skills,
  combat.ts:2661-2665). `school: 'arcane'` is there because SpellSpec requires
  a school; check at build time that nothing else keyed on the school
  (conflicts, synergies, focus) reads it for this cast.
- The typed boost keys on the RESOLVED type after the `orType` pick; a fused
  "fire and light" strike is boosted as whichever type it lands as.
- Stat buffs via projection only: the chassis adds no modFingerprint part.
  Absorption and consumption live in the ledger, outside the stat block.

# Earning quest (suggested placement, flagged for veto; the user captions)

Giver: `chapel_priest` (Threshold). Offered from the start of band 1. One
small addition makes the natural objective possible: a `sky:minutes` counter,
bumped by tickExposure on each game minute spent under open sky (it already
samples the sky only when no roof is overhead, exposure.ts:198) — one
bumpStat per outdoor minute.

```ts
{
  id: 'solar_reactor_rite', giver: 'chapel_priest',
  objectives: [
    { type: 'stat', key: 'sky:minutes', value: 1440, desc: '…' },   // one game day under open sky
    { type: 'kill', count: 30, desc: '…' },
  ],
  rewards: { ability: 'solar_reactor' },
}
```
