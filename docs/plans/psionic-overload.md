---
id: psionic-overload
title: Psionic overload, backlash, and the Focus resource
kind: story
status: draft
system: psionic
parent:
save:
updated: 2026-08-09
invariants:
  - completability
  - modFingerprint
done:
  - Cost and backlash scale superlinearly with ERASED TENSION, not with magnitude
  - No hard cap — the mind pays for making a working contradict itself
  - Every signature psionic opposition survives; nothing buys its way out of a trade-off
---

# Psionic overload, backlash, and the Focus resource

> **Status when this was archived into the repo (2026-07-31):** Stage 0 (the
> `focus` → `acuity` rename) and Stage 1 (the Focus resource) are SHIPPED —
> the pool exists, `focusCost` is paid, PSIONIC.md §5b documents it. Stages
> 2–3 (sustained workings, then overload/backlash) are the unbuilt design
> this file preserves. PSIONIC.md §8 carries the summary; this is the full
> implementation plan, kept because the give/cost formulas, the
> `PoolSnapshot` seam, and the invariants-to-test list exist nowhere else.
> Line numbers cited were true at save v31 and will have drifted.

## Context

Overload/backlash has been banked in `docs/PSIONIC.md` §8 since the derived-space
rebuild. This session settled what it actually is.

The mechanic is **one signed dial per axis**, not two separate systems. Uniform
scaling would make "raw power" identical to just spending another point — force
would hit harder *and* wreck coherence just as much. The two types are distinct
only because they touch different **roles**:

* **positive** overload amplifies an axis where it is a **numerator** (what it gives)
* **negative** overload mutes it where it is a **denominator** (what it costs)

The danger, stated plainly: **every signature opposition in psionics is a
denominator.** Needle-vs-hammer is `√momentum` in acuity's denominator;
wall-vs-hammer is `−speed` in inertia; spread-vs-concentrated is `reach` in
acuity; inward-vs-outward is `pressure` in inward's denominator. Unbounded,
negative overload is "buy your way out of every trade-off" — the exact
flattening the rebuild existed to escape.

**Resolution (chosen):** no hard cap. Cost and backlash scale superlinearly with
**erased tension**, so the mind pays for making a working contradict itself
rather than for magnitude. Backlash stops being a bolted-on punishment and
becomes the measure of how hard the arithmetic is being forced.

**Correction carried forward:** `spirit` is *not* the psionic resource. It is
reserved for ritual-style buffs that reduce effective spirit and expose the
player to `corrupted`'s `fatalOnEmpty`. Psionics gets a new **Focus** resource.

## Attribute triad

`understand → believe → will`

| School | Attribute | Pool | Status |
| --- | --- | --- | --- |
| Arcane | INT | `maxMana = INT` | already correct |
| Divine | WIS | `maxSpirit` | **needs swapping** — currently CHA-dominant |
| Psionic | CHA | `maxFocus` | new |

Each also happens to be half of exactly one existing fusion
(`superattrs.data.ts`): INT+CON = Force, WIS+DEX = Martial Prowess,
CHA+STR = Dominion. The triad reinforces that map at no cost.

## Staging

**What this plan builds: Stage 0 and Stage 1.** They are independent of
everything else and ship on their own — the rename removes the name clash, and
the Focus resource plus the attribute triad stand up the pool that overload will
later draw on. Nothing player-visible changes about psionic resolution.

**What this plan only records: Stage 2 and Stage 3.** The reservation is held
only while a working is *sustained*, so overload cannot be built until sustained
workings exist, and sustained workings want their own design pass (they touch
the combat loop, the rotation, and the wheel). Stage 3's design is written down
here so the Focus resource is shaped correctly for it — not so it gets built in
the same sitting.

Concretely: after Stage 1 the game has a Focus bar that fills and sits there.
That is expected. It has no consumer until Stage 3.

---

## Stage 0 — rename the `focus` quantity to `acuity`

Mechanical, no save impact (everything psionic is derived). Do it first so
"Focus" means exactly one thing.

The wheel currently prints `📍 Focus 10.00`; a Focus resource bar beside it would
read as the same concept. `acuity` = sharpness of sight, which is literally
`clairvoyance ÷ what it must cover`.

* `src/core/types.ts` — `PsiQuantityId` member.
* `src/core/data/spellcraft.data.ts` — the `PSI_QUANTITIES.focus` entry, and the
  `region` bands in `PSI_RECOGNITIONS` (`unerring_needle`, `second_sight`).
  Rename the tuning consts that carry the word too: `needleFocus`, `sureFocus`,
  `penPerFocus`, `foresightGate`.
* `src/core/systems/psionic.ts` — `deriveShape`, `shapeSpec`, `CHARACTERS`.
* `tests/spellcraft.test.ts`, `docs/PSIONIC.md`, `docs/CONTENT_GUIDE.md` §9c.

## Stage 1 — the Focus resource

Follow the recipe already documented in the `resources.data.ts` header
("Adding a resource is: … Nothing else needs to know it exists").

1. `ResourceId` in `types.ts` gains `'focus'`.
2. `StatKey` gains `'maxFocus'` and `'focusRegen'`; add both formulas to
   `baseStats` in `systems/derived.ts`, the floor clamp beside the other
   `Math.floor(Math.max(0, …))` lines, and the `STAT_FORMULAS` display strings.
3. Entry in `data/resources.data.ts`: `maxStat: 'maxFocus'`,
   `regenStat: 'focusRegen'`, not `static`, no `reserve`. **Focus is an ordinary
   pool that refills** — mana's shape, not spirit's.

   What makes it "different logic than mana's pure depletion" is not the pool,
   it is that **overload eats the pool's MAX** and the ceiling has to grow back
   afterwards (Stage 3). Spending focus is unremarkable; losing capacity is the
   mechanic.
4. `--focus` in `src/app.css`. Magenta (~`#d94f9e`) — distinct from spirit's
   purple `#a06fd6`.
5. **The sidebar bar must be added by hand** — `Sidebar.svelte` does *not* render
   from `RESOURCE_LIST`; each pool has hardcoded markup. There is already a
   scaffold for this: the Row 3 comment reads *"Spirit (Focus is hidden, so
   Spirit spans full width)"*, so the row was designed as **Spirit | Focus** and
   only needs filling in.
   * add `focusPct` beside `spiritPct` (~line 100), same `barPct(cur, cap)` shape;
   * wrap Row 3's Spirit `Tip` in a `<div class="res-row">` with a second bar
     next to it, mirroring Row 2's Stamina | Mana block (~lines 248–285);
   * use the `resTip` snippet, **not** `poolTip` — `poolTip` takes regen and
     efficiency stat names, and focus (like spirit) has neither.
6. `createInitialState` in `state.ts` seeds `focus` at its base max.
7. Save migration `raw.focus = raw.focus ?? <max>`. `SAVE_VERSION` is **31** as
   of writing, so this is 31 → 32 — but re-check first, since another session
   owns the chain and bumped it once already mid-session.

Proposed formulas (tuning, deliberately small and precious like spirit):

```
maxFocus:   3 + 0.30 × CHA + 0.10 × WIS      // new
focusRegen: maxFocus × <share>               // new — mirror manaRegen's shape
maxSpirit:  5 + 0.25 × WIS + 0.10 × CHA      // was 0.1 × WIS + 0.25 × CHA
```

The `maxSpirit` swap is a real balance change to an existing pool. Keep its
`STAT_FORMULAS` string in sync.

## Stage 2 — sustained workings (prerequisite, design separately)

Not overload's job to design. Overload needs only three things from it:

* a shape can be **held** rather than cast and forgotten,
* something **releases** it (voluntarily, on death, on backlash),
* release **refunds** exactly the focus that was committed.

Anything else (upkeep cadence, mid-fight reshaping, combat-loop integration)
belongs to its own plan.

## Stage 3 — overload and backlash

### The dial

Overload rides the held working, not the stored shape:
`Partial<Record<PsiAxisId, number>>`, signed. One dial per axis — you may
amplify an axis or insulate it, never both.

**Settled: one grimoire entry, whatever the overload.** A shape is the entry;
how hard you push it is not part of what it *is*. That is the point of
difference from arcane, where the identity IS the exact sentence — `spellKey`
preserves word order precisely so "fire pierce" and "pierce fire" are two
spells. A psionic entry is one shape you can lean on, which is what "more fluid
than magic" buys.

Two concrete consequences:

* **Overload belongs on `CraftedSpell`, beside `prepared` — never on
  `SpellSource`.** `spellKey` reads only `source` (spellcraft.ts ~46), so
  putting it there keeps the key untouched with no change to the key function at
  all. It becomes per-entry configuration, exactly like `prepared` and the
  player's custom `name`.
* ⚠️ **Overload must be applied AFTER resolution, never inside `shapeSpec`.**
  `resolveSpell` memoises specs in `SPELL_CACHE` keyed by `spellKey`. If
  overload fed into `shapeSpec`, one key would map to several different specs
  and the cache would hand an overloaded spec to a plain cast, or the reverse —
  a bug that would surface as spells mysteriously changing strength. The shape
  is what resolves; overload is a transform on the resolved spec at cast time.

`deriveShape` stops reading one value per axis and reads two:

```
give(a) = points(a) × (1 + OVERLOAD_GAIN) ^ max(0, o(a))
cost(a) = points(a) × (1 − OVERLOAD_MUTE) ^ max(0, −o(a))
```

Then, explicitly:

```
pressureGive = give(force) + give(grip)
pressureCost = cost(force) + cost(grip)
momentum     = give(mass) × give(speed)
momentumCost = cost(mass) × cost(speed)
inertia      = give(mass) − cost(speed)                        // muting speed keeps the wall
acuity       = give(clair) / max(1, cost(reach) + √momentumCost)
awareness    = give(clair) × give(reach)
coherence    = give(space) / max(1, cost(force) + cost(mass))
inward       = give(vit)   / max(1, give(vit) + pressureCost)
```

**Clairvoyance and space are never denominators**, so negative overload on them
is a no-op — reject it in the UI rather than charging for nothing.

### Cost: overload eats max focus while it is held

**This is almost entirely existing machinery.** `rotting` → `rot_recovery`
(`statuses.data.ts` ~41–67) is the exact precedent: a condition accrues
`data.debt` against a pool while held, `expiresTo` a recovery condition that
inherits the debt via `debtPool`, and the recovery removes itself once the debt
is paid. `statusCeiling` already multiplies the pool's max down by that debt.

Two psionics-native conditions, mostly data:

| | field | effect |
| --- | --- | --- |
| `psionic_overload` | `ceilingPerTick: { resource: 'focus', per, max }` | max focus shrinks for as long as the working is held |
| | `duration: null`, `expiresTo: 'psionic_overload_recovery'` | lives as long as the working does |
| `psionic_overload_recovery` | `duration: null`, `ceilingDecay` | ceiling grows back, condition self-removes at zero debt |

`per` scales with **erased tension** — the honest, computable measure:

```
erased = Σ over axes ( points(a) − cost(a) )     // drag actually removed
per    = AMPLIFY_RATE × Σ amplified  +  MUTE_RATE × erased ^ 1.5
```

So amplification is a mild ongoing cost and muting an opposition is an expensive
one, and both bite harder the longer you hold the shape. Holding a heavy
overload slowly strangles your own ceiling until you must let go — which is a
better pressure mechanic than a flat up-front reservation, and it is why the
commit/refund model in the earlier draft was dropped.

**Backlash** then needs no separate trigger: when max focus falls below what the
working needs, the working breaks. Give the break its own psionics-native
condition — a school never borrows another's signature (`unfolded` /
`folded_space` are Ik'Thel'the's, `pacifiesFlankers` is D'Enjalle's). `corrupted`
shows the severe end of this shape, including `fatalOnEmpty`.

### The two genuinely new engine bits

Both live in `systems/statuses.ts`, in the `ceilingDecay` branch of
`tickStatuses` (~line 1034).

1. **Decay tracks the pool's regen** rather than being a flat constant, since the
   ceiling should come back "at the same speed as focus".
2. **Decay is slowed while the pool is not full**: full `focusRegen`-matched rate
   when `current` has reached its reduced max, a fraction of it (~40%, a tuning
   constant) while below. Resting properly restores the ceiling fastest;
   operating at partial focus makes it crawl.

⚠️ **Architectural constraint:** `statuses.ts` deliberately cannot import
`derived.ts` (see the comment above `PoolSnapshot`, ~line 846). The regen rate
and the reduced max must therefore arrive through the existing seam —
`PoolSnapshot` is `{ current, trueMax }` today and wants `availableMax` and
`regenPerTick` added. Extend the single builder `poolSnapshots(state, stats)`,
which already holds `stats`; both call sites (`actions.ts` ~371,
`combat.ts` ~1219) then need no change.

### Type 1 and the existing curve

Apply overload to the axis value **before** `pointCurve` (`n^1.25`), but with a
low per-point rate and an explicit cap constant. Compounding on top of a
superlinear curve on top of a product is explosive: 5 points at 1.15× on force
is already ≈2.4× damage, and on mass+speed together it nearly triples the
hammer. Compounding is wanted — it just has to stay steerable via weights and
caps, with the cost curve doing the real limiting.

## Invariants to test

* Negative overload on `clairvoyance` / `space` is rejected (no cost role).
* No overload value makes a quantity negative, `NaN`, or infinite;
  `shapeSpec` stays total.
* Monotone cost: muting more always eats max focus faster.
* Ceiling recovery is strictly slower while current focus is below its reduced
  max than when it is topped off, and always terminates at true max.
* An overload held and then released returns the ceiling to exactly true max —
  no permanent loss, no drift across repeated hold/release cycles.
* **The oppositions survive.** For any overload, acuity still strictly decreases
  as momentum rises, and inertia still strictly decreases as speed rises. Softened,
  never inverted — this is the test that stops Stage 3 undoing the rebuild.
* Existing recognitions still fire on their shapes at zero overload.

## Verification

```bash
npm run verify
```

**For Stages 0–1 (what actually gets built):**

* Psionic behaviour must be *identical* before and after the rename — the
  existing psionic tests are the regression net, and none of their expected
  values should change.
* In the browser: confirm the wheel now reads `📍 Acuity` with no "Focus"
  anywhere in the psionic tab, and that the Focus bar appears beside Spirit in
  Row 3 at its full value.
* Load a save written **before** `state.focus` existed and confirm the bar reads
  a sane number rather than `NaN`/`0 / 0` — a passing unit test proves little
  about state the UI reaches through a Svelte deep proxy (see
  `env-svelte-proxy-assignment-trap`).
* Check the attribute tooltips: `maxFocus` and the swapped `maxSpirit` formula
  strings must match what `baseStats` actually computes.

**For Stage 3, when it eventually happens:** hold an overloaded working and watch
the focus bar's *max* shrink tick by tick; release it and watch the ceiling crawl
back, faster once the pool itself is topped off; hold one long enough that max
focus falls under what the working needs and confirm it breaks into backlash.

## Deferred / open

* Sustained workings themselves (Stage 2) — own plan.
* Whether arcane or divine ever spend focus, or it stays psionics-only.
* Fused resources (e.g. Aura = stamina + HP). Focus should not block that; no
  design work now.
* Ritual-style spirit buffs — the reason spirit is not psionics' pool. Separate
  feature, and the `corrupted` + `fatalOnEmpty` machinery it needs already exists.
