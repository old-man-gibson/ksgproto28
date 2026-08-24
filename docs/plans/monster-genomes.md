---
id: monster-genomes
title: Monsters carry genomes — one authored thing instead of two
kind: epic
status: draft
system: mutagens
parent:
save:
updated: 2026-08-13
invariants:
  - completability
  - capability-grants-are-costed
  - two-validation-layers
  - modFingerprint
done:
  - A body's abilities are authored ONCE and read by whoever is wearing it, player or monster
  - Every mutagen resolver takes a bearer rather than a GameState
  - MainGeneDef.from stops being a pointer — what a thing drops is what it was
  - Capability grants on a monster are vetted, never inherited by default
  - A gene modifier means the same thing on either side of the fight, or is documented as not applying at all
---

# Monsters carry genomes

Proposed 2026-08-10. **Design settled 2026-08-13** — the four open questions
below are answered, and this card is now buildable. The stated intent it
serves: **every system is reachable by every agent in the game** — player, NPC,
monster — rather than the player being the only thing the interesting machinery
is wired to.

It pulls double duty. It forces every mutagen to work with correct targeting
mechanics, because it will finally have a bearer that is not the player. And it
**halves the authoring load for a whole tier of content**, because a monster
ability and a gene ability stop being two descriptions of the same body and
become one authored thing.

The user's framing, 2026-08-13, which is also the acceptance test: *"only the
genes need to be implemented to grant monsters their signature abilities"* —
and downstream of it, **mutated monsters** that carry several genes at once, a
mutagenic slime being a top-tier threat because of what it is wearing rather
than because its numbers were multiplied.

## Why this is cheaper than it sounds

**The bearer convention already exists in this codebase.** `statuses.ts` is
`(state: GameState, bearer: GameState | MonsterInstance)` throughout — world
first, wearer second. `syncGeneStatuses` already calls `applyStatus(state,
state, …)`, the player passing itself as bearer. This epic does not invent an
architecture; it adopts the one next door.

**`resolveChromosome` is already pure.** Graph in, resolution out, no state and
no roll. Every `GameState` dependency lives at the *accessor* edge —
`chromosomeOf`, `expressedMain`, `fastOf`, `playerGrants`. Widen the edges and
the whole routing engine crosses over untouched.

**The damage pipeline is already two mirrors.** `monsterSlice` and
`incomingSlice` (combat.ts) are the same function written twice for the two
sides. Stat parity is mostly *growing one of them to match the other*, not
building a second pipeline.

**`MonsterInstance.mutation` already exists**, marked *"Reserved for milestone
2 — monster mutations."* This is not a new direction; it is the reserved slot
and the mutagen system turning out to be the same feature.

## ⚠️ The memo hazard — fix this FIRST or the epic is a performance regression

Not previously recorded, and it bites before any of the features do.

`resolveChromosome` (mutagens.ts) and `playerGrants` are both **single-slot**
memos keyed on the chromosome. They are sound today because exactly one
chromosome exists. The moment a monster shares the resolver, the player plus up
to five enemies rotate through one slot and the hit rate goes to **zero** —
on the combat tick (`tickFloatingWeapons` asks `playerGrants` every tick) and
across an offline catch-up's ~288k ticks.

Both become keyed maps in the first story. A monster's def-side genome is
static, so it caches by def id and never recomputes at all; only instance-side
genomes (the last story) need a live key.

> The epic previously said "there is no memo on that side, so live-state reads
> are cheap for monsters". True, and it misses the direction that hurts: the
> problem is not the monster's missing memo, it is the **player's** memo
> breaking once it is shared.

## The honest cost

**`mutagens.ts` is entirely `GameState`-shaped.** `chromosomeOf`,
`expressedMain`, `currentResolution`, `chromosomeMods`, `geneAbility`,
`syncGeneStatuses`, `armGrants`, `fastOf`, `refuteCast`, `priceGeneAbility`,
`liveGrants`, `playerSizeRank` — every one of them takes the player. Widening
those is the bulk of the first story.

The stateful half — capacity, slotting, refining, fusing, the drop roll — stays
`GameState` and should. That is the player's crafting workflow, not a property
of wearing a body.

⚠️ **Evidence the seam is genuinely misplaced rather than merely narrow:**
authoring one asurendra hit it three separate times in one sitting —
`confers` is player-only, so `MonsterDef.wears` had to be invented; the
`fasting` rule had to become a *condition* rather than a gene field so both
sides could say it; and `fastOf` reads the player's chromosome, so a monster
version of the arms was simply not expressible. Each was worked around
individually. Three workarounds in one feature is the seam asking to move.

> Worth knowing: **`MonsterDef.wears` is used by no monster in the game.** It
> was invented for a species that does not exist. It is not load-bearing, and
> once `confers` crosses over it is a candidate for deletion rather than a
> thing to keep in step.

## The four settled rules

### 1. The genome OWNS the monster, with per-species overrides

`MonsterDef.genome` replaces `MainGeneDef.from`. **What a thing drops is what
it is**, in one direction, so the two facts can never disagree.

- `geneFrom(monsterId)` stops being a reverse scan of `MAIN_GENES[].from` and
  becomes a read of the monster's own genome.
- The genome supplies **defaults** for `damageType`, `inflicts` and size. A
  species may still author any of them to override — tuning stays possible
  without editing a shared gene.
- A new monster becomes `id + name + art + tags + attrs + genome`. That is the
  halving.

> **Amended 2026-08-13: `resistances` came OUT of that list.** They are derived
> from **tags**, not from the genome — see [tag-resistances](tag-resistances.md)
> for the measurement that decided it. In short: a monster's resistance is its
> only source (mean 0.498) while a gene's is one contribution among many (mean
> 0.174), and no single number plays both roles without either flattening every
> monster 3–5× or making one gene swap worth Lv40–90 of a resistance skill.
> Tags were also simply the better fit — the table derived from existing data
> reproduces 33 of the 35 species it touches exactly.

**This deletes the dangling-pointer problem by construction rather than by
authoring 20 monsters.** Measured 2026-08-13: **20 of 32** `MainGeneDef.from`
values name a species that does not exist — not the 3 this epic originally
recorded. The whole gigantoid genus, the whole draconic line, and all 7 asura
bodies. Only the 9 slime genes resolve. Under this rule those 20 become
"genes no monster carries yet" — visible, lintable, and honest — instead of a
silent lie in a field nothing validates.

### 2. Capability grants: allowlist plus per-species opt-in

A genome grants **capabilities**, not only stats. MUTAGENS.md §7 is explicit
that these are "never scaled and never capped", and that gaming them is *"the
intended reward for committing to a body"* — costed against a player who chose
one and gave something else up. A monster inherits no such cost.

Measured: **11 of the 12 authored grants are equipment grammar** (`arms:+N`,
`onehand:*`, `onehand:blunt`, `telekinetic:6`). Those are inert on a monster by
construction — every reader (`floatingSlots`, `heldGrips`, `handSwingShare`,
`armsUsed`) takes a `GameState` and reads `state.equipment`, which a monster
has no equivalent of. Nothing needs to be done to make them safe.

The rule therefore only has to cover the ones that would bite:

- `MONSTER_LEGAL_GRANTS` — a named set. Today: `ignores_dodge`,
  `splits_target`, `refutation`.
- A genome-bearing species must **opt in** per grant. Inheritance is never the
  default.
- A lint in both validation layers rejects a monster genome carrying a grant
  that is neither on the list nor opted into.

⚠️ `ignores_dodge` on a monster deletes the player's entire evasion stat from
that fight. That is a very different proposition from the player deleting a
monster's, and it is the reason the default is off rather than on.

### 3. Stat parity is FULL — one carve-out, documented

A gene modifier means the same thing on either side of the fight. Measured
2026-08-13: **47 of 128** gene base modifiers target a stat the monster
pipeline has no slot for, and a further **24** use `fromStat`/`requiresTag`,
for which `monsterStats` has no resolver at all.

That second number is the one that decides it: `fromStat` is the whole build
identity of **both** surviving genera — the troll's damage from
`resBludgeoning`, the fire slime's damage from `resHeat`. Without it a troll
monster wearing the troll gene is a large thing that hits you, which is not
what a troll is.

Full parity, in the order the work actually falls:

| | where it goes | size |
|---|---|---|
| `fromStat` resolution | a second pass in `monsterStats`, after clamps, as `derived.ts` does | small |
| `resistCap`, `resElemental`, `resRanged`, `damageTaken`, `ward` | grow `monsterSlice` to match `incomingSlice` | small — they are already mirrors |
| `critTaken` | monster-as-defender, in the player's swing | small |
| `hpRegen` | already a `MonsterStats` field, just not modifier-reachable | small |
| `attackSpeed` | multiplies the monster's bar fill | small |
| `vsSmaller` / `fromSmaller` | `stepsSmaller` becomes bidirectional; genome supplies monster size | medium |
| `extraSwings` | the monster swing becomes a multi-hit loop | medium |
| `missRefund` | monsters already hold `cooldowns`; needs a monster miss path | medium |
| `graze` | mirror of `landGraze` | medium |

**The carve-out: `maxMana`.** Monsters never pay mana — `castMonsterWorking`
has no mana check, and NEXT.md records that as deliberate, not an oversight.
A mana pool on monsters would be a new resource with new balance, not parity.
`maxMana` is therefore **documented as not applying**, and the lint says so by
name rather than dropping it silently. This is the only stat allowed such an
exemption; adding a second one is a design decision, not a shortcut.

### 4. The gene ability enters the rotation EXPLICITLY

`MonsterAction` gains a `{ gene: true }` variant, so the author places the
signature move in sequence beside casts and techniques.

`MonsterDef.rotation`'s own comment states the rule this keeps: *"a monster's
character is authored by sequence alone."* Appending automatically makes the
signature move a fallback (a troll bites only when it has nothing better to
do); prepending makes every genome-bearing monster open identically.

> This supersedes the earlier "do not build the `MonsterAction` variant" note
> on [asurendra-monsters](asurendra-monsters.md). That ruling was correct
> against a variant used as a **workaround for the missing genome**. Once the
> genome exists, a rotation slot naming the body's own tool is not a
> workaround — it is placement, and placement is what that field is for.

## Build order, and what each stage costs the save

Stages 1–5 touch content types and systems only. **`MonsterInstance` is
untouched until the last one**, so the entire def-side push lands with no
migration. Protect that — it is what makes the epic safely resumable.

| # | Story | Save |
|---|---|---|
| 1 | [bearer-seam](bearer-seam.md) — widen the resolvers, keyed memos | — |
| 2 | [monster-stat-parity](monster-stat-parity.md) — rule 3 | — |
| 3 | [monster-def-genome](monster-def-genome.md) — rule 1, plus the lints | — |
| 4 | [monster-gene-active](monster-gene-active.md) — rule 4 | — |
| 5 | [genome-capability-rule](genome-capability-rule.md) — rule 2 | — |
| 6 | [mutagenic-monsters](mutagenic-monsters.md) — instance-side | **47** |

[tag-resistances](tag-resistances.md) sits outside that order — it depends on
nothing and nothing depends on it, so it landed early, on its own. It settles
the resistance base layer *before* story 2 grows `monsterSlice`, which is the
only reason its position matters at all.

Stage 1 must land first and alone: it is a pure refactor whose acceptance test
is that **player behaviour is bit-identical**, and the existing suite is the
proof. Anything bundled with it destroys that property.

## What it fixes on the way past

`MainGeneDef.from` is a dangling pointer today — see
[asurendra-monsters](asurendra-monsters.md), where all three tier-5 genes name
species that were never authored, and the measurement above, where it turns out
to be 20 of 32. If a monster *has* the genome, "what it drops" and "what it is"
stop being two facts that can disagree.

## Stories under it

- [bearer-seam](bearer-seam.md) — the resolvers take a bearer; the memos become keyed.
- [monster-stat-parity](monster-stat-parity.md) — a gene modifier means the same thing on both sides.
- [monster-def-genome](monster-def-genome.md) — `MonsterDef.genome`, `from` deleted, lints.
- [monster-gene-active](monster-gene-active.md) — the rotation variant.
- [genome-capability-rule](genome-capability-rule.md) — `MONSTER_LEGAL_GRANTS` and the opt-in.
- [mutagenic-monsters](mutagenic-monsters.md) — instance-side genomes; the mutagenic slime.
- [tag-resistances](tag-resistances.md) — resistances come from material, not from genes.
- [asurendra-monsters](asurendra-monsters.md) — the bodies that need this most, now unblocked.
