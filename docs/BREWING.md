# The Alchemist's Handbook

How the Alembic thinks, how to read a brew, and how to write new ones.

Part 1 is for playing. Part 2 is for adding content. Every number below is what
the code actually produces at Fair (C) grade — you can reproduce any of it by
laying the sequence out on the bench and reading the preview tooltip.

> The internal spec (framework hooks, deferred work) lives in
> [ALCHEMY.md](ALCHEMY.md). This document is the practical one.

---

# Part 1 — Brewing

## The one idea

**A recipe is an order, not a set.** The alembic reads your sequence left to
right, exactly once, and each thing you add acts on the brew *as it stands at
that moment*. Nothing is stirred back in afterwards.

There is no roll anywhere. Same reagents, same grades, same order → same flask,
every time. If two brews differ, the sequence differs.

## Three kinds of thing

| Kind | What it does | Examples |
|---|---|---|
| **Menstruum** (solvent) | Raises the brew and decides how it is *delivered* | Spring Water, Pressed Oil, Grain Spirit |
| **Essence** (substance) | What the brew is *of* | Emberbloom, Mendroot, Gloomcap, Nightcap… |
| **Operator** | Acts on the brew it *finds* | Quicksilver, Fixing Salt, Brimstone, Bone Ash, Green Vitriol |

Some reagents are two kinds at once. Grain Spirit is a solvent that also stirs
the brew up — which is why throwables start there.

## Law 1 — Steeping trades character for strength

Everything you add is still in the bottle, so it all counts toward **potency**
(how *much* there is). But an essence added early gets broken down by everything
that follows it, and what dissolves loses its identity.

- **Dissolved share** → returns **×1.35** as potency. Efficient, and anonymous.
- **Undissolved share** → returns ×1.0 as potency **and keeps its character**:
  its element, what it inflicts, what it grants you.

An essence with `n` things after it dissolves by `n / (n + 1)`:

| Things added after it | Dissolved | Keeps |
|---|---|---|
| 0 (last in) | 0% | 100% |
| 1 | 50% | 50% |
| 2 | 67% | 33% |
| 3 | 75% | 25% |

**Worked example.** Water plus one Mendroot, then the same with an Emberbloom
slipped in at different points:

| Sequence | Potency | Mending held | Result |
|---|---|---|---|
| `Water → Mendroot` | 2.60 | 2.60 | Mending Elixir, Well Fed ×0.65 |
| `Water → Emberbloom → Mendroot` | **6.36** | 2.60 | Mending Elixir, Well Fed ×0.65 |
| `Water → Mendroot → Emberbloom` | 6.26 | **1.30** | *Ember* Elixir, Well Fed ×0.33 |

Row 2 is the lesson: the emberbloom went in early, dissolved half away, and its
strength fed the potion — while the mendroot, still last, kept everything. Row 3
put the mendroot under the bloom instead, and it lost half its mending.

**Rule of thumb:** put what you want the brew to *be* last. Put what you want it
to be *strong on* first.

## Law 2 — An operator only sees what came before it

Salt cannot settle a brew that is not yet running. Ash cannot purify an empty
pot. Brimstone will not catch unless something before it got the brew hot.

This is not a modifier — it is the whole of what an operator is. The same
Brimstone is the difference between a bomb and a jar of grit depending on nothing
but where you drop it.

| Sequence | Volatility when Brimstone lands | Result |
|---|---|---|
| `Spirit → Quicksilver → Emberbloom → Brimstone` | 1.80 ✔ ≥ 1.2 | **catches** — potency 5.29 |
| `Spirit → Brimstone → Quicksilver → Emberbloom` | 0.50 ✘ | fouls it — potency 2.60 |

## What comes out

Two dials decide the form, and nothing else does:

- **The first solvent** decides *delivery*. It is fixed the moment it goes in;
  no later solvent can change it.
- **Volatility** decides *burst or lingering*. The line is **1.0**.

|  | calm (< 1.0) | roused (≥ 1.0) |
|---|---|---|
| **Spring Water** | **Elixir** — drink; grants conditions for a while | **Draught** — drink; instant restore |
| **Pressed Oil** | **Salve** — apply; instant restore, and the *only* form that cures | **Oil** — coat your weapon; every blow carries it |
| **Grain Spirit** | **Fume** — throw; afflicts everyone, deals no damage | **Flask** — throw; damage + riders |
| *(no solvent)* | **Residue** — junk | Residue |

The essences then decide *what* it does, and potency decides *how much*.

## Oils: the one form measured in blows

A roused oil does not go on you — it goes on your blade. It lasts a number of
**blows**, not seconds, and there is a reason it cannot be seconds: rousing is
exactly what Fixing Salt undoes, so an oil is by definition a brew that was never
settled, and it has no banked duration to spend.

- **Blows** = `3 + potency × 0.8`, capped at 12.
- **Each blow** adds a small typed bite (`potency × share × 0.3`) *and* leaves
  the substance's riders on whatever it hit.
- Blows × bite adds up to roughly a Flask's single burst. So the choice is
  **delivery, not power**: a Flask is certain and immediate and hits the whole
  formation; an Oil is earned a swing at a time but afflicts on every one.
- **One coating at a time.** A second oil wipes the first off rather than
  layering.
- The oil is on *that blade*. Draw a different weapon and it does nothing —
  sheathe the coated one again and it is still there.
- A flurry pays a blow of oil per hit, but only afflicts once per swing.

`Oil → Quicksilver → Emberbloom` → **Ember Oil**, 6 blows of heat and burning.
Note the Quicksilver: pressed oil has nothing to rouse it on its own, so an
untouched oil sequence always settles into a Salve.

Watch the Satchel for `🛢️ On your edge: … — N blows left`, and the fight feed
for the line where the last of it wipes off.

## Reading the preview

Hovering the result line gives you the alembic's own account, one line per
addition — what dissolved, what caught, what settled. If a brew is not doing
what you expected, that list says why. The two numbers on the face of it are:

- **⚡ volatility** — which side of 1.0 you are on
- **◆ potency** — raw magnitude

Use the **◀ ▶** arrows under a filled step to swap it with its neighbour. That is
the fastest way to feel a sequence out; the preview updates as you go.

## Things that will bite you

- **Drinking fire does nothing.** An essence only speaks in the register its form
  reads. Emberbloom has an element and an affliction — perfect in a Flask,
  worthless in an Elixir, which reads `grants`. The preview will show an Ember
  Elixir with no effects listed at all. Believe it.
- **Only Salves cure, and only Salves treat a wound.** Mendroot's cure tags are
  ignored in every other form, and a Draught heals you without closing a
  bleed.
- **A cure answers a tag, one rung a flask.** Mendroot cures `poison` and
  `bleed`: Poisoned goes, Rotting eases to Poisoned, Bleeding goes. A Salve is
  also treatment, so it eases Lacerated to Bleeding; a second Salve closes that.
- **Elixirs don't restore, Draughts don't grant.** Calm water sustains, roused
  water bursts. Pick the one you wanted.
- **An Oil reads the same registers a Flask does** — element and afflictions.
  Mendroot or Bloodwort in an oil is inert; those are drinking substances.
  Rouse an oil only when you have something worth putting on an edge.
- **Solvents have a capacity.** Water holds 8, Oil 6, Spirit 5 (×grade). Potency
  past that **spills**, and only 35% of the excess survives. Four heavy essences
  in a small solvent throws most of them away — the preview says *"It runs over
  the top."*
- **Grades scale, they never decide.** A Superb reagent makes the same brew,
  bigger. Refuse (F) grade is genuinely negative and drags a brew down.
- **A second solvent dilutes.** Potency ×0.7, volatility ×0.55, but it adds
  capacity. That is the tool for a brew that ran over, or one you roused too hard.

## Five starting sequences

| Sequence | Makes |
|---|---|
| `Water → Mendroot` | Mending Elixir — slow top-up, 45s |
| `Water → Quicksilver → Mendroot` | Mending Draught — 8 HP now |
| `Oil → Mendroot → Mendroot → Fixing Salt` | **Field Salve** 📜 — 19 HP, clears poison and bleed |
| `Oil → Quicksilver → Emberbloom` | Ember Oil — 6 blows of heat and burning |
| `Water → Gloomcap → Fixing Salt` | **Thief's Measure** 📜 — Concealed ×0.65 |
| `Spirit → Quicksilver → Emberbloom → Brimstone` | **Smoulderer's Flask** 📜 — 13 heat + burning |

A 📜 marks a **known formula** — a sequence somebody already wrote down. The
match is exact and ordered. It is recognition only; a formula does nothing a
sequence of the same steps would not do. Finding one is the point.

## Fixing Salt is the timer

Salt quenches a running brew and **banks what it quenched as duration**. So the
way to a long-lasting brew is to rouse it hard and *then* settle it:

`Spirit → Nightcap → Fixing Salt` → **Chokedamp**, a fume running 53s instead of
the base 45s. Base duration is 45s, cap 150s. Alchemy is short by design — that
is the contrast with cooking, which feeds you for ten minutes.

---

# Part 2 — Writing new brews

Content lives in two files. You should not need to touch `systems/alchemy.ts` to
add reagents, formulas or gathering.

- `src/core/data/materials.data.ts` — the *thing*: name, icon, value, tags
- `src/core/data/alchemy.data.ts` — what it *does* in the alembic

Both are registered in the **forge** (`npm run forge`), under **Materials** and
**Reagents** — that is the intended authoring path, and it validates references
as you go. The hand-edited shapes below are what the forge writes, and what you
want when adding something the forge has no field for yet (a new `act` kind).

## Adding a reagent

**Step 1 — make it a material.** It must carry the `reagent` craft tag or no
alembic slot will accept it, and `graded: true` so it stocks per quality.

```ts
// materials.data.ts
sunspar: {
  id: 'sunspar',
  name: 'Sunspar',
  icon: '🔆',
  value: 22,
  desc: 'Splits along one plane and is warm on the broken face.',
  craftTags: ['reagent', 'essence'],   // 'menstruum' / 'operator' for the others
  graded: true,
},
```

The extra tag (`essence` / `operator` / `menstruum`) is descriptive only — the
slots accept `reagent`. Use it anyway; it is how a reader tells them apart.

**Step 2 — say what it does.** Add an entry to `REAGENTS`, keyed by the same id.

### …as an essence

```ts
sunspar: {
  id: 'sunspar',
  name: 'Sunspar',
  icon: '🔆',
  desc: 'One line, shown in the picker. Say what it is FOR.',
  minLevel: 8,                    // Alchemy level before the alembic takes it
  essence: {
    id: 'radiance',               // groups the same substance from other sources
    name: 'Radiance',             // reads as an adjective: "Radiance Flask"
    power: 2.9,                   // see the budget below
    type: 'light',                // what a thrown flask strikes as
    inflicts: [{ id: 'dazzled', intensity: 1 }],   // to whatever it lands on
    grants: [{ id: 'steady_hand', intensity: 1 }], // to whoever drinks it
    restore: [{ resource: 'mana', per: 1.4 }],     // per point of potency
    cures: ['dark'],                               // salves only
  },
},
```

Every field except `id`, `name` and `power` is optional — and each one is read by
a *different form*. **Give an essence at least one register or it can only ever
add bulk.** Which forms read which:

| Register | Read by |
|---|---|
| `type` | Flask, **Oil** |
| `inflicts` | Flask, Fume, **Oil** |
| `grants` | Elixir |
| `restore` | Draught, Salve |
| `cures` | Salve only |

Two or three registers make an essence flexible across forms; that is a design
choice, not a requirement. A one-register essence is a specialist, and the
preview will make that obvious to the player.

Intensity is scaled by the essence's held weight, so declare `intensity: 1` and
let the sequence decide. Status ids must exist in `statuses.data.ts`; the content
test suite will catch you if they don't.

### …as an operator

Pick one of the five act shapes. They all read the accumulator — that is the
contract, and an operator that ignores what came before it is not an alchemy
operator, it is a runecarving adornment.

```ts
act: { kind: 'agitate', amount: 1.3 }                          // raises volatility
act: { kind: 'fix' }                                           // quenches, banks duration
act: { kind: 'ignite', needs: 1.2, mult: 1.55 }                // gated on volatility
act: { kind: 'clarify', mult: 1.5 }                            // drops the weakest essence
act: { kind: 'corrode', penetration: 0.22, mult: 1.25, purity: 0.88 }
```

Adding a *new* act shape means extending `ReagentAct` in `types.ts` and adding a
case to the `switch` in `composeBrew`. Two rules if you do: it must read state
that only earlier steps could have set, and it must `notes.push(...)` a line
explaining itself — the preview's reading is the teaching surface.

### …as a menstruum

```ts
menstruum: { medium: 'water', body: 8 },   // medium: 'water' | 'oil' | 'spirit'
```

`body` is capacity — how much potency it holds before spilling. A new *medium*
is a bigger change: it needs a row in `formOf()` and entries in `BREW_FORMS`,
plus a register in `composeBrew` for what that form actually does.

**Step 3 — make it findable.** Add a gather activity in `locations.data.ts`.
Convention so far: forest reagents (what a brew is *of*) are herbalism-tagged and
picked in woods; mineral reagents (what you *do* to it) are mining-tagged and dug
out of the mountains.

```ts
{
  id: 'split_sunspar',
  kind: 'gather',
  material: 'sunspar',
  ticksPer: 220,
  name: 'Split Sunspar',
  icon: '🔆',
  tags: ['mining'],
  speedFactors: [{ attr: 'wis', weight: 0.01 }, { skill: 'mining', weight: 0.018 }],
  outputFactors: [{ stat: 'loot', weight: 1, base: 1 }],
  outputCap: 1,
},
```

## Adding a formula

A formula is recognition for an exact, ordered sequence — no mechanical bonus.

```ts
// alchemy.data.ts → BREW_FORMULAS
{
  id: 'dawnflask',
  name: 'Dawnflask',
  icon: '🌅',
  desc: 'Why it is worth knowing. One or two lines.',
  sequence: ['grain_spirit', 'quicksilver', 'sunspar', 'brimstone'],
},
```

Write formulas for sequences that *teach* something — an order that is
non-obvious, or that shows off an operator's gate. A formula for `Water →
Mendroot` is not worth the line.

## Balancing a new reagent

- **Essence `power`** sits at **2.4–3.4** for the current roster. That is the
  band potency, damage and status intensity are all tuned against; a 6.0 essence
  is not "a good reagent", it is a different game.
- **Potency lands ~2.5–8** for two- and three-step brews at Fair grade. A thrown
  flask deals `potency × share × 2.4`, so ~13 damage for a decent starter bomb;
  an oil deals `× 0.3` per blow over `3 + potency × 0.8` blows, which is on
  purpose about the same total.
- **`minLevel` is the real gate.** Sequence length opens at Alchemy 5/12/22/35,
  so a reagent that only shines in a five-step sequence should not be reachable
  before 22.
- **Anything gated behind volatility** should state its threshold in `desc`. The
  player cannot be expected to guess that 1.2 is the number.

## Checking your work

```bash
npx vitest run tests/alchemy.test.ts tests/content.test.ts
```

`content.test.ts` enforces the structural invariants across all disciplines —
every slot tag is one some material carries, every status id exists, every
outcome produces something real. `alchemy.test.ts` pins the two laws and the
outcome table, so if a change to `composeBrew` breaks the design rather than the
code, that is where it shows up.

The fastest way to see what a sequence does is still the bench: lay it out and
read the preview tooltip. It is generated from the same fold the game runs.
