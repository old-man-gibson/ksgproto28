# System Identities

*What each system is for, so two systems never do the same job the same way.
Two axes: how a system DELIVERS its effects (§1), and what a crafting system
reads from its inputs (§2). §3 is the condition resistance rule every system
builds on.*

## 1. Delivery (user, 2026-10-24)

The user's words, one row per system. The last column is what follows from the
row; it is a reading, not the user's text, and it notes where the code does not
match yet.

| System | Makes | Advantage | Disadvantage | Follows from it |
|---|---|---|---|---|
| Alchemy | Short-term consumables | Costs no mana; can be used any time | Needs crafting; short-lasting | Usable in combat. Flasks last 45–150 s today (`BREW_BASE_DURATION`, `BREW_MAX_DURATION`). |
| Cooking | Long-term dishes | Lasts a long time | Needs crafting; eaten only out of combat | Dishes last 5–15 min today, up to ×1.5 with the cooking milestones. **Not enforced yet:** `canUse` lets the player eat during combat. |
| Arcane magic | Instant effects | Highly modular; readily available, refreshing resource (mana) | Limited space; opportunity cost | Sentences are composed (docs/ARCANE.md); the space limit is the sentence cap and the action bar. |
| Divine magic | Changes to the rules | Unique, exclusive effects | Fixed; expensive to acquire | Miracles and blessings do things no other system can (docs/plans/deities-must-be-met.md). |
| Equipment | Passive effects | Almost always active | Changed only by equipping other gear; static | Smithing, runes and affixes. |
| Mutagens | Changes to the player's base rules | Can change basic rules and exceed normal limits | Very expensive; static; hard to get and improve | The only system that may go past a cap the others respect (docs/MUTAGENS.md). |

A design for any system is checked against its row: a cooking effect that
lasts 30 seconds, or an alchemy flask that lasts an hour, is in the wrong
system.

## 2. Crafting identities (settled 2026-07-24)

What each crafting bench reads from what goes into it. Guards: no system takes
another's reading.

| System | Reads | Guard |
|---|---|---|
| Runecarving | The sum of its elements | Strictly additive: no pair synergies. |
| Cooking | When things are prepared | Cardinal: durations matter (stove timeline, heat windows). |
| Alchemy | The sequence ingredients go in | Ordinal: only relative order. |
| Mutagens | The pattern of genome interactions | Pair synergies and topology belong here. |

## 3. Condition resistance (user, 2026-10-23 and 2026-10-24)

- **Every ordinary condition can be resisted.** Today a condition is resisted
  through its element's resistance (37 harmful conditions carry one).
- **Some conditions are exempt by design** (user, 2026-10-24): special unique
  conditions (`fasting`), state-based conditions (`flat_footed`, `surprised`)
  and environmental conditions (`toll_steam`; `toll_ice` and `toll_overdrive`
  are the same boss fight's phases and are treated the same until the user
  says otherwise). These have no resistance.
- **The seven reviewed (user, 2026-10-24, decision page):** no resistance for
  `doused`, `psionic_compression`, `psionic_read`, `unfolded`. Resistible:
  `overgrowth`, `proliferating`, `queasy`, through poison (their own data
  already uses poison; per-condition resistance is on hold). Eating enough bad
  food unlocks permanent immunity to `queasy` (a hidden title), the one
  permanent immunity outside mutagens.
- **Decided the same day:** resistance does not slow conditions that build by
  stacks (bleeding → lacerated stays 5 cuts); Anupama's two hunger conditions
  keep their dark resistance; at most 3 dishes active at once; any status may
  give temporary immunity while it lasts, permanent immunity comes from
  mutagens; monsters get penetration by tier (0 on floors 1–3); a resistance
  separate from the element (e.g. "Bleeding resistance") is on hold; dish heals
  that stop clearing bleeding are on hold.
- **Immunity at 100%.** A condition does not land when the target's resistance
  to it, minus the applier's penetration, is 100% or more. Same rule for
  players and monsters. A status can also grant immunity outright
  (`StatusDef.immune`).
- **Each system resists conditions in its own way**, by its row in §1: a flask
  for a short spike in combat, a dish for a long buffer before it, gear for a
  small constant amount, divine for exclusive rule changes, mutagens for going
  past the limits.
