# Psionics

Will, imposed. Where an arcane spell is a **sentence** and a divine miracle is a
**relationship between gods**, a psionic working is an **arithmetic**: points
injected along eight axes, read as the quantities they multiply and divide into.

> This is the internal spec: why it is shaped this way, and what is banked for
> later. The player-facing account is the wheel itself — every formula below is
> printed on it (`PSI_QUANTITIES[].formula`), on purpose.

## 1. Where it sits among the schools

Three schools, three *kinds* of depth. The guards matter as much as the designs,
because two systems reaching for the same trick is how a game gets mushy:

| School      | Depth is…       | Emerges from                                             | Guard |
| ----------- | --------------- | -------------------------------------------------------- | --- |
| Arcane      | **syntactical** | word order, stacking, conjunctions                        | ~10 rules, combinatorial meaning; no lookup of sentences |
| Divine      | **relational**  | pairwise deity rules, hostility-beats-synergy, succession | miracles are received whole; never composed |
| **Psionic** | **arithmetical**| **products and ratios of the axes**                        | **nothing reads a raw point count to decide what a shape DOES** |

That last guard is the whole system. It was added because the previous design
scored a shape against a table of named workings and took the best match, which
meant players did not *compose* — they searched for the designer's answer key,
and every new working added an entry rather than depth.

## 2. The one law

**The axes are not effects. They are terms.**

`deriveShape` (in `systems/psionic.ts`) turns the eight axes into seven
quantities, and every field of the resolved `SpellSpec` is a function of those.
No branch anywhere asks "how much force is there" to decide what kind of thing
the working is.

The payoff is that opposite outcomes fall out of the same two inputs:

> Mass held still is a **wall**. The same mass in motion is a **hammer**.

That is not content. It is `inertia = mass − speed` and `momentum = mass × speed`
disagreeing, and the word "wall" appears nowhere in the resolver.

## 3. The quantities

| Quantity | Formula | What keys off it |
| --- | --- | --- |
| `pressure` | `force + grip` | how much is imposed at all; the denominator of `inward` |
| `momentum` | `mass × speed` | strike power, concussion, and it spoils acuity |
| `inertia` | `max(0, mass − speed)` | the standing wall |
| `acuity` | `clairvoyance ÷ max(1, reach + √momentum)` | piercing vs. bludgeoning, `sure`, penetration |
| `awareness` | `clairvoyance × reach` | spread, and therefore splash vs. hitting everyone |
| `coherence` | `space ÷ max(1, force + mass)` | how much the shape withholds; what it leaves standing; how long an inward face is worn |
| `purchase` | `grip ÷ (1 + speed)` | how long an affliction holds on them |
| `inward` | `vitality ÷ max(1, vitality + pressure)` | **the aim** — which way the whole working faces (§3a) |

Three things worth noticing, because they are doing most of the work:

**Denominators are the mechanic.** `acuity` divides sight by the ground it must
cover, so spending points on reach is *what makes a working missable*.
`coherence` divides structure by everything trying to burst out of it, so the
same four points of space hold a light shape together and are torn apart by a
heavy one. `purchase` divides grip by how fast it is all happening, because a
grab made at speed does not hold.

**Every axis must cost you something somewhere**, or its zero says nothing.
Grip was the counter-example for a while: it appeared in no ratio, so pouring
points into it had no downside and "no grip" was a mere absence. `purchase`
fixed that from both ends — grip finally has a quantity where it is the
numerator, and speed gained a SECOND cost, having been nearly pure upside
(shorter cooldown, feeds momentum) with `inertia` as its only casualty.

**`inward` is a share, not a count.** A will split between mending and imposing
does neither fully — no rule saying "and no force" is needed to make a pure
vitality shape a healing. Half-and-half genuinely heals half as well *and* hits
half as hard.

**Zero stays meaningful for free.** Every quantity built from a product is 0 the
moment either factor is. "No speed, no mass" is still a statement about a shape;
it just no longer needs a `max: 0` band to be one.

**Products are square-rooted before they meet the curve.** `mass 10 × speed 10`
is a hundred, which is not a number of points; `√100` is ten, which is exactly
the ten-and-ten that bought it (`onPointScale`).

### 3a. `inward` is an AIM, not a healing switch

Every quantity has two faces. The outward one is what it does to them; the
inward one is what the identical number does to you. `inward` is the share
going each way, and **nothing is ever discarded** — a working aimed wholly
inward is not throwing away its momentum, it is spending it on speed.

| Quantity | Outward | Inward |
| --- | --- | --- |
| `pressure` | the blow | Braced — armour |
| `momentum` | the hammer, concussion | Kinetic Haste — action speed |
| `inertia` | Kinetic Bulwark — a wall in the world | Rooted — blunt resistance, dazes land at half |
| `acuity` | Read — their dodge and parry drop; plus `sure`, piercing, penetration | Foresight — enemy blows miss outright |
| `awareness` | spread: splash, then every foe (and it carries the afflictions) | Wide Sight — physical resistances |
| `coherence` | Compressed — thickened space costs them time | **persistence itself** — how long every other inward face is worn |
| `vitality` | — | the mending |

⚠️ **A school never borrows another's signature condition.** Two systems
reaching for the same trick is how the pillars go mushy. `unfolded` and
`folded_space` are Ik'Thel'the's *Unfold Geometry* and *Fold Space* — the two
halves of that deity's whole identity — and psionics originally reached for
both, one per coherence face. It now authors its own (`psionic_compression`),
and coherence's inward face grants no condition at all: the obvious one is Fold
Space, and persistence is the better role anyway, since it is worth more the
more faces you are already wearing. `pacifiesFlankers` (D'Enjalle's Honor
Bound) was declined on the same grounds. A test sweeps every two-axis shape and
fails if psionics lays any condition owned elsewhere.

Authoring rather than borrowing also fixes scale for free: native conditions
carry per-unit values sized for quantity-scale intensities, so nothing needs
the cap a borrowed unit-scale condition demanded.

**Every quantity must stand on its own, in both aims.** This is the law, and it
was learned the hard way: `inertia`, `acuity`, `awareness` and `coherence` were
originally nothing but *modifiers on a strike* — penetration, `sure`, splash,
withheld power. A shape built out of them had nothing to modify, so forty
points of reach/speed/clairvoyance/space resolved to a spec that did literally
nothing. A test now sweeps every three-axis shape for it.

Sight and structure are not force and never were, so their outward faces cannot
ride a blow: `SpellStrike.inflicts` only lands when its strike **dealt damage**
(combat.ts), which a forceless working never does. They arrive as
`SpellSpec.afflicts` instead — `grants`' mirror, laid on the target by the
working itself whether or not anything was struck. That field is new and
general; arcane, divine and monsters can all use it.

**`reach` and `speed` are the exception, deliberately.** They are the delivery
axes — adverbs. They say how a working arrives, not what it is, so a shape made
only of them is empty on purpose, exactly as an arcane sentence of nothing but
adverbs is not a spell. The sweep asserts this stays a decision rather than
drifting.

**`reach` and `speed` alone are named honestly.** A delivery-only shape resolves
to *Empty Gesture*, described as "Reach and Speed only shape how a working
arrives. This one has nothing to deliver" — every derived quantity being zero is
exactly the delivery-only case, so the readout can say why rather than leaving
a blank line above "Does nothing at all".

This is what makes vitality the most leveraged axis rather than the dullest:
**it is the aim dial.** Vitality with nothing else to redirect is mending;
vitality with momentum is speed; vitality with held mass is immovability;
vitality with sight is precognition. Spending it costs you the entire outward
half of the working, which is a real price for a real choice.

Magnitudes are the aimed quantity itself, passed as the grant's `intensity` —
`statusMods` scales `mod.value × intensity`, so the status carries what ONE
unit is worth and the shape decides how many. Only the gate lives in `PSIONIC`.

**Lifetime comes from `coherence` alone** (`PSIONIC.inwardDuration`, in ticks):
structure is what makes a working persist. 20s bare, past three minutes fully
structured. That is coherence's third job, alongside withholding power and
carrying penetration.

The regression this fixed: before the mirror, `inward` gated only healing, so
`mass 10, speed 10, vitality 10` multiplied 100 momentum by `outward = 0` and
silently binned twenty of its thirty points. Now it is Kinetic Rush, +30%
speed. Any future quantity must state both faces or it will have the same hole.

### The needle/hammer fork

`acuity` carries `√momentum` in its denominator on top of reach. Sight cannot
hold a pinpoint on something it is also swinging, so **a shape is a needle or a
hammer and cannot be both** — with no rule anywhere saying so. This is a
deliberate extension of the original `clairvoyance ÷ reach`: reach spreads sight
across the field, momentum spreads it across the moment.

## 4. What the spec is built from

All constants live in `PSIONIC` (`data/spellcraft.data.ts`).

```
hold    = coherence / (coherence + 1)          // saturating: never withholds everything
outward = 1 − inward
spread  = reach + √awareness × 0.5

power   = (curve(force)×0.7 + curve(√momentum)×0.85 + curve(grip)×0.25)
          × outward × (1 − hold×0.4)
type    = acuity ≥ 2 ? piercing : bludgeoning
pen     = min(0.95, acuity × (1 + coherence) × 0.09)
sure    = acuity ≥ 2
target  = spread ≥ 4 ? every foe : one          // else splash = min(0.75, spread × 0.2)
heal    = curve(vitality) × 0.35 × (0.5 + inward)
cooldown= max(40, 110 × 0.93^speed)
mana    = 2 + total points
```

`curve` is `n^1.25` — psionics is deliberately the most aggressive school in
power-in→power-out, gated by teachers rather than by cost. Within one axis that
curve is superlinear; past the per-axis cap, breadth is the only way to keep
scaling, which is what makes the cap a design lever rather than a wall.

**Riders on the strike** — `dazed` from grip (`grip × 0.18`), `concussed` from
momentum (`√momentum × 0.09`).

**What the shape leaves standing** — the aimed quantity must clear its gate,
and then IS the granted intensity (see §3a for the full table). Gates are
thresholds, because a status either lands or does not — but they are thresholds
*on derived quantities*, so each is a region of the space rather than a recipe.
Any shape reaching the region gets it, including shapes nobody enumerated.

The outward faces work the same way against the other side: `kinetic_bulwark`
at `inertia × outward ≥ 3` (mass going nowhere IS the wall — structure only
decides how long it stands), and `psionic_read` / `unfolded` laid on the target
as `afflicts`. Power withheld from the blow by `hold` comes back as the blow
mattering more.

## 5. Recognitions

`PSI_RECOGNITIONS` is the descendant of the old working table, and it is
deliberately toothless. **A recognition supplies a name, an icon, a description,
and one flat bonus** (`PSIONIC.recognitionBonus`, 1.12× to strikes and healing).
By the time one is looked for, the spec is already fully computed.

The needle is unerring because its acuity is 2, not because an entry says `sure`.
Deleting the entire table would change what workings are *called* and nothing
else — which is the test that the depth lives in the quantities.

Regions are bands over derived quantities (`inertia ≥ 3, coherence ≥ 0.4`). Raw
axes are permitted for the rare case where the axis *is* the statement (Still
Mind wants vitality itself, not a ratio), but reaching for one is a sign the
space is missing a quantity.

**Overlap resolves by nesting.** A region nested inside another is the more
particular claim about the space and wins when both fit — never declaration
order (`subsumes` / `beats`). `priority` overrides. Two content tests guard the
table: no two regions may be identical, and every region must be reachable by
some shape a maxed mind can hold.

Adding a name here is pure content and can never add depth. That is the point.

## 5a. Shapes held in mind

A psionic reallocates rather than looks things up, so getting back to an
allocation you already know must not mean re-dialling eight axes.
`state.psi.memorized` holds up to `MAX_PSI_MEMORIZED` (8) named shapes;
recalling one only fills the wheel. Nothing is cast, nothing is inscribed, and
no teacher tier is checked — what you do with the allocation afterwards is the
grimoire's business.

Deduplicated by `shapeKey` (zeros dropped, axes sorted — the same identity rule
`spellKey` uses), so "already memorised" and "already inscribed" agree about
what counts as the same shape.

The field is **optional**, which is why this needed no save migration: absent on
every save written before it existed, and read through `psiMemorized`.

⚠️ **The proxy trap that cost this feature a silent failure.** The UI holds game
state in a Svelte 5 deep `$state` proxy. Writing
`const held = (psi.memorized ??= [])` looks right and is not: the assignment
*expression* evaluates to the raw `[]`, while the proxy stores its own proxied
copy, so every `push` lands on an array nothing will ever read. Assign on one
line, read back on the next. It only misfires when the property was absent —
i.e. only for existing players, and never in a plain-object unit test.

## 5b. Focus, the psionic pool

`focus` is an ordinary pool — mana's shape, not spirit's: it is spent and it
refills (`maxFocus`, `focusRegen`). **Psionic workings pay for themselves out of
it and never touch mana**, which is the point of one pool per school: the arcane
pool is not psionics' to draw on. `shapeSpec` sets `focusCost` (base 1, plus a
quarter per point shaped) and leaves `manaCost` at zero.

The rate is gentle next to the mana cost it replaced (2 + one per point) because
the pools are not comparable: `maxMana` *is* INT and runs past 50, while
`maxFocus` is `6 + 0.3×CHA + 0.1×WIS` — about 18 at CHA 40.

⚠️ **The base is what makes the school playable, and it was originally too
mean.** At a base of 3, a CHA-1 mind held three focus, so anything past eight
points cost more than it could ever hold — shapeable, inscribable, and
permanently uncastable, discovered only at a greyed-out button. Six is enough to
use psionics while untalented for it and still leaves CHA as what makes you good
at it. The bench now says so up front when a shape asks more than the mind
holds, rather than letting it be found later. One useful consequence — the very largest shapes
cost more focus than a narrow mind can hold, so they simply never fire until CHA
widens. "You cannot hold that thought yet" is a better wall than an arbitrary
cap, and it is enforced by the ordinary affordability gate in `pickActive`, not
by special-casing.

### Casting with nobody to fight

A working whose effect lands on its own caster does not need an enemy.
`castUtility` (systems/spellcraft.ts) casts one outside combat: it costs exactly
what it costs in a fight and runs on `state.useCooldowns`, the same clock
consumables and flasks use, so a haste held between errands is focus that will
not be there for the next fight.

`isUtilityWorking` decides eligibility from the **resolved spec**, not the
school — anything with `grants`, or a self-heal, qualifies. An arcane ward and a
divine blessing are castable on exactly the same terms a Kinetic Rush is.
Strikes are simply not resolved out here, so a shape that both hits and buffs is
still worth casting for the half that applies, at full price.

Kinetic Haste is the reason this exists. `speed` is the action-bar fill rate for
*everything* — a craft bar fills at `speed × craftSpeed` (actions.ts) — so haste
already quickened crafting and every activity the moment it could be worn out of
combat. Travel is the one thing measured on its own stat, so `psionic_haste`
names `travelSpeed` explicitly. Verified: Speed 51 → 63 and Travel Speed ×1.00 →
×1.24 at intensity 8.

### Two relationships to one pool

This is what makes focus more than mana with another name, and it answers what
fire-and-forget workings do once buffs are sustained:

| Working | What it touches | How it comes back |
| --- | --- | --- |
| **Instant** (damage, heal) | spends the **pool** | `focusRegen` — seconds |
| **Sustained** (a held shape) | eats the **ceiling** | `ceilingDecay` — far slower |

Overload rides the same split. Held, it erodes the ceiling gradually — a squeeze
you can watch and abort. Fired instantly, the whole debt lands at once, which is
why instant overload is planned to split into ceiling loss *and* immediate
backlash: without that it would be strictly safer than the sustained kind, since
you pay once and walk away instead of managing an escalating drain.

It completes a triad of one pool per school, keyed to the attribute that school
runs on — **understand, believe, will**:

| School | Attribute | Pool |
| --- | --- | --- |
| Arcane | INT | `maxMana = INT` |
| Divine | WIS | `maxSpirit = 5 + 0.25×WIS + 0.1×CHA` |
| Psionic | CHA | `maxFocus = 3 + 0.3×CHA + 0.1×WIS` |

Each of those three is also half of exactly one super-attribute (INT+CON =
Force, WIS+DEX = Martial Prowess, CHA+STR = Dominion, see `superattrs.data.ts`),
so committing to a school advances a fusion for free. `maxSpirit` was re-weighted
toward WIS when the triad landed; it had been CHA-dominant, which read as
psionic.

⚠️ The derived quantity that used to be called `focus` is now **`acuity`**.
Renamed rather than left to collide with the resource — the wheel prints its
quantities beside the sidebar's pools, and two different "Focus" readouts would
have been indefensible.

## 6. Progression and gating

* Per-axis cap is `min(10, 3 + level/8)` from the Psionics skill.
* A new mind holds **force and reach** only. Every other axis waits on a teacher
  (`learnPsiAxis`).
* Tier 4/8/12 recognitions wait on a teacher (`raisePsiTier`).
* No teacher content exists yet; the debug panel grants both.

**Why the tier gate blocks inscription rather than resolution.** A grimoire
entry stores the shape and is resolved on read by `resolveSpell`, which is
stateless and memoised by `spellKey` — so a saved spell resolves at full tier
forever. Inscription is therefore the only place the gate can be held. The wheel
now says so out loud ("this shape settles toward Obliteration — a region your
mind cannot hold until tier 8") instead of refusing silently at the button.

## 7. Compatibility

* `spellKey` is unchanged (`psionic:<axis><n>,…`, sorted, zeros dropped), so old
  and new grimoire entries are the same spells.
* The `focus` → `acuity` rename needed **no** migration: psionic quantities are
  derived on read, never stored. Only the *stored shape* would force a bump, and
  it did not change. Old psionic spells still resolve — a test sweeps every
  two-axis shape and asserts resolution is total (no throw, no NaN, no null).
* Adding the Focus pool bumped `SAVE_VERSION` to **32** (v31 → v32), which
  backfills `resources.focus` at its derived max so existing saves arrive full.
  The `maxSpirit` re-weighting rides along with no migration of its own: pool
  maxima are derived, and `tickResources` clamps anything now over its ceiling
  on the first tick.
* Saved spells **do** now do something different, which was accepted going in.
  The old three shapes still earn their old names.

## 8. Banked for later — settled, not open

* **Sustained / channelled workings.** Psionics is the only school where "I am
  *willing this to happen*" implies ongoing effort: a shape you hold, paying
  upkeep, reshapeable mid-fight (move a point from force into grip as the fight
  turns). Distinct from arcane's prepared sentences and divine's cooldown
  miracles. Deferred deliberately — it touches the combat loop, the rotation and
  the wheel, and the derived space was the prerequisite either way.
* **Backlash / overload — designed, and its pool now exists.** The full design
  is [plans/psionic-overload.md](plans/psionic-overload.md) — formulas, the
  `PoolSnapshot` seam, and the invariant tests live there; the short version
  is one **signed dial per axis**,
  where positive amplifies an axis where it is a numerator and negative mutes it
  where it is a denominator. Cost and backlash scale with *erased tension*, so
  the mind pays for making a working contradict itself rather than for
  magnitude — which matters because every signature opposition in this school
  (needle/hammer, wall/hammer, spread/concentrated) IS a denominator.

  It spends **`focus`**, not spirit and not mana. Spirit is reserved for
  ritual-style buffs that reduce effective spirit and expose the player to
  `corrupted`'s `fatalOnEmpty`. Focus is psionics' own pool (CHA-driven, see
  below), and overload eats its **maximum** while a working is held —
  `ceilingPerTick` into a recovery condition, exactly the way `rotting` eats
  stamina and hands the debt to `rot_recovery`. Holding a heavy overload
  strangles your own ceiling until you must let go, and backlash needs no
  separate trigger: it is simply max focus falling below what the working needs.

  **One grimoire entry, whatever the overload.** A shape is the entry; how hard
  you lean on it is not part of what it *is*. This is a deliberate point of
  difference from arcane, whose identity IS the exact sentence — `spellKey`
  preserves word order precisely so "fire pierce" and "pierce fire" are two
  spells. Psionics is the fluid school: one shape, pushed as hard as the moment
  asks. So overload belongs on `CraftedSpell` beside `prepared`, never on
  `SpellSource`, and `spellKey` needs no change at all.

  ⚠️ It must therefore be applied **after** resolution, never inside
  `shapeSpec`: `resolveSpell` memoises by `spellKey`, so folding overload into
  the resolved spec would map one key to several specs and let the cache serve
  an overloaded spec to a plain cast. The shape resolves; overload transforms
  the result at cast time.

  Still gated on **sustained workings**, since the ceiling is only eaten while a
  working is *held*. Nothing to overextend against until then.
* **Conductive and hostile materials — gear that argues with the arithmetic.**
  Some matter carries a will better than other matter does: bronze, the silk of
  a *clairvoyant spider*. Some refuses to: **nullsteel**, and **antipattern
  circuits** engraved into equipment as affixes or runes.

  **The law: anti-psionic gear must attack the ARITHMETIC, not the output.** A
  flat "−10% psionic damage" affix would work on any school and teach nothing —
  it is the lookup-table mistake wearing armour. Psionics *is* a derived space,
  so the interesting counter perturbs a term: *"your coherence reads as though
  the shape carried three more force"* breaks a wall, softens a needle into a
  push, and shortens every inward face's duration — all at once, from one
  number, because the space propagates it. That is counterplay only this school
  can have.

  **It is the same lever as overload, from the other end.** Overload is a signed
  per-axis, per-role weight on the derivation (§8 above). Conductive gear writes
  into that same vector in your favour — clairvoyant silk making reach dilute
  `acuity` less is *exactly* a Type-2 insulation you did not have to pay
  backlash for. Nullsteel writes into it against you: negative overload,
  imposed. **Build the weight vector once and both sides fall out of it**, which
  is the strongest argument for doing overload's plumbing properly.

  Hooks that already exist, so none of this needs new machinery:
  - `AFFIXES` (data/items.data.ts) is a plain `Modifier[]` with a name prefix —
    fine for capacity gear (`maxFocus`, `focusRegen` are real StatKeys today).
  - `RuneEffect.techniqueMods` is the precedent for the *interesting* kind:
    a rune already performs "graph surgery" on one martial technique rather
    than adding a number (docs/MARTIAL.md §9). An antipattern rune wants the
    same shape — a declared perturbation of one named quantity.
  - `requiresMonsterTag` resolves **per target** and is deliberately kept out of
    `getDerivedStats`, which is exactly how a nullsteel-bearing *enemy* would
    blunt a working aimed at it without touching your sheet. That matters given
    enemies are meant to use these subsystems too.

  **Built** — see §3 for `PsiBias`, `psiBiasFrom` and `resolveSpellFor`. The
  question of whether gear perturbs the quantities *before* recognition is
  settled yes: it does, so matter can rob a shape of its name. An Unerring
  Needle in Antipattern Bracers reads acuity 1.30 instead of 2.00 and comes out
  a bludgeoning shove with no `sure` — nothing anywhere names either outcome.
* **Anti-psion gear — three directions, and they are NOT one mechanism.**
  The bias above is only the first. Sorting them apart is the whole design:

  | Direction | Whose working | Whose arithmetic | Status |
  | --- | --- | --- | --- |
  | **Bias** | the wearer's own | the wearer's | **built** — bronze helps, antipattern hinders |
  | **Ward** | someone else's, aimed at the wearer | untouched; the *effect* is blunted | banked |
  | **Ceiling attack** | none — it is a weapon | none; it eats the pool's MAX | banked |

  Keeping them apart matters because the first shipped mislabelled: bracers
  that sabotage their own wearer are cursed metal (hence *Antipattern*), not
  armour against psions. The name **nullsteel** is deliberately left unused for
  the warding role.

  **Self-interfering gear is legitimate, and per-quantity bias is what makes it
  interesting.** A penalty to one quantity is not a flat tax — it is
  *conditional*. Somebody who never shapes a working pays nothing; a hammer or
  a mending build barely notices acuity; only a needle finds Antipattern
  Bracers unwearable. So the same item is free, awkward or ruinous depending on
  what you meant to do with your mind, which is a pricing dimension a generic
  "psionic power −20%" cannot have.

  It follows that such an item must be **genuinely strong** — the drawback has
  to buy something, or nobody weighs it. The bracers were first written at
  `armor +3` against Iron Gauntlets' `str +1, armor +4` at a fraction of the
  price: strictly worse *and* cursed, so the interference was priced at nothing.
  They are now the better armour, and the curse is what you pay for it.

  The same logic runs the other way for conductive gear, and the Bronze Dagger
  already does it: `damage +1` where Iron Dagger gives `+2`. It is a slightly
  worse knife, bought back with acuity and coherence — dead weight to anyone
  who does not shape.

  **Ward.** A `psiWard` stat scaling what a psionic working does to its target:
  afflictions land weaker and fall off sooner, and a high enough ward should be
  able to deny `sure` outright. Note damage needs nothing new — psionic strikes
  are `bludgeoning`/`piercing`, so `resBludgeoning` already answers them. It is
  the *conditions* and the flags that currently ignore the target entirely.

  **Ceiling attack — the best of them.** A nullsteel weapon that eats a psion's
  `maxFocus` is doing to them exactly what overload does voluntarily, which
  makes **ceiling attack one mechanic with three sources: your own overload,
  hostile gear, and an enemy's weapon.** Building overload's plumbing pays for
  anti-psion weapons for free. The machinery already exists — status `ceilings`
  closes off a pool, and `corrupted` proves the pattern on spirit, down to
  `fatalOnEmpty` for what happens when it is closed entirely.

  Cheaper riders that need nothing new: a weapon that cuts a psion's dodge is
  an ordinary `inflicts`. Bypassing a Kinetic Bulwark is the one genuinely new
  combat concept, since `blocksRanged` is a boolean and would have to become
  partial.

  ⚠️ **Focus-cost inflation must be telegraphed or not built.** Making a working
  cost more against a nullsteel-armoured target is thematically perfect and
  mechanically hazardous — not because the cost is high, but because **the
  refusal is silent**: the affordability gate lives in `pickActive`, so a
  working you can no longer afford simply never fires and nothing says why.
  That is the same failure a CHA-1 mind hit with a 4-cost working, and it took
  a play report to find. Any version of this ships with the warning attached to
  the enemy, not as polish afterwards.

  **Both directions, always.** Psionic enemies are coming, so none of this may
  be player-only. The cheap half already works: monsters carry `tags`, and
  `requiresMonsterTag` resolves per-target outside `getDerivedStats`, so "this
  weapon bites harder against psions" is expressible today. The missing half is
  a *monster's* gear biasing *your* working, which needs a per-target resolve —
  `resolveSpellFor` is per-caster, and strikes already loop over targets, so the
  hook exists but the spec would have to be re-derived inside that loop.
* **Monsters that shape.** The other half of the same conversation: warding and
  nullsteel are only worth carrying once something is aimed at you.

  ⚠️ **A monster's mental attributes are inert today.** `MonsterStats` is only
  `{ maxHp, damage, speed, dodge, resistances }` and damage is `1.5 + STR×1.1`,
  so a monster statted as a caster — high INT/WIS/CHA, low STR — is simply
  harmless. Anything psionic on the monster side starts here, not with shapes.

  Three pieces, and the hard ones already exist:

  1. **A mental damage source.** `spellPower: 1.5 + INT×1.1` in monsterStats,
     mirroring the physical line, and added to `MONSTER_STAT_KEYS` so
     conditions can move it.
  2. **`MonsterDef.psi?: { shapes: PsionicShape[] }`** — the workings it knows,
     as ordinary shapes. Data, like everything else it is.
  3. **A cast branch in the monster's turn** (inside `tickCombat`, beside where
     `MONSTERS[e.defId]?.inflicts` is rolled), reusing what is already there:
     `incomingSlice` + `damagePlayer` for strikes, and
     `applyStatuses(state, state, …)` for both `inflicts` and `afflicts`.

  It stays small because **`shapeSpec` does not care who is shaping**. A
  monster's working is a needle or a hammer by the same arithmetic, gets its
  name from the same recognitions, and would be blunted by `psiWard` on exactly
  the same terms — which is what makes the anti-psion gear above worth owning.

  **The inward mirror comes free.** `applyStatus` already accepts a
  `MonsterInstance`, and `statusMods` filters modifiers to `MONSTER_STAT_KEYS`
  — which includes `speed`. So a slime that shapes a Kinetic Rush really does
  haste itself and attack faster, with no code written for it. Faces that
  target stats a monster does not have (Kinetic Haste's `travelSpeed`) are
  simply ignored, which is the correct behaviour and also free.

  **Do not build this psionic-only.** All three schools are already pure
  functions returning the same type — `composeArcane(words)`,
  `miracleSpec(litany)`, `shapeSpec(shape)` — and `SpellSource` is already the
  union naming all three. So the monster-facing feature is ONE optional field:

  ```ts
  MonsterDef.casts?: SpellSource[]   // sentences, miracles and shapes alike
  ```

  `resolveSpell`'s switch already turns any of them into a spec. Piece 1 above
  (`spellPower` from INT) is not a psionic requirement either — every school's
  strike power is in spell-power multiples, so it is the single real gap for
  all of them. Building this three times would be a mistake.

  One decision covers all three: **monsters should not pay pools.** They have
  no mana, spirit or focus, so `manaCost`/`focusCost` are ignored and a
  per-entry cooldown governs instead — otherwise enemies need three resource
  systems before they can cast anything.

  **Martial techniques do not go through `SpellSource`, but they are NOT the
  large piece they look like.** `TechniqueDef` splits in two, and the half that
  makes martial heavy is the half a monster never touches:

  * **Portable as-is:** `TechniqueMove` — `damageMult`, `hits`, `penetration`,
    `inflicts`, `damageType`, `counter`/`preventedMult`. The whole tactical
    texture of a technique, and only numbers and status applications.
  * **Not needed at all:** the learning ledger — `state.techniques[id]`,
    executions, mastery tiers, forks, self-learn, unlock conditions. A monster
    does not *learn* a technique, it is authored with one. That progression
    machinery is most of martial's weight and simply drops out.

  What remains is small and comparable to the casting work above:

  1. `CombatState.position` and `momentum` are singular — the player's. Give
     `MonsterInstance` its own `position` and technique cooldowns; it already
     carries per-combatant `bar`, `stunSpent` and `statuses`, so this is a few
     lines. **Once position is per-combatant the graph genuinely does run
     itself** — `from`/`to` are data, and each combatant walks its own.
  2. `family`, `requiresWielded`, `requiresSheathed` and `requiresGrounded`
     read the player's equipment. Monsters have none, but they do have `tags`,
     so a knight tagged `sword` satisfies a family gate naturally. A decision
     rather than code.
  3. `staminaCost`, `momentum`, exertion, stances and runes are skipped —
     monsters have none of them.
  4. Execution reads `monsterSlice` (damage arriving at a monster); a monster
     executing needs `incomingSlice` + `damagePlayer`, exactly as the casting
     branch does.

  Open question for whoever builds it: does a monster choose between several
  entries by trigger conditions (the subject list is already data-driven), or
  simply roll?
* ~~**A quantity for grip.**~~ **Done** — see `purchase` in §3. Grip has a ratio
  of its own, and "no grip" is now *slippery* rather than an absence: every
  affliction still lands, none of it stays. Remaining wart, deliberately left:
  the daze CHANCE still reads raw grip rather than purchase, because routing it
  through purchase would gut it (a speed-10 grab would daze at 16% instead of
  95%). Defensible as it stands — a daze is *spent* in lost actions rather than
  held for a time, which is also why it is the one affliction adhesion skips.
* **`awareness`'s real inward face.** Wide Sight (physical resistances) is a
  placeholder for the effect that belongs there: *read what the target is
  carrying, then make everyone else more susceptible to that specific thing.*
  The primitive exists — `StatusDef.amplifies` multiplies incoming intensity —
  but `applyStatus` resolves `STATUSES[app.id]`, a static lookup, so a def
  cannot say "amplify whatever X turned out to be". **This is the single
  cleanest argument for composed statuses** (below): impossible with a
  registry, one function with composition.
* **Composed statuses.** The one place psionics still reaches for a fixed
  catalogue. `composeCarved` in systems/runes.ts is the precedent: it BUILDS a
  RuneDef from its parts and memoises it by key rather than looking one up. The
  same for conditions would mean a wall is not a named status you qualified
  for, but a wall as strong as the mass you put into it — and it is what
  `awareness`'s inward face is waiting on.
* **Compression, and splitting coherence.** The singularity effect (space
  crushed inward on one target, resistance the only out) wants a quantity that
  does not exist: structure turned inward on a point, high `coherence` and
  `pressure` with `spread` near zero. Relatedly, `coherence`'s denominator is
  `force + mass`, so force fights it — a membrane made of pressure cannot
  currently be distinguished from a wall made of mass.
* **Reflection.** No `StatusDef` field bounces damage back. `PARRY_RIPOSTE` is
  a hardcoded 0.3 in systems/derived.ts, player-only and tied to the parry
  stat. A declarative `reflects` would be reusable by runes, miracles and
  enemies alike.
* **Sub-gate shapes.** One or two points of mass alone still resolve to
  nothing: `inertia` needs 3 to stand as a wall, and `kinetic_bulwark` is a
  boolean (`blocksRanged`), so it cannot be granted faintly the way a scaling
  condition can. A wall-strength quantity would close the last of it.
* **More recognitions.** Now pure content: a name for a region. Cheap to add,
  and incapable of adding depth.
