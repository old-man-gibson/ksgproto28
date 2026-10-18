---
id: anti-magic
title: Anti-magic — undo, with, and counterspells as traps
kind: story
status: review
system: arcane
parent:
save:
updated: 2026-09-28
invariants:
  - completability
  - spell-cache-purity
  - determinism
done:
  - A sentence with undo composes to a counterspell that is never cast on its own and springs inside an enemy casting
  - Efficiency is 20% + 7.5% per extra undo tier + 5% per arcane tier + a match bonus whose ceiling rises while each tier is worth less, uncapped
  - The countered working resolves at 1 − efficiency of itself, and its caster takes manaburn scaled by efficiency
  - Monsters hold counterspells too, sprung by the player's casting, and have a mind for manaburn to eat — in debt it cannot cast
  - with lends a noun-only clause to the clause before it — tuning, riders, a coat, or mending weight
  - onEnemyCast plus two subjects let firing conditions route several traps by what is being cast
---

# Anti-magic

> **The design lives in [ARCANE.md §14](../ARCANE.md).** This card is the
> review surface: what shipped, and what is still a number somebody guessed.

The user's brief (2026-09-28): ready anti-magic spells as if they are traps,
fire them automatically when an enemy casts, and make them more efficient —
and burn harder — the better they match what is being cast. Arcane is the
primary element. `undo` and `with` exist to build them, but not exclusively.

## What shipped

- **`undo` → `unsay` → `unmake`** (verb, Arcana 10, 3 mana, cooldown ×1.2,
  burn 1.0). Any clause with it makes the whole working a counterspell;
  every undo clause in a sentence pools into one.
- **`with`** (conjunction, Arcana 11, 1 mana, `accompany: 0.75`). A linked
  noun-only clause lends its substance instead of acting.
- **The trap.** Prepared counterspells lie in the rotation and spring inside
  `castMonsterWorking` — rotation order, cooldown, mana, seal, and the
  player's firing conditions all apply, like a counter technique inside a
  swing. The mirror, `answerPlayerWorking`, lets a monster's counterspell
  answer yours.
- **Monster minds.** `monsterMind` gives manaburn something to eat on a
  monster without giving it a pool to spend: 1 × INT, the player's regen
  arithmetic, never spent on a working. A mind in debt cannot cast.
- **Content.** The Death Knight holds `undo light with fire`.
- **Dev lever.** *Unlock every word* in the debug panel, since both words sit
  behind the starter-lexicon shutter with nothing in the world to teach them.

## For review — numbers and calls that were guessed

- **The match curve.** `MATCH_FIRST 0.1`, `MATCH_DECAY 0.8` reproduce the
  brief's +10 / +18 exactly; blaze-and-arc lands at +33.6% (6.7% a tier)
  against the brief's +32 (6.4%). A decay of ~0.775 hits +32 at five tiers
  but gives flame +17.7%, so no single geometric curve meets all three of
  the brief's points. Ceiling → +50%.
- **Burn 1.0 × spell power × efficiency.** A 30% answer from a mind of spell
  power 62 burns ~19; a monster's pool is its INT. Whether counters should
  silence casters in two springs or five is the dial.
- **Undo's cost and clock** (3 mana, ×1.2 cooldown per tier) and `with`'s 75%.
- **Monster minds are a new rule**, bounded on purpose: burn-only, never spent,
  outside `MonsterStats`. It also makes the `arcane` noun's escalation bite on
  monsters, which it never did.
- **Addresses.** `undo me` burns the speaker, `undo others` burns every enemy
  at 50%. Faithful to the grammar; neither has an obvious use yet.
- **Access.** No teacher exists for either word. A find or a quest reward
  setting `flag:word:undo` / `flag:word:with` is the whole job.
- **Refutation** (Kritavya) argues with undoings on both sides like any
  working; a sealed undoing stays sealed.
