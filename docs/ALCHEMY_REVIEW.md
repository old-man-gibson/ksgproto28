# Alchemy review (2026-10-23)

*Mastery, visuals and consumables: what was measured, what was proposed, what
the design antagonist broke, and what is waiting on the user.*

Made by the team loop (.claude/TEAM.md): three brainstormers (the brewing
grammar, the visuals, consumables across the game), one `antagonist-design`
pass on the merged shortlist, rulings by the manager. Nothing is built. The
mockups, including a live bench that runs a line-for-line port of
`composeBrew`, are in the artifact "The Alembic Review"
(https://claude.ai/artifact/FXnwSUdvfpFVaUgUD3vi8o, private).

Settled and not reopened by anything here: a flask is only its ordered steps;
nothing rolls; skill buys length and vocabulary, never quality; solvent ×
volatility is the outcome table; thrown flasks never scale with spellPower;
alchemy is ordinal, cooking cardinal, pairwise interactions are mutagens'.

## 1. Measured

| Finding | Evidence |
|---|---|
| The ceiling is size, not kind | Brute force over every 3–5 step brew at grade C: each form's maximum is stacked nightcap or mendroot + a solvent + quicksilver/brimstone. Best bomb 10.1 / 14.9 / 19.7 at 3 / 4 / 5 steps. Fixing salt and green vitriol appear in no maximum. |
| Levels 12–35 buy only slots | Last new reagent is green vitriol at Alchemy 11; slots open at 5/12/22/35. |
| Cures are inert | Only `cleansing` listens to a `cure` event (statuses.data.ts:895). Mendroot's `poison` cure does nothing; bleeding clears only because it closes on heal kind `salve`. |
| Flasks are not in the fight | `useFlask` is wired only from EquipmentPanel; CombatPanel never calls it. |
| The teaching is hover-only | The alembic's notes live in `Tip`, which opens on mouse hover; touch cannot reach it. |
| Not reachable in run 1 | Alchemy manifests at herbalism 3, trained only at the hold (SLICE_REVIEW §3.2). |
| No sale path | `BrewSpec.value` is display only, so flasks open no arbitrage. |

## 2. Defects

- **0.1 Cures.** Each curable status gets `{on:'cure', tag, effect:'remove'}`
  where `tag` is the cure word (mendroot says `bleed`; the status id is
  `bleeding`). Lints, both layers: every `cures` tag is heard by some status;
  an application that overrides `removal` keeps the cure rule.
- **0.2 Run-1 alchemy.** A herbalism gather in Threshold (SLICE_REVIEW A4).
  Without it alchemy is not one of the systems a fresh save can pick (§6a).
- **0.3 Toll Golem.** Reacts to heat/cold/lightning from spells only, as
  FLOODED_FLOOR.md says. Open question: should `hurl` and the oil's per-blow
  bite also call `reactTollGolem`? Neither would call `noteTollSpell`.
- **0.4 Oil payloads.** An oil drops `grants`, `restore` and `cures` silently.
  Floor fix: name every dropped payload in `notes`.

## 3. Proposals and rulings

**A1 Second solvent carries what it thins — user's call (reopens "a second
solvent only dilutes").** A second solvent of a different medium still dilutes
and keeps the potency it took out: water carries that share's drinking effect
to whoever uses the flask (restore if roused, grants if calm); oil carries the
cures; spirit adds nothing. Example: `spirit>emberbloom>mendroot>water>
quicksilver` = 5.8 heat + 6.3 glass, +3.6 HP to the thrower. Attack: v1 carried
the full payload regardless of the pot, which ignores Law 2; it now scales with
what was diluted, so water on an empty pot carries nothing.

**A2 Pattern formulas — recommended.** `BrewFormulaDef.sequence` may hold one
typed blank `{var:'E'; reads: register}`. Known by being taught (Odri Venn at
the Alembics, cards, monster satchels) or by brewing a match; listed in a
re-openable formulary with "lay it out". No bonus. This is §6a's usage column.
Attack: exact formulas win over patterns; known flags are
`flag:formula:<id>`. Lint: every blank has ≥ 2 candidate essences.

**A3 Assays — recommended.** `BrewWants`, a predicate over the folded brew.
Commissions (quest objective, consumes matching flasks, once per run) and
monster weaknesses (×1.5, revealed by the bestiary). The only option that gives
Alchemy 12–35 a target. Attack: weaknesses name form, afflictions, penetration
or cures, never an element (resistances already do); a commission reachable
from the critical path needs a taught formula satisfying it (lint); witnesses
are folded at the grade the level can hold (at B one 3-step brew already meets
the example commission).

**A4 Fume fields — stays banked.** Inert as specified: nothing spawns
mid-fight and `CombatState` dies with the fight. If built: a field on the spot
in `GameState` with an absolute expiry, applied at `startEncounter`.

**B1 Condition doors (Access role) — user's call.** `UnlockCondition +=
{type:'status'; tag}`, `StatusDef.tags`. Doors name a tag, never a system.
Cover after 0.2: n = 6, k = 2, so 5 answers per tag (alchemy, cooking, arcane,
divine, smithing). Attack: v1 was one answer short; the get-home lint
(content.test.ts ~417) ignores `requires` and must treat a status edge as
shut, or a one-way room can strand a player whose status expired; `status` is
banned from gate, clear, PRESTIGE_UNLOCK and quest requirements; every
`UnlockCondition` switch gains a case (conditions.ts, ui/lib/format.ts, forge
templates and FindsEditor, content.test.ts); done includes the cover lint and
one cell test per answer; the alchemy witness is `water>brinecap` (salt after
an unroused brew banks nothing and raises the level bar from 1 to 5).

**B2 Monster satchels — recommended.** `MonsterAction += {brew: string[]}`
with `uses` and optional `below`, folded by `composeBrew`. Thrown through a
`hurl` mirror aimed at the player (`incomingSlice` + `damagePlayer`), never
through `castMonsterWorking`: no refusal, no counterspell, no spell power.
Unthrown flasks drop only at `once`/`fightLimit` spots. Bestiary fact reveals
the sequence; "lay it out" copies it. Attack: Smoulderer's Flask on a fresh
save is 12.7 heat + 23 burn = 36 of 50 HP, so the opener uses `below` and
ships only after a pacing rerun holds `tests/john.test.ts`'s floor-2 bound.

**B3 Belt automation — parked.** Gated on combat legibility (user,
2026-07-27); ships only on the user's word. If built: haven-only loading,
cards refused, auto-use logs its trigger, `player.hasStatus`/`enemy.hasStatus`
(today's `status` subject reads only the first status), offline summary line,
save bump, and no use of a `??=` value in the migration.

**C1 Step ledger — recommended.** `traceBrew(steps)` → one frame per step
(chips, pre-spill potency, volatility, capacity, held essences, that step's
notes); property test: `trace.spec` equals `composeBrew`. The bench draws
volatility against 1.0 and potency against the brim, at fixed height, with the
selected step's reading on the face.
**C2 Outcome plate — recommended.** The 3×2 table lit by the live strip; cell
names fill on first brew (`stats['brewed:<form>']`).
**C3 Combat belt — recommended.** Throw, drink, coat from the Combat tab;
stage animation keyed by `BrewSpec`. No core change.
**C4 Retort — user's call,** an alternative to C1's columns.

## 4. Questions for the user

1. Toll Golem: should flasks and oils react like spells? Default: yes, both.
2. A1: may a second solvent do more than dilute? Default: yes, as revised.
3. Bench readout: ledger (C1), retort (C4), or ledger on desktop and retort on
   phone? Default: ledger.
4. B1: tag doors as the Access role for every system, 5 answers per tag?
   Default: yes, three tags, with FLOOR_STANDARD's door table.
5. B2: monster flasks in optional rooms first, or floor 1–3 halls after a
   pacing rerun? Default: optional rooms first.
6. Formula teachers: Odri Venn for the first two, then cards and satchels?
   Default: yes.

## 5. Order

1. 0.1 and 0.4 (0.3 on the answer). One builder, no save change.
2. 0.2, already queued as SLICE_REVIEW A4.
3. C1 + C2 + C3. One UI builder, no save change.
4. A2 and the formulary page.
5. B2 in optional rooms, then a pacing rerun.
6. A3; A1 if yes.
7. B1 with the floor standard's door table.

Parked: A4 (redesign recorded above), B3 (gated).
