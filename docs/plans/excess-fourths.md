---
id: excess-fourths
title: Excess — permission to speak a word a fourth time
kind: story
status: planning
system: arcane
parent: yshicna
save:
updated: 2026-08-13
invariants:
  - completability
  - spell-cache-purity
  - modFingerprint
  - no-terminal-states
done:
  - A fourth utterance replaces the working rather than multiplying it — STACK_POWER/STACK_MANA still stop at three
  - Each authored fourth breaks the invariant of the system it touches, and says which one in a comment
  - A word with no authored fourth simply cannot be overspoken
  - The sacrifice confirmation lists every working it will silence, before confirming
  - A fourth saturates the SPOT it is spoken in; two different fourths in one spot break the area rather than stacking
  - Nothing in the implementation gates a fourth to the player — monsters lack the content, not the permission
---

# Excess (the fourth utterance)

> **Design for the first three fourths is in [NEXT.md](../NEXT.md) §Miracle A +
> §The sacrifice + §Dead Spells.** Everything settled on 2026-08-13 — the
> persistence model, the four new fourths, and the coverage table — is HERE.
> New work goes in this card, per [migrate-next-into-cards](migrate-next-into-cards.md).

Four is a hard ceiling, not a rung. Past three, a working stops being an effect
and becomes a standing condition on the world.

**Every fourth is hand-authored per word**, like a miracle — generating tier-4
names from a pattern is REJECTED, because a fourth fire and a fourth crush have
nothing mechanically in common. This is what makes the story shippable
incrementally: **three words is a real release**, and the god's roster *is* the
list of words it has opinions about.

The authoring test for each new one: *what invariant does this word live inside,
and what does it look like broken?*

The hazard is never self-damage — it is loss of control and loss of spoils.

## The currency is vocabulary

The god does not sell, it **desires**. An entry appears once a word has been
spoken 1000 times in its tier-3 form, and paying consumes the word entirely.

⚠️ **This needs a SECOND counter.** `wordUses` counts distinct inscribed
sentences and is deliberately unfarmable. The god's counter is the opposite —
raw utterances, the same sentence a thousand times if you like. **Two counters,
opposite philosophies, both correct. Do not "fix" the farmable one.**

## How far a fourth reaches — SETTLED 2026-08-13

A fourth is a standing condition on the world, so it needed a scale. Three were
considered: per-encounter only, per-spot saturation, and a growing radius
sampled like weather. **The ruling is per-spot saturation.**

- **A fourth saturates the SPOT it is spoken in**, over some number of uses,
  and stops there. No radius, no spread to neighbours, no field.
- **Fields are rejected outright, and the reason is composition.** Two
  overlapping fields would have to be told how to combine, and there is no
  honest answer to "what is a frozen rotting swamp". Spots do not overlap, so
  the question never arises.
- **Two different fourths saturating the same spot do NOT stack. They break the
  area.** The place becomes a **broken area** — a third thing, authored, not
  computed from its ingredients. See [broken-areas](broken-areas.md); it is a
  `todo` seed and deliberately undefined for now.
- The saturation counter is per (spot, fourth): a spot holds one kind, and the
  second kind is what breaks it rather than what deepens it.

⚠️ **Why this is cheap, and why weather was the wrong model.** Weather is
**derived** — a pure function of (world seed, region, tick), no save footprint,
no update loop, no offline catch-up because there is nothing to catch up
([WEATHER.md](../WEATHER.md)). A player-caused stain is stateful by definition
and can never join that model. Spots, on the other hand, already carry `tags`
unioned down region ∪ area ∪ spot, and `'dark'` is already a *mechanically real*
place tag — a dark-tagged place is black at any hour, trains Darkvision and
applies night-fighting penalties regardless of the clock. **A saturating spot is
a counter plus a derived tag.** Most of it exists.

⚠️ **Store `plantedAt` + intensity and compute decay AT READ TIME**, never in a
tick loop. That is the same trick that makes weather free of offline catch-up; a
stain that decays in a loop turns the 8-hour offline cap into a balance
question.

## Who may speak one — SETTLED 2026-08-13

**Monsters may use fourths on principle. They will not have access to them, out
of practicality.**

The consequence for the code is the whole ruling: **nothing in the
implementation may gate a fourth to the player.** The absence is *content*, not
a rule — the same bearer-agnostic discipline the monster-genomes epic runs on.
If a fourth ends up needing a `if (bearer is player)` branch to work, that
branch is a bug in the design, not a shortcut.

Nothing needs to be built for this. It is a constraint on how the rest is built.

## The roster

Seven authored, of which three have prose in NEXT.md and four were designed on
2026-08-13. **Names below are proposals, not settled** — see Open items.

### fire ×4 — noun

Burn everything: every combatant takes fire damage every tick, and loot has a
chance of burning away. Sears become near-permanent, curable only by a long slow
ritual. *(Breaks: statuses are temporary.)*

### twice ×4 — adverb

Repeated casting that begins hitting every fighter indiscriminately and
intermittently, the player included, over time spilling into randomly casting
spells from the grimoire without consuming mana. *(Breaks: casting requires mana,
and requires you.)* It should absolutely be able to fire the *other* excess
workings — that is the moment the god stops being a bargain and becomes a
problem.

### crush ×4 — verb

Everyone takes damage on taking any action, slowly incurring `concussed` stacks;
armor is crushed inward, reducing existing armor and dropping into the negatives
until it becomes its inverse. *(Breaks: armor has a floor.)*

### light ×4 — noun — proposed name `noon`

The world bleaches. As the fight ramps, **all elemental damage converts to its
physical variant**; armor is then stripped away, and everyone's maximum HP burns
off. Sun-bleaching by sheer magnitude.
*(Breaks: a blow's damage type is a property of its source.)*

**The interlock, and the best thing about it.** Flat armor bites physical types
only — `PHYSICAL_TYPES.has(type) ? Math.min(raw, stats.armor) : 0`
(`systems/combat.ts`, in both `monsterSlice` and `incomingSlice`). Elemental
damage skips armor entirely and argues with `resElemental` instead. **So
bleaching your fire into bludgeoning starts as a NERF** — your blaze used to
ignore that harness and now pays for it. Then the armor burns off and the same
blow becomes a slaughter. The ramp dips before it climbs, which makes this a
working you commit to rather than one you switch on. Do not "fix" the dip.

**The conversion table** — the six the user assigned, plus five filled in off
the triangle identities in [ARCANE.md](../ARCANE.md) (pierce = precision and
penetration, cut = delivery, crush = weight):

| element | becomes | why |
|---|---|---|
| earth, cold | bludgeoning | mass |
| water, wind | slashing | the jet, the edge |
| lightning, dark | piercing | the bolt, the needle |
| heat | bludgeoning | fire without heat is pressure — the blast |
| acid | slashing | corrosion without chemistry is abrasion; it keeps attacking the surface |
| poison | piercing | venom without its argument is the fang |
| arcane | slashing | "frays what touches mana" — fraying is a cut |
| light | **nothing** | it is the bleacher |

**Light is deliberately exempt.** At full bleach the only non-physical damage
left in the world is light — so a light build is the one build the working does
not cannibalise, and the god has just taken `light` out of the player's mouth
forever. The one damage type that thrives under your working is the one you can
never speak again. Same register as *you master many words to earn the right to
be told that mastery never mattered.*

- `zero` is a second exemption **by definition rather than authorship** — it
  carries `element: 'arcane'` with `untyped: true`. ⚠️ Check whether `untyped`
  short-circuits before the slice or merely zeroes resistance; if the latter it
  needs an explicit skip or the bleach will catch it.
- `iron` is already `element: 'piercing'`. It is physical before anything
  starts and simply does not bleach.
- **Riders do NOT convert. Only damage does.** A bleached burn stays `seared`
  and its ticks land as bludgeoning — the wound keeps its name and loses its
  nature. ⚠️ **Do not widen this.** Rewriting each status's `element` would
  collide with the wuxin layer, the `if` conjunction and every trigger keyed on
  a condition. DoT ticks route through the same two slice functions, so the
  correct behaviour falls out for free.
- **Armor floors at ZERO here.** That is the line against crush ×4, which drives
  it below zero until it inverts: crush is weight, light is erasure. It also
  makes this **much cheaper to ship than crush ×4**, which is blocked on the
  damage pipeline's zero-clamp.
- **Spoils tax: bleached drops.** Items come out of the fight faded — a rarity
  step gone, an affix burned out. Inherits NEXT.md's standing demand that
  destroyed loot *name what it destroyed* or it is not a punishment.

### venom ×4 — noun — proposed name `miasma`

A rotting swamp. Damage stops arriving as flat values and becomes damage over
time on everything, escalating the longer a fight runs in the area. A new
`disease` condition gives an attacker a chance to spread **its own current DoTs**
to whatever it hits in melee, ramping from 0 up to full share.
*(Breaks: a hit is a discrete thing that resolves now.)*

**The machinery already exists.** `grafts` on `seeded`/`rootbound`
(`data/statuses.data.ts`, `systems/statuses.ts`) already keeps a ledger of
conditions on a bearer and propagates a share of it. `disease` is that ledger
with two fields changed:

| | `rootbound` | `disease` |
|---|---|---|
| trigger | timer (`spreadEvery`) | melee hit |
| topology | broadcast to all other enemies | contact, attacker → target |
| share | fixed `0.25` | ramps 0 → full |

⚠️ **This belongs to `venom`, not to `seed`, even though it borrows seed's
machinery.** Both words are `element: 'poison'`. `seed` is patience and network;
`venom` is rot and contact. Reusing `grafts` must not blur them — `seed` still
needs its own, different fourth.

#### Swampness — the meter, settled 2026-08-13

**"Swampness" is a per-fight meter** that climbs while a fight runs in a
saturated spot. It does two things:

1. **It sums the DoTs.** All damage-over-time in the fight scales off **how high
   swampness has REACHED**, not where it currently sits — a high-water mark, not
   a live reading.
2. **It pulses on its own.** The swamp inflicts poison DoT on everyone **every
   two-thirds of a second**, escalating with the meter. Nobody is standing
   outside it; the toxic aura overwhelms the whole fight.

**Peak rather than current already has vocabulary in the codebase.** `StatusDot`
carries `fromPeak`, whose comment reads: *parts named in `fromPeak` are set by
the deepest single wound; the rest scale with the accumulated total.* Swampness
is a `fromPeak` quantity. Use that word for it — do not invent a second name for
a distinction the status system already makes.

**This is where the two scales marry.** Spot saturation is the persistent layer
and sets how fast swampness climbs and how high it may go; the fight-local meter
is what actually bites. A lightly-soured spot is unpleasant; a fully saturated
one is a fight nobody walks out of intact.

⚠️ **Two-thirds of a second is not expressible on the tick.**
`TICKS_PER_SECOND = 10`, so 2/3 s is 6.67 ticks. Either round to **7 ticks**, or
run an **accumulator** that fires on crossing. The accumulator is worth the extra
lines if the off-beat is the point — every other clock in the game lands on
whole seconds, and a pulse that deliberately does not is a way of making the
swamp feel like it is not keeping your time. **Pick deliberately; do not let it
be an accident of rounding.**

⚠️ **The pulse is itself a DoT, so effect 2 feeds effect 1.** Left open it
compounds on itself without bound. Two honest answers: exclude the aura pulse
from its own amplifier (bounded, dull), or let it compound and make the **cap**
the lever. Prefer the second — slow compounding growth is what this whole
mechanic is for — but the cap must exist and must be a named constant, not an
emergent consequence of the numbers.

**Counterplay is poison resistance.** "Everyone" includes the player, and
`resPoison` is the dial they can build. Same shape as ice ×4 running its cooldown
penalty through cold resistance: each of these fourths hands back exactly one
stat as the way to stand in it.

#### What the meter fixes, and what it creates

✅ **Resolves the soft-lock flag.** The earlier worry was that all-DoT with no
flat damage means nothing dies fast, and a swarm becomes a wall. The pulse
answers it: **the swamp is the killer.** Fights end because the swamp ends them,
not because you win them.

⚠️ **Which creates the spoils tax automatically, and it is the right one.**
Things die *to the swamp* rather than to you — so drops from a swamp-killed
enemy should come up **rotted**: degraded, or gone. That satisfies the god's
stated hazard register (loss of control and loss of spoils, never a splash tax
you route around) without needing a rule invented for it, and it is the exact
parallel of light ×4's bleached drops. Same standing demand applies: it must
*name what it destroyed*.

- The per-fight escalation is the same ramp light ×4 wants. **One shared ramp
  counter on `CombatState`**, beside `momentum` / `spoken` / `refuted`, not one
  per working — swampness and bleach are two readings of one meter.

### ice ×4 — noun — proposed name `winter`

The fight cools. Speed drops linearly; skill cooldowns are lengthened by the
relative decrease in speed × cold resistance. **Physical ranged attacks stop
working entirely — the projectile freezes mid-air.** Every actor is continuously
inflicted with `chilled`, and casting a fire spell inflicts `wet` on the caster
as well as the target, the target's `wet` rising faster.
*(Breaks: fire dries you.)*

**This is the cleanest answer to the authoring test in the whole set,** because
the rule it inverts is written down in the data as a comment:

```ts
// Fire drives it off a layer at a time. Nothing else does.
removal: [{ on: 'damageTaken', damageTypes: ['heat'], effect: 'unstack' }]
```

Under `winter`, fire *applies* `wet`. The fourth does not add a rule; it
reverses one.

- `chilled` already exists at `speed ×-0.4` and escalates to `frozen`, so
  continuous chill is authored data rather than new code.
- **"Physical ranged" is the scope, settled 2026-08-13**: bows, crossbows, guns
  — anything with a projectile. **Ranged workings still function.** Winter stops
  ammunition, not magic.
- ⚠️ **The player has no ranged attacks yet.** `resRanged` exists but nothing
  passes the flag (`systems/combat.ts` says so in a comment); only monsters
  carry `range: 'ranged'`. So on the day this ships it shuts off enemy archers
  and costs the player nothing. **That is authored ahead of content on purpose**
  — the clause becomes symmetric the day ranged weapons exist, and must not be
  written in a way that has to be revisited then.
- The cooldown coupling is genuinely new: `speed` and `cooldownMult` are
  separate dials today, so this invents a relationship rather than bending one.
  Cheap, but it has no precedent to copy.

### gloom ×4 — noun — proposed name `midnight`

Each use in the same combat reduces the influence of outside factors — area
modifiers, weather, environmental modifiers — until they stop functioning
entirely. The first cast halves them; the second raises "dark saturation" toward
100%. Creatures without high-level darkvision or another special sense are
treated as **maximally blind, regardless of how far below the threshold they
are**. *(Breaks: darkness is a slope you can climb out of.)*

Darkness today is a gradient: `DARK_MISS_CHANCE` and `DARK_DODGE_PENALTY` scaled
by `darknessFactor(state)`, eroded linearly to zero at Darkvision 50
(`systems/exposure.ts`). `midnight` makes it a cliff — a threshold test, and
everyone under it gets the maximum.

**This is the one whose persistence question was already answered by shipped
content**, since `'dark'` is a real place tag with mechanical teeth. Saturating a
spot with `midnight` is the player stamping that tag onto the world.

- ⚠️ **"Monsters are of the dark and pay nothing."** They have no darkvision
  value and are simply exempt from darkness penalties today. Blinding creatures
  below a threshold means building a monster-side darkness path that does not
  exist.
- ⚠️ **Weather is not yet a mod source at all** ([WEATHER.md](../WEATHER.md),
  §Rules for future work). Suppressing weather modifiers is suppressing
  something unbuilt. Either this ships after weather-as-mod-source, or its first
  version suppresses place tags and area modifiers only and grows into the rest.

## Coverage — what still lacks a fourth

The lexicon is 40 words: 31 foldable (14 nouns, 10 verbs, 7 adverbs) plus 6
conjunctions and 3 targets that cannot be mastered at all. **7 of 31 have a
fourth. 24 do not.** A word with no authored fourth simply cannot be overspoken,
so this table is the roadmap and also the shape of the god's appetite.

**Nouns — 5 of 14 done.** Remaining, with the identity a fourth has to break:

| word | tier 3 | identity to overspeak |
|---|---|---|
| spark | bolt | quick lightning, jolts |
| water | deluge | gentle; wets — sets up cold |
| gust | storm | light, far; **displaces** — steals the exit a technique meant to land on |
| stone | mountain | heavy; leaves splinters |
| seed | wildwood | patient; does nothing, remembers everything, then spreads it |
| acid | liquefaction | always corrodes; eats armour, not health |
| zero | null | UNTYPED — nothing resists it, nothing fears it |
| iron | adamant | piercing; magnetizes (crit synergy) |
| arcane | anathema | frays what touches mana; unravels |

⚠️ `gust` is the one to be careful with — it is the only noun that reaches into
the martial layer, and its legality under the martial prime directive is not
incidental. Read [MARTIAL.md §9a](../MARTIAL.md) before authoring its fourth.

**Verbs — 1 of 10 done.** Remaining: `pierce`, `fly`, `expand`, `ward`, `burst`,
`mend`, `grasp`, `cut`, `undo` (added 2026-09-28 — anti-magic, ARCANE.md §14).

**Adverbs — 1 of 7 done.** Remaining: `slowly`, `quickly`, `gently`, `dimly`,
`intensely`, `viciously`.

**Conjunctions and targets — out of scope by construction.** They cannot stack
today. If ever opened: an excess conjunction is a sentence whose clauses start
relating to *other spells in the grimoire* instead of to each other. Filed, not
opened.

### Taxonomy by word kind

Use this to author the rest. The three original fourths are a noun, an adverb
and a verb, and they break three different layers:

- **Excess noun** → the substance stops being an event and becomes permanent
  scenery. *(All four new fourths are nouns, and all four obey this.)*
- **Excess verb** → the mechanic escapes its trigger and starts applying to
  actions it was never about.
- **Excess adverb** → the manner detaches from the sentence and modifies *your
  casting itself* rather than the spell. (Adverbs are already "how it is
  spoken"; overspeak one and you break speech.)

### A naming convention, which is not a mechanical pattern

The four proposed names — `noon`, `winter`, `midnight`, `miasma` — are the
*world's* name for the thing: three times and an air. That is the "becomes
permanent scenery" rule turned into a naming register.

⚠️ This does **not** reopen the REJECTED note about generating fourths from a
pattern. That rejects deriving tier-4 *mechanics* from a shape, and these four
mechanics have nothing in common. A shared naming register is the opposite
problem, and it costs nothing.

## Open items

- **Names are proposals.** `noon`, `winter`, `midnight`, `miasma` are unratified.
- **Broken areas are undefined** — [broken-areas](broken-areas.md), a `todo`
  seed. Nothing here can ship a second fourth into a saturated spot until that
  card says what happens.
- **Composition order between light ×4 and venom ×4.** Light rewrites a blow's
  *type*; venom rewrites its *form*. Both can be live at once, and `twice ×4`
  can fire either unbidden. Pick type-then-form or form-then-type once, and
  write it into the slice functions' comments.
- **Threading the ramp into the slice functions.** `monsterSlice` and
  `incomingSlice` are pure and stat-only — neither can see combat state — and
  there are ~24 call sites across `systems/combat.ts` and `systems/alchemy.ts`.
  An explicit parameter is noisy but honest. ⚠️ **Do not reach for an ambient
  module-level "current bleach"**; that is the kind of hidden global this
  codebase spent real effort keeping out of `composeArcane`.
- 🗄️ **SHELVED 2026-08-13 — monsters as TARGETS of a player-only system.**
  Distinct from the settled ruling about monsters as *speakers*.
  `statusCeiling` is bearer-agnostic in its signature but only
  `systems/resources.ts` consumes it — the player — so burning a monster's max
  HP needs `monsterStats` to read it; darkness penalties need a monster path
  that does not exist; monster armor needs to be wearable down. Three fourths
  need this and it is one job. **Do not raise it again until a fourth is
  actually being built.**

  It stays here rather than moving to [LONGTERM.md](../LONGTERM.md) on that
  file's own rule: the shelf takes *additions to things that already work*, and
  this is a live dependency of unbuilt work, which is a different animal.

  ⚠️ **The one thing that cannot be deferred with it:** whichever fourth ships
  first must either carry its own slice of this, or narrow its own claim. Left
  alone, light ×4 burns nobody's max HP but yours and gloom ×4 blinds nobody at
  all — a working that silently does nothing to monsters is the "lying to the
  player" case, and that is debt rather than a shelf item.
- ⚠️ **`modFingerprint`.** Any of these reaching the player's derived stats as a
  new mod source must enter the fingerprint, or the memo serves stale stats for
  the whole fight.
- ⚠️ **The stale comment in `data/statuses.data.ts`** claiming monsters carry no
  armour at all predates monster-stat-parity and is now wrong. Fix it while
  working nearby.
