---
id: monster-stat-parity
title: A gene modifier means the same thing on either side of the fight
kind: story
status: review
system: combat
parent: monster-genomes
save:
updated: 2026-08-13
invariants:
  - completability
  - two-validation-layers
done:
  - monsterStats resolves fromStat, in its own pass after the clamps
  - monsterSlice reads every dial incomingSlice reads
  - vsSmaller and fromSmaller work in both directions
  - extraSwings and graze exist on the monster swing
  - missRefund is documented as structurally unreachable, with the reason
  - maxMana is documented as not applying, by name, rather than dropped silently
---

# Full stat parity

Rule 3 of [monster-genomes](monster-genomes.md), and the largest story under
it. Chosen deliberately over the cheaper "drop what does not fit and lint it":
a gene has to mean the same thing whoever is wearing it, or the epic's whole
premise — author the body once — is false in the small print.

## What is broken today, measured

Of **128** gene base modifiers:

- **47** target a stat `monsterStats` has no slot for.
- **24** use `fromStat` or `requiresTag`, for which it has **no resolver at
  all** — those two passes simply do not exist on that side.

The second number decides the story. `fromStat` is the entire build identity of
both surviving genera: the troll's damage from `resBludgeoning`, the fire
slime's damage from `resHeat`. `hpRegen` is in the dropped set too, so a troll
monster wearing the troll gene would not regenerate — which is the one thing a
troll is.

## The work, cheapest first

**A `fromStat` pass in `monsterStats`.** `derived.ts` already does this: a
separate pass *after* every ordinary modifier and every clamp, so the source is
always its final value. Copy that ordering exactly, including its consequence —
a derived modifier cannot feed another derived modifier, which makes cycles
impossible by construction rather than by checking for them.

**Grow `monsterSlice` to match `incomingSlice`.** They are already the same
function written twice. `incomingSlice` reads `resistCap` (per-bearer, not the
global constant), `resElemental`, `resRanged`, `damageTaken` and `ward`;
`monsterSlice` reads none of them and hardcodes `MONSTER_RESIST_CAP`. Bring the
five across in the same order and with the same reasoning — `damageTaken`
outside the resistance cap because it is the body rather than the barrier; the
ward eating a flat amount and never banking surplus.

⚠️ `MONSTER_RESIST_CAP` (0.9) and the player's `RESIST_CAP` (0.75) are
different numbers on purpose. Parity means a monster's cap becomes
*modifier-reachable*, not that the two constants merge.

**`critTaken` on the monster as defender.** Read where the player's blow crits,
mirroring what the monster's swing already does to the player.

**`hpRegen` and `attackSpeed`.** `hpRegen` is already a `MonsterStats` field —
it just is not modifier-reachable, because it is populated from
`MONSTERS[id].regen` alone. `attackSpeed` multiplies the monster's bar fill,
which is what it already means for the player.

**`vsSmaller` / `fromSmaller` become bidirectional.** `stepsSmaller` is
one-directional by design today, and the comment says why: they describe being
the bigger thing in the room. That reasoning survives parity intact — what
changes is that a monster can now *be* the bigger thing. Needs a monster size,
which the genome supplies ([monster-def-genome](monster-def-genome.md)) with the
authored size tag as the fallback.

**`extraSwings`, `missRefund`, `graze`.** The three that need a real path
rather than a read. See the corrections below — two shipped, and `missRefund`
turned out to have nothing to refund.

## The one carve-out

**`maxMana` does not apply to monsters.** `castMonsterWorking` has no mana
check, and NEXT.md records that as deliberate: *"Monsters never pay mana"*, and
the atomic-aura design in that file leans on the asymmetry being structural.
Giving monsters a pool is a new resource with new balance, not parity.

So `maxMana` is exempt **by name**, in a named set, with the lint reporting it
as a documented exemption rather than dropping it silently. §11's legibility
rule applies to authoring as much as to the panel: an author routing `maxMana`
into a genome deserves to be told it will do nothing, at authoring time.

Adding a second name to that set is a design decision. It is not a place to put
things that turned out to be hard.

## ⚠️ Two corrections to this card, found while building it

**1. The balance warning was wrong.** This card said the work "changes the
numbers on every existing monster" and wanted its own before/after. Measured
first, as it should have been: across the whole status registry only **three**
mods touch any of these dials — `refutation` (ward ×2, one of them `fromStat`)
and `doused` (hpRegen). Everything else is 0 occurrences. So this was a
**capability add with no behaviour change**, and every default on the new block
is what the pipeline already behaved as. The bestiary needed no re-tuning.

**2. `missRefund` has no home on this side, and the reason is structural.**
A monster's action is not committed until *after* the blow survives dodge and
parry — `spendMonsterAction` and the cooldown stamp both sit below those
`continue`s. So a dodged monster technique already keeps its full cooldown;
there is nothing to refund because nothing was spent.

Making it meaningful would mean moving the commit point above the guard block,
which changes how every existing monster technique behaves and is a combat
design decision rather than a parity chore. The stat is on the block and
reachable; the reader is deliberately absent. **Do not add an inert reader** to
close the checklist — that is the legible lie §11 exists to prevent.

## What shipped

- **`fromStat` in `monsterStats`**, as its own pass after every ordinary
  modifier and every clamp, sources snapshotted first so cycles are impossible
  by construction. This was the single largest hole: it is the build identity
  of both surviving genera.
- **`monsterSlice` grew to match `incomingSlice`** — `resistCap` (per-body, no
  longer the inline constant), `resElemental`, `resRanged`, `damageTaken`,
  `ward`. Two differences kept deliberately: penetration exists only on this
  side, and the floor stays 0 rather than the player's 1.
- **`critTaken`** blunts the player's crits on the defending monster, scaling
  only the surplus.
- **`attackSpeed`** multiplies the monster's bar fill. It had no reader at all,
  so every haste or slow had to be written twice as a `speed` mod to work on
  both sides.
- **`vsSmaller` / `fromSmaller` in both directions**, via a `stepsLarger`
  mirror. Both floors independent, so at equal size neither side bullies.
- **`extraSwings`**, which turned the single monster swing into a loop — and
  fixed **`move.hits`** as a side effect, a gap this file had admitted to in a
  comment ("a multi-hit monster technique will simply land as one ordinary
  blow"). They were the same loop.
- **`graze`**, in the dodge branch, with its own feed line. Three deliberate
  differences from `landGraze` are documented at the function: no trigger event
  (nothing consumes "you were grazed"), no technique multiplier (the move is
  resolved further down), and `onDodge` stays fired.
- **`MONSTER_STAT_KEYS` is now derived** from a neutral block rather than
  hand-listed. The list it replaced held eight names against nine fields, and
  the missing one was `hpRegen` — so a troll wearing the troll gene would not
  have regenerated, which is the one thing a troll is.

Still not read: `move.penetration`, because `incomingSlice` takes no
penetration argument — nothing has ever eroded the *player's* resistances. That
one wants the stat before it wants a caller.
