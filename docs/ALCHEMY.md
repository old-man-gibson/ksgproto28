# Alchemy

The crafting mirror of arcane spellcraft. Where a spell is a **sentence**, a
brew is a **sequence** — and both are read once, left to right, deterministically.

> This is the internal spec: why it is shaped this way, and what is banked for
> later. For *playing* the system or *adding* reagents and formulas, read
> [BREWING.md](BREWING.md) — the handbook.

## 1. Where it sits among the crafts

Each discipline earns its interest a different way. The guards matter as much as
the designs, because two systems reaching for the same trick is how a game gets
mushy:

| Discipline | Identity | Guard |
|---|---|---|
| Runecarving | **sum of its elements** | strictly additive — no pair synergies |
| Cooking | **when things are prepared** | cardinal: durations and exposure |
| **Alchemy** | **the order things go in** | **ordinal: positions only, never durations** |
| [Mutagens](MUTAGENS.md) | **pattern of interactions** | pairwise/graph effects live here, not in alchemy |

Cooking and alchemy also differ in what they produce, on purpose:

- **Cooking** makes *grounded* effects — a dish feeds you for eight to ten
  minutes and is about sustained, unglamorous upkeep.
- **Alchemy** makes *spell-like* effects — bombs, concealment, things only
  chemistry or magic can explain — and they are instantaneous or short. Base
  sustained duration is **45s**, capped at 150s.

## 2. The two laws

Both live in `systems/alchemy.ts`, and everything else follows from them.

**Law 1 — Extraction. The longer a substance steeps, the less of itself is left.**

An essence at position *i* with `after = n − 1 − i` additions following it
dissolves by `after / (after + 1)`.

- The dissolved share returns `EXTRACT_YIELD` (1.35) as **potency** — anonymous
  magnitude — and loses its identity.
- The undissolved share returns 1.0 as potency *and* keeps its full
  **character**: its element, its afflictions, what it grants.

So steeping buys ~35% more punch at the cost of everything the substance *was*.
Three herbs early make a strong vague potion; the same three late make a weaker,
vivid one. Neither is the right answer.

**Law 2 — An operator can only act on what it finds.**

Salt cannot settle a brew that is not yet running. Ash cannot take the weakest
thing out of an empty pot. Brimstone will not catch unless something before it
got the brew hot. Position is not a modifier on an operator — it *is* the
operator.

## 3. The outcome table

The **solvent** decides delivery; **volatility** decides burst-or-lasting.
That is the whole table.

|  | calm (< 1.0) | roused (≥ 1.0) |
|---|---|---|
| **water** | Elixir — sustained self statuses | Draught — instant self restore |
| **oil** | Salve — instant restore + the only form that CURES | Oil — weapon coating, per-blow bite + riders |
| **spirit** | Fume — thrown, afflictions on everyone, no blow | Flask — thrown, damage + riders |
| **none** | Residue | Residue |

Essences decide what it is *of*; potency decides how much of it there is.

**Every solvent reads volatility.** That was not true in the first cut — oil
ignored the dial and always made salves — and the asymmetry was the one thing
wrong with the table. `tests/alchemy.test.ts` now asserts the invariant directly
(`formOf(m, 0) !== formOf(m, 2)` for all three media), so a future medium cannot
quietly reintroduce a dead cell.

**Oils are measured in BLOWS, not seconds**, and the table forces it: an oil is a
*roused* brew, and rousing is exactly what fixing salt undoes, so a coating can
never carry banked duration the way an elixir or a fume can. A duration dial
there would be permanently dead. Blows give the form its own resource and read
the way an oil behaves — it wears off the edge. `blows = clamp(3 + potency×0.8,
1, 12)`; each blow deals `potency × share × OIL_BITE` (0.3) and leaves the
substance's riders. Blows × bite lands near a flask's single burst, so the
choice between them is delivery, not power.

## 4. Reagents

Three kinds, in `data/alchemy.data.ts`. A material may be more than one — grain
spirit is a solvent that also agitates, which is why bombs start there.

- **Menstruums** — spring water (body 8), pressed oil (6), grain spirit (5).
  The first one raises the brew and fixes the medium *permanently*. A second
  one **dilutes**: potency ×0.7, volatility ×0.55, and adds capacity. Potency
  past capacity **spills** — only 35% of the excess survives.
- **Essences** — emberbloom, frostmoss, nightcap, gloomcap (the concealment
  line: `veiled`), mendroot, bloodwort, thunderbloom.
- **Operators** — quicksilver (`agitate`), fixing salt (`fix` — quenches, and
  banks what it quenched as duration), brimstone (`ignite` — needs volatility
  ≥ 1.2, else it only fouls), bone ash (`clarify` — drops the weakest essence
  and amplifies the rest), green vitriol (`corrode` — penetration and potency
  at a cost in purity).

Forest reagents tell you what a brew is *of*; mineral reagents tell you what to
*do* to it. That split is why the essences are picked in woods and every
operator is dug out of a mountain.

## 5. What skill buys — and what it does not

**A flask is nothing but its sequence.** `BrewedFlask` stores the ordered steps
and nothing else; `resolveBrew` reads it back. Two alchemists with the same
reagents at the same grades in the same order get the same flask, always — the
promise arcane spellcraft makes, kept by a bench.

So Alchemy levels buy **sequence length** (2 steps → 6, at 5/12/22/35) and
**vocabulary** (reagent `minLevel`), never quality. Grades scale magnitude
without deciding the form.

There is no failure roll and no quality roll. A badly written sequence produces
residue, not nothing — losing the reagents on top of having sequenced them
wrong would punish twice for one mistake (cooking's rule).

## 6. Framework changes this needed

- `CraftDisciplineDef.ordered` — slots are a sequence, gaps close, and the UI
  draws a strip instead of stations.
- `noveltyKeys` respects `ordered`, so "salt then brimstone" and "brimstone then
  salt" are two different discoveries.
- `CraftResult` kind `'brewed'`, and `benchwork` dispatches on `ordered`.
- `combat.ts` exports `feed` and a new `sweepDead` (extracted from
  `castCraftedAttack`) so a thrown flask can resolve without going through the
  spell path — deliberately, since a flask must **never** scale with spellPower.
- `state.coating` (save v33) plus `spendCoating` in the weapon path, called
  beside the existing enchant/rune bonus-damage loop — an oil is the same shape
  as a weapon enchant, so it uses the same hook rather than a parallel one. That
  makes `combat.ts` ⇄ `alchemy.ts` mutual; safe because neither reads the other
  at module-evaluation time. If a third thing ever needs the pure fold, extract
  `composeBrew` into its own module rather than deepening the cycle.

## 7. Banked for later — settled, not open

- ~~**Weapon oils.**~~ Shipped — see §3. What is still open: an oil currently
  reads only `type` and `inflicts`, so a mending or vigor essence in one is
  inert. A "the wielder gains this while the blade is wet" register would give
  `grants` somewhere to land in the oil form.

  Worse than the sentence above admits (measured 2026-08-10): the oil branch in
  `composeBrew` is one arm of an `else if` chain whose siblings fill `grants`,
  `restore` and `cures`, so an oil cannot reach any of them. A storm oil built
  on thunderbloom silently drops both its mana restore and its `clear_headed`
  grant, keeping only the weight they contributed to potency. Whatever register
  lands, the floor is that a discarded payload must be **named** — silent
  evaporation is the one outcome the table may not have. The floor is met
  (2026-10-23): `BrewSpec.summary` ends with `Not used by <form>: <essence>
  (<registers>)` for every form, oils included. The register itself is still
  open.

- **A graze does not spend a coating** (decided 2026-08-10, previously true only
  by omission — `landGraze` never called `spendCoating`). The edge did touch, so
  there is a real case for it; it loses to what owning the resource feels like,
  since a C-grade coating is five blows and burning one on the swing that went
  wide is the worst moment the system could offer. Written down at the call site.
- **Fumes as fields.** A fume applies its afflictions once, to everyone present.
  A lingering cloud that re-applies to arrivals wants a combat-field concept
  that does not exist yet.
- **More operators.** The five are a starter vocabulary. Anything new must read
  the accumulator (Law 2) — an operator that ignores what came before it is not
  an alchemy operator, it is a runecarving adornment.
- **The formulary as progression.** `BREW_FORMULAS` is recognition only, with no
  mechanical bonus. Teachers handing out written formulas is the obvious hook,
  and mirrors martial's canonical forms.
- **Reagent grades from herbalism.** Grades already come through
  `grantMaterial`'s luck roll; nothing alchemy-specific is needed.
